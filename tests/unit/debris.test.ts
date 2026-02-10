/**
 * @file debris.test.ts
 * @description Unit tests for the debris system.
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createBelt, type BeltSystemConfig } from '../../src/debris';

describe('createBelt', () => {
    const config: BeltSystemConfig = {
        name: 'Test Belt',
        visual: {
            count: 100,
            color: 0xff0000,
            size: 0.5,
            opacity: 0.8
        },
        distribution: {
            minA: 2.0,
            maxA: 3.0,
            minE: 0.0,
            maxE: 0.1,
            minI: 0.0,
            maxI: 10.0
        }
    };

    it('should create an InstancedMesh with correct count', () => {
        const belt = createBelt(config);
        expect(belt).toBeInstanceOf(THREE.InstancedMesh);
        expect(belt.count).toBe(100);
        expect(belt.userData.type).toBe('test_belt');
    });

    it('should create custom attributes', () => {
        const belt = createBelt(config);
        const geo = belt.geometry;

        expect(geo.getAttribute('aOrbit')).toBeTruthy();
        expect(geo.getAttribute('aParams')).toBeTruthy();

        const aOrbit = geo.getAttribute('aOrbit') as THREE.InstancedBufferAttribute;
        expect(aOrbit.count).toBe(100);
        expect(aOrbit.itemSize).toBe(4);
    });

    it('should respect distribution parameters', () => {
        const belt = createBelt(config);
        const aOrbit = belt.geometry.getAttribute('aOrbit') as THREE.InstancedBufferAttribute;

        // Check a few samples
        for (let i = 0; i < 100; i++) {
            const a = aOrbit.getX(i);
            const e = aOrbit.getY(i);
            const inc = aOrbit.getZ(i);

            expect(a).toBeGreaterThanOrEqual(config.distribution.minA);
            expect(a).toBeLessThanOrEqual(config.distribution.maxA);

            expect(e).toBeGreaterThanOrEqual(config.distribution.minE);
            expect(e).toBeLessThanOrEqual(config.distribution.maxE);

            expect(inc).toBeGreaterThanOrEqual(config.distribution.minI);
            expect(inc).toBeLessThanOrEqual(config.distribution.maxI);
        }
    });

    it('should configure material correctly', () => {
        const belt = createBelt(config);
        const mat = belt.material as THREE.MeshStandardMaterial;

        expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
        expect(mat.color.getHex()).toBe(0xff0000);
        expect(mat.roughness).toBe(0.8); // Default
        expect(mat.opacity).toBe(0.8);
        expect(mat.transparent).toBe(true);
    });

    it('should inject shader code', () => {
        const belt = createBelt(config);
        const mat = belt.material as THREE.MeshStandardMaterial;

        // Mock shader object
        const shader = {
            uniforms: {
                uTime: { value: 0 }
            },
            vertexShader: '#include <begin_vertex>\n#include <project_vertex>',
            fragmentShader: ''
        };

        // Trigger onBeforeCompile
        if (mat.onBeforeCompile) {
            mat.onBeforeCompile(shader as any, undefined as any);
        }

        expect(shader.uniforms.uTime).toBeDefined();
        // Check if our custom code was injected
        expect(shader.vertexShader).toContain('#define AU_SCALE');
        expect(shader.vertexShader).toContain('solveKepler');
        expect(mat.userData.shader).toBe(shader);
    });

    it('should update time uniform', () => {
        const belt = createBelt(config);
        const mat = belt.material as THREE.MeshStandardMaterial;

        // Mock shader
        const shader = {
            uniforms: {
                uTime: { value: 0 }
            }
        };
        mat.userData.shader = shader;

        belt.update(123.45);
        expect(shader.uniforms.uTime.value).toBe(123.45);
    });

    it('should dispose resources', () => {
        const belt = createBelt(config);
        const disposeSpy = vi.spyOn(belt.geometry, 'dispose');
        const matDisposeSpy = vi.spyOn(belt.material as THREE.Material, 'dispose');

        belt.dispose();

        expect(disposeSpy).toHaveBeenCalled();
        expect(matDisposeSpy).toHaveBeenCalled();
    });
});
