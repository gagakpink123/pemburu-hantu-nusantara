import type { ActorAnimState, FacingDirection, SpiritAnimState } from './types';

export interface SpriteSheetMeta {
  sheetUrl: string;
  frameW: number;
  frameH: number;
  cols: number;
  rows: number;
  colsPerDir: number;
  drawH: number;
  anchorBottomPx: number;
}

export interface SampledSheetFrame {
  row: number;
  col: number;
  fps: number;
}

export const HERO_MIN_FPS = 10;
export const SPIRIT_MIN_FPS = 10;

/**
 * 24x14 Multi-Directional Sprite Sheet Layout (4 directions x 7 states x 12 frames):
 *   front -> colOffset 0,  rowOffset 0
 *   back  -> colOffset 12, rowOffset 0
 *   right -> colOffset 0,  rowOffset 7
 *   left  -> colOffset 12, rowOffset 7
 */
export const DIRECTION_QUADRANT: Record<
  FacingDirection,
  { colOffset: number; rowOffset: number }
> = {
  front: { colOffset: 0, rowOffset: 0 },
  back: { colOffset: 12, rowOffset: 0 },
  right: { colOffset: 0, rowOffset: 7 },
  left: { colOffset: 12, rowOffset: 7 },
};

export const SPIRIT_ROW_BY_STATE: Record<SpiritAnimState, number> = {
  idle: 0,
  walk: 1,
  run: 2,
  jump: 3,
  attack: 4,
  hurt: 5,
  defeat: 6,
};

export const HERO_ROW_BY_STATE: Record<ActorAnimState, number> = {
  idle: 0,
  walk: 1,
  run: 2,
  jump: 3,
  fall: 3,
  land: 3,
  shoot: 4,
  hurt: 5,
  celebrate: 3,
  defeat: 6,
};

export const HERO_FPS_BY_STATE: Record<ActorAnimState, number> = {
  idle: 10,
  walk: 12,
  run: 14,
  jump: 12,
  fall: 12,
  land: 12,
  shoot: 14,
  hurt: 12,
  celebrate: 12,
  defeat: 10,
};

export const SPIRIT_FPS_BY_STATE: Record<SpiritAnimState, number> = {
  idle: 10,
  walk: 12,
  run: 14,
  jump: 12,
  attack: 14,
  hurt: 12,
  defeat: 10,
};

/**
 * Samples (row, col, fps) inside the unified 24x14 multi-directional hero sheet
 * for any combination of ActorAnimState and FacingDirection (front | back | right | left).
 */
export function sampleHeroSheetFrame(
  animState: ActorAnimState,
  facingDir: FacingDirection,
  time: number,
  options?: {
    shootAnimTimer?: number;
    colsPerDir?: number;
  }
): SampledSheetFrame {
  const colsPerDir = options?.colsPerDir ?? 12;
  const q = DIRECTION_QUADRANT[facingDir] ?? DIRECTION_QUADRANT.right;
  const localRow = HERO_ROW_BY_STATE[animState] ?? 0;
  const fps = Math.max(HERO_MIN_FPS, HERO_FPS_BY_STATE[animState] ?? 10);

  let localCol = Math.floor(Math.max(0, time) * fps) % colsPerDir;

  if (animState === 'shoot' && options?.shootAnimTimer !== undefined) {
    const progress = Math.max(0, Math.min(0.999, (0.18 - options.shootAnimTimer) / 0.18));
    localCol = Math.min(colsPerDir - 1, Math.floor(progress * colsPerDir));
  } else if (animState === 'land') {
    localCol = Math.floor(Math.max(0, time) * fps) % 3;
  } else if (animState === 'celebrate') {
    const airSpan = Math.max(1, colsPerDir - 4);
    localCol = 3 + (Math.floor(Math.max(0, time) * fps) % airSpan);
  }

  return {
    row: q.rowOffset + localRow,
    col: q.colOffset + localCol,
    fps,
  };
}

/**
 * Unified 4-direction x 7-state x 12-frame sampler for Indonesian Ghosts & Bosses.
 */
export function sampleSpiritSheetFrame(
  animState: SpiritAnimState,
  facingDir: FacingDirection,
  animTime: number,
  options?: {
    colsPerDir?: number;
    dyingTimer?: number;
  }
): SampledSheetFrame {
  const colsPerDir = options?.colsPerDir ?? 12;
  const q = DIRECTION_QUADRANT[facingDir] ?? DIRECTION_QUADRANT.left;
  const localRow = SPIRIT_ROW_BY_STATE[animState] ?? 0;
  const fps = Math.max(SPIRIT_MIN_FPS, SPIRIT_FPS_BY_STATE[animState] ?? 10);

  let localCol = Math.floor(Math.max(0, animTime) * fps) % colsPerDir;
  if (animState === 'defeat' && options?.dyingTimer !== undefined) {
    localCol = Math.min(colsPerDir - 1, Math.floor(Math.max(0, options.dyingTimer) * fps));
  }

  return {
    row: q.rowOffset + localRow,
    col: q.colOffset + localCol,
    fps,
  };
}

export function sampleGhostSheetFrame(
  animState: SpiritAnimState,
  facingDir: FacingDirection,
  animTime: number,
  colsPerDir = 12,
  dyingTimer?: number
): SampledSheetFrame {
  return sampleSpiritSheetFrame(animState, facingDir, animTime, { colsPerDir, dyingTimer });
}

export function sampleBossSheetFrame(
  animState: SpiritAnimState,
  facingDir: FacingDirection,
  animTime: number,
  colsPerDir = 12,
  dyingTimer?: number
): SampledSheetFrame {
  return sampleSpiritSheetFrame(animState, facingDir, animTime, { colsPerDir, dyingTimer });
}
