import { GameAudio } from './audio';
import { SpriteBank } from './characterRig';
import {
  BOSS_ARCHETYPES,
  GHOST_ARCHETYPES,
  GRAVITY,
  GROUND_Y,
  HERO_CONFIG,
  ITEM_ASSETS,
  LEVELS,
  WORLD_HEIGHT,
} from './constants';
import {
  circleOverlapsRect,
  computeBossPhase,
  rectsOverlap,
  stepPlayerKinematics,
} from './physics';
import { renderHorrorWorld, type AmbientMote } from './renderer';
import {
  applyLevelVictoryToSave,
  buildLevelLayout,
  calculateComboMultiplier,
  calculateLevelStars,
  createEnemyInstance,
  deriveBossMotionState,
  deriveGhostMotionState,
  loadSaveData,
  persistSaveData,
} from './rules';
import type {
  BossEntity,
  CharacterId,
  CheckpointProp,
  EnemyEntity,
  FloatingText,
  GameState,
  HudSnapshot,
  LevelConfig,
  ModalType,
  Particle,
  Pickup,
  Platform,
  PlayerState,
  Projectile,
  SaveData,
  SettingsData,
  ShockwaveRing,
  TorchProp,
} from './types';

const PARTICLE_POOL_SIZE = 180;
const RING_POOL_SIZE = 24;
const FLOAT_TEXT_POOL_SIZE = 32;

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private container: HTMLElement;
  private resizeObserver: ResizeObserver | null = null;
  private rafId = 0;
  private lastTs = 0;

  private audio = new GameAudio();
  private sprites = new SpriteBank();
  private saveData: SaveData;
  private onHudChange: (snapshot: HudSnapshot, saveData: SaveData) => void;

  private viewW = 1280;
  private viewH = 720;

  private gameState: GameState = 'title';
  private modal: ModalType = 'none';
  private currentLevelIdx = 0;
  private time = 0;
  private hitstopTimer = 0;
  private trauma = 0;
  private shakeX = 0;
  private shakeY = 0;
  private cameraX = 0;

  private level: LevelConfig = LEVELS[0];
  private player!: PlayerState;
  private platforms: Platform[] = [];
  private torches: TorchProp[] = [];
  private checkpoints: CheckpointProp[] = [];
  private pickups: Pickup[] = [];
  private enemies: EnemyEntity[] = [];
  private boss: BossEntity | null = null;
  private projectiles: Projectile[] = [];

  private particles: Particle[] = [];
  private particleCursor = 0;
  private rings: ShockwaveRing[] = [];
  private ringCursor = 0;
  private floatingTexts: FloatingText[] = [];
  private floatCursor = 0;
  private ambientMotes: AmbientMote[] = [];

  private nextProjectileId = 1;
  private nextEnemyId = 500;

  // Run Stats
  private score = 0;
  private coins = 0;
  private starsCollected = 0;
  private starsTotal = 3;
  private crystals = 0;
  private combo = 0;
  private comboTimer = 0;
  private elapsedSec = 0;
  private damageTaken = 0;
  private ghostsDefeated = 0;
  private bannerText: string | null = null;
  private bannerTimer = 0;
  private pendingDefeatTimer = 0;
  private pendingVictoryTimer = 0;
  private endStats: HudSnapshot['endStats'] = null;
  private lastHudPush = 0;
  private lastHudFingerprint = '';
  private hudDirty = false;

  // Unified Input Hub
  private heldKeys = new Set<string>();
  private justPressedKeys = new Set<string>();
  private touchState = {
    left: false,
    right: false,
    jumpHeld: false,
    jumpJust: false,
    shootHeld: false,
    shootJust: false,
    dashJust: false,
  };
  private pointerShootJust = false;

  constructor(
    canvas: HTMLCanvasElement,
    container: HTMLElement,
    onHudChange: (snapshot: HudSnapshot, saveData: SaveData) => void
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context unavailable');
    this.ctx = context;
    this.container = container;
    this.onHudChange = onHudChange;

    this.saveData = loadSaveData();
    this.audio.updateSettings(this.saveData.settings);

    // Pre-allocate zero-GC particle, ring & floating-text pools
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 3,
        alpha: 1,
        life: 0,
        maxLife: 1,
        color: '#fff',
        glow: true,
        gravity: 0,
        kind: 'spark',
      });
    }
    for (let i = 0; i < RING_POOL_SIZE; i++) {
      this.rings.push({
        active: false,
        x: 0,
        y: 0,
        radius: 0,
        maxRadius: 100,
        alpha: 1,
        color: '#fff',
        lineWidth: 3,
      });
    }
    for (let i = 0; i < FLOAT_TEXT_POOL_SIZE; i++) {
      this.floatingTexts.push({
        active: false,
        x: 0,
        y: 0,
        vy: -50,
        text: '',
        color: '#fff',
        life: 0,
        maxLife: 0.9,
        scale: 1,
      });
    }
    for (let i = 0; i < 55; i++) {
      this.ambientMotes.push({
        x: Math.random() * 1800,
        y: 80 + Math.random() * (GROUND_Y - 110),
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 0.5) * 10,
        size: 1.5 + Math.random() * 2.8,
        phase: Math.random() * Math.PI * 2,
      });
    }

    this.loadLevel(1);
    this.setGameState('title', 'none');

    this.bindEvents();
    this.handleResize();

    // Support ?autostart=1 for automated testing or direct launch
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        const reqChar = params.get('char');
        if (reqChar === 'nadhira' || reqChar === 'narendra') {
          this.saveData = { ...this.saveData, selectedCharacter: reqChar };
        }
        const reqLevel = Number(params.get('level')) || 1;
        this.startGame(Math.max(1, Math.min(LEVELS.length, reqLevel)));
      }
    }

    this.lastTs = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  public destroy(): void {
    cancelAnimationFrame(this.rafId);
    this.resizeObserver?.disconnect();
    this.audio.destroy();
    this.sprites.pruneUnused([]);
    this.canvas.removeEventListener('pointerdown', this.onCanvasPointerDown);
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      window.removeEventListener('blur', this.onWindowBlur);
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  // --- Public UI Actions ---

  public getSaveData(): SaveData {
    return this.saveData;
  }

  public selectCharacter(character: CharacterId): void {
    this.audio.unlock();
    this.audio.playSfx('button_click', 0.04);
    this.saveData = { ...this.saveData, selectedCharacter: character };
    persistSaveData(this.saveData);
    this.sprites.preloadForLevel(
      character,
      this.level.ghostPool,
      this.level.bossType,
      [this.level.bgUrl, ...Object.values(ITEM_ASSETS)]
    );
    this.player.maxHp = HERO_CONFIG[character].maxHp;
    this.player.hp = this.player.maxHp;
    this.pushHud(true);
  }

  public openModal(modal: ModalType): void {
    this.audio.unlock();
    this.audio.playSfx('button_click', 0.03);
    this.modal = modal;
    this.pushHud(true);
  }

  public startGame(levelId = this.currentLevelIdx + 1): void {
    this.audio.unlock();
    this.audio.playSfx('button_click', 0.03);
    const clampedId = Math.max(1, Math.min(LEVELS.length, levelId));
    this.loadLevel(clampedId);
    this.clearInputs();
    this.setGameState('playing', 'none');
    this.audio.playBgm(this.level.bgmKey);
    this.showBanner(`Level ${this.level.id}: ${this.level.name}`, 2.5);
    if (typeof document !== 'undefined') {
      (document.activeElement as HTMLElement | null)?.blur?.();
      this.canvas.focus();
    }
    this.pushHud(true);
  }

  public restartLevel(): void {
    this.startGame(this.level.id);
  }

  public nextLevel(): void {
    const next = Math.min(LEVELS.length, this.level.id + 1);
    this.startGame(next);
  }

  public togglePause(): void {
    if (this.gameState === 'playing') {
      this.audio.playSfx('button_click', 0.02);
      this.audio.pauseBgm();
      this.clearInputs();
      this.setGameState('paused', 'pause');
      this.pushHud(true);
    } else if (this.gameState === 'paused') {
      this.resumeGame();
    }
  }

  public resumeGame(): void {
    if (this.gameState !== 'paused') return;
    this.audio.playSfx('button_click', 0.02);
    this.clearInputs();
    this.setGameState('playing', 'none');
    this.audio.resumeBgm();
    if (typeof document !== 'undefined') {
      (document.activeElement as HTMLElement | null)?.blur?.();
      this.canvas.focus();
    }
    this.pushHud(true);
  }

  public returnToTitle(): void {
    this.audio.playSfx('button_click', 0.03);
    this.audio.stopBgm();
    this.clearInputs();
    this.loadLevel(1);
    this.setGameState('title', 'none');
    this.pushHud(true);
  }

  public updateSettings(patch: Partial<SettingsData>): void {
    this.saveData = {
      ...this.saveData,
      settings: { ...this.saveData.settings, ...patch },
    };
    this.audio.updateSettings(this.saveData.settings);
    persistSaveData(this.saveData);
    this.pushHud(true);
  }

  public toggleMute(): void {
    this.audio.unlock();
    this.updateSettings({ muted: !this.saveData.settings.muted });
  }

  public setTouchControl(
    control: 'left' | 'right' | 'jump' | 'shoot' | 'dash',
    pressed: boolean
  ): void {
    this.audio.unlock();
    if (control === 'left') this.touchState.left = pressed;
    else if (control === 'right') this.touchState.right = pressed;
    else if (control === 'jump') {
      if (pressed && !this.touchState.jumpHeld) this.touchState.jumpJust = true;
      this.touchState.jumpHeld = pressed;
    } else if (control === 'shoot') {
      if (pressed && !this.touchState.shootHeld) this.touchState.shootJust = true;
      this.touchState.shootHeld = pressed;
    } else if (control === 'dash') {
      if (pressed) this.touchState.dashJust = true;
    }
  }

  // --- Setup & Input ---

  private bindEvents(): void {
    this.canvas.addEventListener('pointerdown', this.onCanvasPointerDown);
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.container);
    }
  }

  private onCanvasPointerDown = (e: PointerEvent): void => {
    this.audio.unlock();
    this.canvas.focus();
    if (this.gameState === 'playing' && e.button === 0 && e.pointerType !== 'touch') {
      this.pointerShootJust = true;
    }
  };

  private handleResize(): void {
    const rect = this.container.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(240, Math.floor(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const targetCanvasW = Math.floor(w * dpr);
    const targetCanvasH = Math.floor(h * dpr);
    this.viewW = w;
    this.viewH = h;
    if (this.canvas.width !== targetCanvasW || this.canvas.height !== targetCanvasH) {
      this.canvas.width = targetCanvasW;
      this.canvas.height = targetCanvasH;
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const code = e.code;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
      e.preventDefault();
    }
    this.audio.unlock();

    if (code === 'KeyM' && !e.repeat) {
      this.toggleMute();
      return;
    }

    if (this.gameState === 'title') {
      if ((code === 'Enter' || code === 'Space') && this.modal === 'none' && !e.repeat) {
        this.startGame(this.currentLevelIdx + 1);
      } else if (code === 'Escape' && this.modal !== 'none') {
        this.openModal('none');
      }
      return;
    }

    if ((code === 'Escape' || code === 'KeyP') && !e.repeat) {
      if (this.gameState === 'playing' || this.gameState === 'paused') {
        this.togglePause();
      }
      return;
    }

    if (code === 'KeyR' && !e.repeat && (this.gameState === 'playing' || this.gameState === 'gameover')) {
      this.restartLevel();
      return;
    }

    if (!this.heldKeys.has(code)) {
      this.justPressedKeys.add(code);
    }
    this.heldKeys.add(code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.heldKeys.delete(e.code);
  };

  private onWindowBlur = (): void => {
    this.clearInputs();
  };

  private onVisibilityChange = (): void => {
    this.lastTs = performance.now();
    if (document.hidden) {
      this.clearInputs();
      if (this.gameState === 'playing') {
        this.togglePause();
      }
    }
  };

  private clearInputs(): void {
    this.heldKeys.clear();
    this.justPressedKeys.clear();
    this.pointerShootJust = false;
    this.touchState.left = false;
    this.touchState.right = false;
    this.touchState.jumpHeld = false;
    this.touchState.jumpJust = false;
    this.touchState.shootHeld = false;
    this.touchState.shootJust = false;
    this.touchState.dashJust = false;
  }

  private setGameState(state: GameState, modal: ModalType): void {
    this.gameState = state;
    this.modal = modal;
    if (typeof document !== 'undefined') {
      document.body.dataset.state = state;
      if (state !== 'playing' && document.pointerLockElement) {
        document.exitPointerLock?.();
      }
    }
  }

  // --- Level Construction ---

  private loadLevel(levelId: number): void {
    const idx = Math.max(0, Math.min(LEVELS.length - 1, levelId - 1));
    this.currentLevelIdx = idx;
    this.level = LEVELS[idx];

    const char = this.saveData.selectedCharacter;
    const hCfg = HERO_CONFIG[char];
    const keepUrls = new Set<string>([
      hCfg.spriteUrl,
      hCfg.sheet.sheetUrl,
      HERO_CONFIG.nadhira.portraitUrl,
      HERO_CONFIG.narendra.portraitUrl,
      this.level.bgUrl,
      ...Object.values(ITEM_ASSETS),
      ...this.level.ghostPool.flatMap((k) => [
        GHOST_ARCHETYPES[k].spriteUrl,
        GHOST_ARCHETYPES[k].sheet.sheetUrl,
      ]),
      BOSS_ARCHETYPES[this.level.bossType].spriteUrl,
      BOSS_ARCHETYPES[this.level.bossType].sheet.sheetUrl,
      BOSS_ARCHETYPES[this.level.bossType].portraitUrl,
    ]);
    this.sprites.pruneUnused(keepUrls);
    this.sprites.preloadForLevel(char, this.level.ghostPool, this.level.bossType, [
      this.level.bgUrl,
      ...Object.values(ITEM_ASSETS),
    ]);
    const layout = buildLevelLayout(this.level);

    this.platforms = layout.platforms;
    this.torches = layout.torches;
    this.checkpoints = layout.checkpoints;
    this.pickups = layout.pickups;
    this.enemies = layout.enemies;
    this.starsTotal = layout.starsTotal;

    this.player = {
      x: 150,
      y: GROUND_Y - 122,
      vx: 0,
      vy: 0,
      w: 58,
      h: 122,
      facing: 1,
      facingDir: 'right',
      grounded: true,
      coyoteTimer: 0.1,
      jumpBufferTimer: 0,
      jumpsRemaining: 1,
      hp: hCfg.maxHp,
      maxHp: hCfg.maxHp,
      mana: 100,
      maxMana: 100,
      dashTimer: 0,
      dashCooldown: 0,
      dashDir: 1,
      shootCooldown: 0,
      shootAnimTimer: 0,
      invulnTimer: 0,
      hitFlashTimer: 0,
      powerBoostTimer: 0,
      animState: 'idle',
      idleTimer: 0,
      gaitDist: 0,
      scaleX: 1,
      scaleY: 1,
      landTimer: 0,
      spawnX: 150,
      spawnY: GROUND_Y - 122,
      afterimages: [],
    };

    const bossArch = BOSS_ARCHETYPES[this.level.bossType];
    this.boss = {
      kind: this.level.bossType,
      name: bossArch.name,
      title: bossArch.title,
      x: this.level.worldWidth - 300,
      y: bossArch.floating ? GROUND_Y - bossArch.h - 45 : GROUND_Y - bossArch.h,
      vx: 0,
      vy: 0,
      w: bossArch.w,
      h: bossArch.h,
      facing: -1,
      facingDir: 'front',
      animState: 'idle',
      hp: bossArch.hp,
      maxHp: bossArch.hp,
      ghostHp: bossArch.hp,
      phase: 1,
      aiState: 'intro',
      attackPattern: 'barrage',
      aiTimer: 1.1,
      hitFlashTimer: 0,
      defeatTimer: 0,
      active: false,
      defeated: false,
      animTime: 0,
      scaleX: 1,
      scaleY: 1,
      homeX: this.level.worldWidth - 280,
      homeY: bossArch.floating ? GROUND_Y - bossArch.h - 45 : GROUND_Y - bossArch.h,
    };

    this.projectiles = [];
    for (const p of this.particles) p.active = false;
    for (const r of this.rings) r.active = false;
    for (const ft of this.floatingTexts) ft.active = false;

    this.cameraX = 0;
    this.trauma = 0;
    this.hitstopTimer = 0;
    this.score = 0;
    this.coins = 0;
    this.starsCollected = 0;
    this.crystals = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.elapsedSec = 0;
    this.damageTaken = 0;
    this.ghostsDefeated = 0;
    this.pendingDefeatTimer = 0;
    this.pendingVictoryTimer = 0;
    this.endStats = null;
    this.bannerText = null;
    this.bannerTimer = 0;
  }

  // --- Main Loop ---

  private loop = (ts: number): void => {
    const rawDt = (ts - this.lastTs) / 1000;
    this.lastTs = ts;
    const dt = Math.min(Math.max(rawDt, 0), 0.05);

    this.time += dt;
    this.updateCameraShake(dt);
    this.updateVfxPools(dt);

    if (this.gameState === 'title') {
      // Live World Camera Tour / Atmospheric Showcase on Title Screen
      this.cameraX = 110 + Math.sin(this.time * 0.22) * 95;
      this.player.x = this.cameraX + 740;
      this.player.y = GROUND_Y - this.player.h;
      this.player.facing = 1;
      this.player.facingDir = 'front';
      this.player.animState = 'idle';
      this.updateAmbientMotes(dt);
    } else if (this.gameState === 'playing') {
      if (this.bannerTimer > 0) {
        this.bannerTimer -= dt;
        if (this.bannerTimer <= 0) this.bannerText = null;
      }

      if (this.hitstopTimer > 0) {
        this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
        if (this.player.hitFlashTimer > 0) this.player.hitFlashTimer -= dt;
        for (const e of this.enemies) {
          if (e.hitFlashTimer > 0) e.hitFlashTimer -= dt;
        }
        if (this.boss && this.boss.hitFlashTimer > 0) this.boss.hitFlashTimer -= dt;
      } else {
        this.stepSimulation(dt);
      }
      this.updateAmbientMotes(dt);
    }

    this.render();
    this.justPressedKeys.clear();
    this.touchState.jumpJust = false;
    this.touchState.shootJust = false;
    this.touchState.dashJust = false;
    this.pointerShootJust = false;

    if (this.hudDirty || (this.gameState === 'playing' && this.time - this.lastHudPush > 0.1)) {
      const forcePush = this.hudDirty;
      this.hudDirty = false;
      this.pushHud(forcePush);
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  private stepSimulation(dt: number): void {
    // Handle dramatic post-defeat or post-boss-victory beat before modal opens
    if (this.pendingDefeatTimer > 0) {
      this.pendingDefeatTimer -= dt;
      if (this.pendingDefeatTimer <= 0) {
        this.finishGameOver();
      }
      return;
    }
    if (this.pendingVictoryTimer > 0) {
      this.pendingVictoryTimer -= dt;
      this.player.animState = 'celebrate';
      this.player.facingDir = 'front';
      if (this.boss) {
        this.boss.defeatTimer += dt;
        this.boss.animState = 'defeat';
        this.boss.facingDir = 'front';
      }
      if (this.pendingVictoryTimer <= 0) {
        this.finishLevelVictory();
      }
      return;
    }

    this.elapsedSec += dt;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    // 1. Player Movement & Actions
    const leftHeld = this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft') || this.touchState.left;
    const rightHeld = this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight') || this.touchState.right;
    const upHeld = this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp');
    const downHeld = this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown');
    const moveDir: -1 | 0 | 1 = leftHeld && !rightHeld ? -1 : rightHeld && !leftHeld ? 1 : 0;

    const jumpJust =
      this.justPressedKeys.has('Space') ||
      this.justPressedKeys.has('KeyW') ||
      this.justPressedKeys.has('ArrowUp') ||
      this.touchState.jumpJust;
    const jumpHeld =
      this.heldKeys.has('Space') ||
      this.heldKeys.has('KeyW') ||
      this.heldKeys.has('ArrowUp') ||
      this.touchState.jumpHeld;
    const dashJust =
      this.justPressedKeys.has('ShiftLeft') ||
      this.justPressedKeys.has('ShiftRight') ||
      this.justPressedKeys.has('KeyK') ||
      this.touchState.dashJust;
    const shootWanted =
      this.justPressedKeys.has('KeyJ') ||
      this.justPressedKeys.has('KeyZ') ||
      this.justPressedKeys.has('Enter') ||
      this.heldKeys.has('KeyJ') ||
      this.heldKeys.has('KeyZ') ||
      this.touchState.shootJust ||
      this.touchState.shootHeld ||
      this.pointerShootJust;

    const char = this.saveData.selectedCharacter;
    const heroCfg = HERO_CONFIG[char];
    const minArenaX = this.boss && this.boss.active ? this.level.arenaStartX - 24 : 24;
    const maxArenaX = this.level.worldWidth - 36;

    const kine = stepPlayerKinematics(
      this.player,
      { moveDir, upHeld, downHeld, jumpJustPressed: jumpJust, jumpHeld, dashJustPressed: dashJust },
      this.platforms,
      { minX: minArenaX, maxX: maxArenaX },
      dt,
      heroCfg
    );

    if (kine.jumped) {
      this.audio.playSfx('jump', 0.08);
      this.emitParticles(this.player.x + this.player.w * 0.5, this.player.y + this.player.h, 6, '#d6d3d1', 'smoke', 90, -40);
    } else if (kine.doubleJumped) {
      this.audio.playSfx('double_jump', 0.08);
      this.emitRing(this.player.x + this.player.w * 0.5, this.player.y + this.player.h, 46, heroCfg.primaryColor, 2.5);
      this.emitParticles(this.player.x + this.player.w * 0.5, this.player.y + this.player.h, 9, heroCfg.primaryColor, 'star', 140, 20);
    }
    if (kine.dashed) {
      this.audio.playSfx('dash', 0.06);
      this.emitParticles(this.player.x + this.player.w * 0.5, this.player.y + this.player.h * 0.5, 10, heroCfg.primaryColor, 'spark', 180, 0);
    }
    if (kine.landed) {
      this.emitParticles(this.player.x + this.player.w * 0.5, this.player.y + this.player.h, 5, '#a8a29e', 'smoke', 75, -20);
    }

    // Update dash afterimages
    if (this.player.dashTimer > 0) {
      this.player.afterimages.push({
        x: this.player.x,
        y: this.player.y,
        facing: this.player.facing,
        facingDir: this.player.facingDir,
        alpha: 0.75,
      });
      if (this.player.afterimages.length > 5) this.player.afterimages.shift();
    }
    for (let i = this.player.afterimages.length - 1; i >= 0; i--) {
      this.player.afterimages[i].alpha -= dt * 4.5;
      if (this.player.afterimages[i].alpha <= 0) this.player.afterimages.splice(i, 1);
    }

    // Player Magic Shooting
    if (shootWanted && this.player.shootCooldown <= 0 && this.player.dashTimer <= 0) {
      this.fireHeroSpell();
    }

    // 2. Checkpoints
    for (const cp of this.checkpoints) {
      if (!cp.activated && Math.abs(this.player.x + this.player.w * 0.5 - cp.x) < 62) {
        cp.activated = true;
        this.player.spawnX = cp.x;
        this.player.spawnY = cp.y - this.player.h;
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
        this.audio.playSfx('checkpoint', 0.03);
        this.emitRing(cp.x, cp.y - 60, 90, this.level.accentColor, 3);
        this.emitParticles(cp.x, cp.y - 60, 18, '#fde047', 'star', 210, -80);
        this.spawnFloatingText(cp.x, cp.y - 105, 'CHECKPOINT!', '#fde047', 1.1);
        this.hudDirty = true;
      }
    }

    // 3. Pickups & Magnet Collection (prune collected items backward)
    const pcx = this.player.x + this.player.w * 0.5;
    const pcy = this.player.y + this.player.h * 0.5;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const item = this.pickups[i];
      if (item.collected) {
        this.pickups.splice(i, 1);
        continue;
      }
      const dx = pcx - item.x;
      const dy = pcy - item.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 110) item.magnetized = true;
      if (item.magnetized && dist > 1) {
        item.x += (dx / dist) * 440 * dt;
        item.y += (dy / dist) * 440 * dt;
      }
      if (dist < 42) {
        this.collectPickup(item);
        this.pickups.splice(i, 1);
      }
    }

    // 4. Boss Activation Trigger
    if (this.boss && !this.boss.active && !this.boss.defeated && this.player.x >= this.level.arenaStartX + 40) {
      this.boss.active = true;
      this.audio.playSfx('boss_appear', 0);
      this.trauma = Math.max(this.trauma, 0.55);
      this.showBanner(`BOSS MUNCUL: ${this.boss.name.toUpperCase()}`, 3.0);
      this.hudDirty = true;
    }

    // 5. Update Ghosts (8 Distinct Policies + Attack Token Pool)
    this.updateEnemies(dt);

    // 6. Update Boss
    if (this.boss && this.boss.active && !this.boss.defeated) {
      this.updateBoss(dt);
    }

    // 7. Update Projectiles & Collisions
    this.updateProjectiles(dt);

    // 8. Camera Smooth Follow
    const scale = this.viewH / WORLD_HEIGHT;
    const worldViewW = this.viewW / scale;
    const targetCamX =
      this.boss && this.boss.active
        ? Math.max(this.level.arenaStartX - 30, Math.min(this.level.worldWidth - worldViewW, this.player.x - worldViewW * 0.34))
        : Math.max(0, Math.min(this.level.worldWidth - worldViewW, this.player.x - worldViewW * 0.36));
    this.cameraX += (targetCamX - this.cameraX) * (1 - Math.exp(-7.5 * dt));
  }

  private fireHeroSpell(): void {
    const char = this.saveData.selectedCharacter;
    const cfg = HERO_CONFIG[char];
    const boosted = this.player.powerBoostTimer > 0;
    this.player.shootCooldown = boosted ? cfg.fireCooldown * 0.68 : cfg.fireCooldown;
    this.player.shootAnimTimer = 0.18;

    const muzzleX = this.player.x + (this.player.facing === 1 ? this.player.w + 14 : -14);
    const muzzleY = this.player.y + this.player.h * 0.48;

    this.projectiles.push({
      id: this.nextProjectileId++,
      fromPlayer: true,
      characterId: char,
      kind: char === 'nadhira' ? 'star_blast' : 'thunder_blast',
      x: muzzleX,
      y: muzzleY,
      vx: this.player.facing * cfg.projectileSpeed,
      vy: 0,
      radius: boosted ? 19 : 15,
      damage: boosted ? Math.round(cfg.projectileDamage * 1.45) : cfg.projectileDamage,
      life: 1.35,
      maxLife: 1.35,
      pierce: boosted ? 2 : 1,
      color: cfg.primaryColor,
      glowColor: cfg.glowRgba,
      trail: [],
    });

    this.audio.playSfx('shoot_magic', 0.08, 0.85);
    this.emitParticles(muzzleX, muzzleY, 5, cfg.secondaryColor, char === 'nadhira' ? 'star' : 'spark', 150, 0);
  }

  private updateEnemies(dt: number): void {
    const pcx = this.player.x + this.player.w * 0.5;
    const pcy = this.player.y + this.player.h * 0.5;

    // Count active attack tokens (cap at 3 simultaneous attackers so waves remain readable)
    let activeTokens = 0;
    for (const e of this.enemies) {
      if (!e.dead && e.hasAttackToken) activeTokens++;
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.animTime += dt;
      if (enemy.hitFlashTimer > 0) enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - dt);
      if (enemy.afterimageAlpha > 0) enemy.afterimageAlpha = Math.max(0, enemy.afterimageAlpha - dt * 2.2);

      const damp = 1 - Math.exp(-12 * dt);
      enemy.scaleX += (1 - enemy.scaleX) * damp;
      enemy.scaleY += (1 - enemy.scaleY) * damp;

      if (enemy.dead) {
        enemy.dyingTimer += dt;
        enemy.x += enemy.vx * dt;
        enemy.y += enemy.vy * dt;
        enemy.vy += 450 * dt;
        enemy.animState = 'defeat';
        if (enemy.dyingTimer > 0.56) {
          this.enemies.splice(i, 1);
        }
        continue;
      }

      const ecx = enemy.x + enemy.w * 0.5;
      const ecy = enemy.y + enemy.h * 0.5;
      const dx = pcx - ecx;
      const dy = pcy - ecy;
      const dist = Math.hypot(dx, dy);
      const arch = GHOST_ARCHETYPES[enemy.kind];

      // Only engage within 660px of hero, and keep opening 2.5s safe if player hasn't moved from spawn
      const inOpeningGrace = this.elapsedSec < 2.5 && this.player.x < 220;
      if (dist > 660 || inOpeningGrace) {
        enemy.vx *= Math.exp(-9 * dt);
        if (enemy.hasAttackToken) {
          enemy.hasAttackToken = false;
          activeTokens = Math.max(0, activeTokens - 1);
        }
        const idleMotion = deriveGhostMotionState(enemy, arch.floating, dist);
        enemy.animState = idleMotion.animState;
        enemy.facingDir = idleMotion.facingDir;
        continue;
      }

      if (enemy.aiPhase === 'patrol') {
        enemy.aiTimer -= dt;
        const dirToPlayer: 1 | -1 = dx >= 0 ? 1 : -1;

        if (enemy.policy === 'hopper') {
          // Pocong hops rhythmically toward player
          if (enemy.grounded && enemy.aiTimer <= 0) {
            if (dist < 420 && activeTokens < 3) {
              enemy.hasAttackToken = true;
              activeTokens++;
              enemy.aiPhase = 'windup';
              enemy.aiTimer = arch.windupSec;
              enemy.facing = dirToPlayer;
              enemy.scaleX = 1.18;
              enemy.scaleY = 0.8;
              this.audio.playSfx('pocong_sound', 0.1, 0.65);
            } else {
              enemy.vy = -510;
              enemy.vx = dirToPlayer * enemy.speed * 0.9;
              enemy.facing = dirToPlayer;
              enemy.grounded = false;
              enemy.aiTimer = 0.72;
              enemy.scaleX = 0.86;
              enemy.scaleY = 1.16;
            }
          }
        } else if (enemy.policy === 'hover_dive') {
          // Kuntilanak floats eerily and prepares dive
          enemy.facing = dirToPlayer;
          enemy.vx = dirToPlayer * enemy.speed * 0.52;
          const targetY = GROUND_Y - enemy.h - 95 + Math.sin(enemy.animTime * 2.5) * 28;
          enemy.vy = (targetY - enemy.y) * 3.5;
          if (enemy.aiTimer <= 0 && dist < 440 && activeTokens < 3) {
            enemy.hasAttackToken = true;
            activeTokens++;
            enemy.aiPhase = 'windup';
            enemy.aiTimer = arch.windupSec;
            this.audio.playSfx('kuntilanak_laugh', 0.08, 0.6);
          }
        } else if (enemy.policy === 'thief_sprint') {
          // Tuyul darts rapidly straight at player to steal coins
          enemy.facing = dirToPlayer;
          enemy.vx = dirToPlayer * enemy.speed;
        } else if (enemy.policy === 'heavy_charge') {
          // Genderuwo stalks slowly then roars & charges
          enemy.facing = dirToPlayer;
          enemy.vx = dirToPlayer * enemy.speed * 0.45;
          if (enemy.aiTimer <= 0 && dist < 460 && activeTokens < 3) {
            enemy.hasAttackToken = true;
            activeTokens++;
            enemy.aiPhase = 'windup';
            enemy.aiTimer = arch.windupSec;
            enemy.vx = 0;
            this.audio.playSfx('genderuwo_roar', 0.06, 0.75);
          }
        } else if (enemy.policy === 'crawl_surge') {
          // Suster Ngesot crawls in creepy rhythmic bursts
          const burst = Math.sin(enemy.animTime * 4.6) > 0.15;
          enemy.facing = dirToPlayer;
          enemy.vx = burst ? dirToPlayer * enemy.speed * 1.15 : dirToPlayer * 24;
        } else if (enemy.policy === 'stalker_claw') {
          enemy.facing = dirToPlayer;
          enemy.vx = dirToPlayer * enemy.speed * 0.72;
          if (dist < 250 && enemy.aiTimer <= 0 && activeTokens < 3) {
            enemy.hasAttackToken = true;
            activeTokens++;
            enemy.aiPhase = 'windup';
            enemy.aiTimer = arch.windupSec;
            enemy.vx = 0;
          }
        } else if (enemy.policy === 'ranged_orb') {
          // Leak Bali keeps mid-range distance & fires cursed orbs
          enemy.facing = dirToPlayer;
          const desiredDist = 310;
          enemy.vx = dist > desiredDist + 40 ? dirToPlayer * enemy.speed * 0.6 : dist < desiredDist - 50 ? -dirToPlayer * enemy.speed * 0.65 : 0;
          const targetY = GROUND_Y - enemy.h - 70 + Math.sin(enemy.animTime * 3) * 20;
          enemy.vy = (targetY - enemy.y) * 3.2;
          if (enemy.aiTimer <= 0 && dist < 560 && activeTokens < 3) {
            enemy.hasAttackToken = true;
            activeTokens++;
            enemy.aiPhase = 'windup';
            enemy.aiTimer = arch.windupSec;
            enemy.vx = 0;
          }
        } else if (enemy.policy === 'shadow_blink') {
          // Hantu Bayangan stalks then blinks behind player
          enemy.facing = dirToPlayer;
          enemy.vx = dirToPlayer * enemy.speed * 0.65;
          const targetY = GROUND_Y - enemy.h - 45 + Math.sin(enemy.animTime * 2.8) * 18;
          enemy.vy = (targetY - enemy.y) * 3;
          if (enemy.aiTimer <= 0 && dist < 440 && activeTokens < 3) {
            enemy.hasAttackToken = true;
            activeTokens++;
            enemy.aiPhase = 'windup';
            enemy.aiTimer = arch.windupSec;
            enemy.vx = 0;
          }
        }
      } else if (enemy.aiPhase === 'windup') {
        enemy.vx *= Math.exp(-11 * dt);
        enemy.aiTimer -= dt;
        if (enemy.aiTimer <= 0) {
          enemy.aiPhase = 'attack';
          const dir: 1 | -1 = pcx >= ecx ? 1 : -1;
          enemy.facing = dir;

          if (enemy.policy === 'hopper') {
            enemy.vy = -620;
            enemy.vx = dir * enemy.speed * 1.85;
            enemy.grounded = false;
            enemy.aiTimer = 0.7;
            enemy.scaleX = 0.82;
            enemy.scaleY = 1.22;
          } else if (enemy.policy === 'hover_dive') {
            const len = Math.max(1, dist);
            enemy.vx = (dx / len) * 520;
            enemy.vy = (dy / len) * 440;
            enemy.aiTimer = 0.55;
          } else if (enemy.policy === 'heavy_charge') {
            enemy.vx = dir * 480;
            enemy.aiTimer = 0.68;
            this.trauma = Math.max(this.trauma, 0.25);
          } else if (enemy.policy === 'stalker_claw') {
            enemy.vx = dir * 430;
            enemy.vy = -210;
            enemy.grounded = false;
            enemy.aiTimer = 0.42;
          } else if (enemy.policy === 'ranged_orb') {
            const len = Math.max(1, dist);
            this.projectiles.push({
              id: this.nextProjectileId++,
              fromPlayer: false,
              kind: 'fire_skull',
              x: ecx + dir * 24,
              y: ecy - 12,
              vx: (dx / len) * 420,
              vy: (dy / len) * 420,
              radius: 12,
              damage: 1,
              life: 2.2,
              maxLife: 2.2,
              pierce: 1,
              color: '#fb923c',
              glowColor: 'rgba(249, 115, 22, 0.6)',
              trail: [],
            });
            enemy.aiTimer = 0.25;
          } else if (enemy.policy === 'shadow_blink') {
            enemy.afterimageX = enemy.x;
            enemy.afterimageY = enemy.y;
            enemy.afterimageAlpha = 1;
            const blinkX = Math.max(60, Math.min(this.level.worldWidth - 100, pcx + (dir === 1 ? 140 : -180)));
            this.emitParticles(ecx, ecy, 12, '#a855f7', 'smoke', 150, -30);
            enemy.x = blinkX;
            this.emitParticles(enemy.x + enemy.w * 0.5, ecy, 12, '#a855f7', 'smoke', 150, -30);
            enemy.vx = (pcx >= enemy.x ? 1 : -1) * 380;
            enemy.aiTimer = 0.45;
          }
        }
      } else if (enemy.aiPhase === 'attack') {
        enemy.aiTimer -= dt;
        if (enemy.aiTimer <= 0) {
          enemy.aiPhase = 'recover';
          enemy.aiTimer = 0.65;
          if (enemy.hasAttackToken) {
            enemy.hasAttackToken = false;
            activeTokens = Math.max(0, activeTokens - 1);
          }
        }
      } else if (enemy.aiPhase === 'recover') {
        enemy.vx *= Math.exp(-9 * dt);
        enemy.aiTimer -= dt;
        if (enemy.aiTimer <= 0) {
          enemy.aiPhase = 'patrol';
          enemy.aiTimer = 1.0 + (enemy.id % 3) * 0.4;
        }
      } else if (enemy.aiPhase === 'flee') {
        // Tuyul flees after stealing coins!
        const away: 1 | -1 = dx >= 0 ? -1 : 1;
        enemy.facing = away;
        enemy.vx = away * enemy.speed * 1.15;
        enemy.aiTimer -= dt;
        if (enemy.aiTimer <= 0) {
          enemy.aiPhase = 'patrol';
          enemy.aiTimer = 0.8;
        }
      }

      // Gravity for non-floating ghosts
      if (!arch.floating) {
        enemy.vy = Math.min(880, enemy.vy + GRAVITY * dt);
      }

      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;

      if (!arch.floating && enemy.y + enemy.h >= GROUND_Y) {
        enemy.y = GROUND_Y - enemy.h;
        enemy.vy = 0;
        if (!enemy.grounded) {
          enemy.grounded = true;
          enemy.scaleX = 1.18;
          enemy.scaleY = 0.82;
        }
      } else if (arch.floating && enemy.y + enemy.h > GROUND_Y - 12) {
        enemy.y = GROUND_Y - enemy.h - 12;
        enemy.vy = Math.min(0, enemy.vy);
      }

      if (enemy.x < 40) enemy.x = 40;
      if (enemy.x > this.level.worldWidth - enemy.w - 40) enemy.x = this.level.worldWidth - enemy.w - 40;
      if (Math.abs(enemy.vx) > 15) {
        enemy.gaitDist += Math.abs(enemy.vx) * dt;
      }

      const motion = deriveGhostMotionState(enemy, arch.floating, dist);
      enemy.animState = motion.animState;
      enemy.facingDir = motion.facingDir;

      // Check contact damage with hero
      const hitBoxPlayer = {
        x: this.player.x + 10,
        y: this.player.y + 8,
        w: this.player.w - 20,
        h: this.player.h - 12,
      };
      const hitBoxEnemy = {
        x: enemy.x + 8,
        y: enemy.y + 8,
        w: enemy.w - 16,
        h: enemy.h - 12,
      };
      if (this.player.dashTimer <= 0 && rectsOverlap(hitBoxPlayer, hitBoxEnemy)) {
        if (enemy.policy === 'thief_sprint' && enemy.aiPhase !== 'flee' && this.coins > 0) {
          const stolen = Math.min(2, this.coins);
          this.coins -= stolen;
          enemy.stolenCoins += stolen;
          enemy.aiPhase = 'flee';
          enemy.aiTimer = 1.5;
          this.audio.playSfx('tuyul_sound', 0.08);
          this.spawnFloatingText(enemy.x + enemy.w * 0.5, enemy.y - 12, `-${stolen} Koin!`, '#facc15', 1.0);
        }
        this.damagePlayer(enemy.damage, enemy.x + enemy.w * 0.5);
      }
    }
  }

  private updateBoss(dt: number): void {
    const boss = this.boss;
    if (!boss || boss.defeated) return;
    const arch = BOSS_ARCHETYPES[boss.kind];

    boss.animTime += dt;
    if (boss.hitFlashTimer > 0) boss.hitFlashTimer = Math.max(0, boss.hitFlashTimer - dt);
    boss.ghostHp += (boss.hp - boss.ghostHp) * Math.min(1, dt * 4.5);

    const damp = 1 - Math.exp(-10 * dt);
    boss.scaleX += (1 - boss.scaleX) * damp;
    boss.scaleY += (1 - boss.scaleY) * damp;

    const newPhase = computeBossPhase(boss);
    if (newPhase > boss.phase) {
      boss.phase = newPhase;
      this.hitstopTimer = 0.07;
      this.trauma = Math.max(this.trauma, 0.72);
      this.emitRing(boss.x + boss.w * 0.5, boss.y + boss.h * 0.5, 220, arch.projectileColor, 5);
      this.emitParticles(boss.x + boss.w * 0.5, boss.y + boss.h * 0.5, 28, arch.projectileColor, 'star', 320, -60);
      this.showBanner(`${boss.name} — FASE ${boss.phase}!`, 2.0);
      this.audio.playSfx('genderuwo_roar', 0.05);
    }

    const pcx = this.player.x + this.player.w * 0.5;
    const pcy = this.player.y + this.player.h * 0.5;
    const bcx = boss.x + boss.w * 0.5;
    const bcy = boss.y + boss.h * 0.5;
    const dx = pcx - bcx;
    const dy = pcy - bcy;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const speedMult = boss.phase === 3 ? 1.4 : boss.phase === 2 ? 1.18 : 1;

    boss.aiTimer -= dt;

    if (boss.aiState === 'intro') {
      boss.facing = -1;
      if (boss.aiTimer <= 0) {
        boss.aiState = 'stalk';
        boss.aiTimer = 1.2;
      }
    } else if (boss.aiState === 'stalk') {
      boss.facing = dx >= 0 ? 1 : -1;
      const targetX = dx > 240 ? 160 * speedMult : dx < -240 ? -160 * speedMult : 0;
      boss.vx += (targetX - boss.vx) * Math.min(1, dt * 5);
      if (boss.aiTimer <= 0) {
        boss.aiState = 'windup';
        boss.aiTimer = boss.phase === 3 ? 0.48 : 0.64;
        const patterns: BossEntity['attackPattern'][] = ['barrage', 'charge', 'slam', 'summon'];
        boss.attackPattern = patterns[Math.floor(this.time * 10) % patterns.length];
        boss.vx = 0;
      }
    } else if (boss.aiState === 'windup') {
      boss.facing = dx >= 0 ? 1 : -1;
      boss.vx *= Math.exp(-9 * dt);
      if (boss.aiTimer <= 0) {
        boss.aiState = 'attack';
        if (boss.attackPattern === 'barrage') {
          const orbCount = boss.phase === 3 ? 5 : 3;
          for (let i = 0; i < orbCount; i++) {
            const spread = (i - (orbCount - 1) / 2) * 0.24;
            const baseAngle = Math.atan2(dy, dx) + spread;
            this.projectiles.push({
              id: this.nextProjectileId++,
              fromPlayer: false,
              kind: 'spirit_orb',
              x: bcx,
              y: bcy - 20,
              vx: Math.cos(baseAngle) * 440 * speedMult,
              vy: Math.sin(baseAngle) * 440 * speedMult,
              radius: 15,
              damage: 1,
              life: 2.5,
              maxLife: 2.5,
              pierce: 1,
              color: arch.projectileColor,
              glowColor: arch.auraColor,
              trail: [],
            });
          }
          boss.aiTimer = 0.5;
        } else if (boss.attackPattern === 'charge') {
          boss.vx = boss.facing * 540 * speedMult;
          boss.aiTimer = 0.72;
          this.trauma = Math.max(this.trauma, 0.35);
        } else if (boss.attackPattern === 'slam') {
          boss.vy = -560;
          boss.vx = boss.facing * 260;
          boss.aiTimer = 0.85;
        } else if (boss.attackPattern === 'summon') {
          const aliveMinions = this.enemies.filter((e) => !e.dead && e.x >= this.level.arenaStartX - 40).length;
          if (aliveMinions < 2) {
            const spawnKind = this.level.ghostPool[0];
            const spawnH = GHOST_ARCHETYPES[spawnKind].h;
            const sx = Math.max(this.level.arenaStartX + 40, Math.min(this.level.worldWidth - 120, bcx + (Math.random() > 0.5 ? -130 : 130)));
            this.enemies.push(createEnemyInstance(this.nextEnemyId++, spawnKind, sx, GROUND_Y - spawnH, 1));
            this.emitRing(sx, GROUND_Y - 50, 95, arch.projectileColor, 3);
          }
          boss.aiTimer = 0.45;
        }
      }
    } else if (boss.aiState === 'attack') {
      if (boss.aiTimer <= 0) {
        boss.aiState = 'recover';
        boss.aiTimer = boss.phase === 3 ? 0.55 : 0.85;
      }
    } else if (boss.aiState === 'recover') {
      boss.vx *= Math.exp(-7.5 * dt);
      if (boss.aiTimer <= 0) {
        boss.aiState = 'stalk';
        boss.aiTimer = boss.phase === 3 ? 0.75 : 1.15;
      }
    }

    if (!arch.floating) {
      boss.vy = Math.min(900, boss.vy + GRAVITY * dt);
    } else {
      boss.y = boss.homeY + Math.sin(boss.animTime * 2.2) * 34;
    }

    boss.x += boss.vx * dt;
    if (!arch.floating) {
      boss.y += boss.vy * dt;
      if (boss.y + boss.h >= GROUND_Y) {
        if (boss.vy > 360) {
          this.trauma = Math.max(this.trauma, 0.48);
          this.emitRing(bcx, GROUND_Y - 4, 150, arch.projectileColor, 4);
        }
        boss.y = GROUND_Y - boss.h;
        boss.vy = 0;
      }
    }

    const minX = this.level.arenaStartX + 10;
    const maxX = this.level.worldWidth - boss.w - 30;
    if (boss.x < minX) {
      boss.x = minX;
      boss.vx = Math.abs(boss.vx) * 0.4;
    } else if (boss.x > maxX) {
      boss.x = maxX;
      boss.vx = -Math.abs(boss.vx) * 0.4;
    }

    // Sync Boss 4-direction orientation & 7-state animation
    const bossMotion = deriveBossMotionState(boss, arch.floating);
    boss.animState = bossMotion.animState;
    boss.facingDir = bossMotion.facingDir;

    // Contact damage
    if (
      this.player.dashTimer <= 0 &&
      rectsOverlap(
        { x: this.player.x + 10, y: this.player.y + 8, w: this.player.w - 20, h: this.player.h - 12 },
        { x: boss.x + 18, y: boss.y + 18, w: boss.w - 36, h: boss.h - 24 }
      )
    ) {
      this.damagePlayer(arch.damage, bcx);
    }
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.trail.push({ x: proj.x, y: proj.y });
      if (proj.trail.length > 8) proj.trail.shift();

      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.life -= dt;

      let remove = proj.life <= 0;

      if (proj.fromPlayer) {
        // Check regular ghosts
        for (const enemy of this.enemies) {
          if (enemy.dead) continue;
          if (circleOverlapsRect(proj.x, proj.y, proj.radius, { x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h })) {
            this.hitEnemy(enemy, proj.damage, Math.sign(proj.vx) || 1, proj.x, proj.y, proj.color);
            proj.pierce--;
            if (proj.pierce <= 0) {
              remove = true;
              break;
            }
          }
        }
        // Check boss
        if (!remove && this.boss && this.boss.active && !this.boss.defeated) {
          const b = this.boss;
          if (circleOverlapsRect(proj.x, proj.y, proj.radius, { x: b.x + 12, y: b.y + 12, w: b.w - 24, h: b.h - 16 })) {
            this.hitBoss(proj.damage, proj.x, proj.y, proj.color);
            remove = true;
          }
        }
      } else {
        // Enemy/Boss projectile hitting hero
        if (
          this.player.dashTimer <= 0 &&
          circleOverlapsRect(proj.x, proj.y, proj.radius, {
            x: this.player.x + 8,
            y: this.player.y + 8,
            w: this.player.w - 16,
            h: this.player.h - 12,
          })
        ) {
          this.damagePlayer(proj.damage, proj.x);
          remove = true;
        }
      }

      if (remove) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  private hitEnemy(
    enemy: EnemyEntity,
    damage: number,
    dir: number,
    hitX: number,
    hitY: number,
    color: string
  ): void {
    enemy.hp -= damage;
    enemy.hitFlashTimer = 0.075;
    enemy.vx = dir * 160;
    enemy.scaleX = 0.85;
    enemy.scaleY = 1.15;

    this.audio.playSfx('magic_hit', 0.1, 0.75);
    this.emitParticles(hitX, hitY, 10, color, 'star', 210, -40);
    this.spawnFloatingText(enemy.x + enemy.w * 0.5, enemy.y - 6, `-${damage}`, '#fef08a', 0.95);

    if (enemy.hp <= 0) {
      enemy.dead = true;
      enemy.dyingTimer = 0;
      enemy.vx = dir * 210;
      enemy.vy = -220;
      enemy.hasAttackToken = false;

      this.combo++;
      this.comboTimer = 3.5;
      this.ghostsDefeated++;
      const mult = calculateComboMultiplier(this.combo);
      const pts = Math.round(enemy.scoreValue * mult);
      this.score += pts;

      this.trauma = Math.max(this.trauma, 0.22);
      this.audio.playSfx('ghost_defeat', 0.08);
      this.emitRing(enemy.x + enemy.w * 0.5, enemy.y + enemy.h * 0.5, 80, color, 3);
      this.emitParticles(enemy.x + enemy.w * 0.5, enemy.y + enemy.h * 0.5, 14, color, 'spark', 280, -80);
      this.spawnFloatingText(
        enemy.x + enemy.w * 0.5,
        enemy.y - 24,
        this.combo >= 3 ? `+${pts} (x${mult.toFixed(1)})` : `+${pts}`,
        '#38bdf8',
        1.15
      );

      // Drop bonus coins (or stolen Tuyul coins)
      const coinDrop = 1 + enemy.stolenCoins;
      for (let c = 0; c < coinDrop; c++) {
        this.pickups.push({
          id: 90000 + Math.floor(Math.random() * 100000),
          kind: 'coin',
          x: enemy.x + enemy.w * 0.5 + (c - coinDrop * 0.5) * 24,
          y: enemy.y + enemy.h - 32,
          vy: 0,
          bobOffset: c,
          collected: false,
          magnetized: false,
        });
      }
      this.hudDirty = true;
    } else {
      this.audio.playSfx('ghost_hit', 0.1, 0.7);
    }
  }

  private hitBoss(damage: number, hitX: number, hitY: number, color: string): void {
    const boss = this.boss;
    if (!boss || boss.defeated) return;
    boss.hp = Math.max(0, boss.hp - damage);
    boss.hitFlashTimer = 0.065;
    boss.scaleX = 0.94;
    boss.scaleY = 1.06;

    this.audio.playSfx('magic_hit', 0.08, 0.85);
    this.emitParticles(hitX, hitY, 12, color, 'star', 240, -40);
    this.spawnFloatingText(hitX, hitY - 12, `-${damage}`, '#fde047', 1.05);

    if (boss.hp <= 0) {
      boss.defeated = true;
      boss.aiState = 'defeated';
      boss.animState = 'defeat';
      boss.facingDir = 'front';
      boss.defeatTimer = 0;
      const arch = BOSS_ARCHETYPES[boss.kind];
      this.score += arch.score;
      this.ghostsDefeated++;
      this.hitstopTimer = 0.08;
      this.trauma = 0.88;
      this.projectiles = [];
      this.audio.playSfx('boss_defeat', 0);
      this.emitRing(boss.x + boss.w * 0.5, boss.y + boss.h * 0.5, 280, '#fde047', 6);
      this.emitParticles(boss.x + boss.w * 0.5, boss.y + boss.h * 0.5, 45, arch.projectileColor, 'star', 380, -100);
      this.showBanner(`${boss.name.toUpperCase()} KALAH!`, 2.2);
      this.pendingVictoryTimer = 1.45;
      this.pushHud(true);
    }
  }

  private damagePlayer(amount: number, sourceX: number): void {
    if (this.player.invulnTimer > 0 || this.player.hp <= 0) return;

    this.player.hp = Math.max(0, this.player.hp - amount);
    this.damageTaken += amount;
    this.combo = 0;
    this.player.invulnTimer = 1.1;
    this.player.hitFlashTimer = 0.16;

    const pushDir = this.player.x + this.player.w * 0.5 >= sourceX ? 1 : -1;
    this.player.vx = pushDir * 320;
    this.player.vy = -340;
    this.player.grounded = false;

    this.hitstopTimer = 0.06;
    this.trauma = Math.max(this.trauma, 0.55);
    this.audio.playSfx('player_hurt', 0.06);
    this.emitParticles(this.player.x + this.player.w * 0.5, this.player.y + this.player.h * 0.5, 16, '#ef4444', 'spark', 230, -60);
    this.spawnFloatingText(this.player.x + this.player.w * 0.5, this.player.y - 10, `-${amount} HP`, '#ef4444', 1.15);

    if (this.player.hp <= 0) {
      this.player.animState = 'defeat';
      this.audio.stopBgm();
      this.audio.playSfx('game_over', 0);
      this.pendingDefeatTimer = 0.65;
    }
    this.hudDirty = true;
  }

  private collectPickup(item: Pickup): void {
    item.collected = true;
    if (item.kind === 'coin') {
      this.coins++;
      this.score += 50;
      this.audio.playSfx('coin_collect', 0.08, 0.75);
      this.emitParticles(item.x, item.y, 7, '#facc15', 'star', 130, -40);
    } else if (item.kind === 'star') {
      this.starsCollected++;
      this.score += 350;
      this.audio.playSfx('checkpoint', 0.05, 0.85);
      this.emitRing(item.x, item.y, 75, '#fde047', 3);
      this.emitParticles(item.x, item.y, 18, '#fde047', 'star', 200, -50);
      this.spawnFloatingText(item.x, item.y - 14, 'BINTANG +350!', '#fde047', 1.2);
    } else if (item.kind === 'potion') {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 2);
      this.player.mana = this.player.maxMana;
      this.audio.playSfx('potion_collect', 0.04);
      this.emitParticles(item.x, item.y, 14, '#fb7185', 'star', 170, -60);
      this.spawnFloatingText(item.x, item.y - 14, '+2 HP!', '#fb7185', 1.15);
    } else if (item.kind === 'power_orb') {
      this.player.powerBoostTimer = 8;
      this.score += 200;
      this.audio.playSfx('potion_collect', 0.06);
      this.emitRing(item.x, item.y, 85, '#38bdf8', 3.5);
      this.spawnFloatingText(item.x, item.y - 14, 'SIHIR SUPER!', '#38bdf8', 1.2);
    } else if (item.kind === 'crystal') {
      this.crystals++;
      this.score += 250;
      this.player.mana = this.player.maxMana;
      this.audio.playSfx('coin_collect', 0.04);
      this.emitParticles(item.x, item.y, 12, '#c084fc', 'star', 160, -50);
      this.spawnFloatingText(item.x, item.y - 14, '+250 KRISTAL', '#e879f9', 1.05);
    }
    this.hudDirty = true;
  }

  private finishLevelVictory(): void {
    this.audio.stopBgm();
    this.audio.playSfx('level_complete', 0);
    const starsEarned = calculateLevelStars({
      starsCollected: this.starsCollected,
      starsTotal: this.starsTotal,
      damageTaken: this.damageTaken,
      clearTimeSec: this.elapsedSec,
    });
    const timeBonus = Math.max(0, Math.round((140 - this.elapsedSec) * 12));
    const finalScore = this.score + timeBonus;
    this.score = finalScore;

    this.saveData = applyLevelVictoryToSave(this.saveData, {
      levelId: this.level.id,
      score: finalScore,
      coinsEarned: this.coins,
      starsEarned,
      clearTimeSec: this.elapsedSec,
    });
    persistSaveData(this.saveData);

    this.endStats = {
      won: true,
      score: finalScore,
      bestScore: Math.max(this.saveData.highScore, finalScore),
      clearTimeSec: Math.round(this.elapsedSec),
      coinsEarned: this.coins,
      starsEarned,
      ghostsDefeated: this.ghostsDefeated,
      damageTaken: this.damageTaken,
      bossHpRemainingPct: 0,
      progressPct: 100,
    };

    this.clearInputs();
    const modal: ModalType = this.level.id >= LEVELS.length ? 'final_victory' : 'level_complete';
    this.setGameState('gameover', modal);
    this.pushHud(true);
  }

  private finishGameOver(): void {
    this.clearInputs();
    this.saveData = {
      ...this.saveData,
      highScore: Math.max(this.saveData.highScore, Math.round(this.score)),
      totalCoins: this.saveData.totalCoins + this.coins,
    };
    persistSaveData(this.saveData);

    const bossPct =
      this.boss && this.boss.active
        ? Math.max(0, Math.round((this.boss.hp / this.boss.maxHp) * 100))
        : 100;
    const progressPct = Math.min(99, Math.round((this.player.x / this.level.worldWidth) * 100));

    this.endStats = {
      won: false,
      score: Math.round(this.score),
      bestScore: this.saveData.highScore,
      clearTimeSec: Math.round(this.elapsedSec),
      coinsEarned: this.coins,
      starsEarned: 0,
      ghostsDefeated: this.ghostsDefeated,
      damageTaken: this.damageTaken,
      bossHpRemainingPct: bossPct,
      progressPct,
    };
    this.setGameState('gameover', 'game_over');
    this.pushHud(true);
  }

  // --- VFX & Camera Helpers ---

  private updateCameraShake(dt: number): void {
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - dt * 1.9);
    }
    if (!this.saveData.settings.screenShake || this.trauma <= 0.001) {
      this.shakeX = 0;
      this.shakeY = 0;
      return;
    }
    const power = this.trauma * this.trauma * 24;
    this.shakeX = (Math.random() * 2 - 1) * power;
    this.shakeY = (Math.random() * 2 - 1) * power;
  }

  private updateVfxPools(dt: number): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = p.life / p.maxLife;
    }
    for (const r of this.rings) {
      if (!r.active) continue;
      r.radius += (r.maxRadius - r.radius) * Math.min(1, dt * 11);
      r.alpha -= dt * 3.2;
      if (r.alpha <= 0.02) r.active = false;
    }
    for (const ft of this.floatingTexts) {
      if (!ft.active) continue;
      ft.life -= dt;
      ft.y += ft.vy * dt;
      if (ft.life <= 0) ft.active = false;
    }
  }

  private updateAmbientMotes(dt: number): void {
    for (const m of this.ambientMotes) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.y < 60) m.y = GROUND_Y - 30;
      if (m.y > GROUND_Y - 20) m.y = 70;
    }
  }

  private emitParticles(
    x: number,
    y: number,
    count: number,
    color: string,
    kind: Particle['kind'],
    speed = 180,
    gravity = 0
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % PARTICLE_POOL_SIZE;
      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.35 + Math.random() * 0.75);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd - (kind === 'smoke' ? 40 : 0);
      p.size = kind === 'smoke' ? 5 + Math.random() * 6 : 2.5 + Math.random() * 3.8;
      p.maxLife = kind === 'smoke' ? 0.55 + Math.random() * 0.25 : 0.35 + Math.random() * 0.3;
      p.life = p.maxLife;
      p.alpha = 1;
      p.color = color;
      p.glow = kind !== 'smoke';
      p.gravity = gravity < 0 ? -Math.abs(gravity) : gravity;
      p.kind = kind;
    }
  }

  private emitRing(x: number, y: number, maxRadius: number, color: string, lineWidth = 3): void {
    const r = this.rings[this.ringCursor];
    this.ringCursor = (this.ringCursor + 1) % RING_POOL_SIZE;
    r.active = true;
    r.x = x;
    r.y = y;
    r.radius = 8;
    r.maxRadius = maxRadius;
    r.alpha = 0.9;
    r.color = color;
    r.lineWidth = lineWidth;
  }

  private spawnFloatingText(x: number, y: number, text: string, color: string, scale = 1): void {
    const ft = this.floatingTexts[this.floatCursor];
    this.floatCursor = (this.floatCursor + 1) % FLOAT_TEXT_POOL_SIZE;
    ft.active = true;
    ft.x = x;
    ft.y = y;
    ft.vy = -52;
    ft.text = text;
    ft.color = color;
    ft.maxLife = 0.9;
    ft.life = 0.9;
    ft.scale = scale;
  }

  private showBanner(text: string, duration = 2.4): void {
    this.bannerText = text;
    this.bannerTimer = duration;
  }

  private render(): void {
    renderHorrorWorld(this.ctx, this.sprites, {
      viewW: this.viewW,
      viewH: this.viewH,
      cameraX: this.cameraX,
      shakeX: this.shakeX,
      shakeY: this.shakeY,
      time: this.time,
      gameState: this.gameState,
      level: this.level,
      character: this.saveData.selectedCharacter,
      player: this.player,
      platforms: this.platforms,
      torches: this.torches,
      checkpoints: this.checkpoints,
      pickups: this.pickups,
      enemies: this.enemies,
      boss: this.boss,
      projectiles: this.projectiles,
      particles: this.particles,
      rings: this.rings,
      floatingTexts: this.floatingTexts,
      ambientMotes: this.ambientMotes,
    });
  }

  private pushHud(force: boolean): void {
    if (!force && this.time - this.lastHudPush < 0.08) return;

    const hp = Math.round(this.player.hp);
    const maxHp = Math.round(this.player.maxHp);
    const mana = Math.round(this.player.mana);
    const maxMana = Math.round(this.player.maxMana);
    const score = Math.round(this.score);
    const bestScore = Math.max(this.saveData.highScore, score);
    const coins = Math.round(this.coins);
    const starsCollected = Math.round(this.starsCollected);
    const starsTotal = Math.round(this.starsTotal);
    const crystals = Math.round(this.crystals);
    const combo = Math.round(this.combo);
    const progressPct = Math.max(
      0,
      Math.min(100, Math.round((this.player.x / this.level.worldWidth) * 100))
    );
    const boostOn = this.player.powerBoostTimer > 0 ? 1 : 0;
    const dashReadyPct = Math.max(
      0,
      Math.min(100, Math.round((1 - this.player.dashCooldown / 0.55) * 100))
    );
    const bossActive = Boolean(this.boss && this.boss.active && !this.boss.defeated);
    const bossHp = bossActive && this.boss ? Math.round(this.boss.hp) : -1;
    const bossGhostHp = bossActive && this.boss ? Math.round(this.boss.ghostHp) : -1;
    const bossPhase = bossActive && this.boss ? this.boss.phase : 0;
    const banner = this.bannerText;

    const fingerprint = `${this.gameState}|${this.modal}|${this.saveData.selectedCharacter}|${this.level.id}|${hp}/${maxHp}|${mana}|${score}|${coins}|${starsCollected}|${combo}|${progressPct}|${boostOn}|${bossActive ? 1 : 0}|${bossHp}|${bossGhostHp}|${bossPhase}|${this.saveData.settings.muted ? 1 : 0}|${banner ?? ''}`;
    if (!force && fingerprint === this.lastHudFingerprint) {
      return;
    }

    this.lastHudFingerprint = fingerprint;
    this.lastHudPush = this.time;

    this.onHudChange(
      {
        gameState: this.gameState,
        modal: this.modal,
        character: this.saveData.selectedCharacter,
        levelId: this.level.id,
        levelName: this.level.name,
        levelSubtitle: this.level.subtitle,
        hp,
        maxHp,
        mana,
        maxMana,
        score,
        bestScore,
        coins,
        starsCollected,
        starsTotal,
        crystals,
        combo,
        comboTimer: this.comboTimer,
        progressPct,
        elapsedSec: Math.round(this.elapsedSec),
        damageTaken: Math.round(this.damageTaken),
        ghostsDefeated: Math.round(this.ghostsDefeated),
        powerBoostTimer: this.player.powerBoostTimer,
        dashReadyPct,
        boss:
          bossActive && this.boss
            ? {
                active: true,
                kind: this.boss.kind,
                name: this.boss.name,
                title: this.boss.title,
                hp: bossHp,
                maxHp: Math.round(this.boss.maxHp),
                ghostHp: bossGhostHp,
                phase: this.boss.phase,
              }
            : null,
        muted: this.saveData.settings.muted,
        bannerText: banner,
        endStats: this.endStats,
      },
      this.saveData
    );
  }
}
