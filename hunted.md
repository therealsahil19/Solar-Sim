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
| 024 | [FIXED] | 🟢 LOW   | `src/main.js:413` | Performance: High GC in Animation Loop |
| 025 | [FIXED] | 🟢 LOW   | `src/input.js:225` | Memory Leak: Undisposed Button Event Listeners |

## Details

### 022 - Persistent State Pollution in Global Arrays
[FIXED] Added logic to `init()` in `src/main.js` to manually clear all global arrays (`interactionTargets`, `animatedObjects`, etc.) before repopulating them.

### 023 - Memory Leak: Anonymous Window Resize Listener
[FIXED] Replaced anonymous arrow function with named `onWindowResize` function in `src/input.js` and added `removeEventListener` to `dispose`.

### 024 - Performance: High GC in Animation Loop
[FIXED] Replaced `new THREE.Vector3()` allocation in the `animate` loop with a shared module-level `tempVec` in `src/main.js`.

### 025 - Memory Leak: Undisposed Button Event Listeners
[FIXED] Added explicit `removeEventListener` calls for all UI buttons in `src/input.js`'s `dispose` method.
