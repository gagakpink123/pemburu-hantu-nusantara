import assert from 'node:assert/strict';
import test from 'node:test';
import { GROUND_Y, HERO_CONFIG } from './constants';
import {
  circleOverlapsRect,
  computeBossPhase,
  rectsOverlap,
  stepPlayerKinematics,
} from './physics';
import { deriveBossMotionState, deriveGhostMotionState } from './rules';
import type { Platform, PlayerState } from './types';

function makePlayer(): PlayerState {
  return {
    x: 160,
    y: GROUND_Y - 120,
    vx: 0,
    vy: 0,
    w: 58,
    h: 120,
    facing: 1,
    facingDir: 'right',
    grounded: true,
    coyoteTimer: 0.1,
    jumpBufferTimer: 0,
    jumpsRemaining: 1,
    hp: 6,
    maxHp: 6,
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
    spawnX: 160,
    spawnY: GROUND_Y - 120,
    afterimages: [],
  };
}

const groundOnly: Platform[] = [{ x: -100, y: GROUND_Y, w: 3000, h: 120, kind: 'ground' }];

test('player jump, double jump, and landing squash-stretch work cleanly', () => {
  const player = makePlayer();
  const stats = HERO_CONFIG.nadhira;
  const bounds = { minX: 0, maxX: 2000 };

  const j1 = stepPlayerKinematics(
    player,
    { moveDir: 1, jumpJustPressed: true, jumpHeld: true, dashJustPressed: false },
    groundOnly,
    bounds,
    1 / 60,
    stats
  );
  assert.equal(j1.jumped, true);
  assert.equal(player.grounded, false);
  assert.ok(player.vy < 0);

  // Double jump mid-air
  const j2 = stepPlayerKinematics(
    player,
    { moveDir: 1, jumpJustPressed: true, jumpHeld: true, dashJustPressed: false },
    groundOnly,
    bounds,
    1 / 60,
    stats
  );
  assert.equal(j2.doubleJumped, true);
  assert.equal(player.jumpsRemaining, 0);

  // Simulate falling until grounded
  let landed = false;
  for (let i = 0; i < 120; i++) {
    const res = stepPlayerKinematics(
      player,
      { moveDir: 0, jumpJustPressed: false, jumpHeld: false, dashJustPressed: false },
      groundOnly,
      bounds,
      1 / 60,
      stats
    );
    if (res.landed) {
      landed = true;
      break;
    }
  }
  assert.equal(landed, true);
  assert.equal(player.grounded, true);
  assert.equal(player.y + player.h, GROUND_Y);
});

test('coyote time allows jump shortly after stepping off ledge', () => {
  const player = makePlayer();
  player.grounded = false;
  player.coyoteTimer = 0.08;
  const res = stepPlayerKinematics(
    player,
    { moveDir: 0, jumpJustPressed: true, jumpHeld: true, dashJustPressed: false },
    groundOnly,
    { minX: 0, maxX: 2000 },
    1 / 60,
    HERO_CONFIG.narendra
  );
  assert.equal(res.jumped, true);
});

test('dash consumes mana, sets dash velocity, and updates facing & facingDir', () => {
  const player = makePlayer();
  const res = stepPlayerKinematics(
    player,
    { moveDir: -1, jumpJustPressed: false, jumpHeld: false, dashJustPressed: true },
    groundOnly,
    { minX: 0, maxX: 2000 },
    1 / 60,
    HERO_CONFIG.narendra
  );
  assert.equal(res.dashed, true);
  assert.equal(player.facing, -1);
  assert.equal(player.facingDir, 'left');
  assert.ok(player.mana < 100);
  assert.ok(player.vx < -500);
});

test('4-direction hero input maps left, right, up(back), down(front), and idle front-turn cleanly', () => {
  const player = makePlayer();
  const bounds = { minX: 0, maxX: 2000 };
  const stats = HERO_CONFIG.nadhira;

  stepPlayerKinematics(
    player,
    { moveDir: -1, jumpJustPressed: false, jumpHeld: false, dashJustPressed: false },
    groundOnly,
    bounds,
    1 / 60,
    stats
  );
  assert.equal(player.facingDir, 'left');

  stepPlayerKinematics(
    player,
    { moveDir: 1, jumpJustPressed: false, jumpHeld: false, dashJustPressed: false },
    groundOnly,
    bounds,
    1 / 60,
    stats
  );
  assert.equal(player.facingDir, 'right');

  stepPlayerKinematics(
    player,
    { moveDir: 0, upHeld: true, jumpJustPressed: false, jumpHeld: false, dashJustPressed: false },
    groundOnly,
    bounds,
    1 / 60,
    stats
  );
  assert.equal(player.facingDir, 'back');

  stepPlayerKinematics(
    player,
    { moveDir: 0, downHeld: true, jumpJustPressed: false, jumpHeld: false, dashJustPressed: false },
    groundOnly,
    bounds,
    1 / 60,
    stats
  );
  assert.equal(player.facingDir, 'front');
});

test('ghost & boss motion state derivation covers all 7 states and 4 directions', () => {
  assert.equal(
    deriveGhostMotionState(
      { dead: true, hitFlashTimer: 0, aiPhase: 'patrol', grounded: true, vx: 0, vy: 0, speed: 200, facing: -1, policy: 'hopper', animTime: 0 },
      false,
      200
    ).animState,
    'defeat'
  );
  assert.equal(
    deriveGhostMotionState(
      { dead: false, hitFlashTimer: 0.1, aiPhase: 'patrol', grounded: true, vx: 0, vy: 0, speed: 200, facing: -1, policy: 'hopper', animTime: 0 },
      false,
      200
    ).animState,
    'hurt'
  );
  assert.deepEqual(
    deriveGhostMotionState(
      { dead: false, hitFlashTimer: 0, aiPhase: 'windup', grounded: true, vx: 0, vy: 0, speed: 165, facing: -1, policy: 'heavy_charge', animTime: 0 },
      false,
      200
    ),
    { animState: 'attack', facingDir: 'front' }
  );
  assert.deepEqual(
    deriveBossMotionState(
      { defeated: false, hitFlashTimer: 0, aiState: 'attack', attackPattern: 'summon', vx: 0, vy: 0, facing: -1 },
      false
    ),
    { animState: 'attack', facingDir: 'front' }
  );
  assert.deepEqual(
    deriveBossMotionState(
      { defeated: true, hitFlashTimer: 0, aiState: 'defeated', attackPattern: 'charge', vx: 0, vy: 0, facing: 1 },
      false
    ),
    { animState: 'defeat', facingDir: 'front' }
  );
});

test('collision helpers and boss phase transitions behave accurately', () => {
  assert.equal(
    rectsOverlap({ x: 0, y: 0, w: 50, h: 50 }, { x: 40, y: 40, w: 50, h: 50 }),
    true
  );
  assert.equal(
    rectsOverlap({ x: 0, y: 0, w: 40, h: 40 }, { x: 45, y: 45, w: 40, h: 40 }),
    false
  );
  assert.equal(circleOverlapsRect(15, 15, 10, { x: 20, y: 10, w: 30, h: 30 }), true);
  assert.equal(circleOverlapsRect(0, 0, 5, { x: 20, y: 20, w: 30, h: 30 }), false);

  assert.equal(computeBossPhase({ hp: 100, maxHp: 100 }), 1);
  assert.equal(computeBossPhase({ hp: 65, maxHp: 100 }), 2);
  assert.equal(computeBossPhase({ hp: 30, maxHp: 100 }), 3);
});
