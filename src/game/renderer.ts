import {
  BOSS_ARCHETYPES,
  GROUND_Y,
  HERO_CONFIG,
  ITEM_ASSETS,
  WORLD_HEIGHT,
} from './constants';
import {
  drawArticulatedBoss,
  drawArticulatedGhost,
  drawArticulatedHero,
  type SpriteBank,
} from './characterRig';
import type {
  BossEntity,
  CharacterId,
  CheckpointProp,
  EnemyEntity,
  FloatingText,
  GameState,
  LevelConfig,
  Particle,
  Pickup,
  Platform,
  PlayerState,
  Projectile,
  ShockwaveRing,
  TorchProp,
} from './types';

export interface AmbientMote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
}

export interface RenderSceneInput {
  viewW: number;
  viewH: number;
  cameraX: number;
  shakeX: number;
  shakeY: number;
  time: number;
  gameState: GameState;
  level: LevelConfig;
  character: CharacterId;
  player: PlayerState;
  platforms: Platform[];
  torches: TorchProp[];
  checkpoints: CheckpointProp[];
  pickups: Pickup[];
  enemies: EnemyEntity[];
  boss: BossEntity | null;
  projectiles: Projectile[];
  particles: Particle[];
  rings: ShockwaveRing[];
  floatingTexts: FloatingText[];
  ambientMotes: AmbientMote[];
}

// Offscreen caches to avoid allocating per-frame radial gradients on Canvas 2D
const glowStampCache = new Map<string, HTMLCanvasElement>();
let shadowStampCache: HTMLCanvasElement | null = null;
let vignetteCache: { w: number; h: number; canvas: HTMLCanvasElement } | null = null;

function getGlowStamp(color: string): HTMLCanvasElement {
  const existing = glowStampCache.get(color);
  if (existing) return existing;

  const size = 96;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.25, color);
    grad.addColorStop(0.65, color + '44');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }
  glowStampCache.set(color, c);
  return c;
}

function getShadowStamp(): HTMLCanvasElement {
  if (shadowStampCache) return shadowStampCache;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 40;
  const g = c.getContext('2d');
  if (g) {
    g.save();
    g.scale(1, 40 / 128);
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(64, 64, 62, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  shadowStampCache = c;
  return c;
}

function getVignetteCanvas(worldViewW: number): HTMLCanvasElement {
  const w = Math.ceil(worldViewW);
  const h = WORLD_HEIGHT;
  if (vignetteCache && vignetteCache.w === w && vignetteCache.h === h) {
    return vignetteCache.canvas;
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (g) {
    const vig = g.createRadialGradient(w * 0.5, h * 0.48, w * 0.28, w * 0.5, h * 0.5, w * 0.72);
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(1, 'rgba(2, 3, 8, 0.56)');
    g.fillStyle = vig;
    g.fillRect(0, 0, w, h);
  }
  vignetteCache = { w, h, canvas: c };
  return c;
}

export function renderHorrorWorld(
  ctx: CanvasRenderingContext2D,
  sprites: SpriteBank,
  scene: RenderSceneInput
): void {
  const { viewW, viewH, level, time } = scene;
  const scale = viewH / WORLD_HEIGHT;
  const worldViewW = viewW / scale;

  ctx.save();
  ctx.scale(scale, scale);

  const camX = scene.cameraX - scene.shakeX;
  const camY = -scene.shakeY;

  const bgEntry = sprites.get(level.bgUrl);
  if (bgEntry.loaded) {
    const img = bgEntry.img;
    const bgAspect = img.naturalWidth / Math.max(1, img.naturalHeight);
    const drawH = WORLD_HEIGHT;
    const drawW = Math.max(worldViewW + 240, drawH * bgAspect);
    const maxParallaxOffset = Math.max(0, drawW - worldViewW);
    const scrollProgress = Math.max(0, Math.min(1, camX / Math.max(1, level.worldWidth - worldViewW)));
    const bgX = -scrollProgress * maxParallaxOffset * 0.65;
    ctx.drawImage(img, bgX, camY * 0.2, drawW, drawH);
  } else {
    ctx.fillStyle = '#04050a';
    ctx.fillRect(0, 0, worldViewW, WORLD_HEIGHT);
  }

  // Atmospheric dark depth tint so foreground 3D characters & VFX pop dramatically
  ctx.fillStyle = level.ambientTint;
  ctx.fillRect(0, 0, worldViewW, WORLD_HEIGHT);

  // 2. Diagonal Volumetric Moonbeams / Temple Light Shafts
  ctx.save();
  ctx.fillStyle = level.moonColor;
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < 4; i++) {
    const beamWorldX = 320 + i * 980;
    const bx = beamWorldX - camX * 0.55;
    if (bx < -420 || bx > worldViewW + 420) continue;
    ctx.beginPath();
    ctx.moveTo(bx - 40, 0);
    ctx.lineTo(bx + 120, 0);
    ctx.lineTo(bx + 340, GROUND_Y);
    ctx.lineTo(bx + 70, GROUND_Y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 3. Distant Drifting Fog Ribbon
  drawMistLayer(ctx, worldViewW, camX * 0.45, GROUND_Y - 125, 130, time, level.fogColor, 0.55);

  // World-space transform
  ctx.save();
  ctx.translate(-camX, camY);

  // 4. Ground & Gameplay Platforms (only show elevated gameplay ledges during active play)
  for (const plat of scene.platforms) {
    if (scene.gameState === 'title' && plat.kind !== 'ground') continue;
    if (plat.x + plat.w < camX - 100 || plat.x > camX + worldViewW + 100) continue;
    drawPlatform3D(ctx, plat, level);
  }

  // 5. Nusantara Torches / Lanterns & Cached Warm Light Pools
  for (const torch of scene.torches) {
    if (torch.x < camX - 240 || torch.x > camX + worldViewW + 240) continue;
    drawTorchProp(ctx, torch, time);
  }

  if (scene.gameState !== 'title') {
    // 6. Checkpoints (Tugu Lentera Pusaka)
    for (const cp of scene.checkpoints) {
      if (cp.x < camX - 180 || cp.x > camX + worldViewW + 180) continue;
      drawCheckpointShrine(ctx, cp, time, level.accentColor);
    }

    if (scene.boss && scene.boss.active && !scene.boss.defeated) {
      drawArenaBarrier(ctx, level.arenaStartX - 36, time, level.accentColor);
    }

    // 7. Ground Contact Shadows
    for (const item of scene.pickups) {
      if (item.collected || item.x < camX - 80 || item.x > camX + worldViewW + 80) continue;
      const shadowY = findGroundBelow(item.x, item.y, scene.platforms);
      drawContactShadow(ctx, item.x, shadowY, 18, Math.max(0.18, 0.5 - (shadowY - item.y) * 0.002));
    }
    for (const enemy of scene.enemies) {
      if (enemy.dead && enemy.dyingTimer > 0.55) continue;
      if (enemy.x + enemy.w < camX - 120 || enemy.x > camX + worldViewW + 120) continue;
      const cx = enemy.x + enemy.w * 0.5;
      const shadowY = findGroundBelow(cx, enemy.y + enemy.h - 4, scene.platforms);
      const heightGap = Math.max(0, shadowY - (enemy.y + enemy.h));
      drawContactShadow(ctx, cx, shadowY, enemy.w * 0.48, Math.max(0.22, 0.72 - heightGap * 0.0028));
    }
    if (scene.boss && scene.boss.active && (!scene.boss.defeated || scene.boss.defeatTimer < 1.4)) {
      const bcx = scene.boss.x + scene.boss.w * 0.5;
      const shadowY = findGroundBelow(bcx, scene.boss.y + scene.boss.h - 8, scene.platforms);
      drawContactShadow(ctx, bcx, shadowY, scene.boss.w * 0.56, 0.78);
    }
    {
      const pcx = scene.player.x + scene.player.w * 0.5;
      const shadowY = findGroundBelow(pcx, scene.player.y + scene.player.h - 4, scene.platforms);
      const heightGap = Math.max(0, shadowY - (scene.player.y + scene.player.h));
      drawContactShadow(
        ctx,
        pcx,
        shadowY,
        Math.max(16, 36 - heightGap * 0.06),
        Math.max(0.2, 0.75 - heightGap * 0.003)
      );
    }

    // 8. Pickups
    for (const item of scene.pickups) {
      if (item.collected || item.x < camX - 80 || item.x > camX + worldViewW + 80) continue;
      drawPickup(ctx, sprites, item, time);
    }

    // 9. Indonesian Ghosts
    for (const enemy of scene.enemies) {
      if (enemy.dead && enemy.dyingTimer > 0.55) continue;
      if (enemy.x + enemy.w < camX - 160 || enemy.x > camX + worldViewW + 160) continue;
      drawArticulatedGhost(ctx, sprites, enemy, enemy.x, enemy.y, time);
    }

    // 10. Boss Entity
    if (scene.boss && scene.boss.active && (!scene.boss.defeated || scene.boss.defeatTimer < 1.4)) {
      drawArticulatedBoss(ctx, sprites, scene.boss, scene.boss.x, scene.boss.y, time);
    }

    // 11. Hero
    drawArticulatedHero(ctx, sprites, scene.player, scene.character, time, {
      screenX: scene.player.x,
      screenY: scene.player.y,
    });

    // Hero dynamic glow stamp
    {
      const hCfg = HERO_CONFIG[scene.character];
      const hx = scene.player.x + scene.player.w * 0.5;
      const hy = scene.player.y + scene.player.h * 0.5;
      const glow = getGlowStamp(hCfg.primaryColor);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.22;
      ctx.drawImage(glow, hx - 120, hy - 120, 240, 240);
      ctx.restore();
    }
  }

  // 12. Projectiles
  for (const proj of scene.projectiles) {
    if (proj.x < camX - 100 || proj.x > camX + worldViewW + 100) continue;
    drawProjectile3D(ctx, sprites, proj, time);
  }

  // 13. Shockwave Rings (batched in a single composite state switch)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const ring of scene.rings) {
    if (!ring.active) continue;
    ctx.globalAlpha = ring.alpha;
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = ring.lineWidth;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // 14. Pooled Particles (two batched passes: non-glow smoke, then additive glow sparks/stars)
  const cullMinX = camX - 60;
  const cullMaxX = camX + worldViewW + 60;
  ctx.save();
  for (const p of scene.particles) {
    if (!p.active || p.glow || p.x < cullMinX || p.x > cullMaxX) continue;
    ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const p of scene.particles) {
    if (!p.active || !p.glow || p.x < cullMinX || p.x > cullMaxX) continue;
    ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
    ctx.fillStyle = p.color;
    if (p.kind === 'star') {
      drawFourPointStar(ctx, p.x, p.y, p.size * 1.4, p.size * 0.45);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // 15. Floating Popups
  for (const ft of scene.floatingTexts) {
    if (!ft.active) continue;
    const progress = 1 - ft.life / ft.maxLife;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - progress * progress);
    ctx.font = `800 ${Math.round(18 * ft.scale)}px "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(4, 5, 10, 0.9)';
    ctx.strokeText(ft.text, ft.x, ft.y);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }

  ctx.restore(); // end world transform

  // 16. Foreground Mist & Fireflies
  drawMistLayer(ctx, worldViewW, camX * 1.18, GROUND_Y - 34, 86, time * 1.3, level.fogColor, 0.72);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = level.accentColor;
  for (const m of scene.ambientMotes) {
    const mx = ((m.x - camX * 0.85) % (worldViewW + 120) + (worldViewW + 120)) % (worldViewW + 120) - 60;
    const my = m.y + Math.sin(time * 2.1 + m.phase) * 14;
    const pulse = 0.45 + 0.55 * Math.sin(time * 3.4 + m.phase * 2);
    ctx.globalAlpha = pulse * 0.68;
    ctx.beginPath();
    ctx.arc(mx, my, m.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 17. Cached Vignette + Low-HP Pulse
  ctx.drawImage(getVignetteCanvas(worldViewW), 0, 0);

  if (scene.gameState === 'playing' && scene.player.hp <= 2 && scene.player.hp > 0) {
    const pulse = 0.14 + Math.sin(time * 6.5) * 0.08;
    ctx.fillStyle = `rgba(185, 28, 28, ${pulse.toFixed(3)})`;
    ctx.fillRect(0, 0, worldViewW, 18);
    ctx.fillRect(0, WORLD_HEIGHT - 18, worldViewW, 18);
    ctx.fillRect(0, 0, 18, WORLD_HEIGHT);
    ctx.fillRect(worldViewW - 18, 0, 18, WORLD_HEIGHT);
  }

  ctx.restore();
}

function findGroundBelow(x: number, y: number, platforms: Platform[]): number {
  let best = GROUND_Y;
  for (let i = 0; i < platforms.length; i++) {
    const p = platforms[i];
    if (x >= p.x && x <= p.x + p.w && p.y >= y - 6 && p.y < best) {
      best = p.y;
    }
  }
  return best;
}

function drawContactShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  alpha: number
): void {
  const stamp = getShadowStamp();
  ctx.save();
  ctx.globalAlpha = Math.max(0.1, Math.min(0.85, alpha));
  ctx.drawImage(stamp, x - rx, y - rx * 0.28, rx * 2, rx * 0.62);
  ctx.restore();
}

function drawPlatform3D(ctx: CanvasRenderingContext2D, plat: Platform, level: LevelConfig): void {
  if (plat.kind === 'ground') {
    ctx.fillStyle = level.groundBodyColor;
    ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
    ctx.fillStyle = level.groundTopColor;
    ctx.fillRect(plat.x, plat.y, plat.w, 16);
    ctx.fillStyle = 'rgba(255, 238, 204, 0.18)';
    ctx.fillRect(plat.x, plat.y, plat.w, 3);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(plat.x, plat.y + 15, plat.w, 4);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 2;
    const startSlab = Math.floor(plat.x / 140) * 140;
    for (let sx = startSlab; sx < plat.x + plat.w; sx += 140) {
      ctx.beginPath();
      ctx.moveTo(sx, plat.y + 2);
      ctx.lineTo(sx - 8, plat.y + 38);
      ctx.stroke();
    }
    return;
  }

  const topCol =
    plat.kind === 'temple' ? '#58433a' : plat.kind === 'wood' ? '#4a3525' : '#404558';
  const bodyCol =
    plat.kind === 'temple' ? '#241818' : plat.kind === 'wood' ? '#221710' : '#181b26';

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(plat.x + 6, plat.y + 8, plat.w, plat.h);

  ctx.fillStyle = bodyCol;
  ctx.beginPath();
  ctx.roundRect(plat.x, plat.y, plat.w, plat.h, 6);
  ctx.fill();

  ctx.fillStyle = topCol;
  ctx.fillRect(plat.x + 2, plat.y, plat.w - 4, 10);

  ctx.fillStyle = 'rgba(255, 240, 210, 0.22)';
  ctx.fillRect(plat.x + 4, plat.y + 1, plat.w - 8, 3);
  ctx.strokeStyle = level.accentColor;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(plat.x + 2, plat.y + 2, plat.w - 4, plat.h - 4);
  ctx.restore();
}

function drawTorchProp(ctx: CanvasRenderingContext2D, torch: TorchProp, time: number): void {
  const flicker = 0.88 + Math.sin(time * 13 + torch.x * 0.1) * 0.08;
  ctx.fillStyle = '#231b16';
  ctx.fillRect(torch.x - 4, torch.y, 8, GROUND_Y - torch.y);
  ctx.fillStyle = '#5c4330';
  ctx.fillRect(torch.x - 7, torch.y - 6, 14, 10);

  const stamp = getGlowStamp(torch.color);
  const r = torch.radius * 0.85 * flicker;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.55;
  ctx.drawImage(stamp, torch.x - r, torch.y - 12 - r, r * 2, r * 2);

  ctx.globalAlpha = 0.95;
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.ellipse(torch.x + Math.sin(time * 15 + torch.x) * 1.5, torch.y - 15, 6 * flicker, 11 * flicker, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCheckpointShrine(
  ctx: CanvasRenderingContext2D,
  cp: CheckpointProp,
  time: number,
  accentColor: string
): void {
  const baseX = cp.x;
  const baseY = cp.y;
  ctx.fillStyle = '#2c2735';
  ctx.fillRect(baseX - 16, baseY - 14, 32, 14);
  ctx.fillStyle = '#1d1924';
  ctx.fillRect(baseX - 10, baseY - 82, 20, 68);
  ctx.fillStyle = '#473d54';
  ctx.beginPath();
  ctx.moveTo(baseX - 18, baseY - 82);
  ctx.lineTo(baseX, baseY - 104);
  ctx.lineTo(baseX + 18, baseY - 82);
  ctx.closePath();
  ctx.fill();

  if (cp.activated) {
    const stamp = getGlowStamp(accentColor);
    const pulse = 68 * (0.85 + Math.sin(time * 6) * 0.15);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.85;
    ctx.drawImage(stamp, baseX - pulse, baseY - 64 - pulse, pulse * 2, pulse * 2);
    ctx.restore();
  } else {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    ctx.arc(baseX, baseY - 62, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawArenaBarrier(
  ctx: CanvasRenderingContext2D,
  x: number,
  time: number,
  accentColor: string
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = accentColor;
  ctx.globalAlpha = 0.25 + Math.sin(time * 7) * 0.1;
  ctx.fillRect(x - 6, 60, 12, GROUND_Y - 60);
  ctx.restore();
}

function drawPickup(
  ctx: CanvasRenderingContext2D,
  sprites: SpriteBank,
  item: Pickup,
  time: number
): void {
  const bob = Math.sin(time * 3.8 + item.bobOffset) * 5;
  const px = item.x;
  const py = item.y + bob;
  const size = item.kind === 'star' || item.kind === 'power_orb' ? 40 : item.kind === 'potion' || item.kind === 'crystal' ? 36 : 30;

  const glowColor =
    item.kind === 'potion'
      ? '#fb7185'
      : item.kind === 'power_orb'
        ? '#38bdf8'
        : item.kind === 'crystal'
          ? '#c084fc'
          : '#facc15';

  const stamp = getGlowStamp(glowColor);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.42;
  ctx.drawImage(stamp, px - size * 0.75, py - size * 0.75, size * 1.5, size * 1.5);
  ctx.restore();

  const url = ITEM_ASSETS[item.kind];
  const entry = sprites.get(url);
  if (entry.loaded) {
    ctx.drawImage(entry.img, px - size * 0.5, py - size * 0.5, size, size);
  }
}

function drawProjectile3D(
  ctx: CanvasRenderingContext2D,
  sprites: SpriteBank,
  proj: Projectile,
  time: number
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  if (proj.trail.length > 1) {
    for (let i = 1; i < proj.trail.length; i++) {
      const t = i / proj.trail.length;
      ctx.strokeStyle = proj.color;
      ctx.globalAlpha = t * 0.55;
      ctx.lineWidth = proj.radius * 1.15 * t;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(proj.trail[i - 1].x, proj.trail[i - 1].y);
      ctx.lineTo(proj.trail[i].x, proj.trail[i].y);
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 0.92;
  const stamp = getGlowStamp(proj.color);
  const bloomR = proj.radius * 2.4;
  ctx.drawImage(stamp, proj.x - bloomR, proj.y - bloomR, bloomR * 2, bloomR * 2);

  ctx.globalAlpha = 1;
  if (proj.kind === 'star_blast') {
    const entry = sprites.get(ITEM_ASSETS.magic_star_blast);
    if (entry.loaded) {
      const frame = Math.floor(time * 18) % 4;
      const fw = entry.img.naturalWidth / 4;
      const fh = entry.img.naturalHeight;
      const sz = proj.radius * 3.1;
      ctx.translate(proj.x, proj.y);
      ctx.rotate(time * 9);
      ctx.drawImage(entry.img, frame * fw, 0, fw, fh, -sz * 0.5, -sz * 0.5, sz, sz);
    } else {
      ctx.fillStyle = '#ffffff';
      drawFourPointStar(ctx, proj.x, proj.y, proj.radius * 1.4, proj.radius * 0.5);
    }
  } else if (proj.kind === 'thunder_blast') {
    const entry = sprites.get(ITEM_ASSETS.thunder_blue_blast);
    if (entry.loaded) {
      const frame = Math.floor(time * 22) % 4;
      const fw = entry.img.naturalWidth / 4;
      const fh = entry.img.naturalHeight;
      const sz = proj.radius * 3.3;
      ctx.translate(proj.x, proj.y);
      if (proj.vx < 0) ctx.scale(-1, 1);
      ctx.drawImage(entry.img, frame * fw, 0, fw, fh, -sz * 0.5, -sz * 0.5, sz, sz);
    }
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + time * 18;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * proj.radius * 1.3, Math.sin(a) * proj.radius * 1.3);
    }
    ctx.stroke();
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawMistLayer(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  offsetX: number,
  baseY: number,
  height: number,
  time: number,
  color: string,
  alpha: number
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, baseY + height);
  for (let x = 0; x <= viewW + 90; x += 90) {
    const wave =
      Math.sin((x + offsetX) * 0.008 + time * 0.75) * 14 +
      Math.cos((x + offsetX * 0.6) * 0.014 - time * 0.5) * 9;
    ctx.lineTo(x, baseY + wave);
  }
  ctx.lineTo(viewW + 90, baseY + height);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawFourPointStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  outerR: number,
  innerR: number
): void {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i * Math.PI) / 4;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

export function getBossPortraitUrl(bossKind: keyof typeof BOSS_ARCHETYPES): string {
  return BOSS_ARCHETYPES[bossKind].portraitUrl;
}
