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
    sidebar: HTMLElement;
    list: HTMLElement;
    search: HTMLInputElement;
    btnClose: HTMLButtonElement;
    btnOpen: HTMLButtonElement;
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
    private _navItemsCache: { li: HTMLElement; text: string }[] = [];

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
        const sidebar = document.getElementById('nav-sidebar');
        const list = document.getElementById('nav-list');
        const search = document.getElementById('nav-search') as HTMLInputElement | null;
        const btnClose = document.getElementById('btn-close-nav') as HTMLButtonElement | null;
        const btnOpen = document.getElementById('btn-planets') as HTMLButtonElement | null;

        if (!sidebar) throw new Error('NavigationSidebar: #nav-sidebar not found in DOM.');
        if (!list) throw new Error('NavigationSidebar: #nav-list not found in DOM.');
        if (!search) throw new Error('NavigationSidebar: #nav-search not found in DOM.');
        if (!btnClose) throw new Error('NavigationSidebar: #btn-close-nav not found in DOM.');
        if (!btnOpen) throw new Error('NavigationSidebar: #btn-planets not found in DOM.');

        this.dom = {
            sidebar,
            list,
            search,
            btnClose,
            btnOpen
        };

        this.init();
    }

    /**
     * Initializes the component by rendering the tree and binding event listeners.
     */
    private init(): void {
        // Clear skeletons before rendering
        removeSkeletons(this.dom.list);
        this.renderTree();
        this.bindEvents();
        window.addEventListener('keydown', this.handleKeyDown, true); // use capture phase
    }

    /**
     * Renders the navigation tree into the sidebar.
     */
    private renderTree(): void {
        this.dom.list.innerHTML = '';

        // Add Sun manually
        const sunData: NavItem[] = [{ name: 'Sun', type: 'Star', moons: [] }];
        this.buildLevel(this.dom.list, sunData);

        // Add System Data
        if (this.data) {
            const items = this.data.map(body => this.mapToNavItem(body));
            this.buildLevel(this.dom.list, items);
        }

        this.updateCache();
    }

    /**
     * Caches navigation items and their text content for faster searching.
     */
    private updateCache(): void {
        const items = this.dom.list.querySelectorAll<HTMLElement>('.nav-li');
        this._navItemsCache = Array.from(items).map(li => {
            const btn = li.querySelector('.nav-btn');
            return {
                li,
                text: btn?.textContent?.toLowerCase() ?? ''
            };
        });
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

        this.dom.btnClose.addEventListener('click', this._handleCloseClick);
        this.dom.btnOpen.addEventListener('click', this._handleOpenClick);

        this._handleSearchInput = (e: Event): void => {
            const target = e.target as HTMLInputElement;
            this.handleSearch(target.value);
        };
        this.dom.search.addEventListener('input', this._handleSearchInput);
    }

    /**
     * Cleans up event listeners and references.
     */
    dispose(): void {
        if (this._handleCloseClick) {
            this.dom.btnClose.removeEventListener('click', this._handleCloseClick);
        }
        if (this._handleOpenClick) {
            this.dom.btnOpen.removeEventListener('click', this._handleOpenClick);
        }
        if (this._handleSearchInput) {
            this.dom.search.removeEventListener('input', this._handleSearchInput);
        }
        window.removeEventListener('keydown', this.handleKeyDown, true);
    }

    /**
     * Opens the sidebar.
     */
    open(): void {
        this._isOpen = true;
        this.dom.sidebar.setAttribute('aria-hidden', 'false');
        this.dom.sidebar.classList.remove('animate-out');
        this.dom.sidebar.classList.add('animate-in');

        setTimeout(() => this.dom.search.focus(), 50);
    }

    /**
     * Closes the sidebar.
     */
    close(): void {
        this._isOpen = false;
        this.dom.sidebar.classList.remove('animate-in');
        this.dom.sidebar.classList.add('animate-out');

        setTimeout(() => {
            if (!this._isOpen) {
                this.dom.sidebar.setAttribute('aria-hidden', 'true');
                this.dom.sidebar.classList.remove('animate-out');
            }
        }, 400);

        this.dom.btnOpen.focus();
        this.callbacks.onClose?.();
    }

    /**
     * Returns whether the sidebar is currently open.
     */
    isOpen(): boolean {
        return this._isOpen;
    }

    /**
     * Handles keyboard events for the sidebar.
     */
    private handleKeyDown = (e: KeyboardEvent): void => {
        if (this._isOpen && e.key === 'Escape') {
            this.close();
            // Prevent other escape handlers if the sidebar was open and we handled it
            e.stopPropagation();
        }
    };

    /**
     * Filters the navigation tree based on a search term.
     */
    private handleSearch(term: string): void {
        term = term.toLowerCase().trim();

        if (!term) {
            this._navItemsCache.forEach(item => { item.li.style.display = ''; });
            return;
        }

        // Phase 1: Reset all and mark direct matches
        this._navItemsCache.forEach(item => {
            const isMatch = item.text.includes(term);
            item.li.dataset.matches = isMatch ? 'true' : 'false';
            item.li.style.display = 'none';
        });

        // Phase 2: Walk up the tree to reveal matching paths
        this._navItemsCache.forEach(item => {
            if (item.li.dataset.matches === 'true') {
                item.li.style.display = '';
                this.revealParentPath(item.li);
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
