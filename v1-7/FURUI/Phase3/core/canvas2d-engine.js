/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Canvas 2D Engine
 * Version: 1.9 (Phase 3 Architecture)
 *
 * DrawingEngineインタフェースをCanvas 2D APIで実装したものです。
 * すべての描画、合成処理はこのファイルに集約されます。
 * ===================================================================================
 */
import { DrawingEngine } from './rendering-bridge.js';

function hexToRgba(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16), a: 255
    } : { r: 0, g: 0, b: 0, a: 255 };
}

export class Canvas2DEngine extends DrawingEngine {
    constructor(canvas, width, height) {
        super(canvas, width, height);
        this.displayCanvas = canvas;
        this.displayCtx = this.displayCanvas.getContext('2d', { willReadFrequently: true });
        this.width = width;
        this.height = height;
        this.compositionData = new ImageData(this.width, this.height);
        this.pressureHistory = [];
        this.maxPressureHistory = 5;
    }

    // --- Public API (from DrawingEngine) ---

    compositeAndRender(layers, dirtyRect) {
        // dirtyRectがなければ全領域を対象とする
        const rect = dirtyRect || { minX: 0, minY: 0, maxX: this.width, maxY: this.height };
        if (rect.minX > rect.maxX) return;

        this._compositePartial(layers, rect);
        this._renderToDisplay(rect);
    }
    
    clearLayer(layer) {
        layer.imageData.data.fill(0);
    }

    fillLayer(layer, hexColor) {
        const color = hexToRgba(hexColor);
        const data = layer.imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = color.r;
            data[i + 1] = color.g;
            data[i + 2] = color.b;
            data[i + 3] = color.a;
        }
    }

    drawCircle(layer, x, y, radius, color, isEraser) {
        const quality = { enableSubpixel: true }; // 品質の固定値または引数から取得
        const useSubpixel = quality.enableSubpixel && radius >= 0.5;
        if (radius < 0.8) {
            this._drawSinglePixel(layer.imageData, x, y, color, isEraser, radius);
            return;
        }
        const rCeil = Math.ceil(radius + 1);
        for (let j = -rCeil; j <= rCeil; j++) {
            for (let i = -rCeil; i <= rCeil; i++) {
                const distance = Math.hypot(i, j);
                if (distance <= radius + 0.5) {
                    const finalX = x + i;
                    const finalY = y + j;
                    let alpha = this._calculatePixelAlpha(distance, radius, useSubpixel);
                    if (alpha > 0.01) {
                        if (isEraser) {
                            this._erasePixel(layer.imageData, finalX, finalY, alpha);
                        } else {
                            const finalColor = { ...color, a: Math.floor(color.a * alpha) };
                            this._blendPixel(layer.imageData, finalX, finalY, finalColor);
                        }
                    }
                }
            }
        }
    }
    
    drawLine(layer, from, to, baseSize, color, isEraser, pressureSettings, drawingQuality) {
        if (!isFinite(from.x) || !isFinite(from.y) || !isFinite(to.x) || !isFinite(to.y)) return;
        
        const distance = Math.hypot(to.x - from.x, to.y - from.y);
        if (distance > Math.hypot(this.width, this.height) * 2) return;
        
        const baseSteps = Math.max(drawingQuality.minDrawSteps, Math.ceil(distance / Math.max(0.5, baseSize / 8)));
        const steps = Math.min(drawingQuality.maxDrawSteps, baseSteps);

        for (let i = 0; i <= steps; i++) {
            const t = steps > 0 ? i / steps : 0;
            const x = from.x + (to.x - from.x) * t;
            const y = from.y + (to.y - from.y) * t;
            const pressure = from.pressure + (to.pressure - from.pressure) * t;
            const adjustedSize = this._calculatePressureSize(baseSize, pressure, pressureSettings);
            this.drawCircle(layer, x, y, adjustedSize / 2, color, isEraser);
        }
    }

    floodFill(layer, x, y, color) {
        const imageData = layer.imageData;
        const { width, height, data } = imageData;
        const startX = Math.floor(x);
        const startY = Math.floor(y);

        const startIndex = (startY * width + startX) * 4;
        const startColor = [data[startIndex], data[startIndex+1], data[startIndex+2], data[startIndex+3]];
        const fillColor = [color.r, color.g, color.b, color.a];

        if (this._colorMatch(startColor, fillColor)) return;

        const stack = [[startX, startY]];

        while (stack.length) {
            const [curX, curY] = stack.pop();
            const currentIndex = (curY * width + curX) * 4;

            if (!this._colorMatch(data.slice(currentIndex, currentIndex + 4), startColor)) continue;

            data[currentIndex]     = fillColor[0];
            data[currentIndex + 1] = fillColor[1];
            data[currentIndex + 2] = fillColor[2];
            data[currentIndex + 3] = fillColor[3];

            if (curX > 0) stack.push([curX - 1, curY]);
            if (curX < width - 1) stack.push([curX + 1, curY]);
            if (curY > 0) stack.push([curX, curY - 1]);
            if (curY < height - 1) stack.push([curX, curY + 1]);
        }
    }

    mergeLayers(topLayer, bottomLayer) {
        const topData = topLayer.imageData.data;
        const bottomData = bottomLayer.imageData.data;
        for (let i = 0; i < topData.length; i += 4) {
            const topAlpha = topData[i + 3] / 255;
            if (topAlpha === 0) continue;
            
            // シンプルなアルファ合成（ブレンドモード非対応のマージ）
            const bottomAlpha = bottomData[i + 3] / 255;
            const outAlpha = topAlpha + bottomAlpha * (1 - topAlpha);
            if (outAlpha > 0) {
                bottomData[i]     = (topData[i]     * topAlpha + bottomData[i]     * bottomAlpha * (1 - topAlpha)) / outAlpha;
                bottomData[i + 1] = (topData[i + 1] * topAlpha + bottomData[i + 1] * bottomAlpha * (1 - topAlpha)) / outAlpha;
                bottomData[i + 2] = (topData[i + 2] * topAlpha + bottomData[i + 2] * bottomAlpha * (1 - topAlpha)) / outAlpha;
                bottomData[i + 3] = outAlpha * 255;
            }
        }
    }
    
    getTransformedImageData(sourceImageData, transform) {
        const sw = sourceImageData.width; const sh = sourceImageData.height;
        const sdata = sourceImageData.data;
        const destImageData = new ImageData(sw, sh);
        const ddata = destImageData.data;
        const { x: tx, y: ty, scale, rotation } = transform;
        const rad = -rotation * Math.PI / 180;
        const cos = Math.cos(rad); const sin = Math.sin(rad);
        const cx = sw / 2; const cy = sh / 2;

        for (let y = 0; y < sh; y++) {
            for (let x = 0; x < sw; x++) {
                let curX = x - cx; let curY = y - cy;
                curX -= tx; curY -= ty;
                curX /= scale; curY /= scale;
                const rotatedX = curX * cos - curY * sin;
                const rotatedY = curX * sin + curY * cos;
                const sx = Math.round(rotatedX + cx);
                const sy = Math.round(rotatedY + cy);
                const destIndex = (y * sw + x) * 4;
                if (sx >= 0 && sx < sw && sy >= 0 && sy < sh) {
                    const sourceIndex = (sy * sw + sx) * 4;
                    ddata[destIndex]     = sdata[sourceIndex];
                    ddata[destIndex + 1] = sdata[sourceIndex + 1];
                    ddata[destIndex + 2] = sdata[sourceIndex + 2];
                    ddata[destIndex + 3] = sdata[sourceIndex + 3];
                }
            }
        }
        return destImageData;
    }

    exportToDataURL(layers) {
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = this.width;
        exportCanvas.height = this.height;
        const exportCtx = exportCanvas.getContext('2d');
        
        // メモリ上の合成済みデータからではなく、レイヤーから直接描画する
        // TODO: WebGLエンジンではFramebufferから直接読み出すなど、より高速な手法を検討する
        layers.forEach(layer => {
            if (layer.visible) {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = this.width;
                tempCanvas.height = this.height;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.putImageData(layer.imageData, 0, 0);
                
                exportCtx.globalCompositeOperation = layer.blendMode || 'source-over';
                exportCtx.drawImage(tempCanvas, 0, 0);
            }
        });

        return exportCanvas.toDataURL('image/png');
    }

    // --- Private Helper Methods ---

    _compositePartial(layers, rect) {
        const finalData = this.compositionData.data;
        const width = this.width;
        const xStart = Math.max(0, Math.floor(rect.minX));
        const yStart = Math.max(0, Math.floor(rect.minY));
        const xEnd = Math.min(width, Math.ceil(rect.maxX));
        const yEnd = Math.min(this.height, Math.ceil(rect.maxY));
        
        // TODO(WebGL): このループはシェーダーに置き換えられ、GPUで並列処理される
        for (let y = yStart; y < yEnd; y++) {
            for (let x = xStart; x < xEnd; x++) {
                const i = (y * width + x) * 4;
                // 背景を一旦白で初期化（背景レイヤーが透明だった場合のため）
                let r = 255, g = 255, b = 255, a = 1.0; 
                
                for (const layer of layers) {
                    if (!layer.visible) continue;
                    const layerData = layer.imageData.data;
                    const srcR = layerData[i], srcG = layerData[i+1], srcB = layerData[i+2], srcA = layerData[i+3] / 255;
                    if (srcA > 0) {
                        const destR = r, destG = g, destB = b, destA = a;
                        
                        // ★★★ ブレンドモードに応じた処理 ★★★
                        // Canvas2DではglobalCompositeOperationを使うのが一般的だが、
                        // ここではピクセル単位での合成シミュレーションを行う
                        // (実際には下の_renderToDisplayでgCOを使うほうが高速)
                        // ここでは基本的なアルファ合成のみ行う
                        const outA = srcA + destA * (1 - srcA);
                        if (outA > 0) {
                            r = (srcR * srcA + destR * destA * (1 - srcA)) / outA;
                            g = (srcG * srcA + destG * destA * (1 - srcA)) / outA;
                            b = (srcB * srcA + destB * destA * (1 - srcA)) / outA;
                            a = outA;
                        }
                    }
                }
                finalData[i]     = r;
                finalData[i + 1] = g;
                finalData[i + 2] = b;
                finalData[i + 3] = a * 255;
            }
        }
    }
    
    _renderToDisplay(rect) {
        // ピクセル単位の合成は重いので、実際の表示はputImageDataとgCOで行う
        // まず、背景レイヤーを描画
        this.displayCtx.clearRect(0, 0, this.width, this.height);
        this.displayCtx.putImageData(layers[0].imageData, 0, 0);

        // 2枚目以降のレイヤーをブレンドモードを適用しながら重ねる
        for (let i = 1; i < layers.length; i++) {
            const layer = layers[i];
            if (!layer.visible) continue;
            
            // TODO(WebGL): ここは各レイヤーをテクスチャとして、シェーダーで合成する処理に変わる
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.width;
            tempCanvas.height = this.height;
            tempCanvas.getContext('2d').putImageData(layer.imageData, 0, 0);

            this.displayCtx.globalCompositeOperation = layer.blendMode || 'source-over';
            this.displayCtx.drawImage(tempCanvas, 0, 0);
        }
        // 合成モードを通常に戻す
        this.displayCtx.globalCompositeOperation = 'source-over';
    }

    _calculatePressureSize(baseSizeInput, pressure, pressureSettings) {
        const baseSize = Math.max(0.1, baseSizeInput);
        let normalizedPressure = Math.max(0, Math.min(1, pressure || 0));
        if (normalizedPressure === 0) {
            normalizedPressure = pressureSettings.minPressure;
        }
        this.pressureHistory.push(normalizedPressure);
        if (this.pressureHistory.length > this.maxPressureHistory) {
            this.pressureHistory.shift();
        }
        const smoothedPressure = this.pressureHistory.reduce((sum, p) => sum + p, 0) / this.pressureHistory.length;
        let adjustedPressure = smoothedPressure;
        if (pressureSettings.dynamicRange) {
            const minHist = Math.min(...this.pressureHistory);
            const maxHist = Math.max(...this.pressureHistory);
            const range = maxHist - minHist;
            if (range > 0.1) {
                adjustedPressure = (smoothedPressure - minHist) / range;
            }
        }
        const curve = pressureSettings.curve;
        const curvedPressure = Math.pow(adjustedPressure, curve);
        const minSize = baseSize * pressureSettings.minSizeRatio;
        const maxSize = baseSize;
        const finalSize = minSize + (maxSize - minSize) * curvedPressure * pressureSettings.sensitivity;
        return Math.max(0.1, finalSize);
    }
    
    _calculatePixelAlpha(distance, radius, useSubpixel) {
        if (distance <= radius - 0.5) return 1.0;
        if (!useSubpixel) return distance <= radius ? 1.0 : 0.0;
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
        x = Math.floor(x); y = Math.floor(y);
        if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) return;
        const index = (y * imageData.width + x) * 4;
        const data = imageData.data;
        const topAlpha = color.a / 255;
        if (topAlpha <= 0) return;
        if (topAlpha >= 1) {
            data[index] = color.r; data[index + 1] = color.g; data[index + 2] = color.b; data[index + 3] = color.a;
            return;
        }
        const bottomAlpha = data[index + 3] / 255;
        const outAlpha = topAlpha + bottomAlpha * (1 - topAlpha);
        if (outAlpha > 0) {
            data[index]     = (color.r * topAlpha + data[index] * bottomAlpha * (1 - topAlpha)) / outAlpha;
            data[index + 1] = (color.g * topAlpha + data[index + 1] * bottomAlpha * (1 - topAlpha)) / outAlpha;
            data[index + 2] = (color.b * topAlpha + data[index + 2] * bottomAlpha * (1 - topAlpha)) / outAlpha;
            data[index + 3] = outAlpha * 255;
        }
    }

    _erasePixel(imageData, x, y, strength) {
        x = Math.floor(x); y = Math.floor(y);
        if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) return;
        const index = (y * imageData.width + x) * 4;
        const currentAlpha = imageData.data[index + 3];
        imageData.data[index + 3] = Math.max(0, currentAlpha * (1 - strength));
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

    _colorMatch(c1, c2) {
        return c1[0] === c2[0] && c1[1] === c2[1] && c1[2] === c2[2] && c1[3] === c2[3];
    }
}

// レイヤー再描画を効率化するために、グローバル変数としてレイヤー配列を保持
// （本来はエンジンクラスのプロパティとして持つべきだが、パフォーマンス目的で一時的にここに置く）
let layers = [];

// 再描画関数をモジュールスコープで定義
function _renderToDisplayOptimized(displayCtx, width, height) {
    displayCtx.clearRect(0, 0, width, height);

    // 各レイヤーを順番に描画していく
    for (const layer of layers) {
        if (!layer.visible) continue;

        // TODO(WebGL): このputImageDataはWebGLではテクスチャのアップロードと描画に相当します。
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        tempCanvas.getContext('2d').putImageData(layer.imageData, 0, 0);

        // ★★★ ブレンドモードを適用 ★★★
        displayCtx.globalCompositeOperation = layer.blendMode || 'source-over';
        displayCtx.drawImage(tempCanvas, 0, 0);
    }
    // 後続の処理のためにブレンドモードを元に戻す
    displayCtx.globalCompositeOperation = 'source-over';
}

// Canvas2DEngineのメソッドを書き換えて、最適化された描画関数を使用する
Canvas2DEngine.prototype._renderToDisplay = function(rect) {
    layers = this.app.layerManager.layers; // 描画直前に最新のレイヤーリストを取得
    _renderToDisplayOptimized(this.displayCtx, this.width, this.height);
};