/**
 * PixiJS v8全ツール統合処理・Graphics最適化
 * モダンお絵かきツール v3.3 - Phase2統合ツールシステム
 * 
 * 機能:
 * - 全ツール統合管理・ペン・消しゴム・エアスプレー・ボカシ等
 * - PixiJS v8 Graphics最適化・非破壊ベクター保持
 * - ツール切り替え・設定管理・プリセット対応
 * - 筆圧対応・スムージング・エッジ処理
 * - EventStore統合・履歴連携・パフォーマンス最適化
 */

import { Graphics, Filter, Point } from 'pixi.js';
import * as filters from '@pixi/filters';

/**
 * PixiJS v8全ツール統合処理
 * 統一インターフェース・高速描画・設定管理
 */
class PixiV8ToolProcessor {
    constructor(pixiApp, eventStore) {
        this.app = pixiApp;
        this.eventStore = eventStore;
        this.renderer = pixiApp.renderer;
        
        // 現在のツール・設定
        this.currentTool = 'pen';
        this.isDrawing = false;
        this.currentStroke = null;
        
        // ツール設定定義（v3.3完全版）
        this.toolSettings = {
            pen: {
                size: 2,
                opacity: 1.0,
                color: 0x800000,
                pressure: true,
                smoothing: 0.7,
                cap: 'round',
                join: 'round',
                presets: [1, 2, 4, 8, 16, 32]
            },
            eraser: {
                size: 10,
                opacity: 1.0,
                pressure: true,
                smoothing: 0.5,
                edgeSmoothing: true,
                presets: [5, 10, 20, 40, 80]
            },
            airbrush: {
                size: 20,
                opacity: 0.7,
                intensity: 0.65,
                density: 0.5,
                radius: 20,
                pressure: true,
                eraseMode: false,
                preview: true,
                presets: [10, 20, 30, 50, 80]
            },
            blur: {
                size: 15,
                intensity: 0.5,
                feather: 0.3,
                preview: true,
                realtime: true,
                presets: [5, 10, 15, 25, 40]
            },
            eyedropper: {
                sampleSize: 1,
                averageMode: false,
                showPreview: true,
                autoSwitch: true
            },
            fill: {
                tolerance: 32,
                smoothEdges: true,
                preview: true,
                contiguous: true
            },
            select: {
                type: 'rectangle', // rectangle, ellipse, lasso, magic
                feather: 0,
                antialias: true,
                showMarching: true
            },
            text: {
                fontSize: 16,
                fontFamily: 'Arial',
                color: 0x800000,
                bold: false,
                italic: false,
                align: 'left'
            }
        };
        
        // 描画バッファ・最適化
        this.strokeBuffer = [];
        this.smoothingBuffer = [];
        this.maxBufferSize = 10;
        
        // パフォーマンス管理
        this.useGPUAcceleration = this.renderer.type === 'webgpu';
        this.batchDrawing = true;
        this.frameSkipping = false;
        
        // フィルター管理
        this.activeFilters = new Map();
        this.filterCache = new Map();
        
        // ツール固有インスタンス
        this.toolInstances = new Map();
        
        this.initializeTools();
        this.setupEventStoreIntegration();
        
        console.log('✅ PixiV8ToolProcessor初期化完了 - 全ツール統合');
    }
    
    /**
     * ツール初期化
     * 各ツール固有の設定・インスタンス準備
     */
    initializeTools() {
        // ブラー用フィルター準備
        if (filters.BlurFilter) {
            this.activeFilters.set('blur', new filters.BlurFilter());
        }
        
        console.log('🔧 ツール初期化完了');
    }
    
    /**
     * EventStore統合設定
     * ツール切り替え・設定変更・描画イベント連携
     */
    setupEventStoreIntegration() {
        // ツール変更イベント
        this.eventStore.on('tool-changed', (data) => {
            this.setTool(data.tool);
        });
        
        // ツール設定更新イベント
        this.eventStore.on('tool-config-updated', (data) => {
            this.updateToolSetting(data.tool, data.property, data.value, data.delta);
        });
        
        // 描画イベント
        this.eventStore.on('drawing-start', (data) => {
            this.startDrawing(data);
        });
        
        this.eventStore.on('drawing-update', (data) => {
            this.updateDrawing(data);
        });
        
        this.eventStore.on('drawing-end', (data) => {
            this.endDrawing(data);
        });
        
        // エアスプレー専用イベント（v3.3）
        this.eventStore.on('airbrush-settings-change', (data) => {
            this.updateAirbrushSettings(data);
        });
        
        console.log('🔗 EventStore統合完了');
    }
    
    /**
     * ツール設定
     * ツール切り替え・状態管理・UI更新
     */
    setTool(toolName) {
        if (!this.toolSettings[toolName]) {
            console.warn(`⚠️ 未知のツール: ${toolName}`);
            return false;
        }
        
        // 現在の描画中断
        if (this.isDrawing) {
            this.endDrawing({ x: 0, y: 0, forced: true });
        }
        
        const previousTool = this.currentTool;
        this.currentTool = toolName;
        
        // ツール固有の初期化
        this.initializeToolInstance(toolName);
        
        console.log(`🔧 ツール変更: ${previousTool} → ${toolName}`);
        return true;
    }
    
    /**
     * ツール固有インスタンス初期化
     */
    initializeToolInstance(toolName) {
        switch (toolName) {
            case 'blur':
                this.initializeBlurTool();
                break;
            case 'eyedropper':
                this.initializeEyedropperTool();
                break;
            case 'fill':
                this.initializeFillTool();
                break;
            case 'select':
                this.initializeSelectTool();
                break;
            case 'text':
                this.initializeTextTool();
                break;
        }
    }
    
    /**
     * ブラーツール初期化
     */
    initializeBlurTool() {
        const blurFilter = this.activeFilters.get('blur');
        if (blurFilter) {
            const settings = this.toolSettings.blur;
            blurFilter.blur = settings.size * settings.intensity;
        }
    }
    
    /**
     * スポイトツール初期化
     */
    initializeEyedropperTool() {
        // スポイト用の一時Canvas作成（色抽出用）
        this.eyedropperCanvas = document.createElement('canvas');
        this.eyedropperCanvas.width = 1;
        this.eyedropperCanvas.height = 1;
        this.eyedropperContext = this.eyedropperCanvas.getContext('2d');
    }
    
    /**
     * 塗りつぶしツール初期化
     */
    initializeFillTool() {
        // 塗りつぶし用のワーカー準備（大きな画像対応）
        if (typeof Worker !== 'undefined') {
            // Phase3以降でWorker実装
        }
    }
    
    /**
     * 選択ツール初期化
     */
    initializeSelectTool() {
        this.selectionGraphics = new Graphics();
        this.selectionMarching = false;
    }
    
    /**
     * テキストツール初期化
     */
    initializeTextTool() {
        this.textInput = null;
        this.textCursor = { x: 0, y: 0 };
    }
    
    /**
     * 描画開始処理
     * ツール別分岐・Graphics作成・履歴準備
     */
    startDrawing(drawingData) {
        if (this.isDrawing) return;
        
        this.isDrawing = true;
        const { x, y, pressure = 1.0, toolConfig } = drawingData;
        
        // ツール設定適用
        const settings = { ...this.toolSettings[this.currentTool], ...toolConfig };
        
        switch (this.currentTool) {
            case 'pen':
                this.startPenDrawing(x, y, pressure, settings);
                break;
            case 'eraser':
                this.startEraserDrawing(x, y, pressure, settings);
                break;
            case 'airbrush':
                this.startAirbrushDrawing(x, y, pressure, settings);
                break;
            case 'blur':
                this.startBlurDrawing(x, y, pressure, settings);
                break;
            case 'eyedropper':
                this.performColorPick(x, y, settings);
                break;
            case 'fill':
                this.performFloodFill(x, y, settings);
                break;
            case 'select':
                this.startSelection(x, y, settings);
                break;
            case 'text':
                this.startTextInput(x, y, settings);
                break;
        }
        
        console.log(`🖌️ 描画開始: ${this.currentTool} at (${x}, ${y})`);
    }
    
    /**
     * ペン描画開始
     */
    startPenDrawing(x, y, pressure, settings) {
        this.currentStroke = new Graphics();
        
        // 筆圧適用サイズ
        const effectiveSize = settings.pressure ? settings.size * pressure : settings.size;
        
        this.currentStroke.lineStyle({
            width: effectiveSize,
            color: settings.color,
            alpha: settings.opacity,
            cap: settings.cap,
            join: settings.join
        });
        
        this.currentStroke.moveTo(x, y);
        this.strokeBuffer = [{ x, y, pressure }];
        
        // アクティブレイヤーに追加
        this.addToActiveLayer(this.currentStroke);
    }
    
    /**
     * 消しゴム描画開始
     */
    startEraserDrawing(x, y, pressure, settings) {
        this.currentStroke = new Graphics();
        
        const effectiveSize = settings.pressure ? settings.size * pressure : settings.size;
        
        this.currentStroke.lineStyle({
            width: effectiveSize,
            color: 0xffffff,
            alpha: settings.opacity,
            cap: 'round',
            join: 'round'
        });
        
        // 消去モード設定
        this.currentStroke.blendMode = 'erase';
        
        this.currentStroke.moveTo(x, y);
        this.strokeBuffer = [{ x, y, pressure }];
        
        this.addToActiveLayer(this.currentStroke);
    }
    
    /**
     * エアスプレー描画開始
     */
    startAirbrushDrawing(x, y, pressure, settings) {
        // エアスプレーは連続パーティクル生成のため、
        // 既存のPixiV8AirbrushToolに委譲
        this.eventStore.emit('airbrush-spray', {
            x, y, pressure, settings
        });
    }
    
    /**
     * ブラー描画開始
     */
    startBlurDrawing(x, y, pressure, settings) {
        this.currentStroke = new Graphics();
        
        // ブラー効果用の特殊描画
        const effectiveSize = settings.size * (settings.pressure ? pressure : 1.0);
        
        this.currentStroke.beginFill(0xffffff, 0.1);
        this.currentStroke.drawCircle(x, y, effectiveSize);
        this.currentStroke.endFill();
        
        // ブラーフィルター適用
        const blurFilter = this.activeFilters.get('blur');
        if (blurFilter) {
            this.currentStroke.filters = [blurFilter];
        }
        
        this.addToActiveLayer(this.currentStroke);
    }
    
    /**
     * 描画更新処理
     * ツール別継続描画・スムージング・最適化
     */
    updateDrawing(drawingData) {
        if (!this.isDrawing) return;
        
        const { x, y, pressure = 1.0 } = drawingData;
        
        switch (this.currentTool) {
            case 'pen':
            case 'eraser':
                this.updateStrokeDrawing(x, y, pressure);
                break;
            case 'airbrush':
                this.updateAirbrushDrawing(x, y, pressure);
                break;
            case 'blur':
                this.updateBlurDrawing(x, y, pressure);
                break;
            case 'select':
                this.updateSelection(x, y);
                break;
        }
    }
    
    /**
     * ストローク描画更新（ペン・消しゴム共通）
     */
    updateStrokeDrawing(x, y, pressure) {
        if (!this.currentStroke) return;
        
        this.strokeBuffer.push({ x, y, pressure });
        
        // バッファサイズ制限
        if (this.strokeBuffer.length > this.maxBufferSize) {
            this.strokeBuffer.shift();
        }
        
        // スムージング適用
        const smoothedPoints = this.applySmoothingToBuffer();
        
        if (smoothedPoints.length >= 2) {
            const current = smoothedPoints[smoothedPoints.length - 1];
            const previous = smoothedPoints[smoothedPoints.length - 2];
            
            // 筆圧対応線幅更新
            const settings = this.toolSettings[this.currentTool];
            if (settings.pressure) {
                const effectiveWidth = settings.size * current.pressure;
                // PixiJS v8では動的な線幅変更が制限されるため、
                // 小さなセグメントで分割描画
                this.drawPressureSensitiveSegment(previous, current, effectiveWidth);
            } else {
                // 通常の線描画
                this.currentStroke.lineTo(current.x, current.y);
            }
        }
    }
    
    /**
     * 筆圧対応セグメント描画
     */
    drawPressureSensitiveSegment(start, end, width) {
        const segment = new Graphics();
        const settings = this.toolSettings[this.currentTool];
        
        segment.lineStyle({
            width: width,
            color: settings.color || 0x800000,
            alpha: settings.opacity || 1.0,
            cap: settings.cap || 'round',
            join: settings.join || 'round'
        });
        
        segment.moveTo(start.x, start.y);
        segment.lineTo(end.x, end.y);
        
        if (this.currentTool === 'eraser') {
            segment.blendMode = 'erase';
        }
        
        this.addToActiveLayer(segment);
    }
    
    /**
     * エアスプレー描画更新
     */
    updateAirbrushDrawing(x, y, pressure) {
        this.eventStore.emit('airbrush-spray', {
            x, y, pressure, 
            settings: this.toolSettings.airbrush
        });
    }
    
    /**
     * ブラー描画更新
     */
    updateBlurDrawing(x, y, pressure) {
        const settings = this.toolSettings.blur;
        const effectiveSize = settings.size * (settings.pressure ? pressure : 1.0);
        
        const blurPoint = new Graphics();
        blurPoint.beginFill(0xffffff, 0.05);
        blurPoint.drawCircle(x, y, effectiveSize);
        blurPoint.endFill();
        
        const blurFilter = this.activeFilters.get('blur');
        if (blurFilter) {
            blurPoint.filters = [blurFilter];
        }
        
        this.addToActiveLayer(blurPoint);
    }
    
    /**
     * 描画終了処理
     * ベクターデータ確定・履歴記録・最適化
     */
    endDrawing(drawingData) {
        if (!this.isDrawing) return;
        
        this.isDrawing = false;
        const { x, y, forced = false } = drawingData;
        
        switch (this.currentTool) {
            case 'pen':
            case 'eraser':
                this.endStrokeDrawing(x, y, forced);
                break;
            case 'airbrush':
                this.endAirbrushDrawing();
                break;
            case 'blur':
                this.endBlurDrawing();
                break;
            case 'select':
                this.endSelection(x, y);
                break;
        }
        
        // バッファクリア
        this.strokeBuffer = [];
        this.smoothingBuffer = [];
        this.currentStroke = null;
        
        console.log(`✅ 描画終了: ${this.currentTool}`);
    }
    
    /**
     * ストローク描画終了
     */
    endStrokeDrawing(x, y, forced) {
        if (this.currentStroke && this.strokeBuffer.length > 0) {
            // 最終点描画
            if (!forced) {
                this.currentStroke.lineTo(x, y);
            }
            
            // ベクターデータ保存（非破壊性保証）
            this.currentStroke.vectorData = {
                tool: this.currentTool,
                points: [...this.strokeBuffer],
                settings: { ...this.toolSettings[this.currentTool] },
                timestamp: Date.now()
            };
        }
    }
    
    /**
     * エアスプレー描画終了
     */
    endAirbrushDrawing() {
        // エアスプレーツールに終了通知
        this.eventStore.emit('airbrush-end', {
            tool: 'airbrush',
            timestamp: Date.now()
        });
    }
    
    /**
     * ブラー描画終了
     */
    endBlurDrawing() {
        // ブラー効果の最終処理
        console.log('🌫️ ブラー描画完了');
    }
    
    /**
     * スムージング適用
     * ベジエ曲線・移動平均・ブレ軽減
     */
    applySmoothingToBuffer() {
        if (this.strokeBuffer.length < 2) return this.strokeBuffer;
        
        const settings = this.toolSettings[this.currentTool];
        const smoothing = settings.smoothing || 0.5;
        
        if (smoothing === 0) return this.strokeBuffer;
        
        const smoothed = [];
        smoothed.push(this.strokeBuffer[0]); // 開始点は変更なし
        
        for (let i = 1; i < this.strokeBuffer.length - 1; i++) {
            const prev = this.strokeBuffer[i - 1];
            const curr = this.strokeBuffer[i];
            const next = this.strokeBuffer[i + 1];
            
            // 移動平均によるスムージング
            const smoothedX = curr.x * (1 - smoothing) + 
                             (prev.x + next.x) * smoothing / 2;
            const smoothedY = curr.y * (1 - smoothing) + 
                             (prev.y + next.y) * smoothing / 2;
            const smoothedPressure = curr.pressure * (1 - smoothing) + 
                                   (prev.pressure + next.pressure) * smoothing / 2;
            
            smoothed.push({
                x: smoothedX,
                y: smoothedY,
                pressure: smoothedPressure
            });
        }
        
        if (this.strokeBuffer.length > 1) {
            smoothed.push(this.strokeBuffer[this.strokeBuffer.length - 1]); // 終点は変更なし
        }
        
        return smoothed;
    }
    
    /**
     * 色抽出処理（スポイトツール）
     */
    performColorPick(x, y, settings) {
        try {
            // PixiJS v8 extract機能活用
            const canvas = this.renderer.extract.canvas(this.app.stage);
            const context = canvas.getContext('2d');
            
            const imageData = context.getImageData(x, y, 1, 1);
            const [r, g, b, a] = imageData.data;
            
            // RGB → HEX変換
            const color = (r << 16) | (g << 8) | b;
            
            // 色選択イベント発行
            this.eventStore.emit('color-selected', {
                color: color,
                rgb: { r, g, b, a },
                hex: `#${color.toString(16).padStart(6, '0')}`,
                source: 'eyedropper',
                position: { x, y }
            });
            
            console.log(`🎨 色抽出: #${color.toString(16).padStart(6, '0')} at (${x}, ${y})`);
            
        } catch (error) {
            console.error('❌ 色抽出エラー:', error);
        }
    }
    
    /**
     * 塗りつぶし処理（フラッドフィル）
     */
    performFloodFill(x, y, settings) {
        console.log(`🪣 塗りつぶし実行: (${x}, ${y}) - Phase3で完全実装予定`);
        
        // 簡易塗りつぶし（Phase2暫定実装）
        const fillGraphics = new Graphics();
        fillGraphics.beginFill(settings.color || this.toolSettings.pen.color);
        fillGraphics.drawCircle(x, y, 50); // 仮の円形塗りつぶし
        fillGraphics.endFill();
        
        this.addToActiveLayer(fillGraphics);
    }
    
    /**
     * 選択開始
     */
    startSelection(x, y, settings) {
        if (this.selectionGraphics) {
            this.selectionGraphics.clear();
        }
        
        this.selectionStart = { x, y };
        this.selectionCurrent = { x, y };
        
        console.log('⬚ 選択開始');
    }
    
    /**
     * 選択更新
     */
    updateSelection(x, y) {
        if (!this.selectionStart || !this.selectionGraphics) return;
        
        this.selectionCurrent = { x, y };
        
        this.selectionGraphics.clear();
        this.selectionGraphics.lineStyle({
            width: 1,
            color: 0x000000,
            alpha: 0.8
        });
        
        // 矩形選択描画
        const width = x - this.selectionStart.x;
        const height = y - this.selectionStart.y;
        
        this.selectionGraphics.drawRect(
            this.selectionStart.x, 
            this.selectionStart.y, 
            width, 
            height
        );
        
        this.addToOverlayLayer(this.selectionGraphics);
    }
    
    /**
     * 選択終了
     */
    endSelection(x, y) {
        if (this.selectionStart) {
            const selection = {
                x: Math.min(this.selectionStart.x, x),
                y: Math.min(this.selectionStart.y, y),
                width: Math.abs(x - this.selectionStart.x),
                height: Math.abs(y - this.selectionStart.y)
            };
            
            this.eventStore.emit('selection-created', selection);
            console.log('✅ 選択完了:', selection);
        }
    }
    
    /**
     * テキスト入力開始
     */
    startTextInput(x, y, settings) {
        this.textCursor = { x, y };
        
        // テキスト入力UI表示（Phase3で完全実装）
        console.log(`📝 テキスト入力: (${x}, ${y})`);
        
        this.eventStore.emit('text-input-start', {
            position: { x, y },
            settings: settings
        });
    }
    
    /**
     * ツール設定更新
     */
    updateToolSetting(toolName, property, value, delta) {
        const tool = toolName || this.currentTool;
        
        if (!this.toolSettings[tool]) return;
        
        if (delta !== undefined) {
            // 相対変更
            this.toolSettings[tool][property] += delta;
        } else if (value !== undefined) {
            // 絶対値設定
            this.toolSettings[tool][property] = value;
        }
        
        // 設定値範囲制限
        this.constrainToolSettings(tool, property);
        
        console.log(`⚙️ ツール設定更新: ${tool}.${property} = ${this.toolSettings[tool][property]}`);
    }
    
    /**
     * エアスプレー設定更新（v3.3専用）
     */
    updateAirbrushSettings(data) {
        const { property, delta, value } = data;
        
        if (delta !== undefined) {
            this.toolSettings.airbrush[property] += delta;
        } else if (value !== undefined) {
            this.toolSettings.airbrush[property] = value;
        }
        
        this.constrainToolSettings('airbrush', property);
        
        // エアスプレーツールに設定変更通知
        this.eventStore.emit('airbrush-config-updated', {
            settings: { ...this.toolSettings.airbrush }
        });
    }
    
    /**
     * ツール設定値制限
     */
    constrainToolSettings(toolName, property) {
        const settings = this.toolSettings[toolName];
        
        const constraints = {
            size: { min: 1, max: 100 },
            opacity: { min: 0.1, max: 1.0 },
            intensity: { min: 0.1, max: 1.0 },
            density: { min: 0.1, max: 1.0 },
            radius: { min: 5, max: 100 },
            tolerance: { min: 0, max: 255 },
            fontSize: { min: 8, max: 72 }
        };
        
        const constraint = constraints[property];
        if (constraint && settings[property] !== undefined) {
            settings[property] = Math.max(constraint.min, 
                                        Math.min(constraint.max, settings[property]));
        }
    }
    
    /**
     * アクティブレイヤーに追加
     */
    addToActiveLayer(graphics) {
        // レンダラーからアクティブレイヤー取得して追加
        this.eventStore.emit('add-to-active-layer', { graphics });
    }
    
    /**
     * オーバーレイレイヤーに追加
     */
    addToOverlayLayer(graphics) {
        // UI用オーバーレイレイヤーに追加
        this.eventStore.emit('add-to-overlay-layer', { graphics });
    }
    
    /**
     * 現在のツール取得
     */
    getCurrentTool() {
        return this.currentTool;
    }
    
    /**
     * ツール設定取得
     */
    getToolSettings(toolName = null) {
        const tool = toolName || this.currentTool;
        return { ...this.toolSettings[tool] };
    }
    
    /**
     * 全ツール設定取得
     */
    getAllToolSettings() {
        return { ...this.toolSettings };
    }
    
    /**
     * プリセット適用
     */
    applyPreset(toolName, presetIndex) {
        const tool = toolName || this.currentTool;
        const settings = this.toolSettings[tool];
        
        if (settings.presets && settings.presets[presetIndex] !== undefined) {
            settings.size = settings.presets[presetIndex];
            console.log(`🎨 プリセット適用: ${tool} サイズ ${settings.size}`);
        }
    }
    
    /**
     * 描画状態取得
     */
    getDrawingState() {
        return {
            isDrawing: this.isDrawing,
            currentTool: this.currentTool,
            strokeBuffer: this.strokeBuffer.length,
            hasCurrentStroke: !!this.currentStroke
        };
    }
    
    /**
     * パフォーマンス統計取得
     */
    getPerformanceStats() {
        return {
            useGPUAcceleration: this.useGPUAcceleration,
            batchDrawing: this.batchDrawing,
            frameSkipping: this.frameSkipping,
            activeFilters: this.activeFilters.size,
            maxBufferSize: this.maxBufferSize,
            currentBufferSize: this.strokeBuffer.length
        };
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            currentTool: this.currentTool,
            drawingState: this.getDrawingState(),
            toolSettings: this.getToolSettings(),
            performance: this.getPerformanceStats(),
            toolInstances: Array.from(this.toolInstances.keys()),
            activeFilters: Array.from(this.activeFilters.keys())
        };
    }
    
    /**
     * リソース解放
     */
    destroy() {
        // 現在の描画中断
        if (this.isDrawing) {
            this.endDrawing({ x: 0, y: 0, forced: true });
        }
        
        // フィルター解放
        this.activeFilters.forEach(filter => {
            filter.destroy?.();
        });
        this.activeFilters.clear();
        
        // ツールインスタンス解放
        this.toolInstances.forEach(instance => {
            instance.destroy?.();
        });
        this.toolInstances.clear();
        
        // バッファクリア
        this.strokeBuffer = [];
        this.smoothingBuffer = [];
        
        // 参照クリア
        this.currentStroke = null;
        this.selectionGraphics = null;
        this.eyedropperCanvas = null;
        this.eyedropperContext = null;
        
        console.log('🗑️ PixiV8ToolProcessor リソース解放完了');
    }
}

export default PixiV8ToolProcessor;