/**
 * @file debris.js
 * @description GPU-Accelerated Asteroid Belt Generator.
 *
 * BOLT OPTIMIZATION:
 * Uses `THREE.InstancedMesh` to render thousands of asteroids in 1 Draw Call.
 * Uses CPU-side Keplerian logic to ensure physical accuracy matching the planets.
 */

import * as THREE from 'three';
import { getOrbitalPosition, physicsToRender } from './physics.js';

/**
 * Creates an asteroid belt using InstancedMesh with Keplerian physics.
 * @param {Object} config - Configuration.
 * @param {number} config.count - Number of asteroids.
 * @param {number} config.minRadius - Inner radius (AU). (Defaults to 2.1)
 * @param {number} config.maxRadius - Outer radius (AU). (Defaults to 3.3)
 * @returns {THREE.InstancedMesh} The belt mesh with an .update(time) method.
 */
export function createAsteroidBelt(config = {}) {
    const count = config.count || 500;
    const minRadius = config.minRadius || 2.1;
    const maxRadius = config.maxRadius || 3.3;

    // Shared Geometry & Material
    // Low poly sphere for asteroids
    const geometry = new THREE.IcosahedronGeometry(0.2, 0);

    // Visual Material
    const material = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.8,
        metalness: 0.2,
        flatShading: true
    });

    // Mesh Creation
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Attributes Generation
    // We store orbital elements in userData to compute positions each frame
    const orbitals = [];

    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
        // Randomize Orbit (AU)
        const a = minRadius + Math.random() * (maxRadius - minRadius);
        // Eccentricity [0.05, 0.15]
        const e = 0.05 + Math.random() * 0.10;
        // Inclination [0, 20] degrees
        const inc = Math.random() * 20;

        // Random Angles
        const omega = Math.random() * 360;
        const Omega = Math.random() * 360;
        const M0 = Math.random() * 360;

        orbitals.push({
            a, e, i: inc, omega, Omega, M0
        });

        // Set initial scale/rotation (random tumble)
        dummy.position.set(0, 0, 0); // Position will be set by update()
        dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        const s = 0.5 + Math.random() * 0.5; // Visual scale factor
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;

    // Store orbitals
    mesh.userData.orbitals = orbitals;

    /**
     * Updates the asteroid positions based on simulation time.
     * @param {number} time - Simulation time in Earth Years.
     */
    mesh.update = (time) => {
        const orbitals = mesh.userData.orbitals;
        const dummy = new THREE.Object3D();

        for (let i = 0; i < count; i++) {
            const orbital = orbitals[i];

            // 1. Calculate Physics Position
            const physPos = getOrbitalPosition(orbital, time);

            // 2. Transform to Render Space
            const renderPos = physicsToRender(physPos);

            // 3. Update Matrix
            mesh.getMatrixAt(i, dummy.matrix); // Get current to preserve scale/rotation
            dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

            dummy.position.copy(renderPos);

            // Rotate the asteroid itself (tumble)
            // Simple rotation based on time, uncorrelated to orbit
            dummy.rotation.x += 0.01;
            dummy.rotation.y += 0.02;

            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
    };

    // Dispose method
    mesh.dispose = () => {
        mesh.geometry.dispose();
        mesh.material.dispose();
    };

    // Prevent frustum culling (bounds are huge)
    mesh.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 500); // Estimating log scale max
    mesh.frustumCulled = false;

    return mesh;
}
