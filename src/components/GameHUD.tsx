import { HERO_CONFIG, ITEM_ASSETS } from '../game/constants';
import { getBossPortraitUrl } from '../game/renderer';
import type { HudSnapshot } from '../game/types';

interface GameHUDProps {
  hud: HudSnapshot;
  onTogglePause: () => void;
  onToggleMute: () => void;
  onRestart: () => void;
}

export function GameHUD({ hud, onTogglePause, onToggleMute, onRestart }: GameHUDProps) {
  const hero = HERO_CONFIG[hud.character];
  const manaPct = Math.max(0, Math.min(100, Math.round((hud.mana / hud.maxMana) * 100)));

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-4">
      {/* Top Perimeter Clusters */}
      <div className="flex items-start justify-between gap-3">
        {/* Top-Left Cluster: Portrait + Vitality Heart Sockets + Mana + Score/Coins/Stars */}
        <div className="horror-hud-chip rounded-lg px-3 py-2 flex items-center gap-3">
          <div
            className="relative w-12 h-12 rounded-md overflow-hidden border-2 shrink-0 bg-[#0a0912]"
            style={{ borderColor: hero.primaryColor }}
          >
            <img
              src={hero.portraitUrl}
              alt={hero.name}
              className="w-full h-full object-cover"
            />
            {hud.powerBoostTimer > 0 && (
              <div className="absolute inset-0 border-2 border-amber-300 animate-pulse pointer-events-none" />
            )}
          </div>

          <div className="flex flex-col gap-1.5 min-w-[168px]">
            {/* Hero Name + Vitality Heart Sockets */}
            <div className="flex items-center justify-between gap-2">
              <span className="font-display font-bold text-xs tracking-wider uppercase text-stone-100">
                {hero.name}
              </span>
              <div className="flex items-center gap-0.5" aria-label={`HP ${hud.hp} dari ${hud.maxHp}`}>
                {Array.from({ length: hud.maxHp }).map((_, i) => {
                  const full = i < hud.hp;
                  return (
                    <svg key={i} viewBox="0 0 24 24" className="w-4 h-4">
                      <path
                        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                        fill={full ? '#e11d48' : '#181420'}
                        stroke={full ? '#fecdd3' : '#574c5e'}
                        strokeWidth="1.6"
                      />
                    </svg>
                  );
                })}
              </div>
            </div>

            {/* Mana / Dash Energy Bar */}
            <div className="h-2 w-full bg-[#09080f] rounded-sm overflow-hidden border border-stone-700/70">
              <div
                className="h-full transition-[width] duration-75"
                style={{
                  width: `${manaPct}%`,
                  backgroundColor: hero.primaryColor,
                }}
              />
            </div>

            {/* Tabular Counters */}
            <div className="flex items-center gap-3 text-xs font-mono-num text-stone-100">
              <span className="text-amber-300 font-bold">SKOR {hud.score}</span>
              <span className="flex items-center gap-1">
                <img src={ITEM_ASSETS.coin} alt="" className="w-3.5 h-3.5" />
                {hud.coins}
              </span>
              <span className="flex items-center gap-1">
                <img src={ITEM_ASSETS.star} alt="" className="w-3.5 h-3.5" />
                {hud.starsCollected}/{hud.starsTotal}
              </span>
              {hud.combo >= 2 && (
                <span className="text-sky-300 font-bold">x{hud.combo}</span>
              )}
            </div>
          </div>
        </div>

        {/* Top-Center: Active Boss Health Bar (visible only during Boss fight) */}
        {hud.boss && hud.boss.active && (
          <div className="horror-hud-chip rounded-lg px-3.5 py-2 flex items-center gap-3 min-w-[280px] max-w-[440px] flex-1">
            <img
              src={getBossPortraitUrl(hud.boss.kind)}
              alt={hud.boss.name}
              className="w-11 h-11 rounded object-cover border border-red-400/70 bg-black shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="font-display font-bold text-xs tracking-wider uppercase text-red-200 truncate">
                  {hud.boss.name}
                </span>
                <span className="font-mono-num text-[11px] text-amber-300">
                  FASE {hud.boss.phase}/3 · {hud.boss.hp}/{hud.boss.maxHp}
                </span>
              </div>
              <div className="relative h-3 w-full bg-[#0a060c] rounded-sm overflow-hidden border border-red-900/80">
                <div
                  className="absolute inset-y-0 left-0 bg-amber-300/60"
                  style={{
                    width: `${Math.max(0, Math.min(100, (hud.boss.ghostHp / hud.boss.maxHp) * 100))}%`,
                  }}
                />
                <div
                  className="absolute inset-y-0 left-0 bg-red-600 transition-[width] duration-75"
                  style={{
                    width: `${Math.max(0, Math.min(100, (hud.boss.hp / hud.boss.maxHp) * 100))}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Top-Right Cluster: Level Progress + Compact Icon Utility Buttons */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="horror-hud-chip rounded-lg px-3 py-2 hidden sm:flex flex-col items-end">
            <span className="font-display font-bold text-xs tracking-wider uppercase text-amber-200">
              Lv.{hud.levelId} · {hud.levelName}
            </span>
            <span className="font-mono-num text-[11px] text-stone-300">
              PROGRES {hud.progressPct}%
            </span>
          </div>

          <button
            type="button"
            tabIndex={-1}
            aria-label={hud.muted ? 'Aktifkan Audio' : 'Bisukan Audio'}
            title="Bisukan Audio [M]"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="btn-arcade btn-horror-stone w-10 h-10 rounded-md flex items-center justify-center text-stone-100 cursor-pointer"
          >
            {hud.muted ? (
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-red-400" strokeWidth="2">
                <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-amber-200" strokeWidth="2">
                <path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            )}
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="Ulang Level"
            title="Ulang Level [R]"
            onClick={(e) => {
              e.currentTarget.blur();
              onRestart();
            }}
            className="btn-arcade btn-horror-stone w-10 h-10 rounded-md flex items-center justify-center text-stone-100 cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-stone-200" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="Jeda Permainan"
            title="Jeda [Esc / P]"
            onClick={(e) => {
              e.currentTarget.blur();
              onTogglePause();
            }}
            className="btn-arcade btn-horror-stone w-10 h-10 rounded-md flex items-center justify-center text-stone-100 cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-amber-200">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          </button>
        </div>
      </div>

      {/* Transient Stage / Boss Alert Banner (upper band so center playfield stays clear) */}
      {hud.bannerText && (
        <div className="mx-auto mt-3 pointer-events-none">
          <div className="horror-panel px-6 py-2 rounded-md border-amber-400/70 text-center">
            <div className="font-display font-extrabold text-base sm:text-xl tracking-widest uppercase text-amber-200 text-stroke-dark">
              {hud.bannerText}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1" />
    </div>
  );
}
