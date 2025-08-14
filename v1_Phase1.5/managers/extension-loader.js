/**
 * 🔌 ExtensionLoader - CDNライブラリ検出・管理
 * 責務: 
 * - CDN経由ライブラリの自動検出
 * - 利用可能拡張機能の管理
 * - フォールバック処理
 * - パフォーマンス監視
 * 
 * 🎯 AI_WORK_SCOPE: CDN拡張ライブラリ検出専用ファイル
 * 🎯 DEPENDENCIES: なし（独立動作）
 * 📋 SPLIT_PLAN: 将来的にextension/各ライブラリ専用検出ファイル分割予定
 */

class ExtensionLoader {
    constructor() {
        this.extensions = {};
        this.totalCount = 0;
        this.loadedCount = 0;
    }
    
    async detectAvailableExtensions() {
        console.log('🔍 CDN拡張ライブラリ検出開始...');
        
        // @pixi/ui 検出
        this.checkPixiUI();
        
        // pixi-viewport 検出（無限キャンバス）
        this.checkPixiViewport();
        
        // pixi-filters 検出
        this.checkPixiFilters();
        
        // pixi-svg + Tabler Icons 検出
        this.checkPixiSVG();
        
        // @pixi/assets 検出
        this.checkPixiAssets();
        
        // GSAP 検出
        this.checkGSAP();
        
        // Lodash 検出
        this.checkLodash();
        
        // Hammer.js 検出
        this.checkHammer();
        
        this.reportLoadStatus();
        return this.extensions;
    }
    
    checkPixiUI() {
        this.totalCount++;
        if (typeof PIXI !== 'undefined' && PIXI.UI) {
            console.log('✅ @pixi/ui 検出 - UIコンポーネント利用可能');
            this.extensions.UI = {
                Button: PIXI.UI.Button,
                Slider: PIXI.UI.Slider,
                Popup: PIXI.UI.Popup,
                available: true,
                source: 'CDN'
            };
            this.loadedCount++;
        } else {
            console.warn('⚠️ @pixi/ui 未検出 - 手動UI実装使用');
            this.extensions.UI = { available: false };
        }
    }
    
    checkPixiViewport() {
        this.totalCount++;
        if (typeof window.PIXI_VIEWPORT !== 'undefined' || (window.Viewport)) {
            console.log('✅ pixi-viewport 検出 - 無限キャンバス機能利用可能');
            const ViewportClass = window.PIXI_VIEWPORT?.Viewport || window.Viewport;
            this.extensions.Viewport = {
                Viewport: ViewportClass,
                available: true,
                source: 'CDN'
            };
            this.loadedCount++;
        } else {
            console.warn('⚠️ pixi-viewport 未検出 - キャンバス移動は独自実装使用');
            this.extensions.Viewport = { available: false };
        }
    }
    
    checkPixiFilters() {
        this.totalCount++;
        if (typeof window.PIXI_FILTERS !== 'undefined' || (PIXI && PIXI.filters)) {
            console.log('✅ pixi-filters 検出 - フィルター効果利用可能');
            this.extensions.Filters = {
                filters: PIXI.filters || window.PIXI_FILTERS,
                available: true,
                source: 'CDN'
            };
            this.loadedCount++;
        } else {
            console.warn('⚠️ pixi-filters 未検出 - フィルター効果無効');
            this.extensions.Filters = { available: false };
        }
    }
    
    checkPixiSVG() {
        this.totalCount++;
        if (typeof window.PIXI_SVG !== 'undefined' || (PIXI && PIXI.SVG)) {
            console.log('✅ pixi-svg 検出 - SVG描画利用可能');
            this.extensions.SVG = {
                SVG: PIXI.SVG || window.PIXI_SVG,
                available: true,
                source: 'CDN'
            };
            this.loadedCount++;
        } else {
            console.warn('⚠️ pixi-svg 未検出 - SVG読み込み無効');
            this.extensions.SVG = { available: false };
        }
        
        // Tabler Icons 簡易ローダー
        this.extensions.Tabler = {
            loadIcon: async (iconName) => {
                try {
                    const url = `https://tabler-icons.io/static/icons/${iconName}.svg`;
                    const res = await fetch(url);
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    const svgText = await res.text();

                    if (this.extensions.SVG?.available) {
                        const svgGraphics = new this.extensions.SVG.SVG(svgText);
                        return svgGraphics;
                    } else {
                        console.warn('⚠️ pixi-svg が無効のため Graphics に変換できません');
                        return null;
                    }
                } catch (err) {
                    console.error(`❌ Tabler Icon 読み込み失敗 (${iconName}):`, err);
                    return null;
                }
            },
            available: true
        };
    }
    
    checkPixiAssets() {
        this.totalCount++;
        if (PIXI && PIXI.Assets) {
            console.log('✅ @pixi/assets 検出 - 標準アセットローダー利用可能');
            this.extensions.Assets = {
                Assets: PIXI.Assets,
                available: true,
                source: 'CDN'
            };
            this.loadedCount++;
        } else {
            console.warn('⚠️ @pixi/assets 未検出 - 手動fetchでのアセット読み込み');
            this.extensions.Assets = { available: false };
        }
    }
    
    checkGSAP() {
        this.totalCount++;
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
    }
    
    checkLodash() {
        this.totalCount++;
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
    }
    
    checkHammer() {
        this.totalCount++;
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
    }
    
    reportLoadStatus() {
        const loadRate = Math.round((this.loadedCount / this.totalCount) * 100);
        console.log(`📊 拡張ライブラリ読み込み完了: ${this.loadedCount}/${this.totalCount} (${loadRate}%)`);
        
        if (loadRate < 70) {
            console.warn('⚠️ 拡張ライブラリの読み込み率が低いです。CDNの確認をお勧めします。');
        }
        
        // 読み込み成功したライブラリの詳細を表示
        const loadedLibs = Object.entries(this.extensions)
            .filter(([name, ext]) => ext.available)
            .map(([name]) => name);
        
        if (loadedLibs.length > 0) {
            console.log(`✅ 読み込み成功: ${loadedLibs.join(', ')}`);
        }
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
                source: this.extensions[name].source || 'N/A'
            }))
        };
    }