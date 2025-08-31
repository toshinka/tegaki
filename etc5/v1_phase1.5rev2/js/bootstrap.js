/**
 * 🚀 Bootstrap - Phase1.5対応版（新Manager統合対応）
 * 📋 RESPONSIBILITY: DOMContentLoaded でTegakiApplicationを確認しインスタンス化のみ
 * 🚫 PROHIBITION: 複雑な読み込み制御・エラー隠蔽・フォールバック
 * ✅ PERMISSION: TegakiApplication確認・例外throw・start呼び出し
 * 
 * 📏 DESIGN_PRINCIPLE: 計画書準拠・最小限責任・Bootstrap自身は公開しない
 * 🔄 INTEGRATION: index.htmlの読み込み順序により全依存完了後に実行
 * 🎯 Phase1.5: CoordinateManager, NavigationManager, RecordManager, ShortcutManager統合対応
 */

(function() {
    'use strict';
    
    console.log('🚀 Bootstrap Phase1.5 - 新Manager統合対応版');
    
    /**
     * Phase1.5 依存関係確認（新Managerクラス対応）
     */
    function validatePhase15Dependencies() {
        console.log('🔍 Phase1.5 依存関係確認開始...');
        
        const requiredClasses = {
            // Phase1 既存クラス
            'TegakiApplication': window.Tegaki?.TegakiApplication,
            'AppCore': window.Tegaki?.AppCore,
            'CanvasManager': window.Tegaki?.CanvasManager,
            'ToolManager': window.Tegaki?.ToolManager,
            'ErrorManager': window.Tegaki?.ErrorManager,
            'ConfigManager': window.Tegaki?.ConfigManager,
            'EventBus': window.Tegaki?.EventBus,
            
            // Phase1.5 新規Manager
            'CoordinateManager': window.Tegaki?.CoordinateManager,
            'NavigationManager': window.Tegaki?.NavigationManager,
            'RecordManager': window.Tegaki?.RecordManager,
            'ShortcutManager': window.Tegaki?.ShortcutManager,
            
            // ツールクラス
            'PenTool': window.Tegaki?.PenTool,
            'EraserTool': window.Tegaki?.EraserTool
        };
        
        const missingClasses = [];
        const availableClasses = [];
        
        for (const [className, classRef] of Object.entries(requiredClasses)) {
            if (classRef && typeof classRef === 'function') {
                availableClasses.push(className);
                console.log(`✅ ${className}: 利用可能`);
            } else {
                missingClasses.push(className);
                console.warn(⚠️ ${className}: 未定義または無効`);
            }
        }
        
        console.log(`📊 依存関係確認結果: ${availableClasses.length}/${Object.keys(requiredClasses).length} クラス利用可能`);
        
        if (missingClasses.length > 0) {
            console.warn('⚠️ 未完成のManagerクラス:', missingClasses.join(', '));
            console.warn('🔧 Phase1.5実装途中の場合は正常です');
        }
        
        return {
            available: availableClasses,
            missing: missingClasses,
            isComplete: missingClasses.length === 0
        };
    }
    
    /**
     * Bootstrap実行（Phase1.5対応）
     */
    async function executeBootstrap() {
        console.log('🔧 Bootstrap Phase1.5 実行開始...');
        
        // 基本の Tegaki 名前空間確認
        if (!window.Tegaki) {
            const error = new Error('Tegaki namespace not available');
            console.error('💀 Bootstrap失敗:', error.message);
            throw error;
        }
        
        // TegakiApplication確認（最低限必要）
        if (!window.Tegaki.TegakiApplication) {
            const error = new Error('TegakiApplication class not available');
            console.error('💀 Bootstrap失敗:', error.message);
            console.error('🔍 window.Tegaki:', Object.keys(window.Tegaki));
            throw error;
        }
        
        // Phase1.5 依存関係確認
        const dependencies = validatePhase15Dependencies();
        
        try {
            // TegakiApplication インスタンス化
            console.log('🎨 TegakiApplication インスタンス化開始...');
            const tegakiApp = new window.Tegaki.TegakiApplication();
            
            // グローバル参照設定（デバッグ用）
            window.TegakiAppInstance = tegakiApp;
            
            // Phase1.5 機能確認（利用可能な場合のみ）
            if (dependencies.isComplete) {
                console.log('✅ Phase1.5 完全版 - 全Manager統合済み');
            } else {
                console.log('🔧 Phase1.5 開発版 - 一部Manager実装中');
                console.log('📋 実装済み:', dependencies.available.join(', '));
                console.log('⚠️ 未実装:', dependencies.missing.join(', '));
            }
            
            console.log('✅ Bootstrap完了 - Tegakiアプリケーション開始完了');
            
        } catch (error) {
            console.error('💀 Bootstrap失敗:', error);
            
            // Phase1.5対応のエラー表示
            const dependencyInfo = validatePhase15Dependencies();
            
            // エラー隠蔽禁止・画面に表示
            document.body.innerHTML = `
                <div style="padding: 20px; color: red; font-family: monospace; background: #ffe6e6; border: 2px solid #ff9999;">
                    <h2>🔥 Bootstrap Error - Phase1.5</h2>
                    <p><strong>Error:</strong> ${error.message}</p>
                    <p><strong>Location:</strong> bootstrap.js</p>
                    <p><strong>Phase:</strong> Phase1.5 (新Manager統合)</p>
                    <p><strong>Time:</strong> ${new Date().toISOString()}</p>
                    
                    <h3>📊 依存関係状況</h3>
                    <p><strong>利用可能:</strong> ${dependencyInfo.available.length > 0 ? dependencyInfo.available.join(', ') : 'なし'}</p>
                    <p><strong>未実装:</strong> ${dependencyInfo.missing.length > 0 ? dependencyInfo.missing.join(', ') : 'なし'}</p>
                    <p><strong>完成度:</strong> ${dependencyInfo.available.length}/${dependencyInfo.available.length + dependencyInfo.missing.length} (${Math.round(dependencyInfo.available.length / (dependencyInfo.available.length + dependencyInfo.missing.length) * 100)}%)</p>
                    
                    <button onclick="location.reload()" style="padding: 10px; margin-top: 10px; background: #ff4444; color: white; border: none; cursor: pointer;">
                        🔄 Reload Application
                    </button>
                    
                    <details style="margin-top: 10px;">
                        <summary>📋 Phase1.5 実装状況</summary>
                        <div style="background: #f5f5f5; padding: 10px; margin-top: 5px;">
                            <p><strong>Phase1.5 新規Manager:</strong></p>
                            <ul>
                                <li>CoordinateManager: ${window.Tegaki?.CoordinateManager ? '✅' : '❌'}</li>
                                <li>NavigationManager: ${window.Tegaki?.NavigationManager ? '✅' : '❌'}</li>
                                <li>RecordManager: ${window.Tegaki?.RecordManager ? '✅' : '❌'}</li>
                                <li>ShortcutManager: ${window.Tegaki?.ShortcutManager ? '✅' : '❌'}</li>
                            </ul>
                        </div>
                    </details>
                    
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
     * DOMContentLoaded イベント待機
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
console.log('🎯 Bootstrap Phase1.5 registered - 新Manager統合対応版');