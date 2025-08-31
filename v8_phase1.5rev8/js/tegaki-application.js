/**
 * TegakiApplication v8 シングルトン・二重初期化防止版
 * ChangeLog: 2025-09-01 シングルトンパターン実装・二重初期化完全防止
 * 
 * @provides
 *   ・TegakiApplication.getInstance() - シングルトンアクセス
 *   ・アプリケーション統合初期化（initialize）
 *   ・Canvas DOM挿入制御（insertCanvasToDOM）
 *   ・ポインターイベント設定（setupPointerEvents）
 *   ・AppCore初期化委譲（initializeV8Managers）
 * 
 * @uses
 *   ・AppCore.initializeV8Managers() - Manager群初期化
 *   ・CanvasManager.getApplication() - PixiJS Application取得
 *   ・ToolManager.handlePointer*() - 描画イベント中継
 * 
 * @initflow
 *   1. TegakiApplication.getInstance() - 単一インスタンス取得
 *   2. initialize() - 初期化実行（二重実行防止）
 *   3. AppCore作成・Canvas作成
 *   4. Canvas DOM挿入
 *   5. ポインターイベント設定
 *   6. AppCore Manager群初期化委譲
 *   7. EventBus 'app:ready' イベント発火
 * 
 * @forbids
 *   ・💀 複数インスタンス作成禁止（シングルトン）
 *   ・🚫 initialize()二重実行禁止
 *   ・🚫 AppCore複数作成禁止
 * 
 * @integration-flow
 *   ・Bootstrap.initializeTegakiApplication()から呼び出し
 *   ・全体アプリケーションの単一エントリーポイント
 * 
 * @error-handling
 *   ・初期化エラー時は状態記録し例外投げる
 *   ・Manager初期化エラーは詳細ログ出力
 */

class TegakiApplication {
    constructor() {
        // シングルトン制御
        if (TegakiApplication._instance) {
            console.warn('⚠️ TegakiApplication: シングルトンインスタンス既存 - 既存を返却');
            return TegakiApplication._instance;
        }
        
        console.log('🚀 TegakiApplication v8 シングルトン・二重初期化防止版 作成開始');
        
        this.version = 'v8-singleton-fix';
        this.className = 'TegakiApplication';
        
        // 初期化状態管理
        this._initialized = false;
        this._initInProgress = false;
        this._initializationSteps = [];
        
        // コアコンポーネント
        this.appCore = null;
        this.pixiApp = null;
        this.htmlCanvas = null;
        
        // 設定
        this.config = {
            canvasSize: { width: 400, height: 400 },
            pixiOptions: {
                width: 400,
                height: 400,
                backgroundColor: 0xf0e0d6,
                antialias: true,
                resolution: window.devicePixelRatio || 1
            }
        };
        
        // シングルトン登録
        TegakiApplication._instance = this;
        
        console.log('✅ TegakiApplication シングルトンインスタンス作成完了');
    }
    
    /**
     * シングルトンインスタンス取得
     * @returns {TegakiApplication} 単一インスタンス
     */
    static getInstance() {
        if (!TegakiApplication._instance) {
            TegakiApplication._instance = new TegakiApplication();
        }
        return TegakiApplication._instance;
    }
    
    /**
     * インスタンス存在確認
     * @returns {boolean} インスタンス存在可否
     */
    static hasInstance() {
        return !!TegakiApplication._instance;
    }
    
    /**
     * シングルトンリセット（テスト用）
     */
    static resetInstance() {
        if (TegakiApplication._instance) {
            TegakiApplication._instance.dispose();
            TegakiApplication._instance = null;
        }
    }
    
    // ===========================================
    // 初期化制御（二重実行防止）
    // ===========================================
    
    /**
     * アプリケーション初期化（二重実行防止版）
     * @returns {Promise<void>}
     */
    async initialize() {
        // 二重実行防止
        if (this._initialized) {
            console.log('✅ TegakiApplication: 既に初期化済み');
            return;
        }
        
        if (this._initInProgress) {
            console.warn('⚠️ TegakiApplication: 初期化実行中 - 待機');
            return;
        }
        
        this._initInProgress = true;
        
        try {
            console.log('🚀 TegakiApplication 初期化開始');
            
            // ステップ1: AppCore作成
            await this.createAppCore();
            this._initializationSteps.push('AppCore作成');
            
            // ステップ2: Canvas作成
            await this.createCanvas();
            this._initializationSteps.push('Canvas作成');
            
            // ステップ3: Canvas DOM挿入
            await this.insertCanvasToDOM();
            this._initializationSteps.push('Canvas DOM挿入');
            
            // ステップ4: ポインターイベント設定
            await this.setupPointerEvents();
            this._initializationSteps.push('ポインターイベント設定');
            
            // ステップ5: Manager群初期化（AppCore委譲）
            await this.initializeV8Managers();
            this._initializationSteps.push('Manager群初期化');
            
            // ステップ6: 最終準備
            await this.finalizeInitialization();
            this._initializationSteps.push('最終化完了');
            
            // 初期化完了
            this._initialized = true;
            
            console.log('🎉 TegakiApplication 初期化完了');
            console.log('📋 実行ステップ:', this._initializationSteps);
            
        } catch (error) {
            console.error('💀 初期化エラー:', error);
            console.error('🔍 失敗ステップ:', this._initializationSteps);
            console.error('🔍 AppCore状態:', this.appCore?.getSystemStatus());
            
            this._initialized = false;
            throw error;
            
        } finally {
            this._initInProgress = false;
        }
    }
    
    // ===========================================
    // 初期化ステップ
    // ===========================================
    
    /**
     * AppCore作成
     */
    async createAppCore() {
        try {
            if (this.appCore) {
                console.warn('⚠️ AppCore 既存 - スキップ');
                return;
            }
            
            this.appCore = new window.Tegaki.AppCore();
            window.Tegaki.AppCore = this.appCore; // グローバル参照
            
            console.log('✅ AppCore作成完了');
            
        } catch (error) {
            console.error('💀 AppCore作成失敗:', error);
            throw error;
        }
    }
    
    /**
     * Canvas作成
     */
    async createCanvas() {
        try {
            // PixiJS Application作成（一時的）
            const tempApp = new PIXI.Application(this.config.pixiOptions);
            await tempApp.init(this.config.pixiOptions);
            
            this.pixiApp = tempApp;
            this.htmlCanvas = tempApp.canvas;
            
            console.log('✅ Canvas作成完了', `(${this.config.canvasSize.width}x${this.config.canvasSize.height})`);
            
        } catch (error) {
            console.error('💀 Canvas作成失敗:', error);
            throw error;
        }
    }
    
    /**
     * Canvas DOM挿入
     */
    async insertCanvasToDOM() {
        console.log('🎨 Canvas DOM挿入開始');
        
        try {
            const canvasContainer = document.getElementById('canvas-container');
            if (!canvasContainer) {
                throw new Error('canvas-container not found');
            }
            
            // 既存Canvas除去
            const existingCanvases = canvasContainer.querySelectorAll('canvas');
            existingCanvases.forEach(canvas => canvas.remove());
            
            // 新Canvas挿入
            if (this.htmlCanvas && this.htmlCanvas.parentNode !== canvasContainer) {
                canvasContainer.appendChild(this.htmlCanvas);
                
                // Canvas スタイル設定
                this.htmlCanvas.style.cssText = 'display: block; border: none; outline: none; user-select: none; touch-action: none;';
                this.htmlCanvas.tabIndex = -1; // フォーカス無効
            }
            
            console.log('✅ Canvas DOM挿入完了');
            
        } catch (error) {
            console.error('💀 Canvas DOM挿入失敗:', error);
            throw error;
        }
    }
    
    /**
     * ポインターイベント設定
     */
    async setupPointerEvents() {
        try {
            if (!this.htmlCanvas) {
                throw new Error('Canvas not available for pointer events');
            }
            
            // イベントオプション
            const eventOptions = { passive: false, capture: false };
            
            // ポインターイベント設定（一時的・ToolManager初期化後に委譲）
            const tempPointerHandler = (event) => {
                event.preventDefault();
                // ToolManager準備後にイベント委譲
                if (window.Tegaki.ToolManagerInstance) {
                    const toolManager = window.Tegaki.ToolManagerInstance;
                    if (event.type === 'pointerdown' && toolManager.handlePointerDown) {
                        toolManager.handlePointerDown(event);
                    } else if (event.type === 'pointermove' && toolManager.handlePointerMove) {
                        toolManager.handlePointerMove(event);
                    } else if (event.type === 'pointerup' && toolManager.handlePointerUp) {
                        toolManager.handlePointerUp(event);
                    }
                }
            };
            
            this.htmlCanvas.addEventListener('pointerdown', tempPointerHandler, eventOptions);
            this.htmlCanvas.addEventListener('pointermove', tempPointerHandler, eventOptions);
            this.htmlCanvas.addEventListener('pointerup', tempPointerHandler, eventOptions);
            
            console.log('✅ ポインターイベント設定完了');
            
        } catch (error) {
            console.error('💀 ポインターイベント設定失敗:', error);
            throw error;
        }
    }
    
    /**
     * Manager群初期化（AppCore委譲）
     */
    async initializeV8Managers() {
        console.log('🔧 Manager群初期化開始（AppCore委譲）');
        
        try {
            if (!this.appCore) {
                throw new Error('AppCore not created');
            }
            
            // Context作成
            const context = {
                pixiApp: this.pixiApp,
                htmlCanvas: this.htmlCanvas,
                canvasContainer: document.getElementById('canvas-container')
            };
            
            // AppCore初期化委譲
            await this.appCore.initializeV8Managers(context, this.config);
            
            console.log('✅ Manager群初期化完了（AppCore委譲）');
            
        } catch (error) {
            console.error('💀 Manager初期化エラー:', error);
            console.error('🔍 AppCore状態:', this.appCore?.getSystemStatus());
            throw error;
        }
    }
    
    /**
     * 最終化処理
     */
    async finalizeInitialization() {
        try {
            // EventBus 'app:ready' イベント発火
            const eventBus = this.appCore?.getManager('eventBus');
            if (eventBus && typeof eventBus.emit === 'function') {
                eventBus.emit('app:ready', {
                    version: this.version,
                    timestamp: Date.now(),
                    managers: this.appCore.getAllManagers()
                });
                console.log('📡 app:ready イベント発火完了');
            }
            
            // グローバル参照更新
            window.Tegaki.app = this;
            window.Tegaki.appCore = this.appCore;
            
            console.log('✅ 最終化処理完了');
            
        } catch (error) {
            console.error('💀 最終化処理失敗:', error);
            // 最終化失敗は警告に留め、初期化成功とする
        }
    }
    
    // ===========================================
    // 状態管理・制御
    // ===========================================
    
    /**
     * 初期化済み判定
     * @returns {boolean} 初期化完了可否
     */
    isInitialized() {
        return this._initialized && this.appCore?.isInitialized();
    }
    
    /**
     * アプリケーション状態取得
     * @returns {Object} アプリケーション状態
     */
    getStatus() {
        return {
            className: this.className,
            version: this.version,
            initialized: this.isInitialized(),
            initInProgress: this._initInProgress,
            initSteps: [...this._initializationSteps],
            appCoreReady: this.appCore?.isInitialized() || false,
            canvasReady: !!(this.pixiApp && this.htmlCanvas),
            managers: this.appCore?.getAllManagers() || new Map()
        };
    }
    
    /**
     * Manager取得
     * @param {string} managerName - Manager名
     * @returns {Object|null} Manager実装
     */
    getManager(managerName) {
        return this.appCore?.getManager(managerName) || null;
    }
    
    /**
     * PixiJS Application取得
     * @returns {PIXI.Application|null} PixiJS Application
     */
    getPixiApplication() {
        return this.pixiApp;
    }
    
    /**
     * HTML Canvas要素取得
     * @returns {HTMLCanvasElement|null} Canvas要素
     */
    getCanvasElement() {
        return this.htmlCanvas;
    }
    
    /**
     * アプリケーション解放
     */
    dispose() {
        try {
            // Manager群解放
            if (this.appCore) {
                const managers = this.appCore.getAllManagers();
                for (const [name, manager] of managers) {
                    if (manager && typeof manager.dispose === 'function') {
                        manager.dispose();
                    }
                }
            }
            
            // PixiJS Application解放
            if (this.pixiApp) {
                this.pixiApp.destroy(true);
                this.pixiApp = null;
            }
            
            // Canvas DOM除去
            if (this.htmlCanvas && this.htmlCanvas.parentNode) {
                this.htmlCanvas.parentNode.removeChild(this.htmlCanvas);
                this.htmlCanvas = null;
            }
            
            // 状態リセット
            this.appCore = null;
            this._initialized = false;
            this._initInProgress = false;
            this._initializationSteps = [];
            
            console.log('✅ TegakiApplication 解放完了');
            
        } catch (error) {
            console.error('💀 TegakiApplication 解放エラー:', error);
        }
    }
}

// 静的プロパティ初期化
TegakiApplication._instance = null;

// グローバル登録
window.Tegaki = window.Tegaki || {};
window.Tegaki.TegakiApplication = TegakiApplication;

console.log('🚀 TegakiApplication v8 シングルトン・二重初期化防止版 Loaded');
console.log('📏 修正内容: シングルトンパターン実装・二重初期化完全防止・AppCore完全委譲・状態管理強化');
console.log('🚀 特徴: 単一インスタンス保証・初期化フロー制御・Manager群統合管理・エラーハンドリング強化');
console.log('🎯 使用方法: TegakiApplication.getInstance().initialize() でシングルトン初期化');