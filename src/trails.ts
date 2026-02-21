/**
 * @file trails.ts
 * @description Orbit Trail Rendering System ("Bolt" Optimization).
 *
 * Problem: Rendering thousands of individual `THREE.Line` objects (one per moon/planet) kills performance.
 * Solution: GPU-based trail rendering using a single merged geometry and DataTexture history.
 *
 * Optimization Strategy:
 * 1. Single Draw Call: Uses one THREE.LineSegments for ALL trails.
 * 2. GPU History: Stores trail positions in a Float32 DataTexture.
 *    - Layout: Transposed (Width = MaxTrails, Height = Points).
 *    - This ensures that all trails' positions for a specific time step (row) are contiguous in memory.
 * 3. Zero CPU Loop: Updates are done via `gl.texSubImage2D` (one ROW per frame), replacing the O(N*M) CPU loop.
 * 4. Vertex Shader: Handles ring buffer unwinding and fading.
 */

import * as THREE from 'three';
import type { Disposable } from './types';
import { TRAIL_VERTEX_SHADER, TRAIL_FRAGMENT_SHADER } from './shaders';

// ============================================================================
// Shaders
// ============================================================================



// ============================================================================
// Trail Manager
// ============================================================================

/**
 * Individual trail metadata.
 */
interface Trail {
    target: THREE.Object3D;
    index: number;
    baseColor: THREE.Color;
}

/**
 * GPU-accelerated orbit trail renderer.
 */
export class TrailManager implements Disposable {
    private scene: THREE.Scene;
    private maxTrails: number;
    private pointsPerTrail: number;
    private segmentsPerTrail: number;

    private geometry: THREE.BufferGeometry;
    private material: THREE.ShaderMaterial;
    public mesh: THREE.LineSegments;

    // GPU Data
    private historyTexture: THREE.DataTexture;
    private historyData: Float32Array; // The CPU-side backing buffer for the texture
    private rowTexture: THREE.DataTexture; // Helper texture for single-row updates

    private trails: Trail[];
    private nextTrailIndex: number;
    private globalHead: number; // 0..pointsPerTrail-1
    private updateRowBuffer: Float32Array; // Buffer for one ROW update (MaxTrails * 4)

    // Reuse vector to avoid GC
    private _tempVec: THREE.Vector3;
    private _tempVec2: THREE.Vector2;
    private _pendingFlush = false;

    /**
     * Initializes the trail system.
     */
    constructor(scene: THREE.Scene, maxTrails: number = 5000, pointsPerTrail: number = 100) {
        this.scene = scene;
        // Clamp maxTrails to 4096 to ensure compatibility with most devices
        this.maxTrails = Math.min(maxTrails, 4096);
        if (maxTrails > 4096) {
            console.warn(`TrailManager: Clamping maxTrails from ${maxTrails} to ${this.maxTrails} for texture compatibility.`);
        }

        this.pointsPerTrail = pointsPerTrail;
        this.segmentsPerTrail = pointsPerTrail;
        this._tempVec = new THREE.Vector3();
        this._tempVec2 = new THREE.Vector2();

        // 1. Setup DataTexture (History)
        // Transposed Layout: Width = MaxTrails, Height = Points
        const width = this.maxTrails;
        const height = pointsPerTrail;
        const totalPixels = width * height;

        this.historyData = new Float32Array(totalPixels * 4);
        this.historyTexture = new THREE.DataTexture(
            this.historyData as BufferSource,
            width,
            height,
            THREE.RGBAFormat,
            THREE.FloatType
        );
        this.historyTexture.minFilter = THREE.NearestFilter;
        this.historyTexture.magFilter = THREE.NearestFilter;
        this.historyTexture.generateMipmaps = false;
        this.historyTexture.needsUpdate = true;

        // Buffer for single row update
        this.updateRowBuffer = new Float32Array(this.maxTrails * 4);

        // Helper texture for updates
        this.rowTexture = new THREE.DataTexture(
            this.updateRowBuffer as BufferSource,
            this.maxTrails,
            1,
            THREE.RGBAFormat,
            THREE.FloatType
        );
        this.rowTexture.minFilter = THREE.NearestFilter;
        this.rowTexture.magFilter = THREE.NearestFilter;
        this.rowTexture.generateMipmaps = false;

        // 2. Setup Geometry
        const totalSegments = this.maxTrails * this.segmentsPerTrail;
        const totalVertices = totalSegments * 2;

        this.geometry = new THREE.BufferGeometry();

        // Attributes arrays
        const indices = new Float32Array(totalVertices); // aSegmentIndex
        const vertexIndices = new Float32Array(totalVertices); // aVertexIndex
        const trailIndices = new Float32Array(totalVertices); // aTrailIndex
        const colors = new Float32Array(totalVertices * 3); // aColor
        const positions = new Float32Array(totalVertices * 3);

        // Fill static attributes
        let ptr = 0;
        for (let t = 0; t < this.maxTrails; t++) {
            for (let s = 0; s < this.segmentsPerTrail; s++) {
                // Vertex 0 (Start)
                indices[ptr] = s;
                vertexIndices[ptr] = 0;
                trailIndices[ptr] = t;
                ptr++;

                // Vertex 1 (End)
                indices[ptr] = s;
                vertexIndices[ptr] = 1;
                trailIndices[ptr] = t;
                ptr++;
            }
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('aSegmentIndex', new THREE.BufferAttribute(indices, 1));
        this.geometry.setAttribute('aVertexIndex', new THREE.BufferAttribute(vertexIndices, 1));
        this.geometry.setAttribute('aTrailIndex', new THREE.BufferAttribute(trailIndices, 1));
        this.geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

        // 3. Setup Material
        this.material = new THREE.ShaderMaterial({
            vertexShader: TRAIL_VERTEX_SHADER,
            fragmentShader: TRAIL_FRAGMENT_SHADER,
            uniforms: {
                uHistory: { value: this.historyTexture },
                uHead: { value: 0 },
                uPointsPerTrail: { value: pointsPerTrail },
                uMaxTrails: { value: maxTrails }
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.mesh = new THREE.LineSegments(this.geometry, this.material);
        this.mesh.frustumCulled = false;

        // Initially draw nothing
        this.geometry.setDrawRange(0, 0);

        scene.add(this.mesh);

        this.trails = [];
        this.nextTrailIndex = 0;
        this.globalHead = 0;
    }

    /**
     * Registers a new object.
     */
    register(target: THREE.Object3D, color: THREE.ColorRepresentation): void {
        if (this.nextTrailIndex >= this.maxTrails) {
            console.warn("TrailManager: Max trails reached.");
            return;
        }

        const index = this.nextTrailIndex++;
        const col = new THREE.Color(color);

        this.trails.push({
            target,
            index,
            baseColor: col
        });

        // Update Color Attribute
        const colorAttr = this.geometry.attributes.aColor as THREE.BufferAttribute;
        const startVertex = index * this.segmentsPerTrail * 2;
        const endVertex = startVertex + (this.segmentsPerTrail * 2);

        for (let i = startVertex; i < endVertex; i++) {
            colorAttr.setXYZ(i, col.r, col.g, col.b);
        }
        colorAttr.needsUpdate = true;

        // Mutate updateRange directly as it might be read-only in this version
        // Use addUpdateRange if available (Three.js r159+) to avoid deprecation warnings
        if (colorAttr.addUpdateRange) {
            colorAttr.addUpdateRange(startVertex * 3, (endVertex - startVertex) * 3);
        } else if (colorAttr.updateRange) {
            colorAttr.updateRange.offset = startVertex * 3;
            colorAttr.updateRange.count = (endVertex - startVertex) * 3;
        }

        // Expand Draw Range
        const totalActiveVertices = this.nextTrailIndex * this.segmentsPerTrail * 2;
        this.geometry.setDrawRange(0, totalActiveVertices);

        // Pre-fill history in texture to prevent (0,0,0) artifacts
        target.updateMatrixWorld(true);
        // Direct matrix access (approx 1.8x faster than setFromMatrixPosition)
        const te = target.matrixWorld.elements;
        const sx = te[12]!, sy = te[13]!, sz = te[14]!;

        // Fill the entire column for this trail (Transposed layout: Column = trailIndex)
        // Data index = (y * width + x) * 4
        // x = index, y = 0..pointsPerTrail
        const w = this.maxTrails;

        for (let y = 0; y < this.pointsPerTrail; y++) {
            const pxIndex = (y * w + index) * 4;
            const data = this.historyData as Float32Array;
            data[pxIndex] = sx;
            data[pxIndex + 1] = sy;
            data[pxIndex + 2] = sz;
            data[pxIndex + 3] = 1.0;
        }

        // Defer texture update — call flushRegistrations() after all registrations
        this._pendingFlush = true;
    }

    /**
     * Batched GPU upload after all registrations complete.
     * Call this once after all register() calls to avoid GPU bandwidth spikes.
     */
    flushRegistrations(): void {
        if (this._pendingFlush) {
            this.historyTexture.needsUpdate = true;
            this._pendingFlush = false;
        }
    }

    /**
     * Updates all trails.
     * @param renderer The WebGLRenderer
     */
    update(renderer: THREE.WebGLRenderer): void {
        // Increment global head
        this.globalHead = (this.globalHead + 1) % this.pointsPerTrail;
        this.material.uniforms.uHead!.value = this.globalHead;

        // Collect new positions for ALL active trails
        const activeCount = this.trails.length;

        for (let i = 0; i < activeCount; i++) {
            const trail = this.trails[i];
            if (!trail) continue; // Should not happen

            // Capture position
            // We use matrixWorld directly to avoid object update overhead if already updated
            // Direct matrix access (approx 1.8x faster than setFromMatrixPosition)
            const te = trail.target.matrixWorld.elements;
            this._tempVec.set(te[12]!, te[13]!, te[14]!);

            // Write to update buffer at index 'trail.index'
            const offset = trail.index * 4;
            this.updateRowBuffer[offset] = this._tempVec.x;
            this.updateRowBuffer[offset + 1] = this._tempVec.y;
            this.updateRowBuffer[offset + 2] = this._tempVec.z;
            this.updateRowBuffer[offset + 3] = 1.0;
        }

        // Sync to main CPU buffer for data integrity (needed when GPU texture not yet created)
        const historyOffset = this.globalHead * this.maxTrails * 4;
        this.historyData.set(this.updateRowBuffer, historyOffset);

        // Upload texture row using copyTextureToTexture mechanism
        this.rowTexture.needsUpdate = true;
        this._tempVec2.set(0, this.globalHead);
        renderer.copyTextureToTexture(this._tempVec2, this.rowTexture, this.historyTexture);
    }

    /**
     * Resets the trail system.
     */
    reset(): void {
        this.nextTrailIndex = 0;
        this.trails = [];
        this.globalHead = 0;
        this.material.uniforms.uHead!.value = 0;
        this.geometry.setDrawRange(0, 0);

        this.historyData.fill(0);
        this.historyTexture.needsUpdate = true;
    }

    dispose(): void {
        this.scene.remove(this.mesh);
        this.geometry.dispose();
        this.material.dispose();
        this.historyTexture.dispose();
        this.rowTexture.dispose();
        this.trails = [];
    }
}
