import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SettingsManager, Settings } from '../../src/managers/SettingsManager';

// Define expected defaults matching the source code
const EXPECTED_DEFAULTS: Settings = {
    textures: true,
    labels: true,
    orbits: true,
    theme: 'default',
    speed: 1.0,
    asteroidBelt: true,
    kuiperBelt: true,
    oortCloud: true
};

describe('SettingsManager', () => {
    let settingsManager: SettingsManager;

    beforeEach(() => {
        // Clear localStorage before each test
        localStorage.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Initialization', () => {
        it('should initialize with default settings when localStorage is empty', () => {
            const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
            settingsManager = new SettingsManager();

            expect(getItemSpy).toHaveBeenCalledWith('solar-sim-settings');
            expect(settingsManager.getAll()).toEqual(EXPECTED_DEFAULTS);
        });

        it('should initialize with stored settings', () => {
            const storedSettings = { speed: 2.0, theme: 'oled' };
            localStorage.setItem('solar-sim-settings', JSON.stringify(storedSettings));

            settingsManager = new SettingsManager();

            expect(settingsManager.get('speed')).toBe(2.0);
            expect(settingsManager.get('theme')).toBe('oled');
            // Ensure other defaults are preserved
            expect(settingsManager.get('textures')).toBe(true);
        });

        it('should handle invalid JSON in localStorage', () => {
            localStorage.setItem('solar-sim-settings', 'invalid-json');
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            settingsManager = new SettingsManager();

            expect(settingsManager.getAll()).toEqual(EXPECTED_DEFAULTS);
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Unable to load preferences'), expect.any(Error));
        });

        it('should handle localStorage errors during load', () => {
            vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
                throw new Error('Access denied');
            });
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            settingsManager = new SettingsManager();

            expect(settingsManager.getAll()).toEqual(EXPECTED_DEFAULTS);
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Unable to load preferences'), expect.any(Error));
        });
    });

    describe('Getters and Setters', () => {
        beforeEach(() => {
            settingsManager = new SettingsManager();
        });

        it('should get specific setting value', () => {
            expect(settingsManager.get('speed')).toBe(1.0);
        });

        it('should set specific setting value and persist it', () => {
            const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
            settingsManager.set('speed', 3.0);

            expect(settingsManager.get('speed')).toBe(3.0);
            expect(setItemSpy).toHaveBeenCalledWith('solar-sim-settings', expect.stringContaining('"speed":3'));
        });

        it('should ignore unknown setting keys', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const initialSettings = settingsManager.getAll();

            // @ts-ignore - Testing runtime validation
            settingsManager.set('unknownKey', 123);

            expect(settingsManager.getAll()).toEqual(initialSettings);
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown setting "unknownKey"'));
        });

        it('should handle localStorage errors during save', () => {
            vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                throw new Error('Quota exceeded');
            });
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            settingsManager.set('speed', 4.0);

            // Value should still be updated in memory
            expect(settingsManager.get('speed')).toBe(4.0);
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Unable to save preferences'), expect.any(Error));
        });
    });

    describe('Subscription', () => {
        beforeEach(() => {
            settingsManager = new SettingsManager();
        });

        it('should notify listeners on change', () => {
            const listener = vi.fn();
            settingsManager.subscribe(listener);

            settingsManager.set('orbits', false);

            expect(listener).toHaveBeenCalledWith('orbits', false);
        });

        it('should allow unsubscribing', () => {
            const listener = vi.fn();
            const unsubscribe = settingsManager.subscribe(listener);

            settingsManager.set('orbits', false);
            expect(listener).toHaveBeenCalledTimes(1);

            unsubscribe();
            settingsManager.set('orbits', true);
            expect(listener).toHaveBeenCalledTimes(1);
        });

        it('should handle listener errors gracefully', () => {
            const errorListener = vi.fn().mockImplementation(() => {
                throw new Error('Listener failed');
            });
            const successListener = vi.fn();
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            settingsManager.subscribe(errorListener);
            settingsManager.subscribe(successListener);

            settingsManager.set('speed', 5.0);

            expect(errorListener).toHaveBeenCalled();
            expect(successListener).toHaveBeenCalled(); // Should still be called
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Listener error'), expect.any(Error));
        });
    });

    describe('Reset', () => {
        beforeEach(() => {
            settingsManager = new SettingsManager();
            settingsManager.set('speed', 2.0);
            settingsManager.set('theme', 'oled');
        });

        it('should reset all settings to defaults', () => {
            settingsManager.reset();
            expect(settingsManager.getAll()).toEqual(EXPECTED_DEFAULTS);
        });

        it('should persist reset settings', () => {
            const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
            settingsManager.reset();
            expect(setItemSpy).toHaveBeenCalledWith('solar-sim-settings', expect.any(String));
            expect(JSON.parse(localStorage.getItem('solar-sim-settings')!)).toEqual(EXPECTED_DEFAULTS);
        });

        it('should notify listeners for all keys on reset', () => {
            const listener = vi.fn();
            settingsManager.subscribe(listener);

            settingsManager.reset();

            // Should be called for each key in DEFAULT_SETTINGS
            const keys = Object.keys(EXPECTED_DEFAULTS);
            expect(listener).toHaveBeenCalledTimes(keys.length);
            keys.forEach(key => {
                expect(listener).toHaveBeenCalledWith(key, EXPECTED_DEFAULTS[key as keyof Settings]);
            });
        });
    });
});
