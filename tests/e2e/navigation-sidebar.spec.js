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
    // Wait for sidebar to be visible first
    await page.waitForSelector('#nav-sidebar:not([aria-hidden="true"])', { timeout: 10000 });

    // Wait for at least one real planet button to appear (not skeleton)
    await page.waitForFunction(() => {
        const navList = document.querySelector('#nav-list');
        if (!navList) return false;
        // Search for buttons that don't have the skeleton class
        const buttons = Array.from(navList.querySelectorAll('button, .nav-btn')).filter(btn => !btn.classList.contains('skeleton'));
        return buttons.length > 0;
    }, { timeout: 30000 });

    // Minimal delay for layout settlement
    await page.waitForTimeout(500);
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

    /**
     * Verifies that the navigation sidebar can be opened and closed using UI buttons.
     */
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

    /**
     * Verifies that the planet list is correctly populated after the sidebar is opened.
     */
    test('should display planet list after loading', async ({ page }) => {
        const openBtn = page.locator('#btn-planets');
        await openBtn.click();

        // Wait for nav list to populate
        await waitForNavList(page);

        // At minimum should have Sun
        const sunButton = page.locator('#nav-list').getByText('Sun', { exact: false });
        await expect(sunButton).toBeVisible();
    });

    /**
     * Verifies the client-side search functionality filtering for specific planets.
     */
    test('should filter planets via search', async ({ page }) => {
        const openBtn = page.locator('#btn-planets');
        await openBtn.click();

        await waitForNavList(page);

        const searchInput = page.locator('#nav-search');

        // Search for "Mars"
        await searchInput.fill('Mars');

        // Mars should be visible (dynamic wait)
        const marsButton = page.locator('#nav-list').getByText('Mars', { exact: false });
        await expect(marsButton.first()).toBeVisible({ timeout: 10000 });
    });

    /**
     * Verifies that clearing the search input restores all planets to the list.
     */
    test('should clear search results when input is cleared', async ({ page }) => {
        const openBtn = page.locator('#btn-planets');
        await openBtn.click();

        await waitForNavList(page);

        const searchInput = page.locator('#nav-search');

        // Search for something
        await searchInput.fill('Jupiter');
        await expect(page.locator('#nav-list').getByText('Jupiter', { exact: false }).first()).toBeVisible();

        // Clear the search
        await searchInput.fill('');

        // Multiple planets should be visible again (Sun, Earth, Mars, etc.)
        const sunButton = page.locator('#nav-list').getByText('Sun', { exact: false });
        await expect(sunButton).toBeVisible({ timeout: 10000 });
    });

    /**
     * Verifies that selecting a planet from the list updates the Info Panel data.
     */
    test('should select a planet and update info panel', async ({ page }) => {
        const openBtn = page.locator('#btn-planets');
        await openBtn.click();

        await waitForNavList(page);

        // Click on Earth
        const earthButton = page.locator('#nav-list').getByText('Earth', { exact: false });
        await earthButton.click();

        // Wait for info panel to update with Earth's data
        const infoName = page.locator('#info-name');
        await expect(infoName).toHaveText('Earth', { timeout: 10000 });
    });

    /**
     * Verifies that hierarchical objects (like Jupiter's moons) are searchable and selectable.
     */
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
