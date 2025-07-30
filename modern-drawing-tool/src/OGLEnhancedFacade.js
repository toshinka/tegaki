// OGLEnhancedFacade.js - パフォーマンス監視修正版（メモリリーク対策）
import { UIController } from './UIController.js';
import { OGLQualityEnhancer } from './quality/OGLQualityEnhancer.js';
import { OGLMathEnhancer } from './quality/OGLMathEnhancer.js';
import { OGLPressureEnhancer } from './quality/OGLPressureEnhancer.js';
import { OGLShaderEnhancer } from './quality/OGLShaderEnhancer.js';
import { OGLInteractionEnhancer } from './OGLInteractionEnhancer.js';
import { OGLProEnhancer } from './OGLProEnhancer.js';
import { OGLSettingsManager } from './OGLSettingsManager.js';

export class OGLEnhancedFacade {
    constructor(oglCore) {
        this.core = oglCore;
        this.enhancers = {};
        
        // パフォーマンス監視（最適化）
        this.performanceMonitor = null;
        this.performanceInterval = null;
        this.performanceConfig = {
            interval: 5000, // 5秒間隔に変更
            memoryCheckInterval: 30000, // メモリチェックは30秒間隔
            lastMemoryCheck: 0
        };
        
        this.initializeEnhancers();
        this.setupIntegration();
        this.setupEventHandlers();
    }
    
    // Enhancer群初期化（エラー分離・順序最適化）
    initializeEnhancers() {
        const enhancerConfigs = [
            ['settings', () => new OGLSettingsManager(this.core)],
            ['quality', () => new OGLQualityEnhancer(this.core)],
            ['math', () => new OGLMathEnhancer(this.core)],
            ['pressure', () => this.createDummyEnhancer()],
            ['shader', () => new OGLShaderEnhancer(this.core)],
            ['interaction', () => new OGLInteractionEnhancer(this.core)],
            ['pro', () => this.createDummyEnhancer()],
            ['ui', () => new UIController(this)]
        ];
        
        enhancerConfigs.forEach(([key, initFn]) => {
            try {
                this.enhancers[key] = initFn();
            } catch (error) {
                console.warn(`${key} enhancer failed:`, error.message);
                this.enhancers[key] = null;
            }
        });
    }
    
    // ダミーEnhancer（軽量化）
    createDummyEnhancer() {
        const methods = ['onDrawingSettingsChange', 'onQualitySettingsChange', 
                        'onInteractionSettingsChange', 'onProSettingsChange',
                        'onDrawingStart', 'onDrawingUpdate', 'onDrawingComplete',
                        'onCanvasCleared', 'onCanvasUndone', 'onToolChanged', 'destroy'];
        
        return methods.reduce((obj, method) => {
            obj[method] = () => {};
            return obj;
        }, {});
    }
    
    // 統合設定システム
    setupIntegration() {
        const settings = this.enhancers.settings;
        if (!settings) return;
        
        // 設定変更監視（debounce内蔵）
        const settingsMap = [
            ['drawing', this.handleDrawingSettings.bind(this)],
            ['quality', this.handleQualitySettings.bind(this)],
            ['interaction', this.handleInteractionSettings.bind(this)],
            ['pro', this.handleProSettings.bind(this)],
            ['ui', this.handleUISettings.bind(this)],
            ['shortcuts', this.handleShortcutSettings.bind(this)]
        ];
        
        settingsMap.forEach(([type, handler]) => {
            settings.onChange(type, (settingsData) => {
                handler(settingsData);
                this.core.emit('settings.changed', { type, settings: settingsData });
            });
        });
        
        this.applyInitialSettings(settings);
    }
    
    // 設定ハンドラー群（効率化）
    handleDrawingSettings(drawingSettings) {
        this.core.updatePenSize(drawingSettings.penSize);
        this.core.updateOpacity(drawingSettings.opacity / 100);
        this.core.updatePressureSensitivity(drawingSettings.pressureSensitivity / 100);
        this.core.updateSmoothing(drawingSettings.smoothing);
        
        this.notifyEnhancers('onDrawingSettingsChange', drawingSettings);
        this.enhancers.ui?.syncWithSettings?.(drawingSettings);
    }
    
    handleQualitySettings(qualitySettings) {
        this.notifyEnhancers('onQualitySettingsChange', qualitySettings);
    }
    
    handleInteractionSettings(interactionSettings) {
        this.notifyEnhancers('onInteractionSettingsChange', interactionSettings);
    }
    
    handleProSettings(proSettings) {
        this.notifyEnhancers('onProSettingsChange', proSettings);
    }
    
    handleUISettings(uiSettings) {
        this.enhancers.ui?.updateUIVisibility?.(uiSettings);
    }
    
    handleShortcutSettings(shortcuts) {
        if (this.enhancers.ui?.setupKeyboardShortcuts) {
            this.enhancers.ui.shortcuts = shortcuts;
            this.enhancers.ui.setupKeyboardShortcuts();
        }
    }
    
    // Enhancer群通知（エラー分離）
    notifyEnhancers(methodName, data) {
        Object.values(this.enhancers).forEach(enhancer => {
            if (enhancer?.[methodName]) {
                try {
                    enhancer[methodName](data);
                } catch (error) {
                    console.warn(`Enhancer ${methodName} failed:`, error.message);
                }
            }
        });
    }
    
    // 初期設定適用
    applyInitialSettings(settings) {
        const settingTypes = [
            ['drawing', this.handleDrawingSettings.bind(this)],
            ['quality', 'onQualitySettingsChange'],
            ['interaction', 'onInteractionSettingsChange'],
            ['pro', 'onProSettingsChange']
        ];
        
        settingTypes.forEach(([type, handler]) => {
            const settingData = settings.get(type);
            if (settingData) {
                if (typeof handler === 'function') {
                    handler(settingData);
                } else {
                    this.notifyEnhancers(handler, settingData);
                }
            }
        });
        
        const ui = settings.get('ui');
        const shortcuts = settings.get('shortcuts');
        
        if (ui) this.handleUISettings(ui);
        if (shortcuts) this.handleShortcutSettings(shortcuts);
    }
    
    // イベントハンドラー設定
    setupEventHandlers() {
        const eventMap = [
            ['drawing.start', 'onDrawingStart'],
            ['drawing.update', 'onDrawingUpdate'],
            ['drawing.complete', 'onDrawingComplete'],
            ['canvas.cleared', 'onCanvasCleared'],
            ['canvas.undone', 'onCanvasUndone'],
            ['tool.changed', 'onToolChanged']
        ];
        
        eventMap.forEach(([event, method]) => {
            this.core.on(event, (data) => {
                this.notifyEnhancers(method, data);
                if (event.includes('complete') || event.includes('cleared') || event.includes('undone')) {
                    this.updateStatus();
                }
            });
        });
        
        this.core.on('fps.update', () => this.updateStatus());
        this.core.on('ui.action', (data) => this.handleUIAction(data));
    }
    
    // UI操作処理
    handleUIAction(data) {
        const actionMap = {
            'clear': () => this.core.clear(),
            'undo': () => this.core.undo(),
            'tool-change': () => this.core.emit('tool.changed', { tool: data.tool })
        };
        
        actionMap[data.action]?.();
    }
    
    // ステータス更新
    updateStatus() {
        this.enhancers.ui?.updateStatusDisplay?.(this.core.strokes.length, this.core.fps);
    }
    
    // === Facade Pattern統一インターフェース ===
    
    // 設定インターフェース（バリデーション統合）
    setPenSize(size) { return this.setSetting('drawing.penSize', this.clamp(size, 1, 50)); }
    setOpacity(opacity) { return this.setSetting('drawing.opacity', this.clamp(opacity, 1, 100)); }
    setPressureSensitivity(sensitivity) { return this.setSetting('drawing.pressureSensitivity', this.clamp(sensitivity, 0, 100)); }
    setSmoothing(enabled) { return this.setSetting('drawing.smoothing', enabled); }
    setQualityLevel(level) { return this.setSetting('quality.level', ['low','medium','high','ultra'].includes(level) ? level : 'medium'); }
    setAntialiasing(enabled) { return this.setSetting('quality.antialiasing', enabled); }
    setGestureEnabled(enabled) { return this.setSetting('interaction.gestureEnabled', enabled); }
    setZoomEnabled(enabled) { return this.setSetting('interaction.zoomEnabled', enabled); }
    setBrushType(type) { return this.setSetting('pro.brushType', ['pen','brush','marker','pencil'].includes(type) ? type : 'pen'); }
    setLayerMode(mode) { return this.setSetting('pro.layerMode', ['normal','multiply','screen','overlay'].includes(mode) ? mode : 'normal'); }
    
    clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
    
    // UI制御
    toggleControlPanel() { this.enhancers.ui?.toggleControlPanel?.(); }
    toggleFullscreen() { this.enhancers.ui?.toggleFullscreen?.(); }
    
    // 基本操作
    clear() { this.core.clear(); }
    undo() { this.core.undo(); }
    resizeCanvas(width, height) { this.core.resizeCanvas(width, height); }
    
    // 設定アクセス
    getSetting(path) { return this.enhancers.settings?.get(path); }
    setSetting(path, value) { return this.enhancers.settings?.set(path, value); }
    getSettings() { return this.enhancers.settings?.getAll(); }
    resetSettings() { return this.enhancers.settings?.reset(); }
    
    // 統計・診断
    getStats() {
        return {
            strokeCount: this.core.strokes.length,
            fps: this.core.fps,
            isDrawing: this.core.isDrawing,
            currentStrokePoints: this.core.currentStroke?.points?.length || 0,
            totalPoints: this.core.strokes.reduce((sum, stroke) => sum + (stroke.points?.length || 0), 0)
        };
    }
    
    getDiagnostics() {
        const activeEnhancers = Object.entries(this.enhancers)
            .filter(([, enhancer]) => enhancer !== null)
            .map(([name]) => name);
            
        const failedEnhancers = Object.entries(this.enhancers)
            .filter(([, enhancer]) => enhancer === null)
            .map(([name]) => name);
        
        return {
            core: {
                initialized: !!this.core,
                canvas: !!this.core?.canvas,
                renderer: !!this.core?.renderer,
                eventBus: !!this.core?.eventBus
            },
            enhancers: {
                active: activeEnhancers,
                failed: failedEnhancers,
                total: Object.keys(this.enhancers).length
            },
            settings: {
                available: !!this.enhancers.settings,
                drawing: this.getSetting('drawing'),
                quality: this.getSetting('quality'),
                interaction: this.getSetting('interaction'),
                pro: this.getSetting('pro'),
                ui: this.getSetting('ui'),
                shortcuts: this.getSetting('shortcuts')
            },
            stats: this.getStats()
        };
    }
    
    // イベント管理
    on(event, handler) { this.core.on(event, handler); }
    off(event, handler) { this.core.off(event, handler); }
    emit(event, data) { this.core.emit(event, data); }
    
    // エンハンサー直接アクセス
    getEnhancer(name) { return this.enhancers[name]; }
    
    // ライブラリ統合基盤（軽量化）
    integrateLibrary(libraryName, libraryInstance, config = {}) {
        const integrators = {
            'chroma-js': this.integrateChromaJS.bind(this),
            'lodash-es': this.integrateLodashES.bind(this),
            'hammerjs': this.integrateHammerJS.bind(this)
        };
        
        try {
            const integrator = integrators[libraryName];
            return integrator ? integrator(libraryInstance, config) : false;
        } catch (error) {
            console.error(`Library integration failed for ${libraryName}:`, error);
            return false;
        }
    }
    
    // Chroma.js統合（軽量版）
    integrateChromaJS(chroma, config) {
        if (!chroma) return false;
        
        this.colorSystem = {
            chroma: chroma,
            generatePalette: (baseColor, count = 5) => 
                chroma.scale([baseColor, 'white']).mode('hsl').colors(count),
            adjustOpacity: (color, opacity) => 
                chroma(color).alpha(opacity).css(),
            getComplementary: (color) => 
                chroma(color).set('hsl.h', '+180').css()
        };
        
        if (this.enhancers.ui && config.enableColorUI) {
            this.enhancers.ui.integrateColorSystem?.(this.colorSystem);
        }
        
        return true;
    }
    
    // Lodash-ES統合（効率化確認）
    integrateLodashES(lodash, config) {
        if (!lodash) return false;
        
        this.utilitySystem = {
            lodash: lodash,
            debounce: lodash.debounce,
            throttle: lodash.throttle,
            clamp: lodash.clamp,
            memoize: lodash.memoize
        };
        
        return true;
    }
    
    // HammerJS統合
    integrateHammerJS(hammer, config) {
        if (!hammer || !this.enhancers.interaction) return false;
        return this.enhancers.interaction.integrateHammer?.(hammer, config) || false;
    }
    
    // === パフォーマンス監視（修正版・メモリリーク対策） ===
    
    startPerformanceMonitoring() {
        // 既存監視停止
        this.stopPerformanceMonitoring();
        
        this.performanceMonitor = {
            startTime: performance.now(),
            frameCount: 0,
            strokeCount: 0,
            memoryUsage: 0,
            peakMemory: 0
        };
        
        // 軽量化された監視ループ（5秒間隔）
        this.performanceInterval = setInterval(() => {
            this.updatePerformanceMetrics();
        }, this.performanceConfig.interval);
        
        return this.performanceMonitor;
    }
    
    // パフォーマンス指標更新（最適化版）
    updatePerformanceMetrics() {
        const stats = this.getStats();
        const now = performance.now();
        
        this.performanceMonitor.frameCount = stats.fps;
        this.performanceMonitor.strokeCount = stats.strokeCount;
        
        // メモリチェック（30秒間隔）
        if (now - this.performanceConfig.lastMemoryCheck > this.performanceConfig.memoryCheckInterval) {
            this.updateMemoryMetrics();
            this.performanceConfig.lastMemoryCheck = now;
        }
        
        // パフォーマンス警告（閾値ベース）
        this.checkPerformanceWarnings(stats);
        
        // イベント通知（throttle内蔵）
        this.core.emit('performance.update', {
            ...this.performanceMonitor,
            timestamp: now
        });
    }
    
    // メモリ指標更新（効率化）
    updateMemoryMetrics() {
        const memoryInfo = performance.memory;
        if (!memoryInfo) return;
        
        const currentMemory = Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024);
        this.performanceMonitor.memoryUsage = currentMemory;
        
        if (currentMemory > this.performanceMonitor.peakMemory) {
            this.performanceMonitor.peakMemory = currentMemory;
        }
    }
    
    // パフォーマンス警告チェック（軽量化）
    checkPerformanceWarnings(stats) {
        // FPS警告（30FPS以下）
        if (stats.fps < 30) {
            console.warn('Low FPS detected:', stats.fps);
        }
        
        // メモリ警告（150MB以上）
        if (this.performanceMonitor.memoryUsage > 150) {
            console.warn('High memory usage:', this.performanceMonitor.memoryUsage, 'MB');
        }
        
        // ストローク数警告（1000以上）
        if (stats.strokeCount > 1000) {
            console.warn('High stroke count:', stats.strokeCount);
        }
    }
    
    // パフォーマンス監視停止
    stopPerformanceMonitoring() {
        if (this.performanceInterval) {
            clearInterval(this.performanceInterval);
            this.performanceInterval = null;
        }
        this.performanceMonitor = null;
    }
    
    // クリーンアップ（完全版・メモリリーク対策）
    destroy() {
        // パフォーマンス監視停止
        this.stopPerformanceMonitoring();
        
        // Enhancer群クリーンアップ
        Object.values(this.enhancers).forEach(enhancer => {
            if (enhancer?.destroy) {
                try {
                    enhancer.destroy();
                } catch (error) {
                    console.warn('Enhancer cleanup failed:', error);
                }
            }
        });
        
        // ライブラリ統合クリーンアップ
        this.colorSystem = null;
        this.utilitySystem = null;
        
        // コアクリーンアップ
        if (this.core?.destroy) {
            this.core.destroy();
        }
        
        // 参照完全クリア
        this.enhancers = {};
        this.core = null;
        this.performanceConfig = null;
    }
}