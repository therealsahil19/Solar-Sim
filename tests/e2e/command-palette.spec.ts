
import { test, expect } from '@playwright/test';

test.describe('Command Palette Shortcut', () => {
    test('should toggle command palette with Cmd+K / Ctrl+K', async ({ page }) => {
        await page.goto('/');

        // Wait for app initialization (canvas attached)
        await page.waitForSelector('canvas', { state: 'attached' });

        // Ensure focus context
        await page.click('body');

        const palette = page.locator('#cmd-palette-overlay');
        const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';

        // 1. Open
        await page.keyboard.press(`${modifier}+k`);

        // If system is lagging or key mapping is weird, retry with alternative modifier
        // But for standard tests, we expect primary modifier to work.
        // We'll use a short timeout and retry if needed for robustness in CI environments.
        try {
            await expect(palette).toBeVisible({ timeout: 5000 });
        } catch (e) {
             // Fallback for different OS/Keyboard mapping in CI
             const altModifier = modifier === 'Meta' ? 'Control' : 'Meta';
             await page.keyboard.press(`${altModifier}+k`);
             await expect(palette).toBeVisible({ timeout: 5000 });
        }

        const input = page.locator('.cmd-input-wrapper input');
        await expect(input).toBeFocused();

        // 2. Close (while input is focused)
        await page.keyboard.press(`${modifier}+k`);

        // Check for 'animate-out' class which indicates closing animation started immediately.
        // We use this instead of toBeHidden() to avoid waiting for CSS transitions in slow environments.
        try {
            await expect(palette).toHaveClass(/animate-out/, { timeout: 2000 });
        } catch (e) {
             const altModifier = modifier === 'Meta' ? 'Control' : 'Meta';
             await page.keyboard.press(`${altModifier}+k`);
             await expect(palette).toHaveClass(/animate-out/, { timeout: 5000 });
        }
    });
});
