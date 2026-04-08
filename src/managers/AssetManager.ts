import * as THREE from 'three';

export interface AssetProgress {
  loaded: number;
  total: number;
  ratio: number; // 0..1
}

type ProgressHandler = (p: AssetProgress) => void;

/**
 * AssetManager — centralises all asset loading with progress tracking.
 *
 * Phase 0: handles Three.js LoadingManager + future GLTF / audio hooks.
 * Phase 2: add GLTFLoader calls here.
 * Phase 4: add Howler preload calls here.
 */
export class AssetManager {
  private manager: THREE.LoadingManager;
  private onProgress: ProgressHandler;
  private _ready = false;

  constructor(onProgress: ProgressHandler) {
    this.onProgress = onProgress;

    this.manager = new THREE.LoadingManager(
      // onLoad
      () => {
        this._ready = true;
        this.onProgress({ loaded: 1, total: 1, ratio: 1 });
      },
      // onProgress
      (_url, loaded, total) => {
        this.onProgress({ loaded, total, ratio: loaded / total });
      },
      // onError
      url => {
        console.warn(`AssetManager: failed to load ${url}`);
      }
    );
  }

  get loadingManager(): THREE.LoadingManager {
    return this.manager;
  }

  get ready(): boolean {
    return this._ready;
  }

  /**
   * Resolves when all registered assets are loaded.
   * If nothing was registered (no GLTF/textures yet) it resolves immediately.
   */
  waitForReady(): Promise<void> {
    if (this._ready) return Promise.resolve();
    return new Promise(resolve => {
      const orig = this.manager.onLoad;
      this.manager.onLoad = () => {
        orig?.();
        resolve();
      };
    });
  }

  /**
   * Trigger immediate completion — used when there are no async assets to load
   * (geometry-only mode, no GLTF files). Allows the loading screen to finish.
   */
  completeImmediate() {
    this._ready = true;
    this.onProgress({ loaded: 1, total: 1, ratio: 1 });
  }
}
