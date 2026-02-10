import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { InstanceRegistry } from '../src/instancing';
import { SolarSimUserData } from '../src/types';

describe('InstanceRegistry', () => {
    let scene: THREE.Scene;
    let registry: InstanceRegistry;

    beforeEach(() => {
        scene = new THREE.Scene();
        registry = new InstanceRegistry(scene);
    });

    it('should add instances and create mesh on build', () => {
        const geometry = new THREE.BoxGeometry();
        const material = new THREE.MeshBasicMaterial();
        const pivot = new THREE.Object3D();
        const userData = { name: 'Test' } as SolarSimUserData;

        registry.addInstance(pivot, geometry, material, userData);

        // Should not be built yet
        expect(scene.children.length).toBe(0);

        registry.build();

        // Should have one InstancedMesh
        expect(scene.children.length).toBe(1);
        expect(scene.children[0]).toBeInstanceOf(THREE.InstancedMesh);

        const mesh = scene.children[0] as THREE.InstancedMesh;
        expect(mesh.count).toBe(1);
    });

    it('should find instance by name', () => {
        const geometry = new THREE.BoxGeometry();
        const material = new THREE.MeshBasicMaterial();
        const pivot = new THREE.Object3D();
        pivot.userData.name = 'Target';
        const userData = { name: 'Target' } as SolarSimUserData;

        registry.addInstance(pivot, geometry, material, userData);

        const found = registry.findInstanceByName('Target');
        expect(found).toBe(pivot);
    });

    it('should update instance matrices', () => {
        const geometry = new THREE.BoxGeometry();
        const material = new THREE.MeshBasicMaterial();
        const pivot = new THREE.Object3D();
        pivot.position.set(10, 20, 30);
        pivot.updateMatrixWorld();

        const userData = { name: 'Test' } as SolarSimUserData;

        registry.addInstance(pivot, geometry, material, userData, true); // Dynamic
        registry.build();

        const mesh = scene.children[0] as THREE.InstancedMesh;

        // Spy on needsUpdate setter? No, check array content.

        registry.update();

        const matrix = new THREE.Matrix4();
        mesh.getMatrixAt(0, matrix);

        const position = new THREE.Vector3();
        position.setFromMatrixPosition(matrix);

        expect(position.x).toBeCloseTo(10);
        expect(position.y).toBeCloseTo(20);
        expect(position.z).toBeCloseTo(30);
    });
});
