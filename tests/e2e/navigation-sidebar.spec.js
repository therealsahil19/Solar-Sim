/**
 * 🧪 Verifier E2E Tests: Navigation Sidebar
 * Tests the Navigation Sidebar interactions including open/close, search, and planet selection.
 * 
 * @flow Navigation -> Open Sidebar -> Search Planet -> Select Planet -> Verify Info Panel
 */
import { test, expect } from '@playwright/test';

/**
 * Helper to wait for navigation list to be populated
 * Waits for skeletons to be removed AND real buttons to appear
 * @param {import('@playwright/test').Page} page
 */
async function waitForNavList(page) {
    // First wait for sidebar to be visible
    await page.waitForSelector('#nav-sidebar[aria-hidden="false"]', { timeout: 5000 });
    // Wait for real nav buttons to appear (not skeletons)
    await page.waitForFunction(() => {
        const navList = document.querySelector('#nav-list');
        if (!navList) return false;
        const buttons = navList.querySelectorAll('.nav-btn:not(.skeleton)');
        return buttons.length > 0;
    }, { timeout: 30000 });
    // Small stabilization delay
    await page.waitForTimeout(300);
}

test.describe('Navigation Sidebar', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Wait for loading screen to disappear
        await page.waitForSelector('#loading-screen', { state: 'hidden', timeout: 60000 });
        // Close welcome modal if present
        const modal = page.locator('#welcome-modal');
        if (await modal.isVisible()) {
            await page.locator('.modal-close-btn').click();
        }
    });

    test('should open and close navigation sidebar', async ({ page }) => {
        const navSidebar = page.locator('#nav-sidebar');
        const openBtn = page.locator('#btn-planets');
        const closeBtn = page.locator('#btn-close-nav');

        // Initially hidden
        await expect(navSidebar).toHaveAttribute('aria-hidden', 'true');

        // Open sidebar
        await openBtn.click();
        await expect(navSidebar).toHaveAttribute('aria-hidden', 'false');

        // Close sidebar
        await closeBtn.click();
        await expect(navSidebar).toHaveAttribute('aria-hidden', 'true');
    });

    test('should display planet list after loading', async ({ page }) => {
        const openBtn = page.locator('#btn-planets');
        await openBtn.click();

        // Wait for nav list to populate
        await waitForNavList(page);

        // At minimum should have Sun
        const sunButton = page.locator('#nav-list').getByText('Sun', { exact: true });
        await expect(sunButton).toBeVisible();
    });

    test('should filter planets via search', async ({ page }) => {
        const openBtn = page.locator('#btn-planets');
        await openBtn.click();

        await waitForNavList(page);

        const searchInput = page.locator('#nav-search');

        // Search for "Mars"
        await searchInput.fill('Mars');
        await page.waitForTimeout(300); // Wait for filter to apply

        // Mars should be visible
        const marsButton = page.locator('#nav-list').getByText('Mars', { exact: false });
        await expect(marsButton.first()).toBeVisible();
    });

    test('should clear search results when input is cleared', async ({ page }) => {
        const openBtn = page.locator('#btn-planets');
        await openBtn.click();

        await waitForNavList(page);

        const searchInput = page.locator('#nav-search');

        // Search for something
        await searchInput.fill('Jupiter');
        await page.waitForTimeout(300);

        // Clear the search
        await searchInput.fill('');
        await page.waitForTimeout(300);

        // Multiple planets should be visible again (Sun, Earth, Mars, etc.)
        const sunButton = page.locator('#nav-list').getByText('Sun', { exact: true });
        await expect(sunButton).toBeVisible();
    });

    test('should select a planet and update info panel', async ({ page }) => {
        const openBtn = page.locator('#btn-planets');
        await openBtn.click();

        await waitForNavList(page);

        // Click on Earth
        const earthButton = page.locator('#nav-list').getByText('Earth', { exact: true });
        await earthButton.click();

        // Wait for info panel to update
        await page.waitForTimeout(500);

        // Info panel should show Earth
        const infoName = page.locator('#info-name');
        await expect(infoName).toContainText('Earth');
    });

    test('should show Jupiter moons in navigation', async ({ page }) => {
        const openBtn = page.locator('#btn-planets');
        await openBtn.click();

        await waitForNavList(page);

        // Search for Jupiter's moons
        const searchInput = page.locator('#nav-search');
        await searchInput.fill('Io');
        await page.waitForTimeout(300);

        // Io (Jupiter's moon) should appear
        const ioButton = page.locator('#nav-list').getByText('Io', { exact: false });
        await expect(ioButton.first()).toBeVisible();
    });
});
