/**
 * @file InfoPanel.test.ts
 * @description Unit tests for the InfoPanel component.
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { InfoPanel, type InfoPanelCallbacks } from '../../src/components/InfoPanel';

describe('InfoPanel', () => {
    let callbacks: InfoPanelCallbacks;
    let panel: InfoPanel;

    beforeEach(() => {
        // Setup mock DOM elements
        document.body.innerHTML = `
            <div id="info-panel" class="glass-panel">
                <h2 id="info-name">Planet Name</h2>
                <div id="info-type" class="info-type">Type</div>
                <p id="info-desc" class="info-desc">Description</p>
                <div id="info-radius">Radius: -</div>
                <div id="info-distance">Orbit: -</div>
                <div id="info-dist-sun">Dist to Sun: -</div>
                <button id="btn-follow">Follow Object</button>
            </div>
        `;

        callbacks = {
            onFollow: vi.fn()
        };

        panel = new InfoPanel({ callbacks });
    });

    afterEach(() => {
        panel.dispose();
        document.body.innerHTML = '';
    });

    it('should update DOM with mesh data', () => {
        const mesh = new THREE.Mesh();
        mesh.userData = {
            name: 'Mars',
            type: 'Planet',
            description: 'Red planet',
            size: 0.53,
            distance: 1.52
        };

        panel.update(mesh);

        expect(document.getElementById('info-name')?.textContent).toBe('Mars');
        expect(document.getElementById('info-type')?.textContent).toBe('Planet');
        expect(document.getElementById('info-desc')?.textContent).toBe('Red planet');
        expect(document.getElementById('info-radius')?.textContent).toContain('0.53');
        expect(document.getElementById('info-distance')?.textContent).toContain('1.52');

        const panelEl = document.getElementById('info-panel');
        expect(panelEl?.classList.contains('visible')).toBe(true);
    });

    it('should trigger onFollow callback', () => {
        const mesh = new THREE.Mesh();
        mesh.userData = { name: 'Earth' };
        panel.update(mesh);

        const btn = document.getElementById('btn-follow') as HTMLButtonElement;
        btn.click();

        expect(callbacks.onFollow).toHaveBeenCalledWith(mesh);
    });

    it('should hide the panel', () => {
        const mesh = new THREE.Mesh();
        panel.update(mesh);

        const panelEl = document.getElementById('info-panel');
        expect(panelEl?.classList.contains('visible')).toBe(true);

        panel.hide();
        expect(panelEl?.classList.contains('visible')).toBe(false);
    });
});
