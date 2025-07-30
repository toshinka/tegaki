// Phase 1.5: OGL統一設定統合管理システム
export class OGLSettingsManager {
    constructor(oglEngine) {
        this.engine = oglEngine;
        this.settings = this.loadDefaultSettings();
        this.listeners = new Map();
        
        this.loadUserSettings();
    }
    
    // 統合設定定義
    loadDefaultSettings() {
        return {
            // UI・ショートカット設定
            shortcuts: {
                penTool: 'p',
                undo: 'ctrl+z',
                clear: 'ctrl+c',
                fullscreen: 'f',
                togglePanel: 'tab',
                penSizeUp: ']',
                penSizeDown: '[',
                opacityUp: 'shift+]',
                opacityDown: 'shift+['
            },
            
            // 描画設定
            drawing: {
                penSize: 3,
                opacity: 100,
                pressureSensitivity: 50,
                smoothing: true,
                minDistance: 1.0
            },
            
            // 品質設定
            quality: {
                antialiasing: true,
                smoothingFactor: 0.5,
                pressureCurve: 'linear',
                blendMode: 'normal'
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
                panelOpacity: 0.95
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
    
    // 設定更新・配信
    set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let target = this.settings;
        
        for (const key of keys) {
            if (!target[key]) target[key] = {};
            target = target[key];
        }
        
        target[lastKey] = value;
        
        // 変更通知
        this.notifyChange(path, value);
        this.saveUserSettings();
    }
    
    // 変更監視・通知システム
    onChange(path, callback) {
        if (!this.listeners.has(path)) {
            this.listeners.set(path, []);
        }
        this.listeners.get(path).push(callback);
    }
    
    notifyChange(path, value) {
        // 完全一致
        if (this.listeners.has(path)) {
            this.listeners.get(path).forEach(callback => callback(value, path));
        }
        
        // 親パス一致（shortcuts.* → shortcuts変更通知）
        const parentPath = path.split('.').slice(0, -1).join('.');
        if (parentPath && this.listeners.has(parentPath)) {
            this.listeners.get(parentPath).forEach(callback => callback(this.get(parentPath), parentPath));
        }
    }
    
    // 永続化
    saveUserSettings() {
        try {
            // 実際の実装ではlocalStorageを使用しますが、Claude.ai環境では
            // localStorage非対応のため、コメントアウト
            // localStorage.setItem('oglDrawingSettings', JSON.stringify(this.settings));
            console.log('Settings saved (localStorage disabled in Claude.ai)');
        } catch (error) {
            console.warn('Settings save failed:', error);
        }
    }
    
    loadUserSettings() {
        try {
            // 実際の実装ではlocalStorageを使用しますが、Claude.ai環境では
            // localStorage非対応のため、コメントアウト
            // const saved = localStorage.getItem('oglDrawingSettings');
            // if (saved) {
            //     const userSettings = JSON.parse(saved);
            //     this.settings = this.mergeSettings(this.settings, userSettings);
            // }
            console.log('Settings loaded (localStorage disabled in Claude.ai)');
        } catch (error) {
            console.warn('Settings load failed:', error);
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
    
    // リセット
    resetToDefaults() {
        this.settings = this.loadDefaultSettings();
        this.saveUserSettings();
        
        // 全変更通知
        this.notifyAllChanges();
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
}