/**
 * Bootstrap PixiJS v8対応版・二重初期化防止版
 * ChangeLog: 2025-09-01 二重初期化完全防止・シングルトン実装
 * 
 * @provides
 *   ・PixiJS v8利用可能性確認（checkPixiJSAvailability）
 *   ・Canvas Container準備（setupCanvasContainer）
 *   ・TegakiApplication単一初期化（initializeTegakiApplication）
 *   ・Bootstrap実行制御（start）
 * 
 * @uses
 *   ・PIXI グローバル - バージョン確認・WebGPU対応確認
 *   ・TegakiApplication.getInstance() - シングルトン取得
 *   ・Phase1.5統合テスト実行
 * 
 * @initflow
 *   1. Bootstrap.start() - 実行フラグ確認
 *   2. PixiJS v8利用可能性確認
 *   3. Canvas Container準備
 *   4. Phase1.5依存関係確認
 *   5. TegakiApplication単一インスタンス初期化
 *   6. 統合テスト自動実行
 * 
 * @forbids
 *   ・💀 二重初期化禁止（実行フラグで制御）
 *   ・🚫 TegakiApplication複数インスタンス作成禁止
 *   ・🚫 DOM準備前の実行禁止
 * 
 * @integration-flow
 *   ・DOMContentLoaded後にstart()実行
 *   ・全体初期化の起点
 */

class Bootstrap {
    constructor() {
        this.version = 'v8-singletone-fix';
        this.className = 'Bootstrap';
        this.startTime = Date.now();
        
        // 実行状態管理
        this.dependencies = {
            pixi: false,
            dom: false,
            phase15: false
        };
        
        this.domStatus = {
            canvasContainer: false,
            documentReady: false
        };
        
        this.timing = {
            start: null,
            pixiCheck: null,
            domSetup: null,
            appInit: null,
            complete: null
        };
    }
    
    // ===========================================
    // 二重実行防止（シングルトン制御）
    // ===========================================
    
    /**
     * Bootstrap開始（二重実行防止版）
     */
    async start() {
        // 二重実行防止チェック
        if (window.Tegaki && window.Tegaki.isBootstrapped) {
            console.warn('⚠️ Bootstrap: 既に実行済み - 重複実行をスキップ');
            return;
        }
        
        try {
            console.log('🚀 Bootstrap PixiJS v8対応版・二重初期化防止版 実行開始...');
            this.timing.start = Date.now();
            
            // 実行フラグ設定（他の初期化をブロック）
            window.Tegaki = window.Tegaki || {};
            window.Tegaki.isBootstrapped = true;
            window.Tegaki.bootstrapInstance = this;
            
            // ステップ1: PixiJS v8利用可能性確認
            await this.checkPixiJSAvailability();
            
            // ステップ2: Canvas Container準備
            await this.setupCanvasContainer();
            
            // ステップ3: Phase1.5依存関係確認
            await this.checkPhase15Dependencies();
            
            // ステップ4: TegakiApplication初期化（シングルトン）
            await this.initializeTegakiApplication();
            
            // ステップ5: 統合テスト自動実行
            await this.runIntegrationTest();
            
            this.timing.complete = Date.now();
            console.log('🎉 Bootstrap 完全初期化成功');
            console.log('⏱️ 初期化時間:', this.timing.complete - this.timing.start, 'ms');
            
        } catch (error) {
            console.error('💥 Bootstrap初期化失敗:', error);
            console.error('🔍 デバッグ情報:', this.getDebugInfo());
            
            // 失敗時は実行フラグをクリア（再試行可能にする）
            if (window.Tegaki) {
                window.Tegaki.isBootstrapped = false;
            }
            
            throw error;
        }
    }
    
    // ===========================================
    // 初期化ステップ
    // ===========================================
    
    /**
     * PixiJS v8利用可能性確認
     */
    async checkPixiJSAvailability() {
        console.log('🔍 PixiJS v8利用可能性確認開始');
        this.timing.pixiCheck = Date.now();
        
        try {
            // PixiJSグローバル確認
            if (!window.PIXI) {
                throw new Error('PixiJS not loaded - check script tags');
            }
            
            console.log('🎯 PixiJS バージョン:', window.PIXI.VERSION);
            
            // WebGPU対応確認
            const webGPUSupport = !!(navigator.gpu);
            console.log('🎮 WebGPU対応:', webGPUSupport ? '✅' : '❌ (WebGL2フォールバック)');
            
            this.dependencies.pixi = true;
            console.log('✅ PixiJS v8利用可能性確認完了');
            
        } catch (error) {
            console.error('💀 PixiJS確認失敗:', error);
            throw error;
        }
    }
    
    /**
     * Canvas Container準備
     */
    async setupCanvasContainer() {
        console.log('🏗️ Canvas Container存在確認・作成開始');
        this.timing.domSetup = Date.now();
        
        try {
            // DOM準備確認
            if (document.readyState === 'loading') {
                console.log('⏳ DOM読み込み待機...');
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }
            
            this.domStatus.documentReady = true;
            
            // canvas-container確認・作成
            let canvasContainer = document.getElementById('canvas-container');
            if (!canvasContainer) {
                console.log('🏗️ canvas-container作成');
                canvasContainer = document.createElement('div');
                canvasContainer.id = 'canvas-container';
                canvasContainer.style.cssText = 'position: relative; width: 100%; height: 100%; overflow: hidden;';
                document.body.appendChild(canvasContainer);
            } else {
                console.log('🏗️ canvas-container既存確認');
            }
            
            // Sidebar container確認・作成
            let sidebarContainer = document.getElementById('sidebar-container');
            if (!sidebarContainer) {
                console.log('🏗️ sidebar-container作成');
                sidebarContainer = document.createElement('div');
                sidebarContainer.id = 'sidebar-container';
                sidebarContainer.style.cssText = 'position: fixed; top: 10px; left: 10px; z-index: 1000;';
                document.body.appendChild(sidebarContainer);
            }
            
            this.domStatus.canvasContainer = true;
            console.log('✅ Canvas Container準備完了');
            
        } catch (error) {
            console.error('💀 Canvas Container準備失敗:', error);
            throw error;
        }
    }
    
    /**
     * Phase1.5依存関係確認
     */
    async checkPhase15Dependencies() {
        console.log('🔍 Phase1.5依存関係確認開始');
        
        try {
            // 必須クラス確認
            const requiredClasses = [
                'TegakiApplication', 'AppCore', 'CanvasManager', 
                'CoordinateManager', 'ToolManager', 'PenTool', 'EraserTool'
            ];
            
            const missing = [];
            for (const className of requiredClasses) {
                if (!window.Tegaki || !window.Tegaki[className]) {
                    missing.push(className);
                }
            }
            
            if (missing.length > 0) {
                throw new Error(`Required classes not loaded: ${missing.join(', ')}`);
            }
            
            // Phase1.5統合テスト存在確認
            if (!window.Tegaki.runPhase15Test) {
                console.warn('⚠️ Phase1.5統合テスト未利用可能 - 機能テスト制限');
            } else {
                this.dependencies.phase15 = true;
            }
            
            console.log('✅ Phase1.5依存関係確認完了');
            
        } catch (error) {
            console.error('💀 Phase1.5依存関係確認失敗:', error);
            throw error;
        }
    }
    
    /**
     * TegakiApplication初期化（シングルトン版）
     */
    async initializeTegakiApplication() {
        console.log('🚀 TegakiApplication v8対応版 初期化開始');
        this.timing.appInit = Date.now();
        
        try {
            // シングルトンインスタンス取得
            if (!window.Tegaki.TegakiApplication.getInstance) {
                throw new Error('TegakiApplication.getInstance() not available - singleton not implemented');
            }
            
            const app = window.Tegaki.TegakiApplication.getInstance();
            
            if (!app) {
                throw new Error('TegakiApplication singleton instance creation failed');
            }
            
            // 既に初期化済み確認
            if (app.isInitialized && app.isInitialized()) {
                console.log('✅ TegakiApplication 既に初期化済み');
                return;
            }
            
            // 初期化実行
            await app.initialize();
            
            // グローバル参照設定
            window.Tegaki.app = app;
            
            console.log('✅ TegakiApplication初期化完了');
            
        } catch (error) {
            console.error('❌ TegakiApplication初期化失敗:', error);
            throw error;
        }
    }
    
    /**
     * 統合テスト自動実行
     */
    async runIntegrationTest() {
        if (!this.dependencies.phase15) {
            console.log('⚠️ Phase1.5統合テスト未利用可能 - スキップ');
            return;
        }
        
        try {
            console.log('🧪 Phase1.5統合テスト実行開始');
            
            // テスト実行（非同期）
            if (window.Tegaki.runPhase15Test) {
                setTimeout(() => {
                    try {
                        window.Tegaki.runPhase15Test();
                    } catch (testError) {
                        console.error('🧪 統合テスト実行エラー:', testError);
                    }
                }, 1000); // 1秒後に実行（初期化完了待ち）
            }
            
            console.log('✅ 統合テスト開始スケジューリング完了');
            
        } catch (error) {
            console.error('💀 統合テスト設定失敗:', error);
            // テスト失敗は警告に留め、Bootstrap は成功とする
        }
    }
    
    // ===========================================
    // デバッグ・状態管理
    // ===========================================
    
    /**
     * デバッグ情報取得
     * @returns {Object} デバッグ情報
     */
    getDebugInfo() {
        return {
            className: this.className,
            version: this.version,
            dependencies: { ...this.dependencies },
            domStatus: { ...this.domStatus },
            timing: { ...this.timing },
            environment: {
                pixiVersion: window.PIXI?.VERSION || 'Unknown',
                webGPUSupport: !!(navigator.gpu),
                documentReady: document.readyState,
                tegakiNamespace: !!window.Tegaki,
                bootstrapped: window.Tegaki?.isBootstrapped || false
            }
        };
    }
    
    /**
     * 実行時間取得
     * @returns {Object} タイミング情報
     */
    getExecutionTime() {
        const now = Date.now();
        const startTime = this.timing.start || now;
        
        return {
            total: now - startTime,
            pixiCheck: this.timing.pixiCheck ? this.timing.pixiCheck - startTime : 0,
            domSetup: this.timing.domSetup ? this.timing.domSetup - startTime : 0,
            appInit: this.timing.appInit ? this.timing.appInit - startTime : 0,
            complete: this.timing.complete ? this.timing.complete - startTime : 0
        };
    }
    
    /**
     * システム状態確認
     * @returns {boolean} 準備完了可否
     */
    isReady() {
        return this.dependencies.pixi && 
               this.domStatus.canvasContainer && 
               this.domStatus.documentReady &&
               window.Tegaki?.isBootstrapped;
    }
}

// ===========================================
// グローバル実行制御
// ===========================================

/**
 * Bootstrap実行（単一インスタンス制御）
 */
async function startBootstrap() {
    // 既存インスタンス確認
    if (window.Tegaki?.bootstrapInstance) {
        console.warn('⚠️ Bootstrap: インスタンス既存 - 重複起動をスキップ');
        return window.Tegaki.bootstrapInstance;
    }
    
    try {
        const bootstrap = new Bootstrap();
        await bootstrap.start();
        return bootstrap;
        
    } catch (error) {
        console.error('💥 Bootstrap起動完全失敗:', error);
        throw error;
    }
}

// グローバル登録
window.Tegaki = window.Tegaki || {};
window.Tegaki.Bootstrap = Bootstrap;
window.Tegaki.startBootstrap = startBootstrap;

// DOMContentLoaded後の自動実行
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            await startBootstrap();
        } catch (error) {
            console.error('💥 自動Bootstrap失敗:', error);
        }
    });
} else {
    // DOM既に準備済みの場合は即座に実行
    setTimeout(async () => {
        try {
            await startBootstrap();
        } catch (error) {
            console.error('💥 即座Bootstrap失敗:', error);
        }
    }, 0);
}

console.log('🚀 Bootstrap PixiJS v8対応版・二重初期化防止版 Loaded');
console.log('📏 特徴: シングルトンパターン・二重実行完全防止・TegakiApplication単一インスタンス制御・DOM準備確実化');
console.log('🎯 使用方法: DOMContentLoaded後に自動実行 or window.Tegaki.startBootstrap()で手動実行');