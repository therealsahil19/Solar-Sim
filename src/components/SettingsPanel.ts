/**
 * @file SettingsPanel.ts
 * @description A slide-out settings panel component for managing simulation preferences.
 *
 * This component follows the same pattern as InfoPanel.ts and NavigationSidebar.ts:
 * 1. **DOM Caching**: References DOM elements once at construction.
 * 2. **Event Binding**: Centralizes event handlers with cleanup.
 * 3. **Callbacks**: Communicates changes via callback functions.
 * 4. **Accessibility**: Uses ARIA attributes for screen reader support.
 */

import { SettingsManager, type Settings } from '../managers/SettingsManager';
import type { Disposable, ThemeName } from '../types';

/**
 * DOM element cache for SettingsPanel.
 */
interface SettingsPanelDOM {
    panel: HTMLElement | null;
    btnOpen: HTMLButtonElement | null;
    btnClose: HTMLButtonElement | null;
    toggleTextures: HTMLInputElement | null;
    toggleLabels: HTMLInputElement | null;
    toggleOrbits: HTMLInputElement | null;
    toggleAsteroidBelt: HTMLInputElement | null;
    toggleKuiperBelt: HTMLInputElement | null;
    toggleOortCloud: HTMLInputElement | null;
    themeButtons: NodeListOf<HTMLButtonElement>;
    sliderSpeed: HTMLInputElement | null;
    speedValue: HTMLElement | null;
}

/**
 * Callbacks for SettingsPanel interactions.
 */
export interface SettingsPanelCallbacks {
    onToggleTextures?: (enabled: boolean) => void;
    onToggleLabels?: (enabled: boolean) => void;
    onToggleOrbits?: (enabled: boolean) => void;
    onChangeTheme?: (theme: ThemeName) => void;
    onChangeSpeed?: (speed: number) => void;
    onToggleBelt?: (type: string, enabled: boolean) => void;
}

/**
 * Configuration for SettingsPanel.
 */
export interface SettingsPanelConfig {
    callbacks: SettingsPanelCallbacks;
}

/**
 * A slide-out settings panel for managing simulation preferences.
 */
export class SettingsPanel implements Disposable {
    private callbacks: SettingsPanelCallbacks;
    private settingsManager: SettingsManager;
    private _isOpen: boolean = false;
    private dom: SettingsPanelDOM;
    private _abortController: AbortController | null = null;

    /**
     * Creates a new SettingsPanel instance.
     * @param config - Configuration with callbacks.
     */
    constructor({ callbacks }: SettingsPanelConfig) {
        this.callbacks = callbacks;
        this.settingsManager = new SettingsManager();

        // Cache DOM elements
        this.dom = {
            panel: document.getElementById('settings-panel'),
            btnOpen: document.getElementById('btn-settings') as HTMLButtonElement | null,
            btnClose: document.getElementById('btn-close-settings') as HTMLButtonElement | null,
            toggleTextures: document.getElementById('setting-textures') as HTMLInputElement | null,
            toggleLabels: document.getElementById('setting-labels') as HTMLInputElement | null,
            toggleOrbits: document.getElementById('setting-orbits') as HTMLInputElement | null,
            toggleAsteroidBelt: document.getElementById('setting-asteroid-belt') as HTMLInputElement | null,
            toggleKuiperBelt: document.getElementById('setting-kuiper-belt') as HTMLInputElement | null,
            toggleOortCloud: document.getElementById('setting-oort-cloud') as HTMLInputElement | null,
            themeButtons: document.querySelectorAll<HTMLButtonElement>('.theme-btn'),
            sliderSpeed: document.getElementById('setting-speed') as HTMLInputElement | null,
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
    private initializeFromSettings(): void {
        const settings = this.settingsManager.getAll();

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

        this.updateThemeButtons(settings.theme);

        if (this.dom.sliderSpeed) {
            this.dom.sliderSpeed.value = String(settings.speed);
            if (this.dom.speedValue) {
                this.dom.speedValue.textContent = `${settings.speed.toFixed(1)}x`;
            }
        }
    }

    /**
     * Updates the visual state of theme buttons.
     */
    private updateThemeButtons(activeTheme: ThemeName): void {
        this.dom.themeButtons.forEach(btn => {
            const isActive = btn.dataset.theme === activeTheme;
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            btn.classList.toggle('active', isActive);
        });
    }

    /**
     * Binds event listeners to UI controls.
     */
    private bindEvents(): void {
        this._abortController = new AbortController();
        const signal = this._abortController.signal;

        // Panel open/close
        if (this.dom.btnOpen) {
            this.dom.btnOpen.addEventListener('click', () => this.toggle(), { signal });
        }
        if (this.dom.btnClose) {
            this.dom.btnClose.addEventListener('click', () => this.close(), { signal });
        }

        // Close on click outside
        if (this.dom.panel) {
            this.dom.panel.addEventListener('click', (e) => {
                if (e.target === this.dom.panel) {
                    this.close();
                }
            }, { signal });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this._isOpen) {
                e.preventDefault();
                this.close();
            }
            if (e.key === ',' && !e.metaKey && !e.ctrlKey) {
                const activeEl = document.activeElement;
                if (activeEl?.tagName !== 'INPUT' && activeEl?.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    this.toggle();
                }
            }
        }, { signal });

        // Toggle: Textures
        if (this.dom.toggleTextures) {
            this.dom.toggleTextures.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                const value = target.checked;
                this.settingsManager.set('textures', value);
                this.callbacks.onToggleTextures?.(value);
            }, { signal });
        }

        // Toggle: Labels
        if (this.dom.toggleLabels) {
            this.dom.toggleLabels.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                const value = target.checked;
                this.settingsManager.set('labels', value);
                this.callbacks.onToggleLabels?.(value);
            }, { signal });
        }

        // Toggle: Orbits
        if (this.dom.toggleOrbits) {
            this.dom.toggleOrbits.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                const value = target.checked;
                this.settingsManager.set('orbits', value);
                this.callbacks.onToggleOrbits?.(value);
            }, { signal });
        }

        // Toggle: Asteroid Belt
        if (this.dom.toggleAsteroidBelt) {
            this.dom.toggleAsteroidBelt.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                const value = target.checked;
                this.settingsManager.set('asteroidBelt', value);
                this.callbacks.onToggleBelt?.('asteroid_belt', value);
            }, { signal });
        }

        // Toggle: Kuiper Belt
        if (this.dom.toggleKuiperBelt) {
            this.dom.toggleKuiperBelt.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                const value = target.checked;
                this.settingsManager.set('kuiperBelt', value);
                this.callbacks.onToggleBelt?.('kuiper_belt', value);
            }, { signal });
        }

        // Toggle: Oort Cloud
        if (this.dom.toggleOortCloud) {
            this.dom.toggleOortCloud.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                const value = target.checked;
                this.settingsManager.set('oortCloud', value);
                this.callbacks.onToggleBelt?.('oort_cloud', value);
            }, { signal });
        }

        // Theme buttons
        this.dom.themeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const theme = btn.dataset.theme as ThemeName;
                this.settingsManager.set('theme', theme);
                this.updateThemeButtons(theme);
                this.callbacks.onChangeTheme?.(theme);
            }, { signal });
        });

        // Speed slider
        if (this.dom.sliderSpeed) {
            this.dom.sliderSpeed.addEventListener('input', (e) => {
                const target = e.target as HTMLInputElement;
                const value = parseFloat(target.value);
                if (this.dom.speedValue) {
                    this.dom.speedValue.textContent = `${value.toFixed(1)}x`;
                }
                this.settingsManager.set('speed', value);
                this.callbacks.onChangeSpeed?.(value);
            }, { signal });
        }
    }

    /** Opens the settings panel */
    open(): void {
        if (this._isOpen || !this.dom.panel) return;
        this._isOpen = true;

        this.dom.panel.setAttribute('aria-hidden', 'false');
        this.dom.panel.classList.add('open');

        const srStatus = document.getElementById('sr-status');
        if (srStatus) {
            srStatus.textContent = 'Settings panel opened';
        }

        const firstInput = this.dom.panel.querySelector<HTMLElement>('input, button:not(.modal-close-btn)');
        firstInput?.focus();
    }

    /** Closes the settings panel */
    close(): void {
        if (!this._isOpen || !this.dom.panel) return;
        this._isOpen = false;

        this.dom.panel.setAttribute('aria-hidden', 'true');
        this.dom.panel.classList.remove('open');

        const srStatus = document.getElementById('sr-status');
        if (srStatus) {
            srStatus.textContent = 'Settings panel closed';
        }

        this.dom.btnOpen?.focus();
    }

    /** Toggles the panel open/closed state */
    toggle(): void {
        if (this._isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /** Gets the current settings values */
    getSettings(): Settings {
        return this.settingsManager.getAll();
    }

    /** Returns whether the panel is currently open */
    isOpen(): boolean {
        return this._isOpen;
    }

    /** Cleans up event listeners */
    dispose(): void {
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
        }
    }
}
