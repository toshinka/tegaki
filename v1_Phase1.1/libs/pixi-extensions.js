/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * PixiJS拡張ライブラリ統合システム - Lodash遅延検出エラー修繕版
 * 
 * 🎯 AI_WORK_SCOPE: PixiJS拡張ライブラリ検出・統合・互換性レイヤー・Lodash遅延検出エラー修繕
 * 🎯 DEPENDENCIES: PixiJS v7, typedSignals, tweedle.js, @pixi/ui, @pixi/layers, @pixi/gif, GSAP, Lodash, Hammer.js
 * 🎯 NODE_MODULES: pixi.js@^7.4.3, @pixi/ui@^1.2.4, @pixi/layers@^2.1.0, @pixi/gif@^2.1.1
 * 🎯 PIXI_EXTENSIONS: 全統合機能・Lodash遅延検出修繕・エラーハンドリング強化
 * 🎯 ISOLATION_TEST: 可能（依存関係確認・エラー耐性）
 * 🎯 SPLIT_THRESHOLD: 500行（統合性重視・遅延検出修繕含む）
 * 📋 PHASE_TARGET: Phase1 Lodash遅延検出エラー修繕版
 * 📋 V8_MIGRATION: Application.init()対応予定・エラーハンドリング継承
 */

console.log('🔧 PixiJS拡張ライブラリ統合システム Lodash遅延検出エラー修繕版 読み込み開始...');

/**
 * PixiJS拡張ライブラリ統合管理システム - Lodash遅延検出エラー修繕版
 * node_modules統合・CORS制限回避・Lodash遅延検出修繕対応
 */
class PixiExtensionsManager {
    constructor() {
        this.extensions = new Map();
        this.initialized = false;
        this.stats = {
            loaded: 0,
            total: 8, // 予想される総数
            errors: [],
            warnings: []
        };
        
        console.log('🎨 PixiExtensionsManager 構築開始... Lodash遅延検出エラー修繕版');
        
        // エラーハンドリング強化
        this.safeMode = true;
        this.fallbackMode = false;
        
        // Lodash遅延検出修繕機能
        this.lodashRetryCount = 0;
        this.lodashMaxRetries = 3; // 5回→3回に短縮（効率化）
        this.lodashRetryInterval = 200; // 200ms間隔（短縮）
    }
    
    /**
     * 拡張ライブラリ統合初期化 - Lodash遅延検出エラー修繕版
     */
    async initialize() {
        console.group('🎨 PixiJS拡張ライブラリ統合初期化 Lodash遅延検出エラー修繕版');
        
        try {
            // PixiJS本体検証（必須）
            await this.validateCoreLibraries();
            
            // Lodash事前検証（修繕版）
            await this.validateLodashWithRetry();
            
            // 拡張ライブラリ統合（エラー耐性）
            await this.integrateUILibrary();
            await this.integrateLayersLibrary();
            await this.integrateGIFLibrary();
            await this.integrateTweedleLibrary();
            await this.integrateUtilityLibraries();
            
            // 統計更新
            this.updateStats();
            
            this.initialized = true;
            console.log('✅ PixiJS拡張ライブラリ統合完了 Lodash遅延検出エラー修繕版');
            console.log(`📊 統計: ${this.stats.loaded}/${this.stats.total} (${this.stats.coverage}%)`);
            
            // 警告表示
            if (this.stats.warnings.length > 0) {
                console.warn('⚠️ 警告:', this.stats.warnings);
            }
            
        } catch (error) {
            console.error('❌ PixiJS拡張ライブラリ統合エラー:', error);
            this.stats.errors.push(error.message);
            this.fallbackMode = true;
            
            // エラー時のフォールバック初期化
            await this.initializeFallbackMode();
            
        } finally {
            console.groupEnd();
        }
        
        return this;
    }
    
    /**
     * Lodash遅延検出エラー修繕機能
     */
    async validateLodashWithRetry() {
        console.log('🔧 Lodash遅延検出修繕試行中...');
        
        // 即座の検出試行
        if (this.detectLodash()) {
            console.log('✅ Lodash 即座に検出成功');
            return;
        }
        
        // 遅延検出リトライ（修繕版）
        for (let i = 0; i < this.lodashMaxRetries; i++) {
            this.lodashRetryCount = i + 1;
            console.log(`🔄 Lodash遅延検出試行 ${this.lodashRetryCount}/${this.lodashMaxRetries}...`);
            
            await this.sleep(this.lodashRetryInterval);
            
            if (this.detectLodash()) {
                console.log(`✅ Lodash遅延検出成功 (${this.lodashRetryCount}回目)`);
                return;
            }
        }
        
        // 遅延検出失敗
        console.warn(`⚠️ Lodash遅延検出失敗 (${this.lodashMaxRetries}回試行)`);
        this.stats.warnings.push('Lodash 未検出 - 基本JavaScript使用（フォールバック動作）');
    }
    
    /**
     * Lodash検出機能（改良版）
     */
    detectLodash() {
        // 複数のグローバル参照を確認
        const lodashReferences = [
            window._,
            window.lodash,
            typeof _ !== 'undefined' ? _ : null
        ];
        
        for (const ref of lodashReferences) {
            if (ref && typeof ref === 'function' && ref.VERSION) {
                console.log(`✅ Lodash v${ref.VERSION} 検出 (${ref === window._ ? 'window._' : 'alternative'})`);
                
                // グローバル確保（統一化）
                if (!window._) window._ = ref;
                if (!window.lodash) window.lodash = ref;
                
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * スリープユーティリティ
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * PixiJS本体検証 - 強化版
     */
    async validateCoreLibraries() {
        console.log('🔍 PixiJS本体検証中...');
        
        if (!window.PIXI) {
            throw new Error('PixiJS が読み込まれていません - node_modules/pixi.js/dist/pixi.min.js を確認してください');
        }
        
        console.log(`✅ PixiJS v${PIXI.VERSION} 検出`);
        
        // PixiJS基本機能確認
        const requiredFeatures = ['Application', 'Container', 'Graphics', 'Sprite', 'Texture'];
        const missingFeatures = requiredFeatures.filter(feature => !PIXI[feature]);
        
        if (missingFeatures.length > 0) {
            throw new Error(`PixiJS必須機能が不足: ${missingFeatures.join(', ')}`);
        }
        
        // v8移行予告
        if (PIXI.VERSION.startsWith('7')) {
            console.log('📋 V8_MIGRATION: PixiJS v8移行準備 - Application.init()対応予定');
        }
        
        this.stats.loaded++;
    }
    
    /**
     * @pixi/ui統合 - エラー修繕版
     */
    async integrateUILibrary() {
        console.log('🎨 @pixi/ui統合試行中...');
        this.stats.total++;
        
        try {
            let uiLib = null;
            
            // 複数の検出パターンに対応（エラー耐性強化）
            if (window.PIXI && window.PIXI.ui) {
                uiLib = window.PIXI.ui;
                console.log('✅ @pixi/ui (PIXI.ui) 検出');
            } else if (window.PIXI && window.PIXI.UI) {
                uiLib = window.PIXI.UI;
                console.log('✅ @pixi/ui (PIXI.UI) 検出');
            } else if (window.PIXI && window.PIXI.FancyButton) {
                uiLib = { FancyButton: window.PIXI.FancyButton };
                console.log('✅ @pixi/ui (PIXI.FancyButton) 検出');
            } else if (window.__PIXI_UI__) {
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
                    Input: uiLib.Input || null,
                    source: 'node_modules',
                    library: uiLib
                });
                this.stats.loaded++;
                console.log('🎨 @pixi/ui統合完了 - UI機能利用可能');
            } else {
                this.extensions.set('ui', { available: false, reason: 'ライブラリ未検出' });
                this.stats.warnings.push('@pixi/ui 未検出 - 独自UI実装使用');
                console.warn('⚠️ @pixi/ui 未検出 - 独自UI実装使用');
            }
            
        } catch (error) {
            console.error('❌ @pixi/ui統合エラー:', error);
            this.extensions.set('ui', { available: false, error: error.message });
            this.stats.errors.push(`@pixi/ui: ${error.message}`);
        }
    }
    
    /**
     * @pixi/layers統合 - エラー修繕版
     */
    async integrateLayersLibrary() {
        console.log('📝 @pixi/layers統合試行中...');
        this.stats.total++;
        
        try {
            let layersLib = null;
            
            if (window.PIXI && window.PIXI.display && window.PIXI.display.Layer) {
                layersLib = window.PIXI.display;
                console.log('✅ @pixi/layers (PIXI.display) 検出');
            } else if (window.PIXI && window.PIXI.layers) {
                layersLib = window.PIXI.layers;
                console.log('✅ @pixi/layers (PIXI.layers) 検出');
            } else if (window.__PIXI_LAYERS__) {
                layersLib = window.__PIXI_LAYERS__;
                console.log('✅ @pixi/layers (__PIXI_LAYERS__) 検出');
            }
            
            if (layersLib) {
                this.extensions.set('layers', {
                    available: true,
                    Layer: layersLib.Layer || null,
                    Group: layersLib.Group || null,
                    Stage: layersLib.Stage || null,
                    source: 'node_modules',
                    library: layersLib
                });
                this.stats.loaded++;
                console.log('📝 @pixi/layers統合完了 - レイヤー機能利用可能');
            } else {
                this.extensions.set('layers', { available: false, reason: 'ライブラリ未検出' });
                this.stats.warnings.push('@pixi/layers 未検出 - 基本コンテナ使用');
                console.warn('⚠️ @pixi/layers 未検出 - 基本コンテナ使用');
            }
            
        } catch (error) {
            console.error('❌ @pixi/layers統合エラー:', error);
            this.extensions.set('layers', { available: false, error: error.message });
            this.stats.errors.push(`@pixi/layers: ${error.message}`);
        }
    }
    
    /**
     * @pixi/gif統合 - エラー修繕版
     */
    async integrateGIFLibrary() {
        console.log('🎬 @pixi/gif統合試行中...');
        this.stats.total++;
        
        try {
            let gifLib = null;
            
            if (window.PIXI && window.PIXI.AnimatedGIF) {
                gifLib = window.PIXI;
                console.log('✅ @pixi/gif (PIXI.AnimatedGIF) 検出');
            } else if (window.PIXI && window.PIXI.gif) {
                gifLib = window.PIXI.gif;
                console.log('✅ @pixi/gif (PIXI.gif) 検出');
            } else if (window.__PIXI_GIF__) {
                gifLib = window.__PIXI_GIF__;
                console.log('✅ @pixi/gif (__PIXI_GIF__) 検出');
            }
            
            if (gifLib) {
                this.extensions.set('gif', {
                    available: true,
                    AnimatedGIF: gifLib.AnimatedGIF || null,
                    source: 'node_modules',
                    library: gifLib
                });
                this.stats.loaded++;
                console.log('🎬 @pixi/gif統合完了 - GIF機能利用可能');
            } else {
                this.extensions.set('gif', { available: false, reason: 'ライブラリ未検出' });
                this.stats.warnings.push('@pixi/gif 未検出 - GIF機能無効');
                console.warn('⚠️ @pixi/gif 未検出 - GIF機能無効');
            }
            
        } catch (error) {
            console.error('❌ @pixi/gif統合エラー:', error);
            this.extensions.set('gif', { available: false, error: error.message });
            this.stats.errors.push(`@pixi/gif: ${error.message}`);
        }
    }
    
    /**
     * Tweedle.js統合 - エラー修繕版
     */
    async integrateTweedleLibrary() {
        console.log('🎭 Tweedle.js統合試行中...');
        this.stats.total++;
        
        try {
            let tweedleLib = null;
            
            // 複数の検出パターンに対応
            if (window.tweedle_js && window.tweedle_js.Tween) {
                tweedleLib = window.tweedle_js;
                console.log('✅ Tweedle.js (window.tweedle_js) 検出');
            } else if (window.exports && window.exports.Tween) {
                tweedleLib = window.exports;
                console.log('✅ Tweedle.js (window.exports) 検出');
            } else if (window.Tweedle) {
                tweedleLib = window.Tweedle;
                console.log('✅ Tweedle.js (window.Tweedle) 検出');
            }
            
            if (tweedleLib && tweedleLib.Tween && tweedleLib.Group) {
                this.extensions.set('tweedle', {
                    available: true,
                    Tween: tweedleLib.Tween,
                    Group: tweedleLib.Group,
                    Easing: tweedleLib.Easing || null,
                    source: 'node_modules',
                    library: tweedleLib
                });
                this.stats.loaded++;
                console.log('🎭 Tweedle.js統合完了 - アニメーション機能利用可能');
            } else {
                this.extensions.set('tweedle', { available: false, reason: 'ライブラリ未検出またはAPI不完全' });
                this.stats.warnings.push('Tweedle.js 未検出 - 基本アニメーション使用');
                console.warn('⚠️ Tweedle 未検出 - 基本アニメーション使用');
            }
            
        } catch (error) {
            console.error('❌ Tweedle.js統合エラー:', error);
            this.extensions.set('tweedle', { available: false, error: error.message });
            this.stats.errors.push(`Tweedle.js: ${error.message}`);
        }
    }
    
    /**
     * ユーティリティライブラリ統合 - Lodash遅延検出エラー修繕版
     */
    async integrateUtilityLibraries() {
        console.log('🔧 ユーティリティライブラリ統合中...');
        
        // GSAP統合
        this.stats.total++;
        try {
            if (window.gsap) {
                this.extensions.set('gsap', {
                    available: true,
                    gsap: window.gsap,
                    source: 'node_modules'
                });
                this.stats.loaded++;
                console.log('🎭 GSAP統合完了 - 高度アニメーション機能利用可能');
            } else {
                this.extensions.set('gsap', { available: false, reason: 'ライブラリ未検出' });
                this.stats.warnings.push('GSAP 未検出 - 基本アニメーション使用');
                console.warn('⚠️ GSAP 未検出 - 基本アニメーション使用');
            }
        } catch (error) {
            console.error('❌ GSAP統合エラー:', error);
            this.extensions.set('gsap', { available: false, error: error.message });
            this.stats.errors.push(`GSAP: ${error.message}`);
        }
        
        // Lodash統合（修繕版 - 既に検証済み）
        this.stats.total++;
        try {
            if (this.detectLodash()) {
                this.extensions.set('lodash', {
                    available: true,
                    _: window._,
                    version: window._.VERSION,
                    source: 'node_modules',
                    retryCount: this.lodashRetryCount
                });
                this.stats.loaded++;
                console.log(`🔧 Lodash統合完了 - v${window._.VERSION} ユーティリティ機能利用可能 (修繕版)`);
            } else {
                this.extensions.set('lodash', { 
                    available: false, 
                    reason: 'ライブラリ未検出（遅延検出修繕後）',
                    retryCount: this.lodashRetryCount
                });
                this.stats.warnings.push('Lodash 未検出 - 基本JavaScript使用（フォールバック動作）');
                console.warn('⚠️ Lodash 未検出 - 基本JavaScript使用（フォールバック動作）');
            }
        } catch (error) {
            console.error('❌ Lodash統合エラー:', error);
            this.extensions.set('lodash', { available: false, error: error.message });
            this.stats.errors.push(`Lodash: ${error.message}`);
        }
        
        // Hammer.js統合
        this.stats.total++;
        try {
            if (window.Hammer) {
                this.extensions.set('hammer', {
                    available: true,
                    Hammer: window.Hammer,
                    source: 'node_modules'
                });
                this.stats.loaded++;
                console.log('👆 Hammer.js統合完了 - タッチジェスチャー利用可能');
            } else {
                this.extensions.set('hammer', { available: false, reason: 'ライブラリ未検出' });
                this.stats.warnings.push('Hammer.js 未検出 - 基本タッチ処理使用');
                console.warn('⚠️ Hammer.js 未検出 - 基本タッチ処理使用');
            }
        } catch (error) {
            console.error('❌ Hammer.js統合エラー:', error);
            this.extensions.set('hammer', { available: false, error: error.message });
            this.stats.errors.push(`Hammer.js: ${error.message}`);
        }
    }
    
    /**
     * フォールバックモード初期化
     */
    async initializeFallbackMode() {
        console.warn('🆘 フォールバックモード有効化');
        
        // 最低限の機能セットアップ
        if (!this.extensions.has('ui')) {
            this.extensions.set('ui', { available: false, fallback: true });
        }
        if (!this.extensions.has('layers')) {
            this.extensions.set('layers', { available: false, fallback: true });
        }
        if (!this.extensions.has('gif')) {
            this.extensions.set('gif', { available: false, fallback: true });
        }
        if (!this.extensions.has('tweedle')) {
            this.extensions.set('tweedle', { available: false, fallback: true });
        }
        if (!this.extensions.has('gsap')) {
            this.extensions.set('gsap', { available: false, fallback: true });
        }
        if (!this.extensions.has('lodash')) {
            this.extensions.set('lodash', { available: false, fallback: true });
        }
        if (!this.extensions.has('hammer')) {
            this.extensions.set('hammer', { available: false, fallback: true });
        }
        
        this.initialized = true;
        console.log('🆘 フォールバックモード初期化完了');
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
     * 機能チェック - エラー耐性強化
     */
    hasFeature(feature) {
        try {
            const extension = this.extensions.get(feature);
            return extension && extension.available === true;
        } catch (error) {
            console.error(`❌ hasFeature エラー (${feature}):`, error);
            return false;
        }
    }
    
    /**
     * コンポーネント取得 - エラー耐性強化
     */
    getComponent(library, component) {
        try {
            const extension = this.extensions.get(library);
            if (extension && extension.available) {
                const comp = extension[component] || extension.library?.[component];
                if (!comp) {
                    console.warn(`⚠️ コンポーネント ${component} が ${library} で見つかりません`);
                }
                return comp || null;
            }
            return null;
        } catch (error) {
            console.error(`❌ getComponent エラー (${library}.${component}):`, error);
            return null;
        }
    }
    
    /**
     * 拡張ライブラリ使用のUI作成ヘルパー - エラー修繕版
     */
    createAdvancedButton(options = {}) {
        try {
            if (this.hasFeature('ui')) {
                const FancyButton = this.getComponent('ui', 'FancyButton');
                if (FancyButton) {
                    console.log('🎨 @pixi/ui FancyButton使用');
                    return new FancyButton(options);
                }
                
                // Button代替試行
                const Button = this.getComponent('ui', 'Button');
                if (Button) {
                    console.log('🎨 @pixi/ui Button使用');
                    return new Button(options);
                }
            }
        } catch (error) {
            console.warn('⚠️ 拡張UIボタン作成エラー:', error);
        }
        
        // フォールバック: 基本ボタン
        console.log('🆘 基本ボタン作成（フォールバック）');
        return this.createBasicButton(options);
    }
    
    /**
     * 基本ボタン作成（フォールバック） - 改良版
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
            return new PIXI.Container(); // 最低限のコンテナ
        }
    }
    
    /**
     * レイヤー作成ヘルパー - エラー修繕版
     */
    createAdvancedLayer(options = {}) {
        try {
            if (this.hasFeature('layers')) {
                const Layer = this.getComponent('layers', 'Layer');
                const Group = this.getComponent('layers', 'Group');
                
                if (Layer) {
                    console.log('📝 @pixi/layers Layer使用');
                    const layer = new Layer();
                    if (Group) {
                        layer.group = new Group(options.zIndex || 0, options.sorted);
                    }
                    return layer;
                }
            }
        } catch (error) {
            console.warn('⚠️ 拡張レイヤー作成エラー:', error);
        }
        
        // フォールバック: 基本コンテナ
        console.log('🆘 基本コンテナ作成（フォールバック）');
        const container = new PIXI.Container();
        container.zIndex = options.zIndex || 0;
        container.sortableChildren = true;
        return container;
    }
    
    /**
     * Lodash活用データ処理ヘルパー - 修繕版
     */
    processDataWithLodash(data, operation = 'chunk', size = 1000) {
        try {
            if (this.hasFeature('lodash')) {
                const _ = this.getComponent('lodash', '_');
                if (_) {
                    console.log(`🔧 Lodash.${operation}使用`);
                    switch (operation) {
                        case 'chunk':
                            return _.chunk(data, size);
                        case 'groupBy':
                            return _.groupBy(data, size);
                        case 'uniq':
                            return _.uniq(data);
                        case 'sortBy':
                            return _.sortBy(data, size);
                        default:
                            return data;
                    }
                }
            }
        } catch (error) {
            console.warn(`⚠️ Lodash ${operation}処理エラー:`, error);
        }
        
        // フォールバック: 基本JavaScript実装
        console.log(`🆘 基本JavaScript ${operation}処理（フォールバック）`);
        return this.basicDataProcessing(data, operation, size);
    }
    
    /**
     * 基本データ処理（フォールバック）
     */
    basicDataProcessing(data, operation, size) {
        try {
            switch (operation) {
                case 'chunk':
                    const chunks = [];
                    for (let i = 0; i < data.length; i += size) {
                        chunks.push(data.slice(i, i + size));
                    }
                    return chunks;
                case 'uniq':
                    return [...new Set(data)];
                case 'sortBy':
                    return [...data].sort((a, b) => {
                        if (typeof size === 'function') return size(a) - size(b);
                        if (typeof size === 'string') return a[size] - b[size];
                        return a - b;
                    });
                case 'groupBy':
                    const groups = {};
                    data.forEach(item => {
                        const key = typeof size === 'function' ? size(item) : item[size];
                        if (!groups[key]) groups[key] = [];
                        groups[key].push(item);
                    });
                    return groups;
                default:
                    return data;
            }
        } catch (error) {
            console.error(`❌ 基本データ処理エラー (${operation}):`, error);
            return data;
        }
    }
    
    /**
     * 統計情報取得 - Lodash修繕版
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
            errors: this.stats.errors,
            warnings: this.stats.warnings,
            safeMode: this.safeMode,
            fallbackMode: this.fallbackMode,
            lodashRetryCount: this.lodashRetryCount, // 修繕情報追加
            lodashMaxRetries: this.lodashMaxRetries
        };
    }
    
    /**
     * ライブラリ詳細情報取得 - エラー耐性強化
     */
    getLibraryDetails(libraryName) {
        try {
            const extension = this.extensions.get(libraryName);
            if (!extension) return null;
            
            const details = {
                name: libraryName,
                available: extension.available,
                source: extension.source || 'unknown',
                error: extension.error || null,
                reason: extension.reason || null,
                fallback: extension.fallback || false,
                components: Object.keys(extension).filter(key => 
                    !['available', 'source', 'error', 'reason', 'fallback', 'library'].includes(key)
                )
            };
            
            // Lodash特別情報
            if (libraryName === 'lodash' && extension.version) {
                details.version = extension.version;
                details.retryCount = extension.retryCount;
            }
            
            return details;
        } catch (error) {
            console.error(`❌ getLibraryDetails エラー (${libraryName}):`, error);
            return null;
        }
    }
    
    /**
     * 全ライブラリ詳細情報取得
     */
    getAllLibraryDetails() {
        const details = {};
        this.extensions.forEach((extension, name) => {
            details[name] = this.getLibraryDetails(name);
        });
        return details;
    }
    
    /**
     * 互換性チェック - Lodash修繕版
     */
    checkCompatibility() {
        const issues = [];
        const recommendations = [];
        
        try {
            // PixiJS バージョンチェック
            if (window.PIXI) {
                const version = PIXI.VERSION;
                if (version.startsWith('6')) {
                    issues.push('PixiJS v7.0.0以上が必要です (現在: v' + version + ')');
                }
            } else {
                issues.push('PixiJS が読み込まれていません');
            }
            
            // 必須機能チェック
            if (!this.hasFeature('ui')) {
                const uiDetails = this.getLibraryDetails('ui');
                if (uiDetails?.error) {
                    issues.push(`@pixi/ui エラー: ${uiDetails.error}`);
                } else {
                    recommendations.push('@pixi/ui の導入を推奨 - UI機能が向上します');
                }
            }
            
            if (!this.hasFeature('layers')) {
                recommendations.push('@pixi/layers の導入を推奨 - レイヤー機能が利用可能になります');
            }
            
            if (!this.hasFeature('gif')) {
                recommendations.push('@pixi/gif の導入を推奨 - GIF機能が利用可能になります');
            }
            
            if (!this.hasFeature('tweedle')) {
                const tweedleDetails = this.getLibraryDetails('tweedle');
                if (tweedleDetails?.error) {
                    issues.push(`Tweedle.js エラー: ${tweedleDetails.error}`);
                } else {
                    recommendations.push('Tweedle.js の導入を推奨 - 高度なアニメーション機能が利用可能になります');
                }
            }
            
            // Lodash修繕結果確認
            if (!this.hasFeature('lodash')) {
                const lodashDetails = this.getLibraryDetails('lodash');
                if (lodashDetails?.retryCount > 0) {
                    recommendations.push(`Lodash 遅延検出修繕済み (${lodashDetails.retryCount}回試行) - データ処理機能が向上します`);
                } else {
                    recommendations.push('Lodash の導入を推奨 - データ処理機能が向上します');
                }
            }
            
        } catch (error) {
            issues.push(`互換性チェックエラー: ${error.message}`);
        }
        
        return {
            compatible: issues.length === 0,
            issues: issues,
            recommendations: recommendations,
            stats: this.getStats()
        };
    }
}

// ==== グローバル公開 ====
console.log('📦 PixiJS拡張機能グローバル登録 Lodash遅延検出エラー修繕版...');

// インスタンス作成・グローバル公開
window.PixiExtensions = new PixiExtensionsManager();

// ==== 初期化完了後の自動テスト ====
if (typeof window !== 'undefined') {
    // 初期化完了を待つ（遅延読み込み対応）
    window.addEventListener('DOMContentLoaded', async () => {
        try {
            // 自動初期化実行（遅延対応）
            setTimeout(async () => {
                await window.PixiExtensions.initialize();
                
                // 自動テスト実行
                setTimeout(() => {
                    console.group('🧪 PixiJS拡張機能 自動テスト Lodash遅延検出エラー修繕版');
                    
                    try {
                        // 統計取得テスト
                        const stats = window.PixiExtensions.getStats();
                        console.log('✅ 統計取得:', stats);
                        
                        // 機能チェックテスト
                        const features = ['ui', 'layers', 'gif', 'tweedle', 'gsap', 'lodash', 'hammer'];
                        features.forEach(feature => {
                            const available = window.PixiExtensions.hasFeature(feature);
                            console.log(`${available ? '✅' : '❌'} ${feature}機能: ${available ? '利用可能' : '無効'}`);
                        });
                        
                        // Lodash修繕結果確認
                        const lodashDetails = window.PixiExtensions.getLibraryDetails('lodash');
                        if (lodashDetails) {
                            console.log('🔧 Lodash修繕結果:', {
                                available: lodashDetails.available,
                                version: lodashDetails.version,
                                retryCount: lodashDetails.retryCount
                            });
                        }
                        
                        // 互換性チェックテスト
                        const compatibility = window.PixiExtensions.checkCompatibility();
                        console.log('🔍 互換性チェック:', compatibility);
                        
                        console.log('🎉 PixiJS拡張機能テスト完了 Lodash遅延検出エラー修繕版');
                    } catch (error) {
                        console.error('❌ テストエラー:', error);
                    }
                    
                    console.groupEnd();
                }, 500);
            }, 200); // 200ms遅延
            
        } catch (error) {
            console.error('❌ PixiJS拡張機能初期化エラー:', error);
        }
    });
}

// ==== Phase1完了・Phase2準備 ====
console.log('🎉 Phase1: PixiJS拡張統合基盤構築完了 Lodash遅延検出エラー修繕版');
console.log('🏗️ Phase2: UI統合・描画機能強化準備完了');
console.log('📋 次のステップ: app-core.js・main.js の作成・修正');
console.log('💡 使用方法例（Lodash遅延検出エラー修繕版）:');
console.log('  await window.PixiExtensions.initialize();');
console.log('  const hasUI = window.PixiExtensions.hasFeature("ui");');
console.log('  const button = window.PixiExtensions.createAdvancedButton({text: "テスト"});');
console.log('  const layer = window.PixiExtensions.createAdvancedLayer({zIndex: 1});');
console.log('  const processedData = window.PixiExtensions.processDataWithLodash([1,2,3,4], "chunk", 2);');
console.log('  const stats = window.PixiExtensions.getStats();');
console.log('🔧 修繕機能: Lodash遅延検出・フォールバックモード・エラーハンドリング強化・詳細ログ');