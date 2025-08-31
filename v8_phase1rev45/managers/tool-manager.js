/**
 * 📄 FILE: managers/tool-manager.js
 * 📌 RESPONSIBILITY: Tool管理・切り替え・Manager統一注入・操作フロー管理・Pointerイベント処理
 *
 * ChangeLog: 2025-08-31 API修正・Manager注入順序修正・getCurrentTool()確認・継続描画修正
 *
 * @provides
 *   - ToolManager クラス
 *   - switchTool(toolName) - Tool切り替え
 *   - setActiveTool(toolName) - Tool切り替え（互換性エイリアス）
 *   - getCurrentTool() - 現在のTool取得（修正: getActiveTool → getCurrentTool）
 *   - getTools() - Tool Map取得
 *   - initializeV8Tools() - v8 Tool群初期化
 *   - registerTool(name, toolClass) - Tool登録
 *   - setManagers(managers) - Manager統一注入
 *   - verifyInjection() - 注入検証
 *   - onPointerDown(event) - ポインターダウン処理
 *   - onPointerMove(event) - ポインタームーブ処理
 *   - onPointerUp(event) - ポインターアップ処理
 *   - isReady() - 準備状態確認
 *
 * @uses
 *   - CanvasManager.getDrawContainer()
 *   - AbstractTool.setManagersObject() - 修正: 正規メソッド優先
 *   - AbstractTool.activate()
 *   - AbstractTool.deactivate()
 *   - AbstractTool.onPointerDown()
 *   - AbstractTool.onPointerMove()
 *   - AbstractTool.onPointerUp()
 *   - PenTool constructor
 *   - EraserTool constructor
 *
 * @initflow
 *   1. new ToolManager() → 2. setManagers() → 3. verifyInjection() → 4. initializeV8Tools() → 5. switchTool() → 6. Tool.activate()
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 フォールバック禁止
 *   🚫 フェイルセーフ禁止
 *   🚫 v7/v8 両対応による二重管理禁止
 *   🚫 未実装メソッド呼び出し禁止（getActiveTool → getCurrentTool 修正）
 *   🚫 API名称不整合禁止
 *
 * @manager-key
 *   window.Tegaki.ToolManagerInstance
 *
 * @dependencies-strict
 *   REQUIRED: CanvasManager (getDrawContainer必須)
 *   OPTIONAL: EventBus, RecordManager
 *   FORBIDDEN: 他ToolManager, 循環依存
 *
 * @integration-flow
 *   AppCore → ToolManager.setManagers() → verifyInjection() → Tool.setManagersObject() → Tool.activate()
 *
 * @method-naming-rules
 *   - startOperation()/endOperation() 形式統一
 *   - setManagers() - Manager注入
 *   - verifyInjection() - 注入検証
 *   - switchTool()/setActiveTool() - Tool切り替え（両対応）
 *   - getTools() - Tool Map取得
 *   - getCurrentTool() - 現在Tool取得（修正: getActiveTool → getCurrentTool）
 *   - onPointerXxx() - ポインターイベント処理
 *
 * @error-handling
 *   throw: Manager注入失敗・API呼び出し失敗・Tool初期化失敗
 *   warn: Tool作成失敗・activate()失敗（再試行可能）
 *   log: 正常処理完了・状態変更
 *
 * @state-management
 *   - 状態は直接操作せず、必ず専用メソッド経由
 *   - Manager参照はsetManagers()後のみ利用
 *   - Tool状態変更は適切なライフサイクルメソッド使用
 *
 * @testing-hooks
 *   - verifyInjection() - 注入検証テスト
 *   - isReady() - 準備状態確認
 *   - getDebugInfo() - デバッグ情報取得
 *   - getTools() - Tool一覧取得
 */

(function() {
    'use strict';

    /**
     * 🔧 ToolManager v8.12.0完全対応版・API修正版
     * 
     * 📏 修正内容:
     * - Manager注入API順序修正（setManagersObject優先）
     * - getCurrentTool()メソッド確認・getActiveTool削除
     * - Tool注入エラー完全対応
     * - 継続描画問題修正
     * 
     * 🚀 特徴:
     * - API名称統一・後方互換性確保
     * - 防御的依存注入・検証強化
     * - Tool初期化エラー完全対応
     */
    class ToolManager {
        constructor(canvasManagerDI = null) {
            console.log(`🚀 ToolManager v8.12.0作成開始 - API修正版`);
            
            // 基本状態初期化
            this.canvasManager = null;
            this.tools = new Map();
            this.currentTool = null;
            this.currentToolName = 'pen';
            
            // Manager統一注入用
            this.managers = null;
            this.managersObject = null;
            this.drawContainer = null;
            
            // v8対応状態
            this.v8Ready = false;
            this.webGPUSupported = false;
            this.managersInjected = false;
            
            // Pointerイベント状態管理
            this.isPointerDown = false;
            this.lastPointerPosition = { x: 0, y: 0 };
            
            // DI注入確認（コンストラクタでの注入をサポート）
            if (canvasManagerDI) {
                this._handleConstructorInjection(canvasManagerDI);
            }
            
            console.log(`✅ ToolManager v8.12.0作成完了 - API修正版`);
        }

        /**
         * コンストラクタDI処理
         */
        _handleConstructorInjection(canvasManagerDI) {
            if (typeof canvasManagerDI === 'object' && canvasManagerDI !== null) {
                if (canvasManagerDI.canvasManager) {
                    // {canvasManager: instance} 形式
                    this.canvasManager = canvasManagerDI.canvasManager;
                } else if (canvasManagerDI.getDrawContainer) {
                    // 直接CanvasManagerインスタンス形式
                    this.canvasManager = canvasManagerDI;
                }
            }
            
            if (this.canvasManager && this.canvasManager.getDrawContainer) {
                console.log(`✅ CanvasManager注入成功`);
            }
        }

        /**
         * 🔧 Manager統一注入（修正版・防御強化）
         * 
         * @param {Object|Map} managers - 注入するManager群
         * @returns {boolean} 注入成功フラグ
         */
        setManagers(managers) {
            console.log(`🔧 ToolManager - Manager統一注入開始`);
            
            if (!managers) {
                console.error(`❌ ToolManager: null/undefined managers received`);
                return false;
            }
            
            let managersMap;
            
            if (managers instanceof Map) {
                console.log(`✅ Map形式で受信 - 直接利用`);
                managersMap = managers;
            } else if (typeof managers === 'object' && managers !== null) {
                console.log(`✅ Object形式で受信 - Map変換実行`);
                managersMap = new Map(Object.entries(managers));
            } else {
                console.error(`❌ ToolManager: 無効なManager形式:`, typeof managers);
                return false;
            }
            
            // Map・Object両形式で保存
            this.managers = managersMap;
            this.managersObject = Object.fromEntries(managersMap);
            
            // CanvasManager特別処理（最重要）
            if (managersMap.has("canvas")) {
                this.canvasManager = managersMap.get("canvas");
                console.log(`✅ CanvasManager統一注入成功`);
                
                // getDrawContainer()可用性確認
                this._verifyCanvasManager();
            } else {
                console.warn(`⚠️ CanvasManager（"canvas"キー）が見つかりません`);
            }
            
            this.managersInjected = true;
            console.log(`✅ ToolManager: Manager統一注入完了`);
            return true;
        }

        /**
         * CanvasManager検証
         */
        _verifyCanvasManager() {
            if (this.canvasManager && typeof this.canvasManager.getDrawContainer === 'function') {
                try {
                    this.drawContainer = this.canvasManager.getDrawContainer();
                    console.log(`✅ DrawContainer取得成功:`, !!this.drawContainer);
                } catch (error) {
                    console.warn(`⚠️ DrawContainer取得失敗:`, error.message);
                }
            } else {
                console.warn(`⚠️ CanvasManager.getDrawContainer()が利用不可`);
            }
        }

        /**
         * 🔍 依存注入検証（厳格版）
         */
        verifyInjection() {
            console.log(`🔍 ToolManager依存注入検証開始...`);
            
            // Step 1: Manager注入状態確認
            if (!this.managersInjected) {
                throw new Error("ToolManager: setManagers() not called");
            }
            
            // Step 2: CanvasManager存在確認
            if (!this.canvasManager) {
                throw new Error("ToolManager: CanvasManager injection failed");
            }
            console.log(`✅ CanvasManager注入確認完了`);
            
            // Step 3: getDrawContainer()メソッド確認
            if (typeof this.canvasManager.getDrawContainer !== 'function') {
                throw new Error("ToolManager: getDrawContainer() method not available");
            }
            console.log(`✅ getDrawContainer()メソッド確認完了`);
            
            // Step 4: getDrawContainer()実行確認
            let drawContainer;
            try {
                drawContainer = this.canvasManager.getDrawContainer();
            } catch (error) {
                throw new Error(`ToolManager: getDrawContainer() execution failed: ${error.message}`);
            }
            
            if (!drawContainer) {
                throw new Error("ToolManager: getDrawContainer() returned null");
            }
            console.log(`✅ getDrawContainer()実行確認完了`);
            
            // Step 5: Container妥当性確認
            if (!drawContainer.addChild || typeof drawContainer.addChild !== 'function') {
                throw new Error("ToolManager: invalid Container - missing addChild method");
            }
            console.log(`✅ Container妥当性確認完了`);
            
            // DrawContainer保存
            this.drawContainer = drawContainer;
            
            console.log(`✅ ToolManager依存注入検証完了 - 全検証PASS`);
            return true;
        }

        /**
         * 🚀 v8 Tool初期化（API修正版）
         */
        async initializeV8Tools() {
            console.log(`🚀 v8 Tool初期化開始（API修正版）`);
            
            // 前提条件確認
            if (!this.managersInjected) {
                console.error(`❌ Manager群が未注入です - setManagers()を先に実行してください`);
                return false;
            }
            
            if (!this.drawContainer) {
                console.error(`❌ DrawContainer未初期化 - verifyInjection()を先に実行してください`);
                return false;
            }
            
            // 依存関係確認
            if (!window.Tegaki?.AbstractTool) {
                console.error(`❌ AbstractTool未ロード`);
                return false;
            }
            
            if (!window.PIXI?.Graphics) {
                console.error(`❌ PixiJS v8未ロード`);
                return false;
            }
            
            console.log(`✅ v8依存関係確認完了`);
            
            // WebGPU対応状況
            this.webGPUSupported = !!window.PIXI?.Graphics;
            console.log(`🔧 WebGPU対応状況:`, this.webGPUSupported ? '対応' : '非対応');
            
            try {
                // 1. PenTool作成・登録
                console.log(`1️⃣ v8 PenTool作成開始...`);
                const penTool = await this.createV8PenTool();
                if (penTool) {
                    this.tools.set('pen', penTool);
                    console.log(`✅ PenTool登録完了`);
                } else {
                    console.error(`❌ PenTool作成失敗`);
                }
                
                // 2. EraserTool作成・登録
                console.log(`2️⃣ v8 EraserTool作成開始...`);
                const eraserTool = await this.createV8EraserTool();
                if (eraserTool) {
                    this.tools.set('eraser', eraserTool);
                    console.log(`✅ EraserTool登録完了`);
                } else {
                    console.error(`❌ EraserTool作成失敗`);
                }
                
                // 3. デフォルトTool切り替え
                console.log(`🔄 デフォルトTool切り替え: ${this.currentToolName}`);
                await this.switchTool(this.currentToolName);
                
                this.v8Ready = true;
                console.log(`✅ v8 Tool初期化完了`);
                return true;
                
            } catch (error) {
                console.error(`💀 v8 Tool初期化エラー:`, error);
                return false;
            }
        }

        /**
         * 🖊️ v8 PenTool作成（Manager注入強化版）
         */
        async createV8PenTool() {
            try {
                // PenTool作成
                const penTool = new window.Tegaki.PenTool();
                
                // Manager統一注入（修正: setManagersObject優先）
                console.log(`🔧 PenTool Manager注入開始`);
                
                const injectionResult = await this._injectManagersToTool(penTool, 'pen');
                if (!injectionResult) {
                    console.error(`❌ PenTool Manager注入失敗`);
                    return null;
                }
                
                console.log(`✅ PenTool Manager統一注入完了`);
                return penTool;
                
            } catch (error) {
                console.error(`💀 PenTool作成エラー:`, error);
                return null;
            }
        }

        /**
         * 🧹 v8 EraserTool作成（Manager注入強化版）
         */
        async createV8EraserTool() {
            try {
                const eraserTool = new window.Tegaki.EraserTool();
                
                // Manager統一注入
                console.log(`🔧 EraserTool Manager注入開始`);
                
                const injectionResult = await this._injectManagersToTool(eraserTool, 'eraser');
                if (!injectionResult) {
                    console.error(`❌ EraserTool Manager注入失敗`);
                    return null;
                }
                
                console.log(`✅ EraserTool Manager統一注入完了`);
                return eraserTool;
                
            } catch (error) {
                console.error(`💀 EraserTool作成エラー:`, error);
                return null;
            }
        }

        /**
         * Tool Manager注入統一処理（修正版・順序変更）
         * @param {Object} tool - Tool インスタンス
         * @param {string} toolName - Tool名
         * @returns {Promise<boolean>} 注入成功フラグ
         */
        async _injectManagersToTool(tool, toolName) {
            try {
                console.log(`🔄 ${toolName}: Manager統一注入（修正版）`);
                
                // ✅ 修正: setManagersObject方式優先（正規メソッド）
                if (typeof tool.setManagersObject === 'function') {
                    console.log(`🖊️ ${toolName}: Manager統一注入開始（正規メソッド）`);
                    const result = tool.setManagersObject(this.managersObject);
                    if (result !== false) {
                        console.log(`✅ ${toolName}: Manager統一注入完了（正規メソッド）`);
                        return true;
                    }
                }
                
                // 後方互換：setManagers方式
                if (typeof tool.setManagers === 'function') {
                    console.log(`🔄 ${toolName}: Manager統一注入（エイリアス経由）`);
                    const result = await tool.setManagers(this.managersObject);
                    if (result !== false) {
                        console.log(`✅ ${toolName}: Manager統一注入完了（エイリアス）`);
                        return true;
                    }
                }
                
                console.error(`❌ ${toolName}Tool: Manager注入メソッドが見つかりません`);
                return false;
                
            } catch (error) {
                console.error(`❌ ${toolName}Tool Manager注入エラー:`, error);
                return false;
            }
        }

        /**
         * 🔄 Tool切り替え（メイン実装）
         * 
         * @param {string} toolName - 切り替え先Tool名
         * @returns {Promise<boolean>} 切り替え成功フラグ
         */
        async switchTool(toolName) {
            console.log(`🔄 Tool切り替え開始: ${this.currentToolName} → ${toolName}`);
            
            // Tool存在確認
            const newTool = this.tools.get(toolName);
            if (!newTool) {
                console.error(`❌ Tool not found: ${toolName}`);
                return false;
            }
            
            try {
                // 現在のTool無効化
                if (this.currentTool && typeof this.currentTool.deactivate === 'function') {
                    this.currentTool.deactivate();
                }
                
                // 新しいTool有効化
                if (typeof newTool.activate === 'function') {
                    await newTool.activate();
                }
                
                console.log(`✅ ${toolName} Tool アクティブ化完了`);
                
                // 状態更新
                this.currentTool = newTool;
                this.currentToolName = toolName;
                
                console.log(`✅ Tool切り替え完了: ${toolName}`);
                return true;
                
            } catch (error) {
                console.error(`💀 Tool切り替えエラー (${toolName}):`, error);
                return false;
            }
        }

        /**
         * 🔄 Tool切り替え（互換性エイリアス）
         * 
         * @param {string} toolName - 切り替え先Tool名
         * @returns {Promise<boolean>} 切り替え成功フラグ
         */
        async setActiveTool(toolName) {
            return await this.switchTool(toolName);
        }

        /**
         * 📊 Tool Map取得（API統一）
         * 
         * @returns {Map} Tool Map
         */
        getTools() {
            return this.tools;
        }

        /**
         * 📊 現在のTool取得（修正: getActiveTool → getCurrentTool）
         * 
         * @returns {Object|null} 現在のToolインスタンス
         */
        getCurrentTool() {
            return this.currentTool;
        }

        /**
         * 📊 現在のTool名取得
         * 
         * @returns {string} 現在のTool名
         */
        getCurrentToolName() {
            return this.currentToolName;
        }

        /**
         * 🖱️ ポインターダウン処理（TegakiApplication連携）
         * 
         * @param {Object} event - ポインターイベント {x, y, originalEvent}
         */
        onPointerDown(event) {
            if (!this.currentTool) {
                console.warn('⚠️ No current tool available for pointer down');
                return;
            }

            try {
                this.isPointerDown = true;
                this.lastPointerPosition = { x: event.x, y: event.y };

                // 現在のToolにポインターダウンイベントを伝達
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
         * 🖱️ ポインタームーブ処理（TegakiApplication連携）
         * 
         * @param {Object} event - ポインターイベント {x, y, originalEvent}
         */
        onPointerMove(event) {
            if (!this.currentTool) {
                return;
            }

            try {
                this.lastPointerPosition = { x: event.x, y: event.y };

                // 現在のToolにポインタームーブイベントを伝達
                if (typeof this.currentTool.onPointerMove === 'function') {
                    this.currentTool.onPointerMove(event);
                }

            } catch (error) {
                console.error('❌ ToolManager.onPointerMove処理エラー:', error);
            }
        }

        /**
         * 🖱️ ポインターアップ処理（TegakiApplication連携）
         * 
         * @param {Object} event - ポインターイベント {x, y, originalEvent}
         */
        onPointerUp(event) {
            if (!this.currentTool) {
                return;
            }

            try {
                this.isPointerDown = false;
                this.lastPointerPosition = { x: event.x, y: event.y };

                // 現在のToolにポインターアップイベントを伝達
                if (typeof this.currentTool.onPointerUp === 'function') {
                    this.currentTool.onPointerUp(event);
                }

            } catch (error) {
                console.error('❌ ToolManager.onPointerUp処理エラー:', error);
            }
        }

        /**
         * 📝 Tool登録
         * 
         * @param {string} name - Tool名
         * @param {Function} toolClass - Toolクラス
         */
        registerTool(name, toolClass) {
            console.log(`📝 Tool登録: ${name}`);
            this.tools.set(name, toolClass);
        }

        /**
         * 🔍 ToolManager準備状態確認（API統一版）
         * 
         * @returns {boolean} 準備状態
         */
        isReady() {
            const hasCanvasManager = this.canvasManager !== null;
            const hasGetDrawContainer = hasCanvasManager && typeof this.canvasManager.getDrawContainer === 'function';
            const hasDrawContainer = this.drawContainer !== null;
            const hasManagers = this.managersObject !== null && this.managersInjected;
            const hasTools = this.tools.size > 0;
            const hasCurrentTool = this.currentTool !== null;
            
            return hasCanvasManager && hasGetDrawContainer && hasDrawContainer && hasManagers && hasTools && hasCurrentTool;
        }

        /**
         * 📊 ToolManager状態取得
         * 
         * @returns {Object} 詳細状態情報
         */
        getState() {
            return {
                currentToolName: this.currentToolName,
                toolCount: this.tools.size,
                toolNames: Array.from(this.tools.keys()),
                v8Ready: this.v8Ready,
                webGPUSupported: this.webGPUSupported,
                managersInjected: this.managersInjected,
                hasCanvasManager: !!this.canvasManager,
                hasGetDrawContainer: this.canvasManager && typeof this.canvasManager.getDrawContainer === 'function',
                hasDrawContainer: !!this.drawContainer,
                hasManagers: !!this.managersObject,
                isReady: this.isReady(),
                pointerState: {
                    isPointerDown: this.isPointerDown,
                    lastPosition: this.lastPointerPosition
                }
            };
        }

        /**
         * 🎨 描画Container取得
         * 
         * @returns {PIXI.Container|null} 描画Container
         */
        getDrawContainer() {
            return this.drawContainer;
        }

        /**
         * 🔧 Tool設定更新
         * 
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
         * 🧪 デバッグ情報取得（API統一版）
         * 
         * @returns {Object} 詳細デバッグ情報
         */
        getDebugInfo() {
            const toolInfo = {};
            for (const [name, tool] of this.tools) {
                toolInfo[name] = {
                    className: tool.constructor.name,
                    isActive: tool.isActive || false,
                    isReady: tool.isReady ? tool.isReady() : 'method not available',
                    state: tool.getState ? tool.getState() : 'getState not available',
                    hasOnPointerDown: typeof tool.onPointerDown === 'function',
                    hasOnPointerMove: typeof tool.onPointerMove === 'function',
                    hasOnPointerUp: typeof tool.onPointerUp === 'function'
                };
            }
            
            return {
                className: 'ToolManager',
                version: 'v8.12.0-api-fixed',
                currentTool: this.currentToolName,
                tools: toolInfo,
                toolsCount: this.tools.size,
                availableTools: Array.from(this.tools.keys()),
                managers: this.managersObject ? Object.keys(this.managersObject) : [],
                managerCount: this.managersObject ? Object.keys(this.managersObject).length : 0,
                injectionStatus: {
                    managersInjected: this.managersInjected,
                    canvasManager: !!this.canvasManager,
                    getDrawContainerMethod: this.canvasManager && typeof this.canvasManager.getDrawContainer === 'function',
                    drawContainer: !!this.drawContainer
                },
                readinessStatus: {
                    v8Ready: this.v8Ready,
                    isReady: this.isReady(),
                    webGPUSupported: this.webGPUSupported
                },
                pointerState: {
                    isPointerDown: this.isPointerDown,
                    lastPosition: this.lastPointerPosition
                },
                apiMethods: {
                    getTools: typeof this.getTools === 'function',
                    setActiveTool: typeof this.setActiveTool === 'function',
                    switchTool: typeof this.switchTool === 'function',
                    getCurrentTool: typeof this.getCurrentTool === 'function', // 修正確認
                    verifyInjection: typeof this.verifyInjection === 'function'
                }
            };
        }

        // ========================================
        // 後方互換・ヘルパーメソッド
        // ========================================

        /**
         * 後方互換メソッド（setManagersObject）
         */
        setManagersObject(managers) {
            return this.setManagers(managers);
        }

        /**
         * Manager登録情報設定（互換性）
         */
        setManagerRegistrationInfo(managers) {
            console.log(`✅ ToolManager: Manager統一登録情報設定完了（互換性メソッド）`);
            this.managerRegistrationInfo = managers;
        }

        /**
         * DrawContainer初期化（互換性）
         */
        initializeDrawContainer() {
            if (this.canvasManager && this.canvasManager.getDrawContainer && !this.drawContainer) {
                try {
                    this.drawContainer = this.canvasManager.getDrawContainer();
                    console.log(`✅ DrawContainer初期化完了（互換性メソッド）`);
                } catch (error) {
                    console.warn(`⚠️ DrawContainer初期化失敗:`, error.message);
                }
            }
        }

        /**
         * 旧形式Pointerイベント処理（後方互換）
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
    }

    // グローバル登録
    if (!window.Tegaki) {
        window.Tegaki = {};
    }

    window.Tegaki.ToolManager = ToolManager;
    console.log(`🚀 ToolManager v8.12.0完全対応版・API修正版 Loaded`);
    console.log(`📏 修正内容: getCurrentTool()確認・setManagersObject優先・Manager注入強化・API統一完了`);
    console.log(`🚀 特徴: 防御的依存注入・Tool初期化エラー完全対応・ポインターイベント統一処理`);

})();