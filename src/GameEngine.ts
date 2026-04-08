import * as THREE from 'three';
import { GameScene } from './scenes/GameScene';
import { InputSystem } from './systems/InputSystem';
import { AudioSystem } from './systems/AudioSystem';
import { PhysicsSystem } from './systems/PhysicsSystem';
import { AssetManager } from './managers/AssetManager';
import { HUD } from './ui/HUD';

export class GameEngine {
  private renderer: THREE.WebGLRenderer;
  private input: InputSystem;
  private audio: AudioSystem;
  private assets: AssetManager;
  private hud: HUD;
  private scene: GameScene | null = null;

  private lastTime = 0;
  private rafHandle = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.hud = new HUD();
    this.input = new InputSystem();
    this.audio = new AudioSystem();

    this.assets = new AssetManager(p => {
      this.hud.setLoadingProgress(p.ratio);
    });

    window.addEventListener('resize', this.onResize);
    document.getElementById('btn-restart')?.addEventListener('click', () => this.start());
  }

  async init() {
    this.hud.showLoading();

    // Load Rapier WASM — must complete before any PhysicsSystem is constructed
    await PhysicsSystem.initRapier();

    // Resolve any other async assets (GLTF etc. in Phase 2 — currently instant)
    this.assets.completeImmediate();
    await this.assets.waitForReady();

    this.hud.hideLoading();
    this.start();
  }

  start() {
    cancelAnimationFrame(this.rafHandle);
    this.hud.hideGameOver();
    this.audio.init();
    this.audio.startMusic();

    // Fresh physics world every new game
    const physics = new PhysicsSystem();

    this.scene = new GameScene(this.input, this.audio, physics, this.renderer);
    this.scene.on('score_change', s => this.hud.update(s));
    this.scene.on('lives_change', s => this.hud.update(s));
    this.scene.on('wave_change', s => this.hud.update(s));
    this.scene.on('game_over', s => {
      this.hud.update(s);
      this.hud.showGameOver(s.score);
      this.audio.stopMusic();
    });
    this.scene.on('wave_clear', _s => this.hud.showWaveClear(this.scene!.getWaveGrace()));

    this.hud.update(this.scene.getState());
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  private loop = (now: number) => {
    this.rafHandle = requestAnimationFrame(this.loop);
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    if (this.scene) {
      this.scene.update(dt);
      this.scene.render(); // uses EffectComposer (bloom)
    }
  };

  private onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.scene?.onResize(w, h);
  };
}
