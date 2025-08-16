/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * PixiJS拡張ライブラリ統合システム - Phase1版（エラーハンドリング強化版）
 * 
 * 🎯 AI_WORK_SCOPE: PixiJS拡張ライブラリ検出・統合・互換性レイヤー
 * 🎯 DEPENDENCIES: PixiJS v7, @pixi/ui, @pixi/layers, @pixi/gif, GSAP, Lodash, Hammer.js
 * 🎯 NODE_MODULES: pixi.js@^7.4.3, @pixi/ui@^1.2.4, @pixi/layers@^2.1.0, @pixi/gif@^2.1.1
 * 🎯 PIXI_EXTENSIONS: 全統合機能
 * 🎯 ISOLATION_TEST: 可能（依存関係確認）
 * 🎯 SPLIT_THRESHOLD: 400行（統合性重視で分割想定外）
 * 📋 PHASE_TARGET: Phase1
 * 📋 V8_MIGRATION: Application.init()対応予定、typed-signals依存関係変更予定
 * 
 * 🔧 修正内容：
 * - typed-signals 未定義エラー対応
 * - エラーハンドリング強化
 * - 統計・互換性チェック詳細化
 * - フォールバック機構信頼性向上
 */

console.log('🔧 PixiJS拡張ライブラリ統合システム Phase1版（エラーハンドリング強化版） 読み込み開始...');

/**
 * PixiJS拡張ライブラリ統合管理システム（エラーハンドリング強化版）
 * node_modules統合・CORS制限回避・typed-signals対応
 */
class PixiExtensionsManager {
    constructor() {
        this.extensions = new Map();
        this.initialized = false;
        this.stats = {
            loaded: 0,
            total: 0,
            errors: [],
            warnings: []
        };
        this.retryCount = 0;
        this.maxRetries = 3;
        
        console.log('🎨 PixiExtensionsManager 構築開始（エラーハンドリング強化版）...');
    }
    
    /**
     * 拡張ライブラリ統合初期化（エラーハンドリング強化版）
     */
    async initialize() {
        console.group('🎨 PixiJS拡張ライブラリ統合初期化 Phase1版（エラーハンドリング強化版）');
        
        try {
            // STEP1: PixiJS本体検証
            this.validateCoreLibraries();
            
            // STEP2: typed-signals 依存関係確認
            this.validateTypedSignals();
            
            // STEP3: 拡張ライブラリ統合（エラーハンドリング付き）
            await this.integrateUILibrary();
            this.integrateLayersLibrary();
            this.integrateGIFLibrary();
            this.integrateUtilityLibraries();
            
            // STEP4: 統計更新
            this.updateStats();
            
            this.initialized = true;
            console.log('✅ PixiJS拡張ライブラリ統合完了（エラーハンドリング強化版）');
            console.log(`📊 統計: ${this.stats.loaded}/${this.stats.total} (${Math.round(this.stats.loaded/this.stats.total*100)}%)`);
            
            // エラー・警告レポート
            if (this.stats.errors.length > 0) {
                console.warn('⚠️ エラー発生:', this.stats.errors);
            }
            if (this.stats.warnings.length > 0) {
                console.warn('💡 警告:', this.stats.warnings);
            }
            
        } catch (error) {
            console.error('❌ PixiJS拡張ライブラリ統合エラー:', error);
            this.stats.errors.push(error.message);
            
            // フォールバックモード継続
            console.log('🆘 フォールバックモードで初期化継続');
            this.initialized = true; // フォールバックでも初期化完了とする
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
            throw new Error('PixiJS が読み込まれていません - node_modules/pixi.js/dist/pixi.min.js を確認してください');
        }
        
        console.log(`✅ PixiJS v${PIXI.VERSION} 検出`);
        
        // v8移行予告
        if (PIXI.VERSION.startsWith('7')) {
            console.log('📋 V8_MIGRATION: PixiJS v8移行準備 - Application.init()対応予定');
            this.stats.warnings.push('PixiJS v8移行準備が必要です');
        }
        
        this.stats.total++;
        this.stats.loaded++;
    }
    
    /**
     * typed-signals 依存関係確認（新規追加）
     */
    validateTypedSignals() {
        console.log('🔍 typed-signals 依存関係確認中...');
        
        if (typeof window.typedSignals === 'undefined') {
            this.stats.warnings.push('typed-signals が未定義です - フォールバックが適用されている可能性があります');
            console.warn('⚠️ typed-signals 未定義 - @pixi/ui統合時に問題が発生する可能性');
        } else if (!window.typedSignals.Signal) {
            this.stats.errors.push('typed-signals の構造が不正です');
            console.error('❌ typed-signals.Signal が存在しません');
        } else {
            const isFallback = window.typedSignals._fallback === true;
            if (isFallback) {
                console.log('✅ typed-signals フォールバック検出');
                this.stats.warnings.push('typed-signals フォールバックを使用中');
            } else {
                console.log('✅ typed-signals ネイティブライブラリ検出');
            }
        }
    }
    
    /**
     * @pixi/ui統合（エラーハンドリング大幅強化版）
     */
    async integrateUILibrary() {
        this.stats.total++;
        
        return new Promise((resolve) => {
            console.log('🎨 @pixi/ui統合開始（エラーハンドリング強化版）...');
            
            try {
                // typed-signals 依存関係事前チェック
                if (typeof window.typedSignals === 'undefined') {
                    console.warn('⚠️ typed-signals 未定義 - フォールバック確認中');
                    
                    // フォールバック適用まで少し待つ
                    setTimeout(() => {
                        if (typeof window.typedSignals === 'undefined') {
                            console.error('❌ typed-signals フォールバック失敗');
                            this.extensions.set('ui', { 
                                available: false, 
                                error: 'typed-signals dependency missing',
                                fallbackMode: true
                            });
                            this.stats.errors.push('typed-signals dependency missing');
                            resolve();
                        } else {
                            this.retryUIIntegration().then(resolve);
                        }
                    }, 200); // フォールバック適用を待つ
                    return;
                }
                
                // UI ライブラリ検出（複数パターン対応・エラーハンドリング付き）
                this.attemptUILibraryDetection();
                resolve();
                
            } catch (error) {
                console.error('❌ @pixi/ui統合エラー:', error);
                this.extensions.set('ui', { 
                    available: false,
                    error: error.message,
                    fallbackMode: true
                });
                this.stats.errors.push(`UI integration failed: ${error.message}`);
                console.log('🆘 @pixi/ui フォールバックモード - 独自UI実装使用');
                resolve();
            }
        });
    }
    
    /**
     * UI ライブラリ検出処理
     */
    attemptUILibraryDetection() {
        let uiLib = null;
        let detectionMethod = '';
        
        // 複数の検出パターンに対応
        if (window.PIXI && window.PIXI.UI) {
            uiLib = window.PIXI.UI;
            detectionMethod = 'PIXI.UI';
        } else if (window.PIXI && window.PIXI.FancyButton) {
            uiLib = { 
                FancyButton: window.PIXI.FancyButton,
                Button: window.PIXI.Button,
                Slider: window.PIXI.Slider,
                CheckBox: window.PIXI.CheckBox
            };
            detectionMethod = 'PIXI.FancyButton';
        } else if (window.__PIXI_UI__) {
            uiLib = window.__PIXI_UI__;
            detectionMethod = '__PIXI_UI__';
        }
        
        if (uiLib) {
            // コンポーネント存在確認
            const availableComponents = [];
            const missingComponents = [];
            
            ['FancyButton', 'Button', 'Slider', 'CheckBox'].forEach(component => {
                if (uiLib[component]) {
                    availableComponents.push(component);
                } else {
                    missingComponents.push(component);
                }
            });
            
            this.extensions.set('ui', {
                available: true,
                FancyButton: uiLib.FancyButton || null,
                Button: uiLib.Button || null,
                Slider: uiLib.Slider || null,
                CheckBox: uiLib.CheckBox || null,
                source: 'node_modules',
                detectionMethod: detectionMethod,
                availableComponents: availableComponents,
                missingComponents: missingComponents,
                typedSignalsOk: true
            });
            this.stats.loaded++;
            
            console.log(`✅ @pixi/ui (${detectionMethod}) 検出`);
            console.log(`📦 利用可能コンポーネント: ${availableComponents.join(', ')}`);
            
            if (missingComponents.length > 0) {
                console.warn(`⚠️ 不足コンポーネント: ${missingComponents.join(', ')}`);
                this.stats.warnings.push(`Missing UI components: ${missingComponents.join(', ')}`);
            }
            
            console.log('🎨 @pixi/ui統合完了 - ポップアップ・UI機能利用可能');
        } else {
            throw new Error('@pixi/ui ライブラリが検出されませんでした');
        }
    }
    
    /**
     * UI統合リトライ処理
     */
    async retryUIIntegration() {
        return new Promise((resolve) => {
            console.log(`🔄 @pixi/ui統合リトライ (${this.retryCount + 1}/${this.maxRetries})`);
            this.retryCount++;
            
            if (this.retryCount >= this.maxRetries) {
                console.error('❌ @pixi/ui統合リトライ上限到達');
                this.extensions.set('ui', { 
                    available: false, 
                    error: 'Max retries reached',
                    fallbackMode: true
                });
                this.stats.errors.push('UI integration max retries reached');
                resolve();
                return;
            }
            
            try {
                this.attemptUILibraryDetection();
                resolve();
            } catch (error) {
                setTimeout(() => {
                    this.retryUIIntegration().then(resolve);
                }, 300 * this.retryCount); // 段階的に待機時間を増加
            }
        });
    }
    
    /**
     * @pixi/layers統合
     */
    integrateLayersLibrary() {
        this.stats.total++;
        
        try {
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
                console.log('💡 @pixi/layers利用可能 - 高度なレイヤー管理が使用できます');
            } else {
                this.extensions.set('layers', { available: false });
                console.warn('⚠️ @pixi/layers 未検出 - 基本コンテナ使用');
                this.stats.warnings.push('@pixi/layers not available - using basic containers');
            }
        } catch (error) {
            console.error('❌ @pixi/layers統合エラー:', error);
            this.extensions.set('layers', { available: false, error: error.message });
            this.stats.errors.push(`Layers integration failed: ${error.message}`);
        }
    }
    
    /**
     * @pixi/gif統合
     */
    integrateGIFLibrary() {
        this.stats.total++;
        
        try {
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
                console.log('💡 @pixi/gif利用可能 - GIFアニメーション機能が使用できます');
            } else {
                this.extensions.set('gif', { available: false });
                console.warn('⚠️ @pixi/gif 未検出 - GIF機能無効');
                this.stats.warnings.push('@pixi/gif not available - GIF functionality disabled');
            }
        } catch (error) {
            console.error('❌ @pixi/gif統合エラー:', error);
            this.extensions.set('gif', { available: false, error: error.message });
            this.stats.errors.push(`GIF integration failed: ${error.message}`);
        }
    }
    
    /**
     * ユーティリティライブラリ統合（GSAP, Lodash, Hammer.js）
     */
    integrateUtilityLibraries() {
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
                console.log('🎭 GSAP統合完了 - アニメーション機能利用可能');
            } else {
                this.extensions.set('gsap', { available: false });
                console.warn('⚠️ GSAP 未検出 - 基本アニメーション使用');
                this.stats.warnings.push('GSAP not available - using basic animations');
            }
        } catch (error) {
            console.error('❌ GSAP統合エラー:', error);
            this.extensions.set('gsap', { available: false, error: error.message });
            this.stats.errors.push(`GSAP integration failed: ${error.message}`);
        }
        
        // Lodash統合
        this.stats.total++;
        try {
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
                this.stats.warnings.push('Lodash not available - using basic JavaScript');
            }
        } catch (error) {
            console.error('❌ Lodash統合エラー:', error);
            this.extensions.set('lodash', { available: false, error: error.message });
            this.stats.errors.push(`Lodash integration failed: ${error.message}`);
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
                this.extensions.set('hammer', { available: false });
                console.warn('⚠️ Hammer.js 未検出 - 基本タッチ処理使用');
                this.stats.warnings.push('Hammer.js not available - using basic touch handling');
            }
        } catch (error) {
            console.error('❌ Hammer.js統合エラー:', error);
            this.extensions.set('hammer', { available: false, error: error.message });
            this.stats.errors.push(`Hammer.js integration failed: ${error.message}`);
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
        
        console.log(`📊 最終統計: ${this.stats.loaded}/${this.stats.total} (${this.stats.coverage}%)`);
        console.log(`🏆 統合成功率: ${this.stats.coverage}% (${this.stats.loaded}/${this.stats.total})`);
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
     * 拡張ライブラリ使用のUI作成ヘルパー
     */
    createAdvancedButton(options = {}) {
        if (this.hasFeature('ui')) {
            const FancyButton = this.getComponent('ui', 'FancyButton');
            if (FancyButton) {
                console.log('🎨 @pixi/ui FancyButton使用');
                try {
                    return new FancyButton(options);
                } catch (error) {
                    console.error('❌ FancyButton作成エラー:', error);
                    console.log('🆘 基本ボタンにフォールバック');
                    return this.createBasicButton(options);
                }
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
        
        try {
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
        } catch (error) {
            console.error('❌ 基本ボタン作成エラー:', error);
        }
        
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
                try {
                    const layer = new Layer();
                    layer.group = new Group(options.zIndex || 0, options.sorted);
                    return layer;
                } catch (error) {
                    console.error('❌ Layer作成エラー:', error);
                    console.log('🆘 基本コンテナにフォールバック');
                }
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
     * 統計情報取得（エラー詳細対応版）
     */
    getStats() {
        const availableLibraries = Array.from(this.extensions.entries())
            .filter(([_, ext]) => ext.available)
            .map(([name, _]) => name);
            
        const errorLibraries = Array.from(this.extensions.entries())
            .filter(([_, ext]) => !ext.available && ext.error)
            .map(([name, ext]) => ({ name, error: ext.error }));
        
        return {
            initialized: this.initialized,
            loaded: this.stats.loaded,
            total: this.stats.total,
            coverage: this.stats.coverage + '%',
            libraries: Array.from(this.extensions.keys()),
            available: availableLibraries,
            errors: this.stats.errors,
            warnings: this.stats.warnings,
            errorDetails: errorLibraries,
            typedSignalsOk: typeof window.typedSignals !== 'undefined',
            retryCount: this.retryCount
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
            error: extension.error || null,
            components: Object.keys(extension).filter(key => 
                !['available', 'source', 'error', 'fallbackMode', 'detectionMethod', 'availableComponents', 'missingComponents', 'typedSignalsOk'].includes(key)
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
     * 互換性チェック（エラー統計対応版）
     */
    checkCompatibility() {
        const issues = [];
        const recommendations = [];
        
        // typed-signals 依存関係チェック
        if (typeof window.typedSignals === 'undefined') {
            issues.push('typed-signals が不足しています - @pixi/ui が利用できません');
            recommendations.push('typed-signals フォールバック適用または npm install typed-signals を推奨');
        } else if (window.typedSignals && !window.typedSignals.Signal) {
            issues.push('typed-signals の構造が不正です');
            recommendations.push('typed-signals の再インストールを推奨');
        } else if (window.typedSignals._fallback) {
            recommendations.push('typed-signals フォールバックを使用中 - 本来のライブラリ導入を推奨');
        }
        
        // @pixi/ui 統合状態チェック
        const uiExtension = this.extensions.get('ui');
        if (uiExtension && !uiExtension.available && uiExtension.error) {
            recommendations.push(`@pixi/ui エラー解決: ${uiExtension.error}`);
        }
        
        // PixiJS バージョンチェック
        if (window.PIXI) {
            const version = PIXI.VERSION;
            if (version.startsWith('6')) {
                issues.push('PixiJS v7.0.0以上が必要です (現在: v' + version + ')');
            }
            
            // v8移行準備チェック
            if (version.startsWith('7')) {
                recommendations.push('PixiJS v8移行準備: Application.init()対応予定');
            }
        }
        
        // エラー率チェック
        const errorRate = this.stats.errors.length / this.stats.total;
        if (errorRate > 0.5) {
            issues.push('エラー率が高すぎます - node_modules 構造を確認してください');
        }
        
        return {
            compatible: issues.length === 0,
            issues: issues,
            recommendations: recommendations,
            errors: this.stats.errors,
            warnings: this.stats.warnings,
            typedSignalsStatus: {
                available: typeof window.typedSignals !== 'undefined',
                isSignal: window.typedSignals && typeof window.typedSignals.Signal === 'function',
                isFallback: window.typedSignals && window.typedSignals._fallback === true
            },
            stats: this.getStats()
        };
    }
}

// ==== グローバル公開 ====
console.log('📦 PixiJS拡張機能グローバル登録 Phase1版（エラーハンドリング強化版）...');

// インスタンス作成・グローバル公開
window.PixiExtensions = new PixiExtensionsManager();

// ==== 初期化完了後の自動テスト ====
if (typeof window !== 'undefined') {
    // 初期化完了を待つ
    window.addEventListener('DOMContentLoaded', async () => {
        try {
            // 自動初期化実行
            await window.PixiExtensions.initialize();
            
            // 自動テスト実行（エラーハンドリング強化版）
            setTimeout(() => {
                console.group('🧪 PixiJS拡張機能 自動テスト Phase1版（検出修正版）');
                
                try {
                    // 統計取得テスト
                    const stats = window.PixiExtensions.getStats();
                    console.log('✅ 統計取得:', stats);
                    
                    // 機能チェックテスト
                    const features = ['ui', 'layers', 'gif', 'gsap', 'lodash', 'hammer'];
                    features.forEach(feature => {
                        const available = window.PixiExtensions.hasFeature(feature);
                        console.log(`${available ? '✅' : '❌'} ${feature}機能: ${available ? '利用可能' : '無効'}`);
                    });
                    
                    // typed-signals 状態確認
                    if (typeof window.typedSignals !== 'undefined') {
                        const isFallback = window.typedSignals._fallback === true;
                        console.log(`${isFallback ? '🆘' : '✅'} typed-signals: ${isFallback ? 'フォールバック使用中' : 'ネイティブライブラリ'}`);
                    }
                    
                    // 互換性チェックテスト
                    const compatibility = window.PixiExtensions.checkCompatibility();
                    console.log('🔍 互換性チェック:', compatibility);
                    
                    // ライブラリ詳細テスト
                    const libraryDetails = window.PixiExtensions.getAllLibraryDetails();
                    console.log('📦 ライブラリ詳細:', libraryDetails);
                    
                    console.log('🎉 PixiJS拡張機能テスト完了 Phase1版（検出修正版）');
                    console.log(`🏆 統合成功率: ${stats.coverage} (${stats.loaded}/${stats.total})`);
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
console.log('🎉 Phase1: PixiJS拡張統合基盤構築完了（エラーハンドリング強化版）');
console.log('🏗️ Phase2: UI統合・描画機能強化準備完了');
console.log('📋 次のステップ: main.js・app-core.js の作成');
console.log('💡 使用方法例（Phase1版・エラーハンドリング強化版）:');
console.log('  await window.PixiExtensions.initialize();');
console.log('  const button = window.PixiExtensions.createAdvancedButton({text: "テスト"});');
console.log('  const layer = window.PixiExtensions.createAdvancedLayer({zIndex: 1});');
console.log('  const stats = window.PixiExtensions.getStats();');
console.log('  const compatibility = window.PixiExtensions.checkCompatibility();');