# Solar System Simulation

This project is a simple 3D visualization of a solar system using Three.js. It features a Sun, a rotating Earth orbiting the Sun, and a Moon orbiting the Earth.

## Project Structure

- `index.html`: The main entry point of the application. It contains the HTML structure and the JavaScript code (using Three.js as an ES module) to render the 3D scene.
- `test_scene.py`: A Python script that automates the verification of the application using Playwright. It starts a local server and checks if the canvas renders correctly.
- `server.log`: Log file for the server (if applicable).

## Prerequisites

To run and test this project, you need:

1.  **Python 3**: For running the local HTTP server and the test script.
2.  **Playwright**: For running the automated "Vibe Check" verification.

### Installation

If you want to run the automated tests, install the dependencies:

```bash
pip install playwright
playwright install
```

## How to Run

Since the application uses ES modules, it must be served via a local HTTP server.

1.  Start the local server:

    ```bash
    python3 -m http.server 8000
    ```

2.  Open your web browser and navigate to:

    ```
    http://localhost:8000
    ```

You should see the 3D solar system scene. You can use your mouse to rotate and zoom the camera.

## Automated Verification

To run the automated verification script (Vibe Check), execute the following command:

```bash
python3 test_scene.py
```

This script will:
1.  Start a local HTTP server on port 8000.
2.  Launch a headless browser using Playwright.
3.  Navigate to the application.
4.  Verify that the 3D canvas is present and visible.
5.  Print the result to the console.
