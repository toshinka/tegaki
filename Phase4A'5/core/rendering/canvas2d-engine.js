/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Canvas2D Engine
 * Version: 1.2.1 (Interface Alignment)
 *
 * DrawingEngineのインターフェース変更に合わせ、描画メソッドにlayer引数を追加。
 * (Canvas2Dエンジンではこの引数は使用されません)
 * ===================================================================================
 */
import { DrawingEngine } from './drawing-engine.js';

function hexToRgba(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
        a: 255
    } : { r: 0, g: 0, b: 0, a: 255 };
}

export class Canvas2DEngine extends DrawingEngine {
    constructor(canvas) {
        super(canvas);
        this.displayCtx = canvas.getContext('2d', { willReadFrequently: true });
        this.width = canvas.width;
        this.height = canvas.height;
        this.drawingQuality = {
            enableSubpixel: true,
            antialiasThreshold: 2.0,
            minDrawSteps: 1,
            maxDrawSteps: 100
        };

        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCanvas.width = this.width;
        this.offscreenCanvas.height = this.height;
        this.offscreenCtx = this.offscreenCanvas.getContext('2d');

        this.layerCanvas = document.createElement('canvas');
        this.layerCanvas.width = this.width;
        this.layerCanvas.height = this.height;
        this.layerCtx = this.layerCanvas.getContext('2d');
        
        this.transformCanvas = document.createElement('canvas');
        this.transformCtx = this.transformCanvas.getContext('2d');
    }

    // --- ImageDataへの直接描画 (layer引数を追加) ---

    drawCircle(imageData, centerX, centerY, radius, color, isEraser, layer) { // layer引数は未使用
        const quality = this.drawingQuality;
        const useSubpixel = quality.enableSubpixel && radius >= 0.5;
        if (radius < 0.8) {
            this._drawSinglePixel(imageData, centerX, centerY, color, isEraser, radius);
            return;
        }
        const rCeil = Math.ceil(radius + 1);
        for (let y = -rCeil; y <= rCeil; y++) {
            for (let x = -rCeil; x <= rCeil; x++) {
                const distance = Math.hypot(x, y);
                if (distance <= radius + 0.5) {
                    const finalX = centerX + x;
                    const finalY = centerY + y;
                    let alpha = this._calculatePixelAlpha(distance, radius, useSubpixel);
                    if (alpha > 0.01) {
                        if (isEraser) {
                            this._erasePixel(imageData, finalX, finalY, alpha);
                        } else {
                            const finalColor = { ...color, a: Math.floor(color.a * alpha) };
                            this._blendPixel(imageData, finalX, finalY, finalColor);
                        }
                    }
                }
            }
        }
    }

    drawLine(imageData, x0, y0, x1, y1, size, color, isEraser, pressure0 = 1.0, pressure1 = 1.0, calculatePressureSize, layer) { // layer引数は未使用
        if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) return;
        const distance = Math.hypot(x1 - x0, y1 - y0);
        if (distance > Math.hypot(this.width, this.height) * 2) return;

        const quality = this.drawingQuality;
        const baseSteps = Math.max(quality.minDrawSteps, Math.ceil(distance / Math.max(0.5, size / 8)));
        const steps = Math.min(quality.maxDrawSteps, baseSteps);

        for (let i = 0; i <= steps; i++) {
            const t = steps > 0 ? i / steps : 0;
            const x = x0 + (x1 - x0) * t;
            const y = y0 + (y1 - y0) * t;
            const pressure = pressure0 + (pressure1 - pressure0) * t;
            const adjustedSize = calculatePressureSize(size, pressure);
            this.drawCircle(imageData, x, y, adjustedSize / 2, color, isEraser, layer); // layerを渡すが使われない
        }
    }

    fill(imageData, color) {
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = color.r;
            data[i + 1] = color.g;
            data[i + 2] = color.b;
            data[i + 3] = color.a;
        }
    }

    clear(imageData) {
        imageData.data.fill(0);
    }
    
    getTransformedImageData(sourceImageData, transform) {
        const sw = sourceImageData.width;
        const sh = sourceImageData.height;
        
        const tempCanvas = this.transformCanvas;
        const tempCtx = this.transformCtx;
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
        const ctx = this.offscreenCtx;
        const width = this.width;
        const height = this.height;
    
        const x = Math.max(0, Math.floor(dirtyRect.minX));
        const y = Math.max(0, Math.floor(dirtyRect.minY));
        const w = Math.min(width, Math.ceil(dirtyRect.maxX)) - x;
        const h = Math.min(height, Math.ceil(dirtyRect.maxY)) - y;
    
        if (w <= 0 || h <= 0) return;
    
        // ダーティ矩形領域のみをクリア
        ctx.clearRect(x, y, w, h);
    
        for (const layer of layers) {
            if (!layer.visible || layer.opacity === 0) continue;
    
            // layer.imageDataを一時キャンバスに転送
            this.layerCtx.putImageData(layer.imageData, 0, 0);
    
            ctx.globalAlpha = (layer.opacity ?? 100) / 100;
            ctx.globalCompositeOperation = layer.blendMode ?? 'normal';
    
            // ダーティ矩形領域のみを描画
            ctx.drawImage(this.layerCanvas, x, y, w, h, x, y, w, h);
        }
    
        // 最終的な合成結果をcompositionDataに部分的にコピー
        if (w > 0 && h > 0) {
            const composed = ctx.getImageData(x, y, w, h);
            const finalData = compositionData.data;
            const finalWidth = compositionData.width;
    
            for (let j = 0; j < h; j++) {
                const sourceIndex = j * w * 4;
                const destIndex = ((y + j) * finalWidth + x) * 4;
                finalData.set(composed.data.subarray(sourceIndex, sourceIndex + w * 4), destIndex);
            }
        }
    }

    renderToDisplay(compositionData, dirtyRect) {
        if (dirtyRect.minX > dirtyRect.maxX) return;
        
        const x = Math.max(0, Math.floor(dirtyRect.minX));
        const y = Math.max(0, Math.floor(dirtyRect.minY));
        const w = Math.min(this.width, Math.ceil(dirtyRect.maxX)) - x;
        const h = Math.min(this.height, Math.ceil(dirtyRect.maxY)) - y;

        if (w > 0 && h > 0) {
            // putImageDataはImageDataオブジェクトを直接受け取れる
            // compositionDataからダーティ矩形領域を切り出して新しいImageDataを作成する
            const partialData = new ImageData(w, h);
            const sourceData = compositionData.data;
            const destData = partialData.data;
            const sourceWidth = compositionData.width;

            for (let j = 0; j < h; j++) {
                const sourceRowStart = ((y + j) * sourceWidth + x) * 4;
                const sourceRowEnd = sourceRowStart + w * 4;
                const destRowStart = j * w * 4;
                destData.set(sourceData.subarray(sourceRowStart, sourceRowEnd), destRowStart);
            }
            this.displayCtx.putImageData(partialData, x, y);
        }
    }

    _drawSinglePixel(imageData, x, y, color, isEraser, intensity = 1.0) {
        const alpha = Math.min(1.0, intensity);
        if (isEraser) {
            this._erasePixel(imageData, x, y, alpha);
        } else {
            const finalColor = { ...color, a: Math.floor(color.a * alpha) };
            this._blendPixel(imageData, x, y, finalColor);
        }
    }
    _calculatePixelAlpha(distance, radius, useSubpixel) {
        if (distance <= radius - 0.5) { return 1.0; }
        if (!useSubpixel) { return distance <= radius ? 1.0 : 0.0; }
        if (distance <= radius) {
            const fadeStart = Math.max(0, radius - 1.0);
            const fadeRange = radius - fadeStart;
            if (fadeRange > 0) {
                const fadeRatio = (distance - fadeStart) / fadeRange;
                return Math.max(0, 1.0 - fadeRatio);
            }
            return 1.0;
        }
        if (distance <= radius + 0.5) {
            return Math.max(0, 1.0 - (distance - radius) * 2.0);
        }
        return 0.0;
    }
    _blendPixel(imageData, x, y, color) {
        try {
            x = Math.floor(x);
            y = Math.floor(y);
            if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) return;
            if (!imageData.data || !color) return;
            const index = (y * imageData.width + x) * 4;
            const data = imageData.data;
            if (index < 0 || index >= data.length - 3) return;

            const topAlpha = color.a / 255;
            if (topAlpha <= 0) return;
            
            const bottomAlpha = data[index + 3] / 255;
            const outAlpha = topAlpha + bottomAlpha * (1 - topAlpha);
            if (outAlpha > 0) {
                data[index]     = (color.r * topAlpha + data[index]     * bottomAlpha * (1 - topAlpha)) / outAlpha;
                data[index + 1] = (color.g * topAlpha + data[index + 1] * bottomAlpha * (1 - topAlpha)) / outAlpha;
                data[index + 2] = (color.b * topAlpha + data[index + 2] * bottomAlpha * (1 - topAlpha)) / outAlpha;
                data[index + 3] = outAlpha * 255;
            }
        } catch (error) {
            console.warn('ピクセル描画エラー:', { x, y, error });
        }
    }
    _erasePixel(imageData, x, y, strength) {
        x = Math.floor(x);
        y = Math.floor(y);
        if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) return;
        const index = (y * imageData.width + x) * 4;
        const currentAlpha = imageData.data[index + 3];
        imageData.data[index + 3] = Math.max(0, currentAlpha * (1 - strength));
    }
}