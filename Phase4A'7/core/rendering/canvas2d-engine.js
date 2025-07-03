/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Canvas2D Engine
 * Version 1.2.0 (Phase 4A'-7 GPU Drawing Prep)
 *
 * - 修正：
 * - DrawingEngineのインターフェース変更に対応。
 * - drawCircle, drawLineは、引数で渡されるlayerオブジェクトからimageDataを取得して
 * 描画を行うように変更。
 * ===================================================================================
 */
import { DrawingEngine } from './drawing-engine.js';

export class Canvas2DEngine extends DrawingEngine {
    constructor(canvas) {
        super(canvas);
        this.ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        // オフスクリーン（画面外）のCanvasを、変形処理や一時的な描画用に用意
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCtx = this.offscreenCanvas.getContext('2d');
    }

    // 渡されたImageDataを一時的なCanvasに描き、そのコンテキストを返すヘルパー関数
    _getTempContext(imageData) {
        this.offscreenCanvas.width = imageData.width;
        this.offscreenCanvas.height = imageData.height;
        this.offscreenCtx.putImageData(imageData, 0, 0);
        return this.offscreenCtx;
    }

    // ★★★ 修正: imageData引数を削除し、layerから取得 ★★★
    drawCircle(centerX, centerY, radius, color, isEraser, layer) {
        const imageData = layer.imageData;
        const ctx = this._getTempContext(imageData);

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2, false);

        if (isEraser) {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = 'rgba(0,0,0,1)';
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
        }
        ctx.fill();
        
        // 変更を元のImageDataに書き戻す
        layer.imageData.data.set(ctx.getImageData(0, 0, imageData.width, imageData.height).data);
        layer.gpuDirty = true; // データが変更されたことを示す
    }

    // ★★★ 修正: imageData引数を削除し、layerから取得 ★★★
    drawLine(x0, y0, x1, y1, size, color, isEraser, p0, p1, calculatePressureSize, layer) {
        const imageData = layer.imageData;
        const ctx = this._getTempContext(imageData);

        if (isEraser) {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'rgba(0,0,0,1)';
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
        }
        
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const distance = Math.hypot(x1 - x0, y1 - y0);
        const steps = Math.max(1, Math.ceil(distance / (size / 4)));

        ctx.beginPath();
        ctx.moveTo(x0, y0);

        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const x = x0 + (x1 - x0) * t;
            const y = y0 + (y1 - y0) * t;
            const pressure = p0 + (p1 - p0) * t;
            const currentSize = calculatePressureSize(size, pressure);

            ctx.lineWidth = currentSize;
            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y);
        }
        
        layer.imageData.data.set(ctx.getImageData(0, 0, imageData.width, imageData.height).data);
        layer.gpuDirty = true;
    }

    fill(imageData, color) {
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = color.r;
            data[i+1] = color.g;
            data[i+2] = color.b;
            data[i+3] = 255;
        }
        imageData.gpuDirty = true;
    }

    clear(imageData) {
        imageData.data.fill(0);
        imageData.gpuDirty = true;
    }

    getTransformedImageData(sourceImageData, transform) {
        const sw = sourceImageData.width;
        const sh = sourceImageData.height;
        const tempCanvas = this.offscreenCanvas;
        const tempCtx = this.offscreenCtx;
        tempCanvas.width = sw;
        tempCanvas.height = sh;

        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = sw;
        sourceCanvas.height = sh;
        sourceCanvas.getContext('2d').putImageData(sourceImageData, 0, 0);

        tempCtx.clearRect(0, 0, sw, sh);
        tempCtx.save();
        tempCtx.translate(transform.x, transform.y);
        tempCtx.translate(sw / 2, sh / 2);
        tempCtx.rotate(transform.rotation * Math.PI / 180);
        tempCtx.scale(transform.scale * transform.flipX, transform.scale * transform.flipY);
        tempCtx.translate(-sw / 2, -sh / 2);
        tempCtx.drawImage(sourceCanvas, 0, 0);
        tempCtx.restore();
        
        return tempCtx.getImageData(0, 0, sw, sh);
    }

    compositeLayers(layers, compositionData, dirtyRect) {
        const tempCtx = this._getTempContext(compositionData);
        tempCtx.clearRect(0, 0, compositionData.width, compositionData.height);

        for (const layer of layers) {
            if (!layer.visible) continue;

            tempCtx.globalAlpha = layer.opacity / 100;
            tempCtx.globalCompositeOperation = layer.blendMode;
            
            const layerCanvas = document.createElement('canvas');
            layerCanvas.width = layer.imageData.width;
            layerCanvas.height = layer.imageData.height;
            layerCanvas.getContext('2d').putImageData(layer.imageData, 0, 0);
            
            tempCtx.drawImage(layerCanvas, 0, 0);
        }

        compositionData.data.set(tempCtx.getImageData(0, 0, compositionData.width, compositionData.height).data);
    }

    renderToDisplay(compositionData, dirtyRect) {
        const { minX, minY, maxX, maxY } = dirtyRect;
        const x = Math.floor(minX);
        const y = Math.floor(minY);
        const width = Math.ceil(maxX) - x;
        const height = Math.ceil(maxY) - y;

        if (width > 0 && height > 0) {
            this.ctx.putImageData(compositionData, 0, 0, x, y, width, height);
        }
    }
}
