this.setupEventHandlers();
            this.createErrorDialogDOM();
            this.setupPerformanceMonitoring();
            
            // デバッグ設定確認
            this.debugEnabled = window.APP_CONFIG?.debug || false;
            
            // 🆕 Phase1: PixiJS互換性チェック実行
            this.checkPixiCompatibility();
            
            MainController.emit('system-debug', {
                category: 'init',
                message: 'ErrorService initialized with Phase1 compatibility checking',
                data: { 
                    debugEnabled: this.debugEnabled,
                    errorCodes: Object.keys(ERROR_CODES).length,
                    compatibilityResults: this.compatibilityResults
                },
                timestamp: Date.now()
            });
        }
        
        setupEventHandlers() {
            MainController.on('system-error', (payload) => this.handleSystemError(payload));
            MainController.on('system-debug', (payload) => this.handleSystemDebug(payload));
            MainController.on('erase-applied', (payload) => this.handleEraseApplied(payload)); // 🆕
            
            // グローバルエラーキャッチ
            window.addEventListener('error', (event) => {
                this.reportError('SYS_001', {
                    message: event.message,
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno
                }, event.error?.stack);
            });
            
            // Promise拒否キャッチ
            window.addEventListener('unhandledrejection', (event) => {
                this.reportError('SYS_001', {
                    message: 'Unhandled Promise Rejection',
                    reason: event.reason?.toString()
                }, event.reason?.stack);
            });
        }
        
        // 🆕 PixiJS互換性チェック（Phase1の核心機能）
        checkPixiCompatibility() {
            const results = {
                pixi: this.checkPixiLoaded(),
                eraseSupport: this.checkEraseSupport(),
                renderTextureSupport: this.checkRenderTextureSupport(),
                lastCheck: Date.now()
            };
            
            this.compatibilityResults = results;
            
            // 重大な互換性問題がある場合は即座にエラー表示
            const criticalIssues = [];
            
            if (!results.pixi.success) {
                criticalIssues.push('PixiJS not loaded');
                this.reportError('LIB_001', results.pixi.details);
            }
            
            if (!results.renderTextureSupport.success) {
                criticalIssues.push('RenderTexture not supported');
                this.reportError('LIB_007', results.renderTextureSupport.details);
            }
            
            if (!results.eraseSupport.success) {
                criticalIssues.push('ERASE blend mode not supported');
                this.reportError('LIB_006', results.eraseSupport.details);
                
                // 🚨 ERASE未対応の場合は専用エラーダイアログ表示
                this.showEraseCompatibilityError(results.eraseSupport.details);
            }
            
            MainController.emit('compatibility-checked', {
                results: results,
                criticalIssues: criticalIssues,
                timestamp: Date.now()
            });
            
            return results;
        }
        
        // 🆕 PixiJS読み込み確認
        checkPixiLoaded() {
            if (!window.PIXI) {
                return {
                    success: false,
                    details: {
                        message: 'PixiJS library not loaded',
                        suggestion: 'Check CDN link in HTML'
                    }
                };
            }
            
            return {
                success: true,
                details: {
                    version: PIXI.VERSION || 'unknown',
                    timestamp: Date.now()
                }
            };
        }
        
        // 🆕 ERASE blend mode対応確認
        checkEraseSupport() {
            if (!window.PIXI) {
                return {
                    success: false,
                    details: {
                        message: 'PixiJS not available for ERASE check',
                        suggestion: 'Load PixiJS first'
                    }
                };
            }
            
            if (!PIXI.BLEND_MODES || PIXI.BLEND_MODES.ERASE === undefined) {
                return {
                    success: false,
                    details: {
                        message: 'PIXI.BLEND_MODES.ERASE not available',
                        currentVersion: PIXI.VERSION || 'unknown',
                        requiredVersion: 'v8.13.0+',
                        suggestion: 'Update PixiJS to v8.13.0 or later',
                        impact: '消しゴムが透明化ではなく背景色で塗る動作になります'
                    }
                };
            }
            
            // ERASE定数値確認
            const eraseValue = PIXI.BLEND_MODES.ERASE;
            
            return {
                success: true,
                details: {
                    eraseBlendMode: eraseValue,
                    pixiVersion: PIXI.VERSION || 'unknown',
                    timestamp: Date.now()
                }
            };
        }
        
        // 🆕 RenderTexture対応確認
        checkRenderTextureSupport() {
            if (!window.PIXI) {
                return {
                    success: false,
                    details: {
                        message: 'PixiJS not available for RenderTexture check'
                    }
                };
            }
            
            if (!PIXI.RenderTexture) {
                return {
                    success: false,
                    details: {
                        message: 'PIXI.RenderTexture not available',
                        suggestion: 'Check PixiJS version and build'
                    }
                };
            }
            
            // 実際にRenderTexture作成テスト
            try {
                const testRT = PIXI.RenderTexture.create({ 
                    width: 32, 
                    height: 32, 
                    alpha: true 
                });
                testRT.destroy(true);  // テスト用なので即座に破棄
                
                return {
                    success: true,
                    details: {
                        renderTextureSupported: true,
                        alphaSupported: true,
                        timestamp: Date.now()
                    }
                };
            } catch (error) {
                return {
                    success: false,
                    details: {
                        message: 'RenderTexture creation failed',
                        error: error.message,
                        suggestion: 'Check WebGL support and PixiJS configuration'
                    }
                };
            }
        }
        
        // 🆕 ERASE互換性専用エラーダイアログ
        showEraseCompatibilityError(details) {
            const errorInfo = {
                title: 'エラーコード: LIB_006 - 消しゴム機能制限',
                message: `現在のPixiJSバージョンでは消しゴムの透明化機能が利用できません。`,
                details: details,
                timestamp: new Date().toLocaleString(),
                suggestions: [
                    'PixiJS を v8.13.0 以降に更新してください',
                    'CDNリンクを以下に変更: https://cdn.jsdelivr.net/npm/pixi.js@8.13.0/dist/pixi.min.js',
                    'ブラウザキャッシュをクリアしてページを再読み込みしてください',
                    '更新後も問題が続く場合はブラウザのコンソールログを確認してください'
                ]
            };
            
            this.showErrorDialog(errorInfo);
        }
        
        createErrorDialogDOM() {
            if (document.getElementById('error-dialog')) return;
            
            const dialog = document.createElement('div');
            dialog.id = 'error-dialog';
            dialog.className = 'error-dialog';
            dialog.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: var(--futaba-cream, #f0e0d6);
                border: 3px solid var(--futaba-maroon, #800000);
                border-radius: 16px;
                box-shadow: 0 12px 32px rgba(128, 0, 0, 0.4);
                padding: 24px;
                z-index: 9999;
                min-width: 320px;
                max-width: 80vw;
                max-height: 80vh;
                overflow-y: auto;
                display: none;
            `;
            
            dialog.innerHTML = `
                <div style="display: flex; align-items: center; margin-bottom: 16px;">
                    <div style="font-size: 24px; margin-right: 8px;">⚠️</div>
                    <h3 style="margin: 0; color: var(--futaba-maroon, #800000);">エラーが発生しました</h3>
                </div>
                <div id="error-dialog-content" style="margin-bottom: 20px; font-size: 14px; line-height: 1.5;"></div>
                <div id="error-dialog-details" style="background: var(--futaba-background, #ffffee); padding: 12px; border-radius: 8px; font-family: monospace; font-size: 12px; margin-bottom: 16px; display: none;"></div>
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button id="error-dialog-details-btn" style="padding: 8px 16px; border: 2px solid var(--futaba-maroon, #800000); border-radius: 6px; background: transparent; color: var(--futaba-maroon, #800000); cursor: pointer;">詳細</button>
                    <button id="error-dialog-close" style="padding: 8px 16px; border: 2px solid var(--futaba-maroon, #800000); border-radius: 6px; background: var(--futaba-maroon, #800000); color: white; cursor: pointer;">閉じる</button>
                </div>
            `;
            
            document.body.appendChild(dialog);
            
            // イベントリスナー設定
            document.getElementById('error-dialog-close').addEventListener('click', () => this.hideErrorDialog());
            document.getElementById('error-dialog-details-btn').addEventListener('click', () => this.toggleErrorDetails());
        }
        
        setupPerformanceMonitoring() {
            if ('PerformanceObserver' in window) {
                this.performanceObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach(entry => {
                        this.trackPerformance(entry.name, entry.duration);
                    });
                });
                
                try {
                    this.performanceObserver.observe({ entryTypes: ['measure', 'navigation'] });
                } catch (e) {
                    this.logDebug('performance', 'PerformanceObserver setup failed', { error: e.message });
                }
            }
        }
        
        // === エラー処理メソッド ===
        
        reportError(code, details, stack) {
            const timestamp = Date.now();
            const errorId = `error_${timestamp}_${Math.random().toString(36).substr(2, 6)}`;
            
            const errorReport = {
                id: errorId,
                code: code,
                details: details || {},
                stack: stack || new Error().stack,
                timestamp: timestamp,
                userAgent: navigator.userAgent,
                url: window.location.href,
                resolved: false
            };
            
            // 履歴に追加
            this.errorHistory.push(errorReport);
            if (this.errorHistory.length > this.maxHistorySize) {
                this.errorHistory.shift();
            }
            
            // 統計更新
            const count = this.errorStatistics.get(code) || 0;
            this.errorStatistics.set(code, count + 1);
            
            // コンソール出力
            console.error(`[${code}] ${errorId}:`, details);
            if (stack) console.error('Stack:', stack);
            
            // 重大エラーの場合はダイアログ表示
            if (this.isCriticalError(code)) {
                this.showErrorDialog(this.formatErrorMessage(errorReport));
            }
            
            // MainControllerに通知
            MainController.emit('error-reported', {
                errorId,
                code,
                critical: this.isCriticalError(code)
            });
            
            return errorId;
        }
        
        isCriticalError(code) {
            const criticalCodes = [
                'LIB_001', 'LIB_002', 'LIB_006', 'LIB_007', // 🆕 ERASE, RenderTexture追加
                'SYS_001', 'SYS_002',
                'UI_001', 'LAYER_001', 'COORD_001',
                'RT_001', 'RT_002'  // 🆕 RenderTexture関連
            ];
            return criticalCodes.includes(code);
        }
        
        formatErrorMessage(errorReport) {
            const codeDescriptions = {
                'LIB_001': 'PixiJS ライブラリが読み込まれていません',
                'LIB_002': 'HammerJS ライブラリが読み込まれていません',
                'LIB_003': 'Lodash ライブラリが読み込まれていません',
                'LIB_006': '消しゴムの透明化機能が利用できません (ERASE blend mode未対応)',  // 🆕
                'LIB_007': 'RenderTexture機能が利用できません',  // 🆕
                'SYS_001': 'システムの初期化に失敗しました',
                'SYS_002': 'イベントハンドラーでエラーが発生しました',
                'UI_001': '必要なDOM要素が見つかりません',
                'LAYER_001': 'レイヤーが見つかりません',
                'COORD_001': '座標変換でエラーが発生しました',
                'RT_001': 'RenderTextureの作成に失敗しました',      // 🆕
                'RT_002': 'RenderTextureへの描画に失敗しました'     // 🆕
            };
            
            const description = codeDescriptions[errorReport.code] || '不明なエラーが発生しました';
            
            return {
                title: `エラーコード: ${errorReport.code}`,
                message: description,
                details: errorReport.details,
                stack: errorReport.stack,
                timestamp: new Date(errorReport.timestamp).toLocaleString(),
                suggestions: this.getErrorSuggestions(errorReport.code)
            };
        }
        
        getErrorSuggestions(code) {
            const suggestions = {
                'LIB_001': ['PixiJSのCDNリンクを確認してください', 'ブラウザのキャッシュをクリアしてみてください'],
                'LIB_002': ['HammerJSのCDNリンクを確認してください', 'タッチ操作が無効になる可能性があります'],
                'LIB_003': ['Lodashライブラリが読み込まれていません', 'パフォーマンス最適化が無効になります'],
                'LIB_006': [  // 🆕 ERASE対応
                    'PixiJS を v8.13.0以降に更新してください',
                    'CDNリンクを更新: https://cdn.jsdelivr.net/npm/pixi.js@8.13.0/dist/pixi.min.js',
                    'ブラウザキャッシュクリア後にページを再読み込みしてください',
                    '更新後、消しゴムで真の透明化が可能になります'
                ],
                'LIB_007': [  // 🆕 RenderTexture対応
                    'PixiJSのバージョンを確認してください',
                    'WebGL対応ブラウザを使用してください',
                    'ハードウェアアクセラレーションが有効か確認してください'
                ],
                'SYS_001': ['ページを再読み込みしてください', 'ブラウザのデベロッパーツールでコンソールを確認してください'],
                'UI_001': ['HTMLの構造が正しいか確認してください', '必要なDOM要素のIDが存在するか確認してください'],
                'RT_001': [  // 🆕 RenderTexture作成失敗
                    'WebGL対応を確認してください',
                    'メモリ不足の可能性があります',
                    'ブラウザを再起動してみてください'
                ],
                'RT_002': [  // 🆕 RenderTexture描画失敗
                    '描画内容が複雑すぎる可能性があります',
                    'キャンバスサイズを小さくしてみてください',
                    'メモリ使用量を確認してください'
                ]
            };
            
            return suggestions[code] || ['ページを再読み込みしてみてください'];
        }
        
        showErrorDialog(errorInfo) {
            const dialog = document.getElementById('error-dialog');
            const content = document.getElementById('error-dialog-content');
            const details = document.getElementById('error-dialog-details');
            
            if (!dialog || !content) return;
            
            // コンテンツ設定
            content.innerHTML = `
                <div style="margin-bottom: 12px;">
                    <strong>${errorInfo.title}</strong>
                </div>
                <div style="margin-bottom: 16px;">
                    ${errorInfo.message}
                </div>
                ${errorInfo.suggestions ? `
                    <div style="margin-bottom: 12px;">
                        <strong>対処法:</strong>
                        <ul style="margin: 8px 0; padding-left: 20px;">
                            ${errorInfo.suggestions.map(s => `<li>${s}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                <div style="font-size: 12px; color: var(--text-secondary, #5d4037);">
                    発生時刻: ${errorInfo.timestamp}
                </div>
            `;
            
            // 詳細情報設定
            if (details) {
                details.innerHTML = `
                    <div><strong>詳細情報:</strong></div>
                    <div style="margin: 8px 0;">${JSON.stringify(errorInfo.details, null, 2)}</div>
                    ${errorInfo.stack ? `
                        <div style="margin-top: 12px;"><strong>スタックトレース:</strong></div>
                        <pre style="white-space: pre-wrap; margin: 8px 0; font-size: 10px;">${errorInfo.stack}</pre>
                    ` : ''}
                `;
            }
            
            dialog.style.display = 'block';
            this.isDialogVisible = true;
            
            MainController.emit('error-dialog-shown', { 
                errorCode: errorInfo.title,
                timestamp: Date.now()
            });
        }
        
        hideErrorDialog() {
            const dialog = document.getElementById('error-dialog');
            if (dialog) {
                dialog.style.display = 'none';
                this.isDialogVisible = false;
            }
        }
        
        toggleErrorDetails() {
            const details = document.getElementById('error-dialog-details');
            const button = document.getElementById('error-dialog-details-btn');
            
            if (details && button) {
                const isVisible = details.style.display !== 'none';
                details.style.display = isVisible ? 'none' : 'block';
                button.textContent = isVisible ? '詳細' : '詳細を隠す';
            }
        }
        
        // === デバッグログ管理 ===
        
        logDebug(category, message, data = {}) {
            if (!this.debugEnabled && !this.verboseLogging) return;
            
            const timestamp = Date.now();
            const logEntry = {
                id: `debug_${timestamp}_${Math.random().toString(36).substr(2, 6)}`,
                category: category,
                message: message,
                data: data,
                timestamp: timestamp,
                level: this.getLogLevel(category)
            };
            
            // 履歴に追加
            this.debugLogs.push(logEntry);
            if (this.debugLogs.length > this.maxDebugLogs) {
                this.debugLogs.shift();
            }
            
            // コンソール出力
            const logMethod = logEntry.level === 'warn' ? console.warn : 
                             logEntry.level === 'error' ? console.error : console.log;
            
            logMethod(`[DEBUG:${category.toUpperCase()}] ${message}`, data);
            
            return logEntry.id;
        }
        
        getLogLevel(category) {
            const levels = {
                'error': 'error',
                'warning': 'warn',
                'performance': 'warn',
                'compatibility': 'warn',  // 🆕
                'init': 'log',
                'event': 'log',
                'ui': 'log',
                'drawing': 'log'  // 🆕
            };
            
            return levels[category] || 'log';
        }
        
        getDebugLogs(category = null, limit = 50) {
            let logs = this.debugLogs;
            
            if (category) {
                logs = logs.filter(log => log.category === category);
            }
            
            return logs.slice(-limit);
        }
        
        clearDebugLogs(category = null) {
            if (category) {
                this.debugLogs = this.debugLogs.filter(log => log.category !== category);
            } else {
                this.debugLogs = [];
            }
        }
        
        // === パフォーマンス監視 ===
        
        trackPerformance(category, duration) {
            if (!this.performanceMetrics.has(category)) {
                this.performanceMetrics.set(category, {
                    count: 0,
                    totalDuration: 0,
                    minDuration: Infinity,
                    maxDuration: -Infinity,
                    avgDuration: 0
                });
            }
            
            const metrics = this.performanceMetrics.get(category);
            metrics.count++;
            metrics.totalDuration += duration;
            metrics.minDuration = Math.min(metrics.minDuration, duration);
            metrics.maxDuration = Math.max(metrics.maxDuration, duration);
            metrics.avgDuration = metrics.totalDuration / metrics.count;
            
            // パフォーマンス劣化検知
            if (metrics.avgDuration > 100 && metrics.count > 10) {
                this.logDebug('performance', `Performance degradation detected in ${category}`, {
                    avgDuration: metrics.avgDuration,
                    maxDuration: metrics.maxDuration,
                    count: metrics.count
                });
            }
            
            MainController.emit('performance-update', {
                category,
                metrics: { ...metrics },
                timestamp: Date.now()
            });
        }
        
        getPerformanceReport() {
            const report = {};
            this.performanceMetrics.forEach((metrics, category) => {
                report[category] = { ...metrics };
            });
            return report;
        }
        
        startPerformanceMeasure(name) {
            performance.mark(`${name}-start`);
            return name;
        }
        
        endPerformanceMeasure(name) {
            try {
                performance.mark(`${name}-end`);
                performance.measure(name, `${name}-start`, `${name}-end`);
                
                const measure = performance.getEntriesByName(name, 'measure')[0];
                if (measure) {
                    this.trackPerformance(name, measure.duration);
                }
                
                // クリーンアップ
                performance.clearMarks(`${name}-start`);
                performance.clearMarks(`${name}-end`);
                performance.clearMeasures(name);
                
                return measure?.duration || 0;
            } catch (e) {
                this.logDebug('performance', `Performance measure failed for ${name}`, { error: e.message });
                return 0;
            }
        }
        
        // === イベントペイロード検証 ===
        
        validateEventPayload(type, payload) {
            if (!window.EVENT_TYPES || !window.EVENT_TYPES[type]) {
                this.logDebug('validation', `Unknown event type: ${type}`, { payload });
                return false;
            }
            
            const expectedSchema = window.EVENT_TYPES[type];
            const issues = [];
            
            // 基本的な型チェック
            if (typeof payload !== 'object' || payload === null) {
                issues.push('Payload must be an object');
            } else {
                Object.entries(expectedSchema).forEach(([key, expectedType]) => {
                    const actualType = typeof payload[key];
                    if (actualType !== expectedType && payload[key] !== undefined) {
                        issues.push(`${key}: expected ${expectedType}, got ${actualType}`);
                    }
                });
            }
            
            if (issues.length > 0) {
                this.logDebug('validation', `Event payload validation failed for ${type}`, {
                    issues,
                    payload,
                    expectedSchema
                });
                return false;
            }
            
            return true;
        }
        
        // === 統計・レポート ===
        
        getErrorStatistics() {
            const stats = {
                totalErrors: this.errorHistory.length,
                errorsByCode: Object.fromEntries(this.errorStatistics),
                recentErrors: this.errorHistory.slice(-10),
                criticalErrors: this.errorHistory.filter(e => this.isCriticalError(e.code)).length,
                resolvedErrors: this.errorHistory.filter(e => e.resolved).length,
                errorRate: this.calculateErrorRate(),
                compatibilityStatus: this.compatibilityResults  // 🆕
            };
            
            return stats;
        }
        
        calculateErrorRate() {
            const now = Date.now();
            const oneHour = 60 * 60 * 1000;
            const recentErrors = this.errorHistory.filter(e => now - e.timestamp < oneHour);
            
            return {
                lastHour: recentErrors.length,
                avgPerHour: recentErrors.length // 簡易計算
            };
        }
        
        exportDiagnostics() {
            return {
                timestamp: Date.now(),
                userAgent: navigator.userAgent,
                url: window.location.href,
                errorStatistics: this.getErrorStatistics(),
                performanceMetrics: this.getPerformanceReport(),
                recentDebugLogs: this.getDebugLogs(null, 100),
                compatibilityResults: this.compatibilityResults,  // 🆕
                systemState: {
                    memoryUsage: performance.memory ? {
                        used: performance.memory.usedJSHeapSize,
                        total: performance.memory.totalJSHeapSize,
                        limit: performance.memory.jsHeapSizeLimit
                    } : null,
                    libraries: {
                        pixi: !!window.PIXI,
                        pixiVersion: window.PIXI?.VERSION || 'unknown',  // 🆕
                        hammer: !!window.Hammer,
                        lodash: !!window._,
                        gsap: !!window.gsap
                    }
                }
            };
        }
        
        // === イベントハンドラー ===
        
        handleSystemError(payload) {
            this.reportError(payload.code, payload.details, payload.stack);
        }
        
        handleSystemDebug(payload) {
            this.logDebug(payload.category, payload.message, payload.data);
        }
        
        // 🆕 透明化処理完了ハンドラー
        handleEraseApplied(payload) {
            this.logDebug('drawing', 'Eraser transparency applied successfully', {
                pathId: payload.pathId,
                layerId: payload.layerId,
                bounds: payload.bounds
            });
        }
        
        // === 公開メソッド ===
        
        enableVerboseLogging() {
            this.verboseLogging = true;
            this.logDebug('config', 'Verbose logging enabled');
        }
        
        disableVerboseLogging() {
            this.verboseLogging = false;
            this.logDebug('config', 'Verbose logging disabled');
        }
        
        resolveError(errorId) {
            const error = this.errorHistory.find(e => e.id === errorId);
            if (error) {
                error.resolved = true;
                error.resolvedAt = Date.now();
                this.logDebug('resolution', `Error resolved: ${errorId}`, { code: error.code });
                return true;
            }
            return false;
        }
        
        clearErrorHistory() {
            this.errorHistory = [];
            this.errorStatistics.clear();
            this.logDebug('cleanup', 'Error history cleared');
        }
        
        // 🆕 互換性の再チェック
        recheckCompatibility() {
            this.logDebug('compatibility', 'Rechecking PixiJS compatibility');
            return this.checkPixiCompatibility();
        }
    }
    
    // ErrorService初期化
    const errorService = new ErrorService();
    
    // グローバル参照設定
    window.ErrorService = errorService;
    
    // MainController準備完了待機
    const initWhenReady = () => {
        if (window.MainController && MainController.emit) {
            errorService.initialize();
        } else {
            setTimeout(initWhenReady, 10);
        }/**
 * 🛰️ error-service.js - ErrorService エラー処理・デバッグ支援衛星  
 * Version: 3.0.1-Phase1 | Last Modified: 2025-01-09
 * 
 * [🚨 Phase1修正 - 消しゴム透明化対応]
 * - PixiJS v8.13+ ERASE blend mode互換性チェック追加
 * - RenderTexture互換性チェック強化
 * - 透明化処理失敗時の詳細エラー報告
 * - フォールバック処理の完全禁止（明示的エラーで制御）
 * 
 * [🎯 責務範囲]
 * - エラー分類・レポート・ダイアログ表示
 * - デバッグログ管理・カテゴリ分類
 * - パフォーマンス監視・FPS計測
 * - PixiJS互換性チェック（ERASE blend mode対応）
 * - イベントペイロード検証
 * 
 * [🔧 主要メソッド]
 * reportError(code, details, stack)       - エラーレポート
 * logDebug(category, message, data)       - デバッグログ
 * showErrorDialog(message, actions)       - エラーダイアログ
 * hideErrorDialog()                       - ダイアログ非表示
 * checkPixiCompatibility() → issues       - 🆕 PixiJS互換性チェック
 * checkEraseSupport() → boolean           - 🆕 ERASE blend mode対応確認
 * trackPerformance(category, duration)    - パフォーマンス記録
 * validateEventPayload(type, payload)     - ペイロード検証
 * startFPSMonitor()                       - FPS監視開始
 * getErrorStatistics() → stats            - エラー統計取得
 * 
 * [📊 エラーコード分類]
 * COORD_001-099 : 座標系関連エラー
 * LAYER_001-099 : レイヤー管理エラー
 * TOOL_001-099  : ツール関連エラー
 * LIB_001-099   : ライブラリ関連エラー（🆕 ERASE対応確認含む）
 * UI_001-099    : UI操作エラー
 * SYS_001-099   : システム関連エラー
 * RT_001-099    : 🆕 RenderTexture関連エラー
 * 
 * [📡 処理イベント（IN）]
 * - system-error : エラー発生通知
 * - system-debug : デバッグログ要求
 * - system-performance : パフォーマンス計測
 * - erase-applied : 🆕 透明化処理完了
 * 
 * [📤 発火イベント（OUT）]
 * - error-reported : エラーレポート完了
 * - error-dialog-shown : ダイアログ表示
 * - performance-update : パフォーマンス更新
 * - compatibility-checked : 🆕 互換性チェック完了
 * 
 * [🔗 依存関係]
 * ← MainController (イベント・状態)
 * → PixiJS v8.13.0 (ERASE blend mode確認)
 * → DOM要素: .error-dialog, #fps-display
 * 
 * [⚠️ 禁止事項]  
 * - フォールバック処理・エラー隠蔽
 * - 問題先送り・機能代替実行
 * - 他衛星の機能代替実行
 * - 透明化失敗時の背景色塗り代替
 */

(function() {
    'use strict';
    
    // エラーコード定義（🆕 Phase1追加分含む）
    const ERROR_CODES = {
        // 座標系関連 (COORD_001-099)
        COORDINATE_INVALID: 'COORD_001',
        WORLD_BOUNDS_EXCEEDED: 'COORD_002',
        SCREEN_TO_WORLD_FAILED: 'COORD_003',
        
        // レイヤー関連 (LAYER_001-099)
        LAYER_NOT_FOUND: 'LAYER_001',
        LAYER_CREATE_FAILED: 'LAYER_002',
        LAYER_DELETE_FAILED: 'LAYER_003',
        LAYER_REORDER_FAILED: 'LAYER_004',
        
        // ツール関連 (TOOL_001-099)
        TOOL_INVALID: 'TOOL_001',
        BRUSH_SIZE_INVALID: 'TOOL_002',
        OPACITY_INVALID: 'TOOL_003',
        DRAWING_STATE_INVALID: 'TOOL_004',
        ERASER_TRANSPARENCY_FAILED: 'TOOL_005',  // 🆕
        
        // ライブラリ関連 (LIB_001-099)
        PIXI_NOT_LOADED: 'LIB_001',
        HAMMER_NOT_LOADED: 'LIB_002',
        LODASH_NOT_LOADED: 'LIB_003',
        GSAP_NOT_LOADED: 'LIB_004',
        LIBRARY_VERSION_MISMATCH: 'LIB_005',
        PIXI_ERASE_NOT_SUPPORTED: 'LIB_006',     // 🆕
        RENDER_TEXTURE_NOT_SUPPORTED: 'LIB_007', // 🆕
        
        // UI関連 (UI_001-099)
        DOM_ELEMENT_NOT_FOUND: 'UI_001',
        POPUP_SHOW_FAILED: 'UI_002',
        SLIDER_UPDATE_FAILED: 'UI_003',
        CANVAS_RESIZE_FAILED: 'UI_004',
        
        // システム関連 (SYS_001-099)
        INIT_FAILED: 'SYS_001',
        EVENT_HANDLER_FAILED: 'SYS_002',
        MEMORY_LIMIT_EXCEEDED: 'SYS_003',
        PERFORMANCE_DEGRADED: 'SYS_004',
        
        // 🆕 RenderTexture関連 (RT_001-099)
        RENDER_TEXTURE_CREATE_FAILED: 'RT_001',
        RENDER_TEXTURE_RENDER_FAILED: 'RT_002',
        RENDER_TEXTURE_CLEAR_FAILED: 'RT_003'
    };
    
    class ErrorService {
        constructor() {
            this.errorHistory = [];
            this.debugLogs = [];
            this.performanceMetrics = new Map();
            this.errorStatistics = new Map();
            this.maxHistorySize = 1000;
            this.maxDebugLogs = 500;
            this.isDialogVisible = false;
            
            // デバッグフラグ
            this.debugEnabled = false;
            this.verboseLogging = false;
            
            // パフォーマンス監視
            this.performanceObserver = null;
            this.lastFPSUpdate = performance.now();
            
            // 🆕 互換性チェック結果
            this.compatibilityResults = {
                pixi: null,
                eraseSupport: null,
                renderTextureSupport: null,
                lastCheck: null
            };
        }
        
        initialize() {
            this.setupEventHandlers();
            this.createErrorDialogDOM();
            this.setupPer