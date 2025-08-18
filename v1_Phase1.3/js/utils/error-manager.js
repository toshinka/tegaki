/**
 * 🎨 ふたば☆お絵描きツール - 統一エラー管理システム（修正版）
 * 🎯 AI_WORK_SCOPE: エラー処理統一・表示統一・ログ管理
 * 🎯 DEPENDENCIES: ConfigManager (設定値取得用)
 * 🎯 PIXI_EXTENSIONS: 使用しない
 * 🎯 ISOLATION_TEST: 可能
 * 🎯 SPLIT_THRESHOLD: 250行以下維持
 * 📋 PHASE_TARGET: Phase1統一化
 * 📋 V8_MIGRATION: v8エラー対応準備済み
 * 🚨 FIX: options is not defined エラー完全修正
 */

/**
 * 統一エラー管理システム（修正版）
 * すべてのエラー処理を統一し、重複を排除
 */
class ErrorManager {
    /**
     * エラーログ
     */
    static errorLog = [];
    
    /**
     * エラー表示カウンター
     */
    static displayCounter = 0;
    
    /**
     * 循環参照防止フラグ
     */
    static _isHandlingError = false;
    
    /**
     * 統一エラー表示（修正版）
     * @param {string} type - エラータイプ（'warning', 'error', 'critical', 'recovery'）
     * @param {Error|string} error - エラーオブジェクトまたはメッセージ
     * @param {Object} options - オプション設定
     */
    static showError(type, error, options = {}) {
        // 循環参照防止
        if (this._isHandlingError) {
            console.error('🔄 ErrorManager: 循環参照防止 -', type, typeof error === 'string' ? error : error.message);
            return;
        }
        
        this._isHandlingError = true;
        
        try {
            const errorMessage = typeof error === 'string' ? error : error.message || error;
            const timestamp = new Date().toLocaleTimeString();
            
            // エラーログに記録
            this.logError(type, errorMessage, options);
            
            switch (type) {
                case 'warning':
                    this.showWarningMessage(errorMessage, options);
                    break;
                case 'error':
                    this.showErrorMessage(errorMessage, options);
                    break;
                case 'critical':
                    this.showCriticalError(errorMessage, options);
                    break;
                case 'recovery':
                    this.showRecoveryMessage(errorMessage, options);
                    break;
                default:
                    console.warn('未知のエラータイプ:', type);
                    this.showErrorMessage(errorMessage, options);
            }
        } catch (innerError) {
            console.error('💀 ErrorManager内部エラー:', innerError);
        } finally {
            this._isHandlingError = false;
        }
    }
    
    /**
     * 警告メッセージ表示（修正版）
     * @param {string} message - メッセージ
     * @param {Object} options - オプション
     */
    static showWarningMessage(message, options = {}) {
        // 🚨 修正: パラメータ処理の統一化
        const {
            position = 'top-right',
            duration = 7000,
            showReload = false,
            test = false
        } = options;
        
        console.warn('⚠️ 警告:', message);
        
        if (test) return; // ✅ 修正: options.test → test
        
        const warningDiv = document.createElement('div');
        warningDiv.style.cssText = this.getErrorStyles('warning', position);
        
        warningDiv.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 8px;">⚠️ 警告</div>
            <div style="margin-bottom: 12px; font-size: 11px; opacity: 0.9;">
                ${this.escapeHtml(message)}
            </div>
            <div style="display: flex; gap: 8px;">
                ${showReload ? this.getReloadButton() : ''}
                ${this.getCloseButton()}
            </div>
        `;
        
        document.body.appendChild(warningDiv);
        this.autoRemove(warningDiv, duration);
    }
    
    /**
     * エラーメッセージ表示（修正版）
     * @param {string} message - メッセージ
     * @param {Object} options - オプション
     */
    static showErrorMessage(message, options = {}) {
        // 🚨 修正: パラメータ処理の統一化
        const {
            position = 'top-right',
            duration = 10000,
            showReload = true,
            test = false
        } = options;
        
        console.error('🚨 エラー:', message);
        
        if (test) return; // ✅ 修正: options.test → test
        
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = this.getErrorStyles('error', position);
        
        errorDiv.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 8px;">🚨 エラー</div>
            <div style="margin-bottom: 12px; font-size: 11px; opacity: 0.9;">
                ${this.escapeHtml(message)}
            </div>
            <div style="display: flex; gap: 8px;">
                ${showReload ? this.getReloadButton() : ''}
                ${this.getCloseButton()}
            </div>
        `;
        
        document.body.appendChild(errorDiv);
        this.autoRemove(errorDiv, duration);
    }
    
    /**
     * 回復メッセージ表示（修正版）
     * @param {string} message - メッセージ
     * @param {Object} options - オプション
     */
    static showRecoveryMessage(message, options = {}) {
        // 🚨 修正: パラメータ処理の統一化
        const {
            position = 'bottom-left',
            duration = 8000,
            test = false
        } = options;
        
        console.log('🛡️ 回復:', message);
        
        if (test) return; // ✅ 修正: options.test → test
        
        const recoveryDiv = document.createElement('div');
        recoveryDiv.style.cssText = this.getErrorStyles('recovery', position);
        
        recoveryDiv.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 8px;">🛡️ フォールバックモード</div>
            <div style="margin-bottom: 8px; font-size: 11px;">
                ${this.escapeHtml(message || '一部機能で問題が発生しましたが、基本描画機能は利用可能です。')}
            </div>
            ${this.getCloseButton()}
        `;
        
        document.body.appendChild(recoveryDiv);
        this.autoRemove(recoveryDiv, duration);
    }
    
    /**
     * 致命的エラー表示（修正版）
     * @param {string} message - メッセージ
     * @param {Object} options - オプション
     */
    static showCriticalError(message, options = {}) {
        // 🚨 修正: パラメータ処理の統一化
        const {
            showReload = true,
            showDebug = true,
            additionalInfo = null
        } = options;
        
        console.error('💀 致命的エラー:', message);
        
        const errorConfig = window.ConfigManager ? window.ConfigManager.getErrorConfig() : {};
        
        document.body.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #ffffee; font-family: system-ui, sans-serif;">
                <div style="text-align: center; color: #800000; background: #f0e0d6; padding: 32px; border: 3px solid #cf9c97; border-radius: 16px; box-shadow: 0 8px 24px rgba(128,0,0,0.15); max-width: 500px;">
                    <h2 style="margin: 0 0 16px 0;">🎨 ふたば☆ちゃんねる風お絵描きツール</h2>
                    <p style="margin: 0 0 16px 0;">申し訳ございませんが、アプリケーションの初期化に失敗しました。</p>
                    ${showDebug ? `
                        <details style="margin: 16px 0; text-align: left;">
                            <summary style="cursor: pointer; font-weight: 600;">エラー詳細</summary>
                            <div style="background: #ffffee; padding: 12px; border-radius: 8px; margin: 8px 0; font-family: monospace; font-size: 11px;">
                                <div><strong>エラー:</strong> ${this.escapeHtml(message)}</div>
                                ${additionalInfo ? `<div style="margin-top: 8px;"><strong>追加情報:</strong> ${this.escapeHtml(additionalInfo)}</div>` : ''}
                                <div style="margin-top: 8px;"><strong>時刻:</strong> ${new Date().toLocaleString()}</div>
                                <div><strong>ブラウザ:</strong> ${navigator.userAgent}</div>
                            </div>
                        </details>
                    ` : ''}
                    <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                        ${showReload ? `
                            <button onclick="location.reload()" 
                                    style="background: #800000; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                                🔄 再読み込み
                            </button>
                        ` : ''}
                        ${showDebug ? `
                            <button onclick="console.clear(); window.ErrorManager?.showDebugInfo(); alert('コンソールを確認してください');" 
                                    style="background: #cf9c97; color: #2c1810; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                                🔍 デバッグ
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * エラースタイル取得
     * @param {string} type - エラータイプ
     * @param {string} position - 表示位置
     * @returns {string} CSS スタイル
     */
    static getErrorStyles(type, position) {
        const baseStyle = `
            position: fixed;
            z-index: 9999;
            max-width: 400px;
            font-family: system-ui, sans-serif;
            font-size: 13px;
            border-radius: 8px;
            padding: 16px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
        `;
        
        const positions = {
            'top-right': 'top: 20px; right: 20px;',
            'top-left': 'top: 20px; left: 20px;',
            'bottom-right': 'bottom: 20px; right: 20px;',
            'bottom-left': 'bottom: 20px; left: 20px;',
            'center': 'top: 50%; left: 50%; transform: translate(-50%, -50%);'
        };
        
        const typeStyles = {
            'warning': 'background: #aa5a56; color: white;',
            'error': 'background: #800000; color: white;',
            'recovery': 'background: #cf9c97; color: #2c1810;',
            'critical': 'background: #800000; color: white;'
        };
        
        return baseStyle + positions[position] + typeStyles[type];
    }
    
    /**
     * 再読み込みボタンHTML取得
     * @returns {string} ボタンHTML
     */
    static getReloadButton() {
        return `
            <button onclick="location.reload()" 
                    style="background: rgba(255,255,255,0.2); border: none; color: inherit; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">
                🔄 再読み込み
            </button>
        `;
    }
    
    /**
     * 閉じるボタンHTML取得
     * @returns {string} ボタンHTML
     */
    static getCloseButton() {
        return `
            <button onclick="this.parentNode.parentNode.remove()" 
                    style="background: rgba(255,255,255,0.1); border: none; color: inherit; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">
                閉じる
            </button>
        `;
    }
    
    /**
     * HTML エスケープ
     * @param {string} text - テキスト
     * @returns {string} エスケープ済みテキスト
     */
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * 自動削除
     * @param {Element} element - 削除対象要素
     * @param {number} duration - 削除までの時間（ms）
     */
    static autoRemove(element, duration) {
        setTimeout(() => {
            if (element.parentNode) {
                element.remove();
            }
        }, duration);
    }
    
    /**
     * エラーログ記録（修正版）
     * @param {string} type - エラータイプ
     * @param {string} message - メッセージ
     * @param {Object} options - オプション
     */
    static logError(type, message, options = {}) {
        const logEntry = {
            id: ++this.displayCounter,
            type,
            message,
            timestamp: Date.now(),
            time: new Date().toLocaleTimeString(),
            options: { ...options }
        };
        
        this.errorLog.push(logEntry);
        
        // ログが多すぎる場合は古いものを削除
        if (this.errorLog.length > 100) {
            this.errorLog = this.errorLog.slice(-50);
        }
    }
    
    /**
     * エラーログ取得
     * @param {string} type - フィルター用エラータイプ（オプション）
     * @returns {Array} エラーログ
     */
    static getErrorLog(type = null) {
        if (type) {
            return this.errorLog.filter(entry => entry.type === type);
        }
        return [...this.errorLog];
    }
    
    /**
     * エラーログクリア
     */
    static clearErrorLog() {
        this.errorLog = [];
        this.displayCounter = 0;
        console.log('✅ エラーログクリア完了');
    }
    
    /**
     * デバッグ情報表示
     */
    static showDebugInfo() {
        console.log('🔍 ErrorManager デバッグ情報:');
        console.log('- エラーログ数:', this.errorLog.length);
        console.log('- 表示回数:', this.displayCounter);
        console.log('- 最近のエラー:', this.errorLog.slice(-5));
        
        // ブラウザ情報
        console.log('- ブラウザ:', navigator.userAgent);
        console.log('- 画面サイズ:', `${window.innerWidth}×${window.innerHeight}`);
        
        // ConfigManager 情報
        if (window.ConfigManager) {
            console.log('- 設定情報:', window.ConfigManager.getErrorConfig());
        }
        
        // PixiJS 情報
        if (window.PIXI) {
            console.log('- PixiJS バージョン:', window.PIXI.VERSION);
        }
        
        return this.getErrorLog();
    }
    
    /**
     * エラー統計取得
     * @returns {Object} エラー統計
     */
    static getErrorStats() {
        const stats = {
            total: this.errorLog.length,
            byType: {},
            recent: this.errorLog.slice(-5),
            oldestError: this.errorLog[0]?.time,
            newestError: this.errorLog[this.errorLog.length - 1]?.time
        };
        
        // タイプ別集計
        this.errorLog.forEach(entry => {
            stats.byType[entry.type] = (stats.byType[entry.type] || 0) + 1;
        });
        
        return stats;
    }
    
    /**
     * 安全なエラー表示（循環参照防止）
     * @param {string} message - メッセージ
     * @param {string} type - タイプ
     */
    static safeError(message, type = 'error') {
        if (this._isHandlingError) {
            console.error(`🔒 SafeError (${type}):`, message);
            return;
        }
        
        try {
            this.showError(type, message, { test: false });
        } catch (error) {
            console.error('🔒 SafeError fallback:', message, error);
        }
    }
}

// グローバル公開
window.ErrorManager = ErrorManager;

// デバッグ用グローバル関数（修正版）
window.showError = (type, message, options = {}) => ErrorManager.showError(type, message, options);
window.getErrorLog = () => ErrorManager.getErrorLog();
window.clearErrorLog = () => ErrorManager.clearErrorLog();
window.getErrorStats = () => ErrorManager.getErrorStats();
window.safeError = (message, type) => ErrorManager.safeError(message, type);

console.log('✅ ErrorManager 初期化完了（修正版）');
console.log('💡 使用例: ErrorManager.showError("error", "エラーメッセージ") または window.showError("warning", "警告")');
console.log('🛡️ 循環参照防止機能追加済み');