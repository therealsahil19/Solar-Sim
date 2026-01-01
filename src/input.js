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
 * Sets up user interaction (Raycasting, Keyboard, UI).
 * @param {Object} context - The context object containing references.
 * @param {THREE.Camera} context.camera - The active camera for raycasting.
 * @param {THREE.Scene} context.scene - The scene (unused in this function but usually part of context).
 * @param {HTMLElement} context.rendererDomElement - The canvas element.
 * @param {Array<THREE.Object3D>} context.interactionTargets - List of objects to check for clicks.
 * @param {Object} context.state - Global state object (e.g., { useTextures: boolean }).
 * @param {InstanceRegistry} context.instanceRegistry - Registry for instanced meshes.
 * @param {Array} context.planetData - The hierarchical system configuration data.
 * @param {Object} callbacks - Callback functions for actions.
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
 * @returns {Object} Helper functions for external use:
 *  - `updateSelectionUI(mesh)`: Manually triggers the selection UI update for a mesh.
 *  - `openModal()`: Opens the welcome/help modal.
 *  - `closeModal()`: Closes the welcome/help modal.
 */
export function setupInteraction(context, callbacks) {
    const { camera, rendererDomElement, interactionTargets, instanceRegistry } = context;
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
     * Finds a mesh by its name in either the interaction targets or the instance registry.
     * @param {string} name - The name of the object to find.
     * @returns {THREE.Object3D|null} The found object or null.
     */
    function findMeshByName(name) {
        // 1. Search in standard interaction targets (Sun, Non-instanced objects)
        const found = interactionTargets.find(obj => obj.userData.name === name);
        if (found) return found;

        // 2. Search in Instance Registry
        if (context.instanceRegistry) {
            return context.instanceRegistry.findInstanceByName(name);
        }

        return null;
    }

    /**
     * Selects an object by name and focuses on it.
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
        }
    });

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
        new CommandPalette(context.planetData, paletteCallbacks);
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
    const btnCamera = document.getElementById('btn-camera');
    if (btnCamera) btnCamera.addEventListener('click', callbacks.onToggleCamera);

    const btnTexture = document.getElementById('btn-texture');
    if (btnTexture) btnTexture.addEventListener('click', () => callbacks.onToggleTexture(btnTexture));

    const btnReset = document.getElementById('btn-reset');
    if (btnReset) btnReset.addEventListener('click', callbacks.onResetCamera);

    const btnPause = document.getElementById('btn-pause');
    if (btnPause) btnPause.addEventListener('click', () => callbacks.onTogglePause(btnPause));

    const btnLabels = document.getElementById('btn-labels');
    if (btnLabels) btnLabels.addEventListener('click', callbacks.onToggleLabels);

    const btnOrbits = document.getElementById('btn-orbits');
    if (btnOrbits) btnOrbits.addEventListener('click', callbacks.onToggleOrbits);

    const sliderSpeed = document.getElementById('slider-speed');
    const speedValue = document.getElementById('speed-value');
    if (sliderSpeed) {
        sliderSpeed.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            callbacks.onUpdateTimeScale(val);
            const valStr = val.toFixed(1);
            if (speedValue) speedValue.textContent = valStr + 'x';
            sliderSpeed.setAttribute('aria-valuenow', val);
            sliderSpeed.setAttribute('aria-valuetext', valStr + 'x');
        });
    }

    // --- Navigation Sidebar Logic ---
    // Recursively build the list
    /**
     * Recursively builds the navigation tree in the DOM.
     * @param {HTMLElement} container - The DOM container for the list.
     * @param {Array} items - The list of planet objects.
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

            // Secure DOM creation
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
     * Initializes the navigation sidebar.
     * @param {Array} planetData - The planet data to populate the sidebar with.
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

    return {
        updateSelectionUI,
        openModal,
        closeModal,
        dispose: () => {
             window.removeEventListener('keydown', onKeyDown);
        }
    };
}
