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
 * - ファイル完整性確保
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
            
            if (this.popupLoopPrevention.sameErrorCount >= this.popupLoopPrevention.maxSameErrors) {
                // クールダウン開始
                this.popupLoopPrevention.blockedUntil = now + this.popupLoopPrevention.cooldownTime;
                console.warn(`⚠️ ErrorManager - ポップアップクールダウン開始: ${this.popupLoopPrevention.cooldownTime}ms`);
                return true;
            }
        } else {
            // 時間が経過したのでカウンターリセット
            this.popupLoopPrevention.sameErrorCount = 0;
        }
        
        return false;
    }

    /**
     * Phase1修正: ループ防止カウンター更新
     * @param {string} message - エラーメッセージ
     */
    updateLoopPrevention(message) {
        this.popupLoopPrevention.lastErrorTime = Date.now();
    }

    /**
     * PopupManager経由でのエラー表示
     * @param {string} type - エラータイプ
     * @param {string} message - エラーメッセージ
     * @param {object} options - オプション
     */
    showViaPopupManager(type, message, options) {
        try {
            const popupData = {
                type: type,
                title: this.getErrorTitle(type),
                message: message,
                duration: options.duration || this.getDefaultDuration(type),
                showCloseButton: options.showCloseButton !== false,
                showReload: options.showReload || false,
                nonCritical: options.nonCritical || false,
                context: options.context || '',
                autoClose: options.autoClose !== false
            };
            
            this.popupManager.showPopup(popupData);
            console.log(`✅ ErrorManager - PopupManager経由表示: ${type}`);
            
        } catch (error) {
            console.error('❌ PopupManager経由表示エラー:', error);
            this.showFallbackError(type, message, options);
        }
    }

    /**
     * フォールバック表示（PopupManager未利用時）
     * @param {string} type - エラータイプ
     * @param {string} message - エラーメッセージ
     * @param {object} options - オプション
     */
    showFallbackError(type, message, options) {
        try {
            const title = this.getErrorTitle(type);
            const fullMessage = `${title}: ${message}`;
            
            // コンソールログは必ず出力
            const logMethod = this.getConsoleMethod(type);
            logMethod(`🚨 ${fullMessage}`, options.context ? `[${options.context}]` : '');
            
            // 視覚的フィードバック（軽量）
            if (type === 'critical' || type === 'error') {
                this.showMinimalVisualFeedback(type, message, options);
            }
            
        } catch (error) {
            console.error('❌ フォールバック表示エラー:', error);
        }
    }

    /**
     * 最小限の視覚的フィードバック
     * @param {string} type - エラータイプ
     * @param {string} message - エラーメッセージ
     * @param {object} options - オプション
     */
    showMinimalVisualFeedback(type, message, options) {
        try {
            // DOM要素への最小限の表示
            let errorContainer = document.getElementById('error-flash');
            if (!errorContainer) {
                errorContainer = document.createElement('div');
                errorContainer.id = 'error-flash';
                errorContainer.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10000;
                    padding: 10px 15px;
                    border-radius: 4px;
                    font-family: monospace;
                    font-size: 12px;
                    max-width: 300px;
                    word-wrap: break-word;
                    pointer-events: none;
                    transition: all 0.3s ease;
                `;
                document.body.appendChild(errorContainer);
            }
            
            // エラータイプ別スタイル
            const styles = {
                error: { background: '#ffe6e6', color: '#cc0000', border: '1px solid #ff9999' },
                critical: { background: '#ffe0e0', color: '#990000', border: '2px solid #ff6666' },
                warning: { background: '#fff8e6', color: '#cc6600', border: '1px solid #ffcc99' },
                info: { background: '#e6f7ff', color: '#0066cc', border: '1px solid #99ccff' }
            };
            
            const style = styles[type] || styles.error;
            
            Object.assign(errorContainer.style, style);
            errorContainer.textContent = `${this.getErrorTitle(type)}: ${message}`;
            errorContainer.style.opacity = '1';
            
            // 自動非表示
            setTimeout(() => {
                if (errorContainer) {
                    errorContainer.style.opacity = '0';
                    setTimeout(() => {
                        if (errorContainer && errorContainer.parentNode) {
                            errorContainer.parentNode.removeChild(errorContainer);
                        }
                    }, 300);
                }
            }, options.duration || 4000);
            
        } catch (error) {
            console.error('❌ 最小視覚フィードバック表示エラー:', error);
        }
    }

    /**
     * 緊急時エラー表示（ErrorManager完全失敗時）
     * @param {string} type - エラータイプ
     * @param {string} message - エラーメッセージ
     */
    showEmergencyError(type, message) {
        try {
            console.error(`🆘 EMERGENCY ERROR [${type}]:`, message);
            
            // 最後の手段としてのalert（Phase1では制限的に使用）
            if (type === 'critical') {
                setTimeout(() => {
                    alert(`緊急エラー: ${message}\n\nページを再読み込みしてください。`);
                }, 100);
            }
        } catch (error) {
            // これ以上のフォールバックなし
            console.error('🆘 EMERGENCY ERROR DISPLAY FAILED');
        }
    }

    /**
     * エラー記録
     * @param {string} type - エラータイプ
     * @param {string} message - エラーメッセージ
     * @param {object} options - オプション
     */
    recordError(type, message, options = {}) {
        try {
            const errorRecord = {
                timestamp: new Date().toISOString(),
                type: type,
                message: message,
                context: options.context || '',
                stack: options.stack || (new Error()).stack,
                userAgent: navigator.userAgent,
                url: window.location.href
            };
            
            this.errors.push(errorRecord);
            
            // カウンター更新
            if (this.errorCounts[type] !== undefined) {
                this.errorCounts[type]++;
            }
            
            // 最大エラー数制限
            if (this.errors.length > this.maxErrors) {
                this.errors = this.errors.slice(-this.maxErrors);
            }
            
            // 詳細ログ出力
            const logMethod = this.getConsoleMethod(type);
            logMethod(`📝 ErrorManager記録: [${type}] ${message}`, options.context || '');
            
        } catch (error) {
            console.error('❌ エラー記録失敗:', error);
        }
    }

    /**
     * 情報表示（ショートカット）
     * @param {string} message - メッセージ
     * @param {object} options - オプション
     */
    showInfo(message, options = {}) {
        return this.showError('info', message, options);
    }

    /**
     * 警告表示（ショートカット）
     * @param {string} message - メッセージ
     * @param {object} options - オプション
     */
    showWarning(message, options = {}) {
        return this.showError('warning', message, options);
    }

    /**
     * 致命的エラー表示（ショートカット）
     * @param {string} message - メッセージ
     * @param {object} options - オプション
     */
    showCritical(message, options = {}) {
        return this.showError('critical', message, options);
    }

    /**
     * エラータイトル取得
     * @param {string} type - エラータイプ
     * @returns {string} タイトル
     */
    getErrorTitle(type) {
        const titles = {
            info: '情報',
            warning: '警告',
            error: 'エラー',
            critical: '致命的エラー'
        };
        return titles[type] || 'エラー';
    }

    /**
     * デフォルト表示時間取得
     * @param {string} type - エラータイプ
     * @returns {number} ミリ秒
     */
    getDefaultDuration(type) {
        const durations = {
            info: 3000,
            warning: 5000,
            error: 7000,
            critical: 10000
        };
        return durations[type] || 5000;
    }

    /**
     * コンソールメソッド取得
     * @param {string} type - エラータイプ
     * @returns {function} コンソールメソッド
     */
    getConsoleMethod(type) {
        const methods = {
            info: console.info,
            warning: console.warn,
            error: console.error,
            critical: console.error
        };
        return methods[type] || console.log;
    }

    /**
     * エラー統計取得
     * @returns {object} エラー統計
     */
    getErrorStatistics() {
        return {
            counts: { ...this.errorCounts },
            total: this.errors.length,
            recent: this.errors.slice(-10),
            loopPrevention: { ...this.popupLoopPrevention }
        };
    }

    /**
     * エラーログクリア
     */
    clearErrors() {
        this.errors = [];
        this.errorCounts = {
            info: 0,
            warning: 0,
            error: 0,
            critical: 0
        };
        console.log('🗑️ ErrorManager - エラーログクリア完了');
    }

    /**
     * エラーログエクスポート
     * @returns {string} JSON形式のエラーログ
     */
    exportErrors() {
        return JSON.stringify({
            version: this.version,
            timestamp: new Date().toISOString(),
            counts: this.errorCounts,
            errors: this.errors
        }, null, 2);
    }

    /**
     * 診断情報取得
     * @returns {object} 診断情報
     */
    getDiagnosticInfo() {
        return {
            version: this.version,
            popupManagerConnected: !!this.popupManager,
            errorCounts: { ...this.errorCounts },
            totalErrors: this.errors.length,
            loopPreventionActive: this.popupLoopPrevention.blockedUntil > Date.now(),
            lastErrorTime: new Date(this.popupLoopPrevention.lastErrorTime).toISOString()
        };
    }
}

// Tegaki名前空間にクラス登録
window.Tegaki.ErrorManager = ErrorManager;

// 初期化レジストリに登録
window.Tegaki._registry = window.Tegaki._registry || [];
window.Tegaki._registry.push(() => {
    // ErrorManagerインスタンス作成・登録
    window.Tegaki.ErrorManagerInstance = new window.Tegaki.ErrorManager();
    
    console.log('✅ ErrorManager初期化完了 - Tegaki名前空間登録済み');
});

console.log('🚨 ErrorManager (v11-phase1-fix) Loaded - ループ防止・UI統合・完全版');