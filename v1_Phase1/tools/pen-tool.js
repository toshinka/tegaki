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
 * PenTool - シンプル版（40行以内）
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
        this.lineWidth = 3;
        this.opacity = 0.8;
    }
    
    /**
     * CanvasManager設定
     */
    setCanvasManager(canvasManager) {
        this.canvasManager = canvasManager;
        console.log('✅ PenTool - CanvasManager設定完了');
    }
    
    /**
     * 描画開始
     */
    onPointerDown(x, y, event) {
        if (!this.canvasManager) {
            console.warn('⚠️ PenTool - CanvasManager not available');
            return;
        }
        
        this.isDrawing = true;
        this.lastPoint = { x, y };
        
        // 新しいGraphics作成
        this.currentGraphics = new PIXI.Graphics();
        this.currentGraphics.lineStyle(this.lineWidth, this.color, this.opacity);
        this.currentGraphics.moveTo(x, y);
        
        // 開始点に小さな点を描画
        this.currentGraphics.beginFill(this.color, this.opacity);
        this.currentGraphics.drawCircle(x, y, this.lineWidth / 2);
        this.currentGraphics.endFill();
        
        // CanvasManagerのレイヤーに追加
        this.canvasManager.addGraphicsToLayer(this.currentGraphics, 'main');
        
        console.log(`🖊️ PenTool - 描画開始: (${x}, ${y})`);
    }
    
    /**
     * 描画継続
     */
    onPointerMove(x, y, event) {
        if (!this.isDrawing || !this.currentGraphics) return;
        
        // 前の点から現在の点まで線を描画
        this.currentGraphics.lineTo(x, y);
        
        // 滑らかな線のために小さな円を描画
        this.currentGraphics.beginFill(this.color, this.opacity);
        this.currentGraphics.drawCircle(x, y, this.lineWidth / 3);
        this.currentGraphics.endFill();
        
        this.lastPoint = { x, y };
    }
    
    /**
     * 描画終了
     */
    onPointerUp(x, y, event) {
        if (!this.isDrawing || !this.currentGraphics) return;
        
        // 最終点まで描画
        this.currentGraphics.lineTo(x, y);
        
        // 終了点に点を描画
        this.currentGraphics.beginFill(this.color, this.opacity);
        this.currentGraphics.drawCircle(x, y, this.lineWidth / 2);
        this.currentGraphics.endFill();
        
        this.isDrawing = false;
        this.currentGraphics = null;
        
        console.log(`✅ PenTool - 描画完了: (${x}, ${y})`);
    }
    
    /**
     * ペン設定
     */
    setPenColor(color) {
        this.color = typeof color === 'string' ? parseInt(color.replace('#', '0x'), 16) : color;
        console.log(`✅ PenTool - 色変更: ${color}`);
    }
    
    setPenWidth(width) {
        this.lineWidth = Math.max(1, Math.min(50, width));
        console.log(`✅ PenTool - 線幅変更: ${this.lineWidth}`);
    }
    
    setPenOpacity(opacity) {
        this.opacity = Math.max(0, Math.min(1, opacity));
        console.log(`✅ PenTool - 透明度変更: ${this.opacity}`);
    }
    
    /**
     * 現在の設定取得
     */
    getSettings() {
        return {
            color: this.color,
            lineWidth: this.lineWidth,
            opacity: this.opacity,
            isDrawing: this.isDrawing
        };
    }
}

// Tegaki名前空間に登録
window.Tegaki.PenTool = PenTool;

console.log('🖊️ PenTool Simple Loaded - シンプル線描画');