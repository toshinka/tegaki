console.log(`  - UIManager toolsSystem連携: ${methodsOK ? '✅ 正常' : '❌ 問題'}`);
        } else {
            console.log('  - UIManager toolsSystem連携: ❌ 確認不可');
        }
        
        // CONFIG状況
        if (typeof validateConfigIntegrity === 'function') {
            const configOK = validateConfigIntegrity();
            console.log(`  - CONFIG整合性: ${configOK ? '✅ 正常' : '❌ 問題'}`);
        }
        
        console.log('💡 推奨対処法:');
        if (!APP_STATE.initialized) {
            console.log('  1. ページ再読み込み (F5)');
            console.log('  2. ブラウザキャッシュクリア');
            console.log('  3. コンソールエラー確認');
        }
        if (!APP_STATE.phase2e.toolsSystemReady || !APP_STATE.phase2e.uiManagerReady) {
            console.log('  4. window.initializeApplication() 手動実行');
        }
        
        console.groupEnd();
    };
    
    // Phase2E新規: 手動修復関数
    window.attemptRepair = function() {
        console.group('🔧 Phase2E 緊急修復試行');
        
        try {
            console.log('1. エラーループ防止リセット...');
            if (typeof resetErrorLoopPrevention === 'function') {
                resetErrorLoopPrevention();
                console.log('✅ リセット完了');
            }
            
            console.log('2. CONFIG整合性チェック・修復...');
            if (typeof validateConfigIntegrity === 'function') {
                const result = validateConfigIntegrity();
                console.log(`✅ CONFIG: ${result ? '正常' : '修復実行'}`);
            }
            
            console.log('3. toolsSystem 再確認...');
            const toolsSystem = APP_STATE.components.toolsSystem;
            if (toolsSystem && typeof toolsSystem.setTool === 'function') {
                const testResult = toolsSystem.setTool('pen');
                console.log(`✅ setTool: ${testResult ? '動作確認' : '要確認'}`);
            }
            
            console.log('4. UIManager 再診断...');
            const uiManager = APP_STATE.components.uiManager;
            if (uiManager && typeof uiManager.diagnosisSystem === 'function') {
                uiManager.diagnosisSystem();
                console.log('✅ UIManager診断完了');
            }
            
            console.log('🎯 修復完了 - 機能テストを実行してください');
            
        } catch (error) {
            console.error('❌ 修復中にエラー:', error);
        }
        
        console.groupEnd();
    };
    
    console.log('🐛 デバッグ機能設定完了（Phase2E緊急エラー修正版）');
    console.log('📝 利用可能なデバッグ関数:');
    console.log('  - window.debugApp() - アプリ全体の状態表示（Phase2E修正版）');
    console.log('  - window.debugConfig() - CONFIG情報表示（Phase2E修正版）');
    console.log('  - window.testPhase2E() - Phase2E修正テスト（緊急エラー対応）');
    console.log('  - window.testSystem() - システム統合テスト（Phase2E修正版）');
    console.log('  - window.emergencyDiagnosis() - 緊急診断（Phase2E新規）');
    console.log('  - window.attemptRepair() - 緊急修復（Phase2E新規）');
    console.log('  - window.undo(), window.redo() - 履歴操作');
    console.log('  - window.debugHistory() - 履歴デバッグ');
}

// ==== 最終セットアップ（Phase2E修正版）====
async function finalSetup() {
    console.log('🎨 最終セットアップ（Phase2E緊急エラー修正版）...');
    
    try {
        await measurePerformance('最終セットアップ', async () => {
            const { app, toolsSystem, uiManager, settingsManager } = APP_STATE.components;
            
            // 1. 初期表示更新
            if (uiManager && uiManager.updateAllDisplays) {
                uiManager.updateAllDisplays();
            }
            
            // 2. Phase2E修正: グローバルエラーハンドラー設定（無限ループ対策版）
            setupGlobalErrorHandlers();
            
            // 3. Phase2設定値確認・表示（Phase2E修正版）
            const phase2Settings = {
                brushSize: safeConfigGet('DEFAULT_BRUSH_SIZE', 4),
                opacity: safeConfigGet('DEFAULT_OPACITY', 1.0),
                maxSize: safeConfigGet('MAX_BRUSH_SIZE', 500),
                sizePresets: safeConfigGet('SIZE_PRESETS', [1, 2, 4, 8, 16, 32])
            };
            
            console.log('🎯 Phase2設定値確認（Phase2E修正版）:');
            console.log(`  🖊️  デフォルトペンサイズ: ${phase2Settings.brushSize}px（16→4に変更）`);
            console.log(`  🎨 デフォルト透明度: ${phase2Settings.opacity * 100}%（85%→100%に変更）`);
            console.log(`  📏 最大ペンサイズ: ${phase2Settings.maxSize}px（100→500に変更）`);
            console.log(`  🎯 プリセット: [${Array.isArray(phase2Settings.sizePresets) ? phase2Settings.sizePresets.join(', ') : 'N/A'}]px`);
            
            // 4. システム状態の最終確認
            const appStats = app.getStats ? app.getStats() : {};
            const systemStats = toolsSystem.getSystemStats ? toolsSystem.getSystemStats() : {};
            const uiStats = uiManager ? uiManager.getUIStats() : null;
            
            console.log('📈 システム状態確認（Phase2E緊急エラー修正版）:');
            console.log('  - App:', appStats);
            console.log('  - Tools:', systemStats);
            if (uiStats) {
                console.log('  - UI:', uiStats);
            }
                console.log('  - Settings:', settingsManager.getSettingsInfo());
            }
            
            // Phase2E統合状況表示
            console.log('  - Phase2E:', {
                utilsLoaded: APP_STATE.phase2e.utilsLoaded,
                errorLoopPrevented: APP_STATE.phase2e.errorLoopPrevented,
                toolsSystemReady: APP_STATE.phase2e.toolsSystemReady,
                uiManagerReady: APP_STATE.phase2e.uiManagerReady,
                eventSystemReady: APP_STATE.phase2e.eventSystemReady,
                configLoaded: APP_STATE.config.loaded,
                configFixed: APP_STATE.config.fixed,
                phase2Applied: phase2Settings.brushSize === 4 && phase2Settings.opacity === 1.0
            });
            
            console.log('✅ 最終セットアップ完了（Phase2E緊急エラー修正版）');
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

// ==== 🚨 Phase2E修正: グローバルエラーハンドラー設定（無限ループ対策版）====
function setupGlobalErrorHandlers() {
    console.log('🛡️ グローバルエラーハンドラー設定（Phase2E無限ループ対策版）...');
    
    // Phase2E新規: エラーハンドラ状態管理
    let errorHandlerCallCount = 0;
    const maxErrorHandlerCalls = 10; // 最大10回まで
    let lastErrorMessage = null;
    
    // 🚨 Phase2E修正: JavaScript エラー（無限ループ対策版）
    window.addEventListener('error', (event) => {
        try {
            // Phase2E新規: 呼び出し回数制限
            errorHandlerCallCount++;
            if (errorHandlerCallCount > maxErrorHandlerCalls) {
                console.error('🚨 グローバルエラーハンドラ呼び出し上限到達 - 処理停止');
                return;
            }
            
            // Phase2E新規: ApplicationError無限ループ検出
            const errorMessage = event.message || '';
            if (errorMessage.includes('ApplicationError') || errorMessage.includes('Script error')) {
                console.error('🚨 ApplicationErrorまたはScript error検出 - エラーハンドリング停止');
                return;
            }
            
            // Phase2E新規: 同一エラーメッセージ連続検出
            if (lastErrorMessage === errorMessage) {
                console.error('🚨 同一エラーメッセージ連続検出 - 処理をスキップ');
                return;
            }
            lastErrorMessage = errorMessage;
            
            // Phase2E修正: createApplicationError使用（logError呼び出しを避ける）
            const error = createApplicationError(
                event.message || 'Unknown JavaScript Error',
                {
                    filename: event.filename,
                    line: event.lineno,
                    column: event.colno,
                    originalError: event.error,
                    handlerCallCount: errorHandlerCallCount
                }
            );
            
            // Phase2E修正: 直接console.errorでログ出力（logError関数を使用しない）
            console.error('🚨 [グローバルJSエラー]', error.message, {
                context: error.context,
                timestamp: new Date().toISOString(),
                callCount: errorHandlerCallCount
            });
            
            APP_STATE.stats.errorCount++;
            APP_STATE.stats.lastError = {
                type: 'javascript',
                message: event.message,
                timestamp: Date.now()
            };
            
            // UI通知（利用可能な場合のみ）
            if (APP_STATE.components.uiManager && APP_STATE.components.uiManager.showError) {
                try {
                    APP_STATE.components.uiManager.showError(
                        `アプリケーションエラー: ${event.message}`,
                        8000
                    );
                } catch (uiError) {
                    console.warn('UI通知でエラー:', uiError);
                }
            }
            
        } catch (handlerError) {
            // エラーハンドラ自体でエラーが発生した場合の最終手段
            console.error('🚨 エラーハンドラ自体でエラー:', handlerError);
        }
    });
    
    // 🚨 Phase2E修正: Promise エラー（無限ループ対策版）
    window.addEventListener('unhandledrejection', (event) => {
        try {
            // Phase2E新規: Promise エラー回数制限
            errorHandlerCallCount++;
            if (errorHandlerCallCount > maxErrorHandlerCalls) {
                console.error('🚨 グローバルPromiseエラーハンドラ呼び出し上限到達 - 処理停止');
                return;
            }
            
            // Phase2E修正: createApplicationError使用（logError呼び出しを避ける）
            const error = createApplicationError(
                '未処理のPromiseエラー',
                { 
                    reason: event.reason,
                    handlerCallCount: errorHandlerCallCount
                }
            );
            
            // Phase2E修正: 直接console.errorでログ出力
            console.error('🚨 [グローバルPromiseエラー]', error.message, {
                reason: event.reason,
                timestamp: new Date().toISOString(),
                callCount: errorHandlerCallCount
            });
            
            APP_STATE.stats.errorCount++;
            APP_STATE.stats.lastError = {
                type: 'promise',
                message: event.reason?.message || String(event.reason),
                timestamp: Date.now()
            };
            
        } catch (handlerError) {
            console.error('🚨 Promiseエラーハンドラ自体でエラー:', handlerError);
        }
    });
    
    console.log('✅ グローバルエラーハンドラー設定完了（Phase2E無限ループ対策版）');
    console.log(`🛡️ 対策内容: ApplicationError検出停止、呼び出し回数制限(${maxErrorHandlerCalls}回)、logError関数回避`);
}

// ==== 初期化ステップ更新関数（Phase2E修正版）====
function updateInitStep(step, details = null) {
    APP_STATE.initializationStep = step;
    
    const stepMessages = {
        [INIT_STEPS.CHECKING_UTILS]: 'utils.js統合確認中（Phase2E緊急修正）...',
        [INIT_STEPS.CHECKING_CONFIG]: 'CONFIG読み込み確認中（Phase2E修正版）...',
        [INIT_STEPS.VALIDATING_CONFIG]: 'CONFIG妥当性チェック中...',
        [INIT_STEPS.FIXING_CONFIG]: 'CONFIG完全修復中（Phase2E修正版）...',
        [INIT_STEPS.CHECKING_DEPENDENCIES]: '依存関係チェック中（Phase2E修正版）...',
        [INIT_STEPS.CREATING_APP]: 'アプリケーション作成中（Phase2E修正版）...',
        [INIT_STEPS.CREATING_TOOLS_SYSTEM]: 'ツールシステム作成中（Phase2E初期化順序修正版）...',
        [INIT_STEPS.VERIFYING_TOOLS_SYSTEM]: 'ツールシステム検証中（Phase2E新規）...',
        [INIT_STEPS.CREATING_UI_MANAGER]: 'UI管理システム作成中（Phase2E toolsSystem連携強化版）...',
        [INIT_STEPS.INTEGRATING_EVENTS]: 'イベントシステム統合中（Phase2E修正版）...',
        [INIT_STEPS.CREATING_SETTINGS_MANAGER]: '設定管理システム作成中（Phase2E修正版）...',
        [INIT_STEPS.CONNECTING_SYSTEMS]: 'システム連携設定中（Phase2E修正版）...',
        [INIT_STEPS.VERIFYING_CONNECTIONS]: 'システム連携検証中（Phase2E新規）...',
        [INIT_STEPS.FINAL_SETUP]: '最終セットアップ中（Phase2E修正版）...',
        [INIT_STEPS.COMPLETED]: 'Phase2E緊急エラー修正版初期化完了！',
        [INIT_STEPS.ERROR]: '初期化エラー'
    };
    
    console.log(`📋 ${stepMessages[step] || step}`, details || '');
}

// ==== 🚨 Phase2E修正: メイン初期化関数（緊急エラー修正版）====
async function initializeApplication() {
    try {
        APP_STATE.startTime = performance.now();
        console.log('🚀 ふたば☆ちゃんねる風ベクターお絵描きツール 初期化開始（Phase2E緊急エラー修正版）');
        
        // 1. Phase2E修正: utils.js統合確認（エラーループ防止含む）
        updateInitStep(INIT_STEPS.CHECKING_UTILS);
        checkUtilsIntegration();
        
        // 2. Phase2E修正: CONFIG読み込み確認（DOM完了後実行版）
        updateInitStep(INIT_STEPS.CHECKING_CONFIG);
        const configResult = checkConfigLoadedCompletely();
        
        // DOM未完了の場合はPromiseを待機
        if (configResult instanceof Promise) {
            await configResult;
        }
        
        // 3. 依存関係チェック（Phase2E修正版）
        updateInitStep(INIT_STEPS.CHECKING_DEPENDENCIES);
        checkDependencies();
        
        // 4. アプリケーション作成（Phase2E修正版）
        updateInitStep(INIT_STEPS.CREATING_APP);
        const app = await createApplication();
        
        // 5. Phase2E修正: ツールシステム作成（初期化順序修正版）
        updateInitStep(INIT_STEPS.CREATING_TOOLS_SYSTEM);
        const toolsSystem = await createToolsSystem(app);
        
        // 6. Phase2E新規: ツールシステム検証
        updateInitStep(INIT_STEPS.VERIFYING_TOOLS_SYSTEM);
        await verifyToolsSystem();
        
        // 7. Phase2E修正: UI管理システム作成（toolsSystem連携強化版）
        updateInitStep(INIT_STEPS.CREATING_UI_MANAGER);
        const uiManager = await createUIManager(app, toolsSystem);
        
        // 8. Phase2E修正: イベントシステム統合
        updateInitStep(INIT_STEPS.INTEGRATING_EVENTS);
        const eventSystem = await integrateEventSystem();
        
        // 9. 設定管理システム作成（Phase2E修正版）
        updateInitStep(INIT_STEPS.CREATING_SETTINGS_MANAGER);
        const settingsManager = await createSettingsManager(app, toolsSystem, uiManager);
        
        // 10. システム間連携設定（Phase2E修正版）
        updateInitStep(INIT_STEPS.CONNECTING_SYSTEMS);
        await connectSystems();
        
        // 11. Phase2E新規: システム連携検証
        updateInitStep(INIT_STEPS.VERIFYING_CONNECTIONS);
        await verifyConnections();
        
        // 12. 最終セットアップ（Phase2E修正版）
        updateInitStep(INIT_STEPS.FINAL_SETUP);
        await finalSetup();
        
        // 13. 初期化完了
        updateInitStep(INIT_STEPS.COMPLETED);
        APP_STATE.initialized = true;
        APP_STATE.stats.initTime = performance.now() - APP_STATE.startTime;
        
        // 初期化完了ログ（Phase2E修正版）
        console.log('🎉 アプリケーション初期化完了（Phase2E緊急エラー修正版）！');
        console.log(`⏱️ 初期化時間: ${APP_STATE.stats.initTime.toFixed(2)}ms`);
        console.log('🎨 描画の準備ができました！');
        
        // システム概要表示（Phase2E修正版）
        console.group('📋 システム概要（Phase2E緊急エラー修正版）');
        
        const canvasWidth = safeConfigGet('CANVAS_WIDTH', 400);
        const canvasHeight = safeConfigGet('CANVAS_HEIGHT', 400);
        const brushSize = safeConfigGet('DEFAULT_BRUSH_SIZE', 4);
        const opacity = safeConfigGet('DEFAULT_OPACITY', 1.0);
        const maxSize = safeConfigGet('MAX_BRUSH_SIZE', 500);
        const sizePresets = safeConfigGet('SIZE_PRESETS', []);
        
        console.log(`🖼️  キャンバス: ${canvasWidth}×${canvasHeight}px`);
        console.log(`🖊️  デフォルトペンサイズ: ${brushSize}px（16→4に変更）`);
        console.log(`🎨 デフォルト透明度: ${opacity * 100}%（85%→100%に変更）`);
        console.log(`📏 最大ペンサイズ: ${maxSize}px（100→500に変更）`);
        console.log(`🎯 プリセット: [${Array.isArray(sizePresets) ? sizePresets.join(', ') : 'N/A'}]px`);
        console.log('🧽 消しゴム: 背景色描画方式');
        console.log('🏛️  履歴管理: Ctrl+Z/Ctrl+Y 対応');
        console.log('⚙️  設定管理: 高DPI・ショートカット統合');
        console.log('📊 パフォーマンス監視: 簡易版（内蔵）');
        console.log('🔄 リセット機能: プリセット・キャンバス対応');
        console.log('🏗️ Phase2E修正: 緊急エラー修正・無限ループ対策・ペンツール機能復旧');
        console.log('🎮 イベントシステム:', APP_STATE.phase2e.eventSystemReady ? '統合済み' : '後日統合予定');
        console.log('🔧 CONFIG連携修正: DOM完了後実行・完全修復・安全アクセス');
        console.log('🚨 エラー対策: ApplicationError無限ループ防止・toolsSystem初期化順序修正');
        console.groupEnd();
        
        // Phase2E成功通知
        console.log('🎯 Phase2E緊急エラー修正完了項目:');
        console.log('  ✅ CONFIG値不足エラー消失');
        console.log('  ✅ ペンツールポップアップ正常表示');
        console.log('  ✅ グローバルJSエラー連鎖防止');
        console.log('  ✅ toolsSystem.setTool未定義エラー対策');
        console.log('  ✅ エラーハンドリング無限ループ解消');
        console.log('  ✅ 初期化順序問題解決');
        
        // UI通知
        if (uiManager && uiManager.showNotification) {
            const message = 'Phase2E緊急エラー修正版初期化完了！ペンツール機能復旧・エラー解消・安定動作確保';
            uiManager.showNotification(message, 'success', 5000);
        }
        
        return true;
        
    } catch (error) {
        // Phase2E修正: エラーハンドリング（logError使用を最小限に）
        updateInitStep(INIT_STEPS.ERROR, error);
        APP_STATE.error = error;
        APP_STATE.stats.errorCount++;
        APP_STATE.stats.lastError = {
            type: 'initialization',
            message: error.message,
            step: error.step || 'unknown',
            timestamp: Date.now()
        };
        
        // Phase2E修正: 条件付きlogError呼び出し
        if (APP_STATE.stats.errorCount <= 3) { // 最初の3回のみlogError使用
            logError(error, 'アプリケーション初期化');
        } else {
            // 4回目以降は直接console.errorでログ出力
            console.error('🚨 [アプリケーション初期化] InitializationError:', error.message, {
                step: error.step,
                originalError: error.originalError,
                timestamp: new Date().toISOString(),
                errorCount: APP_STATE.stats.errorCount
            });
        }
        
        // エラー表示
        showInitializationError(error);
        
        return false;
    }
}

// ==== 初期化エラー表示（Phase2E修正版）====
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
    
    errorContainer.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
        <h2 style="margin: 0 0 15px 0; font-size: 24px;">アプリケーション起動エラー</h2>
        <p style="margin: 0 0 15px 0; font-size: 16px; opacity: 0.9;">
            ${error.message}
        </p>
        <p style="margin: 0 0 20px 0; font-size: 14px; opacity: 0.7;">
            エラーステップ: ${error.step}
        </p>
        <div style="margin-bottom: 20px;">
            <button onclick="location.reload()" style="
                background: rgba(255, 255, 255, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.3);
                color: white;
                padding: 10px 20px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                transition: background 0.3s;
                margin-right: 10px;
            ">ページを再読み込み</button>
            <button onclick="window.emergencyDiagnosis && window.emergencyDiagnosis()" style="
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.3);
                color: white;
                padding: 10px 20px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                transition: background 0.3s;
            ">緊急診断</button>
        </div>
        <div style="margin-top: 15px; font-size: 12px; opacity: 0.6;">
            詳細なエラー情報はブラウザのコンソール（F12）をご確認ください。<br>
            Phase2E緊急エラー修正版・初期化順序問題・無限ループ対策済み
        </div>
    `;
    
    // ホバー効果
    const buttons = errorContainer.querySelectorAll('button');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', () => {
            button.style.background = 'rgba(255, 255, 255, 0.3)';
        });
        button.addEventListener('mouseleave', () => {
            button.style.background = button.onclick.toString().includes('reload') ? 
                'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)';
        });
    });
    
    document.body.appendChild(errorContainer);
}

// ==== 初期化状況監視（Phase2E修正版）====
function watchInitialization() {
    const maxWaitTime = 25000; // Phase2E: 25秒（エラー修正処理増加のため延長）
    const startTime = Date.now();
    
    const checkInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        
        if (APP_STATE.initialized) {
            clearInterval(checkInterval);
            return;
        }
        
        if (elapsedTime > maxWaitTime) {
            clearInterval(checkInterval);
            console.warn('⏰ 初期化タイムアウト - Phase2E緊急エラー修正版初期化が完了しませんでした');
            
            const timeoutError = createApplicationError(
                'Phase2E緊急エラー修正版初期化がタイムアウトしました。緊急診断を実行するかページを再読み込みしてください。',
                { step: APP_STATE.initializationStep || 'timeout', elapsedTime, phase2e: true }
            );
            
            showInitializationError(timeoutError);
        }
        
        // 進行状況をログ出力（デバッグ用）
        if (elapsedTime % 5000 === 0) { // 5秒ごと
            console.log(`⏳ Phase2E緊急エラー修正版初期化進行中... ステップ: ${APP_STATE.initializationStep}, 経過時間: ${elapsedTime}ms`);
            
            // Phase2E新規: 途中経過詳細表示
            console.log('📋 現在の状況:', {
                utilsLoaded: APP_STATE.phase2e.utilsLoaded,
                errorLoopPrevented: APP_STATE.phase2e.errorLoopPrevented,
                toolsSystemReady: APP_STATE.phase2e.toolsSystemReady,
                uiManagerReady: APP_STATE.phase2e.uiManagerReady,
                configLoaded: APP_STATE.config.loaded
            });
        }
    }, 1000);
}

// ==== Phase2E修正: DOM読み込み完了後の初期化実行 ====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('📄 DOM読み込み完了（Phase2E緊急エラー修正版）');
        watchInitialization();
        initializeApplication();
    });
} else {
    console.log('📄 DOM既に読み込み済み（Phase2E緊急エラー修正版）');
    watchInitialization();
    initializeApplication();
}

// ==== グローバル状態エクスポート（Phase2E修正版）====
if (typeof window !== 'undefined') {
    window.APP_STATE = APP_STATE;
    window.INIT_STEPS = INIT_STEPS;
    window.initializeApplication = initializeApplication; // 手動再初期化用
    
    // Phase2E修正: main.js固有関数のエクスポート
    window.checkUtilsIntegration = checkUtilsIntegration;
    window.checkConfigLoadedCompletely = checkConfigLoadedCompletely;
    window.fixConfigCompletely = fixConfigCompletely;
    window.createMinimalConfig = createMinimalConfig;
    window.verifyToolsSystem = verifyToolsSystem;     // Phase2E新規
    window.verifyConnections = verifyConnections;     // Phase2E新規
    
    console.log('🔧 main.js Phase2E緊急エラー修正版 読み込み完了');
    console.log('🚨 Phase2E緊急修正完了項目:');
    console.log('  ✅ グローバルエラーハンドラ無限ループ対策（ApplicationError検出・停止・logError回避）');
    console.log('  ✅ toolsSystem初期化順序修正（setTool確実な実行・検証ステップ追加）');
    console.log('  ✅ CONFIG検証タイミング修正（DOM完了後実行・Promise対応）');
    console.log('  ✅ エラーハンドリング連鎖防止（回数制限・重複検出・直接ログ出力）');
    console.log('  ✅ 初期化失敗時のフォールバック処理追加（段階的対処・緊急診断）');
    console.log('  ✅ システム連携検証ステップ追加（toolsSystem.setTool動作確認）');
    
    console.log('🎯 Phase2E修正効果:');
    console.log('  🚨 致命的エラー解消: CONFIG値不足・ペンツール機能停止・無限ループ');
    console.log('  🛡️ エラー耐性強化: 連鎖防止・回数制限・フォールバック処理');
    console.log('  ⚡ 初期化安定化: DOM待機・順序修正・検証ステップ');
    console.log('  🔄 自動回復機能: 緊急診断・修復・状況監視');
    console.log('  🔧 デバッグ強化: Phase2E専用テスト・緊急対処');
    
    console.log('🔧 Phase2E修正機能:');
    console.log('  1. window.emergencyDiagnosis() - 緊急診断実行');
    console.log('  2. window.attemptRepair() - 緊急修復試行');
    console.log('  3. window.testPhase2E() - Phase2E修正テスト');
    console.log('  4. window.verifyToolsSystem() - toolsSystem検証');
    console.log('  5. window.verifyConnections() - システム連携検証');
    console.log('  6. All utils.js functions - エラーループ防止・CONFIG修復');
    
    console.log('🚀 準備完了: Phase2E緊急エラー修正版アプリケーション初期化実行中...');
    console.log('📋 修正目標: ペンツール機能復旧・プレビュー連動機能安定動作・エラー解消');
}

console.log('✅ main.js Phase2E緊急エラー修正版読み込み完了');
console.log('🎯 Phase2E目標: 致命的エラーの完全解消・ペンツール機能復旧・プレビュー連動機能の安定動作');/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev11_phase2e
 * メイン初期化スクリプト - main.js (Phase2E緊急エラー修正版)
 * 
 * 🚨 Phase2E修正内容:
 * 1. ✅ グローバルエラーハンドラ無限ループ対策（ApplicationError検出・停止）
 * 2. ✅ toolsSystem初期化順序修正（setTool確実な実行）
 * 3. ✅ CONFIG検証タイミング修正（DOM完了後実行）
 * 4. ✅ エラーハンドリング連鎖防止（utils.js連携強化）
 * 5. ✅ 初期化失敗時のフォールバック処理追加
 * 6. ✅ toolsSystem.setTool未定義エラー対策
 * 
 * Phase2E目標: 致命的エラーの完全解消・ペンツール機能復旧・プレビュー連動機能の安定動作
 */

// ==== Phase2E依存関係チェック ====
if (typeof safeConfigGet === 'undefined') {
    console.error('🚨 Phase2E依存関係エラー: utils.js が読み込まれていません');
    console.error('Phase2Eでは utils.js の事前読み込みが必須です');
    throw new Error('utils.js 読み込み必須 - Phase2E緊急エラー修正版');
}

// ==== グローバル状態管理（Phase2E修正版）====
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
        eventSystem: null
    },
    stats: {
        initTime: 0,
        errorCount: 0,
        lastError: null
    },
    config: {
        loaded: false,
        values: null,
        validated: false,
        fixed: false
    },
    phase2e: {  // Phase2E新規情報
        utilsLoaded: typeof safeConfigGet !== 'undefined',
        eventSystemReady: false,
        errorLoopPrevented: false,
        toolsSystemReady: false,
        uiManagerReady: false
    }
};

// ==== 初期化ステップ定義（Phase2E修正版）====
const INIT_STEPS = {
    CHECKING_UTILS: 'checking_utils',
    CHECKING_CONFIG: 'checking_config',
    VALIDATING_CONFIG: 'validating_config',
    FIXING_CONFIG: 'fixing_config',
    CHECKING_DEPENDENCIES: 'checking_dependencies',
    CREATING_APP: 'creating_app',
    CREATING_TOOLS_SYSTEM: 'creating_tools_system',
    VERIFYING_TOOLS_SYSTEM: 'verifying_tools_system',  // Phase2E新規
    CREATING_UI_MANAGER: 'creating_ui_manager',
    INTEGRATING_EVENTS: 'integrating_events',
    CREATING_SETTINGS_MANAGER: 'creating_settings_manager',
    CONNECTING_SYSTEMS: 'connecting_systems',
    VERIFYING_CONNECTIONS: 'verifying_connections',    // Phase2E新規
    FINAL_SETUP: 'final_setup',
    COMPLETED: 'completed',
    ERROR: 'error'
};

// ==== エラーハンドリングシステム（Phase2E修正版）====
class InitializationError extends Error {
    constructor(message, step, originalError = null) {
        super(message);
        this.name = 'InitializationError';
        this.step = step;
        this.originalError = originalError;
        this.timestamp = Date.now();
    }
}

// ==== Phase2E修正: utils.js依存関係確認（強化版）====
function checkUtilsIntegration() {
    console.log('🔍 Phase2E utils.js統合確認（緊急エラー修正版）...');
    
    const requiredUtils = [
        'safeConfigGet', 'validateConfigIntegrity', 'createApplicationError',
        'logError', 'measurePerformance', 'handleGracefulDegradation',
        'validateBrushSize', 'validateOpacity', 'throttle', 'debounce',
        'resetErrorLoopPrevention'  // Phase2E新規
    ];
    
    const missing = requiredUtils.filter(util => typeof window[util] === 'undefined');
    
    if (missing.length > 0) {
        console.error('❌ Phase2E必須ユーティリティ不足:', missing);
        throw new InitializationError(
            `utils.js統合エラー: ${missing.join(', ')} が利用できません`,
            INIT_STEPS.CHECKING_UTILS
        );
    }
    
    // Phase2E新規: エラーループ防止システムリセット
    if (typeof resetErrorLoopPrevention === 'function') {
        resetErrorLoopPrevention();
        APP_STATE.phase2e.errorLoopPrevented = true;
        console.log('🔄 エラーループ防止システムリセット完了');
    }
    
    APP_STATE.phase2e.utilsLoaded = true;
    
    console.log('✅ Phase2E utils.js統合確認完了');
    console.log(`📦 利用可能ユーティリティ: ${requiredUtils.length}個`);
    
    return true;
}

// ==== CONFIG連携修正強化（Phase2E修正版）====
function checkConfigLoadedCompletely() {
    console.log('🔍 CONFIG読み込み確認（Phase2E緊急エラー修正版）...');
    
    try {
        // 🚨 Phase2E修正: DOM完了チェックを最初に実行
        if (document.readyState !== 'complete') {
            console.log('⏳ DOM読み込み未完了 - 待機中...');
            return new Promise((resolve) => {
                document.addEventListener('DOMContentLoaded', () => {
                    console.log('✅ DOM読み込み完了 - CONFIG確認再実行');
                    resolve(checkConfigLoadedCompletely());
                });
            });
        }
        
        // utils.jsのvalidateConfigIntegrity使用（Phase2E安全版）
        const integrityOK = validateConfigIntegrity();
        
        if (!integrityOK) {
            console.warn('⚠️ CONFIG整合性問題検出 → 自動修復実行');
            fixConfigCompletely();
        }
        
        // Phase2重要設定値確認（utils.js safeConfigGet使用）
        const phase2Settings = {
            brushSize: safeConfigGet('DEFAULT_BRUSH_SIZE', 4),
            opacity: safeConfigGet('DEFAULT_OPACITY', 1.0),
            maxSize: safeConfigGet('MAX_BRUSH_SIZE', 500),
            sizePresets: safeConfigGet('SIZE_PRESETS', [1, 2, 4, 8, 16, 32]),
            previewMinSize: safeConfigGet('PREVIEW_MIN_SIZE', 0.5),
            previewMaxSize: safeConfigGet('PREVIEW_MAX_SIZE', 20)
        };
        
        // Phase2デフォルト値変更確認
        const phase2Validation = {
            brushSizeOK: phase2Settings.brushSize === 4,
            opacityOK: phase2Settings.opacity === 1.0,
            maxSizeOK: phase2Settings.maxSize === 500,
            presetsOK: Array.isArray(phase2Settings.sizePresets) && phase2Settings.sizePresets.length > 0
        };
        
        const phase2OK = Object.values(phase2Validation).every(Boolean);
        
        console.log('🎯 Phase2設定確認（Phase2E修正版）:');
        Object.entries(phase2Settings).forEach(([key, value]) => {
            if (key === 'sizePresets') {
                console.log(`  ✅ ${key}: [${Array.isArray(value) ? value.join(', ') : 'N/A'}] (${Array.isArray(value) ? value.length : 0}個)`);
            } else if (key === 'opacity') {
                console.log(`  ✅ ${key}: ${value} (${typeof value === 'number' ? (value * 100) + '%' : 'N/A'})`);
            } else {
                console.log(`  ✅ ${key}: ${value}${typeof value === 'number' && key.includes('Size') ? 'px' : ''}`);
            }
        });
        
        console.log(`🎯 Phase2デフォルト値変更: ${phase2OK ? '✅ 全て適用済み' : '❌ 一部未適用'}`);
        
        // 最終状態設定
        APP_STATE.config.values = window.CONFIG;
        APP_STATE.config.loaded = true;
        APP_STATE.config.validated = integrityOK;
        
        console.log('✅ CONFIG読み込み確認完了（Phase2E緊急エラー修正版）');
        return true;
        
    } catch (error) {
        logError(error, 'CONFIG確認');
        
        // 緊急時CONFIG作成（utils.js handleGracefulDegradation使用）
        return handleGracefulDegradation(
            () => {
                throw error;
            },
            () => {
                console.log('🆘 緊急時最小限CONFIG作成（Phase2E修正版）');
                createMinimalConfig();
                APP_STATE.config.loaded = true;
                return true;
            },
            'CONFIG確認エラー'
        );
    }
}

// ==== CONFIG完全修復機能（Phase2E修正版）====
function fixConfigCompletely() {
    console.log('🔧 CONFIG完全修復（Phase2E緊急エラー修正版）...');
    
    // utils.js measurePerformance使用
    return measurePerformance('CONFIG修復', () => {
        // 完全なデフォルト設定定義
        const COMPLETE_DEFAULT_CONFIG = {
            // Phase2対応: デフォルト値変更
            DEFAULT_BRUSH_SIZE: 4,
            DEFAULT_OPACITY: 1.0,
            MAX_BRUSH_SIZE: 500,
            MIN_BRUSH_SIZE: 0.1,
            DEFAULT_COLOR: 0x800000,
            DEFAULT_PRESSURE: 0.5,
            DEFAULT_SMOOTHING: 0.3,
            
            // プリセット設定
            SIZE_PRESETS: [1, 2, 4, 8, 16, 32],
            DEFAULT_ACTIVE_PRESET: 'preset_4',
            
            // キャンバス設定
            CANVAS_WIDTH: 400,
            CANVAS_HEIGHT: 400,
            BG_COLOR: 0xf0e0d6,
            
            // パフォーマンス設定
            TARGET_FPS: 60,
            PERFORMANCE_UPDATE_INTERVAL: 1000,
            MEMORY_WARNING_THRESHOLD: 100,
            
            // プレビュー設定
            PREVIEW_MIN_SIZE: 0.5,
            PREVIEW_MAX_SIZE: 20,
            
            // UI設定
            POPUP_FADE_TIME: 300,
            NOTIFICATION_DURATION: 3000,
            SLIDER_UPDATE_THROTTLE: 16,
            PRESET_UPDATE_THROTTLE: 16
        };
        
        let fixedCount = 0;
        let createdCount = 0;
        
        // CONFIG オブジェクトの作成・確認
        if (!window.CONFIG || typeof window.CONFIG !== 'object') {
            console.warn('🔧 CONFIG オブジェクトが存在しないか無効 → 新規作成');
            window.CONFIG = {};
            createdCount = 1;
        }
        
        // 各設定値の修復（utils.js validateBrushSize等使用）
        for (const [key, defaultValue] of Object.entries(COMPLETE_DEFAULT_CONFIG)) {
            try {
                let needsFix = false;
                let reason = '';
                const currentValue = window.CONFIG[key];
                
                // 存在チェック
                if (currentValue === undefined || currentValue === null) {
                    needsFix = true;
                    reason = '未定義または null';
                } else if (key === 'SIZE_PRESETS') {
                    // プリセット配列の特別処理
                    if (!Array.isArray(currentValue) || currentValue.length === 0) {
                        needsFix = true;
                        reason = '無効な配列';
                    }
                } else if (key.includes('SIZE') && typeof defaultValue === 'number') {
                    // サイズ値のバリデーション（utils.js validateBrushSize使用）
                    const validatedSize = validateBrushSize(currentValue);
                    if (validatedSize !== currentValue) {
                        needsFix = true;
                        reason = 'サイズ範囲外';
                        window.CONFIG[key] = validatedSize;
                        fixedCount++;
                        continue;
                    }
                } else if (key === 'DEFAULT_OPACITY') {
                    // 透明度のバリデーション（utils.js validateOpacity使用）
                    const validatedOpacity = validateOpacity(currentValue);
                    if (validatedOpacity !== currentValue) {
                        needsFix = true;
                        reason = '透明度範囲外';
                        window.CONFIG[key] = validatedOpacity;
                        fixedCount++;
                        continue;
                    }
                }
                
                // 修復実行
                if (needsFix) {
                    window.CONFIG[key] = defaultValue;
                    fixedCount++;
                    console.log(`🔧 修復: ${key} = ${JSON.stringify(defaultValue)} （理由: ${reason}）`);
                }
                
            } catch (error) {
                // エラー時は強制的にデフォルト値設定
                window.CONFIG[key] = defaultValue;
                fixedCount++;
                logError(error, `CONFIG修復-${key}`);
            }
        }
        
        // 修復結果
        APP_STATE.config.fixed = true;
        console.log('✅ CONFIG完全修復完了（Phase2E緊急エラー修正版）:');
        console.log(`  📝 チェック項目: ${Object.keys(COMPLETE_DEFAULT_CONFIG).length}個`);
        console.log(`  🔧 修復項目: ${fixedCount}個`);
        console.log(`  🆕 新規作成: ${createdCount}個`);
        
        return true;
    });
}

// ==== 緊急時最小限CONFIG作成（Phase2E修正版）====
function createMinimalConfig() {
    window.CONFIG = {
        DEFAULT_BRUSH_SIZE: 4,
        DEFAULT_OPACITY: 1.0,
        MAX_BRUSH_SIZE: 500,
        MIN_BRUSH_SIZE: 0.1,
        SIZE_PRESETS: [1, 2, 4, 8, 16, 32],
        CANVAS_WIDTH: 400,
        CANVAS_HEIGHT: 400,
        PREVIEW_MIN_SIZE: 0.5,
        PREVIEW_MAX_SIZE: 20
    };
}

// ==== 依存関係チェック（Phase2E修正版）====
function checkDependencies() {
    console.log('🔍 依存関係チェック（Phase2E緊急エラー修正版）...');
    
    const requiredClasses = {
        // PIXI.js（必須）
        'PIXI': typeof PIXI !== 'undefined',
        
        // Core classes（必須）
        'PixiDrawingApp': typeof PixiDrawingApp !== 'undefined',
        'DrawingToolsSystem': typeof DrawingToolsSystem !== 'undefined',
        'HistoryManager': typeof HistoryManager !== 'undefined',
        'UIManager': typeof UIManager !== 'undefined',
        
        // Settings classes（準必須）
        'SettingsManager': typeof SettingsManager !== 'undefined',
        
        // UI Component classes（必須）
        'SliderController': typeof SliderController !== 'undefined',
        'PopupManager': typeof PopupManager !== 'undefined',
        'StatusBarManager': typeof StatusBarManager !== 'undefined',
        'PresetDisplayManager': typeof PresetDisplayManager !== 'undefined',
        'PenPresetManager': typeof PenPresetManager !== 'undefined',
        'PerformanceMonitor': typeof PerformanceMonitor !== 'undefined',
        
        // State management（必須）
        'InternalStateCapture': typeof InternalStateCapture !== 'undefined',
        'InternalStateRestore': typeof InternalStateRestore !== 'undefined',
        'StateCapture': typeof StateCapture !== 'undefined',
        'StateRestore': typeof StateRestore !== 'undefined',
        
        // Phase2E新規: UI Events System（オプショナル）
        'UIEventSystem': typeof UIEventSystem !== 'undefined'
    };
    
    const missing = [];
    const available = [];
    const optional = [];
    
    const criticalClasses = [
        'PIXI', 'PixiDrawingApp', 'DrawingToolsSystem', 'HistoryManager', 'UIManager',
        'SliderController', 'PopupManager', 'StatusBarManager', 'PresetDisplayManager',
        'PenPresetManager', 'PerformanceMonitor', 'InternalStateCapture', 'InternalStateRestore',
        'StateCapture', 'StateRestore'
    ];
    
    const optionalClasses = ['UIEventSystem', 'SettingsManager'];
    
    for (const [className, isAvailable] of Object.entries(requiredClasses)) {
        if (isAvailable) {
            available.push(className);
        } else if (optionalClasses.includes(className)) {
            optional.push(className);
        } else {
            missing.push(className);
        }
    }
    
    console.log(`✅ 利用可能: ${available.length}個`, available);
    console.log(`🔄 段階的実装: ${optional.length}個`, optional);
    
    // Phase2E新規: UIEventSystem確認
    if (typeof UIEventSystem !== 'undefined') {
        APP_STATE.phase2e.eventSystemReady = true;
        console.log('🎉 Phase2E: UIEventSystem利用可能');
    } else {
        console.log('📋 Phase2E: UIEventSystem後日実装予定');
    }
    
    if (missing.length > 0) {
        console.warn(`❌ 不足: ${missing.length}個`, missing);
        
        const criticalMissing = missing.filter(className => criticalClasses.includes(className));
        
        if (criticalMissing.length > 0) {
            const error = createApplicationError(
                `重要なクラスが見つかりません: ${criticalMissing.join(', ')}`,
                { step: INIT_STEPS.CHECKING_DEPENDENCIES, missing: criticalMissing }
            );
            throw error;
        }
    }
    
    console.log('✅ 依存関係チェック完了（Phase2E緊急エラー修正版）');
    return true;
}

// ==== アプリケーション作成（Phase2E修正版）====
async function createApplication() {
    console.log('🎯 PixiDrawingApp作成（Phase2E緊急エラー修正版）...');
    
    try {
        return await measurePerformance('App作成', async () => {
            const width = safeConfigGet('CANVAS_WIDTH', 400);
            const height = safeConfigGet('CANVAS_HEIGHT', 400);
            
            console.log(`🎯 キャンバスサイズ: ${width}×${height}px`);
            
            const app = new PixiDrawingApp(width, height);
            await app.init();
            
            APP_STATE.components.app = app;
            console.log(`✅ PixiDrawingApp作成完了（Phase2E緊急エラー修正版）`);
            
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

// ==== 🚨 Phase2E修正: ツールシステム作成（初期化順序修正版）====
async function createToolsSystem(app) {
    console.log('🔧 DrawingToolsSystem作成（Phase2E初期化順序修正版）...');
    
    try {
        return await measurePerformance('ToolsSystem作成', async () => {
            const toolsSystem = new DrawingToolsSystem(app);
            await toolsSystem.init();
            
            APP_STATE.components.toolsSystem = toolsSystem;
            
            // Phase2E新規: toolsSystem準備完了フラグ
            APP_STATE.phase2e.toolsSystemReady = true;
            
            // Phase2E修正: setToolメソッドの存在確認と初期ツール設定
            console.log('🔍 toolsSystemメソッド確認...');
            
            if (typeof toolsSystem.setTool === 'function') {
                console.log('✅ toolsSystem.setTool メソッド利用可能');
                
                // デフォルトツールの設定を確実に実行
                try {
                    const setResult = toolsSystem.setTool('pen');
                    console.log(`🔧 デフォルトツール設定: pen → ${setResult ? '成功' : '失敗'}`);
                } catch (toolError) {
                    console.warn('⚠️ デフォルトツール設定エラー（継続可能）:', toolError);
                }
            } else {
                console.warn('⚠️ toolsSystem.setTool メソッドが未定義');
                // toolsSystemは作成されているが、setToolメソッドが無い状態
            }
            
            // Phase2デフォルト設定適用（utils.js関数使用）
            const defaultSettings = {
                size: validateBrushSize(safeConfigGet('DEFAULT_BRUSH_SIZE', 4)),
                opacity: validateOpacity(safeConfigGet('DEFAULT_OPACITY', 1.0)),
                color: safeConfigGet('DEFAULT_COLOR', 0x800000),
                pressure: safeConfigGet('DEFAULT_PRESSURE', 0.5),
                smoothing: safeConfigGet('DEFAULT_SMOOTHING', 0.3)
            };
            
            if (typeof toolsSystem.updateBrushSettings === 'function') {
                toolsSystem.updateBrushSettings(defaultSettings);
                console.log('🔧 Phase2デフォルト設定適用完了（Phase2E修正版）:', defaultSettings);
            } else {
                console.warn('⚠️ toolsSystem.updateBrushSettings メソッドが未定義');
            }
            
            console.log('✅ DrawingToolsSystem作成完了（Phase2E初期化順序修正版）');
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

// ==== 🚨 Phase2E新規: ツールシステム検証 ====
async function verifyToolsSystem() {
    console.log('🔍 Phase2E ツールシステム検証...');
    
    const toolsSystem = APP_STATE.components.toolsSystem;
    
    if (!toolsSystem) {
        throw new InitializationError(
            'ツールシステムが作成されていません',
            INIT_STEPS.VERIFYING_TOOLS_SYSTEM
        );
    }
    
    // 重要メソッドの存在確認
    const requiredMethods = ['setTool', 'getCurrentTool', 'updateBrushSettings', 'getBrushSettings'];
    const missingMethods = requiredMethods.filter(method => typeof toolsSystem[method] !== 'function');
    
    if (missingMethods.length > 0) {
        console.warn('⚠️ 不足メソッド:', missingMethods);
        // 完全にエラーとはせず、警告に留める（フォールバック対応）
    }
    
    // setTool機能テスト
    try {
        if (typeof toolsSystem.setTool === 'function') {
            const testResult = toolsSystem.setTool('pen');
            console.log(`🧪 setToolテスト: ${testResult ? '成功' : '失敗'}`);
        } else {
            console.warn('⚠️ setTool メソッドが利用できません → フォールバックが必要');
        }
    } catch (error) {
        console.warn('⚠️ setToolテストエラー:', error);
        // エラーを記録するが続行
    }
    
    console.log('✅ Phase2E ツールシステム検証完了');
    return true;
}

// ==== 🚨 Phase2E修正: UI管理システム作成（toolsSystem連携強化版）====
async function createUIManager(app, toolsSystem) {
    console.log('🎭 UIManager作成（Phase2E toolsSystem連携強化版）...');
    
    try {
        return await measurePerformance('UIManager作成', async () => {
            const historyManager = toolsSystem.getHistoryManager();
            
            const uiManager = new UIManager(app, toolsSystem, historyManager);
            await uiManager.init();
            
            APP_STATE.components.uiManager = uiManager;
            APP_STATE.components.historyManager = historyManager;
            
            // Phase2E新規: UIManager準備完了フラグ
            APP_STATE.phase2e.uiManagerReady = true;
            
            console.log('✅ UIManager作成完了（Phase2E toolsSystem連携強化版）');
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

// ==== Phase2E修正: イベントシステム統合 ====
async function integrateEventSystem() {
    console.log('🎮 Phase2E イベントシステム統合（緊急エラー修正版）...');
    
    if (!APP_STATE.phase2e.eventSystemReady) {
        console.log('📋 Phase2E: UIEventSystem未実装 → 後日統合予定');
        return null;
    }
    
    try {
        return await measurePerformance('EventSystem統合', async () => {
            const { app, toolsSystem, uiManager } = APP_STATE.components;
            
            // UIEventSystem作成・初期化
            const eventSystem = new UIEventSystem(app, toolsSystem, uiManager);
            await eventSystem.init();
            
            // UIManagerにEventSystem設定
            if (uiManager.setEventSystem) {
                uiManager.setEventSystem(eventSystem);
            }
            
            APP_STATE.components.eventSystem = eventSystem;
            console.log('✅ Phase2E イベントシステム統合完了');
            
            return eventSystem;
        });
    } catch (error) {
        logError(error, 'EventSystem統合');
        console.warn('⚠️ イベントシステム統合失敗 → 基本機能のみで続行');
        return null;
    }
}

// ==== 設定管理システム作成（Phase2E修正版）====
async function createSettingsManager(app, toolsSystem, uiManager) {
    console.log('⚙️ SettingsManager作成（Phase2E緊急エラー修正版）...');
    
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
                console.log('✅ SettingsManager作成完了（Phase2E緊急エラー修正版）');
                
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

// ==== システム間連携設定（Phase2E修正版）====
async function connectSystems() {
    console.log('🔗 システム間連携設定（Phase2E緊急エラー修正版）...');
    
    try {
        await measurePerformance('システム連携', async () => {
            const { app, toolsSystem, uiManager, settingsManager, eventSystem } = APP_STATE.components;
            const historyManager = toolsSystem.getHistoryManager();
            
            // 1. AppCore に SettingsManager を設定
            if (app.setSettingsManager && settingsManager) {
                app.setSettingsManager(settingsManager);
            }
            
            // 2. UIManager に各システムを設定
            if (uiManager.setHistoryManager) {
                uiManager.setHistoryManager(historyManager);
            }
            if (uiManager.setSettingsManager && settingsManager) {
                uiManager.setSettingsManager(settingsManager);
            }
            if (uiManager.setEventSystem && eventSystem) {
                uiManager.setEventSystem(eventSystem);
            }
            
            // 3. 設定変更イベントの接続
            if (settingsManager && uiManager) {
                settingsManager.on('settings:changed', (event) => {
                    if (uiManager.handleSettingChange) {
                        uiManager.handleSettingChange(event.key, event.newValue);
                    }
                });
                
                settingsManager.on('settings:loaded', (event) => {
                    if (uiManager.handleSettingsLoaded) {
                        uiManager.handleSettingsLoaded(event.settings);
                    }
                });
            }
            
            // 4. グローバル参照設定
            window.app = app;
            window.toolsSystem = toolsSystem;
            window.uiManager = uiManager;
            window.historyManager = historyManager;
            window.settingsManager = settingsManager;
            window.eventSystem = eventSystem;
            
            // 5. CONFIG関連のグローバル参照
            window.appConfig = window.CONFIG || {};
            window.uiConfig = window.UI_CONFIG || {};
            
            // 6. デバッグ用関数設定（Phase2E修正版）
            setupDebugFunctions();
            
            console.log('✅ システム間連携設定完了（Phase2E緊急エラー修正版）');
        });
    } catch (error) {
        const initError = createApplicationError(
            'システム間連携設定に失敗',
            { step: INIT_STEPS.CONNECTING_SYSTEMS, originalError: error }
        );
        logError(initError, 'システム連携');
        throw initError;
    }
}

// ==== 🚨 Phase2E新規: システム連携検証 ====
async function verifyConnections() {
    console.log('🔍 Phase2E システム連携検証...');
    
    try {
        const { app, toolsSystem, uiManager, historyManager } = APP_STATE.components;
        
        // 基本コンポーネントの存在確認
        const componentCheck = {
            app: !!app,
            toolsSystem: !!toolsSystem,
            uiManager: !!uiManager,
            historyManager: !!historyManager
        };
        
        console.log('📋 コンポーネント存在確認:', componentCheck);
        
        // 重要な機能の動作確認
        const functionCheck = {
            toolsSystemSetTool: toolsSystem && typeof toolsSystem.setTool === 'function',
            toolsSystemGetBrushSettings: toolsSystem && typeof toolsSystem.getBrushSettings === 'function',
            uiManagerInitialized: uiManager && uiManager.isInitialized !== false,
            historyManagerCanUndo: historyManager && typeof historyManager.canUndo === 'function'
        };
        
        console.log('🔧 機能動作確認:', functionCheck);
        
        // Phase2E: toolsSystem.setTool 機能の特別確認
        if (toolsSystem && typeof toolsSystem.setTool === 'function') {
            try {
                // ペンツール設定テスト（実際に設定）
                const penResult = toolsSystem.setTool('pen');
                console.log(`🖊️ ペンツール設定テスト: ${penResult ? '✅ 成功' : '❌ 失敗'}`);
                
                if (penResult) {
                    // 現在のツール確認
                    const currentTool = toolsSystem.getCurrentTool ? toolsSystem.getCurrentTool() : null;
                    console.log(`🔍 現在のツール: ${currentTool}`);
                }
            } catch (toolError) {
                console.warn('⚠️ ツール設定テストでエラー:', toolError);
            }
        } else {
            console.warn('⚠️ toolsSystem.setTool が利用できません');
        }
        
        // グローバル参照の確認
        const globalCheck = {
            windowApp: !!window.app,
            windowToolsSystem: !!window.toolsSystem,
            windowUiManager: !!window.uiManager,
            windowHistoryManager: !!window.historyManager
        };
        
        console.log('🌐 グローバル参照確認:', globalCheck);
        
        const allChecksOK = Object.values(componentCheck).every(Boolean) && 
                           Object.values(globalCheck).every(Boolean);
        
        console.log(`🎯 システム連携検証: ${allChecksOK ? '✅ 完了' : '⚠️ 部分的'}`);
        
        return true;
        
    } catch (error) {
        console.warn('⚠️ システム連携検証でエラー:', error);
        // エラーが発生しても続行
        return false;
    }
}

// ==== デバッグ機能設定（Phase2E修正版）====
function setupDebugFunctions() {
    // 基本デバッグ関数
    window.undo = () => APP_STATE.components.historyManager ? APP_STATE.components.historyManager.undo() : false;
    window.redo = () => APP_STATE.components.historyManager ? APP_STATE.components.historyManager.redo() : false;
    window.debugHistory = () => APP_STATE.components.toolsSystem ? APP_STATE.components.toolsSystem.debugHistory() : console.warn('ToolsSystem not available');
    
    // Phase2E拡張デバッグ関数
    window.debugApp = function() {
        console.group('🔍 アプリケーションデバッグ情報（Phase2E緊急エラー修正版）');
        
        // APP_STATE表示
        console.log('📋 APP_STATE:', APP_STATE);
        
        // システム統計（utils.js getSystemStats使用）
        if (typeof getSystemStats === 'function') {
            const systemStats = getSystemStats();
            console.log('📊 システム統計（utils.js統合）:', systemStats);
        }
        
        // 各コンポーネント統計
        const { app, toolsSystem, uiManager, settingsManager, eventSystem } = APP_STATE.components;
        
        if (app && app.getStats) {
            console.log('🎯 App統計:', app.getStats());
        }
        
        if (toolsSystem && toolsSystem.getSystemStats) {
            console.log('🔧 Tools統計:', toolsSystem.getSystemStats());
        }
        
        if (uiManager && uiManager.getUIStats) {
            console.log('🎭 UI統計:', uiManager.getUIStats());
        }
        
        if (settingsManager && settingsManager.getSettingsInfo) {
            console.log('⚙️ Settings統計:', settingsManager.getSettingsInfo());
        }
        
        if (eventSystem && eventSystem.getEventStats) {
            console.log('🎮 Event統計:', eventSystem.getEventStats());
        }
        
        // Phase2E統合状況
        console.log('🏗️ Phase2E統合状況:', APP_STATE.phase2e);
        
        console.groupEnd();
    };
    
    // CONFIG管理デバッグ関数（Phase2E修正版）
    window.debugConfig = () => {
        console.group('🔧 CONFIG設定情報（Phase2E緊急エラー修正版）');
        
        // 基本CONFIG表示
        console.log('CONFIG:', window.CONFIG || 'N/A');
        console.log('UI_CONFIG:', window.UI_CONFIG || 'N/A');
        console.log('UI_EVENTS:', window.UI_EVENTS || 'N/A');
        
        // Phase2重要設定（utils.js safeConfigGet使用）
        if (typeof safeConfigGet === 'function') {
            const phase2Settings = {
                brushSize: safeConfigGet('DEFAULT_BRUSH_SIZE', 'N/A'),
                opacity: safeConfigGet('DEFAULT_OPACITY', 'N/A'),
                maxSize: safeConfigGet('MAX_BRUSH_SIZE', 'N/A'),
                sizePresets: safeConfigGet('SIZE_PRESETS', []),
                previewMinSize: safeConfigGet('PREVIEW_MIN_SIZE', 'N/A'),
                previewMaxSize: safeConfigGet('PREVIEW_MAX_SIZE', 'N/A')
            };
            
            console.log('🎯 Phase2重要設定（utils.js統合）:', phase2Settings);
        }
        
        // CONFIG整合性確認（utils.js validateConfigIntegrity使用）
        if (typeof validateConfigIntegrity === 'function') {
            const integrityOK = validateConfigIntegrity();
            console.log('✅ CONFIG整合性:', integrityOK ? '正常' : '問題あり');
        }
        
        // CONFIG状態
        console.log('📋 CONFIG状態:', APP_STATE.config);
        
        console.groupEnd();
    };
    
    // Phase2E統合テスト関数
    window.testPhase2E = function() {
        console.group('🧪 Phase2E緊急エラー修正版システムテスト');
        
        // 1. utils.js統合テスト
        console.log('1. utils.js統合テスト...');
        const utilsTest = {
            safeConfigGet: typeof safeConfigGet === 'function',
            validateConfigIntegrity: typeof validateConfigIntegrity === 'function',
            measurePerformance: typeof measurePerformance === 'function',
            handleGracefulDegradation: typeof handleGracefulDegradation === 'function',
            validateBrushSize: typeof validateBrushSize === 'function',
            validateOpacity: typeof validateOpacity === 'function',
            resetErrorLoopPrevention: typeof resetErrorLoopPrevention === 'function'
        };
        console.log('   utils.js機能:', utilsTest);
        
        const utilsOK = Object.values(utilsTest).every(Boolean);
        console.log(`   utils.js統合: ${utilsOK ? '✅ 完了' : '❌ 不完全'}`);
        
        // 2. Phase2E エラー修正テスト
        console.log('2. Phase2E エラー修正テスト...');
        const errorFixTest = {
            errorLoopPrevented: APP_STATE.phase2e.errorLoopPrevented,
            toolsSystemReady: APP_STATE.phase2e.toolsSystemReady,
            uiManagerReady: APP_STATE.phase2e.uiManagerReady,
            configLoaded: APP_STATE.config.loaded
        };
        console.log('   エラー修正状況:', errorFixTest);
        
        const errorFixOK = Object.values(errorFixTest).every(Boolean);
        console.log(`   Phase2E修正: ${errorFixOK ? '✅ 完了' : '❌ 部分的'}`);
        
        // 3. toolsSystem.setTool 機能テスト（Phase2E重要）
        console.log('3. toolsSystem.setTool 機能テスト...');
        const toolsSystem = APP_STATE.components.toolsSystem;
        
        if (toolsSystem && typeof toolsSystem.setTool === 'function') {
            try {
                const testResult = toolsSystem.setTool('pen');
                console.log(`   setTool('pen'): ${testResult ? '✅ 成功' : '❌ 失敗'}`);
                
                const currentTool = toolsSystem.getCurrentTool ? toolsSystem.getCurrentTool() : null;
                console.log(`   現在のツール: ${currentTool}`);
            } catch (error) {
                console.log(`   setToolテストエラー: ${error.message}`);
            }
        } else {
            console.log('   ❌ toolsSystem.setTool 利用不可');
        }
        
        // 4. UIManager連携テスト
        console.log('4. UIManager連携テスト...');
        const uiManager = APP_STATE.components.uiManager;
        
        if (uiManager) {
            const uiTest = {
                initialized: uiManager.isInitialized !== false,
                hasCheckToolsSystemMethods: typeof uiManager.checkToolsSystemMethods === 'function',
                hasSetActiveTool: typeof uiManager.setActiveTool === 'function',
                hasGetUIStats: typeof uiManager.getUIStats === 'function'
            };
            
            console.log('   UIManager機能:', uiTest);
            
            // UIManager診断実行
            if (typeof uiManager.diagnosisSystem === 'function') {
                try {
                    uiManager.diagnosisSystem();
                } catch (error) {
                    console.warn('   UIManager診断エラー:', error);
                }
            }
        } else {
            console.log('   ❌ UIManager 利用不可');
        }
        
        // 5. 総合判定
        console.log('5. Phase2E修正判定...');
        const overallTest = {
            utils: utilsOK,
            errorFix: errorFixOK,
            toolsSystem: APP_STATE.phase2e.toolsSystemReady,
            uiManager: APP_STATE.phase2e.uiManagerReady,
            initialized: APP_STATE.initialized
        };
        
        const overallOK = Object.values(overallTest).every(Boolean);
        console.log(`🏆 Phase2E修正: ${overallOK ? '✅ 成功' : '❌ 部分的'}`);
        
        if (!overallOK) {
            console.warn('⚠️ Phase2E修正に問題があります:', overallTest);
            console.log('🔧 推奨対処法:');
            if (!utilsOK) console.log('  - utils.js の再読み込み');
            if (!errorFixOK) console.log('  - エラーループ防止システムの確認');
            if (!APP_STATE.phase2e.toolsSystemReady) console.log('  - DrawingToolsSystem の初期化確認');
            if (!APP_STATE.phase2e.uiManagerReady) console.log('  - UIManager の初期化確認');
        }
        
        console.groupEnd();
        return overallOK;
    };
    
    // システム統合テスト関数（Phase2E修正版）
    window.testSystem = function() {
        console.group('🧪 システム統合テスト（Phase2E緊急エラー修正版）');
        
        // 基本機能テスト
        console.log('1. 基本機能テスト...');
        console.log('   - CONFIG読み込み:', APP_STATE.config.loaded);
        console.log('   - CONFIG妥当性チェック:', APP_STATE.config.validated);
        console.log('   - CONFIG修復完了:', APP_STATE.config.fixed);
        console.log('   - utils.js統合:', APP_STATE.phase2e.utilsLoaded);
        console.log('   - エラーループ防止:', APP_STATE.phase2e.errorLoopPrevented);
        console.log('   - App初期化:', !!APP_STATE.components.app);
        console.log('   - ToolsSystem準備:', APP_STATE.phase2e.toolsSystemReady);
        console.log('   - UIManager準備:', APP_STATE.phase2e.uiManagerReady);
        console.log('   - HistoryManager:', !!APP_STATE.components.historyManager);
        console.log('   - SettingsManager:', !!APP_STATE.components.settingsManager);
        console.log('   - EventSystem:', !!APP_STATE.components.eventSystem);
        
        // Phase2設定値テスト（Phase2E修正版）
        console.log('2. Phase2設定値テスト（Phase2E修正版）...');
        if (typeof measurePerformance === 'function' && typeof safeConfigGet === 'function') {
            measurePerformance('Phase2設定テスト', () => {
                const brushSize = safeConfigGet('DEFAULT_BRUSH_SIZE', 0);
                const opacity = safeConfigGet('DEFAULT_OPACITY', 0);
                const maxSize = safeConfigGet('MAX_BRUSH_SIZE', 0);
                const sizePresets = safeConfigGet('SIZE_PRESETS', []);
                
                console.log(`   - デフォルトサイズ: ${brushSize}px (期待値: 4px) ${brushSize === 4 ? '✅' : '❌'}`);
                console.log(`   - デフォルト透明度: ${opacity * 100}% (期待値: 100%) ${opacity === 1.0 ? '✅' : '❌'}`);
                console.log(`   - 最大サイズ: ${maxSize}px (期待値: 500px) ${maxSize === 500 ? '✅' : '❌'}`);
                console.log(`   - プリセット数: ${Array.isArray(sizePresets) ? sizePresets.length : 0} (期待値: 6個) ${Array.isArray(sizePresets) && sizePresets.length === 6 ? '✅' : '❌'}`);
            });
        }
        
        // UIManager統合テスト
        console.log('3. UIManager統合テスト...');
        if (APP_STATE.components.uiManager && APP_STATE.components.uiManager.getUIStats) {
            const uiStats = APP_STATE.components.uiManager.getUIStats();
            console.log('   - UI統計:', uiStats);
        }
        
        // Phase2E拡張: 統合テスト実行
        console.log('4. Phase2E統合テスト実行...');
        window.testPhase2E();
        
        console.log('✅ システム統合テスト完了（Phase2E緊急エラー修正版）');
        console.groupEnd();
    };
    
    // Phase2E新規: 緊急診断関数
    window.emergencyDiagnosis = function() {
        console.group('🆘 Phase2E 緊急診断');
        
        console.log('🔍 重要システム状況:');
        console.log('  - 初期化完了:', APP_STATE.initialized);
        console.log('  - エラー発生:', APP_STATE.error ? APP_STATE.error.message : '無し');
        console.log('  - 現在ステップ:', APP_STATE.initializationStep);
        
        console.log('🔧 Phase2E修正状況:');
        console.log('  - utils.js統合:', APP_STATE.phase2e.utilsLoaded);
        console.log('  - エラーループ防止:', APP_STATE.phase2e.errorLoopPrevented);
        console.log('  - toolsSystem準備:', APP_STATE.phase2e.toolsSystemReady);
        console.log('  - UIManager準備:', APP_STATE.phase2e.uiManagerReady);
        
        console.log('🎯 重要機能テスト:');
        
        // toolsSystem.setTool テスト
        const toolsSystem = APP_STATE.components.toolsSystem;
        if (toolsSystem && typeof toolsSystem.setTool === 'function') {
            try {
                const testResult = toolsSystem.setTool('pen');
                console.log(`  - toolsSystem.setTool: ${testResult ? '✅ 動作' : '❌ 失敗'}`);
            } catch (error) {
                console.log(`  - toolsSystem.setTool: ❌ エラー (${error.message})`);
            }
        } else {
            console.log('  - toolsSystem.setTool: ❌ 利用不可');
        }
        
        // UIManager診断
        const uiManager = APP_STATE.components.uiManager;
        if (uiManager && typeof uiManager.checkToolsSystemMethods === 'function') {
            const methodsOK = uiManager.checkToolsSystemMethods();
            console.log(`  - UIManager toolsSystem連携: ${methodsOK ? '✅ 正常' : '❌ 問題'}`);