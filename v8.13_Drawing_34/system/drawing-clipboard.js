// ===== system/drawing-clipboard.js - Phase4改修版 + ペースト確定イベント =====
// CHG: CTRL+V挙動を「新規レイヤー作成」→「アクティブレイヤー上書き」に変更
// 【新規追加】ペースト確定イベントによるサムネイル即時更新

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
            console.log('DrawingClipboard: Initializing...');
            
            this.eventBus = eventBus;
            this.config = config || window.TEGAKI_CONFIG;
            
            this._setupEventBusListeners();
            
            console.log('✅ DrawingClipboard initialized (Phase4改修版 + 確定イベント)');
        }

        _setupEventBusListeners() {
            if (!this.eventBus) return;
            
            this.eventBus.on('clipboard:copy-request', () => {
                this.copyActiveLayer();
            });
            
            this.eventBus.on('clipboard:paste-request', () => {
                this.pasteLayer();
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
            });
        }

        copyActiveLayer() {
            if (!this.layerManager) {
                console.warn('LayerManager not available');
                if (this.eventBus) {
                    this.eventBus.emit('clipboard:copy-failed', { error: 'LayerManager not available' });
                }
                return;
            }

            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) {
                console.warn('No active layer to copy');
                if (this.eventBus) {
                    this.eventBus.emit('clipboard:copy-failed', { error: 'No active layer' });
                }
                return;
            }

            try {
                const layerId = activeLayer.layerData.id;
                const currentTransform = this.layerManager.layerTransforms.get(layerId);
                
                let pathsToStore;
                
                if (this.layerManager.isTransformNonDefault(currentTransform)) {
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
                        hasTransforms: this.layerManager.isTransformNonDefault(currentTransform),
                        systemVersion: 'v8.13_Phase4改修版+確定イベント'
                    },
                    timestamp: Date.now()
                };
                
                if (this.eventBus) {
                    this.eventBus.emit('clipboard:copy-success', {
                        pathCount: pathsToStore.length,
                        hasTransforms: this.layerManager.isTransformNonDefault(currentTransform)
                    });
                }
                
            } catch (error) {
                console.error('Failed to copy layer:', error);
                if (this.eventBus) {
                    this.eventBus.emit('clipboard:copy-failed', { error: error.message });
                }
            }
        }

        pasteToActiveLayer() {
            if (!this.layerManager) {
                console.warn('LayerManager not available');
                if (this.eventBus) {
                    this.eventBus.emit('clipboard:paste-failed', { error: 'LayerManager not available' });
                }
                return;
            }

            if (!this.clipboardData) {
                console.warn('No clipboard data to paste');
                if (this.eventBus) {
                    this.eventBus.emit('clipboard:paste-failed', { error: 'No clipboard data' });
                }
                return;
            }

            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) {
                console.warn('No active layer to paste to');
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
                
                this.layerManager.updateLayerPanelUI();
                this.layerManager.updateStatusDisplay();
                this.layerManager.requestThumbnailUpdate(activeIndex);
                
                // 【新規追加】ペースト確定イベント発火
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
                
                // 【新規追加】AnimationSystem経由でサムネイル更新
                if (this.layerManager.animationSystem?.generateCutThumbnailOptimized) {
                    const currentCutIndex = this.layerManager.animationSystem.getCurrentCutIndex();
                    setTimeout(() => {
                        this.layerManager.animationSystem.generateCutThumbnailOptimized(currentCutIndex);
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
                console.error('Failed to paste to active layer:', error);
                if (this.eventBus) {
                    this.eventBus.emit('clipboard:paste-failed', { error: error.message });
                }
            }
        }

        createLayerSnapshot(layer) {
            const layerData = layer.layerData;
            const layerId = layerData.id;
            const transform = this.layerManager.layerTransforms.get(layerId);
            
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
            this.layerManager.layerTransforms.set(layerId, {
                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
            });
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
            
            let restoredCount = 0;
            clipData.paths.forEach((pathData, pathIndex) => {
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
                            restoredCount++;
                        }
                    }
                } catch (pathError) {
                    console.error(`Error applying path ${pathIndex}:`, pathError);
                }
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
            const layer = this.layerManager.layers.find(l => l.layerData.id === layerId);
            if (!layer) return;
            
            this.clearActiveLayer(layer);
            this.applySnapshotToLayer(layer, snapshotData);
            
            const layerIndex = this.layerManager.layers.indexOf(layer);
            this.layerManager.updateLayerPanelUI();
            this.layerManager.requestThumbnailUpdate(layerIndex);
        }

        restoreLayerFromClipboard(layerId, clipboardData) {
            const layer = this.layerManager.layers.find(l => l.layerData.id === layerId);
            if (!layer) return;
            
            this.clearActiveLayer(layer);
            this.applyClipboardToLayer(layer, clipboardData);
            
            const layerIndex = this.layerManager.layers.indexOf(layer);
            this.layerManager.updateLayerPanelUI();
            this.layerManager.requestThumbnailUpdate(layerIndex);
        }

        applySnapshotToLayer(layer, snapshotData) {
            const layerData = layer.layerData;
            
            layerData.visible = snapshotData.visible;
            layerData.opacity = snapshotData.opacity;
            layerData.isBackground = snapshotData.isBackground;
            layer.visible = snapshotData.visible;
            layer.alpha = snapshotData.opacity;
            
            this.layerManager.layerTransforms.set(layerData.id, {...snapshotData.transform});
            
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
                } catch (pathError) {
                    console.error('Error restoring path:', pathError);
                }
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
                        points: (path.points || []).map(point => ({ 
                            x: Number(point.x) || 0, 
                            y: Number(point.y) || 0 
                        })),
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
                console.warn('LayerManager not available');
                if (this.eventBus) {
                    this.eventBus.emit('clipboard:paste-failed', { error: 'LayerManager not available' });
                }
                return;
            }

            if (!this.clipboardData) {
                console.warn('No clipboard data to paste');
                if (this.eventBus) {
                    this.eventBus.emit('clipboard:paste-failed', { error: 'No clipboard data' });
                }
                return;
            }

            try {
                const clipData = this.clipboardData;
                const layerName = this.generateUniqueLayerName(clipData.layerData.name, this.layerManager);
                const { layer, index } = this.layerManager.createLayer(layerName, false);

                this.applyClipboardToLayer(layer, clipData);
                this.layerManager.setActiveLayer(index);
                this.layerManager.updateLayerPanelUI();
                this.layerManager.updateStatusDisplay();
                this.layerManager.requestThumbnailUpdate(index);
                
                // 【新規追加】新規レイヤーペースト時も確定イベント発火
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
                
                // 【新規追加】AnimationSystem経由でサムネイル更新
                if (this.layerManager.animationSystem?.generateCutThumbnailOptimized) {
                    const currentCutIndex = this.layerManager.animationSystem.getCurrentCutIndex();
                    setTimeout(() => {
                        this.layerManager.animationSystem.generateCutThumbnailOptimized(currentCutIndex);
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
                console.error('Failed to paste layer:', error);
                if (this.eventBus) {
                    this.eventBus.emit('clipboard:paste-failed', { error: error.message });
                }
            }
        }

        generateUniqueLayerName(baseName, layerManager) {
            let name = baseName;
            let counter = 1;
            
            while (layerManager.layers.some(layer => layer.layerData.name === name)) {
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
                phase: 'Phase4-CTRL+V-Behavior-Changed+CommitEvents',
                newFeatures: {
                    pasteToActiveLayer: 'available',
                    historyRecording: window.History ? 'available' : 'not-available',
                    overwriteMode: 'implemented',
                    commitEvents: 'implemented'
                }
            };
        }
    }

    window.TegakiDrawingClipboard = DrawingClipboard;
    
    window.DrawingClipboard = {
        get: () => window.drawingClipboard?.get() || null,
        pasteToActiveLayer: () => window.drawingClipboard?.pasteToActiveLayer() || false,
        pasteAsNewLayer: () => window.drawingClipboard?.pasteLayer() || false
    };

    console.log('✅ drawing-clipboard.js Phase4改修版+確定イベント loaded');
    console.log('   - ✅ CTRL+V behavior: overwrite active layer');
    console.log('   - ✅ Commit events: paste:commit, operation:commit');
    console.log('   - ✅ Thumbnail auto-update on paste');

})();