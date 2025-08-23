/**
 * ErrorManager - アプリケーション全体のエラー処理システム
 * 
 * 責務:
 * - エラー・例外の統一処理
 * - 開発者用とユーザー用のエラー通知分離
 * - エラーログの収集・管理
 * 
 * 依存: なし（基盤クラス）
 * 公開: window.ErrorManager
 */

class ErrorManager {
    constructor() {
        this.errors = [];
        this.maxErrorHistory = 100;
        this.debugMode = false;
        this.userNotificationCallback = null;
        
        // グローバルエラーハンドラーを設定
        this._setupGlobalHandlers();
    }

    /**
     * エラーを記録・処理
     * @param {Error|string} error - エラーオブジェクトまたはメッセージ
     * @param {string} context - エラーが発生したコンテキスト
     * @param {string} level - エラーレベル ('error', 'warn', 'info')
     * @param {boolean} notifyUser - ユーザーに通知するか
     */
    handleError(error, context = 'Unknown', level = 'error', notifyUser = false) {
        const errorInfo = this._createErrorInfo(error, context, level);
        
        // エラー履歴に追加
        this.errors.push(errorInfo);
        
        // 履歴サイズ制限
        if (this.errors.length > this.maxErrorHistory) {
            this.errors.shift();
        }

        // コンソール出力
        this._logToConsole(errorInfo);

        // ユーザー通知
        if (notifyUser && this.userNotificationCallback) {
            try {
                this.userNotificationCallback(errorInfo);
            } catch (notificationError) {
                console.error('[ErrorManager] Error in user notification callback:', notificationError);
            }
        }

        // 開発モードでの追加情報
        if (this.debugMode) {
            this._debugOutput(errorInfo);
        }

        return errorInfo.id;
    }

    /**
     * 警告を処理
     * @param {string} message - 警告メッセージ
     * @param {string} context - コンテキスト
     * @param {boolean} notifyUser - ユーザー通知
     */
    warn(message, context = 'Unknown', notifyUser = false) {
        return this.handleError(message, context, 'warn', notifyUser);
    }

    /**
     * 情報を記録
     * @param {string} message - 情報メッセージ
     * @param {string} context - コンテキスト
     */
    info(message, context = 'Unknown') {
        return this.handleError(message, context, 'info', false);
    }

    /**
     * try-catch のラッパー関数
     * @param {function} fn - 実行する関数
     * @param {string} context - コンテキスト
     * @param {boolean} notifyUser - エラー時のユーザー通知
     * @returns {*} 関数の戻り値またはnull（エラー時）
     */
    safely(fn, context = 'SafeExecution', notifyUser = false) {
        try {
            return fn();
        } catch (error) {
            this.handleError(error, context, 'error', notifyUser);
            return null;
        }
    }

    /**
     * Promise のエラーハンドリング
     * @param {Promise} promise - 処理するPromise
     * @param {string} context - コンテキスト
     * @param {boolean} notifyUser - エラー時のユーザー通知
     * @returns {Promise}
     */
    async safelyAsync(promise, context = 'AsyncExecution', notifyUser = false) {
        try {
            return await promise;
        } catch (error) {
            this.handleError(error, context, 'error', notifyUser);
            return null;
        }
    }

    /**
     * ユーザー通知コールバックを設定
     * @param {function} callback - 通知コールバック関数
     */
    setUserNotificationCallback(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Notification callback must be a function');
        }
        this.userNotificationCallback = callback;
    }

    /**
     * デバッグモードの切り替え
     * @param {boolean} enabled - デバッグモード有効/無効
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log(`[ErrorManager] Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * エラー履歴を取得
     * @param {string} level - フィルタするレベル（オプション）
     * @param {number} limit - 取得件数制限（オプション）
     * @returns {Array}
     */
    getErrorHistory(level = null, limit = null) {
        let filtered = level ? 
            this.errors.filter(error => error.level === level) : 
            this.errors;

        if (limit && limit > 0) {
            filtered = filtered.slice(-limit);
        }

        return filtered;
    }

    /**
     * エラー統計を取得
     * @returns {object}
     */
    getStats() {
        const stats = {
            total: this.errors.length,
            byLevel: {
                error: 0,
                warn: 0,
                info: 0
            },
            byContext: {},
            recent: this.errors.slice(-10)
        };

        this.errors.forEach(error => {
            stats.byLevel[error.level] = (stats.byLevel[error.level] || 0) + 1;
            stats.byContext[error.context] = (stats.byContext[error.context] || 0) + 1;
        });

        return stats;
    }

    /**
     * エラー履歴をクリア
     */
    clearHistory() {
        const count = this.errors.length;
        this.errors = [];
        console.log(`[ErrorManager] Cleared ${count} errors from history`);
    }

    /**
     * エラー情報オブジェクトを作成
     * @private
     */
    _createErrorInfo(error, context, level) {
        const timestamp = new Date();
        const id = `error_${timestamp.getTime()}_${Math.random().toString(36).substr(2, 9)}`;

        let message, stack;
        
        if (error instanceof Error) {
            message = error.message;
            stack = error.stack;
        } else {
            message = String(error);
            stack = new Error().stack;
        }

        return {
            id,
            message,
            context,
            level,
            timestamp,
            stack,
            userAgent: navigator.userAgent,
            url: window.location.href
        };
    }

    /**
     * コンソールへの出力
     * @private
     */
    _logToConsole(errorInfo) {
        const prefix = `[ErrorManager:${errorInfo.context}]`;
        const logMessage = `${prefix} ${errorInfo.message}`;

        switch (errorInfo.level) {
            case 'error':
                console.error(logMessage);
                if (errorInfo.stack && this.debugMode) {
                    console.error(errorInfo.stack);
                }
                break;
            case 'warn':
                console.warn(logMessage);
                break;
            case 'info':
                console.info(logMessage);
                break;
        }
    }

    /**
     * デバッグ情報の出力
     * @private
     */
    _debugOutput(errorInfo) {
        console.group(`[ErrorManager Debug] ${errorInfo.id}`);
        console.log('Context:', errorInfo.context);
        console.log('Level:', errorInfo.level);
        console.log('Timestamp:', errorInfo.timestamp.toISOString());
        console.log('Message:', errorInfo.message);
        if (errorInfo.stack) {
            console.log('Stack:', errorInfo.stack);
        }
        console.log('User Agent:', errorInfo.userAgent);
        console.log('URL:', errorInfo.url);
        console.groupEnd();
    }

    /**
     * グローバルエラーハンドラーの設定
     * @private
     */
    _setupGlobalHandlers() {
        // 未処理のエラー
        window.addEventListener('error', (event) => {
            this.handleError(
                event.error || event.message,
                'GlobalError',
                'error',
                false
            );
        });

        // 未処理のPromise rejection
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError(
                event.reason,
                'UnhandledPromiseRejection',
                'error',
                false
            );
            
            // デフォルトの動作を防止（コンソールエラーを抑制）
            event.preventDefault();
        });
    }
}

// グローバルインスタンスを作成・公開
window.ErrorManager = new ErrorManager();

// 開発時のデバッグ用
if (typeof window !== 'undefined' && window.location && window.location.search.includes('debug=true')) {
    window.ErrorManager.setDebugMode(true);
}

console.log('[ErrorManager] Initialized and registered to window.ErrorManager');