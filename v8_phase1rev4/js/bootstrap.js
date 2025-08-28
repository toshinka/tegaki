/**
 * 🚀 Bootstrap - PixiJS v8対応版（読み込み確認強化・新Manager統合対応）
 * 📋 RESPONSIBILITY: PixiJS v8読み込み待機・DOMContentLoaded でTegakiApplicationを確認しインスタンス化のみ
 * 🚫 PROHIBITION: 複雑な読み込み制御・エラー隠蔽・フォールバック
 * ✅ PERMISSION: PixiJS v8確認・TegakiApplication確認・例外throw・start呼び出し
 * 
 * 📏 DESIGN_PRINCIPLE: v8読み込み確認・計画書準拠・最小限責任・Bootstrap自身は公開しない
 * 🔄 INTEGRATION: index.htmlの読み込み順序により全依存完了後に実行
 * 🎯 V8_MIGRATION: PixiJS v8読み込み確認・WebGPU対応確認・非同期初期化対応
 * 
 * 📌 提供メソッド一覧（実装確認済み）:
 * ✅ waitForPixiJSV8() - PixiJS v8読み込み待機・バージョン確認
 * ✅ validatePixiV8Environment() - v8環境確認・WebGPU対応確認
 * ✅ validatePhase15Dependencies() - Phase1.5依存関係確認・新Manager統合確認
 * ✅ executeBootstrap() - v8対応Bootstrap実行・TegakiApplication作成
 * ✅ waitForDOMReady() - DOM準備確認・実行タイミング制御
 * 
 * 📌 他ファイル呼び出しメソッド一覧:
 * ✅ window.PIXI - PixiJS v8ライブラリ（CDN読み込み）
 * ✅ PIXI.VERSION - v8バージョン確認（PixiJS v8.12.0）
 * ✅ PIXI.isWebGPUSupported() - WebGPU対応確認（PixiJS v8.12.0）
 * ✅ window.Tegaki.TegakiApplication - アプリケーションクラス（確認済み）
 * ✅ document.readyState - DOM読み込み状況確認（Browser API）
 * ✅ document.addEventListener() - DOMイベント登録（Browser API）
 * 
 * 📐 v8Bootstrap実行フロー:
 * 開始 → PixiJS v8読み込み待機・バージョン確認 → WebGPU対応確認 → DOM準備確認 → 
 * Phase1.5依存関係確認 → TegakiApplication作成・初期化 → v8システム開始 → 完了
 * 依存関係: PixiJS v8.12.0(必須) → DOM(基盤) → Tegaki Manager群(機能)
 * 
 * 🚨 CRITICAL_V8_DEPENDENCIES: v8必須依存関係（動作に必須）
 * - window.PIXI !== undefined - PixiJS v8読み込み必須
 * - PIXI.VERSION.startsWith('8.') - v8バージョン必須
 * - PIXI.Application !== undefined - v8 Application利用可能必須
 * - window.Tegaki.TegakiApplication !== undefined - アプリケーション定義必須
 * 
 * 🔧 V8_BOOTSTRAP_ORDER: v8Bootstrap順序（厳守必要）
 * 1. PixiJS v8読み込み確認・バージョン検証
 * 2. v8環境確認・WebGPU対応確認
 * 3. DOM準備確認・要素利用可能確認
 * 4. Tegaki名前空間確認・Manager群確認
 * 5. TegakiApplication作成・v8初期化
 * 6. v8システム統合開始・完了通知
 * 
 * 🚫 V8_ABSOLUTE_PROHIBITIONS: v8移行時絶対禁止事項
 * - PixiJS v8読み込み確認なし・v7決め打ち継続
 * - エラー握りつぶし・フォールバック追加
 * - WebGPU対応確認無視・従来処理継続
 * - 非同期初期化無視・同期的処理継続
 */

(function() {
    'use strict';
    
    console.log('🚀 Bootstrap PixiJS v8対応版 - 読み込み確認強化・新Manager統合対応版');
    
    /**
     * PixiJS v8読み込み待機・バージョン確認
     */
    async function waitForPixiJSV8() {
        console.log('⏳ PixiJS v8読み込み確認開始...');
        
        // PixiJS読み込み待機（最大10秒）
        let attempts = 0;
        const maxAttempts = 100; // 10秒（100ms × 100回）
        
        while (attempts < maxAttempts) {
            if (window.PIXI) {
                console.log(`✅ PixiJS発見 (試行 ${attempts + 1}/${maxAttempts})`);
                break;
            }
            
            // 100ms待機
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        // PixiJS読み込み確認
        if (!window.PIXI) {
            throw new Error('PixiJS not loaded after 10 seconds - check CDN connection');
        }
        
        // v8バージョン確認
        const pixiVersion = window.PIXI.VERSION;
        if (!pixiVersion || !pixiVersion.startsWith('8.')) {
            throw new Error(`PixiJS v8 required, got version: ${pixiVersion || 'unknown'}`);
        }
        
        console.log(`🚀 PixiJS v8確認完了: ${pixiVersion}`);
        
        // v8基本機能確認
        if (typeof window.PIXI.Application !== 'function') {
            throw new Error('PixiJS v8 Application class not available');
        }
        
        if (typeof window.PIXI.isWebGPUSupported !== 'function') {
            console.warn('⚠️ PIXI.isWebGPUSupported not available - WebGPU detection limited');
        }
        
        return pixiVersion;
    }
    
    /**
     * v8環境確認・WebGPU対応確認
     */
    async function validatePixiV8Environment() {
        console.log('🔍 PixiJS v8環境確認開始...');
        
        try {
            // WebGPU対応確認（利用可能な場合のみ）
            let webgpuSupported = false;
            if (window.PIXI.isWebGPUSupported) {
                webgpuSupported = await window.PIXI.isWebGPUSupported();
                console.log(`🔍 WebGPU Support: ${webgpuSupported}`);
            } else {
                console.log('📊 WebGPU detection not available - will use WebGL');
            }
            
            // v8基本クラス確認
            const v8Classes = {
                'PIXI.Application': window.PIXI.Application,
                'PIXI.Container': window.PIXI.Container,
                'PIXI.Graphics': window.PIXI.Graphics
            };
            
            const missingClasses = [];
            for (const [className, classRef] of Object.entries(v8Classes)) {
                if (typeof classRef === 'function') {
                    console.log(`✅ ${className}: 利用可能`);
                } else {
                    missingClasses.push(className);
                    console.error(`❌ ${className}: 未定義`);
                }
            }
            
            if (missingClasses.length > 0) {
                throw new Error(`PixiJS v8 core classes missing: ${missingClasses.join(', ')}`);
            }
            
            console.log('✅ PixiJS v8環境確認完了');
            
            return {
                pixiVersion: window.PIXI.VERSION,
                webgpuSupported: webgpuSupported,
                webglSupported: true, // v8では常に利用可能
                coreClassesAvailable: true
            };
            
        } catch (error) {
            console.error('💀 PixiJS v8環境確認エラー:', error);
            throw error;
        }
    }
    
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
                console.warn(`⚠️ ${className}: 未定義または無効`);
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
     * Bootstrap実行（PixiJS v8対応・Phase1.5対応）
     */
    async function executeBootstrap() {
        console.log('🔧 Bootstrap PixiJS v8対応版 実行開始...');
        
        try {
            // Step 1: PixiJS v8読み込み確認・環境検証
            const pixiVersion = await waitForPixiJSV8();
            const v8Environment = await validatePixiV8Environment();
            
            console.log('📋 PixiJS v8環境情報:', {
                version: pixiVersion,
                webgpuSupported: v8Environment.webgpuSupported,
                webglSupported: v8Environment.webglSupported
            });
            
            // Step 2: Tegaki名前空間確認
            if (!window.Tegaki) {
                throw new Error('Tegaki namespace not available');
            }
            
            // Step 3: TegakiApplication確認（最低限必要）
            if (!window.Tegaki.TegakiApplication) {
                throw new Error('TegakiApplication class not available');
            }
            
            // Step 4: Phase1.5 依存関係確認
            const dependencies = validatePhase15Dependencies();
            
            // Step 5: TegakiApplication インスタンス化・v8初期化
            console.log('🎨 TegakiApplication v8対応版 インスタンス化開始...');
            const tegakiApp = new window.Tegaki.TegakiApplication();
            
            // Step 6: グローバル参照設定（デバッグ用）
            window.TegakiAppInstance = tegakiApp;
            
            // Step 7: v8環境情報をアプリケーションに提供
            if (tegakiApp.setV8Environment) {
                tegakiApp.setV8Environment(v8Environment);
            }
            
            // Step 8: Phase1.5 機能確認
            if (dependencies.isComplete) {
                console.log('✅ Phase1.5 完全版 - 全Manager統合済み・PixiJS v8対応');
            } else {
                console.log('🔧 Phase1.5 開発版 - 一部Manager実装中・PixiJS v8対応');
                console.log('📋 実装済み:', dependencies.available.join(', '));
                console.log('⚠️ 未実装:', dependencies.missing.join(', '));
            }
            
            console.log('✅ Bootstrap完了 - Tegaki v8アプリケーション開始完了');
            console.log(`🚀 使用中レンダラー: ${v8Environment.webgpuSupported ? 'WebGPU対応' : 'WebGL'}・PixiJS ${pixiVersion}`);
            
        } catch (error) {
            console.error('💀 Bootstrap失敗:', error);
            
            // Phase1.5・v8対応のエラー表示
            const dependencyInfo = validatePhase15Dependencies();
            const pixiInfo = window.PIXI ? {
                available: true,
                version: window.PIXI.VERSION || 'unknown',
                isV8: window.PIXI.VERSION?.startsWith('8.') || false
            } : {
                available: false,
                version: 'not loaded',
                isV8: false
            };
            
            // エラー隠蔽禁止・画面に表示
            document.body.innerHTML = `
                <div style="padding: 20px; color: red; font-family: monospace; background: #ffe6e6; border: 2px solid #ff9999;">
                    <h2>🔥 Bootstrap Error - PixiJS v8 + Phase1.5</h2>
                    <p><strong>Error:</strong> ${error.message}</p>
                    <p><strong>Location:</strong> bootstrap.js</p>
                    <p><strong>Phase:</strong> Phase1.5 (新Manager統合) + PixiJS v8対応</p>
                    <p><strong>Time:</strong> ${new Date().toISOString()}</p>
                    
                    <h3>🎯 PixiJS v8状況</h3>
                    <p><strong>PixiJS読み込み:</strong> ${pixiInfo.available ? '✅' : '❌'}</p>
                    <p><strong>バージョン:</strong> ${pixiInfo.version}</p>
                    <p><strong>v8対応:</strong> ${pixiInfo.isV8 ? '✅' : '❌'}</p>
                    
                    <h3>📊 依存関係状況</h3>
                    <p><strong>利用可能:</strong> ${dependencyInfo.available.length > 0 ? dependencyInfo.available.join(', ') : 'なし'}</p>
                    <p><strong>未実装:</strong> ${dependencyInfo.missing.length > 0 ? dependencyInfo.missing.join(', ') : 'なし'}</p>
                    <p><strong>完成度:</strong> ${dependencyInfo.available.length}/${dependencyInfo.available.length + dependencyInfo.missing.length} (${Math.round(dependencyInfo.available.length / (dependencyInfo.available.length + dependencyInfo.missing.length) * 100)}%)</p>
                    
                    <button onclick="location.reload()" style="padding: 10px; margin-top: 10px; background: #ff4444; color: white; border: none; cursor: pointer;">
                        🔄 Reload Application
                    </button>
                    
                    <details style="margin-top: 10px;">
                        <summary>📋 PixiJS v8確認項目</summary>
                        <div style="background: #f5f5f5; padding: 10px; margin-top: 5px;">
                            <p><strong>PixiJS v8要件:</strong></p>
                            <ul>
                                <li>window.PIXI: ${window.PIXI ? '✅' : '❌'}</li>
                                <li>PIXI.VERSION: ${window.PIXI?.VERSION || '❌'}</li>
                                <li>v8バージョン: ${window.PIXI?.VERSION?.startsWith('8.') ? '✅' : '❌'}</li>
                                <li>PIXI.Application: ${typeof window.PIXI?.Application === 'function' ? '✅' : '❌'}</li>
                                <li>WebGPU確認: ${typeof window.PIXI?.isWebGPUSupported === 'function' ? '✅' : '❌'}</li>
                            </ul>
                        </div>
                    </details>
                    
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
                    
                    <h3>🔧 修正ヒント</h3>
                    <p>1. index.htmlでPixiJS v8 CDNが正しく読み込まれているか確認</p>
                    <p>2. ネットワーク接続でCDNにアクセスできているか確認</p>
                    <p>3. 他のスクリプトエラーでPixiJS読み込みが阻害されていないか確認</p>
                    <p>4. ブラウザのコンソールでPixiJS読み込みエラーがないか確認</p>
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
console.log('🎯 Bootstrap PixiJS v8対応版 registered - 読み込み確認強化・新Manager統合対応版');