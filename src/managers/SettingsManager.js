/**
 * @file SettingsManager.js
 * @description Manages user preferences persistence via localStorage.
 * Follows the same pattern as ThemeManager.js for consistency.
 */

/**
 * @typedef {Object} Settings
 * @property {boolean} textures - Whether high-definition textures are enabled. If false, solid colors are used.
 * @property {boolean} labels - Whether celestial body labels (CSS2D) are visible in the scene.
 * @property {boolean} orbits - Whether orbit lines and trails are rendered.
 * @property {string} theme - The active visual theme identifier ('default' | 'blueprint' | 'oled').
 * @property {number} speed - The simulation time scale multiplier. Range: 0.1 (slow) to 5.0 (fast).
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
    constructor() {
        /** @type {Settings} The current active settings state. */
        this.settings = { ...DEFAULT_SETTINGS };

        /** @type {Set<Function>} A set of callback functions to notify on change. */
        this.listeners = new Set();

        this.load();
    }

    /**
     * Loads settings from localStorage.
     * Merges with DEFAULT_SETTINGS to handle partial or missing keys from older versions.
     * @private
     */
    load() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                this.settings = { ...DEFAULT_SETTINGS, ...parsed };
            }
        } catch (e) {
            console.warn('SettingsManager: Unable to load preferences.', e);
            this.settings = { ...DEFAULT_SETTINGS };
        }
    }

    /**
     * Persists the current 'this.settings' object to localStorage as a JSON string.
     * @private
     */
    save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
        } catch (e) {
            console.warn('SettingsManager: Unable to save preferences.', e);
        }
    }

    /**
     * Retrieves the current value for a specific setting key.
     * @param {keyof Settings} key - The setting key to retrieve.
     * @returns {string|boolean|number} The current value of the setting.
     */
    get(key) {
        return this.settings[key];
    }

    /**
     * Returns a shallow copy of all current settings.
     * @returns {Settings} The complete settings object.
     */
    getAll() {
        return { ...this.settings };
    }

    /**
     * Updates a single setting value, persists it, and notifies all subscribers.
     * @param {keyof Settings} key - The setting key to update.
     * @param {string|boolean|number} value - The new value to apply.
     * @example settings.set('speed', 2.0);
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
     * Registers a listener to be called whenever any setting is changed.
     * @param {function(string, *): void} callback - The function to call with (key, value).
     * @returns {function(): void} An unsubscription function to stop listening.
     * @example
     * const unsub = settings.subscribe((k, v) => console.log(k, v));
     * unsub(); // Clean up
     */
    subscribe(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    /**
     * Internal helper to broadcast changes to all subscribed listeners.
     * @param {string} key - The changed key.
     * @param {*} value - The new value.
     * @private
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
     * Resets all settings to their factory defaults and notifies listeners of the change.
     */
    reset() {
        this.settings = { ...DEFAULT_SETTINGS };
        this.save();
        // Notify for each key to ensure UI state parity
        for (const key of Object.keys(DEFAULT_SETTINGS)) {
            this.notifyListeners(key, this.settings[key]);
        }
    }
}
