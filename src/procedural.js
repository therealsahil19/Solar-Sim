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
import { getOrbitalPosition, physicsToRender } from './physics.js';

// --- Shared Resources ---
// Reusing geometry reduces memory overhead significantly
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
 * Creates an orbit line visualization by sampling the physics orbit
 * and transforming points to render space.
 *
 * @param {Object} physicsData - The orbital elements.
 * @returns {THREE.LineLoop} The orbit line object.
 */
export function createOrbitLine(physicsData) {
    const points = [];
    const segments = 256; // High resolution for elliptical/inclined orbits

    const period = Math.pow(physicsData.a, 1.5);
    const dt = period / segments;

    for (let i = 0; i <= segments; i++) {
        const t = i * dt;
        const posPhys = getOrbitalPosition(physicsData, t);
        const posRender = physicsToRender(posPhys);
        points.push(posRender);
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
        color: 0xffffff,
        opacity: 0.15,
        transparent: true
    });

    return new THREE.LineLoop(geometry, material);
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
 * @returns {THREE.Mesh} The Sun mesh.
 */
export function createSun(textureLoader, useTextures) {
    const geometry = new THREE.SphereGeometry(2.5, 64, 64); // Visual Size 2.5

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
    sun.position.set(0, 0, 0); // Sun is at origin

    sun.userData.name = "Sun";
    sun.userData.type = "Star";
    sun.userData.size = 2.5;
    sun.userData.description = "The star at the center of the Solar System.";
    sun.userData.distance = 0; // Legacy / Info Panel
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
    glowSprite.scale.set(12, 12, 1);
    sun.add(glowSprite);

    return sun;
}

/**
 * Creates the player ship group.
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

    // Engines
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

    shipGroup.position.set(20, 5, 20); // Initial position
    return shipGroup;
}

/**
 * Recursively creates a celestial body system (planet + moons).
 *
 * @param {Object} data - Configuration object from `system.json`.
 * @param {THREE.TextureLoader} textureLoader - Loader instance.
 * @param {boolean} useTextures - Initial texture state.
 * @param {Object} [parentData] - Data of the parent body (for relative calculations).
 * @returns {Object} System components (pivot, orbit, interactables, etc.).
 */
export function createSystem(data, textureLoader, useTextures, parentData = null) {
    // 1. Pivot & Body Container
    // This Group acts as the "Anchor". It will be moved to the calculated
    // Render Position by the physics loop in `main.js`.
    const pivot = new THREE.Group();
    pivot.userData.physics = data.physics; // Store physics data for main loop
    pivot.userData.type = data.type;

    // 2. Orbit Line
    let orbitLine = null;
    if (data.physics && data.physics.a > 0) {
        // Only draw orbits for primary planets to avoid visual clutter/artifacts for moons
        if (data.type === 'Planet' || data.type === 'Dwarf Planet') {
             orbitLine = createOrbitLine(data.physics);
        } else {
            orbitLine = null;
        }
    }

    // 3. Visual Mesh
    const geometry = baseSphereGeometry;
    const solidMaterial = getSolidMaterial(data.visual.color);
    let texturedMaterial = solidMaterial; // Default

    // Lazy Load Texture
    // Bolt Optimization: Load outer planets (>20AU) later to speed up initial render
    const isLazy = data.physics.a > 20;
    if (data.visual.texture) {
        if (isLazy && textureLoader.lazyLoadQueue) {
             texturedMaterial = new THREE.MeshStandardMaterial({
                color: data.visual.color,
                map: null
             });
             textureLoader.lazyLoadQueue.push({
                 material: texturedMaterial,
                 url: data.visual.texture
             });
        } else {
            const texture = textureLoader.load(data.visual.texture);
            texturedMaterial = new THREE.MeshStandardMaterial({
                map: texture,
                color: 0xffffff
            });
        }
    }

    const userData = {
        name: data.name,
        type: data.type,
        size: data.visual.size,
        description: data.description || "",
        distance: data.physics.a, // Display AU
        solidMaterial: solidMaterial,
        texturedMaterial: texturedMaterial,
        physics: data.physics // Store here too
    };

    // Visual Group handles Scale
    // We separate Scale (Visual) from Position (Pivot)
    const visualGroup = new THREE.Group();
    visualGroup.scale.set(data.visual.size, data.visual.size, data.visual.size);
    pivot.add(visualGroup);

    // Create Mesh or Register Instance
    let mesh = null;
    if (textureLoader.instanceRegistry) {
        // Bolt Optimization: Use Instancing for performance
        const mat = useTextures ? texturedMaterial : solidMaterial;
        // visualGroup is the object that will be moved/scaled.
        // We pass visualGroup to registry.
        textureLoader.instanceRegistry.addInstance(visualGroup, geometry, mat, userData);
    } else {
        mesh = new THREE.Mesh(geometry, useTextures ? texturedMaterial : solidMaterial);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = userData;
        visualGroup.add(mesh);
    }

    // 4. Rings (Saturn/Uranus)
    if (data.visual.hasRing) {
        const inner = 1.4;
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

    // 5. Label
    const labelDiv = document.createElement('div');
    labelDiv.className = 'planet-label';
    labelDiv.textContent = data.name;
    const label = new CSS2DObject(labelDiv);
    // Position label above the planet (taking scale into account)
    label.position.set(0, data.visual.size + 1.0, 0);
    pivot.add(label);

    // 6. Trails
    // Register with manager if available
    let trail = null;
    if (textureLoader.trailManager && (data.type === 'Planet' || data.type === 'Dwarf Planet')) {
        // Trace the PIVOT (which moves).
        textureLoader.trailManager.register(pivot, data.visual.color);
    }

    // Collections
    const interactables = [];
    if (mesh) interactables.push(mesh);

    const animated = [{
        pivot: pivot,
        mesh: visualGroup, // Self rotation
        physics: data.physics,
        parent: parentData // Store parent physics if this is a moon
    }];

    const orbits = orbitLine ? [orbitLine] : [];
    const labels = [label];
    const trails = trail ? [trail] : [];

    // 7. Recursion (Moons)
    if (data.moons && data.moons.length > 0) {
        data.moons.forEach(moonData => {
            // Pass current body's physics as parentData
            const result = createSystem(moonData, textureLoader, useTextures, data.physics);

            // Hierarchy: Moons are children of the Planet Pivot.
            // This ensures they move with the planet in Render Space.
            // However, their position must be updated relative to the planet every frame.
            pivot.add(result.pivot);

            if (result.orbit) pivot.add(result.orbit);

            interactables.push(...result.interactables);
            animated.push(...result.animated);
            orbits.push(...result.orbits);
            trails.push(...result.trails);
            labels.push(...result.labels);
        });
    }

    return {
        pivot,
        orbit: orbitLine,
        interactables,
        animated,
        orbits,
        trails,
        labels
    };
}
