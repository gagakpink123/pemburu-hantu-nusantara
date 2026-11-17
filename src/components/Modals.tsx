import { BOSS_ARCHETYPES, GHOST_ARCHETYPES, LEVELS } from '../game/constants';
import type { HudSnapshot, ModalType, SaveData, SettingsData } from '../game/types';

interface ModalsProps {
  modal: ModalType;
  hud: HudSnapshot;
  saveData: SaveData;
  onClose: () => void;
  onStartLevel: (levelId: number) => void;
  onResume: () => void;
  onRestart: () => void;
  onNextLevel: () => void;
  onReturnTitle: () => void;
  onUpdateSettings: (patch: Partial<SettingsData>) => void;
}

export function Modals({
  modal,
  hud,
  saveData,
  onClose,
  onStartLevel,
  onResume,
  onRestart,
  onNextLevel,
  onReturnTitle,
  onUpdateSettings,
}: ModalsProps) {
  if (modal === 'none') return null;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#030408]/80">
      {modal === 'level_select' && (
        <div className="horror-panel w-full max-w-3xl rounded-xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-amber-500/25 pb-3 mb-4">
            <h2 className="font-display font-bold text-xl tracking-wider uppercase text-amber-200">
              Pilih Dunia Nusantara
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="btn-arcade btn-horror-stone px-3 py-1.5 rounded text-xs font-bold uppercase cursor-pointer"
            >
              Tutup
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {LEVELS.map((lvl) => {
              const unlocked = lvl.id <= saveData.unlockedLevel;
              const rec = saveData.records[lvl.id];
              const boss = BOSS_ARCHETYPES[lvl.bossType];
              return (
                <button
                  key={lvl.id}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => onStartLevel(lvl.id)}
                  className={`btn-arcade rounded-lg overflow-hidden border text-left transition-all ${
                    unlocked
                      ? 'border-amber-500/45 bg-[#12101c] hover:border-amber-300 cursor-pointer'
                      : 'border-stone-800 bg-[#0b0a11] opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="relative h-28 w-full overflow-hidden">
                    <img
                      src={lvl.bgUrl}
                      alt={lvl.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#090810] via-transparent to-black/35" />
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/75 border border-amber-500/40 font-mono-num text-[11px] font-bold text-amber-200">
                      LEVEL {lvl.id}
                    </span>
                    {!unlocked && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/60 font-display text-xs uppercase tracking-widest text-stone-300">
                        Terkunci
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="font-display font-bold text-sm text-stone-100">{lvl.name}</div>
                    <div className="text-[11px] text-stone-400 mt-0.5">Bos: {boss.name}</div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-stone-800 text-[11px] font-mono-num">
                      <span className="text-amber-300">
                        {'★'.repeat(rec?.stars ?? 0)}
                        {'☆'.repeat(3 - (rec?.stars ?? 0))}
                      </span>
                      <span className="text-stone-300">
                        {rec?.bestScore ? `REKOR ${rec.bestScore}` : 'SIAP'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {modal === 'settings' && (
        <div className="horror-panel w-full max-w-md rounded-xl p-6">
          <div className="flex items-center justify-between border-b border-amber-500/25 pb-3 mb-4">
            <h2 className="font-display font-bold text-xl tracking-wider uppercase text-amber-200">
              Pengaturan
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="btn-arcade btn-horror-stone px-3 py-1.5 rounded text-xs font-bold uppercase cursor-pointer"
            >
              Tutup
            </button>
          </div>

          <div className="space-y-4 text-sm">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-stone-200 font-semibold">Volume Musik Latar</span>
                <span className="font-mono-num text-amber-300">
                  {Math.round(saveData.settings.bgmVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(saveData.settings.bgmVolume * 100)}
                onChange={(e) => onUpdateSettings({ bgmVolume: Number(e.target.value) / 100 })}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-stone-200 font-semibold">Volume Efek Suara</span>
                <span className="font-mono-num text-amber-300">
                  {Math.round(saveData.settings.sfxVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(saveData.settings.sfxVolume * 100)}
                onChange={(e) => onUpdateSettings({ sfxVolume: Number(e.target.value) / 100 })}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between py-2 border-t border-stone-800">
              <span className="text-stone-200 font-semibold">Bisukan Semua Audio</span>
              <button
                type="button"
                onClick={() => onUpdateSettings({ muted: !saveData.settings.muted })}
                className={`px-3 py-1 rounded text-xs font-bold uppercase cursor-pointer ${
                  saveData.settings.muted ? 'bg-red-700 text-white' : 'bg-emerald-700 text-white'
                }`}
              >
                {saveData.settings.muted ? 'Mati' : 'Aktif'}
              </button>
            </div>

            <div className="flex items-center justify-between py-2 border-t border-stone-800">
              <span className="text-stone-200 font-semibold">Getar Kamera (Screen Shake)</span>
              <button
                type="button"
                onClick={() => onUpdateSettings({ screenShake: !saveData.settings.screenShake })}
                className={`px-3 py-1 rounded text-xs font-bold uppercase cursor-pointer ${
                  saveData.settings.screenShake ? 'bg-emerald-700 text-white' : 'bg-stone-700 text-stone-200'
                }`}
              >
                {saveData.settings.screenShake ? 'Aktif' : 'Mati'}
              </button>
            </div>

            <div className="flex items-center justify-between py-2 border-t border-stone-800">
              <span className="text-stone-200 font-semibold">Kontrol Layar Sentuh</span>
              <select
                value={saveData.settings.showTouchControls}
                onChange={(e) =>
                  onUpdateSettings({
                    showTouchControls: e.target.value as SettingsData['showTouchControls'],
                  })
                }
                className="bg-[#141320] border border-amber-500/40 rounded px-2.5 py-1 text-xs text-stone-100"
              >
                <option value="auto">Otomatis</option>
                <option value="always">Selalu Tampil</option>
                <option value="off">Nonaktif</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {modal === 'how_to_play' && (
        <div className="horror-panel w-full max-w-2xl rounded-xl p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-amber-500/25 pb-3 mb-4">
            <h2 className="font-display font-bold text-xl tracking-wider uppercase text-amber-200">
              Panduan &amp; Daftar Hantu Nusantara
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="btn-arcade btn-horror-stone px-3 py-1.5 rounded text-xs font-bold uppercase cursor-pointer"
            >
              Tutup
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5 text-xs">
            <div className="bg-[#12111c] border border-stone-800 rounded p-2.5">
              <div className="font-bold text-amber-300">Gerak 4-Arah</div>
              <div className="text-stone-300 mt-0.5">W/A/S/D atau Panah</div>
            </div>
            <div className="bg-[#12111c] border border-stone-800 rounded p-2.5">
              <div className="font-bold text-amber-300">Lompat 2x</div>
              <div className="text-stone-300 mt-0.5">Space / W / Atas</div>
            </div>
            <div className="bg-[#12111c] border border-stone-800 rounded p-2.5">
              <div className="font-bold text-amber-300">Sihir</div>
              <div className="text-stone-300 mt-0.5">J / Z / Enter</div>
            </div>
            <div className="bg-[#12111c] border border-stone-800 rounded p-2.5">
              <div className="font-bold text-amber-300">Dash Hindar</div>
              <div className="text-stone-300 mt-0.5">Shift / K</div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {Object.values(GHOST_ARCHETYPES).map((g) => (
              <div
                key={g.kind}
                className="bg-[#0d0c15] border border-stone-800 rounded-md p-2 flex flex-col items-center text-center"
              >
                <img
                  src={g.spriteUrl}
                  alt={g.name}
                  className="h-16 w-auto object-contain mb-1.5"
                />
                <div className="font-display font-bold text-xs text-stone-100">{g.name}</div>
                <div className="text-[10px] text-stone-400">HP {g.hp} · {g.score} Poin</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {modal === 'credits' && (
        <div className="horror-panel w-full max-w-md rounded-xl p-6 text-center">
          <h2 className="font-display font-bold text-xl tracking-wider uppercase text-amber-200 mb-2">
            Kredit Pembuat
          </h2>
          <p className="text-sm text-stone-300 mb-4">
            Nadhira &amp; Narendra: Pemburu Hantu Nusantara — Game petualangan aksi horor fantasi Nusantara.
          </p>
          <div className="bg-[#100f1a] border border-amber-500/35 rounded-lg p-4 mb-5">
            <div className="text-xs uppercase tracking-widest text-stone-400">Creator &amp; Concept</div>
            <a
              href="https://www.instagram.com/adnanjogja/"
              target="_blank"
              rel="noreferrer"
              className="font-display font-bold text-lg text-amber-300 hover:text-amber-200 mt-1 inline-block"
            >
              @adnanjogja
            </a>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-arcade btn-horror-crimson px-6 py-2.5 rounded-md font-display font-bold text-sm uppercase tracking-wider cursor-pointer"
          >
            Kembali
          </button>
        </div>
      )}

      {modal === 'pause' && (
        <div className="horror-panel w-full max-w-sm rounded-xl p-6 text-center">
          <h2 className="font-display font-extrabold text-2xl tracking-widest uppercase text-amber-200 mb-1">
            Permainan Dijeda
          </h2>
          <p className="text-xs text-stone-400 mb-5">
            Level {hud.levelId} · {hud.levelName}
          </p>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onResume}
              className="btn-arcade btn-horror-crimson w-full py-3 rounded-md font-display font-bold uppercase tracking-wider cursor-pointer"
            >
              Lanjutkan
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="btn-arcade btn-horror-stone w-full py-2.5 rounded-md font-semibold text-sm uppercase tracking-wider cursor-pointer"
            >
              Ulang Level
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className="btn-arcade btn-horror-stone w-full py-2.5 rounded-md font-semibold text-sm uppercase tracking-wider text-stone-300 cursor-pointer"
            >
              Ke Menu Utama
            </button>
          </div>
        </div>
      )}

      {(modal === 'level_complete' || modal === 'final_victory') && hud.endStats && (
        <div className="horror-panel w-full max-w-md rounded-xl p-6 text-center border-amber-400/65">
          <div className="font-display font-extrabold text-2xl sm:text-3xl tracking-wider uppercase text-amber-200 mb-1">
            {modal === 'final_victory' ? 'Nusantara Terselamatkan!' : 'Level Selesai!'}
          </div>
          <div className="text-3xl text-amber-300 tracking-widest my-2">
            {'★'.repeat(hud.endStats.starsEarned)}
            <span className="text-stone-700">{'★'.repeat(3 - hud.endStats.starsEarned)}</span>
          </div>

          <div className="grid grid-cols-3 gap-2 my-4">
            <div className="bg-[#100f1a] border border-amber-500/30 rounded p-2.5">
              <div className="text-[10px] uppercase text-stone-400">Skor Akhir</div>
              <div className="font-mono-num font-bold text-base text-amber-300">
                {hud.endStats.score}
              </div>
            </div>
            <div className="bg-[#100f1a] border border-amber-500/30 rounded p-2.5">
              <div className="text-[10px] uppercase text-stone-400">Waktu</div>
              <div className="font-mono-num font-bold text-base text-stone-100">
                {hud.endStats.clearTimeSec}d
              </div>
            </div>
            <div className="bg-[#100f1a] border border-amber-500/30 rounded p-2.5">
              <div className="text-[10px] uppercase text-stone-400">Luka</div>
              <div className="font-mono-num font-bold text-base text-rose-300">
                {hud.endStats.damageTaken}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 mt-4">
            {modal === 'level_complete' ? (
              <button
                type="button"
                data-start="true"
                onClick={onNextLevel}
                className="btn-arcade btn-horror-crimson w-full py-3 rounded-md font-display font-bold uppercase tracking-wider cursor-pointer"
              >
                Lanjut Level {hud.levelId + 1}
              </button>
            ) : (
              <button
                type="button"
                data-start="true"
                onClick={onRestart}
                className="btn-arcade btn-horror-crimson w-full py-3 rounded-md font-display font-bold uppercase tracking-wider cursor-pointer"
              >
                Main Ulang
              </button>
            )}
            <button
              type="button"
              onClick={onReturnTitle}
              className="btn-arcade btn-horror-stone w-full py-2.5 rounded-md font-semibold text-sm uppercase tracking-wider cursor-pointer"
            >
              Menu Utama
            </button>
          </div>
        </div>
      )}

      {modal === 'game_over' && hud.endStats && (
        <div className="horror-panel w-full max-w-md rounded-xl p-6 text-center border-red-500/60">
          <div className="font-display font-extrabold text-3xl tracking-widest uppercase text-red-400 mb-1">
            Terkalahkan
          </div>
          <p className="text-xs text-stone-400 mb-4">
            Roh kegelapan terlalu kuat di {hud.levelName}. Bangkit lagi!
          </p>

          <div className="grid grid-cols-3 gap-2 mb-5">
            <div className="bg-[#140d13] border border-red-900/50 rounded p-2.5">
              <div className="text-[10px] uppercase text-stone-400">Progres</div>
              <div className="font-mono-num font-bold text-base text-amber-200">
                {hud.endStats.progressPct}%
              </div>
            </div>
            <div className="bg-[#140d13] border border-red-900/50 rounded p-2.5">
              <div className="text-[10px] uppercase text-stone-400">Hantu Kalah</div>
              <div className="font-mono-num font-bold text-base text-stone-100">
                {hud.endStats.ghostsDefeated}
              </div>
            </div>
            <div className="bg-[#140d13] border border-red-900/50 rounded p-2.5">
              <div className="text-[10px] uppercase text-stone-400">Skor / Rekor</div>
              <div className="font-mono-num font-bold text-sm text-amber-300">
                {hud.endStats.score}/{hud.endStats.bestScore}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              data-start="true"
              onClick={onRestart}
              className="btn-arcade btn-horror-crimson w-full py-3 rounded-md font-display font-bold uppercase tracking-wider cursor-pointer"
            >
              Coba Lagi
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className="btn-arcade btn-horror-stone w-full py-2.5 rounded-md font-semibold text-sm uppercase tracking-wider cursor-pointer"
            >
              Menu Utama
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
