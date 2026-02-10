/**
 * @file procedural.ts
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
import { getOrbitalPosition, physicsToRender } from './physics';
import type { OrbitalParameters, CelestialBody } from './types/system';
import type { SolarSimUserData } from './types';
import type { TrailManager } from './trails';
import type { InstanceRegistry } from './instancing';

// --- Shared Resources ---
const baseSphereGeometry = new THREE.SphereGeometry(1, 64, 64);

// Material Cache
const materialCache: Record<string, THREE.MeshStandardMaterial> = {};
// ⚡ Bolt Optimization: Cache materials by texture URL to enable instancing
const textureMaterialCache: Record<string, THREE.MeshStandardMaterial> = {};
let cachedGlowTexture: THREE.CanvasTexture | null = null;

/**
 * Extended TextureLoader with additional properties for our simulation.
 */
export interface ExtendedTextureLoader extends THREE.TextureLoader {
    instanceRegistry?: InstanceRegistry;
    trailManager?: TrailManager;
    lazyLoadQueue?: Array<{
        material: THREE.MeshStandardMaterial;
        url: string;
    }>;
}

/**
 * Result of creating a celestial system.
 */
export interface SystemResult {
    pivot: THREE.Group;
    orbit: THREE.LineLoop | null;
    interactables: THREE.Mesh[];
    animated: AnimatedBody[];
    orbits: THREE.LineLoop[];
    trails: unknown[];
    labels: CSS2DObject[];
}

/**
 * Animated body data for the animation loop.
 */
export interface AnimatedBody {
    pivot: THREE.Group;
    mesh: THREE.Group;
    physics: OrbitalParameters;
    parent?: OrbitalParameters | null;
}

/**
 * Clears the material cache to prevent memory leaks during scene resets.
 */
export function clearMaterialCache(): void {
    Object.values(materialCache).forEach(mat => mat.dispose());
    for (const key in materialCache) delete materialCache[key];

    Object.values(textureMaterialCache).forEach(mat => mat.dispose());
    for (const key in textureMaterialCache) delete textureMaterialCache[key];

    if (cachedGlowTexture) {
        cachedGlowTexture.dispose();
        cachedGlowTexture = null;
    }
}

/**
 * Creates/Retrieves the shared glow texture/material.
 */
function getGlowMaterial(): THREE.SpriteMaterial {
    if (!cachedGlowTexture) {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const context = canvas.getContext('2d');
        if (context) {
            const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
            gradient.addColorStop(0.2, 'rgba(255, 255, 200, 0.5)');
            gradient.addColorStop(0.5, 'rgba(255, 200, 100, 0.2)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            context.fillStyle = gradient;
            context.fillRect(0, 0, 64, 64);
        }
        cachedGlowTexture = new THREE.CanvasTexture(canvas);
    }
    return new THREE.SpriteMaterial({
        map: cachedGlowTexture,
        color: 0xffaa00,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
}

/**
 * Retrieves or creates a cached solid material for a given color.
 */
function getSolidMaterial(color: THREE.ColorRepresentation): THREE.MeshStandardMaterial {
    let key: string;
    if (color && typeof color === 'object' && 'isColor' in color) {
        key = '#' + (color as THREE.Color).getHexString();
    } else {
        key = String(color);
    }

    if (!materialCache[key]) {
        materialCache[key] = new THREE.MeshStandardMaterial({ color });
    }
    return materialCache[key]!;
}

/**
 * Creates a procedural starfield background using points.
 */
export function createStarfield(): THREE.Points {
    const geometry = new THREE.BufferGeometry();
    const count = 5000;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
        positions[i] = (Math.random() - 0.5) * 100000;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 2.0,
        transparent: true,
        opacity: 0.9,
        sizeAttenuation: true
    });
    return new THREE.Points(geometry, material);
}

/**
 * Creates an orbit line visualization.
 */
export function createOrbitLine(physicsData: OrbitalParameters): THREE.LineLoop {
    const segments = 256;
    const vertexCount = segments + 1; // +1 to match original logic (inclusive loop)

    // ⚡ Bolt Optimization: Use Float32Array to avoid thousands of Vector3 allocations per orbit
    const vertices = new Float32Array(vertexCount * 3);

    // Reuse vectors for calculation
    const posPhys = new THREE.Vector3();
    const posRender = new THREE.Vector3();

    // Optimization: Use pre-calculated period if available
    const period = physicsData.period ?? Math.pow(physicsData.a, 1.5);
    const dt = period / segments;

    for (let i = 0; i < vertexCount; i++) {
        const t = i * dt;

        // Zero-allocation path
        getOrbitalPosition(physicsData, t, posPhys);
        physicsToRender(posPhys, posRender);

        const idx = i * 3;
        vertices[idx] = posRender.x;
        vertices[idx + 1] = posRender.y;
        vertices[idx + 2] = posRender.z;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

    const material = new THREE.LineBasicMaterial({
        color: 0xffffff,
        opacity: 0.15,
        transparent: true
    });

    return new THREE.LineLoop(geometry, material);
}

/**
 * Creates a radial gradient texture for the Sun's glow.
 * Returns a cached instance if available to avoid expensive canvas operations.
 */
export function createGlowTexture(): THREE.CanvasTexture {
    if (cachedGlowTexture) {
        return cachedGlowTexture;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');

    if (context) {
        const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
        gradient.addColorStop(0, 'rgba(255, 255, 240, 1)');
        gradient.addColorStop(0.2, 'rgba(255, 255, 200, 0.8)');
        gradient.addColorStop(0.5, 'rgba(255, 220, 100, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        context.fillStyle = gradient;
        context.fillRect(0, 0, 128, 128);
    }

    cachedGlowTexture = new THREE.CanvasTexture(canvas);
    return cachedGlowTexture;
}

/**
 * Extended Sun mesh with dispose method.
 */
export class SunMesh extends THREE.Mesh {
    private glowMaterial: THREE.SpriteMaterial | null = null;



    constructor(
        geometry: THREE.BufferGeometry,
        material: THREE.Material | THREE.Material[],
        glowMaterial?: THREE.SpriteMaterial
    ) {
        super(geometry, material);


        this.glowMaterial = glowMaterial || null;
    }

    dispose(): void {
        super.dispatchEvent({ type: 'dispose' } as any);
        if (this.geometry) this.geometry.dispose();
        if (Array.isArray(this.material)) {
            this.material.forEach(m => m.dispose());
        } else if (this.material) {
            this.material.dispose();
        }

        if (this.glowMaterial) {
            this.glowMaterial.dispose();
        }
        // explicit geometry disposal if needed, though super.geometry handles instance
    }
}

/**
 * Creates the central Sun mesh.
 */
export function createSun(
    textureLoader: THREE.TextureLoader,
    useTextures: boolean
): SunMesh {
    const geometry = new THREE.SphereGeometry(2.5, 64, 64);
    const texture = textureLoader.load('textures/sun.jpg');

    const texturedMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        color: 0xffffff
    });

    const solidMaterial = new THREE.MeshBasicMaterial({ color: 0xffffaa });

    const glowMaterial = getGlowMaterial();

    const sun = new SunMesh(
        geometry,
        useTextures ? texturedMaterial : solidMaterial,
        glowMaterial
    );

    sun.castShadow = false;
    sun.receiveShadow = false;
    sun.position.set(0, 0, 0);

    const userData: SolarSimUserData = {
        name: "Sun",
        type: "Star",
        description: "The star at the center of the Solar System.",
        size: 2.5,
        distance: 0,
        solidMaterial: solidMaterial,
        texturedMaterial: texturedMaterial
    };
    sun.userData = userData;

    // Add Glow Sprite (already created above)
    const glowSprite = new THREE.Sprite(glowMaterial);
    glowSprite.scale.set(12, 12, 1);
    sun.add(glowSprite);

    // Dispose logic is now in the class

    return sun;
}

/**
 * Creates the player ship group.
 */
export function createPlayerShip(): THREE.Group {
    const shipGroup = new THREE.Group();

    const bodyGeo = new THREE.ConeGeometry(0.5, 2, 8);
    const bodyMat = new THREE.MeshNormalMaterial();
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.rotation.x = Math.PI / 2;
    shipGroup.add(body);

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
 * Creates the visual mesh/group for a celestial body.
 */
function createBodyMesh(
    data: CelestialBody,
    textureLoader: ExtendedTextureLoader,
    useTextures: boolean,
    geometry: THREE.BufferGeometry
): { visualGroup: THREE.Group; mesh: THREE.Mesh | null; solidMaterial: THREE.MeshStandardMaterial; texturedMaterial: THREE.MeshStandardMaterial } {
    const solidMaterial = getSolidMaterial(data.visual.color);
    let texturedMaterial: THREE.MeshStandardMaterial = solidMaterial;

    const isLazy = data.physics.a > 20;
    if (data.visual.texture) {
        const url = data.visual.texture;

        // Check cache first
        if (textureMaterialCache[url]) {
            texturedMaterial = textureMaterialCache[url];

            // If we have a cached material but it's a lazy placeholder (map is null),
            // and this request is NOT lazy, we should "upgrade" it to load the texture now.
            if (!isLazy && !texturedMaterial.map) {
                const texture = textureLoader.load(url);
                texturedMaterial.map = texture;
                texturedMaterial.color.setHex(0xffffff);
                texturedMaterial.needsUpdate = true;
            }
        } else {
            // Create new material
            if (isLazy && textureLoader.lazyLoadQueue) {
                texturedMaterial = new THREE.MeshStandardMaterial({
                    color: data.visual.color,
                    map: null
                });
                textureLoader.lazyLoadQueue.push({
                    material: texturedMaterial,
                    url: url
                });
            } else {
                const texture = textureLoader.load(url);
                texturedMaterial = new THREE.MeshStandardMaterial({
                    map: texture,
                    color: 0xffffff
                });
            }
            // Store in cache
            textureMaterialCache[url] = texturedMaterial;
        }
    }

    const userData: SolarSimUserData & { physics: OrbitalParameters } = {
        name: data.name,
        type: data.type,
        description: data.description ?? "",
        physicsOrbit: data.physics,
        size: data.visual.size,
        distance: data.physics.a,
        solidMaterial: solidMaterial,
        texturedMaterial: texturedMaterial,
        physics: data.physics
    };

    // Visual Group
    const visualGroup = new THREE.Group();
    visualGroup.scale.set(data.visual.size, data.visual.size, data.visual.size);

    // Create Mesh or Register Instance
    let mesh: THREE.Mesh | null = null;
    if (textureLoader.instanceRegistry) {
        const mat = useTextures ? texturedMaterial : solidMaterial;
        textureLoader.instanceRegistry.addInstance(visualGroup, geometry, mat, userData);
    } else {
        mesh = new THREE.Mesh(geometry, useTextures ? texturedMaterial : solidMaterial);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = userData;
        visualGroup.add(mesh);
    }

    return { visualGroup, mesh, solidMaterial, texturedMaterial };
}

/**
 * Creates a ring for a celestial body if defined.
 */
function createBodyRing(
    data: CelestialBody,
    textureLoader: ExtendedTextureLoader,
    useTextures: boolean
): THREE.Mesh | null {
    const ringData = data.visual.ring ?? (data.visual.hasRing ? { inner: 1.4, outer: 2.2 } : null);
    if (!ringData) return null;

    const inner = ringData.inner ?? 1.4;
    const outer = ringData.outer ?? 2.2;
    const ringGeo = new THREE.RingGeometry(inner, outer, 128);

    const pos = ringGeo.attributes.position as THREE.BufferAttribute;
    const uv = ringGeo.attributes.uv as THREE.BufferAttribute;
    const v3 = new THREE.Vector3();
    if (pos && uv) {
        for (let i = 0; i < pos.count; i++) {
            v3.fromBufferAttribute(pos, i);
            uv.setXY(i, (v3.x / (outer * 2)) + 0.5, (v3.y / (outer * 2)) + 0.5);
        }
    }

    let ringMat: THREE.MeshStandardMaterial;
    if (ringData.texture && useTextures) {
        const ringTexture = textureLoader.load(ringData.texture);
        ringMat = new THREE.MeshStandardMaterial({
            map: ringTexture,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9,
            roughness: 0.5,
            metalness: 0.1
        });
    } else {
        ringMat = new THREE.MeshStandardMaterial({
            color: ringData.color ?? 0xcfb096,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.6,
            roughness: 0.8,
            metalness: 0.2
        });
    }

    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.castShadow = true;
    ring.receiveShadow = true;
    ring.rotation.x = Math.PI / 2;
    return ring;
}

/**
 * Creates a label for the celestial body.
 */
function createBodyLabel(data: CelestialBody, parentData: OrbitalParameters | null): CSS2DObject {
    const labelDiv = document.createElement('div');
    labelDiv.className = 'planet-label';
    labelDiv.textContent = data.name;
    const label = new CSS2DObject(labelDiv);
    label.position.set(0, data.visual.size + 1.0, 0);
    label.userData.isMoon = (data.type === 'Moon');
    label.userData.parentPlanet = parentData ? null : null;
    return label;
}

/**
 * Recursively creates a celestial body system (planet + moons).
 */
export function createSystem(
    data: CelestialBody,
    textureLoader: ExtendedTextureLoader,
    useTextures: boolean,
    parentData: OrbitalParameters | null = null
): SystemResult {
    // ⚡ Bolt Optimization: Pre-calculate period if missing to avoid repeated Math.pow() in loop
    if (data.physics && data.physics.period === undefined) {
        data.physics.period = Math.pow(data.physics.a, 1.5);
    }

    // Pivot & Body Container
    const pivot = new THREE.Group();
    (pivot.userData as Record<string, unknown>).physics = data.physics;
    (pivot.userData as Record<string, unknown>).type = data.type;

    // Orbit Line
    let orbitLine: THREE.LineLoop | null = null;
    if (data.physics && data.physics.a > 0) {
        if (data.type === 'Planet' || data.type === 'Dwarf Planet') {
            orbitLine = createOrbitLine(data.physics);
        }
    }

    // Visual Mesh / Group
    const { visualGroup, mesh, solidMaterial, texturedMaterial } = createBodyMesh(
        data,
        textureLoader,
        useTextures,
        baseSphereGeometry
    );
    pivot.add(visualGroup);

    // Rings
    const ring = createBodyRing(data, textureLoader, useTextures);
    if (ring) {
        visualGroup.add(ring);
    }

    // Label
    const label = createBodyLabel(data, parentData);
    pivot.add(label);

    // Trails
    if (textureLoader.trailManager && (data.type === 'Planet' || data.type === 'Dwarf Planet')) {
        textureLoader.trailManager.register(pivot, data.visual.color);
    }

    // Collections
    const interactables: THREE.Mesh[] = [];
    if (mesh) interactables.push(mesh);

    const animated: AnimatedBody[] = [{
        pivot: pivot,
        mesh: visualGroup,
        physics: data.physics,
        parent: parentData
    }];

    const orbits: THREE.LineLoop[] = orbitLine ? [orbitLine] : [];
    const labels: CSS2DObject[] = [label];
    const trails: unknown[] = [];

    // Recursion (Moons)
    if (data.moons && data.moons.length > 0) {
        data.moons.forEach(moonData => {
            const result = createSystem(moonData, textureLoader, useTextures, data.physics);
            pivot.add(result.pivot);
            if (result.orbit) pivot.add(result.orbit);

            // optimization: use spread syntax which is efficient in modern engines
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
