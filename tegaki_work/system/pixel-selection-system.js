/**
 * ============================================================================
 * ファイル名: system/pixel-selection-system.js
 * 責務: 通常Raster Layerのpixel selection状態、矩形入力、overlay、基本編集を管理する
 * 依存: coordinate-system.js, system/event-bus.js, system/history.js
 * 被依存: core-engine.js, core-runtime.js, ui/*
 * 公開API: PixelSelectionSystem
 * ============================================================================
 */

import { coordinateSystem } from '../coordinate-system.js';
import { TegakiEventBus } from './event-bus.js';
import { historyManager } from './history.js';
import { Sprite, Texture } from 'pixi.js';
import { applyTransformMatrix, createCenteredTransformMatrix } from './transform-math.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MIN_SELECTION_SIZE = 1;

export class PixelSelectionSystem {
    constructor() {
        this.app = null;
        this.layerSystem = null;
        this.cameraSystem = null;
        this.eventBus = TegakiEventBus;
        this.history = historyManager;
        this.coordSystem = coordinateSystem;
        this.toolActive = false;
        this.state = null;
        this.clipboard = null;
        this.drag = null;
        this.transformSession = null;
        this.overlay = null;
        this.overlayPolygon = null;
        this.canvas = null;
        this.overlayFrameRequest = null;
        this._detachCallbacks = [];
    }

    init({ app, layerSystem, cameraSystem, eventBus = TegakiEventBus } = {}) {
        this.app = app;
        this.layerSystem = layerSystem;
        this.cameraSystem = cameraSystem;
        this.eventBus = eventBus;
        this.canvas = app?.canvas || app?.view || null;
        this._createOverlay();
        this._bindCanvasEvents();
        this._bindKeyboardEvents();
        this._bindEventBus();
        this._updateOverlay();
    }

    isToolActive() {
        return this.toolActive;
    }

    hasSelection() {
        return Boolean(this.state?.active && this.state?.bounds);
    }

    getState() {
        if (!this.state) return null;
        return {
            active: this.state.active,
            layerId: this.state.layerId,
            bounds: { ...this.state.bounds },
            mode: this.state.mode,
            transformSessionActive: this.state.transformSessionActive === true
        };
    }

    getBoundsForLayer(layerId) {
        if (!this.hasSelection() || this.state.layerId !== layerId) return null;
        return { ...this.state.bounds };
    }

    constrainLayerToSelection(layer, beforeSnapshot) {
        const layerId = layer?.layerData?.id;
        const bounds = this.getBoundsForLayer(layerId);
        if (!bounds || this.transformSession || !beforeSnapshot) return false;
        const afterSnapshot = this.layerSystem?.createLayerRasterSnapshot?.(layer);
        if (!afterSnapshot || afterSnapshot.width !== beforeSnapshot.width
            || afterSnapshot.height !== beforeSnapshot.height) {
            return false;
        }

        const x0 = Math.max(0, Math.floor(bounds.x));
        const y0 = Math.max(0, Math.floor(bounds.y));
        const x1 = Math.min(afterSnapshot.width, Math.ceil(bounds.x + bounds.width));
        const y1 = Math.min(afterSnapshot.height, Math.ceil(bounds.y + bounds.height));
        for (let y = 0; y < afterSnapshot.height; y++) {
            if (y >= y0 && y < y1) {
                const rowStart = y * afterSnapshot.width * 4;
                afterSnapshot.pixels.set(
                    beforeSnapshot.pixels.subarray(rowStart, rowStart + (x0 * 4)),
                    rowStart
                );
                afterSnapshot.pixels.set(
                    beforeSnapshot.pixels.subarray(
                        rowStart + (x1 * 4),
                        rowStart + (afterSnapshot.width * 4)
                    ),
                    rowStart + (x1 * 4)
                );
            } else {
                const rowStart = y * afterSnapshot.width * 4;
                afterSnapshot.pixels.set(
                    beforeSnapshot.pixels.subarray(
                        rowStart,
                        rowStart + (afterSnapshot.width * 4)
                    ),
                    rowStart
                );
            }
        }
        afterSnapshot.paths = [];
        afterSnapshot.pathsData = [];
        return this.layerSystem.restoreLayerRasterSnapshot(afterSnapshot) === true;
    }

    getTransform() {
        const transform = this.transformSession?.transform;
        return transform ? { ...transform } : null;
    }

    updateTransform(property, value) {
        const session = this.transformSession;
        if (!session) return false;
        const transform = session.transform;
        switch (property) {
            case 'x':
            case 'y':
                transform[property] = Number(value) || 0;
                break;
            case 'rotation':
                transform.rotation = Number(value) || 0;
                break;
            case 'scale': {
                const scale = Math.max(
                    this.layerSystem?.config?.layer?.minScale ?? 0.05,
                    Math.min(this.layerSystem?.config?.layer?.maxScale ?? 8, Number(value) || 1)
                );
                transform.scaleX = transform.scaleX < 0 ? -scale : scale;
                transform.scaleY = transform.scaleY < 0 ? -scale : scale;
                break;
            }
            default:
                return false;
        }
        this._applyFloatingTransform();
        return true;
    }

    flipTransform(direction) {
        const transform = this.transformSession?.transform;
        if (!transform) return false;
        if (direction === 'horizontal') {
            transform.scaleX *= -1;
        } else if (direction === 'vertical') {
            transform.scaleY *= -1;
        } else {
            return false;
        }
        this._applyFloatingTransform();
        return true;
    }

    resetTransform() {
        const session = this.transformSession;
        if (!session) return false;
        session.transform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
        this._applyFloatingTransform();
        return true;
    }

    setToolActive(active) {
        const nextActive = active === true;
        if (this.toolActive === nextActive) return true;
        this.toolActive = nextActive;
        this.drag = null;
        this._syncCursor();
        this._updateOverlay();
        this.eventBus?.emit('selection:tool-changed', { active: nextActive });
        return true;
    }

    clearSelection(reason = 'explicit') {
        if (this.transformSession) {
            this.cancelTransform('selection-cleared');
        }
        const previous = this.getState();
        this.state = null;
        this.drag = null;
        this._updateOverlay();
        this.eventBus?.emit('selection:cleared', { reason, previous });
        return Boolean(previous);
    }

    selectAll() {
        const layer = this._getEligibleActiveLayer();
        if (!layer) return false;

        const width = Math.max(1, Math.round(layer.layerData.renderTexture.width));
        const height = Math.max(1, Math.round(layer.layerData.renderTexture.height));
        this.state = {
            active: true,
            layerId: layer.layerData.id,
            bounds: { x: 0, y: 0, width, height },
            mode: 'rectangle',
            transformSessionActive: false
        };
        this.setToolActive(true);
        this._scheduleOverlayUpdate();
        this.eventBus?.emit('selection:changed', {
            ...this.getState(),
            action: 'select-all'
        });
        return true;
    }

    requestTransform() {
        if (!this.hasSelection()) return false;
        if (this.transformSession) {
            return this.confirmTransform();
        }
        const started = this._startFloatingSession({ kind: 'move-selection' });
        if (!started) return false;
        this.eventBus?.emit('selection:transform-requested', {
            ...this.getState(),
            source: 'keyboard'
        });
        return true;
    }

    pasteSelection() {
        if (!this.clipboard) return false;
        if (this.transformSession && !this.confirmTransform()) return false;

        const layer = this._getEligibleActiveLayer();
        if (!layer) return false;
        const width = Math.max(1, Math.round(layer.layerData.renderTexture.width));
        const height = Math.max(1, Math.round(layer.layerData.renderTexture.height));
        const sourceBounds = this.clipboard.sourceBounds || {};
        const x = Math.max(0, Math.min(width - this.clipboard.width, Math.round(sourceBounds.x || 0)));
        const y = Math.max(0, Math.min(height - this.clipboard.height, Math.round(sourceBounds.y || 0)));

        this.state = {
            active: true,
            layerId: layer.layerData.id,
            bounds: {
                x,
                y,
                width: this.clipboard.width,
                height: this.clipboard.height
            },
            mode: 'rectangle',
            transformSessionActive: false
        };
        this.setToolActive(true);
        return this._startFloatingSession({
            kind: 'paste',
            pixels: new Uint8ClampedArray(this.clipboard.pixels),
            width: this.clipboard.width,
            height: this.clipboard.height,
            cutSource: false
        });
    }

    confirmTransform() {
        const session = this.transformSession;
        if (!session) return false;

        const after = {
            ...session.baseSnapshot,
            pixels: new Uint8ClampedArray(session.baseSnapshot.pixels),
            paths: [],
            pathsData: []
        };
        const transformed = this._renderTransformedRegion(session);
        if (!transformed) return false;
        this._blendRegion(
            after.pixels,
            after.width,
            after.height,
            transformed.pixels,
            transformed.width,
            transformed.height,
            0,
            0
        );

        this._destroyFloatingPreview();
        if (!this.layerSystem.restoreLayerRasterSnapshot(after)) {
            this.layerSystem.restoreLayerRasterSnapshot(session.beforeSnapshot);
            this._finishTransformSession(false);
            return false;
        }

        const before = session.beforeSnapshot;
        const layerId = before.layerId;
        const initialBounds = { ...session.initialBounds };
        const finalBounds = { ...this.state.bounds };
        const restore = (snapshot, bounds) => {
            const restored = this.layerSystem.restoreLayerRasterSnapshot(snapshot);
            if (restored && this.state?.layerId === layerId) {
                this.state.bounds = { ...bounds };
                this._scheduleOverlayUpdate();
            }
        };
        this.history.record({
            name: session.kind === 'paste' ? 'selection-paste' : 'selection-move',
            do: () => restore(after, finalBounds),
            undo: () => restore(before, initialBounds),
            byteSize: (before.pixels?.byteLength || 0) + (after.pixels?.byteLength || 0),
            meta: {
                type: 'pixel-selection',
                action: session.kind === 'paste' ? 'paste' : 'move',
                layerId,
                bounds: finalBounds,
                transform: { ...session.transform }
            }
        });
        this._finishTransformSession(true);
        this.eventBus?.emit('selection:transform-confirmed', {
            ...this.getState(),
            kind: session.kind
        });
        return true;
    }

    cancelTransform(reason = 'escape') {
        const session = this.transformSession;
        if (!session) return false;
        this._destroyFloatingPreview();
        this.layerSystem.restoreLayerRasterSnapshot(session.beforeSnapshot);
        this.state.bounds = { ...session.initialBounds };
        this._finishTransformSession(false);
        this.eventBus?.emit('selection:transform-cancelled', {
            ...this.getState(),
            reason,
            kind: session.kind
        });
        return true;
    }

    copySelection() {
        const context = this._getSelectionContext();
        if (!context) return false;
        const snapshot = this.layerSystem.createLayerRasterSnapshot(context.layer);
        if (!snapshot) return false;
        const region = this._extractRegion(snapshot, context.bounds);
        if (!region) return false;

        this.clipboard = {
            sourceLayerId: context.layer.layerData.id,
            sourceBounds: { ...context.bounds },
            width: region.width,
            height: region.height,
            pixels: region.pixels
        };
        this.eventBus?.emit('selection:clipboard-changed', {
            available: true,
            width: region.width,
            height: region.height
        });
        return true;
    }

    deleteSelection() {
        const context = this._getSelectionContext();
        if (!context) return false;
        const before = this.layerSystem.createLayerRasterSnapshot(context.layer);
        if (!before) return false;

        const after = {
            ...before,
            pixels: new Uint8ClampedArray(before.pixels),
            paths: [],
            pathsData: []
        };
        this._clearRegion(after.pixels, after.width, context.bounds);
        if (!this.layerSystem.restoreLayerRasterSnapshot(after)) return false;

        const layerId = before.layerId;
        const restore = snapshot => {
            const restored = this.layerSystem.restoreLayerRasterSnapshot(snapshot);
            if (restored && this.state?.layerId === layerId) this._updateOverlay();
        };
        this.history.record({
            name: 'selection-delete',
            do: () => restore(after),
            undo: () => restore(before),
            byteSize: (before.pixels?.byteLength || 0) + (after.pixels?.byteLength || 0),
            meta: {
                type: 'pixel-selection',
                action: 'delete',
                layerId,
                bounds: { ...context.bounds }
            }
        });
        this.eventBus?.emit('selection:changed', {
            ...this.getState(),
            action: 'delete'
        });
        return true;
    }

    destroy() {
        this._detachCallbacks.forEach(detach => detach());
        this._detachCallbacks = [];
        this.overlay?.remove();
        this.overlay = null;
        this.overlayPolygon = null;
        this.state = null;
        this.drag = null;
        this._destroyFloatingPreview();
        this.transformSession = null;
        if (this.overlayFrameRequest !== null) {
            cancelAnimationFrame(this.overlayFrameRequest);
            this.overlayFrameRequest = null;
        }
    }

    _createOverlay() {
        const host = document.querySelector('.canvas-area') || document.body;
        if (!host || this.overlay) return;
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.classList.add('pixel-selection-overlay');
        svg.setAttribute('aria-hidden', 'true');
        const polygon = document.createElementNS(SVG_NS, 'polygon');
        polygon.classList.add('pixel-selection-marquee');
        svg.appendChild(polygon);
        host.appendChild(svg);
        this.overlay = svg;
        this.overlayPolygon = polygon;
    }

    _bindCanvasEvents() {
        if (!this.canvas) return;
        const onPointerDown = event => this._handlePointerDown(event);
        const onPointerMove = event => this._handlePointerMove(event);
        const onPointerUp = event => this._handlePointerUp(event);
        const onPointerCancel = event => this._handlePointerCancel(event);
        this.canvas.addEventListener('pointerdown', onPointerDown, true);
        this.canvas.addEventListener('pointermove', onPointerMove, true);
        this.canvas.addEventListener('pointerup', onPointerUp, true);
        this.canvas.addEventListener('pointercancel', onPointerCancel, true);
        this._detachCallbacks.push(() => {
            this.canvas?.removeEventListener('pointerdown', onPointerDown, true);
            this.canvas?.removeEventListener('pointermove', onPointerMove, true);
            this.canvas?.removeEventListener('pointerup', onPointerUp, true);
            this.canvas?.removeEventListener('pointercancel', onPointerCancel, true);
        });
    }

    _bindKeyboardEvents() {
        const onKeyDown = event => {
            if (this._isTextInputFocused()) return;
            if (event.key === 'Escape' && this.transformSession) {
                this.cancelTransform('escape');
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }
            if (event.key === 'Escape' && this.hasSelection() && !this.layerSystem?.vKeyPressed) {
                this.clearSelection('escape');
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }
            if (
                event.code === 'KeyH'
                && !event.ctrlKey
                && !event.altKey
                && !event.metaKey
                && this.transformSession
            ) {
                this.flipTransform(event.shiftKey ? 'vertical' : 'horizontal');
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }

            const primaryModifier = event.ctrlKey || event.metaKey;
            if (primaryModifier && !event.shiftKey && !event.altKey && event.code === 'KeyD') {
                if (this.hasSelection()) {
                    if (this.transformSession && !this.confirmTransform()) return;
                    this.clearSelection('shortcut');
                }
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }
            if (primaryModifier && !event.shiftKey && !event.altKey && event.code === 'KeyV') {
                if (this.pasteSelection()) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                }
                return;
            }
            if (!this.hasSelection()) return;
            if (primaryModifier && !event.shiftKey && !event.altKey && event.code === 'KeyC') {
                if (this.copySelection()) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                }
                return;
            }
            if (primaryModifier && !event.shiftKey && !event.altKey && event.code === 'KeyX') {
                if (this.copySelection() && this.deleteSelection()) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                }
                return;
            }
            if (!primaryModifier && !event.shiftKey && !event.altKey
                && (event.key === 'Delete' || event.key === 'Backspace')) {
                if (this.deleteSelection()) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                }
            }
        };
        document.addEventListener('keydown', onKeyDown, true);
        this._detachCallbacks.push(() => document.removeEventListener('keydown', onKeyDown, true));
    }

    _bindEventBus() {
        if (!this.eventBus) return;
        const subscriptions = [
            ['camera:transform-changed', () => this._scheduleOverlayUpdate()],
            ['layer:transform-updated', () => this._scheduleOverlayUpdate()],
            ['camera:resized', () => this.clearSelection('canvas-resized')],
            ['canvas:resized', () => this.clearSelection('canvas-resized')],
            ['layer:activated', ({ layerId } = {}) => {
                if (this.state?.layerId && layerId !== this.state.layerId) {
                    this.clearSelection('layer-activated');
                }
            }],
            ['layer:deleted', ({ layerId } = {}) => {
                if (this.state?.layerId === layerId) this.clearSelection('layer-deleted');
            }],
            ['tool:changed', ({ tool } = {}) => {
                if (tool && tool !== 'selection' && this.toolActive) this.setToolActive(false);
            }],
            ['brush:mode-changed', (payload = {}) => {
                const tool = payload.tool || payload.mode || payload.data?.tool || payload.data?.mode;
                if (tool && tool !== 'selection' && this.toolActive) this.setToolActive(false);
            }],
            ['ui:sidebar:sync-tool', ({ tool } = {}) => {
                if (tool && tool !== 'selection' && this.toolActive) this.setToolActive(false);
            }]
        ];
        subscriptions.forEach(([name, handler]) => {
            this.eventBus.on(name, handler);
            this._detachCallbacks.push(() => this.eventBus.off(name, handler));
        });
    }

    _handlePointerDown(event) {
        if (!this.toolActive || event.button !== 0) return;
        if (this.cameraSystem?.isCanvasMoveMode?.() || this.layerSystem?.vKeyPressed) return;
        const layer = this._getEligibleActiveLayer();
        if (!layer) return;
        const point = this._clientToLayerPoint(event.clientX, event.clientY, layer);
        if (!point) return;

        if (this.transformSession) {
            if (!this._pointInTransform(point, this.transformSession)) return;
            this.drag = {
                type: 'transform-move',
                pointerId: event.pointerId,
                layer,
                start: point,
                startTransform: { ...this.transformSession.transform },
                transformMode: null
            };
            try {
                this.canvas?.setPointerCapture?.(event.pointerId);
            } catch {
                // Pointer capture is optional.
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }

        this.drag = {
            type: 'selection-create',
            pointerId: event.pointerId,
            layer,
            start: point,
            current: point
        };
        this.state = {
            active: true,
            layerId: layer.layerData.id,
            bounds: this._boundsFromPoints(point, point),
            mode: 'rectangle',
            transformSessionActive: false
        };
        try {
            this.canvas?.setPointerCapture?.(event.pointerId);
        } catch {
            // Pointer capture is optional.
        }
        this._updateOverlay();
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    _handlePointerMove(event) {
        if (!this.drag || event.pointerId !== this.drag.pointerId) return;
        const point = this._clientToLayerPoint(event.clientX, event.clientY, this.drag.layer);
        if (!point) return;

        if (this.drag.type === 'transform-move' && this.transformSession) {
            const dx = point.x - this.drag.start.x;
            const dy = point.y - this.drag.start.y;
            const transform = this.transformSession.transform;
            const start = this.drag.startTransform;
            if (event.shiftKey) {
                if (!this.drag.transformMode) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) < 1) return;
                    this.drag.transformMode = Math.abs(dy) >= Math.abs(dx) ? 'scale' : 'rotate';
                }
                if (this.drag.transformMode === 'scale') {
                    const factor = Math.max(0.05, 1 - (dy * 0.01));
                    const minScale = this.layerSystem?.config?.layer?.minScale ?? 0.05;
                    const maxScale = this.layerSystem?.config?.layer?.maxScale ?? 8;
                    const scaleX = Math.max(minScale, Math.min(maxScale, Math.abs(start.scaleX) * factor));
                    const scaleY = Math.max(minScale, Math.min(maxScale, Math.abs(start.scaleY) * factor));
                    transform.scaleX = start.scaleX < 0 ? -scaleX : scaleX;
                    transform.scaleY = start.scaleY < 0 ? -scaleY : scaleY;
                    transform.rotation = start.rotation;
                    transform.x = start.x;
                    transform.y = start.y;
                } else {
                    transform.rotation = start.rotation + (dx * 0.02);
                    transform.scaleX = start.scaleX;
                    transform.scaleY = start.scaleY;
                    transform.x = start.x;
                    transform.y = start.y;
                }
            } else {
                transform.x = start.x + dx;
                transform.y = start.y + dy;
                transform.rotation = start.rotation;
                transform.scaleX = start.scaleX;
                transform.scaleY = start.scaleY;
                this.drag.transformMode = null;
            }
            this._applyFloatingTransform();
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }

        this.drag.current = point;
        this.state.bounds = this._boundsFromPoints(this.drag.start, point);
        this._updateOverlay();
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    _handlePointerUp(event) {
        if (!this.drag || event.pointerId !== this.drag.pointerId) return;
        const dragType = this.drag.type;
        if (dragType === 'transform-move') {
            this.drag = null;
            try {
                this.canvas?.releasePointerCapture?.(event.pointerId);
            } catch {
                // Pointer capture is optional.
            }
            this.eventBus?.emit('selection:transform-preview-updated', this.getState());
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }

        const bounds = this.state?.bounds;
        const valid = bounds
            && bounds.width >= MIN_SELECTION_SIZE
            && bounds.height >= MIN_SELECTION_SIZE;
        this.drag = null;
        try {
            this.canvas?.releasePointerCapture?.(event.pointerId);
        } catch {
            // Pointer capture is optional.
        }

        if (!valid) {
            this.clearSelection('empty-drag');
        } else {
            this.eventBus?.emit('selection:changed', {
                ...this.getState(),
                action: 'create'
            });
            this._updateOverlay();
        }
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    _handlePointerCancel(event) {
        if (!this.drag || event.pointerId !== this.drag.pointerId) return;
        if (this.drag.type === 'transform-move') {
            this.drag = null;
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        this.clearSelection('pointer-cancel');
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    _getEligibleActiveLayer() {
        const layer = this.layerSystem?.getActiveLayer?.();
        const data = layer?.layerData;
        if (!layer || !data?.renderTexture) return null;
        if (data.isBackground || data.isFolder || data.isAnimationWorkingLayer === true) return null;
        return layer;
    }

    _getSelectionContext() {
        if (!this.hasSelection()) return null;
        const layer = this.layerSystem?.getLayers?.()
            ?.find(candidate => candidate.layerData?.id === this.state.layerId);
        if (!layer || layer !== this._getEligibleActiveLayer()) return null;
        return { layer, bounds: { ...this.state.bounds } };
    }

    _clientToLayerPoint(clientX, clientY, layer) {
        const local = this.coordSystem?.screenClientToLocal?.(clientX, clientY, layer);
        if (!local || !Number.isFinite(local.localX) || !Number.isFinite(local.localY)) return null;
        const width = Math.max(1, Math.round(layer.layerData.renderTexture.width));
        const height = Math.max(1, Math.round(layer.layerData.renderTexture.height));
        return {
            x: Math.max(0, Math.min(width, local.localX)),
            y: Math.max(0, Math.min(height, local.localY))
        };
    }

    _boundsFromPoints(a, b) {
        const left = Math.min(a.x, b.x);
        const top = Math.min(a.y, b.y);
        const right = Math.max(a.x, b.x);
        const bottom = Math.max(a.y, b.y);
        return {
            x: left,
            y: top,
            width: right - left,
            height: bottom - top
        };
    }

    _startFloatingSession(options = {}) {
        const context = this._getSelectionContext();
        if (!context || this.transformSession) return false;
        const beforeSnapshot = this.layerSystem.createLayerRasterSnapshot(context.layer);
        if (!beforeSnapshot) return false;

        const region = options.pixels
            ? {
                pixels: new Uint8ClampedArray(options.pixels),
                width: options.width,
                height: options.height
            }
            : this._extractRegion(beforeSnapshot, context.bounds);
        if (!region?.pixels || region.width < 1 || region.height < 1) return false;

        const baseSnapshot = {
            ...beforeSnapshot,
            pixels: new Uint8ClampedArray(beforeSnapshot.pixels),
            paths: structuredClone(beforeSnapshot.paths || []),
            pathsData: structuredClone(beforeSnapshot.pathsData || [])
        };
        const cutSource = options.cutSource !== false && options.kind !== 'paste';
        if (cutSource) {
            this._clearRegion(baseSnapshot.pixels, baseSnapshot.width, context.bounds);
            baseSnapshot.paths = [];
            baseSnapshot.pathsData = [];
        }
        if (!this.layerSystem.restoreLayerRasterSnapshot(baseSnapshot)) return false;

        const sprite = this._createFloatingSprite(region.pixels, region.width, region.height);
        if (!sprite) {
            this.layerSystem.restoreLayerRasterSnapshot(beforeSnapshot);
            return false;
        }
        const x = Math.round(context.bounds.x);
        const y = Math.round(context.bounds.y);
        sprite.position.set(x, y);
        context.layer.addChild(sprite);

        this.transformSession = {
            kind: options.kind || 'move-selection',
            layer: context.layer,
            beforeSnapshot,
            baseSnapshot,
            initialBounds: { ...context.bounds },
            pixels: region.pixels,
            width: region.width,
            height: region.height,
            canvasWidth: beforeSnapshot.width,
            canvasHeight: beforeSnapshot.height,
            originX: x,
            originY: y,
            transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            sprite
        };
        sprite.pivot.set(region.width / 2, region.height / 2);
        this._applyFloatingTransform();
        this.state.transformSessionActive = true;
        this._syncCursor();
        this._scheduleOverlayUpdate();
        this.eventBus?.emit('selection:transform-started', {
            ...this.getState(),
            kind: this.transformSession.kind
        });
        return true;
    }

    _createFloatingSprite(pixels, width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0);
        const texture = Texture.from(canvas);
        const sprite = new Sprite(texture);
        sprite.label = 'pixel_selection_floating_preview';
        sprite._pixelSelectionSourceCanvas = canvas;
        return sprite;
    }

    _destroyFloatingPreview() {
        const sprite = this.transformSession?.sprite;
        if (sprite?.parent) sprite.parent.removeChild(sprite);
        sprite?.destroy?.({ texture: true, baseTexture: true });
    }

    _applyFloatingTransform() {
        const session = this.transformSession;
        if (!session?.sprite) return false;
        const transform = session.transform;
        session.sprite.position.set(
            session.originX + (session.width / 2) + transform.x,
            session.originY + (session.height / 2) + transform.y
        );
        session.sprite.rotation = transform.rotation;
        session.sprite.scale.set(transform.scaleX, transform.scaleY);
        this.state.bounds = this._getTransformedBounds(session);
        this._scheduleOverlayUpdate();
        this.eventBus?.emit('selection:transform-preview-updated', {
            ...this.getState(),
            transform: { ...transform }
        });
        return true;
    }

    _getTransformedCorners(session) {
        const transform = session.transform;
        const centerX = session.originX + (session.width / 2);
        const centerY = session.originY + (session.height / 2);
        const matrix = createCenteredTransformMatrix(transform, centerX, centerY);
        return [
            [session.originX, session.originY],
            [session.originX + session.width, session.originY],
            [session.originX + session.width, session.originY + session.height],
            [session.originX, session.originY + session.height]
        ].map(([x, y]) => applyTransformMatrix(matrix, x, y));
    }

    _getTransformedBounds(session) {
        const corners = this._getTransformedCorners(session);
        const xs = corners.map(point => point.x);
        const ys = corners.map(point => point.y);
        const left = Math.min(...xs);
        const top = Math.min(...ys);
        return {
            x: left,
            y: top,
            width: Math.max(...xs) - left,
            height: Math.max(...ys) - top
        };
    }

    _pointInTransform(point, session) {
        const transform = session.transform;
        const centerX = session.originX + (session.width / 2) + transform.x;
        const centerY = session.originY + (session.height / 2) + transform.y;
        const dx = point.x - centerX;
        const dy = point.y - centerY;
        const cos = Math.cos(-transform.rotation);
        const sin = Math.sin(-transform.rotation);
        const scaleX = Math.abs(transform.scaleX) || 1;
        const scaleY = Math.abs(transform.scaleY) || 1;
        const localX = ((dx * cos) - (dy * sin)) / scaleX;
        const localY = ((dx * sin) + (dy * cos)) / scaleY;
        return Math.abs(localX) <= session.width / 2
            && Math.abs(localY) <= session.height / 2;
    }

    _renderTransformedRegion(session) {
        const source = session.sprite?._pixelSelectionSourceCanvas;
        if (!source) return null;
        const canvas = document.createElement('canvas');
        canvas.width = session.canvasWidth;
        canvas.height = session.canvasHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        const transform = session.transform;
        ctx.translate(
            session.originX + (session.width / 2) + transform.x,
            session.originY + (session.height / 2) + transform.y
        );
        ctx.rotate(transform.rotation);
        ctx.scale(transform.scaleX, transform.scaleY);
        ctx.drawImage(source, -session.width / 2, -session.height / 2);
        return {
            width: canvas.width,
            height: canvas.height,
            pixels: ctx.getImageData(0, 0, canvas.width, canvas.height).data
        };
    }

    _finishTransformSession(confirmed) {
        if (this.state) this.state.transformSessionActive = false;
        this.drag = null;
        this.transformSession = null;
        this._syncCursor();
        this._scheduleOverlayUpdate();
        this.eventBus?.emit('selection:transform-ended', {
            ...this.getState(),
            confirmed
        });
    }

    _pointInBounds(point, bounds) {
        return point.x >= bounds.x
            && point.y >= bounds.y
            && point.x <= bounds.x + bounds.width
            && point.y <= bounds.y + bounds.height;
    }

    _updateOverlay() {
        if (!this.overlay || !this.overlayPolygon) return;
        const context = this._getSelectionContext();
        if (!context) {
            this.overlay.classList.remove('is-visible');
            this.overlayPolygon.removeAttribute('points');
            return;
        }

        const corners = this.transformSession
            ? this._getTransformedCorners(this.transformSession)
            : [
                { x: context.bounds.x, y: context.bounds.y },
                { x: context.bounds.x + context.bounds.width, y: context.bounds.y },
                {
                    x: context.bounds.x + context.bounds.width,
                    y: context.bounds.y + context.bounds.height
                },
                { x: context.bounds.x, y: context.bounds.y + context.bounds.height }
            ];
        const screenPoints = corners.map(({ x: localX, y: localY }) => {
            const transform = context.layer.worldTransform || context.layer.transform?.worldTransform;
            if (transform?.apply) {
                const canvasPoint = transform.apply({ x: localX, y: localY });
                return this.coordSystem.canvasToScreen(canvasPoint.x, canvasPoint.y);
            }
            const world = this.coordSystem.localToWorld(localX, localY, context.layer);
            return this.coordSystem.worldToScreen(world.worldX, world.worldY);
        });
        if (screenPoints.some(point => !Number.isFinite(point?.clientX) || !Number.isFinite(point?.clientY))) {
            this.overlay.classList.remove('is-visible');
            return;
        }

        this.overlayPolygon.setAttribute(
            'points',
            screenPoints.map(point => `${point.clientX},${point.clientY}`).join(' ')
        );
        this.overlay.classList.add('is-visible');
    }

    _scheduleOverlayUpdate() {
        this._updateOverlay();
        if (this.overlayFrameRequest !== null) {
            cancelAnimationFrame(this.overlayFrameRequest);
        }
        this.overlayFrameRequest = requestAnimationFrame(() => {
            this.overlayFrameRequest = null;
            this._updateOverlay();
        });
    }

    _extractRegion(snapshot, bounds) {
        const x0 = Math.max(0, Math.floor(bounds.x));
        const y0 = Math.max(0, Math.floor(bounds.y));
        const x1 = Math.min(snapshot.width, Math.ceil(bounds.x + bounds.width));
        const y1 = Math.min(snapshot.height, Math.ceil(bounds.y + bounds.height));
        const width = x1 - x0;
        const height = y1 - y0;
        if (width < 1 || height < 1) return null;

        const pixels = new Uint8ClampedArray(width * height * 4);
        for (let y = 0; y < height; y++) {
            const sourceStart = ((y0 + y) * snapshot.width + x0) * 4;
            const targetStart = y * width * 4;
            pixels.set(snapshot.pixels.subarray(sourceStart, sourceStart + width * 4), targetStart);
        }
        return { width, height, pixels };
    }

    _clearRegion(pixels, snapshotWidth, bounds) {
        const x0 = Math.max(0, Math.floor(bounds.x));
        const y0 = Math.max(0, Math.floor(bounds.y));
        const x1 = Math.min(snapshotWidth, Math.ceil(bounds.x + bounds.width));
        const snapshotHeight = Math.floor(pixels.length / 4 / snapshotWidth);
        const y1 = Math.min(snapshotHeight, Math.ceil(bounds.y + bounds.height));
        for (let y = y0; y < y1; y++) {
            pixels.fill(0, (y * snapshotWidth + x0) * 4, (y * snapshotWidth + x1) * 4);
        }
    }

    _blendRegion(target, targetWidth, targetHeight, source, sourceWidth, sourceHeight, targetX, targetY) {
        for (let sy = 0; sy < sourceHeight; sy++) {
            const ty = targetY + sy;
            if (ty < 0 || ty >= targetHeight) continue;
            for (let sx = 0; sx < sourceWidth; sx++) {
                const tx = targetX + sx;
                if (tx < 0 || tx >= targetWidth) continue;
                const sourceIndex = (sy * sourceWidth + sx) * 4;
                const sourceAlpha = source[sourceIndex + 3] / 255;
                if (sourceAlpha <= 0) continue;
                const targetIndex = (ty * targetWidth + tx) * 4;
                if (sourceAlpha >= 1 || target[targetIndex + 3] === 0) {
                    target[targetIndex] = source[sourceIndex];
                    target[targetIndex + 1] = source[sourceIndex + 1];
                    target[targetIndex + 2] = source[sourceIndex + 2];
                    target[targetIndex + 3] = source[sourceIndex + 3];
                    continue;
                }
                const targetAlpha = target[targetIndex + 3] / 255;
                const outAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);
                target[targetIndex] = Math.round(
                    (source[sourceIndex] * sourceAlpha
                        + target[targetIndex] * targetAlpha * (1 - sourceAlpha)) / outAlpha
                );
                target[targetIndex + 1] = Math.round(
                    (source[sourceIndex + 1] * sourceAlpha
                        + target[targetIndex + 1] * targetAlpha * (1 - sourceAlpha)) / outAlpha
                );
                target[targetIndex + 2] = Math.round(
                    (source[sourceIndex + 2] * sourceAlpha
                        + target[targetIndex + 2] * targetAlpha * (1 - sourceAlpha)) / outAlpha
                );
                target[targetIndex + 3] = Math.round(outAlpha * 255);
            }
        }
    }

    _syncCursor() {
        this.canvas?.classList.toggle('pixel-selection-tool-active', this.toolActive);
    }

    _isTextInputFocused() {
        const active = document.activeElement;
        return Boolean(active && (
            active.tagName === 'INPUT'
            || active.tagName === 'TEXTAREA'
            || active.tagName === 'SELECT'
            || active.isContentEditable
        ));
    }
}

window.PixelSelectionSystem = PixelSelectionSystem;
