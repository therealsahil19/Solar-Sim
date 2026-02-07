/**
 * @file main.ts
 * @description The "Conductor" module for the Solar System simulation.
 * It orchestrates the initialization of the 3D scene, manages the render loop,
 * handles global state (scene, camera, renderer), and coordinates interaction between modules.
 */

import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
    createStarfield,
    createSun,
    createPlayerShip,
    createSystem,
    clearMaterialCache,
    type ExtendedTextureLoader,
    type AnimatedBody,
    type SunMesh
} from './procedural';
import type { CelestialBody } from './types/system';
import { createBelt } from './debris';
import { setupControls, setupInteraction, type InteractionResult } from './input';
import { injectSkeletons } from './utils/SkeletonUtils';
import { InstanceRegistry } from './instancing';
import { TrailManager } from './trails';
import { getOrbitalPosition, physicsToRender } from './physics';
import { ToastManager } from './managers/ToastManager';
import './benchmark'; // Auto-load performance benchmark

// ============================================================================
// Window Extensions
// ============================================================================

declare global {
    interface Window {
        scene: THREE.Scene | null;
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
const allLabels: CSS2DObject[] = [];

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
let labelsNeedUpdate = true;
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

let animationFrameId: number | null = null;

window.scene = null;
window.playerShip = null;
window.controls = null;
window.isPaused = isPaused;
window.THREE = THREE;

interface LabelCollisionData {
    label: CSS2DObject;
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
}

// Optimization: Reuse grid for label collision
let labelGrid: LabelCollisionData[][] = [];
let labelGridCols = 0;
let labelGridRows = 0;

// Optimization: Reuse objects for visible labels to prevent GC
const visibleLabelsList: LabelCollisionData[] = [];
const labelPool: LabelCollisionData[] = [];

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


/**
 * Initializes the application.
 */
export async function init(): Promise<void> {
    // Reset Global State
    interactionTargets.length = 0;
    animatedObjects.length = 0;
    planets.length = 0;
    allOrbits.length = 0;
    allTrails.length = 0;
    allLabels.length = 0;

    clearMaterialCache();

    // Setup Three.js Components
    scene = new THREE.Scene();
    window.scene = scene;

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100000);
    camera.position.set(0, 60, 100);

    // Cancel any existing animation loop
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    // Reuse existing WebGLRenderer if it exists
    if (!renderer) {
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.domElement.setAttribute('role', 'application');
        renderer.domElement.setAttribute('aria-label', '3D Solar System Simulation');
        document.body.appendChild(renderer.domElement);
    }
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Reuse existing CSS2DRenderer if it exists
    if (!labelRenderer) {
        labelRenderer = new CSS2DRenderer();
        labelRenderer.domElement.style.position = 'absolute';
        labelRenderer.domElement.style.top = '0px';
        labelRenderer.domElement.style.pointerEvents = 'none';
        document.body.appendChild(labelRenderer.domElement);
    }
    labelRenderer.setSize(window.innerWidth, window.innerHeight);

    // Lighting
    const pointLight = new THREE.PointLight(0xffffff, 1.5, 0, 0);
    pointLight.castShadow = true;
    pointLight.shadow.mapSize.width = 1024;
    pointLight.shadow.mapSize.height = 1024;
    pointLight.shadow.bias = -0.0001;
    scene.add(pointLight);

    const ambientLight = new THREE.AmbientLight(0x606060);
    scene.add(ambientLight);

    // Loading Manager
    // Note: We no longer have a blocking loading screen.
    // The UI is shown immediately with skeletons.
    const navList = document.getElementById('nav-list');
    if (navList) {
        injectSkeletons(navList, 5, { height: '32px' }, 'nav-btn');
    }
    const manager = new THREE.LoadingManager();
    let initFailed = false;

    manager.onLoad = function (): void {
        if (initFailed) return;
        const screen = document.getElementById('loading-screen');
        if (screen) screen.setAttribute('aria-hidden', 'true');
        // ToastManager.getInstance().show("Simulation Ready", { type: 'success' });
    };

    const textureLoader = new THREE.TextureLoader(manager) as ExtendedTextureLoader;
    textureLoader.lazyLoadQueue = [];

    instanceRegistry = new InstanceRegistry(scene);
    trailManager = new TrailManager(scene, 5000, 100);
    window.trailManager = trailManager; // Expose for performance testing

    textureLoader.instanceRegistry = instanceRegistry;
    textureLoader.trailManager = trailManager;

    // Create Initial Objects
    starfield = createStarfield();
    scene.add(starfield);

    const sun: SunMesh = createSun(textureLoader, useTextures);
    scene.add(sun);
    interactionTargets.push(sun);

    playerShip = createPlayerShip();
    scene.add(playerShip);
    window.playerShip = playerShip;

    // ⚡ Bolt Optimization: Start Rendering Immediately
    // Start the loop now so the user sees the starfield/sun while
    // the rest of the system streams in via chunked loading.
    lastFrameTime = performance.now();
    animate();

    // Load System Data
    let planetData: CelestialBody[] | null = null;
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const configUrl = urlParams.get('config') ?? 'system.json';
        const response = await fetch(configUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        planetData = await response.json() as CelestialBody[];

        if (!Array.isArray(planetData)) {
            throw new Error('Invalid configuration: planetData must be an array.');
        }

        // ⚡ Bolt Optimization: Chunked Loading
        // Instead of processing all systems in one blocking call, we process them
        // in chunks to allow the browser to paint and handle events.
        const CHUNK_SIZE = 5;
        for (let i = 0; i < planetData.length; i += CHUNK_SIZE) {
            const chunk = planetData.slice(i, i + CHUNK_SIZE);

            chunk.forEach(config => {
                if (config.type === 'Belt') {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                allLabels.push(...systemNode.labels);

                if (systemNode.animated.length > 0) {
                    const primary = systemNode.animated[0];
                    if (primary?.pivot) planets.push(primary.pivot);
                }
            });

            // Yield to main thread
            await new Promise(resolve => requestAnimationFrame(resolve));
        }

        instanceRegistry.build();

        instanceRegistry.groups.forEach(group => {
            if (group.mesh) interactionTargets.push(group.mesh);
        });

        if (!initFailed) {
            // Reveal content if hidden (though we are now optimistic)
        }

    } catch (error) {
        console.error("Failed to load system data:", error);
        initFailed = true;
        throw error;
    }

    // Setup Controls & Input
    controls = setupControls(camera, renderer.domElement);
    window.controls = controls;

    const context = {
        camera,
        rendererDomElement: renderer.domElement,
        interactionTargets,
        instanceRegistry,
        planetData: planetData ?? undefined
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

    // Apply Saved Settings
    if (interactionHelpers.settingsPanel) {
        const savedSettings = interactionHelpers.settingsPanel.getSettings();

        if (!savedSettings.textures && useTextures) {
            toggleTextures(document.getElementById('btn-texture'));
        }
        if (!savedSettings.labels && showLabels) {
            toggleLabels();
        }
        if (!savedSettings.orbits && showOrbits) {
            toggleOrbits();
        }
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

    if (textureLoader.lazyLoadQueue && textureLoader.lazyLoadQueue.length > 0) {
        setTimeout(() => {
            if (initFailed || !textureLoader.lazyLoadQueue) return;
            console.log(`Bolt ⚡: Lazy loading ${textureLoader.lazyLoadQueue.length} textures...`);
            textureLoader.lazyLoadQueue.forEach(item => {
                const tex = textureLoader.load(item.url);
                item.material.map = tex;
                item.material.color.setHex(0xffffff);
                item.material.needsUpdate = true;
            });
            textureLoader.lazyLoadQueue = [];
        }, 2000);
    }

    window.addEventListener('resize', onWindowResize);

    lastFrameTime = performance.now();

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
        const userData = mesh.userData as Record<string, unknown>;
        if (useTextures && userData.texturedMaterial) {
            (mesh as THREE.Mesh).material = userData.texturedMaterial as THREE.Material;
        } else if (!useTextures && userData.solidMaterial) {
            (mesh as THREE.Mesh).material = userData.solidMaterial as THREE.Material;
        }
    });
    if (instanceRegistry) {
        instanceRegistry.groups.forEach(group => {
            if (group.mesh && group.instances.length > 0) {
                const sampleUserData = group.instances[0]?.pivot.userData as Record<string, unknown>;
                if (useTextures && sampleUserData?.texturedMaterial) {
                    group.mesh.material = sampleUserData.texturedMaterial as THREE.Material;
                } else if (!useTextures && sampleUserData?.solidMaterial) {
                    group.mesh.material = sampleUserData.solidMaterial as THREE.Material;
                }
            }
        });
    }
    ToastManager.getInstance().show(`Textures: ${useTextures ? "ON" : "OFF"}`);
}

function toggleLabels(): void {
    showLabels = !showLabels;
    labelsNeedUpdate = true;
    const btn = document.getElementById('btn-labels');
    if (btn) btn.setAttribute('aria-pressed', String(showLabels));
    allLabels.forEach(label => { label.visible = showLabels; });
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

// ============================================================================
// Animation Loop
// ============================================================================

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
        simulationTime += dt * 0.2 * timeScale;

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
                    obj.mesh.rotation.y += 0.5 * dt * timeScale;
                }
            }
        }

        scene.updateMatrixWorld();
        instanceRegistry?.update();
        belts.forEach(belt => belt.update?.(simulationTime));
        if (starfield) starfield.rotation.y += 0.02 * dt;
    }

    // Camera Logic
    if (isShipView && playerShip && controls) {
        controls.target.copy(playerShip.position);
        camera.position.set(
            playerShip.position.x + 5,
            playerShip.position.y + 3,
            playerShip.position.z + 5
        );
    } else if (focusTarget && controls) {
        tempVec.setFromMatrixPosition(focusTarget.matrixWorld);
        controls.target.copy(tempVec);
    }

    // Player Ship AI
    if (playerShip && frameCount % 10 === 0) {
        let closestDist = Infinity;
        let closestObj: THREE.Object3D | null = null;
        const shipPos = playerShip.position;

        const len = planets.length;
        for (let i = 0; i < len; i++) {
            const p = planets[i];
            if (!p) continue;
            tempVec.setFromMatrixPosition(p.matrixWorld);
            const dist = shipPos.distanceToSquared(tempVec);
            if (dist < closestDist) {
                closestDist = dist;
                closestObj = p;
            }
        }
        closestObjectCache = closestObj;
    }
    if (closestObjectCache && playerShip) {
        tempVec.setFromMatrixPosition(closestObjectCache.matrixWorld);
        playerShip.lookAt(tempVec);
    }

    frameCount++;

    // UI Updates
    if (selectedObject && frameCount % 10 === 0) {
        const distEl = document.getElementById('info-dist-sun');
        if (distEl) {
            const userData = selectedObject.userData as Record<string, unknown>;
            const physics = userData.physics as Record<string, unknown> | undefined;
            if (physics?.a) {
                distEl.textContent = `Orbit: ${physics.a} AU`;
            } else {
                tempVec.setFromMatrixPosition(selectedObject.matrixWorld);
                distEl.textContent = `Render Dist: ${tempVec.distanceTo(sunPos).toFixed(1)}`;
            }
        }
    }

    // Render
    controls?.update();
    if (renderer) {
        renderer.render(scene, camera);
        if ((showLabels || labelsNeedUpdate) && labelRenderer) {
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const edgeMargin = 40;
            const fadeZone = 60;

            // ⚡ Bolt Optimization: Use mathematical projection instead of getBoundingClientRect
            // to avoid Layout Thrashing (Read-Write-Read-Write cycle).
            // We approximate label size for edge fading and overlap detection.
            const approxLabelWidth = 100;
            const approxLabelHeight = 20;
            visibleLabelsList.length = 0;
            let labelPoolIndex = 0;

            const len = allLabels.length;
            for (let i = 0; i < len; i++) {
                const label = allLabels[i];
                if (!label) continue;

                if (label.userData.isMoon) {
                    const parentName = label.userData.parentPlanet;
                    const isParentFocused = focusTarget?.userData.name === parentName;
                    const isParentSelected = selectedObject?.userData.name === parentName;
                    label.visible = showLabels && (isParentFocused || isParentSelected);
                } else {
                    label.visible = showLabels;
                }

                if (label.visible && label.element) {
                    // Project 3D position to 2D screen coordinates
                    // We assume the label is attached to a parent object or has its own position
                    // CSS2DObject.position is in World Space.
                    tempVec.copy(label.position);
                    tempVec.project(camera); // Now in NDC (-1 to +1)

                    const x = (tempVec.x * .5 + .5) * viewportWidth;
                    const y = (-(tempVec.y * .5) + .5) * viewportHeight;

                    // Approximate bounding box centered on the point
                    const left = x - (approxLabelWidth / 2);
                    const right = x + (approxLabelWidth / 2);
                    const top = y - (approxLabelHeight / 2);
                    const bottom = y + (approxLabelHeight / 2);

                    let opacity = 1;

                    // Edge Fading Logic using projected coordinates
                    const distLeft = left;
                    const distRight = viewportWidth - right;
                    const distTop = top;
                    const distBottom = viewportHeight - bottom;
                    const minDist = Math.min(distLeft, distRight, distTop, distBottom);

                    // Check if behind camera (NDC z > 1)
                    if (tempVec.z > 1) {
                        opacity = 0;
                    } else if (minDist < edgeMargin) {
                        opacity = 0;
                    } else if (minDist < edgeMargin + fadeZone) {
                        opacity = (minDist - edgeMargin) / fadeZone;
                    }

                    // ⚡ Bolt Optimization: Prevent Layout Thrashing
                    // 1. Only update DOM if value changed (cache in userData)
                    // 2. Defer updates for collision candidates to avoid double-write
                    const lastOpacity = label.userData._lastOpacity ?? -1;
                    const isMobile = viewportWidth < 768;
                    const isCandidate = isMobile && opacity > 0 && !label.userData.isMoon;

                    if (isCandidate) {
                        // Defer application until collision check
                        label.userData._tentativeOpacity = opacity;

                        let item = labelPool[labelPoolIndex];
                        if (!item) {
                            item = {
                                label,
                                x: left,
                                y: top,
                                width: approxLabelWidth,
                                height: approxLabelHeight,
                                z: tempVec.z
                            };
                            labelPool[labelPoolIndex] = item;
                        } else {
                            item.label = label;
                            item.x = left;
                            item.y = top;
                            item.width = approxLabelWidth;
                            item.height = approxLabelHeight;
                            item.z = tempVec.z;
                        }

                        visibleLabelsList.push(item);
                        labelPoolIndex++;
                    } else {
                        // Apply immediately
                        if (Math.abs(lastOpacity - opacity) > 0.001) {
                            label.element.style.opacity = String(opacity);
                            label.userData._lastOpacity = opacity;
                        }
                    }
                }
            }

            // ⚡ Bolt Optimization: Spatial Grid Collision Detection
            // Replaces O(N^2) loop with O(N) grid-based check.
            if (viewportWidth < 768) {
                // 1. Sort by Z-depth (NDC z is -1 to 1, smaller is closer)
                visibleLabelsList.sort((a, b) => a.z - b.z);

                const cellWidth = 100;
                const cellHeight = 20;
                const neededCols = Math.ceil(viewportWidth / cellWidth);
                const neededRows = Math.ceil(viewportHeight / cellHeight);

                if (neededCols !== labelGridCols || neededRows !== labelGridRows) {
                    labelGridCols = neededCols;
                    labelGridRows = neededRows;
                    labelGrid = new Array(labelGridCols * labelGridRows).fill(null).map(() => []);
                } else {
                    // Clear existing grid
                    for (let i = 0; i < labelGrid.length; i++) {
                        const cell = labelGrid[i];
                        if (cell) cell.length = 0;
                    }
                }

                const getGridIndex = (c: number, r: number) => {
                    if (c < 0 || c >= labelGridCols || r < 0 || r >= labelGridRows) return -1;
                    return r * labelGridCols + c;
                };

                for (const item of visibleLabelsList) {
                    const startCol = Math.floor(item.x / cellWidth);
                    const endCol = Math.floor((item.x + item.width) / cellWidth);
                    const startRow = Math.floor(item.y / cellHeight);
                    const endRow = Math.floor((item.y + item.height) / cellHeight);

                    let isBlocked = false;

                    // Check neighbors in occupied cells
                    checkLoop:
                    for (let r = startRow; r <= endRow; r++) {
                        for (let c = startCol; c <= endCol; c++) {
                            const idx = getGridIndex(c, r);
                            if (idx !== -1) {
                                const cellItems = labelGrid[idx];
                                if (cellItems) {
                                    for (const other of cellItems) {
                                        const overlap = !(
                                            (item.x + item.width) < other.x ||
                                            item.x > (other.x + other.width) ||
                                            (item.y + item.height) < other.y ||
                                            item.y > (other.y + other.height)
                                        );
                                        if (overlap) {
                                            isBlocked = true;
                                            break checkLoop;
                                        }
                                    }
                                }
                            }
                        }
                    }

                    let targetOpacity = item.label.userData._tentativeOpacity;

                    if (isBlocked) {
                        targetOpacity = 0;
                    } else {
                        // Mark as occupied
                        for (let r = startRow; r <= endRow; r++) {
                            for (let c = startCol; c <= endCol; c++) {
                                const idx = getGridIndex(c, r);
                                if (idx !== -1) labelGrid[idx]?.push(item);
                            }
                        }
                    }

                    // Apply deferred update
                    const last = item.label.userData._lastOpacity ?? -1;
                    if (Math.abs(last - targetOpacity) > 0.001) {
                        item.label.element.style.opacity = String(targetOpacity);
                        item.label.userData._lastOpacity = targetOpacity;
                    }
                }
            }

            labelRenderer.render(scene, camera);
            if (!showLabels) labelsNeedUpdate = false;
        }
    }

    // Trails
    if (!isPaused && showOrbits && frameCount % 2 === 0 && trailManager && renderer) {
        trailManager.update(renderer);
    }
}

function onWindowResize(): void {
    if (camera && renderer && labelRenderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        labelRenderer.setSize(window.innerWidth, window.innerHeight);
    }
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
    if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
        renderer = null;
    }
    if (labelRenderer) {
        labelRenderer.domElement.remove();
        labelRenderer = null;
    }
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
                    <p style="margin-bottom: 2rem;">${err.message || 'An unexpected error occurred during initialization.'}</p>
                    <button onclick="window.location.reload()" class="btn-primary" style="cursor: pointer;">
                        🔄 Reload Simulation
                    </button>
                </div>
            `;
            // Ensure overlay is visible
            overlay.style.display = 'grid';
        }
    });
}
