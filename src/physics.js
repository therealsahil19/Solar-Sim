/**
 * @file physics.js
 * @description Orbital Mechanics & Scaling Logic.
 *
 * Handles Keplerian physics calculation and Multi-Zone Scaling
 * to allow visualization of vast distances (AU scale) in a small 3D buffer.
 */

import * as THREE from 'three';

const DEG_TO_RAD = Math.PI / 180;

/**
 * Calculates the position of an object in 3D space based on Keplerian orbital elements.
 *
 * @param {Object} orbit - Orbital parameters.
 * @param {number} orbit.a - Semi-major axis in AU.
 * @param {number} orbit.e - Eccentricity (0 = circle, <1 = ellipse).
 * @param {number} orbit.i - Inclination in degrees.
 * @param {number} orbit.omega - Argument of Periapsis (degrees).
 * @param {number} orbit.Omega - Longitude of Ascending Node (degrees).
 * @param {number} orbit.M0 - Mean Anomaly at Epoch (degrees).
 * @param {number} time - Current simulation time in Earth Years.
 * @returns {THREE.Vector3} The position vector in AU (Physics Space).
 */
export function getOrbitalPosition(orbit, time) {
    const { a, e, i, omega, Omega, M0 } = orbit;

    // 1. Calculate Mean Anomaly (M)
    // T (Period) = a^1.5 (Kepler's 3rd Law for Sol)
    const period = Math.pow(a, 1.5);
    const n = 360 / period; // Mean motion (deg/year)
    const M = (M0 + n * time) * DEG_TO_RAD; // Current M in radians

    // 2. Solve Kepler's Equation for Eccentric Anomaly (E)
    // M = E - e * sin(E) -> Solve for E using Newton-Raphson
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
 * MULTI-ZONE SCALING (Rendering)
 *
 * Inner Planets (0-30 AU): Linear Scale (1 AU = 40 Units)
 * Kuiper Belt (30-50 AU): Mild Logarithmic Scale
 * Oort Cloud (>50 AU): Aggressive Logarithmic Scale
 */

const AU_SCALE = 40.0;
const LIMIT_1 = 30.0;
const LIMIT_2 = 50.0;

// Pre-calculated constants for boundary continuity
const VISUAL_LIMIT_1 = LIMIT_1 * AU_SCALE; // 1200
const LOG_FACTOR_K = 1.5;
const VISUAL_OFFSET_K = Math.log(1 + (LIMIT_2 - LIMIT_1)) * AU_SCALE * LOG_FACTOR_K; // Delta for Kuiper width
const VISUAL_LIMIT_2 = VISUAL_LIMIT_1 + VISUAL_OFFSET_K; // ~1382.67
const LOG_FACTOR_O = 4.0;

export function physicsToRender(vector) {
    const r = vector.length(); // Physical distance (AU)

    if (r === 0) return new THREE.Vector3(0, 0, 0);

    let r_vis;

    if (r <= LIMIT_1) {
        // Linear Region
        r_vis = r * AU_SCALE;
    } else if (r <= LIMIT_2) {
        // Kuiper Belt Region (Mild Log)
        // Base + Log(1 + delta) * Scale * Factor
        r_vis = VISUAL_LIMIT_1 + Math.log(1 + (r - LIMIT_1)) * AU_SCALE * LOG_FACTOR_K;
    } else {
        // Oort Cloud Region (Aggressive Log)
        r_vis = VISUAL_LIMIT_2 + Math.log(1 + (r - LIMIT_2)) * AU_SCALE * LOG_FACTOR_O;
    }

    // Normalize and scale
    return vector.clone().normalize().multiplyScalar(r_vis);
}

/**
 * Inverse function for raycasting/mouse picking.
 * Given a visual distance, estimate the physical distance.
 */
export function renderToPhysicsEstimate(visualDistance) {
    if (visualDistance <= VISUAL_LIMIT_1) {
        return visualDistance / AU_SCALE;
    } else if (visualDistance <= VISUAL_LIMIT_2) {
        // r_vis = V1 + log(1 + r - L1) * S * K
        // (r_vis - V1) / (S * K) = log(1 + r - L1)
        // exp(...) = 1 + r - L1
        // r = exp(...) + L1 - 1
        return Math.exp((visualDistance - VISUAL_LIMIT_1) / (AU_SCALE * LOG_FACTOR_K)) + LIMIT_1 - 1;
    } else {
        // r_vis = V2 + log(1 + r - L2) * S * O
        return Math.exp((visualDistance - VISUAL_LIMIT_2) / (AU_SCALE * LOG_FACTOR_O)) + LIMIT_2 - 1;
    }
}
