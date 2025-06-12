// ColorManager.js
class ColorManager {
    constructor(app) {
        this.app = app; // FutabaTegakiToolインスタンスへの参照
        this.mainColor = '#800000'; // 初期メインカラー
        this.subColor = '#f0e0d6';  // 初期サブカラー
        this.currentColor = this.mainColor; // 現在の描画色をメインカラーに設定
        this.colors = Array.from(document.querySelectorAll('.color-btn')).map(btn => btn.dataset.color);
        this.currentColorIndex = this.colors.indexOf(this.currentColor);

        this.mainColorDisplay = document.getElementById('main-color-display');
        this.subColorDisplay = document.getElementById('sub-color-display');

        this.bindEvents();
        this.updateColorDisplays();
        // 初期のアクティブカラーボタンをメインカラーに設定
        document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-color="${this.mainColor}"]`)?.classList.add('active');
    }

    bindEvents() {
        document.querySelectorAll('.color-btn').forEach(btn => btn.addEventListener('click', (e) => this.setColor(e.currentTarget.dataset.color)));
        document.querySelector('.color-mode-display').addEventListener('click', () => this.swapColors());
    }

    setColor(color) {
        this.mainColor = color;
        this.currentColor = this.mainColor;
        this.currentColorIndex = this.colors.indexOf(this.mainColor);

        document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-color="${color}"]`)?.classList.add('active');
        this.updateColorDisplays();
        // CanvasManagerに現在の色を通知するなど
        this.app.canvasManager.setCurrentColor(this.currentColor);
    }

    setSubColor(color) {
        this.subColor = color;
        this.updateColorDisplays();
    }

    updateColorDisplays() {
        this.mainColorDisplay.style.backgroundColor = this.mainColor;
        this.subColorDisplay.style.backgroundColor = this.subColor;
    }

    swapColors() {
        [this.mainColor, this.subColor] = [this.subColor, this.mainColor];
        this.currentColor = this.mainColor;
        this.updateColorDisplays();
        document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-color="${this.mainColor}"]`)?.classList.add('active');
        this.app.canvasManager.setCurrentColor(this.currentColor);
    }

    resetColors() {
        this.mainColor = '#800000';
        this.subColor = '#f0e0d6';
        this.currentColor = this.mainColor;
        this.updateColorDisplays();
        document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-color="${this.mainColor}"]`)?.classList.add('active');
        this.app.canvasManager.setCurrentColor(this.currentColor);
    }

    changeColor(increase) {
        let newIndex = this.currentColorIndex + (increase ? 1 : -1);
        newIndex = Math.max(0, Math.min(newIndex, this.colors.length - 1));
        this.setColor(this.colors[newIndex]);
    }

    getCurrentColor() {
        return this.currentColor;
    }

    // 予告: カラーパレット（5色→10色化はカラーサークル実装時）
    // 難易度：低｜優先度：後

    // 予告: カラーサークル
    // 難易度：高｜優先度：後
    // ※実装時にパレット横並び化、ペンサイズプリセットも横置き化予定

    // 予告: カラー表示（16進数・RGB切替）
    // 難易度：中｜優先度：後

    // 予告: 設定アイコン（ショートカット・補正設定）
    // 難易度：中｜優先度：後
}