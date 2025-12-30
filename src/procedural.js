/**
 * @file procedural.js
 * @description Factory module for generating 3D objects in the simulation.
 *
 * This module follows a functional "Factory" pattern. It exports pure functions
 * that accept configuration/dependencies and return Three.js objects (Meshes, Groups, Points).
 * It does not maintain global state or modify the scene directly.
 */

import * as THREE from 'three';

// --- Shared Resources ---
// Reusing geometry reduces memory overhead significantly
const baseOrbitGeometry = new THREE.BufferGeometry();
{
    const points = [];
    const segments = 128;
    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta)));
    }
    baseOrbitGeometry.setFromPoints(points);
}
const baseOrbitMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.15, transparent: true });

const baseSphereGeometry = new THREE.SphereGeometry(1, 64, 64);

/**
 * Creates a procedural starfield background using points.
 * @returns {THREE.Points} The starfield particle system.
 */
export function createStarfield() {
    const geometry = new THREE.BufferGeometry();
    const count = 3000;
    const positions = new Float32Array(count * 3);
    for(let i=0; i<count*3; i++) {
        positions[i] = (Math.random() - 0.5) * 400;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0xffffff, size: 0.2, transparent: true, opacity: 0.8 });
    return new THREE.Points(geometry, material);
}

/**
 * Creates an orbit line visualization.
 * Scaled from the shared unit circle geometry.
 * @param {number} radius - The radius of the orbit.
 * @returns {THREE.LineLoop} The orbit line object.
 */
export function createOrbitLine(radius) {
    const line = new THREE.LineLoop(baseOrbitGeometry, baseOrbitMaterial);
    line.scale.set(radius, 1, radius);
    return line;
}

/**
 * Creates the central Sun mesh.
 * @param {THREE.TextureLoader} textureLoader - The loader instance for fetching textures.
 * @param {boolean} useTextures - Whether to apply the texture initially.
 * @returns {THREE.Mesh} The Sun mesh, with userData containing both material references.
 */
export function createSun(textureLoader, useTextures) {
    const geometry = new THREE.SphereGeometry(2.5, 64, 64);

    // We assume 'textures/sun.jpg' exists or will be loaded
    const texture = textureLoader.load('textures/sun.jpg');

    const texturedMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        color: 0xffffff
    });

    const solidMaterial = new THREE.MeshBasicMaterial({ color: 0xffffaa });

    const sun = new THREE.Mesh(geometry, useTextures ? texturedMaterial : solidMaterial);

    sun.userData.name = "Sun";
    sun.userData.type = "star";
    sun.userData.solidMaterial = solidMaterial;
    sun.userData.texturedMaterial = texturedMaterial;

    return sun;
}

/**
 * Creates the player ship group consisting of a body and engines.
 * @returns {THREE.Group} The player ship group.
 */
export function createPlayerShip() {
    const shipGroup = new THREE.Group();

    // Main Body (Cone)
    const bodyGeo = new THREE.ConeGeometry(0.5, 2, 8);
    const bodyMat = new THREE.MeshNormalMaterial();
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.rotation.x = Math.PI / 2;
    shipGroup.add(body);

    // Engines (Cylinders)
    const engineGeo = new THREE.CylinderGeometry(0.2, 0.1, 1.5, 8);
    const engineMat = new THREE.MeshNormalMaterial();

    const leftEngine = new THREE.Mesh(engineGeo, engineMat);
    leftEngine.position.set(-0.6, 0, -0.5);
    leftEngine.rotation.x = Math.PI / 2;
    shipGroup.add(leftEngine);

    const rightEngine = new THREE.Mesh(engineGeo, engineMat);
    rightEngine.position.set(0.6, 0, -0.5);
    rightEngine.rotation.x = Math.PI / 2;
    shipGroup.add(rightEngine);

    shipGroup.position.set(20, 5, 20);
    return shipGroup;
}

/**
 * Recursively creates a celestial body system (planet + moons).
 * @param {Object} data - Configuration object for the planet/moon.
 * @param {string} data.name - Name of the body.
 * @param {string|number} data.color - Color of the body (hex or CSS string).
 * @param {string} [data.texture] - Path to texture image.
 * @param {number} data.size - Radius of the body.
 * @param {number} data.distance - Orbital distance from parent.
 * @param {number} data.speed - Orbital speed around parent.
 * @param {number} data.rotationSpeed - Self-rotation speed.
 * @param {Array<Object>} [data.moons] - Array of sub-satellites (recursive structure).
 * @param {THREE.TextureLoader} textureLoader - Loader for textures.
 * @param {boolean} useTextures - Initial texture state.
 * @returns {Object} An object containing the generated components:
 *  - `pivot` {THREE.Object3D}: The center point for orbit rotation.
 *  - `orbit` {THREE.LineLoop|null}: The visual orbit line.
 *  - `interactables` {Array<THREE.Mesh>}: Flat list of interactive meshes (this body + all descendants).
 *  - `animated` {Array<Object>}: Flat list of objects needing animation updates (this body + all descendants).
 */
export function createSystem(data, textureLoader, useTextures) {
    // 1. Pivot
    const orbitPivot = new THREE.Object3D();

    // 2. Orbit Line
    let orbitLine = null;
    if (data.distance > 0) {
        orbitLine = createOrbitLine(data.distance);
    }

    // 3. Body Group
    const bodyGroup = new THREE.Group();
    bodyGroup.position.x = data.distance;
    orbitPivot.add(bodyGroup);

    // 4. Mesh
    const geometry = baseSphereGeometry;
    const solidMaterial = new THREE.MeshStandardMaterial({ color: data.color });

    let texturedMaterial;
    if (data.texture) {
        const texture = textureLoader.load(data.texture);
        texturedMaterial = new THREE.MeshStandardMaterial({
            map: texture,
            color: 0xffffff
        });
    } else {
        texturedMaterial = solidMaterial;
    }

    const mesh = new THREE.Mesh(geometry, useTextures ? texturedMaterial : solidMaterial);
    mesh.scale.set(data.size, data.size, data.size);
    mesh.userData.name = data.name;
    mesh.userData.solidMaterial = solidMaterial;
    mesh.userData.texturedMaterial = texturedMaterial;

    bodyGroup.add(mesh);

    // Collection arrays
    const interactables = [mesh];
    const animated = [{
        pivot: orbitPivot,
        mesh: mesh,
        speed: data.speed || 0,
        rotationSpeed: data.rotationSpeed || 0
    }];

    // 5. Recursion (Moons)
    if (data.moons && data.moons.length > 0) {
        data.moons.forEach(moonData => {
            const result = createSystem(moonData, textureLoader, useTextures);
            // Attach moon system to this body's group
            bodyGroup.add(result.pivot);
            if (result.orbit) {
                bodyGroup.add(result.orbit);
            }
            // Merge lists
            interactables.push(...result.interactables);
            animated.push(...result.animated);
        });
    }

    return {
        pivot: orbitPivot,
        orbit: orbitLine,
        interactables,
        animated
    };
}
