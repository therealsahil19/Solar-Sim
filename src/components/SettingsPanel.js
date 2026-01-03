/**
 * @file SettingsPanel.js
 * @description A slide-out settings panel component for managing simulation preferences.
 * 
 * This component follows the same pattern as InfoPanel.js and NavigationSidebar.js:
 * 1. **DOM Caching**: References DOM elements once at construction.
 * 2. **Event Binding**: Centralizes event handlers with cleanup.
 * 3. **Callbacks**: Communicates changes via callback functions.
 * 4. **Accessibility**: Uses ARIA attributes for screen reader support.
 */

import { SettingsManager } from '../managers/SettingsManager.js';

export class SettingsPanel {
    /**
     * Creates a new SettingsPanel instance. 
     * Initializes state, caches DOM elements, and binds events.
     * 
     * @param {Object} config - Configuration object.
     * @param {Object} config.callbacks - Interaction callbacks for the simulation controllers.
     * @param {Function} [config.callbacks.onToggleTextures] - Called when textures toggle changes. `(enabled: boolean) => void`
     * @param {Function} [config.callbacks.onToggleLabels] - Called when labels toggle changes. `(enabled: boolean) => void`
     * @param {Function} [config.callbacks.onToggleOrbits] - Called when orbits toggle changes. `(enabled: boolean) => void`
     * @param {Function} [config.callbacks.onChangeTheme] - Called with theme name when theme changes. `(theme: string) => void`
     * @param {Function} [config.callbacks.onChangeSpeed] - Called with speed value when speed changes. `(speed: number) => void`
     * 
     * @example
     * const settings = new SettingsPanel({
     *   callbacks: {
     *     onToggleTextures: (val) => console.log('Textures:', val),
     *     onChangeTheme: (theme) => applyTheme(theme)
     *   }
     * });
     */
    constructor({ callbacks }) {
        /** 
         * @type {Object} 
         * @private
         */
        this.callbacks = callbacks;

        /** 
         * @type {SettingsManager} 
         * @description Manages persistence of settings in localStorage.
         * @private
         */
        this.settingsManager = new SettingsManager();

        /** @type {boolean} Panel visibility state */
        this.isOpen = false;

        // Cache DOM elements
        this.dom = {
            panel: document.getElementById('settings-panel'),
            btnOpen: document.getElementById('btn-settings'),
            btnClose: document.getElementById('btn-close-settings'),
            // Toggles
            toggleTextures: document.getElementById('setting-textures'),
            toggleLabels: document.getElementById('setting-labels'),
            toggleOrbits: document.getElementById('setting-orbits'),
            toggleAsteroidBelt: document.getElementById('setting-asteroid-belt'),
            toggleKuiperBelt: document.getElementById('setting-kuiper-belt'),
            toggleOortCloud: document.getElementById('setting-oort-cloud'),
            // Theme buttons
            themeButtons: document.querySelectorAll('.theme-btn'),
            // Speed
            sliderSpeed: document.getElementById('setting-speed'),
            speedValue: document.getElementById('setting-speed-value'),
        };

        if (!this.dom.panel) {
            console.error('SettingsPanel: #settings-panel not found in DOM.');
            return;
        }

        this.initializeFromSettings();
        this.bindEvents();
    }

    /**
     * Initializes UI controls from saved settings.
     */
    initializeFromSettings() {
        const settings = this.settingsManager.getAll();

        // Toggles
        if (this.dom.toggleTextures) {
            this.dom.toggleTextures.checked = settings.textures;
        }
        if (this.dom.toggleLabels) {
            this.dom.toggleLabels.checked = settings.labels;
        }
        if (this.dom.toggleOrbits) {
            this.dom.toggleOrbits.checked = settings.orbits;
        }
        if (this.dom.toggleAsteroidBelt) {
            this.dom.toggleAsteroidBelt.checked = settings.asteroidBelt !== false;
        }
        if (this.dom.toggleKuiperBelt) {
            this.dom.toggleKuiperBelt.checked = settings.kuiperBelt !== false;
        }
        if (this.dom.toggleOortCloud) {
            this.dom.toggleOortCloud.checked = settings.oortCloud !== false;
        }

        // Theme selection
        this.updateThemeButtons(settings.theme);

        // Speed slider
        if (this.dom.sliderSpeed) {
            this.dom.sliderSpeed.value = settings.speed;
            if (this.dom.speedValue) {
                this.dom.speedValue.textContent = `${settings.speed.toFixed(1)}x`;
            }
        }
    }

    /**
     * Updates the visual state of theme buttons.
     * @param {string} activeTheme - The currently active theme name.
     */
    updateThemeButtons(activeTheme) {
        this.dom.themeButtons.forEach(btn => {
            const isActive = btn.dataset.theme === activeTheme;
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            btn.classList.toggle('active', isActive);
        });
    }

    /**
     * Binds event listeners to UI controls.
     * Bug 049 Fix: All handlers stored as named references for proper cleanup.
     */
    bindEvents() {
        // Bug 049 Fix: Use AbortController for bulk cleanup
        this._abortController = new AbortController();
        const signal = this._abortController.signal;

        // Panel open/close
        if (this.dom.btnOpen) {
            this._btnOpenHandler = () => this.toggle();
            this.dom.btnOpen.addEventListener('click', this._btnOpenHandler, { signal });
        }
        if (this.dom.btnClose) {
            this._btnCloseHandler = () => this.close();
            this.dom.btnClose.addEventListener('click', this._btnCloseHandler, { signal });
        }

        // Close on click outside
        this._panelClickHandler = (e) => {
            if (e.target === this.dom.panel) {
                this.close();
            }
        };
        this.dom.panel.addEventListener('click', this._panelClickHandler, { signal });

        /**
         * Keydown listener for global shortcuts.
         * - Escape: Close panel.
         * - Comma (,): Toggle panel visibility.
         * @param {KeyboardEvent} e - The key event.
         * @private
         */
        this._keyHandler = (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                e.preventDefault();
                this.close();
            }
            if (e.key === ',' && !e.metaKey && !e.ctrlKey) {
                // Don't trigger if in input field (search box, etc.)
                if (document.activeElement.tagName !== 'INPUT' &&
                    document.activeElement.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    this.toggle();
                }
            }
        };
        document.addEventListener('keydown', this._keyHandler, { signal });

        // Toggle: Textures
        if (this.dom.toggleTextures) {
            this._texturesHandler = (e) => {
                const value = e.target.checked;
                this.settingsManager.set('textures', value);
                if (this.callbacks.onToggleTextures) {
                    this.callbacks.onToggleTextures(value);
                }
            };
            this.dom.toggleTextures.addEventListener('change', this._texturesHandler, { signal });
        }

        // Toggle: Labels
        if (this.dom.toggleLabels) {
            this._labelsHandler = (e) => {
                const value = e.target.checked;
                this.settingsManager.set('labels', value);
                if (this.callbacks.onToggleLabels) {
                    this.callbacks.onToggleLabels(value);
                }
            };
            this.dom.toggleLabels.addEventListener('change', this._labelsHandler, { signal });
        }

        // Toggle: Orbits
        if (this.dom.toggleOrbits) {
            this._orbitsHandler = (e) => {
                const value = e.target.checked;
                this.settingsManager.set('orbits', value);
                if (this.callbacks.onToggleOrbits) {
                    this.callbacks.onToggleOrbits(value);
                }
            };
            this.dom.toggleOrbits.addEventListener('change', this._orbitsHandler, { signal });
        }

        // Toggle: Asteroid Belt
        if (this.dom.toggleAsteroidBelt) {
            this._asteroidBeltHandler = (e) => {
                const value = e.target.checked;
                this.settingsManager.set('asteroidBelt', value);
                if (this.callbacks.onToggleBelt) {
                    this.callbacks.onToggleBelt('asteroid_belt', value);
                }
            };
            this.dom.toggleAsteroidBelt.addEventListener('change', this._asteroidBeltHandler, { signal });
        }

        // Toggle: Kuiper Belt
        if (this.dom.toggleKuiperBelt) {
            this._kuiperBeltHandler = (e) => {
                const value = e.target.checked;
                this.settingsManager.set('kuiperBelt', value);
                if (this.callbacks.onToggleBelt) {
                    this.callbacks.onToggleBelt('kuiper_belt', value);
                }
            };
            this.dom.toggleKuiperBelt.addEventListener('change', this._kuiperBeltHandler, { signal });
        }

        // Toggle: Oort Cloud
        if (this.dom.toggleOortCloud) {
            this._oortCloudHandler = (e) => {
                const value = e.target.checked;
                this.settingsManager.set('oortCloud', value);
                if (this.callbacks.onToggleBelt) {
                    this.callbacks.onToggleBelt('oort_cloud', value);
                }
            };
            this.dom.toggleOortCloud.addEventListener('change', this._oortCloudHandler, { signal });
        }

        // Theme buttons - store handlers in a Map for cleanup
        this._themeHandlers = new Map();
        this.dom.themeButtons.forEach(btn => {
            const handler = () => {
                const theme = btn.dataset.theme;
                this.settingsManager.set('theme', theme);
                this.updateThemeButtons(theme);
                if (this.callbacks.onChangeTheme) {
                    this.callbacks.onChangeTheme(theme);
                }
            };
            this._themeHandlers.set(btn, handler);
            btn.addEventListener('click', handler, { signal });
        });

        // Speed slider
        if (this.dom.sliderSpeed) {
            this._speedHandler = (e) => {
                const value = parseFloat(e.target.value);
                if (this.dom.speedValue) {
                    this.dom.speedValue.textContent = `${value.toFixed(1)}x`;
                }
                this.settingsManager.set('speed', value);
                if (this.callbacks.onChangeSpeed) {
                    this.callbacks.onChangeSpeed(value);
                }
            };
            this.dom.sliderSpeed.addEventListener('input', this._speedHandler, { signal });
        }
    }

    /**
     * Opens the settings panel.
     */
    open() {
        if (this.isOpen) return;
        this.isOpen = true;

        this.dom.panel.setAttribute('aria-hidden', 'false');
        this.dom.panel.classList.add('open');

        // Announce to screen readers
        const srStatus = document.getElementById('sr-status');
        if (srStatus) {
            srStatus.textContent = 'Settings panel opened';
        }

        // Focus first interactive element
        const firstInput = this.dom.panel.querySelector('input, button:not(.modal-close-btn)');
        if (firstInput) {
            firstInput.focus();
        }
    }

    /**
     * Closes the settings panel.
     */
    close() {
        if (!this.isOpen) return;
        this.isOpen = false;

        this.dom.panel.setAttribute('aria-hidden', 'true');
        this.dom.panel.classList.remove('open');

        // Announce to screen readers
        const srStatus = document.getElementById('sr-status');
        if (srStatus) {
            srStatus.textContent = 'Settings panel closed';
        }

        // Return focus to trigger button
        if (this.dom.btnOpen) {
            this.dom.btnOpen.focus();
        }
    }

    /**
     * Toggles the panel open/closed state.
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * Gets the current settings values for initialization.
     * @returns {Object} Current settings.
     */
    getSettings() {
        return this.settingsManager.getAll();
    }

    /**
     * Cleans up event listeners.
     * Bug 049 Fix: Use AbortController to remove all listeners at once.
     */
    dispose() {
        // Abort all listeners bound via signal
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
        }

        // Clear handler references
        this._keyHandler = null;
        this._btnOpenHandler = null;
        this._btnCloseHandler = null;
        this._panelClickHandler = null;
        this._texturesHandler = null;
        this._labelsHandler = null;
        this._orbitsHandler = null;
        this._asteroidBeltHandler = null;
        this._kuiperBeltHandler = null;
        this._oortCloudHandler = null;
        this._speedHandler = null;
        if (this._themeHandlers) {
            this._themeHandlers.clear();
            this._themeHandlers = null;
        }
    }
}
