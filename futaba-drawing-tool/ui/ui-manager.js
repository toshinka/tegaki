/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev8
 * プリセット管理専門システム - ui/preset-manager.js (Phase2B完成版)
 * 
 * 🔧 Phase2B実装内容（プリセット管理分離）:
 * 1. ✅ プリセット機能の完全独立化（ui-manager.jsから分離）
 * 2. ✅ 履歴記録機能実装（プリセット変更・リセット操作）
 * 3. ✅ リセット機能強化（個別・全体リセット）
 * 4. ✅ プレビュー生成システム（外枠制限・大サイズ対応）
 * 5. ✅ ライブプレビュー機能（リアルタイム更新）
 * 6. ✅ 設定値同期（CONFIG連携）
 * 7. ✅ エラーハンドリング強化
 * 8. ✅ デバッグ・テスト機能充実
 * 
 * Phase2B目標: プリセット機能の完全独立化・履歴連携・外枠制限対応
 * 責務: プリセット管理・プレビュー生成・履歴記録・リセット機能
 * 依存: config.js, drawing-tools.js, history-manager.js
 */

/**
 * プリセット管理専門クラス（Phase2B: 完全独立版）
 */
class PresetManager {
    constructor(toolsSystem, historyManager = null) {
        this.toolsSystem = toolsSystem;
        this.historyManager = historyManager;
        
        // プリセット管理
        this.presets = this.createDefaultPresets();
        this.activePresetId = CONFIG.DEFAULT_ACTIVE_PRESET;
        this.currentLiveValues = null;
        
        // 更新制御
        this.updateThrottle = null;
        this.isUpdating = false;
        
        // イベントハンドラー
        this.eventCallbacks = new Map();
        
        this.setupPresetEventListeners();
        console.log('🎨 PresetManager初期化完了（Phase2B: 完全独立版）');
    }
    
    /**
     * Phase2B: 履歴管理システム設定
     */
    setHistoryManager(historyManager) {
        this.historyManager = historyManager;
        console.log('📚 PresetManager: 履歴管理システム連携完了');
    }
    
    /**
     * Phase2B: デフォルトプリセット生成（CONFIG対応）
     */
    createDefaultPresets() {
        const presets = new Map();
        
        CONFIG.SIZE_PRESETS.forEach((size, index) => {
            const presetId = `preset_${size}`;
            presets.set(presetId, {
                id: presetId,
                size: size,
                opacity: CONFIG.DEFAULT_OPACITY, // Phase2B: 100%統一
                color: CONFIG.DEFAULT_COLOR,
                pressure: CONFIG.DEFAULT_PRESSURE,
                smoothing: CONFIG.DEFAULT_SMOOTHING,
                name: `サイズ${size}`,
                isDefault: true,
                // Phase2B: リセット用原始値保存
                originalSize: size,
                originalOpacity: CONFIG.DEFAULT_OPACITY,
                originalPressure: CONFIG.DEFAULT_PRESSURE,
                originalSmoothing: CONFIG.DEFAULT_SMOOTHING
            });
        });
        
        console.log(`📝 デフォルトプリセット生成完了:`, {
            count: presets.size,
            defaultSize: CONFIG.DEFAULT_BRUSH_SIZE,
            defaultOpacity: `${CONFIG.DEFAULT_OPACITY * 100}%`,
            maxSize: CONFIG.MAX_BRUSH_SIZE
        });
        
        return presets;
    }
    
    /**
     * Phase2B: プリセットイベントリスナー設定
     */
    setupPresetEventListeners() {
        document.querySelectorAll('.size-preset-item').forEach(preset => {
            preset.addEventListener('click', (event) => {
                const size = parseFloat(preset.getAttribute('data-size'));
                const presetId = `preset_${size}`;
                this.selectPreset(presetId);
            });
        });
        
        console.log('🎛️ プリセットイベントリスナー設定完了');
    }
    
    /**
     * Phase2B: 履歴記録付きプリセット選択
     */
    selectPreset(presetId) {
        const preset = this.presets.get(presetId);
        if (!preset) {
            console.warn(`プリセットが見つかりません: ${presetId}`);
            return null;
        }
        
        // 履歴記録のための変更前状態キャプチャ
        const beforeState = this.captureCurrentState();
        const oldActivePresetId = this.activePresetId;
        
        // プリセット選択実行
        this.activePresetId = presetId;
        this.currentLiveValues = null; // ライブ値をリセット
        
        // ツールシステムに設定を適用
        if (this.toolsSystem) {
            this.toolsSystem.updateBrushSettings({
                size: preset.size,
                opacity: preset.opacity,
                color: preset.color,
                pressure: preset.pressure,
                smoothing: preset.smoothing
            });
        }
        
        // Phase2B: 履歴記録（プリセット変更時）
        if (this.historyManager && oldActivePresetId !== presetId) {
            const afterState = this.captureCurrentState();
            this.historyManager.recordPresetChange({
                type: 'preset_select',
                beforeState: beforeState,
                afterState: afterState,
                presetData: { ...preset }
            });
        }
        
        // イベント通知
        this.notifyEvent('preset:selected', { preset, presetId });
        
        console.log(`🎯 プリセット選択: ${preset.name} (${preset.size}px, ${Math.round(preset.opacity * 100)}%)`);
        return preset;
    }
    
    /**
     * Phase2B: プリセット選択（前/次）
     */
    selectPreviousPreset() {
        const presetIds = Array.from(this.presets.keys());
        const currentIndex = presetIds.indexOf(this.activePresetId);
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : presetIds.length - 1;
        
        return this.selectPreset(presetIds[prevIndex]);
    }
    
    selectNextPreset() {
        const presetIds = Array.from(this.presets.keys());
        const currentIndex = presetIds.indexOf(this.activePresetId);
        const nextIndex = currentIndex < presetIds.length - 1 ? currentIndex + 1 : 0;
        
        return this.selectPreset(presetIds[nextIndex]);
    }
    
    /**
     * Phase2B: ライブ値更新（リアルタイムプレビュー用）
     */
    updateActivePresetLive(size, opacity, color = null) {
        if (!this.currentLiveValues) {
            this.currentLiveValues = {
                size: size,
                opacity: opacity / 100,
                color: color || this.getActivePreset()?.color || CONFIG.DEFAULT_COLOR
            };
        } else {
            this.currentLiveValues.size = size;
            this.currentLiveValues.opacity = opacity / 100;
            if (color !== null) {
                this.currentLiveValues.color = color;
            }
        }
        
        // イベント通知
        this.notifyEvent('preset:live_updated', this.currentLiveValues);
        
        console.log('🔄 ライブプレビュー更新:', {
            size: this.currentLiveValues.size.toFixed(1),
            opacity: Math.round(this.currentLiveValues.opacity * 100) + '%'
        });
    }
    
    /**
     * Phase2B: プレビューデータ生成（外枠制限対応）
     */
    generatePreviewData() {
        const previewData = [];
        const activePreset = this.getActivePreset();
        const liveValues = this.currentLiveValues;
        
        for (const preset of this.presets.values()) {
            const isActive = preset.id === this.activePresetId;
            
            let actualSize, actualOpacity;
            
            if (isActive && liveValues) {
                actualSize = liveValues.size;
                actualOpacity = liveValues.opacity;
            } else {
                actualSize = preset.size;
                actualOpacity = preset.opacity;
            }
            
            // Phase2B: 外枠制限を考慮したプレビューサイズ計算
            const displaySize = this.calculatePreviewSize(actualSize);
            
            const sizeLabel = isActive && liveValues ? 
                liveValues.size.toFixed(1) + 'px' : 
                preset.size.toString() + 'px';
            
            const opacityLabel = isActive && liveValues ? 
                Math.round(liveValues.opacity * 100) + '%' : 
                Math.round(preset.opacity * 100) + '%';
            
            previewData.push({
                dataSize: preset.size,
                displaySize: displaySize,
                actualSize: actualSize,
                sizeLabel: sizeLabel,
                opacity: actualOpacity,
                opacityLabel: opacityLabel,
                color: isActive && liveValues ? 
                    `#${liveValues.color.toString(16).padStart(6, '0')}` :
                    `#${preset.color.toString(16).padStart(6, '0')}`,
                isActive: isActive,
                presetId: preset.id
            });
        }
        
        return previewData;
    }
    
    /**
     * Phase2B: 外枠制限対応プレビューサイズ計算
     */
    calculatePreviewSize(actualSize) {
        const size = parseFloat(actualSize);
        if (isNaN(size) || size <= 0) return CONFIG.PREVIEW_MIN_SIZE;
        
        // Phase2B: 32px以下は線形スケール
        if (size <= 32) {
            const normalizedSize = Math.min(1.0, size / 32);
            return Math.max(CONFIG.PREVIEW_MIN_SIZE, 
                          Math.min(CONFIG.PREVIEW_MAX_SIZE, 
                                 normalizedSize * CONFIG.PREVIEW_MAX_SIZE));
        } else {
            // Phase2B: 32px超は対数スケールで圧縮（500px対応）
            const logScale = Math.log(size / 32) / Math.log(CONFIG.MAX_BRUSH_SIZE / 32);
            const compressedScale = logScale * 0.3; // 圧縮率30%
            return Math.min(CONFIG.PREVIEW_MAX_SIZE, 
                          CONFIG.PREVIEW_MAX_SIZE * (0.7 + compressedScale));
        }
    }
    
    /**
     * Phase2B: アクティブプリセットリセット（履歴記録付き）
     */
    resetActivePreset() {
        const activePreset = this.getActivePreset();
        if (!activePreset) {
            console.warn('アクティブプリセットが見つかりません');
            return false;
        }
        
        // 履歴記録のための変更前状態キャプチャ
        const beforeState = this.captureCurrentState();
        
        // デフォルト値に戻す
        this.currentLiveValues = null;
        
        const resetSettings = {
            size: activePreset.originalSize,
            opacity: activePreset.originalOpacity,
            color: activePreset.color,
            pressure: activePreset.originalPressure,
            smoothing: activePreset.originalSmoothing
        };
        
        if (this.toolsSystem) {
            this.toolsSystem.updateBrushSettings(resetSettings);
        }
        
        // Phase2B: 履歴記録
        if (this.historyManager) {
            const afterState = this.captureCurrentState();
            this.historyManager.recordPresetChange({
                type: 'preset_reset',
                beforeState: beforeState,
                afterState: afterState,
                presetId: this.activePresetId
            });
        }
        
        // イベント通知
        this.notifyEvent('preset:reset', { presetId: this.activePresetId });
        
        console.log(`🔄 プリセットリセット: ${activePreset.name} → デフォルト値`);
        return true;
    }
    
    /**
     * Phase2B: 全プリセットリセット
     */
    resetAllPresets() {
        const beforeState = this.captureCurrentState();
        
        // 全プリセットをデフォルト値に戻す
        for (const preset of this.presets.values()) {
            preset.opacity = preset.originalOpacity;
            preset.pressure = preset.originalPressure;
            preset.smoothing = preset.originalSmoothing;
        }
        
        // ライブ値もクリア
        this.currentLiveValues = null;
        
        // アクティブプリセットの設定をツールシステムに適用
        const activePreset = this.getActivePreset();
        if (activePreset && this.toolsSystem) {
            this.toolsSystem.updateBrushSettings({
                size: activePreset.originalSize,
                opacity: activePreset.originalOpacity,
                color: activePreset.color,
                pressure: activePreset.originalPressure,
                smoothing: activePreset.originalSmoothing
            });
        }
        
        // Phase2B: 履歴記録
        if (this.historyManager) {
            const afterState = this.captureCurrentState();
            this.historyManager.recordPresetChange({
                type: 'preset_reset_all',
                beforeState: beforeState,
                afterState: afterState
            });
        }
        
        // イベント通知
        this.notifyEvent('preset:reset_all', {});
        
        console.log(`🔄 全プリセットリセット完了: 透明度=${Math.round(CONFIG.DEFAULT_OPACITY * 100)}%に統一`);
        return true;
    }
    
    /**
     * Phase2B: 状態キャプチャ（履歴用）
     */
    captureCurrentState() {
        return {
            activePresetId: this.activePresetId,
            liveValues: this.currentLiveValues ? { ...this.currentLiveValues } : null,
            presets: JSON.parse(JSON.stringify(Array.from(this.presets.entries()))),
            timestamp: Date.now()
        };
    }
    
    /**
     * Phase2B: 状態復元（履歴から復元用）
     */
    restoreState(state) {
        try {
            this.activePresetId = state.activePresetId;
            this.currentLiveValues = state.liveValues ? { ...state.liveValues } : null;
            
            if (state.presets) {
                this.presets = new Map(state.presets);
            }
            
            // ツールシステムに現在の設定を適用
            const activePreset = this.getActivePreset();
            if (activePreset && this.toolsSystem) {
                const settings = this.currentLiveValues ? {
                    size: this.currentLiveValues.size,
                    opacity: this.currentLiveValues.opacity,
                    color: this.currentLiveValues.color
                } : {
                    size: activePreset.size,
                    opacity: activePreset.opacity,
                    color: activePreset.color,
                    pressure: activePreset.pressure,
                    smoothing: activePreset.smoothing
                };
                
                this.toolsSystem.updateBrushSettings(settings);
            }
            
            // イベント通知
            this.notifyEvent('preset:restored', { state });
            
            console.log('🔄 プリセット状態復元完了:', state.activePresetId);
            return true;
            
        } catch (error) {
            console.error('プリセット状態復元エラー:', error);
            return false;
        }
    }
    
    /**
     * Phase2B: サイズからプリセットID取得
     */
    getPresetIdBySize(size) {
        return `preset_${size}`;
    }
    
    /**
     * アクティブプリセット取得
     */
    getActivePreset() {
        return this.presets.get(this.activePresetId);
    }
    
    /**
     * アクティブプリセットID取得
     */
    getActivePresetId() {
        return this.activePresetId;
    }
    
    /**
     * Phase2B: イベント通知システム
     */
    addEventListener(eventType, callback) {
        if (!this.eventCallbacks.has(eventType)) {
            this.eventCallbacks.set(eventType, new Set());
        }
        this.eventCallbacks.get(eventType).add(callback);
    }
    
    removeEventListener(eventType, callback) {
        const callbacks = this.eventCallbacks.get(eventType);
        if (callbacks) {
            callbacks.delete(callback);
        }
    }
    
    notifyEvent(eventType, data) {
        const callbacks = this.eventCallbacks.get(eventType);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.warn(`イベントコールバックエラー (${eventType}):`, error);
                }
            });
        }
    }
    
    /**
     * Phase2B: デバッグ・テスト機能
     */
    testPresetSystem() {
        console.group('🧪 PresetManager システムテスト（Phase2B）');
        
        try {
            // 1. 基本状態確認
            console.log('1. 基本状態:', {
                activePresetId: this.activePresetId,
                presetCount: this.presets.size,
                hasLiveValues: !!this.currentLiveValues,
                hasHistoryManager: !!this.historyManager
            });
            
            // 2. プリセット選択テスト
            console.log('2. プリセット選択テスト...');
            const testPreset = this.selectPreset('preset_8');
            console.log('選択結果:', testPreset?.name);
            
            // 3. ライブ値更新テスト
            console.log('3. ライブ値更新テスト...');
            this.updateActivePresetLive(12.5, 80);
            console.log('ライブ値:', this.currentLiveValues);
            
            // 4. プレビューデータ生成テスト
            console.log('4. プレビューデータ生成テスト...');
            const previewData = this.generatePreviewData();
            console.log(`プレビューデータ生成: ${previewData.length}項目`);
            
            // 5. リセット機能テスト
            console.log('5. リセット機能テスト...');
            const resetResult = this.resetActivePreset();
            console.log('リセット結果:', resetResult);
            
            // 6. 状態キャプチャテスト
            console.log('6. 状態キャプチャテスト...');
            const state = this.captureCurrentState();
            console.log('キャプチャ成功:', !!state.timestamp);
            
            console.log('✅ PresetManager システムテスト完了');
            
        } catch (error) {
            console.error('❌ PresetManager システムテストエラー:', error);
        }
        
        console.groupEnd();
    }
    
    /**
     * システム統計取得
     */
    getSystemStats() {
        return {
            activePresetId: this.activePresetId,
            presetCount: this.presets.size,
            hasLiveValues: !!this.currentLiveValues,
            isUpdating: this.isUpdating,
            hasHistoryManager: !!this.historyManager,
            eventListenerCount: this.eventCallbacks.size,
            memoryUsage: this.estimateMemoryUsage()
        };
    }
    
    /**
     * メモリ使用量推定
     */
    estimateMemoryUsage() {
        try {
            const presetData = JSON.stringify(Array.from(this.presets.entries()));
            const liveValues = JSON.stringify(this.currentLiveValues || {});
            return Math.round((presetData.length + liveValues.length) / 1024 * 100) / 100; // KB
        } catch (error) {
            return 0;
        }
    }
    
    /**
     * Phase2B: クリーンアップ
     */
    destroy() {
        // タイムアウトクリア
        if (this.updateThrottle) {
            clearTimeout(this.updateThrottle);
            this.updateThrottle = null;
        }
        
        // イベントコールバッククリア
        this.eventCallbacks.clear();
        
        // 参照クリア
        this.presets.clear();
        this.toolsSystem = null;
        this.historyManager = null;
        this.currentLiveValues = null;
        
        console.log('✅ PresetManager クリーンアップ完了（Phase2B）');
    }
}

// ==== グローバル登録・エクスポート ====
if (typeof window !== 'undefined') {
    window.PresetManager = PresetManager;
    
    console.log('🎨 ui/preset-manager.js Phase2B 読み込み完了');
    console.log('📦 エクスポートクラス: PresetManager（Phase2B完全独立版）');
    console.log('🔧 Phase2B実装完了:');
    console.log('  ✅ プリセット機能の完全独立化');
    console.log('  ✅ 履歴記録機能実装');
    console.log('  ✅ リセット機能強化');
    console.log('  ✅ プレビュー生成システム（外枠制限・大サイズ対応）');
    console.log('  ✅ ライブプレビュー機能');
    console.log('  ✅ イベント通知システム');
    console.log('  ✅ エラーハンドリング・デバッグ機能強化');
    console.log('🎯 責務: プリセット管理・プレビュー生成・履歴記録・リセット機能');
}

// ES6モジュールエクスポート（将来のTypeScript移行用）
// export { PresetManager };