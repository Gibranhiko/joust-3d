import * as THREE from 'three';
import type { RigidBodyHandle } from '../types';

/**
 * Rider — base class for Player and Enemy.
 * Owns the Three.js group. PhysicsSystem drives position/velocity externally.
 */
export class Rider {
  readonly group: THREE.Group;
  readonly isEnemy: boolean;

  /** Alias for group.position — PhysicsSystem writes here after each step. */
  position: THREE.Vector3;

  /** Set by PhysicsSystem each frame from Rapier linvel().y. */
  velocityY = 0;
  /** Set by PhysicsSystem each frame via downward raycast. */
  onGround = false;

  /** Set by PhysicsSystem.registerRider(). Used by flap/move/teleport. */
  rapierBody: RigidBodyHandle | null = null;

  isEgged = false;
  isDead = false;

  protected body!: THREE.Mesh;
  protected head!: THREE.Mesh;
  protected leftWing!: THREE.Mesh;
  protected rightWing!: THREE.Mesh;
  protected leftLeg!: THREE.Mesh;
  protected rightLeg!: THREE.Mesh;

  private isFlapping = false;
  private flapTimer = 0;
  private flapAngle = 0;
  private legAngle = 0;

  constructor(scene: THREE.Scene, pos: { x: number; y: number; z: number }, isEnemy: boolean) {
    this.isEnemy = isEnemy;
    this.group = new THREE.Group();
    this.position = this.group.position; // shared reference

    this.buildGeometry();
    this.group.position.set(pos.x, pos.y, pos.z);
    scene.add(this.group);
  }

  private buildGeometry() {
    const color = this.isEnemy ? 0xe74c3c : 0x3498db;

    // Body
    const bodyGeo = new THREE.CylinderGeometry(0.45, 0.55, 1.8, 10);
    this.body = new THREE.Mesh(bodyGeo, new THREE.MeshLambertMaterial({ color }));
    this.body.position.y = 0.5;
    this.body.castShadow = true;

    // Head
    const headGeo = new THREE.SphereGeometry(0.28, 10, 10);
    this.head = new THREE.Mesh(headGeo, new THREE.MeshLambertMaterial({ color: 0xffdbac }));
    this.head.position.y = 1.65;
    this.head.castShadow = true;

    // Beak
    const beakGeo = new THREE.ConeGeometry(0.07, 0.35, 6);
    const beak = new THREE.Mesh(beakGeo, new THREE.MeshLambertMaterial({ color: 0xffa500 }));
    beak.rotation.x = -Math.PI / 2;
    beak.position.set(0, 0, 0.3);
    this.head.add(beak);

    // Wings
    const wingGeo = new THREE.BoxGeometry(1.1, 0.08, 0.55);
    const wingMat = new THREE.MeshLambertMaterial({
      color: this.isEnemy ? 0x922b21 : 0x1a5276,
    });
    this.leftWing = new THREE.Mesh(wingGeo, wingMat);
    this.rightWing = new THREE.Mesh(wingGeo, wingMat);
    this.leftWing.position.set(-0.85, 0.6, 0);
    this.rightWing.position.set(0.85, 0.6, 0);
    this.leftWing.castShadow = true;
    this.rightWing.castShadow = true;

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.9, 6);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x795548 });
    this.leftLeg = new THREE.Mesh(legGeo, legMat);
    this.rightLeg = new THREE.Mesh(legGeo, legMat);
    this.leftLeg.position.set(-0.25, -0.85, 0);
    this.rightLeg.position.set(0.25, -0.85, 0);

    // Lance
    const lanceGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6);
    const lance = new THREE.Mesh(
      lanceGeo,
      new THREE.MeshLambertMaterial({ color: 0xbdc3c7 })
    );
    lance.rotation.x = -Math.PI / 2;
    lance.position.set(this.isEnemy ? -0.4 : 0.4, 0.5, 0.9);

    this.group.add(
      this.body, this.head, this.leftWing, this.rightWing,
      this.leftLeg, this.rightLeg, lance
    );
  }

  /**
   * Trigger flap animation. PhysicsSystem.applyFlap() handles the actual
   * impulse — GameScene calls both when the player presses Space.
   */
  triggerFlapAnim() {
    if (this.isEgged || this.isDead) return;
    this.isFlapping = true;
    this.flapTimer = 0.45;
  }

  /** Move horizontally — delegates to PhysicsSystem.moveHorizontal() via GameScene/AISystem. */
  move(dx: number, dz: number) {
    if (this.isEgged || this.isDead || !this.rapierBody) return;
    this.rapierBody.setTranslation(
      {
        x: this.rapierBody.translation().x + dx,
        y: this.rapierBody.translation().y,
        z: this.rapierBody.translation().z + dz,
      },
      true
    );
  }

  /** Called every frame by GameScene after the physics step. */
  animate(deltaTime: number) {
    if (this.isFlapping) {
      this.flapTimer -= deltaTime;
      this.flapAngle += 18 * deltaTime;
      const flap = Math.sin(this.flapAngle) * 0.7;
      this.leftWing.rotation.z = flap;
      this.rightWing.rotation.z = -flap;
      if (this.flapTimer <= 0) {
        this.isFlapping = false;
        this.leftWing.rotation.z = 0;
        this.rightWing.rotation.z = 0;
      }
    }

    if (this.onGround) {
      this.legAngle += 5 * deltaTime;
      const swing = Math.sin(this.legAngle) * 0.35;
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
    } else {
      this.leftLeg.rotation.x = 0;
      this.rightLeg.rotation.x = 0;
    }

    // Lean into lateral movement direction
    this.group.rotation.z = THREE.MathUtils.lerp(
      this.group.rotation.z,
      -this.group.position.x * 0.015,
      0.1
    );
  }

  toEgg() {
    this.isEgged = true;
    this.group.visible = false;
    this.rapierBody?.setEnabled(false);
  }

  fromEgg(x: number, y: number, z: number) {
    this.isEgged = false;
    this.isDead = false;
    this.group.visible = true;
    if (this.rapierBody) {
      this.rapierBody.setEnabled(true);
      this.rapierBody.setTranslation({ x, y, z }, true);
      this.rapierBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
      this.rapierBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
    } else {
      this.group.position.set(x, y, z);
    }
  }

  removeFromScene(scene: THREE.Scene) {
    scene.remove(this.group);
  }
}
