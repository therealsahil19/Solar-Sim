# Interactive 3D Solar System

A web-based 3D simulation of a solar system built with [Three.js](https://threejs.org/).

## Features

-   **Realistic 3D Rendering**: Uses Three.js for rendering celestial bodies, orbits, and starfields.
-   **Procedural Generation**: Planets and moons are generated from configuration data (`system.json`).
-   **Interactive Controls**:
    -   **Orbit Controls**: Pan, zoom, and rotate around the scene.
    -   **Focus Mode**: Double-click any planet to focus the camera on it.
    -   **Ship View**: Toggle a "chase camera" mode behind a player ship.
    -   **Raycasting**: Click on planets to view details (Name, Type, Size, Distance).
-   **Dynamic Visuals**:
    -   **Trails**: Planets leave trail lines as they orbit.
    -   **Texture Toggling**: Switch between High-Res Textures (HD) and Solid Colors (LD) for performance.
    -   **Glow Effects**: Procedural sun glow.
-   **UI Overlays**:
    -   **Info Panel**: Detailed information about the selected celestial body.
    -   **Toast Notifications**: Quick feedback on interactions.
    -   **On-Screen Controls**: Buttons for camera, textures, pause, and speed.

## Project Structure

The project is organized into a modular architecture:

```
/
├── index.html          # Entry point, loads styles and modules
├── system.json         # Configuration data for planets and moons
├── textures/           # Directory for texture assets
├── src/
│   ├── main.js         # The "Conductor" - initializes scene and loop
│   ├── procedural.js   # "Factory" - creates 3D objects (planets, stars)
│   └── input.js        # "Controller" - handles user input and UI events
└── README.md           # This documentation
```

### Architecture

1.  **`src/main.js`**:
    -   Sets up the Three.js `Scene`, `Camera`, and `Renderer`.
    -   Loads `system.json` and assets.
    -   Maintains the global animation loop.
    -   Orchestrates communication between Input and State.

2.  **`src/procedural.js`**:
    -   A collection of pure factory functions.
    -   Generates meshes (`createSystem`, `createSun`, `createStarfield`).
    -   Handles material creation (Textures vs. Solid Colors).
    -   Does **not** modify the scene directly.

3.  **`src/input.js`**:
    -   Manages `OrbitControls`.
    -   Handles Raycasting (Mouse Clicks).
    -   Binds Keyboard Shortcuts (1-9, C, Space, Esc).
    -   Updates the DOM UI based on interactions.

## Configuration (`system.json`)

The simulation is data-driven. `system.json` defines the hierarchy of celestial bodies.

**Example Schema:**
```json
[
  {
    "name": "Planet Name",
    "type": "Planet",
    "color": "#RRGGBB",
    "texture": "textures/planet.jpg",
    "size": 1.0,
    "distance": 10.0,
    "speed": 0.01,
    "rotationSpeed": 0.02,
    "description": "Description text...",
    "moons": [ ... ]
  }
]
```

## Running the Project

Because the project uses ES Modules (`import`), it must be served over HTTP (not `file://`).

1.  **Python 3** (Pre-installed on most systems):
    ```bash
    python3 -m http.server
    ```

2.  Open your browser to:
    `http://localhost:8000`

## Controls

| Key | Action |
| :--- | :--- |
| **Left Click** | Select Object / Rotate Camera |
| **Right Click** | Pan Camera |
| **Scroll** | Zoom In/Out |
| **Double Click** | Focus on Object |
| **Space** | Pause/Resume Simulation |
| **C** | Toggle Camera (Overview / Ship View) |
| **Esc** | Reset View |
| **1-9** | Focus on Planet 1-9 |

## Accessibility

-   **Screen Readers**: The canvas has `role="application"` and `aria-label`.
-   **Keyboard Navigation**: Full control support via keyboard shortcuts.
-   **Visuals**: High contrast UI and adjustable settings (Textures/Labels).

---

*Built with Three.js*
