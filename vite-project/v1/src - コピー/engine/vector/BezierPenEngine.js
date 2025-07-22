// src/engine/vector/BezierPenEngine.js - コア描画エンジン

/**
 * 筆圧・線幅処理クラス
 */
export class PressureToWidthProcessor {
    constructor() {
        this.pressureSensitivity = 1.5;
        this.minWidthRatio = 0.2;
    }
    
    calculateDynamicWidth(pressure, baseSize, velocity = 0) {
        const pressureEffect = Math.pow(pressure, 1 / this.pressureSensitivity);
        const velocityEffect = Math.max(0.3, 1 - velocity * 0.001);
        const dynamicRatio = Math.max(this.minWidthRatio, pressureEffect * velocityEffect);
        return baseSize * dynamicRatio;
    }
    
    calculateVelocity(points) {
        if (points.length < 2) return 0;
        const last = points[points.length - 1];
        const prev = points[points.length - 2];
        const distance = Math.hypot(last.x - prev.x, last.y - prev.y);
        const timeSpan = Math.max(1, last.timestamp - prev.timestamp);
        return distance / timeSpan;
    }
}

/**
 * ベジェ軌跡最適化クラス
 */
export class BezierStrokeOptimizer {
    constructor() {
        this.simplificationTolerance = 2.0;
    }
    
    optimizeStroke(strokePoints) {
        if (strokePoints.length < 2) return null;
        const simplified = this.simplifyPoints(strokePoints);
        return this.generateBezierPath(simplified);
    }
    
    simplifyPoints(points) {
        if (points.length <= 2) return points;
        const simplified = [points[0]];
        let lastPoint = points[0];
        
        for (let i = 1; i < points.length; i++) {
            const distance = Math.hypot(points[i].x - lastPoint.x, points[i].y - lastPoint.y);
            if (distance > this.simplificationTolerance) {
                simplified.push(points[i]);
                lastPoint = points[i];
            }
        }
        
        if (simplified[simplified.length - 1].timestamp !== points[points.length - 1].timestamp) {
             simplified.push(points[points.length - 1]);
        }
        return simplified;
    }
    
    generateBezierPath(points) {
        if (points.length < 2) return null;
        if (points.length === 2) {
            return { type: 'line', start: points[0], end: points[1], points: points };
        }
        return { type: 'spline', points: points, controlPoints: this.calculateControlPoints(points) };
    }
    
    calculateControlPoints(points) {
        const controls = [];
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[Math.max(0, i - 1)];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[Math.min(points.length - 1, i + 2)];
            
            const cp1 = { x: p1.x + (p2.x - p0.x) * 0.16, y: p1.y + (p2.y - p0.y) * 0.16 };
            const cp2 = { x: p2.x - (p3.x - p1.x) * 0.16, y: p2.y - (p3.y - p1.y) * 0.16 };
            controls.push({ cp1, cp2 });
        }
        return controls;
    }
}

/**
 * ベジェ軌跡レンダラー
 */
export class BezierTrajectoryRenderer {
    constructor(ctx) {
        this.ctx = ctx;
        this.pressureProcessor = new PressureToWidthProcessor();
    }
    
    render(path, settings) {
        if (!path) return;
        this.ctx.save();
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.globalAlpha = settings.opacity;
        this.ctx.strokeStyle = settings.color;
        
        if (path.type === 'line') {
            this.renderLine(path, settings);
        } else if (path.type === 'spline') {
            this.renderSpline(path, settings);
        }
        this.ctx.restore();
    }
    
    renderLine(path, settings) {
        const { start, end } = path;
        const avgPressure = (start.pressure + end.pressure) / 2;
        const width = this.pressureProcessor.calculateDynamicWidth(avgPressure, settings.size);
        
        this.ctx.lineWidth = width;
        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y);
        this.ctx.lineTo(end.x, end.y);
        this.ctx.stroke();
    }
    
    renderSpline(path, settings) {
        const { points, controlPoints } = path;
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            const control = controlPoints[i];
            const avgPressure = (p1.pressure + p2.pressure) / 2;
            const width = this.pressureProcessor.calculateDynamicWidth(avgPressure, settings.size);
            
            this.ctx.lineWidth = width;
            this.ctx.beginPath();
            this.ctx.moveTo(p1.x, p1.y);
            this.ctx.bezierCurveTo(control.cp1.x, control.cp1.y, control.cp2.x, control.cp2.y, p2.x, p2.y);
            this.ctx.stroke();
        }
    }
}

/**
 * 軽量バッチレンダリング処理
 */
export class BatchRenderingProcessor {
    constructor(renderer) {
        this.renderer = renderer;
        this.batchQueue = [];
        this.renderScheduled = false;
        this.maxBatchSize = 50; // 軽量化：50ストローク/バッチ
    }

    addStroke(stroke) {
        this.batchQueue.push(stroke);
        if (this.batchQueue.length >= this.maxBatchSize) {
            this.flushBatch();
        } else {
            this.scheduleRender();
        }
    }

    scheduleRender() {
        if (!this.renderScheduled) {
            this.renderScheduled = true;
            requestAnimationFrame(() => {
                this.flushBatch();
                this.renderScheduled = false;
            });
        }
    }

    flushBatch() {
        if (this.batchQueue.length === 0) return;
        const canvas = this.renderer.ctx.canvas;
        this.renderer.ctx.clearRect(0, 0, canvas.width, canvas.height);

        // バッチ描画実行
        for (const stroke of this.batchQueue) {
            stroke.render(this.renderer);
        }

        this.batchQueue.length = 0;
    }

    renderBatch(strokes) {
        // 既存ストローク一括描画
        for (const stroke of strokes) {
            stroke.render(this.renderer);
        }
    }

    hasQueuedStrokes() {
        return this.batchQueue.length > 0 || this.renderScheduled;
    }
}

/**
 * ベクターストローク オブジェクト
 */
export class VectorStroke {
    constructor(bezierPath, strokeSettings) {
        this.id = 'stroke_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        this.bezierPath = bezierPath;
        this.settings = { ...strokeSettings };
        this.bounds = this.calculateBounds(bezierPath, strokeSettings.size);
        this.timestamp = Date.now();
        this.visible = true;
    }

    calculateBounds(path, strokeSize) {
        if (!path || !path.points || path.points.length === 0) {
            return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
        }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        path.points.forEach(point => {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
        });
        const strokeRadius = strokeSize * 0.5;
        minX -= strokeRadius;
        minY -= strokeRadius;
        maxX += strokeRadius;
        maxY += strokeRadius;
        return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
    }

    render(renderer) {
        if (!this.visible) return;
        renderer.render(this.bezierPath, this.settings);
    }
}

/**
 * ベクターストローク状態管理 (規約準拠: VectorStrokeStore)
 */
export class VectorStrokeStore {
    constructor() {
        this.strokes = new Map();
        this.spatialIndex = new Map();
        this.gridSize = 100;
    }

    addStroke(stroke) {
        this.strokes.set(stroke.id, stroke);
        this.addToSpatialIndex(stroke);
        return stroke.id;
    }

    getAllStrokes() {
        return Array.from(this.strokes.values());
    }

    addToSpatialIndex(stroke) {
        const gridCells = this.getGridCellsInBounds(stroke.bounds);
        gridCells.forEach(gridKey => {
            if (!this.spatialIndex.has(gridKey)) {
                this.spatialIndex.set(gridKey, []);
            }
            this.spatialIndex.get(gridKey).push(stroke.id);
        });
    }

    getGridCellsInBounds(bounds) {
        const cells = [];
        const startX = Math.floor(bounds.minX / this.gridSize);
        const endX = Math.floor(bounds.maxX / this.gridSize);
        const startY = Math.floor(bounds.minY / this.gridSize);
        const endY = Math.floor(bounds.maxY / this.gridSize);
        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                cells.push(`${x},${y}`);
            }
        }
        return cells;
    }
}

/**
 * 表示領域最適化カリング
 */
export class ViewportCuller {
    constructor() {
        this.cullingEnabled = true;
        this.cullingMargin = 50;
    }

    cullStrokes(allStrokes, viewport) {
        if (!this.cullingEnabled) return allStrokes;
        const cullingBounds = {
            minX: viewport.x - this.cullingMargin,
            minY: viewport.y - this.cullingMargin,
            maxX: viewport.x + viewport.width + this.cullingMargin,
            maxY: viewport.y + viewport.height + this.cullingMargin
        };
        return allStrokes.filter(stroke => this.isStrokeVisible(stroke, cullingBounds));
    }

    isStrokeVisible(stroke, viewport) {
        return !(stroke.bounds.maxX < viewport.minX ||
                 stroke.bounds.minX > viewport.maxX ||
                 stroke.bounds.maxY < viewport.minY ||
                 stroke.bounds.minY > viewport.maxY);
    }
}

/**
 * Bezier.js統合ベクターペンエンジン (Vite版)
 */
export class BezierPenEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.isActive = false;
        this.settings = { size: 3, opacity: 1.0, color: '#800000' };
        this.strokePoints = [];

        // 規約準拠コンポーネント統合
        this.strokeStore = new VectorStrokeStore();
        this.viewportCuller = new ViewportCuller();
        this.strokeOptimizer = new BezierStrokeOptimizer();
        this.trajectoryRenderer = new BezierTrajectoryRenderer(this.ctx);
        this.pressureProcessor = new PressureToWidthProcessor();
        this.batchRenderer = new BatchRenderingProcessor(this.trajectoryRenderer);
    }

    updateSettings(settings) {
        this.settings = { ...this.settings, ...settings };
    }

    startStroke(x, y, pressure) {
        this.isActive = true;
        this.strokePoints = [{ x, y, pressure, timestamp: Date.now() }];
    }

    continueStroke(x, y, pressure) {
        if (!this.isActive) return;
        this.strokePoints.push({ x, y, pressure, timestamp: Date.now() });
        this.scheduleRedraw();
    }

    endStroke() {
        if (!this.isActive) return;
        this.isActive = false;

        const optimizedPath = this.strokeOptimizer.optimizeStroke(this.strokePoints);
        if (optimizedPath) {
            const newStroke = new VectorStroke(optimizedPath, { ...this.settings });
            this.strokeStore.addStroke(newStroke);
        }

        this.strokePoints = [];
        this.scheduleRedraw();
    }
    
    scheduleRedraw() {
        // 既存の描画キューをクリア
        this.batchRenderer.batchQueue.length = 0;

        const viewport = { x: 0, y: 0, width: this.canvas.width, height: this.canvas.height };
        const allStrokes = this.strokeStore.getAllStrokes();
        const visibleStrokes = this.viewportCuller.cullStrokes(allStrokes, viewport);
        
        // 確定済みストロークを直接キューに追加
        visibleStrokes.forEach(stroke => this.batchRenderer.batchQueue.push(stroke));

        // プレビュー中のストロークは、renderメソッドを持つダミーオブジェクトとしてキューに追加
        if (this.isActive && this.strokePoints.length > 1) {
            const previewStroke = {
                render: () => this.renderPreviewStroke(this.strokePoints)
            };
            this.batchRenderer.batchQueue.push(previewStroke);
        }

        this.batchRenderer.scheduleRender();
    }

    renderPreviewStroke(points) {
         this.ctx.save();
         this.ctx.lineCap = 'round';
         this.ctx.lineJoin = 'round';
         this.ctx.strokeStyle = this.settings.color;
         this.ctx.globalAlpha = this.settings.opacity;

         this.ctx.beginPath();
         this.ctx.moveTo(points[0].x, points[0].y);
         for (let i = 1; i < points.length; i++) {
             const p1 = points[i-1];
             const p2 = points[i];
             const velocity = this.pressureProcessor.calculateVelocity([p1, p2]);
             const avgPressure = (p1.pressure + p2.pressure) / 2;
             const width = this.pressureProcessor.calculateDynamicWidth(avgPressure, this.settings.size, velocity);
             this.ctx.lineWidth = width;
             this.ctx.lineTo(p2.x, p2.y);
         }
         this.ctx.stroke();
         this.ctx.restore();
    }

    initCanvas() {
        const dpr = 1; // DPR=1固定（憲章準拠）
        this.canvas.width = 800 * dpr;
        this.canvas.height = 600 * dpr;
        this.ctx.scale(dpr, dpr);
    }

    getPointerData(event) {
        const rect = this.canvas.getBoundingClientRect();
        let pressure = event.pressure !== undefined ? event.pressure : 0.5;
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            pressure: Math.max(0.1, Math.min(1.0, pressure))
        };
    }
}
