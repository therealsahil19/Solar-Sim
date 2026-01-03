/**
 * @file ThemeManager.js
 * @description Manages the visual theme of the application (colors, fonts, etc.)
 * Persists the user's choice in localStorage.
 */

/**
 * ThemeManager maintains the visual aesthetic state of the application.
 * It coordinates between CSS variable themes and logical states.
 * 
 * Architectural Role: Decoupled State Manager.
 * Dependency: document.documentElement (for data-theme attribute).
 */
export class ThemeManager {
    constructor() {
        /** @type {string[]} Valid theme identifiers matching CSS [data-theme] selectors. */
        this.themes = ['default', 'blueprint', 'oled'];

        /** @type {number} Index of the currently active theme. */
        this.currentThemeIndex = 0;

        // Load thermal preference from persistent storage
        this.loadPreference();
    }

    /**
     * Sets the application theme by updating the 'data-theme' attribute on <html>.
     * This triggers CSS variable shifts defined in style.css.
     * 
     * @param {string} themeName - The name of the theme to set ('default', 'blueprint', 'oled').
     * @returns {void}
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
     * Cycles to the next available theme in the sequence.
     * 
     * @returns {string} The name of the newly activated theme.
     * @example 
     * themeManager.cycleTheme(); // 'blueprint'
     * themeManager.cycleTheme(); // 'oled'
     */
    cycleTheme() {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % this.themes.length;
        const nextTheme = this.themes[this.currentThemeIndex];
        this.setTheme(nextTheme);
        return nextTheme;
    }

    /**
     * Initializes theme state from localStorage or defaults to 'default'.
     * @private
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
            this.setTheme('default');
        }
    }

    /**
     * Returns the name of the current active theme.
     * @returns {string} One of 'default', 'blueprint', or 'oled'.
     */
    getTheme() {
        return this.themes[this.currentThemeIndex];
    }
}
