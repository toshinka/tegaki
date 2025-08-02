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
        this.currentPhase = 2; // Phase2に更新
        
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
            
            // Phase1完了確認
            if (!this.checkPhase1ReadyConditions()) {
                throw new Error('Phase1基盤が未完了です');
            }
            
            // PixiJSレイヤープロセッサー初期化
            this.layerProcessor = new PixiLayerProcessor(
                this.pixiApp,
                this.coordinateUnifier,
                this.eventStore
            );
            
            // カラープロセッサー初期化
            this.colorProcessor = new ColorProcessor(this.eventStore);
            
            // PixiJSツールプロセッサー初期化
            this.toolProcessor = new PixiToolProcessor(
                this.pixiApp,
                this.coordinateUnifier,
                this.eventStore,
                this.renderer
            );
            
            // PixiJS UIコントローラー初期化
            this.uiController = new PixiUIController(
                this.pixiApp,
                this.eventStore,
                this.renderer
            );
            
            // キャンバスコントローラー初期化
            this.canvasController = new CanvasController(
                this.pixiApp,
                this.coordinateUnifier,
                this.eventStore
            );
            
            // Phase2コンポーネント連携設定
            this.setupPhase2Integration();
            
            // Phase2イベント連携設定
            this.setupPhase2Events();
            
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
     * Phase2コンポーネント連携設定
     */
    setupPhase2Integration() {
        // Renderer ↔ ToolProcessor
        this.renderer.connectToolProcessor?.(this.toolProcessor);
        this.toolProcessor.setRenderer?.(this.renderer);
        
        // Renderer ↔ ColorProcessor
        this.renderer.connectColorProcessor?.(this.colorProcessor);
        this.colorProcessor.setRenderer?.(this.renderer);
        
        // Renderer ↔ LayerProcessor
        this.renderer.connectLayerProcessor?.(this.layerProcessor);
        this.layerProcessor.setRenderer?.(this.renderer);
        
        // ToolProcessor ↔ LayerProcessor
        this.toolProcessor.setLayerProcessor?.(this.layerProcessor);
        this.layerProcessor.setToolProcessor?.(this.toolProcessor);
        
        // UIController ↔ 全コンポーネント
        this.uiController.setToolProcessor?.(this.toolProcessor);
        this.uiController.setColorProcessor?.(this.colorProcessor);
        this.uiController.setLayerProcessor?.(this.layerProcessor);
        this.uiController.setCanvasController?.(this.canvasController);
        
        console.log('🔗 Phase2コンポーネント連携設定完了');
    }
    
    /**
     * Phase2イベント連携設定
     */
    setupPhase2Events() {
        // ツール選択イベント
        this.eventStore.on('tool:select', (data) => {
            this.toolProcessor.selectTool(data.tool);
            this.uiController.updateToolUI(data);
        });
        
        // 色選択イベント
        this.eventStore.on('color:select', (data) => {
            this.colorProcessor.setColor(data.color);
            this.uiController.updateColorUI(data);
        });
        
        // レイヤー操作イベント
        this.eventStore.on('layer:select', (data) => {
            this.layerProcessor.setActiveLayer(data.layerId);
            this.uiController.updateLayerUI(data);
        });
        
        // キャンバス操作イベント
        this.eventStore.on('canvas:zoom', (data) => {
            this.canvasController.setZoom(data.zoom);
        });
        
        this.eventStore.on('canvas:pan', (data) => {
            this.canvasController.pan(data.delta);
        });
        
        // ファイル操作イベント
        this.eventStore.on('file:save', (data) => {
            this.saveProject(data);
        });
        
        this.eventStore.on('file:load', (data) => {
            this.loadProject(data);
        });
        
        console.log('📡 Phase2イベント連携設定完了');
    }
    
    /**
     * PixiJS統一リサイズ処理
     */
    handleResize() {
        if (this.renderer && this.coordinateUnifier) {
            this.renderer.handleResize();
            this.coordinateUnifier.updateViewport();
            
            // Phase2コンポーネントにもリサイズ通知
            if (this.uiController) {
                this.uiController.handleResize();
            }
            
            if (this.canvasController) {
                this.canvasController.handleResize();
            }
            
            this.eventStore.emit('viewport:resize', {
                width: this.canvas.width,
                height: this.canvas.height,
                phase: this.currentPhase
            });
        }
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
            console.log('🎨 Phase1基盤完了 - Phase2解封準備完了');
        } else {
            console.warn('⚠️ Phase1基盤未完了 - Phase2解封不可');
            checks.forEach((check, index) => {
                if (!check) {
                    console.warn(`  チェック失敗 [${index}]:`, check);
                }
            });
        }
        
        return allReady;
    }
    
    /**
     * Phase2準備完了条件チェック（Phase3解封用）
     */
    checkPhase2ReadyConditions() {
        const checks = [
            this.checkPhase1ReadyConditions(),
            this.toolProcessor && this.toolProcessor.isReady(),
            this.uiController && this.uiController.isReady(),
            this.colorProcessor && this.colorProcessor.isReady(),
            this.layerProcessor && this.layerProcessor.isReady(),
            this.canvasController && this.canvasController.isReady()
        ];
        
        const allReady = checks.every(check => check === true);
        
        if (allReady) {
            console.log('⚡ Phase2実用機能完了 - Phase3解封準備完了');
            this.logPhase3UnlockInstructions();
        }
        
        return allReady;
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
            tools: this.toolProcessor.getInfo(),
            ui: this.uiController.getInfo(),
            colors: this.colorProcessor.getInfo(),
            layers: this.layerProcessor.getStatistics(),
            canvas: this.canvasController.getInfo(),
            events: this.eventStore.getStats(),
            performance: this.renderer.getPerformanceInfo()
        };
        
        console.log('📊 Phase2システム情報:', info);
        
        // デバッグ用UI更新
        this.updatePhase2DebugUI(info);
    }
    
    /**
     * Phase2デバッグUI更新
     */
    updatePhase2DebugUI(info) {
        let debugPanel = document.getElementById('phase2-debug');
        
        if (!debugPanel) {
            debugPanel = document.createElement('div');
            debugPanel.id = 'phase2-debug';
            debugPanel.style.cssText = `
                position: fixed; top: 10px; right: 10px; z-index: 1000;
                background: rgba(128,0,0,0.95); color: #f0e0d6;
                padding: 16px; border-radius: 8px; font-size: 11px;
                font-family: monospace; max-width: 320px;
                max-height: 70vh; overflow-y: auto;
            `;
            document.body.appendChild(debugPanel);
        }
        
        debugPanel.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px; color: #ffcc66;">
                🎨 ${info.phase}
            </div>
            <div>📐 座標系: ${info.coordinate.system}</div>
            <div>🖌️ アクティブツール: ${info.tools.activeTool}</div>
            <div>🎨 現在色: ${info.colors.currentColor}</div>
            <div>📚 レイヤー数: ${info.layers.totalLayers}</div>
            <div>🖼️ アクティブレイヤー: ${info.layers.activeLayerId || 'なし'}</div>
            <div>⚡ FPS: ${info.performance.fps}</div>
            <div>📡 イベント: ${info.events.totalEvents}件</div>
            <div style="margin-top: 8px;">
                <div style="font-size: 10px; opacity: 0.9;">🖱️ 基本操作:</div>
                <div style="font-size: 9px; opacity: 0.8;">
                  • 左クリック: 描画<br>
                  • Ctrl+Z: アンドゥ<br>
                  • Ctrl+Y: リドゥ<br>
                  • スペース+ドラッグ: パン
                </div>
            </div>
            <div style="margin-top: 8px; font-size: 9px; opacity: 0.7;">
                Phase3準備完了後、Chrome API解封
            </div>
        `;
    }
    
    /**
     * Phase3解封指示ログ出力（Claude実装支援）
     */
    logPhase3UnlockInstructions() {
        console.log(`
⚡ Phase3解封指示（次回Claude実装時）:
1. main.js: Phase3コメントアウト解除
2. Phase3ファイル群実装: PixiOffscreenProcessor.js, PixiModernExporter.js等
3. Phase2連携: this.setupPhase3Integration() 呼び出し
4. Phase3イベント: setupPhase3Events() 追加
5. Chrome API活用: OffscreenCanvas, WebCodecs統合
        `);
    }
    
    /**
     * プロジェクト保存
     */
    async saveProject(saveData = {}) {
        try {
            console.log('💾 プロジェクト保存開始');
            
            // プロジェクトデータ構築
            const projectData = {
                version: '3.2',
                phase: this.currentPhase,
                timestamp: Date.now(),
                layers: this.layerProcessor.getAllLayersInfo(),
                tools: this.toolProcessor.getSettings(),
                colors: this.colorProcessor.getPalette(),
                canvas: this.canvasController.getSettings(),
                metadata: {
                    name: saveData.name || 'untitled',
                    author: saveData.author || 'unknown',
                    description: saveData.description || ''
                }
            };
            
            // JSON形式で保存
            const json = JSON.stringify(projectData, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            
            // ダウンロード実行
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${projectData.metadata.name}.mdp`; // Modern Drawing Project
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log('✅ プロジェクト保存完了:', projectData.metadata.name);
            
            // イベント通知
            this.eventStore.emit('project:saved', {
                name: projectData.metadata.name,
                size: blob.size,
                timestamp: Date.now()
            });
            
        } catch (error) {
            console.error('❌ プロジェクト保存エラー:', error);
            this.eventStore.emit('project:save:error', { error: error.message });
        }
    }
    
    /**
     * プロジェクト読み込み
     */
    async loadProject(file) {
        try {
            console.log('📂 プロジェクト読み込み開始:', file.name);
            
            // ファイル読み込み
            const text = await file.text();
            const projectData = JSON.parse(text);
            
            // バージョン確認
            if (projectData.version !== '3.2') {
                console.warn('⚠️ 非対応バージョン:', projectData.version);
            }
            
            // レイヤー復元
            if (projectData.layers && this.layerProcessor) {
                await this.layerProcessor.loadLayersData(projectData.layers);
            }
            
            // ツール設定復元
            if (projectData.tools && this.toolProcessor) {
                this.toolProcessor.loadSettings(projectData.tools);
            }
            
            // カラー設定復元
            if (projectData.colors && this.colorProcessor) {
                this.colorProcessor.loadPalette(projectData.colors);
            }
            
            // キャンバス設定復元
            if (projectData.canvas && this.canvasController) {
                this.canvasController.loadSettings(projectData.canvas);
            }
            
            // UI更新
            if (this.uiController) {
                this.uiController.refreshAll();
            }
            
            console.log('✅ プロジェクト読み込み完了:', projectData.metadata.name);
            
            // イベント通知
            this.eventStore.emit('project:loaded', {
                name: projectData.metadata.name,
                version: projectData.version,
                timestamp: Date.now()
            });
            
        } catch (error) {
            console.error('❌ プロジェクト読み込みエラー:', error);
            this.eventStore.emit('project:load:error', { error: error.message });
        }
    }
    
    /**
     * PNG エクスポート
     */
    async exportToPNG(options = {}) {
        try {
            console.log('🖼️ PNG エクスポート開始');
            
            const config = {
                width: options.width || this.canvas.width,
                height: options.height || this.canvas.height,
                resolution: options.resolution || 1,
                quality: options.quality || 1.0,
                backgroundColor: options.backgroundColor || 0xffffee
            };
            
            // 全レイヤー描画
            const renderTexture = PIXI.RenderTexture.create({
                width: config.width,
                height: config.height,
                resolution: config.resolution
            });
            
            // レイヤーContainer描画
            this.pixiApp.renderer.render(this.layerProcessor.layerContainer, { 
                renderTexture,
                clear: true
            });
            
            // Canvas抽出
            const canvas = this.pixiApp.renderer.extract.canvas(renderTexture);
            
            // Blob生成
            const blob = await new Promise((resolve) => {
                canvas.toBlob(resolve, 'image/png', config.quality);
            });
            
            // ダウンロード実行
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `drawing_${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // リソース解放
            renderTexture.destroy(true);
            
            console.log('✅ PNG エクスポート完了:', blob.size, 'bytes');
            
            // イベント通知
            this.eventStore.emit('export:png:complete', {
                size: blob.size,
                timestamp: Date.now()
            });
            
            return blob;
            
        } catch (error) {
            console.error('❌ PNG エクスポートエラー:', error);
            this.eventStore.emit('export:png:error', { error: error.message });
            throw error;
        }
    }
    
    /**
     * システム情報取得
     */
    getSystemInfo() {
        return {
            version: '3.2',
            phase: this.currentPhase,
            initialized: this.isInitialized,
            components: {
                renderer: !!this.renderer,
                coordinateUnifier: !!this.coordinateUnifier,
                inputController: !!this.inputController,
                shortcutController: !!this.shortcutController,
                historyController: !!this.historyController,
                eventStore: !!this.eventStore,
                toolProcessor: !!this.toolProcessor,
                uiController: !!this.uiController,
                colorProcessor: !!this.colorProcessor,
                layerProcessor: !!this.layerProcessor,
                canvasController: !!this.canvasController
            },
            performance: this.renderer ? this.renderer.getPerformanceInfo() : null,
            timestamp: Date.now()
        };
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
            background: #800000; color: #f0e0d6; padding: 24px;
            border-radius: 12px; font-family: Arial; text-align: center;
            z-index: 9999; box-shadow: 0 8px 32px rgba(0,0,0,0.8);
            max-width: 500px;
        `;
        
        errorPanel.innerHTML = `
            <h3>🚨 Phase${this.currentPhase}初期化エラー</h3>
            <p>PixiJS統一基盤の初期化に失敗しました</p>
            <pre style="font-size: 11px; margin: 12px 0; padding: 8px; 
                        background: rgba(0,0,0,0.3); border-radius: 4px; 
                        text-align: left; white-space: pre-wrap;">${error.message}</pre>
            <div style="margin-top: 16px;">
                <button onclick="location.reload()" 
                    style="background: #f0e0d6; color: #800000; border: none; 
                           padding: 10px 20px; border-radius: 6px; cursor: pointer;
                           margin-right: 8px; font-weight: bold;">
                    再読み込み
                </button>
                <button onclick="console.log(window.modernDrawingApp.getSystemInfo())"
                    style="background: rgba(240,224,214,0.2); color: #f0e0d6; 
                           border: 1px solid #f0e0d6; padding: 10px 20px; 
                           border-radius: 6px; cursor: pointer;">
                    デバッグ情報
                </button>
            </div>
        `;
        
        document.body.appendChild(errorPanel);
    }
    
    /**
     * アプリケーション終了処理
     */
    destroy() {
        console.log('🔥 モダンお絵かきツール終了処理開始');
        
        try {
            // Phase2コンポーネント破棄
            if (this.canvasController) {
                this.canvasController.destroy?.();
            }
            
            if (this.layerProcessor) {
                this.layerProcessor.destroy?.();
            }
            
            if (this.colorProcessor) {
                this.colorProcessor.destroy?.();
            }
            
            if (this.uiController) {
                this.uiController.destroy?.();
            }
            
            if (this.toolProcessor) {
                this.toolProcessor.destroy?.();
            }
            
            // Phase1コンポーネント破棄
            if (this.historyController) {
                this.historyController.destroy?.();
            }
            
            if (this.shortcutController) {
                this.shortcutController.destroy?.();
            }
            
            if (this.inputController) {
                this.inputController.destroy?.();
            }
            
            if (this.coordinateUnifier) {
                this.coordinateUnifier.destroy?.();
            }
            
            if (this.renderer) {
                this.renderer.destroy();
            }
            
            if (this.eventStore) {
                this.eventStore.destroy();
            }
            
            // PixiJS Application破棄
            if (this.pixiApp) {
                this.pixiApp.destroy(true);
            }
            
            console.log('✅ モダンお絵かきツール終了処理完了');
            
        } catch (error) {
            console.error('❌ 終了処理エラー:', error);
        }
    }
}

// アプリケーション起動
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔥 Phase1実装チェック開始');
    
    // HTML基盤確認
    const canvas = document.getElementById('canvas');
    if (canvas) {
        console.log('✅ Phase1 HTML基盤準備完了');
        console.log('📐 PixiJS統一座標系CSS準備完了');
        console.log('🎨 ふたば色統合スタイル準備完了');
        console.log('⚡ Chrome API最適化スタイル準備完了');
        
        // モダンお絵かきツール起動
        window.modernDrawingApp = new ModernDrawingApp();
        
        // グローバルデバッグ関数設定
        window.debugDrawingApp = () => {
            return window.modernDrawingApp.getSystemInfo();
        };
        
        window.exportPNG = (options) => {
            return window.modernDrawingApp.exportToPNG(options);
        };
        
        window.saveProject = (data) => {
            return window.modernDrawingApp.saveProject(data);
        };
        
    } else {
        console.error('❌ Canvas要素が見つかりません');
    }
});

// ページ終了時のクリーンアップ
window.addEventListener('beforeunload', () => {
    if (window.modernDrawingApp) {
        window.modernDrawingApp.destroy();
    }
});

// グローバルエラーハンドリング
window.addEventListener('error', (event) => {
    console.error('🚨 グローバルエラー:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('🚨 未処理Promise拒否:', event.reason);
    event.preventDefault();
});

export default ModernDrawingApp;