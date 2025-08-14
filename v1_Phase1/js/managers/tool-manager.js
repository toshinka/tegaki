/**
 * 🎯 AI_WORK_SCOPE: 描画ツール統括管理・ペン・消しゴム制御
 * 🎯 DEPENDENCIES: app-core.js
 * 🎯 CDN_USAGE: PIXI（描画処理）
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能
 * 🎯 SPLIT_THRESHOLD: 300行以下維持
 * 
 * 📋 PHASE_TARGET: Phase1
 * 📋 V8_MIGRATION: Graphics API互換性保証
 * 📋 PERFORMANCE_TARGET: 高速描画・滑らか線補正
 */

export class ToolManager {
    constructor(appCore) {
        this.appCore = appCore;
        this.currentTool = 'pen';
        this.tools = new Map();
        
        // 描画設定
        this.brushSettings = {
            size: 16.0,
            color: 0x800000, // ふたばマルーン
            opacity: 0.85,
            pressure: 0.5,
            smoothing: 0.3
        };
        
        // 描画状態
        this.isDrawing = false;
        this.currentPath = null;
        this.lastPoint = null;
        this.smoothedPoints = [];
        
        this.isInitialized = false;
    }

    async init() {
        console.log('🎨 ToolManager初期化中...');
        
        try {
            // 基本ツール初期化
            await this.initializeBasicTools();
            
            // 拡張ツール読み込み（利用可能な場合）
            await this.loadExtendedTools();
            
            this.isInitialized = true;
            console.log('✅ ToolManager初期化完了');
            
        } catch (error) {
            console.error('❌ ToolManager初期化エラー:', error);
            // 基本機能で継続
            console.log('⚠️ 基本描画機能で継続します');
            this.isInitialized = true;
        }
    }

    async initializeBasicTools() {
        // 基本描画機能（組み込み）
        this.tools.set('pen', {
            name: 'ペン',
            type: 'drawing',
            handler: this
        });
        
        this.tools.set('eraser', {
            name: '消しゴム',
            type: 'erasing',
            handler: this
        });
        
        console.log('✅ 基本ツール初期化完了');
    }

    async loadExtendedTools() {
        try {
            // 将来の拡張ツール読み込み（Phase2で実装）
            console.log('ℹ️ 拡張ツールはPhase2で実装予定');
        } catch (error) {
            console.log('ℹ️ 拡張ツール未対応 - 基本機能で動作');
        }
    }

    // ===== 描画制御メソッド =====

    startDrawing(x, y) {
        if (!this.isInitialized) return;
        
        this.isDrawing = true;
        this.lastPoint = { x, y };
        this.smoothedPoints = [{ x, y }];
        
        // 現在のツールに応じて描画開始
        if (this.currentTool === 'pen') {
            this.startPenDrawing(x, y);
        } else if (this.currentTool === 'eraser') {
            this.startEraserDrawing(x, y);
        }
        
        // 筆圧表示更新
        this.updatePressureDisplay();
    }

    continueDrawing(x, y) {
        if (!this.isDrawing || !this.currentPath) return;
        
        // 最小距離フィルター
        if (this.lastPoint) {
            const distance = Math.sqrt((x - this.lastPoint.x) ** 2 + (y - this.lastPoint.y) ** 2);
            if (distance < 1.5) return;
        }
        
        // スムージング処理
        const smoothedPoint = this.applySmoothingFilter(x, y);
        
        // 描画継続
        if (this.currentTool === 'pen') {
            this.continuePenDrawing(smoothedPoint.x, smoothedPoint.y);
        } else if (this.currentTool === 'eraser') {
            this.continueEraserDrawing(smoothedPoint.x, smoothedPoint.y);
        }
        
        this.lastPoint = { x, y };
        this.updatePressureDisplay();
    }

    stopDrawing() {
        if (!this.isDrawing) return;
        
        this.isDrawing = false;
        
        // 描画完了処理
        if (this.currentPath) {
            this.finalizePath();
        }
        
        this.currentPath = null;
        this.lastPoint = null;
        this.smoothedPoints = [];
        
        // 筆圧表示リセット
        this.resetPressureDisplay();
    }

    // ===== ペンツール実装 =====

    startPenDrawing(x, y) {
        this.currentPath = new PIXI.Graphics();
        
        // ふたば色での描画設定
        this.currentPath.lineStyle({
            width: this.brushSettings.size,
            color: this.brushSettings.color,
            alpha: this.brushSettings.opacity,
            cap: PIXI.LINE_CAP.ROUND,
            join: PIXI.LINE_JOIN.ROUND
        });
        
        // 開始点に円を描画（滑らかな線の開始）
        this.currentPath.beginFill(this.brushSettings.color, this.brushSettings.opacity);
        this.currentPath.drawCircle(x, y, this.brushSettings.size / 2);
        this.currentPath.endFill();
        
        // 線描画開始
        this.currentPath.moveTo(x, y);
        
        // 描画コンテナに追加
        this.appCore.drawingContainer.addChild(this.currentPath);
        this.appCore.paths.push(this.currentPath);
    }

    continuePenDrawing(x, y) {
        if (!this.currentPath || !this.lastPoint) return;
        
        // 連続する円形で滑らかな線を描画
        const distance = Math.sqrt((x - this.lastPoint.x) ** 2 + (y - this.lastPoint.y) ** 2);
        const steps = Math.max(1, Math.ceil(distance / 1.5));
        
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const px = this.lastPoint.x + (x - this.lastPoint.x) * t;
            const py = this.lastPoint.y + (y - this.lastPoint.y) * t;
            
            this.currentPath.beginFill(this.brushSettings.color, this.brushSettings.opacity);
            this.currentPath.drawCircle(px, py, this.brushSettings.size / 2);
            this.currentPath.endFill();
        }
    }

    // ===== 消しゴムツール実装 =====

    startEraserDrawing(x, y) {
        this.currentPath = new PIXI.Graphics();
        
        // 消しゴムは背景色での描画
        this.currentPath.lineStyle({
            width: this.brushSettings.size,
            color: this.appCore.backgroundColor,
            alpha: 1.0,
            cap: PIXI.LINE_CAP.ROUND,
            join: PIXI.LINE_JOIN.ROUND
        });
        
        // 開始点に背景色の円を描画
        this.currentPath.beginFill(this.appCore.backgroundColor, 1.0);
        this.currentPath.drawCircle(x, y, this.brushSettings.size / 2);
        this.currentPath.endFill();
        
        this.currentPath.moveTo(x, y);
        
        this.appCore.drawingContainer.addChild(this.currentPath);
        this.appCore.paths.push(this.currentPath);
    }

    continueEraserDrawing(x, y) {
        if (!this.currentPath || !this.lastPoint) return;
        
        // ペンツールと同じ円形描画方式
        const distance = Math.sqrt((x - this.lastPoint.x) ** 2 + (y - this.lastPoint.y) ** 2);
        const steps = Math.max(1, Math.ceil(distance / 1.5));
        
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const px = this.lastPoint.x + (x - this.lastPoint.x) * t;
            const py = this.lastPoint.y + (y - this.lastPoint.y) * t;
            
            this.currentPath.beginFill(this.appCore.backgroundColor, 1.0);
            this.currentPath.drawCircle(px, py, this.brushSettings.size / 2);
            this.currentPath.endFill();
        }
    }

    // ===== スムージング・フィルター処理 =====

    applySmoothingFilter(x, y) {
        if (this.brushSettings.smoothing === 0) {
            return { x, y };
        }
        
        this.smoothedPoints.push({ x, y });
        
        // 簡易移動平均フィルター
        const smoothingWindow = Math.min(5, this.smoothedPoints.length);
        const recentPoints = this.smoothedPoints.slice(-smoothingWindow);
        
        const smoothedX = recentPoints.reduce((sum, p) => sum + p.x, 0) / recentPoints.length;
        const smoothedY = recentPoints.reduce((sum, p) => sum + p.y, 0) / recentPoints.length;
        
        // スムージング強度に応じて補間
        const strength = this.brushSettings.smoothing;
        return {
            x: x * (1 - strength) + smoothedX * strength,
            y: y * (1 - strength) + smoothedY * strength
        };
    }

    finalizePath() {
        if (this.currentPath) {
            // パス完了処理（将来のundo/redo用）
            this.currentPath.userData = {
                tool: this.currentTool,
                timestamp: Date.now(),
                settings: { ...this.brushSettings }
            };
        }
    }

    // ===== 設定メソッド =====

    setTool(tool) {
        if (this.tools.has(tool)) {
            this.currentTool = tool;
            console.log(`🎯 ツール切り替え: ${tool}`);
        }
    }

    setBrushSize(size) {
        this.brushSettings.size = Math.max(0.1, Math.min(100, Math.round(size * 10) / 10));
    }

    setOpacity(opacity) {
        this.brushSettings.opacity = Math.max(0, Math.min(1, Math.round(opacity * 1000) / 1000));
    }

    setPressure(pressure) {
        this.brushSettings.pressure = Math.max(0, Math.min(1, Math.round(pressure * 1000) / 1000));
    }

    setSmoothing(smoothing) {
        this.brushSettings.smoothing = Math.max(0, Math.min(1, Math.round(smoothing * 1000) / 1000));
    }

    setBrushColor(color) {
        this.brushSettings.color = color;
        
        // カラー表示更新
        const colorElement = document.getElementById('current-color');
        if (colorElement) {
            const hexColor = '#' + color.toString(16).padStart(6, '0');
            colorElement.textContent = hexColor;
        }
    }

    // ===== UI連携メソッド =====

    updatePressureDisplay() {
        if (this.isDrawing) {
            // 簡易筆圧シミュレーション
            const basePressure = this.brushSettings.pressure * 100;
            const variation = Math.random() * 20 - 10; // ±10%の変動
            const displayPressure = Math.max(0, Math.min(100, basePressure + variation));
            
            const pressureElement = document.getElementById('pressure-monitor');
            if (pressureElement) {
                pressureElement.textContent = displayPressure.toFixed(1) + '%';
            }
        }
    }

    resetPressureDisplay() {
        const pressureElement = document.getElementById('pressure-monitor');
        if (pressureElement) {
            pressureElement.textContent = '0.0%';
        }
    }

    // ===== パブリックAPI =====

    getCurrentTool() {
        return this.currentTool;
    }

    getBrushSettings() {
        return { ...this.brushSettings };
    }

    getAvailableTools() {
        return Array.from(this.tools.keys());
    }

    isCurrentlyDrawing() {
        return this.isDrawing;
    }

    // ===== デバッグ・パフォーマンス =====

    getPerformanceStats() {
        return {
            currentTool: this.currentTool,
            isDrawing: this.isDrawing,
            pathCount: this.appCore.paths ? this.appCore.paths.length : 0,
            brushSettings: this.brushSettings,
            smoothingPoints: this.smoothedPoints.length
        };
    }
}