/**
 * @file trails.js
 * @description Orbit Trail Rendering System ("Bolt" Optimization).
 *
 * Problem: Rendering thousands of individual `THREE.Line` objects (one per moon/planet) kills performance
 * due to excessive draw calls (CPU overhead).
 *
 * Solution ("Bolt"):
 * 1. Single Geometry: We merge ALL trails into one massive `THREE.LineSegments` geometry.
 * 2. Ring Buffer: Each trail uses a fixed-size cyclic buffer to store positions, avoiding
 *    expensive array shifting (O(N) -> O(1)).
 * 3. Draw Calls: Reduces draw calls from N (number of planets) to 1.
 */

import * as THREE from 'three';

/**
 * Manages the unified trail system.
 *
 * Architecture:
 * - A single `Float32Array` stores position data for ALL trails.
 * - `LineSegments` is used instead of `LineStrip` to allow independent trails without "degenerate lines" connecting them.
 * - Each trail is assigned a slice of the global buffer.
 */
export class TrailManager {
    /**
     * Initializes the trail system.
     *
     * @param {THREE.Scene} scene - The scene where the trail mesh will be added.
     * @param {number} [maxTrails=5000] - Hard limit on the number of objects that can have trails.
     * @param {number} [pointsPerTrail=500] - Resolution of each trail. Higher = smoother but more memory.
     * @example
     * const trails = new TrailManager(scene, 100, 200);
     * trails.register(earthMesh, 0x2233ff);
     * // In loop:
     * trails.update();
     */
    constructor(scene, maxTrails = 5000, pointsPerTrail = 500) {
        this.scene = scene;
        this.maxTrails = maxTrails;
        this.pointsPerTrail = pointsPerTrail;

        // Logic for LineSegments:
        // A trail of N points consists of N-1 segments.
        // Each segment needs 2 vertices (Start, End).
        // Total Vertices = MaxTrails * (Points - 1) * 2.
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

        // Initial Draw Range 0 to avoid rendering garbage
        this.geometry.setDrawRange(0, 0);

        scene.add(this.mesh);

        this.trails = []; // { target: Object3D, color: Color, history: Array<Vector3>, head: number, index: number }
        this.nextTrailIndex = 0;
    }

    /**
     * Registers a new object to track with a trail.
     *
     * @param {THREE.Object3D} target - The object to follow (must have a valid world matrix).
     * @param {THREE.Color|number|string} color - Color of the trail.
     */
    register(target, color) {
        if (this.nextTrailIndex >= this.maxTrails) {
            console.warn("TrailManager: Max trails reached.");
            return;
        }

        const index = this.nextTrailIndex++;
        const col = new THREE.Color(color);

        // Pre-allocate Vector3 objects for the history buffer.
        // This is critical: We do NOT create new Vector3s during the render loop (Garbage Collection avoidance).
        const history = new Array(this.pointsPerTrail);

        // Fix: Force update world matrix to ensure we have the correct starting position.
        // Without this, the first frame might read (0,0,0) resulting in a visual artifact (line from sun).
        target.updateMatrixWorld(true);
        const startPos = new THREE.Vector3().setFromMatrixPosition(target.matrixWorld);

        for (let i = 0; i < this.pointsPerTrail; i++) {
            history[i] = startPos.clone();
        }

        this.trails.push({
            target,
            baseColor: col,
            history,
            head: 0, // Pointer to the "newest" position in the ring buffer
            index
        });

        // Initialize the geometry data for this trail (all points at startPos initially)
        this.updateTrailGeometry(index, history, 0, col);

        // Expand the active draw range of the geometry to include this new trail
        const totalActiveVertices = this.nextTrailIndex * this.segmentsPerTrail * 2;
        this.geometry.setDrawRange(0, totalActiveVertices);
    }

    /**
     * Updates all registered trails.
     * Should be called once per frame in the animation loop.
     *
     * Optimization: Uses a shared temp vector to avoid GC churn.
     */
    update() {
        // Re-use a single temp vector for reading world position to avoid GC.
        const tempVec = new THREE.Vector3();

        this.trails.forEach(trail => {
            // 1. Validate Target (ID-029)
            if (!trail.target || !trail.target.parent) return;

            // 2. Advance the Ring Buffer Head (Cyclic)
            trail.head = (trail.head + 1) % this.pointsPerTrail;

            // 3. Capture Current Position
            // We overwrite the existing Vector3 at 'head' rather than creating a new one.
            tempVec.setFromMatrixPosition(trail.target.matrixWorld);
            trail.history[trail.head].copy(tempVec);

            // 4. Update the Geometry Buffers
            this.updateTrailGeometry(trail.index, trail.history, trail.head, trail.baseColor);
        });

        // Mark attributes as dirty so Three.js uploads them to the GPU
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
    }

    /**
     * Reconstructs the vertex data for a single trail based on its history.
     *
     * @param {number} trailIndex - Unique index of the trail.
     * @param {Array<THREE.Vector3>} history - The ring buffer of positions.
     * @param {number} head - The current index of the newest position in `history`.
     * @param {THREE.Color} color - The base color.
     */
    updateTrailGeometry(trailIndex, history, head, color) {
        // Calculate the offset in the global vertex array for this trail.
        // Each segment needs 2 vertices.
        const baseVertex = trailIndex * this.segmentsPerTrail * 2;
        const historyLen = this.pointsPerTrail;

        for (let i = 0; i < this.segmentsPerTrail; i++) {
            // Unwind the ring buffer:
            // i=0 -> Newest segment (Head -> Head-1)
            // i=1 -> Second newest (Head-1 -> Head-2)

            // Calculate cyclic indices
            let i1 = (head - i + historyLen) % historyLen;       // Current Point
            let i2 = (head - (i + 1) + historyLen) % historyLen; // Previous Point

            const p1 = history[i1];
            const p2 = history[i2];

            // Calculate Gradient/Fade
            // fade=1.0 (Newest) -> fade=0.0 (Oldest)
            // We apply this to vertex colors to create a "comet tail" effect.
            const fade1 = 1.0 - (i / this.segmentsPerTrail);
            const fade2 = 1.0 - ((i + 1) / this.segmentsPerTrail);

            const vIndex = baseVertex + (i * 2);

            // -- Vertex 1 (Start of Segment) --
            this.positions[vIndex * 3] = p1.x;
            this.positions[vIndex * 3 + 1] = p1.y;
            this.positions[vIndex * 3 + 2] = p1.z;

            this.colors[vIndex * 3] = color.r * fade1;
            this.colors[vIndex * 3 + 1] = color.g * fade1;
            this.colors[vIndex * 3 + 2] = color.b * fade1;

            // -- Vertex 2 (End of Segment) --
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
        // Geometry remains allocated but we hide it
        this.geometry.setDrawRange(0, 0);
    }

    /**
     * Disposes of the trail system and its resources.
     */
    dispose() {
        this.scene.remove(this.mesh);
        this.geometry.dispose();
        this.material.dispose();
        this.trails = [];
    }
}
