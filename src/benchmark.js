/**
 * @file benchmark.js
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

/**
 * Starts a frame timing benchmark.
 * @param {number} [durationMs=5000] - Duration of the benchmark in milliseconds.
 */
export function startBenchmark(durationMs = 5000) {
    const frameTimes = [];
    let startTime = performance.now();
    let lastFrame = startTime;
    let frameId = null;

    function measure() {
        const now = performance.now();
        frameTimes.push(now - lastFrame);
        lastFrame = now;

        if (now - startTime < durationMs) {
            frameId = requestAnimationFrame(measure);
        } else {
            // Calculate stats
            const sorted = [...frameTimes].sort((a, b) => a - b);
            const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
            const p50 = sorted[Math.floor(sorted.length * 0.50)];
            const p95 = sorted[Math.floor(sorted.length * 0.95)];
            const p99 = sorted[Math.floor(sorted.length * 0.99)];
            const max = sorted[sorted.length - 1];
            const min = sorted[0];
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

            // Jank detection (frames > 16.67ms for 60fps target)
            const jankFrames = frameTimes.filter(t => t > 16.67).length;
            const jankPercent = ((jankFrames / frameTimes.length) * 100).toFixed(1);
            console.log(`   Jank Frames (>16.67ms): ${jankFrames} (${jankPercent}%)`);

            return {
                frames: frameTimes.length,
                avgFps: 1000 / avg,
                avgFrame: avg,
                p50: p50,
                p95: p95,
                p99: p99,
                max: max,
                min: min,
                stdDev: stdDev,
                jankPercent: parseFloat(jankPercent)
            };
        }
    }

    console.log(`%c⚡ Starting ${durationMs / 1000}s benchmark...`, 'color: #ffc107;');
    frameId = requestAnimationFrame(measure);

    return {
        cancel: () => {
            if (frameId) cancelAnimationFrame(frameId);
            console.log('Benchmark cancelled.');
        }
    };
}

// Auto-expose to window for console access
if (typeof window !== 'undefined') {
    window.boltBenchmark = startBenchmark;
    console.log('%c⚡ Bolt Benchmark loaded. Run boltBenchmark() in console.', 'color: #ffc107;');
}
