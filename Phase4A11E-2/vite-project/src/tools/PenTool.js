class PenTool {
    constructor(drawingEngine, penState, colorState) {
        this.drawingEngine = drawingEngine;
        this.penState = penState;
        this.colorState = colorState;
        this.lastPos = null;
    }

    onDrawStart(pos) {
        // 描画設定をStateから取得して適用
        this.drawingEngine.setGlobalCompositeOperation('source-over'); // 通常の描画モード
        this.drawingEngine.setStrokeStyle(this.colorState.color); // ColorStateから色を取得
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
    }
}

export default PenTool;