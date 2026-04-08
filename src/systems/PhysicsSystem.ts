import * as THREE from 'three';
import { PLATFORMS, PlatformDef, GRAVITY, LAVA_Y, GROUND_Y } from '../types';

export interface PhysicsBody {
  position: THREE.Vector3;
  velocityY: number;
  onGround: boolean;
}

/**
 * PhysicsSystem — manual AABB physics (Phase 0).
 * Will be replaced by Rapier in Phase 1 without touching any entity code.
 */
export class PhysicsSystem {
  private readonly platforms: PlatformDef[];

  constructor(platforms: PlatformDef[] = PLATFORMS) {
    this.platforms = platforms;
  }

  /**
   * Step one body forward by deltaTime.
   * Returns true if the body fell below LAVA_Y.
   */
  step(body: PhysicsBody, deltaTime: number): boolean {
    body.velocityY -= GRAVITY * deltaTime;
    body.position.y += body.velocityY * deltaTime;
    body.onGround = false;

    // Lava kill-plane
    if (body.position.y < LAVA_Y) return true;

    // Lava surface bounce (eggs rest here)
    if (body.position.y < GROUND_Y) {
      body.position.y = GROUND_Y;
      body.velocityY  = 0;
      body.onGround   = true;
      return false;
    }

    // Platform collision (land on top only, from above)
    for (const p of this.platforms) {
      const halfW = p.w + 0.5;  // add half-body-radius margin
      const halfD = p.d + 0.5;
      const top   = p.y + p.h;

      if (
        body.velocityY < 0 &&
        body.position.y <= top + 0.1 &&
        body.position.y >= top - Math.abs(body.velocityY * deltaTime) - 0.1 &&
        Math.abs(body.position.x - p.x) < halfW &&
        Math.abs(body.position.z - p.z) < halfD
      ) {
        body.position.y = top;
        body.velocityY  = 0;
        body.onGround   = true;
        break;
      }
    }

    return false;
  }

  /** Reset a body to a spawn position. */
  static respawn(body: PhysicsBody, x: number, y: number, z: number) {
    body.position.set(x, y, z);
    body.velocityY = 0;
    body.onGround  = false;
  }
}
