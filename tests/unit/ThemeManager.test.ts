import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeManager } from '../../src/managers/ThemeManager';

describe('ThemeManager', () => {
    let themeManager: ThemeManager;

    beforeEach(() => {
        // Clear localStorage before each test
        localStorage.clear();
        document.documentElement.removeAttribute('data-theme');
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should initialize with default theme when no preference is stored', () => {
        const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');

        themeManager = new ThemeManager();

        expect(getItemSpy).toHaveBeenCalledWith('theme');
        expect(document.documentElement.getAttribute('data-theme')).toBe('default');
        expect(themeManager.getTheme()).toBe('default');
    });

    it('should initialize with stored theme preference', () => {
        localStorage.setItem('theme', 'oled');

        themeManager = new ThemeManager();

        expect(document.documentElement.getAttribute('data-theme')).toBe('oled');
        expect(themeManager.getTheme()).toBe('oled');
    });

    it('should fallback to default if stored theme is invalid', () => {
        localStorage.setItem('theme', 'invalid-theme');

        themeManager = new ThemeManager();

        expect(document.documentElement.getAttribute('data-theme')).toBe('default');
        expect(themeManager.getTheme()).toBe('default');
    });

    it('should set theme correctly', () => {
        themeManager = new ThemeManager();

        themeManager.setTheme('blueprint');

        expect(document.documentElement.getAttribute('data-theme')).toBe('blueprint');
        expect(localStorage.getItem('theme')).toBe('blueprint');
        expect(themeManager.getTheme()).toBe('blueprint');
    });

    it('should ignore invalid themes in setTheme', () => {
        themeManager = new ThemeManager();
        const initialTheme = themeManager.getTheme();

        // @ts-ignore - Testing runtime validation
        themeManager.setTheme('invalid-theme');

        expect(document.documentElement.getAttribute('data-theme')).toBe(initialTheme);
        expect(themeManager.getTheme()).toBe(initialTheme);
    });

    it('should cycle through themes correctly', () => {
        // Start fresh
        localStorage.clear();
        themeManager = new ThemeManager();

        // Initial state should be 'default' (index 0)
        expect(themeManager.getTheme()).toBe('default');

        // Cycle 1: default -> blueprint
        const nextTheme1 = themeManager.cycleTheme();
        expect(nextTheme1).toBe('blueprint');
        expect(document.documentElement.getAttribute('data-theme')).toBe('blueprint');

        // Cycle 2: blueprint -> oled
        const nextTheme2 = themeManager.cycleTheme();
        expect(nextTheme2).toBe('oled');
        expect(document.documentElement.getAttribute('data-theme')).toBe('oled');

        // Cycle 3: oled -> default
        const nextTheme3 = themeManager.cycleTheme();
        expect(nextTheme3).toBe('default');
        expect(document.documentElement.getAttribute('data-theme')).toBe('default');
    });

    it('should handle localStorage errors gracefully', () => {
        // Mock setItem to throw an error
        const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('Storage full');
        });

        // Spy on console.warn to verify error logging
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        themeManager = new ThemeManager();
        themeManager.setTheme('blueprint');

        // Should still update the DOM
        expect(document.documentElement.getAttribute('data-theme')).toBe('blueprint');

        // Should have tried to save
        expect(setItemSpy).toHaveBeenCalledWith('theme', 'blueprint');

        // Should have logged a warning
        expect(consoleSpy).toHaveBeenCalled();
    });
});
