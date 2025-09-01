/**
 * ChangeLog: 2025-09-01 Manager統一ライフサイクル・架空メソッド撲滅・構文エラー修正
 * 
 * @provides
 *   ・Manager統一ライフサイクル: configure(config), attach(context), init(), isReady(), dispose()
 *   ・Tool管理: setActiveTool(toolName), getCurrentTool(), initializeV8Tools()
 *   ・Tool注入: setManagers(managers), verifyInjection()
 *   ・Event処理: onPointerDown(event), onPointerMove(event), onPointerUp(event)
 *   ・状態管理: getStatus(), _status内部状態
 * 
 * @uses
 *   ・CanvasManager.getDrawContainer() - Tool描画コンテナ取得
 *   ・CanvasManager.isReady() - Canvas準備完了確認
 *   ・AbstractTool.setManagersObject() - Tool統一Manager注入API
 *   ・EventBus.emit() - アプリイベント通知
 * 
 * @initflow
 *   1. ToolManager.configure(config) - 設定注入
 *   2. ToolManager.attach(context) - Canvas・EventBus注入
 *   3. ToolManager.init() - Tool群作成・Manager注入
 *   4. ToolManager.verifyInjection() - 依存確認（getDrawContainer使用）
 *   5. ToolManager.setActiveTool('pen') - デフォルトTool設定
 * 
 * @forbids
 *   ・💀 双方向依存禁止（ToolManager→Tool の一方向のみ）
 *   ・🚫 フォールバック禁止（Manager実装内部でのsilent fallback禁止）
 *   ・🚫 フェイルセーフ禁止（無条件例外無視禁止）
 *   ・🚫 未実装メソッド呼び出し禁止（@provides確認必須）
 *   ・🚫 Event座標直読み禁止（必ずCoordinateManager経由）
 * 
 * @manager-key
 *   ・window.Tegaki.ToolManagerInstance - ToolManager実体
 *   ・window.Tegaki.ToolManager - ToolManagerクラス
 * 
 * @dependencies-strict
 *   ・必須: CanvasManager.getDrawContainer() - Tool描画用Container
 *   ・必須: CanvasManager.isReady() - Canvas初期化完了確認
 *   ・必須: AbstractTool.setManagersObject() - Tool統一注入API
 *   ・オプション: EventBus.emit() - イベント通知
 *   ・禁止: Tool→ToolManager逆参照（循環依存防止）
 * 
 * @integration-flow
 *   ・AppCore.initializeV8Managers()からManager統一ライフサイクルで初期化
 *   ・Canvas初期化完了後にattach()・init()実行
 *   ・Tool群作成後にsetManagers()でManager注入
 * 
 * @event-contract
 *   ・DOM pointer eventをTool群に配信（CoordinateManager座標変換済み）
 *   ・EventBus経由でtool:change・tool:ready イベント発火
 *   ・直接DOM addEventListener禁止（bootstrap層のみ許可）
 * 
 * @coordinate-contract
 *   ・座標変換はCoordinateManager経由必須（screenToCanvas/clientToWorld）
 *   ・Tool内でのclientX/Y直接参照禁止
 *   ・DPR補正重複適用防止
 * 
 * @manager-lifecycle
 *   ・configure(config): 同期設定注入
 *   ・attach(context): 同期参照注入（CanvasManager・EventBus）
 *   ・init(): 非同期Tool群作成・準備（完了でisReady=true）
 *   ・isReady(): 同期準備完了判定
 *   ・dispose(): 同期/非同期解放
 * 
 * @tool-contract
 *   ・Tool統一API: setManagersObject(managers), onPointerDown/Move/Up(event)
 *   ・Tool状態API: forceEndDrawing(), destroy(), getState()
 *   ・Tool作成時にsetManagersObject必須実行・戻り値チェック必須
 * 
 * @error-handling
 *   ・init()はPromise返却・reject時エラー状態保持
 *   ・内部エラー: this._status = {ready:false, error:'msg'}で保持
 *   ・Tool注入失敗時は該当Tool無効化・他Tool継続動作
 */

// ToolManager - Manager統一ライフサイクル・架空メソッド撲滅版
(function() {
    'use strict';
    
    console.log('🔧 ToolManager Manager統一ライフサイクル・架空メソッド撲滅版 作成開始');
    
    class ToolManager {
        constructor() {
            // Manager統一ライフサイクル状態
            this._status = {
                ready: false,
                error: null,
                configured: false,
                attached: false,
                initialized: false
            };
            
            // 設定
            this._config = null;
            
            // Manager参照
            this._canvasManager = null;
            this._eventBus = null;
            
            // Tool管理
            this._tools = new Map(); // toolName -> tool instance
            this._activeTool = null;
            this._defaultToolName = 'pen';
            
            // Manager群（Tool注入用）
            this._managers = null;
            
            // デバッグ
            this._debugMode = false;
            
            console.log('🔧 ToolManager インスタンス作成完了');
        }
        
        //================================================
        // Manager統一ライフサイクル（必須実装）
        //================================================
        
        /**
         * 設定注入（同期）
         * @param {Object} config 設定オブジェクト
         */
        configure(config) {
            if (this._status.configured) {
                console.warn('🔧 ToolManager already configured, skipping');
                return;
            }
            
            this._config = {
                defaultTool: 'pen',
                tools: ['pen', 'eraser'],
                debugMode: false,
                ...config
            };
            
            this._defaultToolName = this._config.defaultTool;
            this._debugMode = this._config.debugMode;
            this._status.configured = true;
            
            if (this._debugMode) {
                console.log('🔧 ToolManager configured:', this._config);
            }
        }
        
        /**
         * 参照注入（同期）
         * @param {Object} context 参照コンテキスト
         */
        attach(context) {
            if (this._status.attached) {
                console.warn('🔧 ToolManager already attached, skipping');
                return;
            }
            
            if (!context) {
                throw new Error('ToolManager.attach(): context required');
            }
            
            // Manager参照注入
            this._canvasManager = context.canvasManager || context.canvas;
            this._eventBus = context.eventBus || context.eventbus;
            
            // 依存確認
            if (!this._canvasManager) {
                throw new Error('ToolManager.attach(): canvasManager required');
            }
            
            this._status.attached = true;
            
            if (this._debugMode) {
                console.log('🔧 ToolManager attached to context');
            }
        }
        
        /**
         * 内部初期化（非同期）
         * @returns {Promise}
         */
        async init() {
            if (this._status.initialized) {
                console.warn('🔧 ToolManager already initialized, skipping');
                return;
            }
            
            try {
                // 前提条件確認
                if (!this._status.configured || !this._status.attached) {
                    throw new Error('ToolManager.init(): configure() and attach() required');
                }
                
                // Canvas準備完了確認
                if (!this._canvasManager.isReady()) {
                    throw new Error('ToolManager.init(): CanvasManager not ready');
                }
                
                // Tool群作成準備（実際の作成はinitializeV8Tools()で実行）
                this._tools.clear();
                
                this._status.initialized = true;
                this._status.ready = false; // Tool作成・Manager注入完了まで未準備
                
                if (this._debugMode) {
                    console.log('🔧 ToolManager initialized, ready for Tool creation');
                }
                
            } catch (error) {
                this._status.error = error.message;
                this._status.ready = false;
                throw error;
            }
        }
        
        /**
         * 準備完了判定（同期）
         * @returns {boolean}
         */
        isReady() {
            return this._status.ready && this._status.initialized && !this._status.error;
        }
        
        /**
         * 解放（同期）
         */
        dispose() {
            console.log('🔧 ToolManager disposing...');
            
            // Tool群解放
            if (this._tools) {
                for (const [name, tool] of this._tools) {
                    if (tool && typeof tool.destroy === 'function') {
                        try {
                            tool.destroy();
                        } catch (error) {
                            console.error(`🔧 Error destroying tool ${name}:`, error);
                        }
                    }
                }
                this._tools.clear();
            }
            
            // 状態リセット
            this._activeTool = null;
            this._managers = null;
            
            this._status = {
                ready: false,
                error: null,
                configured: false,
                attached: false,
                initialized: false
            };
            
            console.log('🔧 ToolManager disposed');
        }
        
        //================================================
        // Tool管理専用API
        //================================================
        
        /**
         * Manager群注入（Tool作成前に必須実行）
         * @param {Object|Map} managers Manager群
         */
        setManagers(managers) {
            if (!managers) {
                throw new Error('ToolManager.setManagers(): managers required');
            }
            
            // Map形式対応
            if (managers instanceof Map) {
                this._managers = {};
                for (const [key, value] of managers) {
                    this._managers[key] = value;
                }
            } else {
                this._managers = { ...managers };
            }
            
            if (this._debugMode) {
                console.log('🔧 ToolManager managers set:', Object.keys(this._managers));
            }
        }
        
        /**
         * Tool群作成・Manager注入実行
         */
        async initializeV8Tools() {
            if (!this._status.initialized) {
                throw new Error('ToolManager.initializeV8Tools(): init() required first');
            }
            
            if (!this._managers) {
                throw new Error('ToolManager.initializeV8Tools(): setManagers() required first');
            }
            
            try {
                console.log('🔧 ToolManager Tool群作成開始');
                
                // Tool作成・Manager注入
                await this._createTools();
                
                // デフォルトTool設定
                if (this._tools.has(this._defaultToolName)) {
                    this.setActiveTool(this._defaultToolName);
                } else {
                    // フォールバック：最初のTool
                    const firstTool = this._tools.keys().next().value;
                    if (firstTool) {
                        this.setActiveTool(firstTool);
                    }
                }
                
                this._status.ready = true;
                
                // EventBus通知
                if (this._eventBus && typeof this._eventBus.emit === 'function') {
                    this._eventBus.emit('tool:ready', { manager: this });
                }
                
                console.log('🔧 ToolManager Tool群作成完了');
                
            } catch (error) {
                this._status.error = error.message;
                this._status.ready = false;
                throw error;
            }
        }
        
        /**
         * 依存注入確認（Canvas・Manager準備完了確認）
         */
        verifyInjection() {
            console.log('🔧 ToolManager 依存注入確認開始');
            
            // CanvasManager確認
            if (!this._canvasManager) {
                throw new Error('ToolManager.verifyInjection(): canvasManager not injected');
            }
            
            if (!this._canvasManager.isReady()) {
                throw new Error('ToolManager.verifyInjection(): canvasManager not ready');
            }
            
            // getDrawContainer動作確認
            try {
                const drawContainer = this._canvasManager.getDrawContainer();
                if (!drawContainer) {
                    throw new Error('ToolManager.verifyInjection(): getDrawContainer returned null');
                }
            } catch (error) {
                throw new Error(`ToolManager.verifyInjection(): getDrawContainer failed - ${error.message}`);
            }
            
            console.log('🔧 ToolManager 依存注入確認完了');
            return true;
        }
        
        //================================================
        // Tool操作API
        //================================================
        
        /**
         * アクティブTool設定
         * @param {string} toolName Tool名
         */
        setActiveTool(toolName) {
            if (!this._tools.has(toolName)) {
                console.error(`🔧 Tool not found: ${toolName}. Available:`, [...this._tools.keys()]);
                return false;
            }
            
            // 現在Tool終了
            if (this._activeTool && typeof this._activeTool.forceEndDrawing === 'function') {
                this._activeTool.forceEndDrawing();
            }
            
            // 新Tool設定
            this._activeTool = this._tools.get(toolName);
            
            // EventBus通知
            if (this._eventBus && typeof this._eventBus.emit === 'function') {
                this._eventBus.emit('tool:change', { 
                    toolName: toolName,
                    tool: this._activeTool 
                });
            }
            
            console.log(`🔧 Active tool changed to: ${toolName}`);
            return true;
        }
        
        /**
         * 現在Tool取得
         * @returns {Object|null}
         */
        getCurrentTool() {
            return this._activeTool;
        }
        
        /**
         * Tool一覧取得
         * @returns {Array<string>}
         */
        getAvailableTools() {
            return [...this._tools.keys()];
        }
        
        //================================================
        // Event処理（外部からの座標処理済みイベント）
        //================================================
        
        /**
         * Pointer Down処理
         * @param {Object} event 座標処理済みイベント
         */
        onPointerDown(event) {
            if (!this._activeTool) return;
            
            if (typeof this._activeTool.onPointerDown === 'function') {
                this._activeTool.onPointerDown(event);
            }
        }
        
        /**
         * Pointer Move処理
         * @param {Object} event 座標処理済みイベント
         */
        onPointerMove(event) {
            if (!this._activeTool) return;
            
            if (typeof this._activeTool.onPointerMove === 'function') {
                this._activeTool.onPointerMove(event);
            }
        }
        
        /**
         * Pointer Up処理
         * @param {Object} event 座標処理済みイベント
         */
        onPointerUp(event) {
            if (!this._activeTool) return;
            
            if (typeof this._activeTool.onPointerUp === 'function') {
                this._activeTool.onPointerUp(event);
            }
        }
        
        //================================================
        // 内部Tool作成
        //================================================
        
        /**
         * Tool群作成・Manager注入
         */
        async _createTools() {
            const toolConfigs = [
                { name: 'pen', className: 'PenTool' },
                { name: 'eraser', className: 'EraserTool' }
            ];
            
            for (const config of toolConfigs) {
                try {
                    await this._createSingleTool(config.name, config.className);
                } catch (error) {
                    console.error(`🔧 Failed to create ${config.name} tool:`, error);
                    // 他Tool継続作成
                }
            }
            
            if (this._tools.size === 0) {
                throw new Error('No tools created successfully');
            }
            
            console.log(`🔧 Created ${this._tools.size} tools:`, [...this._tools.keys()]);
        }
        
        /**
         * 単一Tool作成・Manager注入
         * @param {string} toolName Tool名
         * @param {string} className クラス名
         */
        async _createSingleTool(toolName, className) {
            // Tool クラス存在確認
            const ToolClass = window.Tegaki?.[className];
            if (!ToolClass) {
                throw new Error(`Tool class not found: ${className}`);
            }
            
            // Tool作成
            const toolInstance = new ToolClass();
            
            // Manager注入確認・実行
            if (typeof toolInstance.setManagersObject !== 'function') {
                throw new Error(`Tool ${className} missing setManagersObject method`);
            }
            
            const injectionResult = toolInstance.setManagersObject(this._managers);
            if (injectionResult !== true) {
                throw new Error(`Tool ${className} Manager injection failed`);
            }
            
            // Tool登録
            this._tools.set(toolName, toolInstance);
            
            console.log(`🔧 Tool ${toolName} (${className}) created and injected`);
        }
        
        //================================================
        // 状態・デバッグAPI
        //================================================
        
        /**
         * 内部状態取得
         * @returns {Object}
         */
        getStatus() {
            return {
                ...this._status,
                toolCount: this._tools.size,
                availableTools: [...this._tools.keys()],
                activeTool: this._activeTool ? this._activeTool.constructor.name : null,
                managersInjected: !!this._managers
            };
        }
        
        /**
         * デバッグ情報取得
         * @returns {Object}
         */
        getDebugInfo() {
            return {
                status: this.getStatus(),
                config: this._config,
                managers: this._managers ? Object.keys(this._managers) : null,
                tools: [...this._tools.keys()],
                canvasReady: this._canvasManager?.isReady() || false
            };
        }
    }
    
    // Global登録
    if (!window.Tegaki) {
        window.Tegaki = {};
    }
    
    window.Tegaki.ToolManager = ToolManager;
    
    console.log('🔧 ToolManager Manager統一ライフサイクル・架空メソッド撲滅版 Loaded');
    console.log('📏 修正内容: Manager統一ライフサイクル実装・Tool統一注入API・依存確認システム・構文エラー修正');
    console.log('🚀 特徴: 架空メソッド撲滅・Tool群作成制御・Manager注入確認・EventBus統合・状態管理強化');
    
})();