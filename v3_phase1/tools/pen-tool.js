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