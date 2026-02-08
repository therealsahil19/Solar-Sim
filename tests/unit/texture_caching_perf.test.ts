
import { describe, it, expect, vi } from 'vitest';
import { createSystem, ExtendedTextureLoader } from '../../src/procedural';
import * as THREE from 'three';
import type { CelestialBody } from '../../src/types/system';

// Mock TextureLoader
const mockTextureLoader = {
    load: vi.fn().mockImplementation(() => new THREE.Texture()),
    instanceRegistry: undefined,
    trailManager: undefined,
    lazyLoadQueue: undefined
} as unknown as ExtendedTextureLoader;

describe('Performance: Material Caching', () => {
    it('should reuse materials for identical textures', () => {
        const textureUrl = 'textures/moon.jpg';
        const moons: CelestialBody[] = [];
        for (let i = 0; i < 100; i++) {
            moons.push({
                name: `Moon ${i}`,
                type: "Moon",
                physics: { a: 10 + i, e: 0, i: 0 },
                visual: { size: 1, color: "#fff", texture: textureUrl },
                moons: []
            });
        }

        const planet: CelestialBody = {
            name: "Planet",
            type: "Planet",
            physics: { a: 0, e: 0, i: 0 },
            visual: { size: 10, color: "#f00" },
            moons: moons
        };

        const result = createSystem(planet, mockTextureLoader, true); // useTextures = true

        const materials = new Set<THREE.Material>();

        result.interactables.forEach(mesh => {
            if (mesh.userData.type === 'Moon') {
                const mat = (mesh as THREE.Mesh).material;
                if (mat) {
                    materials.add(mat as THREE.Material);
                }
            }
        });

        console.log(`Unique materials created for 100 moons: ${materials.size}`);

        // Without optimization, we expect 100 materials.
        // With optimization, we expect 1.
        expect(materials.size).toBe(1);
    });
});
