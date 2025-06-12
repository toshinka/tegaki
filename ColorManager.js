// ColorManager.js
/**
 * ColorManagerクラス
 * メイン/サブカラー、カラーパレットの選択と表示を管理します。
 */
class ColorManager {
    /**
     * @param {FutabaTegakiTool} app - メインアプリケーションのインスタンス
     */
    constructor(app) {
        this.app = app; // FutabaTegakiToolインスタンスへの参照
        this.mainColor = '#800000'; // 初期メインカラー
        this.subColor = '#f0e0d6';  // 初期サブカラー
        this.currentColor = this.mainColor; // 現在の描画色をメインカラーに設定
        // HTMLからカラーボタンのデータ属性を読み込み
        this.colors = Array.from(document.querySelectorAll('.color-btn')).map(btn => btn.dataset.color);
        this.currentColorIndex = this.colors.indexOf(this.currentColor); // 現在のメインカラーのインデックス

        this.mainColorDisplay = document.getElementById('main-color-display');
        this.subColorDisplay = document.getElementById('sub-color-display');

        this.bindEvents();
        this.updateColorDisplays();
        // 初期のアクティブカラーボタンをメインカラーに設定
        document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-color="${this.mainColor}"]`)?.classList.add('active');
    }

    /**
     * カラー選択やモード切り替えボタンのイベントリスナーをバインドします。
     */
    bindEvents() {
        // カラーボタンのクリックイベント
        document.querySelectorAll('.color-btn').forEach(btn => btn.addEventListener('click', (e) => this.setColor(e.currentTarget.dataset.color)));
        // メイン/サブカラー表示領域のクリックイベント（色入れ替え）
        document.querySelector('.color-mode-display').addEventListener('click', () => this.swapColors());
    }

    /**
     * メインカラーを設定し、現在の描画色もそれに同期させます。
     * @param {string} color - 設定する色 (例: '#RRGGBB')
     */
    setColor(color) {
        this.mainColor = color; // メインカラーを更新
        this.currentColor = this.mainColor; // 現在の描画色をメインカラーに同期
        this.currentColorIndex = this.colors.indexOf(this.mainColor); // インデックスも更新

        // アクティブなカラーボタンを更新
        document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-color="${color}"]`)?.classList.add('active');

        this.updateColorDisplays(); // メイン/サブカラー表示を更新
        // CanvasManagerに現在の色を通知
        this.app.canvasManager.setCurrentColor(this.currentColor);
    }

    /**
     * サブカラーを設定します。
     * @param {string} color - 設定する色 (例: '#RRGGBB')
     */
    setSubColor(color) {
        this.subColor = color;
        this.updateColorDisplays();
    }

    /**
     * メイン/サブカラー表示領域の背景色を更新します。
     */
    updateColorDisplays() {
        this.mainColorDisplay.style.backgroundColor = this.mainColor;
        this.subColorDisplay.style.backgroundColor = this.subColor;
    }

    /**
     * メインカラーとサブカラーを入れ替えます。
     */
    swapColors() {
        [this.mainColor, this.subColor] = [this.subColor, this.mainColor]; // 配列のデストラクチャリングで入れ替え
        this.currentColor = this.mainColor; // 現在の描画色を新しいメインカラーに同期
        this.updateColorDisplays();
        // アクティブなカラーボタンも新しいメインカラーに同期
        document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-color="${this.mainColor}"]`)?.classList.add('active');
        this.app.canvasManager.setCurrentColor(this.currentColor);
    }

    /**
     * メインカラーとサブカラーを初期値にリセットします。
     */
    resetColors() {
        this.mainColor = '#800000';
        this.subColor = '#f0e0d6';
        this.currentColor = this.mainColor; // 現在の描画色をリセットされたメインカラーに同期
        this.updateColorDisplays();
        // アクティブなカラーボタンもリセットされたメインカラーに同期
        document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-color="${this.mainColor}"]`)?.classList.add('active');
        this.app.canvasManager.setCurrentColor(this.currentColor);
    }

    /**
     * カラーパレットの色を増減させます。（キーボードショートカット用）
     * @param {boolean} increase - trueなら次の色、falseなら前の色
     */
    changeColor(increase) {
        let newIndex = this.currentColorIndex + (increase ? 1 : -1);
        // インデックスが配列の範囲内に収まるように制限
        newIndex = Math.max(0, Math.min(newIndex, this.colors.length - 1));
        this.setColor(this.colors[newIndex]);
    }

    /**
     * 現在の描画色を返します。
     * @returns {string} 現在の描画色
     */
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
