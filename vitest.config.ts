import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        include: ['tests/unit/**/*.{test,spec}.{js,ts}'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['src/**/*.ts'],
            exclude: ['src/types/**', 'src/main.ts']
        },
        setupFiles: ['./tests/unit/setup.ts']
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src')
        }
    }
});
