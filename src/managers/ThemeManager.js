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

    setTheme(themeName) {
        if (!this.themes.includes(themeName)) return;

        document.documentElement.setAttribute('data-theme', themeName);
        localStorage.setItem('theme', themeName);

        this.currentThemeIndex = this.themes.indexOf(themeName);
    }

    cycleTheme() {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % this.themes.length;
        const nextTheme = this.themes[this.currentThemeIndex];
        this.setTheme(nextTheme);
        return nextTheme;
    }

    loadPreference() {
        const stored = localStorage.getItem('theme');
        if (stored && this.themes.includes(stored)) {
            this.setTheme(stored);
        } else {
            // Default
            this.setTheme('default');
        }
    }

    getTheme() {
        return this.themes[this.currentThemeIndex];
    }
}
