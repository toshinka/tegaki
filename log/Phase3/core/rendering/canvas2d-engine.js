/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Canvas2D Engine
 * Version: 1.0.1
 *
 * DrawingEngineの設計図に基づき、Canvas2D APIを使用して
 * 実際の描画処理を行うエンジンです。
 * 従来のCanvasManagerから描画ロジックを移植・集約しています。
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
    }

    // --- ImageDataへの直接描画 ---

    drawCircle(imageData, centerX, centerY, radius, color, isEraser) {
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

    drawLine(imageData, x0, y0, x1, y1, size, color, isEraser, pressure0 = 1.0, pressure1 = 1.0, calculatePressureSize) {
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
            this.drawCircle(imageData, x, y, adjustedSize / 2, color, isEraser);
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
        const sdata = sourceImageData.data;
        const destImageData = new ImageData(sw, sh);
        const ddata = destImageData.data;
        // ★★★ 修正箇所: transformから反転情報も取得 ★★★
        const { x: tx, y: ty, scale, rotation, flipX, flipY } = transform;
        const rad = -rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const cx = sw / 2;
        const cy = sh / 2;
        for (let y = 0; y < sh; y++) {
            for (let x = 0; x < sw; x++) {
                let curX = x - cx;
                let curY = y - cy;
                curX -= tx;
                curY -= ty;
                curX /= scale;
                curY /= scale;
                
                // ★★★ 修正箇所: 回転前に反転を適用 ★★★
                curX *= flipX || 1;
                curY *= flipY || 1;

                const rotatedX = curX * cos - curY * sin;
                const rotatedY = curX * sin + curY * cos;
                const sx = Math.round(rotatedX + cx);
                const sy = Math.round(rotatedY + cy);
                const destIndex = (y * sw + x) * 4;
                if (sx >= 0 && sx < sw && sy >= 0 && sy < sh) {
                    const sourceIndex = (sy * sw + sx) * 4;
                    ddata[destIndex] = sdata[sourceIndex];
                    ddata[destIndex + 1] = sdata[sourceIndex + 1];
                    ddata[destIndex + 2] = sdata[sourceIndex + 2];
                    ddata[destIndex + 3] = sdata[sourceIndex + 3];
                }
            }
        }
        return destImageData;
    }

    // --- レイヤー合成と画面表示 ---

    compositeLayers(layers, compositionData, dirtyRect) {
        const finalData = compositionData.data;
        const width = this.width;
        const xStart = Math.max(0, Math.floor(dirtyRect.minX));
        const yStart = Math.max(0, Math.floor(dirtyRect.minY));
        const xEnd = Math.min(width, Math.ceil(dirtyRect.maxX));
        const yEnd = Math.min(this.height, Math.ceil(dirtyRect.maxY));

        for (let y = yStart; y < yEnd; y++) {
            for (let x = xStart; x < xEnd; x++) {
                const i = (y * width + x) * 4;
                let r = 0, g = 0, b = 0, a = 0;

                for (const layer of layers) {
                    if (!layer.visible) continue;
                    const layerData = layer.imageData.data;
                    const srcR = layerData[i], srcG = layerData[i + 1], srcB = layerData[i + 2], srcA = layerData[i + 3] / 255;
                    if (srcA > 0) {
                        const destR = r, destG = g, destB = b, destA = a;
                        const outA = srcA + destA * (1 - srcA);
                        if (outA > 0) {
                            r = (srcR * srcA + destR * destA * (1 - srcA)) / outA;
                            g = (srcG * srcA + destG * destA * (1 - srcA)) / outA;
                            b = (srcB * srcA + destB * destA * (1 - srcA)) / outA;
                            a = outA;
                        }
                    }
                }
                finalData[i] = r;
                finalData[i + 1] = g;
                finalData[i + 2] = b;
                finalData[i + 3] = a * 255;
            }
        }
    }

    renderToDisplay(compositionData, dirtyRect) {
        if (dirtyRect.minX > dirtyRect.maxX) return;

        const dirtyX = Math.max(0, Math.floor(dirtyRect.minX));
        const dirtyY = Math.max(0, Math.floor(dirtyRect.minY));
        const dirtyW = Math.min(this.width, Math.ceil(dirtyRect.maxX)) - dirtyX;
        const dirtyH = Math.min(this.height, Math.ceil(dirtyRect.maxY)) - dirtyY;

        if (dirtyW > 0 && dirtyH > 0) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = dirtyW;
            tempCanvas.height = dirtyH;
            const tempCtx = tempCanvas.getContext('2d');
            const partialData = tempCtx.createImageData(dirtyW, dirtyH);

            const sourceData = compositionData.data;
            const destData = partialData.data;
            for (let y = 0; y < dirtyH; y++) {
                for (let x = 0; x < dirtyW; x++) {
                    const sourceIndex = ((dirtyY + y) * this.width + (dirtyX + x)) * 4;
                    const destIndex = (y * dirtyW + x) * 4;
                    destData[destIndex]     = sourceData[sourceIndex];
                    destData[destIndex + 1] = sourceData[sourceIndex + 1];
                    destData[destIndex + 2] = sourceData[sourceIndex + 2];
                    destData[destIndex + 3] = sourceData[sourceIndex + 3];
                }
            }
            this.displayCtx.putImageData(partialData, dirtyX, dirtyY);
        }
    }

    // --- プライベートヘルパーメソッド ---

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
            if (topAlpha >= 1) {
                data[index] = color.r;
                data[index + 1] = color.g;
                data[index + 2] = color.b;
                data[index + 3] = color.a;
                return;
            }

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