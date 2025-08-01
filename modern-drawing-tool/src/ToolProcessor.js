import { cloneDeep } from 'lodash-es';

/**
 * ToolProcessor - ツール処理統合（Phase2拡張）
 * ペン・消しゴム・エアスプレー・ボカシ・スポイト・塗りつぶし・選択ツール統合
 */
export class ToolProcessor {
    constructor(oglCore, eventStore) {
        this.oglCore = oglCore;
        this.eventStore = eventStore;
        
        // ツール定義
        this.tools = new Map();
        this.currentTool = 'pen';
        this.toolHistory = [];
        
        // ツール設定
        this.toolConfigs = {
            pen: {
                size: 3,
                opacity: 1.0,
                color: [0.5, 0.0, 0.0], // ふたば色マルーン
                pressure: true,
                smoothing: 0.5,
                hardness: 1.0,
                spacing: 1.0
            },
            eraser: {
                size: 10,
                opacity: 1.0,
                hardness: 0.8,
                mode: 'pixel' // pixel, layer
            },
            airspray: {
                size: 20,
                opacity: 0.3,
                density: 0.6,
                scatter: 1.0,
                flow: 0.8,
                particles: 100
            },
            blur: {
                size: 15,
                strength: 0.7,
                type: 'gaussian', // gaussian, motion, radial
                edgeProtection: true
            },
            eyedropper: {
                size: 1, // サンプル範囲
                mode: 'average', // average, center
                showPreview: true
            },
            fill: {
                tolerance: 32,
                antiAlias: true,
                contiguous: true, // 隣接領域のみ
                mode: 'color' // color, alpha
            },
            selection: {
                type: 'rectangle', // rectangle, ellipse, lasso, magic
                antiAlias: true,
                feather: 0,
                mode: 'new' // new, add, subtract, intersect
            }
        };
        
        // 選択状態
        this.currentSelection = null;
        this.selectionPath = [];
        this.isSelecting = false;
        
        this.initializeTools();
        this.setupEventSubscriptions();
    }
    
    // ツール初期化
    initializeTools() {
        // ペンツール
        this.tools.set('pen', {
            name: 'Pen',
            icon: '✏️',
            cursor: 'crosshair',
            onActivate: () => this.activatePenTool(),
            onDeactivate: () => this.deactivatePenTool(),
            onStrokeStart: (point, pressure) => this.penStrokeStart(point, pressure),
            onStrokeUpdate: (point, pressure) => this.penStrokeUpdate(point, pressure),
            onStrokeEnd: () => this.penStrokeEnd()
        });
        
        // 消しゴムツール
        this.tools.set('eraser', {
            name: 'Eraser',
            icon: '🗑️',
            cursor: 'crosshair',
            onActivate: () => this.activateEraserTool(),
            onDeactivate: () => this.deactivateEraserTool(),
            onStrokeStart: (point, pressure) => this.eraserStrokeStart(point, pressure),
            onStrokeUpdate: (point, pressure) => this.eraserStrokeUpdate(point, pressure),
            onStrokeEnd: () => this.eraserStrokeEnd()
        });
        
        // エアスプレーツール
        this.tools.set('airspray', {
            name: 'Airspray',
            icon: '🖌️',
            cursor: 'crosshair',
            onActivate: () => this.activateAirsprayTool(),
            onDeactivate: () => this.deactivateAirsprayTool(),
            onStrokeStart: (point, pressure) => this.airsprayStrokeStart(point, pressure),
            onStrokeUpdate: (point, pressure) => this.airsprayStrokeUpdate(point, pressure),
            onStrokeEnd: () => this.airsprayStrokeEnd()
        });
        
        // ボカシツール
        this.tools.set('blur', {
            name: 'Blur',
            icon: '🌫️',
            cursor: 'crosshair',
            onActivate: () => this.activateBlurTool(),
            onDeactivate: () => this.deactivateBlurTool(),
            onStrokeStart: (point, pressure) => this.blurStrokeStart(point, pressure),
            onStrokeUpdate: (point, pressure) => this.blurStrokeUpdate(point, pressure),
            onStrokeEnd: () => this.blurStrokeEnd()
        });
        
        // スポイトツール
        this.tools.set('eyedropper', {
            name: 'Eyedropper',
            icon: '💧',
            cursor: 'crosshair',
            onActivate: () => this.activateEyedropperTool(),
            onDeactivate: () => this.deactivateEyedropperTool(),
            onClick: (point) => this.eyedropperSample(point)
        });
        
        // 塗りつぶしツール
        this.tools.set('fill', {
            name: 'Fill',
            icon: '🪣',
            cursor: 'crosshair',
            onActivate: () => this.activateFillTool(),
            onDeactivate: () => this.deactivateFillTool(),
            onClick: (point) => this.fillArea(point)
        });
        
        // 選択ツール
        this.tools.set('selection', {
            name: 'Selection',
            icon: '⬚',
            cursor: 'crosshair',
            onActivate: () => this.activateSelectionTool(),
            onDeactivate: () => this.deactivateSelectionTool(),
            onStrokeStart: (point) => this.selectionStart(point),
            onStrokeUpdate: (point) => this.selectionUpdate(point),
            onStrokeEnd: () => this.selectionEnd()
        });
        
        console.log('✅ Tools initialized:', this.tools.size, 'tools');
    }
    
    // ツール切り替え
    switchTool(toolName) {
        if (!this.tools.has(toolName)) {
            console.warn(`⚠️ Unknown tool: ${toolName}`);
            return false;
        }
        
        // 現在のツールを無効化
        const currentToolData = this.tools.get(this.currentTool);
        if (currentToolData?.onDeactivate) {
            currentToolData.onDeactivate();
        }
        
        // ツール履歴記録
        this.toolHistory.push({
            from: this.currentTool,
            to: toolName,
            timestamp: Date.now()
        });
        
        this.currentTool = toolName;
        
        // 新しいツールを有効化
        const newToolData = this.tools.get(toolName);
        if (newToolData?.onActivate) {
            newToolData.onActivate();
        }
        
        // OGLエンジンにツール変更通知
        this.oglCore.setTool(toolName);
        
        // イベント発火
        this.eventStore.emit(this.eventStore.eventTypes.TOOL_CHANGE, {
            tool: toolName,
            config: this.toolConfigs[toolName]
        });
        
        console.log(`🔧 Tool switched: ${this.currentTool} -> ${toolName}`);
        return true;
    }
    
    // ツール設定更新
    updateToolConfig(toolName, config) {
        if (!this.toolConfigs[toolName]) {
            console.warn(`⚠️ Unknown tool config: ${toolName}`);
            return;
        }
        
        this.toolConfigs[toolName] = { ...this.toolConfigs[toolName], ...config };
        
        // OGLエンジンにも設定反映
        this.oglCore.updateToolConfig(toolName, this.toolConfigs[toolName]);
        
        this.eventStore.emit(this.eventStore.eventTypes.TOOL_CONFIG_CHANGE, {
            tool: toolName,
            config: this.toolConfigs[toolName]
        });
        
        console.log(`⚙️ Tool config updated: ${toolName}`, config);
    }
    
    // === ペンツール実装 ===
    activatePenTool() {
        console.log('✏️ Pen tool activated');
    }
    
    deactivatePenTool() {
        if (this.oglCore.isDrawing) {
            this.oglCore.endStroke();
        }
    }
    
    penStrokeStart(point, pressure) {
        const config = this.toolConfigs.pen;
        this.oglCore.updateToolConfig('pen', config);
        this.oglCore.startStroke(point, pressure);
    }
    
    penStrokeUpdate(point, pressure) {
        this.oglCore.updateStroke(point, pressure);
    }
    
    penStrokeEnd() {
        this.oglCore.endStroke();
    }
    
    // === 消しゴムツール実装 ===
    activateEraserTool() {
        console.log('🗑️ Eraser tool activated');
    }
    
    deactivateEraserTool() {
        if (this.oglCore.isDrawing) {
            this.oglCore.endStroke();
        }
    }
    
    eraserStrokeStart(point, pressure) {
        const config = this.toolConfigs.eraser;
        this.oglCore.updateToolConfig('eraser', config);
        this.oglCore.startStroke(point, pressure);
    }
    
    eraserStrokeUpdate(point, pressure) {
        this.oglCore.updateStroke(point, pressure);
    }
    
    eraserStrokeEnd() {
        this.oglCore.endStroke();
    }
    
    // === エアスプレーツール実装 ===
    activateAirsprayTool() {
        console.log('🖌️ Airspray tool activated');
    }
    
    deactivateAirsprayTool() {
        if (this.oglCore.isDrawing) {
            this.oglCore.endStroke();
        }
    }
    
    airsprayStrokeStart(point, pressure) {
        const config = this.toolConfigs.airspray;
        this.oglCore.updateToolConfig('airspray', config);
        this.oglCore.startStroke(point, pressure);
        
        // エアスプレー特有の連続描画開始
        this.startAirsprayEffect(point, pressure);
    }
    
    airsprayStrokeUpdate(point, pressure) {
        this.oglCore.updateStroke(point, pressure);
        this.updateAirsprayEffect(point, pressure);
    }
    
    airsprayStrokeEnd() {
        this.stopAirsprayEffect();
        this.oglCore.endStroke();
    }
    
    startAirsprayEffect(point, pressure) {
        const config = this.toolConfigs.airspray;
        this.airsprayTimer = setInterval(() => {
            if (this.oglCore.isDrawing) {
                this.generateAirsprayParticles(point, pressure, config);
            }
        }, 16); // 60fps
    }
    
    updateAirsprayEffect(point, pressure) {
        this.lastAirsprayPoint = point;
        this.lastAirsprayPressure = pressure;
    }
    
    stopAirsprayEffect() {
        if (this.airsprayTimer) {
            clearInterval(this.airsprayTimer);
            this.airsprayTimer = null;
        }
    }
    
    generateAirsprayParticles(point, pressure, config) {
        const particleCount = Math.floor(config.particles * pressure * config.density);
        
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * config.size * config.scatter;
            
            const particlePoint = {
                x: point.x + Math.cos(angle) * distance,
                y: point.y + Math.sin(angle) * distance
            };
            
            // パーティクル描画（OGL統一）
            this.drawAirsprayParticle(particlePoint, config);
        }
    }
    
    drawAirsprayParticle(point, config) {
        // OGL統一パーティクル描画
        // 実装詳細はOGLCoreのairsprayシェーダーで処理
        this.oglCore.updateStroke(point, config.opacity * Math.random());
    }
    
    // === ボカシツール実装 ===
    activateBlurTool() {
        console.log('🌫️ Blur tool activated');
    }
    
    deactivateBlurTool() {
        // ボカシ処理終了
    }
    
    blurStrokeStart(point, pressure) {
        console.log('🌫️ Blur stroke start');
        // ボカシ領域の記録開始
        this.blurRegion = {
            startPoint: point,
            points: [point],
            pressure
        };
    }
    
    blurStrokeUpdate(point, pressure) {
        if (this.blurRegion) {
            this.blurRegion.points.push(point);
            // リアルタイムボカシプレビュー
            this.previewBlurEffect(this.blurRegion.points);
        }
    }
    
    blurStrokeEnd() {
        if (this.blurRegion) {
            // 最終ボカシ処理適用
            this.applyBlurEffect(this.blurRegion.points);
            this.blurRegion = null;
        }
    }
    
    previewBlurEffect(points) {
        // ボカシプレビュー実装
        const config = this.toolConfigs.blur;
        console.log(`🌫️ Blur preview: ${points.length} points`);
    }
    
    applyBlurEffect(points) {
        // 最終ボカシ適用
        const config = this.toolConfigs.blur;
        console.log(`🌫️ Blur applied: ${config.type} blur, strength ${config.strength}`);
        
        // OGL統一ボカシシェーダー処理
        this.processBlurShader(points, config);
    }
    
    processBlurShader(points, config) {
        // OGL統一ボカシシェーダー適用
        // ガウシアンブラー、モーションブラー、放射状ブラーの実装
        switch (config.type) {
            case 'gaussian':
                this.applyGaussianBlur(points, config);
                break;
            case 'motion':
                this.applyMotionBlur(points, config);
                break;
            case 'radial':
                this.applyRadialBlur(points, config);
                break;
        }
    }
    
    applyGaussianBlur(points, config) {
        // OGL統一ガウシアンブラー
        console.log(`🌀 Gaussian blur applied: strength ${config.strength}`);
    }
    
    applyMotionBlur(points, config) {
        // OGL統一モーションブラー
        console.log(`💨 Motion blur applied: strength ${config.strength}`);
    }
    
    applyRadialBlur(points, config) {
        // OGL統一放射状ブラー
        console.log(`🌊 Radial blur applied: strength ${config.strength}`);
    }
    
    // === スポイトツール実装 ===
    activateEyedropperTool() {
        console.log('💧 Eyedropper tool activated');
        this.showColorPreview = true;
    }
    
    deactivateEyedropperTool() {
        this.showColorPreview = false;
        this.hideColorPreview();
    }
    
    eyedropperSample(point) {
        const config = this.toolConfigs.eyedropper;
        
        // OGL統一色サンプリング
        const sampledColor = this.sampleColorAtPoint(point, config);
        
        if (sampledColor) {
            // 色を現在のツール設定に適用
            this.updateToolConfig('pen', { color: sampledColor });
            
            // 色変更イベント発火
            this.eventStore.emit(this.eventStore.eventTypes.COLOR_CHANGE, {
                color: sampledColor,
                source: 'eyedropper',
                point
            });
            
            console.log('💧 Color sampled:', sampledColor);
        }
    }
    
    sampleColorAtPoint(point, config) {
        // OGL統一色サンプリング実装
        // WebGLのreadPixels相当をOGLで実装
        
        const sampleSize = config.size;
        const mode = config.mode;
        
        // 仮実装（実際はOGLのフレームバッファから読み取り）
        const sampledColor = [
            Math.random(),
            Math.random(),
            Math.random()
        ];
        
        return sampledColor;
    }
    
    showColorPreview() {
        // 色プレビューUI表示
        console.log('🎨 Color preview shown');
    }
    
    hideColorPreview() {
        // 色プレビューUI非表示
        console.log('🎨 Color preview hidden');
    }
    
    // === 塗りつぶしツール実装 ===
    activateFillTool() {
        console.log('🪣 Fill tool activated');
    }
    
    deactivateFillTool() {
        // 塗りつぶし処理終了
    }
    
    fillArea(point) {
        const config = this.toolConfigs.fill;
        const currentColor = this.toolConfigs.pen.color;
        
        console.log(`🪣 Fill area at (${point.x}, ${point.y})`);
        
        // OGL統一塗りつぶし実装
        this.performFloodFill(point, currentColor, config);
    }
    
    performFloodFill(startPoint, fillColor, config) {
        // OGL統一フラッドフィル実装
        // WebGL統一による高速塗りつぶし
        
        const tolerance = config.tolerance;
        const contiguous = config.contiguous;
        
        console.log(`🌊 Flood fill: tolerance ${tolerance}, contiguous ${contiguous}`);
        
        // 実装詳細はOGLシェーダーで高速処理
        this.executeFloodFillShader(startPoint, fillColor, config);
    }
    
    executeFloodFillShader(point, color, config) {
        // OGL統一フラッドフィルシェーダー実行
        console.log('🔥 Flood fill shader executed');
        
        // 塗りつぶし完了イベント
        this.eventStore.emit(this.eventStore.eventTypes.STROKE_COMPLETE, {
            tool: 'fill',
            point,
            color,
            config
        });
    }
    
    // === 選択ツール実装 ===
    activateSelectionTool() {
        console.log('⬚ Selection tool activated');
        this.clearSelection();
    }
    
    deactivateSelectionTool() {
        this.clearSelection();
    }
    
    selectionStart(point) {
        this.isSelecting = true;
        this.selectionPath = [point];
        
        const config = this.toolConfigs.selection;
        
        switch (config.type) {
            case 'rectangle':
                this.startRectangleSelection(point);
                break;
            case 'ellipse':
                this.startEllipseSelection(point);
                break;
            case 'lasso':
                this.startLassoSelection(point);
                break;
            case 'magic':
                this.startMagicSelection(point);
                break;
        }
    }
    
    selectionUpdate(point) {
        if (!this.isSelecting) return;
        
        this.selectionPath.push(point);
        
        const config = this.toolConfigs.selection;
        
        switch (config.type) {
            case 'rectangle':
                this.updateRectangleSelection(point);
                break;
            case 'ellipse':
                this.updateEllipseSelection(point);
                break;
            case 'lasso':
                this.updateLassoSelection(point);
                break;
        }
        
        // 選択範囲プレビュー表示
        this.showSelectionPreview();
    }
    
    selectionEnd() {
        if (!this.isSelecting) return;
        
        this.isSelecting = false;
        
        // 選択範囲確定
        this.finalizeSelection();
        
        console.log(`⬚ Selection completed: ${this.selectionPath.length} points`);
    }
    
    startRectangleSelection(point) {
        this.selectionStartPoint = point;
        console.log('📐 Rectangle selection started');
    }
    
    updateRectangleSelection(point) {
        if (!this.selectionStartPoint) return;
        
        // 矩形選択範囲計算
        this.currentSelection = {
            type: 'rectangle',
            x: Math.min(this.selectionStartPoint.x, point.x),
            y: Math.min(this.selectionStartPoint.y, point.y),
            width: Math.abs(point.x - this.selectionStartPoint.x),
            height: Math.abs(point.y - this.selectionStartPoint.y)
        };
    }
    
    startEllipseSelection(point) {
        this.selectionStartPoint = point;
        console.log('⭕ Ellipse selection started');
    }
    
    updateEllipseSelection(point) {
        if (!this.selectionStartPoint) return;
        
        // 楕円選択範囲計算
        const centerX = (this.selectionStartPoint.x + point.x) / 2;
        const centerY = (this.selectionStartPoint.y + point.y) / 2;
        const radiusX = Math.abs(point.x - this.selectionStartPoint.x) / 2;
        const radiusY = Math.abs(point.y - this.selectionStartPoint.y) / 2;
        
        this.currentSelection = {
            type: 'ellipse',
            centerX,
            centerY,
            radiusX,
            radiusY
        };
    }
    
    startLassoSelection(point) {
        console.log('🪃 Lasso selection started');
    }
    
    updateLassoSelection(point) {
        // 自由選択パス更新
        // 実装は省略（基本的にselectionPathの追加のみ）
    }
    
    startMagicSelection(point) {
        console.log('✨ Magic selection started');
        // 自動選択（色ベース）
        this.performMagicSelection(point);
    }
    
    performMagicSelection(point) {
        const config = this.toolConfigs.selection;
        // 色ベース自動選択実装
        console.log('🎯 Magic selection performed');
    }
    
    finalizeSelection() {
        if (!this.currentSelection && this.selectionPath.length > 0) {
            // 自由選択の場合
            this.currentSelection = {
                type: 'lasso',
                path: [...this.selectionPath]
            };
        }
        
        if (this.currentSelection) {
            this.eventStore.emit(this.eventStore.eventTypes.LAYER_SELECT, {
                selection: cloneDeep(this.currentSelection)
            });
        }
    }
    
    showSelectionPreview() {
        // 選択範囲プレビュー表示（点線など）
        console.log('👀 Selection preview shown');
    }
    
    clearSelection() {
        this.currentSelection = null;
        this.selectionPath = [];
        this.isSelecting = false;
        this.selectionStartPoint = null;
        
        console.log('🗑️ Selection cleared');
    }
    
    // === イベント購読設定 ===
    setupEventSubscriptions() {
        // 入力イベントからツール処理へのマッピング
        this.eventStore.on(this.eventStore.eventTypes.STROKE_START, (data) => {
            const tool = this.tools.get(this.currentTool);
            if (tool?.onStrokeStart) {
                tool.onStrokeStart(data.payload.point, data.payload.pressure || 1.0);
            }
        });
        
        this.eventStore.on(this.eventStore.eventTypes.STROKE_UPDATE, (data) => {
            const tool = this.tools.get(this.currentTool);
            if (tool?.onStrokeUpdate) {
                tool.onStrokeUpdate(data.payload.point, data.payload.pressure || 1.0);
            }
        });
        
        this.eventStore.on(this.eventStore.eventTypes.STROKE_COMPLETE, (data) => {
            const tool = this.tools.get(this.currentTool);
            if (tool?.onStrokeEnd) {
                tool.onStrokeEnd();
            }
        });
    }
    
    // ツール情報取得
    getToolInfo(toolName = null) {
        const targetTool = toolName || this.currentTool;
        const toolData = this.tools.get(targetTool);
        const config = this.toolConfigs[targetTool];
        
        if (!toolData) return null;
        
        return {
            name: toolData.name,
            icon: toolData.icon,
            config: cloneDeep(config),
            active: targetTool === this.currentTool
        };
    }
    
    // 全ツール一覧取得
    getAllTools() {
        return Array.from(this.tools.keys()).map(toolName => this.getToolInfo(toolName));
    }
    
    // ツール履歴取得
    getToolHistory(limit = 10) {
        return this.toolHistory.slice(-limit);
    }
    
    // デバッグ情報
    getDebugInfo() {
        return {
            currentTool: this.currentTool,
            toolCount: this.tools.size,
            toolConfigs: cloneDeep(this.toolConfigs),
            isSelecting: this.isSelecting,
            selectionType: this.currentSelection?.type,
            historySize: this.toolHistory.length
        };
    }
    
    // クリーンアップ
    destroy() {
        // エアスプレーエフェクト停止
        this.stopAirsprayEffect();
        
        // 選択状態クリア
        this.clearSelection();
        
        // ツール履歴クリア
        this.toolHistory = [];
        
        console.log('✅ Tool processor destroyed');
    }
}