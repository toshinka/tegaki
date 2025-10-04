// ================================================================================
// system/history.js - Undo/Redo無限増殖修正版
// ================================================================================
// 【修正】suspended フラグで undo/redo 実行中の履歴記録を完全抑止
// 【修正】Command パターン導入準備（将来の拡張性向上）

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
            
            // 🔧 修正: 記録抑止フラグ追加
            this.suspended = false;
            
            if (!this.eventBus) {
                console.warn('⚠️ TegakiEventBus not found - History system disabled');
                return;
            }
            
            this._setupEventListeners();
        }
        
        setLayerSystem(layerSystem) {
            this.layerSystem = layerSystem;
        }
        
        // 🔧 修正: withSuspend ユーティリティ追加
        withSuspend(fn) {
            const prev = this.suspended;
            this.suspended = true;
            try {
                return fn();
            } finally {
                this.suspended = prev;
            }
        }
        
        _setupEventListeners() {
            if (!this.eventBus) return;
            
            this.eventBus.on('history:undo-request', () => this.undo());
            this.eventBus.on('history:redo-request', () => this.redo());
            this.eventBus.on('history:save-state', () => this.saveState());
            this.eventBus.on('history:clear', () => this.clear());
            
            this.eventBus.on('layer:created', () => {
                setTimeout(() => this.saveState(), 50);
            });
            
            this.eventBus.on('layer:deleted', () => {
                setTimeout(() => this.saveState(), 50);
            });
            
            this.eventBus.on('animation:cut-created', () => {
                setTimeout(() => this.saveStateFull(), 50);
            });
            
            this.eventBus.on('animation:cut-deleted', () => {
                setTimeout(() => this.saveStateFull(), 50);
            });
        }
        
        saveState() {
            // 🔧 修正: suspended 中は記録しない
            if (!this.layerSystem || this.suspended) return;
            
            try {
                this.suspended = true;
                const state = this._captureState();
                
                if (!state) {
                    return;
                }
                
                this.undoStack.push(state);
                
                if (this.undoStack.length > this.maxHistory) {
                    this.undoStack.shift();
                }
                
                this.redoStack = [];
                
                this._emitStateChanged();
                
            } catch (error) {
            } finally {
                this.suspended = false;
            }
        }
        
        saveStateFull() {
            // 🔧 修正: suspended 中は記録しない
            if (!this.layerSystem || this.suspended) return;
            
            try {
                this.suspended = true;
                const state = this._captureFullState();
                
                if (!state) {
                    return;
                }
                
                this.undoStack.push(state);
                
                if (this.undoStack.length > this.maxHistory) {
                    this.undoStack.shift();
                }
                
                this.redoStack = [];
                
                this._emitStateChanged();
                
            } catch (error) {
            } finally {
                this.suspended = false;
            }
        }
        
        _captureState() {
            if (!this.layerSystem) return null;
            
            const animationSystem = this.layerSystem.animationSystem || 
                                   window.animationSystem || 
                                   window.TegakiAnimationSystem;
            
            if (!animationSystem) {
                return null;
            }
            
            const currentCut = animationSystem.getCurrentCut?.();
            if (!currentCut) {
                return null;
            }
            
            const layers = currentCut.getLayers();
            if (!layers || layers.length === 0) return null;
            
            return {
                type: 'layer-state',
                timestamp: Date.now(),
                cutId: currentCut.id,
                cutIndex: animationSystem.getCurrentCutIndex?.() ?? 0,
                layers: layers.map(layer => this._captureLayerState(layer)),
                activeLayerId: this.layerSystem.activeLayer?.layerData?.id || null
            };
        }
        
        _captureFullState() {
            if (!this.layerSystem) return null;
            
            const animationSystem = this.layerSystem.animationSystem || 
                                   window.animationSystem || 
                                   window.TegakiAnimationSystem;
            
            if (!animationSystem) {
                return null;
            }
            
            const animData = animationSystem.getAnimationData();
            if (!animData || !animData.cuts) return null;
            
            return {
                type: 'full-state',
                timestamp: Date.now(),
                currentCutIndex: animationSystem.getCurrentCutIndex?.() ?? 0,
                cuts: animData.cuts.map(cut => ({
                    id: cut.id,
                    name: cut.name,
                    duration: cut.duration,
                    layers: cut.getLayers().map(layer => this._captureLayerState(layer))
                }))
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
            
            // 🔧 修正: withSuspend でラップ
            return this.withSuspend(() => {
                try {
                    const state = this.undoStack[this.undoStack.length - 1];
                    
                    let currentState;
                    if (state.type === 'full-state') {
                        currentState = this._captureFullState();
                    } else {
                        currentState = this._captureState();
                    }
                    
                    if (currentState) {
                        this.redoStack.push(currentState);
                    }
                    
                    const previousState = this.undoStack.pop();
                    
                    if (previousState.type === 'full-state') {
                        this._restoreFullState(previousState);
                    } else {
                        this._restoreState(previousState);
                    }
                    
                    this._emitStateChanged();
                    
                    if (this.eventBus) {
                        this.eventBus.emit('history:undo-completed', {
                            canUndo: this.canUndo(),
                            canRedo: this.canRedo()
                        });
                    }
                    
                    return true;
                    
                } catch (error) {
                    return false;
                }
            });
        }
        
        redo() {
            if (!this.canRedo()) return false;
            
            // 🔧 修正: withSuspend でラップ
            return this.withSuspend(() => {
                try {
                    const state = this.redoStack[this.redoStack.length - 1];
                    
                    let currentState;
                    if (state.type === 'full-state') {
                        currentState = this._captureFullState();
                    } else {
                        currentState = this._captureState();
                    }
                    
                    if (currentState) {
                        this.undoStack.push(currentState);
                    }
                    
                    const nextState = this.redoStack.pop();
                    
                    if (nextState.type === 'full-state') {
                        this._restoreFullState(nextState);
                    } else {
                        this._restoreState(nextState);
                    }
                    
                    this._emitStateChanged();
                    
                    if (this.eventBus) {
                        this.eventBus.emit('history:redo-completed', {
                            canUndo: this.canUndo(),
                            canRedo: this.canRedo()
                        });
                    }
                    
                    return true;
                    
                } catch (error) {
                    return false;
                }
            });
        }
        
        _restoreState(state) {
            if (!state || !this.layerSystem) return;
            
            const animationSystem = this.layerSystem.animationSystem || 
                                   window.animationSystem || 
                                   window.TegakiAnimationSystem;
            
            if (!animationSystem) {
                return;
            }
            
            const currentCut = animationSystem.getCurrentCut?.();
            if (!currentCut) {
                return;
            }
            
            while (currentCut.container.children.length > 0) {
                const layer = currentCut.container.children[0];
                currentCut.container.removeChild(layer);
                if (layer.destroy) {
                    layer.destroy({ children: true });
                }
            }
            
            state.layers.forEach(layerData => {
                const restoredLayer = this._restoreLayer(layerData);
                if (restoredLayer) {
                    currentCut.container.addChild(restoredLayer);
                }
            });
            
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
            
            setTimeout(() => {
                if (this.layerSystem.updateLayerPanelUI) {
                    this.layerSystem.updateLayerPanelUI();
                }
                
                if (this.layerSystem.updateStatusDisplay) {
                    this.layerSystem.updateStatusDisplay();
                }
                
                if (animationSystem.generateCutThumbnailOptimized) {
                    const currentCutIndex = animationSystem.getCurrentCutIndex?.() ?? 0;
                    animationSystem.generateCutThumbnailOptimized(currentCutIndex);
                }
            }, 50);
        }
        
        _restoreFullState(state) {
            if (!state || !this.layerSystem) return;
            
            const animationSystem = this.layerSystem.animationSystem || 
                                   window.animationSystem || 
                                   window.TegakiAnimationSystem;
            
            if (!animationSystem) {
                return;
            }
            
            const animData = animationSystem.getAnimationData();
            if (!animData) return;
            
            const existingCuts = animData.cuts.slice();
            existingCuts.forEach(cut => {
                while (cut.container.children.length > 0) {
                    const layer = cut.container.children[0];
                    cut.container.removeChild(layer);
                    if (layer.destroy) {
                        layer.destroy({ children: true });
                    }
                }
            });
            
            animData.cuts = [];
            
            state.cuts.forEach(cutData => {
                const newCut = animationSystem.createNewBlankCut();
                newCut.id = cutData.id;
                newCut.name = cutData.name;
                newCut.duration = cutData.duration;
                
                const cutToPopulate = animData.cuts[animData.cuts.length - 1];
                
                while (cutToPopulate.container.children.length > 0) {
                    const layer = cutToPopulate.container.children[0];
                    cutToPopulate.container.removeChild(layer);
                    if (layer.destroy) {
                        layer.destroy({ children: true });
                    }
                }
                
                cutData.layers.forEach(layerData => {
                    const restoredLayer = this._restoreLayer(layerData);
                    if (restoredLayer) {
                        cutToPopulate.container.addChild(restoredLayer);
                    }
                });
            });
            
            animationSystem.switchToActiveCutSafely(state.currentCutIndex, false);
            
            setTimeout(() => {
                if (this.eventBus) {
                    this.eventBus.emit('animation:cuts-restored');
                }
                
                if (this.layerSystem.updateLayerPanelUI) {
                    this.layerSystem.updateLayerPanelUI();
                }
                
                if (window.TegakiTimelineUI || window.TegakiUI?.TimelineUI) {
                    const timelineUI = window.timelineUI;
                    if (timelineUI && typeof timelineUI.updateCutsList === 'function') {
                        timelineUI.updateCutsList();
                        timelineUI.updateLayerPanelIndicator();
                    }
                }
                
                animData.cuts.forEach((cut, index) => {
                    if (animationSystem.generateCutThumbnailOptimized) {
                        animationSystem.generateCutThumbnailOptimized(index);
                    }
                });
            }, 100);
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
            
            if (layerData.transform) {
                layer.position.set(layerData.transform.x || 0, layerData.transform.y || 0);
                layer.rotation = layerData.transform.rotation || 0;
                layer.scale.set(layerData.transform.scaleX || 1, layerData.transform.scaleY || 1);
            }
            
            layer.visible = layerData.visible;
            layer.alpha = layerData.opacity;
            
            if (layerData.isBackground) {
                const config = window.TEGAKI_CONFIG;
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, config.canvas.width, config.canvas.height);
                bg.fill(config.background.color);
                layer.addChild(bg);
                layer.layerData.backgroundGraphics = bg;
            }
            
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
    
    const historyManager = new HistoryManager();
    
    window.History = {
        undo: () => historyManager.undo(),
        redo: () => historyManager.redo(),
        saveState: () => historyManager.saveState(),
        saveStateFull: () => historyManager.saveStateFull(),
        clear: () => historyManager.clear(),
        canUndo: () => historyManager.canUndo(),
        canRedo: () => historyManager.canRedo(),
        getHistoryInfo: () => historyManager.getHistoryInfo(),
        setLayerSystem: (layerSystem) => historyManager.setLayerSystem(layerSystem),
        MAX_HISTORY: MAX_HISTORY,
        _manager: historyManager
    };
    
    if (window.TegakiEventBus) {
        window.TegakiEventBus.on('layer:system-initialized', (data) => {
            if (data.layerSystem) {
                historyManager.setLayerSystem(data.layerSystem);
            }
        });
        
        window.TegakiEventBus.on('animation:system-ready', () => {
            if (historyManager.layerSystem) {
                const animationSystem = window.animationSystem || window.TegakiAnimationSystem;
                if (animationSystem && historyManager.layerSystem.animationSystem !== animationSystem) {
                    historyManager.layerSystem.animationSystem = animationSystem;
                }
            }
        });
    }
    
})();