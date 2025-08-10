/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev11
 * パフォーマンスログ専用モジュール - performance-logger.js (Phase2F)
 * 
 * 🔧 Phase2F新設: DRY・SOLID原則準拠
 * 1. ✅ main.jsからパフォーマンス測定機能分離
 * 2. ✅ 単一責任原則準拠（ログ・測定のみ）
 * 3. ✅ 実行時間測定・ボトルネック検出
 * 4. ✅ ログ出力・レポート生成機能
 * 5. ✅ utils.js統合・DRY原則準拠
 * 
 * 責務: 実行時間測定・ボトルネック検出・ログ出力・レポート生成
 * 依存: utils.js
 */

console.log('🔧 performance-logger.js Phase2F版読み込み開始...');

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
        
        console.log('⚡ PerformanceLogger初期化（Phase2F版）', {
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
            
            // localStorage確認
            if (localStorage && localStorage.getItem('performanceLogging') === 'true') return true;
            
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