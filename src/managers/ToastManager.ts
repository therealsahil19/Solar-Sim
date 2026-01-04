/**
 * @file ToastManager.ts
 * @description Manages toast notifications with a stacked, accessible design.
 */

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastOptions {
    duration?: number; // ms, default 3000
    type?: ToastType;
}

export class ToastManager {
    private container: HTMLElement;
    private static instance: ToastManager;

    private constructor() {
        this.container = document.getElementById('toast-container') as HTMLElement;
        if (!this.container) {
            // Create if missing (fallback)
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.setAttribute('role', 'region'); // Container isn't live, individual toasts are (or use status)
            this.container.setAttribute('aria-label', 'Notifications');
            document.body.appendChild(this.container);
        }
    }

    public static getInstance(): ToastManager {
        if (!ToastManager.instance) {
            ToastManager.instance = new ToastManager();
        }
        return ToastManager.instance;
    }

    /**
     * Shows a toast notification.
     * @param message Text to display
     * @param options Configuration options
     */
    public show(message: string, options: ToastOptions = {}): void {
        const { duration = 3000, type = 'info' } = options;

        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type} glass-panel animate-in-right`;
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');

        // Icon based on type
        const icon = this.getIcon(type);

        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span class="toast-message">${message}</span>
        `;

        // Prepend to stack (so newest is top/bottom depending on CSS)
        // Let's append so they stack downwards or upwards. 
        // We'll trust CSS flex-direction.
        this.container.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            this.dismiss(toast);
        }, duration);
    }

    private dismiss(toast: HTMLElement): void {
        toast.classList.remove('animate-in-right');
        toast.classList.add('animate-out-right');

        // Wait for animation
        setTimeout(() => {
            if (toast.parentNode === this.container) {
                this.container.removeChild(toast);
            }
        }, 400); // Matches --duration-normal roughly
    }

    private getIcon(type: ToastType): string {
        switch (type) {
            case 'success': return '✅';
            case 'warning': return '⚠️';
            case 'error': return '❌';
            default: return 'ℹ️';
        }
    }
}
