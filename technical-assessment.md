# Technical Assessment — 3D Joust Game

## Overview

This document evaluates the best tools, libraries, and architectural choices for building a complete, production-quality 3D remake of Atari Joust. Every category is scored across four dimensions relevant to this project: **fitness** (how well it solves the problem), **performance**, **DX** (developer experience / learning curve), and **ecosystem** (community, docs, longevity).

---

## 1. Rendering Engine

### Candidates

| Engine | Type | Bundle Size | WebGL2 | WebGPU | Score |
|--------|------|-------------|--------|--------|-------|
| **Three.js** | Low-level 3D lib | ~600 KB | Yes | Experimental | ★★★★☆ |
| **Babylon.js** | Game-oriented 3D engine | ~2 MB | Yes | Yes | ★★★★★ |
| **PlayCanvas** | Full game engine (web) | ~1.2 MB | Yes | No | ★★★☆☆ |
| **Godot (WASM)** | Full game engine export | ~20+ MB | Via export | No | ★★☆☆☆ |
| **A-Frame** | VR-first abstraction | ~1 MB | Yes | No | ★★☆☆☆ |

### Assessment

**Babylon.js** is objectively the stronger choice for a game of this scope:

- Built-in **animation state machine** (no manual lerp code needed for wing flaps)
- **Havok physics** integration (deterministic, WASM-based — ideal for multiplayer)
- **Spatial audio** built-in (PositionalAudio without extra libs)
- **Scene Inspector** (F12-like tool inside the game for debugging)
- Built-in **particle systems** (lava sparks, death effects)
- **ActionManager** for collision events
- Better **performance** on complex scenes with GPU instancing out of the box
- WebGPU-ready for future hardware

**Three.js** is the current choice and is viable — it has more flexibility and a larger npm ecosystem. The honest tradeoff is: Three.js requires assembling more pieces yourself, while Babylon.js ships more of what a game needs pre-integrated.

### Verdict

| Recommendation | Rationale |
|---|---|
| **Stay with Three.js** for now | Migration cost is high; the foundation exists |
| **Consider Babylon.js** if doing a clean rewrite | It is the better engine for this game genre |

If the project grows beyond MVP scope, migrating to Babylon.js will pay dividends. This document's roadmap accommodates either path.

---

## 2. Physics Engine

### Candidates

| Library | Language | Deterministic | Performance | Three.js Integration | Score |
|---------|----------|--------------|-------------|----------------------|-------|
| **cannon-es** | JS | No | Low | Easy | ★★★☆☆ |
| **Rapier** | Rust/WASM | **Yes** | Very High | Good (rapier3d) | ★★★★★ |
| **Ammo.js** | C++/WASM (Bullet) | No | High | OK | ★★★☆☆ |
| **Oimo.js** | JS | No | Medium | Easy | ★★★☆☆ |
| **Jolt** | C++/WASM | Yes | Very High | Manual | ★★★★☆ |

### Assessment

**Rapier** is the best choice for this project for two decisive reasons:

1. **Determinism** — Rapier produces identical simulation results across all clients for the same inputs. This is the foundation of reliable multiplayer without constant full-state syncing.
2. **Performance** — Rust/WASM physics runs 5-10x faster than pure-JS equivalents. More enemies, more eggs, more physics objects at 60 FPS.

cannon-es (currently installed but not used) is acceptable for a solo prototype but will become a liability once multiplayer and many physics objects are in scope.

### Integration Package

```
@dimforge/rapier3d-compat   # Use this — works in both Node and browser
```

### Verdict: Replace cannon-es with Rapier

---

## 3. Multiplayer Networking

### Candidates

| Library | Type | State Sync | Room Mgmt | Latency Compensation | Score |
|---------|------|-----------|-----------|----------------------|-------|
| **Socket.io** | WebSocket lib | Manual | Manual | Manual | ★★★☆☆ |
| **Colyseus** | Game framework (Node) | Built-in (schema) | Built-in | Partial | ★★★★★ |
| **PeerJS / WebRTC** | P2P | Manual | Manual | Manual | ★★★☆☆ |
| **Nakama** | Game backend (Go) | Via realtime API | Built-in | Partial | ★★★★☆ |
| **Geckos.io** | UDP-like WebRTC | Manual | Manual | No | ★★★☆☆ |

### Assessment

**Colyseus** is the correct choice over raw Socket.io:

- **Schema-based state sync** — define game state as a schema; Colyseus sends only deltas automatically
- **Room lifecycle** — lobby, matchmaking, room limits built in
- **Presence** — track players across rooms without custom code
- **Interpolation-ready** — predictable state structure makes client-side interpolation straightforward
- **Node.js server** — same JS ecosystem, runs alongside existing backend

Socket.io forces you to manually re-implement all of the above. For a game with real-time flight physics and collision events, that is a significant hidden cost.

If you need a hosted backend with leaderboards, auth, and matchmaking, **Nakama** (open-source, self-hostable) adds those layers on top of Colyseus.

### Verdict: Replace raw Socket.io with Colyseus + keep Socket.io as transport layer underneath

---

## 4. Audio

### Candidates

| Library | Spatial Audio | Sound Sprites | Web Audio API | Bundle Size | Score |
|---------|--------------|---------------|--------------|-------------|-------|
| **Web Audio API** | Yes (manual) | No | Native | 0 KB | ★★★☆☆ |
| **Howler.js** | Yes | Yes | Yes | ~20 KB | ★★★★★ |
| **Tone.js** | No | No | Yes | ~350 KB | ★★☆☆☆ |
| **Three.js PositionalAudio** | Yes | No | Via Three.js | 0 extra | ★★★★☆ |

### Assessment

**Howler.js** is the industry standard for game audio in the browser:

- Sound sprites (multiple sounds in one file — fewer HTTP requests)
- 3D positional audio (enemy flaps heard from their position)
- Fade in/out, rate control, looping — all built in
- Automatic codec selection (MP3 → OGG fallback)
- 20 KB gzipped

**Three.js PositionalAudio** is a reasonable alternative if you want to keep everything inside Three.js, using the AudioListener attached to the camera.

### Verdict: Add Howler.js

---

## 5. Language & Type Safety

### Current State
JavaScript (ES6+) — no type checking.

### Assessment

For a project of this ambition — physics bodies, networked state, animation systems, wave managers — **TypeScript is strongly recommended**:

- Catches entity/component type mismatches at compile time
- Refactoring (e.g., changing Player fields) is safe
- Better IDE autocomplete for Three.js types (DefinitelyTyped support)
- Vite supports TypeScript natively — zero-config migration

### Migration Path
1. Rename `.js` → `.ts`, add `tsconfig.json`
2. Add `"three": "@types/three"`, `"@dimforge/rapier3d-compat"` (typed by default)
3. Add types incrementally (`// @ts-check` as a softer first step)

### Verdict: Migrate to TypeScript

---

## 6. Game Architecture Pattern

### Candidates

| Pattern | Complexity | Scalability | Fit for Joust |
|---------|-----------|-------------|--------------|
| **Monolithic script** (current) | Low | Low | Only for prototypes |
| **Class-based OOP** | Medium | Medium | Good for 5-20 entities |
| **ECS (Entity-Component-System)** | High | Very High | Best for 50+ entities |
| **Hybrid OOP + Systems** | Medium | High | Best for this project |

### Assessment

A **Hybrid OOP + Systems** approach is ideal:

- Entities are class instances (Player, Enemy, Egg) — readable
- Cross-cutting logic (collision, physics, audio, networking) lives in dedicated **System** classes
- Systems run in the game loop in order (Input → Physics → AI → Collision → Render → Network)

Full ECS (like bitECS) has maximum performance but is harder to read and overkill for Joust's entity count (<50 objects).

### Recommended Architecture

```
GameEngine
├── Systems
│   ├── InputSystem        — reads keyboard/gamepad
│   ├── PhysicsSystem      — Rapier world step + body sync
│   ├── AISystem           — state machines per enemy
│   ├── CollisionSystem    — altitude-based win/loss, egg triggers
│   ├── WaveSystem         — spawning, difficulty scaling
│   ├── AudioSystem        — Howler.js spatial sounds
│   ├── NetworkSystem      — Colyseus room sync
│   └── RenderSystem       — Three.js scene update
├── Entities
│   ├── Player             — local or remote
│   ├── Enemy              — with AI state machine
│   └── Egg                — physics + collection trigger
└── Scenes
    ├── MenuScene
    ├── GameScene
    └── GameOverScene
```

---

## 7. Build & Tooling

| Tool | Purpose | Verdict |
|------|---------|---------|
| **Vite** (current) | Dev server + bundler | Keep — perfect choice |
| **Vitest** | Unit testing | Add |
| **ESLint + Prettier** | Code quality | Add |
| **Husky** | Pre-commit hooks | Optional |
| **GitHub Actions** | CI/CD | Recommended |

---

## 8. Asset Pipeline

### 3D Models
- **Format**: GLTF 2.0 (`.glb`) — industry standard, Three.js native support
- **Source options**:
  - Sketchfab (search "ostrich" — filter by license)
  - Mixamo (rigged humanoids) + Blender retopology
  - Blender (custom low-poly style matching Joust's aesthetic)
- **Optimization**: Compress with `gltf-pipeline` or `glTF Transform`

### Textures
- **Format**: WebP (better compression) or KTX2 (GPU-compressed, Three.js supports via `KTX2Loader`)
- **Packing**: Combine roughness/metalness/AO into one texture

### Audio
- **Format**: MP3 (universal) + OGG (fallback) via Howler sprite
- **Tool**: Audacity for editing; `ffmpeg` for conversion

---

## 9. Deployment

| Layer | Tool | Notes |
|-------|------|-------|
| **Client (static)** | Vercel or Netlify | Free tier sufficient for MVP |
| **Game Server** | Railway or Render | Node.js + Colyseus; supports WebSockets |
| **CDN** | Cloudflare | Asset caching, DDoS protection |
| **Monitoring** | Sentry | Error tracking — free tier |

---

## Final Stack Recommendation

```
Rendering:      Three.js (keep) → plan Babylon.js migration post-MVP
Physics:        Rapier (@dimforge/rapier3d-compat) — replace cannon-es
Networking:     Colyseus (server) + Socket.io (transport) — replace raw socket.io
Audio:          Howler.js
Language:       TypeScript (migrate from JS)
Build:          Vite (keep)
Testing:        Vitest
Architecture:   Hybrid OOP + Systems
Models:         GLTF 2.0 (.glb)
Server:         Node.js + Express + Colyseus
Hosting:        Vercel (client) + Railway (server)
```

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| WASM (Rapier) load time | Low | Medium | Async load with loading screen |
| Multiplayer desync | Medium | High | Rapier determinism + server authority |
| GLTF model size | Medium | Medium | glTF Transform compression |
| WebGL browser support | Low | High | Three.js handles fallbacks |
| Colyseus scaling | Low | Medium | Horizontal scaling via rooms |
| Physics-render drift | Medium | Medium | Fixed timestep + interpolation |
