export const TRAIL_VERTEX_SHADER = `
uniform sampler2D uHistory;
uniform float uHead; // Current global head index
uniform float uPointsPerTrail;
uniform float uMaxTrails;

attribute float aSegmentIndex;
attribute float aVertexIndex; // 0 = start of segment, 1 = end of segment
attribute float aTrailIndex;
attribute vec3 aColor;

varying vec3 vColor;
varying float vAlpha;

void main() {
    float head = floor(uHead);
    float segIdx = aSegmentIndex;

    // 1. Collapse the "Gap" segment (Head -> Head+1 in ring buffer logic)
    // The segment starting at 'head' connects the newest point to the oldest point.
    // We want to hide it.
    if (abs(segIdx - head) < 0.1) {
        gl_Position = vec4(0.0, 0.0, 0.0, 0.0);
        return;
    }

    // 2. Determine which history point we need
    // If VertexIndex=0, we want point at segIdx.
    // If VertexIndex=1, we want point at (segIdx + 1) % Points.
    float historyIdx = segIdx;
    if (aVertexIndex > 0.5) {
        historyIdx = mod(segIdx + 1.0, uPointsPerTrail);
    }

    // 3. Texture Lookup (Transposed Layout)
    // X = Trail Index, Y = History Index
    vec2 uv = vec2(
        (aTrailIndex + 0.5) / uMaxTrails,
        (historyIdx + 0.5) / uPointsPerTrail
    );

    vec3 pos = texture2D(uHistory, uv).xyz;

    // 4. Calculate Fade/Alpha
    // Distance in segments from the head (backwards)
    float age = mod(head - segIdx + uPointsPerTrail, uPointsPerTrail);
    float alpha = 1.0 - (age / uPointsPerTrail);

    // Enhance fade curve (pow 2)
    alpha = alpha * alpha;

    vColor = aColor;
    vAlpha = alpha;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
}
`;

export const TRAIL_FRAGMENT_SHADER = `
varying vec3 vColor;
varying float vAlpha;

void main() {
    gl_FragColor = vec4(vColor, vAlpha);
}
`;
