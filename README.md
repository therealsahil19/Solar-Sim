# Interactive 3D Solar System

A web-based 3D simulation of a solar system built with [Three.js](https://threejs.org/).

## Features

-   **Realistic 3D Rendering**: Uses Three.js for high-performance rendering of celestial bodies, orbits, and starfields.
-   **Procedural Generation**:
    -   **Data-Driven**: Planets and moons are generated entirely from configuration data (`system.json`).
    -   **Recursive Satellites**: Supports theoretically infinite nesting of moons (moons of moons).
    -   **Starfield**: Procedurally generated background stars.
    -   **Player Ship**: Procedurally generated spacecraft geometry (Cone + Cylinders).
    -   **Debris Systems**:
    -   **Asteroid Belt**: A massive, GPU-animated asteroid belt with thousands of instances. Animated via Vertex Shader for 0ms CPU overhead.
    -   **Kuiper Belt**: Distant icy objects beyond Neptune.
    -   **Oort Cloud**: A spherical shell of cometary nuclei (visualized for scale). Uses Multi-Zone Scaling for visibility across 100,000 AU.
-   **Interactive Controls**:
    -   **Orbit Controls**: Pan, zoom, and rotate around the scene with the mouse.
    -   **Focus Mode**: Double-click any planet (or use the Sidebar/Keys) to smoothly animate the camera to follow it.
    -   **Ship View**: Toggle a "Chase Camera" mode behind a procedural player ship that auto-orients to the nearest celestial body.
    -   **Raycasting**: Click on planets to view details (Name, Type, Size, Distance) via the Info Panel.
    -   **Command Palette**: A power-user interface (`Cmd+K` or `Ctrl+K`) for quick navigation and actions.
-   **Dynamic Visuals**:
    -   **Orbit Trails**: Planets leave fading trail lines as they orbit (optimized with typed arrays).
    -   **Texture Toggling**: Switch between High-Res Textures (HD) and Solid Colors (LD) for performance on low-end devices.
    -   **Dynamic Labels**: Text labels that overlay the 3D scene using `CSS2DRenderer`.
    -   **Glow Effects**: Procedural sun glow generated via offscreen canvas.
    -   **Shadows**: Dynamic point light shadows for depth.
    -   **Theming**: Multiple visual themes (Default, Blueprint, OLED) switchable via the Command Palette.
-   **UI & UX**:
    -   **Navigation Sidebar**: A collapsible sidebar listing all celestial bodies (hierarchically) for quick "fast travel" to any object, with search functionality.
    -   **Info Panel**: Detailed information overlay for selected celestial bodies, including dynamic distance calculations.
    -   **Responsive Design**: The interface (Glassmorphism panels, CSS Grid/Flexbox) adapts gracefully to mobile and desktop screens.
    -   **Toast Notifications**: Quick feedback for actions (e.g., "Textures: OFF", "View Reset") managed by `ToastManager`.
-   **On-Screen Controls**: Accessible buttons for camera, textures, pause, and speed.
-   **Settings Panel**: A slide-out panel (`comma` key) to manage all simulation preferences in one place (Textures, Labels, Orbits, Themes, Speed, and **Belt Toggles**).
-   **Speed Control**: Slider to adjust the time scale of the simulation.
-   **Onboarding**: Immediate UI shell visibility with **Skeleton UI** states during initialization, replacing the old blocking loading screen. Includes an initial "Welcome" modal.

## Performance & Optimizations ("Bolt")

This project implements several optimization strategies (internally referred to as "Bolt") to ensure high performance (60 FPS) even on lower-end devices:

1.  **Throttling**:
    -   **UI Updates**: Dynamic text updates (like "Distance to Sun") are throttled to run only every 10 frames to minimize DOM manipulation overhead.
    -   **Nearest Neighbor Search**: The logic for the ship to face the nearest planet runs every 10 frames, caching the result in between.
    -   **Trail Updates**: Vertex updates for orbit trails are throttled to every 2 frames.

2.  **Caching**:
    -   **Material Cache**: Solid color materials are cached by color key to reduce the number of shader programs and draw calls.
    -   **Matrix Caching**: The render loop uses `matrixWorld` from the previous frame for position calculations instead of forcing synchronous `updateWorldMatrix()` calls.

3.  **Memory Management**:
    -   **Shared Geometry**: All orbit lines share a single unit-circle geometry, scaled per instance. The same applies to spheres.
    -   **Typed Arrays**: Trail updates use `Float32Array.prototype.copyWithin` for highly efficient memory shifting (O(N)) instead of manual array iteration.

4.  **Render Loop Splitting**:
    -   The loop is split into a **Pre-Render** phase (updating object rotations) and a **Post-Render** phase (updating trails). This allows the trail logic to read the most recent GPU-computed matrices without stalling the CPU.

5.  **GPU Animation & Instancing**:
    -   **InstancedMesh (`InstanceRegistry`)**: Manages thousands of instances (like moons or asteroids) with O(1) draw calls per geometry.
    -   **Asteroid Belt**: Uses `THREE.InstancedMesh` with Vertex Shader injection to animate orbits entirely on the GPU.
    -   **Trails (`TrailManager`)**: Renders thousands of orbit trails using a single `THREE.LineSegments` geometry, massively reducing draw calls.

6.  **Benchmarking**:
    -   **Bolt Benchmark (`benchmark.ts`)**: A built-in performance suite that measures frame timing statistics, P95/P99 latency, and jank percentage.

## Security ("Sentinel")

The application enforces strict security measures:

-   **Content Security Policy (CSP)**: A strict CSP in `index.html` restricts script sources to `self` and trusted CDNs (unpkg), blocking inline scripts and unauthorized connections.
-   **Subresource Integrity (SRI)**: All external Three.js scripts loaded from CDNs use `integrity` hashes to ensure the code hasn't been tampered with.

## Project Structure

The project is organized into a modular architecture:

```
/
├── index.html            # Entry point, loads styles and modules
├── system.json           # Configuration data for planets and moons
├── textures/             # Directory for texture assets
├── download_textures.py  # Helper script to fetch assets
├── src/
│   ├── main.ts           # The "Conductor" - initializes scene and loop
│   ├── procedural.ts     # "Factory" - creates 3D objects (planets, stars)
│   ├── input.ts          # "Controller" - handles user input and UI events
│   ├── physics.ts        # "Engineer" - handles Keplerian orbits and multi-zone scaling
│   ├── debris.ts         # "Generator" - creates GPU-accelerated asteroid belt
│   ├── instancing.ts     # "Optimizer" - manages InstancedMesh groups
│   ├── trails.ts         # "Optimizer" - manages unified orbit trail geometry
│   ├── benchmark.ts      # "Bolt" - performance benchmarking tool
│   ├── style.css         # Design System tokens and styles
│   ├── components/
│   │   ├── CommandPalette.ts    # Searchable command menu (Cmd+K)
│   │   ├── InfoPanel.ts         # Object details overlay panel
│   │   ├── Modal.ts             # Reusable accessible <dialog> wrapper
│   │   ├── NavigationSidebar.ts # Hierarchical planet navigation tree
│   │   └── SettingsPanel.ts    # Slide-out simulation preferences panel
│   ├── managers/
│   │   ├── SettingsManager.ts   # "State" - persists user preferences
│   │   ├── ThemeManager.ts      # "State" - handles visual themes
│   │   └── ToastManager.ts      # "State" - manages stackable notifications
└── README.md             # This documentation
```

### Architecture

### Architecture Patterns

The simulation is built on a decoupled, event-driven architecture designed for high performance and maintainability:

1.  **Conductor (main.ts)**: Orchestrates the initialization and the high-frequency render loop.
2.  **Factory (procedural.ts)**: Pure functions that build Three.js objects from configuration data.
3.  **Controller (input.ts)**: Manages all user interactions and UI events using dependency injection.
4.  **Optimizers (instancing.ts, trails.ts)**: Low-level modules that batch draw calls to the GPU.
5.  **State (managers/)**: Independent modules that handle persistence and cross-component state.

1.  **`src/main.ts`**:
    -   **Orchestrator**: Sets up the Three.js `Scene`, `Camera`, `Renderer`, and `Lighting`.
    -   **Render Loop**: Manages the animation loop, split into Pre-Render (updates) and Post-Render (trails) phases for optimization.
    -   **Throttling**: Uses `frameCount` to throttle expensive operations like UI updates and Nearest Neighbor search for the ship.

2.  **`src/procedural.ts`**:
    -   **Factory Pattern**: Pure functions that accept dependencies (like `TextureLoader`) and return Three.js objects.
    -   **Recursion**: `createSystem` recursively builds the scene graph for planets and their moons.
    -   **Material Management**: Creates both Textured and Solid materials for runtime switching.

3.  **`src/input.ts`**:
    -   **Dependency Injection**: Receives scene context to attach controls without global state dependency.
    -   **Event Handling**: Centralizes `OrbitControls`, Raycasting (Mouse Clicks), and Keyboard Listeners.
    -   **UI Updates**: Manages the DOM overlays (Info Panel, Toasts) based on interaction.
    -   **Component Initialization**: Initializes the `CommandPalette` and `ThemeManager`.

4.  **`src/instancing.ts`**:
    -   **Instance Registry**: Centralizes `THREE.InstancedMesh` management.
    -   **Batching**: Groups objects by geometry and material to reduce draw calls from O(N) to O(G*M).

5.  **`src/trails.ts`**:
    -   **Trail Manager**: Manages a single `THREE.LineSegments` mesh for all orbit trails.
    -   **Performance**: Avoids creating thousands of individual `THREE.Line` objects.

6.  **`src/components/CommandPalette.js`**:
    -   **Component**: A reusable UI component that provides a searchable command menu.
    -   **Accessibility**: Implements WAI-ARIA Combobox pattern for full keyboard and screen reader support.

7.  **`src/components/InfoPanel.js`**:
    -   **Data Binding**: Displays details of a selected celestial object using its `userData`.
    -   **State Management**: Manages visibility/hiding via CSS classes.
    -   **Accessibility**: Uses ARIA attributes to announce updates to screen readers.

8.  **`src/components/Modal.js`**:
    -   **Wrapper Pattern**: A thin wrapper around the native `<dialog>` element for consistency.
    -   **Accessibility**: Leverages built-in `<dialog>` focus trapping and Escape key handling.
    -   **Lifecycle**: Provides `open()`, `close()`, and `dispose()` methods for clean resource management.

9.  **`src/components/NavigationSidebar.js`**:
    -   **DOM Generation**: Recursively builds a tree view from hierarchical system data.
    -   **Client-side Search**: Implements a "Show Matches & Parents" filter strategy.
    -   **Decoupled Design**: Communicates with the 3D scene purely via callbacks, maintaining separation of concerns.

10. **`src/managers/ThemeManager.ts`**:
    -   **State Management**: Handles theme switching and persistence via localStorage.

11. **`src/components/SettingsPanel.ts`**:
    -   **Unified UI**: Provides a single interface for all simulation settings.
    -   **Persistence**: Interfaces with `SettingsManager` to save/load user preferences.
    -   **Accessibility**: Implements keyboard shortcuts (`,`) and focus management.

12. **`src/managers/ToastManager.ts`**:
    -   **Notifications**: Manages stackable, accessible toast notifications.
    -   **Feedback**: Decoupled from core logic, triggered by UI events or status changes.

13. **`src/benchmark.ts`**:
    -   **Tooling**: Provides the `boltBenchmark()` global function for performance auditing.
    -   **Metrics**: Calculates average FPS, jank percentage, and P99 frame times.

## Configuration (`system.json`)

The simulation is data-driven. `system.json` defines the hierarchy of celestial bodies.

### Configuration Properties

| Property | Type | Description |
| :--- | :--- | :--- |
| `name` | String | The display name of the celestial body. |
| `type` | String | Classification: "Planet", "Moon", "Dwarf Planet", or "Star". |
| `physics` | Object | **Orbital elements (Keplerian)**: |
| `physics.a` | Number | Semi-major axis in AU (defines orbital size/distance). |
| `physics.e` | Number | Eccentricity (0.0 = circle, 0.99 = highly elliptical). |
| `physics.i` | Number | Inclination in degrees (tilt relative to ecliptic plane). |
| `physics.omega`| Number | Argument of Periapsis in degrees (orientation of the ellipse).|
| `physics.Omega`| Number | Longitude of Ascending Node in degrees. |
| `physics.M0` | Number| Mean Anomaly at Epoch (starting position in degrees). |
| `visual` | Object | **Visual rendering properties**: |
| `visual.size` | Number | Relative diameter (compared to Earth = 1.0). |
| `visual.color` | String | Hex code for the fallback solid color. |
| `visual.texture`| String | Path to the JPG texture (e.g., `textures/earth.jpg`). |
| `visual.hasRing`| Bool | (Optional) Whether to render Saturn-like rings. |
| `description` | String | Background info shown in the Info Panel. |
| `moons` | Array | (Optional) Nested list of satellite objects (recursive schema). |

**Example Schema:**
```json
[
  {
    "name": "Earth",
    "type": "Planet",
    "physics": {
      "a": 1.000,
      "e": 0.0167,
      "i": 0.00,
      "omega": 288.06,
      "Omega": 174.87,
      "M0": 358.61
    },
    "visual": {
      "size": 1.0,
      "color": "#2233FF",
      "texture": "textures/earth.jpg"
    },
    "description": "Our home planet.",
    "moons": [ ... ]
  }
]
```

## Running the Project

### 1. Prerequisites
-   **Python 3** (or any static file server)

### 2. Setup
Download the required textures (optional, if `textures/` is empty):
```bash
python3 download_textures.py
```
*Note: This script fetches assets from solarsystemscope.com.*

### 3. Start Server
Because the project uses ES Modules (`import`), it must be served over HTTP (not `file://`).
```bash
python3 -m http.server
```

### 4. View
Open your browser to: `http://localhost:8000`

## Testing

The project uses [Playwright](https://playwright.dev/) for End-to-End (E2E) testing to ensure UI stability and performance.

### 1. Install Browsers
```bash
npx playwright install
```

### 2. Run All Tests
```bash
npx playwright test
```

### 3. Run Specific Test
```bash
npx playwright test tests/e2e/settings-panel.spec.js
```

### 4. Debugging Tests
To run tests with a UI or in headed mode:
```bash
npx playwright test --ui
# OR
npx playwright test --headed
```

## Environment Variables

While the project currently relies on static assets and a simple HTTP server, you can configure the following environment variables if deploying to a formal environment (e.g., Vercel, Netlify):

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | The port the server should listen on. | `8000` |
| `DEBUG` | Enable verbose logging for simulation logic. | `false` |

## Controls

| Key | Action |
| :--- | :--- |
| **Cmd/Ctrl+K** | Open Command Palette |
| **Left Click** | Select Object / Rotate Camera |
| **Right Click** | Pan Camera |
| **Scroll** | Zoom In/Out |
| **Double Click** | Focus on Object |
| **Space** | Pause/Resume Simulation |
| **C** | Toggle Camera (Overview / Ship View) |
| **L** | Toggle Labels (Show/Hide) |
| **O** | Toggle Orbits & Trails (Show/Hide) |
| **T** | Toggle Textures (HD / LD) |
| **,** (Comma) | Toggle Settings Panel |
| **Esc** | Reset View |
| **1-9** | Focus on Planet 1-9 |

## Accessibility

The application is designed to be accessible:
-   **Semantic HTML**: Uses proper button elements and inputs for UI controls.
-   **ARIA Attributes**:
    -   `role="application"` on the canvas.
    -   `aria-pressed` on toggle buttons (Camera, Textures, Labels, Orbits).
    -   `aria-label` for state changes (e.g., Pause/Resume).
    -   `aria-live="polite"` for Toast notifications.
    -   `aria-valuenow` for loading bars and sliders.
    -   `aria-hidden` for managing sidebar visibility.
    -   **Command Palette**: Implements `role="combobox"` and `aria-activedescendant` for full screen reader and keyboard support.
-   **Keyboard Navigation**: All core actions are mapped to keyboard shortcuts.
-   **Visuals**: High contrast UI text and support for disabling complex textures/labels for clarity.

## Quality & Audit

The project undergoes regular visual and logical audits to ensure high standards:
- [Visual QA Report](file:///c:/Users/mehna/OneDrive/Desktop/Solar-Sim/visual_report.md): Tracking UI inconsistencies and layout shifts.
- [Security & Logic Audit (Hunted)](file:///c:/Users/mehna/OneDrive/Desktop/Solar-Sim/hunted.md): Identifying code smells, logic flaws, and potential security risks.

## Troubleshooting

### Textures not loading?
- Ensure you are running the project through an HTTP server (e.g., `python3 -m http.server`).
- Check the console for 404 errors; you may need to run `python3 download_textures.py`.

### Performance Lag?
- **Bolt Optimization**: Toggle Textures (T key) or Labels (L key) to reduce GPU load.
- **Instancing**: The project automatically uses instancing for moons and asteroids to save draw calls.

## Development

This project maintains internal documentation for specific domains in the `.Jules/` directory:
-   `bolt.md`: Performance logs and optimization details.
-   `sentinel.md`: Security vulnerability tracking and fixes.
-   `palette.md`: Design system and UI/UX decisions.

---

*Built with Three.js*
