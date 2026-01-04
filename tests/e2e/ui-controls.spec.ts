import { test, expect } from '@playwright/test';

test.describe('UI Controls & Tools', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#loading-screen').waitFor({ state: 'hidden', timeout: 60000 });
    const modal = page.locator('#welcome-modal');
    if (await modal.isVisible()) {
        await page.locator('.modal-close-btn').click();
    }
  });

  test.describe('Global Toggles', () => {
    test('should toggle labels', async ({ page }) => {
        const btn = page.locator('#btn-labels');
        // Initial state: On (aria-pressed="true")
        await expect(btn).toHaveAttribute('aria-pressed', 'true');

        // Toggle Off
        await btn.click();
        await expect(btn).toHaveAttribute('aria-pressed', 'false');
    });

    test('should toggle orbits', async ({ page }) => {
        const btn = page.locator('#btn-orbits');
        // Initial state: On
        await expect(btn).toHaveAttribute('aria-pressed', 'true');

        // Toggle Off
        await btn.click();
        await expect(btn).toHaveAttribute('aria-pressed', 'false');
    });

    test('should toggle textures', async ({ page }) => {
        const btn = page.locator('#btn-texture');
        // Initial state: On
        await expect(btn).toHaveAttribute('aria-pressed', 'true');

        // Toggle Off
        await btn.click();
        await expect(btn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  test.describe('Time Controls', () => {
    test('should toggle pause/resume', async ({ page }) => {
        const btn = page.locator('#btn-pause');

        // Click to Pause
        await btn.click();
        await expect(btn).toHaveAttribute('aria-label', /Play|Resume/i);

        // Click to Resume
        await btn.click();
        await expect(btn).toHaveAttribute('aria-label', /Pause/i);
    });

    test('should change simulation speed', async ({ page }) => {
        // Use evaluate to interact with range input reliably
        await page.evaluate(() => {
            const slider = document.querySelector('#slider-speed') as HTMLInputElement;
            if (slider) {
                slider.value = '3.0';
                slider.dispatchEvent(new Event('input', { bubbles: true }));
                slider.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        await expect(page.locator('#speed-value')).toHaveText('3.0x');
    });
  });

  test.describe('Command Palette', () => {
    test('should open with keyboard shortcut and execute command', async ({ page }) => {
        test.setTimeout(60000); // Increase test timeout

        // Ensure focus is on body
        await page.click('body');

        // Press Ctrl+K
        await page.keyboard.press('Control+k');

        const palette = page.locator('#cmd-palette-overlay');

        // Retry with Meta+k if needed
        if (!await palette.isVisible()) {
            await page.keyboard.press('Meta+k');
        }

        await expect(palette).toBeVisible({ timeout: 5000 });
        const input = palette.locator('input');
        await expect(input).toBeFocused();

        // Type 'Toggle Labels'
        await input.fill('Toggle Labels');

        // Click the first item to be reliable
        const firstItem = palette.locator('.cmd-item').first();
        await expect(firstItem).toBeVisible();
        await firstItem.click();

        // Wait for it to be hidden (increase timeout to allow for animation)
        await expect(palette).toBeHidden({ timeout: 30000 });

        // Check effect: Labels toggled off
        await expect(page.locator('#btn-labels')).toHaveAttribute('aria-pressed', 'false');
    });
  });

});
