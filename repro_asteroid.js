import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createAsteroidBelt } from './src/debris.js';

// Setup Scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 10, 60);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(10, 10, 10);
scene.add(dirLight);

// Reference Grid
const gridHelper = new THREE.GridHelper(100, 10, 0xff0000, 0x444444);
scene.add(gridHelper);

// Create Belt
const beltConfig = { count: 500, minRadius: 30, maxRadius: 40 };
// We hook into the internal logic by re-implementing it here briefly or just observing the console from the internal log
// Actually, I can just modify debris.js to log it, or pass a callback?
// debris.js doesn't support a callback.
// I will modify debris.js temporarily to log the shader.

const asteroidBelt = createAsteroidBelt(beltConfig);
scene.add(asteroidBelt);

// Animation Loop
function animate() {
    requestAnimationFrame(animate);
    if (asteroidBelt.userData.timeUniform) {
        asteroidBelt.userData.timeUniform.value += 0.05;
    }
    controls.update();
    renderer.render(scene, camera);
}

animate();
