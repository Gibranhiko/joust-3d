import * as THREE from 'three';
import { ENEMY_SPEED, ENEMY_TYPE_DEFS } from '../types';
import type { Enemy } from '../entities/Enemy';
import type { WaveDef } from '../types';
import type { PhysicsSystem } from './PhysicsSystem';

type AIState = 'patrol' | 'chase' | 'evade' | 'attack';

interface EnemyAgent {
  enemy: Enemy;
  state: AIState;
  stateTimer: number;       // cooldown before next state switch
  patrolTarget: THREE.Vector3;
  attackTimer: number;      // time spent in attack dive before giving up
}

// Patrol waypoints — distributed across the arena volume
const PATROL_POINTS = [
  new THREE.Vector3(  0,  2,  0 ),
  new THREE.Vector3( 10,  5, 10 ),
  new THREE.Vector3(-10,  3,  5 ),
  new THREE.Vector3(  5,  8, -8 ),
  new THREE.Vector3( -6,  4,-10 ),
  new THREE.Vector3(  0, 10,  0 ),
  new THREE.Vector3( 14,  3, -2 ),
  new THREE.Vector3(-14,  3,  2 ),
];

function randomPatrol(): THREE.Vector3 {
  return PATROL_POINTS[Math.floor(Math.random() * PATROL_POINTS.length)].clone();
}

export class AISystem {
  private agents: EnemyAgent[] = [];

  register(enemy: Enemy) {
    this.agents.push({
      enemy,
      state: 'patrol',
      stateTimer: Math.random() * 1.5,   // stagger initial transitions
      patrolTarget: randomPatrol(),
      attackTimer: 0,
    });
  }

  clear() {
    this.agents = [];
  }

  update(dt: number, playerPos: THREE.Vector3, waveCfg: WaveDef, physics?: PhysicsSystem) {
    for (const agent of this.agents) {
      const { enemy } = agent;
      if (enemy.isEgged || enemy.isDead) continue;

      const typeDef = ENEMY_TYPE_DEFS[enemy.enemyType];
      const speed   = ENEMY_SPEED * waveCfg.speed * typeDef.speedMult;
      const flap    = waveCfg.flapChance * typeDef.flapMult;

      const toPlayer   = new THREE.Vector3().subVectors(playerPos, enemy.position);
      const dist       = toPlayer.length();
      const yDiff      = playerPos.y - enemy.position.y; // + = player above enemy

      agent.stateTimer -= dt;

      // ── State machine ────────────────────────────────────────────────────────
      this.updateState(agent, dist, yDiff, typeDef.aggroRange, typeDef.attackRange, typeDef.reactionTime);

      // ── Movement per state ───────────────────────────────────────────────────
      let dx = 0;
      let dz = 0;

      switch (agent.state) {

        case 'patrol': {
          const toP = new THREE.Vector3().subVectors(agent.patrolTarget, enemy.position);
          if (toP.length() < 2) agent.patrolTarget = randomPatrol();
          dx = toP.x;
          dz = toP.z;
          // Maintain mid altitude during patrol with gentle flaps
          if (enemy.position.y < agent.patrolTarget.y - 1 && Math.random() < flap * 2) {
            this.doFlap(enemy, physics);
          }
          break;
        }

        case 'chase': {
          // Move toward player; try to stay slightly above
          dx = toPlayer.x;
          dz = toPlayer.z;
          // Flap to gain altitude advantage
          if (yDiff > -1 && Math.random() < flap * 1.5) this.doFlap(enemy, physics);
          break;
        }

        case 'evade': {
          // Flee horizontally, flap aggressively to rise above player
          dx = -toPlayer.x;
          dz = -toPlayer.z;
          if (Math.random() < flap * 3) this.doFlap(enemy, physics);
          break;
        }

        case 'attack': {
          // Enemy is above player → dive straight at them
          agent.attackTimer += dt;
          dx = toPlayer.x * 1.5; // accelerate laterally
          dz = toPlayer.z * 1.5;

          // Pull up if attack runs too long or lost altitude advantage
          if (agent.attackTimer > 2.0 || yDiff > 1.0) {
            agent.state = 'chase';
            agent.stateTimer = typeDef.reactionTime;
            agent.attackTimer = 0;
          }
          break;
        }
      }

      // ── Apply horizontal movement ────────────────────────────────────────────
      const len = Math.hypot(dx, dz);
      if (len > 0.01) {
        const nx = dx / len;
        const nz = dz / len;
        enemy.move(nx * speed * dt, nz * speed * dt);
        // Face movement direction
        enemy.group.rotation.y = Math.atan2(nx, nz);
      }

      // ── Random flap (keeps altitude during all states) ───────────────────────
      if (Math.random() < flap) this.doFlap(enemy, physics);
    }
  }

  private updateState(
    agent: EnemyAgent,
    dist: number,
    yDiff: number,      // positive = player is above enemy
    aggroRange: number,
    attackRange: number,
    reactionTime: number
  ) {
    if (agent.stateTimer > 0) return; // locked in current state

    if (dist <= attackRange && yDiff < -0.8) {
      // Enemy is clearly above player — attack dive
      if (agent.state !== 'attack') {
        agent.state = 'attack';
        agent.stateTimer = reactionTime * 0.5; // fast transition to attack
        agent.attackTimer = 0;
      }
    } else if (dist <= aggroRange) {
      if (yDiff > 1.2) {
        // Player is significantly above — danger, evade
        if (agent.state !== 'evade') {
          agent.state = 'evade';
          agent.stateTimer = reactionTime;
        }
      } else {
        // Roughly same height or enemy slightly above — chase
        if (agent.state !== 'chase') {
          agent.state = 'chase';
          agent.stateTimer = reactionTime;
        }
      }
    } else {
      // Out of aggro range — patrol
      if (agent.state !== 'patrol') {
        agent.state = 'patrol';
        agent.stateTimer = reactionTime * 2;
        agent.patrolTarget = randomPatrol();
      }
    }
  }

  private doFlap(enemy: Enemy, physics?: PhysicsSystem) {
    enemy.triggerFlapAnim();
    if (enemy.rapierBody && physics) physics.applyFlap(enemy.rapierBody);
  }
}
