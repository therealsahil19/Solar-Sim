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
 * Manages InstancedMeshes to reduce draw calls.
 * Groups objects by geometry and material UUIDs.
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
     * Registers an object to be rendered via instancing.
     * @param pivot - The scene graph object that determines position/rotation.
     * @param geometry - The geometry to use.
     * @param material - The material to use.
     * @param userData - Metadata for the object (name, type, etc).
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
     * Builds/Rebuilds the InstancedMeshes.
     * Call this after adding all instances.
     */
    build(): void {
        if (!this.dirty) return;

        this.groups.forEach((group, key) => {
            if (group.mesh) {
                this.scene.remove(group.mesh);
                // Bug 046 Fix: InstancedMesh has no dispose() - manually clean up resources
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

            for (let i = 0; i < group.instances.length; i++) {
                const instanceData = group.instances[i];
                if (!instanceData) continue;

                const { pivot, index } = instanceData;
                group.mesh.setMatrixAt(index, pivot.matrixWorld);
                needsUpdate = true;
            }

            if (needsUpdate) {
                group.mesh.instanceMatrix.needsUpdate = true;
            }
        });
    }

    /**
     * Gets the intersection data for an instance.
     * Helper for Raycaster.
     * @param instanceMesh - The instanced mesh that was hit.
     * @param instanceId - The index of the instance that was hit.
     * @returns The userData associated with the instance pivot.
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
