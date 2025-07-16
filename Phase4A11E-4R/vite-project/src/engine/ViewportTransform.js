/**
 * [クラス責務] ViewportTransform.js
 * 目的：キャンバスの表示領域（ビューポート）の制御と、描画命令の仲介を行う。
 * 責務：
 * 1. ビューポート操作：ユーザー入力に基づいたズーム、パン、回転、反転などの視点操作を管理・適用する。
 * 2. 描画の仲介役（ブリッジ）：高レベルな描画要求（e.g., "線を描く"）を受け取り、それを低レベルなWebGLRendererに伝達する。
 */
export class ViewportTransform {
    constructor(canvas, renderer) {
        this.canvas = canvas;
        this.renderer = renderer;

        this.canvasContainer = document.getElementById('canvas-container');
        if (!this.canvasContainer) {
            console.error("❌ ViewportTransform: 'canvas-container' element not found!");
        }
        
        this.viewTransform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 };
        this.animationFrameId = null;
        this.dirtyRect = { minX: 0, minY: 0, maxX: 0, maxY: 0 };

        this.clearDirtyRect();
    }

    // --- 座標変換メソッド（追加） ---
    
    /**
     * スクリーン座標をワールド座標に変換
     * @param {number} clientX - マウスのクライアントX座標
     * @param {number} clientY - マウスのクライアントY座標
     * @returns {Object} ワールド座標 {x, y}
     */
    screenToWorld(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = clientX - rect.left;
        const canvasY = clientY - rect.top;
        
        const t = this.viewTransform;
        
        // ビュー変換の逆変換を適用
        const worldX = (canvasX - t.left) / (t.scale * t.flipX) - this.canvas.width / 2;
        const worldY = (canvasY - t.top) / (t.scale * t.flipY) - this.canvas.height / 2;
        
        // 回転の逆変換（簡略化）
        const angle = -t.rotation * Math.PI / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        return {
            x: worldX * cos - worldY * sin + this.canvas.width / 2,
            y: worldX * sin + worldY * cos + this.canvas.height / 2
        };
    }

    /**
     * ワールド座標からローカル座標への変換
     * @param {number} worldX - ワールドX座標
     * @param {number} worldY - ワールドY座標
     * @param {Float32Array} modelMatrix - モデル行列
     * @returns {Object} ローカル座標 {x, y}
     */
    transformWorldToLocal(worldX, worldY, modelMatrix) {
        // gl-matrixを使用してモデル行列の逆行列を計算
        const invMatrix = mat4.create();
        mat4.invert(invMatrix, modelMatrix);
        
        // 同次座標で変換
        const worldVec = [worldX, worldY, 0, 1];
        const localVec = [0, 0, 0, 0];
        
        // 逆行列を適用してローカル座標を取得
        for (let i = 0; i < 4; i++) {
            localVec[i] = 
                invMatrix[i] * worldVec[0] +
                invMatrix[i + 4] * worldVec[1] +
                invMatrix[i + 8] * worldVec[2] +
                invMatrix[i + 12] * worldVec[3];
        }
        
        return { x: localVec[0], y: localVec[1] };
    }

    // --- Drawing Bridge Methods ---

    drawCircle(centerX, centerY, radius, color, isEraser, layer) {
        this.renderer?.drawCircle(centerX, centerY, radius, color, isEraser, layer);
    }

    drawLine(x0, y0, x1, y1, size, color, isEraser, p0, p1, pressureFunc, layer) {
        this.renderer?.drawLine(x0, y0, x1, y1, size, color, isEraser, p0, p1, pressureFunc, layer);
    }

    getTransformedImageData(layer) {
        return this.renderer?.getTransformedImageData(layer);
    }

    syncDirtyRectToImageData(layer, dirtyRect) {
        this.renderer?.syncDirtyRectToImageData(layer, dirtyRect);
    }

    // --- Rendering Methods ---

    _renderDirty(layers) {
        const rect = this.dirtyRect;
        if (rect.minX > rect.maxX) return; // No dirty region
        
        this.renderer.compositeLayers(layers, rect);
        this.renderer.renderToDisplay(rect);
    }

    renderAllLayers(layers) {
        // 変更: dirtyRectをスーパーサンプリング後の解像度で全面更新する
        this.dirtyRect = { 
            minX: 0, 
            minY: 0, 
            maxX: this.renderer.superWidth, 
            maxY: this.renderer.superHeight
        };
        this._requestRender(layers);
    }

    _requestRender(layers) {
        if (!this.animationFrameId) {
            this.animationFrameId = requestAnimationFrame(() => {
                this._renderDirty(layers);
                this.animationFrameId = null;
            });
        }
    }

    updateDirtyRect(x, y, radius) {
        const margin = Math.ceil(radius) + 2; // 2pxのマージンを追加
        this.dirtyRect.minX = Math.min(this.dirtyRect.minX, x - margin);
        this.dirtyRect.minY = Math.min(this.dirtyRect.minY, y - margin);
        this.dirtyRect.maxX = Math.max(this.dirtyRect.maxX, x + margin);
        this.dirtyRect.maxY = Math.max(this.dirtyRect.maxY, y + margin);
    }

    clearDirtyRect() {
        this.dirtyRect = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    }

    // --- View Transform Methods ---

    applyViewTransform() {
        if (!this.canvasContainer) return;
        const t = this.viewTransform;
        // 変更: canvasContainerではなく、その中のcanvas自体を動かす
        this.canvas.style.transform = `translate(${t.left}px, ${t.top}px) scale(${t.scale * t.flipX}, ${t.scale * t.flipY}) rotate(${t.rotation}deg)`;
        this.canvas.style.transformOrigin = 'center center';
    }

    flipHorizontal() {
        this.viewTransform.flipX *= -1;
        this.applyViewTransform();
    }
    
    flipVertical() {
        this.viewTransform.flipY *= -1;
        this.applyViewTransform();
    }
    
    zoom(factor) {
        this.viewTransform.scale = Math.max(0.1, this.viewTransform.scale * factor);
        this.applyViewTransform();
    }

    rotate(degrees) {
        this.viewTransform.rotation = (this.viewTransform.rotation + degrees) % 360;
        this.applyViewTransform();
    }
    
    resetView() {
        this.viewTransform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 };
        this.applyViewTransform();
    }
}