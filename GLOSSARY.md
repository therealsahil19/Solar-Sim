# Project Glossary

This document defines the domain-specific terminology, architectural patterns, and "Internal Code Names" used throughout the Solar-Sim codebase.

## Internal Code Names

### Bolt ⚡
**Definition:** The project's performance optimization philosophy and specific logic.
**Context:** When you see comments like `// Bolt Optimization`, it refers to strategies designed to maintain 60 FPS on low-end devices.
**Examples:**
*   **Throttling:** Running logic every N frames (e.g., UI updates).
*   **Instancing:** Using `THREE.InstancedMesh` for mass rendering.
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
**Usage:** Used for the Asteroid Belt (`debris.js`) and Moons (`instancing.js`).

### Raycasting
**Definition:** Casting a line (ray) from the camera through the mouse position to detect what objects are underneath.
**Usage:** Used for selecting planets and clicking buttons in the 3D scene.
**Optimization:** We only check against specific `interactionTargets`, not the entire scene.

### Frustum Culling
**Definition:** Disabling rendering for objects outside the camera's view.
**Note:** Often disabled (`frustumCulled = false`) for our procedural belts because the bounding box of the entire belt is too large or hard to calculate dynamically.

---

## Physics & Simulation

### Keplerian Orbit
**Definition:** An orbit calculated using Johannes Kepler's laws of planetary motion.
**Parameters:**
*   **Semi-Major Axis (a):** The size of the orbit.
*   **Eccentricity (e):** How "oval" the orbit is.
*   **Inclination (i):** The tilt of the orbit relative to the flat plane.
**Usage:** `src/physics.js` calculates exact positions based on time.

### Multi-Zone Scaling
**Definition:** A rendering trick to visualize vast astronomical distances on a computer screen without losing precision (z-fighting) or visibility.
**Logic:**
*   **Inner System (0-30 AU):** Linear Scale (1 AU = 40 Units).
*   **Outer System (>30 AU):** Logarithmic Scale (Distances are compressed).
**Why:** Keeps Pluto visible even though it's incredibly far away.

---

## Architecture Patterns

### Factory Pattern
**Definition:** Pure functions that accept dependencies and return new objects.
**Usage:** `src/procedural.js` does not hold state; it just manufactures Meshes.

### Dependency Injection (DI)
**Definition:** Passing dependencies (like `scene`, `camera`, `controls`) into a module/function rather than having that module import a global singleton.
**Usage:** `src/input.js` receives the scene context during initialization.

### Throttling
**Definition:** Limiting how often a function executes.
**Usage:** We use a global `frameCount` variable to run heavy tasks (like updating text labels or finding the nearest planet) only every 10 frames.
