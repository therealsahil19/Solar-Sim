// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for Solar-Sim
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
    testDir: './tests/e2e',

    /* Run tests in parallel for speed */
    fullyParallel: true,

    /* Fail build on test.only in CI */
    forbidOnly: !!process.env.CI,

    /* Retry on CI only */
    retries: process.env.CI ? 2 : 0,

    /* Single worker for consistent behavior in dev */
    workers: process.env.CI ? undefined : 1,

    /* Reporter configuration */
    reporter: [
        ['html', { outputFolder: 'playwright-report' }],
        ['list']
    ],

    /* Shared settings for all tests */
    use: {
        /* Base URL for navigation */
        baseURL: 'http://127.0.0.1:8080',

        /* Collect trace on first retry */
        trace: 'on-first-retry',

        /* Screenshot on failure */
        screenshot: 'only-on-failure',

        /* Video on failure */
        video: 'on-first-retry',
    },

    /* Configure browser project */
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    /* Run local dev server before starting tests */
    webServer: {
        command: 'npx serve -p 8080 .',
        url: 'http://127.0.0.1:8080',
        reuseExistingServer: !process.env.CI,
        timeout: 30 * 1000,
    },
});
