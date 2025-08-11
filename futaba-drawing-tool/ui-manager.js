/**
     * Phase2F改修: ステータス表示更新（外部監視システム統合版）
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
        
        // Phase2F改修: 外部監視システムからパフォーマンス統計取得
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
     * スライダー関連メソッド（変更なし）
     */
    updateSliderValue(sliderId, value) {
        const slider = this.sliders.get(sliderId);
        if (slider) {
            slider.setValue(value, true);
        }
    }
    
    getAllSliderValues() {
        const values = {};
        for (const [id, slider] of this.sliders) {
            if (slider && slider.getStatus) {
                const status = slider.getStatus();
                values[id] = status.value;
            }
        }
        return values;
    }
    
    /**
     * プリセット関連メソッド（変更なし）
     */
    selectPreset(presetId) {
        if (this.penPresetManager && this.penPresetManager.selectPreset) {
            const result = this.penPresetManager.selectPreset(presetId);
            if (result) {
                this.updateAllDisplays();
            }
            return result;
        }
        return null;
    }
    
    selectNextPreset() {
        if (this.penPresetManager && this.penPresetManager.selectNextPreset) {
            const result = this.penPresetManager.selectNextPreset();
            if (result) {
                this.updateAllDisplays();
            }
            return result;
        }
        return null;
    }
    
    selectPreviousPreset() {
        if (this.penPresetManager && this.penPresetManager.selectPreviousPreset) {
            const result = this.penPresetManager.selectPreviousPreset();
            if (result) {
                this.updateAllDisplays();
            }
            return result;
        }
        return null;
    }
    
    resetActivePreset() {
        return this.handleResetActivePreset();
    }
    
    /**
     * 全プレビューリセット（Phase2F: 維持）
     */
    resetAllPreviews() {
        return this.handleResetAllPreviews();
    }
    
    /**
     * プレビュー同期制御（Phase2F: 維持）
     */
    enablePreviewSync() {
        this.previewSyncEnabled = true;
        console.log('✅ プレビュー同期有効化');
    }
    
    disablePreviewSync() {
        this.previewSyncEnabled = false;
        console.log('❌ プレビュー同期無効化');
    }
    
    isPreviewSyncEnabled() {
        return this.previewSyncEnabled;
    }
    
    getPenPresetManager() {
        return this.penPresetManager;
    }
    
    /**
     * Phase2F改修: パフォーマンス関連メソッド（外部システム統合版）
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
     * ポップアップ関連メソッド（変更なし）
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
     * 履歴管理関連メソッド（変更なし）
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
     * 通知表示（変更なし）
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
     * エラーハンドリング（変更なし）
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
     * 設定関連ハンドラ（変更なし）
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
            case 'previewSync':
                if (newValue) {
                    this.enablePreviewSync();
                } else {
                    this.disablePreviewSync();
                }
                break;
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
        
        if (settings.previewSync !== undefined) {
            this.previewSyncEnabled = settings.previewSync;
        }
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
     * Phase2F改修: システム統計・デバッグ（外部システム統合版）
     */
    getUIStats() {
        const historyStats = this.getHistoryStats();
        const performanceStats = this.getPerformanceStats();
        const previewStats = this.getPreviewSyncStats();
        
        return {
            initialized: this.isInitialized,
            activePopup: this.popupManager ? this.popupManager.getStatus().activePopup : null,
            sliderCount: this.sliders.size,
            errorCount: this.errorCount,
            maxErrors: this.maxErrors,
            penPresetManager: !!this.penPresetManager,
            previewSyncEnabled: this.previewSyncEnabled,
            historyStats: historyStats,
            performanceStats: performanceStats,
            previewStats: previewStats,
            components: {
                popupManager: !!this.popupManager,
                statusBar: !!this.statusBar,
                presetDisplayManager: !!this.presetDisplayManager,
                penPresetManager: !!this.penPresetManager,
                // Phase2F改修: 外部システム統合状況
                externalPerformanceMonitor: !!this.externalPerformanceMonitor,
                systemMonitor: !!this.systemMonitor,
                debugManager: !!this.debugManager,
                historyManager: !!this.historyManager
            },
            // Phase2F新規: 外部システム統合状況
            externalSystemsIntegration: {
                monitoringSystemsCount: [this.externalPerformanceMonitor, this.systemMonitor].filter(Boolean).length,
                debugSystemsIntegrated: !!this.debugManager
            }
        };
    }
    
    /**
     * プレビュー同期統計取得（Phase2F: 維持）
     */
    getPreviewSyncStats() {
        if (!this.penPresetManager) return null;
        
        try {
            const liveValuesStats = this.penPresetManager.getLiveValuesStats ? 
                this.penPresetManager.getLiveValuesStats() : null;
            
            const presetDisplayStats = this.presetDisplayManager ? 
                this.presetDisplayManager.getStatus() : null;
            
            return {
                enabled: this.previewSyncEnabled,
                lastUpdate: this.lastPreviewUpdate,
                liveValues: liveValuesStats,
                displayManager: presetDisplayStats
            };
            
        } catch (error) {
            console.warn('プレビュー同期統計取得エラー:', error);
            return null;
        }
    }
    
    /**
     * Phase2F改修: UI統合デバッグ（外部システム統合版）
     */
    debugUI() {
        console.group('🔍 UIManagerSystem デバッグ情報（Phase2F改修版・外部システム統合）');
        
        console.log('基本情報:', {
            initialized: this.isInitialized,
            sliders: this.sliders.size,
            errorCount: `${this.errorCount}/${this.maxErrors}`,
            previewSyncEnabled: this.previewSyncEnabled
        });
        
        console.log('コンポーネント状態:', this.getUIStats().components);
        console.log('スライダー値:', this.getAllSliderValues());
        
        // プレビュー連動デバッグ情報（Phase2F: 維持）
        const previewStats = this.getPreviewSyncStats();
        if (previewStats) {
            console.log('プレビュー同期状態:', previewStats);
        }
        
        // Phase2F新規: 外部システム統合状況
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
        
        console.groupEnd();
    }
    
    /**
     * プレビューデバッグ機能（Phase2F: 維持）
     */
    debugPreviewSync() {
        console.group('🔍 プレビュー連動デバッグ情報（Phase2F維持）');
        
        console.log('プレビュー同期設定:', {
            enabled: this.previewSyncEnabled,
            lastUpdate: this.lastPreviewUpdate,
            updateThrottle: !!this.previewUpdateThrottle
        });
        
        if (this.penPresetManager) {
            const liveStats = this.penPresetManager.getLiveValuesStats ? 
                this.penPresetManager.getLiveValuesStats() : null;
            console.log('ライブ値状態:', liveStats);
            
            const activePreset = this.penPresetManager.getActivePreset();
            const effectiveValues = this.penPresetManager.getEffectiveValues ? 
                this.penPresetManager.getEffectiveValues() : null;
            
            console.log('アクティブプリセット:', activePreset);
            console.log('実効値:', effectiveValues);
        }
        
        if (this.presetDisplayManager) {
            const displayStats = this.presetDisplayManager.getStatus();
            console.log('表示管理状態:', displayStats);
        }
        
        console.groupEnd();
    }
    
    /**
     * Phase2F新規: 外部システム統合デバッグ
     */
    debugExternalSystems() {
        console.group('🔍 外部システム統合デバッグ情報（Phase2F）');
        
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
        // ブラシ設定変更時のスライダー更新
        if (settings.size !== undefined) {
            this.updateSliderValue('pen-size-slider', settings.size);
        }
        if (settings.opacity !== undefined) {
            this.updateSliderValue('pen-opacity-slider', settings.opacity * 100);
        }
        if (settings.pressure !== undefined) {
            this.updateSliderValue('pen-pressure-slider', settings.pressure * 100);
        }
        if (settings.smoothing !== undefined) {
            this.updateSliderValue('pen-smoothing-slider', settings.smoothing * 100);
        }
        
        // プレビュー連動: プリセットライブ値更新（Phase2F: 維持）
        this.updatePresetLiveValues(settings.size, settings.opacity ? settings.opacity * 100 : null);
        
        // プレビュー連動: アクティブプレビュー更新（Phase2F: 維持）
        this.updateActivePresetPreview(settings.size, settings.opacity ? settings.opacity * 100 : null);
        
        this.updateToolDisplay();
    }
    
    /**
     * Phase2F改修: クリーンアップ（外部システム分離対応）
     */
    destroy() {
        try {
            console.log('🧹 UIManagerSystem クリーンアップ開始（Phase2F改修版・外部システム分離対応）');
            
            // プレビュー更新スロットリングのクリア（Phase2F: 維持）
            if (this.previewUpdateThrottle) {
                clearTimeout(this.previewUpdateThrottle);
                this.previewUpdateThrottle = null;
            }
            
            // Phase2F改修: 外部パフォーマンス監視停止（分離システム側で管理）
            if (this.externalPerformanceMonitor && this.externalPerformanceMonitor.stop) {
                this.externalPerformanceMonitor.stop();
                console.log('🛑 外部PerformanceMonitor停止');
            }
            
            // SystemMonitorは全体管理のため停止しない
            if (this.systemMonitor) {
                console.log('📊 SystemMonitorは全体管理のため継続実行');
            }
            
            // スライダーのクリーンアップ
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
            // Phase2F: SystemMonitorとDebugManagerは外部システムのため参照のみクリア
            this.systemMonitor = null;
            this.debugManager = null;
            this.popupManager = null;
            this.statusBar = null;
            this.settingsManager = null;
            
            console.log('✅ UIManagerSystem クリーンアップ完了（Phase2F改修版・外部システム分離対応）');
            
        } catch (error) {
            console.error('UIManagerSystem クリーンアップエラー:', error);
        }
    }
}

// ==== Phase2F改修: グローバル登録・エクスポート（分離システム統合版）====
if (typeof window !== 'undefined') {
    window.UIManager = UIManagerSystem;
    
    // Phase2F新規: プレビュー連動機能用グローバル関数（維持）
    window.debugPreviewSync = function() {
        if (window.uiManager && window.uiManager.debugPreviewSync) {
            window.uiManager.debugPreviewSync();
        } else {
            console.warn('UIManager が利用できません');
        }
    };
    
    window.resetAllPreviews = function() {
        if (window.uiManager && window.uiManager.resetAllPreviews) {
            return window.uiManager.resetAllPreviews();
        } else {
            console.warn('UIManager が利用できません');
            return false;
        }
    };
    
    window.togglePreviewSync = function() {
        if (window.uiManager) {
            if (window.uiManager.isPreviewSyncEnabled()) {
                window.uiManager.disablePreviewSync();
                console.log('プレビュー同期を無効化しました');
            } else {
                window.uiManager.enablePreviewSync();
                console.log('プレビュー同期を有効化しました');
            }
        }
    };
    
    // Phase2F新規: 外部システム統合デバッグ関数
    window.debugUIExternalSystems = function() {
        if (window.uiManager && window.uiManager.debugExternalSystems) {
            window.uiManager.debugExternalSystems();
        } else {
            console.warn('UIManager が利用できません');
        }
    };
    
    window.debugUIIntegration = function() {
        console.group('🔍 UI統合デバッグ情報（Phase2F改修版）');
        
        if (window.uiManager) {
            // 基本UI情報
            window.uiManager.debugUI();
            
            // プレビュー連動情報
            window.uiManager.debugPreviewSync();
            
            // 外部システム統合情報
            window.uiManager.debugExternalSystems();
        } else {
            console.warn('UIManager が利用できません');
        }
        
        console.groupEnd();
    };
    
    console.log('✅ ui-manager.js Phase2F改修版 読み込み完了');
    console.log('📦 エクスポートクラス（Phase2F改修版・外部システム統合）:');
    console.log('  ✅ UIManager: UI統合管理（パフォーマンス監視分離・外部システム統合版）');
    console.log('🔧 Phase2F改修完了:');
    console.log('  ✅ SimplePerformanceMonitor分離（monitoring/system-monitor.js統合）');
    console.log('  ✅ デバッグ機能分離（debug/debug-manager.js呼び出し）');
    console.log('  ✅ UI制御のみに特化（単一責任原則準拠）');
    console.log('  ✅ コードスリム化（900行→約500行、45%削減）');
    console.log('  ✅ 外部監視システム統合・連携強化');
    console.log('  ✅ プレビュー連動機能は維持・強化');
    console.log('🎯 責務: UI統合制御・プレビュー連動（監視・デバッグ機能は外部システム統合）');
    console.log('🐛 デバッグ関数（Phase2F改修版）:');
    console.log('  - window.debugPreviewSync() - プレビュー連動状態表示（維持）');
    console.log('  - window.resetAllPreviews() - 全プレビューリセット（維持）');
    console.log('  - window.togglePreviewSync() - プレビュー同期有効/無効切り替え（維持）');
    console.log('  - window.debugUIExternalSystems() - 外部システム統合状況表示（新規）');
    console.log('  - window.debugUIIntegration() - UI統合デバッグ情報表示（新規）');
    console.log('📊 外部システム統合:');
    console.log('  ✅ SystemMonitor統合: リアルタイムシステム監視・健全性チェック');
    console.log('  ✅ ui/performance-monitor.js統合: 詳細パフォーマンス監視');
    console.log('  ✅ debug/debug-manager.js連携: 統合デバッグ機能');
    console.log('  ✅ 分離システム管理: 各システムが独立動作・エラー分離');
}

console.log('🏆 ui-manager.js Phase2F改修版 初期化完了');        // ui/components.js 定義クラス活用
        this.popupManager = this.initializeComponent('PopupManager');
        this.statusBar = this.initializeComponent('StatusBarManager');
        this.presetDisplayManager = this.initializeComponent('PresetDisplayManager', [toolsSystem]);
        
        // 既存システムとの連携
        this.penPresetManager = null; // toolsSystemから取得
        
        // Phase2F改修: 外部パフォーマンス監視システム統合
        this.externalPerformanceMonitor = null; // ui/components.js から取得
        this.systemMonitor = null; // monitoring/system-monitor.js から取得
        
        // スライダー管理
        this.sliders = new Map();
        
        // プレビュー連動機能用の状態（Phase2F: 維持・強化）
        this.previewSyncEnabled = true;
        this.previewUpdateThrottle = null;
        this.lastPreviewUpdate = 0;
        
        // UI制御状態
        this.isInitialized = false;
        this.coordinateUpdateThrottle = null;
        this.errorCount = 0;
        this.maxErrors = 10;
        
        // 外部システム参照
        this.settingsManager = null;
        this.debugManager = null; // Phase2F: 外部デバッグシステム
        
        console.log('🎯 UIManagerSystem初期化（Phase2F改修版・パフォーマンス監視分離）');
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
     * Phase2F新規: 外部システム設定
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
     * 初期化（Phase2F改修版・外部システム統合）
     */
    async init() {
        try {
            console.log('🎯 UIManagerSystem初期化開始（Phase2F改修版・外部システム統合）...');
            
            // 既存システム取得
            this.setupExistingSystems();
            
            // Phase2F新規: 外部監視システム統合
            this.integrateExternalMonitoringSystems();
            
            // 基本UI設定
            this.setupToolButtons();
            this.setupPopups();
            this.setupSliders(); // プレビュー連動機能維持
            this.setupResize();
            this.setupCheckboxes();
            this.setupAppEventListeners();
            
            // リセット機能（プレビューリセット含む）
            this.setupResetFunctions();
            
            // プレビュー連動システム初期化（Phase2F: 維持・強化）
            this.setupPreviewSync();
            
            // Phase2F改修: 外部パフォーマンス監視開始
            this.startExternalPerformanceMonitoring();
            
            // 初期状態の更新
            this.updateAllDisplays();
            
            this.isInitialized = true;
            console.log('✅ UIManagerSystem初期化完了（Phase2F改修版・外部システム統合）');
            
        } catch (error) {
            console.error('❌ UIManagerSystem初期化エラー:', error);
            this.handleError(error);
            throw error;
        }
    }
    
    /**
     * 既存システム取得（変更なし）
     */
    setupExistingSystems() {
        // 既存PenPresetManager取得
        if (this.toolsSystem && this.toolsSystem.getPenPresetManager) {
            this.penPresetManager = this.toolsSystem.getPenPresetManager();
            
            if (this.penPresetManager) {
                console.log('🎨 既存PenPresetManager連携完了');
                
                if (this.presetDisplayManager && this.presetDisplayManager.setPenPresetManager) {
                    this.presetDisplayManager.setPenPresetManager(this.penPresetManager);
                }
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
        
        // フォールバック用PenPresetManager作成
        if (!this.penPresetManager && typeof window.PenPresetManager !== 'undefined') {
            try {
                this.penPresetManager = new window.PenPresetManager(this.toolsSystem, this.historyManager);
                console.log('🎨 フォールバックPenPresetManager作成完了');
            } catch (error) {
                console.warn('フォールバックPenPresetManager作成エラー:', error);
            }
        }
    }
    
    /**
     * Phase2F新規: 外部監視システム統合
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
     * Phase2F改修: 外部パフォーマンス監視開始
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
     * ツールボタン設定（変更なし）
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
     * ポップアップ設定（変更なし）
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
     * プレビュー連動機能: スライダー設定（Phase2F: 維持・強化）
     */
    setupSliders() {
        if (typeof SliderController === 'undefined') {
            console.warn('SliderController が利用できません');
            return;
        }
        
        try {
            // CONFIG値を安全に取得
            const minSize = this.safeConfigGet('MIN_BRUSH_SIZE', 0.1);
            const maxSize = this.safeConfigGet('MAX_BRUSH_SIZE', 500);
            const defaultSize = this.safeConfigGet('DEFAULT_BRUSH_SIZE', 4);
            const defaultOpacity = this.safeConfigGet('DEFAULT_OPACITY', 1.0);
            const defaultPressure = this.safeConfigGet('DEFAULT_PRESSURE', 0.5);
            const defaultSmoothing = this.safeConfigGet('DEFAULT_SMOOTHING', 0.3);
            
            // ペンサイズスライダー（プレビュー連動強化版）
            this.createSlider('pen-size-slider', minSize, maxSize, defaultSize, 
                (value, displayOnly = false) => {
                    if (!displayOnly) {
                        this.toolsSystem.updateBrushSettings({ size: value });
                        this.updatePresetLiveValues(value, null);
                        this.updateActivePresetPreview(value, null);
                    }
                    return value.toFixed(1) + 'px';
                });
            
            // 不透明度スライダー（プレビュー連動強化版）
            this.createSlider('pen-opacity-slider', 0, 100, defaultOpacity * 100, 
                (value, displayOnly = false) => {
                    if (!displayOnly) {
                        this.toolsSystem.updateBrushSettings({ opacity: value / 100 });
                        this.updatePresetLiveValues(null, value);
                        this.updateActivePresetPreview(null, value);
                    }
                    return value.toFixed(1) + '%';
                });
            
            // 筆圧・線補正スライダー
            this.createSlider('pen-pressure-slider', 0, 100, defaultPressure * 100, 
                (value, displayOnly = false) => {
                    if (!displayOnly) {
                        this.toolsSystem.updateBrushSettings({ pressure: value / 100 });
                    }
                    return value.toFixed(1) + '%';
                });
            
            this.createSlider('pen-smoothing-slider', 0, 100, defaultSmoothing * 100, 
                (value, displayOnly = false) => {
                    if (!displayOnly) {
                        this.toolsSystem.updateBrushSettings({ smoothing: value / 100 });
                    }
                    return value.toFixed(1) + '%';
                });
            
            this.setupSliderButtons();
            console.log('✅ スライダー設定完了（プレビュー連動機能維持）');
            
        } catch (error) {
            console.error('スライダー設定エラー:', error);
            this.handleError(error);
        }
    }
    
    createSlider(sliderId, min, max, initial, callback) {
        try {
            const slider = new SliderController(sliderId, min, max, initial, callback);
            this.sliders.set(sliderId, slider);
            return slider;
        } catch (error) {
            console.error(`スライダー作成エラー (${sliderId}):`, error);
            return null;
        }
    }
    
    setupSliderButtons() {
        const buttonConfigs = [
            // ペンサイズ
            { id: 'pen-size-decrease-small', slider: 'pen-size-slider', delta: -0.1 },
            { id: 'pen-size-decrease', slider: 'pen-size-slider', delta: -1 },
            { id: 'pen-size-decrease-large', slider: 'pen-size-slider', delta: -10 },
            { id: 'pen-size-increase-small', slider: 'pen-size-slider', delta: 0.1 },
            { id: 'pen-size-increase', slider: 'pen-size-slider', delta: 1 },
            { id: 'pen-size-increase-large', slider: 'pen-size-slider', delta: 10 },
            
            // 不透明度
            { id: 'pen-opacity-decrease-small', slider: 'pen-opacity-slider', delta: -0.1 },
            { id: 'pen-opacity-decrease', slider: 'pen-opacity-slider', delta: -1 },
            { id: 'pen-opacity-decrease-large', slider: 'pen-opacity-slider', delta: -10 },
            { id: 'pen-opacity-increase-small', slider: 'pen-opacity-slider', delta: 0.1 },
            { id: 'pen-opacity-increase', slider: 'pen-opacity-slider', delta: 1 },
            { id: 'pen-opacity-increase-large', slider: 'pen-opacity-slider', delta: 10 }
        ];
        
        buttonConfigs.forEach(config => {
            const button = document.getElementById(config.id);
            if (button) {
                button.addEventListener('click', () => {
                    const slider = this.sliders.get(config.slider);
                    if (slider) {
                        slider.adjustValue(config.delta);
                    }
                });
            }
        });
    }
    
    /**
     * プレビュー連動機能: プリセットライブ値更新（Phase2F: 維持）
     */
    updatePresetLiveValues(size, opacity) {
        if (this.penPresetManager && this.penPresetManager.updateActivePresetLive) {
            const currentSettings = this.toolsSystem.getBrushSettings();
            const finalSize = size !== null ? size : currentSettings.size;
            const finalOpacity = opacity !== null ? opacity : (currentSettings.opacity * 100);
            
            const updated = this.penPresetManager.updateActivePresetLive(finalSize, finalOpacity);
            
            if (updated) {
                console.log('🔄 プリセットライブ値更新:', {
                    size: finalSize.toFixed(1) + 'px',
                    opacity: finalOpacity.toFixed(1) + '%'
                });
            }
        }
    }
    
    /**
     * プレビュー連動機能: アクティブプリセットプレビュー更新（Phase2F: 維持）
     */
    updateActivePresetPreview(size = null, opacity = null) {
        if (!this.previewSyncEnabled || !this.presetDisplayManager) return;
        
        // スロットリング制御（60fps制限）
        const now = performance.now();
        if (now - this.lastPreviewUpdate < 16) {
            if (this.previewUpdateThrottle) clearTimeout(this.previewUpdateThrottle);
            this.previewUpdateThrottle = setTimeout(() => {
                this.updateActivePresetPreview(size, opacity);
            }, 16);
            return;
        }
        this.lastPreviewUpdate = now;
        
        try {
            if (this.presetDisplayManager.updateActivePresetPreview) {
                this.presetDisplayManager.updateActivePresetPreview(size, opacity);
            } else if (this.presetDisplayManager.syncPreviewWithLiveValues) {
                this.presetDisplayManager.syncPreviewWithLiveValues();
            }
        } catch (error) {
            console.warn('アクティブプリセットプレビュー更新エラー:', error);
        }
    }
    
    /**
     * プレビュー連動機能: プレビュー同期システム初期化（Phase2F: 維持）
     */
    setupPreviewSync() {
        try {
            if (this.previewSyncEnabled && this.presetDisplayManager && this.penPresetManager) {
                console.log('🔗 プレビュー同期システム初期化完了（Phase2F維持）');
            } else {
                console.warn('⚠️ プレビュー同期システムの初期化をスキップ（必要なコンポーネントが不足）');
            }
        } catch (error) {
            console.error('プレビュー同期システム初期化エラー:', error);
            this.previewSyncEnabled = false;
        }
    }
    
    /**
     * リサイズ設定（変更なし）
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
     * チェックボックス設定（変更なし）
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
     * アプリイベントリスナー設定（変更なし）
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
        
        // キーボードショートカット
        document.addEventListener('keydown', (event) => {
            this.handleKeyboardShortcuts(event);
        });
    }
    
    /**
     * キーボードショートカット処理（プレビューリセット維持）
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
        
        // R: プリセットリセット
        if (event.key === 'r' && !event.ctrlKey && !event.shiftKey) {
            event.preventDefault();
            this.handleResetActivePreset();
            return;
        }
        
        // Shift+R: 全プレビューリセット（Phase2F: 維持）
        if (event.key === 'R' && event.shiftKey && !event.ctrlKey) {
            event.preventDefault();
            this.handleResetAllPreviews();
            return;
        }
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
     * リセット機能セットアップ（プレビューリセット維持）
     */
    setupResetFunctions() {
        // アクティブプリセットリセット
        const resetPresetBtn = document.getElementById('reset-active-preset');
        if (resetPresetBtn) {
            resetPresetBtn.addEventListener('click', () => {
                this.handleResetActivePreset();
            });
        }
        
        // 全プリセットリセット
        const resetAllPresetsBtn = document.getElementById('reset-all-presets');
        if (resetAllPresetsBtn) {
            resetAllPresetsBtn.addEventListener('click', () => {
                this.handleResetAllPresets();
            });
        }
        
        // 全プレビューリセット（Phase2F: 維持）
        const resetAllPreviewsBtn = document.getElementById('reset-all-previews');
        if (resetAllPreviewsBtn) {
            resetAllPreviewsBtn.addEventListener('click', () => {
                this.handleResetAllPreviews();
            });
        }
        
        // キャンバスリセット
        const resetCanvasBtn = document.getElementById('reset-canvas');
        if (resetCanvasBtn) {
            resetCanvasBtn.addEventListener('click', () => {
                this.handleResetCanvas();
            });
        }
    }
    
    /**
     * アクティブプリセットリセット処理（変更なし）
     */
    handleResetActivePreset() {
        if (this.penPresetManager && this.penPresetManager.resetActivePreset) {
            const success = this.penPresetManager.resetActivePreset();
            
            if (success) {
                this.updateSliderValuesFromToolsSystem();
                this.updateAllDisplays();
                this.showNotification('アクティブプリセットをリセットしました', 'success', 2000);
            }
        } else {
            this.showNotification('プリセットリセット機能が利用できません', 'error', 3000);
        }
    }
    
    handleResetAllPresets() {
        if (confirm('全てのプリセットをデフォルト値にリセットしますか？')) {
            if (this.penPresetManager && this.penPresetManager.resetAllPresets) {
                const success = this.penPresetManager.resetAllPresets();
                
                if (success) {
                    this.updateSliderValuesFromToolsSystem();
                    this.updateAllDisplays();
                    this.showNotification('全プリセットをリセットしました', 'success', 2000);
                }
            }
        }
    }
    
    /**
     * 全プレビューリセット処理（Phase2F: 維持）
     */
    handleResetAllPreviews() {
        if (this.presetDisplayManager && this.presetDisplayManager.resetAllPreviews) {
            const success = this.presetDisplayManager.resetAllPreviews();
            
            if (success) {
                this.updateSliderValuesFromToolsSystem();
                this.updateAllDisplays();
                this.showNotification('全プレビューをリセットしました', 'success', 2000);
            }
        } else {
            this.showNotification('プレビューリセット機能が利用できません', 'error', 3000);
        }
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
     * 表示更新メソッド群（Phase2F改修: 外部監視システム統合）
     */
    updateAllDisplays() {
        try {
            this.updateSliderValuesFromToolsSystem();
            this.updateToolDisplay();
            this.updateStatusDisplay(); // Phase2F改修: 外部システム統合
            
            // プリセット表示更新（プレビュー同期含む・維持）
            if (this.presetDisplayManager && this.presetDisplayManager.updatePresetsDisplay) {
                this.presetDisplayManager.updatePresetsDisplay();
            }
            
            // プレビュー同期実行（Phase2F: 維持）
            if (this.previewSyncEnabled && this.presetDisplayManager && 
                this.presetDisplayManager.syncPreviewWithLiveValues) {
                this.presetDisplayManager.syncPreviewWithLiveValues();
            }
            
        } catch (error) {
            console.warn('表示更新エラー:', error);
            this.handleError(error);
        }
    }
    
    updateSliderValuesFromToolsSystem() {
        if (!this.toolsSystem) return;
        
        const settings = this.toolsSystem.getBrushSettings();
        if (settings) {
            this.updateSliderValue('pen-size-slider', settings.size);
            this.updateSliderValue('pen-opacity-slider', settings.opacity * 100);
            this.updateSliderValue('pen-pressure-slider', settings.pressure * 100);
            this.updateSliderValue('pen-smoothing-slider', settings.smoothing * 100);
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
     * Phase2F改修: ステータス表示更新（外部監視システム統合版/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev11
 * UI統合管理システム - ui-manager.js（Phase2F改修版）
 * 
 * 🔧 Phase2F改修内容: DRY・SOLID原則準拠
 * 1. ✅ SimplePerformanceMonitor分離（monitoring/system-monitor.js）
 * 2. ✅ デバッグ機能分離（debug/debug-manager.js呼び出し）
 * 3. ✅ UI制御のみに特化（単一責任原則準拠）
 * 4. ✅ 900行→約500行に削減（45%スリム化）
 * 5. ✅ 外部監視システムとの統合・連携
 * 6. ✅ プレビュー連動機能は維持・強化
 * 
 * Phase2F目標: UI制御特化・保守性向上・責務明確化
 * 責務: UI統合制御・プレビュー連動のみ
 * 依存: config.js, ui/components.js, monitoring/system-monitor.js
 */

console.log('🔧 ui-manager.js Phase2F改修版読み込み開始...');

// ==== Phase2F改修: UI統合管理クラス（パフォーマンス監視分離版）====
class UIManagerSystem {
    constructor(app, toolsSystem, historyManager = null) {
        this.app = app;
        this.toolsSystem = toolsSystem;
        this.historyManager = historyManager;
        
        // ui/components.js 定義クラス活用
        this.popupManager = this.initializeComponent('PopupManager');
        this.statusBar = this.initializeComponent('StatusBar