import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { InstanceRegistry } from '../../src/instancing';
import type { SolarSimUserData } from '../../src/types/index';

describe('Performance Benchmark: Static vs Dynamic Instancing', () => {
    let scene: THREE.Scene;
    let registry: InstanceRegistry;

    beforeEach(() => {
        scene = new THREE.Scene();
        registry = new InstanceRegistry(scene);
    });

    it('measures update cost for dynamic instances', () => {
        const instanceCount = 50000;
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });

        // Add instances
        for (let i = 0; i < instanceCount; i++) {
            const pivot = new THREE.Object3D();
            pivot.position.set(Math.random() * 100, Math.random() * 100, Math.random() * 100);
            pivot.updateMatrixWorld(true);

            const userData: SolarSimUserData = { name: `Instance_${i}` };
            registry.addInstance(pivot, geometry, material, userData);
        }

        registry.build();

        // Warmup
        registry.update();

        // Benchmark update()
        const iterations = 50;
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
            registry.update();
        }

        const end = performance.now();
        const duration = end - start;
        const avgTime = duration / iterations;

        console.log(`[Baseline] Average update time for ${instanceCount} dynamic instances: ${avgTime.toFixed(3)} ms`);

        // Cleanup
        registry.dispose();
        geometry.dispose();
        material.dispose();
    });

    it('measures update cost for static instances', () => {
        const instanceCount = 50000;
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });

        // Add instances as STATIC (dynamic = false)
        for (let i = 0; i < instanceCount; i++) {
            const pivot = new THREE.Object3D();
            pivot.position.set(Math.random() * 100, Math.random() * 100, Math.random() * 100);
            pivot.updateMatrixWorld(true);

            const userData: SolarSimUserData = { name: `StaticInstance_${i}` };
            // Pass false for dynamic
            registry.addInstance(pivot, geometry, material, userData, false);
        }

        registry.build();

        // Warmup (First update MUST happen to upload buffers)
        registry.update();

        // Benchmark update()
        const iterations = 50;
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
            registry.update();
        }

        const end = performance.now();
        const duration = end - start;
        const avgTime = duration / iterations;

        console.log(`[Optimization] Average update time for ${instanceCount} static instances: ${avgTime.toFixed(3)} ms`);

        // Cleanup
        registry.dispose();
        geometry.dispose();
        material.dispose();

        // Assert improvement
        // We expect < 2.0ms for static vs ~10ms for dynamic (loop overhead)
        expect(avgTime).toBeLessThan(2.0);
    });
});
