/**
 * @module   ErrorService
 * @role     エラー検知・通知・ログ管理
 * @depends  MainController
 * @provides init(), reportError(code, details), logError(event, detail)
 * @notes    循環参照排除、フォールバック禁止、エラー隠蔽禁止、見通し重視
 * @flow     衛星内部エラー → MainController → 強制停止またはログ通知
 * @memory   エラー履歴（最小限）
 */

const ErrorService = (() => {
    let initialized = false;
    let errorHistory = [];
    
    // Error codes - 改修案に沿った定義
    const ERROR_CODES = {
        'APP_START_FAILED': 'アプリケーション開始失敗',
        'ENGINE_INIT_FAILED': '描画エンジン初期化失敗',
        'LAYER_CREATE_FAILED': 'レイヤー作成失敗',
        'UI_SETUP_FAILED': 'UI設定失敗',
        'CANVAS_RESIZE_FAILED': 'キャンバスリサイズ失敗',
        'DRAWING_OPERATION_FAILED': '描画操作失敗',
        'CAMERA_SYNC_ERROR': 'Camera同期エラー',
        'LAYER_CONTAINER_ERROR': 'レイヤーContainer管理エラー',
        'ACTIVE_LAYER_ERROR': 'アクティブレイヤー制御エラー',
        'COORDINATE_CONVERSION_ERROR': '座標変換エラー',
        'CIRCULAR_REFERENCE_ERROR': '循環参照エラー',
        'UNKNOWN_ERROR': '不明なエラー'
    };
    
    async function init() {
        try {
            setupGlobalErrorHandlers();
            initialized = true;
            console.log('[ErrorService] Initialized');
            return true;
        } catch (error) {
            console.error('[ErrorService] Initialization failed:', error);
            return false;
        }
    }
    
    function setupGlobalErrorHandlers() {
        // Global JavaScript errors
        window.addEventListener('error', (event) => {
            logError('GLOBAL_JS_ERROR', {
                message: event.message,
                filename: event.filename,
                line: event.lineno,
                column: event.colno
            });
        });
        
        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            logError('UNHANDLED_PROMISE_REJECTION', {
                message: 'Unhandled Promise Rejection',
                reason: event.reason?.toString() || 'Unknown reason'
            });
        });
    }
    
    /**
     * エラー報告 - フェイルセーフ禁止、強制停止または通知ログ
     */
    function reportError(code, details) {
        if (!initialized) {
            console.error('[ErrorService] Not initialized:', code, details);
            return;
        }
        
        const timestamp = new Date().toISOString();
        const description = ERROR_CODES[code] || ERROR_CODES['UNKNOWN_ERROR'];
        
        // 循環参照を安全に処理
        const safeDetails = sanitizeDetails(details);
        
        const errorEntry = {
            code,
            description,
            details: safeDetails,
            timestamp
        };
        
        // エラー履歴保存（最大50件）
        errorHistory.push(errorEntry);
        if (errorHistory.length > 50) {
            errorHistory = errorHistory.slice(-50);
        }
        
        // 重要なエラーは強制停止
        if (isCriticalError(code)) {
            console.error(`[ErrorService] CRITICAL ERROR - ${description}:`, safeDetails);
            showCriticalErrorDialog(description, safeDetails);
            // フォールバック禁止 - 重要なエラーは処理を止める
            throw new Error(`Critical error: ${code} - ${description}`);
        } else {
            console.warn(`[ErrorService] ${description}:`, safeDetails);
            showWarningNotification(description);
        }
        
        // MainController経由で通知
        window.MainController?.emit('error-reported', {
            code,
            description,
            timestamp,
            isCritical: isCriticalError(code)
        });
    }
    
    /**
     * 循環参照を安全に除去
     */
    function sanitizeDetails(details) {
        try {
            if (typeof details === 'string') {
                return details;
            }
            
            if (typeof details === 'object' && details !== null) {
                // JSON.stringifyで循環参照をチェック
                JSON.stringify(details);
                return details;
            }
            
            return String(details);
        } catch (e) {
            // 循環参照がある場合
            return {
                error: 'Circular reference detected in error details',
                originalType: typeof details,
                stringified: String(details).substring(0, 100)
            };
        }
    }
    
    /**
     * クリティカルエラー判定
     */
    function isCriticalError(code) {
        const criticalCodes = [
            'APP_START_FAILED',
            'ENGINE_INIT_FAILED',
            'CAMERA_SYNC_ERROR',
            'LAYER_CONTAINER_ERROR',
            'CIRCULAR_REFERENCE_ERROR'
        ];
        return criticalCodes.includes(code);
    }
    
    /**
     * クリティカルエラーダイアログ表示
     */
    function showCriticalErrorDialog(title, details) {
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(128, 0, 0, 0.9);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            font-family: monospace;
            font-size: 14px;
        `;
        
        dialog.innerHTML = `
            <div style="text-align: center; max-width: 600px; padding: 40px;">
                <h2 style="color: #ffcccc; margin-bottom: 20px;">💥 重大エラー</h2>
                <p style="margin-bottom: 20px;">${title}</p>
                <pre style="background: rgba(0,0,0,0.3); padding: 20px; border-radius: 8px; text-align: left; overflow: auto;">
${JSON.stringify(details, null, 2).substring(0, 500)}
                </pre>
                <p style="margin-top: 20px; color: #ffcccc;">
                    アプリケーションを再読み込みしてください
                </p>
                <button onclick="location.reload()" style="
                    margin-top: 20px; padding: 10px 20px; 
                    background: white; color: #800000; 
                    border: none; border-radius: 4px; 
                    cursor: pointer; font-weight: bold;
                ">再読み込み</button>
            </div>
        `;
        
        document.body.appendChild(dialog);
    }
    
    /**
     * 警告通知表示
     */
    function showWarningNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px; right: 20px;
            background: var(--futaba-cream, #f0e0d6);
            border: 2px solid var(--futaba-maroon, #800000);
            border-radius: 8px;
            padding: 16px;
            box-shadow: 0 4px 16px rgba(128, 0, 0, 0.3);
            max-width: 400px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 14px;
            color: var(--futaba-maroon, #800000);
            animation: slideIn 0.3s ease-out;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 16px;">⚠️</span>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    background: none; border: none; 
                    cursor: pointer; font-size: 16px;
                    margin-left: auto;
                ">×</button>
            </div>
        `;
        
        if (!document.getElementById('error-notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'error-notification-styles';
            styles.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(notification);
        
        // 5秒後に自動削除
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
    
    /**
     * エラーログ記録 - イベント型とdetailを記録
     */
    function logError(event, detail) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            event,
            detail: sanitizeDetails(detail),
            timestamp
        };
        
        console.error(`[ErrorService] ${event}:`, logEntry.detail);
        
        // MainController経由で通知
        window.MainController?.emit('error-logged', {
            event,
            timestamp,
            hasDetail: logEntry.detail ? true : false
        });
    }
    
    /**
     * 警告ログ
     */
    function warn(message) {
        console.warn(`[ErrorService] ${message}`);
    }
    
    /**
     * 専用エラー報告メソッド群
     */
    function reportCameraSyncError(operation, cameraState, error) {
        reportError('CAMERA_SYNC_ERROR', {
            operation,
            cameraX: cameraState?.x,
            cameraY: cameraState?.y,
            error: error?.message || String(error)
        });
    }
    
    function reportLayerContainerError(layerId, operation, error) {
        reportError('LAYER_CONTAINER_ERROR', {
            layerId,
            operation,
            error: error?.message || String(error)
        });
    }
    
    function reportActiveLayerError(operation, layerId, error) {
        reportError('ACTIVE_LAYER_ERROR', {
            operation,
            layerId,
            error: error?.message || String(error)
        });
    }
    
    function reportCircularReference(eventType, objectInfo = {}) {
        reportError('CIRCULAR_REFERENCE_ERROR', {
            eventType,
            objectInfo: sanitizeDetails(objectInfo)
        });
    }
    
    /**
     * エラー履歴取得
     */
    function getErrorHistory() {
        return [...errorHistory];
    }
    
    /**
     * エラー履歴クリア
     */
    function clearErrorHistory() {
        errorHistory = [];
        window.MainController?.emit('error-history-cleared');
    }
    
    // Event handler from MainController
    function onEvent(event) {
        switch (event.type) {
            case 'error-occurred':
                if (event.payload?.source && event.payload?.error) {
                    logError(`${event.payload.source}_ERROR`, event.payload.error);
                }
                break;
                
            case 'camera-sync-error':
                if (event.payload?.operation) {
                    reportCameraSyncError(
                        event.payload.operation,
                        event.payload.cameraState,
                        event.payload.error
                    );
                }
                break;
                
            case 'layer-container-error':
                if (event.payload?.layerId && event.payload?.operation) {
                    reportLayerContainerError(
                        event.payload.layerId,
                        event.payload.operation,
                        event.payload.error
                    );
                }
                break;
                
            case 'active-layer-error':
                if (event.payload?.operation && event.payload?.layerId) {
                    reportActiveLayerError(
                        event.payload.operation,
                        event.payload.layerId,
                        event.payload.error
                    );
                }
                break;
                
            case 'circular-reference-detected':
                if (event.payload?.eventType) {
                    reportCircularReference(
                        event.payload.eventType,
                        event.payload.objectInfo
                    );
                }
                break;
        }
    }
    
    // Public API
    return {
        init,
        reportError,
        logError,
        warn,
        reportCameraSyncError,
        reportLayerContainerError,
        reportActiveLayerError,
        reportCircularReference,
        getErrorHistory,
        clearErrorHistory,
        onEvent
    };
})();