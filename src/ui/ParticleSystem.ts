import * as THREE from 'three';

// ─── Individual emitter ───────────────────────────────────────────────────────

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;       // 0..1 remaining (1 = just born, 0 = dead)
  maxLife: number;    // seconds
  size: number;
}

interface EmitterOptions {
  count: number;
  position: THREE.Vector3;
  spread: number;         // cone half-angle in all directions
  speedMin: number;
  speedMax: number;
  lifeMin: number;
  lifeMax: number;
  sizeMin: number;
  sizeMax: number;
  color: THREE.Color;
  gravity: number;        // downward acceleration (positive = down)
  once: boolean;          // true = burst, false = continuous
}

class Emitter {
  private particles: Particle[] = [];
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  readonly points: THREE.Points;
  private opts: EmitterOptions;
  private _dead = false;

  constructor(opts: EmitterOptions) {
    this.opts = opts;

    this.geometry = new THREE.BufferGeometry();
    this.material = new THREE.PointsMaterial({
      color: opts.color,
      size: opts.sizeMax,
      sizeAttenuation: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geometry, this.material);

    if (opts.once) this.burst();
  }

  private spawn(pos: THREE.Vector3) {
    const { speedMin, speedMax, lifeMin, lifeMax, sizeMin, sizeMax } = this.opts;
    const speed = speedMin + Math.random() * (speedMax - speedMin);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * this.opts.spread;
    const p: Particle = {
      position: pos.clone(),
      velocity: new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.cos(phi) * speed * (0.4 + Math.random() * 0.6),
        Math.sin(phi) * Math.sin(theta) * speed
      ),
      life: 1,
      maxLife: lifeMin + Math.random() * (lifeMax - lifeMin),
      size: sizeMin + Math.random() * (sizeMax - sizeMin),
    };
    this.particles.push(p);
  }

  private burst() {
    for (let i = 0; i < this.opts.count; i++) this.spawn(this.opts.position);
  }

  update(dt: number): boolean {
    // Continuous emitter: trickle a few particles per frame
    if (!this.opts.once && !this._dead) {
      const rate = this.opts.count;     // particles / second
      const toSpawn = Math.floor(rate * dt + Math.random());
      for (let i = 0; i < toSpawn; i++) {
        const jitter = new THREE.Vector3(
          (Math.random() - 0.5) * 8,
          0,
          (Math.random() - 0.5) * 8
        );
        this.spawn(this.opts.position.clone().add(jitter));
      }
    }

    const positions: number[] = [];
    const alive: Particle[] = [];

    for (const p of this.particles) {
      p.life -= dt / p.maxLife;
      if (p.life <= 0) continue;

      p.velocity.y -= this.opts.gravity * dt;
      p.position.addScaledVector(p.velocity, dt);
      positions.push(p.position.x, p.position.y, p.position.z);
      alive.push(p);
    }

    this.particles = alive;
    this.material.opacity = alive.length > 0 ? alive[0].life : 0;

    if (positions.length > 0) {
      this.geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3)
      );
    } else {
      this.geometry.deleteAttribute('position');
    }

    // Burst is dead when all particles expired
    if (this.opts.once && this.particles.length === 0) return true;
    return false;
  }

  kill() { this._dead = true; }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

// ─── ParticleSystem — manages all active emitters ───────────────────────────

export class ParticleSystem {
  private scene: THREE.Scene;
  private emitters: Emitter[] = [];

  // Shared lava bubble emitter (continuous)
  private lavaBubbleEmitter: Emitter | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.startLavaBubbles();
  }

  private startLavaBubbles() {
    const emitter = new Emitter({
      count: 6,                                   // per second
      position: new THREE.Vector3(0, -5, 0),
      spread: Math.PI,                            // full hemisphere
      speedMin: 0.5,
      speedMax: 2.5,
      lifeMin: 1.2,
      lifeMax: 2.5,
      sizeMin: 0.08,
      sizeMax: 0.22,
      color: new THREE.Color(0xff3300),
      gravity: 0.4,                               // slight upward drift
      once: false,
    });
    this.scene.add(emitter.points);
    this.lavaBubbleEmitter = emitter;
    this.emitters.push(emitter);
  }

  /** Burst of orange/red sparks — called on rider death. */
  spawnDeathBurst(position: THREE.Vector3) {
    const emitter = new Emitter({
      count: 40,
      position: position.clone(),
      spread: Math.PI,
      speedMin: 3,
      speedMax: 8,
      lifeMin: 0.6,
      lifeMax: 1.4,
      sizeMin: 0.12,
      sizeMax: 0.35,
      color: new THREE.Color(0xff6600),
      gravity: 4,
      once: true,
    });
    this.scene.add(emitter.points);
    this.emitters.push(emitter);
  }

  /** Small yellow burst — called on egg collect. */
  spawnEggCollect(position: THREE.Vector3) {
    const emitter = new Emitter({
      count: 18,
      position: position.clone(),
      spread: Math.PI / 2,
      speedMin: 2,
      speedMax: 5,
      lifeMin: 0.4,
      lifeMax: 0.9,
      sizeMin: 0.08,
      sizeMax: 0.2,
      color: new THREE.Color(0xffee00),
      gravity: 3,
      once: true,
    });
    this.scene.add(emitter.points);
    this.emitters.push(emitter);
  }

  /** Win flash — white/blue burst at collision point. */
  spawnJoustWin(position: THREE.Vector3) {
    const emitter = new Emitter({
      count: 25,
      position: position.clone(),
      spread: Math.PI,
      speedMin: 2,
      speedMax: 6,
      lifeMin: 0.3,
      lifeMax: 0.8,
      sizeMin: 0.1,
      sizeMax: 0.25,
      color: new THREE.Color(0xaaddff),
      gravity: 2,
      once: true,
    });
    this.scene.add(emitter.points);
    this.emitters.push(emitter);
  }

  update(dt: number) {
    for (let i = this.emitters.length - 1; i >= 0; i--) {
      const dead = this.emitters[i].update(dt);
      if (dead) {
        this.scene.remove(this.emitters[i].points);
        this.emitters[i].dispose();
        this.emitters.splice(i, 1);
      }
    }
  }

  dispose() {
    for (const e of this.emitters) {
      this.scene.remove(e.points);
      e.dispose();
    }
    this.emitters = [];
    this.lavaBubbleEmitter = null;
  }
}
