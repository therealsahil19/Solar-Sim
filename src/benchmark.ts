/**
 * @file benchmark.ts
 * @description ⚡ Bolt Performance Benchmark
 *
 * Measures frame timing statistics to validate performance optimizations.
 * Provides P95/P99 metrics to identify GC spikes.
 *
 * Usage:
 *   1. Open browser console on the simulation page
 *   2. Run: boltBenchmark() or boltBenchmark(10000) for 10s test
 *   3. View results in console
 */

import type { BenchmarkResult } from './types';

// Extend Window interface for global benchmark access handled in types/index.ts

/**
 * Result of starting a benchmark.
 */
export interface BenchmarkHandle {
    /** Promise that resolves with benchmark results or null if cancelled */
    promise: Promise<BenchmarkResult | null>;
    /** Cancel the running benchmark */
    cancel: () => void;
}

/**
 * Starts a frame timing benchmark.
 * @param durationMs - Duration of the benchmark in milliseconds.
 * @returns Object with promise for results and cancel function.
 */
export function startBenchmark(durationMs: number = 5000): BenchmarkHandle {
    const frameTimes: number[] = [];
    const startTime = performance.now();
    let lastFrame = startTime;
    let frameId: number | null = null;
    let resolvePromise: ((result: BenchmarkResult | null) => void) | null = null;

    const resultPromise = new Promise<BenchmarkResult | null>((resolve) => {
        resolvePromise = resolve;
    });

    function measure(): void {
        const now = performance.now();
        frameTimes.push(now - lastFrame);
        lastFrame = now;

        if (now - startTime < durationMs) {
            frameId = requestAnimationFrame(measure);
        } else {
            // Prevent division by zero if no frames captured
            if (frameTimes.length === 0) {
                console.warn('%c⚡ Bolt Benchmark: No frames captured.', 'color: #ffc107;');
                if (resolvePromise) resolvePromise(null);
                return;
            }

            // Calculate stats
            const result = calculateBenchmarkStats(frameTimes);
            printBenchmarkStats(result, durationMs);

            // Resolve the promise with results
            if (resolvePromise) resolvePromise(result);
        }
    }

    console.log(`%c⚡ Starting ${durationMs / 1000}s benchmark...`, 'color: #ffc107;');
    frameId = requestAnimationFrame(measure);

    return {
        promise: resultPromise,
        cancel: (): void => {
            if (frameId !== null) cancelAnimationFrame(frameId);
            console.log('Benchmark cancelled.');
            if (resolvePromise) resolvePromise(null);
        }
    };
}

// Expose to window for tests/console immediately
if (typeof window !== 'undefined') {
    window.boltBenchmark = startBenchmark;
}

// Consumers can import startBenchmark directly if needed

export function calculateBenchmarkStats(frameTimes: number[]): BenchmarkResult & { p50: number, p95: number, max: number, min: number, avg: number } {
    const sorted = [...frameTimes].sort((a, b) => a - b);
    const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;

    const p50 = sorted[Math.floor(sorted.length * 0.50)] ?? 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0;
    const max = sorted[sorted.length - 1] ?? 0;
    const min = sorted[0] ?? 0;

    const stdDev = Math.sqrt(
        frameTimes.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / frameTimes.length
    );

    const jankFrames = frameTimes.filter(t => t > 16.67).length;
    const jankPercent = frameTimes.length > 0 ? (jankFrames / frameTimes.length) * 100 : 0;

    return {
        frames: frameTimes.length,
        avgFps: 1000 / avg,
        minFps: 1000 / max,
        maxFps: 1000 / min,
        p99: p99,
        stdDev: stdDev,
        jankPercent: jankPercent,
        p50,
        p95,
        max,
        min,
        avg
    };
}

export function printBenchmarkStats(stats: BenchmarkResult & { p50: number, p95: number, max: number, min: number, avg: number }, durationMs: number): void {
    console.log('%c⚡ Bolt Benchmark Results', 'color: #ffc107; font-weight: bold; font-size: 14px;');
    console.log(`   Duration: ${(durationMs / 1000).toFixed(1)}s`);
    console.log(`   Frames:   ${stats.frames}`);
    console.log(`   Avg FPS:  ${stats.avgFps.toFixed(1)}`);
    console.log('   ─────────────────────────');
    console.log(`   Avg Frame:  ${stats.avg.toFixed(2)}ms`);
    console.log(`   P50 Frame:  ${stats.p50.toFixed(2)}ms`);
    console.log(`   P95 Frame:  ${stats.p95.toFixed(2)}ms`);
    console.log(`   P99 Frame:  ${stats.p99.toFixed(2)}ms (GC indicator)`);
    console.log(`   Max Frame:  ${stats.max.toFixed(2)}ms (worst spike)`);
    console.log(`   Min Frame:  ${stats.min.toFixed(2)}ms`);
    console.log(`   Std Dev:    ${stats.stdDev.toFixed(2)}ms`);
    console.log('   ─────────────────────────');

    const jankFrames = (stats.jankPercent / 100) * stats.frames;
    console.log(`   Jank Frames (>16.67ms): ${Math.round(jankFrames)} (${stats.jankPercent.toFixed(1)}%)`);
}
