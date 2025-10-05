// ================================================================================
// system/history.js - GPT5案対応改修版
// ================================================================================
// 🎯 executeCommand実装追加
// ✅ Command-Based Architecture完全対応
// ✅ グローバル名window.Historyのまま維持（衝突なし確認済み）

(function() {
    'use strict';
    
    class HistoryManager {
        constructor() {
            this.eventBus = window.TegakiEventBus;
            this.stateManager = null;
            this.layerSystem = null;
            
            // Undo/Redoスタック
            this.undoStack = [];
            this.redoStack = [];
            this.MAX_HISTORY = 50;
            
            // 実行制御フラグ
            this.isExecutingUndoRedo = false;
            this.isRecordingState = false;
            this.isExecutingCommand = false; // 🔧 追加: Command実行中フラグ
            
            // 初期化待機
            this.isInitialized = false;
            
            if (!this.eventBus) {
                throw new Error('TegakiEventBus not found');
            }
            
            // 初期化完了を待つ
            this.eventBus.on('core:initialized', () => {
                this.initialize();
            });
            
            // StateManagerが先に存在する場合は即座に初期化
            if (window.TegakiStateManager) {
                setTimeout(() => this.initialize(), 100);
            }
        }
        
        initialize() {
            if (this.isInitialized) return;
            
            // StateManagerの取得
            if (window.TegakiStateManager) {
                this.stateManager = new window.TegakiStateManager(
                    window.TEGAKI_CONFIG,
                    this.eventBus
                );
            } else {
                console.warn('StateManager not available yet');
                return;
            }
            
            this.isInitialized = true;
            this.setupEventListeners();
            
            // 初期状態を保存
            this.saveState();
        }
        
        // ===== 🔧 新規: executeCommand実装 =====
        
        executeCommand(command) {
            if (!command) {
                throw new Error('HistoryManager.executeCommand: command is required');
            }
            
            if (typeof command.execute !== 'function') {
                throw new Error('HistoryManager.executeCommand: command.execute must be a function');
            }
            
            // Command実行中フラグをセット
            this.isExecutingCommand = true;
            
            try {
                // Commandを実行
                command.execute();
                
                // 現在の状態を保存
                this.saveState();
                
            } catch (error) {
                console.error('executeCommand failed:', error);
                throw error;
            } finally {
                this.isExecutingCommand = false;
            }
        }
        
        // ===== イベント監視による自動記録 =====
        
        setupEventListeners() {
            if (!this.eventBus) return;
            
            // レイヤー作成完了 → 自動記録
            this.eventBus.on('layer:created', (data) => {
                if (!this.isExecutingUndoRedo && !this.isRecordingState && !this.isExecutingCommand) {
                    this.saveState();
                }
            });
            
            // レイヤー削除完了 → 自動記録
            this.eventBus.on('layer:deleted', (data) => {
                if (!this.isExecutingUndoRedo && !this.isRecordingState && !this.isExecutingCommand) {
                    this.saveState();
                }
            });
            
            // レイヤー並び替え完了 → 自動記録
            this.eventBus.on('layer:reordered', (data) => {
                if (!this.isExecutingUndoRedo && !this.isRecordingState && !this.isExecutingCommand) {
                    this.saveState();
                }
            });
            
            // 描画完了 → 自動記録
            this.eventBus.on('drawing:completed', (data) => {
                if (!this.isExecutingUndoRedo && !this.isRecordingState && !this.isExecutingCommand) {
                    this.saveState();
                }
            });
            
            // CUT作成完了 → 自動記録
            this.eventBus.on('animation:cut-created', (data) => {
                if (!this.isExecutingUndoRedo && !this.isRecordingState && !this.isExecutingCommand) {
                    this.saveState();
                }
            });
            
            // CUT削除完了 → 自動記録
            this.eventBus.on('animation:cut-deleted', (data) => {
                if (!this.isExecutingUndoRedo && !this.isRecordingState && !this.isExecutingCommand) {
                    this.saveState();
                }
            });
            
            // CUT並び替え完了 → 自動記録
            this.eventBus.on('animation:cuts-reordered', (data) => {
                if (!this.isExecutingUndoRedo && !this.isRecordingState && !this.isExecutingCommand) {
                    this.saveState();
                }
            });
            
            // レイヤークリア完了 → 自動記録
            this.eventBus.on('layer:cleared', (data) => {
                if (!this.isExecutingUndoRedo && !this.isRecordingState && !this.isExecutingCommand) {
                    this.saveState();
                }
            });
            
            // レイヤートランスフォーム確定 → 自動記録
            this.eventBus.on('layer:transform-confirmed', (data) => {
                if (!this.isExecutingUndoRedo && !this.isRecordingState && !this.isExecutingCommand) {
                    this.saveState();
                }
            });
        }
        
        // ===== 状態の保存 =====
        
        saveState() {
            if (!this.isInitialized || !this.stateManager) {
                return;
            }
            
            // Undo/Redo実行中、記録中、Command実行中はスキップ
            if (this.isExecutingUndoRedo || this.isRecordingState || this.isExecutingCommand) {
                return;
            }
            
            this.isRecordingState = true;
            
            try {
                // 現在の状態をスナップショット
                const currentState = this.captureCurrentState();
                
                if (!currentState) {
                    this.isRecordingState = false;
                    return;
                }
                
                // Undoスタックに追加
                this.undoStack.push(currentState);
                
                // スタック上限チェック
                if (this.undoStack.length > this.MAX_HISTORY) {
                    this.undoStack.shift();
                }
                
                // Redoスタックをクリア
                this.redoStack = [];
                
                // UI更新通知
                this.notifyHistoryChanged();
                
            } catch (error) {
                console.error('Failed to save state:', error);
            } finally {
                this.isRecordingState = false;
            }
        }
        
        // ===== 現在状態のキャプチャ =====
        
        captureCurrentState() {
            if (!this.layerSystem) {
                this.layerSystem = window.drawingApp?.layerManager || 
                                   window.layerSystem ||
                                   window.TegakiCoreEngine?.layerSystem;
                
                if (!this.layerSystem) {
                    return null;
                }
            }
            
            const animationSystem = window.animationSystem || 
                                   window.drawingApp?.animationSystem;
            
            if (!animationSystem) {
                return null;
            }
            
            // 全CUTの状態をキャプチャ
            const cuts = animationSystem.getAllCuts().map(cut => {
                return {
                    id: cut.id,
                    name: cut.name,
                    duration: cut.duration,
                    layers: cut.getLayers().map(layer => this.captureLayerState(layer))
                };
            });
            
            const currentCutIndex = animationSystem.getCurrentCutIndex();
            const currentLayerIndex = this.layerSystem.activeLayerIndex;
            
            return {
                timestamp: Date.now(),
                cuts: cuts,
                currentCutIndex: currentCutIndex,
                currentLayerIndex: currentLayerIndex
            };
        }
        
        captureLayerState(layer) {
            if (!layer || !layer.layerData) {
                return null;
            }
            
            return {
                id: layer.layerData.id,
                name: layer.layerData.name,
                visible: layer.layerData.visible,
                opacity: layer.layerData.opacity,
                isBackground: layer.layerData.isBackground,
                transform: {
                    x: layer.position.x,
                    y: layer.position.y,
                    rotation: layer.rotation,
                    scaleX: layer.scale.x,
                    scaleY: layer.scale.y,
                    pivotX: layer.pivot.x,
                    pivotY: layer.pivot.y
                },
                paths: (layer.layerData.paths || []).map(path => ({
                    id: path.id,
                    points: path.points.map(p => ({ x: p.x, y: p.y })),
                    color: path.color,
                    size: path.size,
                    opacity: path.opacity,
                    tool: path.tool
                }))
            };
        }
        
        // ===== Undo実行 =====
        
        undo() {
            if (!this.isInitialized || this.undoStack.length === 0) {
                return;
            }
            
            if (this.isExecutingUndoRedo) {
                return;
            }
            
            this.isExecutingUndoRedo = true;
            
            try {
                // 現在の状態をRedoスタックに保存
                const currentState = this.captureCurrentState();
                if (currentState) {
                    this.redoStack.push(currentState);
                }
                
                // Undoスタックから状態を取得
                const previousState = this.undoStack.pop();
                
                // 状態を復元
                this.restoreState(previousState);
                
                // UI更新通知
                this.notifyHistoryChanged();
                
            } catch (error) {
                console.error('Undo failed:', error);
            } finally {
                this.isExecutingUndoRedo = false;
            }
        }
        
        // ===== Redo実行 =====
        
        redo() {
            if (!this.isInitialized || this.redoStack.length === 0) {
                return;
            }
            
            if (this.isExecutingUndoRedo) {
                return;
            }
            
            this.isExecutingUndoRedo = true;
            
            try {
                // 現在の状態をUndoスタックに保存
                const currentState = this.captureCurrentState();
                if (currentState) {
                    this.undoStack.push(currentState);
                }
                
                // Redoスタックから状態を取得
                const nextState = this.redoStack.pop();
                
                // 状態を復元
                this.restoreState(nextState);
                
                // UI更新通知
                this.notifyHistoryChanged();
                
            } catch (error) {
                console.error('Redo failed:', error);
            } finally {
                this.isExecutingUndoRedo = false;
            }
        }
        
        // ===== 状態の復元 =====
        
        restoreState(state) {
            if (!state || !state.cuts) {
                return;
            }
            
            const animationSystem = window.animationSystem;
            if (!animationSystem || !this.layerSystem) {
                return;
            }
            
            // 既存のCUTを全て削除
            const existingCuts = animationSystem.getAllCuts();
            for (let i = existingCuts.length - 1; i >= 0; i--) {
                const cut = existingCuts[i];
                
                // RenderTextureを破棄
                if (this.layerSystem.destroyCutRenderTexture) {
                    this.layerSystem.destroyCutRenderTexture(cut.id);
                }
                
                // Containerを削除
                if (animationSystem.canvasContainer && cut.container.parent) {
                    animationSystem.canvasContainer.removeChild(cut.container);
                }
                
                // Containerを破棄
                cut.container.destroy({ children: true });
            }
            
            // AnimationDataをクリア
            animationSystem.animationData.cuts = [];
            
            // 復元するCUTを作成
            state.cuts.forEach((cutData, cutIndex) => {
                const cut = this.restoreCut(cutData, animationSystem);
                animationSystem.animationData.cuts.push(cut);
                
                if (animationSystem.canvasContainer) {
                    animationSystem.canvasContainer.addChild(cut.container);
                    cut.container.visible = false;
                }
                
                // RenderTextureを作成
                if (this.layerSystem.createCutRenderTexture) {
                    this.layerSystem.createCutRenderTexture(cut.id);
                }
            });
            
            // CUTを切り替え
            const targetCutIndex = Math.min(
                state.currentCutIndex,
                animationSystem.animationData.cuts.length - 1
            );
            
            animationSystem.switchToActiveCut(targetCutIndex);
            
            // レイヤーを選択
            if (state.currentLayerIndex !== undefined) {
                const layers = this.layerSystem.getLayers();
                const targetLayerIndex = Math.min(
                    state.currentLayerIndex,
                    layers.length - 1
                );
                
                if (targetLayerIndex >= 0) {
                    this.layerSystem.setActiveLayer(targetLayerIndex);
                }
            }
            
            // サムネイル更新
            setTimeout(() => {
                animationSystem.animationData.cuts.forEach((cut, index) => {
                    animationSystem.generateCutThumbnail(index);
                });
            }, 100);
            
            // UI更新
            this.layerSystem.updateLayerPanelUI();
            this.layerSystem.updateStatusDisplay();
        }
        
        restoreCut(cutData, animationSystem) {
            const config = window.TEGAKI_CONFIG;
            const cut = new window.TegakiCut(cutData.id, cutData.name, config);
            cut.duration = cutData.duration;
            
            // レイヤーを復元
            cutData.layers.forEach(layerData => {
                if (!layerData) return;
                
                const layer = this.restoreLayer(layerData, config);
                if (layer) {
                    cut.addLayer(layer);
                }
            });
            
            return cut;
        }
        
        restoreLayer(layerData, config) {
            const layer = new PIXI.Container();
            layer.label = layerData.id;
            
            layer.layerData = {
                id: layerData.id,
                name: layerData.name,
                visible: layerData.visible,
                opacity: layerData.opacity,
                isBackground: layerData.isBackground,
                paths: []
            };
            
            // トランスフォーム復元
            if (layerData.transform) {
                layer.position.set(
                    layerData.transform.x || 0,
                    layerData.transform.y || 0
                );
                layer.rotation = layerData.transform.rotation || 0;
                layer.scale.set(
                    layerData.transform.scaleX || 1,
                    layerData.transform.scaleY || 1
                );
                layer.pivot.set(
                    layerData.transform.pivotX || 0,
                    layerData.transform.pivotY || 0
                );
            }
            
            layer.visible = layerData.visible;
            layer.alpha = layerData.opacity;
            
            // 背景レイヤー
            if (layerData.isBackground) {
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, config.canvas.width, config.canvas.height);
                bg.fill(config.background.color);
                layer.addChild(bg);
                layer.layerData.backgroundGraphics = bg;
            }
            
            // パスを復元
            if (layerData.paths && Array.isArray(layerData.paths)) {
                layerData.paths.forEach(pathData => {
                    const path = this.restorePath(pathData);
                    if (path) {
                        layer.layerData.paths.push(path);
                        layer.addChild(path.graphics);
                    }
                });
            }
            
            return layer;
        }
        
        restorePath(pathData) {
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
                id: pathData.id,
                points: pathData.points.map(p => ({ x: p.x, y: p.y })),
                color: pathData.color || 0x800000,
                size: pathData.size || 16,
                opacity: pathData.opacity || 1.0,
                tool: pathData.tool || 'pen',
                graphics: graphics
            };
        }
        
        // ===== UI通知 =====
        
        notifyHistoryChanged() {
            if (!this.eventBus) return;
            
            this.eventBus.emit('history:changed', {
                undoCount: this.undoStack.length,
                redoCount: this.redoStack.length,
                maxHistory: this.MAX_HISTORY
            });
        }
        
        // ===== 情報取得 =====
        
        getHistoryInfo() {
            return {
                undoCount: this.undoStack.length,
                redoCount: this.redoStack.length,
                maxHistory: this.MAX_HISTORY,
                canUndo: this.undoStack.length > 0,
                canRedo: this.redoStack.length > 0
            };
        }
        
        // ===== LayerSystem設定 =====
        
        setLayerSystem(layerSystem) {
            this.layerSystem = layerSystem;
        }
        
        // ===== デバッグ情報 =====
        
        getDebugInfo() {
            return {
                initialized: this.isInitialized,
                undoStackSize: this.undoStack.length,
                redoStackSize: this.redoStack.length,
                isExecutingUndoRedo: this.isExecutingUndoRedo,
                isRecordingState: this.isRecordingState,
                isExecutingCommand: this.isExecutingCommand,
                hasStateManager: !!this.stateManager,
                hasLayerSystem: !!this.layerSystem
            };
        }
    }
    
    // ===== グローバル公開 =====
    
    const historyManager = new HistoryManager();
    
    // 🔧 GPT5案対応: window.Historyのまま維持（衝突なし）
    window.History = {
        _manager: historyManager,
        
        // 🔧 追加: executeCommand実装
        executeCommand: (command) => historyManager.executeCommand(command),
        
        undo: () => historyManager.undo(),
        redo: () => historyManager.redo(),
        saveState: () => historyManager.saveState(),
        
        getHistoryInfo: () => historyManager.getHistoryInfo(),
        setLayerSystem: (layerSystem) => historyManager.setLayerSystem(layerSystem),
        
        get isExecutingUndoRedo() {
            return historyManager.isExecutingUndoRedo;
        },
        get isRecordingState() {
            return historyManager.isRecordingState;
        },
        
        MAX_HISTORY: 50
    };
    
    window.TegakiHistory = historyManager;
    
    console.log('✅ history.js loaded (GPT5案対応・executeCommand実装済み)');
    
})();