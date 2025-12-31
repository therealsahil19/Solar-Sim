## 2025-05-18 - [Texture Toggle Failure on Instanced Meshes]
**Symptom:** When toggling texture mode (HD/LD) using the 'T' key, only the Sun and primary non-instanced planets updated. Moons and other instanced bodies remained stuck in their initial textured state.
**Root Cause:** The `toggleTextures` function in `main.js` only iterated through the `interactionTargets` list and expected material references (`texturedMaterial`, `solidMaterial`) to be present on the `mesh.userData`. For `InstancedMesh` objects (managed by `InstanceRegistry`), the `userData` containing these material references resides on the instance *pivots* (the `THREE.Group` wrappers), not on the `InstancedMesh` itself. Additionally, `InstancedMesh` requires updating its shared material directly, which was not being handled.
**Fix Pattern:** Modified `toggleTextures` in `src/main.js` to explicitly iterate through `instanceRegistry.groups`. For each group, it retrieves the material variants from the first instance's `userData` and applies the correct material to the `group.mesh`.
## 2025-12-31 - [Race Condition in Initialization]

**Symptom:**
The "Welcome / Controls" modal sometimes fails to open on start, particularly when `system.json` loads slowly or contains no new assets to trigger the loading manager.

**Root Cause:**
A race condition between `THREE.LoadingManager.onLoad` and the asynchronous initialization logic (`init` function).
1. `createSun` starts loading `sun.jpg`.
2. `init` awaits `fetch('system.json')`.
3. If `sun.jpg` finishes loading while `fetch` is pending, `manager.onLoad` fires.
4. `manager.onLoad` attempts to call `interactionHelpers.openModal()`.
5. `interactionHelpers` is `null` because it is initialized *after* the `await fetch`.
6. Result: Modal open logic is skipped silently.
7. If no subsequent assets are loaded (e.g., `system.json` is empty or cached), `onLoad` never fires again, leaving the modal closed.

**Fix Pattern:**
1.  **State Tracking:** Introduced `let assetsLoaded = false` in `main.js` to track if the loading manager has finished at least once.
2.  **Dual Check:**
    *   In `manager.onLoad`: Set `assetsLoaded = true`. If `interactionHelpers` exists, call `openModal()`.
    *   In `init` (post-await): If `assetsLoaded` is true, call `openModal()`.
3.  **Safety:** Updated `openModal` in `input.js` to check `!welcomeModal.open` before calling `showModal()` to prevent `InvalidStateError` in case both checks pass close together.
