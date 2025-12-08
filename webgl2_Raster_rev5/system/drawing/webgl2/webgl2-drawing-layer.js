/**
 * ============================================================
 * webgl2-drawing-layer.js - Phase C完全版
 * ============================================================
 * 【役割】
 * - WebGL2レイヤー統合管理
 * - ラスターテクスチャ合成
 * - Pixi.jsとの連携
 * 
 * 【Phase C完全実装】
 * ✅ C-1: WebGL2描画パイプライン完全統合
 * ✅ C-2: RasterLayer統合強化
 * ✅ C-3: パフォーマンス最適化
 * 
 * 【親依存】
 * - gl-texture-bridge.js
 * - raster-layer.js
 * - shader-inline.js
 * 
 * 【子依存】
 * - core-initializer.js
 * ============================================================
 */

(function() {
    'use strict';

    class WebGL2DrawingLayer {
        constructor() {
            // ================================================================================
            // WebGL2コンテキスト
            // ================================================================================
            this.gl = null;
            this.canvas = null;
            this.initialized = false;
            
            // ================================================================================
            // レイヤー管理
            // ================================================================================
            this.rasterLayer = null;
            this.textureBridge = null;
            
            // ================================================================================
            // シェーダープログラム
            // ================================================================================
            this.displayProgram = null;
            this.displayVAO = null;
            this.displayVBO = null;
            
            // ================================================================================
            // キャンバスサイズ
            // ================================================================================
            this.width = 400;
            this.height = 400;
            
            // ================================================================================
            // Pixi統合
            // ================================================================================
            this.pixiApp = null;
            this.pixiTexture = null;
            
            // ================================================================================
            // Phase C-3: パフォーマンス最適化
            // ================================================================================
            this.enableOptimization = true;
            this.lastRenderTime = 0;
            this.frameCount = 0;
            this.fps = 0;
            
            // ================================================================================
            // デバッグ
            // ================================================================================
            this.debugMode = false;
        }

        // ================================================================================
        // 初期化
        // ================================================================================

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
                antialias: true, // Phase C-3: アンチエイリアス有効化
                powerPreference: 'high-performance', // Phase C-3: 高性能モード
                desynchronized: true // Phase C-3: 非同期レンダリング
            });
            
            if (!this.gl) {
                console.error('[WebGL2DrawingLayer] WebGL2 not supported');
                return false;
            }
            
            console.log('✅ [WebGL2DrawingLayer] WebGL2 context created');
            console.log('   ✅ High-performance mode enabled');
            console.log('   ✅ Antialiasing enabled');
            
            // グローバル登録
            if (!window.WebGLContext) {
                window.WebGLContext = {};
            }
            window.WebGLContext.gl = this.gl;
            
            // Phase C-2: RasterLayer初期化（強化版）
            if (window.RasterLayer) {
                this.rasterLayer = window.RasterLayer;
                
                // 既に初期化済みかチェック
                if (this.rasterLayer.initialized) {
                    console.warn('[WebGL2DrawingLayer] RasterLayer already initialized, skipping');
                } else {
                    if (!this.rasterLayer.initialize(this.gl, width, height)) {
                        console.error('[WebGL2DrawingLayer] RasterLayer initialization failed');
                        return false;
                    }
                }
                
                // Phase C-2: 自動FBO作成を有効化
                this.rasterLayer.autoCreateFBO = true;
                this.rasterLayer.enableOptimization = this.enableOptimization;
                
                console.log('✅ [WebGL2DrawingLayer] RasterLayer initialized with optimization');
            } else {
                console.error('[WebGL2DrawingLayer] window.RasterLayer not found');
                console.error('[WebGL2DrawingLayer] Available globals:', Object.keys(window).filter(k => k.includes('Raster')));
                return false;
            }
            
            // BrushStamp初期化
            if (window.BrushStamp) {
                window.BrushStamp.initialize(this.gl);
                console.log('✅ [WebGL2DrawingLayer] BrushStamp initialized');
            }
            
            // TextureBridge初期化
            if (window.GLTextureBridge) {
                this.textureBridge = window.GLTextureBridge;
                console.log('✅ [WebGL2DrawingLayer] TextureBridge ready');
            }
            
            // ディスプレイシェーダー初期化
            if (!this._initializeDisplayShader()) {
                console.error('[WebGL2DrawingLayer] Display shader initialization failed');
                return false;
            }
            
            // Phase C-3: WebGL設定最適化
            this._applyOptimizationSettings();
            
            this.initialized = true;
            console.log('✅ [WebGL2DrawingLayer] Initialized', { width, height });
            return true;
        }

        // ================================================================================
        // Phase C-3: WebGL最適化設定
        // ================================================================================

        _applyOptimizationSettings() {
            const gl = this.gl;
            
            // ブレンド設定
            gl.enable(gl.BLEND);
            gl.blendEquation(gl.FUNC_ADD);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            
            // デプステスト無効化（2D描画のため）
            gl.disable(gl.DEPTH_TEST);
            gl.disable(gl.CULL_FACE);
            
            // シザーテスト無効化
            gl.disable(gl.SCISSOR_TEST);
            
            // ステンシルテスト無効化
            gl.disable(gl.STENCIL_TEST);
            
            // ヒント設定
            gl.hint(gl.FRAGMENT_SHADER_DERIVATIVE_HINT, gl.NICEST);
            
            console.log('[WebGL2DrawingLayer] ✅ Optimization settings applied');
        }

        // ================================================================================
        // ディスプレイシェーダー初期化
        // ================================================================================

        _initializeDisplayShader() {
            const gl = this.gl;
            
            // シェーダー取得
            if (!window.TegakiShaders || !window.TegakiShaders.raster) {
                console.error('[WebGL2DrawingLayer] TegakiShaders not found');
                return false;
            }
            
            const shaders = window.TegakiShaders.raster.display;
            const utils = window.TegakiShaders.utils;
            
            // プログラム作成
            this.displayProgram = utils.createShaderProgram(
                gl,
                shaders.vertex,
                shaders.fragment
            );
            
            if (!this.displayProgram) {
                console.error('[WebGL2DrawingLayer] Failed to create display program');
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
            
            console.log('[WebGL2DrawingLayer] ✅ Display shader initialized');
            return true;
        }

        // ================================================================================
        // Pixi.js統合設定
        // ================================================================================

        setPixiApp(pixiApp) {
            this.pixiApp = pixiApp;
            console.log('✅ [WebGL2DrawingLayer] Pixi.js app linked');
        }

        // ================================================================================
        // レイヤー作成（Phase C-2: 自動作成対応）
        // ================================================================================

        createLayer(layerId) {
            if (!this.rasterLayer) {
                console.error('[WebGL2DrawingLayer] RasterLayer not initialized');
                return false;
            }
            
            return this.rasterLayer.createLayer(layerId);
        }

        // ================================================================================
        // レイヤー削除
        // ================================================================================

        deleteLayer(layerId) {
            if (!this.rasterLayer) return;
            
            this.rasterLayer.deleteLayer(layerId);
        }

        // ================================================================================
        // レイヤークリア
        // ================================================================================

        clearLayer(layerId) {
            if (!this.rasterLayer) return;
            
            this.rasterLayer.clearLayer(layerId);
        }

        // ================================================================================
        // レイヤーフレームバッファ取得（Phase C-2: 自動作成対応）
        // ================================================================================

        getLayerFramebuffer(layerId) {
            if (!this.rasterLayer) return null;
            
            return this.rasterLayer.getFramebuffer(layerId);
        }

        // ================================================================================
        // レイヤーテクスチャ取得（Phase C-2: 自動作成対応）
        // ================================================================================

        getLayerTexture(layerId) {
            if (!this.rasterLayer) return null;
            
            return this.rasterLayer.getTexture(layerId);
        }

        // ================================================================================
        // 全レイヤー合成（Phase C-3: 最適化版）
        // ================================================================================

        compositeLayers(layers) {
            if (!this.rasterLayer) return;
            
            const gl = this.gl;
            
            // 画面にクリア
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, this.width, this.height);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            
            // Phase C-3: パフォーマンス測定開始
            const startTime = performance.now();
            
            // レイヤー合成（画面に直接出力）
            this.rasterLayer.compositeLayers(layers, null);
            
            // Phase C-3: パフォーマンス測定終了
            if (this.debugMode) {
                const elapsed = performance.now() - startTime;
                this.frameCount++;
                if (this.frameCount % 60 === 0) {
                    this.fps = 1000 / elapsed;
                    console.log(`[WebGL2DrawingLayer] FPS: ${this.fps.toFixed(1)}, Composite: ${elapsed.toFixed(2)}ms`);
                }
            }
        }

        // ================================================================================
        // 単一レイヤー描画
        // ================================================================================

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
            
            // Phase C-3: 即座にコマンド実行
            if (this.enableOptimization) {
                gl.flush();
            }
            
            gl.bindVertexArray(null);
            gl.bindTexture(gl.TEXTURE_2D, null);
        }

        // ================================================================================
        // レイヤーサムネイル生成（Phase C-3: 最適化版）
        // ================================================================================

        generateLayerThumbnail(layerId, size = 48) {
            if (!this.rasterLayer) return null;
            
            return this.rasterLayer.generateThumbnail(layerId, size);
        }

        // ================================================================================
        // レイヤーピクセルデータ取得
        // ================================================================================

        readLayerPixels(layerId) {
            if (!this.rasterLayer) return null;
            
            return this.rasterLayer.readPixels(layerId);
        }

        // ================================================================================
        // キャンバスリサイズ
        // ================================================================================

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

        // ================================================================================
        // レンダリング（メインループ用）
        // ================================================================================

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

        // ================================================================================
        // Pixi.jsへテクスチャ転送
        // ================================================================================

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

        // ================================================================================
        // WebGLステート取得（デバッグ用）
        // ================================================================================

        getGLState() {
            const gl = this.gl;
            if (!gl) return null;
            
            return {
                version: gl.getParameter(gl.VERSION),
                vendor: gl.getParameter(gl.VENDOR),
                renderer: gl.getParameter(gl.RENDERER),
                shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
                maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
                maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
                maxFramebufferWidth: gl.getParameter(gl.MAX_FRAMEBUFFER_WIDTH),
                maxFramebufferHeight: gl.getParameter(gl.MAX_FRAMEBUFFER_HEIGHT),
                maxColorAttachments: gl.getParameter(gl.MAX_COLOR_ATTACHMENTS),
                maxDrawBuffers: gl.getParameter(gl.MAX_DRAW_BUFFERS),
                maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
                maxVaryingVectors: gl.getParameter(gl.MAX_VARYING_VECTORS)
            };
        }

        // ================================================================================
        // デバッグモード切替
        // ================================================================================

        setDebugMode(enabled) {
            this.debugMode = enabled;
            
            if (enabled) {
                console.log('🐛 [WebGL2DrawingLayer] Debug mode enabled');
                console.log('GL State:', this.getGLState());
                
                if (this.rasterLayer) {
                    this.rasterLayer.diagnosePerformance();
                }
            } else {
                console.log('[WebGL2DrawingLayer] Debug mode disabled');
            }
        }

        // ================================================================================
        // レイヤー情報ダンプ（デバッグ用）
        // ================================================================================

        dumpLayerInfo() {
            if (!this.rasterLayer) {
                console.log('No RasterLayer');
                return;
            }
            
            console.group('📊 Layer Information');
            console.log('Canvas size:', this.width, 'x', this.height);
            console.log('Framebuffers:', this.rasterLayer.layerFramebuffers.size);
            console.log('Textures:', this.rasterLayer.layerTextures.size);
            console.log('Optimization enabled:', this.enableOptimization);
            console.log('Debug mode:', this.debugMode);
            console.log('FPS:', this.fps.toFixed(1));
            
            for (const [layerId, fbo] of this.rasterLayer.layerFramebuffers.entries()) {
                console.log(`  - Layer: ${layerId}`);
            }
            
            console.groupEnd();
        }

        // ================================================================================
        // エクスポート用レンダリング（Phase C-3: 最適化版）
        // ================================================================================

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
                gl.TEXTURE_2D, 0, gl.RGBA8,
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

        // ================================================================================
        // クリーンアップ
        // ================================================================================

        destroy() {
            const gl = this.gl;
            if (!gl) return;
            
            console.log('🗑️ [WebGL2DrawingLayer] Destroying...');
            
            // RasterLayer破棄
            if (this.rasterLayer) {
                this.rasterLayer.destroy();
            }
            
            // シェーダー削除
            if (this.displayProgram) {
                gl.deleteProgram(this.displayProgram);
                this.displayProgram = null;
            }
            if (this.displayVAO) {
                gl.deleteVertexArray(this.displayVAO);
                this.displayVAO = null;
            }
            if (this.displayVBO) {
                gl.deleteBuffer(this.displayVBO);
                this.displayVBO = null;
            }
            
            this.initialized = false;
            console.log('✅ [WebGL2DrawingLayer] Destroyed');
        }
    }

    // ================================================================================
    // グローバル公開
    // ================================================================================
    window.WebGL2DrawingLayer = WebGL2DrawingLayer;

    console.log('✅ webgl2-drawing-layer.js Phase C完全版 loaded');
    console.log('   🔥 C-1: WebGL2描画パイプライン完全統合');
    console.log('   ✅ C-2: RasterLayer統合強化（自動FBO作成）');
    console.log('   ✅ C-3: パフォーマンス最適化');
    console.log('   ✅ C-3: 高性能モード・アンチエイリアス有効化');
    console.log('   ✅ C-3: FPS測定・診断機能');

})();