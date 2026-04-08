import * as THREE from 'three';
import { PLATFORMS, PLAYER_SPEED, GROUND_Y } from '../types';
import { Player }          from '../entities/Player';
import { Enemy }           from '../entities/Enemy';
import { Egg }             from '../entities/Egg';
import { InputSystem }     from '../systems/InputSystem';
import { PhysicsSystem }   from '../systems/PhysicsSystem';
import { AISystem }        from '../systems/AISystem';
import { CollisionSystem } from '../systems/CollisionSystem';
import { WaveSystem }      from '../systems/WaveSystem';
import { AudioSystem }     from '../systems/AudioSystem';

export interface GameState {
  score: number;
  lives: number;
  wave:  number;
  gameOver: boolean;
}

type SceneEvent = 'score_change' | 'lives_change' | 'wave_change' | 'game_over' | 'wave_clear';
type EventHandler = (state: GameState) => void;

export class GameScene {
  readonly scene:  THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  private player!:  Player;
  private enemies:  Enemy[]  = [];
  private eggs:     Egg[]    = [];

  private input:     InputSystem;
  private physics:   PhysicsSystem;
  private ai:        AISystem;
  private collision: CollisionSystem;
  private waves:     WaveSystem;
  private audio:     AudioSystem;

  private state: GameState = { score: 0, lives: 3, wave: 1, gameOver: false };
  private handlers: Map<SceneEvent, EventHandler[]> = new Map();

  // Visual helpers
  private lavaLight!: THREE.PointLight;

  constructor(
    input:  InputSystem,
    audio:  AudioSystem,
  ) {
    this.input     = input;
    this.audio     = audio;
    this.physics   = new PhysicsSystem();
    this.ai        = new AISystem();
    this.collision = new CollisionSystem();
    this.waves     = new WaveSystem();

    this.scene  = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.set(0, 8, 18);

    this.buildScene();
    this.spawnPlayer();
    this.spawnWave(this.state.wave);
  }

  // ── Scene construction ──────────────────────────────────────────────────────

  private buildScene() {
    this.scene.background = new THREE.Color(0x0a0a1a);
    this.scene.fog = new THREE.Fog(0x0a0a1a, 40, 120);

    // Lighting
    const ambient = new THREE.AmbientLight(0x223344, 0.7);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffeedd, 1.1);
    sun.position.set(15, 20, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far  = 80;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -30;
    sun.shadow.camera.right = sun.shadow.camera.top   =  30;
    this.scene.add(sun);

    // Lava point light — animated in update
    this.lavaLight = new THREE.PointLight(0xff4400, 3, 30);
    this.lavaLight.position.set(0, GROUND_Y + 0.5, 0);
    this.scene.add(this.lavaLight);

    // Lava surface
    const lavaGeo = new THREE.PlaneGeometry(120, 120);
    const lavaMat = new THREE.MeshStandardMaterial({
      color: 0xff2200,
      emissive: 0xff1100,
      emissiveIntensity: 0.6,
      roughness: 0.9,
    });
    const lava = new THREE.Mesh(lavaGeo, lavaMat);
    lava.rotation.x = -Math.PI / 2;
    lava.position.y  = GROUND_Y;
    lava.receiveShadow = true;
    this.scene.add(lava);

    // Arena boundary walls (low, semi-transparent)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x334455, transparent: true, opacity: 0.25 });
    const wallH   = 18;
    const wallW   = 50;
    const walls   = [
      { pos: new THREE.Vector3( wallW/2, wallH/2 - 5, 0),  rot: new THREE.Euler(0, Math.PI/2, 0) },
      { pos: new THREE.Vector3(-wallW/2, wallH/2 - 5, 0),  rot: new THREE.Euler(0, Math.PI/2, 0) },
      { pos: new THREE.Vector3(0, wallH/2 - 5,  wallW/2),  rot: new THREE.Euler(0, 0, 0) },
      { pos: new THREE.Vector3(0, wallH/2 - 5, -wallW/2),  rot: new THREE.Euler(0, 0, 0) },
    ];
    for (const w of walls) {
      const geo  = new THREE.PlaneGeometry(wallW, wallH);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.copy(w.pos);
      mesh.rotation.copy(w.rot);
      this.scene.add(mesh);
    }

    // Platforms
    const platMat = new THREE.MeshStandardMaterial({ color: 0x5d6d7e, roughness: 0.8 });
    for (const p of PLATFORMS) {
      const geo  = new THREE.BoxGeometry(p.w * 2, p.h, p.d * 2);
      const mesh = new THREE.Mesh(geo, platMat);
      mesh.position.set(p.x, p.y - p.h / 2, p.z);
      mesh.receiveShadow = true;
      mesh.castShadow    = true;
      this.scene.add(mesh);
    }
  }

  // ── Spawning ─────────────────────────────────────────────────────────────────

  private spawnPlayer() {
    this.player = new Player(this.scene, { x: 0, y: 1, z: 0 });
  }

  private spawnWave(wave: number) {
    // Clean old enemies
    for (const e of this.enemies) e.removeFromScene(this.scene);
    this.enemies = [];
    this.ai.clear();

    const cfg     = this.waves.config;
    const spawns  = this.waves.spawnPositions(cfg.count);
    for (const sp of spawns) {
      const enemy = new Enemy(this.scene, sp);
      this.enemies.push(enemy);
      this.ai.register(enemy);
    }

    this.waves.markActive();
    this.emit('wave_change', this.state);
  }

  // ── Main update ─────────────────────────────────────────────────────────────

  update(dt: number) {
    if (this.state.gameOver) return;
    const clampedDt = Math.min(dt, 0.05); // prevent spiral on tab-switch

    this.updateInput(clampedDt);
    this.updatePhysics(clampedDt);
    this.ai.update(clampedDt, this.player.position, this.waves.config);
    this.updateEggs(clampedDt);
    this.updateCollisions();
    this.updateWave(clampedDt);
    this.updateCamera(clampedDt);
    this.updateLavaLight(clampedDt);

    // Animate all riders
    this.player.animate(clampedDt);
    for (const e of this.enemies) e.animate(clampedDt);
  }

  private updateInput(dt: number) {
    const [ix, iz] = this.input.moveAxis;
    if (ix !== 0 || iz !== 0) {
      this.player.move(ix * PLAYER_SPEED * dt, iz * PLAYER_SPEED * dt);
      // Face movement direction
      this.player.group.rotation.y = Math.atan2(ix, iz);
    }

    if (this.input.consumeFlap()) {
      this.player.flap();
      this.audio.play('flap');
    }

    // Clamp player to arena
    this.player.position.x = THREE.MathUtils.clamp(this.player.position.x, -22, 22);
    this.player.position.z = THREE.MathUtils.clamp(this.player.position.z, -22, 22);
  }

  private updatePhysics(dt: number) {
    // Player
    const playerInLava = this.physics.step(this.player, dt);
    if (playerInLava) this.onPlayerDeath();

    // Enemies
    for (const e of this.enemies) {
      if (e.isEgged || e.isDead) continue;
      this.physics.step(e, dt);
      // Clamp enemies to arena
      e.position.x = THREE.MathUtils.clamp(e.position.x, -22, 22);
      e.position.z = THREE.MathUtils.clamp(e.position.z, -22, 22);
    }
  }

  private updateCollisions() {
    if (this.player.isDead) return;

    const result = CollisionSystem.checkJoust(this.player, this.enemies);

    if (result.type === 'player_wins') {
      const { enemy } = result;
      this.state.score += 10;
      this.audio.play('joust_win');
      const egg = new Egg(this.scene, enemy.position.clone(), enemy);
      this.eggs.push(egg);
      enemy.toEgg();
      this.emit('score_change', this.state);
    } else if (result.type === 'player_loses') {
      this.audio.play('joust_lose');
      this.onPlayerDeath();
    }

    // Egg pickup
    const pick = CollisionSystem.checkEggPickup(this.player.position, this.eggs);
    if (pick) {
      const { egg, index } = pick;
      this.state.score += 5;
      this.audio.play('egg_collect');
      egg.collect();
      // Respawn the enemy at a safe spawn point (above arena)
      const sp = this.waves.spawnPositions(1)[0];
      egg.owner.fromEgg(sp.x, sp.y, sp.z);
      egg.removeFromScene(this.scene);
      this.eggs.splice(index, 1);
      this.emit('score_change', this.state);
    }
  }

  private updateEggs(dt: number) {
    for (let i = this.eggs.length - 1; i >= 0; i--) {
      const egg = this.eggs[i];
      const fell = egg.update(dt);
      if (fell || egg.collected) {
        if (fell) {
          // Egg fell in lava — enemy stays egged but egg is gone
          egg.removeFromScene(this.scene);
        }
        this.eggs.splice(i, 1);
      }
    }
  }

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

  private _lavaPhase = 0;
  private updateLavaLight(dt: number) {
    this._lavaPhase += dt * 2.5;
    this.lavaLight.intensity = 2.5 + Math.sin(this._lavaPhase) * 0.8;
  }

  private updateCamera(dt: number) {
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

  // ── Game state helpers ───────────────────────────────────────────────────────

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

    // Respawn player after short delay
    setTimeout(() => {
      this.player.fromEgg(0, 1, 0);
    }, 1200);
  }

  getState(): Readonly<GameState> { return this.state; }
  getWaveGrace() { return this.waves.graceSecondsLeft; }

  // ── Event emitter ────────────────────────────────────────────────────────────

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
  }
}
