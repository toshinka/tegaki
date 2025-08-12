/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール
 * PenToolUI - drawing-tools/ui/pen-tool-ui.js (STEP 4更新版)
 * 
 * ⚡ STEP 4更新: PopupManagerコンポーネント統合
 * 🎯 目的: ペンツール専用ポップアップ制御の完全統合
 * 
 * 📦 更新内容:
 * - PopupManagerコンポーネント統合・初期化
 * - ツールボタンクリック時のポップアップ制御
 * - ESC/外部クリック対応の統合
 * - デバッグ機能拡張（PopupManager統合状況表示）
 * 
 * 🏗️ 設計原則: SOLID・DRY準拠、単一責任、依存注入
 */

console.log('🔧 PenToolUI (STEP 4更新版) 読み込み開始...');

// ==== CONFIG値安全取得（utils.js統合）====
function safeConfigGet(key, defaultValue) {
    try {
        if (window.CONFIG && window.CONFIG[key] !== undefined && window.CONFIG[key] !== null) {
            return window.CONFIG[key];
        }
    } catch (error) {
        console.warn(`CONFIG.${key} アクセスエラー:`, error);
    }
    return defaultValue;
}

/**
 * PenToolUI統合クラス（STEP 4更新版）
 * ペンツール専用UI制御の完全統合システム
 */
class PenToolUI {
    constructor(drawingToolsSystem) {
        console.log('🎨 PenToolUI (STEP 4更新版) 初期化開始...');
        
        this.drawingToolsSystem = drawingToolsSystem;
        
        // 基本設定
        this.maxErrors = safeConfigGet('MAX_ERRORS', 10);
        this.targetFPS = safeConfigGet('TARGET_FPS', 60);
        
        // 状態管理
        this.isInitialized = false;
        this.errorCount = 0;
        
        // STEP 2: スライダー制御統合
        this.sliders = new Map();
        this.sliderUpdateThrottle = null;
        this.lastSliderUpdate = 0;
        
        // STEP 3: PreviewSyncコンポーネント統合
        this.previewSync = null;
        this.previewSyncEnabled = true;
        
        // STEP 4新規: PopupManagerコンポーネント統合
        this.popupManager = null;
        this.popupIntegrationEnabled = true;
        
        // キーボードショートカット管理
        this.keyboardShortcuts = new Map();
        this.shortcutEnabled = true;
        
        // 外部システム参照
        this.penPresetManager = null;
        this.presetDisplayManager = null;
        
        // 統計・デバッグ情報
        this.sliderUpdateCount = 0;
        this.previewUpdateCount = 0;
        this.popupActionCount = 0; // STEP 4新規
        this.shortcutTriggerCount = 0;
        
        console.log('✅ PenToolUI (STEP 4更新版) 初期化完了');
    }
    
    /**
     * PenToolUI初期化（STEP 4更新版）
     */
    async init() {
        try {
            console.log('🎯 PenToolUI (STEP 4更新版) 初期化開始...');
            
            // 外部システム取得
            this.setupExternalSystems();
            
            // STEP 2: スライダー制御初期化
            this.initializeSliders();
            
            // STEP 3: プレビューシンクコンポーネント初期化
            await this.initializePreviewSync();
            
            // STEP 4新規: PopupManagerコンポーネント初期化
            await this.initializePopupManager();
            
            // キーボードショートカット初期化
            this.initializeKeyboardShortcuts();
            
            // ツールボタン連携初期化（STEP 4更新）
            this.initializeToolButtonIntegration();
            
            this.isInitialized = true;
            console.log('✅ PenToolUI (STEP 4更新版) 初期化完了');
            
        } catch (error) {
            console.error('❌ PenToolUI初期化エラー:', error);
            this.handleError(error);
            throw error;
        }
    }
    
    /**
     * 外部システムセットアップ
     */
    setupExternalSystems() {
        // PenPresetManager取得
        if (this.drawingToolsSystem.getPenPresetManager) {
            this.penPresetManager = this.drawingToolsSystem.getPenPresetManager();
            console.log('🎨 PenPresetManager連携:', !!this.penPresetManager);
        }
        
        // PresetDisplayManager取得（ui/components.js経由）
        if (typeof window.PresetDisplayManager !== 'undefined') {
            try {
                this.presetDisplayManager = new window.PresetDisplayManager(this.drawingToolsSystem);
                if (this.penPresetManager && this.presetDisplayManager.setPenPresetManager) {
                    this.presetDisplayManager.setPenPresetManager(this.penPresetManager);
                }
                console.log('📊 PresetDisplayManager連携完了');
            } catch (error) {
                console.warn('PresetDisplayManager初期化エラー:', error);
            }
        }
        
        console.log('🔗 外部システム連携完了');
    }
    
    /**
     * STEP 4新規: PopupManagerコンポーネント初期化
     */
    async initializePopupManager() {
        try {
            console.log('📦 PopupManagerコンポーネント初期化開始...');
            
            // PopupManagerクラス確認
            if (typeof window.PopupManager === 'undefined') {
                console.warn('❌ PopupManagerクラスが利用できません');
                this.popupIntegrationEnabled = false;
                return;
            }
            
            // PopupManagerインスタンス作成
            this.popupManager = new window.PopupManager();
            
            // PopupManager初期化
            await this.popupManager.init();
            
            console.log('✅ PopupManagerコンポーネント初期化完了');
            
        } catch (error) {
            console.error('❌ PopupManagerコンポーネント初期化エラー:', error);
            this.popupIntegrationEnabled = false;
            this.handleError(error);
        }
    }
    
    /**
     * STEP 3: PreviewSyncコンポーネント初期化
     */
    async initializePreviewSync() {
        try {
            console.log('🔄 PreviewSyncコンポーネント初期化開始...');
            
            // PreviewSyncクラス確認
            if (typeof window.PreviewSync === 'undefined') {
                console.warn('❌ PreviewSyncクラスが利用できません');
                this.previewSyncEnabled = false;
                return;
            }
            
            // PreviewSyncインスタンス作成（依存注入）
            this.previewSync = new window.PreviewSync(
                this.penPresetManager,
                this.presetDisplayManager,
                this.targetFPS
            );
            
            // PreviewSync初期化
            await this.previewSync.init();
            
            console.log('✅ PreviewSyncコンポーネント初期化完了');
            
        } catch (error) {
            console.error('❌ PreviewSyncコンポーネント初期化エラー:', error);
            this.previewSyncEnabled = false;
            this.handleError(error);
        }
    }
    
    /**
     * STEP 2: スライダー制御初期化
     */
    initializeSliders() {
        try {
            console.log('🎛️ ペンツール専用スライダー初期化開始...');
            
            if (typeof window.SliderController === 'undefined') {
                console.warn('❌ SliderControllerが利用できません');
                return;
            }
            
            // CONFIG値取得
            const minSize = safeConfigGet('MIN_BRUSH_SIZE', 0.1);
            const maxSize = safeConfigGet('MAX_BRUSH_SIZE', 500);
            const defaultSize = safeConfigGet('DEFAULT_BRUSH_SIZE', 4);
            const defaultOpacity = safeConfigGet('DEFAULT_OPACITY', 1.0);
            const defaultPressure = safeConfigGet('DEFAULT_PRESSURE', 0.5);
            const defaultSmoothing = safeConfigGet('DEFAULT_SMOOTHING', 0.3);
            
            // ペンサイズスライダー（PreviewSync統合版）
            this.createSlider('pen-size-slider', minSize, maxSize, defaultSize, 
                (value, displayOnly = false) => {
                    if (!displayOnly) {
                        this.drawingToolsSystem.updateBrushSettings({ size: value });
                        this.syncWithPreviewSystem({ size: value });
                    }
                    return value.toFixed(1) + 'px';
                });
            
            // 不透明度スライダー（PreviewSync統合版）
            this.createSlider('pen-opacity-slider', 0, 100, defaultOpacity * 100, 
                (value, displayOnly = false) => {
                    if (!displayOnly) {
                        this.drawingToolsSystem.updateBrushSettings({ opacity: value / 100 });
                        this.syncWithPreviewSystem({ opacity: value });
                    }
                    return value.toFixed(1) + '%';
                });
            
            // 筆圧・線補正スライダー
            this.createSlider('pen-pressure-slider', 0, 100, defaultPressure * 100, 
                (value, displayOnly = false) => {
                    if (!displayOnly) {
                        this.drawingToolsSystem.updateBrushSettings({ pressure: value / 100 });
                    }
                    return value.toFixed(1) + '%';
                });
            
            this.createSlider('pen-smoothing-slider', 0, 100, defaultSmoothing * 100, 
                (value, displayOnly = false) => {
                    if (!displayOnly) {
                        this.drawingToolsSystem.updateBrushSettings({ smoothing: value / 100 });
                    }
                    return value.toFixed(1) + '%';
                });
            
            console.log('✅ ペンツール専用スライダー初期化完了');
            
        } catch (error) {
            console.error('❌ スライダー初期化エラー:', error);
            this.handleError(error);
        }
    }
    
    createSlider(sliderId, min, max, initial, callback) {
        try {
            const slider = new window.SliderController(sliderId, min, max, initial, callback);
            this.sliders.set(sliderId, slider);
            return slider;
        } catch (error) {
            console.error(`スライダー作成エラー (${sliderId}):`, error);
            return null;
        }
    }
    
    /**
     * STEP 4新規: ツールボタン連携初期化（ポップアップ統合版）
     */
    initializeToolButtonIntegration() {
        try {
            console.log('🔘 ツールボタン連携初期化開始（STEP 4ポップアップ統合版）...');
            
            // ペンツールボタン
            const penToolButton = document.getElementById('pen-tool');
            if (penToolButton) {
                penToolButton.addEventListener('click', (event) => {
                    this.handlePenToolButtonClick(event);
                });
            }
            
            console.log('✅ ツールボタン連携初期化完了');
            
        } catch (error) {
            console.error('❌ ツールボタン連携初期化エラー:', error);
            this.handleError(error);
        }
    }
    
    /**
     * STEP 4新規: ペンツールボタンクリック処理（PopupManager統合版）
     */
    handlePenToolButtonClick(event) {
        try {
            console.log('🔘 ペンツールボタンクリック処理開始...');
            
            // ツールアクティブ化
            this.activatePenTool();
            
            // ポップアップ制御（STEP 4新規）
            const popupId = event.target.getAttribute('data-popup');
            if (popupId && this.popupManager && this.popupIntegrationEnabled) {
                const success = this.popupManager.togglePopup(popupId);
                if (success) {
                    this.popupActionCount++;
                    console.log(`📋 ポップアップトグル成功: ${popupId}`);
                } else {
                    console.warn(`⚠️ ポップアップトグル失敗: ${popupId}`);
                }
            }
            
        } catch (error) {
            console.error('❌ ペンツールボタンクリック処理エラー:', error);
            this.handleError(error);
        }
    }
    
    /**
     * ペンツールアクティブ化
     */
    activatePenTool() {
        // ツールシステムでペンツール選択
        if (this.drawingToolsSystem.setTool) {
            const success = this.drawingToolsSystem.setTool('pen');
            if (success) {
                console.log('🖊️ ペンツールアクティブ化成功');
                
                // UI状態更新
                this.updateToolButtonStates();
            } else {
                console.warn('⚠️ ペンツールアクティブ化失敗');
            }
        }
    }
    
    /**
     * ツールボタン状態更新
     */
    updateToolButtonStates() {
        // 全ツールボタンの非アクティブ化
        document.querySelectorAll('.tool-button').forEach(btn => 
            btn.classList.remove('active'));
        
        // ペンツールボタンのアクティブ化
        const penToolButton = document.getElementById('pen-tool');
        if (penToolButton) {
            penToolButton.classList.add('active');
        }
    }
    
    /**
     * キーボードショートカット初期化
     */
    initializeKeyboardShortcuts() {
        try {
            console.log('⌨️ ペンツール専用キーボードショートカット初期化開始...');
            
            // プリセットリセット（Rキー）
            this.keyboardShortcuts.set('KeyR', {
                description: 'プリセットリセット',
                handler: (event) => this.handleResetActivePreset(event),
                requiresCtrl: false,
                requiresShift: false
            });
            
            // 全プレビューリセット（Shift+Rキー）
            this.keyboardShortcuts.set('ShiftKeyR', {
                description: '全プレビューリセット',
                handler: (event) => this.handleResetAllPreviews(event),
                requiresCtrl: false,
                requiresShift: true
            });
            
            // ESCキー（ポップアップ閉じる - STEP 4新規）
            this.keyboardShortcuts.set('Escape', {
                description: 'ポップアップ閉じる',
                handler: (event) => this.handleEscapeKey(event),
                requiresCtrl: false,
                requiresShift: false
            });
            
            // プリセット選択ショートカット（P+数字）
            for (let i = 1; i <= 6; i++) {
                this.keyboardShortcuts.set(`KeyP${i}`, {
                    description: `プリセット${i}選択`,
                    handler: (event) => this.handlePresetSelection(i, event),
                    requiresCtrl: false,
                    requiresShift: false,
                    requiresPKey: true
                });
            }
            
            // キーボードイベントリスナー
            document.addEventListener('keydown', (event) => {
                this.handleKeyboardShortcut(event);
            });
            
            console.log('✅ ペンツール専用キーボードショートカット初期化完了');
            
        } catch (error) {
            console.error('❌ キーボードショートカット初期化エラー:', error);
            this.handleError(error);
        }
    }
    
    /**
     * キーボードショートカット処理
     */
    handleKeyboardShortcut(event) {
        if (!this.shortcutEnabled) return;
        
        try {
            // ESCキー（STEP 4新規）
            if (event.key === 'Escape') {
                this.handleEscapeKey(event);
                return;
            }
            
            // Rキー（プリセットリセット）
            if (event.key === 'r' && !event.ctrlKey && !event.shiftKey) {
                event.preventDefault();
                this.handleResetActivePreset(event);
                this.shortcutTriggerCount++;
                return;
            }
            
            // Shift+Rキー（全プレビューリセット）
            if (event.key === 'R' && event.shiftKey && !event.ctrlKey) {
                event.preventDefault();
                this.handleResetAllPreviews(event);
                this.shortcutTriggerCount++;
                return;
            }
            
            // プリセット選択（P+数字 - 将来実装予定）
            
        } catch (error) {
            console.error('❌ キーボードショートカット処理エラー:', error);
            this.handleError(error);
        }
    }
    
    /**
     * STEP 4新規: ESCキー処理（PopupManager統合版）
     */
    handleEscapeKey(event) {
        if (this.popupManager && this.popupIntegrationEnabled) {
            const status = this.popupManager.getStatus();
            if (status.activePopup) {
                event.preventDefault();
                const success = this.popupManager.hidePopup(status.activePopup);
                if (success) {
                    this.popupActionCount++;
                    console.log(`⌨️ ESCキーでポップアップ閉じる: ${status.activePopup}`);
                }
            }
        }
    }
    
    /**
     * プリセットリセット処理
     */
    handleResetActivePreset(event) {
        if (this.penPresetManager && this.penPresetManager.resetActivePreset) {
            const success = this.penPresetManager.resetActivePreset();
            
            if (success) {
                this.syncWithBrushSettings();
                console.log('🔄 アクティブプリセットリセット完了');
            }
        }
    }
    
    /**
     * 全プレビューリセット処理（PreviewSync統合版）
     */
    handleResetAllPreviews(event) {
        if (this.previewSync && this.previewSyncEnabled) {
            const success = this.previewSync.resetAllPreviews();
            
            if (success) {
                this.syncWithBrushSettings();
                console.log('🔄 全プレビューリセット完了');
            }
        }
    }
    
    /**
     * STEP 3: PreviewSyncとの連携処理
     */
    syncWithPreviewSystem(settings) {
        if (this.previewSync && this.previewSyncEnabled) {
            try {
                const success = this.previewSync.syncWithBrushSettings(settings);
                if (success) {
                    this.previewUpdateCount++;
                }
            } catch (error) {
                console.warn('PreviewSync連携エラー:', error);
            }
        }
    }
    
    /**
     * ブラシ設定との同期
     */
    syncWithBrushSettings() {
        if (!this.drawingToolsSystem.getBrushSettings) return;
        
        try {
            const settings = this.drawingToolsSystem.getBrushSettings();
            
            // スライダー値更新
            this.updateSliderValue('pen-size-slider', settings.size);
            this.updateSliderValue('pen-opacity-slider', settings.opacity * 100);
            this.updateSliderValue('pen-pressure-slider', settings.pressure * 100);
            this.updateSliderValue('pen-smoothing-slider', settings.smoothing * 100);
            
            // PreviewSync連携
            this.syncWithPreviewSystem(settings);
            
        } catch (error) {
            console.warn('ブラシ設定同期エラー:', error);
            this.handleError(error);
        }
    }
    
    updateSliderValue(sliderId, value) {
        const slider = this.sliders.get(sliderId);
        if (slider && slider.setValue) {
            slider.setValue(value, true);
        }
    }
    
    /**
     * ブラシ設定変更通知受信
     */
    onBrushSettingsChanged(settings) {
        console.log('🎨 ブラシ設定変更通知受信:', settings);
        this.syncWithBrushSettings();
    }
    
    /**
     * STEP 4新規: PopupManager制御API
     */
    showPopup(popupId) {
        if (this.popupManager && this.popupIntegrationEnabled) {
            const success = this.popupManager.showPopup(popupId);
            if (success) {
                this.popupActionCount++;
            }
            return success;
        }
        return false;
    }
    
    hidePopup(popupId) {
        if (this.popupManager && this.popupIntegrationEnabled) {
            const success = this.popupManager.hidePopup(popupId);
            if (success) {
                this.popupActionCount++;
            }
            return success;
        }
        return false;
    }
    
    togglePopup(popupId) {
        if (this.popupManager && this.popupIntegrationEnabled) {
            const success = this.popupManager.togglePopup(popupId);
            if (success) {
                this.popupActionCount++;
            }
            return success;
        }
        return false;
    }
    
    hideAllPopups() {
        if (this.popupManager && this.popupIntegrationEnabled) {
            const success = this.popupManager.hideAllPopups();
            if (success) {
                this.popupActionCount++;
            }
            return success;
        }
        return false;
    }
    
    /**
     * STEP 4新規: PopupManager統合状況取得
     */
    getPopupManagerStatus() {
        if (this.popupManager && this.popupIntegrationEnabled) {
            return this.popupManager.getStatus();
        }
        return null;
    }
    
    /**
     * PreviewSync制御API
     */
    setPreviewSyncEnabled(enabled) {
        this.previewSyncEnabled = enabled;
        if (this.previewSync) {
            if (enabled) {
                this.previewSync.enableSync();
            } else {
                this.previewSync.disableSync();
            }
        }
        console.log(`🔄 PreviewSync ${enabled ? '有効化' : '無効化'}`);
    }
    
    isPreviewSyncEnabled() {
        return this.previewSyncEnabled && this.previewSync && this.previewSync.isEnabled();
    }
    
    /**
     * STEP 4新規: PopupManager統合制御
     */
    setPopupIntegrationEnabled(enabled) {
        this.popupIntegrationEnabled = enabled;
        console.log(`📋 PopupManager統合 ${enabled ? '有効化' : '無効化'}`);
    }
    
    isPopupIntegrationEnabled() {
        return this.popupIntegrationEnabled && !!this.popupManager;
    }
    
    /**
     * 統合システム状態取得
     */
    getStatus() {
        const previewSyncStatus = this.previewSync ? this.previewSync.getStatus() : null;
        const popupManagerStatus = this.getPopupManagerStatus(); // STEP 4新規
        
        return {
            initialized: this.isInitialized,
            errorCount: this.errorCount,
            
            // STEP 2: スライダー制御
            sliders: {
                count: this.sliders.size,
                updateCount: this.sliderUpdateCount,
                lastUpdate: this.lastSliderUpdate
            },
            
            // STEP 3: PreviewSync統合
            previewSync: {
                enabled: this.previewSyncEnabled,
                integrated: !!this.previewSync,
                updateCount: this.previewUpdateCount,
                status: previewSyncStatus
            },
            
            // STEP 4新規: PopupManager統合
            popupManager: {
                enabled: this.popupIntegrationEnabled,
                integrated: !!this.popupManager,
                actionCount: this.popupActionCount,
                status: popupManagerStatus
            },
            
            // キーボードショートカット
            keyboardShortcuts: {
                enabled: this.shortcutEnabled,
                count: this.keyboardShortcuts.size,
                triggerCount: this.shortcutTriggerCount
            },
            
            // 外部システム連携
            externalSystems: {
                penPresetManager: !!this.penPresetManager,
                presetDisplayManager: !!this.presetDisplayManager,
                drawingToolsSystem: !!this.drawingToolsSystem
            }
        };
    }
    
    /**
     * エラーハンドリング
     */
    handleError(error) {
        this.errorCount++;
        
        if (this.errorCount > this.maxErrors) {
            console.error(`PenToolUI: 最大エラー数 (${this.maxErrors}) に達しました。`);
            return;
        }
        
        console.warn(`PenToolUI エラー ${this.errorCount}/${this.maxErrors}:`, error);
    }
    
    /**
     * デバッグ情報表示（STEP 4更新版）
     */
    debug() {
        console.group('🔍 PenToolUI デバッグ情報（STEP 4更新版・PopupManager統合）');
        
        const status = this.getStatus();
        
        console.log('基本情報:', {
            initialized: status.initialized,
            errorCount: `${status.errorCount}/${this.maxErrors}`,
            components: `${Object.values(status.externalSystems).filter(Boolean).length}/3`
        });
        
        console.log('STEP 2 - スライダー制御:', status.sliders);
        console.log('STEP 3 - PreviewSync統合:', status.previewSync);
        console.log('STEP 4 - PopupManager統合:', status.popupManager); // 新規
        console.log('キーボードショートカット:', status.keyboardShortcuts);
        console.log('外部システム連携:', status.externalSystems);
        
        // STEP 4新規: PopupManager詳細デバッグ
        if (this.popupManager && this.popupIntegrationEnabled) {
            console.group('📋 PopupManager詳細情報');
            this.popupManager.debug();
            console.groupEnd();
        }
        
        // STEP 3: PreviewSync詳細デバッグ
        if (this.previewSync && this.previewSyncEnabled) {
            console.group('🔄 PreviewSync詳細情報');
            this.previewSync.debug();
            console.groupEnd();
        }
        
        console.groupEnd();
    }
    
    /**
     * クリーンアップ（STEP 4更新版）
     */
    destroy() {
        try {
            console.log('🧹 PenToolUI (STEP 4更新版) クリーンアップ開始...');
            
            // スライダーのクリーンアップ
            for (const slider of this.sliders.values()) {
                if (slider && slider.destroy) {
                    slider.destroy();
                }
            }
            this.sliders.clear();
            
            // PreviewSyncのクリーンアップ
            if (this.previewSync && this.previewSync.destroy) {
                this.previewSync.destroy();
                this.previewSync = null;
            }
            
            // STEP 4新規: PopupManagerのクリーンアップ
            if (this.popupManager && this.popupManager.destroy) {
                this.popupManager.destroy();
                this.popupManager = null;
            }
            
            // タイムアウトクリア
            if (this.sliderUpdateThrottle) {
                clearTimeout(this.sliderUpdateThrottle);
            }
            
            // 参照クリア
            this.drawingToolsSystem = null;
            this.penPresetManager = null;
            this.presetDisplayManager = null;
            this.keyboardShortcuts.clear();
            
            this.isInitialized = false;
            console.log('✅ PenToolUI (STEP 4更新版) クリーンアップ完了');
            
        } catch (error) {
            console.error('PenToolUI クリーンアップエラー:', error);
        }
    }
}

// ==== グローバル登録・エクスポート ====
if (typeof window !== 'undefined') {
    window.PenToolUI = PenToolUI;
    
    // デバッグ関数（STEP 4更新版）
    window.debugPenToolUI = function() {
        if (window.drawingToolsSystem && window.drawingToolsSystem.penToolUI) {
            window.drawingToolsSystem.penToolUI.debug();
        } else {
            console.warn('PenToolUI が利用できません');
        }
    };
    
    // STEP 4新規: PopupManager制御関数
    window.penToolShowPopup = function(popupId) {
        if (window.drawingToolsSystem && window.drawingToolsSystem.penToolUI) {
            return window.drawingToolsSystem.penToolUI.showPopup(popupId);
        } else {
            console.warn('PenToolUI が利用できません');
            return false;
        }
    };
    
    window.penToolHidePopup = function(popupId) {
        if (window.drawingToolsSystem && window.drawingToolsSystem.penToolUI) {
            return window.drawingToolsSystem.penToolUI.hidePopup(popupId);
        } else {
            console.warn('PenToolUI が利用できません');
            return false;
        }
    };
    
    window.penToolTogglePopup = function(popupId) {
        if (window.drawingToolsSystem && window.drawingToolsSystem.penToolUI) {
            return window.drawingToolsSystem.penToolUI.togglePopup(popupId);
        } else {
            console.warn('PenToolUI が利用できません');
            return false;
        }
    };
    
    // STEP 3: PreviewSync制御関数
    window.togglePenToolPreviewSync = function() {
        if (window.drawingToolsSystem && window.drawingToolsSystem.penToolUI) {
            const penToolUI = window.drawingToolsSystem.penToolUI;
            const enabled = !penToolUI.isPreviewSyncEnabled();
            penToolUI.setPreviewSyncEnabled(enabled);
            console.log(`PreviewSync ${enabled ? '有効化' : '無効化'}しました`);
        }
    };
    
    window.resetPenToolPreviews = function() {
        if (window.drawingToolsSystem && window.drawingToolsSystem.penToolUI) {
            window.drawingToolsSystem.penToolUI.handleResetAllPreviews();
        }
    };
    
    console.log('✅ PenToolUI (STEP 4更新版) 読み込み完了');
    console.log('📦 エクスポートクラス: PenToolUI（PopupManager統合版）');
    console.log('🎯 新機能: ペンツール専用ポップアップ制御統合');
    console.log('🔧 統合コンポーネント: PopupManager + PreviewSync + SliderController');
    console.log('🐛 デバッグ関数（STEP 4更新版）:');
    console.log('  - window.debugPenToolUI() - PenToolUI詳細表示（PopupManager統合状況含む）');
    console.log('  - window.penToolShowPopup(popupId) - ポップアップ表示');
    console.log('  - window.penToolHidePopup(popupId) - ポップアップ非表示');
    console.log('  - window.penToolTogglePopup(popupId) - ポップアップトグル');
    console.log('  - window.togglePenToolPreviewSync() - PreviewSync切り替え');
    console.log('  - window.resetPenToolPreviews() - 全プレビューリセット');
}

console.log('🏆 PenToolUI (STEP 4更新版) 初期化完了');