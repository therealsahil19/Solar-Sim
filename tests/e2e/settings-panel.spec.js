/**
 * 🧪 Verifier E2E Tests: Settings Panel
 * Tests the Settings Panel interactions including toggles, themes, and speed control.
 * 
 * @flow Settings -> Toggle Textures -> Toggle Labels -> Toggle Orbits -> Change Theme -> Adjust Speed
 */
import { test, expect } from '@playwright/test';

/**
 * Helper to properly set range input value and trigger events
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 * @param {string} value
 */
async function setSliderValue(page, selector, value) {
    await page.evaluate(({ sel, val }) => {
        const slider = document.querySelector(sel);
        if (slider) {
            slider.value = val;
            slider.dispatchEvent(new Event('input', { bubbles: true }));
            slider.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }, { sel: selector, val: value });
}

test.describe('Settings Panel', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Wait for loading screen to disappear (simulation loaded)
        await page.waitForSelector('#loading-screen', { state: 'hidden', timeout: 60000 });
        // Close welcome modal if present
        const modal = page.locator('#welcome-modal');
        if (await modal.isVisible()) {
            await page.locator('.modal-close-btn').click();
        }
    });

    test('should open and close settings panel', async ({ page }) => {
        const settingsPanel = page.locator('#settings-panel');
        const settingsBtn = page.locator('#btn-settings');
        const closeBtn = page.locator('#btn-close-settings');

        // Initially hidden
        await expect(settingsPanel).toHaveAttribute('aria-hidden', 'true');

        // Open settings
        await settingsBtn.click();
        await expect(settingsPanel).toHaveAttribute('aria-hidden', 'false');

        // Close settings
        await closeBtn.click();
        await expect(settingsPanel).toHaveAttribute('aria-hidden', 'true');
    });

    test('should toggle textures setting', async ({ page }) => {
        const settingsBtn = page.locator('#btn-settings');
        await settingsBtn.click();

        const textureToggle = page.locator('#setting-textures');

        // Initially checked
        await expect(textureToggle).toBeChecked();

        // Toggle off
        await textureToggle.click();
        await expect(textureToggle).not.toBeChecked();

        // Toggle back on
        await textureToggle.click();
        await expect(textureToggle).toBeChecked();
    });

    test('should toggle labels setting', async ({ page }) => {
        const settingsBtn = page.locator('#btn-settings');
        await settingsBtn.click();

        const labelsToggle = page.locator('#setting-labels');

        // Initially checked
        await expect(labelsToggle).toBeChecked();

        // Toggle off
        await labelsToggle.click();
        await expect(labelsToggle).not.toBeChecked();
    });

    test('should toggle orbits setting', async ({ page }) => {
        const settingsBtn = page.locator('#btn-settings');
        await settingsBtn.click();

        const orbitsToggle = page.locator('#setting-orbits');

        // Initially checked
        await expect(orbitsToggle).toBeChecked();

        // Toggle off
        await orbitsToggle.click();
        await expect(orbitsToggle).not.toBeChecked();
    });

    test('should change theme', async ({ page }) => {
        const settingsBtn = page.locator('#btn-settings');
        await settingsBtn.click();

        const defaultThemeBtn = page.locator('.theme-btn[data-theme="default"]');
        const blueprintThemeBtn = page.locator('.theme-btn[data-theme="blueprint"]');
        const oledThemeBtn = page.locator('.theme-btn[data-theme="oled"]');

        // Default is active initially
        await expect(defaultThemeBtn).toHaveAttribute('aria-pressed', 'true');
        await expect(blueprintThemeBtn).toHaveAttribute('aria-pressed', 'false');

        // Switch to Blueprint theme
        await blueprintThemeBtn.click();
        await expect(blueprintThemeBtn).toHaveAttribute('aria-pressed', 'true');
        await expect(defaultThemeBtn).toHaveAttribute('aria-pressed', 'false');

        // Switch to OLED theme
        await oledThemeBtn.click();
        await expect(oledThemeBtn).toHaveAttribute('aria-pressed', 'true');
        await expect(blueprintThemeBtn).toHaveAttribute('aria-pressed', 'false');
    });

    test('should adjust simulation speed', async ({ page }) => {
        const settingsBtn = page.locator('#btn-settings');
        await settingsBtn.click();

        const speedValue = page.locator('#setting-speed-value');

        // Initial value is 1.0x
        await expect(speedValue).toHaveText('1.0x');

        // Change speed to 2.0 using helper
        await setSliderValue(page, '#setting-speed', '2.0');
        await expect(speedValue).toHaveText('2.0x');

        // Change speed to max (5.0)
        await setSliderValue(page, '#setting-speed', '5.0');
        await expect(speedValue).toHaveText('5.0x');
    });

    test('should persist settings after refresh (localStorage)', async ({ page }) => {
        const settingsBtn = page.locator('#btn-settings');
        await settingsBtn.click();

        // Toggle textures off
        const textureToggle = page.locator('#setting-textures');
        await textureToggle.click();
        await expect(textureToggle).not.toBeChecked();

        // Reload page
        await page.reload();
        await page.waitForSelector('#loading-screen', { state: 'hidden', timeout: 60000 });

        // Open settings again
        await settingsBtn.click();

        // Textures should still be off (persisted)
        await expect(textureToggle).not.toBeChecked();
    });
});
