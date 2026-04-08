import * as THREE from 'three';
import type { RigidBodyHandle } from '../types';
import type { Rider } from './Rider';

export class Egg {
  readonly mesh: THREE.Mesh;
  readonly owner: Rider;

  /** Alias to mesh.position — PhysicsSystem writes here after each step. */
  position: THREE.Vector3;

  /** Set by PhysicsSystem.registerEgg(). */
  rapierBody: RigidBodyHandle | null = null;

  private _collected = false;
  private rollAngle = 0;

  constructor(scene: THREE.Scene, spawnPos: THREE.Vector3, owner: Rider) {
    this.owner = owner;

    const geo = new THREE.SphereGeometry(0.38, 10, 10);
    geo.scale(0.85, 1.1, 0.85); // slightly egg-shaped
    const mat = new THREE.MeshLambertMaterial({ color: 0xf9e547 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(spawnPos);
    this.mesh.castShadow = true;
    this.position = this.mesh.position;

    scene.add(this.mesh);
  }

  get collected() {
    return this._collected;
  }

  /**
   * Animate rolling when on ground.
   * Physics (gravity, bounce) is handled by PhysicsSystem / Rapier.
   * Returns true if the egg has fallen below the lava kill plane.
   */
  update(_deltaTime: number): boolean {
    if (this._collected) return false;

    // Roll animation when near ground
    if (this.position.y <= -4.4) {
      this.rollAngle += 2 * _deltaTime;
      this.mesh.rotation.z = this.rollAngle;
    }

    return false; // lava check is done by PhysicsSystem.isInLava() in GameScene
  }

  collect() {
    this._collected = true;
  }

  removeFromScene(scene: THREE.Scene) {
    scene.remove(this.mesh);
  }
}
