/**
 * @file CommandPalette.js
 * @description A "Cmd+K" interface for power users to navigate and control the simulation.
 * Implements WAI-ARIA Combo Box pattern (1.2) for accessibility.
 */

export class CommandPalette {
    /**
     * @param {Array} planetData - The hierarchical system data.
     * @param {Object} callbacks - Functions to execute actions.
     * @param {Function} callbacks.onSelectByName - (name) => void
     * @param {Function} callbacks.onToggleOrbits - () => void
     * @param {Function} callbacks.onToggleLabels - () => void
     * @param {Function} callbacks.onToggleTexture - () => void
     * @param {Function} callbacks.onToggleCamera - () => void
     * @param {Function} callbacks.onResetCamera - () => void
     * @param {Function} callbacks.onTogglePause - () => void
     * @param {Function} callbacks.openModal - () => void
     * @param {Function} callbacks.onToggleTheme - () => void
     */
    constructor(planetData, callbacks) {
        this.callbacks = callbacks;
        this.isOpen = false;
        this.selectedIndex = 0;
        this.filteredItems = [];
        this.previousActiveElement = null;

        // Flatten data and merge with commands
        this.items = [
            ...this.flattenData(planetData),
            ...this.getStaticCommands()
        ];

        this.initDOM();
        this.bindEvents();
    }

    /**
     * Flattens the recursive planet data into a linear list.
     * @param {Array} data - Hierarchy of planet/moon objects.
     * @returns {Array} List of searchable items.
     */
    flattenData(data) {
        if (!data) return [];
        const items = [];
        const traverse = (nodes) => {
            nodes.forEach(node => {
                items.push({
                    name: node.name,
                    type: node.type, // 'Planet', 'Moon', 'Star'
                    category: 'Navigation',
                    handler: () => this.callbacks.onSelectByName(node.name)
                });
                if (node.moons) traverse(node.moons);
            });
        };
        // Add Sun manually if missing (it's usually not in system.json array)
        if (!data.find(n => n.name === 'Sun')) {
            items.push({
                name: 'Sun', type: 'Star', category: 'Navigation',
                handler: () => this.callbacks.onSelectByName('Sun')
            });
        }
        traverse(data);
        return items;
    }

    /**
     * Defines the static command actions available in the palette.
     * @returns {Array} List of command objects.
     */
    getStaticCommands() {
        return [
            { name: 'Switch Theme', type: 'Command', category: 'Appearance', handler: () => this.callbacks.onToggleTheme() },
            { name: 'Toggle Orbits', type: 'Command', category: 'Actions', handler: this.callbacks.onToggleOrbits },
            { name: 'Toggle Labels', type: 'Command', category: 'Actions', handler: this.callbacks.onToggleLabels },
            { name: 'Toggle Textures (HD/LD)', type: 'Command', category: 'Actions', handler: () => this.callbacks.onToggleTexture(null) },
            { name: 'Toggle Camera Mode', type: 'Command', category: 'Actions', handler: this.callbacks.onToggleCamera },
            { name: 'Reset View', type: 'Command', category: 'Actions', handler: this.callbacks.onResetCamera },
            { name: 'Pause / Resume', type: 'Command', category: 'Actions', handler: () => this.callbacks.onTogglePause(null) },
            { name: 'Help / Controls', type: 'Command', category: 'Actions', handler: this.callbacks.openModal },
        ];
    }

    /**
     * Initializes the DOM elements for the command palette.
     */
    initDOM() {
        // Overlay
        this.overlay = document.createElement('div');
        this.overlay.id = 'cmd-palette-overlay';
        this.overlay.setAttribute('role', 'dialog');
        this.overlay.setAttribute('aria-modal', 'true');
        this.overlay.setAttribute('aria-label', 'Command Palette');
        this.overlay.hidden = true; // Use hidden attribute logic

        // Container
        const container = document.createElement('div');
        container.className = 'cmd-panel glass-panel';

        // Input Wrapper (for icon)
        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'cmd-input-wrapper';

        const searchIcon = document.createElement('span');
        searchIcon.textContent = '🔍';
        searchIcon.className = 'cmd-icon';

        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.placeholder = 'Type to search...';
        this.input.setAttribute('aria-autocomplete', 'list');
        this.input.setAttribute('aria-controls', 'cmd-list');
        this.input.setAttribute('aria-expanded', 'true');
        this.input.setAttribute('aria-activedescendant', ''); // Updated dynamically

        inputWrapper.appendChild(searchIcon);
        inputWrapper.appendChild(this.input);

        // List
        this.list = document.createElement('ul');
        this.list.id = 'cmd-list';
        this.list.setAttribute('role', 'listbox');

        // Footer (Shortcuts hint)
        const footer = document.createElement('div');
        footer.className = 'cmd-footer';
        footer.innerHTML = `
            <span><kbd>↑</kbd> <kbd>↓</kbd> to navigate</span>
            <span><kbd>↵</kbd> to select</span>
            <span><kbd>esc</kbd> to close</span>
        `;

        container.appendChild(inputWrapper);
        container.appendChild(this.list);
        container.appendChild(footer);
        this.overlay.appendChild(container);

        document.body.appendChild(this.overlay);
    }

    /**
     * Binds event listeners for input, keyboard navigation, and toggling.
     */
    bindEvents() {
        // Input Filter
        this.input.addEventListener('input', (e) => this.filter(e.target.value));

        // Keyboard Navigation (Input)
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.selectIndex(this.selectedIndex + 1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.selectIndex(this.selectedIndex - 1);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                this.executeCurrent();
            } else if (e.key === 'Escape') {
                this.close();
            }
        });

        // Close on backdrop click
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });

        // Global Toggle
        window.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                this.toggle();
            }
        });
    }

    /**
     * Toggles the open/close state of the palette.
     */
    toggle() {
        if (this.isOpen) this.close();
        else this.open();
    }

    /**
     * Opens the command palette and focuses the input.
     */
    open() {
        this.isOpen = true;
        this.overlay.hidden = false;
        this.overlay.classList.add('visible');
        this.previousActiveElement = document.activeElement;

        this.input.value = '';
        this.filter(''); // Reset list
        this.input.focus();
    }

    /**
     * Closes the command palette and restores focus.
     */
    close() {
        this.isOpen = false;
        this.overlay.classList.remove('visible');
        // Wait for animation to finish before hiding?
        // For simplicity, we just hide after a tiny delay or use CSS transition handling.
        // But to be safe with 'hidden', we should do it immediately or use animationend.
        // Let's just remove the class and set hidden after timeout matches CSS.
        setTimeout(() => {
            if (!this.isOpen) this.overlay.hidden = true;
        }, 200); // Matches typical duration

        if (this.previousActiveElement) {
            this.previousActiveElement.focus();
        }
    }

    /**
     * Filters the item list based on the search query.
     * @param {string} query - The search string.
     */
    filter(query) {
        const q = query.toLowerCase().trim();

        if (!q) {
            // Show top items or all? Let's show all for now, maybe limited to 20
            this.filteredItems = this.items;
        } else {
            this.filteredItems = this.items.filter(item =>
                item.name.toLowerCase().includes(q) ||
                item.type.toLowerCase().includes(q)
            );
        }

        // Sort: Exact matches first
        this.filteredItems.sort((a, b) => {
            const aName = a.name.toLowerCase();
            const bName = b.name.toLowerCase();
            const aStarts = aName.startsWith(q);
            const bStarts = bName.startsWith(q);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            return 0;
        });

        this.renderList();
        this.selectIndex(0);
    }

    /**
     * Renders the filtered list of items to the DOM.
     */
    renderList() {
        this.list.innerHTML = '';

        if (this.filteredItems.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'cmd-empty';
            empty.textContent = 'No results found.';
            this.list.appendChild(empty);
            return;
        }

        this.filteredItems.forEach((item, index) => {
            const li = document.createElement('li');
            li.id = `cmd-item-${index}`;
            li.role = 'option';
            li.className = 'cmd-item';

            // Icon
            let icon = '⚡';
            if (item.type === 'Planet') icon = '🪐';
            if (item.type === 'Moon') icon = '🌑';
            if (item.type === 'Star') icon = '☀️';

            const iconSpan = document.createElement('span');
            iconSpan.className = 'cmd-item-icon';
            iconSpan.textContent = icon;

            const textSpan = document.createElement('span');
            textSpan.className = 'cmd-item-text';
            textSpan.textContent = item.name;

            const metaSpan = document.createElement('span');
            metaSpan.className = 'cmd-item-meta';
            metaSpan.textContent = item.type;

            li.appendChild(iconSpan);
            li.appendChild(textSpan);
            li.appendChild(metaSpan);

            li.addEventListener('click', () => {
                this.selectedIndex = index;
                this.executeCurrent();
            });

            // Hover state logic if needed, but CSS :hover handles visual
            // Mouse enter updates selection index for keyboard continuity
            li.addEventListener('mouseenter', () => {
                this.selectIndex(index, false); // false = don't scroll
            });

            this.list.appendChild(li);
        });
    }

    /**
     * Selects an item at the given index.
     * @param {number} index - The index to select.
     * @param {boolean} [autoScroll=true] - Whether to scroll the selected item into view.
     */
    selectIndex(index, autoScroll = true) {
        if (this.filteredItems.length === 0) return;

        // Wrap around
        if (index < 0) index = this.filteredItems.length - 1;
        if (index >= this.filteredItems.length) index = 0;

        this.selectedIndex = index;

        // Update UI
        const items = this.list.querySelectorAll('.cmd-item');
        items.forEach((item, i) => {
            if (i === index) {
                item.setAttribute('aria-selected', 'true');
                item.classList.add('selected');
                this.input.setAttribute('aria-activedescendant', item.id);
                if (autoScroll) {
                    item.scrollIntoView({ block: 'nearest' });
                }
            } else {
                item.setAttribute('aria-selected', 'false');
                item.classList.remove('selected');
            }
        });
    }

    /**
     * Executes the handler for the currently selected item.
     */
    executeCurrent() {
        const item = this.filteredItems[this.selectedIndex];
        if (item) {
            this.close();
            item.handler();
        }
    }
}
