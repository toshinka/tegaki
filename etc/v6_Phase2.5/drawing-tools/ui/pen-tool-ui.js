/**
 * ⚠️ 【重要】開発・改修時の注意事項:
 * 必ずdebug/またはmonitoring/ディレクトリの既存モジュールを確認し、重複を避けてください。
 * - debug/debug-manager.js: デバッグ機能統合
 * - debug/diagnostics.js: システム診断
 * - debug/performance-logger.js: パフォーマンス測定
 * - monitoring/system-monitor.js: システム監視
 * これらの機能はこのファイルに重複実装しないでください。
 */

/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev12
 * ペンツール専用UI制御（モジュール分割版）
 * 
 * 🏗️ STEP 2.5実装完了（ペンUI制御専用モジュール）:
 * 1. ✅ 単一責任原則：ペンツールUI制御のみ
 * 2. ✅ ui-manager.jsからの完全分離：独立性確保
 * 3. ✅ 外部システム連携：依存注入パターン採用
 * 4. ✅ プレビュー連動機能：リアルタイム同期対応
 * 5. ✅ スライダー制御統合：専用UI管理システム
 * 6. ✅ エラーハンドリング強化：安全な例外処理
 * 7. ✅ UI同期システム：無限ループ回避機能
 * 
 * 責務: ペンツール専用UI制御のみ
 * 依存: SliderController, PenPresetManager, PresetDisplayManager
 * 
 * モジュール化効果: ui-manager.jsからペン専用機能を完全分離
 */

console.log('🎨 pen-tool-ui.js モジュール分割版読み込み開始...');

// 依存関係の動的取得
let SliderController = null;
let PenPresetManager = null;
let PresetDisplayManager = null;
let PopupManager = null;

// CONFIG値安全取得（DRY原則準拠）
function safeConfigGet(key, defaultValue = null) {
    try {
        if (!window.CONFIG || typeof window.CONFIG !== 'object') {
            console.warn(`safeConfigGet: CONFIG未初期化 (${key}) → デフォルト値使用:`, defaultValue);
            return defaultValue;
        }
        
        if (!(key in window.CONFIG)) {
            console.warn(`safeConfigGet: キー不存在 (${key}) → デフォルト値使用:`, defaultValue);
            return defaultValue;
        }
        
        const value = window.CONFIG[key];
        if (value === null || value === undefined) {
            console.warn(`safeConfigGet: 値がnull/undefined (${key}) → デフォルト値使用:`, defaultValue);
            return defaultValue;
        }
        
        return value;
        
    } catch (error) {
        console.error(`safeConfigGet: アクセスエラー (${key}):`, error, '→ デフォルト値使用:', defaultValue);
        return defaultValue;
    }
}

// ブラシ設定バリデーション（DRY原則準拠）
function validateBrushSize(size) {
    const numSize = parseFloat(size);
    if (isNaN(numSize)) return safeConfigGet('DEFAULT_BRUSH_SIZE', 4);
    return Math.max(
        safeConfigGet('MIN_BRUSH_SIZE', 0.1),
        Math.min(safeConfigGet('MAX_BRUSH_SIZE', 500), numSize)
    );
}

function validateOpacity(opacity) {
    const numOpacity = parseFloat(opacity);
    if (isNaN(numOpacity)) return safeConfigGet('DEFAULT_OPACITY', 1.0);
    return Math.max(0, Math.min(1, numOpacity));
}

// 依存関係初期化
function initializeDependencies() {
    SliderController = window.SliderController;
    PenPresetManager = window.PenPresetManager;
    PresetDisplayManager = window.PresetDisplayManager;
    PopupManager = window.PopupManager;
    
    console.log('🔧 PenToolUI依存関係初期化:', {
        SliderController: !!SliderController,
        PenPresetManager: !!PenPresetManager,
        PresetDisplayManager: !!PresetDisplayManager,
        PopupManager: !!PopupManager
    });
}

// ==== ペンツール専用UI制御クラス（モジュール分割版）====
class PenToolUI {
    constructor(drawingToolsSystem) {
        this.drawingToolsSystem = drawingToolsSystem;
        this.app = drawingToolsSystem.app;
        
        // 依存関係初期化
        initializeDependencies();
        
        // 外部システム参照（依存注入パターン）
        this.sliderController = SliderController;
        this.penPresetManager = null;
        this.presetDisplayManager = null;
        this.popupManager = PopupManager;
        
        // UI制御状態
        this.sliders = new Map();
        this.isInitialized = false;
        this.errorCount = 0;
        this.maxErrors = 5;
        
        // プレビュー連動制御
        this.previewSyncEnabled = true;
        this.previewUpdateThrottle = null;
        this.lastPreviewUpdate = 0;
        this.previewUpdateInterval = safeConfigGet('PRESET_UPDATE_THROTTLE', 16);
        
        // UI同期制御
        this.syncInProgress = false;
        this.pendingSyncUpdates = new Map();
        
        console.log('🎨 PenToolUI初期化準備（モジュール分割版：プレビュー連動機能統合）');
    }
    
    /**
     * 外部システム安全初期化
     */
    initializeExternalSystems() {
        let initSuccess = 0;
        let initTotal = 0;
        
        try {
            // SliderControllerクラスの確認・初期化
            initTotal++;
            if (this.sliderController) {
                console.log('✅ SliderController連携完了');
                initSuccess++;
            } else {
                console.warn('⚠️ SliderController が利用できません');
            }
            
            // PenPresetManagerクラスの統合
            initTotal++;
            if (window.penPresetManager || PenPresetManager) {
                this.penPresetManager = window.penPresetManager || new PenPresetManager();
                console.log('✅ PenPresetManager統合完了');
                initSuccess++;
            } else {
                console.warn('⚠️ PenPresetManager が利用できません');
            }
            
            // PresetDisplayManagerクラスの統合
            initTotal++;
            if (window.presetDisplayManager || PresetDisplayManager) {
                this.presetDisplayManager = window.presetDisplayManager || new PresetDisplayManager();
                console.log('✅ PresetDisplayManager統合完了');
                initSuccess++;
            } else {
                console.warn('⚠️ PresetDisplayManager が利用できません');
            }
            
            // PopupManager統合
            initTotal++;
            if (this.popupManager) {
                console.log('✅ PopupManager統合完了');
                initSuccess++;
            } else {
                console.warn('📋 PopupManager 未実装（将来の拡張用）');
            }
            
            console.log(`📊 外部システム統合状況: ${initSuccess}/${initTotal}システム利用可能`);
            
            // SliderController + プレビュー系システムが必須
            return !!(this.sliderController && (this.penPresetManager || this.presetDisplayManager));
            
        } catch (error) {
            console.error('外部システム初期化エラー:', error);
            this.handleError(error);
            return false;
        }
    }
    
    /**
     * メインUI初期化
     */
    async init() {
        try {
            console.log('🎯 PenToolUI初期化開始（モジュール分割版）...');
            
            // 外部システムの取得・初期化
            if (!this.initializeExternalSystems()) {
                throw new Error('必須システム初期化失敗（SliderController/PreviewManager不足）');
            }
            
            // スライダー制御初期化
            this.initSliders();
            
            // プレビュー連動システム初期化
            this.initPreviewSystem();
            
            // ポップアップ制御初期化
            this.initPopupControl();
            
            // キーボードショートカット初期化
            this.initKeyboardShortcuts();
            
            // UI同期システム初期化
            this.initSyncSystem();
            
            this.isInitialized = true;
            console.log('✅ PenToolUI初期化完了（モジュール分割版）');
            
            return true;
            
        } catch (error) {
            console.error('❌ PenToolUI初期化エラー:', error);
            this.handleError(error);
            throw error;
        }
    }
    
    /**
     * スライダー制御初期化
     */
    initSliders() {
        if (!this.sliderController) {
            console.warn('SliderController が利用できません');
            return;
        }
        
        try {
            // CONFIG値を安全に取得
            const minSize = safeConfigGet('MIN_BRUSH_SIZE', 0.1);
            const maxSize = safeConfigGet('MAX_BRUSH_SIZE', 500);
            const defaultSize = safeConfigGet('DEFAULT_BRUSH_SIZE', 4);
            const defaultOpacity = safeConfigGet('DEFAULT_OPACITY', 1.0);
            const defaultPressure = safeConfigGet('DEFAULT_PRESSURE', 0.5);
            const defaultSmoothing = safeConfigGet('DEFAULT_SMOOTHING', 0.3);
            
            console.log('📐 スライダー設定値:', {
                サイズ範囲: `${minSize}-${maxSize}px`,
                デフォルト: `${defaultSize}px, ${defaultOpacity * 100}%透明度`,
                筆圧: `${defaultPressure * 100}%`,
                補正: `${defaultSmoothing * 100}%`
            });
            
            // ペンサイズスライダー（プレビュー連動対応）
            this.createSlider('pen-size-slider', minSize, maxSize, defaultSize, 
                (value, displayOnly = false) => {
                    if (!displayOnly) {
                        this.drawingToolsSystem.updateBrushSettings({ size: value });
                        this.updatePresetLiveValues(value, null);
                        this.updateActivePresetPreview(value, null);
                        console.log(`🎛️ ペンサイズ変更: ${value.toFixed(1)}px`);
                    }
                    return value.toFixed(1) + 'px';
                });
            
            // 不透明度スライダー（プレビュー連動対応）
            this.createSlider('pen-opacity-slider', 0, 100, defaultOpacity * 100, 
                (value, displayOnly = false) => {
                    if (!displayOnly) {
                        this.drawingToolsSystem.updateBrushSettings({ opacity: value / 100 });
                        this.updatePresetLiveValues(null, value);
                        this.updateActivePresetPreview(null, value);
                        console.log(`🎛️ 不透明度変更: ${value.toFixed(1)}%`);
                    }
                    return value.toFixed(1) + '%';
                });
            
            // 筆圧スライダー
            this.createSlider('pen-pressure-slider', 0, 100, defaultPressure * 100, 
                (value, displayOnly = false) => {
                    if (!displayOnly) {
                        this.drawingToolsSystem.updateBrushSettings({ pressure: value / 100 });
                        console.log(`🎛️ 筆圧変更: ${value.toFixed(1)}%`);
                    }
                    return value.toFixed(1) + '%';
                });
            
            // 線補正スライダー
            this.createSlider('pen-smoothing-slider', 0, 100, defaultSmoothing * 100, 
                (value, displayOnly = false) => {
                    if (!displayOnly) {
                        this.drawingToolsSystem.updateBrushSettings({ smoothing: value / 100 });
                        console.log(`🎛️ 線補正変更: ${value.toFixed(1)}%`);
                    }
                    return value.toFixed(1) + '%';
                });
            
            // スライダーボタンの設定
            this.initSliderButtons();
            
            console.log('✅ PenToolUI: スライダー設定完了（プレビュー連動対応版）');
            
        } catch (error) {
            console.error('スライダー設定エラー:', error);
            this.handleError(error);
        }
    }
    
    /**
     * スライダー作成
     */
    createSlider(sliderId, min, max, initial, callback) {
        try {
            const slider = new this.sliderController(sliderId, min, max, initial, callback);
            this.sliders.set(sliderId, slider);
            console.log(`🎛️ スライダー作成完了: ${sliderId} (${min}-${max}, 初期値: ${initial})`);
            return slider;
        } catch (error) {
            console.error(`スライダー作成エラー (${sliderId}):`, error);
            this.handleError(error);
            return null;
        }
    }
    
    /**
     * スライダーボタン設定
     */
    initSliderButtons() {
        const buttonConfigs = [
            // ペンサイズ調整ボタン（微調整・標準・大幅調整）
            { id: 'pen-size-decrease-small', slider: 'pen-size-slider', delta: -0.1 },
            { id: 'pen-size-decrease', slider: 'pen-size-slider', delta: -1 },
            { id: 'pen-size-decrease-large', slider: 'pen-size-slider', delta: -10 },
            { id: 'pen-size-increase-small', slider: 'pen-size-slider', delta: 0.1 },
            { id: 'pen-size-increase', slider: 'pen-size-slider', delta: 1 },
            { id: 'pen-size-increase-large', slider: 'pen-size-slider', delta: 10 },
            
            // 不透明度調整ボタン（微調整・標準・大幅調整）
            { id: 'pen-opacity-decrease-small', slider: 'pen-opacity-slider', delta: -0.1 },
            { id: 'pen-opacity-decrease', slider: 'pen-opacity-slider', delta: -1 },
            { id: 'pen-opacity-decrease-large', slider: 'pen-opacity-slider', delta: -10 },
            { id: 'pen-opacity-increase-small', slider: 'pen-opacity-slider', delta: 0.1 },
            { id: 'pen-opacity-increase', slider: 'pen-opacity-slider', delta: 1 },
            { id: 'pen-opacity-increase-large', slider: 'pen-opacity-slider', delta: 10 }
        ];
        
        let setupCount = 0;
        buttonConfigs.forEach(config => {
            const button = document.getElementById(config.id);
            if (button) {
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    const slider = this.sliders.get(config.slider);
                    if (slider?.adjustValue) {
                        slider.adjustValue(config.delta);
                        console.log(`🔘 ボタン調整: ${config.id} (${config.delta > 0 ? '+' : ''}${config.delta})`);
                    }
                });
                setupCount++;
            }
        });
        
        console.log(`🎛️ スライダーボタン設定完了: ${setupCount}個`);
    }
    
    /**
     * プレビュー連動システム初期化
     */
    initPreviewSystem() {
        try {
            console.log('🔄 プレビュー連動システム初期化...');
            
            // プレビュー系システムの整合性確認
            if (!this.penPresetManager && !this.presetDisplayManager) {
                console.warn('⚠️ プレビューシステムが利用できません');
                this.previewSyncEnabled = false;
                return;
            }
            
            // プレビュー更新設定
            this.previewUpdateInterval = safeConfigGet('PRESET_UPDATE_THROTTLE', 16);
            this.previewSyncEnabled = true;
            
            // 初回プレビュー同期
            this.syncPreviewsWithCurrentSettings();
            
            console.log('✅ プレビュー連動システム初期化完了');
            
        } catch (error) {
            console.error('プレビューシステム初期化エラー:', error);
            this.handleError(error);
            this.previewSyncEnabled = false;
        }
    }
    
    /**
     * ポップアップ制御初期化
     */
    initPopupControl() {
        try {
            console.log('📋 ポップアップ制御初期化...');
            
            if (!this.popupManager) {
                console.log('📋 PopupManager未実装 → 基本機能のみで続行');
                return;
            }
            
            // 将来のポップアップ機能拡張用のプレースホルダー
            console.log('✅ ポップアップ制御初期化完了');
            
        } catch (error) {
            console.error('ポップアップ制御初期化エラー:', error);
            this.handleError(error);
        }
    }
    
    /**
     * キーボードショートカット初期化
     */
    initKeyboardShortcuts() {
        try {
            console.log('⌨️ キーボードショートカット初期化...');
            
            // 基本的なペン関連ショートカット
            document.addEventListener('keydown', (event) => {
                // Ctrl/Cmdキーとの組み合わせは除外（システム機能優先）
                if (event.ctrlKey || event.metaKey) return;
                
                switch (event.key) {
                    case 'r':
                    case 'R':
                        if (event.shiftKey) {
                            // Shift+R: 全プレビューリセット
                            this.resetAllPreviews();
                            console.log('🔄 全プレビューリセット');
                        } else {
                            // R: アクティブプリセットリセット
                            this.resetActivePreset();
                            console.log('🔄 アクティブプリセットリセット');
                        }
                        event.preventDefault();
                        break;
                }
            });
            
            console.log('✅ キーボードショートカット初期化完了');
            
        } catch (error) {
            console.error('キーボードショートカット初期化エラー:', error);
            this.handleError(error);
        }
    }
    
    /**
     * UI同期システム初期化
     */
    initSyncSystem() {
        try {
            console.log('🔄 UI同期システム初期化...');
            
            // 同期制御の初期化
            this.syncInProgress = false;
            this.pendingSyncUpdates.clear();
            
            console.log('✅ UI同期システム初期化完了');
            
        } catch (error) {
            console.error('UI同期システム初期化エラー:', error);
            this.handleError(error);
        }
    }
    
    /**
     * プリセット連動値更新
     */
    updatePresetLiveValues(size, opacity) {
        if (!this.previewSyncEnabled || !this.penPresetManager) return;
        
        try {
            // スロットリング制御
            const now = Date.now();
            if (now - this.lastPreviewUpdate < this.previewUpdateInterval) {
                // 更新が頻繁すぎる場合、スロットリング実行
                if (this.previewUpdateThrottle) {
                    clearTimeout(this.previewUpdateThrottle);
                }
                
                this.previewUpdateThrottle = setTimeout(() => {
                    this.updatePresetLiveValues(size, opacity);
                }, this.previewUpdateInterval);
                
                return;
            }
            
            this.lastPreviewUpdate = now;
            
            // PenPresetManagerの更新実行
            if (this.penPresetManager.updateActivePresetLive) {
                const updateData = {};
                if (size !== null && size !== undefined) updateData.size = size;
                if (opacity !== null && opacity !== undefined) updateData.opacity = opacity;
                
                this.penPresetManager.updateActivePresetLive(updateData);
                console.log(`🔄 プリセットライブ更新:`, updateData);
            }
            
        } catch (error) {
            console.error('プリセットライブ値更新エラー:', error);
            this.handleError(error);
        }
    }
    
    /**
     * アクティブプリセットプレビュー更新
     */
    updateActivePresetPreview(size, opacity) {
        if (!this.previewSyncEnabled) return;
        
        try {
            // PresetDisplayManager経由での更新
            if (this.presetDisplayManager?.updateActivePreview) {
                const updateData = {};
                if (size !== null && size !== undefined) updateData.size = size;
                if (opacity !== null && opacity !== undefined) updateData.opacity = opacity;
                
                this.presetDisplayManager.updateActivePreview(updateData);
                console.log(`🎨 アクティブプリセットプレビュー更新:`, updateData);
            }
            
            // PenPresetManager経由での更新（フォールバック）
            if (this.penPresetManager?.updateActivePresetPreview) {
                this.penPresetManager.updateActivePresetPreview(size, opacity);
            }
            
        } catch (error) {
            console.error('アクティブプリセットプレビュー更新エラー:', error);
            this.handleError(error);
        }
    }
    
    /**
     * プレビューとの同期（現在設定との同期）
     */
    syncPreviewsWithCurrentSettings() {
        if (!this.previewSyncEnabled) return;
        
        try {
            const brushSettings = this.drawingToolsSystem.getBrushSettings();
            
            if (brushSettings) {
                this.updatePresetLiveValues(brushSettings.size, brushSettings.opacity * 100);
                this.updateActivePresetPreview(brushSettings.size, brushSettings.opacity * 100);
                console.log('🔄 プレビュー初期同期完了:', brushSettings);
            }
            
        } catch (error) {
            console.error('プレビュー同期エラー:', error);
            this.handleError(error);
        }
    }
    
    /**
     * アクティブプリセットリセット
     */
    resetActivePreset() {
        try {
            if (this.penPresetManager?.resetActivePreset) {
                this.penPresetManager.resetActivePreset();
                
                // 現在の設定でプレビューを更新
                this.syncPreviewsWithCurrentSettings();
                
                console.log('🔄 アクティブプリセットリセット完了');
                return true;
            } else {
                console.warn('PenPresetManager.resetActivePreset が利用できません');
                return false;
            }
        } catch (error) {
            console.error('アクティブプリセットリセットエラー:', error);
            this.handleError(error);
            return false;
        }
    }
    
    /**
     * 全プリセットプレビューリセット
     */
    resetAllPreviews() {
        try {
            let resetCount = 0;
            
            // PresetDisplayManager経由でのリセット
            if (this.presetDisplayManager?.resetAllPreviews) {
                this.presetDisplayManager.resetAllPreviews();
                resetCount++;
            }
            
            // PenPresetManager経由でのリセット（フォールバック）
            if (this.penPresetManager?.resetAllPreviews) {
                this.penPresetManager.resetAllPreviews();
                resetCount++;
            }
            
            if (resetCount > 0) {
                // 現在の設定でプレビューを更新
                this.syncPreviewsWithCurrentSettings();
                
                console.log(`🔄 全プレビューリセット完了: ${resetCount}システム`);
                return true;
            } else {
                console.warn('プレビューリセット機能が利用できません');
                return false;
            }
        } catch (error) {
            console.error('全プレビューリセットエラー:', error);
            this.handleError(error);
            return false;
        }
    }
    
    /**
     * プリセット選択
     */
    selectPreset(presetId) {
        try {
            if (!this.penPresetManager) {
                console.warn('PenPresetManager が利用できません');
                return false;
            }
            
            // プリセット選択実行
            if (this.penPresetManager.selectPreset) {
                const success = this.penPresetManager.selectPreset(presetId);
                
                if (success) {
                    // 選択後の設定を取得してスライダーに反映
                    this.updateSlidersFromPreset(presetId);
                    
                    // プレビュー更新
                    this.syncPreviewsWithCurrentSettings();
                    
                    console.log(`🎯 プリセット選択完了: ${presetId}`);
                    return true;
                } else {
                    console.warn(`プリセット選択失敗: ${presetId}`);
                    return false;
                }
            } else {
                console.warn('PenPresetManager.selectPreset が利用できません');
                return false;
            }
        } catch (error) {
            console.error('プリセット選択エラー:', error);
            this.handleError(error);
            return false;
        }
    }
    
    /**
     * プリセットからスライダー更新
     */
    updateSlidersFromPreset(presetId) {
        if (!this.penPresetManager) return;
        
        try {
            const presetData = this.penPresetManager.getPresetData ? 
                this.penPresetManager.getPresetData(presetId) : null;
            
            if (presetData) {
                let updateCount = 0;
                
                if ('size' in presetData) {
                    if (this.updateSliderValue('pen-size-slider', presetData.size)) {
                        updateCount++;
                    }
                }
                
                if ('opacity' in presetData) {
                    const opacityPercent = presetData.opacity * 100;
                    if (this.updateSliderValue('pen-opacity-slider', opacityPercent)) {
                        updateCount++;
                    }
                }
                
                console.log(`🔄 プリセットからスライダー更新: ${updateCount}個更新`);
            }
            
        } catch (error) {
            console.error('プリセットからスライダー更新エラー:', error);
            this.handleError(error);
        }
    }
    
    /**
     * スライダー値更新
     */
    updateSliderValue(sliderId, value) {
        const slider = this.sliders.get(sliderId);
        if (slider?.setValue) {
            slider.setValue(value, true); // displayOnly = true
            return true;
        }
        console.warn(`スライダー更新失敗: ${sliderId}`);
        return false;
    }
    
    /**
     * 全スライダー値取得
     */
    getAllSliderValues() {
        const values = {};
        for (const [id, slider] of this.sliders) {
            if (slider?.getStatus) {
                const status = slider.getStatus();
                values[id] = status.value;
            }
        }
        return values;
    }
    
    /**
     * ブラシ設定変更通知（DrawingToolsSystemから呼び出し・プレビュー連動対応）
     */
    onBrushSettingsChanged(settings) {
        try {
            // 同期進行中の場合は無限ループ回避
            if (this.syncInProgress) {
                this.pendingSyncUpdates.set('brushSettings', settings);
                return;
            }
            
            this.syncInProgress = true;
            
            // スライダー値の同期（ツールシステム → UI）
            let syncCount = 0;
            
            if ('size' in settings) {
                if (this.updateSliderValue('pen-size-slider', settings.size)) {
                    syncCount++;
                }
            }
            
            if ('opacity' in settings) {
                if (this.updateSliderValue('pen-opacity-slider', settings.opacity * 100)) {
                    syncCount++;
                }
            }
            
            if ('pressure' in settings) {
                if (this.updateSliderValue('pen-pressure-slider', settings.pressure * 100)) {
                    syncCount++;
                }
            }
            
            if ('smoothing' in settings) {
                if (this.updateSliderValue('pen-smoothing-slider', settings.smoothing * 100)) {
                    syncCount++;
                }
            }
            
            if (syncCount > 0) {
                console.log(`🔄 スライダー同期完了: ${syncCount}個更新`);
            }
            
            // プレビュー連動機能
            if (this.previewSyncEnabled) {
                const size = 'size' in settings ? settings.size : null;
                const opacity = 'opacity' in settings ? settings.opacity * 100 : null;
                
                this.updatePresetLiveValues(size, opacity);
                this.updateActivePresetPreview(size, opacity);
            }
            
            this.syncInProgress = false;
            
            // 保留中の更新を処理
            if (this.pendingSyncUpdates.has('brushSettings')) {
                const pendingSettings = this.pendingSyncUpdates.get('brushSettings');
                this.pendingSyncUpdates.delete('brushSettings');
                setTimeout(() => this.onBrushSettingsChanged(pendingSettings), 10);
            }
            
        } catch (error) {
            console.error('ブラシ設定変更同期エラー:', error);
            this.handleError(error);
            this.syncInProgress = false;
        }
    }
    
    /**
     * プレビュー同期有効/無効切り替え
     */
    setPreviewSyncEnabled(enabled) {
        const wasEnabled = this.previewSyncEnabled;
        this.previewSyncEnabled = !!enabled;
        
        if (!wasEnabled && this.previewSyncEnabled) {
            // 有効化時は現在設定で同期
            this.syncPreviewsWithCurrentSettings();
        }
        
        console.log(`🔄 プレビュー同期: ${this.previewSyncEnabled ? '有効' : '無効'}`);
        return this.previewSyncEnabled;
    }
    
    /**
     * エラーハンドリング
     */
    handleError(error) {
        this.errorCount++;
        
        if (this.errorCount > this.maxErrors) {
            console.error(`PenToolUI: 最大エラー数 (${this.maxErrors}) に達しました。`);
            return false;
        }
        
        console.warn(`PenToolUI エラー ${this.errorCount}/${this.maxErrors}:`, error);
        return true;
    }
    
    /**
     * デバッグ機能
     */
    debugPenUI() {
        console.group('🔍 PenToolUI デバッグ情報（モジュール分割版）');
        
        console.log('基本情報:', {
            initialized: this.isInitialized,
            sliders: this.sliders.size,
            errorCount: `${this.errorCount}/${this.maxErrors}`,
            previewSyncEnabled: this.previewSyncEnabled,
            syncInProgress: this.syncInProgress
        });
        
        console.log('外部システム連携:', {
            sliderController: !!this.sliderController,
            penPresetManager: !!this.penPresetManager,
            presetDisplayManager: !!this.presetDisplayManager,
            popupManager: !!this.popupManager
        });
        
        console.log('スライダー状態:', this.getAllSliderValues());
        
        console.log('プレビュー連動状態:', {
            enabled: this.previewSyncEnabled,
            updateInterval: this.previewUpdateInterval,
            lastUpdate: this.lastPreviewUpdate,
            throttleActive: !!this.previewUpdateThrottle
        });
        
        if (this.pendingSyncUpdates.size > 0) {
            console.log('保留中更新:', Array.from(this.pendingSyncUpdates.keys()));
        }
        
        console.groupEnd();
    }
    
    /**
     * 統計取得
     */
    getStats() {
        return {
            isInitialized: this.isInitialized,
            slidersCount: this.sliders.size,
            errorCount: this.errorCount,
            maxErrors: this.maxErrors,
            previewSync: {
                enabled: this.previewSyncEnabled,
                updateInterval: this.previewUpdateInterval,
                lastUpdate: this.lastPreviewUpdate,
                throttleActive: !!this.previewUpdateThrottle,
                syncInProgress: this.syncInProgress,
                pendingUpdates: this.pendingSyncUpdates.size
            },
            externalSystems: {
                sliderController: !!this.sliderController,
                penPresetManager: !!this.penPresetManager,
                presetDisplayManager: !!this.presetDisplayManager,
                popupManager: !!this.popupManager
            },
            moduleVersion: 'v2.5-separated'
        };
    }
    
    /**
     * クリーンアップ
     */
    destroy() {
        try {
            console.log('🧹 PenToolUI クリーンアップ開始（モジュール分割版）');
            
            // プレビュー更新スロットリングのクリア
            if (this.previewUpdateThrottle) {
                clearTimeout(this.previewUpdateThrottle);
                this.previewUpdateThrottle = null;
            }
            
            // スライダーのクリーンアップ
            for (const slider of this.sliders.values()) {
                if (slider?.destroy) {
                    slider.destroy();
                }
            }
            this.sliders.clear();
            
            // 同期状態のクリア
            this.syncInProgress = false;
            this.pendingSyncUpdates.clear();
            
            // 参照のクリア
            this.sliderController = null;
            this.penPresetManager = null;
            this.presetDisplayManager = null;
            this.popupManager = null;
            
            this.isInitialized = false;
            console.log('✅ PenToolUI クリーンアップ完了（モジュール分割版）');
            
        } catch (error) {
            console.error('PenToolUI クリーンアップエラー:', error);
        }
    }
}

// ==== グローバル登録・エクスポート====
if (typeof window !== 'undefined') {
    window.PenToolUI = PenToolUI;
    
    // デバッグ関数登録
    window.debugPenToolUI = function() {
        if (window.toolsSystem?.penToolUI) {
            window.toolsSystem.penToolUI.debugPenUI();
        } else if (window.toolsSystem?.getPenUI?.()) {
            window.toolsSystem.getPenUI().debugPenUI();
        } else {
            console.warn('PenToolUI が見つかりません');
        }
    };
    
    window.togglePreviewSync = function() {
        if (window.toolsSystem?.penToolUI) {
            const penUI = window.toolsSystem.penToolUI;
            const stats = penUI.getStats();
            const newState = penUI.setPreviewSyncEnabled(!stats.previewSync.enabled);
            console.log(`🔄 プレビュー同期切り替え: ${newState ? '有効' : '無効'}`);
            return newState;
        } else {
            console.warn('PenToolUI が利用できません');
            return false;
        }
    };
    
    window.debugPreviewSync = function() {
        if (window.toolsSystem?.penToolUI) {
            const penUI = window.toolsSystem.penToolUI;
            console.group('🔍 プレビュー連動デバッグ（モジュール分割版）');
            
            const stats = penUI.getStats();
            console.log('プレビュー同期状態:', stats.previewSync);
            console.log('外部システム:', stats.externalSystems);
            
            // テスト実行
            console.log('🧪 プレビュー同期テスト実行中...');
            penUI.syncPreviewsWithCurrentSettings();
            
            console.groupEnd();
        } else {
            console.warn('PenToolUI が利用できません');
        }
    };
    
    console.log('✅ pen-tool-ui.js モジュール分割版 読み込み完了');
    console.log('📦 エクスポートクラス:');
    console.log('  ✅ PenToolUI: ペンツール専用UI制御（完全分離版）');
    console.log('🎨 主要機能:');
    console.log('  ✅ スライダー制御統合（専用UI管理システム）');
    console.log('  ✅ プレビュー連動機能（リアルタイム同期対応）');
    console.log('  ✅ 外部システム連携（依存注入パターン採用）');
    console.log('  ✅ UI同期システム（無限ループ回避機能）');
    console.log('  ✅ エラーハンドリング強化（安全な例外処理）');
    console.log('  ✅ キーボードショートカット対応');
    console.log('🐛 デバッグ関数:');
    console.log('  - window.debugPenToolUI() - PenToolUI状態表示');
    console.log('  - window.togglePreviewSync() - プレビュー同期切り替え');
    console.log('  - window.debugPreviewSync() - プレビュー連動デバッグ');
    console.log('📊 モジュール化効果:');
    console.log('  🎯 単一責任原則準拠（ペンツールUI制御のみ）');
    console.log('  🔗 ui-manager.jsからの完全分離（独立性確保）');
    console.log('  🛡️ 外部システム安全統合（依存注入対応）');
    console.log('  ⚡ プレビュー連動最適化（スロットリング制御）');
}

console.log('🏆 pen-tool-ui.js モジュール分割版 初期化完了');