import * as THREE from 'three';

/**
 * Pterodactyl — special unkillable enemy that patrols a fixed figure-8 path.
 * Only vulnerable during its open-mouth window (VULNERABLE_DURATION seconds
 * every CYCLE_DURATION seconds). Killing it during that window grants bonus points.
 *
 * Phase 2 note: swap buildGeometry() with a GLTF load when models are ready.
 */

const CYCLE_DURATION    = 6;    // seconds per full circuit before mouth opens
const VULNERABLE_DURATION = 1.5; // seconds the mouth is open (can be jousted)
const FLIGHT_RADIUS     = 14;   // horizontal radius of figure-8 path
const FLIGHT_HEIGHT     = 8;    // base Y altitude
const FLIGHT_SPEED      = 1.1;  // path speed multiplier

export class Pterodactyl {
  readonly group: THREE.Group;
  position: THREE.Vector3;    // alias to group.position

  private body!: THREE.Mesh;
  private jaw!:  THREE.Mesh;  // animated lower jaw
  private leftWing!: THREE.Mesh;
  private rightWing!: THREE.Mesh;

  private cycleTimer   = 0;
  private pathAngle    = 0;
  private _vulnerable  = false;
  private _dead        = false;

  /** Score granted when killed during the vulnerable window. */
  static readonly KILL_SCORE = 250;

  constructor(scene: THREE.Scene, startAngle = 0) {
    this.group   = new THREE.Group();
    this.position = this.group.position;
    this.pathAngle = startAngle;

    this.buildGeometry();
    this.syncPathPosition();
    scene.add(this.group);
  }

  get vulnerable() { return this._vulnerable; }
  get dead()       { return this._dead; }

  // ── Geometry ──────────────────────────────────────────────────────────────

  private buildGeometry() {
    // Body — elongated dark capsule
    const bodyGeo = new THREE.CapsuleGeometry(0.4, 1.6, 6, 8);
    this.body = new THREE.Mesh(bodyGeo, new THREE.MeshLambertMaterial({ color: 0x2c3e50 }));
    this.body.rotation.z = Math.PI / 2; // horizontal
    this.body.castShadow = true;

    // Head
    const headGeo = new THREE.SphereGeometry(0.32, 8, 8);
    const head    = new THREE.Mesh(headGeo, new THREE.MeshLambertMaterial({ color: 0x2c3e50 }));
    head.position.set(1.1, 0.1, 0);

    // Upper jaw / beak — flat elongated box
    const upperJawGeo = new THREE.BoxGeometry(0.8, 0.08, 0.2);
    const upperJaw    = new THREE.Mesh(upperJawGeo, new THREE.MeshLambertMaterial({ color: 0xc0392b }));
    upperJaw.position.set(1.5, 0.12, 0);

    // Lower jaw — pivots open
    const lowerJawGeo = new THREE.BoxGeometry(0.7, 0.08, 0.2);
    this.jaw = new THREE.Mesh(lowerJawGeo, new THREE.MeshLambertMaterial({ color: 0xe74c3c }));
    this.jaw.position.set(1.5, 0.04, 0);
    this.jaw.rotation.z = 0; // closed

    // Crest
    const crestGeo = new THREE.ConeGeometry(0.12, 0.5, 5);
    const crest    = new THREE.Mesh(crestGeo, new THREE.MeshLambertMaterial({ color: 0xe74c3c }));
    crest.position.set(0.9, 0.4, 0);
    crest.rotation.z = -Math.PI / 6;

    // Wings — large flat boxes
    const wingGeo = new THREE.BoxGeometry(2.2, 0.06, 0.7);
    const wingMat = new THREE.MeshLambertMaterial({ color: 0x34495e });
    this.leftWing  = new THREE.Mesh(wingGeo, wingMat);
    this.rightWing = new THREE.Mesh(wingGeo, wingMat);
    this.leftWing.position.set(-0.2,  0, -1.4);
    this.rightWing.position.set(-0.2, 0,  1.4);
    this.leftWing.castShadow  = true;
    this.rightWing.castShadow = true;

    // Eye — small glowing sphere
    const eyeGeo = new THREE.SphereGeometry(0.07, 6, 6);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1.5 });
    const eye    = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(1.1, 0.15, 0.2);

    this.group.add(
      this.body, head, upperJaw, this.jaw, crest,
      this.leftWing, this.rightWing, eye
    );
  }

  // ── Update ────────────────────────────────────────────────────────────────

  update(dt: number) {
    if (this._dead) return;

    this.cycleTimer += dt;
    this.pathAngle  += dt * FLIGHT_SPEED;

    // Determine vulnerability window
    const phase = this.cycleTimer % (CYCLE_DURATION + VULNERABLE_DURATION);
    this._vulnerable = phase >= CYCLE_DURATION;

    this.animateWings(dt);
    this.animateJaw(dt);
    this.syncPathPosition();

    // Face direction of travel
    const nextAngle = this.pathAngle + 0.05;
    const nx = Math.sin(nextAngle * 2) * FLIGHT_RADIUS;
    const nz = Math.cos(nextAngle)     * FLIGHT_RADIUS;
    const dx = nx - this.group.position.x;
    const dz = nz - this.group.position.z;
    if (Math.abs(dx) + Math.abs(dz) > 0.01) {
      this.group.rotation.y = Math.atan2(dx, dz);
    }
  }

  private _wingAngle = 0;
  private animateWings(dt: number) {
    this._wingAngle += dt * 4;
    const flap = Math.sin(this._wingAngle) * 0.45;
    this.leftWing.rotation.x  =  flap;
    this.rightWing.rotation.x = -flap;
  }

  private animateJaw(dt: number) {
    const targetAngle = this._vulnerable ? -0.5 : 0; // open when vulnerable
    this.jaw.rotation.z = THREE.MathUtils.lerp(this.jaw.rotation.z, targetAngle, dt * 6);
  }

  private syncPathPosition() {
    // Figure-8 path: lemniscate of Bernoulli
    const t = this.pathAngle;
    this.group.position.x = Math.sin(t * 2) * FLIGHT_RADIUS;
    this.group.position.y = FLIGHT_HEIGHT + Math.sin(t * 3) * 2;
    this.group.position.z = Math.cos(t)     * FLIGHT_RADIUS;
  }

  /** Call when player jousts the pterodactyl while vulnerable. */
  kill() {
    this._dead = true;
  }

  removeFromScene(scene: THREE.Scene) {
    scene.remove(this.group);
  }

  /** Bounding-sphere collision check with player. */
  distanceTo(pos: THREE.Vector3): number {
    return this.group.position.distanceTo(pos);
  }
}
