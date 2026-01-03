/**
 * 🧪 Verifier E2E Tests: Camera & Time Controls
 * Tests simulation controls including pause/play, camera toggle, reset view, and toolbar buttons.
 * 
 * @flow Controls -> Pause -> Play -> Reset View -> Toggle Camera -> Follow Object
 */
import { test, expect } from '@playwright/test';

test.describe('Camera & Time Controls', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Wait for loading screen to disappear
        await page.waitForSelector('#loading-screen', { state: 'hidden', timeout: 30000 });
        // Close welcome modal if present
        const modal = page.locator('#welcome-modal');
        if (await modal.isVisible()) {
            await page.locator('.modal-close-btn').click();
        }
    });

    test('should pause and resume simulation', async ({ page }) => {
        const pauseBtn = page.locator('#btn-pause');

        // Click pause - should toggle aria-label
        await pauseBtn.click();
        await expect(pauseBtn).toHaveAttribute('aria-label', /Play|Resume/i);

        // Click again to resume
        await pauseBtn.click();
        await expect(pauseBtn).toHaveAttribute('aria-label', /Pause/i);
    });

    test('should adjust simulation speed via slider', async ({ page }) => {
        const speedSlider = page.locator('#slider-speed');
        const speedValue = page.locator('#speed-value');

        // Initial value is 1.0x
        await expect(speedValue).toHaveText('1.0x');

        // Change speed to 3.0
        await speedSlider.fill('3.0');
        await expect(speedValue).toHaveText('3.0x');
    });

    test('should toggle camera view', async ({ page }) => {
        const cameraBtn = page.locator('#btn-camera');

        // Initially not pressed
        await expect(cameraBtn).toHaveAttribute('aria-pressed', 'false');

        // Toggle camera
        await cameraBtn.click();
        await expect(cameraBtn).toHaveAttribute('aria-pressed', 'true');

        // Toggle back
        await cameraBtn.click();
        await expect(cameraBtn).toHaveAttribute('aria-pressed', 'false');
    });

    test('should reset view', async ({ page }) => {
        const resetBtn = page.locator('#btn-reset');

        // Click reset - should work without error
        await resetBtn.click();

        // Button should still be present and functional
        await expect(resetBtn).toBeVisible();
    });

    test('should toggle textures via bottom dock button', async ({ page }) => {
        const textureBtn = page.locator('#btn-texture');

        // Initially pressed (textures on)
        await expect(textureBtn).toHaveAttribute('aria-pressed', 'true');

        // Toggle off
        await textureBtn.click();
        await expect(textureBtn).toHaveAttribute('aria-pressed', 'false');

        // Toggle back on
        await textureBtn.click();
        await expect(textureBtn).toHaveAttribute('aria-pressed', 'true');
    });

    test('should toggle labels via button', async ({ page }) => {
        const labelsBtn = page.locator('#btn-labels');

        // Initially pressed
        await expect(labelsBtn).toHaveAttribute('aria-pressed', 'true');

        // Toggle off
        await labelsBtn.click();
        await expect(labelsBtn).toHaveAttribute('aria-pressed', 'false');
    });

    test('should toggle orbits via button', async ({ page }) => {
        const orbitsBtn = page.locator('#btn-orbits');

        // Initially pressed
        await expect(orbitsBtn).toHaveAttribute('aria-pressed', 'true');

        // Toggle off
        await orbitsBtn.click();
        await expect(orbitsBtn).toHaveAttribute('aria-pressed', 'false');
    });

    test('should follow selected object', async ({ page }) => {
        // First select a planet via navigation
        const openBtn = page.locator('#btn-planets');
        await openBtn.click();
        await page.waitForSelector('#nav-list .nav-btn:not(.skeleton)', { timeout: 10000 });

        const earthButton = page.locator('#nav-list').getByText('Earth', { exact: true });
        await earthButton.click();

        // Click Follow button in info panel
        const followBtn = page.locator('#btn-follow');
        await followBtn.click();

        // Info panel should still show Earth (follow mode active)
        const infoName = page.locator('#info-name');
        await expect(infoName).toContainText('Earth');
    });
});
