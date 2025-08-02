/**
 * 履歴制御・アンドゥ・リドゥ・PixiJS v8状態管理
 * モダンお絵かきツール v3.3 - Phase1履歴管理システム
 * 
 * 機能:
 * - PixiJS v8統一状態管理・RenderTexture活用
 * - 非破壊アンドゥ・リドゥ・Container状態保持
 * - Chrome API統合・OffscreenCanvas並列処理
 * - メモリ効率・差分管理・圧縮技術
 * - エアスプレー履歴・ベクターデータ保持
 */

import { RenderTexture } from 'pixi.js';
import { compress, decompress } from 'lz-string';

/**
 * 履歴制御
 * PixiJS v8統一・非破壊状態管理・高効率履歴
 */
class HistoryController {
    constructor(pixiApp, eventStore) {
        this.app = pixiApp;
        this.eventStore = eventStore;
        this.renderer = pixiApp.renderer;
        
        // 履歴スタック管理
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistorySize = 50;
        
        // 現在のアクション状態
        this.currentAction = null;
        this.actionStartTime = null;
        this.isRecording = false;
        
        // 状態管理設定
        this.settings = {
            enabled: true,
            autoSave: true,
            compression: true,
            vectorPreservation: true,
            maxMemoryMB: 100,
            snapshotInterval: 5 // 5アクション毎にフルスナップショット
        };
        
        // パフォーマンス最適化
        this.memoryUsage = 0;
        this.compressionRatio = 0;
        this.useOffscreenCanvas = typeof OffscreenCanvas !== 'undefined';
        
        // PixiJS v8統合設定
        this.stateCapture = {
            renderTextures: new Map(),
            vectorData: new Map(),
            layerStates: new Map()
        };
        
        this.initializeEventStoreIntegration();
        this.setupPerformanceMonitoring();
        
        console.log('✅ HistoryController初期化完了 - PixiJS v8状態管理');
    }
    
    /**
     * EventStore統合初期化
     * イベント連携・自動履歴記録
     */
    initializeEventStoreIntegration() {
        // 履歴対象アクション監視
        const historyActions = [
            'drawing-start', 'drawing-end',
            'layer-created', 'layer-deleted',
            'canvas-clear', 'layer-clear',
            'airbrush-spray', 'tool-config-updated'
        ];
        
        historyActions.forEach(action => {
            this.eventStore.on(action, (data) => {
                if (this.settings.enabled) {
                    this.handleHistoryAction(action, data);
                }
            });
        });
        
        // 手動履歴操作
        this.eventStore.on('history-action', (data) => {
            switch (data.type) {
                case 'undo':
                    this.undo();
                    break;
                case 'redo':
                    this.redo();
                    break;
                case 'clear':
                    this.clearHistory();
                    break;
            }
        });
        
        console.log('🔗 EventStore統合設定完了');
    }
    
    /**
     * パフォーマンス監視設定
     * メモリ使用量・圧縮効率監視
     */
    setupPerformanceMonitoring() {
        // 定期的なメモリ使用量チェック
        setInterval(() => {
            this.updateMemoryUsage();
            this.optimizeMemoryUsage();
        }, 30000); // 30秒間隔
        
        console.log('📊 パフォーマンス監視設定完了');
    }
    
    /**
     * 履歴アクション処理
     * アクション種別による履歴記録制御
     */
    handleHistoryAction(actionType, data) {
        switch (actionType) {
            case 'drawing-start':
                this.beginAction('drawing', data);
                break;
            case 'drawing-end':
                this.endAction();
                break;
            case 'layer-created':
            case 'layer-deleted':
            case 'canvas-clear':
            case 'layer-clear':
                this.recordInstantAction(actionType, data);
                break;
            case 'airbrush-spray':
                this.recordAirbrushAction(data);
                break;
        }
    }
    
    /**
     * アクション開始
     * 状態キャプチャ・記録開始
     */
    beginAction(actionType, data = null) {
        if (this.isRecording) {
            this.endAction(); // 前のアクション強制終了
        }
        
        this.currentAction = {
            type: actionType,
            startState: this.captureCurrentState(),
            startTime: Date.now(),
            data: data,
            id: this.generateActionId()
        };
        
        this.isRecording = true;
        console.log(`📝 アクション開始: ${actionType} [${this.currentAction.id}]`);
    }
    
    /**
     * アクション終了
     * 最終状態キャプチャ・履歴スタック追加
     */
    endAction() {
        if (!this.isRecording || !this.currentAction) {
            return;
        }
        
        const endState = this.captureCurrentState();
        const duration = Date.now() - this.currentAction.startTime;
        
        // 状態変化チェック
        if (this.hasStateChanged(this.currentAction.startState, endState)) {
            const historyEntry = {
                ...this.currentAction,
                endState: endState,
                duration: duration,
                memorySize: this.calculateMemorySize(endState),
                compressed: false
            };
            
            // 圧縮処理
            if (this.settings.compression) {
                historyEntry.compressed = true;
                historyEntry.startState = this.compressState(historyEntry.startState);
                historyEntry.endState = this.compressState(historyEntry.endState);
                historyEntry.compressionRatio = this.calculateCompressionRatio(historyEntry);
            }
            
            this.addToUndoStack(historyEntry);
            console.log(`✅ アクション記録: ${this.currentAction.type} [${duration}ms]`);
        }
        
        this.currentAction = null;
        this.isRecording = false;
    }
    
    /**
     * 瞬間アクション記録
     * 即座に完了するアクション（レイヤー作成等）
     */
    recordInstantAction(actionType, data) {
        const state = this.captureCurrentState();
        
        const historyEntry = {
            type: actionType,
            startState: state,
            endState: state,
            data: data,
            timestamp: Date.now(),
            duration: 0,
            id: this.generateActionId(),
            instant: true
        };
        
        this.addToUndoStack(historyEntry);
        console.log(`⚡ 瞬間アクション記録: ${actionType}`);
    }
    
    /**
     * エアスプレーアクション記録（v3.3新機能）
     * パーティクル描画専用履歴管理
     */
    recordAirbrushAction(data) {
        if (!this.currentAction || this.currentAction.type !== 'airbrush') {
            this.beginAction('airbrush', data);
            return;
        }
        
        // エアスプレーデータ蓄積
        if (!this.currentAction.airbrushData) {
            this.currentAction.airbrushData = [];
        }
        
        this.currentAction.airbrushData.push({
            x: data.x,
            y: data.y,
            pressure: data.pressure,
            settings: { ...data.settings },
            timestamp: Date.now()
        });
    }
    
    /**
     * 現在状態キャプチャ
     * PixiJS v8統一・RenderTexture・ベクターデータ保持
     */
    captureCurrentState() {
        const state = {
            timestamp: Date.now(),
            canvasSize: {
                width: this.app.screen.width,
                height: this.app.screen.height
            },
            layers: [],
            renderTexture: null,
            vectorData: new Map()
        };
        
        try {
            // レイヤー状態キャプチャ
            if (this.app.stage.children.length > 0) {
                const drawingLayers = this.findDrawingLayers();
                
                drawingLayers.forEach((layer, index) => {
                    const layerState = this.captureLayerState(layer);
                    state.layers.push(layerState);
                });
            }
            
            // 全体RenderTexture作成（PixiJS v8）
            state.renderTexture = this.createFullRenderTexture();
            
            console.log(`📸 状態キャプチャ完了 - レイヤー数: ${state.layers.length}`);
            
        } catch (error) {
            console.error('❌ 状態キャプチャエラー:', error);
            this.eventStore.emit('error-occurred', {
                type: 'state-capture',
                error: error.message
            });
        }
        
        return state;
    }
    
    /**
     * レイヤー状態キャプチャ
     * Container・ベクターデータ保持
     */
    captureLayerState(layer) {
        const layerState = {
            name: layer.name || `layer-${Date.now()}`,
            visible: layer.visible,
            alpha: layer.alpha,
            position: { x: layer.x, y: layer.y },
            scale: { x: layer.scale.x, y: layer.scale.y },
            rotation: layer.rotation,
            blendMode: layer.blendMode,
            vectorStrokes: [],
            renderTexture: null
        };
        
        // ベクターデータ保持（非破壊性保証）
        if (this.settings.vectorPreservation) {
            layer.children.forEach(child => {
                if (child.vectorData) {
                    layerState.vectorStrokes.push({
                        ...child.vectorData,
                        graphics: this.serializeGraphics(child)
                    });
                }
            });
        }
        
        // レイヤーRenderTexture作成
        if (layer.children.length > 0) {
            layerState.renderTexture = this.createLayerRenderTexture(layer);
        }
        
        return layerState;
    }
    
    /**
     * RenderTexture作成（全体）
     * PixiJS v8高速レンダリング
     */
    createFullRenderTexture() {
        try {
            const renderTexture = RenderTexture.create({
                width: this.app.screen.width,
                height: this.app.screen.height
            });
            
            this.renderer.render(this.app.stage, { renderTexture });
            
            return this.renderTextureToDataURL(renderTexture);
            
        } catch (error) {
            console.error('❌ 全体RenderTexture作成エラー:', error);
            return null;
        }
    }
    
    /**
     * レイヤーRenderTexture作成
     * 個別レイヤー状態保持
     */
    createLayerRenderTexture(layer) {
        try {
            const bounds = layer.getBounds();
            if (bounds.width <= 0 || bounds.height <= 0) {
                return null;
            }
            
            const renderTexture = RenderTexture.create({
                width: Math.ceil(bounds.width),
                height: Math.ceil(bounds.height)
            });
            
            this.renderer.render(layer, { renderTexture });
            
            return {
                dataURL: this.renderTextureToDataURL(renderTexture),
                bounds: bounds
            };
            
        } catch (error) {
            console.error('❌ レイヤーRenderTexture作成エラー:', error);
            return null;
        }
    }
    
    /**
     * RenderTexture → DataURL変換
     * Chrome API活用・効率化
     */
    renderTextureToDataURL(renderTexture) {
        try {
            // PixiJS v8 extract機能活用
            const canvas = this.renderer.extract.canvas(renderTexture);
            return canvas.toDataURL('image/png');
            
        } catch (error) {
            console.error('❌ DataURL変換エラー:', error);
            return null;
        }
    }
    
    /**
     * Graphics要素シリアライズ
     * ベクターデータ保持用
     */
    serializeGraphics(graphics) {
        // PixiJS v8 Graphics → JSON変換
        // 実装簡略化：基本プロパティのみ
        return {
            lineStyle: graphics.line,
            fillStyle: graphics.fill,
            geometry: graphics.geometry ? 'preserved' : null
        };
    }
    
    /**
     * 状態変化チェック
     * 効率的な差分検出
     */
    hasStateChanged(startState, endState) {
        if (!startState || !endState) return true;
        
        // 簡易比較（実装簡略化）
        return startState.timestamp !== endState.timestamp ||
               startState.layers.length !== endState.layers.length;
    }
    
    /**
     * 状態圧縮
     * lz-string活用・メモリ効率化
     */
    compressState(state) {
        if (!this.settings.compression) return state;