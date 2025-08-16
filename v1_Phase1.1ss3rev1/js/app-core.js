/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: PixiJS基盤管理・拡張ライブラリ統合
 * 🎯 DEPENDENCIES: libs/pixi-extensions.js (Pure JavaScript)
 * 🎯 NODE_MODULES: pixi.js@^7.4.3
 * 🎯 PIXI_EXTENSIONS: 基盤システム・拡張統合
 * 🎯 ISOLATION_TEST: 可能（基盤機能単体）
 * 🎯 SPLIT_THRESHOLD: 300行（基盤システム・分割慎重）
 * 📋 PHASE_TARGET: Phase1.1ss3 - Pure JavaScript完全準拠
 * 📋 V8_MIGRATION: Application.init() 対応予定
 * 📋 RULEBOOK_COMPLIANCE: 1.2実装原則「Pure JavaScript維持」完全準拠
 */

/**
 * アプリケーション基盤システム
 * PixiJS Application管理・拡張ライブラリ統合基盤
 * Pure JavaScript完全準拠・グローバル公開方式
 */
class AppCore {
    constructor() {
        this.version = '1.0-Phase1.1ss3-PureJS';
        this.isInitialized = false;
        this.startTime = performance.now();
        
        // 基盤システム状態
        this.pixiExtensions = null;
        this.extensionStats = null;
        this.compatibilityIssues = [];
        
        console.log('🎨 AppCore 構築開始（Pure JavaScript）...');
    }
    
    /**
     * 基盤システム初期化
     */
    async init() {
        try {
            console.log('🔧 AppCore基盤システム初期化開始...');
            
            // Step 1: PixiJS基本検証
            this.validatePixiJS();
            
            // Step 2: 拡張ライブラリ統合確認
            await this.initializeExtensions();
            
            // Step 3: 互換性検証
            this.validateCompatibility();
            
            // Step 4: 基盤システム準備完了
            this.setupFoundation();
            
            this.isInitialized = true;
            const initTime = performance.now() - this.startTime;
            
            console.log('✅ AppCore基盤システム初期化完了！');
            console.log(`⏱️ 初期化時間: ${initTime.toFixed(2)}ms`);
            console.log('📊 拡張ライブラリ統合状況:', this.extensionStats);
            
            if (this.compatibilityIssues.length > 0) {
                console.warn('⚠️ 互換性の問題:', this.compatibilityIssues);
            }
            
            return this;
            
        } catch (error) {
            console.error('❌ AppCore基盤システム初期化エラー:', error);
            throw error;
        }
    }
    
    /**
     * PixiJS基本検証
     */
    validatePixiJS() {
        if (!window.PIXI) {
            throw new Error('PixiJS が読み込まれていません');
        }
        
        const requiredVersion = '7.0.0';
        const currentVersion = PIXI.VERSION;
        
        console.log(`✅ PixiJS v${currentVersion} 検出`);
        
        // バージョンチェック
        const [major] = currentVersion.split('.').map(Number);
        if (major < 7) {
            this.compatibilityIssues.push(`PixiJS v7以上が必要です (現在: v${currentVersion})`);
        }
        
        // 必須機能チェック
        const requiredFeatures = ['Application', 'Graphics', 'Container', 'Renderer'];
        requiredFeatures.forEach(feature => {
            if (!PIXI[feature]) {
                throw new Error(`必須機能が不足しています: PIXI.${feature}`);
            }
        });
        
        console.log('✅ PixiJS基本検証完了');
    }
    
    /**
     * 拡張ライブラリ統合初期化
     */
    async initializeExtensions() {
        // PixiExtensions確認
        if (!window.PixiExtensions) {
            throw new Error('PixiExtensions 統合システムが読み込まれていません');
        }
        
        this.pixiExtensions = window.PixiExtensions;
        
        // まだ初期化されていない場合は初期化
        if (!this.pixiExtensions.initialized) {
            await this.pixiExtensions.initialize();
        }
        
        // 統計情報取得
        this.extensionStats = this.pixiExtensions.getStats();
        
        console.log('✅ 拡張ライブラリ統合初期化完了');
        console.log(`📦 利用可能ライブラリ: ${this.extensionStats.available}/${this.extensionStats.total}`);
        console.log(`📋 ライブラリリスト: ${this.extensionStats.libraries.join(', ')}`);
    }
    
    /**
     * 互換性検証
     */
    validateCompatibility() {
        const issues = [];
        
        // ブラウザ互換性チェック
        if (!window.requestAnimationFrame) {
            issues.push('requestAnimationFrame が利用できません');
        }
        
        if (!window.performance) {
            issues.push('Performance API が利用できません');
        }
        
        // Canvas/WebGL サポートチェック
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) {
            issues.push('WebGL が利用できません - Canvas fallback使用');
        }
        
        // 必須DOM APIチェック
        const requiredAPIs = ['addEventListener', 'querySelector', 'createElement'];
        requiredAPIs.forEach(api => {
            if (!document[api]) {
                issues.push(`DOM API が不足しています: ${api}`);
            }
        });
        
        // タッチ対応チェック
        const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        if (!hasTouch) {
            console.log('📱 タッチデバイスではありません - マウス操作のみ');
        }
        
        this.compatibilityIssues = issues;
        
        if (issues.length === 0) {
            console.log('✅ 互換性検証: 問題なし');
        } else {
            console.warn('⚠️ 互換性の問題が見つかりました:', issues);
        }
    }
    
    /**
     * 基盤システム準備
     */
    setupFoundation() {
        // グローバル設定
        if (window.PIXI) {
            // アンチエイリアス有効化
            PIXI.settings.ROUND_PIXELS = true;
            
            // 解像度設定
            PIXI.settings.RESOLUTION = window.devicePixelRatio || 1;
            
            // スケールモード設定（シャープな描画）
            PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
            
            console.log('⚙️ PixiJS基盤設定完了');
        }
        
        // パフォーマンスタイマー開始
        this.startPerformanceMonitoring();
        
        // グローバルエラーハンドリング
        this.setupErrorHandling();
        
        console.log('✅ 基盤システム準備完了');
    }
    
    /**
     * パフォーマンス監視開始
     */
    startPerformanceMonitoring() {
        this.performanceData = {
            startTime: this.startTime,
            frameCount: 0,
            lastTime: performance.now(),
            averageFPS: 0
        };
        
        const updatePerformance = () => {
            this.performanceData.frameCount++;
            const currentTime = performance.now();
            
            if (currentTime - this.performanceData.lastTime >= 1000) {
                this.performanceData.averageFPS = Math.round(
                    (this.performanceData.frameCount * 1000) / 
                    (currentTime - this.performanceData.lastTime)
                );
                
                this.performanceData.frameCount = 0;
                this.performanceData.lastTime = currentTime;
            }
            
            requestAnimationFrame(updatePerformance);
        };
        
        updatePerformance();
        console.log('📊 パフォーマンス監視開始');
    }
    
    /**
     * エラーハンドリング設定
     */
    setupErrorHandling() {
        // PixiJS エラーハンドリング
        if (window.PIXI && PIXI.utils) {
            const originalEmit = PIXI.utils.EventEmitter.prototype.emit;
            PIXI.utils.EventEmitter.prototype.emit = function(event, ...args) {
                try {
                    return originalEmit.call(this, event, ...args);
                } catch (error) {
                    console.error('PixiJS イベントエラー:', error);
                    return false;
                }
            };
        }
        
        // グローバルエラーハンドリング
        window.addEventListener('error', (event) => {
            console.error('グローバルエラー:', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error
            });
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            console.error('未処理Promise拒否:', event.reason);
        });
        
        console.log('🛡️ エラーハンドリング設定完了');
    }
    
    /**
     * システム状態取得
     * @returns {Object} システム状態
     */
    getSystemState() {
        return {
            version: this.version,
            isInitialized: this.isInitialized,
            initTime: performance.now() - this.startTime,
            extensionStats: this.extensionStats,
            compatibilityIssues: [...this.compatibilityIssues],
            performanceData: { ...this.performanceData },
            pixiVersion: window.PIXI ? PIXI.VERSION : null,
            browserInfo: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language,
                cookieEnabled: navigator.cookieEnabled
            }
        };
    }
    
    /**
     * 拡張機能チェック
     * @param {string} feature - 機能名
     * @returns {boolean} 利用可能フラグ
     */
    hasFeature(feature) {
        return this.pixiExtensions ? this.pixiExtensions.hasFeature(feature) : false;
    }
    
    /**
     * コンポーネント取得
     * @param {string} library - ライブラリ名
     * @param {string} component - コンポーネント名
     * @returns {*} コンポーネント
     */
    getComponent(library, component) {
        return this.pixiExtensions ? 
            this.pixiExtensions.getComponent(library, component) : null;
    }
    
    /**
     * メモリ使用量推定
     * @returns {Object} メモリ情報
     */
    getMemoryInfo() {
        const info = {
            estimated: 'N/A',
            jsHeapSizeLimit: 'N/A',
            totalJSHeapSize: 'N/A',
            usedJSHeapSize: 'N/A'
        };
        
        // Chrome/Edge のメモリ情報
        if (window.performance && window.performance.memory) {
            const memory = window.performance.memory;
            info.jsHeapSizeLimit = this.formatBytes(memory.jsHeapSizeLimit);
            info.totalJSHeapSize = this.formatBytes(memory.totalJSHeapSize);
            info.usedJSHeapSize = this.formatBytes(memory.usedJSHeapSize);
        }
        
        return info;
    }
    
    /**
     * バイト数フォーマット
     * @param {number} bytes - バイト数
     * @returns {string} フォーマット済み文字列
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    /**
     * システム診断実行
     * @returns {Object} 診断結果
     */
    runDiagnostics() {
        const diagnostics = {
            timestamp: new Date().toISOString(),
            systemState: this.getSystemState(),
            memoryInfo: this.getMemoryInfo(),
            pixiCapabilities: {},
            recommendations: []
        };
        
        // PixiJS 機能診断
        if (window.PIXI) {
            diagnostics.pixiCapabilities = {
                webglSupport: !!PIXI.utils.isWebGLSupported(),
                maxTextureSize: PIXI.settings.RENDER_OPTIONS ? 
                    PIXI.settings.RENDER_OPTIONS.maxTextureSize : 'Unknown',
                renderer: PIXI.autoDetectRenderer ? 'Auto-detect available' : 'Manual setup required'
            };
        }
        
        // 推奨事項生成
        if (this.compatibilityIssues.length > 0) {
            diagnostics.recommendations.push('互換性問題の解決が推奨されます');
        }
        
        if (this.performanceData.averageFPS < 30) {
            diagnostics.recommendations.push('パフォーマンス最適化が推奨されます');
        }
        
        if (!this.hasFeature('ui')) {
            diagnostics.recommendations.push('@pixi/ui ライブラリの追加で機能向上可能');
        }
        
        return diagnostics;
    }
    
    /**
     * v8移行準備チェック
     * @returns {Object} 移行準備状況
     */
    checkV8MigrationReadiness() {
        const readiness = {
            compatible: true,
            issues: [],
            suggestions: []
        };
        
        // v7 API使用箇所チェック
        if (window.PIXI) {
            const version = PIXI.VERSION;
            const [major] = version.split('.').map(Number);
            
            if (major >= 8) {
                readiness.suggestions.push('PixiJS v8が検出されました - 新API活用可能');
            } else {
                readiness.suggestions.push('PixiJS v8移行準備: Application.init() 対応予定');
            }
        }
        
        return readiness;
    }
    
    /**
     * デバッグ情報出力
     */
    debugInfo() {
        const systemState = this.getSystemState();
        const diagnostics = this.runDiagnostics();
        const v8Readiness = this.checkV8MigrationReadiness();
        
        console.group('🎨 AppCore デバッグ情報');
        console.log('📊 システム状態:', systemState);
        console.log('🔍 診断結果:', diagnostics);
        console.log('🚀 v8移行準備:', v8Readiness);
        console.groupEnd();
        
        return { systemState, diagnostics, v8Readiness };
    }
    
    /**
     * 基盤システムリセット
     */
    reset() {
        try {
            this.performanceData = null;
            this.extensionStats = null;
            this.compatibilityIssues = [];
            this.isInitialized = false;
            
            console.log('🔄 AppCore基盤システムリセット完了');
            
        } catch (error) {
            console.error('❌ AppCore リセットエラー:', error);
        }
    }
    
    /**
     * 破棄処理
     */
    destroy() {
        try {
            this.reset();
            this.pixiExtensions = null;
            
            console.log('🗑️ AppCore 破棄完了');
            
        } catch (error) {
            console.error('❌ AppCore 破棄エラー:', error);
        }
    }
}

// Pure JavaScript グローバル公開（ルールブック準拠）
if (typeof window !== 'undefined') {
    window.AppCore = AppCore;
    console.log('✅ AppCore グローバル公開完了（Pure JavaScript）');
}

console.log('🎨 AppCore Pure JavaScript完全準拠版 - 準備完了');
console.log('📋 ルールブック準拠: 1.2実装原則「ESM/TypeScript混在禁止・Pure JavaScript維持」');
console.log('💡 使用例: const appCore = new window.AppCore(); await appCore.init();');