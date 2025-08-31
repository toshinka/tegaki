/**
 * 📄 FILE: managers/tool-manager.js
 * 📌 RESPONSIBILITY: Tool管理・切り替え・Manager統一注入・操作フロー管理・Pointerイベント処理
 * ChangeLog: 2025-09-01 <isReady()修正・setActiveTool()追加・準備状態問題完全解決>
 *
 * @provides
 *   - ToolManager クラス
 *   - configure(config): void
 *   - attach(context): void  
 *   - init(): Promise<void>
 *   - isReady(): boolean
 *   - dispose(): void
 *   - switchTool(toolName): Promise<boolean>
 *   - setActiveTool(toolName): Promise<boolean>
 *   - getCurrentTool(): AbstractTool
 *   - getTools(): Map<string, AbstractTool>
 *   - initializeV8Tools(): Promise<boolean>
 *   - registerTool(name, toolClass): void
 *   - setManagers(managers): boolean
 *   - setManagersObject(managers): boolean
 *   - verifyInjection(): void
 *   - onPointerDown(event): void
 *   - onPointerMove(event): void
 *   - onPointerUp(event): void
 *
 * @uses
 *   - CanvasManager.getDrawContainer(): PIXI.Container
 *   - AbstractTool.setManagersObject(managers): boolean
 *   - AbstractTool.activate(): void
 *   - AbstractTool.deactivate(): void
 *   - AbstractTool.onPointerDown(event): void
 *   - AbstractTool.onPointerMove(event): void
 *   - AbstractTool.onPointerUp(event): void
 *   - PenTool constructor
 *   - EraserTool constructor
 *
 * @initflow
 *   1. configure(config) → 2. attach(context) → 3. init() → 4. setManagers(managers) 
 *   → 5. verifyInjection() → 6. initializeV8Tools() → 7. setActiveTool(toolName)
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 フォールバック禁止（明示的なグレースフルダウングレードは許容）
 *   🚫 フェイルセーフ禁止（明示的なエラーハンドリングは許容）
 *   🚫 v7/v8二重管理禁止
 *   🚫 未実装メソッド呼び出し禁止
 *
 * @manager-key
 *   window.Tegaki.ToolManagerInstance
 *
 * @dependencies-strict
 *   REQUIRED: CanvasManager (getDrawContainer必須)
 *   OPTIONAL: EventBus, RecordManager, ConfigManager
 *   FORBIDDEN: 他ToolManager、循環依存
 *
 * @integration-flow
 *   AppCore.initializeV8Managers() → ToolManager.setManagers() → verifyInjection() 
 *   → initializeV8Tools() → Tool.setManagersObject() → Tool.activate()
 *
 * @method-naming-rules
 *   ライフサイクル: configure/attach/init/isReady/dispose
 *   Tool操作: setActiveTool(), switchTool()  
 *   イベント処理: onPointerDown/Move/Up()
 *   Manager管理: setManagers(), verifyInjection()
 *
 * @event-contract
 *   1. EventBus経由でアプリ内イベントをやり取り
 *   2. onPointerDown/Move/Up は原始イベントを受け取りToolに転送
 *   3. 座標変換はTool側でCoordinateManager経由で実行
 *
 * @coordinate-contract
 *   座標変換処理はTool側に委譲・ToolManagerでは直接座標操作しない
 *   CoordinateManagerの準備状態確認はTool側で実行
 *
 * @error-handling
 *   init()はPromiseを返し、エラーはreject
 *   内部エラーはthis._status = {ready:false, error: 'msg'}として保持
 *   getStatus()を提供してAppCoreがエラー集約
 *
 * @testing-hooks
 *   init/testInit()等のテスト用フックを公開
 *   強制初期化・終了がテストで可能
 *
 * @state-management
 *   状態フィールドは必ずgetter/setter経由で変更
 *   直接書き換え禁止・Tool切り替え状態の一貫管理
 *
 * @performance-notes
 *   pointermoveハンドラでは重い処理を避ける
 *   Tool切り替えは最小限の処理で高速化
 *
 * @input-validation
 *   外部入力は常に型チェックを行う
 *   Tool名・Manager群の妥当性確認
 *
 * @tool-contract
 *   Toolは以下を実装必須:
 *   - setManagersObject(managers) -> boolean
 *   - onPointerDown/Move/Up(origEvent)
 *   - activate(), deactivate()
 *   - forceEndDrawing(), destroy(), getState()
 */

(function() {
    'use strict';

    /**
     * 🔧 ToolManager v8.12.0完全修正版 - isReady()修正・setActiveTool()追加・準備状態問題完全解決
     * 
     * 📏 修正内容:
     * - isReady()メソッド完全修正（Manager統合準備状態ロジック）
     * - setActiveTool()メソッド追加（AppCore/TegakiApplication連携用）
     * - Manager統一ライフサイクル実装（configure/attach/init/dispose）
     * - _status内部状態管理・エラーハンドリング強化
     * - Tool準備状態検証強化・依存注入完全対応
     * 
     * 🚀 特徴:
     * - Manager統一API完全準拠
     * - Tool切り替えエラー完全解決
     * - 防御的状態管理・確実な初期化フロー
     * - AppCore初期化エラー完全解決対応
     */
    class ToolManager {
        constructor() {
            console.log(`🚀 ToolManager v8.12.0完全修正版 作成開始`);
            
            // Manager統一ライフサイクル状態管理
            this._status = {
                ready: false,
                error: null,
                initialized: false,
                configured: false,
                attached: false
            };
            
            // 基本状態初期化
            this.canvasManager = null;
            this.tools = new Map();
            this.currentTool = null;
            this.currentToolName = 'pen';
            
            // Manager統一注入用
            this.managers = null;
            this.managersObject = null;
            this.drawContainer = null;
            
            // 設定・Context
            this.config = null;
            this.context = null;
            
            // v8対応状態
            this.v8Ready = false;
            this.webGPUSupported = false;
            
            // Pointerイベント状態管理
            this.isPointerDown = false;
            this.lastPointerPosition = { x: 0, y: 0 };
            
            console.log(`✅ ToolManager v8.12.0完全修正版 作成完了`);
        }

        // ========================================
        // Manager統一ライフサイクル（必須実装）
        // ========================================
        
        /**
         * ポインターアップ処理
         * @param {Object} event - ポインターイベント {x, y, originalEvent}
         */
        onPointerUp(event) {
            if (!this.currentTool) {
                return;
            }

            try {
                this.isPointerDown = false;
                this.lastPointerPosition = { x: event.x, y: event.y };

                if (typeof this.currentTool.onPointerUp === 'function') {
                    this.currentTool.onPointerUp(event);
                }

            } catch (error) {
                console.error('❌ ToolManager.onPointerUp処理エラー:', error);
            }
        }

        // ========================================
        // 公開API・互換性メソッド
        // ========================================

        /**
         * 現在のTool取得
         * @returns {AbstractTool|null} 現在のTool
         */
        getCurrentTool() {
            return this.currentTool;
        }

        /**
         * 現在のTool名取得
         * @returns {string} 現在のTool名
         */
        getCurrentToolName() {
            return this.currentToolName;
        }

        /**
         * Tool一覧取得
         * @returns {Map<string, AbstractTool>} Tool一覧
         */
        getTools() {
            return this.tools;
        }

        /**
         * Tool登録
         * @param {string} name - Tool名
         * @param {Function} toolClass - Toolクラス
         */
        registerTool(name, toolClass) {
            console.log(`📝 Tool登録: ${name}`);
            this.tools.set(name, toolClass);
        }

        /**
         * 描画Container取得
         * @returns {PIXI.Container|null} 描画Container
         */
        getDrawContainer() {
            return this.drawContainer;
        }

        /**
         * Tool設定更新
         * @param {string} toolName - Tool名
         * @param {Object} settings - 設定オブジェクト
         */
        updateToolSettings(toolName, settings) {
            const tool = this.tools.get(toolName);
            if (tool && typeof tool.updateSettings === 'function') {
                tool.updateSettings(settings);
                console.log(`🔧 Tool設定更新: ${toolName}`, settings);
            }
        }

        /**
         * 全Tool強制終了
         */
        forceEndAllDrawing() {
            for (const [name, tool] of this.tools) {
                if (tool && typeof tool.forceEndDrawing === 'function') {
                    tool.forceEndDrawing();
                }
            }
        }

        /**
         * Tool状態取得
         * @returns {Object} 詳細状態情報
         */
        getState() {
            const toolInfo = {};
            for (const [name, tool] of this.tools) {
                toolInfo[name] = {
                    isActive: tool.isActive || false,
                    isReady: tool.isReady ? tool.isReady() : false,
                    state: tool.getState ? tool.getState() : 'unavailable'
                };
            }
            
            return {
                className: 'ToolManager',
                version: 'v8.12.0-isReady-fix',
                lifecycle: {
                    configured: this._status.configured,
                    attached: this._status.attached,
                    initialized: this._status.initialized,
                    ready: this._status.ready
                },
                currentTool: this.currentToolName,
                toolCount: this.tools.size,
                v8Ready: this.v8Ready,
                webGPUSupported: this.webGPUSupported,
                managers: {
                    injected: !!this.managersObject,
                    canvasManager: !!this.canvasManager,
                    drawContainer: !!this.drawContainer
                },
                tools: toolInfo,
                pointerState: {
                    isPointerDown: this.isPointerDown,
                    lastPosition: this.lastPointerPosition
                },
                error: this._status.error
            };
        }

        /**
         * デバッグ情報取得
         * @returns {Object} デバッグ情報
         */
        getDebugInfo() {
            return {
                ...this.getState(),
                managersObject: this.managersObject ? Object.keys(this.managersObject) : null,
                managersMap: this.managers ? Array.from(this.managers.keys()) : null,
                drawContainerChildren: this.drawContainer ? this.drawContainer.children.length : null,
                injectionVerified: !!(this.canvasManager && this.drawContainer && this.managersObject)
            };
        }

        // ========================================
        // 互換性メソッド・テスト用フック
        // ========================================

        /**
         * Manager登録情報設定（互換性メソッド）
         * @param {Object} managers - Manager登録情報
         */
        setManagerRegistrationInfo(managers) {
            console.log(`✅ ToolManager: Manager統一登録情報設定完了（互換性メソッド）`);
            this.managerRegistrationInfo = managers;
        }

        /**
         * DrawContainer初期化（互換性メソッド）
         */
        initializeDrawContainer() {
            if (this.canvasManager && typeof this.canvasManager.getDrawContainer === 'function' && !this.drawContainer) {
                try {
                    this.drawContainer = this.canvasManager.getDrawContainer();
                    console.log(`✅ DrawContainer初期化完了（互換性メソッド）`);
                } catch (error) {
                    console.warn(`⚠️ DrawContainer初期化失敗:`, error.message);
                }
            }
        }

        /**
         * 後方互換ポインター処理
         */
        handlePointerDown(x, y, event) {
            return this.onPointerDown({ x, y, originalEvent: event });
        }

        handlePointerMove(x, y, event) {
            return this.onPointerMove({ x, y, originalEvent: event });
        }

        handlePointerUp(x, y, event) {
            return this.onPointerUp({ x, y, originalEvent: event });
        }

        /**
         * テスト用初期化フック
         * @returns {Promise<boolean>} テスト初期化成功フラグ
         */
        async testInit() {
            try {
                console.log(`🧪 ToolManager: testInit() 開始`);
                
                // 基本的な初期化を実行
                await this.init();
                
                // テスト用のダミーManager作成
                const dummyManagers = {
                    canvas: {
                        getDrawContainer: () => ({
                            addChild: () => {},
                            removeChild: () => {},
                            children: []
                        })
                    },
                    coordinate: {
                        isReady: () => true,
                        clientToWorld: (x, y) => ({ x, y })
                    },
                    record: {
                        addStroke: () => true
                    }
                };
                
                this.setManagers(dummyManagers);
                this.verifyInjection();
                
                console.log(`✅ ToolManager: testInit() 完了`);
                return true;
                
            } catch (error) {
                console.error(`❌ ToolManager: testInit() 失敗:`, error);
                return false;
            }
        }

        /**
         * 強制終了・クリーンアップ（テスト用）
         */
        forceCleanup() {
            try {
                this.forceEndAllDrawing();
                this.dispose();
                console.log(`✅ ToolManager: 強制クリーンアップ完了`);
            } catch (error) {
                console.error(`❌ ToolManager: 強制クリーンアップ失敗:`, error);
            }
        }
    }

    // グローバル登録
    if (!window.Tegaki) {
        window.Tegaki = {};
    }

    window.Tegaki.ToolManager = ToolManager;
    console.log(`🚀 ToolManager v8.12.0完全修正版 Loaded - isReady()修正・setActiveTool()追加・準備状態問題完全解決`);
    console.log(`📏 修正内容: isReady()メソッド完全修正・setActiveTool()メソッド追加・Manager統一ライフサイクル実装・_status内部状態管理・Tool準備状態検証強化`);
    console.log(`🚀 特徴: Manager統一API完全準拠・Tool切り替えエラー完全解決・防御的状態管理・AppCore初期化エラー完全解決対応`);

})();
        /**
         * 設定注入（同期）
         * @param {Object} config - 設定オブジェクト
         */
        configure(config) {
            try {
                console.log(`🔧 ToolManager: configure() 開始`);
                
                this.config = config || {};
                this._status.configured = true;
                this._status.error = null;
                
                console.log(`✅ ToolManager: configure() 完了`);
                
            } catch (error) {
                this._status.configured = false;
                this._status.error = `Configure failed: ${error.message}`;
                console.error(`❌ ToolManager: configure() 失敗:`, error);
                throw error;
            }
        }
        
        /**
         * Context注入（同期）
         * @param {Object} context - Pixi Application/app.view/stage等の参照
         */
        attach(context) {
            try {
                console.log(`🔧 ToolManager: attach() 開始`);
                
                this.context = context || {};
                this._status.attached = true;
                this._status.error = null;
                
                console.log(`✅ ToolManager: attach() 完了`);
                
            } catch (error) {
                this._status.attached = false;
                this._status.error = `Attach failed: ${error.message}`;
                console.error(`❌ ToolManager: attach() 失敗:`, error);
                throw error;
            }
        }
        
        /**
         * 内部初期化（非同期可能）
         * @returns {Promise<void>}
         */
        async init() {
            try {
                console.log(`🚀 ToolManager: init() 開始`);
                
                if (!this._status.configured) {
                    throw new Error(`ToolManager not configured - call configure() first`);
                }
                
                if (!this._status.attached) {
                    throw new Error(`ToolManager not attached - call attach() first`);
                }
                
                // 基本初期化
                this.tools.clear();
                this.currentTool = null;
                this.currentToolName = 'pen';
                
                // WebGPU対応状況確認
                this.webGPUSupported = !!(window.PIXI && window.PIXI.Graphics);
                
                // 初期化完了
                this._status.initialized = true;
                this._status.error = null;
                
                console.log(`✅ ToolManager: init() 完了`);
                
            } catch (error) {
                this._status.initialized = false;
                this._status.ready = false;
                this._status.error = `Init failed: ${error.message}`;
                console.error(`❌ ToolManager: init() 失敗:`, error);
                throw error;
            }
        }
        
        /**
         * 準備完了判定（同期）
         * @returns {boolean} 準備完了状態
         */
        isReady() {
            try {
                // 基本ライフサイクル確認
                const lifecycleReady = this._status.configured && 
                                     this._status.attached && 
                                     this._status.initialized;
                
                if (!lifecycleReady) {
                    return false;
                }
                
                // Manager注入確認
                const managersReady = !!(this.managersObject && this.canvasManager);
                
                // DrawContainer確認
                const drawContainerReady = !!(this.drawContainer);
                
                // Tool基本確認
                const toolsReady = this.tools.size > 0;
                const currentToolReady = !!(this.currentTool);
                
                // 総合判定
                const overallReady = managersReady && drawContainerReady && toolsReady && currentToolReady;
                
                // 状態更新
                this._status.ready = overallReady;
                
                return overallReady;
                
            } catch (error) {
                console.error(`❌ ToolManager.isReady() エラー:`, error);
                this._status.ready = false;
                this._status.error = `isReady check failed: ${error.message}`;
                return false;
            }
        }
        
        /**
         * 解放処理（同期）
         */
        dispose() {
            try {
                console.log(`🔧 ToolManager: dispose() 開始`);
                
                // 現在のTool無効化
                if (this.currentTool && typeof this.currentTool.deactivate === 'function') {
                    this.currentTool.deactivate();
                }
                
                // 全Tool破棄
                for (const [name, tool] of this.tools) {
                    if (tool && typeof tool.destroy === 'function') {
                        tool.destroy();
                    }
                }
                
                // 状態クリア
                this.tools.clear();
                this.currentTool = null;
                this.managers = null;
                this.managersObject = null;
                this.drawContainer = null;
                
                // ライフサイクル状態リセット
                this._status = {
                    ready: false,
                    error: null,
                    initialized: false,
                    configured: false,
                    attached: false
                };
                
                console.log(`✅ ToolManager: dispose() 完了`);
                
            } catch (error) {
                console.error(`❌ ToolManager: dispose() 失敗:`, error);
            }
        }
        
        /**
         * 状態取得（AppCore用）
         * @returns {Object} 詳細状態情報
         */
        getStatus() {
            return {
                ...this._status,
                managersInjected: !!this.managersObject,
                drawContainerReady: !!this.drawContainer,
                toolCount: this.tools.size,
                currentTool: this.currentToolName,
                v8Ready: this.v8Ready
            };
        }

        // ========================================
        // Manager注入・依存関係管理
        // ========================================
        
        /**
         * Manager統一注入（修正版・防御強化）
         * @param {Object|Map} managers - 注入するManager群
         * @returns {boolean} 注入成功フラグ
         */
        setManagers(managers) {
            try {
                console.log(`🔧 ToolManager: setManagers() 開始`);
                
                if (!managers) {
                    throw new Error(`Managers is null/undefined`);
                }
                
                let managersMap;
                
                if (managers instanceof Map) {
                    console.log(`✅ Map形式で受信 - 直接利用`);
                    managersMap = managers;
                } else if (typeof managers === 'object' && managers !== null) {
                    console.log(`✅ Object形式で受信 - Map変換実行`);
                    managersMap = new Map(Object.entries(managers));
                } else {
                    throw new Error(`Invalid managers format: ${typeof managers}`);
                }
                
                // Map保存
                this.managers = managersMap;
                
                // Object形式併用保存（Tool注入用）
                this.managersObject = Object.fromEntries(managersMap);
                
                // CanvasManager特別処理（最重要）
                if (managersMap.has("canvas")) {
                    this.canvasManager = managersMap.get("canvas");
                    console.log(`✅ CanvasManager統一注入成功`);
                } else {
                    throw new Error(`CanvasManager (\"canvas\" key) not found`);
                }
                
                console.log(`✅ ToolManager: setManagers() 完了`);
                return true;
                
            } catch (error) {
                this._status.error = `setManagers failed: ${error.message}`;
                console.error(`❌ ToolManager: setManagers() 失敗:`, error);
                return false;
            }
        }
        
        /**
         * Manager統一注入（互換性メソッド）
         * @param {Object|Map} managers - 注入するManager群
         * @returns {boolean} 注入成功フラグ
         */
        setManagersObject(managers) {
            return this.setManagers(managers);
        }
        
        /**
         * 依存注入検証
         * @throws {Error} 検証失敗時
         */
        verifyInjection() {
            console.log(`🔍 ToolManager: verifyInjection() 開始`);
            
            // Step 1: CanvasManager存在確認
            if (!this.canvasManager) {
                const errorMessage = "CanvasManager injection verification failed: canvasManager is null/undefined";
                console.error(`❌ ${errorMessage}`);
                throw new Error(errorMessage);
            }
            console.log(`✅ CanvasManager注入確認完了`);
            
            // Step 2: getDrawContainer()メソッド確認
            if (typeof this.canvasManager.getDrawContainer !== 'function') {
                const errorMessage = "CanvasManager injection verification failed: getDrawContainer() method not available";
                console.error(`❌ ${errorMessage}`);
                throw new Error(errorMessage);
            }
            console.log(`✅ getDrawContainer()メソッド確認完了`);
            
            // Step 3: getDrawContainer()実行確認
            let drawContainer;
            try {
                drawContainer = this.canvasManager.getDrawContainer();
            } catch (error) {
                const errorMessage = `CanvasManager getDrawContainer() execution error: ${error.message}`;
                console.error(`❌ ${errorMessage}`);
                throw new Error(errorMessage);
            }
            
            if (!drawContainer) {
                const errorMessage = "CanvasManager getDrawContainer() returned null";
                console.error(`❌ ${errorMessage}`);
                throw new Error(errorMessage);
            }
            console.log(`✅ getDrawContainer()実行確認完了`);
            
            // Step 4: Container妥当性確認
            if (!drawContainer.addChild || typeof drawContainer.addChild !== 'function') {
                const errorMessage = "Invalid Container - missing addChild method";
                console.error(`❌ ${errorMessage}`);
                throw new Error(errorMessage);
            }
            console.log(`✅ Container妥当性確認完了`);
            
            // DrawContainer保存
            this.drawContainer = drawContainer;
            
            console.log(`✅ ToolManager: verifyInjection() 完了`);
        }

        // ========================================
        // Tool管理・切り替え
        // ========================================
        
        /**
         * v8 Tool初期化
         * @returns {Promise<boolean>} 初期化成功フラグ
         */
        async initializeV8Tools() {
            try {
                console.log(`🚀 ToolManager: initializeV8Tools() 開始`);
                
                if (!this.managersObject) {
                    throw new Error(`Managers not injected - call setManagers() first`);
                }
                
                if (!this.drawContainer) {
                    throw new Error(`DrawContainer not ready - call verifyInjection() first`);
                }
                
                // v8依存関係確認
                if (!window.Tegaki || !window.Tegaki.AbstractTool) {
                    throw new Error(`AbstractTool not loaded`);
                }
                
                if (!window.PIXI || !window.PIXI.Graphics) {
                    throw new Error(`PixiJS not loaded`);
                }
                
                console.log(`✅ v8依存関係確認完了`);
                
                // Tool作成・登録
                const toolCreationResults = [];
                
                // 1. PenTool作成
                try {
                    console.log(`1️⃣ PenTool作成開始`);
                    const penTool = await this.createV8PenTool();
                    if (penTool) {
                        this.tools.set('pen', penTool);
                        toolCreationResults.push('pen: success');
                        console.log(`✅ PenTool登録完了`);
                    } else {
                        toolCreationResults.push('pen: failed');
                    }
                } catch (error) {
                    console.error(`❌ PenTool作成エラー:`, error);
                    toolCreationResults.push(`pen: error - ${error.message}`);
                }
                
                // 2. EraserTool作成
                try {
                    console.log(`2️⃣ EraserTool作成開始`);
                    const eraserTool = await this.createV8EraserTool();
                    if (eraserTool) {
                        this.tools.set('eraser', eraserTool);
                        toolCreationResults.push('eraser: success');
                        console.log(`✅ EraserTool登録完了`);
                    } else {
                        toolCreationResults.push('eraser: failed');
                    }
                } catch (error) {
                    console.error(`❌ EraserTool作成エラー:`, error);
                    toolCreationResults.push(`eraser: error - ${error.message}`);
                }
                
                // 結果確認
                const successfulTools = this.tools.size;
                if (successfulTools === 0) {
                    throw new Error(`No tools created successfully. Results: ${toolCreationResults.join(', ')}`);
                }
                
                console.log(`📊 Tool作成結果: ${toolCreationResults.join(', ')}`);
                
                // 3. デフォルトTool設定
                if (this.tools.has(this.currentToolName)) {
                    console.log(`🔄 デフォルトTool設定: ${this.currentToolName}`);
                    await this.setActiveTool(this.currentToolName);
                } else if (this.tools.size > 0) {
                    // フォールバック: 利用可能な最初のTool
                    const firstToolName = this.tools.keys().next().value;
                    console.log(`🔄 フォールバックTool設定: ${firstToolName}`);
                    await this.setActiveTool(firstToolName);
                }
                
                // v8準備完了
                this.v8Ready = true;
                this._status.ready = this.isReady(); // 状態再評価
                
                console.log(`✅ ToolManager: initializeV8Tools() 完了 (${successfulTools}個のTool)`);
                return true;
                
            } catch (error) {
                this._status.error = `initializeV8Tools failed: ${error.message}`;
                this.v8Ready = false;
                this._status.ready = false;
                console.error(`❌ ToolManager: initializeV8Tools() 失敗:`, error);
                throw error;
            }
        }
        
        /**
         * PenTool作成
         * @returns {Promise<PenTool|null>}
         */
        async createV8PenTool() {
            try {
                if (!window.Tegaki.PenTool) {
                    throw new Error(`PenTool class not found`);
                }
                
                const penTool = new window.Tegaki.PenTool();
                
                // Manager統一注入
                if (typeof penTool.setManagersObject === 'function') {
                    const injectionResult = penTool.setManagersObject(this.managersObject);
                    if (injectionResult === false) {
                        throw new Error(`PenTool Manager injection failed`);
                    }
                } else {
                    throw new Error(`PenTool.setManagersObject method not found`);
                }
                
                console.log(`✅ PenTool Manager統一注入完了`);
                return penTool;
                
            } catch (error) {
                console.error(`❌ PenTool作成エラー:`, error);
                return null;
            }
        }
        
        /**
         * EraserTool作成
         * @returns {Promise<EraserTool|null>}
         */
        async createV8EraserTool() {
            try {
                if (!window.Tegaki.EraserTool) {
                    throw new Error(`EraserTool class not found`);
                }
                
                const eraserTool = new window.Tegaki.EraserTool();
                
                // Manager統一注入
                if (typeof eraserTool.setManagersObject === 'function') {
                    const injectionResult = eraserTool.setManagersObject(this.managersObject);
                    if (injectionResult === false) {
                        throw new Error(`EraserTool Manager injection failed`);
                    }
                } else {
                    throw new Error(`EraserTool.setManagersObject method not found`);
                }
                
                console.log(`✅ EraserTool Manager統一注入完了`);
                return eraserTool;
                
            } catch (error) {
                console.error(`❌ EraserTool作成エラー:`, error);
                return null;
            }
        }
        
        /**
         * Tool切り替え（内部用）
         * @param {string} toolName - 切り替え先Tool名
         * @returns {Promise<boolean>} 切り替え成功フラグ
         */
        async switchTool(toolName) {
            try {
                console.log(`🔄 Tool切り替え開始: ${this.currentToolName} → ${toolName}`);
                
                // 現在のTool無効化
                if (this.currentTool && typeof this.currentTool.deactivate === 'function') {
                    this.currentTool.deactivate();
                }
                
                // 新しいTool取得
                const newTool = this.tools.get(toolName);
                if (!newTool) {
                    throw new Error(`Tool not found: ${toolName}`);
                }
                
                // Tool有効化
                if (typeof newTool.activate === 'function') {
                    await newTool.activate();
                    console.log(`✅ ${toolName} Tool アクティブ化完了`);
                } else {
                    console.warn(`⚠️ ${toolName} Tool has no activate method`);
                }
                
                // 状態更新
                this.currentTool = newTool;
                this.currentToolName = toolName;
                
                console.log(`✅ Tool切り替え完了: ${toolName}`);
                return true;
                
            } catch (error) {
                console.error(`❌ Tool切り替えエラー (${toolName}):`, error);
                return false;
            }
        }
        
        /**
         * アクティブTool設定（AppCore/TegakiApplication連携用）
         * @param {string} toolName - 設定するTool名
         * @returns {Promise<boolean>} 設定成功フラグ
         */
        async setActiveTool(toolName) {
            try {
                console.log(`🎯 ToolManager: setActiveTool(${toolName}) 開始`);
                
                if (!toolName || typeof toolName !== 'string') {
                    throw new Error(`Invalid tool name: ${toolName}`);
                }
                
                if (!this.tools.has(toolName)) {
                    throw new Error(`Tool not registered: ${toolName}`);
                }
                
                const result = await this.switchTool(toolName);
                
                if (result) {
                    console.log(`✅ ToolManager: setActiveTool(${toolName}) 完了`);
                    return true;
                } else {
                    throw new Error(`Tool activation failed: ${toolName}`);
                }
                
            } catch (error) {
                console.error(`❌ ToolManager: setActiveTool(${toolName}) 失敗:`, error);
                return false;
            }
        }

        // ========================================
        // ポインターイベント処理（TegakiApplication連携）
        // ========================================
        
        /**
         * ポインターダウン処理
         * @param {Object} event - ポインターイベント {x, y, originalEvent}
         */
        onPointerDown(event) {
            if (!this.currentTool) {
                console.warn('⚠️ ToolManager: No current tool for pointer down');
                return;
            }

            try {
                this.isPointerDown = true;
                this.lastPointerPosition = { x: event.x, y: event.y };

                if (typeof this.currentTool.onPointerDown === 'function') {
                    this.currentTool.onPointerDown(event);
                } else {
                    console.warn(`⚠️ Current tool (${this.currentToolName}) has no onPointerDown method`);
                }

            } catch (error) {
                console.error('❌ ToolManager.onPointerDown処理エラー:', error);
            }
        }

        /**
         * ポインタームーブ処理
         * @param {Object} event - ポインターイベント {x, y, originalEvent}
         */
        onPointerMove(event) {
            if (!this.currentTool) {
                return;
            }

            try {
                this.lastPointerPosition = { x: event.x, y: event.y };

                if (typeof this.currentTool.onPointerMove === 'function') {
                    this.currentTool.onPointerMove(event);
                }

            } catch (error) {
                console.error('❌ ToolManager.onPointerMove処理エラー:', error);
            }
        }

        /**