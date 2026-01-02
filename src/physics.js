/**
 * @file physics.js
 * @description Orbital Mechanics & Multi-Zone Coordinate Scaling.
 *
 * This module is responsible for:
 * 1. calculating accurate Keplerian orbital positions.
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

const DEG_TO_RAD = Math.PI / 180;

/**
 * Calculates the 3D position of a celestial body using Kepler's Laws.
 *
 * Logic:
 * 1. Calculates Mean Anomaly (M) based on time and orbital period.
 * 2. Solves Kepler's Equation (M = E - e*sin(E)) for Eccentric Anomaly (E) using Newton-Raphson iteration.
 * 3. Derives True Anomaly (nu) and Radius (r) from E.
 * 4. Transforms polar coordinates to 3D Cartesian coordinates using orbital elements (i, Omega, omega).
 *
 * @param {Object} orbit - The Keplerian orbital elements.
 * @param {number} orbit.a - Semi-major axis (AU). Size of the orbit.
 * @param {number} orbit.e - Eccentricity (0=circle, 0.99=highly elliptical). Shape.
 * @param {number} orbit.i - Inclination (degrees). Tilt relative to the ecliptic plane.
 * @param {number} orbit.omega - Argument of Periapsis (degrees). Orientation of the ellipse in the orbital plane.
 * @param {number} orbit.Omega - Longitude of Ascending Node (degrees). Orientation of the ascending node.
 * @param {number} orbit.M0 - Mean Anomaly at Epoch (degrees). Starting position at time=0.
 * @param {number} time - Current simulation time in Earth Years.
 * @returns {THREE.Vector3} The physical position vector in AU (before visual scaling).
 */
export function getOrbitalPosition(orbit, time) {
    const { a, e, i, omega, Omega, M0 } = orbit;

    // 1. Calculate Mean Anomaly (M)
    // Kepler's 3rd Law: T^2 = a^3 -> T = a^1.5 (for mass of Sun = 1)
    const period = Math.pow(a, 1.5);
    const n = 360 / period; // Mean motion (degrees per year)
    const M = (M0 + n * time) * DEG_TO_RAD; // Current Mean Anomaly in radians

    // 2. Solve Kepler's Equation for Eccentric Anomaly (E)
    // M = E - e * sin(E). This is transcendental, so we approximate E.
    // We use Fixed-Point Iteration which works well for low eccentricities.
    let E = M;
    for (let j = 0; j < 5; j++) {
        E = M + e * Math.sin(E);
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

    const cosNu = Math.cos(nu);
    const sinNu = Math.sin(nu);
    const cosOm = Math.cos(Omega * DEG_TO_RAD);
    const sinOm = Math.sin(Omega * DEG_TO_RAD);
    // const cosO = Math.cos(omega * DEG_TO_RAD);
    // const sinO = Math.sin(omega * DEG_TO_RAD);
    const cosI = Math.cos(i * DEG_TO_RAD);
    const sinI = Math.sin(i * DEG_TO_RAD);

    // Simplified rotation matrix application
    // The previous implementation had the correct breakdown for 3D orbital elements.
    // Argument of Latitude u = omega + nu
    const u = omega * DEG_TO_RAD + nu;
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

    return new THREE.Vector3(x_astro, z_astro, y_astro);
}


/**
 * MULTI-ZONE SCALING CONFIGURATION
 *
 * Defines the piecewise function regions:
 * 1. Inner System (0-30 AU): Linear. Accurate for relative spacing of planets.
 * 2. Kuiper Belt (30-50 AU): Mild Logarithmic. Compresses the gap between Neptune and Pluto.
 * 3. Oort Cloud (>50 AU): Aggressive Logarithmic. Brings the far reaches (100k AU) into viewable range.
 *
 * Bug 043 Fix: Extracted constants into a documented configuration object for maintainability.
 */

/** @type {Object} Scale configuration for the multi-zone rendering system */
const SCALE_CONFIG = {
    /** 1 AU (Astronomical Unit) = 40 Three.js units */
    AU_SCALE: 40.0,
    /** End of Linear Zone in AU (Neptune is ~30 AU) */
    LIMIT_LINEAR: 30.0,
    /** End of Kuiper Belt Zone in AU */
    LIMIT_KUIPER: 50.0,
    /** Compression strength for Kuiper Belt Zone */
    LOG_FACTOR_KUIPER: 1.5,
    /** Compression strength for Oort Cloud Zone */
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
 * Transforms a physical position vector (in AU) to a render-ready position vector.
 * Applies the Multi-Zone Piecewise Scaling function.
 *
 * @param {THREE.Vector3} vector - The physical position (x, y, z) in AU.
 * @returns {THREE.Vector3} A NEW Vector3 representing the visual position in the scene.
 */
export function physicsToRender(vector) {
    const r = vector.length(); // Physical distance from origin (AU)

    if (r === 0) return new THREE.Vector3(0, 0, 0);

    let r_vis;

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

    // Preserve direction, apply new magnitude
    return vector.clone().normalize().multiplyScalar(r_vis);
}

/**
 * Inverse function for Raycasting / Mouse Picking.
 *
 * When the user clicks on the screen, the ray is in "Visual Space".
 * To find if it hits a physical object (logic-wise), we might need to reverse map it.
 * (Note: Currently mainly used for debug or reverse calculations).
 *
 * @param {number} visualDistance - The distance from origin in Three.js units.
 * @returns {number} Estimated physical distance in AU.
 */
export function renderToPhysicsEstimate(visualDistance) {
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
