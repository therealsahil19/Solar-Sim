/**
 * @file procedural.js
 * @description Factory module for generating 3D objects in the simulation.
 *
 * This module follows a functional "Factory" pattern. It exports pure functions
 * that accept configuration/dependencies and return Three.js objects (Meshes, Groups, Points).
 * It does not maintain global state or modify the scene directly.
 *
 * It handles:
 * 1. Efficient material reuse via a caching mechanism.
 * 2. Shared geometry instantiation to reduce memory footprint.
 * 3. Procedural generation of stars, planets, and moons.
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
 * Should be called when the scene is destroyed or reset.
 */
export function clearMaterialCache() {
    Object.values(materialCache).forEach(mat => mat.dispose());
    for (const key in materialCache) delete materialCache[key];
}

/**
 * Retrieves or creates a cached solid material for a given color.
 * Use this to avoid creating duplicate materials for objects with the same color.
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

    // 3. Body Group (Position & Rotation Container - UNSCALED)
    // This group holds the position relative to the pivot.
    // We attach children (moons) here so they inherit position but NOT scale.
    const bodyGroup = new THREE.Group();
    bodyGroup.position.x = data.distance;
    orbitPivot.add(bodyGroup);

    // 4. Visual Mesh Group (Scaled)
    // This inner group holds the visual mesh and is scaled to the planet size.
    // Children should NOT be added here unless they are surface details.
    const visualGroup = new THREE.Group();
    visualGroup.scale.set(data.size, data.size, data.size);
    bodyGroup.add(visualGroup);

    // 5. Mesh
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

    // Bolt Support: Instancing
    // If an instanceRegistry is provided, we register instead of creating a Mesh.
    // However, primary planets often need specific traits. For simplicity, we instance everything.
    // NOTE: Scale must be applied to the Pivot or handled in the matrix.
    // Since we pass pivot.matrixWorld to instance, scaling the pivot works!

    // We used to scale bodyGroup, now we scale visualGroup.
    // bodyGroup remains scale (1,1,1).

    const userData = {
        name: data.name,
        type: data.type,
        size: data.size,
        description: data.description || "",
        distance: data.distance,
        solidMaterial: solidMaterial,
        texturedMaterial: texturedMaterial,
        useTextures: useTextures
    };

    let mesh = null;

    // Check if we have a registry (passed via data.instanceRegistry hack or we add a param)
    // We will update createSystem signature in main.js
    if (textureLoader.instanceRegistry) {
        // Use current material based on useTextures
        const mat = useTextures ? texturedMaterial : solidMaterial;
        // IMPORTANT: The instance pivot is now `visualGroup` because it has the scale!
        // The registry will read `visualGroup.matrixWorld` which includes the scale.
        textureLoader.instanceRegistry.addInstance(visualGroup, geometry, mat, userData);

        // We create a dummy object for interaction targets if needed,
        // but the InstancedMesh itself will be the interaction target.
        // The Pivot (visualGroup) holds the userData.
    } else {
        // Fallback for Sun or if registry missing
        mesh = new THREE.Mesh(geometry, useTextures ? texturedMaterial : solidMaterial);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        // Scale is already on visualGroup, but Mesh default scale is 1, so it inherits.

        mesh.userData = userData;
        visualGroup.add(mesh);
    }

    // --- Feature: Rings ---
    if (data.hasRing) {
        const inner = 1.4; // Relative to unit sphere (since visualGroup is scaled)
        const outer = 2.2;
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
        visualGroup.add(ring);
    }

    // --- Feature: Labels ---
    // Labels should NOT be scaled, so they remain on bodyGroup?
    // But they need to be positioned above the planet surface.
    // Surface is at Y = data.size (since radius is size).
    const labelDiv = document.createElement('div');
    labelDiv.className = 'planet-label';
    labelDiv.textContent = data.name;
    const label = new CSS2DObject(labelDiv);

    // Position label relative to bodyGroup center.
    // The surface is at `data.size`. So we put it slightly above.
    label.position.set(0, data.size + 0.5, 0);
    bodyGroup.add(label);

    // --- Feature: Trails (Planets Only) ---
    // Bolt Support: Unified Trails
    let trail = null;
    // We register trails if a manager is present.
    // Hack: check textureLoader.trailManager
    if (data.distance > 0 && textureLoader.trailManager) {
        if (data.type === 'Planet' || data.type === 'Moon') {
             // Trail should follow the center (bodyGroup), not the scaled visual
             textureLoader.trailManager.register(bodyGroup, data.color);
        }
    } else if (data.type === 'Planet' && data.distance > 0) {
        // Fallback to legacy trails if no manager
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
    const interactables = [];
    if (mesh) interactables.push(mesh);

    // For animated, we still need to update rotations
    // If mesh is null (instanced), we still rotate the Pivot (bodyGroup) for self-rotation?
    // Actually, bodyGroup handles position.
    // Self-rotation usually happens on the mesh.
    // Since we scale bodyGroup, we can also rotate bodyGroup for self-rotation!
    const animated = [{
        pivot: orbitPivot, // Orbital rotation
        mesh: visualGroup, // Self rotation (applied to visualGroup)
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
