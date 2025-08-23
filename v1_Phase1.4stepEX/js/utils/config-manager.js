/**
 * 🔧 ConfigManager - アプリケーション設定の保存・読み込み管理
 * ✅ UNIFIED_SYSTEM: 統一設定管理・保存システム
 * 📋 RESPONSIBILITY: 「設定値・デフォルト値の統一管理」専門
 * 
 * 📏 DESIGN_PRINCIPLE: 基盤システム・ErrorManager依存
 * 🎯 TEGAKI_NAMESPACE: Tegaki名前空間統一対応済み
 * 🔧 REGISTRY_READY: 初期化レジストリ対応済み
 * 🌈 FUTABA_COLORS: ふたば☆ちゃんねるカラー保持対応
 * 
 * 依存: ErrorManager
 * 公開: Tegaki.ConfigManager, Tegaki.ConfigManagerInstance
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

class ConfigManager {
    constructor() {
        this.storageKey = 'tegaki_config';
        this.config = {};
        this.defaultConfig = this._getDefaultConfig();
        this.autoSave = true;
        this.storage = localStorage; // localStorage または sessionStorage
        
        // 初期化
        this.load();
    }

    /**
     * 設定値を取得
     * @param {string} key - 設定キー（ドット記法対応: 'pen.size'）
     * @param {*} defaultValue - デフォルト値
     * @returns {*} 設定値
     */
    get(key, defaultValue = null) {
        try {
            const value = this._getNestedValue(this.config, key);
            return value !== undefined ? value : 
                   (this._getNestedValue(this.defaultConfig, key) ?? defaultValue);
        } catch (error) {
            // Tegaki.ErrorManagerInstance 活用（初期化後）
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'ConfigManager.get');
            } else {
                console.error('[ConfigManager.get]', error);
            }
            return defaultValue;
        }
    }

    /**
     * 設定値を設定
     * @param {string|object} key - 設定キーまたは設定オブジェクト
     * @param {*} value - 設定値（keyがオブジェクトの場合は無視）
     * @returns {boolean} 成功/失敗
     */
    set(key, value = undefined) {
        try {
            if (typeof key === 'object' && key !== null) {
                // オブジェクト一括設定
                return this._setMultiple(key);
            } else {
                // 単一設定
                return this._setSingle(key, value);
            }
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'ConfigManager.set');
            } else {
                console.error('[ConfigManager.set]', error);
            }
            return false;
        }