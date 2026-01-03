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
    type SystemData,
    type SunMesh
} from './procedural';
import { createBelt } from './debris';
import { setupControls, setupInteraction, type InteractionResult } from './input';
import { InstanceRegistry } from './instancing';
import { TrailManager } from './trails';
import { getOrbitalPosition, physicsToRender } from './physics';
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

// Bug 048 Fix: Track animation frame ID
let animationFrameId: number | null = null;

window.scene = null;
window.playerShip = null;
window.controls = null;
window.isPaused = isPaused;

// ============================================================================
// Initialization
// ============================================================================

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
    const loadingScreen = document.getElementById('loading-screen');
    const loadingBar = document.getElementById('loading-bar');
    const manager = new THREE.LoadingManager();
    let initFailed = false;

    manager.onProgress = function (_url, itemsLoaded, itemsTotal): void {
        if (loadingBar) {
            const width = (itemsLoaded / itemsTotal) * 100;
            loadingBar.style.width = width + '%';
            loadingBar.setAttribute('aria-valuenow', String(Math.round(width)));
        }
    };
    manager.onLoad = function (): void {
        if (initFailed) return;
    };

    const textureLoader = new THREE.TextureLoader(manager) as ExtendedTextureLoader;
    textureLoader.lazyLoadQueue = [];

    instanceRegistry = new InstanceRegistry(scene);
    trailManager = new TrailManager(scene, 5000, 100);

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

    // Load System Data
    let planetData: SystemData[] | null = null;
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const configUrl = urlParams.get('config') ?? 'system.json';
        const response = await fetch(configUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        planetData = await response.json() as SystemData[];

        if (!Array.isArray(planetData)) {
            throw new Error('Invalid configuration: planetData must be an array.');
        }

        planetData.forEach(config => {
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

        instanceRegistry.build();

        instanceRegistry.groups.forEach(group => {
            if (group.mesh) interactionTargets.push(group.mesh);
        });

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

    // Setup Controls & Input
    controls = setupControls(camera, renderer.domElement);
    window.controls = controls;

    const context = {
        camera,
        rendererDomElement: renderer.domElement,
        interactionTargets,
        instanceRegistry,
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    interactionHelpers = setupInteraction(context as any, callbacks as any);

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
    showToast("View Reset");
}

function setFocusTarget(mesh: THREE.Object3D): void {
    focusTarget = mesh;
    isShipView = false;
    const name = mesh.userData.name ?? "Object";
    showToast(`Following ${name}`);
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
    showToast(`Textures: ${useTextures ? "ON" : "OFF"}`);
}

function toggleLabels(): void {
    showLabels = !showLabels;
    labelsNeedUpdate = true;
    const btn = document.getElementById('btn-labels');
    if (btn) btn.setAttribute('aria-pressed', String(showLabels));
    allLabels.forEach(label => { label.visible = showLabels; });
    showToast(`Labels: ${showLabels ? "ON" : "OFF"}`);
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
    showToast(`Orbits: ${showOrbits ? "ON" : "OFF"}`);
}

function togglePause(btnElement: HTMLElement | null): void {
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

function showToast(message: string): void {
    const toast = document.getElementById('toast') as HTMLElement & { timeout?: ReturnType<typeof setTimeout> };
    if (toast) {
        toast.textContent = message;
        toast.classList.add('visible');
        if (toast.timeout) clearTimeout(toast.timeout);
        toast.timeout = setTimeout(() => toast.classList.remove('visible'), 2000);
    }
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

function animate(): void {
    animationFrameId = requestAnimationFrame(animate);

    const now = performance.now();
    const rawDt = (now - lastFrameTime) / 1000;
    const dt = Math.min(rawDt, 0.1);
    lastFrameTime = now;

    if (!isPaused) {
        simulationTime += dt * 0.2 * timeScale;

        animatedObjects.forEach(obj => {
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
        });

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

            const visibleLabels: Array<{ label: CSS2DObject; rect: DOMRect }> = [];

            allLabels.forEach(label => {
                if (label.userData.isMoon) {
                    const parentName = label.userData.parentPlanet;
                    const isParentFocused = focusTarget?.userData.name === parentName;
                    const isParentSelected = selectedObject?.userData.name === parentName;
                    label.visible = showLabels && (isParentFocused || isParentSelected);
                } else {
                    label.visible = showLabels;
                }

                if (label.visible && label.element) {
                    const rect = label.element.getBoundingClientRect();
                    let opacity = 1;

                    const distLeft = rect.left;
                    const distRight = viewportWidth - rect.right;
                    const distTop = rect.top;
                    const distBottom = viewportHeight - rect.bottom;
                    const minDist = Math.min(distLeft, distRight, distTop, distBottom);

                    if (minDist < edgeMargin) {
                        opacity = 0;
                    } else if (minDist < edgeMargin + fadeZone) {
                        opacity = (minDist - edgeMargin) / fadeZone;
                    }

                    label.element.style.opacity = String(opacity);

                    if (opacity > 0 && !label.userData.isMoon && viewportWidth < 768) {
                        visibleLabels.push({ label, rect });
                    }
                }
            });

            if (viewportWidth < 768) {
                for (let i = 0; i < visibleLabels.length; i++) {
                    for (let j = i + 1; j < visibleLabels.length; j++) {
                        const a = visibleLabels[i]?.rect;
                        const b = visibleLabels[j]?.rect;
                        if (!a || !b) continue;

                        const overlap = !(a.right < b.left || a.left > b.right ||
                            a.bottom < b.top || a.top > b.bottom);

                        if (overlap) {
                            const labelElement = visibleLabels[j]?.label.element;
                            if (labelElement) {
                                labelElement.style.opacity = '0';
                            }
                        }
                    }
                }
            }

            labelRenderer.render(scene, camera);
            if (!showLabels) labelsNeedUpdate = false;
        }
    }

    // Trails
    if (!isPaused && showOrbits && frameCount % 2 === 0 && trailManager) {
        trailManager.update();
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
window.addEventListener('resize', onWindowResize);

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
