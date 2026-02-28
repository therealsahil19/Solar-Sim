/**
 * @file physics.test.ts
 * @description Unit tests for the physics module - orbital mechanics and scaling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { getOrbitalPosition, physicsToRender, renderToPhysicsEstimate, SCALE_CONFIG, AU_SCALE } from '../../src/physics';

describe('Physics Module', () => {
    describe('getOrbitalPosition', () => {
        it('should return origin for circular orbit at t=0 with M0=0', () => {
            const orbit = {
                a: 1.0,      // 1 AU (like Earth)
                e: 0.0,      // Circular orbit
                i: 0,        // No inclination
                period: 1.0,
                M0: 0        // Start at perihelion
            };

            const pos = getOrbitalPosition(orbit, 0);

            // At t=0 with M0=0 and e=0, object should be at (a, 0, 0) in physics space
            expect(pos.x).toBeCloseTo(1.0, 3);
            expect(pos.y).toBeCloseTo(0, 3);
            expect(pos.z).toBeCloseTo(0, 3);
        });

        it('should return correct position for circular orbit at quarter period', () => {
            const orbit = {
                a: 1.0,
                e: 0.0,
                i: 0,
                period: 1.0,
                M0: 0
            };

            // At quarter period, object should be 90 degrees from start
            const pos = getOrbitalPosition(orbit, 0.25);

            // For circular orbit, should be approximately along Z axis
            expect(pos.x).toBeCloseTo(0, 2);
            expect(pos.z).toBeCloseTo(1.0, 2);
        });

        it('should handle elliptical orbits with non-zero eccentricity', () => {
            const orbit = {
                a: 1.5,
                e: 0.5,      // Highly elliptical
                i: 0,
                period: 1.84, // a^1.5
                M0: 0
            };

            const pos = getOrbitalPosition(orbit, 0);

            // At perihelion, distance should be a(1-e) = 1.5 * 0.5 = 0.75
            const distance = pos.length();
            expect(distance).toBeCloseTo(0.75, 2);
        });

        it('should handle inclined orbits', () => {
            const orbit = {
                a: 1.0,
                e: 0.0,
                i: 90,       // 90 degree inclination
                period: 1.0,
                M0: 0
            };

            const pos = getOrbitalPosition(orbit, 0.25);

            // With 90 degree inclination, motion should be in Y plane
            expect(Math.abs(pos.y)).toBeGreaterThan(0.5);
        });

        it('should reuse output vector when provided', () => {
            const orbit = {
                a: 1.0,
                e: 0.0,
                i: 0,
                period: 1.0,
                M0: 0
            };

            const out = new THREE.Vector3();
            const result = getOrbitalPosition(orbit, 0, out);

            expect(result).toBe(out);
            expect(out.x).toBeCloseTo(1.0, 3);
        });

        it('should maintain consistent distance at different times for circular orbit', () => {
            const orbit = {
                a: 2.0,
                e: 0.0,
                i: 5,
                period: 2.83, // 2^1.5
                M0: 45
            };

            const distances: number[] = [];
            for (let t = 0; t < 3; t += 0.5) {
                const pos = getOrbitalPosition(orbit, t);
                distances.push(pos.length());
            }

            // All distances should be approximately equal to semi-major axis
            distances.forEach(d => {
                expect(d).toBeCloseTo(2.0, 2);
            });
        });

        it('should use omega if provided (precedence check)', () => {
            const orbit = {
                a: 1.0,
                e: 0.0,
                i: 0,
                omega: 45,
                w: 90, // Should be ignored
                M0: 0,
                period: 1.0
            };

            const pos = getOrbitalPosition(orbit, 0);

            const expectedX = Math.cos(45 * Math.PI / 180);
            const expectedZ = Math.sin(45 * Math.PI / 180);

            expect(pos.x).toBeCloseTo(expectedX, 5);
            expect(pos.z).toBeCloseTo(expectedZ, 5);
            expect(pos.y).toBeCloseTo(0, 5);
        });

        it('should fallback to w if omega is not provided', () => {
            const orbit = {
                a: 1.0,
                e: 0.0,
                i: 0,
                w: 90, // Should be used
                M0: 0,
                period: 1.0
            };

            const pos = getOrbitalPosition(orbit, 0);

            const expectedX = Math.cos(90 * Math.PI / 180);
            const expectedZ = Math.sin(90 * Math.PI / 180);

            expect(pos.x).toBeCloseTo(expectedX, 5);
            expect(pos.z).toBeCloseTo(expectedZ, 5);
        });

        it('should maintain Kepler equation accuracy for highly eccentric orbits (e > 0.9)', () => {
            const orbit = {
                a: 1.0,
                e: 0.95, // Highly eccentric
                i: 0,
                period: 1.0,
                M0: 0
            };

            // Test around perihelion and aphelion, plus some intermediate points
            const times = [0, 0.25, 0.5, 0.75, 1.0];

            times.forEach(t => {
                const pos = getOrbitalPosition(orbit, t);
                const r = pos.length();

                // For e=0.95, a=1.0:
                // At perihelion (t=0, 1), r = a(1-e) = 0.05
                // At aphelion (t=0.5), r = a(1+e) = 1.95
                if (t === 0 || t === 1.0) {
                    expect(r).toBeCloseTo(0.05, 2);
                } else if (t === 0.5) {
                    expect(r).toBeCloseTo(1.95, 2);
                }

                // Position should be finite and valid
                expect(isFinite(pos.x)).toBe(true);
                expect(isFinite(pos.y)).toBe(true);
                expect(isFinite(pos.z)).toBe(true);
            });
        });
    });

    describe('physicsToRender', () => {
        it('should scale linearly within inner zone (0-30 AU)', () => {
            const innerPos = new THREE.Vector3(10, 0, 0); // 10 AU
            const result = physicsToRender(innerPos);

            // Linear scaling: distance * AU_SCALE
            const expected = 10 * AU_SCALE;
            expect(result.length()).toBeCloseTo(expected, 1);
        });

        it('should return origin for zero vector', () => {
            const origin = new THREE.Vector3(0, 0, 0);
            const result = physicsToRender(origin);

            expect(result.x).toBe(0);
            expect(result.y).toBe(0);
            expect(result.z).toBe(0);
        });

        it('should apply logarithmic compression in Kuiper zone (30-50 AU)', () => {
            const kuiperPos = new THREE.Vector3(40, 0, 0); // 40 AU

            const result = physicsToRender(kuiperPos);
            const linearResult = 40 * AU_SCALE; // If it were linear

            // Logarithmic should compress, so result should be less than linear
            expect(result.length()).toBeLessThan(linearResult);
        });

        it('should apply aggressive compression in Oort zone (>50 AU)', () => {
            const oortPos = new THREE.Vector3(1000, 0, 0); // 1000 AU

            const result = physicsToRender(oortPos);
            const linearResult = 1000 * AU_SCALE;

            // Should be significantly compressed
            expect(result.length()).toBeLessThan(linearResult * 0.1);
            expect(result.length()).toBeGreaterThan(0);
        });

        it('should preserve direction when scaling', () => {
            const diagonalPos = new THREE.Vector3(10, 10, 10);
            const result = physicsToRender(diagonalPos);

            // Direction should be preserved (normalized vectors should be equal)
            const inputDir = diagonalPos.clone().normalize();
            const outputDir = result.clone().normalize();

            expect(outputDir.x).toBeCloseTo(inputDir.x, 5);
            expect(outputDir.y).toBeCloseTo(inputDir.y, 5);
            expect(outputDir.z).toBeCloseTo(inputDir.z, 5);
        });

        it('should reuse output vector when provided', () => {
            const pos = new THREE.Vector3(5, 0, 0);
            const out = new THREE.Vector3();
            const result = physicsToRender(pos, out);

            expect(result).toBe(out);
        });

        it('should maintain C0 continuity at zone boundaries', () => {
            // Test continuity at Zone 1 -> Zone 2 boundary (30 AU)
            const justBefore = new THREE.Vector3(29.99, 0, 0);
            const justAfter = new THREE.Vector3(30.01, 0, 0);

            const r1 = physicsToRender(justBefore).length();
            const r2 = physicsToRender(justAfter).length();

            // Should be continuous (very close values)
            expect(Math.abs(r2 - r1)).toBeLessThan(1);
        });
    });

    describe('renderToPhysicsEstimate', () => {
        it('should return 0 AU for 0 visual distance', () => {
            expect(renderToPhysicsEstimate(0)).toBe(0);
        });

        it('should inverse linear scaling in Zone 1 (Linear)', () => {
            const visualDistance = 400; // 10 AU * 40
            const physical = renderToPhysicsEstimate(visualDistance);

            expect(physical).toBeCloseTo(10, 5);
        });

        it('should handle edge cases at zone boundaries', () => {
            const limit1Visual = 30 * AU_SCALE; // Exactly at boundary (LIMIT_1)
            const physical1 = renderToPhysicsEstimate(limit1Visual);
            expect(physical1).toBeCloseTo(30, 5);

            // Test boundary LIMIT_2 (50 AU)
            const pos2 = new THREE.Vector3(50, 0, 0);
            const limit2Visual = physicsToRender(pos2).length();
            const physical2 = renderToPhysicsEstimate(limit2Visual);
            expect(physical2).toBeCloseTo(50, 5);
        });

        it('should be continuous at exactly calculated visual boundaries', () => {
            // Re-calculate the internal VISUAL_LIMIT_1 and VISUAL_LIMIT_2
            const vLimit1 = SCALE_CONFIG.LIMIT_LINEAR * SCALE_CONFIG.AU_SCALE;
            const vOffsetK = Math.log(1 + (SCALE_CONFIG.LIMIT_KUIPER - SCALE_CONFIG.LIMIT_LINEAR)) *
                SCALE_CONFIG.AU_SCALE * SCALE_CONFIG.LOG_FACTOR_KUIPER;
            const vLimit2 = vLimit1 + vOffsetK;

            // Check precisely at boundaries
            expect(renderToPhysicsEstimate(vLimit1)).toBeCloseTo(SCALE_CONFIG.LIMIT_LINEAR, 10);
            expect(renderToPhysicsEstimate(vLimit2)).toBeCloseTo(SCALE_CONFIG.LIMIT_KUIPER, 10);
        });

        it('should inverse logarithmic scaling in Zone 2 (Mild Log)', () => {
            // Pick a value in Zone 2: 40 AU (between 30 and 50)
            const physicalPos = new THREE.Vector3(40, 0, 0);
            const visualDistance = physicsToRender(physicalPos).length();
            const estimated = renderToPhysicsEstimate(visualDistance);

            expect(estimated).toBeCloseTo(40, 5);
        });

        it('should inverse aggressive logarithmic scaling in Zone 3 (Aggressive Log)', () => {
            // Pick values in Zone 3: > 50 AU
            // Testing up to 1,000,000 AU (far beyond Oort Cloud)
            const testDistances = [100, 1000, 10000, 100000, 1000000];

            testDistances.forEach(d => {
                const physicalPos = new THREE.Vector3(d, 0, 0);
                const visualDistance = physicsToRender(physicalPos).length();
                const estimated = renderToPhysicsEstimate(visualDistance);

                // High precision inverse check
                expect(estimated).toBeCloseTo(d, 5);
            });
        });

        it('should be exactly inverse of physicsToRender across all zones (Round-trip)', () => {
            // Covering all zones: 0.1, 15 (Z1), 30 (Boundary), 40 (Z2), 50 (Boundary), 100, 1000, 100000 (Z3)
            const testDistances = [0.1, 15, 30, 40, 50, 100, 1000, 100000];

            testDistances.forEach(d => {
                const pos = new THREE.Vector3(d, 0, 0);
                const rendered = physicsToRender(pos);
                const estimated = renderToPhysicsEstimate(rendered.length());

                expect(estimated).toBeCloseTo(d, 5);
            });
        });

        it('should maintain monotonicity (higher visual distance => higher physical distance)', () => {
            // Test a dense range of values across all zones
            let lastPhysical = -Infinity;
            for (let v = 0; v <= 5000; v += 10) {
                const physical = renderToPhysicsEstimate(v);
                expect(physical).toBeGreaterThan(lastPhysical);
                lastPhysical = physical;
            }
        });

        it('should handle values slightly above and below zone boundaries correctly', () => {
            // Boundaries are around 1200 (VISUAL_LIMIT_1) and ~1382.67 (VISUAL_LIMIT_2)
            const boundaries = [1200, 1382.67389]; // Approximate VISUAL_LIMIT_2

            boundaries.forEach(b => {
                const justBelow = renderToPhysicsEstimate(b - 0.0001);
                const exactly = renderToPhysicsEstimate(b);
                const justAbove = renderToPhysicsEstimate(b + 0.0001);

                expect(justBelow).toBeLessThan(exactly);
                expect(justAbove).toBeGreaterThan(exactly);

                // Should be very close to each other (continuity)
                expect(justAbove - justBelow).toBeLessThan(0.01);
            });
        });

        it('should correctly inverse intermediate points in Zone 2 (Mild Log)', () => {
            // Test 35 AU and 45 AU (both in Zone 2: 30-50 AU)
            [35, 45].forEach(d => {
                const pos = new THREE.Vector3(d, 0, 0);
                const visual = physicsToRender(pos).length();
                const estimated = renderToPhysicsEstimate(visual);
                expect(estimated).toBeCloseTo(d, 5);
            });
        });

        it('should handle extreme and special values gracefully', () => {
            // Infinity
            expect(renderToPhysicsEstimate(Infinity)).toBe(Infinity);
            // NaN
            expect(renderToPhysicsEstimate(NaN)).toBeNaN();
            // Negative values (should behave linearly as per Zone 1 logic)
            expect(renderToPhysicsEstimate(-AU_SCALE)).toBeCloseTo(-1, 5);
        });

        it('should maintain accurate round-trip mapping for random points across all zones', () => {
            // Test 100 random points from 0.001 to 1,000,000 AU
            for (let i = 0; i < 100; i++) {
                // Generate random distance using log scale for better distribution across zones
                const logMin = Math.log10(0.001);
                const logMax = Math.log10(1000000);
                const randomLogDist = logMin + Math.random() * (logMax - logMin);
                const d = Math.pow(10, randomLogDist);

                // Create a random unit vector and scale it
                const pos = new THREE.Vector3(
                    Math.random() - 0.5,
                    Math.random() - 0.5,
                    Math.random() - 0.5
                ).normalize().multiplyScalar(d);

                const visualDistance = physicsToRender(pos).length();
                const estimated = renderToPhysicsEstimate(visualDistance);

                // Check accuracy. Use relative error for very large distances
                if (d > 1) {
                    const relativeError = Math.abs(estimated - d) / d;
                    expect(relativeError).toBeLessThan(1e-10);
                } else {
                    expect(estimated).toBeCloseTo(d, 10);
                }
            }
        });
    });

    describe('SCALE_CONFIG', () => {
        it('should have valid configuration values', () => {
            expect(SCALE_CONFIG.AU_SCALE).toBe(40.0);
            expect(SCALE_CONFIG.LIMIT_LINEAR).toBe(30.0);
            expect(SCALE_CONFIG.LIMIT_KUIPER).toBe(50.0);
            expect(SCALE_CONFIG.LOG_FACTOR_KUIPER).toBe(1.5);
            expect(SCALE_CONFIG.LOG_FACTOR_OORT).toBe(4.0);
        });
    });
});
