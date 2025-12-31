/**
 * @file procedural.js
 * @description Factory module for generating 3D objects in the simulation.
 *
 * This module follows a functional "Factory" pattern. It exports pure functions
 * that accept configuration/dependencies and return Three.js objects (Meshes, Groups, Points).
 * It does not maintain global state or modify the scene directly.
 */

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

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

// Material Cache to reduce shader programs and draw calls
const materialCache = {};

/**
 * Clears the material cache to prevent memory leaks during scene resets.
 */
export function clearMaterialCache() {
    Object.values(materialCache).forEach(mat => mat.dispose());
    for (const key in materialCache) delete materialCache[key];
}

/**
 * Retrieves or creates a cached solid material for a given color.
 * @param {string|number|THREE.Color} color - The color of the material.
 * @returns {THREE.MeshStandardMaterial} The cached material.
 */
function getSolidMaterial(color) {
    // Ensure the key is a primitive string to avoid "[object Object]" collisions
    let key;
    if (color && typeof color === 'object' && color.isColor) {
        key = '#' + color.getHexString();
    } else {
        key = String(color);
    }

    if (!materialCache[key]) {
        materialCache[key] = new THREE.MeshStandardMaterial({ color: color });
    }
    return materialCache[key];
}

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
 * Helper to create a radial gradient texture for the Sun's glow.
 * Uses an offscreen canvas to generate a procedural gradient.
 * @returns {THREE.CanvasTexture} The generated texture.
 */
function createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');

    const gradient = context.createRadialGradient(
        64, 64, 0,
        64, 64, 64
    );
    // Bright white/yellow center to transparent edge
    gradient.addColorStop(0, 'rgba(255, 255, 240, 1)');
    gradient.addColorStop(0.2, 'rgba(255, 255, 200, 0.8)');
    gradient.addColorStop(0.5, 'rgba(255, 220, 100, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
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
    sun.castShadow = false;
    sun.receiveShadow = false;

    sun.userData.name = "Sun";
    sun.userData.type = "Star";
    sun.userData.size = 2.5;
    sun.userData.description = "The star at the center of the Solar System.";
    sun.userData.distance = 0;
    sun.userData.solidMaterial = solidMaterial;
    sun.userData.texturedMaterial = texturedMaterial;

    // --- Add Glow Sprite ---
    const glowTexture = createGlowTexture();
    const glowMaterial = new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0xffaa00,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const glowSprite = new THREE.Sprite(glowMaterial);
    // Scale up slightly larger than the sun (size 2.5 * 2 = 5 diameter)
    glowSprite.scale.set(12, 12, 1);
    sun.add(glowSprite);

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
 * This function implements the recursive logic to support an infinite hierarchy of satellites.
 *
 * @param {Object} data - Configuration object for the planet/moon.
 * @param {string} data.name - Name of the body.
 * @param {string} data.type - Type of body (e.g., 'Planet', 'Moon').
 * @param {string|number} data.color - Color of the body (hex or CSS string).
 * @param {string} [data.texture] - Path to texture image.
 * @param {number} data.size - Radius of the body.
 * @param {number} data.distance - Orbital distance from parent.
 * @param {number} data.speed - Orbital speed around parent.
 * @param {number} data.rotationSpeed - Self-rotation speed.
 * @param {boolean} [data.hasRing] - Whether the body has rings.
 * @param {string} [data.description] - Description of the body.
 * @param {Array<Object>} [data.moons] - Array of sub-satellites (recursive structure).
 * @param {THREE.TextureLoader} textureLoader - Loader for textures.
 * @param {boolean} useTextures - Initial texture state.
 * @returns {Object} An object containing the generated components:
 *  - `pivot` {THREE.Object3D}: The center point for orbit rotation.
 *  - `orbit` {THREE.LineLoop|null}: The visual orbit line.
 *  - `trail` {THREE.Line|null}: The dynamic trail mesh (planets only).
 *  - `label` {CSS2DObject}: The label object.
 *  - `interactables` {Array<THREE.Mesh>}: Flat list of interactive meshes.
 *  - `animated` {Array<Object>}: Flat list of objects needing animation.
 *  - `orbits` {Array<THREE.Object3D>}: Flat list of orbit lines.
 *  - `trails` {Array<THREE.Line>}: Flat list of trail lines.
 *  - `labels` {Array<CSS2DObject>}: Flat list of label objects.
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

    // Bolt Optimization: Use cached material
    const solidMaterial = getSolidMaterial(data.color);

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
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.scale.set(data.size, data.size, data.size);
    mesh.userData.name = data.name;
    mesh.userData.type = data.type;
    mesh.userData.size = data.size;
    mesh.userData.description = data.description || "";
    mesh.userData.distance = data.distance;
    mesh.userData.solidMaterial = solidMaterial;
    mesh.userData.texturedMaterial = texturedMaterial;

    bodyGroup.add(mesh);

    // --- Feature: Rings ---
    if (data.hasRing) {
        const inner = data.size * 1.4;
        const outer = data.size * 2.2;
        const ringGeo = new THREE.RingGeometry(inner, outer, 64);
        const ringMat = new THREE.MeshStandardMaterial({
            color: 0xcfb096,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.6,
            roughness: 0.8,
            metalness: 0.2
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.castShadow = true;
        ring.receiveShadow = true;
        ring.rotation.x = Math.PI / 2;
        bodyGroup.add(ring);
    }

    // --- Feature: Labels ---
    const labelDiv = document.createElement('div');
    labelDiv.className = 'planet-label';
    labelDiv.textContent = data.name;
    const label = new CSS2DObject(labelDiv);
    label.position.set(0, data.size + 0.5, 0); // Offset above planet
    bodyGroup.add(label);

    // --- Feature: Trails (Planets Only) ---
    let trail = null;
    if (data.type === 'Planet' && data.distance > 0) {
        // Trail settings
        const trailLength = 100; // Number of points
        const trailGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(trailLength * 3);
        trailGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const trailMat = new THREE.LineBasicMaterial({
            color: data.color, // Match planet color
            transparent: true,
            opacity: 0.4
        });

        trail = new THREE.Line(trailGeo, trailMat);
        trail.frustumCulled = false; // Prevent culling issues with dynamic bounds

        // Store trail metadata for updating
        trail.userData.isTrail = true;
        trail.userData.positions = positions;
        trail.userData.nextIndex = 0;
        trail.userData.full = false;
        trail.userData.target = bodyGroup; // What it follows
    }


    // Collection arrays
    const interactables = [mesh];
    const animated = [{
        pivot: orbitPivot,
        mesh: mesh,
        speed: data.speed || 0,
        rotationSpeed: data.rotationSpeed || 0
    }];

    // Aggregate lists for easy toggling in main.js
    const orbits = orbitLine ? [orbitLine] : [];
    const trails = trail ? [trail] : [];
    const labels = [label];

    // 5. Recursion (Moons)
    // Recursively call createSystem for any moons. This allows for infinite nesting
    // (e.g., moons of moons), although physically rare.
    // The child system is attached to the parent's bodyGroup, so it moves with the parent.
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
            orbits.push(...result.orbits);
            trails.push(...result.trails);
            labels.push(...result.labels);
        });
    }

    return {
        pivot: orbitPivot,
        orbit: orbitLine,
        trail: trail,
        label: label,
        interactables,
        animated,
        orbits,
        trails,
        labels
    };
}
