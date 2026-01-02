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
        // Bug 038 Fix: Store named references to handlers for proper cleanup
        this._handleBackdropClick = (event) => {
            if (event.target === this.element) {
                this.close();
            }
        };

        this._handleClose = () => {
            if (this.options.onClose) this.options.onClose();
            document.documentElement.classList.remove('modal-open');
        };

        this.element.addEventListener('click', this._handleBackdropClick);
        this.element.addEventListener('close', this._handleClose);
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
     * Destroys the instance and properly removes event listeners.
     * Bug 038 Fix: Now actually cleans up listeners.
     */
    dispose() {
        if (this.element && this._handleBackdropClick) {
            this.element.removeEventListener('click', this._handleBackdropClick);
        }
        if (this.element && this._handleClose) {
            this.element.removeEventListener('close', this._handleClose);
        }
    }
}
