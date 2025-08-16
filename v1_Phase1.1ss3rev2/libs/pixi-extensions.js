/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * PixiJS拡張ライブラリ統合システム - エラー修繕版
 * 
 * 🔧 修正内容:
 * - tweedle.js CommonJS対応
 * - @pixi/ui typedSignals依存関係解決
 * - ブラウザ環境対応強化
 * - ESM禁止・Pure JavaScript維持
 * 
 * 🚨 PURE_JAVASCRIPT: ES6モジュール禁止・グローバル変数使用
 */

console.log('🔧 PixiJS拡張ライブラリ統合システム エラー修繕版 読み込み開始...');

/**
 * PixiJS拡張ライブラリ統合管理システム - エラー修繕版
 * ブラウザ環境・依存関係問題対応
 */
class PixiExtensionsManager {
    constructor() {
        this.extensions = new Map();
        this.initialized = false;
        this.stats = {
            loaded: 0,
            total: 0,
            errors: []
        };
        
        console.log('🎨 PixiExtensionsManager 構築開始（修繕版）...');
    }
    
    /**
     * 拡張ライブラリ統合初期化 - エラー修繕対応
     */
    async initialize() {
        console.group('🔧 PixiJS拡張ライブラリ統合初期化 エラー修繕版');
        
        try {
            // PixiJS本体検証
            this.validateCoreLibraries();
            
            // 依存関係修正
            this.fixDependencies();
            
            // 拡張ライブラリ統合
            await this.integrateUILibrary();
            await this.integrateLayersLibrary();
            await this.integrateGIFLibrary();
            await this.integrateUtilityLibraries();
            
            // 統計更新
            this.updateStats();
            
            this.initialized = true;
            console.log('✅ PixiJS拡張ライブラリ統合完了（修繕版）');
            console.log(`📊 統計: ${this.stats.loaded}/${this.stats.total} (${Math.round(this.stats.loaded/this.stats.total*100)}%)`);
            
        } catch (error) {
            console.error('❌ PixiJS拡張ライブラリ統合エラー:', error);
            this.stats.errors.push(error.message);
            // エラーが発生しても継続
            this.initialized = true;
        } finally {
            console.groupEnd();
        }
        
        return this;
    }
    
    /**
     * PixiJS本体検証
     */
    validateCoreLibraries() {
        if (!window.PIXI) {
            throw new Error('PixiJS が読み込まれていません - CDNまたはnode_modules/pixi.js を確認してください');
        }
        
        console.log(`✅ PixiJS v${PIXI.VERSION} 検出`);
        
        // v8移行予告
        if (PIXI.VERSION.startsWith('7')) {
            console.log('📋 V8_MIGRATION: PixiJS v8移行準備 - Application.init()対応予定');
        }
        
        this.stats.total++;
        this.stats.loaded++;
    }
    
    /**
     * 🔧 修正: 依存関係問題修正
     */
    fixDependencies() {
        console.log('🔧 依存関係問題修正開始...');
        
        // 1. tweedle.js CommonJS対応
        this.fixTweedleJS();
        
        // 2. typedSignals 依存関係修正
        this.fixTypedSignals();
        
        // 3. @pixi/ui 依存関係修正
        this.fixPixiUI();
        
        console.log('✅ 依存関係問題修正完了');
    }
    
    /**
     * tweedle.js CommonJS → ブラウザ対応修正
     */
    fixTweedleJS() {
        try {
            // CommonJS exports をグローバルに変換
            if (typeof window.exports !== 'undefined' && window.exports.Tween) {
                // tweedle.js を window.tweedle として公開
                window.tweedle = {
                    Tween: window.exports.Tween,
                    Group: window.exports.Group,
                    Easing: window.exports.Easing,
                    Interpolation: window.exports.Interpolation
                };
                
                // PIXI.Tween としても公開（互換性）
                if (window.PIXI && !window.PIXI.Tween) {
                    window.PIXI.Tween = window.exports.Tween;
                    window.PIXI.TweedleGroup = window.exports.Group;
                }
                
                console.log('✅ tweedle.js ブラウザ対応修正完了');
                this.extensions.set('tweedle', {
                    available: true,
                    Tween: window.exports.Tween,
                    Group: window.exports.Group,
                    source: 'commonjs-fixed'
                });
            } else {
                console.log('⚠️ tweedle.js 未検出 - 一部機能が制限されます');
                this.extensions.set('tweedle', { available: false });
            }
        } catch (error) {
            console.warn('⚠️ tweedle.js 修正エラー:', error.message);
            this.extensions.set('tweedle', { available: false });
        }
    }
    
    /**
     * typedSignals 依存関係修正
     */
    fixTypedSignals() {
        try {
            // typedSignals が存在しない場合はポリフィル使用
            if (typeof window.typedSignals === 'undefined') {
                console.log('⚠️ typedSignals 未検出 - ポリフィル使用');
                
                // 既に index.html でポリフィルが定義されているかチェック
                if (window.typedSignals && window.typedSignals.Signal) {
                    console.log('✅ typedSignals ポリフィル使用');
                } else {
                    // フォールバック: 基本的なSignal実装
                    window.typedSignals = {
                        Signal: class {
                            constructor() {
                                this.listeners = [];
                            }
                            connect(listener) {
                                if (typeof listener === 'function') {
                                    this.listeners.push(listener);
                                }
                            }
                            emit(...args) {
                                this.listeners.forEach(listener => {
                                    try {
                                        listener(...args);
                                    } catch (e) {
                                        console.warn('Signal listener error:', e);
                                    }
                                });
                            }
                            disconnect(listener) {
                                const index = this.listeners.indexOf(listener);
                                if (index > -1) this.listeners.splice(index, 1);
                            }
                            disconnectAll() {
                                this.listeners = [];
                            }
                        }
                    };
                    console.log('✅ typedSignals フォールバック実装完了');
                }
            } else {
                console.log('✅ typedSignals 検出済み');
            }
        } catch (error) {
            console.warn('⚠️ typedSignals 修正エラー:', error.message);
        }
    }
    
    /**
     * @pixi/ui 依存関係修正
     */
    fixPixiUI() {
        try {
            // @pixi/ui が読み込まれているかチェック
            if (window.PIXI && window.PIXI.ui) {
                console.log('✅ @pixi/ui 既に統合済み');
                return;
            }
            
            // PIXI.ui 名前空間準備
            if (window.PIXI && !window.PIXI.ui) {
                window.PIXI.ui = {};
                console.log('🔧 PIXI.ui 名前空間準備完了');
            }
            
            // tweedle.js を@pixi/ui用にグローバル公開
            if (window.tweedle && !window.tweedle_js) {
                window.tweedle_js = window.tweedle;
                console.log('🔧 tweedle.js グローバル公開完了');
            }
            
        } catch (error) {
            console.warn('⚠️ @pixi/ui 依存関係修正エラー:', error.message);
        }
    }
    
    /**
     * @pixi/ui統合 - 修繕版
     */
    async integrateUILibrary() {
        this.stats.total++;
        
        try {
            await this.delay(100); // 読み込み待機
            
            // 複数の検出パターンに対応
            let uiLib = null;
            
            if (window.PIXI && window.PIXI.ui && Object.keys(window.PIXI.ui).length > 0) {
                uiLib = window.PIXI.ui;
                console.log('✅ @pixi/ui (PIXI.ui) 検出');
            } else if (window.PIXI && window.PIXI.FancyButton) {
                uiLib = { 
                    FancyButton: window.PIXI.FancyButton,
                    Button: window.PIXI.Button || window.PIXI.FancyButton
                };
                console.log('✅ @pixi/ui (PIXI.FancyButton) 検出');
            } else if (typeof window.__PIXI_UI__ !== 'undefined') {
                uiLib = window.__PIXI_UI__;
                console.log('✅ @pixi/ui (__PIXI_UI__) 検出');
            }
            
            if (uiLib) {
                this.extensions.set('ui', {
                    available: true,
                    FancyButton: uiLib.FancyButton || null,
                    Button: uiLib.Button || null,
                    Slider: uiLib.Slider || null,
                    CheckBox: uiLib.CheckBox || null,
                    source: 'node_modules'
                });
                this.stats.loaded++;
                console.log('🎨 @pixi/ui統合完了 - UI機能利用可能');
            } else {
                this.extensions.set('ui', { available: false });
                console.log('⚠️ @pixi/ui 未検出 - 独自UI実装使用');
            }
            
        } catch (error) {
            console.error('❌ @pixi/ui統合エラー:', error);
            this.extensions.set('ui', { available: false });
            this.stats.errors.push(`@pixi/ui: ${error.message}`);
        }
    }
    
    /**
     * @pixi/layers統合 - 修繕版
     */
    async integrateLayersLibrary() {
        this.stats.total++;
        
        try {
            await this.delay(100); // 読み込み待機
            
            let layersLib = null;
            
            if (window.PIXI && window.PIXI.display && window.PIXI.display.Layer) {
                layersLib = window.PIXI.display;
                console.log('✅ @pixi/layers (PIXI.display) 検出');
            } else if (typeof window.__PIXI_LAYERS__ !== 'undefined') {
                layersLib = window.__PIXI_LAYERS__;
                console.log('✅ @pixi/layers (__PIXI_LAYERS__) 検出');
            }
            
            if (layersLib) {
                this.extensions.set('layers', {
                    available: true,
                    Layer: layersLib.Layer,
                    Group: layersLib.Group,
                    Stage: layersLib.Stage,
                    source: 'node_modules'
                });
                this.stats.loaded++;
                console.log('📝 @pixi/layers統合完了 - レイヤー機能利用可能');
            } else {
                this.extensions.set('layers', { available: false });
                console.log('⚠️ @pixi/layers 未検出 - 基本コンテナ使用');
            }
            
        } catch (error) {
            console.warn('⚠️ @pixi/layers統合エラー:', error.message);
            this.extensions.set('layers', { available: false });
        }
    }
    
    /**
     * @pixi/gif統合 - 修繕版
     */
    async integrateGIFLibrary() {
        this.stats.total++;
        
        try {
            await this.delay(100); // 読み込み待機
            
            let gifLib = null;
            
            if (window.PIXI && window.PIXI.AnimatedGIF) {
                gifLib = window.PIXI;
                console.log('✅ @pixi/gif (PIXI.AnimatedGIF) 検出');
            } else if (typeof window.__PIXI_GIF__ !== 'undefined') {
                gifLib = window.__PIXI_GIF__;
                console.log('✅ @pixi/gif (__PIXI_GIF__) 検出');
            }
            
            if (gifLib) {
                this.extensions.set('gif', {
                    available: true,
                    AnimatedGIF: gifLib.AnimatedGIF,
                    source: 'node_modules'
                });
                this.stats.loaded++;
                console.log('🎬 @pixi/gif統合完了 - GIF機能利用可能');
            } else {
                this.extensions.set('gif', { available: false });
                console.log('⚠️ @pixi/gif 未検出 - GIF機能無効');
            }
            
        } catch (error) {
            console.warn('⚠️ @pixi/gif統合エラー:', error.message);
            this.extensions.set('gif', { available: false });
        }
    }
    
    /**
     * ユーティリティライブラリ統合 - 修繕版
     */
    async integrateUtilityLibraries() {
        // GSAP統合
        this.stats.total++;
        try {
            if (window.gsap) {
                this.extensions.set('gsap', {
                    available: true,
                    gsap: window.gsap,
                    source: 'cdn'
                });
                this.stats.loaded++;
                console.log('🎭 GSAP統合完了 - アニメーション機能利用可能');
            } else {
                this.extensions.set('gsap', { available: false });
                console.log('⚠️ GSAP 未検出 - 基本アニメーション使用');
            }
        } catch (error) {
            console.warn('⚠️ GSAP統合エラー:', error.message);
            this.extensions.set('gsap', { available: false });
        }
        
        // Lodash統合
        this.stats.total++;
        try {
            if (window._) {
                this.extensions.set('lodash', {
                    available: true,
                    _: window._,
                    source: 'cdn'
                });
                this.stats.loaded++;
                console.log('🔧 Lodash統合完了 - ユーティリティ機能利用可能');
            } else {
                this.extensions.set('lodash', { available: false });
                console.log('⚠️ Lodash 未検出 - 基本JavaScript使用');
            }
        } catch (error) {
            console.warn('⚠️ Lodash統合エラー:', error.message);
            this.extensions.set('lodash', { available: false });
        }
        
        // Hammer.js統合
        this.stats.total++;
        try {
            if (window.Hammer) {
                this.extensions.set('hammer', {
                    available: true,
                    Hammer: window.Hammer,
                    source: 'cdn'
                });
                this.stats.loaded++;
                console.log('👆 Hammer.js統合完了 - タッチジェスチャー利用可能');
            } else {
                this.extensions.set('hammer', { available: false });
                console.log('⚠️ Hammer.js 未検出 - 基本タッチ処理使用');
            }
        } catch (error) {
            console.warn('⚠️ Hammer.js統合エラー:', error.message);
            this.extensions.set('hammer', { available: false });
        }
    }
    
    /**
     * 統計情報更新
     */
    updateStats() {
        const availableCount = Array.from(this.extensions.values())
            .filter(ext => ext.available).length;
        
        this.stats.loaded = availableCount + 1; // +1 for PIXI core
        this.stats.coverage = Math.round((this.stats.loaded / this.stats.total) * 100);
    }
    
    /**
     * 機能チェック
     */
    hasFeature(feature) {
        const extension = this.extensions.get(feature);
        return extension && extension.available;
    }
    
    /**
     * コンポーネント取得
     */
    getComponent(library, component) {
        const extension = this.extensions.get(library);
        if (extension && extension.available) {
            return extension[component] || null;
        }
        return null;
    }
    
    /**
     * 拡張ライブラリ使用のUI作成ヘルパー - 修繕版
     */
    createAdvancedButton(options = {}) {
        if (this.hasFeature('ui')) {
            const FancyButton = this.getComponent('ui', 'FancyButton');
            if (FancyButton) {
                console.log('🎨 @pixi/ui FancyButton使用');
                try {
                    return new FancyButton(options);
                } catch (error) {
                    console.warn('⚠️ FancyButton作成エラー - フォールバック使用:', error.message);
                    return this.createBasicButton(options);
                }
            }
        }
        
        // フォールバック: 基本ボタン
        console.log('🆘 基本ボタン作成（フォールバック）');
        return this.createBasicButton(options);
    }
    
    /**
     * 基本ボタン作成（フォールバック） - 修繕版
     */
    createBasicButton(options = {}) {
        try {
            const {
                width = 100,
                height = 40,
                text = 'Button',
                backgroundColor = 0x800000,
                textColor = 0xffffff
            } = options;
            
            const container = new PIXI.Container();
            
            // 背景
            const background = new PIXI.Graphics();
            background.beginFill(backgroundColor);
            background.drawRoundedRect(0, 0, width, height, 8);
            background.endFill();
            container.addChild(background);
            
            // テキスト
            const buttonText = new PIXI.Text(text, {
                fontFamily: 'system-ui, sans-serif',
                fontSize: 14,
                fill: textColor,
                align: 'center'
            });
            buttonText.anchor.set(0.5);
            buttonText.x = width / 2;
            buttonText.y = height / 2;
            container.addChild(buttonText);
            
            // インタラクティブ設定
            container.interactive = true;
            container.buttonMode = true;
            
            return container;
        } catch (error) {
            console.error('❌ 基本ボタン作成エラー:', error);
            return new PIXI.Container(); // 空のコンテナを返す
        }
    }
    
    /**
     * レイヤー作成ヘルパー - 修繕版
     */
    createAdvancedLayer(options = {}) {
        if (this.hasFeature('layers')) {
            const Layer = this.getComponent('layers', 'Layer');
            const Group = this.getComponent('layers', 'Group');
            
            if (Layer && Group) {
                console.log('📝 @pixi/layers Layer使用');
                try {
                    const layer = new Layer();
                    layer.group = new Group(options.zIndex || 0, options.sorted);
                    return layer;
                } catch (error) {
                    console.warn('⚠️ Layer作成エラー - フォールバック使用:', error.message);
                    return this.createBasicLayer(options);
                }
            }
        }
        
        // フォールバック: 基本コンテナ
        return this.createBasicLayer(options);
    }
    
    /**
     * 基本レイヤー作成（フォールバック）
     */
    createBasicLayer(options = {}) {
        console.log('🆘 基本コンテナ作成（フォールバック）');
        try {
            const container = new PIXI.Container();
            container.zIndex = options.zIndex || 0;
            container.sortableChildren = true;
            return container;
        } catch (error) {
            console.error('❌ 基本レイヤー作成エラー:', error);
            return new PIXI.Container();
        }
    }
    
    /**
     * 統計情報取得
     */
    getStats() {
        return {
            initialized: this.initialized,
            loaded: this.stats.loaded,
            total: this.stats.total,
            coverage: this.stats.coverage + '%',
            libraries: Array.from(this.extensions.keys()),
            available: Array.from(this.extensions.entries())
                .filter(([_, ext]) => ext.available)
                .map(([name, _]) => name),
            errors: this.stats.errors
        };
    }
    
    /**
     * 互換性チェック - 修繕版
     */
    checkCompatibility() {
        const issues = [];
        const recommendations = [];
        
        // PixiJS バージョンチェック
        if (window.PIXI) {
            const version = PIXI.VERSION;
            if (version.startsWith('6')) {
                issues.push('PixiJS v7.0.0以上が必要です (現在: v' + version + ')');
            }
        }
        
        // 必須機能チェック
        if (!this.hasFeature('ui')) {
            recommendations.push('@pixi/ui の導入を推奨 - UI機能が向上します');
        }
        
        if (!this.hasFeature('layers')) {
            recommendations.push('@pixi/layers の導入を推奨 - レイヤー機能が利用可能になります');
        }
        
        // tweedle.js チェック
        if (!this.hasFeature('tweedle')) {
            recommendations.push('tweedle.js の導入を推奨 - アニメーション機能が向上します');
        }
        
        return {
            compatible: issues.length === 0,
            issues: issues,
            recommendations: recommendations,
            stats: this.getStats()
        };
    }
    
    /**
     * 遅延実行ヘルパー
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ==== グローバル公開 ====
console.log('📦 PixiJS拡張機能グローバル登録 エラー修繕版...');

// インスタンス作成・グローバル公開
window.PixiExtensions = new PixiExtensionsManager();

// ==== 初期化完了後の自動テスト ====
if (typeof window !== 'undefined') {
    // 初期化完了を待つ
    window.addEventListener('DOMContentLoaded', async () => {
        try {
            // 自動初期化実行
            await window.PixiExtensions.initialize();
            
            // 自動テスト実行
            setTimeout(() => {
                console.group('🧪 PixiJS拡張機能 自動テスト エラー修繕版');
                
                try {
                    // 統計取得テスト
                    const stats = window.PixiExtensions.getStats();
                    console.log('✅ 統計取得:', stats);
                    
                    // 機能チェックテスト
                    const features = ['ui', 'layers', 'gif', 'gsap', 'lodash', 'hammer', 'tweedle'];
                    features.forEach(feature => {
                        const available = window.PixiExtensions.hasFeature(feature);
                        console.log(`${available ? '✅' : '❌'} ${feature}機能: ${available ? '利用可能' : '無効'}`);
                    });
                    
                    // 互換性チェックテスト
                    const compatibility = window.PixiExtensions.checkCompatibility();
                    console.log('🔍 互換性チェック:', compatibility);
                    
                    // エラー情報表示
                    if (stats.errors.length > 0) {
                        console.warn('⚠️ 検出されたエラー:', stats.errors);
                    }
                    
                    console.log('🎉 PixiJS拡張機能テスト完了 エラー修繕版');
                } catch (error) {
                    console.error('❌ テストエラー:', error);
                }
                
                console.groupEnd();
            }, 1500); // 読み込み完了を待機
            
        } catch (error) {
            console.error('❌ PixiJS拡張機能初期化エラー:', error);
        }
    });
}

// ==== Phase1完了・Phase2準備 ====
console.log('🎉 Phase1: PixiJS拡張統合基盤構築完了（エラー修繕版）');
console.log('🔧 修繕内容: tweedle.js CommonJS対応、@pixi/ui依存関係解決');
console.log('🏗️ Phase2: UI統合・描画機能強化準備完了');
console.log('💡 使用方法例（エラー修繕版）:');
console.log('  await window.PixiExtensions.initialize();');
console.log('  const button = window.PixiExtensions.createAdvancedButton({text: "テスト"});');
console.log('  const layer = window.PixiExtensions.createAdvancedLayer({zIndex: 1});');
console.log('  const stats = window.PixiExtensions.getStats();');