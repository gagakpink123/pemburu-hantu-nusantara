import assert from 'node:assert/strict';
import test from 'node:test';
import { LEVELS } from './constants';
import {
  applyLevelVictoryToSave,
  buildLevelLayout,
  calculateComboMultiplier,
  calculateLevelStars,
  getDefaultSaveData,
  loadSaveData,
  persistSaveData,
} from './rules';

test('combo multiplier scales cleanly and caps at 4x', () => {
  assert.equal(calculateComboMultiplier(0), 1);
  assert.equal(calculateComboMultiplier(1), 1);
  assert.equal(calculateComboMultiplier(4), 1.5);
  assert.equal(calculateComboMultiplier(7), 2);
  assert.equal(calculateComboMultiplier(40), 4);
});

test('level star rating rewards collecting stars and low damage or fast clear', () => {
  assert.equal(
    calculateLevelStars({ starsCollected: 0, starsTotal: 3, damageTaken: 5, clearTimeSec: 150 }),
    1
  );
  assert.equal(
    calculateLevelStars({ starsCollected: 2, starsTotal: 3, damageTaken: 5, clearTimeSec: 150 }),
    2
  );
  assert.equal(
    calculateLevelStars({ starsCollected: 2, starsTotal: 3, damageTaken: 1, clearTimeSec: 80 }),
    3
  );
});

test('save data persists character choice, unlocked levels, and best records', () => {
  const mem = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, v);
    },
  };

  let save = getDefaultSaveData();
  save.selectedCharacter = 'narendra';
  save = applyLevelVictoryToSave(save, {
    levelId: 1,
    score: 2450,
    coinsEarned: 18,
    starsEarned: 3,
    clearTimeSec: 68,
  });
  persistSaveData(save, mockStorage);

  const loaded = loadSaveData(mockStorage);
  assert.equal(loaded.selectedCharacter, 'narendra');
  assert.equal(loaded.unlockedLevel, 2);
  assert.equal(loaded.totalCoins, 18);
  assert.equal(loaded.highScore, 2450);
  assert.equal(loaded.records[1]?.stars, 3);
  assert.equal(loaded.records[1]?.bestTimeSec, 68);
});

test('all 5 Nusantara levels generate valid platforms, checkpoints, 3 stars, and safe opening spawn', () => {
  for (const level of LEVELS) {
    const layout = buildLevelLayout(level);
    assert.ok(layout.platforms.length >= 4, `Level ${level.id} should have platforms`);
    assert.equal(layout.starsTotal, 3, `Level ${level.id} should have 3 stars`);
    assert.equal(layout.checkpoints.length, 2, `Level ${level.id} should have 2 checkpoints`);
    assert.equal(layout.enemies.length, level.spawnCount);
    const earliestEnemy = Math.min(...layout.enemies.map((e) => e.x));
    assert.ok(earliestEnemy >= 520, `Level ${level.id} opening area should remain safe`);
  }
});
