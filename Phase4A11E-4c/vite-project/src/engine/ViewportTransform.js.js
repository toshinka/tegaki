/**
 * キャンバスのビューポート（表示領域）の変形（ズーム、パン）を管理するクラス
 */
class ViewportTransform {
    constructor(canvas, redrawCallback) {
        this.canvas = canvas;
        this.redrawCallback = redrawCallback;

        this.x = 0;
        this.y = 0;
        this.scale = 1.0;
        this.width = canvas.width;
        this.height = canvas.height;

        this.minScale = 0.1;
        this.maxScale = 20.0;
    }

    /**
     * ビューポートのサイズを更新
     * @param {number} width - 新しい幅
     * @param {number} height - 新しい高さ
     */
    updateSize(width, height) {
        this.width = width;
        this.height = height;
    }

    /**
     * ズーム処理
     * @param {number} delta - スケールの変化量
     * @param {number} pivotX - ズームの中心X座標 (キャンバス座標)
     * @param {number} pivotY - ズームの中心Y座標 (キャンバス座標)
     */
    zoom(delta, pivotX, pivotY) {
        const oldScale = this.scale;
        const newScale = Math.max(this.minScale, Math.min(this.maxScale, oldScale * delta));
        
        const scaleRatio = newScale / oldScale;

        this.x = pivotX - (pivotX - this.x) * scaleRatio;
        this.y = pivotY - (pivotY - this.y) * scaleRatio;
        this.scale = newScale;

        this.redrawCallback();
    }

    /**
     * パン（移動）処理
     * @param {number} dx - X方向の移動量
     * @param {number} dy - Y方向の移動量
     */
    pan(dx, dy) {
        this.x += dx;
        this.y += dy;
        this.redrawCallback();
    }

    /**
     * 現在の変形行列を取得
     * @returns {Float32Array} 3x3の変形行列
     */
    getTransform() {
        // WebGLのNDCに合わせるための変換
        // 1. 平行移動
        // 2. スケーリング
        // 3. キャンバスサイズで正規化
        const tx = 2.0 * this.x / this.width;
        const ty = -2.0 * this.y / this.height;
        const sx = this.scale * this.width / this.width; // 今は幅で正規化してるが、テクスチャサイズ基準にするべきかも
        const sy = this.scale * this.height / this.height;

        // 3x3のアフィン変換行列 (列優先順序)
        // WebGLは列優先なので、この順番で格納する
        return new Float32Array([
            sx, 0, 0,
            0, sy, 0,
            tx, ty, 1
        ]);
    }
    
    /**
     * スクリーン座標からワールド座標（キャンバスのピクセル座標）へ変換
     * @param {number} screenX - スクリーンX座標
     * @param {number} screenY - スクリーンY座標
     * @returns {{x: number, y: number}} ワールド座標
     */
    screenToWorld(screenX, screenY) {
        const worldX = (screenX - this.x) / this.scale;
        const worldY = (screenY - this.y) / this.scale;
        return { x: worldX, y: worldY };
    }
}

export default ViewportTransform;