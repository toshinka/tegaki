/**
 * モダンお絵かきツール v3.2 メインエントリーポイント
 * PixiJS統一基盤 + Chrome API活用 + 段階的解封システム
 * 規約: 総合AIコーディング規約v4.1準拠（PixiJS統一座標対応）
 */

// 🔥 Phase1: PixiJS統一基盤（実装済み・稼働中）
import { PixiCoordinateUnifier } from './core/PixiCoordinateUnifier.js';
import { PixiUnifiedRenderer } from './PixiUnifiedRenderer.js';
import { PixiInputController } from './PixiInputController.js';
import { ShortcutController } from './ShortcutController.js';
import { HistoryController } from './HistoryController.js';
import { EventStore } from './core/EventStore.js';

// 🎨 Phase2: ツール・UI・カラー統合（Phase1完成後解封）
import { PixiToolProcessor } from './PixiToolProcessor.js';           // ✅解封済み
import { PixiUIController } from './PixiUIController.js';             // ✅解封済み
import { ColorProcessor } from './ColorProcessor.js';                // ✅解封済み
import { PixiLayerProcessor } from './PixiLayerProcessor.js';         // ✅解封済み
import { CanvasController } from './CanvasController.js';             // ✅解封済み

// ⚡ Phase3: Chrome API活用・高度機能（Phase2完成後封印解除）
// import { PixiOffscreenProcessor } from './PixiOffscreenProcessor.js'; // 🔒Phase3解封待ち
// import { PixiAnimationController } from './PixiAnimationController.js'; // 🔒Phase3解封待ち
// import { PixiModernExporter } from './PixiModernExporter.js';           // 🔒Phase3解封待ち
// import { ProjectStore } from './stores/ProjectStore.js';              // 🔒Phase3解封待ち

/**
 * モダンお絵かきツール メインアプリケーション
 * PixiJS統一基盤による干渉問題完全根絶 + Phase2機能統合
 */
class ModernDrawingApp {
    constructor() {
        this.canvas = null;
        this.pixiApp = null;
        this.isInitialized = false;
        this.currentPhase = 2; // Phase2に移行
        
        // Phase1: PixiJS統一基盤コンポーネント
        this.coordinateUnifier = null;
        this.renderer = null;
        this.inputController = null;
        this.shortcutController = null;
        this.historyController = null;
        this.eventStore = null;
        
        // Phase2: ツール・UI・カラー（解封済み）
        this.toolProcessor = null;        // ✅Phase2解封
        this.uiController = null;         // ✅Phase2解封
        this.colorProcessor = null;       // ✅Phase2解封
        this.layerProcessor = null;       // ✅Phase2解封
        this.canvasController = null;     // ✅Phase2解封
        
        // Phase3: Chrome API活用（封印中）
        // this.offscreenProcessor = null;   // 🔒Phase3解封待ち
        // this.animationController = null;  // 🔒Phase3解封待ち
        // this.modernExporter = null;       // 🔒Phase3解封待ち
        // this.projectStore = null;         // 🔒Phase3解封待ち
        
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
            
            // Phase2自動開始
            await this.initPhase2();
            
        } catch (error) {
            console.error('❌ Phase1初期化失敗:', error);
            this.handleInitializationError(error);
        }
    }
    
    /**
     * Phase2初期化: ツール・UI・カラー統合
     */
    async initPhase2() {
        try {
            console.log('🎨 Phase2初期化開始: ツール・UI・カラー統合');
            
            // Phase1基盤動作確認
            if (!this.checkPhase1ReadyConditions()) {
                throw new Error('Phase1基盤が未完了です');
            }
            
            // カラープロセッサー初期化
            this.colorProcessor = new ColorProcessor(
                this.pixiApp, 
                this.coordinateUnifier, 
                this.eventStore
            );
            
            // レイヤープロセッサー初期化
            this.layerProcessor = new PixiLayerProcessor(
                this.pixiApp, 
                this.coordinateUnifier, 
                this.eventStore
            );
            
            // ツールプロセッサー初期化
            this.toolProcessor = new PixiToolProcessor(
                this.pixiApp, 
                this.coordinateUnifier, 
                this.eventStore
            );
            
            // キャンバスコントローラー初期化
            this.canvasController = new CanvasController(
                this.pixiApp, 
                this.coordinateUnifier, 
                this.eventStore
            );
            
            // UIコントローラー初期化（最後に実行）
            this.uiController = new PixiUIController(
                this.pixiApp, 
                this.coordinateUnifier, 
                this.eventStore
            );
            
            // Phase2統合イベント設定
            this.setupPhase2Integration();
            
            // Phase2イベント連携設定
            this.setupPhase2Events();
            
            this.currentPhase = 2;
            console.log('✅ Phase2初期化完了: ツール・UI・カラー統合稼働開始');
            
            // Phase2デバッグ情報表示
            this.displayPhase2Info();
            
            // Phase3準備確認
            this.checkPhase3ReadyConditions();
            
        } catch (error) {
            console.error('❌ Phase2初期化失敗:', error);
            this.handlePhase2Error(error);
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
     * Phase2統合設定
     */
    setupPhase2Integration() {
        // ツールプロセッサーとレイヤープロセッサー連携
        this.eventStore.on('tool:drawing:ended', (data) => {
            if (data.strokeData && this.layerProcessor) {
                const activeLayer = this.layerProcessor.getActiveLayer();
                if (activeLayer) {
                    this.layerProcessor.addStroke(
                        activeLayer.id,
                        data.strokeData.path,
                        data.strokeData.config
                    );
                }
            }
        });
        
        // カラープロセッサーとツールプロセッサー連携
        this.eventStore.on('color:changed', (data) => {
            if (this.toolProcessor) {
                this.toolProcessor.updateToolConfig(
                    this.toolProcessor.currentTool,
                    { color: data.pixiColor }
                );
            }
        });
        
        // UIコントローラーとツールプロセッサー連携
        this.eventStore.on('tool:change', (data) => {
            if (this.toolProcessor) {
                this.toolProcessor.changeTool(data.tool, data.config);
            }
        });
        
        // レイヤープロセッサーとUIコントローラー連携
        this.eventStore.on('layer:created', (data) => {
            if (this.uiController) {
                this.uiController.updateLayerUI([data.layer]);
            }
        });
        
        // キャンバスコントローラーとその他連携
        this.eventStore.on('canvas:zoomed', (data) => {
            if (this.uiController) {
                this.uiController.adjustLayout();
            }
        });
        
        console.log('🔗 Phase2統合設定完了');
    }
    
    /**
     * Phase2イベント連携設定
     */
    setupPhase2Events() {
        // ツール操作イベント
        this.eventStore.on('ui:tool:select', (data) => {
            if (this.toolProcessor) {
                this.toolProcessor.changeTool(data.tool);
            }
        });
        
        // カラー操作イベント
        this.eventStore.on('ui:color:select', (data) => {
            if (this.colorProcessor) {
                this.colorProcessor.selectColor(data.color, 'ui');
            }
        });
        
        // レイヤー操作イベント
        this.eventStore.on('ui:layer:create', () => {
            if (this.layerProcessor) {
                this.layerProcessor.createLayer();
            }
        });
        
        this.eventStore.on('ui:layer:delete', (data) => {
            if (this.layerProcessor) {
                this.layerProcessor.deleteLayer(data.layerId);
            }
        });
        
        // キャンバス操作イベント
        this.eventStore.on('ui:canvas:zoom', (data) => {
            if (this.canvasController) {
                this.canvasController.zoomTo(data.zoom, data.center);
            }
        });
        
        this.eventStore.on('ui:canvas:pan', (data) => {
            if (this.canvasController) {
                this.canvasController.panTo(data.x, data.y);
            }
        });
        
        // ショートカットイベント（Phase2拡張）
        this.eventStore.on('shortcut:tool:pen', () => {
            if (this.toolProcessor) {
                this.toolProcessor.changeTool('pen');
            }
        });
        
        this.eventStore.on('shortcut:tool:eraser', () => {
            if (this.toolProcessor) {
                this.toolProcessor.changeTool('eraser');
            }
        });
        
        this.eventStore.on('shortcut:layer:new', () => {
            if (this.layerProcessor) {
                this.layerProcessor.createLayer();
            }
        });
        
        this.eventStore.on('shortcut:canvas:zoomReset', () => {
            if (this.canvasController) {
                this.canvasController.zoomReset();
            }
        });
        
        console.log('📡 Phase2イベント連携設定完了');
    }
    
    /**
     * PixiJS統一リサイズ処理（Phase2対応）
     */
    handleResize() {
        if (this.renderer && this.coordinateUnifier) {
            this.renderer.handleResize();
            this.coordinateUnifier.updateViewport();
            
            // Phase2コンポーネントにリサイズ通知
            if (this.canvasController) {
                this.canvasController.handleWindowResize();
            }
            
            if (this.uiController) {
                this.uiController.handleResize(this.canvas.width, this.canvas.height);
            }
            
            this.eventStore.emit('viewport:resize', {
                width: this.canvas.width,
                height: this.canvas.height
            });
        }
    }
    
    /**
     * Phase2デバッグ情報表示
     */
    displayPhase2Info() {
        const info = {
            phase: 'Phase2: ツール・UI・カラー統合',
            renderer: this.renderer.getInfo(),
            coordinate: this.coordinateUnifier.getInfo(),
            input: this.inputController.getInfo(),
            tools: this.toolProcessor.getToolInfo(),
            colors: this.colorProcessor.getColorInfo(),
            layers: this.layerProcessor.getLayerStats(),
            canvas: this.canvasController.getCanvasInfo(),
            ui: this.uiController.getUIInfo(),
            events: this.eventStore.getStats(),
            performance: this.getPhase2PerformanceInfo()
        };
        
        console.log('📊 Phase2システム情報:', info);
        
        // デバッグ用UI更新
        this.updateDebugUI(info);
    }
    
    /**
     * Phase2パフォーマンス情報取得
     */
    getPhase2PerformanceInfo() {
        return {
            renderer: this.renderer.getPerformanceInfo(),
            tools: this.toolProcessor.getPerformanceInfo(),
            colors: this.colorProcessor.getPerformanceInfo(),
            memoryUsage: this.estimatePhase2MemoryUsage(),
            fps: this.pixiApp.ticker.FPS
        };
    }
    
    /**
     * Phase2メモリ使用量推定
     */
    estimatePhase2MemoryUsage() {
        let totalMB = 0;
        
        // ツールメモリ
        if (this.toolProcessor) {
            const toolMem = this.toolProcessor.getPerformanceInfo();
            totalMB += toolMem.memoryUsage?.estimatedMB || 0;
        }
        
        // カラーメモリ
        if (this.colorProcessor) {
            const colorMem = this.colorProcessor.getPerformanceInfo();
            totalMB += (colorMem.colorCacheSize * 0.001) || 0;
        }
        
        // レイヤーメモリ
        if (this.layerProcessor) {
            const layerStats = this.layerProcessor.getLayerStats();
            totalMB += (layerStats.totalStrokes * 0.002) || 0;
        }
        
        return Math.round(totalMB * 100) / 100;
    }
    
    /**
     * デバッグUI更新
     */
    updateDebugUI(info) {
        let debugPanel = document.getElementById('phase2-debug');
        
        if (!debugPanel) {
            // 新規作成
            debugPanel = document.createElement('div');
            debugPanel.id = 'phase2-debug';
            debugPanel.style.cssText = `
                position: fixed; top: 10px; right: 10px; z-index: 1000;
                background: rgba(128,0,0,0.9); color: #f0e0d6;
                padding: 12px; border-radius: 8px; font-size: 12px;
                font-family: monospace; max-width: 320px;
            `;
            document.body.appendChild(debugPanel);
        } else {
            // Phase1パネルを削除
            const phase1Panel = document.getElementById('phase1-debug');
            if (phase1Panel) {
                phase1Panel.remove();
            }
        }
        
        debugPanel.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px;">
                🎨 ${info.phase}
            </div>
            <div>📐 座標系: ${info.coordinate.system}</div>
            <div>🎨 レンダラー: ${info.renderer.type}</div>
            <div>🔧 ツール: ${info.tools.currentTool} (${info.tools.isDrawing ? '描画中' : '待機中'})</div>
            <div>🌈 カラー: ${info.colors.currentColor.hex}</div>
            <div>📚 レイヤー: ${info.layers.totalLayers}層 (${info.layers.totalStrokes}ストローク)</div>
            <div>🎥 キャンバス: ${info.canvas.zoom}% | ${info.canvas.position.x.toFixed(0)},${info.canvas.position.y.toFixed(0)}</div>
            <div>🖥️ UI: ${info.ui.uiElements.length}要素 (${info.ui.activePopups}ポップアップ)</div>
            <div>📡 イベント: ${info.events.totalEvents}件</div>
            <div>⚡ FPS: ${info.performance.fps.toFixed(1)}</div>
            <div>💾 メモリ: ${info.performance.memoryUsage}MB</div>
            <div style="margin-top: 8px; font-size: 10px; opacity: 0.8;">
                Phase3準備完了後、Chrome API・高度機能解封
            </div>
        `;
    }
    
    /**
     * Phase1準備完了条件チェック
     */
    checkPhase1ReadyConditions() {
        const checks = [
            this.isInitialized,
            this.renderer && this.renderer.isReady(),
            this.coordinateUnifier && this.coordinateUnifier.isReady(),
            this.inputController && this.inputController.isReady(),
            this.eventStore && this.eventStore.isHealthy()
        ];
        
        const allReady = checks.every(check => check === true);
        
        if (allReady) {
            console.log('✅ Phase1準備完了条件満足');
        } else {
            console.warn('⚠️ Phase1準備未完了:', checks);
        }
        
        return allReady;
    }
    
    /**
     * Phase3準備完了条件チェック
     */
    checkPhase3ReadyConditions() {
        const checks = [
            this.checkPhase1ReadyConditions(),
            this.toolProcessor && this.toolProcessor.getToolInfo(),
            this.colorProcessor && this.colorProcessor.getColorInfo(),
            this.layerProcessor && this.layerProcessor.isReady(),
            this.canvasController && this.canvasController.isReady(),
            this.uiController && this.uiController.getUIInfo().initialized
        ];
        
        const allReady = checks.every(check => !!check);
        
        if (allReady) {
            console.log('🚀 Phase3準備完了条件満足');
            this.logPhase3UnlockInstructions();
        } else {
            console.log('⚠️ Phase3準備条件未満足');
        }
        
        return allReady;
    }
    
    /**
     * Phase3解封指示ログ出力（Claude実装支援）
     */
    logPhase3UnlockInstructions() {
        console.log(`
⚡ Phase3解封指示（次回Claude実装時）:
1. main.js: Phase3コメントアウト解除
2. Phase3ファイル群実装: PixiOffscreenProcessor.js, PixiAnimationController.js等
3. Phase2連携: this.setupPhase3Integration() 呼び出し
4. Phase3イベント: setupPhase3Events() 追加
5. Chrome API活用: OffscreenCanvas・WebCodecs・WebWorkers統合

【Phase3対象機能】
- PixiOffscreenProcessor: レイヤー並列処理・Worker統合
- PixiAnimationController: Storyboarder風アニメーション機能
- PixiModernExporter: WebCodecs高速出力・動画エクスポート
- ProjectStore: プロジェクト状態管理・保存機能
        `);
    }
    
    /**
     * Phase2エラーハンドリング
     */
    handlePhase2Error(error) {
        console.error('💥 Phase2初期化エラー:', error);
        
        // Phase2エラー表示UI
        const errorPanel = document.createElement('div');
        errorPanel.id = 'phase2-error';
        errorPanel.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: #aa5a56; color: #f0e0d6; padding: 20px;
            border-radius: 12px; font-family: Arial; text-align: center;
            z-index: 9999; box-shadow: 0 8px 32px rgba(0,0,0,0.8);
        `;
        
        errorPanel.innerHTML = `
            <h3>🎨 Phase2初期化エラー</h3>
            <p>ツール・UI・カラー統合に失敗しました</p>
            <p>Phase1基盤は正常動作中です</p>
            <pre style="font-size: 12px; margin: 10px 0;">${error.message}</pre>
            <button onclick="location.reload()" 
                style="background: #f0e0d6; color: #800000; border: none; 
                       padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                再読み込み
            </button>
            <button onclick="this.parentElement.remove()" 
                style="background: #800000; color: #f0e0d6; border: none; 
                       padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-left: 8px;">
                Phase1のみ継続
            </button>
        `;
        
        document.body.appendChild(errorPanel);
    }
    
    /**
     * 初期化エラーハンドリング（Phase1用）
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
     * Phase2診断実行
     */
    runPhase2Diagnostics() {
        const diagnostics = {
            phase1Status: this.checkPhase1ReadyConditions(),
            phase2Components: {
                toolProcessor: !!this.toolProcessor,
                colorProcessor: !!this.colorProcessor,
                layerProcessor: !!this.layerProcessor,
                canvasController: !!this.canvasController,
                uiController: !!this.uiController
            },
            integration: {
                eventsConnected: this.eventStore.getStats().totalEvents > 10,
                toolColorLinked: this.toolProcessor && this.colorProcessor,
                layerToolLinked: this.layerProcessor && this.toolProcessor,
                uiCanvasLinked: this.uiController && this.canvasController
            },
            performance: this.getPhase2PerformanceInfo()
        };
        
        console.log('🔍 Phase2診断結果:', diagnostics);
        return diagnostics;
    }
    
    /**
     * 手動Phase3移行（デバッグ用）
     */
    async forcePhase3Transition() {
        if (!this.checkPhase3ReadyConditions()) {
            console.warn('⚠️ Phase3移行条件未満足 - 強制移行は非推奨');
            return false;
        }
        
        try {
            console.log('⚡ Phase3手動移行開始（デバッグ用）');
            // Phase3実装時に使用
            // await this.initPhase3();
            
            return true;
        } catch (error) {
            console.error('❌ Phase3手動移行失敗:', error);
            return false;
        }
    }
    
    /**
     * 統合システム情報取得
     */
    getIntegratedSystemInfo() {
        return {
            currentPhase: this.currentPhase,
            phases: {
                phase1: this.checkPhase1ReadyConditions(),
                phase2: {
                    initialized: this.currentPhase >= 2,
                    components: {
                        tools: !!this.toolProcessor,
                        colors: !!this.colorProcessor,
                        layers: !!this.layerProcessor,
                        canvas: !!this.canvasController,
                        ui: !!this.uiController
                    }
                },
                phase3: {
                    ready: this.checkPhase3ReadyConditions(),
                    unlocked: false
                }
            },
            performance: this.getPhase2PerformanceInfo(),
            memory: this.estimatePhase2MemoryUsage(),
            timestamp: Date.now()
        };
    }
    
    /**
     * アプリケーション終了処理
     */
    destroy() {
        try {
            // Phase2コンポーネント破棄
            if (this.uiController) {
                this.uiController.destroy();
            }
            
            if (this.canvasController) {
                this.canvasController.destroy();
            }
            
            if (this.layerProcessor) {
                this.layerProcessor.destroy();
            }
            
            if (this.colorProcessor) {
                this.colorProcessor.destroy();
            }
            
            if (this.toolProcessor) {
                this.toolProcessor.destroy();
            }
            
            // Phase1基盤破棄
            if (this.historyController) {
                this.historyController.destroy();
            }
            
            if (this.shortcutController) {
                this.shortcutController.destroy();
            }
            
            if (this.inputController) {
                this.inputController.destroy();
            }
            
            if (this.coordinateUnifier) {
                this.coordinateUnifier.destroy();
            }
            
            if (this.pixiApp) {
                this.pixiApp.destroy(true);
            }
            
            if (this.eventStore) {
                this.eventStore.destroy();
            }
            
            // デバッグUI削除
            const debugPanels = document.querySelectorAll('[id$="-debug"]');
            debugPanels.forEach(panel => panel.remove());
            
            console.log('🔥 モダンお絵かきツール終了（Phase2統合版）');
            
        } catch (error) {
            console.error('❌ アプリケーション終了エラー:', error);
        }
    }
}

// グローバル診断関数（デバッグ用）
window.diagnosePaintTool = function() {
    if (window.modernDrawingApp) {
        return window.modernDrawingApp.getIntegratedSystemInfo();
    } else {
        return { error: 'アプリケーション未初期化' };
    }
};

window.runPhase2Diagnostics = function() {
    if (window.modernDrawingApp && window.modernDrawingApp.runPhase2Diagnostics) {
        return window.modernDrawingApp.runPhase2Diagnostics();
    } else {
        return { error: 'Phase2診断機能未使用可能' };
    }
};

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