import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

interface LabelCollisionData {
    label: CSS2DObject;
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
}

export class LabelManager {
    private renderer: CSS2DRenderer;
    private camera: THREE.Camera;
    private labels: CSS2DObject[] = [];

    // Config
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

    constructor(renderer: CSS2DRenderer, camera: THREE.Camera) {
        this.renderer = renderer;
        this.camera = camera;
    }

    public add(label: CSS2DObject): void {
        this.labels.push(label);
        this.needsUpdate = true;
    }

    public remove(label: CSS2DObject): void {
        const index = this.labels.indexOf(label);
        if (index > -1) {
            this.labels.splice(index, 1);
            this.needsUpdate = true;
        }
    }

    public toggle(show: boolean): void {
        this.showLabels = show;
        this.needsUpdate = true;
        this.labels.forEach(label => { label.visible = this.showLabels; });
    }

    public isVisible(): boolean {
        return this.showLabels;
    }

    public setLabelsNeedUpdate(): void {
        this.needsUpdate = true;
    }

    public update(
        focusTarget: THREE.Object3D | null,
        selectedObject: THREE.Object3D | null
    ): void {
        if ((!this.showLabels && !this.needsUpdate) || !this.renderer) return;

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        this.visibleLabelsList.length = 0;
        let labelPoolIndex = 0;

        // Create Frustum for culling
        const frustum = new THREE.Frustum();
        const projScreenMatrix = new THREE.Matrix4();
        projScreenMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(projScreenMatrix);

        const len = this.labels.length;
        for (let i = 0; i < len; i++) {
            const label = this.labels[i];
            if (!label) continue;

            if (label.userData.isMoon) {
                const parentName = label.userData.parentPlanet;
                const isParentFocused = focusTarget?.userData.name === parentName;
                const isParentSelected = selectedObject?.userData.name === parentName;
                label.visible = this.showLabels && (isParentFocused || isParentSelected);
            } else {
                label.visible = this.showLabels;
            }

            if (label.visible && label.element) {
                // Fix: Use World Position, not local position
                label.getWorldPosition(this.tempVec);

                // Frustum Culling
                if (!frustum.containsPoint(this.tempVec)) {
                    // Optional: We could set label.visible = false here, 
                    // but CSS2DRenderer might override or it might flicker.
                    // Simply skipping the expensive layout logic is enough optimization.
                    continue;
                }

                // Project 3D position to 2D screen coordinates
                this.tempVec.project(this.camera); // Now in NDC (-1 to +1)

                const x = (this.tempVec.x * .5 + .5) * viewportWidth;
                const y = (-(this.tempVec.y * .5) + .5) * viewportHeight;

                // Approximate bounding box centered on the point
                const left = x - (this.approxLabelWidth / 2);
                const right = x + (this.approxLabelWidth / 2);
                const top = y - (this.approxLabelHeight / 2);
                const bottom = y + (this.approxLabelHeight / 2);

                let opacity = 1;

                // Edge Fading Logic using projected coordinates
                const distLeft = left;
                const distRight = viewportWidth - right;
                const distTop = top;
                const distBottom = viewportHeight - bottom;
                const minDist = Math.min(distLeft, distRight, distTop, distBottom);

                // Check if behind camera (NDC z > 1)
                if (this.tempVec.z > 1) {
                    opacity = 0;
                } else if (minDist < this.edgeMargin) {
                    opacity = 0;
                } else if (minDist < this.edgeMargin + this.fadeZone) {
                    opacity = (minDist - this.edgeMargin) / this.fadeZone;
                }

                // Bolt Optimization: Prevent Layout Thrashing
                const lastOpacity = label.userData._lastOpacity ?? -1;
                const isMobile = viewportWidth < this.mobileBreakpoint;
                const isCandidate = isMobile && opacity > 0 && !label.userData.isMoon;

                if (isCandidate) {
                    // Defer application until collision check
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
                    // Apply immediately
                    if (Math.abs(lastOpacity - opacity) > this.opacityUpdateThreshold) {
                        label.element.style.opacity = String(opacity);
                        label.userData._lastOpacity = opacity;
                    }
                }
            }
        }

        // Bolt Optimization: Spatial Grid Collision Detection
        if (viewportWidth < this.mobileBreakpoint) {
            this.runCollisionDetection(viewportWidth, viewportHeight);
        }

        this.needsUpdate = false;
    }

    private runCollisionDetection(viewportWidth: number, viewportHeight: number): void {
        // 1. Sort by Z-depth
        this.visibleLabelsList.sort((a, b) => a.z - b.z);

        const cellWidth = this.approxLabelWidth;
        const cellHeight = this.approxLabelHeight;
        const neededCols = Math.ceil(viewportWidth / cellWidth);
        const neededRows = Math.ceil(viewportHeight / cellHeight);

        if (neededCols !== this.labelGridCols || neededRows !== this.labelGridRows) {
            this.labelGridCols = neededCols;
            this.labelGridRows = neededRows;
            this.labelGrid = new Array(this.labelGridCols * this.labelGridRows).fill(null).map(() => []);
        } else {
            // Clear existing grid
            for (let i = 0; i < this.labelGrid.length; i++) {
                const cell = this.labelGrid[i];
                if (cell) cell.length = 0;
            }
        }

        const getGridIndex = (c: number, r: number) => {
            if (c < 0 || c >= this.labelGridCols || r < 0 || r >= this.labelGridRows) return -1;
            return r * this.labelGridCols + c;
        };

        for (const item of this.visibleLabelsList) {
            const startCol = Math.floor(item.x / cellWidth);
            const endCol = Math.floor((item.x + item.width) / cellWidth);
            const startRow = Math.floor(item.y / cellHeight);
            const endRow = Math.floor((item.y + item.height) / cellHeight);

            let isBlocked = false;

            // Check neighbor cells
            for (let r = startRow; r <= endRow; r++) {
                for (let c = startCol; c <= endCol; c++) {
                    const idx = getGridIndex(c, r);
                    if (idx !== -1) {
                        const cell = this.labelGrid[idx];
                        // Brute force check within cell (usually very few items)
                        if (cell) {
                            for (const other of cell) {
                                if (this.checkOverlap(item, other)) {
                                    isBlocked = true;
                                    break;
                                }
                            }
                        }
                    }
                    if (isBlocked) break;
                }
                if (isBlocked) break;
            }

            if (isBlocked) {
                // Hide it
                if (item.label.userData._lastOpacity !== 0) {
                    item.label.element.style.opacity = '0';
                    item.label.userData._lastOpacity = 0;
                }
            } else {
                // Show it (using tentative opacity calculated earlier)
                const opacity = item.label.userData._tentativeOpacity ?? 1;
                if (Math.abs((item.label.userData._lastOpacity ?? -1) - opacity) > this.opacityUpdateThreshold) {
                    item.label.element.style.opacity = String(opacity);
                    item.label.userData._lastOpacity = opacity;
                }

                // Add to grid
                for (let r = startRow; r <= endRow; r++) {
                    for (let c = startCol; c <= endCol; c++) {
                        const idx = getGridIndex(c, r);
                        if (idx !== -1) {
                            this.labelGrid[idx]?.push(item);
                        }
                    }
                }
            }
        }
    }

    private checkOverlap(a: LabelCollisionData, b: LabelCollisionData): boolean {
        return (
            a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y
        );
    }
}
