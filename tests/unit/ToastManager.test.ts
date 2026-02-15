/**
 * @file ToastManager.test.ts
 * @description Unit tests for the ToastManager singleton.
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToastManager } from '../../src/managers/ToastManager';

describe('ToastManager', () => {
    let toastManager: ToastManager;

    beforeEach(() => {
        document.body.innerHTML = '<div id="toast-container"></div>';
        toastManager = ToastManager.getInstance();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        ToastManager.resetInstance();
    });

    it('should be a singleton', () => {
        const instance1 = ToastManager.getInstance();
        const instance2 = ToastManager.getInstance();
        expect(instance1).toBe(instance2);
    });

    it('should show a toast notification', () => {
        toastManager.show('Test Message', { type: 'success' });

        const toast = document.querySelector('.toast-notification');
        expect(toast).toBeTruthy();
        expect(toast?.classList.contains('toast-success')).toBe(true);
        expect(toast?.querySelector('.toast-message')?.textContent).toBe('Test Message');
    });

    it('should automatically remove toast after duration', () => {
        vi.useFakeTimers();
        toastManager.show('Temporary Toast', { duration: 1000 });

        const container = document.getElementById('toast-container');
        expect(container?.children.length).toBe(1);

        vi.advanceTimersByTime(1500); // Duration + some buffer for dismissal animation
        vi.runAllTimers();

        expect(container?.children.length).toBe(0);
        vi.useRealTimers();
    });
});
