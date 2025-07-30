// main.js - Phase1修正版（色彩統合制御+mitt統合・120行実装）
import { OGLCore } from './OGLCore.js';
import { OGLEnhancedFacade } from './OGLEnhancedFacade.js';
import mitt from 'mitt';

/**
 * OGL統一エンジン Phase1修正版
 * - 色彩責務分離：設定系→統合制御→描画系の完全分離
 * - mitt統合：イベント処理最適化
 * - 120行効率実装
 */
class OGLUnifiedEngine {
    constructor(canvas) {
        // mitt統合イベントバス
        this.eventBus = mitt();
        
        // コア初期化
        this.core = new OGLCore(canvas);
        this.facade = new OGLEnhancedFacade(this.core);
        
        // 色彩統合制御初期化（責務分離核心）
        this.initializeColorSystem();
        
        // 統合設定
        this.setupIntegration();
        this.facade.startPerformanceMonitoring();
        
        console.log('🚀 OGL統一エンジン Phase1起動 - 色彩分離+mitt統合完了');
        this.logInitialization();
    }
    
    // === 色彩統合制御システム（責務分離実装の核心） ===
    
    initializeColorSystem() {
        const settings = this.facade.getEnhancer('settings');
        const defaultColor = settings?.get('drawing.color') || '#800000';
        
        // 色彩制御統合オブジェクト
        this.colorSystem = {
            current: defaultColor,
            setColor: this.setColor.bind(this),
            hexToRgb: this.hexToRgb.bind(this),
            rgbToHex: this.rgbToHex.bind(this)
        };
        
        // 初期色彩適用（設定系→描画系）
        this.setColor(defaultColor);
        
        // 色彩変更監視設定
        settings?.onChange('drawing.color', (newColor) => {
            console.log('🎨 設定系色彩変更検出:', newColor);
            this.setColor(newColor);
        });
        
        // mitt統合：色彩変更イベント設定
        this.eventBus.on('color.change.request', (colorData) => {
            this.setColor(colorData.color);
        });
        
        console.log('✅ 色彩統合制御初期化完了:', defaultColor);
    }
    
    // 色彩設定統合制御（設定系→描画系の責務分離実装）
    setColor(color) {
        let rgb, hexColor, updated = false;
        
        // 色彩形式判定・変換
        if (typeof color === 'string') {
            hexColor = color;
            rgb = this.hexToRgb(color);
            updated = this.colorSystem.current !== hexColor;
        } else if (Array.isArray(color)) {
            rgb = color;
            hexColor = this.rgbToHex(color);
            updated = this.colorSystem.current !== hexColor;
        } else {
            console.warn('❌ 無効色彩形式:', color);
            return false;
        }
        
        if (!updated) return true;
        
        // 描画系適用（責務分離：描画ロジックは隔離）
        this.core.setColor(rgb);
        
        // 設定系反映（責務分離：設定管理は隔離）
        const settings = this.facade.getEnhancer('settings');
        settings?.set('drawing.color', hexColor);
        
        // 内部状態更新
        this.colorSystem.current = hexColor;
        
        // mitt統合：色彩変更通知
        this.eventBus.emit('color.changed', { 
            hex: hexColor, 
            rgb: rgb,
            timestamp: performance.now()
        });
        
        console.log('🎨 色彩統合制御実行:', hexColor, '→', rgb);
        return true;
    }
    
    // 色彩変換ユーティリティ（効率化）
    hexToRgb(hex) {
        const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return match ? [
            parseInt(match[1], 16) / 255,
            parseInt(match[2], 16) / 255,
            parseInt(match[3], 16) / 255
        ] : [0.5, 0, 0]; // #800000デフォルト
    }
    
    rgbToHex(rgb) {
        const toHex = (c) => Math.round(c * 255).toString(16).padStart(2, '0');
        return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`;
    }
    
    // 統合設定（mitt統合・効率化）
    setupIntegration() {
        this.startTime = performance.now();
        this.isInitialized = true;
        
        // mitt統合：グローバルイベント設定
        this.setupMittIntegratedEvents();
        
        // mitt統合：エラーハンドリング
        this.setupMittErrorHandling();
    }
    
    // mitt統合イベント設定（効率化）
    setupMittIntegratedEvents() {
        // リサイズ処理（mitt統合）
        const handleResize = () => {
            if (document.body.classList.contains('fullscreen-drawing')) {
                this.facade.resizeCanvas(window.innerWidth - 20, window.innerHeight - 20);
                this.eventBus.emit('window.resized', {
                    width: window.innerWidth - 20,
                    height: window.innerHeight - 20
                });
            }
        };
        
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(handleResize, 100);
        });
        
        // クリーンアップ対応
        window.addEventListener('beforeunload', () => {
            this.eventBus.emit('application.beforeunload');
            this.destroy();
        });
        
        // mitt統合：アプリケーション内部イベント
        this.eventBus.on('ui.action', (actionData) => {
            this.handleUIAction(actionData);
        });
        
        this.eventBus.on('settings.bulk.update', (settingsData) => {
            Object.entries(settingsData).forEach(([key, value]) => {
                this.facade.setSetting(key, value);
            });
        });
    }
    
    // mitt統合エラーハンドリング
    setupMittErrorHandling() {
        const handleError = (error) => {
            const errorInfo = {
                timestamp: new Date().toISOString(),
                message: error.message || String(error),
                diagnostics: this.facade.getDiagnostics()
            };
            
            this.eventBus.emit('application.error', errorInfo);
            
            console.group('🚨 OGL統一エンジン エラー');
            console.error('エラー:', errorInfo.message);
            console.error('診断:', errorInfo.diagnostics.enhancers);
            console.groupEnd();
        };
        
        window.addEventListener('error', (e) => handleError(e.error));
        window.addEventListener('unhandledrejection', (e) => handleError(e.reason));
    }
    
    // UI操作処理（mitt統合）
    handleUIAction(actionData) {
        const actions = {
            'clear': () => this.facade.clear(),
            'undo': () => this.facade.undo(),
            'color.set': () => this.setColor(actionData.color),
            'fullscreen.toggle': () => this.facade.toggleFullscreen(),
            'panel.toggle': () => this.facade.toggleControlPanel()
        };
        
        const action = actions[actionData.action];
        if (action) {
            action();
            this.eventBus.emit('ui.action.completed', actionData);
        }
    }
    
    // === Facade Pattern統一インターフェース（色彩対応） ===
    
    // 基本操作
    clear() { return this.facade.clear(); }
    undo() { return this.facade.undo(); }
    resizeCanvas(w, h) { return this.facade.resizeCanvas(w, h); }
    
    // 描画設定
    setPenSize(size) { return this.facade.setPenSize(size); }
    setOpacity(opacity) { return this.facade.setOpacity(opacity); }
    setPressureSensitivity(sensitivity) { return this.facade.setPressureSensitivity(sensitivity); }
    setSmoothing(enabled) { return this.facade.setSmoothing(enabled); }
    
    // 色彩制御（統合制御経由）
    getCurrentColor() { return this.colorSystem.current; }
    getColorRGB() { return this.core.currentColor; }
    setColorHex(hex) { return this.setColor(hex); }
    
    // 品質・UI制御
    setQualityLevel(level) { return this.facade.setQualityLevel(level); }
    toggleControlPanel() { return this.facade.toggleControlPanel(); }
    toggleFullscreen() { return this.facade.toggleFullscreen(); }
    
    // 設定管理
    getSetting(path) { return this.facade.getSetting(path); }
    setSetting(path, value) { return this.facade.setSetting(path, value); }
    getSettings() { return this.facade.getSettings(); }
    resetSettings() { return this.facade.resetSettings(); }
    
    // 統計・診断
    getStats() { return this.facade.getStats(); }
    getDiagnostics() { return this.facade.getDiagnostics(); }
    
    // mitt統合イベント管理
    on(event, handler) { return this.eventBus.on(event, handler); }
    off(event, handler) { return this.eventBus.off(event, handler); }
    emit(event, data) { return this.eventBus.emit(event, data); }
    
    // 高度機能
    getEnhancer(name) { return this.facade.getEnhancer(name); }
    integrateLibrary(name, instance, config) { return this.facade.integrateLibrary(name, instance, config); }
    
    // === アプリケーション制御・診断 ===
    
    logInitialization() {
        const diagnostics = this.facade.getDiagnostics();
        
        console.group('🎨 OGL統一エンジン Phase1 診断');
        console.log('✅ コア:', diagnostics.core.initialized ? '正常' : '異常');
        console.log('✅ Enhancer:', diagnostics.enhancers.active.join(', '));
        console.log('🎨 色彩:', this.colorSystem.current);
        console.log('📊 mitt統合:', this.eventBus ? '完了' : '失敗');
        
        if (diagnostics.enhancers.failed.length > 0) {
            console.warn('⚠️ 失敗:', diagnostics.enhancers.failed.join(', '));
        }
        console.groupEnd();
    }
    
    isHealthy() {
        const diagnostics = this.facade.getDiagnostics();
        return (
            diagnostics.core.initialized &&
            diagnostics.enhancers.active.length > 0 &&
            this.colorSystem.current &&
            this.eventBus
        );
    }
    
    getPerformanceInfo() {
        const stats = this.facade.getStats();
        const uptime = performance.now() - this.startTime;
        
        return {
            uptime: Math.round(uptime),
            fps: stats.fps,
            strokeCount: stats.strokeCount,
            isDrawing: stats.isDrawing,
            currentColor: this.colorSystem.current,
            eventBusActive: !!this.eventBus
        };
    }
    
    debug() {
        const performance = this.getPerformanceInfo();
        const diagnostics = this.facade.getDiagnostics();
        
        console.group('🔧 Phase1デバッグ情報');
        console.table(performance);
        console.log('🎨 色彩システム:', this.colorSystem);
        console.log('📊 mitt統合状態:', {
            eventBus: !!this.eventBus,
            listenerCount: this.eventBus ? Object.keys(this.eventBus.all).length : 0
        });
        console.groupEnd();
        
        return { performance, diagnostics, colorSystem: this.colorSystem };
    }
    
    // クリーンアップ（mitt統合対応）
    destroy() {
        console.log('🔄 Phase1クリーンアップ開始');
        
        // mitt統合クリーンアップ
        if (this.eventBus) {
            this.eventBus.emit('application.destroy');
            this.eventBus.all.clear();
        }
        
        // Facade・Core クリーンアップ
        if (this.facade?.destroy) this.facade.destroy();
        
        // 参照クリア
        this.facade = null;
        this.core = null;
        this.colorSystem = null;
        this.eventBus = null;
        this.isInitialized = false;
        
        console.log('✅ Phase1クリーンアップ完了');
    }
}

// === アプリケーション初期化（Phase1修正版） ===
document.addEventListener('DOMContentLoaded', () => {
    try {
        const canvas = document.getElementById('drawingCanvas');
        if (!canvas) {
            throw new Error('Canvas要素 #drawingCanvas が見つかりません');
        }
        
        // Phase1 OGL統一エンジン初期化
        const drawingApp = new OGLUnifiedEngine(canvas);
        
        // グローバル参照（開発・デバッグ用）
        window.drawingApp = drawingApp;
        
        // Phase1対応ヘルパー関数
        window.debugOGL = () => drawingApp.debug();
        window.healthOGL = () => drawingApp.isHealthy();
        window.statsOGL = () => drawingApp.getStats();
        window.setColorOGL = (color) => drawingApp.setColor(color);
        window.getCurrentColorOGL = () => drawingApp.getCurrentColor();
        
        // mitt統合テスト用
        window.emitOGL = (event, data) => drawingApp.emit(event, data);
        window.onOGL = (event, handler) => drawingApp.on(event, handler);
        
        console.log('🚀 Phase1アプリケーション初期化完了');
        console.log('💡 利用可能: debugOGL(), healthOGL(), setColorOGL("#FF0000")');
        console.log('📊 mitt統合: emitOGL("test", {}), onOGL("test", console.log)');
        
        // Phase1準備完了イベント（mitt統合）
        drawingApp.emit('application.ready', {
            timestamp: Date.now(),
            version: 'Phase1-修正版',
            features: ['色彩責務分離', 'mitt統合', '線品質改善'],
            defaultColor: drawingApp.getCurrentColor()
        });
        
    } catch (error) {
        console.error('🚨 Phase1初期化失敗:', error);
        
        // エラー表示
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: #ff4757; color: white; padding: 20px; border-radius: 8px;
            font-family: monospace; text-align: center; z-index: 10000;
            box-shadow: 0 8px 32px rgba(255, 71, 87, 0.3);
        `;
        errorDiv.innerHTML = `
            <h3>🚨 Phase1初期化エラー</h3>
            <p>${error.message}</p>
            <p>コンソールで詳細確認してください</p>
        `;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => errorDiv.remove(), 5000);
    }
});