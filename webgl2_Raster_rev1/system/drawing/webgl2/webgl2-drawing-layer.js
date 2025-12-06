/**
 * ================================================================
 * [PART 1/3] Initialization & Setup
 * ================================================================
 * ⚠️ このファイルは3パートに分割されています
 * ⚠️ 各パートを順番にコピペして結合してください
 * ================================================================
 */

/**
 * ============================================================
 * webgl2-drawing-layer.js - Phase 3.3: ラスター対応版
 * ============================================================
 * 【役割】
 * - WebGL2レイヤー統合管理
 * - ラスターテクスチャ合成
 * - Pixi.jsとの連携
 * 
 * 【親依存】
 * - gl-texture-bridge.js
 * - raster-layer.js (新規)
 * 
 * 【Phase 3.3改修内容】
 * ✅ ベクター合成処理削除
 * ✅ ラスターレイヤー合成実装
 * ✅ RasterLayer統合
 * ============================================================
 */

(function() {
    'use strict';

    class WebGL2DrawingLayer {
        constructor() {
            this.gl = null;
            this.canvas = null;
            this.initialized = false;
            
            // レイヤー管理
            this.rasterLayer = null;
            this.textureBridge = null;
            
            // シェーダープログラム
            this.displayProgram = null;
            this.displayVAO = null;
            this.displayVBO = null;
            
            // キャンバスサイズ
            this.width = 400;
            this.height = 400;
            
            // Pixi統合
            this.pixiApp = null;
            this.pixiTexture = null;
            
            // デバッグ
            this.debugMode = false;
        }

        /**
         * 初期化
         * @param {HTMLCanvasElement} canvas 
         * @param {number} width 
         * @param {number} height 
         */
        async initialize(canvas, width, height) {
            if (this.initialized) {
                console.warn('[WebGL2DrawingLayer] Already initialized');
                return true;
            }

            this.canvas = canvas;
            this.width = width;
            this.height = height;
            
            // WebGL2コンテキスト取得
            this.gl = canvas.getContext('webgl2', {
                alpha: true,
                premultipliedAlpha: true,
                preserveDrawingBuffer: true,
                antialias: true
            });
            
            if (!this.gl) {
                console.error('[WebGL2DrawingLayer] WebGL2 not supported');
                return false;
            }
            
            console.log('✅ [WebGL2DrawingLayer] WebGL2 context created');
            
            // グローバル登録
            if (!window.WebGLContext) {
                window.WebGLContext = {};
            }
            window.WebGLContext.gl = this.gl;
            
            // RasterLayer初期化
            if (window.RasterLayer) {
                this.rasterLayer = window.RasterLayer;
                if (!this.rasterLayer.initialize(this.gl, width, height)) {
                    console.error('[WebGL2DrawingLayer] RasterLayer initialization failed');
                    return false;
                }
            } else {
                console.error('[WebGL2DrawingLayer] window.RasterLayer not found');
                return false;
            }
            
            // RasterBrushCore初期化（core-engine.js で行われるためスキップ）
            // window.rasterBrushCore が core-engine.js で初期化済み
            
            // BrushStamp初期化
            if (window.BrushStamp) {
                window.BrushStamp.initialize(this.gl);
            }
            
            // TextureBridge初期化
            if (window.GLTextureBridge) {
                this.textureBridge = window.GLTextureBridge;
            }
            
            // ディスプレイシェーダー初期化
            if (!this._initializeDisplayShader()) {
                console.error('[WebGL2DrawingLayer] Display shader initialization failed');
                return false;
            }
            
            // WebGL設定
            this.gl.enable(this.gl.BLEND);
            this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
            
            this.initialized = true;
            console.log('✅ [WebGL2DrawingLayer] Initialized', { width, height });
            return true;
        }

        /**
         * ディスプレイシェーダー初期化
         */
        _initializeDisplayShader() {
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
                
                void main() {
                    fragColor = texture(u_texture, v_texCoord);
                }
            `;
            
            // シェーダーコンパイル
            const vertexShader = this._compileShader(gl.VERTEX_SHADER, vertexShaderSource);
            const fragmentShader = this._compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
            
            if (!vertexShader || !fragmentShader) {
                return false;
            }
            
            // プログラムリンク
            this.displayProgram = gl.createProgram();
            gl.attachShader(this.displayProgram, vertexShader);
            gl.attachShader(this.displayProgram, fragmentShader);
            gl.linkProgram(this.displayProgram);
            
            if (!gl.getProgramParameter(this.displayProgram, gl.LINK_STATUS)) {
                console.error('[WebGL2DrawingLayer] Program link failed:', gl.getProgramInfoLog(this.displayProgram));
                return false;
            }
            
            // ユニフォーム位置取得
            this.displayProgram.uniforms = {
                u_texture: gl.getUniformLocation(this.displayProgram, 'u_texture')
            };
            
            // 頂点バッファ（全画面四角形）
            const vertices = new Float32Array([
                -1, -1,  0, 0,
                 1, -1,  1, 0,
                -1,  1,  0, 1,
                 1,  1,  1, 1
            ]);
            
            this.displayVBO = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.displayVBO);
            gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
            
            // VAO作成
            this.displayVAO = gl.createVertexArray();
            gl.bindVertexArray(this.displayVAO);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, this.displayVBO);
            
            const a_position = gl.getAttribLocation(this.displayProgram, 'a_position');
            const a_texCoord = gl.getAttribLocation(this.displayProgram, 'a_texCoord');
            
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
                console.error('[WebGL2DrawingLayer] Shader compile failed:', gl.getShaderInfoLog(shader));
                gl.deleteShader(shader);
                return null;
            }
            
            return shader;
        }

        /**
         * Pixi.js統合設定
         * @param {PIXI.Application} pixiApp 
         */
        setPixiApp(pixiApp) {
            this.pixiApp = pixiApp;
            console.log('✅ [WebGL2DrawingLayer] Pixi.js app linked');
        }

/**
 * ================================================================
 * [END PART 1] - 次は PART 2 をこの下に貼り付けてください
 * ================================================================
 */

/**
 * ================================================================
 * [PART 2/3] Layer Management & Composition
 * ================================================================
 * ⚠️ PART 1 の下にこのコードを貼り付けてください
 * ================================================================
 */

        /**
         * レイヤー作成
         * @param {string} layerId 
         */
        createLayer(layerId) {
            if (!this.rasterLayer) {
                console.error('[WebGL2DrawingLayer] RasterLayer not initialized');
                return false;
            }
            
            return this.rasterLayer.createLayer(layerId);
        }

        /**
         * レイヤー削除
         * @param {string} layerId 
         */
        deleteLayer(layerId) {
            if (!this.rasterLayer) return;
            
            this.rasterLayer.deleteLayer(layerId);
        }

        /**
         * レイヤークリア
         * @param {string} layerId 
         */
        clearLayer(layerId) {
            if (!this.rasterLayer) return;
            
            this.rasterLayer.clearLayer(layerId);
        }

        /**
         * レイヤーフレームバッファ取得
         * @param {string} layerId 
         * @returns {WebGLFramebuffer|null}
         */
        getLayerFramebuffer(layerId) {
            if (!this.rasterLayer) return null;
            
            return this.rasterLayer.getFramebuffer(layerId);
        }

        /**
         * レイヤーテクスチャ取得
         * @param {string} layerId 
         * @returns {WebGLTexture|null}
         */
        getLayerTexture(layerId) {
            if (!this.rasterLayer) return null;
            
            return this.rasterLayer.getTexture(layerId);
        }

        /**
         * 全レイヤー合成
         * @param {Array<Object>} layers - レイヤー配列
         */
        compositeLayers(layers) {
            if (!this.rasterLayer) return;
            
            const gl = this.gl;
            
            // 画面にクリア
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, this.width, this.height);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            
            // レイヤー合成（画面に直接出力）
            this.rasterLayer.compositeLayers(layers, null);
        }

        /**
         * 単一レイヤー描画
         * @param {string} layerId 
         * @param {number} opacity 
         */
        drawLayer(layerId, opacity = 1.0) {
            const gl = this.gl;
            const texture = this.rasterLayer.getTexture(layerId);
            
            if (!texture) return;
            
            gl.useProgram(this.displayProgram);
            gl.bindVertexArray(this.displayVAO);
            
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniform1i(this.displayProgram.uniforms.u_texture, 0);
            
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            
            gl.bindVertexArray(null);
            gl.bindTexture(gl.TEXTURE_2D, null);
        }

        /**
         * レイヤーサムネイル生成
         * @param {string} layerId 
         * @param {number} size 
         * @returns {HTMLCanvasElement|null}
         */
        generateLayerThumbnail(layerId, size = 48) {
            if (!this.rasterLayer) return null;
            
            return this.rasterLayer.generateThumbnail(layerId, size);
        }

        /**
         * レイヤーピクセルデータ取得
         * @param {string} layerId 
         * @returns {Uint8Array|null}
         */
        readLayerPixels(layerId) {
            if (!this.rasterLayer) return null;
            
            return this.rasterLayer.readPixels(layerId);
        }

        /**
         * キャンバスリサイズ
         * @param {number} newWidth 
         * @param {number} newHeight 
         */
        resize(newWidth, newHeight) {
            if (newWidth === this.width && newHeight === this.height) {
                return;
            }
            
            console.log(`🔄 [WebGL2DrawingLayer] Resizing to ${newWidth}x${newHeight}`);
            
            this.width = newWidth;
            this.height = newHeight;
            
            // キャンバスサイズ変更
            if (this.canvas) {
                this.canvas.width = newWidth;
                this.canvas.height = newHeight;
            }
            
            // RasterLayerリサイズ
            if (this.rasterLayer) {
                this.rasterLayer.resizeAll(newWidth, newHeight);
            }
            
            // ビューポート更新
            const gl = this.gl;
            gl.viewport(0, 0, newWidth, newHeight);
        }

        /**
         * レンダリング（メインループ用）
         */
        render() {
            if (!this.initialized) return;
            
            const gl = this.gl;
            
            // 画面クリア
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, this.width, this.height);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            
            // レイヤーマネージャーから全レイヤー取得
            const layerManager = window.layerManager;
            if (!layerManager) return;
            
            const layers = layerManager.getLayers();
            if (!layers || layers.length === 0) return;
            
            // レイヤー情報配列作成
            const layerInfos = layers.map(layer => ({
                id: layer.layerData?.id,
                visible: layer.visible !== false,
                opacity: layer.alpha !== undefined ? layer.alpha : 1.0,
                blendMode: layer.blendMode || 'normal'
            })).filter(info => info.id);
            
            // 合成
            this.compositeLayers(layerInfos);
        }

/**
 * ================================================================
 * [END PART 2] - 次は PART 3 をこの下に貼り付けてください
 * ================================================================
 */

/**
 * ================================================================
 * [PART 3/3] Utilities & Cleanup
 * ================================================================
 * ⚠️ PART 2 の下にこのコードを貼り付けてください
 * ================================================================
 */

        /**
         * Pixi.jsへテクスチャ転送
         * @param {string} layerId 
         * @returns {PIXI.Texture|null}
         */
        blitToPixi(layerId) {
            if (!this.textureBridge) {
                console.warn('[WebGL2DrawingLayer] TextureBridge not available');
                return null;
            }
            
            const glTexture = this.getLayerTexture(layerId);
            if (!glTexture) return null;
            
            try {
                // WebGLTexture → Pixi.Texture変換
                const baseTexture = PIXI.BaseTexture.from(glTexture);
                const pixiTexture = new PIXI.Texture(baseTexture);
                return pixiTexture;
            } catch (error) {
                console.error('[WebGL2DrawingLayer] Pixi texture conversion failed:', error);
                return null;
            }
        }

        /**
         * WebGLステート取得（デバッグ用）
         */
        getGLState() {
            const gl = this.gl;
            if (!gl) return null;
            
            return {
                version: gl.getParameter(gl.VERSION),
                vendor: gl.getParameter(gl.VENDOR),
                renderer: gl.getParameter(gl.RENDERER),
                maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
                maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
                maxFramebufferWidth: gl.getParameter(gl.MAX_FRAMEBUFFER_WIDTH),
                maxFramebufferHeight: gl.getParameter(gl.MAX_FRAMEBUFFER_HEIGHT),
                maxColorAttachments: gl.getParameter(gl.MAX_COLOR_ATTACHMENTS)
            };
        }

        /**
         * デバッグモード切替
         * @param {boolean} enabled 
         */
        setDebugMode(enabled) {
            this.debugMode = enabled;
            
            if (enabled) {
                console.log('🐛 [WebGL2DrawingLayer] Debug mode enabled');
                console.log('GL State:', this.getGLState());
            }
        }

        /**
         * レイヤー情報ダンプ（デバッグ用）
         */
        dumpLayerInfo() {
            if (!this.rasterLayer) {
                console.log('No RasterLayer');
                return;
            }
            
            console.group('📊 Layer Information');
            console.log('Canvas size:', this.width, 'x', this.height);
            console.log('Framebuffers:', this.rasterLayer.layerFramebuffers.size);
            console.log('Textures:', this.rasterLayer.layerTextures.size);
            
            for (const [layerId, fbo] of this.rasterLayer.layerFramebuffers.entries()) {
                console.log(`  - Layer: ${layerId}`);
            }
            
            console.groupEnd();
        }

        /**
         * エクスポート用レンダリング
         * @param {Array<Object>} layers 
         * @param {number} width 
         * @param {number} height 
         * @returns {HTMLCanvasElement}
         */
        renderToCanvas(layers, width = null, height = null) {
            const targetWidth = width || this.width;
            const targetHeight = height || this.height;
            
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = targetWidth;
            exportCanvas.height = targetHeight;
            
            const gl = this.gl;
            
            // 一時FBO作成
            const tempFBO = gl.createFramebuffer();
            const tempTexture = gl.createTexture();
            
            gl.bindTexture(gl.TEXTURE_2D, tempTexture);
            gl.texImage2D(
                gl.TEXTURE_2D, 0, gl.RGBA,
                targetWidth, targetHeight, 0,
                gl.RGBA, gl.UNSIGNED_BYTE, null
            );
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            
            gl.bindFramebuffer(gl.FRAMEBUFFER, tempFBO);
            gl.framebufferTexture2D(
                gl.FRAMEBUFFER,
                gl.COLOR_ATTACHMENT0,
                gl.TEXTURE_2D,
                tempTexture, 0
            );
            
            // レイヤー合成
            this.rasterLayer.compositeLayers(layers, tempFBO);
            
            // ピクセル読み取り
            gl.bindFramebuffer(gl.FRAMEBUFFER, tempFBO);
            const pixels = new Uint8Array(targetWidth * targetHeight * 4);
            gl.readPixels(0, 0, targetWidth, targetHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            
            // Canvas2Dに転送（Y軸反転）
            const ctx = exportCanvas.getContext('2d');
            const imageData = ctx.createImageData(targetWidth, targetHeight);
            
            for (let y = 0; y < targetHeight; y++) {
                for (let x = 0; x < targetWidth; x++) {
                    const srcIdx = ((targetHeight - 1 - y) * targetWidth + x) * 4;
                    const dstIdx = (y * targetWidth + x) * 4;
                    
                    imageData.data[dstIdx + 0] = pixels[srcIdx + 0];
                    imageData.data[dstIdx + 1] = pixels[srcIdx + 1];
                    imageData.data[dstIdx + 2] = pixels[srcIdx + 2];
                    imageData.data[dstIdx + 3] = pixels[srcIdx + 3];
                }
            }
            
            ctx.putImageData(imageData, 0, 0);
            
            // クリーンアップ
            gl.deleteFramebuffer(tempFBO);
            gl.deleteTexture(tempTexture);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            
            return exportCanvas;
        }

        /**
         * クリーンアップ
         */
        destroy() {
            const gl = this.gl;
            if (!gl) return;
            
            console.log('🗑️ [WebGL2DrawingLayer] Destroying...');
            
            // RasterLayer破棄
            if (this.rasterLayer) {
                this.rasterLayer.destroy();
            }
            
            // RasterBrushCore破棄
            if (window.RasterBrushCore) {
                window.RasterBrushCore.destroy();
            }
            
            // BrushStamp破棄
            if (window.BrushStamp) {
                window.BrushStamp.destroy();
            }
            
            // シェーダー削除
            if (this.displayProgram) {
                gl.deleteProgram(this.displayProgram);
            }
            if (this.displayVAO) {
                gl.deleteVertexArray(this.displayVAO);
            }
            if (this.displayVBO) {
                gl.deleteBuffer(this.displayVBO);
            }
            
            this.initialized = false;
            console.log('✅ [WebGL2DrawingLayer] Destroyed');
        }
    }

    // グローバル公開
window.WebGL2DrawingLayer = WebGL2DrawingLayer;

    console.log('✅ webgl2-drawing-layer.js Phase 3.3 loaded (ラスター対応版)');
    console.log('   ✅ ベクター合成処理削除');
    console.log('   ✅ ラスターレイヤー合成実装');
    console.log('   ✅ RasterLayer統合');
    console.log('   🔧 クラスとして公開（シングルトンではなく）');

})();

/**
 * ================================================================
 * [END PART 3] - ファイル完成！
 * ================================================================
 */