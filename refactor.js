import fs from 'fs';

const MAIN_TS_PATH = 'src/main.ts';
let content = fs.readFileSync(MAIN_TS_PATH, 'utf-8');

const helpers = `
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
    if (!response.ok) throw new Error(\`HTTP error! status: \${response.status}\`);
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
            if(labelManager) systemNode.labels.forEach(l => labelManager?.add(l));

            if (systemNode.animated.length > 0) {
                const primary = systemNode.animated[0];
                if (primary?.pivot) planets.push(primary.pivot);
            }
        });

        await new Promise(resolve => requestAnimationFrame(resolve));
    }
}
`;

const newInit = \`export async function init(): Promise<void> {
    // Reset Global State
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

        instanceRegistry.build();
        trailManager?.flushRegistrations();

        instanceRegistry.groups.forEach(group => {
            if (group.mesh) interactionTargets.push(group.mesh);
        });
    } catch (error) {
        console.error("Failed to load system data:", error);
        initFailed = true;
        throw error;
    }

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
            if (dockValue) dockValue.textContent = \`\${savedSettings.speed.toFixed(1)}x\`;
        }

        toggleBelt('asteroid_belt', savedSettings.asteroidBelt !== false);
        toggleBelt('kuiper_belt', savedSettings.kuiperBelt !== false);
        toggleBelt('oort_cloud', savedSettings.oortCloud !== false);
    }

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
    lastFrameTime = performance.now();\n\`;

content = content.replace(/export async function init\(\): Promise<void> \{([\s\S]*?)(?=    \/\*+\n     \* Logic Helpers)/, newInit);
content = content.replace(new RegExp("lastFrameTime = performance.now();\\\\n"), "lastFrameTime = performance.now();\n\n" + helpers);

fs.writeFileSync(MAIN_TS_PATH, content, 'utf8');
console.log("Refactored main.ts");
