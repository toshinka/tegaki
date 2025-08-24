/**
 * 🚀 Tegaki Simple Bootstrap - 怪物コード撲滅版
 * 📋 RESPONSIBILITY: 必要最小限の順次スクリプト読み込みのみ
 * 🚫 PROHIBITION: エラー監視・フォールバック・複雑な待機システム
 * ✅ PERMISSION: 順次読み込み・例外throw・main.js委譲
 * 
 * 📏 DESIGN_PRINCIPLE: シンプル・直線的・素人でも読める
 * 🔄 INTEGRATION: 必要最小限の依存関係のみ
 */

(function() {
    'use strict';
    
    console.log('🚀 Tegaki Simple Bootstrap 開始');
    
    // 必要最小限の依存関係のみ（怪物化防止）
    const scripts = [
        // Phase 1: 基盤3つのみ
        'js/utils/error-manager.js',
        'js/utils/config-manager.js', 
        'js/utils/event-bus.js',
        
        // Phase 2: 残り全て（依存解決済み前提）
        'js/utils/state-manager.js',
        'js/utils/coordinate-manager.js',
        'js/utils/performance.js',
        'js/utils/icon-manager.js',
        
        'js/ui/popup-manager.js',
        'js/ui/slider-manager.js',
        'managers/ui-manager.js',
        'managers/memory-manager.js',
        'managers/settings-manager.js',
        
        'libs/pixi-extensions.js',
        
        'managers/canvas-manager.js',
        'managers/boundary-manager.js',
        'managers/tool-manager.js',
        
        'tools/abstract-tool.js',
        'tools/pen-tool.js',
        'tools/eraser-tool.js',
        
        'js/app-core.js',
        
        // Phase 3: メインアプリケーション
        'js/main.js'
    ];
    
    /**
     * スクリプト読み込み関数（例外隠蔽禁止）
     */
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            console.log(`📦 Loading: ${src}`);
            
            const script = document.createElement('script');
            script.src = src;
            script.defer = false; // 順序保証
            
            script.onload = () => {
                console.log(`✅ Loaded: ${src}`);
                resolve();
            };
            
            // エラー隠蔽禁止・即座にthrow
            script.onerror = (error) => {
                console.error(`❌ Failed: ${src}`);
                reject(new Error(`Script load failed: ${src}`));
            };
            
            document.head.appendChild(script);
        });
    }
    
    /**
     * 順次読み込み実行（フォールバック禁止）
     */
    async function loadAll() {
        try {
            // 順次実行・エラー時即停止
            for (const script of scripts) {
                await loadScript(script);
            }
            
            console.log('✅ 全スクリプト読み込み完了');
            
            // main.js読み込み完了後にTegakiApplication作成
            if (window.Tegaki?.TegakiApplication) {
                console.log('🎨 TegakiApplication作成開始');
                const app = new window.Tegaki.TegakiApplication();
                window.Tegaki.AppInstance = app;
                console.log('✅ TegakiApplication作成完了');
            } else {
                throw new Error('TegakiApplication class not available');
            }
            
        } catch (error) {
            console.error('💀 Bootstrap失敗:', error);
            
            // エラー隠蔽禁止・画面に表示
            document.body.innerHTML = `
                <div style="padding: 20px; color: red; font-family: monospace;">
                    <h2>🔥 Tegaki Bootstrap Error</h2>
                    <p><strong>Error:</strong> ${error.message}</p>
                    <p><strong>Cause:</strong> Script loading failed</p>
                    <p><strong>Action:</strong> Check browser console and file paths</p>
                    <button onclick="location.reload()">Reload</button>
                </div>
            `;
            
            // 例外隠蔽禁止
            throw error;
        }
    }
    
    /**
     * DOM準備完了後に実行
     */
    function start() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', loadAll);
        } else {
            loadAll();
        }
    }
    
    // PixiJS確認後に開始
    if (window.PIXI) {
        console.log('✅ PIXI.js available');
        start();
    } else {
        console.warn('⚠️ PIXI.js not loaded - waiting...');
        // フォールバック禁止・単純待機のみ
        setTimeout(() => {
            if (window.PIXI) {
                start();
            } else {
                throw new Error('PIXI.js not available');
            }
        }, 100);
    }
    
})();

console.log('🎯 Simple Bootstrap registered - 怪物コード撲滅・直線的読み込み');