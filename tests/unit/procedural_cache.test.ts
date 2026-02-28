import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { clearMaterialCache, createSystem, ExtendedTextureLoader } from '../../src/procedural';

describe('Procedural Material Cache', () => {
    it('should clear caches and dispose materials effectively', () => {
        const textureLoader = new THREE.TextureLoader() as ExtendedTextureLoader;

        const data = {
            name: "Earth",
            type: "Planet",
            physics: { a: 1, e: 0, i: 0 },
            visual: { size: 1, color: 0x0000ff }
        };

        const sys = createSystem(data as any, textureLoader, false);
        const mat = sys.interactables[0].userData.solidMaterial as THREE.Material;
        const disposeSpy = vi.spyOn(mat, 'dispose');

        clearMaterialCache();

        expect(disposeSpy).toHaveBeenCalled();
    });
});
