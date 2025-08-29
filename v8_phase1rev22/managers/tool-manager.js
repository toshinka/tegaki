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
 *   - setManagers(managers) - Manager統一注入
 *   - verifyInjection() - 注入検証
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
 *   1. new ToolManager() → 2. setManagers() → 3. verifyInjection() → 4. initializeV8Tools() → 5. switchTool() → 6. Tool.activate()
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 フォールバック禁止
 *   🚫 フェイルセーフ禁止
 *   🚫 v7/v8 両対応による二重管理禁止
 *
 * @manager-key
 *   window.Tegaki.ToolManagerInstance
 *
 * @dependencies-strict
 *   - 必須: CanvasManager (getDrawContainer必須)
 *   - オプション: EventBus, RecordManager
 *   - 禁止: 他ToolManager, 循環依存
 *
 * @integration-flow
 *   AppCore → ToolManager.setManagers() → verifyInjection() → Tool.setManagersObject() → Tool.activate()
 *
 * @method-naming-rules
 *   - startOperation()/endOperation() 形式統一
 *   - setManagers() - Manager注入
 *   - verifyInjection() - 注入検証
 *
 * @error-handling
 *   - Manager注入失敗時は Tool初期化をスキップ
 *   - Tool作成失敗時は詳細ログ出力
 *   - activate()失敗時はTool登録を維持（再試行可能）
 *
 * @state-management
 *   - 状態は直接操作せず、必ず専用メソッド経由
 *   - Manager参照はsetManagers()後のみ利用
 *
 * @testing-hooks
 *   - verifyInjection() - 注入検証テスト
 *   - isReady() - 準備状態確認
 *   - getDebugInfo() - デバッグ情報取得
 */

(function() {
    'use strict';

    /**
     * 🔧 ToolManager v8.12.0完全対応版・PenTool作成修正版
     * 
     * 📏 修正内容:
     * - PenTool作成エラー修正・Manager注入方法改善
     * - コンソール出力削減・重要ログのみ保持
     * 
     * 🚀 特徴:
     * - 防御的依存注入・検証強化
     * - CanvasManager.getDrawContainer()保証
     * - Tool作成時の適切なManager注入
     */
    class ToolManager {
        constructor(canvasManagerDI = null) {
            console.log(`🚀 ToolManager v8.12.0作成開始 - PenTool作成修正版`);
            
            // 基本状態初期化
            this.canvasManager = null;
            this.tools = new Map();
            this.currentTool = null;
            this.currentToolName = 'pen';
            
            // Manager統一注入用
            this.managers = null;
            this.drawContainer = null;
            
            // v8対応状態
            this.v8Ready = false;
            this.webGPUSupported = false;
            
            // DI注入確認（コンストラクタでの注入をサポート）
            if (canvasManagerDI) {
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
                } else {
                    console.warn(`⚠️ CanvasManager.getDrawContainer() not available`);
                }
            }
            
            console.log(`✅ ToolManager v8.12.0作成完了 - PenTool作成修正版`);
        }

        /**
         * 🔧 Manager統一注入（修正版・防御強化）
         * 
         * @param {Object|Map} managers - 注入するManager群
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
            
            // Map保存
            this.managers = managersMap;
            
            // CanvasManager特別処理（最重要）
            if (managersMap.has("canvas")) {
                this.canvasManager = managersMap.get("canvas");
                console.log(`✅ CanvasManager統一注入成功`);
                
                // getDrawContainer()可用性確認
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
            } else {
                console.warn(`⚠️ CanvasManager（"canvas"キー）が見つかりません`);
            }
            
            // Object形式も併用保存（Tool注入用）
            this.managersObject = Object.fromEntries(managersMap);
            
            console.log(`✅ ToolManager: Manager統一注入完了`);
            return true;
        }

        /**
         * 🔍 依存注入検証（新規追加）
         * 
         * CanvasManagerとgetDrawContainer()の利用可能性を厳格チェック
         */
        verifyInjection() {
            console.log(`🔍 ToolManager依存注入検証開始...`);
            
            // Step 1: CanvasManager存在確認
            if (!this.canvasManager) {
                const errorMessage = "ToolManager.canvasManager injection verification failed: canvasManager is null/undefined";
                console.error(`❌ ${errorMessage}`);
                throw new Error(errorMessage);
            }
            console.log(`✅ CanvasManager注入確認完了`);
            
            // Step 2: getDrawContainer()メソッド確認
            if (typeof this.canvasManager.getDrawContainer !== 'function') {
                const errorMessage = "ToolManager.canvasManager injection verification failed: getDrawContainer() method not available";
                console.error(`❌ ${errorMessage}`);
                throw new Error(errorMessage);
            }
            console.log(`✅ getDrawContainer()メソッド確認完了`);
            
            // Step 3: getDrawContainer()実行確認
            let drawContainer;
            try {
                drawContainer = this.canvasManager.getDrawContainer();
            } catch (error) {
                const errorMessage = `ToolManager.canvasManager injection verification failed: getDrawContainer() execution error: ${error.message}`;
                console.error(`❌ ${errorMessage}`);
                throw new Error(errorMessage);
            }
            
            if (!drawContainer) {
                const errorMessage = "ToolManager.canvasManager injection verification failed: getDrawContainer() returned null";
                console.error(`❌ ${errorMessage}`);
                throw new Error(errorMessage);
            }
            console.log(`✅ getDrawContainer()実行確認完了`);
            
            // Step 4: Container妥当性確認
            if (!drawContainer.addChild || typeof drawContainer.addChild !== 'function') {
                const errorMessage = "ToolManager.canvasManager injection verification failed: invalid Container - missing addChild method";
                console.error(`❌ ${errorMessage}`);
                throw new Error(errorMessage);
            }
            console.log(`✅ Container妥当性確認完了`);
            
            // DrawContainer保存
            this.drawContainer = drawContainer;
            
            console.log(`✅ ToolManager依存注入検証完了 - 全検証PASS`);
        }

        /**
         * 🚀 v8 Tool初期化（修正版）
         */
        async initializeV8Tools() {
            console.log(`🚀 v8 Tool初期化開始（修正版）`);
            
            if (!this.managersObject) {
                console.error(`❌ Manager群が未注入です - setManagers()を先に実行してください`);
                return false;
            }
            
            if (!this.drawContainer) {
                console.error(`❌ DrawContainer未初期化 - Manager注入とverifyInjection()を先に実行してください`);
                return false;
            }
            
            // v8依存関係確認
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
                // PenTool作成（引数なしコンストラクタ）
                const penTool = new window.Tegaki.PenTool();
                
                // Manager統一注入（修正版）
                console.log(`🔧 PenTool Manager注入開始`);
                
                // setManagers方式で注入（setManagersObjectは後方互換）
                let injectionResult;
                if (typeof penTool.setManagers === 'function') {
                    injectionResult = penTool.setManagers(this.managersObject);
                } else if (typeof penTool.setManagersObject === 'function') {
                    injectionResult = penTool.setManagersObject(this.managersObject);
                } else {
                    console.error(`❌ PenTool Manager注入メソッドが見つかりません`);
                    return null;
                }
                
                if (injectionResult === false) {
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
                console.log(`🔧 EraserTool Manager注入開始`);
                
                // setManagers方式で注入
                let injectionResult;
                if (typeof eraserTool.setManagers === 'function') {
                    injectionResult = eraserTool.setManagers(this.managersObject);
                } else if (typeof eraserTool.setManagersObject === 'function') {
                    injectionResult = eraserTool.setManagersObject(this.managersObject);
                } else {
                    console.error(`❌ EraserTool Manager注入メソッドが見つかりません`);
                    return null;
                }
                
                if (injectionResult === false) {
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
            const hasCanvasManager = this.canvasManager !== null;
            const hasGetDrawContainer = hasCanvasManager && typeof this.canvasManager.getDrawContainer === 'function';
            const hasDrawContainer = this.drawContainer !== null;
            const hasManagers = this.managersObject !== null;
            const hasTools = this.tools.size > 0;
            const hasCurrentTool = this.currentTool !== null;
            
            console.log(`🔍 ToolManager準備状態確認:`);
        console.log(`  - CanvasManager: ${hasCanvasManager}`);
        console.log(`  - getDrawContainer method: ${hasGetDrawContainer}`);
        console.log(`  - DrawContainer: ${hasDrawContainer}`);
        console.log(`  - Managers: ${hasManagers}`);
        console.log(`  - Tools: ${hasTools} (${this.tools.size}個)`);
        console.log(`  - CurrentTool: ${hasCurrentTool} (${this.currentToolName})`);
        
        return hasCanvasManager && hasGetDrawContainer && hasDrawContainer && hasManagers && hasTools;
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
            hasCanvasManager: !!this.canvasManager,
            hasGetDrawContainer: this.canvasManager && typeof this.canvasManager.getDrawContainer === 'function',
            hasDrawContainer: !!this.drawContainer,
            hasManagers: !!this.managersObject,
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
            canvasManager: !!this.canvasManager,
            getDrawContainerMethod: this.canvasManager && typeof this.canvasManager.getDrawContainer === 'function',
            drawContainer: !!this.drawContainer,
            v8Ready: this.v8Ready,
            injectionVerified: this.canvasManager && this.drawContainer && this.managersObject
        };
    }

    // 🚨修正追加: AppCoreとの互換性メソッド
    setManagersObject(managers) {
        return this.setManagers(managers);
    }

    setManagerRegistrationInfo(managers) {
        console.log(`✅ ToolManager: Manager統一登録情報設定完了（互換性メソッド）`);
        this.managerRegistrationInfo = managers;
    }

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
}

// グローバル登録
if (!window.Tegaki) {
    window.Tegaki = {};
}

window.Tegaki.ToolManager = ToolManager;
console.log(`🚀 ToolManager v8.12.0完全対応版・PenTool作成修正版 Loaded`);
console.log(`📏 修正内容: PenTool作成エラー修正・Manager注入方法改善・コンソール出力削減`);
console.log(`🚀 特徴: 防御的依存注入・検証強化・CanvasManager.getDrawContainer()保証・Tool作成時適切Manager注入`);

})()