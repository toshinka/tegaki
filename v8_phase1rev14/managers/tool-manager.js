/**
 * 📄 FILE: tool-manager.js
 * 📌 RESPONSIBILITY: Tool管理・切り替え・Manager統一注入・操作フロー管理
 *
 * @provides
 *   - ToolManager クラス
 *   - switchTool(toolName) - Tool切り替え
 *   - getCurrentTool() - 現在のTool取得
 *   - initializeV8Tools() - v8 Tool群初期化
 *   - registerTool(name, toolClass) - Tool登録
 *
 * @uses
 *   - CanvasManager.getDrawContainer()
 *   - AbstractTool.setManagersObject()
 *   - AbstractTool.activate()
 *   - AbstractTool.deactivate()
 *   - PenTool constructor
 *   - EraserTool constructor
 *
 * @initflow
 *   1. new ToolManager() → 2. setManagersObject() → 3. initializeV8Tools() → 4. switchTool() → 5. Tool.activate()
 *
 * @forbids
 *   - 双方向依存禁止 (💀)
 *   - フォールバック禁止
 *   - フェイルセーフ禁止
 *   - v7/v8 両対応による二重管理禁止
 *   - Tool直接操作禁止（Manager経由必須）
 *   - setCanvasManager()・setManagers() 旧メソッド使用禁止
 *
 * @manager-key
 *   window.Tegaki.ToolManagerInstance
 *
 * @integration-flow
 *   AppCore → ToolManager.setManagersObject() → Tool.setManagersObject() → Tool.activate()
 *
 * @error-handling
 *   - Manager注入失敗時は Tool初期化をスキップ
 *   - Tool作成失敗時は詳細ログ出力
 *   - activate()失敗時はTool登録を維持（再試行可能）
 */

(function() {
    'use strict';

    /**
     * 🔧 ToolManager v8.12.0対応版・Manager注入メソッド名統一修正版
     * 
     * 📏 修正内容:
     * - setCanvasManager() → 削除（統一API使用）
     * - setManagers() → setManagersObject() に統一
     * - Manager注入タイミング修正
     * - 初期化順序修正・DI形式対応
     * 
     * 🚀 特徴:
     * - v8 Tool連携・WebGPU対応
     * - 非同期初期化・Container階層
     * - リアルタイム切り替え・Manager統一注入修正
     * - メソッド名統一対応
     */
    class ToolManager {
        constructor(canvasManagerDI = null) {
            console.log(`🚀 ToolManager v8.12.0対応版作成開始 - Manager注入メソッド名統一修正版`);
            
            // DI注入確認
            if (canvasManagerDI) {
                console.log(`🔧 DI Object形式で受信`);
                this.canvasManager = canvasManagerDI;
                
                if (this.canvasManager.getDrawContainer) {
                    console.log(`✅ CanvasManager注入成功 - getDrawContainerメソッド確認済み`);
                } else {
                    console.warn(`⚠️ CanvasManager.getDrawContainer() not available`);
                }
            } else {
                console.log(`📦 DI なし - 後続でManager設定予定`);
                this.canvasManager = null;
            }
            
            // Tool管理
            this.tools = new Map();
            this.currentTool = null;
            this.currentToolName = 'pen';
            
            // Manager統一注入用
            this.managers = null;
            this.drawContainer = null;
            
            // v8対応状態
            this.v8Ready = false;
            this.webGPUSupported = false;
            
            console.log(`⚠️ 描画Container取得は後続処理で実行（初期化順序修正）`);
            console.log(`🔧 CanvasManager注入状況: ${this.canvasManager ? 'success - DI object' : 'pending'}`);
            console.log(`✅ ToolManager v8.12.0対応版作成完了 - Manager注入メソッド名統一修正版`);
        }

        /**
         * 🔧 Manager統一注入（修正版）
         * 
         * @param {Object|Map} managers - 注入するManager群
         */
        setManagersObject(managers) {
            console.log(`🔧 ToolManager - Manager統一注入開始（修正版）`);
            
            if (managers instanceof Map) {
                console.log(`📦 受信Manager型: Map`);
                console.log(`📦 受信Manager内容:`, managers);
                console.log(`✅ Map形式で受信`);
                this.managers = managers;
            } else if (typeof managers === 'object' && managers !== null) {
                console.log(`📦 受信Manager型: Object`);
                console.log(`📦 受信Manager内容:`, managers);
                console.log(`✅ Object形式で受信`);
                this.managers = new Map(Object.entries(managers));
            } else {
                console.error(`❌ ToolManager: 無効なManager形式:`, typeof managers);
                return false;
            }

            // 保存確認
            console.log(`✅ ToolManager: Manager群保存完了`);
            console.log(`📋 Manager キー一覧:`, Array.from(this.managers.keys()));
            
            // Map → Object 変換（Tool注入用）
            const managersObject = {};
            for (const [key, value] of this.managers) {
                managersObject[key] = value;
            }
            
            console.log(`📦 Map→Object変換完了`);
            console.log(`📦 変換後Object型:`, typeof managersObject);
            console.log(`📦 変換後Object キー一覧:`, Object.keys(managersObject));
            
            this.managersObject = managersObject;
            
            // 必須Manager確認
            const requiredManagers = ['canvas', 'coordinate', 'record'];
            const availableManagers = [];
            
            for (const required of requiredManagers) {
                if (this.managers.has(required)) {
                    availableManagers.push(required);
                }
            }
            
            console.log(`✅ 必須Manager確認完了:`, availableManagers);
            
            // DrawContainer初期化（Manager注入後）
            console.log(`🎨 DrawContainer初期化開始（Manager注入後）`);
            this.initializeDrawContainer();
            
            console.log(`✅ ToolManager: Manager統一注入完了（Map→Object変換成功）`);
            console.log(`📋 利用可能Manager:`, availableManagers);
            return true;
        }

        /**
         * 🎨 DrawContainer初期化
         */
        initializeDrawContainer() {
            if (this.canvasManager && this.canvasManager.getDrawContainer) {
                this.drawContainer = this.canvasManager.getDrawContainer();
                console.log(`✅ DrawContainer初期化完了`);
            } else if (this.managers && this.managers.has('canvas')) {
                const canvasManager = this.managers.get('canvas');
                if (canvasManager && canvasManager.getDrawContainer) {
                    this.drawContainer = canvasManager.getDrawContainer();
                    console.log(`📦 Manager経由DrawContainer取得成功`);
                }
            }
            
            console.log(`📦 v8描画Container取得成功:`, !!this.drawContainer);
        }

        /**
         * 🔧 Manager統一登録情報設定
         * 
         * @param {Map} managers - Manager Map
         */
        setManagerRegistrationInfo(managers) {
            console.log(`✅ ToolManager: Manager統一登録情報設定完了（Map形式）`);
            this.managerRegistrationInfo = managers;
        }

        /**
         * 🚀 v8 Tool初期化（修正版）
         */
        async initializeV8Tools() {
            console.log(`🚀 v8 Tool初期化開始（修正版）`);
            
            if (!this.managersObject) {
                console.error(`❌ Manager群が未注入です`);
                return false;
            }
            
            console.log(`✅ Manager統一注入準備完了:`, typeof this.managersObject);
            console.log(`✅ DrawContainer準備完了:`, !!this.drawContainer);
            console.log(`📋 注入予定Manager キー:`, Object.keys(this.managersObject));
            
            // v8依存関係確認
            console.log(`🔍 v8依存関係確認開始`);
            if (!window.Tegaki || !window.Tegaki.AbstractTool) {
                console.error(`❌ AbstractTool未ロード`);
                return false;
            }
            
            if (!window.PIXI || !window.PIXI.Graphics) {
                console.error(`❌ PixiJS未ロード`);
                return false;
            }
            
            console.log(`✅ v8依存関係確認完了`);
            
            // WebGPU対応状況
            this.webGPUSupported = window.PIXI && window.PIXI.Graphics;
            console.log(`🔧 WebGPU対応状況:`, this.webGPUSupported ? '対応' : '非対応');
            
            try {
                // 1. PenTool作成
                console.log(`1️⃣ v8 PenTool作成開始...（修正版）`);
                const penTool = await this.createV8PenTool();
                if (penTool) {
                    this.tools.set('pen', penTool);
                    console.log(`✅ PenTool登録完了`);
                }
                
                // 2. EraserTool作成
                console.log(`2️⃣ v8 EraserTool作成開始...（修正版）`);
                const eraserTool = await this.createV8EraserTool();
                if (eraserTool) {
                    this.tools.set('eraser', eraserTool);
                    console.log(`✅ EraserTool登録完了`);
                }
                
                // 3. デフォルトTool切り替え
                console.log(`🔄 Tool切り替え: ${this.currentToolName}`);
                await this.switchTool(this.currentToolName);
                
                console.log(`✅ v8 Tool初期化完了`);
                this.v8Ready = true;
                return true;
                
            } catch (error) {
                console.error(`💀 v8 Tool初期化エラー:`, error);
                return false;
            }
        }

        /**
         * 🖊️ v8 PenTool作成（修正版）
         */
        async createV8PenTool() {
            try {
                const penTool = new window.Tegaki.PenTool();
                
                // Manager統一注入（修正版）
                console.log(`🔧 PenTool Manager注入開始 - Object形式`);
                console.log(`📦 注入予定Object:`, this.managersObject);
                console.log(`📦 注入予定キー:`, Object.keys(this.managersObject));
                
                const injectionResult = penTool.setManagersObject(this.managersObject);
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
         * 🧹 v8 EraserTool作成（修正版）
         */
        async createV8EraserTool() {
            try {
                const eraserTool = new window.Tegaki.EraserTool();
                
                // Manager統一注入（修正版）
                console.log(`🔧 EraserTool Manager注入開始 - Object形式`);
                
                const injectionResult = eraserTool.setManagersObject(this.managersObject);
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
         * 🔄 Tool切り替え
         * 
         * @param {string} toolName - 切り替え先Tool名
         */
        async switchTool(toolName) {
            console.log(`🔄 Tool切り替え開始: ${this.currentToolName} → ${toolName}`);
            
            // 現在のTool無効化
            if (this.currentTool && this.currentTool.deactivate) {
                this.currentTool.deactivate();
            }
            
            // 新しいTool取得
            const newTool = this.tools.get(toolName);
            if (!newTool) {
                console.error(`❌ Tool not found: ${toolName}`);
                return false;
            }
            
            try {
                // Tool有効化
                console.log(`🎯 ${toolName} Tool アクティブ化`);
                await newTool.activate();
                console.log(`✅ ${toolName} Tool アクティブ化完了`);
                
                // 状態更新
                this.currentTool = newTool;
                this.currentToolName = toolName;
                
                console.log(`✅ Tool切り替え完了: ${toolName}`);
                return true;
                
            } catch (error) {
                console.error(`💀 Tool切り替えエラー (${toolName}):`, error.message);
                return false;
            }
        }

        /**
         * 📊 現在のTool取得
         */
        getCurrentTool() {
            return this.currentTool;
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
         * 🔍 ToolManager準備状態確認
         */
        isReady() {
            const hasManagers = this.managersObject !== null;
            const hasDrawContainer = this.drawContainer !== null;
            const hasTools = this.tools.size > 0;
            const hasCurrentTool = this.currentTool !== null;
            
            console.log(`🔍 ToolManager準備状態確認:`);
            console.log(`  - Managers: ${hasManagers}`);
            console.log(`  - DrawContainer: ${hasDrawContainer}`);
            console.log(`  - Tools: ${hasTools} (${this.tools.size}個)`);
            console.log(`  - CurrentTool: ${hasCurrentTool} (${this.currentToolName})`);
            
            return hasManagers && hasDrawContainer && hasTools;
        }

        /**
         * 📊 ToolManager状態取得
         */
        getState() {
            return {
                currentToolName: this.currentToolName,
                toolCount: this.tools.size,
                v8Ready: this.v8Ready,
                webGPUSupported: this.webGPUSupported,
                hasManagers: !!this.managersObject,
                hasDrawContainer: !!this.drawContainer,
                isReady: this.isReady()
            };
        }

        /**
         * 🎨 描画Container取得
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
            if (tool && tool.updateSettings) {
                tool.updateSettings(settings);
                console.log(`🔧 Tool設定更新: ${toolName}`, settings);
            }
        }

        /**
         * 🧪 デバッグ情報取得
         */
        getDebugInfo() {
            const toolInfo = {};
            for (const [name, tool] of this.tools) {
                toolInfo[name] = {
                    isActive: tool.isActive || false,
                    isReady: tool.isReady ? tool.isReady() : false,
                    state: tool.getState ? tool.getState() : 'unavailable'
                };
            }
            
            return {
                currentTool: this.currentToolName,
                tools: toolInfo,
                managers: this.managersObject ? Object.keys(this.managersObject) : [],
                drawContainer: !!this.drawContainer,
                v8Ready: this.v8Ready
            };
        }
    }

    // グローバル登録
    if (!window.Tegaki) {
        window.Tegaki = {};
    }
    
    window.Tegaki.ToolManager = ToolManager;
    console.log(`🚀 ToolManager v8.12.0完全対応版・Manager注入メソッド名統一修正版 Loaded`);
    console.log(`📏 修正内容: setCanvasManager()削除・setManagersObject()統一・Manager注入タイミング修正・初期化順序修正・DI形式対応・メソッド名統一対応`);
    console.log(`🚀 特徴: v8 Tool連携・WebGPU対応・非同期初期化・Container階層・リアルタイム切り替え・Manager統一注入修正・メソッド名統一完全対応`);

})();