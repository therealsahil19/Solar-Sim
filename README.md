# Interactive 3D Solar System

This project is a 3D visualization of a solar system using [Three.js](https://threejs.org/). It features a procedural starfield, a central Sun, a configurable system of planets and moons, and a player ship.

## Features

-   **3D Scene**: Rendered using Three.js with WebGL.
-   **Hybrid Visuals**: Supports both high-quality texture mapping (HD) and a performance-optimized solid color mode (LD), switchable at runtime.
-   **Texture Management**: Includes a custom loading manager with a visual progress bar.
-   **Recursive System Generation**: Planets and moons are generated from a nested data structure, allowing for theoretically infinite levels of sub-satellites (moons of moons).
-   **Dynamic Camera**:
    -   **Orbit Controls**: Freely zoom, rotate, and pan around the scene.
    -   **Chase View**: Toggle between a global view and a ship-following camera.
-   **Interactive Elements**:
    -   **Raycasting**: Click on any planet or moon to view detailed info (Name, Type, Size).
    -   **Player Ship**: A ship that automatically orients itself to face the nearest celestial body.
-   **Automated Verification**: Includes a "Vibe Check" script using Playwright to verify the scene renders correctly.

## Project Structure

The project follows a modular architecture:

-   `src/`: Contains the source code modules.
    -   `main.js`: The "Conductor" of the application. Handles initialization, the animation loop, and orchestrates the other modules.
    -   `procedural.js`: Factory functions for generating 3D objects (Sun, planets, ship, starfield) without side effects.
    -   `input.js`: Manages user input, including controls, raycasting (mouse clicks), and keyboard shortcuts.
-   `textures/`: Directory containing image assets for planets and the sun.
-   `index.html`: The entry point. Imports `src/main.js` as a module.
-   `system.json`: Configuration file defining the celestial bodies.
-   `test_scene.py`: A Python script for automated verification using Playwright.
-   `download_textures.py`: Helper script to download required texture assets.
-   `README.md`: This documentation file.

## Controls & Interaction

-   **Left Mouse Button**: Rotate the camera.
-   **Right Mouse Button**: Pan the camera.
-   **Scroll Wheel**: Zoom in/out.
-   **Key 'C' or 🎥 Button**: Toggle camera view between:
    -   **Sun View** (Default): Centered on the system origin.
    -   **Ship View**: Locks the camera behind the player ship ("Chase Cam").
-   **HD/LD Button**: Toggle between textured (High Definition) and solid color (Low Definition) rendering modes.
-   **Click**: Click on a planet to see a "Toast" notification with its name, type, and size relative to Earth.

## Architecture & Implementation

This project uses a modular design to separate concerns:

1.  **Main (`src/main.js`)**:
    -   Holds the global state (scene, camera, renderer).
    -   Initializes the application and kicks off the render loop.
    -   Fetches configuration data and delegates object creation to `procedural.js`.
    -   Passes the scene context to `input.js` to set up controls.
    -   **Exposed Globals**: For testing purposes, `window.scene`, `window.playerShip`, and `window.controls` are exposed globally.

2.  **Procedural Generation (`src/procedural.js`)**:
    -   Uses a "Factory" pattern. Functions like `createSystem` or `createSun` take parameters (and dependencies like `TextureLoader`) and return Three.js objects (Mesh, Group, etc.).
    -   Does not modify the global scene directly.
    -   **Recursive Generation**: `createSystem` recursively calls itself to generate moons and sub-moons based on the nested structure in `system.json`.

3.  **Input Handling (`src/input.js`)**:
    -   Encapsulates all event listeners (click, keydown, resize).
    -   Uses dependency injection: `main.js` passes the necessary context (camera, interactable objects list) to `input.js` so it can perform raycasting without needing global variables.

### Performance Optimizations
-   **Shared Geometries**: The code reuses `baseOrbitGeometry` and `baseSphereGeometry` across all instances to reduce memory usage.
-   **Raycasting Optimization**: An `interactionTargets` array tracks only the interactive meshes (planets/sun), avoiding expensive raycast checks against the starfield or orbit lines.
-   **Material Switching**: Users can toggle textures off (LD mode) for better performance on low-end devices.

## Accessibility

The application includes several features to improve accessibility:
-   **ARIA Attributes**: The main rendering canvas is explicitly labeled with `role="application"` and an `aria-label` to identify it to screen readers.
-   **Keyboard Support**: Key interactions (like camera toggling) are mapped to keyboard shortcuts.
-   **UI Contrast**: Text and buttons are styled with high-contrast backgrounds.
-   **Pointer Events**: UI overlays use `pointer-events: none` to allow clicking through to the canvas, but interactive buttons explicitly re-enable `pointer-events: auto`.

## Configuration

The solar system layout is defined in `system.json`. You can modify this file to change the simulation without touching the code.

### Data Structure (`system.json`)

The file contains an array of planet objects. Each object has:

| Property        | Type     | Description                                                                 |
| :-------------- | :------- | :-------------------------------------------------------------------------- |
| `name`          | `String` | The name of the planet or moon.                                             |
| `type`          | `String` | The type of body (e.g., 'Planet', 'Moon').                                  |
| `color`         | `Hex`    | The color of the object (e.g., `0x2233FF` or `#2233FF`).                    |
| `texture`       | `String` | (Optional) Path to the texture image file.                                  |
| `size`          | `Number` | The radius of the sphere.                                                   |
| `distance`      | `Number` | The distance from the parent body (orbit radius).                           |
| `speed`         | `Number` | The orbital speed around the parent.                                        |
| `rotationSpeed` | `Number` | The speed of the object's self-rotation.                                    |
| `moons`         | `Array`  | (Optional) An array of objects defining the satellites of this body.        |

## How to Run

Because this project uses ES modules, it must be served via a local HTTP server.

1.  Open a terminal in the project directory.
2.  Start the local server:
    ```bash
    python3 -m http.server 8000
    ```
3.  Open your web browser and go to:
    ```
    http://localhost:8000
    ```

## Automated Verification

To run the "Vibe Check" (verification script):

```bash
pip install playwright
playwright install
python3 test_scene.py
```
