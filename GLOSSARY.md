# Project Glossary

This document defines the domain-specific terminology, architectural patterns, and "Internal Code Names" used throughout the Solar-Sim codebase.

## Internal Code Names

### Bolt ⚡
**Definition:** The project's performance optimization philosophy and specific logic.
**Context:** When you see comments like `// Bolt Optimization`, it refers to strategies designed to maintain 60 FPS on low-end devices.
**Examples:**
*   **Throttling:** Running logic every N frames (e.g., UI updates).
*   **Instancing:** Using `THREE.InstancedMesh` for mass rendering.
*   **Data Textures:** Storing orbit history in GPU textures to render thousands of trail points with 0 CPU geometry overhead.
*   **Pre/Post-Render Split:** separating physics updates from trail rendering to prevent CPU stalls.

### Sentinel 🛡️
**Definition:** The project's security framework.
**Context:** Focuses on preventing XSS and enforcing Content Security Policy (CSP).
**Examples:**
*   **CSP:** Strict `meta` tags in `index.html`.
*   **SRI:** Integrity hashes on external scripts.
*   **Safe DOM:** Using `textContent` instead of `innerHTML` for user data.

### Scribe ✍️
**Definition:** The documentation standard and persona.
**Context:** Ensures code is readable and maintainable.
**Philosophy:** "If it isn't documented, it doesn't exist."

---

## 3D Graphics & Three.js

### Scene Graph
**Definition:** The hierarchical tree structure of 3D objects.
**In Solar-Sim:**
*   **Sun** is the root.
*   **Planets** are children of the Sun.
*   **Moons** are children of Planets (recursively).
*   **Visual vs. Physical:** We often separate the "Pivot" (Orbit logic) from the "Mesh" (Visuals) to handle rotation independently.

### Instancing (GPU Instancing)
**Definition:** A rendering technique where the GPU draws the same geometry multiple times with different transforms (position, rotation, scale) in a single draw call.
**Benefit:** Reduces draw calls from O(N) to O(1).
**Usage:** Used for the Asteroid Belt (`debris.ts`) and Moons (`instancing.ts`).

### Raycasting
**Definition:** Casting a line (ray) from the camera through the mouse position to detect what objects are underneath.
**Usage:** Used for selecting planets and clicking buttons in the 3D scene.
**Optimization:** We only check against specific `interactionTargets`, not the entire scene.

### Frustum Culling
**Definition:** Disabling rendering for objects outside the camera's view.
**Note:** Often disabled (`frustumCulled = false`) for our procedural belts because the bounding box of the entire belt is too large or hard to calculate dynamically.

### Spatial Grid
**Definition:** A technique to partition 2D space into cells to optimize collision detection.
**In Solar-Sim:** Used by `LabelManager` to detect overlapping labels. Instead of checking every label against every other label (O(N²)), we only check labels within the same grid cell (O(N)), ensuring performant UI updates on smaller screens.

---

## Physics & Simulation

### Keplerian Orbit
**Definition:** An orbit calculated using Johannes Kepler's laws of planetary motion.
**Parameters:**
*   **Semi-Major Axis (a):** The average distance from the focal point (size of the orbit).
*   **Eccentricity (e):** The "flatness" of the ellipse (0 = perfect circle).
*   **Inclination (i):** Tilt relative to the ecliptic plane.
*   **Argument of Periapsis (omega):** Orientation of the orbit's "closest point".
*   **Longitude of Ascending Node (Omega):** Horizontal orientation of the orbit.
*   **Mean Anomaly at Epoch (M0):** The starting position in the orbit at time 0.
**Usage:** `src/physics.ts` calculates high-precision positions using the Newton-Raphson method to solve Kepler's Equation ($M = E - e \sin E$).

### Multi-Zone Scaling
**Definition:** A rendering technique to visualize vast astronomical distances on a screen by compressing outer regions.
**Logic:**
1.  **Inner Linear (0-30 AU):** 1:1 scale for inner planets (Mercury to Neptune).
2.  **Kuiper Log (30-50 AU):** Mild logarithmic compression for the Kuiper belt.
3.  **Oort Log (>50 AU):** Aggressive compression for far objects like the Oort Cloud.
**Why:** Maintains visibility of distant objects (Pluto, Oort Cloud) without making the inner system too small to see.

---

## Architecture Patterns

### Factory Pattern
**Definition:** Pure functions that accept dependencies and return new objects.
**Usage:** `src/procedural.ts` does not hold state; it just manufactures Meshes.

### Dependency Injection (DI)
**Definition:** Passing dependencies (like `scene`, `camera`, `controls`) into a module/function rather than having that module import a global singleton.
**Usage:** `src/input.ts` receives the scene context during initialization.

### Throttling
**Definition:** Limiting how often a function executes.
**Usage:** We use a global `frameCount` variable to run heavy tasks (like updating text labels or finding the nearest planet) only every 10 frames.
