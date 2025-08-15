/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: アプリケーション初期化・拡張ライブラリ統合・動的読み込み制御
 * 🎯 DEPENDENCIES: libs/pixi-extensions.js（必須）
 * 🎯 NODE_MODULES: pixi.js（Application使用）
 * 🎯 PIXI_EXTENSIONS: 全拡張ライブラリ（統合管理）
 * 🎯 ISOLATION_TEST: ❌ 全システム統合が必要
 * 🎯 SPLIT_THRESHOLD: 100行以下維持（エントリーポイントのため簡潔性重視）
 * 📋 PHASE_TARGET: Phase1.1
 * 📋 V8_MIGRATION: Application.init() API対応予定
 */

console.log('🚀 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0 起動開始...');

// ==== アプリケーション初期化管理 ====
class AppInitializer {
    constructor() {
        this.initialized = false;
        this.startTime = performance.now();
        this.components = new Map();
    }
    
    /**
     * アプリケーション全体初期化
     * Phase1.1: 拡張統合→基盤初期化→動的読み込み開始
     */
    async initialize() {
        try {
            console.group('🎨 アプリケーション初期化 Phase1.1');
            
            // Step1: PixiJS拡張ライブラリ統合
            await this.initializeExtensions();
            
            // Step2: アプリケーション基盤初期化
            await this.initializeCore();
            
            // Step3: 動的コンポーネント読み込み開始
            this.startDynamicLoading();
            
            // Step4: 初期化完了・診断実行
            this.completeInitialization();
            
            console.groupEnd();
            
        } catch (error) {
            console.error('❌ アプリケーション初期化エラー:', error);
            this.handleInitializationError(error);
        }
    }
    
    /**
     * PixiJS拡張ライブラリ統合初期化
     * libs/pixi-extensions.js の初期化・診断実行
     */
    async initializeExtensions() {
        console.log('🔧 PixiJS拡張ライブラリ統合開始...');
        
        if (!window.PixiExtensions) {
            throw new Error('libs/pixi-extensions.js が読み込まれていません');
        }
        
        // 拡張ライブラリ統合実行
        await window.PixiExtensions.initialize();
        
        // 統計確認・診断
        const stats = window.PixiExtensions.getStats();
        console.log('📊 拡張統合完了:', stats);
        
        // 必要に応じて診断実行
        if (this.shouldRunDiagnostics()) {
            window.PixiExtensions.runDiagnostics();
        }
        
        this.components.set('extensions', window.PixiExtensions);
    }
    
    /**
     * アプリケーション基盤初期化
     * PixiJS Application作成・基盤システム準備
     */
    async initializeCore() {
        console.log('🏗️ アプリケーション基盤初期化開始...');
        
        // AppCore動的読み込み・初期化
        await this.loadComponent('js/app-core.js', 'AppCore');
        
        if (window.AppCore) {
            const appCore = new window.AppCore();
            await appCore.initialize();
            this.components.set('core', appCore);
            console.log('✅ アプリケーション基盤初期化完了');
        } else {
            throw new Error('js/app-core.js の読み込みに失敗しました');
        }
    }
    
    /**
     * 動的コンポーネント読み込み開始
     * 必要機能の条件付き読み込み・AI分業対応
     */
    startDynamicLoading() {
        console.log('📦 動的コンポーネント読み込み開始...');
        
        // 並行読み込みで効率化
        const loadPromises = [];
        
        // UI Manager（必須）
        if (this.needsUIManager()) {
            loadPromises.push(
                this.loadComponent('js/managers/ui-manager.js', 'UIManager')
            );
        }
        
        // Tool Manager（必須）
        if (this.needsToolManager()) {
            loadPromises.push(
                this.loadComponent('js/managers/tool-manager.js', 'ToolManager')
            );
        }
        
        // Canvas Manager（必須）
        if (this.needsCanvasManager()) {
            loadPromises.push(
                this.loadComponent('js/managers/canvas-manager.js', 'CanvasManager')
            );
        }
        
        // 基本ツール読み込み
        if (this.needsPenTool()) {
            loadPromises.push(
                this.loadComponent('js/tools/pen-tool.js', 'PenTool')
            );
        }
        
        if (this.needsEraserTool()) {
            loadPromises.push(
                this.loadComponent('js/tools/eraser-tool.js', 'EraserTool')
            );
        }
        
        // 読み込み完了監視
        Promise.allSettled(loadPromises).then(results => {
            this.handleDynamicLoadingResults(results);
        });
    }
    
    /**
     * 動的スクリプト読み込み
     * Pure JavaScript対応・エラーハンドリング付き
     */
    async loadComponent(src, componentName) {
        return new Promise((resolve, reject) => {
            console.log(`📥 ${componentName} 読み込み中: ${src}`);
            
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            
            script.onload = () => {
                if (window[componentName]) {
                    console.log(`✅ ${componentName} 読み込み完了`);
                    this.components.set(componentName.toLowerCase(), window[componentName]);
                    resolve(window[componentName]);
                } else {
                    console.warn(`⚠️ ${componentName} が定義されていません`);
                    resolve(null);
                }
            };
            
            script.onerror = (error) => {
                console.error(`❌ ${componentName} 読み込み失敗:`, error);
                reject(new Error(`${componentName} 読み込み失敗: ${src}`));
            };
            
            document.head.appendChild(script);
        });
    }
    
    /**
     * 初期化完了処理
     * 統計表示・パフォーマンス測定・使用準備完了
     */
    completeInitialization() {
        const endTime = performance.now();
        const initTime = Math.round(endTime - this.startTime);
        
        this.initialized = true;
        
        console.log('🎉 アプリケーション初期化完了!');
        console.log(`⏱️ 初期化時間: ${initTime}ms`);
        console.log(`📦 読み込み済みコンポーネント: ${this.components.size}個`);
        console.log('💡 利用可能な機能:');
        
        // 利用可能機能表示
        this.displayAvailableFeatures();
        
        // パフォーマンス監視開始
        this.startPerformanceMonitoring();
        
        // 完了イベント発行
        this.dispatchInitializationComplete();
    }
    
    /**
     * 利用可能機能表示
     * 読み込まれた機能・拡張ライブラリの表示
     */
    displayAvailableFeatures() {
        const extensions = window.PixiExtensions;
        
        console.log(`  🎨 描画機能: ${this.hasComponent('pentool') ? '✅' : '❌'} ペンツール`);
        console.log(`  🧽 編集機能: ${this.hasComponent('erasertool') ? '✅' : '❌'} 消しゴムツール`);
        console.log(`  🎛️ UI機能: ${extensions.hasFeature('ui') ? '✅' : '❌'} @pixi/ui`);
        console.log(`  📚 レイヤー: ${extensions.hasFeature('layers') ? '✅' : '❌'} @pixi/layers`);
        console.log(`  🎬 アニメ: ${extensions.hasFeature('gsap') ? '✅' : '❌'} GSAP`);
        console.log(`  📱 タッチ: ${extensions.hasFeature('hammer') ? '✅' : '❌'} Hammer.js`);
    }
    
    /**
     * パフォーマンス監視開始
     * FPS監視・メモリ使用量監視
     */
    startPerformanceMonitoring() {
        // 基本FPS監視
        let frameCount = 0;
        let lastTime = performance.now();
        
        const updateFPS = () => {
            frameCount++;
            const currentTime = performance.now();
            
            if (currentTime - lastTime >= 1000) {
                const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                
                // ステータス表示更新
                const fpsElement = document.getElementById('fps');
                if (fpsElement) {
                    fpsElement.textContent = fps;
                }
                
                frameCount = 0;
                lastTime = currentTime;
            }
            
            requestAnimationFrame(updateFPS);
        };
        
        requestAnimationFrame(updateFPS);
    }
    
    /**
     * 初期化完了イベント発行
     * カスタムイベントで他システムに通知
     */
    dispatchInitializationComplete() {
        const event = new CustomEvent('appInitialized', {
            detail: {
                components: Array.from(this.components.keys()),
                stats: window.PixiExtensions.getStats(),
                initTime: performance.now() - this.startTime
            }
        });
        
        document.dispatchEvent(event);
    }
    
    // ==== 条件判定メソッド群 ====
    
    shouldRunDiagnostics() {
        // 開発環境や低カバレッジ時に診断実行
        return window.location.hostname === 'localhost' || 
               parseInt(window.PixiExtensions.getStats().coverage) < 80;
    }
    
    needsUIManager() { return true; } // 必須
    needsToolManager() { return true; } // 必須
    needsCanvasManager() { return true; } // 必須
    needsPenTool() { return true; } // 基本機能
    needsEraserTool() { return true; } // 基本機能
    
    hasComponent(name) {
        return this.components.has(name.toLowerCase());
    }
    
    /**
     * 動的読み込み結果処理
     * 成功・失敗の統計・フォールバック処理
     */
    handleDynamicLoadingResults(results) {
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        
        console.log(`📊 動的読み込み結果: 成功 ${successful}件, 失敗 ${failed}件`);
        
        if (failed > 0) {
            console.warn('⚠️ 一部コンポーネントの読み込みに失敗しました');
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    console.error(`❌ 読み込み失敗 ${index}:`, result.reason);
                }
            });
        }
    }
    
    /**
     * 初期化エラーハンドリング
     * フォールバックモード・最小限機能での継続
     */
    handleInitializationError(error) {
        console.error('🆘 初期化失敗 - フォールバックモード開始');
        console.error('エラー詳細:', error);
        
        // 最小限のフォールバック初期化
        this.initializeFallbackMode();
    }
    
    /**
     * フォールバックモード初期化
     * 拡張機能なしでの最小限動作保証
     */
    initializeFallbackMode() {
        console.warn('🔧 フォールバックモード初期化中...');
        
        // 基本PIXI機能のみで動作
        if (window.PIXI) {
            // 最小限のアプリケーション作成
            const app = new PIXI.Application({
                width: 400,
                height: 400,
                backgroundColor: 0xf0e0d6
            });
            
            const canvas = document.getElementById('drawing-canvas');
            if (canvas) {
                canvas.appendChild(app.view);
            }
            
            console.log('✅ フォールバックモード初期化完了 - 基本機能のみ利用可能');
        }
    }
}

// ==== アプリケーション起動 ====
// DOM読み込み完了後に初期化開始
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📄 DOM読み込み完了 - アプリケーション初期化開始');
    
    try {
        const initializer = new AppInitializer();
        await initializer.initialize();
        
        // グローバル参照保存（デバッグ用）
        window.app = initializer;
        
        console.log('🎊 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0 起動完了!');
        
    } catch (error) {
        console.error('💥 アプリケーション起動に失敗しました:', error);
    }
});

// ==== Phase1.1完了マーカー ====
console.log('✅ Phase1.1 STEP4: メインエントリーポイント実装完了');
console.log('📋 次のステップ: js/app-core.js PixiJS基盤実装');