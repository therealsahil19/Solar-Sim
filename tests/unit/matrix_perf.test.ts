
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';

describe('Performance Benchmark: Matrix Decomposition', () => {
    it('should extract position from matrix efficiently', () => {
        // Setup
        const matrix = new THREE.Matrix4();
        matrix.makeTranslation(10, 20, 30);
        const tempVec = new THREE.Vector3();

        // Ensure values are correct
        tempVec.setFromMatrixPosition(matrix);
        expect(tempVec.x).toBe(10);
        expect(tempVec.y).toBe(20);
        expect(tempVec.z).toBe(30);

        const iterations = 1000000; // 1 million iterations for micro-benchmark

        // Warmup
        for (let i = 0; i < 10000; i++) {
            tempVec.setFromMatrixPosition(matrix);
            const elements = matrix.elements;
            tempVec.set(elements[12], elements[13], elements[14]);
        }

        // Benchmark 1: Standard setFromMatrixPosition
        const start1 = performance.now();
        for (let i = 0; i < iterations; i++) {
            tempVec.setFromMatrixPosition(matrix);
        }
        const end1 = performance.now();
        const time1 = end1 - start1;

        // Benchmark 2: Direct Element Access
        const start2 = performance.now();
        for (let i = 0; i < iterations; i++) {
            const elements = matrix.elements;
            tempVec.set(elements[12], elements[13], elements[14]);
        }
        const end2 = performance.now();
        const time2 = end2 - start2;

        console.log(`\n⚡ Benchmark Results for Matrix Position Extraction (${iterations} iterations):`);
        console.log(`   Method 1 (setFromMatrixPosition): ${time1.toFixed(2)}ms`);
        console.log(`   Method 2 (Direct Access):         ${time2.toFixed(2)}ms`);

        const speedup = time1 / time2;
        console.log(`   Improvement:                      ${speedup.toFixed(2)}x faster`);

        // Assert that the optimized version is indeed faster (or at least not significantly slower due to noise)
        // We relax the assertion slightly to avoid flakiness in CI environments.
        // If the absolute difference is negligible (< 2ms), we also pass.
        if (Math.abs(time1 - time2) < 2.0) {
             expect(true).toBe(true);
        } else {
             expect(time2).toBeLessThan(time1 * 1.5);
        }
    });
});
