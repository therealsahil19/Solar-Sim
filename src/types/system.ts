/**
 * @file system.ts
 * @description Type definitions for system.json celestial body data.
 * 
 * These types represent the configuration schema for planets, moons,
 * dwarf planets, and other celestial bodies in the simulation.
 */

/**
 * Orbital parameters using Keplerian elements.
 * Used for calculating accurate orbital positions.
 */
export interface OrbitalParameters {
    /** Semi-major axis in AU (Astronomical Units) */
    a: number;
    /** Eccentricity (0 = circle, 0-1 = ellipse) */
    e: number;
    /** Inclination in degrees relative to ecliptic */
    i: number;
    /** Orbital period in Earth years */
    period?: number; // Optional in system.json (often calculated)
    /** Argument of perihelion in degrees */
    omega?: number;
    /** Argument of perihelion in degrees (legacy alias) */
    w?: number;
    /** Longitude of ascending node (capital Omega) */
    Omega?: number;
    /** Mean anomaly at epoch in degrees */
    M0?: number;
}

/**
 * Ring system configuration (e.g., Saturn's rings).
 */
export interface RingConfig {
    /** Inner radius of the ring system (relative to body radius) */
    inner?: number;
    /** Outer radius of the ring system (relative to body radius) */
    outer?: number;
    /** Ring texture path */
    texture?: string;
    /** Ring color if no texture */
    color?: string | number;
    /** Ring opacity (0-1) */
    opacity?: number;
}

/**
 * Visual appearance configuration for a celestial body.
 */
export interface VisualConfig {
    /** Base color as hex string (e.g., "#ff6600") or hex number */
    color: string | number;
    /** Size/Radius of the body (relative scale) */
    size: number;
    /** Path to texture image file (relative to textures folder) */
    texture?: string;
    /** Ring configuration */
    ring?: RingConfig;
    /** Explicit flag for rings (legacy/alternative to ring object) */
    hasRing?: boolean;
    /** Optional emissive color for glowing bodies (like the Sun) */
    emissive?: string;
    /** Emissive intensity (0-1) */
    emissiveIntensity?: number;
    /** Opacity for belts or transparent bodies */
    opacity?: number;
    /** Whether the particle cloud should be spherical (for Oort cloud) */
    isSpherical?: boolean;
    /** Count of particles (for belts) */
    count?: number;
}

/**
 * Type of celestial body.
 * Note: system.json uses capitalized strings ("Planet", "Moon").
 */
export type CelestialBodyType = string;

/**
 * Complete configuration for a celestial body.
 * This is the schema used in system.json.
 */
export interface CelestialBody {
    /** Unique display name */
    name: string;
    /** Classification of the body (Planet, Moon, etc.) */
    type: CelestialBodyType;
    /** Physics/Orbital parameters */
    physics: OrbitalParameters;
    /** Visual appearance settings */
    visual: VisualConfig;
    /** Description text for info panel */
    description?: string;
    /** Child moons/satellites */
    moons?: CelestialBody[];

    // Belt specific properties
    distribution?: {
        minA: number;
        maxA: number;
        minE: number;
        maxE: number;
        minI: number;
        maxI: number;
    };
}

/**
 * Root structure of system.json.
 */
export interface SystemConfig {
    /** The central star (Sun) */
    sun: CelestialBody;
    /** Array of planets and other bodies orbiting the star */
    planets: CelestialBody[];
    /** Asteroid belt configuration */
    asteroidBelt?: BeltConfig;
    /** Kuiper belt configuration */
    kuiperBelt?: BeltConfig;
    /** Oort cloud configuration */
    oortCloud?: BeltConfig;
}

/**
 * Configuration for debris belts (asteroid belt, Kuiper belt, etc.).
 */
export interface BeltConfig {
    /** Number of particles to render */
    count: number;
    /** Inner boundary in AU */
    innerRadius: number;
    /** Outer boundary in AU */
    outerRadius: number;
    /** Particle color */
    color?: string;
    /** Particle size */
    size?: number;
    /** Belt type identifier */
    type: 'asteroid_belt' | 'kuiper_belt' | 'oort_cloud';
}
