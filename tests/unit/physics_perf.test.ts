
import { describe, it, expect } from 'vitest';
import { physicsToRender } from '../../src/physics';
import * as THREE from 'three';

describe('Performance Benchmark: physicsToRender', () => {
    it('should scale coordinates efficiently', () => {
        const vectors = [
            new THREE.Vector3(10, 5, 2),    // Zone 1: Inner
            new THREE.Vector3(40, 5, 2),    // Zone 2: Kuiper
            new THREE.Vector3(100, 50, 20)  // Zone 3: Oort
        ];

        const out = new THREE.Vector3();
        const iterations = 500_000;

        // Warmup
        for (let i = 0; i < 1000; i++) {
            physicsToRender(vectors[i % 3], out);
        }

        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
            // Cycle through vectors to avoid branch prediction optimization bias
            // although modern JS engines are smart, this simulates random access better
            // than a single vector.
            // Using bitwise AND for modulo 3 is not simple, so we just use % 3
            // or just unroll it.
            physicsToRender(vectors[0], out);
            physicsToRender(vectors[1], out);
            physicsToRender(vectors[2], out);
        }

        const end = performance.now();
        const duration = end - start;
        const totalOps = iterations * 3;
        const avgTime = duration / totalOps; // ms per op

        console.log(`\n⚡ Benchmark Results for physicsToRender:`);
        console.log(`   Total Ops:  ${totalOps.toLocaleString()}`);
        console.log(`   Total Time: ${duration.toFixed(2)}ms`);
        console.log(`   Avg Time:   ${(avgTime * 1000).toFixed(4)}μs/op`); // Microseconds
        console.log(`   Ops/Sec:    ${(1000 / avgTime).toLocaleString()}`);

        // Sanity check
        expect(out.x).toBeDefined();
        expect(out.x).not.toBeNaN();
        expect(out.y).not.toBeNaN();
        expect(out.z).not.toBeNaN();
    });
});
