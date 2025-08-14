/**
 * 🖊️ ペンツール - ベクター描画実装
 * 🎯 AI_WORK_SCOPE: ペン描画専用・ベクター描画・スムージング
 * 🎯 DEPENDENCIES: main.js, app-core.js, managers/tool-manager.js
 * 🎯 CDN_USAGE: PIXI（Graphics）
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能
 * 🎯 SPLIT_THRESHOLD: 300行維持（ペン専用機能）
 * 
 * 📋 PHASE_TARGET: Phase1基本・Phase2高度化
 * 📋 V8_MIGRATION: PIXI.Graphics API変更対応予定
 * 📋 PERFORMANCE_TARGET: 滑らか描画60FPS維持
 */

export class PenTool {
    constructor(toolManager) {
        this.toolManager = toolManager;
        this.appCore = toolManager.appCore;
        this.app = toolManager.app;
        
        // 描画状態
        this.currentPath = null;
        this.points = [];
        this.isDrawing = false;
        
        // 設定（ToolManagerから取得）
        this.settings = {
            size: 16.0,
            color: 0x800000, // ふたば色
            opacity: 0.85,
            pressure: 0.5,
            smoothing: 0.3
        };
        
        // スムージング用バッファ
        this.smoothingBuffer = [];
        this.maxBufferSize = 5;
        
        console.log('🖊️ ペンツール初期化完了');
    }

    /**
     * ブラシプレビュー作成
     */
    createBrushPreview() {
        const preview = new PIXI.Graphics();
        preview.beginFill(this.settings.color, 0.5);
        preview.drawCircle(0, 0, this.settings.size / 2);
        preview.endFill();
        
        return preview;
    }

    /**
     * Phase2準備: 高度筆圧対応
     */
    prepareAdvancedPressure() {
        // 📋 Phase2: Pointer Events API筆圧対応
        // 📋 Phase2: タブレット筆圧センサー対応
        console.log('📋 Phase2準備: 高度筆圧対応機能');
    }

    /**
     * Phase2準備: ベクター最適化
     */
    prepareVectorOptimization() {
        // 📋 Phase2: 非破壊ベクター変形対応
        // 📋 Phase2: SVGエクスポート対応
        console.log('📋 Phase2準備: ベクター最適化機能');
    }

    /**
     * リソース解放
     */
    destroy() {
        if (this.isDrawing) {
            this.stopDrawing();
        }
        
        this.currentPath = null;
        this.points = [];
        this.smoothingBuffer = [];
        
        console.log('🗑️ ペンツール リソース解放完了');
    }
}
     * ツール有効化
     */
    onActivate() {
        console.log('🖊️ ペンツール有効化');
        this.updateSettings(this.toolManager.getCurrentToolSettings());
    }

    /**
     * ツール無効化
     */
    onDeactivate() {
        console.log('🖊️ ペンツール無効化');
        if (this.isDrawing) {
            this.stopDrawing();
        }
    }

    /**
     * 設定更新
     */
    updateSettings(newSettings) {
        Object.assign(this.settings, newSettings);
        console.log('🔧 ペン設定更新:', this.settings);
    }

    /**
     * 描画開始
     */
    startDrawing(x, y) {
        this.isDrawing = true;
        this.points = [];
        this.smoothingBuffer = [];
        
        // 新しいパス作成
        this.currentPath = this.createNewPath();
        
        // 開始点記録
        const startPoint = { x, y, pressure: this.settings.pressure };
        this.points.push(startPoint);
        this.smoothingBuffer.push(startPoint);
        
        // 初期描画（点）
        this.drawInitialPoint(x, y);
        
        console.log(`🖊️ ペン描画開始: (${x}, ${y})`);
        return this.currentPath;
    }

    /**
     * 描画継続
     */
    continueDrawing(x, y) {
        if (!this.isDrawing || !this.currentPath) return;
        
        const currentPoint = { 
            x, 
            y, 
            pressure: this.calculatePressure() 
        };
        
        // スムージングバッファに追加
        this.smoothingBuffer.push(currentPoint);
        if (this.smoothingBuffer.length > this.maxBufferSize) {
            this.smoothingBuffer.shift();
        }
        
        // スムージング適用
        const smoothedPoint = this.applySmoothingFilter(currentPoint);
        this.points.push(smoothedPoint);
        
        // 線の描画
        this.drawLine(smoothedPoint);
    }

    /**
     * 描画終了
     */
    stopDrawing() {
        if (!this.isDrawing) return;
        
        // 最終描画処理
        this.finalizePath();
        
        this.isDrawing = false;
        this.currentPath = null;
        this.points = [];
        this.smoothingBuffer = [];
        
        console.log('🖊️ ペン描画終了');
    }

    /**
     * 新しいパス作成
     */
    createNewPath() {
        const path = new PIXI.Graphics();
        
        // 描画設定適用
        path.lineStyle({
            width: this.settings.size,
            color: this.settings.color,
            alpha: this.settings.opacity,
            // 📋 V8_MIGRATION: lineStyle API変更対応予定
            // V8: path.stroke({ width: ..., color: ..., alpha: ... })
            cap: PIXI.LINE_CAP.ROUND,
            join: PIXI.LINE_JOIN.ROUND
        });
        
        // 描画コンテナに追加
        const target = this.appCore.drawingContainer || this.appCore.app.stage;
        target.addChild(path);
        
        return path;
    }

    /**
     * 初期点描画
     */
    drawInitialPoint(x, y) {
        if (!this.currentPath) return;
        
        // 円形ブラシで点を描画
        this.currentPath.beginFill(this.settings.color, this.settings.opacity);
        this.currentPath.drawCircle(x, y, this.settings.size / 2);
        this.currentPath.endFill();
        
        // ライン開始
        this.currentPath.moveTo(x, y);
    }

    /**
     * 線描画
     */
    drawLine(point) {
        if (!this.currentPath || this.points.length < 2) return;
        
        const prevPoint = this.points[this.points.length - 2];
        
        // 線の描画
        this.currentPath.lineTo(point.x, point.y);
        
        // 筆圧による太さ変化（Phase2で高度化予定）
        if (this.settings.pressure > 0.1) {
            const pressureSize = this.settings.size * point.pressure;
            this.drawPressureLine(prevPoint, point, pressureSize);
        }
    }

    /**
     * 筆圧対応線描画
     */
    drawPressureLine(fromPoint, toPoint, size) {
        // 基本実装: 円形ブラシの連続
        const steps = Math.max(1, Math.floor(this.calculateDistance(fromPoint, toPoint) / 2));
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = fromPoint.x + (toPoint.x - fromPoint.x) * t;
            const y = fromPoint.y + (toPoint.y - fromPoint.y) * t;
            const currentSize = size * (0.8 + 0.4 * t); // サイズ変化
            
            this.currentPath.beginFill(this.settings.color, this.settings.opacity * 0.3);
            this.currentPath.drawCircle(x, y, currentSize / 2);
            this.currentPath.endFill();
        }
    }

    /**
     * スムージングフィルター適用
     */
    applySmoothingFilter(currentPoint) {
        if (this.settings.smoothing <= 0.1 || this.smoothingBuffer.length < 3) {
            return currentPoint;
        }
        
        // 移動平均フィルター
        const buffer = this.smoothingBuffer;
        const smoothingFactor = this.settings.smoothing;
        
        let avgX = 0, avgY = 0;
        for (const point of buffer) {
            avgX += point.x;
            avgY += point.y;
        }
        avgX /= buffer.length;
        avgY /= buffer.length;
        
        // 元の点と平均点の補間
        return {
            x: currentPoint.x * (1 - smoothingFactor) + avgX * smoothingFactor,
            y: currentPoint.y * (1 - smoothingFactor) + avgY * smoothingFactor,
            pressure: currentPoint.pressure
        };
    }

    /**
     * 筆圧計算（シミュレート）
     */
    calculatePressure() {
        const basePressure = this.settings.pressure;
        
        // 速度ベース筆圧シミュレート
        if (this.points.length >= 2) {
            const lastPoint = this.points[this.points.length - 1];
            const prevPoint = this.points[this.points.length - 2];
            const distance = this.calculateDistance(lastPoint, prevPoint);
            
            // 速度が速いほど筆圧を下げる
            const velocityFactor = Math.max(0.5, Math.min(1.5, 5 / (distance + 1)));
            return basePressure * velocityFactor;
        }
        
        return basePressure;
    }

    /**
     * 距離計算
     */
    calculateDistance(point1, point2) {
        return Math.sqrt(
            Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2)
        );
    }

    /**
     * パス最終処理
     */
    finalizePath() {
        if (!this.currentPath || this.points.length === 0) return;
        
        // パスの最適化（Phase2で実装予定）
        this.optimizePath();
        
        // メタデータ追加
        this.currentPath.userData = {
            tool: 'pen',
            settings: { ...this.settings },
            points: [...this.points],
            timestamp: Date.now()
        };
        
        console.log(`📝 ペンパス完成: ${this.points.length}ポイント`);
    }

    /**
     * パス最適化（Phase2準備）
     */
    optimizePath() {
        // 📋 Phase2: ベクターパス最適化実装予定
        // - ダグラス・ポイカー法によるポイント削減
        // - ベジェ曲線フィッティング
        // - 非破壊最適化
        console.log('📋 Phase2準備: パス最適化機能');
    }

    /**
     * エクスポート用データ取得
     */
    getExportData() {
        return {
            tool: 'pen',
            settings: this.settings,
            // 📋 Phase3: SVG/PDF エクスポート対応予定
            paths: this.getAllPaths()
        };
    }

    /**
     * 全パス取得
     */
    getAllPaths() {
        const target = this.appCore.drawingContainer || this.appCore.app.stage;
        return target.children.filter(child => 
            child instanceof PIXI.Graphics && 
            child.userData && 
            child.userData.tool === 'pen'
        );
    }

    /**
     *