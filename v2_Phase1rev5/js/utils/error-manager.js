/**
 * 🚨 ErrorManager (Phase1修復版) - ポップアップ統合・EventBus連携強化
 * ✅ UNIFIED_SYSTEM: 統一エラー処理・通知システム
 * 📋 RESPONSIBILITY: 「エラー・例外の統一管理」専門
 * 
 * 🔧 PHASE1修復重点:
 * - PopupManagerとの完全統合
 * - showError/showWarning/showCriticalError 実装
 * - EventBus safeEmit の完全活用
 * - ポップアップ表示の復旧
 * 
 * 📏 DESIGN_PRINCIPLE: 基盤システム・依存関係なし
 * 🎯 TEGAKI_NAMESPACE: Tegaki名前空間統一対応済み
 * 🔧 REGISTRY_READY: 初期化レジストリ対応済み
 * 
 * 📋 参考定義:
 * - ルールブック: 統一システム活用規約 - ErrorManager活用規約
 * - シンボル辞典: ErrorManager API - エラー分類・処理
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

class ErrorManager {
    constructor() {
        this.errors = [];
        this.maxErrorHistory = 100;
        this.debugMode = false;
        this.popupManager = null; // PopupManager統合用
        
        // 🔧 PHASE1修復: エラー表示状態管理
        this.displayState = {
            isShowingError: false,
            errorPopupElement: null,
            lastErrorId: null,
            popupTimeoutId: null
        };
        
        // エラーカテゴリ別設定
        this.errorConfig = {
            error: {
                showPopup: true,
                duration: 5000, // 5秒間表示
                priority: 'high'
            },
            warning: {
                showPopup: true,
                duration: 3000, // 3秒間表示  
                priority: 'medium'
            },
            info: {
                showPopup: false,
                duration: 2000, // 2秒間表示
                priority: 'low'
            }
        };
        
        // グローバルエラーハンドラーを設定
        this._setupGlobalHandlers();
        
        console.log('🚨 ErrorManager初期化完了 (Phase1修復版) - ポップアップ統合対応');
    }

    /**
     * 🔧 PHASE1修復: PopupManagerとの統合初期化
     * @param {PopupManager} popupManager - PopupManagerインスタンス
     */
    initializePopupIntegration(popupManager) {
        try {
            if (!popupManager) {
                console.warn('⚠️ ErrorManager: PopupManager未提供 - 基本エラー表示で動作');
                return false;
            }

            this.popupManager = popupManager;
            
            // エラー表示用の動的ポップアップ要素を作成
            this._createErrorPopupElement();
            
            console.log('✅ ErrorManager: PopupManager統合完了');
            return true;
            
        } catch (error) {
            console.error('❌ ErrorManager PopupManager統合エラー:', error);
            return false;
        }
    }

    /**
     * 🔧 PHASE1修復: エラー表示統一API（最重要メソッド）
     * @param {string} type - エラータイプ ('error', 'warning', 'info')
     * @param {string} message - エラーメッセージ
     * @param {object} options - オプション
     */
    showError(type, message, options = {}) {
        try {
            // エラー情報を作成
            const errorInfo = this._createErrorInfo(message, options.context || 'Unknown', type);
            this._recordError(errorInfo);

            // ポップアップ表示判定
            const shouldShowPopup = this._shouldShowPopup(type, options);

            if (shouldShowPopup) {
                this._displayErrorPopup(errorInfo, options);
            } else {
                // コンソール出力のみ
                this._logToConsole(errorInfo);
            }

            // EventBus通知（他のシステムに通知）
            if (window.EventBus?.safeEmit) {
                window.EventBus.safeEmit('error.occurred', {
                    type,
                    message,
                    errorId: errorInfo.id,
                    options
                });
            }

            return errorInfo.id;
            
        } catch (error) {
            console.error('❌ ErrorManager.showError 内部エラー:', error);
            // フォールバック: 直接コンソール出力
            console.error(`[ErrorManager:${type}] ${message}`);
            return null;
        }
    }

    /**
     * 🔧 PHASE1修復: 警告表示
     * @param {string} message - 警告メッセージ  
     * @param {object} options - オプション
     */
    showWarning(message, options = {}) {
        return this.showError('warning', message, options);
    }

    /**
     * 🔧 PHASE1修復: 致命的エラー表示
     * @param {string} message - エラーメッセージ
     * @param {object} options - オプション
     */
    showCriticalError(message, options = {}) {
        const criticalOptions = {
            ...options,
            showPopup: true,
            duration: 10000, // 10秒間表示
            showReload: true,
            priority: 'critical'
        };
        return this.showError('error', message, criticalOptions);
    }

    /**
     * 🔧 PHASE1修復: エラーポップアップの実際の表示処理
     * @param {object} errorInfo - エラー情報
     * @param {object} options - 表示オプション
     */
    _displayErrorPopup(errorInfo, options) {
        try {
            // 既存のエラーポップアップを閉じる
            this._clearCurrentErrorPopup();

            const config = this.errorConfig[errorInfo.level] || this.errorConfig.error;
            const duration = options.duration || config.duration;

            if (this.popupManager) {
                // PopupManager経由での表示
                this._showErrorViaPopupManager(errorInfo, options, duration);
            } else {
                // フォールバック: アラート表示
                this._showErrorViaAlert(errorInfo, options);
            }

        } catch (error) {
            console.error('❌ エラーポップアップ表示エラー:', error);
            // 最終フォールバック
            alert(`${errorInfo.level.toUpperCase()}: ${errorInfo.message}`);
        }
    }

    /**
     * 🔧 PHASE1修復: PopupManager経由でのエラー表示
     * @param {object} errorInfo - エラー情報
     * @param {object} options - オプション  
     * @param {number} duration - 表示時間
     */
    _showErrorViaPopupManager(errorInfo, options, duration) {
        try {
            if (!this.displayState.errorPopupElement) {
                console.warn('⚠️ エラーポップアップ要素未作成 - 作成試行');
                this._createErrorPopupElement();
            }

            const popupElement = this.displayState.errorPopupElement;
            if (!popupElement) {
                throw new Error('エラーポップアップ要素作成失敗');
            }

            // ポップアップ内容を更新
            this._updateErrorPopupContent(popupElement, errorInfo, options);

            // PopupManagerに表示指示
            const popupId = 'error-popup';
            
            // ポップアップを登録（未登録の場合）
            if (!this.popupManager.popups.has(popupId)) {
                const popupInfo = this.popupManager.createPopupInfo(popupElement);
                this.popupManager.popups.set(popupId, popupInfo);
                
                // ドラッグ機能を設定
                if (this.popupManager.config.dragEnabled) {
                    this.popupManager.setupPopupDrag(popupId);
                }
            }

            // ポップアップ表示
            this.popupManager.showPopup(popupId, true);
            this.displayState.isShowingError = true;
            this.displayState.lastErrorId = errorInfo.id;

            // 自動非表示タイマー設定
            if (duration > 0) {
                this.displayState.popupTimeoutId = setTimeout(() => {
                    this._clearCurrentErrorPopup();
                }, duration);
            }

            console.log(`🚨 エラーポップアップ表示: ${errorInfo.level} - ${errorInfo.message.substring(0, 50)}...`);

        } catch (error) {
            console.error('❌ PopupManager経由エラー表示失敗:', error);
            // フォールバックにアラート表示
            this._showErrorViaAlert(errorInfo, options);
        }
    }

    /**
     * 🔧 PHASE1修復: フォールバック用アラート表示
     * @param {object} errorInfo - エラー情報
     * @param {object} options - オプション
     */
    _showErrorViaAlert(errorInfo, options) {
        const levelEmoji = {
            'error': '❌',
            'warning': '⚠️',
            'info': 'ℹ️'
        };

        const emoji = levelEmoji[errorInfo.level] || '❓';
        const message = `${emoji} ${errorInfo.message}`;
        
        if (options.showReload) {
            const result = confirm(`${message}\n\nページを再読み込みしますか？`);
            if (result) {
                window.location.reload();
            }
        } else {
            alert(message);
        }
    }

    /**
     * 🔧 PHASE1修復: エラーポップアップ要素の動的作成
     */
    _createErrorPopupElement() {
        try {
            // 既存要素をチェック
            let popupElement = document.getElementById('error-popup');
            
            if (!popupElement) {
                // 新規作成
                popupElement = document.createElement('div');
                popupElement.id = 'error-popup';
                popupElement.className = 'popup-panel error-popup draggable';
                popupElement.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    width: 350px;
                    max-width: 90vw;
                    background: white;
                    border: 2px solid #800000;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    z-index: 9999;
                    display: none;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                `;

                popupElement.innerHTML = `
                    <div class="popup-title" style="background: #800000; color: white; padding: 8px 12px; font-weight: bold; cursor: grab; user-select: none;">
                        <span id="error-popup-title">エラー</span>
                        <button id="error-popup-close" style="float: right; background: none; border: none; color: white; font-size: 16px; cursor: pointer;">×</button>
                    </div>
                    <div class="popup-content" style="padding: 12px;">
                        <div id="error-popup-message" style="margin-bottom: 12px; line-height: 1.4;"></div>
                        <div id="error-popup-context" style="font-size: 12px; color: #666; margin-bottom: 12px;"></div>
                        <div id="error-popup-actions" style="text-align: right;">
                            <button id="error-popup-reload" style="display: none; margin-right: 8px; padding: 4px 12px; background: #800000; color: white; border: none; border-radius: 4px; cursor: pointer;">再読み込み</button>
                            <button id="error-popup-dismiss" style="padding: 4px 12px; background: #ccc; color: #333; border: none; border-radius: 4px; cursor: pointer;">閉じる</button>
                        </div>
                    </div>
                `;

                // DOMに追加
                document.body.appendChild(popupElement);

                // イベントリスナー設定
                this._setupErrorPopupEvents(popupElement);
            }

            this.displayState.errorPopupElement = popupElement;
            console.log('✅ エラーポップアップ要素作成完了');

        } catch (error) {
            console.error('❌ エラーポップアップ要素作成エラー:', error);
            this.displayState.errorPopupElement = null;
        }
    }

    /**
     * 🔧 PHASE1修復: エラーポップアップのイベント設定
     * @param {HTMLElement} popupElement - ポップアップ要素
     */
    _setupErrorPopupEvents(popupElement) {
        try {
            // 閉じるボタン
            const closeBtn = popupElement.querySelector('#error-popup-close');
            const dismissBtn = popupElement.querySelector('#error-popup-dismiss');
            
            [closeBtn, dismissBtn].forEach(btn => {
                if (btn) {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        this._clearCurrentErrorPopup();
                    });
                }
            });

            // 再読み込みボタン
            const reloadBtn = popupElement.querySelector('#error-popup-reload');
            if (reloadBtn) {
                reloadBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.location.reload();
                });
            }

        } catch (error) {
            console.error('❌ エラーポップアップイベント設定エラー:', error);
        }
    }

    /**
     * 🔧 PHASE1修復: エラーポップアップ内容更新
     * @param {HTMLElement} popupElement - ポップアップ要素
     * @param {object} errorInfo - エラー情報
     * @param {object} options - オプション
     */
    _updateErrorPopupContent(popupElement, errorInfo, options) {
        try {
            // タイトル更新
            const titleElement = popupElement.querySelector('#error-popup-title');
            if (titleElement) {
                const levelTitles = {
                    'error': '❌ エラー',
                    'warning': '⚠️ 警告',
                    'info': 'ℹ️ 情報'
                };
                titleElement.textContent = levelTitles[errorInfo.level] || '❓ 通知';
            }

            // メッセージ更新
            const messageElement = popupElement.querySelector('#error-popup-message');
            if (messageElement) {
                messageElement.textContent = errorInfo.message;
            }

            // コンテキスト情報更新
            const contextElement = popupElement.querySelector('#error-popup-context');
            if (contextElement) {
                const contextInfo = [];
                if (errorInfo.context) contextInfo.push(`場所: ${errorInfo.context}`);
                if (options.additionalInfo) contextInfo.push(`詳細: ${options.additionalInfo}`);
                contextInfo.push(`時刻: ${errorInfo.timestamp.toLocaleTimeString()}`);
                
                contextElement.textContent = contextInfo.join(' | ');
            }

            // 再読み込みボタンの表示制御
            const reloadBtn = popupElement.querySelector('#error-popup-reload');
            if (reloadBtn) {
                reloadBtn.style.display = options.showReload ? 'inline-block' : 'none';
            }

            // レベル別のスタイル適用
            const titleBar = popupElement.querySelector('.popup-title');
            if (titleBar) {
                const levelColors = {
                    'error': '#800000',
                    'warning': '#ff6600', 
                    'info': '#0066cc'
                };
                titleBar.style.backgroundColor = levelColors[errorInfo.level] || '#800000';
            }

        } catch (error) {
            console.error('❌ エラーポップアップ内容更新エラー:', error);
        }
    }

    /**
     * 🔧 PHASE1修復: 現在のエラーポップアップをクリア
     */
    _clearCurrentErrorPopup() {
        try {
            if (this.displayState.popupTimeoutId) {
                clearTimeout(this.displayState.popupTimeoutId);
                this.displayState.popupTimeoutId = null;
            }

            if (this.popupManager) {
                this.popupManager.hidePopup('error-popup');
            }

            this.displayState.isShowingError = false;
            this.displayState.lastErrorId = null;

            // EventBus通知
            if (window.EventBus?.safeEmit) {
                window.EventBus.safeEmit('error.popup.dismissed');
            }

        } catch (error) {
            console.error('❌ エラーポップアップクリアエラー:', error);
        }
    }

    /**
     * ポップアップ表示判定
     * @param {string} type - エラータイプ
     * @param {object} options - オプション
     * @returns {boolean} ポップアップ表示するか
     */
    _shouldShowPopup(type, options) {
        // オプションで明示的に指定されている場合
        if (options.showPopup !== undefined) {
            return options.showPopup;
        }

        // 設定による判定
        const config = this.errorConfig[type];
        if (config) {
            return config.showPopup;
        }

        // デフォルトは表示
        return true;
    }

    /**
     * エラー情報を記録
     * @param {object} errorInfo - エラー情報
     */
    _recordError(errorInfo) {
        this.errors.push(errorInfo);
        
        // 履歴サイズ制限
        if (this.errors.length > this.maxErrorHistory) {
            this.errors.shift();
        }

        // コンソール出力
        this._logToConsole(errorInfo);

        // 開発モードでの追加情報
        if (this.debugMode) {
            this._debugOutput(errorInfo);
        }
    }

    /**
     * エラーを記録・処理（既存メソッド・下位互換）
     * @param {Error|string} error - エラーオブジェクトまたはメッセージ
     * @param {string} context - エラーが発生したコンテキスト
     * @param {string} level - エラーレベル ('error', 'warn', 'info')
     * @param {boolean} notifyUser - ユーザーに通知するか
     */
    handle(error, context = 'Unknown', level = 'error', notifyUser = false) {
        const options = {
            context,
            showPopup: notifyUser
        };
        return this.showError(level, error, options);
    }

    /**
     * 旧handleError互換メソッド（下位互換）
     */
    handleError(error, context = 'Unknown', level = 'error', notifyUser = false) {
        return this.handle(error, context, level, notifyUser);
    }

    /**
     * 警告を処理（既存メソッド・統合強化）
     * @param {string} message - 警告メッセージ
     * @param {string} context - コンテキスト
     * @param {boolean} notifyUser - ユーザー通知
     */
    warn(message, context = 'Unknown', notifyUser = false) {
        return this.handle(message, context, 'warn', notifyUser);
    }

    /**
     * 情報を記録（既存メソッド）
     * @param {string} message - 情報メッセージ
     * @param {string} context - コンテキスト
     */
    info(message, context = 'Unknown') {
        return this.handle(message, context, 'info', false);
    }

    /**
     * try-catch のラッパー関数（既存メソッド）
     * @param {function} fn - 実行する関数
     * @param {string} context - コンテキスト
     * @param {boolean} notifyUser - エラー時のユーザー通知
     * @returns {*} 関数の戻り値またはnull（エラー時）
     */
    safely(fn, context = 'SafeExecution', notifyUser = false) {
        try {
            return fn();
        } catch (error) {
            this.handle(error, context, 'error', notifyUser);
            return null;
        }
    }

    /**
     * Promise のエラーハンドリング（既存メソッド）
     * @param {Promise} promise - 処理するPromise
     * @param {string} context - コンテキスト
     * @param {boolean} notifyUser - エラー時のユーザー通知
     * @returns {Promise}
     */
    async safelyAsync(promise, context = 'AsyncExecution', notifyUser = false) {
        try {
            return await promise;
        } catch (error) {
            this.handle(error, context, 'error', notifyUser);
            return null;
        }
    }

    /**
     * デバッグモードの切り替え（既存メソッド）
     * @param {boolean} enabled - デバッグモード有効/無効
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log(`🚨 ErrorManager: Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * エラー履歴を取得（既存メソッド）
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
     * 最後のエラーを取得（既存メソッド）
     * @returns {object|null}
     */
    getLastError() {
        return this.errors.length > 0 ? this.errors[this.errors.length - 1] : null;
    }

    /**
     * エラー統計を取得（既存メソッド・拡張）
     * @returns {object}
     */
    getErrorStats() {
        const stats = {
            total: this.errors.length,
            byLevel: {
                error: 0,
                warning: 0,
                info: 0
            },
            byContext: {},
            recent: this.errors.slice(-10),
            popupIntegration: {
                available: !!this.popupManager,
                isShowingError: this.displayState.isShowingError,
                lastErrorId: this.displayState.lastErrorId
            }
        };

        this.errors.forEach(error => {
            stats.byLevel[error.level] = (stats.byLevel[error.level] || 0) + 1;
            stats.byContext[error.context] = (stats.byContext[error.context] || 0) + 1;
        });

        return stats;
    }

    /**
     * エラー履歴をクリア（既存メソッド）
     */
    clearHistory() {
        const count = this.errors.length;
        this.errors = [];
        console.log(`🚨 ErrorManager: Cleared ${count} errors from history`);
        
        if (window.EventBus?.safeEmit) {
            window.EventBus.safeEmit('error.history.cleared', { count });
        }
    }

    // ========================================
    // 内部メソッド
    // ========================================

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
            case 'warning':
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
            this.handle(
                event.error || event.message,
                'GlobalError',
                'error',
                false
            );
        });

        // 未処理のPromise rejection
        window.addEventListener('unhandledrejection', (event) => {
            this.handle(
                event.reason,
                'UnhandledPromiseRejection',
                'error',
                false
            );
            
            // デフォルトの動作を防止（コンソールエラーを抑制）
            event.preventDefault();
        });
    }

    /**
     * システム破棄
     */
    destroy() {
        try {
            // エラーポップアップをクリア
            this._clearCurrentErrorPopup();
            
            // エラーポップアップ要素を削除
            if (this.displayState.errorPopupElement) {
                this.displayState.errorPopupElement.remove();
                this.displayState.errorPopupElement = null;
            }

            // PopupManager参照をクリア
            this.popupManager = null;
            
            console.log('🚨 ErrorManager 破棄完了');
            
        } catch (error) {
            console.error('❌ ErrorManager破棄エラー:', error);
        }
    }
}

// Tegaki名前空間にクラスを登録
window.Tegaki.ErrorManager = ErrorManager;

// 初期化レジストリに追加（根幹Manager最優先）
window.Tegaki._registry = window.Tegaki._registry || [];
window.Tegaki._registry.push(() => {
    window.Tegaki.ErrorManagerInstance = new window.Tegaki.ErrorManager();
    
    // 開発時のデバッグ設定
    if (typeof window !== 'undefined' && window.location && window.location.search.includes('debug=true')) {
        window.Tegaki.ErrorManagerInstance.setDebugMode(true);
    }
    
    console.log('🚨 Tegaki.ErrorManagerInstance 初期化完了');
});

// グローバル登録（下位互換）
if (typeof window !== 'undefined') {
    window.ErrorManager = ErrorManager;
}

// 🔄 PixiJS v8対応準備コメント
// - エラー処理API基本的に変更なし
// - PopupManager統合はv8でも継続利用可能

console.log('🚨 ErrorManager (Phase1修復版) Loaded - ポップアップ統合・EventBus連携強化完了');