import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SettingsPanel } from '../../src/components/SettingsPanel';

// Mock SettingsManager so we don't depend on LocalStorage
vi.mock('../../src/managers/SettingsManager', () => {
    return {
        SettingsManager: vi.fn().mockImplementation(() => {
            return {
                getAll: vi.fn().mockReturnValue({
                    theme: 'dark',
                    speed: 1.0,
                    textures: true,
                    labels: true,
                    orbits: true,
                    asteroidBelt: true,
                    kuiperBelt: true,
                    oortCloud: true
                }),
                set: vi.fn()
            };
        })
    };
});

describe('SettingsPanel', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let callbacks: any;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="settings-panel"></div>
            <button id="btn-settings"></button>
            <button id="btn-close-settings"></button>
            <input type="checkbox" id="setting-textures" />
            <input type="checkbox" id="setting-labels" />
            <input type="checkbox" id="setting-orbits" />
            <input type="checkbox" id="setting-asteroid-belt" />
            <input type="checkbox" id="setting-kuiper-belt" />
            <input type="checkbox" id="setting-oort-cloud" />
            <button class="theme-btn" data-theme="dark"></button>
            <button class="theme-btn" data-theme="light"></button>
            <input type="range" id="setting-speed" value="1.0" />
            <span id="setting-speed-value"></span>
            <div id="sr-status"></div>
        `;

        callbacks = {
            onToggleTextures: vi.fn(),
            onToggleLabels: vi.fn(),
            onToggleOrbits: vi.fn(),
            onChangeTheme: vi.fn(),
            onChangeSpeed: vi.fn(),
            onToggleBelt: vi.fn()
        };
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.clearAllMocks();
    });

    it('should initialize and open/close the panel', () => {
        const panel = new SettingsPanel({ callbacks });
        const panelEl = document.getElementById('settings-panel')!;

        expect(panel.isOpen()).toBe(false);

        panel.open();
        expect(panel.isOpen()).toBe(true);
        expect(panelEl.classList.contains('open')).toBe(true);

        panel.close();
        expect(panel.isOpen()).toBe(false);
        expect(panelEl.classList.contains('open')).toBe(false);

        panel.dispose();
    });

    it('should dispatch callback on toggle textures', () => {
        const panel = new SettingsPanel({ callbacks });
        const checkbox = document.getElementById('setting-textures') as HTMLInputElement;

        checkbox.checked = false;
        checkbox.dispatchEvent(new Event('change'));

        expect(callbacks.onToggleTextures).toHaveBeenCalledWith(false);
        panel.dispose();
    });

    it('should dispatch callback on toggle belts', () => {
        const panel = new SettingsPanel({ callbacks });
        const checkbox = document.getElementById('setting-asteroid-belt') as HTMLInputElement;

        checkbox.checked = false;
        checkbox.dispatchEvent(new Event('change'));

        expect(callbacks.onToggleBelt).toHaveBeenCalledWith('asteroid_belt', false);
        panel.dispose();
    });

    it('should dispatch callback on theme change', () => {
        const panel = new SettingsPanel({ callbacks });
        const lightThemeBtn = document.querySelectorAll('.theme-btn')[1] as HTMLButtonElement;

        lightThemeBtn.dispatchEvent(new Event('click'));
        expect(callbacks.onChangeTheme).toHaveBeenCalledWith('light');
        panel.dispose();
    });

    it('should dispatch callback on speed change', () => {
        const panel = new SettingsPanel({ callbacks });
        const slider = document.getElementById('setting-speed') as HTMLInputElement;

        slider.value = '2.5';
        slider.dispatchEvent(new Event('input'));

        expect(callbacks.onChangeSpeed).toHaveBeenCalledWith(2.5);
        panel.dispose();
    });
});
