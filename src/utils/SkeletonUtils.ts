/**
 * @file SkeletonUtils.ts
 * @description Utilities for creating and injecting skeleton loading states.
 * Uses the ".skeleton" CSS class from style.css for shimmer effects.
 */

/**
 * Injects skeleton elements into a container.
 * @param container The DOM element to append skeletons to.
 * @param count Number of skeleton items to create.
 * @param styles Optional inline styles for the skeleton items (e.g., width, height).
 * @param className Optional extra class names for the skeleton items.
 * @param clear Whether to clear the container before injecting. Defaults to true.
 */
export function injectSkeletons(
    container: HTMLElement,
    count: number = 3,
    styles: Partial<CSSStyleDeclaration> = {},
    className: string = '',
    clear: boolean = true
): void {
    if (!container) return;

    // Clear container logic if needed, but often we just append.
    // Usually skeletons replace content, so we should probably clear first.
    if (clear) {
        container.textContent = '';
    }

    for (let i = 0; i < count; i++) {
        const div = document.createElement('div');
        div.className = `skeleton ${className}`;

        // Apply default styles or overrides
        div.style.width = styles.width || '100%';
        div.style.height = styles.height || '1.2em';
        div.style.marginBottom = styles.marginBottom || '8px';
        div.style.borderRadius = styles.borderRadius || '4px';

        // Apply any other passed styles
        Object.assign(div.style, styles);

        container.appendChild(div);
    }
}

/**
 * Removes all skeleton elements from a container.
 * @param container The DOM element to clear.
 */
export function removeSkeletons(container: HTMLElement): void {
    if (!container) return;
    // We assume the container only held skeletons or we want to clear it entirely for real content.
    // If we only want to remove .skeleton elements:
    const skeletons = container.querySelectorAll('.skeleton');
    skeletons.forEach(el => el.remove());
}
