/**
 * @file system/drawing-clipboard.js - Phase C-2.2修正版
 * @description レイヤークリップボード管理
 * 
 * 【Phase C-2.2 改修内容】
 * 🔧 clearLayerDrawings(): skipHistory パラメータ追加
 *    - skipHistory=true の場合、History登録をスキップ
 *    - 外部（keyboard-handler.js）からHistory登録する際に二重登録を防止
 * 
 * 【親ファイル (このファイルが依存)】
 * - event-bus.js (TegakiEventBus)
 * - layer-system.js (LayerSystem)
 * - config.js (TEGAKI_CONFIG)
 * - history.js (History)
 * - popup-manager.js (ポップアップ表示)
 * 
 * 【子ファイル (このファイルに依存)】
 * - keyboard-handler.js (Ctrl+C/V/X処理)
 * - ui-panels.js (クリップボードボタン)
 */

(function() {
    'use strict';

    class DrawingClipboard {
        constructor() {
            this.clipboardData = null;
            this.eventBus = null;
            this.config = null;
            this.layerManager = null;
            
            this._setupKeyboardEvents();
        }

        init(eventBus, config) {
            this.eventBus = eventBus;
            this.config = config || window.TEGAKI_CONFIG;
            
            this._setupEventBusListeners();
        }

        _setupEventBusListeners() {
            if (!this.eventBus) return;
            
            this.eventBus.on('clipboard:copy-request', () => {
                this.copyActiveLayer();
            });
            
            this.eventBus.on('clipboard:paste-request', () => {
                this.pasteLayer();
            });
            
            this.eventBus.on('layer:cut-request', () => {
                this.cutActiveLayer();
            });
            
            this.eventBus.on('layer:delete-active', () => {
                this.deleteActiveLayer();
            });
            
            this.eventBus.on('clipboard:paste-to-active-request', () => {
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
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.code === 'KeyC' && !e.altKey && !e.metaKey) {
                    this.copyActiveLayer();
                    e.preventDefault();
                }
                
                if (e.ctrlKey && e.code === 'KeyV' && !e.altKey && !e.metaKey) {
                    this.pasteToActiveLayer();
                    e.preventDefault();
                }
                
                if (e.ctrlKey && e.code === 'KeyX' && !e.altKey && !e.metaKey) {
                    this.cutActiveLayer();
                    e.preventDefault();
                }
            });
        }

        /**
         * レイヤー切り取り機能 - 描画内容のみ削除
         * コピー → 描画クリアの順で実行（レイヤーは削除しない）
         */
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
                this.copyActiveLayer();
                
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

        /**
         * 🚨 Phase C-2.2修正: skipHistory パラメータ追加
         * レイヤーの描画内容のみをクリア
         * @param {Object} layer - 対象レイヤー
         * @param {boolean} skipHistory - History登録をスキップ（デフォルト: false）
         */
        clearLayerDrawings(layer, skipHistory = false) {
            if (!layer?.layerData) return;
            
            const layerIndex = this.layerManager.getLayerIndex(layer);
            const paths = layer.layerData.paths || [];
            
            if (paths.length === 0) return;
            
            // 🚨 Phase C-2.2: skipHistory=true の場合、History登録をスキップ
            // 外部（keyboard-handler.js）で登録する場合に使用
            if (!skipHistory && window.History && !window.History._manager?.isApplying) {
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
                
                window.History.push(entry);
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

        copyActiveLayer() {
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
                const layerId = activeLayer.layerData.id;
                const currentTransform = this.layerManager.transform?.getTransform?.(layerId);
                
                let pathsToStore;
                
                if (this.layerManager.transform?._isTransformNonDefault?.(currentTransform)) {
                    pathsToStore = this.getTransformedPaths(activeLayer, currentTransform);
                } else {
                    pathsToStore = activeLayer.layerData.paths || [];
                }
                
                const layerData = activeLayer.layerData;
                
                let backgroundData = null;
                if (layerData.isBackground) {
                    backgroundData = {
                        isBackground: true,
                        color: this.config.background.color
                    };
                }

                this.clipboardData = {
                    layerData: {
                        name: layerData.name.includes('_copy') ? 
                              layerData.name : layerData.name + '_copy',
                        visible: layerData.visible,
                        opacity: layerData.opacity,
                        paths: this.deepCopyPaths(pathsToStore),
                        backgroundData: backgroundData
                    },
                    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                    metadata: {
                        originalId: layerId,
                        copiedAt: Date.now(),
                        pathCount: pathsToStore.length,
                        isNonDestructive: true,
                        hasTransforms: this.layerManager.transform?._isTransformNonDefault?.(currentTransform) || false,
                        systemVersion: 'v8.13_PhaseC2.2_History_Fix'
                    },
                    timestamp: Date.now()
                };
                
                if (this.eventBus) {
                    this.eventBus.emit('clipboard:copy-success', {
                        pathCount: pathsToStore.length,
                        hasTransforms: this.layerManager.transform?._isTransformNonDefault?.(currentTransform) || false
                    });
                }
                
                if (window.popupManager) {
                    window.popupManager.show('レイヤーコピー', 1500);
                }
                
            } catch (error) {
                if (this.eventBus) {
                    this.eventBus.emit('clipboard:copy-failed', { error: error.message });
                }
            }
        }

        pasteToActiveLayer() {
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
            
            if (clipData.backgroundData) {
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, this.config.canvas.width, this.config.canvas.height);
                bg.fill(clipData.backgroundData.color);
                layer.addChild(bg);
                layerData.backgroundGraphics = bg;
                layerData.isBackground = true;
            }
            
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

        recordHistory(historyEntry) {
            if (window.History && window.History.push) {
                const command = {
                    undo: () => {
                        this.restoreLayerFromSnapshot(historyEntry.layerId, historyEntry.previousData);
                    },
                    redo: () => {
                        this.restoreLayerFromClipboard(historyEntry.layerId, historyEntry.newData);
                    },
                    meta: {
                        type: historyEntry.type,
                        layerId: historyEntry.layerId,
                        timestamp: Date.now()
                    }
                };
                
                window.History.push(command);
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
                const bg = new PIXI.Graphics();
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
            
            const matrix = new PIXI.Matrix();
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
            return {
                layerName: data.layerData.name,
                pathCount: data.layerData.paths.length,
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
        
        getDebugInfo() {
            return {
                hasClipboardData: this.hasClipboardData(),
                summary: this.getClipboardSummary(),
                eventBusAvailable: !!this.eventBus,
                layerManagerAvailable: !!this.layerManager,
                phase: 'PhaseC2.2-History-Double-Registration-Fix',
                fixedFeatures: {
                    clearLayerDrawings: 'skipHistory parameter added',
                    cutLayer: 'drawings-only (layer preserved)',
                    deleteLayer: 'available'
                }
            };
        }
    }

    window.TegakiDrawingClipboard = DrawingClipboard;
    
    window.DrawingClipboard = {
        get: () => window.drawingClipboard?.get() || null,
        pasteToActiveLayer: () => window.drawingClipboard?.pasteToActiveLayer() || false,
        pasteAsNewLayer: () => window.drawingClipboard?.pasteLayer() || false,
        cutActiveLayer: () => window.drawingClipboard?.cutActiveLayer() || false,
        deleteActiveLayer: () => window.drawingClipboard?.deleteActiveLayer() || false
    };

})();

console.log('✅ drawing-clipboard.js Phase C-2.2 loaded');
console.log('   🔧 clearLayerDrawings(): skipHistory parameter added');