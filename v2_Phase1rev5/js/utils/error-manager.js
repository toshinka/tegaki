/**
 * 🚨 ErrorManager - エラー処理・ポップアップ表示統一システム (Phase1修正版)
 * ✅ UNIFIED_SYSTEM: エラー分類・統一表示・ログ記録システム
 * 📋 RESPONSIBILITY: 「エラー処理・分類・表示・記録」専門
 * 
 * 📏 DESIGN_PRINCIPLE: 基盤システム・循環依存なし
 * 🎯 TEGAKI_NAMESPACE: Tegaki名前空間統一対応済み
 * 🔧 REGISTRY_READY: 初期化レジストリ対応済み
 * 🛡️ LOOP_PREVENTION: エラーループ防止機能実装
 * 
 * 🔧 Phase1修正内容:
 * - ポップアップループ防止機能追加
 * - showError呼び出し制限機能
 * - UI統合改善
 * - Tegaki名前空間統一対応
 * 
 * 依存: なし（基盤クラス）
 * 公開: Tegaki.ErrorManager, Tegaki.ErrorManagerInstance
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

class ErrorManager {
    constructor() {
        this.version = 'v11-phase1-fix';
        this.errors = [];
        this.maxErrors = 100;
        
        // Phase1修正: ポップアップループ防止
        this.popupLoopPrevention = {
            lastErrorTime: 0,
            sameErrorCount: 0,
            maxSameErrors: 3,
            cooldownTime: 5000,
            blockedUntil: 0
        };
        
        // エラー分類カウンター
        this.errorCounts = {
            info: 0,
            warning: 0,
            error: 0,
            critical: 0
        };
        
        // PopupManager参照（後で初期化）
        this.popupManager = null;
        this.popupInitialized = false;
        
        console.log('🚨 ErrorManager v11-phase1-fix 構築完了');
    }

    /**
     * Phase1修正: PopupManager統合（遅延初期化対応）
     */
    initializePopupManager() {
        if (this.popupInitialized) return;
        
        try {
            // PopupManager取得（複数のフォールバック）
            this.popupManager = window.Tegaki?.PopupManagerInstance ||
                               window.PopupManagerInstance ||
                               window.PopupManager;
            
            if (!this.popupManager && window.Tegaki?.PopupManager) {
                this.popupManager = new window.Tegaki.PopupManager();
            }
            
            this.popupInitialized = true;
            
            if (this.popupManager) {
                console.log('✅ ErrorManager - PopupManager統合完了');
            } else {
                console.warn('⚠️ ErrorManager - PopupManager未利用（基本表示のみ）');
            }
            
        } catch (error) {
            console.warn('⚠️ PopupManager統合エラー:', error);
            this.popupInitialized = true; // 無限ループを防ぐ
        }
    }

    /**
     * Phase1修正: エラー表示（ループ防止機能付き）
     * @param {string} type - エラータイプ ('info', 'warning', 'error', 'critical')
     * @param {string} message - エラーメッセージ
     * @param {object} options - オプション
     */
    showError(type = 'error', message = '', options = {}) {
        try {
            // Phase1修正: ポップアップループ防止チェック
            if (this.isErrorBlocked(message)) {
                console.warn('⚠️ ErrorManager - ポップアップループ防止のため表示をブロック:', message);
                return false;
            }
            
            // エラー記録
            this.recordError(type, message, options);
            
            // Phase1修正: 表示方法の決定（PopupManager優先、フォールバック対応）
            this.initializePopupManager();
            
            if (this.popupManager && typeof this.popupManager.showPopup === 'function') {
                // PopupManager経由での表示
                this.showViaPopupManager(type, message, options);
            } else {
                // フォールバック表示
                this.showFallbackError(type, message, options);
            }
            
            // Phase1修正: ループ防止カウンター更新
            this.updateLoopPrevention(message);
            
            return true;
            
        } catch (error) {
            // ErrorManager内でのエラーは最小限の処理
            console.error('❌ ErrorManager.showError内部エラー:', error);
            this.showEmergencyError(type, message);
            return false;
        }
    }

    /**
     * Phase1修正: エラーブロック判定
     * @param {string} message - エラーメッセージ
     * @returns {boolean} ブロック対象かどうか
     */
    isErrorBlocked(message) {
        const now = Date.now();
        
        // クールダウン中チェック
        if (now < this.popupLoopPrevention.blockedUntil) {
            return true;
        }
        
        // 同じエラーの連続チェック
        const timeDiff = now - this.popupLoopPrevention.lastErrorTime;
        if (timeDiff < 1000) { // 1秒以内
            this.popupLoopPrevention.sameErrorCount++;
            
            if (this.popupLoopPrevention.sameErrorCount >= this.popupLoopPrevention.maxSame