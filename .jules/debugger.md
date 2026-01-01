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

## 2026-01-16 - [Recursive Satellite Scaling Logic Error]

**Symptom:**
Moons or sub-satellites appeared at incorrect (vastly inflated) distances from their parent planet if the parent planet had a size (scale) other than 1. For example, a moon defined at distance 5 from a parent of size 10 would appear at distance 50.

**Root Cause:**
In `src/procedural.js`, the `createSystem` function used a single `bodyGroup` container for both the visual scaling of the planet mesh and as the attachment point for children (moons).
1. `bodyGroup.scale.set(size, size, size)` was applied to size the planet.
2. `bodyGroup.add(childPivot)` attached the moon's coordinate system to this scaled group.
3. Consequently, the child's local position (distance) was multiplied by the parent's scale matrix.

**Fix Pattern:**
Decoupled the scene graph hierarchy in `createSystem` by introducing a `visualGroup`.
1. `bodyGroup` (Position Container): Remains unscaled (scale 1,1,1). Used for attaching children (moons) and Labels.
2. `visualGroup` (Visual Container): Child of `bodyGroup`. Scaled to `size`. Holds the planet mesh and rings.
3. This ensures satellites inherit the parent's position but are unaffected by its visual scale.

## 2026-02-04 - [Stale Matrix Lag on Instanced Meshes]

**Symptom:**
Visual elements attached to planets (like Text Labels and Orbit Trails) appeared to "drift" or detach from the planet body during movement. The planet mesh itself rendered one frame *behind* its actual logical position.

**Root Cause:**
In `src/main.js`, the animation loop performed updates in this order:
1.  Update Rotations (modifying `rotation` of pivots).
2.  `instanceRegistry.update()` (copying `matrixWorld` of pivots to `InstancedMesh`).
3.  `renderer.render()` (updating scene graph matrices).

Since `instanceRegistry.update()` read the `matrixWorld` *before* the scene graph update (which happens in render), it copied the *previous* frame's matrix.

**Fix Pattern:**
Inserted `scene.updateMatrixWorld()` in the animation loop immediately before `instanceRegistry.update()`. This ensures the scene graph matrices reflect the latest rotations before they are copied to the instancing buffers.
