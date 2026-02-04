/**
 * @file instancing.ts
 * @description Manages InstancedMeshes to optimize rendering performance.
 *
 * BOLT OPTIMIZATION:
 * This module groups similar objects (same geometry & material) into single
 * `THREE.InstancedMesh` calls, drastically reducing the number of draw calls.
 */

import * as THREE from 'three';
import type { Disposable, SolarSimUserData } from './types';

/**
 * Individual instance data.
 */
interface InstanceData {
    /** The pivot Object3D that determines position/rotation */
    pivot: THREE.Object3D;
    /** Index in the instanced mesh */
    index: number;
}

/**
 * Group of instances sharing the same geometry and material.
 */
interface InstanceGroup {
    /** Shared geometry */
    geometry: THREE.BufferGeometry;
    /** Shared material */
    material: THREE.Material;
    /** List of instances */
    instances: InstanceData[];
    /** The instanced mesh (null until build() is called) */
    mesh: THREE.InstancedMesh | null;
}

/**
 * Memory management and draw-call optimization system.
 * Groups similar celestial objects (moons, rocks) into a single THREE.InstancedMesh.
 * This is a core "Bolt" optimization, reducing N draw calls to 1 per group.
 *
 * @implements {Disposable}
 */
export class InstanceRegistry implements Disposable {
    private scene: THREE.Scene;
    public groups: Map<string, InstanceGroup>;
    private dirty: boolean;

    /**
     * Creates a new instance registry.
     * @param scene - The Three.js scene to add meshes to.
     */
    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.groups = new Map();
        this.dirty = false;
    }

    /**
     * Registers a new instance to a geometry/material group.
     * If the group doesn't exist, it will be created on the next build().
     *
     * @param pivot - The logical parent object (used for world matrix).
     * @param geometry - The geometry to instance.
     * @param material - The material to instance.
     * @param userData - Metadata for raycasting and UI identification.
     */
    addInstance(
        pivot: THREE.Object3D,
        geometry: THREE.BufferGeometry,
        material: THREE.Material,
        userData: SolarSimUserData
    ): void {
        const key = `${geometry.uuid}_${material.uuid}`;

        if (!this.groups.has(key)) {
            this.groups.set(key, {
                geometry,
                material,
                instances: [],
                mesh: null
            });
        }

        const group = this.groups.get(key);
        if (!group) return;

        const index = group.instances.length;

        // Merge metadata into the pivot's existing userData
        Object.assign(pivot.userData, userData, {
            isInstance: true,
            instanceId: index,
            instanceKey: key
        });

        group.instances.push({ pivot, index });
        this.dirty = true;
    }

    /**
     * Reifies the registered instances into actual THREE.InstancedMesh objects.
     * This method is "Lazy" - it only executes if the registry is 'dirty'.
     * Previous InstancedMesh objects are disposed of to prevent memory leaks.
     */
    build(): void {
        if (!this.dirty) return;

        this.groups.forEach((group, key) => {
            if (group.mesh) {
                this.scene.remove(group.mesh);
                group.mesh.geometry?.dispose();
                const material = group.mesh.material;
                if (Array.isArray(material)) {
                    material.forEach(m => m.dispose());
                } else if (material) {
                    material.dispose();
                }
            }

            const count = group.instances.length;
            if (count === 0) return;

            const instancedMesh = new THREE.InstancedMesh(group.geometry, group.material, count);
            instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            instancedMesh.castShadow = true;
            instancedMesh.receiveShadow = true;
            instancedMesh.frustumCulled = false;
            instancedMesh.userData.registryKey = key;

            this.scene.add(instancedMesh);
            group.mesh = instancedMesh;
        });

        this.dirty = false;
    }

    /**
     * Updates all instance matrices based on their pivots.
     * This is the O(N) operation, but N is number of objects, not pixels.
     */
    update(): void {
        this.groups.forEach(group => {
            if (!group.mesh) return;

            let needsUpdate = false;
            const instanceMatrix = group.mesh.instanceMatrix;
            const array = instanceMatrix.array;

            for (let i = 0; i < group.instances.length; i++) {
                const instanceData = group.instances[i];
                if (!instanceData) continue;

                const { pivot, index } = instanceData;

                // Bolt Optimization: Direct buffer access avoids setMatrixAt overhead (function calls + checks)
                const te = pivot.matrixWorld.elements;
                const offset = index * 16;

                array[offset] = te[0]!;
                array[offset + 1] = te[1]!;
                array[offset + 2] = te[2]!;
                array[offset + 3] = te[3]!;

                array[offset + 4] = te[4]!;
                array[offset + 5] = te[5]!;
                array[offset + 6] = te[6]!;
                array[offset + 7] = te[7]!;

                array[offset + 8] = te[8]!;
                array[offset + 9] = te[9]!;
                array[offset + 10] = te[10]!;
                array[offset + 11] = te[11]!;

                array[offset + 12] = te[12]!;
                array[offset + 13] = te[13]!;
                array[offset + 14] = te[14]!;
                array[offset + 15] = te[15]!;

                needsUpdate = true;
            }

            if (needsUpdate) {
                instanceMatrix.needsUpdate = true;
            }
        });
    }

    /**
     * Retrieves metadata for a specific instance in an InstancedMesh.
     * Used by the Raycaster to identify which planet/moon was clicked.
     *
     * @param instanceMesh - The THREE.InstancedMesh that was intersected.
     * @param instanceId - The index of the instance.
     * @returns The associated metadata or null if not found.
     */
    getIntersectionData(
        instanceMesh: THREE.InstancedMesh,
        instanceId: number
    ): SolarSimUserData | null {
        const registryKey = instanceMesh.userData.registryKey as string | undefined;
        if (!registryKey) return null;

        const group = this.groups.get(registryKey);
        if (!group) return null;

        const instance = group.instances[instanceId];
        return instance?.pivot.userData ?? null;
    }

    /**
     * Finds an instance (pivot) by name.
     * @param name - The name to search for.
     * @returns The pivot object if found.
     */
    findInstanceByName(name: string): THREE.Object3D | null {
        for (const group of this.groups.values()) {
            for (const instance of group.instances) {
                if (instance.pivot.userData.name === name) {
                    return instance.pivot;
                }
            }
        }
        return null;
    }

    /**
     * Disposes the registry and cleans up resources.
     */
    dispose(): void {
        this.groups.forEach((group) => {
            if (group.mesh) {
                this.scene.remove(group.mesh);
                group.mesh.geometry?.dispose();
                const material = group.mesh.material;
                if (Array.isArray(material)) {
                    material.forEach(m => m.dispose());
                } else if (material) {
                    material.dispose();
                }
            }
            // Cleanup pivot userData pollution
            group.instances.forEach(({ pivot }) => {
                delete pivot.userData.isInstance;
                delete pivot.userData.instanceId;
                delete pivot.userData.instanceKey;
            });
        });
        this.groups.clear();
    }
}
