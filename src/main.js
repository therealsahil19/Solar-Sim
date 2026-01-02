/**
 * @file main.js
 * @description The "Conductor" module for the Solar System simulation.
 * It orchestrates the initialization of the 3D scene, manages the render loop,
 * handles global state (scene, camera, renderer), and coordinates interaction between modules.
 */

import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { createStarfield, createSun, createPlayerShip, createSystem } from './procedural.js';
import { createAsteroidBelt, createKuiperBelt, createOortCloud } from './debris.js';
import { setupControls, setupInteraction } from './input.js';
import { InstanceRegistry } from './instancing.js';
import { TrailManager } from './trails.js';
import { getOrbitalPosition, physicsToRender } from './physics.js';

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
let asteroidBelt = null;
let kuiperBelt = null;
let oortCloud = null;
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

    manager.onProgress = function ( url, itemsLoaded, itemsTotal ) {
        if (loadingBar) {
            const width = (itemsLoaded / itemsTotal) * 100;
            loadingBar.style.width = width + '%';
            loadingBar.setAttribute('aria-valuenow', Math.round(width));
        }
    };
    manager.onLoad = function ( ) {
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
    asteroidBelt = createAsteroidBelt();
    scene.add(asteroidBelt);

    // Kuiper Belt (30 - 50 AU)
    kuiperBelt = createKuiperBelt();
    scene.add(kuiperBelt);

    // Oort Cloud (2000 - 100000 AU)
    oortCloud = createOortCloud();
    scene.add(oortCloud);

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

        planetData.forEach(planetConfig => {
            // Root System Creation
            const systemNode = createSystem(planetConfig, textureLoader, useTextures, null);

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
                if (interactionHelpers && interactionHelpers.openModal) {
                    interactionHelpers.openModal();
                }
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
        onToggleOrbits: toggleOrbits
    };

    interactionHelpers = setupInteraction(context, callbacks);

    if (assetsLoaded && interactionHelpers.openModal) {
        interactionHelpers.openModal();
    }

    if (textureLoader.lazyLoadQueue.length > 0) {
        setTimeout(() => {
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

function setFocusTarget(mesh) {
    focusTarget = mesh;
    isShipView = false;
    // We try to find a name from userData
    const name = mesh.userData.name || "Object";
    showToast(`Following ${name}`);
}

function updateTimeScale(scale) {
    timeScale = scale;
}

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

function toggleLabels() {
    showLabels = !showLabels;
    labelsNeedUpdate = true;
    const btn = document.getElementById('btn-labels');
    if (btn) btn.setAttribute('aria-pressed', showLabels);
    allLabels.forEach(label => label.visible = showLabels);
    showToast(`Labels: ${showLabels ? "ON" : "OFF"}`);
}

function toggleOrbits() {
    showOrbits = !showOrbits;
    const btn = document.getElementById('btn-orbits');
    if (btn) btn.setAttribute('aria-pressed', showOrbits);
    allOrbits.forEach(orbit => orbit.visible = showOrbits);
    allTrails.forEach(trail => trail.visible = showOrbits);
    showToast(`Orbits: ${showOrbits ? "ON" : "OFF"}`);
}

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
    showToast(isPaused ? "Paused" : "Resumed");
}

function focusPlanet(index) {
    if (index < 0 || index >= planets.length) return;
    const planet = planets[index];
    setFocusTarget(planet);
    handleObjectSelection(planet); // Update state
    if (interactionHelpers && interactionHelpers.updateSelectionUI) {
        interactionHelpers.updateSelectionUI(planet);
    }
}

function handleObjectSelection(mesh) {
    selectedObject = mesh;
}

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
    const dt = (now - lastFrameTime) / 1000; // seconds
    lastFrameTime = now;

    if (!isPaused) {
        // Increment Simulation Time
        // 1 second real time = 1 year simulation time (at timeScale 1.0)
        // Adjust this constant to find a good default speed.
        // Let's say default is slower: 0.2 years per second.
        simulationTime += dt * 0.2 * timeScale;

        // --- 1. Physics & Motion ---

        animatedObjects.forEach(obj => {
            const physics = obj.physics;
            if (physics && physics.a !== undefined) {
                // Calculate position in Physics Space (AU) relative to parent
                const localPos = getOrbitalPosition(physics, simulationTime);

                let worldPos = localPos.clone();

                // If this is a Moon, add Parent's Physics Position
                if (obj.parent) {
                    const parentPos = getOrbitalPosition(obj.parent, simulationTime);
                    worldPos.add(parentPos);
                }

                // Transform to Render Space
                // Apply Log Scale to the Absolute World Position
                const renderPos = physicsToRender(worldPos);

                // Update Pivot Position
                // Moons are attached to `pivot` which is a child of the Scene (or Planet).
                // Wait, in `procedural.js`, we attached moons to the Planet's Pivot.
                // So if we set `moon.pivot.position` to `renderPos`, it is Relative to Planet Pivot.
                // Planet Pivot is at `renderPos_Planet`.
                // So Moon Pivot Position should be `renderPos_Moon - renderPos_Planet`.

                if (obj.parent) {
                     // We need the parent's render position to calculate the offset
                     const parentPosPhys = getOrbitalPosition(obj.parent, simulationTime);
                     const parentPosRender = physicsToRender(parentPosPhys);

                     // Relative Offset
                     const relativePos = renderPos.clone().sub(parentPosRender);
                     obj.pivot.position.copy(relativePos);
                } else {
                     // Planet (Child of Scene)
                     obj.pivot.position.copy(renderPos);
                }

                // Self Rotation (Visual Mesh)
                if (obj.mesh) {
                    obj.mesh.rotation.y += 0.01 * timeScale; // Simple spin
                }
            }
        });

        // Update Instanced Meshes
        scene.updateMatrixWorld();
        if (instanceRegistry) {
            instanceRegistry.update();
        }

        // Update Asteroid Belt
        if (asteroidBelt && asteroidBelt.update) {
            asteroidBelt.update(simulationTime);
        }

        // Update Kuiper Belt
        if (kuiperBelt && kuiperBelt.update) {
            kuiperBelt.update(simulationTime);
        }

        // Update Oort Cloud (Static Physics - Rotate Only)
        if (oortCloud && oortCloud.update) {
            oortCloud.update(simulationTime);
        }

        // Rotate Starfield
        if (starfield) starfield.rotation.y += 0.0003;
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
        const targetPos = new THREE.Vector3();
        targetPos.setFromMatrixPosition(focusTarget.matrixWorld);
        controls.target.copy(targetPos);
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
            loading.innerHTML = `<div style="color:red; text-align:center; padding-top:20%">
                <h1>Failed to Start</h1>
                <p>${err.message}</p>
            </div>`;
        }
    });
}
