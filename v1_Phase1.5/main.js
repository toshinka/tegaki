/**
 * 🚀 Main Entry Point - エントリーポイント（連携化版）
 * 責務:
 * - AppCore起動
 * - グローバル変数管理
 * - レガシー互換性維持
 * - エラーハンドリング
 * 
 * 🎯 AI_WORK_SCOPE: メインエントリーポイント専用ファイル
 * 🎯 DEPENDENCIES: app-core.js, managers/*.js
 * 📋 INTEGRATION_PLAN: 既存システムとの完全互換性保持
 */

// グローバル変数（レガシー互換性）
let futabaApp;
let uiManager; // 既存コード互換用
let toolManager; // 既存コード互換用
let historyManager; // 既存コード互換用

// 初期化状態追跡
const initStatus = {
    phase: 'none',
    startTime: Date.now(),
    errors: [],
    fallbackMode: false
};

/**
 * Phase1 統合初期化メイン関数
 */
async function initTegakiPhase1() {
    try {
        console.log('📋 Tegaki Phase1 初期化開始...');
        initStatus.phase = 'starting';
        
        // AppCore一元初期化
        futabaApp = new AppCore();
        await futabaApp.init();
        
        // レガシー互換性のためのエイリアス設定
        await setupLegacyAliases();
        
        // UI連携セットアップ
        await setupUIIntegration();
        
        // イベントハンドラー設定
        await setupEventHandlers();
        
        initStatus.phase = 'completed';
        const initTime = Date.now() - initStatus.startTime;
        
        console.log(`🎉 Tegaki Phase1 完全起動! (${initTime}ms)`);
        
        // 起動完了通知
        displayStartupNotification(initTime);
        
    } catch (error) {
        console.error('❌ Tegaki Phase1 初期化失敗:', error);
        initStatus.errors.push(error);
        initStatus.phase = 'failed';
        
        // フォールバック処理
        console.log('🔄 フォールバックモードで再試行...');
        await initFallbackMode();
    }
}

/**
 * レガシー互換性エイリアス設定
 */
async function setupLegacyAliases() {
    try {
        // 既存コードで参照される可能性のあるグローバル変数
        window.futabaApp = futabaApp;
        
        // Manager参照エイリアス
        uiManager = futabaApp.getManager('ui');
        toolManager = futabaApp.getManager('tool');
        historyManager = futabaApp.getManager('memory')?.historyManager;
        
        // グローバルに公開（既存コード互換）
        window.uiManager = uiManager;
        window.toolManager = toolManager;
        window.historyManager = historyManager;
        
        // 既存drawing-tools.jsとの互換性
        if (typeof window.setupDrawingTools === 'function') {
            window.setupDrawingTools(futabaApp);
        }
        
        console.log('✅ レガシー互換性エイリアス設定完了');
    } catch (error) {
        console.warn('⚠️ レガシーエイリアス設定エラー:', error);
    }
}

/**
 * UI統合セットアップ
 */
async function setupUIIntegration() {
    try {
        // 既存ポップアップシステムとの統合
        await integratePopupSystem();
        
        // 既存スライダーシステムとの統合
        await integrateSliderSystem();
        
        // 既存ボタンシステムとの統合
        await integrateButtonSystem();
        
        // ステータスバー統合
        await integrateStatusBar();
        
        console.log('✅ UI統合セットアップ完了');
    } catch (error) {
        console.error('❌ UI統合セットアップエラー:', error);
    }
}

/**
 * ポップアップシステム統合
 */
async function integratePopupSystem() {
    // ペンツール設定ポップアップ
    const penToolButton = document.getElementById('pen-tool');
    const penSettings = document.getElementById('pen-settings');
    
    if (penToolButton && penSettings) {
        penToolButton.addEventListener('click', () => {
            // UIManagerを通じてポップアップ表示
            const uiManager = futabaApp.getManager('ui');
            if (uiManager && uiManager.togglePopup) {
                uiManager.togglePopup('pen-settings');
            } else {
                // フォールバック: 既存実装
                penSettings.classList.toggle('show');
            }
        });
    }
    
    // リサイズツール設定ポップアップ
    const resizeToolButton = document.getElementById('resize-tool');
    const resizeSettings = document.getElementById('resize-settings');
    
    if (resizeToolButton && resizeSettings) {
        resizeToolButton.addEventListener('click', () => {
            const uiManager = futabaApp.getManager('ui');
            if (uiManager && uiManager.togglePopup) {
                uiManager.togglePopup('resize-settings');
            } else {
                resizeSettings.classList.toggle('show');
            }
        });
    }
}

/**
 * スライダーシステム統合
 */
async function integrateSliderSystem() {
    // ペンサイズスライダー統合
    const sizeSlider = document.getElementById('pen-size-slider');
    if (sizeSlider) {
        const toolManager = futabaApp.getManager('tool');
        
        // 既存のスライダーイベントをToolManagerに連携
        const handleSizeChange = (value) => {
            if (toolManager && toolManager.setBrushSize) {
                toolManager.setBrushSize(value);
            }
        };
        
        // 既存のui-manager.jsのスライダーイベントと連携
        if (window.setupSlider) {
            window.setupSlider(sizeSlider, 16, 1, 100, handleSizeChange);
        }
    }
    
    // 不透明度スライダー統合
    const opacitySlider = document.getElementById('pen-opacity-slider');
    if (opacitySlider) {
        const toolManager = futabaApp.getManager('tool');
        
        const handleOpacityChange = (value) => {
            if (toolManager && toolManager.setBrushOpacity) {
                toolManager.setBrushOpacity(value);
            }
        };
        
        if (window.setupSlider) {
            window.setupSlider(opacitySlider, 85, 0, 100, handleOpacityChange);
        }
    }
}

/**
 * ボタンシステム統合
 */
async function integrateButtonSystem() {
    const toolManager = futabaApp.getManager('tool');
    const uiManager = futabaApp.getManager('ui');
    
    // ペンツールボタン
    const penTool = document.getElementById('pen-tool');
    if (penTool) {
        penTool.addEventListener('click', () => {
            if (toolManager) {
                toolManager.setTool('pen');
            }
            updateToolButtonStates('pen');
        });
    }
    
    // 消しゴムツールボタン
    const eraserTool = document.getElementById('eraser-tool');
    if (eraserTool) {
        eraserTool.addEventListener('click', () => {
            if (toolManager) {
                toolManager.setTool('eraser');
            }
            updateToolButtonStates('eraser');
        });
    }
    
    // リサイズボタン統合
    setupResizeButtons();
}

/**
 * ツールボタンの状態更新
 */
function updateToolButtonStates(activeTool) {
    const tools = ['pen-tool', 'eraser-tool'];
    
    tools.forEach(toolId => {
        const button = document.getElementById(toolId);
        if (button) {
            button.classList.toggle('active', toolId === `${activeTool}-tool`);
        }
    });
    
    // ステータスバー更新
    const currentToolElement = document.getElementById('current-tool');
    if (currentToolElement) {
        const toolNames = {
            pen: 'ベクターペン',
            eraser: '消しゴム'
        };
        currentToolElement.textContent = toolNames[activeTool] || activeTool;
    }
}

/**
 * リサイズボタンセットアップ
 */
function setupResizeButtons() {
    const canvasManager = futabaApp.getManager('canvas');
    
    // プリセットサイズボタン
    document.querySelectorAll('[data-size]').forEach(button => {
        button.addEventListener('click', (e) => {
            const sizeStr = e.target.getAttribute('data-size');
            const [width, height] = sizeStr.split(',').map(Number);
            
            if (canvasManager) {
                canvasManager.setCanvasSize(width, height);
            }
            
            // 入力フィールド更新
            const widthInput = document.getElementById('canvas-width');
            const heightInput = document.getElementById('canvas-height');
            if (widthInput) widthInput.value = width;
            if (heightInput) heightInput.value = height;
        });
    });
    
    // 適用ボタン
    const applyButton = document.getElementById('apply-resize');
    const applyCenterButton = document.getElementById('apply-resize-center');
    
    if (applyButton) {
        applyButton.addEventListener('click', () => {
            applyResize(false);
        });
    }
    
    if (applyCenterButton) {
        applyCenterButton.addEventListener('click', () => {
            applyResize(true);
        });
    }
}

/**
 * リサイズ適用
 */
function applyResize(center = false) {
    const widthInput = document.getElementById('canvas-width');
    const heightInput = document.getElementById('canvas-height');
    
    if (widthInput && heightInput) {
        const width = parseInt(widthInput.value);
        const height = parseInt(heightInput.value);
        
        if (width > 0 && height > 0) {
            const canvasManager = futabaApp.getManager('canvas');
            if (canvasManager) {
                canvasManager.setCanvasSize(width, height);
                
                if (center) {
                    canvasManager.centerCanvas();
                }
            }
            
            // 履歴保存
            const memoryManager = futabaApp.getManager('memory');
            if (memoryManager) {
                memoryManager.saveState();
            }
            
            console.log(`📐 キャンバスリサイズ: ${width}x${height}${center ? ' (中央配置)' : ''}`);
        }
    }
}

/**
 * ステータスバー統合
 */
async function integrateStatusBar() {
    const canvasManager = futabaApp.getManager('canvas');
    const toolManager = futabaApp.getManager('tool');
    const memoryManager = futabaApp.getManager('memory');
    
    // 定期的なステータス更新
    setInterval(() => {
        // FPS更新（MemoryManagerから取得）
        if (memoryManager) {
            const perfStats = memoryManager.getPerformanceStats();
            const fpsElement = document.getElementById('fps');
            if (fpsElement && perfStats) {
                fpsElement.textContent = perfStats.fps || 60;
            }
        }
        
        // GPU使用率（仮想値）
        const gpuElement = document.getElementById('gpu-usage');
        if (gpuElement) {
            const usage = Math.round(30 + Math.random() * 40); // 30-70%の範囲
            gpuElement.textContent = `${usage}%`;
        }
        
        // メモリ使用量
        if (memoryManager) {
            const memStats = memoryManager.getMemoryStats();
            const memoryElement = document.getElementById('memory-usage');
            if (memoryElement && memStats) {
                const totalMB = Math.round(memStats.totalMemory / 1024 / 1024 * 10) / 10;
                memoryElement.textContent = `${totalMB}MB`;
            }
        }
    }, 1000); // 1秒間隔
}

/**
 * イベントハンドラー設定
 */
async function setupEventHandlers() {
    // アプリケーション終了時の処理
    window.addEventListener('beforeunload', () => {
        if (futabaApp && futabaApp.destroy) {
            futabaApp.destroy();
        }
    });
    
    // エラーイベント統合
    window.addEventListener('error', (event) => {
        initStatus.errors.push(event.error);
        console.error('🚨 グローバルエラー:', event.error);
    });
    
    // AppCoreイベントリスナー
    if (futabaApp) {
        futabaApp.on('manager-error', (error) => {
            console.error('🚨 Managerエラー:', error);
        });
        
        futabaApp.on('extension-error', (error) => {
            console.warn('⚠️ 拡張機能エラー:', error);
        });
    }
}

/**
 * 起動完了通知表示
 */
function displayStartupNotification(initTime) {
    // ステータスバーに起動完了メッセージを一時表示
    const statusPanel = document.querySelector('.status-panel');
    if (statusPanel) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--futaba-maroon);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: bold;
            z-index: 9999;
            animation: slideInRight 0.3s ease-out;
        `;
        notification.textContent = `🎉 Phase1起動完了 (${initTime}ms)`;
        
        document.body.appendChild(notification);
        
        // 3秒後に自動削除
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

/**
 * フォールバックモード初期化
 */
async function initFallbackMode() {
    try {
        initStatus.fallbackMode = true;
        console.warn('⚠️ フォールバックモード: 既存システムで起動');
        
        // 最小限のPixiJS初期化
        if (typeof PIXI !== 'undefined') {
            const app = new PIXI.Application({
                width: window.innerWidth - 50,
                height: window.innerHeight,
                backgroundColor: 0xFFFFEE
            });
            
            const canvasContainer = document.getElementById('drawing-canvas');
            if (canvasContainer) {
                canvasContainer.appendChild(app.view);
            }
            
            // 簡易グローバル変数設定
            window.app = app;
            window.stage = app.stage;
        }
        
        // 既存ui-manager.jsの初期化（存在する場合）
        if (typeof window.initUIManager === 'function') {
            window.initUIManager();
        }
        
        // 既存drawing-tools.jsの初期化（存在する場合）
        if (typeof window.initDrawingTools === 'function') {
            window.initDrawingTools();
        }
        
        console.log('✅ フォールバックモード起動完了');
        
    } catch (fallbackError) {
        console.error('❌ フォールバックモードも失敗:', fallbackError);
        initStatus.errors.push(fallbackError);
        
        // 最後の手段: エラーメッセージ表示
        displayFatalError();
    }
}

/**
 * 致命的エラー表示
 */
function displayFatalError() {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #ffebee;
        border: 2px solid #f44336;
        border-radius: 8px;
        padding: 24px;
        max-width: 500px;
        z-index: 10000;
        font-family: monospace;
    `;
    
    errorDiv.innerHTML = `
        <h3 style="color: #d32f2f; margin: 0 0 16px 0;">🚨 アプリケーション起動失敗</h3>
        <p>Phase1システムの起動に失敗しました。</p>
        <p>以下のエラーが発生しています：</p>
        <pre style="background: #f5f5f5; padding: 8px; border-radius: 4px; font-size: 12px; overflow: auto; max-height: 200px;">
${initStatus.errors.map(err => err.message || err).join('\n')}
        </pre>
        <p style="margin-top: 16px;">
            <button onclick="location.reload()" style="background: #1976d2; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                ページを再読み込み
            </button>
        </p>
    `;
    
    document.body.appendChild(errorDiv);
}

// DOM読み込み完了後に初期化実行
document.addEventListener('DOMContentLoaded', initTegakiPhase1);

// モジュールエクスポート（将来のTypeScript対応）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        AppCore, 
        initTegakiPhase1,
        initStatus,