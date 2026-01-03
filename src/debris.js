/**
 * @file debris.js
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

// GLSL: Constants & Helper Functions
const DEBRIS_SHADER_HEAD = `
#define AU_SCALE 40.0
#define LIMIT_1 30.0
#define LIMIT_2 50.0
#define VISUAL_LIMIT_1 1200.0
#define LOG_FACTOR_K 1.5
#define VISUAL_LIMIT_2 1382.67
#define LOG_FACTOR_O 4.0
#define PI 3.14159265359

uniform float uTime;

// Attributes
attribute vec4 aOrbit;  // x=a, y=e, z=i, w=M0
attribute vec3 aParams; // x=omega, y=Omega, z=tumbleSpeed

// Helper: Rotate vector by axis/angle
/**
 * Rotates a 3D vector by a given axis and angle using Rodrigues' rotation formula.
 * @param {vec3} v - The vector to rotate.
 * @param {vec3} axis - The unit axis of rotation.
 * @param {float} angle - The rotation angle in radians.
 * @returns {vec3} The rotated vector.
 */
vec3 rotateAxis(vec3 v, vec3 axis, float angle) {
    return v * cos(angle) + cross(axis, v) * sin(angle) + axis * dot(axis, v) * (1.0 - cos(angle));
}

// Helper: Piecewise Scale (Physics AU -> Render Units)
/**
 * Translates a position from physical AU units to Render units using Multi-Zone Scaling.
 * Zones:
 * 1. Inner (Linear): r <= 30 AU (Scaled by 40)
 * 2. Mid (Log): 30 < r <= 50 AU
 * 3. Outer (Log): r > 50 AU
 * @param {vec3} pos - Heliocentric position in AU.
 * @returns {vec3} Scaled position for Three.js rendering.
 */
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
/**
 * Solves Keplerian orbital elements for a 3D position at a given time.
 * Calculates Mean Anomaly (M), iterates for Eccentric Anomaly (E), 
 * and computes Heliocentric coordinates.
 * @param {float} a - Semi-major axis (AU).
 * @param {float} e - Eccentricity.
 * @param {float} i - Inclination (deg).
 * @param {float} w - Argument of Periapsis (deg).
 * @param {float} Om - Longitude of Ascending Node (deg).
 * @param {float} M0 - Mean Anomaly at Epoch (deg).
 * @param {float} time - Elapsed time in relative years.
 * @returns {vec3} Heliocentric position (Three.js Y-up coordinate space).
 */
vec3 solveKepler(float a, float e, float i, float w, float Om, float M0, float time) {
    // 1. Mean Anomaly
    // period = a^1.5 (Kepler's Third Law)
    float period = pow(a, 1.5);
    float n = 360.0 / period; // degrees per year
    float M = radians(M0 + n * time);

    // 2. Eccentric Anomaly (Iterative)
    float E = M;
    // 5 iterations for precision
    for (int k = 0; k < 5; k++) {
        E = M + e * sin(E);
    }

    // 3. True Anomaly & Radius
    float r = a * (1.0 - e * cos(E));

    // atan2(y, x)
    float xv = a * (cos(E) - e);
    float yv = a * sqrt(1.0 - e * e) * sin(E);
    float nu = atan(yv, xv);

    // 4. Orientation
    float cosNu = cos(nu);
    float sinNu = sin(nu);

    // Pre-calc rotations
    float radOm = radians(Om);
    float radw = radians(w);
    float radi = radians(i);

    // Argument of Latitude u
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

    // Map to Three.js (Y-up) -> x=x, y=z, z=y
    return vec3(x, z, y);
}
`;

const DEBRIS_VERTEX_MAIN = `
    // 1. Tumble Animation (Local Space)
    // Tumble axis is random per instance (we use aParams.x/y as seed or just constant axis)
    // Let's use a simple axis based on ID or just (1,1,1)
    vec3 tumbleAxis = normalize(vec3(sin(aParams.x), cos(aParams.y), sin(aParams.x * aParams.y)));
    float tumbleAngle = uTime * aParams.z; // z is speed

    vec3 transformed = rotateAxis(position, tumbleAxis, tumbleAngle);

    // 2. Solve Orbit (World Space)
    vec3 orbitPosPhys = solveKepler(aOrbit.x, aOrbit.y, aOrbit.z, aParams.x, aParams.y, aOrbit.w, uTime);
    vec3 orbitPosRender = physicsToRender(orbitPosPhys);

    // 3. Instance Transform
    // instanceMatrix contains the initial random Rotation/Scale.
    // We apply it to our tumbled geometry.
    // NOTE: instanceMatrix in Three.js includes translation, but we set it to 0,0,0 in CPU.

    // Standard Three.js injection for Instancing usually happens in 'project_vertex'.
    // We will inject logic to offset the world position.
`;

/**
 * Factory function to create a GPU-accelerated debris field.
 */
function createDebrisSystem(config) {
    const {
        count = 1000,
        distribution,
        isSpherical = config.distribution.isSpherical || false,
        material: matConfig
        // Bug 037 Fix: Removed unused `staticPhysics` parameter (was dead code)
    } = config;

    // Geometry
    const size = matConfig.size || 0.2;
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

    // Custom Shader Injection
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 };
        material.userData.shader = shader; // Save ref to update uniform

        // Inject Constants & Helpers
        shader.vertexShader = DEBRIS_SHADER_HEAD + shader.vertexShader;

        // Inject Logic
        // We replace 'include <begin_vertex>' to handle local deformation (tumble)
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

        // We replace 'include <project_vertex>' to handle world positioning
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

            // Apply Offset (in View Space? No, we need to add it before View Matrix)
            // mvPosition currently is (Model * Instance * Local).
            // ModelView = View * Model.
            // But usually 'mvPosition' calculation above includes modelViewMatrix multiplication.
            // Let's check standard chunk:
            // mvPosition = modelViewMatrix * mvPosition;

            // Wait, the standard chunk is:
            // vec4 mvPosition = vec4( transformed, 1.0 );
            // #ifdef USE_INSTANCING
            //     mvPosition = instanceMatrix * mvPosition;
            // #endif
            // mvPosition = modelViewMatrix * mvPosition;

            // So we need to INTERCEPT before modelViewMatrix.
            // But we can't easily split the chunk string without Copy-Paste.
            // So we will do the calculation in world space and apply it.

            // RE-WRITE standard block slightly:
            #ifdef USE_INSTANCING
                mvPosition = instanceMatrix * mvPosition;
            #endif

            // Add Orbital Offset (World Space)
            mvPosition.xyz += orbitPosRender;

            mvPosition = modelViewMatrix * mvPosition;
            gl_Position = projectionMatrix * mvPosition;
            `
        );
    };

    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.userData.type = config.type; // Store type for toggling
    mesh.castShadow = !matConfig.transparent;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false; // Important: bounds are dynamic

    // Allocate Attributes
    const aOrbit = new Float32Array(count * 4);  // a, e, i, M0
    const aParams = new Float32Array(count * 3); // omega, Omega, tumbleSpeed
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
        // Random Distribution
        const a = distribution.minA + Math.random() * (distribution.maxA - distribution.minA);
        const e = distribution.minE + Math.random() * (distribution.maxE - distribution.minE);

        let inc;
        if (isSpherical) {
            // Uniform sphere distribution approx
            inc = distribution.minI + Math.random() * (distribution.maxI - distribution.minI);
        } else {
            inc = distribution.minI + Math.random() * (distribution.maxI - distribution.minI);
        }

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

        // Set Instance Matrix (Initial Random Scale/Rot)
        dummy.position.set(0, 0, 0); // Position controlled by shader
        dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        const s = 0.5 + Math.random() * 0.5;
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.geometry.setAttribute('aOrbit', new THREE.InstancedBufferAttribute(aOrbit, 4));
    mesh.geometry.setAttribute('aParams', new THREE.InstancedBufferAttribute(aParams, 3));
    mesh.instanceMatrix.needsUpdate = true;

    // Update Method (Called by main.js)
    mesh.update = (time) => {
        // Just update uniform
        if (mesh.material.userData.shader) {
            mesh.material.userData.shader.uniforms.uTime.value = time;
        }
    };

    mesh.dispose = () => {
        mesh.geometry.dispose();
        mesh.material.dispose();
        if (mesh.material.userData && mesh.material.userData.shader) {
            mesh.material.userData.shader = null;
        }
    };

    return mesh;
}

export function createBelt(config) {
    return createDebrisSystem({
        type: config.name.toLowerCase().replace(' ', '_'),
        count: config.visual.count,
        distribution: config.distribution,
        isSpherical: config.visual.isSpherical || false,
        material: {
            color: config.visual.color,
            size: config.visual.size,
            opacity: config.visual.opacity
        }
    });
}
