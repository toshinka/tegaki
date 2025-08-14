/**
 * 🚀 Main Entry Point - エントリーポイント（緊急修正版）
 * 責務:
 * - AppCore起動
 * - グローバル変数管理
 * - レガシー互換性維持
 * - エラーハンドリング強化
 * 
 * 🚨 緊急修正内容:
 * - 起動失敗時のフォールバック処理強化
 * - エラー詳細表示
 * - 段階的初期化
 */

// グローバル変数（レガシー互換性）
let futabaApp;

// Phase1 統合初期化（緊急修正版）
async function initTegakiPhase1() {
    try {
        console.log('📋 Tegaki Phase1 初期化開始（緊急修正版）...');
        
        // 事前チェック
        if (!performPreInitChecks()) {
            throw new Error('事前チェック失敗');
        }
        
        // AppCore一元初期化
        futabaApp = new AppCore();
        
        // 段階的初期化
        await futabaApp.init();
        
        console.log('🎉 Tegaki Phase1 完全起動!');
        
        // レガシー互換性のためのエイリアス
        setupLegacyCompatibility();
        
        // 起動成功通知
        notifyInitializationSuccess();
        
    } catch (error) {
        console.error('❌ Tegaki Phase1 初期化失敗:', error);
        
        // 詳細なエラー診断
        performErrorDiagnosis(error);
        
        // フォールバック処理
        console.log('🔄 フォールバックモードで再試行...');
        await initFallbackMode();
    }
}

function performPreInitChecks() {
    console.log('🔍 事前チェック実行...');
    
    const checks = [
        {
            name: 'PixiJS',
            check: () => typeof PIXI !== 'undefined',
            critical: true
        },
        {
            name: 'DOM Ready',
            check: () => document.readyState === 'loading' || document.getElementById('app'),
            critical: true
        },
        {
            name: 'AppCore Class',
            check: () => typeof AppCore !== 'undefined',
            critical: true
        },
        {
            name: 'ExtensionLoader Class',
            check: () => typeof ExtensionLoader !== 'undefined',
            critical: false
        }
    ];
    
    const results = checks.map(check => ({
        ...check,
        passed: check.check()
    }));
    
    const criticalFailures = results.filter(r => !r.passed && r.critical);
    
    console.log('チェック結果:');
    results.forEach(result => {
        const status = result.passed ? '✅' : (result.critical ? '❌' : '⚠️');
        console.log(`  ${status} ${result.name}: ${result.passed ? 'OK' : 'NG'}`);
    });
    
    if (criticalFailures.length > 0) {
        console.error('重要チェック失敗:', criticalFailures.map(f => f.name));
        return false;
    }
    
    return true;
}

function setupLegacyCompatibility() {
    try {
        // 段階的に互換性エイリアスを設定
        if (futabaApp) {
            // UIManager互換性
            const uiManager = futabaApp.getManager('ui');
            if (uiManager) {
                window.uiManager = uiManager;
            }
            
            // ToolManager互換性
            const toolManager = futabaApp.getManager('tool');
            if (toolManager) {
                window.toolManager = toolManager;
            }
            
            // その他のManager
            ['settings', 'canvas', 'memory'].forEach(managerName => {
                const manager = futabaApp.getManager(managerName);
                if (manager) {
                    window[`${managerName}Manager`] = manager;
                }
            });
            
            console.log('✅ レガシー互換性設定完了');
        }
    } catch (error) {
        console.error('⚠️ レガシー互換性設定失敗:', error);
    }
}

function notifyInitializationSuccess() {
    try {
        const stats = futabaApp.getStats();
        
        console.group('🎉 Tegaki Phase1 起動完了');
        console.log('統計情報:', stats);
        
        if (futabaApp.extensions) {
            const extensionStats = Object.entries(futabaApp.extensions)
                .filter(([name, ext]) => name !== 'isAvailable')
                .map(([name, ext]) => `${name}: ${ext.available ? '✅' : '❌'}`);
            
            console.log('拡張機能:', extensionStats);
        }
        
        console.log('利用可能なデバッグコマンド:');
        console.log('  - window.debugTegaki.checkManagers()');
        console.log('  - window.debugTegaki.stats()');
        console.log('  - window.debugTegaki.extensions()');
        console.log('  - futabaApp.diagnose()');
        
        console.groupEnd();
        
    } catch (error) {
        console.error('⚠️ 起動成功通知失敗:', error);
    }
}

function performErrorDiagnosis(error) {
    console.group('🔍 エラー診断');
    
    try {
        console.error('初期化エラー:', error);
        
        // 基本環境チェック
        console.log('環境チェック:');
        console.log('  - PIXI:', typeof PIXI !== 'undefined' ? '✅' : '❌');
        console.log('  - ExtensionLoader:', typeof ExtensionLoader !== 'undefined' ? '✅' : '❌');
        console.log('  - AppCore:', typeof AppCore !== 'undefined' ? '✅' : '❌');
        console.log('  - DOM #app:', !!document.getElementById('app') ? '✅' : '❌');
        
        // Manager クラスチェック
        const managerClasses = ['SettingsManager', 'UIManager', 'ToolManager', 'CanvasManager', 'MemoryManager'];
        console.log('Manager クラス:');
        managerClasses.forEach(className => {
            const status = typeof window[className] !== 'undefined' ? '✅' : '❌';
            console.log(`  - ${className}: ${status}`);
        });
        
        // AppCore状態チェック
        if (futabaApp) {
            console.log('AppCore状態:');
            console.log('  - 作成済み: ✅');
            console.log('  - 初期化済み:', futabaApp.isInitialized ? '✅' : '❌');
            console.log('  - Manager数:', Object.keys(futabaApp.managers || {}).length);
            console.log('  - 拡張機能数:', Object.keys(futabaApp.extensions || {}).length);
            
            // 診断実行
            if (typeof futabaApp.diagnose === 'function') {
                futabaApp.diagnose();
            }
        }
        
    } catch (diagError) {
        console.error('診断実行エラー:', diagError);
    }
    
    console.groupEnd();
}

async function initFallbackMode() {
    try {
        console.warn('⚠️ フォールバックモード: 最小構成で起動');
        
        // 最小限のPixiJS初期化
        if (typeof PIXI !== 'undefined') {
            if (!futabaApp) {
                futabaApp = new AppCore();
            }
            
            // 最小限の初期化のみ実行
            if (!futabaApp.app) {
                await futabaApp.initializePixiJS();
            }
            
            // 基本的な描画機能のみ提供
            setupMinimalDrawingFeatures();
            
            console.log('✅ フォールバックモード起動成功');
            
        } else {
            console.error('❌ PixiJSが利用できません。アプリケーションを起動できません。');
            
            // HTMLフォールバック表示
            showHTMLFallback();
        }
        
    } catch (error) {
        console.error('❌ フォールバックモード失敗:', error);
        
        // 最後の手段：HTMLエラー表示
        showEmergencyErrorMessage(error);
    }
}

function setupMinimalDrawingFeatures() {
    try {
        console.log('🎨 最小描画機能設定...');
        
        if (!futabaApp || !futabaApp.app) return;
        
        // 基本的な描画レイヤー作成
        const drawingLayer = new PIXI.Container();
        futabaApp.stage.addChild(drawingLayer);
        
        // 最小限のペン機能
        let isDrawing = false;
        let currentPath = null;
        
        drawingLayer.interactive = true;
        drawingLayer.on('pointerdown', (e) => {
            isDrawing = true;
            const pos = e.data.global;
            
            currentPath = new PIXI.Graphics();
            currentPath.lineStyle(2, 0x800000);
            currentPath.moveTo(pos.x, pos.y);
            drawingLayer.addChild(currentPath);
        });
        
        drawingLayer.on('pointermove', (e) => {
            if (isDrawing && currentPath) {
                const pos = e.data.global;
                currentPath.lineTo(pos.x, pos.y);
            }
        });
        
        drawingLayer.on('pointerup', () => {
            isDrawing = false;
            currentPath = null;
        });
        
        // グローバル参照（互換性）
        window.minimalDrawing = {
            layer: drawingLayer,
            clear: () => {
                drawingLayer.removeChildren();
            }
        };
        
        console.log('✅ 最小描画機能設定完了');
        console.log('利用可能な機能:');
        console.log('  - クリック&ドラッグで描画');
        console.log('  - window.minimalDrawing.clear() でクリア');
        
    } catch (error) {
        console.error('❌ 最小描画機能設定失敗:', error);
    }
}

function showHTMLFallback() {
    const appElement = document.getElementById('app');
    if (appElement) {
        appElement.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: Arial, sans-serif;">
                <h1 style="color: #800000;">⚠️ Tegaki 起動失敗</h1>
                <p>PixiJSライブラリが読み込まれませんでした。</p>
                <p>ページをリロードして再試行してください。</p>
                <button onclick="location.reload()" style="padding: 10px 20px; margin: 10px; font-size: 16px; cursor: pointer;">
                    🔄 リロード
                </button>
                <details style="margin-top: 20px; max-width: 600px;">
                    <summary style="cursor: pointer;">トラブルシューティング</summary>
                    <ul style="text-align: left; margin: 10px;">
                        <li>ブラウザのJavaScriptが有効になっているか確認</li>
                        <li>ブラウザの拡張機能が干渉していないか確認</li>
                        <li>CDNからのライブラリ読み込みが可能か確認</li>
                        <li>コンソールログでエラー詳細を確認</li>
                    </ul>
                </details>
            </div>
        `;
    }
}

function showEmergencyErrorMessage(error) {
    const appElement = document.getElementById('app') || document.body;
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: #fff; border: 2px solid #800000; padding: 20px; border-radius: 8px;
        font-family: Arial, sans-serif; box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        max-width: 500px; z-index: 10000;
    `;
    
    errorDiv.innerHTML = `
        <h2 style="color: #800000; margin: 0 0 10px 0;">🚨 緊急エラー</h2>
        <p><strong>Tegaki アプリケーションの起動に失敗しました。</strong></p>
        <details style="margin: 10px 0;">
            <summary style="cursor: pointer; font-weight: bold;">エラー詳細</summary>
            <pre style="background: #f0f0f0; padding: 10px; border-radius: 4px; overflow: auto; max-height: 200px; font-size: 12px;">${error.message || 'Unknown error'}\n\n${error.stack || ''}</pre>
        </details>
        <button onclick="location.reload()" style="background: #800000; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-right: 10px;">
            🔄 リロード
        </button>
        <button onclick="this.parentElement.remove()" style="background: #ccc; color: black; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
            ✕ 閉じる
        </button>
    `;
    
    appElement.appendChild(errorDiv);
}

// DOM読み込み完了後に初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('📋 DOM読み込み完了 - Tegaki Phase1 初期化開始');
    
    // 少し待ってからCDNライブラリの読み込み完了を待つ
    setTimeout(initTegakiPhase1, 100);
});

// ページ読み込み完了後のフォールバック
window.addEventListener('load', () => {
    setTimeout(() => {
        if (!futabaApp || !futabaApp.isInitialized) {
            console.warn('⚠️ 通常初期化が完了していません。フォールバック確認中...');
            
            if (futabaApp && futabaApp.app) {
                console.log('✅ 部分的に動作中（PixiJSのみ）');
            } else if (typeof PIXI !== 'undefined') {
                console.log('🔄 PixiJS利用可能 - 緊急フォールバック実行');
                initFallbackMode();
            }
        }
    }, 3000);
});

// モジュールエクスポート（将来のTypeScript対応）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        AppCore, 
        initTegakiPhase1, 
        initFallbackMode,
        performPreInitChecks 
    };
}

// グローバルデバッグ関数
window.emergencyDiagnose = function() {
    console.group('🚨 緊急診断');
    
    try {
        console.log('基本環境:');
        console.log('  - PIXI:', typeof PIXI, PIXI?.VERSION || 'N/A');
        console.log('  - futabaApp:', !!futabaApp);
        console.log('  - 初期化状態:', futabaApp?.isInitialized || false);
        
        if (futabaApp) {
            console.log('AppCore詳細:');
            console.log('  - app:', !!futabaApp.app);
            console.log('  - stage:', !!futabaApp.stage);
            console.log('  - managers:', Object.keys(futabaApp.managers || {}));
            console.log('  - extensions:', Object.keys(futabaApp.extensions || {}));
            
            if (futabaApp.diagnose) {
                futabaApp.diagnose();
            }
        }
        
        console.log('CDNライブラリ状態:');
        const libs = [
            'PIXI', 'typedSignals', 'gsap', '_', 'Hammer', 'Viewport'
        ];
        libs.forEach(lib => {
            console.log(`  - ${lib}:`, typeof window[lib] !== 'undefined' ? '✅' : '❌');
        });
        
        console.log('Manager クラス:');
        const managers = [
            'ExtensionLoader', 'SettingsManager', 'UIManager', 
            'ToolManager', 'CanvasManager', 'MemoryManager'
        ];
        managers.forEach(manager => {
            console.log(`  - ${manager}:`, typeof window[manager] !== 'undefined' ? '✅' : '❌');
        });
        
    } catch (diagError) {
        console.error('診断エラー:', diagError);
    }
    
    console.groupEnd();
};

console.log('🔍 緊急診断コマンド利用可能: window.emergencyDiagnose()');}