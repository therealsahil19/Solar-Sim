import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
    test.setTimeout(60000);

  test('should load the application successfully', async ({ page }) => {
    // 1. Navigate to home
    await page.goto('/');

    // 2. Verify title
    await expect(page).toHaveTitle(/Solar System|Solar-Sim/i);

    // 3. Wait for loading screen to disappear
    const loadingScreen = page.locator('#loading-screen');
    await loadingScreen.waitFor({ state: 'hidden', timeout: 45000 });

    // 4. Verify Canvas exists (3D scene rendered)
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // 5. Verify Help/Welcome Modal Interaction
    // We don't assume it opens automatically (as that behavior might vary or depend on localstorage)
    // Instead, we verify we can open it.
    const helpBtn = page.locator('#btn-help');
    await expect(helpBtn).toBeVisible();
    await helpBtn.click();

    const welcomeModal = page.locator('#welcome-modal');
    await expect(welcomeModal).toBeVisible();

    // 6. Dismiss Welcome Modal
    const closeBtn = page.locator('.modal-close-btn');
    await closeBtn.click();
    await expect(welcomeModal).not.toBeVisible();
  });
});
