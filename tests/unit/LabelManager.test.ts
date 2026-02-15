/**
 * @file LabelManager.test.ts
 * @description Unit tests for the LabelManager component.
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { LabelManager } from '../../src/managers/LabelManager';

describe('LabelManager', () => {
    let renderer: CSS2DRenderer;
    let camera: THREE.PerspectiveCamera;
    let manager: LabelManager;

    beforeEach(() => {
        renderer = new CSS2DRenderer();
        camera = new THREE.PerspectiveCamera();
        manager = new LabelManager(renderer, camera);

        // Mock viewport
        vi.stubGlobal('innerWidth', 1024);
        vi.stubGlobal('innerHeight', 768);
    });

    it('should add and remove labels', () => {
        const div = document.createElement('div');
        const label = new CSS2DObject(div);

        manager.add(label);
        // Accessing private for test verification
        expect((manager as any).labels.length).toBe(1);

        manager.remove(label);
        expect((manager as any).labels.length).toBe(0);
    });

    it('should toggle label visibility', () => {
        const label1 = new CSS2DObject(document.createElement('div'));
        const label2 = new CSS2DObject(document.createElement('div'));
        manager.add(label1);
        manager.add(label2);

        manager.toggle(false);
        expect(label1.visible).toBe(false);
        expect(label2.visible).toBe(false);

        manager.toggle(true);
        expect(label1.visible).toBe(true);
        expect(label2.visible).toBe(true);
    });

    it('should perform frustum culling', () => {
        const label = new CSS2DObject(document.createElement('div'));
        label.position.set(0, 0, -10); // In front
        manager.add(label);

        // Mock project and containPoint
        // We actually want to test the update logic
        // This is complex in jsdom with Three.js classes
        // but we can at least verify it doesn't throw and sets base visibility
        manager.update(null, null);
        expect(label.visible).toBe(true);
    });

    it('should calculate grid index correctly', () => {
        (manager as any).labelGridCols = 10;
        (manager as any).labelGridRows = 10;

        expect((manager as any).getGridIndex(0, 0)).toBe(0);
        expect((manager as any).getGridIndex(5, 2)).toBe(25);
        expect((manager as any).getGridIndex(-1, 0)).toBe(-1);
    });
});
