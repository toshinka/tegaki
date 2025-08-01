// 🎯 モダンお絵かきツール Phase1 統一座標基盤
// Y軸問題根絶 + Chrome API活用 + 段階的拡張対応

// 🔥 Phase1: 統一座標基盤（実装済み・動作確認済み）
import { CoordinateUnifier } from './core/CoordinateUnifier.js';
import { HybridRenderer } from './renderers/HybridRenderer.js';
import { OGLInteractionEnhancer } from './controllers/OGLInteractionEnhancer.js';
import { EventStore } from './core/EventStore.js';
import { ShortcutController } from './controllers/ShortcutController.js';
import { HistoryController } from './controllers/HistoryController.js';

// 🎨 Phase2: ツール・UI・カラー統合（Phase1完成後解封予定）
// import { ToolProcessor } from './processors/ToolProcessor.js';           // 🔒Phase2解封
// import { UIController } from './controllers/UIController.js';            // 🔒Phase2解封
// import { ColorProcessor } from './processors/ColorProcessor.js';        // 🔒Phase2解封
// import { VectorLayerProcessor } from './processors/VectorLayerProcessor.js'; // 🔒Phase2解封
// import { CanvasController } from './controllers/CanvasController.js';     // 🔒Phase2解封

// ⚡ Phase3: Chrome API活用・高度機能（Phase2完成後解封予定）
// import { OffscreenLayerProcessor } from './processors/OffscreenLayerProcessor.js'; // 🔒Phase3解封
// import { AnimationController } from './controllers/AnimationController.js';         // 🔒Phase3解封
// import { ModernFileExporter } from './exporters/ModernFileExporter.js';           // 🔒Phase3解封
// import { MeshDeformController } from './controllers/MeshDeformController.js';       // 🔒Phase3解封
// import { AnimationStore } from './stores/AnimationStore.js';            // 🔒Phase3解封
// import { ProjectStore } from './stores/ProjectStore.js';                // 🔒Phase3解封

/**
 * 🚀 モダンお絵かきツール メインアプリケーション
 * 統一座標系によるY軸問題根絶 + Chrome API活用基盤
 */
class ModernDrawingTool {
    constructor() {
        // 🔧 Phase1: 基盤システム初期化
        this.canvas = document.getElementById('drawingCanvas');
        this.eventStore = new EventStore();
        this.coordinateUnifier = new CoordinateUnifier(
            this.canvas.width, 
            this.canvas.height
        );

        // Phase1: 統一座標レンダリングシステム
        this.hybridRenderer = new HybridRenderer(
            this.canvas, 
            this.coordinateUnifier,
            this.eventStore
        );

        // Phase1: 統一入力制御システム
        this.interactionEnhancer = new OGLInteractionEnhancer(
            this.canvas,
            this.coordinateUnifier,
            this.eventStore
        );

        // Phase1: ショートカット・履歴管理
        this.shortcutController = new ShortcutController(this.eventStore);
        this.historyController = new HistoryController(this.eventStore);

        // 🎨 Phase2: ツール・UI・カラー（解封時初期化）
        // this.toolProcessor = null;           // 🔒Phase2解封
        // this.uiController = null;            // 🔒Phase2解封
        // this.colorProcessor = null;          // 🔒Phase2解封
        // this.vectorLayerProcessor = null;    // 🔒Phase2解封
        // this.canvasController = null;        // 🔒Phase2解封

        // ⚡ Phase3: Chrome API・高度機能（解封時初期化）
        // this.offscreenProcessor = null;      // 🔒Phase3解封
        // this.animationController = null;     // 🔒Phase3解封
        // this.modernExporter = null;          // 🔒Phase3解封
        // this.meshDeformController = null;    // 🔒Phase3解封
        // this.animationStore = null;          // 🔒Phase3解封
        // this.projectStore = null;            // 🔒Phase3解封

        // 初期化完了
        this.initializePhase1();
    }

    /**
     * 🔥 Phase1初期化: 統一座標基盤確立
     */
    initializePhase1() {
        console.log('🔥 Phase1初期化開始: 統一座標基盤');

        // 統一座標系検証
        this.validateCoordinateUnity();

        // イベントリスナー設定
        this.setupPhase1Events();

        // 基本UI初期化
        this.setupBasicUI();

        // デバッグ支援（開発時のみ）
        if (process.env.NODE_ENV === 'development') {
            this.enableDebugMode();
        }

        console.log('✅ Phase1初期化完了: 統一座標基盤確立');
    }

    /**
     * 📐 統一座標系検証（Phase0要素統合）
     */
    validateCoordinateUnity() {
        const testPoint = { x: 400, y: 300 }; // キャンバス中央
        
        // 座標変換チェーン検証
        const unified = this.coordinateUnifier.screenToUnified(testPoint.x, testPoint.y);
        const webgl = this.coordinateUnifier.unifiedToWebGL(unified.x, unified.y);
        const backToScreen = this.coordinateUnifier.webglToScreen(webgl.x, webgl.y);
        
        const tolerance = 0.1;
        const isValid = 
            Math.abs(testPoint.x - backToScreen.x) < tolerance &&
            Math.abs(testPoint.y - backToScreen.y) < tolerance;

        if (!isValid) {
            console.error('❌ 座標統一検証失敗:', { testPoint, backToScreen });
            throw new Error('CoordinateUnifier座標変換不整合');
        }

        console.log('✅ 座標統一検証成功:', { testPoint, unified, webgl, backToScreen });
    }

    /**
     * 🎛️ Phase1イベント設定
     */
    setupPhase1Events() {
        // 基本描画イベント
        this.eventStore.on('stroke:start', this.handleStrokeStart.bind(this));
        this.eventStore.on('stroke:move', this.handleStrokeMove.bind(this));
        this.eventStore.on('stroke:complete', this.handleStrokeComplete.bind(this));

        // ツール変更イベント
        this.eventStore.on('tool:change', this.handleToolChange.bind(this));

        // 座標変換イベント
        this.eventStore.on('coordinate:transform', this.handleCoordinateTransform.bind(this));

        // 履歴イベント
        this.eventStore.on('history:change', this.handleHistoryChange.bind(this));

        // リサイズイベント
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    /**
     * 🎨 基本UI初期化（最小限・Phase2拡張予定）
     */
    setupBasicUI() {
        // サイドバーツールアイコン生成
        this.interactionEnhancer.generateToolIcons();

        // キャンバスサイズ調整
        this.adjustCanvasSize();

        // フルスクリーンモード対応
        this.setupFullscreenMode();
    }

    /**
     * 📏 キャンバスサイズ調整（統一座標対応）
     */
    adjustCanvasSize() {
        const canvasArea = document.getElementById('canvasArea');
        const rect = canvasArea.getBoundingClientRect();
        
        // 最適サイズ計算（余白考慮）
        const maxWidth = rect.width - 40;
        const maxHeight = rect.height - 40;
        
        // アスペクト比維持リサイズ
        const aspectRatio = 4/3;
        let newWidth = Math.min(maxWidth, maxHeight * aspectRatio);
        let newHeight = newWidth / aspectRatio;
        
        if (newHeight > maxHeight) {
            newHeight = maxHeight;
            newWidth = newHeight * aspectRatio;
        }

        // キャンバス更新（座標統一システム同期）
        this.canvas.width = Math.floor(newWidth);
        this.canvas.height = Math.floor(newHeight);
        
        // 統一座標系更新
        this.coordinateUnifier.updateDimensions(this.canvas.width, this.canvas.height);
        
        // レンダラー更新
        this.hybridRenderer.updateCanvasSize(this.canvas.width, this.canvas.height);
    }

    /**
     * 🖱️ ストローク開始処理
     */
    handleStrokeStart(event) {
        const unifiedCoord = this.coordinateUnifier.screenToUnified(event.x, event.y);
        
        this.currentStroke = {
            points: [unifiedCoord],
            tool: event.tool || 'pen',
            startTime: Date.now()
        };

        // レンダラーに描画開始通知
        this.hybridRenderer.beginStroke(this.currentStroke);
    }

    /**
     * 🖱️ ストローク移動処理
     */
    handleStrokeMove(event) {
        if (!this.currentStroke) return;

        const unifiedCoord = this.coordinateUnifier.screenToUnified(event.x, event.y);
        this.currentStroke.points.push(unifiedCoord);

        // リアルタイム描画更新
        this.hybridRenderer.updateStroke(this.currentStroke);
    }

    /**
     * 🖱️ ストローク完了処理
     */
    handleStrokeComplete(event) {
        if (!this.currentStroke) return;

        // ストローク確定
        this.hybridRenderer.finalizeStroke(this.currentStroke);

        // 履歴に追加
        this.historyController.addAction({
            type: 'stroke',
            data: { ...this.currentStroke },
            timestamp: Date.now()
        });

        this.currentStroke = null;
    }

    /**
     * 🛠️ ツール変更処理
     */
    handleToolChange(event) {
        console.log('ツール変更:', event.tool);
        
        // 現在のストローク中断
        if (this.currentStroke) {
            this.handleStrokeComplete({});
        }

        // レンダラーにツール変更通知
        this.hybridRenderer.setCurrentTool(event.tool);
    }

    /**
     * 📐 座標変換処理
     */
    handleCoordinateTransform(event) {
        // パン・ズーム・回転等の座標変換
        this.coordinateUnifier.applyTransform(event.transform);
        this.hybridRenderer.updateProjectionMatrix(
            this.coordinateUnifier.getProjectionMatrix()
        );
    }

    /**
     * ⏰ 履歴変更処理
     */
    handleHistoryChange(event) {
        if (event.action === 'undo') {
            this.hybridRenderer.undoLastAction();
        } else if (event.action === 'redo') {
            this.hybridRenderer.redoLastAction();
        }
    }

    /**
     * 📏 リサイズ処理
     */
    handleResize() {
        // デバウンス処理
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            this.adjustCanvasSize();
        }, 100);
    }

    /**
     * 🖥️ フルスクリーンモード設定
     */
    setupFullscreenMode() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F11' || (e.key === 'f' && e.ctrlKey)) {
                e.preventDefault();
                this.toggleFullscreen();
            }
        });
    }

    /**
     * 🖥️ フルスクリーン切り替え
     */
    toggleFullscreen() {
        document.body.classList.toggle('fullscreen-drawing');
        
        // フルスクリーン時のキャンバスサイズ調整
        setTimeout(() => {
            this.adjustCanvasSize();
        }, 100);
    }

    /**
     * 🐛 デバッグモード有効化（Phase0要素統合）
     */
    enableDebugMode() {
        // 座標グリッド表示
        this.debugMode = true;
        
        // デバッグ用ショートカット
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F12' && e.shiftKey) {
                this.toggleCoordinateGrid();
            }
        });

        // 性能計測開始
        this.startPerformanceMonitoring();
        
        console.log('🐛 デバッグモード有効化');
    }

    /**
     * 📊 座標グリッド表示切り替え
     */
    toggleCoordinateGrid() {
        this.showCoordinateGrid = !this.showCoordinateGrid;
        this.hybridRenderer.setDebugGrid(this.showCoordinateGrid);
    }

    /**
     * 📈 性能監視開始
     */
    startPerformanceMonitoring() {
        setInterval(() => {
            const metrics = {
                fps: this.hybridRenderer.getCurrentFPS(),
                memoryUsage: performance.memory?.usedJSHeapSize || 0,
                coordinateTransforms: this.coordinateUnifier.getTransformCount()
            };
            
            if (metrics.fps < 30) {
                console.warn('⚠️ FPS低下検出:', metrics);
            }
        }, 5000);
    }

    // 🎨 Phase2初期化（解封時に有効化）
    /*
    initializePhase2() {
        console.log('🎨 Phase2初期化開始: ツール・UI・カラー統合');
        
        // ツール処理システム
        this.toolProcessor = new ToolProcessor(this.eventStore, this.coordinateUnifier);
        
        // UI制御システム
        this.uiController = new UIController(this.eventStore);
        
        // カラー処理システム
        this.colorProcessor = new ColorProcessor(this.eventStore);
        
        // ベクターレイヤー処理
        this.vectorLayerProcessor = new VectorLayerProcessor(this.eventStore, this.coordinateUnifier);
        
        // キャンバス操作制御
        this.canvasController = new CanvasController(this.canvas, this.coordinateUnifier, this.eventStore);
        
        // Phase2イベント設定
        this.setupPhase2Events();
        
        console.log('✅ Phase2初期化完了: ツール・UI・カラー統合');
    }
    */

    // ⚡ Phase3初期化（解封時に有効化）
    /*
    initializePhase3() {
        console.log('⚡ Phase3初期化開始: Chrome API活用・高度機能');
        
        // Chrome API活用システム
        this.offscreenProcessor = new OffscreenLayerProcessor(this.eventStore);
        this.animationController = new AnimationController(this.eventStore, this.coordinateUnifier);
        this.modernExporter = new ModernFileExporter(this.eventStore);
        this.meshDeformController = new MeshDeformController(this.eventStore, this.coordinateUnifier);
        
        // 状態管理システム
        this.animationStore = new AnimationStore(this.eventStore);
        this.projectStore = new ProjectStore(this.eventStore);
        
        // Phase3イベント設定
        this.setupPhase3Events();
        
        console.log('✅ Phase3初期化完了: Chrome API活用・高度機能');
    }
    */

    /**
     * 🚀 アプリケーション開始
     */
    start() {
        console.log('🚀 モダンお絵かきツール Phase1 開始');
        
        // Phase1完了確認
        if (!this.coordinateUnifier || !this.hybridRenderer) {
            throw new Error('Phase1基盤システム初期化失敗');
        }

        // 初期描画
        this.hybridRenderer.render();
        
        console.log('✅ モダンお絵かきツール Phase1 準備完了');
        
        // Phase2以降の準備状況確認
        // this.checkPhaseUpgradeReadiness();
    }

    /**
     * 🔄 Phase升级准备状況確認（将来実装）
     */
    /*
    checkPhaseUpgradeReadiness() {
        const phase1Quality = this.validatePhase1Quality();
        
        if (phase1Quality.score >= 0.9) {
            console.log('🎨 Phase2升级準備完了');
            // Phase2自動初期化可能
        }
        
        return phase1Quality;
    }
    */
}

// 🚀 アプリケーション起動
document.addEventListener('DOMContentLoaded', () => {
    try {
        const app = new ModernDrawingTool();
        app.start();
        
        // グローバル参照（デバッグ用）
        window.drawingApp = app;
        
    } catch (error) {
        console.error('❌ アプリケーション起動失敗:', error);
        
        // 緊急フォールバック（Phase0要素）
        document.body.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100vh; 
                        background: #ffffee; color: #800000; font-family: system-ui;">
                <div style="text-align: center; padding: 20px; border: 1px solid #800000; border-radius: 8px;">
                    <h2>🚨 初期化エラー</h2>
                    <p>統一座標基盤の初期化に失敗しました</p>
                    <p style="font-size: 12px; color: #666; margin-top: 10px;">
                        ${error.message}
                    </p>
                    <button onclick="location.reload()" 
                            style="margin-top: 15px; padding: 8px 16px; background: #800000; 
                                   color: white; border: none; border-radius: 4px; cursor: pointer;">
                        再読み込み
                    </button>
                </div>
            </div>
        `;
    }
});