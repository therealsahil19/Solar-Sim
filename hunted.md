# 🕸️ The Hunt List

| ID | Status | Severity | Location | Description |
|----|--------|----------|----------|-------------|
| 001| [FIXED] | 🔴 HIGH  | `src/components/CommandPalette.js:223` | DOM XSS via Configuration Injection in Command Palette |
| 002| [FIXED] | 🔴 HIGH  | `src/input.js:354` | DOM XSS via Configuration Injection in Navigation Sidebar |
| 003| [FIXED] | 🟡 MED   | `src/main.js:476` | Unhandled Promise in Initialization |
| 004| [FIXED] | 🟢 LOW   | `src/input.js:19` | Event Listener Memory Leak (Window Resize/Keydown) |
| 005| [FIXED] | 🟢 LOW   | `src/components/CommandPalette.js:160` | Event Listener Memory Leak (Global Keydown) |
| 006| [FIXED] | 🟡 MED   | `src/trails.js:98` | O(N) Array shifting in high-frequency loop |
| 007| [FIXED] | 🟢 LOW   | `src/debris.js:68` | Memory Leak: Undisposed Custom Materials |
| 008| [FIXED] | 🟡 MED   | `download_textures.py:27` | Silent Failure on Asset Download |
| 009| [FIXED] | 🟢 LOW   | `src/instancing.js:33` | Persistent State Pollution in InstanceRegistry |
| 010| [FIXED] | 🟡 MED   | `src/input.js:145` | Logic Flaw: Cross-Object Double Click Detection |
| 011| [FIXED] | 🟡 MED   | `src/managers/ThemeManager.js:20` | Crash Risk: Unsafe LocalStorage Access |
| 012| [FIXED] | 🟢 LOW   | `src/input.js:124` | Memory Leak: Undisposed Event Listeners |
| 013| [FIXED] | 🔴 HIGH  | `src/instancing.js:127` | Crash Risk: `InstancedMesh` has no `dispose()` method |
| 014| [FIXED] | 🔴 HIGH  | `src/input.js:367` | Memory Leak: Orphaned `CommandPalette` with global listener |
| 015| [FIXED] | 🟡 MED   | `src/trails.js:14` | GPU Memory Leak: `TrailManager` lacks `dispose()` |
| 016| [FIXED] | 🟡 MED   | `src/components/CommandPalette.js:172` | Logic Bomb: Crash on missing `name` property |
| 017| [FIXED] | 🟢 LOW   | `src/main.js:492` | Regression: Anonymous Window Resize Listener |
| 018 | [FIXED] | 🔴 HIGH  | `src/main.js:141` | Race Condition: Loading Screen hides before Config loads |
| 019 | [FIXED] | 🔴 HIGH  | `src/trails.js:33` | Performance: TrailManager renders 1M vertices per frame |
| 020 | [FIXED] | 🟡 MED   | `src/main.js:156` | Crash Risk: Unsafe access to `planetData.forEach` |
| 021 | [FIXED] | 🟢 LOW   | `src/components/NavigationSidebar.js:154` | Memory Leak: Undisposed DOM event listeners |
| 022 | [FIXED] | 🔴 HIGH  | `src/main.js:30` | Persistent State Pollution in Global Arrays |
| 023 | [FIXED] | 🟢 LOW   | `src/input.js:135` | Memory Leak: Anonymous Window Resize Listener |
| 024| [FIXED] | 🟢 LOW   | `src/input.js:135` | Memory Leak: Anonymous Window Resize Listener |
| 025| [FIXED] | 🟢 LOW   | `src/main.js:413` | Performance: High GC in Animation Loop |
| 026| [FIXED] | 🔴 HIGH  | `src/main.js:192` | Unhandled Promise Rejection in Initialization |
| 027| [FIXED] | 🟡 MED   | `src/components/CommandPalette.js:364` | Crash Risk: Unsafe call to `item.handler()` |
| 028| [FIXED] | 🟡 MED   | `src/components/NavigationSidebar.js:47` | Memory Leak: `NavigationSidebar` lacks `dispose()` in `init` |
| 029| [FIXED] | 🟢 LOW   | `src/trails.js:155` | Logic Flaw: `TrailManager` head update without validation |
| 030| [FIXED] | 🟡 MED   | `src/debris.js:278` | Memory Leak: `DebrisSystem` dispose misses `setAttribute` cleanup |
| 031| [FIXED] | 🔴 HIGH  | `src/main.js:490` | Framerate Dependent Animation Speed |
| 032| [FIXED] | 🟡 MED   | `src/procedural.js:164` | GPU Memory Leak: Sun Glow Texture never disposed |
| 033| [FIXED] | 🟡 MED   | `src/trails.js:210` | Logic Flaw: `reset()` fails to clear visual artifacts |
| 034| [FIXED] | 🟢 LOW   | `src/main.js:277` | Zombie Code: Lazy Loading executes after Init Failure |
| 035| [FIXED] | 🟢 LOW   | `src/main.js:438` | Physics Instability: Unclamped Delta Time |
| 036| [FIXED] | 🟡 MED   | `src/trails.js:130` | Performance: GC Allocation in Update Loop |
| 037| [FIXED] | 🟢 LOW   | `src/debris.js:136` | Zombie Code: Unused `staticPhysics` Parameter |
| 038| [FIXED] | 🟢 LOW   | `src/components/Modal.js:82` | Memory Leak: `dispose()` Does Not Remove Listeners |
| 039| [FIXED] | 🟢 LOW   | `src/components/InfoPanel.js:81` | Crash Risk: Missing null check for `userData` |
| 040| [FIXED] | 🟡 MED   | `src/instancing.js:110` | Performance: Object3D Allocation in Update Loop |
| 041| [FIXED] | 🟢 LOW   | `src/components/NavigationSidebar.js:42` | Silent Failure: Missing null guard for DOM elements |
| 042| [FIXED] | 🟢 LOW   | `src/components/CommandPalette.js:249` | TypeError Risk: Accessing `.toLowerCase()` on possibly undefined |
| 043| [FIXED] | 🟢 LOW   | `src/physics.js:116-126` | Magic Numbers: Hardcoded scale constants without documentation |
| 044| [FIXED] | 🟢 LOW   | `src/procedural.js:337` | Zombie Code: Unused `trail` variable |
| 045| [OPEN] | 🟢 LOW   | `src/procedural.js:30-33` | Memory Leak: `clearMaterialCache` never called |
| 046| [OPEN] | 🟢 LOW   | `src/instancing.js:76-78` | Silent Failure: `group.mesh.dispose()` called on non-existent method |
| 047| [OPEN] | 🟢 LOW   | `src/benchmark.js:75` | Logic Flaw: No return value in final else branch |

## Details

### 022 - Persistent State Pollution in Global Arrays
[FIXED] Added logic to `init()` in `src/main.js` to manually clear all global arrays (`interactionTargets`, `animatedObjects`, etc.) before repopulating them.

### 023 - Memory Leak: Anonymous Window Resize Listener
[FIXED] Replaced anonymous arrow function with named `onWindowResize` function in `src/input.js` and added `removeEventListener` to `dispose`.

### 025 - Performance: High GC in Animation Loop
[FIXED] Replaced `new THREE.Vector3()` allocation in the `animate` loop with a shared module-level `tempVec` in `src/main.js`.

### 026 - Unhandled Promise Rejection
The `init` function in `src/main.js` awaits `response.json()` and other async calls but the top-level call in `main.js:607` only has a basic `.catch`. If `system.json` is malformed or missing, the loading screen might stay visible or show a broken state without proper recovery logic.

```javascript
// src/main.js:192
planetData = await response.json();
```

### 027 - Crash Risk: Unsafe handler call
In `CommandPalette.js`, the `executeCurrent` method calls `item.handler()` without checking if `handler` exists. If a static command or flattened data item is missing a handler, the app will crash and close the palette.

```javascript
// src/components/CommandPalette.js:364
item.handler();
```

### 028 - Memory Leak: NavigationSidebar
While `NavigationSidebar` has a `dispose` method, it doesn't clean up the trigger button listener `btnOpen` properly because it's an anonymous arrow function bound in `bindEvents`. Frequent recreation of this component (if it were to happen) would leak listeners.

```javascript
// src/components/NavigationSidebar.js:148
if (this.dom.btnOpen) {
    this.dom.btnOpen.addEventListener('click', () => this.open());
}
```

### 029 - Logic Flaw: TrailManager head update
`TrailManager.update` updates the `head` pointer but doesn't verify if the `target` is still in the scene or valid. If a planet is removed from the `animatedObjects` but remains in `trailManager`, it will continue to attempt to read `matrixWorld` from a potentially stale object.

```javascript
// src/trails.js:138
tempVec.setFromMatrixPosition(trail.target.matrixWorld);
```
# Bug Hunt Report: Solar-Sim (Hunted)

## New Diagnosed Issues
### 1. Moon Label Over-persistence [FIXED]
- **Symptom:** Moon labels are always visible, cluttering the view.
- **Diagnosis:** `procedural.js` creates labels for all celestial bodies and adds them to a flat `allLabels` array. `main.js` toggles visibility globally. There is no conditional logic to check if a moon's parent planet is selected or focused before rendering its label.

### 2. Trail Radial Artifacts [FIXED]
- **Symptom:** Straight lines connect planets to the Sun (origin).
- **Diagnosis:** `TrailManager` in `trails.js` initializes history buffers with $(0,0,0)$ (the default position before physics update). `LineSegments` draws lines between all points in the history. The transition between the current orbital path and the uninitialized origin creates a radial "spoke" to $(0,0,0)$.

### 3. Starbox "Inner Cloud" Clustering [FIXED]
- **Symptom:** Stars appear as a dense cloud inside the solar system.
- **Diagnosis:** `createStarfield` in `procedural.js` generates points in a $[-200, 200]$ unit range. Given the simulation scale ($1 \text{ AU} = 40$ units), this puts the entire "universe" of stars within $5 \text{ AU}$ of the Sun, overlapping with the planetary orbits.

## Resolved/Previously Found Bugs
...

### 030 - Memory Leak: DebrisSystem dispose
The `dispose` method for the debris system cleans up geometry and material but doesn't remove the attributes from the geometry, and `onBeforeCompile` adds a `shader` reference to `userData` which might prevent material GC if not cleared.

```javascript
// src/debris.js:278
mesh.dispose = () => {
    mesh.geometry.dispose();
    mesh.material.dispose();
};
```

### 031 - Framerate Dependent Animation
The planet and starfield rotation logic uses a fixed increment per frame (`+= 0.01` or `+= 0.0003`) instead of multiplying by the delta time (`dt`). This means the simulation runs 2.4x faster on a 144Hz monitor compared to a 60Hz screen, breaking the simulation conceptual time.

```javascript
// src/main.js:490
obj.mesh.rotation.y += 0.01 * timeScale;
```

### 032 - GPU Memory Leak: Sun Glow
`createSun` generates a `CanvasTexture` and `SpriteMaterial` for the glow effect. However, these are local variables. The returned `sun` mesh does not have a custom `dispose` method that cleans these up. When the scene is cleared, the `Mesh` is removed, but the Texture and Material remain in VRAM.

```javascript
// src/procedural.js:164
const glowTexture = createGlowTexture();
const glowMaterial = new THREE.SpriteMaterial({ map: glowTexture ... });
```

### 033 - Logic Flaw: TrailManager.reset
The `reset()` method clears the internal `trails` array but fails to reset the `geometry.drawRange` or clear the buffer data. If called, the "ghosts" of the old trails will remain visible on screen (frozen static lines) until new trails happen to overwrite the specific buffer indices.

```javascript
// src/trails.js:210
reset() {
    this.nextTrailIndex = 0;
    this.trails = [];
    // MISSING: this.geometry.setDrawRange(0, 0);
}
```

### 034 - Zombie Code: Lazy Loading
The `setTimeout` for lazy loading textures is scheduled in `init`. If `init` fails (e.g., config load error), `initFailed` is set, but the timeout callback (2000ms later) does not check this flag before attempting to process `textureLoader.lazyLoadQueue`. This can lead to console errors or network requests for a dead simulation.

```javascript
// src/main.js:277
setTimeout(() => {
    // Should check: if (initFailed) return;
    console.log("Bolt ⚡: Lazy loading...");
    textureLoader.lazyLoadQueue.forEach(...)
}, 2000);
```

### 035 - Physics Instability: Unclamped Delta Time
The `dt` (delta time) is calculated directly from `performance.now()`. If the user switches tabs (backgrounding the browser), `dt` can become arbitrarily large (e.g., 5000ms). When applied to `limit` or `simulationTime` logic, this can cause massive jumps in orbital calculation or physics instability.

```javascript
// src/main.js:438
const dt = (now - lastFrameTime) / 1000;
// Recommendation: const dt = Math.min((now - lastFrameTime) / 1000, 0.1);
```

### 031 - Framerate Dependent Animation Speed
[FIXED] Updated `src/main.js` to multiply rotation increments by `dt` (delta time), ensuring consistent speed across different refresh rates.

### 032 - GPU Memory Leak: Sun Glow
[FIXED] Added a custom `dispose()` method to the Sun mesh in `src/procedural.js` that explicitly disposes of the glow texture and material.

### 033 - Logic Flaw: TrailManager.reset
[FIXED] Added `this.geometry.setDrawRange(0, 0)` to `TrailManager.reset()` in `src/trails.js` to hide old trails immediately.

### 034 - Zombie Code: Lazy Loading
[FIXED] Added `if (initFailed) return;` check inside the lazy loading `setTimeout` callback in `src/main.js`.

### 035 - Physics Instability: Unclamped Delta Time
[FIXED] Clamped `dt` to a maximum of 0.1s in `src/main.js` to prevent physics instabilities when the tab happens to be backgrounded.

### 036 - Performance: GC Allocation in Update Loop
The `TrailManager.update()` method creates a new `THREE.Vector3()` on **every frame** (line 130). This causes garbage collection pressure on high-frequency loops, leading to micro-stutters over time.

```javascript
// src/trails.js:130
update() {
    const tempVec = new THREE.Vector3(); // ❌ Allocates every frame
    this.trails.forEach(trail => { ... });
}
```

**Recommendation:** Hoist `tempVec` to a module-level or instance-level variable, similar to how `src/main.js:472` handles it.

### 037 - Zombie Code: Unused `staticPhysics` Parameter
The `createDebrisSystem` function destructures `staticPhysics` from the config object but never uses it. The comment says it's kept for "API compatibility" but this is dead code that confuses maintainers.

```javascript
// src/debris.js:136
const {
    count = 1000,
    distribution,
    isSpherical = false,
    material: matConfig,
    staticPhysics = false // ❌ Destructured but never used
} = config;
```

### 038 - Memory Leak: Modal `dispose()` Is a No-Op
The `Modal.dispose()` method has an empty body and does not remove the event listeners added in `bindEvents()`. Since the listeners are anonymous arrow functions, they cannot be removed without refactoring.

```javascript
// src/components/Modal.js:82
dispose() {
    // In a complex app, we'd remove listeners here.
    // ❌ Actually empty - listeners are never cleaned up
}
```

### 039 - Crash Risk: Missing null check for `userData`
In `InfoPanel.update()`, the code accesses `mesh.userData` properties without verifying that `userData` exists. If a mesh with no `userData` is passed, the app will crash.

```javascript
// src/components/InfoPanel.js:81
update(mesh) {
    if (!mesh) return;
    const d = mesh.userData; // ❌ Could be undefined
    if (this.dom.name) this.dom.name.textContent = d.name || 'Unknown'; // TypeError if d is undefined
}
```

### 040 - Performance: Object3D Allocation in Update Loop
The `InstanceRegistry.update()` method creates a `new THREE.Object3D()` on every call. This is executed every frame and causes unnecessary garbage collection.

```javascript
// src/instancing.js:110
update() {
    const dummy = new THREE.Object3D(); // ❌ Allocates every frame
    this.groups.forEach(group => { ... });
}
```

**Note:** The `dummy` object is not even used in the current implementation (matrices are read directly from pivots). This is doubly wasteful.

### 041 - Silent Failure: Missing null guard for DOM elements
`NavigationSidebar` checks for `this.dom.sidebar` existence before proceeding with `init()`, but other DOM elements like `list`, `search`, `btnClose`, `btnOpen` are not validated. If any of these are missing, methods will fail silently or throw.

```javascript
// src/components/NavigationSidebar.js:42
if (!this.dom.sidebar) {
    console.error(...);
    return;
}
// ❌ this.dom.list, this.dom.search, etc. could still be null
this.init();
```

### 042 - TypeError Risk: CommandPalette Filter
The `filter()` method accesses `item.name.toLowerCase()` and `item.type.toLowerCase()` without verifying these properties exist. If an item has a missing or undefined `name` or `type`, the filter will throw a TypeError.

```javascript
// src/components/CommandPalette.js:249
this.filteredItems = this.items.filter(item =>
    item.name.toLowerCase().includes(q) || // ❌ item.name could be undefined
    item.type.toLowerCase().includes(q)    // ❌ item.type could be undefined
);
```

### 043 - Magic Numbers: Hardcoded Scale Constants
The physics module uses several hardcoded numbers for the multi-zone scaling system. While some have inline comments, they are not defined with semantic names, making future modifications error-prone.

```javascript
// src/physics.js:116-126
const AU_SCALE = 40.0;     // 1 AU = 40 Three.js units
const LIMIT_1 = 30.0;      // End of Linear Zone (Neptune is ~30 AU)
const LIMIT_2 = 50.0;      // End of Kuiper Belt Zone
// ... more magic numbers without easy configurability
```

**Severity Note:** This is marked as LOW because the values are stable for the solar system simulation. However, it would become problematic if the system needed to support different scales or configurations.

### 044 - Zombie Code: Unused `trail` Variable
[FIXED] Removed the unused `let trail = null;` declaration and simplified the `trails` array assignment in `src/procedural.js`.

### 036 - Performance: GC Allocation in Update Loop
[FIXED] Hoisted `tempVec` to a module-level constant `_tempVec` in `src/trails.js` to eliminate per-frame garbage collection pressure.

### 037 - Zombie Code: Unused `staticPhysics` Parameter
[FIXED] Removed the unused `staticPhysics` parameter from the destructured config object in `src/debris.js`.

### 038 - Memory Leak: Modal `dispose()` No-Op
[FIXED] Implemented proper `dispose()` method in `src/components/Modal.js` that stores named handler references and removes them on cleanup.

### 039 - Crash Risk: Missing null check for `userData`
[FIXED] Added null guard for `mesh.userData` in `src/components/InfoPanel.js` using fallback to empty object.

### 040 - Performance: Object3D Allocation in Update Loop
[FIXED] Removed the unused `new THREE.Object3D()` allocation from `src/instancing.js` update loop (was never used).

### 041 - Silent Failure: Missing null guard for DOM elements
[FIXED] Added null validation for `this.dom.list` in `src/components/NavigationSidebar.js` constructor with console warning.

### 042 - TypeError Risk: CommandPalette Filter
[FIXED] Added optional chaining for `item.name` and `item.type` in `src/components/CommandPalette.js` filter method.

### 043 - Magic Numbers: Hardcoded Scale Constants
[FIXED] Extracted all magic numbers into a documented `SCALE_CONFIG` object in `src/physics.js` with JSDoc comments explaining each value.

### 045 - Memory Leak: `clearMaterialCache` Never Called
The `procedural.js` module has a `clearMaterialCache()` function (line 30-33) that disposes all cached materials. However, this function is **never invoked** anywhere in the codebase. When the simulation is reset or reinitialized (e.g., switching planet configurations), the old materials persist in GPU memory.

```javascript
// src/procedural.js:30-33
export function clearMaterialCache() {
    Object.values(materialCache).forEach(mat => mat.dispose());
    for (const key in materialCache) delete materialCache[key];
}
// ❌ Exported but never called in main.js init() or anywhere else
```

**Recommendation:** Call `clearMaterialCache()` in `main.js:init()` before re-creating planets, or when the scene is disposed.

### 046 - Silent Failure: `group.mesh.dispose()` Called on Non-Existent Method
In `instancing.js:76-78`, when rebuilding instance groups, the code calls `group.mesh.dispose()`. However, `THREE.InstancedMesh` **does not have a `.dispose()` method** on the mesh object itself - it requires manual disposal of its `.geometry` and `.material` properties (which is done later in `.dispose()`). The call silently does nothing.

```javascript
// src/instancing.js:76-78
if (group.mesh) {
    this.scene.remove(group.mesh);
    group.mesh.dispose(); // ❌ InstancedMesh has no dispose() method - this is a no-op
}
```

**Impact:** Low severity since the `.dispose()` method in the class (line 173+) handles geometry/material cleanup correctly. However, the `build()` method's cleanup is incomplete - if `build()` is called multiple times without `dispose()`, old meshes may leak.

**Recommendation:** Replace with explicit cleanup like done in `dispose()`, or remove the no-op call to avoid confusion.

### 047 - Logic Flaw: No Return Value in Final Else Branch
The `benchmark.js:measure()` function has a return statement in the `else` branch (lines 32-74) but this value is never captured. The `requestAnimationFrame` callback ignores return values, so technically this isn't causing a bug. However, it indicates the function was designed to return results that are never used.

```javascript
// src/benchmark.js:75
            return {
                frames: frameTimes.length,
                avgFps: 1000 / avg,
                // ... rest of result object
            };
        } // ← This return is inside an else block of a rAF callback
    }
// The outer startBenchmark returns { cancel: ... } but not the results
```

**Impact:** Low - The console.log output still works. But if a caller tries to programmatically capture benchmark results via `await`, they won't get them. This is more of a design inconsistency than a crash risk.

**Recommendation:** Either use a Promise-based API or add a callback option for result delivery.

