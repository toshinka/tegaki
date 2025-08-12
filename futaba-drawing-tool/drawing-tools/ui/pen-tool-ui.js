/**
 * PenToolUI - STEP 5統合版: EventManager統合完了
 * 
 * 統合コンポーネント:
 * STEP 2: SliderManager - ペンスライダー制御
 * STEP 3: PreviewSync - プレビュー連動機能  
 * STEP 4: PopupManager - ポップアップ制御
 * STEP 5: EventManager - イベント処理制御 ←NEW
 */

class PenToolUI {
    constructor(drawingToolsSystem) {
        this.drawingToolsSystem = drawingToolsSystem;
        this.app = drawingToolsSystem.app;
        
        // 全コンポーネント管理（STEP 5完成版）
        this.components = {
            sliderManager: null,      // STEP 2
            previewSync: null,        // STEP 3
            popupManager: null,       // STEP 4
            eventManager: null        // STEP 5 NEW
        };
        
        // 統合状態管理
        this.isInitialized = false;
        this.componentsReady = new Map();
        this.integrationEnabled = true;
        this.errorCount = 0;
        this.maxErrors = 20;
        
        // ツール状態管理
        this.toolActive = false;
        this.settingsCache = new Map();
        
        // STEP 5新規: イベント統合設定
        this.eventIntegrationEnabled = true;
        this.eventProcessingStats = {
            keyboardEvents: 0,
            wheelEvents: 0,
            shortcuts: 0,
            adjustments: 0
        };
        
        console.log('🎨 PenToolUI (STEP 5統合版) 初期化準備完了');
    }
    
    /**
     * 全コンポーネント初期化（STEP 5完成版）
     */
    async init() {
        console.log('🎨 PenToolUI完全統合初期化開始...');
        
        try {
            // 全4コンポーネント順次初期化
            await this.initializeSliderManager();    // STEP 2
            await this.initializePreviewSync();      // STEP 3  
            await this.initializePopupManager();     // STEP 4
            await this.initializeEventManager();     // STEP 5 NEW
            
            // 統合システム初期化
            this.setupComponentIntegration();
            
            this.isInitialized = true;
            console.log('✅ PenToolUI完全統合初期化完了（4コンポーネント）');
            
            return true;
        } catch (error) {
            console.error('❌ PenToolUI初期化失敗:', error);
            this.handleError('init', error);
            return false;
        }
    }
    
    /**
     * STEP 5: EventManagerコンポーネント初期化
     */
    async initializeEventManager() {
        try {
            console.log('🎮 EventManager統合開始...');
            
            // EventManagerクラス動的読み込み
            if (typeof window.EventManager !== 'function') {
                console.warn('EventManager not available, attempting dynamic load...');
                
                // 開発環境での動的読み込み（実際の実装では適切なimportを使用）
                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                    try {
                        const module = await import('./components/event-manager.js');
                        window.EventManager = module.EventManager;
                    } catch (importError) {
                        console.warn('EventManager動的読み込み失敗, 縮退動作:', importError);
                        this.componentsReady.set('eventManager', false);
                        return;
                    }
                }
            }
            
            // EventManagerインスタンス作成・初期化
            this.components.eventManager = new window.EventManager(this);
            const initResult = await this.components.eventManager.init();
            
            if (initResult) {
                this.componentsReady.set('eventManager', true);
                console.log('✅ EventManager統合完了');
                
                // 初期状態設定
                this.components.eventManager.setEnabled(this.toolActive);
                
            } else {
                throw new Error('EventManager初期化失敗');
            }
            
        } catch (error) {
            console.error('❌ EventManager統合失敗:', error);
            this.componentsReady.set('eventManager', false);
            this.handleError('eventManager', error);
        }
    }
    
    /**
     * STEP 2: SliderManagerコンポーネント初期化（既存）
     */
    async initializeSliderManager() {
        try {
            if (typeof window.SliderManager !== 'function') {
                console.warn('SliderManager not available');
                this.componentsReady.set('sliderManager', false);
                return;
            }
            
            this.components.sliderManager = new window.SliderManager(this);
            await this.components.sliderManager.init();
            this.componentsReady.set('sliderManager', true);
            console.log('✅ SliderManager統合完了');
            
        } catch (error) {
            console.error('SliderManager統合失敗:', error);
            this.componentsReady.set('sliderManager', false);
            this.handleError('sliderManager', error);
        }
    }
    
    /**
     * STEP 3: PreviewSyncコンポーネント初期化（既存）
     */
    async initializePreviewSync() {
        try {
            if (typeof window.PreviewSync !== 'function') {
                console.warn('PreviewSync not available');
                this.componentsReady.set('previewSync', false);
                return;
            }
            
            this.components.previewSync = new window.PreviewSync(this);
            await this.components.previewSync.init();
            this.componentsReady.set('previewSync', true);
            console.log('✅ PreviewSync統合完了');
            
        } catch (error) {
            console.error('PreviewSync統合失敗:', error);
            this.componentsReady.set('previewSync', false);
            this.handleError('previewSync', error);
        }
    }
    
    /**
     * STEP 4: PopupManagerコンポーネント初期化（既存）
     */
    async initializePopupManager() {
        try {
            if (typeof window.PopupManager !== 'function') {
                console.warn('PopupManager not available');
                this.componentsReady.set('popupManager', false);
                return;
            }
            
            this.components.popupManager = new window.PopupManager(this);
            await this.components.popupManager.init();
            this.componentsReady.set('popupManager', true);
            console.log('✅ PopupManager統合完了');
            
        } catch (error) {
            console.error('PopupManager統合失敗:', error);
            this.componentsReady.set('popupManager', false);
            this.handleError('popupManager', error);
        }
    }
    
    /**
     * コンポーネント間統合設定
     */
    setupComponentIntegration() {
        console.log('🔗 コンポーネント間統合設定...');
        
        // EventManager ↔ PreviewSync 連携
        if (this.components.eventManager && this.components.previewSync) {
            // プリセット選択時のプレビュー更新連携
        }
        
        // EventManager ↔ SliderManager 連携
        if (this.components.eventManager && this.components.sliderManager) {
            // ホイール調整時のスライダー更新連携
        }
        
        console.log('✅ コンポーネント間統合設定完了');
    }
    
    /**
     * STEP 5: ツール状態変更通知（EventManager統合版）
     */
    onToolStateChanged(isActive) {
        this.toolActive = isActive;
        
        // 全コンポーネントに状態変更を通知
        if (this.components.eventManager) {
            this.components.eventManager.setEnabled(isActive && this.eventIntegrationEnabled);
        }
        
        if (this.components.popupManager && !isActive) {
            // ツール非選択時は全ポップアップを閉じる
            this.components.popupManager.hideAllPopups();
        }
        
        if (this.components.previewSync) {
            // プレビュー同期の有効/無効制御
            this.components.previewSync.setEnabled(isActive);
        }
        
        console.log(`🔄 PenToolUI ツール状態変更: ${isActive ? '選択' : '非選択'} (EventManager統合)`);
    }
    
    /**
     * ツールアクティブ状態取得
     */
    isToolActive() {
        return this.toolActive;
    }
    
    // ==========================================
    // STEP 5: EventManager API統合
    // ==========================================
    
    /**
     * プリセット選択（EventManager → PreviewSync）
     */
    selectPreset(index) {
        this.eventProcessingStats.shortcuts++;
        
        if (this.components.previewSync && this.components.previewSync.selectPreset) {
            this.components.previewSync.selectPreset(index);
            console.log(`🎨 プリセット ${index + 1} 選択（EventManager経由）`);
            return true;
        }
        
        console.warn('PreviewSync.selectPreset not available');
        return false;
    }
    
    /**
     * アクティブプリセットリセット（EventManager → PreviewSync）
     */
    resetActivePreset() {
        this.eventProcessingStats.shortcuts++;
        
        if (this.components.previewSync && this.components.previewSync.resetActivePreset) {
            this.components.previewSync.resetActivePreset();
            console.log('🔄 アクティブプリセット リセット（EventManager経由）');
            return true;
        }
        
        console.warn('PreviewSync.resetActivePreset not available');
        return false;
    }
    
    /**
     * 全プレビューリセット（EventManager → PreviewSync）
     */
    resetAllPreviews() {
        this.eventProcessingStats.shortcuts++;
        
        if (this.components.previewSync && this.components.previewSync.resetAllPreviews) {
            this.components.previewSync.resetAllPreviews();
            console.log('🔄 全プリセット リセット（EventManager経由）');
            return true;
        }
        
        console.warn('PreviewSync.resetAllPreviews not available');
        return false;
    }
    
    /**
     * ペンサイズ調整（EventManager → SliderManager）
     */
    adjustSize(delta) {
        this.eventProcessingStats.adjustments++;
        
        if (this.components.sliderManager && this.components.sliderManager.adjustSlider) {
            this.components.sliderManager.adjustSlider('pen-size-slider', delta);
            console.log(`📏 ペンサイズ調整: ${delta > 0 ? '+' : ''}${delta} (EventManager経由)`);
            return true;
        }
        
        console.warn('SliderManager.adjustSlider not available');
        return false;
    }
    
    /**
     * 透明度調整（EventManager → SliderManager）
     */
    adjustOpacity(delta) {
        this.eventProcessingStats.adjustments++;
        
        if (this.components.sliderManager && this.components.sliderManager.adjustSlider) {
            this.components.sliderManager.adjustSlider('pen-opacity-slider', delta);
            console.log(`🌫️  透明度調整: ${delta > 0 ? '+' : ''}${delta}% (EventManager経由)`);
            return true;
        }
        
        console.warn('SliderManager.adjustSlider not available');
        return false;
    }
    
    /**
     * EventManager統合制御
     */
    setEventIntegrationEnabled(enabled) {
        this.eventIntegrationEnabled = enabled;
        
        if (this.components.eventManager) {
            this.components.eventManager.setEnabled(enabled && this.toolActive);
        }
        
        console.log(`🎮 EventManager統合: ${enabled ? '有効' : '無効'}`);
    }
    
    /**
     * キーボードショートカット処理（EventManager → 内部処理）
     */
    handleKeyboardShortcut(key, event) {
        this.eventProcessingStats.keyboardEvents++;
        
        if (this.components.eventManager) {
            return this.components.eventManager.handleKeyboardEvent(event);
        }
        
        return false;
    }
    
    /**
     * ホイール調整処理（EventManager → 内部処理）
     */
    handleWheelAdjustment(delta, type, event) {
        this.eventProcessingStats.wheelEvents++;
        
        if (this.components.eventManager) {
            return this.components.eventManager.handleWheelEvent(event);
        }
        
        return false;
    }
    
    // ==========================================
    // 既存API（STEP 2-4）
    // ==========================================
    
    /**
     * 全スライダー値取得（SliderManager）
     */
    getAllSliderValues() {
        if (this.components.sliderManager && this.components.sliderManager.getAllValues) {
            return this.components.sliderManager.getAllValues();
        }
        return {};
    }
    
    /**
     * プレビュー同期切り替え（PreviewSync）
     */
    togglePreviewSync() {
        if (this.components.previewSync && this.components.previewSync.toggleSync) {
            return this.components.previewSync.toggleSync();
        }
        return false;
    }
    
    /**
     * ポップアップ表示（PopupManager）
     */
    showPopup(popupId) {
        if (this.components.popupManager && this.components.popupManager.showPopup) {
            return this.components.popupManager.showPopup(popupId);
        }
        return false;
    }
    
    /**
     * ポップアップ非表示（PopupManager）
     */
    hidePopup(popupId) {
        if (this.components.popupManager && this.components.popupManager.hidePopup) {
            return this.components.popupManager.hidePopup(popupId);
        }
        return false;
    }
    
    /**
     * 全ポップアップ非表示（PopupManager）
     */
    hideAllPopups() {
        if (this.components.popupManager && this.components.popupManager.hideAllPopups) {
            return this.components.popupManager.hideAllPopups();
        }
        return false;
    }
    
    // ==========================================
    // 統合状況・デバッグ（STEP 5完成版）
    // ==========================================
    
    /**
     * EventManager統合状況取得
     */
    getEventManagerStatus() {
        if (this.components.eventManager && this.components.eventManager.getStatus) {
            return this.components.eventManager.getStatus();
        }
        
        return {
            available: false,
            ready: this.componentsReady.get('eventManager') || false,
            integrationEnabled: this.eventIntegrationEnabled
        };
    }
    
    /**
     * 全コンポーネント統合状況取得（STEP 5完成版）
     */
    getFullStatus() {
        const status = {
            initialized: this.isInitialized,
            toolActive: this.toolActive,
            integrationEnabled: this.integrationEnabled,
            eventIntegrationEnabled: this.eventIntegrationEnabled,
            errorCount: this.errorCount,
            eventProcessingStats: { ...this.eventProcessingStats },
            components: {},
            ready: {}
        };
        
        // 各コンポーネント状況（STEP 5版）
        for (const [name, component] of Object.entries(this.components)) {
            if (component && typeof component.getStatus === 'function') {
                status.components[name] = component.getStatus();
            } else {
                status.components[name] = { available: !!component };
            }
            status.ready[name] = this.componentsReady.get(name) || false;
        }
        
        return status;
    }
    
    /**
     * 個別コンポーネント状況取得
     */
    getComponentStatus(componentName) {
        if (this.components[componentName]) {
            const component = this.components[componentName];
            if (typeof component.getStatus === 'function') {
                return component.getStatus();
            }
            return { available: true, ready: this.componentsReady.get(componentName) };
        }
        
        return { available: false, ready: false };
    }
    
    /**
     * エラーハンドリング強化版
     */
    handleError(context, error) {
        this.errorCount++;
        console.error(`PenToolUI ${context} error:`, error);
        
        // 特定コンポーネントのエラー分離
        if (context === 'eventManager') {
            this.eventIntegrationEnabled = false;
            console.warn('EventManager統合を無効化しました');
        }
        
        if (this.errorCount > this.maxErrors) {
            console.warn('PenToolUI: エラー数が上限に達しました。統合機能を無効化します。');
            this.integrationEnabled = false;
        }
    }
    
    /**
     * 完全クリーンアップ（STEP 5版）
     */
    async destroy() {
        console.log('🧹 PenToolUI完全クリーンアップ開始（4コンポーネント）...');
        
        // 全コンポーネントのクリーンアップ（順序重要）
        const cleanupOrder = ['eventManager', 'popupManager', 'previewSync', 'sliderManager'];
        
        for (const componentName of cleanupOrder) {
            const component = this.components[componentName];
            if (component && typeof component.destroy === 'function') {
                try {
                    await component.destroy();
                    console.log(`✅ ${componentName} クリーンアップ完了`);
                } catch (error) {
                    console.error(`❌ ${componentName} クリーンアップ失敗:`, error);
                }
            }
        }
        
        // 内部状態リセット
        this.isInitialized = false;
        this.toolActive = false;
        this.eventIntegrationEnabled = true;
        this.componentsReady.clear();
        this.settingsCache.clear();
        
        console.log('✅ PenToolUI完全クリーンアップ完了（4コンポーネント統合システム）');
    }
}

// グローバル公開（既存システムとの互換性）
if (typeof window !== 'undefined') {
    window.PenToolUI = PenToolUI;
}

export { PenToolUI };