/**
 * 📄 FILE: managers/tool-manager.js
 * 📌 RESPONSIBILITY: ツール管理・ポインタイベント・ActiveTool制御・Manager統一API対応・v8互換版
 * ChangeLog: 2025-08-31 正規表現構文エラー修正・Manager統一API契約対応・Tool登録エラー修正・isReady実装・PointerEvent v8対応
 *
 * @provides
 *   - ToolManager（クラス）
 *   - configure(config): void - 設定注入
 *   - attach(context): void - Context注入（CanvasManager等）
 *   - init(): Promise<void> - 非同期初期化
 *   - isReady(): boolean - 準備完了判定（AppCore依存）
 *   - dispose(): void - 解放処理
 *   - switchTool(toolName): boolean - ツール切替
 *   - getCurrentTool(): AbstractTool - 現在ツール取得
 *   - registerTool(name, toolClass): boolean - ツール登録
 *   - onPointerDown(event): void - ポインタ開始処理
 *   - onPointerMove(event): void - ポインタ移動処理
 *   - onPointerUp(event): void - ポインタ終了処理
 *   - getActiveTool(): AbstractTool - アクティブツール取得（エイリアス）
 *
 * @uses
 *   - CanvasManager.getDrawContainer(): PIXI.Container
 *   - CoordinateManager.screenToCanvas(): Object
 *   - NavigationManager.getCameraBounds(): Rectangle
 *   - RecordManager.startOperation(): void
 *   - EventBus.emit(): void
 *   - AbstractTool.setManagersObject(): boolean
 *   - PenTool.onPointerDown/Move/Up(): void
 *   - EraserTool.onPointerDown/Move/Up(): void
 *
 * @initflow
 *   1. new ToolManager() → 2. configure(config) → 3. attach(context) → 4. init() → 5. registerTools() → 6. isReady()=true
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 Tool間直接依存禁止
 *   🚫 未実装Toolメソッド呼び出し禁止
 *   🚫 Manager直接操作禁止（Tool経由必須）
 *   🚫 PointerEvent座標直読み禁止
 *   🚫 Tool状態の外部操作禁止
 *
 * @manager-key
 *   window.Tegaki.ToolManagerInstance
 *
 * @dependencies-strict
 *   REQUIRED: CanvasManager, CoordinateManager, RecordManager
 *   OPTIONAL: NavigationManager, EventBus
 *   FORBIDDEN: 個別Tool相互依存, 循環依存
 *
 * @integration-flow
 *   AppCore → ToolManager.configure/attach/init → Tools登録 → PointerEvent処理
 *
 * @method-naming-rules
 *   ツール制御系: switchTool(), getCurrentTool(), getActiveTool()
 *   登録系: registerTool(), unregisterTool()
 *   イベント系: onPointerDown(), onPointerMove(), onPointerUp()
 *   ライフサイクル系: configure(), attach(), init(), isReady(), dispose()
 *
 * @error-handling
 *   throw: 初期化失敗・必須Manager不正
 *   false: Tool登録失敗・切替失敗
 *   warn: Tool動作エラー・座標変換失敗
 *
 * @testing-hooks
 *   - getDebugInfo(): Object - 状態・Tool一覧・統計情報
 *   - isReady(): boolean - 準備状態確認
 *   - forceResetTools(): void - 全Tool強制リセット（テスト用）
 */

class ToolManager {
    constructor() {
        console.log('🛠️ ToolManager v8対応版・Manager統一API契約版 作成');
        
        // Manager統一API契約状態
        this._configured = false;
        this._attached = false;
        this._initialized = false;
        
        // Manager参照
        this.canvasManager = null;
        this.coordinateManager = null;
        this.recordManager = null;
        this.navigationManager = null;
        this.eventBus = null;
        
        // Tool管理
        this.tools = new Map(); // toolName → tool instance
        this.activeTool = null;
        this.activeToolName = 'pen'; // デフォルトペン
        
        // ポインタイベント状態
        this.pointerEventsEnabled = false;
        this.currentPointer = null; // 現在のポインタ情報
        
        // 設定
        this.config = {
            defaultTool: 'pen',
            enableMultiTouch: false,
            preventContextMenu: true
        };
        
        // 統計・デバッグ情報
        this.stats = {
            toolSwitches: 0,
            pointerEvents: 0,
            errors: 0,
            lastError: null,
            created: Date.now()
        };
    }
    
    // ================================
    // Manager統一API契約（必須実装）
    // ================================
    
    /**
     * 設定注入（同期）
     * @param {Object} config - 設定オブジェクト
     */
    configure(config = {}) {
        console.log('🛠️ ToolManager: configure() 開始');
        
        try {
            // 設定マージ
            if (config.defaultTool && typeof config.defaultTool === 'string') {
                this.config.defaultTool = config.defaultTool;
            }
            if (config.enableMultiTouch !== undefined) {
                this.config.enableMultiTouch = !!config.enableMultiTouch;
            }
            if (config.preventContextMenu !== undefined) {
                this.config.preventContextMenu = !!config.preventContextMenu;
            }
            
            this._configured = true;
            console.log(`✅ ツール切替成功: ${this.activeToolName} → ${toolName}`);
            return true;
            
        } catch (error) {
            this.stats.lastError = error;
            this.stats.errors++;
            console.error(`❌ ツール切替エラー: ${toolName}`, error);
            return false;
        }
    }
    
    /**
     * 現在ツール取得
     * @returns {AbstractTool|null} 現在のツール
     */
    getCurrentTool() {
        return this.activeTool;
    }
    
    /**
     * アクティブツール取得（エイリアス）
     * @returns {AbstractTool|null} アクティブツール
     */
    getActiveTool() {
        return this.getCurrentTool();
    }
    
    // ================================
    // ポインタイベント処理（v8対応・統一版）
    // ================================
    
    /**
     * ポインタダウン処理
     * @param {PointerEvent} event - ポインタイベント
     */
    onPointerDown(event) {
        try {
            if (!this.isReady() || !this.activeTool) {
                return;
            }
            
            this.stats.pointerEvents++;
            
            // 現在ツールに委譲
            if (typeof this.activeTool.onPointerDown === 'function') {
                this.activeTool.onPointerDown(event);
            }
            
        } catch (error) {
            this.handlePointerError('onPointerDown', error);
        }
    }
    
    /**
     * ポインタムーブ処理
     * @param {PointerEvent} event - ポインタイベント
     */
    onPointerMove(event) {
        try {
            if (!this.isReady() || !this.activeTool) {
                return;
            }
            
            // 現在ツールに委譲
            if (typeof this.activeTool.onPointerMove === 'function') {
                this.activeTool.onPointerMove(event);
            }
            
        } catch (error) {
            this.handlePointerError('onPointerMove', error);
        }
    }
    
    /**
     * ポインタアップ処理
     * @param {PointerEvent} event - ポインタイベント
     */
    onPointerUp(event) {
        try {
            if (!this.isReady() || !this.activeTool) {
                return;
            }
            
            // 現在ツールに委譲
            if (typeof this.activeTool.onPointerUp === 'function') {
                this.activeTool.onPointerUp(event);
            }
            
        } catch (error) {
            this.handlePointerError('onPointerUp', error);
        }
    }
    
    /**
     * ポインタリーブ処理（継続描画修正対応）
     * @param {PointerEvent} event - ポインタイベント
     */
    onPointerLeave(event) {
        try {
            if (!this.isReady() || !this.activeTool) {
                return;
            }
            
            // 現在ツールに委譲
            if (typeof this.activeTool.onPointerLeave === 'function') {
                this.activeTool.onPointerLeave(event);
            }
            
        } catch (error) {
            this.handlePointerError('onPointerLeave', error);
        }
    }
    
    /**
     * ポインタキャンセル処理（継続描画修正対応）
     * @param {PointerEvent} event - ポインタイベント
     */
    onPointerCancel(event) {
        try {
            if (!this.isReady() || !this.activeTool) {
                return;
            }
            
            // 現在ツールに委譲
            if (typeof this.activeTool.onPointerCancel === 'function') {
                this.activeTool.onPointerCancel(event);
            }
            
        } catch (error) {
            this.handlePointerError('onPointerCancel', error);
        }
    }
    
    // ================================
    // ポインタイベント設定（v8対応）
    // ================================
    
    /**
     * ポインタイベント設定
     */
    setupPointerEvents() {
        try {
            if (this.pointerEventsEnabled) {
                return;
            }
            
            const view = this.getCanvasView();
            if (!view) {
                throw new Error('Canvas view not available for pointer events');
            }
            
            // PixiJS v8対応 PointerEvent設定
            const eventOptions = { passive: false };
            
            view.addEventListener('pointerdown', this.onPointerDown.bind(this), eventOptions);
            view.addEventListener('pointermove', this.onPointerMove.bind(this), eventOptions);
            view.addEventListener('pointerup', this.onPointerUp.bind(this), eventOptions);
            view.addEventListener('pointerleave', this.onPointerLeave.bind(this), eventOptions);
            view.addEventListener('pointercancel', this.onPointerCancel.bind(this), eventOptions);
            
            // コンテキストメニュー無効化（設定時）
            if (this.config.preventContextMenu) {
                view.addEventListener('contextmenu', (e) => e.preventDefault(), eventOptions);
            }
            
            this.pointerEventsEnabled = true;
            console.log('✅ ToolManager: ポインタイベント設定完了');
            
        } catch (error) {
            console.error('❌ ポインタイベント設定エラー:', error);
            throw error;
        }
    }
    
    /**
     * ポインタイベント解除
     */
    removePointerEvents() {
        try {
            if (!this.pointerEventsEnabled) {
                return;
            }
            
            const view = this.getCanvasView();
            if (!view) {
                return;
            }
            
            // イベントリスナー解除
            view.removeEventListener('pointerdown', this.onPointerDown.bind(this));
            view.removeEventListener('pointermove', this.onPointerMove.bind(this));
            view.removeEventListener('pointerup', this.onPointerUp.bind(this));
            view.removeEventListener('pointerleave', this.onPointerLeave.bind(this));
            view.removeEventListener('pointercancel', this.onPointerCancel.bind(this));
            
            if (this.config.preventContextMenu) {
                view.removeEventListener('contextmenu', (e) => e.preventDefault());
            }
            
            this.pointerEventsEnabled = false;
            console.log('✅ ToolManager: ポインタイベント解除完了');
            
        } catch (error) {
            console.error('❌ ポインタイベント解除エラー:', error);
        }
    }
    
    // ================================
    // ユーティリティメソッド
    // ================================
    
    /**
     * Canvas View取得
     * @returns {HTMLCanvasElement|null}
     */
    getCanvasView() {
        if (!this.canvasManager) {
            return null;
        }
        
        if (typeof this.canvasManager.getView === 'function') {
            return this.canvasManager.getView();
        } else if (typeof this.canvasManager.getCanvas === 'function') {
            return this.canvasManager.getCanvas();
        } else if (this.canvasManager.app && this.canvasManager.app.view) {
            return this.canvasManager.app.view;
        }
        
        return null;
    }
    
    /**
     * ポインタエラーハンドリング
     * @param {string} context - エラー発生場所
     * @param {Error} error - エラーオブジェクト
     */
    handlePointerError(context, error) {
        this.stats.lastError = error;
        this.stats.errors++;
        
        console.error(`❌ ToolManager ${context} エラー:`, error);
        
        // Tool強制終了
        if (this.activeTool && typeof this.activeTool.forceEndDrawing === 'function') {
            try {
                this.activeTool.forceEndDrawing();
            } catch (resetError) {
                console.error('❌ Tool強制終了失敗:', resetError);
            }
        }
    }
    
    /**
     * ツール名妥当性検証（正規表現修正版）
     * @param {string} toolName - ツール名
     * @returns {boolean} 妥当性
     */
    validateToolName(toolName) {
        if (!toolName || typeof toolName !== 'string') {
            return false;
        }
        
        // ✅ 構文エラー修正: 正規表現の正しい記法
        const validNamePattern = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
        
        return validNamePattern.test(toolName) && toolName.length >= 2 && toolName.length <= 20;
    }
    
    /**
     * 全Tool強制リセット（テスト用）
     */
    forceResetTools() {
        try {
            // 全Tool強制終了
            for (const [name, tool] of this.tools) {
                if (tool && typeof tool.forceEndDrawing === 'function') {
                    tool.forceEndDrawing();
                }
            }
            
            console.log('✅ 全Tool強制リセット完了');
            
        } catch (error) {
            console.error('❌ 全Tool強制リセットエラー:', error);
        }
    }
    
    /**
     * デバッグ情報取得
     * @returns {Object} 状態・Tool一覧・統計情報
     */
    getDebugInfo() {
        const toolsInfo = {};
        for (const [name, tool] of this.tools) {
            toolsInfo[name] = {
                className: tool.constructor.name,
                isActive: tool === this.activeTool,
                hasSetManagersObject: typeof tool.setManagersObject === 'function',
                hasForceEndDrawing: typeof tool.forceEndDrawing === 'function',
                state: tool.getState ? tool.getState() : 'no state method'
            };
        }
        
        return {
            className: 'ToolManager',
            version: 'v8-unified-api-contract-regex-fixed',
            state: {
                configured: this._configured,
                attached: this._attached,
                initialized: this._initialized,
                ready: this.isReady()
            },
            config: { ...this.config },
            stats: { ...this.stats },
            tools: {
                count: this.tools.size,
                registered: Array.from(this.tools.keys()),
                active: this.activeToolName,
                details: toolsInfo
            },
            dependencies: {
                canvasManager: !!this.canvasManager,
                coordinateManager: !!this.coordinateManager,
                recordManager: !!this.recordManager,
                navigationManager: !!this.navigationManager,
                eventBus: !!this.eventBus
            },
            events: {
                enabled: this.pointerEventsEnabled,
                hasCanvasView: !!this.getCanvasView()
            },
            runtime: {
                timestamp: Date.now()
            }
        };
    }
}

// グローバル名前空間に登録
if (!window.Tegaki) window.Tegaki = {};
window.Tegaki.ToolManager = ToolManager;

console.log('🛠️ ToolManager v8対応版・Manager統一API契約版・正規表現修正版 Loaded');
console.log('🚀 特徴: 構文エラー修正・統一API契約・Tool登録管理・PointerEvent v8対応・継続描画修正対応');.log('✅ ToolManager: configure() 完了', this.config);
            
        } catch (error) {
            this.stats.lastError = error;
            this.stats.errors++;
            console.error(`❌ Tool登録エラー (${name}):`, error);
            return false;
        }
    }
    
    /**
     * デフォルトツール初期化
     * @returns {Promise<void>}
     */
    async initializeDefaultTool() {
        try {
            const defaultToolName = this.config.defaultTool;
            
            if (this.tools.has(defaultToolName)) {
                const switchResult = this.switchTool(defaultToolName);
                if (!switchResult) {
                    throw new Error(`Default tool switch failed: ${defaultToolName}`);
                }
            } else {
                // フォールバック: 利用可能な最初のツール
                const availableTools = Array.from(this.tools.keys());
                if (availableTools.length > 0) {
                    const fallbackTool = availableTools[0];
                    console.warn(`⚠️ デフォルトツール(${defaultToolName})なし - ${fallbackTool}使用`);
                    this.switchTool(fallbackTool);
                } else {
                    throw new Error('No tools available');
                }
            }
            
        } catch (error) {
            console.error('❌ デフォルトツール初期化エラー:', error);
            throw error;
        }
    }
    
    // ================================
    // ツール切替・制御
    // ================================
    
    /**
     * ツール切替
     * @param {string} toolName - 切替先ツール名
     * @returns {boolean} 切替成功フラグ
     */
    switchTool(toolName) {
        try {
            if (!toolName || typeof toolName !== 'string') {
                console.error('❌ 無効なツール名:', toolName);
                return false;
            }
            
            // ツール存在確認
            if (!this.tools.has(toolName)) {
                console.error(`❌ ツールが未登録: ${toolName}`);
                console.log('📋 利用可能ツール:', Array.from(this.tools.keys()));
                return false;
            }
            
            const newTool = this.tools.get(toolName);
            if (!newTool) {
                console.error(`❌ ツールインスタンスが無効: ${toolName}`);
                return false;
            }
            
            // 現在ツール無効化
            if (this.activeTool && typeof this.activeTool.deactivate === 'function') {
                this.activeTool.deactivate();
            }
            
            // 新ツール有効化
            this.activeTool = newTool;
            this.activeToolName = toolName;
            
            if (typeof this.activeTool.activate === 'function') {
                this.activeTool.activate();
            }
            
            this.stats.toolSwitches++;
            
            // イベント通知
            if (this.eventBus && typeof this.eventBus.emit === 'function') {
                this.eventBus.emit('tool:switched', {
                    toolName: toolName,
                    timestamp: Date.now()
                });
            }
            
            console
            this.stats.lastError = error;
            console.error('❌ ToolManager: configure() エラー:', error);
            throw error;
        }
    }
    
    /**
     * Context注入（同期）
     * @param {Object} context - Manager群参照
     */
    attach(context) {
        console.log('🛠️ ToolManager: attach() 開始');
        
        try {
            if (!context) {
                throw new Error('Context is null or undefined');
            }
            
            // 必須Manager確認
            const requiredManagers = ['canvasManager', 'coordinateManager', 'recordManager'];
            for (const managerName of requiredManagers) {
                if (!context[managerName]) {
                    throw new Error(`Required manager missing: ${managerName}`);
                }
            }
            
            // Manager参照設定
            this.canvasManager = context.canvasManager;
            this.coordinateManager = context.coordinateManager;
            this.recordManager = context.recordManager;
            
            // オプションManager設定
            this.navigationManager = context.navigationManager || null;
            this.eventBus = context.eventBus || null;
            
            this._attached = true;
            console.log('✅ ToolManager: attach() 完了');
            
        } catch (error) {
            this.stats.lastError = error;
            this.stats.errors++;
            console.error('❌ ToolManager: attach() エラー:', error.message);
            throw error;
        }
    }
    
    /**
     * 非同期初期化
     * @returns {Promise<void>}
     */
    async init() {
        console.log('🛠️ ToolManager: init() 開始');
        
        try {
            if (!this._configured) {
                console.warn('⚠️ ToolManager: 未configure - 自動configure実行');
                this.configure();
            }
            
            if (!this._attached) {
                throw new Error('Not attached - call attach() first');
            }
            
            // Tool群登録
            await this.registerDefaultTools();
            
            // デフォルトツール設定
            await this.initializeDefaultTool();
            
            // ポインタイベント設定
            this.setupPointerEvents();
            
            this._initialized = true;
            console.log('✅ ToolManager: init() 完了');
            
        } catch (error) {
            this.stats.lastError = error;
            this.stats.errors++;
            console.error('❌ ToolManager: init() エラー:', error);
            throw error;
        }
    }
    
    /**
     * 準備完了判定（AppCore依存）
     * @returns {boolean} 準備完了状態
     */
    isReady() {
        return this._configured && this._attached && this._initialized && 
               this.tools.size > 0 && !!this.activeTool;
    }
    
    /**
     * 解放処理
     */
    dispose() {
        console.log('🛠️ ToolManager: dispose() 開始');
        
        // 全Tool解放
        for (const [name, tool] of this.tools) {
            try {
                if (tool && typeof tool.destroy === 'function') {
                    tool.destroy();
                }
            } catch (error) {
                console.error(`❌ Tool解放エラー (${name}):`, error);
            }
        }
        
        // ポインタイベント解除
        this.removePointerEvents();
        
        // 状態リセット
        this.tools.clear();
        this.activeTool = null;
        this.canvasManager = null;
        this.coordinateManager = null;
        this.recordManager = null;
        this.navigationManager = null;
        this.eventBus = null;
        
        this._configured = false;
        this._attached = false;
        this._initialized = false;
        
        console.log('✅ ToolManager: dispose() 完了');
    }
    
    // ================================
    // Tool登録・管理
    // ================================
    
    /**
     * デフォルトツール群登録
     * @returns {Promise<void>}
     */
    async registerDefaultTools() {
        console.log('🛠️ ToolManager: デフォルトツール登録開始');
        
        try {
            // Manager群参照オブジェクト作成
            const managers = {
                canvasManager: this.canvasManager,
                coordinateManager: this.coordinateManager,
                recordManager: this.recordManager,
                navigationManager: this.navigationManager,
                eventBus: this.eventBus
            };
            
            // PenTool登録
            if (window.Tegaki && window.Tegaki.Tools && window.Tegaki.Tools.PenTool) {
                const penTool = new window.Tegaki.Tools.PenTool();
                const penResult = this.registerTool('pen', penTool, managers);
                if (!penResult) {
                    throw new Error('PenTool registration failed');
                }
            } else {
                throw new Error('PenTool class not available');
            }
            
            // EraserTool登録
            if (window.Tegaki && window.Tegaki.Tools && window.Tegaki.Tools.EraserTool) {
                const eraserTool = new window.Tegaki.Tools.EraserTool();
                const eraserResult = this.registerTool('eraser', eraserTool, managers);
                if (!eraserResult) {
                    console.warn('⚠️ EraserTool registration failed - 継続実行');
                }
            } else {
                console.warn('⚠️ EraserTool class not available - 継続実行');
            }
            
            console.log('✅ ToolManager: デフォルトツール登録完了', Array.from(this.tools.keys()));
            
        } catch (error) {
            this.stats.lastError = error;
            this.stats.errors++;
            console.error('❌ ToolManager: デフォルトツール登録エラー:', error);
            throw error;
        }
    }
    
    /**
     * ツール登録
     * @param {string} name - ツール名
     * @param {AbstractTool} toolInstance - ツールインスタンス
     * @param {Object} managers - Manager群参照
     * @returns {boolean} 登録成功フラグ
     */
    registerTool(name, toolInstance, managers = null) {
        try {
            if (!name || typeof name !== 'string') {
                throw new Error('Invalid tool name');
            }
            
            if (!toolInstance) {
                throw new Error('Tool instance is null or undefined');
            }
            
            // Manager注入（toolInstanceにsetManagersObjectがある場合）
            if (typeof toolInstance.setManagersObject === 'function') {
                const managersToInject = managers || {
                    canvasManager: this.canvasManager,
                    coordinateManager: this.coordinateManager,
                    recordManager: this.recordManager,
                    navigationManager: this.navigationManager,
                    eventBus: this.eventBus
                };
                
                const injectResult = toolInstance.setManagersObject(managersToInject);
                if (!injectResult) {
                    throw new Error(`Manager injection failed for tool: ${name}`);
                }
            } else {
                console.warn(`⚠️ Tool ${name}: setManagersObject() method not found`);
            }
            
            // Tool登録
            this.tools.set(name, toolInstance);
            console.log(`✅ Tool登録成功: ${name}`);
            
            return true;
            
        } catch (error) {