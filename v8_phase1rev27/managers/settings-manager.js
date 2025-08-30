/**
 * ⚙️ SettingsManager - ツール設定管理
 * 📋 RESPONSIBILITY: 各ツールの設定値管理のみ
 * 🚫 PROHIBITION: UI操作・描画処理・複雑な変換処理
 * ✅ PERMISSION: 設定値保存・取得・ツールへの適用・妥当性検証
 * 
 * 📏 DESIGN_PRINCIPLE: 設定値の一元管理・ツール間共通設定の提供
 * 🔄 INTEGRATION: 各ToolクラスのsetXXXメソッドと連携
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

if (!window.Tegaki.SettingsManager) {
    /**
     * SettingsManager - ツール設定一元管理
     * Phase1: 基本設定（色・線幅・透明度）
     */
    class SettingsManager {
        constructor() {
            console.log('⚙️ SettingsManager 設定管理システム作成');
            
            // グローバル設定（全ツール共通）
            this.globalSettings = {
                // 描画設定
                color: 0x800000,           // ふたば風マルーン
                lineWidth: 4,              // デフォルト線幅
                opacity: 1.0,              // 不透明度
                
                // キャンバス設定
                canvasWidth: 400,
                canvasHeight: 400,
                backgroundColor: 0xffffee,  // ふたば風背景
                
                // システム設定
                smoothing: true,           // スムージング
                gpuAcceleration: true      // GPU加速
            };
            
            // ツール別設定
            this.toolSettings = {
                pen: {
                    color: 0x800000,
                    lineWidth: 4,
                    opacity: 1.0,
                    smoothing: true,
                    pressureSensitive: false
                },
                eraser: {
                    eraserSize: 20,
                    eraserOpacity: 1.0,
                    eraseMode: 'blend' // 'blend' or 'mask'
                }
            };
            
            // 設定変更通知用
            this.listeners = new Map();
            
            console.log('✅ SettingsManager 初期化完了');
        }
        
        /**
         * グローバル設定取得
         */
        getGlobalSetting(key) {
            return this.globalSettings[key];
        }
        
        /**
         * グローバル設定変更
         */
        setGlobalSetting(key, value) {
            if (!(key in this.globalSettings)) {
                console.warn(`⚠️ 未知のグローバル設定: ${key}`);
                return false;
            }
            
            // 妥当性検証
            if (!this.validateSetting(key, value)) {
                console.warn(`⚠️ 無効な設定値: ${key}=${value}`);
                return false;
            }
            
            const oldValue = this.globalSettings[key];
            this.globalSettings[key] = value;
            
            console.log(`⚙️ グローバル設定変更: ${key}=${oldValue}→${value}`);
            
            // 設定変更通知
            this.notifySettingChange('global', key, value, oldValue);
            
            return true;
        }
        
        /**
         * ツール設定取得
         */
        getToolSetting(toolName, key) {
            const toolSettings = this.toolSettings[toolName];
            if (!toolSettings) {
                console.warn(`⚠️ 未知のツール: ${toolName}`);
                return null;
            }
            
            return toolSettings[key];
        }
        
        /**
         * ツール設定変更
         */
        setToolSetting(toolName, key, value) {
            const toolSettings = this.toolSettings[toolName];
            if (!toolSettings) {
                console.warn(`⚠️ 未知のツール: ${toolName}`);
                return false;
            }
            
            if (!(key in toolSettings)) {
                console.warn(`⚠️ 未知のツール設定: ${toolName}.${key}`);
                return false;
            }
            
            // 妥当性検証
            if (!this.validateSetting(key, value)) {
                console.warn(`⚠️ 無効な設定値: ${toolName}.${key}=${value}`);
                return false;
            }
            
            const oldValue = toolSettings[key];
            toolSettings[key] = value;
            
            console.log(`⚙️ ツール設定変更: ${toolName}.${key}=${oldValue}→${value}`);
            
            // 設定変更通知
            this.notifySettingChange(toolName, key, value, oldValue);
            
            return true;
        }
        
        /**
         * ツール設定全取得
         */
        getToolSettings(toolName) {
            const toolSettings = this.toolSettings[toolName];
            if (!toolSettings) {
                console.warn(`⚠️ 未知のツール: ${toolName}`);
                return {};
            }
            
            return { ...toolSettings }; // コピーを返す
        }
        
        /**
         * 設定妥当性検証
         */
        validateSetting(key, value) {
            switch (key) {
                case 'color':
                    return typeof value === 'number' && value >= 0 && value <= 0xFFFFFF;
                    
                case 'lineWidth':
                case 'eraserSize':
                    return typeof value === 'number' && value > 0 && value <= 100;
                    
                case 'opacity':
                case 'eraserOpacity':
                    return typeof value === 'number' && value >= 0 && value <= 1;
                    
                case 'canvasWidth':
                case 'canvasHeight':
                    return typeof value === 'number' && value >= 100 && value <= 4000;
                    
                case 'backgroundColor':
                    return typeof value === 'number' && value >= 0 && value <= 0xFFFFFF;
                    
                case 'smoothing':
                case 'gpuAcceleration':
                case 'pressureSensitive':
                    return typeof value === 'boolean';
                    
                case 'eraseMode':
                    return value === 'blend' || value === 'mask';
                    
                default:
                    return true; // 不明な設定は通す（拡張性）
            }
        }
        
        /**
         * 色設定（文字列対応）
         */
        setColor(color, toolName = null) {
            let colorValue;
            
            // 文字列色を数値に変換
            if (typeof color === 'string') {
                colorValue = parseInt(color.replace('#', ''), 16);
            } else if (typeof color === 'number') {
                colorValue = color;
            } else {
                console.warn('⚠️ 無効な色指定:', color);
                return false;
            }
            
            if (toolName) {
                // ツール固有色設定
                return this.setToolSetting(toolName, 'color', colorValue);
            } else {
                // グローバル色設定
                return this.setGlobalSetting('color', colorValue);
            }
        }
        
        /**
         * 色文字列取得
         */
        getColorString(toolName = null) {
            const color = toolName ? 
                this.getToolSetting(toolName, 'color') : 
                this.getGlobalSetting('color');
            
            return `#${color.toString(16).padStart(6, '0')}`;
        }
        
        /**
         * 設定変更リスナー登録
         */
        addSettingListener(listenerId, callback) {
            this.listeners.set(listenerId, callback);
            console.log(`⚙️ 設定変更リスナー登録: ${listenerId}`);
        }
        
        /**
         * 設定変更リスナー削除
         */
        removeSettingListener(listenerId) {
            const removed = this.listeners.delete(listenerId);
            if (removed) {
                console.log(`⚙️ 設定変更リスナー削除: ${listenerId}`);
            }
        }
        
        /**
         * 設定変更通知
         */
        notifySettingChange(scope, key, newValue, oldValue) {
            this.listeners.forEach((callback, listenerId) => {
                try {
                    callback(scope, key, newValue, oldValue);
                } catch (error) {
                    console.error(`❌ 設定変更通知エラー [${listenerId}]:`, error);
                }
            });
        }
        
        /**
         * ツールに設定適用
         */
        applySettingsToTool(tool, toolName) {
            if (!tool || !toolName) {
                console.warn('⚠️ ツールまたはツール名が指定されていません');
                return false;
            }
            
            const settings = this.getToolSettings(toolName);
            if (!settings) return false;
            
            try {
                // 各設定をツールに適用
                Object.entries(settings).forEach(([key, value]) => {
                    switch (key) {
                        case 'color':
                            if (tool.setPenColor) tool.setPenColor(value);
                            break;
                        case 'lineWidth':
                            if (tool.setPenWidth) tool.setPenWidth(value);
                            break;
                        case 'opacity':
                            if (tool.setPenOpacity) tool.setPenOpacity(value);
                            break;
                        case 'eraserSize':
                            if (tool.setEraserSize) tool.setEraserSize(value);
                            break;
                        case 'eraserOpacity':
                            if (tool.setEraserOpacity) tool.setEraserOpacity(value);
                            break;
                        case 'smoothing':
                            if (tool.setSmoothing) tool.setSmoothing(value);
                            break;
                    }
                });
                
                console.log(`✅ 設定適用完了: ${toolName}`);
                return true;
                
            } catch (error) {
                console.error(`❌ 設定適用エラー [${toolName}]:`, error);
                return false;
            }
        }
        
        /**
         * 設定リセット
         */
        resetSettings(scope = 'all') {
            if (scope === 'all' || scope === 'global') {
                this.globalSettings = {
                    color: 0x800000,
                    lineWidth: 4,
                    opacity: 1.0,
                    canvasWidth: 400,
                    canvasHeight: 400,
                    backgroundColor: 0xffffee,
                    smoothing: true,
                    gpuAcceleration: true
                };
                console.log('🔄 グローバル設定リセット完了');
            }
            
            if (scope === 'all' || scope === 'tools') {
                this.toolSettings = {
                    pen: {
                        color: 0x800000,
                        lineWidth: 4,
                        opacity: 1.0,
                        smoothing: true,
                        pressureSensitive: false
                    },
                    eraser: {
                        eraserSize: 20,
                        eraserOpacity: 1.0,
                        eraseMode: 'blend'
                    }
                };
                console.log('🔄 ツール設定リセット完了');
            }
        }
        
        /**
         * デバッグ情報取得
         */
        getDebugInfo() {
            return {
                globalSettings: { ...this.globalSettings },
                toolSettings: JSON.parse(JSON.stringify(this.toolSettings)),
                listenerCount: this.listeners.size
            };
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.SettingsManager = SettingsManager;
    
    // インスタンス作成（シングルトン）
    window.Tegaki.SettingsManagerInstance = new SettingsManager();
    
    console.log('⚙️ SettingsManager Loaded - 設定管理システム完成');
} else {
    console.log('⚠️ SettingsManager already defined - skipping redefinition');
}

console.log('⚙️ settings-manager.js loaded - ツール設定一元管理完了');