/**
 * @file NavigationSidebar.ts
 * @description Manages the planetary navigation sidebar component.
 *
 * This class handles:
 * 1. **DOM Generation**: Recursively building a tree view from hierarchical system data.
 * 2. **Client-side Search**: Filtering the tree based on planet names, keeping parents visible.
 * 3. **Accessibility**: Managing focus, ARIA attributes, and keyboard interaction.
 *
 * It is decoupled from the 3D scene, communicating purely via callbacks.
 */

import type { Disposable, CelestialBody } from '../types';
import { removeSkeletons } from '../utils/SkeletonUtils';

/**
 * DOM element cache for NavigationSidebar.
 */
interface NavigationSidebarDOM {
    sidebar: HTMLElement | null;
    list: HTMLElement | null;
    search: HTMLInputElement | null;
    btnClose: HTMLButtonElement | null;
    btnOpen: HTMLButtonElement | null;
}

/**
 * Callbacks for NavigationSidebar interactions.
 */
export interface NavigationSidebarCallbacks {
    /** Callback invoked when an item is selected */
    onSelect: (name: string) => void;
    /** Optional callback when sidebar is closed */
    onClose?: () => void;
}

/**
 * Configuration for NavigationSidebar.
 */
export interface NavigationSidebarConfig {
    /** The hierarchical system data */
    planetData: CelestialBody[];
    /** Interaction callbacks */
    callbacks: NavigationSidebarCallbacks;
}

/**
 * Simplified item structure for rendering.
 */
interface NavItem {
    name: string;
    type: string;
    moons?: NavItem[];
}

/**
 * Manages the planetary navigation sidebar component.
 */
export class NavigationSidebar implements Disposable {
    private data: CelestialBody[];
    private callbacks: NavigationSidebarCallbacks;
    private _isOpen: boolean = false;
    private dom: NavigationSidebarDOM;

    // Event handler references
    private _handleCloseClick: (() => void) | null = null;
    private _handleOpenClick: (() => void) | null = null;
    private _handleSearchInput: ((e: Event) => void) | null = null;

    /**
     * Creates a new Navigation Sidebar instance.
     * @param config - Configuration object.
     */
    constructor({ planetData, callbacks }: NavigationSidebarConfig) {
        this.data = planetData;
        this.callbacks = callbacks;

        // Cache DOM elements
        this.dom = {
            sidebar: document.getElementById('nav-sidebar'),
            list: document.getElementById('nav-list'),
            search: document.getElementById('nav-search') as HTMLInputElement | null,
            btnClose: document.getElementById('btn-close-nav') as HTMLButtonElement | null,
            btnOpen: document.getElementById('btn-planets') as HTMLButtonElement | null,
        };

        if (!this.dom.sidebar) {
            console.error('NavigationSidebar: #nav-sidebar not found in DOM.');
            return;
        }

        if (!this.dom.list) {
            console.warn('NavigationSidebar: #nav-list not found in DOM.');
        }

        this.init();
    }

    /**
     * Initializes the component by rendering the tree and binding event listeners.
     */
    private init(): void {
        // Clear skeletons before rendering
        if (this.dom.list) {
            removeSkeletons(this.dom.list);
        }
        this.renderTree();
        this.bindEvents();
    }

    /**
     * Renders the navigation tree into the sidebar.
     */
    private renderTree(): void {
        if (!this.dom.list) return;
        this.dom.list.innerHTML = '';

        // Add Sun manually
        const sunData: NavItem[] = [{ name: 'Sun', type: 'Star', moons: [] }];
        this.buildLevel(this.dom.list, sunData);

        // Add System Data
        if (this.data) {
            const items = this.data.map(body => this.mapToNavItem(body));
            this.buildLevel(this.dom.list, items);
        }
    }

    /**
     * Maps a CelestialBody to a NavItem for rendering.
     */
    private mapToNavItem(body: CelestialBody): NavItem {
        let mappedType = 'Unknown';
        if (body.type === 'planet') mappedType = 'Planet';
        else if (body.type === 'dwarf_planet') mappedType = 'Dwarf Planet';
        else if (body.type === 'moon') mappedType = 'Moon';
        else if (body.type === 'star') mappedType = 'Star';
        else mappedType = body.type;

        return {
            name: body.name,
            type: mappedType,
            moons: body.moons?.map(moon => this.mapToNavItem(moon))
        } as NavItem;
    }

    /**
     * Recursive helper to build a specific level of the navigation tree.
     */
    private buildLevel(container: HTMLElement, items: NavItem[]): void {
        const ul = document.createElement('ul');
        ul.className = 'nav-ul';
        ul.setAttribute('role', 'group');

        items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'nav-li';
            li.setAttribute('role', 'treeitem');
            li.setAttribute('aria-label', item.name);

            const btn = document.createElement('button');
            btn.className = 'nav-btn';

            // Determine Icon
            let icon = '🌑';
            if (item.type === 'Planet') icon = '🪐';
            if (item.type === 'Dwarf Planet') icon = '☄️';
            if (item.type === 'Star') icon = '☀️';

            // Construct Content (Safe DOM creation)
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
                if (window.innerWidth <= 768) this.close();
            });

            li.appendChild(btn);

            // Recursive Step
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
     * Binds internal DOM events.
     */
    private bindEvents(): void {
        this._handleCloseClick = (): void => this.close();
        this._handleOpenClick = (): void => this.open();

        if (this.dom.btnClose) {
            this.dom.btnClose.addEventListener('click', this._handleCloseClick);
        }
        if (this.dom.btnOpen) {
            this.dom.btnOpen.addEventListener('click', this._handleOpenClick);
        }

        if (this.dom.search) {
            this._handleSearchInput = (e: Event): void => {
                const target = e.target as HTMLInputElement;
                this.handleSearch(target.value);
            };
            this.dom.search.addEventListener('input', this._handleSearchInput);
        }
    }

    /**
     * Cleans up event listeners and references.
     */
    dispose(): void {
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
     */
    open(): void {
        if (!this.dom.sidebar) return;

        this._isOpen = true;
        this.dom.sidebar.setAttribute('aria-hidden', 'false');
        this.dom.sidebar.classList.remove('animate-out');
        this.dom.sidebar.classList.add('animate-in');

        if (this.dom.search) {
            setTimeout(() => this.dom.search?.focus(), 50);
        }
    }

    /**
     * Closes the sidebar.
     */
    close(): void {
        if (!this.dom.sidebar) return;

        this._isOpen = false;
        this.dom.sidebar.classList.remove('animate-in');
        this.dom.sidebar.classList.add('animate-out');

        setTimeout(() => {
            if (!this._isOpen && this.dom.sidebar) {
                this.dom.sidebar.setAttribute('aria-hidden', 'true');
                this.dom.sidebar.classList.remove('animate-out');
            }
        }, 400);

        if (this.dom.btnOpen) this.dom.btnOpen.focus();
        if (this.callbacks.onClose) this.callbacks.onClose();
    }

    /**
     * Returns whether the sidebar is currently open.
     */
    isOpen(): boolean {
        return this._isOpen;
    }

    /**
     * Filters the navigation tree based on a search term.
     */
    private handleSearch(term: string): void {
        if (!this.dom.list) return;

        term = term.toLowerCase().trim();
        const items = this.dom.list.querySelectorAll<HTMLElement>('.nav-li');

        if (!term) {
            items.forEach(li => { li.style.display = ''; });
            return;
        }

        // Phase 1: Reset all and mark direct matches
        items.forEach(li => {
            const btn = li.querySelector('.nav-btn');
            const text = btn?.textContent?.toLowerCase() ?? '';
            const isMatch = text.includes(term);

            li.dataset.matches = isMatch ? 'true' : 'false';
            li.style.display = 'none';
        });

        // Phase 2: Walk up the tree to reveal matching paths
        items.forEach(li => {
            if (li.dataset.matches === 'true') {
                li.style.display = '';
                this.revealParentPath(li);
            }
        });
    }

    private revealParentPath(element: HTMLElement): void {
        let parent = element.parentElement;
        while (parent && parent !== this.dom.list) {
            if (parent.classList.contains('nav-sublist')) {
                (parent as HTMLElement).style.display = '';
                const parentLi = parent.parentElement as HTMLElement | null;
                if (parentLi) parentLi.style.display = '';
            }
            parent = parent.parentElement;
        }
    }
}
