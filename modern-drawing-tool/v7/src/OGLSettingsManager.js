// OGLSettingsManager.js - Phase1修正版（色彩設定責務強化・デフォルト値確認）
export class OGLSettingsManager {
    constructor(oglEngine) {
        this.engine = oglEngine;
        this.settings = this.loadDefaultSettings();
        this.listeners = new Map();
        
        this.loadUserSettings();
        console.log('⚙️ Phase1設定管理 - 色彩責務強化完了');
    }
    
    // Phase1対応設定定義（色彩責務強化・デフォルト値確認）
    loadDefaultSettings() {
        return {
            // 描画設定（色彩責務強化 - Phase1核心）
            drawing: {
                color: '#800000',           // メインカラー確実設定（Phase1要件）
                penSize: 3,
                opacity: 100,
                pressureSensitivity: 50,
                smoothing: true,
                minDistance: 0.3            // Phase1線品質向上対応
            },
            
            // 品質設定（Phase1線品質改善対応）
            quality: {
                antialiasing: true,
                smoothingFactor: 0.25,      // Phase1最適化値
                pressureCurve: 'linear',
                blendMode: 'normal',
                segmentDensity: 3,          // Phase1密度向上
                continuityThreshold: 0.8    // Phase1連続性保証
            },
            
            // インタラクション設定
            interaction: {
                multiTouchEnabled: true,
                gestureEnabled: true,
                previewEnabled: true,
                inputThrottleMs: 16
            },
            
            // UI表示設定
            ui: {
                showControlPanel: true,
                showStatusInfo: true,
                showActionButtons: true,
                showColorPicker: false,
                panelOpacity: 0.95
            },
            
            // ショートカット設定
            shortcuts: {
                penTool: 'p',
                undo: 'ctrl+z',
                clear: 'ctrl+c',
                fullscreen: 'f',
                togglePanel: 'tab',
                penSizeUp: ']',
                penSizeDown: '[',
                opacityUp: 'shift+]',
                opacityDown: 'shift+[',
                colorPicker: 'c'
            },
            
            // 色彩システム設定（Phase1責務強化）
            colorSystem: {
                enabled: true,
                defaultColor: '#800000',    // Phase1要件：確実なデフォルト色
                defaultPalette: [
                    '#800000',  // メインカラー（赤茶）- Phase1要件
                    '#000000',  // 黒
                    '#FF0000',  // 赤
                    '#00FF00',  // 緑
                    '#0000FF',  // 青
                    '#FFFF00',  // 黄
                    '#FF00FF',  // マゼンタ
                    '#00FFFF'   // シアン
                ],
                recentColors: ['#800000'],  // Phase1デフォルト色で初期化
                maxRecentColors: 8
            }
        };
    }
    
    // 設定取得
    get(path) {
        const keys = path.split('.');
        let value = this.settings;
        for (const key of keys) {
            value = value?.[key];
        }
        return value;
    }
    
    // 設定更新・配信（Phase1色彩変更強化）
    set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let target = this.settings;
        
        for (const key of keys) {
            if (!target[key]) target[key] = {};
            target = target[key];
        }
        
        const oldValue = target[lastKey];
        target[lastKey] = value;
        
        // Phase1色彩変更特別処理強化
        if (path === 'drawing.color') {
            this.handleColorChangePhase1(value, oldValue);
        }
        
        // 変更通知
        this.notifyChange(path, value, oldValue);
        this.saveUserSettings();
        
        return true;
    }
    
    // Phase1色彩変更特別処理（責務強化）
    handleColorChangePhase1(newColor, oldColor) {
        // 色彩形式検証強化
        if (!this.isValidColor(newColor)) {
            console.warn('❌ Phase1無効色彩:', newColor, '→ #800000に復元');
            newColor = '#800000';
            this.settings.drawing.color = newColor;
        }
        
        // 最近使用色彩更新
        this.addToRecentColors(newColor);
        
        // Phase1色彩変更ログ強化
        console.log(`🎨 Phase1色彩変更: ${oldColor} → ${newColor}`);
        
        // 色彩システム同期
        this.settings.colorSystem.defaultColor = newColor;
        
        // Phase1色彩変更イベント発火
        this.notifyChange('colorSystem.currentColor', newColor, oldColor);
    }
    
    // 色彩妥当性検証（Phase1強化）
    isValidColor(color) {
        if (typeof color !== 'string') return false;
        
        // HEX形式検証強化
        const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        return hexPattern.test(color);
    }
    
    // 最近使用色彩管理（Phase1最適化）
    addToRecentColors(color) {
        if (!this.isValidColor(color)) return;
        
        const recentColors = this.get('colorSystem.recentColors') || [];
        const maxRecent = this.get('colorSystem.maxRecentColors') || 8;
        
        // 重複除去・先頭追加
        const filtered = recentColors.filter(c => c !== color);
        const updated = [color, ...filtered].slice(0, maxRecent);
        
        // 直接更新（通知回避）
        this.settings.colorSystem.recentColors = updated;
    }
    
    // 変更監視・通知システム
    onChange(path, callback) {
        if (!this.listeners.has(path)) {
            this.listeners.set(path, []);
        }
        this.listeners.get(path).push(callback);
    }
    
    notifyChange(path, value, oldValue = null) {
        // 完全一致通知
        if (this.listeners.has(path)) {
            this.listeners.get(path).forEach(callback => {
                try {
                    callback(value, path, oldValue);
                } catch (error) {
                    console.warn(`Phase1設定リスナーエラー ${path}:`, error);
                }
            });
        }
        
        // 親パス通知
        const parentPath = path.split('.').slice(0, -1).join('.');
        if (parentPath && this.listeners.has(parentPath)) {
            this.listeners.get(parentPath).forEach(callback => {
                try {
                    callback(this.get(parentPath), parentPath, null);
                } catch (error) {
                    console.warn(`Phase1親設定リスナーエラー ${parentPath}:`, error);
                }
            });
        }
    }
    
    // === Phase1色彩制御専用API（責務強化） ===
    
    // 色彩取得（Phase1強化版）
    getColor() {
        return this.get('drawing.color') || '#800000';
    }
    
    // 色彩設定（Phase1検証強化版）
    setColor(color) {
        if (!this.isValidColor(color)) {
            console.warn('❌ Phase1色彩設定失敗:', color);
            return false;
        }
        return this.set('drawing.color', color);
    }
    
    // 色彩パレット取得
    getColorPalette() {
        return this.get('colorSystem.defaultPalette') || ['#800000'];
    }
    
    // 最近使用色彩取得
    getRecentColors() {
        return this.get('colorSystem.recentColors') || ['#800000'];
    }
    
    // 色彩システム状態
    isColorSystemEnabled() {
        return this.get('colorSystem.enabled') === true;
    }
    
    // Phase1色彩リセット
    resetColorToDefault() {
        const defaultColor = '#800000';
        this.setColor(defaultColor);
        this.settings.colorSystem.recentColors = [defaultColor];
        console.log('🔄 Phase1色彩デフォルト復元:', defaultColor);
        return defaultColor;
    }
    
    // === Phase1線品質設定API（品質向上対応） ===
    
    // 線品質パラメータ取得（Phase1対応）
    getStrokeQuality() {
        return {
            minDistance: this.get('drawing.minDistance') || 0.3,
            segmentDensity: this.get('quality.segmentDensity') || 3,
            smoothingFactor: this.get('quality.smoothingFactor') || 0.25,
            continuityThreshold: this.get('quality.continuityThreshold') || 0.8
        };
    }
    
    // 線品質パラメータ更新（Phase1検証強化）
    setStrokeQuality(params) {
        const updates = {};
        
        if (params.minDistance !== undefined) {
            updates['drawing.minDistance'] = Math.max(0.1, Math.min(1.0, params.minDistance));
        }
        if (params.segmentDensity !== undefined) {
            updates['quality.segmentDensity'] = Math.max(1, Math.min(10, params.segmentDensity));
        }
        if (params.smoothingFactor !== undefined) {
            updates['quality.smoothingFactor'] = Math.max(0, Math.min(1, params.smoothingFactor));
        }
        if (params.continuityThreshold !== undefined) {
            updates['quality.continuityThreshold'] = Math.max(0.5, Math.min(2.0, params.continuityThreshold));
        }
        
        // 一括更新
        Object.entries(updates).forEach(([path, value]) => {
            this.set(path, value);
        });
        
        console.log('🔧 Phase1線品質更新:', updates);
        return this.getStrokeQuality();
    }
    
    // === 永続化（Phase1デバッグ対応） ===
    
    saveUserSettings() {
        try {
            // Claude.ai環境ではlocalStorage非対応のため、ログ出力のみ
            console.log('💾 Phase1設定保存 (localStorage非対応環境):', {
                color: this.getColor(),
                strokeQuality: this.getStrokeQuality(),
                recentColors: this.getRecentColors().length,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.warn('Phase1設定保存失敗:', error);
        }
    }
    
    loadUserSettings() {
        try {
            // Claude.ai環境ではlocalStorage非対応のため、デフォルト設定のみ使用
            console.log('📖 Phase1設定読み込み完了 (デフォルト設定使用)');
        } catch (error) {
            console.warn('Phase1設定読み込み失敗:', error);
        }
    }
    
    // 設定マージ
    mergeSettings(defaults, user) {
        const merged = { ...defaults };
        for (const [key, value] of Object.entries(user)) {
            if (typeof value === 'object' && !Array.isArray(value)) {
                merged[key] = this.mergeSettings(defaults[key] || {}, value);
            } else {
                merged[key] = value;
            }
        }
        return merged;
    }
    
    // 全設定取得
    getAll() {
        return { ...this.settings };
    }
    
    // Phase1リセット（色彩対応強化）
    reset() {
        const oldSettings = { ...this.settings };
        this.settings = this.loadDefaultSettings();
        this.saveUserSettings();
        
        // 全変更通知
        this.notifyAllChanges();
        
        console.log('🔄 Phase1設定リセット完了:', {
            defaultColor: this.getColor(),
            strokeQuality: this.getStrokeQuality(),
            timestamp: new Date().toISOString()
        });
        
        return this.settings;
    }
    
    notifyAllChanges() {
        const notifyRecursive = (obj, path = '') => {
            for (const [key, value] of Object.entries(obj)) {
                const fullPath = path ? `${path}.${key}` : key;
                if (typeof value === 'object' && !Array.isArray(value)) {
                    notifyRecursive(value, fullPath);
                }
                this.notifyChange(fullPath, value);
            }
        };
        notifyRecursive(this.settings);
    }
    
    // Phase1デバッグ情報
    debug() {
        return {
            version: 'Phase1-修正版',
            totalSettings: Object.keys(this.settings).length,
            listeners: Array.from(this.listeners.keys()),
            currentColor: this.getColor(),
            colorValid: this.isValidColor(this.getColor()),
            recentColors: this.getRecentColors(),
            strokeQuality: this.getStrokeQuality(),
            colorSystemEnabled: this.isColorSystemEnabled(),
            timestamp: new Date().toISOString()
        };
    }
}