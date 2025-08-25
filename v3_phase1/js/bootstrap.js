/**
 * 🚀 Tegaki Bootstrap - 怪物コード撲滅・シンプル版
 * 📋 RESPONSIBILITY: 必要最小限のスクリプト読み込みのみ
 * 🚫 PROHIBITION: 複雑な段階制御・フォールバック・エラー隠蔽
 * ✅ PERMISSION: 順次読み込み・例外throw・main.js委譲
 * 
 * 📏 DESIGN_PRINCIPLE: 骨太・直線的・素人でも読める
 * 🔄 INTEGRATION: 存在するファイルのみ読み込み
 */

(function() {
    'use strict';
    
    console.log('🚀 Tegaki Bootstrap シンプル版 開始');
    
    // 存在するファイルのみ（怪物化防止・確実性重視）
    const scripts = [
        // Phase 1: 基盤3つのみ（確実に存在）
        'js/utils/error-manager.js',
        'js/utils/config-manager.js', 
        'js/utils/event-bus.js',
        
        // Phase 2: Managerクラス（確実に存在）
        'managers/canvas-manager.js',
        'managers/tool-manager.js',
        
        // Phase 3: Toolクラス（確実に存在）  
        'tools/pen-tool.js',
        'tools/eraser-tool.js',
        
        // Phase 4: アプリケーション（確実に存在）
        'js/app-core.js',
        'js/main.js'
    ];
    
    /**
     * スクリプト読み込み関数（エラー隠蔽禁止）
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
                <div style="padding: 20px; color: red; font-family: monospace; background: #ffe6e6; border: 2px solid #ff9999; margin: 20px; border-radius: 8px;">
                    <h2>🔥 Tegaki Bootstrap Error</h2>
                    <p><strong>Error:</strong> ${error.message}</p>
                    <p><strong>Cause:</strong> Script loading failed</p>
                    <p><strong>Action:</strong> Check browser console and file paths</p>
                    <p><strong>File:</strong> Check if ${error.message.split(': ')[1]} exists</p>
                    <button onclick="location.reload()" style="padding: 8px 16px; margin-top: 10px; background: #800000; color: white; border: none; border-radius: 4px; cursor: pointer;">Reload</button>
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
                throw new Error('PIXI.js not available - check CDN loading');
            }
        }, 100);
    }
    
})();

console.log('🎯 Bootstrap シンプル版 registered - 怪物コード撲滅・直線的読み込み');