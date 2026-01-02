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
| 022 | [OPEN] | 🔴 HIGH  | `src/main.js:30` | Persistent State Pollution in Global Arrays |
| 023 | [OPEN] | 🟢 LOW   | `src/input.js:135` | Memory Leak: Anonymous Window Resize Listener |
| 024 | [OPEN] | 🟢 LOW   | `src/main.js:413` | Performance: High GC in Animation Loop |
| 025 | [OPEN] | 🟢 LOW   | `src/input.js:225` | Memory Leak: Undisposed Button Event Listeners |

## Details

### 022 - Persistent State Pollution in Global Arrays
The `main.js` module maintains several top-level constant arrays (`interactionTargets`, `animatedObjects`, `planets`, `allOrbits`, etc.) that are populated during the `init()` function. However, these arrays are **never cleared** before repopulation.
If `init()` is called more than once (e.g., during testing, hot-reloading, or a soft reset feature), these arrays will accumulate duplicate references to objects from previous runs. This leads to:
1.  **Memory Leaks**: References to old objects prevent Garbage Collection.
2.  **Logic Errors**: Raycasting and physics loops iterate over destroyed/stale objects, potentially causing crashes or "ghost" interactions.

```javascript
// src/main.js
const interactionTargets = []; // Defined once
// ...
export async function init() {
    // ...
    interactionTargets.push(sun); // Pushed every time init() runs
    // No code to empty interactionTargets!
}
```

### 023 - Memory Leak: Anonymous Window Resize Listener
In `src/input.js`, the `setupInteraction` function adds an **anonymous** event listener to `window` to track resize events for raycasting coordinates. Because the function is anonymous, it cannot be removed in the `dispose` method, leading to a permanent memory leak if the interaction module is re-initialized.

```javascript
// src/input.js:135
window.addEventListener('resize', () => {
    width = window.innerWidth;
    height = window.innerHeight;
});
// No removeEventListener in dispose()
```

### 024 - Performance: High GC in Animation Loop
The `animate` function in `src/main.js` creates a `new THREE.Vector3()` instance on **every frame** (60 times per second) when a focus target is active. This causes unnecessary Garbage Collection pressure, which can lead to frame drops (jank) in a long-running simulation.
A reusable module-level "scratch" vector (like `tempVec` used elsewhere) should be employed.

```javascript
// src/main.js:413
if (focusTarget) {
    const targetPos = new THREE.Vector3(); // Allocation per frame
    targetPos.setFromMatrixPosition(focusTarget.matrixWorld);
    controls.target.copy(targetPos);
}
```

### 025 - Memory Leak: Undisposed Button Event Listeners
The `setupInteraction` function in `src/input.js` attaches event listeners to DOM buttons (e.g., `#btn-camera`, `#btn-pause`). The `dispose` method explicitly skips removing these listeners, citing "brevity" in the comments.
While the buttons themselves are static in `index.html`, if the application logic were to re-run `setupInteraction`, duplicate listeners would be stacked on the same buttons, causing actions to trigger multiple times per click.

```javascript
// src/input.js:225
// (Skipping individual button removeEventListener for brevity...)
```
