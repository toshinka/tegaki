/**
 * 🔧 ConfigManager - PixiJS v8対応設定管理（WebGPU・Container階層・高精度設定）
 * ChangeLog: 2025-09-01 <Step1 Fix - Added missing configure(), attach(), init() methods for Manager lifecycle>
 * 
 * @provides
 *   - ConfigManager（クラス）
 *   - configure(config)          // 同期：設定注入（必須ライフサイクル）
 *   - attach(context)            // 同期：参照注入（必須ライフサイクル）
 *   - init() -> Promise          // 非同期：内部初期化（必須ライフサイクル）
 *   - isReady() -> boolean       // 同期：準備完了判定（必須ライフサイクル）
 *   - dispose()                  // 同期：解放（必須ライフサイクル）
 *   - getCanvasConfigV8() - v8キャンバス設定・WebGPU対応・高精度レンダリング
 *   - getV8RendererConfig() - v8レンダラー設定・WebGPU優先・高性能設定
 *   - getV8ToolConfig(toolName) - v8ツール設定・リアルタイム描画・高精度
 *   - getV8ContainerConfig() - v8 Container階層設定・zIndex・マスク・フィルター
 *   - getV8PerformanceConfig() - v8性能設定・WebGPU最適化・高速化
 *   - updateV8Config(section, updates) - v8設定更新・動的変更対応
 *   - getV8DebugConfig() - v8デバッグ設定・WebGPU情報・統計情報
 *   - getV8Color(colorName) - v8色定義取得
 *   - getAllV8Colors() - v8全色取得
 *   - getWebGPUConfig() - WebGPU対応設定取得
 *   - validateV8Config() - v8設定バリデーション
 *   - generateOptimizedV8Config(webgpuSupported) - v8環境最適化設定生成
 *   - getV8DebugInfo() - v8デバッグ情報取得
 * 
 * @uses
 *   - window.devicePixelRatio - デバイス解像度取得（Browser API）
 *   - console.log/warn - ログ出力（Browser API）
 *   - Object.assign/keys/values/entries - オブジェクト操作（JavaScript標準）
 *   - JSON.parse/stringify - JSON処理（JavaScript標準）
 * 
 * @initflow
 *   1. ConfigManager.configure(config) → 設定注入
 *   2. ConfigManager.attach(context) → 参照注入
 *   3. ConfigManager.init() → 内部初期化・設定バリデーション
 *   4. isReady() === true → 他Managerから利用可能
 * 
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 フォールバック禁止
 *   🚫 UI操作・描画処理・Manager作成禁止
 *   🚫 v7互換設定の継続使用禁止
 * 
 * @manager-key
 *   - window.Tegaki.ConfigManagerInstance
 * 
 * @dependencies-strict
 *   - 必須: なし（設定提供のため単独動作）
 *   - オプション: なし
 *   - 禁止: 他Manager依存（設定提供者のため）
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

/**
 * ConfigManager - PixiJS v8対応設定管理
 * WebGPU・Container階層・高精度レンダリング対応
 */
class ConfigManager {
    constructor() {
        console.log('🔧 ConfigManager v8対応版 作成');
        
        // Manager共通ライフサイクル用状態
        this._status = {
            ready: false,
            error: null,
            initialized: false
        };
        this._config = null;
        this._context = null;
        
        // v8基本設定
        this.v8Config = {
            // v8キャンバス設定（WebGPU対応）
            canvas: {
                width: 800,                              // キャンバス幅
                height: 600,                             // キャンバス高さ
                backgroundColor: 0xf0e0d6,               // ふたばクリーム色
                backgroundAlpha: 1.0,                    // 不透明
                antialias: true,                         // アンチエイリアス有効
                resolution: window.devicePixelRatio || 1, // 高解像度対応
                powerPreference: 'high-performance',      // 高性能モード
                clearBeforeRender: true,                 // レンダリング前クリア
                preserveDrawingBuffer: false             // 描画バッファ保持無効（性能優先）
            },
            
            // v8レンダラー設定（WebGPU優先）
            renderer: {
                preference: 'webgpu',                    // WebGPU優先
                fallbackPreference: 'webgl',             // フォールバック: WebGL
                powerPreference: 'high-performance',     // 高性能GPU使用
                antialias: true,                         // アンチエイリアス
                premultipliedAlpha: true,                // プリマルチプライドアルファ
                preserveDrawingBuffer: false,            // 描画バッファ保持無効
                failIfMajorPerformanceCaveat: false      // 性能警告でも続行
            },
            
            // v8 Container階層設定
            container: {
                sortableChildren: true,                  // 子要素自動ソート有効
                interactiveChildren: true,               // 子要素インタラクティブ
                enableTempDisplayObjectParent: true,     // 一時親要素有効
                defaultZIndex: 0,                        // デフォルトzIndex
                layerSeparation: 100                     // レイヤー間隔
            },
            
            // v8ツール設定（リアルタイム描画対応）
            tools: {
                pen: {
                    color: 0x800000,                     // ふたば風マルーン
                    lineWidth: 4,                        // デフォルト線幅
                    opacity: 1.0,                        // 不透明度
                    cap: 'round',                        // v8: stroke cap
                    join: 'round',                       // v8: stroke join
                    realtimeMode: true,                  // リアルタイム描画
                    smoothing: true,                     // スムージング
                    highPrecision: true,                 // 高精度モード
                    webgpuOptimized: true                // WebGPU最適化
                },
                
                eraser: {
                    size: 20,                            // デフォルト消しゴムサイズ
                    opacity: 1.0,                        // 消去強度
                    mode: 'pixel',                       // 'pixel' | 'object' | 'layer'
                    smoothing: true,                     // スムーズ消去
                    v8Accelerated: true,                 // v8加速処理
                    webgpuOptimized: true                // WebGPU最適化
                }
            },
            
            // v8性能設定
            performance: {
                targetFPS: 60,                           // 目標FPS
                maxDeltaTime: 1000/30,                   // 最大デルタタイム
                autoResize: true,                        // 自動リサイズ
                roundPixels: true,                       // ピクセル丸め
                batchSize: 4096,                         // バッチサイズ
                webgpuBatchSize: 8192,                   // WebGPU用バッチサイズ
                useSharedArrayBuffer: true,              // SharedArrayBuffer使用
                enableOffscreenCanvas: true              // OffscreenCanvas有効
            },
            
            // v8デバッグ設定
            debug: {
                showFPS: true,                           // FPS表示
                showMemory: true,                        // メモリ使用量表示
                showCoordinates: true,                   // 座標表示
                showRenderer: true,                      // レンダラー情報表示
                showWebGPUInfo: true,                    // WebGPU情報表示
                showContainerInfo: true,                 // Container情報表示
                verboseLogging: true,                    // 詳細ログ
                performanceMonitoring: true              // 性能監視
            }
        };
        
        // ふたば色定義（v8対応）
        this.v8Colors = {
            futabaMaroon: 0x800000,                      // #800000 - メインマルーン
            futabaLightMaroon: 0xaa5a56,                 // #aa5a56 - ライトマルーン
            futabaMedium: 0xcf9c97,                      // #cf9c97 - ミディアム
            futabaLightMedium: 0xe9c2ba,                 // #e9c2ba - ライトミディアム
            futabaCream: 0xf0e0d6,                       // #f0e0d6 - クリーム（キャンバス背景）
            futabaBackground: 0xffffee,                  // #ffffee - 背景
            textPrimary: 0x2c1810,                       // #2c1810 - メインテキスト
            textSecondary: 0x5d4037,                     // #5d4037 - セカンダリテキスト
            textInverse: 0xffffff,                       // #ffffff - 逆転テキスト
            v8Highlight: 0x4CAF50,                       // #4CAF50 - v8機能ハイライト
            webgpuActive: 0x2196F3,                      // #2196F3 - WebGPU有効色
            webglFallback: 0xFF9800                      // #FF9800 - WebGL フォールバック色
        };
    }
    
    // ========================================
    // Manager統一ライフサイクル（必須実装）
    // ========================================
    
    /**
     * 設定注入（Manager統一ライフサイクル）
     */
    configure(config = {}) {
        try {
            this._config = config;
            
            // 設定をv8Configにマージ
            if (config.canvas) {
                Object.assign(this.v8Config.canvas, config.canvas);
            }
            if (config.renderer) {
                Object.assign(this.v8Config.renderer, config.renderer);
            }
            if (config.tools) {
                Object.assign(this.v8Config.tools, config.tools);
            }
            
            console.log('🔧 ConfigManager: configure() 完了');
            return true;
            
        } catch (error) {
            this._status.error = error.message;
            console.error('💀 ConfigManager: configure() エラー:', error.message);
            return false;
        }
    }
    
    /**
     * 参照注入（Manager統一ライフサイクル）
     */
    attach(context = {}) {
        try {
            this._context = context;
            console.log('🔧 ConfigManager: attach() 完了');
            return true;
            
        } catch (error) {
            this._status.error = error.message;
            console.error('💀 ConfigManager: attach() エラー:', error.message);
            return false;
        }
    }
    
    /**
     * 内部初期化（Manager統一ライフサイクル）
     */
    async init() {
        try {
            // 設定バリデーション実行
            const validationErrors = this.validateV8Config();
            if (validationErrors.length > 0) {
                console.warn('⚠️ ConfigManager: 設定検証で警告:', validationErrors);
            }
            
            this._status.initialized = true;
            this._status.ready = true;
            this._status.error = null;
            
            console.log('✅ ConfigManager: init() 完了');
            
        } catch (error) {
            this._status.error = error.message;
            this._status.ready = false;
            console.error('💀 ConfigManager: init() エラー:', error.message);
            throw error;
        }
    }
    
    /**
     * 準備完了判定（Manager統一ライフサイクル）
     */
    isReady() {
        return this._status.ready && this._status.initialized;
    }
    
    /**
     * 解放（Manager統一ライフサイクル）
     */
    dispose() {
        try {
            this._config = null;
            this._context = null;
            this._status = {
                ready: false,
                error: null,
                initialized: false
            };
            
            console.log('🔧 ConfigManager: dispose() 完了');
            
        } catch (error) {
            console.error('💀 ConfigManager: dispose() エラー:', error.message);
        }
    }
    
    /**
     * 状態取得（Manager統一API）
     */
    getStatus() {
        return { ...this._status };
    }
    
    // ========================================
    // v8設定提供メソッド
    // ========================================
    
    /**
     * v8キャンバス設定取得・WebGPU対応・高精度レンダリング
     */
    getCanvasConfigV8() {
        return {
            ...this.v8Config.canvas,
            // WebGPU優先設定統合
            preference: this.v8Config.renderer.preference,
            powerPreference: this.v8Config.renderer.powerPreference,
            // Container階層設定統合
            sortableChildren: this.v8Config.container.sortableChildren,
            interactiveChildren: this.v8Config.container.interactiveChildren
        };
    }
    
    /**
     * v8レンダラー設定・WebGPU優先・高性能設定
     */
    getV8RendererConfig() {
        return { ...this.v8Config.renderer };
    }
    
    /**
     * v8ツール設定・リアルタイム描画・高精度
     */
    getV8ToolConfig(toolName) {
        const toolConfig = this.v8Config.tools[toolName];
        if (!toolConfig) {
            console.warn(`⚠️ Unknown v8 tool: ${toolName}`);
            return null;
        }
        
        return {
            ...toolConfig,
            // v8共通設定追加
            v8Mode: true,
            rendererOptimized: true,
            webgpuEnabled: toolConfig.webgpuOptimized || false
        };
    }
    
    /**
     * v8 Container階層設定・zIndex・マスク・フィルター
     */
    getV8ContainerConfig() {
        return {
            ...this.v8Config.container,
            // 標準レイヤー定義
            standardLayers: {
                background: { zIndex: -1000 },
                main: { zIndex: 0 },
                ui: { zIndex: 1000 },
                overlay: { zIndex: 2000 }
            }
        };
    }
    
    /**
     * v8性能設定・WebGPU最適化・高速化
     */
    getV8PerformanceConfig() {
        return { ...this.v8Config.performance };
    }
    
    /**
     * v8デバッグ設定・WebGPU情報・統計情報
     */
    getV8DebugConfig() {
        return { ...this.v8Config.debug };
    }
    
    /**
     * v8設定更新・動的変更対応
     */
    updateV8Config(section, updates) {
        if (!this.v8Config[section]) {
            console.warn(`⚠️ Unknown v8 config section: ${section}`);
            return false;
        }
        
        Object.assign(this.v8Config[section], updates);
        console.log(`🔧 v8 Config updated (${section}):`, updates);
        return true;
    }
    
    /**
     * v8色定義取得
     */
    getV8Color(colorName) {
        return this.v8Colors[colorName] || null;
    }
    
    /**
     * v8全色取得
     */
    getAllV8Colors() {
        return { ...this.v8Colors };
    }
    
    /**
     * WebGPU対応設定取得
     */
    getWebGPUConfig() {
        return {
            enabled: this.v8Config.renderer.preference === 'webgpu',
            fallback: this.v8Config.renderer.fallbackPreference,
            powerPreference: this.v8Config.renderer.powerPreference,
            batchSize: this.v8Config.performance.webgpuBatchSize,
            optimizations: {
                tools: Object.entries(this.v8Config.tools)
                    .filter(([_, config]) => config.webgpuOptimized)
                    .map(([name, _]) => name)
            }
        };
    }
    
    /**
     * v8設定バリデーション
     */
    validateV8Config() {
        const errors = [];
        
        // キャンバス設定チェック
        if (this.v8Config.canvas.width <= 0) {
            errors.push('v8 Canvas width must be positive');
        }
        if (this.v8Config.canvas.height <= 0) {
            errors.push('v8 Canvas height must be positive');
        }
        if (this.v8Config.canvas.resolution <= 0) {
            errors.push('v8 Canvas resolution must be positive');
        }
        
        // レンダラー設定チェック
        const validPreferences = ['webgpu', 'webgl'];
        if (!validPreferences.includes(this.v8Config.renderer.preference)) {
            errors.push('v8 Renderer preference must be webgpu or webgl');
        }
        
        // 性能設定チェック
        if (this.v8Config.performance.targetFPS <= 0) {
            errors.push('v8 Target FPS must be positive');
        }
        if (this.v8Config.performance.batchSize <= 0) {
            errors.push('v8 Batch size must be positive');
        }
        
        return errors;
    }
    
    /**
     * v8環境最適化設定生成
     */
    generateOptimizedV8Config(webgpuSupported = false) {
        const optimized = JSON.parse(JSON.stringify(this.v8Config));
        
        if (webgpuSupported) {
            // WebGPU最適化
            optimized.renderer.preference = 'webgpu';
            optimized.performance.batchSize = optimized.performance.webgpuBatchSize;
            optimized.performance.useSharedArrayBuffer = true;
            optimized.performance.enableOffscreenCanvas = true;
        } else {
            // WebGL最適化
            optimized.renderer.preference = 'webgl';
            optimized.performance.batchSize = 4096;
            optimized.performance.useSharedArrayBuffer = false;
            optimized.performance.enableOffscreenCanvas = false;
        }
        
        return optimized;
    }
    
    /**
     * v8デバッグ情報取得
     */
    getV8DebugInfo() {
        return {
            // v8設定状況
            v8ConfigSections: Object.keys(this.v8Config),
            v8ColorCount: Object.keys(this.v8Colors).length,
            
            // v8設定詳細
            canvasSize: `${this.v8Config.canvas.width}x${this.v8Config.canvas.height}`,
            rendererPreference: this.v8Config.renderer.preference,
            webgpuOptimized: this.v8Config.renderer.preference === 'webgpu',
            
            // v8ツール設定
            v8Tools: Object.keys(this.v8Config.tools),
            realtimeEnabled: Object.values(this.v8Config.tools)
                .filter(config => config.realtimeMode).length,
            webgpuOptimizedTools: Object.values(this.v8Config.tools)
                .filter(config => config.webgpuOptimized).length,
            
            // v8性能設定
            targetFPS: this.v8Config.performance.targetFPS,
            batchSize: this.v8Config.performance.batchSize,
            webgpuBatchSize: this.v8Config.performance.webgpuBatchSize,
            
            // v8バリデーション
            validationErrors: this.validateV8Config(),
            configValid: this.validateV8Config().length === 0
        };
    }
    
    /**
     * v8設定リセット
     */
    resetV8ToDefaults() {
        const newConfig = new ConfigManager();
        this.v8Config = newConfig.v8Config;
        this.v8Colors = newConfig.v8Colors;
        
        console.log('🔧 v8 Config reset to defaults');
    }
    
    /**
     * 全v8設定取得
     */
    getAllV8Config() {
        return {
            canvas: this.getCanvasConfigV8(),
            renderer: this.getV8RendererConfig(),
            container: this.getV8ContainerConfig(),
            tools: { ...this.v8Config.tools },
            performance: this.getV8PerformanceConfig(),
            debug: this.getV8DebugConfig(),
            colors: this.getAllV8Colors(),
            webgpu: this.getWebGPUConfig()
        };
    }
    
    // ========================================
    // v7互換メソッド（廃止予定）
    // ========================================
    
    /**
     * キャンバス設定取得（v7互換）
     */
    getCanvasConfig() {
        console.warn('⚠️ getCanvasConfig() is deprecated - use getCanvasConfigV8()');
        return {
            width: this.v8Config.canvas.width,
            height: this.v8Config.canvas.height,
            backgroundColor: this.v8Config.canvas.backgroundColor,
            backgroundAlpha: this.v8Config.canvas.backgroundAlpha,
            antialias: this.v8Config.canvas.antialias,
            resolution: 1 // v7互換性のため固定
        };
    }
    
    /**
     * ツール設定取得（v7互換）
     */
    getToolConfig(toolName) {
        console.warn('⚠️ getToolConfig() is deprecated - use getV8ToolConfig()');
        const toolConfig = this.v8Config.tools[toolName];
        if (!toolConfig) return null;
        
        return {
            color: toolConfig.color,
            lineWidth: toolConfig.lineWidth,
            opacity: toolConfig.opacity,
            size: toolConfig.size
        };
    }
    
    /**
     * UI設定取得（v7互換）
     */
    getUIConfig() {
        console.warn('⚠️ getUIConfig() is deprecated - use v8 specific configs');
        return {
            theme: 'futaba',
            sidebarWidth: 50,
            statusHeight: 60,
            toolButtonSize: 36
        };
    }
    
    /**
     * デバッグ設定取得（v7互換）
     */
    getDebugConfig() {
        console.warn('⚠️ getDebugConfig() is deprecated - use getV8DebugConfig()');
        return { ...this.v8Config.debug };
    }
    
    /**
     * 色定義取得（v7互換）
     */
    getColor(colorName) {
        console.warn('⚠️ getColor() is deprecated - use getV8Color()');
        return this.v8Colors[colorName] || null;
    }
    
    /**
     * デバッグ情報取得（v7互換）
     */
    getDebugInfo() {
        console.warn('⚠️ getDebugInfo() is deprecated - use getV8DebugInfo()');
        return this.getV8DebugInfo();
    }
}

// インスタンス作成・Tegaki名前空間に登録
if (!window.Tegaki.ConfigManagerInstance) {
    window.Tegaki.ConfigManager = ConfigManager;
    window.Tegaki.ConfigManagerInstance = new ConfigManager();
    
    console.log('🔧 ConfigManager PixiJS v8対応版 Loaded - WebGPU・Container階層・高精度設定');
} else {
    console.log('⚠️ ConfigManager already defined - skipping redefinition');
}