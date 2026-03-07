import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createSystem, ExtendedTextureLoader } from '../../src/procedural';
import { CelestialBody } from '../../src/types/system';

describe('Performance Benchmark: createBodyRing', () => {
    it('should generate body rings efficiently', () => {
        const dummyBody: CelestialBody = {
            name: "TestPlanet",
            type: "Planet",
            physics: { a: 10, e: 0, i: 0, omega: 0, Omega: 0, M0: 0 },
            visual: { size: 1, color: "#ffffff", hasRing: true }
        };

        const textureLoader = new THREE.TextureLoader() as ExtendedTextureLoader;

        const ITERATIONS = 10000;

        // Let's modify inner/outer slightly to bypass cache to actually compute UVs each time
        const start = performance.now();
        for (let i = 0; i < ITERATIONS; i++) {
            dummyBody.visual.ring = { inner: 1.4 + (i*0.0001), outer: 2.2 + (i*0.0001) };
            createSystem(dummyBody, textureLoader, false);
        }
        const totalTime = performance.now() - start;
        const avgTime = totalTime / ITERATIONS;

        console.log(`\n⚡ Optimized Benchmark Results for createBodyRing:`);
        console.log(`   Iterations: ${ITERATIONS}`);
        console.log(`   Total Time: ${totalTime.toFixed(2)}ms`);
        console.log(`   Avg Time:   ${avgTime.toFixed(4)}ms/ring`);

        expect(avgTime).toBeLessThan(2);
    });
});
