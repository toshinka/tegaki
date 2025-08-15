/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: 消しゴムツール専用・背景色描画・サイズ調整対応
 * 🎯 DEPENDENCIES: js/managers/tool-manager.js, libs/pixi-extensions.js
 * 🎯 NODE_MODULES: pixi.js@^7.4.3, @pixi/graphics-extras（将来）
 * 🎯 PIXI_EXTENSIONS: Graphics、BlendMode
 * 🎯 ISOLATION_TEST: 可能（単体テスト対応）
 * 🎯 SPLIT_THRESHOLD: 300行（消しゴム特化・シンプル）
 * 📋 PHASE_TARGET: Phase1
 * 📋 V8_MIGRATION: Graphics API変更 + BlendMode変更予定
 */

/**
 * 消しゴムツール実装
 * 元HTMLの消しゴムロジックを専用クラス化
 * SOLID原則: 単一責任 - 消去処理のみ
 */
export class EraserTool {
    constructor(toolManager) {
        this.toolManager = toolManager;
        this.name = '消しゴム';
        this.id = 'eraser';
        this.type = 'erasing';
        
        // 消しゴム専用設定
        this.eraserSettings = {
            minSize: 1.0,  // 消しゴムは最小1px
            maxSize: 200.0, // ペンより大きなサイズ対応
            eraserMode: 'background', // 'background' | 'transparent' | 'blend'
            hardness: 1.0, // エッジの硬さ (将来のソフト消しゴム用)
            pressureEnabled: true
        };
        
        console.log(`🧽 EraserTool 初期化: ${this.name}`);
    }
    
    /**
     * 消しゴムツール初期化
     */
    init() {
        console.log('🧽 EraserTool初期化完了');
        return true;
    }
    
    /**
     * 消しゴム描画開始
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {Object} settings - 描画設定
     */
    startErase(x, y, settings = {}) {
        if (!this.toolManager || !this.toolManager.drawingEngine) {
            console.warn('⚠️ EraserTool: DrawingEngine未設定');
            return null;
        }
        
        const globalSettings = this.toolManager.getAllSettings();
        const eraserSettings = { ...globalSettings, ...settings };
        
        // 筆圧適用サイズ計算
        const effectiveSize = this.calculateEraserSize(
            eraserSettings.brushSize,
            eraserSettings.pressure || 0.5
        );
        
        // 消しゴムパス作成
        const path = this.createEraserPath(x, y, effectiveSize, eraserSettings);
        
        console.log(`🧽 消しゴム開始: サイズ${effectiveSize.toFixed(1)}px`);
        return path;
    }
    
    /**
     * 消しゴム描画継続
     * @param {Object} path - アクティブパス
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {number} pressure - 筆圧 (0.0-1.0)
     */
    continueErase(path, x, y, pressure = 0.5) {
        if (!path || !path.graphics) return;
        
        const settings = this.toolManager.getAllSettings();
        
        // 筆圧適用サイズ計算
        const effectiveSize = this.calculateEraserSize(settings.brushSize, pressure);
        
        // 消しゴム線描画実行
        this.drawEraserLine(path, x, y, effectiveSize, settings);
    }
    
    /**
     * 消しゴム描画終了
     * @param {Object} path - アクティブパス
     */
    finishErase(path) {
        if (path) {
            path.isComplete = true;
            console.log('🧽 消しゴム完了');
        }
    }
    
    /**
     * 消しゴムパス作成
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {number} size - ブラシサイズ
     * @param {Object} settings - 描画設定
     */
    createEraserPath(x, y, size, settings) {
        const engine = this.toolManager.drawingEngine;
        
        // 消しゴム色（背景色使用）
        const eraserColor = engine.backgroundColor || 0xf0e0d6;
        
        const path = {
            id: `eraser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            graphics: new PIXI.Graphics(),
            points: [],
            color: eraserColor,
            size: size,
            opacity: 1.0, // 消しゴムは常に完全不透明
            tool: this.id,
            isComplete: false,
            eraserMode: this.eraserSettings.eraserMode
        };
        
        // 初回描画: 背景色の円形で消去（元HTML方式）
        path.graphics.beginFill(path.color, path.opacity);
        path.graphics.drawCircle(x, y, size / 2);
        path.graphics.endFill();
        
        // v8移行準備コメント
        // v8: path.graphics.circle(x, y, size / 2).fill({ color: eraserColor, alpha: 1.0 });
        
        path.points.push({ x, y, size, pressure: settings.pressure || 0.5 });
        
        engine.drawingContainer.addChild(path.graphics);
        engine.paths.push(path);
        return path;
    }
    
    /**
     * 消しゴム線描画
     * @param {Object} path - パスオブジェクト
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {number} size - ブラシサイズ
     * @param {Object} settings - 描画設定
     */
    drawEraserLine(path, x, y, size, settings) {
        if (!path || path.points.length === 0) return;
        
        const lastPoint = path.points[path.points.length - 1];
        const distance = Math.sqrt((x - lastPoint.x) ** 2 + (y - lastPoint.y) ** 2);
        
        // 最小距離フィルタ
        if (distance < 2.0) return; // 消しゴムは少し大きめの閾値
        
        // 連続する円形で消去線を描画
        const steps = Math.max(1, Math.ceil(distance / 2.0));
        
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
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
     * 消しゴムサイズ計算
     * @param {number} baseSize - 基本サイズ
     * @param {number} pressure - 筆圧 (0.0-1.0)
     */
    calculateEraserSize(baseSize, pressure) {
        if (!this.eraserSettings.pressureEnabled) {
            return baseSize;
        }
        
        // 消しゴムの筆圧カーブ: 0.5-1.5倍の範囲
        const pressureCurve = 0.5 + (pressure * 1.0);
        const effectiveSize = baseSize * pressureCurve;
        
        // 最小・最大サイズ制限
        return Math.max(
            this.eraserSettings.minSize,
            Math.min(this.eraserSettings.maxSize, effectiveSize)
        );
    }
    
    /**
     * 透明消しゴムモード（将来拡張用）
     * @param {number} x - X座標
     * @param {number} y - Y座標  
     * @param {number} size - サイズ
     */
    createTransparentEraser(x, y, size) {
        // 将来のBlendMode.ERASE対応
        // v8でのBlendMode改良に合わせて実装予定
        console.log('🔮 透明消しゴム（将来実装）');
        
        // v8移行時の実装例（コメント）
        // const graphics = new PIXI.Graphics();
        // graphics.blendMode = PIXI.BLEND_MODES.ERASE;
        // graphics.circle(x, y, size / 2).fill({ color: 0xffffff, alpha: 1.0 });
    }
    
    /**
     * 消しゴム設定更新
     * @param {Object} newSettings - 新しい設定
     */
    updateEraserSettings(newSettings) {
        this.eraserSettings = { ...this.eraserSettings, ...newSettings };
        console.log('🧽 消しゴム設定更新:', newSettings);
    }
    
    /**
     * 現在の消しゴム設定取得
     */
    getEraserSettings() {
        return { ...this.eraserSettings };
    }
    
    /**
     * 消しゴムツール状態取得
     */
    getToolInfo() {
        return {
            name: this.name,
            id: this.id,
            type: this.type,
            settings: this.eraserSettings,
            isActive: this.toolManager?.currentTool === this.id
        };
    }
    
    /**
     * 消去可能領域検出（将来拡張用）
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {number} radius - 検出半径
     */
    detectErasableArea(x, y, radius) {
        // 将来のスマート消しゴム機能
        // 指定位置周辺の描画オブジェクトを検出
        console.log('🔮 消去可能領域検出（将来実装）');
        return [];
    }
}

export default EraserTool;
}