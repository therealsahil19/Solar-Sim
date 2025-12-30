# Solar System Simulation

This project is a 3D visualization of a solar system using [Three.js](https://threejs.org/). It features a procedural starfield, a central Sun, and a configurable system of planets and moons.

## Features

-   **3D Scene**: Rendered using Three.js with WebGL.
-   **Procedural Geometry**: Uses standard Three.js geometries for planets, orbits, and stars (no external texture assets required).
-   **Recursive System Generation**: Planets and moons are generated from a nested data structure, allowing for theoretically infinite levels of sub-satellites (moons of moons).
-   **Orbit Controls**: Users can zoom, rotate, and pan around the scene.
-   **Automated Verification**: Includes a "Vibe Check" script using Playwright to verify the scene renders correctly.

## Project Structure

-   `index.html`: The main application file. It contains the HTML, CSS, and all JavaScript logic (using ES modules).
-   `test_scene.py`: A Python script for automated verification using Playwright.
-   `README.md`: This documentation file.

## Configuration

The solar system is defined by the `planetData` array in `index.html`. You can easily extend the simulation by adding new objects to this array.

### Data Structure

Each celestial body is defined by an object with the following properties:

| Property        | Type     | Description                                                                 |
| :-------------- | :------- | :-------------------------------------------------------------------------- |
| `name`          | `String` | The name of the planet or moon.                                             |
| `color`         | `Hex`    | The color of the object (e.g., `0x2233FF`).                                 |
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
