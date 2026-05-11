/**
 * ================================================================
 * brush-stamp.js - Phase 2.2: ブラシスタンプ生成・描画
 * ================================================================
 * 【役割】
 * - ブラシスタンプテクスチャ生成
 * - 円形スタンプ生成
 * - テクスチャスタンプ生成
 * - スタンプ描画（WebGL2専用）
 * 
 * 【Phase 2.2改修内容】
 * ✅ WebGL2 drawStamp() メソッド実装
 * ✅ 消しゴムモード対応
 * ✅ 属性バッファ/VAO管理
 * ✅ グローバル登録 (BrushStamp / brushStamp)
 * ================================================================
 */

(function() {
    'use strict';

    class BrushStamp {
        constructor() {
            this.gl = null;
            this.stampCache = new Map();
            this.maxCacheSize = 20;
            
            // WebGL2 Resources
            this.program = null;
            this.vao = null;
            this.vbo = null;
            this.initialized = false;
        }

        /**
         * 初期化
         */
        initialize(gl) {
            this.gl = gl;
            console.log('✅ [BrushStamp] WebGL2 Context initialized');
            this._initResources(gl);
            this.initialized = true;
        }

        /**
         * WebGLリソース初期化
         * @private
         */
        _initResources(gl) {
            if (!window.TegakiShaders || !window.TegakiShaders.createAllPrograms) {
                console.warn('[BrushStamp] TegakiShaders not ready');
                return;
            }

            // シェーダープログラム生成
            const programs = window.TegakiShaders.createAllPrograms(gl);
            if (!programs || !programs.brushStamp) {
                console.error('[BrushStamp] Failed to create brushStamp program');
                return;
            }
            this.program = programs.brushStamp;

            // 頂点データ (x, y, u, v)
            // -1.0～1.0のクワッド（ビルボード）
            const vertices = new Float32Array([
                -1.0, -1.0,  0.0, 0.0,
                 1.0, -1.0,  1.0, 0.0,
                -1.0,  1.0,  0.0, 1.0,
                 1.0,  1.0,  1.0, 1.0
            ]);

            // VAO作成
            this.vao = gl.createVertexArray();
            gl.bindVertexArray(this.vao);

            // VBO作成
            this.vbo = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
            gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

            // 属性設定
            const aPos = gl.getAttribLocation(this.program, 'a_position');
            const aTex = gl.getAttribLocation(this.program, 'a_texCoord');

            gl.enableVertexAttribArray(aPos);
            gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);

            gl.enableVertexAttribArray(aTex);
            gl.vertexAttribPointer(aTex, 2, gl.FLOAT, false, 16, 8);

            gl.bindVertexArray(null);
            
            console.log('✅ [BrushStamp] WebGL resources initialized');
        }

        /**
         * スタンプ描画（WebGL2専用）
         * 
         * @param {WebGL2RenderingContext} gl - GLコンテキスト
         * @param {number} x - 描画X
         * @param {number} y - 描画Y
         * @param {number} size - ブラシサイズ
         * @param {number} opacity - 不透明度 (0-1)
         * @param {Object} color - RGB色 {r, g, b} (0-1)
         * @param {number} tiltX - 傾きX
         * @param {number} tiltY - 傾きY
         * @param {number} twist - 回転
         * @param {number} hardness - 硬度 (0-1)
         * @param {number} flow - 流量 (0-1)
         * @param {boolean} isEraser - 消しゴムモードか
         */
        drawStamp(gl, x, y, size, opacity, color, tiltX, tiltY, twist, hardness, flow, isEraser = false) {
            if (!this.initialized) {
                this.initialize(gl);
            }
            if (!this.program) return;

            gl.useProgram(this.program);
            gl.bindVertexArray(this.vao);

            // ユニフォーム設定
            const uRes = gl.getUniformLocation(this.program, 'u_resolution');
            const uPos = gl.getUniformLocation(this.program, 'u_position');
            const uSize = gl.getUniformLocation(this.program, 'u_size');
            const uRot = gl.getUniformLocation(this.program, 'u_rotation');
            const uColor = gl.getUniformLocation(this.program, 'u_color');
            const uOpacity = gl.getUniformLocation(this.program, 'u_opacity');
            const uHardness = gl.getUniformLocation(this.program, 'u_hardness');
            const uEraser = gl.getUniformLocation(this.program, 'u_eraser');

            // 座標系: 0～width -> -1～1 (シェーダー側で処理)
            gl.uniform2f(uRes, gl.canvas.width, gl.canvas.height);
            gl.uniform2f(uPos, x, y);
            gl.uniform1f(uSize, size * 0.5); // 半径として扱う
            gl.uniform1f(uRot, twist);
            
            if (color) {
                gl.uniform3f(uColor, color.r, color.g, color.b);
            } else {
                gl.uniform3f(uColor, 0, 0, 0);
            }
            
            gl.uniform1f(uOpacity, opacity * flow);
            gl.uniform1f(uHardness, hardness);
            gl.uniform1i(uEraser, isEraser ? 1 : 0);

            // ブレンディング設定
            gl.enable(gl.BLEND);
            if (isEraser) {
                // 消しゴム: DstAlpha * (1 - SrcAlpha)
                gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
            } else {
                // 通常: SrcAlpha + DstAlpha * (1 - SrcAlpha)
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            }

            // スタンプテクスチャ（現在は単一の円形またはデフォルトを使用）
            // 将来的にテクスチャ指定可能にする
            
            // 描画実行
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

            // 後始末
            gl.bindVertexArray(null);
        }

        /**
         * 円形スタンプテクスチャ生成
         * (※現在はシェーダー側で円を描画するため、デバッグや将来用)
         */
        generateCircleStamp(size, hardness = 1, antialias = true) {
            const cacheKey = `circle_${size}_${hardness}_${antialias}`;
            if (this.stampCache.has(cacheKey)) {
                return this.stampCache.get(cacheKey);
            }

            const canvas = document.createElement('canvas');
            const ctxSize = Math.ceil(size * 2);
            canvas.width = ctxSize;
            canvas.height = ctxSize;
            const ctx = canvas.getContext('2d');

            const center = ctxSize / 2;
            const radius = size / 2;

            ctx.clearRect(0, 0, ctxSize, ctxSize);
            
            const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
            gradient.addColorStop(hardness, 'rgba(255, 255, 255, 1)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(center, center, radius, 0, Math.PI * 2);
            ctx.fill();

            const texture = this._createTextureFromCanvas(canvas);
            this.stampCache.set(cacheKey, texture);
            return texture;
        }

        /**
         * CanvasからWebGLテクスチャを作成
         * @private
         */
        _createTextureFromCanvas(canvas) {
            const gl = this.gl;
            if (!gl) return null;

            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
            
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

            return texture;
        }

        /**
         * キャッシュクリア
         */
        clearCache() {
            if (this.gl) {
                for (const texture of this.stampCache.values()) {
                    this.gl.deleteTexture(texture);
                }
            }
            this.stampCache.clear();
        }

        /**
         * クリーンアップ
         */
        destroy() {
            this.clearCache();
            if (this.gl) {
                if (this.vao) this.gl.deleteVertexArray(this.vao);
                if (this.vbo) this.gl.deleteBuffer(this.vbo);
            }
        }
    }

    // グローバル公開
    const instance = new BrushStamp();
    window.BrushStamp = instance;
    window.brushStamp = instance; // 小文字版も登録
    
    console.log('✅ brush-stamp.js loaded (Reconstructed for WebGL2)');

})();
