/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: ペンツール専用・ベクター描画・筆圧対応
 * 🎯 DEPENDENCIES: js/managers/tool-manager.js, libs/pixi-extensions.js
 * 🎯 NODE_MODULES: pixi.js@^7.4.3, @pixi/graphics-extras（将来）
 * 🎯 PIXI_EXTENSIONS: Graphics、円形ブラシ
 * 🎯 ISOLATION_TEST: 可能（単体テスト対応）
 * 🎯 SPLIT_THRESHOLD: 350行（ペン特化・分割慎重）
 * 📋 PHASE_TARGET: Phase1
 * 📋 V8_MIGRATION: Graphics API変更 (beginFill → fill)
 */

/**
 * ベクターペンツール実装
 * 元HTMLのペン描画ロジックを専用クラス化
 * SOLID原則: 単一責任 - ペン描画のみ
 */
export class PenTool {
    constructor(toolManager) {
        this.toolManager = toolManager;
        this.name = 'ベクターペン';
        this.id = 'pen';
        this.type = 'drawing';
        
        // ペン専用設定
        this.penSettings = {
            minSize: 0.1,
            maxSize: 100.0,
            pressureResponse: 'size', // 'size' | 'opacity' | 'both'
            antiAliasing: true,
            textureEnabled: false // 将来のテクスチャブラシ対応
        };
        
        console.log(`🖋️ PenTool 初期化: ${this.name}`);
    }
    
    /**
     * ペンツール初期化
     */
    init() {
        console.log('🖋️ PenTool初期化完了');
        return true;
    }
    
    /**
     * ペン描画開始
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {Object} settings - 描画設定
     */
    startDraw(x, y, settings = {}) {
        if (!this.toolManager || !this.toolManager.drawingEngine) {
            console.warn('⚠️ PenTool: DrawingEngine未設定');
            return null;
        }
        
        const globalSettings = this.toolManager.getAllSettings();
        const penSettings = { ...globalSettings, ...settings };
        
        // 筆圧適用サイズ計算
        const effectiveSize = this.calculatePressureSize(
            penSettings.brushSize,
            penSettings.pressure || 0.5
        );
        
        // パス作成（元HTMLのcreatePathロジック統合）
        const path = this.createPenPath(x, y, effectiveSize, penSettings);
        
        console.log(`🖋️ ペン描画開始: サイズ${effectiveSize.toFixed(1)}px`);
        return path;
    }
    
    /**
     * ペン描画継続
     * @param {Object} path - アクティブパス
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {number} pressure - 筆圧 (0.0-1.0)
     */
    continueDraw(path, x, y, pressure = 0.5) {
        if (!path || !path.graphics) return;
        
        const settings = this.toolManager.getAllSettings();
        
        // 筆圧適用サイズ計算
        const effectiveSize = this.calculatePressureSize(settings.brushSize, pressure);
        
        // 線補正適用
        const smoothedPoint = this.applySmoothing(path, x, y, settings.smoothing);
        
        // 線描画実行（元HTMLのdrawLineロジック改良版）
        this.drawPenLine(path, smoothedPoint.x, smoothedPoint.y, effectiveSize, settings);
    }
    
    /**
     * ペン描画終了
     * @param {Object} path - アクティブパス
     */
    finishDraw(path) {
        if (path) {
            path.isComplete = true;
            console.log('🖋️ ペン描画完了');
        }
    }
    
    /**
     * ペンパス作成（元HTMLのcreatePathを改良）
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {number} size - ブラシサイズ
     * @param {Object} settings - 描画設定
     */
    createPenPath(x, y, size, settings) {
        const engine = this.toolManager.drawingEngine;
        
        const path = {
            id: `pen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            graphics: new PIXI.Graphics(),
            points: [],
            color: settings.brushColor,
            size: size,
            opacity: settings.opacity,
            tool: this.id,
            isComplete: false,
            smoothingBuffer: [] // 線補正用バッファ
        };
        
        // アンチエイリアス設定
        if (this.penSettings.antiAliasing) {
            // v7: resolution設定で代替
            // v8: antialias プロパティ直接指定予定
        }
        
        // 初回描画: 円形ブラシで点を描画（元HTML方式維持）
        path.graphics.beginFill(path.color, path.opacity);
        path.graphics.drawCircle(x, y, size / 2);
        path.graphics.endFill();
        
        // v8移行準備コメント
        // v8: path.graphics.circle(x, y, size / 2).fill({ color: path.color, alpha: path.opacity });
        
        path.points.push({ x, y, size, pressure: settings.pressure || 0.5 });
        
        engine.drawingContainer.addChild(path.graphics);
        engine.paths.push(path);
        return path;
    }
    
    /**
     * ペン線描画（元HTMLのdrawLine改良版）
     * @param {Object} path - パスオブジェクト
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {number} size - ブラシサイズ
     * @param {Object} settings - 描画設定
     */
    drawPenLine(path, x, y, size, settings) {
        if (!path || path.points.length === 0) return;
        
        const lastPoint = path.points[path.points.length - 1];
        const distance = Math.sqrt((x - lastPoint.x) ** 2 + (y - lastPoint.y) ** 2);
        
        // 最小距離フィルタ（元HTML同様）
        if (distance < 1.5) return;
        
        // エッジスムージング対応: 補間点数を動的調整
        const baseSteps = Math.max(1, Math.ceil(distance / 1.5));
        const smoothingSteps = settings.edgeSmoothing ? 
            Math.max(baseSteps, Math.ceil(distance / 1.0)) : baseSteps;
        
        // 連続する円形で線を描画（元HTML方式維持・改良）
        for (let i = 1; i <= smoothingSteps; i++) {
            const t = i / smoothingSteps;
            const px = lastPoint.x + (x - lastPoint.x) * t;
            const py = lastPoint.y + (y - lastPoint.y) * t;
            
            // サイズ補間（筆圧対応）
            const interpolatedSize = lastPoint.size + (size - lastPoint.size) * t;
            
            path.graphics.beginFill(path.color, path.opacity);
            path.graphics.drawCircle(px, py, interpolatedSize / 2);
            path.graphics.endFill();
            
            // v8移行準備コメント
            // v8: path.graphics.circle(px, py, interpolatedSize / 2)
            //     .fill({ color: path.color, alpha: path.opacity });
        }
        
        path.points.push({ x, y, size, pressure: settings.pressure || 0.5 });
    }
    
    /**
     * 筆圧適用サイズ計算
     * @param {number} baseSize - 基本サイズ
     * @param {number} pressure - 筆圧 (0.0-1.0)
     */
    calculatePressureSize(baseSize, pressure) {
        if (!this.toolManager.globalSettings.pressureSensitivity) {
            return baseSize;
        }
        
        // 筆圧カーブ: 0.3-1.2倍の範囲で変動
        const pressureCurve = 0.3 + (pressure * 0.9);
        const effectiveSize = baseSize * pressureCurve;
        
        // 最小・最大サイズ制限
        return Math.max(
            this.penSettings.minSize,
            Math.min(this.penSettings.maxSize, effectiveSize)
        );
    }
    
    /**
     * 線補正適用
     * @param {Object} path - パスオブジェクト
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {number} smoothing - 補正強度 (0.0-1.0)
     */
    applySmoothing(path, x, y, smoothing) {
        if (smoothing <= 0 || !path.smoothingBuffer) {
            return { x, y };
        }
        
        // バッファに追加
        path.smoothingBuffer.push({ x, y, time: performance.now() });
        
        // 古いポイントを削除（50ms以前）
        const now = performance.now();
        path.smoothingBuffer = path.smoothingBuffer.filter(p => now - p.time < 50);
        
        if (path.smoothingBuffer.length < 3) {
            return { x, y };
        }
        
        // 重み付き平均による補正
        let totalWeight = 0;
        let smoothedX = 0;
        let smoothedY = 0;
        
        path.smoothingBuffer.forEach((point, index) => {
            const weight = Math.pow(0.8, path.smoothingBuffer.length - 1 - index);
            smoothedX += point.x * weight;
            smoothedY += point.y * weight;
            totalWeight += weight;
        });
        
        smoothedX /= totalWeight;
        smoothedY /= totalWeight;
        
        // 補正強度適用
        return {
            x: x + (smoothedX - x) * smoothing,
            y: y + (smoothedY - y) * smoothing
        };
    }
    
    /**
     * ペンツール設定更新
     * @param {Object} newSettings - 新しい設定
     */
    updatePenSettings(newSettings) {
        this.penSettings = { ...this.penSettings, ...newSettings };
        console.log('🖋️ ペンツール設定更新:', newSettings);
    }
    
    /**
     * 現在のペン設定取得
     */
    getPenSettings() {
        return { ...this.penSettings };
    }
    
    /**
     * ペンツール状態取得
     */
    getToolInfo() {
        return {
            name: this.name,
            id: this.id,
            type: this.type,
            settings: this.penSettings,
            isActive: this.toolManager?.currentTool === this.id
        };
    }
}

export default PenTool;