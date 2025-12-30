## 2024-05-22 - Malformed HTML & ARIA Shortcuts
**Learning:** Broken HTML tags (unclosed elements) can silently break layout and accessibility without throwing errors. In this case, a duplicated button tag disrupted the toolbar.
**Action:** Always check HTML structure when modifying UI. Use `aria-keyshortcuts` to expose keyboard commands to assistive technology, and ensure the JS implementation actually matches the UI hints (e.g., tooltips).
