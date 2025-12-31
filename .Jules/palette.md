## 2024-05-22 - Malformed HTML & ARIA Shortcuts
**Learning:** Broken HTML tags (unclosed elements) can silently break layout and accessibility without throwing errors. In this case, a duplicated button tag disrupted the toolbar.
**Action:** Always check HTML structure when modifying UI. Use `aria-keyshortcuts` to expose keyboard commands to assistive technology, and ensure the JS implementation actually matches the UI hints (e.g., tooltips).

## 2024-10-27 - Design System Zero: Tokenization
**Problem:** The UI uses hardcoded hex values (`#4a90e2`, `rgba(10, 10, 16, 0.85)`), arbitrary spacing (`1rem`, `200px`), and z-indices (`10`, `9999`), making theming impossible and consistency brittle.
**Solution:** Implemented a CSS Variable system (Design Tokens) for Colors, Spacing, Z-index, and Radius.
**Standard:** WCAG 2.1 AA (Color Contrast), DRY Principle (Single Source of Truth).
