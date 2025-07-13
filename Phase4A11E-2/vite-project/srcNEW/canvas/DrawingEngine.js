class DrawingEngine {
    constructor(context) {
        this.ctx = context;
        this.lastPos = { x: 0, y: 0 };
    }

    // --- 設定系メソッド ---
    setStrokeStyle(style) { this.ctx.strokeStyle = style; }
    setLineWidth(width) { this.ctx.lineWidth = width; }
    setLineCap(cap) { this.ctx.lineCap = cap; }
    setLineJoin(join) { this.ctx.lineJoin = join; }
    setGlobalCompositeOperation(operation) { this.ctx.globalCompositeOperation = operation; }

    // --- 描画系メソッド ---
    beginPath() { this.ctx.beginPath(); }
    moveTo(x, y) { 
        this.ctx.moveTo(x, y);
        this.lastPos = { x, y };
    }
    // 連続した線を滑らかに描くため、始点と終点を引数に取るように変更
    lineTo(fromX, fromY, toX, toY) {
        this.ctx.beginPath(); // 各セグメントを独立したパスにする
        this.ctx.moveTo(fromX, fromY);
        this.ctx.lineTo(toX, toY);
    }
    stroke() { this.ctx.stroke(); }
    closePath() { this.ctx.closePath(); }
}

export default DrawingEngine;