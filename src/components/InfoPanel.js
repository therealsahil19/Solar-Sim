/**
 * @file InfoPanel.js
 * @description Manages the "Info Panel" UI component that displays details for selected celestial objects.
 *
 * This class handles:
 * 1. **Data Binding**: Updating the DOM with data from `userData` of the selected mesh.
 * 2. **State Management**: Managing visibility (Hidden/Visible) via CSS classes.
 * 3. **Interactivity**: Handling the "Follow" button action.
 * 4. **Accessibility**: Using ARIA attributes to ensure screen readers announce updates.
 */

export class InfoPanel {
    /**
     * Creates a new InfoPanel instance.
     *
     * @param {Object} config - Configuration object.
     * @param {Object} config.callbacks - Interaction callbacks.
     * @param {Function} config.callbacks.onFollow - Callback triggered when "Follow" is clicked. Receives (mesh).
     */
    constructor({ callbacks }) {
        /** @type {Object} External callbacks */
        this.callbacks = callbacks;

        /** @type {THREE.Object3D|null} Reference to the currently displayed object */
        this.currentMesh = null;

        // Cache DOM elements
        this.dom = {
            panel: document.getElementById('info-panel'),
            name: document.getElementById('info-name'),
            type: document.getElementById('info-type'),
            desc: document.getElementById('info-desc'),
            radius: document.getElementById('info-radius'),
            distance: document.getElementById('info-distance'),
            distSun: document.getElementById('info-dist-sun'), // Dynamic update target
            btnFollow: document.getElementById('btn-follow'),
        };

        if (!this.dom.panel) {
            console.error('InfoPanel: #info-panel not found in DOM.');
        }

        this.bindEvents();
    }

    /**
     * Binds internal event listeners.
     */
    bindEvents() {
        if (this.dom.btnFollow) {
            this._handleFollowClick = (e) => {
                // Prevent bubbling if necessary, though usually fine here
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
    dispose() {
        if (this.dom.btnFollow && this._handleFollowClick) {
            this.dom.btnFollow.removeEventListener('click', this._handleFollowClick);
        }
    }

    /**
     * Updates the panel with new object data and reveals it.
     *
     * @param {THREE.Object3D} mesh - The selected object.
     *   Must contain a `userData` object with keys: `name`, `type`, `description`, `size`, `distance`.
     */
    update(mesh) {
        if (!mesh) return;

        this.currentMesh = mesh;
        const d = mesh.userData;

        // Safe text updates
        if (this.dom.name) this.dom.name.textContent = d.name || 'Unknown';
        if (this.dom.type) this.dom.type.textContent = d.type || 'Unknown Type';
        if (this.dom.desc) this.dom.desc.textContent = d.description || 'No description available.';

        // Format numeric values
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
        // We use a CSS class '.visible' to trigger transitions (slide-in/fade-in)
        if (this.dom.panel) {
            this.dom.panel.classList.add('visible');
            this.dom.panel.setAttribute('aria-hidden', 'false');
        }
    }

    /**
     * Hides the info panel.
     * Clears `currentMesh` reference.
     */
    hide() {
        if (this.dom.panel) {
            this.dom.panel.classList.remove('visible');
            this.dom.panel.setAttribute('aria-hidden', 'true');
        }
        this.currentMesh = null;
    }
}
