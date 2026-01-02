/**
 * @file physics.js
 * @description Core physics engine for the solar system simulation.
 * Handles Keplerian orbital mechanics and the Logarithmic Depth Buffer transformation.
 */

import * as THREE from 'three';

// --- Constants ---
const K_FACTOR = 8.0;       // Logarithmic compression factor
const SCENE_SCALE = 20.0;   // Visual scale multiplier
const TWO_PI = Math.PI * 2;

// --- Helper Math ---

/**
 * Solves Kepler's Equation M = E - e * sin(E) for E (Eccentric Anomaly).
 * Uses Newton-Raphson iteration.
 * @param {number} M - Mean Anomaly (radians)
 * @param {number} e - Eccentricity
 * @returns {number} Eccentric Anomaly (radians)
 */
function solveKepler(M, e) {
    // Initial guess: E ≈ M
    let E = M;
    // Higher eccentricity needs a better guess or more iterations
    if (e > 0.8) E = Math.PI;

    for (let i = 0; i < 10; i++) {
        const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
        E -= dE;
        if (Math.abs(dE) < 1e-6) break;
    }
    return E;
}

/**
 * Calculates the 3D position of an object in Physics Space (AU).
 * @param {Object} elements - Orbital elements.
 * @param {number} elements.a - Semi-major axis (AU).
 * @param {number} elements.e - Eccentricity.
 * @param {number} elements.i - Inclination (degrees).
 * @param {number} elements.omega - Argument of Periapsis (degrees).
 * @param {number} elements.Omega - Longitude of Ascending Node (degrees).
 * @param {number} elements.M0 - Mean Anomaly at Epoch (degrees).
 * @param {number} time - Simulation time (Earth Years).
 * @returns {THREE.Vector3} Position in AU.
 */
export function getOrbitalPosition(elements, time) {
    const { a, e } = elements;

    // Convert degrees to radians
    const i = elements.i * (Math.PI / 180);
    const omega = elements.omega * (Math.PI / 180);
    const Omega = elements.Omega * (Math.PI / 180);
    const M0 = elements.M0 * (Math.PI / 180);

    // 1. Calculate Mean Motion (n)
    // T = a^1.5 (Kepler's 3rd Law for Sol system, units: AU, Years)
    // n = 2 * PI / T
    const period = Math.pow(a, 1.5);
    const n = TWO_PI / period;

    // 2. Mean Anomaly at time t
    let M = M0 + n * time;
    M = M % TWO_PI; // Normalize

    // 3. Eccentric Anomaly (E)
    const E = solveKepler(M, e);

    // 4. True Anomaly (nu) & Radius (r)
    // cos(nu) = (cos(E) - e) / (1 - e*cos(E))
    // r = a * (1 - e*cos(E))

    // Alternative calculation using P and Q vectors approach,
    // but explicit x,y in orbital plane is easier to read.
    const x_orb = a * (Math.cos(E) - e);
    const y_orb = a * Math.sqrt(1 - e * e) * Math.sin(E);

    // 5. Rotate to Ecliptic Frame (3D)
    // We apply rotations:
    // 1. rotate around Z by omega (Argument of Periapsis)
    // 2. rotate around X by i (Inclination)
    // 3. rotate around Z by Omega (Longitude of Ascending Node)

    // Manual Rotation Matrix application for performance optimization

    const cosOmega = Math.cos(Omega);
    const sinOmega = Math.sin(Omega);
    const cosomega = Math.cos(omega);
    const sinomega = Math.sin(omega);
    const cosi = Math.cos(i);
    const sini = Math.sin(i);

    // x' = x_orb * cos(omega) - y_orb * sin(omega)
    // y' = x_orb * sin(omega) + y_orb * cos(omega)
    const x_plane = x_orb * cosomega - y_orb * sinomega;
    const y_plane = x_orb * sinomega + y_orb * cosomega;

    // Now tilt by inclination (rotate around X axis)
    // x'' = x_plane
    // y'' = y_plane * cos(i)
    // z'' = y_plane * sin(i)
    const x_inc = x_plane;
    const y_inc = y_plane * cosi;
    const z_inc = y_plane * sini;

    // Now rotate by Longitude of Ascending Node (around Z axis)
    // x_final = x'' * cos(Omega) - y'' * sin(Omega)
    // y_final = x'' * sin(Omega) + y'' * cos(Omega)
    // z_final = z''

    const x = x_inc * cosOmega - y_inc * sinOmega;
    const y = x_inc * sinOmega + y_inc * cosOmega;
    const z = z_inc;

    // Three.js Coordinate System: Y is UP.
    // Astronomy usually uses Z as UP (Ecliptic Pole).
    // Mapping: Astro(x,y,z) -> Three(x, z, -y) or (x, z, y)?
    // Let's stick to standard Three.js ground plane: XZ is the ecliptic. Y is Up.
    // So our 'z_final' (height above ecliptic) maps to Three.js 'y'.
    // Our 'x_final', 'y_final' map to Three.js 'x', 'z'.

    return new THREE.Vector3(x, z, y);
}

/**
 * Transforms a Physics Space position (AU) to Render Space (Scene Units).
 * Applies a Logarithmic transformation to preserve direction but compress distance.
 *
 * Formula: d' = log(1 + d * k) * scale
 *
 * @param {THREE.Vector3} physicsPos - The position in AU.
 * @returns {THREE.Vector3} The position in Scene Units.
 */
export function physicsToRender(physicsPos) {
    const distance = physicsPos.length();

    if (distance < 1e-6) return new THREE.Vector3(0, 0, 0);

    // Render Distance
    const renderDist = Math.log(1 + distance * K_FACTOR) * SCENE_SCALE;

    // Normalize and Scale
    return physicsPos.clone().normalize().multiplyScalar(renderDist);
}

/**
 * Calculates the orbital period in Earth Years given semi-major axis in AU.
 * @param {number} a - Semi-major axis (AU).
 * @returns {number} Period (Years).
 */
export function getOrbitalPeriod(a) {
    return Math.pow(a, 1.5);
}
