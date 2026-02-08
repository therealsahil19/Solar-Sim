import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startBenchmark } from '../../src/benchmark';

describe('startBenchmark Integration', () => {
    let currentTime = 0;

    beforeEach(() => {
        currentTime = 0;
        vi.useFakeTimers();

        // Mock performance.now() to return our controlled time
        vi.stubGlobal('performance', {
            now: () => currentTime
        });

        // Mock requestAnimationFrame to advance time by ~16.67ms (60 FPS) and callback
        // We use setTimeout to allow vi.advanceTimersByTime to control execution
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            return setTimeout(() => {
                currentTime += 16.666;
                callback(currentTime);
            }, 16) as unknown as number;
        });

        vi.stubGlobal('cancelAnimationFrame', (id: number) => {
            clearTimeout(id);
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('should run benchmark for specified duration and return valid results', async () => {
        const duration = 100;
        const handle = startBenchmark(duration);

        // Advance time past the duration
        // 100ms duration at ~16ms per frame -> ~6 frames
        // setTimeout delay is 16ms, so we need to advance at least 100ms
        await vi.advanceTimersByTimeAsync(200);

        const result = await handle.promise;

        expect(result).not.toBeNull();
        if (result) {
            expect(result.frames).toBeGreaterThan(0);
            // 100ms / 16.666ms ≈ 6 frames. Allow some margin.
            expect(result.frames).toBeGreaterThanOrEqual(5);
            expect(result.frames).toBeLessThanOrEqual(8);

            // 1000 / 16.666 ≈ 60 FPS
            expect(result.avgFps).toBeCloseTo(60, 0);
            expect(result.jankPercent).toBe(0);
        }
    });

    it('should handle cancellation correctly', async () => {
        const handle = startBenchmark(5000);

        // Let it run for a bit (simulate a few frames)
        await vi.advanceTimersByTimeAsync(50);

        handle.cancel();

        // Advance more time to ensure no more frames are processed
        // If it wasn't cancelled, this would add more frames and eventually resolve with result
        await vi.advanceTimersByTimeAsync(100);

        const result = await handle.promise;

        // startBenchmark returns null when cancelled
        expect(result).toBeNull();
    });

    it('should handle zero duration by collecting at least one frame', async () => {
        const handle = startBenchmark(0);

        // Even with 0 duration, it usually runs at least one frame because check is at end of measure loop?
        // Actually, logic is: measure() -> push -> if (now - start < duration) recurse else finish.
        // So it runs once immediately? No, measure is called by requestAnimationFrame initially?
        // Code: frameId = requestAnimationFrame(measure);
        // So it runs at least once after first RAF.

        await vi.advanceTimersByTimeAsync(50);

        const result = await handle.promise;
        expect(result).not.toBeNull();
        if (result) {
            expect(result.frames).toBeGreaterThanOrEqual(1);
        }
    });
});
