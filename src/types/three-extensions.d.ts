/**
 * @file three-extensions.d.ts
 * @description Type augmentation for Three.js Object3D userData.
 * 
 * This extends the default Three.js types to provide type-safe access
 * to custom properties we attach to meshes in the simulation.
 */

import type { SolarSimUserData } from './index';

declare module 'three' {
    interface Object3D {
        /**
         * Extended userData with Solar-Sim specific properties.
         * We use a partial type to allow gradual assignment.
         */
        userData: SolarSimUserData & Record<string, unknown>;
    }
}
