import { test, expect } from '@playwright/test';

test.describe('Palette UX Upgrade', () => {

    test('should show UI immediately (Skeletons or Real Data) without blocking', async ({ page }) => {
        await page.goto('/');

        // 1. Verify Blocking Loading Screen is GONE
        const loadingScreen = page.locator('#loading-screen');
        await expect(loadingScreen).toHaveCount(0);

        // 2. Verify Sidebar has content
        // It might be skeletons (if slow) or real buttons (if fast)
        // But it should NOT be empty.
        const sidebarItems = page.locator('#nav-list .nav-btn, #nav-list .skeleton');
        await expect(sidebarItems.first()).toBeVisible();
    });

    test('should show toast notifications on interaction', async ({ page }) => {
        await page.goto('/');

        // Wait for app to be interactive
        await page.waitForTimeout(1000);

        // Trigger Toast (Spacebar -> Pause)
        await page.keyboard.press('Space');

        // Verify Toast Appears
        const toast = page.locator('.toast-notification');
        await expect(toast).toBeVisible();
        await expect(toast).toContainText(/Simulation (Paused|Resumed)/);
    });
});
