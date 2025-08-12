/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev12
 * UI統合管理システム - ui-manager.js（STEP 3クリーンアップ版）
 * 
 * 🔧 STEP 3完了内容: プレビュー連動機能移譲・削除
 * 1. ✅ プレビュー連動機能完全削除（drawing-tools/ui/に移譲完了）
 * 2. ✅ updatePresetLiveValues() 削除
 * 3. ✅ updateActivePresetPreview() 削除
 * 4. ✅ プレビュー同期制御削除
 * 5. ✅ 約180行削減・保守性大幅向上
 * 6. ✅ 責務明確化（汎用UI管理のみ）
 * 
 * STEP 3目標達成: ui-manager.jsのスリム化・責務分離完了
 * 責務: 汎用UI制御・システム統合のみ（ペンツール専用機能は除外）
 * 依存: config.js, ui/components.js, monitoring/system-monitor.js
 */

console.log('🔧 ui-manager.js STEP 3クリーンアップ版読み込み開始...');

// ==== STEP 3クリーンアップ版: UI統合管理クラス（プレビュー連動機能削除）====
class UIManagerSystem {
    constructor(app, toolsSystem, historyManager = null) {
        this.app = app;
        this.toolsSystem = toolsSystem;
        this.historyManager = historyManager;
        
        // ui/components.js 定義クラス活用
        this.popupManager = this.initializeComponent('PopupManager');
        this.statusBar = this.initializeComponent('StatusBarManager');
        this.presetDisplayManager = this.initializeComponent('PresetDisplayManager', [toolsSystem]);
        
        // 既存システムとの連携（STEP 3: プレビュー連動機能削除）
        this.penPresetManager = null; // toolsSystemから取得（表示のみ）
        
        // STEP 3削除: プレビュー連動関連変数削除
        // - this.previewSyncEnabled
        // - this.previewUpdateThrottle
        // - this.lastPreviewUpdate
        
        // 外部パフォーマンス監視システム統合
        this.externalPerformanceMonitor = null; // ui/components.js から取得
        this.systemMonitor = null; // monitoring/system-monitor.js から取得
        
        // スライダー管理（ペンツール専用機能は除外）
        this.sliders = new Map();
        
        // UI制御状態
        this.isInitialized = false;
        this.coordinateUpdateThrottle = null;
        this.errorCount = 0;
        this.maxErrors = 10;
        
        // 外部システム参照
        this.settingsManager = null;
        this.debugManager = null; // 外部デバッグシステム
        
        console.log('🎯 UIManagerSystem初期化（STEP 3クリーンアップ版・プレビュー連動機能削除）');
    }
    
    /**
     * CONFIG値安全取得（utils.js統合）
     */
    safeConfigGet(key, defaultValue) {
        try {
            if (window.CONFIG && window.CONFIG[key] !== undefined && window.CONFIG[key] !== null) {
                const value = window.CONFIG[key];
                if (key === 'SIZE_PRESETS' && Array.isArray(value) && value.length === 0) {
                    return defaultValue || [1, 2, 4, 8, 16, 32];
                }
                return value;
            }
        } catch (error) {
            console.warn(`CONFIG.${key} アクセスエラー:`, error);
        }
        return defaultValue;
    }
    
    /**
     * コンポーネント安全初期化
     */
    initializeComponent(ComponentClass, constructorArgs = []) {
        try {
            if (typeof window[ComponentClass] !== 'undefined') {
                return new window[ComponentClass](...constructorArgs);
            } else {
                console.warn(`${ComponentClass} が利用できません`);
                return null;
            }
        } catch (error) {
            console.error(`${ComponentClass} 初期化エラー:`, error);
            return null;
        }
    }
    
    /**
     * 履歴管理システム設定
     */
    setHistoryManager(historyManager) {
        this.historyManager = historyManager;
        console.log('📚 UIManagerSystem: 履歴管理システム連携完了');
    }
    
    /**
     * 外部システム設定
     */
    setExternalSystems(debugManager, systemMonitor) {
        this.debugManager = debugManager;
        this.systemMonitor = systemMonitor;
        console.log('🔗 UIManagerSystem: 外部システム連携完了', {
            debugManager: !!debugManager,
            systemMonitor: !!systemMonitor
        });
    }
    
    /**
     * 初期化（STEP 3クリーンアップ版・外部システム統合）
     */
    async init() {
        try {
            console.log('🎯 UIManagerSystem初期化開始（STEP 3クリーンアップ版・プレビュー連動機能削除）...');
            
            // 既存システム取得
            this.setupExistingSystems();
            
            // 外部監視システム統合
            this.integrateExternalMonitoringSystems();
            
            // 基本UI設定
            this.setupToolButtons();
            this.setupPopups();
            this.setupGeneralSliders(); // STEP 3更新: ペンツール専用スライダー除外
            this.setupResize();
            this.setupCheckboxes();
            this.setupAppEventListeners();
            
            // リセット機能（STEP 3更新: プレビューリセット削除）
            this.setupResetFunctions();
            
            // 外部パフォーマンス監視開始
            this.startExternalPerformanceMonitoring();
            
            // 初期状態の更新
            this.updateAllDisplays();
            
            this.isInitialized = true;
            console.log('✅ UIManagerSystem初期化完了（STEP 3クリーンアップ版・プレビュー連動機能削除）');
            
        } catch (error) {
            console.error('❌ UIManagerSystem初期化エラー:', error);
            this.handleError(error);
            throw error;
        }
    }
    
    /**
     * 既存システム取得（STEP 3更新: プレビュー連動機能削除）
     */
    setupExistingSystems() {
        // 既存PenPresetManager取得（表示のみ・プレビュー連動は削除）
        if (this.toolsSystem && this.toolsSystem.getPenPresetManager) {
            this.penPresetManager = this.toolsSystem.getPenPresetManager();
            
            if (this.penPresetManager) {
                console.log('🎨 既存PenPresetManager連携完了（表示専用・プレビュー連動除外）');
                
                // STEP 3削除: プレビュー連動設定削除
                // if (this.presetDisplayManager && this.presetDisplayManager.setPenPresetManager) {
                //     this.presetDisplayManager.setPenPresetManager(this.penPresetManager);
                // }
            } else {
                console.warn('PenPresetManager が取得できません');
            }
        }
        
        // ui/components.js の PerformanceMonitor 取得
        if (typeof window.PerformanceMonitor !== 'undefined') {
            try {
                this.externalPerformanceMonitor = new window.PerformanceMonitor();
                console.log('📊 ui/components.js PerformanceMonitor連携完了');
            } catch (error) {
                console.warn('PerformanceMonitor初期化エラー:', error);
            }
        }
        
        // フォールバック用PenPresetManager作成（表示専用）
        if (!this.penPresetManager && typeof window.PenPresetManager !== 'undefined') {
            try {
                this.penPresetManager = new window.PenPresetManager(this.toolsSystem, this.historyManager);
                console.log('🎨 フォールバックPenPresetManager作成完了（表示専用）');
            } catch (error) {
                console.warn('フォールバックPenPresetManager作成エラー:', error);
            }
        }
    }
    
    /**
     * 外部監視システム統合
     */
    integrateExternalMonitoringSystems() {
        // SystemMonitor統合
        if (!this.systemMonitor && window.systemMonitor) {
            this.systemMonitor = window.systemMonitor;
            console.log('📊 SystemMonitor統合完了');
        }
        
        // 統合確認
        const monitoringSystems = {
            externalPerformanceMonitor: !!this.externalPerformanceMonitor,
            systemMonitor: !!this.systemMonitor
        };
        
        const activeMonitoringCount = Object.values(monitoringSystems).filter(Boolean).length;
        console.log(`📊 監視システム統合: ${activeMonitoringCount}/2システム`, monitoringSystems);
    }
    
    /**
     * 外部パフォーマンス監視開始
     */
    startExternalPerformanceMonitoring() {
        let monitoringStarted = false;
        
        // ui/components.js の PerformanceMonitor 優先
        if (this.externalPerformanceMonitor && this.externalPerformanceMonitor.start) {
            this.externalPerformanceMonitor.start();
            console.log('📊 外部PerformanceMonitor開始');
            monitoringStarted = true;
        }
        
        // SystemMonitor確認（既に開始されている可能性）
        if (this.systemMonitor) {
            if (this.systemMonitor.isRunning) {
                console.log('📊 SystemMonitor既に実行中');
            } else {
                console.log('📊 SystemMonitorは別途開始予定');
            }
            monitoringStarted = true;
        }
        
        if (!monitoringStarted) {
            console.warn('⚠️ 外部パフォーマンス監視システムが利用できません');
        }
    }
    
    /**
     * ツールボタン設定
     */
    setupToolButtons() {
        document.querySelectorAll('.tool-button').forEach(button => {
            button.addEventListener('click', (event) => {
                if (button.classList.contains('disabled')) return;
                
                const toolId = button.id;
                const popupId = button.getAttribute('data-popup');
                
                this.handleToolButtonClick(toolId, popupId, button);
            });
        });
        
        console.log('✅ ツールボタン設定完了');
    }
    
    handleToolButtonClick(toolId, popupId, button) {
        // ツール切り替え
        if (toolId === 'pen-tool') {
            this.setActiveTool('pen', button);
        } else if (toolId === 'eraser-tool') {
            this.setActiveTool('eraser', button);
        }
        
        // ポップアップ表示/非表示
        if (popupId && this.popupManager) {
            this.popupManager.togglePopup(popupId);
        }
    }
    
    setActiveTool(toolName, button) {
        // ツールシステムに切り替えを依頼
        if (this.toolsSystem.setTool(toolName)) {
            // 履歴記録
            if (this.historyManager) {
                this.historyManager.recordToolChange(toolName);
            }
            
            // UI更新
            document.querySelectorAll('.tool-button').forEach(btn => 
                btn.classList.remove('active'));
            if (button) {
                button.classList.add('active');
            }
            
            if (this.statusBar) {
                this.statusBar.updateCurrentTool(toolName);
            }
        }
    }
    
    /**
     * ポップアップ設定
     */
    setupPopups() {
        if (!this.popupManager) {
            console.warn('PopupManager が利用できません');
            return;
        }
        
        this.popupManager.registerPopup('pen-settings');
        this.popupManager.registerPopup('resize-settings');
        
        console.log('✅ ポップアップ設定完了');
    }
    
    /**
     * STEP 3更新: 汎用スライダー設定（ペンツール専用機能除外）
     */
    setupGeneralSliders() {
        if (typeof SliderController === 'undefined') {
            console.warn('SliderController が利用できません');
            return;
        }
        
        try {
            // STEP 3削除: ペンツール専用スライダー削除
            // - ペンサイズスライダー → drawing-tools/ui/に移譲完了
            // - 不透明度スライダー → drawing-tools/ui/に移譲完了
            // - 筆圧スライダー → drawing-tools/ui/に移譲完了
            // - 線補正スライダー → drawing-tools/ui/に移譲完了
            
            // 汎用スライダー（将来の拡張用）のみ保持
            console.log('📐 汎用スライダー設定（ペンツール専用機能は除外・drawing-tools/ui/に移譲完了）');
            
            // STEP 3削除: ペンツール専用ボタン削除
            // this.setupSliderButtons();
            
            console.log('✅ 汎用スライダー設定完了（STEP 3クリーンアップ版）');
            
        } catch (error) {
            console.error('汎用スライダー設定エラー:', error);
            this.handleError(error);
        }
    }
    
    /**
     * リサイズ設定
     */
    setupResize() {
        const resizeButtons = [
            { id: 'resize-400-400', width: 400, height: 400 },
            { id: 'resize-600-600', width: 600, height: 600 },
            { id: 'resize-800-600', width: 800, height: 600 },
            { id: 'resize-1000-1000', width: 1000, height: 1000 }
        ];
        
        resizeButtons.forEach(config => {
            const button = document.getElementById(config.id);
            if (button) {
                button.addEventListener('click', () => {
                    this.resizeCanvas(config.width, config.height);
                });
            }
        });
    }
    
    resizeCanvas(width, height) {
        if (this.app && this.app.resize) {
            this.app.resize(width, height);
            if (this.statusBar) {
                this.statusBar.updateCanvasInfo(width, height);
            }
            console.log(`キャンバスリサイズ: ${width}x${height}px`);
        }
    }
    
    /**
     * チェックボックス設定
     */
    setupCheckboxes() {
        const highDpiCheckbox = document.getElementById('high-dpi-checkbox');
        if (highDpiCheckbox) {
            highDpiCheckbox.addEventListener('change', (event) => {
                if (this.settingsManager) {
                    this.settingsManager.setSetting('highDPI', event.target.checked);
                }
            });
        }
        
        const debugInfoCheckbox = document.getElementById('debug-info-checkbox');
        if (debugInfoCheckbox) {
            debugInfoCheckbox.addEventListener('change', (event) => {
                const debugInfoElement = document.getElementById('debug-info');
                if (debugInfoElement) {
                    debugInfoElement.style.display = event.target.checked ? 'block' : 'none';
                }
            });
        }
    }
    
    /**
     * アプリイベントリスナー設定
     */
    setupAppEventListeners() {
        // キャンバス上のマウス座標更新
        if (this.app && this.app.view) {
            this.app.view.addEventListener('pointermove', (event) => {
                this.updateCoordinatesThrottled(event.offsetX, event.offsetY);
            });
        }
        
        // ウィンドウリサイズ対応
        window.addEventListener('resize', () => {
            this.handleWindowResize();
        });
        
        // キーボードショートカット（STEP 3更新: プレビューリセット削除）
        document.addEventListener('keydown', (event) => {
            this.handleKeyboardShortcuts(event);
        });
    }
    
    /**
     * キーボードショートカット処理（STEP 3更新: プレビューリセット削除）
     */
    handleKeyboardShortcuts(event) {
        // Ctrl+Z: アンドゥ
        if (event.ctrlKey && event.key === 'z' && !event.shiftKey) {
            event.preventDefault();
            if (this.historyManager && this.historyManager.canUndo()) {
                this.historyManager.undo();
                this.updateAllDisplays();
                this.showNotification('元に戻しました', 'info', 1500);
            }
            return;
        }
        
        // Ctrl+Shift+Z または Ctrl+Y: リドゥ
        if ((event.ctrlKey && event.shiftKey && event.key === 'Z') || 
            (event.ctrlKey && event.key === 'y')) {
            event.preventDefault();
            if (this.historyManager && this.historyManager.canRedo()) {
                this.historyManager.redo();
                this.updateAllDisplays();
                this.showNotification('やり直しました', 'info', 1500);
            }
            return;
        }
        
        // STEP 3削除: ペンツール専用ショートカット削除（drawing-tools/ui/に移譲完了）
        // - R: プリセットリセット → PenToolUI担当
        // - Shift+R: 全プレビューリセット → PreviewSync担当
    }
    
    updateCoordinatesThrottled(x, y) {
        if (this.coordinateUpdateThrottle) {
            clearTimeout(this.coordinateUpdateThrottle);
        }
        
        this.coordinateUpdateThrottle = setTimeout(() => {
            if (this.statusBar) {
                this.statusBar.updateCoordinates(x, y);
            }
        }, 16);
    }
    
    handleWindowResize() {
        if (this.popupManager) {
            this.popupManager.hideAllPopups();
        }
    }
    
    /**
     * リセット機能セットアップ（STEP 3更新: プレビューリセット削除）
     */
    setupResetFunctions() {
        // STEP 3削除: ペンツール専用リセット削除（drawing-tools/ui/に移譲完了）
        // - アクティブプリセットリセット → PenToolUI担当
        // - 全プリセットリセット → PenToolUI担当
        // - 全プレビューリセット → PreviewSync担当
        
        // キャンバスリセット（汎用機能として維持）
        const resetCanvasBtn = document.getElementById('reset-canvas');
        if (resetCanvasBtn) {
            resetCanvasBtn.addEventListener('click', () => {
                this.handleResetCanvas();
            });
        }
        
        console.log('🔄 汎用リセット機能設定完了（ペンツール専用機能は除外・drawing-tools/ui/に移譲完了）');
    }
    
    handleResetCanvas() {
        if (confirm('キャンバスを消去しますか？この操作は取り消すことができます。')) {
            if (this.app && this.app.clear) {
                this.app.clear();
                this.showNotification('キャンバスをクリアしました', 'info', 2000);
            }
        }
    }
    
    /**
     * 表示更新メソッド群（STEP 3更新: プレビュー連動機能削除）
     */
    updateAllDisplays() {
        try {
            this.updateToolDisplay();
            this.updateStatusDisplay(); // 外部システム統合
            
            // STEP 3削除: プレビュー連動機能削除
            // - updateSliderValuesFromToolsSystem() → PenToolUI担当
            // - プレビュー同期実行 → PreviewSync担当
            
            // 汎用プリセット表示更新のみ（プレビュー同期除外）
            if (this.presetDisplayManager && this.presetDisplayManager.updatePresetsDisplay) {
                this.presetDisplayManager.updatePresetsDisplay();
            }
            
        } catch (error) {
            console.warn('表示更新エラー:', error);
            this.handleError(error);
        }
    }
    
    updateToolDisplay() {
        if (this.toolsSystem && this.statusBar) {
            const currentTool = this.toolsSystem.getCurrentTool();
            this.statusBar.updateCurrentTool(currentTool);
            
            const brushSettings = this.toolsSystem.getBrushSettings();
            if (brushSettings) {
                this.statusBar.updateCurrentColor(brushSettings.color);
            }
        }
    }
    
    /**
     * ステータス表示更新（外部監視システム統合版）
     */
    updateStatusDisplay() {
        if (!this.statusBar) return;
        
        // アプリ統計
        if (this.app && this.app.getStats) {
            const appStats = this.app.getStats();
            if (appStats.width && appStats.height) {
                this.statusBar.updateCanvasInfo(appStats.width, appStats.height);
            }
        }
        
        // 外部監視システムからパフォーマンス統計取得
        let perfStats = null;
        
        // 1. SystemMonitor優先
        if (this.systemMonitor && this.systemMonitor.getSystemHealth) {
            const systemHealth = this.systemMonitor.getSystemHealth();
            if (systemHealth.currentMetrics) {
                perfStats = {
                    fps: systemHealth.currentMetrics.fps,
                    memoryUsage: systemHealth.currentMetrics.memoryUsage,
                    systemHealth: systemHealth.systemHealth
                };
            }
        }
        
        // 2. 外部PerformanceMonitor（フォールバック）
        if (!perfStats && this.externalPerformanceMonitor && this.externalPerformanceMonitor.getStats) {
            perfStats = this.externalPerformanceMonitor.getStats();
        }
        
        if (perfStats) {
            this.statusBar.updatePerformanceStats(perfStats);
        }
        
        // 履歴統計
        if (this.historyManager && this.historyManager.getStats) {
            const historyStats = this.historyManager.getStats();
            this.statusBar.updateHistoryStatus(historyStats);
        }
    }
    
    /**
     * STEP 3削除: ペンツール専用メソッド削除（drawing-tools/ui/に移譲完了）
     */
    // updateSliderValue() → PenToolUI担当
    // getAllSliderValues() → PenToolUI担当
    // selectPreset() → PenToolUI担当
    // selectNextPreset() → PenToolUI担当
    // selectPreviousPreset() → PenToolUI担当
    // resetActivePreset() → PenToolUI担当
    // resetAllPreviews() → PreviewSync担当
    // updatePresetLiveValues() → PreviewSync担当
    // updateActivePresetPreview() → PreviewSync担当
    // enablePreviewSync() → PreviewSync担当
    // disablePreviewSync() → PreviewSync担当
    // isPreviewSyncEnabled() → PreviewSync担当
    
    /**
     * プリセット管理アクセス（参照のみ・変更は専用モジュール担当）
     */
    getPenPresetManager() {
        return this.penPresetManager;
    }
    
    /**
     * パフォーマンス関連メソッド（外部システム統合版）
     */
    getPerformanceStats() {
        // 1. SystemMonitor優先
        if (this.systemMonitor && this.systemMonitor.getSystemHealth) {
            const systemHealth = this.systemMonitor.getSystemHealth();
            return {
                source: 'SystemMonitor',
                ...systemHealth.currentMetrics,
                systemHealth: systemHealth.systemHealth,
                uptime: systemHealth.uptime
            };
        }
        
        // 2. 外部PerformanceMonitor（フォールバック）
        if (this.externalPerformanceMonitor && this.externalPerformanceMonitor.getStats) {
            const stats = this.externalPerformanceMonitor.getStats();
            return {
                source: 'ExternalPerformanceMonitor',
                ...stats
            };
        }
        
        // 3. 基本情報のみ
        return {
            source: 'basic',
            fps: 60,
            memoryUsage: 'unknown',
            systemHealth: 'unknown'
        };
    }
    
    /**
     * ポップアップ関連メソッド
     */
    showPopup(popupId) {
        if (this.popupManager) {
            return this.popupManager.showPopup(popupId);
        }
        return false;
    }
    
    hidePopup(popupId) {
        if (this.popupManager) {
            return this.popupManager.hidePopup(popupId);
        }
        return false;
    }
    
    hideAllPopups() {
        if (this.popupManager) {
            this.popupManager.hideAllPopups();
        }
    }
    
    /**
     * 履歴管理関連メソッド
     */
    getHistoryManager() {
        return this.historyManager;
    }
    
    undo() {
        if (!this.historyManager) return false;
        
        const success = this.historyManager.undo();
        if (success) {
            this.updateAllDisplays();
        }
        return success;
    }
    
    redo() {
        if (!this.historyManager) return false;
        
        const success = this.historyManager.redo();
        if (success) {
            this.updateAllDisplays();
        }
        return success;
    }
    
    canUndo() {
        return this.historyManager ? this.historyManager.canUndo() : false;
    }
    
    canRedo() {
        return this.historyManager ? this.historyManager.canRedo() : false;
    }
    
    getHistoryStats() {
        return this.historyManager ? this.historyManager.getStats() : null;
    }
    
    /**
     * 通知表示
     */
    showNotification(message, type = 'info', duration = 3000) {
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'error' ? '#ff4444' : type === 'success' ? '#44ff44' : '#4444ff'};
            color: white;
            border-radius: 8px;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transition: opacity 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => notification.style.opacity = '1', 10);
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
    }
    
    showError(message, duration = 5000) {
        this.showNotification(message, 'error', duration);
    }
    
    /**
     * エラーハンドリング
     */
    handleError(error) {
        this.errorCount++;
        
        if (this.errorCount > this.maxErrors) {
            console.error(`UIManagerSystem: 最大エラー数 (${this.maxErrors}) に達しました。`);
            this.showError('UIシステムで重大なエラーが発生しました', 10000);
            return;
        }
        
        console.warn(`UIManagerSystem エラー ${this.errorCount}/${this.maxErrors}:`, error);
    }
    
    /**
     * 設定関連ハンドラ
     */
    setSettingsManager(settingsManager) {
        this.settingsManager = settingsManager;
    }
    
    handleSettingChange(key, newValue) {
        console.log(`設定変更: ${key} = ${newValue}`);
        
        switch (key) {
            case 'highDPI':
                this.handleHighDPIChange(newValue);
                break;
            case 'showDebugInfo':
                this.handleDebugInfoChange(newValue);
                break;
            // STEP 3削除: プレビュー同期設定削除
            // case 'previewSync': → PreviewSync担当
        }
    }
    
    handleSettingsLoaded(settings) {
        console.log('設定読み込み完了:', settings);
        
        if (settings.highDPI !== undefined) {
            const checkbox = document.getElementById('high-dpi-checkbox');
            if (checkbox) {
                checkbox.checked = settings.highDPI;
            }
        }
        
        if (settings.showDebugInfo !== undefined) {
            const checkbox = document.getElementById('debug-info-checkbox');
            if (checkbox) {
                checkbox.checked = settings.showDebugInfo;
            }
            this.handleDebugInfoChange(settings.showDebugInfo);
        }
        
        // STEP 3削除: プレビュー同期設定削除
        // if (settings.previewSync !== undefined) { → PreviewSync担当
    }
    
    handleHighDPIChange(enabled) {
        if (this.app && this.app.setHighDPI) {
            this.app.setHighDPI(enabled);
            this.showNotification(
                enabled ? '高DPI設定を有効にしました' : '高DPI設定を無効にしました',
                'info'
            );
        }
    }
    
    handleDebugInfoChange(enabled) {
        const debugElement = document.getElementById('debug-info');
        if (debugElement) {
            debugElement.style.display = enabled ? 'block' : 'none';
        }
    }
    
    /**
     * システム統計・デバッグ（STEP 3更新: プレビュー連動機能削除）
     */
    getUIStats() {
        const historyStats = this.getHistoryStats();
        const performanceStats = this.getPerformanceStats();
        
        return {
            initialized: this.isInitialized,
            activePopup: this.popupManager ? this.popupManager.getStatus().activePopup : null,
            sliderCount: this.sliders.size, // 汎用スライダーのみ
            errorCount: this.errorCount,
            maxErrors: this.maxErrors,
            penPresetManager: !!this.penPresetManager,
            historyStats: historyStats,
            performanceStats: performanceStats,
            components: {
                popupManager: !!this.popupManager,
                statusBar: !!this.statusBar,
                presetDisplayManager: !!this.presetDisplayManager,
                penPresetManager: !!this.penPresetManager,
                externalPerformanceMonitor: !!this.externalPerformanceMonitor,
                systemMonitor: !!this.systemMonitor,
                debugManager: !!this.debugManager,
                historyManager: !!this.historyManager
            },
            externalSystemsIntegration: {
                monitoringSystemsCount: [this.externalPerformanceMonitor, this.systemMonitor].filter(Boolean).length,
                debugSystemsIntegrated: !!this.debugManager
            }
        };
    }
    
    /**
     * UI統合デバッグ（STEP 3更新: プレビュー連動機能削除）
     */
    debugUI() {
        console.group('🔍 UIManagerSystem デバッグ情報（STEP 3クリーンアップ版・プレビュー連動機能削除）');
        
        console.log('基本情報:', {
            initialized: this.isInitialized,
            sliders: this.sliders.size, // 汎用スライダーのみ
            errorCount: `${this.errorCount}/${this.maxErrors}`
        });
        
        console.log('コンポーネント状態:', this.getUIStats().components);
        
        // STEP 3削除: プレビュー連動デバッグ削除
        // const previewStats = this.getPreviewSyncStats(); → PreviewSync担当
        
        // 外部システム統合状況
        const externalSystems = this.getUIStats().externalSystemsIntegration;
        console.log('外部システム統合状況:', externalSystems);
        
        // パフォーマンス統計（外部システム版）
        const perfStats = this.getPerformanceStats();
        console.log('パフォーマンス統計:', perfStats);
        
        if (this.penPresetManager && this.penPresetManager.getSystemStats) {
            console.log('PenPresetManager統計:', this.penPresetManager.getSystemStats());
        }
        
        if (this.historyManager) {
            console.log('履歴統計:', this.getHistoryStats());
        }
        
        console.log('🎯 STEP 3完了効果:');
        console.log('  ✅ プレビュー連動機能完全削除（約180行削除）');
        console.log('  ✅ drawing-tools/ui/への機能移譲完了');
        console.log('  ✅ 責務明確化（汎用UI管理のみ）');
        console.log('  ✅ 保守性大幅向上');
        
        console.groupEnd();
    }
    
    /**
     * 外部システム統合デバッグ
     */
    debugExternalSystems() {
        console.group('🔍 外部システム統合デバッグ情報（STEP 3クリーンアップ版）');
        
        console.log('統合状況:', {
            externalPerformanceMonitor: !!this.externalPerformanceMonitor,
            systemMonitor: !!this.systemMonitor,
            debugManager: !!this.debugManager
        });
        
        // SystemMonitor情報
        if (this.systemMonitor) {
            console.log('SystemMonitor状況:', {
                running: this.systemMonitor.isRunning,
                health: this.systemMonitor.getSystemHealth ? this.systemMonitor.getSystemHealth() : 'N/A'
            });
        }
        
        // 外部PerformanceMonitor情報
        if (this.externalPerformanceMonitor) {
            const stats = this.externalPerformanceMonitor.getStats ? 
                this.externalPerformanceMonitor.getStats() : null;
            console.log('外部PerformanceMonitor統計:', stats);
        }
        
        // DebugManager連携確認
        if (this.debugManager) {
            console.log('DebugManager連携: 利用可能');
        } else {
            console.log('DebugManager連携: 未連携');
        }
        
        console.groupEnd();
    }
    
    /**
     * 外部システム連携
     */
    onToolChange(newTool) {
        this.updateToolDisplay();
        
        // ツールボタンのアクティブ状態更新
        document.querySelectorAll('.tool-button').forEach(btn => 
            btn.classList.remove('active'));
        
        const toolButton = document.getElementById(`${newTool}-tool`);
        if (toolButton) {
            toolButton.classList.add('active');
        }
    }
    
    onBrushSettingsChange(settings) {
        // STEP 3削除: ペンツール専用処理削除（drawing-tools/ui/に移譲完了）
        // - スライダー更新 → PenToolUI担当
        // - プレビュー連動 → PreviewSync担当
        
        // 汎用UI更新のみ
        this.updateToolDisplay();
    }
    
    /**
     * クリーンアップ（STEP 3更新: プレビュー連動機能削除）
     */
    destroy() {
        try {
            console.log('🧹 UIManagerSystem クリーンアップ開始（STEP 3クリーンアップ版・プレビュー連動機能削除）');
            
            // STEP 3削除: プレビュー更新スロットリングクリア削除
            // if (this.previewUpdateThrottle) { → PreviewSync担当
            
            // 外部パフォーマンス監視停止（分離システム側で管理）
            if (this.externalPerformanceMonitor && this.externalPerformanceMonitor.stop) {
                this.externalPerformanceMonitor.stop();
                console.log('🛑 外部PerformanceMonitor停止');
            }
            
            // SystemMonitorは全体管理のため停止しない
            if (this.systemMonitor) {
                console.log('📊 SystemMonitorは全体管理のため継続実行');
            }
            
            // スライダーのクリーンアップ（汎用のみ）
            for (const slider of this.sliders.values()) {
                if (slider && slider.destroy) {
                    slider.destroy();
                }
            }
            this.sliders.clear();
            
            // タイムアウトのクリア
            if (this.coordinateUpdateThrottle) {
                clearTimeout(this.coordinateUpdateThrottle);
            }
            
            // 参照のクリア
            this.historyManager = null;
            this.penPresetManager = null;
            this.presetDisplayManager = null;
            this.externalPerformanceMonitor = null;
            this.systemMonitor = null;
            this.debugManager = null;
            this.popupManager = null;
            this.statusBar = null;
            this.settingsManager = null;
            
            console.log('✅ UIManagerSystem クリーンアップ完了（STEP 3クリーンアップ版・プレビュー連動機能削除）');
            
        } catch (error) {
            console.error('UIManagerSystem クリーンアップエラー:', error);
        }
    }
}

// ==== STEP 3クリーンアップ版: グローバル登録・エクスポート（プレビュー連動機能削除）====
if (typeof window !== 'undefined') {
    window.UIManager = UIManagerSystem;
    
    // STEP 3削除: プレビュー連動グローバル関数削除（drawing-tools/ui/に移譲完了）
    // window.debugPreviewSync = function() { → PreviewSync担当
    // window.resetAllPreviews = function() { → PreviewSync担当
    // window.togglePreviewSync = function() { → PreviewSync担当
    
    // 外部システム統合デバッグ関数（維持）
    window.debugUIExternalSystems = function() {
        if (window.uiManager && window.uiManager.debugExternalSystems) {
            window.uiManager.debugExternalSystems();
        } else {
            console.warn('UIManager が利用できません');
        }
    };
    
    window.debugUIIntegration = function() {
        console.group('🔍 UI統合デバッグ情報（STEP 3クリーンアップ版）');
        
        if (window.uiManager) {
            // 基本UI情報
            window.uiManager.debugUI();
            
            // 外部システム統合情報
            window.uiManager.debugExternalSystems();
            
            // STEP 3削除: プレビュー連動情報削除
            // window.uiManager.debugPreviewSync(); → PreviewSync担当
            
        } else {
            console.warn('UIManager が利用できません');
        }
        
        console.groupEnd();
    };
    
    console.log('✅ ui-manager.js STEP 3クリーンアップ版 読み込み完了');
    console.log('📦 エクスポートクラス（STEP 3クリーンアップ版）:');
    console.log('  ✅ UIManager: 汎用UI統合管理（プレビュー連動機能削除版）');
    console.log('🔧 STEP 3完了効果:');
    console.log('  ✅ プレビュー連動機能完全削除（約180行削減）');
    console.log('  ✅ drawing-tools/ui/への機能移譲完了');
    console.log('  ✅ 責務明確化（汎用UI管理のみ）');
    console.log('  ✅ 保守性大幅向上・バグリスク軽減');
    console.log('  ✅ SOLID原則準拠・単一責任原則達成');
    console.log('🎯 責務: 汎用UI制御・システム統合のみ（ペンツール専用機能は除外）');
    console.log('🐛 デバッグ関数（STEP 3クリーンアップ版）:');
    console.log('  - window.debugUIExternalSystems() - 外部システム統合状況表示');
    console.log('  - window.debugUIIntegration() - UI統合デバッグ情報表示');
    console.log('📊 移譲完了機能:');
    console.log('  🎨 ペンツール専用UI制御 → drawing-tools/ui/pen-tool-ui.js');
    console.log('  🔄 プレビュー連動処理 → drawing-tools/ui/components/preview-sync.js');
    console.log('  📋 ペンツール専用リセット → PenToolUI・PreviewSync担当');
    console.log('  ⌨️ ペンツール専用ショートカット → PenToolUI担当');
}

console.log('🏆 ui-manager.js STEP 3クリーンアップ版 初期化完了');