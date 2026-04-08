import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { PLATFORMS, GRAVITY, LAVA_Y, GROUND_Y, RigidBodyHandle } from '../types';
import type { Rider } from '../entities/Rider';
import type { Egg } from '../entities/Egg';

// Capsule dimensions — match the visual geometry in Rider.ts
const CAPSULE_HALF_H = 0.7;
const CAPSULE_RADIUS = 0.35;
// Raycast distance to detect ground beneath rider
const GROUND_RAY_LEN = CAPSULE_HALF_H + CAPSULE_RADIUS + 0.18;

const FIXED_DT = 1 / 60;
const MAX_STEPS = 5; // cap sub-steps after a long frame

/** All registered riders; synced every step. */
interface RiderEntry {
  rider: Rider;
  body: RAPIER.RigidBody;
}

/** All registered eggs; synced every step. */
interface EggEntry {
  egg: Egg;
  body: RAPIER.RigidBody;
}

export class PhysicsSystem {
  private world!: RAPIER.World;
  private riders: RiderEntry[] = [];
  private eggs: EggEntry[] = [];
  private accumulator = 0;

  // ── Static init (call once before constructing any PhysicsSystem) ──────────

  static async initRapier(): Promise<void> {
    await RAPIER.init();
  }

  // ── Constructor (sync — call after initRapier) ────────────────────────────

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 });
    this.buildStaticGeometry();
  }

  // ── Static geometry ───────────────────────────────────────────────────────

  private buildStaticGeometry() {
    // Lava floor — solid so eggs bounce off it; riders die on contact (checked separately)
    this.addStatic(0, GROUND_Y - 0.2, 0, 60, 0.25, 60, { friction: 0.3, restitution: 0.0 });

    // Platforms
    for (const p of PLATFORMS) {
      this.addStatic(p.x, p.y, p.z, p.w, p.h, p.d, { friction: 2.0, restitution: 0.0 });
    }
  }

  private addStatic(
    x: number, y: number, z: number,
    hw: number, hh: number, hd: number,
    mat: { friction: number; restitution: number }
  ) {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z)
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(hw, hh, hd)
        .setFriction(mat.friction)
        .setRestitution(mat.restitution),
      body
    );
  }

  // ── Entity registration ───────────────────────────────────────────────────

  registerRider(rider: Rider) {
    const { x, y, z } = rider.group.position;
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .setAngularDamping(10.0) // 1.6 — no tipping
        .setLinearDamping(0.8)  // light air drag
        .lockRotations()        // riders never tumble
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.capsule(CAPSULE_HALF_H, CAPSULE_RADIUS)
        .setFriction(0.1)
        .setRestitution(0.0),
      body
    );
    rider.rapierBody = body as unknown as RigidBodyHandle;
    this.riders.push({ rider, body });
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
        .setRestitution(0.55), // bouncy
      body
    );
    // Upward pop on spawn
    body.setLinvel({ x: 0, y: 3, z: 0 }, true);
    egg.rapierBody = body as unknown as RigidBodyHandle;
    this.eggs.push({ egg, body });
  }

  removeEgg(egg: Egg) {
    const idx = this.eggs.findIndex(e => e.egg === egg);
    if (idx === -1) return;
    const { body } = this.eggs[idx];
    this.world.removeRigidBody(body);
    this.eggs.splice(idx, 1);
    egg.rapierBody = null;
  }

  removeRider(rider: Rider) {
    const idx = this.riders.findIndex(r => r.rider === rider);
    if (idx === -1) return;
    const { body } = this.riders[idx];
    this.world.removeRigidBody(body);
    this.riders.splice(idx, 1);
    rider.rapierBody = null;
  }

  // ── Per-frame controls ────────────────────────────────────────────────────

  /** Apply upward velocity burst — call when rider flaps. */
  applyFlap(handle: RigidBodyHandle) {
    const body = handle as unknown as RAPIER.RigidBody;
    const vel = body.linvel();
    body.setLinvel({ x: vel.x, y: Math.max(vel.y, 0) + 11, z: vel.z }, true);
    body.wakeUp();
  }

  /**
   * Move rider horizontally each frame (position delta, not velocity).
   * Keeps Rapier's vertical velocity intact.
   */
  moveHorizontal(handle: RigidBodyHandle, dx: number, dz: number) {
    const body = handle as unknown as RAPIER.RigidBody;
    const t = body.translation();
    body.setTranslation({ x: t.x + dx, y: t.y, z: t.z + dz }, true);
    body.wakeUp();
  }

  /** Teleport + zero velocity — used for respawns. */
  teleport(handle: RigidBodyHandle, x: number, y: number, z: number) {
    const body = handle as unknown as RAPIER.RigidBody;
    body.setTranslation({ x, y, z }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    body.wakeUp();
  }

  /** Enable/disable a body (used when rider is egged). */
  setBodyEnabled(handle: RigidBodyHandle, enabled: boolean) {
    (handle as unknown as RAPIER.RigidBody).setEnabled(enabled);
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  isInLava(handle: RigidBodyHandle): boolean {
    return handle.translation().y <= LAVA_Y + 0.1;
  }

  isOnGround(handle: RigidBodyHandle): boolean {
    const t = handle.translation();
    const ray = new RAPIER.Ray({ x: t.x, y: t.y, z: t.z }, { x: 0, y: -1, z: 0 });
    const hit = this.world.castRay(ray, GROUND_RAY_LEN, true);
    return hit !== null;
  }

  // ── World step ────────────────────────────────────────────────────────────

  /**
   * Advance the physics world by dt seconds using a fixed-timestep accumulator,
   * then sync all registered entity positions to their Three.js meshes.
   */
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
      // Update cached state for animation + AI
      rider.velocityY = body.linvel().y;
      rider.onGround = this.isOnGround(body as unknown as RigidBodyHandle);
    }

    for (const { egg, body } of this.eggs) {
      if (!body.isEnabled()) continue;
      const t = body.translation();
      egg.mesh.position.set(t.x, t.y, t.z);
    }
  }

  // ── Arena boundary clamp (called from GameScene after step) ──────────────

  clampToBounds(handle: RigidBodyHandle, min: THREE.Vector3, max: THREE.Vector3) {
    const t = handle.translation();
    const cx = THREE.MathUtils.clamp(t.x, min.x, max.x);
    const cz = THREE.MathUtils.clamp(t.z, min.z, max.z);
    if (cx !== t.x || cz !== t.z) {
      (handle as unknown as RAPIER.RigidBody)
        .setTranslation({ x: cx, y: t.y, z: cz }, true);
    }
  }
}
