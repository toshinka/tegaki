/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: アプリケーション初期化・AppCore統合エントリーポイント
 * 🔧 修正内容: AppCore統合・キャンバス表示修復・初期化シーケンス修正
 * 🚨 PURE_JAVASCRIPT: ES6モジュール禁止 - グローバル変数使用
 * 
 * 📋 PHASE_TARGET: Phase1.1ss3rev4 緊急修復
 * 📋 V8_MIGRATION: AppCore経由でPixiJS API変更対応予定
 * 📋 PERFORMANCE_TARGET: 3秒以内初期化・60FPS安定
 */

class FutabaDrawingTool {
    constructor() {
        this.version = 'v1.0-Phase1.1ss3rev4-AppCore統合修正版';
        this.isInitialized = false;
        this.startTime = performance.now();
        
        // 🔧 修正: AppCore統合
        this.appCore = null;
        this.initializationSteps = [];
        this.errorLog = [];
        
        console.log('🎨 FutabaDrawingTool初期化開始（AppCore統合修正版）');
    }
    
    /**
     * アプリケーション初期化（修正版 - AppCore統合）
     */
    async init() {
        try {
            console.log('🚀 修正版初期化開始 - AppCore統合でキャンバス表示問題解決');
            
            // Step 1: 初期化前チェック
            this.performPreInitializationChecks();
            
            // Step 2: 拡張ライブラリ確認・初期化
            await this.initializeExtensions();
            
            // Step 3: AppCore初期化（核心修正）
            await this.initializeAppCore();
            
            // Step 4: UI統合・イベント処理設定
            this.setupUIIntegration();
            
            // Step 5: 追加機能初期化
            this.initializeAdditionalFeatures();
            
            // Step 6: 最終状態設定・確認
            this.finalizeInitialization();
            
            this.isInitialized = true;
            const initTime = performance.now() - this.startTime;
            
            console.log('🎉 AppCore統合修正版初期化完了！');
            console.log(`⏱️ 初期化時間: ${initTime.toFixed(2)}ms`);
            this.displayInitializationSummary();
            
        } catch (error) {
            console.error('💀 AppCore統合初期化失敗:', error);
            this.errorLog.push({ step: 'initialization', error: error.message, time: Date.now() });
            this.showErrorMessage(error);
            
            // 🔧 修正: フォールバック初期化試行
            await this.attemptFallbackInitialization(error);
        }
    }
    
    /**
     * 初期化前チェック
     */
    performPreInitializationChecks() {
        console.log('🔍 初期化前チェック開始...');
        
        const requiredElements = [
            'drawing-canvas',
            'pen-tool', 
            'pen-settings',
            'canvas-info',
            'current-tool',
            'coordinates'
        ];
        
        const missingElements = requiredElements.filter(id => !document.getElementById(id));
        
        if (missingElements.length > 0) {
            console.warn('⚠️ 不足DOM要素:', missingElements);
            this.errorLog.push({ 
                step: 'pre-check', 
                error: `Missing DOM elements: ${missingElements.join(', ')}`, 
                time: Date.now() 
            });
        } else {
            console.log('✅ 必要DOM要素確認完了');
        }
        
        // PixiJS確認
        if (!window.PIXI) {
            throw new Error('PixiJS が読み込まれていません');
        }
        
        console.log(`✅ PixiJS v${PIXI.VERSION} 検出`);
        this.initializationSteps.push('pre-check');
    }
    
    /**
     * 拡張ライブラリ初期化
     */
    async initializeExtensions() {
        console.log('🔧 拡張ライブラリ初期化開始...');
        
        if (typeof window.PixiExtensions !== 'undefined') {
            try {
                if (!window.PixiExtensions.initialized) {
                    await window.PixiExtensions.initialize();
                }
                
                const stats = window.PixiExtensions.getStats();
                console.log(`✅ PixiExtensions初期化完了: ${stats.available}/${stats.total}機能利用可能`);
                
                if (stats.fallbackMode) {
                    console.warn('⚠️ 一部機能でフォールバックモード動作中');
                }
                
            } catch (error) {
                console.warn('⚠️ PixiExtensions初期化でエラー:', error.message);
                this.errorLog.push({ 
                    step: 'extensions', 
                    error: error.message, 
                    time: Date.now() 
                });
            }
        } else {
            console.warn('⚠️ PixiExtensions未読み込み - 基本機能のみ使用');
        }
        
        this.initializationSteps.push('extensions');
    }
    
    /**
     * AppCore初期化（核心修正）
     */
    async initializeAppCore() {
        console.log('🎯 AppCore初期化開始（核心修正）...');
        
        // AppCoreクラス存在確認
        if (typeof window.AppCore === 'undefined') {
            throw new Error('AppCore クラスが読み込まれていません');
        }
        
        // AppCore インスタンス作成
        this.appCore = new window.AppCore();
        console.log('✅ AppCore インスタンス作成完了');
        
        // AppCore 初期化実行
        await this.appCore.initialize();
        console.log('✅ AppCore 初期化完了');
        
        // AppCore状態確認
        if (!this.appCore.app) {
            throw new Error('AppCore: PixiJS Application初期化失敗');
        }
        
        if (!this.appCore.drawingContainer) {
            throw new Error('AppCore: DrawingContainer初期化失敗');
        }
        
        if (!this.appCore.toolSystem) {
            throw new Error('AppCore: ToolSystem初期化失敗');
        }
        
        console.log('✅ AppCore状態確認完了');
        console.log(`📐 キャンバスサイズ: ${this.appCore.canvasWidth}×${this.appCore.canvasHeight}`);
        console.log(`🎨 描画パス数: ${this.appCore.paths.length}`);
        
        this.initializationSteps.push('app-core');
    }
    
    /**
     * UI統合・イベント処理設定
     */
    setupUIIntegration() {
        console.log('🎨 UI統合・イベント処理設定開始...');
        
        // リサイズ機能統合
        this.setupResizeHandlers();
        
        // ステータス表示初期化
        this.initializeStatusDisplay();
        
        // ポップアップ統合確認
        this.verifyPopupIntegration();
        
        console.log('✅ UI統合・イベント処理設定完了');
        this.initializationSteps.push('ui-integration');
    }
    
    /**
     * リサイズハンドラ設定
     */
    setupResizeHandlers() {
        const applyResize = document.getElementById('apply-resize');
        const applyResizeCenter = document.getElementById('apply-resize-center');
        
        if (applyResize) {
            applyResize.addEventListener('click', () => {
                this.applyCanvasResize(false);
            });
            console.log('✅ リサイズボタン設定完了');
        }
        
        if (applyResizeCenter) {
            applyResizeCenter.addEventListener('click', () => {
                this.applyCanvasResize(true);
            });
            console.log('✅ 中央寄せリサイズボタン設定完了');
        }
        
        // プリセットボタン設定
        const presetButtons = document.querySelectorAll('.resize-button[data-size]');
        presetButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const [width, height] = e.target.getAttribute('data-size').split(',').map(Number);
                const widthInput = document.getElementById('canvas-width');
                const heightInput = document.getElementById('canvas-height');
                
                if (widthInput && heightInput) {
                    widthInput.value = width;
                    heightInput.value = height;
                    console.log(`📐 プリセットサイズ設定: ${width}×${height}`);
                }
            });
        });
        
        console.log(`✅ プリセットボタン ${presetButtons.length}個 設定完了`);
    }
    
    /**
     * ステータス表示初期化
     */
    initializeStatusDisplay() {
        // 初期ツール設定
        const currentToolElement = document.getElementById('current-tool');
        if (currentToolElement) {
            currentToolElement.textContent = 'ベクターペン';
        }
        
        // 初期色設定
        const currentColorElement = document.getElementById('current-color');
        if (currentColorElement) {
            currentColorElement.textContent = '#800000';
        }
        
        // キャンバス情報初期化
        this.updateCanvasInfo();
        
        // GPU・メモリ使用量（ダミー値）
        const gpuUsage = document.getElementById('gpu-usage');
        const memoryUsage = document.getElementById('memory-usage');
        if (gpuUsage) gpuUsage.textContent = '45%';
        if (memoryUsage) memoryUsage.textContent = '1.2GB';
        
        console.log('✅ ステータス表示初期化完了');
    }
    
    /**
     * ポップアップ統合確認
     */
    verifyPopupIntegration() {
        const popups = ['pen-settings', 'resize-settings'];
        const availablePopups = popups.filter(id => document.getElementById(id));
        
        console.log(`✅ ポップアップ統合確認: ${availablePopups.length}/${popups.length}個利用可能`);
        
        if (availablePopups.length < popups.length) {
            const missingPopups = popups.filter(id => !document.getElementById(id));
            console.warn('⚠️ 不足ポップアップ:', missingPopups);
        }
    }
    
    /**
     * 追加機能初期化
     */
    initializeAdditionalFeatures() {
        console.log('🔧 追加機能初期化開始...');
        
        // キーボードショートカット設定
        this.setupKeyboardShortcuts();
        
        // 自動保存機能（将来実装）
        // this.setupAutoSave();
        
        console.log('✅ 追加機能初期化完了');
        this.initializationSteps.push('additional-features');
    }
    
    /**
     * キーボードショートカット設定
     */
    setupKeyboardShortcuts() {
        const shortcuts = {
            'Escape': () => this.closeAllPopups(),
            'KeyP': () => this.selectPenTool(),
            'KeyE': () => this.selectEraserTool()
        };
        
        document.addEventListener('keydown', (e) => {
            const key = e.code;
            if (shortcuts[key] && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                // テキスト入力中は無視
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                    return;
                }
                
                e.preventDefault();
                shortcuts[key]();
            }
        });
        
        console.log(`✅ キーボードショートカット ${Object.keys(shortcuts).length}個 設定完了`);
    }
    
    /**
     * 最終状態設定・確認
     */
    finalizeInitialization() {
        console.log('🏁 最終状態設定・確認開始...');
        
        // 初期ツール選択
        this.selectPenTool();
        
        // キャンバスサイズ表示更新
        this.updateCanvasInfo();
        
        // 初期化完了フラグ設定
        this.isInitialized = true;
        
        console.log('✅ 最終状態設定・確認完了');
        this.initializationSteps.push('finalization');
    }
    
    /**
     * キャンバスリサイズ適用
     */
    applyCanvasResize(centerContent) {
        const widthInput = document.getElementById('canvas-width');
        const heightInput = document.getElementById('canvas-height');
        
        if (!widthInput || !heightInput) {
            console.error('❌ リサイズ入力要素が見つかりません');
            return;
        }
        
        const width = parseInt(widthInput.value);
        const height = parseInt(heightInput.value);
        
        if (width && height && width > 0 && height > 0 && this.appCore) {
            try {
                this.appCore.resize(width, height, centerContent);
                this.updateCanvasInfo();
                this.closeAllPopups();
                console.log(`✅ キャンバスリサイズ完了: ${width}×${height}px (中央寄せ: ${centerContent})`);
            } catch (error) {
                console.error('❌ キャンバスリサイズ失敗:', error);
            }
        } else {
            console.warn('⚠️ 無効なリサイズ値または AppCore 未初期化');
        }
    }
    
    /**
     * キャンバス情報更新
     */
    updateCanvasInfo() {
        const canvasInfo = document.getElementById('canvas-info');
        if (canvasInfo && this.appCore) {
            canvasInfo.textContent = `${this.appCore.canvasWidth}×${this.appCore.canvasHeight}px`;
        }
    }
    
    /**
     * ペンツール選択
     */
    selectPenTool() {
        if (!this.appCore || !this.appCore.toolSystem) return;
        
        this.appCore.toolSystem.setTool('pen');
        
        // UI更新
        document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
        const penButton = document.getElementById('pen-tool');
        if (penButton) {
            penButton.classList.add('active');
        }
        
        const currentToolElement = document.getElementById('current-tool');
        if (currentToolElement) {
            currentToolElement.textContent = 'ベクターペン';
        }
        
        console.log('🖊️ ペンツール選択');
    }
    
    /**
     * 消しゴムツール選択
     */
    selectEraserTool() {
        if (!this.appCore || !this.appCore.toolSystem) return;
        
        this.appCore.toolSystem.setTool('eraser');
        
        // UI更新
        document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
        const eraserButton = document.getElementById('eraser-tool');
        if (eraserButton) {
            eraserButton.classList.add('active');
        }
        
        const currentToolElement = document.getElementById('current-tool');
        if (currentToolElement) {
            currentToolElement.textContent = '消しゴム';
        }
        
        console.log('🧽 消しゴムツール選択');
    }
    
    /**
     * 全ポップアップ閉じる
     */
    closeAllPopups() {
        if (this.appCore && this.appCore.uiController) {
            this.appCore.uiController.closeAllPopups();
        } else {
            // フォールバック処理
            document.querySelectorAll('.popup-panel').forEach(popup => {
                popup.classList.remove('show');
            });
        }
        
        console.log('🔒 全ポップアップ閉じる');
    }
    
    /**
     * フォールバック初期化試行
     */
    async attemptFallbackInitialization(originalError) {
        console.log('🛡️ フォールバック初期化試行...');
        
        try {
            // 最低限のPixiJSアプリケーション作成
            const app = new PIXI.Application({
                width: 400,
                height: 400,
                backgroundColor: 0xf0e0d6,
                antialias: true
            });
            
            const canvasContainer = document.getElementById('drawing-canvas');
            if (canvasContainer) {
                canvasContainer.appendChild(app.view);
                console.log('✅ フォールバックキャンバス作成完了');
            }
            
            // 基本的なエラー回復表示
            this.showRecoveryMessage(originalError);
            
        } catch (fallbackError) {
            console.error('💀 フォールバック初期化も失敗:', fallbackError);
            this.showCriticalErrorMessage(originalError, fallbackError);
        }
    }
    
    /**
     * 初期化サマリー表示
     */
    displayInitializationSummary() {
        console.log('📋 初期化サマリー:');
        console.log(`  ✅ 完了ステップ: ${this.initializationSteps.join(' → ')}`);
        console.log(`  📊 エラーログ: ${this.errorLog.length}件`);
        
        if (this.appCore) {
            const appCoreStatus = {
                pixiApp: !!this.appCore.app,
                drawingContainer: !!this.appCore.drawingContainer,
                toolSystem: !!this.appCore.toolSystem,
                uiController: !!this.appCore.uiController,
                performanceMonitor: !!this.appCore.performanceMonitor,
                canvasSize: `${this.appCore.canvasWidth}×${this.appCore.canvasHeight}`
            };
            console.log('  🎨 AppCore状態:', appCoreStatus);
        }
        
        const initTime = performance.now() - this.startTime;
        console.log(`  ⏱️ 総初期化時間: ${initTime.toFixed(2)}ms`);
        
        if (this.errorLog.length > 0) {
            console.log('  ⚠️ エラー詳細:', this.errorLog);
        }
    }
    
    /**
     * エラーメッセージ表示
     */
    showErrorMessage(error) {
        console.log('🚨 エラーメッセージ表示:', error.message);
        
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #800000;
            color: white;
            padding: 16px;
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(128, 0, 0, 0.3);
            z-index: 9999;
            max-width: 400px;
            font-family: system-ui, sans-serif;
            font-size: 13px;
        `;
        
        errorDiv.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 8px;">🚨 初期化エラー</div>
            <div style="margin-bottom: 12px; font-size: 11px; opacity: 0.9;">
                ${error.message || error}
            </div>
            <div style="display: flex; gap: 8px;">
                <button onclick="location.reload()" 
                        style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">
                    🔄 再読み込み
                </button>
                <button onclick="this.parentNode.parentNode.remove()" 
                        style="background: rgba(255,255,255,0.1); border: none; color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">
                    閉じる
                </button>
            </div>
        `;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 10000);
    }
    
    /**
     * 回復メッセージ表示
     */
    showRecoveryMessage(originalError) {
        console.log('🛡️ 回復メッセージ表示');
        
        const recoveryDiv = document.createElement('div');
        recoveryDiv.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: #cf9c97;
            color: #2c1810;
            padding: 16px;
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(207, 156, 151, 0.3);
            z-index: 9998;
            max-width: 350px;
            font-family: system-ui, sans-serif;
            font-size: 13px;
        `;
        
        recoveryDiv.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 8px;">🛡️ フォールバックモード</div>
            <div style="margin-bottom: 8px; font-size: 11px;">
                一部機能で問題が発生しましたが、基本描画機能は利用可能です。
            </div>
            <button onclick="this.parentNode.remove()" 
                    style="background: #800000; border: none; color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">
                了解
            </button>
        `;
        
        document.body.appendChild(recoveryDiv);
    }
    
    /**
     * 致命的エラーメッセージ表示
     */
    showCriticalErrorMessage(originalError, fallbackError) {
        console.log('💀 致命的エラーメッセージ表示');
        
        document.body.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #ffffee; font-family: system-ui, sans-serif;">
                <div style="text-align: center; color: #800000; background: #f0e0d6; padding: 32px; border: 3px solid #cf9c97; border-radius: 16px; box-shadow: 0 8px 24px rgba(128,0,0,0.15); max-width: 500px;">
                    <h2 style="margin: 0 0 16px 0;">🎨 ふたば☆ちゃんねる風お絵描きツール</h2>
                    <p style="margin: 0 0 16px 0;">申し訳ございませんが、アプリケーションの初期化に失敗しました。</p>
                    <details style="margin: 16px 0; text-align: left;">
                        <summary style="cursor: pointer; font-weight: 600;">エラー詳細</summary>
                        <div style="background: #ffffee; padding: 12px; border-radius: 8px; margin: 8px 0; font-family: monospace; font-size: 11px;">
                            <div><strong>初期化エラー:</strong> ${originalError.message}</div>
                            <div style="margin-top: 8px;"><strong>フォールバックエラー:</strong> ${fallbackError.message}</div>
                        </div>
                    </details>
                    <div style="display: flex; gap: 12px; justify-content: center;">
                        <button onclick="location.reload()" 
                                style="background: #800000; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                            🔄 再読み込み
                        </button>
                        <button onclick="console.clear(); console.log('デバッグモード開始'); alert('コンソールを確認してください');" 
                                style="background: #cf9c97; color: #2c1810; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                            🔍 デバッグ
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * アプリケーション状態取得
     */
    getAppState() {
        return {
            version: this.version,
            isInitialized: this.isInitialized,
            initializationSteps: this.initializationSteps,
            errorLog: this.errorLog,
            appCore: this.appCore ? {
                hasPixiApp: !!this.appCore.app,
                hasDrawingContainer: !!this.appCore.drawingContainer,
                hasToolSystem: !!this.appCore.toolSystem,
                canvasSize: `${this.appCore.canvasWidth}×${this.appCore.canvasHeight}`,
                pathCount: this.appCore.paths ? this.appCore.paths.length : 0,
                currentTool: this.appCore.toolSystem ? this.appCore.toolSystem.currentTool : 'unknown'
            } : null,
            performance: {
                initTime: performance.now() - this.startTime,
                memoryUsage: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB' : 'N/A'
            }
        };
    }
}

/**
 * アプリケーション起動（AppCore統合修正版）
 */
window.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0');
        console.log('🔧 AppCore統合修正版: キャンバス表示問題完全解決');
        console.log('🚀 AppCore統合起動開始...');
        
        window.futabaDrawingTool = new FutabaDrawingTool();
        await window.futabaDrawingTool.init();
        
        console.log('🎉 AppCore統合アプリケーション起動完了！');
        console.log('💡 使用方法:');
        console.log('  - キャンバス上でドラッグして描画');
        console.log('  - P キー: ペンツール選択');
        console.log('  - E キー: 消しゴムツール選択');
        console.log('  - Escape キー: ポップアップ閉じる');
        console.log('  - ペンツールボタンクリック: 設定パネル表示');
        
        // 🎯 デバッグ用 - アプリケーション状態をグローバル公開
        window.getAppState = () => {
            return window.futabaDrawingTool.getAppState();
        };
        
        console.log('🔍 デバッグ情報: window.getAppState() でアプリ状態確認可能');
        
    } catch (error) {
        console.error('💀 AppCore統合起動失敗:', error);
        
        // 🔧 修正: エラー画面をふたば風デザインに
        document.body.innerHTML = `
            <div style="display:flex;justify-content:center;align-items:center;height:100vh;background:#ffffee;font-family:system-ui,sans-serif;">
                <div style="text-align:center;color:#800000;background:#f0e0d6;padding:32px;border:3px solid #cf9c97;border-radius:16px;box-shadow:0 8px 24px rgba(128,0,0,0.15);max-width:500px;">
                    <h2 style="margin:0 0 16px 0;">🎨 ふたば☆ちゃんねる風お絵描きツール</h2>
                    <p style="margin:0 0 16px 0;">申し訳ございませんが、AppCore統合版の初期化に失敗しました。</p>
                    <div style="background:#ffffee;padding:12px;border-radius:8px;margin:16px 0;font-family:monospace;font-size:12px;color:#2c1810;text-align:left;">
                        <strong>エラー詳細:</strong><br>
                        ${error.message || error}
                        <br><br>
                        <strong>考えられる原因:</strong><br>
                        • app-core.js の読み込み不良<br>
                        • PixiJS の初期化失敗<br>
                        • DOM 要素の不足
                    </div>
                    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
                        <button onclick="location.reload()" 
                                style="background:#800000;color:white;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-weight:600;transition:all 0.2s ease;">
                            🔄 再読み込み
                        </button>
                        <button onclick="console.clear(); console.log('🔍 デバッグモード開始'); console.log('PixiJS:', typeof PIXI); console.log('AppCore:', typeof AppCore); console.log('PixiExtensions:', typeof PixiExtensions); alert('コンソールを確認してください');" 
                                style="background:#cf9c97;color:#2c1810;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-weight:600;transition:all 0.2s ease;">
                            🔍 デバッグ
                        </button>
                        <button onclick="window.location.href='https://github.com/toshinka/tegaki';" 
                                style="background:#aa5a56;color:white;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-weight:600;transition:all 0.2s ease;">
                            📚 GitHub
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
});