# Bolt Performance Journal

## Optimization Log

### Label Collision Detection (Spatial Hashing)
- **Problem:** O(N^2) collision detection loop in `src/main.ts` was unscalable and had "ghost collision" bugs.
- **Solution:** Implemented a 2D Spatial Grid (Bucketing) algorithm.
- **Details:**
  - Viewport divided into 100x20 cells.
  - Labels sorted by Z-depth (NDC) to prioritize closer objects.
  - O(N) complexity for uniform distributions.
  - Only visible labels populate the grid, preventing hidden labels from occluding others.
- **Impact:**
  - Synthetic Benchmark (N=2000): 381ms -> 13ms (~29x speedup).
  - Mobile performance improved by eliminating quadratic complexity in the render loop.
