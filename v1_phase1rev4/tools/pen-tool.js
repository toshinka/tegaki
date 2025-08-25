/**
 * ✏️ PenTool Updated - レイヤー分離対応版
 * 📋 RESPONSIBILITY: ベクター描画処理のみ（アクティブレイヤーに描画）
 * 🚫 PROHIBITION: レイヤー操作・UI通知・座標変換
 * ✅ PERMISSION: PIXI.Graphics作成・線描画・CanvasManagerへの渡し
 * 
 * 📏 DESIGN_PRINCIPLE: ベクターペン専門・アクティブレイヤー描画
 * 🔄 INTEGRATION: CanvasManagerのaddGraphicsToLayer使用
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

/**
 * PenTool - レイヤー分離対応版
 * アクティブレイヤーにベクター描画する専任クラス
 */
class PenTool {
    constructor() {
        console.log('✏️ PenTool レイヤー分離対応版 作成');
        
        this.canvasManager = null;
        this.isDrawing = false;
        this.currentPath = null;
        this.points = [];
        
        // ペン設定
        this.color = 0x800000;        // ふたば風マルーン
        this.lineWidth = 4;           // デフォルト線幅
        this.opacity = 1.0;           // 不透明度
        
        // ベクター設定
        this.smoothing = true;        // スムージング有効
        this.pressureSensitive = false; // 筆圧感度（Phase1では無効）
    }
    
    /**
     * CanvasManager設定
     */
    setCanvasManager(canvasManager) {
        this.canvasManager = canvasManager;
        console.log('✏️ PenTool - CanvasManager設定完了');
    }
    
    /**
     * 描画開始
     */
    onPointerDown(x, y, event) {
        if (!this.canvasManager) {
            console.warn('⚠️ CanvasManager not set');
            return;
        }
        
        // アクティブレイヤー確認
        const activeLayerId = this.canvasManager.getActiveLayerId();
        console.log(`✏️ 描画開始: layer=${activeLayerId}, pos=(${x}, ${y})`);
        
        this.isDrawing = true;
        this.points = [{x, y}];
        
        // 新しい描画パス作成
        this.currentPath = new PIXI.Graphics();
        
        // ペンスタイル設定（PixiJSの標準機能活用）
        this.currentPath.lineStyle({
            width: this.lineWidth,
            color: this.color,
            alpha: this.opacity,
            cap: PIXI.LINE_CAP.ROUND,      // 丸い線端
            join: PIXI.LINE_JOIN.ROUND     // 丸い結合部
        });
        
        // 描画開始点設定
        this.currentPath.moveTo(x, y);
        
        // 開始点に小さな円を描画（点描画対応）
        this.currentPath.beginFill(this.color, this.opacity);
        this.currentPath.drawCircle(x, y, this.lineWidth / 2);
        this.currentPath.endFill();
        
        // アクティブレイヤーに追加
        this.canvasManager.addGraphicsToLayer(this.currentPath);
    }
    
    /**
     * 描画継続
     */
    onPointerMove(x, y, event) {
        if (!this.isDrawing || !this.currentPath) return;
        
        // 点を記録
        this.points.push({x, y});
        
        if (this.smoothing && this.points.length > 2) {
            // スムーズな曲線描画（ベジェカーブ）
            this.drawSmoothLine();
        } else {
            // 直線描画
            this.currentPath.lineTo(x, y);
        }
        
        // 線の隙間を円で埋める（滑らかな描画）
        this.currentPath.beginFill(this.color, this.opacity);
        this.currentPath.drawCircle(x, y, this.lineWidth / 2);
        this.currentPath.endFill();
    }
    
    /**
     * 描画終了
     */
    onPointerUp(x, y, event) {
        if (!this.isDrawing || !this.currentPath) return;
        
        // 最終点追加
        this.points.push({x, y});
        this.currentPath.lineTo(x, y);
        
        // 最終点に円描画
        this.currentPath.beginFill(this.color, this.opacity);
        this.currentPath.drawCircle(x, y, this.lineWidth / 2);
        this.currentPath.endFill();
        
        // 描画完了処理
        this.isDrawing = false;
        const pathLength = this.points.length;
        const activeLayerId = this.canvasManager.getActiveLayerId();
        
        console.log(`✅ 描画完了: layer=${activeLayerId}, pathPoints=${pathLength}, color=0x${this.color.toString(16)}`);
        
        // リセット
        this.currentPath = null;
        this.points = [];
    }
    
    /**
     * スムーズな曲線描画（ベジェカーブ使用）
     */
    drawSmoothLine() {
        if (this.points.length < 3) return;
        
        const len = this.points.length;
        const p1 = this.points[len - 3];
        const p2 = this.points[len - 2];
        const p3 = this.points[len - 1];
        
        // 制御点計算（簡易スムージング）
        const cp1x = p1.x + (p2.x - p1.x) * 0.5;
        const cp1y = p1.y + (p2.y - p1.y) * 0.5;
        const cp2x = p2.x + (p3.x - p2.x) * 0.5;
        const cp2y = p2.y + (p3.y - p2.y) * 0.5;
        
        // ベジェカーブ描画
        this.currentPath.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p3.x, p3.y);
    }
    
    /**
     * ペン色設定
     */
    setPenColor(color) {
        if (typeof color === 'string') {
            // 文字列色を16進数に変換
            this.color = parseInt(color.replace('#', ''), 16);
        } else if (typeof color === 'number') {
            this.color = color;
        } else {
            console.warn('⚠️ 無効な色指定:', color);
            return;
        }
        
        console.log(`✏️ ペン色変更: 0x${this.color.toString(16)}`);
    }
    
    /**
     * ペン線幅設定
     */
    setPenWidth(width) {
        if (width > 0 && width <= 100) {
            this.lineWidth = width;
            console.log(`✏️ ペン線幅変更: ${width}px`);
        } else {
            console.warn(`⚠️ 無効な線幅: ${width} (1-100の範囲で指定してください)`);
        }
    }
    
    /**
     * ペン透明度設定
     */
    setPenOpacity(opacity) {
        if (opacity >= 0 && opacity <= 1) {
            this.opacity = opacity;
            console.log(`✏️ ペン透明度変更: ${opacity}`);
        } else {
            console.warn(`⚠️ 無効な透明度: ${opacity} (0.0-1.0の範囲で指定してください)`);
        }
    }
    
    /**
     * スムージング設定
     */
    setSmoothing(enabled) {
        this.smoothing = enabled;
        console.log(`✏️ スムージング: ${enabled ? '有効' : '無効'}`);
    }
    
    /**
     * 設定取得
     */
    getSettings() {
        return {
            color: this.color,
            lineWidth: this.lineWidth,
            opacity: this.opacity,
            smoothing: this.smoothing,
            pressureSensitive: this.pressureSensitive
        };
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            isDrawing: this.isDrawing,
            canvasManagerSet: !!this.canvasManager,
            hasCurrentPath: !!this.currentPath,
            pathLength: this.points.length,
            settings: this.getSettings()
        };
    }
}

// Tegaki名前空間に登録
window.Tegaki.PenTool = PenTool;

console.log('✏️ PenTool レイヤー分離対応版 Loaded - アクティブレイヤー描画対応');