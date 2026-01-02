# Scribe's Journal - The Archives

## 2024-05-23 - [Docs Update] **Focus:** [Module/File documented] **Standard:** [Term defined] **Gap:** [What area still needs documentation]

### 2024-05-23 - Init
- **Focus:** Initial Setup.
- **Gap:** `src/main.js` and `src/input.js` need better JSDoc coverage, particularly regarding complex function arguments and side effects.

### 2024-05-23 - The Deep Dive
- **Focus:** `src/main.js` and `src/input.js`.
- **Standard:**
    - "Bolt Optimization": Explicitly label performance-critical logic (e.g., Throttling, Instancing).
    - "Dependency Injection": Explain architectural pattern in `input.js`.
- **Changes:**
    - Added JSDoc to `toggleCameraView`, `resetCamera`, `setFocusTarget`, `updateTimeScale` in `main.js`.
    - Documented side effects (e.g., `aria-pressed` updates) and global state mutations.
    - Explained "Bolt" optimizations in `animate` (render loop splitting, throttling).
    - Documented `setupInteraction` in `input.js` to clarify the Context/Callback pattern.
    - Added security notes (Prevent XSS) in DOM creation comments.

### 2024-05-23 - Polishing the Diamond
- **Focus:** `src/instancing.js`, `src/debris.js`, `src/components/CommandPalette.js`, `src/managers/ThemeManager.js`.
- **Standard:**
    - "Technical Note": Use formal explanations instead of "FIX" or "DEBUGGER FIX" comments for complex logic.
- **Changes:**
    - `src/instancing.js`: Clarified architectural decision for `userData` merging (Source of Truth).
    - `src/debris.js`: Added technical explanation for Vertex Shader injection (Coordinate Space Transformation).
    - `src/components/CommandPalette.js`: Detailed JSDoc return types for `flattenData` and ARIA notes for `initDOM`.
    - `src/managers/ThemeManager.js`: Added `@example` usage.

### 2024-05-23 - The User Interface & Onboarding
- **Focus:** `src/components/NavigationSidebar.js`, `src/components/InfoPanel.js`, `download_textures.py`, `CONTRIBUTING.md`.
- **Standard:**
    - "Class Documentation": Explicitly document constructor parameters and architectural role (e.g., "Decoupled from 3D scene").
    - "A11y Notes": Highlight Accessibility features in JSDoc (Focus Management, ARIA).
- **Changes:**
    - **NavigationSidebar**: Added detailed JSDoc for the class and its recursive `buildLevel` method. Explained the Client-side search logic.
    - **InfoPanel**: Documented the data binding process between `three.js` userData and the DOM.
    - **download_textures.py**: Added module-level docstring and usage instructions.
    - **CONTRIBUTING.md**: Created a new comprehensive guide for contributors, covering setup, structure, and standards.

### 2024-05-24 - The Glossary & Core Logic
- **Focus:** `GLOSSARY.md`, `src/procedural.js`, `src/main.js`.
- **Standard:**
    - "Factory Pattern": Defined the pure function approach in `procedural.js`.
    - "Internal Code Names": Defined "Bolt", "Scribe", "Sentinel".
- **Changes:**
    - **GLOSSARY.md**: Created a central dictionary for domain terms (Keplerian Orbit, Instancing) and internal codenames.
    - **src/procedural.js**: Added file-level JSDoc explaining the "Factory" role. Documented the complex recursive `createSystem` function and the "Lazy Loading" logic for textures.
    - **src/main.js**: Documented the "Conductor" role. Added JSDoc to `init` (Async/Await) and `animate` (Render Loop phases). Explains Global State variables.
### 2026-01-02 - The Sync & Physics Discovery
- **Focus:** `README.md`, `GLOSSARY.md`, `src/physics.js`.
- **Standard:**
    - "Schema Accuracy": Documentation must match the current JSON schema in `system.json`.
    - "Physics Documentation": Orbital mechanics must be explained with mathematical clarity.
- **Changes:**
    - **README.md**: Updated the `system.json` schema section to reflect nested `physics` and `visual` objects. Added `src/physics.js` to the project structure.
    - **GLOSSARY.md**: Added definitions for Keplerian orbital elements and expanded the explanation of Multi-Zone Scaling.
    - **Troubleshooting**: Added a section to README for common setup issues.
- **Gap:** UI components like `NavigationSidebar` could benefit from more detailed prop-type style documentation in JSDoc for future migrations to TS.
