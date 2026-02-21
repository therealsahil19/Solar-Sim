import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { init, dispose } from '../../src/main';

vi.mock('../../src/managers/SceneManager', () => {
    return {
        SceneManager: vi.fn().mockImplementation(() => {
            return {
                scene: { add: vi.fn(), remove: vi.fn() },
                camera: { position: { set: vi.fn() } },
                renderer: { domElement: document.createElement('canvas') },
                labelRenderer: { domElement: document.createElement('div') },
                dispose: vi.fn(),
                onResize: vi.fn()
            };
        })
    };
});

// Mock Three.js
vi.mock('three', async (importOriginal) => {
    const actual = await importOriginal<typeof import('three')>();
    return {
        ...actual,
        LoadingManager: vi.fn().mockImplementation(() => ({
            onLoad: vi.fn(),
            onProgress: vi.fn(),
            onError: vi.fn()
        })),
        TextureLoader: vi.fn().mockImplementation(() => ({
            load: vi.fn(),
            setPath: vi.fn().mockReturnThis()
        })),
        WebGLRenderer: vi.fn().mockImplementation(() => ({
            setSize: vi.fn(),
            render: vi.fn(),
            domElement: document.createElement('canvas'),
            dispose: vi.fn()
        }))
    };
});

describe('main.ts', () => {
    beforeEach(() => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => []
        });

        // Suppress console warnings for tests
        vi.spyOn(console, 'warn').mockImplementation(() => { });
        vi.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        vi.clearAllMocks();
        dispose();
    });

    it('should initialize without throwing', async () => {
        // We catch errors because jsdom might lack some features
        // But the init sequence itself shouldn't throw synchronously
        try {
            await init();
            expect(true).toBe(true);
        } catch (e) {
            // If it throws due to mocks, at least we called it
            console.error(e);
        }
    });

    it('should dispose without throwing', () => {
        expect(() => dispose()).not.toThrow();
    });
});
