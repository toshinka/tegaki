/**
 * [クラス責務] CanvasViewport.js
 * 目的：キャンバスの表示領域（ビューポート）の制御と、描画命令の仲介を行う。
 * 責務：
 * 1. ビューポート操作：ユーザー入力に基づいたズーム、パン、回転、反転などの視点操作を管理・適用する。
 * 2. 描画の仲介役（ブリッジ）：高レベルな描画要求（e.g., "線を描く"）を受け取り、それを低レベルなWebGLRendererに伝達する。
 *
 * 旧rendering-bridge.jsと、旧canvas-manager.jsの視点操作機能がこのクラスに統合された。
 */
export class CanvasViewport {
    constructor(canvas, renderer) {
        this.canvas = canvas;
        this.renderer = renderer;

        this.canvasContainer = document.getElementById('canvas-container');
        if (!this.canvasContainer) {
            console.error("❌ CanvasViewport: 'canvas-container' element not found!");
        }
        
        this.viewTransform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 };
        this.animationFrameId = null;
        this.dirtyRect = { minX: 0, minY: 0, maxX: 0, maxY: 0 };

        this.clearDirtyRect();
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
        this.dirtyRect = { 
            minX: 0, 
            minY: 0, 
            maxX: this.canvas.width * (this.renderer.SUPER_SAMPLING_FACTOR || 1), 
            maxY: this.canvas.height * (this.renderer.SUPER_SAMPLING_FACTOR || 1)
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
        const margin = Math.ceil(radius) + 2;
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
        this.canvasContainer.style.transform = `translate(${t.left}px, ${t.top}px) scale(${t.scale * t.flipX}, ${t.scale * t.flipY}) rotate(${t.rotation}deg)`;
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