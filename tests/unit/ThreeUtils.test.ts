/**
 * @file ThreeUtils.test.ts
 * @description Unit tests for Three.js utility functions.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { getPositionFromMatrix } from '../../src/utils/ThreeUtils';

describe('ThreeUtils', () => {
    describe('getPositionFromMatrix', () => {
        it('should correctly extract world position from matrix', () => {
            const object = new THREE.Object3D();
            object.position.set(10, 20, 30);
            object.updateMatrixWorld();

            const target = new THREE.Vector3();
            getPositionFromMatrix(object, target);

            expect(target.x).toBe(10);
            expect(target.y).toBe(20);
            expect(target.z).toBe(30);
        });

        it('should handle nested transformations', () => {
            const parent = new THREE.Object3D();
            parent.position.set(100, 0, 0);

            const child = new THREE.Object3D();
            child.position.set(5, 0, 0);
            parent.add(child);

            parent.updateMatrixWorld();

            const target = new THREE.Vector3();
            getPositionFromMatrix(child, target);

            expect(target.x).toBe(105);
            expect(target.y).toBe(0);
            expect(target.z).toBe(0);
        });
    });
});
