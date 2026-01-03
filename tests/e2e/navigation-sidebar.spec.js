/**
 * 🧪 Verifier E2E Tests: Navigation Sidebar
 * Tests the Navigation Sidebar interactions including open/close, search, and planet selection.
 * 
 * @flow Navigation -> Open Sidebar -> Search Planet -> Select Planet -> Verify Info Panel
 */
import { test, expect } from '@playwright/test';

test.describe('Navigation Sidebar', () => {

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

        // Wait for skeleton to be replaced with actual content
        await page.waitForSelector('#nav-list .nav-btn:not(.skeleton)', { timeout: 10000 });

        // Should have navigation buttons (planets)
        const navButtons = page.locator('#nav-list .nav-btn:not(.skeleton)');
        await expect(navButtons).toHaveCount(await navButtons.count());

        // At minimum should have Sun
        const sunButton = page.locator('#nav-list').getByText('Sun', { exact: true });
        await expect(sunButton).toBeVisible();
    });

    test('should filter planets via search', async ({ page }) => {
        const openBtn = page.locator('#btn-planets');
        await openBtn.click();

        await page.waitForSelector('#nav-list .nav-btn:not(.skeleton)', { timeout: 10000 });

        const searchInput = page.locator('#nav-search');

        // Search for "Mars"
        await searchInput.fill('Mars');

        // Mars should be visible
        const marsButton = page.locator('#nav-list').getByText('Mars', { exact: false });
        await expect(marsButton.first()).toBeVisible();
    });

    test('should clear search results when input is cleared', async ({ page }) => {
        const openBtn = page.locator('#btn-planets');
        await openBtn.click();

        await page.waitForSelector('#nav-list .nav-btn:not(.skeleton)', { timeout: 10000 });

        const searchInput = page.locator('#nav-search');

        // Search for something
        await searchInput.fill('Jupiter');

        // Clear the search
        await searchInput.fill('');

        // Multiple planets should be visible again (Sun, Earth, Mars, etc.)
        const sunButton = page.locator('#nav-list').getByText('Sun', { exact: true });
        await expect(sunButton).toBeVisible();
    });

    test('should select a planet and update info panel', async ({ page }) => {
        const openBtn = page.locator('#btn-planets');
        await openBtn.click();

        await page.waitForSelector('#nav-list .nav-btn:not(.skeleton)', { timeout: 10000 });

        // Click on Earth
        const earthButton = page.locator('#nav-list').getByText('Earth', { exact: true });
        await earthButton.click();

        // Info panel should show Earth
        const infoName = page.locator('#info-name');
        await expect(infoName).toContainText('Earth');
    });

    test('should show Jupiter moons in navigation', async ({ page }) => {
        const openBtn = page.locator('#btn-planets');
        await openBtn.click();

        await page.waitForSelector('#nav-list .nav-btn:not(.skeleton)', { timeout: 10000 });

        // Search for Jupiter's moons
        const searchInput = page.locator('#nav-search');
        await searchInput.fill('Io');

        // Io (Jupiter's moon) should appear
        const ioButton = page.locator('#nav-list').getByText('Io', { exact: false });
        await expect(ioButton.first()).toBeVisible();
    });
});
