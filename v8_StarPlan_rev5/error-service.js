/**
 * ファイル名: error-service.js
 * @provides ErrorService, エラー処理機能, 復旧処理
 * @requires MainController API
 * ErrorService衛星 - エラーフロー管理、UI通知、復旧処理
 * 星型分離版 v8rev8 - 修正版（type付きイベント対応）
 */

window.ErrorService = class ErrorService {
    constructor() {
        this.mainApi = null;
        this.errorHistory = [];
        this.maxHistorySize = 100;
        this.errorCounts = new Map();
        this.suppressedErrors = new Set();
        this.initialized = false;
    }
    
    async register(mainApi) {
        this.mainApi = mainApi;
    }
    
    async initialize() {
        try {
            this.setupGlobalErrorHandlers();
            this.log('ErrorService initialized successfully');
            this.initialized = true;
            
        } catch (error) {
            console.error('[ErrorService] Failed to initialize:', error);
            throw error;
        }
    }
    
    setupGlobalErrorHandlers() {
        // グローバルエラーキャッチ
        window.addEventListener('error', (event) => {
            this.reportRecoverable('GLOBAL_ERROR', event.message, {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack
            });
        });
        
        // Promise エラーキャッチ
        window.addEventListener('unhandledrejection', (event) => {
            this.reportRecoverable('UNHANDLED_PROMISE', event.reason?.message || 'Unhandled promise rejection', {
                reason: event.reason,
                stack: event.reason?.stack
            });
        });
        
        this.log('Global error handlers setup completed');
    }
    
    handleError(event) {
        if (!event || !event.code) {
            this.log('Invalid error event received:', event);
            return;
        }
        
        try {
            const errorData = {
                code: event.code,
                message: event.message || 'Unknown error',
                error: event.error,
                stack: event.stack,
                timestamp: event.timestamp || Date.now(),
                source: event.source || 'Unknown',
                context: event.context || {}
            };
            
            // エラー頻度チェック
            const errorKey = `${errorData.source}:${errorData.code}`;
            const count = this.errorCounts.get(errorKey) || 0;
            this.errorCounts.set(errorKey, count + 1);
            
            // 同一エラーが短時間で多発している場合は抑制
            if (count > 5) {
                if (!this.suppressedErrors.has(errorKey)) {
                    this.suppressedErrors.add(errorKey);
                    this.log(`Error ${errorKey} suppressed due to high frequency`);
                    this.showErrorNotification('エラー抑制', `${errorData.code} エラーが多発しているため、通知を抑制します`, 'warning');
                }
                return;
            }
            
            // エラー履歴に追加
            this.addToHistory(errorData);
            
            // エラーレベルに応じた処理
            if (this.isCriticalError(errorData)) {
                this.handleCriticalError(errorData);
            } else {
                this.handleRecoverableError(errorData);
            }
            
        } catch (processingError) {
            console.error('[ErrorService] Error processing failed:', processingError);
        }
    }
    
    reportRecoverable(code, message, context = {}) {
        this.handleError({
            code,
            message,
            error: message,
            stack: new Error().stack,
            timestamp: Date.now(),
            source: 'Manual',
            context,
            level: 'recoverable'
        });
    }
    
    reportFatal(code, message, stack = null) {
        this.handleError({
            code,
            message,
            error: message,
            stack: stack || new Error().stack,
            timestamp: Date.now(),
            source: 'Manual',
            level: 'fatal'
        });
    }
    
    isCriticalError(errorData) {
        const criticalCodes = [
            'INIT_FAILED',
            'ENGINE_INIT_ERROR',
            'FATAL_RENDER_ERROR',
            'MEMORY_ERROR',
            'SECURITY_ERROR'
        ];
        
        return criticalCodes.includes(errorData.code) || errorData.level === 'fatal';
    }
    
    handleCriticalError(errorData) {
        this.log(`Critical error detected: ${errorData.code}`, errorData);
        
        // 致命的エラーの場合は UI に大きく表示
        this.showCriticalErrorDialog(errorData);
        
        // アプリケーション状態をセーフモードに移行
        this.enterSafeMode(errorData);
        
        // エラー報告を外部に送信（本来なら）
        this.reportToExternal(errorData);
    }
    
    handleRecoverableError(errorData) {
        this.log(`Recoverable error: ${errorData.code}`, errorData);
        
        // 軽微なエラーの場合は通知のみ
        this.showErrorNotification(
            'エラーが発生しました',
            `${errorData.code}: ${errorData.message}`,
            'error'
        );
        
        // 自動復旧を試行
        this.attemptRecovery(errorData);
    }
    
    showCriticalErrorDialog(errorData) {
        try {
            const dialog = document.createElement('div');
            dialog.className = 'critical-error-dialog';
            dialog.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(128, 0, 0, 0.8);
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            `;
            
            dialog.innerHTML = `
                <div class="error-content" style="
                    background: #fff;
                    border: 3px solid #dc3545;
                    border-radius: 12px;
                    padding: 32px;
                    max-width: 500px;
                    width: 90%;
                    text-align: center;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
                ">
                    <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                    <div class="error-title" style="
                        font-size: 24px;
                        font-weight: 600;
                        color: #dc3545;
                        margin-bottom: 16px;
                    ">致命的なエラーが発生しました</div>
                    <div class="error-message" style="
                        font-size: 16px;
                        color: #333;
                        margin-bottom: 8px;
                        line-height: 1.4;
                    ">${errorData.message}</div>
                    <div class="error-code" style="
                        font-size: 12px;
                        color: #666;
                        font-family: monospace;
                        margin-bottom: 24px;
                    ">エラーコード: ${errorData.code}</div>
                    <div class="error-buttons" style="
                        display: flex;
                        gap: 12px;
                        justify-content: center;
                    ">
                        <button class="error-reload" style="
                            padding: 10px 20px;
                            border: 2px solid #dc3545;
                            border-radius: 6px;
                            background: #dc3545;
                            color: white;
                            font-weight: 600;
                            cursor: pointer;
                        ">ページを再読み込み</button>
                        <button class="error-continue" style="
                            padding: 10px 20px;
                            border: 2px solid #6c757d;
                            border-radius: 6px;
                            background: #6c757d;
                            color: white;
                            font-weight: 600;
                            cursor: pointer;
                        ">続行を試行</button>
                    </div>
                </div>
            `;
            
            const reloadBtn = dialog.querySelector('.error-reload');
            const continueBtn = dialog.querySelector('.error-continue');
            
            reloadBtn.addEventListener('click', () => {
                window.location.reload();
            });
            
            continueBtn.addEventListener('click', () => {
                dialog.remove();
                this.exitSafeMode();
            });
            
            document.body.appendChild(dialog);
            
        } catch (displayError) {
            // UI表示に失敗した場合はコンソールとアラートで
            console.error('Critical Error Display Failed:', displayError);
            alert(`致命的エラー: ${errorData.code}\n${errorData.message}\n\nページを再読み込みしてください。`);
        }
    }
    
    showErrorNotification(title, message, type = 'error', duration = 5000) {
        try {
            const ui = this.mainApi?.getSatellite('ui');
            if (ui && ui.getApi && ui.getApi().showNotification) {
                ui.getApi().showNotification(title, message, type, duration);
            } else {
                // UI サービスが利用できない場合はコンソール出力
                console.error(`[${type.toUpperCase()}] ${title}: ${message}`);
            }
        } catch (error) {
            console.error('Error notification failed:', error);
        }
    }
    
    enterSafeMode(errorData) {
        try {
            this.log('Entering safe mode due to critical error');
            
            // 描画を停止
            const tools = this.mainApi?.getSatellite('tools');
            if (tools && tools.getApi) {
                tools.getApi().cancelDrawing?.();
            }
            
            // UI を制限モードに
            document.querySelectorAll('.tool-button').forEach(btn => {
                if (btn.id !== 'pen-tool') {
                    btn.classList.add('disabled');
                }
            });
            
            // ステータスにセーフモード表示
            const statusPanel = document.querySelector('.status-panel');
            if (statusPanel) {
                statusPanel.style.borderColor = '#dc3545';
                statusPanel.style.background = '#fff5f5';
            }
            
        } catch (safeModeError) {
            console.error('Failed to enter safe mode:', safeModeError);
        }
    }
    
    exitSafeMode() {
        try {
            this.log('Exiting safe mode');
            
            // UI制限を解除
            document.querySelectorAll('.tool-button').forEach(btn => {
                btn.classList.remove('disabled');
            });
            
            // ステータスパネルを元に戻す
            const statusPanel = document.querySelector('.status-panel');
            if (statusPanel) {
                statusPanel.style.borderColor = '';
                statusPanel.style.background = '';
            }
            
            // エラー抑制をリセット
            this.suppressedErrors.clear();
            this.errorCounts.clear();
            
        } catch (exitError) {
            console.error('Failed to exit safe mode:', exitError);
        }
    }
    
    attemptRecovery(errorData) {
        try {
            this.log(`Attempting recovery for: ${errorData.code}`);
            
            // エラーコード別の復旧処理
            switch (errorData.code) {
                case 'RENDER_ERROR':
                    this.recoverRenderError();
                    break;
                case 'MEMORY_WARNING':
                    this.recoverMemoryIssue();
                    break;
                case 'POINTER_ERROR':
                    this.recoverPointerError();
                    break;
                default:
                    this.log(`No specific recovery for ${errorData.code}`);
            }
            
        } catch (recoveryError) {
            this.log('Recovery attempt failed:', recoveryError);
        }
    }
    
    recoverRenderError() {
        // レンダリングエラーの復旧
        const engine = this.mainApi?.getSatellite('engine');
        if (engine && engine.app) {
            try {
                engine.app.ticker.stop();
                setTimeout(() => {
                    engine.app.ticker.start();
                }, 100);
                this.log('Render recovery attempted');
            } catch (error) {
                this.log('Render recovery failed:', error);
            }
        }
    }
    
    recoverMemoryIssue() {
        // メモリ問題の復旧
        try {
            // ガベージコレクションの強制実行（可能であれば）
            if (window.gc && typeof window.gc === 'function') {
                window.gc();
            }
            
            // 不要なリソースのクリーンアップ
            this.cleanupResources();
            this.log('Memory recovery attempted');
            
        } catch (error) {
            this.log('Memory recovery failed:', error);
        }
    }
    
    recoverPointerError() {
        // ポインターエラーの復旧
        const position = this.mainApi?.getSatellite('position');
        if (position && position.getApi) {
            try {
                position.getApi().stopPanning?.();
                this.log('Pointer recovery attempted');
            } catch (error) {
                this.log('Pointer recovery failed:', error);
            }
        }
    }
    
    cleanupResources() {
        try {
            // 完了したパスのテクスチャをクリーンアップ
            const engine = this.mainApi?.getSatellite('engine');
            if (engine && engine.paths) {
                const completePaths = engine.paths.filter(p => p.isComplete);
                // 実際のクリーンアップ処理はここで実装
            }
            
        } catch (error) {
            this.log('Resource cleanup failed:', error);
        }
    }
    
    addToHistory(errorData) {
        this.errorHistory.unshift(errorData);
        
        // 履歴サイズ制限
        if (this.errorHistory.length > this.maxHistorySize) {
            this.errorHistory = this.errorHistory.slice(0, this.maxHistorySize);
        }
    }
    
    reportToExternal(errorData) {
        // 本来なら外部のエラー収集サービスに送信
        this.log('External error reporting:', errorData);
    }
    
    // エラー統計の取得
    getErrorStats() {
        const stats = {
            totalErrors: this.errorHistory.length,
            recentErrors: this.errorHistory.slice(0, 10),
            errorCounts: Object.fromEntries(this.errorCounts),
            suppressedErrorCount: this.suppressedErrors.size
        };
        
        return stats;
    }
    
    // エラー履歴のエクスポート
    exportErrorHistory() {
        const exportData = {
            version: '8.0.8',
            timestamp: Date.now(),
            errors: this.errorHistory,
            stats: this.getErrorStats()
        };
        
        return JSON.stringify(exportData, null, 2);
    }
    
    // エラー履歴のクリア
    clearErrorHistory() {
        this.errorHistory = [];
        this.errorCounts.clear();
        this.suppressedErrors.clear();
        this.log('Error history cleared');
    }
    
    // ユーティリティメソッド
    log(message, ...args) {
        const config = this.mainApi?.getConfig();
        if (config?.debug) {
            console.log(`[ErrorService] ${message}`, ...args);
        }
    }
    
    // Public API
    getApi() {
        return {
            reportRecoverable: (code, message, context) => this.reportRecoverable(code, message, context),
            reportFatal: (code, message, stack) => this.reportFatal(code, message, stack),
            getStats: () => this.getErrorStats(),
            exportHistory: () => this.exportErrorHistory(),
            clearHistory: () => this.clearErrorHistory(),
            enterSafeMode: (errorData) => this.enterSafeMode(errorData),
            exitSafeMode: () => this.exitSafeMode()
        };
    }
};