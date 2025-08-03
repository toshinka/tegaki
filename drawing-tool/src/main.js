/**
 * PixiJS v8統合管理・Phase2対応エントリーポイント
 * モダンお絵かきツール v3.3 - Phase2完全統合版
 * 
 * 機能:
 * - PixiJS v8単一アプリケーション管理・WebGPU優先
 * - Phase1基盤システム + Phase2実用機能統合
 * - 移動可能UI・カラーパレット・レイヤー管理
 * - ふたば色統一・Chrome API活用・干渉問題根絶
 * - Adobe Fresco風UI・責任分界保持・段階的解封
 */

import { Application } from 'pixi.js';

// Phase1基盤システム
import PixiV8UnifiedRenderer from './pixi-v8/PixiV8UnifiedRenderer.js';
import PixiV8InputController from './pixi-v8/PixiV8InputController.js';
import PixiV8AirbrushTool from './pixi-v8/PixiV8AirbrushTool.js';
import EventStore from './stores/EventStore.js';
import ShortcutController from './utils/ShortcutController.js';
import HistoryController from './stores/HistoryController.js';

// Phase2実用機能（動的import準備）
let PixiV8ToolProcessor = null;
let PixiV8UIController = null;
let PixiV8MovablePopup = null;
let ColorProcessor = null;
let PixiV8LayerProcessor = null;
let CanvasController = null;

/**
 * モダンお絵かきツール v3.3 メインアプリケーション
 * Phase2対応：実用機能統合・移動可能UI・Adobe Fresco風完全実装
 */
class ModernDrawingToolV33 {
    constructor() {
        // PixiJS v8統一基盤
        this.pixiApp = null;
        
        // Phase1基盤システム
        this.renderer = null;
        this.inputController = null;
        this.airbrushTool = null;
        this.eventStore = null;
        this.shortcutController = null;
        this.historyController = null;
        
        // Phase2実用機能
        this.toolProcessor = null;
        this.uiController = null;
        this.movablePopup = null;
        this.colorProcessor = null;
        this.layerProcessor = null;
        this.canvasController = null;
        
        // Phase管理（段階的機能解封）
        this.currentPhase = 1;
        this.maxPhase = 4;
        this.phase2Enabled = false;
        
        // PixiJS v8統一状態
        this.isWebGPUEnabled = false;
        this.isInitialized = false;
        this.phase2Initialized = false;
        
        // Chrome API対応状況
        this.chromeAPISupport = {
            offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
            webCodecs: typeof VideoEncoder !== 'undefined',
            webGPU: !!navigator.gpu
        };
        
        // エラーハンドリング・段階的縮退
        this.initializationErrors = [];
        this.fallbackMode = false;
        
        console.log('🎨 モダンお絵かきツール v3.3 Phase2統合版 - 初期化開始');
        this.logSystemCapabilities();
    }
    
    /**
     * システム対応状況ログ出力
     * デバッグ・トラブルシューティング用
     */
    logSystemCapabilities() {
        console.log('🔍 システム対応状況確認:');
        console.log(`- WebGPU: ${this.chromeAPISupport.webGPU ? '✅ 対応' : '❌ 非対応'}`);
        console.log(`- OffscreenCanvas: ${this.chromeAPISupport.offscreenCanvas ? '✅ 対応' : '❌ 非対応'}`);
        console.log(`- WebCodecs: ${this.chromeAPISupport.webCodecs ? '✅ 対応' : '❌ 非対応'}`);
        console.log(`- Device Pixel Ratio: ${window.devicePixelRatio || 1}`);
        console.log(`- Screen Size: ${window.innerWidth}x${window.innerHeight}`);
    }
    
    /**
     * PixiJS v8統一基盤アプリケーション初期化
     * WebGPU優先・Canvas2D完全排除・DOM競合根絶
     */
    async initializePixiV8Application() {
        try {
            const canvas = document.getElementById('pixi-canvas') || this.createMainCanvas();
            
            // PixiJS v8統一設定（Phase2対応・WebGPU優先）
            const pixiConfig = {
                canvas: canvas,
                width: window.innerWidth,
                height: window.innerHeight,
                backgroundColor: 0xffffee, // ふたば背景色統一
                antialias: true,
                autoDensity: true,
                resolution: window.devicePixelRatio || 1,
                powerPreference: 'high-performance',
                // WebGPU優先設定（Chrome API統合）
                preference: this.chromeAPISupport.webGPU ? 'webgpu' : 'webgl',
                // Phase2対応：高度機能有効化
                premultipliedAlpha: false,
                preserveDrawingBuffer: true,
                // パフォーマンス最適化
                sharedTicker: true,
                sharedLoader: true
            };
            
            // PixiJS v8アプリケーション単一作成（干渉根絶）
            this.pixiApp = new Application();
            await this.pixiApp.init(pixiConfig);
            
            // WebGPU対応状況確定
            this.isWebGPUEnabled = this.pixiApp.renderer.type === 'webgpu';
            
            // Canvas DOMプロパティ設定（Phase2対応）
            canvas.style.cssText = `
                position: absolute;
                top: 0;
                left: 72px;
                width: calc(100% - 372px);
                height: 100%;
                background: #ffffee;
                cursor: crosshair;
                touch-action: none;
                display: block;
                z-index: 1;
            `;
            
            console.log(`✅ PixiJS v8統一基盤初期化成功 - ${this.isWebGPUEnabled ? 'WebGPU' : 'WebGL2'}`);
            console.log(`📊 レンダラー情報: ${this.pixiApp.renderer.type} (${this.pixiApp.renderer.context?.version || 'N/A'})`);
            
            return true;
            
        } catch (error) {
            console.error('❌ PixiJS v8統一基盤初期化失敗:', error);
            this.initializationErrors.push({
                type: 'pixi-initialization',
                error: error,
                timestamp: Date.now(),
                phase: 'base'
            });
            
            // 段階的縮退：WebGL2フォールバック
            return await this.attemptFallbackInitialization();
        }
    }
    
    /**
     * フォールバック初期化（段階的縮退）
     * WebGL2強制・機能制限モード
     */
    async attemptFallbackInitialization() {
        try {
            console.log('🔄 フォールバックモード: WebGL2強制初期化');
            
            const canvas = document.getElementById('pixi-canvas');
            const fallbackConfig = {
                canvas: canvas,
                width: window.innerWidth,
                height: window.innerHeight,
                backgroundColor: 0xffffee,
                antialias: false, // 軽量化
                preference: 'webgl', // WebGL強制
                powerPreference: 'default'
            };
            
            this.pixiApp = new Application();
            await this.pixiApp.init(fallbackConfig);
            
            this.fallbackMode = true;
            this.isWebGPUEnabled = false;
            
            console.log('⚠️ フォールバックモード初期化成功 - WebGL2限定');
            return true;
            
        } catch (fallbackError) {
            console.error('❌ フォールバック初期化も失敗:', fallbackError);
            this.initializationErrors.push({
                type: 'fallback-initialization',
                error: fallbackError,
                timestamp: Date.now(),
                phase: 'fallback'
            });
            return false;
        }
    }
    
    /**
     * Phase1基盤システム統合初期化
     * レンダラー・入力制御・エアスプレー・イベント・履歴管理
     */
    async initializePhase1Systems() {
        try {
            console.log('🚀 Phase1基盤システム初期化開始');
            
            // 1. PixiJS v8統一レンダラー初期化
            this.renderer = new PixiV8UnifiedRenderer(this.pixiApp);
            console.log('✅ PixiV8UnifiedRenderer 初期化完了');
            
            // 2. PixiJS v8統一入力制御初期化
            this.inputController = new PixiV8InputController(this.pixiApp);
            console.log('✅ PixiV8InputController 初期化完了');
            
            // 3. エアスプレーツール初期化（PaintBrush代替・v3.3新機能）
            this.airbrushTool = new PixiV8AirbrushTool(this.pixiApp);
            console.log('✅ PixiV8AirbrushTool 初期化完了（PaintBrush代替）');
            
            // 4. イベントストア初期化（mitt.js統一）
            this.eventStore = new EventStore();
            console.log('✅ EventStore 初期化完了');
            
            // 5. ショートカット制御初期化（詳細キー対応）
            this.shortcutController = new ShortcutController(this.eventStore);
            console.log('✅ ShortcutController 初期化完了');
            
            // 6. 履歴制御初期化（アンドゥ・リドゥ）
            this.historyController = new HistoryController(this.pixiApp, this.eventStore);
            console.log('✅ HistoryController 初期化完了');
            
            // Phase1システム間連携設定
            this.setupPhase1Integration();
            
            console.log('🎯 Phase1基盤システム統合初期化完了');
            return true;
            
        } catch (error) {
            console.error('❌ Phase1基盤システム初期化失敗:', error);
            this.initializationErrors.push({
                type: 'phase1-systems',
                error: error,
                timestamp: Date.now(),
                phase: 1
            });
            return false;
        }
    }
    
    /**
     * Phase2実用機能動的読み込み・初期化
     * UI制御・ツール処理・レイヤー管理・カラー処理
     */
    async initializePhase2Systems() {
        try {
            console.log('🚀 Phase2実用機能初期化開始 - 動的import');
            
            // Phase2モジュール動的import（遅延読み込み・メモリ最適化）
            const [
                { default: PixiV8ToolProcessorClass },
                { default: PixiV8UIControllerClass },
                { default: PixiV8MovablePopupClass },
                { default: ColorProcessorClass },
                { default: PixiV8LayerProcessorClass },
                { default: CanvasControllerClass }
            ] = await Promise.all([
                import('./pixi-v8/PixiV8ToolProcessor.js'),
                import('./pixi-v8/PixiV8UIController.js'),
                import('./pixi-v8/PixiV8MovablePopup.js'),
                import('./utils/ColorProcessor.js'),
                import('./pixi-v8/PixiV8LayerProcessor.js'),
                import('./utils/CanvasController.js')
            ]);
            
            console.log('📦 Phase2モジュール動的import完了');
            
            // 1. ツール処理統合初期化
            this.toolProcessor = new PixiV8ToolProcessorClass(this.pixiApp, this.eventStore);
            console.log('✅ PixiV8ToolProcessor 初期化完了');
            
            // 2. UI制御初期化（Adobe Fresco風・移動可能パネル）
            this.uiController = new PixiV8UIControllerClass(this.pixiApp, this.eventStore);
            console.log('✅ PixiV8UIController 初期化完了（Adobe Fresco風）');
            
            // 3. 移動可能ポップアップ初期化
            this.movablePopup = new PixiV8MovablePopupClass(this.pixiApp, this.eventStore);
            console.log('✅ PixiV8MovablePopup 初期化完了');
            
            // 4. カラー処理初期化（ふたば色・HSV円形ピッカー）
            this.colorProcessor = new ColorProcessorClass(this.eventStore);
            console.log('✅ ColorProcessor 初期化完了（ふたば色統一・HSV）');
            
            // 5. レイヤー処理初期化（PixiJS Container統合）
            this.layerProcessor = new PixiV8LayerProcessorClass(this.pixiApp, this.eventStore);
            console.log('✅ PixiV8LayerProcessor 初期化完了');
            
            // 6. キャンバス制御初期化（座標系統一）
            this.canvasController = new CanvasControllerClass(this.pixiApp, this.eventStore);
            console.log('✅ CanvasController 初期化完了');
            
            // Phase2システム間統合連携設定
            this.setupPhase2Integration();
            
            this.phase2Enabled = true;
            this.phase2Initialized = true;
            this.currentPhase = 2;
            
            console.log('🎯 Phase2実用機能統合初期化完了');
            return true;
            
        } catch (error) {
            console.error('❌ Phase2実用機能初期化失敗:', error);
            this.initializationErrors.push({
                type: 'phase2-systems',
                error: error,
                timestamp: Date.now(),
                phase: 2
            });
            
            // Phase2失敗でもPhase1は継続
            console.log('⚠️ Phase2失敗 - Phase1基盤モードで継続');
            return false;
        }
    }
    
    /**
     * Phase1システム間統合連携設定
     * 基盤機能間の密結合・イベント連携
     */
    setupPhase1Integration() {
        // レンダラー ⇔ 入力制御連携
        this.inputController.onDrawingStart = (event) => {
            this.renderer.beginDrawing(event);
            this.historyController.beginAction('drawing');
        };
        
        this.inputController.onDrawingUpdate = (event) => {
            if (this.inputController.currentTool === 'airbrush') {
                // エアスプレーツール連携（v3.3新機能）
                this.airbrushTool.spray(event.x, event.y, event.pressure || 1.0);
            } else {
                this.renderer.updateDrawing(event);
            }
        };
        
        this.inputController.onDrawingEnd = (event) => {
            this.renderer.endDrawing(event);
            this.historyController.endAction();
        };
        
        // 基本ショートカット設定
        this.setupPhase1Shortcuts();
        
        // イベントストア統一連携
        this.eventStore.on('canvas-resize', (data) => {
            this.renderer.handleCanvasResize(data.width, data.height);
        });
        
        this.eventStore.on('webgpu-state-change', (data) => {
            console.log(`🔄 WebGPU状態変更: ${data.enabled ? '有効' : '無効'}`);
        });
        
        console.log('🔗 Phase1システム間統合連携設定完了');
    }
    
    /**
     * Phase1基本ショートカット設定
     * アンドゥ・リドゥ・基本ツール・エアスプレー
     */
    setupPhase1Shortcuts() {
        // アンドゥ・リドゥ
        this.shortcutController.register('ctrl+z', () => {
            this.historyController.undo();
        });
        
        this.shortcutController.register('ctrl+y', () => {
            this.historyController.redo();
        });
        
        // 基本ツール切り替え
        this.shortcutController.register('p', () => {
            this.inputController.setTool('pen');
            this.eventStore.emit('tool-changed', { tool: 'pen' });
        });
        
        this.shortcutController.register('e', () => {
            this.inputController.setTool('eraser');
            this.eventStore.emit('tool-changed', { tool: 'eraser' });
        });
        
        // エアスプレーツール専用ショートカット（v3.3新機能）
        this.shortcutController.register('a', () => {
            this.inputController.setTool('airbrush');
            this.eventStore.emit('tool-changed', { tool: 'airbrush' });
        });
        
        this.shortcutController.register('a+[', () => {
            this.airbrushTool.decreaseSize();
        });
        
        this.shortcutController.register('a+]', () => {
            this.airbrushTool.increaseSize();
        });
        
        // キャンバス操作基本
        this.shortcutController.register('ctrl+0', () => {
            this.eventStore.emit('canvas-reset-view');
        });
        
        this.shortcutController.register('del', () => {
            this.eventStore.emit('layer-clear-current');
        });
    }
    
    /**
     * Phase2システム間統合連携設定
     * 実用機能間の協調動作・UI連携・ツール統合
     */
    setupPhase2Integration() {
        if (!this.phase2Enabled) return;
        
        // UI制御 ⇔ ツール処理連携
        this.eventStore.on('tool-changed', (data) => {
            if (this.toolProcessor) {
                this.toolProcessor.setActiveTool(data.tool);
            }
            if (this.uiController) {
                this.uiController.updateActiveToolButton(data.tool);
            }
        });
        
        // カラー処理 ⇔ ツール処理連携
        this.eventStore.on('color-selected', (data) => {
            if (this.toolProcessor) {
                this.toolProcessor.setActiveColor(data.color);
            }
        });
        
        // レイヤー処理 ⇔ UI制御連携
        this.eventStore.on('layer-created', (data) => {
            if (this.uiController) {
                this.uiController.addLayerToPanel(data);
            }
        });
        
        this.eventStore.on('layer-deleted', (data) => {
            if (this.uiController) {
                this.uiController.removeLayerFromPanel(data.layerId);
            }
        });
        
        // キャンバス制御統合
        this.eventStore.on('canvas-operation', (data) => {
            if (this.canvasController) {
                this.canvasController.handleOperation(data);
            }
        });
        
        // 移動可能ポップアップ制御
        this.eventStore.on('popup-request', (data) => {
            if (this.movablePopup) {
                this.movablePopup.show(data.type, data.config);
            }
        });
        
        // Phase2拡張ショートカット設定
        this.setupPhase2Shortcuts();
        
        console.log('🔗 Phase2システム間統合連携設定完了');
    }
    
    /**
     * Phase2拡張ショートカット設定
     * 高度ツール・UI操作・パネル制御
     */
    setupPhase2Shortcuts() {
        // 高度ツール
        this.shortcutController.register('b', () => {
            this.eventStore.emit('tool-changed', { tool: 'blur' });
        });
        
        this.shortcutController.register('i', () => {
            this.eventStore.emit('tool-changed', { tool: 'eyedropper' });
        });
        
        this.shortcutController.register('g', () => {
            this.eventStore.emit('tool-changed', { tool: 'fill' });
        });
        
        this.shortcutController.register('m', () => {
            this.eventStore.emit('tool-changed', { tool: 'select' });
        });
        
        this.shortcutController.register('t', () => {
            this.eventStore.emit('tool-changed', { tool: 'text' });
        });
        
        // UI操作
        this.shortcutController.register('tab', () => {
            this.eventStore.emit('ui-panel-toggle', { target: 'configurable' });
        });
        
        // 全ポップアップ閉じる
        this.shortcutController.register('escape', () => {
            this.eventStore.emit('popup-hide-all');
        });
        
        // デフォルト位置復帰
        this.shortcutController.register('ctrl+alt+r', () => {
            this.eventStore.emit('ui-reset-positions');
        });
        
        // レイヤー操作
        this.shortcutController.register('up', () => {
            this.eventStore.emit('layer-select-previous');
        });
        
        this.shortcutController.register('down', () => {
            this.eventStore.emit('layer-select-next');
        });
        
        // キャンバス操作詳細
        this.shortcutController.register('h', () => {
            this.eventStore.emit('canvas-flip-horizontal');
        });
        
        this.shortcutController.register('shift+h', () => {
            this.eventStore.emit('canvas-flip-vertical');
        });
    }
    
    /**
     * メインCanvas要素作成・DOM統合
     * PixiJS v8統一Canvas・競合問題根絶・Phase2レイアウト対応
     */
    createMainCanvas() {
        // 既存Canvas要素削除（干渉防止）
        const existingCanvas = document.getElementById('pixi-canvas');
        if (existingCanvas) {
            existingCanvas.remove();
        }
        
        const canvas = document.createElement('canvas');
        canvas.id = 'pixi-canvas';
        
        // Phase2対応レイアウト適用
        canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 72px;
            width: calc(100% - 372px);
            height: 100%;
            background: #ffffee;
            cursor: crosshair;
            touch-action: none;
            display: block;
            z-index: 1;
            image-rendering: pixelated;
            image-rendering: -moz-crisp-edges;
            image-rendering: crisp-edges;
        `;
        
        // DOM挿入
        const canvasContainer = document.getElementById('canvasContainer') || document.body;
        canvasContainer.appendChild(canvas);
        
        console.log('🖼️ メインCanvas作成完了 - Phase2レイアウト適用');
        return canvas;
    }
    
    /**
     * ウィンドウリサイズハンドリング
     * PixiJS v8統一座標・Chrome API活用・レスポンシブ対応
     */
    handleWindowResize() {
        if (!this.pixiApp) return;
        
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // PixiJS統一リサイズ
        this.pixiApp.renderer.resize(width, height);
        
        // Canvas要素サイズ調整（Phase2レイアウト対応）
        const canvas = document.getElementById('pixi-canvas');
        if (canvas) {
            canvas.style.width = `calc(100% - 372px)`;
            canvas.style.height = `${height}px`;
        }
        
        // イベント通知（各システム連携）
        this.eventStore.emit('canvas-resize', { 
            width: width - 372,  // サイドバー + レイヤーパネル分除外
            height: height,
            fullWidth: width,
            fullHeight: height
        });
        
        console.log(`📐 ウィンドウリサイズ処理完了: ${width}x${height}`);
    }
    
    /**
     * Phase3以降準備（将来拡張）
     * アニメーション・オニオンスキン・高度機能
     */
    async preparePhase3() {
        console.log('📋 Phase3準備中 - アニメーション・オニオンスキン・Chrome API完全統合');
        // Phase3ファイル群の動的import準備
        // 実装はPhase3作成時に追加
    }
    
    /**
     * DOM準備完了待機・HTML構造確認
     * Phase2 UI要素存在確認・DOM依存関係解決
     */
    async waitForDOMReady() {
        return new Promise((resolve) => {
            if (document.readyState === 'complete') {
                resolve();
            } else {
                window.addEventListener('load', resolve);
            }
        });
    }
    
    /**
     * Phase2 DOM構造確認・必要要素生成
     * Adobe Fresco風レイアウト・移動可能パネル準備
     */
    ensurePhase2DOMStructure() {
        // アプリケーションレイアウト確認・生成
        let appLayout = document.querySelector('.app-layout');
        if (!appLayout) {
            appLayout = document.createElement('div');
            appLayout.className = 'app-layout';
            appLayout.innerHTML = `
                <div id="sidebar" class="sidebar"></div>
                <div id="canvasContainer" class="canvas-container"></div>
                <div id="layerPanel" class="layer-panel">
                    <div class="layer-panel-header">
                        <h3>レイヤー</h3>
                        <div class="layer-controls">
                            <button id="addLayerBtn" title="レイヤー追加">➕</button>
                            <button id="addFolderBtn" title="フォルダ追加">📁</button>
                        </div>
                    </div>
                    <div id="layerContent" class="layer-content"></div>
                </div>
                <div id="timeline" class="timeline" style="display: none;"></div>
                <div id="popupContainer" class="popup-container"></div>
                <div id="shortcutHint" class="shortcut-hint"></div>
            `;
            document.body.appendChild(appLayout);
        }
        
        // CSS統合スタイル適用
        this.applyPhase2Styles();
        
        console.log('🏗️ Phase2 DOM構造確認・生成完了');
    }
    
    /**
     * Phase2統合CSS適用
     * ふたば色統一・Adobe Fresco風・レスポンシブ対応
     */
    applyPhase2Styles() {
        // 既存スタイル要素削除
        const existingStyle = document.getElementById('phase2-styles');
        if (existingStyle) {
            existingStyle.remove();
        }
        
        const style = document.createElement('style');
        style.id = 'phase2-styles';
        style.textContent = `
            /* PixiJS v8統一基盤・Phase2統合スタイル */
            :root {
                /* ふたば色統一（v3.3完全版） */
                --futaba-maroon: #800000;
                --futaba-light-maroon: #aa5a56;
                --futaba-medium: #cf9c97;
                --futaba-light-medium: #e9c2ba;
                --futaba-cream: #f0e0d6;
                --futaba-background: #ffffee;
                
                /* レイアウト寸法 */
                --sidebar-width: 72px;
                --layer-panel-width: 300px;
                --icon-size-normal: 44px;
                --icon-size-active: 48px;
                --border-radius: 16px;
                
                /* Chrome最適化 */
                --gpu-acceleration: translateZ(0);
                --transition-fast: 200ms ease-out;
                --transition-normal: 300ms ease-out;
            }
            
            /* リセット・基本設定 */
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                background: var(--futaba-background);
                overflow: hidden;
                user-select: none;
                -webkit-user-select: none;
            }
            
            /* メインレイアウト（Adobe Fresco風） */
            .app-layout {
                display: grid;
                grid-template-columns: var(--sidebar-width) 1fr var(--layer-panel-width);
                grid-template-rows: 1fr auto;
                grid-template-areas: 
                    "sidebar canvas layer-panel"
                    "sidebar timeline layer-panel";
                height: 100vh;
                width: 100vw;
                position: relative;
                overflow: hidden;
                transform: var(--gpu-acceleration);
            }
            
            /* サイドバー（ツールパレット） */
            .sidebar {
                grid-area: sidebar;
                background: linear-gradient(135deg, var(--futaba-maroon) 0%, var(--futaba-light-maroon) 100%);
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 8px 4px;
                z-index: 10;
                box-shadow: 2px 0 8px rgba(0,0,0,0.3);
                transform: var(--gpu-acceleration);
            }
            
            /* ツールボタン（33pxアイコン仕様） */
            .tool-button {
                width: var(--icon-size-normal);
                height: var(--icon-size-normal);
                background: transparent;
                border: none;
                border-radius: 8px;
                margin: 2px 0;
                cursor: pointer;
                transition: all var(--transition-fast);
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--futaba-cream);
                font-size: 18px;
                position: relative;
                transform: var(--gpu-acceleration);
            }
            
            .tool-button:hover {
                background: rgba(255,255,255,0.1);
                transform: translateZ(0) scale(1.05);
                color: white;
            }
            
            .tool-button.active {
                background: var(--futaba-background);
                color: var(--futaba-maroon);
                box-shadow: inset 0 0 0 2px var(--futaba-cream);
                transform: translateZ(0) scale(1.1);
            }
            
            .tool-button:active {
                transform: translateZ(0) scale(0.95);
            }
            
            /* 区切り線 */
            .toolbar-separator {
                width: 80%;
                height: 1px;
                background: rgba(240, 224, 214, 0.3);
                margin: 4px 0;
            }
            
            /* キャンバスコンテナ */
            .canvas-container {
                grid-area: canvas;
                position: relative;
                overflow: hidden;
                background: var(--futaba-background);
                transform: var(--gpu-acceleration);
            }
            
            /* レイヤーパネル（Adobe Fresco風） */
            .layer-panel {
                grid-area: layer-panel;
                background: linear-gradient(135deg, 
                    rgba(128,0,0,0.96) 0%, 
                    rgba(170,90,86,0.92) 100%);
                backdrop-filter: blur(12px);
                border-left: 1px solid rgba(240,224,214,0.3);
                display: flex;
                flex-direction: column;
                z-index: 10;
                transform: translateX(0);
                transition: transform var(--transition-normal);
            }
            
            .layer-panel.hidden {
                transform: translateX(100%);
            }
            
            .layer-panel-header {
                padding: 16px;
                border-bottom: 1px solid rgba(240,224,214,0.3);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .layer-panel-header h3 {
                color: var(--futaba-cream);
                font-size: 16px;
                font-weight: 600;
            }
            
            .layer-controls {
                display: flex;
                gap: 8px;
            }
            
            .layer-controls button {
                width: 32px;
                height: 32px;
                background: transparent;
                border: 1px solid rgba(240,224,214,0.3);
                border-radius: 6px;
                color: var(--futaba-cream);
                cursor: pointer;
                transition: all var(--transition-fast);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
            }
            
            .layer-controls button:hover {
                background: rgba(255,255,255,0.1);
                border-color: var(--futaba-cream);
            }
            
            .layer-content {
                flex: 1;
                overflow-y: auto;
                padding: 8px;
            }
            
            /* レイヤーアイテム */
            .layer-item {
                background: rgba(240,224,214,0.1);
                border: 1px solid rgba(240,224,214,0.2);
                border-radius: 8px;
                margin-bottom: 8px;
                padding: 8px;
                transition: all var(--transition-fast);
            }
            
            .layer-item:hover {
                background: rgba(240,224,214,0.15);
                border-color: rgba(240,224,214,0.4);
            }
            
            .layer-row {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 8px;
            }
            
            .layer-visibility {
                cursor: pointer;
                opacity: 0.8;
                transition: opacity var(--transition-fast);
            }
            
            .layer-visibility:hover {
                opacity: 1;
            }
            
            .layer-name {
                flex: 1;
                color: var(--futaba-cream);
                font-size: 14px;
            }
            
            .layer-thumbnail {
                width: 32px;
                height: 32px;
                background: rgba(255,255,255,0.1);
                border: 1px solid rgba(240,224,214,0.3);
                border-radius: 4px;
            }
            
            .layer-controls {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            
            .opacity-control {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            
            .opacity-control label {
                color: var(--futaba-cream);
                font-size: 12px;
                display: flex;
                justify-content: space-between;
            }
            
            .opacity-slider {
                width: 100%;
                height: 20px;
                background: rgba(240,224,214,0.2);
                border-radius: 10px;
                outline: none;
                cursor: pointer;
            }
            
            /* タイムライン（アニメーションモード） */
            .timeline {
                grid-area: timeline;
                background: linear-gradient(135deg, 
                    rgba(170,90,86,0.92) 0%, 
                    rgba(233,194,186,0.85) 100%);
                border-top: 1px solid rgba(240,224,214,0.3);
                height: 120px;
                z-index: 10;
                transform: var(--gpu-acceleration);
            }
            
            /* ポップアップコンテナ */
            .popup-container {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 2000;
            }
            
            /* 移動可能ポップアップ */
            .popup-panel {
                position: absolute;
                background: rgba(128,0,0,0.96);
                backdrop-filter: blur(12px);
                border: 1px solid rgba(240,224,214,0.3);
                border-radius: var(--border-radius);
                box-shadow: 0 8px 32px rgba(0,0,0,0.6);
                pointer-events: auto;
                transform: var(--gpu-acceleration);
                min-width: 200px;
                max-width: 400px;
            }
            
            .popup-header {
                padding: 12px 16px;
                border-bottom: 1px solid rgba(240,224,214,0.3);
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: move;
                background: rgba(170,90,86,0.8);
                border-radius: var(--border-radius) var(--border-radius) 0 0;
            }
            
            .popup-title {
                color: var(--futaba-cream);
                font-size: 14px;
                font-weight: 600;
            }
            
            .popup-close {
                width: 24px;
                height: 24px;
                background: transparent;
                border: none;
                color: var(--futaba-cream);
                cursor: pointer;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                transition: all var(--transition-fast);
            }
            
            .popup-close:hover {
                background: rgba(255,255,255,0.2);
            }
            
            .popup-content {
                padding: 16px;
                color: var(--futaba-cream);
            }
            
            /* カラーパレット専用 */
            .color-palette-content {
                display: flex;
                flex-direction: column;
                gap: 16px;
                align-items: center;
            }
            
            .hsv-picker {
                width: 120px;
                height: 120px;
                border-radius: 50%;
                background: conic-gradient(
                    from 0deg,
                    #ff0000 0deg,
                    #ffff00 60deg,
                    #00ff00 120deg,
                    #00ffff 180deg,
                    #0000ff 240deg,
                    #ff00ff 300deg,
                    #ff0000 360deg
                );
                position: relative;
                cursor: crosshair;
                border: 2px solid var(--futaba-cream);
            }
            
            .color-presets {
                display: grid;
                grid-template-columns: repeat(5, 1fr);
                gap: 4px;
                width: 100%;
            }
            
            .color-swatch {
                width: 24px;
                height: 24px;
                border-radius: 4px;
                cursor: pointer;
                border: 1px solid rgba(240,224,214,0.3);
                transition: all var(--transition-fast);
            }
            
            .color-swatch:hover {
                transform: scale(1.1);
                border-color: var(--futaba-cream);
            }
            
            /* ショートカットヒント */
            .shortcut-hint {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 12px;
                pointer-events: none;
                opacity: 0;
                transition: opacity var(--transition-normal);
                z-index: 3000;
            }
            
            .shortcut-hint.visible {
                opacity: 1;
            }
            
            /* レスポンシブ対応 */
            @media (max-width: 768px) {
                .app-layout {
                    grid-template-columns: var(--sidebar-width) 1fr 0;
                }
                
                .layer-panel {
                    position: fixed;
                    right: 0;
                    top: 0;
                    height: 100%;
                    width: var(--layer-panel-width);
                    transform: translateX(100%);
                }
                
                .layer-panel:not(.hidden) {
                    transform: translateX(0);
                }
            }
            
            @media (max-width: 480px) {
                .app-layout {
                    grid-template-columns: 1fr;
                    grid-template-rows: auto 1fr auto;
                    grid-template-areas: 
                        "sidebar"
                        "canvas"
                        "timeline";
                }
                
                .sidebar {
                    flex-direction: row;
                    height: auto;
                    padding: 4px 8px;
                }
                
                .tool-button {
                    width: 36px;
                    height: 36px;
                    margin: 0 2px;
                }
            }
            
            /* パフォーマンス最適化 */
            .sidebar,
            .layer-panel,
            .canvas-container,
            .popup-panel {
                will-change: transform;
                contain: layout style paint;
            }
            
            /* スクロールバーカスタマイズ */
            .layer-content::-webkit-scrollbar {
                width: 8px;
            }
            
            .layer-content::-webkit-scrollbar-track {
                background: rgba(240,224,214,0.1);
                border-radius: 4px;
            }
            
            .layer-content::-webkit-scrollbar-thumb {
                background: rgba(240,224,214,0.3);
                border-radius: 4px;
            }
            
            .layer-content::-webkit-scrollbar-thumb:hover {
                background: rgba(240,224,214,0.5);
            }
        `;
        
        document.head.appendChild(style);
        console.log('🎨 Phase2統合CSS適用完了 - ふたば色・Adobe Fresco風');
    }
    
    /**
     * メインアプリケーション初期化・実行
     * Phase2対応：段階的初期化・DOM準備・エラーハンドリング
     */
    async initialize() {
        try {
            console.log('🚀 モダンお絵かきツール v3.3 Phase2統合版 初期化開始');
            
            // DOM準備完了待機
            await this.waitForDOMReady();
            console.log('📄 DOM準備完了');
            
            // Phase2 DOM構造確認・生成
            this.ensurePhase2DOMStructure();
            
            // Phase1: PixiJS v8統一基盤初期化
            console.log('🎯 Phase1開始: PixiJS v8統一基盤・エアスプレー機能');
            
            const pixiInitialized = await this.initializePixiV8Application();
            if (!pixiInitialized) {
                throw new Error('PixiJS v8統一基盤初期化失敗');
            }
            
            const phase1Initialized = await this.initializePhase1Systems();
            if (!phase1Initialized) {
                throw new Error('Phase1基盤システム初期化失敗');
            }
            
            console.log('✅ Phase1初期化完了');
            
            // Phase2: 実用機能初期化
            console.log('🎯 Phase2開始: 実用機能・Adobe Fresco風UI・移動可能パネル');
            
            try {
                const phase2Initialized = await this.initializePhase2Systems();
                if (phase2Initialized) {
                    console.log('✅ Phase2初期化完了 - 実用機能統合成功');
                } else {
                    console.log('⚠️ Phase2初期化失敗 - Phase1基盤モードで継続');
                }
            } catch (phase2Error) {
                console.warn('⚠️ Phase2初期化エラー - Phase1基盤モードで継続:', phase2Error);
            }
            
            // イベントリスナー設定
            this.setupGlobalEventListeners();
            
            // 初期リサイズ処理
            this.handleWindowResize();
            
            this.isInitialized = true;
            
            // 初期化完了ログ
            this.logInitializationSuccess();
            
            // Phase3以降準備
            await this.preparePhase3();
            
        } catch (error) {
            console.error('❌ アプリケーション初期化失敗:', error);
            this.handleInitializationError(error);
        }
    }
    
    /**
     * グローバルイベントリスナー設定
     * ウィンドウリサイズ・キーボード・DOM操作
     */
    setupGlobalEventListeners() {
        // ウィンドウリサイズ
        window.addEventListener('resize', () => this.handleWindowResize());
        
        // キーボードイベント（ショートカット制御に委譲）
        document.addEventListener('keydown', (e) => {
            if (this.shortcutController) {
                this.shortcutController.handleKeyDown(e);
            }
        });
        
        // コンテキストメニュー無効化（右クリック）
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
        
        // ブラウザのデフォルト操作無効化
        document.addEventListener('selectstart', (e) => {
            e.preventDefault();
        });
        
        // フォーカス管理
        window.addEventListener('focus', () => {
            console.log('🔍 ウィンドウフォーカス復帰');
        });
        
        window.addEventListener('blur', () => {
            console.log('🔍 ウィンドウフォーカス離脱');
        });
        
        console.log('🎮 グローバルイベントリスナー設定完了');
    }
    
    /**
     * 初期化成功ログ出力
     * システム状況・機能一覧・デバッグ情報
     */
    logInitializationSuccess() {
        console.log('✅ モダンお絵かきツール v3.3 Phase2統合版 起動成功');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎨 システム情報:');
        console.log(`   Phase: ${this.currentPhase}/${this.maxPhase}`);
        console.log(`   PixiJS: ${this.pixiApp.renderer.type} (${this.isWebGPUEnabled ? 'WebGPU' : 'WebGL2'})`);
        console.log(`   Phase2機能: ${this.phase2Enabled ? '✅ 有効' : '❌ 無効'}`);
        console.log(`   フォールバック: ${this.fallbackMode ? '⚠️ 有効' : '✅ 無効'}`);
        
        console.log('🛠️ 利用可能機能:');
        console.log('   ✏️ ペンツール・🖌️ エアスプレー・🗑️ 消しゴム');
        if (this.phase2Enabled) {
            console.log('   🌫️ ボカシ・💧 スポイト・🪣 塗りつぶし・⬚ 範囲選択・📝 テキスト');
            console.log('   🎨 HSV円形カラーピッカー・📚 レイヤー管理・📋 移動可能パネル');
        }
        
        console.log('⌨️ 主要ショートカット:');
        console.log('   Ctrl+Z: アンドゥ・Ctrl+Y: リドゥ・DEL: レイヤークリア');
        console.log('   P: ペン・A: エアスプレー・E: 消しゴム');
        if (this.phase2Enabled) {
            console.log('   B: ボカシ・I: スポイト・G: 塗りつぶし・M: 範囲選択・T: テキスト');
            console.log('   TAB: パネル切り替え・ESC: ポップアップ閉じる');
        }
        
        console.log('🚀 Chrome API対応:');
        console.log(`   WebGPU: ${this.chromeAPISupport.webGPU ? '✅' : '❌'}`);
        console.log(`   OffscreenCanvas: ${this.chromeAPISupport.offscreenCanvas ? '✅' : '❌'}`);
        console.log(`   WebCodecs: ${this.chromeAPISupport.webCodecs ? '✅' : '❌'}`);
        
        if (this.initializationErrors.length > 0) {
            console.log(`⚠️ 初期化警告: ${this.initializationErrors.length}件`);
        }
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎯 準備完了 - お絵かき開始可能！');
    }
    
    /**
     * 初期化エラーハンドリング
     * 段階的縮退・代替手段提供・詳細診断
     */
    handleInitializationError(error) {
        this.initializationErrors.push({
            type: 'application-initialization',
            error: error,
            timestamp: Date.now(),
            phase: 'main'
        });
        
        // エラー詳細分析
        const errorAnalysis = this.analyzeInitializationError(error);
        
        // エラー情報表示
        const errorMessage = `
❌ モダンお絵かきツール v3.3 初期化エラー

エラー詳細: ${error.message}

${errorAnalysis}

システム状況:
- PixiJS v8統一基盤: ${this.pixiApp ? '✅' : '❌'}
- WebGPU対応: ${this.isWebGPUEnabled ? '✅' : '❌'}
- フォールバックモード: ${this.fallbackMode ? '⚠️ 有効' : '無効'}
- エラー数: ${this.initializationErrors.length}

推奨対処法:
1. ブラウザを最新版に更新
2. ハードウェアアクセラレーションを有効化
3. 他のタブ・アプリケーションを閉じてメモリを確保
4. ページを再読み込み

技術情報:
- User Agent: ${navigator.userAgent}
- WebGPU: ${this.chromeAPISupport.webGPU ? '対応' : '非対応'}
- OffscreenCanvas: ${this.chromeAPISupport.offscreenCanvas ? '対応' : '非対応'}
        `;
        
        console.error(errorMessage);
        
        // DOM表示（開発時・ユーザー向けエラー表示）
        this.displayErrorUI(errorMessage);
    }
    
    /**
     * 初期化エラー分析
     * エラー原因特定・対処法提案
     */
    analyzeInitializationError(error) {
        const errorMsg = error.message.toLowerCase();
        
        if (errorMsg.includes('webgpu')) {
            return `
🔍 WebGPU関連エラー:
- ブラウザがWebGPUに対応していない可能性
- ハードウェアアクセラレーションが無効
- 対処: Chrome Canary使用・フラグ有効化を検討`;
        }
        
        if (errorMsg.includes('memory') || errorMsg.includes('out of')) {
            return `
🔍 メモリ不足エラー:
- 使用可能メモリが不足
- 他のタブ・アプリケーションが大量のメモリを使用
- 対処: 他のタブを閉じる・ブラウザ再起動`;
        }
        
        if (errorMsg.includes('context') || errorMsg.includes('webgl')) {
            return `
🔍 WebGL/レンダリングコンテキストエラー:
- グラフィックドライバが古い可能性
- ハードウェアアクセラレーションが無効
- 対処: ドライバ更新・ブラウザ設定確認`;
        }
        
        if (errorMsg.includes('import') || errorMsg.includes('module')) {
            return `
🔍 モジュール読み込みエラー:
- ネットワーク接続の問題
- ファイルパスの問題
- 対処: ページ再読み込み・ネットワーク確認`;
        }
        
        return `
🔍 一般的なエラー:
- ブラウザ対応状況を確認
- ページ再読み込みを試行
- 開発者コンソールで詳細確認`;
    }
    
    /**
     * エラーUI表示
     * ユーザー向けエラー情報・対処法ガイド
     */
    displayErrorUI(errorMessage) {
        // 既存エラー表示削除
        const existingError = document.getElementById('error-display');
        if (existingError) {
            existingError.remove();
        }
        
        const errorDiv = document.createElement('div');
        errorDiv.id = 'error-display';
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #800000 0%, #aa5a56 100%);
            color: #f0e0d6;
            padding: 24px;
            border-radius: 16px;
            font-family: 'Consolas', 'Monaco', monospace;
            white-space: pre-line;
            z-index: 9999;
            max-width: 80%;
            max-height: 80%;
            overflow: auto;
            box-shadow: 0 16px 64px rgba(0,0,0,0.8);
            border: 2px solid rgba(240,224,214,0.3);
            backdrop-filter: blur(12px);
        `;
        
        const closeButton = document.createElement('button');
        closeButton.textContent = '×';
        closeButton.style.cssText = `
            position: absolute;
            top: 8px;
            right: 12px;
            background: transparent;
            border: none;
            color: #f0e0d6;
            font-size: 24px;
            cursor: pointer;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: background 0.2s;
        `;
        
        closeButton.onmouseover = () => {
            closeButton.style.background = 'rgba(255,255,255,0.2)';
        };
        
        closeButton.onmouseout = () => {
            closeButton.style.background = 'transparent';
        };
        
        closeButton.onclick = () => {
            errorDiv.remove();
        };
        
        const retryButton = document.createElement('button');
        retryButton.textContent = '🔄 再試行';
        retryButton.style.cssText = `
            background: rgba(240,224,214,0.2);
            border: 1px solid rgba(240,224,214,0.4);
            color: #f0e0d6;
            padding: 8px 16px;
            border-radius: 8px;
            cursor: pointer;
            margin-top: 16px;
            font-size: 14px;
            transition: all 0.2s;
        `;
        
        retryButton.onmouseover = () => {
            retryButton.style.background = 'rgba(240,224,214,0.3)';
        };
        
        retryButton.onclick = () => {
            location.reload();
        };
        
        const content = document.createElement('div');
        content.style.cssText = 'padding-right: 40px; font-size: 13px; line-height: 1.4;';
        content.textContent = errorMessage;
        
        errorDiv.appendChild(closeButton);
        errorDiv.appendChild(content);
        errorDiv.appendChild(retryButton);
        
        document.body.appendChild(errorDiv);
    }
    
    /**
     * アプリケーション状態取得（デバッグ・監視用）
     * 全システムの統合状況・エラー情報・パフォーマンス指標
     */
    getApplicationState() {
        const state = {
            // 基本情報
            phase: this.currentPhase,
            maxPhase: this.maxPhase,
            isInitialized: this.isInitialized,
            fallbackMode: this.fallbackMode,
            
            // PixiJS統一基盤
            pixiApp: {
                initialized: !!this.pixiApp,
                rendererType: this.pixiApp?.renderer?.type || 'none',
                webgpuEnabled: this.isWebGPUEnabled,
                canvasSize: this.pixiApp ? {
                    width: this.pixiApp.screen.width,
                    height: this.pixiApp.screen.height
                } : null
            },
            
            // Phase1基盤システム
            phase1Systems: {
                renderer: !!this.renderer,
                inputController: !!this.inputController,
                airbrushTool: !!this.airbrushTool,
                eventStore: !!this.eventStore,
                shortcutController: !!this.shortcutController,
                historyController: !!this.historyController
            },
            
            // Phase2実用機能
            phase2Systems: {
                enabled: this.phase2Enabled,
                initialized: this.phase2Initialized,
                toolProcessor: !!this.toolProcessor,
                uiController: !!this.uiController,
                movablePopup: !!this.movablePopup,
                colorProcessor: !!this.colorProcessor,
                layerProcessor: !!this.layerProcessor,
                canvasController: !!this.canvasController
            },
            
            // Chrome API対応
            chromeAPISupport: { ...this.chromeAPISupport },
            
            // エラー・パフォーマンス
            errors: this.initializationErrors,
            performance: {
                initializationTime: Date.now() - (this.initializationStartTime || Date.now()),
                memoryUsage: performance.memory ? {
                    used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                    total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                    limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
                } : null
            },
            
            // システム環境
            environment: {
                userAgent: navigator.userAgent,
                devicePixelRatio: window.devicePixelRatio,
                screenSize: {
                    width: window.innerWidth,
                    height: window.innerHeight
                },
                timestamp: Date.now()
            }
        };
        
        return state;
    }
    
    /**
     * デバッグ情報出力
     * 開発・トラブルシューティング用詳細情報
     */
    debugInfo() {
        const state = this.getApplicationState();
        
        console.group('🔍 モダンお絵かきツール v3.3 デバッグ情報');
        console.log('📊 アプリケーション状態:', state);
        
        if (this.renderer) {
            console.log('🎨 レンダラー情報:', this.renderer.getDebugInfo());
        }
        
        if (this.phase2Enabled && this.uiController) {
            console.log('🖼️ UI制御情報:', this.uiController.getDebugInfo());
        }
        
        console.log('⚡ パフォーマンス:', {
            fps: this.pixiApp?.ticker?.FPS || 0,
            deltaTime: this.pixiApp?.ticker?.deltaMS || 0,
            memory: state.performance.memoryUsage
        });
        
        console.groupEnd();
        
        return state;
    }
    
    /**
     * 緊急停止・リソース解放
     * メモリリーク防止・適切なクリーンアップ
     */
    emergency stop() {
        console.log('🚨 緊急停止実行 - リソース解放開始');
        
        try {
            // イベントリスナー削除
            window.removeEventListener('resize', this.handleWindowResize);
            
            // Phase2システム解放
            if (this.phase2Enabled) {
                this.uiController?.destroy();
                this.toolProcessor?.destroy();
                this.movablePopup?.destroy();
                this.colorProcessor?.destroy();
                this.layerProcessor?.destroy();
                this.canvasController?.destroy();
            }
            
            // Phase1システム解放
            this.renderer?.destroy();
            this.inputController?.destroy();
            this.airbrushTool?.destroy();
            this.shortcutController?.destroy();
            this.historyController?.destroy();
            this.eventStore?.destroy();
            
            // PixiJS統一基盤解放
            if (this.pixiApp) {
                this.pixiApp.destroy(true, { children: true, texture: true, baseTexture: true });
            }
            
            // DOM要素削除
            const canvas = document.getElementById('pixi-canvas');
            if (canvas) {
                canvas.remove();
            }
            
            const errorDisplay = document.getElementById('error-display');
            if (errorDisplay) {
                errorDisplay.remove();
            }
            
            console.log('✅ 緊急停止完了 - リソース解放成功');
            
        } catch (error) {
            console.error('❌ 緊急停止中にエラー:', error);
        }
    }
    
    /**
     * ホットリロード対応（開発時）
     * モジュール更新時の状態保持・再初期化
     */
    async hotReload() {
        console.log('🔄 ホットリロード実行');
        
        // 現在の状態保存
        const currentState = this.getApplicationState();
        
        // 段階的停止・再初期化
        await this.emergencyStop();
        await new Promise(resolve => setTimeout(resolve, 100));
        await this.initialize();
        
        console.log('✅ ホットリロード完了');
        return currentState;
    }
}

// グローバル変数・デバッグ用アクセス
let modernDrawingTool = null;

/**
 * DOMContentLoaded時自動初期化
 * Phase2対応・確実実装保証・エラーハンドリング
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('📄 DOMContentLoaded - Phase2統合版初期化開始');
        
        modernDrawingTool = new ModernDrawingToolV33();
        modernDrawingTool.initializationStartTime = Date.now();
        
        // グローバルアクセス（デバッグ・開発用）
        window.modernDrawingTool = modernDrawingTool;
        window.debugDrawingTool = () => modernDrawingTool.debugInfo();
        window.emergencyStop = () => modernDrawingTool.emergencyStop();
        
        await modernDrawingTool.initialize();
        
        console.log('🎉 DOMContentLoaded初期化完了');
        
    } catch (error) {
        console.error('❌ DOMContentLoaded初期化エラー:', error);
        
        // 最低限のエラー表示
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #800000;
            color: #f0e0d6;
            padding: 16px;
            border-radius: 8px;
            font-family: monospace;
            z-index: 9999;
            max-width: 300px;
        `;
        errorDiv.textContent = `初期化エラー: ${error.message}`;
        document.body.appendChild(errorDiv);
    }
});

/**
 * ページ読み込み前チェック・早期警告
 * ブラウザ対応状況確認・互換性チェック
 */
(() => {
    console.log('🔍 事前チェック実行 - ブラウザ対応状況確認');
    
    // 必須機能チェック
    const requiredFeatures = {
        es6Modules: typeof Symbol !== 'undefined',
        webgl: !!document.createElement('canvas').getContext('webgl'),
        webgl2: !!document.createElement('canvas').getContext('webgl2'),
        webgpu: !!navigator.gpu,
        offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
        webCodecs: typeof VideoEncoder !== 'undefined'
    };
    
    console.log('✅ 必須機能チェック結果:');
    Object.entries(requiredFeatures).forEach(([feature, supported]) => {
        console.log(`   ${feature}: ${supported ? '✅' : '❌'}`);
    });
    
    // 警告表示
    if (!requiredFeatures.webgl2) {
        console.warn('⚠️ WebGL2非対応 - 一部機能が制限される可能性があります');
    }
    
    if (!requiredFeatures.webgpu) {
        console.warn('⚠️ WebGPU非対応 - WebGL2フォールバックモードで動作します');
    }
    
    // パフォーマンス警告
    if (navigator.hardwareConcurrency < 4) {
        console.warn('⚠️ CPU性能警告 - 描画性能が制限される可能性があります');
    }
    
    if (navigator.deviceMemory && navigator.deviceMemory < 4) {
        console.warn('⚠️ メモリ警告 - 大きなキャンバスでの動作が制限される可能性があります');
    }
})();

// エクスポート
export default ModernDrawingToolV33;