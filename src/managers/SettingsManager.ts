/**
 * @file SettingsManager.ts
 * @description Manages user preferences persistence via localStorage.
 * Follows the same pattern as ThemeManager.ts for consistency.
 */

import type { ThemeName } from '../types';

/**
 * Settings configuration object.
 */
export interface Settings {
    /** Whether high-definition textures are enabled */
    textures: boolean;
    /** Whether celestial body labels are visible */
    labels: boolean;
    /** Whether orbit lines and trails are rendered */
    orbits: boolean;
    /** The active visual theme identifier */
    theme: ThemeName;
    /** The simulation time scale multiplier (0.1 to 5.0) */
    speed: number;
    /** Whether the asteroid belt is visible */
    asteroidBelt: boolean;
    /** Whether the Kuiper belt is visible */
    kuiperBelt: boolean;
    /** Whether the Oort cloud is visible */
    oortCloud: boolean;
}

/**
 * Valid setting keys.
 */
export type SettingKey = keyof Settings;

/**
 * Setting value types.
 */
export type SettingValue = Settings[SettingKey];

/**
 * Listener callback signature.
 */
export type SettingsListener = (key: SettingKey, value: SettingValue) => void;

const DEFAULT_SETTINGS: Settings = {
    textures: true,
    labels: true,
    orbits: true,
    theme: 'default',
    speed: 1.0,
    asteroidBelt: true,
    kuiperBelt: true,
    oortCloud: true
};

const STORAGE_KEY = 'solar-sim-settings';

/**
 * SettingsManager handles the persistence and distribution of user preferences.
 * It uses an Observer pattern (Subscription) to notify parts of the app when settings change.
 *
 * Technical Note: Data is persisted to localStorage. On load, it merges stored values
 * with DEFAULT_SETTINGS to ensure forward compatibility with new setting keys.
 *
 * @example
 * const settings = new SettingsManager();
 * settings.subscribe((key, value) => {
 *   if (key === 'theme') applyTheme(value);
 * });
 * settings.set('theme', 'oled');
 */
export class SettingsManager {
    /** The current active settings state */
    private settings: Settings;

    /** A set of callback functions to notify on change */
    private listeners: Set<SettingsListener>;

    constructor() {
        this.settings = { ...DEFAULT_SETTINGS };
        this.listeners = new Set();
        this.load();
    }

    /**
     * Loads settings from localStorage.
     * Merges with DEFAULT_SETTINGS to handle partial or missing keys from older versions.
     */
    private load(): void {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as Record<string, unknown>;
                // Validation: Only merge known keys with correct types
                const validated: Record<string, unknown> = {};
                for (const key of Object.keys(DEFAULT_SETTINGS) as SettingKey[]) {
                    if (key in parsed) {
                        const expectedType = typeof DEFAULT_SETTINGS[key];
                        if (typeof parsed[key] === expectedType) {
                            validated[key] = parsed[key];
                        }
                    }
                }
                this.settings = { ...DEFAULT_SETTINGS, ...(validated as Partial<Settings>) };
            }
        } catch (e) {
            console.warn('SettingsManager: Unable to load preferences.', e);
            this.settings = { ...DEFAULT_SETTINGS };
        }
    }

    /**
     * Persists the current settings object to localStorage as a JSON string.
     */
    private save(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
        } catch (e) {
            console.warn('SettingsManager: Unable to save preferences.', e);
        }
    }

    /**
     * Retrieves the current value for a specific setting key.
     * @param key - The setting key to retrieve.
     * @returns The current value of the setting.
     */
    get<K extends SettingKey>(key: K): Settings[K] {
        return this.settings[key];
    }

    /**
     * Returns a shallow copy of all current settings.
     * @returns The complete settings object.
     */
    getAll(): Settings {
        return { ...this.settings };
    }

    /**
     * Updates a single setting value, persists it, and notifies all subscribers.
     * @param key - The setting key to update.
     * @param value - The new value to apply.
     * @example settings.set('speed', 2.0);
     */
    set<K extends SettingKey>(key: K, value: Settings[K]): void {
        if (!(key in DEFAULT_SETTINGS)) {
            console.warn(`SettingsManager: Unknown setting "${key}"`);
            return;
        }

        this.settings[key] = value;
        this.save();
        this.notifyListeners(key, value);
    }

    /**
     * Registers a listener to be called whenever any setting is changed.
     * @param callback - The function to call with (key, value).
     * @returns An unsubscription function to stop listening.
     * @example
     * const unsub = settings.subscribe((k, v) => console.log(k, v));
     * unsub(); // Clean up
     */
    subscribe(callback: SettingsListener): () => void {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    /**
     * Internal helper to broadcast changes to all subscribed listeners.
     * @param key - The changed key.
     * @param value - The new value.
     */
    private notifyListeners(key: SettingKey, value: SettingValue): void {
        for (const listener of this.listeners) {
            try {
                listener(key, value);
            } catch (e) {
                console.error('SettingsManager: Listener error', e);
            }
        }
    }

    /**
     * Resets all settings to their factory defaults and notifies listeners of the change.
     */
    reset(): void {
        this.settings = { ...DEFAULT_SETTINGS };
        this.save();
        // Notify for each key to ensure UI state parity
        for (const key of Object.keys(DEFAULT_SETTINGS) as SettingKey[]) {
            this.notifyListeners(key, this.settings[key]);
        }
    }
}
