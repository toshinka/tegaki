/**
 * 📄 FILE: tools/abstract-tool.js
 * 📌 RESPONSIBILITY: Tool共通基盤・Manager統一注入・操作フロー管理・API統一
 *
 * @provides
 *   - AbstractTool クラス
 *   - setManagersObject(managers) - Manager統一注入（正規メソッド）
 *   - setManagers(managers) - Manager統一注入（エイリアス・後方互換性）
 *   - getManager(key) - Manager統一取得
 *   - activate() - Tool有効化
 *   - deactivate() - Tool無効化
 *   - startOperation(event) - 操作開始
 *   - endOperation(event) - 操作終了
 *   - isReady() - Tool準備状態確認
 *
 * @uses
 *   - なし（基底クラス・他ファイル依存なし）
 *
 * @initflow
 *   1. new AbstractTool() → 2. setManagersObject() → 3. activate() → 4. startOperation() → 5. endOperation() → 6. deactivate()
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 フォールバック禁止
 *   🚫 フェイルセーフ禁止
 *   🚫 v7/v8 両対応による二重管理禁止
 *   🚫 未実装メソッド呼び出し禁止
 *
 * @manager-key
 *   - 各ツール継承先で設定
 *
 * @dependencies-strict
 *   REQUIRED: なし（基底クラス）
 *   OPTIONAL: なし
 *   FORBIDDEN: 他Tool・Manager直接参照
 *
 * @integration-flow
 *   ToolManager.initializeV8Tools() → new XxxTool() → setManagersObject() → activate()
 *
 * @method-naming-rules
 *   - setManagersObject() / setManagers() - Manager注入統一
 *   - startOperation() / endOperation() - 操作制御統一
 *   - activate() / deactivate() - ライフサイクル統一
 *   - getManager() - Manager取得統一
 *
 * @state-management
 *   - 描画状態は直接操作せず、専用メソッド経由
 *   - Manager参照は getManager() 経由で統一
 *   - 状態変更は必ずEventBus通知
 *
 * @performance-notes
 *   - Manager参照キャッシュで高速化
 *   - deactivate時の確実な解放
 *   - メモリリーク防止
 */

(function() {
    'use strict';

    /**
     * 🎯 AbstractTool Phase1.5 最終修正版 - Manager注入API統一・メソッド名修正
     * 
     * 📏 修正内容:
     * - setManagersObject() 正規メソッド確立
     * - setManagers() エイリアス追加（後方互換性）
     * - Manager注入フローの完全統一
     * - 型安全性・エラーハンドリング強化
     * 
     * 🚀 特徴:
     * - API統一による継承クラス安定化
     * - Manager名称統一完全対応
     * - 確実な状態管理・メモリ管理
     */
    class AbstractTool {
        constructor(toolName = 'unknown') {
            this.toolName = toolName;
            this.isActive = false;
            this.isOperating = false;
            this.managers = null;
            
            // v8専用プロパティ
            this.drawContainer = null;
            this.currentStroke = null;
            
            // Manager参照キャッシュ（性能最適化）
            this.canvasManager = null;
            this.coordinateManager = null;
            this.recordManager = null;
            this.eventManager = null;
            this.configManager = null;
            
            console.log(`🎯 AbstractTool 作成開始: ${toolName}`);
            this.initializeV8Features();
            console.log(`✅ ${toolName} AbstractTool 作成完了`);
        }

        /**
         * 🚀 v8機能初期化
         */
        initializeV8Features() {
            // v8対応の基本設定
            this.v8Ready = false;
            this.webGPUSupported = window.PIXI && window.PIXI.Graphics;
        }

        /**
         * 🔧 Manager統一注入（正規メソッド）
         * 
         * @param {Object|Map} managers - 注入するManager群
         * @returns {boolean} 注入成功フラグ
         */
        setManagersObject(managers) {
            console.log(`🔧 ${this.toolName} Manager統一注入開始（正規メソッド）`);
            
            if (!managers) {
                console.error(`❌ ${this.toolName}: Manager が null または undefined です`);
                return false;
            }

            // 型判定・変換処理
            let processedManagers;
            
            if (managers instanceof Map) {
                console.log(`📦 ${this.toolName} 受信Manager型: Map → Object変換`);
                processedManagers = {};
                for (const [key, value] of managers) {
                    processedManagers[key] = value;
                }
                console.log(`✅ Map→Object変換完了`);
            } else if (typeof managers === 'object') {
                console.log(`📦 ${this.toolName} 受信Manager型: Object（直接使用）`);
                processedManagers = managers;
            } else {
                console.error(`❌ ${this.toolName}: 無効なManager形式:`, typeof managers);
                return false;
            }

            // Manager保存
            this.managers = processedManagers;
            console.log(`✅ ${this.toolName}: Manager群をObject形式で保存完了`);
            console.log(`📋 ${this.toolName} 利用可能Manager キー:`, Object.keys(this.managers));
            console.log(`📋 ${this.toolName} 利用可能Manager数:`, Object.keys(this.managers).length);

            // 詳細Manager確認（デバッグ用）
            for (const [key, manager] of Object.entries(this.managers)) {
                const managerType = manager?.constructor?.name || 'Unknown';
                console.log(`📦 ${this.toolName} Manager[${key}]: ${managerType}`);
            }

            // 必須Manager確認
            const requiredManagers = ['canvas', 'coordinate', 'record'];
            const missingManagers = [];
            
            for (const required of requiredManagers) {
                const exists = this.managers.hasOwnProperty(required);
                const hasValue = exists && this.managers[required];
                console.log(`🔍 ${this.toolName} 必須Manager[${required}]: exists=${exists}, hasValue=${hasValue}`);
                
                if (!hasValue) {
                    missingManagers.push(required);
                }
            }

            if (missingManagers.length > 0) {
                console.error(`❌ ${this.toolName}: 必須Manager不足:`, missingManagers);
                return false;
            }

            // Manager参照キャッシュ作成（性能最適化）
            this.createManagerCache();

            console.log(`✅ ${this.toolName}: 必須Manager確認完了:`, requiredManagers);
            console.log(`✅ ${this.toolName}: Manager統一注入完了（正規メソッド）`);
            return true;
        }

        /**
         * 🔄 Manager統一注入（エイリアス・後方互換性）
         * 
         * @param {Object|Map} managers - 注入するManager群
         * @returns {boolean} 注入成功フラグ
         */
        setManagers(managers) {
            console.log(`🔄 ${this.toolName} Manager統一注入（エイリアス経由）`);
            return this.setManagersObject(managers);
        }

        /**
         * 📦 Manager参照キャッシュ作成（性能最適化）
         */
        createManagerCache() {
            console.log(`📦 ${this.toolName}: Manager参照キャッシュ作成開始`);
            
            // 必須Manager キャッシュ
            if (this.managers.canvas) {
                this.canvasManager = this.managers.canvas;
                console.log(`✅ ${this.toolName}: CanvasManager キャッシュ完了`);
            }
            
            if (this.managers.coordinate) {
                this.coordinateManager = this.managers.coordinate;
                console.log(`✅ ${this.toolName}: CoordinateManager キャッシュ完了`);
            }
            
            if (this.managers.record) {
                this.recordManager = this.managers.record;
                console.log(`✅ ${this.toolName}: RecordManager キャッシュ完了`);
            }
            
            // オプションManager キャッシュ
            if (this.managers.eventbus) {
                this.eventManager = this.managers.eventbus;
                console.log(`✅ ${this.toolName}: EventBus キャッシュ完了`);
            }
            
            if (this.managers.config) {
                this.configManager = this.managers.config;
                console.log(`✅ ${this.toolName}: ConfigManager キャッシュ完了`);
            }
            
            console.log(`✅ ${this.toolName}: Manager参照キャッシュ作成完了`);
        }

        /**
         * 🔍 Manager取得（統一API・Manager名称統一対応）
         * 
         * @param {string} key - Manager キー
         * @returns {Object} Manager インスタンス
         */
        getManager(key) {
            if (!this.managers) {
                throw new Error(`${this.toolName}: Manager群が初期化されていません`);
            }

            // Manager名称統一対応
            let actualKey = key;
            if (key === 'event') {
                actualKey = 'eventbus';
                console.log(`🔄 ${this.toolName}: Manager名称統一 'event' → 'eventbus'`);
            }

            if (!this.managers.hasOwnProperty(actualKey)) {
                const availableKeys = Object.keys(this.managers).join(', ');
                throw new Error(`${this.toolName}: Manager '${key}' が見つかりません。利用可能: ${availableKeys}`);
            }

            const manager = this.managers[actualKey];
            if (!manager) {
                throw new Error(`${this.toolName}: Manager '${actualKey}' が null です`);
            }

            return manager;
        }

        /**
         * 🎯 Tool有効化
         */
        activate() {
            console.log(`🎯 ${this.toolName} Tool アクティブ化開始`);
            
            try {
                // Manager準備確認
                if (!this.managers) {
                    throw new Error('Manager群が未注入です');
                }
                
                // キャッシュ済みManager活用
                if (!this.canvasManager) {
                    throw new Error('CanvasManager が未準備です');
                }
                
                // DrawContainer取得
                if (this.canvasManager && this.canvasManager.getDrawContainer) {
                    this.drawContainer = this.canvasManager.getDrawContainer();
                    console.log(`📦 ${this.toolName}: DrawContainer取得完了`);
                } else {
                    console.warn(`⚠️ ${this.toolName}: DrawContainer取得失敗`);
                }

                this.isActive = true;
                console.log(`✅ ${this.toolName} Tool アクティブ化完了`);
                
            } catch (error) {
                console.error(`💀 ${this.toolName} Tool アクティブ化エラー:`, error.message);
                throw error;
            }
        }

        /**
         * 🔄 Tool無効化
         */
        deactivate() {
            console.log(`🔄 ${this.toolName} Tool 無効化開始`);
            
            // 操作中の場合は終了
            if (this.isOperating) {
                this.forceEndOperation();
            }
            
            // 状態リセット
            this.isActive = false;
            this.drawContainer = null;
            this.currentStroke = null;
            
            // Manager参照キャッシュクリア（メモリリーク防止）
            this.canvasManager = null;
            this.coordinateManager = null;
            this.recordManager = null;
            this.eventManager = null;
            this.configManager = null;
            
            console.log(`✅ ${this.toolName} Tool 無効化完了`);
        }

        /**
         * 🚀 操作開始
         * 
         * @param {Object} event - イベントオブジェクト
         * @returns {boolean} 操作開始成功フラグ
         */
        startOperation(event) {
            if (!this.isActive) {
                console.warn(`⚠️ ${this.toolName}: 非アクティブ状態で操作開始要求`);
                return false;
            }

            if (this.isOperating) {
                console.warn(`⚠️ ${this.toolName}: 既に操作中です`);
                return false;
            }

            console.log(`🚀 ${this.toolName}: 操作開始`);
            this.isOperating = true;
            
            // RecordManager経由で記録開始（統一API使用）
            if (this.recordManager && this.recordManager.startOperation) {
                this.recordManager.startOperation(this.toolName, event);
            }
            
            return true;
        }

        /**
         * 🏁 操作終了
         * 
         * @param {Object} event - イベントオブジェクト
         * @returns {boolean} 操作終了成功フラグ
         */
        endOperation(event) {
            if (!this.isOperating) {
                return false;
            }

            console.log(`🏁 ${this.toolName}: 操作終了`);
            this.isOperating = false;
            this.currentStroke = null;
            
            // RecordManager経由で記録終了（統一API使用）
            if (this.recordManager && this.recordManager.endOperation) {
                this.recordManager.endOperation(this.toolName, event);
            }
            
            return true;
        }

        /**
         * 🛑 操作強制終了
         */
        forceEndOperation() {
            if (!this.isOperating) {
                return;
            }

            console.log(`🛑 ${this.toolName}: 操作強制終了`);
            this.isOperating = false;
            this.currentStroke = null;
            
            // RecordManager経由で強制終了
            if (this.recordManager && this.recordManager.forceEndOperation) {
                this.recordManager.forceEndOperation(this.toolName);
            }
        }

        /**
         * 🔍 Tool準備状態確認
         * 
         * @returns {boolean} 準備完了フラグ
         */
        isReady() {
            const ready = this.isActive && 
                         this.managers !== null && 
                         this.canvasManager && 
                         this.drawContainer;
            
            console.log(`🔍 ${this.toolName}: 準備状態 = ${ready}`);
            return ready;
        }

        /**
         * 📊 Tool状態取得
         * 
         * @returns {Object} Tool状態情報
         */
        getState() {
            return {
                toolName: this.toolName,
                isActive: this.isActive,
                isOperating: this.isOperating,
                isReady: this.isReady(),
                hasDrawContainer: !!this.drawContainer,
                managerCount: this.managers ? Object.keys(this.managers).length : 0,
                managerCache: {
                    canvasManager: !!this.canvasManager,
                    coordinateManager: !!this.coordinateManager,
                    recordManager: !!this.recordManager,
                    eventManager: !!this.eventManager,
                    configManager: !!this.configManager
                }
            };
        }

        /**
         * 🔧 デバッグ情報取得
         * 
         * @returns {Object} デバッグ情報
         */
        getDebugInfo() {
            return {
                className: 'AbstractTool',
                version: 'Phase1.5-Final',
                toolName: this.toolName,
                state: this.getState(),
                managers: this.managers ? {
                    available: Object.keys(this.managers),
                    count: Object.keys(this.managers).length,
                    types: Object.fromEntries(
                        Object.entries(this.managers).map(([key, manager]) => [
                            key, 
                            manager?.constructor?.name || 'Unknown'
                        ])
                    )
                } : null
            };
        }
    }

    // グローバル登録
    if (!window.Tegaki) {
        window.Tegaki = {};
    }
    
    window.Tegaki.AbstractTool = AbstractTool;
    console.log(`🎯 AbstractTool Phase1.5 最終修正版 Loaded - Manager注入API統一・メソッド名修正完了`);
    console.log(`📏 修正内容: setManagersObject()正規化・setManagers()エイリアス・Manager参照キャッシュ・型安全性強化`);
    console.log(`🚀 特徴: API統一・Manager名称統一・確実な状態管理・メモリリーク防止・後方互換性`);

})();