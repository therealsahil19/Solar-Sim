/**
 * @file NavigationSidebar.js
 * @description Manages the planetary navigation sidebar component.
 *
 * This class handles:
 * 1. **DOM Generation**: Recursively building a tree view from hierarchical system data.
 * 2. **Client-side Search**: Filtering the tree based on planet names, keeping parents visible.
 * 3. **Accessibility**: Managing focus, ARIA attributes, and keyboard interaction.
 *
 * It is decoupled from the 3D scene, communicating purely via callbacks.
 */

export class NavigationSidebar {
    /**
     * Creates a new Navigation Sidebar instance.
     *
     * @param {Object} config - Configuration object.
     * @param {Array<Object>} config.planetData - The hierarchical system data (from system.json).
     * @param {Object} config.callbacks - Interaction callbacks.
     * @param {Function} config.callbacks.onSelect - Callback invoked when an item is clicked. Receives (name).
     * @param {Function} [config.callbacks.onClose] - Optional callback when sidebar is closed.
     */
    constructor({ planetData, callbacks }) {
        /** @type {Array<Object>} Reference to the raw planet data */
        this.data = planetData;

        /** @type {Object} Callbacks for external communication */
        this.callbacks = callbacks;

        /** @type {boolean} Internal state of visibility */
        this.isOpen = false;

        // Cache DOM elements for performance
        this.dom = {
            sidebar: document.getElementById('nav-sidebar'),
            list: document.getElementById('nav-list'),
            search: document.getElementById('nav-search'),
            btnClose: document.getElementById('btn-close-nav'),
            btnOpen: document.getElementById('btn-planets'), // External trigger button
        };

        if (!this.dom.sidebar) {
            console.error('NavigationSidebar: #nav-sidebar not found in DOM.');
            return;
        }

        this.init();
    }

    /**
     * Initializes the component by rendering the tree and binding event listeners.
     */
    init() {
        this.renderTree();
        this.bindEvents();
    }

    /**
     * Renders the navigation tree into the sidebar.
     * Clears any existing content (skeletons) before rendering.
     */
    renderTree() {
        if (!this.dom.list) return;
        this.dom.list.innerHTML = ''; // Clear skeleton or previous render

        // 1. Add Sun manually (since it might not be in the recursive data array)
        const sunData = [{ name: 'Sun', type: 'Star', moons: [] }];
        this.buildLevel(this.dom.list, sunData);

        // 2. Add System Data (Planets and recursive moons)
        if (this.data) {
            this.buildLevel(this.dom.list, this.data);
        }
    }

    /**
     * Recursive helper to build a specific level of the navigation tree.
     *
     * @param {HTMLElement} container - The DOM element to append to (ul or div).
     * @param {Array<Object>} items - Array of planet/moon data objects for this level.
     */
    buildLevel(container, items) {
        const ul = document.createElement('ul');
        ul.className = 'nav-ul';
        ul.role = 'group'; // A11y: Semantically groups the sub-items

        items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'nav-li';
            li.role = 'treeitem'; // A11y: Identifies this as a tree node
            li.setAttribute('aria-label', item.name);

            // Create interactive button
            const btn = document.createElement('button');
            btn.className = 'nav-btn';

            // Determine Icon
            let icon = '🌑'; // Default for Moon
            if (item.type === 'Planet') icon = '🪐';
            if (item.type === 'Star') icon = '☀️';

            // Construct Content (Safe DOM creation to prevent XSS)
            const spanName = document.createElement('span');
            spanName.textContent = `${icon} ${item.name}`;

            const spanType = document.createElement('span');
            spanType.className = 'nav-type';
            spanType.textContent = item.type;

            btn.appendChild(spanName);
            btn.appendChild(document.createTextNode(' '));
            btn.appendChild(spanType);

            // Bind Selection Event
            btn.addEventListener('click', () => {
                if (this.callbacks.onSelect) {
                    this.callbacks.onSelect(item.name);
                }
                // UX: Auto-close on mobile to clear view
                if (window.innerWidth <= 768) this.close();
            });

            li.appendChild(btn);

            // Recursive Step: If item has moons, build the next level
            if (item.moons && item.moons.length > 0) {
                const subContainer = document.createElement('div');
                subContainer.className = 'nav-sublist';
                this.buildLevel(subContainer, item.moons);
                li.appendChild(subContainer);
            }

            ul.appendChild(li);
        });

        container.appendChild(ul);
    }

    /**
     * Binds internal DOM events (Close, Open, Search).
     */
    bindEvents() {
        // Toggle Logic
        this._handleCloseClick = () => this.close();
        this._handleOpenClick = () => this.open();

        if (this.dom.btnClose) {
            this.dom.btnClose.addEventListener('click', this._handleCloseClick);
        }
        if (this.dom.btnOpen) {
            this.dom.btnOpen.addEventListener('click', this._handleOpenClick);
        }

        // Search Logic (Real-time filtering)
        if (this.dom.search) {
            this._handleSearchInput = (e) => this.handleSearch(e.target.value);
            this.dom.search.addEventListener('input', this._handleSearchInput);
        }
    }

    /**
     * Cleans up event listeners and references.
     */
    dispose() {
        if (this.dom.btnClose && this._handleCloseClick) {
            this.dom.btnClose.removeEventListener('click', this._handleCloseClick);
        }
        if (this.dom.btnOpen && this._handleOpenClick) {
            this.dom.btnOpen.removeEventListener('click', this._handleOpenClick);
        }
        if (this.dom.search && this._handleSearchInput) {
            this.dom.search.removeEventListener('input', this._handleSearchInput);
        }
    }

    /**
     * Opens the sidebar.
     * Manages ARIA states and moves focus to the search input for efficiency.
     */
    open() {
        this.isOpen = true;
        this.dom.sidebar.setAttribute('aria-hidden', 'false');

        // A11y: Move focus to search after a short delay (transition allowance)
        if (this.dom.search) {
            setTimeout(() => this.dom.search.focus(), 50);
        }
    }

    /**
     * Closes the sidebar.
     * Returns focus to the trigger button to maintain keyboard navigation flow.
     */
    close() {
        this.isOpen = false;
        this.dom.sidebar.setAttribute('aria-hidden', 'true');

        // A11y: Return focus to the button that opened the menu
        if (this.dom.btnOpen) this.dom.btnOpen.focus();
    }

    /**
     * Filters the navigation tree based on a search term.
     * Implements a "Show Matches & Parents" strategy so users don't lose context.
     *
     * @param {string} term - The search query.
     */
    handleSearch(term) {
        term = term.toLowerCase().trim();
        const items = this.dom.list.querySelectorAll('.nav-li');

        // Reset if empty
        if (!term) {
            items.forEach(li => li.style.display = '');
            return;
        }

        // Phase 1: Reset all and mark direct matches
        items.forEach(li => {
            const btn = li.querySelector('.nav-btn');
            // Safe text access
            const text = btn.textContent.toLowerCase();
            const isMatch = text.includes(term);

            li.dataset.matches = isMatch ? 'true' : 'false';
            li.style.display = 'none'; // Hide by default
        });

        // Phase 2: Walk up the tree to reveal matching paths
        items.forEach(li => {
            if (li.dataset.matches === 'true') {
                li.style.display = ''; // Show match

                // Walk up parent elements
                let parent = li.parentElement; // ul
                while (parent && parent !== this.dom.list) {
                    if (parent.classList.contains('nav-sublist')) {
                        parent.style.display = '';
                        const parentLi = parent.parentElement;
                        if (parentLi) parentLi.style.display = ''; // Show parent folder
                    }
                    parent = parent.parentElement;
                }
            }
        });
    }
}
