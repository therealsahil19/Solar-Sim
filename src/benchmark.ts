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

// Extend Window interface for global benchmark access
declare global {
    interface Window {
        boltBenchmark: typeof startBenchmark;
    }
}

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
            // Calculate stats
            const sorted = [...frameTimes].sort((a, b) => a - b);
            const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;

            const p50Index = Math.floor(sorted.length * 0.50);
            const p95Index = Math.floor(sorted.length * 0.95);
            const p99Index = Math.floor(sorted.length * 0.99);

            const p50 = sorted[p50Index] ?? 0;
            const p95 = sorted[p95Index] ?? 0;
            const p99 = sorted[p99Index] ?? 0;
            const max = sorted[sorted.length - 1] ?? 0;
            const min = sorted[0] ?? 0;

            const stdDev = Math.sqrt(
                frameTimes.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / frameTimes.length
            );

            console.log('%c⚡ Bolt Benchmark Results', 'color: #ffc107; font-weight: bold; font-size: 14px;');
            console.log(`   Duration: ${(durationMs / 1000).toFixed(1)}s`);
            console.log(`   Frames:   ${frameTimes.length}`);
            console.log(`   Avg FPS:  ${(1000 / avg).toFixed(1)}`);
            console.log('   ─────────────────────────');
            console.log(`   Avg Frame:  ${avg.toFixed(2)}ms`);
            console.log(`   P50 Frame:  ${p50.toFixed(2)}ms`);
            console.log(`   P95 Frame:  ${p95.toFixed(2)}ms`);
            console.log(`   P99 Frame:  ${p99.toFixed(2)}ms (GC indicator)`);
            console.log(`   Max Frame:  ${max.toFixed(2)}ms (worst spike)`);
            console.log(`   Min Frame:  ${min.toFixed(2)}ms`);
            console.log(`   Std Dev:    ${stdDev.toFixed(2)}ms`);
            console.log('   ─────────────────────────');

            // Jank detection (frames >16.67ms for 60fps target)
            const jankFrames = frameTimes.filter(t => t > 16.67).length;
            const jankPercent = (jankFrames / frameTimes.length) * 100;
            console.log(`   Jank Frames (>16.67ms): ${jankFrames} (${jankPercent.toFixed(1)}%)`);

            const result: BenchmarkResult = {
                frames: frameTimes.length,
                avgFps: 1000 / avg,
                minFps: 1000 / max,
                maxFps: 1000 / min,
                p99: p99,
                stdDev: stdDev,
                jankPercent: jankPercent
            };

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

// Auto-expose to window for console access
if (typeof window !== 'undefined') {
    window.boltBenchmark = startBenchmark;
    console.log('%c⚡ Bolt Benchmark loaded. Run boltBenchmark() in console.', 'color: #ffc107;');
}
