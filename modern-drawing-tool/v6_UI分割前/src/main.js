// main.js - 戦略A: 最小構成実装（2 imports・100行以下）
import { OGLCore } from './OGLCore.js';
import { OGLEnhancedFacade } from './OGLEnhancedFacade.js';

/**
 * 戦略A: 最小構成OGL統一エンジン
 * - たった2つのimportで全機能アクセス
 * - 100行以下のシンプルな実装
 * - Facade Pattern による統一制御
 * - 責任分離による保守性向上
 */
class OGLUnifiedEngine {
    constructor(canvas) {
        // コア機能初期化（描画・レンダリング基盤）
        this.core = new OGLCore(canvas);
        
        // 拡張機能統合（全Enhancer・UI・設定管理）
        this.facade = new OGLEnhancedFacade(this.core);
        
        // アプリケーション制御初期化
        this.setupApplication();
        
        // パフォーマンス監視開始
        this.facade.startPerformanceMonitoring();
        
        console.log('🎨 OGL統一エンジン起動完了 - 戦略A実装');
        this.logDiagnostics();
    }
    
    // アプリケーション制御設定（最小限）
    setupApplication() {
        // グローバルイベントハンドラー設定
        this.setupGlobalEvents();
        
        // アプリケーション状態管理
        this.isInitialized = true;
        this.startTime = performance.now();
    }
    
    // グローバルイベント設定（統合・効率化）
    setupGlobalEvents() {
        // リサイズ対応（Facade経由）
        let resizeTimeout;
        window.addEventListener('resize', () => {
            if (!document.body.classList.contains('fullscreen-drawing')) return;
            
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.facade.resizeCanvas(window.innerWidth - 20, window.innerHeight - 20);
            }, 100);
        });
        
        // ページ離脱時のクリーンアップ
        window.addEventListener('beforeunload', () => {
            this.destroy();
        });
        
        // エラーハンドリング
        window.addEventListener('error', (event) => {
            console.error('🚨 アプリケーションエラー:', event.error);
            this.handleError(event.error);
        });
        
        // 未処理Promise拒否対応
        window.addEventListener('unhandledrejection', (event) => {
            console.error('🚨 未処理Promise拒否:', event.reason);
            this.handleError(event.reason);
        });
    }
    
    // エラーハンドリング（統合）
    handleError(error) {
        // 診断情報の収集
        const diagnostics = this.facade.getDiagnostics();
        
        // エラー情報の統合
        const errorInfo = {
            timestamp: new Date().toISOString(),
            error: error.message || String(error),
            stack: error.stack || 'No stack trace',
            diagnostics: diagnostics,
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        // コンソール出力
        console.group('🚨 OGL統一エンジン エラー詳細');
        console.error('エラー:', errorInfo.error);
        console.error('スタック:', errorInfo.stack);
        console.table(errorInfo.diagnostics.enhancers);
        console.groupEnd();
        
        // Facade経由でのエラー通知
        this.facade.emit('application.error', errorInfo);
    }
    
    // === Facade Pattern: 外部統一インターフェース（委譲） ===
    
    // 基本操作（Facade委譲）
    clear() {
        return this.facade.clear();
    }
    
    undo() {
        return this.facade.undo();
    }
    
    resizeCanvas(width, height) {
        return this.facade.resizeCanvas(width, height);
    }
    
    // ペン設定（Facade委譲）
    setPenSize(size) {
        return this.facade.setPenSize(size);
    }
    
    setOpacity(opacity) {
        return this.facade.setOpacity(opacity);
    }
    
    setPressureSensitivity(sensitivity) {
        return this.facade.setPressureSensitivity(sensitivity);
    }
    
    setSmoothing(enabled) {
        return this.facade.setSmoothing(enabled);
    }
    
    // 品質設定（Facade委譲）
    setQualityLevel(level) {
        return this.facade.setQualityLevel(level);
    }
    
    setAntialiasing(enabled) {
        return this.facade.setAntialiasing(enabled);
    }
    
    // UI制御（Facade委譲）
    toggleControlPanel() {
        return this.facade.toggleControlPanel();
    }
    
    toggleFullscreen() {
        return this.facade.toggleFullscreen();
    }
    
    // 設定管理（Facade委譲）
    getSetting(path) {
        return this.facade.getSetting(path);
    }
    
    setSetting(path, value) {
        return this.facade.setSetting(path, value);
    }
    
    getSettings() {
        return this.facade.getSettings();
    }
    
    resetSettings() {
        return this.facade.resetSettings();
    }
    
    // 統計情報（Facade委譲）
    getStats() {
        return this.facade.getStats();
    }
    
    getDiagnostics() {
        return this.facade.getDiagnostics();
    }
    
    // イベント管理（Facade委譲）
    on(event, handler) {
        return this.facade.on(event, handler);
    }
    
    off(event, handler) {
        return this.facade.off(event, handler);
    }
    
    emit(event, data) {
        return this.facade.emit(event, data);
    }
    
    // 高度な機能（Facade委譲）
    getEnhancer(name) {
        return this.facade.getEnhancer(name);
    }
    
    integrateLibrary(name, instance, config) {
        return this.facade.integrateLibrary(name, instance, config);
    }
    
    // === アプリケーション制御メソッド ===
    
    // 診断情報出力
    logDiagnostics() {
        const diagnostics = this.facade.getDiagnostics();
        
        console.group('🎨 OGL統一エンジン 診断情報');
        console.log('✅ コア初期化:', diagnostics.core.initialized);
        console.log('✅ アクティブEnhancer:', diagnostics.enhancers.active.join(', '));
        
        if (diagnostics.enhancers.failed.length > 0) {
            console.warn('⚠️ 失敗Enhancer:', diagnostics.enhancers.failed.join(', '));
        }
        
        console.log('📊 統計情報:', diagnostics.stats);
        console.groupEnd();
    }
    
    // アプリケーション状態チェック
    isHealthy() {
        const diagnostics = this.facade.getDiagnostics();
        
        return (
            diagnostics.core.initialized &&
            diagnostics.enhancers.active.length > 0 &&
            diagnostics.settings.available
        );
    }
    
    // パフォーマンス情報取得
    getPerformanceInfo() {
        const stats = this.facade.getStats();
        const uptime = performance.now() - this.startTime;
        
        return {
            uptime: Math.round(uptime),
            fps: stats.fps,
            strokeCount: stats.strokeCount,
            totalPoints: stats.totalPoints,
            isDrawing: stats.isDrawing,
            memoryUsage: this.getMemoryUsage()
        };
    }
    
    // メモリ使用量取得
    getMemoryUsage() {
        const memoryInfo = performance.memory;
        if (!memoryInfo) return 'N/A';
        
        return {
            used: Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024),
            total: Math.round(memoryInfo.totalJSHeapSize / 1024 / 1024),
            limit: Math.round(memoryInfo.jsHeapSizeLimit / 1024 / 1024)
        };
    }
    
    // デバッグ情報出力
    debug() {
        const performance = this.getPerformanceInfo();
        const diagnostics = this.facade.getDiagnostics();
        
        console.group('🔧 OGL統一エンジン デバッグ情報');
        console.table(performance);
        console.table(diagnostics.settings);
        console.groupEnd();
        
        return { performance, diagnostics };
    }
    
    // クリーンアップ（メモリリーク対策）
    destroy() {
        console.log('🔄 OGL統一エンジン クリーンアップ開始');
        
        // Facade経由でのクリーンアップ
        if (this.facade && typeof this.facade.destroy === 'function') {
            this.facade.destroy();
        }
        
        // 参照クリア
        this.facade = null;
        this.core = null;
        this.isInitialized = false;
        
        console.log('✅ OGL統一エンジン クリーンアップ完了');
    }
}

// === アプリケーション初期化（効率化・エラー対応） ===
document.addEventListener('DOMContentLoaded', () => {
    try {
        const canvas = document.getElementById('drawingCanvas');
        if (!canvas) {
            throw new Error('Canvas element #drawingCanvas not found');
        }
        
        // OGL統一エンジン初期化
        const drawingApp = new OGLUnifiedEngine(canvas);
        
        // グローバル参照（デバッグ・開発用）
        window.drawingApp = drawingApp;
        
        // 開発用ヘルパー関数
        window.debugOGL = () => drawingApp.debug();
        window.statsOGL = () => drawingApp.getStats();
        window.healthOGL = () => drawingApp.isHealthy();
        
        // 初期化完了ログ
        console.log('🚀 アプリケーション初期化完了');
        console.log('💡 デバッグ: debugOGL(), statsOGL(), healthOGL() が利用可能');
        
        // アプリケーション準備完了イベント
        drawingApp.emit('application.ready', {
            timestamp: Date.now(),
            version: '1.5',
            strategy: 'A'
        });
        
    } catch (error) {
        console.error('🚨 アプリケーション初期化失敗:', error);
        
        // エラー表示
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: #ff6b6b; color: white; padding: 20px; border-radius: 8px;
            font-family: monospace; text-align: center; z-index: 10000;
        `;
        errorDiv.innerHTML = `
            <h3>🚨 OGL統一エンジン初期化エラー</h3>
            <p>${error.message}</p>
            <p>コンソールで詳細を確認してください</p>
        `;
        document.body.appendChild(errorDiv);
        
        // 5秒後に削除
        setTimeout(() => {
            document.body.removeChild(errorDiv);
        }, 5000);
    }
});