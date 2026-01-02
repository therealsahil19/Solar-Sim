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

### 030 - Memory Leak: DebrisSystem dispose
The `dispose` method for the debris system cleans up geometry and material but doesn't remove the attributes from the geometry, and `onBeforeCompile` adds a `shader` reference to `userData` which might prevent material GC if not cleared.

```javascript
// src/debris.js:278
mesh.dispose = () => {
    mesh.geometry.dispose();
    mesh.material.dispose();
};
```
