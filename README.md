# Interactive 3D Solar System

A web-based 3D simulation of a solar system built with [Three.js](https://threejs.org/).

## Features

-   **Realistic 3D Rendering**: Uses Three.js for high-performance rendering of celestial bodies, orbits, and starfields.
-   **Procedural Generation**:
    -   **Data-Driven**: Planets and moons are generated entirely from configuration data (`system.json`).
    -   **Recursive Satellites**: Supports theoretically infinite nesting of moons (moons of moons).
    -   **Starfield**: Procedurally generated background stars.
    -   **Player Ship**: Procedurally generated spacecraft geometry (Cone + Cylinders).
    -   **Asteroid Belt**: A massive, GPU-animated asteroid belt with thousands of instances.
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
    -   **Toast Notifications**: Quick feedback for actions (e.g., "Textures: OFF", "View Reset").
    -   **On-Screen Controls**: Accessible buttons for camera, textures, pause, and speed.
    -   **Speed Control**: Slider to adjust the time scale of the simulation.
    -   **Onboarding**: Loading screen with progress bar and an initial "Welcome" modal.

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

## Security ("Sentinel")

The application enforces strict security measures:

-   **Content Security Policy (CSP)**: A strict CSP in `index.html` restricts script sources to `self` and trusted CDNs (unpkg), blocking inline scripts and unauthorized connections.
-   **Subresource Integrity (SRI)**: All external Three.js scripts loaded from CDNs use `integrity` hashes to ensure the code hasn't been tampered with.

## Project Structure

The project is organized into a modular architecture:

```
/
├── index.html          # Entry point, loads styles and modules
├── system.json         # Configuration data for planets and moons
├── textures/           # Directory for texture assets
├── download_textures.py # Helper script to fetch assets
├── src/
│   ├── main.js         # The "Conductor" - initializes scene and loop
│   ├── procedural.js   # "Factory" - creates 3D objects (planets, stars)
│   ├── input.js        # "Controller" - handles user input and UI events
│   ├── debris.js       # "Generator" - creates GPU-accelerated asteroid belt
│   ├── instancing.js   # "Optimizer" - manages InstancedMesh groups
│   ├── trails.js       # "Optimizer" - manages unified orbit trail geometry
│   ├── components/
│   │   └── CommandPalette.js # Class-based UI component for "Cmd+K" menu
│   ├── managers/
│   │   └── ThemeManager.js   # Manages visual themes and persistence
│   └── style.css       # Design System tokens and styles
└── README.md           # This documentation
```

### Architecture

1.  **`src/main.js`**:
    -   **Orchestrator**: Sets up the Three.js `Scene`, `Camera`, `Renderer`, and `Lighting`.
    -   **Render Loop**: Manages the animation loop, split into Pre-Render (updates) and Post-Render (trails) phases for optimization.
    -   **Throttling**: Uses `frameCount` to throttle expensive operations like UI updates and Nearest Neighbor search for the ship.

2.  **`src/procedural.js`**:
    -   **Factory Pattern**: Pure functions that accept dependencies (like `TextureLoader`) and return Three.js objects.
    -   **Recursion**: `createSystem` recursively builds the scene graph for planets and their moons.
    -   **Material Management**: Creates both Textured and Solid materials for runtime switching.

3.  **`src/input.js`**:
    -   **Dependency Injection**: Receives scene context to attach controls without global state dependency.
    -   **Event Handling**: Centralizes `OrbitControls`, Raycasting (Mouse Clicks), and Keyboard Listeners.
    -   **UI Updates**: Manages the DOM overlays (Info Panel, Toasts) based on interaction.
    -   **Component Initialization**: Initializes the `CommandPalette` and `ThemeManager`.

4.  **`src/instancing.js`**:
    -   **Instance Registry**: Centralizes `THREE.InstancedMesh` management.
    -   **Batching**: Groups objects by geometry and material to reduce draw calls from O(N) to O(G*M).

5.  **`src/trails.js`**:
    -   **Trail Manager**: Manages a single `THREE.LineSegments` mesh for all orbit trails.
    -   **Performance**: Avoids creating thousands of individual `THREE.Line` objects.

6.  **`src/components/CommandPalette.js`**:
    -   **Component**: A reusable UI component that provides a searchable command menu.
    -   **Accessibility**: Implements WAI-ARIA Combobox pattern.

7.  **`src/managers/ThemeManager.js`**:
    -   **State Management**: Handles theme switching and persistence via localStorage.

## Configuration (`system.json`)

The simulation is data-driven. `system.json` defines the hierarchy of celestial bodies.

### Configuration Properties

| Property | Type | Description |
| :--- | :--- | :--- |
| `name` | String | The display name of the celestial body. |
| `type` | String | The classification (e.g., "Planet", "Moon", "Star"). |
| `color` | String | Hex color code (e.g., "#2233FF") used for Solid/LD mode. |
| `texture` | String | Path to the texture image (e.g., "textures/earth.jpg"). |
| `size` | Number | Radius of the object relative to Earth (Earth = 1.0). |
| `distance` | Number | Distance from the parent object (orbit radius). |
| `speed` | Number | Orbital speed around the parent. |
| `rotationSpeed` | Number | Speed of rotation around its own axis. |
| `hasRing` | Boolean | (Optional) If true, generates a procedural ring around the planet. |
| `description` | String | Text shown in the Info Panel when selected. |
| `moons` | Array | (Optional) Recursive list of satellite objects (same schema). |

**Example Schema:**
```json
[
  {
    "name": "Earth",
    "type": "Planet",
    "color": "#2233FF",
    "texture": "textures/earth.jpg",
    "size": 1.0,
    "distance": 15.0,
    "speed": 0.01,
    "rotationSpeed": 0.02,
    "hasRing": false,
    "description": "Our home planet.",
    "moons": [
       {
         "name": "Moon",
         "type": "Moon",
         "size": 0.27,
         "distance": 2.5,
         ...
       }
    ]
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

## Development

This project maintains internal documentation for specific domains in the `.jules/` directory:
-   `bolt.md`: Performance logs and optimization details.
-   `sentinel.md`: Security vulnerability tracking and fixes.
-   `palette.md`: Design system and UI/UX decisions.

---

*Built with Three.js*
