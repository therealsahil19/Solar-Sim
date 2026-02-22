# Solar-Sim – Context for Jules

## High-level description
Solar-Sim is a 3D solar system simulation built with TypeScript and Three.js. It uses Vite as a build tool. It uses heavy GPU optimizations (InstancedMesh, GPU-based asteroid belt, unified trail geometry).

## Stack
- **Language**: TypeScript
- **Build Tool**: Vite
- **Rendering**: Three.js
- **Styling**: CSS in src/style.css
- **Data**: system.json defines the hierarchy of celestial bodies and texture paths
- **Assets**: textures/ stores planet/moon textures; download_textures.py fetches them

## How to run
Install dependencies and start the dev server:
```bash
npm install
npm run dev
```
Open the browser to http://localhost:5173

## Key files
- `index.html` – entry point
- `src/main.ts` – scene setup (asynchronous chunking), render loop, update phases
- `src/procedural.ts` – factory to create planets, moons, stars
- `src/input.ts` – input handling, UI overlays, CommandPalette & ThemeManager init
- `src/debris.ts` – GPU-animated asteroid belt via InstancedMesh + vertex shader
- `src/instancing.ts` – InstanceRegistry for batching objects
- `src/trails.ts` – TrailManager for unified orbit trail geometry
- `src/shaders/` – Raw GLSL vertex and fragment shaders
- `src/components/CommandPalette.ts` – Cmd+K command palette UI
- `src/managers/ThemeManager.ts` – visual themes, localStorage persistence
- `src/managers/LabelManager.ts` – Manages 2D labels with spatial grid collision
- `src/managers/SceneManager.ts` – Wraps Three.js scene, camera, and renderer
- `system.json` – data-driven config for planets/moons, including texture paths

## Architecture notes
The codebase is modular: `main.ts` is the orchestrator, `procedural.ts` is the factory, `instancing.ts`/`trails.ts` are optimizers.
Label collision logic is optimized via a spatial grid in `LabelManager`.
Orbit/trail logic is heavily optimized; be conservative when changing those files.
Configuration changes (e.g., orbital parameters, colors, textures) should mostly be done through `system.json`, not hard-coding in TS.

## Jules-specific preferences
Prefer editing `system.json` over changing TS for things like colors, distances, labels.
Avoid touching `textures/` or `download_textures.py` unless a task explicitly requires it.
For visual or behavioral tweaks (speed, labels, orbits), prefer editing:
- `system.json` (data)
- `src/main.ts` (loop and updates)
- `src/debris.ts` for asteroid belt behavior
- `src/trails.ts` for trail visibility/updates

For UI changes (theme, CommandPalette behavior), edit `src/managers/ThemeManager.ts` or `src/components/CommandPalette.ts`.
