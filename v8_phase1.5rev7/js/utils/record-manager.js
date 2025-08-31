/**
 * 📄 FILE: js/utils/record-manager.js
 * 📌 RESPONSIBILITY: 描画記録管理・ストローク保存・Phase1.5最小実装
 * ChangeLog: 2025-09-01 <Minimal implementation with lifecycle methods>
 * 
 * @provides
 *   - RecordManager（クラス）
 *   - configure(config) - 設定注入
 *   - attach(context) - コンテキスト注入
 *   - init() - 初期化
 *   - isReady() - 準備完了確認
 *   - dispose() - 解放
 *   - addStroke(strokeData) - ストローク追加
 *
 * @uses
 *   - なし（独立動作）
 *
 * @initflow
 *   1. configure(config) - 設定
 *   2. attach(context) - アタッチ
 *   3. init() - 初期化完了
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 フォールバック禁止
 *   🚫 架空メソッド呼び出し禁止
 *
 * @manager-key
 *   window.Tegaki.RecordManagerInstance
 */

(function() {
    'use strict';

    /**
     * RecordManager - 最小実装版
     * Phase1.5で必要な最低限の機能のみ
     */
    class RecordManager {
        constructor() {
            this._configured = false;
            this._attached = false;
            this._initialized = false;
            this._strokes = [];
            this._currentStroke = null;
        }

        // ========================================
        // 統一ライフサイクル（Manager契約）
        // ========================================

        /**
         * 設定注入
         * @param {Object} config - 設定オブジェクト
         */
        configure(config = {}) {
            this._configured = true;
            return true;
        }

        /**
         * コンテキスト注入
         * @param {Object} context - コンテキスト
         */
        attach(context = {}) {
            this._attached = true;
            return true;
        }

        /**
         * 初期化
         * @returns {Promise<boolean>}
         */
        async init() {
            if (!this._configured || !this._attached) {
                throw new Error('RecordManager: configure and attach must be called before init');
            }
            
            this._initialized = true;
            return true;
        }

        /**
         * 準備完了確認
         * @returns {boolean}
         */
        isReady() {
            return this._configured && this._attached && this._initialized;
        }

        /**
         * 解放
         */
        dispose() {
            this._strokes = [];
            this._currentStroke = null;
            this._configured = false;
            this._attached = false;
            this._initialized = false;
        }

        // ========================================
        // ストローク記録機能
        // ========================================

        /**
         * ストローク追加
         * @param {Object} strokeData - ストロークデータ
         */
        addStroke(strokeData) {
            if (!this.isReady()) {
                console.warn('RecordManager not ready - stroke not recorded');
                return false;
            }

            const stroke = {
                id: Date.now() + Math.random(),
                timestamp: Date.now(),
                tool: strokeData.tool || 'pen',
                points: strokeData.points || [],
                style: strokeData.style || {},
                ...strokeData
            };

            this._strokes.push(stroke);
            return true;
        }

        /**
         * 現在のストローク取得
         * @returns {Object|null}
         */
        getCurrentStroke() {
            return this._currentStroke;
        }

        /**
         * 全ストローク取得
         * @returns {Array}
         */
        getAllStrokes() {
            return [...this._strokes];
        }

        /**
         * ストローク数取得
         * @returns {number}
         */
        getStrokeCount() {
            return this._strokes.length;
        }

        /**
         * デバッグ情報取得
         * @returns {Object}
         */
        getDebugInfo() {
            return {
                configured: this._configured,
                attached: this._attached,
                initialized: this._initialized,
                ready: this.isReady(),
                strokeCount: this._strokes.length,
                currentStroke: !!this._currentStroke
            };
        }
    }

    // グローバル登録
    if (!window.Tegaki) {
        window.Tegaki = {};
    }
    window.Tegaki.RecordManager = RecordManager;
    
    console.log('🔄 RecordManager Minimal v8対応版 Loaded - ライフサイクル実装・ストローク記録機能');

})();