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
// import { PixiToolProcessor } from './PixiToolProcessor.js';           // 🔒Phase2解封
// import { PixiUIController } from './PixiUIController.js';             // 🔒Phase2解封
// import { ColorProcessor } from './ColorProcessor.js';                // 🔒Phase2解封
// import { PixiLayerProcessor } from './PixiLayerProcessor.js';         // 🔒Phase2解封
// import { CanvasController } from './CanvasController.js';             // 🔒Phase2解封

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
        
        // Phase2: ツール・UI・カラー（封印中）
        // this.toolProcessor = null;        // 🔒Phase2解封
        // this.uiController = null;         // 🔒Phase2解封
        // this.colorProcessor = null;       // 🔒Phase2解封
        // this.layerProcessor = null;       // 🔒Phase2解封
        // this.canvasController = null;     // 🔒Phase2解封
        
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
            
        } catch (error) {
            console.error('❌ Phase1初期化失敗:', error);
            this.handleInitializationError(error);
        }
    }
    
    /**
     * Phase1イベント連携設定
     */
    setupPhase1Events() {
        // PixiJS統一座標変換イベント
        this.eventStore.on('coordinate:transform', (data) => {
            this.coordinateUnifier.handleTransform(data);
        });
        
        // PixiJS統一描画イベント
        this.eventStore.on('draw:start', (data) => {
            this.inputController.startDrawing(data);
        });
        
        this.eventStore.on('draw:continue', (data) => {
            this.inputController.continueDrawing(data);
        });
        
        this.eventStore.on('draw:end', (data) => {
            this.inputController.endDrawing(data);
        });
        
        // アンドゥ・リドゥイベント
        this.eventStore.on('history:undo', () => {
            this.historyController.undo();
        });
        
        this.eventStore.on('history:redo', () => {
            this.historyController.redo();
        });
        
        // リサイズイベント（PixiJS統一対応）
        window.addEventListener('resize', () => {
            this.handleResize();
        });
        
        console.log('📡 Phase1イベント連携設定完了');
    }
    
    /**
     * PixiJS統一リサイズ処理
     */
    handleResize() {
        if (this.renderer && this.coordinateUnifier) {
            this.renderer.handleResize();
            this.coordinateUnifier.updateViewport();
            this.eventStore.emit('viewport:resize', {
                width: this.canvas.width,
                height: this.canvas.height
            });
        }
    }
    
    /**
     * Phase1デバッグ情報表示
     */
    displayPhase1Info() {
        const info = {
            phase: 'Phase1: PixiJS統一基盤',
            renderer: this.renderer.getInfo(),
            coordinate: this.coordinateUnifier.getInfo(),
            input: this.inputController.getInfo(),
            events: this.eventStore.getStats(),
            performance: this.renderer.getPerformanceInfo()
        };
        
        console.log('📊 Phase1システム情報:', info);
        
        // デバッグ用UI表示（Phase1のみ）
        this.createPhase1DebugUI(info);
    }
    
    /**
     * Phase1デバッグUI作成
     */
    createPhase1DebugUI(info) {
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
            <div>📐 座標系: ${info.coordinate.system}</div>
            <div>🎨 レンダラー: ${info.renderer.type}</div>
            <div>📡 イベント: ${info.events.totalEvents}件</div>
            <div>⚡ FPS: ${info.performance.fps}</div>
            <div style="margin-top: 8px; font-size: 10px; opacity: 0.8;">
                Phase2準備完了後、ツール・UI・カラー解封
            </div>
        `;
        
        document.body.appendChild(debugPanel);
    }
    
    /**
     * Phase2解封準備チェック（将来実装用）
     */
    checkPhase2ReadyConditions() {
        // Phase1基盤動作確認
        const checks = [
            this.isInitialized,
            this.renderer && this.renderer.isReady(),
            this.coordinateUnifier && this.coordinateUnifier.isReady(),
            this.inputController && this.inputController.isReady(),
            this.eventStore && this.eventStore.isHealthy()
        ];
        
        const allReady = checks.every(check => check === true);
        
        if (allReady) {
            console.log('🎨 Phase2解封準備完了条件満足');
            // Phase2解封ログ出力（将来のClaude実装用）
            this.logPhase2UnlockInstructions();
        }
        
        return allReady;
    }
    
    /**
     * Phase2解封指示ログ出力（Claude実装支援）
     */
    logPhase2UnlockInstructions() {
        console.log(`
🎨 Phase2解封指示（次回Claude実装時）:
1. main.js: Phase2コメントアウト解除
2. Phase2ファイル群実装: PixiToolProcessor.js, PixiUIController.js等
3. Phase1連携: this.setupPhase2Integration() 呼び出し
4. Phase2イベント: setupPhase2Events() 追加
        `);
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
            <h3>🚨 Phase1初期化エラー</h3>
            <p>PixiJS統一基盤の初期化に失敗しました</p>
            <pre style="font-size: 12px; margin: 10px 0;">${error.message}</pre>
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
        if (this.pixiApp) {
            this.pixiApp.destroy(true);
        }
        
        if (this.eventStore) {
            this.eventStore.destroy();
        }
        
        console.log('🔥 モダンお絵かきツール終了');
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