/**
 * ============================================================================
 * ファイル名: system/pixel-selection-system.js
 * 責務: 通常Raster Layer / Folderのpixel selection状態、矩形入力、clipboard、基本編集を管理する
 * 依存: coordinate-system.js, system/event-bus.js, system/history.js
 * 被依存: core-engine.js, core-runtime.js, ui/*
 * 公開API: PixelSelectionSystem
 *
 * Phase 5p共通契約:
 * - selection boundsはProject座標として扱う。
 * - constrainLayerToSelection() はbefore/after snapshotのrasterBounds差をProject座標で吸収する。
 * - 通常Layer / CAF working Layerのstroke/fillは、履歴経路が違ってもこのAPIで選択外をbefore pixelsへ戻す。
 * ============================================================================
 */

import { coordinateSystem } from '../coordinate-system.js';
import { TegakiEventBus } from './event-bus.js';
import { historyManager } from './history.js';
import { Sprite, Texture } from 'pixi.js';
import { applyTransformMatrix, createCenteredTransformMatrix } from './transform-math.js';
import { resolveIntegerTranslation, translateRgbaPixels } from './raster-translation.js';
import { normalizeRasterBounds } from './raster-bounds.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MIN_SELECTION_SIZE = 1;
const FOLDER_CLIPBOARD_KIND = 'folder-pixel-selection';
const FOLDER_CLIPBOARD_VERSION = 1;

export class PixelSelectionSystem {
    constructor() {
        this.app = null;
        this.layerSystem = null;
        this.cameraSystem = null;
        this.eventBus = TegakiEventBus;
        this.history = historyManager;
        this.imageImporter = null;
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

    init({ app, layerSystem, cameraSystem, eventBus = TegakiEventBus, imageImporter = null } = {}) {
        this.app = app;
        this.layerSystem = layerSystem;
        this.cameraSystem = cameraSystem;
        this.eventBus = eventBus;
        this.imageImporter = imageImporter;
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
            scope: this.state.scope ? { ...this.state.scope } : {
                kind: 'layer',
                layerId: this.state.layerId
            },
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
        if (!afterSnapshot?.pixels || !beforeSnapshot?.pixels) {
            return false;
        }

        const beforeBounds = normalizeRasterBounds(beforeSnapshot.rasterBounds, {
            width: beforeSnapshot.width,
            height: beforeSnapshot.height
        });
        beforeBounds.width = beforeSnapshot.width;
        beforeBounds.height = beforeSnapshot.height;
        const afterBounds = normalizeRasterBounds(afterSnapshot.rasterBounds, {
            width: afterSnapshot.width,
            height: afterSnapshot.height
        });
        afterBounds.width = afterSnapshot.width;
        afterBounds.height = afterSnapshot.height;
        const x0 = Math.floor(bounds.x);
        const y0 = Math.floor(bounds.y);
        const x1 = Math.ceil(bounds.x + bounds.width);
        const y1 = Math.ceil(bounds.y + bounds.height);

        for (let y = 0; y < afterSnapshot.height; y++) {
            const projectY = afterBounds.y + y;
            const insideY = projectY >= y0 && projectY < y1;
            for (let x = 0; x < afterSnapshot.width; x++) {
                const projectX = afterBounds.x + x;
                if (insideY && projectX >= x0 && projectX < x1) continue;

                const targetIndex = (y * afterSnapshot.width + x) * 4;
                const beforeX = projectX - beforeBounds.x;
                const beforeY = projectY - beforeBounds.y;
                if (
                    beforeX >= 0
                    && beforeY >= 0
                    && beforeX < beforeSnapshot.width
                    && beforeY < beforeSnapshot.height
                ) {
                    const sourceIndex = (beforeY * beforeSnapshot.width + beforeX) * 4;
                    afterSnapshot.pixels[targetIndex] = beforeSnapshot.pixels[sourceIndex];
                    afterSnapshot.pixels[targetIndex + 1] = beforeSnapshot.pixels[sourceIndex + 1];
                    afterSnapshot.pixels[targetIndex + 2] = beforeSnapshot.pixels[sourceIndex + 2];
                    afterSnapshot.pixels[targetIndex + 3] = beforeSnapshot.pixels[sourceIndex + 3];
                } else {
                    afterSnapshot.pixels[targetIndex] = 0;
                    afterSnapshot.pixels[targetIndex + 1] = 0;
                    afterSnapshot.pixels[targetIndex + 2] = 0;
                    afterSnapshot.pixels[targetIndex + 3] = 0;
                }
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
        const target = this._getActiveSelectionTarget();
        if (!target) return false;
        const isFolder = target.kind === 'folder';
        const width = isFolder
            ? Math.max(1, Math.round(this.layerSystem.config?.canvas?.width || 1))
            : Math.max(1, Math.round(target.layer.layerData.renderTexture.width));
        const height = isFolder
            ? Math.max(1, Math.round(this.layerSystem.config?.canvas?.height || 1))
            : Math.max(1, Math.round(target.layer.layerData.renderTexture.height));
        this.state = {
            active: true,
            layerId: target.layer.layerData.id,
            scope: isFolder
                ? { kind: 'folder', folderId: target.layer.layerData.id }
                : { kind: 'layer', layerId: target.layer.layerData.id },
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
        if (this.state?.scope?.kind === 'folder') return false;
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
        if (!this.clipboard || this.clipboard.kind === FOLDER_CLIPBOARD_KIND) return false;
        if (this.transformSession && !this.confirmTransform()) return false;

        const layer = this._getEligibleActiveLayer();
        if (!layer) return false;
        const sourceBounds = this.clipboard.sourceBounds || {};
        const x = Number.isFinite(sourceBounds.x) ? Math.round(sourceBounds.x) : 0;
        const y = Number.isFinite(sourceBounds.y) ? Math.round(sourceBounds.y) : 0;
        const pasteBounds = {
            x,
            y,
            width: this.clipboard.width,
            height: this.clipboard.height
        };
        const historyBeforeSnapshot = this.layerSystem?.createLayerRasterSnapshot?.(layer) || null;
        const expanded = this.layerSystem?.ensureLayerRasterBoundsForRect?.(layer, pasteBounds, { padding: 0 });
        if (expanded && expanded.ok === false) return false;

        this.state = {
            active: true,
            layerId: layer.layerData.id,
            bounds: pasteBounds,
            mode: 'rectangle',
            transformSessionActive: false
        };
        this.setToolActive(true);
        const started = this._startFloatingSession({
            kind: 'paste',
            pixels: new Uint8ClampedArray(this.clipboard.pixels),
            width: this.clipboard.width,
            height: this.clipboard.height,
            cutSource: false,
            historyBeforeSnapshot
        });
        if (!started && historyBeforeSnapshot) {
            this.layerSystem?.restoreLayerRasterSnapshot?.(historyBeforeSnapshot);
        }
        return started;
    }

    pasteSelectionAsNewLayer() {
        const clipboard = this.getClipboardPayload();
        if (clipboard?.kind === FOLDER_CLIPBOARD_KIND) {
            if (!this.validateClipboardPayload(clipboard)) return false;
            const result = this.layerSystem?.pasteFolderSelectionPayload?.(clipboard);
            if (!result?.rootFolder?.layerData) return false;
            this.state = {
                active: true,
                layerId: result.rootFolder.layerData.id,
                scope: {
                    kind: 'folder',
                    folderId: result.rootFolder.layerData.id
                },
                bounds: { ...clipboard.canvasBounds },
                mode: 'rectangle',
                transformSessionActive: false
            };
            this.setToolActive(true);
            this._scheduleOverlayUpdate();
            return true;
        }
        if (
            !clipboard
            || clipboard.kind !== 'pixel-selection'
            || !this.layerSystem?.createLayer
            || !this.layerSystem?.restoreLayerRasterSnapshot
        ) {
            return false;
        }
        if (this.transformSession && !this.confirmTransform()) return false;

        const sourceBounds = clipboard.sourceBounds || {};
        const x = Number.isFinite(sourceBounds.x) ? Math.round(sourceBounds.x) : 0;
        const y = Number.isFinite(sourceBounds.y) ? Math.round(sourceBounds.y) : 0;
        const width = Math.max(1, Math.round(clipboard.width));
        const height = Math.max(1, Math.round(clipboard.height));
        const pixels = new Uint8ClampedArray(clipboard.pixels);

        const created = this.layerSystem.createLayer('選択範囲のコピー');
        const layer = created?.layer;
        if (!layer?.layerData) return false;
        if (!this.layerSystem.restoreLayerRasterSnapshot({
            layerId: layer.layerData.id,
            width,
            height,
            pixels,
            paths: [],
            pathsData: [],
            rasterBounds: { x, y, width, height }
        })) {
            return false;
        }

        this.state = {
            active: true,
            layerId: layer.layerData.id,
            bounds: { x, y, width: clipboard.width, height: clipboard.height },
            mode: 'rectangle',
            transformSessionActive: false
        };
        this.setToolActive(true);
        this.layerSystem.requestThumbnailUpdate?.(created.index, true);
        this.eventBus?.emit('selection:pasted-as-new-layer', {
            layerId: layer.layerData.id,
            layerIndex: created.index,
            bounds: { ...this.state.bounds }
        });
        this._scheduleOverlayUpdate();
        return true;
    }

    getClipboardPayload() {
        if (!this.clipboard) return null;
        if (this.clipboard.kind === FOLDER_CLIPBOARD_KIND) {
            return {
                kind: FOLDER_CLIPBOARD_KIND,
                version: this.clipboard.version,
                copiedAt: this.clipboard.copiedAt,
                canvasBounds: { ...this.clipboard.canvasBounds },
                rootFolder: { ...this.clipboard.rootFolder },
                entries: this.clipboard.entries.map(entry => ({
                    ...entry,
                    localBounds: entry.localBounds ? { ...entry.localBounds } : null,
                    transform: entry.transform ? { ...entry.transform } : null,
                    pixels: entry.pixels ? new Uint8ClampedArray(entry.pixels) : null
                }))
            };
        }
        return {
            kind: 'pixel-selection',
            sourceLayerId: this.clipboard.sourceLayerId || null,
            sourceBounds: { ...(this.clipboard.sourceBounds || {}) },
            width: this.clipboard.width,
            height: this.clipboard.height,
            pixels: new Uint8ClampedArray(this.clipboard.pixels),
            copiedAt: Number(this.clipboard.copiedAt) || 0
        };
    }

    validateClipboardPayload(payload = this.clipboard) {
        if (!payload || typeof payload !== 'object') return false;
        if (payload.kind === 'pixel-selection') {
            return Number.isFinite(payload.width)
                && payload.width > 0
                && Number.isFinite(payload.height)
                && payload.height > 0
                && payload.pixels instanceof Uint8ClampedArray
                && payload.pixels.length === payload.width * payload.height * 4;
        }
        if (payload.kind !== FOLDER_CLIPBOARD_KIND || payload.version !== FOLDER_CLIPBOARD_VERSION) {
            return false;
        }
        if (!payload.rootFolder?.sourceId || !Array.isArray(payload.entries)) return false;
        const sourceKeys = new Set(['root']);
        for (const entry of payload.entries) {
            if (!entry?.sourceKey || sourceKeys.has(entry.sourceKey)) return false;
            sourceKeys.add(entry.sourceKey);
        }
        for (const entry of payload.entries) {
            if (!sourceKeys.has(entry.relativeParentKey)) return false;
            if (entry.type === 'folder') continue;
            if (entry.type !== 'raster') return false;
            if (
                !entry.localBounds
                || !Number.isFinite(entry.width)
                || entry.width < 1
                || !Number.isFinite(entry.height)
                || entry.height < 1
            ) {
                return false;
            }
            if (!(entry.pixels instanceof Uint8ClampedArray)) return false;
            if (entry.pixels.length !== entry.width * entry.height * 4) return false;
        }
        return true;
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
        const integerTranslation = resolveIntegerTranslation(session.transform);
        const transformed = integerTranslation
            ? this._translateFloatingRegion(session, integerTranslation)
            : this._renderTransformedRegion(session);
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
        if (integerTranslation) {
            this.state.bounds = {
                x: session.originX + integerTranslation.dx,
                y: session.originY + integerTranslation.dy,
                width: session.width,
                height: session.height
            };
        }

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

    _deactivateSelectionToolForExternalTool(tool) {
        if (!tool || tool === 'selection' || !this.toolActive) return;
        if (this.transformSession && !this.confirmTransform()) return;
        this.setToolActive(false);
    }

    copySelection() {
        if (this.state?.scope?.kind === 'folder') {
            return this._copyFolderSelection();
        }
        const context = this._getSelectionContext();
        if (!context) return false;
        const snapshot = this.layerSystem.createLayerRasterSnapshot(context.layer);
        if (!snapshot) return false;
        const region = this._extractRegion(snapshot, context.bounds);
        if (!region) return false;

        this.clipboard = {
            kind: 'pixel-selection',
            sourceLayerId: context.layer.layerData.id,
            sourceBounds: { ...context.bounds },
            width: region.width,
            height: region.height,
            pixels: region.pixels,
            copiedAt: Date.now()
        };
        this.eventBus?.emit('selection:clipboard-changed', {
            available: true,
            width: region.width,
            height: region.height
        });
        return true;
    }

    _copyFolderSelection() {
        const context = this._getFolderSelectionContext();
        if (!context) return false;

        const sourceKeyById = new Map([[context.folder.layerData.id, 'root']]);
        context.targets.entries.forEach((entry, index) => {
            sourceKeyById.set(entry.layer.layerData.id, `entry-${index}`);
        });

        const entries = [];
        for (const target of context.targets.entries) {
            const layer = target.layer;
            const data = layer.layerData;
            const sourceKey = sourceKeyById.get(data.id);
            const relativeParentKey = sourceKeyById.get(data.parentId);
            if (!sourceKey || !relativeParentKey) return false;

            const common = {
                sourceKey,
                sourceId: data.id,
                sourceParentId: data.parentId || null,
                relativeParentKey,
                order: target.order,
                depth: target.depth,
                type: target.type,
                name: data.name || (target.type === 'folder' ? 'フォルダ' : 'レイヤー'),
                visible: data.visible !== false && layer.visible !== false,
                opacity: Number.isFinite(data.opacity) ? data.opacity : (layer.alpha ?? 1),
                blendMode: data.blendMode || 'normal',
                clipping: data.clipping === true,
                clippingMode: data.clippingMode || (data.clipping === true ? 'normal' : 'none')
            };
            if (target.type === 'folder') {
                entries.push({
                    ...common,
                    folderExpanded: data.folderExpanded !== false
                });
                continue;
            }

            const snapshot = this.layerSystem.createLayerRasterSnapshot(layer);
            if (!snapshot?.pixels) return false;
            const localBounds = this._resolveCanvasBoundsForLayer(context.bounds, layer, snapshot);
            const region = localBounds
                ? this._extractMaskedLayerRegion(snapshot, localBounds, context.bounds, layer)
                : {
                    localBounds: { x: 0, y: 0, width: 1, height: 1 },
                    width: 1,
                    height: 1,
                    pixels: new Uint8ClampedArray(4),
                    selectionEmpty: true
                };
            if (!region) return false;
            entries.push({
                ...common,
                transform: {
                    ...(this.layerSystem.transform?.getTransform?.(data.id)
                        || { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 })
                },
                localBounds: region.localBounds,
                width: region.width,
                height: region.height,
                pixels: region.pixels,
                selectionEmpty: region.selectionEmpty === true
            });
        }

        const folderData = context.folder.layerData;
        const payload = {
            kind: FOLDER_CLIPBOARD_KIND,
            version: FOLDER_CLIPBOARD_VERSION,
            copiedAt: Date.now(),
            canvasBounds: { ...context.bounds },
            rootFolder: {
                sourceId: folderData.id,
                name: folderData.name || 'フォルダ',
                visible: folderData.visible !== false && context.folder.visible !== false,
                opacity: Number.isFinite(folderData.opacity) ? folderData.opacity : 1,
                folderExpanded: folderData.folderExpanded !== false
            },
            entries
        };
        if (!this.validateClipboardPayload(payload)) return false;
        this.clipboard = payload;
        this.eventBus?.emit('selection:clipboard-changed', {
            available: true,
            kind: FOLDER_CLIPBOARD_KIND,
            folderId: folderData.id,
            entryCount: entries.length,
            rasterCount: entries.filter(entry => entry.type === 'raster').length,
            bounds: { ...context.bounds }
        });
        return true;
    }

    deleteSelection(action = 'delete') {
        if (this.state?.scope?.kind === 'folder') {
            return this._deleteFolderSelection(action);
        }
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
        this._clearRegion(after.pixels, after.width, context.bounds, after.rasterBounds);
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

    _deleteFolderSelection(action = 'delete') {
        const context = this._getFolderSelectionContext();
        if (!context) return false;

        const changes = [];
        for (const target of context.targets.entries) {
            if (target.type !== 'raster') continue;
            const before = this.layerSystem.createLayerRasterSnapshot(target.layer);
            if (!before?.pixels) return false;
            const localBounds = this._resolveCanvasBoundsForLayer(
                context.bounds,
                target.layer,
                before
            );
            if (!localBounds) continue;
            const after = {
                ...before,
                pixels: new Uint8ClampedArray(before.pixels),
                paths: [],
                pathsData: []
            };
            const changed = this._clearCanvasBoundsFromLayerSnapshot(
                after,
                localBounds,
                context.bounds,
                target.layer
            );
            if (!changed) continue;
            changes.push({
                layer: target.layer,
                layerId: target.layer.layerData.id,
                before,
                after
            });
        }
        if (changes.length === 0) return false;

        const restoreChanges = (snapshotKey) => {
            let restoredAll = true;
            for (const change of changes) {
                const restored = this.layerSystem.restoreLayerRasterSnapshot(change[snapshotKey]);
                restoredAll = restoredAll && restored;
                if (restored) {
                    this.layerSystem.requestThumbnailUpdate?.(
                        this.layerSystem.getLayerIndex(change.layer),
                        true
                    );
                }
            }
            this.layerSystem.refreshClippingMasks?.();
            this.layerSystem.coordAPI?.clearCache?.();
            this._scheduleOverlayUpdate();
            return restoredAll;
        };

        if (!restoreChanges('after')) {
            restoreChanges('before');
            return false;
        }
        this.history.record({
            name: action === 'cut' ? 'folder-selection-cut' : 'folder-selection-delete',
            do: () => restoreChanges('after'),
            undo: () => restoreChanges('before'),
            byteSize: changes.reduce((total, change) => {
                return total
                    + (change.before.pixels?.byteLength || 0)
                    + (change.after.pixels?.byteLength || 0);
            }, 0),
            meta: {
                type: FOLDER_CLIPBOARD_KIND,
                action,
                folderId: context.folder.layerData.id,
                layerIds: changes.map(change => change.layerId),
                bounds: { ...context.bounds }
            }
        });
        this.eventBus?.emit('selection:changed', {
            ...this.getState(),
            action,
            affectedLayerIds: changes.map(change => change.layerId)
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
                if (document.documentElement.dataset.tegakiShortcutContext === 'animation') return;
                if (this.pasteSelectionAsNewLayer()) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                }
                return;
            }
            if (!this.hasSelection()) return;
            if (primaryModifier && !event.shiftKey && !event.altKey && event.code === 'KeyC') {
                if (document.documentElement.dataset.tegakiShortcutContext === 'animation') return;
                if (this.copySelection()) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                }
                return;
            }
            if (primaryModifier && !event.shiftKey && !event.altKey && event.code === 'KeyX') {
                if (this.copySelection() && this.deleteSelection('cut')) {
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
            ['selection:folder-pasted', ({ folderId, bounds } = {}) => {
                if (!folderId || !bounds) return;
                this.state = {
                    active: true,
                    layerId: folderId,
                    scope: { kind: 'folder', folderId },
                    bounds: { ...bounds },
                    mode: 'rectangle',
                    transformSessionActive: false
                };
                this.setToolActive(true);
                this._scheduleOverlayUpdate();
            }],
            ['selection:folder-paste-undone', ({ folderId } = {}) => {
                if (folderId && this.state?.scope?.folderId === folderId) {
                    this.clearSelection('folder-paste-undo');
                }
            }],
            ['tool:changed', ({ tool } = {}) => {
                this._deactivateSelectionToolForExternalTool(tool);
            }],
            ['brush:mode-changed', (payload = {}) => {
                const tool = payload.tool || payload.mode || payload.data?.tool || payload.data?.mode;
                this._deactivateSelectionToolForExternalTool(tool);
            }],
            ['ui:sidebar:sync-tool', ({ tool } = {}) => {
                this._deactivateSelectionToolForExternalTool(tool);
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
        const target = this._getActiveSelectionTarget();
        if (!target) return;
        const layer = target.layer;
        const point = target.kind === 'folder'
            ? this._clientToCanvasPoint(event.clientX, event.clientY)
            : this._clientToLayerPoint(event.clientX, event.clientY, layer);
        if (!point) return;

        if (this.transformSession) {
            if (target.kind === 'folder') return;
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
            coordinateSpace: target.kind === 'folder' ? 'canvas' : 'layer',
            start: point,
            current: point
        };
        this.state = {
            active: true,
            layerId: layer.layerData.id,
            scope: target.kind === 'folder'
                ? { kind: 'folder', folderId: layer.layerData.id }
                : { kind: 'layer', layerId: layer.layerData.id },
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
        const point = this.drag.coordinateSpace === 'canvas'
            ? this._clientToCanvasPoint(event.clientX, event.clientY)
            : this._clientToLayerPoint(event.clientX, event.clientY, this.drag.layer);
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
        if (data.isBackground || data.isFolder) return null;
        if (data.isAnimationWorkingLayer === true && !this._canSelectAnimationWorkingLayer()) {
            return null;
        }
        return layer;
    }

    _getActiveSelectionTarget() {
        const layer = this.layerSystem?.getActiveLayer?.();
        const data = layer?.layerData;
        if (!layer || !data || data.isBackground) return null;
        if (data.isAnimationWorkingLayer === true && !this._canSelectAnimationWorkingLayer()) {
            return null;
        }
        if (data.isFolder) {
            const targets = this.layerSystem?.getFolderSelectionTargets?.(data.id);
            const hasRaster = targets?.entries?.some(entry => entry.type === 'raster');
            return hasRaster ? { kind: 'folder', layer, targets } : null;
        }
        if (!data.renderTexture) return null;
        return { kind: 'layer', layer };
    }

    _canSelectAnimationWorkingLayer() {
        const animationTable = window.PopupManager?.get?.('animationTable')
            || window.coreEngine?.popupManager?.get?.('animationTable');
        return animationTable?.isVisible === true && !!animationTable.selectedCelId;
    }

    _getSelectionContext() {
        if (!this.hasSelection()) return null;
        if (this.state?.scope?.kind === 'folder') return null;
        const layer = this.layerSystem?.getLayers?.()
            ?.find(candidate => candidate.layerData?.id === this.state.layerId);
        if (!layer || layer !== this._getEligibleActiveLayer()) return null;
        return { layer, bounds: { ...this.state.bounds } };
    }

    _getFolderSelectionContext() {
        if (!this.hasSelection() || this.state?.scope?.kind !== 'folder') return null;
        const folderId = this.state.scope.folderId || this.state.layerId;
        const activeLayer = this.layerSystem?.getActiveLayer?.();
        if (activeLayer?.layerData?.id !== folderId || !activeLayer.layerData.isFolder) return null;
        const targets = this.layerSystem?.getFolderSelectionTargets?.(folderId);
        if (!targets?.entries?.some(entry => entry.type === 'raster')) return null;
        return {
            folder: targets.rootFolder,
            targets,
            bounds: { ...this.state.bounds }
        };
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

    _clientToCanvasPoint(clientX, clientY) {
        const world = this.coordSystem?.screenClientToWorld?.(clientX, clientY);
        if (!world || !Number.isFinite(world.worldX) || !Number.isFinite(world.worldY)) return null;
        const width = Math.max(1, Math.round(this.layerSystem?.config?.canvas?.width || 1));
        const height = Math.max(1, Math.round(this.layerSystem?.config?.canvas?.height || 1));
        return {
            x: Math.max(0, Math.min(width, world.worldX)),
            y: Math.max(0, Math.min(height, world.worldY))
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
            this._clearRegion(baseSnapshot.pixels, baseSnapshot.width, context.bounds, baseSnapshot.rasterBounds);
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
            beforeSnapshot: options.historyBeforeSnapshot || beforeSnapshot,
            baseSnapshot,
            initialBounds: { ...context.bounds },
            pixels: region.pixels,
            width: region.width,
            height: region.height,
            canvasWidth: beforeSnapshot.width,
            canvasHeight: beforeSnapshot.height,
            rasterBounds: beforeSnapshot.rasterBounds
                ? { ...beforeSnapshot.rasterBounds }
                : { x: 0, y: 0, width: beforeSnapshot.width, height: beforeSnapshot.height },
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
        const rasterBounds = normalizeRasterBounds(session.rasterBounds, {
            width: session.canvasWidth,
            height: session.canvasHeight
        });
        ctx.translate(
            session.originX - rasterBounds.x + (session.width / 2) + transform.x,
            session.originY - rasterBounds.y + (session.height / 2) + transform.y
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

    _translateFloatingRegion(session, translation) {
        const canvasPixels = new Uint8ClampedArray(
            session.canvasWidth * session.canvasHeight * 4
        );
        const rasterBounds = normalizeRasterBounds(session.rasterBounds, {
            width: session.canvasWidth,
            height: session.canvasHeight
        });
        const originRasterX = session.originX - rasterBounds.x;
        const originRasterY = session.originY - rasterBounds.y;
        for (let row = 0; row < session.height; row++) {
            const targetY = originRasterY + row;
            if (targetY < 0 || targetY >= session.canvasHeight) continue;
            const sourceStart = row * session.width * 4;
            const sourceX = Math.max(0, -originRasterX);
            const targetX = Math.max(0, originRasterX);
            const copyWidth = Math.min(
                session.width - sourceX,
                session.canvasWidth - targetX
            );
            if (copyWidth <= 0) continue;
            const targetStart = (targetY * session.canvasWidth + targetX) * 4;
            canvasPixels.set(
                session.pixels.subarray(
                    sourceStart + sourceX * 4,
                    sourceStart + (sourceX + copyWidth) * 4
                ),
                targetStart
            );
        }
        return {
            width: session.canvasWidth,
            height: session.canvasHeight,
            pixels: translateRgbaPixels(
                canvasPixels,
                session.canvasWidth,
                session.canvasHeight,
                translation.dx,
                translation.dy
            )
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
        const folderContext = this._getFolderSelectionContext();
        if (folderContext) {
            const bounds = folderContext.bounds;
            const screenPoints = [
                { x: bounds.x, y: bounds.y },
                { x: bounds.x + bounds.width, y: bounds.y },
                { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
                { x: bounds.x, y: bounds.y + bounds.height }
            ].map(point => this.coordSystem.worldToScreen(point.x, point.y));
            if (screenPoints.some(point => {
                return !Number.isFinite(point?.clientX) || !Number.isFinite(point?.clientY);
            })) {
                this.overlay.classList.remove('is-visible');
                return;
            }
            this.overlayPolygon.setAttribute(
                'points',
                screenPoints.map(point => `${point.clientX},${point.clientY}`).join(' ')
            );
            this.overlay.classList.add('is-visible');
            return;
        }
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
        const rasterBounds = normalizeRasterBounds(snapshot.rasterBounds, {
            width: snapshot.width,
            height: snapshot.height
        });
        const x0 = Math.max(0, Math.floor(bounds.x - rasterBounds.x));
        const y0 = Math.max(0, Math.floor(bounds.y - rasterBounds.y));
        const x1 = Math.min(snapshot.width, Math.ceil(bounds.x + bounds.width - rasterBounds.x));
        const y1 = Math.min(snapshot.height, Math.ceil(bounds.y + bounds.height - rasterBounds.y));
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

    _resolveCanvasBoundsForLayer(canvasBounds, layer, snapshot) {
        const corners = [
            { x: canvasBounds.x, y: canvasBounds.y },
            { x: canvasBounds.x + canvasBounds.width, y: canvasBounds.y },
            { x: canvasBounds.x + canvasBounds.width, y: canvasBounds.y + canvasBounds.height },
            { x: canvasBounds.x, y: canvasBounds.y + canvasBounds.height }
        ].map(point => this.coordSystem.worldToLocal(point.x, point.y, layer));
        if (corners.some(point => {
            return !Number.isFinite(point?.localX) || !Number.isFinite(point?.localY);
        })) {
            return null;
        }
        const rasterBounds = normalizeRasterBounds(snapshot.rasterBounds, {
            width: snapshot.width,
            height: snapshot.height
        });
        const minX = Math.max(rasterBounds.x, Math.floor(Math.min(...corners.map(point => point.localX))));
        const minY = Math.max(rasterBounds.y, Math.floor(Math.min(...corners.map(point => point.localY))));
        const maxX = Math.min(rasterBounds.x + snapshot.width, Math.ceil(Math.max(...corners.map(point => point.localX))));
        const maxY = Math.min(rasterBounds.y + snapshot.height, Math.ceil(Math.max(...corners.map(point => point.localY))));
        if (maxX <= minX || maxY <= minY) return null;
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    _extractMaskedLayerRegion(snapshot, localBounds, canvasBounds, layer) {
        if (!localBounds) return null;
        const region = this._extractRegion(snapshot, localBounds);
        if (!region) return null;
        const pixels = new Uint8ClampedArray(region.pixels);
        for (let y = 0; y < region.height; y++) {
            for (let x = 0; x < region.width; x++) {
                const world = this._layerLocalToWorld(
                    localBounds.x + x + 0.5,
                    localBounds.y + y + 0.5,
                    layer
                );
                if (!world || !this._pointInBounds(world, canvasBounds)) {
                    const index = (y * region.width + x) * 4;
                    pixels.fill(0, index, index + 4);
                }
            }
        }
        return {
            localBounds: { ...localBounds },
            width: region.width,
            height: region.height,
            pixels
        };
    }

    _clearCanvasBoundsFromLayerSnapshot(snapshot, localBounds, canvasBounds, layer) {
        let changed = false;
        const rasterBounds = normalizeRasterBounds(snapshot.rasterBounds, {
            width: snapshot.width,
            height: snapshot.height
        });
        const x0 = Math.max(0, Math.floor(localBounds.x - rasterBounds.x));
        const y0 = Math.max(0, Math.floor(localBounds.y - rasterBounds.y));
        const x1 = Math.min(snapshot.width, Math.ceil(localBounds.x + localBounds.width - rasterBounds.x));
        const y1 = Math.min(snapshot.height, Math.ceil(localBounds.y + localBounds.height - rasterBounds.y));
        for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
                const world = this._layerLocalToWorld(rasterBounds.x + x + 0.5, rasterBounds.y + y + 0.5, layer);
                if (!world || !this._pointInBounds(world, canvasBounds)) continue;
                const index = (y * snapshot.width + x) * 4;
                if (
                    snapshot.pixels[index] !== 0
                    || snapshot.pixels[index + 1] !== 0
                    || snapshot.pixels[index + 2] !== 0
                    || snapshot.pixels[index + 3] !== 0
                ) {
                    snapshot.pixels.fill(0, index, index + 4);
                    changed = true;
                }
            }
        }
        return changed;
    }

    _layerLocalToWorld(localX, localY, layer) {
        if (!layer) return null;
        const transforms = [];
        const worldContainer = this.cameraSystem?.worldContainer || null;
        let node = layer;
        while (node && node !== worldContainer) {
            transforms.push({
                position: node.position || { x: 0, y: 0 },
                pivot: node.pivot || { x: 0, y: 0 },
                scale: node.scale || { x: 1, y: 1 },
                rotation: Number(node.rotation) || 0
            });
            node = node.parent;
        }

        let x = localX;
        let y = localY;
        for (const transform of transforms) {
            x -= transform.pivot.x;
            y -= transform.pivot.y;
            x *= transform.scale.x;
            y *= transform.scale.y;
            if (Math.abs(transform.rotation) > 1e-6) {
                const cos = Math.cos(transform.rotation);
                const sin = Math.sin(transform.rotation);
                const nextX = x * cos - y * sin;
                const nextY = x * sin + y * cos;
                x = nextX;
                y = nextY;
            }
            x += transform.position.x;
            y += transform.position.y;
        }
        return { x, y };
    }

    _clearRegion(pixels, snapshotWidth, bounds, rasterBoundsInput = null) {
        const rasterBounds = normalizeRasterBounds(rasterBoundsInput, {
            width: snapshotWidth,
            height: Math.floor(pixels.length / 4 / snapshotWidth)
        });
        const x0 = Math.max(0, Math.floor(bounds.x - rasterBounds.x));
        const y0 = Math.max(0, Math.floor(bounds.y - rasterBounds.y));
        const x1 = Math.min(snapshotWidth, Math.ceil(bounds.x + bounds.width - rasterBounds.x));
        const snapshotHeight = Math.floor(pixels.length / 4 / snapshotWidth);
        const y1 = Math.min(snapshotHeight, Math.ceil(bounds.y + bounds.height - rasterBounds.y));
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
