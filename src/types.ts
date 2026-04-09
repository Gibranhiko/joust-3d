// ─── Rapier rigid body handle (structural interface — avoids importing WASM in entities) ──

export interface RigidBodyHandle {
  translation(): { x: number; y: number; z: number };
  linvel(): { x: number; y: number; z: number };
  setLinvel(v: { x: number; y: number; z: number }, wakeUp: boolean): void;
  setTranslation(v: { x: number; y: number; z: number }, wakeUp: boolean): void;
  setAngvel(v: { x: number; y: number; z: number }, wakeUp: boolean): void;
  setEnabled(enabled: boolean): void;
}

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
  { x:  0,   y:  0, z:  0,   w: 7,  d: 7,  h: 0.4 },   // centre ground
  { x:  10,  y:  4, z:  10,  w: 6,  d: 6,  h: 0.4 },   // right-far high
  { x: -10,  y:  2, z:  5,   w: 6,  d: 6,  h: 0.4 },   // left mid
  { x:  5,   y:  7, z: -8,   w: 5,  d: 5,  h: 0.4 },   // right-near top
  { x: -6,   y:  3, z: -10,  w: 6,  d: 6,  h: 0.4 },   // left-far mid
  { x:  0,   y:  9, z:  0,   w: 5,  d: 5,  h: 0.4 },   // centre apex
];

// ─── Enemy types ──────────────────────────────────────────────────────────────

/**
 * Bounder  — slow, predictable. Mostly patrols. Default early-game enemy.
 * Hunter   — tracks player aggressively, flaps frequently, tries altitude advantage.
 * Shadow   — fast, attacks immediately, evades rarely (high risk/reward).
 */
export type EnemyType = 'bounder' | 'hunter' | 'shadow';

export interface EnemyTypeDef {
  speedMult: number;      // multiplier on wave base speed
  flapMult: number;       // multiplier on wave flapChance
  aggroRange: number;     // distance at which it leaves patrol
  attackRange: number;    // distance at which it dives (ATTACK state)
  reactionTime: number;   // seconds before state can change again
  color: number;          // body hex colour
  wingColor: number;      // wing hex colour
}

export const ENEMY_TYPE_DEFS: Record<EnemyType, EnemyTypeDef> = {
  bounder: {
    speedMult:    1.0,
    flapMult:     1.0,
    aggroRange:   10,
    attackRange:  4,
    reactionTime: 1.2,
    color:        0xe74c3c, // red
    wingColor:    0x922b21,
  },
  hunter: {
    speedMult:    1.3,
    flapMult:     2.0,
    aggroRange:   16,
    attackRange:  6,
    reactionTime: 0.6,
    color:        0x8e44ad, // purple
    wingColor:    0x6c3483,
  },
  shadow: {
    speedMult:    1.7,
    flapMult:     2.8,
    aggroRange:   20,
    attackRange:  8,
    reactionTime: 0.3,
    color:        0x1abc9c, // teal
    wingColor:    0x148f77,
  },
};

// ─── Wave config ──────────────────────────────────────────────────────────────

export interface WaveDef {
  count: number;
  types: EnemyType[];     // one entry per enemy slot; cycles if count > types.length
  speed: number;          // base lateral speed multiplier
  flapChance: number;     // base per-frame random-flap probability
  pterodactyl: boolean;   // spawn pterodactyl mid-wave
  spawnDelay: number;     // seconds between each enemy appearing (stagger)
}

export const WAVE_TABLE: WaveDef[] = [
  // Wave 1 — tutorial-friendly
  { count: 2, types: ['bounder','bounder'],                       speed: 0.70, flapChance: 0.008, pterodactyl: false, spawnDelay: 0.0 },
  // Wave 2
  { count: 3, types: ['bounder','bounder','bounder'],             speed: 0.85, flapChance: 0.012, pterodactyl: false, spawnDelay: 0.3 },
  // Wave 3 — first hunter
  { count: 3, types: ['bounder','bounder','hunter'],              speed: 0.90, flapChance: 0.015, pterodactyl: false, spawnDelay: 0.3 },
  // Wave 4
  { count: 4, types: ['bounder','hunter','bounder','hunter'],     speed: 1.00, flapChance: 0.018, pterodactyl: false, spawnDelay: 0.4 },
  // Wave 5 — pterodactyl first appearance
  { count: 4, types: ['hunter','hunter','bounder','bounder'],     speed: 1.05, flapChance: 0.022, pterodactyl: true,  spawnDelay: 0.4 },
  // Wave 6 — first shadow
  { count: 5, types: ['bounder','hunter','shadow','bounder','hunter'], speed: 1.15, flapChance: 0.026, pterodactyl: false, spawnDelay: 0.5 },
  // Wave 7
  { count: 5, types: ['hunter','shadow','hunter','bounder','shadow'],  speed: 1.25, flapChance: 0.030, pterodactyl: true,  spawnDelay: 0.5 },
  // Wave 8
  { count: 6, types: ['shadow','hunter','shadow','hunter','bounder','shadow'], speed: 1.35, flapChance: 0.034, pterodactyl: false, spawnDelay: 0.6 },
  // Wave 9
  { count: 6, types: ['shadow','shadow','hunter','shadow','hunter','shadow'],  speed: 1.45, flapChance: 0.038, pterodactyl: true,  spawnDelay: 0.6 },
  // Wave 10+  (repeats with full shadows)
  { count: 7, types: ['shadow','shadow','shadow','hunter','shadow','shadow','hunter'], speed: 1.55, flapChance: 0.042, pterodactyl: true,  spawnDelay: 0.7 },
  { count: 8, types: ['shadow','shadow','shadow','shadow','shadow','shadow','shadow','shadow'], speed: 1.65, flapChance: 0.046, pterodactyl: true,  spawnDelay: 0.8 },
  { count: 8, types: ['shadow','shadow','shadow','shadow','shadow','shadow','shadow','shadow'], speed: 1.80, flapChance: 0.050, pterodactyl: true,  spawnDelay: 0.9 },
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
