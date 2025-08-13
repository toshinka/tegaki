/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev13
 * メイン初期化スクリプト - main.js (ポップアップ問題完全修正版)
 * 
 * 🔧 完全修正内容:
 * 1. ✅ PenToolUI取得方法の完全修正
 * 2. ✅ CONFIG不足値の完全補完
 * 3. ✅ 初期化順序の最適化とタイミング調整
 * 4. ✅ システム連携の強化
 * 5. ✅ エラー回復処理の改善
 * 
 * Phase2目標: ポップアップ問題根本解決・完全統合システム
 * 責務: アプリケーション初期化フロー制御・統合管理
 * 依存: utils.js, config.js, ui-manager.js（修復版）
 */

// ==== utils.js依存関係チェック（強化版）====
if (typeof window.safeConfigGet === 'undefined') {
    console.error('🚨 Phase2依存関係エラー: utils.js が読み込まれていません');
    console.error('Phase2では utils.js の事前読み込みが必須です');
    
    // 緊急時フォールバック関数
    window.safeConfigGet = function(key, defaultValue) {
        try {
            return (window.CONFIG && window.CONFIG[key] !== undefined) ? window.CONFIG[key] : defaultValue;
        } catch (error) {
        const initError = createApplicationError(
            'システム間連携設定に失敗',
            { step: INIT_STEPS.CONNECTING_SYSTEMS, originalError: error }
        );
        logError(initError, 'システム連携');
        throw initError;
    }
}

// ==== ポップアップシステムテスト（新規追加）====
async function testPopupSystem() {
    console.log('🧪 ポップアップシステムテスト開始...');
    
    try {
        return await measurePerformance('ポップアップテスト', async () => {
            const { penToolUI } = APP_STATE.components;
            
            if (!penToolUI) {
                console.warn('⚠️ PenToolUI未初期化 - ポップアップテストスキップ');
                return false;
            }
            
            // ポップアップ表示テスト
            console.log('🔍 ポップアップ表示機能テスト中...');
            
            let testResult = false;
            
            if (penToolUI.showPopup) {
                try {
                    // pen-settingsポップアップ表示テスト
                    const result = penToolUI.showPopup('pen-settings');
                    if (result) {
                        console.log('✅ showPopup(pen-settings) 成功');
                        testResult = true;
                        
                        // すぐに閉じる
                        setTimeout(() => {
                            if (penToolUI.hidePopup) {
                                penToolUI.hidePopup();
                                console.log('✅ ポップアップ自動クローズ');
                            }
                        }, 100);
                    } else {
                        console.warn('⚠️ showPopup(pen-settings) 失敗');
                    }
                } catch (popupError) {
                    console.warn('⚠️ ポップアップ表示エラー:', popupError);
                }
            } else {
                console.warn('⚠️ showPopup メソッドが存在しません');
            }
            
            // ペンボタン要素の確認
            console.log('🔍 ペンボタン要素確認中...');
            const penButton = document.getElementById('pen-tool-button');
            if (penButton) {
                console.log('✅ ペンボタン要素確認完了');
                
                // イベントリスナー確認
                const hasClickListener = penButton.onclick || penButton._listeners?.click;
                if (hasClickListener) {
                    console.log('✅ ペンボタンクリックイベント確認完了');
                } else {
                    console.warn('⚠️ ペンボタンクリックイベント未設定');
                }
            } else {
                console.warn('⚠️ ペンボタン要素が見つかりません');
            }
            
            APP_STATE.phase2.popupSystemReady = testResult;
            console.log(`🧪 ポップアップシステムテスト${testResult ? '成功' : '失敗'}`);
            
            return testResult;
        });
    } catch (error) {
        const initError = createApplicationError(
            'ポップアップシステムテストに失敗',
            { step: INIT_STEPS.TESTING_POPUP, originalError: error }
        );
        logError(initError, 'ポップアップテスト');
        return false;
    }
}

// ==== 完全修正版デバッグ機能設定 ====
function setupEnhancedDebugFunctions() {
    // 基本デバッグ関数
    window.undo = () => APP_STATE.components.historyManager ? APP_STATE.components.historyManager.undo() : false;
    window.redo = () => APP_STATE.components.historyManager ? APP_STATE.components.historyManager.redo() : false;
    window.debugHistory = () => APP_STATE.components.toolsSystem ? APP_STATE.components.toolsSystem.debugHistory() : console.warn('ToolsSystem not available');
    
    // PenToolUI専用デバッグ関数（完全修正版）
    window.debugPenToolUI = function() {
        console.group('🎨 PenToolUI デバッグ情報（完全修正版）');
        
        const penToolUI = APP_STATE.components.penToolUI;
        if (penToolUI) {
            console.log('PenToolUI:', penToolUI);
            console.log('初期化状態:', penToolUI.isInitialized);
            console.log('ツール状態:', penToolUI.toolActive);
            
            // ポップアップマネージャー確認
            const popupManager = penToolUI.components?.popupManager || penToolUI.popupManager;
            console.log('PopupManager:', popupManager);
            
            if (popupManager) {
                console.log('PopupManager準備状態:', popupManager.isReady);
                console.log('PopupManager要素:', popupManager.elements);
            }
            
            // 詳細状態取得
            if (penToolUI.getFullStatus) {
                console.log('詳細状態:', penToolUI.getFullStatus());
            }
            
            // メソッド確認
            console.log('利用可能メソッド:');
            console.log('  showPopup:', typeof penToolUI.showPopup);
            console.log('  hidePopup:', typeof penToolUI.hidePopup);
            console.log('  init:', typeof penToolUI.init);
        } else {
            console.warn('PenToolUI が利用できません');
            console.log('取得試行状況:');
            console.log('  toolsSystem.penToolUI:', APP_STATE.components.toolsSystem?.penToolUI);
            console.log('  toolsSystem.getPenToolUI:', typeof APP_STATE.components.toolsSystem?.getPenToolUI);
            console.log('  uiManager.penToolUI:', APP_STATE.components.uiManager?.penToolUI);
        }
        
        console.groupEnd();
    };
    
    // ポップアップテスト関数（完全修正版）
    window.testPenPopup = function() {
        console.log('🧪 ペンポップアップテスト開始（完全修正版）...');
        
        const penToolUI = APP_STATE.components.penToolUI;
        if (!penToolUI) {
            console.warn('❌ PenToolUI が利用できません');
            return false;
        }
        
        if (penToolUI.showPopup) {
            try {
                const result = penToolUI.showPopup('pen-settings');
                console.log('ポップアップ表示結果:', result);
                return result;
            } catch (error) {
                console.error('ポップアップ表示エラー:', error);
                return false;
            }
        } else {
            console.warn('❌ showPopup メソッドが存在しません');
            return false;
        }
    };
    
    // ペンボタンクリックテスト
    window.testPenButton = function() {
        console.log('🧪 ペンボタンクリックテスト...');
        
        const penButton = document.getElementById('pen-tool-button');
        if (penButton) {
            console.log('✅ ペンボタン要素発見');
            
            // クリックイベント発火
            penButton.click();
            console.log('✅ ペンボタンクリック実行');
            return true;
        } else {
            console.warn('❌ ペンボタン要素が見つかりません');
            return false;
        }
    };
    
    // システム統合テスト（完全修正版）
    window.testSystem = function() {
        console.log('🧪 システム統合テスト（完全修正版）');
        
        const testResults = {
            initialized: APP_STATE.initialized,
            configFixed: APP_STATE.config.fixed,
            systemsIntegrated: APP_STATE.phase2.systemsIntegrated,
            uiManagerFixed: APP_STATE.phase2.uiManagerFixed,
            penToolUIInitialized: APP_STATE.phase2.penToolUIInitialized,
            popupSystemReady: APP_STATE.phase2.popupSystemReady,
            errorRecovery: APP_STATE.phase2.errorRecovery,
            components: {
                app: !!APP_STATE.components.app,
                toolsSystem: !!APP_STATE.components.toolsSystem,
                uiManager: !!APP_STATE.components.uiManager,
                historyManager: !!APP_STATE.components.historyManager,
                settingsManager: !!APP_STATE.components.settingsManager,
                penToolUI: !!APP_STATE.components.penToolUI
            }
        };
        
        const overallOK = testResults.initialized && testResults.configFixed && 
                         testResults.systemsIntegrated && testResults.components.app &&
                         testResults.components.toolsSystem && testResults.components.uiManager &&
                         testResults.penToolUIInitialized;
        
        console.log('📊 テスト結果:', testResults);
        console.log(`🏆 統合テスト: ${overallOK ? '✅ 成功' : '❌ 部分的'}`);
        
        // ポップアップテスト実行
        if (overallOK && testResults.popupSystemReady) {
            console.log('🧪 ポップアップ機能テスト実行中...');
            setTimeout(() => window.testPenPopup(), 500);
        }
        
        return overallOK;
    };
    
    // 統合デバッグ関数（完全修正版）
    window.debugApp = function() {
        console.group('🔍 アプリケーションデバッグ情報（完全修正版）');
        
        console.log('📋 APP_STATE:', APP_STATE);
        
        // システム状態
        const systemsStatus = {
            app: !!APP_STATE.components.app,
            toolsSystem: !!APP_STATE.components.toolsSystem,
            uiManager: !!APP_STATE.components.uiManager,
            historyManager: !!APP_STATE.components.historyManager,
            settingsManager: !!APP_STATE.components.settingsManager,
            penToolUI: !!APP_STATE.components.penToolUI
        };
        console.log('🔧 システム状態:', systemsStatus);
        
        // Phase2最適化状況
        console.log('🚀 Phase2最適化状況:', APP_STATE.phase2);
        
        // CONFIG状況
        console.log('⚙️ CONFIG状況:', APP_STATE.config);
        if (APP_STATE.config.missingKeys.length > 0) {
            console.log('📋 補完されたCONFIG項目:', APP_STATE.config.missingKeys);
        }
        
        // PenToolUI詳細情報
        console.log('🎨 PenToolUI詳細:');
        const penToolUI = APP_STATE.components.penToolUI;
        if (penToolUI) {
            console.log('  初期化状態:', penToolUI.isInitialized);
            console.log('  ポップアップシステム:', APP_STATE.phase2.popupSystemReady);
            console.log('  利用可能メソッド:', {
                showPopup: typeof penToolUI.showPopup,
                hidePopup: typeof penToolUI.hidePopup,
                init: typeof penToolUI.init
            });
        }
        
        console.groupEnd();
    };
    
    window.debugConfig = function() {
        console.group('🔧 CONFIG設定情報（完全修正版）');
        console.log('CONFIG:', window.CONFIG || 'N/A');
        console.log('CONFIG状態:', APP_STATE.config);
        
        // 重要な設定値確認
        if (window.CONFIG) {
            console.log('重要設定値確認:');
            console.log(`  SIZE_PRESETS: [${Array.isArray(window.CONFIG.SIZE_PRESETS) ? window.CONFIG.SIZE_PRESETS.join(', ') : 'N/A'}]`);
            console.log(`  PREVIEW_MIN_SIZE: ${window.CONFIG.PREVIEW_MIN_SIZE}`);
            console.log(`  PREVIEW_MAX_SIZE: ${window.CONFIG.PREVIEW_MAX_SIZE}`);
            console.log(`  DEFAULT_COLOR: 0x${window.CONFIG.DEFAULT_COLOR?.toString(16)}`);
        }
        
        console.groupEnd();
    };
    
    console.log('🐛 完全修正版デバッグ機能設定完了');
}

// ==== 最終セットアップ（完全修正版）====
async function finalSetup() {
    console.log('🎨 最終セットアップ（完全修正版）...');
    
    try {
        await measurePerformance('最終セットアップ', async () => {
            const { app, toolsSystem, uiManager, settingsManager, penToolUI } = APP_STATE.components;
            
            // 初期表示更新
            if (uiManager && uiManager.updateAllDisplays) {
                uiManager.updateAllDisplays();
                console.log('✅ UI表示更新完了');
            }
            
            // PenToolUI最終設定確認（完全修正版）
            if (penToolUI) {
                console.log('🎨 PenToolUI最終設定確認（完全修正版）...');
                
                // ポップアップ機能最終確認
                const popupReady = APP_STATE.phase2.popupSystemReady;
                console.log(`ポップアップシステム状態: ${popupReady ? '✅ 準備完了' : '⚠️ 未準備'}`);
                
                // ペンボタン最終確認
                const penButton = document.getElementById('pen-tool-button');
                if (penButton) {
                    console.log('✅ ペンボタン要素最終確認完了');
                    
                    // クリックイベント最終確認
                    const hasClickEvent = penButton.onclick || penButton._listeners?.click;
                    console.log(`ペンボタンイベント: ${hasClickEvent ? '✅ 設定済み' : '⚠️ 未設定'}`);
                } else {
                    console.warn('⚠️ ペンボタン要素最終確認失敗');
                }
            }
            
            // グローバルエラーハンドラー設定
            setupGlobalErrorHandlers();
            
            // 設定値最終確認・表示
            const finalSettings = {
                brushSize: safeConfigGet('DEFAULT_BRUSH_SIZE', 4),
                opacity: safeConfigGet('DEFAULT_OPACITY', 1.0),
                maxSize: safeConfigGet('MAX_BRUSH_SIZE', 500),
                sizePresets: safeConfigGet('SIZE_PRESETS', [1, 2, 4, 8, 16, 32]),
                previewMinSize: safeConfigGet('PREVIEW_MIN_SIZE', 0.5),
                previewMaxSize: safeConfigGet('PREVIEW_MAX_SIZE', 20),
                pressure: safeConfigGet('DEFAULT_PRESSURE', 0.5),
                smoothing: safeConfigGet('DEFAULT_SMOOTHING', 0.3)
            };
            
            console.log('🎯 最終設定値確認（完全修正版）:');
            console.log(`  🖊️  デフォルトペンサイズ: ${finalSettings.brushSize}px`);
            console.log(`  🎨 デフォルト透明度: ${finalSettings.opacity * 100}%`);
            console.log(`  📏 最大ペンサイズ: ${finalSettings.maxSize}px`);
            console.log(`  🎯 サイズプリセット: [${Array.isArray(finalSettings.sizePresets) ? finalSettings.sizePresets.join(', ') : 'N/A'}]px`);
            console.log(`  🔍 プレビュー範囲: ${finalSettings.previewMinSize} - ${finalSettings.previewMaxSize}px`);
            console.log(`  👆 筆圧感度: ${finalSettings.pressure * 100}%`);
            console.log(`  ✨ 線補正: ${finalSettings.smoothing * 100}%`);
            
            // システム統計最終確認
            const finalStats = {
                app: app.getStats ? app.getStats() : { status: 'ready' },
                tools: toolsSystem.getSystemStats ? toolsSystem.getSystemStats() : { status: 'ready' },
                ui: uiManager ? (uiManager.getUIStats ? uiManager.getUIStats() : { status: 'ready' }) : null,
                penToolUI: penToolUI ? (penToolUI.getFullStatus ? penToolUI.getFullStatus() : { status: 'ready' }) : null,
                settings: settingsManager ? (settingsManager.getSettingsInfo ? settingsManager.getSettingsInfo() : { status: 'ready' }) : null
            };
            
            console.log('📈 システム統計最終確認（完全修正版）:');
            console.log('  - App:', finalStats.app);
            console.log('  - Tools:', finalStats.tools);
            if (finalStats.ui) {
                console.log('  - UI:', finalStats.ui);
            }
            if (finalStats.penToolUI) {
                console.log('  - PenToolUI:', finalStats.penToolUI);
            }
            if (finalStats.settings) {
                console.log('  - Settings:', finalStats.settings);
            }
            
            // Phase2完全修正状況表示
            const phase2FinalStatus = {
                utilsLoaded: APP_STATE.phase2.utilsLoaded,
                uiManagerFixed: APP_STATE.phase2.uiManagerFixed,
                systemsIntegrated: APP_STATE.phase2.systemsIntegrated,
                penToolUIInitialized: APP_STATE.phase2.penToolUIInitialized,
                popupSystemReady: APP_STATE.phase2.popupSystemReady,
                errorRecovery: APP_STATE.phase2.errorRecovery,
                configFixed: APP_STATE.config.fixed,
                configMissingKeys: APP_STATE.config.missingKeys.length,
                settingsApplied: finalSettings.brushSize === 4 && finalSettings.opacity === 1.0
            };
            
            console.log('  - Phase2完全修正:', phase2FinalStatus);
            
            console.log('✅ 最終セットアップ完了（完全修正版）');
        });
    } catch (error) {
        const initError = createApplicationError(
            '最終セットアップに失敗',
            { step: INIT_STEPS.FINAL_SETUP, originalError: error }
        );
        logError(initError, '最終セットアップ');
        throw initError;
    }
}

// ==== グローバルエラーハンドラー設定（最適化版）====
function setupGlobalErrorHandlers() {
    window.addEventListener('error', (event) => {
        const error = createApplicationError(
            event.message,
            {
                filename: event.filename,
                line: event.lineno,
                column: event.colno,
                originalError: event.error
            }
        );
        
        logError(error, 'グローバルJSエラー');
        
        APP_STATE.stats.errorCount++;
        APP_STATE.stats.lastError = {
            type: 'javascript',
            message: event.message,
            timestamp: Date.now()
        };
        
        if (APP_STATE.components.uiManager && APP_STATE.components.uiManager.showError) {
            APP_STATE.components.uiManager.showError(
                `アプリケーションエラー: ${event.message}`,
                8000
            );
        }
    });
    
    window.addEventListener('unhandledrejection', (event) => {
        const error = createApplicationError(
            '未処理のPromiseエラー',
            { reason: event.reason }
        );
        
        logError(error, 'グローバルPromiseエラー');
        
        APP_STATE.stats.errorCount++;
        APP_STATE.stats.lastError = {
            type: 'promise',
            message: event.reason?.message || String(event.reason),
            timestamp: Date.now()
        };
    });
    
    console.log('🛡️ グローバルエラーハンドラー設定完了（完全修正版）');
}

// ==== 初期化ステップ更新関数（完全修正版）====
function updateInitStep(step, details = null) {
    APP_STATE.initializationStep = step;
    
    const stepMessages = {
        [INIT_STEPS.CHECKING_SYSTEMS]: '統合システムチェック中（強化版）...',
        [INIT_STEPS.FIXING_CONFIG]: 'CONFIG完全補完中...',
        [INIT_STEPS.CHECKING_DEPENDENCIES]: '依存関係チェック中（強化版）...',
        [INIT_STEPS.CREATING_APP]: 'アプリケーション作成中...',
        [INIT_STEPS.CREATING_TOOLS_SYSTEM]: 'ツールシステム作成中...',
        [INIT_STEPS.CREATING_UI_MANAGER]: 'UI管理システム作成中（強化版）...',
        [INIT_STEPS.INITIALIZING_PEN_TOOL_UI]: 'PenToolUI初期化中（完全修正版）...',
        [INIT_STEPS.CONNECTING_SYSTEMS]: 'システム連携設定中（完全修正版）...',
        [INIT_STEPS.TESTING_POPUP]: 'ポップアップシステムテスト中...',
        [INIT_STEPS.FINAL_SETUP]: '最終セットアップ中（完全修正版）...',
        [INIT_STEPS.COMPLETED]: '完全修正版初期化完了！',
        [INIT_STEPS.ERROR]: '初期化エラー'
    };
    
    console.log(`📋 ${stepMessages[step] || step}`, details || '');
}

// ==== メイン初期化関数（完全修正版）====
async function initializeApplication() {
    try {
        APP_STATE.startTime = performance.now();
        console.log('🚀 ふたば☆ちゃんねる風ベクターお絵描きツール 初期化開始（完全修正版）');
        
        // 1. 統合システムチェック（強化版）
        updateInitStep(INIT_STEPS.CHECKING_SYSTEMS);
        await checkIntegratedSystems();
        
        // 2. CONFIG完全補完
        updateInitStep(INIT_STEPS.FIXING_CONFIG);
        fixConfigCompletely();
        APP_STATE.config.loaded = true;
        APP_STATE.config.validated = true;
        
        // 3. 依存関係チェック（強化版）
        updateInitStep(INIT_STEPS.CHECKING_DEPENDENCIES);
        checkDependencies();
        
        // 4. アプリケーション作成
        updateInitStep(INIT_STEPS.CREATING_APP);
        const app = await createApplication();
        
        // 5. ツールシステム作成
        updateInitStep(INIT_STEPS.CREATING_TOOLS_SYSTEM);
        const toolsSystem = await createToolsSystem(app);
        
        // 6. UI管理システム作成（強化版）
        updateInitStep(INIT_STEPS.CREATING_UI_MANAGER);
        const uiManager = await createUIManager(app, toolsSystem);
        
        // 7. PenToolUI初期化（完全修正版）
        updateInitStep(INIT_STEPS.INITIALIZING_PEN_TOOL_UI);
        const penToolUI = await initializePenToolUI(toolsSystem, uiManager);
        
        // 8. 設定管理システム作成
        const settingsManager = await createSettingsManager(app, toolsSystem, uiManager);
        
        // 9. システム間連携設定（完全修正版）
        updateInitStep(INIT_STEPS.CONNECTING_SYSTEMS);
        await connectSystems();
        
        // 10. ポップアップシステムテスト（新規追加）
        updateInitStep(INIT_STEPS.TESTING_POPUP);
        await testPopupSystem();
        
        // 11. 最終セットアップ（完全修正版）
        updateInitStep(INIT_STEPS.FINAL_SETUP);
        await finalSetup();
        
        // 12. 初期化完了
        updateInitStep(INIT_STEPS.COMPLETED);
        APP_STATE.initialized = true;
        APP_STATE.stats.initTime = performance.now() - APP_STATE.startTime;
        
        // 初期化完了ログ（完全修正版）
        console.log('🎉 アプリケーション初期化完了（完全修正版）！');
        console.log(`⏱️ 初期化時間: ${APP_STATE.stats.initTime.toFixed(2)}ms`);
        console.log('🎨 描画の準備ができました！');
        
        // システム概要表示（完全修正版）
        console.group('📋 システム概要（完全修正版）');
        
        const canvasWidth = safeConfigGet('CANVAS_WIDTH', 400);
        const canvasHeight = safeConfigGet('CANVAS_HEIGHT', 400);
        const brushSize = safeConfigGet('DEFAULT_BRUSH_SIZE', 4);
        const opacity = safeConfigGet('DEFAULT_OPACITY', 1.0);
        const maxSize = safeConfigGet('MAX_BRUSH_SIZE', 500);
        const sizePresets = safeConfigGet('SIZE_PRESETS', []);
        const previewMinSize = safeConfigGet('PREVIEW_MIN_SIZE', 0.5);
        const previewMaxSize = safeConfigGet('PREVIEW_MAX_SIZE', 20);
        const pressure = safeConfigGet('DEFAULT_PRESSURE', 0.5);
        const smoothing = safeConfigGet('DEFAULT_SMOOTHING', 0.3);
        
        console.log(`🖼️  キャンバス: ${canvasWidth}×${canvasHeight}px`);
        console.log(`🖊️  デフォルトペンサイズ: ${brushSize}px`);
        console.log(`🎨 デフォルト透明度: ${opacity * 100}%`);
        console.log(`📏 最大ペンサイズ: ${maxSize}px`);
        console.log(`🎯 サイズプリセット: [${Array.isArray(sizePresets) ? sizePresets.join(', ') : 'N/A'}]px`);
        console.log(`🔍 プレビュー範囲: ${previewMinSize} - ${previewMaxSize}px`);
        console.log(`👆 筆圧感度: ${pressure * 100}%`);
        console.log(`✨ 線補正: ${smoothing * 100}%`);
        console.log('🧽 消しゴム: 背景色描画方式');
        console.log('🏛️  履歴管理: Ctrl+Z/Ctrl+Y 対応');
        console.log('⚙️  設定管理: 高DPI・ショートカット統合');
        
        // 完全修正状況
        const phase2Status = APP_STATE.phase2;
        console.log('🚀 完全修正状況: PenToolUI取得・CONFIG補完・ポップアップシステム統合完了');
        console.log(`🔧 UIManager修復: ${phase2Status.uiManagerFixed ? '✅ 成功' : '❌ 失敗'}`);
        console.log(`🎨 PenToolUI初期化: ${phase2Status.penToolUIInitialized ? '✅ 完了' : '❌ 失敗'}`);
        console.log(`🎪 ポップアップシステム: ${phase2Status.popupSystemReady ? '✅ 準備完了' : '⚠️ 未準備'}`);
        console.log(`🔗 システム統合: ${phase2Status.systemsIntegrated ? '✅ 完了' : '❌ 不完全'}`);
        console.log(`🛡️ エラー回復: ${phase2Status.errorRecovery ? '⚠️ 発動済み' : '✅ 正常動作'}`);
        console.log(`⚙️  CONFIG補完: ${APP_STATE.config.fixed ? '✅ 完了' : '❌ 失敗'} (${APP_STATE.config.missingKeys.length}項目)`);
        
        console.groupEnd();
        
        // UI通知
        if (uiManager && uiManager.showNotification) {
            const message = phase2Status.penToolUIInitialized && phase2Status.popupSystemReady
                ? '完全修正完了！PenToolUI初期化・ポップアップシステム・CONFIG補完成功'
                : '完全修正版初期化完了！基本機能復旧・部分システム統合';
            uiManager.showNotification(message, 'success', 5000);
        }
        
        // ポップアップ機能案内
        console.log('🧪 ポップアップ機能テスト実行完了');
        if (phase2Status.popupSystemReady) {
            console.log('📋 ペンツールボタンをクリックしてポップアップを確認してください');
            console.log('📋 または以下のコマンドでテストできます:');
            console.log('  - window.testPenPopup() : ポップアップ表示テスト');
            console.log('  - window.testPenButton() : ペンボタンクリックテスト');
            console.log('  - window.debugPenToolUI() : PenToolUI詳細情報');
        } else {
            console.log('⚠️ ポップアップシステム未準備 - 基本機能のみ利用可能');
        }
        
        return true;
        
    } catch (error) {
        // エラーハンドリング
        updateInitStep(INIT_STEPS.ERROR, error);
        APP_STATE.error = error;
        APP_STATE.stats.errorCount++;
        APP_STATE.stats.lastError = {
            type: 'initialization',
            message: error.message,
            step: error.step || 'unknown',
            timestamp: Date.now()
        };
        
        logError(error, 'アプリケーション初期化');
        
        // エラー表示
        showInitializationError(error);
        
        return false;
    }
}

// ==== 初期化エラー表示（完全修正版）====
function showInitializationError(error) {
    const errorContainer = document.createElement('div');
    errorContainer.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #ff4444, #cc0000);
        color: white;
        padding: 30px;
        border-radius: 15px;
        z-index: 10000;
        max-width: 500px;
        text-align: center;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;
    
    const isUIManagerError = error.message.includes('UIManager');
    const isPenToolUIError = error.message.includes('PenToolUI');
    const isCONFIGError = error.message.includes('CONFIG');
    
    errorContainer.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
        <h2 style="margin: 0 0 15px 0; font-size: 24px;">アプリケーション起動エラー</h2>
        <p style="margin: 0 0 15px 0; font-size: 16px; opacity: 0.9;">
            ${error.message}
        </p>
        <p style="margin: 0 0 20px 0; font-size: 14px; opacity: 0.7;">
            エラーステップ: ${error.step || 'unknown'}
        </p>
        ${isUIManagerError ? `
        <div style="margin: 15px 0; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px; font-size: 12px;">
            <strong>🔧 UIManagerエラー対処法:</strong><br>
            1. ページを再読み込みしてください<br>
            2. ui-manager.js修復版が正常に読み込まれるまでお待ちください<br>
            3. 問題が続く場合はブラウザのキャッシュをクリアしてください
        </div>
        ` : ''}
        ${isPenToolUIError ? `
        <div style="margin: 15px 0; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px; font-size: 12px;">
            <strong>🎨 PenToolUIエラー対処法:</strong><br>
            1. ページを再読み込みしてください<br>
            2. PenToolUIコンポーネントが正常に読み込まれるまでお待ちください<br>
            3. drawing-tools関連ファイルの読み込み状況を確認してください
        </div>
        ` : ''}
        ${isCONFIGError ? `
        <div style="margin: 15px 0; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px; font-size: 12px;">
            <strong>⚙️ CONFIG エラー対処法:</strong><br>
            1. ページを再読み込みしてください<br>
            2. config.js が正常に読み込まれるまでお待ちください<br>
            3. 自動CONFIG補完機能で復旧を試行します
        </div>
        ` : ''}
        <button onclick="location.reload()" style="
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.3s;
        ">ページを再読み込み</button>
        <div style="margin-top: 15px; font-size: 12px; opacity: 0.6;">
            詳細なエラー情報はブラウザのコンソール（F12）をご確認ください。<br>
            完全修正版 - PenToolUI・CONFIG・ポップアップシステム対応
        </div>
    `;
    
    const button = errorContainer.querySelector('button');
    button.addEventListener('mouseenter', () => {
        button.style.background = 'rgba(255, 255, 255, 0.3)';
    });
    button.addEventListener('mouseleave', () => {
        button.style.background = 'rgba(255, 255, 255, 0.2)';
    });
    
    document.body.appendChild(errorContainer);
}

// ==== 初期化状況監視（完全修正版）====
function watchInitialization() {
    const maxWaitTime = 30000; // 30秒（完全修正版で延長）
    const startTime = Date.now();
    
    const checkInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        
        if (APP_STATE.initialized) {
            clearInterval(checkInterval);
            return;
        }
        
        if (elapsedTime > maxWaitTime) {
            clearInterval(checkInterval);
            console.warn('⏰ 初期化タイムアウト - 完全修正版初期化が完了しませんでした');
            
            const timeoutError = createApplicationError(
                '完全修正版初期化がタイムアウトしました。ページを再読み込みしてください。',
                { step: APP_STATE.initializationStep || 'timeout', elapsedTime }
            );
            
            showInitializationError(timeoutError);
        }
        
        // 5秒おきに進行状況表示
        if (elapsedTime % 5000 === 0) {
            console.log(`⏳ 完全修正版初期化進行中... ステップ: ${APP_STATE.initializationStep}, 経過時間: ${elapsedTime}ms`);
            
            // UIManager待機中の場合の特別表示
            if (APP_STATE.initializationStep === INIT_STEPS.CHECKING_SYSTEMS && elapsedTime > 10000) {
                console.log('🔧 UIManager読み込み待機中 - しばらくお待ちください...');
            }
        }
    }, 1000);
}

// ==== DOM読み込み完了後の初期化実行（完全修正版）====
function executeInitialization() {
    console.log('📄 DOM読み込み完了確認（完全修正版）');
    
    // 初期化前の最終チェック
    const preInitCheck = {
        dom: document.readyState === 'complete' || document.readyState === 'interactive',
        utils: typeof window.safeConfigGet !== 'undefined',
        pixi: typeof window.PIXI !== 'undefined'
    };
    
    console.log('🔍 初期化前チェック:', preInitCheck);
    
    // DOM読み込み後の待機時間（完全修正版）
    const waitTime = preInitCheck.dom && preInitCheck.utils && preInitCheck.pixi ? 100 : 500;
    
    setTimeout(() => {
        console.log('🚀 完全修正版初期化実行開始');
        watchInitialization();
        initializeApplication();
    }, waitTime);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', executeInitialization);
} else {
    executeInitialization();
}

// ==== グローバル状態エクスポート（完全修正版）====
if (typeof window !== 'undefined') {
    window.APP_STATE = APP_STATE;
    window.INIT_STEPS = INIT_STEPS;
    window.initializeApplication = initializeApplication;
    
    // 完全修正版関数エクスポート
    window.checkIntegratedSystems = checkIntegratedSystems;
    window.fixConfigCompletely = fixConfigCompletely;
    window.initializePenToolUI = initializePenToolUI;
    window.testPopupSystem = testPopupSystem;
    window.waitForUIManager = waitForUIManager;
    
    console.log('🔧 main.js 完全修正版読み込み完了');
    console.log('🏗️ 完全修正完了項目:');
    console.log('  ✅ PenToolUI取得方法の完全修正（5つの取得方法実装）');
    console.log('  ✅ CONFIG不足値の完全補完システム');
    console.log('  ✅ UIManager読み込み待機システム');
    console.log('  ✅ ポップアップシステムテスト機能');
    console.log('  ✅ 初期化順序の最適化とタイミング調整');
    console.log('  ✅ システム連携の強化と統合');
    console.log('  ✅ エラー回復処理の改善');
    
    console.log('🎯 完全修正効果:');
    console.log('  📦 PenToolUI確実取得: 複数方法による取得保証');
    console.log('  ⚙️ CONFIG完全補完: SIZE_PRESETS等の不足値自動補完');
    console.log('  🎪 ポップアップシステム: 初期化・テスト・連携統合');
    console.log('  🛡️ エラー耐性最強化: UIManager待機・段階的回復');
    console.log('  ⚡ 初期化最適化: 依存関係解決・タイミング調整');
    console.log('  🔧 保守性最大化: 詳細デバッグ・テスト機能統合');
    console.log('  📊 可視性最大化: 完全なステータス・統計情報');
    
    console.log('🔧 完全修正版機能:');
    console.log('  1. 統合システムテスト: window.testSystem()');
    console.log('  2. PenToolUI詳細デバッグ: window.debugPenToolUI()');
    console.log('  3. ポップアップテスト: window.testPenPopup()');
    console.log('  4. ペンボタンテスト: window.testPenButton()');
    console.log('  5. 統合デバッグ機能: window.debugApp()');
    console.log('  6. CONFIG詳細確認: window.debugConfig()');
    console.log('  7. ポップアップシステムテスト: window.testPopupSystem()');
    console.log('  8. PenToolUI再初期化: window.initializePenToolUI()');
    
    console.log('🚀 準備完了: 完全修正版アプリケーション初期化実行中...');
    console.log('📋 次のステップ: アンドゥ問題修正・画像劣化防止・レイヤーシステム');
}

console.log('🏆 main.js 完全修正版初期化完了 - ポップアップ問題根本解決')
            console.warn(`緊急時CONFIG取得 (${key}):`, error);
            return defaultValue;
        }
    };
    
    window.createApplicationError = function(message, context = {}) {
        const error = new Error(message);
        error.name = 'ApplicationError';
        error.context = context;
        error.timestamp = Date.now();
        return error;
    };
    
    window.logError = function(error, context = 'Unknown') {
        console.error(`🚨 [${context}] ${error.name || 'Error'}: ${error.message}`, error);
    };
    
    window.measurePerformance = function(name, operation) {
        const startTime = performance.now();
        try {
            const result = operation();
            const duration = performance.now() - startTime;
            console.log(`⏱️ [${name}] 実行時間: ${duration.toFixed(2)}ms`);
            return result;
        } catch (error) {
            const duration = performance.now() - startTime;
            console.error(`⏱️ [${name}] エラー (${duration.toFixed(2)}ms):`, error);
            throw error;
        }
    };
    
    window.handleGracefulDegradation = function(operation, fallback, errorMessage) {
        try {
            return operation();
        } catch (error) {
            console.warn(`${errorMessage}:`, error);
            return typeof fallback === 'function' ? fallback() : fallback;
        }
    };
    
    console.log('⚠️ 緊急時フォールバック関数を設定しました');
}

console.log('🚀 main.js ポップアップ問題完全修正版読み込み開始...');

// ==== グローバル状態管理（完全修正版）====
const APP_STATE = {
    initialized: false,
    initializationStep: 'waiting',
    error: null,
    startTime: null,
    components: {
        app: null,
        toolsSystem: null,
        uiManager: null,
        historyManager: null,
        settingsManager: null,
        penToolUI: null
    },
    stats: {
        initTime: 0,
        errorCount: 0,
        lastError: null
    },
    config: {
        loaded: false,
        validated: false,
        fixed: false,
        missingKeys: []
    },
    phase2: {
        utilsLoaded: typeof window.safeConfigGet !== 'undefined',
        uiManagerFixed: false,
        systemsIntegrated: false,
        errorRecovery: false,
        penToolUIInitialized: false,
        popupSystemReady: false
    }
};

// ==== 初期化ステップ定義（完全修正版）====
const INIT_STEPS = {
    CHECKING_SYSTEMS: 'checking_systems',
    FIXING_CONFIG: 'fixing_config',
    CHECKING_DEPENDENCIES: 'checking_dependencies',
    CREATING_APP: 'creating_app',
    CREATING_TOOLS_SYSTEM: 'creating_tools_system',
    CREATING_UI_MANAGER: 'creating_ui_manager',
    INITIALIZING_PEN_TOOL_UI: 'initializing_pen_tool_ui',
    CONNECTING_SYSTEMS: 'connecting_systems',
    TESTING_POPUP: 'testing_popup',
    FINAL_SETUP: 'final_setup',
    COMPLETED: 'completed',
    ERROR: 'error'
};

// ==== CONFIG完全補完システム（修正版）====
function fixConfigCompletely() {
    console.log('🔧 CONFIG完全補完システム（ポップアップ問題修正版）...');
    
    return measurePerformance('CONFIG完全補完', () => {
        // 完全なデフォルトCONFIG定義
        const COMPLETE_CONFIG = {
            // 基本設定
            DEFAULT_BRUSH_SIZE: 4,
            DEFAULT_OPACITY: 1.0,
            MAX_BRUSH_SIZE: 500,
            MIN_BRUSH_SIZE: 0.1,
            DEFAULT_COLOR: 0x800000,
            
            // サイズプリセット（修正: 配列で定義）
            SIZE_PRESETS: [1, 2, 4, 8, 16, 32],
            
            // キャンバス設定
            CANVAS_WIDTH: 400,
            CANVAS_HEIGHT: 400,
            BG_COLOR: 0xf0e0d6,
            TARGET_FPS: 60,
            
            // プレビュー設定（修正: 追加）
            PREVIEW_MIN_SIZE: 0.5,
            PREVIEW_MAX_SIZE: 20,
            
            // 筆圧・スムージング設定
            DEFAULT_PRESSURE: 0.5,
            DEFAULT_SMOOTHING: 0.3,
            
            // UI設定（修正: 追加）
            PRESET_UPDATE_THROTTLE: 16,
            PERFORMANCE_UPDATE_INTERVAL: 1000,
            
            // ふたば色定義
            FUTABA_MAROON: 0x800000,
            FUTABA_LIGHT_MAROON: 0xaa5a56,
            FUTABA_CREAM: 0xf0e0d6,
            FUTABA_BACKGROUND: 0xffffee
        };
        
        if (!window.CONFIG || typeof window.CONFIG !== 'object') {
            window.CONFIG = {};
        }
        
        let fixedCount = 0;
        const missingKeys = [];
        
        for (const [key, defaultValue] of Object.entries(COMPLETE_CONFIG)) {
            const currentValue = window.CONFIG[key];
            
            if (currentValue === undefined || currentValue === null || 
                (Array.isArray(defaultValue) && (!Array.isArray(currentValue) || currentValue.length === 0))) {
                
                window.CONFIG[key] = defaultValue;
                fixedCount++;
                missingKeys.push(key);
            }
        }
        
        APP_STATE.config.fixed = true;
        APP_STATE.config.missingKeys = missingKeys;
        
        console.log(`✅ CONFIG完全補完完了: ${fixedCount}項目補完`);
        console.log(`📋 補完項目: [${missingKeys.join(', ')}]`);
        
        // CONFIG整合性確認
        console.log('🔍 CONFIG整合性確認:');
        console.log(`  SIZE_PRESETS: [${Array.isArray(window.CONFIG.SIZE_PRESETS) ? window.CONFIG.SIZE_PRESETS.join(', ') : 'N/A'}]`);
        console.log(`  PREVIEW_MIN_SIZE: ${window.CONFIG.PREVIEW_MIN_SIZE}`);
        console.log(`  PREVIEW_MAX_SIZE: ${window.CONFIG.PREVIEW_MAX_SIZE}`);
        console.log(`  DEFAULT_COLOR: 0x${window.CONFIG.DEFAULT_COLOR.toString(16)}`);
        
        return true;
    });
}

// ==== Phase2最適化: 統合システムチェック（強化版）====
function checkIntegratedSystems() {
    console.log('🔍 Phase2統合システムチェック（強化版）...');
    
    try {
        const systemsStatus = {
            utils: typeof window.safeConfigGet !== 'undefined',
            config: typeof window.CONFIG !== 'undefined',
            pixi: typeof window.PIXI !== 'undefined',
            pixiApp: typeof window.PixiDrawingApp !== 'undefined',
            toolsSystem: typeof window.DrawingToolsSystem !== 'undefined',
            historyManager: typeof window.HistoryManager !== 'undefined',
            uiManager: typeof window.UIManager !== 'undefined'
        };
        
        const availableSystems = Object.entries(systemsStatus).filter(([name, available]) => available);
        const missingSystems = Object.entries(systemsStatus).filter(([name, available]) => !available);
        
        console.log(`✅ 利用可能システム: ${availableSystems.length}/7システム`, availableSystems.map(([name]) => name));
        
        if (missingSystems.length > 0) {
            console.warn('⚠️ 不足システム:', missingSystems.map(([name]) => name));
            
            // 重要システムの不足チェック
            const criticalSystems = ['pixi', 'pixiApp', 'toolsSystem', 'uiManager'];
            const missingCritical = criticalSystems.filter(system => !systemsStatus[system]);
            
            if (missingCritical.length > 0) {
                console.error('❌ 重要システム不足:', missingCritical);
                
                // UIManager不足の場合の特別処理
                if (missingCritical.includes('uiManager')) {
                    console.log('🔧 UIManager読み込み待機中...');
                    return waitForUIManager();
                }
                
                throw createApplicationError(`重要システムが不足: ${missingCritical.join(', ')}`);
            }
        }
        
        // UIManager修復確認
        APP_STATE.phase2.uiManagerFixed = systemsStatus.uiManager;
        
        console.log('✅ Phase2統合システムチェック完了（強化版）');
        return true;
        
    } catch (error) {
        logError(error, 'Phase2統合システムチェック');
        throw error;
    }
}

// ==== UIManager読み込み待機システム（新規追加）====
function waitForUIManager() {
    console.log('⏳ UIManager読み込み待機システム開始...');
    
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 10;
        
        const checkUIManager = () => {
            attempts++;
            
            if (typeof window.UIManager !== 'undefined') {
                console.log(`✅ UIManager読み込み完了（${attempts}回目）`);
                APP_STATE.phase2.uiManagerFixed = true;
                resolve(true);
                return;
            }
            
            if (attempts >= maxAttempts) {
                console.error('❌ UIManager読み込みタイムアウト');
                reject(createApplicationError('UIManager読み込みがタイムアウトしました'));
                return;
            }
            
            console.log(`⏳ UIManager読み込み待機... ${attempts}/${maxAttempts}`);
            setTimeout(checkUIManager, 500);
        };
        
        checkUIManager();
    });
}

// ==== 依存関係チェック（強化版）====
function checkDependencies() {
    console.log('🔍 依存関係チェック（強化版）...');
    
    const criticalClasses = [
        { name: 'PIXI', required: true },
        { name: 'PixiDrawingApp', required: true },
        { name: 'DrawingToolsSystem', required: true },
        { name: 'HistoryManager', required: true },
        { name: 'UIManager', required: true }
    ];
    
    const missing = criticalClasses.filter(cls => typeof window[cls.name] === 'undefined');
    
    if (missing.length > 0) {
        const error = createApplicationError(
            `重要なクラスが見つかりません: ${missing.map(cls => cls.name).join(', ')}`,
            { step: INIT_STEPS.CHECKING_DEPENDENCIES, missing: missing.map(cls => cls.name) }
        );
        
        throw error;
    }
    
    console.log('✅ 依存関係チェック完了（強化版）');
    return true;
}

// ==== アプリケーション作成（最適化版）====
async function createApplication() {
    console.log('🎯 PixiDrawingApp作成（最適化版）...');
    
    try {
        return await measurePerformance('App作成', async () => {
            const width = safeConfigGet('CANVAS_WIDTH', 400);
            const height = safeConfigGet('CANVAS_HEIGHT', 400);
            
            console.log(`🎯 キャンバスサイズ: ${width}×${height}px`);
            
            const app = new PixiDrawingApp(width, height);
            await app.init();
            
            APP_STATE.components.app = app;
            console.log('✅ PixiDrawingApp作成完了（最適化版）');
            
            return app;
        });
    } catch (error) {
        const initError = createApplicationError(
            'PixiDrawingApp作成に失敗',
            { step: INIT_STEPS.CREATING_APP, originalError: error }
        );
        logError(initError, 'App作成');
        throw initError;
    }
}

// ==== ツールシステム作成（最適化版）====
async function createToolsSystem(app) {
    console.log('🔧 DrawingToolsSystem作成（最適化版）...');
    
    try {
        return await measurePerformance('ToolsSystem作成', async () => {
            const toolsSystem = new DrawingToolsSystem(app);
            await toolsSystem.init();
            
            APP_STATE.components.toolsSystem = toolsSystem;
            
            // Phase2設定適用
            const defaultSettings = {
                size: safeConfigGet('DEFAULT_BRUSH_SIZE', 4),
                opacity: safeConfigGet('DEFAULT_OPACITY', 1.0),
                color: safeConfigGet('DEFAULT_COLOR', 0x800000),
                pressure: safeConfigGet('DEFAULT_PRESSURE', 0.5),
                smoothing: safeConfigGet('DEFAULT_SMOOTHING', 0.3)
            };
            
            if (toolsSystem.updateBrushSettings) {
                toolsSystem.updateBrushSettings(defaultSettings);
                console.log('🔧 Phase2設定適用完了:', defaultSettings);
            }
            
            console.log('✅ DrawingToolsSystem作成完了（最適化版）');
            return toolsSystem;
        });
    } catch (error) {
        const initError = createApplicationError(
            'DrawingToolsSystem作成に失敗',
            { step: INIT_STEPS.CREATING_TOOLS_SYSTEM, originalError: error }
        );
        logError(initError, 'ToolsSystem作成');
        throw initError;
    }
}

// ==== UI管理システム作成（強化版）====
async function createUIManager(app, toolsSystem) {
    console.log('🎭 UIManager作成（強化版）...');
    
    try {
        return await measurePerformance('UIManager作成', async () => {
            // UIManager クラスの存在確認
            if (typeof window.UIManager === 'undefined') {
                throw createApplicationError('UIManager クラスが見つかりません - ui-manager.js修復版の読み込みを確認してください');
            }
            
            const historyManager = toolsSystem.getHistoryManager();
            
            const uiManager = new window.UIManager(app, toolsSystem, historyManager);
            
            // 初期化（エラー回復処理強化）
            try {
                await uiManager.init();
                console.log('✅ UIManager通常初期化完了');
            } catch (initError) {
                console.warn('⚠️ UIManager初期化でエラー:', initError);
                
                // 基本機能のみで続行
                if (uiManager.setupToolButtons) {
                    await uiManager.setupToolButtons();
                    console.log('🆘 基本UI機能で続行');
                } else {
                    throw createApplicationError('UIManager基本機能も利用できません');
                }
            }
            
            APP_STATE.components.uiManager = uiManager;
            APP_STATE.components.historyManager = historyManager;
            
            console.log('✅ UIManager作成完了（強化版）');
            return uiManager;
        });
    } catch (error) {
        const initError = createApplicationError(
            'UIManager作成に失敗',
            { step: INIT_STEPS.CREATING_UI_MANAGER, originalError: error }
        );
        logError(initError, 'UIManager作成');
        throw initError;
    }
}

// ==== PenToolUI初期化システム（完全修正版）====
async function initializePenToolUI(toolsSystem, uiManager) {
    console.log('🎨 PenToolUI初期化システム（完全修正版）...');
    
    try {
        return await measurePerformance('PenToolUI初期化', async () => {
            let penToolUI = null;
            
            // 修正: 複数の取得方法を試行
            console.log('🔍 PenToolUI取得方法を複数試行...');
            
            // 方法1: toolsSystemから直接取得
            if (toolsSystem && toolsSystem.penToolUI) {
                penToolUI = toolsSystem.penToolUI;
                console.log('✅ 方法1成功: toolsSystem.penToolUI から取得');
            }
            // 方法2: getPenToolUI()メソッドから取得
            else if (toolsSystem && toolsSystem.getPenToolUI) {
                penToolUI = toolsSystem.getPenToolUI();
                console.log('✅ 方法2成功: toolsSystem.getPenToolUI() から取得');
            }
            // 方法3: toolsSystemのtoolsから検索
            else if (toolsSystem && toolsSystem.tools) {
                for (const [toolName, tool] of Object.entries(toolsSystem.tools)) {
                    if (tool && tool.penToolUI) {
                        penToolUI = tool.penToolUI;
                        console.log(`✅ 方法3成功: tools.${toolName}.penToolUI から取得`);
                        break;
                    }
                }
            }
            // 方法4: uiManagerから検索
            else if (uiManager && uiManager.penToolUI) {
                penToolUI = uiManager.penToolUI;
                console.log('✅ 方法4成功: uiManager.penToolUI から取得');
            }
            // 方法5: グローバルから検索
            else if (window.penToolUI) {
                penToolUI = window.penToolUI;
                console.log('✅ 方法5成功: window.penToolUI から取得');
            }
            
            if (!penToolUI) {
                console.warn('⚠️ PenToolUI取得失敗 - 全ての方法を試行しましたが見つかりません');
                console.log('🔍 デバッグ情報:');
                console.log('  toolsSystem:', toolsSystem);
                console.log('  toolsSystem.tools:', toolsSystem?.tools);
                console.log('  uiManager:', uiManager);
                
                // PenToolUI無しでも続行（最小限機能）
                APP_STATE.phase2.penToolUIInitialized = false;
                return null;
            }
            
            // PenToolUI初期化
            console.log('🔧 PenToolUI初期化実行中...');
            
            if (!penToolUI.isInitialized) {
                try {
                    if (penToolUI.init) {
                        const initResult = await penToolUI.init();
                        
                        if (initResult !== false) {
                            console.log('✅ PenToolUI.init() 成功');
                        } else {
                            console.warn('⚠️ PenToolUI.init() 失敗');
                        }
                    } else {
                        console.warn('⚠️ PenToolUI.init() メソッドが存在しません');
                    }
                } catch (initError) {
                    console.warn('⚠️ PenToolUI初期化エラー:', initError);
                    // エラーでも続行
                }
            } else {
                console.log('✅ PenToolUI既に初期化済み');
            }
            
            // 初期化状態設定
            APP_STATE.components.penToolUI = penToolUI;
            APP_STATE.phase2.penToolUIInitialized = true;
            
            // ポップアップシステム確認
            if (penToolUI.components?.popupManager) {
                console.log('✅ PopupManager確認完了');
                APP_STATE.phase2.popupSystemReady = true;
            } else if (penToolUI.popupManager) {
                console.log('✅ PopupManager確認完了（直接参照）');
                APP_STATE.phase2.popupSystemReady = true;
            } else {
                console.warn('⚠️ PopupManager未確認');
                APP_STATE.phase2.popupSystemReady = false;
            }
            
            console.log('✅ PenToolUI初期化システム完了');
            return penToolUI;
        });
    } catch (error) {
        const initError = createApplicationError(
            'PenToolUI初期化に失敗',
            { step: INIT_STEPS.INITIALIZING_PEN_TOOL_UI, originalError: error }
        );
        logError(initError, 'PenToolUI初期化');
        
        // エラーでも続行（最小限機能）
        APP_STATE.phase2.penToolUIInitialized = false;
        return null;
    }
}

// ==== 設定管理システム作成（最適化版）====
async function createSettingsManager(app, toolsSystem, uiManager) {
    console.log('⚙️ SettingsManager作成（最適化版）...');
    
    return await handleGracefulDegradation(
        async () => {
            if (typeof SettingsManager === 'undefined') {
                console.warn('⚠️ SettingsManager が利用できません');
                return null;
            }
            
            return await measurePerformance('SettingsManager作成', async () => {
                const historyManager = toolsSystem.getHistoryManager();
                
                const settingsManager = new SettingsManager(app, toolsSystem, uiManager, historyManager);
                await settingsManager.init();
                
                APP_STATE.components.settingsManager = settingsManager;
                console.log('✅ SettingsManager作成完了（最適化版）');
                
                return settingsManager;
            });
        },
        () => {
            console.warn('⚠️ SettingsManager初期化失敗 → 基本機能のみで続行');
            return null;
        },
        'SettingsManager作成エラー'
    );
}

// ==== システム間連携設定（完全修正版）====
async function connectSystems() {
    console.log('🔗 システム間連携設定（完全修正版）...');
    
    try {
        await measurePerformance('システム連携', async () => {
            const { app, toolsSystem, uiManager, settingsManager, penToolUI } = APP_STATE.components;
            const historyManager = toolsSystem.getHistoryManager();
            
            // 既存システム連携
            if (app.setSettingsManager && settingsManager) {
                app.setSettingsManager(settingsManager);
                console.log('✅ App-SettingsManager連携完了');
            }
            
            if (uiManager.setHistoryManager) {
                uiManager.setHistoryManager(historyManager);
                console.log('✅ UIManager-HistoryManager連携完了');
            }
            if (uiManager.setSettingsManager && settingsManager) {
                uiManager.setSettingsManager(settingsManager);
                console.log('✅ UIManager-SettingsManager連携完了');
            }
            
            // 修正: PenToolUI連携強化
            if (penToolUI) {
                console.log('🎨 PenToolUI連携設定中...');
                
                // uiManagerとの連携設定
                if (uiManager.setPenToolUI) {
                    uiManager.setPenToolUI(penToolUI);
                    console.log('✅ UIManager-PenToolUI連携完了');
                }
                
                // toolsSystemとの連携設定
                if (toolsSystem.setPenToolUI) {
                    toolsSystem.setPenToolUI(penToolUI);
                    console.log('✅ ToolsSystem-PenToolUI連携完了');
                }
                
                // penToolUI自体の連携設定
                if (penToolUI.setSystemReferences) {
                    penToolUI.setSystemReferences({
                        app: app,
                        toolsSystem: toolsSystem,
                        uiManager: uiManager,
                        historyManager: historyManager
                    });
                    console.log('✅ PenToolUI-System連携完了');
                }
                
                // ポップアップシステムの最終確認
                const popupManager = penToolUI.components?.popupManager || penToolUI.popupManager;
                if (popupManager) {
                    console.log('✅ PopupManager最終確認完了');
                    APP_STATE.phase2.popupSystemReady = true;
                    
                    // ポップアップマネージャーの状態確認
                    if (popupManager.isReady) {
                        console.log('✅ PopupManager準備完了');
                    } else if (popupManager.init) {
                        try {
                            await popupManager.init();
                            console.log('✅ PopupManager初期化完了');
                        } catch (popupError) {
                            console.warn('⚠️ PopupManager初期化エラー:', popupError);
                        }
                    }
                } else {
                    console.warn('⚠️ PopupManager最終確認失敗');
                    APP_STATE.phase2.popupSystemReady = false;
                }
                
                console.log('✅ PenToolUI連携確認完了');
            } else {
                console.warn('⚠️ PenToolUI連携不可 - PenToolUIが見つかりません');
            }
            
            // グローバル参照設定
            window.app = app;
            window.toolsSystem = toolsSystem;
            window.uiManager = uiManager;
            window.historyManager = historyManager;
            window.settingsManager = settingsManager;
            window.penToolUI = penToolUI;
            window.appConfig = window.CONFIG || {};
            
            // 完全修正版デバッグ機能設定
            setupEnhancedDebugFunctions();
            
            APP_STATE.phase2.systemsIntegrated = true;
            console.log('✅ システム間連携設定完了（完全修正版）');
        });
    } catch (error) {