/**
 * ToolSizeManager
 * ペン・消しゴムのサイズ・透明度の一元管理
 */
class ToolSizeManager {
    constructor(config, eventBus) {
        this.config = config;
        this.eventBus = eventBus;

        // サイズスロット
        this.sizeSlots = {
            pen: [...config.sizeSlots.pen],
            eraser: [...config.sizeSlots.eraser]
        };

        // 現在のサイズ・透明度
        this.penSize = 6;
        this.penOpacity = 1.0;
        this.eraserSize = 20;
        this.eraserOpacity = 1.0;

        // ドラッグ状態
        this.dragState = null;

        this._setupEventListeners();
    }

    _setupEventListeners() {
        this.eventBus.on('tool:drag-size-start', (data) => this.handleDragStart(data));
        this.eventBus.on('tool:drag-size-update', (data) => this.handleDragUpdate(data));
        this.eventBus.on('tool:drag-size-end', () => this.handleDragEnd());
    }

    /**
     * BrushSettingsへの安全なアクセス
     */
    _getBrushSettings() {
        // DrawingEngine.settings が正しいパス
        const de = window.drawingApp?.drawingEngine || window.coreEngine?.drawingEngine;
        
        if (!de) {
            console.warn('⚠️ DrawingEngine not found');
            return null;
        }
        
        if (!de.settings) {
            console.warn('⚠️ DrawingEngine.settings is undefined');
            return null;
        }
        
        return de.settings;
    }

    handleDragStart({ tool, startSize, startOpacity }) {
        this.dragState = {
            tool,
            startSize,
            startOpacity,
            currentSize: startSize,
            currentOpacity: startOpacity
        };
    }

    handleDragUpdate({ tool, deltaX, deltaY }) {
        if (!this.dragState || this.dragState.tool !== tool) return;

        const sensitivity = this.config.dragAdjustment;

        // サイズ計算（左右ドラッグ）
        const newSize = Math.max(
            sensitivity.size.min,
            Math.min(
                sensitivity.size.max,
                this.dragState.startSize + deltaX * sensitivity.size.sensitivity
            )
        );

        // 透明度計算（上下ドラッグ、下方向で透明度UP）
        const newOpacity = Math.max(
            sensitivity.opacity.min,
            Math.min(
                sensitivity.opacity.max,
                this.dragState.startOpacity + deltaY * sensitivity.opacity.sensitivity
            )
        );

        this.dragState.currentSize = newSize;
        this.dragState.currentOpacity = newOpacity;

        // 値を保存
        if (tool === 'pen') {
            this.penSize = newSize;
            this.penOpacity = newOpacity;
        } else if (tool === 'eraser') {
            this.eraserSize = newSize;
            this.eraserOpacity = newOpacity;
        }

        // BrushSettingsに反映
        this._applyToBrushSettings(tool, newSize, newOpacity);

        // イベント発行
        this.eventBus.emit('tool:size-opacity-changed', {
            tool,
            size: newSize,
            opacity: newOpacity
        });
    }

    /**
     * BrushSettingsへの安全な適用
     */
    _applyToBrushSettings(tool, size, opacity) {
        const brushSettings = this._getBrushSettings();
        
        if (!brushSettings) return;

        try {
            // BrushSettings の API を使用
            if (typeof brushSettings.setBrushSize === 'function') {
                brushSettings.setBrushSize(size);
            }

            if (typeof brushSettings.setBrushOpacity === 'function') {
                brushSettings.setBrushOpacity(opacity);
            }
        } catch (error) {
            console.warn('⚠️ Failed to apply brush settings:', error.message);
        }
    }

    handleDragEnd() {
        if (!this.dragState) return;

        const { tool, currentSize, currentOpacity } = this.dragState;

        this.eventBus.emit('tool:size-drag-completed', {
            tool,
            finalSize: currentSize,
            finalOpacity: currentOpacity
        });

        this.dragState = null;
    }

    getDebugInfo() {
        const brushSettings = this._getBrushSettings();
        
        return {
            penSize: this.penSize,
            penOpacity: this.penOpacity,
            eraserSize: this.eraserSize,
            eraserOpacity: this.eraserOpacity,
            dragState: this.dragState,
            brushSettingsExists: !!brushSettings,
            drawingEngineExists: !!(window.drawingApp?.drawingEngine || window.coreEngine?.drawingEngine)
        };
    }
}

window.ToolSizeManager = ToolSizeManager;