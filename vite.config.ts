import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Vite Configuration for Solar-Sim
 * 
 * Key settings:
 * - base: './' for GitHub Pages relative path compatibility
 * - Path aliases matching tsconfig.json
 * - Optimized chunk splitting for Three.js
 */
export default defineConfig({
    base: './',

    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
            '@components': resolve(__dirname, 'src/components'),
            '@managers': resolve(__dirname, 'src/managers'),
            '@types': resolve(__dirname, 'src/types'),
        },
    },

    build: {
        outDir: 'dist',
        sourcemap: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    three: ['three'],
                },
            },
        },
    },

    server: {
        port: 5173,
        open: true,
    },

    preview: {
        port: 8080,
    },
});
