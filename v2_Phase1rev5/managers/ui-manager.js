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
            
            if (this.popupLoopPrevention.sameErrorCount >= this.popupLoopPrevention.maxSameErrors) {
                // ブロック期間設定
                this.popupLoopPrevention.blockedUntil = now + this.popupLoopPrevention.cooldownTime;
                console.warn('⚠️ ErrorManager - エラーループ検出。' + this.popupLoopPrevention.cooldownTime + 'ms間ブロック');
                return true;
            }
        } else {
            // 時間が空いているのでカウンターリセット
            this.popupLoopPrevention.sameErrorCount = 1;
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
                buttons: this.getErrorButtons(type, options),
                autoClose: options.autoClose !== false,
                duration: options.duration || this.getDefaultDuration(type)
            };

            this.popupManager.showPopup(popupData);
            
        } catch (error) {
            console.error('❌ PopupManager表示エラー:', error);
            this.showFallbackError(type, message, options);
        }
    }

    /**
     * フォールバック表示（PopupManager未使用時）
     * @param {string} type - エラータイプ
     * @param {string} message - エラーメッセージ
     * @param {object} options - オプション
     */
    showFallbackError(type, message, options) {
        try {
            // console表示
            const consoleMethod = this.getConsoleMethod(type);
            console[consoleMethod](`[${type.toUpperCase()}] ${message}`, options);

            // ブラウザ通知（critical時）
            if (type === 'critical' || options.showAlert) {
                if (options.nonCritical) {
                    // 非致命的エラーは控えめに
                    console.warn('非致命的エラー:', message);
                } else {
                    alert(`${this.getErrorTitle(type)}\n\n${message}`);
                }
            }

            // UI通知作成（簡易版）
            this.showSimpleNotification(type, message, options);
            
        } catch (error) {
            console.error('❌ フォールバック表示エラー:', error);
        }
    }

    /**
     * 簡易通知表示
     * @param {string} type - エラータイプ
     * @param {string} message - エラーメッセージ
     * @param {object} options - オプション
     */
    showSimpleNotification(type, message, options) {
        try {
            // 既存の通知を削除
            const existing = document.querySelector('.error-notification');
            if (existing) {
                existing.remove();
            }

            // 通知要素作成
            const notification = document.createElement('div');
            notification.className = `error-notification ${type}`;
            notification.innerHTML = `
                <div class="error-icon">${this.getErrorIcon(type)}</div>
                <div class="error-content">
                    <div class="error-title">${this.getErrorTitle(type)}</div>
                    <div class="error-message">${message}</div>
                </div>
                <div class="error-close" onclick="this.parentElement.remove()">×</div>
            `;

            // スタイル設定
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                max-width: 400px;
                background: #fff;
                border: 2px solid ${this.getErrorColor(type)};
                border-radius: 8px;
                padding: 16px;
                z-index: 10000;
                opacity: 0;
                transform: translateX(20px);
                transition: all 0.3s ease;
                font-family: sans-serif;
                font-size: 14px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                display: flex;
                align-items: flex-start;
                gap: 12px;
            `;

            // 内部スタイル
            const style = document.createElement('style');
            style.textContent = `
                .error-icon {
                    font-size: 24px;
                    flex-shrink: 0;
                }
                .error-content {
                    flex: 1;
                }
                .error-title {
                    font-weight: bold;
                    color: ${this.getErrorColor(type)};
                    margin-bottom: 4px;
                }
                .error-message {
                    color: #333;
                    line-height: 1.4;
                }
                .error-close {
                    cursor: pointer;
                    font-size: 20px;
                    color: #999;
                    flex-shrink: 0;
                    line-height: 1;
                }
                .error-close:hover {
                    color: #666;
                }
            `;
            document.head.appendChild(style);

            document.body.appendChild(notification);

            // アニメーション表示
            requestAnimationFrame(() => {
                notification.style.opacity = '1';
                notification.style.transform = 'translateX(0)';
            });

            // 自動消去
            if (options.autoClose !== false) {
                const duration = options.duration || this.getDefaultDuration(type);
                setTimeout(() => {
                    if (notification.parentElement) {
                        notification.style.opacity = '0';
                        notification.style.transform = 'translateX(20px)';
                        setTimeout(() => {
                            if (notification.parentElement) {
                                notification.remove();
                            }
                        }, 300);
                    }
                }, duration);
            }

        } catch (error) {
            console.error('❌ 簡易通知表示エラー:', error);
        }
    }

    /**
     * 緊急エラー表示（最後の手段）
     * @param {string} type - エラータイプ
     * @param {string} message - エラーメッセージ
     */
    showEmergencyError(type, message) {
        try {
            console.error(`[EMERGENCY ${type.toUpperCase()}]`, message);
            
            // 致命的エラーのみalert表示
            if (type === 'critical') {
                alert(`緊急エラー:\n${message}`);
            }
        } catch (error) {
            // 最後の手段でもエラーの場合、何もしない
            console.error('Fatal error in emergency display:', error);
        }
    }

    /**
     * エラー記録
     * @param {string} type - エラータイプ
     * @param {string} message - エラーメッセージ
     * @param {object} options - オプション
     */
    recordError(type, message, options) {
        try {
            const errorRecord = {
                type,
                message,
                options,
                timestamp: new Date().toISOString(),
                context: options.context || 'unknown',
                id: this.generateErrorId()
            };

            this.errors.push(errorRecord);
            this.errorCounts[type] = (this.errorCounts[type] || 0) + 1;

            // 最大記録数を超えた場合は古いものを削除
            if (this.errors.length > this.maxErrors) {
                this.errors.shift();
            }

            // StateManager経由での状態更新（利用可能時）
            if (window.Tegaki?.StateManagerInstance) {
                window.Tegaki.StateManagerInstance.updateSystemState('errorManager', 'errorCounts', this.errorCounts);
            }

        } catch (error) {
            console.warn('⚠️ エラー記録失敗:', error);
        }
    }

    /**
     * エラーID生成
     * @returns {string} エラーID
     */
    generateErrorId() {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }

    // ========================================
    // ヘルパーメソッド
    // ========================================

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
     * エラーアイコン取得
     * @param {string} type - エラータイプ
     * @returns {string} アイコン
     */
    getErrorIcon(type) {
        const icons = {
            info: 'ℹ️',
            warning: '⚠️',
            error: '❌',
            critical: '🚨'
        };
        return icons[type] || '❌';
    }

    /**
     * エラー色取得
     * @param {string} type - エラータイプ
     * @returns {string} 色コード
     */
    getErrorColor(type) {
        const colors = {
            info: '#2196f3',
            warning: '#ff9800',
            error: '#f44336',
            critical: '#d32f2f'
        };
        return colors[type] || '#f44336';
    }

    /**
     * コンソールメソッド取得
     * @param {string} type - エラータイプ
     * @returns {string} コンソールメソッド名
     */
    getConsoleMethod(type) {
        const methods = {
            info: 'info',
            warning: 'warn',
            error: 'error',
            critical: 'error'
        };
        return methods[type] || 'error';
    }

    /**
     * デフォルト表示時間取得
     * @param {string} type - エラータイプ
     * @returns {number} 表示時間（ms）
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
     * エラーボタン取得
     * @param {string} type - エラータイプ
     * @param {object} options - オプション
     * @returns {Array} ボタン配列
     */
    getErrorButtons(type, options) {
        const buttons = [{ text: 'OK', action: 'close' }];

        if (options.showReload) {
            buttons.push({ 
                text: 'リロード', 
                action: () => window.location.reload() 
            });
        }

        if (options.showDetails) {
            buttons.push({ 
                text: '詳細', 
                action: () => this.showErrorDetails() 
            });
        }

        return buttons;
    }

    // ========================================
    // 便利メソッド
    // ========================================

    /**
     * 情報表示
     * @param {string} message - メッセージ
     * @param {object} options - オプション
     */
    showInfo(message, options = {}) {
        return this.showError('info', message, options);
    }

    /**
     * 警告表示
     * @param {string} message - メッセージ
     * @param {object} options - オプション
     */
    showWarning(message, options = {}) {
        return this.showError('warning', message, options);
    }

    /**
     * 致命的エラー表示
     * @param {string} message - メッセージ
     * @param {object} options - オプション
     */
    showCriticalError(message, options = {}) {
        return this.showError('critical', message, options);
    }

    /**
     * エラー統計取得
     * @returns {object} エラー統計
     */
    getErrorStats() {
        return {
            total: this.errors.length,
            counts: { ...this.errorCounts },
            recent: this.errors.slice(-10),
            loopPreventionStatus: { ...this.popupLoopPrevention }
        };
    }

    /**
     * エラーログ取得
     * @param {number} limit - 取得件数制限
     * @returns {Array} エラーログ
     */
    getErrorLog(limit = 50) {
        return this.errors.slice(-limit);
    }

    /**
     * エラー詳細表示
     */
    showErrorDetails() {
        const stats = this.getErrorStats();
        console.group('🚨 ErrorManager 詳細情報');
        console.log('📊 統計:', stats.counts);
        console.log('📋 最近のエラー:', stats.recent);
        console.log('🛡️ ループ防止状況:', stats.loopPreventionStatus);
        console.groupEnd();
    }

    /**
     * エラーログクリア
     */
    clearErrorLog() {
        this.errors = [];
        this.errorCounts = { info: 0, warning: 0, error: 0, critical: 0 };
        this.popupLoopPrevention.sameErrorCount = 0;
        console.log('🗑️ ErrorManager - エラーログクリア完了');
    }

    /**
     * 健全性チェック
     * @returns {object} チェック結果
     */
    healthCheck() {
        try {
            const stats = this.getErrorStats();
            const issues = [];

            // 高エラー率チェック
            if (stats.total > 50) {
                issues.push(`High error count: ${stats.total}`);
            }

            // ループ状態チェック
            if (Date.now() < this.popupLoopPrevention.blockedUntil) {
                issues.push('Currently in error loop prevention mode');
            }

            // PopupManager統合チェック
            if (!this.popupManager) {
                issues.push('PopupManager not integrated');
            }

            return {
                healthy: issues.length === 0,
                issues,
                stats: stats.counts,
                popupManagerIntegrated: !!this.popupManager
            };
        } catch (error) {
            return { 
                healthy: false, 
                issues: ['Health check failed'],
                error: error.message 
            };
        }
    }

    /**
     * デバッグ情報取得
     * @returns {object} デバッグ情報
     */
    getDebugInfo() {
        const info = {
            version: this.version,
            errorCounts: { ...this.errorCounts },
            totalErrors: this.errors.length,
            popupManagerIntegrated: !!this.popupManager,
            loopPreventionActive: Date.now() < this.popupLoopPrevention.blockedUntil,
            recentErrors: this.errors.slice(-5).map(err => ({
                type: err.type,
                message: err.message.substring(0, 50),
                timestamp: err.timestamp
            }))
        };

        console.group('🚨 ErrorManager デバッグ情報');
        console.log('📋 バージョン:', info.version);
        console.log('📊 エラー統計:', info.errorCounts);
        console.log('🔗 PopupManager統合:', info.popupManagerIntegrated);
        console.log('🛡️ ループ防止状態:', info.loopPreventionActive);
        console.log('📋 最近のエラー:', info.recentErrors);
        console.groupEnd();

        return info;
    }

    /**
     * 破棄処理
     */
    destroy() {
        try {
            // 通知削除
            const notifications = document.querySelectorAll('.error-notification');
            notifications.forEach(notification => notification.remove());

            // 参照クリア
            this.popupManager = null;
            this.errors = [];
            this.errorCounts = { info: 0, warning: 0, error: 0, critical: 0 };

            console.log('🗑️ ErrorManager破棄完了');
        } catch (error) {
            console.error('❌ ErrorManager破棄エラー:', error);
        }
    }
}

// Tegaki名前空間にクラスを登録
window.Tegaki.ErrorManager = ErrorManager;

// 初期化レジストリに追加（根幹Manager）
window.Tegaki._registry = window.Tegaki._registry || [];
window.Tegaki._registry.push(() => {
    window.Tegaki.ErrorManagerInstance = new window.Tegaki.ErrorManager();
    console.log('🚨 ErrorManager registered to Tegaki namespace');
});

// グローバル登録（下位互換）
if (typeof window !== 'undefined') {
    window.ErrorManager = ErrorManager;
}

console.log('🚨 ErrorManager v11-phase1-fix Loaded');
console.log('✨ Phase1修正完了: ポップアップループ防止・UI統合改善・エラー表示制限機能');
console.log('🔧 使用例: const errorManager = new ErrorManager(); errorManager.showError("error", "メッセージ");');