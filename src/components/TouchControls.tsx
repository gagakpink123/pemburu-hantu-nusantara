interface TouchControlsProps {
  visible: boolean;
  onControl: (control: 'left' | 'right' | 'jump' | 'shoot' | 'dash', pressed: boolean) => void;
}

export function TouchControls({ visible, onControl }: TouchControlsProps) {
  if (!visible) return null;

  const bindTouch = (control: 'left' | 'right' | 'jump' | 'shoot' | 'dash') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      onControl(control, true);
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      onControl(control, false);
    },
    onPointerCancel: () => onControl(control, false),
    onPointerLeave: () => onControl(control, false),
  });

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 flex items-end justify-between p-4 pointer-events-none">
      {/* Left D-pad */}
      <div className="flex items-center gap-3 pointer-events-auto">
        <button
          type="button"
          aria-label="Kiri"
          {...bindTouch('left')}
          className="w-14 h-14 rounded-xl bg-black/55 border border-amber-500/50 text-amber-200 font-bold text-xl active:scale-95"
        >
          ◀
        </button>
        <button
          type="button"
          aria-label="Kanan"
          {...bindTouch('right')}
          className="w-14 h-14 rounded-xl bg-black/55 border border-amber-500/50 text-amber-200 font-bold text-xl active:scale-95"
        >
          ▶
        </button>
      </div>

      {/* Right Action Buttons */}
      <div className="flex items-center gap-2.5 pointer-events-auto">
        <button
          type="button"
          aria-label="Dash"
          {...bindTouch('dash')}
          className="w-12 h-12 rounded-xl bg-sky-950/70 border border-sky-400/60 text-sky-200 font-bold text-xs uppercase active:scale-95"
        >
          Dash
        </button>
        <button
          type="button"
          aria-label="Lompat"
          {...bindTouch('jump')}
          className="w-14 h-14 rounded-xl bg-emerald-950/70 border border-emerald-400/60 text-emerald-200 font-bold text-xs uppercase active:scale-95"
        >
          Lompat
        </button>
        <button
          type="button"
          aria-label="Tembak Sihir"
          {...bindTouch('shoot')}
          className="w-16 h-16 rounded-xl bg-rose-950/75 border border-rose-400/75 text-rose-100 font-bold text-xs uppercase active:scale-95"
        >
          Sihir
        </button>
      </div>
    </div>
  );
}
