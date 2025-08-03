/**
 * PixiJS v8統合管理・段階初期化
 * モダンお絵かきツール v3.3 - Phase1統合エントリーポイント
 * 
 * 機能:
 * - PixiJS v8単一アプリケーション管理
 * - WebGPU優先設定・フォールバック制御
 * - Phase1基盤システム統合初期化
 * - ふたば色UI統合・Chrome API活用
 * - 干渉問題根絶・座標系統一
 */

import { Application } from 'pixi.js';
import PixiV8UnifiedRenderer from './pixi-v8/PixiV8UnifiedRenderer.js';
import PixiV8InputController from './pixi-v8/PixiV8InputController.js';
import PixiV8AirbrushTool from './pixi-v8/PixiV8AirbrushTool.js';
import EventStore from './stores/EventStore.js';
import ShortcutController from './utils/ShortcutController.js';
import HistoryController from './stores/HistoryController.js';

/**
 * モダンお絵かきツール v3.3メインアプリケーション
 * PixiJS v8統一基盤・段階的機能解封・Chrome API統合
 */
class ModernDrawingToolV33 {
    constructor() {
        this.pixiApp = null;
        this.renderer = null;
        this.inputController = null;
        this.airbrushTool = null;
        this.eventStore = null;
        this.shortcutController = null;
        this.historyController = null;
        
        // Phase管理（段階的機能解封）
        this.currentPhase = 1;
        this.maxPhase = 4;
        
        // PixiJS v8統一状態
        this.isWebGPUEnabled = false;
        this.isInitialized = false;
        
        // エラーハンドリング
        this.initializationErrors = [];
        
        console.log('🎨 モダンお絵かきツール v3.3 - PixiJS v8統一基盤 初期化開始');
    }
    
    /**
     * PixiJS v8統一基盤アプリケーション初期化
     * WebGPU優先・Canvas2D完全排除・DOM競合根絶
     */
    async initializePixiV8Application() {
        try {
            const canvas = document.getElementById('pixi-canvas') || this.createCanvas();
            
            // PixiJS v8統一設定（WebGPU優先・Chrome API対応）
            const pixiConfig = {
                view: canvas,
                width: window.innerWidth,
                height: window.innerHeight,
                backgroundColor: 0xffffee, // ふたば背景色
                antialias: true,
                autoDensity: true,
                resolution: window.devicePixelRatio || 1,
                powerPreference: 'high-performance',
                // WebGPU優先設定（v3.3核心）
                preference: 'webgpu',
                // Chrome API統合準備
                premultipliedAlpha: false,
                preserveDrawingBuffer: true
            };
            
            // PixiJS v8アプリケーション単一作成（干渉根絶）
            this.pixiApp = new Application();
            await this.pixiApp.init(pixiConfig);
            
            // WebGPU対応状況検出
            this.isWebGPUEnabled = this.pixiApp.renderer.type === 'webgpu';
            
            console.log(`✅ PixiJS v8統一基盤初期化成功 - ${this.isWebGPUEnabled ? 'WebGPU' : 'WebGL2'}`);
            return true;
            
        } catch (error) {
            console.error('❌ PixiJS v8統一基盤初期化失敗:', error);
            this.initializationErrors.push({
                type: 'pixi-initialization',
                error: error,
                timestamp: Date.now()
            });
            return false;
        }
    }
    
    /**
     * Phase1システム統合初期化
     * 基盤レンダラー・入力制御・エアスプレー・イベント・履歴管理
     */
    async initializePhase1Systems() {
        try {
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
            
            // システム間連携設定
            this.setupPhase1Integration();
            
            console.log('🚀 Phase1システム統合初期化完了');
            return true;
            
        } catch (error) {
            console.error('❌ Phase1システム初期化失敗:', error);
            this.initializationErrors.push({
                type: 'phase1-systems',
                error: error,
                timestamp: Date.now()
            });
            return false;
        }
    }
    
    /**
     * Phase1システム間統合連携設定
     * PixiJS v8統一座標・イベント連携・Chrome API活用
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
                this.airbrushTool.spray(event.x, event.y, event.pressure);
            } else {
                this.renderer.updateDrawing(event);
            }
        };
        
        this.inputController.onDrawingEnd = (event) => {
            this.renderer.endDrawing(event);
            this.historyController.endAction();
        };
        
        // ショートカット ⇔ システム連携
        this.shortcutController.register('ctrl+z', () => {
            this.historyController.undo();
        });
        
        this.shortcutController.register('ctrl+y', () => {
            this.historyController.redo();
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
     * Canvas要素作成・DOM統合
     * PixiJS v8統一Canvas・競合問題根絶
     */
    createCanvas() {
        const canvas = document.createElement('canvas');
        canvas.id = 'pixi-canvas';
        canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #ffffee;
            cursor: crosshair;
            touch-action: none;
            display: block;
        `;
        
        document.body.appendChild(canvas);
        return canvas;
    }
    
    /**
     * リサイズハンドリング
     * PixiJS v8統一座標・Chrome API活用
     */
    handleResize() {
        if (!this.pixiApp) return;
        
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.pixiApp.renderer.resize(width, height);
        this.eventStore.emit('canvas-resize', { width, height });
        
        console.log(`📐 リサイズ処理完了: ${width}x${height}`);
    }
    
    /**
     * Phase2以降準備（将来拡張）
     * UI制御・カラーパレット・レイヤー管理等
     */
    async preparePhase2() {
        console.log('📋 Phase2準備中 - UI制御・移動可能パネル・カラーパレット');
        this.currentPhase = 2;
        // Phase2ファイル群の動的import準備
        // 実装はPhase2作成時に追加
    }
    
    /**
     * メインアプリケーション初期化・実行
     * 段階的初期化・エラーハンドリング・確実実装保証
     */
    async initialize() {
        try {
            // Phase1: PixiJS v8統一基盤初期化
            console.log('🚀 Phase1開始: PixiJS v8統一基盤・エアスプレー機能');
            
            const pixiInitialized = await this.initializePixiV8Application();
            if (!pixiInitialized) {
                throw new Error('PixiJS v8統一基盤初期化失敗');
            }
            
            const phase1Initialized = await this.initializePhase1Systems();
            if (!phase1Initialized) {
                throw new Error('Phase1システム初期化失敗');
            }
            
            // リサイズイベント設定
            window.addEventListener('resize', () => this.handleResize());
            this.handleResize(); // 初期リサイズ
            
            this.isInitialized = true;
            console.log('✅ Phase1初期化完了 - モダンお絵かきツール v3.3 起動成功');
            
            // Phase2以降準備
            await this.preparePhase2();
            
        } catch (error) {
            console.error('❌ アプリケーション初期化失敗:', error);
            this.handleInitializationError(error);
        }
    }
    
    /**
     * 初期化エラーハンドリング
     * 段階的縮退・代替手段提供
     */
    handleInitializationError(error) {
        this.initializationErrors.push({
            type: 'application-initialization',
            error: error,
            timestamp: Date.now()
        });
        
        // エラー情報表示
        const errorMessage = `
            ❌ モダンお絵かきツール v3.3 初期化エラー
            
            エラー詳細: ${error.message}
            
            確認事項:
            1. ブラウザがPixiJS v8・WebGPU対応か確認
            2. npmインストールが完了しているか確認
            3. package.jsonの依存関係が正しいか確認
            
            技術情報:
            - PixiJS v8統一基盤: ${this.pixiApp ? '✅' : '❌'}
            - WebGPU対応: ${this.isWebGPUEnabled ? '✅' : '❌'}
            - エラー数: ${this.initializationErrors.length}
        `;
        
        console.error(errorMessage);
        
        // DOM表示（開発時デバッグ用）
        if (document.body) {
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #800000;
                color: #f0e0d6;
                padding: 20px;
                border-radius: 16px;
                font-family: monospace;
                white-space: pre-line;
                z-index: 9999;
                max-width: 80%;
                max-height: 80%;
                overflow: auto;
            `;
            errorDiv.textContent = errorMessage;
            document.body.appendChild(errorDiv);
        }
    }
    
    /**
     * アプリケーション状態取得（デバッグ・監視用）
     */
    getApplicationState() {
        return {
            phase: this.currentPhase,
            maxPhase: this.maxPhase,
            isInitialized: this.isInitialized,
            isWebGPUEnabled: this.isWebGPUEnabled,
            pixiRenderer: this.pixiApp?.renderer?.type || 'none',
            errors: this.initializationErrors,
            systems: {
                renderer: !!this.renderer,
                inputController: !!this.inputController,
                airbrushTool: !!this.airbrushTool,
                eventStore: !!this.eventStore,
                shortcutController: !!this.shortcutController,
                historyController: !!this.historyController
            }
        };
    }
}

// グローバル変数・デバッグ用アクセス
let modernDrawingTool = null;

/**
 * DOMContentLoaded時自動初期化
 * PixiJS v8統一基盤・確実実装保証
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        modernDrawingTool = new ModernDrawingToolV33();
        window.modernDrawingTool = modernDrawingTool; // デバッグ用グローバルアクセス
        
        await modernDrawingTool.initialize();
        
    } catch (error) {
        console.error('❌ DOMContentLoaded初期化エラー:', error);
    }
});

// WebGPU・Chrome API対応ブラウザ検出
console.log('🔍 ブラウザ対応状況:');
console.log(`- WebGPU: ${navigator.gpu ? '✅ 対応' : '❌ 非対応'}`);
console.log(`- OffscreenCanvas: ${typeof OffscreenCanvas !== 'undefined' ? '✅ 対応' : '❌ 非対応'}`);
console.log(`- WebCodecs: ${typeof VideoEncoder !== 'undefined' ? '✅ 対応' : '❌ 非対応'}`);

export default ModernDrawingToolV33;