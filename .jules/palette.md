# PALETTE'S JOURNAL - DESIGN SYSTEM DECISIONS

## 2024-05-23 - [System Update: Semantic Tokens & Motion]
**Problem:** The current CSS uses a mix of generic variable names (`--color-bg`, `--color-accent`) and lacks a defined motion system. Components are styled somewhat inconsistently (different button sizes/interactions).
**Solution:**
1.  **Primitive vs. Semantic Split:** Introduce a two-tier token system.
    *   *Primitives:* Raw hex values (e.g., `--palette-blue-500`).
    *   *Semantic:* Contextual names (e.g., `--action-primary-bg`).
2.  **Motion System:** Define `--anim-duration-*` and `--anim-ease-*` tokens to standardise transitions.
3.  **Component Architecture:** Refactor generic classes into specific component classes (`.btn-icon`, `.card-glass`).
4.  **Interaction Refactor:** Move from JS-driven `display: none` to Class-driven state (`.is-open`) to allow CSS animations.

**Standard:**
*   **WCAG 2.1 AA:** Ensure contrast ratios > 4.5:1 for all text.
*   **Motion:** "Motion conveys Meaning" - use entrance/exit animations to orient the user.

## 2024-05-24 - [System Upgrade: Dynamic Theming Engine]
**Problem:** The application was hardcoded to a single "Space/Dark" theme. Users had no option for high-contrast or light mode (useful for educational classroom settings with glare). CSS contained scattered hardcoded RGBA values.
**Solution:**
1.  **Semantic Token Expansion:** All hardcoded colors (backgrounds, overlays, shadows) were replaced with semantic variables (e.g., `--color-overlay-bg`, `--color-shadow`).
2.  **Theme Manager:** Implemented `src/managers/ThemeManager.js` to handle state switching (persisted via `localStorage`) and toggle `data-theme` attributes.
3.  **Theme Definitions:**
    *   **Default:** The classic cosmic dark mode.
    *   **Blueprint:** A high-contrast, technical light mode (Light blue-gray background, dark blue text).
    *   **OLED:** A pitch-black mode for energy saving on OLED screens.
4.  **Interaction:** Added "Switch Theme" command to the Command Palette.

**Standard:**
*   **WCAG 2.1 AA:** "Blueprint" mode ensures high contrast for text.
*   **Systemic Design:** Zero hardcoded colors in CSS.

## 2026-01-02 - [System Update: Modal System & Utility Architecture]
**Problem:** The application contained legacy "design debt" in the form of inline styles (`style="font-size:..."`) within `index.html`. The Modal implementation was manual and inconsistent with the design system tokens.
**Solution:**
1.  **Modal Standardization:** Created a reusable `Modal.js` component wrapping the native `<dialog>` element.
    *   Enforces backdrop blur, entrance animations, and focus trapping.
    *   Standardized CSS classes (`.modal-content`, `.modal-grid`) in `src/style.css`.
2.  **Utility Class Architecture:** Introduced functional CSS utilities to `src/style.css` (e.g., `.text-xl`, `.font-light`, `.mb-md`, `.kbd`) to eliminate the need for inline styles.
3.  **Refactoring:**
    *   Removed all inline styles from `index.html`.
    *   Updated `CommandPalette` to use the standardized `.kbd` class for shortcuts.
    *   Refactored `src/input.js` to use the new `Modal` class for the Welcome screen.

**Standard:**
*   **No Inline Styles:** All styling is now driven by classes and tokens.
*   **Accessibility:** Modals use native `<dialog>` for robust keyboard support and screen reader announcement.
