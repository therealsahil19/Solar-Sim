/**
 * @file NavigationSidebar.js
 * @description Manages the planetary navigation sidebar.
 * Encapsulates DOM creation, Search filtering, and Accessibility (Focus Management).
 */

export class NavigationSidebar {
    /**
     * @param {Object} config
     * @param {Array} config.planetData - The hierarchical system data.
     * @param {Object} config.callbacks - Interaction callbacks.
     * @param {Function} config.callbacks.onSelect - (name) => void
     * @param {Function} config.callbacks.onClose - () => void
     */
    constructor({ planetData, callbacks }) {
        this.data = planetData;
        this.callbacks = callbacks;
        this.isOpen = false;

        this.dom = {
            sidebar: document.getElementById('nav-sidebar'),
            list: document.getElementById('nav-list'),
            search: document.getElementById('nav-search'),
            btnClose: document.getElementById('btn-close-nav'),
            btnOpen: document.getElementById('btn-planets'), // External trigger
        };

        if (!this.dom.sidebar) {
            console.error('NavigationSidebar: #nav-sidebar not found.');
            return;
        }

        this.init();
    }

    init() {
        this.renderTree();
        this.bindEvents();
    }

    /**
     * Renders the navigation tree.
     */
    renderTree() {
        if (!this.dom.list) return;
        this.dom.list.innerHTML = ''; // Clear skeleton

        // 1. Sun (Manual)
        const sunData = [{ name: 'Sun', type: 'Star', moons: [] }];
        this.buildLevel(this.dom.list, sunData);

        // 2. System Data
        if (this.data) {
            this.buildLevel(this.dom.list, this.data);
        }
    }

    /**
     * Recursive builder for tree levels.
     * @param {HTMLElement} container
     * @param {Array} items
     */
    buildLevel(container, items) {
        const ul = document.createElement('ul');
        ul.className = 'nav-ul';
        ul.role = 'group'; // A11y: Group for sub-lists

        items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'nav-li';
            li.role = 'treeitem'; // A11y (Basic) - In a real TreeView, this needs complex state
            li.setAttribute('aria-label', item.name);

            const btn = document.createElement('button');
            btn.className = 'nav-btn';

            // Icon
            let icon = '🌑';
            if (item.type === 'Planet') icon = '🪐';
            if (item.type === 'Star') icon = '☀️';

            // Content
            const spanName = document.createElement('span');
            spanName.textContent = `${icon} ${item.name}`;

            const spanType = document.createElement('span');
            spanType.className = 'nav-type';
            spanType.textContent = item.type;

            btn.appendChild(spanName);
            btn.appendChild(document.createTextNode(' '));
            btn.appendChild(spanType);

            btn.addEventListener('click', () => {
                this.callbacks.onSelect(item.name);
                // On mobile, maybe close sidebar?
                if (window.innerWidth <= 768) this.close();
            });

            li.appendChild(btn);

            // Recursion
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

    bindEvents() {
        // Toggle Logic
        if (this.dom.btnClose) {
            this.dom.btnClose.addEventListener('click', () => this.close());
        }
        if (this.dom.btnOpen) {
            this.dom.btnOpen.addEventListener('click', () => this.open());
        }

        // Search Logic
        if (this.dom.search) {
            this.dom.search.addEventListener('input', (e) => this.handleSearch(e.target.value));
        }
    }

    open() {
        this.isOpen = true;
        this.dom.sidebar.setAttribute('aria-hidden', 'false');

        // A11y: Focus Management
        // Wait for transition? Or focus immediately.
        // Focus the Close button or Search
        if (this.dom.search) setTimeout(() => this.dom.search.focus(), 50);
    }

    close() {
        this.isOpen = false;
        this.dom.sidebar.setAttribute('aria-hidden', 'true');

        // A11y: Return focus to opener
        if (this.dom.btnOpen) this.dom.btnOpen.focus();
    }

    handleSearch(term) {
        term = term.toLowerCase().trim();
        const items = this.dom.list.querySelectorAll('.nav-li');

        if (!term) {
            items.forEach(li => li.style.display = '');
            return;
        }

        // 1. Mark Matches
        items.forEach(li => {
            const btn = li.querySelector('.nav-btn');
            const text = btn.textContent.toLowerCase();
            const isMatch = text.includes(term);
            li.dataset.matches = isMatch ? 'true' : 'false';
            li.style.display = 'none';
        });

        // 2. Show Matches & Parents
        items.forEach(li => {
            if (li.dataset.matches === 'true') {
                li.style.display = '';

                // Walk up
                let parent = li.parentElement; // ul
                while (parent && parent !== this.dom.list) {
                    if (parent.classList.contains('nav-sublist')) {
                        parent.style.display = '';
                        const parentLi = parent.parentElement;
                        if (parentLi) parentLi.style.display = '';
                    }
                    parent = parent.parentElement;
                }
            }
        });
    }
}
