/**
 * @file InfoPanel.ts
 * @description Manages the "Info Panel" UI component that displays details for selected celestial objects.
 *
 * This class handles:
 * 1. **Data Binding**: Updating the DOM with data from `userData` of the selected mesh.
 * 2. **State Management**: Managing visibility (Hidden/Visible) via CSS classes.
 * 3. **Interactivity**: Handling the "Follow" button action.
 * 4. **Accessibility**: Using ARIA attributes to ensure screen readers announce updates.
 */

import * as THREE from 'three';
import type { Disposable, SolarSimUserData } from '../types';

/**
 * DOM element cache for InfoPanel.
 */
interface InfoPanelDOM {
    panel: HTMLElement | null;
    name: HTMLElement | null;
    type: HTMLElement | null;
    desc: HTMLElement | null;
    radius: HTMLElement | null;
    distance: HTMLElement | null;
    distSun: HTMLElement | null;
    btnFollow: HTMLButtonElement | null;
}

/**
 * Callbacks for InfoPanel interactions.
 */
export interface InfoPanelCallbacks {
    /** Callback triggered when "Follow" is clicked */
    onFollow: (mesh: THREE.Object3D) => void;
}

/**
 * Configuration for InfoPanel.
 */
export interface InfoPanelConfig {
    callbacks: InfoPanelCallbacks;
}

/**
 * Manages the Info Panel UI component.
 */
export class InfoPanel implements Disposable {
    private callbacks: InfoPanelCallbacks;
    private currentMesh: THREE.Object3D | null = null;
    private dom: InfoPanelDOM;
    private _handleFollowClick: ((e: MouseEvent) => void) | null = null;

    /**
     * Creates a new InfoPanel instance.
     * @param config - Configuration object with callbacks.
     */
    constructor({ callbacks }: InfoPanelConfig) {
        this.callbacks = callbacks;

        // Cache DOM elements
        this.dom = {
            panel: document.getElementById('info-panel'),
            name: document.getElementById('info-name'),
            type: document.getElementById('info-type'),
            desc: document.getElementById('info-desc'),
            radius: document.getElementById('info-radius'),
            distance: document.getElementById('info-distance'),
            distSun: document.getElementById('info-dist-sun'),
            btnFollow: document.getElementById('btn-follow') as HTMLButtonElement | null,
        };

        if (!this.dom.panel) {
            console.error('InfoPanel: #info-panel not found in DOM.');
        }

        this.bindEvents();
    }

    /**
     * Binds internal event listeners.
     */
    private bindEvents(): void {
        if (this.dom.btnFollow) {
            this._handleFollowClick = (e: MouseEvent): void => {
                e.stopPropagation();
                if (this.currentMesh && this.callbacks.onFollow) {
                    this.callbacks.onFollow(this.currentMesh);
                }
            };
            this.dom.btnFollow.addEventListener('click', this._handleFollowClick);
        }
    }

    /**
     * Cleans up event listeners.
     */
    dispose(): void {
        if (this.dom.btnFollow && this._handleFollowClick) {
            this.dom.btnFollow.removeEventListener('click', this._handleFollowClick);
        }
    }

    /**
     * Updates the panel with new object data and reveals it.
     * @param mesh - The selected object.
     */
    update(mesh: THREE.Object3D): void {
        if (!mesh) return;

        // Bug 039 Fix: Add null check for userData to prevent TypeError
        const d: SolarSimUserData = mesh.userData ?? {};

        this.currentMesh = mesh;

        // Safe text updates
        if (this.dom.name) this.dom.name.textContent = d.name ?? 'Unknown';
        if (this.dom.type) this.dom.type.textContent = d.type ?? 'Unknown Type';
        if (this.dom.desc) this.dom.desc.textContent = d.description ?? 'No description available.';

        // Format numeric values
        if (this.dom.radius) {
            const size = (d as Record<string, unknown>).size as number | undefined;
            this.dom.radius.textContent = size
                ? `Radius: ${size.toFixed(2)} x Earth`
                : 'Radius: -';
        }

        if (this.dom.distance) {
            const distance = (d as Record<string, unknown>).distance as number | undefined;
            this.dom.distance.textContent = distance
                ? `Orbit Radius: ${distance} units`
                : 'Orbit Radius: 0';
        }

        // Show the panel
        if (this.dom.panel) {
            this.dom.panel.classList.add('visible');
            this.dom.panel.classList.remove('animate-out');
            this.dom.panel.classList.add('animate-in');
            this.dom.panel.setAttribute('aria-hidden', 'false');
        }
    }

    /**
     * Hides the info panel.
     * Clears `currentMesh` reference.
     */
    hide(): void {
        if (this.dom.panel?.classList.contains('visible')) {
            this.dom.panel.classList.remove('visible');
            this.dom.panel.classList.remove('animate-in');
            this.dom.panel.classList.add('animate-out');
            this.dom.panel.setAttribute('aria-hidden', 'true');

            setTimeout(() => {
                if (!this.dom.panel?.classList.contains('visible')) {
                    this.dom.panel?.classList.remove('animate-out');
                }
            }, 350);
        }
        this.currentMesh = null;
    }

    /**
     * Gets the currently displayed mesh.
     */
    getCurrentMesh(): THREE.Object3D | null {
        return this.currentMesh;
    }
}
