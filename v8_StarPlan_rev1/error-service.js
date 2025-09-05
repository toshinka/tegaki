/**
 * error-service.js - ErrorService 衛星
 * エラーフロー管理、UI通知
 */

window.MyApp = window.MyApp || {};

window.MyApp.ErrorService = class ErrorService {
    constructor() {
        this.mainController = null;
        this.errorLog = [];
        this.maxLogSize = 100;
        this.debug = false;
    }

    // 主星との接続
    async register(mainController) {
        this.mainController = mainController;
        this.debug = window.MyApp.config?.debug || false;
        
        if (this.debug) console.log('[ErrorService] Registered with MainController');
        return true;
    }

    // 回復可能エラーの報告
    reportRecoverable(code, message, context = null) {
        const errorData = {
            type: 'recoverable',
            code,
            message,
            context,
            timestamp: Date.now(),
            stack: new Error().stack
        };

        this.logError(errorData);
        this.notifyUser(errorData);
        
        if (this.debug) {
            console.warn('[ErrorService] Recoverable error:', errorData);
        }
    }

    // 致命的エラーの報告
    reportFatal(code, message, context = null) {
        const errorData = {
            type: 'fatal',
            code,
            message,
            context,
            timestamp: Date.now(),
            stack: new Error().stack
        };

        this.logError(errorData);
        this.notifyUser(errorData);
        
        console.error('[ErrorService] Fatal error:', errorData);
        
        // 致命的エラーの場合はアプリケーション停止も検討
        if (this.shouldStopApplication(code)) {
            this.stopApplication(errorData);
        }
    }

    // エラーログ記録
    logError(errorData) {
        this.errorLog.push(errorData);
        
        // ログサイズ制限
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog = this.errorLog.slice(-this.maxLogSize);
        }
    }

    // ユーザーへの通知
    notifyUser(errorData) {
        try {
            // UIService を通じて通知
            if (this.mainController) {
                const uiService = this.mainController.getSatellite('UIService');
                if (uiService && uiService.showError) {
                    uiService.showError(errorData);
                    return;
                }
            }
            
            // フォールバック: 直接DOM操作
            this.showErrorMessageFallback(errorData);
            
        } catch (error) {
            // 通知自体が失敗した場合のフォールバック
            console.error('[ErrorService] Failed to notify user:', error);
            this.showErrorMessageFallback({
                message: 'エラー通知システムに問題が発生しました',
                type: 'fatal'
            });
        }
    }

    // フォールバックエラー表示
    showErrorMessageFallback(errorData) {
        const existingError = document.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }

        const errorEl = document.createElement('div');
        errorEl.className = 'error-message';
        
        // エラータイプに応じてスタイル調整
        if (errorData.type === 'fatal') {
            errorEl.style.background = '#d32f2f';
        } else {
            errorEl.style.background = '#f57c00';
        }
        
        errorEl.style.position = 'fixed';
        errorEl.style.top = '20px';
        errorEl.style.right = '20px';
        errorEl.style.color = 'white';
        errorEl.style.padding = '12px 16px';
        errorEl.style.borderRadius = '8px';
        errorEl.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.3)';
        errorEl.style.zIndex = '3000';
        errorEl.style.maxWidth = '300px';
        errorEl.style.transform = 'translateX(100%)';
        errorEl.style.transition = 'transform 0.3s ease';
        
        // エラーメッセージを表示用に変換
        const displayMessage = this.formatErrorMessage(errorData);
        errorEl.textContent = displayMessage;
        
        document.body.appendChild(errorEl);
        
        // アニメーション表示
        requestAnimationFrame(() => {
            errorEl.style.transform = 'translateX(0)';
        });
        
        // 自動削除（致命的エラー以外）
        if (errorData.type !== 'fatal') {
            setTimeout(() => {
                errorEl.style.transform = 'translateX(100%)';
                setTimeout(() => errorEl.remove(), 300);
            }, 5000);
        }
        
        // クリックで削除
        errorEl.addEventListener('click', () => {
            errorEl.style.transform = 'translateX(100%)';
            setTimeout(() => errorEl.remove(), 300);
        });
    }

    // エラーメッセージのフォーマット
    formatErrorMessage(errorData) {
        const userFriendlyMessages = {
            'INVALID_SATELLITE': '内部サービスの初期化に失敗しました',
            'SATELLITE_NOT_FOUND': '必要なサービスが見つかりません',
            'EVENT_HANDLING_ERROR': 'イベント処理中にエラーが発生しました',
            'HISTORY_ACTION_ERROR': '履歴操作中にエラーが発生しました',
            'SHORTCUT_ERROR': 'ショートカット処理中にエラーが発生しました',
            'DRAWING_ENGINE_ERROR': '描画エンジンでエラーが発生しました',
            'LAYER_SERVICE_ERROR': 'レイヤー管理でエラーが発生しました',
            'TOOL_ERROR': 'ツール操作中にエラーが発生しました',
            'UI_ERROR': 'UI操作中にエラーが発生しました',
            'PIXI_ERROR': 'グラフィックス処理でエラーが発生しました'
        };

        const friendlyMessage = userFriendlyMessages[errorData.code];
        return friendlyMessage || errorData.message || 'エラーが発生しました';
    }

    // アプリケーション停止判定
    shouldStopApplication(code) {
        const fatalCodes = [
            'PIXI_INITIALIZATION_FAILED',
            'CRITICAL_SERVICE_FAILURE',
            'MEMORY_EXHAUSTED'
        ];
        
        return fatalCodes.includes(code);
    }

    // アプリケーション停止
    stopApplication(errorData) {
        console.error('[ErrorService] Stopping application due to fatal error:', errorData);
        
        // 描画停止
        try {
            if (this.mainController) {
                const drawingEngine = this.mainController.getSatellite('DrawingEngine');
                if (drawingEngine && drawingEngine.app) {
                    drawingEngine.app.ticker.stop();
                }
            }
        } catch (error) {
            console.error('[ErrorService] Failed to stop drawing engine:', error);
        }
        
        // UI更新
        const canvasArea = document.querySelector('.canvas-area');
        if (canvasArea) {
            canvasArea.innerHTML = `
                <div style="
                    text-align: center; 
                    color: var(--futaba-maroon, #800000); 
                    font-size: 18px; 
                    padding: 40px;
                ">
                    <div>⚠️ 致命的なエラーが発生しました</div>
                    <div style="font-size: 14px; margin-top: 10px; color: #666;">
                        ページをリロードしてください
                    </div>
                    <div style="font-size: 12px; margin-top: 20px; color: #999;">
                        Error Code: ${errorData.code || 'UNKNOWN'}
                    </div>
                </div>
            `;
        }
    }

    // エラーログの取得（デバッグ用）
    getErrorLog() {
        return [...this.errorLog];
    }

    // エラーログのクリア
    clearErrorLog() {
        this.errorLog = [];
        if (this.debug) console.log('[ErrorService] Error log cleared');
    }

    // 統計情報の取得
    getErrorStats() {
        const stats = {
            total: this.errorLog.length,
            recoverable: 0,
            fatal: 0,
            byCodes: {}
        };

        this.errorLog.forEach(error => {
            if (error.type === 'recoverable') stats.recoverable++;
            if (error.type === 'fatal') stats.fatal++;
            
            if (error.code) {
                stats.byCodes[error.code] = (stats.byCodes[error.code] || 0) + 1;
            }
        });

        return stats;
    }

    // パフォーマンス監視
    measurePerformance(operation, fn) {
        if (!this.debug) return fn();
        
        const start = performance.now();
        
        try {
            const result = fn();
            const duration = performance.now() - start;
            
            if (duration > 16) { // 1フレーム以上かかった場合
                console.warn(`[ErrorService] Slow operation: ${operation} took ${duration.toFixed(2)}ms`);
            }
            
            return result;
        } catch (error) {
            const duration = performance.now() - start;
            this.reportRecoverable('PERFORMANCE_ERROR', `Operation ${operation} failed after ${duration.toFixed(2)}ms`, {
                operation,
                error: error.message,
                duration
            });
            throw error;
        }
    }
};