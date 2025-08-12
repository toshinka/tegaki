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
 * ペンツール専用UI制御（STEP 3更新版：PreviewSync統合）
 * drawing-tools/ui/pen-tool-ui.js
 * 
 * 🏗️ STEP 3完了状況（プレビュー連動機能移譲・最適化）:
 * 1. ✅ PreviewSyncコンポーネント統合
 * 2. ✅ ui-manager.jsからプレビュー連動機能完全移譲
 * 3. ✅ SOLID原則準拠（単一責任・依存注入）
 * 4. ✅ DRY原則準拠（重複コード排除）
 * 5. ✅ プレビュー機能の専用モジュール化
 * 6. ✅ エラーハンドリング強化
 * 7. ✅ パフォーマンス最適化
 * 
 * 責務: ペンツール専用UI制御・コンポーネント統合管理
 * 依存: SliderController, PreviewSync, PopupManager
 */

console.log('🎨 pen-tool-ui.js STEP 3更新版（PreviewSync統合）読み込み開始...');

// PreviewSyncコンポーネント動的読み込み
async function loadPreviewSync() {
    if (window.PreviewSync) {
        return window.PreviewSync;
    }
    
    // 動的import（フォールバック）
    try {
        const module = await import('./components/preview-sync.js');
        return module.PreviewSync || window.PreviewSync;
    } catch (error) {
        console.warn('PreviewSync動的読み込みエラー:', error);
        return null;
    }
}

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

// ==== ペンツール専用UI制御クラス（STEP 3更新版：PreviewSync統合）====
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
        
        // STEP 3新規: PreviewSyncコンポーネント
        this.previewSync = null;
        
        // UI制御状態
        this.sliders = new Map();
        this.isInitialized = false;
        this.errorCount = 0;
        this.maxErrors = 5;
        
        // UI同期制御
        this.syncInProgress = false;
        this.pendingSyncUpdates = new Map();
        
        console.log('🎨 PenToolUI初期化準備（STEP 3更新版：PreviewSync統合）');
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
     * STEP 3新規: PreviewSyncコンポーネント初期化
     */
    async initializePreviewSync() {
        try {
            const PreviewSyncClass = await loadPreviewSync();
            
            if (!PreviewSyncClass) {
                console.warn('⚠️ PreviewSyncコンポーネントが読み込めません');
                return false;
            }
            
            this.previewSync = new PreviewSyncClass(this);
            const initSuccess = await this.previewSync.init();
            
            if (initSuccess) {
                console.log('✅ PreviewSyncコンポーネント統合完了');
                return true;
            } else {
                console.warn('⚠️ PreviewSyncコンポーネント初期化失敗');
                this.previewSync = null;
                return false;
            }
            
        } catch (error) {
            console.error('PreviewSyncコンポーネント初期化エラー:', error);
            this.previewSync = null;
            this.handleError(error);
            return false;
        }
    }
    
    /**
     * メインUI初期化（STEP 3更新版）
     */
    async init() {
        try {
            console.log('🎯 PenToolUI初期化開始（STEP 3更新版：PreviewSync統合）...');
            
            // 外部システムの取得・初期化
            if (!this.initializeExternalSystems()) {
                throw new Error('必須システム初期化失敗（SliderController/PreviewManager不足）');
            }
            
            // スライダー制御初期化
            this.initSliders();
            
            // STEP 3新規: PreviewSyncコンポーネント初期化
            await this.initializePreviewSync();
            
            // ポップアップ制御初期化
            this.initPopupControl();
            
            // キーボードショートカット初期化
            this.initKeyboardShortcuts();
            
            // UI同期システム初期化
            this.initSyncSystem();
            
            this.isInitialized = true;
            console.log('✅ PenToolUI初期化完了（STEP 3更新版：PreviewSync統合）');
            
            return true;
            
        } catch (error) {
            console.error('❌ PenToolUI初期化エラー:', error);
            this.handleError(error);
            throw error;
        }
    }
    
    /**
     * スライダー制御初期化（STEP 3更新版：PreviewSync連携）
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
            
            // ペンサイズスライダー（STEP 3更新：PreviewSync連携版）
            this.createSlider('pen-size-slider', minSize, maxSize, defaultSize, 
                (value, displayOnly = false) => {
                    if (!displayOnly) {
                        this.drawingToolsSystem.updateBrushSettings({ size: value });
                        // STEP 3更新: PreviewSync経由で同期
                        this.syncWithPreviewSystem({ size: value });
                        console.log(`🎛️ ペンサイズ変更: ${value.toFixed(1)}px`);
                    }
                    return value.toFixed(1) + 'px';
                });
            
            // 不透明度スライダー（STEP 3更新：PreviewSync連携版）
            this.createSlider('pen-opacity-slider', 0, 100, defaultOpacity * 100, 
                (value, displayOnly = false) => {
                    if (!displayOnly) {
                        this.drawingToolsSystem.updateBrushSettings({ opacity: value / 100 });
                        // STEP 3更新: PreviewSync経由で同期
                        this.syncWithPreviewSystem({ opacity: value / 100 });
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
            
            console.log('✅ PenToolUI: スライダー設定完了（STEP 3更新：PreviewSync連携版）');
            
        } catch (error) {
            console.error('スライダー設定エラー:', error);
            this.handleError(error);
        }
    }
    
    /**
     * STEP 3新規: PreviewSyncとの連携処理
     */
    syncWithPreviewSystem(settings) {
        if (!this.previewSync || !this.previewSync.isSyncEnabled()) {
            return false;
        }
        
        try {
            // PreviewSyncコンポーネントに同期を依頼
            return this.previewSync.syncWithBrushSettings(settings);
            
        } catch (error) {
            console.warn('PreviewSync連携エラー:', error);
            this.handleError(error);
            return false;
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
     * キーボードショートカット初期化（STEP 3更新版：PreviewSync連携）
     */
    initKeyboardShortcuts() {
        try {
            console.log('⌨️ キーボードショートカット初期化（STEP 3更新版）...');
            
            // 基本的なペン関連ショートカット
            document.addEventListener('keydown', (event) => {
                // Ctrl/Cmdキーとの組み合わせは除外（システム機能優先）
                if (event.ctrlKey || event.metaKey) return;
                
                switch (event.key) {
                    case 'r':
                    case 'R':
                        if (event.shiftKey) {
                            // Shift+R: 全プレビューリセット（STEP 3更新：PreviewSync経由）
                            this.resetAllPreviews();
                            console.log('🔄 全プレビューリセット（PreviewSync経由）');
                        } else {
                            // R: アクティブプリセットリセット
                            this.resetActivePreset();
                            console.log('🔄 アクティブプリセットリセット');
                        }
                        event.preventDefault();
                        break;
                }
            });
            
            console.log('✅ キーボードショートカット初期化完了（STEP 3更新版）');
            
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
     * STEP 3更新版: プリセット連動処理（PreviewSync統合）
     */
    
    /**
     * アクティブプリセットリセット（STEP 3更新：PreviewSync連携）
     */
    resetActivePreset() {
        try {
            if (this.penPresetManager?.resetActivePreset) {
                const success = this.penPresetManager.resetActivePreset();
                
                if (success) {
                    // STEP 3更新: PreviewSync経由で同期
                    if (this.previewSync) {
                        const brushSettings = this.drawingToolsSystem.getBrushSettings();
                        this.previewSync.syncWithBrushSettings(brushSettings);
                    }
                    
                    console.log('🔄 アクティブプリセットリセット完了（PreviewSync連携）');
                    return true;
                } else {
                    console.warn('アクティブプリセットリセット失敗');
                    return false;
                }
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
     * 全プリセットプレビューリセット（STEP 3更新：PreviewSync統合）
     */
    resetAllPreviews() {
        try {
            if (this.previewSync && this.previewSync.resetAllPreviews) {
                // STEP 3更新: PreviewSyncコンポーネント経由でリセット
                const success = this.previewSync.resetAllPreviews();
                
                if (success) {
                    console.log('🔄 全プレビューリセット完了（PreviewSync統合版）');
                    return true;
                } else {
                    console.warn('全プレビューリセット失敗（PreviewSync）');
                    return false;
                }
            } else {
                console.warn('PreviewSync.resetAllPreviews が利用できません');
                return false;
            }
        } catch (error) {
            console.error('全プレビューリセットエラー:', error);
            this.handleError(error);
            return false;
        }
    }
    
    /**
     * プリセット選択（STEP 3更新：PreviewSync連携）
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
                    
                    // STEP 3更新: PreviewSync経由でプレビュー更新
                    if (this.previewSync) {
                        const presetData = this.penPresetManager.getPresetData ? 
                            this.penPresetManager.getPresetData(presetId) : null;
                        if (presetData) {
                            this.previewSync.syncWithPreset(presetData);
                        }
                    }
                    
                    console.log(`🎯 プリセット選択完了（PreviewSync連携）: ${presetId}`);
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
     * ブラシ設定変更通知（STEP 3更新版：PreviewSync統合）
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
            
            // STEP 3更新: PreviewSync統合での連動処理
            if (this.previewSync && this.previewSync.isSyncEnabled()) {
                this.previewSync.syncWithBrushSettings(settings);
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
     * STEP 3新規: プレビュー同期制御（PreviewSync統合）
     */
    setPreviewSyncEnabled(enabled) {
        if (!this.previewSync) {
            console.warn('PreviewSyncコンポーネントが利用できません');
            return false;
        }
        
        const wasEnabled = this.previewSync.isSyncEnabled();
        
        if (enabled && !wasEnabled) {
            this.previewSync.enableSync();
            console.log('🔄 プレビュー同期を有効化しました（PreviewSync統合版）');
        } else if (!enabled && wasEnabled) {
            this.previewSync.disableSync();
            console.log('🔄 プレビュー同期を無効化しました（PreviewSync統合版）');
        }
        
        return this.previewSync.isSyncEnabled();
    }
    
    isPreviewSyncEnabled() {
        return this.previewSync ? this.previewSync.isSyncEnabled() : false;
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
     * デバッグ機能（STEP 3更新版：PreviewSync統合）
     */
    debugPenUI() {
        console.group('🔍 PenToolUI デバッグ情報（STEP 3更新版：PreviewSync統合）');
        
        console.log('基本情報:', {
            initialized: this.isInitialized,
            sliders: this.sliders.size,
            errorCount: `${this.errorCount}/${this.maxErrors}`,
            syncInProgress: this.syncInProgress
        });
        
        console.log('外部システム連携:', {
            sliderController: !!this.sliderController,
            penPresetManager: !!this.penPresetManager,
            presetDisplayManager: !!this.presetDisplayManager,
            popupManager: !!this.popupManager,
            previewSync: !!this.previewSync // STEP 3新規
        });
        
        console.log('スライダー状態:', this.getAllSliderValues());
        
        // STEP 3新規: PreviewSync統合状況
        if (this.previewSync) {
            console.log('PreviewSync統合状況:', this.previewSync.getStats());
            
            // PreviewSyncのデバッグも実行
            console.log('🔄 PreviewSyncコンポーネントデバッグ実行...');
            this.previewSync.debugSync();
        } else {
            console.warn('⚠️ PreviewSyncコンポーネントが統合されていません');
        }
        
        if (this.pendingSyncUpdates.size > 0) {
            console.log('保留中更新:', Array.from(this.pendingSyncUpdates.keys()));
        }
        
        console.groupEnd();
    }
    
    /**
     * 統計取得（STEP 3更新版：PreviewSync統合）
     */
    getStats() {
        return {
            isInitialized: this.isInitialized,
            slidersCount: this.sliders.size,
            errorCount: this.errorCount,
            maxErrors: this.maxErrors,
            syncInProgress: this.syncInProgress,
            pendingUpdates: this.pendingSyncUpdates.size,
            externalSystems: {
                sliderController: !!this.sliderController,
                penPresetManager: !!this.penPresetManager,
                presetDisplayManager: !!this.presetDisplayManager,
                popupManager: !!this.popupManager,
                previewSync: !!this.previewSync // STEP 3新規
            },
            // STEP 3新規: PreviewSync統合状況
            previewSync: this.previewSync ? this.previewSync.getStats() : null,
            moduleVersion: 'v3.0-step3-preview-sync-integrated'
        };
    }
    
    /**
     * クリーンアップ（STEP 3更新版：PreviewSync統合）
     */
    destroy() {
        try {
            console.log('🧹 PenToolUI クリーンアップ開始（STEP 3更新版：PreviewSync統合）');
            
            // STEP 3新規: PreviewSyncコンポーネントのクリーンアップ
            if (this.previewSync) {
                this.previewSync.destroy();
                this.previewSync = null;
                console.log('🔄 PreviewSyncコンポーネント クリーンアップ完了');
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
            console.log('✅ PenToolUI クリーンアップ完了（STEP 3更新版：PreviewSync統合）');
            
        } catch (error) {
            console.error('PenToolUI クリーンアップエラー:', error);
        }
    }
}

// ==== グローバル登録・エクスポート====
if (typeof window !== 'undefined') {
    window.PenToolUI = PenToolUI;
    
    // STEP 3更新: PreviewSync統合版デバッグ関数
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
            const currentState = penUI.isPreviewSyncEnabled();
            const newState = penUI.setPreviewSyncEnabled(!currentState);
            console.log(`🔄 プレビュー同期切り替え（PreviewSync統合版）: ${newState ? '有効' : '無効'}`);
            return newState;
        } else {
            console.warn('PenToolUI が利用できません');
            return false;
        }
    };
    
    window.debugPreviewSync = function() {
        if (window.toolsSystem?.penToolUI?.previewSync) {
            const previewSync = window.toolsSystem.penToolUI.previewSync;
            console.group('🔍 プレビュー連動デバッグ（STEP 3統合版）');
            
            previewSync.debugSync();
            
            console.groupEnd();
        } else {
            console.warn('PreviewSyncコンポーネントが利用できません');
        }
    };
    
    // STEP 3新規: PreviewSync統計表示
    window.getPreviewSyncStats = function() {
        if (window.toolsSystem?.penToolUI?.previewSync) {
            const stats = window.toolsSystem.penToolUI.previewSync.getStats();
            console.log('📊 PreviewSync統計（STEP 3統合版）:', stats);
            return stats;
        } else {
            console.warn('PreviewSyncコンポーネントが利用できません');
            return null;
        }
    };
    
    console.log('✅ pen-tool-ui.js STEP 3更新版（PreviewSync統合） 読み込み完了');
    console.log('📦 エクスポートクラス（STEP 3更新版）:');
    console.log('  ✅ PenToolUI: ペンツール専用UI制御（PreviewSync統合版）');
    console.log('🎨 STEP 3完了効果:');
    console.log('  ✅ PreviewSyncコンポーネント統合完了');
    console.log('  ✅ ui-manager.jsからプレビュー連動機能完全移譲');
    console.log('  ✅ SOLID原則準拠（単一責任・依存注入）');
    console.log('  ✅ DRY原則準拠（重複コード排除）');
    console.log('  ✅ プレビュー機能の専用モジュール化');
    console.log('  ✅ エラーハンドリング強化');
    console.log('  ✅ パフォーマンス最適化（スロットリング制御）');
    console.log('🐛 デバッグ関数（STEP 3更新版）:');
    console.log('  - window.debugPenToolUI() - PenToolUI統合状態表示');
    console.log('  - window.togglePreviewSync() - プレビュー同期切り替え');
    console.log('  - window.debugPreviewSync() - PreviewSync専用デバッグ');
    console.log('  - window.getPreviewSyncStats() - PreviewSync統計表示（新規）');
    console.log('📊 モジュール化効果（STEP 3完了）:');
    console.log('  🎯 プレビュー連動機能の完全独立');
    console.log('  🔗 ui-manager.jsとの依存関係解消');
    console.log('  🛡️ コンポーネント単位でのエラー分離');
    console.log('  ⚡ プレビュー同期処理の最適化・高速化');
}

console.log('🏆 pen-tool-ui.js STEP 3更新版（PreviewSync統合） 初期化完了');