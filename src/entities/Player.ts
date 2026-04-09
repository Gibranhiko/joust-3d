import * as THREE from 'three';
import { Rider } from './Rider';

export class Player extends Rider {
  health = 100; // 0–100; hits 0 → lose a heart, reset to 100

  constructor(scene: THREE.Scene, pos: { x: number; y: number; z: number }) {
    super(scene, pos, false);
  }
}
