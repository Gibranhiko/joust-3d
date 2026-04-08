# Tech Debt — 3D Joust

Items that cannot be completed without external assets, services, or significant external setup.
Tracked here so they don't get lost and can be picked up when ready.

---

## TD-01 — 3D Models (GLTF)
**Blocks**: Phase 2 (GLTF Models & Animation)
**Reason**: Requires sourcing or creating low-poly ostrich and buzzard `.glb` models with rigged skeletons and named animations (`idle`, `flap`, `walk`, `death`, `hatch`).

**What's already done**: Procedural geometry riders (Rider.ts) are in place as stand-ins. The game is fully playable without real models.

**What's needed**:
- Low-poly ostrich model (player) — rigged, < 500 KB compressed
- Low-poly buzzard model (enemy) — rigged, < 500 KB compressed
- Egg model with hatch animation
- Arena environment model (floor, pillars, walls) as `.glb`

**Sources to check**:
- Sketchfab (filter by license: CC0 or CC-BY)
- Mixamo (rigged humanoids, can retarget to bird body in Blender)
- Create in Blender (low-poly, ~500 tris per character)

**Tools needed**: `gltf-transform` or `gltf-pipeline` for compression once models are ready.

**Plan refs**: Phase 2 (2.1–2.10), Phase 3 (3.2, 3.6)

---

## TD-02 — Audio Files
**Blocks**: Phase 4 (Audio)
**Reason**: AudioSystem is fully scaffolded (Howler.js installed, sprite map defined, all play() calls wired to game events). It just has no actual audio files yet — it fails silently.

**What's already done**: `AudioSystem.ts` wraps Howler, handles mute, and is called correctly from `GameScene.ts` on every game event.

**What's needed** (as a single sprite file: `assets/audio/sfx.mp3` + `sfx.ogg`):

| Sound | Trigger |
|-------|---------|
| `flap` | Player flaps (Space) |
| `enemy_flap` | Enemy flaps |
| `joust_win` | Player wins a collision |
| `joust_lose` | Player loses a collision |
| `egg_collect` | Player picks up egg |
| `death` | Player dies |
| `wave_clear` | All enemies defeated |

Plus: background music loop (`assets/audio/music.mp3` + `.ogg`)

**Tools**: Audacity (free) for editing. ffmpeg for MP3/OGG conversion. Freesound.org or BFXR for sound generation.

**Plan refs**: Phase 4 (4.2–4.6)

---

## TD-03 — Rapier Physics Integration ✅ COMPLETE
**Blocks**: ~~Phase 1~~ (done) → still blocks Phase 8 (Multiplayer determinism)
**Reason**: ~~Rapier installed but not wired.~~ Fully integrated as of Phase 1.

**What's already done**: Package installed, PhysicsBody interface defined in PhysicsSystem.ts — the interface is already Rapier-compatible so the swap won't touch entity code.

**What's needed**:
- Replace manual `velocityY` loop with `RAPIER.World.step()`
- Capsule colliders on Rider entities
- Static cuboid colliders on platforms
- Sensor (trigger) at lava Y for instant-kill detection
- Fixed-timestep accumulator in GameEngine loop
- Position sync: Rapier body → Three.js mesh each frame

**Why deferred**: Requires careful integration and tuning to maintain the exact Joust game feel. Works fine with manual physics for now.

**Plan refs**: Phase 1 (1.2–1.8)

---

## TD-04 — Online Multiplayer (Colyseus)
**Blocks**: Phase 8 (Online Multiplayer)
**Reason**: Requires a Node.js game server deployed to a hosting service (Railway), Colyseus installed on both client and server, and significant networking architecture work. Also depends on TD-03 (Rapier) for deterministic simulation.

**What's needed**:
- `server/` directory with Colyseus GameRoom, GameState schema, and server-side AI
- `colyseus.js` client package
- `NetworkSystem.ts` in `src/systems/`
- Deployment to Railway (or equivalent)
- `.env` setup for `VITE_COLYSEUS_URL`

**Plan refs**: Phase 8 (8.1–8.11)

---

## TD-05 — Leaderboard API
**Blocks**: Phase 11 (Leaderboard & Persistence)
**Reason**: Requires a backend service (Node.js + SQLite, or Supabase) and a deployment environment.

**What's needed**:
- REST API: `POST /scores`, `GET /scores/top`
- Database: SQLite (simple) or Supabase (hosted, free tier)
- Optional: OAuth (GitHub/Google) for persistent player identity

**Plan refs**: Phase 11 (11.1–11.5)

---

## TD-06 — CI/CD Pipeline
**Blocks**: Nothing immediate — quality-of-life
**Reason**: No `.github/workflows/` directory exists. Recommended in technical-assessment.md.

**What's needed**:
- GitHub Actions workflow: `tsc --noEmit` + `vite build` on every PR
- Optional: Vitest runs on CI once tests are written
- Optional: Auto-deploy to Vercel on merge to `main`

**Plan refs**: technical-assessment.md §7 (Build & Tooling)

---

## TD-07 — Vitest + Test Suite
**Blocks**: Nothing immediate — quality-of-life
**Reason**: Vitest is not installed. No tests exist.

**Priority test targets** (pure logic, no DOM or Three.js needed):
- `CollisionSystem.checkJoust` — altitude win/loss/tie cases
- `WaveSystem.update` — wave transition timing
- Score calculation edge cases

**Plan refs**: tech-stack.md §Testing

---

## TD-08 — PWA / Mobile Support
**Blocks**: Phase 10 (Performance & Polish)
**Reason**: Requires `manifest.json`, service worker, and touch control layout design.

**What's needed**:
- `public/manifest.json`
- Service worker (Vite PWA plugin: `vite-plugin-pwa`)
- On-screen joystick + flap button for touch devices
- Shadow/bloom quality reduction on mobile (detect via GPU tier)

**Plan refs**: Phase 10 (10.7–10.8)

---

## Summary Table

| ID | Item | Effort | Dependency Type | Priority |
|----|------|--------|-----------------|----------|
| TD-01 | GLTF Models | High | External assets | Medium |
| TD-02 | Audio Files | Medium | External assets | Medium |
| TD-03 | Rapier Physics | Medium | Code (large) | High |
| TD-04 | Online Multiplayer | Very High | Code + server infra | Low (post-MVP) |
| TD-05 | Leaderboard API | Medium | Code + server infra | Low (post-MVP) |
| TD-06 | CI/CD | Low | GitHub Actions | Low |
| TD-07 | Vitest + Tests | Low | Code | Low |
| TD-08 | PWA / Mobile | Medium | Code + design | Low |
