/**
 * キャンバスへのポインタイベント（マウス、ペン、タッチ）を処理するクラス
 */
class CanvasInteraction {
    constructor(canvas, drawingEngine, viewport, toolStore) {
        this.canvas = canvas;
        this.drawingEngine = drawingEngine;
        this.viewport = viewport;
        this.toolStore = toolStore;

        this.isDrawing = false;
        this.isPanning = false;
        this.lastPosition = { x: 0, y: 0 };
        this.lastPointerCount = 0;
        this.lastTouchDistance = 0;

        this.initListeners();
    }

    initListeners() {
        this.canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
        this.canvas.addEventListener('pointermove', this.onPointerMove.bind(this));
        this.canvas.addEventListener('pointerup', this.onPointerUp.bind(this));
        this.canvas.addEventListener('pointerleave', this.onPointerLeave.bind(this));
        this.canvas.addEventListener('wheel', this.onWheel.bind(this));

        // スマホ・タブレット用のジェスチャーイベント
        this.canvas.addEventListener('touchstart', (e) => this.handleTouch(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouch(e));
        this.canvas.addEventListener('touchend', (e) => this.handleTouch(e));
    }

    onPointerDown(event) {
        event.preventDefault();
        const currentTool = this.toolStore.getCurrentTool();

        if (event.pointerType === 'mouse' && (event.button === 1 || event.buttons === 4)) { // 中ボタンクリック
            this.isPanning = true;
        } else if (currentTool === 'pen' || currentTool === 'eraser') {
            this.isDrawing = true;
            const pos = this.getCanvasCoordinates(event);
            this.drawingEngine.startStroke(pos.x, pos.y);
        } else if (currentTool === 'hand') {
            this.isPanning = true;
        }
        
        this.lastPosition = { x: event.clientX, y: event.clientY };
    }

    onPointerMove(event) {
        event.preventDefault();
        if (this.isPanning) {
            const dx = event.clientX - this.lastPosition.x;
            const dy = event.clientY - this.lastPosition.y;
            this.viewport.pan(dx, dy);
            this.lastPosition = { x: event.clientX, y: event.clientY };
        } else if (this.isDrawing) {
            const pos = this.getCanvasCoordinates(event);
            this.drawingEngine.drawStroke(pos.x, pos.y, event.pressure);
        }
    }

    onPointerUp(event) {
        event.preventDefault();
        if (this.isDrawing) {
            this.drawingEngine.endStroke();
            this.isDrawing = false;
        }
        if (this.isPanning) {
            this.isPanning = false;
        }
    }
    
    onPointerLeave(event) {
        if (this.isDrawing) {
            this.drawingEngine.endStroke();
            this.isDrawing = false;
        }
         if (this.isPanning) {
            this.isPanning = false;
        }
    }

    onWheel(event) {
        event.preventDefault();
        const delta = Math.pow(1.1, -event.deltaY / 100);
        const rect = this.canvas.getBoundingClientRect();
        const pivotX = event.clientX - rect.left;
        const pivotY = event.clientY - rect.top;
        this.viewport.zoom(delta, pivotX, pivotY);
    }
    
     handleTouch(event) {
        event.preventDefault();
        const touches = event.touches;

        if (touches.length === 1) {
            // 1本指: 描画またはパン
            const touch = touches[0];
            const pos = {x: touch.clientX, y: touch.clientY};
            const currentTool = this.toolStore.getCurrentTool();

            if (event.type === 'touchstart') {
                 this.lastPosition = pos;
                 if (currentTool === 'pen' || currentTool === 'eraser') {
                     this.isDrawing = true;
                     const canvasPos = this.getCanvasCoordinates(touch);
                     this.drawingEngine.startStroke(canvasPos.x, canvasPos.y);
                 } else { // handツールなど
                     this.isPanning = true;
                 }
            } else if (event.type === 'touchmove') {
                 if (this.isDrawing) {
                    const canvasPos = this.getCanvasCoordinates(touch);
                    this.drawingEngine.drawStroke(canvasPos.x, canvasPos.y, touch.force || 1.0);
                 } else if (this.isPanning) {
                    const dx = pos.x - this.lastPosition.x;
                    const dy = pos.y - this.lastPosition.y;
                    this.viewport.pan(dx, dy);
                 }
                 this.lastPosition = pos;
            } else if (event.type === 'touchend') {
                if (this.isDrawing) {
                    this.drawingEngine.endStroke();
                    this.isDrawing = false;
                }
                this.isPanning = false;
            }
        } else if (touches.length >= 2) {
            // 2本指: ズームとパン
            this.isDrawing = false; // 2本指になったら描画は中断

            const touch1 = touches[0];
            const touch2 = touches[1];
            const midX = (touch1.clientX + touch2.clientX) / 2;
            const midY = (touch1.clientY + touch2.clientY) / 2;
            const distance = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);

            if (event.type === 'touchstart' || this.lastPointerCount < 2) {
                 this.lastTouchDistance = distance;
                 this.lastPosition = { x: midX, y: midY };
            } else if (event.type === 'touchmove') {
                // Zoom
                const scaleDelta = distance / this.lastTouchDistance;
                const rect = this.canvas.getBoundingClientRect();
                this.viewport.zoom(scaleDelta, midX - rect.left, midY - rect.top);
                this.lastTouchDistance = distance;

                // Pan
                const dx = midX - this.lastPosition.x;
                const dy = midY - this.lastPosition.y;
                this.viewport.pan(dx, dy);
                this.lastPosition = { x: midX, y: midY };
            }
        }
        this.lastPointerCount = touches.length;
    }


    getCanvasCoordinates(event) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = event.clientX - rect.left;
        const screenY = event.clientY - rect.top;
        return this.viewport.screenToWorld(screenX, screenY);
    }
}

export default CanvasInteraction;