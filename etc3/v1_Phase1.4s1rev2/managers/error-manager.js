/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.5
 * 🎯 AI_WORK_SCOPE: エラーハンドリング統一・重複排除・DRY原則適用
 * 🔧 Phase1.5-Step3: ErrorManager クラス実装
 * 🚨 PURE_JAVASCRIPT: ES6モジュール禁止・グローバル変数使用
 * 
 * 📋 PHASE_TARGET: Phase1.5 エラーハンドリング統一
 * 📋 V8_MIGRATION: エラー処理互換性保持
 * 📋 DRY_COMPLIANCE: 重複エラー処理完全排除
 * 📋 SOLID_COMPLIANCE: 単一責任・エラー管理統一
 */

class ErrorManager {
    constructor() {
        this.version = 'v1.5-ErrorManager';
        this.initialized = false;
        this.errorLog = [];
        this.errorElements = new Map();
        this.errorListeners = new Map();
        
        // 🎯 エラー分類統一 - 全エラータイプを統一管理
        this.errorTypes = {
            DEPENDENCY: 'dependency',
            INITIALIZATION: 'initialization',
            RUNTIME: 'runtime',
            UI: 'ui',
            API: 'api',
            VALIDATION: 'validation',
            NETWORK: 'network',
            MEMORY: 'memory'
        };
        
        // 🎯 エラー重要度統一 - 表示方法を統一
        this.severityLevels = {
            INFO: { level: 0, name: 'info', icon: 'ℹ️', color: '#4CAF50' },
            WARNING: { level: 1, name: 'warning', icon: '⚠️', color: '#FF9800' },
            ERROR: { level: 2, name: 'error', icon: '❌', color: '#F44336' },
            CRITICAL: { level: 3, name: 'critical', icon: '💀', color: '#800000' }
        };
        
        // ふたば☆デザイン設定
        this.theme = {
            background: '#f0e0d6',
            error: '#800000',
            warning: '#cf9c97',
            info: '#aa5a56',
            text: '#2c1810',
            border: '#cf9c97',
            shadow: 'rgba(128, 0, 0, 0.3)'
        };
        
        this.setupGlobalErrorHandler();
        console.log('🚨 ErrorManager 初期化完了 - エラーハンドリング統一実装');
    }
    
    /**
     * ErrorManager初期化
     */
    initialize() {
        if (this.initialized) {
            console.warn('⚠️ ErrorManager は既に初期化済みです');
            return true;
        }
        
        try {
            // スタイル設定
            this.setupErrorStyles();
            
            // エラー復旧システム設定
            this.setupRecoverySystem();
            
            // パフォーマンス監視設定
            this.setupPerformanceMonitoring();
            
            this.initialized = true;
            console.log('✅ ErrorManager 初期化完了 - 統一エラーハンドリング開始');
            return true;
            
        } catch (error) {
            console.error('❌ ErrorManager 初期化失敗:', error);
            return false;
        }
    }
    
    // ===========================================
    // 🚨 統一エラー処理（メインAPI）
    // ===========================================
    
    /**
     * エラーハンドリング統一メソッド（1つの関数で全パターン対応）
     * @param {Error|string} error - エラーオブジェクトまたはメッセージ
     * @param {string} type - エラータイプ
     * @param {string} context - エラー発生コンテキスト
     * @param {Object} options - 表示オプション
     */
    handleError(error, type = 'runtime', context = '', options = {}) {
        try {
            const errorInfo = this.createErrorInfo(error, type, context, options);
            
            // エラーログに記録
            this.errorLog.push(errorInfo);
            
            // 重要度に応じた処理
            switch (errorInfo.severity) {
                case 'critical':
                    this.showCriticalError(errorInfo);
                    this.logError(`💀 CRITICAL: ${errorInfo.message}`, errorInfo);
                    break;
                    
                case 'error':
                    this.showError(errorInfo);
                    this.logError(`❌ ERROR: ${errorInfo.message}`, errorInfo);
                    break;
                    
                case 'warning':
                    this.showWarning(errorInfo);
                    this.logWarning(`⚠️ WARNING: ${errorInfo.message}`, errorInfo);
                    break;
                    
                case 'info':
                    this.showInfo(errorInfo);
                    this.logInfo(`ℹ️ INFO: ${errorInfo.message}`, errorInfo);
                    break;
            }
            
            // エラー通知
            this.notifyErrorListeners(errorInfo);
            
            // 自動復旧試行
            this.attemptAutoRecovery(errorInfo);
            
            return errorInfo;
            
        } catch (handlingError) {
            // エラーハンドリング自体でエラーが発生した場合
            console.error('💀 ErrorManager自体でエラー発生:', handlingError);
            this.fallbackErrorDisplay(error, handlingError);
        }
    }
    
    /**
     * エラー情報作成（統一フォーマット）
     */
    createErrorInfo(error, type, context, options = {}) {
        const timestamp = Date.now();
        const errorObj = error instanceof Error ? error : new Error(error);
        
        return {
            id: this.generateErrorId(),
            timestamp,
            message: errorObj.message || String(error),
            stack: errorObj.stack,
            type: this.validateErrorType(type),
            context: context || 'unknown',
            severity: this.determineSeverity(error, type, options),
            userAgent: navigator.userAgent,
            url: window.location.href,
            options: {
                timeout: options.timeout || this.getDefaultTimeout(type),
                dismissible: options.dismissible !== false,
                persistent: options.persistent || false,
                showStack: options.showStack || false,
                autoRetry: options.autoRetry || false,
                ...options
            }
        };
    }
    
    /**
     * エラー重要度判定
     */
    determineSeverity(error, type, options = {}) {
        // 明示的に指定されている場合
        if (options.severity && this.severityLevels[options.severity.toUpperCase()]) {
            return options.severity.toLowerCase();
        }
        
        // エラータイプによる自動判定
        const criticalTypes = ['dependency', 'initialization'];
        const warningTypes = ['ui', 'validation'];
        
        if (criticalTypes.includes(type)) {
            return 'critical';
        } else if (warningTypes.includes(type)) {
            return 'warning';
        } else if (error instanceof TypeError || error instanceof ReferenceError) {
            return 'error';
        } else {
            return 'error';
        }
    }
    
    /**
     * デフォルトタイムアウト取得
     */
    getDefaultTimeout(severity) {
        const timeouts = {
            info: 3000,
            warning: 5000,
            error: 10000,
            critical: 0 // 永続表示
        };
        return timeouts[severity] || 5000;
    }
    
    // ===========================================
    // 🎨 エラー表示統一（ふたば☆デザイン）
    // ===========================================
    
    /**
     * エラー表示統一（1つの関数で全パターン対応）
     */
    showError(errorInfo) {
        const errorElement = this.createErrorElement(errorInfo);
        this.attachErrorElement(errorElement, errorInfo);
        this.scheduleErrorRemoval(errorElement, errorInfo);
        
        // エラー要素管理
        this.errorElements.set(errorInfo.id, errorElement);
    }
    
    /**
     * 警告表示
     */
    showWarning(errorInfo) {
        this.showError({ ...errorInfo, severity: 'warning' });
    }
    
    /**
     * 情報表示
     */
    showInfo(errorInfo) {
        this.showError({ ...errorInfo, severity: 'info' });
    }
    
    /**
     * 致命的エラー表示
     */
    showCriticalError(errorInfo) {
        // 画面全体を置き換え
        this.showError({ ...errorInfo, severity: 'critical' });
        
        // 致命的エラーの場合は全画面表示も検討
        if (errorInfo.type === 'initialization' || errorInfo.type === 'dependency') {
            this.showFullScreenError(errorInfo);
        }
    }
    
    /**
     * エラー要素作成（統一デザイン）
     */
    createErrorElement(errorInfo) {
        const severityConfig = this.severityLevels[errorInfo.severity.toUpperCase()];
        const errorDiv = document.createElement('div');
        
        errorDiv.className = `futaba-error futaba-error-${errorInfo.severity}`;
        errorDiv.id = `error-${errorInfo.id}`;
        
        // 統一スタイル適用
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${this.theme.background};
            color: ${this.theme.text};
            border: 2px solid ${severityConfig.color};
            padding: 16px;
            border-radius: 8px;
            box-shadow: 0 4px 16px ${this.theme.shadow};
            z-index: 9999;
            max-width: 400px;
            min-width: 300px;
            font-family: system-ui, sans-serif;
            font-size: 13px;
            animation: futabaSlideIn 0.3s ease-out;
        `;
        
        // エラー内容作成
        errorDiv.innerHTML = this.createErrorContent(errorInfo, severityConfig);
        
        // イベントリスナー設定
        this.attachErrorEventListeners(errorDiv, errorInfo);
        
        return errorDiv;
    }
    
    /**
     * エラーコンテンツ作成
     */
    createErrorContent(errorInfo, severityConfig) {
        const timeStr = new Date(errorInfo.timestamp).toLocaleTimeString();
        
        let content = `
            <div class="error-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div style="font-weight: 600; color: ${severityConfig.color};">
                    ${severityConfig.icon} ${this.getSeverityDisplayName(errorInfo.severity)}
                </div>
                <div style="font-size: 11px; opacity: 0.7;">${timeStr}</div>
            </div>
            
            <div class="error-message" style="margin-bottom: 12px; line-height: 1.4;">
                ${this.escapeHtml(errorInfo.message)}
            </div>
        `;
        
        // コンテキスト表示
        if (errorInfo.context && errorInfo.context !== 'unknown') {
            content += `
                <div class="error-context" style="font-size: 11px; opacity: 0.8; margin-bottom: 8px;">
                    📍 ${this.escapeHtml(errorInfo.context)}
                </div>
            `;
        }
        
        // スタック表示（オプション）
        if (errorInfo.options.showStack && errorInfo.stack) {
            content += `
                <details class="error-stack" style="margin-bottom: 12px;">
                    <summary style="cursor: pointer; font-size: 11px; opacity: 0.8;">📋 スタックトレース</summary>
                    <pre style="font-size: 10px; background: rgba(0,0,0,0.1); padding: 8px; border-radius: 4px; overflow: auto; max-height: 100px; margin: 4px 0 0 0;">${this.escapeHtml(errorInfo.stack.substring(0, 500))}${errorInfo.stack.length > 500 ? '...' : ''}</pre>
                </details>
            `;
        }
        
        // 診断情報表示
        const recommendations = this.getDiagnosisRecommendations(errorInfo);
        if (recommendations.length > 0) {
            content += `
                <div class="error-recommendations" style="background: rgba(128, 0, 0, 0.1); padding: 8px; border-radius: 4px; margin-bottom: 12px;">
                    <div style="font-weight: 600; font-size: 11px; margin-bottom: 4px;">🔍 推奨対処法:</div>
                    <ul style="margin: 0; padding-left: 16px; font-size: 11px;">
                        ${recommendations.map(rec => `<li>${this.escapeHtml(rec)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
        
        // ボタン群
        content += this.createErrorButtons(errorInfo);
        
        return content;
    }
    
    /**
     * エラーボタン作成
     */
    createErrorButtons(errorInfo) {
        let buttons = '<div class="error-buttons" style="display: flex; gap: 8px; flex-wrap: wrap;">';
        
        // 閉じるボタン（dismissible の場合）
        if (errorInfo.options.dismissible) {
            buttons += `
                <button class="error-btn error-btn-dismiss" 
                        style="background: rgba(128,0,0,0.1); border: 1px solid ${this.theme.border}; color: ${this.theme.text}; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">
                    閉じる
                </button>
            `;
        }
        
        // リトライボタン（autoRetry の場合）
        if (errorInfo.options.autoRetry) {
            buttons += `
                <button class="error-btn error-btn-retry" 
                        style="background: ${this.theme.warning}; border: none; color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">
                    🔄 再試行
                </button>
            `;
        }
        
        // デバッグボタン
        buttons += `
            <button class="error-btn error-btn-debug" 
                    style="background: ${this.theme.info}; border: none; color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">
                🔍 詳細
            </button>
        `;
        
        // 報告ボタン
        if (errorInfo.severity === 'critical' || errorInfo.severity === 'error') {
            buttons += `
                <button class="error-btn error-btn-report" 
                        style="background: ${this.theme.error}; border: none; color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">
                    📝 報告
                </button>
            `;
        }
        
        buttons += '</div>';
        return buttons;
    }
    
    /**
     * エラー要素イベントリスナー
     */
    attachErrorEventListeners(errorDiv, errorInfo) {
        // 閉じるボタン
        const dismissBtn = errorDiv.querySelector('.error-btn-dismiss');
        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => {
                this.dismissError(errorInfo.id);
            });
        }
        
        // リトライボタン
        const retryBtn = errorDiv.querySelector('.error-btn-retry');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                this.retryOperation(errorInfo);
            });
        }
        
        // デバッグボタン
        const debugBtn = errorDiv.querySelector('.error-btn-debug');
        if (debugBtn) {
            debugBtn.addEventListener('click', () => {
                this.showDebugInfo(errorInfo);
            });
        }
        
        // 報告ボタン
        const reportBtn = errorDiv.querySelector('.error-btn-report');
        if (reportBtn) {
            reportBtn.addEventListener('click', () => {
                this.reportError(errorInfo);
            });
        }
    }
    
    /**
     * エラー要素配置
     */
    attachErrorElement(errorElement, errorInfo) {
        // 配置位置計算（既存エラーとの重複回避）
        const existingErrors = document.querySelectorAll('.futaba-error');
        const topOffset = 20 + (existingErrors.length * 10);
        
        errorElement.style.top = `${topOffset}px`;
        
        document.body.appendChild(errorElement);
    }
    
    /**
     * エラー要素自動削除スケジュール
     */
    scheduleErrorRemoval(errorElement, errorInfo) {
        if (errorInfo.options.timeout > 0 && !errorInfo.options.persistent) {
            setTimeout(() => {
                this.dismissError(errorInfo.id);
            }, errorInfo.options.timeout);
        }
    }
    
    /**
     * 全画面エラー表示
     */
    showFullScreenError(errorInfo) {
        const overlay = document.createElement('div');
        overlay.id = `fullscreen-error-${errorInfo.id}`;
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: ${this.theme.background};
            z-index: 99999;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: system-ui, sans-serif;
        `;
        
        overlay.innerHTML = `
            <div style="text-align: center; color: ${this.theme.error}; background: white; padding: 32px; border: 3px solid ${this.theme.border}; border-radius: 16px; box-shadow: 0 8px 24px ${this.theme.shadow}; max-width: 600px; margin: 20px;">
                <h2 style="margin: 0 0 16px 0;">🎨 ふたば☆ちゃんねる風お絵描きツール</h2>
                <p style="margin: 0 0 16px 0; color: ${this.theme.text};">致命的なエラーが発生しました。</p>
                
                <div style="background: #ffffee; padding: 16px; border-radius: 8px; margin: 16px 0; text-align: left;">
                    <div style="font-weight: 600; margin-bottom: 8px;">💀 エラー詳細:</div>
                    <div style="font-family: monospace; font-size: 12px; color: ${this.theme.text};">
                        ${this.escapeHtml(errorInfo.message)}
                    </div>
                    ${errorInfo.context !== 'unknown' ? `
                        <div style="margin-top: 8px;">
                            <strong>発生場所:</strong> ${this.escapeHtml(errorInfo.context)}
                        </div>
                    ` : ''}
                </div>
                
                <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                    <button onclick="location.reload()" 
                            style="background: ${this.theme.error}; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                        🔄 再読み込み
                    </button>
                    <button onclick="console.clear(); console.log('🔍 エラー情報:', ${JSON.stringify(errorInfo)}); alert('コンソールを確認してください');" 
                            style="background: ${this.theme.warning}; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                        🔍 デバッグ
                    </button>
                </div>
                
                <div style="margin-top: 16px; font-size: 11px; opacity: 0.7; color: ${this.theme.text};">
                    Version: ${this.version} | Time: ${new Date(errorInfo.timestamp).toLocaleString()}
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
    }
    
    // ===========================================
    // 🔧 エラー管理・操作
    // ===========================================
    
    /**
     * エラー削除
     */
    dismissError(errorId) {
        const errorElement = this.errorElements.get(errorId);
        if (errorElement && errorElement.parentNode) {
            errorElement.style.animation = 'futabaSlideIn 0.3s ease-in reverse';
            setTimeout(() => {
                errorElement.remove();
                this.errorElements.delete(errorId);
            }, 300);
        }
    }
    
    /**
     * 全エラー削除
     */
    dismissAllErrors() {
        this.errorElements.forEach((element, id) => {
            this.dismissError(id);
        });
    }
    
    /**
     * 操作リトライ
     */
    retryOperation(errorInfo) {
        console.log(`🔄 操作リトライ: ${errorInfo.context}`);
        
        // リトライ可能な操作の場合
        if (errorInfo.options.retryCallback && typeof errorInfo.options.retryCallback === 'function') {
            try {
                errorInfo.options.retryCallback();
                this.dismissError(errorInfo.id);
            } catch (retryError) {
                this.handleError(retryError, 'runtime', `リトライ失敗: ${errorInfo.context}`);
            }
        }
    }
    
    /**
     * デバッグ情報表示
     */
    showDebugInfo(errorInfo) {
        console.group(`🔍 エラー詳細: ${errorInfo.id}`);
        console.log('エラー情報:', errorInfo);
        console.log('現在のエラーログ:', this.errorLog.slice(-5));
        console.log('アプリケーション状態:', window.getAppState?.() || 'N/A');
        console.groupEnd();
        
        alert('デバッグ情報をコンソールに出力しました（F12キーでコンソールを確認）');
    }
    
    /**
     * エラー報告
     */
    reportError(errorInfo) {
        const reportData = {
            error: errorInfo,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            appState: window.getAppState?.() || null
        };
        
        console.log('📝 エラー報告データ:', reportData);
        
        // 実際の報告機能（将来実装）
        alert('エラー報告機能は将来実装予定です。現在はコンソールに情報を出力しました。');
    }
    
    // ===========================================
    // 🔧 自動復旧・診断システム
    // ===========================================
    
    /**
     * 自動復旧試行
     */
    attemptAutoRecovery(errorInfo) {
        const recoveryStrategies = {
            'dependency': () => this.recoverDependencies(errorInfo),
            'initialization': () => this.recoverInitialization(errorInfo),
            'memory': () => this.recoverMemory(errorInfo),
            'ui': () => this.recoverUI(errorInfo)
        };
        
        const strategy = recoveryStrategies[errorInfo.type];
        if (strategy) {
            setTimeout(() => {
                try {
                    strategy();
                } catch (recoveryError) {
                    console.warn('⚠️ 自動復旧失敗:', recoveryError);
                }
            }, 1000);
        }
    }
    
    /**
     * 依存関係復旧
     */
    recoverDependencies(errorInfo) {
        console.log('🛡️ 依存関係自動復旧試行...');
        
        // 依存関係再チェック・再初期化
        if (window.APP_INIT_MONITOR) {
            window.APP_INIT_MONITOR.checkAllDependencies();
        }
    }
    
    /**
     * 初期化復旧
     */
    recoverInitialization(errorInfo) {
        console.log('🛡️ 初期化自動復旧試行...');
        
        // 軽量な再初期化試行
        if (window.futabaDrawingTool && window.futabaDrawingTool.attemptFallbackInitialization) {
            window.futabaDrawingTool.attemptFallbackInitialization(new Error(errorInfo.message));
        }
    }
    
    /**
     * メモリ復旧
     */
    recoverMemory(errorInfo) {
        console.log('🛡️ メモリ自動復旧試行...');
        
        // ガベージコレクション強制実行
        if (window.gc) {
            window.gc();
        }
        
        // 不要なエラーログクリア
        if (this.errorLog.length > 100) {
            this.errorLog = this.errorLog.slice(-50);
        }
    }
    
    /**
     * UI復旧
     */
    recoverUI(errorInfo) {
        console.log('🛡️ UI自動復旧試行...');
        
        // ポップアップリセット
        document.querySelectorAll('.popup-panel').forEach(popup => {
            popup.classList.remove('show');
        });
        
        // エラー要素クリーンアップ
        const oldErrors = document.querySelectorAll('.futaba-error');
        if (oldErrors.length > 5) {
            Array.from(oldErrors).slice(0, -3).forEach(el => el.remove());
        }
    }
    
    /**
     * 診断推奨事項取得
     */
    getDiagnosisRecommendations(errorInfo) {
        const recommendations = [];
        
        // エラータイプ別推奨事項
        const typeRecommendations = {
            'dependency': [
                'ブラウザのコンソール（F12）でネットワークエラーを確認',
                'ページの再読み込みを試行',
                'CDNの接続状況を確認'
            ],
            'initialization': [
                'js/app-core.js の読み込み状況を確認',
                'スクリプトの読み込み順序を確認',
                'ブラウザの開発者ツールでエラーを詳細確認'
            ],
            'api': [
                'API呼び出しパラメータを確認',
                '必要な初期化が完了しているか確認'
            ],
            'validation': [
                '入力値の形式・範囲を確認',
                '必須項目が入力されているか確認'
            ]
        };
        
        // エラーメッセージ別推奨事項
        const messageRecommendations = {
            'AppCore': [
                'AppCore クラスの読み込みを確認',
                'js/app-core.js ファイルの存在を確認'
            ],
            'PIXI': [
                'PixiJS ライブラリの読み込みを確認',
                'CDN接続またはnode_modules確認'
            ],
            'undefined': [
                '変数や関数の定義を確認',
                'スクリプトの読み込み順序を確認'
            ]
        };
        
        // タイプ別推奨事項追加
        if (typeRecommendations[errorInfo.type]) {
            recommendations.push(...typeRecommendations[errorInfo.type]);
        }
        
        // メッセージ別推奨事項追加
        Object.keys(messageRecommendations).forEach(keyword => {
            if (errorInfo.message.includes(keyword)) {
                recommendations.push(...messageRecommendations[keyword]);
            }
        });
        
        // 一般的な推奨事項
        if (recommendations.length === 0) {
            recommendations.push(
                'ブラウザコンソールで詳細エラーを確認',
                'ページの再読み込みを試行'
            );
        }
        
        return [...new Set(recommendations)]; // 重複除去
    }
    
    // ===========================================
    // 🔧 ユーティリティ・ヘルパー関数群
    // ===========================================
    
    /**
     * エラータイプ検証
     */
    validateErrorType(type) {
        return Object.values(this.errorTypes).includes(type) ? type : 'runtime';
    }
    
    /**
     * 重要度表示名取得
     */
    getSeverityDisplayName(severity) {
        const displayNames = {
            'info': '情報',
            'warning': '警告',
            'error': 'エラー',
            'critical': '致命的エラー'
        };
        return displayNames[severity] || 'エラー';
    }
    
    /**
     * HTMLエスケープ（XSS対策）
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
    
    /**
     * エラーID生成
     */
    generateErrorId() {
        return 'err_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * フォールバックエラー表示（ErrorManager自体でエラーの場合）
     */
    fallbackErrorDisplay(originalError, handlingError) {
        const div = document.createElement('div');
        div.style.cssText = `
            position: fixed; top: 10px; right: 10px; background: #800000; color: white;
            padding: 12px; border-radius: 4px; z-index: 99999; font-family: monospace;
            font-size: 12px; max-width: 300px;
        `;
        
        div.innerHTML = `
            <div>💀 ErrorManager Error</div>
            <div style="font-size: 10px; margin-top: 4px;">
                Original: ${String(originalError).substring(0, 50)}<br>
                Handling: ${String(handlingError).substring(0, 50)}
            </div>
            <button onclick="this.parentNode.remove()" 
                    style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 4px 8px; margin-top: 8px; cursor: pointer;">
                Close
            </button>
        `;
        
        document.body.appendChild(div);
        
        // 自動削除
        setTimeout(() => div.remove(), 10000);
    }
    
    // ===========================================
    // 🔧 グローバルエラーハンドラ設定
    // ===========================================
    
    /**
     * グローバルエラーハンドラ設定
     */
    setupGlobalErrorHandler() {
        // JavaScript エラー
        window.addEventListener('error', (event) => {
            this.handleError(
                event.error || new Error(event.message),
                'runtime',
                `${event.filename}:${event.lineno}:${event.colno}`
            );
        });
        
        // Promise rejection エラー
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError(
                event.reason,
                'runtime',
                'Unhandled Promise Rejection'
            );
        });
        
        console.log('✅ グローバルエラーハンドラ設定完了');
    }
    
    /**
     * エラースタイル設定
     */
    setupErrorStyles() {
        if (!document.getElementById('futaba-error-styles')) {
            const style = document.createElement('style');
            style.id = 'futaba-error-styles';
            style.textContent = `
                @keyframes futabaSlideIn {
                    from { 
                        transform: translateX(100%); 
                        opacity: 0; 
                    }
                    to { 
                        transform: translateX(0); 
                        opacity: 1; 
                    }
                }
                
                .futaba-error {
                    transition: all 0.3s ease;
                }
                
                .futaba-error:hover {
                    transform: scale(1.02);
                }
                
                .futaba-error .error-btn {
                    transition: all 0.2s ease;
                }
                
                .futaba-error .error-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    /**
     * 復旧システム設定
     */
    setupRecoverySystem() {
        // 定期的なヘルスチェック
        setInterval(() => {
            this.performHealthCheck();
        }, 30000); // 30秒間隔
        
        console.log('✅ 復旧システム設定完了');
    }
    
    /**
     * パフォーマンス監視設定
     */
    setupPerformanceMonitoring() {
        // メモリ使用量監視
        if (performance.memory) {
            setInterval(() => {
                const memoryUsage = performance.memory.usedJSHeapSize / 1024 / 1024;
                const memoryLimit = performance.memory.jsHeapSizeLimit / 1024 / 1024;
                
                if (memoryUsage > memoryLimit * 0.8) {
                    this.handleError(
                        new Error(`メモリ使用量が80%を超過: ${memoryUsage.toFixed(1)}MB / ${memoryLimit.toFixed(1)}MB`),
                        'memory',
                        'Memory Monitor',
                        { severity: 'warning' }
                    );
                }
            }, 60000); // 1分間隔
        }
        
        console.log('✅ パフォーマンス監視設定完了');
    }
    
    /**
     * ヘルスチェック実行
     */
    performHealthCheck() {
        const issues = [];
        
        // DOM要素チェック
        const requiredElements = ['drawing-canvas', 'pen-tool'];
        requiredElements.forEach(id => {
            if (!document.getElementById(id)) {
                issues.push(`必要なDOM要素が見つかりません: ${id}`);
            }
        });
        
        // グローバル変数チェック
        if (!window.PIXI) issues.push('PIXI が未定義です');
        if (!window.futabaDrawingTool) issues.push('futabaDrawingTool が未定義です');
        
        // エラー蓄積チェック
        if (this.errorLog.length > 50) {
            issues.push(`エラーログが蓄積されています: ${this.errorLog.length}件`);
        }
        
        // 問題がある場合の対処
        if (issues.length > 0) {
            console.warn('⚠️ ヘルスチェックで問題検出:', issues);
            
            // 自動復旧試行
            if (issues.length >= 3) {
                this.handleError(
                    new Error('複数のヘルスチェック項目で問題が検出されました'),
                    'runtime',
                    'Health Check',
                    { severity: 'warning', autoRetry: true }
                );
            }
        }
    }
    
    // ===========================================
    // 🔧 エラーリスナー・イベント管理
    // ===========================================
    
    /**
     * エラーリスナー登録
     */
    onError(type, callback) {
        if (!this.errorListeners.has(type)) {
            this.errorListeners.set(type, []);
        }
        
        this.errorListeners.get(type).push(callback);
        console.log(`✅ エラーリスナー登録: ${type}`);
    }
    
    /**
     * エラー通知送信
     */
    notifyErrorListeners(errorInfo) {
        // 特定タイプのリスナー
        if (this.errorListeners.has(errorInfo.type)) {
            this.errorListeners.get(errorInfo.type).forEach(callback => {
                try {
                    callback(errorInfo);
                } catch (error) {
                    console.error('エラーリスナーでエラー:', error);
                }
            });
        }
        
        // 全体リスナー
        if (this.errorListeners.has('*')) {
            this.errorListeners.get('*').forEach(callback => {
                try {
                    callback(errorInfo);
                } catch (error) {
                    console.error('全体エラーリスナーでエラー:', error);
                }
            });
        }
    }
    
    // ===========================================
    // 🔧 ログ出力関数群（DRY原則適用）
    // ===========================================
    
    logError(message, data = null) {
        console.error(message, data || '');
    }
    
    logWarning(message, data = null) {
        console.warn(message, data || '');
    }
    
    logInfo(message, data = null) {
        console.log(message, data || '');
    }
    
    // ===========================================
    // 📊 エラー統計・デバッグ情報
    // ===========================================
    
    /**
     * エラー統計取得
     */
    getErrorStats() {
        const stats = {
            total: this.errorLog.length,
            byType: {},
            bySeverity: {},
            recent: this.errorLog.slice(-10),
            oldestTimestamp: this.errorLog.length > 0 ? this.errorLog[0].timestamp : null,
            newestTimestamp: this.errorLog.length > 0 ? this.errorLog[this.errorLog.length - 1].timestamp : null
        };
        
        // タイプ別統計
        this.errorLog.forEach(error => {
            stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
            stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
        });
        
        return stats;
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            version: this.version,
            initialized: this.initialized,
            errorStats: this.getErrorStats(),
            activeErrors: this.errorElements.size,
            listeners: Array.from(this.errorListeners.keys()),
            theme: this.theme,
            errorTypes: this.errorTypes,
            severityLevels: Object.keys(this.severityLevels)
        };
    }
    
    /**
     * エラーログエクスポート
     */
    exportErrorLog() {
        return {
            version: this.version,
            exportTime: new Date().toISOString(),
            errors: this.errorLog,
            stats: this.getErrorStats(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };
    }
    
    /**
     * エラーログクリア
     */
    clearErrorLog() {
        const count = this.errorLog.length;
        this.errorLog = [];
        this.dismissAllErrors();
        
        console.log(`✅ エラーログクリア完了: ${count}件削除`);
        return count;
    }
}

// グローバル公開
window.ErrorManager = ErrorManager;

// 使用例とテスト
console.log('📋 ErrorManager 使用例:');
console.log('  const errorManager = new ErrorManager();');
console.log('  errorManager.initialize();');
console.log('  errorManager.handleError(new Error("テストエラー"), "runtime", "テストコンテキスト")');
console.log('  errorManager.handleError("警告メッセージ", "validation", "", { severity: "warning" })');
console.log('  errorManager.onError("api", (errorInfo) => { console.log("API エラー:", errorInfo); })');
console.log('  errorManager.getErrorStats()  // エラー統計取得');
console.log('🚨 ふたば☆お絵描きツール v1.5 - ErrorManager実装完了');