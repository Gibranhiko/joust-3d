import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { GRAVITY, LAVA_Y, GROUND_Y, RigidBodyHandle } from '../types';
import { activePlatforms as PLATFORMS } from '../platformLayout';
import type { Rider } from '../entities/Rider';
import type { Egg } from '../entities/Egg';

// ── Capsule dimensions ───────────────────────────────────────────────────────
// These approximate the rider's bounding volume for physics — intentionally
// smaller than the visual geometry so collisions feel tight, not bloated.
const CAPSULE_HALF_H = 0.7;
const CAPSULE_RADIUS = 0.35;

/** Distance from body origin to the bottom of the capsule (feet). */
const FOOT_OFFSET = CAPSULE_HALF_H + CAPSULE_RADIUS; // = 1.05

const FIXED_DT  = 1 / 60;
const MAX_STEPS = 5;

// ── Collision groups ─────────────────────────────────────────────────────────
// Encoded as: lower 16 bits = membership, upper 16 bits = filter.
// Two colliders interact when (A.membership & B.filter) !== 0
//                          && (B.membership & A.filter) !== 0.
const G_LAVA     = 0x0001;
const G_PLATFORM = 0x0002;
// const G_RIDER = 0x0004;   // (defined inline below for clarity)
const G_EGG      = 0x0008;

// Lava floor  — member: LAVA,     filter: RIDER | EGG
const GRP_LAVA     = G_LAVA     | (( 0x0004 | G_EGG) << 16);
// Platforms   — member: PLATFORM, filter: RIDER | EGG  (solid from all sides)
const GRP_PLATFORM = G_PLATFORM | (( 0x0004 | G_EGG) << 16);
// Rider capsule — member: RIDER,  filter: LAVA | PLATFORM
const GRP_RIDER    = 0x0004     | (( G_LAVA | G_PLATFORM) << 16);
// Egg ball    — member: EGG,      filter: LAVA | PLATFORM
const GRP_EGG      = G_EGG      | (( G_LAVA | G_PLATFORM) << 16);

// Raycast group for ground detection: detect LAVA + PLATFORM surfaces
const RAY_GROUPS_RIDER = 0x0004 | ((G_LAVA | G_PLATFORM) << 16);

// How far below the body origin to cast the "on ground?" ray
const GROUND_RAY_LEN = FOOT_OFFSET + 0.2;

/** Rider entry, tracks previous body-center Y for one-way platform detection. */
interface RiderEntry {
  rider: Rider;
  body:  RAPIER.RigidBody;
  prevY: number;
}

interface EggEntry {
  egg:  Egg;
  body: RAPIER.RigidBody;
}

export class PhysicsSystem {
  private world!:       RAPIER.World;
  private riders:       RiderEntry[] = [];
  private eggs:         EggEntry[]   = [];
  private accumulator = 0;

  // ── Static init ───────────────────────────────────────────────────────────

  static async initRapier(): Promise<void> {
    await RAPIER.init();
  }

  // ── Constructor ───────────────────────────────────────────────────────────

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 });
    this.buildStaticGeometry();
  }

  // ── Static geometry ───────────────────────────────────────────────────────

  private buildStaticGeometry() {
    // Lava floor — solid bounce surface for eggs; riders die on contact (checked separately)
    this.addStatic(
      0, GROUND_Y - 0.2, 0,
      60, 0.25, 60,
      { friction: 0.3, restitution: 0.0 },
      GRP_LAVA
    );

    // Platforms — only collide with eggs (riders use manual one-way detection)
    for (const p of PLATFORMS) {
      // Place physics slab at the visual top surface (y = p.y), half-height = p.h / 2.
      // This ensures eggs bounce off the top face at the same Y the rider lands on.
      this.addStatic(
        p.x, p.y - p.h / 2, p.z,
        p.w, p.h / 2, p.d,
        { friction: 1.5, restitution: 0.2 },
        GRP_PLATFORM
      );
    }
  }

  private addStatic(
    x: number, y: number, z: number,
    hw: number, hh: number, hd: number,
    mat: { friction: number; restitution: number },
    collisionGroups: number
  ) {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z)
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(hw, hh, hd)
        .setFriction(mat.friction)
        .setRestitution(mat.restitution)
        .setCollisionGroups(collisionGroups),
      body
    );
  }

  // ── Entity registration ───────────────────────────────────────────────────

  registerRider(rider: Rider) {
    const { x, y, z } = rider.group.position;
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .setAngularDamping(10.0)
        .setLinearDamping(0.8)
        .lockRotations()
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.capsule(CAPSULE_HALF_H, CAPSULE_RADIUS)
        .setFriction(0.1)
        .setRestitution(0.0)
        .setCollisionGroups(GRP_RIDER), // only interacts with lava floor
      body
    );
    rider.rapierBody = body as unknown as RigidBodyHandle;
    this.riders.push({ rider, body, prevY: y });
  }

  registerEgg(egg: Egg) {
    const { x, y, z } = egg.mesh.position;
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .setLinearDamping(0.1)
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.ball(0.38)
        .setFriction(0.3)
        .setRestitution(0.55)
        .setCollisionGroups(GRP_EGG), // bounces off lava and platforms
      body
    );
    body.setLinvel({ x: 0, y: 3, z: 0 }, true);
    egg.rapierBody = body as unknown as RigidBodyHandle;
    this.eggs.push({ egg, body });
  }

  removeEgg(egg: Egg) {
    const idx = this.eggs.findIndex(e => e.egg === egg);
    if (idx === -1) return;
    this.world.removeRigidBody(this.eggs[idx].body);
    this.eggs.splice(idx, 1);
    egg.rapierBody = null;
  }

  removeRider(rider: Rider) {
    const idx = this.riders.findIndex(r => r.rider === rider);
    if (idx === -1) return;
    this.world.removeRigidBody(this.riders[idx].body);
    this.riders.splice(idx, 1);
    rider.rapierBody = null;
  }

  // ── Per-frame controls ────────────────────────────────────────────────────

  applyDive(handle: RigidBodyHandle) {
    const body = handle as unknown as RAPIER.RigidBody;
    const vel  = body.linvel();
    // Accelerate downward each frame, cap at -28 units/sec
    body.setLinvel({ x: vel.x, y: Math.max(vel.y - 18, -28), z: vel.z }, true);
    body.wakeUp();
  }

  applyFlap(handle: RigidBodyHandle) {
    const body = handle as unknown as RAPIER.RigidBody;
    const vel  = body.linvel();
    body.setLinvel({ x: vel.x, y: Math.max(vel.y, 0) + 11, z: vel.z }, true);
    body.wakeUp();
  }

  moveHorizontal(handle: RigidBodyHandle, dx: number, dz: number) {
    const body = handle as unknown as RAPIER.RigidBody;
    const t    = body.translation();
    body.setTranslation({ x: t.x + dx, y: t.y, z: t.z + dz }, true);
    body.wakeUp();
  }

  teleport(handle: RigidBodyHandle, x: number, y: number, z: number) {
    const body = handle as unknown as RAPIER.RigidBody;
    body.setTranslation({ x, y, z }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    body.wakeUp();
  }

  setBodyEnabled(handle: RigidBodyHandle, enabled: boolean) {
    (handle as unknown as RAPIER.RigidBody).setEnabled(enabled);
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  isInLava(handle: RigidBodyHandle): boolean {
    return handle.translation().y <= LAVA_Y + 0.1;
  }

  /**
   * Returns true if the rider is standing on a surface.
   * Checks the lava floor via Rapier raycast (filtered to LAVA group only),
   * then checks all platforms manually using the foot position.
   */
  isOnGround(handle: RigidBodyHandle): boolean {
    const t = handle.translation();

    // Rapier raycast — only detects the lava floor (GRP_RIDER filter)
    const ray = new RAPIER.Ray({ x: t.x, y: t.y, z: t.z }, { x: 0, y: -1, z: 0 });
    const hit  = this.world.castRay(ray, GROUND_RAY_LEN, true, undefined, RAY_GROUPS_RIDER);
    if (hit !== null) return true;

    // Manual platform proximity check
    const footY = t.y - FOOT_OFFSET;
    for (const p of PLATFORMS) {
      if (t.x < p.x - p.w || t.x > p.x + p.w) continue;
      if (t.z < p.z - p.d || t.z > p.z + p.d) continue;
      if (footY >= p.y - 0.25 && footY <= p.y + 0.15) return true;
    }
    return false;
  }

  // ── One-way platform landing ──────────────────────────────────────────────

  /**
   * Called after each Rapier sub-step.
   * Implements one-way (top-only) platform collision for riders:
   * - Riders with upward velocity pass through freely.
   * - Riders crossing a platform top from above are snapped to the surface.
   * - Riders standing on a platform are held in place against gravity.
   */
  private handleOneWayPlatforms(entry: RiderEntry): void {
    const body = entry.body;
    if (!body.isEnabled()) return;

    const t   = body.translation();
    const vel = body.linvel();

    // Fast upward movement → pass through all platforms
    if (vel.y > 1.5) {
      entry.prevY = t.y;
      return;
    }

    const footY    = t.y - FOOT_OFFSET;
    const prevFoot = entry.prevY - FOOT_OFFSET;

    for (const p of PLATFORMS) {
      const platTop = p.y; // visual top surface, matches snap target

      // XZ overlap (include capsule radius margin so rider feet land on edges too)
      if (t.x < p.x - p.w - CAPSULE_RADIUS || t.x > p.x + p.w + CAPSULE_RADIUS) continue;
      if (t.z < p.z - p.d - CAPSULE_RADIUS || t.z > p.z + p.d + CAPSULE_RADIUS) continue;

      // ── Case 1: rider crossed from above into the platform this sub-step ──
      if (prevFoot >= platTop - 0.05 && footY < platTop && vel.y <= 1.0) {
        const snapY = platTop + FOOT_OFFSET;
        body.setTranslation({ x: t.x, y: snapY, z: t.z }, true);
        body.setLinvel({ x: vel.x, y: 0, z: vel.z }, true);
        body.wakeUp();
        entry.prevY = snapY;
        return;
      }

      // ── Case 2: rider is standing on platform — prevent gravity sinking ──
      if (footY >= platTop - 0.18 && footY < platTop + 0.12 && vel.y < 0) {
        const snapY = platTop + FOOT_OFFSET;
        body.setTranslation({ x: t.x, y: snapY, z: t.z }, true);
        body.setLinvel({ x: vel.x, y: 0, z: vel.z }, true);
        body.wakeUp();
        entry.prevY = snapY;
        return;
      }
    }

    entry.prevY = t.y;
  }

  // ── World step ────────────────────────────────────────────────────────────

  step(dt: number) {
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS) {
      this.world.step();
      this.accumulator -= FIXED_DT;
      steps++;
    }
    this.syncAll();
  }

  private syncAll() {
    for (const { rider, body } of this.riders) {
      if (!body.isEnabled()) continue;
      const t = body.translation();
      rider.group.position.set(t.x, t.y, t.z);
      rider.velocityY = body.linvel().y;
      rider.onGround  = this.isOnGround(body as unknown as RigidBodyHandle);
    }
    for (const { egg, body } of this.eggs) {
      if (!body.isEnabled()) continue;
      const t = body.translation();
      egg.mesh.position.set(t.x, t.y, t.z);
    }
  }

  // ── Arena boundary clamp ──────────────────────────────────────────────────

  clampToBounds(handle: RigidBodyHandle, min: THREE.Vector3, max: THREE.Vector3) {
    const t  = handle.translation();
    const cx = THREE.MathUtils.clamp(t.x, min.x, max.x);
    const cz = THREE.MathUtils.clamp(t.z, min.z, max.z);
    if (cx !== t.x || cz !== t.z) {
      (handle as unknown as RAPIER.RigidBody)
        .setTranslation({ x: cx, y: t.y, z: cz }, true);
    }
  }
}
