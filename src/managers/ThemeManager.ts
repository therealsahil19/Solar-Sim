/**
 * @file ThemeManager.ts
 * @description Manages the visual theme of the application (colors, fonts, etc.)
 * Persists the user's choice in localStorage.
 */

import type { ThemeName } from '../types';

/**
 * Valid theme names as a readonly tuple.
 */
const THEMES: readonly ThemeName[] = ['default', 'blueprint', 'oled'] as const;

/**
 * ThemeManager maintains the visual aesthetic state of the application.
 * It coordinates between CSS variable themes and logical states.
 *
 * Architectural Role: Decoupled State Manager.
 * Dependency: document.documentElement (for data-theme attribute).
 */
export class ThemeManager {
    /** Valid theme identifiers matching CSS [data-theme] selectors */
    private readonly themes: readonly ThemeName[];

    /** Index of the currently active theme */
    private currentThemeIndex: number;

    constructor() {
        this.themes = THEMES;
        this.currentThemeIndex = 0;

        // Load theme preference from persistent storage
        this.loadPreference();
    }

    /**
     * Sets the application theme by updating the 'data-theme' attribute on <html>.
     * This triggers CSS variable shifts defined in style.css.
     *
     * @param themeName - The name of the theme to set ('default', 'blueprint', 'oled').
     */
    setTheme(themeName: ThemeName): void {
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
     * @returns The name of the newly activated theme.
     * @example
     * themeManager.cycleTheme(); // 'blueprint'
     * themeManager.cycleTheme(); // 'oled'
     */
    cycleTheme(): ThemeName {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % this.themes.length;
        const nextTheme = this.themes[this.currentThemeIndex];
        if (nextTheme) {
            this.setTheme(nextTheme);
            return nextTheme;
        }
        return 'default';
    }

    /**
     * Initializes theme state from localStorage or defaults to 'default'.
     */
    private loadPreference(): void {
        let stored: string | null = null;
        try {
            stored = localStorage.getItem('theme');
        } catch (e) {
            console.warn('ThemeManager: Unable to read theme preference.', e);
        }

        if (stored && this.isValidTheme(stored)) {
            this.setTheme(stored);
        } else {
            this.setTheme('default');
        }
    }

    /**
     * Type guard to check if a string is a valid theme name.
     */
    private isValidTheme(value: string): value is ThemeName {
        return (this.themes as readonly string[]).includes(value);
    }

    /**
     * Returns the name of the current active theme.
     * @returns One of 'default', 'blueprint', or 'oled'.
     */
    getTheme(): ThemeName {
        return this.themes[this.currentThemeIndex] ?? 'default';
    }
}
