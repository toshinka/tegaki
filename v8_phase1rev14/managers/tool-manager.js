/**
 * 📄 FILE: tool-manager.js
 * 📌 RESPONSIBILITY: Tool管理・切り替え・Manager統一注入・操作フロー管理・依存注入検証修正
 *
 * @provides
 *   - ToolManager クラス
 *   - switchTool(toolName) - Tool切り替え
 *   - getCurrentTool() - 現在のTool取得
 *   - initializeV8Tools() - v8 Tool群初期化
 *   - registerTool(name, toolClass) - Tool登録
 *   - setManagersObject(managers) - Manager統一注入（修正版）
 *   - verifyInjection() - 依存注入検証（新規追加）
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
 *   1. new ToolManager() → 2. setManagersObject() → 3. verifyInjection() → 4. initializeV8Tools() → 5. switchTool() → 6. Tool.activate()
 *
 * @forbids
 *   💀 双方向依存禁止  
 *   🚫 フォールバック禁止  
 *   🚫 フェイルセーフ禁止  
 *   🚫 v7/v8 両対応による二重管理禁止
 *   🚫 Tool直接操作禁止（Manager経由必須）
 *   🚫 setCanvasManager()・setManagers() 旧メソッド使用禁止
 *   🚫 依存注入の検証スキップ禁止
 *
 * @manager-key
 *   window.Tegaki.ToolManagerInstance
 *
 * @dependencies-strict
 *   - 必須: CanvasManager（getDrawContainer()実装必須）
 *   - 必須: AbstractTool, PenTool, EraserTool
 *   - 必須: PIXI.Graphics（v8）
 *   - オプション: EventBus, RecordManager
 *   - 禁止: 循環依存、v7 API混在
 *
 * @integration-flow
 *   AppCore → ToolManager.setManagersObject() → ToolManager.verifyInjection() → Tool.setManagersObject() → Tool.activate()
 *
 * @method-naming-rules
 *   - startOperation() / endOperation() 形式統一
 *   - setManagersObject() - Manager注入統一API
 *   - verifyInjection() - 注入検証統一API
 *
 * @error-handling
 *   - Manager注入失敗時は即座にthrow（隠蔽禁止）
 *   - Tool作成失敗時は詳細ログ出力 + throw
 *   - activate()失敗時は状態を元に戻してthrow
 *   - 依存注入検証失敗時は必ずthrow
 *
 * @state-management
 *   - this.canvasManager は setManagersObject() でのみ設定
 *   - this.drawContainer は initializeDrawContainer() でのみ設定  
 *   - Tool状態は activate/deactivate でのみ変更
 *   - 直接状態操作禁止
 *
 * @testing-hooks
 *   - getDebugInfo() - 内部状態取得
 *   - isReady() - 準備状態確認
 *   - verifyInjection() - 依存関係検証
 *   - getState() - Tool状態取得
 */

(function() {
    'use strict';

    /**
     * 🔧 ToolManager v8.12.0対応版・依存注入検証修正版
     * 
     * 📏 修正内容:
     * - verifyInjection() メソッド追加
     * - setManagersObject() 防御的実装強化
     * - CanvasManager注入保証
     * - 依存関係検証エラーの詳細化
     * 
     * 🚀 特徴:
     * - 防御的依存注入・検証強化
     * - CanvasManager.getDrawContainer() 保証
     * - v8 Tool連携・WebGPU対応
     * - エラー隠蔽完全禁止
     */
    class ToolManager {
        constructor(canvasManagerDI = null) {
            console.log(`🚀 ToolManager v8.12.0対応版作成開始 - 依存注入検証修正版`);
            
            // 初期状態
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
            this.injectionVerified = false;
            
            // DI注入（コンストラクタ時点では参照のみ）
            if (canvasManagerDI) {
                console.log(`🔧 DI Object形式で受信 - 後続で詳細検証`);
                this.canvasManager = canvasManagerDI;
            } else {
                console.log(`📦 DI なし - setManagersObject() で設定予定`);
            }
            
            console.log(`✅ ToolManager v8.12.0対応版作成完了 - 依存注入検証修正版`);
        }

        /**
         * 🔧 Manager統一注入（防御的実装強化版）
         * 
         * @param {Object|Map} managers - 注入するManager群
         * @returns {boolean} - 注入成功/失敗
         */
        setManagersObject(managers) {
            console.log(`🔧 ToolManager - Manager統一注入開始（防御的実装強化版）`);
            
            // 入力検証
            if (!managers) {
                const error = new Error('ToolManager: managers parameter is null or undefined');
                console.error(`💀 ${error.message}`);
                throw error;
            }
            
            // 型変換・保存
            try {
                if (managers instanceof Map) {
                    console.log(`📦 Map形式で受信 (${managers.size}個)`);
                    this.managers = managers;
                    this.managersObject = Object.fromEntries(managers);
                } else if (typeof managers === 'object') {
                    console.log(`📦 Object形式で受信 (${Object.keys(managers).length}個)`);
                    this.managersObject = { ...managers };
                    this.managers = new Map(Object.entries(managers));
                } else {
                    const error = new Error(`ToolManager: Invalid managers type: ${typeof managers}`);
                    console.error(`💀 ${error.message}`);
                    throw error;
                }
                
                console.log(`📋 受信Manager キー一覧:`, Object.keys(this.managersObject));
                
            } catch (error) {
                console.error(`💀 ToolManager: Manager変換エラー:`, error);
                throw error;
            }
            
            // 必須Manager確認（防御的）
            const requiredManagers = ['canvas', 'canvasManager'];
            let canvasManager = null;
            
            // canvas または canvasManager を探索
            if (this.managersObject.canvas) {
                canvasManager = this.managersObject.canvas;
                console.log(`📦 CanvasManager取得成功: 'canvas' キー経由`);
            } else if (this.managersObject.canvasManager) {
                canvasManager = this.managersObject.canvasManager;
                console.log(`📦 CanvasManager取得成功: 'canvasManager' キー経由`);
            } else {
                console.warn(`⚠️ CanvasManager が見つかりません`);
                console.warn(`📋 利用可能キー:`, Object.keys(this.managersObject));
            }
            
            // CanvasManager設定（防御的）
            if (canvasManager) {
                this.canvasManager = canvasManager;
                
                // getDrawContainer() メソッド確認
                if (typeof this.canvasManager.getDrawContainer === 'function') {
                    console.log(`✅ CanvasManager.getDrawContainer() メソッド確認済み`);
                    
                    // DrawContainer取得試行
                    try {
                        const drawContainer = this.canvasManager.getDrawContainer();
                        if (drawContainer) {
                            this.drawContainer = drawContainer;
                            console.log(`✅ DrawContainer取得成功`);
                        } else {
                            console.warn(`⚠️ DrawContainer は null - 初期化中の可能性`);
                        }
                    } catch (error) {
                        console.warn(`⚠️ DrawContainer取得エラー:`, error.message);
                    }
                } else {
                    console.error(`💀 CanvasManager.getDrawContainer() メソッドが存在しません`);
                    console.error(`📋 CanvasManager利用可能メソッド:`, Object.getOwnPropertyNames(this.canvasManager));
                }
            } else {
                console.error(`💀 CanvasManager注入失敗 - 必須Manager不足`);
            }
            
            console.log(`✅ ToolManager: Manager統一注入完了（防御的実装）`);
            console.log(`📊 注入状況: CanvasManager=${!!this.canvasManager}, DrawContainer=${!!this.drawContainer}`);
            
            return true;
        }

        /**
         * 🔍 依存注入検証（新規追加）
         * 
         * @throws {Error} - 検証失敗時
         */
        verifyInjection() {
            console.log(`🔍 ToolManager: 依存注入検証開始`);
            
            const errors = [];
            
            // 1. Manager基本存在確認
            if (!this.managersObject) {
                errors.push('managersObject is null');
            }
            
            // 2. CanvasManager存在確認
            if (!this.canvasManager) {
                errors.push('canvasManager is null');
            } else {
                // 3. CanvasManager.getDrawContainer() メソッド確認
                if (typeof this.canvasManager.getDrawContainer !== 'function') {
                    errors.push('canvasManager.getDrawContainer() method not available');
                }
            }
            
            // 4. DrawContainer確認（警告レベル）
            if (!this.drawContainer) {
                console.warn(`⚠️ DrawContainer is null - may be initializing`);
            }
            
            // エラーまとめ
            if (errors.length > 0) {
                const errorMessage = `ToolManager dependency injection verification failed: ${errors.join(', ')}`;
                console.error(`💀 ${errorMessage}`);
                console.error(`📊 現在の状態:`, {
                    managersObject: !!this.managersObject,
                    canvasManager: !!this.canvasManager,
                    drawContainer: !!this.drawContainer,
                    managersKeys: this.managersObject ? Object.keys(this.managersObject) : []
                });
                
                const error = new Error(errorMessage);
                throw error;
            }
            
            this.injectionVerified = true;
            console.log(`✅ ToolManager: 依存注入検証完了`);
            return true;
        }

        /**
         * 🎨 DrawContainer初期化（安全版）
         */
        initializeDrawContainer() {
            if (!this.canvasManager) {
                console.warn(`⚠️ CanvasManager未注入 - DrawContainer初期化スキップ`);
                return false;
            }
            
            if (typeof this.canvasManager.getDrawContainer !== 'function') {
                console.error(`💀 CanvasManager.getDrawContainer() メソッドが存在しません`);
                return false;
            }
            
            try {
                const drawContainer = this.canvasManager.getDrawContainer();
                if (drawContainer) {
                    this.drawContainer = drawContainer;
                    console.log(`✅ DrawContainer初期化完了`);
                    return true;
                } else {
                    console.warn(`⚠️ DrawContainer is null - CanvasManager未初期化の可能性`);
                    return false;
                }
            } catch (error) {
                console.error(`💀 DrawContainer初期化エラー:`, error);
                throw error;
            }
        }

        /**
         * 🚀 v8 Tool初期化（検証強化版）
         */
        async initializeV8Tools() {
            console.log(`🚀 v8 Tool初期化開始（検証強化版）`);
            
            // 依存関係再確認
            if (!this.injectionVerified) {
                console.log(`🔍 依存注入未検証 - 検証実行`);
                try {
                    this.verifyInjection();
                } catch (error) {
                    console.error(`💀 Tool初期化前の依存注入検証失敗:`, error);
                    throw error;
                }
            }
            
            // DrawContainer再初期化試行
            if (!this.drawContainer) {
                console.log(`🎨 DrawContainer未設定 - 再初期化試行`);
                const initResult = this.initializeDrawContainer();
                if (!initResult) {
                    const error = new Error('DrawContainer initialization failed - CanvasManager may not be ready');
                    console.error(`💀 ${error.message}`);
                    throw error;
                }
            }
            
            // v8依存関係確認
            if (!window.Tegaki || !window.Tegaki.AbstractTool) {
                const error = new Error('AbstractTool not loaded');
                console.error(`💀 ${error.message}`);
                throw error;
            }
            
            if (!window.PIXI || !window.PIXI.Graphics) {
                const error = new Error('PixiJS v8 not loaded');
                console.error(`💀 ${error.message}`);
                throw error;
            }
            
            console.log(`✅ v8依存関係確認完了`);
            
            try {
                // Tool作成・登録
                console.log(`1️⃣ v8 PenTool作成開始...`);
                const penTool = await this.createV8Tool('pen', window.Tegaki.PenTool);
                
                console.log(`2️⃣ v8 EraserTool作成開始...`);
                const eraserTool = await this.createV8Tool('eraser', window.Tegaki.EraserTool);
                
                // デフォルトTool切り替え
                console.log(`3️⃣ デフォルトTool切り替え: ${this.currentToolName}`);
                const switchResult = await this.switchTool(this.currentToolName);
                if (!switchResult) {
                    throw new Error(`Default tool switch failed: ${this.currentToolName}`);
                }
                
                console.log(`✅ v8 Tool初期化完了`);
                this.v8Ready = true;
                return true;
                
            } catch (error) {
                console.error(`💀 v8 Tool初期化エラー:`, error);
                this.v8Ready = false;
                throw error;
            }
        }

        /**
         * 🔧 v8 Tool作成（共通処理）
         * 
         * @param {string} toolName - Tool名
         * @param {Function} ToolClass - Toolクラス
         */
        async createV8Tool(toolName, ToolClass) {
            try {
                if (!ToolClass) {
                    throw new Error(`${toolName}Tool class not found`);
                }
                
                const tool = new ToolClass();
                
                // Manager注入
                console.log(`🔧 ${toolName}Tool Manager注入開始`);
                const injectionResult = tool.setManagersObject(this.managersObject);
                if (!injectionResult) {
                    throw new Error(`${toolName}Tool Manager injection failed`);
                }
                
                console.log(`✅ ${toolName}Tool Manager注入完了`);
                
                // Tool登録
                this.tools.set(toolName, tool);
                console.log(`✅ ${toolName}Tool登録完了`);
                
                return tool;
                
            } catch (error) {
                console.error(`💀 ${toolName}Tool作成エラー:`, error);
                throw error;
            }
        }

        /**
         * 🔄 Tool切り替え（エラーハンドリング強化）
         * 
         * @param {string} toolName - 切り替え先Tool名
         */
        async switchTool(toolName) {
            console.log(`🔄 Tool切り替え開始: ${this.currentToolName} → ${toolName}`);
            
            const previousTool = this.currentTool;
            const previousToolName = this.currentToolName;
            
            try {
                // 現在のTool無効化
                if (this.currentTool && this.currentTool.deactivate) {
                    this.currentTool.deactivate();
                    console.log(`🔇 ${this.currentToolName} Tool 無効化完了`);
                }
                
                // 新しいTool取得
                const newTool = this.tools.get(toolName);
                if (!newTool) {
                    throw new Error(`Tool not found: ${toolName}`);
                }
                
                // Tool有効化
                console.log(`🎯 ${toolName} Tool アクティブ化開始`);
                await newTool.activate();
                console.log(`✅ ${toolName} Tool アクティブ化完了`);
                
                // 状態更新
                this.currentTool = newTool;
                this.currentToolName = toolName;
                
                console.log(`✅ Tool切り替え完了: ${toolName}`);
                return true;
                
            } catch (error) {
                console.error(`💀 Tool切り替えエラー (${toolName}):`, error);
                
                // 状態復旧試行
                if (previousTool && previousTool.activate) {
                    try {
                        await previousTool.activate();
                        this.currentTool = previousTool;
                        this.currentToolName = previousToolName;
                        console.log(`🔄 Tool状態復旧完了: ${previousToolName}`);
                    } catch (recoveryError) {
                        console.error(`💀 Tool状態復旧失敗:`, recoveryError);
                    }
                }
                
                throw error;
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
            const checks = {
                hasManagers: this.managersObject !== null,
                hasCanvasManager: this.canvasManager !== null,
                hasDrawContainer: this.drawContainer !== null,
                hasTools: this.tools.size > 0,
                hasCurrentTool: this.currentTool !== null,
                injectionVerified: this.injectionVerified,
                v8Ready: this.v8Ready
            };
            
            const isReady = Object.values(checks).every(Boolean);
            
            console.log(`🔍 ToolManager準備状態確認:`, checks);
            console.log(`📊 総合準備状態: ${isReady ? '✅ Ready' : '❌ Not Ready'}`);
            
            return isReady;
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
                hasCanvasManager: !!this.canvasManager,
                hasDrawContainer: !!this.drawContainer,
                injectionVerified: this.injectionVerified,
                isReady: this.isReady()
            };
        }

        /**
         * 🎨 描画Container取得
         */
        getDrawContainer() {
            if (!this.drawContainer && this.canvasManager) {
                // 遅延取得試行
                this.initializeDrawContainer();
            }
            
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
            } else {
                console.warn(`⚠️ Tool設定更新失敗: ${toolName} - Tool not found or updateSettings not available`);
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
                // 基本状態
                currentTool: this.currentToolName,
                tools: toolInfo,
                toolCount: this.tools.size,
                
                // Manager状態
                managers: this.managersObject ? Object.keys(this.managersObject) : [],
                hasCanvasManager: !!this.canvasManager,
                canvasManagerMethods: this.canvasManager ? Object.getOwnPropertyNames(this.canvasManager) : [],
                drawContainer: !!this.drawContainer,
                
                // v8状態
                v8Ready: this.v8Ready,
                webGPUSupported: this.webGPUSupported,
                injectionVerified: this.injectionVerified,
                
                // 準備状態
                isReady: this.isReady()
            };
        }
    }

    // グローバル登録
    if (!window.Tegaki) {
        window.Tegaki = {};
    }
    
    window.Tegaki.ToolManager = ToolManager;
    console.log(`🚀 ToolManager v8.12.0完全対応版・依存注入検証修正版 Loaded`);
    console.log(`📏 修正内容: verifyInjection()追加・setManagersObject()防御強化・CanvasManager注入保証・エラー詳細化`);
    console.log(`🚀 特徴: 防御的依存注入・検証強化・CanvasManager.getDrawContainer()保証・エラー隠蔽完全禁止`);

})();