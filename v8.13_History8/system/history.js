// ================================================================================
// system/history.js - 改修版：Snapshotベース + トランザクション
// ================================================================================
// 改修内容：
// - structuredClone による完全なスナップショット保存
// - pushSnapshot() での即座の保存（遅延なし）
// - トランザクション単位でのHistory記録
// - Undo/Redo時の二重変更防止

(function() {
    'use strict';
    
    const MAX_HISTORY = 50;
    
    class HistoryEntry {
        constructor(snapshot, metadata = {}) {
            this.id = `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.snapshot = snapshot; // structuredClone済みのスナップショット
            this.metadata = metadata;
            this.timestamp = Date.now();
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
            
            // Undo/Redo実行中フラグ
            this.isExecutingUndoRedo = false;
            
            // スナップショット記録中フラグ
            this.isRecordingSnapshot = false;
            
            if (!this.eventBus) {
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
            
            // 🔥 追加: 描画イベント監視（デバウンス処理）
            this.eventBus.on('layer:path-added', () => {
                if (!this.isExecutingUndoRedo) {
                    this.pushSnapshotDebounced('drawing', 500);
                }
            });
            
            // CUT作成・削除・ペーストのイベント監視（即座に記録）
            this.eventBus.on('animation:cut-created', () => {
                if (!this.isExecutingUndoRedo) {
                    this.pushSnapshot('cut-created');
                }
            });
            
            this.eventBus.on('animation:cut-deleted', () => {
                if (!this.isExecutingUndoRedo) {
                    this.pushSnapshot('cut-deleted');
                }
            });
            
            this.eventBus.on('cut:pasted-right-adjacent', () => {
                if (!this.isExecutingUndoRedo) {
                    this.pushSnapshot('cut-pasted');
                }
            });
            
            this.eventBus.on('cut:pasted-new', () => {
                if (!this.isExecutingUndoRedo) {
                    this.pushSnapshot('cut-pasted');
                }
            });
        }
        
        // ===== Snapshot記録 =====
        
        pushSnapshot(label = 'state') {
            // Undo/Redo実行中は記録しない
            if (this.isExecutingUndoRedo) {
                return;
            }
            
            // 記録中の再入を防止
            if (this.isRecordingSnapshot) {
                return;
            }
            
            if (!this.layerSystem) {
                return;
            }
            
            this.isRecordingSnapshot = true;
            
            try {
                const snapshot = this._captureFullState();
                if (!snapshot) {
                    return;
                }
                
                const entry = new HistoryEntry(snapshot, { type: label });
                
                // Redoスタックをクリア
                this.redoStack = [];
                
                // Undoスタックに追加
                this.undoStack.push(entry);
                
                // 最大履歴数を超えたら古いものを削除
                if (this.undoStack.length > this.maxHistory) {
                    this.undoStack.shift();
                }
                
                this._emitStateChanged();
            } catch (error) {
            } finally {
                this.isRecordingSnapshot = false;
            }
        }
        
        // レガシーAPI互換（描画系操作用）
        saveState() {
            this.pushSnapshot('drawing');
        }
        
        saveStateFull() {
            this.pushSnapshot('full-state');
        }
        
        // ===== Undo/Redo =====
        
        undo() {
            if (!this.canUndo()) return false;
            if (this.isExecutingUndoRedo) return false;
            
            this.isExecutingUndoRedo = true;
            
            try {
                // 現在の状態をRedoスタックに保存
                const currentSnapshot = this._captureFullState();
                if (currentSnapshot) {
                    const redoEntry = new HistoryEntry(currentSnapshot, { type: 'redo-point' });
                    this.redoStack.push(redoEntry);
                }
                
                // Undoスタックから1つ取り出して復元
                const entry = this.undoStack.pop();
                this._restoreFullState(entry.snapshot);
                
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
                // 現在の状態をUndoスタックに保存
                const currentSnapshot = this._captureFullState();
                if (currentSnapshot) {
                    const undoEntry = new HistoryEntry(currentSnapshot, { type: 'undo-point' });
                    this.undoStack.push(undoEntry);
                }
                
                // Redoスタックから1つ取り出して復元
                const entry = this.redoStack.pop();
                this._restoreFullState(entry.snapshot);
                
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
        
        _captureFullState() {
            if (!this.layerSystem) return null;
            
            const animationSystem = this.layerSystem.animationSystem || 
                                   window.animationSystem || 
                                   window.TegakiAnimationSystem;
            
            if (!animationSystem) return null;
            
            const animData = animationSystem.getAnimationData();
            if (!animData || !animData.cuts) return null;
            
            // structuredClone で完全なディープコピー
            const snapshot = {
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
            
            return structuredClone(snapshot);
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
        
        _restoreFullState(snapshot) {
            if (!snapshot || !this.layerSystem) return;
            
            const animationSystem = this.layerSystem.animationSystem || 
                                   window.animationSystem || 
                                   window.TegakiAnimationSystem;
            
            if (!animationSystem) return;
            
            const animData = animationSystem.getAnimationData();
            if (!animData) return;
            
            // 既存のCUTを全て破棄
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
            
            // スナップショットからCUTを再構築
            snapshot.cuts.forEach((cutData, index) => {
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
            
            // 現在のCUTを復元
            const targetIndex = Math.min(snapshot.currentCutIndex, animData.cuts.length - 1);
            if (targetIndex >= 0) {
                animationSystem.switchToActiveCutSafely(targetIndex, false);
            }
            
            // UI更新とサムネイル再生成
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
                recentUndo: this.undoStack.slice(-3).map(e => e.getDescription()),
                recentRedo: this.redoStack.slice(-3).map(e => e.getDescription()),
                isExecutingUndoRedo: this.isExecutingUndoRedo,
                isRecordingSnapshot: this.isRecordingSnapshot
            };
        }
    }
    
    const historyManager = new HistoryManager();
    
    // ===== キーボードショートカット =====
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
            
            // Undo: Ctrl+Z (Win) / Cmd+Z (Mac)
            if (metaKey && !e.shiftKey && !e.altKey && e.code === 'KeyZ') {
                historyManager.undo();
                e.preventDefault();
                return;
            }
            
            // Redo: Ctrl+Y (Win) / Cmd+Shift+Z (Mac)
            if ((metaKey && !e.altKey && e.code === 'KeyY') || 
                (metaKey && e.shiftKey && !e.altKey && e.code === 'KeyZ')) {
                historyManager.redo();
                e.preventDefault();
                return;
            }
        });
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupHistoryKeyboardShortcuts);
    } else {
        setupHistoryKeyboardShortcuts();
    }
    
    // ===== グローバルAPI =====
    window.History = {
        undo: () => historyManager.undo(),
        redo: () => historyManager.redo(),
        saveState: () => historyManager.saveState(),
        saveStateFull: () => historyManager.saveStateFull(),
        pushSnapshot: (label) => historyManager.pushSnapshot(label),
        clear: () => historyManager.clear(),
        canUndo: () => historyManager.canUndo(),
        canRedo: () => historyManager.canRedo(),
        getHistoryInfo: () => historyManager.getHistoryInfo(),
        getDebugInfo: () => historyManager.getDebugInfo(),
        setLayerSystem: (layerSystem) => historyManager.setLayerSystem(layerSystem),
        MAX_HISTORY: MAX_HISTORY,
        _manager: historyManager
    };
    
    // LayerSystem初期化イベント
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