import { Howl } from 'howler';

type SfxId = 'flap' | 'enemy_flap' | 'joust_win' | 'joust_lose' | 'egg_collect' | 'death' | 'wave_clear';

/**
 * AudioSystem — wraps Howler.
 * All sounds are defined as a sprite in one file once assets are available.
 * Until the audio file exists the system fails silently.
 */
export class AudioSystem {
  private sfx: Howl | null = null;
  private music: Howl | null = null;
  private _muted = false;

  init() {
    // Sprite map — update times (ms) when real audio file is added
    // Format: [start, duration]
    this.sfx = new Howl({
      src: ['/assets/audio/sfx.mp3', '/assets/audio/sfx.ogg'],
      sprite: {
        flap:        [0,    250],
        enemy_flap:  [300,  250],
        joust_win:   [600,  500],
        joust_lose:  [1150, 600],
        egg_collect: [1800, 400],
        death:       [2250, 800],
        wave_clear:  [3100, 1500],
      },
      onloaderror: () => { this.sfx = null; }, // fail silently
    });

    this.music = new Howl({
      src: ['/assets/audio/music.mp3', '/assets/audio/music.ogg'],
      loop: true,
      volume: 0.4,
      onloaderror: () => { this.music = null; },
    });
  }

  play(id: SfxId) {
    if (this._muted || !this.sfx) return;
    this.sfx.play(id);
  }

  startMusic() {
    if (this._muted || !this.music) return;
    if (!this.music.playing()) this.music.play();
  }

  stopMusic() {
    this.music?.stop();
  }

  set muted(v: boolean) {
    this._muted = v;
    if (v) {
      this.sfx?.stop();
      this.music?.stop();
    }
  }

  get muted() { return this._muted; }
}
