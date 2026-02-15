/**
 * @file CommandPalette.ts
 * @description A "Cmd+K" interface for power users to navigate and control the simulation.
 * Implements WAI-ARIA Combo Box pattern (1.2) for accessibility.
 */

import type { Disposable, CelestialBody } from '../types';

/**
 * Command palette item.
 */
interface PaletteItem {
    name: string;
    type: string;
    category: string;
    handler: () => void;
}

/**
 * Callbacks for CommandPalette actions.
 */
export interface CommandPaletteCallbacks {
    onSelectByName: (name: string) => void;
    onToggleOrbits: () => void;
    onToggleLabels: () => void;
    onToggleTexture: (element: HTMLElement | null) => void;
    onToggleCamera: () => void;
    onResetCamera: () => void;
    onTogglePause: (element: HTMLElement | null) => void;
    openModal: () => void;
    onToggleTheme: () => void;
}

/**
 * A "Cmd+K" command palette for power users.
 */
export class CommandPalette implements Disposable {
    private callbacks: CommandPaletteCallbacks;
    private _isOpen: boolean = false;
    private selectedIndex: number = 0;
    private filteredItems: PaletteItem[] = [];
    private previousActiveElement: Element | null = null;
    private items: PaletteItem[];

    // DOM elements
    private overlay!: HTMLDivElement;
    private input!: HTMLInputElement;
    private list!: HTMLUListElement;
    private liveRegion!: HTMLDivElement;

    /**
     * Creates a new CommandPalette instance.
     * @param planetData - The hierarchical system data.
     * @param callbacks - Functions to execute actions.
     */
    constructor(planetData: CelestialBody[], callbacks: CommandPaletteCallbacks) {
        this.callbacks = callbacks;
        this.items = [
            ...this.flattenData(planetData),
            ...this.getStaticCommands()
        ];

        this.initDOM();
        this.bindEvents();
    }

    /**
     * Flattens the recursive planet data into a linear list of searchable items.
     */
    private flattenData(data: CelestialBody[]): PaletteItem[] {
        if (!data) return [];
        const items: PaletteItem[] = [];

        const traverse = (nodes: CelestialBody[]): void => {
            nodes.forEach(node => {
                items.push({
                    name: node.name,
                    type: node.type === 'planet' ? 'Planet' :
                        node.type === 'moon' ? 'Moon' :
                            node.type === 'star' ? 'Star' :
                                node.type === 'dwarf_planet' ? 'Dwarf Planet' : node.type,
                    category: 'Navigation',
                    handler: () => this.callbacks.onSelectByName(node.name)
                });
                if (node.moons) traverse(node.moons);
            });
        };

        // Add Sun manually if missing
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
     */
    private getStaticCommands(): PaletteItem[] {
        return [
            { name: 'Switch Theme', type: 'Command', category: 'Appearance', handler: () => this.callbacks.onToggleTheme() },
            { name: 'Toggle Orbits', type: 'Command', category: 'Actions', handler: () => this.callbacks.onToggleOrbits() },
            { name: 'Toggle Labels', type: 'Command', category: 'Actions', handler: () => this.callbacks.onToggleLabels() },
            { name: 'Toggle Textures (HD/LD)', type: 'Command', category: 'Actions', handler: () => this.callbacks.onToggleTexture(null) },
            { name: 'Toggle Camera Mode', type: 'Command', category: 'Actions', handler: () => this.callbacks.onToggleCamera() },
            { name: 'Reset View', type: 'Command', category: 'Actions', handler: () => this.callbacks.onResetCamera() },
            { name: 'Pause / Resume', type: 'Command', category: 'Actions', handler: () => this.callbacks.onTogglePause(null) },
            { name: 'Help / Controls', type: 'Command', category: 'Actions', handler: () => this.callbacks.openModal() },
        ];
    }

    /**
     * Initializes the DOM elements for the command palette.
     */
    private initDOM(): void {
        // Overlay
        this.overlay = document.createElement('div');
        this.overlay.id = 'cmd-palette-overlay';
        this.overlay.setAttribute('role', 'dialog');
        this.overlay.setAttribute('aria-modal', 'true');
        this.overlay.setAttribute('aria-label', 'Command Palette');
        this.overlay.hidden = true;

        // Container
        const container = document.createElement('div');
        container.className = 'cmd-panel glass-panel';

        // Input Wrapper
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
        this.input.setAttribute('aria-activedescendant', '');

        inputWrapper.appendChild(searchIcon);
        inputWrapper.appendChild(this.input);

        // List
        this.list = document.createElement('ul');
        this.list.id = 'cmd-list';
        this.list.setAttribute('role', 'listbox');

        // Live region for A11y
        this.liveRegion = document.createElement('div');
        this.liveRegion.className = 'sr-only';
        this.liveRegion.setAttribute('aria-live', 'polite');
        this.liveRegion.setAttribute('aria-atomic', 'true');
        container.appendChild(this.liveRegion);

        // Footer
        const footer = document.createElement('div');
        footer.className = 'cmd-footer';
        footer.innerHTML = `
            <span><kbd class="kbd">↑</kbd> <kbd class="kbd">↓</kbd> to navigate</span>
            <span><kbd class="kbd">↵</kbd> to select</span>
            <span><kbd class="kbd">esc</kbd> to close</span>
        `;

        container.appendChild(inputWrapper);
        container.appendChild(this.list);
        container.appendChild(footer);
        this.overlay.appendChild(container);

        document.body.appendChild(this.overlay);
    }

    /**
     * Binds event listeners.
     */
    private bindEvents(): void {
        // Input Filter with Debounce
        let debounceTimer: number | null = null;
        this.input.addEventListener('input', (e) => {
            if (debounceTimer) {
                window.clearTimeout(debounceTimer);
            }
            debounceTimer = window.setTimeout(() => {
                const target = e.target as HTMLInputElement;
                this.filter(target.value);
            }, 100);
        });

        // Keyboard Navigation
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
    }

    /**
     * Destroys the command palette and removes global event listeners.
     */
    dispose(): void {
        if (this.overlay?.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
    }

    /** Alias for dispose */
    destroy(): void {
        this.dispose();
    }

    /** Toggles open/close state */
    toggle(): void {
        if (this._isOpen) this.close();
        else this.open();
    }

    /** Opens the command palette */
    open(): void {
        this._isOpen = true;
        this.overlay.hidden = false;
        this.overlay.classList.add('visible');
        this.overlay.classList.remove('animate-out');
        this.overlay.classList.add('animate-in');
        this.previousActiveElement = document.activeElement;

        this.input.value = '';
        this.filter('');
        this.input.focus();
    }

    /** Closes the command palette */
    close(): void {
        this._isOpen = false;
        this.overlay.classList.remove('visible');
        this.overlay.classList.remove('animate-in');
        this.overlay.classList.add('animate-out');

        setTimeout(() => {
            if (!this._isOpen) {
                this.overlay.hidden = true;
                this.overlay.classList.remove('animate-out');
            }
        }, 350);

        if (this.previousActiveElement instanceof HTMLElement) {
            this.previousActiveElement.focus();
        }
    }

    /** Returns whether the palette is currently open */
    isOpen(): boolean {
        return this._isOpen;
    }

    /**
     * Filters the item list based on the search query.
     */
    private filter(query: string): void {
        const q = query.toLowerCase().trim();

        if (!q) {
            this.filteredItems = this.items;
        } else {
            this.filteredItems = this.items.filter(item =>
                (item.name?.toLowerCase() ?? '').includes(q) ||
                (item.type?.toLowerCase() ?? '').includes(q)
            );
        }

        // Sort: Exact matches first
        this.filteredItems.sort((a, b) => {
            const aName = (a.name ?? '').toLowerCase();
            const bName = (b.name ?? '').toLowerCase();
            const aStarts = aName.startsWith(q);
            const bStarts = bName.startsWith(q);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            return 0;
        });

        this.renderList();
        this.selectIndex(0);

        // A11y update
        this.liveRegion.textContent = q
            ? `${this.filteredItems.length} results found for "${q}"`
            : '';
    }

    /**
     * Renders the filtered list of items to the DOM.
     * ⚡ Optimization: Recycles existing DOM elements to avoid layout thrashing.
     */
    private renderList(): void {
        const currentCount = this.list.children.length;
        const targetCount = this.filteredItems.length;

        // Handle empty state
        if (targetCount === 0) {
            this.list.innerHTML = '';
            const empty = document.createElement('li');
            empty.className = 'cmd-empty';
            empty.textContent = 'No results found.';
            this.list.appendChild(empty);
            return;
        }

        // Remove "No results" if it exists
        if (this.list.querySelector('.cmd-empty')) {
            this.list.innerHTML = '';
        }

        // Adjust number of list items
        if (currentCount > targetCount) {
            for (let i = currentCount - 1; i >= targetCount; i--) {
                this.list.removeChild(this.list.children[i]);
            }
        }

        this.filteredItems.forEach((item, index) => {
            let li = this.list.children[index] as HTMLLIElement;

            if (!li) {
                li = document.createElement('li');
                li.setAttribute('role', 'option');
                li.className = 'cmd-item';

                // Static parts that don't change
                li.innerHTML = `
                    <span class="cmd-item-icon"></span>
                    <span class="cmd-item-text"></span>
                    <span class="cmd-item-meta"></span>
                `;

                li.addEventListener('click', () => {
                    this.selectedIndex = index;
                    this.executeCurrent();
                });

                li.addEventListener('mouseenter', () => {
                    this.selectIndex(index, false);
                });

                this.list.appendChild(li);
            }

            // Update dynamic content
            li.id = `cmd-item-${index}`;

            const iconSpan = li.children[0] as HTMLElement;
            const textSpan = li.children[1] as HTMLElement;
            const metaSpan = li.children[2] as HTMLElement;

            let icon = '⚡';
            if (item.type === 'Planet') icon = '🪐';
            if (item.type === 'Moon') icon = '🌑';
            if (item.type === 'Star') icon = '☀️';
            if (item.type === 'Dwarf Planet') icon = '☄️';

            if (iconSpan.textContent !== icon) iconSpan.textContent = icon;
            if (textSpan.textContent !== item.name) textSpan.textContent = item.name;
            if (metaSpan.textContent !== item.type) metaSpan.textContent = item.type;
        });
    }

    /**
     * Selects an item at the given index.
     */
    private selectIndex(index: number, autoScroll: boolean = true): void {
        if (this.filteredItems.length === 0) return;

        if (index < 0) index = this.filteredItems.length - 1;
        if (index >= this.filteredItems.length) index = 0;

        this.selectedIndex = index;

        const items = this.list.querySelectorAll<HTMLElement>('.cmd-item');
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
    private executeCurrent(): void {
        const item = this.filteredItems[this.selectedIndex];
        if (item) {
            this.close();
            if (typeof item.handler === 'function') {
                item.handler();
            } else {
                console.warn(`CommandPalette: Item "${item.name}" has no valid handler.`);
            }
        }
    }
}
