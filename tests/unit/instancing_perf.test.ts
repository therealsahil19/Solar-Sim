import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { InstanceRegistry } from '../../src/instancing';
import type { SolarSimUserData } from '../../src/types/index';

describe('Performance Benchmark: InstanceRegistry.update', () => {
    let scene: THREE.Scene;
    let registry: InstanceRegistry;

    beforeEach(() => {
        scene = new THREE.Scene();
        registry = new InstanceRegistry(scene);
    });

    it('should update instances efficiently', () => {
        const instanceCount = 1000;
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

        // Verify setup
        // We know only one group is created because geom/mat are same
        expect(registry.groups.size).toBe(1);
        const group = registry.groups.values().next().value;
        expect(group.mesh).toBeDefined();
        expect(group.instances.length).toBe(instanceCount);

        // Benchmark update()
        const iterations = 10;
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
            registry.update();
        }

        const end = performance.now();
        const duration = end - start;
        const avgTime = duration / iterations;

        // Cleanup
        registry.dispose();
        geometry.dispose();
        material.dispose();

        // Simple assertion that it runs without error
        expect(avgTime).toBeLessThan(100);
    });
});
