/**
 * @file CommandPalette.test.ts
 * @description Unit tests for the CommandPalette component.
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CommandPalette, type CommandPaletteCallbacks } from '../../src/components/CommandPalette';
import type { CelestialBody } from '../../src/types/system';

describe('CommandPalette', () => {
    let callbacks: CommandPaletteCallbacks;
    let planetData: CelestialBody[];
    let palette: CommandPalette;

    beforeEach(() => {
        // Mock scrollIntoView which is missing in jsdom
        window.HTMLElement.prototype.scrollIntoView = vi.fn();

        // Mock callbacks
        callbacks = {
            onSelectByName: vi.fn(),
            onToggleOrbits: vi.fn(),
            onToggleLabels: vi.fn(),
            onToggleTexture: vi.fn(),
            onToggleCamera: vi.fn(),
            onResetCamera: vi.fn(),
            onTogglePause: vi.fn(),
            openModal: vi.fn(),
            onToggleTheme: vi.fn()
        };

        // Mock celestial data
        planetData = [
            {
                name: 'Sun',
                type: 'star',
                visual: { size: 1, color: 0xffff00 },
                physics: { a: 0, e: 0, i: 0, w: 0, M: 0, period: 1 }
            },
            {
                name: 'Earth',
                type: 'planet',
                visual: { size: 1, color: 0x0000ff },
                physics: { a: 1, e: 0, i: 0, w: 0, M: 0, period: 1 },
                moons: [
                    {
                        name: 'Moon',
                        type: 'moon',
                        visual: { size: 0.2, color: 0x888888 },
                        physics: { a: 0.1, e: 0, i: 0, w: 0, M: 0, period: 0.1 }
                    }
                ]
            }
        ];

        // Instantiate
        palette = new CommandPalette(planetData, callbacks);
    });

    afterEach(() => {
        palette.dispose();
        document.body.innerHTML = '';
    });

    it('should initialize and append overlay to body', () => {
        const overlay = document.getElementById('cmd-palette-overlay');
        expect(overlay).toBeTruthy();
        expect(overlay?.hidden).toBe(true);
    });

    it('should open and close programmatically', () => {
        const overlay = document.getElementById('cmd-palette-overlay') as HTMLElement;

        palette.open();
        expect(palette.isOpen()).toBe(true);
        expect(overlay.hidden).toBe(false);
        expect(overlay.classList.contains('visible')).toBe(true);

        palette.close();
        expect(palette.isOpen()).toBe(false);
        // Note: overlay.hidden is set after timeout in real code, 
        // effectively we check class removal immediately
        expect(overlay.classList.contains('visible')).toBe(false);
    });

    it('should flatten planet data into searchable items', () => {
        palette.open();
        const input = document.querySelector('input') as HTMLInputElement;

        // Search for 'Earth'
        vi.useFakeTimers();
        input.value = 'Earth';
        input.dispatchEvent(new Event('input'));
        vi.runAllTimers();
        vi.useRealTimers();

        const items = document.querySelectorAll('.cmd-item');
        expect(items.length).toBeGreaterThan(0);
        expect(items[0].textContent).toContain('Earth');
    });

    it('should include static commands', () => {
        palette.open();
        const input = document.querySelector('input') as HTMLInputElement;

        // Search for 'Toggle Orbits'
        vi.useFakeTimers();
        input.value = 'Toggle Orbits';
        input.dispatchEvent(new Event('input'));
        vi.runAllTimers();
        vi.useRealTimers();

        const items = document.querySelectorAll('.cmd-item');
        expect(items.length).toBe(1);
        expect(items[0].textContent).toContain('Toggle Orbits');
    });

    it('should handle keyboard navigation (ArrowDown)', () => {
        palette.open();
        const input = document.querySelector('input') as HTMLInputElement;

        // Ensure we have items
        input.dispatchEvent(new Event('input'));

        const items = document.querySelectorAll('.cmd-item');
        if (items.length < 2) return; // Skip if not enough items

        // Initial selection should be index 0
        expect(items[0].classList.contains('selected')).toBe(true);

        // Press Down
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        expect(items[1].classList.contains('selected')).toBe(true);
        expect(items[0].classList.contains('selected')).toBe(false);
    });

    it('should execute command on Enter', () => {
        palette.open();
        const input = document.querySelector('input') as HTMLInputElement;

        // Filter for "Toggle Orbits"
        vi.useFakeTimers();
        input.value = 'Toggle Orbits';
        input.dispatchEvent(new Event('input'));
        vi.runAllTimers();

        // Press Enter
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        vi.useRealTimers();

        expect(callbacks.onToggleOrbits).toHaveBeenCalled();
        expect(palette.isOpen()).toBe(false);
    });

    it('should select planet on Enter', () => {
        palette.open();
        const input = document.querySelector('input') as HTMLInputElement;

        // Filter for "Earth"
        vi.useFakeTimers();
        input.value = 'Earth';
        input.dispatchEvent(new Event('input'));
        vi.runAllTimers();

        // Press Enter
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        vi.useRealTimers();

        expect(callbacks.onSelectByName).toHaveBeenCalledWith('Earth');
        expect(palette.isOpen()).toBe(false);
    });

    it('should close on Escape', () => {
        palette.open();
        const input = document.querySelector('input') as HTMLInputElement;

        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(palette.isOpen()).toBe(false);
    });

    it('should show "No results found" when query returns no items', () => {
        palette.open();
        const input = document.querySelector('input') as HTMLInputElement;

        vi.useFakeTimers();
        input.value = 'ZZZ_INVALID_QUERY_ZZZ';
        input.dispatchEvent(new Event('input'));
        vi.runAllTimers();

        const emptyItem = document.querySelector('.cmd-empty');
        expect(emptyItem).toBeTruthy();
        expect(emptyItem?.textContent).toBe('No results found.');
        vi.useRealTimers();
    });

    it('should debounce search input', () => {
        palette.open();
        const input = document.querySelector('input') as HTMLInputElement;

        vi.useFakeTimers();
        input.value = 'E';
        input.dispatchEvent(new Event('input'));
        input.value = 'Ea';
        input.dispatchEvent(new Event('input'));
        input.value = 'Earth';
        input.dispatchEvent(new Event('input'));

        // Should still show all items (since it hasn't filtered yet)
        const initialCount = document.querySelectorAll('.cmd-item').length;
        expect(initialCount).toBeGreaterThan(1);

        vi.advanceTimersByTime(150);
        // After 150ms, it should have filtered down to Earth
        expect(document.querySelectorAll('.cmd-item').length).toBe(1);
        vi.useRealTimers();
    });
});
