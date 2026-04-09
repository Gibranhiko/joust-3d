import * as THREE from 'three';
import type { RigidBodyHandle } from '../types';

/**
 * Rider — base class for Player and Enemy.
 *
 * Visual structure (two swappable sub-units):
 *
 *   [head]              ← sphere, skin colour
 *   [knightMesh / body] ← box, coloured by rider type (enemy type or player blue)
 *         sits on top of
 *   [ostrichMesh]       ← wide box, tan bird colour
 *   [leftWing][rightWing] ← flap on ostrich's sides
 *   [leftLeg][rightLeg]   ← beneath ostrich
 *
 * Both sub-units are direct children of `group` so that physics
 * (which drives group.position) remains a single rigid body.
 * Replace `ostrichMesh` and `body` (knightMesh) with GLTF objects in Phase 2.
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
  isDead  = false;

  // ── Ostrich sub-unit ──────────────────────────────────────────────────────
  /** Wide box representing the ostrich mount. Swap with GLTF in Phase 2. */
  protected ostrichMesh!: THREE.Mesh;
  protected leftWing!:    THREE.Mesh;
  protected rightWing!:   THREE.Mesh;
  protected leftLeg!:     THREE.Mesh;
  protected rightLeg!:    THREE.Mesh;

  // ── Knight sub-unit ───────────────────────────────────────────────────────
  /**
   * Box representing the knight torso. Coloured by rider/enemy type.
   * Aliased as `knightMesh` — swap with GLTF in Phase 2.
   * Named `body` to stay compatible with Enemy.ts colour recolouring.
   */
  protected body!: THREE.Mesh;   // knight torso — Enemy.ts recolours this
  protected head!: THREE.Mesh;

  // Kept for compatibility — not visually used anymore (beak is on head)
  private isFlapping = false;
  private flapTimer  = 0;
  private flapAngle  = 0;
  private legAngle   = 0;

  constructor(
    scene: THREE.Scene,
    pos: { x: number; y: number; z: number },
    isEnemy: boolean
  ) {
    this.isEnemy = isEnemy;
    this.group   = new THREE.Group();
    this.position = this.group.position; // shared reference

    this.buildGeometry();
    this.group.position.set(pos.x, pos.y, pos.z);
    scene.add(this.group);
  }

  // ── Geometry ──────────────────────────────────────────────────────────────

  private buildGeometry() {
    const riderColor = this.isEnemy ? 0xe74c3c : 0x3498db;
    const wingColor  = this.isEnemy ? 0x922b21 : 0x1a5276;

    // ── Ostrich body ────────────────────────────────────────────────────────
    // Wide, squat box — clearly a "mount" that the knight sits on top of.
    const ostrichGeo = new THREE.BoxGeometry(1.8, 1.0, 1.4);
    const ostrichMat = new THREE.MeshLambertMaterial({ color: 0xc8a46e }); // tan
    this.ostrichMesh = new THREE.Mesh(ostrichGeo, ostrichMat);
    this.ostrichMesh.position.y = 0.5;   // feet at y≈0, top at y≈1
    this.ostrichMesh.castShadow    = true;
    this.ostrichMesh.receiveShadow = true;

    // ── Wings ────────────────────────────────────────────────────────────────
    // Wide flat panels on the sides of the ostrich. Rotation around Z gives
    // the up/down flap. Centered at x=±1.5 so they hang off both sides.
    const wingGeo = new THREE.BoxGeometry(1.3, 0.1, 0.8);
    const wingMat = new THREE.MeshLambertMaterial({ color: wingColor });
    this.leftWing  = new THREE.Mesh(wingGeo, wingMat);
    this.rightWing = new THREE.Mesh(wingGeo, wingMat);
    this.leftWing.position.set(-1.55, 0.55, 0);
    this.rightWing.position.set( 1.55, 0.55, 0);
    this.leftWing.castShadow  = true;
    this.rightWing.castShadow = true;

    // ── Legs ─────────────────────────────────────────────────────────────────
    const legGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.7, 6);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x8b6914 });
    this.leftLeg  = new THREE.Mesh(legGeo, legMat);
    this.rightLeg = new THREE.Mesh(legGeo, legMat);
    this.leftLeg.position.set(-0.45,  0.0, 0.25);
    this.rightLeg.position.set( 0.45, 0.0, 0.25);

    // ── Knight torso ─────────────────────────────────────────────────────────
    // Upright box sitting on top of the ostrich. Coloured by rider type.
    const knightGeo = new THREE.BoxGeometry(0.72, 0.95, 0.52);
    const knightMat = new THREE.MeshLambertMaterial({ color: riderColor });
    this.body = new THREE.Mesh(knightGeo, knightMat);  // "body" keeps Enemy.ts working
    this.body.position.y = 1.45;   // rests on top of ostrich (ostrich top = 1.0)
    this.body.castShadow = true;

    // Shoulder pads (small boxes flanking the torso) for silhouette clarity
    const padGeo = new THREE.BoxGeometry(0.30, 0.25, 0.52);
    const padMat = new THREE.MeshLambertMaterial({ color: riderColor });
    const leftPad  = new THREE.Mesh(padGeo, padMat);
    const rightPad = new THREE.Mesh(padGeo, padMat);
    leftPad.position.set(-0.51, 1.55, 0);
    rightPad.position.set( 0.51, 1.55, 0);

    // ── Knight head ──────────────────────────────────────────────────────────
    const headGeo = new THREE.SphereGeometry(0.30, 10, 10);
    this.head = new THREE.Mesh(headGeo, new THREE.MeshLambertMaterial({ color: 0xffdbac }));
    this.head.position.y = 2.25;
    this.head.castShadow = true;

    // Helmet visor (flat box over the upper face)
    const helmetGeo = new THREE.BoxGeometry(0.66, 0.22, 0.56);
    const helmet    = new THREE.Mesh(helmetGeo, new THREE.MeshLambertMaterial({ color: riderColor }));
    helmet.position.y = 2.30;

    // Beak on head (direction indicator — faces forward / Z+)
    const beakGeo = new THREE.ConeGeometry(0.07, 0.32, 6);
    const beak    = new THREE.Mesh(beakGeo, new THREE.MeshLambertMaterial({ color: 0xffa500 }));
    beak.rotation.x = -Math.PI / 2;
    beak.position.set(0, 0, 0.32);
    this.head.add(beak);

    // ── Lance ────────────────────────────────────────────────────────────────
    const lanceGeo = new THREE.CylinderGeometry(0.045, 0.045, 2.0, 6);
    const lance    = new THREE.Mesh(lanceGeo, new THREE.MeshLambertMaterial({ color: 0xbdc3c7 }));
    lance.rotation.x = -Math.PI / 2;
    lance.position.set(this.isEnemy ? -0.4 : 0.4, 1.5, 1.1);

    this.group.add(
      // Ostrich unit
      this.ostrichMesh,
      this.leftWing, this.rightWing,
      this.leftLeg, this.rightLeg,
      // Knight unit
      this.body, leftPad, rightPad,
      helmet, this.head,
      lance
    );
  }

  // ── Public accessors for GLTF swap ────────────────────────────────────────

  /** The ostrich mount mesh. Replace with GLTF in Phase 2. */
  get ostrichNode(): THREE.Mesh { return this.ostrichMesh; }

  /** The knight torso mesh. Replace with GLTF in Phase 2. */
  get knightNode(): THREE.Mesh { return this.body; }

  // ── Animation ─────────────────────────────────────────────────────────────

  triggerFlapAnim() {
    if (this.isEgged || this.isDead) return;
    this.isFlapping = true;
    this.flapTimer  = 0.45;
    this.flapAngle  = 0;
  }

  animate(deltaTime: number) {
    if (this.isFlapping) {
      this.flapTimer -= deltaTime;
      this.flapAngle += 18 * deltaTime;
      const flap = Math.sin(this.flapAngle) * 0.75;
      this.leftWing.rotation.z  =  flap;
      this.rightWing.rotation.z = -flap;
      if (this.flapTimer <= 0) {
        this.isFlapping = false;
        this.leftWing.rotation.z  = 0;
        this.rightWing.rotation.z = 0;
      }
    }

    // Leg swing while on ground
    if (this.onGround) {
      this.legAngle += 5 * deltaTime;
      const swing = Math.sin(this.legAngle) * 0.35;
      this.leftLeg.rotation.x  =  swing;
      this.rightLeg.rotation.x = -swing;
    } else {
      this.leftLeg.rotation.x  = 0;
      this.rightLeg.rotation.x = 0;
    }

    // Gentle lean into lateral velocity
    this.group.rotation.z = THREE.MathUtils.lerp(
      this.group.rotation.z,
      -this.group.position.x * 0.015,
      0.1
    );
  }

  // ── Movement ──────────────────────────────────────────────────────────────

  move(dx: number, dz: number) {
    if (this.isEgged || this.isDead || !this.rapierBody) return;
    const t = this.rapierBody.translation();
    this.rapierBody.setTranslation({ x: t.x + dx, y: t.y, z: t.z + dz }, true);
  }

  // ── State ─────────────────────────────────────────────────────────────────

  toEgg() {
    this.isEgged = true;
    this.group.visible = false;
    this.rapierBody?.setEnabled(false);
  }

  fromEgg(x: number, y: number, z: number) {
    this.isEgged = false;
    this.isDead  = false;
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
