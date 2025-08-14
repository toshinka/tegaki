/**
 * 🎯 AI_WORK_SCOPE: アプリケーション初期化エントリーポイント
 * 🎯 DEPENDENCIES: index.html, CDNライブラリ群
 * 🎯 CDN_USAGE: PIXI, PIXI_UI, Viewport, gsap, lodash, Hammer
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能
 * 🎯 SPLIT_THRESHOLD: 100行以下維持
 * 
 * 📋 PHASE_TARGET: Phase1
 * 📋 V8_MIGRATION: V8Compatibility経由での初期化準備
 * 📋 PERFORMANCE_TARGET: 高速初期化・CDN検証
 */

class AppInitializer {
    constructor() {
        this.isInitialized = false;
        this.coreModules = new Map();
        this.startTime = performance.now();
    }

    async init() {
        try {
            console.log('🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0 初期化開始');
            
            // Step1: CDNライブラリ検証
            await this.validateCDNLibraries();
            
            // Step2: コアモジュール読み込み
            await this.loadCoreModules();
            
            // Step3: アプリケーション初期化
            await this.initializeApplication();
            
            // Step4: 初期化完了
            this.completeInitialization();
            
        } catch (error) {
            console.error('❌ 初期化エラー:', error);
            this.handleInitializationError(error);
        }
    }

    async validateCDNLibraries() {
        console.log('🔧 CDNライブラリ検証中...');
        
        const requiredLibraries = [
            { name: 'PIXI', global: 'PIXI', required: true },
            { name: 'PIXI_UI', global: 'PIXI_UI', required: false },
            { name: 'Viewport', global: 'Viewport', required: false },
            { name: 'PIXI.filters', global: 'PIXI', check: 'filters', required: false },
            { name: 'gsap', global: 'gsap', required: false },
            { name: 'lodash', global: '_', required: false },
            { name: 'Hammer', global: 'Hammer', required: false }
        ];
        
        for (const lib of requiredLibraries) {
            const available = lib.check ? 
                (!!window[lib.global] && !!window[lib.global][lib.check]) :
                !!window[lib.global];
                
            if (lib.required && !available) {
                throw new Error(`必須ライブラリ ${lib.name} が読み込まれていません`);
            }
            
            console.log(`${available ? '✅' : '⚠️'} ${lib.name}: ${available ? '利用可能' : '未対応'}`);
        }
    }

    async loadCoreModules() {
        console.log('📦 コアモジュール読み込み中...');
        
        // 基盤モジュール読み込み
        const { AppCore } = await import('./app-core.js');
        this.coreModules.set('AppCore', AppCore);
        
        // 管理モジュール読み込み
        const { LibraryManager } = await import('./managers/library-manager.js');
        this.coreModules.set('LibraryManager', LibraryManager);
        
        console.log('✅ コアモジュール読み込み完了');
    }

    async initializeApplication() {
        console.log('🚀 アプリケーション初期化中...');
        
        // LibraryManager初期化
        const LibraryManager = this.coreModules.get('LibraryManager');
        await LibraryManager.init();
        
        // AppCore初期化
        const AppCore = this.coreModules.get('AppCore');
        this.appCore = new AppCore();
        await this.appCore.init();
        
        // アプリケーション インスタンス グローバル登録
        window.futabaDrawingTool = this.appCore;
        
        console.log('✅ アプリケーション初期化完了');
    }

    completeInitialization() {
        const initTime = performance.now() - this.startTime;
        this.isInitialized = true;
        
        console.log(`🎉 初期化完了 - 所要時間: ${initTime.toFixed(2)}ms`);
        console.log('🎯 Phase1完了 - HTML→Fetch API分割移行成功');
        console.log('📋 利用可能機能:');
        console.log('  ✅ ベクター描画エンジン（PixiJS v7）');
        console.log('  ✅ ペンツール・消しゴムツール');
        console.log('  ✅ 非破壊変形システム');
        console.log('  ✅ CDN統合ライブラリ');
        console.log('  ⏳ Phase2予定: レイヤーシステム・高度描画ツール');
        console.log('  ⏳ Phase3予定: GIFアニメーション・エクスポート機能');
        console.log('  ⏳ Phase4予定: PixiJS v8移行・120FPS・WebGPU対応');
        
        // 初期化完了イベント発火
        document.dispatchEvent(new CustomEvent('tegaki:initialized', {
            detail: { initTime, appCore: this.appCore }
        }));
    }

    handleInitializationError(error) {
        console.error('💥 致命的エラー - アプリケーション初期化失敗');
        console.error('🔍 エラー詳細:', error);
        
        // エラー表示UI
        const errorElement = document.createElement('div');
        errorElement.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #800000;
            color: white;
            padding: 20px;
            border-radius: 8px;
            font-family: monospace;
            z-index: 9999;
        `;
        errorElement.innerHTML = `
            <h3>🚨 初期化エラー</h3>
            <p>アプリケーションの初期化に失敗しました</p>
            <p>エラー: ${error.message}</p>
            <button onclick="location.reload()">再読み込み</button>
        `;
        document.body.appendChild(errorElement);
    }
}

// DOMContentLoaded後に初期化開始
document.addEventListener('DOMContentLoaded', async () => {
    const initializer = new AppInitializer();
    await initializer.init();
});

// Hot Reload対応（開発用）
if (module && module.hot) {
    module.hot.accept(() => {
        console.log('🔥 Hot Reload検出 - アプリケーション再初期化');
        location.reload();
    });
}