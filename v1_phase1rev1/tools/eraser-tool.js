/**
 * 🧹 EraserTool Simple - シンプル消しゴムツール
 * 📋 RESPONSIBILITY: 消去処理のみ
 * 🚫 PROHIBITION: 複雑な範囲計算・部分消去・レイヤー操作
 * ✅ PERMISSION: PIXI.Graphics作成・消去描画・CanvasManagerに渡す
 * 
 * 📏 DESIGN_PRINCIPLE: 単純・直線的・消去専門
 * 🔄 INTEGRATION: 消去用Graphicsを作成してCanvasManagerに渡す
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

/**
 * EraserTool - シンプル版（25行以内）
 * 消去処理の専任
 */
class EraserTool {
    constructor() {
        console.log('🧹 EraserTool Simple 作成');
        
        this.canvasManager = null;
        this.isErasing = false;
        this.currentGraphics = null;
        
        // 消しゴム設定
        this.eraserSize = 20;
    }
    
    /**
     * CanvasManager設定
     */
    setCanvasManager(canvasManager) {
        this.canvasManager = canvasManager;
    }
    
    /**
     * 消去開始
     */
    onPointerDown(x, y, event) {
        if (!this.canvasManager) return;
        
        this.isErasing = true;
        
        // 消去用Graphics作成（背景色で描画）
        this.currentGraphics = new PIXI.Graphics();
        this.currentGraphics.lineStyle(this.eraserSize, 0xffffee, 1.0); // 背景色で消去
        this.currentGraphics.moveTo(x, y);
        
        // 消去マーク描画
        this.currentGraphics.beginFill(0xffffee);
        this.currentGraphics.drawCircle(x, y, this.eraserSize / 2);
        this.currentGraphics.endFill();
        
        // CanvasManagerのレイヤーに追加
        this.canvasManager.addGraphicsToLayer(this.currentGraphics, 'main');
    }
    
    /**
     * 消去継続
     */
    onPointerMove(x, y, event) {
        if (!this.isErasing || !this.currentGraphics) return;
        
        // 消去線を描画
        this.currentGraphics.lineTo(x, y);
        
        // 消去円を描画
        this.currentGraphics.beginFill(0xffffee);
        this.currentGraphics.drawCircle(x, y, this.eraserSize / 2);
        this.currentGraphics.endFill();
    }
    
    /**
     * 消去終了
     */
    onPointerUp(x, y, event) {
        if (!this.isErasing || !this.currentGraphics) return;
        
        // 最終消去
        this.currentGraphics.lineTo(x, y);
        this.currentGraphics.beginFill(0xffffee);
        this.currentGraphics.drawCircle(x, y, this.eraserSize / 2);
        this.currentGraphics.endFill();
        
        this.isErasing = false;
        this.currentGraphics = null;
        
        console.log('✅ EraserTool - 消去完了');
    }
    
    /**
     * 消しゴムサイズ設定
     */
    setEraserSize(size) {
        this.eraserSize = size;
    }
}

// Tegaki名前空間に登録
window.Tegaki.EraserTool = EraserTool;

console.log('🧹 EraserTool Simple Loaded - シンプル消去処理');