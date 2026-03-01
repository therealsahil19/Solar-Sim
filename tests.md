# Test Documentation and Analysis

This document provides a summary of the test execution status, an analysis of test comprehensiveness, and guidelines for maintaining tests efficiently. **Note:** This file should be checked and updated each time a new test is added or when major changes to the application are made.

## Test Execution Status

### Unit Tests (Vitest)
- **Status:** Passes locally, however one unhandled exception occurred during `tests/unit/main.test.ts`.
- **Failure Documented:**
  - `TypeError: scene.updateMatrixWorld is not a function`
  - **Context:** The `main.test.ts` file calls the `updatePhysics` method that attempts to invoke `updateMatrixWorld()`. Because the unit test environment uses `jsdom`, certain Three.js canvas or renderer methods might be missing.
- **Passed Areas:**
  - Logic/Managers: `SettingsManager`, `ThemeManager`, `LabelManager`, `ToastManager`
  - Performance: `physics_perf.test.ts`, `instancing_perf.test.ts`, `orbit_perf.test.ts`, `texture_caching_perf.test.ts`, `trails_perf.test.ts`
  - Optimizations: `redundant_update.test.ts`, `matrix_perf.test.ts`, `instancing_optimization.test.ts`
  - Core Modules: `physics.test.ts`, `debris.test.ts`, `input.test.ts`

### End-to-End Tests (Playwright)
- **Status:** Mostly successful, however E2E execution can be flaky due to test concurrency constraints or resource limitations in constrained environments.
- **Failure Documented:**
  - `tests/e2e/camera-controls.spec.js` timed out on `should follow selected object`.
  - **Context:** The test clicked the "Follow" button and successfully found the Earth info text but then timed out while executing `await page.waitForTimeout(500)` awaiting the camera to adjust, hitting the overall 30,000ms test limit.

## Test Comprehensiveness Analysis

The existing testing suite is extremely detailed, especially regarding performance benchmarking (the "Bolt Optimization" suite) and physics calculations.

### What is tested well?
1. **Performance & Benchmarking:** Extensive coverage mapping iteration times (e.g., Matrix position extraction, calculating orbital positions, generating orbit lines).
2. **Logic and State Management:** Decoupled classes such as `ThemeManager`, `SettingsManager`, and `ToastManager` are fully tested.
3. **Optimizations:** Code specifically enforces that optimizations like `scene.matrixWorldAutoUpdate` remain disabled.
4. **UI Behavior (E2E):** Core user flows like toggling orbits, labels, navigating the planet tree, keyboard shortcuts, and smoke tests have coverage.

### What is missing / Recommendations for testing?
1. **Network & Error State Edge Cases:** E2E or Unit Tests verifying how the UI reacts when `system.json` is malformed, missing, or returns a 404/500 error. A test exists in `ux-upgrade.spec.js`, but it could be expanded in the Unit testing layer using mocks.
2. **Three.js Mocking:** The unhandled error regarding `scene.updateMatrixWorld` suggests that `main.test.ts` could benefit from better stubs or mocks for `THREE.Scene` elements so that testing the conductor does not crash in a Node/JSDOM context.
3. **WebGL Error Handling:** Ensure the application correctly identifies missing WebGL support and renders a fallback or a warning.
4. **Mobile Touch Simulation:** Playwright tests are comprehensive for desktop workflows, but testing touch inputs (drag/pinch-to-zoom) specifically for `OrbitControls` on mobile devices should be considered.
5. **Python Script tests:** Currently there is a python script `download_textures.py`. Running `python3 -m unittest discover tests` reported 0 tests executed. Even though the README notes a test suite exists, there are no python files containing unit tests for this downloader. Consider adding a python test to assert connection timeouts are gracefully handled.

## Test Efficiency

**Tests are generally done very efficiently:**
- **Decoupled Architecture:** The fact that managers (e.g., `ToastManager`, `ThemeManager`) can be tested independently of the Three.js Canvas proves excellent decoupling.
- **Mocking:** Most UI elements in unit tests mock out the Three.js dependencies, leading to extremely fast Vitest runs (completing over 130 tests in ~20s).
- **Parallelization:** Playwright executes in parallel, saving overall CI run time.

However, a minor inefficiency is how Playwright tests sometimes rely on fixed time delays (`waitForTimeout`). These can lead to flakes (as seen in `camera-controls.spec.js`). **Recommendation:** Favor deterministic waiting (e.g., waiting for specific class changes or ARIA attributes) instead of fixed timeouts.

---
*Note: Always refer to `CONTRIBUTING.md` for specific command usage to run the tests locally.*
