import * as THREE from 'three';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { InputSystem } from './systems/InputSystem';
import { AudioSystem } from './systems/AudioSystem';
import { PhysicsSystem } from './systems/PhysicsSystem';
import { AssetManager } from './managers/AssetManager';
import { SaveManager } from './managers/SaveManager';
import { HUD } from './ui/HUD';
import { Minimap } from './ui/Minimap';
import { PlatformEditor } from './ui/PlatformEditor';
import { randomizeLayout } from './platformLayout';

type AppState = 'loading' | 'menu' | 'editing' | 'playing' | 'paused' | 'game_over';

export class GameEngine {
  private renderer: THREE.WebGLRenderer;
  private input:    InputSystem;
  private audio:    AudioSystem;
  private assets:   AssetManager;
  private save:     SaveManager;
  private hud:      HUD;
  private minimap:  Minimap;

  private menu:   MenuScene;
  private scene:  GameScene | null = null;
  private editor: PlatformEditor | null = null;

  private appState: AppState = 'loading';
  private lastTime  = 0;
  private rafHandle = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // soft edges, clear shape

    this.save    = new SaveManager();
    this.hud     = new HUD();
    this.minimap = new Minimap('minimap');
    this.input   = new InputSystem();
    this.audio   = new AudioSystem();
    this.menu    = new MenuScene(this.save);
    this.assets  = new AssetManager(p => {
      this.hud.setLoadingProgress(p.ratio);
    });

    this.wireDOMButtons();
    window.addEventListener('resize', this.onResize);
  }

  // ── Boot ─────────────────────────────────────────────────────────────────────

  async init() {
    this.hud.showLoading();
    await PhysicsSystem.initRapier();
    this.assets.completeImmediate();
    await this.assets.waitForReady();
    this.hud.hideLoading();

    this.goMenu();
  }

  // ── State transitions ─────────────────────────────────────────────────────────

  private goMenu() {
    this.appState = 'menu';
    this.hud.hideGameUI();
    this.hud.hideGameOver();
    this.menu.show();
    // If a previous game scene exists, keep rendering it as background
    if (!this.scene) {
      this.startLoop();
    }
  }

  private startGame() {
    this.menu.hide();
    this.hud.hideGameOver();
    cancelAnimationFrame(this.rafHandle);

    this.audio.init();
    this.applySettings();
    this.audio.startMusic();

    const physics = new PhysicsSystem();
    this.scene = new GameScene(this.input, this.audio, physics, this.renderer);

    this.scene.onHealthUpdate = h => this.hud.setHealth(h);
    this.scene.on('score_change', s => this.hud.update(s));
    this.scene.on('lives_change', s => this.hud.update(s));
    this.scene.on('wave_change',  s => {
      this.hud.update(s);
      this.hud.showWaveBanner(s.wave, this.scene!.currentWaveCfg);
    });
    this.scene.on('game_over', s => {
      this.appState = 'game_over';
      const isNew = this.save.reportGameOver(s.score, s.wave);
      this.hud.update(s);
      this.hud.showGameOver(s.score, this.save.highScore, isNew);
      this.audio.stopMusic();
    });
    this.scene.on('wave_clear', _s => {
      // banner is handled by wave_change; nothing extra needed here
    });

    this.applyBloom();
    this.scene.setBloomEnabled(this.save.settings.bloomEnabled);

    this.hud.update(this.scene.getState());
    this.hud.showGameUI();
    this.hud.showWaveBanner(1, this.scene.currentWaveCfg);

    this.appState = 'playing';
    this.lastTime = performance.now();
    this.startLoop();
  }

  private pause() {
    if (this.appState !== 'playing') return;
    this.appState = 'paused';
    this.showPauseMenu();
  }

  private resume() {
    if (this.appState !== 'paused') return;
    this.appState = 'playing';
    this.hidePauseMenu();
  }

  private startLoop() {
    cancelAnimationFrame(this.rafHandle);
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  // ── Main loop ─────────────────────────────────────────────────────────────────

  private loop = (now: number) => {
    this.rafHandle = requestAnimationFrame(this.loop);
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    if (this.appState === 'playing') {
      // Pause via Escape key
      if (this.input.consumePause()) {
        this.pause();
        return;
      }

      if (this.scene) {
        this.scene.update(dt);
        this.scene.render();
        this.scene.drawMinimap(this.minimap);
      }
    } else if (this.appState === 'editing') {
      this.editor?.render();
    } else if (this.appState === 'paused' || this.appState === 'menu' || this.appState === 'game_over') {
      if (this.scene) this.scene.render();
    }
  };

  // ── DOM buttons ───────────────────────────────────────────────────────────────

  private wireDOMButtons() {
    // Main menu
    this.menu.on('play',     () => this.startGame());
    this.menu.on('settings', () => this.openSettings('menu'));
    this.menu.on('edit',     () => this.openEditor());
    this.menu.on('randomize',() => { randomizeLayout(); });

    // Pause menu
    this.get('btn-resume')?.addEventListener('click',        () => this.resume());
    this.get('btn-settings-pause')?.addEventListener('click',() => this.openSettings('pause'));
    this.get('btn-quit')?.addEventListener('click',          () => this.quitToMenu());

    // Game over
    this.get('btn-restart')?.addEventListener('click', () => this.startGame());
    this.get('btn-menu')?.addEventListener('click',    () => this.quitToMenu());

    // Settings
    this.get('btn-settings-back')?.addEventListener('click', () => this.closeSettings());

    // Volume sliders
    this.get('vol-master')?.addEventListener('input', e => {
      const v = parseFloat((e.target as HTMLInputElement).value);
      this.save.updateSettings({ masterVolume: v });
      this.audio.setMasterVolume(v);
    });
    this.get('vol-sfx')?.addEventListener('input', e => {
      const v = parseFloat((e.target as HTMLInputElement).value);
      this.save.updateSettings({ sfxVolume: v });
      this.audio.setSfxVolume(v);
    });
    this.get('vol-music')?.addEventListener('input', e => {
      const v = parseFloat((e.target as HTMLInputElement).value);
      this.save.updateSettings({ musicVolume: v });
      this.audio.setMusicVolume(v);
    });

    // Toggles
    this.get('toggle-bloom')?.addEventListener('click', () => {
      const enabled = !this.save.settings.bloomEnabled;
      this.save.updateSettings({ bloomEnabled: enabled });
      this.applyBloom();
      const el = this.get('toggle-bloom');
      if (el) el.classList.toggle('on', enabled);
    });
    this.get('toggle-shadows')?.addEventListener('click', () => {
      const enabled = !this.save.settings.shadowsEnabled;
      this.save.updateSettings({ shadowsEnabled: enabled });
      this.renderer.shadowMap.enabled = enabled;
      const el = this.get('toggle-shadows');
      if (el) el.classList.toggle('on', enabled);
    });
  }

  private get(id: string): HTMLElement | null {
    return document.getElementById(id);
  }

  // ── Pause menu helpers ────────────────────────────────────────────────────────

  private showPauseMenu() {
    const el = this.get('pause-menu');
    el?.classList.remove('hidden');
  }

  private hidePauseMenu() {
    const el = this.get('pause-menu');
    el?.classList.add('hidden');
  }

  // ── Settings ──────────────────────────────────────────────────────────────────

  private _settingsOrigin: 'menu' | 'pause' = 'menu';

  private openSettings(from: 'menu' | 'pause') {
    this._settingsOrigin = from;
    if (from === 'menu') {
      this.menu.hide();
    } else {
      this.hidePauseMenu();
    }
    this.syncSettingsUI();
    this.get('settings-menu')?.classList.remove('hidden');
  }

  private closeSettings() {
    this.get('settings-menu')?.classList.add('hidden');
    if (this._settingsOrigin === 'menu') {
      this.menu.show();
    } else {
      this.showPauseMenu();
    }
  }

  private syncSettingsUI() {
    const s = this.save.settings;
    const setVal = (id: string, v: number) => {
      const el = this.get(id) as HTMLInputElement | null;
      if (el) el.value = String(v);
    };
    setVal('vol-master', s.masterVolume);
    setVal('vol-sfx',    s.sfxVolume);
    setVal('vol-music',  s.musicVolume);

    const bloom = this.get('toggle-bloom');
    if (bloom) bloom.classList.toggle('on', s.bloomEnabled);
    const shadows = this.get('toggle-shadows');
    if (shadows) shadows.classList.toggle('on', s.shadowsEnabled);
  }

  private applySettings() {
    const s = this.save.settings;
    this.audio.setMasterVolume(s.masterVolume);
    this.audio.setSfxVolume(s.sfxVolume);
    this.audio.setMusicVolume(s.musicVolume);
    this.renderer.shadowMap.enabled = s.shadowsEnabled;
  }

  private applyBloom() {
    this.scene?.setBloomEnabled(this.save.settings.bloomEnabled);
  }

  // ── Quit to menu ──────────────────────────────────────────────────────────────

  private openEditor() {
    this.menu.hide();
    this.appState = 'editing';
    this.editor = new PlatformEditor(this.renderer);
    this.editor.onDone = () => {
      this.editor = null;
      this.appState = 'menu';
      this.goMenu();
    };
  }

  private quitToMenu() {
    this.hidePauseMenu();
    this.hud.hideGameOver();
    this.audio.stopMusic();
    // Keep scene alive for background rendering
    this.goMenu();
  }

  // ── Resize ────────────────────────────────────────────────────────────────────

  private onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.scene?.onResize(w, h);
  };
}
