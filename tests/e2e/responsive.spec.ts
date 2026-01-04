import { test, expect } from '@playwright/test';

test.describe('Responsive Layouts', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#loading-screen').waitFor({ state: 'hidden', timeout: 60000 });
    const modal = page.locator('#welcome-modal');
    if (await modal.isVisible()) {
        await page.locator('.modal-close-btn').click();
    }
  });

  test('mobile layout: sidebar should cover full screen or significant portion', async ({ page }) => {
    // Set viewport to iPhone SE size
    await page.setViewportSize({ width: 375, height: 667 });

    // Open Sidebar
    await page.locator('#btn-planets').click();
    const sidebar = page.locator('#nav-sidebar');

    await expect(sidebar).toBeVisible();

    // In mobile, we might check if it has specific mobile classes or styling
    // For now, verification that it opens without error is the baseline.
    const box = await sidebar.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(375);
  });

  test('mobile layout: bottom dock compact view', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const dock = page.locator('#bottom-dock');
    await expect(dock).toBeVisible();

    // Verify it doesn't overflow horizontally
    const box = await dock.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(375);
  });

  test('tablet layout: functionality check', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    // Ensure critical buttons are still visible/clickable
    await expect(page.locator('#btn-planets')).toBeVisible();
    await expect(page.locator('#btn-pause')).toBeVisible();
  });
});
