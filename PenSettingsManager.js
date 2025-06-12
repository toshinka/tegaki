// PenSettingsManager.js
class PenSettingsManager {
    constructor(app) {
        this.app = app;
        this.currentSize = 1;
        this.sizes = Array.from(document.querySelectorAll('.size-btn')).map(btn => parseInt(btn.dataset.size));
        this.currentSizeIndex = this.sizes.indexOf(this.currentSize);

        this.bindEvents();
        // 初期のアクティブサイズボタンを設定
        document.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-size="${this.currentSize}"]`)?.classList.add('active');
    }

    bindEvents() {
        document.querySelectorAll('.size-btn').forEach(btn => btn.addEventListener('click', () => this.setSize(parseInt(btn.dataset.size))));
    }

    setSize(size) {
        this.currentSize = size;
        this.currentSizeIndex = this.sizes.indexOf(this.currentSize);
        document.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-size="${size}"]`)?.classList.add('active');
        this.app.canvasManager.setCurrentSize(this.currentSize); // CanvasManagerにサイズを通知
    }

    changeSize(increase) {
        let newIndex = this.currentSizeIndex + (increase ? 1 : -1);
        newIndex = Math.max(0, Math.min(newIndex, this.sizes.length - 1));
        this.setSize(this.sizes[newIndex]);
    }

    getCurrentSize() {
        return this.currentSize;
    }

    // 予告: ペンサイズ変更（スライダー＋矢印）
    // 難易度：中｜優先度：中

    // 予告: ペン透明度（スライダー＋数値＋100％トグル）
    // 難易度：中｜優先度：中
}