import { test, expect } from '@playwright/test';

/**
 * Helper to wait for navigation list to be populated
 */
async function waitForNavList(page) {
    // Wait for sidebar to be visible first
    const sidebar = page.locator('#nav-sidebar');
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toHaveAttribute('aria-hidden', 'false');

    // Wait for at least one real planet button to appear (not skeleton)
    // We scan for specific text to ensure data is loaded
    await page.waitForFunction(() => {
        const navList = document.querySelector('#nav-list');
        if (!navList) return false;
        const buttons = Array.from(navList.querySelectorAll('.nav-btn'));
        return buttons.some(b => b.textContent && b.textContent.includes('Earth'));
    }, { timeout: 30000 });
}

test.describe('Navigation & Search', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Wait for app load - use waitFor state=hidden which handles both attribute changes (if mapped) and removal
    await page.locator('#loading-screen').waitFor({ state: 'hidden', timeout: 60000 });

    // Dismiss welcome modal if open
    const welcomeModal = page.locator('#welcome-modal');
    if (await welcomeModal.isVisible()) {
        await page.locator('.modal-close-btn').click();
    }
  });

  test('should toggle sidebar visibility', async ({ page }) => {
    const toggleBtn = page.locator('#btn-planets');
    const closeBtn = page.locator('#btn-close-nav');
    const sidebar = page.locator('#nav-sidebar');

    // Ensure initial state
    await expect(sidebar).toHaveAttribute('aria-hidden', 'true');

    // Open sidebar
    await toggleBtn.click();

    // Wait for animation class or attribute
    await expect(sidebar).toHaveAttribute('aria-hidden', 'false');
    await expect(sidebar).toHaveClass(/animate-in/);

    // Close sidebar via the CLOSE button (X)
    await closeBtn.click();

    await expect(sidebar).toHaveAttribute('aria-hidden', 'true');
  });

  test('should populate planet list', async ({ page }) => {
    await page.locator('#btn-planets').click();
    await waitForNavList(page);

    // Verify key planets exist in the list
    const sunBtn = page.locator('#nav-list button:has-text("Sun")');
    const earthBtn = page.locator('#nav-list button:has-text("Earth")');

    await expect(sunBtn).toBeVisible();
    await expect(earthBtn).toBeVisible();
  });

  test('should filter list via search', async ({ page }) => {
    await page.locator('#btn-planets').click();
    await waitForNavList(page);

    const searchInput = page.locator('#nav-search');

    const earthBtn = page.locator('#nav-list .nav-btn:has-text("Earth")').first();
    const marsBtn = page.locator('#nav-list .nav-btn:has-text("Mars")').first();

    // Type "Mars"
    await searchInput.fill('Mars');
    // Wait for filter to apply
    await page.waitForTimeout(500);

    await expect(marsBtn).toBeVisible();
    await expect(earthBtn).toBeHidden();

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(500);
    await expect(earthBtn).toBeVisible();
  });

  test('should select a planet and show info panel', async ({ page }) => {
    await page.locator('#btn-planets').click();
    await waitForNavList(page);

    // Click Earth
    const earthBtn = page.locator('#nav-list .nav-btn:has-text("Earth")').first();
    await earthBtn.click();

    // Info Panel should appear
    const infoPanel = page.locator('#info-panel');
    await expect(infoPanel).toBeVisible();

    // Verify content matches selection
    await expect(page.locator('#info-name')).toContainText('Earth');
  });
});
