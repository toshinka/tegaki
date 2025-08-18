/**
 * 🎨 ふたば☆お絵描きツール - 統一版メインアプリケーション（修正版）
 * 🎯 AI_WORK_SCOPE: アプリケーション統括・統一初期化・イベント協調
 * 🎯 DEPENDENCIES: ConfigManager, ErrorManager, StateManager, EventBus, AppCore
 * 🎯 PIXI_EXTENSIONS: 基本利用（PixiExtensions経由）
 * 🎯 ISOLATION_TEST: ConfigManager等依存のため困難
 * 🎯 SPLIT_THRESHOLD: 300行以下維持
 * 📋 PHASE_TARGET: Phase1統一化完了版
 * 📋 V8_MIGRATION: ConfigManager経由でv8対応準備済み
 * 🚨 FIX: 初期化順序最適化・エラーハンドリング改善・循環参照防止
 */

/**
 * ふたば☆お絵描きツール - 統一版メインクラス（修正版）
 * 設定統一・エラー統一・状態統一を完全実装 + エラー修正
 */
class FutabaDrawingTool {
    constructor() {
        // ConfigManagerから設定取得（安全版）
        this.config = {
            version: 'v1.0-Phase1-Unified-Fixed',
            performance: window.ConfigManager?.getPerformanceConfig() || { maxInitTime: 5000 }
        };
        
        this.version = this.config.version;
        this.isInitialized = false;
        this.startTime = performance.now();
        
        // 統一状態管理
        this.appCore = null;
        this.initializationSteps = [];
        
        // 🚨 修正: 初期化段階フラグ追加
        this.isInitializing = false;
        
        console.log(`🎨 ${this.version} 初期化開始`);
        console.log('🔧 統一システム: ConfigManager + ErrorManager + StateManager + EventBus');
        console.log('🛡️ エラー修正: 循環参照防止・初期化順序最適化済み');
    }
    
    /**
     * 統一初期化シーケンス（修正版）
     */
    async initialize() {
        try {
            console.log('🚀 統一初期化シーケンス開始（修正版）');
            
            // 🚨 修正: 初期化段階フラグ設定
            this.isInitializing = true;
            
            // Step 1: 依存関係確認（統一版）
            await this.validateDependencies();
            
            // Step 2: 基盤システム初期化
            await this.initializeFoundationSystems();
            
            // Step 3: AppCore初期化（修正版）
            await this.initializeAppCore();
            
            // Step 4: UI統合・イベント連携（初期化完了後）
            this.setupSystemIntegration();
            
            // Step 5: 機能有効化
            this.enableFeatures();
            
            // Step 6: 完了処理
            this.finalizeInitialization();
            
            // 🚨 修正: 初期化完了フラグ設定
            this.isInitializing = false;
            this.isInitialized = true;
            
            const initTime = performance.now() - this.startTime;
            
            console.log('🎉 統一初期化完了！（修正版）');
            console.log(`⏱️ 初期化時間: ${initTime.toFixed(2)}ms`);
            
            // 統一状態表示
            this.displayInitializationSummary();
            
            // 🚨 修正: EventBus経由での初期化完了イベント発行（安全版）
            if (window.EventBus) {
                // 少し遅延させてから発行（安全性向上）
                setTimeout(() => {
                    window.EventBus.safeEmit(window.EventBus.Events.INITIALIZATION_COMPLETED, {
                        version: this.version,
                        initTime,
                        components: this.getComponentStatus()
                    });
                }, 100);
            }
            
        } catch (error) {
            console.error('💀 統一初期化失敗:', error);
            
            // 🚨 修正: 統一エラー処理（安全版）
            if (window.ErrorManager) {
                // safeErrorメソッドがある場合は使用
                if (typeof window.ErrorManager.safeError === 'function') {
                    window.ErrorManager.safeError(error.message, 'error');
                } else {
                    window.ErrorManager.showError('error', error, { 
                        showReload: true,
                        additionalInfo: `初期化ステップ: ${this.initializationSteps.join(' → ')}`
                    });
                }
            }
            
            // フォールバック試行
            await this.attemptFallbackInitialization(error);
        } finally {
            this.isInitializing = false;
        }
    }
    
    /**
     * 依存関係確認（統一版）
     */
    async validateDependencies() {
        console.log('🔍 統一依存関係確認...');
        
        const required = window.ConfigManager?.get('dependencies') || [
            'PIXI', 'ConfigManager', 'ErrorManager', 'StateManager', 'EventBus', 'AppCore'
        ];
        
        const missing = [];
        const available = {};
        
        // 基本ライブラリ確認
        if (!window.PIXI) missing.push('PixiJS');
        else available.PIXI = window.PIXI.VERSION;
        
        // 統一システム確認
        ['ConfigManager', 'ErrorManager', 'StateManager', 'EventBus'].forEach(name => {
            if (!window[name]) missing.push(name);
            else available[name] = 'OK';
        });
        
        // AppCore確認
        if (!window.AppCore) missing.push('AppCore');
        else available.AppCore = 'OK';
        
        // DOM要素確認
        const requiredElements = ['drawing-canvas', 'pen-tool', 'pen-settings'];
        const missingElements = requiredElements.filter(id => !document.getElementById(id));
        
        if (missingElements.length > 0) {
            console.warn('⚠️ 不足DOM要素:', missingElements);
        }
        
        if (missing.length > 0) {
            throw new Error(`必須依存関係不足: ${missing.join(', ')}`);
        }
        
        console.log('✅ 依存関係確認完了:', available);
        this.initializationSteps.push('dependencies');
    }
    
    /**
     * 基盤システム初期化
     */
    async initializeFoundationSystems() {
        console.log('🏗️ 基盤システム初期化...');
        
        // PixiExtensions初期化
        if (window.PixiExtensions && !window.PixiExtensions.initialized) {
            try {
                await window.PixiExtensions.initialize();
                const stats = window.PixiExtensions.getStats();
                console.log(`✅ PixiExtensions: ${stats.available}/${stats.total}機能利用可能`);
            } catch (error) {
                console.warn('⚠️ PixiExtensions初期化エラー:', error.message);
                
                // 🚨 修正: ErrorManager安全呼び出し
                if (window.ErrorManager) {
                    if (typeof window.ErrorManager.safeError === 'function') {
                        window.ErrorManager.safeError(
                            `拡張機能の一部が利用できません: ${error.message}`,
                            'warning'
                        );
                    } else {
                        window.ErrorManager.showError('warning', 
                            `拡張機能の一部が利用できません: ${error.message}`,
                            { test: false }
                        );
                    }
                }
            }
        }
        
        console.log('✅ 基盤システム初期化完了');
        this.initializationSteps.push('foundation');
    }
    
    /**
     * AppCore初期化（統一版・修正版）
     */
    async initializeAppCore() {
        console.log('🎯 AppCore統一初期化（修正版）...');
        
        if (!window.AppCore) {
            throw new Error('AppCore クラスが利用できません');
        }
        
        try {
            // AppCore作成（ConfigManager連携）
            this.appCore = new window.AppCore();
            console.log('✅ AppCore インスタンス作成');
            
            // AppCore初期化実行
            await this.appCore.initialize();
            console.log('✅ AppCore 初期化完了');
            
            // 状態確認
            const status = this.validateAppCoreStatus();
            if (!status.valid) {
                throw new Error(`AppCore状態異常: ${status.issues.join(', ')}`);
            }
            
            console.log('✅ AppCore状態確認完了');
            this.initializationSteps.push('app-core');
            
        } catch (error) {
            console.error('💀 AppCore初期化エラー（詳細）:', error);
            
            // 🚨 修正: より詳細なエラー情報を提供
            const errorInfo = {
                message: error.message,
                stack: error.stack,
                appCoreExists: !!window.AppCore,
                pixiExists: !!window.PIXI,
                canvasExists: !!document.getElementById('drawing-canvas')
            };
            
            console.error('🔍 AppCore初期化エラー詳細:', errorInfo);
            
            throw error; // 上位でキャッチして適切に処理
        }
    }
    
    /**
     * AppCore状態確認
     */
    validateAppCoreStatus() {
        const issues = [];
        
        if (!this.appCore) {
            issues.push('AppCoreインスタンス未作成');
            return { valid: false, issues };
        }
        
        if (!this.appCore.app) issues.push('PixiJS Application未初期化');
        if (!this.appCore.drawingContainer) issues.push('DrawingContainer未初期化');
        if (!this.appCore.toolSystem) issues.push('ToolSystem未初期化');
        if (!this.appCore.uiController) issues.push('UIController未初期化');
        
        return {
            valid: issues.length === 0,
            issues
        };
    }
    
    /**
     * システム統合・イベント連携設定（修正版）
     */
    setupSystemIntegration() {
        console.log('🔗 システム統合・イベント連携設定（修正版）...');
        
        try {
            // キーボードショートカット設定（統一版）
            this.setupKeyboardShortcuts();
            
            // リサイズ機能統合
            this.setupResizeHandlers();
            
            // ステータス表示統合
            this.setupStatusDisplay();
            
            // EventBus連携設定（修正版）
            this.setupEventBusIntegration();
            
            console.log('✅ システム統合完了');
            this.initializationSteps.push('integration');
            
        } catch (error) {
            console.error('💀 システム統合エラー:', error);
            
            // 🚨 修正: 統合エラー時の安全処理
            if (window.ErrorManager) {
                if (typeof window.ErrorManager.safeError === 'function') {
                    window.ErrorManager.safeError(
                        `システム統合で一部機能が制限されます: ${error.message}`,
                        'warning'
                    );
                }
            }
        }
    }
    
    /**
     * キーボードショートカット設定（統一版）
     */
    setupKeyboardShortcuts() {
        const shortcuts = window.ConfigManager?.get('ui.keyboard.shortcuts') || {
            'Escape': 'closeAllPopups',
            'KeyP': 'selectPenTool',
            'KeyE': 'selectEraserTool'
        };
        
        document.addEventListener('keydown', (e) => {
            const action = shortcuts[e.code];
            if (!action || e.ctrlKey || e.altKey || e.shiftKey) return;
            
            // テキスト入力中は無効
            if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
            
            e.preventDefault();
            
            if (this[action]) {
                try {
                    this[action]();
                } catch (error) {
                    console.warn('⚠️ ショートカットアクション実行エラー:', action, error);
                }
            } else {
                console.warn('未定義ショートカットアクション:', action);
            }
        });
        
        console.log(`✅ キーボードショートカット ${Object.keys(shortcuts).length}個設定完了`);
    }
    
    /**
     * リサイズハンドラ設定（統一版）
     */
    setupResizeHandlers() {
        // 適用ボタン
        const applyResize = document.getElementById('apply-resize');
        const applyResizeCenter = document.getElementById('apply-resize-center');
        
        if (applyResize) {
            applyResize.addEventListener('click', () => this.applyCanvasResize(false));
        }
        
        if (applyResizeCenter) {
            applyResizeCenter.addEventListener('click', () => this.applyCanvasResize(true));
        }
        
        // プリセットボタン
        document.querySelectorAll('.resize-button[data-size]').forEach(button => {
            button.addEventListener('click', (e) => {
                const [width, height] = e.target.getAttribute('data-size').split(',').map(Number);
                const widthInput = document.getElementById('canvas-width');
                const heightInput = document.getElementById('canvas-height');
                
                if (widthInput && heightInput) {
                    widthInput.value = width;
                    heightInput.value = height;
                }
            });
        });
        
        console.log('✅ リサイズハンドラ設定完了');
    }
    
    /**
     * ステータス表示統合
     */
    setupStatusDisplay() {
        // 初期表示設定
        const elements = {
            'current-tool': 'ベクターペン',
            'current-color': window.ConfigManager?.get('colors.futabaMaroonHex') || '#800000',
            'canvas-info': this.appCore ? 
                `${this.appCore.canvasWidth}×${this.appCore.canvasHeight}px` : '400×400px'
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
        
        console.log('✅ ステータス表示統合完了');
    }
    
    /**
     * EventBus連携設定（修正版）
     */
    setupEventBusIntegration() {
        if (!window.EventBus) return;
        
        try {
            // 描画系イベントリスナー設定（安全版）
            window.EventBus.on(window.EventBus.Events.TOOL_CHANGED, (data) => {
                this.updateToolStatus(data?.tool || 'pen');
            });
            
            window.EventBus.on(window.EventBus.Events.CANVAS_RESIZED, (data) => {
                this.updateCanvasInfo();
            });
            
            window.EventBus.on(window.EventBus.Events.ERROR_OCCURRED, (data) => {
                console.warn('📡 EventBus: エラー通知受信', data);
            });
            
            console.log('✅ EventBus連携設定完了（修正版）');
        } catch (error) {
            console.error('💀 EventBus連携設定エラー:', error);
        }
    }
    
    /**
     * 機能有効化（修正版）
     */
    enableFeatures() {
        console.log('⚡ 機能有効化...');
        
        try {
            // 初期ツール選択
            this.selectPenTool();
            
            // パフォーマンス監視開始
            if (this.appCore?.performanceMonitor) {
                this.appCore.performanceMonitor.start();
            }
            
            console.log('✅ 機能有効化完了');
            this.initializationSteps.push('features');
        } catch (error) {
            console.error('💀 機能有効化エラー:', error);
        }
    }
    
    /**
     * 最終初期化処理
     */
    finalizeInitialization() {
        console.log('🏁 最終初期化処理...');
        
        // グローバル公開
        window.futabaDrawingTool = this;
        
        // デバッグ関数設定（統一版）
        this.setupDebugFunctions();
        
        console.log('✅ 最終初期化完了');
        this.initializationSteps.push('finalization');
    }
    
    /**
     * デバッグ関数設定（統一版）
     */
    setupDebugFunctions() {
        // 旧関数との互換性維持
        window.getAppState = () => {
            console.warn('getAppState() is deprecated. Use StateManager.getApplicationState()');
            return window.StateManager?.getApplicationState() || this.getAppState();
        };
        
        window.startDebugMode = () => this.startDebugMode();
        
        console.log('✅ デバッグ関数設定完了');
    }
    
    /**
     * キャンバスリサイズ適用（統一版・修正版）
     */
    applyCanvasResize(centerContent) {
        const widthInput = document.getElementById('canvas-width');
        const heightInput = document.getElementById('canvas-height');
        
        if (!widthInput || !heightInput || !this.appCore) {
            // 🚨 修正: ErrorManager安全呼び出し
            if (window.ErrorManager) {
                if (typeof window.ErrorManager.safeError === 'function') {
                    window.ErrorManager.safeError('リサイズに必要な要素が見つかりません', 'warning');
                } else {
                    window.ErrorManager.showError('warning', 'リサイズに必要な要素が見つかりません');
                }
            }
            return;
        }
        
        const width = parseInt(widthInput.value);
        const height = parseInt(heightInput.value);
        
        // ConfigManagerで妥当性確認
        const canvasConfig = window.ConfigManager?.getCanvasConfig() || {};
        const isValid = width >= (canvasConfig.minWidth || 100) && 
                       height >= (canvasConfig.minHeight || 100) &&
                       width <= (canvasConfig.maxWidth || 4096) &&
                       height <= (canvasConfig.maxHeight || 4096);
        
        if (!isValid) {
            // 🚨 修正: ErrorManager安全呼び出し
            if (window.ErrorManager) {
                if (typeof window.ErrorManager.safeError === 'function') {
                    window.ErrorManager.safeError(
                        `無効なキャンバスサイズ: ${width}×${height}px`,
                        'warning'
                    );
                } else {
                    window.ErrorManager.showError('warning', 
                        `無効なキャンバスサイズ: ${width}×${height}px`);
                }
            }
            return;
        }
        
        try {
            this.appCore.resize(width, height, centerContent);
            this.updateCanvasInfo();
            this.closeAllPopups();
            
            // 🚨 修正: EventBus安全発行
            if (window.EventBus) {
                window.EventBus.safeEmit(window.EventBus.Events.CANVAS_RESIZED, {
                    width, height, centerContent
                });
            }
            
            console.log(`✅ キャンバスリサイズ: ${width}×${height}px (中央寄せ: ${centerContent})`);
            
        } catch (error) {
            // 🚨 修正: ErrorManager安全呼び出し
            if (window.ErrorManager) {
                if (typeof window.ErrorManager.safeError === 'function') {
                    window.ErrorManager.safeError(
                        `キャンバスリサイズ失敗: ${error.message}`,
                        'error'
                    );
                } else {
                    window.ErrorManager.showError('error', `キャンバスリサイズ失敗: ${error.message}`);
                }
            }
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
     * ツール状態更新
     */
    updateToolStatus(tool) {
        const currentToolElement = document.getElementById('current-tool');
        if (!currentToolElement) return;
        
        const toolNames = {
            pen: 'ベクターペン',
            eraser: '消しゴム',
            fill: '塗りつぶし',
            select: '選択'
        };
        
        currentToolElement.textContent = toolNames[tool] || tool;
    }
    
    /**
     * ペンツール選択（統一版・修正版）
     */
    selectPenTool() {
        if (!this.appCore?.toolSystem) return;
        
        try {
            this.appCore.toolSystem.setTool('pen');
            
            // UI更新
            document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
            const penButton = document.getElementById('pen-tool');
            if (penButton) penButton.classList.add('active');
            
            this.updateToolStatus('pen');
            
            // 🚨 修正: EventBus安全発行
            if (window.EventBus && !this.isInitializing) {
                window.EventBus.safeEmit(window.EventBus.Events.TOOL_CHANGED, { tool: 'pen' });
            }
            
            console.log('🖊️ ペンツール選択');
        } catch (error) {
            console.error('💀 ペンツール選択エラー:', error);
        }
    }
    
    /**
     * 消しゴムツール選択（統一版・修正版）
     */
    selectEraserTool() {
        if (!this.appCore?.toolSystem) return;
        
        try {
            this.appCore.toolSystem.setTool('eraser');
            
            // UI更新
            document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
            const eraserButton = document.getElementById('eraser-tool');
            if (eraserButton) eraserButton.classList.add('active');
            
            this.updateToolStatus('eraser');
            
            // 🚨 修正: EventBus安全発行
            if (window.EventBus && !this.isInitializing) {
                window.EventBus.safeEmit(window.EventBus.Events.TOOL_CHANGED, { tool: 'eraser' });
            }
            
            console.log('🧽 消しゴムツール選択');
        } catch (error) {
            console.error('💀 消しゴムツール選択エラー:', error);
        }
    }
    
    /**
     * 全ポップアップ閉じる（統一版・修正版）
     */
    closeAllPopups() {
        try {
            if (this.appCore?.uiController) {
                this.appCore.uiController.closeAllPopups();
            } else {
                // フォールバック
                document.querySelectorAll('.popup-panel').forEach(popup => {
                    popup.classList.remove('show');
                });
            }
            
            // 🚨 修正: EventBus安全発行
            if (window.EventBus && !this.isInitializing) {
                window.EventBus.safeEmit(window.EventBus.Events.POPUP_CLOSED, { all: true });
            }
            
            console.log('🔒 全ポップアップ閉じる');
        } catch (error) {
            console.error('💀 ポップアップクローズエラー:', error);
        }
    }
    
    /**
     * フォールバック初期化（統一版・修正版）
     */
    async attemptFallbackInitialization(originalError) {
        console.log('🛡️ フォールバック初期化試行（修正版）...');
        
        try {
            // 最小限PixiJS初期化
            const canvasConfig = window.ConfigManager?.getCanvasConfig() || {
                width: 400, height: 400, backgroundColor: 0xf0e0d6
            };
            
            const app = new PIXI.Application({
                width: canvasConfig.width,
                height: canvasConfig.height,
                backgroundColor: canvasConfig.backgroundColor,
                antialias: true
            });
            
            const canvasContainer = document.getElementById('drawing-canvas');
            if (canvasContainer) {
                canvasContainer.appendChild(app.view);
            }
            
            console.log('✅ フォールバック初期化完了');
            
            // 回復メッセージ表示（統一システム使用・修正版）
            if (window.ErrorManager) {
                if (typeof window.ErrorManager.safeError === 'function') {
                    window.ErrorManager.safeError(
                        '基本描画機能は利用可能です。一部の高度な機能が制限されています。',
                        'recovery'
                    );
                } else {
                    window.ErrorManager.showError('recovery', 
                        '基本描画機能は利用可能です。一部の高度な機能が制限されています。');
                }
            }
            
        } catch (fallbackError) {
            console.error('💀 フォールバック初期化も失敗:', fallbackError);
            
            // 最終フォールバック：致命的エラー表示
            if (window.ErrorManager) {
                if (typeof window.ErrorManager.showCriticalError === 'function') {
                    window.ErrorManager.showCriticalError(originalError.message, {
                        additionalInfo: fallbackError.message,
                        showDebug: true
                    });
                }
            } else {
                // ErrorManager自体が使えない場合の最終手段
                this.displayEmergencyError(originalError, fallbackError);
            }
        }
    }
    
    /**
     * 緊急エラー表示（ErrorManager未使用版）
     * @param {Error} originalError - 元のエラー
     * @param {Error} fallbackError - フォールバックエラー
     */
    displayEmergencyError(originalError, fallbackError) {
        document.body.innerHTML = `
            <div style="display:flex;justify-content:center;align-items:center;height:100vh;background:#ffffee;font-family:system-ui,sans-serif;">
                <div style="text-align:center;color:#800000;background:#f0e0d6;padding:32px;border:3px solid #cf9c97;border-radius:16px;max-width:500px;">
                    <h2 style="margin:0 0 16px 0;">🎨 ふたば☆お絵描きツール</h2>
                    <p style="margin:0 0 16px 0;">統一システムの初期化に失敗しました。</p>
                    <details style="margin:16px 0;text-align:left;">
                        <summary style="cursor:pointer;font-weight:600;">エラー詳細</summary>
                        <div style="background:#ffffee;padding:12px;border-radius:8px;margin:8px 0;font-family:monospace;font-size:12px;">
                            <div><strong>初期化エラー:</strong> ${originalError.message}</div>
                            <div><strong>フォールバックエラー:</strong> ${fallbackError.message}</div>
                            <div><strong>時刻:</strong> ${new Date().toLocaleString()}</div>
                        </div>
                    </details>
                    <button onclick="location.reload()" 
                            style="background:#800000;color:white;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-weight:600;">
                        🔄 再読み込み
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * 初期化サマリー表示（統一版・修正版）
     */
    displayInitializationSummary() {
        console.log('📋 統一初期化サマリー（修正版）:');
        console.log(`  ✅ 完了ステップ: ${this.initializationSteps.join(' → ')}`);
        console.log(`  ⏱️ 初期化時間: ${(performance.now() - this.startTime).toFixed(2)}ms`);
        
        // 統一システム状態
        const systems = ['ConfigManager', 'ErrorManager', 'StateManager', 'EventBus'];
        const systemStatus = {};
        systems.forEach(name => {
            systemStatus[name] = !!window[name];
        });
        console.log('  🔧 統一システム:', systemStatus);
        
        // AppCore状態
        if (this.appCore) {
            const appCoreStatus = this.validateAppCoreStatus();
            console.log('  🎨 AppCore状態:', appCoreStatus.valid ? '正常' : `異常: ${appCoreStatus.issues.join(', ')}`);
        }
        
        // EventBus統計
        if (window.EventBus) {
            console.log('  📡 EventBus:', window.EventBus.getStats());
        }
        
        // エラー状況
        const errorCount = window.ErrorManager?.getErrorLog().length || 0;
        if (errorCount > 0) {
            console.log(`  ⚠️ エラー: ${errorCount}件`);
        }
        
        // 🚨 修正: 修正内容サマリー
        console.log('  🛡️ 修正適用済み: 循環参照防止・エラーハンドリング改善・初期化順序最適化');
    }
    
    /**
     * コンポーネント状態取得
     */
    getComponentStatus() {
        return {
            configManager: !!window.ConfigManager,
            errorManager: !!window.ErrorManager,
            stateManager: !!window.StateManager,
            eventBus: !!window.EventBus,
            appCore: !!this.appCore,
            pixiExtensions: !!window.PixiExtensions,
            initialized: this.isInitialized,
            isInitializing: this.isInitializing
        };
    }
    
    /**
     * アプリケーション状態取得（互換性維持）
     */
    getAppState() {
        if (window.StateManager) {
            return window.StateManager.getApplicationState();
        }
        
        // フォールバック状態
        return {
            version: this.version,
            isInitialized: this.isInitialized,
            isInitializing: this.isInitializing,
            initializationSteps: this.initializationSteps,
            components: this.getComponentStatus(),
            performance: {
                initTime: performance.now() - this.startTime
            }
        };
    }
    
    /**
     * デバッグモード開始（統一版・修正版）
     */
    startDebugMode() {
        console.log('🔍 統一デバッグモード開始（修正版）');
        
        try {
            // 各システムのデバッグ情報表示
            if (window.ConfigManager) {
                console.log('ConfigManager:', window.ConfigManager.getDebugInfo());
            }
            
            if (window.ErrorManager) {
                window.ErrorManager.showDebugInfo();
            }
            
            if (window.StateManager) {
                console.log('StateManager:', window.StateManager.healthCheck());
            }
            
            if (window.EventBus) {
                window.EventBus.debug();
            }
            
            console.log('AppCore:', this.getAppState());
            
            return {
                config: window.ConfigManager?.getDebugInfo(),
                errors: window.ErrorManager?.getErrorStats(),
                state: window.StateManager?.healthCheck(),
                events: window.EventBus?.getStats(),
                app: this.getAppState()
            };
        } catch (error) {
            console.error('💀 デバッグモード開始エラー:', error);
            return { error: error.message };
        }
    }
}

/**
 * 統一アプリケーション起動（修正版）
 */
window.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🎨 ふたば☆ちゃんねる風ベクターお絵描きツール');
        console.log('🔧 統一版: ConfigManager + ErrorManager + StateManager + EventBus');
        console.log('🛡️ 修正版: 循環参照防止・エラーハンドリング改善・初期化順序最適化');
        console.log('🚀 統一アプリケーション起動開始...');
        
        const app = new FutabaDrawingTool();
        await app.initialize();
        
        console.log('🎉 統一アプリケーション起動完了！');
        console.log('💡 操作方法:');
        console.log('  - キャンバス上でドラッグして描画');
        console.log('  - P キー: ペンツール / E キー: 消しゴム / Escape: ポップアップ閉じる');
        console.log('🔍 デバッグ: window.startDebugMode() で詳細情報表示');
        
    } catch (error) {
        console.error('💀 統一アプリケーション起動失敗:', error);
        
        // 🚨 修正: ErrorManager安全呼び出し
        if (window.ErrorManager) {
            if (typeof window.ErrorManager.showCriticalError === 'function') {
                window.ErrorManager.showCriticalError(error.message, {
                    showDebug: true,
                    additionalInfo: 'メインアプリケーション起動時のエラー'
                });
            }
        } else {
            // ErrorManager未初期化時のフォールバック表示（修正版）
            document.body.innerHTML = `
                <div style="display:flex;justify-content:center;align-items:center;height:100vh;background:#ffffee;font-family:system-ui,sans-serif;">
                    <div style="text-align:center;color:#800000;background:#f0e0d6;padding:32px;border:3px solid #cf9c97;border-radius:16px;max-width:500px;">
                        <h2 style="margin:0 0 16px 0;">🎨 ふたば☆お絵描きツール</h2>
                        <p style="margin:0 0 16px 0;">統一システムの初期化に失敗しました。</p>
                        <div style="background:#ffffee;padding:12px;border-radius:8px;margin:16px 0;font-family:monospace;font-size:12px;text-align:left;">
                            <strong>エラー:</strong> ${error.message}<br>
                            <strong>時刻:</strong> ${new Date().toLocaleString()}<br>
                            <strong>修正版:</strong> v1.0-Phase1-Unified-Fixed
                        </div>
                        <button onclick="location.reload()" 
                                style="background:#800000;color:white;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-weight:600;">
                            🔄 再読み込み
                        </button>
                    </div>
                </div>
            `;
        }
    }
});