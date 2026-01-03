/**
 * @file main.js
 * @description The "Conductor" module for the Solar System simulation.
 * It orchestrates the initialization of the 3D scene, manages the render loop,
 * handles global state (scene, camera, renderer), and coordinates interaction between modules.
 */

import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { createStarfield, createSun, createPlayerShip, createSystem, clearMaterialCache } from './procedural.js';
import { createBelt } from './debris.js';
import { setupControls, setupInteraction } from './input.js';
import { InstanceRegistry } from './instancing.js';
import { TrailManager } from './trails.js';
import { getOrbitalPosition, physicsToRender } from './physics.js';
import './benchmark.js'; // ⚡ Bolt: Auto-load performance benchmark

// ============================================================================
// State & Globals
// ============================================================================

/**
 * @type {Array<{
 *   pivot: THREE.Group,
 *   mesh: THREE.Group,
 *   physics: Object,
 *   parent?: Object
 * }>}
 */
export const animatedObjects = [];

/** @type {Array<THREE.Object3D>} Optimization for raycasting */
const interactionTargets = [];

/** @type {Array<THREE.Mesh>} List of primary planets for shortcuts */
const planets = [];

const allOrbits = [];
const allTrails = [];
const allLabels = [];

let playerShip;
let starfield;
let controls;
export let scene;
let camera;
let renderer;
let labelRenderer;

let useTextures = true;
let isShipView = false;
let isPaused = false;
let showLabels = true;
let labelsNeedUpdate = true;
let showOrbits = true;
let timeScale = 1.0;

// Physics Time (Years)
let simulationTime = 0;
let lastFrameTime = 0;

let focusTarget = null;
let selectedObject = null;
let interactionHelpers = null;

let frameCount = 0;
let closestObjectCache = null;
const belts = [];
let instanceRegistry = null;
let trailManager = null;

window.scene = null;
window.playerShip = null;
window.controls = null;
window.isPaused = isPaused;

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initializes the application.
 * Sets up renderers, loads assets, and starts the animation loop.
 * Uses Async/Await to handle configuration loading.
 */
export async function init() {
    // 0. Reset Global State
    interactionTargets.length = 0;
    animatedObjects.length = 0;
    planets.length = 0;
    allOrbits.length = 0;
    allTrails.length = 0;
    allLabels.length = 0;

    // Bug 045 Fix: Clear material cache to prevent GPU memory leaks on reset
    clearMaterialCache();

    // 1. Setup Basic Three.js Components
    scene = new THREE.Scene();
    window.scene = scene;

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100000);
    // Initial camera position (Log scale adjusted)
    // Earth is at ~43 units. Sun is at 0.
    camera.position.set(0, 60, 100);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.setAttribute('role', 'application');
    renderer.domElement.setAttribute('aria-label', '3D Solar System Simulation');
    document.body.appendChild(renderer.domElement);

    labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    labelRenderer.domElement.style.pointerEvents = 'none';
    document.body.appendChild(labelRenderer.domElement);

    // 2. Lighting
    const pointLight = new THREE.PointLight(0xffffff, 1.5, 0, 0);
    pointLight.castShadow = true;
    pointLight.shadow.mapSize.width = 1024;
    pointLight.shadow.mapSize.height = 1024;
    pointLight.shadow.bias = -0.0001;
    scene.add(pointLight);

    const ambientLight = new THREE.AmbientLight(0x606060);
    scene.add(ambientLight);

    // 3. Loading Manager
    const loadingScreen = document.getElementById('loading-screen');
    const loadingBar = document.getElementById('loading-bar');
    const manager = new THREE.LoadingManager();
    let assetsLoaded = false;
    let initFailed = false;

    manager.onProgress = function (url, itemsLoaded, itemsTotal) {
        if (loadingBar) {
            const width = (itemsLoaded / itemsTotal) * 100;
            loadingBar.style.width = width + '%';
            loadingBar.setAttribute('aria-valuenow', Math.round(width));
        }
    };
    manager.onLoad = function () {
        if (initFailed) return;
        assetsLoaded = true;
        // Don't hide loading screen here. Wait for system data to load.
    };

    const textureLoader = new THREE.TextureLoader(manager);
    textureLoader.lazyLoadQueue = [];

    instanceRegistry = new InstanceRegistry(scene);
    trailManager = new TrailManager(scene, 5000, 100);

    textureLoader.instanceRegistry = instanceRegistry;
    textureLoader.trailManager = trailManager;

    // 4. Create Initial Objects
    starfield = createStarfield();
    scene.add(starfield);

    const sun = createSun(textureLoader, useTextures);
    scene.add(sun);
    interactionTargets.push(sun);

    playerShip = createPlayerShip();
    scene.add(playerShip);
    window.playerShip = playerShip;

    // Asteroid Belt (CPU)
    // Range 2.1 - 3.3 AU
    // 5. Load System Data
    let planetData = null;
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const configUrl = urlParams.get('config') || 'system.json';
        const response = await fetch(configUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        planetData = await response.json();

        if (!Array.isArray(planetData)) {
            throw new Error('Invalid configuration: planetData must be an array.');
        }

        planetData.forEach(config => {
            if (config.type === 'Belt') {
                const belt = createBelt(config);
                scene.add(belt);
                belts.push(belt);
                return;
            }

            // Root System Creation
            const systemNode = createSystem(config, textureLoader, useTextures, null);

            scene.add(systemNode.pivot);
            if (systemNode.orbit) scene.add(systemNode.orbit);

            interactionTargets.push(...systemNode.interactables);
            animatedObjects.push(...systemNode.animated);
            allOrbits.push(...systemNode.orbits);
            allTrails.push(...systemNode.trails);
            allLabels.push(...systemNode.labels);

            // Identify Primary Planet
            if (systemNode.animated.length > 0) {
                const primary = systemNode.animated[0];
                // primary.pivot is the Group
                // We want to focus on the Object that has the label/mesh
                // The interaction target is the InstancedMesh usually.
                // But we want to store the "System Root" (Pivot) for logic?
                // Let's store the Pivot.
                if (primary.pivot) planets.push(primary.pivot);
            }
        });

        instanceRegistry.build();

        // Add InstancedMeshes to interaction targets
        instanceRegistry.groups.forEach(group => {
            if (group.mesh) interactionTargets.push(group.mesh);
        });

        // Safe to hide loading screen now
        if (loadingScreen && !initFailed) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                if (initFailed) return;
                loadingScreen.style.display = 'none';
                loadingScreen.setAttribute('aria-hidden', 'true');
            }, 500);
        }

    } catch (error) {
        console.error("Failed to load system data:", error);
        initFailed = true;
        throw error;
    }

    // 6. Setup Controls & Input
    controls = setupControls(camera, renderer.domElement);
    window.controls = controls;

    const context = {
        camera,
        scene,
        rendererDomElement: renderer.domElement,
        interactionTargets,
        instanceRegistry,
        state: { useTextures },
        planetData
    };

    const callbacks = {
        onToggleCamera: toggleCameraView,
        onToggleTexture: toggleTextures,
        onTogglePause: togglePause,
        onFocusPlanet: focusPlanet,
        onResetCamera: resetCamera,
        onSetFocus: setFocusTarget,
        onUpdateTimeScale: updateTimeScale,
        onObjectSelected: handleObjectSelection,
        onToggleLabels: toggleLabels,
        onToggleOrbits: toggleOrbits,
        onToggleBelt: toggleBelt
    };

    interactionHelpers = setupInteraction(context, callbacks);

    // 7. Apply Saved Settings from SettingsPanel
    if (interactionHelpers.settingsPanel) {
        const savedSettings = interactionHelpers.settingsPanel.getSettings();

        // Apply textures setting (if different from default)
        if (!savedSettings.textures && useTextures) {
            toggleTextures(document.getElementById('btn-texture'));
        }

        // Apply labels setting
        if (!savedSettings.labels && showLabels) {
            toggleLabels();
        }

        // Apply orbits setting
        if (!savedSettings.orbits && showOrbits) {
            toggleOrbits();
        }

        // Apply speed setting
        if (savedSettings.speed !== 1.0) {
            updateTimeScale(savedSettings.speed);
            const dockSlider = document.getElementById('slider-speed');
            const dockValue = document.getElementById('speed-value');
            if (dockSlider) dockSlider.value = savedSettings.speed;
            if (dockValue) dockValue.textContent = `${savedSettings.speed.toFixed(1)}x`;
        }

        // Apply belt settings
        toggleBelt('asteroid_belt', savedSettings.asteroidBelt !== false);
        toggleBelt('kuiper_belt', savedSettings.kuiperBelt !== false);
        toggleBelt('oort_cloud', savedSettings.oortCloud !== false);
    }

    if (textureLoader.lazyLoadQueue.length > 0) {
        setTimeout(() => {
            if (initFailed) return;
            console.log(`Bolt ⚡: Lazy loading ${textureLoader.lazyLoadQueue.length} textures...`);
            textureLoader.lazyLoadQueue.forEach(item => {
                const tex = new THREE.TextureLoader().load(item.url);
                item.material.map = tex;
                item.material.color.setHex(0xffffff);
                item.material.needsUpdate = true;
            });
            textureLoader.lazyLoadQueue = [];
        }, 2000);
    }

    lastFrameTime = performance.now();
    animate();
}

// ============================================================================
// Logic Helpers
// ============================================================================

/**
 * Toggles the camera mode between "Orbit View" (Overview) and "Ship View" (Chase Camera).
 * Updates the ARIA state of the camera button.
 */
function toggleCameraView() {
    isShipView = !isShipView;
    const btn = document.getElementById('btn-camera');
    if (btn) btn.setAttribute('aria-pressed', isShipView);

    if (isShipView) {
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
        controls.target.set(0, 0, 0);
        camera.position.set(0, 60, 100);
    }
    controls.update();
}

/**
 * Resets the camera to its initial overview position and clears any focus target.
 * Updates UI state and displays a feedback toast.
 */
function resetCamera() {
    isShipView = false;
    focusTarget = null;
    const btn = document.getElementById('btn-camera');
    if (btn) btn.setAttribute('aria-pressed', 'false');

    controls.target.set(0, 0, 0);
    camera.position.set(0, 60, 100);
    controls.update();
    showToast("View Reset");
}

/**
 * Sets the camera's focus target to a specific mesh.
 * The camera will smoothly follow this object in the animation loop.
 * @param {THREE.Object3D} mesh - The object to follow.
 */
function setFocusTarget(mesh) {
    focusTarget = mesh;
    isShipView = false;
    // We try to find a name from userData
    const name = mesh.userData.name || "Object";
    showToast(`Following ${name}`);
}

/**
 * Updates the global time scale factor for the simulation.
 * @param {number} scale - The new time multiplier (e.g., 1.0 = normal, 2.0 = 2x speed).
 */
function updateTimeScale(scale) {
    timeScale = scale;
}

/**
 * Toggles between High Definition (Textured) and Low Definition (Solid Color) rendering modes.
 * This is a "Bolt" optimization feature to improve performance on low-end devices.
 * @param {HTMLElement} [btnElement] - The button element trigger (optional, for ARIA/Text update).
 */
function toggleTextures(btnElement) {
    useTextures = !useTextures;
    if (btnElement) {
        btnElement.textContent = useTextures ? "HD" : "LD";
        btnElement.setAttribute('aria-pressed', useTextures);
    }
    // (Implementation similar to before - simplified for brevity)
    interactionTargets.forEach(mesh => {
        if (useTextures && mesh.userData.texturedMaterial) mesh.material = mesh.userData.texturedMaterial;
        else if (!useTextures && mesh.userData.solidMaterial) mesh.material = mesh.userData.solidMaterial;
    });
    if (instanceRegistry) {
        instanceRegistry.groups.forEach(group => {
            if (group.mesh && group.instances.length > 0) {
                const sampleUserData = group.instances[0].pivot.userData;
                if (useTextures && sampleUserData.texturedMaterial) group.mesh.material = sampleUserData.texturedMaterial;
                else if (!useTextures && sampleUserData.solidMaterial) group.mesh.material = sampleUserData.solidMaterial;
            }
        });
    }
    showToast(`Textures: ${useTextures ? "ON" : "OFF"}`);
}

/**
 * Toggles the visibility of all text labels (CSS2DObject).
 * Useful for reducing visual clutter or improving performance.
 */
function toggleLabels() {
    showLabels = !showLabels;
    labelsNeedUpdate = true;
    const btn = document.getElementById('btn-labels');
    if (btn) btn.setAttribute('aria-pressed', showLabels);
    allLabels.forEach(label => label.visible = showLabels);
    showToast(`Labels: ${showLabels ? "ON" : "OFF"}`);
}

/**
 * Toggles the visibility of a specific belt system by its type.
 * @param {string} type - The belt identifier (e.g., 'asteroid_belt').
 * @param {boolean} visible - Whether the belt should be visible.
 */
function toggleBelt(type, visible) {
    belts.forEach(belt => {
        if (belt.userData && belt.userData.type === type) {
            belt.visible = visible;
        }
    });
}

/**
 * Toggles the visibility of orbit lines and trails.
 */
function toggleOrbits() {
    showOrbits = !showOrbits;
    const btn = document.getElementById('btn-orbits');
    if (btn) btn.setAttribute('aria-pressed', showOrbits);
    allTrails.forEach(trail => trail.visible = showOrbits);
    showToast(`Orbits: ${showOrbits ? "ON" : "OFF"}`);

    // A11y: announce state change
    const liveAnnouncer = document.getElementById('toast');
    if (liveAnnouncer) {
        liveAnnouncer.setAttribute('aria-label', `Orbits and trails ${showOrbits ? 'visible' : 'hidden'}`);
    }
}

/**
 * Pauses or Resumes the simulation loop.
 * When paused, physics integration stops, but camera controls remain active.
 * @param {HTMLElement} [btnElement] - The pause button element (optional, for Icon/ARIA update).
 */
function togglePause(btnElement) {
    isPaused = !isPaused;
    window.isPaused = isPaused;
    if (btnElement) {
        if (isPaused) {
            btnElement.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
            btnElement.setAttribute('aria-label', "Resume Simulation");
        } else {
            btnElement.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
            btnElement.setAttribute('aria-label', "Pause Simulation");
        }
    }
    showToast(isPaused ? "Simulation Paused" : "Simulation Resumed");

    // A11y: Announce state change to screen readers (WCAG 4.1.3)
    const srStatus = document.getElementById('sr-status');
    if (srStatus) {
        srStatus.textContent = isPaused ? "Simulation paused" : "Simulation resumed";
    }
}

/**
 * Focuses the camera on a primary planet by its index in the `planets` array.
 * Mapped to number keys (1-9).
 * @param {number} index - The 0-based index of the planet.
 */
function focusPlanet(index) {
    if (index < 0 || index >= planets.length) return;
    const planet = planets[index];
    setFocusTarget(planet);
    handleObjectSelection(planet); // Update state
    if (interactionHelpers && interactionHelpers.updateSelectionUI) {
        interactionHelpers.updateSelectionUI(planet);
    }
}

/**
 * Updates the currently selected object.
 * Used for driving the Info Panel logic.
 * @param {THREE.Object3D} mesh - The selected object.
 */
function handleObjectSelection(mesh) {
    selectedObject = mesh;
}

/**
 * Displays a temporary visual feedback message (Toast) to the user.
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

const tempVec = new THREE.Vector3();
const sunPos = new THREE.Vector3(0, 0, 0);

// ⚡ Bolt Optimization: Pre-allocated vectors for animate loop (zero GC pressure)
const _localPos = new THREE.Vector3();
const _worldPos = new THREE.Vector3();
const _parentPosPhys = new THREE.Vector3();
const _parentPosRender = new THREE.Vector3();
const _renderPos = new THREE.Vector3();

// ============================================================================
// Animation Loop (Updated for Physics)
// ============================================================================

/**
 * The Main Loop.
 * Handles Physics, Animation, and Rendering.
 */
function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    const rawDt = (now - lastFrameTime) / 1000;
    const dt = Math.min(rawDt, 0.1); // Clamp to 0.1s (Bug 035)
    lastFrameTime = now;

    if (!isPaused) {
        // Increment Simulation Time
        // 1 second real time = 1 year simulation time (at timeScale 1.0)
        // Adjust this constant to find a good default speed.
        // Base Speed: 0.2 Earth Years per second (at timeScale 1.0).
        simulationTime += dt * 0.2 * timeScale;

        // --- 1. Physics & Motion ---

        animatedObjects.forEach(obj => {
            const physics = obj.physics;
            if (physics && physics.a !== undefined) {
                // ⚡ Bolt: Zero-allocation path using pre-allocated vectors
                // Calculate position in Physics Space (AU) relative to parent
                getOrbitalPosition(physics, simulationTime, _localPos);
                _worldPos.copy(_localPos);

                // If this is a Moon, add Parent's Physics Position
                if (obj.parent) {
                    getOrbitalPosition(obj.parent, simulationTime, _parentPosPhys);
                    _worldPos.add(_parentPosPhys);
                }

                // Transform to Render Space
                physicsToRender(_worldPos, _renderPos);

                // Update Pivot Position
                if (obj.parent) {
                    // Reuse cached parent physics position (already in _parentPosPhys)
                    physicsToRender(_parentPosPhys, _parentPosRender);

                    // Calculate relative offset in-place
                    obj.pivot.position.copy(_renderPos).sub(_parentPosRender);
                } else {
                    // Planet (Child of Scene)
                    obj.pivot.position.copy(_renderPos);
                }

                // Self Rotation (Visual Mesh)
                if (obj.mesh) {
                    obj.mesh.rotation.y += 0.5 * dt * timeScale;
                }
            }
        });

        // Update Instanced Meshes
        scene.updateMatrixWorld();
        if (instanceRegistry) {
            instanceRegistry.update();
        }

        // Update Belts
        belts.forEach(belt => belt.update && belt.update(simulationTime));

        // Rotate Starfield
        if (starfield) starfield.rotation.y += 0.02 * dt;
    }

    // --- 2. Camera Logic ---
    if (isShipView && playerShip) {
        controls.target.copy(playerShip.position);
        camera.position.set(
            playerShip.position.x + 5,
            playerShip.position.y + 3,
            playerShip.position.z + 5
        );
    } else if (focusTarget) {
        tempVec.setFromMatrixPosition(focusTarget.matrixWorld);
        controls.target.copy(tempVec);
    }

    // --- 3. Player Ship AI ---
    if (playerShip && frameCount % 10 === 0) {
        // Simplified search logic
        // Use 'planets' list for efficiency
        let closestDist = Infinity;
        let closestObj = null;
        const shipPos = playerShip.position;

        planets.forEach(p => {
            tempVec.setFromMatrixPosition(p.matrixWorld);
            const dist = shipPos.distanceToSquared(tempVec);
            if (dist < closestDist) {
                closestDist = dist;
                closestObj = p;
            }
        });
        closestObjectCache = closestObj;
    }
    if (closestObjectCache && playerShip) {
        tempVec.setFromMatrixPosition(closestObjectCache.matrixWorld);
        playerShip.lookAt(tempVec);
    }

    frameCount++;

    // --- 4. UI ---
    if (selectedObject && frameCount % 10 === 0) {
        const distEl = document.getElementById('info-dist-sun');
        if (distEl) {
            // Distance in Render Space is meaningless for Astronomy info.
            // We should ideally show Physics Distance (AU).
            // But getting that back from the mesh is hard without stored state.
            // For now, let's just show "Distance" as generic, or read from userData.
            // If the object has `userData.distance` (which we set to 'a'), use that?
            // `system.json` sets `distance` = `a`.
            // Let's use that static value for now to avoid confusion with Log units.
            if (selectedObject.userData && selectedObject.userData.physics) {
                // Calculate real-time distance?
                // Too complex for this snippet. Just show Semi-Major Axis.
                distEl.textContent = `Orbit: ${selectedObject.userData.physics.a} AU`;
            } else {
                tempVec.setFromMatrixPosition(selectedObject.matrixWorld);
                distEl.textContent = `Render Dist: ${tempVec.distanceTo(sunPos).toFixed(1)}`;
            }
        }
    }

    // --- 5. Render ---
    if (controls) controls.update();
    if (renderer) {
        renderer.render(scene, camera);
        if (showLabels || labelsNeedUpdate) {
            // Conditional Visibility for Moons (Bolt Optimization)
            // VIS-01 Fix: Viewport edge detection for labels
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const edgeMargin = 40; // px from edge to start fading
            const fadeZone = 60;   // px fade transition zone

            allLabels.forEach(label => {
                // Moon visibility logic
                if (label.userData.isMoon) {
                    const parentName = label.userData.parentPlanet;
                    const isParentFocused = focusTarget && focusTarget.userData.name === parentName;
                    const isParentSelected = selectedObject && selectedObject.userData.name === parentName;

                    label.visible = showLabels && (isParentFocused || isParentSelected);
                } else {
                    label.visible = showLabels;
                }

                // VIS-01 Fix: Edge fade for visible labels
                if (label.visible && label.element) {
                    const rect = label.element.getBoundingClientRect();
                    let opacity = 1;

                    // Calculate distance from each edge
                    const distLeft = rect.left;
                    const distRight = viewportWidth - rect.right;
                    const distTop = rect.top;
                    const distBottom = viewportHeight - rect.bottom;

                    // Find minimum distance to any edge
                    const minDist = Math.min(distLeft, distRight, distTop, distBottom);

                    // Fade when approaching edge
                    if (minDist < edgeMargin) {
                        opacity = 0;
                    } else if (minDist < edgeMargin + fadeZone) {
                        opacity = (minDist - edgeMargin) / fadeZone;
                    }

                    label.element.style.opacity = opacity;
                }
            });

            labelRenderer.render(scene, camera);
            if (!showLabels) labelsNeedUpdate = false;
        }
    }

    // --- 6. Trails ---
    if (!isPaused && showOrbits && frameCount % 2 === 0 && trailManager) {
        trailManager.update();
    }
}

const onWindowResize = () => {
    if (camera && renderer && labelRenderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        labelRenderer.setSize(window.innerWidth, window.innerHeight);
    }
};
window.addEventListener('resize', onWindowResize);

if (!window.__SKIP_INIT__) {
    init().catch(err => {
        console.error("Initialization failed:", err);
        const loading = document.getElementById('loading-screen');
        if (loading) {
            loading.style.display = 'block';
            loading.style.opacity = '1';
            loading.setAttribute('aria-hidden', 'false');
            loading.innerHTML = `
                <div class="glass-panel" style="color:var(--text-primary); text-align:center; padding: 2rem; border: 1px solid var(--accent-red);">
                    <h1 style="color:var(--accent-red); margin-bottom: 1rem;">Simulation Error</h1>
                    <p style="margin-bottom: 2rem;">${err.message || 'An unexpected error occurred during initialization.'}</p>
                    <button onclick="window.location.reload()" class="nav-btn" style="padding: 0.5rem 1rem; cursor: pointer;">
                        🔄 Reload Simulation
                    </button>
                </div>
            `;
        }
    });
}
