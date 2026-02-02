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

function generateLargeSystem(childCount: number): CelestialBody {
    const grandchildren: CelestialBody[] = [];
    for (let i = 0; i < childCount; i++) {
        grandchildren.push({
            name: `Moon ${i}`,
            type: "Moon",
            physics: { a: 1 + i*0.001, e: 0, i: 0 },
            visual: { size: 1, color: "#fff" },
            moons: []
        });
    }

    const child: CelestialBody = {
        name: "Planet",
        type: "Planet",
        physics: { a: 10, e: 0, i: 0 },
        visual: { size: 5, color: "#f00" },
        moons: grandchildren
    };

    return {
        name: "Root",
        type: "Star",
        physics: { a: 0, e: 0, i: 0 },
        visual: { size: 10, color: "#ff0" },
        moons: [child]
    };
}

describe('Performance: createSystem Spread Operator', () => {
    it('should handle large recursive arrays without stack overflow', () => {
        // 50,000 items to verify performance and correctness without OOMing standard CI
        const childCount = 50000;
        console.log(`Generating system with ${childCount} grandchildren...`);
        const data = generateLargeSystem(childCount);

        const start = performance.now();

        try {
            const result = createSystem(data, mockTextureLoader, false);
            const end = performance.now();
            console.log(`Processed ${childCount} grandchildren in ${(end - start).toFixed(2)}ms`);

            // Verify basic structure
            // Root (1) + Planet (1) + Moons (150000) = 150002 interactables (meshes)
            // But wait, createSystem returns only meshes created at that level + children.
            // result.interactables should contain RootMesh + PlanetMesh + 150k MoonMeshes.
            expect(result.interactables.length).toBeGreaterThanOrEqual(childCount);
        } catch (error: any) {
            console.error("Benchmark crashed:", error.message);
            throw error;
        }
    });
});
