import { useEffect, useRef, useState } from 'react';
import { GameHUD } from './components/GameHUD';
import { Modals } from './components/Modals';
import { TitleScreen } from './components/TitleScreen';
import { TouchControls } from './components/TouchControls';
import { HERO_CONFIG, LEVELS } from './game/constants';
import { GameEngine } from './game/engine';
import { loadSaveData } from './game/rules';
import type { CharacterId, HudSnapshot, SaveData, SettingsData } from './game/types';

function createInitialHud(save: SaveData): HudSnapshot {
  const lvl = LEVELS[0];
  const maxHp = HERO_CONFIG[save.selectedCharacter].maxHp;
  return {
    gameState: 'title',
    modal: 'none',
    character: save.selectedCharacter,
    levelId: lvl.id,
    levelName: lvl.name,
    levelSubtitle: lvl.subtitle,
    hp: maxHp,
    maxHp,
    mana: 100,
    maxMana: 100,
    score: 0,
    bestScore: save.highScore,
    coins: 0,
    starsCollected: 0,
    starsTotal: 3,
    crystals: 0,
    combo: 0,
    comboTimer: 0,
    progressPct: 0,
    elapsedSec: 0,
    damageTaken: 0,
    ghostsDefeated: 0,
    powerBoostTimer: 0,
    dashReadyPct: 100,
    boss: null,
    muted: save.settings.muted,
    bannerText: null,
    endStats: null,
  };
}

export default function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [saveData, setSaveData] = useState<SaveData>(() => loadSaveData());
  const [hud, setHud] = useState<HudSnapshot>(() => createInitialHud(loadSaveData()));
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    setIsTouchDevice(
      typeof window !== 'undefined' &&
        ('ontouchstart' in window || navigator.maxTouchPoints > 0)
    );
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const engine = new GameEngine(canvas, container, (snapshot, nextSave) => {
      setHud(snapshot);
      setSaveData((prev) => (prev === nextSave ? prev : nextSave));
    });
    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const showTouch =
    hud.gameState === 'playing' &&
    (saveData.settings.showTouchControls === 'always' ||
      (saveData.settings.showTouchControls === 'auto' && isTouchDevice));

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen overflow-hidden bg-[#04050a]"
    >
      <canvas
        ref={canvasRef}
        tabIndex={0}
        className="block w-full h-full outline-none"
      />

      {hud.gameState === 'title' && (
        <TitleScreen
          saveData={saveData}
          currentLevelId={hud.levelId}
          onStart={(id) => engineRef.current?.startGame(id)}
          onSelectCharacter={(c: CharacterId) => engineRef.current?.selectCharacter(c)}
          onOpenModal={(m) => engineRef.current?.openModal(m)}
        />
      )}

      {hud.gameState === 'playing' && (
        <GameHUD
          hud={hud}
          onTogglePause={() => engineRef.current?.togglePause()}
          onToggleMute={() => engineRef.current?.toggleMute()}
          onRestart={() => engineRef.current?.restartLevel()}
        />
      )}

      <TouchControls
        visible={showTouch}
        onControl={(ctrl, pressed) => engineRef.current?.setTouchControl(ctrl, pressed)}
      />

      <Modals
        modal={hud.modal}
        hud={hud}
        saveData={saveData}
        onClose={() => engineRef.current?.openModal('none')}
        onStartLevel={(id) => engineRef.current?.startGame(id)}
        onResume={() => engineRef.current?.resumeGame()}
        onRestart={() => engineRef.current?.restartLevel()}
        onNextLevel={() => engineRef.current?.nextLevel()}
        onReturnTitle={() => engineRef.current?.returnToTitle()}
        onUpdateSettings={(patch: Partial<SettingsData>) =>
          engineRef.current?.updateSettings(patch)
        }
      />
    </div>
  );
}
