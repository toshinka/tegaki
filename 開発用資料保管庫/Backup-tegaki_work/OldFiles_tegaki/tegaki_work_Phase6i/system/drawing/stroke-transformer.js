/**
 * StrokeTransformer - ストローク変形専用クラス（簡素化版）
 * 
 * 責務: レイヤー変形のストロークへの適用のみ
 * スムージングはperfect-freehandに統一
 */

class StrokeTransformer {
    constructor(config) {
        this.config = config || {};
    }

    /**
     * レイヤー変形をストロークに適用
     * @param {PIXI.DisplayObject} strokeObject - Mesh or Graphics
     * @param {Object} transform - { x, y, rotation, scale }
     * @param {number} canvasWidth
     * @param {number} canvasHeight
     */
    applyTransformToStroke(strokeObject, transform, canvasWidth, canvasHeight) {
        if (!strokeObject || !transform) return;

        // 変形が初期値の場合は何もしない
        if (this.isIdentityTransform(transform)) {
            return;
        }

        // 変形行列作成
        const matrix = this.createTransformMatrix(transform, canvasWidth, canvasHeight);

        // オブジェクトに変形適用
        strokeObject.setFromMatrix(matrix);
    }

    /**
     * 変形が初期値（恒等変換）かチェック
     * @param {Object} transform
     * @returns {boolean}
     */
    isIdentityTransform(transform) {
        if (!transform) return true;

        return (
            transform.x === 0 &&
            transform.y === 0 &&
            transform.rotation === 0 &&
            transform.scale === 1
        );
    }

    /**
     * 変形用のMatrix生成
     * @param {Object} transform
     * @param {number} canvasWidth
     * @param {number} canvasHeight
     * @returns {PIXI.Matrix}
     */
    createTransformMatrix(transform, canvasWidth, canvasHeight) {
        const matrix = new PIXI.Matrix();

        // キャンバス中心を基準点とする
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;

        // 変形適用順序: 平行移動 → 回転 → スケール
        matrix.translate(-centerX, -centerY);
        matrix.rotate(transform.rotation * Math.PI / 180); // 度→ラジアン
        matrix.scale(transform.scale, transform.scale);
        matrix.translate(centerX + transform.x, centerY + transform.y);

        return matrix;
    }

    /**
     * ストロークのバウンディングボックスを取得
     * @param {PIXI.DisplayObject} strokeObject
     * @returns {Object} { x, y, width, height }
     */
    getStrokeBounds(strokeObject) {
        if (!strokeObject) {
            return { x: 0, y: 0, width: 0, height: 0 };
        }

        const bounds = strokeObject.getBounds();
        return {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height
        };
    }
}

// グローバル登録
if (typeof window.TegakiDrawing === 'undefined') {
    window.TegakiDrawing = {};
}
window.TegakiDrawing.StrokeTransformer = StrokeTransformer;