
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';

// Mock Three.js WebGLRenderer to ensure predictable behavior in JSDOM
vi.mock('three', async () => {
    const actual = await vi.importActual<typeof import('three')>('three');

    class MockWebGLRenderer {
        public domElement: HTMLCanvasElement;
        public shadowMap: { enabled: boolean; type: number; mapSize?: any; bias?: number };

        constructor() {
            this.domElement = document.createElement('canvas');
            this.shadowMap = { enabled: false, type: 0, mapSize: { width: 1024, height: 1024 }, bias: 0 };
        }

        setSize() { }

        render(scene: THREE.Scene, camera: THREE.Camera) {
            if (scene.matrixWorldAutoUpdate) {
                scene.updateMatrixWorld();
            }
            if (!camera.parent && (camera as any).matrixWorldAutoUpdate !== false) {
                camera.updateMatrixWorld();
            }
        }

        dispose() { }
    }

    class MockTextureLoader {
        manager: any;
        lazyLoadQueue: any[] = [];
        constructor(manager: any) { this.manager = manager; }
        load() { return new actual.Texture(); }
    }

    class MockScene extends actual.Scene {
    }

    return {
        ...actual,
        Scene: MockScene,
        WebGLRenderer: MockWebGLRenderer,
        TextureLoader: MockTextureLoader
    };
});

// Mock CSS2DRenderer
vi.mock('three/addons/renderers/CSS2DRenderer.js', () => ({
    CSS2DRenderer: class {
        domElement = document.createElement('div');
        setSize() { }
        render() { }
    },
    CSS2DObject: class extends THREE.Object3D {
        constructor() { super(); }
    }
}));

// Mock OrbitControls
vi.mock('three/addons/controls/OrbitControls.js', () => ({
    OrbitControls: class {
        target = new THREE.Vector3();
        constructor() { }
        update() { }
        dispose() { }
    }
}));

describe('Redundant Scene Update Optimization', () => {
    let animateCallback: FrameRequestCallback | null = null;
    let sceneUpdateSpy: any;
    let mainModule: any;

    beforeEach(async () => {
        vi.resetModules();
        document.body.innerHTML = '<div id="nav-list"></div><div id="loading-screen"></div><div id="info-panel"></div><div id="info-name"></div><div id="info-type"></div><div id="info-desc"></div><div id="info-radius"></div><div id="info-distance"></div><div id="info-dist-sun"></div><div id="info-dist-earth"></div><button id="btn-follow"></button><div id="settings-panel"></div><div id="nav-sidebar"></div><dialog id="welcome-modal"></dialog><input id="nav-search" /><button id="btn-close-nav"></button><button id="btn-planets"></button><button id="btn-settings"></button><button id="btn-close-settings"></button>';

        HTMLCanvasElement.prototype.getContext = vi.fn() as any;

        // Mock RAF
        window.requestAnimationFrame = vi.fn((cb) => {
            if (cb.name === 'animate') {
                animateCallback = cb;
                return 123;
            }
            cb(performance.now());
            return 456;
        });
        window.cancelAnimationFrame = vi.fn();

        sceneUpdateSpy = vi.spyOn(THREE.Scene.prototype, 'updateMatrixWorld');

        globalThis.fetch = vi.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve([])
        } as Response));

        vi.mock('../../src/instancing', () => ({
            InstanceRegistry: class {
                groups = new Map();
                constructor() { }
                addInstance() { }
                build() { }
                update() { }
                dispose() { }
            }
        }));

        vi.mock('../../src/trails', () => ({
            TrailManager: class {
                constructor() { }
                update() { }
                flushRegistrations() { }
                dispose() { }
            }
        }));

        mainModule = await import('../../src/main');
    });

    afterEach(() => {
        vi.restoreAllMocks();
        mainModule?.dispose();
    });

    it('should have scene.matrixWorldAutoUpdate disabled', async () => {
        await mainModule.init();
        const scene = mainModule.scene;
        expect(scene.matrixWorldAutoUpdate).toBe(false);
    });

    it('should call updateMatrixWorld only once per frame', async () => {
        await mainModule.init();

        if (animateCallback) {
            sceneUpdateSpy.mockClear();
            animateCallback(performance.now());
            expect(sceneUpdateSpy).toHaveBeenCalledTimes(1);
        } else {
            throw new Error("animate callback was not registered");
        }
    });
});
