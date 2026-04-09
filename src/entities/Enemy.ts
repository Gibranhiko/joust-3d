import * as THREE from 'three';
import { Rider } from './Rider';
import { EnemyType, ENEMY_TYPE_DEFS } from '../types';

export class Enemy extends Rider {
  readonly enemyType: EnemyType;

  constructor(
    scene: THREE.Scene,
    pos: { x: number; y: number; z: number },
    type: EnemyType = 'bounder'
  ) {
    super(scene, pos, true);
    this.enemyType = type;
    this.applyTypeVisuals();
  }

  private applyTypeVisuals() {
    const def = ENEMY_TYPE_DEFS[this.enemyType];

    // Re-colour body and wings using the type definition
    (this.body.material as THREE.MeshLambertMaterial).color.setHex(def.color);
    (this.leftWing.material as THREE.MeshLambertMaterial).color.setHex(def.wingColor);
    (this.rightWing.material as THREE.MeshLambertMaterial).color.setHex(def.wingColor);

    // Visual badge on top of head to distinguish types at a glance
    if (this.enemyType === 'hunter') {
      // Tall spike fin
      const finGeo = new THREE.ConeGeometry(0.08, 0.5, 5);
      const fin    = new THREE.Mesh(finGeo, new THREE.MeshLambertMaterial({ color: 0xff00ff }));
      fin.position.set(0, 2.05, 0);
      this.group.add(fin);
    } else if (this.enemyType === 'shadow') {
      // Twin horn spikes
      for (const side of [-0.15, 0.15]) {
        const hornGeo = new THREE.ConeGeometry(0.05, 0.4, 4);
        const horn    = new THREE.Mesh(hornGeo, new THREE.MeshLambertMaterial({ color: 0x00ffee }));
        horn.position.set(side, 2.05, 0);
        horn.rotation.z = side * 4;
        this.group.add(horn);
      }
      // Make shadow enemies slightly larger (intimidating)
      this.group.scale.set(1.12, 1.12, 1.12);
    }
    // Bounders have no badge — plain red, easy to read as the weakest type
  }
}
