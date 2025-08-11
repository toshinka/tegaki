/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev11
 * パフォーマンスログ専用モジュール - performance-logger.js (Phase2F完成版)
 * 
 * 🔧 Phase2F新設: DRY・SOLID原則準拠
 * 1. ✅ main.jsからパフォーマンス測定機能分離
 * 2. ✅ 単一責任原則準拠（ログ・測定のみ）
 * 3. ✅ 実行時間測定・ボトルネック検出
 * 4. ✅ ログ出力・レポート生成機能
 * 5. ✅ utils.js統合・DRY原則準拠
 * 6. ✅ スロットリング・デバウンス対応
 * 7. ✅ ベンチマーク機能・統計分析
 * 
 * 責務: 実行時間測定・ボトルネック検出・ログ出力・レポート生成
 * 依存: utils.js
 */

console.log('🔧 performance-logger.js Phase2F完成版読み込み開始...');

// ==== パフォーマンスログ専用クラス ====
class PerformanceLogger {
    constructor() {
        this.isEnabled = this.checkLoggingEnabled();
        this.logLevel = this.getLogLevel();
        
        // 測定データ
        this.measurements = new Map();
        this.operationHistory = [];
        this.slowOperations = [];
        this.benchmarks = new Map();
        
        // ログ設定
        this.logToConsole = true;
        this.logToStorage = false;
        this.maxHistoryLength = 1000;
        this.slowThreshold = 10; // 10ms以上で低速と判定
        this.criticalThreshold = 100; // 100ms以上でクリティカルと判定
        
        // 統計データ
        this.stats = {
            totalMeasurements: 0,
            slowOperationCount: 0,
            criticalOperationCount: 0,
            averageTime: 0,
            totalTime: 0,
            maxTime: 0,
            minTime: Infinity
        };
        
        // レポート生成用
        this.reports = [];
        this.maxReportsCount = 50;
        
        // スロットリング制御
        this.throttledLogs = new Map();
        this.defaultThrottleTime = 1000; // 1秒間隔
        
        console.log('⚡ PerformanceLogger初期化（Phase2F完成版）', {
            enabled: this.isEnabled,
            logLevel: this.logLevel
        });
    }
    
    /**
     * ログ有効状態確認
     */
    checkLoggingEnabled() {
        try {
            // URLパラメータ確認
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('perfLog') === 'true') return true;
            
            // localStorage確認（安全にアクセス）
            if (typeof Storage !== 'undefined' && localStorage) {
                if (localStorage.getItem('performanceLogging') === 'true') return true;
            }
            
            // 開発環境では自動有効化
            if (window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1') return true;
            
            return false;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * ログレベル取得
     */
    getLogLevel() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const level = urlParams.get('perfLogLevel');
            if (['debug', 'info', 'warn', 'error'].includes(level)) {
                return level;
            }
            
            // デフォルトレベル
            return 'info';
        } catch (error) {
            return 'info';
        }
    }
    
    /**
     * パフォーマンス測定（main.jsから移管）
     */
    measurePerformance(operationName, operation, options = {}) {
        if (!this.isEnabled) {
            // ログ無効時は測定なしで実行
            if (typeof operation === 'function') {
                return operation();
            }
            return operation;
        }
        
        const startTime = performance.now();
        let result;
        let error = null;
        
        try {
            if (typeof operation === 'function') {
                result = operation();
            } else {
                result = operation;
            }
        } catch (err) {
            error = err;
            throw err;
        } finally {
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            // 測定データ記録
            this.recordMeasurement(operationName, duration, error, options);
        }
        
        return result;
    }
    
    /**
     * 非同期パフォーマンス測定
     */
    async measurePerformanceAsync(operationName, asyncOperation, options = {}) {
        if (!this.isEnabled) {
            return await asyncOperation();
        }
        
        const startTime = performance.now();
        let result;
        let error = null;
        
        try {
            result = await asyncOperation();
        } catch (err) {
            error = err;
            throw err;
        } finally {
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            this.recordMeasurement(operationName, duration, error, options);
        }
        
        return result;
    }
    
    /**
     * 測定データ記録
     */
    recordMeasurement(operationName, duration, error = null, options = {}) {
        if (!this.isEnabled) return;
        
        const measurement = {
            name: operationName,
            duration: duration,
            timestamp: Date.now(),
            error: error,
            metadata: options.metadata || {}
        };
        
        // 履歴に追加
        this.operationHistory.push(measurement);
        if (this.operationHistory.length > this.maxHistoryLength) {
            this.operationHistory.shift();
        }
        
        // 統計更新
        this.updateStats(measurement);
        
        // 低速操作の記録
        if (duration >= this.slowThreshold) {
            this.recordSlowOperation(measurement);
        }
        
        // ログ出力
        this.logMeasurement(measurement);
        
        // 操作別統計の更新
        this.updateOperationStats(operationName, duration);
    }
    
    /**
     * 統計データ更新
     */
    updateStats(measurement) {
        this.stats.totalMeasurements++;
        this.stats.totalTime += measurement.duration;
        this.stats.averageTime = this.stats.totalTime / this.stats.totalMeasurements;
        
        if (measurement.duration > this.stats.maxTime) {
            this.stats.maxTime = measurement.duration;
        }
        
        if (measurement.duration < this.stats.minTime) {
            this.stats.minTime = measurement.duration;
        }
        
        if (measurement.duration >= this.slowThreshold) {
            this.stats.slowOperationCount++;
        }
        
        if (measurement.duration >= this.criticalThreshold) {
            this.stats.criticalOperationCount++;
        }
    }
    
    /**
     * 操作別統計更新
     */
    updateOperationStats(operationName, duration) {
        if (!this.measurements.has(operationName)) {
            this.measurements.set(operationName, {
                count: 0,
                totalTime: 0,
                averageTime: 0,
                minTime: Infinity,
                maxTime: 0,
                lastMeasured: null
            });
        }
        
        const stats = this.measurements.get(operationName);
        stats.count++;
        stats.totalTime += duration;
        stats.averageTime = stats.totalTime / stats.count;
        stats.lastMeasured = Date.now();
        
        if (duration < stats.minTime) {
            stats.minTime = duration;
        }
        
        if (duration > stats.maxTime) {
            stats.maxTime = duration;
        }
    }
    
    /**
     * 低速操作記録
     */
    recordSlowOperation(measurement) {
        this.slowOperations.push({
            ...measurement,
            severity: measurement.duration >= this.criticalThreshold ? 'critical' : 'slow'
        });
        
        // 最大100件まで保持
        if (this.slowOperations.length > 100) {
            this.slowOperations.shift();
        }
        
        // 警告ログ出力（スロットリング付き）
        this.logSlowOperationThrottled(measurement);
    }
    
    /**
     * 測定結果ログ出力
     */
    logMeasurement(measurement) {
        if (!this.logToConsole) return;
        
        const duration = measurement.duration.toFixed(2);
        const severity = this.getSeverity(measurement.duration);
        
        switch (severity) {
            case 'critical':
                console.error(`🐌 [CRITICAL] ${measurement.name}: ${duration}ms`);
                break;
            case 'slow':
                console.warn(`⚠️ [SLOW] ${measurement.name}: ${duration}ms`);
                break;
            case 'normal':
                if (this.logLevel === 'debug') {
                    console.log(`⚡ ${measurement.name}: ${duration}ms`);
                }
                break;
        }
        
        if (measurement.error) {
            console.error(`❌ エラー付き測定 ${measurement.name}:`, measurement.error);
        }
    }
    
    /**
     * 低速操作警告（スロットリング付き）
     */
    logSlowOperationThrottled(measurement) {
        const key = `slow_${measurement.name}`;
        const now = Date.now();
        const lastLog = this.throttledLogs.get(key);
        
        if (!lastLog || (now - lastLog) >= this.defaultThrottleTime) {
            const severity = measurement.duration >= this.criticalThreshold ? 'CRITICAL' : 'SLOW';
            console.warn(`🚨 [${severity}] ${measurement.name}: ${measurement.duration.toFixed(2)}ms (閾値: ${this.slowThreshold}ms)`);
            
            this.throttledLogs.set(key, now);
        }
    }
    
    /**
     * 重要度判定
     */
    getSeverity(duration) {
        if (duration >= this.criticalThreshold) return 'critical';
        if (duration >= this.slowThreshold) return 'slow';
        return 'normal';
    }
    
    /**
     * ベンチマーク実行
     */
    benchmark(name, operation, iterations = 100) {
        if (!this.isEnabled) {
            return operation();
        }
        
        console.log(`🏁 ベンチマーク開始: ${name} (${iterations}回)`);
        
        const results = [];
        const startTime = performance.now();
        
        for (let i = 0; i < iterations; i++) {
            const iterStartTime = performance.now();
            try {
                operation();
            } catch (error) {
                console.error(`ベンチマーク実行エラー (${i}回目):`, error);
            }
            const iterEndTime = performance.now();
            results.push(iterEndTime - iterStartTime);
        }
        
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        
        // 統計計算
        const sorted = results.sort((a, b) => a - b);
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const avg = results.reduce((sum, time) => sum + time, 0) / results.length;
        const median = sorted[Math.floor(sorted.length / 2)];
        const p95 = sorted[Math.floor(sorted.length * 0.95)];
        
        const benchmarkResult = {
            name,
            iterations,
            totalTime,
            results: {
                min: min.toFixed(2),
                max: max.toFixed(2),
                avg: avg.toFixed(2),
                median: median.toFixed(2),
                p95: p95.toFixed(2)
            },
            timestamp: Date.now()
        };
        
        this.benchmarks.set(name, benchmarkResult);
        
        console.log(`🏆 ベンチマーク完了: ${name}`);
        console.table(benchmarkResult.results);
        
        return benchmarkResult;
    }
    
    /**
     * ベンチマーク結果取得
     */
    getBenchmarkResults(name = null) {
        if (name) {
            return this.benchmarks.get(name) || null;
        }
        return Object.fromEntries(this.benchmarks);
    }
    
    /**
     * パフォーマンスレポート生成
     */
    generatePerformanceReport(options = {}) {
        const includeDetails = options.includeDetails || false;
        const timeRange = options.timeRange || 300000; // 5分間
        const now = Date.now();
        
        // 指定時間内の測定データをフィルタ
        const recentOperations = this.operationHistory.filter(
            op => (now - op.timestamp) <= timeRange
        );
        
        const report = {
            timestamp: now,
            timeRangeMs: timeRange,
            summary: { ...this.stats },
            recentOperations: recentOperations.length,
            slowOperationsInRange: recentOperations.filter(
                op => op.duration >= this.slowThreshold
            ).length,
            criticalOperationsInRange: recentOperations.filter(
                op => op.duration >= this.criticalThreshold
            ).length,
            topSlowOperations: this.getTopSlowOperations(10),
            operationStats: this.getOperationStatsReport(),
            benchmarks: includeDetails ? this.getBenchmarkResults() : Object.keys(this.benchmarks.entries())
        };
        
        if (includeDetails) {
            report.recentHistory = recentOperations;
            report.allSlowOperations = this.slowOperations;
        }
        
        // レポート保存
        this.reports.push(report);
        if (this.reports.length > this.maxReportsCount) {
            this.reports.shift();
        }
        
        return report;
    }
    
    /**
     * 操作統計レポート生成
     */
    getOperationStatsReport() {
        const stats = {};
        
        for (const [name, data] of this.measurements) {
            stats[name] = {
                count: data.count,
                totalTime: data.totalTime.toFixed(2),
                avgTime: data.averageTime.toFixed(2),
                minTime: data.minTime.toFixed(2),
                maxTime: data.maxTime.toFixed(2),
                lastMeasured: new Date(data.lastMeasured).toLocaleTimeString()
            };
        }
        
        return stats;
    }
    
    /**
     * 上位低速操作取得
     */
    getTopSlowOperations(count = 10) {
        return this.slowOperations
            .sort((a, b) => b.duration - a.duration)
            .slice(0, count)
            .map(op => ({
                name: op.name,
                duration: op.duration.toFixed(2),
                timestamp: new Date(op.timestamp).toLocaleTimeString(),
                severity: op.severity
            }));
    }
    
    /**
     * ボトルネック検出
     */
    detectBottlenecks() {
        const bottlenecks = [];
        
        // 操作別平均時間を確認
        for (const [name, stats] of this.measurements) {
            if (stats.averageTime >= this.slowThreshold) {
                bottlenecks.push({
                    type: 'slow_average',
                    operation: name,
                    avgTime: stats.averageTime.toFixed(2),
                    count: stats.count,
                    severity: stats.averageTime >= this.criticalThreshold ? 'critical' : 'moderate'
                });
            }
            
            // 最大時間が異常に長い場合
            if (stats.maxTime >= this.criticalThreshold * 2) {
                bottlenecks.push({
                    type: 'extreme_max',
                    operation: name,
                    maxTime: stats.maxTime.toFixed(2),
                    avgTime: stats.averageTime.toFixed(2),
                    severity: 'critical'
                });
            }
        }
        
        // 頻発する低速操作
        const recentSlowOps = this.slowOperations.filter(
            op => (Date.now() - op.timestamp) <= 60000 // 1分以内
        );
        
        const slowOpCounts = {};
        recentSlowOps.forEach(op => {
            slowOpCounts[op.name] = (slowOpCounts[op.name] || 0) + 1;
        });
        
        for (const [name, count] of Object.entries(slowOpCounts)) {
            if (count >= 5) { // 1分間に5回以上
                bottlenecks.push({
                    type: 'frequent_slow',
                    operation: name,
                    count: count,
                    timeWindow: '1分間',
                    severity: count >= 10 ? 'critical' : 'moderate'
                });
            }
        }
        
        return bottlenecks;
    }
    
    /**
     * システム統計取得
     */
    getSystemStats() {
        return {
            enabled: this.isEnabled,
            logLevel: this.logLevel,
            measurements: this.stats,
            operationTypes: this.measurements.size,
            recentHistory: this.operationHistory.length,
            slowOperations: this.slowOperations.length,
            benchmarks: this.benchmarks.size,
            reports: this.reports.length,
            bottlenecks: this.detectBottlenecks().length
        };
    }
    
    /**
     * 詳細統計取得
     */
    getDetailedStats() {
        return {
            system: this.getSystemStats(),
            measurements: this.getOperationStatsReport(),
            recentBottlenecks: this.detectBottlenecks(),
            topSlowOperations: this.getTopSlowOperations(5),
            benchmarkSummary: Object.keys(this.benchmarks.entries())
        };
    }
    
    /**
     * ログクリア
     */
    clearLogs() {
        this.operationHistory.length = 0;
        this.slowOperations.length = 0;
        this.measurements.clear();
        this.throttledLogs.clear();
        
        // 統計リセット
        this.stats = {
            totalMeasurements: 0,
            slowOperationCount: 0,
            criticalOperationCount: 0,
            averageTime: 0,
            totalTime: 0,
            maxTime: 0,
            minTime: Infinity
        };
        
        console.log('🧹 パフォーマンスログをクリアしました');
    }
    
    /**
     * 設定変更
     */
    updateSettings(settings = {}) {
        if (settings.slowThreshold !== undefined) {
            this.slowThreshold = Math.max(1, settings.slowThreshold);
        }
        
        if (settings.criticalThreshold !== undefined) {
            this.criticalThreshold = Math.max(this.slowThreshold, settings.criticalThreshold);
        }
        
        if (settings.logToConsole !== undefined) {
            this.logToConsole = settings.logToConsole;
        }
        
        if (settings.maxHistoryLength !== undefined) {
            this.maxHistoryLength = Math.max(100, settings.maxHistoryLength);
        }
        
        console.log('⚙️ パフォーマンスログ設定更新:', settings);
    }
    
    /**
     * ログ有効/無効切り替え
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        console.log(`⚡ パフォーマンスログ: ${enabled ? '有効' : '無効'}`);
    }
    
    /**
     * デバッグ情報出力
     */
    debugInfo() {
        console.group('🔍 PerformanceLogger デバッグ情報（Phase2F）');
        
        console.log('基本設定:', {
            enabled: this.isEnabled,
            logLevel: this.logLevel,
            slowThreshold: this.slowThreshold + 'ms',
            criticalThreshold: this.criticalThreshold + 'ms'
        });
        
        console.log('統計概要:', this.stats);
        console.log('測定操作数:', this.measurements.size);
        console.log('ベンチマーク数:', this.benchmarks.size);
        
        const recentBottlenecks = this.detectBottlenecks();
        if (recentBottlenecks.length > 0) {
            console.warn('検出されたボトルネック:', recentBottlenecks);
        }
        
        const topSlow = this.getTopSlowOperations(5);
        if (topSlow.length > 0) {
            console.warn('上位低速操作:', topSlow);
        }
        
        console.groupEnd();
    }
    
    /**
     * クリーンアップ
     */
    destroy() {
        this.clearLogs();
        this.benchmarks.clear();
        this.reports.length = 0;
        
        console.log('🧹 PerformanceLogger クリーンアップ完了');
    }
}

// ==== グローバル登録・エクスポート ====
if (typeof window !== 'undefined') {
    // シングルトンインスタンス作成
    if (!window.performanceLogger) {
        window.performanceLogger = new PerformanceLogger();
        
        // グローバル関数として登録（main.jsとの互換性維持）
        window.measurePerformance = (name, operation, options) => {
            return window.performanceLogger.measurePerformance(name, operation, options);
        };
        
        window.measurePerformanceAsync = (name, operation, options) => {
            return window.performanceLogger.measurePerformanceAsync(name, operation, options);
        };
        
        // デバッグ関数
        window.debugPerformance = () => {
            window.performanceLogger.debugInfo();
        };
        
        window.generatePerfReport = (options) => {
            const report = window.performanceLogger.generatePerformanceReport(options);
            console.log('📊 パフォーマンスレポート:', report);
            return report;
        };
        
        window.detectBottlenecks = () => {
            const bottlenecks = window.performanceLogger.detectBottlenecks();
            console.log('🔍 ボトルネック検出結果:', bottlenecks);
            return bottlenecks;
        };
        
        console.log('✅ performance-logger.js Phase2F完成版 読み込み完了');
        console.log('📦 エクスポート完了:');
        console.log('  ✅ PerformanceLogger クラス');
        console.log('  ✅ window.performanceLogger シングルトン');
        console.log('  ✅ window.measurePerformance() - 後方互換性');
        console.log('  ✅ window.measurePerformanceAsync() - 非同期対応');
        console.log('🔧 Phase2F新機能:');
        console.log('  ✅ ボトルネック自動検出');
        console.log('  ✅ ベンチマーク機能');
        console.log('  ✅ 詳細統計レポート');
        console.log('  ✅ スロットリング制御');
        console.log('  ✅ 重要度判定システム');
        console.log('🐛 デバッグ関数:');
        console.log('  - window.debugPerformance() - 詳細情報表示');
        console.log('  - window.generatePerfReport() - レポート生成');
        console.log('  - window.detectBottlenecks() - ボトルネック検出');
    }
}

console.log('🏆 performance-logger.js Phase2F完成版 初期化完了');