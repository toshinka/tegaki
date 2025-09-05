/**
 * ==========================================================
 * @module ErrorService
 * @role   エラーハンドリング・ユーザー通知管理
 * @depends MainController (イベント経由)
 * @provides
 *   - receiveError(event): エラーイベント受信・処理
 *   - notifyFatal(info): 致命的エラーの通知
 * @notes
 *   - 衛星は主星(MainController)にのみ依存すること。
 *   - エラーは隠蔽せず、主星経由で通知すること。
 *   - consoleログは必要最低限に抑える。
 * ==========================================================
 */
window.MyApp = window.MyApp || {};
(function(global){
    class ErrorService {
        constructor() {
            this.name = 'ErrorService';
            this.mainApi = null;
        }

        register(mainApi) { 
            this.mainApi = mainApi;
            global.MyApp.ErrorServiceInstance = this;
        }

        receiveError(event) {
            // event: { type: 'error.recoverable'|'error.fatal', payload:{code,msg,context}}
            const payload = event.payload || {};
            const errorMsg = `${payload.code || 'ERR'}: ${payload.msg || 'unknown'}`;
            
            // UI表示（UIService があれば使う）
            if(global.MyApp.UIServiceInstance && global.MyApp.UIServiceInstance.showError) {
                global.MyApp.UIServiceInstance.showError(errorMsg);
            } else {
                // フォールバック
                this._showFallbackError(errorMsg);
            }
            
            // 致命的エラーの場合は追加処理
            if (event.type === 'error.fatal') {
                console.error('[ErrorService] FATAL:', errorMsg, payload.context || '');
            } else if (global.MyApp.debug) {
                console.warn('[ErrorService]', errorMsg, payload.context || '');
            }
        }

        notifyFatal(info) {
            this.receiveError({ 
                type:'error.fatal', 
                payload: info 
            });
        }

        _showFallbackError(message) {
            // 簡易エラー表示（UIService未使用時のフォールバック）
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = `
                position: fixed; top: 20px; right: 20px; z-index: 10000;
                background: #800000; color: white;
                padding: 16px; border-radius: 8px; 
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                max-width: 300px; font-size: 14px;
            `;
            errorDiv.innerHTML = `
                <strong>エラー</strong><br>
                <small>${message}</small>
            `;
            
            document.body.appendChild(errorDiv);
            
            setTimeout(() => {
                if (errorDiv.parentNode) {
                    errorDiv.parentNode.removeChild(errorDiv);
                }
            }, 5000);
        }
    }

    global.MyApp.ErrorService = ErrorService;
})(window);