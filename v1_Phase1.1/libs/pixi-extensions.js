/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: PixiJS拡張ライブラリ統合・互換性レイヤー・フォールバック機能
 * 🎯 DEPENDENCIES: なし（node_modules読み込み後の後処理）
 * 🎯 NODE_MODULES: pixi.js, @pixi/ui, @pixi/layers, @pixi/gif, gsap, lodash, hammerjs
 * 🎯 PIXI_EXTENSIONS: 全拡張ライブラリ統合管理
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能
 * 🎯 SPLIT_THRESHOLD: 300行以下維持（統合基盤のため分割不可）
 * 📋 PHASE_TARGET: Phase1.1
 * 📋 V8_MIGRATION: v8 API変更対応・互換性レイヤー提供予定
 */

console.log('🔧 PixiJS拡張ライブラリ統合システム Phase1.1版 読み込み開始...');

// ==== PixiJS拡張統合管理システム ====
class PixiExtensionsManager {
    constructor() {
        this.extensions = new Map();
        this.initialized = false;
        this.version = '1.0.0-phase1.1';
        this.buildDate = new Date().toISOString();
    }
    
    /**
     * 拡張ライブラリ初期化・統合処理
     * node_modules読み込み確認→拡張統合→フォールバック設定
     */
    async initialize() {
        console.group('🎨 PixiJS拡張ライブラリ統合（Phase1.1版）');
        
        try {
            // Step1: PixiJS本体確認
            this.validateCoreLibraries();
            
            // Step2: 拡張ライブラリ統合
            this.integrateExtensions();
            
            // Step3: ユーティリティライブラリ統合
            this.integrateUtilityLibraries();
            
            // Step4: 統計・品質確認
            this.generateStats();
            
            this.initialized = true;
            console.log('✅ PixiJS拡張ライブラリ統合完了');
            
        } catch (error) {
            console.error('❌ PixiJS拡張ライブラリ統合エラー:', error);
            this.initializeFallbackMode();
        }
        
        console.groupEnd();
    }
    
    /**
     * PixiJS本体ライブラリ検証
     * v7バージョン確認・必須機能確認
     */
    validateCoreLibraries() {
        if (!window.PIXI) {
            throw new Error('PixiJS本体が読み込まれていません - node_modules/pixi.js/ を確認してください');
        }
        
        console.log(`✅ PixiJS v${PIXI.VERSION} 検出（node_modules統合）`);
        
        // v7必須機能確認
        const requiredFeatures = ['Application', 'Graphics', 'Container', 'Texture'];
        for (const feature of requiredFeatures) {
            if (!PIXI[feature]) {
                throw new Error(`PixiJS必須機能 ${feature} が利用できません`);
            }
        }
        
        // 📋 V8_MIGRATION: v8移行時の互換性チェック追加予定
        if (PIXI.VERSION.startsWith('8')) {
            console.log('🔄 PixiJS v8検出 - 互換性モード準備中...');
            this.prepareV8Compatibility();
        }
    }
    
    /**
     * @pixi/* 拡張ライブラリ統合処理
     * UI, Layers, GIF機能の検出・統合・フォールバック設定
     */
    integrateExtensions() {
        let loadedExtensions = 0;
        
        // @pixi/ui統合
        if (window.PIXI && window.PIXI.UI) {
            this.extensions.set('ui', {
                available: true,
                components: window.PIXI.UI,
                version: window.PIXI.UI.VERSION || 'unknown',
                source: 'node_modules'
            });
            console.log('✅ @pixi/ui 統合完了 - UIコンポーネント利用可能');
            loadedExtensions++;
        } else {
            this.extensions.set('ui', {
                available: false,
                reason: '@pixi/ui が読み込まれていません',
                fallback: 'basic-ui'
            });
            console.warn('⚠️ @pixi/ui 未検出 - 基本UI実装使用');
        }
        
        // @pixi/layers統合
        if (window.PIXI && window.PIXI.display) {
            this.extensions.set('layers', {
                available: true,
                Layer: window.PIXI.display.Layer,
                Group: window.PIXI.display.Group,
                Stage: window.PIXI.display.Stage,
                version: window.PIXI.display.VERSION || 'unknown',
                source: 'node_modules'
            });
            console.log('✅ @pixi/layers 統合完了 - レイヤー機能利用可能');
            loadedExtensions++;
        } else {
            this.extensions.set('layers', {
                available: false,
                reason: '@pixi/layers が読み込まれていません',
                fallback: 'basic-container'
            });
            console.warn('⚠️ @pixi/layers 未検出 - 基本Container使用');
        }
        
        // @pixi/gif統合
        if (window.PIXI && window.PIXI.AnimatedGIF) {
            this.extensions.set('gif', {
                available: true,
                AnimatedGIF: window.PIXI.AnimatedGIF,
                version: window.PIXI.AnimatedGIF.VERSION || 'unknown',
                source: 'node_modules'
            });
            console.log('✅ @pixi/gif 統合完了 - GIF機能利用可能');
            loadedExtensions++;
        } else {
            this.extensions.set('gif', {
                available: false,
                reason: '@pixi/gif が読み込まれていません',
                fallback: 'basic-export'
            });
            console.warn('⚠️ @pixi/gif 未検出 - 基本エクスポート機能使用');
        }
        
        console.log(`📊 @pixi拡張ライブラリ統合: ${loadedExtensions}/3 (${Math.round(loadedExtensions/3*100)}%)`);
    }
    
    /**
     * ユーティリティライブラリ統合処理
     * GSAP, Lodash, Hammer.js の検出・統合
     */
    integrateUtilityLibraries() {
        let loadedUtilities = 0;
        
        // GSAP統合
        if (window.gsap) {
            this.extensions.set('gsap', {
                available: true,
                gsap: window.gsap,
                version: window.gsap.version || 'unknown',
                source: 'node_modules'
            });
            console.log('✅ GSAP 統合完了 - 高度アニメーション利用可能');
            loadedUtilities++;
        } else {
            this.extensions.set('gsap', {
                available: false,
                reason: 'GSAP が読み込まれていません',
                fallback: 'pixi-ticker'
            });
            console.warn('⚠️ GSAP 未検出 - PIXI.Tickerアニメーション使用');
        }
        
        // Lodash統合
        if (window._) {
            this.extensions.set('lodash', {
                available: true,
                _: window._,
                version: window._.VERSION || 'unknown',
                source: 'node_modules'
            });
            console.log('✅ Lodash 統合完了 - ユーティリティ関数利用可能');
            loadedUtilities++;
        } else {
            this.extensions.set('lodash', {
                available: false,
                reason: 'Lodash が読み込まれていません',
                fallback: 'native-js'
            });
            console.warn('⚠️ Lodash 未検出 - ネイティブJS実装使用');
        }
        
        // Hammer.js統合
        if (window.Hammer) {
            this.extensions.set('hammer', {
                available: true,
                Hammer: window.Hammer,
                version: window.Hammer.VERSION || 'unknown',
                source: 'node_modules'
            });
            console.log('✅ Hammer.js 統合完了 - タッチジェスチャー利用可能');
            loadedUtilities++;
        } else {
            this.extensions.set('hammer', {
                available: false,
                reason: 'Hammer.js が読み込まれていません',
                fallback: 'basic-touch'
            });
            console.warn('⚠️ Hammer.js 未検出 - 基本タッチ操作使用');
        }
        
        console.log(`📊 ユーティリティライブラリ統合: ${loadedUtilities}/3 (${Math.round(loadedUtilities/3*100)}%)`);
    }
    
    /**
     * 機能チェック（外部API）
     * 指定機能の利用可能性確認
     */
    hasFeature(feature) {
        const extension = this.extensions.get(feature.toLowerCase());
        return extension ? extension.available : false;
    }
    
    /**
     * コンポーネント取得（外部API）
     * 拡張ライブラリのコンポーネント安全取得
     */
    getComponent(library, component) {
        const extension = this.extensions.get(library.toLowerCase());
        if (!extension || !extension.available) {
            console.warn(`⚠️ ${library} ライブラリが利用できません - フォールバック実装を使用してください`);
            return null;
        }
        
        return extension[component] || null;
    }
    
    /**
     * 統計情報生成・表示
     * 読み込み状況・カバレッジ・推奨事項表示
     */
    generateStats() {
        const total = this.extensions.size;
        const available = Array.from(this.extensions.values()).filter(ext => ext.available).length;
        const coverage = Math.round((available / total) * 100);
        
        console.log(`📊 統合統計: ${available}/${total} ライブラリ (カバレッジ: ${coverage}%)`);
        
        // 推奨事項生成
        const recommendations = this.generateRecommendations();
        if (recommendations.length > 0) {
            console.log('💡 推奨事項:', recommendations);
        }
        
        // 詳細統計
        console.log('📦 ライブラリ詳細:');
        this.extensions.forEach((extension, name) => {
            const status = extension.available ? '✅' : '❌';
            const info = extension.available ? 
                `v${extension.version} (${extension.source})` : 
                `${extension.reason} → ${extension.fallback}`;
            console.log(`  ${status} ${name}: ${info}`);
        });
    }
    
    /**
     * 推奨事項生成
     * 未導入ライブラリの推奨・メリット説明
     */
    generateRecommendations() {
        const recommendations = [];
        
        if (!this.hasFeature('ui')) {
            recommendations.push('@pixi/ui導入推奨 - プロ級UIコンポーネント・開発効率向上');
        }
        
        if (!this.hasFeature('layers')) {
            recommendations.push('@pixi/layers導入推奨 - 高度レイヤー機能・非破壊編集対応');
        }
        
        if (!this.hasFeature('gsap')) {
            recommendations.push('GSAP導入推奨 - スムーズアニメーション・トゥイーン機能');
        }
        
        if (!this.hasFeature('hammer')) {
            recommendations.push('Hammer.js導入推奨 - タッチデバイス対応・ジェスチャー操作');
        }
        
        return recommendations;
    }
    
    /**
     * 統計情報取得（外部API）
     * システム全体の統計情報を外部から取得
     */
    getStats() {
        const total = this.extensions.size;
        const available = Array.from(this.extensions.values()).filter(ext => ext.available).length;
        
        return {
            total: total,
            available: available,
            coverage: Math.round((available / total) * 100) + '%',
            libraries: Array.from(this.extensions.keys()),
            version: this.version,
            buildDate: this.buildDate,
            initialized: this.initialized
        };
    }
    
    /**
     * 全ライブラリ詳細取得（外部API）
     * 各ライブラリの詳細状態を外部から取得
     */
    getAllLibraryDetails() {
        const details = {};
        
        this.extensions.forEach((extension, name) => {
            details[name] = {
                available: extension.available,
                version: extension.version || 'unknown',
                source: extension.source || 'unknown',
                reason: extension.reason || null,
                fallback: extension.fallback || null
            };
        });
        
        return details;
    }
    
    /**
     * フォールバックモード初期化
     * 拡張ライブラリなしでの最小限動作保証
     */
    initializeFallbackMode() {
        console.warn('🆘 フォールバックモード初期化中...');
        
        this.extensions.clear();
        this.extensions.set('fallback', {
            available: true,
            mode: 'minimal',
            features: ['basic-drawing', 'basic-ui']
        });
        
        this.initialized = true;
        console.log('✅ フォールバックモード初期化完了 - 基本機能のみ利用可能');
    }
    
    /**
     * v8移行互換性準備（Phase4予告）
     * 📋 V8_MIGRATION: v8 API変更対応準備
     */
    prepareV8Compatibility() {
        // Phase4実装予定
        console.log('🔄 PixiJS v8互換性レイヤー準備中... (Phase4実装予定)');
        
        // v8 API変更対応準備
        this.v8Compatibility = {
            applicationInit: true,  // new PIXI.Application() → await PIXI.Application.init()
            backgroundChange: true, // backgroundColor → background
            rendererAPI: true       // WebGPU Renderer対応
        };
    }
    
    /**
     * デバッグ・テスト支援メソッド
     * 開発・AI分業時のデバッグ支援
     */
    runDiagnostics() {
        console.group('🔍 PixiJS拡張システム診断');
        
        // 基本診断
        console.log('基本システム:', {
            initialized: this.initialized,
            version: this.version,
            pixiVersion: window.PIXI?.VERSION || 'unknown'
        });
        
        // 拡張診断
        console.log('拡張ライブラリ診断:', this.getAllLibraryDetails());
        
        // 推奨事項
        const recommendations = this.generateRecommendations();
        if (recommendations.length > 0) {
            console.log('推奨事項:', recommendations);
        } else {
            console.log('✅ 最適な構成です');
        }
        
        console.groupEnd();
    }
}

// ==== グローバル公開・初期化 ====
// Pure JavaScript形式でグローバル公開（ESM禁止準拠）
window.PixiExtensions = new PixiExtensionsManager();

// 初期化完了ログ・診断実行
console.log('✅ PixiExtensions統合システム準備完了');
console.log('💡 使用方法:');
console.log('  await window.PixiExtensions.initialize(); // 初期化');
console.log('  window.PixiExtensions.hasFeature("ui");   // 機能確認');
console.log('  window.PixiExtensions.getStats();         // 統計取得');
console.log('  window.PixiExtensions.runDiagnostics();   // 診断実行');

// Phase1.1完了マーカー
console.log('🎉 Phase1.1: PixiJS拡張統合基盤実装完了');
console.log('📋 次のステップ: js/main.js 初期化エントリーポイント実装');