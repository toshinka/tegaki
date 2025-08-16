/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * PixiJS拡張ライブラリ統合システム - Phase1版エラー修繕
 * 
 * 🎯 AI_WORK_SCOPE: PixiJS拡張ライブラリ検出・統合・互換性レイヤー
 * 🎯 DEPENDENCIES: PixiJS v7, @pixi/ui, @pixi/layers, @pixi/gif, GSAP, Lodash, Hammer.js
 * 🎯 NODE_MODULES: pixi.js@^7.4.3, @pixi/ui@^1.2.4, @pixi/layers@^2.1.0, @pixi/gif@^2.1.1
 * 🎯 PIXI_EXTENSIONS: 全統合機能
 * 🎯 ISOLATION_TEST: 可能（依存関係確認）
 * 🎯 SPLIT_THRESHOLD: 400行（統合性重視で分割想定外）
 * 📋 PHASE_TARGET: Phase1
 * 📋 V8_MIGRATION: Application.init()対応予定
 * 🔧 REPAIR_TARGET: @pixi/layers, @pixi/gif 検出修繕
 */

console.log('🔧 PixiJS拡張ライブラリ統合システム Phase1版エラー修繕 読み込み開始...');

/**
 * PixiJS拡張ライブラリ統合管理システム
 * node_modules統合・CORS制限回避対応・検出パターン修繕版
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
     * 拡張ライブラリ統合初期化
     */
    async initialize() {
        console.group('🎨 PixiJS拡張ライブラリ統合初期化 Phase1版エラー修繕');
        
        try {
            // PixiJS本体検証
            this.validateCoreLibraries();
            
            // 拡張ライブラリ統合（修繕版）
            this.integrateUILibrary();
            this.integrateLayersLibrary(); // 🔧 修繕対象
            this.integrateGIFLibrary();    // 🔧 修繕対象
            this.integrateUtilityLibraries();
            
            // 統計更新
            this.updateStats();
            
            this.initialized = true;
            console.log('✅ PixiJS拡張ライブラリ統合完了（修繕版）');
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
        }
        
        this.stats.total++;
        this.stats.loaded++;
    }
    
    /**
     * @pixi/ui統合
     */
    integrateUILibrary() {
        this.stats.total++;
        
        // 複数の検出パターンに対応
        let uiLib = null;
        
        if (window.PIXI && window.PIXI.UI) {
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
                FancyButton: uiLib.FancyButton,
                Button: uiLib.Button,
                Slider: uiLib.Slider,
                CheckBox: uiLib.CheckBox,
                source: 'node_modules'
            });
            this.stats.loaded++;
            console.log('🎨 @pixi/ui統合完了 - ポップアップ・UI機能利用可能');
        } else {
            this.extensions.set('ui', { available: false });
            console.warn('⚠️ @pixi/ui 未検出 - 独自UI実装使用');
        }
    }
    
    /**
     * @pixi/layers統合（🔧 修繕版）
     */
    integrateLayersLibrary() {
        this.stats.total++;
        
        let layersLib = null;
        
        // 🔧 修繕: PIXI.layers パターンを最初にチェック
        if (window.PIXI && window.PIXI.layers && window.PIXI.layers.Layer) {
            layersLib = window.PIXI.layers;
            console.log('✅ @pixi/layers (PIXI.layers) 検出');
        } else if (window.PIXI && window.PIXI.display && window.PIXI.display.Layer) {
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
            // 🔧 デバッグ情報追加
            console.log('🔍 デバッグ: PIXI.layers =', window.PIXI?.layers);
            console.log('🔍 デバッグ: PIXI.display =', window.PIXI?.display);
        }
    }
    
    /**
     * @pixi/gif統合（🔧 修繕版）
     */
    integrateGIFLibrary() {
        this.stats.total++;
        
        let gifLib = null;
        
        // 🔧 修繕: PIXI.gif パターンを最初にチェック
        if (window.PIXI && window.PIXI.gif && window.PIXI.gif.AnimatedGIF) {
            gifLib = window.PIXI.gif;
            console.log('✅ @pixi/gif (PIXI.gif) 検出');
        } else if (window.PIXI && window.PIXI.AnimatedGIF) {
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
            // 🔧 デバッグ情報追加
            console.log('🔍 デバッグ: PIXI.gif =', window.PIXI?.gif);
            console.log('🔍 デバッグ: PIXI.AnimatedGIF =', window.PIXI?.AnimatedGIF);
        }
    }
    
    /**
     * ユーティリティライブラリ統合（GSAP, Lodash, Hammer.js, Tweedle）
     */
    integrateUtilityLibraries() {
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
        
        // 🔧 Tweedle統合追加
        this.stats.total++;
        if (window.TWEEDLE) {
            this.extensions.set('tweedle', {
                available: true,
                Tween: window.TWEEDLE.Tween,
                Group: window.TWEEDLE.Group,
                source: 'node_modules'
            });
            this.stats.loaded++;
            console.log('🎯 Tweedle統合完了 - 軽量アニメーション利用可能');
        } else {
            this.extensions.set('tweedle', { available: false });
            console.warn('⚠️ Tweedle 未検出 - 基本アニメーション使用');
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
     * 拡張ライブラリ使用のUI作成ヘルパー
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
     * レイヤー作成ヘルパー（🔧 修繕版）
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
     * GIF作成ヘルパー（🔧 修繕版）
     */
    createAnimatedGIF(buffer, options = {}) {
        if (this.hasFeature('gif')) {
            const AnimatedGIF = this.getComponent('gif', 'AnimatedGIF');
            
            if (AnimatedGIF) {
                console.log('🎬 @pixi/gif AnimatedGIF使用');
                return AnimatedGIF.fromBuffer(buffer, options);
            }
        }
        
        // フォールバック: 基本スプライト
        console.log('🆘 基本スプライト作成（GIFフォールバック）');
        return new PIXI.Sprite(PIXI.Texture.EMPTY);
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
     * 互換性チェック（🔧 修繕版）
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
            issues.push('@pixi/ui が利用できません - ポップアップ機能が制限されます');
            recommendations.push('@pixi/ui の導入を推奨 - UI機能が向上します');
        }
        
        // 🔧 修繕後の推奨事項更新
        if (!this.hasFeature('layers')) {
            recommendations.push('@pixi/layers の導入を推奨 - レイヤー機能が利用可能になります');
        } else {
            recommendations.push('レイヤー機能が利用可能です - 高度な描画機能を活用できます');
        }
        
        if (!this.hasFeature('gif')) {
            recommendations.push('@pixi/gif の導入を推奨 - GIF機能が利用可能になります');
        } else {
            recommendations.push('GIF機能が利用可能です - アニメーション描画が可能です');
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
console.log('📦 PixiJS拡張機能グローバル登録 Phase1版エラー修繕...');

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
                    
                    // 機能チェックテスト（🔧 修繕版）
                    const features = ['ui', 'layers', 'gif', 'gsap', 'lodash', 'hammer', 'tweedle'];
                    features.forEach(feature => {
                        const available = window.PixiExtensions.hasFeature(feature);
                        console.log(`${available ? '✅' : '❌'} ${feature}機能: ${available ? '利用可能' : '無効'}`);
                    });
                    
                    // 互換性チェックテスト
                    const compatibility = window.PixiExtensions.checkCompatibility();
                    console.log('🔍 互換性チェック:', compatibility);
                    
                    console.log('🎉 PixiJS拡張機能テスト完了 エラー修繕版');
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
console.log('🎉 Phase1: PixiJS拡張統合基盤構築完了（エラー修繕版）');
console.log('🔧 修繕内容: @pixi/layers, @pixi/gif 検出パターン改善');
console.log('🏗️ Phase2: UI統合・描画機能強化準備完了');
console.log('📋 次のステップ: main.js・app-core.js の作成');
console.log('💡 使用方法例（修繕版）:');
console.log('  await window.PixiExtensions.initialize();');
console.log('  const button = window.PixiExtensions.createAdvancedButton({text: "テスト"});');
console.log('  const layer = window.PixiExtensions.createAdvancedLayer({zIndex: 1});');
console.log('  const gif = window.PixiExtensions.createAnimatedGIF(buffer, options);');
console.log('  const stats = window.PixiExtensions.getStats();');