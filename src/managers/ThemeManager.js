/**
 * @file ThemeManager.js
 * @description Manages the visual theme of the application (colors, fonts, etc.)
 * Persists the user's choice in localStorage.
 */

export class ThemeManager {
    constructor() {
        this.themes = ['default', 'blueprint', 'oled'];
        this.currentThemeIndex = 0;

        // Load initial theme
        this.loadPreference();
    }

    /**
     * Sets the application theme by updating the 'data-theme' attribute on the root element.
     * @param {string} themeName - The name of the theme to set ('default', 'blueprint', 'oled').
     */
    setTheme(themeName) {
        if (!this.themes.includes(themeName)) return;

        document.documentElement.setAttribute('data-theme', themeName);
        try {
            localStorage.setItem('theme', themeName);
        } catch (e) {
            console.warn('ThemeManager: Unable to persist theme preference.', e);
        }

        this.currentThemeIndex = this.themes.indexOf(themeName);
    }

    /**
     * Cycles to the next available theme in the list.
     * @returns {string} The name of the new active theme.
     * @example cycleTheme() // returns 'blueprint'
     */
    cycleTheme() {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % this.themes.length;
        const nextTheme = this.themes[this.currentThemeIndex];
        this.setTheme(nextTheme);
        return nextTheme;
    }

    /**
     * Loads the persisted theme preference from localStorage, or defaults to 'default'.
     */
    loadPreference() {
        let stored = null;
        try {
            stored = localStorage.getItem('theme');
        } catch (e) {
            console.warn('ThemeManager: Unable to read theme preference.', e);
        }

        if (stored && this.themes.includes(stored)) {
            this.setTheme(stored);
        } else {
            // Default
            this.setTheme('default');
        }
    }

    /**
     * Gets the current active theme name.
     * @returns {string} The current theme name.
     */
    getTheme() {
        return this.themes[this.currentThemeIndex];
    }
}
