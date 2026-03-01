# Test Execution Status & Comprehensiveness

This document tracks all the Playwright (E2E) and Vitest (Unit) tests in the Solar-Sim project, detailing their purpose, status, and performance characteristics.

> **Important**: Whenever a new test is added or the testing approach is modified, this file *must* be updated to reflect the current state.

## E2E Tests (Playwright)

Located in `tests/e2e/`. Run via `npm run test`.
*Note: Due to high concurrency limitations on certain environments, consider running these with `npx playwright test --workers=2` and starting the Vite dev server manually (`npm run dev`).*

| File | Purpose | Status | Performance/Efficiency Notes |
| :--- | :--- | :--- | :--- |
| `camera-controls.spec.js` | Verifies orbit controls (pan, zoom, rotate) and focus mode integration. | Active | Uses visual checks; stable. |
| `command-palette.spec.ts` | Tests the Cmd+K/Ctrl+K interface, accessibility (WAI-ARIA Combobox), and search navigation. | Active | Fast, tests DOM manipulation. |
| `help-modal.spec.js` | Ensures the Welcome/Help Modal opens via '?' and closes appropriately. | Active | Simple UI test. |
| `keyboard-shortcuts.spec.js` | Verifies global hotkeys map to correct actions (e.g., C, L, O, T keys). | Active | Broad coverage of input module. |
| `navigation-sidebar.spec.js` | Tests hierarchical tree rendering, filtering search (Phase 1 & 2), and clicking integration. | Active | DOM-heavy, ensure loading complete. |
| `navigation.spec.ts` | Comprehensive testing of sidebar fast-travel, ensuring camera focuses on selected items. | Active | Combines UI and 3D simulation state. |
| `performance.spec.js` | Asserts baseline FPS and limits jank using `window.boltBenchmark`. | Active | Sensitive to CI load; use retry on failure. |
| `responsive.spec.ts` | Tests UI scaling and positioning across varying viewport sizes (desktop, mobile). | Active | Multi-viewport configurations required. |
| `settings-panel.spec.js` | Validates toggles, themes (Default, Blueprint, OLED), and SettingsManager callback integration. | Active | Fast, functional test. |
| `smoke.spec.ts` | High-level test ensuring the app loads without fatal errors (no white screen of death). | Active | First line of defense in CI. |
| `stress_trails.spec.ts` | Simulates high particle count and trail updates to ensure rendering pipeline does not crash. | Active | GPU/CPU intensive. |
| `ui-controls.spec.ts` | Tests the bottom/on-screen control bar (textures, orbits, labels buttons). | Active | Functional UI test. |
| `ux-upgrade.spec.js` | Tests recent UX improvements (e.g., Skeleton UI rendering, loading states). | Active | Verifies immediate UI shell generation. |
| `visual-audit.spec.js` | Basic regression test using Playwright snapshot capabilities. | Active | Flaky across OS due to anti-aliasing. |

## Unit Tests (Vitest)

Located in `tests/unit/`. Run via `npm run test:unit`.
*Note: Run under the `jsdom` environment. Certain Three.js canvas/renderer methods (e.g., `scene.updateMatrixWorld`) may throw harmless console warnings in `jsdom`.*

| File | Purpose | Status | Performance/Efficiency Notes |
| :--- | :--- | :--- | :--- |
| `benchmark.test.ts` | Tests the Bolt Benchmark core logic (`startBenchmark`, P95/P99 calculations). | Active | Fast mathematical checks. |
| `benchmark_integration.test.ts` | Verifies that `benchmark.ts` correctly exposes itself to `window.boltBenchmark`. | Active | JSDOM integration test. |
| `CommandPalette.test.ts` | Component tests for CommandPalette search, focus trapping, and ARIA updates. | Active | Pure DOM logic test. |
| `debris.test.ts` | Verifies Keplerian orbit logic parameters for GPU Asteroid/Kuiper Belts. | Active | Mathematical assertions. |
| `glow_perf.test.ts` | Benchmarks procedural sun glow canvas generation execution time. | Active | Micro-benchmark. |
| `InfoPanel.test.ts` | Verifies that the panel correctly updates DOM elements based on `mesh.userData`. | Active | Fast DOM test. |
| `input.test.ts` | Tests raycasting, coordinate normalization, and keyboard bindings logic. | Active | Mocks Three.js Raycaster. |
| `instancing_optimization.test.ts` | Verifies that `InstanceRegistry` properly batches objects to minimize draw calls. | Active | Key test for Bolt Instancing. |
| `instancing_perf.test.ts` | Benchmarks execution time of batching thousands of objects. | Active | Micro-benchmark. |
| `LabelManager.test.ts` | Tests Spatial Grid collision logic for 2D label overlaps. | Active | Ensures O(N) overlap detection. |
| `main.test.ts` | Verifies chunked initialization sequence and Scene/Camera/Renderer boilerplate. | Active | Mocks `requestAnimationFrame` and Three.js components. |
| `matrix_perf.test.ts` | Measures performance gains of direct matrix access (`elements[12]`) vs `setFromMatrixPosition`. | Active | Demonstrates 1.4x-1.8x speedup. |
| `NavigationSidebar.test.ts` | Tests recursive tree building and complex two-phase search filtering. | Active | Data structure test. |
| `orbit_perf.test.ts` | Standalone benchmark verifying `orbitalPositionCache` (WeakMap) speedup for multi-moon systems. | Active | Demonstrates 2.3x-3.3x speedup. |
| `physics.test.ts` | Tests Keplerian calculations and Multi-Zone Scaling boundary logic (Linear -> Log). | Active | Math-heavy, verifies continuity and bounds. |
| `physics_perf.test.ts` | Benchmarks execution time of mathematical physics calculations. | Active | Micro-benchmark. |
| `procedural_cache.test.ts` | Verifies that standard materials are successfully cached and reused by texture URL. | Active | Ensures material memory limits. |
| `procedural_perf.test.ts` | Benchmarks recursive system generation and lazy-to-immediate texture upgrades. | Active | Micro-benchmark. |
| `procedural_userData.test.ts` | Verifies `createSystem` attaches correct metadata (parentBody, name) to meshes. | Active | Data integrity test. |
| `redundant_update.test.ts` | Enforces that `scene.matrixWorldAutoUpdate = false` and `updateMatrixWorld` is called 1x per frame. | Active | Critical for Bolt rendering optimization. |
| `SettingsManager.test.ts` | Tests local storage persistence and subscriber callback triggers. | Active | Mocks `localStorage`. |
| `SettingsPanel.test.ts` | Tests UI slide-out interactions and DOM event firing. | Active | DOM UI test. |
| `setup.ts` | Vitest setup file for JSDOM canvas mocking. | Active | Infrastructure. |
| `SkeletonUtils.test.ts` | Verifies DocumentFragment batching logic to prevent DOM thrashing. | Active | Tests DOM manipulation efficiency. |
| `texture_caching_perf.test.ts` | Benchmarks the material texture caching lookups and instantiation. | Active | Micro-benchmark. |
| `ThemeManager.test.ts` | Verifies persistence and application of 'default', 'blueprint', and 'oled' themes. | Active | Tests `data-theme` application. |
| `ThreeUtils.test.ts` | Tests common Three.js helper math functions. | Active | Fast mathematical checks. |
| `ToastManager.test.ts` | Verifies singleton behavior, rendering, auto-dismissal, and XSS prevention (textContent). | Active | DOM test. Uses `_reset()` for isolation. |
| `trails_binding.test.ts` | Verifies that trail data buffers are correctly bound to the Three.js shader. | Active | GLSL/Three.js integration. |
| `trails_data_sync.test.ts` | Verifies that updating the `Float32Array` buffer is accurately uploaded to the GPU texture. | Active | Data integrity test. |
| `trails_perf.test.ts` | Benchmarks object pooling (`_tempVec2`) and ring buffer unwinding execution times. | Active | Micro-benchmark. |
