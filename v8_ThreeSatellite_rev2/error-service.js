/**
 * @module   ErrorService
 * @role     エラー検知・通知
 * @depends  MainController
 * @provides reportError(code, details), showErrorNotification(msg)
 * @notes    payload に循環参照を含めない、全イベント型統一
 * @flow     衛星内部エラー → MainController → UI表示 / ログ
 * @memory   発生済みエラー履歴
 */

const ErrorService = (() => {
    let errorHistory = [];
    let initialized = false;
    
    // Error codes and their descriptions
    const ERROR_CODES = {
        'APP_START_FAILED': 'アプリケーション開始エラー',
        'ENGINE_INIT_FAILED': '描画エンジン初期化エラー',
        'LAYER_CREATE_FAILED': 'レイヤー作成エラー',
        'UI_SETUP_FAILED': 'UI設定エラー',
        'CANVAS_RESIZE_FAILED': 'キャンバスリサイズエラー',
        'DRAWING_OPERATION_FAILED': '描画操作エラー',
        'LIBRARY_LOAD_FAILED': 'ライブラリ読み込みエラー',
        'COORDINATE_CONVERSION_FAILED': '座標変換エラー',
        'MEMORY_ALLOCATION_FAILED': 'メモリ割り当てエラー',
        'CIRCULAR_REFERENCE_ERROR': '循環参照エラー',
        'EVENT_PAYLOAD_ERROR': 'イベントpayloadエラー',
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
            reportError('UNKNOWN_ERROR', {
                message: event.message,
                filename: event.filename,
                line: event.lineno,
                column: event.colno
            });
        });
        
        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            reportError('UNKNOWN_ERROR', {
                message: 'Unhandled Promise Rejection',
                reason: event.reason?.toString() || 'Unknown reason'
            });
        });
        
        // PixiJS specific error handling
        window.addEventListener('pixi-error', (event) => {
            reportError('DRAWING_OPERATION_FAILED', {
                message: 'PixiJS Error',
                detail: event.detail || 'Unknown PixiJS error'
            });
        });
    }
    
    function reportError(code, details) {
        if (!initialized) {
            console.error('[ErrorService] Not initialized, logging directly:', code, details);
            return;
        }
        
        const timestamp = new Date().toISOString();
        const errorEntry = {
            code,
            details: sanitizeErrorDetails(details),
            timestamp,
            description: ERROR_CODES[code] || ERROR_CODES['UNKNOWN_ERROR']
        };
        
        errorHistory.push(errorEntry);
        
        // Keep only the last 50 errors to prevent memory bloat
        if (errorHistory.length > 50) {
            errorHistory = errorHistory.slice(-50);
        }
        
        // Log to console
        console.error(`[ErrorService] ${errorEntry.description}:`, errorEntry.details);
        
        // Show user notification for critical errors
        if (isCriticalError(code)) {
            showErrorNotification(errorEntry.description, errorEntry.details);
        }
        
        // Notify MainController - 循環参照なしで通知
        window.MainController?.safeNotify('error-reported', {
            code,
            description: errorEntry.description,
            timestamp,
            isCritical: isCriticalError(code),
            // detailsは含めない（循環参照の可能性があるため）
            hasDetails: errorEntry.details ? true : false
        });
    }
    
    /**
     * 循環参照を安全に処理してエラー詳細を無害化
     */
    function sanitizeErrorDetails(details) {
        try {
            if (typeof details === 'string') {
                return details;
            }
            
            if (typeof details === 'object' && details !== null) {
                const sanitized = {};
                
                for (const [key, value] of Object.entries(details)) {
                    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                        sanitized[key] = value;
                    } else if (value instanceof Error) {
                        sanitized[key] = {
                            name: value.name,
                            message: value.message,
                            stack: value.stack?.split('\n').slice(0, 5).join('\n') // スタックトレース短縮
                        };
                    } else if (typeof value === 'object') {
                        // 循環参照や PixiJS オブジェクトを除去
                        try {
                            // JSON.stringifyで循環参照をチェック
                            const testStringify = JSON.stringify(value);
                            sanitized[key] = JSON.parse(testStringify);
                        } catch (e) {
                            // 循環参照があるか、非シリアライズ可能な場合
                            if (value && value.constructor) {
                                sanitized[key] = `[Object - ${value.constructor.name}]`;
                            } else {
                                sanitized[key] = '[Object - cannot serialize]';
                            }
                        }
                    } else {
                        sanitized[key] = String(value);
                    }
                }
                
                return sanitized;
            }
            
            return String(details);
        } catch (error) {
            return 'Error details could not be sanitized';
        }
    }
    
    function isCriticalError(code) {
        const criticalErrors = [
            'APP_START_FAILED',
            'ENGINE_INIT_FAILED',
            'LIBRARY_LOAD_FAILED',
            'MEMORY_ALLOCATION_FAILED',
            'CIRCULAR_REFERENCE_ERROR'
        ];
        
        return criticalErrors.includes(code);
    }
    
    function showErrorNotification(title, details) {
        // Create temporary notification element
        const notification = document.createElement('div');
        notification.className = 'error-notification';
        notification.innerHTML = `
            <div class="error-notification-content">
                <div class="error-title">⚠️ ${title}</div>
                <div class="error-message">${getDisplayMessage(details)}</div>
                <button class="error-close" onclick="this.parentElement.parentElement.remove()">閉じる</button>
            </div>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            background: var(--futaba-cream, #f0e0d6);
            border: 2px solid var(--futaba-maroon, #800000);
            border-radius: 12px;
            padding: 16px;
            box-shadow: 0 4px 16px rgba(128, 0, 0, 0.3);
            max-width: 400px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            animation: slideIn 0.3s ease-out;
        `;
        
        // Add CSS animation
        if (!document.getElementById('error-notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'error-notification-styles';
            styles.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .error-notification-content .error-title {
                    color: var(--futaba-maroon, #800000);
                    font-weight: 600;
                    margin-bottom: 8px;
                    font-size: 14px;
                }
                .error-notification-content .error-message {
                    color: var(--text-primary, #2c1810);
                    font-size: 12px;
                    margin-bottom: 12px;
                    line-height: 1.4;
                }
                .error-notification-content .error-close {
                    background: var(--futaba-maroon, #800000);
                    color: white;
                    border: none;
                    padding: 4px 12px;
                    border-radius: 4px;
                    font-size: 12px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .error-notification-content .error-close:hover {
                    background: var(--futaba-light-maroon, #aa5a56);
                }
            `;
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(notification);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 10000);
    }
    
    function getDisplayMessage(details) {
        if (typeof details === 'string') {
            return details;
        }
        
        if (typeof details === 'object' && details !== null) {
            if (details.message) {
                return details.message;
            }
            
            // Try to create a readable message from object properties
            const keys = Object.keys(details).slice(0, 3); // 最初の3つのキーのみ表示
            if (keys.length > 0) {
                return keys.map(key => `${key}: ${details[key]}`).join(', ');
            }
        }
        
        return 'エラーの詳細情報を取得できませんでした';
    }
    
    function getErrorHistory() {
        return [...errorHistory];
    }
    
    function clearErrorHistory() {
        errorHistory = [];
        window.MainController?.safeNotify('error-history-cleared', {});
    }
    
    function getErrorStats() {
        const stats = {
            total: errorHistory.length,
            byCode: {},
            recent: errorHistory.slice(-10).map(error => ({
                code: error.code,
                description: error.description,
                timestamp: error.timestamp,
                isCritical: isCriticalError(error.code)
            }))
        };
        
        errorHistory.forEach(error => {
            stats.byCode[error.code] = (stats.byCode[error.code] || 0) + 1;
        });
        
        return stats;
    }
    
    function logDebugInfo(category, message, data = {}) {
        if (APP_CONFIG?.debug) {
            console.log(`[Debug:${category}]`, message, sanitizeErrorDetails(data));
        }
    }
    
    function logPerformanceWarning(operation, duration, threshold = 100) {
        if (duration > threshold) {
            reportError('PERFORMANCE_WARNING', {
                operation,
                duration: `${duration}ms`,
                threshold: `${threshold}ms`
            });
        }
    }
    
    /**
     * 循環参照エラーを専用に報告
     */
    function reportCircularReference(eventType, objectInfo = {}) {
        reportError('CIRCULAR_REFERENCE_ERROR', {
            eventType,
            message: `Event payload contains circular references: ${eventType}`,
            ...sanitizeErrorDetails(objectInfo)
        });
    }
    
    /**
     * イベントpayloadエラーを専用に報告
     */
    function reportEventPayloadError(eventType, error) {
        reportError('EVENT_PAYLOAD_ERROR', {
            eventType,
            message: `Event payload error: ${eventType}`,
            error: error.message || String(error)
        });
    }
    
    // Event Handler from MainController
    function onEvent(event) {
        switch (event.type) {
            case 'performance-measure':
                if (event.payload?.operation && event.payload?.duration) {
                    logPerformanceWarning(
                        event.payload.operation, 
                        event.payload.duration,
                        event.payload.threshold
                    );
                }
                break;
                
            case 'debug-log-requested':
                if (event.payload?.category && event.payload?.message) {
                    logDebugInfo(
                        event.payload.category,
                        event.payload.message,
                        event.payload.data
                    );
                }
                break;
                
            case 'error-history-request':
                window.MainController?.safeNotify('error-history-response', {
                    history: getErrorHistory(),
                    stats: getErrorStats()
                });
                break;
                
            case 'circular-reference-detected':
                if (event.payload?.eventType) {
                    reportCircularReference(event.payload.eventType, event.payload.objectInfo);
                }
                break;
        }
    }
    
    // Public API
    return {
        init,
        reportError,
        showErrorNotification,
        getErrorHistory,
        clearErrorHistory,
        getErrorStats,
        logDebugInfo,
        logPerformanceWarning,
        reportCircularReference,
        reportEventPayloadError,
        onEvent
    };
})();