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

            settingsManager = new SettingsManager();

            expect(settingsManager.getAll()).toEqual(EXPECTED_DEFAULTS);
        });

        it('should handle localStorage errors during load', () => {
            vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
                throw new Error('Access denied');
            });

            settingsManager = new SettingsManager();

            expect(settingsManager.getAll()).toEqual(EXPECTED_DEFAULTS);
        });
    });

    describe('validateSettings', () => {
        beforeEach(() => {
            settingsManager = new SettingsManager();
        });

        it('should validate and return valid settings', () => {
            const input = {
                textures: false,
                speed: 2.5,
                theme: 'oled'
            };
            const validated = (settingsManager as any).validateSettings(input);
            expect(validated).toEqual(input);
        });

        it('should filter out unknown keys', () => {
            const input = {
                textures: false,
                unknownKey: 'value'
            };
            const validated = (settingsManager as any).validateSettings(input);
            expect(validated).toEqual({ textures: false });
            expect(validated).not.toHaveProperty('unknownKey');
        });

        it('should filter out keys with invalid types', () => {
            const input = {
                textures: 'not-a-boolean', // should be boolean
                speed: 'not-a-number',    // should be number
                orbits: true               // valid
            };
            const validated = (settingsManager as any).validateSettings(input);
            expect(validated).toEqual({ orbits: true });
        });

        it('should return an empty object for empty input', () => {
            const validated = (settingsManager as any).validateSettings({});
            expect(validated).toEqual({});
        });

        it('should handle null or non-object values gracefully (via parsed Record type)', () => {
            // Even though types say Record<string, unknown>, at runtime JSON.parse could return anything
            // but the loop uses Object.keys(DEFAULT_SETTINGS), so it's safe if input is an object.
            const validated = (settingsManager as any).validateSettings({ speed: null });
            expect(validated).toEqual({});
        });

        it('should handle malformed data in localStorage by falling back to defaults', () => {
            // This test is migrated from the deleted settings_manager.test.ts
            localStorage.setItem('solar-sim-settings', JSON.stringify({
                'textures': 'not-a-boolean',
                'speed': '123'
            }));

            settingsManager = new SettingsManager();

            // It should use defaults instead of types crashing
            expect(settingsManager.get('textures')).toBe(true);
            expect(settingsManager.get('speed')).toBe(1.0);
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

        it('should throw an error for unknown setting keys', () => {
            const initialSettings = settingsManager.getAll();

            expect(() => {
                // @ts-ignore - Testing runtime validation
                settingsManager.set('unknownKey', 123);
            }).toThrowError('Unknown setting "unknownKey"');

            expect(settingsManager.getAll()).toEqual(initialSettings);
        });

        it('should handle localStorage errors during save', () => {
            vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                throw new Error('Quota exceeded');
            });

            settingsManager.set('speed', 4.0);

            // Value should still be updated in memory
            expect(settingsManager.get('speed')).toBe(4.0);
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

        it('should re-throw listener errors gracefully', () => {
            const errorListener = vi.fn().mockImplementation(() => {
                throw new Error('Listener failed');
            });
            const successListener = vi.fn();

            settingsManager.subscribe(errorListener);
            settingsManager.subscribe(successListener);

            expect(() => {
                settingsManager.set('speed', 5.0);
            }).toThrowError('Listener failed');

            expect(errorListener).toHaveBeenCalled();
            // In synchronous mode, if error is thrown, the rest might not be called in standard iteration unless loop caught it
        });

        it('should propagate errors from notifyListeners', () => {
            // This test is migrated from the deleted settings_manager.test.ts
            const listener = vi.fn().mockImplementation(() => {
                throw new Error('Listener crashed');
            });
            settingsManager.subscribe(listener);

            // The manager rethrows the error synchronously when mutating settings
            expect(() => {
                settingsManager.set('textures', false);
            }).toThrow('Listener crashed');
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
