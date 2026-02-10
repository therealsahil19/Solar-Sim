/**
 * @file NavigationSidebar.test.ts
 * @description Unit tests for the NavigationSidebar component.
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NavigationSidebar, type NavigationSidebarCallbacks } from '../../src/components/NavigationSidebar';
import type { CelestialBody } from '../../src/types/system';

describe('NavigationSidebar', () => {
    let callbacks: NavigationSidebarCallbacks;
    let planetData: CelestialBody[];
    let sidebar: NavigationSidebar;

    beforeEach(() => {
        // Setup DOM
        document.body.innerHTML = `
            <div id="nav-sidebar" aria-hidden="true"></div>
            <div id="nav-list"></div>
            <input id="nav-search" type="text" />
            <button id="btn-close-nav"></button>
            <button id="btn-planets"></button>
        `;

        // Mock callbacks
        callbacks = {
            onSelect: vi.fn(),
            onClose: vi.fn()
        };

        // Mock celestial data
        planetData = [
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
        sidebar = new NavigationSidebar({ planetData, callbacks });
    });

    afterEach(() => {
        sidebar.dispose();
        document.body.innerHTML = '';
    });

    it('should initialize and render the tree', () => {
        const list = document.getElementById('nav-list');
        expect(list?.children.length).toBeGreaterThan(0);

        // Should contain Sun (added manually) and Earth
        expect(list?.textContent).toContain('Sun');
        expect(list?.textContent).toContain('Earth');
        // Moon should be nested
        expect(list?.textContent).toContain('Moon');
    });

    it('should trigger onSelect when an item is clicked', () => {
        const list = document.getElementById('nav-list');
        // Find button for Earth
        const buttons = list?.querySelectorAll('button');
        const earthBtn = Array.from(buttons || []).find(b => b.textContent?.includes('Earth'));

        expect(earthBtn).toBeTruthy();
        earthBtn?.click();

        expect(callbacks.onSelect).toHaveBeenCalledWith('Earth');
    });

    it('should open and close the sidebar', () => {
        const sbEl = document.getElementById('nav-sidebar');

        sidebar.open();
        expect(sidebar.isOpen()).toBe(true);
        expect(sbEl?.getAttribute('aria-hidden')).toBe('false');
        expect(sbEl?.classList.contains('animate-in')).toBe(true);

        sidebar.close();
        expect(sidebar.isOpen()).toBe(false);
        // animate-out is added, aria-hidden is set after timeout
        expect(sbEl?.classList.contains('animate-out')).toBe(true);
    });

    it('should filter items when searching', () => {
        const searchInput = document.getElementById('nav-search') as HTMLInputElement;
        const list = document.getElementById('nav-list');

        // Initial state: key elements visible
        // We can't easily check 'display: none' computed style in jsdom without layout,
        // but the inline style should be set.

        // Search for 'Moon'
        searchInput.value = 'Moon';
        searchInput.dispatchEvent(new Event('input'));

        // Earth (parent) should be visible, Moon (match) visible, Sun (no match) hidden
        const items = list?.querySelectorAll('.nav-li') as NodeListOf<HTMLElement>;

        let sunItem: HTMLElement | null = null;
        let moonItem: HTMLElement | null = null;
        let earthItem: HTMLElement | null = null;

        items.forEach(li => {
            if (li.textContent?.includes('Sun')) sunItem = li;
            if (li.textContent?.includes('Moon') && !li.textContent?.includes('Earth')) moonItem = li; // Moon
            if (li.querySelector('button')?.textContent?.includes('Earth')) earthItem = li;
        });

        // Sun should be hidden
        expect(sunItem?.style.display).toBe('none');

        // Moon should be visible
        // Note: Our implementation clears display (sets to empty string) for matches
        expect(moonItem?.style.display).toBe('');

        // Earth (parent of moon) should be visible
        expect(earthItem?.style.display).toBe('');
    });

    it('should handle open/close button clicks', () => {
        const btnOpen = document.getElementById('btn-planets');
        const btnClose = document.getElementById('btn-close-nav');

        btnOpen?.click();
        expect(sidebar.isOpen()).toBe(true);

        btnClose?.click();
        expect(sidebar.isOpen()).toBe(false);
    });
});
