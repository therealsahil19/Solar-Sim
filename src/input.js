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
 * @param {Function} callbacks.onTogglePause - Function to toggle pause state (accepts button element).
 * @param {Function} callbacks.onFocusPlanet - Function to focus camera on a planet (index).
 * @param {Function} callbacks.onResetCamera - Function to reset camera view.
 * @param {Function} callbacks.onSetFocus - Function to focus/follow a specific mesh.
 * @param {Function} callbacks.onUpdateTimeScale - Function to update simulation speed.
 * @param {Function} callbacks.onObjectSelected - Function to notify main state of selection.
 * @returns {Object} Helper functions for external use (e.g., updating UI).
 */
export function setupInteraction(context, callbacks) {
    const { camera, rendererDomElement, interactionTargets } = context;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    /**
     * Updates the user interface (Toast & Info Panel) with details about the selected object.
     * @param {THREE.Object3D} mesh - The selected mesh containing userData.
     */
    function updateSelectionUI(mesh) {
        if (!mesh) return;
        const d = mesh.userData;

        // Update Toast
        let text = `Selected: ${d.name}`;
        if (d.type && d.size !== undefined) {
            text += ` (${d.type})`;
        }
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = text;
            toast.classList.add('visible');
            if (toast.timeout) clearTimeout(toast.timeout);
            toast.timeout = setTimeout(() => toast.classList.remove('visible'), 2000);
        }

        // Update Info Panel
        const panel = document.getElementById('info-panel');
        if (panel) {
            document.getElementById('info-name').textContent = d.name;
            document.getElementById('info-type').textContent = d.type || 'Unknown Type';
            document.getElementById('info-desc').textContent = d.description || 'No description available.';
            document.getElementById('info-radius').textContent = d.size ? `Radius: ${d.size.toFixed(2)} x Earth` : 'Radius: -';
            document.getElementById('info-distance').textContent = d.distance ? `Orbit Radius: ${d.distance} units` : 'Orbit Radius: 0';

            // Re-bind Follow Button
            const btnFollow = document.getElementById('btn-follow');
            // Clone node to remove old listeners
            const newBtn = btnFollow.cloneNode(true);
            btnFollow.parentNode.replaceChild(newBtn, btnFollow);

            newBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent re-triggering scene click
                callbacks.onSetFocus(mesh);
            });

            panel.style.display = 'block';
        }
    }

    // Click & Double-Click Logic
    let lastClickTime = 0;
    const doubleClickDelay = 300; // ms

    rendererDomElement.addEventListener('pointerup', (event) => {
        // Only process left clicks
        if (event.button !== 0) return;

        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        const intersects = raycaster.intersectObjects(interactionTargets, false);

        if (intersects.length > 0) {
            const hit = intersects[0]; // Closest object
            const mesh = hit.object;
            const userData = mesh.userData;

            if (userData.name) {
                // Determine if it's a double click
                const currentTime = Date.now();
                const isDoubleClick = (currentTime - lastClickTime) < doubleClickDelay;
                lastClickTime = currentTime;

                // 1. Select Object (Single Click Behavior)
                // Notify Main
                callbacks.onObjectSelected(mesh);
                // Update UI
                updateSelectionUI(mesh);

                // 2. Double Click Behavior
                if (isDoubleClick) {
                    callbacks.onSetFocus(mesh);
                }
            }
        } else {
             // Optional: Deselect logic if desired
             // const infoPanel = document.getElementById('info-panel');
             // if (infoPanel) infoPanel.style.display = 'none';
        }
    });

    // Keyboard Listener
    window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if (document.activeElement.tagName === 'INPUT') return;

        if (key === 'c') {
            callbacks.onToggleCamera();
        } else if (key === ' ' || key === 'spacebar') {
             const btn = document.getElementById('btn-pause');
             callbacks.onTogglePause(btn);
        } else if (key === 'escape') {
            callbacks.onResetCamera();
            const panel = document.getElementById('info-panel');
            if (panel) panel.style.display = 'none';
        } else {
            // Check for number keys 1-9
            const num = parseInt(key);
            if (!isNaN(num) && num >= 1 && num <= 9) {
                callbacks.onFocusPlanet(num - 1); // 0-indexed
            }
        }
    });

    // UI Buttons Binding
    const btnCamera = document.getElementById('btn-camera');
    if (btnCamera) btnCamera.addEventListener('click', callbacks.onToggleCamera);

    const btnTexture = document.getElementById('btn-texture');
    if (btnTexture) btnTexture.addEventListener('click', () => callbacks.onToggleTexture(btnTexture));

    const btnReset = document.getElementById('btn-reset');
    if (btnReset) btnReset.addEventListener('click', callbacks.onResetCamera);

    const btnPause = document.getElementById('btn-pause');
    if (btnPause) btnPause.addEventListener('click', () => callbacks.onTogglePause(btnPause));

    const sliderSpeed = document.getElementById('slider-speed');
    if (sliderSpeed) {
        sliderSpeed.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            callbacks.onUpdateTimeScale(val);
        });
    }

    return {
        updateSelectionUI
    };
}
