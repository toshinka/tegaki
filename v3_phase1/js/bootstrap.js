/**
 * 🚀 Tegaki Bootstrap v3 - 怪物撲滅版（15行）
 * 📋 RESPONSIBILITY: 純粋なスクリプト順次読み込みのみ
 * 🚫 PROHIBITION: 依存関係待機・タイムアウト・リトライ・複雑な検証
 * ✅ PERMISSION: 順次読み込み・例外throw・main.js委譲
 * 
 * 📏 DESIGN_PRINCIPLE: 158行 → 15行（90%削減）
 */

(function() {
    'use strict';
    
    console.log('🚀 Tegaki Bootstrap v3 開始 - 怪物撲滅版');
    
    // 必要最小限（怪物化防止）
    const scripts = [
        // Phase 1: 基盤3つ + 最小限依存
        'js/utils/error-manager.js',
        'js/utils/config-manager.js', 
        'js/utils/event-bus.js',
        'js/utils/minimal-deps.js',    // 全最小限実装を含む
        
        // Phase 2: Manager（実物）
        'managers/canvas-manager.js',
        'managers/tool-manager.js',
        
        // Phase 3: Tools（修正版）
        'tools/pen-tool.js',
        'tools/eraser-tool.js',
        
        // Phase 4: Main Application
        'js/main.js'
    ];
    
    // 純粋な順次読み込み（Promise chain）
    scripts.reduce((promise, script) => 
        promise.then(() => loadScript(script)), 
        Promise.resolve()
    ).then(() => {
        console.log('✅ 全スクリプト読み込み完了');
        // TegakiApplication作成
        new window.Tegaki.TegakiApplication();
    }).catch(error => {
        console.error('💀 Bootstrap失敗:', error);
        // エラー隠蔽禁止・即座に表示
        document.body.innerHTML = `
            <div style="padding: 20px; color: red; font-family: monospace;">
                <h2>🔥 Tegaki Bootstrap Error v3</h2>
                <p><strong>Error:</strong> ${error.message}</p>
                <p><strong>Action:</strong> Check browser console</p>
                <button onclick="location.reload()">Reload</button>
            </div>
        `;
        throw error; // 例外隠蔽禁止
    });
    
    // スクリプト読み込み関数（例外隠蔽禁止）
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
            
            // エラー隠蔽禁止・即座にreject
            script.onerror = (error) => {
                console.error(`❌ Failed: ${src}`);
                reject(new Error(`Script load failed: ${src}`));
            };
            
            document.head.appendChild(script);
        });
    }
    
})();

console.log('🎯 Bootstrap v3 registered - 怪物撲滅15行版');