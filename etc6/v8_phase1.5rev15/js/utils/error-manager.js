/**
 * 🚨 ErrorManager Simple - 専任エラー処理・シンプル版
 * 📋 RESPONSIBILITY: 全てのエラー表示・通知・ログの一元化のみ
 * 🚫 PROHIBITION: 複雑な分類・ループ防止・統計機能・設定管理
 * ✅ PERMISSION: エラー表示・UI通知・ログ出力・例外記録
 * 
 * 📏 DESIGN_PRINCIPLE: 単純・直線的・専任処理
 * 🔄 INTEGRATION: 他ファイルのエラー処理を一手に引き受け
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

/**
 * ErrorManager - シンプル版（30行以内）
 * 全エラー処理の専任担当
 */
class ErrorManager {
    constructor() {
        console.log('🚨 ErrorManager Simple 作成');
        this.errors = []; // エラー記録
    }
    
    /**
     * エラー表示（専任責務）
     */
    showError(type = 'error', message = '', options = {}) {
        // ログ記録
        this.errors.push({
            type,
            message,
            time: new Date().toISOString(),
            context: options.context || ''
        });
        
        // コンソール出力
        const emoji = { info: '💡', warning: '⚠️', error: '❌', critical: '🔥' };
        console.log(`${emoji[type] || '❌'} ${type.toUpperCase()}: ${message}`, options.context || '');
        
        // 視覚的表示
        this.showVisualNotification(type, message, options);
    }
    
    /**
     * 視覚的通知表示
     */
    showVisualNotification(type, message, options) {
        // 既存の通知削除
        const existing = document.getElementById('error-notification');
        if (existing) existing.remove();
        
        // 新しい通知作成
        const notification = document.createElement('div');
        notification.id = 'error-notification';
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 10000;
            padding: 12px 16px; border-radius: 6px; font-family: Arial, sans-serif;
            font-size: 14px; max-width: 350px; word-wrap: break-word;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            background: ${this.getBackgroundColor(type)};
            color: ${this.getTextColor(type)};
            border: 2px solid ${this.getBorderColor(type)};
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // 自動削除
        setTimeout(() => notification.remove(), options.duration || 5000);
    }
    
    /**
     * 色設定
     */
    getBackgroundColor(type) {
        const colors = {
            info: '#e6f7ff',
            warning: '#fff8e6', 
            error: '#ffe6e6',
            critical: '#ffcccc'
        };
        return colors[type] || '#ffe6e6';
    }
    
    getTextColor(type) {
        const colors = {
            info: '#0066cc',
            warning: '#cc6600',
            error: '#cc0000', 
            critical: '#990000'
        };
        return colors[type] || '#cc0000';
    }
    
    getBorderColor(type) {
        const colors = {
            info: '#99ccff',
            warning: '#ffcc99',
            error: '#ff9999',
            critical: '#ff6666'
        };
        return colors[type] || '#ff9999';
    }
    
    /**
     * ショートカットメソッド
     */
    showInfo(message, options = {}) { this.showError('info', message, options); }
    showWarning(message, options = {}) { this.showError('warning', message, options); }
    showCritical(message, options = {}) { this.showError('critical', message, options); }
    
    /**
     * エラー記録取得（デバッグ用）
     */
    getErrors() { return this.errors; }
    
    /**
     * エラークリア
     */
    clear() { 
        this.errors = []; 
        console.log('🗑️ ErrorManager errors cleared');
    }
}

// Managers統一ライフサイクルメソッド一括追加
// NavigationManager・RecordManager・ShortcutManager等に統一ライフサイクルメソッドを追加

(function() {
    'use strict';
    
    console.log('🔧 Managers統一ライフサイクルメソッド一括追加開始');
    
    /**
     * Manager統一ライフサイクルメソッド追加
     * @param {Function} ManagerClass Manager クラス
     * @param {string} className クラス名
     */
    function addLifecycleMethods(ManagerClass, className) {
        if (!ManagerClass) {
            console.warn(`🔧 ${className} not found, skipping lifecycle extension`);
            return;
        }
        
        const prototype = ManagerClass.prototype;
        
        // configure（設定注入）
        if (!prototype.configure) {
            prototype.configure = function(config) {
                this._config = { ...config };
                this._configured = true;
            };
        }
        
        // attach（参照注入）
        if (!prototype.attach) {
            prototype.attach = function(context) {
                this._context = context;
                this._attached = true;
                
                // Manager固有の参照設定
                if (className === 'NavigationManager') {
                    this._canvasManager = context.canvasManager;
                    this._coordinateManager = context.coordinateManager;
                } else if (className === 'CoordinateManager') {
                    this._canvasManager = context.canvasManager || context.canvas;
                } else if (className === 'RecordManager') {
                    // RecordManagerは独立動作
                } else if (className === 'ShortcutManager') {
                    // ShortcutManagerは独立動作
                }
            };
        }
        
        // init（内部初期化）
        if (!prototype.init) {
            prototype.init = function() {
                this._initialized = true;
                
                // Manager固有の初期化処理
                if (className === 'NavigationManager') {
                    // Navigation固有初期化があれば実行
                    if (typeof this.initializeNavigation === 'function') {
                        this.initializeNavigation();
                    }
                } else if (className === 'CoordinateManager') {
                    // Coordinate固有初期化があれば実行
                    if (typeof this.initializeCoordinates === 'function') {
                        this.initializeCoordinates();
                    }
                }
                
                return Promise.resolve();
            };
        }
        
        // isReady（準備完了確認）
        if (!prototype.isReady) {
            prototype.isReady = function() {
                return this._initialized || true;
            };
        }
        
        // dispose（解放）
        if (!prototype.dispose) {
            prototype.dispose = function() {
                this._initialized = false;
                this._attached = false;
                this._configured = false;
                this._context = null;
                this._config = null;
            };
        }
        
        console.log(`🔧 ${className} 統一ライフサイクルメソッド追加完了`);
    }
    
    // 各Manager拡張実行
    const managersToExtend = [
        { class: window.Tegaki?.EventBus, name: 'EventBus' },
        { class: window.Tegaki?.NavigationManager, name: 'NavigationManager' },
        { class: window.Tegaki?.RecordManager, name: 'RecordManager' },
        { class: window.Tegaki?.ShortcutManager, name: 'ShortcutManager' },
        { class: window.Tegaki?.CoordinateManager, name: 'CoordinateManager' }
    ];
    
    for (const manager of managersToExtend) {
        addLifecycleMethods(manager.class, manager.name);
    }
    
    console.log('🔧 Managers統一ライフサイクルメソッド一括追加完了');
    
})();

// Tegaki名前空間に登録
window.Tegaki.ErrorManager = ErrorManager;

// インスタンス作成・登録
window.Tegaki.ErrorManagerInstance = new ErrorManager();

console.log('🚨 ErrorManager Simple Loaded - 専任エラー処理・シンプル構造');