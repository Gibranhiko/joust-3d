// ─── Shared constants ────────────────────────────────────────────────────────

export const GRAVITY        = 22;   // units / s²
export const FLAP_FORCE     = 11;   // upward velocity added per flap
export const PLAYER_SPEED   = 7;    // lateral units / s
export const ENEMY_SPEED    = 4;    // lateral units / s
export const LAVA_Y         = -6;   // below this = instant death
export const GROUND_Y       = -5;   // lava surface the egg bounces on
export const COLLISION_DIST = 1.4;  // distance that triggers a joust

// ─── Platform layout (shared by PhysicsSystem and scene builder) ─────────────

export interface PlatformDef {
  x: number;
  y: number;
  z: number;
  w: number;   // half-width  (X extent)
  d: number;   // half-depth  (Z extent)
  h: number;   // thickness
}

export const PLATFORMS: PlatformDef[] = [
  { x:  0,   y:  0, z:  0,   w: 5,  d: 5,  h: 0.4 },   // centre ground
  { x:  10,  y:  4, z:  10,  w: 4,  d: 4,  h: 0.4 },   // right-far high
  { x: -10,  y:  2, z:  5,   w: 4,  d: 4,  h: 0.4 },   // left mid
  { x:  5,   y:  7, z: -8,   w: 3,  d: 3,  h: 0.4 },   // right-near top
  { x: -6,   y:  3, z: -10,  w: 4,  d: 4,  h: 0.4 },   // left-far mid
  { x:  0,   y:  9, z:  0,   w: 3,  d: 3,  h: 0.4 },   // centre apex
];

// ─── Wave config ──────────────────────────────────────────────────────────────

export interface WaveDef {
  count: number;
  speed: number;   // multiplier on ENEMY_SPEED
  flapChance: number; // probability per frame of random flap
}

export const WAVE_TABLE: WaveDef[] = [
  { count: 2, speed: 0.7,  flapChance: 0.008 },
  { count: 3, speed: 0.85, flapChance: 0.012 },
  { count: 4, speed: 1.0,  flapChance: 0.016 },
  { count: 5, speed: 1.1,  flapChance: 0.020 },
  { count: 6, speed: 1.2,  flapChance: 0.025 },
  { count: 6, speed: 1.35, flapChance: 0.030 },
  { count: 7, speed: 1.5,  flapChance: 0.035 },
  { count: 8, speed: 1.6,  flapChance: 0.040 },
];

// Spawn positions for enemies (world-space, above platforms)
export const SPAWN_POSITIONS = [
  { x:  10, y: 6,  z:  10 },
  { x: -10, y: 4,  z:   5 },
  { x:   5, y: 9,  z:  -8 },
  { x:  -6, y: 5,  z: -10 },
  { x:  12, y: 2,  z:  -3 },
  { x:  -3, y: 11, z:   2 },
  { x:   8, y: 2,  z:   5 },
  { x:  -8, y: 2,  z:  -5 },
];
