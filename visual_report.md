# 👁️ Visual Inspection Report

| Screenshot | Viewport | Severity | Issue Type | Description |
|------------|----------|----------|------------|-------------|
| `desktop.png` | Desktop | 🟡 MED | Rendering | Orbit trails appear jagged/low-poly, particularly for larger orbits (Mars/Neptune). |
| `mobile.png` | Mobile | 🟢 LOW | Density | Planet labels (Mercury/Venus) are visually close; potential for overlap in alignment scenarios. |
| `mobile.png` | Mobile | 🟢 LOW | Spacing | Bottom dock elements are tightly packed; 'Speed' slider touch target could be small. |
| `desktop.png` | Desktop | 🟢 LOW | Contrast | Orbit lines (blue/orange) against starfield have subtle aliasing artifacts. |

## Details

### 1. Jagged Orbit Trails (All Viewports)
**Observation:** The orbital paths for planets (especially outer ones like Neptune) render as visible polygons rather than smooth curves.
**Root Cause:** The `TrailManager` in `src/trails.js` uses `THREE.LineSegments` with a fixed number of segments (`pointsPerTrail`). As the orbit circumference increases, the linear distance between points grows, creating visible straight edges.
**Recommendation:** Increase `pointsPerTrail` or implement a spline-based curve interpolation, though this may impact performance.

### 2. Label Density on Mobile
**Observation:** In `mobile.png`, the labels for inner planets (Mercury, Venus, Earth) are clustered.
**Context:** The `10px` font size and reduced padding in `src/style.css` helps, but in vertical orientation, the restricted width increases the likelihood of label collision during planetary alignment.

### 3. Responsive Dock (Mobile)
**Observation:** The bottom dock successfully switches to a column-reverse layout. The 'Speed' slider is functional but visually dense.
**Verdict:** Pass. The layout shifts logic in `@media (max-width: 768px)` works as intended to keep controls accessible without obscuring the scene center.

### 4. GPU Stalls (Performance/Visual)
**Observation:** Console logs during capture indicate `GL Driver Message: GPU stall due to ReadPixels`.
**Impact:** This may cause a "hiccup" or frame drop during the initial loading transition (fading out the loading screen), appearing as visual jank to the user.
