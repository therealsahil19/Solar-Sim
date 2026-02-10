
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { TrailManager } from '../../src/trails';

describe('TrailManager Initialization', () => {
    it('should update historyData even if WebGLTexture is not yet created', () => {
        const scene = new THREE.Scene();
        const maxTrails = 1; // Simplify test
        const pointsPerTrail = 5;
        const manager = new TrailManager(scene, maxTrails, pointsPerTrail);

        // Access private historyData for verification
        // Using 'any' to bypass private access for testing
        const historyData = (manager as any).historyData as Float32Array;

        // Mock Renderer
        // Return null for __webglTexture initially
        const properties = {
            get: vi.fn().mockReturnValue({}) // No __webglTexture
        };

        const gl = {
            TEXTURE_2D: 3553,
            texSubImage2D: vi.fn(),
        };

        const renderer = {
            getContext: () => gl,
            properties: properties,
            state: { bindTexture: vi.fn() },
            copyTextureToTexture: vi.fn(),
        } as unknown as THREE.WebGLRenderer;

        // 1. Register a trail at position (0,0,0)
        const target = new THREE.Object3D();
        target.position.set(0, 0, 0);
        target.updateMatrixWorld();
        manager.register(target, 0xff0000);

        // Verify initial historyData
        // Index 0 (column 0, row 0..N) should be 0,0,0,1
        // Layout: (y * width + x) * 4
        // x=0, width=1. So indices 0, 4, 8, 12, 16.
        expect(historyData[0]).toBe(0);
        expect(historyData[1]).toBe(0);
        expect(historyData[2]).toBe(0);

        // 2. Move target and update
        target.position.set(10, 20, 30);
        target.updateMatrixWorld();

        // Call update. This increments globalHead (starts at 0 -> 1).
        // It should update row 1 in historyData.
        manager.update(renderer);

        // Check if texSubImage2D was called
        expect(gl.texSubImage2D).not.toHaveBeenCalled(); // Because no texture

        // Check if historyData was updated at row 1
        // Row 1 index: (1 * 1 + 0) * 4 = 4

        const x = historyData[4];
        const y = historyData[5];
        const z = historyData[6];

        expect(x).toBe(10);
        expect(y).toBe(20);
        expect(z).toBe(30);
    });
});
