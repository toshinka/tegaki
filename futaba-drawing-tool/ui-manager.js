/**
     * Phase2D拡張: スライダー設定（プレビュー連動機能統合版）
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
            
            // Phase2D: スロットリング設定
            const sliderThrottleDelay = this.safeConfigGet('SLIDER_UPDATE_THROTTLE', 16);
            
            // ペンサイズスライダー（Phase2D拡張: プレビュー連動機能）
            this.createSlider('pen-size-slider', minSize, maxSize, defaultSize, 
                throttle((value, displayOnly = false) => {
                    if (!displayOnly) {
                        // ツールシステム更新
                        this.toolsSystem.updateBrushSettings({ size: value });
                        
                        // Phase2D: プレビュー連動更新
                        this.updateActivePresetLivePreview(value, null);
                    }
                    return value.toFixed(1) + 'px';
                }, sliderThrottleDelay));
            
            // 不透明度スライダー（Phase2D拡張: プレビュー連動機能）
            this.createSlider('pen-opacity-slider', 0, 100, defaultOpacity * 100, 
                throttle((value, displayOnly = false) => {
                    if (!displayOnly) {
                        // ツールシステム更新
                        this.toolsSystem.updateBrushSettings({ opacity: value / 100 });
                        
                        // Phase2D: プレビュー連動更新
                        this.updateActivePresetLivePreview(null, value / 100);
                    }
                    return value.toFixed(1) + '%';
                }, sliderThrottleDelay));
            
            // 筆圧・線補正スライダー（既存機能）
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
            
            // Phase2D: プレビューリセットボタン設定
            this.setupPreviewResetButton();
            
            console.log('✅ スライダー設定完了（Phase2D拡張版: プレビュー連動機能統合）');
            
        } catch (error) {
            console.error('スライダー設定エラー:', error);
            this.handleError(error);
        }
    }
    
    /**
     * Phase2D新機能: アクティブプリセットのライブプレビュー更新
     */
    updateActivePresetLivePreview(size = null, opacity = null) {
        if (!this.presetDisplayManager || !this.presetDisplayManager.updateActivePresetLiveValues) {
            return false;
        }
        
        try {
            const updated = this.presetDisplayManager.updateActivePresetLiveValues(size, opacity);
            
            if (updated) {
                // PenPresetManagerにもライブ値を反映
                if (this.penPresetManager && this.penPresetManager.updateActivePresetLive) {
                    const sizePercent = size !== null ? size : null;
                    const opacityPercent = opacity !== null ? (opacity * 100) : null;
                    this.penPresetManager.updateActivePresetLive(sizePercent, opacityPercent);
                }
                
                debugLog('UIManager', `アクティブプリセットライブプレビュー更新`, {
                    size: size,
                    opacity: opacity
                });
            }
            
            return updated;
        } catch (error) {
            logError(createApplicationError('ライブプレビュー更新エラー', { size, opacity, error }), 'UIManager');
            return false;
        }
    }
    
    /**
     * Phase2D新機能: プレビューリセットボタン設定
     */
    setupPreviewResetButton() {
        const resetPreviewBtn = document.getElementById('reset-preview-values');
        if (resetPreviewBtn) {
            resetPreviewBtn.addEventListener('click', () => {
                this.handleResetPreviewValues();
            });
            console.log('✅ プレビューリセットボタン設定完了');
        } else {
            console.warn('プレビューリセットボタンが見つかりません: reset-preview-values');
        }
    }
    
    /**
     * Phase2D新機能: プレビューライブ値リセット処理
     */
    handleResetPreviewValues() {
        try {
            if (!this.presetDisplayManager || !this.presetDisplayManager.clearAllLiveValues) {
                this.showNotification('プレビューリセット機能が利用できません', 'error', 3000);
                return;
            }
            
            const hadLiveValues = this.presetDisplayManager.hasLiveValues();
            
            if (!hadLiveValues) {
                this.showNotification('リセットするプレビュー変更がありません', 'info', 2000);
                return;
            }
            
            // ライブ値をクリア
            const clearedCount = this.presetDisplayManager.clearAllLiveValues();
            
            if (clearedCount) {
                // アクティブプリセットの元の値でツールシステムを更新
                this.resetActivePresetToOriginal();
                
                this.showNotification(
                    `プレビューライブ値をリセットしました（${clearedCount}件）`,
                    'success',
                    2000
                );
                
                console.log(`🔄 プレビューライブ値リセット完了: ${clearedCount}件`);
            }
            
        } catch (error) {
            logError(createApplicationError('プレビューリセットエラー', { error }), 'UIManager');
            this.showNotification('プレビューリセット中にエラーが発生しました', 'error', 3000);
        }
    }
    
    /**
     * Phase2D新機能: アクティブプリセットを元の値にリセット
     */
    resetActivePresetToOriginal() {
        if (!this.penPresetManager || !this.penPresetManager.getActivePreset) {
            return false;
        }
        
        try {
            const activePreset = this.penPresetManager.getActivePreset();
            if (!activePreset) {
                return false;
            }
            
            // 元の値を取得
            const originalSize = activePreset.originalSize || activePreset.size;
            const originalOpacity = activePreset.originalOpacity || activePreset.opacity;
            
            // ツールシステムに元の値を設定
            this.toolsSystem.updateBrushSettings({
                size: originalSize,
                opacity: originalOpacity
            });
            
            // スライダーを元の値に更新
            this.updateSliderValue('pen-size-slider', originalSize);
            this.updateSliderValue('pen-opacity-slider', originalOpacity * 100);
            
            debugLog('UIManager', 'アクティブプリセットを元の値にリセット', {
                size: originalSize,
                opacity: originalOpacity
            });
            
            return true;
        } catch (error) {
            logError(createApplicationError('プリセット元値リセットエラー', { error }), 'UIManager');
            return false;
        }
    }
    
    /**
     * Phase2D拡張: リセット機能セットアップ（プレビューリセット統合版）
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
        
        // Phase2D: プレビューリセット（上記で設定済み）
        
        // キャンバスリセット
        const resetCanvasBtn = document.getElementById('reset-canvas');
        if (resetCanvasBtn) {
            resetCanvasBtn.addEventListener('click', () => {
                this.handleResetCanvas();
            });
        }
        
        console.log('✅ リセット機能設定完了（Phase2D拡張版: プレビューリセット統合）');
    }
    
    /**
     * Phase2D拡張: プリセットライブ値更新（DRY原則準拠・統合版）
     */
    updatePresetLiveValues(size, opacity) {
        // PresetDisplayManagerのライブプレビュー機能を使用
        this.updateActivePresetLivePreview(size, opacity);
    }
    
    /**
     * Phase2D拡張: 表示更新メソッド群（プレビュー連動対応版）
     */
    updateAllDisplays() {
        try {
            this.updateSliderValuesFromToolsSystem();
            this.updateToolDisplay();
            this.updateStatusDisplay();
            
            // Phase2D: プリセット表示更新（ライブプレビュー対応）
            if (this.presetDisplayManager && this.presetDisplayManager.updatePresetsDisplay) {
                this.presetDisplayManager.updatePresetsDisplay();
            }
            
        } catch (error) {
            console.warn('表示更新エラー:', error);
            this.handleError(error);
        }
    }
    
    /**
     * Phase2D拡張: プリセット選択処理（ライブ値クリア対応版）
     */
    selectPreset(presetId) {
        if (this.penPresetManager && this.penPresetManager.selectPreset) {
            // プリセット選択前にライブ値をクリア
            if (this.presetDisplayManager && this.presetDisplayManager.clearLiveValuesForPreset) {
                this.presetDisplayManager.clearLiveValuesForPreset(presetId);
            }
            
            const success = this.penPresetManager.selectPreset(presetId);
            
            if (success) {
                this.updateAllDisplays();
            }
            
            return success;
        }
        return false;
    }
    
    /**
     * Phase2D拡張: ブラシ設定変更ハンドラ（ライブプレビュー対応版）
     */
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
        
        // Phase2D: プレビュー連動更新（外部からの変更時）
        this.updateActivePresetLivePreview(settings.size, settings.opacity);
        
        this.updateToolDisplay();
    }
    
    /**
     * Phase2D拡張: システム統計・デバッグ（プレビュー機能統合版）
     */
    getUIStats() {
        const historyStats = this.getHistoryStats();
        const performanceStats = this.getPerformanceStats();
        
        // Phase2D: プレビュー統計情報
        const previewStats = this.presetDisplayManager ? 
            this.presetDisplayManager.getStatus() : null;
        
        return {
            initialized: this.isInitialized,
            activePopup: this.popupManager ? this.popupManager.getStatus().activePopup : null,
            sliderCount: this.sliders.size,
            errorCount: this.errorCount,
            maxErrors: this.maxErrors,
            penPresetManager: !!this.penPresetManager,
            historyStats: historyStats,
            performanceStats: performanceStats,
            previewStats: previewStats, // Phase2D追加
            components: {
                popupManager: !!this.popupManager,
                statusBar: !!this.statusBar,
                presetDisplayManager: !!this.presetDisplayManager,
                penPresetManager: !!this.penPresetManager,
                performanceMonitor: !!this.performanceMonitor,
                simplePerformanceMonitor: !!this.simplePerformanceMonitor,
                historyManager: !!this.historyManager
            }
        };
    }
    
    /**
     * Phase2D拡張: デバッグ情報表示（プレビュー機能統合版）
     */
    debugUI() {
        console.group('🔍 UIManagerSystem デバッグ情報（Phase2D拡張版）');
        
        console.log('基本情報:', {
            initialized: this.isInitialized,
            sliders: this.sliders.size,
            errorCount: `${this.errorCount}/${this.maxErrors}`
        });
        
        console.log('コンポーネント状態:', this.getUIStats().components);
        console.log('スライダー値:', this.getAllSliderValues());
        
        if (this.penPresetManager && this.penPresetManager.getSystemStats) {
            console.log('PenPresetManager統計:', this.penPresetManager.getSystemStats());
        }
        
        // Phase2D: プレビュー機能デバッグ情報
        if (this.presetDisplayManager && this.presetDisplayManager.getDetailedStats) {
            console.log('PresetDisplayManager詳細統計:', this.presetDisplayManager.getDetailedStats());
        }
        
        if (this.historyManager) {
            console.log('履歴統計:', this.getHistoryStats());
        }
        
        console.groupEnd();
    }
    
    /**
     * Phase2D新機能: プレビュー連動機能のテスト
     */
    testPreviewSyncFeature() {
        console.group('🧪 プレビュー連動機能テスト');
        
        try {
            // 1. 初期状態確認
            const initialStats = this.presetDisplayManager?.getStatus();
            console.log('1. 初期状態:', initialStats);
            
            // 2. ライブプレビュー更新テスト
            console.log('2. ライブプレビュー更新テスト...');
            const updateResult = this.updateActivePresetLivePreview(8, 0.8);
            console.log('   更新結果:', updateResult);
            
            // 3. ライブ値確認
            const liveStats = this.presetDisplayManager?.getDetailedStats();
            console.log('3. ライブ値確認:', liveStats?.activeLiveValues);
            
            // 4. プレビューリセットテスト
            console.log('4. プレビューリセットテスト...');
            const resetResult = this.presetDisplayManager?.clearAllLiveValues();
            console.log('   リセット結果:', resetResult);
            
            // 5. 最終状態確認
            const finalStats = this.presetDisplayManager?.getStatus();
            console.log('5. 最終状態:', finalStats);
            
            console.log('✅ プレビュー連動機能テスト完了');
            
        } catch (error) {
            console.error('❌ プレビュー連動機能テストエラー:', error);
        }
        
        console.groupEnd();
    }
    
    /**
     * Phase2D新機能: プレビューライブ値の存在確認
     */
    hasLivePreviewValues() {
        return this.presetDisplayManager ? 
            this.presetDisplayManager.hasLiveValues() : false;
    }
    
    /**
     * Phase2D新機能: アクティブプリセットのライブ値取得
     */
    getActivePresetLiveValues() {
        if (!this.penPresetManager) return null;
        
        const activePreset = this.penPresetManager.getActivePreset();
        if (!activePreset || !this.presetDisplayManager) return null;
        
        const stats = this.presetDisplayManager.getDetailedStats();
        return stats ? stats.activeLiveValues : null;
    }