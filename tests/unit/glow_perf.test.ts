
import { describe, it, expect } from 'vitest';
import { createGlowTexture } from '../../src/procedural';
import * as THREE from 'three';

describe('Performance Benchmark: createGlowTexture', () => {
    it('should generate glow textures efficiently', () => {
        const iterations = 1000;
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
            const texture = createGlowTexture();
            expect(texture).toBeDefined();
            // Do NOT dispose, as it is now a shared singleton
        }

        const end = performance.now();
        const duration = end - start;
        const avgTime = duration / iterations;

        console.log(`\n⚡ Benchmark Results for createGlowTexture:`);
        console.log(`   Iterations: ${iterations}`);
        console.log(`   Total Time: ${duration.toFixed(2)}ms`);
        console.log(`   Avg Time:   ${avgTime.toFixed(4)}ms/texture`);

        expect(avgTime).toBeLessThan(10); // Loose upper bound
    });
});
