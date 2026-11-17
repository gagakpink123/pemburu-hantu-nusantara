import { GRAVITY, MAX_FALL_SPEED } from './constants';
import type { BossEntity, Platform, PlayerState } from './types';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function circleOverlapsRect(cx: number, cy: number, r: number, rect: Rect): boolean {
  const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy <= r * r;
}

export function resolveOneWayPlatforms(
  entity: { x: number; y: number; w: number; h: number; vy: number; grounded: boolean },
  prevBottom: number,
  platforms: Platform[]
): { landed: boolean; platform: Platform | null } {
  let landed = false;
  let landedPlatform: Platform | null = null;
  const bottom = entity.y + entity.h;

  if (entity.vy >= 0) {
    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      const horizOverlap = entity.x + entity.w * 0.82 > p.x && entity.x + entity.w * 0.18 < p.x + p.w;
      if (!horizOverlap) continue;

      if (p.kind === 'ground') {
        if (bottom >= p.y) {
          if (!entity.grounded && entity.vy > 140) landed = true;
          entity.y = p.y - entity.h;
          entity.vy = 0;
          entity.grounded = true;
          landedPlatform = p;
          break;
        }
      } else {
        // One-way elevated ledges: land only when crossing top edge from above
        if (prevBottom <= p.y + 12 && bottom >= p.y) {
          if (!entity.grounded && entity.vy > 140) landed = true;
          entity.y = p.y - entity.h;
          entity.vy = 0;
          entity.grounded = true;
          landedPlatform = p;
          break;
        }
      }
    }
  }

  return { landed, platform: landedPlatform };
}

export function stepPlayerKinematics(
  player: PlayerState,
  input: {
    moveDir: -1 | 0 | 1;
    upHeld?: boolean;
    downHeld?: boolean;
    jumpJustPressed: boolean;
    jumpHeld: boolean;
    dashJustPressed: boolean;
  },
  platforms: Platform[],
  worldBounds: { minX: number; maxX: number },
  dt: number,
  heroStats: {
    moveSpeed: number;
    jumpVelocity: number;
    doubleJumpVelocity: number;
    dashSpeed: number;
  }
): {
  jumped: boolean;
  doubleJumped: boolean;
  dashed: boolean;
  landed: boolean;
} {
  let jumped = false;
  let doubleJumped = false;
  let dashed = false;

  // Cooldowns & timers
  if (player.coyoteTimer > 0) player.coyoteTimer = Math.max(0, player.coyoteTimer - dt);
  if (player.jumpBufferTimer > 0) player.jumpBufferTimer = Math.max(0, player.jumpBufferTimer - dt);
  if (player.dashCooldown > 0) player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  if (player.shootCooldown > 0) player.shootCooldown = Math.max(0, player.shootCooldown - dt);
  if (player.shootAnimTimer > 0) player.shootAnimTimer = Math.max(0, player.shootAnimTimer - dt);
  if (player.invulnTimer > 0) player.invulnTimer = Math.max(0, player.invulnTimer - dt);
  if (player.hitFlashTimer > 0) player.hitFlashTimer = Math.max(0, player.hitFlashTimer - dt);
  if (player.landTimer > 0) player.landTimer = Math.max(0, player.landTimer - dt);
  if (player.powerBoostTimer > 0) player.powerBoostTimer = Math.max(0, player.powerBoostTimer - dt);

  if (input.jumpJustPressed) {
    player.jumpBufferTimer = 0.12;
  }

  // Dash initiation
  if (input.dashJustPressed && player.dashCooldown <= 0 && player.dashTimer <= 0 && player.mana >= 18) {
    player.dashDir = input.moveDir !== 0 ? input.moveDir : player.facing;
    player.facing = player.dashDir;
    player.facingDir = player.dashDir === 1 ? 'right' : 'left';
    player.idleTimer = 0;
    player.dashTimer = 0.18;
    player.dashCooldown = 0.55;
    player.mana = Math.max(0, player.mana - 18);
    player.vx = player.dashDir * heroStats.dashSpeed;
    player.vy = 0;
    player.scaleX = 1.24;
    player.scaleY = 0.82;
    dashed = true;
  }

  if (player.dashTimer > 0) {
    player.dashTimer = Math.max(0, player.dashTimer - dt);
    player.vx = player.dashDir * heroStats.dashSpeed;
    player.vy = 0;
  } else {
    // Smooth responsive horizontal acceleration & friction
    const targetVx = input.moveDir * heroStats.moveSpeed;
    const accel = player.grounded ? 3200 : 2100;
    const diff = targetVx - player.vx;
    const maxStep = accel * dt;
    if (Math.abs(diff) <= maxStep) {
      player.vx = targetVx;
    } else {
      player.vx += Math.sign(diff) * maxStep;
    }
    if (input.moveDir !== 0) {
      player.facing = input.moveDir;
      player.facingDir = input.moveDir === 1 ? 'right' : 'left';
      player.idleTimer = 0;
    } else if (input.downHeld) {
      player.facingDir = 'front';
      player.idleTimer = 0;
    } else if (input.upHeld) {
      player.facingDir = 'back';
      player.idleTimer = 0;
    }

    // Jump buffering + Coyote time + Double jump
    if (player.jumpBufferTimer > 0) {
      if (player.grounded || player.coyoteTimer > 0) {
        player.vy = heroStats.jumpVelocity;
        player.grounded = false;
        player.coyoteTimer = 0;
        player.jumpBufferTimer = 0;
        player.jumpsRemaining = 1;
        player.scaleX = 0.84;
        player.scaleY = 1.18;
        player.idleTimer = 0;
        jumped = true;
      } else if (player.jumpsRemaining > 0) {
        player.vy = heroStats.doubleJumpVelocity;
        player.jumpsRemaining = 0;
        player.jumpBufferTimer = 0;
        player.scaleX = 0.86;
        player.scaleY = 1.16;
        player.idleTimer = 0;
        doubleJumped = true;
      }
    }

    // Variable jump height cut when jump key released early while ascending
    if (!input.jumpHeld && player.vy < -220) {
      player.vy *= Math.pow(0.45, dt * 16);
    }

    // Optional gentle fast-fall when pressing down mid-air
    const fallAccel = !player.grounded && input.downHeld ? GRAVITY * 1.35 : GRAVITY;
    player.vy = Math.min(MAX_FALL_SPEED, player.vy + fallAccel * dt);
  }

  const prevBottom = player.y + player.h;
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  // Clamp within active arena / world horizontal bounds
  if (player.x < worldBounds.minX) {
    player.x = worldBounds.minX;
    if (player.vx < 0) player.vx = 0;
  } else if (player.x + player.w > worldBounds.maxX) {
    player.x = worldBounds.maxX - player.w;
    if (player.vx > 0) player.vx = 0;
  }

  const wasGrounded = player.grounded;
  player.grounded = false;
  const { landed } = resolveOneWayPlatforms(player, prevBottom, platforms);
  if (player.grounded) {
    player.coyoteTimer = 0.1;
    player.jumpsRemaining = 1;
    if (!wasGrounded && landed) {
      player.scaleX = 1.22;
      player.scaleY = 0.78;
      player.landTimer = 0.14;
    }
  }

  // Sync gait cycle strictly to horizontal distance traveled when grounded (no skating!)
  if (player.grounded && Math.abs(player.vx) > 8) {
    player.gaitDist += Math.abs(player.vx) * dt;
  }

  // Exponential squash/stretch damping back to (1, 1)
  const damp = 1 - Math.exp(-14 * dt);
  player.scaleX += (1 - player.scaleX) * damp;
  player.scaleY += (1 - player.scaleY) * damp;

  // Regenerate mana gradually
  player.mana = Math.min(player.maxMana, player.mana + 12 * dt);

  // Derive clear actor animation state
  if (player.hp <= 0) {
    player.animState = 'defeat';
  } else if (player.hitFlashTimer > 0.08) {
    player.animState = 'hurt';
  } else if (player.shootAnimTimer > 0) {
    player.animState = 'shoot';
  } else if (!player.grounded) {
    player.animState = player.vy < 0 ? 'jump' : 'fall';
  } else if (player.landTimer > 0) {
    player.animState = 'land';
  } else if (Math.abs(player.vx) > 250) {
    player.animState = 'run';
  } else if (Math.abs(player.vx) > 22) {
    player.animState = 'walk';
  } else {
    player.animState = 'idle';
    if (!input.upHeld && !input.downHeld) {
      player.idleTimer += dt;
      if (player.idleTimer >= 1.6) {
        player.facingDir = 'front';
      }
    }
  }

  return { jumped, doubleJumped, dashed, landed };
}

export function computeBossPhase(boss: Pick<BossEntity, 'hp' | 'maxHp'>): 1 | 2 | 3 {
  const ratio = boss.hp / Math.max(1, boss.maxHp);
  if (ratio <= 0.35) return 3;
  if (ratio <= 0.7) return 2;
  return 1;
}
