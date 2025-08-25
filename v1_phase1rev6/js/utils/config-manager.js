/**
 * 🔧 ConfigManager - キャンバスサイズ修正版
 * 📋 RESPONSIBILITY: 設定管理・デフォルト値提供のみ
 * 🚫 PROHIBITION: UI操作・複雑な初期化・他クラス依存
 * ✅ PERMISSION: 設定値管理・デフォルト値提供・設定変更
 * 
 * 📏 DESIGN_PRINCIPLE: シンプル設定管理・デフォルト重視
 * 🔄 INTEGRATION: 他クラスから設定値を取得可能
 * 🔧 FIX: キャンバスサイズを400x400に固定・背景色修正
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

/**
 * ConfigManager - キャンバスサイズ修正版
 */
class ConfigManager {
    constructor() {
        console.log('🔧 ConfigManager Simple 作成');
        
        // 🔧 基本設定（修正版）
        this.config = {
            canvas: {
                width: 400,           // キャンバス幅（固定）
                height: 400,          // キャンバス高さ（固定）
                backgroundColor: 0xf0e0d6,  // ふたばクリーム色 #f0e0d6
                backgroundAlpha: 1.0, // 不透明
                antialias: true,      // アンチエイリアス有効
                resolution: window.devicePixelRatio || 1
            },
            
            // ツール設定
            tools: {
                pen: {
                    color: 0x800000,      // ふたば風マルーン
                    lineWidth: 4,         // デフォルト線幅
                    opacity: 1.0,         // 不透明度
                    smoothing: true       // スムージング
                },
                
                eraser: {
                    size: 20,             // デフォルト消しゴムサイズ
                    opacity: 1.0,         // 消去強度
                    smoothing: true       // スムーズ消去
                }
            },
            
            // UI設定
            ui: {
                theme: 'futaba',          // ふたば風テーマ
                sidebarWidth: 50,         // サイドバー幅
                statusHeight: 60,         // ステータスパネル高さ
                toolButtonSize: 36        // ツールボタンサイズ
            },
            
            // デバッグ設定
            debug: {
                showFPS: true,            // FPS表示
                showMemory: true,         // メモリ使用量表示
                showCoordinates: true,    // 座標表示
                verboseLogging: true      // 詳細ログ
            }
        };
        
        // 色定義（ふたば風）
        this.colors = {
            futabaMaroon: 0x800000,       // #800000 - メインマルーン
            futabaLightMaroon: 0xaa5a56,  // #aa5a56 - ライトマルーン
            futabaMedium: 0xcf9c97,       // #cf9c97 - ミディアム
            futabaLightMedium: 0xe9c2ba,  // #e9c2ba - ライトミディアム
            futabaCream: 0xf0e0d6,        // #f0e0d6 - クリーム
            futabaBackground: 0xffffee,   // #ffffee - 背景
            textPrimary: 0x2c1810,        // #2c1810 - メインテキスト
            textSecondary: 0x5d4037,      // #5d4037 - セカンダリテキスト
            textInverse: 0xffffff         // #ffffff - 逆転テキスト
        };
    }
    
    /**
     * キャンバス設定取得
     */
    getCanvasConfig() {
        return { ...this.config.canvas };
    }
    
    /**
     * ツール設定取得
     */
    getToolConfig(toolName) {
        return this.config.tools[toolName] ? { ...this.config.tools[toolName] } : null;
    }
    
    /**
     * UI設定取得
     */
    getUIConfig() {
        return { ...this.config.ui };
    }
    
    /**
     * デバッグ設定取得
     */
    getDebugConfig() {
        return { ...this.config.debug };
    }
    
    /**
     * 色定義取得
     */
    getColor(colorName) {
        return this.colors[colorName] || null;
    }
    
    /**
     * 全色取得
     */
    getAllColors() {
        return { ...this.colors };
    }
    
    /**
     * キャンバス設定更新
     */
    updateCanvasConfig(updates) {
        Object.assign(this.config.canvas, updates);
        console.log('🔧 Canvas config updated:', updates);
    }
    
    /**
     * ツール設定更新
     */
    updateToolConfig(toolName, updates) {
        if (this.config.tools[toolName]) {
            Object.assign(this.config.tools[toolName], updates);
            console.log(`🔧 Tool config updated (${toolName}):`, updates);
        } else {
            console.warn(`⚠️ Unknown tool: ${toolName}`);
        }
    }
    
    /**
     * UI設定更新
     */
    updateUIConfig(updates) {
        Object.assign(this.config.ui, updates);
        console.log('🔧 UI config updated:', updates);
    }
    
    /**
     * デバッグ設定更新
     */
    updateDebugConfig(updates) {
        Object.assign(this.config.debug, updates);
        console.log('🔧 Debug config updated:', updates);
    }
    
    /**
     * 設定リセット
     */
    resetToDefaults() {
        // デフォルト設定に戻す（再構築）
        const newConfig = new ConfigManager();
        this.config = newConfig.config;
        this.colors = newConfig.colors;
        
        console.log('🔧 Config reset to defaults');
    }
    
    /**
     * 全設定取得
     */
    getAllConfig() {
        return {
            canvas: this.getCanvasConfig(),
            tools: { ...this.config.tools },
            ui: this.getUIConfig(),
            debug: this.getDebugConfig(),
            colors: this.getAllColors()
        };
    }
    
    /**
     * 設定バリデーション
     */
    validateConfig() {
        const errors = [];
        
        // キャンバス設定チェック
        if (this.config.canvas.width <= 0) {
            errors.push('Canvas width must be positive');
        }
        if (this.config.canvas.height <= 0) {
            errors.push('Canvas height must be positive');
        }
        
        // ツール設定チェック
        Object.entries(this.config.tools).forEach(([toolName, toolConfig]) => {
            if (toolName === 'pen' && toolConfig.lineWidth <= 0) {
                errors.push(`${toolName}: line width must be positive`);
            }
            if (toolName === 'eraser' && toolConfig.size <= 0) {
                errors.push(`${toolName}: size must be positive`);
            }
        });
        
        return errors;
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            configKeys: Object.keys(this.config),
            canvasSize: `${this.config.canvas.width}x${this.config.canvas.height}`,
            toolCount: Object.keys(this.config.tools).length,
            colorCount: Object.keys(this.colors).length,
            validationErrors: this.validateConfig()
        };
    }
}

// インスタンス作成・Tegaki名前空間に登録
if (!window.Tegaki.ConfigManagerInstance) {
    window.Tegaki.ConfigManager = ConfigManager;
    window.Tegaki.ConfigManagerInstance = new ConfigManager();
    
    console.log('🔧 ConfigManager Simple Loaded - シンプル設定管理');
} else {
    console.log('⚠️ ConfigManager already defined - skipping redefinition');
}