import { HERO_CONFIG, LEVELS } from '../game/constants';
import type { CharacterId, ModalType, SaveData } from '../game/types';

interface TitleScreenProps {
  saveData: SaveData;
  currentLevelId: number;
  onStart: (levelId: number) => void;
  onSelectCharacter: (char: CharacterId) => void;
  onOpenModal: (modal: ModalType) => void;
}

export function TitleScreen({
  saveData,
  currentLevelId,
  onStart,
  onSelectCharacter,
  onOpenModal,
}: TitleScreenProps) {
  const activeChar = saveData.selectedCharacter;
  const activeLevel = LEVELS.find((l) => l.id === currentLevelId) ?? LEVELS[0];

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-5 sm:p-8 lg:p-10 pointer-events-none bg-gradient-to-r from-[#04050a]/85 via-[#04050a]/35 to-[#04050a]/75">
      {/* Top Row: Compact High Score / Level Status */}
      <div className="flex items-center justify-between gap-4">
        <div className="horror-hud-chip px-3.5 py-1.5 rounded-md flex items-center gap-4 text-xs tracking-wider uppercase text-amber-200/90">
          <span className="font-mono-num">KOIN: {saveData.totalCoins}</span>
          <span className="text-amber-500/40">|</span>
          <span className="font-mono-num">REKOR: {saveData.highScore}</span>
        </div>

        <div className="horror-hud-chip px-3.5 py-1.5 rounded-md text-xs font-semibold tracking-wider uppercase text-stone-200">
          Level {activeLevel.id} · {activeLevel.name}
        </div>
      </div>

      {/* Main Split Stage: Left Title + Menu | Right 3D Hero Showcase */}
      <div className="flex flex-col lg:flex-row items-center lg:items-end justify-between gap-6 my-auto">
        {/* Left: Carved Nusantara Title Lockup & Menu */}
        <div className="w-full max-w-[470px] flex flex-col items-start gap-5 pointer-events-auto">
          {/* Bespoke Inline SVG Title Emblem */}
          <svg
            viewBox="0 0 700 172"
            className="w-full drop-shadow-[0_10px_28px_rgba(0,0,0,0.95)]"
            aria-label="Nadhira & Narendra: Pemburu Hantu Nusantara"
          >
            <defs>
              <linearGradient id="goldEmblem" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fef3c7" />
                <stop offset="48%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#92400e" />
              </linearGradient>
              <linearGradient id="crimsonEmblem" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fda4af" />
                <stop offset="45%" stopColor="#e11d48" />
                <stop offset="100%" stopColor="#881337" />
              </linearGradient>
              <linearGradient id="skyEmblem" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#e0f2fe" />
                <stop offset="50%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0369a1" />
              </linearGradient>
            </defs>

            {/* Carved Nusantara Crest Top Accent */}
            <path
              d="M350 6 L366 22 L350 30 L334 22 Z"
              fill="url(#goldEmblem)"
              stroke="#1c1917"
              strokeWidth="2"
            />
            <path
              d="M70 22 L322 22 M378 22 L630 22"
              stroke="url(#goldEmblem)"
              strokeWidth="1.5"
              strokeOpacity="0.65"
            />

            {/* Main Hero Names */}
            <text
              x="350"
              y="76"
              textAnchor="middle"
              stroke="#09070d"
              strokeWidth="6"
              paintOrder="stroke fill"
              fontFamily="Cinzel, Georgia, serif"
              fontWeight="900"
              fontSize="44"
              letterSpacing="1"
            >
              <tspan fill="url(#crimsonEmblem)">NADHIRA</tspan>
              <tspan fill="url(#goldEmblem)" fontSize="34" fontWeight="800"> &amp; </tspan>
              <tspan fill="url(#skyEmblem)">NARENDRA</tspan>
            </text>

            {/* Carved Subtitle Plaque */}
            <rect
              x="30"
              y="96"
              width="640"
              height="54"
              rx="6"
              fill="#0c0a14"
              fillOpacity="0.92"
              stroke="url(#goldEmblem)"
              strokeWidth="1.8"
            />
            <text
              x="350"
              y="132"
              textAnchor="middle"
              fill="url(#goldEmblem)"
              fontFamily="Cinzel, Georgia, serif"
              fontWeight="800"
              fontSize="26"
              letterSpacing="4"
            >
              PEMBURU HANTU NUSANTARA
            </text>
          </svg>

          {/* Primary Play & Secondary Menu Stack */}
          <div className="w-full max-w-[300px] flex flex-col gap-2.5">
            <button
              type="button"
              data-start="true"
              onClick={() => onStart(currentLevelId)}
              className="btn-arcade btn-horror-crimson w-full py-3.5 px-6 rounded-md flex items-center justify-center gap-3 text-amber-50 font-display font-extrabold text-xl tracking-widest uppercase cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-amber-200" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
              MAIN SEKARANG
            </button>

            <button
              type="button"
              onClick={() => onOpenModal('level_select')}
              className="btn-arcade btn-horror-stone w-full py-2.5 px-5 rounded-md flex items-center justify-between text-stone-100 font-semibold text-sm tracking-wider uppercase cursor-pointer"
            >
              <span>Pilih Dunia ({activeLevel.id}/5)</span>
              <span className="text-amber-300/90 text-xs">{activeLevel.name}</span>
            </button>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onOpenModal('settings')}
                className="btn-arcade btn-horror-stone py-2 px-2 rounded-md text-xs font-semibold tracking-wider uppercase text-stone-200 cursor-pointer"
              >
                Setelan
              </button>
              <button
                type="button"
                onClick={() => onOpenModal('how_to_play')}
                className="btn-arcade btn-horror-stone py-2 px-2 rounded-md text-xs font-semibold tracking-wider uppercase text-stone-200 cursor-pointer"
              >
                Panduan
              </button>
              <button
                type="button"
                onClick={() => onOpenModal('credits')}
                className="btn-arcade btn-horror-stone py-2 px-2 rounded-md text-xs font-semibold tracking-wider uppercase text-stone-200 cursor-pointer"
              >
                Kredit
              </button>
            </div>
          </div>
        </div>

        {/* Right: 3D Character Selector Showcase */}
        <div className="horror-panel p-4 rounded-lg w-full max-w-[440px] pointer-events-auto">
          <div className="flex items-center justify-between mb-3 border-b border-amber-500/25 pb-2">
            <h2 className="font-display text-sm font-bold tracking-widest uppercase text-amber-200">
              Pilih Karakter Pemburu
            </h2>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              {HERO_CONFIG[activeChar].spellName}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {(['nadhira', 'narendra'] as CharacterId[]).map((cid) => {
              const cfg = HERO_CONFIG[cid];
              const selected = activeChar === cid;
              return (
                <button
                  key={cid}
                  type="button"
                  data-select-character={cid}
                  onClick={() => onSelectCharacter(cid)}
                  className={`btn-arcade rounded-md p-2.5 text-left transition-all cursor-pointer border ${
                    selected
                      ? cid === 'nadhira'
                        ? 'bg-[#2a1023]/95 border-pink-400 shadow-[0_0_24px_rgba(244,114,182,0.38)]'
                        : 'bg-[#0c1d30]/95 border-sky-400 shadow-[0_0_24px_rgba(56,189,248,0.38)]'
                      : 'bg-[#0c0b13]/85 border-stone-700/60 hover:border-amber-400/50'
                  }`}
                >
                  <div className="relative h-36 sm:h-40 w-full flex items-end justify-center overflow-hidden rounded bg-gradient-to-t from-black/75 via-black/25 to-transparent mb-2">
                    <img
                      src={cfg.spriteUrl}
                      alt={cfg.name}
                      className="h-[92%] w-auto object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.9)]"
                    />
                    {selected && (
                      <span
                        className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                        style={{
                          backgroundColor: cfg.primaryColor,
                          color: '#06070d',
                        }}
                      >
                        Aktif
                      </span>
                    )}
                  </div>
                  <div className="font-display font-bold text-sm text-stone-100">{cfg.name}</div>
                  <div className="text-[11px] font-medium text-stone-300 leading-tight mt-0.5">
                    {cfg.spellName}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Safe Margin: Flat Control Hint + Creator Attribution */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-stone-300/85 text-stroke-sm">
        <div className="tracking-wide">
          A/D/W/S Arah 4-Sisi · Space/W Lompat 2x · J/Z Tembak Sihir · Shift Dash · Esc Pause
        </div>
        <a
          href="https://www.instagram.com/adnanjogja/"
          target="_blank"
          rel="noreferrer"
          className="pointer-events-auto text-amber-300/90 hover:text-amber-200 font-semibold tracking-wide"
        >
          @adnanjogja
        </a>
      </div>
    </div>
  );
}
