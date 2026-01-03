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

## 2026-01-03 - [Zero-Allocation Animate Loop Analysis]
**Bottleneck:** GC pressure from Vector3 allocations in `main.js` animate loop.
**Root Cause Analysis:**
- `localPos.clone()` creates new Vector3 each frame (Line 506)
- `worldPos.add(parentPos)` returns new vector for moons
- `renderPos.clone().sub(parentPosRender)` creates 2 vectors (Line 529)
- **Impact:** ~30 Vector3 allocations/frame × 60fps = 1,800 allocations/sec
- Causes periodic GC pauses (frame spikes)

**Additional Issue:** Duplicate `getOrbitalPosition` calls for moons
- Parent position calculated once per child
- Same parent recalculated for each sibling moon

**Strategy:** ✅ IMPLEMENTED
1. Pre-allocate reusable Vector3 objects at module level
2. Cache parent physics positions per-frame
3. Use in-place operations instead of clone/sub

**Result:** Zero-allocation animate loop deployed. Benchmark tool available via `boltBenchmark()`.

## 2026-01-04 - [Resource Hints & Performance Testing Infrastructure]
**Bottleneck:** Network latency for CDN assets (Three.js from unpkg.com) and render-blocking CSS (39KB).
**Strategy:**
1.  **DNS Prefetch + Preconnect:** Added hints in `index.html` to reduce TTFB for unpkg.com.
2.  **CSS Preload:** Added `rel="preload"` for `style.css` to prioritize critical rendering path.
3.  **Automated Performance E2E Test:** Created `tests/e2e/performance.spec.js` that:
    - Runs `boltBenchmark()` for 5 seconds
    - Asserts FPS > 30, jankPercent < 25%, P99 < 50ms
    - Validates resource hints are present in DOM
    - Measures initialization time
**Result:** Performance regression testing now automated. Resource loading optimized via browser hints.

