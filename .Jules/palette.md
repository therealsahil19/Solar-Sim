## 2024-05-22 - Malformed HTML & ARIA Shortcuts
**Learning:** Broken HTML tags (unclosed elements) can silently break layout and accessibility without throwing errors. In this case, a duplicated button tag disrupted the toolbar.
**Action:** Always check HTML structure when modifying UI. Use `aria-keyshortcuts` to expose keyboard commands to assistive technology, and ensure the JS implementation actually matches the UI hints (e.g., tooltips).

## 2024-10-27 - Design System Zero: Tokenization
**Problem:** The UI uses hardcoded hex values (`#4a90e2`, `rgba(10, 10, 16, 0.85)`), arbitrary spacing (`1rem`, `200px`), and z-indices (`10`, `9999`), making theming impossible and consistency brittle.
**Solution:** Implemented a CSS Variable system (Design Tokens) for Colors, Spacing, Z-index, and Radius.
**Standard:** WCAG 2.1 AA (Color Contrast), DRY Principle (Single Source of Truth).

## 2024-12-31 - "Palette" System Upgrade & Modal Architecture
**Problem:** The UI relied on absolute positioning (`top: 1rem`), creating potential overlaps on mobile, and the "Onboarding Hint" was a non-interactive static text overlay, failing to engage users or clearly explain controls.
**Solution:**
1. **Grid Overlay:** Replaced absolute positioning with a responsive CSS Grid (`#app-overlay`) dividing the screen into Semantic Zones (Header, Main, Footer).
2. **Glass Component:** Standardized the `.glass-panel` class for consistent visual language.
3. **Modal Pattern:** Implemented a persistent `<dialog id="welcome-modal">` for onboarding that opens on load and can be recalled via a "Help" button.
**Standard:** WCAG 2.1 AA (Focus Trapping in Modals, ARIA Landmarks), Responsive Design (Mobile-First Grid).

## 2026-01-03 - Systemic Transition to Motion Tokens & Semantic Themes
**Problem:** Inconsistent interaction feedback (ad-hoc transitions), hardcoded JS theme strings, and lack of ARIA live updates for simulation state.
**Solution:**
1. **Motion Framework:** Unified CSS entry/exit animations based on physics tokens.
2. **Semantic Live Regions:** Implementing `aria-live` for critical state changes (Simulation Pause/Resume).
3. **Theme Fluidity:** Decoupling themes from JS arrays into CSS-driven attributes.
**Standard:** WCAG 2.1 AA (Live Regions, Contrast), Motion for Meaning (State explanatory animations).

## 2026-01-03 - Accessibility Hardening: Modal System & Screen Reader Support
**Problem:** Welcome modal lacked explicit close button (keyboard users couldn't easily dismiss), no `.sr-only` utility for hidden accessible text, motion preferences not respected, pause/resume state not announced to screen readers.
**Solution:**
1. **Modal Close Button:** Added visible `✕` button with `aria-label="Close dialog"` for WCAG 2.1.1 Keyboard compliance.
2. **Screen Reader Utility:** Added `.sr-only` CSS class for visually hidden but accessible content.
3. **Reduced Motion:** Added `@media (prefers-reduced-motion: reduce)` query to disable animations for vestibular disorder users (WCAG 2.3.3).
4. **Live Region:** Added `#sr-status` element with `role="status"` and `aria-live="polite"` for simulation state announcements (WCAG 4.1.3).
5. **Pause Icon Fix:** Fixed pause button not resetting to pause icon when simulation resumes.
**Standard:** WCAG 2.1.1 (Keyboard), WCAG 1.3.1 (Info & Relationships), WCAG 2.3.3 (Animation), WCAG 4.1.3 (Status Messages).
