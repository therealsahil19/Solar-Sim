/**
 * @file setup.ts
 * @description Test setup for Vitest - mocks Three.js globals
 */

import { vi } from 'vitest';

// Mock Three.js Vector3 for tests that don't need full Three.js
class MockVector3 {
    x: number;
    y: number;
    z: number;

    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    set(x: number, y: number, z: number): this {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    }

    copy(v: MockVector3): this {
        this.x = v.x;
        this.y = v.y;
        this.z = v.z;
        return this;
    }

    add(v: MockVector3): this {
        this.x += v.x;
        this.y += v.y;
        this.z += v.z;
        return this;
    }

    sub(v: MockVector3): this {
        this.x -= v.x;
        this.y -= v.y;
        this.z -= v.z;
        return this;
    }

    normalize(): this {
        const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
        if (len > 0) {
            this.x /= len;
            this.y /= len;
            this.z /= len;
        }
        return this;
    }

    multiplyScalar(s: number): this {
        this.x *= s;
        this.y *= s;
        this.z *= s;
        return this;
    }

    length(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    lengthSq(): number {
        return this.x * this.x + this.y * this.y + this.z * this.z;
    }

    distanceTo(v: MockVector3): number {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        const dz = this.z - v.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    clone(): MockVector3 {
        return new MockVector3(this.x, this.y, this.z);
    }
}

// Make MockVector3 available globally for tests
(globalThis as any).MockVector3 = MockVector3;

// Mock window for browser APIs
if (typeof window === 'undefined') {
    (globalThis as any).window = {
        innerWidth: 1920,
        innerHeight: 1080,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
    };
}

// Mock document for DOM operations
if (typeof document === 'undefined') {
    (globalThis as any).document = {
        getElementById: vi.fn(() => null),
        createElement: vi.fn(() => ({
            style: {},
            classList: {
                add: vi.fn(),
                remove: vi.fn()
            },
            setAttribute: vi.fn(),
            appendChild: vi.fn()
        })),
        body: {
            appendChild: vi.fn()
        }
    };
}
