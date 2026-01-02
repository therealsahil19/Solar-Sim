/**
 * @file input.js
 * @description Manages user input and interaction for the simulation.
 *
 * This module handles:
 * 1. Camera controls (OrbitControls).
 * 2. Raycasting for mouse clicks on 3D objects.
 * 3. Keyboard shortcuts (e.g., 'C' for camera toggle).
 * 4. UI event listeners (Buttons).
 * 5. Component Initialization (CommandPalette, NavigationSidebar, InfoPanel, Modal).
 *
 * It uses dependency injection to access the Scene, Camera, and other context
 * without relying on global variables.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CommandPalette } from './components/CommandPalette.js';
import { NavigationSidebar } from './components/NavigationSidebar.js';
import { InfoPanel } from './components/InfoPanel.js';
import { Modal } from './components/Modal.js'; // Import Modal
import { ThemeManager } from './managers/ThemeManager.js';

/**
 * Sets up the OrbitControls for the camera.
 * @param {THREE.Camera} camera - The active camera.
 * @param {HTMLElement} domElement - The DOM element to attach controls to (renderer canvas).
 * @returns {OrbitControls} The configured OrbitControls instance.
 */
export function setupControls(camera, domElement) {
    const controls = new OrbitControls(camera, domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 5;
    return controls;
}

/**
 * Initializes all user interaction handlers.
 *
 * @param {Object} context - The context object containing references to the Scene and state.
 * @param {Object} callbacks - Object containing functions to trigger state changes in `main.js`.
 * @returns {Object} Interaction helpers and lifecycle methods.
 */
export function setupInteraction(context, callbacks) {
    const { camera, rendererDomElement, interactionTargets } = context;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // --- Component Initialization ---

    // 1. Theme Manager
    const themeManager = new ThemeManager();

    // 2. Info Panel
    const infoPanel = new InfoPanel({
        callbacks: {
            onFollow: (mesh) => callbacks.onSetFocus(mesh)
        }
    });

    // 3. Navigation Sidebar
    let sidebar = null;
    if (context.planetData) {
        sidebar = new NavigationSidebar({
            planetData: context.planetData,
            callbacks: {
                onSelect: (name) => selectByName(name),
                onClose: () => { /* handled internally by component, but good to have hook */ }
            }
        });
    }

    /**
     * Updates the Side Panel and Toast with details about the selected object.
     * Delegates to the InfoPanel component.
     */
    function updateSelectionUI(mesh) {
        if (!mesh) return;

        // Update Toast (Legacy lightweight feedback, keep for "Palette" visual)
        const d = mesh.userData;
        let text = `Selected: ${d.name}`;
        if (d.type && d.size !== undefined) {
            text += ` (${d.type}) – ${d.size.toFixed(2)} × Earth size`;
        }
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = text;
            toast.classList.add('visible');
            if (toast.timeout) clearTimeout(toast.timeout);
            toast.timeout = setTimeout(() => toast.classList.remove('visible'), 2000);
        }

        // Update Component
        infoPanel.update(mesh);
    }

    // --- Navigation Helpers ---

    function findMeshByName(name) {
        // 1. Standard Objects
        const found = interactionTargets.find(obj => obj.userData.name === name);
        if (found) return found;

        // 2. Instanced Objects
        if (context.instanceRegistry) {
            return context.instanceRegistry.findInstanceByName(name);
        }
        return null;
    }

    function selectByName(name) {
        const mesh = findMeshByName(name);
        if (mesh) {
            callbacks.onSetFocus(mesh);
            callbacks.onObjectSelected(mesh);
            updateSelectionUI(mesh);
        } else {
            console.warn(`Mesh not found for: ${name}`);
        }
    }

    // --- Interaction Logic (Raycasting) ---

    let lastClickTime = 0;
    let lastClickedMeshId = null;
    const doubleClickDelay = 300;

    // Cached values to prevent layout thrashing
    let width = window.innerWidth;
    let height = window.innerHeight;

    const onWindowResize = () => {
        width = window.innerWidth;
        height = window.innerHeight;
    };
    window.addEventListener('resize', onWindowResize);

    const onPointerUp = (event) => {
        if (event.button !== 0) return;

        mouse.x = (event.clientX / width) * 2 - 1;
        mouse.y = -(event.clientY / height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(interactionTargets, false);

        if (intersects.length > 0) {
            const hit = intersects[0];
            let mesh = hit.object;
            let userData = mesh.userData;

            // Handle InstancedMesh
            if (mesh.isInstancedMesh && context.instanceRegistry) {
                const data = context.instanceRegistry.getIntersectionData(mesh, hit.instanceId);
                if (data) {
                    userData = data;
                    const group = context.instanceRegistry.groups.get(mesh.userData.registryKey);
                    if (group) {
                        mesh = group.instances[hit.instanceId].pivot;
                    }
                }
            }

            if (userData && userData.name) {
                const currentTime = Date.now();
                const isSameObject = lastClickedMeshId === mesh.uuid;
                const isDoubleClick = isSameObject && (currentTime - lastClickTime) < doubleClickDelay;

                lastClickTime = currentTime;
                lastClickedMeshId = mesh.uuid;

                callbacks.onObjectSelected(mesh);
                updateSelectionUI(mesh);

                if (isDoubleClick) {
                    callbacks.onSetFocus(mesh);
                }
            }
        }
    };
    rendererDomElement.addEventListener('pointerup', onPointerUp);

    // --- Modal Logic (Refactored to use Modal class) ---
    const welcomeModal = new Modal('welcome-modal', {
        onClose: () => {
            // Optional: Actions when closed
        }
    });

    const btnHelp = document.getElementById('btn-help');

    function openModal() {
        if (welcomeModal) welcomeModal.open();
    }
    function closeModal() {
        if (welcomeModal) welcomeModal.close();
    }

    if (btnHelp) btnHelp.addEventListener('click', openModal);

    // --- Command Palette ---
    let commandPalette = null;
    if (context.planetData) {
        const paletteCallbacks = {
            ...callbacks,
            onSelectByName: selectByName,
            openModal: openModal,
            onToggleTheme: () => {
                const next = themeManager.cycleTheme();
                const toast = document.getElementById('toast');
                if (toast) {
                    toast.textContent = `Theme: ${next.toUpperCase()}`;
                    toast.classList.add('visible');
                    setTimeout(() => toast.classList.remove('visible'), 2000);
                }
            }
        };
        commandPalette = new CommandPalette(context.planetData, paletteCallbacks);
    }

    // --- Global Shortcuts ---
    const onKeyDown = (e) => {
        const key = e.key.toLowerCase();
        if (document.activeElement.tagName === 'INPUT') return;

        if (key === 'c') callbacks.onToggleCamera();
        else if (key === 'l') callbacks.onToggleLabels();
        else if (key === 'o') callbacks.onToggleOrbits();
        else if (key === 't') {
            const btn = document.getElementById('btn-texture');
            callbacks.onToggleTexture(btn);
        } else if (key === ' ' || key === 'spacebar') {
            const btn = document.getElementById('btn-pause');
            callbacks.onTogglePause(btn);
        } else if (key === 'escape') {
            callbacks.onResetCamera();
            infoPanel.hide();
        } else {
            const num = parseInt(key);
            if (!isNaN(num) && num >= 1 && num <= 9) {
                callbacks.onFocusPlanet(num - 1);
            }
        }
    };
    window.addEventListener('keydown', onKeyDown);

    // --- UI Button Binding ---
    const onToggleTextureHandler = () => callbacks.onToggleTexture(document.getElementById('btn-texture'));
    const onPauseHandler = () => callbacks.onTogglePause(document.getElementById('btn-pause'));
    const onSpeedHandler = (e) => {
        const val = parseFloat(e.target.value);
        callbacks.onUpdateTimeScale(val);
        const valStr = val.toFixed(1);
        const speedValue = document.getElementById('speed-value');
        if (speedValue) speedValue.textContent = valStr + 'x';
        e.target.setAttribute('aria-valuenow', val);
        e.target.setAttribute('aria-valuetext', valStr + 'x');
    };

    const btnCamera = document.getElementById('btn-camera');
    if (btnCamera) btnCamera.addEventListener('click', callbacks.onToggleCamera);

    const btnTexture = document.getElementById('btn-texture');
    if (btnTexture) btnTexture.addEventListener('click', onToggleTextureHandler);

    const btnReset = document.getElementById('btn-reset');
    if (btnReset) btnReset.addEventListener('click', callbacks.onResetCamera);

    const btnPause = document.getElementById('btn-pause');
    if (btnPause) btnPause.addEventListener('click', onPauseHandler);

    const btnLabels = document.getElementById('btn-labels');
    if (btnLabels) btnLabels.addEventListener('click', callbacks.onToggleLabels);

    const btnOrbits = document.getElementById('btn-orbits');
    if (btnOrbits) btnOrbits.addEventListener('click', callbacks.onToggleOrbits);

    const sliderSpeed = document.getElementById('slider-speed');
    if (sliderSpeed) sliderSpeed.addEventListener('input', onSpeedHandler);

    const btnHelpHandler = openModal;

    return {
        updateSelectionUI,
        openModal,
        closeModal,
        dispose: () => {
            rendererDomElement.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('resize', onWindowResize);

            if (btnCamera) btnCamera.removeEventListener('click', callbacks.onToggleCamera);
            if (btnTexture) btnTexture.removeEventListener('click', onToggleTextureHandler);
            if (btnReset) btnReset.removeEventListener('click', callbacks.onResetCamera);
            if (btnPause) btnPause.removeEventListener('click', onPauseHandler);
            if (btnLabels) btnLabels.removeEventListener('click', callbacks.onToggleLabels);
            if (btnOrbits) btnOrbits.removeEventListener('click', callbacks.onToggleOrbits);
            if (sliderSpeed) sliderSpeed.removeEventListener('input', onSpeedHandler);
            if (btnHelp) btnHelp.removeEventListener('click', btnHelpHandler);

            // Clean up components if they have dispose methods
            if (commandPalette && commandPalette.destroy) commandPalette.destroy();
            if (welcomeModal && welcomeModal.dispose) welcomeModal.dispose(); // Dispose Modal
        }
    };
}
