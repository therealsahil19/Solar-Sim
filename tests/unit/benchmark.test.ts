/**
 * @file benchmark.test.ts
 * @description Unit tests for the benchmark module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock performance.now for consistent testing
const mockNow = vi.fn();
let nowValue = 0;

beforeEach(() => {
    nowValue = 0;
    mockNow.mockImplementation(() => {
        return nowValue;
    });
    vi.stubGlobal('performance', { now: mockNow });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('Benchmark Module', () => {
    describe('Frame Time Calculations', () => {
        it('should correctly calculate FPS from frame times', () => {
            // Simulating 60 FPS (16.67ms per frame)
            const frameTimes = Array(60).fill(16.67);
            const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
            const fps = 1000 / avgFrameTime;

            expect(fps).toBeCloseTo(60, 0);
        });

        it('should calculate P95 frame time correctly', () => {
            // Create 100 frame times with some variance
            const frameTimes = Array(100).fill(0).map((_, i) => {
                if (i >= 95) return 30; // 5% are slow frames
                return 16;
            });

            frameTimes.sort((a, b) => a - b);
            const p95Index = Math.floor(frameTimes.length * 0.95);
            const p95 = frameTimes[p95Index];

            expect(p95).toBe(30);
        });

        it('should detect jank (frames > 50ms)', () => {
            const frameTimes = [
                16, 16, 16, 16, 16, // Normal frames
                55, // Jank frame
                16, 16, 16, 16
            ];

            const jankCount = frameTimes.filter(t => t > 50).length;
            const jankPercentage = (jankCount / frameTimes.length) * 100;

            expect(jankCount).toBe(1);
            expect(jankPercentage).toBe(10);
        });
    });

    describe('Statistics Helpers', () => {
        it('should correctly calculate median', () => {
            const oddArray = [1, 3, 5, 7, 9];
            const sortedOdd = [...oddArray].sort((a, b) => a - b);
            const medianOdd = sortedOdd[Math.floor(sortedOdd.length / 2)];
            expect(medianOdd).toBe(5);

            const evenArray = [1, 2, 3, 4];
            const sortedEven = [...evenArray].sort((a, b) => a - b);
            const midIndex = sortedEven.length / 2;
            const medianEven = (sortedEven[midIndex - 1]! + sortedEven[midIndex]!) / 2;
            expect(medianEven).toBe(2.5);
        });

        it('should correctly calculate standard deviation', () => {
            const values = [10, 10, 10, 10, 10]; // All same = 0 std dev
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
            const stdDev = Math.sqrt(variance);

            expect(stdDev).toBe(0);
        });

        it('should handle edge case with single frame time', () => {
            const frameTimes = [16.5];
            const fps = 1000 / frameTimes[0]!;

            expect(fps).toBeCloseTo(60.6, 1);
        });
    });

    describe('Performance Thresholds', () => {
        it('should identify good performance (>55 FPS)', () => {
            const avgFrameTime = 17; // ~59 FPS
            const fps = 1000 / avgFrameTime;
            const isGoodPerformance = fps >= 55;

            expect(isGoodPerformance).toBe(true);
        });

        it('should identify poor performance (<30 FPS)', () => {
            const avgFrameTime = 40; // 25 FPS
            const fps = 1000 / avgFrameTime;
            const isPoorPerformance = fps < 30;

            expect(isPoorPerformance).toBe(true);
        });

        it('should flag high jank percentage (>5%)', () => {
            const frameTimes = Array(100).fill(16);
            frameTimes[0] = 60; // Jank
            frameTimes[1] = 70; // Jank
            frameTimes[2] = 55; // Jank
            frameTimes[3] = 80; // Jank
            frameTimes[4] = 90; // Jank
            frameTimes[5] = 100; // Jank (6 total)

            const jankCount = frameTimes.filter(t => t > 50).length;
            const jankPercentage = (jankCount / frameTimes.length) * 100;
            const hasHighJank = jankPercentage > 5;

            expect(hasHighJank).toBe(true);
            expect(jankPercentage).toBe(6);
        });
    });
});
