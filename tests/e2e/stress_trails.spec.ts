import { test, expect } from '@playwright/test';

test('Trails Performance Benchmark', async ({ page }) => {
  test.setTimeout(120000);

  // Navigate and wait for load
  await page.goto('/');
  const loading = page.locator('#loading-screen');
  await loading.waitFor({ state: 'hidden', timeout: 30000 });

  console.log('App loaded. Injecting trails...');

  // Inject trails and run benchmark
  const result = await page.evaluate(async () => {
    if (!window.trailManager || !window.scene) return { error: 'Missing globals' };

    const tm = window.trailManager;
    const scene = window.scene;

    // Hack to get constructors without importing THREE
    const Object3D = scene.constructor; // THREE.Scene inherits from Object3D? No, Scene extends Object3D.
    // Actually safe way:
    const dummyProto = Object.getPrototypeOf(scene);
    // scene is instance of Scene. Scene extends Object3D.

    const dummies = [];
    const count = 4000;

    // Clear existing scene to isolate trail performance
    const toRemove = [];
    scene.traverse(c => {
        if ((c.isMesh || c.isPoints) && !c.userData.isTrailSystem) {
             toRemove.push(c);
        }
    });
    toRemove.forEach(c => c.parent.remove(c));
    console.log(`Cleared ${toRemove.length} scene objects.`);

    console.log(`Creating ${count} dummy objects...`);

    const MockObject3D = class {
        constructor() {
            this.matrixWorld = { elements: [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1] };
            this.position = { x:0, y:0, z:0 };
            this.parent = { type: 'Scene' }; // Must have parent to be valid in update()
            this.userData = {};
        }
        updateMatrixWorld() {
             // Simple translation matrix update
             this.matrixWorld.elements[12] = this.position.x;
             this.matrixWorld.elements[13] = this.position.y;
             this.matrixWorld.elements[14] = this.position.z;
        }
    };

    for (let i = 0; i < count; i++) {
        const obj = new MockObject3D();
        obj.userData = {
            angle: Math.random() * Math.PI * 2,
            radius: 50 + Math.random() * 200,
            speed: 0.5 + Math.random() * 0.5
        };

        // Register with trail manager
        // We pass a dummy color
        tm.register(obj as any, 0x00ff00);
        dummies.push(obj);
    }

    console.log('Starting animation loop for dummies...');

    // We need to hook into the animation loop or start our own that runs BEFORE the main loop?
    // TrailManager.update() reads current position.
    // So we just need to update positions continuously.

    const updateDummies = () => {
        dummies.forEach(d => {
            d.userData.angle += d.userData.speed * 0.05;
            d.position.x = Math.cos(d.userData.angle) * d.userData.radius;
            d.position.z = Math.sin(d.userData.angle) * d.userData.radius;
            // Matrix update happens in TrailManager.update call to target.updateMatrixWorld?
            // No, TrailManager calls `target.updateMatrixWorld(true)` ONLY in register.
            // In update(), it calls `target.matrixWorld`.
            // So WE must update matrixWorld.
            d.updateMatrixWorld();
        });
        requestAnimationFrame(updateDummies);
    };
    updateDummies();

    // Wait for stabilization
    await new Promise(r => setTimeout(r, 1000));

    console.log('Running benchmark...');
    if (window.boltBenchmark) {
        return await window.boltBenchmark(2000).promise; // 2 seconds
    }
    return { error: 'No benchmark tool' };
  });

  console.log('---------------------------------------------------');
  console.log('BASELINE BENCHMARK RESULTS (4000 Trails)');
  console.log('---------------------------------------------------');
  console.log(`Avg FPS: ${result.avgFps.toFixed(2)}`);
  console.log(`P99 Frame Time: ${result.p99.toFixed(2)} ms`);
  console.log(`Avg Frame Time: ${(1000/result.avgFps).toFixed(2)} ms`);
  console.log('---------------------------------------------------');

  expect(result.avgFps).toBeGreaterThan(0);
});
