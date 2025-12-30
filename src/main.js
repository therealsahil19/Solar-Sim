import * as THREE from 'three';
import { createStarfield, createSun, createPlayerShip, createSystem } from './procedural.js';
import { setupControls, setupInteraction } from './input.js';

// ============================================================================
// State & Globals
// ============================================================================
const animatedObjects = [];
const interactionTargets = []; // Optimization for raycasting
let playerShip;
let controls;
let scene;
let camera;
let renderer;
let useTextures = true; // Default state
let isShipView = false;

// Expose globals for testing
window.scene = null;
window.playerShip = null;
window.controls = null;

// ============================================================================
// Initialization
// ============================================================================
async function init() {
    // 1. Setup Basic Three.js Components
    scene = new THREE.Scene();
    window.scene = scene; // Expose to window

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 40, 80);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.setAttribute('role', 'application');
    renderer.domElement.setAttribute('aria-label', '3D Solar System Simulation');
    document.body.appendChild(renderer.domElement);

    // 2. Lighting
    const pointLight = new THREE.PointLight(0xffffff, 2, 300);
    scene.add(pointLight);
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    // 3. Loading Manager & Texture Loader
    const loadingScreen = document.getElementById('loading-screen');
    const loadingBar = document.getElementById('loading-bar');
    const manager = new THREE.LoadingManager();

    manager.onProgress = function ( url, itemsLoaded, itemsTotal ) {
        if (loadingBar) {
            const width = (itemsLoaded / itemsTotal) * 100;
            loadingBar.style.width = width + '%';
        }
    };
    manager.onLoad = function ( ) {
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => loadingScreen.style.display = 'none', 500);
        }
    };

    const textureLoader = new THREE.TextureLoader(manager);

    // 4. Create Initial Objects (Procedural)
    // Starfield
    const stars = createStarfield();
    scene.add(stars);

    // Sun
    const sun = createSun(textureLoader, useTextures);
    scene.add(sun);
    interactionTargets.push(sun); // Make sun clickable

    // Player Ship
    playerShip = createPlayerShip();
    scene.add(playerShip);
    window.playerShip = playerShip; // Expose to window

    // 5. Load System Data & Generate Planets
    try {
        const response = await fetch('system.json');
        const planetData = await response.json();

        planetData.forEach(planetConfig => {
            const systemNode = createSystem(planetConfig, textureLoader, useTextures);

            // Add top-level components to scene
            scene.add(systemNode.pivot);
            if (systemNode.orbit) {
                scene.add(systemNode.orbit);
            }

            // Aggregate interaction and animation targets
            interactionTargets.push(...systemNode.interactables);
            animatedObjects.push(...systemNode.animated);
        });

    } catch (error) {
        console.error("Failed to load system data:", error);
    }

    // 6. Setup Controls & Input
    controls = setupControls(camera, renderer.domElement);
    window.controls = controls; // Expose to window

    const context = {
        camera,
        scene,
        rendererDomElement: renderer.domElement,
        interactionTargets,
        state: { useTextures } // Passing state reference if needed
    };

    const callbacks = {
        onToggleCamera: toggleCameraView,
        onToggleTexture: toggleTextures
    };

    setupInteraction(context, callbacks);

    // 7. Start Loop
    animate();
}

// ============================================================================
// Logic Helpers
// ============================================================================

function toggleCameraView() {
    isShipView = !isShipView;
    if (isShipView && playerShip) {
        // Chase Cam
        controls.target.copy(playerShip.position);
        camera.position.set(
            playerShip.position.x + 5,
            playerShip.position.y + 3,
            playerShip.position.z + 5
        );
    } else {
        // Overview
        controls.target.set(0, 0, 0);
        camera.position.set(0, 40, 80);
    }
    controls.update();
}

function toggleTextures(btnElement) {
    useTextures = !useTextures;

    // Update Button Text
    if (btnElement) {
        btnElement.textContent = useTextures ? "HD" : "LD";
    }

    // Update Materials
    interactionTargets.forEach(mesh => {
        if (useTextures && mesh.userData.texturedMaterial) {
            mesh.material = mesh.userData.texturedMaterial;
        } else if (!useTextures && mesh.userData.solidMaterial) {
            mesh.material = mesh.userData.solidMaterial;
        }
    });

    // Toast
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = `Textures: ${useTextures ? "ON" : "OFF"}`;
        toast.classList.add('visible');
        if (toast.timeout) clearTimeout(toast.timeout);
        toast.timeout = setTimeout(() => toast.classList.remove('visible'), 2000);
    }
}

const tempVec = new THREE.Vector3();

function animate() {
    requestAnimationFrame(animate);

    // 1. Update Rotations
    animatedObjects.forEach(obj => {
        if (obj.pivot) obj.pivot.rotation.y += obj.speed;
        if (obj.mesh) obj.mesh.rotation.y += obj.rotationSpeed;
    });

    // 2. Update Ship Orientation
    if (playerShip && animatedObjects.length > 0) {
        let closestDist = Infinity;
        let closestObj = null;
        const shipPos = playerShip.position;

        animatedObjects.forEach(obj => {
            if (obj.mesh) {
                obj.mesh.getWorldPosition(tempVec);
                const dist = shipPos.distanceToSquared(tempVec);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestObj = obj.mesh;
                }
            }
        });

        if (closestObj) {
            closestObj.getWorldPosition(tempVec);
            playerShip.lookAt(tempVec);
        }
    }

    // 3. Render
    if (controls) controls.update();
    if (renderer && scene && camera) renderer.render(scene, camera);
}

// Handle Resize
window.addEventListener('resize', () => {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
});

// Kickoff
init();
