/**
 * SaveManager — persists high score and settings to localStorage.
 */

export interface GameSettings {
  masterVolume: number;   // 0..1
  sfxVolume:    number;   // 0..1
  musicVolume:  number;   // 0..1
  bloomEnabled: boolean;
  shadowsEnabled: boolean;
}

export interface SaveData {
  highScore:    number;
  highWave:     number;
  totalGames:   number;
  settings:     GameSettings;
}

const STORAGE_KEY = 'joust3d_save';

const DEFAULT_SETTINGS: GameSettings = {
  masterVolume:   0.8,
  sfxVolume:      1.0,
  musicVolume:    0.4,
  bloomEnabled:   true,
  shadowsEnabled: true,
};

const DEFAULT_SAVE: SaveData = {
  highScore:  0,
  highWave:   1,
  totalGames: 0,
  settings:   { ...DEFAULT_SETTINGS },
};

export class SaveManager {
  private data: SaveData;

  constructor() {
    this.data = this.load();
  }

  private load(): SaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULT_SAVE);
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      // Merge with defaults so missing keys (from older saves) are filled in
      return {
        ...DEFAULT_SAVE,
        ...parsed,
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      };
    } catch {
      return structuredClone(DEFAULT_SAVE);
    }
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Storage full or unavailable — fail silently
    }
  }

  // ── Getters ─────────────────────────────────────────────────────────────────

  get highScore()    { return this.data.highScore; }
  get highWave()     { return this.data.highWave; }
  get totalGames()   { return this.data.totalGames; }
  get settings()     { return this.data.settings; }

  // ── Game-end reporting ───────────────────────────────────────────────────────

  /** Call at game over. Returns true if a new high score was set. */
  reportGameOver(score: number, wave: number): boolean {
    this.data.totalGames++;
    let newRecord = false;
    if (score > this.data.highScore) {
      this.data.highScore = score;
      newRecord = true;
    }
    if (wave > this.data.highWave) this.data.highWave = wave;
    this.save();
    return newRecord;
  }

  // ── Settings ─────────────────────────────────────────────────────────────────

  updateSettings(patch: Partial<GameSettings>) {
    Object.assign(this.data.settings, patch);
    this.save();
  }
}
