/**
 * @file debris.js
 * @description GPU-Accelerated Debris System (Asteroid Belt, Kuiper Belt, Oort Cloud).
 *
 * Uses `THREE.InstancedMesh` to render thousands of objects efficiently.
 * Supports different update modes (Keplerian physics vs Static rotation) and distributions.
 */

import * as THREE from 'three';
import { getOrbitalPosition, physicsToRender } from './physics.js';

/**
 * Creates a debris system (Belt or Cloud).
 * @param {Object} config - Configuration object.
 * @param {string} config.type - 'asteroid', 'kuiper', or 'oort'.
 * @param {number} config.count - Number of particles.
 * @param {Object} config.distribution - Distribution parameters.
 * @param {number} config.distribution.minA - Min Semi-major axis (AU).
 * @param {number} config.distribution.maxA - Max Semi-major axis (AU).
 * @param {number} config.distribution.minE - Min Eccentricity.
 * @param {number} config.distribution.maxE - Max Eccentricity.
 * @param {number} config.distribution.minI - Min Inclination (degrees).
 * @param {number} config.distribution.maxI - Max Inclination (degrees).
 * @param {boolean} config.isSpherical - If true, distributes on sphere (Oort). If false, disk (Belt).
 * @param {Object} config.material - Material properties (color, opacity, size).
 * @param {boolean} config.staticPhysics - If true, rotates globally instead of per-object Keplerian.
 * @returns {THREE.InstancedMesh} The mesh object with .update(time) method.
 */
function createDebrisSystem(config) {
    const {
        count = 1000,
        distribution,
        isSpherical = false,
        material: matConfig,
        staticPhysics = false
    } = config;

    // Shared Geometry
    const size = matConfig.size || 0.2;
    // Use low poly geometry
    const geometry = new THREE.IcosahedronGeometry(size, 0);

    // Material
    const material = new THREE.MeshStandardMaterial({
        color: matConfig.color || 0x888888,
        roughness: matConfig.roughness !== undefined ? matConfig.roughness : 0.8,
        metalness: matConfig.metalness !== undefined ? matConfig.metalness : 0.2,
        flatShading: true,
        transparent: matConfig.opacity < 1.0,
        opacity: matConfig.opacity !== undefined ? matConfig.opacity : 1.0
    });

    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.castShadow = !matConfig.transparent; // Don't cast shadow if transparent/faint
    mesh.receiveShadow = true;

    // Data Storage
    const orbitals = [];
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
        // Randomize Orbit
        const a = distribution.minA + Math.random() * (distribution.maxA - distribution.minA);
        const e = distribution.minE + Math.random() * (distribution.maxE - distribution.minE);

        // Inclination
        let inc;
        if (isSpherical) {
            // Uniform point on sphere logic for inclination?
            // Actually, for Oort cloud, we just want random 0-180.
            inc = distribution.minI + Math.random() * (distribution.maxI - distribution.minI);
        } else {
            inc = distribution.minI + Math.random() * (distribution.maxI - distribution.minI);
        }

        const omega = Math.random() * 360;
        const Omega = Math.random() * 360;
        const M0 = Math.random() * 360;

        const orbital = { a, e, i: inc, omega, Omega, M0 };
        orbitals.push(orbital);

        // Initial Position Setup
        if (staticPhysics) {
             // Calculate once and freeze (relative to container)
             // We use time=0 for initial static placement
             // For Oort cloud, we might want purely random spherical distribution ignoring Keplerian "orbit" logic
             // But using getOrbitalPosition gives us a valid point on a valid orbit, so it works visually too.
             const physPos = getOrbitalPosition(orbital, 0);
             const renderPos = physicsToRender(physPos);

             dummy.position.copy(renderPos);

             // Random tumble
             dummy.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
             const s = 0.5 + Math.random() * 0.5;
             dummy.scale.set(s, s, s);
             dummy.updateMatrix();
             mesh.setMatrixAt(i, dummy.matrix);
        }
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.userData.orbitals = orbitals;

    // Update Method
    mesh.update = (time) => {
        if (staticPhysics) {
            // Global slow rotation for Oort Cloud
            // 0.000001 per frame might be too slow if time isn't delta, but we use timeScale in main.
            // Let's just rotate the mesh object itself.
            // Note: time here is simulationTime (years).
            // We'll use a constant rotation speed.
            mesh.rotation.y += 0.00005;
            return;
        }

        const orbitals = mesh.userData.orbitals;
        for (let i = 0; i < count; i++) {
            const orbital = orbitals[i];

            // 1. Physics
            const physPos = getOrbitalPosition(orbital, time);

            // 2. Render Scale
            const renderPos = physicsToRender(physPos);

            // 3. Update
            mesh.getMatrixAt(i, dummy.matrix);
            dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

            dummy.position.copy(renderPos);

            // Visual Tumble
            dummy.rotation.x += 0.01;
            dummy.rotation.y += 0.02;

            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
    };

    // Frustum Culling disable for large structures
    mesh.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 5000);
    mesh.frustumCulled = false;

    mesh.dispose = () => {
        mesh.geometry.dispose();
        mesh.material.dispose();
    };

    return mesh;
}

/**
 * Creates the standard Asteroid Belt (2.1 - 3.3 AU).
 */
export function createAsteroidBelt() {
    return createDebrisSystem({
        type: 'asteroid',
        count: 2000,
        distribution: {
            minA: 2.1, maxA: 3.3,
            minE: 0.05, maxE: 0.15,
            minI: 0, maxI: 20
        },
        isSpherical: false,
        material: {
            color: 0x888888,
            roughness: 0.8,
            metalness: 0.2,
            size: 0.2,
            opacity: 1.0
        },
        staticPhysics: false
    });
}

/**
 * Creates the Kuiper Belt (30 - 50 AU).
 * Thick disk, icy blue.
 */
export function createKuiperBelt() {
    return createDebrisSystem({
        type: 'kuiper',
        count: 2000,
        distribution: {
            minA: 30, maxA: 50,
            minE: 0.0, maxE: 0.3,
            minI: 0, maxI: 30
        },
        isSpherical: false,
        material: {
            color: 0xbfd6ff,
            roughness: 0.8,
            metalness: 0.0,
            size: 0.25,
            opacity: 0.8 // Slightly transparent
        },
        staticPhysics: false
    });
}

/**
 * Creates the Oort Cloud (2000 - 100,000 AU).
 * Vast spherical shell, static physics with slow rotation.
 */
export function createOortCloud() {
    return createDebrisSystem({
        type: 'oort',
        count: 300, // Sparse representative markers
        distribution: {
            minA: 2000, maxA: 100000,
            minE: 0.7, maxE: 0.999,
            minI: 0, maxI: 180 // Isotropic
        },
        isSpherical: true,
        material: {
            color: 0xf2f5ff,
            roughness: 1.0,
            metalness: 0.0,
            size: 0.15, // Smaller points
            opacity: 0.15 // Very faint
        },
        staticPhysics: true
    });
}
