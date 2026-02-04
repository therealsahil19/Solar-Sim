/**
 * @file Modal.ts
 * @description A reusable Modal component that wraps the native <dialog> element.
 *
 * Enforces accessibility standards:
 * - Focus trapping (native to <dialog>)
 * - Backdrop click to close
 * - Escape key to close (native)
 * - ARIA attributes
 * - Animations via CSS
 */

import type { Disposable } from '../types';

/**
 * Modal configuration options.
 */
export interface ModalOptions {
    /** Callback when modal closes */
    onClose?: () => void;
    /** Callback when modal opens */
    onOpen?: () => void;
}

/**
 * A reusable Modal component wrapping native <dialog>.
 */
export class Modal implements Disposable {
    private element: HTMLDialogElement | null;
    private options: ModalOptions;

    // Event handler references for proper cleanup
    private _handleBackdropClick: ((event: MouseEvent) => void) | null = null;
    private _handleClose: (() => void) | null = null;
    private _handleCloseClick: (() => void) | null = null;

    /**
     * Creates a new Modal instance.
     * @param elementOrId - The <dialog> element or its ID.
     * @param options - Configuration options.
     */
    constructor(elementOrId: string | HTMLElement, options: ModalOptions = {}) {
        const el = typeof elementOrId === 'string'
            ? document.getElementById(elementOrId)
            : elementOrId;

        if (!el) {
            console.error(`Modal: Element not found.`);
            this.element = null;
            this.options = options;
            return;
        }

        if (el.tagName !== 'DIALOG') {
            console.error(`Modal: Element must be a <dialog> tag.`);
            this.element = null;
            this.options = options;
            return;
        }

        this.element = el as HTMLDialogElement;
        this.options = options;
        this.bindEvents();
    }

    private bindEvents(): void {
        if (!this.element) return;

        this._handleBackdropClick = (event: MouseEvent): void => {
            if (event.target === this.element) {
                this.close();
            }
        };

        this._handleClose = (): void => {
            if (this.options.onClose) this.options.onClose();
            document.documentElement.classList.remove('modal-open');
        };

        // Close button handler (WCAG 2.1.1 Keyboard)
        const closeBtn = this.element.querySelector('.modal-close-btn');
        if (closeBtn) {
            this._handleCloseClick = (): void => this.close();
            closeBtn.addEventListener('click', this._handleCloseClick);
        }

        this.element.addEventListener('click', this._handleBackdropClick);
        this.element.addEventListener('close', this._handleClose);
    }

    /**
     * Opens the modal.
     * Triggers the `onOpen` callback if provided and manages body classes for scroll locking.
     */
    open(): void {
        if (!this.element) return;

        if (!this.element.open) {
            this.element.showModal();
            if (this.options.onOpen) this.options.onOpen();
            document.documentElement.classList.add('modal-open');
        }
    }

    /**
     * Closes the modal.
     * Uses the native `dialog.close()` method.
     */
    close(): void {
        if (!this.element) return;

        if (this.element.open) {
            this.element.close();
        }
    }

    /**
     * Returns whether the modal is currently open.
     */
    isOpen(): boolean {
        return this.element?.open ?? false;
    }

    /**
     * Destroys the instance and properly removes event listeners.
     */
    dispose(): void {
        if (this.element && this._handleBackdropClick) {
            this.element.removeEventListener('click', this._handleBackdropClick);
        }
        if (this.element && this._handleClose) {
            this.element.removeEventListener('close', this._handleClose);
        }
        // Cleanup close button listener
        const closeBtn = this.element?.querySelector('.modal-close-btn');
        if (closeBtn && this._handleCloseClick) {
            closeBtn.removeEventListener('click', this._handleCloseClick);
        }
    }
}
