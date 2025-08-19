/**
 * 🎨 ふたば☆お絵描きツール - 統一設定管理システム
 * 🎯 AI_WORK_SCOPE: 設定値一元化・統一アクセス・DRY原則準拠
 * 🎯 DEPENDENCIES: なし（独立ユーティリティ）
 * 🎯 PIXI_EXTENSIONS: 使用しない
 * 🎯 ISOLATION_TEST: 可能
 * 🎯 SPLIT_THRESHOLD: 200行以下維持
 * 📋 PHASE_TARGET: Phase1統一化
 * 📋 V8_MIGRATION: v8対応設定値準備済み
 */

/**
 * 統一設定管理システム
 * すべての設定値を一元管理し、重複を排除
 */
class ConfigManager {
    /**
     * デフォルト設定値（統一版）
     */
    static defaultConfig = {
        // キャンバス設定
        canvas: {
            width: 400,
            height: 400,
            maxWidth: 4096,
            maxHeight: 4096,
            minWidth: 100,
            minHeight: 100,
            backgroundColor: 0xf0e0d6,
            backgroundColorHex: '#f0e0d6'
        },
        
        // PixiJS設定
        pixi: {
            antialias: true,
            resolution: 1,
            autoDensity: false,
            cursor: 'crosshair'
        },
        
        // 描画ツール設定
        drawing: {
            pen: {
                defaultSize: 16.0,
                minSize: 0.1,
                maxSize: 100.0,
                defaultColor: 0x800000,
                defaultColorHex: '#800000',
                defaultOpacity: 0.85,
                defaultPressure: 0.5,
                defaultSmoothing: 0.3,
                minDistance: 1.5
            },
            eraser: {
                defaultSize: 16.0,
                opacity: 1.0,
                blendMode: 'erase'
            }
        },
        
        // UI設定
        ui: {
            slider: {
                updateThrottle: 16, // 約60FPS
                precision: {
                    size: 1,
                    percentage: 1
                }
            },
            popup: {
                animationDuration: 300
            },
            keyboard: {
                shortcuts: {
                    'Escape': 'closeAllPopups',
                    'KeyP': 'selectPenTool', 
                    'KeyE': 'selectEraserTool'
                }
            }
        },
        
        // パフォーマンス設定
        performance: {
            targetFPS: 60,
            maxInitTime: 5000, // 5秒
            updateInterval: 1000,
            memoryCheckInterval: 5000,
            retryAttempts: 3,
            retryDelay: 200
        },
        
        // エラー設定
        error: {
            displayDuration: 10000, // 10秒
            maxRetries: 3,
            retryDelay: 200,
            showDebugInfo: true
        },
        
        // ふたばカラーパレット（統一版）
        colors: {
            futabaMaroon: 0x800000,
            futabaLightMaroon: 0xaa5a56,
            futabaMedium: 0xcf9c97,
            futabaLightMedium: 0xe9c2ba,
            futabaCream: 0xf0e0d6,
            futabaBackground: 0xffffee,
            // Hex版
            futabaMaroonHex: '#800000',
            futabaLightMaroonHex: '#aa5a56',
            futabaMediumHex: '#cf9c97',
            futabaLightMediumHex: '#e9c2ba',
            futabaCreamHex: '#f0e0d6',
            futabaBackgroundHex: '#ffffee'
        },
        
        // v8移行準備設定
        v8Migration: {
            enabled: false, // v8移行時にtrue
            useWebGPU: false, // WebGPU使用予定
            maxFPS: 120, // v8では120FPS対応予定
            apiChanges: {
                applicationInit: false, // v8では await PIXI.Application.init()
                backgroundProperty: false // v8では background プロパティ
            }
        }
    };
    
    /**
     * 設定値取得（ドット記法対応）
     * @param {string} path - 設定パス（例: 'canvas.width' または 'drawing.pen.defaultSize'）
     * @returns {any} 設定値
     */
    static get(path) {
        if (!path) {
            return this.defaultConfig;
        }
        
        return this.getNestedValue(this.defaultConfig, path);
    }
    
    /**
     * ネストしたオブジェクトから値を取得
     * @param {Object} obj - 対象オブジェクト
     * @param {string} path - パス
     * @returns {any} 値
     */
    static getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current.hasOwnProperty(key) ? current[key] : undefined;
        }, obj);
    }
    
    /**
     * 設定値設定（ドット記法対応）
     * @param {string} path - 設定パス
     * @param {any} value - 設定値
     */
    static set(path, value) {
        const keys = path.split('.');
        let current = this.defaultConfig;
        
        // 最後のキー以外まで進む
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        // 最後のキーで値を設定
        current[keys[keys.length - 1]] = value;
    }
    
    /**
     * キャンバス設定取得
     * @returns {Object} キャンバス設定
     */
    static getCanvasConfig() {
        return this.get('canvas');
    }
    
    /**
     * PixiJS設定取得
     * @returns {Object} PixiJS設定
     */
    static getPixiConfig() {
        return this.get('pixi');
    }
    
    /**
     * 描画ツール設定取得
     * @param {string} tool - ツール名（'pen', 'eraser'等）
     * @returns {Object} ツール設定
     */
    static getDrawingConfig(tool = 'pen') {
        return this.get(`drawing.${tool}`);
    }
    
    /**
     * ふたばカラーパレット取得
     * @returns {Object} カラー設定
     */
    static getColors() {
        return this.get('colors');
    }
    
    /**
     * パフォーマンス設定取得
     * @returns {Object} パフォーマンス設定
     */
    static getPerformanceConfig() {
        return this.get('performance');
    }
    
    /**
     * エラー設定取得
     * @returns {Object} エラー設定
     */
    static getErrorConfig() {
        return this.get('error');
    }
    
    /**
     * UI設定取得
     * @returns {Object} UI設定
     */
    static getUIConfig() {
        return this.get('ui');
    }
    
    /**
     * v8移行設定取得
     * @returns {Object} v8移行設定
     */
    static getV8Config() {
        return this.get('v8Migration');
    }
    
    /**
     * 設定の妥当性確認
     * @param {string} path - 設定パス
     * @param {any} value - 確認する値
     * @returns {boolean} 妥当かどうか
     */
    static validate(path, value) {
        switch (path) {
            case 'canvas.width':
            case 'canvas.height':
                return typeof value === 'number' && 
                       value >= this.get('canvas.minWidth') && 
                       value <= this.get('canvas.maxWidth');
                       
            case 'drawing.pen.defaultSize':
                return typeof value === 'number' && 
                       value >= this.get('drawing.pen.minSize') && 
                       value <= this.get('drawing.pen.maxSize');
                       
            case 'drawing.pen.defaultOpacity':
            case 'drawing.pen.defaultPressure':
            case 'drawing.pen.defaultSmoothing':
                return typeof value === 'number' && value >= 0 && value <= 1;
                
            default:
                return true; // デフォルトは妥当とする
        }
    }
    
    /**
     * 開発用デバッグ情報取得
     * @returns {Object} デバッグ情報
     */
    static getDebugInfo() {
        return {
            version: 'v1.0-unified',
            totalSettings: this.countSettings(this.defaultConfig),
            settingsPaths: this.getAllPaths(this.defaultConfig),
            colors: Object.keys(this.get('colors')),
            v8Ready: this.get('v8Migration.enabled')
        };
    }
    
    /**
     * 設定数をカウント（再帰）
     * @param {Object} obj - オブジェクト
     * @returns {number} 設定数
     */
    static countSettings(obj) {
        let count = 0;
        for (const key in obj) {
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                count += this.countSettings(obj[key]);
            } else {
                count++;
            }
        }
        return count;
    }
    
    /**
     * 全パス取得（再帰）
     * @param {Object} obj - オブジェクト
     * @param {string} prefix - プレフィックス
     * @returns {string[]} パス配列
     */
    static getAllPaths(obj, prefix = '') {
        const paths = [];
        for (const key in obj) {
            const currentPath = prefix ? `${prefix}.${key}` : key;
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                paths.push(...this.getAllPaths(obj[key], currentPath));
            } else {
                paths.push(currentPath);
            }
        }
        return paths;
    }
}

// グローバル公開
window.ConfigManager = ConfigManager;

// デバッグ用グローバル関数
window.getConfig = (path) => ConfigManager.get(path);
window.setConfig = (path, value) => ConfigManager.set(path, value);
window.getConfigDebug = () => ConfigManager.getDebugInfo();

console.log('✅ ConfigManager 初期化完了');
console.log(`📊 設定項目数: ${ConfigManager.getDebugInfo().totalSettings}個`);
console.log('💡 使用例: ConfigManager.get("canvas.width") または window.getConfig("canvas.width")');