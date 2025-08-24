/**
 * 🚀 Tegaki Bootstrap - 依存関係管理・初期化制御 (REV系・初期化トリガー確実化版)
 * 📋 RESPONSIBILITY: スクリプト依存関係の順序管理・読み込み制御・main.js初期化確実実行
 * 🚫 PROHIBITION: UI処理・初期化ロジック・エラー表示
 * ✅ PERMISSION: 依存関係解決・順序制御・main.js委譲・トリガー確実発火
 * 
 * 📏 DESIGN_PRINCIPLE: 責任分界（依存管理専門）
 * 🔄 INTEGRATION: main.js初期化への確実な委譲
 * 
 * 🔧 REV系修正内容:
 * 1. main.js読み込み確認強化
 * 2. TegakiApplication定義確認
 * 3. 初期化トリガー確実発火
 * 4. タイムアウト処理追加
 */

(function() {
    'use strict';
    
    console.log('🚀 Tegaki Bootstrap 開始');
    
    // 依存関係定義（現在のPHASE1～9を統合・最適化）
    const dependencies = [
        // Phase 1: 基盤ユーティリティ（依存なし）
        'js/utils/config-manager.js',
        'js/utils/error-manager.js',
        'js/utils/state-manager.js',
        'js/utils/event-bus.js',
        
        // Phase 2: 座標・境界システム
        'js/utils/coordinate-manager.js',
        
        // Phase 3: 追加ユーティリティ
        'js/utils/performance.js',
        'js/utils/icon-manager.js',
        
        // Phase 4: UI・管理システム
        'js/ui/popup-manager.js',
        'js/ui/slider-manager.js',
        'managers/ui-manager.js',
        'managers/memory-manager.js',
        'managers/settings-manager.js',
        
        // Phase 5: PixiJS拡張
        'libs/pixi-extensions.js',
        
        // Phase 6: Canvas・境界・ツール管理
        'managers/canvas-manager.js',
        'managers/boundary-manager.js',
        'managers/tool-manager.js',
        
        // Phase 7: ツール実装
        'tools/abstract-tool.js',
        'tools/pen-tool.js',
        'tools/eraser-tool.js',
        
        // Phase 8: コアシステム
        'js/app-core.js'
        
        // Phase 9: メインアプリケーションは分離（確実読み込み保証）
    ];
    
    // main.jsは別途確実読み込み
    const mainScript = 'js/main.js';
    
    let loadedCount = 0;
    const totalCount = dependencies.length;
    let mainScriptLoaded = false;
    
    // 順序保証読み込み関数
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.defer = false; // 順序保証
            
            script.onload = () => {
                loadedCount++;
                console.log(`✅ [${loadedCount}/${totalCount}] ${src}`);
                resolve();
            };
            
            script.onerror = (error) => {
                console.error(`❌ Failed to load: ${src}`, error);
                reject(new Error(`Failed to load ${src}`));
            };
            
            document.head.appendChild(script);
        });
    }
    
    // main.js専用読み込み関数
    function loadMainScript() {
        return new Promise((resolve, reject) => {
            console.log('🎯 main.js読み込み開始...');
            
            const script = document.createElement('script');
            script.src = mainScript;
            script.defer = false;
            
            script.onload = () => {
                mainScriptLoaded = true;
                console.log('✅ main.js読み込み完了');
                
                // TegakiApplication定義確認
                if (window.Tegaki?.TegakiApplication) {
                    console.log('✅ TegakiApplication定義確認');
                    resolve();
                } else {
                    console.error('❌ TegakiApplication定義されていません');
                    reject(new Error('TegakiApplication not defined'));
                }
            };
            
            script.onerror = (error) => {
                console.error('❌ main.js読み込み失敗:', error);
                reject(new Error('Failed to load main.js'));
            };
            
            document.head.appendChild(script);
        });
    }
    
    // 初期化トリガー確実発火
    function triggerMainInitialization() {
        console.log('🎯 初期化トリガー発火試行...');
        
        // TegakiApplication存在確認
        if (!window.Tegaki?.TegakiApplication) {
            console.error('❌ TegakiApplication が見つかりません - 5秒後に再試行');
            setTimeout(triggerMainInitialization, 5000);
            return;
        }
        
        // インスタンス存在確認
        if (!window.Tegaki.AppInstance) {
            console.log('⚠️ AppInstance未作成 - DOM待機中');
            
            // DOM完了待機
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', triggerMainInitialization);
                return;
            }
        }
        
        console.log('🚀 依存関係完了イベント発火');
        
        // 依存関係完了イベント発火
        try {
            const event = new CustomEvent('tegaki:dependencies:loaded', {
                detail: { 
                    totalDependencies: totalCount + 1,
                    loadTime: performance.now()
                }
            });
            window.dispatchEvent(event);
            console.log('✅ 依存関係完了イベント発火成功');
        } catch (error) {
            console.error('❌ イベント発火エラー:', error);
        }
        
        // 追加確認: AppInstanceが作成されているか3秒後に確認
        setTimeout(() => {
            if (window.Tegaki?.AppInstance) {
                console.log('✅ AppInstance作成確認完了');
            } else {
                console.warn('⚠️ AppInstance未作成 - 手動作成試行');
                try {
                    const app = new window.Tegaki.TegakiApplication();
                    window.Tegaki.AppInstance = app;
                    console.log('✅ AppInstance手動作成完了');
                } catch (error) {
                    console.error('❌ AppInstance手動作成エラー:', error);
                }
            }
        }, 3000);
    }
    
    // 順次読み込み実行
    async function loadDependencies() {
        try {
            console.log(`📦 ${totalCount}個の依存関係を順次読み込み中...`);
            
            // Step 1: 基盤依存関係読み込み
            for (const dependency of dependencies) {
                await loadScript(dependency);
            }
            
            console.log('✅ 基盤依存関係読み込み完了');
            
            // Step 2: main.js確実読み込み
            await loadMainScript();
            
            console.log('✅ 全依存関係読み込み完了');
            
            // Step 3: 初期化トリガー確実発火
            triggerMainInitialization();
            
        } catch (error) {
            console.error('❌ 依存関係読み込み失敗:', error);
            
            // エラー処理はmain.jsのErrorManager委譲へ
            try {
                const errorEvent = new CustomEvent('tegaki:dependencies:error', {
                    detail: { error: error.message }
                });
                window.dispatchEvent(errorEvent);
            } catch (eventError) {
                console.error('❌ エラーイベント発火失敗:', eventError);
            }
        }
    }
    
    // PixiJS読み込み確認後に実行
    function checkPixiAndStart() {
        if (window.PIXI) {
            console.log('✅ PIXI.js 読み込み確認');
            loadDependencies();
        } else {
            console.warn('⚠️ PIXI.js 未読み込み - 100ms後に再確認');
            setTimeout(checkPixiAndStart, 100);
        }
    }
    
    // DOM読み込み状態確認・開始
    function startBootstrap() {
        console.log(`📋 DOM状態: ${document.readyState}`);
        
        if (document.readyState === 'loading') {
            console.log('📋 DOM読み込み待機中...');
            document.addEventListener('DOMContentLoaded', () => {
                console.log('📋 DOMContentLoaded - Bootstrap開始');
                checkPixiAndStart();
            });
        } else {
            console.log('📋 DOM読み込み完了 - Bootstrap開始');
            checkPixiAndStart();
        }
    }
    
    // Bootstrap開始
    startBootstrap();
    
    // 緊急時タイムアウト処理（30秒）
    setTimeout(() => {
        if (!mainScriptLoaded) {
            console.error('🆘 Bootstrap タイムアウト - main.js読み込み未完了');
            
            try {
                const timeoutEvent = new CustomEvent('tegaki:dependencies:error', {
                    detail: { error: 'Bootstrap timeout - main.js loading failed' }
                });
                window.dispatchEvent(timeoutEvent);
            } catch (error) {
                console.error('❌ タイムアウトイベント発火失敗:', error);
            }
        }
    }, 30000);
    
})();

console.log('🚀 Bootstrap スクリプト登録完了（構文エラー解決版）');