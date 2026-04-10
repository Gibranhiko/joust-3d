import * as THREE from 'three';
import { activePlatforms, randomizeLayout } from '../platformLayout';
import type { PlatformDef } from '../types';

/**
 * PlatformEditor — minimal top-down drag editor shown before the game starts.
 *
 * Controls:
 *   Click + drag  — move platform on XZ
 *   Q / E         — lower / raise selected platform by 0.5
 *   R             — randomize all platforms
 *   Done button   — exit editor
 */
export class PlatformEditor {
  private scene:    THREE.Scene;
  private camera:   THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private meshes:   THREE.Mesh[] = [];

  private selected   = -1;
  private dragging   = false;
  private dragPlane  = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private dragOffset = new THREE.Vector3();
  private raycaster  = new THREE.Raycaster();
  private mouse      = new THREE.Vector2();

  private elPanel:  HTMLElement;
  private elInfo:   HTMLElement = document.createElement('span');
  onDone: () => void = () => {};

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;

    // ── 3-D scene ──────────────────────────────────────────────────────────
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111118);

    this.camera = new THREE.PerspectiveCamera(
      42, window.innerWidth / window.innerHeight, 0.1, 500
    );
    this.camera.position.set(0, 52, 0.01);
    this.camera.lookAt(0, 0, 0);
    this.camera.up.set(0, 0, -1); // north = up on screen

    this.scene.add(new THREE.AmbientLight(0xffffff, 2));

    // Grid for spatial reference
    const grid = new THREE.GridHelper(44, 22, 0x334, 0x223);
    this.scene.add(grid);

    // Arena boundary box (wireframe)
    const borderGeo = new THREE.BoxGeometry(44, 0.05, 44);
    const borderMat = new THREE.MeshBasicMaterial({ color: 0x445566, wireframe: true });
    this.scene.add(new THREE.Mesh(borderGeo, borderMat));

    // ── HTML panel ─────────────────────────────────────────────────────────
    this.elPanel = this.buildPanel();

    this.buildMeshes();
    this.bindEvents();
  }

  // ── DOM panel ─────────────────────────────────────────────────────────────

  private buildPanel(): HTMLElement {
    const el = document.createElement('div');
    el.id = 'editor-panel';
    Object.assign(el.style, {
      position: 'fixed', top: '0', left: '0', right: '0',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: '12px', padding: '10px',
      background: 'rgba(0,0,0,0.7)',
      fontFamily: 'monospace', color: '#fff', fontSize: '13px',
      zIndex: '100', pointerEvents: 'all',
    });

    const hint = document.createElement('span');
    hint.textContent = 'Click+drag — move  ·  Scroll wheel — height  ·  R — randomize';
    hint.style.opacity = '0.6';

    this.elInfo.style.cssText = 'background:#1a2a3a;padding:3px 10px;border-radius:4px;min-width:160px;text-align:center;';
    this.elInfo.textContent = 'No selection';

    const btnRand = this.btn('Randomize (R)', () => { randomizeLayout(); this.buildMeshes(); });
    const btnDone = this.btn('▶ Play', () => this.done());

    el.append(hint, this.elInfo, btnRand, btnDone);
    document.body.appendChild(el);
    return el;
  }

  private btn(label: string, cb: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.textContent = label;
    Object.assign(b.style, {
      padding: '6px 16px', cursor: 'pointer', background: '#2c3e50',
      color: '#fff', border: '1px solid #446', borderRadius: '5px',
      fontFamily: 'monospace', fontSize: '13px',
    });
    b.addEventListener('click', cb);
    return b;
  }

  // ── Platform meshes ───────────────────────────────────────────────────────

  private buildMeshes() {
    for (const m of this.meshes) {
      this.scene.remove(m);
      m.geometry.dispose();
    }
    this.meshes = [];
    this.selected = -1;

    for (const p of activePlatforms) {
      const geo  = new THREE.BoxGeometry(p.w * 2, Math.max(p.h, 0.5), p.d * 2);
      const mat  = new THREE.MeshStandardMaterial({ color: 0x8899aa });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(p.x, p.y, p.z);
      this.scene.add(mesh);
      this.meshes.push(mesh);
    }
  }

  private highlight() {
    for (let i = 0; i < this.meshes.length; i++) {
      const mat = this.meshes[i].material as THREE.MeshStandardMaterial;
      mat.color.setHex(i === this.selected ? 0xf1c40f : 0x8899aa);
      mat.emissive.setHex(i === this.selected ? 0x332200 : 0x000000);
    }
  }

  // ── Mouse/keyboard events ─────────────────────────────────────────────────

  private setMouse(e: MouseEvent) {
    this.mouse.set(
      (e.clientX / window.innerWidth)  *  2 - 1,
      (e.clientY / window.innerHeight) * -2 + 1
    );
  }

  private onMouseDown = (e: MouseEvent) => {
    this.setMouse(e);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObjects(this.meshes);
    if (hits.length === 0) { this.selected = -1; this.highlight(); this.updateInfo(); return; }

    this.selected = this.meshes.indexOf(hits[0].object as THREE.Mesh);
    this.highlight();
    this.updateInfo();
    this.dragging = true;

    // Drag plane at platform's current Y
    const p = activePlatforms[this.selected];
    this.dragPlane.constant = -p.y;
    const hit = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.dragPlane, hit);
    this.dragOffset.copy(hit).sub(this.meshes[this.selected].position);
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.dragging || this.selected < 0) return;
    this.setMouse(e);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.dragPlane, hit)) return;

    const p = activePlatforms[this.selected];
    p.x = THREE.MathUtils.clamp(hit.x - this.dragOffset.x, -20, 20);
    p.z = THREE.MathUtils.clamp(hit.z - this.dragOffset.z, -20, 20);
    this.meshes[this.selected].position.set(p.x, p.y, p.z);
    this.updateInfo();
  };

  private onMouseUp = () => { this.dragging = false; };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'KeyR') { randomizeLayout(); this.buildMeshes(); return; }
    if (this.selected < 0) return;
    const p = activePlatforms[this.selected];
    if (e.code === 'KeyQ') p.y = Math.max(0, +(p.y - 0.5).toFixed(1));
    if (e.code === 'KeyE') p.y = Math.min(15, +(p.y + 0.5).toFixed(1));
    this.meshes[this.selected].position.y = p.y;
    this.dragPlane.constant = -p.y;
    this.updateInfo();
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (this.selected < 0) return;
    const p = activePlatforms[this.selected];
    const delta = e.deltaY > 0 ? -0.5 : 0.5;
    p.y = Math.min(15, Math.max(0, +(p.y + delta).toFixed(1)));
    this.meshes[this.selected].position.y = p.y;
    this.dragPlane.constant = -p.y;
    this.updateInfo();
  };

  private updateInfo() {
    if (this.selected < 0) {
      this.elInfo.textContent = 'No selection';
      return;
    }
    const p = activePlatforms[this.selected];
    this.elInfo.textContent =
      `#${this.selected}  x:${p.x.toFixed(1)}  y:${p.y.toFixed(1)}  z:${p.z.toFixed(1)}`;
  }

  private bindEvents() {
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup',   this.onMouseUp);
    window.addEventListener('keydown',   this.onKeyDown);
    window.addEventListener('wheel',     this.onWheel, { passive: false });
  }

  private unbindEvents() {
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup',   this.onMouseUp);
    window.removeEventListener('keydown',   this.onKeyDown);
    window.removeEventListener('wheel',     this.onWheel);
  }

  // ── Render + lifecycle ────────────────────────────────────────────────────

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  private done() {
    this.dispose();
    this.onDone();
  }

  dispose() {
    this.unbindEvents();
    for (const m of this.meshes) {
      this.scene.remove(m);
      m.geometry.dispose();
    }
    this.elPanel.remove();
  }
}
