import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { updateNormalizedCoordinates } from '../../src/input';

describe('Input Module', () => {
    describe('updateNormalizedCoordinates', () => {
        it('should normalize coordinates to NDC space', () => {
            const width = 1920;
            const height = 1080;
            const target = new THREE.Vector2();

            // Center of screen
            updateNormalizedCoordinates(target, width / 2, height / 2, width, height);
            expect(target.x).toBeCloseTo(0);
            expect(target.y).toBeCloseTo(0);

            // Top-left
            updateNormalizedCoordinates(target, 0, 0, width, height);
            expect(target.x).toBeCloseTo(-1);
            expect(target.y).toBeCloseTo(1);

            // Bottom-right
            updateNormalizedCoordinates(target, width, height, width, height);
            expect(target.x).toBeCloseTo(1);
            expect(target.y).toBeCloseTo(-1);

            // Top-right
            updateNormalizedCoordinates(target, width, 0, width, height);
            expect(target.x).toBeCloseTo(1);
            expect(target.y).toBeCloseTo(1);

            // Bottom-left
            updateNormalizedCoordinates(target, 0, height, width, height);
            expect(target.x).toBeCloseTo(-1);
            expect(target.y).toBeCloseTo(-1);
        });

        it('should handle aspect ratios correctly', () => {
            const width = 1000;
            const height = 500;
            const target = new THREE.Vector2();

            // X at 25% width
            updateNormalizedCoordinates(target, 250, 0, width, height);
            expect(target.x).toBeCloseTo(-0.5);

            // X at 75% width
            updateNormalizedCoordinates(target, 750, 0, width, height);
            expect(target.x).toBeCloseTo(0.5);
        });

        it('should update the target vector in place', () => {
            const width = 100;
            const height = 100;
            const target = new THREE.Vector2(0.5, 0.5); // Initial values

            updateNormalizedCoordinates(target, 0, 0, width, height);

            expect(target.x).toBeCloseTo(-1);
            expect(target.y).toBeCloseTo(1);
        });
    });
});
