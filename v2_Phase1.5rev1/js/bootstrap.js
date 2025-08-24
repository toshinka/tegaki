/**
 * 🚀 Tegaki Bootstrap - 依存関係管理・初期化制御（構文エラー解決版）
 * 📋 RESPONSIBILITY: スクリプト依存関係の順序管理・読み込み制御
 * 🚫 PROHIBITION: UI処理・初期化ロジック・エラー表示
 * ✅ PERMISSION: 依存関係解決・順序制御・main.js委譲
 * 
 * 📏 DESIGN_PRINCIPLE: 責任分界（依存管理専門）
 * 🔄 INTEGRATION: main.js初期化への確実な委譲
 * 
 * 🔧 Phase1.5修正内容:
 * - main.js読み込み順序修正（TegakiApplication定義後のイベント発火保証）
 * - 依存関係完了後の確実なアプリケーション初期化
 * - エラー処理の完全委譲（UI処理排除）
 */

(function() {
    'use strict';
    
    console.log('🚀 Tegaki Bootstrap 開始');
    
    // 依存関係定義（main.js除く - 最後に別途処理）
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
        
        // Phase 9: main.js は最後に別途読み込み（重要）
    ];
    
    let loadedCount = 0;
    const totalCount = dependencies.length + 1; // +1 for main.js
    
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
    
    // main.js読み込み（TegakiApplication定義）
    async function loadMainJS() {
        try {
            await loadScript('js/main.js');
            console.log('✅ main.js読み込み完了 - TegakiApplication定義済み');
            return true;
        } catch (error) {
            console.error('❌ main.js読み込み失敗:', error);
            return false;
        }
    }
    
    // 依存関係＋main.js順次読み込み実行
    async function loadAllDependencies() {
        try {
            console.log(`📦 ${totalCount}個の依存関係を順次読み込み中...`);
            
            // Step 1: main.js以外の依存関係読み込み
            for (const dependency of dependencies) {
                await loadScript(dependency);
            }
            console.log('✅ 基盤依存関係読み込み完了');
            
            // Step 2: main.js読み込み（TegakiApplication定義）
            const mainSuccess = await loadMainJS();
            if (!mainSuccess) {
                throw new Error('main.js読み込み失敗');
            }
            
            console.log('✅ 全依存関係読み込み完了');
            
            // Step 3: 依存関係完了後のアプリケーション初期化トリガー
            setTimeout(() => {
                if (window.Tegaki?.TegakiApplication) {
                    console.log('🎯 TegakiApplication初期化トリガー発火');
                    window.dispatchEvent(new CustomEvent('tegaki:dependencies:loaded'));
                } else {
                    console.error('❌ TegakiApplication未定義 - 初期化トリガー失敗');
                    window.dispatchEvent(new CustomEvent('tegaki:dependencies:error', {
                        detail: { error: 'TegakiApplication not found after main.js load' }
                    }));
                }
            }, 50); // 50ms待機でTegakiApplication定義確実化
            
        } catch (error) {
            console.error('❌ 依存関係読み込み失敗:', error);
            
            // エラー処理はmain.jsのErrorManager委譲へ
            window.dispatchEvent(new CustomEvent('tegaki:dependencies:error', {
                detail: { error: error.message }
            }));
        }
    }
    
    // PixiJS読み込み確認後に実行
    function checkPixiAndStart() {
        if (window.PIXI) {
            console.log('✅ PIXI.js 読み込み確認');
            loadAllDependencies();
        } else {
            console.warn('⚠️ PIXI.js 未読み込み - 100ms後に再確認');
            setTimeout(checkPixiAndStart, 100);
        }
    }
    
    // DOM読み込み後に開始
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkPixiAndStart);
    } else {
        checkPixiAndStart();
    }
    
})();

console.log('🚀 Bootstrap スクリプト登録完了（構文エラー解決版）');