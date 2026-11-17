import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DIRECTION_QUADRANT,
  HERO_FPS_BY_STATE,
  HERO_MIN_FPS,
  sampleBossSheetFrame,
  sampleGhostSheetFrame,
  sampleHeroSheetFrame,
  SPIRIT_FPS_BY_STATE,
  SPIRIT_MIN_FPS,
} from './animation';
import { BOSS_ARCHETYPES, GHOST_ARCHETYPES, HERO_CONFIG } from './constants';
import type { ActorAnimState, FacingDirection, SpiritAnimState } from './types';

const DIRECTIONS: FacingDirection[] = ['front', 'back', 'right', 'left'];
const SPIRIT_STATES: SpiritAnimState[] = [
  'idle',
  'walk',
  'run',
  'jump',
  'attack',
  'hurt',
  'defeat',
];

test('every hero animation state x 4 directions steps at >= 10 FPS inside distinct quadrants', () => {
  const states: ActorAnimState[] = [
    'idle',
    'walk',
    'run',
    'jump',
    'fall',
    'land',
    'shoot',
    'hurt',
    'celebrate',
    'defeat',
  ];

  for (const dir of DIRECTIONS) {
    const q = DIRECTION_QUADRANT[dir];
    for (const state of states) {
      assert.ok(
        HERO_FPS_BY_STATE[state] >= HERO_MIN_FPS,
        `${state} fps (${HERO_FPS_BY_STATE[state]}) must be >= 10`
      );

      const visited = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const t = i / 20;
        const sample = sampleHeroSheetFrame(state, dir, t, {
          shootAnimTimer: state === 'shoot' ? 0.18 * (1 - t) : undefined,
        });
        assert.ok(sample.fps >= 10);
        assert.ok(
          sample.row >= q.rowOffset && sample.row < q.rowOffset + 7,
          `${dir}:${state} row ${sample.row} outside quadrant [${q.rowOffset}, ${q.rowOffset + 7})`
        );
        assert.ok(
          sample.col >= q.colOffset && sample.col < q.colOffset + 12,
          `${dir}:${state} col ${sample.col} outside quadrant [${q.colOffset}, ${q.colOffset + 12})`
        );
        visited.add(`${sample.row}:${sample.col}`);
      }
      if (state !== 'land') {
        assert.ok(
          visited.size >= 7,
          `${dir}:${state} should visit >= 7 distinct animation frames across 1s (got ${visited.size})`
        );
      }
    }
  }
});

test('all ghosts and bosses cover 4 directions x 7 states at >= 10 FPS with unique cells', () => {
  for (const dir of DIRECTIONS) {
    const q = DIRECTION_QUADRANT[dir];
    const rowByState = new Set<number>();

    for (const state of SPIRIT_STATES) {
      assert.ok(SPIRIT_FPS_BY_STATE[state] >= SPIRIT_MIN_FPS);
      const cols = new Set<number>();
      for (let i = 0; i < 24; i++) {
        const g = sampleGhostSheetFrame(state, dir, i / 24);
        const b = sampleBossSheetFrame(state, dir, i / 24);
        assert.deepEqual(g, b);
        assert.ok(g.fps >= 10);
        assert.ok(g.row >= q.rowOffset && g.row < q.rowOffset + 7);
        assert.ok(g.col >= q.colOffset && g.col < q.colOffset + 12);
        rowByState.add(g.row);
        cols.add(g.col);
      }
      assert.ok(
        cols.size >= 10,
        `spirit ${dir}:${state} should visit >= 10 frames within 1s (got ${cols.size})`
      );
    }
    assert.equal(rowByState.size, 7, `${dir} must map 7 distinct state rows`);
  }
});

test('all heroes, ghosts, and bosses expose valid 24x14 multi-directional sprite sheet metadata', () => {
  for (const hero of Object.values(HERO_CONFIG)) {
    assert.equal(hero.sheet.cols, 24);
    assert.equal(hero.sheet.rows, 14);
    assert.equal(hero.sheet.colsPerDir, 12);
    assert.ok(hero.sheet.frameW * hero.sheet.cols <= 4096);
    assert.ok(hero.sheet.frameH * hero.sheet.rows <= 4096);
    assert.ok(hero.sheet.sheetUrl.endsWith('_sheet.png'));
  }
  for (const ghost of Object.values(GHOST_ARCHETYPES)) {
    assert.equal(ghost.sheet.cols, 24);
    assert.equal(ghost.sheet.rows, 14);
    assert.equal(ghost.sheet.colsPerDir, 12);
    assert.ok(ghost.sheet.frameW * ghost.sheet.cols <= 4096);
    assert.ok(ghost.sheet.frameH * ghost.sheet.rows <= 4096);
    assert.ok(ghost.sheet.sheetUrl.endsWith('_sheet.png'));
  }
  for (const boss of Object.values(BOSS_ARCHETYPES)) {
    assert.equal(boss.sheet.cols, 24);
    assert.equal(boss.sheet.rows, 14);
    assert.equal(boss.sheet.colsPerDir, 12);
    assert.ok(boss.sheet.frameW * boss.sheet.cols <= 4096);
    assert.ok(boss.sheet.frameH * boss.sheet.rows <= 4096);
    assert.ok(boss.sheet.sheetUrl.endsWith('_sheet.png'));
  }
});
