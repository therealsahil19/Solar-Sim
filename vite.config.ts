import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Vite Configuration for Solar-Sim
 * 
 * Key settings:
 * - base: './' for GitHub Pages relative path compatibility
 * - publicDir: '.' to include textures and system.json from root
 * - Path aliases matching tsconfig.json
 * - Optimized chunk splitting for Three.js
 */
export default defineConfig({
    base: './',

    // Use root as public dir to include textures folder and system.json
    publicDir: false,  // Disable default public dir

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
        // Copy static assets that aren't in public folder
        copyPublicDir: false,
    },

    server: {
        port: 5173,
        open: true,
    },

    preview: {
        port: 8080,
    },
});

