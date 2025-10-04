// ================================================================================
// system/history.js - Command Pattern完全実装版（Undo無限増殖完全解決）
// ================================================================================
// 【修正】Command パターンで do/undo を明確に分離し、副作用を完全排除
// 【修正】undo/redo 実行中の履歴記録を確実に抑止（イベントリスナ経由も含む）

(function() {
    'use strict';
    
    const MAX_HISTORY = 50;
    
    // ===== Command パターン実装 =====
    class Command {
        constructor(doFn, undoFn, metadata = {}) {
            this.doFn = doFn;
            this.undoFn = undoFn;
            this.metadata = metadata;
            this.timestamp = Date.now();
        }
        
        execute() {
            if (typeof this.doFn === 'function') {
                this.doFn();
            }
        }
        
        undo() {
            if (typeof this.undoFn === 'function') {
                this.undoFn();
            }
        }
    }
    
    class HistoryManager {
        constructor() {
            this.stack = [];
            this.position = -1;
            this.maxHistory = MAX_HISTORY;
            this.eventBus = window.TegakiEventBus;
            this.layerSystem = null;
            
            // undo/redo実行中フラグ（完全な副作用抑止用）
            this.isExecutingUndoRedo = false;
            
            if (!this.eventBus) {
                console.warn('⚠️ TegakiEventBus not found - History system disabled');
                return;
            }
            
            this._setupEventListeners();
        }
        
        setLayerSystem(layerSystem) {
            this.layerSystem = layerSystem;
        }
        
        _setupEventListeners() {
            if (!this.eventBus) return;
            
            this.eventBus.on('history:undo-request', () => this.undo());
            this.eventBus.on('history:redo-request', () => this.redo());
            this.eventBus.on('history:clear', () => this.clear());
            
            // レイヤー操作時の履歴保存（undo/redo中は抑止）
            this.eventBus.on('layer:created', () => {
                if (this.isExecutingUndoRedo) return;
                setTimeout(() => this.saveState(), 50);
            });
            
            this.eventBus.on('layer:deleted', () => {
                if (this.isExecutingUndoRedo) return;
                setTimeout(() => this.saveState(), 50);
            });
            
            this.eventBus.on('animation:cut-created', () => {
                if (this.isExecutingUndoRedo) return;
                setTimeout(() => this.saveStateFull(), 50);
            });
            
            this.eventBus.on('animation:cut-deleted', () => {
                if (this.isExecutingUndoRedo) return;
                setTimeout(() => this.saveStateFull(), 50);
            });
        }
        
        // ===== Command 実行（履歴に記録） =====
        execute(command) {
            if (this.isExecutingUndoRedo) return;
            if (!(command instanceof Command)) return;
            
            try {
                command.execute();
                
                this.position++;
                this.stack.splice(this.position, this.stack.length - this.position, command);
                
                if (this.stack.length > this.maxHistory) {
                    this.stack.shift();
                    this.position--;
                }
                
                this._emitStateChanged();
            } catch (error) {
            }
        }
        
        // ===== 従来互換API（内部でCommand化） =====
        saveState() {
            if (this.isExecutingUndoRedo) return;
            if (!this.layerSystem) return;
            
            try {
                const state = this._captureState();
                if (!state) return;
                
                const command = new Command(
                    () => {}, // do は既に実行済み
                    () => this._restoreState(state),
                    { type: 'layer-state', cutId: state.cutId }
                );
                
                this.position++;
                this.stack.splice(this.position, this.stack.length - this.position, command);
                
                if (this.stack.length > this.maxHistory) {
                    this.stack.shift();
                    this.position--;
                }
                
                this._emitStateChanged();
            } catch (error) {
            }
        }
        
        saveStateFull() {
            if (this.isExecutingUndoRedo) return;
            if (!this.layerSystem) return;
            
            try {
                const state = this._captureFullState();
                if (!state) return;
                
                const command = new Command(
                    () => {},
                    () => this._restoreFullState(state),
                    { type: 'full-state' }
                );
                
                this.position++;
                this.stack.splice(this.position, this.stack.length - this.position, command);
                
                if (this.stack.length > this.maxHistory) {
                    this.stack.shift();
                    this.position--;
                }
                
                this._emitStateChanged();
            } catch (error) {
            }
        }
        
        _captureState() {
            if (!this.layerSystem) return null;
            
            const animationSystem = this.layerSystem.animationSystem || 
                                   window.animationSystem || 
                                   window.TegakiAnimationSystem;
            
            if (!animationSystem) return null;
            
            const currentCut = animationSystem.getCurrentCut?.();
            if (!currentCut) return null;
            
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
            
            if (!animationSystem) return null;
            
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
        
        // ===== Undo/Redo実装（副作用完全抑止） =====
        undo() {
            if (!this.canUndo()) return false;
            if (this.isExecutingUndoRedo) return false;
            
            this.isExecutingUndoRedo = true;
            
            try {
                const command = this.stack[this.position];
                command.undo();
                this.position--;
                
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
            } finally {
                this.isExecutingUndoRedo = false;
            }
        }
        
        redo() {
            if (!this.canRedo()) return false;
            if (this.isExecutingUndoRedo) return false;
            
            this.isExecutingUndoRedo = true;
            
            try {
                this.position++;
                const command = this.stack[this.position];
                command.execute();
                
                this._emitStateChanged();
                
                if (this.eventBus) {
                    this.eventBus.emit('history:redo-completed', {
                        canUndo: this.canUndo(),
                        canRedo: this.canRedo()
                    });
                }
                
                return true;
            } catch (error) {
                this.position--;
                return false;
            } finally {
                this.isExecutingUndoRedo = false;
            }
        }
        
        _restoreState(state) {
            if (!state || !this.layerSystem) return;
            
            const animationSystem = this.layerSystem.animationSystem || 
                                   window.animationSystem || 
                                   window.TegakiAnimationSystem;
            
            if (!animationSystem) return;
            
            const currentCut = animationSystem.getCurrentCut?.();
            if (!currentCut) return;
            
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
            
            if (!animationSystem) return;
            
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
            return this.position >= 0;
        }
        
        canRedo() {
            return this.position < this.stack.length - 1;
        }
        
        clear() {
            this.stack = [];
            this.position = -1;
            this._emitStateChanged();
        }
        
        getHistoryInfo() {
            return {
                stackSize: this.stack.length,
                position: this.position,
                undoCount: this.position + 1,
                redoCount: this.stack.length - this.position - 1,
                maxHistory: this.maxHistory,
                canUndo: this.canUndo(),
                canRedo: this.canRedo()
            };
        }
        
        _emitStateChanged() {
            if (this.eventBus) {
                this.eventBus.emit('history:changed', {
                    undoCount: this.position + 1,
                    redoCount: this.stack.length - this.position - 1,
                    canUndo: this.canUndo(),
                    canRedo: this.canRedo()
                });
            }
        }
    }
    
    const historyManager = new HistoryManager();
    
    // グローバルAPI（従来互換）
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
        execute: (command) => historyManager.execute(command),
        MAX_HISTORY: MAX_HISTORY,
        Command: Command,
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