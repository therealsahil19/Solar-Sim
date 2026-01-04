
## 2026-01-04 - [Layout Thrashing in Label Rendering]
**Learning:** `getBoundingClientRect()` forces a synchronous layout recalculation (Reflow) if styles have been invalidated.
**Issue:** The label rendering loop in `main.ts` was calling `getBoundingClientRect` (Read) then setting `style.opacity` (Write) for every label, causing O(N) layout re-calculations per frame.
**Action:** Replaced DOM reads with mathematical projection (`vector.project(camera)`).
**Result:** Eliminated layout thrashing. Label position and visibility are now calculated via pure math, decoupling the render loop from the DOM layout engine.
