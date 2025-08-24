/**
 * 🚀 Tegaki Bootstrap - 診断・起動補助専門 (軽量責務分離版)
 * 📋 RESPONSIBILITY: 依存存在確認・起動診断・AppCore起動補助のみ
 * 🚫 PROHIBITION: 依存関係ロード・スクリプト挿入・初期化ロジック・UI処理
 * ✅ PERMISSION: 依存確認・診断情報提供・起動タイミング調整・AppCore.initialize()呼び出しのみ
 * 
 * 📏 DESIGN_PRINCIPLE: index.html→依存管理, bootstrap.js→診断・起動補助
 * 🔄 INTEGRATION: 軽量・シンプル・明確な責務分界
 * 
 * 🎯 改修内容:
 * - 依存関係ロード処理を完全削除
 * - 診断・起動補助機能に限定
 * - main.jsの競合状態を解決
 * - デバッグ情報の充実化
 */

(function() {
    'use strict';
    
    console.log('🚀 Tegaki Bootstrap - 診断・起動補助専門版 開始');
    
    // 軽量Bootstrap設定
    const BOOTSTRAP_CONFIG = {
        maxRetries: 5,
        retryInterval: 500,
        timeoutMs: 15000,
        diagnosticLevel: 'verbose' // 'minimal', 'normal', 'verbose'
    };
    
    let retryCount = 0;
    let startTime = performance.now();
    
    /**
     * 依存存在確認関数（ロード処理なし・確認のみ）
     */
    function checkDependencies() {
        const requiredDependencies = [
            // 統一システム確認
            { name: 'ConfigManagerInstance', path: 'window.Tegaki.ConfigManagerInstance', critical: true },
            { name: 'ErrorManagerInstance', path: 'window.Tegaki.ErrorManagerInstance', critical: true },
            { name: 'StateManagerInstance', path: 'window.Tegaki.StateManagerInstance', critical: true },
            { name: 'EventBusInstance', path: 'window.Tegaki.EventBusInstance', critical: true },
            
            // 専門Manager確認
            { name: 'CoordinateManagerInstance', path: 'window.Tegaki.CoordinateManagerInstance', critical: true },
            { name: 'CanvasManagerInstance', path: 'window.Tegaki.CanvasManagerInstance', critical: true },
            
            // AppCore確認
            { name: 'AppCore', path: 'window.Tegaki.AppCore', critical: true },
            { name: 'TegakiApplication', path: 'window.Tegaki.TegakiApplication', critical: true },
            
            // PixiJS確認
            { name: 'PIXI', path: 'window.PIXI', critical: true }
        ];
        
        const results = {
            loaded: [],
            missing: [],
            critical: [],
            warnings: []
        };
        
        requiredDependencies.forEach(dep => {
            const exists = checkPath(dep.path);
            
            if (exists) {
                results.loaded.push(dep.name);
            } else {
                results.missing.push(dep.name);
                if (dep.critical) {
                    results.critical.push(dep.name);
                }
            }
        });
        
        // 初期化レジストリ確認
        if (window.Tegaki?._registry) {
            results.warnings.push(`初期化レジストリに${window.Tegaki._registry.length}個の未実行処理`);
        }
        
        return results;
    }
    
    /**
     * パス存在確認ユーティリティ
     */
    function checkPath(path) {
        try {
            const parts = path.split('.');
            let current = window;
            
            for (const part of parts) {
                if (part === 'window') continue;
                if (current[part] === undefined) {
                    return false;
                }
                current = current[part];
            }
            
            return true;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * DOM状態確認
     */
    function checkDOMReadiness() {
        const container = document.getElementById('canvas-container');
        
        return {
            domReady: document.readyState === 'complete',
            containerExists: !!container,
            containerSize: container ? {
                width: container.offsetWidth,
                height: container.offsetHeight
            } : null
        };
    }
    
    /**
     * 起動診断実行
     */
    function runBootstrapDiagnostics() {
        const elapsed = performance.now() - startTime;
        
        console.log(`🔍 起動診断実行 (${elapsed.toFixed(2)}ms経過)`);
        
        const deps = checkDependencies();
        const dom = checkDOMReadiness();
        
        if (BOOTSTRAP_CONFIG.diagnosticLevel === 'verbose') {
            console.log('📦 依存関係状況:');
            console.log(`  ✅ 読み込み済み: ${deps.loaded.length}個`);
            if (deps.loaded.length > 0) {
                console.log(`     ${deps.loaded.join(', ')}`);
            }
            
            if (deps.missing.length > 0) {
                console.log(`  ❌ 不足: ${deps.missing.length}個`);
                console.log(`     ${deps.missing.join(', ')}`);
            }
            
            if (deps.warnings.length > 0) {
                console.log(`  ⚠️ 警告: ${deps.warnings.join(', ')}`);
            }
            
            console.log('📋 DOM状況:');
            console.log(`  - 完了状態: ${dom.domReady}`);
            console.log(`  - コンテナ: ${dom.containerExists}`);
            if (dom.containerSize) {
                console.log(`  - サイズ: ${dom.containerSize.width}x${dom.containerSize.height}px`);
            }
        }
        
        return {
            dependencies: deps,
            dom,
            ready: deps.critical.length === 0 && dom.domReady && dom.containerExists,
            elapsed
        };
    }
    
    /**
     * AppCore起動補助（診断後の起動のみ）
     */
    async function assistAppCoreStartup() {
        try {
            console.log('🎯 AppCore起動補助開始...');
            
            // AppCore存在確認
            if (!window.Tegaki?.AppCore) {
                throw new Error('AppCoreが見つかりません');
            }
            
            // TegakiApplication存在確認
            if (!window.Tegaki?.TegakiApplication) {
                throw new Error('TegakiApplicationが見つかりません');
            }
            
            // AppInstance存在確認・作成
            let appInstance = window.Tegaki.AppInstance;
            if (!appInstance) {
                console.log('📱 AppInstance作成中...');
                appInstance = new window.Tegaki.TegakiApplication();
                window.Tegaki.AppInstance = appInstance;
                console.log('✅ AppInstance作成完了');
            }
            
            // 初期化状態確認
            if (appInstance.initialized) {
                console.log('⚠️ AppInstance既に初期化済み');
                return true;
            }
            
            console.log('🚀 AppInstance初期化実行...');
            const success = await appInstance.initialize();
            
            if (success) {
                console.log('✅ AppCore起動補助完了');
                
                // 起動完了診断
                setTimeout(() => {
                    runPostStartupDiagnostics();
                }, 1000);
                
                return true;
            } else {
                throw new Error('AppInstance初期化が失敗を返しました');
            }
            
        } catch (error) {
            console.error('❌ AppCore起動補助エラー:', error);
            
            // エラー通知（ErrorManager利用可能な場合）
            if (window.Tegaki?.ErrorManagerInstance) {
                window.Tegaki.ErrorManagerInstance.showError('error', 
                    `起動エラー: ${error.message}`, {
                    context: 'Bootstrap AppCore Startup',
                    showReload: true
                });
            }
            
            return false;
        }
    }
    
    /**
     * 起動完了後診断
     */
    function runPostStartupDiagnostics() {
        console.log('🔍 起動完了後診断実行...');
        
        try {
            // キャンバス表示確認
            const container = document.getElementById('canvas-container');
            const canvas = container?.querySelector('canvas');
            
            const canvasStatus = {
                containerExists: !!container,
                canvasExists: !!canvas,
                canvasVisible: canvas ? canvas.offsetWidth > 0 && canvas.offsetHeight > 0 : false,
                canvasSize: canvas ? `${canvas.width}x${canvas.height}` : null
            };
            
            // AppInstance状態確認
            const appStatus = {
                instanceExists: !!window.Tegaki?.AppInstance,
                initialized: !!(window.Tegaki?.AppInstance?.initialized),
                appCoreExists: !!(window.Tegaki?.AppInstance?.appCore),
                appCoreInitialized: !!(window.Tegaki?.AppInstance?.appCore?.initialized)
            };
            
            console.log('🎨 キャンバス状態:', canvasStatus);
            console.log('📱 アプリ状態:', appStatus);
            
            // 問題診断
            const issues = [];
            if (!canvasStatus.canvasExists) issues.push('キャンバス要素なし');
            if (!canvasStatus.canvasVisible) issues.push('キャンバス非表示');
            if (!appStatus.initialized) issues.push('アプリ未初期化');
            if (!appStatus.appCoreInitialized) issues.push('AppCore未初期化');
            
            if (issues.length === 0) {
                console.log('🎉 起動完了後診断: すべて正常');
            } else {
                console.warn('⚠️ 起動完了後診断: 問題発見', issues);
                
                // 問題がある場合の緊急修復提案
                if (window.emergencyCanvasFix) {
                    console.log('🆘 緊急修復関数が利用可能です: window.emergencyCanvasFix()');
                }
            }
            
        } catch (error) {
            console.error('❌ 起動完了後診断エラー:', error);
        }
    }
    
    /**
     * 再試行機能付き起動チェック
     */
    async function tryStartup() {
        retryCount++;
        
        console.log(`🔄 起動試行 #${retryCount}/${BOOTSTRAP_CONFIG.maxRetries}`);
        
        const diagnosis = runBootstrapDiagnostics();
        
        if (diagnosis.ready) {
            console.log('✅ 起動条件満足 - AppCore起動補助実行');
            const success = await assistAppCoreStartup();
            
            if (success) {
                console.log('🎉 Bootstrap起動補助完了');
                return true;
            }
        }
        
        // 再試行判定
        if (retryCount >= BOOTSTRAP_CONFIG.maxRetries) {
            console.error('❌ Bootstrap最大試行回数到達 - 起動失敗');
            
            if (window.Tegaki?.ErrorManagerInstance) {
                window.Tegaki.ErrorManagerInstance.showError('error', 
                    'アプリケーション起動に失敗しました。ページを再読み込みしてください。', {
                    context: 'Bootstrap Max Retries',
                    showReload: true
                });
            }
            
            return false;
        }
        
        console.log(`⏳ ${BOOTSTRAP_CONFIG.retryInterval}ms後に再試行...`);
        setTimeout(tryStartup, BOOTSTRAP_CONFIG.retryInterval);
    }
    
    /**
     * タイムアウト処理
     */
    function setupTimeout() {
        setTimeout(() => {
            if (!window.Tegaki?.AppInstance?.initialized) {
                console.error('🆘 Bootstrap タイムアウト - 強制終了');
                
                if (window.Tegaki?.ErrorManagerInstance) {
                    window.Tegaki.ErrorManagerInstance.showError('error', 
                        'アプリケーション起動がタイムアウトしました。', {
                        context: 'Bootstrap Timeout',
                        showReload: true
                    });
                }
            }
        }, BOOTSTRAP_CONFIG.timeoutMs);
    }
    
    /**
     * Bootstrap開始
     */
    function startBootstrap() {
        console.log('🚀 Bootstrap開始 - DOM状態:', document.readyState);
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                console.log('📋 DOMContentLoaded - 起動試行開始');
                tryStartup();
            });
        } else {
            console.log('📋 DOM既に準備完了 - 起動試行開始');
            tryStartup();
        }
        
        // タイムアウト設定
        setupTimeout();
    }
    
    // 診断ユーティリティをグローバル公開
    window.bootstrapDiagnostics = function() {
        console.log('🔧 Bootstrap診断実行');
        return runBootstrapDiagnostics();
    };
    
    window.checkTegakiReady = function() {
        const diagnosis = runBootstrapDiagnostics();
        console.log('📊 Tegaki準備状況:', diagnosis.ready ? '準備完了' : '準備未完了');
        return diagnosis;
    };
    
    // Bootstrap開始
    startBootstrap();
    
    console.log('✅ Bootstrap診断・起動補助システム登録完了');
    
})();