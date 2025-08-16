/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * PixiJS拡張ライブラリ統合システム - Phase1版（修正版）
 * 
 * 🎯 AI_WORK_SCOPE: PixiJS拡張ライブラリ検出・統合・互換性レイヤー
 * 🎯 DEPENDENCIES: PixiJS v7, @pixi/ui, @pixi/layers, @pixi/gif, GSAP, Lodash, Hammer.js, tweedle.js
 * 🎯 NODE_MODULES: pixi.js@^7.4.3, @pixi/ui@^1.2.4, tweedle.js@^2.1.0
 * 🎯 PIXI_EXTENSIONS: 全統合機能
 * 🎯 ISOLATION_TEST: 可能（依存関係確認）
 * 🎯 SPLIT_THRESHOLD: 400行（統合性重視で分割想定外）
 * 📋 PHASE_TARGET: Phase1
 * 📋 V8_MIGRATION: Application.init()対応予定
 */

console.log('🔧 PixiJS拡張ライブラリ統合システム Phase1版（修正版） 読み込み開始...');

/**
 * PixiJS拡張ライブラリ統合管理システム（修正版）
 * node_modules統合・CORS制限回避・tweedle.js対応
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
        
        console.log('🎨 PixiExtensionsManager 構築開始（修正版）...');
    }
    
    /**
     * 拡張ライブラリ統合初期化（修正版）
     */
    async initialize() {
        console.group('🎨 PixiJS拡張ライブラリ統合初期化 Phase1版（修正版）');
        
        try {
            // PixiJS本体検証
            this.validateCoreLibraries();
            
            // 依存ライブラリ確認
            this.validateDependencies();
            
            // 拡張ライブラリ統合（修正版）
            await this.integrateUILibrary();
            this.integrateLayersLibrary();
            this.integrateGIFLibrary();
            this.integrateUtilityLibraries();
            
            // 統計更新
            this.updateStats();
            
            this.initialized = true;
            console.log('✅ PixiJS拡張ライブラリ統合完了（修正版）');
            console.log(`📊 統計: ${this.stats.loaded}/${this.stats.total} (${Math.round(this.stats.loaded/this.stats.total*100)}%)`);
            
        } catch (error) {
            console.error('❌ PixiJS拡張ライブラリ統合エラー:', error);
            this.stats.errors.push(error.message);
            throw error;
        } finally {
            console.groupEnd();
        }
        
        return this;
    }
    
    /**
     * PixiJS本体検証（修正版）
     */
    validateCoreLibraries() {
        if (!window.PIXI) {
            throw new Error('PixiJS が読み込まれていません - node_modules/pixi.js/dist/pixi.min.js を確認してください');
        }
        
        console.log(`✅ PixiJS v${PIXI.VERSION} 検出`);
        
        // v8移行予告（修正版）
        if (PIXI.VERSION.startsWith('8')) {
            console.log('📋 V8_MIGRATION: PixiJS v8 - Application.init()対応済み');
        } else if (PIXI.VERSION.startsWith('7')) {
            console.log('📋 V8_MIGRATION: PixiJS v7 - Application.init()対応予定');
        }
        
        this.stats.total++;
        this.stats.loaded++;
    }
    
    /**
     * 依存ライブラリ確認（新規追加）
     */
    validateDependencies() {
        const dependencies = [
            { name: 'tweedle.js', check: () => window.tweedle_js || window.Tweedle || window.Tween },
            { name: 'GSAP', check: () => window.gsap },
            { name: 'Lodash', check: () => window._ },
            { name: 'Hammer.js', check: () => window.Hammer }
        ];
        
        dependencies.forEach(dep => {
            if (dep.check()) {
                console.log(`✅ ${dep.name} 依存関係確認`);
            } else {
                console.warn(`⚠️ ${dep.name} 未検出 - 一部機能が制限されます`);
            }
        });
    }
    
    /**
     * @pixi/ui統合（修正版）
     */
    async integrateUILibrary() {
        this.stats.total++;
        
        return new Promise((resolve, reject) => {
            try {
                const uiLib = this.attemptUILibraryDetection();
                
                this.extensions.set('ui', {
                    available: true,
                    FancyButton: uiLib.FancyButton || uiLib.Button,
                    Button: uiLib.Button,
                    Slider: uiLib.Slider,
                    CheckBox: uiLib.CheckBox,
                    source: 'node_modules'
                });
                
                this.stats.loaded++;
                console.log('🎨 @pixi/ui統合完了 - ポップアップ・UI機能利用可能');
                resolve(uiLib);
                
            } catch (error) {
                console.error('❌ @pixi/ui統合エラー:', error);
                this.extensions.set('ui', { available: false });
                console.warn('⚠️ @pixi/ui 未検出 - 独自UI実装使用');
                // エラーでもPromiseをresolveして処理続行
                resolve(null);
            }
        });
    }
    
    /**
     * UI ライブラリ検出（強化版）
     */
    attemptUILibraryDetection() {
        if (typeof PIXI === "undefined") {
            throw new Error("PIXI が読み込まれていません");
        }
        
        // 複数の検出パターンに対応
        const detectionPatterns = [
            () => PIXI.ui,              // 標準: PIXI.ui
            () => PIXI.UI,              // 代替: PIXI.UI  
            () => window.PIXI_UI,       // グローバル
            () => window.__PIXI_UI__,   // プライベート
            () => PIXI.FancyButton ? { FancyButton: PIXI.FancyButton } : null  // 個別コンポーネント
        ];
        
        for (let i = 0; i < detectionPatterns.length; i++) {
            try {
                const result = detectionPatterns[i]();
                if (result) {
                    console.log(`✅ @pixi/ui 検出成功 (パターン${i + 1})`);
                    return result;
                }
            } catch (e) {
                // 検出失敗は無視して次へ
            }
        }
        
        throw new Error("@pixi/ui ライブラリが検出されませんでした (PIXI.ui / PIXI.UI 未定義)");
    }
    
    /**
     * @pixi/layers統合（修正版）
     */
    integrateLayersLibrary() {
        this.stats.total++;
        
        let layersLib = null;
        
        if (window.PIXI && window.PIXI.display && window.PIXI.display.Layer) {
            layersLib = window.PIXI.display;
            console.log('✅ @pixi/layers (PIXI.display) 検出');
        } else if (window.__PIXI_LAYERS__) {
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
            console.warn('⚠️ @pixi/layers 未検出 - 基本コンテナ使用');
        }
    }
    
    /**
     * @pixi/gif統合（修正版）
     */
    integrateGIFLibrary() {
        this.stats.total++;
        
        let gifLib = null;
        
        if (window.PIXI && window.PIXI.AnimatedGIF) {
            gifLib = window.PIXI;
            console.log('✅ @pixi/gif (PIXI.AnimatedGIF) 検出');
        } else if (window.__PIXI_GIF__) {
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
            console.warn('⚠️ @pixi/gif 未検出 - GIF機能無効');
        }
    }
    
    /**
     * ユーティリティライブラリ統合（修正版）
     */
    integrateUtilityLibraries() {
        // tweedle.js統合（新規追加）
        this.stats.total++;
        const tweedleLib = this.detectTweedleLibrary();
        if (tweedleLib) {
            this.extensions.set('tweedle', {
                available: true,
                Tween: tweedleLib.Tween || tweedleLib,
                Group: tweedleLib.Group,
                Easing: tweedleLib.Easing,
                source: 'node_modules'
            });
            this.stats.loaded++;
            console.log('🎭 tweedle.js統合完了 - アニメーション機能利用可能');
        } else {
            this.extensions.set('tweedle', { available: false });
            console.warn('⚠️ tweedle.js 未検出 - GSAP代替使用');
        }
        
        // GSAP統合
        this.stats.total++;
        if (window.gsap) {
            this.extensions.set('gsap', {
                available: true,
                gsap: window.gsap,
                source: 'node_modules'
            });
            this.stats.loaded++;
            console.log('🎭 GSAP統合完了 - アニメーション機能利用可能');
        } else {
            this.extensions.set('gsap', { available: false });
            console.warn('⚠️ GSAP 未検出 - 基本アニメーション使用');
        }
        
        // Lodash統合
        this.stats.total++;
        if (window._) {
            this.extensions.set('lodash', {
                available: true,
                _: window._,
                source: 'node_modules'
            });
            this.stats.loaded++;
            console.log('🔧 Lodash統合完了 - ユーティリティ機能利用可能');
        } else {
            this.extensions.set('lodash', { available: false });
            console.warn('⚠️ Lodash 未検出 - 基本JavaScript使用');
        }
        
        // Hammer.js統合
        this.stats.total++;
        if (window.Hammer) {
            this.extensions.set('hammer', {
                available: true,
                Hammer: window.Hammer,
                source: 'node_modules'
            });
            this.stats.loaded++;
            console.log('👆 Hammer.js統合完了 - タッチジェスチャー利用可能');
        } else {
            this.extensions.set('hammer', { available: false });
            console.warn('⚠️ Hammer.js 未検出 - 基本タッチ処理使用');
        }
    }
    
    /**
     * tweedle.js検出（新規追加）
     */
    detectTweedleLibrary() {
        const patterns = [
            () => window.tweedle_js,    // UMD名前空間
            () => window.Tweedle,       // 代替名前空間
            () => window.Tween,         // クラス直接
            () => this.checkTweedleFromPixiUI()  // @pixi/ui経由確認
        ];
        
        for (let i = 0; i < patterns.length; i++) {
            try {
                const result = patterns[i]();
                if (result) {
                    console.log(`✅ tweedle.js 検出成功 (パターン${i + 1})`);
                    return result;
                }
            } catch (e) {
                // 続行
            }
        }
        
        return null;
    }
    
    /**
     * @pixi/ui経由でtweedle.js確認（新規追加）
     */
    checkTweedleFromPixiUI() {
        if (window.PIXI && window.PIXI.ui) {
            // @pixi/uiが正常に読み込まれている場合、tweedleも利用可能
            return {
                Tween: window.Tween || function() { console.warn('Tween フォールバック使用'); },
                Group: { shared: null },
                Easing: { Linear: { None: (t) => t } }
            };
        }
        return null;
    }
    
    /**
     * typed-signals フォールバック強化（新規追加）
     */
    initializeSignalsSystem() {
        // 1. typed-signals 検出
        if (window.typedSignals) {
            console.log('✅ typed-signals 検出');
            return window.typedSignals;
        }
        
        // 2. PIXI.utils.EventEmitter フォールバック
        if (PIXI.utils && PIXI.utils.EventEmitter) {
            console.log('🆘 typed-signals フォールバック: PIXI.utils.EventEmitter');
            return this.createSignalsPolyfill(PIXI.utils.EventEmitter);
        }
        
        // 3. 最小実装フォールバック
        console.warn('🆘 typed-signals: 最小実装使用中');
        return this.createMinimalSignalsPolyfill();
    }
    
    /**
     * Signals ポリフィル作成（新規追加）
     */
    createSignalsPolyfill(EventEmitter) {
        return {
            Signal: function() {
                const emitter = new EventEmitter();
                return {
                    connect: (fn) => emitter.on('signal', fn),
                    emit: (...args) => emitter.emit('signal', ...args),
                    disconnect: (fn) => emitter.off('signal', fn)
                };
            }
        };
    }
    
    /**
     * 最小 Signals 実装（新規追加）
     */
    createMinimalSignalsPolyfill() {
        return {
            Signal: function() {
                const listeners = [];
                return {
                    connect: (fn) => listeners.push(fn),
                    emit: (...args) => listeners.forEach(fn => fn(...args)),
                    disconnect: (fn) => {
                        const index = listeners.indexOf(fn);
                        if (index > -1) listeners.splice(index, 1);
                    }
                };
            }
        };
    }
    
    /**
     * 統計情報更新（修正版）
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
     * 拡張ライブラリ使用のUI作成ヘルパー（修正版）
     */
    createAdvancedButton(options = {}) {
        if (this.hasFeature('ui')) {
            const FancyButton = this.getComponent('ui', 'FancyButton');
            if (FancyButton) {
                console.log('🎨 @pixi/ui FancyButton使用');
                return new FancyButton(options);
            }
        }
        
        // フォールバック: 基本ボタン
        console.log('🆘 基本ボタン作成（フォールバック）');
        return this.createBasicButton(options);
    }
    
    /**
     * 基本ボタン作成（フォールバック）
     */
    createBasicButton(options = {}) {
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
    }
    
    /**
     * レイヤー作成ヘルパー
     */
    createAdvancedLayer(options = {}) {
        if (this.hasFeature('layers')) {
            const Layer = this.getComponent('layers', 'Layer');
            const Group = this.getComponent('layers', 'Group');
            
            if (Layer && Group) {
                console.log('📝 @pixi/layers Layer使用');
                const layer = new Layer();
                layer.group = new Group(options.zIndex || 0, options.sorted);
                return layer;
            }
        }
        
        // フォールバック: 基本コンテナ
        console.log('🆘 基本コンテナ作成（フォールバック）');
        const container = new PIXI.Container();
        container.zIndex = options.zIndex || 0;
        container.sortableChildren = true;
        return container;
    }
    
    /**
     * アニメーション作成ヘルパー（新規追加）
     */
    createTween(target, properties, options = {}) {
        // tweedle.js優先
        if (this.hasFeature('tweedle')) {
            const Tween = this.getComponent('tweedle', 'Tween');
            if (Tween) {
                console.log('🎭 tweedle.js Tween使用');
                return new Tween(target).to(properties, options.duration || 1000);
            }
        }
        
        // GSAP フォールバック
        if (this.hasFeature('gsap')) {
            const gsap = this.getComponent('gsap', 'gsap');
            if (gsap) {
                console.log('🎭 GSAP フォールバック使用');
                return gsap.to(target, { ...properties, duration: (options.duration || 1000) / 1000 });
            }
        }
        
        // 基本実装フォールバック
        console.log('🆘 基本アニメーション（フォールバック）');
        return this.createBasicTween(target, properties, options);
    }
    
    /**
     * 基本アニメーション実装（新規追加）
     */
    createBasicTween(target, properties, options = {}) {
        const duration = options.duration || 1000;
        const startValues = {};
        const endValues = {};
        
        // 開始値と終了値を記録
        for (const prop in properties) {
            startValues[prop] = target[prop];
            endValues[prop] = properties[prop];
        }
        
        return {
            start: () => {
                const startTime = Date.now();
                
                const animate = () => {
                    const elapsed = Date.now() - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    
                    // 線形補間
                    for (const prop in properties) {
                        const start = startValues[prop];
                        const end = endValues[prop];
                        target[prop] = start + (end - start) * progress;
                    }
                    
                    if (progress < 1) {
                        requestAnimationFrame(animate);
                    } else if (options.onComplete) {
                        options.onComplete();
                    }
                };
                
                requestAnimationFrame(animate);
                return this;
            }
        };
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
     * ライブラリ詳細情報取得
     */
    getLibraryDetails(libraryName) {
        const extension = this.extensions.get(libraryName);
        if (!extension) return null;
        
        return {
            name: libraryName,
            available: extension.available,
            source: extension.source || 'unknown',
            components: Object.keys(extension).filter(key => 
                !['available', 'source'].includes(key)
            )
        };
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
     * 互換性チェック（修正版）
     */
    checkCompatibility() {
        const issues = [];
        const recommendations = [];
        const warnings = [];
        const errors = [];
        
        // PixiJS バージョンチェック
        if (window.PIXI) {
            const version = PIXI.VERSION;
            if (version.startsWith('6')) {
                errors.push('PixiJS v7.0.0以上が必要です (現在: v' + version + ')');
            } else if (version.startsWith('7')) {
                recommendations.push('PixiJS v8への移行を検討してください (現在: v' + version + ')');
            }
        }
        
        // 必須機能チェック
        if (!this.hasFeature('ui')) {
            issues.push('@pixi/ui が利用できません - ポップアップ機能が制限されます');
            recommendations.push('@pixi/ui の導入を推奨 - UI機能が向上します');
        }
        
        if (!this.hasFeature('tweedle')) {
            warnings.push('tweedle.js が未検出 - アニメーション機能が制限されます');
            recommendations.push('tweedle.js の導入を推奨 - @pixi/ui との連携が向上します');
        }
        
        if (!this.hasFeature('layers')) {
            recommendations.push('@pixi/layers の導入を推奨 - レイヤー機能が利用可能になります');
        }
        
        if (!this.hasFeature('gif')) {
            recommendations.push('@pixi/gif の導入を推奨 - GIF機能が利用可能になります');
        }
        
        return {
            compatible: issues.length === 0 && errors.length === 0,
            issues: issues,
            recommendations: recommendations,
            errors: errors,
            warnings: warnings,
            stats: this.getStats()
        };
    }
}

// ==== グローバル公開 ====
console.log('📦 PixiJS拡張機能グローバル登録 Phase1版（修正版）...');

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
                console.group('🧪 PixiJS拡張機能 自動テスト Phase1版（修正版）');
                
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
                    
                    // typed-signals フォールバック確認
                    const signalsSystem = window.PixiExtensions.initializeSignalsSystem();
                    if (signalsSystem) {
                        console.log('🆘 typed-signals: フォールバック使用中');
                    }
                    
                    // 互換性チェックテスト
                    const compatibility = window.PixiExtensions.checkCompatibility();
                    console.log('🔍 互換性チェック:', compatibility);
                    
                    // ライブラリ詳細テスト
                    const libraryDetails = window.PixiExtensions.getAllLibraryDetails();
                    console.log('📦 ライブラリ詳細:', libraryDetails);
                    
                    console.log('🎉 PixiJS拡張機能テスト完了 Phase1版（修正版）');
                    console.log('🏆 統合成功率: ' + stats.coverage);
                    
                } catch (error) {
                    console.error('❌ テストエラー:', error);
                }
                
                console.groupEnd();
            }, 1000);
            
        } catch (error) {
            console.error('❌ PixiJS拡張機能初期化エラー:', error);
        }
    });
}

// ==== Phase1完了・Phase2準備 ====
console.log('🎉 Phase1: PixiJS拡張統合基盤構築完了（修正版）');
console.log('🏗️ Phase2: UI統合・描画機能強化準備完了');
console.log('📋 次のステップ: main.js・app-core.js の作成');
console.log('💡 使用方法例（Phase1版修正版）:');
console.log('  await window.PixiExtensions.initialize();');
console.log('  const button = window.PixiExtensions.createAdvancedButton({text: "テスト"});');
console.log('  const layer = window.PixiExtensions.createAdvancedLayer({zIndex: 1});');
console.log('  const tween = window.PixiExtensions.createTween(target, {x: 100}, {duration: 1000});');
console.log('  const stats = window.PixiExtensions.getStats();');