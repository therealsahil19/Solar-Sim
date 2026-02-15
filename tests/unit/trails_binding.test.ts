import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { TrailManager } from '../../src/trails';

describe('TrailManager Texture Binding', () => {
    it('should use renderer.copyTextureToTexture for updates', () => {
        const scene = new THREE.Scene();
        const manager = new TrailManager(scene, 10, 10);

        // Mock Renderer
        const renderer = {
            copyTextureToTexture: vi.fn(),
            properties: { get: vi.fn() },
            state: { bindTexture: vi.fn() }
        } as unknown as THREE.WebGLRenderer;

        // Trigger update
        // We need at least one trail to trigger processing
        const obj = new THREE.Object3D();
        manager.register(obj, 0xffffff);

        manager.update(renderer);

        // Verify copyTextureToTexture was called
        expect(renderer.copyTextureToTexture).toHaveBeenCalled();

        // Check arguments
        const args = (renderer.copyTextureToTexture as any).mock.calls[0];
        // args[0] is position (Vector2)
        // args[1] is srcTexture (rowTexture)
        // args[2] is dstTexture (historyTexture)
        expect(args[0]).toBeInstanceOf(THREE.Vector2);
        expect(args[1].isDataTexture).toBe(true);
        expect(args[2]).toBe(manager['historyTexture']);
    });
});
