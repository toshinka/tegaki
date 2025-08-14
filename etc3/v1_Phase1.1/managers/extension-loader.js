/**
 * 🔌 ExtensionLoader - CDNライブラリ検出・管理（緊急修正版）
 * 責務: 
 * - CDN経由ライブラリの自動検出
 * - 利用可能拡張機能の管理
 * - フォールバック処理
 * - エラーハンドリング強化
 * 
 * 🚨 緊急修正内容:
 * - 構文エラー修正
 * - エラーハンドリング強化
 * - 最小限機能での動作保証
 */

class ExtensionLoader {
    constructor() {
        this.extensions = {};
        this.totalCount = 0;
        this.loadedCount = 0;
    }
    
    async detectAvailableExtensions() {
        console.log('🔍 CDN拡張ライブラリ検出開始...');
        
        try {
            // 基本ライブラリチェック
            this.checkBasicLibraries();
            
            // 拡張ライブラリチェック
            this.checkPixiUI();
            this.checkPixiViewport();
            this.checkPixiFilters();
            this.checkGSAP();
            this.checkLodash();
            this.checkHammer();
            
            this.reportLoadStatus();
            return this.extensions;
        } catch (error) {
            console.error('❌ ExtensionLoader エラー:', error);
            return this.createFallbackExtensions();
        }
    }
    
    checkBasicLibraries() {
        // PIXI基本確認
        this.totalCount++;
        if (typeof PIXI !== 'undefined') {
            this.extensions.PIXI = { 
                available: true,
                version: PIXI.VERSION || 'unknown',
                source: 'CDN'
            };
            this.loadedCount++;
            console.log('✅ PixiJS 検出 -', PIXI.VERSION || 'バージョン不明');
        } else {
            this.extensions.PIXI = { available: false };
            console.error('❌ PixiJS 未検出 - 必須ライブラリ');
        }
    }
    
    checkPixiUI() {
        this.totalCount++;
        try {
            if (typeof PIXI !== 'undefined' && PIXI.UI) {
                console.log('✅ @pixi/ui 検出 - UIコンポーネント利用可能');
                this.extensions.UI = {
                    Button: PIXI.UI.Button,
                    Slider: PIXI.UI.Slider,
                    available: true,
                    source: 'CDN'
                };
                this.loadedCount++;
            } else if (typeof typedSignals !== 'undefined' && typeof PIXI !== 'undefined') {
                console.warn('⚠️ @pixi/ui 部分検出 - typedSignalsは利用可能');
                this.extensions.UI = { 
                    available: false,
                    reason: 'PIXI.UI未定義'
                };
            } else {
                console.warn('⚠️ @pixi/ui 未検出 - 手動UI実装使用');
                this.extensions.UI = { 
                    available: false,
                    reason: 'ライブラリ未読み込み'
                };
            }
        } catch (error) {
            console.error('❌ @pixi/ui チェックエラー:', error);
            this.extensions.UI = { available: false, error: error.message };
        }
    }
    
    checkPixiViewport() {
        this.totalCount++;
        try {
            if (typeof Viewport !== 'undefined') {
                console.log('✅ pixi-viewport 検出 - 無限キャンバス機能利用可能');
                this.extensions.Viewport = {
                    Viewport: Viewport,
                    available: true,
                    source: 'CDN'
                };
                this.loadedCount++;
            } else {
                console.warn('⚠️ pixi-viewport 未検出 - キャンバス移動は独自実装使用');
                this.extensions.Viewport = { available: false };
            }
        } catch (error) {
            console.error('❌ pixi-viewport チェックエラー:', error);
            this.extensions.Viewport = { available: false, error: error.message };
        }
    }
    
    checkPixiFilters() {
        this.totalCount++;
        try {
            if (typeof PIXI !== 'undefined' && PIXI.filters) {
                console.log('✅ pixi-filters 検出 - フィルター効果利用可能');
                this.extensions.Filters = {
                    filters: PIXI.filters,
                    available: true,
                    source: 'CDN'
                };
                this.loadedCount++;
            } else {
                console.warn('⚠️ pixi-filters 未検出 - フィルター効果無効');
                this.extensions.Filters = { available: false };
            }
        } catch (error) {
            console.error('❌ pixi-filters チェックエラー:', error);
            this.extensions.Filters = { available: false, error: error.message };
        }
    }
    
    checkGSAP() {
        this.totalCount++;
        try {
            if (typeof gsap !== 'undefined') {
                console.log('✅ GSAP 検出 - 高性能アニメーション利用可能');
                this.extensions.GSAP = {
                    gsap: gsap,
                    available: true,
                    source: 'CDN'
                };
                this.loadedCount++;
            } else {
                console.warn('⚠️ GSAP 未検出 - CSS遷移使用');
                this.extensions.GSAP = { available: false };
            }
        } catch (error) {
            console.error('❌ GSAP チェックエラー:', error);
            this.extensions.GSAP = { available: false, error: error.message };
        }
    }
    
    checkLodash() {
        this.totalCount++;
        try {
            if (typeof _ !== 'undefined') {
                console.log('✅ Lodash 検出 - ユーティリティ関数利用可能');
                this.extensions.Lodash = {
                    _: _,
                    available: true,
                    source: 'CDN'
                };
                this.loadedCount++;
            } else {
                console.warn('⚠️ Lodash 未検出 - 独自実装使用');
                this.extensions.Lodash = { available: false };
            }
        } catch (error) {
            console.error('❌ Lodash チェックエラー:', error);
            this.extensions.Lodash = { available: false, error: error.message };
        }
    }
    
    checkHammer() {
        this.totalCount++;
        try {
            if (typeof Hammer !== 'undefined') {
                console.log('✅ Hammer.js 検出 - タッチジェスチャー利用可能');
                this.extensions.Hammer = {
                    Hammer: Hammer,
                    available: true,
                    source: 'CDN'
                };
                this.loadedCount++;
            } else {
                console.warn('⚠️ Hammer.js 未検出 - 基本タッチのみ');
                this.extensions.Hammer = { available: false };
            }
        } catch (error) {
            console.error('❌ Hammer.js チェックエラー:', error);
            this.extensions.Hammer = { available: false, error: error.message };
        }
    }
    
    reportLoadStatus() {
        const loadRate = Math.round((this.loadedCount / this.totalCount) * 100);
        console.log(`📊 拡張ライブラリ読み込み完了: ${this.loadedCount}/${this.totalCount} (${loadRate}%)`);
        
        if (loadRate < 50) {
            console.warn('⚠️ 拡張ライブラリの読み込み率が低いです。CDNの確認をお勧めします。');
        }
        
        // 読み込み成功したライブラリの詳細を表示
        const loadedLibs = Object.entries(this.extensions)
            .filter(([name, ext]) => ext.available)
            .map(([name]) => name);
        
        if (loadedLibs.length > 0) {
            console.log(`✅ 読み込み成功: ${loadedLibs.join(', ')}`);
        }
        
        // 失敗したライブラリの詳細を表示
        const failedLibs = Object.entries(this.extensions)
            .filter(([name, ext]) => !ext.available)
            .map(([name, ext]) => ({ name, reason: ext.reason || ext.error || '不明' }));
        
        if (failedLibs.length > 0) {
            console.warn('❌ 読み込み失敗:', failedLibs);
        }
    }
    
    createFallbackExtensions() {
        console.warn('🔄 フォールバック拡張セット作成...');
        return {
            PIXI: { available: typeof PIXI !== 'undefined' },
            UI: { available: false },
            Viewport: { available: false },
            Filters: { available: false },
            SVG: { available: false },
            GSAP: { available: false },
            Lodash: { available: false },
            Hammer: { available: false },
            isAvailable: (name) => this.extensions[name]?.available || false
        };
    }
    
    getExtension(name) {
        return this.extensions[name];
    }
    
    isAvailable(name) {
        return this.extensions[name]?.available || false;
    }
    
    // デバッグ用: 全拡張機能の状態を取得
    getExtensionStats() {
        return {
            total: this.totalCount,
            loaded: this.loadedCount,
            loadRate: Math.round((this.loadedCount / this.totalCount) * 100),
            extensions: Object.keys(this.extensions).map(name => ({
                name,
                available: this.extensions[name].available,
                source: this.extensions[name].source || 'N/A',
                error: this.extensions[name].error || null
            }))
        };
    }
}