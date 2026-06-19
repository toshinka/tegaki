// ================================================================================
// system/history.js - Undo/Redo管理（AnimationSystem統合強化版）
// ================================================================================
// 【改修】AnimationSystem経由での確実なCUT取得
// 【改修】レイヤー復元後の確実なUI更新
// 【維持】既存のUndo/Redo機能完全継承

(function() {
    'use strict';
    
    const MAX_HISTORY = 50;
    
    class HistoryManager {
        constructor() {
            this.undoStack = [];
            this.redoStack = [];
            this.maxHistory = MAX_HISTORY;
            this.eventBus = window.TegakiEventBus;
            this.layerSystem = null;
            this.isCapturing = false;
            
            if (!this.eventBus) {
                console.warn('⚠️ TegakiEventBus not found - History system disabled');
                return;
            }
            
            this._setupEventListeners();
        }
        
        setLayerSystem(layerSystem) {
            this.layerSystem = layerSystem;
            console.log('✅ History: LayerSystem connected');
        }
        
        _setupEventListeners() {
            if (!this.eventBus) return;
            
            this.eventBus.on('history:undo-request', () => this.undo());
            this.eventBus.on('history:redo-request', () => this.redo());
            this.eventBus.on('history:save-state', () => this.saveState());
            this.eventBus.on('history:clear', () => this.clear());
        }
        
        saveState() {
            if (!this.layerSystem || this.isCapturing) return;
            
            try {
                this.isCapturing = true;
                const state = this._captureState();
                
                if (!state) {
                    this.isCapturing = false;
                    return;
                }
                
                this.undoStack.push(state);
                
                if (this.undoStack.length > this.maxHistory) {
                    this.undoStack.shift();
                }
                
                this.redoStack = [];
                
                this._emitStateChanged();
                
            } catch (error) {
                console.error('❌ Failed to save history state:', error);
            } finally {
                this.isCapturing = false;
            }
        }
        
        _captureState() {
            if (!this.layerSystem) return null;
            
            // 🔧 改修: AnimationSystem経由での確実なCUT取得
            const animationSystem = this.layerSystem.animationSystem || 
                                   window.animationSystem || 
                                   window.TegakiAnimationSystem;
            
            if (!animationSystem) {
                console.warn('⚠️ AnimationSystem not available for history capture');
                return null;
            }
            
            const currentCut = animationSystem.getCurrentCut?.();
            if (!currentCut) {
                console.warn('⚠️ No active CUT for history capture');
                return null;
            }
            
            const layers = currentCut.getLayers();
            if (!layers || layers.length === 0) return null;
            
            return {
                timestamp: Date.now(),
                cutId: currentCut.id,
                cutIndex: animationSystem.getCurrentCutIndex?.() ?? 0,
                layers: layers.map(layer => this._captureLayerState(layer)),
                activeLayerId: this.layerSystem.activeLayer?.layerData?.id || null
            };
        }
        
        _captureLayerState(layer) {
            if (!layer || !layer.layerData) return null;
            
            return {
                id: layer.layerData.id,
                name: layer.layerData.name,
                visible: layer.visible,
                opacity: layer.alpha,
                isBackground: layer.layerData.isBackground || false,
                transform: {
                    x: layer.position.x,
                    y: layer.position.y,
                    rotation: layer.rotation,
                    scaleX: layer.scale.x,
                    scaleY: layer.scale.y
                },
                paths: layer.layerData.paths ? layer.layerData.paths.map(path => ({
                    id: path.id,
                    points: path.points.map(p => ({ x: p.x, y: p.y })),
                    size: path.size,
                    color: path.color,
                    opacity: path.opacity,
                    tool: path.tool
                })) : []
            };
        }
        
        undo() {
            if (!this.canUndo()) return false;
            
            try {
                const currentState = this._captureState();
                if (currentState) {
                    this.redoStack.push(currentState);
                }
                
                const previousState = this.undoStack.pop();
                this._restoreState(previousState);
                
                this._emitStateChanged();
                
                if (this.eventBus) {
                    this.eventBus.emit('history:undo-completed', {
                        canUndo: this.canUndo(),
                        canRedo: this.canRedo()
                    });
                }
                
                return true;
                
            } catch (error) {
                console.error('❌ Undo failed:', error);
                return false;
            }
        }
        
        redo() {
            if (!this.canRedo()) return false;
            
            try {
                const currentState = this._captureState();
                if (currentState) {
                    this.undoStack.push(currentState);
                }
                
                const nextState = this.redoStack.pop();
                this._restoreState(nextState);
                
                this._emitStateChanged();
                
                if (this.eventBus) {
                    this.eventBus.emit('history:redo-completed', {
                        canUndo: this.canUndo(),
                        canRedo: this.canRedo()
                    });
                }
                
                return true;
                
            } catch (error) {
                console.error('❌ Redo failed:', error);
                return false;
            }
        }
        
        _restoreState(state) {
            if (!state || !this.layerSystem) return;
            
            // 🔧 改修: AnimationSystem経由での確実なCUT取得
            const animationSystem = this.layerSystem.animationSystem || 
                                   window.animationSystem || 
                                   window.TegakiAnimationSystem;
            
            if (!animationSystem) {
                console.warn('⚠️ AnimationSystem not available for restore');
                return;
            }
            
            const currentCut = animationSystem.getCurrentCut?.();
            if (!currentCut) {
                console.warn('⚠️ No active CUT for restore');
                return;
            }
            
            // 既存レイヤーをクリア
            const existingLayers = currentCut.getLayers().slice();
            existingLayers.forEach(layer => {
                currentCut.removeLayer(layer);
                if (layer.destroy) {
                    layer.destroy({ children: true });
                }
            });
            
            // 状態からレイヤーを復元
            state.layers.forEach(layerData => {
                const restoredLayer = this._restoreLayer(layerData);
                if (restoredLayer) {
                    currentCut.addLayer(restoredLayer);
                }
            });
            
            // アクティブレイヤーを設定
            if (state.activeLayerId) {
                const layers = currentCut.getLayers();
                const activeLayerIndex = layers.findIndex(
                    l => l.layerData?.id === state.activeLayerId
                );
                if (activeLayerIndex !== -1) {
                    this.layerSystem.setActiveLayerByIndex?.(activeLayerIndex) || 
                    this.layerSystem.setActiveLayer(activeLayerIndex);
                }
            }
            
            // 🔧 改修: UI更新の確実な実行
            setTimeout(() => {
                if (this.layerSystem.updateLayerPanelUI) {
                    this.layerSystem.updateLayerPanelUI();
                }
                
                if (this.layerSystem.updateStatusDisplay) {
                    this.layerSystem.updateStatusDisplay();
                }
                
                // サムネイル更新
                if (animationSystem.generateCutThumbnailOptimized) {
                    const currentCutIndex = animationSystem.getCurrentCutIndex?.() ?? 0;
                    animationSystem.generateCutThumbnailOptimized(currentCutIndex);
                }
            }, 50);
        }
        
        _restoreLayer(layerData) {
            if (!layerData) return null;
            
            const layer = new PIXI.Container();
            layer.label = layerData.id;
            
            layer.layerData = {
                id: layerData.id,
                name: layerData.name,
                visible: layerData.visible,
                opacity: layerData.opacity,
                isBackground: layerData.isBackground || false,
                paths: []
            };
            
            // Transform復元
            if (layerData.transform) {
                layer.position.set(layerData.transform.x || 0, layerData.transform.y || 0);
                layer.rotation = layerData.transform.rotation || 0;
                layer.scale.set(layerData.transform.scaleX || 1, layerData.transform.scaleY || 1);
            }
            
            layer.visible = layerData.visible;
            layer.alpha = layerData.opacity;
            
            // 背景レイヤーの場合
            if (layerData.isBackground) {
                const config = window.TEGAKI_CONFIG;
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, config.canvas.width, config.canvas.height);
                bg.fill(config.background.color);
                layer.addChild(bg);
                layer.layerData.backgroundGraphics = bg;
            }
            
            // パス復元
            if (layerData.paths && Array.isArray(layerData.paths)) {
                layerData.paths.forEach(pathData => {
                    const path = this._restorePath(pathData);
                    if (path) {
                        layer.layerData.paths.push(path);
                        layer.addChild(path.graphics);
                    }
                });
            }
            
            return layer;
        }
        
        _restorePath(pathData) {
            if (!pathData || !pathData.points || pathData.points.length === 0) {
                return null;
            }
            
            const graphics = new PIXI.Graphics();
            
            pathData.points.forEach(point => {
                if (typeof point.x === 'number' && typeof point.y === 'number' &&
                    isFinite(point.x) && isFinite(point.y)) {
                    graphics.circle(point.x, point.y, (pathData.size || 16) / 2);
                    graphics.fill({
                        color: pathData.color || 0x800000,
                        alpha: pathData.opacity || 1.0
                    });
                }
            });
            
            return {
                id: pathData.id || 'path_' + Date.now(),
                points: pathData.points.map(p => ({ x: p.x, y: p.y })),
                size: pathData.size || 16,
                color: pathData.color || 0x800000,
                opacity: pathData.opacity || 1.0,
                tool: pathData.tool || 'pen',
                graphics: graphics
            };
        }
        
        canUndo() {
            return this.undoStack.length > 0;
        }
        
        canRedo() {
            return this.redoStack.length > 0;
        }
        
        clear() {
            this.undoStack = [];
            this.redoStack = [];
            this._emitStateChanged();
        }
        
        getHistoryInfo() {
            return {
                undoCount: this.undoStack.length,
                redoCount: this.redoStack.length,
                maxHistory: this.maxHistory,
                canUndo: this.canUndo(),
                canRedo: this.canRedo()
            };
        }
        
        _emitStateChanged() {
            if (this.eventBus) {
                this.eventBus.emit('history:changed', {
                    undoCount: this.undoStack.length,
                    redoCount: this.redoStack.length,
                    canUndo: this.canUndo(),
                    canRedo: this.canRedo()
                });
            }
        }
    }
    
    // グローバル公開
    const historyManager = new HistoryManager();
    
    window.History = {
        undo: () => historyManager.undo(),
        redo: () => historyManager.redo(),
        saveState: () => historyManager.saveState(),
        clear: () => historyManager.clear(),
        canUndo: () => historyManager.canUndo(),
        canRedo: () => historyManager.canRedo(),
        getHistoryInfo: () => historyManager.getHistoryInfo(),
        setLayerSystem: (layerSystem) => historyManager.setLayerSystem(layerSystem),
        MAX_HISTORY: MAX_HISTORY,
        _manager: historyManager
    };
    
    // LayerSystem設定を監視
    if (window.TegakiEventBus) {
        window.TegakiEventBus.on('layer:system-initialized', (data) => {
            if (data.layerSystem) {
                historyManager.setLayerSystem(data.layerSystem);
            }
        });
        
        // AnimationSystem初期化時にも接続を試みる
        window.TegakiEventBus.on('animation:system-ready', () => {
            if (historyManager.layerSystem) {
                const animationSystem = window.animationSystem || window.TegakiAnimationSystem;
                if (animationSystem && historyManager.layerSystem.animationSystem !== animationSystem) {
                    historyManager.layerSystem.animationSystem = animationSystem;
                    console.log('✅ History: AnimationSystem connection established');
                }
            }
        });
    }
    
    console.log('✅ system/history.js (AnimationSystem統合強化版) loaded');
    console.log('  - Undo/Redo stack management');
    console.log('  - Max history: ' + MAX_HISTORY);
    console.log('  - AnimationSystem統合強化');
    
})();