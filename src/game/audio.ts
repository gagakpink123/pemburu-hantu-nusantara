import { AUDIO_ASSETS, type SfxKey } from './constants';
import type { SettingsData } from './types';

type BgmKey = 'bgm_level_1' | 'bgm_level_2' | 'bgm_level_3' | 'bgm_level_4' | 'bgm_level_5';

const ALL_SFX_KEYS = (Object.keys(AUDIO_ASSETS) as Array<keyof typeof AUDIO_ASSETS>).filter(
  (k): k is SfxKey => !k.startsWith('bgm_level_')
);

export class GameAudio {
  private bgmMap = new Map<BgmKey, HTMLAudioElement>();
  private currentBgm: BgmKey | null = null;
  private unlocked = false;

  // Web Audio API zero-lag SFX engine
  private audioCtx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private sfxBuffers = new Map<SfxKey, AudioBuffer>();
  private loadingSfx = new Set<SfxKey>();
  private lastPlayedAt = new Map<SfxKey, number>();

  private settings: SettingsData = {
    bgmVolume: 0.55,
    sfxVolume: 0.78,
    muted: false,
    screenShake: true,
    showTouchControls: 'auto',
  };

  constructor() {
    if (typeof window === 'undefined') return;
    this.initAudioContext();
    this.preloadAllSfx();
  }

  private initAudioContext(): void {
    if (typeof window === 'undefined' || this.audioCtx) return;
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.audioCtx = new Ctor();
      this.sfxGain = this.audioCtx.createGain();
      this.sfxGain.gain.value = this.settings.muted ? 0 : this.settings.sfxVolume;
      this.sfxGain.connect(this.audioCtx.destination);
    } catch {
      this.audioCtx = null;
      this.sfxGain = null;
    }
  }

  private preloadAllSfx(): void {
    if (!this.audioCtx || typeof fetch === 'undefined') return;
    for (const key of ALL_SFX_KEYS) {
      void this.loadSfxBuffer(key);
    }
  }

  private async loadSfxBuffer(key: SfxKey): Promise<void> {
    if (!this.audioCtx || this.sfxBuffers.has(key) || this.loadingSfx.has(key)) return;
    this.loadingSfx.add(key);
    try {
      const res = await fetch(AUDIO_ASSETS[key]);
      if (!res.ok) return;
      const arr = await res.arrayBuffer();
      const decoded = await this.audioCtx.decodeAudioData(arr);
      this.sfxBuffers.set(key, decoded);
    } catch {
      // Safe fallback if decode/fetch fails in restricted frames
    } finally {
      this.loadingSfx.delete(key);
    }
  }

  private getOrCreateBgm(key: BgmKey): HTMLAudioElement {
    let audio = this.bgmMap.get(key);
    if (!audio) {
      audio = new Audio(AUDIO_ASSETS[key]);
      audio.loop = true;
      audio.preload = 'auto';
      this.bgmMap.set(key, audio);
    }
    return audio;
  }

  public updateSettings(next: SettingsData): void {
    this.settings = { ...next };
    this.syncVolumes();
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.audioCtx) {
      this.initAudioContext();
      this.preloadAllSfx();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    if (this.unlocked) return;
    this.unlocked = true;
    if (this.currentBgm && !this.settings.muted) {
      const bgm = this.bgmMap.get(this.currentBgm);
      bgm?.play().catch(() => {});
    }
  }

  public playBgm(key: BgmKey): void {
    if (typeof window === 'undefined') return;
    if (this.currentBgm === key) {
      const active = this.getOrCreateBgm(key);
      if (active.paused && !this.settings.muted) {
        active.volume = this.settings.bgmVolume;
        active.play().catch(() => {});
      }
      return;
    }

    this.stopBgm();
    // Release old BGM buffers from other levels to keep memory flat across multi-level runs
    for (const [k, audio] of this.bgmMap.entries()) {
      if (k !== key) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        this.bgmMap.delete(k);
      }
    }
    this.currentBgm = key;
    const next = this.getOrCreateBgm(key);
    next.currentTime = 0;
    next.volume = this.settings.muted ? 0 : this.settings.bgmVolume;
    if (!this.settings.muted) {
      next.play().catch(() => {});
    }
  }

  public pauseBgm(): void {
    if (!this.currentBgm) return;
    const bgm = this.bgmMap.get(this.currentBgm);
    bgm?.pause();
  }

  public resumeBgm(): void {
    if (!this.currentBgm || this.settings.muted) return;
    const bgm = this.bgmMap.get(this.currentBgm);
    if (bgm) {
      bgm.volume = this.settings.bgmVolume;
      bgm.play().catch(() => {});
    }
  }

  public stopBgm(): void {
    for (const audio of this.bgmMap.values()) {
      audio.pause();
      audio.currentTime = 0;
    }
  }

  public playSfx(key: SfxKey, pitchJitter = 0.07, volumeScale = 1): void {
    if (typeof window === 'undefined' || this.settings.muted || this.settings.sfxVolume <= 0.01) {
      return;
    }

    // Cooldown guard prevents audio stacking spikes when multiple ghosts are hit/defeated in the same frame
    const now = performance.now();
    const last = this.lastPlayedAt.get(key) ?? 0;
    if (now - last < 38) return;
    this.lastPlayedAt.set(key, now);

    if (!this.audioCtx || !this.sfxGain) return;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    const buffer = this.sfxBuffers.get(key);
    if (!buffer) {
      void this.loadSfxBuffer(key);
      return;
    }

    try {
      const src = this.audioCtx.createBufferSource();
      src.buffer = buffer;
      if (pitchJitter > 0) {
        src.playbackRate.value = 1 + (Math.random() * 2 - 1) * pitchJitter;
      }

      let gainNode: GainNode | null = null;
      if (Math.abs(volumeScale - 1) > 0.02) {
        gainNode = this.audioCtx.createGain();
        gainNode.gain.value = Math.max(0, Math.min(1.2, volumeScale));
        src.connect(gainNode);
        gainNode.connect(this.sfxGain);
      } else {
        src.connect(this.sfxGain);
      }

      src.onended = () => {
        try {
          src.disconnect();
          gainNode?.disconnect();
        } catch {
          // Ignore already disconnected nodes
        }
      };

      src.start(0);
    } catch {
      // Safe fallback when audio cannot start yet
    }
  }

  public destroy(): void {
    for (const audio of this.bgmMap.values()) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    this.bgmMap.clear();
    this.sfxBuffers.clear();
    this.loadingSfx.clear();
    this.lastPlayedAt.clear();
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
      this.sfxGain = null;
    }
  }

  private syncVolumes(): void {
    if (this.sfxGain && this.audioCtx) {
      this.sfxGain.gain.setValueAtTime(
        this.settings.muted ? 0 : this.settings.sfxVolume,
        this.audioCtx.currentTime
      );
    }
    for (const [k, audio] of this.bgmMap.entries()) {
      audio.volume = this.settings.muted ? 0 : this.settings.bgmVolume;
      if (k === this.currentBgm) {
        if (this.settings.muted) {
          audio.pause();
        } else if (this.unlocked && audio.paused) {
          audio.play().catch(() => {});
        }
      }
    }
  }
}
