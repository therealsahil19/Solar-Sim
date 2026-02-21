/**
 * @file input.ts
 * @description Manages user input and interaction for the simulation.
 *
 * This module handles:
 * 1. Camera controls (OrbitControls).
 * 2. Raycasting for mouse clicks on 3D objects.
 * 3. Keyboard shortcuts (e.g., 'C' for camera toggle).
 * 4. UI event listeners (Buttons).
 * 5. Component Initialization (CommandPalette, NavigationSidebar, InfoPanel, Modal).
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CommandPalette, type CommandPaletteCallbacks } from './components/CommandPalette';
import { NavigationSidebar } from './components/NavigationSidebar';
import { InfoPanel } from './components/InfoPanel';
import { Modal } from './components/Modal';
import { SettingsPanel } from './components/SettingsPanel';
import { ThemeManager } from './managers/ThemeManager';
import { ToastManager } from './managers/ToastManager';
import type { SolarSimUserData } from './types';
import type { CelestialBody } from './types/system';
import type { InstanceRegistry } from './instancing';

/**
 * Context for the interaction system.
 */
export interface InteractionContext {
    camera: THREE.Camera;
    rendererDomElement: HTMLElement;
    interactionTargets: THREE.Object3D[];
    planetData?: CelestialBody[];
    instanceRegistry?: InstanceRegistry;
}

/**
 * Callbacks for interaction events.
 */
export interface InteractionCallbacks {
    onSetFocus: (mesh: THREE.Object3D) => void;
    onObjectSelected: (mesh: THREE.Object3D) => void;
    onToggleTexture: (btn: HTMLElement | null) => void;
    onToggleLabels: () => void;
    onToggleOrbits: () => void;
    onToggleCamera: () => void;
    onTogglePause: (btn: HTMLElement | null) => void;
    onResetCamera: () => void;
    onUpdateTimeScale: (value: number) => void;
    onFocusPlanet: (index: number) => void;
}

/**
 * Result of setting up interactions.
 */
export interface InteractionResult {
    updateSelectionUI: (mesh: THREE.Object3D) => void;
    openModal: () => void;
    closeModal: () => void;
    settingsPanel: SettingsPanel;
    dispose: () => void;
}

/**
 * Updates the normalized device coordinates (NDC) of a target vector.
 * NDC range is [-1, 1] for both x and y.
 *
 * @param target - The vector to update.
 * @param clientX - The client X coordinate (e.g., event.clientX).
 * @param clientY - The client Y coordinate (e.g., event.clientY).
 * @param width - The width of the drawing area.
 * @param height - The height of the drawing area.
 */
export function updateNormalizedCoordinates(
    target: THREE.Vector2,
    clientX: number,
    clientY: number,
    width: number,
    height: number
): void {
    target.x = (clientX / width) * 2 - 1;
    target.y = -(clientY / height) * 2 + 1;
}

/**
 * Sets up the OrbitControls for the camera.
 */
export function setupControls(
    camera: THREE.Camera,
    domElement: HTMLElement
): OrbitControls {
    const controls = new OrbitControls(camera, domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 5;
    return controls;
}

/**
 * Orchestrates all user input, raycasting, and UI component lifecycles.
 *
 * Architecture: "Callback Injection"
 * Instead of importing main.ts directly (avoiding circular deps), this module
 * receives a set of callbacks (InteractionCallbacks) to manipulate the simulation.
 *
 * @param context - The global interaction context (Three.js objects + UI state).
 * @param callbacks - Hooks into the main simulation logic.
 */
export function setupInteraction(
    context: InteractionContext,
    callbacks: InteractionCallbacks
): InteractionResult {
    // 1. Initialize Base Components (Theme, InfoPanel)
    const { themeManager, infoPanel } = initBaseComponents(callbacks);

    // 2. Initialize Selection Logic
    const { updateSelectionUI, selectByName } = createSelectionHelpers(
        context,
        callbacks,
        infoPanel
    );

    // 3. Initialize Modal (Welcome)
    const { welcomeModal, openModal, closeModal } = createWelcomeModal();

    // 4. Initialize Interactive Components (Sidebar, Settings, CommandPalette)
    const { sidebar, settingsPanel, commandPalette } = initInteractiveComponents(
        context,
        callbacks,
        themeManager,
        selectByName,
        openModal
    );

    // 5. Setup Raycasting (Mouse Interaction)
    const raycastingCleanup = setupRaycasting(
        context,
        callbacks,
        updateSelectionUI
    );

    // 6. Setup Keyboard Shortcuts
    const keyboardCleanup = setupKeyboardShortcuts(
        callbacks,
        commandPalette,
        sidebar,
        welcomeModal,
        settingsPanel,
        infoPanel,
        openModal
    );

    // 7. Setup UI Button Bindings
    const uiCleanup = setupUIBindings(callbacks, openModal);

    return {
        updateSelectionUI,
        openModal,
        closeModal,
        settingsPanel,
        dispose: (): void => {
            raycastingCleanup();
            keyboardCleanup();
            uiCleanup();

            commandPalette?.dispose();
            welcomeModal.dispose();
            settingsPanel.dispose();
            sidebar?.dispose();
            infoPanel.dispose();
        }
    };
}

// ------------------------------------------------------------------
// Helper Functions
// ------------------------------------------------------------------

function initBaseComponents(callbacks: InteractionCallbacks) {
    // Theme Manager
    const themeManager = new ThemeManager();

    // Info Panel
    const infoPanel = new InfoPanel({
        callbacks: {
            onFollow: (mesh) => callbacks.onSetFocus(mesh)
        }
    });

    return { themeManager, infoPanel };
}

function createSelectionHelpers(
    context: InteractionContext,
    callbacks: InteractionCallbacks,
    infoPanel: InfoPanel
) {
    const { interactionTargets } = context;

    /**
     * Updates the Side Panel and Toast with details about the selected object.
     */
    function updateSelectionUI(mesh: THREE.Object3D): void {
        if (!mesh) return;

        const d = mesh.userData as SolarSimUserData & Record<string, unknown>;
        let toastText = `Selected: ${d.name ?? 'Unknown'}`;

        if (d.type) {
            const typeLabel = String(d.type).charAt(0).toUpperCase() + String(d.type).slice(1);
            const size = d.size as number | undefined;
            if (size !== undefined && d.type !== 'Star') {
                const isMoon = d.type === 'moon';
                const sizeType = isMoon ? 'Moon' : 'Earth';
                const displaySize = isMoon ? (size / 0.27) : size;
                toastText += ` (${typeLabel}) – ${displaySize.toFixed(2)} × ${sizeType} size`;
            } else {
                toastText += ` (${typeLabel})`;
            }
        }

        ToastManager.getInstance().show(toastText, { type: 'info', duration: 4000 });
        infoPanel.update(mesh);
    }

    function findMeshByName(name: string): THREE.Object3D | null {
        const found = interactionTargets.find(obj => obj.userData.name === name);
        if (found) return found;

        if (context.instanceRegistry) {
            return context.instanceRegistry.findInstanceByName(name);
        }
        return null;
    }

    function selectByName(name: string): void {
        const mesh = findMeshByName(name);
        if (mesh) {
            callbacks.onSetFocus(mesh);
            callbacks.onObjectSelected(mesh);
            updateSelectionUI(mesh);
        } else {
            console.warn(`Mesh not found for: ${name}`);
        }
    }

    return { updateSelectionUI, selectByName };
}

function createWelcomeModal() {
    const welcomeModal = new Modal('welcome-modal', {
        onClose: () => { /* Optional actions */ }
    });

    function openModal(): void {
        welcomeModal.open();
    }

    function closeModal(): void {
        welcomeModal.close();
    }

    return { welcomeModal, openModal, closeModal };
}

function initInteractiveComponents(
    context: InteractionContext,
    callbacks: InteractionCallbacks,
    themeManager: ThemeManager,
    selectByName: (name: string) => void,
    openModal: () => void
) {
    // Navigation Sidebar
    let sidebar: NavigationSidebar | null = null;
    if (context.planetData) {
        sidebar = new NavigationSidebar({
            planetData: context.planetData,
            callbacks: {
                onSelect: (name) => selectByName(name),
                onClose: () => { /* handled internally */ }
            }
        });
    }

    // Settings Panel
    const settingsPanel = new SettingsPanel({
        callbacks: {
            onToggleTextures: (_value) => {
                const btn = document.getElementById('btn-texture');
                callbacks.onToggleTexture(btn);
            },
            onToggleLabels: () => {
                callbacks.onToggleLabels();
            },
            onToggleOrbits: () => {
                callbacks.onToggleOrbits();
            },
            onChangeTheme: (themeName) => {
                themeManager.setTheme(themeName);
                ToastManager.getInstance().show(`Theme: ${themeName.toUpperCase()}`, { type: 'info' });
            },
            onChangeSpeed: (value) => {
                callbacks.onUpdateTimeScale(value);
                const dockSlider = document.getElementById('slider-speed') as HTMLInputElement | null;
                const dockValue = document.getElementById('speed-value');
                if (dockSlider) dockSlider.value = String(value);
                if (dockValue) dockValue.textContent = `${value.toFixed(1)}x`;
            }
        }
    });

    // Command Palette
    let commandPalette: CommandPalette | null = null;
    if (context.planetData) {
        const paletteCallbacks: CommandPaletteCallbacks = {
            onSelectByName: selectByName,
            onToggleOrbits: callbacks.onToggleOrbits,
            onToggleLabels: callbacks.onToggleLabels,
            onToggleTexture: callbacks.onToggleTexture,
            onToggleCamera: callbacks.onToggleCamera,
            onResetCamera: callbacks.onResetCamera,
            onTogglePause: callbacks.onTogglePause,
            openModal: openModal,
            onToggleTheme: () => {
                const next = themeManager.cycleTheme();
                ToastManager.getInstance().show(`Theme: ${next.toUpperCase()}`, { type: 'info' });
            }
        };
        commandPalette = new CommandPalette(context.planetData, paletteCallbacks);
    }

    return { sidebar, settingsPanel, commandPalette };
}

function setupRaycasting(
    context: InteractionContext,
    callbacks: InteractionCallbacks,
    updateSelectionUI: (mesh: THREE.Object3D) => void
) {
    const { camera, rendererDomElement, interactionTargets } = context;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const doubleClickDelay = 300;
    const DRAG_THRESHOLD = 5;

    let width = window.innerWidth;
    let height = window.innerHeight;

    // State
    const ptrState = {
        downX: 0,
        downY: 0,
        lastClickTime: 0,
        lastClickedId: null as string | null
    };

    const handleResize = () => {
        width = window.innerWidth;
        height = window.innerHeight;
    };

    const handlePointerDown = (event: PointerEvent) => {
        if (event.button !== 0) return;
        ptrState.downX = event.clientX;
        ptrState.downY = event.clientY;
    };

    const handlePointerUp = (event: PointerEvent) => {
        if (event.button !== 0) return;

        const dx = event.clientX - ptrState.downX;
        const dy = event.clientY - ptrState.downY;
        const distanceMoved = Math.sqrt(dx * dx + dy * dy);

        if (distanceMoved > DRAG_THRESHOLD) {
            // Dragged - do nothing (camera control handles this)
            return;
        }

        // Clicked - Raycast
        performRaycast(event.clientX, event.clientY);
    };

    const performRaycast = (clientX: number, clientY: number) => {
        updateNormalizedCoordinates(mouse, clientX, clientY, width, height);
        raycaster.setFromCamera(mouse, camera);

        const intersects = raycaster.intersectObjects(interactionTargets, false);
        if (intersects.length > 0) {
            const hit = intersects[0];
            if (hit) processHit(hit);
        }
    };

    const processHit = (hit: THREE.Intersection) => {
        if (!hit) return;

        let mesh: THREE.Object3D = hit.object;
        let userData = mesh.userData;

        // Handle InstancedMesh
        if ((mesh as THREE.InstancedMesh).isInstancedMesh && context.instanceRegistry) {
            const pivot = context.instanceRegistry.getPivot(
                mesh as THREE.InstancedMesh,
                hit.instanceId ?? 0
            );
            if (pivot) {
                mesh = pivot;
                userData = pivot.userData;
            }
        }

        if (userData && userData.name) {
            handleSelection(mesh);
        }
    };

    const handleSelection = (mesh: THREE.Object3D) => {
        const currentTime = Date.now();
        const isSameObject = ptrState.lastClickedId === mesh.uuid;
        const isDoubleClick = isSameObject && (currentTime - ptrState.lastClickTime) < doubleClickDelay;

        ptrState.lastClickTime = currentTime;
        ptrState.lastClickedId = mesh.uuid;

        callbacks.onObjectSelected(mesh);
        updateSelectionUI(mesh);

        if (isDoubleClick) {
            callbacks.onSetFocus(mesh);
        }
    };

    window.addEventListener('resize', handleResize);
    rendererDomElement.addEventListener('pointerdown', handlePointerDown);
    rendererDomElement.addEventListener('pointerup', handlePointerUp);

    return () => {
        window.removeEventListener('resize', handleResize);
        rendererDomElement.removeEventListener('pointerdown', handlePointerDown);
        rendererDomElement.removeEventListener('pointerup', handlePointerUp);
    };
}

function setupKeyboardShortcuts(
    callbacks: InteractionCallbacks,
    commandPalette: CommandPalette | null,
    sidebar: NavigationSidebar | null,
    welcomeModal: Modal,
    settingsPanel: SettingsPanel,
    infoPanel: InfoPanel,
    openModal: () => void
) {
    /**
     * Keyboard Shortcut System
     *
     * Map of keys and their associated actions:
     * - [Space]: Toggle Pause/Resume
     * - [C]: Cycle Camera View (Free -> Top-down)
     * - [T]: Toggle Textures (Performance mode)
     * - [L]: Toggle Labels
     * - [O]: Toggle Orbits
     * - [Cmd+K] / [Ctrl+K]: Open Command Palette
     * - [,]: Open Settings Panel
     * - [?]: Open Help Modal
     */
    const onKeyDown = (e: KeyboardEvent): void => {
        const key = e.key.toLowerCase();

        // Global shortcuts that bypass input focus
        if ((e.metaKey || e.ctrlKey) && key === 'k') { // Cmd+K or Ctrl+K
            e.preventDefault(); // Prevent browser shortcuts
            commandPalette?.toggle();
            return;
        }

        // Prevent shortcuts from firing when typing in an input field
        if (document.activeElement?.tagName === 'INPUT') return;

        if (key === ' ') { // Spacebar
            e.preventDefault(); // Prevent page scroll
            const btn = document.getElementById('btn-pause');
            callbacks.onTogglePause(btn);
        } else if (key === 'c') {
            callbacks.onToggleCamera();
        } else if (key === 'l') {
            callbacks.onToggleLabels();
        } else if (key === 'o') {
            callbacks.onToggleOrbits();
        } else if (key === 't') {
            const btn = document.getElementById('btn-texture');
            callbacks.onToggleTexture(btn);
        } else if (key === ',') {
            e.preventDefault();
            settingsPanel.open();
        } else if (key === '?' || (key === '/' && e.shiftKey)) {
            openModal();
        } else if (key === 'escape') {
            if (sidebar && sidebar.isOpen()) {
                sidebar.close();
            } else if (commandPalette && commandPalette.isOpen()) {
                commandPalette.close();
            } else if (welcomeModal.isOpen()) {
                welcomeModal.close();
            } else if (settingsPanel.isOpen()) {
                settingsPanel.close();
            } else {
                callbacks.onResetCamera();
                infoPanel.hide();
            }
        } else if (e.key >= '1' && e.key <= '9') {
            const num = parseInt(e.key);
            callbacks.onFocusPlanet(num - 1);
        }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
        window.removeEventListener('keydown', onKeyDown);
    };
}

function setupUIBindings(
    callbacks: InteractionCallbacks,
    openModal: () => void
) {
    const onToggleTextureHandler = (): void => {
        callbacks.onToggleTexture(document.getElementById('btn-texture'));
    };

    const onPauseHandler = (): void => {
        callbacks.onTogglePause(document.getElementById('btn-pause'));
    };

    const onSpeedHandler = (e: Event): void => {
        const target = e.target as HTMLInputElement;
        const val = parseFloat(target.value);
        callbacks.onUpdateTimeScale(val);
        const valStr = val.toFixed(1);
        const speedValue = document.getElementById('speed-value');
        if (speedValue) speedValue.textContent = valStr + 'x';
        target.setAttribute('aria-valuenow', String(val));
        target.setAttribute('aria-valuetext', valStr + 'x');
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
    if (sliderSpeed) sliderSpeed.addEventListener('input', onSpeedHandler);

    const btnHelp = document.getElementById('btn-help');
    if (btnHelp) btnHelp.addEventListener('click', openModal);

    return () => {
        if (btnCamera) btnCamera.removeEventListener('click', callbacks.onToggleCamera);
        if (btnTexture) btnTexture.removeEventListener('click', onToggleTextureHandler);
        if (btnReset) btnReset.removeEventListener('click', callbacks.onResetCamera);
        if (btnPause) btnPause.removeEventListener('click', onPauseHandler);
        if (btnLabels) btnLabels.removeEventListener('click', callbacks.onToggleLabels);
        if (btnOrbits) btnOrbits.removeEventListener('click', callbacks.onToggleOrbits);
        if (sliderSpeed) sliderSpeed.removeEventListener('input', onSpeedHandler);
        if (btnHelp) btnHelp.removeEventListener('click', openModal);
    };
}
