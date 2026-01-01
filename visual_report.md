# 👁️ Visual Inspection Report

| Screenshot | Viewport | Severity | Issue Type | Description |
|------------|----------|----------|------------|-------------|
| `mobile.png` | Mobile | 🟡 MED | Layout | Bottom dock consumes excessive vertical space (~25%); feels crowded. |
| `all.png` | All | 🟢 LOW | Artifacts | Stray white pixel/square visible in bottom right corner near footer. |
| `mobile.png` | Mobile | 🟡 MED | Overlap | Planet labels (Mercury, Venus, Earth) overlap significantly. |
| `all.png` | All | 🟢 LOW | Consistency | "HD" button uses text label while other buttons use SVG icons. |

## Details

### 1. Bottom Dock Layout (Mobile)
**Severity: 🟡 MED**
In `mobile.png`, the bottom control dock is split into two large "pills", taking up significant screen real estate. The Speed control section feels slightly cluttered with the "Speed" label, "1.0x" value, and slider packed together.
*   **Recommendation:** Consider merging rows or reducing padding further.

### 2. Label Overlap (Mobile)
**Severity: 🟡 MED**
The CSS2D labels for inner planets overlap heavily on narrower viewports, rendering them illegible.
*   **Recommendation:** Implement dynamic label hiding based on camera distance or screen separation.

### 3. Stray Artifact (All Viewports)
**Severity: 🟢 LOW**
A small white square (approx 2x2px) is visible in the bottom right corner, just to the left of the footer text. It appears to be a fixed DOM element or rendering artifact.

### 4. Icon Consistency
**Severity: 🟢 LOW**
The "HD" toggle uses text, whereas Camera, Labels, and Orbits use icons. This breaks visual consistency in the control group.
