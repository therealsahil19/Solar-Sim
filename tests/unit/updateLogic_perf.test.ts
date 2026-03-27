import { describe, it } from 'vitest';
import * as THREE from 'three';
import { getPositionFromMatrix } from '../../src/utils/ThreeUtils';

describe('Performance Benchmark: updateLogic', () => {
    it('should measure frame-by-frame lookAt vs throttled lookAt', () => {
        const playerShip = new THREE.Group();
        const planets = Array.from({ length: 50 }, () => {
            const group = new THREE.Group();
            group.position.set(Math.random() * 100, Math.random() * 100, Math.random() * 100);
            group.updateMatrixWorld();
            return group;
        });

        let closestObjectCache: THREE.Object3D | null = null;
        const LOGIC_UPDATE_INTERVAL = 10;
        const tempVec = new THREE.Vector3();

        // Baseline simulation (current implementation)
        const startBaseline = performance.now();
        for (let frameCount = 0; frameCount < 100000; frameCount++) {
            if (playerShip && frameCount % LOGIC_UPDATE_INTERVAL === 0) {
                let closestDist = Infinity;
                let closestObj: THREE.Object3D | null = null;
                const shipPos = playerShip.position;

                const len = planets.length;
                for (let i = 0; i < len; i++) {
                    const p = planets[i];
                    if (!p) continue;
                    getPositionFromMatrix(p, tempVec);
                    const dist = shipPos.distanceToSquared(tempVec);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestObj = p;
                    }
                }
                closestObjectCache = closestObj;
            }
            if (closestObjectCache && playerShip) {
                getPositionFromMatrix(closestObjectCache, tempVec);
                playerShip.lookAt(tempVec);
            }
        }
        const baselineTime = performance.now() - startBaseline;

        // Optimized simulation
        closestObjectCache = null;
        const startOptimized = performance.now();
        for (let frameCount = 0; frameCount < 100000; frameCount++) {
            if (playerShip && frameCount % LOGIC_UPDATE_INTERVAL === 0) {
                let closestDist = Infinity;
                let closestObj: THREE.Object3D | null = null;
                const shipPos = playerShip.position;

                const len = planets.length;
                for (let i = 0; i < len; i++) {
                    const p = planets[i];
                    if (!p) continue;
                    getPositionFromMatrix(p, tempVec);
                    const dist = shipPos.distanceToSquared(tempVec);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestObj = p;
                    }
                }
                closestObjectCache = closestObj;

                if (closestObjectCache) {
                    getPositionFromMatrix(closestObjectCache, tempVec);
                    playerShip.lookAt(tempVec);
                }
            }
        }
        const optimizedTime = performance.now() - startOptimized;

        console.log(`\n⚡ Benchmark Results for updateLogic:`);
        console.log(`   Baseline:  ${baselineTime.toFixed(2)}ms`);
        console.log(`   Optimized: ${optimizedTime.toFixed(2)}ms`);
        console.log(`   Improvement: ${(baselineTime / optimizedTime).toFixed(2)}x faster`);
    });
});
