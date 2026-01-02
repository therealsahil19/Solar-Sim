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
    let initFailed = false;

    manager.onProgress = function ( url, itemsLoaded, itemsTotal ) {
        if (loadingBar) {
            const width = (itemsLoaded / itemsTotal) * 100;
            loadingBar.style.width = width + '%';
            loadingBar.setAttribute('aria-valuenow', Math.round(width));
        }
    };
    manager.onLoad = function ( ) {
        if (initFailed) return; // Prevent hiding if an error occurred

        assetsLoaded = true;
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                // Double-check just in case error happened during timeout
                if (initFailed) return;

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

    // Bolt Support: Lazy Load Queue
    textureLoader.lazyLoadQueue = [];

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

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
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
        initFailed = true; // Signal to manager not to hide screen
        throw error; // Re-throw to global handler
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

    // Bolt Optimization: Trigger Lazy Loader after 2 seconds (to let main assets settle)
    if (textureLoader.lazyLoadQueue.length > 0) {
        setTimeout(() => {
            console.log(`Bolt ⚡: Lazy loading ${textureLoader.lazyLoadQueue.length} textures...`);
            textureLoader.lazyLoadQueue.forEach(item => {
                const tex = new THREE.TextureLoader().load(item.url); // Use separate loader to avoid manager UI trigger?
                // Actually, if we use same manager, the loading bar might reappear?
                // The manager behavior depends on if it was reset.
                // Let's use a fresh loader without manager to be silent.
                item.material.map = tex;
                item.material.color.setHex(0xffffff); // Reset color to white so texture shows true colors
                item.material.needsUpdate = true;
            });
            // Clear queue
            textureLoader.lazyLoadQueue = [];
        }, 2000);
    }

    // 7. Start Loop
    animate();
}

// ============================================================================
// Logic Helpers
// ============================================================================

/**
 * Toggles the camera view between 'Overview' and 'Chase' modes.
 * - **Overview**: Standard OrbitControls centered on the system origin (Sun).
 * - **Chase**: Locks the camera relative to the PlayerShip, disabling standard orbit controls.
 *
 * Side Effects:
 * - Updates `isShipView` state.
 * - Modifies DOM button (`aria-pressed`).
 * - Resets `focusTarget` to null when entering Chase mode.
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
 * Resets the camera to the default position looking at the Sun.
 * useful for "escaping" from deep zoom or chase mode.
 *
 * Side Effects:
 * - Clears `isShipView` and `focusTarget`.
 * - Resets camera position to (0, 40, 80).
 * - Displays a "View Reset" toast.
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
 * Sets the camera to smoothly follow a specific 3D object.
 * The `animate` loop detects `focusTarget` and updates the controls target every frame.
 *
 * @param {THREE.Object3D} mesh - The object to follow (must have `userData.name`).
 */
function setFocusTarget(mesh) {
    focusTarget = mesh;
    isShipView = false; // Disable ship view to allow focus
    showToast(`Following ${mesh.userData.name}`);
}

/**
 * Updates the global simulation speed.
 * Controls how fast `uTime` advances for shaders and orbital rotation.
 *
 * @param {number} scale - The new time scale multiplier (e.g., 1.0 = normal, 2.0 = 2x speed).
 */
function updateTimeScale(scale) {
    timeScale = scale;
}

/**
 * Switches the entire simulation between High Definition (Textured) and Low Definition (Solid Color) modes.
 * This affects all planetary bodies and instanced meshes.
 *
 * **Performance Note**:
 * Switching to "LD" uses cached `MeshStandardMaterial`s (shared by color), reducing shader complexity
 * and memory usage, although geometry remains the same.
 *
 * @param {HTMLElement} [btnElement] - The DOM button triggering the event (for updating text/aria).
 */
function toggleTextures(btnElement) {
    useTextures = !useTextures;

    // Update Button Text
    if (btnElement) {
        btnElement.textContent = useTextures ? "HD" : "LD";
        btnElement.setAttribute('aria-pressed', useTextures);
    }

    // Update Materials for Standard Meshes (Sun, etc.)
    interactionTargets.forEach(mesh => {
        if (useTextures && mesh.userData.texturedMaterial) {
            mesh.material = mesh.userData.texturedMaterial;
        } else if (!useTextures && mesh.userData.solidMaterial) {
            mesh.material = mesh.userData.solidMaterial;
        }
    });

    // Update Materials for Instanced Meshes (Moons, Asteroids)
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

    showToast(`Textures: ${useTextures ? "ON" : "OFF"}`);
}

/**
 * Toggles the visibility of `CSS2DObject` labels for all planets.
 *
 * **Optimization**:
 * Sets `labelsNeedUpdate` to true to ensure the renderer clears/draws one final frame
 * before disabling the `labelRenderer` loop in `animate`.
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
 * Toggles the visibility of orbital paths (lines) and dynamic trails.
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
 * Pauses or Resumes the simulation loop.
 * - **Paused**: Orbits and rotations stop. Camera controls remain active.
 * - **Resumed**: Physics resume at current `timeScale`.
 *
 * @param {HTMLElement} [btnElement] - The DOM button to update (icon/aria-label).
 */
function togglePause(btnElement) {
    isPaused = !isPaused;
    window.isPaused = isPaused; // Update exposed global

    if (btnElement) {
        // Toggle SVG Icon
        if (isPaused) {
            // Play Icon
            btnElement.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
            btnElement.setAttribute('aria-label', "Resume Simulation");
        } else {
            // Pause Icon
            btnElement.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
            btnElement.setAttribute('aria-label', "Pause Simulation");
        }
    }

    showToast(isPaused ? "Paused" : "Resumed");
}

/**
 * Keyboard shortcut handler to focus on primary planets (Keys 1-9).
 *
 * @param {number} index - The 0-based index of the planet in the `planets` registry.
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
 * Updates the global `selectedObject` state used by the animation loop to display dynamic info.
 * This is called when a user clicks an object or selects it via Command Palette.
 *
 * @param {THREE.Object3D} mesh - The selected object.
 */
function handleObjectSelection(mesh) {
    selectedObject = mesh;
    // Note: The UI population happens in input.js currently,
    // but main.js holds the reference for dynamic updates (like distance) in animate().
}

/**
 * Displays a temporary "Toast" notification at the bottom of the screen.
 * Used for feedback like "Textures: ON" or "Paused".
 *
 * @param {string} message - The text to display.
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

// Re-used vectors to avoid garbage collection in the render loop
const tempVec = new THREE.Vector3();
const sunPos = new THREE.Vector3(0, 0, 0);

/**
 * The Main Animation Loop ("The Heartbeat").
 *
 * This function runs ~60 times per second and orchestrates:
 * 1. **Physics/Motion**: Updates rotations and orbital positions.
 * 2. **Camera Logic**: Handles Chase Mode and Focus Mode smoothing.
 * 3. **Ship AI**: Orients the player ship towards the nearest planet.
 * 4. **Rendering**: Draws the Scene and Labels.
 * 5. **Post-Processing**: Updates orbit trails (Post-Render).
 *
 * **Optimization ("Bolt")**:
 * - Uses `frameCount` to throttle expensive operations (UI updates, Neighbors search).
 * - Splits Logic into Pre-Render (Motion) and Post-Render (Trails) to leverage GPU-computed matrices.
 */
function animate() {
    requestAnimationFrame(animate);

    if (!isPaused) {
        // --- 1. Physics & Motion ---

        // Rotate individual objects
        animatedObjects.forEach(obj => {
            if (obj.pivot) obj.pivot.rotation.y += obj.speed * timeScale;
            if (obj.mesh) obj.mesh.rotation.y += obj.rotationSpeed * timeScale;
        });

        // Update Instanced Meshes (Moons, Debris)
        if (instanceRegistry) {
            // FORCE UPDATE: We must update world matrices BEFORE instanceRegistry reads them.
            // Otherwise, instances will lag one frame behind the orbital pivot.
            scene.updateMatrixWorld();
            instanceRegistry.update();
        }

        // Update GPU Asteroid Belt
        // The vertex shader uses 'uTime' to calculate position, so we just increment the uniform.
        if (asteroidBelt && asteroidBelt.userData.timeUniform) {
            asteroidBelt.userData.timeUniform.value += 0.001 * timeScale;
        }

        // Rotate Starfield slowly
        if (starfield) {
            starfield.rotation.y += 0.0003;
        }
    }

    // --- 2. Camera Logic ---

    if (isShipView && playerShip) {
        // Mode: Chase Camera (Locked behind ship)
        controls.target.copy(playerShip.position);
        camera.position.set(
            playerShip.position.x + 5,
            playerShip.position.y + 3,
            playerShip.position.z + 5
        );
    } else if (focusTarget) {
        // Mode: Focus/Follow (Smoothly tracks a planet)
        const targetPos = new THREE.Vector3();
        // Optimization: Read directly from matrixWorld to avoid re-calculation
        targetPos.setFromMatrixPosition(focusTarget.matrixWorld);
        controls.target.copy(targetPos);
    }

    // --- 3. Player Ship "AI" (Face Nearest) ---

    if (playerShip && animatedObjects.length > 0) {
        // Throttling: Searching for the nearest object is O(N).
        // We only do this every 10 frames to save CPU cycles.
        if (frameCount % 10 === 0) {
            let closestDist = Infinity;
            let closestObj = null;
            const shipPos = playerShip.position;

            animatedObjects.forEach(obj => {
                if (obj.mesh) {
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

        // Apply cached rotation target
        if (closestObjectCache) {
            tempVec.setFromMatrixPosition(closestObjectCache.matrixWorld);
            playerShip.lookAt(tempVec);
        }
    }

    // Increment global frame counter
    frameCount++;

    // --- 4. Dynamic UI Updates ---

    // Throttling: DOM updates are slow. Limit "Distance" text updates to every 10 frames.
    if (selectedObject && frameCount % 10 === 0) {
        const distEl = document.getElementById('info-dist-sun');
        if (distEl) {
            tempVec.setFromMatrixPosition(selectedObject.matrixWorld);
            const dist = tempVec.distanceTo(sunPos);
            // Display formatted distance
            distEl.textContent = `Dist to Sun: ${dist.toFixed(1)} units`;
        }
    }

    // --- 5. Render Phase ---

    if (controls) controls.update();
    if (renderer && scene && camera) {
        renderer.render(scene, camera);

        // Optimization: CSS2DRenderer is heavy. Skip if labels are hidden.
        // `labelsNeedUpdate` ensures we render one last cleared frame when toggling off.
        if (showLabels || labelsNeedUpdate) {
            labelRenderer.render(scene, camera);
            if (!showLabels) labelsNeedUpdate = false;
        }
    }

    // --- 6. Post-Render Updates (Trails) ---

    // Optimization: Update trails AFTER rendering.
    // This allows us to read the *current frame's* matrixWorld values (computed by renderer)
    // without forcing a synchronous `scene.updateMatrixWorld()` call which stalls the pipeline.
    // Result: Trails are effectively 1 frame "behind", but perfectly performant.
    // Throttling: Update trails every 2 frames to halve the CPU load for trail logic.
    if (!isPaused && showOrbits && frameCount % 2 === 0) {
        // Bolt: Unified Trail System
        if (trailManager) {
            trailManager.update();
        }
    }
}

// Handle Resize
const onWindowResize = () => {
    if (camera && renderer && labelRenderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        labelRenderer.setSize(window.innerWidth, window.innerHeight);
    }
};
window.addEventListener('resize', onWindowResize);

// Kickoff
if (!window.__SKIP_INIT__) {
    init().catch(err => {
        console.error("Initialization failed:", err);
        // Fallback UI
        const loading = document.getElementById('loading-screen');
        if (loading) {
            // Ensure visibility overrides any fade-out
            loading.style.display = 'block';
            loading.style.opacity = '1';
            loading.setAttribute('aria-hidden', 'false');
            loading.innerHTML = `<div style="color:red; text-align:center; padding-top:20%">
                <h1>Failed to Start</h1>
                <p>An error occurred while initializing the application.</p>
                <p>${err.message}</p>
            </div>`;
        }
    });
}
