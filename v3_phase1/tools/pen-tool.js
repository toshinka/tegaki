/**
 * 🖊️ PenTool Simple - シンプルペンツール
 * 📋 RESPONSIBILITY: 線の描画のみ
 * 🚫 PROHIBITION: レイヤー操作・座標変換・複雑な筆圧処理
 * ✅ PERMISSION: PIXI.Graphics作成・線描画・CanvasManagerに渡す
 * 
 * 📏 DESIGN_PRINCIPLE: 単純・直線的・描画専門
 * 🔄 INTEGRATION: マウス/タッチから線を描画してCanvasManagerに渡す
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

/**
 * PenTool - シンプル版（25行以内）
 * 線描画の専任
 */
class PenTool {
    constructor() {
        console.log('🖊️ PenTool Simple 作成');
        
        this.canvasManager = null;
        this.isDrawing = false;
        this.currentGraphics = null;
        this.lastPoint = { x: 0, y: 0 };
        
        // 描画設定
        this.color = 0x800000;  // ふたば風赤
        this.lineWidth = 2;
    }
    
    /**
     * CanvasManager設定
     */
    setCanvasManager(canvasManager) {
        this.canvasManager = canvasManager;
    }
    
    /**
     * 描画開始
     */
    onPointerDown(x, y, event) {
        if (!this.canvasManager) return;
        
        this.isDrawing = true;
        this.lastPoint = { x, y };
        
        // 新しいGraphics作成
        this.currentGraphics = new PIXI.Graphics();
        this.currentGraphics.lineStyle(this.lineWidth, this.color, 1.0);
        this.currentGraphics.moveTo(x, y);
        
        // 開始点の描画
        this.currentGraphics.beginFill(this.color);
        this.currentGraphics.drawCircle(x, y, this.lineWidth / 2);
        this.currentGraphics.endFill();
        
        // CanvasManagerのレイヤーに追加
        this.canvasManager.addGraphicsToLayer(this.currentGraphics, 'main');
    }
    
    /**
     * 描画継続
     */
    onPointerMove(x, y, event) {
        if (!this.isDrawing || !this.currentGraphics) return;
        
        // 前の点から現在の点まで線を描画
        this.currentGraphics.lineTo(x, y);
        this.lastPoint = { x, y };
    }
    
    /**
     * 描画終了
     */
    onPointerUp(x, y, event) {
        if (!this.isDrawing || !this.currentGraphics) return;
        
        // 最終線の描画
        this.currentGraphics.lineTo(x, y);
        
        // 終点の描画
        this.currentGraphics.beginFill(this.color);
        this.currentGraphics.drawCircle(x, y, this.lineWidth / 2);
        this.currentGraphics.endFill();
        
        this.isDrawing = false;
        this.currentGraphics = null;
        
        console.log('✅ PenTool - 描画完了');
    }
    
    /**
     * ペン色設定
     */
    setPenColor(color) {
        this.color = color;
    }
    
    /**
     * ペン太さ設定
     */
    setPenWidth(width) {
        this.lineWidth = width;
    }
}

// Tegaki名前空間に登録
window.Tegaki.PenTool = PenTool;

console.log('🖊️ PenTool Simple Loaded - シンプル描画処理');