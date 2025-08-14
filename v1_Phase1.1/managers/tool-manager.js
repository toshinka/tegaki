/**
 * 🛠️ ToolManager - ツール系統括制御
 * 責務:
 * - ツール切替管理
 * - 描画イベント処理
 * - ブラシ設定管理
 * - ショートカット処理
 * 
 * 🎯 AI_WORK_SCOPE: ツール系統括制御専用ファイル
 * 🎯 DEPENDENCIES: app-core.js, drawing-tools.js
 * 📋 SPLIT_PLAN: Phase2でtools/*.js分割予定
 * - PenTool → tools/pen-tool.js  
 * - EraserTool → tools/eraser-tool.js
 * 📋 V8_MIGRATION: Phase4でPixiJS v8対応予定
 * - Graphics.lineStyle → Graphics.stroke対応
 */

class ToolManager {
    constructor(appCore) {
        this.appCore = appCore;
        this.extensions = appCore.extensions;
        this.currentTool = 'pen';
        this.brushSize = 16;
        this.brushOpacity = 0.85;
        this.brushColor = 0x800000; // ふたば色
        this.pressure = 0.5;
        this.smoothing = 0.3;
        this.tools = new Map();
        this.isInitialized = false;
        this.isDrawing = false;
        this.currentPath = null;
        this.lastPoint = null;
        
        // 描画設定
        this.settings = {
            pen: {
                size: 16,
                opacity: 0.85,
                pressure: 0.5,
                smoothing: 0.3,
                color: 0x800000,
                pressureSensitivity: true,
                edgeSmoothing: false,
                gpuAcceleration: true
            },
            eraser: {
                size: 20,
                opacity: 1.0,
                pressure: 0.0,
                smoothing: 0.1
            }
        };

        // プリセット管理（drawing-tools.jsから移植）
        this.presets = new Map();
        this.activePresetId = null;
        this.currentLiveValues = null;
        
        // 描画履歴管理への参照
        this.historyManager = null;
    }
    
    async init() {
        console.log('🛠️ ToolManager 初期化開始...');
        
        try {
            await this.setupTools();
            await this.setupPresets();
            await this.setupShortcuts();
            await this.setupEventHandlers();
            
            // 履歴管理統合（drawing-tools.jsパターン）
            if (this.appCore.getManager('memory')) {
                this.historyManager = this.appCore.getManager('memory').historyManager;
            }
            
            this.isInitialized = true;
            console.log('✅ ToolManager 初期化完了');
        } catch (error) {
            console.error('❌ ToolManager初期化エラー:', error);
            throw error;
        }
    }
    
    async setupTools() {
        // ペンツール設定
        this.tools.set('pen', {
            name: 'pen',
            cursor: 'crosshair',
            color: 0x800000,
            onStart: (event) => this.handlePenStart(event),
            onMove: (event) => this.handlePenMove(event),
            onEnd: (event) => this.handlePenEnd(event),
            onActivate: () => this.activatePen(),
            onDeactivate: () => this.deactivatePen()
        });
        
        // 消しゴムツール設定
        this.tools.set('eraser', {
            name: 'eraser',
            cursor: 'crosshair',
            color: 0xFFFFFF,
            onStart: (event) => this.handleEraserStart(event),
            onMove: (event) => this.handleEraserMove(event),
            onEnd: (event) => this.handleEraserEnd(event),
            onActivate: () => this.activateEraser(),
            onDeactivate: () => this.deactivateEraser()
        });
        
        console.log('🔧 ツール設定完了（pen, eraser）');
    }

    async setupPresets() {
        // デフォルトプリセット（drawing-tools.jsパターン）
        const defaultPresets = [
            { id: 'preset-1', size: 1, opacity: 0.85, color: 0x800000, label: '1' },
            { id: 'preset-2', size: 2, opacity: 0.85, color: 0x800000, label: '2' },
            { id: 'preset-4', size: 4, opacity: 0.85, color: 0x800000, label: '4' },
            { id: 'preset-8', size: 8, opacity: 0.85, color: 0x800000, label: '8' },
            { id: 'preset-16', size: 16, opacity: 0.85, color: 0x800000, label: '16' },
            { id: 'preset-32', size: 32, opacity: 0.85, color: 0x800000, label: '32' }
        ];
        
        defaultPresets.forEach(preset => {
            this.presets.set(preset.id, preset);
        });
        
        this.activePresetId = 'preset-16';
        console.log('🎨 プリセット設定完了（6サイズ）');
    }
    
    async setupShortcuts() {
        document.addEventListener('keydown', (e) => {
            switch(e.key.toLowerCase()) {
                case 'p':
                    this.setTool('pen');
                    break;
                case 'e':
                    this.setTool('eraser');
                    break;
                case 'b':
                    this.setTool('pen'); // ブラシとペンは同じ
                    break;
                case '[':
                    this.adjustBrushSize(-1);
                    break;
                case ']':
                    this.adjustBrushSize(1);
                    break;
                case '{':
                    this.adjustBrushSize(-5);
                    break;
                case '}':
                    this.adjustBrushSize(5);
                    break;
            }
        });
        
        console.log('⌨️ ショートカット設定完了（P:ペン、E:消しゴム、[]:サイズ調整）');
    }
    
    async setupEventHandlers() {
        // キャンバス取得
        const canvasContainer = this.appCore.getManager('canvas')?.getDrawingContainer() 
                              || this.appCore.stage;
        
        if (!canvasContainer) {
            console.warn('⚠️ 描画コンテナが見つかりません');
            return;
        }
        
        // 描画イベントリスナー設定
        canvasContainer.interactive = true;
        
        canvasContainer.on('pointerdown', (event) => this.onPointerDown(event));
        canvasContainer.on('pointermove', (event) => this.onPointerMove(event));
        canvasContainer.on('pointerup', (event) => this.onPointerUp(event));
        canvasContainer.on('pointerupoutside', (event) => this.onPointerUp(event));
        
        console.log('📍 描画イベントハンドラー設定完了');
    }
    
    // ==== ツール切替API ====
    setTool(toolName) {
        if (!this.tools.has(toolName)) {
            console.warn(`⚠️ 未知のツール: ${toolName}`);
            return false;
        }
        
        // 現在のツールを非アクティブ化
        const currentTool = this.tools.get(this.currentTool);
        if (currentTool && currentTool.onDeactivate) {
            currentTool.onDeactivate();
        }
        
        // 新しいツールをアクティブ化
        this.currentTool = toolName;
        const newTool = this.tools.get(toolName);
        if (newTool.onActivate) {
            newTool.onActivate();
        }
        
        // カーソル変更
        if (this.appCore.app.view) {
            this.appCore.app.view.style.cursor = newTool.cursor || 'crosshair';
        }
        
        // UI通知
        this.notifyToolChange(toolName);
        
        console.log(`🔄 ツール変更: ${toolName}`);
        return true;
    }
    
    getCurrentTool() {
        return this.currentTool;
    }
    
    getAvailableTools() {
        return Array.from(this.tools.keys());
    }
    
    // ==== ブラシ設定API ====
    setBrushSize(size) {
        this.brushSize = Math.max(0.1, Math.min(100, size));
        this.updateToolSettings();
        console.log(`🖌️ ブラシサイズ: ${this.brushSize}px`);
    }
    
    setBrushOpacity(opacity) {
        this.brushOpacity = Math.max(0, Math.min(1, opacity));
        this.updateToolSettings();
        console.log(`🌫️ ブラシ不透明度: ${Math.round(this.brushOpacity * 100)}%`);
    }
    
    setBrushColor(color) {
        this.brushColor = color;
        this.updateToolSettings();
        console.log(`🎨 ブラシ色: #${color.toString(16).padStart(6, '0')}`);
    }
    
    adjustBrushSize(delta) {
        const newSize = this.brushSize + delta;
        this.setBrushSize(newSize);
        
        // UI更新通知
        this.notifyBrushChange();
    }
    
    updateToolSettings() {
        const currentSettings = this.settings[this.currentTool];
        if (currentSettings) {
            currentSettings.size = this.brushSize;
            currentSettings.opacity = this.brushOpacity;
            currentSettings.color = this.brushColor;
        }
    }
    
    getBrushSettings() {
        return {
            size: this.brushSize,
            opacity: this.brushOpacity,
            color: this.brushColor,
            pressure: this.pressure,
            smoothing: this.smoothing
        };
    }
    
    // ==== プリセット管理API ====
    selectPreset(presetId) {
        if (!this.presets.has(presetId)) {
            console.warn(`⚠️ 未知のプリセット: ${presetId}`);
            return false;
        }
        
        // 履歴記録（変更前状態）
        this.capturePresetChange('before');
        
        const preset = this.presets.get(presetId);
        this.activePresetId = presetId;
        this.currentLiveValues = null;
        
        // ブラシ設定を更新
        this.setBrushSize(preset.size);
        this.setBrushOpacity(preset.opacity);
        this.setBrushColor(preset.color);
        
        // 履歴記録（変更後状態）
        this.capturePresetChange('after');
        
        console.log(`🎯 プリセット選択: ${presetId} (${preset.size}px)`);
        return preset;
    }
    
    updateActivePresetLive(size, opacity, color = null) {
        if (!this.activePresetId) return;
        
        const activePreset = this.presets.get(this.activePresetId);
        if (!activePreset) return;
        
        this.currentLiveValues = {
            size: size,
            opacity: opacity,
            color: color || activePreset.color
        };
        
        console.log(`🎨 ライブプレビュー更新: ${size}px, ${Math.round(opacity * 100)}%`);
    }
    
    getPresetIdBySize(size) {
        for (const [presetId, preset] of this.presets) {
            if (Math.abs(preset.size - size) < 0.1) {
                return presetId;
            }
        }
        return null;
    }
    
    generatePreviewData() {
        const previewData = [];
        
        this.presets.forEach((preset, presetId) => {
            const isActive = presetId === this.activePresetId;
            
            let displayValues = preset;
            if (isActive && this.currentLiveValues) {
                displayValues = {
                    ...preset,
                    size: this.currentLiveValues.size,
                    opacity: this.currentLiveValues.opacity,
                    color: this.currentLiveValues.color
                };
            }
            
            const displaySize = Math.min(20, Math.max(0.5, displayValues.size));
            
            previewData.push({
                id: presetId,
                dataSize: preset.size,
                size: displaySize,
                opacity: displayValues.opacity,
                color: this.colorToHex(displayValues.color),
                label: displayValues.size.toFixed(1),
                opacityLabel: Math.round(displayValues.opacity * 100) + '%',
                isActive: isActive
            });
        });
        
        return previewData;
    }
    
    // ==== 描画処理 ====
    onPointerDown(event) {
        const tool = this.tools.get(this.currentTool);
        if (!tool) return;
        
        const point = this.getLocalPosition(event);
        this.isDrawing = true;
        
        // 履歴管理：描画開始状態キャプチャ
        this.captureDrawingState('start');
        
        tool.onStart({
            ...event,
            localPoint: point,
            pressure: this.calculatePressure(event)
        });
    }
    
    onPointerMove(event) {
        const tool = this.tools.get(this.currentTool);
        if (!tool || !this.isDrawing) return;
        
        const point = this.getLocalPosition(event);
        tool.onMove({
            ...event,
            localPoint: point,
            pressure: this.calculatePressure(event)
        });
        
        // 座標情報をUIに通知
        this.notifyCoordinateUpdate(point.x, point.y);
    }
    
    onPointerUp(event) {
        const tool = this.tools.get(this.currentTool);
        if (!tool) return;
        
        if (this.isDrawing) {
            const point = this.getLocalPosition(event);
            tool.onEnd({
                ...event,
                localPoint: point,
                pressure: this.calculatePressure(event)
            });
            
            // 履歴管理：描画終了状態記録
            this.captureDrawingState('end');
        }
        
        this.isDrawing = false;
        this.currentPath = null;
        this.lastPoint = null;
    }
    
    // ==== ペンツール実装 ====
    activatePen() {
        console.log('🖊️ ペンツール アクティブ');
        this.currentTool = 'pen';
        this.appCore.app.view.style.cursor = 'crosshair';
    }
    
    deactivatePen() {
        this.finalizePath();
    }
    
    handlePenStart(event) {
        const point = event.localPoint;
        this.currentPath = this.createGraphicsPath(point, this.brushColor);
        this.lastPoint = point;
        
        console.log(`🖊️ ペン描画開始: (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
    }
    
    handlePenMove(event) {
        if (!this.currentPath || !this.lastPoint) return;
        
        const point = event.localPoint;
        
        // スムージング適用
        const smoothedPoint = this.applySmoothing(point, this.lastPoint);
        
        // 線を描画
        this.extendPath(this.currentPath, smoothedPoint);
        this.lastPoint = smoothedPoint;
    }
    
    handlePenEnd(event) {
        if (this.currentPath) {
            this.finalizePath();
            console.log('🖊️ ペン描画終了');
        }
    }
    
    // ==== 消しゴムツール実装 ====
    activateEraser() {
        console.log('🧽 消しゴムツール アクティブ');
        this.currentTool = 'eraser';
        this.appCore.app.view.style.cursor = 'crosshair';
    }
    
    deactivateEraser() {
        this.finalizePath();
    }
    
    handleEraserStart(event) {
        const point = event.localPoint;
        // 背景色で描画（消しゴム効果）
        this.currentPath = this.createGraphicsPath(point, 0xFFFFFF);
        this.lastPoint = point;
        
        console.log(`🧽 消しゴム開始: (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
    }
    
    handleEraserMove(event) {
        if (!this.currentPath || !this.lastPoint) return;
        
        const point = event.localPoint;
        this.extendPath(this.currentPath, point);
        this.lastPoint = point;
    }
    
    handleEraserEnd(event) {
        if (this.currentPath) {
            this.finalizePath();
            console.log('🧽 消しゴム終了');
        }
    }
    
    // ==== 描画ヘルパーメソッド ====
    getLocalPosition(event) {
        const canvasManager = this.appCore.getManager('canvas');
        if (canvasManager && canvasManager.viewport) {
            return canvasManager.viewport.toLocal(event.data.global);
        }
        return event.data.getLocalPosition(this.appCore.stage);
    }
    
    createGraphicsPath(startPoint, color) {
        const graphics = new PIXI.Graphics();
        
        // 📋 V8_MIGRATION: Phase4でlineStyle→stroke変更予定
        graphics.lineStyle(
            this.brushSize, 
            color, 
            this.brushOpacity,
            0.5, // alignment
            true // native
        );
        
        graphics.moveTo(startPoint.x, startPoint.y);
        
        // 描画レイヤーに追加
        const canvasContainer = this.appCore.getManager('canvas')?.getDrawingContainer() 
                              || this.appCore.stage;
        canvasContainer.addChild(graphics);
        
        return graphics;
    }
    
    extendPath(graphics, point) {
        if (!graphics || !point) return;
        
        graphics.lineTo(point.x, point.y);
    }
    
    finalizePath() {
        if (this.currentPath) {
            // パスの最終処理
            console.log('📝 パス確定');
        }
        this.currentPath = null;
        this.lastPoint = null;
    }
    
    applySmoothing(currentPoint, lastPoint) {
        if (this.smoothing === 0) return currentPoint;
        
        const smoothed = {
            x: lastPoint.x + (currentPoint.x - lastPoint.x) * (1 - this.smoothing),
            y: lastPoint.y + (currentPoint.y - lastPoint.y) * (1 - this.smoothing)
        };
        
        return smoothed;
    }
    
    calculatePressure(event) {
        // 基本的な筆圧計算（将来Hammer.js等で拡張予定）
        if (event.pressure !== undefined) {
            return event.pressure;
        }
        
        // フォールバック: 設定値使用
        return this.pressure;
    }
    
    // ==== 履歴管理統合 ====
    captureDrawingState(phase) {
        if (!this.historyManager) return;
        
        try {
            if (phase === 'start') {
                // 描画開始前の状態をキャプチャ
                this.historyManager.captureState('drawing_start', {
                    tool: this.currentTool,
                    settings: this.getBrushSettings(),
                    timestamp: Date.now()
                });
            } else if (phase === 'end') {
                // 描画完了状態を記録
                this.historyManager.recordOperation('drawing', {
                    tool: this.currentTool,
                    settings: this.getBrushSettings(),
                    timestamp: Date.now()
                });
            }
        } catch (error) {
            console.warn('⚠️ 履歴記録エラー:', error);
        }
    }
    
    capturePresetChange(phase) {
        if (!this.historyManager) return;
        
        try {
            const state = {
                activePresetId: this.activePresetId,
                currentLiveValues: this.currentLiveValues ? {...this.currentLiveValues} : null,
                brushSettings: this.getBrushSettings(),
                timestamp: Date.now()
            };
            
            if (phase === 'before') {
                this.historyManager.captureState('preset_change_before', state);
            } else if (phase === 'after') {
                this.historyManager.recordOperation('preset_change', state);
            }
        } catch (error) {
            console.warn('⚠️ プリセット履歴記録エラー:', error);
        }
    }
    
    // ==== 通知システム ====
    notifyToolChange(toolName) {
        // UIManager通知
        const uiManager = this.appCore.getManager('ui');
        if (uiManager && uiManager.updateCurrentTool) {
            uiManager.updateCurrentTool(toolName);
        }
        
        // アプリケーション通知
        this.appCore.emit('tool:changed', {
            tool: toolName,
            settings: this.getBrushSettings()
        });
    }
    
    notifyBrushChange() {
        const uiManager = this.appCore.getManager('ui');
        if (uiManager) {
            // スライダー更新
            if (uiManager.updateSliderValue) {
                uiManager.updateSliderValue('pen-size-slider', this.brushSize);
                uiManager.updateSliderValue('pen-opacity-slider', this.brushOpacity * 100);
            }
            
            // プリセット表示更新
            if (uiManager.presetDisplay && uiManager.presetDisplay.updateLivePreview) {
                uiManager.presetDisplay.updateLivePreview(
                    this.brushSize, 
                    this.brushOpacity, 
                    this.brushColor
                );
            }
        }
    }
    
    notifyCoordinateUpdate(x, y) {
        const uiManager = this.appCore.getManager('ui');
        if (uiManager && uiManager.updateStatusBar) {
            uiManager.updateStatusBar({
                coordinates: { x, y },
                pressure: this.pressure * 100
            });
        }
    }
    
    // ==== ユーティリティ ====
    colorToHex(color) {
        if (typeof color === 'string') return color;
        return '#' + color.toString(16).padStart(6, '0');
    }
    
    // ==== イベント処理（Phase1統括制御）====
    onEvent(eventName, data) {
        switch (eventName) {
            case 'ui:preset_selected':
                this.selectPreset(data.presetId);
                break;
            case 'ui:brush_size_changed':
                this.setBrushSize(data.size);
                break;
            case 'ui:brush_opacity_changed':
                this.setBrushOpacity(data.opacity);
                break;
            case 'canvas:zoom_changed':
                // ズーム変更時の処理（将来実装）
                break;
        }
    }
    
    // ==== 公開API（Phase1統括インターフェース）====
    
    /**
     * ツール統括情報取得
     */
    getStats() {
        return {
            currentTool: this.currentTool,
            availableTools: this.getAvailableTools(),
            brushSettings: this.getBrushSettings(),
            presetCount: this.presets.size,
            activePreset: this.activePresetId,
            isDrawing: this.isDrawing,
            hasHistoryManager: !!this.historyManager,
            initialized: this.isInitialized
        };
    }
    
    /**
     * デバッグ情報表示
     */
    debugInfo() {
        console.group('🛠️ ToolManager デバッグ情報');
        console.log('統計:', this.getStats());
        console.log('プリセット:', Array.from(this.presets.entries()));
        console.log('ツール:', Array.from(this.tools.keys()));
        console.log('現在の設定:', this.settings);
        console.groupEnd();
    }
    
    /**
     * ツール機能テスト
     */
    testTools() {
        console.group('🧪 ツール機能テスト');
        
        // 1. ツール切り替えテスト
        console.log('1. ツール切り替えテスト...');
        const originalTool = this.currentTool;
        
        this.setTool('pen');
        console.log('ペンツール:', this.currentTool === 'pen' ? '✅' : '❌');
        
        this.setTool('eraser');
        console.log('消しゴムツール:', this.currentTool === 'eraser' ? '✅' : '❌');
        
        this.setTool(originalTool);
        
        // 2. ブラシ設定テスト
        console.log('2. ブラシ設定テスト...');
        const originalSize = this.brushSize;
        
        this.setBrushSize(20);
        console.log('サイズ変更:', this.brushSize === 20 ? '✅' : '❌');
        
        this.setBrushSize(originalSize);
        
        // 3. プリセットテスト
        console.log('3. プリセットテスト...');
        const testPreset = this.selectPreset('preset-8');
        console.log('プリセット選択:', testPreset && testPreset.size === 8 ? '✅' : '❌');
        
        console.log('✅ ツール機能テスト完了');
        console.groupEnd();
    }
    
    // ==== クリーンアップ ====
    destroy() {
        console.log('🛠️ ToolManager 破棄開始...');
        
        // 現在のツールを非アクティブ化
        const currentTool = this.tools.get(this.currentTool);
        if (currentTool && currentTool.onDeactivate) {
            currentTool.onDeactivate();
        }
        
        // パスの強制終了
        this.finalizePath();
        
        // 参照クリア
        this.tools.clear();
        this.presets.clear();
        this.historyManager = null;
        this.currentPath = null;
        this.lastPoint = null;
        
        console.log('✅ ToolManager 破棄完了');
    }
}

// ==== エクスポート ====
if (typeof window !== 'undefined') {
    window.ToolManager = ToolManager;
}

// ES6 module export (将来のTypeScript移行用)
// export { ToolManager };