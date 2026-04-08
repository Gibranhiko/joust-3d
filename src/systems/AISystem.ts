import * as THREE from 'three';
import { ENEMY_SPEED } from '../types';
import type { Rider } from '../entities/Rider';
import type { WaveDef } from '../types';
import type { PhysicsSystem } from './PhysicsSystem';

type AIState = 'patrol' | 'chase' | 'evade';

interface EnemyAI {
  rider: Rider;
  state: AIState;
  patrolTarget: THREE.Vector3;
  stateTimer: number;
}

const PATROL_POINTS = [
  new THREE.Vector3(  0, 1,  0 ),
  new THREE.Vector3( 10, 5, 10 ),
  new THREE.Vector3(-10, 3,  5 ),
  new THREE.Vector3(  5, 8, -8 ),
  new THREE.Vector3( -6, 4,-10 ),
  new THREE.Vector3(  0,10,  0 ),
];

export class AISystem {
  private agents: EnemyAI[] = [];

  register(rider: Rider) {
    this.agents.push({
      rider,
      state: 'patrol',
      patrolTarget: PATROL_POINTS[Math.floor(Math.random() * PATROL_POINTS.length)].clone(),
      stateTimer: 0,
    });
  }

  clear() {
    this.agents = [];
  }

  update(deltaTime: number, playerPos: THREE.Vector3, waveCfg: WaveDef, physics?: PhysicsSystem) {
    const speed = ENEMY_SPEED * waveCfg.speed;

    for (const agent of this.agents) {
      const { rider } = agent;
      if (rider.isEgged || rider.isDead) continue;

      const toPlayer = new THREE.Vector3().subVectors(playerPos, rider.position);
      const distToPlayer = toPlayer.length();

      // ── State transitions ──────────────────────────────────────────────────
      agent.stateTimer -= deltaTime;

      if (distToPlayer < 12) {
        // Close: decide chase or evade based on altitude
        if (rider.position.y < playerPos.y - 0.5) {
          agent.state = 'evade'; // player is above — dangerous
        } else {
          agent.state = 'chase';
        }
      } else if (agent.stateTimer <= 0) {
        agent.state = 'patrol';
        agent.patrolTarget = PATROL_POINTS[
          Math.floor(Math.random() * PATROL_POINTS.length)
        ].clone();
        agent.stateTimer = 3 + Math.random() * 4;
      }

      // ── Movement ───────────────────────────────────────────────────────────
      let dx: number;
      let dz: number;

      if (agent.state === 'chase') {
        dx = toPlayer.x;
        dz = toPlayer.z;
      } else if (agent.state === 'evade') {
        // Move away horizontally, flap hard to gain altitude
        dx = -toPlayer.x;
        dz = -toPlayer.z;
        if (Math.random() < waveCfg.flapChance * 3) {
          rider.triggerFlapAnim();
          if (rider.rapierBody && physics) physics.applyFlap(rider.rapierBody);
        }
      } else {
        // patrol
        const toPatrol = new THREE.Vector3().subVectors(agent.patrolTarget, rider.position);
        if (toPatrol.length() < 2) {
          agent.patrolTarget = PATROL_POINTS[
            Math.floor(Math.random() * PATROL_POINTS.length)
          ].clone();
        }
        dx = toPatrol.x;
        dz = toPatrol.z;
      }

      // Normalise and apply speed
      const len = Math.hypot(dx, dz);
      if (len > 0) {
        rider.move((dx / len) * speed * deltaTime, (dz / len) * speed * deltaTime);
      }

      // Face direction of movement
      if (len > 0.1) {
        rider.group.rotation.y = Math.atan2(dx, dz);
      }

      // Random flap
      if (Math.random() < waveCfg.flapChance) {
        rider.triggerFlapAnim();
        if (rider.rapierBody && physics) physics.applyFlap(rider.rapierBody);
      }
    }
  }
}
