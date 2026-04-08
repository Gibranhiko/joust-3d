import * as THREE from 'three';

interface FloatingLabel {
  sprite: THREE.Sprite;
  velocity: THREE.Vector3;
  life: number;     // 0..1, decreasing
  duration: number; // total seconds
}

/**
 * FloatingText — renders "+10", "+5 BONUS" etc. as billboarded canvas sprites
 * that float upward and fade out at the point of the event.
 */
export class FloatingText {
  private scene: THREE.Scene;
  private labels: FloatingLabel[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  spawn(text: string, position: THREE.Vector3, color = '#ffffff', duration = 1.1) {
    const sprite = this.makeSprite(text, color);
    sprite.position.copy(position).add(new THREE.Vector3(0, 1.2, 0));
    sprite.scale.set(2.4, 0.9, 1);
    this.scene.add(sprite);

    this.labels.push({
      sprite,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.6,
        1.8,
        (Math.random() - 0.5) * 0.6
      ),
      life: 1,
      duration,
    });
  }

  private makeSprite(text: string, color: string): THREE.Sprite {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size * 2;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Drop shadow
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 8;

    ctx.font = `bold 72px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Outline
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 10;
    ctx.strokeText(text, size, size / 2);

    // Fill
    ctx.fillStyle = color;
    ctx.fillText(text, size, size / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return new THREE.Sprite(mat);
  }

  update(dt: number) {
    for (let i = this.labels.length - 1; i >= 0; i--) {
      const label = this.labels[i];
      label.life -= dt / label.duration;

      if (label.life <= 0) {
        this.scene.remove(label.sprite);
        (label.sprite.material as THREE.SpriteMaterial).map?.dispose();
        (label.sprite.material as THREE.SpriteMaterial).dispose();
        this.labels.splice(i, 1);
        continue;
      }

      // Float upward with deceleration
      label.sprite.position.addScaledVector(label.velocity, dt);
      label.velocity.y = Math.max(label.velocity.y - 2 * dt, 0);

      // Fade out in the last 40 % of life
      const opacity = label.life < 0.4 ? label.life / 0.4 : 1;
      (label.sprite.material as THREE.SpriteMaterial).opacity = opacity;

      // Scale up slightly as it rises
      const s = 1 + (1 - label.life) * 0.4;
      label.sprite.scale.set(2.4 * s, 0.9 * s, 1);
    }
  }

  dispose() {
    for (const label of this.labels) {
      this.scene.remove(label.sprite);
      (label.sprite.material as THREE.SpriteMaterial).map?.dispose();
      (label.sprite.material as THREE.SpriteMaterial).dispose();
    }
    this.labels = [];
  }
}
