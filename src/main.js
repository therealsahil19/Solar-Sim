/**
 * @file main.js
 * @description The "Conductor" module for the Solar System simulation.
 * It orchestrates the initialization of the 3D scene, manages the render loop,
 * handles global state (scene, camera, renderer), and coordinates interaction between modules.
 *
 * This module is responsible for:
 * 1. Initializing Three.js core components (Scene, Camera, Renderer).
 * 2. Setting up lighting and loading assets.
 * 3. Fetching configuration data (`system.json`).
 * 4. Delegating object creation to `procedural.js`.
 * 5. Delegating input handling to `input.js`.
 * 6. Running the main animation loop.
 */

import * as THREE from 'three';
import { createStarfield, createSun, createPlayerShip, createSystem } from './procedural.js';
import { setupControls, setupInteraction } from './input.js';

// ============================================================================
// State & Globals
// ============================================================================

/** @type {Array<{pivot?: THREE.Object3D, mesh?: THREE.Mesh, speed?: number, rotationSpeed?: number}>} */
const animatedObjects = [];

/** @type {Array<THREE.Object3D>} Optimization for raycasting - only check these objects */
const interactionTargets = [];

/** @type {Array<THREE.Mesh>} List of primary planets for keyboard shortcuts */
const planets = [];

/** @type {THREE.Group|null} Reference to the player ship */
let playerShip;

/** @type {OrbitControls|null} Reference to the camera controls */
let controls;

/** @type {THREE.Scene} The Three.js scene */
let scene;

/** @type {THREE.PerspectiveCamera} The main camera */
let camera;

/** @type {THREE.WebGLRenderer} The renderer */
let renderer;

/** @type {boolean} Global state for texture usage */
let useTextures = true;

/** @type {boolean} Global state for camera mode (false = Overview, true = Chase) */
let isShipView = false;

/** @type {boolean} Global state for pause */
let isPaused = false;

/** @type {number} Global time scale factor */
let timeScale = 1.0;

/** @type {THREE.Object3D|null} The object currently being followed by the camera */
let focusTarget = null;

/** @type {THREE.Object3D|null} The currently selected object (for UI) */
let selectedObject = null;

/** @type {Object|null} Reference to input helpers (for UI updates) */
let interactionHelpers = null;

// Expose globals for testing
window.scene = null;
window.playerShip = null;
window.controls = null;
window.isPaused = isPaused;

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initializes the 3D application.
 * Sets up the scene, camera, renderer, lighting, and loads assets.
 * Also fetches system configuration and starts the animation loop.
 * @returns {Promise<void>}
 */
async function init() {
    // 1. Setup Basic Three.js Components
    scene = new THREE.Scene();
    window.scene = scene; // Expose to window

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 40, 80);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.setAttribute('role', 'application');
    renderer.domElement.setAttribute('aria-label', '3D Solar System Simulation');
    document.body.appendChild(renderer.domElement);

    // 2. Lighting
    const pointLight = new THREE.PointLight(0xffffff, 2, 300);
    scene.add(pointLight);
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    // 3. Loading Manager & Texture Loader
    const loadingScreen = document.getElementById('loading-screen');
    const loadingBar = document.getElementById('loading-bar');
    const manager = new THREE.LoadingManager();

    manager.onProgress = function ( url, itemsLoaded, itemsTotal ) {
        if (loadingBar) {
            const width = (itemsLoaded / itemsTotal) * 100;
            loadingBar.style.width = width + '%';
        }
    };
    manager.onLoad = function ( ) {
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';

                // Show onboarding hint at the bottom center
                const hint = document.getElementById('onboarding-hint');
                if (hint) {
                    hint.classList.add('visible');
                    // Hide hint after 5.5 seconds
                    setTimeout(() => {
                        hint.classList.remove('visible');
                        hint.classList.add('hidden');
                    }, 5500);
                }
            }, 500);
        }
    };

    const textureLoader = new THREE.TextureLoader(manager);

    // 4. Create Initial Objects (Procedural)
    // Starfield
    const stars = createStarfield();
    scene.add(stars);

    // Sun
    const sun = createSun(textureLoader, useTextures);
    scene.add(sun);
    interactionTargets.push(sun); // Make sun clickable

    // Player Ship
    playerShip = createPlayerShip();
    scene.add(playerShip);
    window.playerShip = playerShip; // Expose to window

    // 5. Load System Data & Generate Planets
    try {
        const response = await fetch('system.json');
        const planetData = await response.json();

        planetData.forEach(planetConfig => {
            const systemNode = createSystem(planetConfig, textureLoader, useTextures);

            // Add top-level components to scene
            scene.add(systemNode.pivot);
            if (systemNode.orbit) {
                scene.add(systemNode.orbit);
            }

            // Aggregate interaction and animation targets
            interactionTargets.push(...systemNode.interactables);
            animatedObjects.push(...systemNode.animated);

            // Track primary planets (assuming system.json is flat list of planets)
            // The first interactable in the returned list is the main body of the system
            if (systemNode.interactables.length > 0) {
                planets.push(systemNode.interactables[0]);
            }
        });

    } catch (error) {
        console.error("Failed to load system data:", error);
    }

    // 6. Setup Controls & Input
    controls = setupControls(camera, renderer.domElement);
    window.controls = controls; // Expose to window

    const context = {
        camera,
        scene,
        rendererDomElement: renderer.domElement,
        interactionTargets,
        state: { useTextures } // Passing state reference if needed
    };

    const callbacks = {
        onToggleCamera: toggleCameraView,
        onToggleTexture: toggleTextures,
        onTogglePause: togglePause,
        onFocusPlanet: focusPlanet, // Legacy keyboard shortcut
        onResetCamera: resetCamera,
        onSetFocus: setFocusTarget,
        onUpdateTimeScale: updateTimeScale,
        onObjectSelected: handleObjectSelection
    };

    interactionHelpers = setupInteraction(context, callbacks);

    // 7. Start Loop
    animate();
}

// ============================================================================
// Logic Helpers
// ============================================================================

/**
 * Toggles the camera view between 'Overview' (OrbitControls centered on origin)
 * and 'Chase' (locked behind PlayerShip).
 */
function toggleCameraView() {
    isShipView = !isShipView;
    if (isShipView) {
        // Enable Chase Cam -> Disable Focus Mode
        focusTarget = null;
        if (playerShip) {
            controls.target.copy(playerShip.position);
            camera.position.set(
                playerShip.position.x + 5,
                playerShip.position.y + 3,
                playerShip.position.z + 5
            );
        }
    } else {
        // Disable Chase Cam -> Default to Overview (0,0,0)
        controls.target.set(0, 0, 0);
        camera.position.set(0, 40, 80);
    }
    controls.update();
}

/**
 * Resets the camera to the default Sun view.
 */
function resetCamera() {
    isShipView = false;
    focusTarget = null;
    controls.target.set(0, 0, 0);
    camera.position.set(0, 40, 80);
    controls.update();
    showToast("View Reset");
}

/**
 * Sets the camera focus target to a specific object.
 * @param {THREE.Object3D} mesh - The object to follow.
 */
function setFocusTarget(mesh) {
    focusTarget = mesh;
    isShipView = false; // Disable ship view
    showToast(`Following ${mesh.userData.name}`);
}

/**
 * Updates the global time scale.
 * @param {number} scale - The new time scale.
 */
function updateTimeScale(scale) {
    timeScale = scale;
}

/**
 * Toggles between High Definition (Textured) and Low Definition (Solid Color) materials.
 * Updates the button text and displays a toast notification.
 * @param {HTMLElement} [btnElement] - The button element to update the text of (optional).
 */
function toggleTextures(btnElement) {
    useTextures = !useTextures;

    // Update Button Text
    if (btnElement) {
        btnElement.textContent = useTextures ? "HD" : "LD";
    }

    // Update Materials
    interactionTargets.forEach(mesh => {
        if (useTextures && mesh.userData.texturedMaterial) {
            mesh.material = mesh.userData.texturedMaterial;
        } else if (!useTextures && mesh.userData.solidMaterial) {
            mesh.material = mesh.userData.solidMaterial;
        }
    });

    // Toast
    showToast(`Textures: ${useTextures ? "ON" : "OFF"}`);
}

/**
 * Toggles the pause state.
 * @param {HTMLElement} [btnElement] - The button element to update.
 */
function togglePause(btnElement) {
    isPaused = !isPaused;
    window.isPaused = isPaused; // Update exposed global

    if (btnElement) {
        btnElement.textContent = isPaused ? "▶" : "⏸";
    }

    showToast(isPaused ? "Paused" : "Resumed");
}

/**
 * Focuses the camera on a specific planet by index (Keyboard Shortcut).
 * @param {number} index - The index of the planet in the planets array.
 */
function focusPlanet(index) {
    if (index < 0 || index >= planets.length) return;

    const planet = planets[index];
    // Re-use the general focus logic
    setFocusTarget(planet);
    handleObjectSelection(planet); // Update state

    // Explicitly update UI via helper
    if (interactionHelpers && interactionHelpers.updateSelectionUI) {
        interactionHelpers.updateSelectionUI(planet);
    }
}

/**
 * Handles object selection (updates UI state).
 * @param {THREE.Object3D} mesh - The selected object.
 */
function handleObjectSelection(mesh) {
    selectedObject = mesh;
    // Note: The UI population happens in input.js currently,
    // but main.js holds the reference for dynamic updates in animate().
}

/**
 * Helper to show toast messages.
 * @param {string} message - The message to display.
 */
function showToast(message) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = message;
        toast.classList.add('visible');
        if (toast.timeout) clearTimeout(toast.timeout);
        toast.timeout = setTimeout(() => toast.classList.remove('visible'), 2000);
    }
}

const tempVec = new THREE.Vector3();
const sunPos = new THREE.Vector3(0, 0, 0);

/**
 * The main animation loop.
 * Updates object rotations, ship orientation, and renders the scene.
 * Recursively calls `requestAnimationFrame`.
 */
function animate() {
    requestAnimationFrame(animate);

    // 1. Update Rotations (only if not paused)
    if (!isPaused) {
        animatedObjects.forEach(obj => {
            if (obj.pivot) obj.pivot.rotation.y += obj.speed * timeScale;
            if (obj.mesh) obj.mesh.rotation.y += obj.rotationSpeed * timeScale;
        });
    }

    // 2. Camera Logic
    if (isShipView && playerShip) {
        // Chase Cam
        controls.target.copy(playerShip.position);
        camera.position.set(
            playerShip.position.x + 5,
            playerShip.position.y + 3,
            playerShip.position.z + 5
        );
    } else if (focusTarget) {
        // Focus Mode (Follow)
        const targetPos = new THREE.Vector3();
        focusTarget.getWorldPosition(targetPos);

        // Smoothly lerp target for better feel, or just snap
        // Snapping ensures no jitter at high speeds
        controls.target.copy(targetPos);
    }

    // 3. Update Ship Orientation (Face nearest object)
    if (playerShip && animatedObjects.length > 0) {
        let closestDist = Infinity;
        let closestObj = null;
        const shipPos = playerShip.position;

        animatedObjects.forEach(obj => {
            if (obj.mesh) {
                obj.mesh.getWorldPosition(tempVec);
                const dist = shipPos.distanceToSquared(tempVec);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestObj = obj.mesh;
                }
            }
        });

        if (closestObj) {
            closestObj.getWorldPosition(tempVec);
            playerShip.lookAt(tempVec);
        }
    }

    // 4. Update Dynamic UI (Info Panel)
    if (selectedObject) {
        const distEl = document.getElementById('info-dist-sun');
        if (distEl) {
            selectedObject.getWorldPosition(tempVec);
            const dist = tempVec.distanceTo(sunPos);
            // Assuming 1 unit = 1 million km or similar relative scale
            // Just displaying the raw unit for now or formatting it
            distEl.textContent = `Dist to Sun: ${dist.toFixed(1)} units`;
        }
    }

    // 5. Render
    if (controls) controls.update();
    if (renderer && scene && camera) renderer.render(scene, camera);
}

// Handle Resize
window.addEventListener('resize', () => {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
});

// Kickoff
init();
