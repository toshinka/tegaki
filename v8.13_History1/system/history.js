// ================================================================================
// system/history.js - 改修版（イベント駆動削減・Undo/Redo一本化）
// ================================================================================
// 改修内容：
// - イベント監視を削減（animation:cut-created, layer:createdを削除）
// - 操作完了時に各モジュールから直接saveState/saveStateFullを呼ぶ方式に変更
// - Undo/Redoショートカットをhistory.jsに一本化（index.htmlから削除）

(function() {
    'use strict';
    
    const MAX_HISTORY = 50;
    
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
        
        getDescription() {
            return `${this.metadata.type || 'unknown'} (${new Date(this.timestamp).toLocaleTimeString()})`;
        }
    }
    
    class HistoryManager {
        constructor() {
            this.undoStack = [];
            this.redoStack = [];
            
            this.maxHistory = MAX_HISTORY;
            this.eventBus = window.TegakiEventBus;
            this.layerSystem = null;
            
            this.isExecutingUndoRedo = false;
            this.isRecordingState = false;
            
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
            
            // 削除：animation:cut-created, layer:createdの自動記録
            // 理由：各システムが操作完了時に明示的にsaveState/saveStateFullを呼ぶ
            
            this.eventBus.on('animation:cut-deleted', () => {
                if (this.isExecutingUndoRedo || this.isRecordingState) return;
                setTimeout(() => this.saveStateFull(), 50);
            });
            
            this.eventBus.on('cut:pasted-right-adjacent', () => {
                if (this.isExecutingUndoRedo || this.isRecordingState) return;
                setTimeout(() => this.saveStateFull(), 50);
            });
            
            this.eventBus.on('cut:pasted-new', () => {
                if (this.isExecutingUndoRedo || this.isRecordingState) return;
                setTimeout(() => this.saveStateFull(), 50);
            });
        }
        
        // ===== State記録 =====
        
        saveState() {
            if (this.isExecutingUndoRedo || this.isRecordingState) {
                return;
            }
            
            if (!this.layerSystem) return;
            
            this.isRecordingState = true;
            
            try {
                const state = this._captureState();
                if (!state) {
                    this.isRecordingState = false;
                    return;
                }
                
                const command = new Command(
                    () => {},
                    () => this._restoreState(state),
                    { type: 'layer-state', cutId: state.cutId }
                );
                
                this.undoStack.push(command);
                this.redoStack = [];
                
                if (this.undoStack.length > this.maxHistory) {
                    this.undoStack.shift();
                }
                
                this._emitStateChanged();
            } catch (error) {
            } finally {
                this.isRecordingState = false;
            }
        }
        
        saveStateFull() {
            if (this.isExecutingUndoRedo || this.isRecordingState) {
                return;
            }
            
            if (!this.layerSystem) return;
            
            this.isRecordingState = true;
            
            try {
                const state = this._captureFullState();
                if (!state) {
                    this.isRecordingState = false;
                    return;
                }
                
                const command = new Command(
                    () => {},
                    () => this._restoreFullState(state),
                    { type: 'full-state' }
                );
                
                this.undoStack.push(command);
                this.redoStack = [];
                
                if (this.undoStack.length > this.maxHistory) {
                    this.undoStack.shift();
                }
                
                this._emitStateChanged();
            } catch (error) {
            } finally {
                this.isRecordingState = false;
            }
        }
        
        // ===== Undo/Redo =====
        
        undo() {
            if (!this.canUndo()) return false;
            if (this.isExecutingUndoRedo) return false;
            
            this.isExecutingUndoRedo = true;
            
            try {
                const currentState = this._captureFullState();
                const command = this.undoStack.pop();
                
                command.undo();
                
                if (currentState) {
                    const redoCommand = new Command(
                        () => this._restoreFullState(currentState),
                        () => {},
                        { type: 'redo-state', originalType: command.metadata.type }
                    );
                    this.redoStack.push(redoCommand);
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
            } finally {
                this.isExecutingUndoRedo = false;
            }
        }
        
        redo() {
            if (!this.canRedo()) return false;
            if (this.isExecutingUndoRedo) return false;
            
            this.isExecutingUndoRedo = true;
            
            try {
                const currentState = this._captureFullState();
                const command = this.redoStack.pop();
                
                command.execute();
                
                if (currentState) {
                    const undoCommand = new Command(
                        () => {},
                        () => this._restoreFullState(currentState),
                        { type: 'undo-state', originalType: command.metadata.originalType }
                    );
                    this.undoStack.push(undoCommand);
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
            } finally {
                this.isExecutingUndoRedo = false;
            }
        }
        
        // ===== State Capture =====
        
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
                layers: layers.map(layer => this._captureLayerState(layer)).filter(l => l !== null),
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
                    layers: cut.getLayers().map(layer => this._captureLayerState(layer)).filter(l => l !== null)
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
        
        // ===== State Restore =====
        
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
            
            const layers = currentCut.getLayers();
            if (state.activeLayerId && layers.length > 0) {
                const activeLayerIndex = layers.findIndex(
                    l => l.layerData?.id === state.activeLayerId
                );
                if (activeLayerIndex !== -1) {
                    this.layerSystem.activeLayerIndex = activeLayerIndex;
                } else {
                    this.layerSystem.activeLayerIndex = layers.length - 1;
                }
            } else {
                this.layerSystem.activeLayerIndex = layers.length > 0 ? layers.length - 1 : -1;
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
                if (this.layerSystem?.destroyCutRenderTexture) {
                    this.layerSystem.destroyCutRenderTexture(cut.id);
                }
                
                if (animationSystem.canvasContainer && cut.container.parent === animationSystem.canvasContainer) {
                    animationSystem.canvasContainer.removeChild(cut.container);
                }
                
                while (cut.container.children.length > 0) {
                    const layer = cut.container.children[0];
                    cut.container.removeChild(layer);
                    if (layer.destroy) {
                        layer.destroy({ children: true });
                    }
                }
                
                if (cut.container.destroy) {
                    cut.container.destroy({ children: true });
                }
            });
            
            animData.cuts = [];
            
            const Cut = window.TegakiCut;
            if (!Cut) {
                return;
            }
            
            state.cuts.forEach((cutData, index) => {
                const newCut = new Cut(cutData.id, cutData.name, this.layerSystem.config || window.TEGAKI_CONFIG);
                newCut.duration = cutData.duration;
                
                cutData.layers.forEach(layerData => {
                    const restoredLayer = this._restoreLayer(layerData);
                    if (restoredLayer) {
                        newCut.container.addChild(restoredLayer);
                    }
                });
                
                animData.cuts.push(newCut);
                
                if (animationSystem.canvasContainer) {
                    animationSystem.canvasContainer.addChild(newCut.container);
                    newCut.container.visible = false;
                }
                
                if (this.layerSystem?.createCutRenderTexture) {
                    this.layerSystem.createCutRenderTexture(newCut.id);
                }
            });
            
            const targetIndex = Math.min(state.currentCutIndex, animData.cuts.length - 1);
            if (targetIndex >= 0) {
                animationSystem.switchToActiveCutSafely(targetIndex, false);
            }
            
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
        
        // ===== スタック状態 =====
        
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
                stackSize: this.undoStack.length + this.redoStack.length,
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
        
        getDebugInfo() {
            return {
                undoStackSize: this.undoStack.length,
                redoStackSize: this.redoStack.length,
                recentUndo: this.undoStack.slice(-3).map(c => c.getDescription()),
                recentRedo: this.redoStack.slice(-3).map(c => c.getDescription()),
                isExecutingUndoRedo: this.isExecutingUndoRedo,
                isRecordingState: this.isRecordingState
            };
        }
    }
    
    const historyManager = new HistoryManager();
    
    // キーボードショートカット（history.jsに一本化）
    function setupHistoryKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const activeElement = document.activeElement;
            if (activeElement && (
                activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.isContentEditable
            )) {
                return;
            }
            
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const metaKey = isMac ? e.metaKey : e.ctrlKey;
            
            // Ctrl+Z (Undo) - shiftなし、altなし
            if (metaKey && !e.shiftKey && !e.altKey && e.code === 'KeyZ') {
                historyManager.undo();
                e.preventDefault();
                return;
            }
            
            // Ctrl+Y (Redo) または Ctrl+Shift+Z (Redo)
            if ((metaKey && !e.altKey && e.code === 'KeyY') || 
                (metaKey && e.shiftKey && !e.altKey && e.code === 'KeyZ')) {
                historyManager.redo();
                e.preventDefault();
                return;
            }
        });
    }
    
    // DOMContentLoadedで初期化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupHistoryKeyboardShortcuts);
    } else {
        setupHistoryKeyboardShortcuts();
    }
    
    window.History = {
        undo: () => historyManager.undo(),
        redo: () => historyManager.redo(),
        saveState: () => historyManager.saveState(),
        saveStateFull: () => historyManager.saveStateFull(),
        clear: () => historyManager.clear(),
        canUndo: () => historyManager.canUndo(),
        canRedo: () => historyManager.canRedo(),
        getHistoryInfo: () => historyManager.getHistoryInfo(),
        getDebugInfo: () => historyManager.getDebugInfo(),
        setLayerSystem: (layerSystem) => historyManager.setLayerSystem(layerSystem),
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
    
    console.log('✅ history.js 改修版 loaded');
    console.log('   - イベント駆動History記録削減');
    console.log('   - Undo/Redoショートカット一本化');
    
})();