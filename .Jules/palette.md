## 2024-05-23 - [3D Accessibility & Usability]
**Learning:** Users interacting with WebGL canvases often miss keyboard shortcuts (like 'C' for camera) because there are no standard visual affordances.
**Action:** Always include a lightweight DOM overlay with key controls and interaction hints for 3D experiences.

## 2024-05-24 - [3D UI Interaction]
**Learning:** When using a `pointer-events: none` overlay to allow clicking through to the 3D canvas, interactive UI elements (buttons) must explicitly set `pointer-events: auto`.
**Action:** Default all UI overlays to pass-through clicks, but create a utility class like `.interactive` or ensure button styles include the pointer-event reset.
