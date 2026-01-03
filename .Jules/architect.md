# Architect's Journal 🏗️

## Product Domain
**Solar-Sim** - An interactive 3D Solar System visualization built with vanilla HTML/CSS/JS and Three.js. Users can explore planets, view orbital mechanics, toggle visual features (textures, labels, orbits), change camera modes, and switch themes.

## Tech Stack
- **Rendering:** Three.js v0.160.0 (via CDN/ES Modules)
- **UI:** Vanilla CSS with Glass-morphism design system, CSS Variables for theming
- **Data:** `system.json` (planet/moon definitions with Keplerian orbital elements)
- **Components:** CommandPalette, InfoPanel, Modal, NavigationSidebar, ThemeManager

---

## 2026-01-03 - Settings Panel

**Context:** The app has multiple visual toggles (textures, labels, orbits, camera mode) dispersed across the bottom dock buttons and Command Palette. Users cannot:
1. See all settings in one unified view
2. Persist preferences beyond just theme (textures/labels/orbits defaults)
3. Access theme selection without Cmd+K knowledge

This creates a fragmented UX where power users discover features accidentally.

**Feature:** A slide-out Settings Panel accessible via a ⚙️ (gear) button that consolidates all preferences:
- Visual Settings: Textures, Labels, Orbits toggles
- Theme Selection: Direct picker (Default, Blueprint, OLED)
- Simulation: Speed, Pause state
- Persistence: LocalStorage for all preferences

**Tech Stack:**
- **UI Layer:** New `src/components/SettingsPanel.js` component
- **Data Layer:** Extended localStorage persistence via settings manager
- **Integration:** Gear button in top-bar, callbacks to main.js functions

**Next Steps:** This unlocks:
- Audio settings (ambient space music)
- Accessibility preferences (reduced motion, high contrast)
- Performance profiles (quality presets)
## 2026-01-03 - Jupiter's Moons & UI Refinement

**Context:** The simulation was missing Jupiter's iconic Galilean moons, leaving a significant gap in the accuracy of the Jovian system. Additionally, the selection feedback was semi-hardcoded, comparing all object sizes to "Earth size" regardless of type (e.g., calling a tiny moon "0.01x Earth size" is less intuitive than comparing it to our Moon).

**Tech Stack:**
- **Data Layer:** Updated `system.json` with Io, Europa, Ganymede, and Callisto.
- **UI Layer:** Refactored `updateSelectionUI` in `src/input.js` for dynamic context-aware labels.

**Next Steps:** This unlocks:
- Specialized rendering for volcanic Io (glow effects).
- Subsurface exploration data for Europa.
- Improved collision/physics detection for dense satellite clusters.
## 2026-01-03 - Saturn's Moons & Enhanced Rings

**Context:** Saturn's system was previously represented by a simple solid-color ring and no moons. To match the detail level of the Jupiter upgrade, this feature introduces major Saturnian moons and high-fidelity textured rings.

**Tech Stack:**
- **Data Layer:** Updated `system.json` with Titan, Rhea, Enceladus, and Dione; added ring dimensions and texture paths.
- **Logic Layer:** Enhanced `createSystem` in `src/procedural.js` with custom UV mapping for circular ring textures and transparency support.
- **UI Layer:** Refined `updateSelectionUI` in `src/input.js` for Moon-relative size comparisons for satellites.

**Next Steps:** This unlocks:
- Atmospheric rendering for Titan (hazes).
- Plume/Geyser effects for Enceladus.
- Ring shadow casting on the planetary body.

## 2026-01-03 - Asteroid Belts & Procedural Debris System

**Context:** The solar system lacked its iconic debris fields (Asteroid Belt, Kuiper Belt, Oort Cloud), which are crucial for both visual scale and scientific accuracy. Previous debris systems were hardcoded and inflexible.

**Feature:** A dynamic, data-driven belt system that procedurally generates millions of particles (asteroids/comets) based on orbital density distributions.
- **Configurable Belts:** Parameters defined in `system.json` (inclination, eccentricity, semi-major axis ranges).
- **GPU Acceleration:** Uses `THREE.InstancedMesh` and GPU-calculated updates for high performance.
- **UI Integration:** Unified toggles in the Settings Panel for individual belt visibility.
- **Dynamic Loading:** Belts are initialized automatically from the simulation's data layer.

**Tech Stack:**
- **Logic Layer:** Refactored `src/debris.js` into a generic GPU particle factory (`createBelt`).
- **Data Layer:** Centralized belt definitions in `system.json`.
- **UI Layer:** New toggles in `index.html` and `src/components/SettingsPanel.js`.

**Next Steps:** This unlocks:
- Collisions with debris fields.
- Scientific "missions" to specific asteroid clusters.
- High-fidelity asteroid geometry for close-up views.

## 2026-01-03 - Uranus & Neptune System Expansion

**Context:** Uranus and Neptune were previously missing their major moon systems, lacking the visual scale and scientific detail present in the Jupiter and Saturn upgrades. This feature adds the primary satellites for both ice giants.

**Tech Stack:**
- **Data Layer:** Updated `system.json` with Titania, Oberon, Ariel, Umbriel, and Miranda for Uranus; added Triton for Neptune.
- **Physics Layer:** Defined accurate orbital elements (a, e, i) based on astronomical data to ensure stable and realistic motion.
- **UI Layer:** Integrated moons into the dynamic Navigation Sidebar and Selection UI.

**Next Steps:** This unlocks:
- Specialized rendering for Triton's retrograde orbit.
- Surface detail exploration for Miranda's extreme topography.
- Improved gravitational clustering for outer solar system bodies.
- Added major moons for Uranus and Neptune system.
## 2026-01-03 - Ceres & Pluto's Satellites

**Context:** While Pluto was present as a dwarf planet, it lacked its charismatic satellite system (Charon and the four smaller moons). Additionally, Ceres, the largest object in the Asteroid Belt and the only dwarf planet in the inner solar system, was missing.

**Tech Stack:**
- **Data Layer:** Updated `system.json` with Ceres and Pluto's 5 moons (Charon, Styx, Nix, Kerberos, Hydra).
- **UI Layer:** Added `Dwarf Planet` icon (☄️) support in `src/components/NavigationSidebar.js`.
- **Logic Layer:** Leveraged existing recursive `createSystem` logic to handle dwarf planet moon systems.

**Next Steps:** This unlocks:
- Specialized rendering for the binary Pluto-Charon barycenter.
- Detailed surface maps for Ceres (Occator Crater).
- Inclusion of Eris, Haumea, and Makemake in the outer system.

## 2026-01-04 - Eris, Haumea & Makemake Expansion

**Context:** While Pluto and Ceres were already present, the Solar-Sim was missing the remaining three IAU-recognized dwarf planets. This feature completes the dwarf planet tier, providing a more comprehensive view of the outer solar system and the Kuiper Belt's diversity.

**Tech Stack:**
- **Data Layer:** Updated `system.json` with Haumea (Hi'iaka, Namaka), Makemake (MK2), and Eris (Dysnomia).
- **Physics Layer:** Applied accurate Keplerian elements with significant inclinations (e.g., Eris at 44°) and eccentricities to visualize their unique orbital paths.
- **UI Layer:** Leveraged the existing `Dwarf Planet` icon (☄️) and recursive satellite system rendering.

**Next Steps:** This unlocks:
- Specialized rendering for Haumea's ellipsoidal shape (non-spherical mesh).
- Trans-Neptunian object (TNO) clustering and Kuiper Belt object classifications.
- Enhanced distance-based label scaling for extremely distant objects.
