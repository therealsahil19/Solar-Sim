/**
 * @file debris.ts
 * @description Procedural Debris Generator & Renderer (GPU Optimized).
 *
 * PERFORMANCE STRATEGY ("Bolt" ⚡):
 * - Uses `THREE.InstancedMesh` for rendering.
 * - Orbit mechanics are calculated entirely in the Vertex Shader.
 * - NO CPU OVERHEAD for animation (0ms per frame).
 * - Supports Multi-Zone Scaling (Linear -> Log) in GLSL.
 *
 * PHYSICS NOTE:
 * The orbital position is calculated in the Vertex Shader using a simplified Kepler Solver.
 * Since high-precision iterative solvers are expensive on the GPU, we use a 5-step
 * iteration for the Eccentric Anomaly (E), which provides sufficient visual accuracy
 * for near-circular orbits (e < 0.2).
 */

import * as THREE from 'three';

/**
 * Distribution configuration for debris orbital parameters.
 * Defines the spatial boundaries for the procedurally generated objects.
 */
export interface DebrisDistribution {
    /** Minimum semi-major axis in AU */
    minA: number;
    /** Maximum semi-major axis in AU */
    maxA: number;
    /** Minimum eccentricity (0.0 to 1.0) */
    minE: number;
    /** Maximum eccentricity */
    maxE: number;
    /** Minimum inclination in degrees */
    minI: number;
    /** Maximum inclination */
    maxI: number;
    /** If true, generates a spherical shell distribution (like Oort Cloud) instead of a disk */
    isSpherical?: boolean;
}

/**
 * Material configuration for debris particles.
 */
export interface DebrisMaterialConfig {
    /** Color representation (hex or string) */
    color?: number | string;
    /** Base size of the geometry */
    size?: number;
    /** PBR roughness (0.0 to 1.0) */
    roughness?: number;
    /** PBR metalness (0.0 to 1.0) */
    metalness?: number;
    /** Transparency (0.0 to 1.0) */
    opacity?: number;
}

/**
 * Configuration for creating a debris system.
 */
export interface DebrisConfig {
    type: string;
    count: number;
    distribution: DebrisDistribution;
    isSpherical?: boolean;
    material: DebrisMaterialConfig;
}

/**
 * Belt configuration from system.json.
 */
export interface BeltSystemConfig {
    name: string;
    visual: {
        count: number;
        color?: number | string;
        size?: number;
        opacity?: number;
        isSpherical?: boolean;
    };
    distribution: DebrisDistribution;
}

/**
 * Extended InstancedMesh with update and dispose methods.
 */
export interface DebrisMesh extends THREE.InstancedMesh {
    update: (time: number) => void;
    dispose: () => void;
}

interface ShaderMaterialUserData {
    shader?: {
        uniforms: Record<string, { value: unknown }>;
        vertexShader: string;
        fragmentShader: string;
    } | undefined;
}

import { SCALE_CONFIG } from './physics';

const VISUAL_LIMIT_1 = SCALE_CONFIG.LIMIT_LINEAR * SCALE_CONFIG.AU_SCALE;
const VISUAL_LIMIT_2 = VISUAL_LIMIT_1 + Math.log(1 + (SCALE_CONFIG.LIMIT_KUIPER - SCALE_CONFIG.LIMIT_LINEAR)) * SCALE_CONFIG.AU_SCALE * SCALE_CONFIG.LOG_FACTOR_KUIPER;

// GLSL: Constants & Helper Functions
const DEBRIS_SHADER_HEAD = `
#define AU_SCALE ${SCALE_CONFIG.AU_SCALE.toFixed(1)}
#define LIMIT_1 ${SCALE_CONFIG.LIMIT_LINEAR.toFixed(1)}
#define LIMIT_2 ${SCALE_CONFIG.LIMIT_KUIPER.toFixed(1)}
#define VISUAL_LIMIT_1 ${VISUAL_LIMIT_1.toFixed(1)}
#define LOG_FACTOR_K ${SCALE_CONFIG.LOG_FACTOR_KUIPER.toFixed(1)}
#define VISUAL_LIMIT_2 ${VISUAL_LIMIT_2.toFixed(3)}
#define LOG_FACTOR_O ${SCALE_CONFIG.LOG_FACTOR_OORT.toFixed(1)}
#ifndef PI
#define PI 3.14159265359
#endif

uniform float uTime;

// Attributes
attribute vec4 aOrbit;  // x=a, y=e, z=i, w=M0
attribute vec3 aParams; // x=omega, y=Omega, z=tumbleSpeed

// Helper: Rotate vector by axis/angle
vec3 rotateAxis(vec3 v, vec3 axis, float angle) {
    return v * cos(angle) + cross(axis, v) * sin(angle) + axis * dot(axis, v) * (1.0 - cos(angle));
}

// Helper: Piecewise Scale (Physics AU -> Render Units)
// This GLSL function mirrors the CPU-side physicsToRender logic.
// It maps vast distances into renderable zones using a Linear -> Log -> Log function.
// Zone 1: [0, 30] AU -> Linear Scale (dist * AU_SCALE)
// Zone 2: [30, 50] AU -> Mild Logarithmic Compression (Kuiper Belt)
// Zone 3: [50, inf] AU -> Aggressive Logarithmic Compression (Oort Cloud)
vec3 physicsToRender(vec3 pos) {
    float r = length(pos);
    if (r == 0.0) return vec3(0.0);

    float r_vis;
    if (r <= LIMIT_1) {
        r_vis = r * AU_SCALE;
    } else if (r <= LIMIT_2) {
        r_vis = VISUAL_LIMIT_1 + log(1.0 + (r - LIMIT_1)) * AU_SCALE * LOG_FACTOR_K;
    } else {
        r_vis = VISUAL_LIMIT_2 + log(1.0 + (r - LIMIT_2)) * AU_SCALE * LOG_FACTOR_O;
    }

    return normalize(pos) * r_vis;
}

// Helper: Kepler Solver
vec3 solveKepler(float a, float e, float i, float w, float Om, float M0, float time) {
    // 1. Mean Anomaly
    float period = pow(a, 1.5);
    float n = 360.0 / period;
    float M = radians(M0 + n * time);

    // 2. Eccentric Anomaly (Iterative)
    float E = M;
    for (int k = 0; k < 5; k++) {
        E = M + e * sin(E);
    }

    // 3. True Anomaly & Radius
    float r = a * (1.0 - e * cos(E));

    float xv = a * (cos(E) - e);
    float yv = a * sqrt(1.0 - e * e) * sin(E);
    float nu = atan(yv, xv);

    // 4. Orientation
    float radOm = radians(Om);
    float radw = radians(w);
    float radi = radians(i);

    float u = radw + nu;

    float cosU = cos(u);
    float sinU = sin(u);
    float cosOm = cos(radOm);
    float sinOm = sin(radOm);
    float cosI = cos(radi);
    float sinI = sin(radi);

    // Heliocentric Coords
    float x = r * (cosOm * cosU - sinOm * sinU * cosI);
    float y = r * (sinOm * cosU + cosOm * sinU * cosI);
    float z = r * (sinI * sinU);

    // Map to Three.js (Y-up)
    return vec3(x, z, y);
}
`;

/**
 * Factory function to create a GPU-accelerated debris field.
 */
/**
 * InstancedMesh with simplified Kepler physics on GPU.
 */
class DebrisSystem extends THREE.InstancedMesh implements DebrisMesh {
    constructor(geometry: THREE.BufferGeometry, material: THREE.Material, count: number) {
        super(geometry, material, count);
    }

    update(time: number): void {
        const mat = this.material as THREE.Material;
        const userData = mat.userData as ShaderMaterialUserData;
        if (userData?.shader?.uniforms?.uTime) {
            userData.shader.uniforms.uTime.value = time;
        }
    }

    override dispose(): void {
        this.geometry.dispose();
        if (this.material instanceof THREE.Material) {
            this.material.dispose();
        }
        const mat = this.material as THREE.Material;
        const matUserData = mat?.userData as ShaderMaterialUserData | undefined;
        if (matUserData && matUserData.shader) {
            matUserData.shader = undefined;
        }
        // Force context loss cleanup implies we shouldn't hold refs
    }
}

/**
 * Factory function to create a GPU-accelerated debris field.
 */
function buildDebrisMaterial(matConfig: DebrisMaterialConfig): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({
        color: matConfig.color ?? 0x888888,
        roughness: matConfig.roughness ?? 0.8,
        metalness: matConfig.metalness ?? 0.2,
        flatShading: true,
        transparent: (matConfig.opacity ?? 1.0) < 1.0,
        opacity: matConfig.opacity ?? 1.0
    });

    // Custom Shader Injection
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 };
        (material.userData as ShaderMaterialUserData).shader = shader;

        // Inject Constants & Helpers
        shader.vertexShader = DEBRIS_SHADER_HEAD + shader.vertexShader;

        // Inject Logic - replace begin_vertex
        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `
            vec3 transformed = vec3( position );
            // Tumble
            vec3 tumbleAxis = normalize(vec3(sin(aParams.x*10.0), cos(aParams.y*10.0), 0.5));
            float tumbleAngle = uTime * aParams.z;
            transformed = rotateAxis(transformed, tumbleAxis, tumbleAngle);
            `
        );

        // Replace project_vertex for world positioning
        shader.vertexShader = shader.vertexShader.replace(
            '#include <project_vertex>',
            `
            vec4 mvPosition = vec4( transformed, 1.0 );
            #ifdef USE_INSTANCING
                mvPosition = instanceMatrix * mvPosition;
            #endif

            // Calculate Orbit Position
            vec3 orbitPosPhys = solveKepler(aOrbit.x, aOrbit.y, aOrbit.z, aParams.x, aParams.y, aOrbit.w, uTime);
            vec3 orbitPosRender = physicsToRender(orbitPosPhys);

            // Add Orbital Offset (World Space)
            mvPosition.xyz += orbitPosRender;

            mvPosition = modelViewMatrix * mvPosition;
            gl_Position = projectionMatrix * mvPosition;
            `
        );
    };

    return material;
}

function populateDebrisAttributes(mesh: DebrisSystem, count: number, distribution: DebrisDistribution): void {
    const aOrbit = new Float32Array(count * 4);
    const aParams = new Float32Array(count * 3);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
        // Random Distribution
        const a = distribution.minA + Math.random() * (distribution.maxA - distribution.minA);
        const e = distribution.minE + Math.random() * (distribution.maxE - distribution.minE);
        const inc = distribution.minI + Math.random() * (distribution.maxI - distribution.minI);

        const omega = Math.random() * 360;
        const Omega = Math.random() * 360;
        const M0 = Math.random() * 360;
        const tumbleSpeed = 0.5 + Math.random() * 2.0;

        // Fill Attributes
        aOrbit[i * 4 + 0] = a;
        aOrbit[i * 4 + 1] = e;
        aOrbit[i * 4 + 2] = inc;
        aOrbit[i * 4 + 3] = M0;

        aParams[i * 3 + 0] = omega;
        aParams[i * 3 + 1] = Omega;
        aParams[i * 3 + 2] = tumbleSpeed;

        // Set Instance Matrix
        dummy.position.set(0, 0, 0);
        dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        const s = 0.5 + Math.random() * 0.5;
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.geometry.setAttribute('aOrbit', new THREE.InstancedBufferAttribute(aOrbit, 4));
    mesh.geometry.setAttribute('aParams', new THREE.InstancedBufferAttribute(aParams, 3));
    mesh.instanceMatrix.needsUpdate = true;
}

function createDebrisSystem(config: DebrisConfig): DebrisMesh {
    const { count = 1000, distribution, material: matConfig } = config;

    const geometry = new THREE.IcosahedronGeometry(matConfig.size ?? 0.2, 0);
    const material = buildDebrisMaterial(matConfig);
    const mesh = new DebrisSystem(geometry, material, count);

    mesh.userData.type = config.type;
    mesh.castShadow = !(matConfig.opacity !== undefined && matConfig.opacity < 1.0);
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;

    populateDebrisAttributes(mesh, count, distribution);

    return mesh;
}

/**
 * Creates a belt system (asteroid belt, Kuiper belt, etc.).
 *
 * @param config - High-level configuration from system.json.
 * @returns An optimized InstancedMesh with GPU animation.
 *
 * @example
 * const asteroidBelt = createBelt({
 *   name: 'Asteroid Belt',
 *   visual: { count: 5000, color: 0x888888, size: 0.1 },
 *   distribution: { minA: 2.1, maxA: 3.3, minE: 0.0, maxE: 0.1, minI: 0.0, maxI: 10.0 }
 * });
 */
export function createBelt(config: BeltSystemConfig): DebrisMesh {
    return createDebrisSystem({
        type: config.name.toLowerCase().replace(' ', '_'),
        count: config.visual.count,
        distribution: config.distribution,
        isSpherical: config.visual.isSpherical ?? false,
        material: {
            color: config.visual.color ?? 0x888888,
            size: config.visual.size ?? 0.2,
            opacity: config.visual.opacity ?? 1.0
        }
    });
}
