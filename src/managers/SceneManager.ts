/**
 * @file SceneManager.ts
 * @description Manages the core Three.js scene components: Scene, Camera, Renderer.
 */

import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';

export class SceneManager {
    public scene: THREE.Scene;
    public camera: THREE.PerspectiveCamera;
    public renderer: THREE.WebGLRenderer;
    public labelRenderer: CSS2DRenderer;

    constructor() {
        // Setup Three.js Components
        this.scene = new THREE.Scene();

        this.scene.matrixWorldAutoUpdate = false;

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100000);
        this.camera.position.set(0, 60, 100);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.renderer.domElement.setAttribute('role', 'application');
        this.renderer.domElement.setAttribute('aria-label', '3D Solar System Simulation');
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        // Label Renderer
        this.labelRenderer = new CSS2DRenderer();
        this.labelRenderer.domElement.style.position = 'absolute';
        this.labelRenderer.domElement.style.top = '0px';
        this.labelRenderer.domElement.style.pointerEvents = 'none';
        this.labelRenderer.setSize(window.innerWidth, window.innerHeight);

        // Append to DOM
        document.body.appendChild(this.renderer.domElement);
        document.body.appendChild(this.labelRenderer.domElement);
    }

    public dispose(): void {
        this.renderer.dispose();
        // labelRenderer doesn't have dispose in types usually, but we can remove element
        if (this.labelRenderer.domElement.parentNode) {
            this.labelRenderer.domElement.parentNode.removeChild(this.labelRenderer.domElement);
        }
        if (this.renderer.domElement.parentNode) {
            this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        }
    }

    public onResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    }
}
