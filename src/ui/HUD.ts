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
  private elScore: HTMLElement;
  private elLives: HTMLElement;
  private elWave: HTMLElement;
  private elGameOver: HTMLElement;
  private elFinalScore: HTMLElement;
  private elWaveBanner: HTMLElement;
  private elLoading: HTMLElement;
  private elLoadingBar: HTMLElement;

  private waveBannerTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.elScore = this.get('score');
    this.elLives = this.get('lives');
    this.elWave = this.get('wave');
    this.elGameOver = this.get('game-over');
    this.elFinalScore = this.get('final-score');
    this.elWaveBanner = this.get('wave-banner');
    this.elLoading = this.get('loading');
    this.elLoadingBar = this.get('loading-bar');
  }

  private get(id: string): HTMLElement {
    const el = document.getElementById(id);
    if (!el) throw new Error(`HUD: #${id} not found in DOM`);
    return el;
  }

  // ── Loading screen ───────────────────────────────────────────────────────────

  setLoadingProgress(ratio: number) {
    this.elLoadingBar.style.width = `${Math.round(ratio * 100)}%`;
  }

  hideLoading() {
    this.elLoading.classList.add('hidden');
  }

  showLoading() {
    this.elLoading.classList.remove('hidden');
    this.elLoadingBar.style.width = '0%';
  }

  // ── Game HUD ─────────────────────────────────────────────────────────────────

  update(s: HudState) {
    this.elScore.textContent = String(s.score);
    this.elLives.textContent = '♥'.repeat(Math.max(0, s.lives));
    this.elWave.textContent = String(s.wave);
  }

  // ── Wave clear banner ────────────────────────────────────────────────────────

  showWaveClear(secondsUntilNext: number) {
    this.elWaveBanner.textContent =
      secondsUntilNext > 0
        ? `Wave Clear!  Next wave in ${secondsUntilNext}s`
        : 'Wave Clear!';
    this.elWaveBanner.classList.remove('hidden');
    if (this.waveBannerTimer) clearTimeout(this.waveBannerTimer);
    this.waveBannerTimer = setTimeout(
      () => this.elWaveBanner.classList.add('hidden'),
      (secondsUntilNext + 0.8) * 1000
    );
  }

  // ── Game over ────────────────────────────────────────────────────────────────

  showGameOver(score: number) {
    this.elFinalScore.textContent = String(score);
    this.elGameOver.classList.remove('hidden');
  }

  hideGameOver() {
    this.elGameOver.classList.add('hidden');
  }
}
