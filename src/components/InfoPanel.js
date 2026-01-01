/**
 * @file InfoPanel.js
 * @description Manages the details panel for selected celestial objects.
 * Handles DOM updates, "Follow" actions, and A11y Live Regions.
 */

export class InfoPanel {
    /**
     * @param {Object} config
     * @param {Object} config.callbacks
     * @param {Function} config.callbacks.onFollow - (mesh) => void
     */
    constructor({ callbacks }) {
        this.callbacks = callbacks;
        this.currentMesh = null;

        this.dom = {
            panel: document.getElementById('info-panel'),
            name: document.getElementById('info-name'),
            type: document.getElementById('info-type'),
            desc: document.getElementById('info-desc'),
            radius: document.getElementById('info-radius'),
            distance: document.getElementById('info-distance'),
            distSun: document.getElementById('info-dist-sun'),
            btnFollow: document.getElementById('btn-follow'),
        };

        if (!this.dom.panel) {
            console.error('InfoPanel: #info-panel not found.');
        }

        this.bindEvents();
    }

    bindEvents() {
        // "Follow" button logic is dynamic per object, but we can bind a wrapper here
        // Actually, cleaner to re-bind or use a static listener that checks `this.currentMesh`
        if (this.dom.btnFollow) {
            this.dom.btnFollow.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.currentMesh && this.callbacks.onFollow) {
                    this.callbacks.onFollow(this.currentMesh);
                }
            });
        }
    }

    /**
     * Updates the panel with new object data.
     * @param {THREE.Object3D} mesh - The selected object (standard or pivot).
     */
    update(mesh) {
        if (!mesh) return;
        this.currentMesh = mesh;
        const d = mesh.userData;

        if (this.dom.name) this.dom.name.textContent = d.name || 'Unknown';
        if (this.dom.type) this.dom.type.textContent = d.type || 'Unknown Type';
        if (this.dom.desc) this.dom.desc.textContent = d.description || 'No description available.';

        if (this.dom.radius) {
            this.dom.radius.textContent = d.size
                ? `Radius: ${d.size.toFixed(2)} x Earth`
                : 'Radius: -';
        }

        if (this.dom.distance) {
            this.dom.distance.textContent = d.distance
                ? `Orbit Radius: ${d.distance} units`
                : 'Orbit Radius: 0';
        }

        // Show the panel
        if (this.dom.panel) {
            this.dom.panel.classList.add('visible');
            this.dom.panel.setAttribute('aria-hidden', 'false');
        }
    }

    /**
     * Hides the panel.
     */
    hide() {
        if (this.dom.panel) {
            this.dom.panel.classList.remove('visible');
            this.dom.panel.setAttribute('aria-hidden', 'true');
        }
        this.currentMesh = null;
    }
}
