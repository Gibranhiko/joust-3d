import * as THREE from 'three';
import { GameScene }   from './scenes/GameScene';
import { InputSystem } from './systems/InputSystem';
import { AudioSystem } from './systems/AudioSystem';

/**
 * GameEngine — owns the renderer, drives the loop, manages scene transitions.
 */
export class GameEngine {
  private renderer: THREE.WebGLRenderer;
  private input:    InputSystem;
  private audio:    AudioSystem;
  private scene:    GameScene | null = null;
  private hud:      HUD;

  private lastTime  = 0;
  private rafHandle = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;

    this.input = new InputSystem();
    this.audio = new AudioSystem();
    this.hud   = new HUD();

    window.addEventListener('resize', this.onResize);
    document.getElementById('btn-restart')?.addEventListener('click', () => this.start());
  }

  start() {
    // Tear down old scene if any
    if (this.scene) cancelAnimationFrame(this.rafHandle);

    this.hud.hideGameOver();
    this.audio.init();
    this.audio.startMusic();

    this.scene = new GameScene(this.input, this.audio);
    this.scene.on('score_change', s => this.hud.update(s));
    this.scene.on('lives_change', s => this.hud.update(s));
    this.scene.on('wave_change',  s => this.hud.update(s));
    this.scene.on('game_over',    s => {
      this.hud.update(s);
      this.hud.showGameOver(s.score);
      this.audio.stopMusic();
    });
    this.scene.on('wave_clear', s => this.hud.showWaveClear(this.scene!.getWaveGrace()));

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
      this.renderer.render(this.scene.scene, this.scene.camera);
    }
  };

  private onResize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.scene?.onResize(w, h);
  };
}

// ─── Inline HUD controller (no framework needed) ─────────────────────────────

interface HudState { score: number; lives: number; wave: number; }

class HUD {
  private elScore    = document.getElementById('score')!;
  private elLives    = document.getElementById('lives')!;
  private elWave     = document.getElementById('wave')!;
  private elGameOver = document.getElementById('game-over')!;
  private elFinalSc  = document.getElementById('final-score')!;
  private elWaveBanner = document.getElementById('wave-banner')!;
  private waveBannerTimer: ReturnType<typeof setTimeout> | null = null;

  update(s: HudState) {
    this.elScore.textContent = String(s.score);
    this.elLives.textContent = '♥'.repeat(Math.max(0, s.lives));
    this.elWave.textContent  = String(s.wave);
  }

  showGameOver(score: number) {
    this.elFinalSc.textContent = String(score);
    this.elGameOver.classList.remove('hidden');
  }

  hideGameOver() {
    this.elGameOver.classList.add('hidden');
  }

  showWaveClear(seconds: number) {
    this.elWaveBanner.textContent = `Wave Clear! Next in ${seconds}s`;
    this.elWaveBanner.classList.remove('hidden');
    if (this.waveBannerTimer) clearTimeout(this.waveBannerTimer);
    this.waveBannerTimer = setTimeout(() => {
      this.elWaveBanner.classList.add('hidden');
    }, (seconds + 0.5) * 1000);
  }
}
