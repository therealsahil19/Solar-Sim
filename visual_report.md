# 👁️ Visual Inspection Report - January 2, 2026

| Screenshot | Viewport | Severity | Issue Type | Description |
|------------|----------|----------|------------|-------------|
| `desktop.png` | Desktop | 🟡 MED | Clipping | 'Neptune' label is partially clipped at the top-right viewport edge. |
| `tablet.png` | Tablet | 🔴 HIGH | Overlap | 'Mercury' label overlaps the Sun, causing legibility issues. |
| `mobile.png` | Mobile | 🔴 HIGH | Density | 'Earth' and 'Venus' labels are near-overlapping in portrait mode. |
| `mobile.png` | Mobile | 🟡 MED | Alignment | 'Texture' icon in simulation toggle is approx 2px off-center within its circular container. |
| `desktop.png` | Desktop | 🟢 LOW | Micro | Orbit lines pass directly through planet labels, creating visual noise. |

## Details

### 1. Label Clipping on Ultra-wide/Outer Orbits
**Observation:** In `desktop.png`, the label for Neptune is positioned at the very edge of the rendering canvas. 
**Impact:** Depending on the camera angle, labels for outer planets can become partially or fully clipped by the browser chrome.
**Recommendation:** Implement a "clamping" mechanism for labels to stay within a 20px padding from the viewport edge.

### 2. Mercury/Sun Overlap (Macro)
**Observation:** In all viewports, but most notably `tablet.png` and `mobile.png`, the Mercury label is positioned directly over the Sun's glow.
**Impact:** Extreme contrast failure. The white text on yellow-white glow makes the label unreadable.
**Recommendation:** Add a `z-index` offset or a logic to shift labels vertically when they are within a certain radius of the Sun's screen-space coordinates.

### 3. Responsive Density (Mobile)
**Observation:** In `mobile.png`, the vertical stack of control pills takes up nearly 30% of the screen height. 
**Impact:** Reduces the "active" simulation area.
**Recommendation:** Consider collapsing the simulation toggles into a single button that expands on tap for mobile viewports.

### 4. Icon Alignment (Micro-detail)
**Observation:** Upon 400% zoom of `desktop.png`, the 'Texture' (image) icon in the control bar has slightly more left padding than right padding (approx 2px difference).
**Impact:** Minor visual imbalance.

---
## Previous Observations (Archive)

### 1. Jagged Orbit Trails (All Viewports)
**Status:** [FIXED] Increased `pointsPerTrail` from 100 to 500 in `src/trails.js`.

### 2. Label Density on Mobile
**Status:** [OPEN] Still observed in January 2026 audit; documented as "Responsive Density" above.
