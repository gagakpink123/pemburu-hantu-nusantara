import {
  GHOST_ARCHETYPES,
  GROUND_Y,
  HERO_CONFIG,
  LEVELS,
} from './constants';
import type {
  BossEntity,
  CharacterId,
  CheckpointProp,
  EnemyEntity,
  FacingDirection,
  GhostType,
  LevelConfig,
  Pickup,
  Platform,
  SaveData,
  SettingsData,
  SpiritAnimState,
  TorchProp,
} from './types';

export const SAVE_STORAGE_KEY = 'nadhira_narendra_nusantara_v2';

export function getDefaultSettings(): SettingsData {
  return {
    bgmVolume: 0.55,
    sfxVolume: 0.78,
    muted: false,
    screenShake: true,
    showTouchControls: 'auto',
  };
}

export function getDefaultSaveData(): SaveData {
  return {
    selectedCharacter: 'nadhira',
    unlockedLevel: 1,
    totalCoins: 0,
    highScore: 0,
    records: {},
    settings: getDefaultSettings(),
  };
}

export function loadSaveData(storage?: Pick<Storage, 'getItem'>): SaveData {
  const defaults = getDefaultSaveData();
  try {
    const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!target) return defaults;
    const raw = target.getItem(SAVE_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const char: CharacterId = parsed.selectedCharacter === 'narendra' ? 'narendra' : 'nadhira';
    return {
      selectedCharacter: char,
      unlockedLevel: Math.max(1, Math.min(LEVELS.length, Number(parsed.unlockedLevel) || 1)),
      totalCoins: Math.max(0, Math.floor(Number(parsed.totalCoins) || 0)),
      highScore: Math.max(0, Math.floor(Number(parsed.highScore) || 0)),
      records: parsed.records && typeof parsed.records === 'object' ? parsed.records : {},
      settings: {
        ...defaults.settings,
        ...(parsed.settings ?? {}),
      },
    };
  } catch {
    return defaults;
  }
}

export function persistSaveData(data: SaveData, storage?: Pick<Storage, 'setItem'>): void {
  try {
    const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    target?.setItem(SAVE_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors in restricted frames
  }
}

export function calculateComboMultiplier(combo: number): number {
  if (combo <= 1) return 1;
  return Math.min(4, 1 + Math.floor((combo - 1) / 3) * 0.5);
}

export function calculateLevelStars(params: {
  starsCollected: number;
  starsTotal: number;
  damageTaken: number;
  clearTimeSec: number;
}): number {
  let stars = 1;
  if (params.starsCollected >= Math.max(1, Math.ceil(params.starsTotal * 0.65))) {
    stars++;
  }
  if (params.damageTaken <= 2 || params.clearTimeSec <= 95) {
    stars++;
  }
  return Math.max(1, Math.min(3, stars));
}

export function applyLevelVictoryToSave(
  save: SaveData,
  result: {
    levelId: number;
    score: number;
    coinsEarned: number;
    starsEarned: number;
    clearTimeSec: number;
  }
): SaveData {
  const prev = save.records[result.levelId];
  const nextRecord = {
    stars: Math.max(prev?.stars ?? 0, result.starsEarned),
    bestScore: Math.max(prev?.bestScore ?? 0, Math.round(result.score)),
    bestTimeSec: prev?.bestTimeSec
      ? Math.min(prev.bestTimeSec, Math.round(result.clearTimeSec))
      : Math.round(result.clearTimeSec),
  };

  return {
    ...save,
    unlockedLevel: Math.min(LEVELS.length, Math.max(save.unlockedLevel, result.levelId + 1)),
    totalCoins: save.totalCoins + Math.max(0, Math.round(result.coinsEarned)),
    highScore: Math.max(save.highScore, Math.round(result.score)),
    records: {
      ...save.records,
      [result.levelId]: nextRecord,
    },
  };
}

export function createEnemyInstance(
  id: number,
  kind: GhostType,
  x: number,
  y: number,
  levelScale = 1
): EnemyEntity {
  const arch = GHOST_ARCHETYPES[kind];
  const scaledHp = Math.round(arch.hp * levelScale);
  return {
    id,
    kind,
    name: arch.name,
    policy: arch.policy,
    x,
    y: arch.floating ? y - 34 : y,
    vx: 0,
    vy: 0,
    w: arch.w,
    h: arch.h,
    facing: -1,
    facingDir: 'left',
    animState: 'idle',
    hp: scaledHp,
    maxHp: scaledHp,
    speed: arch.speed * (0.94 + (levelScale - 1) * 0.25),
    damage: arch.damage,
    scoreValue: Math.round(arch.score * levelScale),
    grounded: !arch.floating,
    aiPhase: 'patrol',
    aiTimer: (id % 5) * 0.35 + 0.4,
    hitFlashTimer: 0,
    dyingTimer: 0,
    dead: false,
    animTime: (id * 1.17) % 6.28,
    gaitDist: 0,
    scaleX: 1,
    scaleY: 1,
    patrolOriginX: x,
    patrolRange: 165,
    stolenCoins: 0,
    hasAttackToken: false,
    afterimageX: x,
    afterimageY: y,
    afterimageAlpha: 0,
  };
}

/**
 * Derives 4-direction orientation & 7-state animation for any Indonesian ghost enemy.
 */
export function deriveGhostMotionState(
  enemy: Pick<
    EnemyEntity,
    'dead' | 'hitFlashTimer' | 'aiPhase' | 'grounded' | 'vx' | 'vy' | 'speed' | 'facing' | 'policy' | 'animTime'
  >,
  floating: boolean,
  distToPlayer: number
): { animState: SpiritAnimState; facingDir: FacingDirection } {
  const horizDir: FacingDirection =
    Math.abs(enemy.vx) > 18 ? (enemy.vx >= 0 ? 'right' : 'left') : enemy.facing === 1 ? 'right' : 'left';

  if (enemy.dead) {
    return { animState: 'defeat', facingDir: horizDir };
  }
  if (enemy.hitFlashTimer > 0) {
    return { animState: 'hurt', facingDir: horizDir };
  }
  if (enemy.aiPhase === 'windup' || enemy.aiPhase === 'attack') {
    if (!floating && !enemy.grounded && Math.abs(enemy.vy) > 95) {
      return { animState: 'jump', facingDir: horizDir };
    }
    const dir: FacingDirection =
      enemy.aiPhase === 'windup' && enemy.policy === 'heavy_charge' ? 'front' : horizDir;
    return { animState: 'attack', facingDir: dir };
  }
  if (!floating && !enemy.grounded) {
    return { animState: 'jump', facingDir: horizDir };
  }
  if (enemy.aiPhase === 'flee' || Math.abs(enemy.vx) >= enemy.speed * 0.9) {
    return { animState: 'run', facingDir: horizDir };
  }
  if (Math.abs(enemy.vx) > 20) {
    return { animState: 'walk', facingDir: horizDir };
  }
  // Idle ghosts naturally glance toward the camera or into the eerie background
  const idleDir: FacingDirection =
    distToPlayer > 780 && Math.floor(enemy.animTime * 0.55) % 2 === 1 ? 'back' : 'front';
  return { animState: 'idle', facingDir: idleDir };
}

/**
 * Derives 4-direction orientation & 7-state animation for Level Bosses.
 */
export function deriveBossMotionState(
  boss: Pick<
    BossEntity,
    'defeated' | 'hitFlashTimer' | 'aiState' | 'attackPattern' | 'vx' | 'vy' | 'facing'
  >,
  floating: boolean
): { animState: SpiritAnimState; facingDir: FacingDirection } {
  const horizDir: FacingDirection =
    Math.abs(boss.vx) > 20 ? (boss.vx >= 0 ? 'right' : 'left') : boss.facing === 1 ? 'right' : 'left';

  if (boss.defeated) {
    return { animState: 'defeat', facingDir: 'front' };
  }
  if (boss.hitFlashTimer > 0) {
    return { animState: 'hurt', facingDir: horizDir };
  }
  if (boss.aiState === 'intro') {
    return { animState: 'idle', facingDir: 'front' };
  }
  if (boss.aiState === 'windup' || boss.aiState === 'attack') {
    if (!floating && boss.attackPattern === 'slam' && Math.abs(boss.vy) > 65) {
      return { animState: 'jump', facingDir: horizDir };
    }
    const dir: FacingDirection = boss.attackPattern === 'summon' ? 'front' : horizDir;
    return { animState: 'attack', facingDir: dir };
  }
  if (Math.abs(boss.vx) >= 240) {
    return { animState: 'run', facingDir: horizDir };
  }
  if (Math.abs(boss.vx) > 20) {
    return { animState: 'walk', facingDir: horizDir };
  }
  return {
    animState: 'idle',
    facingDir: boss.aiState === 'recover' ? 'front' : horizDir,
  };
}

export interface GeneratedLevelLayout {
  platforms: Platform[];
  torches: TorchProp[];
  checkpoints: CheckpointProp[];
  pickups: Pickup[];
  enemies: EnemyEntity[];
  starsTotal: number;
}

export function buildLevelLayout(level: LevelConfig): GeneratedLevelLayout {
  const platforms: Platform[] = [
    { x: -120, y: GROUND_Y, w: level.worldWidth + 320, h: 160, kind: 'ground' },
  ];
  const torches: TorchProp[] = [];
  const checkpoints: CheckpointProp[] = [];
  const pickups: Pickup[] = [];
  const enemies: EnemyEntity[] = [];

  let nextPickupId = 1;
  let nextEnemyId = 1;

  // Deterministic pseudo-random helper per level for reproducible layouts & unit tests
  let seed = level.id * 7919 + 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // Place atmospheric Nusantara torches/lanterns along the whole world
  for (let tx = 140; tx < level.worldWidth - 120; tx += 360) {
    torches.push({
      x: tx,
      y: GROUND_Y - 88,
      color: level.accentColor,
      radius: 220,
      kind: level.id === 4 ? 'dupa' : level.id === 5 ? 'kristal' : level.id === 2 ? 'lentera' : 'obor',
    });
  }

  // Elevated platforms & vertical exploration routes up to arenaStartX
  const platformStep = 310;
  let platIndex = 0;
  for (let px = 420; px < level.arenaStartX - 260; px += platformStep) {
    const tier = platIndex % 3;
    const py = tier === 0 ? GROUND_Y - 135 : tier === 1 ? GROUND_Y - 225 : GROUND_Y - 155;
    const pw = tier === 1 ? 210 : 250;
    const kind: Platform['kind'] =
      level.id >= 4 ? 'temple' : level.id === 2 ? 'wood' : 'stone';
    platforms.push({ x: px, y: py, w: pw, h: 26, kind });

    // Coins arc above platform
    const coinCount = 3;
    for (let c = 0; c < coinCount; c++) {
      pickups.push({
        id: nextPickupId++,
        kind: 'coin',
        x: px + 44 + c * 58,
        y: py - 42,
        vy: 0,
        bobOffset: c * 0.7 + platIndex,
        collected: false,
        magnetized: false,
      });
    }

    // Place Stars on select upper platforms (3 per level)
    if (platIndex === 1 || platIndex === 4 || platIndex === 6) {
      pickups.push({
        id: nextPickupId++,
        kind: 'star',
        x: px + pw * 0.5,
        y: py - 84,
        vy: 0,
        bobOffset: platIndex,
        collected: false,
        magnetized: false,
      });
    }

    // Place Potions / Power Orbs / Crystals strategically
    if (platIndex === 2) {
      pickups.push({
        id: nextPickupId++,
        kind: 'power_orb',
        x: px + pw * 0.5,
        y: py - 56,
        vy: 0,
        bobOffset: 0.4,
        collected: false,
        magnetized: false,
      });
    } else if (platIndex === 5) {
      pickups.push({
        id: nextPickupId++,
        kind: 'potion',
        x: px + pw * 0.5,
        y: py - 52,
        vy: 0,
        bobOffset: 1.2,
        collected: false,
        magnetized: false,
      });
    } else if (platIndex === 3) {
      pickups.push({
        id: nextPickupId++,
        kind: 'crystal',
        x: px + pw * 0.5,
        y: py - 56,
        vy: 0,
        bobOffset: 2.1,
        collected: false,
        magnetized: false,
      });
    }

    platIndex++;
  }

  // Boss arena stepping platforms for tactical dodging against bosses
  platforms.push(
    { x: level.arenaStartX + 120, y: GROUND_Y - 140, w: 190, h: 26, kind: 'temple' },
    { x: level.arenaStartX + 540, y: GROUND_Y - 175, w: 200, h: 26, kind: 'temple' }
  );

  // Mid-level checkpoint & pre-boss checkpoint + healing potion
  const midX = Math.round(level.arenaStartX * 0.48);
  const preBossX = level.arenaStartX - 180;
  checkpoints.push(
    { x: midX, y: GROUND_Y, activated: false },
    { x: preBossX, y: GROUND_Y, activated: false }
  );
  pickups.push({
    id: nextPickupId++,
    kind: 'potion',
    x: preBossX + 56,
    y: GROUND_Y - 48,
    vy: 0,
    bobOffset: 0.5,
    collected: false,
    magnetized: false,
  });

  // Ground coins along path
  for (let gx = 290; gx < level.arenaStartX - 240; gx += 430) {
    pickups.push({
      id: nextPickupId++,
      kind: 'coin',
      x: gx,
      y: GROUND_Y - 38,
      vy: 0,
      bobOffset: gx * 0.01,
      collected: false,
      magnetized: false,
    });
  }

  // Ensure exact 3 collectible stars exist per level
  let starsTotal = pickups.filter((p) => p.kind === 'star').length;
  while (starsTotal < 3) {
    const sx = 650 + starsTotal * 720;
    pickups.push({
      id: nextPickupId++,
      kind: 'star',
      x: sx,
      y: GROUND_Y - 115,
      vy: 0,
      bobOffset: starsTotal,
      collected: false,
      magnetized: false,
    });
    starsTotal++;
  }

  // Distribute Indonesian ghosts cleanly (keeping opening 760px safe so player survives initial seconds without input)
  const levelScale = 1 + (level.id - 1) * 0.16;
  const spanStart = 760;
  const spanEnd = level.arenaStartX - 240;
  const step = (spanEnd - spanStart) / Math.max(1, level.spawnCount - 1);

  for (let i = 0; i < level.spawnCount; i++) {
    const ghostType = level.ghostPool[i % level.ghostPool.length];
    const jitter = (rand() - 0.5) * 65;
    const ex = Math.max(spanStart, Math.min(spanEnd, spanStart + i * step + jitter));
    const arch = GHOST_ARCHETYPES[ghostType];
    const ey = GROUND_Y - arch.h;
    enemies.push(createEnemyInstance(nextEnemyId++, ghostType, ex, ey, levelScale));
  }

  return {
    platforms,
    torches,
    checkpoints,
    pickups,
    enemies,
    starsTotal,
  };
}

export function getHeroMaxHp(character: CharacterId): number {
  return HERO_CONFIG[character].maxHp;
}
