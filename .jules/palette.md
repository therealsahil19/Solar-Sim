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
