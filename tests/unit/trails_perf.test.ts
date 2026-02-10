import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { TrailManager } from '../../src/trails';

describe('Performance Benchmark: TrailManager.update', () => {
    it('should update trails efficiently', () => {
        const scene = new THREE.Scene();
        const maxTrails = 4096;
        const pointsPerTrail = 100;
        const manager = new TrailManager(scene, maxTrails, pointsPerTrail);

        // Mock Renderer
        const gl = {
            TEXTURE_2D: 3553,
            RGBA: 6408,
            FLOAT: 5126,
            texSubImage2D: vi.fn(),
        };

        const mockWebGLTexture = { isWebGLTexture: true };
        const properties = {
            get: vi.fn().mockReturnValue({ __webglTexture: mockWebGLTexture })
        };
        const state = {
            bindTexture: vi.fn(),
        };

        const renderer = {
            getContext: () => gl,
            properties: properties,
            state: state,
            copyTextureToTexture: vi.fn(),
        } as unknown as THREE.WebGLRenderer;

        // Register max trails
        const target = new THREE.Object3D();
        for (let i = 0; i < maxTrails; i++) {
            manager.register(target, 0xffffff);
        }

        // Benchmark update
        const iterations = 100;
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
            manager.update(renderer);
        }

        const end = performance.now();
        const duration = end - start;
        const avgTime = duration / iterations;
        console.log(`TrailManager.update avg time: ${avgTime.toFixed(4)}ms for ${maxTrails} trails`);

        expect(avgTime).toBeLessThan(10); // Expect < 10ms per frame
    });
});
