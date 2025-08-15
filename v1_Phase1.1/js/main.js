/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: アプリケーション初期化・拡張ライブラリ検証・動的読み込み制御
 * 🎯 DEPENDENCIES: libs/pixi-extensions.js, js/app-core.js
 * 🎯 NODE_MODULES: pixi.js@^7.4.3, @pixi/*
 * 🎯 PIXI_EXTENSIONS: 全機能統合
 * 🎯 ISOLATION_TEST: 可能（PixiExtensions依存）
 * 🎯 SPLIT_THRESHOLD: 100行（エントリーポイント・分割不要）
 * 📋 PHASE_TARGET: Phase1
 * 📋 V8_MIGRATION: Application.init()対応予定
 */

console.log('🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0 起動開始...');

/**
 * アプリケーション初期化管理
 * Phase1: HTML分割→node_modules統合→AI分業開発実現
 */
class AppInitializer {
    constructor() {
        this.initialized = false;
        this.loadedModules = new Set();
        this.errors = [];
        
        console.log('🚀 AppInitializer 構築開始...');
    }
    
    /**
     * アプリケーション初期化実行
     */
    async init() {
        console.group('🎨 アプリケーション初期化 Phase1版');
        
        try {
            console.log('📋 Phase1目標: HTML分割→PixiJS拡張統合→描画機能基盤');
            
            // Step1: 拡張ライブラリ初期化（必須）
            await this.initializeExtensions();
            
            // Step2: コア初期化
            await this.initializeAppCore();
            
            // Step3: 動的読み込み開始
            await this.startDynamicLoading();
            
            this.initialized = true;
            console.log('✅ アプリケーション初期化完了 Phase1版');
            
        } catch (error) {
            console.error('❌ アプリケーション初期化エラー:', error);
            this.errors.push(error.message);
            throw error;
        } finally {
            console.groupEnd();
        }
    }
    
    /**
     * PixiJS拡張ライブラリ初期化
     */
    async initializeExtensions() {
        console.log('🔧 PixiJS拡張ライブラリ初期化中...');
        
        // PixiExtensions の存在確認
        if (!window.PixiExtensions) {
            throw new Error('PixiExtensions が読み込まれていません - libs/pixi-extensions.js を確認してください');
        }
        
        // 拡張ライブラリ初期化実行
        await window.PixiExtensions.initialize();
        
        // 初期化結果確認
        const stats = window.PixiExtensions.getStats();
        console.log(`📊 拡張ライブラリ統合結果: ${stats.coverage} (${stats.loaded}/${stats.total})`);
        
        // 互換性チェック
        const compatibility = window.PixiExtensions.checkCompatibility();
        if (!compatibility.compatible) {
            console.warn('⚠️ 互換性の問題:', compatibility.issues);
        }
        
        if (compatibility.recommendations.length > 0) {
            console.log('💡 推奨事項:', compatibility.recommendations);
        }
        
        this.loadedModules.add('pixi-extensions');
        console.log('✅ PixiJS拡張ライブラリ初期化完了');
    }
    
    /**
     * アプリケーションコア初期化
     */
    async initializeAppCore() {
        console.log('🎯 アプリケーションコア初期化中...');
        
        // AppCore の存在確認・動的読み込み
        if (typeof AppCore === 'undefined') {
            await this.loadScript('js/app-core.js');
        }
        
        // AppCore インスタンス作成・初期化
        if (typeof AppCore !== 'undefined') {
            window.futabaDrawingTool = new AppCore();
            await window.futabaDrawingTool.init();
            
            this.loadedModules.add('app-core');
            console.log('✅ アプリケーションコア初期化完了');
        } else {
            throw new Error('AppCore の読み込みに失敗しました');
        }
    }
    
    /**
     * 動的読み込み開始
     */
    async startDynamicLoading() {
        console.log('📦 動的機能読み込み開始...');
        
        // Phase1: 基本機能のみ読み込み
        const basicFeatures = [
            'js/utils/coordinates.js',
            'js/utils/performance.js'
        ];
        
        // 条件付き読み込み
        for (const feature of basicFeatures) {
            try {
                if (this.shouldLoadFeature(feature)) {
                    await this.loadScript(feature);
                    console.log(`✅ 動的読み込み完了: ${feature}`);
                }
            } catch (error) {
                console.warn(`⚠️ 動的読み込み失敗: ${feature}`, error);
            }
        }
        
        console.log('📦 動的機能読み込み完了');
    }
    
    /**
     * 機能読み込み判定
     */
    shouldLoadFeature(featurePath) {
        // Phase1: 基本機能は常に読み込み
        if (featurePath.includes('utils/')) {
            return true;
        }
        
        // Phase2以降で拡張予定
        return false;
    }
    
    /**
     * スクリプト動的読み込み
     */
    loadScript(src) {
        return new Promise((resolve, reject) => {
            // 既に読み込み済みかチェック
            if (this.loadedModules.has(src)) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            
            script.onload = () => {
                this.loadedModules.add(src);
                resolve();
            };
            
            script.onerror = (error) => {
                console.error(`❌ スクリプト読み込みエラー: ${src}`, error);
                reject(new Error(`Failed to load script: ${src}`));
            };
            
            document.head.appendChild(script);
        });
    }
    
    /**
     * 初期化状態取得
     */
    getStatus() {
        return {
            initialized: this.initialized,
            loadedModules: Array.from(this.loadedModules),
            errors: this.errors,
            pixiExtensions: window.PixiExtensions ? window.PixiExtensions.getStats() : null
        };
    }
}

/**
 * アプリケーション起動処理
 */
async function startApplication() {
    try {
        const initializer = new AppInitializer();
        await initializer.init();
        
        // グローバル公開
        window.AppInitializer = initializer;
        
        console.log('🎉 アプリケーション起動完了 Phase1版');
        console.log('📊 ステータス:', initializer.getStatus());
        
        // Phase1 完了ログ
        console.group('✅ Phase1 完了レポート');
        console.log('🎯 HTML分割: 完了 - CSS・JS分離実現');
        console.log('🔧 node_modules統合: 完了 - ローカル依存実現');
        console.log('📦 拡張ライブラリ: 完了 - @pixi/* 統合実現');
        console.log('🚀 AI分業準備: 完了 - 必要ファイル特定可能');
        console.log('🏗️ Phase2準備: 完了 - 描画機能実装準備完了');
        console.groupEnd();
        
    } catch (error) {
        console.error('❌ アプリケーション起動エラー:', error);
        
        // エラー時のフォールバック
        console.log('🆘 フォールバックモード起動中...');
        document.body.innerHTML += `
            <div style="position: fixed; top: 20px; left: 20px; background: #ffebee; 
                        border: 2px solid #f44336; padding: 16px; border-radius: 8px; 
                        font-family: monospace; z-index: 9999;">
                ❌ 起動エラー: ${error.message}<br>
                🔧 libs/pixi-extensions.js と node_modules を確認してください
            </div>
        `;
    }
}

// ==== 自動起動 ====
if (typeof window !== 'undefined') {
    // DOM読み込み完了時に自動起動
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startApplication);
    } else {
        // 既に読み込み済みの場合は即座に起動
        startApplication();
    }
} else {
    console.warn('⚠️ ブラウザ環境ではありません - Node.js環境では動作しません');
}

// ==== Phase1 情報出力 ====
console.log('📋 Phase1 実装完了項目:');
console.log('  ✅ HTML→CSS分離 (styles.css)');
console.log('  ✅ PixiJS拡張統合 (pixi-extensions.js)');
console.log('  ✅ アイコン管理 (icon-manager.js)');
console.log('  ✅ エントリーポイント (main.js)');
console.log('📋 Phase1 次回実装予定:');
console.log('  🏗️ app-core.js - PixiJS基盤システム');
console.log('  🏗️ ui-manager.js - UI統合システム');
console.log('  🏗️ tool-manager.js - ツール統合システム');

// 📋 V8_MIGRATION: 移行時変更予定箇所
// console.log('📋 V8_MIGRATION: PIXI.Application → await PIXI.Application.init() 対応予定');