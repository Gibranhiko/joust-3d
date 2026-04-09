/**
 * InputSystem — centralises all keyboard state.
 * Other systems read from this; nothing else touches window events.
 */
export class InputSystem {
  private keys: Set<string> = new Set();
  private _flapPressed  = false;
  private _pausePressed = false;

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup',   this.onKeyUp);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    if (e.code === 'Space') {
      e.preventDefault();
      this._flapPressed = true;
    }
    if (e.code === 'Escape') {
      this._pausePressed = true;
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  /** True only on the frame the flap key was pressed — consumed on read. */
  consumeFlap(): boolean {
    if (this._flapPressed) {
      this._flapPressed = false;
      return true;
    }
    return false;
  }

  /** True only on the frame the Escape key was pressed — consumed on read. */
  consumePause(): boolean {
    if (this._pausePressed) {
      this._pausePressed = false;
      return true;
    }
    return false;
  }

  /** Lateral input as a -1..1 pair [x, z] */
  get moveAxis(): [number, number] {
    let x = 0, z = 0;
    if (this.isDown('ArrowLeft')  || this.isDown('KeyA')) x -= 1;
    if (this.isDown('ArrowRight') || this.isDown('KeyD')) x += 1;
    if (this.isDown('ArrowUp')    || this.isDown('KeyW')) z -= 1;
    if (this.isDown('ArrowDown')  || this.isDown('KeyS')) z += 1;
    // normalise diagonal
    const len = Math.hypot(x, z);
    return len > 0 ? [x / len, z / len] : [0, 0];
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup',   this.onKeyUp);
  }
}
