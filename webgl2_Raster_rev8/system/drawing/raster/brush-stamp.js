/**
 * ================================================================
 * brush-stamp.js - Phase 2.2: ブラシスタンプ生成
 * ================================================================
 * 【役割】
 * - ブラシスタンプテクスチャ生成
 * - 円形スタンプ生成
 * - カスタムテクスチャスタンプ対応
 * 
 * 【親依存】
 * - なし（独立モジュール）
 * 
 * 【子依存】
 * - raster-brush-core.js
 * ================================================================
 */

(function() {
    'use strict';

    class BrushStamp {
        constructor() {
            this.gl = null;
            this.stampCache = new Map();
            this.maxCacheSize = 20;
        }

        /**
         * 初期化
         * @param {WebGL2RenderingContext} gl 
         */
        initialize(gl) {
            this.gl = gl;
            console.log('✅ [BrushStamp] Initialized');
        }

        /**
         * 円形スタンプ生成
         * @param {number} radius - 半径（ピクセル）
         * @param {number} hardness - エッジの硬さ (0.0～1.0)
         * @param {boolean} antialiasing - アンチエイリアス有効
         * @returns {WebGLTexture}
         */
        generateCircleStamp(radius, hardness = 1.0, antialiasing = true) {
            const cacheKey = `circle_${radius}_${hardness}_${antialiasing}`;
            
            // キャッシュチェック
            if (this.stampCache.has(cacheKey)) {
                return this.stampCache.get(cacheKey);
            }
            
            const gl = this.gl;
            const size = Math.ceil(radius * 2);
            const canvas = this._createStampCanvas(size, size, (ctx, w, h) => {
                const centerX = w / 2;
                const centerY = h / 2;
                
                // グラデーション作成
                const gradient = ctx.createRadialGradient(
                    centerX, centerY, 0,
                    centerX, centerY, radius
                );
                
                if (antialiasing) {
                    const edge = radius * (1.0 - hardness * 0.3);
                    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
                    gradient.addColorStop(edge / radius, 'rgba(255, 255, 255, 1.0)');
                    gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
                } else {
                    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
                    gradient.addColorStop(0.99, 'rgba(255, 255, 255, 1.0)');
                    gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
                }
                
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, w, h);
            });
            
            const texture = this._canvasToTexture(canvas);
            
            // キャッシュに保存
            this._addToCache(cacheKey, texture);
            
            return texture;
        }

        /**
         * テクスチャスタンプ生成（カスタムブラシ用）
         * @param {ImageData|HTMLImageElement|HTMLCanvasElement} imageSource 
         * @returns {WebGLTexture}
         */
        generateTextureStamp(imageSource) {
            const cacheKey = `texture_${imageSource.width}_${imageSource.height}`;
            
            if (this.stampCache.has(cacheKey)) {
                return this.stampCache.get(cacheKey);
            }
            
            const texture = this._imageToTexture(imageSource);
            this._addToCache(cacheKey, texture);
            
            return texture;
        }

        /**
         * Canvas作成ヘルパー
         */
        _createStampCanvas(width, height, drawFunc) {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, width, height);
            
            drawFunc(ctx, width, height);
            
            return canvas;
        }

        /**
         * CanvasからWebGLTextureに変換
         */
        _canvasToTexture(canvas) {
            const gl = this.gl;
            
            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                canvas
            );
            
            // ミップマップ不要
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            
            gl.bindTexture(gl.TEXTURE_2D, null);
            
            return texture;
        }

        /**
         * 画像からテクスチャ生成
         */
        _imageToTexture(imageSource) {
            const gl = this.gl;
            
            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            
            if (imageSource instanceof ImageData) {
                gl.texImage2D(
                    gl.TEXTURE_2D,
                    0,
                    gl.RGBA,
                    imageSource.width,
                    imageSource.height,
                    0,
                    gl.RGBA,
                    gl.UNSIGNED_BYTE,
                    imageSource.data
                );
            } else {
                gl.texImage2D(
                    gl.TEXTURE_2D,
                    0,
                    gl.RGBA,
                    gl.RGBA,
                    gl.UNSIGNED_BYTE,
                    imageSource
                );
            }
            
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            
            gl.bindTexture(gl.TEXTURE_2D, null);
            
            return texture;
        }

        /**
         * キャッシュに追加（LRU）
         */
        _addToCache(key, texture) {
            // キャッシュサイズ制限
            if (this.stampCache.size >= this.maxCacheSize) {
                const firstKey = this.stampCache.keys().next().value;
                const oldTexture = this.stampCache.get(firstKey);
                
                if (oldTexture && this.gl) {
                    this.gl.deleteTexture(oldTexture);
                }
                
                this.stampCache.delete(firstKey);
            }
            
            this.stampCache.set(key, texture);
        }

        /**
         * キャッシュクリア
         */
        clearCache() {
            const gl = this.gl;
            if (!gl) return;
            
            for (const texture of this.stampCache.values()) {
                gl.deleteTexture(texture);
            }
            
            this.stampCache.clear();
        }

        /**
         * クリーンアップ
         */
        destroy() {
            this.clearCache();
        }
    }

    // グローバル公開
    window.BrushStamp = new BrushStamp();
    
    console.log('✅ brush-stamp.js loaded');

})();