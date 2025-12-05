/**
 * ================================================================
 * raster-layer.js - Phase 2.4: ラスターレイヤー管理
 * ================================================================
 * 【役割】
 * - WebGL2フレームバッファベースのレイヤー管理
 * - レイヤーごとに1 FBO + 1 RGBA texture
 * - レイヤー合成処理
 * - サムネイル生成（gl.readPixels）
 * 
 * 【親依存】
 * - なし（独立モジュール）
 * 
 * 【子依存】
 * - raster-brush-core.js
 * - thumbnail-system.js
 * - webgl2-drawing-layer.js
 * ================================================================
 */

(function() {
    'use strict';

    class RasterLayer {
        constructor() {
            this.gl = null;
            this.initialized = false;
            
            // レイヤーFBO管理
            this.layerFramebuffers = new Map(); // layerId -> FBO
            this.layerTextures = new Map();     // layerId -> Texture
            
            // キャンバスサイズ
            this.canvasWidth = 400;
            this.canvasHeight = 400;
            
            // 合成用シェーダー
            this.compositeProgram = null;
            this.compositeVAO = null;
            this.compositeVBO = null;
        }

        /**
         * 初期化
         * @param {WebGL2RenderingContext} gl 
         * @param {number} width - キャンバス幅
         * @param {number} height - キャンバス高さ
         */
        initialize(gl, width, height) {
            if (this.initialized) {
                console.warn('[RasterLayer] Already initialized');
                return true;
            }

            this.gl = gl;
            this.canvasWidth = width;
            this.canvasHeight = height;
            
            // 合成シェーダー初期化
            if (!this._initializeCompositeShader()) {
                console.error('[RasterLayer] Composite shader initialization failed');
                return false;
            }
            
            this.initialized = true;
            console.log('✅ [RasterLayer] Initialized', { width, height });
            return true;
        }

        /**
         * 合成シェーダー初期化
         */
        _initializeCompositeShader() {
            const gl = this.gl;
            
            // 頂点シェーダー
            const vertexShaderSource = `#version 300 es
                in vec2 a_position;
                in vec2 a_texCoord;
                
                out vec2 v_texCoord;
                
                void main() {
                    gl_Position = vec4(a_position, 0, 1);
                    v_texCoord = a_texCoord;
                }
            `;
            
            // フラグメントシェーダー
            const fragmentShaderSource = `#version 300 es
                precision highp float;
                
                in vec2 v_texCoord;
                out vec4 fragColor;
                
                uniform sampler2D u_texture;
                uniform float u_opacity;
                uniform int u_blendMode;
                
                void main() {
                    vec4 texColor = texture(u_texture, v_texCoord);
                    fragColor = vec4(texColor.rgb, texColor.a * u_opacity);
                }
            `;
            
            // シェーダーコンパイル
            const vertexShader = this._compileShader(gl.VERTEX_SHADER, vertexShaderSource);
            const fragmentShader = this._compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
            
            if (!vertexShader || !fragmentShader) {
                return false;
            }
            
            // プログラムリンク
            this.compositeProgram = gl.createProgram();
            gl.attachShader(this.compositeProgram, vertexShader);
            gl.attachShader(this.compositeProgram, fragmentShader);
            gl.linkProgram(this.compositeProgram);
            
            if (!gl.getProgramParameter(this.compositeProgram, gl.LINK_STATUS)) {
                console.error('[RasterLayer] Program link failed:', gl.getProgramInfoLog(this.compositeProgram));
                return false;
            }
            
            // ユニフォーム位置取得
            this.compositeProgram.uniforms = {
                u_texture: gl.getUniformLocation(this.compositeProgram, 'u_texture'),
                u_opacity: gl.getUniformLocation(this.compositeProgram, 'u_opacity'),
                u_blendMode: gl.getUniformLocation(this.compositeProgram, 'u_blendMode')
            };
            
            // 頂点バッファ（全画面四角形）
            const vertices = new Float32Array([
                -1, -1,  0, 0,
                 1, -1,  1, 0,
                -1,  1,  0, 1,
                 1,  1,  1, 1
            ]);
            
            this.compositeVBO = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.compositeVBO);
            gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
            
            // VAO作成
            this.compositeVAO = gl.createVertexArray();
            gl.bindVertexArray(this.compositeVAO);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, this.compositeVBO);
            
            const a_position = gl.getAttribLocation(this.compositeProgram, 'a_position');
            const a_texCoord = gl.getAttribLocation(this.compositeProgram, 'a_texCoord');
            
            gl.enableVertexAttribArray(a_position);
            gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 16, 0);
            
            gl.enableVertexAttribArray(a_texCoord);
            gl.vertexAttribPointer(a_texCoord, 2, gl.FLOAT, false, 16, 8);
            
            gl.bindVertexArray(null);
            
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
                console.error('[RasterLayer] Shader compile failed:', gl.getShaderInfoLog(shader));
                gl.deleteShader(shader);
                return null;
            }
            
            return shader;
        }

        /**
         * レイヤー作成
         * @param {string} layerId - レイヤーID
         * @returns {boolean} 成功/失敗
         */
        createLayer(layerId) {
            if (this.layerFramebuffers.has(layerId)) {
                console.warn(`[RasterLayer] Layer ${layerId} already exists`);
                return true;
            }

            const gl = this.gl;
            
            // テクスチャ作成
            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA,
                this.canvasWidth,
                this.canvasHeight,
                0,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                null
            );
            
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            
            // フレームバッファ作成
            const framebuffer = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
            gl.framebufferTexture2D(
                gl.FRAMEBUFFER,
                gl.COLOR_ATTACHMENT0,
                gl.TEXTURE_2D,
                texture,
                0
            );
            
            // FBOステータス確認
            const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
            if (status !== gl.FRAMEBUFFER_COMPLETE) {
                console.error(`[RasterLayer] Framebuffer incomplete: ${status}`);
                gl.deleteFramebuffer(framebuffer);
                gl.deleteTexture(texture);
                return false;
            }
            
            // 初期クリア（透明）
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.bindTexture(gl.TEXTURE_2D, null);
            
            // 保存
            this.layerFramebuffers.set(layerId, framebuffer);
            this.layerTextures.set(layerId, texture);
            
            console.log(`✅ [RasterLayer] Layer created: ${layerId}`);
            return true;
        }

        /**
         * レイヤー削除
         * @param {string} layerId 
         */
        deleteLayer(layerId) {
            const gl = this.gl;
            
            const framebuffer = this.layerFramebuffers.get(layerId);
            const texture = this.layerTextures.get(layerId);
            
            if (framebuffer) {
                gl.deleteFramebuffer(framebuffer);
                this.layerFramebuffers.delete(layerId);
            }
            
            if (texture) {
                gl.deleteTexture(texture);
                this.layerTextures.delete(layerId);
            }
            
            console.log(`🗑️ [RasterLayer] Layer deleted: ${layerId}`);
        }

        /**
         * レイヤークリア
         * @param {string} layerId 
         */
        clearLayer(layerId) {
            const gl = this.gl;
            const framebuffer = this.layerFramebuffers.get(layerId);
            
            if (!framebuffer) {
                console.warn(`[RasterLayer] Layer not found: ${layerId}`);
                return;
            }
            
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }

        /**
         * フレームバッファ取得
         * @param {string} layerId 
         * @returns {WebGLFramebuffer|null}
         */
        getFramebuffer(layerId) {
            return this.layerFramebuffers.get(layerId) || null;
        }

        /**
         * テクスチャ取得
         * @param {string} layerId 
         * @returns {WebGLTexture|null}
         */
        getTexture(layerId) {
            return this.layerTextures.get(layerId) || null;
        }

        /**
         * レイヤー合成
         * @param {Array<Object>} layers - レイヤー配列 [{id, opacity, visible, blendMode}, ...]
         * @param {WebGLFramebuffer} targetFBO - 出力先FBO（nullの場合は画面）
         */
        compositeLayers(layers, targetFBO = null) {
            const gl = this.gl;
            
            // 出力先にバインド
            gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO);
            gl.viewport(0, 0, this.canvasWidth, this.canvasHeight);
            
            // 背景クリア
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            
            // ブレンド有効化
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            
            // シェーダー使用
            gl.useProgram(this.compositeProgram);
            gl.bindVertexArray(this.compositeVAO);
            
            // レイヤーを順番に描画
            for (const layer of layers) {
                if (!layer.visible) continue;
                
                const texture = this.layerTextures.get(layer.id);
                if (!texture) continue;
                
                // テクスチャバインド
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.uniform1i(this.compositeProgram.uniforms.u_texture, 0);
                
                // 不透明度設定
                const opacity = layer.opacity !== undefined ? layer.opacity : 1.0;
                gl.uniform1f(this.compositeProgram.uniforms.u_opacity, opacity);
                
                // ブレンドモード設定（将来拡張）
                gl.uniform1i(this.compositeProgram.uniforms.u_blendMode, 0);
                
                // 描画
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            }
            
            // クリーンアップ
            gl.bindVertexArray(null);
            gl.bindTexture(gl.TEXTURE_2D, null);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.disable(gl.BLEND);
        }

        /**
         * レイヤーテクスチャ読み取り（サムネイル用）
         * @param {string} layerId 
         * @returns {Uint8Array|null} RGBA配列
         */
        readPixels(layerId) {
            const gl = this.gl;
            const framebuffer = this.layerFramebuffers.get(layerId);
            
            if (!framebuffer) {
                console.warn(`[RasterLayer] Layer not found: ${layerId}`);
                return null;
            }
            
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
            
            const pixels = new Uint8Array(this.canvasWidth * this.canvasHeight * 4);
            gl.readPixels(
                0, 0,
                this.canvasWidth,
                this.canvasHeight,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                pixels
            );
            
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            
            return pixels;
        }

        /**
         * サムネイル生成
         * @param {string} layerId 
         * @param {number} thumbnailSize - サムネイルサイズ（正方形）
         * @returns {HTMLCanvasElement|null}
         */
        generateThumbnail(layerId, thumbnailSize = 48) {
            const pixels = this.readPixels(layerId);
            if (!pixels) return null;
            
            // 一時キャンバス作成
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.canvasWidth;
            tempCanvas.height = this.canvasHeight;
            const tempCtx = tempCanvas.getContext('2d');
            
            // ピクセルデータをImageDataに変換
            const imageData = tempCtx.createImageData(this.canvasWidth, this.canvasHeight);
            
            // Y軸反転（WebGLは下から上）
            for (let y = 0; y < this.canvasHeight; y++) {
                for (let x = 0; x < this.canvasWidth; x++) {
                    const srcIdx = ((this.canvasHeight - 1 - y) * this.canvasWidth + x) * 4;
                    const dstIdx = (y * this.canvasWidth + x) * 4;
                    
                    imageData.data[dstIdx + 0] = pixels[srcIdx + 0];
                    imageData.data[dstIdx + 1] = pixels[srcIdx + 1];
                    imageData.data[dstIdx + 2] = pixels[srcIdx + 2];
                    imageData.data[dstIdx + 3] = pixels[srcIdx + 3];
                }
            }
            
            tempCtx.putImageData(imageData, 0, 0);
            
            // リサイズ
            const thumbCanvas = document.createElement('canvas');
            thumbCanvas.width = thumbnailSize;
            thumbCanvas.height = thumbnailSize;
            const thumbCtx = thumbCanvas.getContext('2d');
            
            thumbCtx.drawImage(
                tempCanvas,
                0, 0, this.canvasWidth, this.canvasHeight,
                0, 0, thumbnailSize, thumbnailSize
            );
            
            return thumbCanvas;
        }

        /**
         * レイヤーリサイズ
         * @param {number} newWidth 
         * @param {number} newHeight 
         */
        resizeAll(newWidth, newHeight) {
            if (newWidth === this.canvasWidth && newHeight === this.canvasHeight) {
                return;
            }
            
            console.log(`🔄 [RasterLayer] Resizing from ${this.canvasWidth}x${this.canvasHeight} to ${newWidth}x${newHeight}`);
            
            const gl = this.gl;
            
            // 既存レイヤーを再作成
            const layerIds = Array.from(this.layerFramebuffers.keys());
            
            for (const layerId of layerIds) {
                // 古いピクセルデータ保存
                const oldPixels = this.readPixels(layerId);
                
                // 削除
                this.deleteLayer(layerId);
                
                // サイズ更新
                this.canvasWidth = newWidth;
                this.canvasHeight = newHeight;
                
                // 再作成
                this.createLayer(layerId);
                
                // データ復元（リサイズ処理）
                if (oldPixels) {
                    // TODO: ピクセルデータのリサイズ処理
                    // 現状は新規作成のみ
                }
            }
            
            this.canvasWidth = newWidth;
            this.canvasHeight = newHeight;
        }

        /**
         * クリーンアップ
         */
        destroy() {
            const gl = this.gl;
            if (!gl) return;
            
            // 全レイヤー削除
            for (const layerId of this.layerFramebuffers.keys()) {
                this.deleteLayer(layerId);
            }
            
            // シェーダー削除
            if (this.compositeProgram) {
                gl.deleteProgram(this.compositeProgram);
            }
            if (this.compositeVAO) {
                gl.deleteVertexArray(this.compositeVAO);
            }
            if (this.compositeVBO) {
                gl.deleteBuffer(this.compositeVBO);
            }
            
            this.initialized = false;
            console.log('🗑️ [RasterLayer] Destroyed');
        }
    }

    // グローバル公開
    window.RasterLayer = new RasterLayer();
    
    console.log('✅ raster-layer.js loaded');

})();