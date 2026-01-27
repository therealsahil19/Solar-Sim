
import { describe, it, expect } from 'vitest';
import { createOrbitLine } from '../../src/procedural';
import * as THREE from 'three';

describe('Performance Benchmark: createOrbitLine', () => {
    it('should generate orbits efficiently', () => {
        const physicsData = {
            a: 10,
            e: 0.5,
            i: 10,
            omega: 0,
            w: 0,
            M0: 0,
            period: Math.pow(10, 1.5)
        };

        const iterations = 1000;
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
            const orbit = createOrbitLine(physicsData);
            // Ensure result is used to prevent compiler optimizations (unlikely in JS but good practice)
            expect(orbit).toBeDefined();
            // Optional: dispose geometry to simulate real usage/avoid memory pressure in test
            orbit.geometry.dispose();
            (orbit.material as THREE.Material).dispose();
        }

        const end = performance.now();
        const duration = end - start;
        const avgTime = duration / iterations;

        console.log(`\n⚡ Benchmark Results for createOrbitLine:`);
        console.log(`   Iterations: ${iterations}`);
        console.log(`   Total Time: ${duration.toFixed(2)}ms`);
        console.log(`   Avg Time:   ${avgTime.toFixed(4)}ms/orbit`);

        // Assertions to ensure it's not egregiously slow (this threshold might need adjustment based on CI)
        // This is a loose assertion just to have a passing test.
        expect(avgTime).toBeLessThan(10);
    });
});
