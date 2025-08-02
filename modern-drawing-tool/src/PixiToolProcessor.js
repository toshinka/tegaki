/**
 * PixiToolProcessor v3.2 - PixiJS統一ツール処理システム
 * ペン・エアスプレー・消しゴム・選択ツール統合実装
 * 規約: 総合AIコーディング規約v4.1準拠（PixiJS統一座標対応）
 */

import * as PIXI from 'pixi.js';

/**
 * PixiJS統一ツール処理システム
 * PixiJS Graphics活用による高品質描画・ベクター非破壊保持
 */
export class PixiToolProcessor {
    constructor(pixiApp, coordinateUnifier, eventStore) {
        this.app = pixiApp;
        this.coordinate = coordinateUnifier;
        this.eventStore = eventStore;
        
        // ツール状態管理
        this.currentTool = 'pen';
        this.toolConfigs = new Map();
        this.isDrawing = false;
        this.currentStroke = null;
        this.currentPath = [];
        
        // PixiJS描画レイヤー
        this.drawingContainer = new PIXI.Container();
        this.previewContainer = new PIXI.Container();
        this.app.stage.addChild(this.drawingContainer);
        this.app.stage.addChild(this.previewContainer);
        
        // ツール固有データ
        this.strokeHistory = [];
        this.tempGraphics = null;
        this.selectionBox = null;
        this.pressurePoints = [];
        
        // パフォーマンス最適化
        this.drawingBounds = new PIXI.Rectangle();
        this.renderTicker = null;
        this.smoothingBuffer = [];
        
        this.initialize();
    }
    
    /**
     * ツールプロセッサー初期化
     */
    initialize() {
        try {
            // デフォルトツール設定
            this.initializeToolConfigs();
            
            // PixiJS描画最適化設定
            this.setupPixiOptimizations();
            
            // イベントリスナー設定
            this.setupEventListeners();
            
            // ツール切り替えUI連携準備
            this.setupToolUI();
            
            console.log('🎨 PixiToolProcessor初期化完了 - PixiJS統一ツールシステム');
            
        } catch (error) {
            console.error('❌ PixiToolProcessor初期化エラー:', error);
            throw error;
        }
    }
    
    /**
     * デフォルトツール設定初期化
     */
    initializeToolConfigs() {
        // ペンツール設定
        this.toolConfigs.set('pen', {
            type: 'pen',
            size: 12,
            color: 0x800000, // ふたばマルーン
            opacity: 0.85,
            smoothing: 0.7,
            pressureSensitive: true,
            capStyle: PIXI.LINE_CAP.ROUND,
            joinStyle: PIXI.LINE_JOIN.ROUND,
            blendMode: PIXI.BLEND_MODES.NORMAL
        });
        
        // エアスプレーツール設定
        this.toolConfigs.set('airbrush', {
            type: 'airbrush',
            size: 24,
            color: 0xaa5a56, // ふたばライトマルーン
            opacity: 0.3,
            density: 0.8,
            spread: 1.2,
            flow: 0.5,
            blendMode: PIXI.BLEND_MODES.MULTIPLY
        });
        
        // 消しゴムツール設定
        this.toolConfigs.set('eraser', {
            type: 'eraser',
            size: 16,
            opacity: 1.0,
            hardness: 0.8,
            blendMode: PIXI.BLEND_MODES.MULTIPLY,
            destinationOut: true
        });
        
        // 選択ツール設定
        this.toolConfigs.set('select', {
            type: 'select',
            selectionType: 'rectangle', // rectangle, ellipse, lasso
            strokeColor: 0xffffee, // ふたば背景色
            strokeWidth: 2,
            dashLength: 8,
            animated: true
        });
        
        // ボカシツール設定
        this.toolConfigs.set('blur', {
            type: 'blur',
            size: 20,
            intensity: 0.5,
            quality: 4,
            kernelSize: 5
        });
    }
    
    /**
     * PixiJS描画最適化設定
     */
    setupPixiOptimizations() {
        // 描画コンテナ最適化
        this.drawingContainer.cullable = true;
        this.drawingContainer.interactiveChildren = false;
        
        // プレビューコンテナ最適化
        this.previewContainer.alpha = 0.8;
        this.previewContainer.blendMode = PIXI.BLEND_MODES.NORMAL;
        
        // レンダリング最適化
        this.app.renderer.roundPixels = true;
        this.app.renderer.antialias = true;
        
        // タイカー設定（60fps制限）
        this.renderTicker = this.app.ticker.add(() => {
            this.updateDrawingPreview();
        });
        this.renderTicker.maxFPS = 60;
    }
    
    /**
     * イベントリスナー設定
     */
    setupEventListeners() {
        // 描画開始
        this.eventStore.on('draw:start', (data) => {
            this.startDrawing(data);
        });
        
        // 描画継続
        this.eventStore.on('draw:continue', (data) => {
            this.continueDrawing(data);
        });
        
        // 描画終了
        this.eventStore.on('draw:end', (data) => {
            this.endDrawing(data);
        });
        
        // ツール切り替え
        this.eventStore.on('tool:change', (data) => {
            this.changeTool(data.tool, data.config);
        });
        
        // ツール設定更新
        this.eventStore.on('tool:config:update', (data) => {
            this.updateToolConfig(data.tool, data.config);
        });
    }
    
    /**
     * ツールUI連携設定
     */
    setupToolUI() {
        // ツールプレビュー更新
        this.eventStore.on('tool:preview:update', (data) => {
            this.updateToolPreview(data);
        });
        
        // カーソル更新
        this.eventStore.on('tool:cursor:update', () => {
            this.updateCursor();
        });
    }
    
    /**
     * 描画開始処理
     */
    startDrawing(data) {
        if (this.isDrawing) return;
        
        const pixiPos = this.coordinate.screenToPixi(data.x, data.y);
        this.isDrawing = true;
        this.currentPath = [pixiPos];
        this.pressurePoints = [data.pressure || 1.0];
        
        // ツール別描画開始処理
        switch (this.currentTool) {
            case 'pen':
                this.startPenDrawing(pixiPos, data.pressure);
                break;
            case 'airbrush':
                this.startAirbrushDrawing(pixiPos);
                break;
            case 'eraser':
                this.startEraserDrawing(pixiPos);
                break;
            case 'select':
                this.startSelection(pixiPos);
                break;
            case 'blur':
                this.startBlurring(pixiPos);
                break;
        }
        
        // 描画開始イベント発信
        this.eventStore.emit('tool:drawing:started', {
            tool: this.currentTool,
            position: pixiPos,
            config: this.getCurrentToolConfig()
        });
    }
    
    /**
     * 描画継続処理
     */
    continueDrawing(data) {
        if (!this.isDrawing) return;
        
        const pixiPos = this.coordinate.screenToPixi(data.x, data.y);
        this.currentPath.push(pixiPos);
        this.pressurePoints.push(data.pressure || 1.0);
        
        // ツール別描画継続処理
        switch (this.currentTool) {
            case 'pen':
                this.continuePenDrawing(pixiPos, data.pressure);
                break;
            case 'airbrush':
                this.continueAirbrushDrawing(pixiPos);
                break;
            case 'eraser':
                this.continueEraserDrawing(pixiPos);
                break;
            case 'select':
                this.continueSelection(pixiPos);
                break;
            case 'blur':
                this.continueBlurring(pixiPos);
                break;
        }
    }
    
    /**
     * 描画終了処理
     */
    endDrawing(data) {
        if (!this.isDrawing) return;
        
        const pixiPos = this.coordinate.screenToPixi(data.x, data.y);
        this.currentPath.push(pixiPos);
        this.pressurePoints.push(data.pressure || 1.0);
        
        // ツール別描画終了処理
        switch (this.currentTool) {
            case 'pen':
                this.endPenDrawing();
                break;
            case 'airbrush':
                this.endAirbrushDrawing();
                break;
            case 'eraser':
                this.endEraserDrawing();
                break;
            case 'select':
                this.endSelection();
                break;
            case 'blur':
                this.endBlurring();
                break;
        }
        
        // 描画状態リセット
        this.isDrawing = false;
        this.currentPath = [];
        this.pressurePoints = [];
        this.clearPreview();
        
        // 描画終了イベント発信
        this.eventStore.emit('tool:drawing:ended', {
            tool: this.currentTool,
            strokeData: this.getLastStrokeData()
        });
    }
    
    /**
     * ペン描画開始
     */
    startPenDrawing(position, pressure = 1.0) {
        const config = this.getCurrentToolConfig();
        
        // PixiJS Graphics作成
        this.currentStroke = new PIXI.Graphics();
        this.drawingContainer.addChild(this.currentStroke);
        
        // 筆圧対応サイズ計算
        const adjustedSize = config.pressureSensitive ? 
            config.size * pressure : config.size;
        
        // PixiJS線スタイル設定
        this.currentStroke.lineStyle({
            width: adjustedSize,
            color: config.color,
            alpha: config.opacity,
            cap: config.capStyle,
            join: config.joinStyle,
            native: this.app.renderer.type === PIXI.RENDERER_TYPE.WEBGPU
        });
        
        // 描画開始点
        this.currentStroke.moveTo(position.x, position.y);
        
        // プレビュー作成
        this.createPenPreview(position, adjustedSize);
    }
    
    /**
     * ペン描画継続
     */
    continuePenDrawing(position, pressure = 1.0) {
        if (!this.currentStroke) return;
        
        const config = this.getCurrentToolConfig();
        const smoothedPath = this.applySmoothingFilter(this.currentPath, config.smoothing);
        
        // スムーズ曲線描画（PixiJS quadraticCurveTo活用）
        if (smoothedPath.length >= 3) {
            const prev = smoothedPath[smoothedPath.length - 3];
            const curr = smoothedPath[smoothedPath.length - 2];
            const next = smoothedPath[smoothedPath.length - 1];
            
            const controlX = (prev.x + curr.x) / 2;
            const controlY = (prev.y + curr.y) / 2;
            
            this.currentStroke.quadraticCurveTo(
                controlX, controlY, 
                curr.x, curr.y
            );
        } else {
            this.currentStroke.lineTo(position.x, position.y);
        }
        
        // 筆圧対応動的サイズ調整
        if (config.pressureSensitive && this.pressurePoints.length >= 2) {
            this.adjustStrokeWidth(pressure);
        }
    }
    
    /**
     * ペン描画終了
     */
    endPenDrawing() {
        if (!this.currentStroke) return;
        
        // 最終点描画
        const lastPoint = this.currentPath[this.currentPath.length - 1];
        this.currentStroke.lineTo(lastPoint.x, lastPoint.y);
        
        // ストローク履歴保存（ベクター非破壊）
        this.saveStrokeToHistory(this.currentStroke, 'pen');
        
        this.currentStroke = null;
    }
    
    /**
     * エアスプレー描画開始
     */
    startAirbrushDrawing(position) {
        const config = this.getCurrentToolConfig();
        
        this.currentStroke = new PIXI.Graphics();
        this.drawingContainer.addChild(this.currentStroke);
        
        // エアスプレーパーティクル描画開始
        this.startAirbrushParticles(position, config);
    }
    
    /**
     * エアスプレー描画継続
     */
    continueAirbrushDrawing(position) {
        const config = this.getCurrentToolConfig();
        this.drawAirbrushParticles(position, config);
    }
    
    /**
     * エアスプレー描画終了
     */
    endAirbrushDrawing() {
        this.saveStrokeToHistory(this.currentStroke, 'airbrush');
        this.currentStroke = null;
    }
    
    /**
     * エアスプレーパーティクル描画
     */
    drawAirbrushParticles(center, config) {
        const particleCount = Math.floor(config.density * 20);
        
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * config.size * config.spread;
            const opacity = Math.random() * config.opacity * config.flow;
            
            const x = center.x + Math.cos(angle) * distance;
            const y = center.y + Math.sin(angle) * distance;
            
            this.currentStroke.beginFill(config.color, opacity);
            this.currentStroke.drawCircle(x, y, Math.random() * 2 + 1);
            this.currentStroke.endFill();
        }
    }
    
    /**
     * 消しゴム描画処理
     */
    startEraserDrawing(position) {
        const config = this.getCurrentToolConfig();
        
        this.currentStroke = new PIXI.Graphics();
        this.currentStroke.blendMode = PIXI.BLEND_MODES.MULTIPLY;
        this.drawingContainer.addChild(this.currentStroke);
        
        // 消しゴム専用マスク作成
        this.createEraserMask(position, config);
    }
    
    continueEraserDrawing(position) {
        const config = this.getCurrentToolConfig();
        this.expandEraserMask(position, config);
    }
    
    endEraserDrawing() {
        this.applyEraserMask();
        this.saveStrokeToHistory(this.currentStroke, 'eraser');
        this.currentStroke = null;
    }
    
    /**
     * 選択ツール処理
     */
    startSelection(position) {
        this.clearSelection();
        
        this.selectionBox = new PIXI.Graphics();
        this.previewContainer.addChild(this.selectionBox);
        
        this.selectionStart = position;
        this.selectionCurrent = position;
        
        this.drawSelectionBox();
    }
    
    continueSelection(position) {
        this.selectionCurrent = position;
        this.drawSelectionBox();
    }
    
    endSelection() {
        if (this.selectionBox) {
            const bounds = this.getSelectionBounds();
            this.eventStore.emit('selection:created', { bounds });
        }
    }
    
    /**
     * 選択範囲描画
     */
    drawSelectionBox() {
        if (!this.selectionBox || !this.selectionStart || !this.selectionCurrent) return;
        
        const config = this.getCurrentToolConfig();
        this.selectionBox.clear();
        
        const x1 = Math.min(this.selectionStart.x, this.selectionCurrent.x);
        const y1 = Math.min(this.selectionStart.y, this.selectionCurrent.y);
        const x2 = Math.max(this.selectionStart.x, this.selectionCurrent.x);
        const y2 = Math.max(this.selectionStart.y, this.selectionCurrent.y);
        
        // 点線選択枠描画
        this.selectionBox.lineStyle({
            width: config.strokeWidth,
            color: config.strokeColor,
            alpha: 0.8
        });
        
        // アニメ付き点線効果
        const dashOffset = config.animated ? 
            (Date.now() / 100) % (config.dashLength * 2) : 0;
        
        this.drawDashedRectangle(x1, y1, x2 - x1, y2 - y1, config.dashLength, dashOffset);
    }
    
    /**
     * 点線矩形描画
     */
    drawDashedRectangle(x, y, width, height, dashLength, offset = 0) {
        const perimeter = (width + height) * 2;
        let currentDistance = -offset;
        let drawing = true;
        
        const points = [
            { x: x, y: y },
            { x: x + width, y: y },
            { x: x + width, y: y + height },
            { x: x, y: y + height },
            { x: x, y: y }
        ];
        
        for (let i = 0; i < points.length - 1; i++) {
            const start = points[i];
            const end = points[i + 1];
            this.drawDashedLine(start, end, dashLength, currentDistance, drawing);
        }
    }
    
    /**
     * 点線描画
     */
    drawDashedLine(start, end, dashLength, startDistance, startDrawing) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const unitX = dx / length;
        const unitY = dy / length;
        
        let currentDistance = startDistance;
        let drawing = startDrawing;
        let currentPos = { x: start.x, y: start.y };
        
        while (currentDistance < length) {
            const nextDistance = Math.min(currentDistance + dashLength, length);
            const nextPos = {
                x: start.x + unitX * nextDistance,
                y: start.y + unitY * nextDistance
            };
            
            if (drawing) {
                this.selectionBox.moveTo(currentPos.x, currentPos.y);
                this.selectionBox.lineTo(nextPos.x, nextPos.y);
            }
            
            drawing = !drawing;
            currentDistance = nextDistance;
            currentPos = nextPos;
        }
    }
    
    /**
     * スムージングフィルター
     */
    applySmoothingFilter(path, smoothing) {
        if (path.length < 3 || smoothing <= 0) return path;
        
        const smoothedPath = [path[0]];
        
        for (let i = 1; i < path.length - 1; i++) {
            const prev = path[i - 1];
            const curr = path[i];
            const next = path[i + 1];
            
            const smoothedPoint = {
                x: curr.x * (1 - smoothing) + 
                   (prev.x + next.x) * smoothing / 2,
                y: curr.y * (1 - smoothing) + 
                   (prev.y + next.y) * smoothing / 2
            };
            
            smoothedPath.push(smoothedPoint);
        }
        
        smoothedPath.push(path[path.length - 1]);
        return smoothedPath;
    }
    
    /**
     * ツール変更
     */
    changeTool(tool, config = null) {
        if (this.isDrawing) {
            this.endDrawing({ x: 0, y: 0 });
        }
        
        this.currentTool = tool;
        
        if (config) {
            this.toolConfigs.set(tool, { ...this.toolConfigs.get(tool), ...config });
        }
        
        this.updateCursor();
        this.eventStore.emit('tool:changed', { tool, config: this.getCurrentToolConfig() });
    }
    
    /**
     * ツール設定更新
     */
    updateToolConfig(tool, config) {
        if (this.toolConfigs.has(tool)) {
            const currentConfig = this.toolConfigs.get(tool);
            this.toolConfigs.set(tool, { ...currentConfig, ...config });
            
            if (tool === this.currentTool) {
                this.updateCursor();
            }
            
            this.eventStore.emit('tool:config:updated', { tool, config: this.toolConfigs.get(tool) });
        }
    }
    
    /**
     * 現在のツール設定取得
     */
    getCurrentToolConfig() {
        return this.toolConfigs.get(this.currentTool) || {};
    }
    
    /**
     * カーソル更新
     */
    updateCursor() {
        const config = this.getCurrentToolConfig();
        const canvas = this.app.view;
        
        switch (this.currentTool) {
            case 'pen':
                canvas.style.cursor = `crosshair`;
                break;
            case 'airbrush':
                canvas.style.cursor = `crosshair`;
                break;
            case 'eraser':
                canvas.style.cursor = `crosshair`;
                break;
            case 'select':
                canvas.style.cursor = `crosshair`;
                break;
            default:
                canvas.style.cursor = `default`;
        }
    }
    
    /**
     * ストローク履歴保存（ベクター非破壊）
     */
    saveStrokeToHistory(graphics, toolType) {
        const strokeData = {
            id: this.generateStrokeId(),
            type: toolType,
            graphics: graphics,
            path: [...this.currentPath],
            pressurePoints: [...this.pressurePoints],
            config: { ...this.getCurrentToolConfig() },
            timestamp: Date.now(),
            bounds: graphics.getBounds()
        };
        
        this.strokeHistory.push(strokeData);
        
        // 履歴サイズ制限
        if (this.strokeHistory.length > 100) {
            this.strokeHistory = this.strokeHistory.slice(-80);
        }
        
        this.eventStore.emit('stroke:saved', strokeData);
    }
    
    /**
     * ストロークID生成
     */
    generateStrokeId() {
        return 'stroke_' + Date.now().toString(36) + '_' + 
               Math.random().toString(36).substr(2, 5);
    }
    
    /**
     * 最後のストロークデータ取得
     */
    getLastStrokeData() {
        return this.strokeHistory[this.strokeHistory.length - 1] || null;
    }
    
    /**
     * プレビュークリア
     */
    clearPreview() {
        this.previewContainer.removeChildren();
    }
    
    /**
     * 選択クリア
     */
    clearSelection() {
        if (this.selectionBox) {
            this.selectionBox.destroy();
            this.selectionBox = null;
        }
        this.selectionStart = null;
        this.selectionCurrent = null;
    }
    
    /**
     * 選択範囲取得
     */
    getSelectionBounds() {
        if (!this.selectionStart || !this.selectionCurrent) return null;
        
        return new PIXI.Rectangle(
            Math.min(this.selectionStart.x, this.selectionCurrent.x),
            Math.min(this.selectionStart.y, this.selectionCurrent.y),
            Math.abs(this.selectionCurrent.x - this.selectionStart.x),
            Math.abs(this.selectionCurrent.y - this.selectionStart.y)
        );
    }
    
    /**
     * 描画プレビュー更新
     */
    updateDrawingPreview() {
        // リアルタイムプレビュー更新（60fps制限）
        if (this.isDrawing && this.currentStroke) {
            // 描画範囲最適化
            this.updateDrawingBounds();
        }
    }
    
    /**
     * 描画範囲更新（最適化）
     */
    updateDrawingBounds() {
        if (this.currentPath.length > 0) {
            const points = this.currentPath;
            let minX = points[0].x, maxX = points[0].x;
            let minY = points[0].y, maxY = points[0].y;
            
            points.forEach(point => {
                minX = Math.min(minX, point.x);
                maxX = Math.max(maxX, point.x);
                minY = Math.min(minY, point.y);
                maxY = Math.max(maxY, point.y);
            });
            
            const config = this.getCurrentToolConfig();
            const margin = config.size || 10;
            
            this.drawingBounds.x = minX - margin;
            this.drawingBounds.y = minY - margin;
            this.drawingBounds.width = (maxX - minX) + margin * 2;
            this.drawingBounds.height = (maxY - minY) + margin * 2;
        }
    }
    
    /**
     * エアスプレーパーティクル開始
     */
    startAirbrushParticles(position, config) {
        this.airbrushTimer = setInterval(() => {
            if (this.isDrawing && this.currentTool === 'airbrush') {
                this.drawAirbrushParticles(position, config);
            }
        }, 16); // 60fps
    }
    
    /**
     * 消しゴムマスク作成
     */
    createEraserMask(position, config) {
        this.currentStroke.lineStyle({
            width: config.size,
            color: 0xffffff,
            alpha: config.opacity
        });
        this.currentStroke.moveTo(position.x, position.y);
    }
    
    /**
     * 消しゴムマスク拡張
     */
    expandEraserMask(position, config) {
        this.currentStroke.lineStyle({
            width: config.size,
            color: 0xffffff,
            alpha: config.opacity,
            cap: PIXI.LINE_CAP.ROUND
        });
        this.currentStroke.lineTo(position.x, position.y);
    }
    
    /**
     * 消しゴムマスク適用
     */
    applyEraserMask() {
        // 消しゴム効果をレイヤーに適用
        if (this.currentStroke && this.drawingContainer.children.length > 1) {
            // 合成モード設定で消去効果実現
            this.currentStroke.blendMode = PIXI.BLEND_MODES.MULTIPLY;
        }
    }
    
    /**
     * ペンプレビュー作成
     */
    createPenPreview(position, size) {
        const preview = new PIXI.Graphics();
        preview.lineStyle({
            width: 2,
            color: 0xffffee,
            alpha: 0.5
        });
        preview.drawCircle(position.x, position.y, size / 2);
        this.previewContainer.addChild(preview);
    }
    
    /**
     * 筆圧対応ストローク幅調整
     */
    adjustStrokeWidth(pressure) {
        const config = this.getCurrentToolConfig();
        const baseWidth = config.size;
        const adjustedWidth = baseWidth * pressure;
        
        // PixiJS Graphics動的幅調整（近似実装）
        if (this.currentStroke && this.currentPath.length > 1) {
            const lastPoint = this.currentPath[this.currentPath.length - 1];
            const prevPoint = this.currentPath[this.currentPath.length - 2];
            
            // 新しい線分を調整された幅で描画
            const tempGraphics = new PIXI.Graphics();
            tempGraphics.lineStyle({
                width: adjustedWidth,
                color: config.color,
                alpha: config.opacity,
                cap: config.capStyle,
                join: config.joinStyle
            });
            
            tempGraphics.moveTo(prevPoint.x, prevPoint.y);
            tempGraphics.lineTo(lastPoint.x, lastPoint.y);
            
            this.drawingContainer.addChild(tempGraphics);
        }
    }
    
    /**
     * ツール情報取得
     */
    getToolInfo() {
        return {
            currentTool: this.currentTool,
            isDrawing: this.isDrawing,
            availableTools: Array.from(this.toolConfigs.keys()),
            strokeCount: this.strokeHistory.length,
            drawingBounds: {
                x: this.drawingBounds.x,
                y: this.drawingBounds.y,
                width: this.drawingBounds.width,
                height: this.drawingBounds.height
            }
        };
    }
    
    /**
     * パフォーマンス情報取得
     */
    getPerformanceInfo() {
        return {
            drawingObjects: this.drawingContainer.children.length,
            previewObjects: this.previewContainer.children.length,
            strokeHistory: this.strokeHistory.length,
            memoryUsage: this.estimateMemoryUsage(),
            renderFPS: this.app.ticker.FPS
        };
    }
    
    /**
     * メモリ使用量推定
     */
    estimateMemoryUsage() {
        let totalVertices = 0;
        
        this.drawingContainer.children.forEach(child => {
            if (child instanceof PIXI.Graphics) {
                totalVertices += child.geometry?.graphicsData?.length || 0;
            }
        });
        
        return {
            vertices: totalVertices,
            estimatedMB: Math.round(totalVertices * 0.001 * 100) / 100
        };
    }
    
    /**
     * ツールリセット
     */
    resetTools() {
        // Description: ツール状態を初期化
        if (this.isDrawing) {
            this.endDrawing({ x: 0, y: 0 });
        }
        
        this.clearPreview();
        this.clearSelection();
        
        if (this.airbrushTimer) {
            clearInterval(this.airbrushTimer);
            this.airbrushTimer = null;
        }
        
        this.currentTool = 'pen';
        this.isDrawing = false;
        this.currentStroke = null;
        this.currentPath = [];
        this.pressurePoints = [];
        
        console.log('🎨 PixiToolProcessor リセット完了');
    }
    
    /**
     * 描画クリア
     */
    clearDrawing() {
        this.drawingContainer.removeChildren();
        this.strokeHistory = [];
        this.clearPreview();
        this.clearSelection();
        
        this.eventStore.emit('drawing:cleared');
        console.log('🎨 描画内容クリア完了');
    }
    
    /**
     * 破棄処理
     */
    destroy() {
        try {
            // タイマー停止
            if (this.airbrushTimer) {
                clearInterval(this.airbrushTimer);
            }
            
            // レンダーティッカー停止
            if (this.renderTicker) {
                this.app.ticker.remove(this.renderTicker);
            }
            
            // PixiJSコンテナ破棄
            this.drawingContainer.destroy({ children: true });
            this.previewContainer.destroy({ children: true });
            
            // 履歴クリア
            this.strokeHistory = [];
            this.currentPath = [];
            this.pressurePoints = [];
            
            console.log('🎨 PixiToolProcessor破棄完了');
            
        } catch (error) {
            console.error('❌ PixiToolProcessor破棄エラー:', error);
        }
    }
}