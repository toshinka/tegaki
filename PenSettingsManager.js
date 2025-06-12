// PenSettingsManager.js
/**
 * PenSettingsManagerクラス
 * ペンのサイズ設定を管理します。
 */
class PenSettingsManager {
    /**
     * @param {FutabaTegakiTool} app - メインアプリケーションのインスタンス
     */
    constructor(app) {
        this.app = app;
        this.currentSize = 1; // 現在のペンサイズ
        // HTMLからサイズボタンのデータ属性を読み込み、整数に変換
        this.sizes = Array.from(document.querySelectorAll('.size-btn')).map(btn => parseInt(btn.dataset.size));
        this.currentSizeIndex = this.sizes.indexOf(this.currentSize); // 現在のサイズが配列内のどこにあるかのインデックス

        this.bindEvents();
        // 初期のアクティブサイズボタンを設定
        document.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-size="${this.currentSize}"]`)?.classList.add('active');
        this.updateSizeButtonVisuals(); // サイズボタンの初期表示を更新
    }

    /**
     * サイズボタンのイベントリスナーをバインドします。
     */
    bindEvents() {
        document.querySelectorAll('.size-btn').forEach(btn => btn.addEventListener('click', () => this.setSize(parseInt(btn.dataset.size))));
    }

    /**
     * ペンサイズを設定します。
     * @param {number} size - 設定するペンサイズ
     */
    setSize(size) {
        this.currentSize = size;
        this.currentSizeIndex = this.sizes.indexOf(this.currentSize);
        // 全てのサイズボタンのアクティブ状態を解除
        document.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('active'));
        // 現在選択されたサイズボタンにアクティブクラスを追加
        document.querySelector(`[data-size="${size}"]`)?.classList.add('active');
        this.updateSizeButtonVisuals(); // サイズボタンの表示を更新
        // CanvasManagerにサイズを通知
        this.app.canvasManager.setCurrentSize(this.currentSize); 
    }

    /**
     * ペンサイズを増減させます。
     * @param {boolean} increase - trueならサイズを大きく、falseなら小さくする
     */
    changeSize(increase) {
        let newIndex = this.currentSizeIndex + (increase ? 1 : -1);
        // インデックスが配列の範囲内に収まるように制限
        newIndex = Math.max(0, Math.min(newIndex, this.sizes.length - 1));
        this.setSize(this.sizes[newIndex]);
    }

    /**
     * 現在のサイズボタンの◎と数値を視覚的に更新します。
     */
    updateSizeButtonVisuals() {
        document.querySelectorAll('.size-btn').forEach(btn => {
            const size = parseInt(btn.dataset.size);
            const sizeDot = btn.querySelector('.size-dot');
            const sizeNumber = btn.querySelector('.size-number');
            
            if (sizeDot) {
                // 内側の●のサイズを調整（最大16pxに制限、外枠の内部が16pxのため）
                const dotSize = Math.min(size, 16); 
                sizeDot.style.width = `${dotSize}px`;
                sizeDot.style.height = `${dotSize}px`;
            }
            if (sizeNumber) {
                sizeNumber.textContent = size;
            }
        });
    }

    /**
     * 現在のペンサイズを返します。
     * @returns {number} 現在のペンサイズ
     */
    getCurrentSize() {
        return this.currentSize;
    }

    // 予告: ペンサイズ変更（スライダー＋矢印）
    // 難易度：中｜優先度：中

    // 予告: ペン透明度（スライダー＋数値＋100％トグル）
    // 難易度：中｜優先度：中
}
