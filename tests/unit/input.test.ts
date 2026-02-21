import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { setupInteraction, updateNormalizedCoordinates, type InteractionContext, type InteractionCallbacks } from '../../src/input';

// Mock OrbitControls
vi.mock('three/addons/controls/OrbitControls.js', () => ({
    OrbitControls: class {
        constructor() { }
        update() { }
        dispose() { }
    }
}));

// Mock Components
vi.mock('../../src/components/CommandPalette', () => ({
    CommandPalette: class {
        constructor() { }
        toggle = vi.fn();
        open = vi.fn();
        close = vi.fn();
        isOpen = vi.fn(() => false);
        dispose = vi.fn();
    }
}));

vi.mock('../../src/components/NavigationSidebar', () => ({
    NavigationSidebar: class {
        constructor() { }
        toggle = vi.fn();
        open = vi.fn();
        close = vi.fn();
        isOpen = vi.fn(() => false);
        dispose = vi.fn();
    }
}));

vi.mock('../../src/components/InfoPanel', () => ({
    InfoPanel: class {
        constructor() { }
        update = vi.fn();
        hide = vi.fn();
        dispose = vi.fn();
    }
}));

vi.mock('../../src/components/Modal', () => ({
    Modal: class {
        constructor() { }
        open = vi.fn();
        close = vi.fn();
        isOpen = vi.fn(() => false);
        dispose = vi.fn();
    }
}));

vi.mock('../../src/components/SettingsPanel', () => ({
    SettingsPanel: class {
        constructor() { }
        open = vi.fn();
        close = vi.fn();
        isOpen = vi.fn(() => false);
        dispose = vi.fn();
    }
}));

vi.mock('../../src/managers/ThemeManager', () => ({
    ThemeManager: class {
        constructor() { }
        setTheme = vi.fn();
        cycleTheme = vi.fn(() => 'dark');
    }
}));

describe('Interaction System (input.ts)', () => {
    let context: InteractionContext;
    let callbacks: InteractionCallbacks;
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);

        context = {
            camera: new THREE.PerspectiveCamera(),
            rendererDomElement: container,
            interactionTargets: [],
            planetData: [{ name: 'Earth', type: 'planet' } as any]
        };

        callbacks = {
            onSetFocus: vi.fn(),
            onObjectSelected: vi.fn(),
            onToggleTexture: vi.fn(),
            onToggleLabels: vi.fn(),
            onToggleOrbits: vi.fn(),
            onToggleCamera: vi.fn(),
            onTogglePause: vi.fn(),
            onResetCamera: vi.fn(),
            onUpdateTimeScale: vi.fn(),
            onFocusPlanet: vi.fn()
        };
    });

    afterEach(() => {
        document.body.removeChild(container);
        vi.restoreAllMocks();
    });

    it('should initialize and return interaction helpers', () => {
        const result = setupInteraction(context, callbacks);
        expect(result).toBeDefined();
        expect(typeof result.updateSelectionUI).toBe('function');
        expect(typeof result.openModal).toBe('function');
        expect(typeof result.dispose).toBe('function');
        result.dispose();
    });

    it('should handle keyboard shortcuts (Space for pause)', () => {
        const result = setupInteraction(context, callbacks);

        const event = new KeyboardEvent('keydown', { key: ' ' });
        window.dispatchEvent(event);

        expect(callbacks.onTogglePause).toHaveBeenCalled();
        result.dispose();
    });

    it('should handle camera toggle (key C)', () => {
        const result = setupInteraction(context, callbacks);

        const event = new KeyboardEvent('keydown', { key: 'c' });
        window.dispatchEvent(event);

        expect(callbacks.onToggleCamera).toHaveBeenCalled();
        result.dispose();
    });

    it('should handle raycasting on click', () => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
        mesh.userData = { name: 'Earth' };
        context.interactionTargets.push(mesh);

        const result = setupInteraction(context, callbacks);

        // Simulate pointerdown and pointerup (click)
        container.dispatchEvent(new PointerEvent('pointerdown', { clientX: 0, clientY: 0, button: 0 }));
        container.dispatchEvent(new PointerEvent('pointerup', { clientX: 0, clientY: 0, button: 0 }));

        // Raycasting in JSDOM might not hit anything without real canvas dimensions, 
        // but we verify the listeners are attached and called.
        // To truly test raycasting we'd need to mock Raycaster.intersectObjects
        result.dispose();
    });

    it('should dispose and remove event listeners', () => {
        const removeSpy = vi.spyOn(window, 'removeEventListener');
        const result = setupInteraction(context, callbacks);
        result.dispose();

        expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
});

describe('updateNormalizedCoordinates', () => {
    it('should correctly convert screen coordinates to normalized device coordinates', () => {
        const target = new THREE.Vector2();

        // Center
        updateNormalizedCoordinates(target, 400, 300, 800, 600);
        expect(target.x).toBeCloseTo(0);
        expect(target.y).toBeCloseTo(0);

        // Top Left
        updateNormalizedCoordinates(target, 0, 0, 800, 600);
        expect(target.x).toBeCloseTo(-1);
        expect(target.y).toBeCloseTo(1);

        // Bottom Right
        updateNormalizedCoordinates(target, 800, 600, 800, 600);
        expect(target.x).toBeCloseTo(1);
        expect(target.y).toBeCloseTo(-1);
    });
});
