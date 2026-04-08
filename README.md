# 3D Joust

A browser-based 3D remake of the 1982 Atari arcade classic, built with Three.js and TypeScript.

## Play

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Controls

| Key | Action |
|-----|--------|
| `WASD` / Arrow keys | Move |
| `Space` | Flap wings (gain altitude) |

## How to play

- Collide with enemy riders — the **higher player wins** the joust
- The losing rider drops an **egg** — collect it for bonus points
- Survive waves of increasingly aggressive enemies
- Falling into the **lava** costs a life
- Game over when all lives are lost

## Tech stack

| Layer | Tool |
|-------|------|
| Renderer | Three.js |
| Physics | Manual AABB (Rapier planned — Phase 1) |
| Audio | Howler.js |
| Language | TypeScript |
| Build | Vite |

See [tech-stack.md](tech-stack.md) and [technical-assessment.md](technical-assessment.md) for full stack decisions and rationale.

## Project structure

```
src/
├── main.ts              Entry point
├── GameEngine.ts        Renderer, game loop, HUD
├── types.ts             Constants, platform layout, wave config
├── entities/
│   ├── Rider.ts         Base class for Player and Enemy
│   ├── Player.ts
│   ├── Enemy.ts
│   └── Egg.ts
├── systems/
│   ├── InputSystem.ts   Keyboard state
│   ├── PhysicsSystem.ts Gravity, platform collision
│   ├── AISystem.ts      Enemy patrol / chase / evade
│   ├── CollisionSystem.ts  Joust resolution, egg pickup
│   ├── WaveSystem.ts    Wave progression and spawning
│   └── AudioSystem.ts   Sound effects and music
└── scenes/
    └── GameScene.ts     Main gameplay orchestration
```

## Roadmap

See [plan.md](plan.md) for the full 11-phase development roadmap.

**Current phase: Phase 0 complete** — TypeScript, modular architecture, bug-free base.

Next up:
- **Phase 1** — Rapier physics integration
- **Phase 2** — GLTF ostrich models and skeletal animation
- **Phase 3** — Arena polish, lava shader, particles
- **Phase 4** — Full audio
- **Phase 5** — Advanced AI and 10+ wave progression
- **Phase 8** — Online multiplayer (Colyseus)

## Scripts

```bash
npm run dev      # Start dev server at localhost:5173
npm run build    # Production build → dist/
npm run preview  # Preview production build locally
```
