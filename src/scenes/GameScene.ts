import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import { PLATFORMS, PLAYER_SPEED, GROUND_Y } from '../types';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Egg } from '../entities/Egg';
import { Pterodactyl } from '../entities/Pterodactyl';
import { InputSystem } from '../systems/InputSystem';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { AISystem } from '../systems/AISystem';
import { CollisionSystem } from '../systems/CollisionSystem';
import { WaveSystem, SpawnOrder } from '../systems/WaveSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { ParticleSystem } from '../ui/ParticleSystem';
import { FloatingText } from '../ui/FloatingText';
import { Minimap } from '../ui/Minimap';
import { createLavaMaterial, createSkydomeMaterial } from '../shaders/LavaMaterial';

export interface GameState {
  score: number;
  lives: number;
  wave: number;
  gameOver: boolean;
}

type SceneEvent = 'score_change' | 'lives_change' | 'wave_change' | 'game_over' | 'wave_clear';
type EventHandler = (state: GameState) => void;

const ARENA_MIN = new THREE.Vector3(-22, -Infinity, -22);
const ARENA_MAX = new THREE.Vector3(22, Infinity, 22);

export class GameScene {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;
  private bloomPass!: UnrealBloomPass;

  private player!: Player;
  private enemies: Enemy[] = [];
  private eggs: Egg[] = [];
  private pterodactyl: Pterodactyl | null = null;

  private input: InputSystem;
  private physics: PhysicsSystem;
  private ai: AISystem;
  private waves: WaveSystem;
  private audio: AudioSystem;
  private particles: ParticleSystem;
  private floatingText: FloatingText;

  private state: GameState = { score: 0, lives: 3, wave: 1, gameOver: false };
  private handlers: Map<SceneEvent, EventHandler[]> = new Map();

  // Staggered spawn queue — entries fire when their delay elapses
  private spawnQueue: (SpawnOrder & { elapsed: number })[] = [];
  private spawnElapsed = 0;

  // Combo system
  private comboCount = 0;
  private comboTimer = 0;
  private readonly COMBO_WINDOW = 4; // seconds between kills to keep combo

  private lavaLight!: THREE.PointLight;
  private lavaMat!: THREE.ShaderMaterial;
  private _lavaPhase = 0;

  constructor(
    input: InputSystem,
    audio: AudioSystem,
    physics: PhysicsSystem,
    renderer: THREE.WebGLRenderer
  ) {
    this.input = input;
    this.audio = audio;
    this.physics = physics;
    this.ai = new AISystem();
    this.waves = new WaveSystem();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      500
    );
    this.camera.position.set(0, 8, 18);

    // Post-processing
    this.composer = this.buildComposer(renderer);

    this.buildScene();

    // Particles + floating text (need scene built first)
    this.particles = new ParticleSystem(this.scene);
    this.floatingText = new FloatingText(this.scene);

    this.spawnPlayer();
    this.spawnWave(this.state.wave);
  }

  // ── Post-processing ──────────────────────────────────────────────────────────

  private buildComposer(renderer: THREE.WebGLRenderer): EffectComposer {
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.55,   // strength
      0.4,    // radius
      0.72    // threshold — only bright surfaces bloom (lava, particles)
    );
    composer.addPass(this.bloomPass);
    return composer;
  }

  setBloomEnabled(enabled: boolean) {
    this.bloomPass.enabled = enabled;
  }

  drawMinimap(minimap: Minimap) {
    minimap.draw(this.player, this.enemies, this.eggs, this.pterodactyl);
  }

  // ── Scene construction ──────────────────────────────────────────────────────

  private buildScene() {
    this.scene.fog = new THREE.FogExp2(0x1a0e1a, 0.012);

    // ── Lighting ──────────────────────────────────────────────────────────────

    // Bright ambient so platforms and riders are always readable
    const ambient = new THREE.AmbientLight(0xffe0c0, 1.8);
    this.scene.add(ambient);

    // Primary sun — front-left, casts sharp shadows downward
    const sun = new THREE.DirectionalLight(0xffd0a0, 2.2);
    sun.position.set(12, 28, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 100;
    sun.shadow.camera.left   = -35;
    sun.shadow.camera.right  =  35;
    sun.shadow.camera.top    =  35;
    sun.shadow.camera.bottom = -35;
    sun.shadow.bias = -0.001;
    this.scene.add(sun);

    // Counter-light from right-back — fills the shadow side so riders stay visible
    const fill = new THREE.DirectionalLight(0xaac8ff, 0.9);
    fill.position.set(-10, 18, -12);
    this.scene.add(fill);

    // Lava point light — animated
    this.lavaLight = new THREE.PointLight(0xff5500, 5, 42);
    this.lavaLight.position.set(0, GROUND_Y + 0.6, 0);
    this.scene.add(this.lavaLight);

    // Wide upward fill from lava — illuminates platform undersides and riders
    const fillLight = new THREE.PointLight(0xff3300, 2.8, 60);
    fillLight.position.set(0, GROUND_Y + 1, 0);
    this.scene.add(fillLight);

    // ── Skydome ───────────────────────────────────────────────────────────────

    const skyGeo = new THREE.SphereGeometry(200, 32, 16);
    const skyMesh = new THREE.Mesh(skyGeo, createSkydomeMaterial());
    this.scene.add(skyMesh);

    // ── Lava surface (animated shader) ────────────────────────────────────────

    this.lavaMat = createLavaMaterial();
    const lavaGeo = new THREE.PlaneGeometry(120, 120, 48, 48);
    const lava = new THREE.Mesh(lavaGeo, this.lavaMat);
    lava.rotation.x = -Math.PI / 2;
    lava.position.y = GROUND_Y;
    lava.receiveShadow = true;
    this.scene.add(lava);

    // ── Cave stalagmites (decorative geometry) ────────────────────────────────

    const stalaGeo = new THREE.ConeGeometry(0.5, 4, 6);
    const stalaMat = new THREE.MeshStandardMaterial({ color: 0x3d3050, roughness: 1 });
    const stalaPositions = [
      [-18, -3, -15], [16, -3, -12], [-14, -3, 14],
      [18, -3, 12],   [0, -3, -20],  [-20, -3, 2],
    ] as [number, number, number][];
    for (const [x, y, z] of stalaPositions) {
      const m = new THREE.Mesh(stalaGeo, stalaMat);
      m.position.set(x, y, z);
      m.rotation.z = (Math.random() - 0.5) * 0.3;
      this.scene.add(m);
    }

    // ── Stalactites (inverted, hanging from ceiling) ──────────────────────────

    const stalacGeo = new THREE.ConeGeometry(0.35, 5, 6);
    const stalacPositions = [
      [-10, 14, -8], [8, 16, 10], [-6, 13, 6],
      [12, 15, -4],  [2, 14, -16],
    ] as [number, number, number][];
    for (const [x, y, z] of stalacPositions) {
      const m = new THREE.Mesh(stalacGeo, stalaMat);
      m.position.set(x, y, z);
      m.rotation.z = Math.PI + (Math.random() - 0.5) * 0.2;
      this.scene.add(m);
    }

    // ── Platforms ─────────────────────────────────────────────────────────────

    const platMat = new THREE.MeshStandardMaterial({
      color: 0x8899aa,   // lighter stone — shadows read clearly against this
      roughness: 0.80,
      metalness: 0.05,
    });
    // Edge glow strip on each platform
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0xff4400,
      emissive: 0xff2200,
      emissiveIntensity: 0.8,
    });

    for (const p of PLATFORMS) {
      // Main slab
      const geo = new THREE.BoxGeometry(p.w * 2, p.h, p.d * 2);
      const mesh = new THREE.Mesh(geo, platMat);
      mesh.position.set(p.x, p.y - p.h / 2, p.z);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      this.scene.add(mesh);

      // Lava-glow trim strip on underside edge
      const trimGeo = new THREE.BoxGeometry(p.w * 2 + 0.1, 0.06, p.d * 2 + 0.1);
      const trim = new THREE.Mesh(trimGeo, glowMat);
      trim.position.set(p.x, p.y - p.h - 0.01, p.z);
      this.scene.add(trim);
    }

    // ── Arena boundary pillars ─────────────────────────────────────────────────

    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x4a4060, roughness: 0.9 });
    const pillarPositions = [
      [-20, -20], [-20, 0], [-20, 20],
      [0, -20],             [0, 20],
      [20, -20],  [20, 0],  [20, 20],
    ] as [number, number][];
    for (const [x, z] of pillarPositions) {
      const pillarGeo = new THREE.CylinderGeometry(0.6, 0.8, 22, 8);
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(x, 4, z);
      pillar.castShadow = true;
      this.scene.add(pillar);
    }
  }

  // ── Spawning ─────────────────────────────────────────────────────────────────

  private spawnPlayer() {
    this.player = new Player(this.scene, { x: 0, y: 2, z: 0 });
    this.physics.registerRider(this.player);
  }

  private spawnWave(_wave: number) {
    // Remove old enemies
    for (const e of this.enemies) {
      this.physics.removeRider(e);
      e.removeFromScene(this.scene);
    }
    this.enemies = [];
    this.ai.clear();

    // Remove old pterodactyl
    if (this.pterodactyl) {
      this.pterodactyl.removeFromScene(this.scene);
      this.pterodactyl = null;
    }

    // Build staggered spawn queue
    const orders = this.waves.buildSpawnOrders();
    this.spawnQueue = orders.map(o => ({ ...o, elapsed: 0 }));
    this.spawnElapsed = 0;

    // Spawn pterodactyl if this wave calls for it
    if (this.waves.hasPterodactyl) {
      this.pterodactyl = new Pterodactyl(this.scene, Math.random() * Math.PI * 2);
    }

    this.waves.markActive();
    this.emit('wave_change', this.state);
  }

  /** Process the staggered spawn queue each frame. */
  private updateSpawnQueue(dt: number) {
    if (this.spawnQueue.length === 0) return;
    this.spawnElapsed += dt;

    // Fire all orders whose delay has elapsed
    const remaining: (SpawnOrder & { elapsed: number })[] = [];
    for (const order of this.spawnQueue) {
      if (this.spawnElapsed >= order.delay) {
        const enemy = new Enemy(this.scene, order.position, order.type);
        this.physics.registerRider(enemy);
        this.enemies.push(enemy);
        this.ai.register(enemy);
      } else {
        remaining.push(order);
      }
    }
    this.spawnQueue = remaining;
  }

  // ── Main update ─────────────────────────────────────────────────────────────

  update(dt: number) {
    if (this.state.gameOver) return;
    const clampedDt = Math.min(dt, 0.05);

    this.updateInput(clampedDt);
    this.physics.step(clampedDt);

    // Arena clamp
    if (this.player.rapierBody) {
      this.physics.clampToBounds(this.player.rapierBody, ARENA_MIN, ARENA_MAX);
    }
    for (const e of this.enemies) {
      if (!e.isEgged && !e.isDead && e.rapierBody) {
        this.physics.clampToBounds(e.rapierBody, ARENA_MIN, ARENA_MAX);
      }
    }

    this.updateSpawnQueue(clampedDt);
    this.ai.update(clampedDt, this.player.position, this.waves.config, this.physics);
    this.updateLavaChecks();
    this.updateEggs(clampedDt);
    this.updateCollisions(clampedDt);
    this.updatePterodactyl(clampedDt);
    this.updateWave(clampedDt);
    this.updateCamera();
    this.updateLava(clampedDt);
    this.particles.update(clampedDt);
    this.floatingText.update(clampedDt);

    this.player.animate(clampedDt);
    for (const e of this.enemies) e.animate(clampedDt);
  }

  /** Called by GameEngine instead of renderer.render() */
  render() {
    this.composer.render();
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  private updateInput(dt: number) {
    const [ix, iz] = this.input.moveAxis;
    if (ix !== 0 || iz !== 0) {
      this.player.move(ix * PLAYER_SPEED * dt, iz * PLAYER_SPEED * dt);
      this.player.group.rotation.y = Math.atan2(ix, iz);
    }

    if (this.input.consumeFlap() && this.player.rapierBody) {
      this.physics.applyFlap(this.player.rapierBody);
      this.player.triggerFlapAnim();
      this.audio.play('flap');
    }
  }

  // ── Lava checks ────────────────────────────────────────────────────────────

  private updateLavaChecks() {
    if (!this.player.isDead && this.player.rapierBody) {
      if (this.physics.isInLava(this.player.rapierBody)) {
        this.particles.spawnDeathBurst(this.player.position.clone());
        this.onPlayerDeath();
      }
    }

    for (const e of this.enemies) {
      if (e.isEgged || e.isDead || !e.rapierBody) continue;
      if (this.physics.isInLava(e.rapierBody)) {
        const sp = this.waves.spawnPositions(1)[0];
        this.physics.teleport(e.rapierBody, sp.x, sp.y, sp.z);
      }
    }
  }

  // ── Joust collision ────────────────────────────────────────────────────────

  private updateCollisions(dt: number) {
    if (this.player.isDead) return;

    // Combo timer decay
    if (this.comboCount > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.comboCount = 0;
    }

    const result = CollisionSystem.checkJoust(this.player, this.enemies);

    if (result.type === 'player_wins') {
      const { enemy } = result;

      // Combo scoring
      this.comboCount++;
      this.comboTimer = this.COMBO_WINDOW;
      const bonus   = (this.comboCount > 1) ? (this.comboCount - 1) * 5 : 0;
      const points  = 10 + bonus;
      this.state.score += points;

      this.audio.play('joust_win');
      this.particles.spawnJoustWin(enemy.position.clone());

      const label = bonus > 0 ? `+${points} x${this.comboCount}!` : `+${points}`;
      const color = bonus > 0 ? '#ffaa00' : '#aaddff';
      this.floatingText.spawn(label, enemy.position.clone(), color);

      const egg = new Egg(this.scene, enemy.position.clone(), enemy);
      this.physics.registerEgg(egg);
      this.eggs.push(egg);
      enemy.toEgg();
      this.emit('score_change', this.state);

    } else if (result.type === 'player_loses') {
      this.comboCount = 0;
      this.audio.play('joust_lose');
      this.particles.spawnDeathBurst(this.player.position.clone());
      this.onPlayerDeath();
    }

    // Egg pickup
    const pick = CollisionSystem.checkEggPickup(this.player.position, this.eggs);
    if (pick) {
      const { egg, index } = pick;
      this.state.score += 5;
      this.audio.play('egg_collect');
      this.particles.spawnEggCollect(egg.position.clone());
      this.floatingText.spawn('+5', egg.position.clone(), '#ffee44');

      egg.collect();
      this.physics.removeEgg(egg);
      egg.removeFromScene(this.scene);
      this.eggs.splice(index, 1);

      const sp = this.waves.spawnPositions(1)[0];
      egg.owner.fromEgg(sp.x, sp.y, sp.z);

      this.emit('score_change', this.state);
    }
  }

  // ── Pterodactyl ─────────────────────────────────────────────────────────────

  private updatePterodactyl(dt: number) {
    const ptero = this.pterodactyl;
    if (!ptero || ptero.dead) return;

    ptero.update(dt);

    // Check if player jousts it while its mouth is open (vulnerable window)
    if (ptero.vulnerable && ptero.distanceTo(this.player.position) < 2.0) {
      this.state.score += Pterodactyl.KILL_SCORE;
      this.audio.play('joust_win');
      this.particles.spawnDeathBurst(ptero.group.position.clone());
      this.floatingText.spawn(`+${Pterodactyl.KILL_SCORE} PTERO!`, ptero.group.position.clone(), '#ff4400');
      ptero.kill();
      ptero.removeFromScene(this.scene);
      this.pterodactyl = null;
      this.emit('score_change', this.state);
    }
  }

  // ── Eggs ──────────────────────────────────────────────────────────────────

  private updateEggs(dt: number) {
    for (let i = this.eggs.length - 1; i >= 0; i--) {
      const egg = this.eggs[i];
      egg.update(dt);

      const inLava = egg.rapierBody
        ? this.physics.isInLava(egg.rapierBody)
        : egg.position.y < -10;

      if (inLava || egg.collected) {
        if (inLava && !egg.collected) {
          this.physics.removeEgg(egg);
          egg.removeFromScene(this.scene);
        }
        this.eggs.splice(i, 1);
      }
    }
  }

  // ── Waves ─────────────────────────────────────────────────────────────────

  private updateWave(dt: number) {
    const activeCount = this.enemies.filter(e => !e.isEgged && !e.isDead).length;
    const shouldSpawn = this.waves.update(dt, activeCount);

    if (this.waves.state === 'grace') {
      this.emit('wave_clear', this.state);
    }

    if (shouldSpawn) {
      this.state.wave = this.waves.wave;
      this.audio.play('wave_clear');
      this.spawnWave(this.state.wave);
      this.emit('wave_change', this.state);
    }
  }

  // ── Lava shader + light animation ─────────────────────────────────────────

  private updateLava(dt: number) {
    this._lavaPhase += dt;
    this.lavaMat.uniforms['uTime'].value = this._lavaPhase;
    this.lavaLight.intensity = 3.5 + Math.sin(this._lavaPhase * 2.5) * 1.0;
    // Slowly drift the light position for uneven cave glow
    this.lavaLight.position.x = Math.sin(this._lavaPhase * 0.3) * 6;
    this.lavaLight.position.z = Math.cos(this._lavaPhase * 0.2) * 6;
  }

  // ── Camera ─────────────────────────────────────────────────────────────────

  private updateCamera() {
    const target = new THREE.Vector3(
      this.player.position.x,
      this.player.position.y + 5,
      this.player.position.z + 16
    );
    this.camera.position.lerp(target, 0.06);
    this.camera.lookAt(
      this.player.position.x,
      this.player.position.y + 1,
      this.player.position.z
    );
  }

  // ── Death / respawn ────────────────────────────────────────────────────────

  private onPlayerDeath() {
    if (this.player.isDead) return;
    this.player.isDead = true;
    this.state.lives--;
    this.audio.play('death');
    this.emit('lives_change', this.state);

    if (this.state.lives <= 0) {
      this.state.gameOver = true;
      this.emit('game_over', this.state);
      return;
    }

    setTimeout(() => {
      if (this.player.rapierBody) {
        this.physics.teleport(this.player.rapierBody, 0, 2, 0);
      }
      this.player.isDead = false;
      this.player.group.visible = true;
    }, 1200);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  getState(): Readonly<GameState> { return this.state; }
  getWaveGrace() { return this.waves.graceSecondsLeft; }
  get currentWaveCfg() { return this.waves.config; }

  on(event: SceneEvent, handler: EventHandler) {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event)!.push(handler);
  }

  private emit(event: SceneEvent, state: GameState) {
    this.handlers.get(event)?.forEach(h => h(state));
  }

  onResize(w: number, h: number) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.composer.setSize(w, h);
  }
}
