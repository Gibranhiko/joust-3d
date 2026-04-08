import * as THREE from 'three';
import { Rider } from './Rider';

export class Enemy extends Rider {
  constructor(scene: THREE.Scene, pos: { x: number; y: number; z: number }) {
    super(scene, pos, true);
  }
}
