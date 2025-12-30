/**
 * @file input.js
 * @description Manages user input and interaction for the simulation.
 *
 * This module handles:
 * 1. Camera controls (OrbitControls).
 * 2. Raycasting for mouse clicks on 3D objects.
 * 3. Keyboard shortcuts (e.g., 'C' for camera toggle).
 * 4. UI event listeners (Buttons).
 *
 * It uses dependency injection to access the Scene, Camera, and other context
 * without relying on global variables.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Sets up the OrbitControls for the camera.
 * @param {THREE.Camera} camera - The active camera.
 * @param {HTMLElement} domElement - The DOM element to attach controls to (renderer canvas).
 * @returns {OrbitControls} The configured OrbitControls instance.
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
 * @param {THREE.Camera} context.camera - The active camera for raycasting.
 * @param {THREE.Scene} context.scene - The scene (unused in this function but usually part of context).
 * @param {HTMLElement} context.rendererDomElement - The canvas element.
 * @param {Array<THREE.Object3D>} context.interactionTargets - List of objects to check for clicks.
 * @param {Object} context.state - Global state object (e.g., { useTextures: boolean }).
 * @param {Object} callbacks - Callback functions for actions.
 * @param {Function} callbacks.onToggleCamera - Function to toggle camera mode.
 * @param {Function} callbacks.onToggleTexture - Function to toggle textures (accepts button element).
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
