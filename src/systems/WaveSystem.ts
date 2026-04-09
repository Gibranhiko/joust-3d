import { WAVE_TABLE, SPAWN_POSITIONS, WaveDef, EnemyType } from '../types';

export type WaveState = 'active' | 'grace' | 'spawning';

export interface SpawnOrder {
  type: EnemyType;
  position: { x: number; y: number; z: number };
  delay: number; // seconds after wave start before this enemy appears
}

export class WaveSystem {
  private _wave = 1;
  private _state: WaveState = 'active';
  private graceTimer = 0;
  private readonly GRACE_DURATION = 3;

  get wave()  { return this._wave; }
  get state() { return this._state; }

  get config(): WaveDef {
    const idx = Math.min(this._wave - 1, WAVE_TABLE.length - 1);
    return WAVE_TABLE[idx];
  }

  get enemyCount() { return this.config.count; }

  /** True if a pterodactyl should appear in this wave. */
  get hasPterodactyl() { return this.config.pterodactyl; }

  /**
   * Call each frame. Returns true the frame a new wave should spawn.
   */
  update(dt: number, activeEnemyCount: number): boolean {
    if (this._state === 'active') {
      if (activeEnemyCount === 0) {
        this._state   = 'grace';
        this.graceTimer = this.GRACE_DURATION;
      }
    } else if (this._state === 'grace') {
      this.graceTimer -= dt;
      if (this.graceTimer <= 0) {
        this._wave++;
        this._state = 'spawning';
        return true;
      }
    }
    return false;
  }

  markActive() { this._state = 'active'; }

  get graceSecondsLeft() { return Math.max(0, Math.ceil(this.graceTimer)); }

  /**
   * Returns a staggered spawn list for the current wave.
   * Each entry has: type, position, and how many seconds after wave start to spawn.
   */
  buildSpawnOrders(): SpawnOrder[] {
    const cfg    = this.config;
    const delay  = cfg.spawnDelay;
    const orders: SpawnOrder[] = [];

    for (let i = 0; i < cfg.count; i++) {
      orders.push({
        type:     cfg.types[i % cfg.types.length],
        position: SPAWN_POSITIONS[i % SPAWN_POSITIONS.length],
        delay:    i * delay,
      });
    }
    return orders;
  }

  /** Single spawn position — used for egg-respawn. */
  spawnPositions(count: number) {
    return Array.from({ length: count }, (_, i) =>
      SPAWN_POSITIONS[i % SPAWN_POSITIONS.length]
    );
  }
}
