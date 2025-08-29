/**
 * 📄 FILE: abstract-tool.js
 * 📌 RESPONSIBILITY: Tool共通基盤・Manager統一注入・操作フロー管理
 *
 * @provides
 *   - AbstractTool クラス
 *   - getManager(key) - Manager統一取得
 *   - activate() - Tool有効化
 *   - deactivate() - Tool無効化
 *   - startOperation(event) - 操作開始
 *   - endOperation(event) - 操作終了
 *
 * @uses
 *   - なし（基底クラス・他ファイル依存なし）
 *
 * @initflow
 *   1. new AbstractTool() → 2. setManagersObject() → 3. activate() → 4. startOperation() → 5. endOperation() → 6. deactivate()
 *
 * @forbids
 *   - 双方向依存禁止 (💀)
 *   - フォールバック禁止
 *   - フェイルセーフ禁止
 *   - v7/v8 両対応による二重管理禁止
 *   - RecordManagerInstance 直接参照禁止
 *
 * @manager-key
 *   - 各ツール継承先で設定
 */

(function() {
    'use strict';

    /**
     * 🎯 AbstractTool Phase1.5 Manager統一注入・Manager名称統一修正版
     * 
     * 📏 修正内容:
     * - event → eventbus に統一
     * - Object形式前提・Map対策
     * - 型安全性確保・詳細デバッグ
     * - RecordManagerInstance 直接参照禁止
     * 
     * 🚀 特徴:
     * - startOperation/endOperation方式対応
     * - Manager統一注入完成
     * - 架空メソッド削除
     * - Manager名称統一対応
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
         * 🔧 Manager統一注入（修正版）
         * 
         * @param {Object|Map} managers - 注入するManager群
         */
        setManagersObject(managers) {
            console.log(`🔧 ${this.toolName} Manager統一注入開始...（修正版）`);
            
            if (!managers) {
                console.error(`❌ ${this.toolName}: Manager が null または undefined です`);
                return false;
            }

            // Map → Object 変換処理
            if (managers instanceof Map) {
                console.log(`📦 ${this.toolName} 受信Manager型: Map`);
                console.log(`📦 ${this.toolName} 受信Manager内容:`, managers);
                
                const convertedManagers = {};
                for (const [key, value] of managers) {
                    convertedManagers[key] = value;
                }
                this.managers = convertedManagers;
                console.log(`✅ Map→Object変換完了`);
            } else if (typeof managers === 'object') {
                console.log(`📦 ${this.toolName} 受信Manager型: Object`);
                console.log(`📦 ${this.toolName} 受信Manager内容:`, managers);
                this.managers = managers;
            } else {
                console.error(`❌ ${this.toolName}: 無効なManager形式:`, typeof managers);
                return false;
            }

            // 保存確認
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

            console.log(`✅ ${this.toolName}: 必須Manager確認完了:`, requiredManagers);
            console.log(`✅ ${this.toolName}: Manager統一注入完了（Object形式）`);
            return true;
        }

        /**
         * 🔍 Manager取得（統一API・Manager名称統一修正版）
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
         * 🎯 Tool有効化（Manager名称統一修正版）
         */
        activate() {
            console.log(`🎯 ${this.toolName} Tool アクティブ化`);
            
            try {
                // Manager取得（統一名称）
                this.canvasManager = this.getManager('canvas');
                this.coordinateManager = this.getManager('coordinate');
                this.recordManager = this.getManager('record');
                this.eventManager = this.getManager('eventbus'); // ← 修正: event → eventbus
                this.configManager = this.getManager('config');
                
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
            console.log(`🔄 ${this.toolName} Tool 無効化`);
            
            // 操作中の場合は終了
            if (this.isOperating) {
                this.forceEndOperation();
            }
            
            this.isActive = false;
            this.drawContainer = null;
            this.currentStroke = null;
            
            console.log(`✅ ${this.toolName} Tool 無効化完了`);
        }

        /**
         * 🚀 操作開始
         * 
         * @param {Object} event - イベントオブジェクト
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
         */
        isReady() {
            return this.isActive && 
                   this.managers !== null && 
                   this.canvasManager && 
                   this.drawContainer;
        }

        /**
         * 📊 Tool状態取得
         */
        getState() {
            return {
                toolName: this.toolName,
                isActive: this.isActive,
                isOperating: this.isOperating,
                isReady: this.isReady(),
                hasDrawContainer: !!this.drawContainer,
                managerCount: this.managers ? Object.keys(this.managers).length : 0
            };
        }

        /**
         * 🔧 Manager統一登録情報設定
         * 
         * @param {Object} registrationInfo - 登録情報
         */
        setRegistrationInfo(registrationInfo) {
            this.registrationInfo = registrationInfo;
            console.log(`🔧 ${this.toolName}: 登録情報設定完了`);
        }
    }

    // グローバル登録
    if (!window.Tegaki) {
        window.Tegaki = {};
    }
    
    window.Tegaki.AbstractTool = AbstractTool;
    console.log(`🎯 AbstractTool Phase1.5 Manager統一注入・Manager名称統一修正版 Loaded`);
    console.log(`📏 修正内容: event → eventbus統一・Object形式前提・Map対策・型安全性確保・詳細デバッグ`);
    console.log(`🚀 特徴: startOperation/endOperation方式対応・Manager統一注入完成・架空メソッド削除・Manager名称統一対応`);

})();