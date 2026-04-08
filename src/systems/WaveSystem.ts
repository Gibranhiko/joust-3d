import { WAVE_TABLE, SPAWN_POSITIONS, WaveDef } from '../types';

export type WaveState = 'active' | 'grace' | 'spawning';

/**
 * WaveSystem — tracks wave number, spawning, and grace period.
 */
export class WaveSystem {
  private _wave = 1;
  private _state: WaveState = 'active';
  private graceTimer = 0;
  private readonly GRACE_DURATION = 3; // seconds

  get wave()  { return this._wave; }
  get state() { return this._state; }

  get config(): WaveDef {
    const idx = Math.min(this._wave - 1, WAVE_TABLE.length - 1);
    return WAVE_TABLE[idx];
  }

  get enemyCount() { return this.config.count; }

  /**
   * Call each frame. Returns true on the frame a new wave should begin.
   */
  update(deltaTime: number, activeEnemyCount: number): boolean {
    if (this._state === 'active') {
      if (activeEnemyCount === 0) {
        this._state   = 'grace';
        this.graceTimer = this.GRACE_DURATION;
      }
    } else if (this._state === 'grace') {
      this.graceTimer -= deltaTime;
      if (this.graceTimer <= 0) {
        this._wave++;
        this._state = 'spawning';
        return true; // signal GameScene to spawn
      }
    }
    return false;
  }

  /** Called by GameScene after spawning is complete. */
  markActive() {
    this._state = 'active';
  }

  /** Ordered spawn positions for this wave (wraps around if > 8 enemies). */
  spawnPositions(count: number) {
    return Array.from({ length: count }, (_, i) =>
      SPAWN_POSITIONS[i % SPAWN_POSITIONS.length]
    );
  }

  get graceSecondsLeft() { return Math.max(0, Math.ceil(this.graceTimer)); }
}
