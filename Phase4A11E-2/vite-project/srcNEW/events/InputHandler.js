class InputHandler {
    constructor(canvas) {
        this.canvas = canvas;
        this.isDrawing = false;
        this.listeners = {}; // イベントリスナーを格納するオブジェクト

        // イベントを登録
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e)); // キャンバスから出たら描画終了
    }

    // イベントリスナーを登録するメソッド
    on(eventName, callback) {
        if (!this.listeners[eventName]) {
            this.listeners[eventName] = [];
        }
        this.listeners[eventName].push(callback);
    }

    // イベントを発火させるメソッド
    emit(eventName, data) {
        if (this.listeners[eventName]) {
            this.listeners[eventName].forEach(callback => callback(data));
        }
    }

    getMousePos(event) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }

    handleMouseDown(event) {
        this.isDrawing = true;
        const pos = this.getMousePos(event);
        this.emit('drawStart', pos);
    }

    handleMouseMove(event) {
        if (!this.isDrawing) return;
        const pos = this.getMousePos(event);
        this.emit('drawMove', pos);
    }

    handleMouseUp(event) {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        const pos = this.getMousePos(event);
        this.emit('drawEnd', pos);
    }
}

export default InputHandler;