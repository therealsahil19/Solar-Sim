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
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { createStarfield, createSun, createPlayerShip, createSystem } from './procedural.js';
import { createAsteroidBelt } from './debris.js';
import { setupControls, setupInteraction } from './input.js';
import { InstanceRegistry } from './instancing.js';
import { TrailManager } from './trails.js';

// ============================================================================
// State & Globals
// ============================================================================

/** @type {Array<{pivot?: THREE.Object3D, mesh?: THREE.Mesh, speed?: number, rotationSpeed?: number}>} */
export const animatedObjects = [];

/** @type {Array<THREE.Object3D>} Optimization for raycasting - only check these objects */
const interactionTargets = [];

/** @type {Array<THREE.Mesh>} List of primary planets for keyboard shortcuts */
const planets = [];

/** @type {Array<THREE.Line>} List of trail lines to update */
export const activeTrails = [];

// Lists for toggling visibility
const allOrbits = [];
const allTrails = [];
const allLabels = [];

/** @type {THREE.Group|null} Reference to the player ship */
let playerShip;

/** @type {THREE.Points|null} Reference to starfield */
let starfield;

/** @type {OrbitControls|null} Reference to the camera controls */
let controls;

/** @type {THREE.Scene} The Three.js scene */
export let scene;

/** @type {THREE.PerspectiveCamera} The main camera */
let camera;

/** @type {THREE.WebGLRenderer} The renderer */
let renderer;

/** @type {CSS2DRenderer} The label renderer */
let labelRenderer;

/** @type {boolean} Global state for texture usage */
let useTextures = true;

/** @type {boolean} Global state for camera mode (false = Overview, true = Chase) */
let isShipView = false;

/** @type {boolean} Global state for pause */
let isPaused = false;

/** @type {boolean} Global state for labels */
let showLabels = true;
let labelsNeedUpdate = true; // Optimization: Only render labels when visible or state changes

/** @type {boolean} Global state for orbits/trails */
let showOrbits = true;
/** @type {number} Global time scale factor */
let timeScale = 1.0;

/** @type {THREE.Object3D|null} The object currently being followed by the camera */
let focusTarget = null;

/** @type {THREE.Object3D|null} The currently selected object (for UI) */
let selectedObject = null;

/** @type {Object|null} Reference to input helpers (for UI updates) */
let interactionHelpers = null;

// Optimization state
let frameCount = 0;
let closestObjectCache = null;
let asteroidBelt = null; // Reference to asteroid belt for updates
let instanceRegistry = null; // Bolt Support
let trailManager = null; // Bolt Support

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
export async function init() {
    // 1. Setup Basic Three.js Components
    scene = new THREE.Scene();
    window.scene = scene; // Expose to window

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 40, 80);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap; // Bolt Optimization: PCF is faster than PCFSoft
    renderer.domElement.setAttribute('role', 'application');
    renderer.domElement.setAttribute('aria-label', '3D Solar System Simulation');
    document.body.appendChild(renderer.domElement);

    // Setup CSS2DRenderer for labels
    labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    labelRenderer.domElement.style.pointerEvents = 'none'; // Pass through clicks
    document.body.appendChild(labelRenderer.domElement);

    // 2. Lighting
    const pointLight = new THREE.PointLight(0xffffff, 1.5, 0, 0);
    pointLight.castShadow = true;
    // Bolt Optimization: Reduce shadow map size for performance
    pointLight.shadow.mapSize.width = 1024;
    pointLight.shadow.mapSize.height = 1024;
    pointLight.shadow.bias = -0.0001;
    scene.add(pointLight);

    const ambientLight = new THREE.AmbientLight(0x606060);
    scene.add(ambientLight);

    // 3. Loading Manager & Texture Loader
    const loadingScreen = document.getElementById('loading-screen');
    const loadingBar = document.getElementById('loading-bar');
    const manager = new THREE.LoadingManager();

    // State to track if assets have finished loading at least once
    let assetsLoaded = false;

    manager.onProgress = function ( url, itemsLoaded, itemsTotal ) {
        if (loadingBar) {
            const width = (itemsLoaded / itemsTotal) * 100;
            loadingBar.style.width = width + '%';
            loadingBar.setAttribute('aria-valuenow', Math.round(width));
        }
    };
    manager.onLoad = function ( ) {
        assetsLoaded = true;
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                loadingScreen.setAttribute('aria-hidden', 'true'); // A11y

                // Palette: Trigger Welcome Modal
                if (interactionHelpers && interactionHelpers.openModal) {
                    interactionHelpers.openModal();
                }
            }, 500);
        }
    };

    const textureLoader = new THREE.TextureLoader(manager);

    // Bolt Support: Init Registry
    instanceRegistry = new InstanceRegistry(scene);
    trailManager = new TrailManager(scene, 5000, 50); // 5000 trails, 50 points each (reduced from 100 for memory)

    // Hack: Attach to loader to pass through to recursive createSystem
    textureLoader.instanceRegistry = instanceRegistry;
    textureLoader.trailManager = trailManager;

    // 4. Create Initial Objects (Procedural)
    // Starfield (BufferGeometry, no texture)
    starfield = createStarfield();
    scene.add(starfield);

    // Sun
    const sun = createSun(textureLoader, useTextures);
    scene.add(sun);
    interactionTargets.push(sun); // Make sun clickable

    // Player Ship
    playerShip = createPlayerShip();
    scene.add(playerShip);
    window.playerShip = playerShip; // Expose to window

    // Bolt Optimization: Add GPU-accelerated Asteroid Belt (2000 objects)
    // This demonstrates the ability to handle scale (100x objects) without CPU overhead.
    asteroidBelt = createAsteroidBelt({ count: 2000, minRadius: 45, maxRadius: 60 });
    scene.add(asteroidBelt);

    // 5. Load System Data & Generate Planets
    let planetData = null; // Declare in outer scope of init
    try {
        // Bolt Support: Allow loading custom config for benchmarking
        const urlParams = new URLSearchParams(window.location.search);
        const configUrl = urlParams.get('config') || 'system.json';

        const response = await fetch(configUrl);
        planetData = await response.json();

        planetData.forEach(planetConfig => {
            const systemNode = createSystem(planetConfig, textureLoader, useTextures);

            // Add top-level components to scene
            scene.add(systemNode.pivot);
            if (systemNode.orbit) {
                scene.add(systemNode.orbit);
            }
            if (systemNode.trail) {
                scene.add(systemNode.trail);
            }

            // Aggregate interaction and animation targets
            interactionTargets.push(...systemNode.interactables);
            animatedObjects.push(...systemNode.animated);

            // Collect toggleable items
            allOrbits.push(...systemNode.orbits);
            allTrails.push(...systemNode.trails);
            allLabels.push(...systemNode.labels);

            // Collect trails for animation updates
            activeTrails.push(...systemNode.trails);

            // Track primary planets (assuming system.json is flat list of planets)
            // With instancing, interactables might be empty.
            // Bolt Support: Use the pivot (systemNode.pivot) as the target for focus shortcuts
            // The pivot contains the bodyGroup as a child, or is the parent of bodyGroup.
            // Actually, `systemNode.pivot` is the orbit center. `systemNode.animated[0].mesh` is the body group (pivot).
            // Let's use the object that holds the userData -> the instance pivot (bodyGroup).
            // systemNode.animated[0].mesh is `bodyGroup` in procedural.js now.
            if (systemNode.animated.length > 0) {
                 const primaryBody = systemNode.animated[0].mesh;
                 if (primaryBody) {
                     planets.push(primaryBody);
                 }
            }
        });

        // Bolt Support: Build Instances
        instanceRegistry.build();

        // Add instanced meshes to interaction targets
        instanceRegistry.groups.forEach(group => {
            if (group.mesh) {
                interactionTargets.push(group.mesh);
                // Also add to planets list if it's a planet type?
                // The current selection logic relies on raycasting, which works.
                // But the keyboard shortcuts (1-9) rely on 'planets' array.
                // We'll fix that separately or rely on 'Select' UI.
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
        instanceRegistry, // Bolt Support
        state: { useTextures }, // Passing state reference if needed
        planetData // Architect: Pass raw data for navigation builder
    };

    const callbacks = {
        onToggleCamera: toggleCameraView,
        onToggleTexture: toggleTextures,
        onTogglePause: togglePause,
        onFocusPlanet: focusPlanet, // Legacy keyboard shortcut
        onResetCamera: resetCamera,
        onSetFocus: setFocusTarget,
        onUpdateTimeScale: updateTimeScale,
        onObjectSelected: handleObjectSelection,
        onToggleLabels: toggleLabels,
        onToggleOrbits: toggleOrbits
    };

    interactionHelpers = setupInteraction(context, callbacks);

    // Initial Load Check:
    // If assets loaded VERY fast (before we got here), open the modal now.
    // If they load later, manager.onLoad will handle it.
    if (assetsLoaded && interactionHelpers.openModal) {
        interactionHelpers.openModal();
    }

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
    const btn = document.getElementById('btn-camera');
    if (btn) btn.setAttribute('aria-pressed', isShipView);

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
    const btn = document.getElementById('btn-camera');
    if (btn) btn.setAttribute('aria-pressed', 'false');

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
        btnElement.setAttribute('aria-pressed', useTextures);
    }

    // Update Materials
    interactionTargets.forEach(mesh => {
        if (useTextures && mesh.userData.texturedMaterial) {
            mesh.material = mesh.userData.texturedMaterial;
        } else if (!useTextures && mesh.userData.solidMaterial) {
            mesh.material = mesh.userData.solidMaterial;
        }
    });

    // Bolt Support: Update Instanced Meshes (Moons, etc.)
    if (instanceRegistry) {
        instanceRegistry.groups.forEach(group => {
            if (group.mesh && group.instances.length > 0) {
                // InstancedMesh shares one material for all instances.
                // We use the first instance's userData to find the material variants.
                const sampleUserData = group.instances[0].pivot.userData;

                if (useTextures && sampleUserData.texturedMaterial) {
                    group.mesh.material = sampleUserData.texturedMaterial;
                } else if (!useTextures && sampleUserData.solidMaterial) {
                    group.mesh.material = sampleUserData.solidMaterial;
                }
            }
        });
    }

    // Toast
    showToast(`Textures: ${useTextures ? "ON" : "OFF"}`);
}

/**
 * Toggles the visibility of planet text labels.
 * Updates the button opacity to reflect state.
 */
function toggleLabels() {
    showLabels = !showLabels;
    // Ensure we render at least one more frame to update visibility (hide/show)
    labelsNeedUpdate = true;

    const btn = document.getElementById('btn-labels');
    if (btn) {
        btn.setAttribute('aria-pressed', showLabels);
    }

    allLabels.forEach(label => {
        label.visible = showLabels;
    });

    showToast(`Labels: ${showLabels ? "ON" : "OFF"}`);
}

/**
 * Toggles the visibility of orbit lines and trails.
 * Updates the button opacity to reflect state.
 */
function toggleOrbits() {
    showOrbits = !showOrbits;
    const btn = document.getElementById('btn-orbits');
    if (btn) {
        btn.setAttribute('aria-pressed', showOrbits);
    }

    allOrbits.forEach(orbit => orbit.visible = showOrbits);
    allTrails.forEach(trail => trail.visible = showOrbits);

    showToast(`Orbits: ${showOrbits ? "ON" : "OFF"}`);
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
        btnElement.setAttribute('aria-label', isPaused ? "Resume Simulation" : "Pause Simulation");
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

    if (!isPaused) {
        // 1. Update Rotations
        animatedObjects.forEach(obj => {
            if (obj.pivot) obj.pivot.rotation.y += obj.speed * timeScale;
            if (obj.mesh) obj.mesh.rotation.y += obj.rotationSpeed * timeScale;
        });

        // Bolt Support: Update Instances
        if (instanceRegistry) {
            // FIX: Ensure world matrices are up-to-date before updating instances.
            // This prevents "One Frame Lag" where instances render at the previous frame's location.
            scene.updateMatrixWorld();
            instanceRegistry.update();
        }

        // Bolt Optimization: Update Asteroid Belt via Uniform (GPU)
        if (asteroidBelt && asteroidBelt.userData.timeUniform) {
            // Update time based on global time scale
            // We use a separate accumulator if timeScale varies, but for now simple increment works
            asteroidBelt.userData.timeUniform.value += 0.001 * timeScale;
        }

        // 2. Starfield Rotation
        if (starfield) {
            starfield.rotation.y += 0.0003;
        }
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
        // Bolt Optimization: Use optimized matrix read
        targetPos.setFromMatrixPosition(focusTarget.matrixWorld);

        // Smoothly lerp target for better feel, or just snap
        // Snapping ensures no jitter at high speeds
        controls.target.copy(targetPos);
    }

    // 3. Update Ship Orientation (Face nearest object)
    if (playerShip && animatedObjects.length > 0) {
        // Bolt Optimization: Throttle the search for the nearest object to reduce matrix updates
        // Frequency tuned to 10 frames (approx 6/sec) for responsiveness
        if (frameCount % 10 === 0) {
            let closestDist = Infinity;
            let closestObj = null;
            const shipPos = playerShip.position;

            animatedObjects.forEach(obj => {
                if (obj.mesh) {
                    // Bolt Optimization: use matrixWorld instead of forcing update
                    tempVec.setFromMatrixPosition(obj.mesh.matrixWorld);

                    const dist = shipPos.distanceToSquared(tempVec);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestObj = obj.mesh;
                    }
                }
            });
            closestObjectCache = closestObj;
        }

        if (closestObjectCache) {
            // Bolt Optimization: use matrixWorld
            tempVec.setFromMatrixPosition(closestObjectCache.matrixWorld);
            playerShip.lookAt(tempVec);
        }
    }

    // Always increment frameCount to ensure UI throttling works even if ship logic is skipped
    frameCount++;

    // 4. Update Dynamic UI (Info Panel)
    // Bolt Optimization: Throttle UI updates to avoid DOM thrashing (every 10 frames).
    // Updating the DOM every frame is expensive and unnecessary for human perception.
    if (selectedObject && frameCount % 10 === 0) {
        const distEl = document.getElementById('info-dist-sun');
        if (distEl) {
             // Bolt Optimization: use matrixWorld
            tempVec.setFromMatrixPosition(selectedObject.matrixWorld);
            const dist = tempVec.distanceTo(sunPos);
            // Assuming 1 unit = 1 million km or similar relative scale
            // Just displaying the raw unit for now or formatting it
            distEl.textContent = `Dist to Sun: ${dist.toFixed(1)} units`;
        }
    }

    // 5. Render
    if (controls) controls.update();
    if (renderer && scene && camera) {
        renderer.render(scene, camera);

        // Bolt Optimization: Skip label rendering if labels are hidden and cleanup is done
        if (showLabels || labelsNeedUpdate) {
            labelRenderer.render(scene, camera);
            if (!showLabels) labelsNeedUpdate = false;
        }
    }

    // 6. Post-Render Updates (Trails)
    // Bolt Optimization: Update trails AFTER render.
    // This allows for reading the updated matrices from the render pass
    // without forcing a synchronous updateWorldMatrix() call.
    // The trails will be 1 frame behind visually, which is imperceptible at high FPS.
    // Bolt Optimization: Throttle trail updates to every 2 frames
    if (!isPaused && showOrbits && frameCount % 2 === 0) {
        // Bolt Support: Update Unified Manager
        if (trailManager) {
            trailManager.update();
        }

        // Legacy trails (if any)
        activeTrails.forEach(trail => {
            const target = trail.userData.target;
            if (!target) return;

            // Bolt Optimization: Read from cached matrix
            tempVec.setFromMatrixPosition(target.matrixWorld);
            const positions = trail.userData.positions;

            // Shift positions: This is a simple O(N) shift.
            // copyWithin is a high-performance typed array method that moves memory blocks
            // much faster than a manual loop. We shift data right by 3 floats (1 vector)
            // to make room for the new position at index 0.
            positions.copyWithin(3, 0, positions.length - 3);

            positions[0] = tempVec.x;
            positions[1] = tempVec.y;
            positions[2] = tempVec.z;

            trail.geometry.attributes.position.needsUpdate = true;
        });
    }
}

// Handle Resize
window.addEventListener('resize', () => {
    if (camera && renderer && labelRenderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        labelRenderer.setSize(window.innerWidth, window.innerHeight);
    }
});

// Kickoff
if (!window.__SKIP_INIT__) {
    init().catch(err => {
        console.error("Initialization failed:", err);
        // Fallback UI
        const loading = document.getElementById('loading-screen');
        if (loading) {
            loading.innerHTML = `<div style="color:red; text-align:center; padding-top:20%">
                <h1>Failed to Start</h1>
                <p>An error occurred while initializing the application.</p>
                <p>${err.message}</p>
            </div>`;
        }
    });
}
