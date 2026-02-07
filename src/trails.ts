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

// ============================================================================
// Shaders
// ============================================================================

const TRAIL_VERTEX_SHADER = `
uniform sampler2D uHistory;
uniform float uHead; // Current global head index
uniform float uPointsPerTrail;
uniform float uMaxTrails;

attribute float aSegmentIndex;
attribute float aVertexIndex; // 0 = start of segment, 1 = end of segment
attribute float aTrailIndex;
attribute vec3 aColor;

varying vec3 vColor;
varying float vAlpha;

void main() {
    float head = floor(uHead);
    float segIdx = aSegmentIndex;

    // 1. Collapse the "Gap" segment (Head -> Head+1 in ring buffer logic)
    // The segment starting at 'head' connects the newest point to the oldest point.
    // We want to hide it.
    if (abs(segIdx - head) < 0.1) {
        gl_Position = vec4(0.0, 0.0, 0.0, 0.0);
        return;
    }

    // 2. Determine which history point we need
    // If VertexIndex=0, we want point at segIdx.
    // If VertexIndex=1, we want point at (segIdx + 1) % Points.
    float historyIdx = segIdx;
    if (aVertexIndex > 0.5) {
        historyIdx = mod(segIdx + 1.0, uPointsPerTrail);
    }

    // 3. Texture Lookup (Transposed Layout)
    // X = Trail Index, Y = History Index
    vec2 uv = vec2(
        (aTrailIndex + 0.5) / uMaxTrails,
        (historyIdx + 0.5) / uPointsPerTrail
    );

    vec3 pos = texture2D(uHistory, uv).xyz;

    // 4. Calculate Fade/Alpha
    // Distance in segments from the head (backwards)
    float age = mod(head - segIdx + uPointsPerTrail, uPointsPerTrail);
    float alpha = 1.0 - (age / uPointsPerTrail);

    // Enhance fade curve (pow 2)
    alpha = alpha * alpha;

    vColor = aColor;
    vAlpha = alpha;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const TRAIL_FRAGMENT_SHADER = `
varying vec3 vColor;
varying float vAlpha;

void main() {
    gl_FragColor = vec4(vColor, vAlpha);
}
`;

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

    private trails: Trail[];
    private nextTrailIndex: number;
    private globalHead: number; // 0..pointsPerTrail-1
    private updateRowBuffer: Float32Array; // Buffer for one ROW update (MaxTrails * 4)

    // Reuse vector to avoid GC
    private _tempVec: THREE.Vector3;

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

        // 1. Setup DataTexture (History)
        // Transposed Layout: Width = MaxTrails, Height = Points
        const width = this.maxTrails;
        const height = pointsPerTrail;
        const totalPixels = width * height;

        this.historyData = new Float32Array(totalPixels * 4);
        this.historyTexture = new THREE.DataTexture(
            this.historyData as any,
            width,
            height,
            THREE.RGBAFormat,
            THREE.FloatType
        );
        this.historyTexture.minFilter = THREE.NearestFilter;
        this.historyTexture.magFilter = THREE.NearestFilter;
        this.historyTexture.generateMipmaps = false;
        this.historyTexture.needsUpdate = true;

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

        // Buffer for single row update
        this.updateRowBuffer = new Float32Array(this.maxTrails * 4);
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
        const startPos = new THREE.Vector3().setFromMatrixPosition(target.matrixWorld);

        // Fill the entire column for this trail (Transposed layout: Column = trailIndex)
        // Data index = (y * width + x) * 4
        // x = index, y = 0..pointsPerTrail
        const w = this.maxTrails;

        for (let y = 0; y < this.pointsPerTrail; y++) {
            const pxIndex = (y * w + index) * 4;
            this.historyData[pxIndex] = startPos.x;
            this.historyData[pxIndex + 1] = startPos.y;
            this.historyData[pxIndex + 2] = startPos.z;
            this.historyData[pxIndex + 3] = 1.0;
        }

        // Trigger full texture update (slow but infrequent)
        this.historyTexture.needsUpdate = true;
    }

    /**
     * Updates all trails.
     * @param renderer The WebGLRenderer (needed for texSubImage2D)
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
            this._tempVec.setFromMatrixPosition(trail.target.matrixWorld);

            // Write to update buffer at index 'trail.index'
            const offset = trail.index * 4;
            this.updateRowBuffer[offset] = this._tempVec.x;
            this.updateRowBuffer[offset + 1] = this._tempVec.y;
            this.updateRowBuffer[offset + 2] = this._tempVec.z;
            this.updateRowBuffer[offset + 3] = 1.0;
        }

        // Perform partial texture update
        this.uploadTextureRow(renderer, this.globalHead, this.updateRowBuffer);
    }

    /**
     * Uploads a single row to the texture using raw GL calls.
     */
    private uploadTextureRow(renderer: THREE.WebGLRenderer, rowIndex: number, data: Float32Array): void {
        const gl = renderer.getContext();
        const textureProperties = renderer.properties.get(this.historyTexture) as { __webglTexture?: WebGLTexture };

        // Ensure texture is initialized on GPU
        if (!textureProperties || !textureProperties.__webglTexture) {
             // If not yet uploaded by Three.js (first frame?), force full update
             // This happens if we haven't rendered yet.
             // But update() is called inside animate loop.
             // We can just rely on needsUpdate=true from init?
             return;
        }

        // Use Three.js state manager to avoid state thrashing
        // Note: Must pass raw WebGLTexture, not the Three.js Texture object
        renderer.state.bindTexture(gl.TEXTURE_2D, textureProperties.__webglTexture);

        // Update ROW 'rowIndex'.
        // Layout: Width = MaxTrails, Height = Points.
        // x = 0, y = rowIndex, width = MaxTrails, height = 1.
        // Data should be 'MaxTrails * 4' floats.

        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0, // Level
            0, // X offset
            rowIndex, // Y offset
            this.maxTrails, // Width
            1, // Height
            gl.RGBA, // Format
            gl.FLOAT, // Type
            data // Data
        );
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
        this.trails = [];
    }
}
