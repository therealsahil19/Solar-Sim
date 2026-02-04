/**
 * @file physics.ts
 * @description Orbital Mechanics & Multi-Zone Coordinate Scaling.
 *
 * This module is responsible for:
 * 1. Calculating accurate Keplerian orbital positions.
 * 2. Transforming vast astronomical distances (AU) into a renderable 3D space
 *    using a Piecewise function (Linear -> Logarithmic).
 *
 * Why?
 * Solar systems are mostly empty space. If we used a 1:1 linear scale,
 * the Outer Planets would be invisible pixels when viewing the Inner System.
 * We use "Multi-Zone Scaling" to compress the outer regions while keeping the
 * inner system linearly accurate.
 */

import * as THREE from 'three';
import type { OrbitalParameters } from './types/system';

const DEG_TO_RAD = Math.PI / 180;

/**
 * Calculates the 3D position of a celestial body using Kepler's Laws.
 *
 * Logic:
 * 1. Calculates Mean Anomaly (M) based on time and orbital period.
 * Calculates the astronomical position of a body based on its orbital parameters.
 *
 * Technical Details:
 * 1. Mean Anomaly (M) is calculated from Time and Period.
 * 2. Eccentric Anomaly (E) is solved via Newton-Raphson iteration of Kepler's Equation: M = E - e*sin(E).
 * 3. True Anomaly (nu) and Radius (r) are derived from E.
 * 4. 2D Polar coordinates (r, nu) are rotated into 3D Cartesian space using orbit orientation.
 *
 * @param orbit - Orbital elements (a, e, i, etc.).
 * @param time - Cumulative simulation time in days.
 * @param out - Optional vector to store results (avoids GC).
 * @returns 3D Position in Astronomical Units (AU).
 */
export function getOrbitalPosition(
    orbit: OrbitalParameters,
    time: number,
    out: THREE.Vector3 | null = null
): THREE.Vector3 {
    const {
        a,
        e,
        i,
        omega = 0,
        w: argPerihelion = 0,
        M0 = 0
    } = orbit;

    // Use omega if provided, otherwise fallback to w (argument of perihelion)
    const omegaValue = omega ?? argPerihelion;

    // 1. Calculate Mean Anomaly (M)
    // Kepler's 3rd Law: T^2 = a^3 -> T = a^1.5 (for mass of Sun = 1)
    const period = Math.pow(a, 1.5);

    // wrapTime: ensures simulation time stays within one orbital period (0 to T).
    // This prevents precision loss in subsequent calculations that occur when
    // simulationTime becomes very large.
    // Note: Direct `time % period` can lose precision for extremely large values;
    // extracting the fractional part of (time / period) is numerically more stable.
    let phaseFraction = (time / period) % 1;
    if (phaseFraction < 0) phaseFraction += 1;
    const wrappedTime = phaseFraction * period;

    const n = 360 / period; // Mean motion (degrees per year)
    const M = (M0 + n * wrappedTime) * DEG_TO_RAD; // Now this stays in a small range

    // 2. Solve Kepler's Equation for Eccentric Anomaly (E)
    // M = E - e * sin(E). Using Newton-Raphson for fast, accurate convergence.
    let E = M; // Initial guess
    for (let j = 0; j < 15; j++) {
        const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
        E = E - dE;
        if (Math.abs(dE) < 1e-12) break; // Converged to high precision
    }

    // 3. Calculate True Anomaly (nu) and Radius (r)
    // r = a * (1 - e * cos(E))
    const r = a * (1 - e * Math.cos(E));

    // cos(nu) = (cos(E) - e) / (1 - e * cos(E))
    // sin(nu) = (sqrt(1 - e^2) * sin(E)) / (1 - e * cos(E))
    // We can use atan2 for robust angle
    const xv = a * (Math.cos(E) - e);
    const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const nu = Math.atan2(yv, xv);

    // 4. Transform to Heliocentric Coordinates (3D rotation)
    // We apply the orbital rotations: Omega (LAN), i (Inc), omega (Arg)
    // P = r * [cos(nu), sin(nu), 0]
    // Then rotate P by orbital elements.

    // Longitude of Ascending Node (Omega) - use default 0 if not in orbit params
    const Omega = 0; // Simplified - could be added to OrbitalParameters interface

    const cosOm = Math.cos(Omega * DEG_TO_RAD);
    const sinOm = Math.sin(Omega * DEG_TO_RAD);
    const cosI = Math.cos(i * DEG_TO_RAD);
    const sinI = Math.sin(i * DEG_TO_RAD);

    // Simplified rotation matrix application
    // Argument of Latitude u = omega + nu
    const u = omegaValue * DEG_TO_RAD + nu;
    const cosU = Math.cos(u);
    const sinU = Math.sin(u);

    // Standard Astro Coordinates:
    // x = r * (cos(Om)cos(u) - sin(Om)sin(u)cos(i))
    // y = r * (sin(Om)cos(u) + cos(Om)sin(u)cos(i))
    // z = r * (sin(i)sin(u))

    // Mapping to Three.js (Y is Up):
    // X_three = x
    // Y_three = z
    // Z_three = y

    const x_astro = r * (cosOm * cosU - sinOm * sinU * cosI);
    const y_astro = r * (sinOm * cosU + cosOm * sinU * cosI);
    const z_astro = r * (sinI * sinU);

    // ⚡ Bolt: Use provided output vector or create new one
    const result = out ?? new THREE.Vector3();
    return result.set(x_astro, z_astro, y_astro);
}


/**
 * MULTI-ZONE SCALING CONFIGURATION
 *
 * Defines the piecewise function regions:
 * 1. Inner System (0-30 AU): Linear. Accurate for relative spacing of planets.
 * 2. Kuiper Belt (30-50 AU): Mild Logarithmic. Compresses the gap between Neptune and Pluto.
 * 3. Oort Cloud (>50 AU): Aggressive Logarithmic. Brings the far reaches (100k AU) into viewable range.
 */

/** Scale configuration for the multi-zone rendering system */
interface ScaleConfig {
    /** 1 AU (Astronomical Unit) = 40 Three.js units */
    AU_SCALE: number;
    /** End of Linear Zone in AU (Neptune is ~30 AU) */
    LIMIT_LINEAR: number;
    /** End of Kuiper Belt Zone in AU */
    LIMIT_KUIPER: number;
    /** Compression strength for Kuiper Belt Zone */
    LOG_FACTOR_KUIPER: number;
    /** Compression strength for Oort Cloud Zone */
    LOG_FACTOR_OORT: number;
}

const SCALE_CONFIG: ScaleConfig = {
    AU_SCALE: 40.0,
    LIMIT_LINEAR: 30.0,
    LIMIT_KUIPER: 50.0,
    LOG_FACTOR_KUIPER: 1.5,
    LOG_FACTOR_OORT: 4.0
};

// Derived constants for backward compatibility
const AU_SCALE = SCALE_CONFIG.AU_SCALE;
const LIMIT_1 = SCALE_CONFIG.LIMIT_LINEAR;
const LIMIT_2 = SCALE_CONFIG.LIMIT_KUIPER;
const LOG_FACTOR_K = SCALE_CONFIG.LOG_FACTOR_KUIPER;
const LOG_FACTOR_O = SCALE_CONFIG.LOG_FACTOR_OORT;

// Pre-calculated constants for mathematical continuity (C0 continuity) at boundaries.
// This ensures no "jumps" in object positions when crossing zones.
const VISUAL_LIMIT_1 = LIMIT_1 * AU_SCALE; // 1200 units
const VISUAL_OFFSET_K = Math.log(1 + (LIMIT_2 - LIMIT_1)) * AU_SCALE * LOG_FACTOR_K; // Width of Zone 2 in visual units
const VISUAL_LIMIT_2 = VISUAL_LIMIT_1 + VISUAL_OFFSET_K; // ~1382.67 units

/**
 * Transforms physical distances (AU) into renderable Three.js units.
 * Uses Multi-Zone Piecewise Scaling (Linear -> Log -> Log).
 *
 * Motivation:
 * Space is too vast for linear scaling. A linear 1 AU = 40 units scale makes the
 * Oort Cloud (100,000 AU) impossible to render or see.
 *
 * Scaling Zones:
 * 1. Inner System [0 - 30 AU]: Linear (dist * 40). Accurate up to Neptune.
 * 2. Kuiper Belt [30 - 50 AU]: Mild Logarithmic. Compresses the distance between Neptune and Eris.
 * 3. Deep Space [50+ AU]: Aggressive Logarithmic. Allows the Oort Cloud to be visible.
 *
 * @param vector - Input position in AU.
 * @param out - Optional vector to store results.
 * @returns Scaled position for Three.js rendering.
 */
export function physicsToRender(
    vector: THREE.Vector3,
    out: THREE.Vector3 | null = null
): THREE.Vector3 {
    const r = vector.length(); // Physical distance from origin (AU)

    if (r === 0) {
        return out ? out.set(0, 0, 0) : new THREE.Vector3(0, 0, 0);
    }

    let r_vis: number;

    // Apply piecewise scaling logic
    if (r <= LIMIT_1) {
        // Zone 1: Linear
        r_vis = r * AU_SCALE;
    } else if (r <= LIMIT_2) {
        // Zone 2: Kuiper Belt (Mild Log)
        // Formula: BaseVisual + Log(1 + DeltaPhysical) * Scale * Compression
        r_vis = VISUAL_LIMIT_1 + Math.log(1 + (r - LIMIT_1)) * AU_SCALE * LOG_FACTOR_K;
    } else {
        // Zone 3: Oort Cloud (Aggressive Log)
        r_vis = VISUAL_LIMIT_2 + Math.log(1 + (r - LIMIT_2)) * AU_SCALE * LOG_FACTOR_O;
    }

    // ⚡ Bolt: Preserve direction, apply new magnitude (zero-allocation path)
    const result = out ?? new THREE.Vector3();
    // Optimization: Reuse 'r' to normalize manually, avoiding extra Math.sqrt() in normalize()
    return result.copy(vector).multiplyScalar(r_vis / r);
}

/**
 * Inverse function for Raycasting / Mouse Picking.
 *
 * When the user clicks on the screen, the ray is in "Visual Space".
 * To find if it hits a physical object (logic-wise), we might need to reverse map it.
 * (Note: Currently mainly used for debug or reverse calculations).
 *
 * @param visualDistance - The distance from origin in Three.js units.
 * @returns Estimated physical distance in AU.
 */
export function renderToPhysicsEstimate(visualDistance: number): number {
    if (visualDistance <= VISUAL_LIMIT_1) {
        return visualDistance / AU_SCALE;
    } else if (visualDistance <= VISUAL_LIMIT_2) {
        // Inverse of Zone 2 Logarithmic function:
        // r_vis = V1 + log(1 + r - L1) * S * K
        // (r_vis - V1) / (S * K) = log(1 + r - L1)
        // exp(...) = 1 + r - L1
        // r = exp(...) + L1 - 1
        return Math.exp((visualDistance - VISUAL_LIMIT_1) / (AU_SCALE * LOG_FACTOR_K)) + LIMIT_1 - 1;
    } else {
        // Inverse of Zone 3 Logarithmic function:
        return Math.exp((visualDistance - VISUAL_LIMIT_2) / (AU_SCALE * LOG_FACTOR_O)) + LIMIT_2 - 1;
    }
}

// Export scale config for use in other modules
export { SCALE_CONFIG, AU_SCALE };
