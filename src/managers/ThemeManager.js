/**
 * @file ThemeManager.js
 * @description Manages application themes (Default, Blueprint, OLED).
 * Handles switching, persistence via localStorage, and DOM updates.
 */

export class ThemeManager {
    constructor() {
        this.themes = ['default', 'blueprint', 'oled'];
        this.currentTheme = 'default';
        this.STORAGE_KEY = 'palette-theme';

        this.init();
    }

    init() {
        // Load from storage or default
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved && this.themes.includes(saved)) {
            this.setTheme(saved);
        } else {
            // Check system preference?
            // For now default is "default" (Dark Cosmic)
            this.setTheme('default');
        }
    }

    setTheme(themeName) {
        if (!this.themes.includes(themeName)) return;

        this.currentTheme = themeName;
        localStorage.setItem(this.STORAGE_KEY, themeName);

        // Update DOM
        const root = document.documentElement;
        if (themeName === 'default') {
            root.removeAttribute('data-theme');
        } else {
            root.setAttribute('data-theme', themeName);
        }

        console.log(`[Palette] Theme set to: ${themeName}`);
    }

    cycleTheme() {
        const idx = this.themes.indexOf(this.currentTheme);
        const next = this.themes[(idx + 1) % this.themes.length];
        this.setTheme(next);
        return next;
    }

    getTheme() {
        return this.currentTheme;
    }
}
