/**
 * モダンお絵かきツール v3.2 メインエントリーポイント
 * PixiJS統一基盤 + Chrome API活用 + 段階的解封システム
 * 規約: 総合AIコーディング規約v4.1準拠（PixiJS統一座標対応）
 */

// 🔥 Phase1: PixiJS統一基盤（実装済み・封印済み）
import { PixiCoordinateUnifier } from './core/PixiCoordinateUnifier.js';
import { PixiUnifiedRenderer } from './PixiUnifiedRenderer.js';
import { PixiInputController } from './PixiInputController.js';
import { ShortcutController } from './ShortcutController.js';
import { HistoryController } from './HistoryController.js';
import { EventStore } from './core/EventStore.js';

// 🎨 Phase2: ツール・UI・カラー統合（Phase1完成後封印解除）
import { PixiToolProcessor } from './PixiToolProcessor.js';           // ✅Phase2解封
import { PixiUIController } from './PixiUIController.js';             // ✅Phase2解封
import { ColorProcessor } from './ColorProcessor.js';                // ✅Phase2解封
import { PixiLayerProcessor } from './PixiLayerProcessor.js';         // ✅Phase2解封
import { CanvasController } from './CanvasController.js';             // ✅Phase2解封

// ⚡ Phase3: Chrome API活用・高度機能（Phase2完成後封印解除）
// import { PixiOffscreenProcessor } from './PixiOffscreenProcessor.js'; // 🔒Phase3解封
// import { PixiAnimationController } from './PixiAnimationController.js'; // 🔒Phase3解封
// import { PixiModernExporter } from './PixiModernExporter.js';           // 🔒Phase3解封
// import { ProjectStore } from './stores/ProjectStore.js';              // 🔒Phase3解封

/**
 * モダンお絵かきツール メインアプリケーション
 * PixiJS統一基盤による干渉問題完全根絶
 */
class ModernDrawingApp {
    constructor() {
        this.canvas = null;
        this.pixiApp = null;
        this.isInitialized = false;
        this.currentPhase = 1;
        
        // Phase1: PixiJS統一基盤コンポーネント
        this.coordinateUnifier = null;
        this.renderer = null;
        this.inputController = null;
        this.shortcutController = null;
        this.historyController = null;
        this.eventStore = null;
        
        // Phase2: ツール・UI・カラー（Phase2で解封）
        this.toolProcessor = null;        // ✅Phase2解封
        this.uiController = null;         // ✅Phase2解封
        this.colorProcessor = null;       // ✅Phase2解封
        this.layerProcessor = null;       // ✅Phase2解封
        this.canvasController = null;     // ✅Phase2解封
        
        // Phase3: Chrome API活用（封印中）
        // this.offscreenProcessor = null;   // 🔒Phase3解封
        // this.animationController = null;  // 🔒Phase3解封
        // this.modernExporter = null;       // 🔒Phase3解封
        // this.projectStore = null;         // 🔒Phase3解封
        
        this.initPhase1();
    }
    
    /**
     * Phase1初期化: PixiJS統一基盤
     */
    async initPhase1() {
        try {
            console.log('🔥 Phase1初期化開始: PixiJS統一基盤');
            
            // キャンバス取得・PixiJS統一基盤構築
            this.canvas = document.getElementById('canvas');
            if (!this.canvas) {
                throw new Error('Canvas要素が見つかりません');
            }
            
            // EventStore初期化（全体基盤）
            this.eventStore = new EventStore();
            
            // PixiJS統一レンダラー初期化
            this.renderer = new PixiUnifiedRenderer(this.canvas, this.eventStore);
            await this.renderer.initialize();
            this.pixiApp = this.renderer.app;
            
            // PixiJS統一座標システム
            this.coordinateUnifier = new PixiCoordinateUnifier(this.pixiApp, this.eventStore);
            
            // 座標システムの初期化完了を待機（改良版）
            await this.waitForCoordinateUnifierReady();
            
            // PixiJS統一入力制御
            this.inputController = new PixiInputController(
                this.pixiApp, 
                this.coordinateUnifier, 
                this.eventStore
            );
            
            // キーボードショートカット制御
            this.shortcutController = new ShortcutController(this.eventStore);
            
            // アンドゥ・リドゥ履歴制御
            this.historyController = new HistoryController(this.eventStore);
            
            // Phase1イベント連携設定
            this.setupPhase1Events();
            
            // Phase1完了・Phase2準備確認
            this.isInitialized = true;
            console.log('✅ Phase1初期化完了: PixiJS統一基盤稼働開始');
            
            // Phase1デバッグ情報表示
            this.displayPhase1Info();
            
            // Phase2自動初期化
            await this.initPhase2();
            
        } catch (error) {
            console.error('❌ Phase1初期化失敗:', error);
            this.handleInitializationError(error);
        }
    }
    
    /**
     * 座標統一システム準備完了待機
     */
    async waitForCoordinateUnifierReady() {
        return new Promise((resolve) => {
            const checkReady = () => {
                // 安全な準備状態チェック
                const isReady = this.coordinateUnifier && 
                    this.coordinateUnifier.app && 
                    this.coordinateUnifier.stage &&
                    (
                        // プロパティチェック
                        (typeof this.coordinateUnifier.isReady === 'boolean' && this.coordinateUnifier.isReady) ||
                        // メソッドチェック
                        (typeof this.coordinateUnifier.isReady === 'function' && this.coordinateUnifier.isReady())
                    );
                
                if (isReady) {
                    console.log('📐 PixiJS座標統一システム準備完了');
                    resolve();
                } else {
                    setTimeout(checkReady, 10);
                }
            };
            checkReady();
        });
    }
    
    /**
     * Phase2初期化: ツール・UI・カラー統合
     */
    async initPhase2() {
        try {
            console.log('🎨 Phase2初期化開始: ツール・UI・カラー統合');
            
            // Phase1基盤の安定確認（短時間待機）
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Phase1準備確認（安全版）
            if (!this.checkPhase1ReadyConditions()) {
                throw new Error('Phase1基盤が準備不完了');
            }
            
            // Phase2コンポーネント初期化
            this.toolProcessor = new PixiToolProcessor(
                this.pixiApp, 
                this.coordinateUnifier, 
                this.eventStore
            );
            
            this.colorProcessor = new ColorProcessor(this.eventStore);
            
            this.layerProcessor = new PixiLayerProcessor(
                this.pixiApp,
                this.eventStore
            );
            
            this.canvasController = new CanvasController(
                this.canvas,
                this.pixiApp,
                this.eventStore
            );
            
            this.uiController = new PixiUIController(
                this.eventStore,
                this.toolProcessor,
                this.colorProcessor,
                this.layerProcessor
            );
            
            // Phase2イベント連携設定
            this.setupPhase2Events();
            
            // Phase2初期化完了
            this.currentPhase = 2;
            console.log('✅ Phase2初期化完了: ツール・UI・カラー統合稼働開始');
            
            // Phase2デバッグ情報表示
            this.displayPhase2Info();
            
        } catch (error) {
            console.error('❌ Phase2初期化失敗:', error);
            this.handleInitializationError(error);
        }
    }
    
    /**
     * Phase1イベント連携設定
     */
    setupPhase1Events() {
        // PixiJS統一座標変換イベント
        this.eventStore.on('coordinate:transform', (data) => {
            if (this.coordinateUnifier && typeof this.coordinateUnifier.handleTransform === 'function') {
                this.coordinateUnifier.handleTransform(data);
            }
        });
        
        // PixiJS統一描画イベント
        this.eventStore.on('draw:start', (data) => {
            if (this.inputController && typeof this.inputController.startDrawing === 'function') {
                this.inputController.startDrawing(data);
            }
        });
        
        this.eventStore.on('draw:continue', (data) => {
            if (this.inputController && typeof this.inputController.continueDrawing === 'function') {
                this.inputController.continueDrawing(data);
            }
        });
        
        this.eventStore.on('draw:end', (data) => {
            if (this.inputController && typeof this.inputController.endDrawing === 'function') {
                this.inputController.endDrawing(data);
            }
        });
        
        // アンドゥ・リドゥイベント
        this.eventStore.on('history:undo', () => {
            if (this.historyController && typeof this.historyController.undo === 'function') {
                this.historyController.undo();
            }
        });
        
        this.eventStore.on('history:redo', () => {
            if (this.historyController && typeof this.historyController.redo === 'function') {
                this.historyController.redo();
            }
        });
        
        // リサイズイベント（PixiJS統一対応）
        window.addEventListener('resize', () => {
            this.handleResize();
        });
        
        console.log('📡 Phase1イベント連携設定完了');
    }
    
    /**
     * Phase2イベント連携設定
     */
    setupPhase2Events() {
        // ツール変更イベント
        this.eventStore.on('tool:change', (toolData) => {
            if (this.toolProcessor && typeof this.toolProcessor.changeTool === 'function') {
                this.toolProcessor.changeTool(toolData);
            }
        });
        
        // カラー変更イベント
        this.eventStore.on('color:change', (colorData) => {
            if (this.colorProcessor && typeof this.colorProcessor.changeColor === 'function') {
                this.colorProcessor.changeColor(colorData);
            }
        });
        
        // レイヤー操作イベント
        this.eventStore.on('layer:add', (layerData) => {
            if (this.layerProcessor && typeof this.layerProcessor.addLayer === 'function') {
                this.layerProcessor.addLayer(layerData);
            }
        });
        
        this.eventStore.on('layer:remove', (layerId) => {
            if (this.layerProcessor && typeof this.layerProcessor.removeLayer === 'function') {
                this.layerProcessor.removeLayer(layerId);
            }
        });
        
        this.eventStore.on('layer:select', (layerId) => {
            if (this.layerProcessor && typeof this.layerProcessor.selectLayer === 'function') {
                this.layerProcessor.selectLayer(layerId);
            }
        });
        
        // キャンバス操作イベント
        this.eventStore.on('canvas:clear', () => {
            if (this.canvasController && typeof this.canvasController.clear === 'function') {
                this.canvasController.clear();
            }
        });
        
        this.eventStore.on('canvas:resize', (dimensions) => {
            if (this.canvasController && typeof this.canvasController.resize === 'function') {
                this.canvasController.resize(dimensions);
            }
        });
        
        console.log('🎨 Phase2イベント連携設定完了');
    }
    
    /**
     * PixiJS統一リサイズ処理
     */
    handleResize() {
        try {
            if (this.renderer && typeof this.renderer.handleResize === 'function') {
                this.renderer.handleResize();
            }
            if (this.coordinateUnifier && typeof this.coordinateUnifier.updateViewport === 'function') {
                this.coordinateUnifier.updateViewport();
            }
            this.eventStore.emit('viewport:resize', {
                width: this.canvas.width,
                height: this.canvas.height
            });
        } catch (error) {
            console.error('❌ リサイズ処理エラー:', error);
        }
    }
    
    /**
     * Phase1デバッグ情報表示
     */
    displayPhase1Info() {
        try {
            const info = {
                phase: 'Phase1: PixiJS統一基盤',
                renderer: this.renderer && typeof this.renderer.getInfo === 'function' ? this.renderer.getInfo() : { type: 'unknown' },
                coordinate: this.coordinateUnifier && typeof this.coordinateUnifier.getInfo === 'function' ? this.coordinateUnifier.getInfo() : { system: 'unknown' },
                input: this.inputController && typeof this.inputController.getInfo === 'function' ? this.inputController.getInfo() : { system: 'unknown' },
                events: this.eventStore && typeof this.eventStore.getStats === 'function' ? this.eventStore.getStats() : { totalEvents: 0 },
                performance: this.renderer && typeof this.renderer.getPerformanceInfo === 'function' ? this.renderer.getPerformanceInfo() : { fps: 0 }
            };
            
            console.log('📊 Phase1システム情報:', info);
            
            // デバッグ用UI表示（Phase1のみ）
            this.createPhase1DebugUI(info);
        } catch (error) {
            console.error('❌ Phase1デバッグ情報表示エラー:', error);
        }
    }
    
    /**
     * Phase2デバッグ情報表示
     */
    displayPhase2Info() {
        try {
            const info = {
                phase: 'Phase2: ツール・UI・カラー統合',
                tools: this.toolProcessor && typeof this.toolProcessor.getInfo === 'function' ? this.toolProcessor.getInfo() : { currentTool: 'unknown' },
                colors: this.colorProcessor && typeof this.colorProcessor.getInfo === 'function' ? this.colorProcessor.getInfo() : { currentColor: 'unknown' },
                layers: this.layerProcessor && typeof this.layerProcessor.getInfo === 'function' ? this.layerProcessor.getInfo() : { totalLayers: 0 },
                canvas: this.canvasController && typeof this.canvasController.getInfo === 'function' ? this.canvasController.getInfo() : { dimensions: { width: 0, height: 0 } },
                ui: this.uiController && typeof this.uiController.getInfo === 'function' ? this.uiController.getInfo() : { status: 'unknown' }
            };
            
            console.log('🎨 Phase2システム情報:', info);
            
            // Phase1デバッグUI更新
            this.updateDebugUI(info);
        } catch (error) {
            console.error('❌ Phase2デバッグ情報表示エラー:', error);
        }
    }
    
    /**
     * Phase1デバッグUI作成
     */
    createPhase1DebugUI(info) {
        try {
            const debugPanel = document.createElement('div');
            debugPanel.id = 'phase1-debug';
            debugPanel.style.cssText = `
                position: fixed; top: 10px; right: 10px; z-index: 1000;
                background: rgba(128,0,0,0.9); color: #f0e0d6;
                padding: 12px; border-radius: 8px; font-size: 12px;
                font-family: monospace; max-width: 300px;
            `;
            
            debugPanel.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 8px;">
                    🔥 ${info.phase}
                </div>
                <div>📐 座標系: ${info.coordinate.system || 'unknown'}</div>
                <div>🎨 レンダラー: ${info.renderer.type || 'unknown'}</div>
                <div>📡 イベント: ${info.events.totalEvents || 0}件</div>
                <div>⚡ FPS: ${info.performance.fps || 0}</div>
                <div style="margin-top: 8px; font-size: 10px; opacity: 0.8;">
                    Phase2準備完了: ツール・UI・カラー稼働中
                </div>
            `;
            
            document.body.appendChild(debugPanel);
        } catch (error) {
            console.error('❌ Phase1デバッグUI作成エラー:', error);
        }
    }
    
    /**
     * デバッグUI更新（Phase2情報追加）
     */
    updateDebugUI(phase2Info) {
        try {
            const debugPanel = document.getElementById('phase1-debug');
            if (debugPanel) {
                debugPanel.innerHTML += `
                    <div style="margin-top: 12px; border-top: 1px solid #f0e0d6; padding-top: 8px;">
                        <div style="font-weight: bold; color: #f0e0d6;">
                            🎨 Phase2: ツール・UI・カラー
                        </div>
                        <div>🖌️ ツール: ${phase2Info.tools.currentTool || 'unknown'}</div>
                        <div>🌈 カラー: ${phase2Info.colors.currentColor || 'unknown'}</div>
                        <div>📚 レイヤー: ${phase2Info.layers.totalLayers || 0}層</div>
                        <div>🖼️ キャンバス: ${phase2Info.canvas.dimensions.width || 0}x${phase2Info.canvas.dimensions.height || 0}</div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('❌ デバッグUI更新エラー:', error);
        }
    }
    
    /**
     * Phase1準備確認（最終安全版）
     */
    checkPhase1ReadyConditions() {
        try {
            // 基本オブジェクト存在確認
            const basicChecks = [
                this.isInitialized,
                this.eventStore !== null,
                this.renderer !== null,
                this.coordinateUnifier !== null,
                this.inputController !== null
            ];
            
            // メソッド存在・実行可能性確認
            const methodChecks = [
                // renderer
                this.renderer && (
                    (typeof this.renderer.isReady === 'function' && this.renderer.isReady()) ||
                    (typeof this.renderer.isReady === 'boolean' && this.renderer.isReady) ||
                    (this.renderer.phase1Ready === true)
                ),
                // coordinateUnifier
                this.coordinateUnifier && (
                    (typeof this.coordinateUnifier.isReady === 'function' && this.coordinateUnifier.isReady()) ||
                    (typeof this.coordinateUnifier.isReady === 'boolean' && this.coordinateUnifier.isReady)
                ),
                // inputController
                this.inputController && (
                    (typeof this.inputController.isReady === 'function' && this.inputController.isReady()) ||
                    (typeof this.inputController.isReady === 'boolean' && this.inputController.isReady) ||
                    (this.inputController.phase1Ready === true)
                ),
                // eventStore
                this.eventStore && (
                    (typeof this.eventStore.isHealthy === 'function' && this.eventStore.isHealthy()) ||
                    (typeof this.eventStore.isHealthy === 'boolean' && this.eventStore.isHealthy)
                )
            ];
            
            const allBasicReady = basicChecks.every(check => check === true);
            const allMethodsReady = methodChecks.every(check => check === true);
            const allReady = allBasicReady && allMethodsReady;
            
            if (allReady) {
                console.log('🎨 Phase1基盤準備完了: Phase2解封可能');
            } else {
                console.warn('⚠️ Phase1基盤準備未完了:', {
                    basicChecks: basicChecks,
                    methodChecks: methodChecks,
                    renderer: this.renderer ? {
                        isReadyMethod: typeof this.renderer.isReady === 'function',
                        isReadyProp: typeof this.renderer.isReady === 'boolean',
                        phase1Ready: this.renderer.phase1Ready
                    } : null,
                    coordinateUnifier: this.coordinateUnifier ? {
                        isReadyMethod: typeof this.coordinateUnifier.isReady === 'function',
                        isReadyProp: typeof this.coordinateUnifier.isReady === 'boolean'
                    } : null
                });
            }
            
            return allReady;
            
        } catch (error) {
            console.error('❌ Phase1準備確認エラー:', error);
            return false;
        }
    }
    
    /**
     * 初期化エラーハンドリング
     */
    handleInitializationError(error) {
        console.error('💥 モダンお絵かきツール初期化エラー:', error);
        
        // エラー表示UI
        const errorPanel = document.createElement('div');
        errorPanel.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: #800000; color: #f0e0d6; padding: 20px;
            border-radius: 12px; font-family: Arial; text-align: center;
            z-index: 9999; box-shadow: 0 8px 32px rgba(0,0,0,0.8);
        `;
        
        errorPanel.innerHTML = `
            <h3>🚨 初期化エラー</h3>
            <p>モダンお絵かきツールの初期化に失敗しました</p>
            <pre style="font-size: 12px; margin: 10px 0; text-align: left;">${error.message}</pre>
            <button onclick="location.reload()" 
                style="background: #f0e0d6; color: #800000; border: none; 
                       padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                再読み込み
            </button>
        `;
        
        document.body.appendChild(errorPanel);
    }
    
    /**
     * アプリケーション終了処理
     */
    destroy() {
        try {
            if (this.pixiApp) {
                this.pixiApp.destroy(true);
            }
            
            if (this.eventStore && typeof this.eventStore.destroy === 'function') {
                this.eventStore.destroy();
            }
            
            console.log('🔥 モダンお絵かきツール終了');
        } catch (error) {
            console.error('❌ アプリケーション終了エラー:', error);
        }
    }
}

// アプリケーション起動
document.addEventListener('DOMContentLoaded', () => {
    window.modernDrawingApp = new ModernDrawingApp();
});

// ページ終了時のクリーンアップ
window.addEventListener('beforeunload', () => {
    if (window.modernDrawingApp) {
        window.modernDrawingApp.destroy();
    }
});

export default ModernDrawingApp;