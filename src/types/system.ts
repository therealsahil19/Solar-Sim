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
    period: number;
    /** Longitude of ascending node in degrees */
    omega?: number;
    /** Argument of perihelion in degrees */
    w?: number;
    /** Mean anomaly at epoch in degrees */
    M0?: number;
}

/**
 * Visual appearance configuration for a celestial body.
 */
export interface VisualConfig {
    /** Base color as hex string (e.g., "#ff6600") or CSS color name */
    color: string;
    /** Path to texture image file (relative to textures folder) */
    texture?: string;
    /** Optional emissive color for glowing bodies (like the Sun) */
    emissive?: string;
    /** Emissive intensity (0-1) */
    emissiveIntensity?: number;
}

/**
 * Ring system configuration (e.g., Saturn's rings).
 */
export interface RingConfig {
    /** Inner radius of the ring system (relative to body radius) */
    innerRadius: number;
    /** Outer radius of the ring system (relative to body radius) */
    outerRadius: number;
    /** Ring texture path */
    texture?: string;
    /** Ring color if no texture */
    color?: string;
    /** Ring opacity (0-1) */
    opacity?: number;
}

/**
 * Type of celestial body.
 */
export type CelestialBodyType =
    | 'star'
    | 'planet'
    | 'dwarf_planet'
    | 'moon'
    | 'asteroid'
    | 'comet';

/**
 * Complete configuration for a celestial body.
 * This is the schema used in system.json.
 */
export interface CelestialBody {
    /** Unique display name */
    name: string;
    /** Classification of the body */
    type: CelestialBodyType;
    /** Radius in km (for display purposes) */
    radius: number;
    /** Visual appearance settings */
    visual: VisualConfig;
    /** Orbital parameters (optional for the Sun) */
    orbit?: OrbitalParameters;
    /** Child moons/satellites */
    moons?: CelestialBody[];
    /** Ring system configuration */
    rings?: RingConfig;
    /** Description text for info panel */
    description?: string;
    /** Rotation period in Earth days */
    rotationPeriod?: number;
    /** Axial tilt in degrees */
    axialTilt?: number;
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
