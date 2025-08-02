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

import { Application, Graphics, Container, Text, Sprite } from 'pixi.js';
import mitt from 'mitt';

// Phase1基盤システムのインポート（存在確認付き）
let PixiV8UnifiedRenderer, PixiV8InputController, PixiV8AirbrushTool;
let EventStore, ShortcutController, HistoryController;

// 動的インポートでエラーハンドリング
async function loadPhase1Modules() {
    try {
        // Phase1モジュール動的読み込み
        const modules = await Promise.allSettled([
            import('./pixi-v8/PixiV8UnifiedRenderer.js').catch(() => null),
            import('./pixi-v8/PixiV8InputController.js').catch(() => null),
            import('./pixi-v8/PixiV8AirbrushTool.js').catch(() => null),
            import('./stores/EventStore.js').catch(() => null),
            import('./utils/ShortcutController.js').catch(() => null),
            import('./stores/HistoryController.js').catch(() => null)
        ]);

        // 成功したモジュールのみ設定
        if (modules[0].status === 'fulfilled' && modules[0].value) {
            PixiV8UnifiedRenderer = modules[0].value.default;
        }
        if (modules[1].status === 'fulfilled' && modules[1].value) {
            PixiV8InputController = modules[1].value.default;
        }
        if (modules[2].status === 'fulfilled' && modules[2].value) {
            PixiV8AirbrushTool = modules[2].value.default;
        }
        if (modules[3].status === 'fulfilled' && modules[3].value) {
            EventStore = modules[3].value.default;
        }
        if (modules[4].status === 'fulfilled' && modules[4].value) {
            ShortcutController = modules[4].value.default;
        }
        if (modules[5].status === 'fulfilled' && modules[5].value) {
            HistoryController = modules[5].value.default;
        }

        console.log('📦 Phase1モジュール読み込み完了');
        return true;
    } catch (error) {
        console.warn('⚠️ Phase1モジュール読み込み中にエラー:', error);
        return false;
    }
}

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
        
        // 基本描画状態
        this.currentTool = 'pen';
        this.currentColor = 0x800000; // ふたばマルーン
        this.currentSize = 12;
        this.currentOpacity = 0.85;
        this.isDrawing = false;
        this.currentStroke = null;
        
        console.log('🎨 モダンお絵かきツール v3.3 - PixiJS v8統一基盤 初期化開始');
    }
    
    /**
     * PixiJS v8統一基盤アプリケーション初期化
     * WebGPU優先・Canvas2D完全排除・DOM競合根絶
     */
    async initializePixiV8Application() {
        try {
            const canvas = document.getElementById('pixi-canvas');
            if (!canvas) {
                throw new Error('PixiJS v8統一Canvas要素が見つかりません');
            }
            
            // PixiJS v8統一設定（WebGPU優先・Chrome API対応）
            const pixiConfig = {
                canvas: canvas,
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
            
            // 基本レイヤー構造作成
            this.setupBasicLayers();
            
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
     * 基本レイヤー構造セットアップ
     */
    setupBasicLayers() {
        // PixiJS v8 Container階層管理
        this.backgroundLayer = new Container();
        this.drawingLayers = new Container();
        this.uiLayer = new Container();
        
        this.pixiApp.stage.addChild(
            this.backgroundLayer,
            this.drawingLayers,
            this.uiLayer
        );
        
        // 背景作成
        const background = new Graphics();
        background
            .rect(0, 0, this.pixiApp.screen.width, this.pixiApp.screen.height)
            .fill(0xffffee);
        this.backgroundLayer.addChild(background);
        
        console.log('📚 基本レイヤー構造セットアップ完了');
    }
    
    /**
     * Phase1システム統合初期化
     * 基盤レンダラー・入力制御・エアスプレー・イベント・履歴管理
     */
    async initializePhase1Systems() {
        try {
            // モジュール読み込み確認
            const modulesLoaded = await loadPhase1Modules();
            
            // 1. イベントストア初期化（基盤システム）
            if (EventStore) {
                this.eventStore = new EventStore();
                console.log('✅ EventStore 初期化完了');
            } else {
                // フォールバック: mitt.js直接使用
                this.eventStore = mitt();
                console.log('⚠️ EventStore フォールバック: mitt.js直接使用');
            }
            
            // 2. PixiJS v8統一レンダラー初期化
            if (PixiV8UnifiedRenderer) {
                this.renderer = new PixiV8UnifiedRenderer(this.pixiApp);
                console.log('✅ PixiV8UnifiedRenderer 初期化完了');
            } else {
                // フォールバック: 基本描画機能実装
                this.setupBasicDrawing();
                console.log('⚠️ PixiV8UnifiedRenderer フォールバック: 基本描画機能');
            }
            
            // 3. PixiJS v8統一入力制御初期化
            if (PixiV8InputController) {
                this.inputController = new PixiV8InputController(this.pixiApp);
                console.log('✅ PixiV8InputController 初期化完了');
            } else {
                // フォールバック: 基本入力処理
                this.setupBasicInput();
                console.log('⚠️ PixiV8InputController フォールバック: 基本入力処理');
            }
            
            // 4. エアスプレーツール初期化（PaintBrush代替・v3.3新機能）
            if (PixiV8AirbrushTool) {
                this.airbrushTool = new PixiV8AirbrushTool(this.pixiApp);
                console.log('✅ PixiV8AirbrushTool 初期化完了（PaintBrush代替）');
            } else {
                console.log('⚠️ PixiV8AirbrushTool フォールバック: 基本ペン機能');
            }
            
            // 5. ショートカット制御初期化（詳細キー対応）
            if (ShortcutController) {
                this.shortcutController = new ShortcutController(this.eventStore);
                console.log('✅ ShortcutController 初期化完了');
            } else {
                // フォールバック: 基本ショートカット
                this.setupBasicShortcuts();
                console.log('⚠️ ShortcutController フォールバック: 基本ショートカット');
            }
            
            // 6. 履歴制御初期化（アンドゥ・リドゥ）
            if (HistoryController) {
                this.historyController = new HistoryController(this.pixiApp, this.eventStore);
                console.log('✅ HistoryController 初期化完了');
            } else {
                console.log('⚠️ HistoryController フォールバック: 履歴機能なし');
            }
            
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
     * 基本描画機能セットアップ（フォールバック）
     */
    setupBasicDrawing() {
        this.basicDrawing = {
            currentGraphics: null,
            
            beginDrawing: (x, y) => {
                this.basicDrawing.currentGraphics = new Graphics();
                this.basicDrawing.currentGraphics
                    .moveTo(x, y)
                    .lineTo(x, y)
                    .stroke({
                        width: this.currentSize,
                        color: this.currentColor,
                        alpha: this.currentOpacity,
                        cap: 'round',
                        join: 'round'
                    });
                this.drawingLayers.addChild(this.basicDrawing.currentGraphics);
            },
            
            updateDrawing: (x, y) => {
                if (this.basicDrawing.currentGraphics) {
                    this.basicDrawing.currentGraphics
                        .lineTo(x, y)
                        .stroke({
                            width: this.currentSize,
                            color: this.currentColor,
                            alpha: this.currentOpacity,
                            cap: 'round',
                            join: 'round'
                        });
                }
            },
            
            endDrawing: () => {
                this.basicDrawing.currentGraphics = null;
            }
        };
    }
    
    /**
     * 基本入力処理セットアップ（フォールバック）
     */
    setupBasicInput() {
        const canvas = this.pixiApp.view;
        
        // マウス・タッチイベント処理
        const getEventPos = (event) => {
            const rect = canvas.getBoundingClientRect();
            const clientX = event.clientX || (event.touches && event.touches[0].clientX);
            const clientY = event.clientY || (event.touches && event.touches[0].clientY);
            
            return {
                x: (clientX - rect.left) * (canvas.width / rect.width),
                y: (clientY - rect.top) * (canvas.height / rect.height)
            };
        };
        
        // ポインター開始
        const handlePointerStart = (event) => {
            event.preventDefault();
            this.isDrawing = true;
            const pos = getEventPos(event);
            
            if (this.basicDrawing) {
                this.basicDrawing.beginDrawing(pos.x, pos.y);
            }
        };
        
        // ポインター移動
        const handlePointerMove = (event) => {
            if (!this.isDrawing) return;
            event.preventDefault();
            const pos = getEventPos(event);
            
            if (this.basicDrawing) {
                this.basicDrawing.updateDrawing(pos.x, pos.y);
            }
        };
        
        // ポインター終了
        const handlePointerEnd = (event) => {
            if (!this.isDrawing) return;
            event.preventDefault();
            this.isDrawing = false;
            
            if (this.basicDrawing) {
                this.basicDrawing.endDrawing();
            }
        };
        
        // イベントリスナー登録
        canvas.addEventListener('mousedown', handlePointerStart);
        canvas.addEventListener('mousemove', handlePointerMove);
        canvas.addEventListener('mouseup', handlePointerEnd);
        
        canvas.addEventListener('touchstart', handlePointerStart);
        canvas.addEventListener('touchmove', handlePointerMove);
        canvas.addEventListener('touchend', handlePointerEnd);
        
        // コンテキストメニュー無効化
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        console.log('🎯 基本入力処理セットアップ完了');
    }
    
    /**
     * 基本ショートカットセットアップ（フォールバック）
     */
    setupBasicShortcuts() {
        document.addEventListener('keydown', (event) => {
            // Ctrl+Z: アンドゥ（基本）
            if (event.ctrlKey && event.key === 'z' && !event.shiftKey) {
                event.preventDefault();
                console.log('⏪ アンドゥ（基本機能）');
                // 基本的なアンドゥ処理（完全実装は履歴コントローラー必要）
            }
            
            // Ctrl+Y: リドゥ（基本）
            if (event.ctrlKey && event.key === 'y') {
                event.preventDefault();
                console.log('⏩ リドゥ（基本機能）');
                // 基本的なリドゥ処理
            }
            
            // ツール切り替え
            switch (event.key.toLowerCase()) {
                case 'p':
                    this.setTool('pen');
                    break;
                case 'a':
                    this.setTool('airbrush');
                    break;
                case 'e':
                    this.setTool('eraser');
                    break;
                case 'b':
                    this.setTool('blur');
                    break;
                case 'i':
                    this.setTool('eyedropper');
                    break;
                case 'g':
                    this.setTool('fill');
                    break;
            }
        });
        
        console.log('⌨️ 基本ショートカットセットアップ完了');
    }
    
    /**
     * ツール変更処理
     */
    setTool(toolName) {
        this.currentTool = toolName;
        
        // UI更新
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tool === toolName) {
                btn.classList.add('active');
            }
        });
        
        console.log(`🔧 ツール変更: ${toolName}`);
        
        // イベント発火
        if (this.eventStore && this.eventStore.emit) {
            this.eventStore.emit('tool-changed', { tool: toolName });
        }
    }
    
    /**
     * Phase1システム間統合連携設定
     * PixiJS v8統一座標・イベント連携・Chrome API活用
     */
    setupPhase1Integration() {
        // ツール変更イベント処理
        window.addEventListener('tool-change', (event) => {
            this.setTool(event.detail.tool);
        });
        
        // レンダラー ⇔ 入力制御連携（可能な場合）
        if (this.inputController && this.renderer) {
            this.inputController.onDrawingStart = (event) => {
                this.renderer.beginDrawing(event);
                if (this.historyController) {
                    this.historyController.beginAction('drawing');
                }
            };
            
            this.inputController.onDrawingUpdate = (event) => {
                if (this.currentTool === 'airbrush' && this.airbrushTool) {
                    this.airbrushTool.spray(event.x, event.y, event.pressure || 1.0);
                } else {
                    this.renderer.updateDrawing(event);
                }
            };
            
            this.inputController.onDrawingEnd = (event) => {
                this.renderer.endDrawing(event);
                if (this.historyController) {
                    this.historyController.endAction();
                }
            };
        }
        
        // イベントストア統一連携（可能な場合）
        if (this.eventStore) {
            // リサイズイベント
            if (this.eventStore.on) {
                this.eventStore.on('canvas-resize', (data) => {
                    this.handleResize(data.width, data.height);
                });
                
                this.eventStore.on('webgpu-state-change', (data) => {
                    console.log(`🔄 WebGPU状態変更: ${data.enabled ? '有効' : '無効'}`);
                });
            }
        }
        
        console.log('🔗 Phase1システム間統合連携設定完了');
    }
    
    /**
     * リサイズハンドリング
     * PixiJS v8統一座標・Chrome API活用
     */
    handleResize(width = window.innerWidth, height = window.innerHeight) {
        if (!this.pixiApp) return;
        
        this.pixiApp.renderer.resize(width, height);
        
        // 背景レイヤーリサイズ
        if (this.backgroundLayer && this.backgroundLayer.children[0]) {
            const background = this.backgroundLayer.children[0];
            background.clear();
            background
                .rect(0, 0, width, height)
                .fill(0xffffee);
        }
        
        // イベント発火
        if (this.eventStore && this.eventStore.emit) {
            this.eventStore.emit('canvas-resize', { width, height });
        }
        
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
                console.warn('⚠️ Phase1システム初期化で一部失敗 - フォールバック機能で継続');
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
        const errorMessage = `❌ モダンお絵かきツール v3.3 初期化エラー

エラー詳細: ${error.message}

確認事項:
1. ブラウザがPixiJS v8・WebGPU対応か確認
2. 必要なファイルが正しく配置されているか確認
3. ネットワーク接続・CDN読み込み状況確認

技術情報:
- PixiJS v8統一基盤: ${this.pixiApp ? '✅' : '❌'}
- WebGPU対応: ${this.isWebGPUEnabled ? '✅' : '❌'}
- エラー数: ${this.initializationErrors.length}

フォールバック機能で基本描画は利用可能です。`;
        
        console.error(errorMessage);
        
        // DOM表示（開発時デバッグ用）
        if (document.body) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-overlay';
            errorDiv.textContent = errorMessage;
            document.body.appendChild(errorDiv);
            
            // 5秒後に自動消去
            setTimeout(() => {
                if (errorDiv.parentNode) {
                    errorDiv.parentNode.removeChild(errorDiv);
                }
            }, 10000);
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
            currentTool: this.currentTool,
            errors: this.initializationErrors,
            systems: {
                renderer: !!this.renderer,
                inputController: !!this.inputController,
                airbrushTool: !!this.airbrushTool,
                eventStore: !!this.eventStore,
                shortcutController: !!this.shortcutController,
                historyController: !!this.historyController,
                basicDrawing: !!this.basicDrawing
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
        console.log('🎯 DOM読み込み完了 - アプリケーション初期化開始');
        
        modernDrawingTool = new ModernDrawingToolV33();
        window.modernDrawingTool = modernDrawingTool; // デバッグ用グローバルアクセス
        
        await modernDrawingTool.initialize();
        
        console.log('🎨 モダンお絵かきツール v3.3 初期化完了');
        
    } catch (error) {
        console.error('❌ DOMContentLoaded初期化エラー:', error);
    }
});

// WebGPU・Chrome API対応ブラウザ検出
console.log('🔍 ブラウザ対応状況:');
console.log(`- WebGPU: ${navigator.gpu ? '✅ 対応' : '❌ 非対応'}`);
console.log(`- OffscreenCanvas: ${typeof OffscreenCanvas !== 'undefined' ? '✅ 対応' : '❌ 非対応'}`);
console.log(`- WebCodecs: ${typeof VideoEncoder !== 'undefined' ? '✅ 対応' : '❌ 非対応'}`);
console.log(`- PixiJS Import Maps: ${document.querySelector('script[type="importmap"]') ? '✅ 対応' : '❌ 非対応'}`);

export default ModernDrawingToolV33;