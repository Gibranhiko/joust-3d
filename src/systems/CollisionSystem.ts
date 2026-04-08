import * as THREE from 'three';
import { COLLISION_DIST } from '../types';
import type { Rider } from '../entities/Rider';
import type { Egg }   from '../entities/Egg';

export type CollisionResult =
  | { type: 'none' }
  | { type: 'player_wins'; enemy: Rider }
  | { type: 'player_loses'; enemy: Rider }
  | { type: 'egg_collected'; egg: Egg; index: number };

/**
 * CollisionSystem — pure functions, no state.
 * Returns events that GameScene acts on.
 */
export class CollisionSystem {
  /**
   * Check player vs all active enemies.
   * Returns first collision found (one per frame is enough for Joust).
   */
  static checkJoust(player: Rider, enemies: Rider[]): CollisionResult {
    for (const enemy of enemies) {
      if (enemy.isEgged || enemy.isDead) continue;
      const dist = player.position.distanceTo(enemy.position);
      if (dist < COLLISION_DIST) {
        const yDiff = player.position.y - enemy.position.y;
        if (yDiff > 0.15) return { type: 'player_wins', enemy };
        if (yDiff < -0.15) return { type: 'player_loses', enemy };
        // Dead-even: both lose — handled by calling twice
        return { type: 'player_loses', enemy };
      }
    }
    return { type: 'none' };
  }

  /**
   * Check player proximity to eggs.
   */
  static checkEggPickup(
    playerPos: THREE.Vector3,
    eggs: Egg[],
    radius = 1.0
  ): { egg: Egg; index: number } | null {
    for (let i = 0; i < eggs.length; i++) {
      if (playerPos.distanceTo(eggs[i].position) < radius) {
        return { egg: eggs[i], index: i };
      }
    }
    return null;
  }
}
