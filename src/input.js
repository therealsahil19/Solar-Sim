import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Sets up the OrbitControls.
 * @param {THREE.Camera} camera
 * @param {HTMLElement} domElement
 * @returns {OrbitControls}
 */
export function setupControls(camera, domElement) {
    const controls = new OrbitControls(camera, domElement);
    controls.enableDamping = true; // Add damping for smoother experience
    controls.dampingFactor = 0.05;
    return controls;
}

/**
 * Sets up user interaction (Raycasting, Keyboard, UI).
 * @param {Object} context - The context object containing references.
 * @param {THREE.Camera} context.camera
 * @param {THREE.Scene} context.scene
 * @param {HTMLElement} context.rendererDomElement
 * @param {Array<THREE.Object3D>} context.interactionTargets
 * @param {Object} context.state - Global state object (e.g., { useTextures: boolean })
 * @param {Object} callbacks - Callback functions for actions.
 * @param {Function} callbacks.onToggleCamera
 * @param {Function} callbacks.onToggleTexture
 */
export function setupInteraction(context, callbacks) {
    const { camera, rendererDomElement, interactionTargets } = context;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Click Listener (Raycasting)
    window.addEventListener('click', (event) => {
        // We use window.innerWidth/Height because the renderer covers the full window
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        const intersects = raycaster.intersectObjects(interactionTargets, false);

        for (let i = 0; i < intersects.length; i++) {
            if (intersects[i].object.userData.name) {
                const name = intersects[i].object.userData.name;
                console.log("Planet clicked:", name);

                const toast = document.getElementById('toast');
                toast.textContent = `Selected: ${name}`;
                toast.classList.add('visible');

                if (toast.timeout) clearTimeout(toast.timeout);
                toast.timeout = setTimeout(() => toast.classList.remove('visible'), 2000);
                break;
            }
        }
    });

    // Keyboard Listener ('C' key)
    window.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'c') {
            callbacks.onToggleCamera();
        }
    });

    // UI Buttons
    const btnCamera = document.getElementById('btn-camera');
    if (btnCamera) {
        btnCamera.addEventListener('click', callbacks.onToggleCamera);
    }

    const btnTexture = document.getElementById('btn-texture');
    if (btnTexture) {
        btnTexture.addEventListener('click', () => {
             // Pass the button element so the callback can update text
             callbacks.onToggleTexture(btnTexture);
        });
    }
}
