// @ts-expect-error - Vite handles ?raw imports
import TRAIL_VERTEX_SHADER from './shaders/trail.vert.glsl?raw';
// @ts-expect-error - Vite handles ?raw imports
import TRAIL_FRAGMENT_SHADER from './shaders/trail.frag.glsl?raw';

export { TRAIL_VERTEX_SHADER, TRAIL_FRAGMENT_SHADER };
