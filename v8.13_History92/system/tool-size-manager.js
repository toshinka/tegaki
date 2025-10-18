/**
 * ToolSizeManager (修正版)
 * ペン・消しゴムのサイズ・透明度の一元管理
 * 
 * 🔧 修正内容:
 * - BrushSettings参照を複数経路で探索（堅牢化）
 * - 初期化を遅延実行可能に（DrawingEngine準備後に呼び出し）
 * - EventBusリスナーの確実な登録
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

        // EventBusリスナー登録
        this._setupEventListeners();
        
        // BrushSettings初期同期（遅延実行）
        this._delayedInitialization();
    }

    /**
     * 遅延初期化: DrawingEngine準備後にBrushSettingsと同期
     */
    _delayedInitialization() {
        // DrawingEngineが準備できるまで待つ（最大5秒）
        let attempts = 0;
        const maxAttempts = 50; // 50 * 100ms = 5秒
        
        const checkBrushSettings = () => {
            const brushSettings = this._getBrushSettings();
            
            if (brushSettings) {
                // BrushSettingsから初期値を取得
                try {
                    this.penSize = brushSettings.getBrushSize();
                    this.penOpacity = brushSettings.getBrushOpacity();
                } catch (e) {
                    // getter失敗時はデフォルト値を維持
                }
                return;
            }
            
            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(checkBrushSettings, 100);
            }
        };
        
        // 初回は即実行
        setTimeout(checkBrushSettings, 0);
    }

    _setupEventListeners() {
        if (!this.eventBus) return;
        
        this.eventBus.on('tool:drag-size-start', (data) => this.handleDragStart(data));
        this.eventBus.on('tool:drag-size-update', (data) => this.handleDragUpdate(data));
        this.eventBus.on('tool:drag-size-end', () => this.handleDragEnd());
    }

    /**
     * BrushSettingsへの堅牢なアクセス（複数経路探索）
     */
    _getBrushSettings() {
        // 🔧 修正: DrawingEngine.brushSettings が正しいパス
        const candidates = [
            window.drawingApp?.drawingEngine,
            window.coreEngine?.drawingEngine,
            window.CoreEngine?.drawingEngine,
            window.drawingEngine
        ];
        
        for (const de of candidates) {
            if (!de) continue;
            
            // brushSettingsプロパティをチェック
            if (de.brushSettings) return de.brushSettings;
            
            // getBrushSettings()メソッドをチェック
            if (de.getBrushSettings && typeof de.getBrushSettings === 'function') {
                try {
                    const bs = de.getBrushSettings();
                    if (bs) return bs;
                } catch (e) {
                    // 失敗時は次の候補へ
                }
            }
        }
        
        // coreEngine経由でDrawingEngineを取得
        if (window.coreEngine && typeof window.coreEngine.getDrawingEngine === 'function') {
            try {
                const de = window.coreEngine.getDrawingEngine();
                if (de?.brushSettings) return de.brushSettings;
            } catch (e) {
                // 失敗時は次へ
            }
        }
        
        return null;
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
            } else if (typeof brushSettings.size !== 'undefined') {
                brushSettings.size = size;
            }

            if (typeof brushSettings.setBrushOpacity === 'function') {
                brushSettings.setBrushOpacity(opacity);
            } else if (typeof brushSettings.opacity !== 'undefined') {
                brushSettings.opacity = opacity;
            }
        } catch (error) {
            // エラー時は静かに失敗
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
            drawingEngineExists: !!(
                window.drawingApp?.drawingEngine || 
                window.coreEngine?.drawingEngine
            )
        };
    }
}

window.ToolSizeManager = ToolSizeManager;