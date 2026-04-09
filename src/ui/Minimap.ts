import type { Player }      from '../entities/Player';
import type { Enemy }       from '../entities/Enemy';
import type { Egg }         from '../entities/Egg';
import type { Pterodactyl } from '../entities/Pterodactyl';

const MAP_SIZE   = 140;  // canvas px
const ARENA_HALF = 24;   // world units — maps to half of MAP_SIZE
const SCALE      = MAP_SIZE / 2 / ARENA_HALF;

/**
 * Minimap — draws a top-down 2D overhead view onto a canvas element.
 * Dots are sized and coloured per entity type.
 * Heights are encoded as opacity: higher = brighter.
 */
export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!this.canvas) throw new Error(`Minimap: #${canvasId} not found`);
    this.canvas.width  = MAP_SIZE;
    this.canvas.height = MAP_SIZE;
    this.ctx = this.canvas.getContext('2d')!;
  }

  draw(
    player: Player,
    enemies: Enemy[],
    eggs: Egg[],
    ptero: Pterodactyl | null
  ) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    // Border
    ctx.strokeStyle = 'rgba(255,80,0,0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, 0, MAP_SIZE, MAP_SIZE);

    // Platform reference dots (static grey)
    ctx.fillStyle = 'rgba(100,110,130,0.5)';
    const platPositions = [
      [0,0],[10,10],[-10,5],[5,-8],[-6,-10],[0,0]
    ] as [number,number][];
    for (const [x, z] of platPositions) {
      const [px, py] = this.toMap(x, z);
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Eggs — yellow small
    for (const egg of eggs) {
      this.dot(egg.position.x, egg.position.z, egg.position.y, 3, '#f9e547');
    }

    // Pterodactyl — orange diamond
    if (ptero && !ptero.dead) {
      const p = ptero.group.position;
      this.diamond(p.x, p.z, p.y, '#ff6600');
    }

    // Enemies — coloured by type
    for (const e of enemies) {
      if (e.isEgged) {
        this.dot(e.position.x, e.position.z, e.position.y, 3, '#f9e547');
        continue;
      }
      const col = e.enemyType === 'shadow'
        ? '#1abc9c'
        : e.enemyType === 'hunter'
          ? '#8e44ad'
          : '#e74c3c';
      this.dot(e.position.x, e.position.z, e.position.y, 5, col);
    }

    // Player — bright blue arrow
    this.arrow(
      player.position.x,
      player.position.z,
      player.group.rotation.y,
      '#3498db'
    );
  }

  private toMap(worldX: number, worldZ: number): [number, number] {
    return [
      MAP_SIZE / 2 + worldX * SCALE,
      MAP_SIZE / 2 + worldZ * SCALE,
    ];
  }

  /** Height → brightness: y 0..12 maps to opacity 0.4..1.0 */
  private heightAlpha(y: number): number {
    return 0.4 + Math.min(1, Math.max(0, y / 12)) * 0.6;
  }

  private dot(wx: number, wz: number, wy: number, r: number, color: string) {
    const [x, y] = this.toMap(wx, wz);
    this.ctx.globalAlpha = this.heightAlpha(wy);
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.globalAlpha = 1;
  }

  private diamond(wx: number, wz: number, wy: number, color: string) {
    const [x, y] = this.toMap(wx, wz);
    this.ctx.globalAlpha = this.heightAlpha(wy);
    this.ctx.fillStyle = color;
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(Math.PI / 4);
    this.ctx.fillRect(-4, -4, 8, 8);
    this.ctx.restore();
    this.ctx.globalAlpha = 1;
  }

  private arrow(wx: number, wz: number, rotY: number, color: string) {
    const [x, y] = this.toMap(wx, wz);
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(-rotY);           // canvas Y is inverted vs world Z
    this.ctx.fillStyle = color;
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur  = 6;
    this.ctx.beginPath();
    this.ctx.moveTo(0, -7);           // tip (forward)
    this.ctx.lineTo(-4, 5);
    this.ctx.lineTo(0, 2);
    this.ctx.lineTo(4, 5);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();
  }

  show() { this.canvas.style.display = 'block'; }
  hide() { this.canvas.style.display = 'none'; }
}
