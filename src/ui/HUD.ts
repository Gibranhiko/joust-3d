import type { WaveDef } from '../types';

interface HudState {
  score: number;
  lives: number;
  wave: number;
}

/**
 * HUD — controls all DOM overlay elements.
 * Reads element IDs from index.html; throws clearly if any are missing.
 */
export class HUD {
  // ── In-game panels ─────────────────────────────────────────────────────────
  private elHud:          HTMLElement;
  private elScore:        HTMLElement;
  private elLives:        HTMLElement;
  private elWave:         HTMLElement;
  private elControlsHint: HTMLElement;
  private elMinimapWrap:  HTMLElement;
  private elComboDisplay: HTMLElement;
  private elHealthWrap:   HTMLElement;
  private elHealthBar:    HTMLElement;

  // ── Wave banner ────────────────────────────────────────────────────────────
  private elWaveBanner:        HTMLElement;
  private elWaveBannerTitle:   HTMLElement;
  private elWaveBannerEnemies: HTMLElement;

  // ── Game over ──────────────────────────────────────────────────────────────
  private elGameOver:   HTMLElement;
  private elFinalScore: HTMLElement;
  private elGoHighScore: HTMLElement;
  private elNewRecord:  HTMLElement;

  // ── Loading ────────────────────────────────────────────────────────────────
  private elLoading:    HTMLElement;
  private elLoadingBar: HTMLElement;

  private waveBannerTimer: ReturnType<typeof setTimeout> | null = null;
  private comboHideTimer:  ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.elHud          = this.get('hud');
    this.elScore        = this.get('score');
    this.elLives        = this.get('lives');
    this.elWave         = this.get('wave');
    this.elControlsHint = this.get('controls-hint');
    this.elMinimapWrap  = this.get('minimap-wrap');
    this.elComboDisplay = this.get('combo-display');
    this.elHealthWrap   = this.get('health-wrap');
    this.elHealthBar    = this.get('health-bar');

    this.elWaveBanner        = this.get('wave-banner');
    this.elWaveBannerTitle   = this.get('wave-banner-title');
    this.elWaveBannerEnemies = this.get('wave-banner-enemies');

    this.elGameOver    = this.get('game-over');
    this.elFinalScore  = this.get('final-score');
    this.elGoHighScore = this.get('go-high-score');
    this.elNewRecord   = this.get('new-record');

    this.elLoading    = this.get('loading');
    this.elLoadingBar = this.get('loading-bar');
  }

  private get(id: string): HTMLElement {
    const el = document.getElementById(id);
    if (!el) throw new Error(`HUD: #${id} not found in DOM`);
    return el;
  }

  // ── Loading screen ─────────────────────────────────────────────────────────

  setLoadingProgress(ratio: number) {
    this.elLoadingBar.style.width = `${Math.round(ratio * 100)}%`;
  }

  showLoading() {
    this.elLoading.classList.remove('hidden');
    this.elLoadingBar.style.width = '0%';
  }

  hideLoading() {
    this.elLoading.classList.add('hidden');
  }

  // ── In-game UI visibility ──────────────────────────────────────────────────

  showGameUI() {
    this.elHud.classList.remove('hidden');
    this.elControlsHint.classList.remove('hidden');
    this.elMinimapWrap.classList.remove('hidden');
    this.elHealthWrap.classList.remove('hidden');
  }

  hideGameUI() {
    this.elHud.classList.add('hidden');
    this.elControlsHint.classList.add('hidden');
    this.elMinimapWrap.classList.add('hidden');
    this.elHealthWrap.classList.add('hidden');
    this.elComboDisplay.classList.add('hidden');
    this.elWaveBanner.classList.add('hidden');
  }

  setHealth(v: number) {
    const pct = Math.max(0, Math.min(100, v));
    this.elHealthBar.style.width = `${pct}%`;
    // Green → yellow → red as health drops
    if (pct > 60)      this.elHealthBar.style.background = '#2ecc71';
    else if (pct > 30) this.elHealthBar.style.background = '#f39c12';
    else               this.elHealthBar.style.background = '#e74c3c';
  }

  // ── Score / Lives / Wave ───────────────────────────────────────────────────

  update(s: HudState) {
    this.elScore.textContent = String(s.score);
    this.elLives.textContent = '♥'.repeat(Math.max(0, s.lives));
    this.elWave.textContent  = String(s.wave);
  }

  // ── Wave banner ────────────────────────────────────────────────────────────

  showWaveBanner(wave: number, cfg: WaveDef) {
    this.elWaveBannerTitle.textContent = `Wave ${wave}`;

    // Tally enemy types for the preview line
    const counts: Record<string, number> = {};
    for (let i = 0; i < cfg.count; i++) {
      const t = cfg.types[i % cfg.types.length];
      counts[t] = (counts[t] ?? 0) + 1;
    }
    const parts = Object.entries(counts).map(([t, n]) => `${n}× ${t}`);
    if (cfg.pterodactyl) parts.push('+ Pterodactyl');
    this.elWaveBannerEnemies.textContent = parts.join('  ·  ');

    this.elWaveBanner.classList.remove('hidden');
    if (this.waveBannerTimer) clearTimeout(this.waveBannerTimer);
    this.waveBannerTimer = setTimeout(
      () => this.elWaveBanner.classList.add('hidden'),
      3200
    );
  }

  // ── Combo display ──────────────────────────────────────────────────────────

  showCombo(text: string) {
    this.elComboDisplay.textContent = text;
    this.elComboDisplay.classList.remove('hidden');
    if (this.comboHideTimer) clearTimeout(this.comboHideTimer);
    this.comboHideTimer = setTimeout(
      () => this.elComboDisplay.classList.add('hidden'),
      2000
    );
  }

  // ── Game over ──────────────────────────────────────────────────────────────

  showGameOver(score: number, highScore: number, isNewRecord: boolean) {
    this.elFinalScore.textContent  = String(score);
    this.elGoHighScore.textContent = String(highScore);
    this.elNewRecord.classList.toggle('hidden', !isNewRecord);
    this.elGameOver.classList.remove('hidden');
  }

  hideGameOver() {
    this.elGameOver.classList.add('hidden');
  }
}
