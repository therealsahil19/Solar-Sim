import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { injectSkeletons, removeSkeletons } from '../../src/utils/SkeletonUtils';

describe('SkeletonUtils', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        document.body.removeChild(container);
    });

    it('should inject skeletons into the container', () => {
        injectSkeletons(container, 3);
        const skeletons = container.querySelectorAll('.skeleton');
        expect(skeletons.length).toBe(3);
    });

    it('should clear the container by default', () => {
        container.innerHTML = '<div class="existing-content"></div>';
        injectSkeletons(container, 3);
        const existing = container.querySelector('.existing-content');
        expect(existing).toBeNull();
        const skeletons = container.querySelectorAll('.skeleton');
        expect(skeletons.length).toBe(3);
    });

    it('should not clear the container if clear is false', () => {
        container.innerHTML = '<div class="existing-content"></div>';
        injectSkeletons(container, 3, {}, '', false);
        const existing = container.querySelector('.existing-content');
        expect(existing).not.toBeNull();
        const skeletons = container.querySelectorAll('.skeleton');
        expect(skeletons.length).toBe(3);
    });

    it('should apply styles correctly', () => {
        injectSkeletons(container, 1, { height: '50px' });
        const skeleton = container.querySelector('.skeleton') as HTMLElement;
        expect(skeleton.style.height).toBe('50px');
    });

    it('should add custom class name', () => {
        injectSkeletons(container, 1, {}, 'custom-class');
        const skeleton = container.querySelector('.skeleton');
        expect(skeleton?.classList.contains('custom-class')).toBe(true);
    });

    it('removeSkeletons should remove only skeletons', () => {
        container.innerHTML = '<div class="content">Content</div>';
        injectSkeletons(container, 3, {}, '', false); // Inject without clearing
        expect(container.children.length).toBe(4); // 1 content + 3 skeletons

        removeSkeletons(container);
        expect(container.querySelectorAll('.skeleton').length).toBe(0);
        expect(container.querySelector('.content')).not.toBeNull();
    });

    it('should handle count <= 0 gracefully', () => {
        injectSkeletons(container, 0);
        expect(container.querySelectorAll('.skeleton').length).toBe(0);

        injectSkeletons(container, -1);
        expect(container.querySelectorAll('.skeleton').length).toBe(0);
    });

    it('should safely handle null container', () => {
        expect(() => injectSkeletons(null as any, 3)).not.toThrow();
        expect(() => removeSkeletons(null as any)).not.toThrow();
    });
});

