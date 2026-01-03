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

### 2026-01-02 - The Deep Dive (Part 2)
- **Focus:** `src/main.js` helper functions.
- **Standard:**
    - "Helper Documentation": All UI/Interaction helper functions must have JSDoc explaining side effects (ARIA updates, State mutations).
- **Changes:**
    - Added JSDoc to 11 helper functions in `main.js` including `toggleCameraView`, `toggleTextures`, and `resetCamera`.
    - Polished inline comments in the `animate` loop to remove "thinking aloud" notes and clarify physics/visual decoupling.

### 2026-01-02 - The Complete Components (Part 3)
- **Focus:** `README.md` - Project Structure & Architecture.
- **Standard:**
    - "Project Structure Accuracy": The README must list ALL source files and components, not a partial subset.
    - "Architecture Completeness": Every UI component class must have its own architecture entry explaining its role.
- **Changes:**
    - **README.md**: Updated Project Structure tree to include all four components (`CommandPalette.js`, `InfoPanel.js`, `Modal.js`, `NavigationSidebar.js`).
    - **README.md**: Added Architecture entries for `InfoPanel` (Data Binding, State Management), `Modal` (Wrapper Pattern, Lifecycle), and `NavigationSidebar` (DOM Generation, Client-side Search, Decoupled Design).
    - Fixed alignment and improved directory tree formatting.
- **Gap:** The `CONTRIBUTING.md` could be expanded with component architecture diagrams (Mermaid) to help new contributors understand UI component relationships.


### 2026-01-03 - The State of Documentation
- **Focus:** `src/managers/SettingsManager.js`, `src/managers/ThemeManager.js`, `CONTRIBUTING.md`, `README.md`.
- **Standard:**
    - "Manager Standard": State managers must document their Subscription/Observer interface and persistence logic (`localStorage`).
    - "Visual Architecture": Critical architectural boundaries must be visualized with Mermaid diagrams in onboarding docs.
- **Changes:**
    - **SettingsManager**: Upgraded to full JSDoc with `@typedef` for Settings and `@example` for subscriptions. Clarified the merge-on-load logic.
    - **ThemeManager**: Added class-level JSDoc explaining its role in the decoupled architecture.
    - **CONTRIBUTING.md**: Added a Mermaid diagram visualizing the interaction between Conductor, Controller, and Managers. Added a "State Management" section.
    - **README.md**: Updated Project Structure and Architecture sections to include the new managers.
- **Gap:** Core physics logic in `physics.js` still contains some inline "Thinking aloud" notes from the Debugger role that could be cleaned up into formal JSDoc.

### 2026-01-03 - [Docs Update] **Focus:** `physics.js`, `README.md`, `CONTRIBUTING.md`
- **Standard:**
    - "Clean Documentation": Remove historical debugging notes (e.g., "CRITICAL FIX", "Bug XXX") from production comments.
    - "Schema Transparency": Document every field in configuration files to lower the barrier for data contributors.
- **Changes:**
    - **physics.js**: Scrubbed all references to "Debugger" fixes and thinking-aloud notes. Formalized "wrapTime" and "Multi-Zone" technical explanations.
    - **README.md**: Added comprehensive documentation for the `system.json` schema, including all Keplerian and visual properties.
    - **CONTRIBUTING.md**: Added a physical "Data Flow" section explaining the transformation pipeline from JSON to the 3D Scene.
- **Gap:** The `procedural.js` file-level JSDoc is good, but individual internal helper functions for asteroid generation could be more explicit about their mathematical constants.

### 2026-01-03 - The Settings & Standards Sync
- **Focus:** `src/components/SettingsPanel.js`, `README.md`, `CONTRIBUTING.md`.
- **Standard:**
    - "Component: Callback Pattern": UI components must be decoupled from global state or 3D scene logic. Communication should happen via constructor-injected callbacks.
    - "Shortcut Documentation": Global keyboard shortcuts must be documented in both code (as JSDoc) and project-level documentation (`README.md`).
- **Changes:**
    - **SettingsPanel**: Added extensive JSDoc including `@example` and `@private` markers. Clarified the relationship between the UI and `SettingsManager`.
    - **README.md**: Integrated the Settings Panel into the feature list, project structure, and architecture. Documented the `,` shortcut.
    - **CONTRIBUTING.md**: Updated the Core Components table to include `SettingsPanel`.
- **Gap:** The `src/debris.js` asteroid generation logic is technically documented, but could benefit from a "Physics Note" explaining the GPU-side orbital math more formally.
