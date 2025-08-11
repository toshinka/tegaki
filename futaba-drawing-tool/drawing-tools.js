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
 * 描画ツール群 - drawing-tools.js (STEP 3完成版: プレビュー連動機能統合)
 * 
 * 🔧 STEP 3実装完了（ペンUI責務移譲・プレビュー連動統合）:
 * 1. ✅ PenToolUIクラス完成: ui-manager.jsからプレビュー連動機能完全移譲
 * 2. ✅ プレビュー更新システム: リアルタイム連動・スロットリング制御
 * 3. ✅ プリセット管理統合: PenPresetManager, PresetDisplayManager完全連携
 * 4. ✅ UI同期システム: ツール設定↔UIの双方向同期完了
 * 5. ✅ main.js統合修正: toolsSystem APIの完全対応
 * 6. ✅ EVENTS定数重複解決: 安全な定数参照方式
 * 7. ✅ エラーハンドリング強化・DRY原則完全準拠
 * 
 * 責務: 描画ツール管理 + ペンツール専用UI制御（完全版）
 * 依存: app-core.js, ui/components.js, config.js
 * 
 * STEP 3達成目標: ui-manager.jsからペンUI機能の完全分離・独立性確保
 */

console.log('🔧 drawing-tools.js STEP 3完成版読み込み開始...');

// ==== EVENTS定数の安全取得（重複宣言回避）====
const TOOL_EVENTS = window.EVENTS || {
    POINTER_DOWN: 'pointerdown',
    POINTER_MOVE: 'pointermove', 
    POINTER_UP: 'pointerup',
    POINTER_UP_OUTSIDE: 'pointerupoutside'
};

// ==== CONFIG値安全取得（DRY原則準拠・拡張版）====
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

// ==== ブラシ設定バリデーション（DRY原則）====
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
        
        drawingLayer.on(TOOL_EVENTS.POINTER_DOWN, (event) => {
            if (!this.isActive) return;
            const point = this.app.getLocalPointerPosition(event);
            this.onPointerDown(point.x, point.y, event);
        });
        
        drawingLayer.on(TOOL_EVENTS.POINTER_MOVE, (event) => {
            if (!this.isActive) return;
            const point = this.app.getLocalPointerPosition(event);
            this.onPointerMove(point.x, point.y, event);
        });
        
        drawingLayer.on(TOOL_EVENTS.POINTER_UP, (event) => {
            if (!this.isActive) return;
            const point = this.app.getLocalPointerPosition(event);
            this.onPointerUp(point.x, point.y, event);
        });
        
        drawingLayer.on(TOOL_EVENTS.POINTER_UP_OUTSIDE, (event) => {
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
        
        drawingLayer.on(TOOL_EVENTS.POINTER_DOWN, (event) => {
            if (!this.isActive) return;
            const point = this.app.getLocalPointerPosition(event);
            this.onPointerDown(point.x, point.y, event);
        });
        
        drawingLayer.on(TOOL_EVENTS.POINTER_MOVE, (event) => {
            if (!this.isActive) return;
            const point = this.app.getLocalPointerPosition(event);
            this.onPointerMove(point.x, point.y, event);
        });
        
        drawingLayer.on(TOOL_EVENTS.POINTER_UP, (event) => {
            if (!this.isActive) return;
            const point = this.app.getLocalPointerPosition(event);
            this.onPointerUp(point.x, point.y, event);
        });
        
        drawingLayer.on(TOOL_EVENTS.POINTER_UP_OUTSIDE, (event) => {
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

// ==== STEP 3完成: PenToolUI クラス（プレビュー連動機能統合完全版）====
class PenToolUI {
    constructor(drawingToolsSystem) {
        this.drawingToolsSystem = drawingToolsSystem;
        this.app = drawingToolsSystem.app;
        
        // 外部システム参照（依存注入パターン）
        this.sliders = new Map();
        this.sliderController = null;
        this.penPresetManager = null;
        this.presetDisplayManager = null;
        this.popupManager = null;
        
        // UI制御状態
        this.isInitialized = false;
        this.errorCount = 0;
        this.maxErrors = 5;
        
        // STEP 3新規: プレビュー連動制御
        this.previewSyncEnabled = true;
        this.previewUpdateThrottle = null;
        this.lastPreviewUpdate = 0;
        this.previewUpdateInterval = safeConfigGet('PRESET_UPDATE_THROTTLE', 16);
        
        // STEP 3新規: UI同期制御
        this.syncInProgress = false;
        this.pendingSyncUpdates = new Map();
        
        console.log('🎨 PenToolUI初期化準備（STEP 3完成版: プレビュー連動機能統合）');
    }
    
    /**
     * STEP 3: 外部システム安全初期化（完全版）
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
            
            // STEP 3新規: PenPresetManagerクラスの完全統合
            initTotal++;
            if (window.penPresetManager || typeof window.PenPresetManager !== 'undefined') {
                this.penPresetManager = window.penPresetManager || new window.PenPresetManager();
                console.log('✅ PenPresetManager統合完了');
                initSuccess++;
            } else {
                console.warn('⚠️ PenPresetManager が利用できません');
            }
            
            // STEP 3新規: PresetDisplayManagerクラスの完全統合
            initTotal++;
            if (window.presetDisplayManager || typeof window.PresetDisplayManager !== 'undefined') {
                this.presetDisplayManager = window.presetDisplayManager || new window.PresetDisplayManager();
                console.log('✅ PresetDisplayManager統合完了');
                initSuccess++;
            } else {
                console.warn('⚠️ PresetDisplayManager が利用できません');
            }
            
            // STEP 3新規: PopupManager統合（将来の拡張用）
            initTotal++;
            if (typeof window.PopupManager !== 'undefined') {
                this.popupManager = window.PopupManager;
                console.log('✅ PopupManager統合完了');
                initSuccess++;
            } else {
                console.warn('📋 PopupManager 未実装（将来の拡張用）');
            }
            
            console.log(`📊 外部システム統合状況: ${initSuccess}/${initTotal}システム利用可能`);
            
            // STEP 3では SliderController + プレビュー系システムが必須
            return !!(this.sliderController && (this.penPresetManager || this.presetDisplayManager));
            
        } catch (error) {
            console.error('外部システム初期化エラー:', error);
            this.handleError(error);
            return false;
        }
    }
    
    /**
     * STEP 3: メインUI初期化（プレビュー連動機能統合完全版）
     */
    async init() {
        try {
            console.log('🎯 PenToolUI初期化開始（STEP 3完成版: プレビュー連動機能統合）...');
            
            // 外部システムの取得・初期化
            if (!this.initializeExternalSystems()) {
                throw new Error('必須システム初期化失敗（SliderController/PreviewManager不足）');
            }
            
            // STEP 2機能: スライダー制御初期化
            this.initSliders();
            
            // STEP 3新規: プレビュー連動システム初期化
            this.initPreviewSystem();
            
            // STEP 3新規: ポップアップ制御初期化
            this.initPopupControl();
            
            // STEP 3新規: キーボードショートカット初期化
            this.initKeyboardShortcuts();
            
            // STEP 3新規: UI同期システム初期化
            this.initSyncSystem();
            
            this.isInitialized = true;
            console.log('✅ PenToolUI初期化完了（STEP 3完成版: プレビュー連動機能統合）');
            
            return true;
            
        } catch (error) {
            console.error('❌ PenToolUI初期化エラー:', error);
            this.handleError(error);
            throw error;
        }
    }
    
    /**
     * STEP 2機能: スライダー制御初期化（ui-manager.jsから完全移譲）
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
            
            // ペンサイズスライダー（STEP 3: プレビュー連動対応）
            this.createSlider('pen-size-slider', minSize, maxSize, defaultSize, 
                (value, displayOnly = false) => {
                    if (!displayOnly) {
                        this.drawingToolsSystem.updateBrushSettings({ size: value });
                        // STEP 3新規: プレビュー連動
                        this.updatePresetLiveValues(value, null);
                        this.updateActivePresetPreview(value, null);
                        console.log(`🎛️ ペンサイズ変更: ${value.toFixed(1)}px`);
                    }
                    return value.toFixed(1) + 'px';
                });
            
            // 不透明度スライダー（STEP 3: プレビュー連動対応）
            this.createSlider('pen-opacity-slider', 0, 100, defaultOpacity * 100, 
                (value, displayOnly = false) => {
                    if (!displayOnly) {
                        this.drawingToolsSystem.updateBrushSettings({ opacity: value / 100 });
                        // STEP 3新規: プレビュー連動
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
            
            console.log('✅ PenToolUI: スライダー設定完了（STEP 3プレビュー連動対応版）');
            
        } catch (error) {
            console.error('スライダー設定エラー:', error);
            this.handleError(error);
        }
    }
    
    /**
     * STEP 3新規: プレビュー連動システム初期化（ui-manager.jsから完全移譲）
     */
    initPreviewSystem() {
        try {
            console.log('🔄 プレビュー連動システム初期化（STEP 3新規）...');
            
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
     * STEP 3新規: ポップアップ制御初期化（将来の拡張用）
     */
    initPopupControl() {
        try {
            console.log('📋 ポップアップ制御初期化（STEP 3拡張用）...');
            
            if (!this.popupManager) {
                console.log('📋 PopupManager未実装 → 基本機能のみで続行');
                return;
            }
            
            // 将来のポップアップ機能拡張用のプレースホルダー
            console.log('✅ ポップアップ制御初期化完了（将来の拡張用）');
            
        } catch (error) {
            console.error('ポップアップ制御初期化エラー:', error);
            this.handleError(error);
        }
    }
    
    /**
     * STEP 3新規: キーボードショートカット初期化（ui-manager.jsから移譲）
     */
    initKeyboardShortcuts() {
        try {
            console.log('⌨️ キーボードショートカット初期化（STEP 3移譲版）...');
            
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
     * STEP 3新規: UI同期システム初期化
     */
    initSyncSystem() {
        try {
            console.log('🔄 UI同期システム初期化（STEP 3新規）...');
            
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
     * STEP 2機能: スライダー作成（ui-manager.jsから移譲）
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
     * STEP 2機能: スライダーボタン設定（ui-manager.jsから移譲・拡張）
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
     * STEP 3新規: プリセット連動値更新（ui-manager.jsから完全移譲）
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
     * STEP 3新規: アクティブプリセットプレビュー更新（ui-manager.jsから完全移譲）
     */
    updateActivePresetPreview(size, opacity) {
        if (!this.previewSyncEnabled) return;
        
        try {
            // PresetDisplayManager経由での更新
            if (this.presetDisplayManager && this.presetDisplayManager.updateActivePreview) {
                const updateData = {};
                if (size !== null && size !== undefined) updateData.size = size;
                if (opacity !== null && opacity !== undefined) updateData.opacity = opacity;
                
                this.presetDisplayManager.updateActivePreview(updateData);
                console.log(`🎨 アクティブプリセットプレビュー更新:`, updateData);
            }
            
            // PenPresetManager経由での更新（フォールバック）
            if (this.penPresetManager && this.penPresetManager.updateActivePresetPreview) {
                this.penPresetManager.updateActivePresetPreview(size, opacity);
            }
            
        } catch (error) {
            console.error('アクティブプリセットプレビュー更新エラー:', error);
            this.handleError(error);
        }
    }
    
    /**
     * STEP 3新規: プレビューとの同期（現在設定との同期）
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
     * STEP 3新規: アクティブプリセットリセット（ui-manager.jsから移譲）
     */
    resetActivePreset() {
        try {
            if (this.penPresetManager && this.penPresetManager.resetActivePreset) {
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
     * STEP 3新規: 全プリセットプレビューリセット（ui-manager.jsから移譲）
     */
    resetAllPreviews() {
        try {
            let resetCount = 0;
            
            // PresetDisplayManager経由でのリセット
            if (this.presetDisplayManager && this.presetDisplayManager.resetAllPreviews) {
                this.presetDisplayManager.resetAllPreviews();
                resetCount++;
            }
            
            // PenPresetManager経由でのリセット（フォールバック）
            if (this.penPresetManager && this.penPresetManager.resetAllPreviews) {
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
     * STEP 3新規: プリセット選択（ui-manager.jsから移譲・拡張）
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
     * STEP 3新規: プリセットからスライダー更新
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
     * STEP 2機能: スライダー値更新（ui-manager.jsから移譲）
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
     * STEP 2機能: 全スライダー値取得（ui-manager.jsから移譲）
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
     * STEP 3拡張: ブラシ設定変更通知（DrawingToolsSystemから呼び出し・プレビュー連動対応）
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
            
            // STEP 3新規: プレビュー連動機能
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
     * STEP 3新規: プレビュー同期有効/無効切り替え
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
     * STEP 2機能: エラーハンドリング（DRY原則準拠）
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
     * STEP 3拡張: デバッグ機能（プレビュー連動機能統合版）
     */
    debugPenUI() {
        console.group('🔍 PenToolUI デバッグ情報（STEP 3完成版）');
        
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
     * STEP 3拡張: 統計取得（プレビュー連動機能統合版）
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
            step2Completed: true,
            step3Completed: true
        };
    }
    
    /**
     * STEP 3拡張: クリーンアップ（プレビュー連動対応版）
     */
    destroy() {
        try {
            console.log('🧹 PenToolUI クリーンアップ開始（STEP 3版）');
            
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
            
            // 同期状態のクリア
            this.syncInProgress = false;
            this.pendingSyncUpdates.clear();
            
            // 参照のクリア
            this.sliderController = null;
            this.penPresetManager = null;
            this.presetDisplayManager = null;
            this.popupManager = null;
            
            this.isInitialized = false;
            console.log('✅ PenToolUI クリーンアップ完了（STEP 3版）');
            
        } catch (error) {
            console.error('PenToolUI クリーンアップエラー:', error);
        }
    }
}

// ==== DrawingToolsSystem（STEP 3完成版：PenToolUI統合＋main.js対応）====
class DrawingToolsSystem {
    constructor(app) {
        this.app = app;
        this.toolManager = null;
        this.historyManager = null;
        
        // STEP 3完成: ペンツール専用UI制御システム
        this.penToolUI = null;
        
        // ブラシ設定状態（main.js互換性対応）
        this.brushSettings = {
            size: safeConfigGet('DEFAULT_BRUSH_SIZE', 4),
            opacity: safeConfigGet('DEFAULT_OPACITY', 1.0),
            color: safeConfigGet('DEFAULT_COLOR', 0x800000),
            pressure: safeConfigGet('DEFAULT_PRESSURE', 0.5),
            smoothing: safeConfigGet('DEFAULT_SMOOTHING', 0.3)
        };
        
        console.log('🎯 DrawingToolsSystem初期化（STEP 3完成版：PenToolUI統合＋main.js対応）');
    }
    
    async init() {
        try {
            console.log('🎯 DrawingToolsSystem初期化開始（STEP 3完成版）...');
            
            // 基本システムの初期化
            this.toolManager = new ToolManager(this.app, this.historyManager);
            
            // デフォルトツールの設定
            this.toolManager.setActiveTool('pen');
            
            console.log('✅ DrawingToolsSystem初期化完了（STEP 3完成版）');
            
        } catch (error) {
            console.error('❌ DrawingToolsSystem初期化エラー:', error);
            throw error;
        }
    }
    
    /**
     * STEP 3完成: ペンツール専用UI初期化（main.js統合対応版）
     */
    async initUI() {
        try {
            console.log('🎨 ペンツールUI初期化開始（STEP 3完成版）...');
            
            if (!this.penToolUI) {
                this.penToolUI = new PenToolUI(this);
            }
            
            const success = await this.penToolUI.init();
            
            if (success) {
                console.log('✅ ペンツールUI初期化完了（STEP 3完成版）');
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
     * STEP 3完成: PenToolUI取得（main.js互換性対応）
     */
    getPenUI() {
        return this.penToolUI;
    }
    
    /**
     * main.js互換性: getPenPresetManager API
     */
    getPenPresetManager() {
        if (this.penToolUI && this.penToolUI.penPresetManager) {
            return this.penToolUI.penPresetManager;
        }
        
        // フォールバック: グローバル参照
        if (window.penPresetManager) {
            return window.penPresetManager;
        }
        
        console.warn('PenPresetManagerが見つかりません');
        return null;
    }
    
    /**
     * STEP 3完成: ブラシ設定更新（UI通知機能付き・main.js互換性対応）
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
                        value = validateBrushSize(value);
                        break;
                    case 'opacity':
                    case 'pressure':
                    case 'smoothing':
                        value = validateOpacity(value);
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
        
        // アプリケーション状態の更新（main.js互換性対応）
        if (updated) {
            const appStateUpdates = {};
            
            // main.jsが期待する状態プロパティ名に変換
            if ('size' in newSettings) appStateUpdates.brushSize = this.brushSettings.size;
            if ('opacity' in newSettings) appStateUpdates.opacity = this.brushSettings.opacity;
            if ('color' in newSettings) appStateUpdates.brushColor = this.brushSettings.color;
            if ('pressure' in newSettings) appStateUpdates.pressure = this.brushSettings.pressure;
            if ('smoothing' in newSettings) appStateUpdates.smoothing = this.brushSettings.smoothing;
            
            this.app.updateState(appStateUpdates);
            
            // STEP 3完成: PenToolUIに変更を通知
            if (this.penToolUI && this.penToolUI.onBrushSettingsChanged) {
                this.penToolUI.onBrushSettingsChanged(newSettings);
            }
            
            console.log('🔄 ブラシ設定更新（UI通知付き・main.js互換性対応）:', newSettings);
        }
        
        return updated;
    }
    
    /**
     * main.js互換性: getBrushSettings
     */
    getBrushSettings() {
        return { ...this.brushSettings };
    }
    
    /**
     * 履歴管理システム設定（main.js互換性対応）
     */
    setHistoryManager(historyManager) {
        this.historyManager = historyManager;
        
        if (this.toolManager) {
            this.toolManager.setHistoryManager(historyManager);
        }
        
        console.log('📚 DrawingToolsSystem: 履歴管理システム設定完了');
    }
    
    /**
     * 履歴管理システム取得（main.js互換性対応）
     */
    getHistoryManager() {
        return this.historyManager;
    }
    
    // ==== main.js互換性: 公開API ====
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
    
    // ==== main.js互換性: 履歴管理API ====
    undo() {
        return this.historyManager ? this.historyManager.undo() : false;
    }
    
    redo() {
        return this.historyManager ? this.historyManager.redo() : false;
    }
    
    canUndo() {
        return this.historyManager ? this.historyManager.canUndo() : false;
    }
    
    canRedo() {
        return this.historyManager ? this.historyManager.canRedo() : false;
    }
    
    /**
     * main.js互換性: システム統計取得
     */
    getSystemStats() {
        const historyStats = this.historyManager ? this.historyManager.getStats() : null;
        
        return {
            initialized: true,
            currentTool: this.getCurrentTool(),
            availableTools: this.getAvailableTools(),
            brushSettings: {
                ...this.brushSettings,
                sizeRange: {
                    min: safeConfigGet('MIN_BRUSH_SIZE', 0.1),
                    max: safeConfigGet('MAX_BRUSH_SIZE', 500),
                    default: safeConfigGet('DEFAULT_BRUSH_SIZE', 4),
                    current: this.brushSettings.size
                },
                opacityRange: {
                    min: 0,
                    max: 1,
                    default: safeConfigGet('DEFAULT_OPACITY', 1.0),
                    current: this.brushSettings.opacity
                }
            },
            history: historyStats ? {
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
                totalRecorded: historyStats.totalRecorded || 0,
                currentIndex: historyStats.currentIndex || -1,
                memoryUsageMB: historyStats.memoryUsageMB || 0
            } : null,
            penToolUI: this.penToolUI ? this.penToolUI.getStats() : null
        };
    }
    
    /**
     * STEP 3完成: デバッグ機能（統合版）
     */
    debugDrawingTools() {
        console.group('🔍 DrawingToolsSystem デバッグ情報（STEP 3完成版）');
        
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
        
        // STEP 3完成: PenToolUIデバッグ情報
        if (this.penToolUI) {
            console.log('PenToolUI統合状況:', this.penToolUI.getStats());
        }
        
        if (this.historyManager) {
            console.log('履歴統計:', this.historyManager.getStats());
        }
        
        console.groupEnd();
    }
    
    /**
     * STEP 3完成: クリーンアップ（UI統合対応）
     */
    destroy() {
        try {
            console.log('🧹 DrawingToolsSystem クリーンアップ開始（STEP 3完成版）');
            
            // STEP 3完成: PenToolUIクリーンアップ
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
            
            console.log('✅ DrawingToolsSystem クリーンアップ完了（STEP 3完成版）');
            
        } catch (error) {
            console.error('DrawingToolsSystem クリーンアップエラー:', error);
        }
    }
}

// ==== StateCapture・StateRestore の外部参照エイリアス（main.js互換性対応）====
const StateCapture = {
    captureDrawingState: (app) => {
        if (typeof window !== 'undefined' && window.InternalStateCapture) {
            return window.InternalStateCapture.captureDrawingState(app);
        }
        console.warn('InternalStateCapture が利用できません');
        return null;
    },
    capturePresetState: (presetManager) => {
        if (typeof window !== 'undefined' && window.InternalStateCapture) {
            return window.InternalStateCapture.capturePresetState(presetManager);
        }
        console.warn('InternalStateCapture が利用できません');
        return null;
    },
    captureBrushSettings: (toolsSystem) => {
        if (typeof window !== 'undefined' && window.InternalStateCapture) {
            return window.InternalStateCapture.captureBrushSettings(toolsSystem);
        }
        console.warn('InternalStateCapture が利用できません');
        return null;
    },
    captureCanvasSettings: (app) => {
        if (typeof window !== 'undefined' && window.InternalStateCapture) {
            return window.InternalStateCapture.captureCanvasSettings(app);
        }
        console.warn('InternalStateCapture が利用できません');
        return null;
    }
};

const StateRestore = {
    restoreDrawingState: (app, state) => {
        if (typeof window !== 'undefined' && window.InternalStateRestore) {
            return window.InternalStateRestore.restoreDrawingState(app, state);
        }
        console.warn('InternalStateRestore が利用できません');
        return false;
    },
    restorePresetState: (presetManager, uiManager, state) => {
        if (typeof window !== 'undefined' && window.InternalStateRestore) {
            return window.InternalStateRestore.restorePresetState(presetManager, uiManager, state);
        }
        console.warn('InternalStateRestore が利用できません');
        return false;
    },
    restoreBrushSettings: (toolsSystem, uiManager, state) => {
        if (typeof window !== 'undefined' && window.InternalStateRestore) {
            return window.InternalStateRestore.restoreBrushSettings(toolsSystem, uiManager, state);
        }
        console.warn('InternalStateRestore が利用できません');
        return false;
    },
    restoreCanvasSettings: (app, uiManager, state) => {
        if (typeof window !== 'undefined' && window.InternalStateRestore) {
            return window.InternalStateRestore.restoreCanvasSettings(app, uiManager, state);
        }
        console.warn('InternalStateRestore が利用できません');
        return false;
    }
};

// ==== グローバル登録・エクスポート（STEP 3完成版）====
if (typeof window !== 'undefined') {
    // 基本クラスのエクスポート
    window.BaseTool = BaseTool;
    window.VectorPenTool = VectorPenTool;
    window.EraserTool = EraserTool;
    window.ToolManager = ToolManager;
    
    // STEP 3完成: ペンツール専用UI
    window.PenToolUI = PenToolUI;
    
    // メインシステム
    window.DrawingToolsSystem = DrawingToolsSystem;
    
    // main.js互換性: StateCapture/StateRestore
    window.StateCapture = StateCapture;
    window.StateRestore = StateRestore;
    
    // STEP 3完成: デバッグ関数
    window.debugPenToolUI = function() {
        if (window.toolsSystem && window.toolsSystem.penToolUI) {
            window.toolsSystem.penToolUI.debugPenUI();
        } else {
            console.warn('PenToolUI が利用できません');
        }
    };
    
    window.debugDrawingToolsSystem = function() {
        if (window.toolsSystem) {
            window.toolsSystem.debugDrawingTools();
        } else {
            console.warn('DrawingToolsSystem が利用できません');
        }
    };
    
    // STEP 3新規: プレビュー制御デバッグ関数
    window.debugPreviewSync = function() {
        if (window.toolsSystem && window.toolsSystem.penToolUI) {
            const penUI = window.toolsSystem.penToolUI;
            console.group('🔍 プレビュー連動デバッグ（STEP 3完成版）');
            
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
    
    window.togglePreviewSync = function() {
        if (window.toolsSystem && window.toolsSystem.penToolUI) {
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
    
    // STEP 3完成: main.js互換性確認関数
    window.testMainJsCompatibility = function() {
        console.group('🧪 main.js互換性テスト（STEP 3完成版）');
        
        try {
            const toolsSystem = window.toolsSystem;
            
            if (!toolsSystem) {
                console.error('❌ toolsSystem が存在しません');
                console.groupEnd();
                return false;
            }
            
            // main.jsが期待するAPIの存在確認
            const expectedAPIs = [
                'updateBrushSettings',
                'getBrushSettings',
                'getCurrentTool',
                'setTool',
                'getAvailableTools',
                'setHistoryManager',
                'getHistoryManager',
                'getPenPresetManager',
                'initUI',
                'getPenUI',
                'undo',
                'redo',
                'canUndo',
                'canRedo',
                'getSystemStats'
            ];
            
            const missingAPIs = expectedAPIs.filter(api => typeof toolsSystem[api] !== 'function');
            
            if (missingAPIs.length === 0) {
                console.log('✅ 全必須API確認完了');
                
                // APIテスト実行
                console.log('🧪 APIテスト実行中...');
                
                const stats = toolsSystem.getSystemStats();
                console.log('📊 システム統計:', stats);
                
                const brushSettings = toolsSystem.getBrushSettings();
                console.log('🎨 ブラシ設定:', brushSettings);
                
                const currentTool = toolsSystem.getCurrentTool();
                console.log('🔧 現在のツール:', currentTool);
                
                const availableTools = toolsSystem.getAvailableTools();
                console.log('🛠️ 利用可能ツール:', availableTools);
                
                const penUI = toolsSystem.getPenUI();
                console.log('🎭 PenToolUI:', penUI ? '統合済み' : '未統合');
                
                const historyManager = toolsSystem.getHistoryManager();
                console.log('📚 履歴管理:', historyManager ? '統合済み' : '未統合');
                
                console.log('✅ main.js互換性テスト成功');
                console.groupEnd();
                return true;
                
            } else {
                console.error('❌ 不足API:', missingAPIs);
                console.groupEnd();
                return false;
            }
            
        } catch (error) {
            console.error('❌ 互換性テストエラー:', error);
            console.groupEnd();
            return false;
        }
    };
    
    console.log('✅ drawing-tools.js STEP 3完成版 読み込み完了');
    console.log('📦 エクスポートクラス（STEP 3完成版）:');
    console.log('  ✅ BaseTool, VectorPenTool, EraserTool: 描画ツール基盤');
    console.log('  ✅ ToolManager: ツール管理システム（履歴対応版）');
    console.log('  ✅ PenToolUI: ペンツール専用UI制御（プレビュー連動完全版）');
    console.log('  ✅ DrawingToolsSystem: 統合描画システム（main.js完全対応版）');
    console.log('  ✅ StateCapture, StateRestore: 外部参照エイリアス（main.js互換性対応）');
    console.log('🔧 STEP 3実装完了:');
    console.log('  ✅ ui-manager.jsからプレビュー連動機能完全移譲');
    console.log('  ✅ PenPresetManager, PresetDisplayManager完全連携');
    console.log('  ✅ リアルタイムプレビュー更新・スロットリング制御');
    console.log('  ✅ UI同期システム・無限ループ回避機能');
    console.log('  ✅ main.js統合修正・toolsSystem API完全対応');
    console.log('  ✅ EVENTS定数重複解決・安全な定数参照方式');
    console.log('  ✅ エラーハンドリング強化・DRY原則完全準拠');
    console.log('🎯 責務: 描画ツール管理 + ペンツール専用UI制御（完全版）');
    console.log('🐛 デバッグ関数（STEP 3完成版）:');
    console.log('  - window.debugPenToolUI() - PenToolUI状態表示（プレビュー連動対応）');
    console.log('  - window.debugDrawingToolsSystem() - システム全体状態表示');
    console.log('  - window.debugPreviewSync() - プレビュー連動機能デバッグ');
    console.log('  - window.togglePreviewSync() - プレビュー同期有効/無効切り替え');
    console.log('  - window.testMainJsCompatibility() - main.js互換性テスト');
    console.log('📋 STEP 3完成効果:');
    console.log('  🎨 ui-manager.jsからペンUI機能の完全分離・独立性確保');
    console.log('  🔄 プレビュー連動機能のリアルタイム対応・パフォーマンス最適化');
    console.log('  🛠️ main.js統合問題の完全解決・API互換性確保');
    console.log('  🔧 DRY・SOLID原則の完全準拠・保守性向上');
    console.log('  ⚡ エラーハンドリング強化・安定性向上');
}

console.log('🏆 drawing-tools.js STEP 3完成版 初期化完了');