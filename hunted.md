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
