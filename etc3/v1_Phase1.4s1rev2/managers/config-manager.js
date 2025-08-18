/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.5
 * 🎯 AI_WORK_SCOPE: 設定値一元化・重複排除・DRY原則適用
 * 🔧 Phase1.5-Step1: ConfigManager クラス実装
 * 🚨 PURE_JAVASCRIPT: ES6モジュール禁止・グローバル変数使用
 * 
 * 📋 PHASE_TARGET: Phase1.5 設定値一元化
 * 📋 V8_MIGRATION: 設定形式互換性保持
 * 📋 DRY_COMPLIANCE: 重複設定値完全排除
 * 📋 SOLID_COMPLIANCE: 単一責任・設定管理統一
 */

class ConfigManager {
    constructor() {
        this.version = 'v1.5-ConfigManager';
        this.initialized = false;
        this.changeListeners = new Map();
        this.validationRules = new Map();
        
        // 🎯 設定値一元化 - 全設定を Single Source of Truth として管理
        this.config = {
            // キャンバス設定（一元化）
            canvas: {
                defaultWidth: 400,
                defaultHeight: 400,
                minWidth: 100,
                maxWidth: 4096,
                minHeight: 100,
                maxHeight: 4096,
                backgroundColor: 0xf0e0d6,          // ふたば☆クリーム色
                backgroundHex: '#f0e0d6',           // CSS用
                antialias: true,
                resolution: 1,
                autoDensity: false
            },
            
            // ブラシ設定（一元化）
            brush: {
                defaultSize: 16.0,
                minSize: 0.1,
                maxSize: 100.0,
                sizeStep: 0.1,                      // スライダーステップ
                defaultColor: 0x800000,             // ふたば☆マルーン
                defaultColorHex: '#800000',         // CSS用
                defaultOpacity: 0.85,               // 85%
                minOpacity: 0.0,
                maxOpacity: 1.0,
                opacityStep: 0.01,
                defaultPressure: 0.5,               // 50%
                minPressure: 0.0,
                maxPressure: 1.0,
                pressureStep: 0.01,
                defaultSmoothing: 0.3,              // 30%
                minSmoothing: 0.0,
                maxSmoothing: 1.0,
                smoothingStep: 0.01,
                // プリセットサイズ
                presetSizes: [1, 2, 4, 8, 16, 32],
                defaultPresetIndex: 4               // 16.0px
            },
            
            // UI設定（一元化）
            ui: {
                sliderUpdateThrottle: 16,           // 60FPS相当
                popupAnimationDuration: 300,        // 0.3秒
                coordinateUpdateThrottle: 16,       // 60FPS相当
                statusUpdateInterval: 100,          // 0.1秒
                errorDisplayDuration: 10000,        // 10秒
                successDisplayDuration: 3000,       // 3秒
                warningDisplayDuration: 5000,       // 5秒
                // ふたば☆カラースキーム
                colors: {
                    primary: '#800000',             // マルーン
                    secondary: '#aa5a56',           // ライトマルーン
                    accent: '#cf9c97',              // ミディアム
                    lightAccent: '#e9c2ba',         // ライトミディアム
                    background: '#ffffee',          // アプリ背景
                    canvas: '#f0e0d6',              // キャンバス背景
                    text: '#2c1810',                // テキスト色
                    border: '#cf9c97'               // ボーダー色
                }
            },
            
            // パフォーマンス設定（一元化）
            performance: {
                targetFPS: 60,
                maxInitTime: 5000,                  // 5秒
                memoryCheckInterval: 5000,          // 5秒
                gcThreshold: 100 * 1024 * 1024,     // 100MB
                maxPathPoints: 10000,               // 最大パスポイント数
                renderBatchSize: 1000,              // レンダリングバッチサイズ
                retryAttempts: 3,
                retryDelay: 200
            },
            
            // ツール設定（一元化）
            tools: {
                defaultTool: 'pen',
                availableTools: ['pen', 'eraser', 'fill', 'select'],
                toolSwitchAnimationDuration: 200,   // 0.2秒
                // ペンツール固有設定
                pen: {
                    pressureSensitivity: true,
                    edgeSmoothing: true,
                    gpuAcceleration: true,
                    highFrequencySupport: true      // 120Hz対応
                },
                // 消しゴムツール固有設定
                eraser: {
                    hardEraser: false,              // ソフト消しゴム
                    preserveAlpha: true
                }
            },
            
            // キーボード設定（一元化）
            keyboard: {
                shortcuts: {
                    'Escape': 'closeAllPopups',
                    'KeyP': 'selectPenTool',
                    'KeyE': 'selectEraserTool',
                    'KeyF': 'selectFillTool',
                    'KeyS': 'selectSelectTool',
                    'BracketLeft': 'decreaseBrushSize',      // [
                    'BracketRight': 'increaseBrushSize',     // ]
                    'Space': 'togglePanMode',
                    'Delete': 'deleteSelected',
                    'Backspace': 'deleteSelected'
                },
                modifierShortcuts: {
                    'Ctrl+Z': 'undo',
                    'Ctrl+Y': 'redo',
                    'Ctrl+A': 'selectAll',
                    'Ctrl+C': 'copy',
                    'Ctrl+V': 'paste',
                    'Ctrl+S': 'save',
                    'Ctrl+O': 'open'
                },
                preventDefaults: ['Space', 'BracketLeft', 'BracketRight']
            },
            
            // デバッグ設定（一元化）
            debug: {
                logLevel: 'info',                   // 'error', 'warn', 'info', 'debug'
                showFPS: true,
                showMemoryUsage: true,
                showCoordinates: true,
                showPressure: true,
                performanceLogging: false,
                errorReporting: true,
                consoleGrouping: true
            },
            
            // PixiJS v8 移行準備設定
            v8Migration: {
                enabled: false,                     // v8移行フラグ
                useApplicationInit: false,          // Application.init() 使用
                webGPUPreference: false,            // WebGPU優先
                legacySupport: true                 // v7互換性維持
            }
        };
        
        this.setupValidationRules();
        console.log('🔧 ConfigManager 初期化完了 - 設定値一元化実装');
    }
    
    /**
     * ConfigManager初期化
     */
    initialize() {
        if (this.initialized) {
            console.warn('⚠️ ConfigManager は既に初期化済みです');
            return true;
        }
        
        try {
            // 設定値検証
            this.validateAllSettings();
            
            // DOM要素から初期値同期（重複排除）
            this.syncFromDOM();
            
            // 設定変更監視開始
            this.startChangeMonitoring();
            
            this.initialized = true;
            console.log('✅ ConfigManager 初期化完了 - 全設定値一元化');
            return true;
            
        } catch (error) {
            console.error('❌ ConfigManager 初期化失敗:', error);
            return false;
        }
    }
    
    /**
     * 設定値取得（統一アクセス方法）
     * @param {string} path - 'canvas.defaultWidth' や 'brush.defaultSize' などのパス
     */
    get(path) {
        const keys = path.split('.');
        let value = this.config;
        
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                console.warn(`⚠️ 設定パス '${path}' が見つかりません`);
                return undefined;
            }
        }
        
        return value;
    }
    
    /**
     * 設定値更新（統一アクセス方法）
     * @param {string} path - 設定パス
     * @param {*} newValue - 新しい値
     * @param {boolean} notify - 変更通知を送信するか
     */
    set(path, newValue, notify = true) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let target = this.config;
        
        // パス途中まで辿る
        for (const key of keys) {
            if (target && typeof target === 'object' && key in target) {
                target = target[key];
            } else {
                console.error(`❌ 設定パス '${path}' が無効です`);
                return false;
            }
        }
        
        if (target && typeof target === 'object') {
            const oldValue = target[lastKey];
            
            // 値検証
            if (this.validateValue(path, newValue)) {
                target[lastKey] = newValue;
                
                // 変更通知
                if (notify) {
                    this.notifyChange(path, newValue, oldValue);
                }
                
                console.log(`✅ 設定更新: ${path} = ${newValue} (旧値: ${oldValue})`);
                return true;
            } else {
                console.error(`❌ 設定値検証失敗: ${path} = ${newValue}`);
                return false;
            }
        }
        
        console.error(`❌ 設定更新失敗: ${path}`);
        return false;
    }
    
    /**
     * 設定セクション取得
     * @param {string} section - 'canvas', 'brush' などのセクション名
     */
    getSection(section) {
        if (section in this.config) {
            // ディープコピーして返す（参照を直接渡さない）
            return JSON.parse(JSON.stringify(this.config[section]));
        } else {
            console.warn(`⚠️ 設定セクション '${section}' が見つかりません`);
            return null;
        }
    }
    
    /**
     * 複数設定値を一括更新
     * @param {Object} updates - { 'path': value, ... } 形式
     */
    updateMultiple(updates) {
        const results = {};
        let hasErrors = false;
        
        Object.entries(updates).forEach(([path, value]) => {
            const success = this.set(path, value, false); // 一括更新時は個別通知なし
            results[path] = success;
            if (!success) hasErrors = true;
        });
        
        // 一括変更通知
        if (!hasErrors) {
            this.notifyChange('*', updates, null);
            console.log('✅ 一括設定更新完了:', Object.keys(updates).length + '項目');
        } else {
            console.warn('⚠️ 一括設定更新で一部エラー:', results);
        }
        
        return results;
    }
    
    /**
     * 設定変更監視
     * @param {string} path - 監視するパス ('*' で全監視)
     * @param {Function} callback - 変更時コールバック
     */
    onChange(path, callback) {
        if (typeof callback !== 'function') {
            console.error('❌ onChange: callbackは関数である必要があります');
            return false;
        }
        
        if (!this.changeListeners.has(path)) {
            this.changeListeners.set(path, []);
        }
        
        this.changeListeners.get(path).push(callback);
        console.log(`✅ 設定変更監視登録: ${path}`);
        return true;
    }
    
    /**
     * 変更通知送信
     * @param {string} path - 変更されたパス
     * @param {*} newValue - 新しい値
     * @param {*} oldValue - 古い値
     */
    notifyChange(path, newValue, oldValue) {
        // 特定パスのリスナー
        if (this.changeListeners.has(path)) {
            this.changeListeners.get(path).forEach(callback => {
                try {
                    callback(path, newValue, oldValue);
                } catch (error) {
                    console.error(`❌ 設定変更リスナーエラー (${path}):`, error);
                }
            });
        }
        
        // 全体監視リスナー
        if (this.changeListeners.has('*')) {
            this.changeListeners.get('*').forEach(callback => {
                try {
                    callback(path, newValue, oldValue);
                } catch (error) {
                    console.error('❌ 全体設定変更リスナーエラー:', error);
                }
            });
        }
    }
    
    /**
     * 設定検証ルール設定
     */
    setupValidationRules() {
        // キャンバス設定検証
        this.validationRules.set('canvas.defaultWidth', (value) => 
            Number.isInteger(value) && value >= this.config.canvas.minWidth && value <= this.config.canvas.maxWidth
        );
        this.validationRules.set('canvas.defaultHeight', (value) => 
            Number.isInteger(value) && value >= this.config.canvas.minHeight && value <= this.config.canvas.maxHeight
        );
        
        // ブラシ設定検証
        this.validationRules.set('brush.defaultSize', (value) => 
            typeof value === 'number' && value >= this.config.brush.minSize && value <= this.config.brush.maxSize
        );
        this.validationRules.set('brush.defaultOpacity', (value) => 
            typeof value === 'number' && value >= this.config.brush.minOpacity && value <= this.config.brush.maxOpacity
        );
        this.validationRules.set('brush.defaultPressure', (value) => 
            typeof value === 'number' && value >= this.config.brush.minPressure && value <= this.config.brush.maxPressure
        );
        this.validationRules.set('brush.defaultSmoothing', (value) => 
            typeof value === 'number' && value >= this.config.brush.minSmoothing && value <= this.config.brush.maxSmoothing
        );
        
        // カラー設定検証
        this.validationRules.set('brush.defaultColor', (value) => 
            (typeof value === 'number' && value >= 0 && value <= 0xFFFFFF) ||
            (typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value))
        );
        
        // パフォーマンス設定検証
        this.validationRules.set('performance.targetFPS', (value) => 
            Number.isInteger(value) && value > 0 && value <= 240
        );
    }
    
    /**
     * 値検証
     * @param {string} path - 設定パス
     * @param {*} value - 検証する値
     */
    validateValue(path, value) {
        const rule = this.validationRules.get(path);
        if (rule) {
            return rule(value);
        }
        // 検証ルールがない場合は通す（将来の拡張性）
        return true;
    }
    
    /**
     * 全設定値検証
     */
    validateAllSettings() {
        let isValid = true;
        const errors = [];
        
        this.validationRules.forEach((rule, path) => {
            const value = this.get(path);
            if (!rule(value)) {
                isValid = false;
                errors.push(`${path}: ${value}`);
            }
        });
        
        if (!isValid) {
            console.error('❌ 設定値検証エラー:', errors);
            throw new Error('設定値検証に失敗しました');
        }
        
        console.log('✅ 全設定値検証完了');
    }
    
    /**
     * DOM要素から設定値同期（重複排除）
     */
    syncFromDOM() {
        console.log('🔄 DOM要素から設定値同期開始...');
        
        // キャンバスサイズ入力要素
        const canvasWidthInput = document.getElementById('canvas-width');
        const canvasHeightInput = document.getElementById('canvas-height');
        
        if (canvasWidthInput && canvasHeightInput) {
            const width = parseInt(canvasWidthInput.value) || this.config.canvas.defaultWidth;
            const height = parseInt(canvasHeightInput.value) || this.config.canvas.defaultHeight;
            
            // 値が異なる場合のみ更新
            if (width !== this.config.canvas.defaultWidth) {
                this.set('canvas.defaultWidth', width, false);
            }
            if (height !== this.config.canvas.defaultHeight) {
                this.set('canvas.defaultHeight', height, false);
            }
        } else {
            // DOM要素がない場合はDOM側を更新
            if (canvasWidthInput) canvasWidthInput.value = this.config.canvas.defaultWidth;
            if (canvasHeightInput) canvasHeightInput.value = this.config.canvas.defaultHeight;
        }
        
        // プリセットサイズの active 状態を同期
        this.syncPresetSizes();
        
        console.log('✅ DOM同期完了');
    }
    
    /**
     * プリセットサイズ同期
     */
    syncPresetSizes() {
        const currentSize = this.config.brush.defaultSize;
        const presetItems = document.querySelectorAll('.size-preset-item');
        
        presetItems.forEach(item => {
            const size = parseFloat(item.getAttribute('data-size'));
            if (size === currentSize) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }
    
    /**
     * 変更監視開始
     */
    startChangeMonitoring() {
        // プリセットサイズボタン監視
        document.querySelectorAll('.size-preset-item').forEach(item => {
            item.addEventListener('click', () => {
                const size = parseFloat(item.getAttribute('data-size'));
                this.set('brush.defaultSize', size);
            });
        });
        
        // キャンバスサイズ入力監視
        const canvasWidthInput = document.getElementById('canvas-width');
        const canvasHeightInput = document.getElementById('canvas-height');
        
        if (canvasWidthInput) {
            canvasWidthInput.addEventListener('change', (e) => {
                const width = parseInt(e.target.value);
                if (width) this.set('canvas.defaultWidth', width);
            });
        }
        
        if (canvasHeightInput) {
            canvasHeightInput.addEventListener('change', (e) => {
                const height = parseInt(e.target.value);
                if (height) this.set('canvas.defaultHeight', height);
            });
        }
        
        console.log('✅ 設定変更監視開始');
    }
    
    /**
     * 設定リセット
     * @param {string} section - リセットするセクション (省略時は全体)
     */
    reset(section = null) {
        if (section) {
            if (section in this.config) {
                // セクション単位でリセット（デフォルト値で上書き）
                const defaultConfig = new ConfigManager().config;
                this.config[section] = JSON.parse(JSON.stringify(defaultConfig[section]));
                this.notifyChange(`${section}.*`, this.config[section], null);
                console.log(`✅ 設定リセット完了: ${section}`);
            } else {
                console.error(`❌ 不明な設定セクション: ${section}`);
                return false;
            }
        } else {
            // 全体リセット
            const defaultConfig = new ConfigManager().config;
            this.config = JSON.parse(JSON.stringify(defaultConfig));
            this.notifyChange('*', this.config, null);
            console.log('✅ 全設定リセット完了');
        }
        
        // DOM同期
        this.syncFromDOM();
        return true;
    }
    
    /**
     * 設定エクスポート
     */
    export() {
        return {
            version: this.version,
            timestamp: new Date().toISOString(),
            config: JSON.parse(JSON.stringify(this.config))
        };
    }
    
    /**
     * 設定インポート
     * @param {Object} exportedData - エクスポートされた設定データ
     */
    import(exportedData) {
        try {
            if (!exportedData || !exportedData.config) {
                throw new Error('無効な設定データです');
            }
            
            // バージョン互換性チェック
            if (exportedData.version && exportedData.version !== this.version) {
                console.warn(`⚠️ 設定バージョン不一致: ${exportedData.version} → ${this.version}`);
            }
            
            // 設定マージ（既存設定は保持）
            this.config = this.deepMerge(this.config, exportedData.config);
            
            // 検証
            this.validateAllSettings();
            
            // DOM同期
            this.syncFromDOM();
            
            // 変更通知
            this.notifyChange('*', this.config, null);
            
            console.log('✅ 設定インポート完了');
            return true;
            
        } catch (error) {
            console.error('❌ 設定インポートエラー:', error);
            return false;
        }
    }
    
    /**
     * ディープマージ
     */
    deepMerge(target, source) {
        const result = { ...target };
        
        Object.keys(source).forEach(key => {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        });
        
        return result;
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            version: this.version,
            initialized: this.initialized,
            configSections: Object.keys(this.config),
            changeListeners: Array.from(this.changeListeners.keys()),
            validationRules: Array.from(this.validationRules.keys()),
            totalSettings: this.countSettings(),
            memoryUsage: JSON.stringify(this.config).length + ' bytes'
        };
    }
    
    /**
     * 設定項目数カウント
     */
    countSettings() {
        let count = 0;
        
        const countRecursive = (obj) => {
            Object.entries(obj).forEach(([key, value]) => {
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    countRecursive(value);
                } else {
                    count++;
                }
            });
        };
        
        countRecursive(this.config);
        return count;
    }
}

// グローバル公開
window.ConfigManager = ConfigManager;

// 使用例とテスト
console.log('📋 ConfigManager 使用例:');
console.log('  const config = new ConfigManager();');
console.log('  config.initialize();');
console.log('  config.get("canvas.defaultWidth")  // 400');
console.log('  config.set("brush.defaultSize", 24.0)');
console.log('  config.getSection("brush")');
console.log('  config.onChange("brush.defaultSize", (path, newVal, oldVal) => { ... })');
console.log('🎨 ふたば☆お絵描きツール v1.5 - ConfigManager実装完了');