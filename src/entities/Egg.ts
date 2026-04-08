import * as THREE from 'three';
import { GRAVITY, GROUND_Y, LAVA_Y } from '../types';
import type { PhysicsBody } from '../systems/PhysicsSystem';
import type { Rider }       from './Rider';

export class Egg implements PhysicsBody {
  readonly mesh:    THREE.Mesh;
  readonly owner:   Rider;
  position:         THREE.Vector3; // alias to mesh.position
  velocityY         = 2;           // small upward pop when spawned
  onGround          = false;

  private readonly bounceFactor = 0.55;
  private rollAngle             = 0;
  private _collected            = false;

  constructor(scene: THREE.Scene, spawnPos: THREE.Vector3, owner: Rider) {
    this.owner = owner;

    const geo = new THREE.SphereGeometry(0.38, 10, 10);
    geo.scale(0.85, 1.1, 0.85); // slightly egg-shaped
    const mat = new THREE.MeshLambertMaterial({ color: 0xf9e547 });
    this.mesh  = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(spawnPos);
    this.mesh.castShadow = true;
    this.position = this.mesh.position;

    scene.add(this.mesh);
  }

  get collected() { return this._collected; }

  update(deltaTime: number): boolean {
    if (this._collected) return false;

    this.velocityY -= GRAVITY * deltaTime;
    this.mesh.position.y += this.velocityY * deltaTime;
    this.onGround = false;

    if (this.mesh.position.y < LAVA_Y) {
      return true; // fell into lava — remove
    }

    if (this.mesh.position.y <= GROUND_Y) {
      this.mesh.position.y = GROUND_Y;
      this.velocityY = -this.velocityY * this.bounceFactor;
      if (Math.abs(this.velocityY) < 0.5) this.velocityY = 0;
      this.onGround = true;
    }

    // Roll when on ground
    if (this.onGround) {
      this.rollAngle += 2 * deltaTime;
      this.mesh.rotation.z = this.rollAngle;
    }

    return false;
  }

  collect() {
    this._collected = true;
  }

  removeFromScene(scene: THREE.Scene) {
    scene.remove(this.mesh);
  }
}
