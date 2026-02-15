import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

/**
 * Data structure for label collision detection.
 */
interface LabelCollisionData {
    label: CSS2DObject;
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
}

/**
 * Manages 2D labels in the 3D scene, providing:
 * 1. **Frustum Culling**: Skipping labels outside the view.
 * 2. **Edge Fading**: Smoothly fading labels near screen edges.
 * 3. **Spatial Hashing Collision Detection**: Hiding overlapping labels on mobile.
 * 4. **Z-Order Management**: Ensuring labels stay behind the bodies they represent.
 */
export class LabelManager {
    private renderer: CSS2DRenderer;
    private camera: THREE.Camera;
    private labels: CSS2DObject[] = [];

    // Configuration
    private edgeMargin = 40;
    private fadeZone = 60;
    private approxLabelWidth = 100;
    private approxLabelHeight = 20;
    private opacityUpdateThreshold = 0.001;
    private mobileBreakpoint = 768;

    // State
    private showLabels = true;
    private needsUpdate = true;
    private tempVec = new THREE.Vector3();

    // Optimization structures
    private visibleLabelsList: LabelCollisionData[] = [];
    private labelPool: LabelCollisionData[] = [];
    private labelGrid: LabelCollisionData[][] = [];
    private labelGridCols = 0;
    private labelGridRows = 0;

    /**
     * Creates a new LabelManager.
     * @param renderer - The CSS2DRenderer instance.
     * @param camera - The active camera.
     */
    constructor(renderer: CSS2DRenderer, camera: THREE.Camera) {
        this.renderer = renderer;
        this.camera = camera;
    }

    /**
     * Adds a label to be managed.
     */
    public add(label: CSS2DObject): void {
        this.labels.push(label);
        this.needsUpdate = true;
    }

    /**
     * Removes a label from management.
     */
    public remove(label: CSS2DObject): void {
        const index = this.labels.indexOf(label);
        if (index > -1) {
            this.labels.splice(index, 1);
            this.needsUpdate = true;
        }
    }

    /**
     * Toggles global visibility of all labels.
     */
    public toggle(show: boolean): void {
        this.showLabels = show;
        this.needsUpdate = true;
        this.labels.forEach(label => {
            label.visible = this.showLabels;
        });
    }

    /**
     * Returns whether labels are globally visible.
     */
    public isVisible(): boolean {
        return this.showLabels;
    }

    /**
     * Signals that labels need a position/collision update.
     */
    public setLabelsNeedUpdate(): void {
        this.needsUpdate = true;
    }

    /**
     * Main update loop for labels.
     * Handles visibility, culling, projected positions, and collision.
     * 
     * @param focusTarget - The currently focused body (unhides its moons).
     * @param selectedObject - The currently selected body (unhides its moons).
     */
    public update(
        focusTarget: THREE.Object3D | null,
        selectedObject: THREE.Object3D | null
    ): void {
        if (!this.showLabels && !this.needsUpdate) return;
        if (!this.renderer) return;

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        this.visibleLabelsList.length = 0;
        let labelPoolIndex = 0;

        // 1. Create Frustum for culling
        const frustum = new THREE.Frustum();
        const projScreenMatrix = new THREE.Matrix4();
        projScreenMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(projScreenMatrix);

        const len = this.labels.length;
        for (let i = 0; i < len; i++) {
            const label = this.labels[i];
            if (!label) continue;

            // Logic: Moons only show if their parent is focused or selected
            if (label.userData.isMoon) {
                const parentName = label.userData.parentPlanet;
                const isParentFocused = focusTarget?.userData.name === parentName;
                const isParentSelected = selectedObject?.userData.name === parentName;
                label.visible = this.showLabels && (isParentFocused || isParentSelected);
            } else {
                label.visible = this.showLabels;
            }

            if (label.visible && label.element) {
                // Use World Position for accurate culling and projection
                label.getWorldPosition(this.tempVec);

                // Frustum Culling: Skip expensive projection if off-screen
                if (!frustum.containsPoint(this.tempVec)) {
                    continue;
                }

                // Project 3D position to 2D screen coordinates (NDC: -1 to +1)
                this.tempVec.project(this.camera);

                const x = (this.tempVec.x * 0.5 + 0.5) * viewportWidth;
                const y = (-(this.tempVec.y * 0.5) + 0.5) * viewportHeight;

                // Approximate bounding box centered on the point
                const left = x - (this.approxLabelWidth / 2);
                const right = x + (this.approxLabelWidth / 2);
                const top = y - (this.approxLabelHeight / 2);
                const bottom = y + (this.approxLabelHeight / 2);

                let opacity = 1;

                // Edge Fading Logic
                const distLeft = left;
                const distRight = viewportWidth - right;
                const distTop = top;
                const distBottom = viewportHeight - bottom;
                const minDist = Math.min(distLeft, distRight, distTop, distBottom);

                // Check if behind camera (NDC z > 1) or inside margin
                if (this.tempVec.z > 1 || minDist < this.edgeMargin) {
                    opacity = 0;
                } else if (minDist < this.edgeMargin + this.fadeZone) {
                    opacity = (minDist - this.edgeMargin) / this.fadeZone;
                }

                const lastOpacity = label.userData._lastOpacity ?? -1;
                const isMobile = viewportWidth < this.mobileBreakpoint;

                // Only run expensive collision check on mobile or for non-moons
                const isCollisionCandidate = isMobile && opacity > 0 && !label.userData.isMoon;

                if (isCollisionCandidate) {
                    label.userData._tentativeOpacity = opacity;

                    let item = this.labelPool[labelPoolIndex];
                    if (!item) {
                        item = {
                            label,
                            x: left,
                            y: top,
                            width: this.approxLabelWidth,
                            height: this.approxLabelHeight,
                            z: this.tempVec.z
                        };
                        this.labelPool[labelPoolIndex] = item;
                    } else {
                        item.label = label;
                        item.x = left;
                        item.y = top;
                        item.width = this.approxLabelWidth;
                        item.height = this.approxLabelHeight;
                        item.z = this.tempVec.z;
                    }

                    this.visibleLabelsList.push(item);
                    labelPoolIndex++;
                } else {
                    // Apply opacity immediately to avoid flickering
                    if (Math.abs(lastOpacity - opacity) > this.opacityUpdateThreshold) {
                        label.element.style.opacity = String(opacity);
                        label.userData._lastOpacity = opacity;
                    }
                }
            }
        }

        // 2. Spatial Grid Collision Detection for visible candidates
        if (viewportWidth < this.mobileBreakpoint && this.visibleLabelsList.length > 0) {
            this.runCollisionDetection(viewportWidth, viewportHeight);
        }

        this.needsUpdate = false;
    }

    /**
     * Helper to get linear index for spatial grid cell.
     */
    private getGridIndex(c: number, r: number): number {
        if (c < 0 || c >= this.labelGridCols || r < 0 || r >= this.labelGridRows) return -1;
        return r * this.labelGridCols + c;
    }

    /**
     * Resolves label overlaps using a spatial grid.
     */
    private runCollisionDetection(viewportWidth: number, viewportHeight: number): void {
        // Sort by Z-depth (front-to-back: Painter's algorithm in reverse for labels)
        this.visibleLabelsList.sort((a, b) => a.z - b.z);

        const cellWidth = this.approxLabelWidth;
        const cellHeight = this.approxLabelHeight;
        const neededCols = Math.ceil(viewportWidth / cellWidth);
        const neededRows = Math.ceil(viewportHeight / cellHeight);

        // Resize grid if window resized
        if (neededCols !== this.labelGridCols || neededRows !== this.labelGridRows) {
            this.labelGridCols = neededCols;
            this.labelGridRows = neededRows;
            this.labelGrid = new Array(this.labelGridCols * this.labelGridRows);
            for (let i = 0; i < this.labelGrid.length; i++) {
                this.labelGrid[i] = [];
            }
        } else {
            // Clear existing grid efficiently
            for (let i = 0; i < this.labelGrid.length; i++) {
                this.labelGrid[i].length = 0;
            }
        }

        for (const item of this.visibleLabelsList) {
            const startCol = Math.max(0, Math.floor(item.x / cellWidth));
            const endCol = Math.min(this.labelGridCols - 1, Math.floor((item.x + item.width) / cellWidth));
            const startRow = Math.max(0, Math.floor(item.y / cellHeight));
            const endRow = Math.min(this.labelGridRows - 1, Math.floor((item.y + item.height) / cellHeight));

            let isBlocked = false;

            // Check grid cells for existing (higher-priority) labels
            for (let r = startRow; r <= endRow; r++) {
                for (let c = startCol; c <= endCol; c++) {
                    const idx = this.getGridIndex(c, r);
                    if (idx !== -1) {
                        const cell = this.labelGrid[idx];
                        for (const other of cell) {
                            if (this.checkOverlap(item, other)) {
                                isBlocked = true;
                                break;
                            }
                        }
                    }
                    if (isBlocked) break;
                }
                if (isBlocked) break;
            }

            if (isBlocked) {
                // Only update opacity if it changed significantly
                if (item.label.userData._lastOpacity !== 0) {
                    item.label.element.style.opacity = '0';
                    item.label.userData._lastOpacity = 0;
                }
            } else {
                const opacity = item.label.userData._tentativeOpacity ?? 1;
                if (Math.abs((item.label.userData._lastOpacity ?? -1) - opacity) > this.opacityUpdateThreshold) {
                    item.label.element.style.opacity = String(opacity);
                    item.label.userData._lastOpacity = opacity;
                }

                // Add to grid cells that this label occupies
                for (let r = startRow; r <= endRow; r++) {
                    for (let c = startCol; c <= endCol; c++) {
                        const idx = this.getGridIndex(c, r);
                        if (idx !== -1) {
                            this.labelGrid[idx].push(item);
                        }
                    }
                }
            }
        }
    }

    /**
     * Standard AABB overlap check.
     */
    private checkOverlap(a: LabelCollisionData, b: LabelCollisionData): boolean {
        return (
            a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y
        );
    }
}
