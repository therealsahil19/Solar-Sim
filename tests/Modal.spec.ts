import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Modal } from '../src/components/Modal';

describe('Modal', () => {
    let dialog: HTMLDialogElement;
    let modal: Modal;

    beforeEach(() => {
        dialog = document.createElement('dialog');
        dialog.id = 'test-modal';
        document.body.appendChild(dialog);
    });

    afterEach(() => {
        if (modal) modal.dispose();
        if (document.body.contains(dialog)) document.body.removeChild(dialog);
        vi.restoreAllMocks();
    });

    it('should initialize with an element', () => {
        modal = new Modal(dialog);
        expect(modal).toBeDefined();
    });

    it('should open and add class to body', () => {
        modal = new Modal(dialog);
        // Mock showModal as jsdom doesn't implement it fully
        dialog.showModal = vi.fn(() => { dialog.open = true; });

        modal.open();
        expect(dialog.showModal).toHaveBeenCalled();
        expect(document.documentElement.classList.contains('modal-open')).toBe(true);
    });

    it('should close and remove class from body', () => {
        modal = new Modal(dialog);
        dialog.showModal = vi.fn(() => { dialog.open = true; });
        dialog.close = vi.fn(() => { dialog.open = false; });

        modal.open();
        modal.close();

        expect(dialog.close).toHaveBeenCalled();
        // The class removal happens in 'close' event handler which we need to trigger
        dialog.dispatchEvent(new Event('close'));
        expect(document.documentElement.classList.contains('modal-open')).toBe(false);
    });

    it('should trigger onOpen and onClose callbacks', () => {
        const onOpen = vi.fn();
        const onClose = vi.fn();
        modal = new Modal(dialog, { onOpen, onClose });

        dialog.showModal = vi.fn(() => { dialog.open = true; });
        dialog.close = vi.fn(() => { dialog.open = false; });

        modal.open();
        expect(onOpen).toHaveBeenCalled();

        modal.close();
        dialog.dispatchEvent(new Event('close'));
        expect(onClose).toHaveBeenCalled();
    });
});
