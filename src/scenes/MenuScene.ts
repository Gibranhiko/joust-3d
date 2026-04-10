import type { SaveManager } from '../managers/SaveManager';

type MenuEvent = 'play' | 'settings' | 'edit' | 'randomize';
type MenuHandler = () => void;

/**
 * MenuScene — controls the HTML main-menu overlay.
 * The actual Three.js rendering continues in the background (animated lava).
 */
export class MenuScene {
  private handlers: Map<MenuEvent, MenuHandler[]> = new Map();
  private elMenu:      HTMLElement;
  private elHighScore: HTMLElement;
  private elHighWave:  HTMLElement;
  private elTotalGames: HTMLElement;

  constructor(private save: SaveManager) {
    this.elMenu       = this.get('main-menu');
    this.elHighScore  = this.get('menu-high-score');
    this.elHighWave   = this.get('menu-high-wave');
    this.elTotalGames = this.get('menu-total-games');

    this.get('btn-play').addEventListener('click',          () => this.emit('play'));
    this.get('btn-settings-menu').addEventListener('click', () => this.emit('settings'));
    this.get('btn-edit').addEventListener('click',          () => this.emit('edit'));
    this.get('btn-randomize').addEventListener('click',     () => this.emit('randomize'));
  }

  private get(id: string): HTMLElement {
    const el = document.getElementById(id);
    if (!el) throw new Error(`MenuScene: #${id} not found`);
    return el;
  }

  show() {
    this.elHighScore.textContent  = String(this.save.highScore);
    this.elHighWave.textContent   = String(this.save.highWave);
    this.elTotalGames.textContent = String(this.save.totalGames);
    this.elMenu.classList.remove('hidden');
  }

  hide() {
    this.elMenu.classList.add('hidden');
  }

  on(event: MenuEvent, handler: MenuHandler) {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event)!.push(handler);
  }

  private emit(event: MenuEvent) {
    this.handlers.get(event)?.forEach(h => h());
  }
}
