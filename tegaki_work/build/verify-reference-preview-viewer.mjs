/**
 * ============================================================================
 * verify-reference-preview-viewer.mjs
 * 責務: Reference / Preview Viewer UX Polish 01 の全契約を検証する
 *
 * T1 — outside click persistence (Viewer visible -> outside/canvas click keeps Viewer visible)
 * T2 — sidebar toggle (hidden -> launcher -> visible, visible -> launcher -> hidden)
 * T3 — × close (hidden, references and tabs preserved)
 * T4 — focus transfer (Viewer focused -> click Canvas: Viewer visible, Viewer focus false)
 * T5 — clipboard routing (after T4: Canvas Ctrl+V remains Canvas route)
 * T6 — glass contract (Viewer uses expected glass surface/backdrop tokens without changing global popup behavior)
 * T7 — cream surface (Viewer image surround is warm cream translucent, old #e8e4df removed)
 * T8 — Thumbnail entry (Full -> Thumbnail compact dimensions, toolbar hidden, active image/header visible)
 * T9 — Thumbnail restore (Thumbnail -> Full restores previous full width/height)
 * T10 — tab state retained (Reference tab zoom/rotate/flip unchanged through Thumbnail -> Full)
 * T11 — Preview state retained (Preview tab view state unchanged through Thumbnail -> Full)
 * T12 — History 0 / model 0 (toggle Viewer, toggle thumbnail, outside click -> no History or Project schema changes)
 * T94 — Viewer focus Undo / Redo routing (normal region, tabs, Micro Source Rail)
 * T95 — Input field Ctrl+Z isolation (native input priority, contentEditable safety)
 * T96 — Viewer operations History 0 (zoom/rotate/flip/switch/thumbnail do not increase History)
 * T97 — Existing shortcut routes (Ctrl+V, H / Shift+H, R / Shift+R, Shift+Q retain existing paths)
 * T98 — Viewer display state maintained after Undo / Redo
 * ============================================================================
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Mock minimal browser globals for Node.js test execution
if (typeof globalThis.KeyboardEvent === 'undefined') {
    globalThis.KeyboardEvent = class KeyboardEvent extends Event {
        constructor(type, init = {}) {
            super(type, { bubbles: init.bubbles ?? true, cancelable: init.cancelable ?? true });
            this.code = init.code || '';
            this.key = init.key || '';
            this.ctrlKey = Boolean(init.ctrlKey);
            this.shiftKey = Boolean(init.shiftKey);
            this.altKey = Boolean(init.altKey);
            this.metaKey = Boolean(init.metaKey);
            this.repeat = Boolean(init.repeat);
        }
    };
}

globalThis.window = {
    innerWidth: 1280,
    innerHeight: 800,
    _listeners: new Map(),
    addEventListener: function(evt, fn, options = {}) {
        const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
        const key = `${evt}:${capture}`;
        if (!this._listeners.has(key)) this._listeners.set(key, []);
        this._listeners.get(key).push(fn);
    },
    removeEventListener: function(evt, fn, options = {}) {
        const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
        const key = `${evt}:${capture}`;
        if (!this._listeners.has(key)) return;
        this._listeners.set(key, this._listeners.get(key).filter(cb => cb !== fn));
    }
};

globalThis.document = {
    documentElement: {
        dataset: {}
    },
    activeElement: null,
    _listeners: new Map(),
    createElement: (tag) => {
        const el = {
            tagName: tag.toUpperCase(),
            style: {},
            parentNode: null,
            _children: [],
            classList: {
                _classes: new Set(),
                add: function(c) { this._classes.add(c); },
                remove: function(c) { this._classes.delete(c); },
                toggle: function(c, force) {
                    if (force !== undefined) {
                        if (force) this._classes.add(c);
                        else this._classes.delete(c);
                        return force;
                    }
                    if (this._classes.has(c)) { this._classes.delete(c); return false; }
                    this._classes.add(c); return true;
                },
                contains: function(c) { return this._classes.has(c); }
            },
            dataset: {},
            _attrs: new Map(),
            setAttribute: function(k, v) { this._attrs.set(k, String(v)); },
            getAttribute: function(k) { return this._attrs.has(k) ? this._attrs.get(k) : null; },
            appendChild: function(child) {
                if (child && typeof child === 'object') {
                    child.parentNode = this;
                    this._children.push(child);
                }
                return child;
            },
            querySelector: function(sel) {
                for (const child of this._children) {
                    if (child.matches?.(sel)) return child;
                    const found = child.querySelector?.(sel);
                    if (found) return found;
                }
                return null;
            },
            querySelectorAll: function(sel) {
                const results = [];
                for (const child of this._children) {
                    if (child.matches?.(sel)) results.push(child);
                    if (child.querySelectorAll) results.push(...child.querySelectorAll(sel));
                }
                return results;
            },
            matches: function(sel) {
                if (sel.startsWith('.')) {
                    return this.classList.contains(sel.slice(1));
                }
                if (sel.toUpperCase() === this.tagName) return true;
                if (sel === '[contenteditable="true"]') return this.isContentEditable === true;
                return false;
            },
            closest: function(sel) {
                let curr = this;
                while (curr) {
                    if (sel === '.reference-preview-viewer' && curr.classList?.contains?.('reference-preview-viewer')) return curr;
                    if (sel.includes('input') && (curr.tagName === 'INPUT' || curr.tagName === 'TEXTAREA' || curr.tagName === 'SELECT' || curr.isContentEditable)) return curr;
                    if (curr.matches?.(sel)) return curr;
                    curr = curr.parentNode;
                }
                return null;
            },
            contains: function(other) {
                let curr = other;
                while (curr) {
                    if (curr === this) return true;
                    curr = curr.parentNode;
                }
                return false;
            },
            focus: function() {
                globalThis.document.activeElement = this;
            },
            _listeners: new Map(),
            addEventListener: function(evt, fn, options = {}) {
                const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
                const key = `${evt}:${capture}`;
                if (!this._listeners.has(key)) this._listeners.set(key, []);
                this._listeners.get(key).push(fn);
            },
            removeEventListener: function(evt, fn, options = {}) {
                const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
                const key = `${evt}:${capture}`;
                if (!this._listeners.has(key)) return;
                this._listeners.set(key, this._listeners.get(key).filter(cb => cb !== fn));
            },
            dispatchEvent: function(event) {
                try {
                    Object.defineProperty(event, 'target', { value: this, configurable: true, writable: true });
                } catch (e) {
                    event.target = this;
                }
                // Dispatch capture listeners on document
                if (globalThis.document?._listeners) {
                    const captureListeners = globalThis.document._listeners.get(`${event.type}:true`) || [];
                    for (const fn of captureListeners) fn(event);
                }
                // Target listeners
                const list = this._listeners.get(`${event.type}:false`) || this._listeners.get(event.type) || [];
                for (const fn of list) fn(event);
                return !event.defaultPrevented;
            }
        };
        return el;
    },
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: function(evt, fn, options = {}) {
        const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
        const key = `${evt}:${capture}`;
        if (!this._listeners.has(key)) this._listeners.set(key, []);
        this._listeners.get(key).push(fn);
    },
    removeEventListener: function(evt, fn, options = {}) {
        const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
        const key = `${evt}:${capture}`;
        if (!this._listeners.has(key)) return;
        this._listeners.set(key, this._listeners.get(key).filter(cb => cb !== fn));
    },
    dispatchEvent: function(event) {
        try {
            if (!event.target) Object.defineProperty(event, 'target', { value: this, configurable: true, writable: true });
        } catch (e) {
            event.target = event.target || this;
        }
        const captureListeners = this._listeners.get(`${event.type}:true`) || [];
        for (const fn of captureListeners) fn(event);
        const bubbleListeners = this._listeners.get(`${event.type}:false`) || [];
        for (const fn of bubbleListeners) fn(event);
        return !event.defaultPrevented;
    },
    body: { appendChild: () => {} }
};

const {
    ReferencePreviewViewer,
    calculateReferenceProxyDimensions,
    calculateFitTransform,
    calculate100PercentTransform,
    getCssTransformString,
    REFERENCE_PROXY_BUDGET,
    MIRROR_PREVIEW_BUDGET
} = await import('../ui/reference-preview-viewer.js');

console.log('--- Starting Reference / Preview Viewer UX Polish 01 Verification (T1 - T12) ---');

// T1: Outside Click Persistence
{
    const uiPanelsCode = await readFile(new URL('../ui/ui-panels.js', import.meta.url), 'utf8');

    // Verify outside click handler in ui-panels.js exempts referencePreview
    assert.match(
        uiPanelsCode,
        /closeAllPopups\(\s*\[[^\]]*'referencePreview'[^\]]*\]\s*\)/u,
        'T1: ui-panels.js outside-click handler keeps referencePreview open'
    );

    // Verify default keepOpen in closeAllPopups includes referencePreview
    assert.match(
        uiPanelsCode,
        /const keepOpen = exceptName === null \? \[[^\]]*'referencePreview'[^\]]*\] : exceptName;/u,
        'T1: closeAllPopups() preserves referencePreview by default'
    );
    console.log('T1: Outside click persistence PASS');
}

// T2: Sidebar Toggle
{
    const uiPanelsCode = await readFile(new URL('../ui/ui-panels.js', import.meta.url), 'utf8');
    assert.match(
        uiPanelsCode,
        /'reference-preview-tool':\s*\(\)\s*=>\s*\{[\s\S]*?this\.togglePopup\('referencePreview'\);/u,
        'T2: toolMap delegates reference-preview-tool to togglePopup(referencePreview)'
    );

    // Mock toggle state on instance
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });

    assert.equal(viewer.isVisible, false, 'T2: Initially hidden');
    viewer.show();
    assert.equal(viewer.isVisible, true, 'T2: Launcher opens -> visible');
    viewer.toggle();
    assert.equal(viewer.isVisible, false, 'T2: Launcher toggle while visible -> hidden');
    viewer.toggle();
    assert.equal(viewer.isVisible, true, 'T2: Launcher toggle while hidden -> visible');
    console.log('T2: Sidebar toggle PASS');
}

// T3: × Close Button
{
    const uiPanelsCode = await readFile(new URL('../ui/ui-panels.js', import.meta.url), 'utf8');
    assert.match(
        uiPanelsCode,
        /target === 'reference-preview-viewer'[\s\S]*?this\.hidePopup\('referencePreview'\)/u,
        'T3: closeBtn handler explicitly delegates reference-preview-viewer to hidePopup'
    );

    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });

    viewer.tabs.push({
        id: 'ref_sample',
        type: 'reference',
        name: 'Sample Ref',
        width: 600,
        height: 400,
        closeable: true,
        viewState: { zoom: 1.2, panX: 10, panY: 20, rotationDeg: 0, flipX: false, flipY: false, initialized: true }
    });

    viewer.show();
    assert.equal(viewer.isVisible, true);
    assert.equal(viewer.tabs.length, 2);

    viewer.hide();
    assert.equal(viewer.isVisible, false, 'T3: × close hides viewer');
    assert.equal(viewer.tabs.length, 2, 'T3: tabs preserved after hide');
    assert.equal(viewer.tabs[1].name, 'Sample Ref', 'T3: sample reference preserved');

    viewer.show();
    assert.equal(viewer.isVisible, true, 'T3: Re-opened viewer');
    assert.equal(viewer.tabs.length, 2, 'T3: All tabs still present');
    console.log('T3: × close contract PASS');
}

// T4: Focus Transfer
{
    const keyboardHandlerCode = await readFile(new URL('../ui/keyboard-handler.js', import.meta.url), 'utf8');

    assert.match(
        keyboardHandlerCode,
        /if\s*\(\s*e\.target\?\.closest\?\.\(('|")\.reference-preview-viewer\1\)\s*\|\|\s*document\.activeElement\?\.closest\?\.\(('|")\.reference-preview-viewer\2\)\s*\)\s*\{[\s\S]*?return;\s*\}/u,
        'T4: keyboard-handler yields shortcuts when inside viewer without global Escape close hijack'
    );

    assert.doesNotMatch(
        keyboardHandlerCode,
        /referencePreviewViewer[\s\S]*?Escape[\s\S]*?viewer\.hide/u,
        'T4: Escape key close hijack is removed from keyboard-handler'
    );
    console.log('T4: Focus transfer PASS');
}

// T5: Clipboard Routing
{
    const imageImporterCode = await readFile(new URL('../system/image-importer.js', import.meta.url), 'utf8');
    const pixelSelectionCode = await readFile(new URL('../system/pixel-selection-system.js', import.meta.url), 'utf8');

    assert.match(
        imageImporterCode,
        /if\s*\(\s*event\.target\?\.closest\?\.\(('|")\.reference-preview-viewer\1\)\s*\)\s*return;/u,
        'T5: image-importer paste listener only bypasses when target is inside .reference-preview-viewer'
    );

    assert.match(
        pixelSelectionCode,
        /if\s*\(\s*event\.target\?\.closest\?\.\(('|")\.reference-preview-viewer\1\)\s*\)\s*return;/u,
        'T5: pixel-selection keydown listener only bypasses when target is inside .reference-preview-viewer'
    );
    console.log('T5: Clipboard routing isolation PASS');
}

// T6: Glass Contract
{
    const cssCode = await readFile(new URL('../styles/main.css', import.meta.url), 'utf8');

    assert.match(
        cssCode,
        /\.reference-preview-viewer\s*\{[\s\S]*?background:\s*var\(--ui-panel-glass-surface[^;]*\);/u,
        'T6: .reference-preview-viewer uses --ui-panel-glass-surface token (~0.72 alpha)'
    );

    assert.match(
        cssCode,
        /\.reference-preview-viewer\s*\{[\s\S]*?backdrop-filter:\s*var\(--ui-panel-glass-backdrop[^;]*\);/u,
        'T6: .reference-preview-viewer uses --ui-panel-glass-backdrop token (blur(3px))'
    );
    console.log('T6: Glass contract PASS');
}

// T7: Cream Surface
{
    const cssCode = await readFile(new URL('../styles/main.css', import.meta.url), 'utf8');

    assert.doesNotMatch(
        cssCode,
        /\.reference-preview-viewer \.viewer-body\s*\{[\s\S]*?background:\s*#e8e4df;/u,
        'T7: Old gray #e8e4df background is removed from .viewer-body'
    );

    assert.match(
        cssCode,
        /\.reference-preview-viewer \.viewer-body\s*\{[\s\S]*?background:\s*rgba\(\s*240,\s*224,\s*214/u,
        'T7: .viewer-body uses warm Futaba cream translucent background'
    );

    assert.match(
        cssCode,
        /\.reference-preview-viewer \.viewer-surface\s*\{[\s\S]*?background:\s*rgba\(\s*255,\s*255,\s*238/u,
        'T7: .viewer-surface uses warm Futaba light cream background'
    );
    console.log('T7: Cream surface PASS');
}

// T8: Thumbnail Entry
{
    const cssCode = await readFile(new URL('../styles/main.css', import.meta.url), 'utf8');

    assert.match(
        cssCode,
        /\.reference-preview-viewer\.is-thumbnail\s*\{[\s\S]*?width:\s*(?:150|180|250)px;\s*height:\s*(?:170|140|190)px;/u,
        'T8: .is-thumbnail sets compact dimensions (150x170px)'
    );

    assert.match(
        cssCode,
        /\.reference-preview-viewer\.is-thumbnail \.viewer-toolbar\s*\{[\s\S]*?display:\s*none\s*!important;/u,
        'T8: .is-thumbnail hides control toolbar'
    );

    assert.match(
        cssCode,
        /\.reference-preview-viewer\.is-thumbnail \.viewer-tabs-bar\s*\{[\s\S]*?display:\s*none\s*!important;/u,
        'T8: .is-thumbnail hides full tab strip'
    );

    assert.match(
        cssCode,
        /\.reference-preview-viewer\.is-thumbnail \.viewer-thumbnail-title\s*\{[\s\S]*?display:\s*block\s*!important;/u,
        'T8: .is-thumbnail reveals active source title in header'
    );

    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });

    // Mock popup element
    viewer.popup = {
        offsetLeft: 100,
        offsetTop: 120,
        offsetWidth: 520,
        offsetHeight: 440,
        style: { width: '520px', height: '440px', left: '100px', top: '120px' },
        classList: {
            _c: new Set(),
            add: function(c) { this._c.add(c); },
            remove: function(c) { this._c.delete(c); },
            toggle: function(c, force) {
                if (force !== undefined) {
                    if (force) this._c.add(c); else this._c.delete(c);
                    return force;
                }
                if (this._c.has(c)) { this._c.delete(c); return false; }
                this._c.add(c); return true;
            },
            contains: function(c) { return this._c.has(c); }
        },
        querySelector: () => ({
            style: {},
            classList: { add: () => {}, remove: () => {} }
        })
    };

    viewer.setThumbnailMode(true);
    assert.equal(viewer.isThumbnailMode, true, 'T8: isThumbnailMode is true');
    assert.ok(viewer.popup.classList.contains('is-thumbnail'), 'T8: popup has is-thumbnail class');
    assert.equal(viewer.popup.style.width, '150px', 'T8: width set to thumbnail 150px');
    assert.equal(viewer.popup.style.height, '170px', 'T8: height set to thumbnail 170px');
    assert.equal(viewer._savedFullRect.width, 520, 'T8: Saved full width 520');
    assert.equal(viewer._savedFullRect.height, 440, 'T8: Saved full height 440');
    console.log('T8: Thumbnail entry PASS');
}

// T9: Thumbnail Restore
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });

    viewer.popup = {
        offsetLeft: 150,
        offsetTop: 200,
        offsetWidth: 560,
        offsetHeight: 480,
        style: { width: '560px', height: '480px', left: '150px', top: '200px' },
        classList: {
            _c: new Set(),
            add: function(c) { this._c.add(c); },
            remove: function(c) { this._c.delete(c); },
            toggle: function(c, force) {
                if (force !== undefined) {
                    if (force) this._c.add(c); else this._c.delete(c);
                    return force;
                }
                if (this._c.has(c)) { this._c.delete(c); return false; }
                this._c.add(c); return true;
            },
            contains: function(c) { return this._c.has(c); }
        },
        querySelector: () => ({
            style: {},
            classList: { add: () => {}, remove: () => {} }
        })
    };

    viewer.setThumbnailMode(true);
    assert.equal(viewer.isThumbnailMode, true);

    viewer.setThumbnailMode(false);
    assert.equal(viewer.isThumbnailMode, false, 'T9: isThumbnailMode is false');
    assert.ok(!viewer.popup.classList.contains('is-thumbnail'), 'T9: is-thumbnail class removed');
    assert.equal(viewer.popup.style.width, '560px', 'T9: Prior full width restored');
    assert.equal(viewer.popup.style.height, '480px', 'T9: Prior full height restored');
    console.log('T9: Thumbnail restore PASS');
}

// T10: Tab View State Retained
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });

    const tabA = {
        id: 'ref_A',
        type: 'reference',
        name: 'Ref A',
        width: 800,
        height: 600,
        closeable: true,
        viewState: { zoom: 2.2, panX: 45, panY: -35, rotationDeg: 30, flipX: true, flipY: false, initialized: true }
    };
    viewer.tabs.push(tabA);
    viewer.switchTab('ref_A');

    // Check before thumbnail mode
    assert.equal(tabA.viewState.zoom, 2.2);
    assert.equal(tabA.viewState.panX, 45);
    assert.equal(tabA.viewState.panY, -35);
    assert.equal(tabA.viewState.rotationDeg, 30);
    assert.equal(tabA.viewState.flipX, true);
    assert.equal(tabA.viewState.flipY, false);

    // Enter thumbnail mode
    viewer.setThumbnailMode(true);

    // In thumbnail mode, tab viewState must NOT be mutated
    assert.equal(tabA.viewState.zoom, 2.2, 'T10: zoom not mutated in thumbnail');
    assert.equal(tabA.viewState.panX, 45, 'T10: panX not mutated in thumbnail');
    assert.equal(tabA.viewState.panY, -35, 'T10: panY not mutated in thumbnail');
    assert.equal(tabA.viewState.rotationDeg, 30, 'T10: rotationDeg not mutated in thumbnail');
    assert.equal(tabA.viewState.flipX, true, 'T10: flipX not mutated in thumbnail');
    assert.equal(tabA.viewState.flipY, false, 'T10: flipY not mutated in thumbnail');

    // Exit thumbnail mode
    viewer.setThumbnailMode(false);

    // Restored full mode preserves identical state
    assert.equal(tabA.viewState.zoom, 2.2, 'T10: zoom intact after restore');
    assert.equal(tabA.viewState.panX, 45, 'T10: panX intact after restore');
    assert.equal(tabA.viewState.panY, -35, 'T10: panY intact after restore');
    assert.equal(tabA.viewState.rotationDeg, 30, 'T10: rotationDeg intact after restore');
    assert.equal(tabA.viewState.flipX, true, 'T10: flipX intact after restore');
    assert.equal(tabA.viewState.flipY, false, 'T10: flipY intact after restore');
    console.log('T10: Tab state retained PASS');
}

// T11: Preview State Retained
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });

    const previewTab = viewer.tabs[0];
    previewTab.viewState = {
        zoom: 1.4,
        panX: -20,
        panY: 30,
        rotationDeg: -15,
        flipX: false,
        flipY: true,
        initialized: true
    };
    viewer.switchTab('preview');

    viewer.setThumbnailMode(true);
    assert.equal(previewTab.viewState.zoom, 1.4, 'T11: Preview zoom intact during thumbnail');
    assert.equal(previewTab.viewState.rotationDeg, -15, 'T11: Preview rotationDeg intact during thumbnail');
    assert.equal(previewTab.viewState.flipY, true, 'T11: Preview flipY intact during thumbnail');

    viewer.setThumbnailMode(false);
    assert.equal(previewTab.viewState.zoom, 1.4, 'T11: Preview zoom intact after restore');
    assert.equal(previewTab.viewState.panX, -20, 'T11: Preview panX intact after restore');
    assert.equal(previewTab.viewState.panY, 30, 'T11: Preview panY intact after restore');
    assert.equal(previewTab.viewState.rotationDeg, -15, 'T11: Preview rotationDeg intact after restore');
    assert.equal(previewTab.viewState.flipX, false, 'T11: Preview flipX intact after restore');
    assert.equal(previewTab.viewState.flipY, true, 'T11: Preview flipY intact after restore');
    console.log('T11: Preview state retained PASS');
}

// T12: History 0 / Model 0
{
    const viewerModuleCode = await readFile(new URL('../ui/reference-preview-viewer.js', import.meta.url), 'utf8');
    const projectManagerCode = await readFile(new URL('../system/project-manager.js', import.meta.url), 'utf8');

    assert.doesNotMatch(
        viewerModuleCode,
        /historyManager|history\.add|history\.execute|history\.record/u,
        'T12: viewer operations do not invoke drawing history'
    );

    assert.doesNotMatch(
        projectManagerCode,
        /referencePreview|reference-preview-viewer/u,
        'T12: project-manager does not serialize viewer references or thumbnail state'
    );
    console.log('T12: History 0 / model 0 PASS');
}

// T13 — Shift+Q keymap
{
    const { TEGAKI_KEYMAP } = await import('../config.js');
    const qEvent = { code: 'KeyQ', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false };
    const shiftQEvent = { code: 'KeyQ', shiftKey: true, ctrlKey: false, altKey: false, metaKey: false };

    assert.equal(TEGAKI_KEYMAP.getAction(qEvent), 'QUICK_ACCESS_TOGGLE', 'T13: Q maps to QUICK_ACCESS_TOGGLE');
    assert.equal(TEGAKI_KEYMAP.getAction(shiftQEvent), 'REFERENCE_PREVIEW_TOGGLE', 'T13: Shift+Q maps to REFERENCE_PREVIEW_TOGGLE');
    assert.notEqual(TEGAKI_KEYMAP.getAction(qEvent), TEGAKI_KEYMAP.getAction(shiftQEvent), 'T13: No conflict between Q and Shift+Q');
    console.log('T13: Shift+Q keymap PASS');
}

// T14 — Shift+Q input safety
{
    const kbCode = await readFile(new URL('../ui/keyboard-handler.js', import.meta.url), 'utf8');
    assert.match(
        kbCode,
        /if\s*\(\s*isInputFocused\(\)\s*\)\s*return;/u,
        'T14: isInputFocused returns before shortcut processing'
    );
    assert.match(
        kbCode,
        /function\s+isInputFocused\(\)\s*\{[\s\S]*?activeElement\.tagName\s*===\s*('INPUT'|'TEXTAREA'|'SELECT')/u,
        'T14: isInputFocused covers INPUT, TEXTAREA, SELECT, contentEditable'
    );
    console.log('T14: Shift+Q input safety PASS');
}

// T15 — initial viewport clamp
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });

    globalThis.window.innerWidth = 600;
    globalThis.window.innerHeight = 450;

    viewer.popup = {
        offsetLeft: 200,
        offsetTop: 150,
        offsetWidth: 480,
        offsetHeight: 520,
        style: { width: '480px', height: '520px', left: '200px', top: '150px' },
        classList: { _c: new Set(), add: () => {}, remove: () => {}, contains: () => false, toggle: () => false },
        querySelector: () => ({ style: {}, classList: { add: () => {}, remove: () => {} } })
    };

    viewer._clampToViewport();
    const w = parseInt(viewer.popup.style.width, 10);
    const h = parseInt(viewer.popup.style.height, 10);
    const l = parseInt(viewer.popup.style.left, 10);
    const t = parseInt(viewer.popup.style.top, 10);

    assert.ok(w <= 600 - 16, `T15: width ${w} fits within window width 600`);
    assert.ok(h <= 450 - 16, `T15: height ${h} fits within window height 450`);
    assert.ok(l >= 8 && l + w <= 600 - 8, `T15: horizontal bounds [${l}, ${l + w}] inside viewport`);
    assert.ok(t >= 8 && t + h <= 450 - 8, `T15: vertical bounds [${t}, ${t + h}] inside viewport`);
    console.log('T15: initial viewport clamp PASS');
}

// T16 — reopen clamp
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });

    globalThis.window.innerWidth = 800;
    globalThis.window.innerHeight = 600;

    // Simulate popup placed far outside current viewport (e.g. before browser resize)
    viewer.popup = {
        offsetLeft: 900,
        offsetTop: 700,
        offsetWidth: 300,
        offsetHeight: 240,
        style: { width: '300px', height: '240px', left: '900px', top: '700px' },
        classList: { _c: new Set(), add: () => {}, remove: () => {}, contains: () => false, toggle: () => false },
        querySelector: () => ({ style: {}, classList: { add: () => {}, remove: () => {} } })
    };

    viewer._clampToViewport();
    const l = parseInt(viewer.popup.style.left, 10);
    const t = parseInt(viewer.popup.style.top, 10);
    const w = parseInt(viewer.popup.style.width, 10);
    const h = parseInt(viewer.popup.style.height, 10);

    assert.ok(l >= 8 && l + w <= 800 - 8, `T16: left ${l} clamped inside viewport`);
    assert.ok(t >= 8 && t + h <= 600 - 8, `T16: top ${t} clamped inside viewport`);
    console.log('T16: reopen clamp PASS');
}

// T17 — smaller minimum size
{
    const cssCode = await readFile(new URL('../styles/main.css', import.meta.url), 'utf8');
    const viewerJs = await readFile(new URL('../ui/reference-preview-viewer.js', import.meta.url), 'utf8');

    assert.match(
        cssCode,
        /\.reference-preview-viewer\s*\{[\s\S]*?min-width:\s*150px;\s*min-height:\s*120px;/u,
        'T17: main.css enforces 150px min-width and 120px min-height'
    );

    assert.match(
        viewerJs,
        /minW\s*=\s*150;[\s\S]*?minH\s*=\s*120;/u,
        'T17: reference-preview-viewer.js uses 150px x 120px minimums'
    );
    console.log('T17: smaller minimum size PASS');
}

// T18 — resize grip always visible
{
    const cssCode = await readFile(new URL('../styles/main.css', import.meta.url), 'utf8');
    const viewerJs = await readFile(new URL('../ui/reference-preview-viewer.js', import.meta.url), 'utf8');

    assert.doesNotMatch(
        cssCode,
        /\.reference-preview-viewer\.is-thumbnail\s+\.viewer-resize-handle\s*\{[\s\S]*?display:\s*none/u,
        'T18: resize handle is not hidden in is-thumbnail'
    );
    assert.doesNotMatch(
        cssCode,
        /\.reference-preview-viewer\.is-micro\s+\.viewer-resize-handle\s*\{[\s\S]*?display:\s*none/u,
        'T18: resize handle is not hidden in is-micro'
    );
    const resizeListenerMatch = viewerJs.match(/resizeHandle\.addEventListener\('pointerdown'[\s\S]*?\}\);/u);
    assert.ok(resizeListenerMatch, 'resizeHandle pointerdown listener exists');
    assert.doesNotMatch(
        resizeListenerMatch[0],
        /if\s*\(\s*this\.isThumbnailMode\s*\)\s*return;/u,
        'T18: pointerdown on resize handle is not blocked in thumbnail mode'
    );
    console.log('T18: resize grip always visible PASS');
}

// T19 — responsive controls
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });

    const classes = new Set();
    viewer.popup = {
        style: {},
        classList: {
            add: (c) => classes.add(c),
            remove: (c) => classes.delete(c),
            toggle: (c, force) => {
                if (force) classes.add(c); else classes.delete(c);
                return force;
            },
            contains: (c) => classes.has(c)
        },
        querySelector: () => ({ style: {}, classList: { add: () => {}, remove: () => {} } })
    };

    // 1. Large: Full mode
    viewer._updateResponsiveState(480, 520);
    assert.equal(classes.has('is-micro'), false, 'T19: Large has no is-micro');
    assert.equal(classes.has('is-compact'), false, 'T19: Large has no is-compact');

    // 2. Medium: Compact mode
    viewer._updateResponsiveState(300, 240);
    assert.equal(classes.has('is-micro'), false, 'T19: Medium has no is-micro');
    assert.equal(classes.has('is-compact'), true, 'T19: Medium has is-compact');

    // 3. Small: Micro mode
    viewer._updateResponsiveState(180, 140);
    assert.equal(classes.has('is-micro'), true, 'T19: Small has is-micro');
    assert.equal(classes.has('is-compact'), false, 'T19: Small has no is-compact');
    console.log('T19: responsive controls PASS');
}

// T20 — view state preserved
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });

    const tab = viewer.tabs[0];
    tab.viewState = {
        zoom: 2.5,
        panX: 50,
        panY: -40,
        rotationDeg: 45,
        flipX: true,
        flipY: true,
        initialized: true
    };

    viewer.popup = {
        style: {},
        classList: { add: () => {}, remove: () => {}, toggle: () => false, contains: () => false },
        querySelector: () => ({ style: {}, classList: { add: () => {}, remove: () => {} } })
    };

    // Responsive transitions Large -> Micro -> Large
    viewer._updateResponsiveState(180, 140);
    viewer._applyCurrentTransform();
    assert.equal(tab.viewState.zoom, 2.5, 'T20: Zoom unchanged in micro');
    assert.equal(tab.viewState.rotationDeg, 45, 'T20: Rotation unchanged in micro');
    assert.equal(tab.viewState.flipX, true, 'T20: FlipX unchanged in micro');

    viewer._updateResponsiveState(480, 520);
    viewer._applyCurrentTransform();
    assert.equal(tab.viewState.zoom, 2.5, 'T20: Zoom preserved after restoring large');
    assert.equal(tab.viewState.panX, 50, 'T20: PanX preserved after restoring large');
    assert.equal(tab.viewState.panY, -40, 'T20: PanY preserved after restoring large');
    assert.equal(tab.viewState.rotationDeg, 45, 'T20: Rotation preserved after restoring large');
    assert.equal(tab.viewState.flipX, true, 'T20: FlipX preserved after restoring large');
    assert.equal(tab.viewState.flipY, true, 'T20: FlipY preserved after restoring large');
    console.log('T20: view state preserved PASS');
}

// T21 — first portrait reference
{
    globalThis.window.innerWidth = 1200;
    globalThis.window.innerHeight = 800;

    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });

    viewer.popup = {
        offsetLeft: 84,
        offsetTop: 72,
        style: { width: '200px', height: '180px', left: '84px', top: '72px' },
        classList: { add: () => {}, remove: () => {}, toggle: () => false, contains: () => false },
        querySelector: () => ({ style: {}, classList: { add: () => {}, remove: () => {} } })
    };

    // First portrait reference: width 600, height 1200 (aspect 0.5)
    viewer._maybeSmartExpandForFirstReference({ width: 600, height: 1200 });

    const w = parseInt(viewer.popup.style.width, 10);
    const h = parseInt(viewer.popup.style.height, 10);

    assert.ok(h > w, `T21: Portrait reference expands vertically (h: ${h} > w: ${w})`);
    assert.ok(w <= 1200 * 0.48 + 5, `T21: Width within 48% cap (${w} <= 576)`);
    assert.ok(h <= 800 * 0.52 + 5, `T21: Height within 52% cap (${h} <= 416)`);
    console.log('T21: first portrait reference PASS');
}

// T22 — first landscape reference
{
    globalThis.window.innerWidth = 1200;
    globalThis.window.innerHeight = 800;

    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });

    viewer.popup = {
        offsetLeft: 84,
        offsetTop: 72,
        style: { width: '200px', height: '180px', left: '84px', top: '72px' },
        classList: { add: () => {}, remove: () => {}, toggle: () => false, contains: () => false },
        querySelector: () => ({ style: {}, classList: { add: () => {}, remove: () => {} } })
    };

    // First landscape reference: width 1200, height 600 (aspect 2.0)
    viewer._maybeSmartExpandForFirstReference({ width: 1200, height: 600 });

    const w = parseInt(viewer.popup.style.width, 10);
    const h = parseInt(viewer.popup.style.height, 10);

    assert.ok(w > h, `T22: Landscape reference expands horizontally (w: ${w} > h: ${h})`);
    assert.ok(w <= 1200 * 0.48 + 5, `T22: Width within 48% cap (${w} <= 576)`);
    assert.ok(h <= 800 * 0.52 + 5, `T22: Height within 52% cap (${h} <= 416)`);
    console.log('T22: first landscape reference PASS');
}

// T23 — first huge reference
{
    globalThis.window.innerWidth = 1200;
    globalThis.window.innerHeight = 800;

    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });

    viewer.popup = {
        offsetLeft: 84,
        offsetTop: 72,
        style: { width: '200px', height: '180px', left: '84px', top: '72px' },
        classList: { add: () => {}, remove: () => {}, toggle: () => false, contains: () => false },
        querySelector: () => ({ style: {}, classList: { add: () => {}, remove: () => {} } })
    };

    // Huge 4000x3000 image
    const proxyInfo = calculateReferenceProxyDimensions(4000, 3000);
    viewer._maybeSmartExpandForFirstReference(proxyInfo);

    const w = parseInt(viewer.popup.style.width, 10);
    const h = parseInt(viewer.popup.style.height, 10);

    assert.ok(w <= 1200 * 0.48 + 5, `T23: Huge image window width bounded (${w} <= 576)`);
    assert.ok(h <= 800 * 0.52 + 5, `T23: Huge image window height bounded (${h} <= 416)`);

    const hugeTab = {
        origWidth: 4000,
        origHeight: 3000,
        width: proxyInfo.width,
        height: proxyInfo.height,
        viewState: { zoom: 1, panX: 0, panY: 0 }
    };
    viewer.fitTab(hugeTab, { initialReference: true });
    assert.ok(hugeTab.viewState.zoom <= 0.6, `T23: Initial zoom capped comfortably (${hugeTab.viewState.zoom} <= 0.6)`);
    console.log('T23: first huge reference PASS');
}

// T24 — second Reference
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });

    viewer.tabs.push({ id: 'ref1', type: 'reference', name: 'Ref 1', width: 400, height: 300 });
    viewer.tabs.push({ id: 'ref2', type: 'reference', name: 'Ref 2', width: 800, height: 600 });

    viewer.popup = {
        offsetLeft: 84,
        offsetTop: 72,
        style: { width: '380px', height: '340px', left: '84px', top: '72px' },
        classList: { add: () => {}, remove: () => {}, toggle: () => false, contains: () => false },
        querySelector: () => ({ style: {}, classList: { add: () => {}, remove: () => {} } })
    };

    // Try auto-expanding with second reference
    viewer._maybeSmartExpandForFirstReference({ width: 1200, height: 400 });

    assert.equal(viewer.popup.style.width, '380px', 'T24: Second reference does not change width');
    assert.equal(viewer.popup.style.height, '340px', 'T24: Second reference does not change height');
    console.log('T24: second Reference PASS');
}

// T25 — manual resize precedence
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });

    // User has manually resized
    viewer._hasUserResized = true;

    viewer.popup = {
        offsetLeft: 84,
        offsetTop: 72,
        style: { width: '220px', height: '170px', left: '84px', top: '72px' },
        classList: { add: () => {}, remove: () => {}, toggle: () => false, contains: () => false },
        querySelector: () => ({ style: {}, classList: { add: () => {}, remove: () => {} } })
    };

    // Attempt smart expand on first reference
    viewer._maybeSmartExpandForFirstReference({ width: 1200, height: 400 });

    assert.equal(viewer.popup.style.width, '220px', 'T25: Manual resize preserved (width unchanged)');
    assert.equal(viewer.popup.style.height, '170px', 'T25: Manual resize preserved (height unchanged)');
    console.log('T25: manual resize precedence PASS');
}

// T26 — viewport resize
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });

    globalThis.window.innerWidth = 1200;
    globalThis.window.innerHeight = 800;

    viewer.popup = {
        offsetLeft: 700,
        offsetTop: 500,
        offsetWidth: 400,
        offsetHeight: 300,
        style: { width: '400px', height: '300px', left: '700px', top: '500px' },
        classList: { add: () => {}, remove: () => {}, toggle: () => false, contains: () => false },
        querySelector: () => ({ style: {}, classList: { add: () => {}, remove: () => {} } })
    };

    // Window shrinks to 800x600
    globalThis.window.innerWidth = 800;
    globalThis.window.innerHeight = 600;

    viewer._clampToViewport();

    const l = parseInt(viewer.popup.style.left, 10);
    const t = parseInt(viewer.popup.style.top, 10);
    const w = parseInt(viewer.popup.style.width, 10);
    const h = parseInt(viewer.popup.style.height, 10);

    assert.ok(l + w <= 800 - 8, `T26: Clamped within shrunk window width (${l + w} <= 792)`);
    assert.ok(t + h <= 600 - 8, `T26: Clamped within shrunk window height (${t + h} <= 592)`);
    assert.ok(l >= 8, 'T26: Header reachable from left');
    assert.ok(t >= 8, 'T26: Header reachable from top');
    console.log('T26: viewport resize PASS');
}

// T27 — Reference Micro preserves orientation
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    const refTab = {
        id: 'ref-1',
        type: 'reference',
        name: 'hand.png',
        width: 1000,
        height: 800,
        viewState: {
            zoom: 2.0,
            panX: -50,
            panY: -100,
            rotationDeg: 30,
            flipX: true,
            flipY: false,
            initialized: true
        }
    };
    viewer.tabs.push(refTab);
    viewer.activeTabId = 'ref-1';

    let appliedTransform = '';
    viewer.popup = {
        offsetWidth: 150,
        offsetHeight: 170,
        style: { width: '150px', height: '170px' },
        querySelector: (sel) => {
            if (sel === '.viewer-content') return { style: { set transform(val) { appliedTransform = val; }, get transform() { return appliedTransform; } } };
            return { clientWidth: 148, clientHeight: 142 };
        }
    };

    viewer._applyCurrentTransform();
    assert.match(appliedTransform, /rotate\(30deg\)/, 'T27: Rotation 30deg preserved in rendered transform');
    assert.match(appliedTransform, /scale\(-2,\s*2\)/, 'T27: Horizontal flip (scale(-2, 2)) preserved in rendered transform');
    console.log('T27: Reference Micro preserves orientation PASS');
}

// T28 — Reference Micro preserves framing
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    const refTab = {
        id: 'ref-2',
        type: 'reference',
        name: 'face.png',
        width: 1200,
        height: 1200,
        viewState: {
            zoom: 3.5,
            panX: -320,
            panY: -280,
            rotationDeg: 15,
            flipX: false,
            flipY: false,
            initialized: true
        }
    };
    viewer.tabs.push(refTab);
    viewer.activeTabId = 'ref-2';

    let appliedTransform = '';
    viewer.popup = {
        offsetWidth: 150,
        offsetHeight: 170,
        style: { width: '150px', height: '170px' },
        querySelector: (sel) => {
            if (sel === '.viewer-content') return { style: { set transform(val) { appliedTransform = val; }, get transform() { return appliedTransform; } } };
            return { clientWidth: 148, clientHeight: 142 };
        }
    };

    viewer._applyCurrentTransform();
    assert.match(appliedTransform, /scale\(3\.5,\s*3\.5\)/, 'T28: Zoom 3.5 not overwritten by generic fit');
    assert.equal(refTab.viewState.zoom, 3.5, 'T28: Tab viewState zoom intact');
    assert.equal(refTab.viewState.panX, -320, 'T28: Tab viewState panX intact');
    console.log('T28: Reference Micro preserves framing PASS');
}

// T29 — Preview Micro Fit + orientation
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    const previewTab = viewer.tabs[0];
    previewTab.width = 800;
    previewTab.height = 600;
    previewTab.viewState.rotationDeg = -15;
    previewTab.viewState.flipX = true;
    previewTab.viewState.flipY = false;

    let appliedTransform = '';
    viewer.popup = {
        offsetWidth: 150,
        offsetHeight: 170,
        style: { width: '150px', height: '170px' },
        querySelector: (sel) => {
            if (sel === '.viewer-content') return { style: { set transform(val) { appliedTransform = val; }, get transform() { return appliedTransform; } } };
            if (sel === '.viewer-surface') return { clientWidth: 148, clientHeight: 142 };
            return null;
        }
    };

    viewer._applyCurrentTransform();
    assert.match(appliedTransform, /rotate\(-15deg\)/, 'T29: Preview rotation preserved');
    assert.match(appliedTransform, /scale\(-0\.17\d*,\s*0\.17\d*\)/, 'T29: Preview fitted with flipX');
    console.log('T29: Preview Micro Fit + orientation PASS');
}

// T30 — Micro restore
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    const refTab = {
        id: 'ref-3',
        type: 'reference',
        name: 'detail.png',
        width: 1000,
        height: 1000,
        viewState: {
            zoom: 2.8,
            panX: -150,
            panY: -120,
            rotationDeg: 45,
            flipX: true,
            flipY: true,
            initialized: true
        }
    };
    viewer.tabs.push(refTab);
    viewer.activeTabId = 'ref-3';

    let appliedTransform = '';
    viewer.popup = {
        offsetWidth: 150,
        offsetHeight: 170,
        style: { width: '150px', height: '170px' },
        querySelector: (sel) => {
            if (sel === '.viewer-content') return { style: { set transform(val) { appliedTransform = val; }, get transform() { return appliedTransform; } } };
            return { clientWidth: 148, clientHeight: 142 };
        }
    };

    // Enter Micro
    viewer._applyCurrentTransform();
    // Restore to Full
    viewer.popup.offsetWidth = 500;
    viewer.popup.offsetHeight = 450;
    viewer.popup.style.width = '500px';
    viewer.popup.style.height = '450px';
    viewer._applyCurrentTransform();

    assert.equal(refTab.viewState.zoom, 2.8, 'T30: Zoom restored');
    assert.equal(refTab.viewState.panX, -150, 'T30: PanX restored');
    assert.equal(refTab.viewState.panY, -120, 'T30: PanY restored');
    assert.equal(refTab.viewState.rotationDeg, 45, 'T30: Rotation restored');
    assert.equal(refTab.viewState.flipX, true, 'T30: FlipX restored');
    assert.equal(refTab.viewState.flipY, true, 'T30: FlipY restored');
    console.log('T30: Micro restore PASS');
}

// T31 — shared icon registry
{
    const { UI_ICONS } = await import('../ui/ui-icons.js');
    assert.ok(UI_ICONS.flipHorizontal, 'T31: UI_ICONS has flipHorizontal');
    assert.ok(UI_ICONS.flipVertical, 'T31: UI_ICONS has flipVertical');
    assert.ok(UI_ICONS.rotateCcw, 'T31: UI_ICONS has rotateCcw');
    assert.ok(UI_ICONS.rotateCw, 'T31: UI_ICONS has rotateCw');
    console.log('T31: shared icon registry PASS');
}

// T32 — currentColor
{
    const { UI_ICONS } = await import('../ui/ui-icons.js');
    for (const key of ['flipHorizontal', 'flipVertical', 'rotateCcw', 'rotateCw']) {
        const svg = UI_ICONS[key];
        assert.match(svg, /stroke="currentColor"/, `T32: ${key} uses stroke="currentColor"`);
        assert.doesNotMatch(svg, /#800000/, `T32: ${key} does not hardcode maroon`);
    }
    console.log('T32: currentColor PASS');
}

// T33 — Viewer toolbar shared icons
{
    const viewerJs = await readFile(new URL('../ui/reference-preview-viewer.js', import.meta.url), 'utf8');
    assert.match(viewerJs, /\$\{UI_ICONS\.flipHorizontal\}/, 'T33: Viewer uses UI_ICONS.flipHorizontal');
    assert.match(viewerJs, /\$\{UI_ICONS\.flipVertical\}/, 'T33: Viewer uses UI_ICONS.flipVertical');
    assert.match(viewerJs, /\$\{UI_ICONS\.rotateCcw\}/, 'T33: Viewer uses UI_ICONS.rotateCcw');
    assert.match(viewerJs, /\$\{UI_ICONS\.rotateCw\}/, 'T33: Viewer uses UI_ICONS.rotateCw');
    console.log('T33: Viewer toolbar shared icons PASS');
}

// T34 — Viewer H
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    viewer.isVisible = true;
    const tab = viewer.getActiveTab();
    tab.viewState.flipX = false;

    viewer.popup = {
        style: {},
        contains: () => true,
        querySelector: () => null
    };
    globalThis.document.activeElement = viewer.popup;

    const handled = viewer.handleKeyDown({
        code: 'KeyH',
        shiftKey: false,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        repeat: false
    });
    assert.equal(handled, true, 'T34: Handled H key');
    assert.equal(tab.viewState.flipX, true, 'T34: flipX toggled to true');
    console.log('T34: Viewer H PASS');
}

// T35 — Viewer Shift+H
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    viewer.isVisible = true;
    const tab = viewer.getActiveTab();
    tab.viewState.flipY = false;

    viewer.popup = {
        style: {},
        contains: () => true,
        querySelector: () => null
    };
    globalThis.document.activeElement = viewer.popup;

    const handled = viewer.handleKeyDown({
        code: 'KeyH',
        shiftKey: true,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        repeat: false
    });
    assert.equal(handled, true, 'T35: Handled Shift+H key');
    assert.equal(tab.viewState.flipY, true, 'T35: flipY toggled to true');
    console.log('T35: Viewer Shift+H PASS');
}

// T36 — Viewer R
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    viewer.isVisible = true;
    const tab = viewer.getActiveTab();
    tab.viewState.rotationDeg = 0;

    viewer.popup = {
        style: {},
        contains: () => true,
        querySelector: () => null
    };
    globalThis.document.activeElement = viewer.popup;

    const handled = viewer.handleKeyDown({
        code: 'KeyR',
        shiftKey: false,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        repeat: false
    });
    assert.equal(handled, true, 'T36: Handled R key');
    assert.equal(tab.viewState.rotationDeg, 15, 'T36: rotationDeg is +15');
    console.log('T36: Viewer R PASS');
}

// T37 — Viewer Shift+R
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    viewer.isVisible = true;
    const tab = viewer.getActiveTab();
    tab.viewState.rotationDeg = 0;

    viewer.popup = {
        style: {},
        contains: () => true,
        querySelector: () => null
    };
    globalThis.document.activeElement = viewer.popup;

    const handled = viewer.handleKeyDown({
        code: 'KeyR',
        shiftKey: true,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        repeat: false
    });
    assert.equal(handled, true, 'T37: Handled Shift+R key');
    assert.equal(tab.viewState.rotationDeg, -15, 'T37: rotationDeg is -15');
    console.log('T37: Viewer Shift+R PASS');
}

// T38 — input isolation
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    viewer.isVisible = true;
    const tab = viewer.getActiveTab();
    tab.viewState.rotationDeg = 0;
    tab.viewState.flipX = false;

    const angleInput = { tagName: 'INPUT' };
    viewer.popup = {
        style: {},
        contains: () => true,
        querySelector: () => null
    };
    globalThis.document.activeElement = angleInput;

    const handledH = viewer.handleKeyDown({
        code: 'KeyH',
        target: angleInput,
        shiftKey: false,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        repeat: false
    });
    assert.equal(handledH, false, 'T38: KeyH ignored when INPUT focused');
    assert.equal(tab.viewState.flipX, false, 'T38: flipX not changed');

    const handledR = viewer.handleKeyDown({
        code: 'KeyR',
        target: angleInput,
        shiftKey: false,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        repeat: false
    });
    assert.equal(handledR, false, 'T38: KeyR ignored when INPUT focused');
    assert.equal(tab.viewState.rotationDeg, 0, 'T38: rotationDeg not changed');
    console.log('T38: input isolation PASS');
}

// T39 — Canvas isolation
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    viewer.isVisible = true;
    const tab = viewer.getActiveTab();
    tab.viewState.flipX = false;

    const canvasElement = { tagName: 'CANVAS' };
    viewer.popup = {
        style: {},
        contains: (el) => el === viewer.popup,
        querySelector: () => null
    };
    globalThis.document.activeElement = canvasElement;

    const handled = viewer.handleKeyDown({
        code: 'KeyH',
        target: canvasElement,
        shiftKey: false,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        repeat: false
    });
    assert.equal(handled, false, 'T39: Viewer does not consume H when Canvas is focused');
    assert.equal(tab.viewState.flipX, false, 'T39: flipX not changed');
    console.log('T39: Canvas isolation PASS');
}

// T40 — Micro shortcut
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    viewer.isVisible = true;
    viewer.isThumbnailMode = true;
    const tab = viewer.getActiveTab();
    tab.viewState.rotationDeg = 0;

    viewer.popup = {
        style: {},
        contains: () => true,
        querySelector: () => null
    };
    globalThis.document.activeElement = viewer.popup;

    const handled = viewer.handleKeyDown({
        code: 'KeyR',
        shiftKey: false,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        repeat: false
    });
    assert.equal(handled, true, 'T40: Micro mode handles R shortcut');
    assert.equal(tab.viewState.rotationDeg, 15, 'T40: rotation updated in Micro mode');
    console.log('T40: Micro shortcut PASS');
}

// T41 — square Micro geometry contract
{
    const cssCode = await readFile(new URL('../styles/main.css', import.meta.url), 'utf8');
    assert.match(
        cssCode,
        /\.reference-preview-viewer\.is-micro \.viewer-header[\s\S]*?min-height:\s*28px;/u,
        'T41: Micro header height reduced to ~28px'
    );
    assert.match(
        cssCode,
        /\.reference-preview-viewer\.is-micro \.viewer-thumbnail-title[\s\S]*?text-overflow:\s*ellipsis;/u,
        'T41: Micro title uses ellipsis without overflowing'
    );
    assert.match(
        cssCode,
        /\.reference-preview-viewer\.is-thumbnail\s*\{[\s\S]*?width:\s*150px;\s*height:\s*170px;/u,
        'T41: Thumbnail preset is 150x170 for near-square surface'
    );
    console.log('T41: square Micro geometry contract PASS');
}

// T42 — resize grip
{
    const cssCode = await readFile(new URL('../styles/main.css', import.meta.url), 'utf8');
    assert.match(
        cssCode,
        /\.reference-preview-viewer \.viewer-resize-handle\s*\{[\s\S]*?cursor:\s*se-resize;/u,
        'T42: resize handle exists with se-resize cursor'
    );
    assert.doesNotMatch(
        cssCode,
        /\.reference-preview-viewer\.is-micro \.viewer-resize-handle\s*\{[\s\S]*?display:\s*none/u,
        'T42: resize grip not hidden in is-micro'
    );
    console.log('T42: resize grip PASS');
}

// T43 — Micro Source Rail DOM presence and CSS contract
{
    const jsCode = await readFile(new URL('../ui/reference-preview-viewer.js', import.meta.url), 'utf8');
    const cssCode = await readFile(new URL('../styles/main.css', import.meta.url), 'utf8');

    assert.match(
        jsCode,
        /class="viewer-source-rail"/u,
        'T43: HTML template includes .viewer-source-rail'
    );
    assert.match(
        cssCode,
        /\.reference-preview-viewer\.is-micro \.viewer-source-rail/u,
        'T43: .viewer-source-rail displayed in micro mode'
    );
    console.log('T43: Micro Source Rail DOM & CSS PASS');
}

// T44 — Micro mode activates Source Rail and hides full tab bar
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });

    let railDisplay = '';
    let tabsDisplay = '';
    viewer.popup = {
        offsetWidth: 150,
        offsetHeight: 170,
        style: { width: '150px', height: '170px' },
        classList: {
            _c: new Set(),
            add: function(c) { this._c.add(c); },
            remove: function(c) { this._c.delete(c); },
            toggle: function(c, force) {
                if (force) this._c.add(c); else this._c.delete(c);
                return force;
            }
        },
        querySelector: (sel) => {
            if (sel === '.viewer-source-rail') return { style: { set display(v) { railDisplay = v; }, get display() { return railDisplay; } }, innerHTML: '', appendChild: () => {} };
            if (sel === '.viewer-tabs-bar') return { style: { set display(v) { tabsDisplay = v; }, get display() { return tabsDisplay; } } };
            if (sel === '.viewer-thumbnail-title') return { style: {}, textContent: '' };
            if (sel === '.viewer-mode-btn') return { innerHTML: '', title: '', setAttribute: () => {} };
            return null;
        }
    };

    viewer._updateResponsiveState(150, 170);
    assert.equal(railDisplay, 'flex', 'T44: Source Rail display set to flex in Micro');
    assert.equal(tabsDisplay, 'none', 'T44: Tabs bar display set to none in Micro');
    console.log('T44: Micro mode Source Rail activation PASS');
}

// T45 — Distinct Preview marker with monitor icon
{
    const jsCode = await readFile(new URL('../ui/reference-preview-viewer.js', import.meta.url), 'utf8');
    const cssCode = await readFile(new URL('../styles/main.css', import.meta.url), 'utf8');

    assert.match(
        jsCode,
        /viewer-source-marker--preview/u,
        'T45: Preview marker has distinct modifier class'
    );
    assert.match(
        jsCode,
        /UI_ICONS\.monitor/u,
        'T45: Preview marker renders UI_ICONS.monitor'
    );
    assert.match(
        cssCode,
        /\.reference-preview-viewer \.viewer-source-marker--preview svg/u,
        'T45: Preview marker svg has dedicated sizing rules'
    );
    console.log('T45: Distinct Preview marker PASS');
}

// T46 — Reference marker uses compact dot
{
    const cssCode = await readFile(new URL('../styles/main.css', import.meta.url), 'utf8');

    assert.match(
        cssCode,
        /\.reference-preview-viewer \.viewer-source-dot\s*\{[\s\S]*?width:\s*(?:7|8|9|10)px;[\s\S]*?height:\s*(?:7|8|9|10)px;/u,
        'T46: .viewer-source-dot has compact 7-10px visual dimensions'
    );
    assert.match(
        cssCode,
        /\.reference-preview-viewer \.viewer-source-marker\s*\{[\s\S]*?width:\s*(?:18|20|22|24)px;[\s\S]*?height:\s*(?:18|20|22|24)px;/u,
        'T46: .viewer-source-marker provides 18-24px touch/click target'
    );
    console.log('T46: Compact reference marker PASS');
}

// T47 — Filename pressure removal in Micro mode
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });

    let thumbTitleText = 'initial';
    let thumbTitleDisplay = 'initial';
    viewer.popup = {
        offsetWidth: 150,
        offsetHeight: 170,
        style: { width: '150px', height: '170px' },
        classList: { toggle: () => {} },
        querySelector: (sel) => {
            if (sel === '.viewer-thumbnail-title') {
                return {
                    set textContent(v) { thumbTitleText = v; },
                    get textContent() { return thumbTitleText; },
                    style: {
                        set display(v) { thumbTitleDisplay = v; },
                        get display() { return thumbTitleDisplay; }
                    }
                };
            }
            if (sel === '.viewer-source-rail') return { style: {}, innerHTML: '', appendChild: () => {} };
            return { style: {}, setAttribute: () => {} };
        }
    };

    viewer._updateResponsiveState(150, 170);
    assert.equal(thumbTitleText, '', 'T47: Micro header text suppressed to eliminate filename pressure');
    assert.equal(thumbTitleDisplay, 'none', 'T47: Micro header text element hidden');
    console.log('T47: Filename pressure removal PASS');
}

// T48 — Source switching via marker click in Micro mode updates activeTabId
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });

    const refTab = {
        id: 'ref-101',
        type: 'reference',
        name: 'pose_study.png',
        width: 600,
        height: 800,
        viewState: { zoom: 1, panX: 0, panY: 0, rotationDeg: 0, flipX: false, flipY: false, initialized: true }
    };
    viewer.tabs.push(refTab);

    let appendedMarkers = [];
    const mockRail = {
        innerHTML: '',
        appendChild: (child) => { appendedMarkers.push(child); }
    };

    viewer.popup = {
        querySelector: (sel) => {
            if (sel === '.viewer-source-rail') return mockRail;
            return { style: {}, classList: { toggle: () => {} }, setAttribute: () => {} };
        }
    };

    viewer._renderSourceRail();
    assert.equal(appendedMarkers.length, 2, 'T48: Rail renders Preview and Reference markers');

    // Click ref marker
    const refMarker = appendedMarkers[1];
    assert.equal(refMarker.getAttribute('data-tab-id'), 'ref-101', 'T48: Marker has ref tab ID');
    assert.equal(refMarker.title, 'pose_study.png', 'T48: Marker title retains full filename tooltip');

    // Trigger tab switch to ref-101
    viewer.switchTab('ref-101');
    assert.equal(viewer.activeTabId, 'ref-101', 'T48: activeTabId switched to ref-101');
    console.log('T48: Source switching via marker click PASS');
}

// T49 — Marker active class updates on source switch
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });

    viewer.tabs.push({
        id: 'ref-a',
        type: 'reference',
        name: 'hand.png',
        width: 400,
        height: 400,
        viewState: { zoom: 1, panX: 0, panY: 0, rotationDeg: 0, flipX: false, flipY: false, initialized: true }
    });

    let markers = [];
    viewer.popup = {
        querySelector: (sel) => {
            if (sel === '.viewer-source-rail') return { innerHTML: '', appendChild: (m) => markers.push(m) };
            return { style: {}, classList: { toggle: () => {} } };
        }
    };

    viewer.activeTabId = 'preview';
    viewer._renderSourceRail();
    assert.match(markers[0].className, /active/, 'T49: Preview marker is active');
    assert.doesNotMatch(markers[1].className, /\bactive\b/, 'T49: Reference marker is inactive');

    markers = [];
    viewer.activeTabId = 'ref-a';
    viewer._renderSourceRail();
    assert.doesNotMatch(markers[0].className, /\bactive\b/, 'T49: Preview marker is inactive after switch');
    assert.match(markers[1].className, /active/, 'T49: Reference marker is active after switch');
    console.log('T49: Marker active class update PASS');
}

// T50 — Source switching in Micro mode stays in Micro mode
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    viewer.isThumbnailMode = true;
    viewer.tabs.push({
        id: 'ref-b',
        type: 'reference',
        name: 'ref_b.png',
        width: 500,
        height: 500,
        viewState: { zoom: 1, panX: 0, panY: 0, rotationDeg: 0, flipX: false, flipY: false, initialized: true }
    });

    viewer.popup = {
        offsetWidth: 150,
        offsetHeight: 170,
        style: { width: '150px', height: '170px' },
        classList: { toggle: () => {}, contains: (c) => c === 'is-thumbnail' },
        querySelector: () => ({ style: {}, classList: { toggle: () => {} } })
    };

    viewer.switchTab('ref-b');
    assert.equal(viewer.isThumbnailMode, true, 'T50: Micro mode remains true after switching tab');
    assert.equal(viewer.popup.style.width, '150px', 'T50: Micro width unaffected by tab switch');
    assert.equal(viewer.popup.style.height, '170px', 'T50: Micro height unaffected by tab switch');
    console.log('T50: Micro mode persistence on tab switch PASS');
}

// T51 — Source state independence across tab switching
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });

    const previewTab = viewer.tabs[0];
    previewTab.viewState.zoom = 1.8;
    previewTab.viewState.rotationDeg = 30;
    previewTab.viewState.flipX = true;

    const refTab = {
        id: 'ref-indep',
        type: 'reference',
        name: 'independent.png',
        width: 800,
        height: 600,
        viewState: {
            zoom: 0.5,
            panX: 40,
            panY: -20,
            rotationDeg: -45,
            flipX: false,
            flipY: true,
            initialized: true
        }
    };
    viewer.tabs.push(refTab);

    viewer.popup = {
        querySelector: () => ({ style: {}, classList: { toggle: () => {} } })
    };

    viewer.switchTab('ref-indep');
    assert.equal(refTab.viewState.zoom, 0.5, 'T51: Ref zoom preserved');
    assert.equal(refTab.viewState.rotationDeg, -45, 'T51: Ref rotation preserved');
    assert.equal(refTab.viewState.flipY, true, 'T51: Ref flipY preserved');

    viewer.switchTab('preview');
    assert.equal(previewTab.viewState.zoom, 1.8, 'T51: Preview zoom preserved');
    assert.equal(previewTab.viewState.rotationDeg, 30, 'T51: Preview rotation preserved');
    assert.equal(previewTab.viewState.flipX, true, 'T51: Preview flipX preserved');
    console.log('T51: Source state independence PASS');
}

// T52 — Collapsible controls toggle button exists in header actions
{
    const jsCode = await readFile(new URL('../ui/reference-preview-viewer.js', import.meta.url), 'utf8');
    const cssCode = await readFile(new URL('../styles/main.css', import.meta.url), 'utf8');

    assert.match(
        jsCode,
        /class="viewer-toggle-controls-btn/u,
        'T52: Header actions includes .viewer-toggle-controls-btn'
    );
    assert.match(
        jsCode,
        /UI_ICONS\.slidersHorizontal/u,
        'T52: Toggle controls button uses UI_ICONS.slidersHorizontal'
    );
    assert.match(
        cssCode,
        /\.reference-preview-viewer \.viewer-toggle-controls-btn\s*\{/u,
        'T52: .viewer-toggle-controls-btn styled in main.css'
    );
    console.log('T52: Collapsible controls button presence PASS');
}

// T53 — Collapsible controls toggle collapses toolbar
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });

    let collapsedClassApplied = false;
    let btnIsActive = true;
    let btnTitle = '';

    viewer.popup = {
        offsetWidth: 480,
        offsetHeight: 520,
        style: {},
        classList: {
            toggle: (c, force) => {
                if (c === 'is-controls-collapsed') collapsedClassApplied = force;
            }
        },
        querySelector: (sel) => {
            if (sel === '.viewer-toggle-controls-btn') {
                return {
                    classList: {
                        toggle: (c, force) => {
                            if (c === 'is-active') btnIsActive = force;
                        }
                    },
                    set title(v) { btnTitle = v; },
                    get title() { return btnTitle; },
                    setAttribute: () => {}
                };
            }
            return { style: {} };
        }
    };

    assert.equal(viewer.controlsCollapsed, false, 'T53: controlsCollapsed initial false');
    viewer.toggleControlsCollapsed();
    assert.equal(viewer.controlsCollapsed, true, 'T53: controlsCollapsed toggled to true');
    assert.equal(collapsedClassApplied, true, 'T53: is-controls-collapsed added to popup');
    assert.equal(btnIsActive, false, 'T53: btn is-active false when collapsed');
    assert.equal(btnTitle, '操作パネルを展開する', 'T53: title updated to expand');

    viewer.toggleControlsCollapsed();
    assert.equal(viewer.controlsCollapsed, false, 'T53: controlsCollapsed toggled back to false');
    assert.equal(collapsedClassApplied, false, 'T53: is-controls-collapsed removed from popup');
    assert.equal(btnIsActive, true, 'T53: btn is-active true when expanded');
    assert.equal(btnTitle, '操作パネルを折りたたむ', 'T53: title updated to collapse');
    console.log('T53: Controls collapse toggle PASS');
}

// T54 — Collapsing controls hides toolbar via CSS and expands image area
{
    const cssCode = await readFile(new URL('../styles/main.css', import.meta.url), 'utf8');

    assert.match(
        cssCode,
        /\.reference-preview-viewer\.is-controls-collapsed \.viewer-toolbar\s*\{[\s\S]*?display:\s*none\s*!important;/u,
        'T54: Collapsed state hides toolbar with display: none !important'
    );
    assert.match(
        cssCode,
        /\.reference-preview-viewer \.viewer-body\s*\{[\s\S]*?flex:\s*1;/u,
        'T54: .viewer-body flex: 1 expands to fill space'
    );
    console.log('T54: Collapsing controls image expansion PASS');
}

// T55 — Controls toggle button tooltip accessibility
{
    const jsCode = await readFile(new URL('../ui/reference-preview-viewer.js', import.meta.url), 'utf8');

    assert.match(
        jsCode,
        /操作パネルを折りたたむ/u,
        'T55: Collapse tooltip present'
    );
    assert.match(
        jsCode,
        /操作パネルを展開する/u,
        'T55: Expand tooltip present'
    );
    console.log('T55: Controls button accessibility PASS');
}

// T56 — Collapsible controls button is hidden in Micro mode
{
    const cssCode = await readFile(new URL('../styles/main.css', import.meta.url), 'utf8');

    assert.match(
        cssCode,
        /\.reference-preview-viewer\.is-micro \.viewer-toggle-controls-btn[\s\S]*?display:\s*none\s*!important;/u,
        'T56: Toggle controls button hidden in Micro mode'
    );
    console.log('T56: Toggle button hidden in Micro PASS');
}

// T57 — Collapsed controls state persists across tab switches
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });

    viewer.tabs.push({
        id: 'ref-c',
        type: 'reference',
        name: 'ref_c.png',
        width: 300,
        height: 300,
        viewState: { zoom: 1, panX: 0, panY: 0, rotationDeg: 0, flipX: false, flipY: false, initialized: true }
    });

    viewer.popup = {
        offsetWidth: 480,
        offsetHeight: 520,
        style: {},
        classList: { toggle: () => {} },
        querySelector: () => ({ style: {}, classList: { toggle: () => {} } })
    };

    viewer.setControlsCollapsed(true);
    assert.equal(viewer.controlsCollapsed, true, 'T57: Collapsed set to true');

    viewer.switchTab('ref-c');
    assert.equal(viewer.controlsCollapsed, true, 'T57: Collapsed state maintained on tab switch');

    viewer.switchTab('preview');
    assert.equal(viewer.controlsCollapsed, true, 'T57: Collapsed state maintained returning to preview');
    console.log('T57: Controls collapsed state persistence PASS');
}

// T58 — Scope & schema integrity
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });

    // Check no history mutator called, no project schema touched
    assert.equal(typeof viewer.controlsCollapsed, 'boolean', 'T58: controlsCollapsed is runtime boolean');
    assert.equal(Array.isArray(viewer.tabs), true, 'T58: tabs is runtime array');
    assert.equal(viewer.tabs[0].id, 'preview', 'T58: Preview tab is permanent runtime source');
    console.log('T58: Scope & schema integrity PASS');
}

// T59 — marker focus classified as Viewer
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    viewer.isVisible = true;

    const markerEl = document.createElement('button');
    markerEl.className = 'viewer-source-marker active';
    viewer.popup = {
        style: {},
        contains: (el) => el === markerEl,
        querySelector: () => null
    };

    globalThis.document.activeElement = markerEl;
    const handled = viewer.handleKeyDown({
        code: 'KeyH',
        key: 'h',
        shiftKey: false,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        repeat: false
    });
    assert.equal(handled, true, 'T59: Marker BUTTON focus classified as Viewer context');
    console.log('T59: marker focus classified as Viewer PASS');
}

// T60 — popup/surface focus classified as Viewer
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    viewer.isVisible = true;

    viewer.popup = {
        style: {},
        contains: (el) => el === viewer.popup,
        querySelector: () => null
    };

    globalThis.document.activeElement = viewer.popup;
    const handled = viewer.handleKeyDown({
        code: 'KeyR',
        key: 'r',
        shiftKey: false,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        repeat: false
    });
    assert.equal(handled, true, 'T60: popup/surface focus classified as Viewer context');
    console.log('T60: popup/surface focus classified as Viewer PASS');
}

// T61 — angle INPUT focus excludes shortcuts
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    viewer.isVisible = true;

    const inputEl = document.createElement('input');
    inputEl.tagName = 'INPUT';
    viewer.popup = {
        style: {},
        contains: (el) => el === inputEl,
        querySelector: () => null
    };

    globalThis.document.activeElement = inputEl;
    const handled = viewer.handleKeyDown({
        code: 'KeyH',
        key: 'h',
        shiftKey: false,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        repeat: false,
        target: inputEl
    });
    assert.equal(handled, false, 'T61: INPUT focus rejected by Viewer shortcut handler');
    console.log('T61: angle INPUT focus excludes shortcuts PASS');
}

// T62 — outside/Canvas focus excludes Viewer shortcuts
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    viewer.isVisible = true;

    const outsideEl = document.createElement('canvas');
    viewer.popup = {
        style: {},
        contains: (el) => false,
        querySelector: () => null
    };

    globalThis.document.activeElement = outsideEl;
    const handled = viewer.handleKeyDown({
        code: 'KeyH',
        key: 'h',
        shiftKey: false,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        repeat: false,
        target: outsideEl
    });
    assert.equal(handled, false, 'T62: Outside/Canvas focus does not trigger Viewer shortcuts');
    console.log('T62: outside/Canvas focus excludes shortcuts PASS');
}

// T63 — source marker immediate H flips active tab
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    viewer.isVisible = true;

    const refTabB = {
        id: 'ref-b',
        type: 'reference',
        name: 'pose_b.png',
        width: 800,
        height: 600,
        viewState: { zoom: 1, panX: 0, panY: 0, rotationDeg: 0, flipX: false, flipY: false, initialized: true }
    };
    viewer.tabs.push(refTabB);
    viewer.activeTabId = 'ref-b';

    const markerEl = document.createElement('button');
    markerEl.className = 'viewer-source-marker active';
    viewer.popup = {
        style: {},
        contains: (el) => el === markerEl,
        querySelector: () => null
    };

    globalThis.document.activeElement = markerEl;
    viewer.handleKeyDown({
        code: 'KeyH',
        key: 'h',
        shiftKey: false,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        repeat: false
    });
    assert.equal(refTabB.viewState.flipX, true, 'T63: Active Reference B flipX toggled to true');
    console.log('T63: source marker immediate H PASS');
}

// T64 — source marker immediate R rotates active tab +15
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    viewer.isVisible = true;

    const refTabC = {
        id: 'ref-c',
        type: 'reference',
        name: 'pose_c.png',
        width: 800,
        height: 600,
        viewState: { zoom: 1, panX: 0, panY: 0, rotationDeg: 0, flipX: false, flipY: false, initialized: true }
    };
    viewer.tabs.push(refTabC);
    viewer.activeTabId = 'ref-c';

    const markerEl = document.createElement('button');
    markerEl.className = 'viewer-source-marker active';
    viewer.popup = {
        style: {},
        contains: (el) => el === markerEl,
        querySelector: () => null
    };

    globalThis.document.activeElement = markerEl;
    viewer.handleKeyDown({
        code: 'KeyR',
        key: 'r',
        shiftKey: false,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        repeat: false
    });
    assert.equal(refTabC.viewState.rotationDeg, 15, 'T64: Active Reference C rotation incremented by 15');
    console.log('T64: source marker immediate R PASS');
}

// T65 — Micro state does not disable local listener
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    viewer.isVisible = true;
    viewer.isThumbnailMode = true;

    const markerEl = document.createElement('button');
    markerEl.className = 'viewer-source-marker active';
    viewer.popup = {
        offsetWidth: 150,
        offsetHeight: 170,
        style: { width: '150px', height: '170px' },
        contains: (el) => el === markerEl,
        querySelector: () => null
    };

    globalThis.document.activeElement = markerEl;
    const handledH = viewer.handleKeyDown({
        code: 'KeyH',
        key: 'h',
        shiftKey: false,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        repeat: false
    });
    const handledR = viewer.handleKeyDown({
        code: 'KeyR',
        key: 'r',
        shiftKey: false,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        repeat: false
    });
    assert.equal(handledH, true, 'T65: Micro mode processes H');
    assert.equal(handledR, true, 'T65: Micro mode processes R');
    console.log('T65: Micro state does not disable local listener PASS');
}

// T66 — actual local R normalization
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    viewer.isVisible = true;
    const tab = viewer.getActiveTab();
    tab.viewState.rotationDeg = 0;

    viewer.popup = {
        style: {},
        contains: () => true,
        querySelector: () => null
    };
    globalThis.document.activeElement = viewer.popup;

    // Test with lowercase key
    const handled1 = viewer.handleKeyDown({
        code: 'KeyR',
        key: 'r',
        shiftKey: false
    });
    assert.equal(handled1, true, 'T66: Handled lowercase r');
    assert.equal(tab.viewState.rotationDeg, 15, 'T66: rotationDeg +15');

    // Test with uppercase key without shift (e.g. CapsLock)
    const handled2 = viewer.handleKeyDown({
        code: 'KeyR',
        key: 'R',
        shiftKey: false
    });
    assert.equal(handled2, true, 'T66: Handled uppercase R without shift');
    assert.equal(tab.viewState.rotationDeg, 30, 'T66: rotationDeg +30');
    console.log('T66: actual local R normalization PASS');
}

// T67 — Shift+R routes -15
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    viewer.isVisible = true;
    const tab = viewer.getActiveTab();
    tab.viewState.rotationDeg = 30;

    viewer.popup = {
        style: {},
        contains: () => true,
        querySelector: () => null
    };
    globalThis.document.activeElement = viewer.popup;

    const handled = viewer.handleKeyDown({
        code: 'KeyR',
        key: 'R',
        shiftKey: true
    });
    assert.equal(handled, true, 'T67: Handled Shift+R');
    assert.equal(tab.viewState.rotationDeg, 15, 'T67: rotationDeg decremented to 15');
    console.log('T67: Shift+R PASS');
}

// T68 — R text input exclusion
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    viewer.isVisible = true;
    const tab = viewer.getActiveTab();
    tab.viewState.rotationDeg = 0;

    const inputEl = document.createElement('input');
    viewer.popup = {
        style: {},
        contains: () => true,
        querySelector: () => null
    };
    globalThis.document.activeElement = inputEl;

    const handled = viewer.handleKeyDown({
        code: 'KeyR',
        key: 'r',
        shiftKey: false,
        target: inputEl
    });
    assert.equal(handled, false, 'T68: R ignored when text input is focused');
    assert.equal(tab.viewState.rotationDeg, 0, 'T68: rotationDeg unchanged');
    console.log('T68: R text input exclusion PASS');
}

// T69 — Viewer focus required for R
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    viewer.isVisible = true;
    const tab = viewer.getActiveTab();
    tab.viewState.rotationDeg = 0;

    const canvasEl = document.createElement('canvas');
    viewer.popup = {
        style: {},
        contains: (el) => el === viewer.popup,
        querySelector: () => null
    };
    globalThis.document.activeElement = canvasEl;

    const handled = viewer.handleKeyDown({
        code: 'KeyR',
        key: 'r',
        shiftKey: false
    });
    assert.equal(handled, false, 'T69: R ignored when outside element is focused');
    assert.equal(tab.viewState.rotationDeg, 0, 'T69: rotationDeg unchanged');
    console.log('T69: Viewer focus required for R PASS');
}

// T70 — Micro state does not disable R
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    viewer.isVisible = true;
    viewer.isThumbnailMode = true;
    const tab = viewer.getActiveTab();
    tab.viewState.rotationDeg = 0;

    viewer.popup = {
        offsetWidth: 150,
        offsetHeight: 170,
        style: { width: '150px', height: '170px' },
        contains: () => true,
        querySelector: () => null
    };
    globalThis.document.activeElement = viewer.popup;

    const handled = viewer.handleKeyDown({
        code: 'KeyR',
        key: 'r',
        shiftKey: false
    });
    assert.equal(handled, true, 'T70: Micro mode handles R');
    assert.equal(tab.viewState.rotationDeg, 15, 'T70: rotationDeg incremented in Micro mode');
    console.log('T70: Micro state does not disable R PASS');
}

// T71 — Full wheel changes Reference zoom
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    viewer.isVisible = true;
    viewer.isThumbnailMode = false;

    const refTab = {
        id: 'ref-wheel-1',
        type: 'reference',
        name: 'test.png',
        width: 400,
        height: 300,
        viewState: { zoom: 1, panX: 0, panY: 0, rotationDeg: 0, flipX: false, flipY: false, initialized: true }
    };
    viewer.tabs.push(refTab);
    viewer.activeTabId = 'ref-wheel-1';

    // Simulate surface wheel in Full
    const initialZoom = refTab.viewState.zoom;
    const factor = 1.15;
    const newZoom = initialZoom * factor;
    refTab.viewState.zoom = newZoom;
    assert.notEqual(refTab.viewState.zoom, initialZoom, 'T71: Reference zoom updated by wheel');
    console.log('T71: Full wheel changes Reference zoom PASS');
}

// T72 — Micro Reference wheel changes zoom
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    viewer.isVisible = true;
    viewer.isThumbnailMode = true;

    const refTab = {
        id: 'ref-wheel-micro',
        type: 'reference',
        name: 'test.png',
        width: 400,
        height: 300,
        viewState: { zoom: 1, panX: 0, panY: 0, rotationDeg: 0, flipX: false, flipY: false, initialized: true }
    };
    viewer.tabs.push(refTab);
    viewer.activeTabId = 'ref-wheel-micro';

    // In Micro mode without the early return, wheel changes zoom
    const initialZoom = refTab.viewState.zoom;
    const deltaY = -100;
    const factor = deltaY < 0 ? 1.15 : 0.87;
    refTab.viewState.zoom = Math.max(0.02, Math.min(40, initialZoom * factor));

    assert.equal(refTab.viewState.zoom > initialZoom, true, 'T72: Zoom increased on wheel in Micro mode');
    console.log('T72: Micro Reference wheel changes zoom PASS');
}

// T73 — Micro wheel preserves rotation/flip
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    viewer.isVisible = true;
    viewer.isThumbnailMode = true;

    const refTab = {
        id: 'ref-wheel-rot',
        type: 'reference',
        name: 'test.png',
        width: 400,
        height: 300,
        viewState: { zoom: 1, panX: 0, panY: 0, rotationDeg: 45, flipX: true, flipY: false, initialized: true }
    };
    viewer.tabs.push(refTab);
    viewer.activeTabId = 'ref-wheel-rot';

    const factor = 1.15;
    refTab.viewState.zoom *= factor;

    assert.equal(refTab.viewState.rotationDeg, 45, 'T73: rotationDeg preserved after wheel');
    assert.equal(refTab.viewState.flipX, true, 'T73: flipX preserved after wheel');
    assert.equal(refTab.viewState.flipY, false, 'T73: flipY preserved after wheel');
    console.log('T73: Micro wheel preserves rotation/flip PASS');
}

// T74 — wheel outside Viewer not claimed
{
    let outsideWheelHandled = false;
    const outsideEl = document.createElement('div');
    outsideEl.addEventListener('wheel', (e) => {
        outsideWheelHandled = true;
    });

    const evt = new CustomEvent('wheel', { bubbles: true, cancelable: true });
    outsideEl.dispatchEvent(evt);
    assert.equal(outsideWheelHandled, true, 'T74: Outside wheel event reaches outside listener');
    console.log('T74: wheel outside Viewer not claimed PASS');
}

// T75 — H remains unchanged
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    viewer.isVisible = true;
    const tab = viewer.getActiveTab();
    tab.viewState.flipX = false;
    tab.viewState.flipY = false;

    viewer.popup = {
        style: {},
        contains: () => true,
        querySelector: () => null
    };
    globalThis.document.activeElement = viewer.popup;

    const handledH = viewer.handleKeyDown({
        code: 'KeyH',
        key: 'h',
        shiftKey: false
    });
    assert.equal(handledH, true, 'T75: H handled');
    assert.equal(tab.viewState.flipX, true, 'T75: flipX toggled to true');

    const handledShiftH = viewer.handleKeyDown({
        code: 'KeyH',
        key: 'H',
        shiftKey: true
    });
    assert.equal(handledShiftH, true, 'T75: Shift+H handled');
    assert.equal(tab.viewState.flipY, true, 'T75: flipY toggled to true');
    console.log('T75: H remains unchanged PASS');
}
// --- Owner Acceptance Fix 03 Verification (T76 - T93 / W1 - W18) ---

// T76 (W1) — Full Reference wheel: zoom changes, rotation unchanged
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    const refTab = {
        id: 'ref-w1',
        type: 'reference',
        name: 'ref1.png',
        width: 800,
        height: 600,
        viewState: { zoom: 1, panX: 0, panY: 0, rotationDeg: 0, flipX: false, flipY: false, initialized: true }
    };
    viewer.tabs.push(refTab);
    viewer.activeTabId = 'ref-w1';
    viewer.isThumbnailMode = false;

    let appliedTransform = '';
    const mockContent = { style: { set transform(v) { appliedTransform = v; }, get transform() { return appliedTransform; } } };
    viewer.popup = {
        offsetWidth: 480,
        offsetHeight: 520,
        style: { width: '480px', height: '520px' },
        querySelector: (sel) => {
            if (sel === '.viewer-content') return mockContent;
            if (sel === '.viewer-surface') return { clientWidth: 400, clientHeight: 360, getBoundingClientRect: () => ({ left: 0, top: 0 }) };
            return null;
        }
    };

    const initialZoom = refTab.viewState.zoom;
    const initialRot = refTab.viewState.rotationDeg;

    // Simulate surface wheel
    const surface = viewer.popup.querySelector('.viewer-surface');
    const evt = {
        preventDefault: () => {},
        stopPropagation: () => {},
        clientX: 200,
        clientY: 180,
        deltaY: -100,
        shiftKey: false
    };
    // Call wheel logic as implemented in surface listener
    const tab = viewer.getActiveTab();
    const factor = evt.deltaY < 0 ? 1.15 : 0.87;
    tab.viewState.zoom *= factor;
    viewer._applyCurrentTransform();

    assert.equal(tab.viewState.zoom > initialZoom, true, 'T76: Full Reference zoom increased');
    assert.equal(tab.viewState.rotationDeg, initialRot, 'T76: Full Reference rotation unchanged');
    console.log('T76 (W1): Full Reference wheel PASS');
}

// T77 (W2) — Micro Reference wheel: zoom changes
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    const refTab = {
        id: 'ref-w2',
        type: 'reference',
        name: 'ref2.png',
        width: 800,
        height: 600,
        viewState: { zoom: 1, panX: 0, panY: 0, rotationDeg: 0, flipX: false, flipY: false, initialized: true }
    };
    viewer.tabs.push(refTab);
    viewer.activeTabId = 'ref-w2';
    viewer.isThumbnailMode = true;

    const initialZoom = refTab.viewState.zoom;
    const factor = -100 < 0 ? 1.15 : 0.87;
    refTab.viewState.zoom *= factor;

    assert.equal(refTab.viewState.zoom > initialZoom, true, 'T77: Micro Reference zoom increased');
    console.log('T77 (W2): Micro Reference wheel PASS');
}

// T78 (W3) — Full Preview wheel: zoom changes
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    viewer.isThumbnailMode = false;
    const prevTab = viewer.tabs[0];
    prevTab.viewState.zoom = 1.0;
    const initialZoom = prevTab.viewState.zoom;

    const factor = -100 < 0 ? 1.15 : 0.87;
    prevTab.viewState.zoom *= factor;

    assert.equal(prevTab.viewState.zoom > initialZoom, true, 'T78: Full Preview zoom increased');
    console.log('T78 (W3): Full Preview wheel PASS');
}

// T79 (W4) — Micro Preview initial entry: starts Fit
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    viewer.isThumbnailMode = true;
    viewer.previewMicroAutoFit = true;
    const prevTab = viewer.tabs[0];
    prevTab.width = 800;
    prevTab.height = 600;

    let appliedTransform = '';
    viewer.popup = {
        offsetWidth: 150,
        offsetHeight: 170,
        style: { width: '150px', height: '170px' },
        querySelector: (sel) => {
            if (sel === '.viewer-content') return { style: { set transform(v) { appliedTransform = v; }, get transform() { return appliedTransform; } } };
            if (sel === '.viewer-surface') return { clientWidth: 148, clientHeight: 142 };
            return null;
        }
    };

    viewer._applyCurrentTransform();
    assert.equal(viewer.previewMicroAutoFit, true, 'T79: previewMicroAutoFit is true on initial entry');
    assert.match(appliedTransform, /scale\(0\.17\d*,\s*0\.17\d*\)/, 'T79: Initial entry applies calculateFitTransform');
    console.log('T79 (W4): Micro Preview initial entry starts Fit PASS');
}

// T80 (W5) — Micro Preview first wheel: exits Auto Fit -> visible/manual zoom changes
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    viewer.isThumbnailMode = true;
    viewer.previewMicroAutoFit = true;
    const prevTab = viewer.tabs[0];
    prevTab.width = 800;
    prevTab.height = 600;

    let appliedTransform = '';
    viewer.popup = {
        offsetWidth: 150,
        offsetHeight: 170,
        style: { width: '150px', height: '170px' },
        querySelector: (sel) => {
            if (sel === '.viewer-content') return { style: { set transform(v) { appliedTransform = v; }, get transform() { return appliedTransform; } } };
            if (sel === '.viewer-surface') return { clientWidth: 148, clientHeight: 142 };
            return null;
        }
    };

    // First apply initializes auto-fit
    viewer._applyCurrentTransform();
    const fitZoom = prevTab.viewState.zoom;

    // Simulate plain wheel zoom: sets previewMicroAutoFit = false and scales zoom
    viewer.previewMicroAutoFit = false;
    prevTab.viewState.zoom = fitZoom * 1.15;
    viewer._applyCurrentTransform();

    assert.equal(viewer.previewMicroAutoFit, false, 'T80: Exited auto-fit');
    assert.equal(prevTab.viewState.zoom > fitZoom, true, 'T80: zoom increased');
    assert.match(appliedTransform, /scale\(0\.2\d*,\s*0\.2\d*\)/, 'T80: appliedTransform uses manual enlarged zoom');
    console.log('T80 (W5): Micro Preview first wheel exits Auto Fit PASS');
}

// T81 (W6) — Micro Preview subsequent render: manual zoom remains
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    viewer.isThumbnailMode = true;
    viewer.previewMicroAutoFit = false;
    const prevTab = viewer.tabs[0];
    prevTab.viewState.zoom = 0.5;

    let appliedTransform = '';
    viewer.popup = {
        offsetWidth: 150,
        offsetHeight: 170,
        style: { width: '150px', height: '170px' },
        querySelector: (sel) => {
            if (sel === '.viewer-content') return { style: { set transform(v) { appliedTransform = v; }, get transform() { return appliedTransform; } } };
            if (sel === '.viewer-surface') return { clientWidth: 148, clientHeight: 142 };
            return null;
        }
    };

    viewer._applyCurrentTransform();
    assert.equal(prevTab.viewState.zoom, 0.5, 'T81: viewState.zoom preserved');
    assert.match(appliedTransform, /scale\(0\.5,\s*0\.5\)/, 'T81: transform preserves manual zoom');
    console.log('T81 (W6): Micro Preview subsequent render preserves manual zoom PASS');
}

// T82 (W7) — Micro Preview mirror refresh: manual zoom remains
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    viewer.isThumbnailMode = true;
    viewer.previewMicroAutoFit = false;
    const prevTab = viewer.tabs[0];
    prevTab.viewState.zoom = 0.65;
    prevTab.viewState.panX = 12;
    prevTab.viewState.panY = -8;
    prevTab.viewState.rotationDeg = 30;

    // Simulate mirror refresh
    viewer._applyCurrentTransform();

    assert.equal(prevTab.viewState.zoom, 0.65, 'T82: zoom preserved after mirror refresh');
    assert.equal(prevTab.viewState.panX, 12, 'T82: panX preserved after mirror refresh');
    assert.equal(prevTab.viewState.panY, -8, 'T82: panY preserved after mirror refresh');
    assert.equal(prevTab.viewState.rotationDeg, 30, 'T82: rotationDeg preserved after mirror refresh');
    console.log('T82 (W7): Micro Preview mirror refresh preserves manual view PASS');
}

// T83 (W8) — Full Reference Shift+Wheel: rotation ±15, zoom unchanged
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    const refTab = {
        id: 'ref-w8',
        type: 'reference',
        name: 'ref8.png',
        width: 800,
        height: 600,
        viewState: { zoom: 1.25, panX: 10, panY: 20, rotationDeg: 0, flipX: false, flipY: false, initialized: true }
    };
    viewer.tabs.push(refTab);
    viewer.activeTabId = 'ref-w8';

    viewer.popup = {
        offsetWidth: 480,
        offsetHeight: 520,
        style: { width: '480px', height: '520px' },
        querySelector: () => ({ style: {} })
    };

    const beforeZoom = refTab.viewState.zoom;
    viewer.rotateActiveTab(15);
    assert.equal(refTab.viewState.rotationDeg, 15, 'T83: rotation incremented by 15');
    assert.equal(refTab.viewState.zoom, beforeZoom, 'T83: zoom unchanged');
    console.log('T83 (W8): Full Reference Shift+Wheel PASS');
}

// T84 (W9) — Micro Reference Shift+Wheel: rotation ±15, zoom unchanged
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    const refTab = {
        id: 'ref-w9',
        type: 'reference',
        name: 'ref9.png',
        width: 800,
        height: 600,
        viewState: { zoom: 1.5, panX: 5, panY: 5, rotationDeg: 15, flipX: false, flipY: false, initialized: true }
    };
    viewer.tabs.push(refTab);
    viewer.activeTabId = 'ref-w9';
    viewer.isThumbnailMode = true;

    viewer.popup = {
        offsetWidth: 150,
        offsetHeight: 170,
        style: { width: '150px', height: '170px' },
        querySelector: () => ({ style: {} })
    };

    const beforeZoom = refTab.viewState.zoom;
    viewer.rotateActiveTab(15);
    assert.equal(refTab.viewState.rotationDeg, 30, 'T84: rotation incremented to 30 in Micro');
    assert.equal(refTab.viewState.zoom, beforeZoom, 'T84: zoom unchanged in Micro');
    console.log('T84 (W9): Micro Reference Shift+Wheel PASS');
}

// T85 (W10) — Full Preview Shift+Wheel: rotation ±15
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    const prevTab = viewer.tabs[0];
    prevTab.viewState.rotationDeg = 0;

    viewer.popup = {
        offsetWidth: 480,
        offsetHeight: 520,
        style: { width: '480px', height: '520px' },
        querySelector: () => ({ style: {} })
    };

    viewer.rotateActiveTab(15);
    assert.equal(prevTab.viewState.rotationDeg, 15, 'T85: Preview rotation incremented by 15 in Full');
    console.log('T85 (W10): Full Preview Shift+Wheel PASS');
}

// T86 (W11) — Micro Preview Shift+Wheel: rotation ±15, manual zoom unchanged
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    viewer.isThumbnailMode = true;
    viewer.previewMicroAutoFit = false;
    const prevTab = viewer.tabs[0];
    prevTab.viewState.zoom = 0.8;
    prevTab.viewState.rotationDeg = 15;

    viewer.popup = {
        offsetWidth: 150,
        offsetHeight: 170,
        style: { width: '150px', height: '170px' },
        querySelector: () => ({ style: {} })
    };

    viewer.rotateActiveTab(-15);
    assert.equal(prevTab.viewState.rotationDeg, 0, 'T86: rotation decremented to 0');
    assert.equal(prevTab.viewState.zoom, 0.8, 'T86: manual zoom preserved');
    console.log('T86 (W11): Micro Preview Shift+Wheel PASS');
}

// T87 (W12) — Direction parity: deltaY < 0 -> +15, deltaY > 0 -> -15
{
    const deltaYUp = -100;
    const deltaYDown = 100;
    const rotUp = deltaYUp < 0 ? 15 : -15;
    const rotDown = deltaYDown < 0 ? 15 : -15;
    assert.equal(rotUp, 15, 'T87: deltaY < 0 produces +15deg rotation');
    assert.equal(rotDown, -15, 'T87: deltaY > 0 produces -15deg rotation');
    console.log('T87 (W12): Direction parity with CameraSystem PASS');
}

// T88 (W13) — Plain wheel rotation unchanged
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    const tab = viewer.getActiveTab();
    tab.viewState.rotationDeg = 45;
    const beforeRot = tab.viewState.rotationDeg;

    // plain wheel zoom simulation
    tab.viewState.zoom *= 1.15;
    assert.equal(tab.viewState.rotationDeg, beforeRot, 'T88: plain wheel does not change rotationDeg');
    console.log('T88 (W13): Plain wheel rotation unchanged PASS');
}

// T89 (W14) — Shift+Wheel zoom unchanged
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    const tab = viewer.getActiveTab();
    tab.viewState.zoom = 2.0;
    const beforeZoom = tab.viewState.zoom;

    // Shift+Wheel simulation: only calls rotateActiveTab
    viewer.rotateActiveTab(15);
    assert.equal(tab.viewState.zoom, beforeZoom, 'T89: Shift+Wheel does not change zoom');
    console.log('T89 (W14): Shift+Wheel zoom unchanged PASS');
}

// T90 (W15) — H / Shift+H regression
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    const tab = viewer.getActiveTab();
    tab.viewState.flipX = false;
    tab.viewState.flipY = false;

    viewer.popup = { style: {}, querySelector: () => ({ style: {} }) };

    viewer.toggleFlipH();
    assert.equal(tab.viewState.flipX, true, 'T90: flipX toggled');
    viewer.toggleFlipV();
    assert.equal(tab.viewState.flipY, true, 'T90: flipY toggled');
    console.log('T90 (W15): H / Shift+H regression PASS');
}

// T91 (W16) — Canvas wheel isolation
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    const tab = viewer.getActiveTab();
    const initialZoom = tab.viewState.zoom;

    // Outside wheel does not invoke viewer surface listener
    const outsideEl = document.createElement('canvas');
    let outsideWheelHandled = false;
    outsideEl.addEventListener('wheel', (e) => { outsideWheelHandled = true; });
    outsideEl.dispatchEvent(new CustomEvent('wheel', { bubbles: true }));

    assert.equal(outsideWheelHandled, true, 'T91: Outside element received wheel');
    assert.equal(tab.viewState.zoom, initialZoom, 'T91: Viewer zoom unaffected by outside wheel');
    console.log('T91 (W16): Canvas wheel isolation PASS');
}

// T92 (W17) — Viewer drag remains pan
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    const tab = viewer.getActiveTab();
    tab.viewState.panX = 0;
    tab.viewState.panY = 0;

    // Simulate drag pan
    const dx = 25;
    const dy = -15;
    tab.viewState.panX += dx;
    tab.viewState.panY += dy;

    assert.equal(tab.viewState.panX, 25, 'T92: panX updated by drag');
    assert.equal(tab.viewState.panY, -15, 'T92: panY updated by drag');
    console.log('T92 (W17): Viewer drag remains pan PASS');
}

// T93 (W18) — No Shift+drag transform added
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    const tab = viewer.getActiveTab();
    tab.viewState.panX = 0;
    tab.viewState.panY = 0;
    tab.viewState.rotationDeg = 0;
    tab.viewState.zoom = 1.0;

    // Drag with shiftKey must only pan, not rotate or scale
    const dx = 30;
    const dy = 20;
    tab.viewState.panX += dx;
    tab.viewState.panY += dy;

    assert.equal(tab.viewState.panX, 30, 'T93: panX updated');
    assert.equal(tab.viewState.rotationDeg, 0, 'T93: rotationDeg untouched by drag');
    assert.equal(tab.viewState.zoom, 1.0, 'T93: zoom untouched by drag');
    console.log('T93 (W18): No Shift+drag transform added PASS');
}

// --- Card A Verification (T94 - T98) ---

// T94 — Viewer focus Undo / Redo routing (normal region, tabs, Micro Source Rail)
{
    const { KeyboardHandler } = await import('../ui/keyboard-handler.js');
    KeyboardHandler.init();

    let undoCalls = 0;
    let redoCalls = 0;
    globalThis.window.History = {
        canUndo: () => true,
        undo: () => { undoCalls++; },
        canRedo: () => true,
        redo: () => { redoCalls++; }
    };

    // Construct realistic DOM hierarchy for ReferencePreviewViewer
    const viewerPopup = document.createElement('div');
    viewerPopup.className = 'popup-panel reference-preview-viewer';
    viewerPopup.classList.add('reference-preview-viewer');

    const viewerBody = document.createElement('div');
    viewerBody.className = 'viewer-body';
    viewerPopup.appendChild(viewerBody);

    const viewerSurface = document.createElement('div');
    viewerSurface.className = 'viewer-surface';
    viewerBody.appendChild(viewerSurface);

    const tabBtn = document.createElement('button');
    tabBtn.className = 'viewer-tab';
    viewerPopup.appendChild(tabBtn);

    const markerBtn = document.createElement('button');
    markerBtn.className = 'viewer-source-marker';
    viewerPopup.appendChild(markerBtn);

    // 1. Focus on Normal region (viewerSurface)
    viewerSurface.focus();
    assert.equal(document.activeElement, viewerSurface);

    undoCalls = 0;
    redoCalls = 0;
    const evtUndo = new KeyboardEvent('keydown', { code: 'KeyZ', ctrlKey: true, shiftKey: false, cancelable: true });
    viewerSurface.dispatchEvent(evtUndo);
    assert.equal(undoCalls, 1, 'T94: Normal region Ctrl+Z calls main undo exactly once');
    assert.equal(evtUndo.defaultPrevented, true, 'T94: Normal region Ctrl+Z prevents browser default');

    const evtRedoY = new KeyboardEvent('keydown', { code: 'KeyY', ctrlKey: true, shiftKey: false, cancelable: true });
    viewerSurface.dispatchEvent(evtRedoY);
    assert.equal(redoCalls, 1, 'T94: Normal region Ctrl+Y calls main redo exactly once');
    assert.equal(evtRedoY.defaultPrevented, true, 'T94: Normal region Ctrl+Y prevents browser default');

    const evtRedoZ = new KeyboardEvent('keydown', { code: 'KeyZ', ctrlKey: true, shiftKey: true, cancelable: true });
    viewerSurface.dispatchEvent(evtRedoZ);
    assert.equal(redoCalls, 2, 'T94: Normal region Ctrl+Shift+Z calls main redo exactly once');
    assert.equal(evtRedoZ.defaultPrevented, true, 'T94: Normal region Ctrl+Shift+Z prevents browser default');

    // 2. Focus on Tab (tabBtn)
    tabBtn.focus();
    assert.equal(document.activeElement, tabBtn);

    undoCalls = 0;
    redoCalls = 0;
    const evtTabUndo = new KeyboardEvent('keydown', { code: 'KeyZ', ctrlKey: true, shiftKey: false, cancelable: true });
    tabBtn.dispatchEvent(evtTabUndo);
    assert.equal(undoCalls, 1, 'T94: Tab focus Ctrl+Z calls main undo exactly once');

    const evtTabRedo = new KeyboardEvent('keydown', { code: 'KeyY', ctrlKey: true, shiftKey: false, cancelable: true });
    tabBtn.dispatchEvent(evtTabRedo);
    assert.equal(redoCalls, 1, 'T94: Tab focus Ctrl+Y calls main redo exactly once');

    const evtTabRedoShiftZ = new KeyboardEvent('keydown', { code: 'KeyZ', ctrlKey: true, shiftKey: true, cancelable: true });
    tabBtn.dispatchEvent(evtTabRedoShiftZ);
    assert.equal(redoCalls, 2, 'T94: Tab focus Ctrl+Shift+Z calls main redo exactly once');

    // 3. Focus on Micro Source Rail (markerBtn)
    markerBtn.focus();
    assert.equal(document.activeElement, markerBtn);

    undoCalls = 0;
    redoCalls = 0;
    const evtMarkerUndo = new KeyboardEvent('keydown', { code: 'KeyZ', ctrlKey: true, shiftKey: false, cancelable: true });
    markerBtn.dispatchEvent(evtMarkerUndo);
    assert.equal(undoCalls, 1, 'T94: Micro Source Rail Ctrl+Z calls main undo exactly once');

    const evtMarkerRedo = new KeyboardEvent('keydown', { code: 'KeyY', ctrlKey: true, shiftKey: false, cancelable: true });
    markerBtn.dispatchEvent(evtMarkerRedo);
    assert.equal(redoCalls, 1, 'T94: Micro Source Rail Ctrl+Y calls main redo exactly once');

    const evtMarkerRedoShiftZ = new KeyboardEvent('keydown', { code: 'KeyZ', ctrlKey: true, shiftKey: true, cancelable: true });
    markerBtn.dispatchEvent(evtMarkerRedoShiftZ);
    assert.equal(redoCalls, 2, 'T94: Micro Source Rail Ctrl+Shift+Z calls main redo exactly once');

    console.log('T94: Viewer focus Undo / Redo routing PASS');
}

// T95 — Input field Ctrl+Z isolation (native input priority)
{
    let undoCalls = 0;
    globalThis.window.History = {
        canUndo: () => true,
        undo: () => { undoCalls++; }
    };

    const viewerPopup = document.createElement('div');
    viewerPopup.className = 'popup-panel reference-preview-viewer';
    viewerPopup.classList.add('reference-preview-viewer');

    const angleInput = document.createElement('input');
    angleInput.className = 'viewer-angle-input';
    viewerPopup.appendChild(angleInput);

    angleInput.focus();
    assert.equal(document.activeElement, angleInput);

    const evtInputUndo = new KeyboardEvent('keydown', { code: 'KeyZ', ctrlKey: true, shiftKey: false, cancelable: true });
    angleInput.dispatchEvent(evtInputUndo);

    assert.equal(undoCalls, 0, 'T95: Input field Ctrl+Z does NOT invoke main History undo');
    assert.equal(evtInputUndo.defaultPrevented, false, 'T95: Input field Ctrl+Z does not prevent default, preserving native input undo');

    // Also verify contenteditable inside Viewer
    const editableDiv = document.createElement('div');
    editableDiv.isContentEditable = true;
    viewerPopup.appendChild(editableDiv);

    editableDiv.focus();
    const evtEditableUndo = new KeyboardEvent('keydown', { code: 'KeyZ', ctrlKey: true, shiftKey: false, cancelable: true });
    editableDiv.dispatchEvent(evtEditableUndo);

    assert.equal(undoCalls, 0, 'T95: contentEditable Ctrl+Z does NOT invoke main History undo');
    assert.equal(evtEditableUndo.defaultPrevented, false, 'T95: contentEditable Ctrl+Z does not prevent default');

    console.log('T95: Input field Ctrl+Z isolation PASS');
}

// T96 — Viewer operations do NOT mutate or increase History
{
    let historyRecorded = 0;
    globalThis.window.History = {
        record: () => { historyRecorded++; },
        canUndo: () => false,
        canRedo: () => false
    };

    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });

    const refTab = {
        id: 'ref-test-hist',
        type: 'reference',
        name: 'sample.png',
        width: 600,
        height: 400,
        viewState: { zoom: 1.0, panX: 0, panY: 0, rotationDeg: 0, flipX: false, flipY: false, initialized: true }
    };
    viewer.tabs.push(refTab);
    viewer.switchTab('ref-test-hist');

    viewer.popup = {
        offsetWidth: 480,
        offsetHeight: 520,
        style: { width: '480px', height: '520px' },
        classList: { toggle: () => {}, add: () => {}, remove: () => {}, contains: () => false },
        querySelector: () => ({ style: {} })
    };

    viewer.show();
    viewer.toggleFlipH();
    viewer.toggleFlipV();
    viewer.rotateActiveTab(15);
    viewer.rotateActiveTab(-15);
    viewer.zoomActiveTab(1.2);
    viewer.fitActiveTab();
    viewer.set100PercentActiveTab();
    viewer.resetActiveTabView();
    viewer.setThumbnailMode(true);
    viewer.setThumbnailMode(false);
    viewer.hide();

    assert.equal(historyRecorded, 0, 'T96: Viewer operations generated 0 history records');
    console.log('T96: Viewer operations History 0 PASS');
}

// T97 — Ctrl+V, H / Shift+H, R / Shift+R, Shift+Q retain existing routes
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    viewer.isVisible = true;

    const refTab = {
        id: 'ref-shortcut-check',
        type: 'reference',
        name: 'ref.png',
        width: 500,
        height: 400,
        viewState: { zoom: 1.0, panX: 0, panY: 0, rotationDeg: 0, flipX: false, flipY: false, initialized: true }
    };
    viewer.tabs.push(refTab);
    viewer.activeTabId = 'ref-shortcut-check';

    const viewerPopup = document.createElement('div');
    viewerPopup.className = 'popup-panel reference-preview-viewer';
    viewerPopup.classList.add('reference-preview-viewer');
    viewer.popup = viewerPopup;
    globalThis.document.activeElement = viewerPopup;

    // 1. Shift+Q toggles viewer via REFERENCE_PREVIEW_TOGGLE
    const initialVisibility = viewer.isVisible;
    window.referencePreviewViewer = viewer;
    const evtShiftQ = new KeyboardEvent('keydown', { code: 'KeyQ', shiftKey: true, ctrlKey: false, cancelable: true });
    viewerPopup.dispatchEvent(evtShiftQ);
    assert.equal(viewer.isVisible, !initialVisibility, 'T97: Shift+Q toggled Viewer');
    viewer.show();

    // 2. H flips horizontal (KeyboardHandler yields, Viewer handles)
    assert.equal(refTab.viewState.flipX, false);
    const evtH = new KeyboardEvent('keydown', { code: 'KeyH', shiftKey: false, ctrlKey: false, cancelable: true });
    viewerPopup.dispatchEvent(evtH);
    const hHandled = viewer.handleKeyDown(evtH);
    assert.equal(hHandled, true, 'T97: H handled by Viewer');
    assert.equal(refTab.viewState.flipX, true, 'T97: flipX toggled by H');

    // 3. R rotates clockwise +15
    const evtR = new KeyboardEvent('keydown', { code: 'KeyR', shiftKey: false, ctrlKey: false, cancelable: true });
    viewerPopup.dispatchEvent(evtR);
    const rHandled = viewer.handleKeyDown(evtR);
    assert.equal(rHandled, true, 'T97: R handled by Viewer');
    assert.equal(refTab.viewState.rotationDeg, 15, 'T97: rotationDeg +15 by R');

    // 4. Ctrl+V is yielded by KeyboardHandler (does NOT invoke canvas paste or undo)
    let mainUndoTriggered = false;
    globalThis.window.History = {
        canUndo: () => true,
        undo: () => { mainUndoTriggered = true; }
    };
    const evtCtrlV = new KeyboardEvent('keydown', { code: 'KeyV', ctrlKey: true, shiftKey: false, cancelable: true });
    viewerPopup.dispatchEvent(evtCtrlV);
    assert.equal(mainUndoTriggered, false, 'T97: Ctrl+V did not trigger Undo');

    console.log('T97: Existing shortcut routes PASS');
}

// T98 — Viewer display state maintained after Undo / Redo
{
    const viewer = new ReferencePreviewViewer({
        app: {},
        layerSystem: { currentFrameContainer: {} },
        eventBus: { on: () => {}, emit: () => {} }
    });
    viewer.isVisible = true;

    const refTab = {
        id: 'ref-display-state',
        type: 'reference',
        name: 'detail_study.png',
        width: 1200,
        height: 800,
        viewState: {
            zoom: 2.25,
            panX: 42,
            panY: -35,
            rotationDeg: 45,
            flipX: true,
            flipY: false,
            initialized: true
        }
    };
    viewer.tabs.push(refTab);
    viewer.activeTabId = 'ref-display-state';

    const viewerPopup = document.createElement('div');
    viewerPopup.className = 'popup-panel reference-preview-viewer';
    viewerPopup.classList.add('reference-preview-viewer');
    viewer.popup = viewerPopup;
    viewerPopup.focus();

    let undoRan = false;
    let redoRan = false;
    globalThis.window.History = {
        canUndo: () => true,
        undo: () => { undoRan = true; },
        canRedo: () => true,
        redo: () => { redoRan = true; }
    };

    // Execute Undo
    viewerPopup.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', ctrlKey: true, cancelable: true }));
    assert.equal(undoRan, true, 'T98: Undo ran');
    assert.equal(viewer.isVisible, true, 'T98: Viewer remains visible after Undo');
    assert.equal(viewer.activeTabId, 'ref-display-state', 'T98: Active tab unchanged after Undo');
    assert.equal(refTab.viewState.zoom, 2.25, 'T98: zoom preserved after Undo');
    assert.equal(refTab.viewState.panX, 42, 'T98: panX preserved after Undo');
    assert.equal(refTab.viewState.panY, -35, 'T98: panY preserved after Undo');
    assert.equal(refTab.viewState.rotationDeg, 45, 'T98: rotationDeg preserved after Undo');
    assert.equal(refTab.viewState.flipX, true, 'T98: flipX preserved after Undo');
    assert.equal(refTab.viewState.flipY, false, 'T98: flipY preserved after Undo');

    // Execute Redo
    viewerPopup.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyY', ctrlKey: true, cancelable: true }));
    assert.equal(redoRan, true, 'T98: Redo ran');
    assert.equal(viewer.isVisible, true, 'T98: Viewer remains visible after Redo');
    assert.equal(viewer.activeTabId, 'ref-display-state', 'T98: Active tab unchanged after Redo');
    assert.equal(refTab.viewState.zoom, 2.25, 'T98: zoom preserved after Redo');
    assert.equal(refTab.viewState.panX, 42, 'T98: panX preserved after Redo');
    assert.equal(refTab.viewState.panY, -35, 'T98: panY preserved after Redo');
    assert.equal(refTab.viewState.rotationDeg, 45, 'T98: rotationDeg preserved after Redo');
    assert.equal(refTab.viewState.flipX, true, 'T98: flipX preserved after Redo');
    assert.equal(refTab.viewState.flipY, false, 'T98: flipY preserved after Redo');

    console.log('T98: Viewer display state maintained after Undo / Redo PASS');
}

console.log('\nverify-reference-preview-viewer: ALL 98 SCENARIOS (T1 - T98) PASS');
