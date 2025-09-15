/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev12
 * システム診断専用モジュール - diagnostics.js (Phase2F)
 * 
 * 🔧 Phase2F新設: DRY・SOLID原則準拠
 * 1. ✅ main.js・ui-manager.jsから診断機能分離
 * 2. ✅ 単一責任原則準拠（診断・修復のみ）
 * 3. ✅ 問題検出・自動修復機能統合
 * 4. ✅ システム健全性監視
 * 5. ✅ utils.js統合・DRY原則準拠
 * 
 * 責務: システム診断・問題検出・自動修復・健全性監視
 * 依存: utils.js, config.js
 */

console.log('🔧 diagnostics.js Phase2F版読み込み開始...');

// ==== システム診断専用クラス ====
class DiagnosticsSystem {
    constructor() {
        this.diagnosticHistory = [];
        this.repairHistory = [];
        this.systemHealth = {
            overall: 'unknown',
            components: {},
            lastCheck: null,
            issues: []
        };
        
        // 診断設定
        this.autoRepairEnabled = true;
        this.maxRepairAttempts = 3;
        this.repairAttempts = new Map();
        
        // エラーループ防止
        this.errorLoopPrevention = {
            enabled: true,
            maxErrors: 10,
            resetInterval: 30000, // 30秒
            errorCounts: new Map(),
            lastReset: Date.now()
        };
        
        console.log('🏥 DiagnosticsSystem初期化（Phase2F版）');
    }
    
    /**
     * 🆕 Phase2F: CONFIG整合性検証（main.jsから移管・強化）
     */
    validateConfigIntegrity() {
        try {
            console.log('🔍 CONFIG整合性検証開始...');
            
            const issues = [];
            const startTime = performance.now();
            
            // 1. CONFIG存在確認
            if (!window.CONFIG || typeof window.CONFIG !== 'object') {
                issues.push({
                    type: 'missing',
                    message: 'CONFIGオブジェクトが存在しません',
                    severity: 'critical',
                    autoRepair: 'createMinimalConfig'
                });
            }
            
            // 2. 必須設定値確認
            const requiredConfig = this.getRequiredConfigKeys();
            for (const key of requiredConfig) {
                if (!this.checkConfigKey(key)) {
                    issues.push({
                        type: 'missing_key',
                        key: key,
                        message: `必須設定 ${key} が不正または未定義`,
                        severity: 'high',
                        autoRepair: 'setDefaultValue'
                    });
                }
            }
            
            // 3. Phase2設定値検証
            const phase2Issues = this.validatePhase2Settings();
            issues.push(...phase2Issues);
            
            // 4. 依存関係確認
            const dependencyIssues = this.checkConfigDependencies();
            issues.push(...dependencyIssues);
            
            // 診断結果記録
            const result = {
                timestamp: Date.now(),
                duration: performance.now() - startTime,
                issueCount: issues.length,
                issues: issues,
                severity: this.calculateSeverity(issues),
                integrity: issues.length === 0
            };
            
            this.diagnosticHistory.push(result);
            
            // 自動修復実行
            if (issues.length > 0 && this.autoRepairEnabled) {
                console.log(`🔧 ${issues.length}件の問題を検出 → 自動修復実行`);
                this.autoRepairConfig(issues);
            }
            
            console.log(`✅ CONFIG整合性検証完了: ${result.integrity ? '正常' : issues.length + '件の問題'}`, result);
            
            return result.integrity;
            
        } catch (error) {
            console.error('CONFIG整合性検証エラー:', error);
            this.recordError('validateConfigIntegrity', error);
            return false;
        }
    }
    
    /**
     * 必須CONFIG設定キー取得
     */
    getRequiredConfigKeys() {
        return [
            'DEFAULT_BRUSH_SIZE',
            'DEFAULT_OPACITY',
            'MAX_BRUSH_SIZE',
            'MIN_BRUSH_SIZE',
            'SIZE_PRESETS',
            'CANVAS_WIDTH',
            'CANVAS_HEIGHT',
            'PREVIEW_MIN_SIZE',
            'PREVIEW_MAX_SIZE'
        ];
    }
    
    /**
     * CONFIG設定キー確認
     */
    checkConfigKey(key) {
        try {
            const value = window.CONFIG?.[key];
            
            if (value === undefined || value === null) return false;
            
            // 特別な検証ルール
            switch (key) {
                case 'SIZE_PRESETS':
                    return Array.isArray(value) && value.length > 0;
                case 'DEFAULT_BRUSH_SIZE':
                case 'MAX_BRUSH_SIZE':
                case 'MIN_BRUSH_SIZE':
                    return typeof value === 'number' && value > 0;
                case 'DEFAULT_OPACITY':
                    return typeof value === 'number' && value >= 0 && value <= 1;
                case 'CANVAS_WIDTH':
                case 'CANVAS_HEIGHT':
                    return typeof value === 'number' && value >= 100;
                default:
                    return true;
            }
        } catch (error) {
            console.warn(`CONFIG設定キー確認エラー (${key}):`, error);
            return false;
        }
    }
    
    /**
     * Phase2設定値検証
     */
    validatePhase2Settings() {
        const issues = [];
        
        try {
            const safeGet = window.safeConfigGet || ((k, d) => window.CONFIG?.[k] ?? d);
            
            const phase2Checks = [
                {
                    key: 'DEFAULT_BRUSH_SIZE',
                    expected: 4,
                    current: safeGet('DEFAULT_BRUSH_SIZE', null)
                },
                {
                    key: 'DEFAULT_OPACITY',
                    expected: 1.0,
                    current: safeGet('DEFAULT_OPACITY', null)
                },
                {
                    key: 'MAX_BRUSH_SIZE',
                    expected: 500,
                    current: safeGet('MAX_BRUSH_SIZE', null)
                }
            ];
            
            for (const check of phase2Checks) {
                if (check.current !== check.expected) {
                    issues.push({
                        type: 'phase2_mismatch',
                        key: check.key,
                        message: `Phase2設定値不一致: ${check.key} = ${check.current} (期待値: ${check.expected})`,
                        severity: 'medium',
                        autoRepair: 'setPhase2Value',
                        expectedValue: check.expected,
                        currentValue: check.current
                    });
                }
            }
            
        } catch (error) {
            issues.push({
                type: 'phase2_error',
                message: `Phase2設定値検証エラー: ${error.message}`,
                severity: 'high',
                autoRepair: 'resetPhase2Settings'
            });
        }
        
        return issues;
    }
    
    /**
     * CONFIG依存関係確認
     */
    checkConfigDependencies() {
        const issues = [];
        
        try {
            // utils.js統合確認
            if (typeof safeConfigGet !== 'function') {
                issues.push({
                    type: 'dependency',
                    message: 'utils.js統合未完了（safeConfigGet関数未存在）',
                    severity: 'critical',
                    autoRepair: 'requireUtilsReload'
                });
            }
            
            // バリデーション関数確認
            const validators = ['validateBrushSize', 'validateOpacity'];
            for (const validator of validators) {
                if (typeof window[validator] !== 'function') {
                    issues.push({
                        type: 'validator_missing',
                        message: `バリデーション関数 ${validator} が未存在`,
                        severity: 'medium',
                        autoRepair: 'createFallbackValidator'
                    });
                }
            }
            
        } catch (error) {
            issues.push({
                type: 'dependency_error',
                message: `依存関係確認エラー: ${error.message}`,
                severity: 'high'
            });
        }
        
        return issues;
    }
    
    /**
     * 🆕 Phase2F: utils.js統合確認（main.jsから移管・強化）
     */
    checkUtilsIntegration() {
        try {
            console.log('🔍 utils.js統合確認開始...');
            
            const requiredUtils = [
                'safeConfigGet', 'validateConfigIntegrity', 'createApplicationError',
                'logError', 'measurePerformance', 'handleGracefulDegradation',
                'validateBrushSize', 'validateOpacity', 'throttle', 'debounce',
                'getSystemStats'
            ];
            
            const utilsStatus = {
                timestamp: Date.now(),
                requiredCount: requiredUtils.length,
                availableCount: 0,
                missingCount: 0,
                available: [],
                missing: [],
                integration: false
            };
            
            for (const util of requiredUtils) {
                if (typeof window[util] === 'function') {
                    utilsStatus.available.push(util);
                    utilsStatus.availableCount++;
                } else {
                    utilsStatus.missing.push(util);
                    utilsStatus.missingCount++;
                }
            }
            
            utilsStatus.integration = utilsStatus.missingCount === 0;
            
            // 診断履歴記録
            this.diagnosticHistory.push({
                type: 'utils_integration',
                result: utilsStatus
            });
            
            if (utilsStatus.missingCount > 0) {
                console.error('❌ utils.js統合不完全:', utilsStatus.missing);
                
                // 自動修復試行
                if (this.autoRepairEnabled) {
                    this.attemptUtilsRepair(utilsStatus.missing);
                }
                
                return false;
            } else {
                console.log('✅ utils.js統合確認完了:', `${utilsStatus.availableCount}/${utilsStatus.requiredCount}関数利用可能`);
                return true;
            }
            
        } catch (error) {
            console.error('utils.js統合確認エラー:', error);
            this.recordError('checkUtilsIntegration', error);
            return false;
        }
    }
    
    /**
     * 🆕 Phase2F: 依存関係チェック（main.jsから移管・強化）  
     */
    checkDependencies() {
        try {
            console.log('🔍 システム依存関係チェック開始...');
            
            const dependencies = {
                // PIXI.js（必須）
                pixi: {
                    required: true,
                    available: typeof PIXI !== 'undefined',
                    type: 'library'
                },
                
                // Core classes（必須）
                pixiDrawingApp: {
                    required: true,
                    available: typeof PixiDrawingApp !== 'undefined',
                    type: 'core'
                },
                drawingToolsSystem: {
                    required: true,
                    available: typeof DrawingToolsSystem !== 'undefined',
                    type: 'core'
                },
                historyManager: {
                    required: true,
                    available: typeof HistoryManager !== 'undefined',
                    type: 'core'
                },
                uiManager: {
                    required: true,
                    available: typeof UIManager !== 'undefined',
                    type: 'core'
                },
                
                // UI Components（必須）
                sliderController: {
                    required: true,
                    available: typeof SliderController !== 'undefined',
                    type: 'ui'
                },
                popupManager: {
                    required: true,
                    available: typeof PopupManager !== 'undefined',
                    type: 'ui'
                },
                
                // Settings（準必須）
                settingsManager: {
                    required: false,
                    available: typeof SettingsManager !== 'undefined',
                    type: 'optional'
                },
                
                // Phase2F新規（オプション）
                debugManager: {
                    required: false,
                    available: typeof DebugManager !== 'undefined',
                    type: 'phase2f'
                }
            };
            
            const result = {
                timestamp: Date.now(),
                totalCount: Object.keys(dependencies).length,
                availableCount: 0,
                missingRequired: [],
                missingOptional: [],
                allRequired: true
            };
            
            // 依存関係確認
            for (const [name, dep] of Object.entries(dependencies)) {
                if (dep.available) {
                    result.availableCount++;
                } else if (dep.required) {
                    result.missingRequired.push(name);
                    result.allRequired = false;
                } else {
                    result.missingOptional.push(name);
                }
            }
            
            // 結果出力
            console.log(`✅ 利用可能: ${result.availableCount}/${result.totalCount}個`);
            
            if (result.missingRequired.length > 0) {
                console.error('❌ 必須依存関係不足:', result.missingRequired);
            }
            
            if (result.missingOptional.length > 0) {
                console.warn('⚠️ オプション依存関係不足:', result.missingOptional);
            }
            
            // 診断履歴記録
            this.diagnosticHistory.push({
                type: 'dependencies',
                result: result
            });
            
            return result.allRequired;
            
        } catch (error) {
            console.error('依存関係チェックエラー:', error);
            this.recordError('checkDependencies', error);
            return false;
        }
    }
    
    /**
     * 🆕 Phase2F: 完全システム診断
     */
    runFullDiagnostics() {
        try {
            console.group('🏥 完全システム診断実行（Phase2F版）');
            
            const startTime = performance.now();
            const diagnostics = {
                timestamp: Date.now(),
                version: 'Phase2F',
                results: {}
            };
            
            // 1. CONFIG整合性
            console.log('1. CONFIG整合性診断...');
            diagnostics.results.config = {
                integrity: this.validateConfigIntegrity(),
                issues: this.getConfigIssues()
            };
            
            // 2. utils.js統合状況
            console.log('2. utils.js統合診断...');
            diagnostics.results.utils = {
                integrated: this.checkUtilsIntegration(),
                status: this.getUtilsStatus()
            };
            
            // 3. 依存関係
            console.log('3. 依存関係診断...');
            diagnostics.results.dependencies = {
                satisfied: this.checkDependencies(),
                status: this.getDependencyStatus()
            };
            
            // 4. システム健全性
            console.log('4. システム健全性診断...');
            diagnostics.results.health = this.checkSystemHealth();
            
            // 5. パフォーマンス
            console.log('5. パフォーマンス診断...');
            diagnostics.results.performance = this.checkPerformanceHealth();
            
            // 6. エラー状況
            console.log('6. エラー状況診断...');
            diagnostics.results.errors = this.checkErrorStatus();
            
            // 総合判定
            diagnostics.duration = performance.now() - startTime;
            diagnostics.overall = this.calculateOverallHealth(diagnostics.results);
            diagnostics.recommendations = this.generateRecommendations(diagnostics.results);
            
            // システム健全性更新
            this.updateSystemHealth(diagnostics);
            
            console.log('✅ 完全システム診断完了:', diagnostics.overall);
            console.groupEnd();
            
            return diagnostics;
            
        } catch (error) {
            console.error('完全システム診断エラー:', error);
            console.groupEnd();
            return {
                timestamp: Date.now(),
                error: error.message,
                overall: 'error'
            };
        }
    }
    
    /**
     * システム健全性確認
     */
    checkSystemHealth() {
        const health = {
            timestamp: Date.now(),
            components: {},
            overall: 'healthy'
        };
        
        try {
            // アプリケーション状態
            if (window.APP_STATE) {
                health.components.appState = {
                    initialized: window.APP_STATE.initialized,
                    errors: window.APP_STATE.stats?.errorCount || 0,
                    status: window.APP_STATE.initialized && 
                           (window.APP_STATE.stats?.errorCount || 0) < 5 ? 'healthy' : 'warning'
                };
            }
            
            // 主要コンポーネント
            const components = ['app', 'toolsSystem', 'uiManager', 'historyManager'];
            for (const comp of components) {
                if (window[comp]) {
                    const stats = window[comp].getStats?.() || 
                                 window[comp].getSystemStats?.() || 
                                 window[comp].getUIStats?.() || {};
                    
                    health.components[comp] = {
                        available: true,
                        stats: stats,
                        status: 'healthy'
                    };
                } else {
                    health.components[comp] = {
                        available: false,
                        status: 'missing'
                    };
                    health.overall = 'warning';
                }
            }
            
            // メモリ使用量チェック
            if (performance.memory) {
                const memoryMB = performance.memory.usedJSHeapSize / 1024 / 1024;
                health.components.memory = {
                    usedMB: Math.round(memoryMB),
                    status: memoryMB < 100 ? 'healthy' : memoryMB < 200 ? 'warning' : 'critical'
                };
                
                if (health.components.memory.status === 'critical') {
                    health.overall = 'critical';
                } else if (health.components.memory.status === 'warning' && health.overall === 'healthy') {
                    health.overall = 'warning';
                }
            }
            
        } catch (error) {
            console.error('システム健全性確認エラー:', error);
            health.overall = 'error';
            health.error = error.message;
        }
        
        return health;
    }
    
    /**
     * パフォーマンス健全性確認
     */
    checkPerformanceHealth() {
        const perf = {
            timestamp: Date.now(),
            metrics: {},
            status: 'unknown'
        };
        
        try {
            // 初期化時間
            if (window.APP_STATE?.stats?.initTime) {
                const initTime = window.APP_STATE.stats.initTime;
                perf.metrics.initTime = {
                    value: Math.round(initTime),
                    status: initTime < 3000 ? 'good' : initTime < 5000 ? 'warning' : 'slow'
                };
            }
            
            // FPS（システム監視から取得）
            if (window.systemMonitor) {
                const stats = window.systemMonitor.getPerformanceStats?.();
                if (stats?.fps) {
                    perf.metrics.fps = {
                        value: stats.fps,
                        status: stats.fps >= 55 ? 'good' : stats.fps >= 30 ? 'warning' : 'poor'
                    };
                }
            }
            
            // 全体判定
            const metrics = Object.values(perf.metrics);
            if (metrics.some(m => m.status === 'poor')) {
                perf.status = 'poor';
            } else if (metrics.some(m => m.status === 'slow' || m.status === 'warning')) {
                perf.status = 'warning';
            } else if (metrics.length > 0) {
                perf.status = 'good';
            }
            
        } catch (error) {
            perf.error = error.message;
            perf.status = 'error';
        }
        
        return perf;
    }
    
    /**
     * エラー状況確認
     */
    checkErrorStatus() {
        const errors = {
            timestamp: Date.now(),
            totalErrors: 0,
            recentErrors: 0,
            errorTypes: {},
            status: 'clean'
        };
        
        try {
            // アプリケーションエラー
            if (window.APP_STATE?.stats?.errorCount) {
                errors.totalErrors = window.APP_STATE.stats.errorCount;
            }
            
            // UI Manager エラー
            if (window.uiManager?.errorCount) {
                errors.totalErrors += window.uiManager.errorCount;
            }
            
            // 診断履歴からエラー集計
            const recentTime = Date.now() - 300000; // 5分間
            for (const record of this.diagnosticHistory) {
                if (record.timestamp > recentTime && record.issues) {
                    errors.recentErrors += record.issues.length;
                    
                    for (const issue of record.issues) {
                        errors.errorTypes[issue.type] = (errors.errorTypes[issue.type] || 0) + 1;
                    }
                }
            }
            
            // 状態判定
            if (errors.totalErrors === 0 && errors.recentErrors === 0) {
                errors.status = 'clean';
            } else if (errors.recentErrors < 3) {
                errors.status = 'minor';
            } else if (errors.recentErrors < 10) {
                errors.status = 'warning';
            } else {
                errors.status = 'critical';
            }
            
        } catch (error) {
            errors.error = error.message;
            errors.status = 'unknown';
        }
        
        return errors;
    }
    
    /**
     * 🆕 Phase2F: 自動修復システム
     */
    autoRepairConfig(issues) {
        const repairResults = [];
        
        console.group('🔧 CONFIG自動修復実行');
        
        for (const issue of issues) {
            try {
                const result = this.executeRepair(issue);
                repairResults.push(result);
                
                console.log(`${result.success ? '✅' : '❌'} ${issue.type}: ${result.message}`);
                
            } catch (error) {
                console.error(`修復エラー (${issue.type}):`, error);
                repairResults.push({
                    issue: issue,
                    success: false,
                    message: `修復実行エラー: ${error.message}`
                });
            }
        }
        
        // 修復履歴記録
        this.repairHistory.push({
            timestamp: Date.now(),
            issueCount: issues.length,
            results: repairResults,
            successCount: repairResults.filter(r => r.success).length
        });
        
        const successCount = repairResults.filter(r => r.success).length;
        console.log(`🔧 自動修復完了: ${successCount}/${issues.length}件成功`);
        console.groupEnd();
        
        return repairResults;
    }
    
    /**
     * 修復実行
     */
    executeRepair(issue) {
        const repairKey = `${issue.type}_${issue.key || 'general'}`;
        
        // 修復試行回数確認
        const attempts = this.repairAttempts.get(repairKey) || 0;
        if (attempts >= this.maxRepairAttempts) {
            return {
                issue: issue,
                success: false,
                message: `修復試行回数上限到達 (${attempts}/${this.maxRepairAttempts})`
            };
        }
        
        this.repairAttempts.set(repairKey, attempts + 1);
        
        try {
            switch (issue.autoRepair) {
                case 'createMinimalConfig':
                    return this.createMinimalConfig();
                    
                case 'setDefaultValue':
                    return this.setDefaultConfigValue(issue.key);
                    
                case 'setPhase2Value':
                    return this.setPhase2Value(issue.key, issue.expectedValue);
                    
                case 'resetPhase2Settings':
                    return this.resetPhase2Settings();
                    
                default:
                    return {
                        issue: issue,
                        success: false,
                        message: `未知の修復タイプ: ${issue.autoRepair}`
                    };
            }
            
        } catch (error) {
            return {
                issue: issue,
                success: false,
                message: `修復実行例外: ${error.message}`
            };
        }
    }
    
    /**
     * 最小限CONFIG作成
     */
    createMinimalConfig() {
        try {
            window.CONFIG = {
                DEFAULT_BRUSH_SIZE: 4,
                DEFAULT_OPACITY: 1.0,
                MAX_BRUSH_SIZE: 500,
                MIN_BRUSH_SIZE: 0.1,
                SIZE_PRESETS: [1, 2, 4, 8, 16, 32],
                CANVAS_WIDTH: 400,
                CANVAS_HEIGHT: 400,
                PREVIEW_MIN_SIZE: 0.5,
                PREVIEW_MAX_SIZE: 20,
                BG_COLOR: 0xf0e0d6,
                DEFAULT_COLOR: 0x800000
            };
            
            return {
                success: true,
                message: '最小限CONFIGを作成しました'
            };
            
        } catch (error) {
            return {
                success: false,
                message: `最小限CONFIG作成エラー: ${error.message}`
            };
        }
    }
    
    /**
     * デフォルト値設定
     */
    setDefaultConfigValue(key) {
        const defaults = {
            DEFAULT_BRUSH_SIZE: 4,
            DEFAULT_OPACITY: 1.0,
            MAX_BRUSH_SIZE: 500,
            MIN_BRUSH_SIZE: 0.1,
            SIZE_PRESETS: [1, 2, 4, 8, 16, 32],
            CANVAS_WIDTH: 400,
            CANVAS_HEIGHT: 400,
            PREVIEW_MIN_SIZE: 0.5,
            PREVIEW_MAX_SIZE: 20
        };
        
        try {
            if (key in defaults) {
                if (!window.CONFIG) window.CONFIG = {};
                window.CONFIG[key] = defaults[key];
                
                return {
                    success: true,
                    message: `${key} にデフォルト値を設定: ${defaults[key]}`
                };
            } else {
                return {
                    success: false,
                    message: `未知の設定キー: ${key}`
                };
            }
            
        } catch (error) {
            return {
                success: false,
                message: `デフォルト値設定エラー: ${error.message}`
            };
        }
    }
    
    /**
     * Phase2値設定
     */
    setPhase2Value(key, expectedValue) {
        try {
            if (!window.CONFIG) window.CONFIG = {};
            window.CONFIG[key] = expectedValue;
            
            return {
                success: true,
                message: `${key} をPhase2値に修正: ${expectedValue}`
            };
            
        } catch (error) {
            return {
                success: false,
                message: `Phase2値設定エラー: ${error.message}`
            };
        }
    }
    
    /**
     * Phase2設定リセット
     */
    resetPhase2Settings() {
        try {
            const phase2Defaults = {
                DEFAULT_BRUSH_SIZE: 4,
                DEFAULT_OPACITY: 1.0,
                MAX_BRUSH_SIZE: 500
            };
            
            let resetCount = 0;
            for (const [key, value] of Object.entries(phase2Defaults)) {
                if (window.CONFIG) {
                    window.CONFIG[key] = value;
                    resetCount++;
                }
            }
            
            return {
                success: resetCount > 0,
                message: `Phase2設定をリセット: ${resetCount}項目`
            };
            
        } catch (error) {
            return {
                success: false,
                message: `Phase2設定リセットエラー: ${error.message}`
            };
        }
    }
    
    /**
     * 🆕 Phase2F: エラーループ防止システム（main.jsから移管・強化）
     */
    resetErrorLoopPrevention() {
        try {
            const now = Date.now();
            
            // 定期的なリセット
            if (now - this.errorLoopPrevention.lastReset > this.errorLoopPrevention.resetInterval) {
                this.errorLoopPrevention.errorCounts.clear();
                this.errorLoopPrevention.lastReset = now;
                console.log('🔄 エラーループ防止リセット実行');
            }
            
            // 手動リセット
            this.errorLoopPrevention.errorCounts.clear();
            console.log('✅ エラーループ防止システムリセット完了');
            
            return true;
            
        } catch (error) {
            console.error('エラーループ防止リセットエラー:', error);
            return false;
        }
    }
    
    /**
     * エラー記録（ループ防止付き）
     */
    recordError(source, error) {
        try {
            const errorKey = `${source}_${error.message}`;
            const count = this.errorLoopPrevention.errorCounts.get(errorKey) || 0;
            
            if (count >= this.errorLoopPrevention.maxErrors) {
                console.warn(`⚠️ エラーループ防止: ${source} のエラーを抑制中`);
                return false;
            }
            
            this.errorLoopPrevention.errorCounts.set(errorKey, count + 1);
            
            // 診断履歴に記録
            this.diagnosticHistory.push({
                type: 'error',
                timestamp: Date.now(),
                source: source,
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                },
                count: count + 1
            });
            
            return true;
            
        } catch (recordError) {
            console.error('エラー記録失敗:', recordError);
            return false;
        }
    }
    
    /**
     * utils.js修復試行
     */
    attemptUtilsRepair(missingFunctions) {
        console.log('🔧 utils.js修復試行開始...');
        
        const repaired = [];
        
        // 基本的なフォールバック関数作成
        for (const funcName of missingFunctions) {
            try {
                const fallback = this.createUtilsFallback(funcName);
                if (fallback) {
                    window[funcName] = fallback;
                    repaired.push(funcName);
                    console.log(`🔧 ${funcName} フォールバック作成完了`);
                }
            } catch (error) {
                console.warn(`${funcName} フォールバック作成失敗:`, error);
            }
        }
        
        console.log(`🔧 utils.js修復完了: ${repaired.length}/${missingFunctions.length}関数`);
        return repaired;
    }
    
    /**
     * utils.jsフォールバック関数作成
     */
    createUtilsFallback(funcName) {
        switch (funcName) {
            case 'safeConfigGet':
                return (key, defaultValue) => {
                    try {
                        return window.CONFIG?.[key] ?? defaultValue;
                    } catch {
                        return defaultValue;
                    }
                };
                
            case 'validateBrushSize':
                return (size) => {
                    const num = Number(size);
                    if (isNaN(num)) return 4;
                    return Math.max(0.1, Math.min(500, num));
                };
                
            case 'validateOpacity':
                return (opacity) => {
                    const num = Number(opacity);
                    if (isNaN(num)) return 1.0;
                    return Math.max(0, Math.min(1, num));
                };
                
            case 'logError':
                return (error, context) => {
                    console.error(`[${context}]`, error);
                };
                
            case 'measurePerformance':
                return (name, func) => {
                    const start = performance.now();
                    const result = func();
                    const end = performance.now();
                    console.log(`⚡ ${name}: ${(end - start).toFixed(2)}ms`);
                    return result;
                };
                
            case 'throttle':
                return (func, delay) => {
                    let lastCall = 0;
                    return (...args) => {
                        const now = Date.now();
                        if (now - lastCall >= delay) {
                            lastCall = now;
                            return func(...args);
                        }
                    };
                };
                
            case 'debounce':
                return (func, delay) => {
                    let timeout;
                    return (...args) => {
                        clearTimeout(timeout);
                        timeout = setTimeout(() => func(...args), delay);
                    };
                };
                
            default:
                return null;
        }
    }
    
    /**
     * 診断結果重要度計算
     */
    calculateSeverity(issues) {
        if (issues.length === 0) return 'none';
        
        const severities = issues.map(issue => issue.severity);
        
        if (severities.includes('critical')) return 'critical';
        if (severities.includes('high')) return 'high';
        if (severities.includes('medium')) return 'medium';
        return 'low';
    }
    
    /**
     * 総合健全性計算
     */
    calculateOverallHealth(results) {
        try {
            const scores = [];
            
            // CONFIG整合性
            if (results.config?.integrity) {
                scores.push(100);
            } else {
                const issues = results.config?.issues || [];
                const criticalIssues = issues.filter(i => i.severity === 'critical').length;
                scores.push(Math.max(0, 100 - criticalIssues * 30 - issues.length * 10));
            }
            
            // utils.js統合
            scores.push(results.utils?.integrated ? 100 : 50);
            
            // 依存関係
            scores.push(results.dependencies?.satisfied ? 100 : 70);
            
            // システム健全性
            const health = results.health?.overall;
            if (health === 'healthy') scores.push(100);
            else if (health === 'warning') scores.push(70);
            else if (health === 'critical') scores.push(30);
            else scores.push(50);
            
            // エラー状況
            const errorStatus = results.errors?.status;
            if (errorStatus === 'clean') scores.push(100);
            else if (errorStatus === 'minor') scores.push(80);
            else if (errorStatus === 'warning') scores.push(50);
            else scores.push(20);
            
            const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
            
            if (avgScore >= 90) return 'excellent';
            if (avgScore >= 75) return 'good';
            if (avgScore >= 60) return 'fair';
            if (avgScore >= 40) return 'poor';
            return 'critical';
            
        } catch (error) {
            console.error('総合健全性計算エラー:', error);
            return 'unknown';
        }
    }
    
    /**
     * 推奨事項生成
     */
    generateRecommendations(results) {
        const recommendations = [];
        
        try {
            // CONFIG問題
            if (!results.config?.integrity) {
                recommendations.push({
                    type: 'config',
                    priority: 'high',
                    message: 'CONFIG設定を確認し、必要に応じて修復してください',
                    action: 'fixConfigCompletely()'
                });
            }
            
            // utils.js統合問題
            if (!results.utils?.integrated) {
                recommendations.push({
                    type: 'utils',
                    priority: 'critical',
                    message: 'utils.jsの再読み込みまたは統合確認が必要です',
                    action: 'location.reload()'
                });
            }
            
            // 依存関係問題
            if (!results.dependencies?.satisfied) {
                recommendations.push({
                    type: 'dependencies',
                    priority: 'high',
                    message: '必須ライブラリまたはコンポーネントが不足しています',
                    action: 'ライブラリファイルの読み込み確認'
                });
            }
            
            // パフォーマンス問題
            const perfStatus = results.performance?.status;
            if (perfStatus === 'poor' || perfStatus === 'slow') {
                recommendations.push({
                    type: 'performance',
                    priority: 'medium',
                    message: 'パフォーマンスが低下しています。不要な処理を確認してください',
                    action: 'システム監視・最適化'
                });
            }
            
            // エラー問題
            const errorStatus = results.errors?.status;
            if (errorStatus === 'warning' || errorStatus === 'critical') {
                recommendations.push({
                    type: 'errors',
                    priority: 'high',
                    message: '多数のエラーが発生しています。ログを確認してください',
                    action: 'エラーログ確認・修復'
                });
            }
            
        } catch (error) {
            console.error('推奨事項生成エラー:', error);
        }
        
        return recommendations;
    }
    
    /**
     * システム健全性更新
     */
    updateSystemHealth(diagnostics) {
        this.systemHealth = {
            overall: diagnostics.overall,
            components: diagnostics.results,
            lastCheck: diagnostics.timestamp,
            issues: this.extractIssues(diagnostics.results),
            recommendations: diagnostics.recommendations || []
        };
    }
    
    /**
     * 問題抽出
     */
    extractIssues(results) {
        const issues = [];
        
        try {
            // CONFIG問題
            if (results.config?.issues) {
                issues.push(...results.config.issues);
            }
            
            // 依存関係問題
            if (results.dependencies && !results.dependencies.satisfied) {
                issues.push({
                    type: 'dependencies',
                    message: '依存関係不足',
                    severity: 'high'
                });
            }
            
            // エラー問題
            if (results.errors && results.errors.status !== 'clean') {
                issues.push({
                    type: 'errors',
                    message: `エラー状況: ${results.errors.status}`,
                    severity: results.errors.status === 'critical' ? 'critical' : 'medium'
                });
            }
            
        } catch (error) {
            console.error('問題抽出エラー:', error);
        }
        
        return issues;
    }
    
    /**
     * 各種状態取得メソッド
     */
    getConfigIssues() {
        return this.diagnosticHistory
            .filter(record => record.type === 'config' || record.issues)
            .flatMap(record => record.issues || [])
            .slice(-10); // 最新10件
    }
    
    getUtilsStatus() {
        const utilsRecords = this.diagnosticHistory.filter(record => record.type === 'utils_integration');
        return utilsRecords.length > 0 ? utilsRecords[utilsRecords.length - 1].result : null;
    }
    
    getDependencyStatus() {
        const depRecords = this.diagnosticHistory.filter(record => record.type === 'dependencies');
        return depRecords.length > 0 ? depRecords[depRecords.length - 1].result : null;
    }
    
    /**
     * 公開API
     */
    getSystemHealth() {
        return { ...this.systemHealth };
    }
    
    getDiagnosticHistory() {
        return [...this.diagnosticHistory];
    }
    
    getRepairHistory() {
        return [...this.repairHistory];
    }
    
    getStatus() {
        return {
            autoRepairEnabled: this.autoRepairEnabled,
            maxRepairAttempts: this.maxRepairAttempts,
            activeRepairs: this.repairAttempts.size,
            diagnosticCount: this.diagnosticHistory.length,
            repairCount: this.repairHistory.length,
            errorLoopPrevention: {
                ...this.errorLoopPrevention,
                activeErrors: this.errorLoopPrevention.errorCounts.size
            }
        };
    }
    
    /**
     * 設定変更
     */
    enableAutoRepair() {
        this.autoRepairEnabled = true;
        console.log('🔧 自動修復有効化');
    }
    
    disableAutoRepair() {
        this.autoRepairEnabled = false;
        console.log('🔧 自動修復無効化');
    }
    
    setMaxRepairAttempts(max) {
        this.maxRepairAttempts = Math.max(1, Math.min(10, max));
        console.log(`🔧 最大修復試行回数変更: ${this.maxRepairAttempts}`);
    }
    
    /**
     * クリーンアップ
     */
    cleanup() {
        this.diagnosticHistory.length = 0;
        this.repairHistory.length = 0;
        this.repairAttempts.clear();
        this.errorLoopPrevention.errorCounts.clear();
        
        this.systemHealth = {
            overall: 'unknown',
            components: {},
            lastCheck: null,
            issues: []
        };
        
        console.log('🧹 DiagnosticsSystem クリーンアップ完了');
    }
}

// ==== グローバル登録・エクスポート（Phase2F版）====
if (typeof window !== 'undefined') {
    window.DiagnosticsSystem = DiagnosticsSystem;
    
    // グローバル診断インスタンス作成
    window.diagnosticsSystem = new DiagnosticsSystem();
    
    // グローバル関数（後方互換性維持）
    window.validateConfigIntegrity = function() {
        return window.diagnosticsSystem.validateConfigIntegrity();
    };
    
    window.checkUtilsIntegration = function() {
        return window.diagnosticsSystem.checkUtilsIntegration();
    };
    
    window.checkDependencies = function() {
        return window.diagnosticsSystem.checkDependencies();
    };
    
    window.resetErrorLoopPrevention = function() {
        return window.diagnosticsSystem.resetErrorLoopPrevention();
    };
    
    // 🆕 Phase2F新規関数
    window.runFullDiagnostics = function() {
        return window.diagnosticsSystem.runFullDiagnostics();
    };
    
    window.getSystemHealth = function() {
        return window.diagnosticsSystem.getSystemHealth();
    };
    
    window.autoRepairConfig = function() {
        const issues = window.diagnosticsSystem.getConfigIssues();
        if (issues.length > 0) {
            return window.diagnosticsSystem.autoRepairConfig(issues);
        } else {
            console.log('修復対象の問題が見つかりません');
            return [];
        }
    };
    
    console.log('✅ diagnostics.js Phase2F版読み込み完了');
    console.log('📦 エクスポートクラス・関数（Phase2F版）:');
    console.log('  ✅ DiagnosticsSystem: システム診断専用（単一責務）');
    console.log('  ✅ window.validateConfigIntegrity() - CONFIG整合性検証（main.jsから移管）');
    console.log('  ✅ window.checkUtilsIntegration() - utils.js統合確認（main.jsから移管）');
    console.log('  ✅ window.checkDependencies() - 依存関係チェック（main.jsから移管）');
    console.log('  ✅ window.resetErrorLoopPrevention() - エラーループ防止（main.jsから移管）');
    console.log('  ✅ window.runFullDiagnostics() - 完全診断実行（新規）');
    console.log('  ✅ window.getSystemHealth() - システム健全性取得（新規）');
    console.log('  ✅ window.autoRepairConfig() - CONFIG自動修復（新規）');
    console.log('🎯 責務: システム診断・問題検出・自動修復・健全性監視（単一責務）');
    console.log('🔗 連携: debug-manager.js, system-monitor.js');
    console.log('📋 Phase2F改修効果:');
    console.log('  🔧 main.jsから約300行の診断コード分離');
    console.log('  🏥 体系的なシステム健全性監視');
    console.log('  🔧 自動修復システム・エラーループ防止強化');
    console.log('  📊 診断履歴・修復履歴管理');
}

console.log('🎯 diagnostics.js Phase2F版初期化完了 - システム診断準備完了');