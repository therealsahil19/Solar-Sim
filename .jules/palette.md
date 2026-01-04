# Palette's Journal

## 2024-05-23 - Accessibility of Hidden Interactions
**Learning:** Users cannot discover keyboard shortcuts for icon-only buttons unless they are explicitly exposed via tooltips or ARIA attributes.
**Action:** Always pair `aria-keyshortcuts` with `title` attributes on interactive elements that have keyboard equivalents.

## 2024-05-23 - Modal Density
**Learning:** When increasing the information density of a help modal, using a semantic grid (`.modal-grid`) is critical for maintaining readability on mobile devices.
**Action:** Group related shortcuts (Navigation vs. Toggles) visually to reduce cognitive load.
