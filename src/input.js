/**
 * @file input.js
 * @description Manages user input and interaction for the simulation.
 *
 * This module handles:
 * 1. Camera controls (OrbitControls).
 * 2. Raycasting for mouse clicks on 3D objects.
 * 3. Keyboard shortcuts (e.g., 'C' for camera toggle).
 * 4. UI event listeners (Buttons).
 * 5. Command Palette initialization.
 * 6. Theme Manager initialization.
 *
 * It uses dependency injection to access the Scene, Camera, and other context
 * without relying on global variables.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CommandPalette } from './components/CommandPalette.js';
import { ThemeManager } from './managers/ThemeManager.js';

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
 * Initializes all user interaction handlers.
 *
 * **Architecture Pattern**: Dependency Injection.
 * Instead of importing globals, this module receives all necessary dependencies (`context`)
 * and action handlers (`callbacks`) as arguments. This decouples the Input logic from the Core logic.
 *
 * @param {Object} context - The context object containing references to the Scene and state.
 * @param {THREE.Camera} context.camera - The active camera for raycasting.
 * @param {THREE.Scene} context.scene - The scene (unused in this function but usually part of context).
 * @param {HTMLElement} context.rendererDomElement - The canvas element.
 * @param {Array<THREE.Object3D>} context.interactionTargets - List of objects to check for clicks.
 * @param {Object} context.state - Global state object (e.g., { useTextures: boolean }).
 * @param {InstanceRegistry} context.instanceRegistry - Registry for instanced meshes.
 * @param {Array} context.planetData - The hierarchical system configuration data.
 * @param {Object} callbacks - Object containing functions to trigger state changes in `main.js`.
 * @param {Function} callbacks.onToggleCamera - Function to toggle camera mode.
 * @param {Function} callbacks.onToggleTexture - Function to toggle textures (accepts button element).
 * @param {Function} callbacks.onTogglePause - Function to toggle pause state (accepts button element).
 * @param {Function} callbacks.onFocusPlanet - Function to focus camera on a planet (index).
 * @param {Function} callbacks.onResetCamera - Function to reset camera view.
 * @param {Function} callbacks.onSetFocus - Function to focus/follow a specific mesh.
 * @param {Function} callbacks.onUpdateTimeScale - Function to update simulation speed.
 * @param {Function} callbacks.onObjectSelected - Function to notify main state of selection.
 * @param {Function} callbacks.onToggleLabels - Function to toggle visibility of labels.
 * @param {Function} callbacks.onToggleOrbits - Function to toggle visibility of orbits.
 * @returns {Object} Helper functions for external use (e.g., by `main.js` or `CommandPalette`):
 *  - `updateSelectionUI(mesh)`: Manually triggers the selection UI update for a mesh.
 *  - `openModal()`: Opens the welcome/help modal.
 *  - `closeModal()`: Closes the welcome/help modal.
 *  - `dispose()`: Cleans up event listeners.
 */
export function setupInteraction(context, callbacks) {
    const { camera, rendererDomElement, interactionTargets, instanceRegistry } = context;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    /**
     * Updates the Side Panel and Toast with details about the selected object.
     *
     * @param {THREE.Object3D} mesh - The selected mesh containing metadata in `userData`.
     * Required properties: `name`, `type`, `description`.
     * Optional properties: `size`, `distance`.
     */
    function updateSelectionUI(mesh) {
        if (!mesh) return;
        const d = mesh.userData;

        // Update Toast
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

            // Ensure panel is visible (flex for Palette layout)
            panel.classList.add('visible');
        }
    }

    // --- Navigation Helpers ---

    /**
     * Finds a mesh by its name.
     * Handles both standard `THREE.Mesh` objects and instanced objects via `InstanceRegistry`.
     *
     * @param {string} name - The case-sensitive name of the object.
     * @returns {THREE.Object3D|null} The found object (or pivot for instances), or null.
     */
    function findMeshByName(name) {
        // 1. Search in standard interaction targets (Sun, Non-instanced objects)
        const found = interactionTargets.find(obj => obj.userData.name === name);
        if (found) return found;

        // 2. Search in Instance Registry (for Moons/Asteroids that are instances)
        if (context.instanceRegistry) {
            return context.instanceRegistry.findInstanceByName(name);
        }

        return null;
    }

    /**
     * High-level helper to Select and Focus an object by name.
     * Used by the Navigation Sidebar and Command Palette.
     *
     * @param {string} name - The name of the object.
     */
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

    // Click & Double-Click Logic
    let lastClickTime = 0;
    let lastClickedMeshId = null; // Fix: Track the last clicked object to prevent cross-object double clicks
    const doubleClickDelay = 300; // ms

    const onPointerUp = (event) => {
        // Only process left clicks
        if (event.button !== 0) return;

        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        const intersects = raycaster.intersectObjects(interactionTargets, false);

        if (intersects.length > 0) {
            const hit = intersects[0]; // Closest object
            let mesh = hit.object;
            let userData = mesh.userData;

            // Bolt Support: Handle InstancedMesh
            if (mesh.isInstancedMesh && context.instanceRegistry) {
                // Use the registry to get the actual userData for this instance
                const data = context.instanceRegistry.getIntersectionData(mesh, hit.instanceId);
                if (data) {
                    userData = data;
                    // We can't really "select" the instance mesh itself as a focus target in the same way
                    // unless focus logic supports it.
                    // But we can create a proxy object or just pass the UserData and let main handle logic?
                    // Currently 'onSetFocus' expects a mesh with matrixWorld.
                    // The 'pivot' in registry has matrixWorld.
                    // So we should retrieve the pivot!
                    const group = context.instanceRegistry.groups.get(mesh.userData.registryKey);
                    if (group) {
                         mesh = group.instances[hit.instanceId].pivot; // Use the pivot as the "selected object"
                    }
                }
            }

            if (userData && userData.name) {
                // Determine if it's a double click
                const currentTime = Date.now();
                const isSameObject = lastClickedMeshId === mesh.uuid;
                const isDoubleClick = isSameObject && (currentTime - lastClickTime) < doubleClickDelay;

                lastClickTime = currentTime;
                lastClickedMeshId = mesh.uuid;

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
        }
    };
    rendererDomElement.addEventListener('pointerup', onPointerUp);

    // Modal Interaction (Palette's Onboarding)
    const welcomeModal = document.getElementById('welcome-modal');
    const btnHelp = document.getElementById('btn-help');
    const btnStart = document.getElementById('btn-start');

    /**
     * Opens the welcome/help modal.
     */
    function openModal() {
        if (welcomeModal && !welcomeModal.open) {
            welcomeModal.showModal(); // Built-in dialog method handles focus trap
        }
    }

    /**
     * Closes the welcome/help modal.
     */
    function closeModal() {
        if (welcomeModal) {
            welcomeModal.close();
        }
    }

    if (btnHelp) {
        btnHelp.addEventListener('click', () => {
            openModal();
        });
    }

    if (btnStart) {
        btnStart.addEventListener('click', () => {
            closeModal();
        });
    }

    // --- Initialize Theme Manager ---
    const themeManager = new ThemeManager();

    // --- Initialize Command Palette ---
    let commandPalette = null;
    // We pass an augmented callbacks object
    if (context.planetData) {
        const paletteCallbacks = {
            ...callbacks,
            onSelectByName: selectByName,
            openModal: openModal,
            onToggleTheme: () => {
                const next = themeManager.cycleTheme();
                // Optional: Toast for theme switch
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

    // Keyboard Listener
    const onKeyDown = (e) => {
        const key = e.key.toLowerCase();

        // Ignore if typing in an input (Command Palette handles its own, this is for other inputs)
        // Command Palette overlay prevents this listener from firing on map interaction if it traps focus?
        // Actually, window listener fires anyway. We check activeElement.
        if (document.activeElement.tagName === 'INPUT') return;

        if (key === 'c') {
            callbacks.onToggleCamera();
        } else if (key === 'l') {
            callbacks.onToggleLabels();
        } else if (key === 'o') {
            callbacks.onToggleOrbits();
        } else if (key === 't') {
            const btn = document.getElementById('btn-texture');
            callbacks.onToggleTexture(btn);
        } else if (key === ' ' || key === 'spacebar') {
             const btn = document.getElementById('btn-pause');
             callbacks.onTogglePause(btn);
        } else if (key === 'escape') {
            callbacks.onResetCamera();
            const panel = document.getElementById('info-panel');
            if (panel) panel.classList.remove('visible');
        } else {
            // Check for number keys 1-9
            const num = parseInt(key);
            if (!isNaN(num) && num >= 1 && num <= 9) {
                callbacks.onFocusPlanet(num - 1); // 0-indexed
            }
        }
    };
    window.addEventListener('keydown', onKeyDown);

    // UI Buttons Binding
    // Use named handlers to allow removal on dispose

    const onToggleTextureHandler = () => callbacks.onToggleTexture(btnTexture);
    const onPauseHandler = () => callbacks.onTogglePause(btnPause);
    const onSpeedHandler = (e) => {
        const val = parseFloat(e.target.value);
        callbacks.onUpdateTimeScale(val);
        const valStr = val.toFixed(1);
        if (speedValue) speedValue.textContent = valStr + 'x';
        sliderSpeed.setAttribute('aria-valuenow', val);
        sliderSpeed.setAttribute('aria-valuetext', valStr + 'x');
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
    const speedValue = document.getElementById('speed-value');
    if (sliderSpeed) {
        sliderSpeed.addEventListener('input', onSpeedHandler);
    }

    // --- Navigation Sidebar Logic ---

    /**
     * Recursively builds the navigation tree DOM structure.
     * This creates a nested `<ul>` hierarchy mirroring the solar system structure.
     *
     * @param {HTMLElement} container - The DOM container for the current level.
     * @param {Array} items - The list of planet/moon data objects for this level.
     */
    function buildNavTree(container, items) {
        const ul = document.createElement('ul');
        ul.className = 'nav-ul';

        items.forEach(itemData => {
            const li = document.createElement('li');
            li.className = 'nav-li';

            const btn = document.createElement('button');
            btn.className = 'nav-btn';

            // Icon based on type
            let icon = '🌑'; // Default
            if (itemData.type === 'Planet') icon = '🪐';
            if (itemData.type === 'Star') icon = '☀️';
            if (itemData.type === 'Moon') icon = '🌑';

            // Secure DOM creation (Prevent XSS)
            const spanName = document.createElement('span');
            spanName.textContent = `${icon} ${itemData.name}`;

            const spanType = document.createElement('span');
            spanType.className = 'nav-type';
            spanType.textContent = itemData.type;

            btn.appendChild(spanName);
            btn.appendChild(document.createTextNode(' ')); // Space
            btn.appendChild(spanType);

            // Click Handler
            btn.addEventListener('click', () => {
                selectByName(itemData.name);
            });

            li.appendChild(btn);

            // Recursion for Moons
            if (itemData.moons && itemData.moons.length > 0) {
                const subContainer = document.createElement('div');
                subContainer.className = 'nav-sublist';
                buildNavTree(subContainer, itemData.moons);
                li.appendChild(subContainer);
            }

            ul.appendChild(li);
        });

        container.appendChild(ul);
    }

    /**
     * Initializes the Sidebar Navigation.
     * Populates the list, sets up the Search filter, and binds toggle buttons.
     *
     * @param {Array} planetData - The full hierarchical system configuration data.
     */
    function initNavigation(planetData) {
        const navList = document.getElementById('nav-list');
        const btnPlanets = document.getElementById('btn-planets');
        const sidebar = document.getElementById('nav-sidebar');
        const btnCloseNav = document.getElementById('btn-close-nav');

        if (!navList || !sidebar) return;

        // Clear Skeleton State (important for Palette upgrade)
        navList.innerHTML = '';

        // 1. Manual Entry: Sun
        // Use a dummy data object for the Sun since it's not in system.json
        const sunData = [{ name: 'Sun', type: 'Star', moons: [] }];
        buildNavTree(navList, sunData);

        // 2. System Data
        if (planetData) {
            buildNavTree(navList, planetData);
        }

        // Toggle Logic
        function toggleSidebar(show) {
            // 'show' is boolean: true=show (aria-hidden=false), false=hide (aria-hidden=true)
            // If show is undefined, toggle current state
            const isHidden = sidebar.getAttribute('aria-hidden') === 'true';
            const shouldShow = show !== undefined ? show : isHidden;

            sidebar.setAttribute('aria-hidden', String(!shouldShow));
        }

        if (btnPlanets) {
            btnPlanets.addEventListener('click', () => toggleSidebar(true));
        }
        if (btnCloseNav) {
            btnCloseNav.addEventListener('click', () => toggleSidebar(false));
        }

        // Search Logic
        const navSearch = document.getElementById('nav-search');
        if (navSearch) {
            navSearch.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase().trim();
                const items = navList.querySelectorAll('.nav-li');

                // Hide everything first if term exists
                if (!term) {
                    items.forEach(li => li.style.display = '');
                    return;
                }

                // First pass: Mark matches
                items.forEach(li => {
                    const btn = li.querySelector('.nav-btn');
                    const text = btn.textContent.toLowerCase();
                    const isMatch = text.includes(term);
                    li.dataset.matches = isMatch ? 'true' : 'false';
                    li.style.display = 'none'; // Default to hidden
                });

                // Second pass: Show matches and their parents
                items.forEach(li => {
                    if (li.dataset.matches === 'true') {
                        // Show self
                        li.style.display = '';

                        // Show parents (walk up)
                        let parent = li.parentElement;
                        while (parent && parent !== navList) {
                            if (parent.classList.contains('nav-sublist')) {
                                parent.style.display = ''; // Ensure sublist container is visible
                                // The sublist is inside a .nav-li
                                const parentLi = parent.parentElement;
                                if (parentLi && parentLi.classList.contains('nav-li')) {
                                    parentLi.style.display = '';
                                }
                            }
                            parent = parent.parentElement;
                        }
                    }
                });
            });
        }
    }

    // Call init immediately if data is present in context
    if (context.planetData) {
        initNavigation(context.planetData);
    }

    // Note: Cleanup for event listeners is handled in the dispose function below.
    // Listeners are tracked either by named references or manual removal logic.

    const onHelpHandler = () => openModal();
    const onStartHandler = () => closeModal();
    const onPlanetsHandler = () => { /* toggleSidebar(true) logic needs to be accessible */ };
    // Accessing local functions inside initNavigation is tricky.
    // The previous code attached them inside initNavigation.

    // For the scope of this fix, let's focus on the main listeners reported in the bug:
    // 1. pointerup on rendererDomElement
    // 2. UI buttons (btnCamera, etc.)
    // 3. window resize (handled in main.js, but listed in bug 012 as input.js?)
    // Bug 012 says: "src/input.js: The pointerup listener on rendererDomElement is never removed." and "UI buttons".

    // Since I cannot rewrite the whole file easily to extract every anonymous function without breaking the flow,
    // I will focus on the ones that are accessible or easy to make accessible.

    // Better approach for anonymous listeners in this context:
    // Use AbortController? No, compatibility.
    // Just clone and replace the element? Brutal but effective for buttons.
    // But 'pointerup' is critical on the canvas.

    return {
        updateSelectionUI,
        openModal,
        closeModal,
        dispose: () => {
             // 1. Remove Pointer Up
             rendererDomElement.removeEventListener('pointerup', onPointerUp);

             // 2. Remove Window Keydown
             window.removeEventListener('keydown', onKeyDown);

             // 3. UI Buttons
             // Since we used anonymous functions for some, we can't remove them via removeEventListener.
             // However, if the DOM elements are destroyed (e.g. page reload), it doesn't matter.
             // But if this is a SPA transition, the elements might persist.
             // A common pattern to clear listeners from elements you don't own the lifecycle of
             // is to clone them. But that strips ALL listeners.

             if (btnCamera) btnCamera.removeEventListener('click', callbacks.onToggleCamera);
             if (btnReset) btnReset.removeEventListener('click', callbacks.onResetCamera);
             if (btnLabels) btnLabels.removeEventListener('click', callbacks.onToggleLabels);
             if (btnOrbits) btnOrbits.removeEventListener('click', callbacks.onToggleOrbits);
             if (btnTexture) btnTexture.removeEventListener('click', onToggleTextureHandler);
             if (btnPause) btnPause.removeEventListener('click', onPauseHandler);
             if (sliderSpeed) sliderSpeed.removeEventListener('input', onSpeedHandler);

             // 4. Command Palette
             if (commandPalette && commandPalette.destroy) {
                commandPalette.destroy();
             }
        }
    };
}
