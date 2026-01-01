# 👁️ Visual Inspection Report

| Screenshot | Viewport | Severity | Issue Type | Description |
|------------|----------|----------|------------|-------------|
| `desktop.png`, `tablet.png`, `mobile.png` | All | 🔴 HIGH | Missing Assets | Icons for Camera, Labels, Orbits, and Pause are missing (rendered as rectangles `[]`). |
| `mobile.png` | Mobile | 🔴 HIGH | Layout Break | Bottom dock elements (Speed/Controls) are stacked but consume excessive vertical space, obscuring the scene. |
| `tablet.png` | Tablet | 🟡 MED | Alignment | Speed control panel is misaligned with the button group (pushed to a new row but off-center). |
| `desktop.png` | Desktop | 🟢 LOW | Artifacts | Two stray white pixels/squares in the top right corner outside the UI container. |
| `all.png` | All | 🟡 MED | Overlap | Inner planet labels (Mercury, Venus, Earth) overlap significantly at default zoom. |
| `all.png` | All | 🟢 LOW | Content | "Solar-Sim" title text font appears slightly bolder/blurry in some views compared to UI text. |

## Details

### 1. Missing Icons (All Viewports)
**Severity: 🔴 HIGH**
The application relies on specific glyphs or an icon font for the main control buttons (Camera, Labels, Orbits) and the Speed Pause button. These are rendering as empty boxes `[]`.
*   **Likely Cause:** Missing font file, blocked CDN, or using Unicode characters that are not supported by the system font stack.
*   **Impact:** Users cannot identify what the buttons do without hovering (impossible on touch) or guessing.

### 2. Bottom Dock Layout (Mobile)
**Severity: 🔴 HIGH**
In `mobile.png`, the bottom dock consumes approximately 25-30% of the vertical screen real estate. The speed control slider is squeezed, and the stacking of the button group above the speed control creates a massive visual obstruction.
*   **Recommendation:** Use a collapsible menu or significantly reduce padding/margin for mobile. Stack icons horizontally in a scrollable container or hide less critical controls.

### 3. Stray Artifacts (Desktop/All)
**Severity: 🟢 LOW**
There are visible white square artifacts in the top right of the viewport. These appear to be debug markers or unintended DOM elements with `position: fixed` or `absolute` that were not hidden.
*   **Location:** Top right corner.

### 4. Label Overlap
**Severity: 🟡 MED**
The CSS2DLabels for Mercury, Venus, and Earth are clustered on top of each other. While expected in 3D, the z-indexing or collision detection for labels could be improved to prevent total occlusion.

### 5. Speed Control Alignment (Tablet)
**Severity: 🟡 MED**
On tablet view, the speed control drops to a second line but isn't centered or fully justified, leaving awkward whitespace on the right and making the UI look broken/unbalanced.
