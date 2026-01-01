/**
 * @file debris.js
 * @description GPU-Accelerated Asteroid Belt Generator.
 *
 * BOLT OPTIMIZATION:
 * Uses `THREE.InstancedMesh` to render thousands of asteroids in 1 Draw Call.
 * Uses Vertex Shader injection to animate orbits entirely on the GPU.
 * Zero CPU overhead for animation.
 */

import * as THREE from 'three';

/**
 * Creates a GPU-animated asteroid belt using InstancedMesh.
 * @param {Object} config - Configuration.
 * @param {number} config.count - Number of asteroids.
 * @param {number} config.minRadius - Inner radius of the belt.
 * @param {number} config.maxRadius - Outer radius of the belt.
 * @param {THREE.TextureLoader} textureLoader - Loader for textures.
 * @returns {Object} { mesh: THREE.InstancedMesh, uniform: { value: number } }
 */
export function createAsteroidBelt(config = {}) {
    const count = config.count || 2000;
    const minRadius = config.minRadius || 25;
    const maxRadius = config.maxRadius || 32;

    // Shared Geometry & Material
    // Low poly sphere for asteroids
    const geometry = new THREE.IcosahedronGeometry(0.2, 0);

    // Custom Uniform for Time
    const timeUniform = { value: 0 };

    /**
     * Injects the orbital animation logic into the vertex shader.
     * This is reused for the Visual Material and Shadow Materials.
     * @param {THREE.Shader} shader - The shader object to modify.
     */
    const compileShader = (shader) => {
        shader.uniforms.time = timeUniform;

        // Inject Attributes
        shader.vertexShader = `
            attribute float aOrbitRadius;
            attribute float aSpeed;
            attribute float aOrbitPhase;
            uniform float time;
        ` + shader.vertexShader;

        // Technical Note: Coordinate Space Transformation
        // We inject the orbital logic into the <project_vertex> chunk.
        // Critically, we apply the orbit offset AFTER the instanceMatrix (local rotation/scale)
        // but BEFORE the modelViewMatrix. This ensures the orbital path remains flat
        // on the World XZ plane, effectively decoupling the orbit position from the
        // individual asteroid's tumbling rotation.

        const projectVertexChunk = `
            vec4 mvPosition = vec4( transformed, 1.0 );

            #ifdef USE_INSTANCING
                mvPosition = instanceMatrix * mvPosition;
            #endif

            // --- INJECTED ORBIT LOGIC ---
            float currentAngle = aOrbitPhase + (time * aSpeed);
            float orbitX = cos(currentAngle) * aOrbitRadius;
            float orbitZ = sin(currentAngle) * aOrbitRadius;

            // Apply Orbit Offset (World Space relative to Belt Center)
            mvPosition.x += orbitX;
            mvPosition.z += orbitZ;
            // ----------------------------

            mvPosition = modelViewMatrix * mvPosition;
            gl_Position = projectionMatrix * mvPosition;
        `;

        shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', projectVertexChunk);
    };

    // 1. Visual Material
    const material = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.8,
        metalness: 0.2,
        flatShading: true
    });
    material.onBeforeCompile = compileShader;

    // 2. Mesh Creation
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // 3. Shadow Materials (Fix for Incorrect Shadows)
    // Directional Light Shadows
    const customDepthMaterial = new THREE.MeshDepthMaterial({
        depthPacking: THREE.RGBADepthPacking
    });
    customDepthMaterial.onBeforeCompile = compileShader;
    mesh.customDepthMaterial = customDepthMaterial;

    // Point Light Shadows (The Sun)
    const customDistanceMaterial = new THREE.MeshDistanceMaterial();
    customDistanceMaterial.onBeforeCompile = compileShader;
    mesh.customDistanceMaterial = customDistanceMaterial;

    // 4. Attributes Generation
    const orbitRadius = new Float32Array(count);
    const orbitSpeed = new Float32Array(count);
    const orbitPhase = new Float32Array(count);

    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
        // Randomize Orbit
        const r = minRadius + Math.random() * (maxRadius - minRadius);
        const speedMsg = 0.05 + Math.random() * 0.05;

        orbitRadius[i] = r;
        orbitSpeed[i] = speedMsg * (20 / r); // Slower at distance
        orbitPhase[i] = Math.random() * Math.PI * 2;

        // Initial Transform (Scale & Vertical Scatter)
        dummy.position.set(0, (Math.random() - 0.5) * 2, 0);
        dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        const s = 0.5 + Math.random() * 0.8;
        dummy.scale.set(s, s, s);

        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.geometry.setAttribute('aOrbitRadius', new THREE.InstancedBufferAttribute(orbitRadius, 1));
    mesh.geometry.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(orbitSpeed, 1));
    mesh.geometry.setAttribute('aOrbitPhase', new THREE.InstancedBufferAttribute(orbitPhase, 1));

    // Store uniform ref
    mesh.userData.timeUniform = timeUniform;

    // Add a dispose method to clean up materials and geometry
    mesh.dispose = () => {
        mesh.geometry.dispose();
        mesh.material.dispose();
        if (mesh.customDepthMaterial) mesh.customDepthMaterial.dispose();
        if (mesh.customDistanceMaterial) mesh.customDistanceMaterial.dispose();
    };

    // Prevent frustum culling
    mesh.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), maxRadius + 5);
    mesh.frustumCulled = false;

    return mesh;
}
