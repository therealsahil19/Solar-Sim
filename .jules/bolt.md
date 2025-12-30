## 2025-12-30 - [Optimized Raycasting Targets]
**Learning:** Raycasting against `scene.children` (recursive) includes `THREE.Points` (starfield) and `LineLoop` (orbits), causing unnecessary intersection checks on thousands of objects.
**Action:** Maintain a dedicated `interactionTargets` array containing only the interactable meshes and raycast against it with `recursive: false`.
