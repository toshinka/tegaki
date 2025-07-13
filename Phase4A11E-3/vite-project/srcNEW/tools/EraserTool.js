class EraserTool {
    constructor(drawingEngine, penState) {
        this.drawingEngine = drawingEngine;
        this.penState = penState; // 消しゴムの太さはペンの太さと共有
        this.lastPos = null;
    }

    onDrawStart(pos) {
        // 描画設定を消しゴム用に変更
        this.drawingEngine.setGlobalCompositeOperation('destination-out'); // 消しゴムモード
        this.drawingEngine.setLineWidth(this.penState.size);
        this.drawingEngine.setLineCap('round');
        this.drawingEngine.setLineJoin('round');

        this.drawingEngine.beginPath();
        this.drawingEngine.moveTo(pos.x, pos.y);
        this.lastPos = pos;
    }

    onDrawMove(pos) {
        this.drawingEngine.lineTo(this.lastPos.x, this.lastPos.y, pos.x, pos.y);
        this.drawingEngine.stroke();
        this.lastPos = pos;
    }

    onDrawEnd(pos) {
        this.drawingEngine.closePath();
        this.lastPos = null;
        // 重要：描画モードを通常に戻しておく
        this.drawingEngine.setGlobalCompositeOperation('source-over');
    }
}

export default EraserTool;