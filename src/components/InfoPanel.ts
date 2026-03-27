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
    panel: HTMLElement;
    name: HTMLElement;
    type: HTMLElement;
    desc: HTMLElement;
    radius: HTMLElement;
    distance: HTMLElement;
    distSun: HTMLElement;
    btnFollow: HTMLButtonElement;
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
        const panel = document.getElementById('info-panel');
        const name = document.getElementById('info-name');
        const type = document.getElementById('info-type');
        const desc = document.getElementById('info-desc');
        const radius = document.getElementById('info-radius');
        const distance = document.getElementById('info-distance');
        const distSun = document.getElementById('info-dist-sun');
        const btnFollow = document.getElementById('btn-follow') as HTMLButtonElement | null;

        if (!panel) throw new Error('InfoPanel: #info-panel not found in DOM.');
        if (!name) throw new Error('InfoPanel: #info-name not found in DOM.');
        if (!type) throw new Error('InfoPanel: #info-type not found in DOM.');
        if (!desc) throw new Error('InfoPanel: #info-desc not found in DOM.');
        if (!radius) throw new Error('InfoPanel: #info-radius not found in DOM.');
        if (!distance) throw new Error('InfoPanel: #info-distance not found in DOM.');
        if (!distSun) throw new Error('InfoPanel: #info-dist-sun not found in DOM.');
        if (!btnFollow) throw new Error('InfoPanel: #btn-follow not found in DOM.');

        this.dom = {
            panel,
            name,
            type,
            desc,
            radius,
            distance,
            distSun,
            btnFollow
        };

        this.bindEvents();
    }

    /**
     * Binds internal event listeners.
     */
    private bindEvents(): void {
        this._handleFollowClick = (e: MouseEvent): void => {
            e.stopPropagation();
            if (this.currentMesh && this.callbacks.onFollow) {
                this.callbacks.onFollow(this.currentMesh);
            }
        };
        this.dom.btnFollow.addEventListener('click', this._handleFollowClick);
    }

    /**
     * Cleans up event listeners.
     */
    dispose(): void {
        if (this._handleFollowClick) {
            this.dom.btnFollow.removeEventListener('click', this._handleFollowClick);
        }
    }

    /**
     * Updates the panel with new object data and reveals it.
     * @param mesh - The selected object.
     */
    update(mesh: THREE.Object3D): void {
        if (!mesh) return;

        const d: SolarSimUserData = mesh.userData ?? {};

        this.currentMesh = mesh;

        // Text updates
        this.dom.name.textContent = d.name ?? 'Unknown';
        this.dom.type.textContent = d.type ?? 'Unknown Type';
        this.dom.desc.textContent = d.description ?? 'No description available.';

        // Format numeric values
        const size = d.size;
        this.dom.radius.textContent = size
            ? `Radius: ${size.toFixed(2)} x Earth`
            : 'Radius: -';

        const distance = d.distance;
        this.dom.distance.textContent = distance
            ? `Orbit Radius: ${distance} units`
            : 'Orbit Radius: 0';

        // Show the panel
        this.dom.panel.classList.add('visible');
        this.dom.panel.classList.remove('animate-out');
        this.dom.panel.classList.add('animate-in');
        this.dom.panel.setAttribute('aria-hidden', 'false');
    }

    /**
     * Hides the info panel.
     * Clears `currentMesh` reference.
     */
    hide(): void {
        if (this.dom.panel.classList.contains('visible')) {
            this.dom.panel.classList.remove('visible');
            this.dom.panel.classList.remove('animate-in');
            this.dom.panel.classList.add('animate-out');
            this.dom.panel.setAttribute('aria-hidden', 'true');

            setTimeout(() => {
                if (!this.dom.panel.classList.contains('visible')) {
                    this.dom.panel.classList.remove('animate-out');
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
