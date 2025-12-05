/**
 * ================================================================
 * raster-brush-core.js - Phase 2.1: ラスターブラシコア
 * ================================================================
 * 【役割】
 * - ブラシスタンプをテクスチャに直接描画
 * - ポイント間補間処理
 * - 筆圧・傾き対応
 * 
 * 【親依存】
 * - raster-layer.js (レイヤーFBO取得)
 * - brush-stamp.js (スタンプ生成)
 * - brush-interpolator.js (補間処理)
 * - coordinate-system.js (座標系は使わない - Local座標を受け取る)
 * 
 * 【子依存】
 * - brush-core.js (呼び出し元)
 * ================================================================
 */

(function() {
    'use strict';

    class RasterBrushCore {
        constructor() {
            this.gl = null;
            this.initialized = false;
            
            // 依存モジュール
            this.rasterLayer = null;
            this.brushStamp = null;
            this.interpolator = null;
            
            // 現在のストローク状態
            this.isDrawing = false;
            this.currentLayerId = null;
            this.currentSettings = null;
            this.lastPoint = null;
            
            // シェーダープログラム
            this.stampProgram = null;
            this.stampVAO = null;
            this.stampVBO = null;
            
            // キャッシュ
            this.stampTextureCache = new Map();
        }

        /**
         * 初期化
         * @param {WebGL2RenderingContext} gl 
         */
        initialize(gl) {
            if (this.initialized) {
                console.warn('[RasterBrushCore] Already initialized');
                return true;
            }

            this.gl = gl;
            
            // 依存モジュール取得
            this.rasterLayer = window.RasterLayer;
            this.brushStamp = window.BrushStamp;
            this.interpolator = window.BrushInterpolator;
            
            if (!this.rasterLayer) {
                console.error('[RasterBrushCore] window.RasterLayer not found');
                return false;
            }
            
            if (!this.brushStamp) {
                console.error('[RasterBrushCore] window.BrushStamp not found');
                return false;
            }
            
            if (!this.interpolator) {
                console.error('[RasterBrushCore] window.BrushInterpolator not found');
                return false;
            }
            
            // シェーダープログラム初期化
            if (!this._initializeShaders()) {
                console.error('[RasterBrushCore] Shader initialization failed');
                return false;
            }
            
            // 頂点バッファ初期化
            this._initializeBuffers();
            
            this.initialized = true;
            console.log('✅ [RasterBrushCore] Initialized');
            return true;
        }

        /**
         * シェーダー初期化
         */
        _initializeShaders() {
            const gl = this.gl;
            
            // 頂点シェーダー
            const vertexShaderSource = `#version 300 es
                in vec2 a_position;
                in vec2 a_texCoord;
                
                out vec2 v_texCoord;
                
                uniform vec2 u_resolution;
                uniform vec2 u_position;
                uniform float u_size;
                
                void main() {
                    vec2 pos = a_position * u_size + u_position;
                    vec2 clipSpace = (pos / u_resolution) * 2.0 - 1.0;
                    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
                    v_texCoord = a_texCoord;
                }
            `;
            
            // フラグメントシェーダー
            const fragmentShaderSource = `#version 300 es
                precision highp float;
                
                in vec2 v_texCoord;
                out vec4 fragColor;
                
                uniform vec4 u_color;
                uniform float u_hardness;
                uniform float u_opacity;
                
                void main() {
                    vec2 centered = v_texCoord * 2.0 - 1.0;
                    float dist = length(centered);
                    
                    // アンチエイリアス付き円
                    float edge = 1.0 - u_hardness * 0.3;
                    float alpha = smoothstep(1.0, edge, dist);
                    
                    fragColor = vec4(u_color.rgb, u_color.a * alpha * u_opacity);
                }
            `;
            
            // シェーダーコンパイル
            const vertexShader = this._compileShader(gl.VERTEX_SHADER, vertexShaderSource);
            const fragmentShader = this._compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
            
            if (!vertexShader || !fragmentShader) {
                return false;
            }
            
            // プログラムリンク
            this.stampProgram = gl.createProgram();
            gl.attachShader(this.stampProgram, vertexShader);
            gl.attachShader(this.stampProgram, fragmentShader);
            gl.linkProgram(this.stampProgram);
            
            if (!gl.getProgramParameter(this.stampProgram, gl.LINK_STATUS)) {
                console.error('[RasterBrushCore] Program link failed:', gl.getProgramInfoLog(this.stampProgram));
                return false;
            }
            
            // ユニフォーム位置取得
            this.stampProgram.uniforms = {
                u_resolution: gl.getUniformLocation(this.stampProgram, 'u_resolution'),
                u_position: gl.getUniformLocation(this.stampProgram, 'u_position'),
                u_size: gl.getUniformLocation(this.stampProgram, 'u_size'),
                u_color: gl.getUniformLocation(this.stampProgram, 'u_color'),
                u_hardness: gl.getUniformLocation(this.stampProgram, 'u_hardness'),
                u_opacity: gl.getUniformLocation(this.stampProgram, 'u_opacity')
            };
            
            return true;
        }

        /**
         * シェーダーコンパイル
         */
        _compileShader(type, source) {
            const gl = this.gl;
            const shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.error('[RasterBrushCore] Shader compile failed:', gl.getShaderInfoLog(shader));
                gl.deleteShader(shader);
                return null;
            }
            
            return shader;
        }

        /**
         * バッファ初期化
         */
        _initializeBuffers() {
            const gl = this.gl;
            
            // スタンプ用の四角形頂点（-0.5 ～ 0.5）
            const vertices = new Float32Array([
                -0.5, -0.5,  0.0, 0.0,
                 0.5, -0.5,  1.0, 0.0,
                -0.5,  0.5,  0.0, 1.0,
                 0.5,  0.5,  1.0, 1.0
            ]);
            
            this.stampVBO = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.stampVBO);
            gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
            
            // VAO作成
            this.stampVAO = gl.createVertexArray();
            gl.bindVertexArray(this.stampVAO);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, this.stampVBO);
            
            const a_position = gl.getAttribLocation(this.stampProgram, 'a_position');
            const a_texCoord = gl.getAttribLocation(this.stampProgram, 'a_texCoord');
            
            gl.enableVertexAttribArray(a_position);
            gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 16, 0);
            
            gl.enableVertexAttribArray(a_texCoord);
            gl.vertexAttribPointer(a_texCoord, 2, gl.FLOAT, false, 16, 8);
            
            gl.bindVertexArray(null);
        }

        /**
         * ストローク開始
         * @param {number} localX - Local X座標
         * @param {number} localY - Local Y座標
         * @param {number} pressure - 筆圧 (0.0～1.0)
         * @param {number} tiltX - X軸傾き
         * @param {number} tiltY - Y軸傾き
         * @param {number} twist - ひねり
         * @param {Object} settings - ブラシ設定
         */
        startStroke(localX, localY, pressure, tiltX, tiltY, twist, settings) {
            if (!this.initialized) {
                console.error('[RasterBrushCore] Not initialized');
                return;
            }

            this.isDrawing = true;
            this.currentSettings = settings;
            this.lastPoint = {
                localX,
                localY,
                pressure,
                tiltX,
                tiltY,
                twist,
                time: performance.now()
            };
            
            // 最初の点を描画
            this._drawStamp(localX, localY, pressure, tiltX, tiltY, twist);
        }

        /**
         * ストロークポイント追加
         */
        addStrokePoint(localX, localY, pressure, tiltX, tiltY, twist) {
            if (!this.isDrawing || !this.lastPoint) {
                return;
            }

            const currentPoint = {
                localX,
                localY,
                pressure,
                tiltX,
                tiltY,
                twist,
                time: performance.now()
            };
            
            // 補間ポイント生成
            const interpolatedPoints = this.interpolator.interpolate(
                this.lastPoint,
                currentPoint,
                this.currentSettings
            );
            
            // 各補間ポイントでスタンプ描画
            for (const point of interpolatedPoints) {
                this._drawStamp(
                    point.localX,
                    point.localY,
                    point.pressure,
                    point.tiltX,
                    point.tiltY,
                    point.twist
                );
            }
            
            // 現在のポイントも描画
            this._drawStamp(localX, localY, pressure, tiltX, tiltY, twist);
            
            this.lastPoint = currentPoint;
        }

        /**
         * ストローク終了
         * @returns {PIXI.Graphics} - Pixi.js表示用Graphics
         */
        finalizeStroke() {
            if (!this.isDrawing) {
                return null;
            }

            this.isDrawing = false;
            
            // レイヤーテクスチャからPixi.Graphicsを生成
            const graphics = this._createGraphicsFromTexture();
            
            this.lastPoint = null;
            this.currentSettings = null;
            
            return graphics;
        }

        /**
         * スタンプ描画
         */
        _drawStamp(localX, localY, pressure, tiltX, tiltY, twist) {
            const gl = this.gl;
            const settings = this.currentSettings;
            
            if (!settings) return;
            
            // FBO取得（現在のアクティブレイヤー）
            const layerManager = window.layerManager;
            if (!layerManager) return;
            
            const activeLayer = layerManager.getActiveLayer();
            if (!activeLayer || !activeLayer.layerData) return;
            
            const framebuffer = this.rasterLayer.getFramebuffer(activeLayer.layerData.id);
            if (!framebuffer) return;
            
            // FBOにバインド
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
            
            // ビューポート設定
            const width = window.TEGAKI_CONFIG.canvas.width;
            const height = window.TEGAKI_CONFIG.canvas.height;
            gl.viewport(0, 0, width, height);
            
            // ブレンド設定
            gl.enable(gl.BLEND);
            if (settings.mode === 'eraser') {
                gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
            } else {
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            }
            
            // シェーダー使用
            gl.useProgram(this.stampProgram);
            
            // ユニフォーム設定
            gl.uniform2f(this.stampProgram.uniforms.u_resolution, width, height);
            gl.uniform2f(this.stampProgram.uniforms.u_position, localX, localY);
            
            // サイズ計算（筆圧対応）
            const baseSize = settings.size || 10;
            const size = baseSize * Math.max(0.1, pressure);
            gl.uniform1f(this.stampProgram.uniforms.u_size, size);
            
            // 色設定
            const color = this._hexToRgb(settings.color || 0x800000);
            gl.uniform4f(this.stampProgram.uniforms.u_color, color.r, color.g, color.b, 1.0);
            
            // 硬さ・不透明度
            const hardness = settings.hardness !== undefined ? settings.hardness : 1.0;
            const opacity = settings.opacity !== undefined ? settings.opacity : 1.0;
            gl.uniform1f(this.stampProgram.uniforms.u_hardness, hardness);
            gl.uniform1f(this.stampProgram.uniforms.u_opacity, opacity);
            
            // 描画
            gl.bindVertexArray(this.stampVAO);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            gl.bindVertexArray(null);
            
            // クリーンアップ
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.disable(gl.BLEND);
        }

        /**
         * テクスチャからGraphics生成
         */
        _createGraphicsFromTexture() {
            const layerManager = window.layerManager;
            if (!layerManager) return null;
            
            const activeLayer = layerManager.getActiveLayer();
            if (!activeLayer || !activeLayer.layerData) return null;
            
            const texture = this.rasterLayer.getTexture(activeLayer.layerData.id);
            if (!texture) return null;
            
            // Pixi.Textureに変換
            const baseTexture = PIXI.BaseTexture.from(texture);
            const pixiTexture = new PIXI.Texture(baseTexture);
            
            // Sprite作成（Graphicsの代わり）
            const sprite = new PIXI.Sprite(pixiTexture);
            sprite.label = `raster_stroke_${Date.now()}`;
            
            const width = window.TEGAKI_CONFIG.canvas.width;
            const height = window.TEGAKI_CONFIG.canvas.height;
            sprite.width = width;
            sprite.height = height;
            
            // Graphics互換のためのラッパー
            const graphics = new PIXI.Graphics();
            graphics.addChild(sprite);
            graphics.label = sprite.label;
            
            return graphics;
        }

        /**
         * Hex色をRGBに変換
         */
        _hexToRgb(hex) {
            const r = ((hex >> 16) & 0xFF) / 255;
            const g = ((hex >> 8) & 0xFF) / 255;
            const b = (hex & 0xFF) / 255;
            return { r, g, b };
        }

        /**
         * キャンセル
         */
        cancelStroke() {
            this.isDrawing = false;
            this.lastPoint = null;
            this.currentSettings = null;
        }

        /**
         * クリーンアップ
         */
        destroy() {
            const gl = this.gl;
            if (!gl) return;
            
            if (this.stampProgram) {
                gl.deleteProgram(this.stampProgram);
            }
            if (this.stampVAO) {
                gl.deleteVertexArray(this.stampVAO);
            }
            if (this.stampVBO) {
                gl.deleteBuffer(this.stampVBO);
            }
            
            this.stampTextureCache.clear();
            this.initialized = false;
        }
    }

    // グローバル公開
    window.RasterBrushCore = new RasterBrushCore();
    
    console.log('✅ raster-brush-core.js loaded');

})();