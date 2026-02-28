/**
 * @file main.ts
 * @description The "Conductor" module for the Solar System simulation.
 * It orchestrates the initialization of the 3D scene, manages the render loop,
 * handles global state (scene, camera, renderer), and coordinates interaction between modules.
 */

import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
    createStarfield,
    createSun,
    createPlayerShip,
    createSystem,
    clearMaterialCache,
    type ExtendedTextureLoader,
    type AnimatedBody
} from './procedural';
import type { CelestialBody } from './types/system';
import type { SolarSimUserData } from './types';
import { createBelt } from './debris';
import { setupControls, setupInteraction, type InteractionResult } from './input';
import { injectSkeletons } from './utils/SkeletonUtils';
import { InstanceRegistry } from './instancing';
import { TrailManager } from './trails';
import { getOrbitalPosition, physicsToRender } from './physics';
import { ToastManager } from './managers/ToastManager';
import { getPositionFromMatrix } from './utils/ThreeUtils';
import { LabelManager } from './managers/LabelManager';
import { SceneManager } from './managers/SceneManager';
import './benchmark'; // Auto-load performance benchmark

// ============================================================================
// Window Extensions
// ============================================================================

declare global {
    interface Window {
        playerShip: THREE.Group | null;
        controls: OrbitControls | null;
        isPaused: boolean;
        __SKIP_INIT__?: boolean;
        trailManager: TrailManager | null;
        THREE: typeof THREE;
    }
}



// ============================================================================
// State & Globals
// ============================================================================

/** Exported for access by tests and other modules */
export const animatedObjects: AnimatedBody[] = [];

/** Optimization for raycasting */
const interactionTargets: THREE.Object3D[] = [];

/** List of primary planets for shortcuts */
const planets: THREE.Group[] = [];

const allOrbits: THREE.LineLoop[] = [];
const allTrails: unknown[] = [];

let playerShip: THREE.Group | null = null;
let starfield: THREE.Points | null = null;
let controls: OrbitControls | null = null;

export let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer | null = null;
let labelRenderer: CSS2DRenderer | null = null;

let useTextures = true;
let isShipView = false;
let isPaused = false;
let showLabels = true;
let showOrbits = true;
let timeScale = 1.0;

// Physics Time (Years)
let simulationTime = 0;
let lastFrameTime = 0;

let focusTarget: THREE.Object3D | null = null;
let selectedObject: THREE.Object3D | null = null;
let interactionHelpers: InteractionResult | null = null;

let frameCount = 0;
let closestObjectCache: THREE.Object3D | null = null;
const belts: Array<THREE.Object3D & { update?: (time: number) => void }> = [];
let instanceRegistry: InstanceRegistry | null = null;
let trailManager: TrailManager | null = null;
let labelManager: LabelManager | null = null;
let sceneManager: SceneManager | null = null;

let animationFrameId: number | null = null;

window.playerShip = null;
window.controls = null;
window.isPaused = isPaused;
window.THREE = THREE;

// Label collision logic moved to LabelManager

// ============================================================================
// Initialization
// ============================================================================

/**
 * Solar-Sim: The "Conductor" Module.
 *
 * Responsibilities:
 * 1. Scene Orchestration: Setting up Three.js WebGLRenderer, Camera, and Scene.
 * 2. Lifecycle Management: Handling window resizing, loading data, and disposal.
 * 3. Physics Loop: Driving the animation loop and synchronizing all sub-modules.
 * 4. State Integration: Bridging UI Settings with low-level rendering logic.
 */

// Simulation constants
const SIMULATION_SPEED_BASE = 0.2;
const BODY_ROTATION_SPEED = 0.5;
const STARFIELD_ROTATION_SPEED = 0.02;



const LOGIC_UPDATE_INTERVAL = 10;

const MAX_TRAILS = 5000;
const TRAIL_POINTS = 100;

const LAZY_LOAD_DELAY = 2000;


/**
 * Initializes the application.
 */
// ============================================================================
// Initialization Helpers
// ============================================================================

function initThreeJSEnvironment(): void {
    if (!sceneManager) {
        sceneManager = new SceneManager();
    }
    scene = sceneManager.scene;
    camera = sceneManager.camera;
    renderer = sceneManager.renderer;
    labelRenderer = sceneManager.labelRenderer;

    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    labelManager = new LabelManager(labelRenderer, camera);
}

function initLighting(): void {
    const pointLight = new THREE.PointLight(0xffffff, 1.5, 0, 0);
    pointLight.castShadow = true;
    pointLight.shadow.mapSize.width = 1024;
    pointLight.shadow.mapSize.height = 1024;
    pointLight.shadow.bias = -0.0001;
    scene.add(pointLight);

    const ambientLight = new THREE.AmbientLight(0x606060);
    scene.add(ambientLight);
}

function initManagers(manager: THREE.LoadingManager): ExtendedTextureLoader {
    const textureLoader = new THREE.TextureLoader(manager) as ExtendedTextureLoader;
    textureLoader.lazyLoadQueue = [];

    instanceRegistry = new InstanceRegistry(scene);
    trailManager = new TrailManager(scene, MAX_TRAILS, TRAIL_POINTS);
    window.trailManager = trailManager;

    textureLoader.instanceRegistry = instanceRegistry;
    textureLoader.trailManager = trailManager;
    return textureLoader;
}

function initInitialObjects(textureLoader: ExtendedTextureLoader): void {
    starfield = createStarfield();
    scene.add(starfield);

    const sun = createSun(textureLoader, useTextures);
    scene.add(sun);
    interactionTargets.push(sun);

    playerShip = createPlayerShip();
    scene.add(playerShip);
    window.playerShip = playerShip;
}

async function fetchSystemData(): Promise<CelestialBody[]> {
    const urlParams = new URLSearchParams(window.location.search);
    let configUrl = urlParams.get('config') ?? 'system.json';

    try {
        const parsedUrl = new URL(configUrl, window.location.origin);
        const isLocal = parsedUrl.origin === window.location.origin;
        const isTrustedProtocol = parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';

        if (!isLocal || !isTrustedProtocol) {
            console.warn('Blocked external/untrusted config URL:', configUrl);
            configUrl = 'system.json';
            ToastManager.getInstance().show("External config blocked. Loaded default system.", { type: 'error' });
        }
    } catch (e) {
        console.warn('Invalid config URL:', configUrl);
        configUrl = 'system.json';
    }

    const response = await fetch(configUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const planetData = await response.json() as CelestialBody[];

    if (!Array.isArray(planetData)) {
        throw new Error('Invalid configuration: planetData must be an array.');
    }
    return planetData;
}

async function buildSystemChunks(planetData: CelestialBody[], textureLoader: ExtendedTextureLoader): Promise<void> {
    const CHUNK_SIZE = 5;
    for (let i = 0; i < planetData.length; i += CHUNK_SIZE) {
        const chunk = planetData.slice(i, i + CHUNK_SIZE);

        chunk.forEach(config => {
            if (config.type === 'Belt') {
                const belt = createBelt(config as any);
                scene.add(belt);
                belts.push(belt);
                return;
            }

            const systemNode = createSystem(config, textureLoader, useTextures, null);

            scene.add(systemNode.pivot);
            if (systemNode.orbit) scene.add(systemNode.orbit);

            interactionTargets.push(...systemNode.interactables);
            animatedObjects.push(...systemNode.animated);
            allOrbits.push(...systemNode.orbits);
            allTrails.push(...systemNode.trails);
            if (labelManager) systemNode.labels.forEach(l => labelManager?.add(l));

            if (systemNode.animated.length > 0) {
                const primary = systemNode.animated[0];
                if (primary?.pivot) planets.push(primary.pivot);
            }
        });

        await new Promise(resolve => requestAnimationFrame(resolve));
    }
}

/**
 * Initializes the entire application state and kicks off the render loop.
 */
export async function init(): Promise<void> {
    interactionTargets.length = 0;
    animatedObjects.length = 0;
    planets.length = 0;
    allOrbits.length = 0;
    allTrails.length = 0;

    clearMaterialCache();

    initThreeJSEnvironment();
    initLighting();

    const navList = document.getElementById('nav-list');
    if (navList) {
        injectSkeletons(navList, 5, { height: '32px' }, 'nav-btn');
    }

    let initFailed = false;
    const manager = new THREE.LoadingManager();
    manager.onLoad = function (): void {
        if (initFailed) return;
        const screen = document.getElementById('loading-screen');
        if (screen) screen.setAttribute('aria-hidden', 'true');
    };

    const textureLoader = initManagers(manager);
    initInitialObjects(textureLoader);

    lastFrameTime = performance.now();
    animate();

    let planetData: CelestialBody[] | null = null;
    try {
        planetData = await fetchSystemData();
        await buildSystemChunks(planetData, textureLoader);

        instanceRegistry!.build();
        trailManager?.flushRegistrations();

        instanceRegistry!.groups.forEach(group => {
            if (group.mesh) interactionTargets.push(group.mesh);
        });
    } catch (error) {
        console.error("Failed to load system data:", error);
        initFailed = true;
        throw error;
    }

    setupInteractionsAndUI(planetData);

    if (textureLoader.lazyLoadQueue && textureLoader.lazyLoadQueue.length > 0) {
        setTimeout(() => {
            if (initFailed || !textureLoader.lazyLoadQueue) return;
            textureLoader.lazyLoadQueue.forEach(item => {
                const tex = textureLoader.load(item.url);
                item.material.map = tex;
                item.material.color.setHex(0xffffff);
                item.material.needsUpdate = true;
            });
            textureLoader.lazyLoadQueue = [];
        }, LAZY_LOAD_DELAY);
    }

    window.addEventListener('resize', onWindowResize);
    lastFrameTime = performance.now();
}

function setupInteractionsAndUI(planetData: CelestialBody[] | undefined) {
    controls = setupControls(camera, renderer!.domElement);
    window.controls = controls;

    const context = {
        camera,
        rendererDomElement: renderer!.domElement,
        interactionTargets,
        instanceRegistry: instanceRegistry!,
        ...(planetData ? { planetData } : {})
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

    if (interactionHelpers.settingsPanel) {
        const savedSettings = interactionHelpers.settingsPanel.getSettings();

        if (!savedSettings.textures && useTextures) toggleTextures(document.getElementById('btn-texture'));
        if (!savedSettings.labels && showLabels) toggleLabels();
        if (!savedSettings.orbits && showOrbits) toggleOrbits();
        if (savedSettings.speed !== 1.0) {
            updateTimeScale(savedSettings.speed);
            const dockSlider = document.getElementById('slider-speed') as HTMLInputElement | null;
            const dockValue = document.getElementById('speed-value');
            if (dockSlider) dockSlider.value = String(savedSettings.speed);
            if (dockValue) dockValue.textContent = `${savedSettings.speed.toFixed(1)}x`;
        }

        toggleBelt('asteroid_belt', savedSettings.asteroidBelt !== false);
        toggleBelt('kuiper_belt', savedSettings.kuiperBelt !== false);
        toggleBelt('oort_cloud', savedSettings.oortCloud !== false);
    }
}

// ============================================================================
// Logic Helpers
// ============================================================================

function toggleCameraView(): void {
    isShipView = !isShipView;
    const btn = document.getElementById('btn-camera');
    if (btn) btn.setAttribute('aria-pressed', String(isShipView));

    if (isShipView) {
        focusTarget = null;
        if (playerShip && controls) {
            controls.target.copy(playerShip.position);
            camera.position.set(
                playerShip.position.x + 5,
                playerShip.position.y + 3,
                playerShip.position.z + 5
            );
        }
    } else {
        if (controls) {
            controls.target.set(0, 0, 0);
            camera.position.set(0, 60, 100);
        }
    }
    controls?.update();
}

function resetCamera(): void {
    isShipView = false;
    focusTarget = null;
    const btn = document.getElementById('btn-camera');
    if (btn) btn.setAttribute('aria-pressed', 'false');

    if (controls) {
        controls.target.set(0, 0, 0);
        camera.position.set(0, 60, 100);
        controls.update();
    }
    ToastManager.getInstance().show("View Reset");
}

function setFocusTarget(mesh: THREE.Object3D): void {
    focusTarget = mesh;
    isShipView = false;
    const name = mesh.userData.name ?? "Object";
    ToastManager.getInstance().show(`Following ${name}`);
}

function updateTimeScale(scale: number): void {
    timeScale = scale;
}

function toggleTextures(btnElement: HTMLElement | null): void {
    useTextures = !useTextures;
    if (btnElement) {
        btnElement.textContent = useTextures ? "HD" : "LD";
        btnElement.setAttribute('aria-pressed', String(useTextures));
    }
    interactionTargets.forEach(mesh => {
        const userData = mesh.userData as SolarSimUserData;
        if (useTextures && userData.texturedMaterial) {
            (mesh as THREE.Mesh).material = userData.texturedMaterial;
        } else if (!useTextures && userData.solidMaterial) {
            (mesh as THREE.Mesh).material = userData.solidMaterial;
        }
    });
    if (instanceRegistry) {
        instanceRegistry.groups.forEach(group => {
            if (group.mesh && group.instances.length > 0) {
                const sampleUserData = group.instances[0]?.pivot.userData as SolarSimUserData;
                if (useTextures && sampleUserData?.texturedMaterial) {
                    group.mesh.material = sampleUserData.texturedMaterial;
                } else if (!useTextures && sampleUserData?.solidMaterial) {
                    group.mesh.material = sampleUserData.solidMaterial;
                }
            }
        });
    }
    ToastManager.getInstance().show(`Textures: ${useTextures ? "ON" : "OFF"}`);
}

function toggleLabels(): void {
    showLabels = !showLabels;
    labelManager?.toggle(showLabels);
    // labelsNeedUpdate = true; // Handled by LabelManager
    const btn = document.getElementById('btn-labels');
    if (btn) btn.setAttribute('aria-pressed', String(showLabels));
    // allLabels.forEach(label => { label.visible = showLabels; });
    ToastManager.getInstance().show(`Labels: ${showLabels ? "ON" : "OFF"}`);
}

function toggleBelt(type: string, visible: boolean): void {
    belts.forEach(belt => {
        if (belt.userData?.type === type) {
            belt.visible = visible;
        }
    });
}

function toggleOrbits(): void {
    showOrbits = !showOrbits;
    const btn = document.getElementById('btn-orbits');
    if (btn) btn.setAttribute('aria-pressed', String(showOrbits));
    allTrails.forEach(trail => {
        if (trail && typeof trail === 'object' && 'visible' in trail) {
            (trail as THREE.Object3D).visible = showOrbits;
        }
    });
    ToastManager.getInstance().show(`Orbits: ${showOrbits ? "ON" : "OFF"}`);
}

function togglePause(btnElement: HTMLElement | null): void {
    isPaused = !isPaused;
    window.isPaused = isPaused;
    if (btnElement) {
        if (isPaused) {
            btnElement.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
            btnElement.setAttribute('aria-label', "Resume Simulation");
        } else {
            btnElement.setAttribute('aria-label', "Pause Simulation");
        }
    }
    ToastManager.getInstance().show(isPaused ? "Simulation Paused" : "Simulation Resumed", { type: isPaused ? 'info' : 'success' });

    const srStatus = document.getElementById('sr-status');
    if (srStatus) {
        srStatus.textContent = isPaused ? "Simulation paused" : "Simulation resumed";
    }
}

function focusPlanet(index: number): void {
    if (index < 0 || index >= planets.length) return;
    const planet = planets[index];
    if (!planet) return;
    setFocusTarget(planet);
    handleObjectSelection(planet);
    interactionHelpers?.updateSelectionUI(planet);
}

function handleObjectSelection(mesh: THREE.Object3D): void {
    selectedObject = mesh;
}



// Pre-allocated vectors for animate loop
const tempVec = new THREE.Vector3();
const sunPos = new THREE.Vector3(0, 0, 0);
const _localPos = new THREE.Vector3();
const _worldPos = new THREE.Vector3();
const _parentPosPhys = new THREE.Vector3();
const _parentPosRender = new THREE.Vector3();
const _renderPos = new THREE.Vector3();

function updateLogic(frameCount: number): void {
    if (playerShip && frameCount % LOGIC_UPDATE_INTERVAL === 0) {
        let closestDist = Infinity;
        let closestObj: THREE.Object3D | null = null;
        const shipPos = playerShip.position;

        const len = planets.length;
        for (let i = 0; i < len; i++) {
            const p = planets[i];
            if (!p) continue;
            getPositionFromMatrix(p, tempVec);
            const dist = shipPos.distanceToSquared(tempVec);
            if (dist < closestDist) {
                closestDist = dist;
                closestObj = p;
            }
        }
        closestObjectCache = closestObj;
    }
    if (closestObjectCache && playerShip) {
        getPositionFromMatrix(closestObjectCache, tempVec);
        playerShip.lookAt(tempVec);
    }
}

// ============================================================================
// Animation Loop
// ============================================================================

function updatePhysics(dt: number): void {
    simulationTime += dt * SIMULATION_SPEED_BASE * timeScale;

    const len = animatedObjects.length;
    for (let i = 0; i < len; i++) {
        const obj = animatedObjects[i];
        if (!obj) continue;
        const physics = obj.physics;
        if (physics && physics.a !== undefined) {
            getOrbitalPosition(physics, simulationTime, _localPos);
            _worldPos.copy(_localPos);

            if (obj.parent) {
                getOrbitalPosition(obj.parent, simulationTime, _parentPosPhys);
                _worldPos.add(_parentPosPhys);
            }

            physicsToRender(_worldPos, _renderPos);

            if (obj.parent) {
                physicsToRender(_parentPosPhys, _parentPosRender);
                obj.pivot.position.copy(_renderPos).sub(_parentPosRender);
            } else {
                obj.pivot.position.copy(_renderPos);
            }

            if (obj.mesh) {
                obj.mesh.rotation.y += BODY_ROTATION_SPEED * dt * timeScale;
            }
        }
    }

    belts.forEach(belt => belt.update?.(simulationTime));
    if (starfield) starfield.rotation.y += STARFIELD_ROTATION_SPEED * dt;
    scene.updateMatrixWorld();
    instanceRegistry?.update();
}

function updateCamera(): void {
    if (isShipView && playerShip && controls) {
        controls.target.copy(playerShip.position);
        camera.position.set(
            playerShip.position.x + 5,
            playerShip.position.y + 3,
            playerShip.position.z + 5
        );
    } else if (focusTarget && controls) {
        // Direct matrix access (approx 1.8x faster than setFromMatrixPosition)
        getPositionFromMatrix(focusTarget, tempVec);
        controls.target.copy(tempVec);
    }
}

function updateUI(frameCount: number): void {
    if (selectedObject && frameCount % LOGIC_UPDATE_INTERVAL === 0) {
        const distEl = document.getElementById('info-dist-sun');
        if (distEl) {
            const userData = selectedObject.userData as Record<string, unknown>;
            const physics = userData.physics as Record<string, unknown> | undefined;
            if (physics?.a) {
                distEl.textContent = `Orbit: ${physics.a} AU`;
            } else {
                // Direct matrix access (approx 1.8x faster than setFromMatrixPosition)
                getPositionFromMatrix(selectedObject, tempVec);
                distEl.textContent = `Render Dist: ${tempVec.distanceTo(sunPos).toFixed(1)}`;
            }
        }
    }
}

function renderLabels(): void {
    if (labelManager) {
        labelManager.update(focusTarget, selectedObject);
    }
}

function renderScene(frameCount: number): void {
    controls?.update();
    if (renderer) {
        renderer.render(scene, camera);
        renderLabels();
    }

    // Trails
    if (!isPaused && showOrbits && frameCount % 2 === 0 && trailManager && renderer) {
        trailManager.update(renderer);
    }
}

/**
 * The main animation loop (RequestAnimationFrame).
 * Processed in distinct phases:
 *
 * Phase 1: Logic Synchronization
 * - Increments simulation time based on speed factor.
 * - Updates orbital positions for all tracked planets/moons.
 * - Checks for camera following constraints.
 *
 * Phase 2: Optimization Updates ("Bolt")
 * - Updates InstancedMesh matrices in InstanceRegistry.
 * - Appends new vertices to the TrailManager ring buffers.
 * - Updates uniforms in GPU-based debris systems.
 *
 * Phase 3: Rendering
 * - Executes the Three.js render pass.
 */
function animate(): void {
    animationFrameId = requestAnimationFrame(animate);

    const now = performance.now();
    const rawDt = (now - lastFrameTime) / 1000;
    const dt = Math.min(rawDt, 0.1);
    lastFrameTime = now;

    if (!isPaused) {
        updatePhysics(dt);
    }

    updateCamera();
    updateLogic(frameCount);

    frameCount++;

    updateUI(frameCount);
    renderScene(frameCount);
}

// Removed stray bracket

function onWindowResize(): void {
    sceneManager?.onResize();
}

/**
 * Disposes of all resources.
 */
export function dispose(): void {
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    window.removeEventListener('resize', onWindowResize);

    if (sceneManager) {
        sceneManager.dispose();
        sceneManager = null;
    }

    // Clear references
    renderer = null;
    labelRenderer = null;
    scene = null!;
    camera = null!;
    trailManager?.dispose();
    trailManager = null;
    instanceRegistry?.dispose();
    instanceRegistry = null;
    interactionHelpers?.dispose();
}

// Auto-initialize unless skipped (for testing)
if (!window.__SKIP_INIT__) {
    init().catch((err: Error) => {
        console.error("Initialization failed:", err);
        // Show error toast even if init fails
        ToastManager.getInstance().show(`Initialization Error: ${err.message}`, { type: 'error', duration: 10000 });

        // Fallback visual
        const overlay = document.getElementById('app-overlay');
        if (overlay) {
            overlay.innerHTML = `
                <div class="glass-panel" style="color:var(--text-primary); text-align:center; padding: 2rem; border: 1px solid var(--color-danger); margin: auto;">
                    <h1 style="color:var(--color-danger); margin-bottom: 1rem;">Simulation Error</h1>
                    <p id="error-msg-text" style="margin-bottom: 2rem;"></p>
                    <button id="btn-reload-init" class="btn-primary" style="cursor: pointer;">
                        🔄 Reload Simulation
                    </button>
                </div>
            `;

            const msgEl = document.getElementById('error-msg-text');
            if (msgEl) msgEl.textContent = err.message || 'An unexpected error occurred during initialization.';

            const reloadBtn = document.getElementById('btn-reload-init');
            if (reloadBtn) {
                reloadBtn.addEventListener('click', () => window.location.reload());
            }

            // Ensure overlay is visible
            overlay.style.display = 'grid';
        }
    });
}
