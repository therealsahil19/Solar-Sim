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

    // We use StandardMaterial but inject custom shader logic
    const material = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.8,
        metalness: 0.2,
        flatShading: true
    });

    // Custom Uniform for Time
    const timeUniform = { value: 0 };

    material.onBeforeCompile = (shader) => {
        shader.uniforms.time = timeUniform;

        // Inject Attributes
        shader.vertexShader = `
            attribute float aOffset;
            attribute float aSpeed;
            attribute float aOrbitRadius;
            attribute float aOrbitPhase;
            uniform float time;
        ` + shader.vertexShader;

        // Inject Logic
        // We replace '#include <begin_vertex>' to modify the 'transformed' position
        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `
            vec3 transformed = vec3( position );

            // Calculate Orbit
            float currentAngle = aOrbitPhase + (time * aSpeed);
            float x = cos(currentAngle) * aOrbitRadius;
            float z = sin(currentAngle) * aOrbitRadius;

            // Add vertical noise (already in instanceMatrix position, but we override x/z)
            // We use the initial instance position y as the vertical offset
            // However, instanceMatrix is applied AFTER 'begin_vertex'.
            // To do this correctly with InstancedMesh, we usually modify the local position
            // OR we hijack the instance matrix.

            // Simpler approach for InstancedMesh + Custom Shader:
            // We interpret the 'instanceMatrix' translation as the "Center" of orbit (0,0,0)
            // and we apply the offset here.

            // But wait, InstancedMesh applies the matrix automatically in <project_vertex>.
            // If we want to override the position entirely, we need to be careful.

            // Strategy:
            // We use the 'instanceMatrix' to set the initial static properties (scale, rotation).
            // We use the attributes to calculate the WORLD position offset (orbit).
            // But 'transformed' is in LOCAL space.

            // Let's assume the instanceMatrix puts them at (0, y, 0).
            // We add x and z to 'transformed'.

            transformed.x += x;
            transformed.z += z;

            // Add self-rotation (simple)
            // float rot = time * aSpeed * 5.0;
            // float c = cos(rot);
            // float s = sin(rot);
            // mat2 m = mat2(c, -s, s, c);
            // transformed.xz = m * transformed.xz;
            // (Self rotation is overkill for dots, skipping for perf)
            `
        );
    };

    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Attributes for Shader
    // We need to use InstancedBufferAttribute
    const orbitRadius = new Float32Array(count);
    const orbitSpeed = new Float32Array(count);
    const orbitPhase = new Float32Array(count);

    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
        // Randomize Orbit
        const r = minRadius + Math.random() * (maxRadius - minRadius);
        const speed = (0.02 + Math.random() * 0.05) * (Math.random() < 0.5 ? 1 : -1); // Bi-directional? No, belt usually 1 way.
        // Asteroid belt flows one way mostly.
        const speedMsg = 0.05 + Math.random() * 0.05; // 0.05 - 0.1
        // Kepler: Closer is faster? sqrt(1/r^3). Keep it simple.

        orbitRadius[i] = r;
        orbitSpeed[i] = speedMsg * (20 / r); // Slower at distance
        orbitPhase[i] = Math.random() * Math.PI * 2;

        // Set initial instance matrix (Scale and Y-offset)
        dummy.position.set(0, (Math.random() - 0.5) * 2, 0); // Vertical spread

        // Random rotation
        dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

        // Random Scale
        const s = 0.5 + Math.random() * 0.8;
        dummy.scale.set(s, s, s);

        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.geometry.setAttribute('aOrbitRadius', new THREE.InstancedBufferAttribute(orbitRadius, 1));
    mesh.geometry.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(orbitSpeed, 1));
    mesh.geometry.setAttribute('aOrbitPhase', new THREE.InstancedBufferAttribute(orbitPhase, 1));

    // Store uniform ref on mesh for easy access
    mesh.userData.timeUniform = timeUniform;

    // Bolt: Prevent frustum culling issues since vertices move in shader
    // Set bounding sphere to encompass entire belt
    mesh.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), maxRadius + 5);
    mesh.frustumCulled = false;

    return mesh;
}
