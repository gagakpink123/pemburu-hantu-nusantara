export type CharacterId = 'nadhira' | 'narendra';

export type GameState = 'title' | 'playing' | 'paused' | 'gameover';

export type ModalType =
  | 'none'
  | 'level_select'
  | 'settings'
  | 'how_to_play'
  | 'credits'
  | 'pause'
  | 'level_complete'
  | 'game_over'
  | 'final_victory';

export type GhostType =
  | 'pocong'
  | 'kuntilanak'
  | 'tuyul'
  | 'genderuwo'
  | 'suster_ngesot'
  | 'wewe_gombel'
  | 'leak'
  | 'hantu_bayangan';

export type BossType =
  | 'raja_pocong'
  | 'ratu_kuntilanak'
  | 'genderuwo_penunggu'
  | 'ratu_leak'
  | 'penunggu_kerajaan_gaib';

export type FacingDirection = 'front' | 'back' | 'right' | 'left';

export type SpiritAnimState = 'idle' | 'walk' | 'run' | 'jump' | 'attack' | 'hurt' | 'defeat';

export type ActorAnimState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'fall'
  | 'land'
  | 'shoot'
  | 'hurt'
  | 'celebrate'
  | 'defeat';

export type EnemyPolicy =
  | 'hopper'
  | 'hover_dive'
  | 'thief_sprint'
  | 'heavy_charge'
  | 'crawl_surge'
  | 'stalker_claw'
  | 'ranged_orb'
  | 'shadow_blink';

export type PickupKind = 'coin' | 'star' | 'potion' | 'crystal' | 'power_orb' | 'chest' | 'key';

export interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'ground' | 'stone' | 'wood' | 'temple';
}

export interface TorchProp {
  x: number;
  y: number;
  color: string;
  radius: number;
  kind: 'obor' | 'lentera' | 'dupa' | 'kristal';
}

export interface CheckpointProp {
  x: number;
  y: number;
  activated: boolean;
}

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  facing: 1 | -1;
  facingDir: FacingDirection;
  grounded: boolean;
  coyoteTimer: number;
  jumpBufferTimer: number;
  jumpsRemaining: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  dashTimer: number;
  dashCooldown: number;
  dashDir: 1 | -1;
  shootCooldown: number;
  shootAnimTimer: number;
  invulnTimer: number;
  hitFlashTimer: number;
  powerBoostTimer: number;
  animState: ActorAnimState;
  idleTimer: number;
  gaitDist: number;
  scaleX: number;
  scaleY: number;
  landTimer: number;
  spawnX: number;
  spawnY: number;
  afterimages: Array<{ x: number; y: number; facing: 1 | -1; facingDir: FacingDirection; alpha: number }>;
}

export interface EnemyEntity {
  id: number;
  kind: GhostType;
  name: string;
  policy: EnemyPolicy;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  facing: 1 | -1;
  facingDir: FacingDirection;
  animState: SpiritAnimState;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  scoreValue: number;
  grounded: boolean;
  aiPhase: 'patrol' | 'windup' | 'attack' | 'recover' | 'flee';
  aiTimer: number;
  hitFlashTimer: number;
  dyingTimer: number;
  dead: boolean;
  animTime: number;
  gaitDist: number;
  scaleX: number;
  scaleY: number;
  patrolOriginX: number;
  patrolRange: number;
  stolenCoins: number;
  hasAttackToken: boolean;
  afterimageX: number;
  afterimageY: number;
  afterimageAlpha: number;
}

export interface BossEntity {
  kind: BossType;
  name: string;
  title: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  facing: 1 | -1;
  facingDir: FacingDirection;
  animState: SpiritAnimState;
  hp: number;
  maxHp: number;
  ghostHp: number;
  phase: 1 | 2 | 3;
  aiState: 'intro' | 'stalk' | 'windup' | 'attack' | 'recover' | 'defeated';
  attackPattern: 'charge' | 'barrage' | 'summon' | 'slam';
  aiTimer: number;
  hitFlashTimer: number;
  defeatTimer: number;
  active: boolean;
  defeated: boolean;
  animTime: number;
  scaleX: number;
  scaleY: number;
  homeX: number;
  homeY: number;
}

export interface Projectile {
  id: number;
  fromPlayer: boolean;
  characterId?: CharacterId;
  kind: 'star_blast' | 'thunder_blast' | 'spirit_orb' | 'fire_skull' | 'shadow_lance';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number;
  maxLife: number;
  pierce: number;
  color: string;
  glowColor: string;
  trail: Array<{ x: number; y: number }>;
}

export interface Pickup {
  id: number;
  kind: PickupKind;
  x: number;
  y: number;
  vy: number;
  bobOffset: number;
  collected: boolean;
  magnetized: boolean;
}

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  color: string;
  glow: boolean;
  gravity: number;
  kind: 'spark' | 'ember' | 'smoke' | 'star' | 'blood' | 'ring';
}

export interface ShockwaveRing {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
  lineWidth: number;
}

export interface FloatingText {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export interface LevelConfig {
  id: number;
  slug: string;
  name: string;
  subtitle: string;
  bgUrl: string;
  bgmKey: 'bgm_level_1' | 'bgm_level_2' | 'bgm_level_3' | 'bgm_level_4' | 'bgm_level_5';
  ambientTint: string;
  fogColor: string;
  moonColor: string;
  groundTopColor: string;
  groundBodyColor: string;
  accentColor: string;
  worldWidth: number;
  arenaStartX: number;
  bossType: BossType;
  ghostPool: GhostType[];
  spawnCount: number;
}

export interface SettingsData {
  bgmVolume: number;
  sfxVolume: number;
  muted: boolean;
  screenShake: boolean;
  showTouchControls: 'auto' | 'always' | 'off';
}

export interface LevelBestRecord {
  stars: number;
  bestScore: number;
  bestTimeSec: number;
}

export interface SaveData {
  selectedCharacter: CharacterId;
  unlockedLevel: number;
  totalCoins: number;
  highScore: number;
  records: Record<number, LevelBestRecord>;
  settings: SettingsData;
}

export interface HudSnapshot {
  gameState: GameState;
  modal: ModalType;
  character: CharacterId;
  levelId: number;
  levelName: string;
  levelSubtitle: string;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  score: number;
  bestScore: number;
  coins: number;
  starsCollected: number;
  starsTotal: number;
  crystals: number;
  combo: number;
  comboTimer: number;
  progressPct: number;
  elapsedSec: number;
  damageTaken: number;
  ghostsDefeated: number;
  powerBoostTimer: number;
  dashReadyPct: number;
  boss: {
    active: boolean;
    kind: BossType;
    name: string;
    title: string;
    hp: number;
    maxHp: number;
    ghostHp: number;
    phase: 1 | 2 | 3;
  } | null;
  muted: boolean;
  bannerText: string | null;
  endStats: {
    won: boolean;
    score: number;
    bestScore: number;
    clearTimeSec: number;
    coinsEarned: number;
    starsEarned: number;
    ghostsDefeated: number;
    damageTaken: number;
    bossHpRemainingPct: number;
    progressPct: number;
  } | null;
}
