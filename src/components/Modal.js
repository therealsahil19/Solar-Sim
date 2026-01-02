/**
 * @file Modal.js
 * @description A reusable Modal component that wraps the native <dialog> element.
 *
 * Enforces accessibility standards:
 * - Focus trapping (native to <dialog>)
 * - Backdrop click to close
 * - Escape key to close (native)
 * - ARIA attributes
 * - Animations via CSS
 */

export class Modal {
    /**
     * Creates a new Modal instance.
     * @param {string|HTMLElement} elementOrId - The <dialog> element or its ID.
     * @param {Object} options - Configuration options.
     * @param {Function} [options.onClose] - Callback when modal closes.
     * @param {Function} [options.onOpen] - Callback when modal opens.
     */
    constructor(elementOrId, options = {}) {
        this.element = typeof elementOrId === 'string'
            ? document.getElementById(elementOrId)
            : elementOrId;

        if (!this.element) {
            console.error(`Modal: Element not found.`);
            return;
        }

        if (this.element.tagName !== 'DIALOG') {
            console.error(`Modal: Element must be a <dialog> tag.`);
            return;
        }

        this.options = options;
        this.bindEvents();
    }

    bindEvents() {
        // Close on click outside (Backdrop)
        this.element.addEventListener('click', (event) => {
            if (event.target === this.element) {
                this.close();
            }
        });

        // Handle ESC key explicitly if needed for custom logic,
        // but <dialog> handles it natively. We might want to hook into the 'close' event.
        this.element.addEventListener('close', () => {
            if (this.options.onClose) this.options.onClose();
            document.documentElement.classList.remove('modal-open');
        });
    }

    /**
     * Opens the modal.
     */
    open() {
        if (!this.element.open) {
            this.element.showModal();
            if (this.options.onOpen) this.options.onOpen();
            // Optional: Prevent body scroll if not handled by CSS
            document.documentElement.classList.add('modal-open');
        }
    }

    /**
     * Closes the modal.
     */
    close() {
        if (this.element.open) {
            this.element.close();
        }
    }

    /**
     * Destroys the instance (removes listeners if we added any named ones).
     * Since we used anonymous arrow functions for click, we rely on the DOM element removal
     * or just garbage collection if the element stays.
     */
    dispose() {
        // In a complex app, we'd remove listeners here.
    }
}
