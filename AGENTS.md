# Solar-Sim – Context for Jules

## High-level description
Solar-Sim is a 3D solar system simulation built with vanilla JavaScript and Three.js in ES modules. It runs in a browser served over HTTP. It uses heavy GPU optimizations (InstancedMesh, GPU-based asteroid belt, unified trail geometry).

## Stack
- **Language**: vanilla JavaScript (ES modules), no bundler
- **Rendering**: Three.js (loaded via CDN in index.html)
- **Styling**: CSS in src/style.css
- **Data**: system.json defines the hierarchy of celestial bodies and texture paths
- **Assets**: textures/ stores planet/moon textures; download_textures.py fetches them

## How to run
Start a static HTTP server, e.g.:
```bash
python3 -m http.server
```
Open the browser to http://localhost:8000

## Key files
- `index.html` – entry, loads Three.js from CDN and src/main.js
- `src/main.js` – scene setup, render loop, update phases
- `src/procedural.js` – factory to create planets, moons, stars
- `src/input.js` – input handling, UI overlays, CommandPalette & ThemeManager init
- `src/debris.js` – GPU-animated asteroid belt via InstancedMesh + vertex shader
- `src/instancing.js` – InstanceRegistry for batching objects
- `src/trails.js` – TrailManager for unified orbit trail geometry
- `src/components/CommandPalette.js` – Cmd+K command palette UI
- `src/managers/ThemeManager.js` – visual themes, localStorage persistence
- `system.json` – data-driven config for planets/moons, including texture paths

## Architecture notes
The codebase is modular: main.js is the orchestrator, procedural.js is the factory, instancing.js/trails.js are optimizers.
Orbit/trail logic is heavily optimized; be conservative when changing those files.
Configuration changes (e.g., orbital parameters, colors, textures) should mostly be done through system.json, not hard-coding in JS.

## Jules-specific preferences
Prefer editing system.json over changing JS for things like colors, distances, labels.
Avoid touching textures/ or download_textures.py unless a task explicitly requires it.
For visual or behavioral tweaks (speed, labels, orbits), prefer editing:
- `system.json` (data)
- `src/main.js` (loop and updates)
- `src/debris.js` for asteroid belt behavior
- `src/trails.js` for trail visibility/updates

For UI changes (theme, CommandPalette behavior), edit `src/managers/ThemeManager.js` or `src/components/CommandPalette.js`.

## Internal docs
The repo has .jules/ with domain-specific notes:

- `.jules/bolt.md` – performance & optimization details
- `.jules/sentinel.md` – security tracking
- `.jules/palette.md` – design system & UI/UX decisions
