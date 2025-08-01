// main.js - Phase1-4完全統合版（OGL統一エンジン + EventStore基盤 + 全機能統合）

// 🔥 Phase1: OGL統一基盤（基盤システム）
import { EventStore } from './EventStore.js';
import { OGLDrawingCore } from './OGLDrawingCore.js';
import { OGLInputController } from './OGLInputController.js';
import { ShortcutController } from './ShortcutController.js';
import { HistoryController } from './HistoryController.js';

// 🎨 Phase2: ツール・UI・カラー統合
import { ToolProcessor } from './ToolProcessor.js';
import { UIController } from './UIController.js';
import { ColorProcessor } from './ColorProcessor.js';
import { LayerProcessor } from './LayerProcessor.js';
import { CanvasController } from './CanvasController.js';

// ⚡ Phase3-4: 高度機能・アニメーション・ファイル操作
import { AdvancedToolProcessor } from './AdvancedToolProcessor.js';
import { AnimationController } from './AnimationController.js';
import { FileController } from './FileController.js';
import { MeshDeformController } from './MeshDeformController.js';

// 🏪 状態管理ストア
import { LayerStore } from './stores/LayerStore.js';
import { CanvasStore } from './stores/CanvasStore.js';
import { AnimationStore } from './stores/AnimationStore.js';
import { ProjectStore } from './stores/ProjectStore.js';

/**
 * 🎯 モダンお絵かきツール統合アプリケーション
 * Phase1-4完全統合・OGL統一エンジン・EventStore基盤・Adobe Fresco風UI
 */
class DrawingApp {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        
        // 🔥 Phase1: 基盤システム初期化
        this.eventStore = new EventStore();
        this.oglCore = new OGLDrawingCore(this.canvas, this.eventStore);
        this.inputController = new OGLInputController(this.oglCore, this.eventStore);
        this.shortcuts = new ShortcutController(this.oglCore, this.inputController, this.eventStore);
        this.history = new HistoryController(this.oglCore, this.eventStore);
        
        // 🎨 Phase2: ツール・UI・カラー システム
        this.toolProcessor = new ToolProcessor(this.oglCore, this.eventStore);
        this.uiController = new UIController(this.eventStore);
        this.colorProcessor = new ColorProcessor(this.oglCore, this.eventStore);
        
        // 🏪 状態管理ストア初期化
        this.layerStore = new LayerStore();
        this.canvasStore = new CanvasStore();
        this.animationStore = new AnimationStore();
        this.projectStore = new ProjectStore();
        
        // 🌈 Phase2続き: レイヤー・キャンバス システム
        this.layerProcessor = new LayerProcessor(this.oglCore, this.eventStore, this.layerStore);
        this.canvasController = new CanvasController(this.oglCore, this.inputController, this.eventStore, this.canvasStore);
        
        // ⚡ Phase3-4: 高度機能システム
        this.advancedToolProcessor = new AdvancedToolProcessor(this.oglCore, this.eventStore);
        this.meshDeformController = new MeshDeformController(this.oglCore, this.eventStore);
        this.animationController = new AnimationController(this.eventStore, this.animationStore);
        this.fileController = new FileController(this.projectStore, this.eventStore);
        
        // アプリケーション状態
        this.isInitialized = false;
        this.currentPhase = 'loading';
        this.debugMode = process.env.NODE_ENV === 'development';
        
        // 初期化フロー開始
        this.initializeApplication();
    }
    
    // 🚀 アプリケーション初期化（段階的初期化）
    async initializeApplication() {
        try {
            console.log('🚀 Drawing Application initialization started...');
            
            // Phase1: 基盤システム初期化
            await this.initializePhase1();
            
            // Phase2: ツール・UI システム初期化
            await this.initializePhase2();
            
            // Phase3-4: 高度機能システム初期化
            await this.initializePhase3();
            
            // 全システム連携設定
            this.setupSystemIntegration();
            
            // アプリケーション起動完了
            this.finalizationInitialization();
            
        } catch (error) {
            console.error('🚨 Application initialization failed:', error);
            this.handleInitializationError(error);
        }
    }
    
    // 🔥 Phase1: 基盤システム初期化
    async initializePhase1() {
        console.log('🔥 Phase1: OGL統一基盤初期化開始...');
        
        // EventStore基盤初期化
        this.eventStore.emit(this.eventStore.eventTypes.ENGINE_READY, {
            phase: 'phase1_start'
        });
        
        // OGL描画エンジン初期化
        await this.oglCore.initialize();
        
        // 入力制御初期化
        this.inputController.setupEventListeners();
        
        // ショートカット初期化
        this.shortcuts.setupEventSubscriptions();
        
        // 履歴管理初期化
        this.history.initialize();
        
        console.log('✅ Phase1: OGL統一基盤初期化完了');
        this.currentPhase = 'phase1';
    }
    
    // 🎨 Phase2: ツール・UI システム初期化
    async initializePhase2() {
        console.log('🎨 Phase2: ツール・UI・カラー システム初期化開始...');
        
        // ツール処理システム初期化
        this.toolProcessor.setupEventSubscriptions();
        
        // Adobe Fresco風UI初期化
        this.uiController.initializeUI();
        
        // ふたば☆ちゃんねる色システム初期化
        this.colorProcessor.initializeFutabaColors();
        
        // レイヤー処理システム初期化
        this.layerProcessor.createInitialLayer();
        
        // キャンバス制御システム初期化
        this.canvasController.setupCanvasOperations();
        
        console.log('✅ Phase2: ツール・UI・カラー システム初期化完了');
        this.currentPhase = 'phase2';
    }
    
    // ⚡ Phase3-4: 高度機能システム初期化
    async initializePhase3() {
        console.log('⚡ Phase3-4: 高度機能・アニメーション システム初期化開始...');
        
        // 高度ツール初期化
        this.advancedToolProcessor.initializeAdvancedTools();
        
        // LIVE2D風メッシュ変形初期化
        this.meshDeformController.initializeMeshDeform();
        
        // Storyboarder風アニメーション初期化
        this.animationController.initializeAnimationSystem();
        
        // ファイル操作システム初期化
        this.fileController.setupFileOperations();
        
        console.log('✅ Phase3-4: 高度機能・アニメーション システム初期化完了');
        this.currentPhase = 'phase3-4';
    }
    
    // 🔗 全システム連携設定
    setupSystemIntegration() {
        console.log('🔗 システム間連携設定開始...');
        
        // ツール切り替えとUI連携
        this.eventStore.on(this.eventStore.eventTypes.TOOL_CHANGE, (data) => {
            const tool = data.payload.tool;
            this.oglCore.setTool(tool);
            this.toolProcessor.switchTool(tool);
            this.uiController.updateActiveToolButton(tool);
        });
        
        // 描画イベントと履歴管理連携
        this.eventStore.on(this.eventStore.eventTypes.STROKE_COMPLETE, (data) => {
            this.history.recordAction({
                type: 'stroke',
                strokeId: data.payload.strokeId,
                tool: data.payload.tool
            });
        });
        
        // 色変更とツール設定連携
        this.eventStore.on(this.eventStore.eventTypes.COLOR_CHANGE, (data) => {
            const color = data.payload.color;
            this.oglCore.updateToolConfig('pen', { color });
            this.toolProcessor.updateToolConfig('pen', { color });
        });
        
        // キャンバス変換と表示連携
        this.eventStore.on(this.eventStore.eventTypes.CANVAS_TRANSFORM, (data) => {
            const transform = data.payload.transform;
            this.canvasController.applyTransform(transform);
        });
        
        // レイヤー操作とUI連携
        this.eventStore.on(this.eventStore.eventTypes.LAYER_SELECT, (data) => {
            this.layerProcessor.selectLayer(data.payload.layerId);
        });
        
        // アニメーション状態とUI連携
        this.eventStore.on(this.eventStore.eventTypes.ANIMATION_START, (data) => {
            this.animationController.startAnimation(data.payload);
        });
        
        // ファイル操作と状態管理連携
        this.eventStore.on(this.eventStore.eventTypes.FILE_SAVE, (data) => {
            this.fileController.saveProject(data.payload);
        });
        
        console.log('✅ システム間連携設定完了');
    }
    
    // 🎯 初期化完了処理
    finalizationInitialization() {
        this.isInitialized = true;
        this.currentPhase = 'ready';
        
        // 初期状態設定
        this.setInitialState();
        
        // パフォーマンス監視開始
        this.startPerformanceMonitoring();
        
        // デバッグ情報設定
        if (this.debugMode) {
            this.setupDebugInterface();
        }
        
        // 初期化完了通知
        this.eventStore.emit(this.eventStore.eventTypes.ENGINE_READY, {
            phase: 'complete',
            timestamp: Date.now()
        });
        
        // UI通知表示
        this.uiController.showNotification('モダンお絵かきツール起動完了！', 'success');
        
        console.log('🎉 Drawing Application initialization completed successfully!');
        console.log(`📊 Current state: ${this.currentPhase}`);
        console.log(`🎨 Available tools: ${this.toolProcessor.getAllTools().length}`);
        console.log(`🎬 Animation ready: ${this.animationController.isReady()}`);
    }
    
    // 初期状態設定
    setInitialState() {
        // デフォルトツール設定
        this.toolProcessor.switchTool('pen');
        
        // ふたば☆ちゃんねる色設定
        this.colorProcessor.setDefaultFutabaColor();
        
        // 初期レイヤー表示
        this.layerProcessor.showLayerPanel();
        
        // キャンバス初期表示設定
        this.canvasController.resetToDefaultView();
        
        // ショートカットヒント表示
        this.shortcuts.showHint('Tab: UI切り替え | P: ペン | E: 消しゴム | F: フルスクリーン', 5000);
    }
    
    // エラーハンドリング
    handleInitializationError(error) {
        console.error('🚨 Critical initialization error:', error);
        
        // エラー状態表示
        const errorMessage = document.createElement('div');
        errorMessage.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #dc143c;
            color: white;
            padding: 20px;
            border-radius: 8px;
            font-family: monospace;
            z-index: 9999;
            text-align: center;
        `;
        errorMessage.innerHTML = `
            <h3>🚨 初期化エラー</h3>
            <p>アプリケーションの初期化に失敗しました</p>
            <p><small>${error.message}</small></p>
            <button onclick="location.reload()" style="margin-top: 10px; padding: 5px 10px;">再読み込み</button>
        `;
        
        document.body.appendChild(errorMessage);
        
        // エラーイベント発火
        this.eventStore?.emit(this.eventStore.eventTypes.ENGINE_ERROR, {
            error,
            phase: this.currentPhase,
            fatal: true
        });
    }
    
    // パフォーマンス監視開始
    startPerformanceMonitoring() {
        if (!this.debugMode) return;
        
        setInterval(() => {
            const perfInfo = {
                memory: performance.memory ? {
                    used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                    total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024)
                } : null,
                oglFrames: this.oglCore.frameCount,
                activeStrokes: this.oglCore.strokes.length,
                eventHistory: this.eventStore.getHistory().length,
                historySize: this.history.getHistoryStats().totalActions
            };
            
            // パフォーマンス情報をデバッグコンソールに出力
            if (perfInfo.memory && perfInfo.memory.used > 100) {
                console.warn('⚠️ High memory usage:', perfInfo.memory.used, 'MB');
            }
            
        }, 10000); // 10秒ごとに監視
    }
    
    // デバッグインターフェース設定
    setupDebugInterface() {
        // グローバルデバッグオブジェクト作成
        window.DrawingAppDebug = {
            app: this,
            phase: () => this.currentPhase,
            stats: () => this.getDebugStats(),
            eventStore: () => this.eventStore.debug(),
            oglCore: () => this.oglCore.getDebugInfo(),
            inputController: () => this.inputController.getDebugInfo(),
            toolProcessor: () => this.toolProcessor.getDebugInfo(),
            history: () => this.history.getDebugInfo(),
            
            // デバッグ操作
            resetApp: () => {
                if (confirm('アプリケーションをリセットしますか？')) {
                    this.resetApplication();
                }
            },
            exportState: () => {
                return JSON.stringify(this.exportApplicationState(), null, 2);
            },
            testAllTools: () => {
                this.testAllTools();
            }
        };
        
        console.log('🔧 Debug interface ready: window.DrawingAppDebug');
    }
    
    // デバッグ統計取得
    getDebugStats() {
        return {
            phase: this.currentPhase,
            initialized: this.isInitialized,
            systems: {
                oglCore: !!this.oglCore,
                inputController: !!this.inputController,
                toolProcessor: !!this.toolProcessor,
                uiController: !!this.uiController,
                colorProcessor: !!this.colorProcessor,
                layerProcessor: !!this.layerProcessor,
                canvasController: !!this.canvasController,
                animationController: !!this.animationController,
                fileController: !!this.fileController
            },
            counts: {
                tools: this.toolProcessor?.getAllTools().length || 0,
                strokes: this.oglCore?.strokes.length || 0,
                layers: this.layerStore?.getLayers().length || 0,
                history: this.history?.getHistoryStats().totalActions || 0,
                events: this.eventStore?.getHistory().length || 0
            }
        };
    }
    
    // アプリケーション状態エクスポート
    exportApplicationState() {
        return {
            version: '2.1.0',
            timestamp: Date.now(),
            phase: this.currentPhase,
            canvas: {
                width: this.canvas.width,
                height: this.canvas.height
            },
            tools: this.toolProcessor?.getDebugInfo(),
            layers: this.layerStore?.exportState(),
            animation: this.animationStore?.exportState(),
            project: this.projectStore?.exportState()
        };
    }
    
    // 全ツールテスト
    testAllTools() {
        const tools = this.toolProcessor.getAllTools();
        let currentIndex = 0;
        
        const testNextTool = () => {
            if (currentIndex >= tools.length) {
                console.log('✅ All tools tested successfully');
                return;
            }
            
            const tool = tools[currentIndex];
            console.log(`🧪 Testing tool: ${tool.name}`);
            
            this.toolProcessor.switchTool(tool.name);
            
            setTimeout(() => {
                currentIndex++;
                testNextTool();
            }, 1000);
        };
        
        testNextTool();
    }
    
    // アプリケーションリセット
    resetApplication() {
        try {
            // 全システム停止
            this.destroy();
            
            // ページリロード
            setTimeout(() => {
                location.reload();
            }, 100);
            
        } catch (error) {
            console.error('🚨 Reset failed:', error);
            location.reload();
        }
    }
    
    // アプリケーションクリーンアップ
    destroy() {
        console.log('🧹 Application cleanup started...');
        
        // 各システムのクリーンアップ
        this.shortcuts?.destroy();
        this.history?.destroy();
        this.toolProcessor?.destroy();
        this.uiController?.destroy();
        this.colorProcessor?.destroy();
        this.layerProcessor?.destroy();
        this.canvasController?.destroy();
        this.advancedToolProcessor?.destroy();
        this.animationController?.destroy();
        this.fileController?.destroy();
        this.meshDeformController?.destroy();
        
        // 入力制御停止
        this.inputController?.destroy();
        
        // EventStore クリーンアップ
        this.eventStore?.clear();
        
        // OGL エンジン停止
        // this.oglCore?.destroy(); // OGL には destroy メソッドがないため省略
        
        console.log('✅ Application cleanup completed');
    }
}

// 🎯 アプリケーション起動処理
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOM loaded, starting Drawing Application...');
    
    try {
        const canvas = document.getElementById('drawingCanvas');
        if (!canvas) {
            throw new Error('Drawing canvas element not found');
        }
        
        // アプリケーション作成・初期化
        const app = new DrawingApp(canvas);
        
        // グローバル参照設定（デバッグ用）
        window.drawingApp = app;
        
        console.log('✅ Drawing Application startup completed');
        
    } catch (error) {
        console.error('🚨 Application startup failed:', error);
        
        // エラー表示
        document.body.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100vh; flex-direction: column; font-family: system-ui;">
                <h2 style="color: #dc143c;">🚨 起動エラー</h2>
                <p>アプリケーションの起動に失敗しました</p>
                <p><code>${error.message}</code></p>
                <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; font-size: 14px;">再読み込み</button>
            </div>
        `;
    }
});

// 🔧 開発者用ヘルパー関数
if (process.env.NODE_ENV === 'development') {
    // ホットリロード対応
    if (module.hot) {
        module.hot.accept(() => {
            console.log('🔄 Hot reload detected, restarting application...');
            if (window.drawingApp) {
                window.drawingApp.destroy();
            }
            location.reload();
        });
    }
    
    // 開発者用グローバル関数
    window.devHelpers = {
        resetApp: () => window.drawingApp?.resetApplication(),
        getStats: () => window.drawingApp?.getDebugStats(),
        exportState: () => window.drawingApp?.exportApplicationState(),
        testPerf: () => {
            console.time('Performance Test');
            for (let i = 0; i < 1000; i++) {
                window.drawingApp?.eventStore.emit('test:event', { index: i });
            }
            console.timeEnd('Performance Test');
        }
    };
    
    console.log('🔧 Development helpers ready: window.devHelpers');
}