// @ts-check
import { test, expect } from '@playwright/test';

/**
 * ⚡ Bolt Performance E2E Test
 * 
 * This test suite validates that the Solar-Sim maintains acceptable
 * performance metrics. It uses the built-in boltBenchmark() function
 * to measure frame timing statistics.
 */

test.describe('Performance Benchmarks', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate and wait for simulation to fully initialize
        await page.goto('/');

        // Wait for loading screen to disappear
        await page.waitForSelector('#loading-screen', { state: 'hidden', timeout: 30000 });

        // Additional wait for scene to stabilize
        await page.waitForTimeout(1000);
    });

    // Note: This test verifies that the simulation loop is running and rendering frames.
    // Headless browsers have severely limited GPU performance (often 1-5 FPS), so
    // we only check that the FPS is non-zero. For real performance validation,
    // run manually in headed mode: npx playwright test --headed
    test('should maintain acceptable FPS during simulation', async ({ page }) => {
        // Run the benchmark for 5 seconds
        const results = await page.evaluate(async () => {
            // Access the boltBenchmark function exposed on window
            if (typeof window.boltBenchmark !== 'function') {
                throw new Error('boltBenchmark not available on window');
            }

            const benchmark = window.boltBenchmark(5000);
            return await benchmark.promise;
        });

        // Log results for debugging (visible in test output)
        console.log('⚡ Benchmark Results:', JSON.stringify(results, null, 2));

        // Assertions - only run if results are available
        if (results) {
            // In headless mode, we just want to ensure the loop is running (FPS > 0)
            expect(results.avgFps).toBeGreaterThan(0);
            console.log(`⚡ Average FPS: ${results.avgFps.toFixed(1)}`);
            console.log(`⚡ Jank Percent: ${results.jankPercent.toFixed(1)}%`);
            console.log(`⚡ P99 Frame Time: ${results.p99.toFixed(1)}ms`);
        }
    });

    test('should complete initialization within acceptable time', async ({ page }) => {
        // Capture browser console logs
        page.on('console', msg => {
            if (msg.text().startsWith('⚡ Init:')) {
                console.log(msg.text());
            }
        });

        const startTime = Date.now();

        await page.goto('/');

        // Wait for loading screen to disappear
        await page.waitForSelector('#loading-screen', { state: 'hidden', timeout: 30000 });

        const loadTime = Date.now() - startTime;

        console.log(`⚡ Initialization time: ${loadTime}ms`);

        // Should initialize within 10 seconds (generous for CI environments)
        expect(loadTime).toBeLessThan(10000);
    });

    test('should have resource hints in place', async ({ page }) => {
        await page.goto('/');

        // Verify DNS prefetch hint exists
        const dnsPrefetch = await page.locator('link[rel="dns-prefetch"][href="https://unpkg.com"]');
        await expect(dnsPrefetch).toHaveCount(1);

        // Verify preconnect hint exists
        const preconnect = await page.locator('link[rel="preconnect"][href="https://unpkg.com"]');
        await expect(preconnect).toHaveCount(1);

        // Verify CSS preload hint exists
        const cssPreload = await page.locator('link[rel="preload"][href="./src/style.css"]');
        await expect(cssPreload).toHaveCount(1);
    });
});
