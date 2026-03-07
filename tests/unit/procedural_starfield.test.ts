import { expect, test } from 'vitest';
import * as THREE from 'three';
import { createStarfield } from '../../src/procedural';

test('createStarfield returns a valid THREE.Points object', () => {
    const starfield = createStarfield();
    expect(starfield).toBeInstanceOf(THREE.Points);
    expect(starfield.geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(starfield.material).toBeInstanceOf(THREE.PointsMaterial);

    const positions = starfield.geometry.getAttribute('position');
    expect(positions).toBeDefined();
    expect(positions.count).toBe(5000); // the function uses count = 5000
});
