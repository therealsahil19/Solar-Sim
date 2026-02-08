
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startBenchmark } from '../../src/benchmark';

describe('startBenchmark Zero Check', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        // Mock requestAnimationFrame
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            return setTimeout(() => callback(performance.now()), 16);
        });
        vi.stubGlobal('cancelAnimationFrame', (id: number) => {
            clearTimeout(id);
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('should not produce NaN values for short duration benchmarks', async () => {
        const handle = startBenchmark(0);

        // Fast-forward time to trigger the callback
        vi.runAllTimers();

        const result = await handle.promise;

        expect(result).not.toBeNull();
        if (result) {
            expect(result.frames).toBeGreaterThan(0);
            expect(result.jankPercent).not.toBeNaN();
            expect(result.avgFps).not.toBeNaN();
        }
    });
});
