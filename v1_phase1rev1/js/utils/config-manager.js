/**
 * 🔧 ConfigManager Simple - シンプル設定管理
 * 📋 RESPONSIBILITY: 基本設定値の保存・取得のみ
 * 🚫 PROHIBITION: 複雑な検証・変換・イベント処理
 * ✅ PERMISSION: 設定値保存・取得・デフォルト値提供
 * 
 * 📏 DESIGN_PRINCIPLE: 単純・直線的・設定専門
 * 🔄 INTEGRATION: 他システムが必要な設定値を提供
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

/**
 * ConfigManager - シンプル版（30行以内）
 * 設定値管理の専任
 */
class ConfigManager {
    constructor() {
        console.log('🔧 ConfigManager Simple 作成');
        
        // デフォルト設定
        this.config = {
            canvas: {
                width: 400,
                height: 400,
                backgroundColor: '#ffffee'
            },
            pixi: {
                antialias: true,
                resolution: window.devicePixelRatio || 1
            },
            tools: {
                pen: {
                    size: 16,
                    opacity: 0.85,
                    color: '#800000'
                },
                eraser: {
                    size: 20
                }
            }
        };
    }
    
    /**
     * 設定値取得
     */
    get(path, defaultValue = null) {
        const keys = path.split('.');
        let value = this.config;
        
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return defaultValue;
            }
        }
        
        return value;
    }
    
    /**
     * 設定値設定
     */
    set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let target = this.config;
        
        // 階層作成
        for (const key of keys) {
            if (!target[key] || typeof target[key] !== 'object') {
                target[key] = {};
            }
            target = target[key];
        }
        
        target[lastKey] = value;
        console.log(`✅ Config set: ${path} = ${value}`);
    }
    
    /**
     * CanvasManager用設定取得
     */
    getCanvasConfig() {
        return this.config.canvas;
    }
    
    /**
     * PixiJS用設定取得
     */
    getPixiConfig() {
        return this.config.pixi;
    }
    
    /**
     * ツール設定取得
     */
    getToolConfig(toolName) {
        return this.config.tools[toolName] || {};
    }
    
    /**
     * 全設定取得
     */
    getAll() {
        return { ...this.config };
    }
    
    /**
     * 設定保存（localStorage使用）
     */
    save() {
        try {
            localStorage.setItem('tegaki-config', JSON.stringify(this.config));
            console.log('💾 Config saved to localStorage');
        } catch (error) {
            console.warn('⚠️ Config save failed:', error);
        }
    }
    
    /**
     * 設定読み込み（localStorage使用）
     */
    load() {
        try {
            const saved = localStorage.getItem('tegaki-config');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.config = { ...this.config, ...parsed };
                console.log('📂 Config loaded from localStorage');
            }
        } catch (error) {
            console.warn('⚠️ Config load failed:', error);
        }
    }
}

// Tegaki名前空間に登録
window.Tegaki.ConfigManager = ConfigManager;

// インスタンス作成・登録
window.Tegaki.ConfigManagerInstance = new ConfigManager();

// 初期化時にlocalStorageから読み込み
window.Tegaki.ConfigManagerInstance.load();

console.log('🔧 ConfigManager Simple Loaded - シンプル設定管理');