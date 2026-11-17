import {
  sampleBossSheetFrame,
  sampleGhostSheetFrame,
  sampleHeroSheetFrame,
  type SpriteSheetMeta,
} from './animation';
import { BOSS_ARCHETYPES, GHOST_ARCHETYPES, HERO_CONFIG } from './constants';
import type { BossEntity, BossType, CharacterId, EnemyEntity, GhostType, PlayerState } from './types';

export interface SpriteEntry {
  img: HTMLImageElement;
  flashCanvas: HTMLCanvasElement | null;
  flashTried: boolean;
  loaded: boolean;
}

export class SpriteBank {
  private cache = new Map<string, SpriteEntry>();

  public get(url: string): SpriteEntry {
    const existing = this.cache.get(url);
    if (existing) return existing;

    const img = new Image();
    img.decoding = 'async';
    const entry: SpriteEntry = { img, flashCanvas: null, flashTried: false, loaded: false };
    this.cache.set(url, entry);

    img.onload = () => {
      entry.loaded = true;
    };
    img.src = url;
    return entry;
  }

  public getFlashCanvas(entry: SpriteEntry): HTMLCanvasElement | null {
    if (!entry.loaded) return null;
    if (!entry.flashTried) {
      entry.flashTried = true;
      entry.flashCanvas = buildWhiteFlashSilhouette(entry.img);
    }
    return entry.flashCanvas;
  }

  public size(): number {
    return this.cache.size;
  }

  public pruneUnused(keepUrls: Iterable<string>): number {
    const keep = keepUrls instanceof Set ? keepUrls : new Set(keepUrls);
    let evicted = 0;
    for (const [url, entry] of this.cache.entries()) {
      if (keep.has(url)) continue;
      entry.img.onload = null;
      entry.img.src = '';
      if (entry.flashCanvas) {
        entry.flashCanvas.width = 0;
        entry.flashCanvas.height = 0;
        entry.flashCanvas = null;
      }
      this.cache.delete(url);
      evicted++;
    }
    return evicted;
  }

  public preloadForLevel(
    character: CharacterId,
    enemyKinds: GhostType[],
    bossKind: BossType,
    extraUrls: string[] = []
  ): void {
    const hero = HERO_CONFIG[character];
    this.get(hero.spriteUrl);
    this.get(hero.sheet.sheetUrl);
    this.get(HERO_CONFIG.nadhira.portraitUrl);
    this.get(HERO_CONFIG.narendra.portraitUrl);
    for (const kind of enemyKinds) {
      const g = GHOST_ARCHETYPES[kind];
      if (!g) continue;
      this.get(g.spriteUrl);
      this.get(g.sheet.sheetUrl);
    }
    const b = BOSS_ARCHETYPES[bossKind];
    if (b) {
      this.get(b.spriteUrl);
      this.get(b.sheet.sheetUrl);
    }
    for (const u of extraUrls) {
      this.get(u);
    }
  }

  public preloadAll(extraUrls: string[] = []): void {
    this.get(HERO_CONFIG.nadhira.spriteUrl);
    this.get(HERO_CONFIG.narendra.spriteUrl);
    this.get(HERO_CONFIG.nadhira.portraitUrl);
    this.get(HERO_CONFIG.narendra.portraitUrl);
    this.get(HERO_CONFIG.nadhira.sheet.sheetUrl);
    this.get(HERO_CONFIG.narendra.sheet.sheetUrl);
    for (const g of Object.values(GHOST_ARCHETYPES)) {
      this.get(g.spriteUrl);
      this.get(g.sheet.sheetUrl);
    }
    for (const b of Object.values(BOSS_ARCHETYPES)) {
      this.get(b.spriteUrl);
      this.get(b.sheet.sheetUrl);
    }
    for (const u of extraUrls) {
      this.get(u);
    }
  }
}

function buildWhiteFlashSilhouette(img: HTMLImageElement): HTMLCanvasElement | null {
  try {
    const rawW = img.naturalWidth || img.width;
    const rawH = img.naturalHeight || img.height;
    const scale = rawW > 1024 ? 0.25 : rawW > 512 ? 0.5 : 1;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(rawW * scale));
    c.height = Math.max(1, Math.round(rawH * scale));
    const g = c.getContext('2d');
    if (!g) return null;
    g.drawImage(img, 0, 0, c.width, c.height);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(255, 255, 255, 0.92)';
    g.fillRect(0, 0, c.width, c.height);
    return c;
  } catch {
    return null;
  }
}

const auraStampCache = new Map<string, HTMLCanvasElement>();

function drawCachedAura(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha = 0.55
): void {
  let stamp = auraStampCache.get(color);
  if (!stamp) {
    stamp = document.createElement('canvas');
    stamp.width = 96;
    stamp.height = 96;
    const g = stamp.getContext('2d');
    if (g) {
      const grad = g.createRadialGradient(48, 48, 4, 48, 48, 48);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 96, 96);
    }
    auraStampCache.set(color, stamp);
  }
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(stamp, x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

/**
 * Draws a specific (row, col) frame from a baked 24x14 multi-directional sprite sheet,
 * anchoring the character's feet cleanly onto the current canvas origin (0, 0).
 */
function drawSheetFrame(
  ctx: CanvasRenderingContext2D,
  source: HTMLImageElement | HTMLCanvasElement,
  sheet: SpriteSheetMeta,
  row: number,
  col: number,
  targetDrawH: number
): void {
  const srcRatio =
    source instanceof HTMLCanvasElement ? source.width / (sheet.frameW * sheet.cols) : 1;
  const sw = sheet.frameW * srcRatio;
  const sh = sheet.frameH * srcRatio;
  const sx = col * sw;
  const sy = row * sh;
  const scale = targetDrawH / sheet.drawH;
  const cellDrawW = sheet.frameW * scale;
  const cellDrawH = sheet.frameH * scale;
  const footInset = sheet.anchorBottomPx * scale;

  ctx.drawImage(
    source,
    sx,
    sy,
    sw,
    sh,
    -cellDrawW * 0.5,
    -cellDrawH + footInset,
    cellDrawW,
    cellDrawH
  );
}

/**
 * Draws a 3D-rendered Hero (Nadhira or Narendra) using 4-direction x 7-state x 12-frame sprite sheets
 * stepped at >= 10 FPS (10-14 FPS per state) with squash & stretch, dash afterimages, hit flash, and casting magic vortex.
 */
export function drawArticulatedHero(
  ctx: CanvasRenderingContext2D,
  sprites: SpriteBank,
  player: PlayerState,
  character: CharacterId,
  time: number,
  options: { screenX: number; screenY: number; scale?: number; alpha?: number }
): void {
  const cfg = HERO_CONFIG[character];
  const sheetEntry = sprites.get(cfg.sheet.sheetUrl);
  const fallbackEntry = sprites.get(cfg.spriteUrl);
  const useSheet = sheetEntry.loaded;
  if (!useSheet && !fallbackEntry.loaded) return;

  const renderScale = options.scale ?? 1;
  const targetH = player.h * 1.15 * renderScale;
  const cx = options.screenX + player.w * 0.5 * renderScale;
  const footY = options.screenY + player.h * renderScale;

  const sampled = sampleHeroSheetFrame(player.animState, player.facingDir, time, {
    shootAnimTimer: player.animState === 'shoot' ? player.shootAnimTimer : undefined,
    colsPerDir: cfg.sheet.colsPerDir,
  });

  // Invulnerability blink
  if (player.invulnTimer > 0 && Math.floor(time * 22) % 2 === 1 && player.hitFlashTimer <= 0) {
    ctx.globalAlpha = (options.alpha ?? 1) * 0.45;
  } else {
    ctx.globalAlpha = options.alpha ?? 1;
  }

  // Draw afterimages when dashing or power-boosted using the exact directional animation frame
  for (const ghost of player.afterimages) {
    ctx.save();
    ctx.globalAlpha = ghost.alpha * 0.35;
    const gx = options.screenX + (ghost.x - player.x) + player.w * 0.5;
    const gy = options.screenY + (ghost.y - player.y) + player.h;
    ctx.translate(gx, gy);
    if (useSheet) {
      const ghostSampled = sampleHeroSheetFrame(player.animState, ghost.facingDir, time, {
        colsPerDir: cfg.sheet.colsPerDir,
      });
      drawSheetFrame(ctx, sheetEntry.img, cfg.sheet, ghostSampled.row, ghostSampled.col, targetH);
    } else {
      ctx.scale(ghost.facing, 1);
      const fW = targetH * (fallbackEntry.img.naturalWidth / fallbackEntry.img.naturalHeight);
      ctx.drawImage(fallbackEntry.img, -fW * 0.5, -targetH, fW, targetH);
    }
    ctx.restore();
  }

  ctx.save();
  ctx.translate(cx, footY);

  // Subtle arcane aura behind hero
  const auraPulse = 0.85 + Math.sin(time * 4.2) * 0.15;
  drawCachedAura(
    ctx,
    0,
    -targetH * 0.52,
    targetH * 0.72 * auraPulse,
    player.powerBoostTimer > 0 ? '#facc15' : cfg.primaryColor,
    player.powerBoostTimer > 0 ? 0.38 : 0.24
  );

  // Apply squash & stretch directly (no horizontal flip on 4-direction sheets!)
  if (useSheet) {
    ctx.scale(player.scaleX, player.scaleY);
    const flash = player.hitFlashTimer > 0 ? sprites.getFlashCanvas(sheetEntry) : null;
    const source = flash ?? sheetEntry.img;
    drawSheetFrame(ctx, source, cfg.sheet, sampled.row, sampled.col, targetH);
  } else {
    ctx.scale(player.facing * player.scaleX, player.scaleY);
    const flash = player.hitFlashTimer > 0 ? sprites.getFlashCanvas(fallbackEntry) : null;
    const source = flash ?? fallbackEntry.img;
    const fW = targetH * (fallbackEntry.img.naturalWidth / fallbackEntry.img.naturalHeight);
    ctx.drawImage(source, -fW * 0.5, -targetH, fW, targetH);
  }

  // Foreground Casting Hand Magic Vortex when shooting
  if (player.shootAnimTimer > 0) {
    const castT = player.shootAnimTimer / 0.18;
    const handX =
      player.facingDir === 'right'
        ? player.w * 0.56
        : player.facingDir === 'left'
          ? -player.w * 0.56
          : player.facingDir === 'front'
            ? 0
            : player.facing * player.w * 0.28;
    const handY = player.facingDir === 'front' ? -targetH * 0.45 : -targetH * 0.5;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawCachedAura(ctx, handX, handY, 26 * castT + 10, cfg.primaryColor, 0.9);

    ctx.translate(handX, handY);
    ctx.rotate(time * 14);
    ctx.strokeStyle = cfg.secondaryColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      ctx.moveTo(Math.cos(a) * -14 * castT, Math.sin(a) * -14 * castT);
      ctx.lineTo(Math.cos(a) * 14 * castT, Math.sin(a) * 14 * castT);
    }
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

/**
 * Draws an Indonesian Ghost (8 archetypes) using 4-direction x 7-state x 12-frame sprite sheets
 * stepped at >= 10 FPS with telegraph flares and KO dissolve.
 */
export function drawArticulatedGhost(
  ctx: CanvasRenderingContext2D,
  sprites: SpriteBank,
  enemy: EnemyEntity,
  screenX: number,
  screenY: number,
  time: number
): void {
  const arch = GHOST_ARCHETYPES[enemy.kind];
  const sheetEntry = sprites.get(arch.sheet.sheetUrl);
  const fallbackEntry = sprites.get(arch.spriteUrl);
  const useSheet = sheetEntry.loaded;
  if (!useSheet && !fallbackEntry.loaded) return;

  const targetH = enemy.h * 1.08;
  const cx = screenX + enemy.w * 0.5;
  const footY = screenY + enemy.h;

  const sampled = sampleGhostSheetFrame(
    enemy.animState,
    enemy.facingDir,
    enemy.animTime,
    arch.sheet.colsPerDir,
    enemy.dead ? enemy.dyingTimer : undefined
  );

  // KO dissolve fade & rise
  let alpha = 1;
  let dissolveLift = 0;
  let koTilt = 0;
  if (enemy.dead) {
    const t = Math.min(1, enemy.dyingTimer / 0.55);
    alpha = Math.max(0, 1 - Math.pow(t, 1.4));
    dissolveLift = -t * 24;
    koTilt = -enemy.facing * t * 0.16;
  }

  // Smoky afterimage for Hantu Bayangan & diving Kuntilanak
  if (enemy.afterimageAlpha > 0.02 && !enemy.dead) {
    ctx.save();
    ctx.globalAlpha = enemy.afterimageAlpha * 0.38;
    const ax = cx + (enemy.afterimageX - enemy.x);
    const ay = footY + (enemy.afterimageY - enemy.y);
    ctx.translate(ax, ay);
    if (useSheet) {
      drawSheetFrame(ctx, sheetEntry.img, arch.sheet, sampled.row, sampled.col, targetH);
    } else {
      ctx.scale(enemy.facing, 1);
      const fW = targetH * (fallbackEntry.img.naturalWidth / fallbackEntry.img.naturalHeight);
      ctx.drawImage(fallbackEntry.img, -fW * 0.5, -targetH, fW, targetH);
    }
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, footY + dissolveLift);

  // Windup ground telegraph ring for heavy/dangerous attacks
  if (enemy.aiPhase === 'windup' && !enemy.dead) {
    const pulse = 0.65 + Math.sin(time * 24) * 0.35;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = arch.eyeColor;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.72 * pulse;
    ctx.beginPath();
    ctx.ellipse(0, -4, enemy.w * 0.65, 11, 0, 0, Math.PI * 2);
    ctx.stroke();

    drawCachedAura(ctx, 0, -targetH * 0.5, targetH * 0.75, arch.auraColor, 0.85);
    ctx.restore();
  }

  // Subtle spirit aura behind entity
  if (!enemy.dead) {
    drawCachedAura(ctx, 0, -targetH * 0.52, targetH * 0.65, arch.auraColor, 0.65);
  }

  if (useSheet) {
    ctx.scale(enemy.scaleX, enemy.scaleY);
    if (koTilt !== 0) ctx.rotate(koTilt);
    const flash = enemy.hitFlashTimer > 0 ? sprites.getFlashCanvas(sheetEntry) : null;
    const source = flash ?? sheetEntry.img;
    drawSheetFrame(ctx, source, arch.sheet, sampled.row, sampled.col, targetH);
  } else {
    ctx.scale(enemy.facing * enemy.scaleX, enemy.scaleY);
    if (koTilt !== 0) ctx.rotate(koTilt);
    const flash = enemy.hitFlashTimer > 0 ? sprites.getFlashCanvas(fallbackEntry) : null;
    const source = flash ?? fallbackEntry.img;
    const fW = targetH * (fallbackEntry.img.naturalWidth / fallbackEntry.img.naturalHeight);
    ctx.drawImage(source, -fW * 0.5, -targetH, fW, targetH);
  }

  // Glowing horror eye flares during windup/attack (hidden when facing away)
  if ((enemy.aiPhase === 'windup' || enemy.aiPhase === 'attack') && !enemy.dead && enemy.facingDir !== 'back') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = arch.eyeColor;
    const eyeY = enemy.kind === 'suster_ngesot' ? -targetH * 0.66 : -targetH * 0.82;
    const eyeSpread = enemy.facingDir === 'front' ? 7 : 5;
    const eyeX =
      enemy.facingDir === 'front'
        ? 0
        : enemy.facing * (enemy.kind === 'suster_ngesot' ? enemy.w * 0.14 : enemy.w * 0.08);
    ctx.beginPath();
    ctx.arc(eyeX - eyeSpread, eyeY, 4.2, 0, Math.PI * 2);
    ctx.arc(eyeX + eyeSpread, eyeY, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();

  // Floating miniature HP bar above injured enemies
  if (enemy.hp < enemy.maxHp && !enemy.dead) {
    const barW = Math.max(46, enemy.w * 0.72);
    const bx = cx - barW * 0.5;
    const by = screenY - 14;
    const ratio = Math.max(0, enemy.hp / enemy.maxHp);
    ctx.fillStyle = 'rgba(6, 6, 12, 0.85)';
    ctx.fillRect(bx - 1, by - 1, barW + 2, 7);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(bx, by, barW * ratio, 5);
  }
}

/**
 * Draws the Level Boss using 4-direction x 7-state x 12-frame sprite sheets stepped at
 * >= 10 FPS with multi-ring rage aura & telegraph flares.
 */
export function drawArticulatedBoss(
  ctx: CanvasRenderingContext2D,
  sprites: SpriteBank,
  boss: BossEntity,
  screenX: number,
  screenY: number,
  time: number
): void {
  const arch = BOSS_ARCHETYPES[boss.kind];
  const sheetEntry = sprites.get(arch.sheet.sheetUrl);
  const fallbackEntry = sprites.get(arch.spriteUrl);
  const useSheet = sheetEntry.loaded;
  if (!useSheet && !fallbackEntry.loaded) return;

  const targetH = boss.h * 1.08;
  const cx = screenX + boss.w * 0.5;
  const footY = screenY + boss.h;
  const sampled = sampleBossSheetFrame(
    boss.animState,
    boss.facingDir,
    boss.animTime,
    arch.sheet.colsPerDir,
    boss.defeated ? boss.defeatTimer : undefined
  );

  ctx.save();
  if (boss.defeated) {
    const t = Math.min(1, boss.defeatTimer / 1.4);
    ctx.globalAlpha = Math.max(0, 1 - Math.pow(t, 1.5));
    ctx.translate(cx, footY - t * 30);
    ctx.rotate(t * 0.15);
  } else {
    ctx.translate(cx, footY);
  }

  // Multi-ring Boss Spectral Aura
  const rageBoost = boss.phase === 3 ? 1.35 : boss.phase === 2 ? 1.15 : 1;
  const auraR = targetH * 0.68 * rageBoost * (0.94 + Math.sin(time * 4.5) * 0.06);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  drawCachedAura(ctx, 0, -targetH * 0.5, auraR, arch.auraColor, boss.phase >= 2 ? 0.9 : 0.72);

  // Telegraph ring during Boss windup
  if (boss.aiState === 'windup' && !boss.defeated) {
    const pulse = 0.6 + Math.sin(time * 22) * 0.4;
    ctx.strokeStyle = arch.projectileColor;
    ctx.lineWidth = 3.5;
    ctx.globalAlpha = 0.85 * pulse;
    ctx.beginPath();
    ctx.ellipse(0, -8, boss.w * 0.78, 18, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  if (useSheet) {
    ctx.scale(boss.scaleX, boss.scaleY);
    const flash = boss.hitFlashTimer > 0 ? sprites.getFlashCanvas(sheetEntry) : null;
    const source = flash ?? sheetEntry.img;
    drawSheetFrame(ctx, source, arch.sheet, sampled.row, sampled.col, targetH);
  } else {
    ctx.scale(boss.facing * boss.scaleX, boss.scaleY);
    const flash = boss.hitFlashTimer > 0 ? sprites.getFlashCanvas(fallbackEntry) : null;
    const source = flash ?? fallbackEntry.img;
    const fW = targetH * (fallbackEntry.img.naturalWidth / fallbackEntry.img.naturalHeight);
    ctx.drawImage(source, -fW * 0.5, -targetH, fW, targetH);
  }

  ctx.restore();
}
