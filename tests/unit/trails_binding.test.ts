import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { TrailManager } from '../../src/trails';

describe('TrailManager Texture Binding', () => {
    it('should bind the raw WebGLTexture, not the Three.js Texture object', () => {
        const scene = new THREE.Scene();
        const manager = new TrailManager(scene, 10, 10);

        // Mock WebGLTexture
        const mockWebGLTexture = { isWebGLTexture: true };

        // Mock WebGLContext
        const gl = {
            TEXTURE_2D: 3553,
            RGBA: 6408,
            FLOAT: 5126,
            texSubImage2D: vi.fn(),
        };

        // Mock Renderer Properties
        const properties = {
            get: vi.fn().mockReturnValue({ __webglTexture: mockWebGLTexture })
        };

        // Mock Renderer State
        const state = {
            bindTexture: vi.fn(),
        };

        // Mock Renderer
        const renderer = {
            getContext: () => gl,
            properties: properties,
            state: state,
        } as unknown as THREE.WebGLRenderer;

        // Trigger update
        // We need at least one trail to trigger uploadTextureRow
        const obj = new THREE.Object3D();
        manager.register(obj, 0xffffff);
        manager.update(renderer);

        // Verify bindTexture was called
        expect(state.bindTexture).toHaveBeenCalled();

        // Check arguments
        const [target, texture] = state.bindTexture.mock.calls[0];
        expect(target).toBe(gl.TEXTURE_2D);
        expect(texture).toBe(mockWebGLTexture);
        expect(texture).not.toBe(manager['historyTexture']);
    });
});
