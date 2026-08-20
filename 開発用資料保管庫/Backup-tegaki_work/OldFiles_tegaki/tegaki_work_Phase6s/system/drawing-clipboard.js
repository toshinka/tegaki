/**
 * ============================================================================
 * ファイル名: system/drawing-clipboard.js
 * 責務: レイヤーおよび描画内容のコピー、ペースト、切り取り、削除を管理する
 * 依存: system/event-bus.js, config.js, history.js, pixi.js
 * 被依存: core-engine.js, keyboard-handler.js, ui-panels.js
 * 公開API: DrawingClipboard
 * イベント発火: clipboard:*, layer:drawings-cleared, layer:drawings-restored, layer:delete-*, paste:commit, operation:commit, layer:content-changed
 * イベント受信: clipboard:*, layer:cut-request, layer:delete-active
 * グローバル登録: window.TegakiDrawingClipboard, window.DrawingClipboard
 * 実装状態: ✅完成/整備
 * ============================================================================
 */

import { Graphics, Matrix } from 'pixi.js';
import { TEGAKI_CONFIG } from '../config.js';
import { TegakiEventBus } from './event-bus.js';
import { historyManager } from './history.js';
import { getClippingMode } from './clipping-mode.js';
import { formatCopyFeedback, showFeedbackToast } from '../ui/feedback-toast.js';

export class DrawingClipboard {
    constructor() {
        this.clipboardData = null;
        this.eventBus = null;
        this.config = null;
        this.layerManager = null;
        
        this._setupKeyboardEvents();
    }

    init(eventBus, config) {
        this.eventBus = eventBus || TegakiEventBus;
        this.config = config || TEGAKI_CONFIG;
        
        this._setupEventBusListeners();
    }

    _setupEventBusListeners() {
        if (!this.eventBus) return;
        
        this.eventBus.on('clipboard:copy-request', () => {
            if (this._shouldBlockNormalLayerClipboardOperation()) return;
            this.copyActiveLayer();
        });
        
        this.eventBus.on('clipboard:paste-request', () => {
            if (this._shouldBlockNormalLayerClipboardOperation()) return;
            this.pasteLayer();
        });
        
        this.eventBus.on('layer:cut-request', () => {
            if (this._shouldBlockNormalLayerClipboardOperation()) return;
            this.cutActiveLayer();
        });
        
        this.eventBus.on('layer:delete-active', () => {
            if (this._shouldBlockNormalLayerClipboardOperation()) return;
            this.deleteActiveLayer();
        });
        
        this.eventBus.on('clipboard:paste-to-active-request', () => {
            if (this._shouldBlockNormalLayerClipboardOperation()) return;
            this.pasteToActiveLayer();
        });
        
        this.eventBus.on('clipboard:get-info-request', () => {
            this.eventBus.emit('clipboard:info-response', {
                hasData: this.hasClipboardData(),
                summary: this.getClipboardSummary()
            });
        });
    }

    _setupKeyboardEvents() {
        // Keyboard routing is centralized in ui/keyboard-handler.js.
        // Keeping a second document listener here causes Ctrl+C/V to fire twice.
    }

    _shouldBlockNormalLayerClipboardOperation() {
        const animationTable = window.PopupManager?.get?.('animationTable')
            || window.coreEngine?.popupManager?.get?.('animationTable');
        return !!(
            animationTable?.model &&
            (
                (animationTable.model.tracks?.length || 0) > 0 ||
                (animationTable.model.clipAssets?.length || 0) > 0
            )
        );
    }

    cutActiveLayer() {
        if (!this.layerManager) {
            if (this.eventBus) {
                this.eventBus.emit('clipboard:cut-failed', { error: 'LayerManager not available' });
            }
            return;
        }

        const activeLayer = this.layerManager.getActiveLayer();
        if (!activeLayer) {
            if (this.eventBus) {
                this.eventBus.emit('clipboard:cut-failed', { error: 'No active layer' });
            }
            return;
        }

        if (activeLayer.layerData?.isBackground) {
            if (this.eventBus) {
                this.eventBus.emit('clipboard:cut-failed', { error: 'Cannot cut background layer' });
            }
            return;
        }

        try {
            this.copyActiveLayer({ showFeedback: false });
            
            if (this.clipboardData) {
                this.clearLayerDrawings(activeLayer);
                
                if (this.eventBus) {
                    this.eventBus.emit('clipboard:cut-success', {
                        layerId: activeLayer.layerData.id,
                        layerIndex: this.layerManager.activeLayerIndex
                    });
                }
                
                if (window.popupManager) {
                    window.popupManager.show('レイヤー切り取り', 1500);
                }
            }
        } catch (error) {
            if (this.eventBus) {
                this.eventBus.emit('clipboard:cut-failed', { error: error.message });
            }
        }
    }

    clearLayerDrawings(layer) {
        if (!layer?.layerData) return;
        
        const layerIndex = this.layerManager.getLayerIndex(layer);
        const paths = layer.layerData.paths || [];
        
        if (paths.length === 0) return;
        
        if (historyManager && !historyManager.isApplying) {
            const pathsBackup = structuredClone(paths);
            
            const entry = {
                name: 'layer-clear-drawings',
                do: () => {
                    this._clearDrawingsInternal(layer);
                    this.layerManager.requestThumbnailUpdate(layerIndex);
                },
                undo: () => {
                    this._restoreDrawingsInternal(layer, pathsBackup, layerIndex);
                    this.layerManager.requestThumbnailUpdate(layerIndex);
                },
                meta: { 
                    layerId: layer.layerData.id,
                    pathCount: pathsBackup.length
                }
            };
            
            historyManager.push(entry);
        } else {
            this._clearDrawingsInternal(layer);
            this.layerManager.requestThumbnailUpdate(layerIndex);
        }
    }

    _clearDrawingsInternal(layer) {
        if (!layer?.layerData) return;
        
        const childrenToRemove = [];
        for (let child of layer.children) {
            if (child !== layer.layerData.backgroundGraphics && 
                child !== layer.layerData.maskSprite) {
                childrenToRemove.push(child);
            }
        }
        
        childrenToRemove.forEach(child => {
            try {
                layer.removeChild(child);
                if (child.destroy && typeof child.destroy === 'function') {
                    child.destroy({ children: true, texture: false, baseTexture: false });
                }
            } catch (error) {}
        });
        
        layer.layerData.paths = [];
        
        if (this.eventBus) {
            this.eventBus.emit('layer:drawings-cleared', {
                layerId: layer.layerData.id
            });
        }
    }

    _restoreDrawingsInternal(layer, pathsBackup, layerIndex) {
        if (!layer?.layerData || !pathsBackup) return;
        
        this._clearDrawingsInternal(layer);
        layer.layerData.paths = [];
        
        for (let pathData of pathsBackup) {
            try {
                const rebuildSuccess = this.layerManager.rebuildPathGraphics(pathData);
                
                if (rebuildSuccess && pathData.graphics) {
                    layer.layerData.paths.push(pathData);
                    layer.addChild(pathData.graphics);
                }
            } catch (error) {}
        }
        
        if (this.eventBus) {
            this.eventBus.emit('layer:drawings-restored', {
                layerId: layer.layerData.id,
                layerIndex: layerIndex,
                pathCount: pathsBackup.length
            });
        }
    }

    deleteActiveLayer() {
        if (!this.layerManager) {
            if (this.eventBus) {
                this.eventBus.emit('layer:delete-failed', { error: 'LayerManager not available' });
            }
            return;
        }

        const activeLayer = this.layerManager.getActiveLayer();
        if (!activeLayer) {
            if (this.eventBus) {
                this.eventBus.emit('layer:delete-failed', { error: 'No active layer' });
            }
            return;
        }

        if (activeLayer.layerData?.isBackground) {
            if (this.eventBus) {
                this.eventBus.emit('layer:delete-failed', { error: 'Cannot delete background layer' });
            }
            return;
        }

        try {
            const activeIndex = this.layerManager.activeLayerIndex;
            const layerId = activeLayer.layerData.id;
            
            this.layerManager.deleteLayer(activeIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('layer:delete-success', {
                    layerId: layerId,
                    layerIndex: activeIndex
                });
            }
        } catch (error) {
            if (this.eventBus) {
                this.eventBus.emit('layer:delete-failed', { error: error.message });
            }
        }
    }

    copyActiveLayer(options = {}) {
        if (!this.layerManager) {
            if (this.eventBus) {
                this.eventBus.emit('clipboard:copy-failed', { error: 'LayerManager not available' });
            }
            return;
        }

        const activeLayer = this.layerManager.getActiveLayer();
        if (!activeLayer) {
            if (this.eventBus) {
                this.eventBus.emit('clipboard:copy-failed', { error: 'No active layer' });
            }
            return;
        }

        try {
            const payload = this._createLayerBlockClipboardPayload(activeLayer);
            if (!payload) {
                this.eventBus?.emit('clipboard:copy-failed', { error: 'Clipboard payload unavailable' });
                return false;
            }
            this.clipboardData = payload;
            
            if (this.eventBus) {
                this.eventBus.emit('clipboard:copy-success', {
                    layerCount: payload.layers.length,
                    rootType: payload.rootType,
                    hasTransforms: payload.layers.some(entry => entry.hasTransform)
                });
            }
            
            if (options.showFeedback !== false) {
                showFeedbackToast(formatCopyFeedback('layer', payload.layers.length));
            }
            return true;
            
        } catch (error) {
            if (this.eventBus) {
                this.eventBus.emit('clipboard:copy-failed', { error: error.message });
            }
            return false;
        }
    }

    _createLayerBlockClipboardPayload(rootLayer) {
        const rootData = rootLayer?.layerData;
        if (!rootData || rootData.isBackground) return null;

        const layers = [...(this.layerManager?.getLayers?.() || [])];
        const byId = new Map(layers.map(layer => [layer.layerData?.id, layer]).filter(([id]) => !!id));
        const sourceLayers = rootData.isFolder
            ? layers.filter(layer => {
                const id = layer.layerData?.id;
                return id === rootData.id || this._isLayerDescendantOf(layer, rootData.id, byId);
            })
            : [rootLayer];

        const copiedAt = Date.now();
        const entries = sourceLayers
            .map(layer => this._createLayerBlockClipboardEntry(layer, layers.indexOf(layer)))
            .filter(Boolean);

        if (entries.length === 0) return null;
        return {
            kind: 'layer-block',
            version: 1,
            rootSourceId: rootData.id,
            rootType: rootData.isFolder ? 'folder' : 'raster',
            copiedAt,
            layers: entries
        };
    }

    _isLayerDescendantOf(layer, rootFolderId, byId) {
        let parentId = layer?.layerData?.parentId || null;
        const visited = new Set();
        while (parentId && !visited.has(parentId)) {
            if (parentId === rootFolderId) return true;
            visited.add(parentId);
            parentId = byId.get(parentId)?.layerData?.parentId || null;
        }
        return false;
    }

    _createLayerBlockClipboardEntry(layer, order) {
        const data = layer?.layerData;
        if (!data) return null;
        const transform = this.layerManager?.transform?.getTransform?.(data.id) || {
            x: 0,
            y: 0,
            rotation: 0,
            scaleX: 1,
            scaleY: 1
        };
        return {
            sourceId: data.id,
            parentSourceId: data.parentId || null,
            order: Number.isInteger(order) ? order : 0,
            type: data.isFolder ? 'folder' : 'raster',
            name: data.name || (data.isFolder ? 'フォルダ' : 'レイヤー'),
            visible: data.visible !== false,
            opacity: Number.isFinite(data.opacity) ? data.opacity : 1,
            blendMode: data.blendMode || 'normal',
            clippingMode: getClippingMode(data),
            clipping: getClippingMode(data) !== 'none',
            folderExpanded: data.folderExpanded !== false,
            transform: { ...transform },
            hasTransform: this.layerManager?.transform?._isTransformNonDefault?.(transform) === true,
            rasterSnapshot: data.isFolder
                ? null
                : this._cloneRasterSnapshot(this.layerManager?.createLayerRasterSnapshot?.(layer))
        };
    }

    _cloneRasterSnapshot(snapshot) {
        if (!snapshot) return null;
        return {
            ...snapshot,
            rasterBounds: snapshot.rasterBounds ? { ...snapshot.rasterBounds } : null,
            pixels: snapshot.pixels ? new Uint8ClampedArray(snapshot.pixels) : null,
            paths: Array.isArray(snapshot.paths) ? this.deepCopyPaths(snapshot.paths) : [],
            pathsData: Array.isArray(snapshot.pathsData) ? structuredClone(snapshot.pathsData) : []
        };
    }

    pasteToActiveLayer() {
        if (this.clipboardData?.kind === 'layer-block') {
            return this.pasteLayer();
        }
        if (!this.layerManager) {
            if (this.eventBus) {
                this.eventBus.emit('clipboard:paste-failed', { error: 'LayerManager not available' });
            }
            return;
        }

        if (!this.clipboardData) {
            if (this.eventBus) {
                this.eventBus.emit('clipboard:paste-failed', { error: 'No clipboard data' });
            }
            return;
        }

        const activeLayer = this.layerManager.getActiveLayer();
        if (!activeLayer) {
            if (this.eventBus) {
                this.eventBus.emit('clipboard:paste-failed', { error: 'No active layer' });
            }
            return;
        }

        try {
            const layerId = activeLayer.layerData.id;
            const activeIndex = this.layerManager.activeLayerIndex;
            
            const previousLayerData = this.createLayerSnapshot(activeLayer);
            this.recordHistory({
                type: 'paste-replace',
                layerId: layerId,
                previousData: previousLayerData,
                newData: this.clipboardData
            });
            
            this.clearActiveLayer(activeLayer);
            this.applyClipboardToLayer(activeLayer, this.clipboardData);
            
            this.layerManager.requestThumbnailUpdate(activeIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('paste:commit', { 
                    layerIndex: activeIndex, 
                    layerId: layerId 
                });
                this.eventBus.emit('operation:commit', { 
                    layerIndex: activeIndex, 
                    layerId: layerId, 
                    type: 'paste' 
                });
            }
            
            if (this.layerManager.animationSystem?.generateFrameThumbnail) {
                const frameIndex = this.layerManager.animationSystem.getCurrentFrameIndex();
                setTimeout(() => {
                    this.layerManager.animationSystem.generateFrameThumbnail(frameIndex);
                }, 100);
            }
            
            if (this.eventBus) {
                this.eventBus.emit('clipboard:paste-to-active-success', {
                    layerId: layerId,
                    pathCount: this.clipboardData.layerData.paths.length,
                    mode: 'overwrite'
                });
                this.eventBus.emit('layer:content-changed', { layerId: layerId });
            }
            
        } catch (error) {
            if (this.eventBus) {
                this.eventBus.emit('clipboard:paste-failed', { error: error.message });
            }
        }
    }

    createLayerSnapshot(layer) {
        const layerData = layer.layerData;
        const layerId = layerData.id;
        const transform = this.layerManager.transform?.getTransform?.(layerId);
        
        return {
            id: layerId,
            name: layerData.name,
            visible: layerData.visible,
            opacity: layerData.opacity,
            isBackground: layerData.isBackground || false,
            paths: this.deepCopyPaths(layerData.paths || []),
            transform: transform ? {...transform} : { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            backgroundData: layerData.isBackground ? {
                isBackground: true,
                color: this.config.background.color
            } : null,
            timestamp: Date.now()
        };
    }

    clearActiveLayer(layer) {
        const layerData = layer.layerData;
        
        (layerData.paths || []).forEach(path => {
            if (path.graphics && path.graphics.destroy) {
                path.graphics.destroy();
            }
        });
        
        if (layerData.backgroundGraphics && layerData.backgroundGraphics.destroy) {
            layerData.backgroundGraphics.destroy();
            layerData.backgroundGraphics = null;
        }
        
        layer.removeChildren();
        layerData.paths = [];
        
        const layerId = layerData.id;
        if (this.layerManager.transform) {
            this.layerManager.transform.setTransform(layerId, {
                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
            });
        }
    }

    applyClipboardToLayer(layer, clipboardData) {
        const layerData = layer.layerData;
        const clipData = clipboardData.layerData;
        
        layerData.visible = clipData.visible;
        layerData.opacity = clipData.opacity;
        layer.visible = clipData.visible;
        layer.alpha = clipData.opacity;
        
        // 🆕 Raster Snapshot 対応
        if (clipData.rasterSnapshot && this.layerManager?.restoreLayerRasterSnapshot) {
            // スナップショット内の ID を現在のレイヤーに合わせる
            const snapshot = { ...clipData.rasterSnapshot, layerId: layerData.id };
            this.layerManager.restoreLayerRasterSnapshot(snapshot);
        }

        if (clipData.backgroundData) {
            const bg = new Graphics();
            bg.rect(0, 0, this.config.canvas.width, this.config.canvas.height);
            bg.fill(clipData.backgroundData.color);
            layer.addChild(bg);
            layerData.backgroundGraphics = bg;
            layerData.isBackground = true;
        }
        
        // ベクトルデータ（paths）も一応復元（互換性のため）
        if (clipData.paths && clipData.paths.length > 0) {
            clipData.paths.forEach((pathData) => {
                try {
                    if (pathData.points && pathData.points.length > 0) {
                        const newPath = {
                            id: pathData.id + '_pasted_' + Date.now(),
                            points: [...pathData.points],
                            color: pathData.color,
                            size: pathData.size,
                            opacity: pathData.opacity,
                            isComplete: true,
                            graphics: null
                        };
                        
                        const rebuildSuccess = this.layerManager.rebuildPathGraphics(newPath);
                        
                        if (rebuildSuccess && newPath.graphics) {
                            layerData.paths.push(newPath);
                            layer.addChild(newPath.graphics);
                        }
                    }
                } catch (pathError) {}
            });
        }
    }

    recordHistory(historyEntry) {
        if (historyManager && historyManager.record) {
            const command = {
                name: 'paste-operation',
                do: () => {
                    this.restoreLayerFromClipboard(historyEntry.layerId, historyEntry.newData);
                },
                undo: () => {
                    this.restoreLayerFromSnapshot(historyEntry.layerId, historyEntry.previousData);
                },
                meta: {
                    type: historyEntry.type,
                    layerId: historyEntry.layerId,
                    timestamp: Date.now()
                }
            };
            
            historyManager.record(command);
        }
    }

    restoreLayerFromSnapshot(layerId, snapshotData) {
        const layer = this.layerManager.getLayers().find(l => l.layerData.id === layerId);
        if (!layer) return;
        
        this.clearActiveLayer(layer);
        this.applySnapshotToLayer(layer, snapshotData);
        
        const layerIndex = this.layerManager.getLayerIndex(layer);
        this.layerManager.requestThumbnailUpdate(layerIndex);
    }

    restoreLayerFromClipboard(layerId, clipboardData) {
        const layer = this.layerManager.getLayers().find(l => l.layerData.id === layerId);
        if (!layer) return;
        
        this.clearActiveLayer(layer);
        this.applyClipboardToLayer(layer, clipboardData);
        
        const layerIndex = this.layerManager.getLayerIndex(layer);
        this.layerManager.requestThumbnailUpdate(layerIndex);
    }

    applySnapshotToLayer(layer, snapshotData) {
        const layerData = layer.layerData;
        
        layerData.visible = snapshotData.visible;
        layerData.opacity = snapshotData.opacity;
        layerData.isBackground = snapshotData.isBackground;
        layer.visible = snapshotData.visible;
        layer.alpha = snapshotData.opacity;
        
        if (this.layerManager.transform) {
            this.layerManager.transform.setTransform(layerData.id, {...snapshotData.transform});
        }
        
        if (snapshotData.backgroundData) {
            const bg = new Graphics();
            bg.rect(0, 0, this.config.canvas.width, this.config.canvas.height);
            bg.fill(snapshotData.backgroundData.color);
            layer.addChild(bg);
            layerData.backgroundGraphics = bg;
            layerData.isBackground = true;
        }
        
        snapshotData.paths.forEach((pathData) => {
            try {
                if (pathData.points && pathData.points.length > 0) {
                    const newPath = {
                        id: pathData.id,
                        points: [...pathData.points],
                        color: pathData.color,
                        size: pathData.size,
                        opacity: pathData.opacity,
                        isComplete: pathData.isComplete,
                        graphics: null
                    };
                    
                    const rebuildSuccess = this.layerManager.rebuildPathGraphics(newPath);
                    
                    if (rebuildSuccess && newPath.graphics) {
                        layerData.paths.push(newPath);
                        layer.addChild(newPath.graphics);
                    }
                }
            } catch (pathError) {}
        });
    }

    getTransformedPaths(layer, transform) {
        const centerX = this.config.canvas.width / 2;
        const centerY = this.config.canvas.height / 2;
        
        const matrix = new Matrix();
        matrix.translate(-centerX, -centerY);
        matrix.scale(transform.scaleX, transform.scaleY);
        matrix.rotate(transform.rotation);
        matrix.translate(centerX + transform.x, centerY + transform.y);
        
        return (layer.layerData.paths || []).map((path, index) => {
            try {
                const transformedPoints = (path.points || []).map(point => {
                    try {
                        return matrix.apply(point);
                    } catch (pointError) {
                        return point;
                    }
                }).filter(point => isFinite(point.x) && isFinite(point.y));
                
                return {
                    id: `${path.id}_transformed_${Date.now()}_${index}`,
                    points: transformedPoints,
                    color: path.color,
                    size: path.size,
                    opacity: path.opacity,
                    isComplete: path.isComplete
                };
            } catch (pathError) {
                return {
                    id: `${path.id}_fallback_${Date.now()}_${index}`,
                    points: path.points || [],
                    color: path.color,
                    size: path.size,
                    opacity: path.opacity,
                    isComplete: path.isComplete
                };
            }
        });
    }

    deepCopyPaths(paths) {
        return (paths || []).map((path, index) => {
            try {
                return {
                    id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${index}`,
                    points: (path.points || []).map(point => {
                        const x = point.localX !== undefined ? point.localX : (point.x || 0);
                        const y = point.localY !== undefined ? point.localY : (point.y || 0);
                        return { 
                            localX: Number(x) || 0, 
                            localY: Number(y) || 0,
                            pressure: point.pressure || 0.5,
                            timestamp: point.timestamp || 0
                        };
                    }),
                    color: path.color,
                    size: Number(path.size) || 16,
                    opacity: Number(path.opacity) || 1.0,
                    isComplete: Boolean(path.isComplete)
                };
            } catch (pathError) {
                return null;
            }
        }).filter(path => path !== null);
    }

    pasteLayer() {
        if (!this.layerManager) {
            if (this.eventBus) {
                this.eventBus.emit('clipboard:paste-failed', { error: 'LayerManager not available' });
            }
            return;
        }

        if (!this.clipboardData) {
            if (this.eventBus) {
                this.eventBus.emit('clipboard:paste-failed', { error: 'No clipboard data' });
            }
            return;
        }

        if (this.clipboardData?.kind === 'layer-block') {
            const result = this.layerManager.pasteLayerBlockPayload?.(this.clipboardData);
            if (result) {
                this.eventBus?.emit('clipboard:paste-success', {
                    layerName: result.rootLayer?.layerData?.name || this.clipboardData.layers?.[0]?.name || 'Layer',
                    layerCount: result.createdRecords?.length || this.clipboardData.layers.length,
                    mode: 'layer-block'
                });
                return result;
            }
            this.eventBus?.emit('clipboard:paste-failed', { error: 'Layer block paste unavailable' });
            return false;
        }

        try {
            const clipData = this.clipboardData;
            const layerName = this.generateUniqueLayerName(clipData.layerData.name);
            const { layer, index } = this.layerManager.createLayer(layerName, false);

            this.applyClipboardToLayer(layer, clipData);
            this.layerManager.setActiveLayer(index);
            this.layerManager.requestThumbnailUpdate(index);
            
            if (this.eventBus) {
                this.eventBus.emit('paste:commit', { 
                    layerIndex: index, 
                    layerId: layer.layerData.id 
                    });
                this.eventBus.emit('operation:commit', { 
                    layerIndex: index, 
                    layerId: layer.layerData.id, 
                    type: 'paste-new-layer' 
                });
            }
            
            if (this.layerManager.animationSystem?.generateFrameThumbnail) {
                const frameIndex = this.layerManager.animationSystem.getCurrentFrameIndex();
                setTimeout(() => {
                    this.layerManager.animationSystem.generateFrameThumbnail(frameIndex);
                }, 100);
            }
            
            if (this.eventBus) {
                this.eventBus.emit('clipboard:paste-success', {
                    layerName: layerName,
                    pathCount: clipData.layerData.paths.length,
                    mode: 'new-layer'
                });
            }
            
        } catch (error) {
            if (this.eventBus) {
                this.eventBus.emit('clipboard:paste-failed', { error: error.message });
            }
        }
    }

    generateUniqueLayerName(baseName) {
        let name = baseName;
        let counter = 1;
        
        const layers = this.layerManager.getLayers();
        while (layers.some(layer => layer.layerData.name === name)) {
            name = `${baseName}_${counter}`;
            counter++;
        }
        
        return name;
    }

    hasClipboardData() {
        return this.clipboardData !== null;
    }

    getClipboardSummary() {
        if (!this.clipboardData) {
            return null;
        }

        const data = this.clipboardData;
        if (data.kind === 'layer-block') {
            return {
                kind: data.kind,
                rootType: data.rootType,
                layerCount: data.layers?.length || 0,
                rasterCount: (data.layers || []).filter(entry => entry.type === 'raster').length,
                copiedAt: data.copiedAt || data.timestamp,
                systemVersion: 'layer-block-v1'
            };
        }
        return {
            layerName: data.layerData.name,
            pathCount: data.layerData.paths?.length || 0,
            hasBackground: Boolean(data.layerData.backgroundData),
            hasTransforms: data.metadata?.hasTransforms || false,
            copiedAt: data.metadata?.copiedAt || data.timestamp,
            systemVersion: data.metadata?.systemVersion || 'unknown'
        };
    }

    clearClipboard() {
        this.clipboardData = null;
        if (this.eventBus) {
            this.eventBus.emit('clipboard:cleared');
        }
    }

    setLayerManager(layerManager) {
        this.layerManager = layerManager;
    }
    
    get() {
        return this.clipboardData;
    }

    getClipboardPayload() {
        return this.clipboardData;
    }
    
    getDebugInfo() {
        return {
            hasClipboardData: this.hasClipboardData(),
            summary: this.getClipboardSummary(),
            eventBusAvailable: !!this.eventBus,
            layerManagerAvailable: !!this.layerManager,
            phase: 'Phase1-Cut-Fix-Drawings-Only',
            fixedFeatures: {
                cutLayer: 'drawings-only (layer preserved)',
                deleteLayer: 'available',
                copyPopup: 'available',
                cutPopup: 'available'
            }
        };
    }
}

// 下位互換性のためにグローバルに登録
window.TegakiDrawingClipboard = DrawingClipboard;

window.DrawingClipboard = {
    get: () => window.drawingClipboard?.get() || null,
    pasteToActiveLayer: () => window.drawingClipboard?.pasteToActiveLayer() || false,
    pasteAsNewLayer: () => window.drawingClipboard?.pasteLayer() || false,
    cutActiveLayer: () => window.drawingClipboard?.cutActiveLayer() || false,
    deleteActiveLayer: () => window.drawingClipboard?.deleteActiveLayer() || false
};
