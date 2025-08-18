/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.5
 * 🎯 AI_WORK_SCOPE: API統一・外部アクセス用統一インターフェース
 * 🔧 Phase1.5-Step2: APIGateway クラス実装
 * 🚨 PURE_JAVASCRIPT: ES6モジュール禁止・グローバル変数使用
 * 
 * 📋 PHASE_TARGET: Phase1.5 API統一
 * 📋 V8_MIGRATION: API互換性保持
 * 📋 DRY_COMPLIANCE: 重複API完全排除
 * 📋 SOLID_COMPLIANCE: 統一インターフェース・依存性逆転
 */

class APIGateway {
    constructor(futabaDrawingTool) {
        this.version = 'v1.5-APIGateway';
        this.app = futabaDrawingTool;
        this.initialized = false;
        this.apiCallLog = [];
        this.deprecatedCalls = new Map();
        
        // 🎯 統一API - 同じ機能は1つのAPIでのみ提供
        this.apiRegistry = new Map();
        
        this.setupAPIRegistry();
        console.log('🌐 APIGateway 初期化完了 - API統一実装');
    }
    
    /**
     * APIGateway初期化
     */
    initialize() {
        if (this.initialized) {
            console.warn('⚠️ APIGateway は既に初期化済みです');
            return true;
        }
        
        try {
            // 依存関係確認
            if (!this.app || !this.app.appCore) {
                throw new Error('FutabaDrawingTool または AppCore が初期化されていません');
            }
            
            // 後方互換性API設定
            this.setupBackwardCompatibility();
            
            // APIログ設定
            this.setupAPILogging();
            
            this.initialized = true;
            console.log('✅ APIGateway 初期化完了 - 統一API提供開始');
            return true;
            
        } catch (error) {
            console.error('❌ APIGateway 初期化失敗:', error);
            return false;
        }
    }
    
    /**
     * API登録システム設定
     */
    setupAPIRegistry() {
        // 🎨 ツール制御API群
        this.apiRegistry.set('tools', {
            selectTool: this.selectTool.bind(this),
            getCurrentTool: this.getCurrentTool.bind(this),
            getAvailableTools: this.getAvailableTools.bind(this)
        });
        
        // 🎚️ ブラシ設定API群
        this.apiRegistry.set('brush', {
            setBrushSize: this.setBrushSize.bind(this),
            getBrushSize: this.getBrushSize.bind(this),
            setBrushOpacity: this.setBrushOpacity.bind(this),
            getBrushOpacity: this.getBrushOpacity.bind(this),
            setBrushColor: this.setBrushColor.bind(this),
            getBrushColor: this.getBrushColor.bind(this)
        });
        
        // 📐 キャンバス制御API群
        this.apiRegistry.set('canvas', {
            resizeCanvas: this.resizeCanvas.bind(this),
            getCanvasSize: this.getCanvasSize.bind(this),
            clearCanvas: this.clearCanvas.bind(this),
            centerContent: this.centerContent.bind(this)
        });
        
        // 📊 状態取得API群
        this.apiRegistry.set('state', {
            getState: this.getState.bind(this),
            getPerformanceStats: this.getPerformanceStats.bind(this),
            getDebugInfo: this.getDebugInfo.bind(this)
        });
        
        // 🔧 システム制御API群
        this.apiRegistry.set('system', {
            initialize: this.initializeSystem.bind(this),
            reset: this.resetSystem.bind(this),
            diagnose: this.diagnose.bind(this)
        });
    }
    
    // ===========================================
    // 🎨 ツール制御（統一API）
    // ===========================================
    
    /**
     * ツール選択（統一処理）
     * UI更新・イベント発火・状態管理を含む
     */
    selectTool(toolName) {
        this.logAPICall('selectTool', { toolName });
        
        try {
            if (!this.validateToolName(toolName)) {
                throw new Error(`無効なツール名: ${toolName}`);
            }
            
            // AppCore ToolSystem経由で選択（統一処理）
            const result = this.app.appCore.toolSystem?.setTool(toolName);
            
            if (result !== false) {
                // UI更新（統一処理）
                this.updateToolUI(toolName);
                
                // ステータス更新
                this.updateToolStatus(toolName);
                
                // イベント発火
                this.notifyToolChange(toolName);
                
                console.log(`✅ ツール選択完了: ${toolName}`);
                return { success: true, tool: toolName };
            } else {
                throw new Error(`ツール選択失敗: ${toolName}`);
            }
            
        } catch (error) {
            console.error(`❌ ツール選択エラー (${toolName}):`, error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * 現在のツール取得
     */
    getCurrentTool() {
        this.logAPICall('getCurrentTool');
        
        try {
            const currentTool = this.app.appCore.toolSystem?.currentTool || 'unknown';
            return { success: true, tool: currentTool };
        } catch (error) {
            console.error('❌ 現在ツール取得エラー:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * 利用可能ツール一覧取得
     */
    getAvailableTools() {
        this.logAPICall('getAvailableTools');
        
        try {
            // ConfigManagerから取得（統一）
            const availableTools = window.configManager?.get('tools.availableTools') || ['pen', 'eraser'];
            return { success: true, tools: availableTools };
        } catch (error) {
            console.error('❌ 利用可能ツール取得エラー:', error);
            return { success: false, error: error.message };
        }
    }
    
    // ===========================================
    // 🎚️ ブラシ設定（統一API）
    // ===========================================
    
    /**
     * ブラシサイズ設定（統一処理）
     * ToolSystem更新・UI更新・設定保存を含む
     */
    setBrushSize(size) {
        this.logAPICall('setBrushSize', { size });
        
        try {
            // 値検証
            if (!this.validateBrushSize(size)) {
                throw new Error(`無効なブラシサイズ: ${size}`);
            }
            
            // ToolSystem更新
            if (this.app.appCore.toolSystem) {
                this.app.appCore.toolSystem.setBrushSize(size);
            }
            
            // ConfigManager更新（統一処理）
            if (window.configManager) {
                window.configManager.set('brush.defaultSize', size);
            }
            
            // UI更新（統一処理）
            this.updateBrushSizeUI(size);
            
            // プリセット更新
            this.updateSizePresets(size);
            
            console.log(`✅ ブラシサイズ設定完了: ${size}px`);
            return { success: true, size };
            
        } catch (error) {
            console.error(`❌ ブラシサイズ設定エラー (${size}):`, error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * ブラシサイズ取得
     */
    getBrushSize() {
        this.logAPICall('getBrushSize');
        
        try {
            const size = this.app.appCore.toolSystem?.brushSize || 
                        window.configManager?.get('brush.defaultSize') || 16.0;
            return { success: true, size };
        } catch (error) {
            console.error('❌ ブラシサイズ取得エラー:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * ブラシ不透明度設定（統一処理）
     */
    setBrushOpacity(opacity) {
        this.logAPICall('setBrushOpacity', { opacity });
        
        try {
            // 値検証
            if (!this.validateBrushOpacity(opacity)) {
                throw new Error(`無効な不透明度: ${opacity}`);
            }
            
            // ToolSystem更新
            if (this.app.appCore.toolSystem) {
                this.app.appCore.toolSystem.setBrushOpacity(opacity);
            }
            
            // ConfigManager更新
            if (window.configManager) {
                window.configManager.set('brush.defaultOpacity', opacity);
            }
            
            // UI更新
            this.updateBrushOpacityUI(opacity);
            
            console.log(`✅ ブラシ不透明度設定完了: ${(opacity * 100).toFixed(1)}%`);
            return { success: true, opacity };
            
        } catch (error) {
            console.error(`❌ ブラシ不透明度設定エラー (${opacity}):`, error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * ブラシ不透明度取得
     */
    getBrushOpacity() {
        this.logAPICall('getBrushOpacity');
        
        try {
            const opacity = this.app.appCore.toolSystem?.brushOpacity || 
                           window.configManager?.get('brush.defaultOpacity') || 0.85;
            return { success: true, opacity };
        } catch (error) {
            console.error('❌ ブラシ不透明度取得エラー:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * ブラシ色設定（統一処理）
     */
    setBrushColor(color) {
        this.logAPICall('setBrushColor', { color });
        
        try {
            // 色形式正規化
            const normalizedColor = this.normalizeColor(color);
            if (!normalizedColor) {
                throw new Error(`無効な色: ${color}`);
            }
            
            // ToolSystem更新
            if (this.app.appCore.toolSystem) {
                this.app.appCore.toolSystem.setBrushColor(normalizedColor.hex);
            }
            
            // ConfigManager更新
            if (window.configManager) {
                window.configManager.set('brush.defaultColor', normalizedColor.pixi);
                window.configManager.set('brush.defaultColorHex', normalizedColor.hex);
            }
            
            // UI更新
            this.updateBrushColorUI(normalizedColor.hex);
            
            console.log(`✅ ブラシ色設定完了: ${normalizedColor.hex}`);
            return { success: true, color: normalizedColor };
            
        } catch (error) {
            console.error(`❌ ブラシ色設定エラー (${color}):`, error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * ブラシ色取得
     */
    getBrushColor() {
        this.logAPICall('getBrushColor');
        
        try {
            const hexColor = window.configManager?.get('brush.defaultColorHex') || '#800000';
            const pixiColor = window.configManager?.get('brush.defaultColor') || 0x800000;
            
            return { 
                success: true, 
                color: { 
                    hex: hexColor, 
                    pixi: pixiColor 
                } 
            };
        } catch (error) {
            console.error('❌ ブラシ色取得エラー:', error);
            return { success: false, error: error.message };
        }
    }
    
    // ===========================================
    // 📐 キャンバス制御（統一API）
    // ===========================================
    
    /**
     * キャンバスリサイズ（統一処理）
     */
    resizeCanvas(width, height, centerContent = false) {
        this.logAPICall('resizeCanvas', { width, height, centerContent });
        
        try {
            // 値検証
            if (!this.validateCanvasSize(width, height)) {
                throw new Error(`無効なキャンバスサイズ: ${width}x${height}`);
            }
            
            // AppCore経由でリサイズ（統一処理）
            const result = this.app.appCore.resize(width, height, centerContent);
            
            if (result !== false) {
                // ConfigManager更新
                if (window.configManager) {
                    window.configManager.updateMultiple({
                        'canvas.defaultWidth': width,
                        'canvas.defaultHeight': height
                    });
                }
                
                // UI更新
                this.updateCanvasSizeUI(width, height);
                
                console.log(`✅ キャンバスリサイズ完了: ${width}x${height}px (中央寄せ: ${centerContent})`);
                return { success: true, width, height, centerContent };
            } else {
                throw new Error('キャンバスリサイズ処理失敗');
            }
            
        } catch (error) {
            console.error(`❌ キャンバスリサイズエラー (${width}x${height}):`, error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * キャンバスサイズ取得
     */
    getCanvasSize() {
        this.logAPICall('getCanvasSize');
        
        try {
            const width = this.app.appCore.canvasWidth || window.configManager?.get('canvas.defaultWidth') || 400;
            const height = this.app.appCore.canvasHeight || window.configManager?.get('canvas.defaultHeight') || 400;
            
            return { success: true, width, height };
        } catch (error) {
            console.error('❌ キャンバスサイズ取得エラー:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * キャンバスクリア
     */
    clearCanvas() {
        this.logAPICall('clearCanvas');
        
        try {
            if (this.app.appCore.clearCanvas) {
                this.app.appCore.clearCanvas();
                console.log('✅ キャンバスクリア完了');
                return { success: true };
            } else {
                throw new Error('キャンバスクリア機能が利用できません');
            }
        } catch (error) {
            console.error('❌ キャンバスクリアエラー:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * コンテンツ中央寄せ
     */
    centerContent() {
        this.logAPICall('centerContent');
        
        try {
            if (this.app.appCore.centerContent) {
                this.app.appCore.centerContent();
                console.log('✅ コンテンツ中央寄せ完了');
                return { success: true };
            } else {
                // フォールバック実装
                const canvasSize = this.getCanvasSize();
                if (canvasSize.success) {
                    return this.resizeCanvas(canvasSize.width, canvasSize.height, true);
                }
                throw new Error('コンテンツ中央寄せ機能が利用できません');
            }
        } catch (error) {
            console.error('❌ コンテンツ中央寄せエラー:', error);
            return { success: false, error: error.message };
        }
    }
    
    // ===========================================
    // 📊 状態取得（統一API）
    // ===========================================
    
    /**
     * アプリケーション状態取得（統一処理）
     */
    getState() {
        this.logAPICall('getState');
        
        try {
            const baseState = this.app.getAppState();
            
            // APIGateway固有情報追加
            const gatewayState = {
                apiGateway: {
                    version: this.version,
                    initialized: this.initialized,
                    totalAPICalls: this.apiCallLog.length,
                    deprecatedCalls: this.deprecatedCalls.size,
                    availableAPIs: Array.from(this.apiRegistry.keys())
                }
            };
            
            return { 
                success: true, 
                state: { ...baseState, ...gatewayState }
            };
        } catch (error) {
            console.error('❌ 状態取得エラー:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * パフォーマンス統計取得
     */
    getPerformanceStats() {
        this.logAPICall('getPerformanceStats');
        
        try {
            const stats = {
                memory: performance.memory ? {
                    used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB',
                    total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + 'MB',
                    limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) + 'MB'
                } : 'N/A',
                timing: performance.timing ? {
                    loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart + 'ms'
                } : 'N/A',
                fps: this.app.appCore.performanceMonitor?.getCurrentFPS() || 'N/A',
                apiCalls: {
                    total: this.apiCallLog.length,
                    recent: this.apiCallLog.slice(-10)
                }
            };
            
            return { success: true, stats };
        } catch (error) {
            console.error('❌ パフォーマンス統計取得エラー:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * デバッグ情報取得（統一処理）
     */
    getDebugInfo() {
        this.logAPICall('getDebugInfo');
        
        try {
            const debugInfo = {
                versions: {
                    apiGateway: this.version,
                    app: this.app.version,
                    pixi: window.PIXI?.VERSION || 'N/A'
                },
                dependencies: {
                    PIXI: typeof window.PIXI !== 'undefined',
                    AppCore: !!this.app.appCore,
                    ConfigManager: typeof window.ConfigManager !== 'undefined',
                    PixiExtensions: typeof window.PixiExtensions !== 'undefined'
                },
                apis: {
                    registered: Object.fromEntries(this.apiRegistry),
                    callLog: this.apiCallLog.slice(-20),
                    deprecatedCalls: Object.fromEntries(this.deprecatedCalls)
                },
                config: window.configManager?.getDebugInfo() || 'ConfigManager not available'
            };
            
            return { success: true, debugInfo };
        } catch (error) {
            console.error('❌ デバッグ情報取得エラー:', error);
            return { success: false, error: error.message };
        }
    }
    
    // ===========================================
    // 🔧 システム制御（統一API）
    // ===========================================
    
    /**
     * システム初期化
     */
    initializeSystem() {
        this.logAPICall('initializeSystem');
        
        try {
            // AppCore再初期化
            if (this.app.appCore && this.app.appCore.initialize) {
                this.app.appCore.initialize();
            }
            
            // ConfigManager初期化
            if (window.configManager && window.configManager.initialize) {
                window.configManager.initialize();
            }
            
            console.log('✅ システム初期化完了');
            return { success: true };
        } catch (error) {
            console.error('❌ システム初期化エラー:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * システムリセット
     */
    resetSystem() {
        this.logAPICall('resetSystem');
        
        try {
            // 設定リセット
            if (window.configManager && window.configManager.reset) {
                window.configManager.reset();
            }
            
            // キャンバスクリア
            this.clearCanvas();
            
            // ツール初期化
            this.selectTool('pen');
            
            console.log('✅ システムリセット完了');
            return { success: true };
        } catch (error) {
            console.error('❌ システムリセットエラー:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * システム診断（統一処理）
     */
    diagnose() {
        this.logAPICall('diagnose');
        
        try {
            const diagnosis = {
                dependencies: this.checkDependencies(),
                performance: this.getPerformanceStats(),
                errors: this.getErrorLog(),
                apis: this.validateAPIs(),
                recommendations: this.getRecommendations()
            };
            
            return { success: true, diagnosis };
        } catch (error) {
            console.error('❌ システム診断エラー:', error);
            return { success: false, error: error.message };
        }
    }
    
    // ===========================================
    // 🔧 内部ヘルパー関数群
    // ===========================================
    
    /**
     * ツール名検証
     */
    validateToolName(toolName) {
        const availableTools = window.configManager?.get('tools.availableTools') || ['pen', 'eraser'];
        return typeof toolName === 'string' && availableTools.includes(toolName);
    }
    
    /**
     * ブラシサイズ検証
     */
    validateBrushSize(size) {
        const minSize = window.configManager?.get('brush.minSize') || 0.1;
        const maxSize = window.configManager?.get('brush.maxSize') || 100.0;
        return typeof size === 'number' && size >= minSize && size <= maxSize;
    }
    
    /**
     * ブラシ不透明度検証
     */
    validateBrushOpacity(opacity) {
        return typeof opacity === 'number' && opacity >= 0.0 && opacity <= 1.0;
    }
    
    /**
     * キャンバスサイズ検証
     */
    validateCanvasSize(width, height) {
        const minWidth = window.configManager?.get('canvas.minWidth') || 100;
        const maxWidth = window.configManager?.get('canvas.maxWidth') || 4096;
        const minHeight = window.configManager?.get('canvas.minHeight') || 100;
        const maxHeight = window.configManager?.get('canvas.maxHeight') || 4096;
        
        return Number.isInteger(width) && Number.isInteger(height) &&
               width >= minWidth && width <= maxWidth &&
               height >= minHeight && height <= maxHeight;
    }
    
    /**
     * 色正規化
     */
    normalizeColor(color) {
        try {
            if (typeof color === 'number') {
                // PIXI形式 (0x800000)
                const hex = '#' + color.toString(16).padStart(6, '0');
                return { pixi: color, hex };
            } else if (typeof color === 'string') {
                if (color.startsWith('#') && color.length === 7) {
                    // HEX形式 (#800000)
                    const pixi = parseInt(color.substring(1), 16);
                    return { pixi, hex: color };
                }
            }
            return null;
        } catch (error) {
            return null;
        }
    }
    
    /**
     * ツールUI更新
     */
    updateToolUI(toolName) {
        // アクティブツール表示更新
        document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
        
        const toolButton = document.getElementById(`${toolName}-tool`);
        if (toolButton) {
            toolButton.classList.add('active');
        }
    }
    
    /**
     * ツールステータス更新
     */
    updateToolStatus(toolName) {
        const toolNameMap = {
            'pen': 'ベクターペン',
            'eraser': '消しゴム',
            'fill': '塗りつぶし',
            'select': '範囲選択'
        };
        
        const currentToolElement = document.getElementById('current-tool');
        if (currentToolElement) {
            currentToolElement.textContent = toolNameMap[toolName] || toolName;
        }
    }
    
    /**
     * ツール変更通知
     */
    notifyToolChange(toolName) {
        // カスタムイベント発火
        const event = new CustomEvent('toolChanged', { detail: { tool: toolName } });
        document.dispatchEvent(event);
    }
    
    /**
     * ブラシサイズUI更新
     */
    updateBrushSizeUI(size) {
        // スライダー値表示更新
        const sizeValueElement = document.getElementById('pen-size-value');
        if (sizeValueElement) {
            sizeValueElement.textContent = `${size.toFixed(1)}px`;
        }
        
        // スライダーハンドル位置更新
        this.updateSliderPosition('pen-size-slider', size, 
            window.configManager?.get('brush.minSize') || 0.1,
            window.configManager?.get('brush.maxSize') || 100.0
        );
    }
    
    /**
     * サイズプリセット更新
     */
    updateSizePresets(size) {
        if (window.configManager) {
            window.configManager.syncPresetSizes();
        }
    }
    
    /**
     * ブラシ不透明度UI更新
     */
    updateBrushOpacityUI(opacity) {
        const opacityValueElement = document.getElementById('pen-opacity-value');
        if (opacityValueElement) {
            opacityValueElement.textContent = `${(opacity * 100).toFixed(1)}%`;
        }
        
        this.updateSliderPosition('pen-opacity-slider', opacity, 0.0, 1.0);
    }
    
    /**
     * ブラシ色UI更新
     */
    updateBrushColorUI(hexColor) {
        const currentColorElement = document.getElementById('current-color');
        if (currentColorElement) {
            currentColorElement.textContent = hexColor;
        }
        
        // プリセットアイテムの色更新
        document.querySelectorAll('.size-preview-circle').forEach(circle => {
            circle.style.background = hexColor;
        });
    }
    
    /**
     * キャンバスサイズUI更新
     */
    updateCanvasSizeUI(width, height) {
        // ステータス表示更新
        const canvasInfo = document.getElementById('canvas-info');
        if (canvasInfo) {
            canvasInfo.textContent = `${width}×${height}px`;
        }
        
        // 入力フィールド更新
        const widthInput = document.getElementById('canvas-width');
        const heightInput = document.getElementById('canvas-height');
        if (widthInput) widthInput.value = width;
        if (heightInput) heightInput.value = height;
    }
    
    /**
     * スライダー位置更新
     */
    updateSliderPosition(sliderId, value, min, max) {
        const slider = document.getElementById(sliderId);
        if (slider) {
            const handle = slider.querySelector('.slider-handle');
            const track = slider.querySelector('.slider-track');
            
            if (handle && track) {
                const percentage = ((value - min) / (max - min)) * 100;
                handle.style.left = `${Math.max(0, Math.min(100, percentage))}%`;
            }
        }
    }
    
    /**
     * 依存関係チェック
     */
    checkDependencies() {
        return {
            PIXI: {
                available: typeof window.PIXI !== 'undefined',
                version: window.PIXI?.VERSION || 'N/A'
            },
            AppCore: {
                available: !!this.app?.appCore,
                initialized: !!this.app?.appCore?.isInitialized
            },
            ConfigManager: {
                available: typeof window.ConfigManager !== 'undefined',
                initialized: !!window.configManager?.initialized
            },
            PixiExtensions: {
                available: typeof window.PixiExtensions !== 'undefined',
                initialized: !!window.PixiExtensions?.initialized
            }
        };
    }
    
    /**
     * API検証
     */
    validateAPIs() {
        const results = {};
        
        this.apiRegistry.forEach((apis, category) => {
            results[category] = {};
            Object.keys(apis).forEach(apiName => {
                try {
                    results[category][apiName] = typeof apis[apiName] === 'function';
                } catch (error) {
                    results[category][apiName] = false;
                }
            });
        });
        
        return results;
    }
    
    /**
     * エラーログ取得
     */
    getErrorLog() {
        return this.app?.errorLog || [];
    }
    
    /**
     * 推奨事項取得
     */
    getRecommendations() {
        const recommendations = [];
        const deps = this.checkDependencies();
        
        if (!deps.PIXI.available) {
            recommendations.push('PixiJS が読み込まれていません');
        }
        if (!deps.AppCore.available) {
            recommendations.push('AppCore が初期化されていません');
        }
        if (!deps.ConfigManager.available) {
            recommendations.push('ConfigManager の実装を推奨します');
        }
        
        if (this.apiCallLog.length === 0) {
            recommendations.push('API使用状況を監視中です');
        }
        
        return recommendations;
    }
    
    /**
     * APIコールログ
     */
    logAPICall(method, params = null) {
        const logEntry = {
            timestamp: Date.now(),
            method,
            params,
            caller: (new Error()).stack?.split('\n')[3]?.trim()
        };
        
        this.apiCallLog.push(logEntry);
        
        // ログサイズ制限
        if (this.apiCallLog.length > 1000) {
            this.apiCallLog = this.apiCallLog.slice(-500);
        }
        
        console.log(`🌐 API: ${method}`, params || '');
    }
    
    /**
     * 後方互換性API設定
     */
    setupBackwardCompatibility() {
        const deprecatedMethods = {
            // 旧getAppState → 新getState
            'getAppState': () => {
                this.recordDeprecatedCall('getAppState', 'getState');
                return this.getState();
            },
            
            // 旧ツール選択メソッド群 → 新selectTool
            'selectPenTool': () => {
                this.recordDeprecatedCall('selectPenTool', 'selectTool("pen")');
                return this.selectTool('pen');
            },
            'selectEraserTool': () => {
                this.recordDeprecatedCall('selectEraserTool', 'selectTool("eraser")');
                return this.selectTool('eraser');
            },
            
            // 旧ブラシサイズメソッド群 → 新setBrushSize
            'updateBrushSize': (size) => {
                this.recordDeprecatedCall('updateBrushSize', 'setBrushSize');
                return this.setBrushSize(size);
            },
            'changeBrushSize': (size) => {
                this.recordDeprecatedCall('changeBrushSize', 'setBrushSize');
                return this.setBrushSize(size);
            }
        };
        
        // 旧APIをグローバルに公開（deprecation warning付き）
        Object.entries(deprecatedMethods).forEach(([oldMethod, newImplementation]) => {
            window[oldMethod] = newImplementation;
        });
        
        console.log(`✅ 後方互換性API設定完了: ${Object.keys(deprecatedMethods).length}個のdeprecated method`);
    }
    
    /**
     * 非推奨API使用記録
     */
    recordDeprecatedCall(oldMethod, newMethod) {
        if (!this.deprecatedCalls.has(oldMethod)) {
            this.deprecatedCalls.set(oldMethod, { count: 0, newMethod, firstCall: Date.now() });
        }
        
        this.deprecatedCalls.get(oldMethod).count++;
        
        console.warn(`⚠️ 非推奨API使用: ${oldMethod}() は廃止予定です。${newMethod}() を使用してください`);
    }
    
    /**
     * APIログ設定
     */
    setupAPILogging() {
        if (window.configManager?.get('debug.performanceLogging')) {
            // パフォーマンスログ有効時のみ詳細ログ
            this.detailedLogging = true;
        }
        
        console.log('✅ APIログ設定完了');
    }
}

// グローバル公開
window.APIGateway = APIGateway;

// 使用例とテスト
console.log('📋 APIGateway 使用例:');
console.log('  const gateway = new APIGateway(futabaDrawingTool);');
console.log('  gateway.initialize();');
console.log('  gateway.selectTool("pen")         // ツール選択');
console.log('  gateway.setBrushSize(24.0)        // ブラシサイズ');
console.log('  gateway.resizeCanvas(800, 600)    // キャンバスリサイズ');
console.log('  gateway.getState()                // 状態取得');
console.log('  gateway.diagnose()                // システム診断');
console.log('🌐 ふたば☆お絵描きツール v1.5 - APIGateway実装完了');