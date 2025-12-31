/**
 * @file trails.js
 * @description Manages a unified trail system for efficient orbit rendering.
 *
 * BOLT OPTIMIZATION:
 * Renders thousands of orbit trails using a single `THREE.LineSegments` geometry,
 * massively reducing draw calls compared to individual Line objects.
 * Uses a cyclic buffer to update trail positions efficiently.
 */

import * as THREE from 'three';

/**
 * Manages a unified trail system to render thousands of orbit trails with a single draw call.
 * Uses a single LineSegments geometry with a cyclic buffer for each instance.
 */
export class TrailManager {
    /**
     * @param {THREE.Scene} scene - The scene to add the trail system to.
     * @param {number} [maxTrails=5000] - Maximum number of objects that can have trails.
     * @param {number} [pointsPerTrail=100] - Number of points (segments) per trail.
     */
    constructor(scene, maxTrails = 5000, pointsPerTrail = 100) {
        this.scene = scene;
        this.maxTrails = maxTrails;
        this.pointsPerTrail = pointsPerTrail;

        // Total vertices = trails * (points - 1) * 2 (for LineSegments)
        // Or we can use LineStrip if we separate them? No, merged geometry for LineStrip needs degenerate triangles or separation.
        // LineSegments is easier: (p0, p1), (p1, p2), (p2, p3)...
        // Total segments = pointsPerTrail - 1
        // Total vertices = maxTrails * (pointsPerTrail - 1) * 2

        this.segmentsPerTrail = pointsPerTrail - 1;
        const totalVertices = maxTrails * this.segmentsPerTrail * 2;

        this.geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(totalVertices * 3);
        this.colors = new Float32Array(totalVertices * 3);

        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

        this.material = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.4,
            depthWrite: false, // Performance
            blending: THREE.AdditiveBlending
        });

        this.mesh = new THREE.LineSegments(this.geometry, this.material);
        this.mesh.frustumCulled = false; // Always render
        this.mesh.userData = { isTrailSystem: true };

        scene.add(this.mesh);

        this.trails = []; // { target: Object3D, color: Color, history: Array<Vector3>, index: number }
        this.nextTrailIndex = 0;
    }

    /**
     * Registers a trail for an object.
     * @param {THREE.Object3D} target - The object to follow.
     * @param {THREE.Color|number|string} color - Color of the trail.
     */
    register(target, color) {
        if (this.nextTrailIndex >= this.maxTrails) {
            console.warn("TrailManager: Max trails reached.");
            return;
        }

        const index = this.nextTrailIndex++;
        const col = new THREE.Color(color);

        // Initialize history with target's current position
        const history = [];
        const startPos = new THREE.Vector3().setFromMatrixPosition(target.matrixWorld);

        for (let i = 0; i < this.pointsPerTrail; i++) {
            history.push(startPos.clone());
        }

        this.trails.push({
            target,
            baseColor: col,
            history,
            index
        });

        // Initialize colors for this trail segment
        // We can fade opacity by modifying color (darker) or alpha if using shader.
        // With LineBasicMaterial vertexColors, we can simulate fade with black/darker color.
        this.updateTrailGeometry(index, history, col);
    }

    /**
     * Updates all trails. Call this in the animation loop.
     */
    update() {
        // Update history for all trails
        const tempVec = new THREE.Vector3();

        this.trails.forEach(trail => {
            // Shift history
            trail.history.pop();
            tempVec.setFromMatrixPosition(trail.target.matrixWorld);
            trail.history.unshift(tempVec.clone()); // Need clone? Yes.

            this.updateTrailGeometry(trail.index, trail.history, trail.baseColor);
        });

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
    }

    /**
     * Updates the geometry buffers for a specific trail.
     * @param {number} trailIndex - Index of the trail in the system.
     * @param {Array<THREE.Vector3>} history - Array of positions.
     * @param {THREE.Color} color - Base color of the trail.
     */
    updateTrailGeometry(trailIndex, history, color) {
        // Map trail to buffer position
        // Trail i occupies vertices: i * segments * 2 to (i+1) * segments * 2

        const baseVertex = trailIndex * this.segmentsPerTrail * 2;

        for (let i = 0; i < this.segmentsPerTrail; i++) {
            const p1 = history[i];
            const p2 = history[i+1];

            // Fade factor
            const fade1 = 1.0 - (i / this.segmentsPerTrail);
            const fade2 = 1.0 - ((i + 1) / this.segmentsPerTrail);

            const vIndex = baseVertex + (i * 2);

            // Position 1
            this.positions[vIndex * 3] = p1.x;
            this.positions[vIndex * 3 + 1] = p1.y;
            this.positions[vIndex * 3 + 2] = p1.z;

            this.colors[vIndex * 3] = color.r * fade1;
            this.colors[vIndex * 3 + 1] = color.g * fade1;
            this.colors[vIndex * 3 + 2] = color.b * fade1;

            // Position 2
            this.positions[(vIndex + 1) * 3] = p2.x;
            this.positions[(vIndex + 1) * 3 + 1] = p2.y;
            this.positions[(vIndex + 1) * 3 + 2] = p2.z;

            this.colors[(vIndex + 1) * 3] = color.r * fade2;
            this.colors[(vIndex + 1) * 3 + 1] = color.g * fade2;
            this.colors[(vIndex + 1) * 3 + 2] = color.b * fade2;
        }
    }

    /**
     * Resets the trail system (clears all trails).
     */
    reset() {
        // Clear all trails logic if needed
        this.nextTrailIndex = 0;
        this.trails = [];
        // Geometry remains allocated
    }
}
