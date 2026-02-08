import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createSun, createSystem, type ExtendedTextureLoader } from '../../src/procedural';
import type { CelestialBody } from '../../src/types/system';
import type { SolarSimUserData } from '../../src/types';

// Mock Canvas for createGlowTexture
if (typeof document === 'undefined') {
    // Basic mock for Node environment if jsdom is not fully handling canvas
}

describe('procedural.ts userData', () => {
    it('createSun should return a mesh with correctly typed userData', () => {
        const textureLoader = new THREE.TextureLoader() as ExtendedTextureLoader;
        // Mock load method to avoid network requests
        vi.spyOn(textureLoader, 'load').mockReturnValue(new THREE.Texture());

        const sun = createSun(textureLoader, false);

        const userData = sun.userData as SolarSimUserData;

        expect(userData.name).toBe('Sun');
        expect(userData.type).toBe('Star');
        expect(userData.size).toBe(2.5);
        expect(userData.distance).toBe(0);
        expect(userData.solidMaterial).toBeDefined();
        expect(userData.texturedMaterial).toBeDefined();

        sun.dispose();
    });

    it('createSystem should return interactables with correctly typed userData', () => {
        const textureLoader = new THREE.TextureLoader() as ExtendedTextureLoader;
        vi.spyOn(textureLoader, 'load').mockReturnValue(new THREE.Texture());

        const planetData: CelestialBody = {
            name: 'TestPlanet',
            type: 'Planet',
            description: 'A test planet',
            physics: {
                a: 10,
                e: 0.1,
                i: 0,
                Omega: 0,
                w: 0,
                M: 0,
                period: 100
            },
            visual: {
                size: 1,
                color: 0xff0000,
                texture: 'planet.jpg'
            },
            moons: []
        };

        const system = createSystem(planetData, textureLoader, false);

        // Check the interactable mesh (the planet mesh)
        const mesh = system.interactables[0];
        expect(mesh).toBeDefined();

        const userData = mesh!.userData as SolarSimUserData;

        expect(userData.name).toBe('TestPlanet');
        expect(userData.type).toBe('Planet');
        expect(userData.size).toBe(1);
        expect(userData.distance).toBe(10);
        expect(userData.solidMaterial).toBeDefined();
        expect(userData.texturedMaterial).toBeDefined();

        // Also check pivot userData if applicable, although createSystem adds physics/type to pivot userData
        // but not size/distance/materials necessarily in the same way (let's check implementation)
        // Implementation:
        // (pivot.userData as Record<string, unknown>).physics = data.physics;
        // (pivot.userData as Record<string, unknown>).type = data.type;
        // Wait, I didn't add size/distance to pivot in createSystem, only to mesh userData via userData variable.
    });
});
