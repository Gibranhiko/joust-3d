# Tech Stack — 3D Joust Game

> See [technical-assessment.md](technical-assessment.md) for the full evaluation behind each decision.

---

## Summary

| Layer | Chosen Tool | Version | Status |
|-------|------------|---------|--------|
| Renderer | Three.js | 0.180.0 | ✅ Installed, in use |
| Physics | Rapier (`rapier3d-compat`) | 0.19.3 | ⚠️ Installed — not yet wired (Phase 1) |
| Multiplayer | Colyseus (server) | — | ❌ Not installed (Phase 8) |
| Audio | Howler.js | 2.2.4 | ⚠️ Installed — AudioSystem scaffolded, no audio files yet |
| Language | TypeScript | 6.0.2 | ✅ Migrated, strict mode, zero errors |
| Build | Vite | 7.1.6 | ✅ Installed, in use |
| Testing | Vitest | — | ❌ Not installed (tech debt) |
| ESLint + Prettier | — | — | ❌ Not configured (Phase 0.5) |
| Server runtime | Node.js + Express | 20 LTS | ❌ Planned (Phase 8) |
| Client hosting | Vercel | — | ❌ Planned |
| Server hosting | Railway | — | ❌ Planned (Phase 8) |

---

## Rendering — Three.js

**Why**: Already integrated, large community, flexible. Native GLTF loader, PBR materials, shadow maps, post-processing pipeline.

**Future path**: If the project grows significantly in scene complexity or entity count, migrate to **Babylon.js** which has built-in game features (animation state machine, Havok physics, spatial audio, scene inspector) that reduce custom code.

**Key Three.js modules used or planned:**

```
three                    — core renderer, geometries, materials
three/examples/jsm/loaders/GLTFLoader       — ostrich model loading
three/examples/jsm/loaders/KTX2Loader      — GPU-compressed textures
three/examples/jsm/controls/PointerLockControls — FPS-style mouse look
three/examples/jsm/postprocessing/*        — bloom, SSAO for visual polish
three/examples/jsm/utils/SkeletonUtils     — animation retargeting
```

---

## Physics — Rapier

**Why**: Rust/WASM physics engine. Deterministic (identical results on all clients = reliable multiplayer). 5-10x faster than cannon-es at equivalent scene complexity.

**Install:**
```bash
npm install @dimforge/rapier3d-compat
npm uninstall cannon-es
```

**Usage pattern:**
```ts
import RAPIER from '@dimforge/rapier3d-compat';
await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: -15, z: 0 });

// Each entity gets a rigid body + collider
const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic());
const collider = world.createCollider(
  RAPIER.ColliderDesc.capsule(0.5, 0.3),
  body
);

// Each frame: step physics, then sync Three.js positions
world.step();
mesh.position.copy(body.translation());
```

**Fixed timestep** (important for determinism):
```ts
const FIXED_DT = 1 / 60;
let accumulator = 0;
// In game loop:
accumulator += deltaTime;
while (accumulator >= FIXED_DT) {
  world.step();
  accumulator -= FIXED_DT;
}
```

---

## Multiplayer — Colyseus

**Why**: Game-specific multiplayer framework. Handles room lifecycle, schema-based state delta sync, and presence. Eliminates hundreds of lines of manual Socket.io state management code.

**Install:**
```bash
# Server
npm install colyseus       # in server/
# Client
npm install colyseus.js    # in src/
```

**Architecture:**
```
Client (browser)                Server (Node.js)
  ├── ColyseusClient         ←→   ├── GameRoom extends Room
  │   └── room.state            │   └── GameState (schema)
  │       ├── players            │       ├── MapSchema<PlayerState>
  │       └── eggs               │       └── ArraySchema<EggState>
  └── NetworkSystem          ←→  └── Physics runs server-side (Rapier)
```

**Key pattern — schema definition:**
```ts
// server/GameState.ts
import { Schema, MapSchema, type } from '@colyseus/schema';

class PlayerState extends Schema {
  @type('float32') x = 0;
  @type('float32') y = 0;
  @type('float32') z = 0;
  @type('int16') score = 0;
  @type('int8') lives = 3;
}

class GameState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type('int16') wave = 1;
}
```

---

## Audio — Howler.js

**Why**: Industry-standard game audio library. Sound sprites, spatial 3D audio, automatic codec fallback.

**Install:**
```bash
npm install howler
```

**Sound sprite pattern** (fewer HTTP requests):
```ts
const sfx = new Howl({
  src: ['assets/audio/joust-sfx.mp3', 'assets/audio/joust-sfx.ogg'],
  sprite: {
    flap:      [0,    300],
    egg_crack: [400,  500],
    egg_get:   [950,  700],
    death:     [1700, 1000],
    wave_win:  [2800, 2000],
  }
});

sfx.play('flap');
```

**Spatial audio for enemy sounds:**
```ts
const enemyFlap = new Howl({
  src: ['assets/audio/flap.mp3'],
  positional: true,
  pannerAttr: { refDistance: 5, maxDistance: 30 }
});
// Update position each frame
enemyFlap.pos(enemy.x, enemy.y, enemy.z);
```

---

## Language — TypeScript

**Why**: Catches type errors at compile time (physics body mismatches, entity state bugs). Three.js has excellent `@types/three`. Zero config with Vite.

**Install:**
```bash
npm install -D typescript @types/three
```

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "lib": ["ES2022", "DOM"],
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

**Migration: complete.** All source files are `.ts`, strict mode enabled, zero type errors.
`tsconfig.json` uses `"moduleResolution": "Bundler"` and `"ignoreDeprecations": "6.0"` for TS 6 compat.

---

## Build — Vite

Already configured correctly. No changes needed.

**Recommended vite.config.ts additions:**
```ts
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: { '@': '/src' }
  },
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat']  // WASM — exclude from pre-bundling
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          physics: ['@dimforge/rapier3d-compat'],
        }
      }
    }
  }
});
```

---

## Testing — Vitest

**Install:**
```bash
npm install -D vitest
```

**Priority test targets:**
- Collision detection logic (altitude-based winner determination)
- Wave spawning/difficulty calculation
- Score computation
- Egg state machine (spawned → collected → respawn)

---

## Server — Node.js + Colyseus

```
server/
├── index.ts          — Express + Colyseus monitor setup
├── GameRoom.ts       — Room class, physics loop
├── GameState.ts      — Colyseus schema definitions
└── AIController.ts   — Enemy AI (runs server-side)
```

**Entry point pattern:**
```ts
// server/index.ts
import { Server } from 'colyseus';
import { createServer } from 'http';
import express from 'express';
import { GameRoom } from './GameRoom';

const app = express();
const httpServer = createServer(app);
const gameServer = new Server({ server: httpServer });

gameServer.define('joust', GameRoom);
gameServer.listen(2567);
```

---

## Hosting

### Client (static site)
- **Vercel** — connect GitHub repo, automatic deploys on push
- `vite build` → `dist/` → Vercel serves it

### Game Server
- **Railway** — one-click Node.js deployment, supports WebSockets natively
- Set `PORT` env var; Colyseus reads it automatically

### Environment Variables
```
# Client (.env)
VITE_COLYSEUS_URL=wss://your-server.railway.app

# Server (Railway)
PORT=2567
NODE_ENV=production
```

---

## Package.json (target state)

```json
{
  "dependencies": {
    "three": "^0.180.0",
    "@dimforge/rapier3d-compat": "^0.14.0",
    "colyseus.js": "^0.15.0",
    "howler": "^2.2.4"
  },
  "devDependencies": {
    "vite": "^7.0.0",
    "typescript": "^5.0.0",
    "@types/three": "^0.180.0",
    "@types/howler": "^2.2.11",
    "vitest": "^3.0.0"
  }
}
```

---

## Server package.json (target state)

```json
{
  "dependencies": {
    "colyseus": "^0.15.0",
    "@colyseus/schema": "^2.0.0",
    "@dimforge/rapier3d-compat": "^0.14.0",
    "express": "^4.18.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/express": "^4.17.0",
    "ts-node": "^10.9.0"
  }
}
```
