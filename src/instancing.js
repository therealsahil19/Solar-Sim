/**
 * @file instancing.js
 * @description Manages InstancedMeshes to optimize rendering performance.
 *
 * BOLT OPTIMIZATION:
 * This module groups similar objects (same geometry & material) into single
 * `THREE.InstancedMesh` calls, drastically reducing the number of draw calls.
 */

import * as THREE from 'three';

/**
 * Manages InstancedMeshes to reduce draw calls.
 * Groups objects by geometry and material UUIDs.
 */
export class InstanceRegistry {
    /**
     * @param {THREE.Scene} scene - The Three.js scene to add meshes to.
     */
    constructor(scene) {
        this.scene = scene;
        // Map of key -> { mesh: InstancedMesh, instances: [{ pivot: Object3D, index: number }] }
        // Key is generated from geometry UUID + material UUID
        this.groups = new Map();
        this.dirty = false;
    }

    /**
     * Registers an object to be rendered via instancing.
     * @param {THREE.Object3D} pivot - The scene graph object that determines position/rotation.
     * @param {THREE.Geometry} geometry - The geometry to use.
     * @param {THREE.Material} material - The material to use.
     * @param {Object} userData - Metadata for the object (name, type, etc).
     */
    addInstance(pivot, geometry, material, userData) {
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
        const index = group.instances.length;

        // We attach the instance info to the pivot so we can look it up if needed (e.g. for selection)
        // But primarily, the pivot is just a transform container.

        // Merge metadata into the pivot's existing userData.
        // We use Object.assign to preserve any existing properties on the pivot object
        // while injecting the instance-specific data (isInstance, instanceId).
        // This allows the app to treat the pivot as the "source of truth" for this object.
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
    build() {
        if (!this.dirty) return;

        this.groups.forEach((group, key) => {
            if (group.mesh) {
                this.scene.remove(group.mesh);
                // Bug 046 Fix: InstancedMesh has no dispose() - manually clean up resources
                if (group.mesh.geometry) group.mesh.geometry.dispose();
                if (group.mesh.material) {
                    if (Array.isArray(group.mesh.material)) {
                        group.mesh.material.forEach(m => m.dispose());
                    } else {
                        group.mesh.material.dispose();
                    }
                }
            }

            const count = group.instances.length;
            if (count === 0) return;

            const instancedMesh = new THREE.InstancedMesh(group.geometry, group.material, count);
            instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); // We update every frame
            instancedMesh.castShadow = true;
            instancedMesh.receiveShadow = true;

            // Fix vanishing planets when zooming in:
            // Since instances move far from the initial bounding sphere (calculated at origin),
            // frustum culling thinks they are off-screen. We disable culling as the cost is negligible
            // for the low number of instances we have.
            instancedMesh.frustumCulled = false;

            // Store reference to this registry group on the mesh for reverse lookup if needed
            instancedMesh.userData.registryKey = key;

            this.scene.add(instancedMesh);
            group.mesh = instancedMesh;
        });

        this.dirty = false;
    }

    /**
     * Updates all instance matrices based on their pivots.
     * This is the O(N) operation, but N is number of objects, not pixels.
     * JS can handle 2000-10000 matrix copies easily.
     */
    update() {
        // Bug 040 Fix: Removed unused `new THREE.Object3D()` allocation
        // The dummy was never used - matrices are read directly from pivots

        this.groups.forEach(group => {
            if (!group.mesh) return;

            let needsUpdate = false;

            // We can optimize this by only updating if pivots changed,
            // but since planets orbit continuously, we assume always update.
            for (let i = 0; i < group.instances.length; i++) {
                const { pivot, index } = group.instances[i];

                // Read world matrix from pivot
                // Pivot must be part of scene graph and updated
                // Since pivots are in the scene graph (even if invisible/empty),
                // Three.js updateMatrixWorld() in renderer.render() calculates them.
                // However, if we call this BEFORE render, we might need to ensure matrices are fresh.
                // Usually we do this in the render loop.

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
     * @param {THREE.InstancedMesh} instanceMesh - The instanced mesh that was hit.
     * @param {number} instanceId - The index of the instance that was hit.
     * @returns {Object|null} The userData associated with the instance pivot.
     */
    getIntersectionData(instanceMesh, instanceId) {
        const group = this.groups.get(instanceMesh.userData.registryKey);
        if (!group) return null;

        return group.instances[instanceId].pivot.userData;
    }

    /**
     * Finds an instance (pivot) by name.
     * @param {string} name - The name to search for.
     * @returns {THREE.Object3D|null} The pivot object if found.
     */
    findInstanceByName(name) {
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
     * Disposes the registry and cleans up pivots.
     */
    dispose() {
        this.groups.forEach((group) => {
            if (group.mesh) {
                this.scene.remove(group.mesh);
                // InstancedMesh does not have a dispose() method itself,
                // we must dispose its resources manually.
                if (group.mesh.geometry) group.mesh.geometry.dispose();
                if (group.mesh.material) {
                    if (Array.isArray(group.mesh.material)) {
                        group.mesh.material.forEach(m => m.dispose());
                    } else {
                        group.mesh.material.dispose();
                    }
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
