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
import type { OrbitalParameters } from './types/system';
import type { TrailManager } from './trails';
import type { InstanceRegistry } from './instancing';

// --- Shared Resources ---
const baseSphereGeometry = new THREE.SphereGeometry(1, 64, 64);

// Material Cache
const materialCache: Record<string, THREE.MeshStandardMaterial> = {};

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
 * Configuration for a celestial body from system.json.
 */
export interface SystemData {
    name: string;
    type: string;
    physics: OrbitalParameters;
    visual: {
        color: string | number;
        size: number;
        texture?: string;
        ring?: {
            inner?: number;
            outer?: number;
            texture?: string;
            color?: number;
        };
        hasRing?: boolean;
    };
    description?: string;
    moons?: SystemData[];
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
    const points: THREE.Vector3[] = [];
    const segments = 256;

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
 * Creates a radial gradient texture for the Sun's glow.
 */
function createGlowTexture(): THREE.CanvasTexture {
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

    return new THREE.CanvasTexture(canvas);
}

/**
 * Extended Sun mesh with dispose method.
 */
export interface SunMesh extends THREE.Mesh {
    dispose: () => void;
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sun = new THREE.Mesh(
        geometry,
        useTextures ? texturedMaterial : solidMaterial
    ) as any as SunMesh;

    sun.castShadow = false;
    sun.receiveShadow = false;
    sun.position.set(0, 0, 0);

    sun.userData = {
        name: "Sun",
        type: "Star",
        description: "The star at the center of the Solar System."
    };

    // Additional legacy properties
    (sun.userData as Record<string, unknown>).size = 2.5;
    (sun.userData as Record<string, unknown>).distance = 0;
    (sun.userData as Record<string, unknown>).solidMaterial = solidMaterial;
    (sun.userData as Record<string, unknown>).texturedMaterial = texturedMaterial;

    // Add Glow Sprite
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

    sun.dispose = (): void => {
        glowTexture.dispose();
        glowMaterial.dispose();
        geometry.dispose();
    };

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
 * Recursively creates a celestial body system (planet + moons).
 */
export function createSystem(
    data: SystemData,
    textureLoader: ExtendedTextureLoader,
    useTextures: boolean,
    parentData: OrbitalParameters | null = null
): SystemResult {
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

    // Visual Mesh
    const geometry = baseSphereGeometry;
    const solidMaterial = getSolidMaterial(data.visual.color);
    let texturedMaterial: THREE.MeshStandardMaterial = solidMaterial;

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userData: any = {
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
    pivot.add(visualGroup);

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

    // Rings
    const ringData = data.visual.ring ?? (data.visual.hasRing ? { inner: 1.4, outer: 2.2 } : null);
    if (ringData) {
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
        visualGroup.add(ring);
    }

    // Label
    const labelDiv = document.createElement('div');
    labelDiv.className = 'planet-label';
    labelDiv.textContent = data.name;
    const label = new CSS2DObject(labelDiv);
    label.position.set(0, data.visual.size + 1.0, 0);
    label.userData.isMoon = (data.type === 'Moon');
    label.userData.parentPlanet = parentData ? null : null;
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
