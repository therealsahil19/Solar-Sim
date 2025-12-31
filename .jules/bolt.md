## 2025-12-30 - [Optimized Raycasting Targets]
**Learning:** Raycasting against `scene.children` (recursive) includes `THREE.Points` (starfield) and `LineLoop` (orbits), causing unnecessary intersection checks on thousands of objects.
**Action:** Maintain a dedicated `interactionTargets` array containing only the interactable meshes and raycast against it with `recursive: false`.

## 2025-12-31 - [GPU-Accelerated Instancing Architecture]
**Bottleneck:** CPU-bound animation loops and excessive draw calls when scaling to 1000+ objects (e.g., Asteroid Belts). Previous O(N) approach failed at scale.
**Strategy:** Implemented `THREE.InstancedMesh` with Vertex Shader injection (`onBeforeCompile`). Orbit mechanics are calculated entirely on the GPU.
**Result:** Reduced draw calls from N (2000+) to 1. Zero CPU overhead for animating thousands of asteroids.

## 2025-01-01 - [Instanced Planetary System & Unified Trails]
**Bottleneck:** CPU-bound draw calls for large systems (e.g., 2000 moons + 2000 trails = 4000+ draw calls). Benchmarking showed severe FPS drops at scale.
**Strategy:**
1.  **Instanced Moons:** Replaced individual `THREE.Mesh` objects with `THREE.InstancedMesh` via a new `InstanceRegistry`.
2.  **Unified Trails:** Replaced individual `THREE.Line` trails with a single `LineSegments` buffer managed by `TrailManager`.
3.  **Draw Call Reduction:** Reduced draw calls from O(N) to O(1) for both moons and trails.
**Result:** Theoretical capacity increased to 10,000+ objects with minimal CPU overhead.
