/**
 * @file SettingsManager.js
 * @description Manages user preferences persistence via localStorage.
 * Follows the same pattern as ThemeManager.js for consistency.
 */

/**
 * @typedef {Object} Settings
 * @property {boolean} textures - High-definition textures enabled
 * @property {boolean} labels - Planet labels visible
 * @property {boolean} orbits - Orbit lines and trails visible
 * @property {string} theme - Active theme ('default' | 'blueprint' | 'oled')
 * @property {number} speed - Simulation speed multiplier (0.1 - 5.0)
 */

/** @type {Settings} */
const DEFAULT_SETTINGS = {
    textures: true,
    labels: true,
    orbits: true,
    theme: 'default',
    speed: 1.0
};

const STORAGE_KEY = 'solar-sim-settings';

export class SettingsManager {
    constructor() {
        /** @type {Settings} */
        this.settings = { ...DEFAULT_SETTINGS };

        /** @type {Set<Function>} Listeners for settings changes */
        this.listeners = new Set();

        this.load();
    }

    /**
     * Loads settings from localStorage, merging with defaults for missing keys.
     */
    load() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Merge with defaults to handle missing keys from older versions
                this.settings = { ...DEFAULT_SETTINGS, ...parsed };
            }
        } catch (e) {
            console.warn('SettingsManager: Unable to load preferences.', e);
            this.settings = { ...DEFAULT_SETTINGS };
        }
    }

    /**
     * Persists current settings to localStorage.
     */
    save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
        } catch (e) {
            console.warn('SettingsManager: Unable to save preferences.', e);
        }
    }

    /**
     * Gets the current value of a setting.
     * @param {keyof Settings} key - The setting key.
     * @returns {*} The setting value.
     */
    get(key) {
        return this.settings[key];
    }

    /**
     * Gets all current settings.
     * @returns {Settings} A copy of all settings.
     */
    getAll() {
        return { ...this.settings };
    }

    /**
     * Updates a setting and persists the change.
     * @param {keyof Settings} key - The setting key.
     * @param {*} value - The new value.
     */
    set(key, value) {
        if (!(key in DEFAULT_SETTINGS)) {
            console.warn(`SettingsManager: Unknown setting "${key}"`);
            return;
        }

        this.settings[key] = value;
        this.save();
        this.notifyListeners(key, value);
    }

    /**
     * Registers a listener for settings changes.
     * @param {Function} callback - Called with (key, value) on changes.
     * @returns {Function} Unsubscribe function.
     */
    subscribe(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    /**
     * Notifies all listeners of a setting change.
     * @param {string} key - The changed setting key.
     * @param {*} value - The new value.
     */
    notifyListeners(key, value) {
        for (const listener of this.listeners) {
            try {
                listener(key, value);
            } catch (e) {
                console.error('SettingsManager: Listener error', e);
            }
        }
    }

    /**
     * Resets all settings to defaults.
     */
    reset() {
        this.settings = { ...DEFAULT_SETTINGS };
        this.save();
        // Notify for each key
        for (const key of Object.keys(DEFAULT_SETTINGS)) {
            this.notifyListeners(key, this.settings[key]);
        }
    }
}
