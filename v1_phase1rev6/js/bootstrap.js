/**
 * 🚀 Bootstrap - 計画書準拠修正版（名前空間統一対応）
 * 📋 RESPONSIBILITY: DOMContentLoaded でTegakiApplicationを確認しインスタンス化のみ
 * 🚫 PROHIBITION: 複雑な読み込み制御・エラー隠蔽・フォールバック
 * ✅ PERMISSION: TegakiApplication確認・例外throw・start呼び出し
 * 
 * 📏 DESIGN_PRINCIPLE: 計画書準拠・最小限責任・Bootstrap自身は公開しない
 * 🔄 INTEGRATION: index.htmlの読み込み順序により全依存完了後に実行
 * 🎯 FIX: window.Tegaki.TegakiApplication参照に修正（名前空間統一準拠）
 */

(function() {
    'use strict';
    
    console.log('🚀 Bootstrap Simple - 計画書準拠版（名前空間修正）');
    
    /**
     * Bootstrap実行（計画書準拠・名前空間対応）
     */
    async function executeBootstrap() {
        console.log('🔧 Bootstrap実行開始...');
        
        // window.Tegaki.TegakiApplication確認（存在しない場合は例外throw）
        if (!window.Tegaki || !window.Tegaki.TegakiApplication) {
            const error = new Error('TegakiApplication class not available');
            console.error('💀 Bootstrap失敗:', error.message);
            console.error('🔍 確認対象: window.Tegaki.TegakiApplication');
            console.error('🔍 window.Tegaki:', window.Tegaki);
            throw error;
        }
        
        try {
            // TegakiApplication インスタンス化（自動で初期化される）
            console.log('🎨 TegakiApplication インスタンス化開始...');
            const tegakiApp = new window.Tegaki.TegakiApplication();
            
            // グローバル参照設定（デバッグ用）
            window.TegakiAppInstance = tegakiApp;
            
            console.log('✅ Bootstrap完了 - Tegakiアプリケーション開始完了');
            
        } catch (error) {
            console.error('💀 Bootstrap失敗:', error);
            
            // エラー隠蔽禁止・画面に表示
            document.body.innerHTML = `
                <div style="padding: 20px; color: red; font-family: monospace; background: #ffe6e6; border: 2px solid #ff9999;">
                    <h2>🔥 Bootstrap Error</h2>
                    <p><strong>Error:</strong> ${error.message}</p>
                    <p><strong>Location:</strong> bootstrap.js</p>
                    <p><strong>Cause:</strong> ${error.name}</p>
                    <p><strong>Time:</strong> ${new Date().toISOString()}</p>
                    <p><strong>Expected:</strong> window.Tegaki.TegakiApplication</p>
                    <p><strong>Available:</strong> ${Object.keys(window.Tegaki || {}).join(', ') || 'undefined'}</p>
                    <button onclick="location.reload()" style="padding: 10px; margin-top: 10px;">
                        🔄 Reload Application
                    </button>
                    <details style="margin-top: 10px;">
                        <summary>Stack Trace</summary>
                        <pre style="background: #f5f5f5; padding: 10px; margin-top: 5px;">${error.stack || 'No stack trace available'}</pre>
                    </details>
                </div>
            `;
            
            // 例外隠蔽禁止・明示的throw
            throw error;
        }
    }
    
    /**
     * DOMContentLoaded イベント待機（計画書準拠）
     */
    function waitForDOMReady() {
        if (document.readyState === 'loading') {
            console.log('⏳ DOM Loading - DOMContentLoaded待機中...');
            document.addEventListener('DOMContentLoaded', executeBootstrap);
        } else {
            console.log('✅ DOM Ready - Bootstrap実行');
            executeBootstrap();
        }
    }
    
    // DOM準備確認後にBootstrap実行
    waitForDOMReady();
    
})();

// Bootstrap自身は公開しない（計画書準拠）
console.log('🎯 Bootstrap registered - 計画書準拠・最小限責任（名前空間修正版）');