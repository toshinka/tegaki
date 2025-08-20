/**
 * ⚙️ 設定管理システム（ConfigManager）- DPI除去対応版
 * 🎯 AI_WORK_SCOPE: アプリケーション設定統一管理・DPI設定除去・座標設定追加
 * 🎯 DEPENDENCIES: なし（統一システム基盤）
 * 🎯 UNIFIED: 統一システム基盤（他システムから参照される）
 * 🛠️ DPI_REMOVAL: scaleCompensation=false・resolution=1固定・座標設定追加
 */

class ConfigManager {
    constructor() {
        // 🛠️ MODIFIED: DPI除去対応設定（座標設定追加・DPI関連設定除去）
        this.defaultConfig = {
            app: {
                name: 'ふたば☆お絵描きツール',
                version: 'v1.0-Phase1.3-DPI-removed',
                description: 'ふたばちゃんねる風ベクターお絵描きツール（統一版・DPI除去版）',
                author: 'Futaba Drawing Tool Team',
                license: 'MIT'
            },
            
            canvas: {
                width: 400,
                height: 400,
                backgroundColor: 0xf0e0d6,
                minWidth: 100,
                maxWidth: 4096,
                minHeight: 100,
                maxHeight: 4096,
                boundary: {
                    enabled: true,
                    margin: 20,
                    trackingEnabled: true
                }
            },
            
            pixi: {
                antialias: true,
                resolution: 1,  // 🛠️ MODIFIED: 固定値1（devicePixelRatio使用せず）
                autoDensity: false, // 🛠️ MODIFIED: 高DPI自動調整を明示的に無効化
                cursor: 'crosshair'
                // 🛠️ REMOVED: DPI関連設定削除
            },
            
            // 🛠️ ADDED: 座標管理設定（CoordinateManager用）
            coordinate: {
                precision: 2,
                boundaryClamp: true,
                scaleCompensation: false,  // 🛠️ MODIFIED: DPI補償無効化
                touchScaling: 1.0,
                debugging: false,
                // 🛠️ REMOVED: devicePixelRatio 関連設定削除
                dpiCompensationDisabled: true, // 🛠️ ADDED: DPI補償無効化フラグ
                coordinateAccuracy: 'high'     // 🛠️ ADDED: 座標精度設定
            },
            
            tools: {
                default: 'pen',
                available: ['pen', 'eraser', 'fill', 'select'],
                pen: {
                    size: 16,
                    opacity: 0.85,
                    pressure: 0.5,
                    smoothing: 0.3,
                    color: '#800000',
                    settings: {
                        pressureSensitive: true,
                        edgeSmoothing: true,
                        gpuAcceleration: true
                    }
                },
                eraser: {
                    size: 20,
                    opacity: 1.0,
                    hardness: 0.8
                }
            },
            
            ui: {
                theme: 'futaba',
                keyboard: {
                    shortcuts: {
                        'KeyP': 'selectPenTool',
                        'KeyE': 'selectEraserTool',
                        'Escape': 'closeAllPopups'
                    }
                },
                popup: {
                    defaultPosition: { x: 60, y: 100 },
                    draggable: true
                }
            },
            
            performance: {
                maxInitTime: 5000,
                targetFPS: 60,
                memoryLimit: 512 // MB
            },
            
            colors: {
                // ふたばちゃんねるカラーパレット
                background: '#ffffee',
                canvas: '#f0e0d6',
                border: '#cf9c97',
                text: '#800000',
                accent: '#b5906a'
            },
            
            dependencies: {
                required: ['PIXI', 'AppCore'],
                optional: ['CoordinateManager', 'BoundaryManager', 'ToolManager', 'UIManager']
            }
        };
        
        // 現在の設定（デフォルトのコピー）
        this.config = JSON.parse(JSON.stringify(this.defaultConfig));
        
        console.log('⚙️ ConfigManager 初期化完了（DPI除去版・座標設定追加版）');
        this.logConfigSummary();
    }
    
    /**
     * 設定値取得（ドット記法対応）
     */
    get(path, defaultValue = null) {
        try {
            const keys = path.split('.');
            let current = this.config;
            
            for (const key of keys) {
                if (current && typeof current === 'object' && key in current) {
                    current = current[key];
                } else {
                    return defaultValue;
                }
            }
            
            return current;
        } catch (error) {
            console.warn(`⚠️ ConfigManager.get エラー: ${path}`, error);
            return defaultValue;
        }
    }
    
    /**
     * 設定値設定（ドット記法対応）
     */
    set(path, value) {
        try {
            const keys = path.split('.');
            let current = this.config;
            
            for (let i = 0; i < keys.length - 1; i++) {
                const key = keys[i];
                if (!current[key] || typeof current[key] !== 'object') {
                    current[key] = {};
                }
                current = current[key];
            }
            
            const lastKey = keys[keys.length - 1];
            current[lastKey] = value;
            
            console.log(`⚙️ 設定更新: ${path} = ${JSON.stringify(value)}`);
            return true;
            
        } catch (error) {
            console.error(`❌ ConfigManager.set エラー: ${path}`, error);
            return false;
        }
    }
    
    /**
     * キャンバス設定取得
     */
    getCanvasConfig() {
        return {
            width: this.get('canvas.width', 400),
            height: this.get('canvas.height', 400),
            backgroundColor: this.get('canvas.backgroundColor', 0xf0e0d6),
            minWidth: this.get('canvas.minWidth', 100),
            maxWidth: this.get('canvas.maxWidth', 4096),
            minHeight: this.get('canvas.minHeight', 100),
            maxHeight: this.get('canvas.maxHeight', 4096)
        };
    }
    
    /**
     * 🛠️ MODIFIED: PixiJS設定取得（DPI除去版）
     */
    getPixiConfig() {
        return {
            antialias: this.get('pixi.antialias', true),
            resolution: 1, // 🛠️ MODIFIED: 常に固定値1
            autoDensity: false, // 🛠️ MODIFIED: 常にfalse
            cursor: this.get('pixi.cursor', 'crosshair')
            // 🛠️ REMOVED: devicePixelRatio関連設定削除
        };
    }
    
    /**
     * 🛠️ ADDED: 座標設定取得（CoordinateManager用）
     */
    getCoordinateConfig() {
        return {
            precision: this.get('coordinate.precision', 2),
            boundaryClamp: this.get('coordinate.boundaryClamp', true),
            scaleCompensation: false, // 🛠️ MODIFIED: 常にfalse
            touchScaling: this.get('coordinate.touchScaling', 1.0),
            debugging: this.get('coordinate.debugging', false),
            dpiCompensationDisabled: true, // 🛠️ ADDED: DPI補償無効フラグ
            coordinateAccuracy: this.get('coordinate.coordinateAccuracy', 'high')
        };
    }
    
    /**
     * ツール設定取得
     */
    getToolConfig(toolName) {
        const toolConfig = this.get(`tools.${toolName}`);
        if (!toolConfig) {
            console.warn(`⚠️ ツール設定が見つかりません: ${toolName}`);
            return this.get('tools.pen'); // フォールバック
        }
        return toolConfig;
    }
    
    /**
     * アプリケーション情報取得
     */
    getAppInfo() {
        return {
            name: this.get('app.name'),
            version: this.get('app.version'),
            description: this.get('app.description'),
            author: this.get('app.author'),
            license: this.get('app.license')
        };
    }
    
    /**
     * UI設定取得
     */
    getUIConfig() {
        return {
            theme: this.get('ui.theme', 'futaba'),
            keyboard: this.get('ui.keyboard', {}),
            popup: this.get('ui.popup', {})
        };
    }
    
    /**
     * パフォーマンス設定取得
     */
    getPerformanceConfig() {
        return {
            maxInitTime: this.get('performance.maxInitTime', 5000),
            targetFPS: this.get('performance.targetFPS', 60),
            memoryLimit: this.get('performance.memoryLimit', 512)
        };
    }
    
    /**
     * カラー設定取得
     */
    getColors() {
        return this.get('colors', {});
    }
    
    /**
     * 依存関係設定取得
     */
    getDependencies() {
        return {
            required: this.get('dependencies.required', []),
            optional: this.get('dependencies.optional', [])
        };
    }
    
    /**
     * デフォルトツール取得
     */
    getDefaultTool() {
        return this.get('tools.default', 'pen');
    }
    
    /**
     * 利用可能ツール一覧取得
     */
    getAvailableTools() {
        return this.get('tools.available', ['pen', 'eraser']);
    }
    
    /**
     * 🛠️ ADDED: 座標設定妥当性確認
     */
    validateCoordinateConfig(config) {
        const errors = [];
        
        if (config.precision < 0 || config.precision > 10) {
            errors.push('precision は 0-10 の範囲である必要があります');
        }
        
        if (config.scaleCompensation === true) {
            errors.push('scaleCompensation は DPI除去のため false である必要があります');
        }
        
        if (config.touchScaling <= 0) {
            errors.push('touchScaling は正の数である必要があります');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    /**
     * 描画設定取得（レガシー互換）
     */
    getDrawingConfig(tool) {
        return this.getToolConfig(tool);
    }
    
    /**
     * 設定概要ログ出力
     */
    logConfigSummary() {
        const summary = {
            app: this.get('app.name') + ' ' + this.get('app.version'),
            canvas: `${this.get('canvas.width')}x${this.get('canvas.height')}px`,
            pixi: `resolution=${this.get('pixi.resolution')}, antialias=${this.get('pixi.antialias')}`,
            coordinate: `precision=${this.get('coordinate.precision')}, scaleCompensation=${this.get('coordinate.scaleCompensation')}`,
            tools: this.get('tools.available').join(', '),
            dpiRemovalComplete: true
        };
        
        console.log('⚙️ ConfigManager 設定概要:');
        console.table(summary);
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            totalSettings: this.countSettings(this.config),
            appInfo: this.getAppInfo(),
            canvasConfig: this.getCanvasConfig(),
            pixiConfig: this.getPixiConfig(),
            coordinateConfig: this.getCoordinateConfig(), // 🛠️ ADDED
            toolsAvailable: this.getAvailableTools(),
            dpiSettings: {
                resolution: this.get('pixi.resolution'),
                autoDensity: this.get('pixi.autoDensity'),
                scaleCompensation: this.get('coordinate.scaleCompensation'),
                dpiCompensationDisabled: this.get('coordinate.dpiCompensationDisabled')
            },
            configValid: this.validateConfiguration()
        };
    }
    
    /**
     * 設定項目数カウント
     */
    countSettings(obj, count = 0) {
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    count = this.countSettings(obj[key], count);
                } else {
                    count++;
                }
            }
        }
        return count;
    }
    
    /**
     * 設定妥当性確認
     */
    validateConfiguration() {
        const issues = [];
        
        // キャンバスサイズ確認
        const canvas = this.getCanvasConfig();
        if (canvas.width < canvas.minWidth || canvas.width > canvas.maxWidth) {
            issues.push(`Canvas width out of range: ${canvas.width}`);
        }
        if (canvas.height < canvas.minHeight || canvas.height > canvas.maxHeight) {
            issues.push(`Canvas height out of range: ${canvas.height}`);
        }
        
        // 🛠️ ADDED: DPI設定確認
        const pixi = this.getPixiConfig();
        if (pixi.resolution !== 1) {
            issues.push('PixiJS resolution should be 1 for DPI removal');
        }
        if (pixi.autoDensity !== false) {
            issues.push('PixiJS autoDensity should be false for DPI removal');
        }
        
        // 🛠️ ADDED: 座標設定確認
        const coordinate = this.getCoordinateConfig();
        if (coordinate.scaleCompensation !== false) {
            issues.push('Coordinate scaleCompensation should be false for DPI removal');
        }
        
        return {
            valid: issues.length === 0,
            issues
        };
    }
    
    /**
     * 設定リセット
     */
    resetToDefault() {
        this.config = JSON.parse(JSON.stringify(this.defaultConfig));
        console.log('⚙️ ConfigManager 設定をデフォルトにリセット');
        return true;
    }
    
    /**
     * 設定エクスポート
     */
    exportConfig() {
        return JSON.stringify(this.config, null, 2);
    }
    
    /**
     * 設定インポート
     */
    importConfig(configJson) {
        try {
            const newConfig = JSON.parse(configJson);
            this.config = { ...this.defaultConfig, ...newConfig };
            console.log('⚙️ ConfigManager 設定インポート完了');
            return true;
        } catch (error) {
            console.error('❌ ConfigManager 設定インポート失敗:', error);
            return false;
        }
    }
}

// グローバル登録
if (typeof window !== 'undefined') {
    if (window.ConfigManager) {
        console.warn('⚠️ ConfigManager was already defined - replacing...');
    }
    window.ConfigManager = new ConfigManager();
    console.log('⚙️ ConfigManager グローバル登録完了（DPI除去版・座標設定追加版）');
}