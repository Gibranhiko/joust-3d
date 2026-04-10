import { PLATFORMS, PlatformDef } from './types';

/** Live platform layout — start from the defaults, then allow mutation. */
export let activePlatforms: PlatformDef[] = PLATFORMS.map(p => ({ ...p }));

export function setActivePlatforms(layout: PlatformDef[]) {
  activePlatforms = layout;
}

/**
 * Spread platforms randomly across the arena with a minimum XZ separation
 * so they are always reachable and never stacked.
 */
export function randomizeLayout(): void {
  const arena   = 22;   // ±22 in X/Z
  const minDist = 11;   // min XZ gap between centres
  const count   = 8;
  const result: PlatformDef[] = [];

  // Always keep a wide ground slab at y=0 for respawn
  result.push({ x: 0, y: 0, z: 0, w: 9, d: 9, h: 0.7 });

  let attempts = 0;
  while (result.length < count && attempts < 2000) {
    attempts++;
    const x = (Math.random() * 2 - 1) * arena;
    const z = (Math.random() * 2 - 1) * arena;
    const y = Math.round((1 + Math.random() * 10) * 2) / 2; // 1..11 in 0.5 steps

    const tooClose = result.some(p => {
      const dx = p.x - x, dz = p.z - z;
      return Math.sqrt(dx * dx + dz * dz) < minDist;
    });
    if (tooClose) continue;

    const w = 5 + Math.random() * 3;
    result.push({ x, y, z, w, d: w, h: 0.6 });
  }

  activePlatforms = result;
}
