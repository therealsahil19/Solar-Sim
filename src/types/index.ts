/**
 * @file index.ts
 * @description Shared interfaces and utility types used across the Solar-Sim application.
 */

import type * as THREE from 'three';
import type { OrbitalParameters, CelestialBodyType } from './system';

// Re-export system types
export * from './system';

/**
 * Interface for objects that hold allocated resources and require cleanup.
 * All classes that allocate GPU memory, event listeners, or other resources
 * MUST implement this interface.
 */
export interface Disposable {
    /** Release all allocated resources */
    dispose(): void;
}

/**
 * Extended userData for Three.js Object3D instances in our simulation.
 */
export interface SolarSimUserData {
    /** Display name of the celestial body */
    name?: string;
    /** Type classification (can be CelestialBodyType or legacy strings like 'Star', 'Planet') */
    type?: CelestialBodyType | 'Star' | 'Planet' | 'Moon' | 'Dwarf Planet' | string;
    /** Whether this body is a moon */
    isMoon?: boolean;
    /** Parent body name (for moons) */
    parentName?: string;
    /** Orbital parameters for physics calculations */
    physicsOrbit?: OrbitalParameters;
    /** Reference radius in km */
    radiusKm?: number;
    /** Description text */
    description?: string;
    /** Distance to sun in AU (computed) */
    distanceToSun?: number;
    /** Visual size (scale) of the object */
    size?: number;
    /** Distance from the sun (for sorting/LOD) */
    distance?: number;
    /** Material for solid color mode */
    solidMaterial?: THREE.Material;
    /** Material for textured mode */
    texturedMaterial?: THREE.Material;
}

/**
 * Type-safe DOM element cache.
 * Values can be null if the element wasn't found during initialization.
 */
export interface DOMElements {
    [key: string]: HTMLElement | null;
}

/**
 * Callback signatures for main.js state updates.
 */
export interface MainCallbacks {
    /** Called when pause state changes */
    onPauseChange: (isPaused: boolean) => void;
    /** Called when textures are toggled */
    onTextureToggle: (useTextures: boolean) => void;
    /** Called when labels visibility changes */
    onLabelsToggle: (showLabels: boolean) => void;
    /** Called when orbits visibility changes */
    onOrbitsToggle: (showOrbits: boolean) => void;
    /** Called when time scale changes */
    onTimeScaleChange: (scale: number) => void;
    /** Called when a celestial body is selected */
    onObjectSelected: (mesh: THREE.Object3D | null) => void;
    /** Called when camera should focus on an object */
    onFocusObject: (mesh: THREE.Object3D) => void;
    /** Called to reset camera to default view */
    onResetCamera: () => void;
    /** Called to toggle camera view mode */
    onToggleCameraView: () => void;
    /** Called to show a toast notification */
    onShowToast: (message: string) => void;
    /** Called when a belt visibility changes */
    onBeltToggle: (type: string, visible: boolean) => void;
}

/**
 * Context object passed to interaction handlers.
 */
export interface InteractionContext {
    /** The Three.js scene */
    scene: THREE.Scene;
    /** The active camera */
    camera: THREE.Camera;
    /** Array of meshes that can be clicked/selected */
    interactionTargets: THREE.Object3D[];
    /** Current pause state getter */
    getIsPaused: () => boolean;
}

/**
 * Result of setting up interaction handlers.
 */
export interface InteractionResult extends Disposable {
    /** Update selection UI for a given mesh */
    updateSelectionUI: (mesh: THREE.Object3D | null) => void;
    /** Select an object by name */
    selectByName: (name: string) => void;
    /** Get current settings */
    getSettings: () => UserSettings;
}

/**
 * User settings persisted to localStorage.
 */
export interface UserSettings {
    /** HD textures enabled */
    textures: boolean;
    /** Labels visible */
    labels: boolean;
    /** Orbit lines visible */
    orbits: boolean;
    /** Current theme name */
    theme: ThemeName;
    /** Simulation speed multiplier */
    speed: number;
    /** Belt visibility states */
    belts: {
        asteroidBelt: boolean;
        kuiperBelt: boolean;
        oortCloud: boolean;
    };
}

/**
 * Available theme names.
 */
export type ThemeName = 'default' | 'blueprint' | 'oled';

/**
 * Animated object in the simulation loop.
 */
export interface AnimatedObject {
    /** The mesh representing this body */
    mesh: THREE.Mesh;
    /** Pivot point for orbital rotation */
    pivot: THREE.Object3D;
    /** Orbital parameters */
    orbit?: OrbitalParameters;
    /** Trail data if trails are enabled */
    trail?: unknown;
}

/**
 * Benchmark result returned by the performance test.
 */
export interface BenchmarkResult {
    /** Number of frames measured */
    frames: number;
    /** Average FPS */
    avgFps: number;
    /** Minimum FPS */
    minFps: number;
    /** Maximum FPS */
    maxFps: number;
    /** 99th percentile frame time in ms */
    p99: number;
    /** Percentage of frames with jank (>16.67ms) */
    jankPercent: number;
    /** Standard deviation of frame times */
    stdDev: number;
}
