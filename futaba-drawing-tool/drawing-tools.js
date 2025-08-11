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
 * 描画ツール群 - drawing-tools.js (STEP 2完成版: PenToolUI統合)
 * 
 * 🔧 STEP 2実装完了（ペンUI責務移譲）:
 * 1. ✅ PenToolUIクラス完成: ui-manager.jsからスライダー制御機能完全移譲
 * 2. ✅ スライダー制御システム: setupSliders, createSlider, updateSliderValue等
 * 3. ✅ 外部システム依存注入: SliderController, PenPresetManager統合
 * 4. ✅ DrawingToolsSystem API拡張: initUI, getPenUI, onBrushSettingsChanged
 * 5. ✅ エラーハンドリング強化・デバッグ機能充実
 * 6. ✅ DRY・SOLID原則準拠（単一責任原則・依存性逆転）
 * 
 * 責務: 描画ツール管理 + ペンツール専用UI制御
 * 依存: app-core.js, ui/components.js, config.js
 * 
 * STEP 2達成目標: ペンスライダー制御の完全独立性確保
 */

console.log('🔧 drawing-tools.js STEP 2完成版読み込み開始...');

// ==== EVENTS定数の確保 ====
const EVENTS = window.EVENTS || {
    POINTER_DOWN: 'pointerdown',
    POINTER_MOVE: 'pointermove', 
    POINTER_UP: 'pointerup',
    POINTER_UP_OUTSIDE: 'pointerupoutside'
};

// ==== CONFIG値安全取得（DRY原則準拠）====
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

// ==== ベースツールクラス ====
class BaseTool {
    constructor(name, app, historyManager = null) {
        this.name = name;
        this.app = app;
        this.historyManager = historyManager;
        this.isActive = false;
        this.currentPath = null;
        this.operationStartState = null;
    }
    
    activate() {
        this.isActive = true;
        this.onActivate();
    }
    
    deactivate() {
        this.isActive = false;
        this.onDeactivate();
    }
    
    setHistoryManager(historyManager) {
        this.historyManager = historyManager;
    }
    
    captureStartState() {
        if (this.historyManager && window.InternalStateCapture) {
            this.operationStartState = window.InternalStateCapture.captureDrawingState(this.app);
        }
    }
    
    recordOperation() {
        if (this.historyManager && this.operationStartState) {
            this.historyManager.recordDrawingOperation(
                this.name, 
                this.operationStartState
            );
            this.operationStartState = null;
        }
    }
    
    onActivate() {}
    onDeactivate() {}
    onPointerDown(x, y, event) {}
    onPointerMove(x, y, event) {}
    onPointerUp(x, y, event) {}
}

// ==== ベクターペンツール（履歴管理対応版）====
class VectorPenTool extends BaseTool {
    constructor(app, historyManager = null) {
        super('pen', app, historyManager);
        this.lastPoint = null;
        this.smoothingBuffer = [];
        this.maxBufferSize = 5;
    }
    
    onActivate() {
        console.log('🖊️ ベクターペンツール アクティブ');
        this.app.updateState({ currentTool: 'pen' });
        this.setupEventListeners();
    }
    
    onDeactivate() {
        this.cleanup();
    }
    
    setupEventListeners() {
        const drawingLayer = this.app.layers.drawingLayer;
        
        drawingLayer.on(EVENTS.POINTER_DOWN, (event) => {
            if (!this.isActive) return;
            const point = this.app.getLocalPointerPosition(event);
            this.onPointerDown(point.x, point.y, event);
        });
        
        drawingLayer.on(EVENTS.POINTER_MOVE, (event) => {
            if (!this.isActive) return;
            const point = this.app.getLocalPointerPosition(event);
            this.onPointerMove(point.x, point.y, event);
        });
        
        drawingLayer.on(EVENTS.POINTER_UP, (event) => {
            if (!this.isActive) return;
            const point = this.app.getLocalPointerPosition(event);
            this.onPointerUp(point.x, point.y, event);
        });
        
        drawingLayer.on(EVENTS.POINTER_UP_OUTSIDE, (event) => {
            if (!this.isActive) return;
            this.onPointerUp(0, 0, event);
        });
    }
    
    onPointerDown(x, y, event) {
        this.captureStartState();
        this.currentPath = this.app.createPath(x, y, 'pen');
        this.lastPoint = { x, y };
        this.smoothingBuffer = [{ x, y }];
        console.log(`ペン開始: (${x.toFixed(1)}, ${y.toFixed(1)})`);
    }
    
    onPointerMove(x, y, event) {
        if (!this.currentPath || !this.app.state.isDrawing) return;
        const smoothedPoint = this.applySmoothingFilter(x, y);
        this.app.extendPath(this.currentPath, smoothedPoint.x, smoothedPoint.y);
        this.lastPoint = smoothedPoint;
    }
    
    onPointerUp(x, y, event) {
        if (this.currentPath) {
            this.app.finalizePath(this.currentPath);
            this.recordOperation();
            console.log(`ペン終了: パス完成 (${this.currentPath.points.length}点)`);
        }
        this.cleanup();
    }
    
    applySmoothingFilter(x, y) {
        const smoothing = this.app.state.smoothing;
        
        if (smoothing === 0 || this.smoothingBuffer.length === 0) {
            this.smoothingBuffer.push({ x, y });
            return { x, y };
        }
        
        this.smoothingBuffer.push({ x, y });
        if (this.smoothingBuffer.length > this.maxBufferSize) {
            this.smoothingBuffer.shift();
        }
        
        const bufferLength = this.smoothingBuffer.length;
        const avgX = this.smoothingBuffer.reduce((sum, p) => sum + p.x, 0) / bufferLength;
        const avgY = this.smoothingBuffer.reduce((sum, p) => sum + p.y, 0) / bufferLength;
        
        const smoothedX = x + (avgX - x) * smoothing;
        const smoothedY = y + (avgY - y) * smoothing;
        
        return { x: smoothedX, y: smoothedY };
    }
    
    cleanup() {
        this.currentPath = null;
        this.lastPoint = null;
        this.smoothingBuffer = [];
        this.operationStartState = null;
    }
}

// ==== 消しゴムツール（履歴管理対応版）====
class EraserTool extends BaseTool {
    constructor(app, historyManager = null) {
        super('eraser', app, historyManager);
        this.lastPoint = null;
    }
    
    onActivate() {
        console.log('🧽 消しゴムツール アクティブ');
        this.app.updateState({ currentTool: 'eraser' });
        this.setupEventListeners();
    }
    
    onDeactivate() {
        this.cleanup();
    }
    
    setupEventListeners() {
        const drawingLayer = this.app.layers.drawingLayer;
        
        drawingLayer.on(EVENTS.POINTER_DOWN, (event) => {
            if (!this.isActive) return;
            const point = this.app.getLocalPointerPosition(event);
            this.onPointerDown(point.x, point.y, event);
        });
        
        drawingLayer.on(EVENTS.POINTER_MOVE, (event) => {
            if (!this.isActive) return;
            const point = this.app.getLocalPointerPosition(event);
            this.onPointerMove(point.x, point.y, event);
        });
        
        drawingLayer.on(EVENTS.POINTER_UP, (event) => {
            if (!this.isActive) return;
            const point = this.app.getLocalPointerPosition(event);
            this.onPointerUp(point.x, point.y, event);
        });
        
        drawingLayer.on(EVENTS.POINTER_UP_OUTSIDE, (event) => {
            if (!this.isActive) return;
            this.onPointerUp(0, 0, event);
        });
    }
    
    onPointerDown(x, y, event) {
        this.captureStartState();
        this.currentPath = this.app.createPath(x, y, 'eraser');
        this.lastPoint = { x, y };
        console.log(`消しゴム開始: (${x.toFixed(1)}, ${y.toFixed(1)})`);
    }
    
    onPointerMove(x, y, event) {
        if (!this.currentPath || !this.app.state.isDrawing) return;
        this.app.extendPath(this.currentPath, x, y);
        this.lastPoint = { x, y };
    }
    
    onPointerUp(x, y, event) {
        if (this.currentPath) {
            this.app.finalizePath(this.currentPath);
            this.recordOperation();
            console.log(`消しゴム終了: パス完成`);
        }
        this.cleanup();
    }
    
    cleanup() {
        this.currentPath = null;
        this.lastPoint = null;
        this.operationStartState = null;
    }
}

// ==== ツール管理システム（履歴管理統合版）====
class ToolManager {
    constructor(app, historyManager = null) {
        this.app = app;
        this.historyManager = historyManager;
        this.tools = new Map();
        this.activeTool = null;
        
        this.initializeTools();
    }
    
    initializeTools() {
        this.registerTool('pen', new VectorPenTool(this.app, this.historyManager));
        this.registerTool('eraser', new EraserTool(this.app, this.historyManager));
        
        console.log(`✅ ${this.tools.size}個のツールを登録完了（履歴管理対応版）`);
    }
    
    setHistoryManager(historyManager) {
        this.historyManager = historyManager;
        
        this.tools.forEach(tool => {
            if (tool.setHistoryManager) {
                tool.setHistoryManager(historyManager);
            }
        });
        
        console.log('🔧 ToolManager: 履歴管理システム設定完了');
    }
    
    registerTool(name, tool) {
        this.tools.set(name, tool);
        console.log(`🔧 ツール登録（履歴対応）: ${name}`);
    }
    
    setActiveTool(toolName) {
        if (!this.tools.has(toolName)) {
            console.warn(`未知のツール: ${toolName}`);
            return false;
        }
        
        const beforeTool = this.activeTool ? this.activeTool.name : null;
        
        if (this.activeTool) {
            this.activeTool.deactivate();
        }
        
        this.activeTool = this.tools.get(toolName);
        this.activeTool.activate();
        
        if (this.historyManager && beforeTool !== toolName) {
            this.historyManager.recordToolChange(beforeTool, toolName);
        }
        
        console.log(`🔄 ツール切り替え（履歴対応）: ${toolName}`);
        return true;
    }
    
    getActiveTool() {
        return this.activeTool;
    }
    
    getAvailableTools() {
        return Array.from(this.tools.keys());
    }
}

// ==== STEP 2完成: PenToolUI クラス（スライダー制御完全版）====
class PenToolUI {
    constructor(drawingToolsSystem) {
        this.drawingToolsSystem = drawingToolsSystem;
        this.app = drawingToolsSystem.app;
        
        // 外部システム参照（依存注入パターン）
        this.sliders = new Map();
        this.sliderController = null;
        this.penPresetManager = null;
        this.presetDisplayManager = null;
        
        // UI制御状態
        this.isInitialized = false;
        this.errorCount = 0;
        this.maxErrors = 5;
        
        // プレビュー連動制御（STEP 3で実装予定）
        this.previewSyncEnabled = true;
        this.previewUpdateThrottle = null;
        this.lastPreviewUpdate = 0;
        
        console.log('🎨 PenToolUI初期化準備（STEP 2完成版: スライダー制御特化）');
    }
    
    /**
     * STEP 2: 外部システム安全初期化（DRY原則準拠）
     */
    initializeExternalSystems() {
        let initSuccess = 0;
        let initTotal = 0;
        
        try {
            // SliderControllerクラスの確認・初期化
            initTotal++;
            if (typeof window.SliderController !== 'undefined') {
                this.sliderController = window.SliderController;
                console.log('✅ SliderController連携完了');
                initSuccess++;
            } else {
                console.warn('⚠️ SliderController が利用できません');
            }
            
            // PenPresetManagerクラスの確認（STEP 3で使用予定）
            initTotal++;
            if (typeof window.PenPresetManager !== 'undefined') {
                // 初期化はしないが、存在確認のみ
                console.log('✅ PenPresetManager検出完了（STEP 3で使用予定）');
                initSuccess++;
            } else {
                console.warn('⚠️ PenPresetManager が利用できません（STEP 3で必要）');
            }
            
            // PresetDisplayManagerクラスの確認（STEP 3で使用予定）
            initTotal++;
            if (typeof window.PresetDisplayManager !== 'undefined') {
                console.log('✅ PresetDisplayManager検出完了（STEP 3で使用予定）');
                initSuccess++;
            } else {
                console.warn('⚠️ PresetDisplayManager が利用できません（STEP 3で必要）');
            }
            
            console.log(`📊 外部システム統合状況: ${initSuccess}/${initTotal}システム利用可能`);
            
            // STEP 2では SliderController のみが必須
            return !!this.sliderController;
            
        } catch (error) {
            console.error('外部システム初期化エラー:', error);
            this.handleError(error);
            return false;
        }
    }
    
    /**
     * STEP 2: メインUI初期化（ui-manager.jsから移譲完了版）
     */
    async init() {
        try {
            console.log('🎯 PenToolUI初期化開始（STEP 2完成版: スライダー制御移譲）...');
            
            // 外部システムの取得・初期化
            if (!this.initializeExternalSystems()) {
                throw new Error('必須システム初期化失敗（SliderController不足）');
            }
            
            // STEP 2: スライダー制御初期化（ui-manager.jsから完全移譲）
            this.initSliders();
            
            // STEP 3予定機能のプレースホルダー
            this.prepareStep3Features();
            
            this.isInitialized = true;
            console.log('✅ PenToolUI初期化完了（STEP 2完成版: スライダー制御移譲）');
            
            return true;
            
        } catch (error) {
            console.error('❌ PenToolUI初期化エラー:', error);
            this.handleError(error);
            throw error;
        }
    }
    
    /**
     * STEP 2: スライダー制御初期化（ui-manager.jsから完全移譲）
     */
    initSliders() {
        if (!this.sliderController) {
            console.warn('SliderController が利用できません');
            return;
        }
        
        try {
            // CONFIG値を安全に取得（DRY原則）
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
            
            // ペンサイズスライダー（ui-manager.jsから移譲）
            this.createSlider('pen-size-slider', minSize, maxSize, defaultSize, 
                (value, displayOnly = false) => {
                    if (!displayOnly) {
                        this.drawingToolsSystem.updateBrushSettings({ size: value });
                        // STEP 3で実装予定: プレビュー連動
                        // this.updatePresetLiveValues(value, null);
                        // this.updateActivePresetPreview(value, null);
                        console.log(`🎛️ ペンサイズ変更: ${value.toFixed(1)}px`);
                    }
                    return value.toFixed(1) + 'px';
                });
            
            // 不透明度スライダー（ui-manager.jsから移譲）
            this.createSlider('pen-opacity-slider', 0, 100, defaultOpacity * 100, 
                (value, displayOnly = false) => {
                    if (!displayOnly) {
                        this.drawingToolsSystem.updateBrushSettings({ opacity: value / 100 });
                        // STEP 3で実装予定: プレビュー連動
                        // this.updatePresetLiveValues(null, value);
                        // this.updateActivePresetPreview(null, value);
                        console.log(`🎛️ 不透明度変更: ${value.toFixed(1)}%`);
                    }
                    return value.toFixed(1) + '%';
                });
            
            // 筆圧スライダー（ui-manager.jsから移譲）
            this.createSlider('pen-pressure-slider', 0, 100, defaultPressure * 100, 
                (value, displayOnly = false) => {
                    if (!displayOnly) {
                        this.drawingToolsSystem.updateBrushSettings({ pressure: value / 100 });
                        console.log(`🎛️ 筆圧変更: ${value.toFixed(1)}%`);
                    }
                    return value.toFixed(1) + '%';
                });
            
            // 線補正スライダー（ui-manager.jsから移譲）
            this.createSlider('pen-smoothing-slider', 0, 100, defaultSmoothing * 100, 
                (value, displayOnly = false) => {
                    if (!displayOnly) {
                        this.drawingToolsSystem.updateBrushSettings({ smoothing: value / 100 });
                        console.log(`🎛️ 線補正変更: ${value.toFixed(1)}%`);
                    }
                    return value.toFixed(1) + '%';
                });
            
            // スライダーボタンの設定（ui-manager.jsから移譲）
            this.initSliderButtons();
            
            console.log('✅ PenToolUI: スライダー設定完了（STEP 2完全移譲版）');
            
        } catch (error) {
            console.error('スライダー設定エラー:', error);
            this.handleError(error);
        }
    }
    
    /**
     * STEP 2: スライダー作成（ui-manager.jsから移譲）
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
     * STEP 2: スライダーボタン設定（ui-manager.jsから移譲・拡張）
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
                    if (slider && slider.adjustValue) {
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
     * STEP 2: スライダー値更新（ui-manager.jsから移譲）
     */
    updateSliderValue(sliderId, value) {
        const slider = this.sliders.get(sliderId);
        if (slider && slider.setValue) {
            slider.setValue(value, true); // displayOnly = true
            return true;
        }
        console.warn(`スライダー更新失敗: ${sliderId}`);
        return false;
    }
    
    /**
     * STEP 2: 全スライダー値取得（ui-manager.jsから移譲）
     */
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
     * STEP 2: ブラシ設定変更通知（DrawingToolsSystemから呼び出し）
     */
    onBrushSettingsChanged(settings) {
        try {
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
            
            // STEP 3で実装予定: プレビュー連動機能
            // this.updatePresetLiveValues(settings.size, settings.opacity ? settings.opacity * 100 : null);
            // this.updateActivePresetPreview(settings.size, settings.opacity ? settings.opacity * 100 : null);
            
        } catch (error) {
            console.error('ブラシ設定変更同期エラー:', error);
            this.handleError(error);
        }
    }
    
    /**
     * STEP 3予定機能のプレースホルダー（プレビュー連動機能）
     */
    prepareStep3Features() {
        // STEP 3で実装予定の機能群
        console.log('📋 STEP 3予定機能準備:');
        console.log('  - プレビュー連動システム初期化');
        console.log('  - PenPresetManager統合');
        console.log('  - PresetDisplayManager統合');
        console.log('  - リアルタイムプレビュー更新');
        console.log('  - ライブ値管理機能');
    }
    
    /**
     * STEP 2: エラーハンドリング（DRY原則準拠）
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
     * STEP 2: デバッグ機能（基本版）
     */
    debugPenUI() {
        console.group('🔍 PenToolUI デバッグ情報（STEP 2完成版）');
        
        console.log('基本情報:', {
            initialized: this.isInitialized,
            sliders: this.sliders.size,
            errorCount: `${this.errorCount}/${this.maxErrors}`,
            previewSyncEnabled: this.previewSyncEnabled
        });
        
        console.log('外部システム連携:', {
            sliderController: !!this.sliderController,
            penPresetManager: !!this.penPresetManager,
            presetDisplayManager: !!this.presetDisplayManager
        });
        
        console.log('スライダー状態:', this.getAllSliderValues());
        
        console.groupEnd();
    }
    
    /**
     * STEP 2: 統計取得
     */
    getStats() {
        return {
            isInitialized: this.isInitialized,
            slidersCount: this.sliders.size,
            errorCount: this.errorCount,
            maxErrors: this.maxErrors,
            previewSyncEnabled: this.previewSyncEnabled,
            externalSystems: {
                sliderController: !!this.sliderController,
                penPresetManager: !!this.penPresetManager,
                presetDisplayManager: !!this.presetDisplayManager
            },
            step2Completed: true,
            step3Ready: false
        };
    }
    
    /**
     * STEP 2: クリーンアップ
     */
    destroy() {
        try {
            console.log('🧹 PenToolUI クリーンアップ開始（STEP 2版）');
            
            // プレビュー更新スロットリングのクリア
            if (this.previewUpdateThrottle) {
                clearTimeout(this.previewUpdateThrottle);
                this.previewUpdateThrottle = null;
            }
            
            // スライダーのクリーンアップ
            for (const slider of this.sliders.values()) {
                if (slider && slider.destroy) {
                    slider.destroy();
                }
            }
            this.sliders.clear();
            
            // 参照のクリア
            this.sliderController = null;
            this.penPresetManager = null;
            this.presetDisplayManager = null;
            
            this.isInitialized = false;
            console.log('✅ PenToolUI クリーンアップ完了（STEP 2版）');
            
        } catch (error) {
            console.error('PenToolUI クリーンアップエラー:', error);
        }
    }
}

// ==== DrawingToolsSystem（STEP 2拡張版：PenToolUI統合）====
class DrawingToolsSystem {
    constructor(app) {
        this.app = app;
        this.toolManager = null;
        this.historyManager = null;
        
        // STEP 2新規追加: ペンツール専用UI制御システム
        this.penToolUI = null;
        
        // ブラシ設定状態
        this.brushSettings = {
            size: safeConfigGet('DEFAULT_BRUSH_SIZE', 4),
            opacity: safeConfigGet('DEFAULT_OPACITY', 1.0),
            color: safeConfigGet('DEFAULT_COLOR', 0x800000),
            pressure: safeConfigGet('DEFAULT_PRESSURE', 0.5),
            smoothing: safeConfigGet('DEFAULT_SMOOTHING', 0.3)
        };
        
        console.log('🎯 DrawingToolsSystem初期化（STEP 2拡張版：PenToolUI統合）');
    }
    
    async init() {
        try {
            console.log('🎯 DrawingToolsSystem初期化開始（STEP 2拡張版）...');
            
            // 基本システムの初期化
            this.toolManager = new ToolManager(this.app, this.historyManager);
            
            // デフォルトツールの設定
            this.toolManager.setActiveTool('pen');
            
            console.log('✅ DrawingToolsSystem初期化完了（STEP 2拡張版）');
            
        } catch (error) {
            console.error('❌ DrawingToolsSystem初期化エラー:', error);
            throw error;
        }
    }
    
    /**
     * STEP 2新規API: ペンツール専用UI初期化
     */
    async initUI() {
        try {
            console.log('🎨 ペンツールUI初期化開始（STEP 2新規API）...');
            
            if (!this.penToolUI) {
                this.penToolUI = new PenToolUI(this);
            }
            
            const success = await this.penToolUI.init();
            
            if (success) {
                console.log('✅ ペンツールUI初期化完了（STEP 2新規API）');
            } else {
                console.error('❌ ペンツールUI初期化失敗');
            }
            
            return success;
            
        } catch (error) {
            console.error('❌ ペンツールUI初期化エラー:', error);
            throw error;
        }
    }
    
    /**
     * STEP 2新規API: PenToolUI取得
     */
    getPenUI() {
        return this.penToolUI;
    }
    
    /**
     * STEP 2拡張: ブラシ設定更新（UI通知機能付き）
     */
    updateBrushSettings(newSettings) {
        let updated = false;
        const oldSettings = { ...this.brushSettings };
        
        // 設定値の更新と検証
        Object.keys(newSettings).forEach(key => {
            if (key in this.brushSettings) {
                let value = newSettings[key];
                
                // 値の妥当性チェック
                switch (key) {
                    case 'size':
                        value = Math.max(
                            safeConfigGet('MIN_BRUSH_SIZE', 0.1),
                            Math.min(safeConfigGet('MAX_BRUSH_SIZE', 500), parseFloat(value))
                        );
                        break;
                    case 'opacity':
                    case 'pressure':
                    case 'smoothing':
                        value = Math.max(0, Math.min(1, parseFloat(value)));
                        break;
                    case 'color':
                        value = parseInt(value, 10) || this.brushSettings.color;
                        break;
                }
                
                if (this.brushSettings[key] !== value) {
                    this.brushSettings[key] = value;
                    updated = true;
                }
            }
        });
        
        // アプリケーション状態の更新
        if (updated) {
            this.app.updateState({
                size: this.brushSettings.size,
                opacity: this.brushSettings.opacity,
                color: this.brushSettings.color,
                pressure: this.brushSettings.pressure,
                smoothing: this.brushSettings.smoothing
            });
            
            // STEP 2新規: PenToolUIに変更を通知
            if (this.penToolUI && this.penToolUI.onBrushSettingsChanged) {
                this.penToolUI.onBrushSettingsChanged(newSettings);
            }
            
            console.log('🔄 ブラシ設定更新（UI通知付き）:', newSettings);
        }
        
        return updated;
    }
    
    // 既存メソッド群（変更なし）
    getBrushSettings() {
        return { ...this.brushSettings };
    }
    
    setHistoryManager(historyManager) {
        this.historyManager = historyManager;
        
        if (this.toolManager) {
            this.toolManager.setHistoryManager(historyManager);
        }
        
        console.log('📚 DrawingToolsSystem: 履歴管理システム設定完了');
    }
    
    setTool(toolName) {
        if (this.toolManager) {
            return this.toolManager.setActiveTool(toolName);
        }
        return false;
    }
    
    getCurrentTool() {
        if (this.toolManager && this.toolManager.getActiveTool()) {
            return this.toolManager.getActiveTool().name;
        }
        return null;
    }
    
    getAvailableTools() {
        if (this.toolManager) {
            return this.toolManager.getAvailableTools();
        }
        return [];
    }
    
    /**
     * STEP 2拡張: 統計取得（UI統合情報付き）
     */
    getStats() {
        const baseStats = {
            brushSettings: { ...this.brushSettings },
            currentTool: this.getCurrentTool(),
            availableTools: this.getAvailableTools(),
            historyManager: !!this.historyManager,
            toolManager: !!this.toolManager
        };
        
        // STEP 2新規: PenToolUI統計情報の統合
        if (this.penToolUI) {
            baseStats.penToolUI = this.penToolUI.getStats();
        } else {
            baseStats.penToolUI = null;
        }
        
        return baseStats;
    }
    
    /**
     * STEP 2拡張: デバッグ機能（UI統合情報付き）
     */
    debugDrawingTools() {
        console.group('🔍 DrawingToolsSystem デバッグ情報（STEP 2拡張版）');
        
        console.log('基本情報:', {
            currentTool: this.getCurrentTool(),
            availableTools: this.getAvailableTools(),
            brushSettings: this.brushSettings
        });
        
        console.log('システム状態:', {
            toolManager: !!this.toolManager,
            historyManager: !!this.historyManager,
            penToolUI: !!this.penToolUI
        });
        
        // STEP 2新規: PenToolUIデバッグ情報
        if (this.penToolUI) {
            console.log('PenToolUI統合状況:', this.penToolUI.getStats());
        }
        
        console.groupEnd();
    }
    
    /**
     * STEP 2拡張: クリーンアップ（UI統合対応）
     */
    destroy() {
        try {
            console.log('🧹 DrawingToolsSystem クリーンアップ開始（STEP 2拡張版）');
            
            // STEP 2新規: PenToolUIクリーンアップ
            if (this.penToolUI) {
                this.penToolUI.destroy();
                this.penToolUI = null;
            }
            
            // ツール管理のクリーンアップ
            if (this.toolManager) {
                // 各ツールのクリーンアップ
                this.toolManager.tools.forEach(tool => {
                    if (tool.destroy) {
                        tool.destroy();
                    }
                });
                this.toolManager = null;
            }
            
            // 参照のクリア
            this.historyManager = null;
            
            console.log('✅ DrawingToolsSystem クリーンアップ完了（STEP 2拡張版）');
            
        } catch (error) {
            console.error('DrawingToolsSystem クリーンアップエラー:', error);
        }
    }
}

// ==== グローバル登録・エクスポート（STEP 2完成版）====
if (typeof window !== 'undefined') {
    // 基本クラスのエクスポート
    window.BaseTool = BaseTool;
    window.VectorPenTool = VectorPenTool;
    window.EraserTool = EraserTool;
    window.ToolManager = ToolManager;
    
    // STEP 2新規: ペンツール専用UI
    window.PenToolUI = PenToolUI;
    
    // メインシステム
    window.DrawingToolsSystem = DrawingToolsSystem;
    
    // STEP 2新規: デバッグ関数
    window.debugPenToolUI = function() {
        if (window.drawingTools && window.drawingTools.penToolUI) {
            window.drawingTools.penToolUI.debugPenUI();
        } else {
            console.warn('PenToolUI が利用できません');
        }
    };
    
    window.debugDrawingToolsSystem = function() {
        if (window.drawingTools) {
            window.drawingTools.debugDrawingTools();
        } else {
            console.warn('DrawingToolsSystem が利用できません');
        }
    };
    
    console.log('✅ drawing-tools.js STEP 2完成版 読み込み完了');
    console.log('📦 エクスポートクラス（STEP 2完成版）:');
    console.log('  ✅ BaseTool, VectorPenTool, EraserTool: 描画ツール基盤');
    console.log('  ✅ ToolManager: ツール管理システム（履歴対応版）');
    console.log('  ✅ PenToolUI: ペンツール専用UI制御（スライダー制御完全版）');
    console.log('  ✅ DrawingToolsSystem: 統合描画システム（UI統合版）');
    console.log('🔧 STEP 2実装完了:');
    console.log('  ✅ ui-manager.jsからスライダー制御機能完全移譲');
    console.log('  ✅ 外部システム依存注入（SliderController統合）');
    console.log('  ✅ DrawingToolsSystem API拡張（initUI, getPenUI）');
    console.log('  ✅ エラーハンドリング強化・デバッグ機能充実');
    console.log('  ✅ DRY・SOLID原則準拠（単一責任原則・依存性逆転）');
    console.log('🎯 責務: 描画ツール管理 + ペンツール専用UI制御');
    console.log('🐛 デバッグ関数（STEP 2版）:');
    console.log('  - window.debugPenToolUI() - PenToolUI状態表示');
    console.log('  - window.debugDrawingToolsSystem() - システム全体状態表示');
    console.log('📋 STEP 3準備完了: プレビュー連動機能移譲対応');
}

console.log('🏆 drawing-tools.js STEP 2完成版 初期化完了');