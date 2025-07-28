// tools/ToolStore.js - OGL統一エンジン版ツール状態管理
// v5.2 OGL統一アーキテクチャ準拠

export class ToolStore extends EventTarget {
    constructor() {
        super();
        
        // ツール設定（OGL統一エンジン用）
        this.toolSettings = new Map();
        this.currentTool = 'pen';
        this.isInitialized = false;
        
        this.initialize();
    }

    initialize() {
        console.log('🗃️ ToolStore初期化開始 (OGL統一版)');
        
        // デフォルトツール設定の初期化
        this.initializeDefaultSettings();
        
        this.isInitialized = true;
        console.log('✅ ToolStore初期化完了');
    }

    initializeDefaultSettings() {
        // ペンツール設定（OGL統一仕様）
        this.toolSettings.set('pen', {
            size: 3,
            opacity: 100,
            color: '#800000',
            blendMode: 'normal',
            smoothing: 0.5,
            pressure: true,
            // OGL統一エンジン専用設定
            oglConfig: {
                polylineWidth: 3,
                shader: 'pen',
                renderMode: 'stroke'
            }
        });

        // 消しゴムツール設定（OGL統一仕様）
        this.toolSettings.set('eraser', {
            size: 10,
            opacity: 100,
            blendMode: 'destination-out',
            smoothing: 0.3,
            pressure: false,
            // OGL統一エンジン専用設定
            oglConfig: {
                polylineWidth: 10,
                shader: 'eraser',
                renderMode: 'erase'
            }
        });

        console.log('🎨 デフォルトツール設定初期化完了');
        console.log('  - ペン:', this.toolSettings.get('pen'));
        console.log('  - 消しゴム:', this.toolSettings.get('eraser'));
    }

    // === ツール選択（OGL統一エンジン連携） ===
    setCurrentTool(toolName) {
        if (!this.toolSettings.has(toolName)) {
            console.error(`❌ 不明なツール: ${toolName}`);
            return false;
        }

        const previousTool = this.currentTool;
        this.currentTool = toolName;

        console.log(`🔧 ツール変更: ${previousTool} → ${toolName}`);

        // ツール変更イベントを発火
        this.dispatchEvent(new CustomEvent('toolChanged', {
            detail: {
                tool: toolName,
                previousTool: previousTool,
                properties: this.getToolSettings(toolName)
            }
        }));

        return true;
    }

    getCurrentTool() {
        return this.currentTool;
    }

    // === ツールプロパティ管理（OGL統一エンジン用） ===
    setToolProperty(toolName, property, value) {
        if (!this.toolSettings.has(toolName)) {
            console.error(`❌ 不明なツール: ${toolName}`);
            return false;
        }

        try {
            const settings = this.toolSettings.get(toolName);
            const oldValue = settings[property];
            
            // プロパティ値の検証・正規化
            const normalizedValue = this.normalizePropertyValue(toolName, property, value);
            settings[property] = normalizedValue;

            console.log(`🔧 プロパティ更新: ${toolName}.${property} = ${oldValue} → ${normalizedValue}`);

            // OGL統一エンジン用設定の更新
            this.updateOGLConfig(toolName, property, normalizedValue);

            // プロパティ変更イベントを発火
            this.dispatchEvent(new CustomEvent('propertyChanged', {
                detail: {
                    tool: toolName,
                    property: property,
                    value: normalizedValue,
                    oldValue: oldValue
                }
            }));

            // 現在選択中のツールの場合は追加イベント
            if (toolName === this.currentTool) {
                this.dispatchEvent(new CustomEvent('currentToolPropertyChanged', {
                    detail: {
                        property: property,
                        value: normalizedValue,
                        oldValue: oldValue
                    }
                }));
            }

            return true;
        } catch (error) {
            console.error(`❌ プロパティ設定エラー (${toolName}.${property}=${value}):`, error);
            return false;
        }
    }

    getToolProperty(toolName, property) {
        const settings = this.toolSettings.get(toolName);
        return settings ? settings[property] : undefined;
    }

    getToolSettings(toolName) {
        return this.toolSettings.get(toolName) || {};
    }

    getCurrentToolSettings() {
        return this.getToolSettings(this.currentTool);
    }

    // === OGL統一エンジン専用設定管理 ===
    updateOGLConfig(toolName, property, value) {
        const settings = this.toolSettings.get(toolName);
        if (!settings || !settings.oglConfig) return;

        // プロパティに応じてOGL設定を更新
        switch (property) {
            case 'size':
                settings.oglConfig.polylineWidth = value;
                break;
            case 'opacity':
                settings.oglConfig.alpha = value / 100;
                break;
            case 'color':
                settings.oglConfig.color = value;
                break;
        }
    }

    getOGLConfig(toolName) {
        const settings = this.toolSettings.get(toolName);
        return settings ? settings.oglConfig : {};
    }

    getCurrentOGLConfig() {
        return this.getOGLConfig(this.currentTool);
    }

    // === プロパティ値の検証・正規化 ===
    normalizePropertyValue(toolName, property, value) {
        switch (property) {
            case 'size':
                const sizeMin = toolName === 'pen' ? 1 : 1;
                const sizeMax = toolName === 'pen' ? 50 : 100;
                return Math.max(sizeMin, Math.min(sizeMax, parseInt(value) || sizeMin));
                
            case 'opacity':
                return Math.max(1, Math.min(100, parseInt(value) || 100));
                
            case 'smoothing':
                return Math.max(0, Math.min(1, parseFloat(value) || 0));
                
            case 'color':
                return this.normalizeColor(value);
                
            case 'pressure':
                return Boolean(value);
                
            default:
                return value;
        }
    }

    normalizeColor(color) {
        // 簡易カラー正規化（拡張可能）
        if (typeof color === 'string' && color.startsWith('#')) {
            return color;
        }
        return '#800000'; // デフォルトカラー
    }

    // === ツール設定の一括更新 ===
    updateToolSettings(toolName, newSettings) {
        if (!this.toolSettings.has(toolName)) {
            console.error(`❌ 不明なツール: ${toolName}`);
            return false;
        }

        try {
            const currentSettings = this.toolSettings.get(toolName);
            const updatedSettings = { ...currentSettings };

            // 各プロパティを検証して更新
            Object.entries(newSettings).forEach(([property, value]) => {
                if (property === 'oglConfig') {
                    // OGL設定は直接更新
                    updatedSettings.oglConfig = { ...currentSettings.oglConfig, ...value };
                } else {
                    updatedSettings[property] = this.normalizePropertyValue(toolName, property, value);
                }
            });

            this.toolSettings.set(toolName, updatedSettings);

            console.log(`🔧 ツール設定一括更新: ${toolName}`, updatedSettings);

            // 変更イベントを発火
            this.dispatchEvent(new CustomEvent('toolSettingsUpdated', {
                detail: {
                    tool: toolName,
                    settings: updatedSettings
                }
            }));

            return true;
        } catch (error) {
            console.error(`❌ ツール設定一括更新エラー (${toolName}):`, error);
            return false;
        }
    }

    // === 設定のリセット ===
    resetToolSettings(toolName) {
        if (!toolName) {
            // 全ツールリセット
            this.initializeDefaultSettings();
            this.dispatchEvent(new CustomEvent('allToolsReset'));
            console.log('🔄 全ツール設定リセット完了');
        } else {
            // 指定ツールリセット
            this.initializeDefaultSettings();
            const resetSettings = this.toolSettings.get(toolName);
            
            this.dispatchEvent(new CustomEvent('toolReset', {
                detail: {
                    tool: toolName,
                    settings: resetSettings
                }
            }));
            
            console.log(`🔄 ツール設定リセット完了: ${toolName}`);
        }
    }

    // === ツール設定の保存・読み込み（将来拡張用） ===
    exportSettings() {
        const settings = {};
        this.toolSettings.forEach((value, key) => {
            settings[key] = { ...value };
        });
        
        return {
            version: '5.2',
            currentTool: this.currentTool,
            tools: settings,
            timestamp: Date.now()
        };
    }

    importSettings(data) {
        if (!data || data.version !== '5.2') {
            console.error('❌ 不正な設定データ');
            return false;
        }

        try {
            // ツール設定を復元
            Object.entries(data.tools).forEach(([toolName, settings]) => {
                if (this.toolSettings.has(toolName)) {
                    this.toolSettings.set(toolName, settings);
                }
            });

            // 現在のツールを復元
            if (data.currentTool && this.toolSettings.has(data.currentTool)) {
                this.setCurrentTool(data.currentTool);
            }

            console.log('✅ 設定データインポート完了');
            return true;
        } catch (error) {
            console.error('❌ 設定データインポートエラー:', error);
            return false;
        }
    }

    // === ツール一覧取得 ===
    getAvailableTools() {
        return Array.from(this.toolSettings.keys());
    }

    hasToolSettings(toolName) {
        return this.toolSettings.has(toolName);
    }

    // === 廃棄処理 ===
    dispose() {
        try {
            this.toolSettings.clear();
            this.currentTool = null;
            this.isInitialized = false;
            
            console.log('🧹 ToolStore廃棄完了');
        } catch (error) {
            console.error('❌ ToolStore廃棄エラー:', error);
        }
    }

    // === デバッグ用 ===
    getStatus() {
        return {
            initialized: this.isInitialized,
            currentTool: this.currentTool,
            toolCount: this.toolSettings.size,
            availableTools: this.getAvailableTools()
        };
    }

    logCurrentSettings() {
        console.log('📊 現在のツール設定:');
        console.log(`  現在のツール: ${this.currentTool}`);
        this.toolSettings.forEach((settings, toolName) => {
            console.log(`  ${toolName}:`, settings);
        });
    }
}