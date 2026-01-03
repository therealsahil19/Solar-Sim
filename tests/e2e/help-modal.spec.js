/**
 * 🧪 Verifier E2E Tests: Help Modal
 * Tests the help/welcome modal interactions and accessibility.
 * 
 * @flow Modal -> Open via Button -> Close via Button -> Open via Keyboard -> Verify Content
 */
import { test, expect } from '@playwright/test';

test.describe('Help Modal', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Wait for loading screen to disappear
        await page.waitForSelector('#loading-screen', { state: 'hidden', timeout: 60000 });
        // Close welcome modal if it auto-opened
        const modal = page.locator('#welcome-modal');
        if (await modal.isVisible()) {
            await page.locator('.modal-close-btn').click();
            await page.waitForTimeout(300);
        }
    });

    test('should open help modal via button', async ({ page }) => {
        const helpBtn = page.locator('#btn-help');
        const modal = page.locator('#welcome-modal');

        // Open modal
        await helpBtn.click();
        await expect(modal).toBeVisible();
    });

    test('should close help modal via close button', async ({ page }) => {
        const helpBtn = page.locator('#btn-help');
        const modal = page.locator('#welcome-modal');
        const closeBtn = page.locator('.modal-close-btn');

        // Open modal
        await helpBtn.click();
        await expect(modal).toBeVisible();

        // Close modal
        await closeBtn.click();
        await expect(modal).not.toBeVisible();
    });

    test('should display controls and shortcuts content', async ({ page }) => {
        const helpBtn = page.locator('#btn-help');
        await helpBtn.click();

        // Modal should have the heading
        const heading = page.locator('#welcome-modal h2');
        await expect(heading).toHaveText('Controls & Shortcuts');

        // Should have kbd elements for shortcuts
        const kbdElements = page.locator('#welcome-modal kbd');
        const count = await kbdElements.count();
        expect(count).toBeGreaterThan(0);
    });

    test('should close modal with Escape key', async ({ page }) => {
        const helpBtn = page.locator('#btn-help');
        const modal = page.locator('#welcome-modal');

        // Open modal
        await helpBtn.click();
        await expect(modal).toBeVisible();

        // Press Escape to close
        await page.keyboard.press('Escape');
        await expect(modal).not.toBeVisible();
    });

    test('should have accessible close button', async ({ page }) => {
        const helpBtn = page.locator('#btn-help');
        await helpBtn.click();

        // Close button should have aria-label
        const closeBtn = page.locator('.modal-close-btn');
        await expect(closeBtn).toHaveAttribute('aria-label', 'Close dialog');
    });

    test('should have focusable elements within modal', async ({ page }) => {
        const helpBtn = page.locator('#btn-help');
        await helpBtn.click();

        const modal = page.locator('#welcome-modal');
        await expect(modal).toBeVisible();

        // Wait for modal to be fully interactive
        await page.waitForTimeout(300);

        // Tab to move focus
        await page.keyboard.press('Tab');

        // Check that focus is somewhere in the document (not lost)
        const hasFocus = await page.evaluate(() => {
            return document.activeElement !== null && document.activeElement !== document.body;
        });

        expect(hasFocus).toBe(true);
    });
});
