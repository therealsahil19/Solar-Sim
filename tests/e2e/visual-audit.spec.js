import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = '.jules/screenshots';

test.describe('Visual Audit', () => {

    test.beforeAll(async () => {
        if (!fs.existsSync(SCREENSHOT_DIR)) {
            fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
        }
    });

    test('capture screenshots for visual audit', async ({ page }) => {
        // Desktop
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        // Wait for generic initialization/animations
        await page.waitForTimeout(3000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop_audit.png'), fullPage: true });

        // Tablet
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tablet_audit.png'), fullPage: true });

        // Mobile
        await page.setViewportSize({ width: 375, height: 667 });
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'mobile_audit.png'), fullPage: true });
    });
});
