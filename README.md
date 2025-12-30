# Solar System Simulation

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
    -   **Raycasting**: Click on any planet or moon to trigger a visual confirmation.
    -   **Player Ship**: A ship that automatically orients itself to face the nearest celestial body.
-   **Automated Verification**: Includes a "Vibe Check" script using Playwright to verify the scene renders correctly.

## Project Structure

-   `index.html`: The main application file. It contains the HTML, CSS, and all JavaScript logic (using ES modules).
-   `textures/`: Directory containing image assets for planets and the sun.
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
-   **Click**: Click on a planet to see a "Toast" notification with its name (e.g., "Selected: Earth").

## Architecture & Implementation

This project is designed with simplicity and performance in mind, using a single-file architecture for ease of deployment and study.

### Recursive Generation
The solar system is generated recursively. Each `createSystem` call handles a celestial body and then calls itself for any children (moons). This creates a nested scene graph:
- **Pivot Object**: Rotates around the parent to create the orbital motion.
- **Body Group**: Offset from the pivot by the orbital distance.
- **Mesh**: The visible sphere, which rotates on its own axis.

### Performance Optimizations
-   **Shared Geometries**: Instead of creating a new geometry for every orbit line or planet, the code reuses a single `baseOrbitGeometry` and `baseSphereGeometry`. These are cloned and scaled, significantly reducing memory overhead.
-   **Starfield**: The background stars are rendered using a single `THREE.Points` object with thousands of vertices, rather than thousands of individual Mesh objects.
-   **Raycasting Optimization**: The application maintains a specific `interactionTargets` array containing only the clickable planets. The raycaster checks against this small list instead of traversing the entire scene graph (which includes stars, orbit lines, etc.), making clicks highly responsive.
-   **Interaction Targets**: Only objects explicitly added to the `interactionTargets` array are checked for mouse clicks, avoiding unnecessary calculations for non-interactive elements like orbit lines or stars.

## Accessibility

The application includes several features to improve accessibility:
-   **ARIA Attributes**: The main rendering canvas is explicitly labeled with `role="application"` and an `aria-label` to identify it to screen readers.
-   **Keyboard Support**: Key interactions (like camera toggling) are mapped to keyboard shortcuts.
-   **UI Contrast**: Text and buttons are styled with high-contrast backgrounds for readability against the space environment.
-   **Interactive Elements**: Buttons and controls are accessible via pointer events (`pointer-events: auto`), even when overlaying the 3D canvas (`pointer-events: none` container).

## Configuration

The solar system is defined by the `planetData` array in `index.html`. You can easily extend the simulation by adding new objects to this array.

### Data Structure

Each celestial body is defined by an object with the following properties:

| Property        | Type     | Description                                                                 |
| :-------------- | :------- | :-------------------------------------------------------------------------- |
| `name`          | `String` | The name of the planet or moon.                                             |
| `color`         | `Hex`    | The color of the object (e.g., `0x2233FF`).                                 |
| `texture`       | `String` | (Optional) Path to the texture image file.                                  |
| `size`          | `Number` | The radius of the sphere.                                                   |
| `distance`      | `Number` | The distance from the parent body (orbit radius).                           |
| `speed`         | `Number` | The orbital speed around the parent.                                        |
| `rotationSpeed` | `Number` | The speed of the object's self-rotation.                                    |
| `moons`         | `Array`  | (Optional) An array of objects defining the satellites of this body.        |

### Example: Adding a New Planet

To add a new planet, simply append a new object to the `planetData` array in `index.html`:

```javascript
{
    name: "Jupiter",
    color: 0xDDAA88,
    texture: "textures/jupiter.jpg",
    size: 2.0,
    distance: 35,
    speed: 0.002,
    rotationSpeed: 0.04,
    moons: [
        { name: "Europa", color: 0xEEEEEE, size: 0.3, distance: 3, speed: 0.04, rotationSpeed: 0.01 }
    ]
}
```

## How to Run

Because this project uses ES modules (importing Three.js directly), you cannot simply open `index.html` in a file browser. It must be served via a local HTTP server.

### Prerequisites

-   **Python 3**: Used to run the simple HTTP server.

### Steps

1.  Open a terminal in the project directory.
2.  Start the local server:
    ```bash
    python3 -m http.server 8000
    ```
3.  Open your web browser and go to:
    ```
    http://localhost:8000
    ```

## Automated Verification ("Vibe Check")

This project includes an automated test to ensure the 3D scene loads correctly.

### Prerequisites

-   **Python 3**
-   **Playwright**

### Installation

```bash
pip install playwright
playwright install
```

### Running the Test

```bash
python3 test_scene.py
```

This script will:
1.  Start a temporary local server.
2.  Launch a headless browser.
3.  Check if the canvas element is present and visible.
4.  Report the result.
