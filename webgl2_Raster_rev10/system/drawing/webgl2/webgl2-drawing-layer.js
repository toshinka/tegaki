/**
 * ============================================================
 * webgl2-drawing-layer.js - Phase Emergency 修正版
 * ============================================================
 * 【役割】
 * - WebGL2レイヤー統合管理
 * - ラスターテクスチャ合成
 * - Pixi.jsとの連携
 * 
 * 【Phase Emergency 修正内容】
 * 🚨 E-2: PixiJS Ticker完全制御インターフェース追加
 * 🚨 E-2: disablePixiAutoRender() / enablePixiAutoRender() 実装
 * 🚨 E-2: renderCallbackの明示的保持・管理
 * 
 * 【Phase C-0.1 修正内容】
 * 🔧 RasterLayer初期化フロー修正
 * 🔧 外部GLコンテキスト注入方式対応
 * ✅ Phase C完全実装継承
 * 
 * 【親依存】
 * - gl-texture-bridge.js
 * - raster-layer.js
 * - shader-inline.js
 * 
 * 【子依存】
 * - core-initializer.js
 * - raster-brush-core.js
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
            // 🚨 Phase Emergency: PixiJS Ticker制御
            // ================================================================================
            this.savedRenderCallback = null;   // 保存されたrenderコールバック
            this.tickerDisabled = false;       // ticker無効化フラグ
            
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
        // 初期化（Phase Emergency 修正版）
        // ================================================================================

        async initialize(canvas, width, height) {
            if (this.initialized) {
                console.warn('[WebGL2DrawingLayer] Already initialized');
                return true;
            }

            this.canvas = canvas;
            this.width = width;
            this.height = height;
            
            console.log('[WebGL2DrawingLayer] Step 1: Creating WebGL2 context...');

            this.gl = canvas.getContext('webgl2', {
                alpha: true,
                premultipliedAlpha: true,
                preserveDrawingBuffer: true,
                antialias: true,
                powerPreference: 'high-performance',
                desynchronized: true
            });
            
            if (!this.gl) {
                console.error('[WebGL2DrawingLayer] WebGL2 not supported');
                return false;
            }
            
            console.log('[WebGL2DrawingLayer] ✅ Step 1 completed: WebGL2 context created');
            
            // グローバル登録
            if (!window.WebGLContext) {
                window.WebGLContext = {};
            }
            window.WebGLContext.gl = this.gl;
            console.log('[WebGL2DrawingLayer] ✅ Step 2 completed: GLContext registered globally');
            
            // RasterLayer準備
            console.log('[WebGL2DrawingLayer] Step 3: Preparing RasterLayer...');

            if (!window.RasterLayer) {
                console.error('[WebGL2DrawingLayer] ❌ window.RasterLayer not found');
                return false;
            }

            this.rasterLayer = window.RasterLayer;
            console.log('[WebGL2DrawingLayer] ✅ Step 3 completed: RasterLayer reference obtained');
            
            // BrushStamp初期化
            console.log('[WebGL2DrawingLayer] Step 4: Initializing BrushStamp...');

            if (window.BrushStamp) {
                window.BrushStamp.initialize(this.gl);
                console.log('[WebGL2DrawingLayer] ✅ Step 4 completed: BrushStamp initialized');
            } else {
                console.warn('[WebGL2DrawingLayer] ⚠️  BrushStamp not found');
            }
            
            // TextureBridge初期化
            if (window.GLTextureBridge) {
                this.textureBridge = window.GLTextureBridge;
                console.log('[WebGL2DrawingLayer] ✅ Step 5 completed: TextureBridge ready');
            } else {
                console.warn('[WebGL2DrawingLayer] ⚠️  GLTextureBridge not found');
            }
            
            // ディスプレイシェーダー初期化
            console.log('[WebGL2DrawingLayer] Step 6: Initializing display shader...');

            if (!this._initializeDisplayShader()) {
                console.error('[WebGL2DrawingLayer] ❌ Display shader initialization failed');
                return false;
            }

            console.log('[WebGL2DrawingLayer] ✅ Step 6 completed: Display shader initialized');
            
            // WebGL設定最適化
            console.log('[WebGL2DrawingLayer] Step 7: Applying optimization settings...');
            this._applyOptimizationSettings();
            console.log('[WebGL2DrawingLayer] ✅ Step 7 completed: Optimization applied');
            
            // 初期化完了
            this.initialized = true;
            console.log('[WebGL2DrawingLayer] 🎉 Initialization completed successfully');

            return true;
        }

        // ================================================================================
        // Phase C-3: WebGL最適化設定
        // ================================================================================

        _applyOptimizationSettings() {
            const gl = this.gl;
            
            gl.enable(gl.BLEND);
            gl.blendEquation(gl.FUNC_ADD);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            
            gl.disable(gl.DEPTH_TEST);
            gl.disable(gl.CULL_FACE);
            gl.disable(gl.SCISSOR_TEST);
            gl.disable(gl.STENCIL_TEST);
            
            gl.hint(gl.FRAGMENT_SHADER_DERIVATIVE_HINT, gl.NICEST);
        }

        // ================================================================================
        // ディスプレイシェーダー初期化
        // ================================================================================

        _initializeDisplayShader() {
            const gl = this.gl;
            
            if (!window.TegakiShaders || !window.TegakiShaders.raster) {
                console.error('[WebGL2DrawingLayer] TegakiShaders not found');
                return false;
            }
            
            const shaders = window.TegakiShaders.raster.display;
            const utils = window.TegakiShaders.utils;
            
            this.displayProgram = utils.createShaderProgram(
                gl,
                shaders.vertex,
                shaders.fragment
            );
            
            if (!this.displayProgram) {
                console.error('[WebGL2DrawingLayer] Failed to create display program');
                return false;
            }
            
            this.displayProgram.uniforms = {
                u_texture: gl.getUniformLocation(this.displayProgram, 'u_texture')
            };
            
            const vertices = new Float32Array([
                -1, -1,  0, 0,
                 1, -1,  1, 0,
                -1,  1,  0, 1,
                 1,  1,  1, 1
            ]);
            
            this.displayVBO = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.displayVBO);
            gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
            
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

        // ================================================================================
        // 🚨 Phase Emergency: PixiJS Ticker完全制御インターフェース
        // ================================================================================

        /**
         * PixiJS自動レンダリングを無効化
         * @public
         */
        disablePixiAutoRender() {
            if (!this.pixiApp || !this.pixiApp.ticker) {
                console.warn('[WebGL2DrawingLayer] PixiApp not set');
                return;
            }

            if (this.tickerDisabled) {
                return; // 既に無効化済み
            }

            const ticker = this.pixiApp.ticker;

            try {
                // renderコールバックを探して保存
                let current = ticker._head;
                while (current) {
                    if (current.fn && (current.fn.name === 'render' || current.context === this.pixiApp.renderer)) {
                        this.savedRenderCallback = {
                            fn: current.fn,
                            context: current.context,
                            priority: current.priority
                        };
                        
                        // コールバックを削除
                        ticker.remove(current.fn, current.context);
                        console.log('[WebGL2DrawingLayer] 🚨 Pixi render callback removed');
                        break;
                    }
                    current = current.next;
                }

                // ticker停止（フォールバック）
                ticker.stop();
                
                this.tickerDisabled = true;
                console.log('[WebGL2DrawingLayer] 🚨 Pixi auto-render disabled');
            } catch (error) {
                console.error('[WebGL2DrawingLayer] Failed to disable auto-render:', error);
            }
        }

        /**
         * PixiJS自動レンダリングを再有効化
         * @public
         */
        enablePixiAutoRender() {
            if (!this.pixiApp || !this.pixiApp.ticker) {
                console.warn('[WebGL2DrawingLayer] PixiApp not set');
                return;
            }

            if (!this.tickerDisabled) {
                return; // 無効化されてない
            }

            const ticker = this.pixiApp.ticker;

            try {
                // GLステートクリーンアップ
                this._cleanupGLStateForPixi();

                // 保存したコールバックを再追加
                if (this.savedRenderCallback) {
                    ticker.add(
                        this.savedRenderCallback.fn,
                        this.savedRenderCallback.context,
                        this.savedRenderCallback.priority
                    );
                    console.log('[WebGL2DrawingLayer] 🚨 Pixi render callback restored');
                }

                // ticker再開
                ticker.start();
                
                this.tickerDisabled = false;
                console.log('[WebGL2DrawingLayer] 🚨 Pixi auto-render enabled');
            } catch (error) {
                console.error('[WebGL2DrawingLayer] Failed to enable auto-render:', error);
            }
        }

        /**
         * GLステートをPixiJS用にクリーンアップ
         * @private
         */
        _cleanupGLStateForPixi() {
            const gl = this.gl;
            if (!gl) return;

            try {
                // 全てのGL状態をクリア
                gl.useProgram(null);
                gl.bindBuffer(gl.ARRAY_BUFFER, null);
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
                gl.bindVertexArray(null);
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.bindRenderbuffer(gl.RENDERBUFFER, null);
                
                // テクスチャクリア
                for (let i = 0; i < 8; i++) {
                    gl.activeTexture(gl.TEXTURE0 + i);
                    gl.bindTexture(gl.TEXTURE_2D, null);
                    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
                }
                gl.activeTexture(gl.TEXTURE0);

                console.log('[WebGL2DrawingLayer] 🧹 GL state cleaned for Pixi');
            } catch (error) {
                console.warn('[WebGL2DrawingLayer] GL cleanup warning:', error);
            }
        }

        // ================================================================================
        // Pixi.js統合設定
        // ================================================================================

        setPixiApp(pixiApp) {
            this.pixiApp = pixiApp;
            console.log('[WebGL2DrawingLayer] ✅ Pixi.js app linked');
            
            // 🚨 Phase Emergency: 初期状態でticker制御を準備
            if (pixiApp && pixiApp.ticker) {
                // renderコールバックを事前に捕捉
                let current = pixiApp.ticker._head;
                while (current) {
                    if (current.fn && (current.fn.name === 'render' || current.context === pixiApp.renderer)) {
                        this.savedRenderCallback = {
                            fn: current.fn,
                            context: current.context,
                            priority: current.priority
                        };
                        console.log('[WebGL2DrawingLayer] 🚨 Pixi render callback pre-captured');
                        break;
                    }
                    current = current.next;
                }
            }
        }

        // ================================================================================
        // レイヤー作成
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
        // レイヤーフレームバッファ取得
        // ================================================================================

        getLayerFramebuffer(layerId) {
            if (!this.rasterLayer) return null;
            
            return this.rasterLayer.getFramebuffer(layerId);
        }

        // ================================================================================
        // レイヤーテクスチャ取得
        // ================================================================================

        getLayerTexture(layerId) {
            if (!this.rasterLayer) return null;
            
            return this.rasterLayer.getTexture(layerId);
        }

        // ================================================================================
        // 全レイヤー合成
        // ================================================================================

        compositeLayers(layers) {
            if (!this.rasterLayer) return;
            
            const gl = this.gl;
            
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, this.width, this.height);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            
            const startTime = performance.now();
            
            this.rasterLayer.compositeLayers(layers, null);
            
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
            
            if (this.enableOptimization) {
                gl.flush();
            }
            
            gl.bindVertexArray(null);
            gl.bindTexture(gl.TEXTURE_2D, null);
        }

        // ================================================================================
        // レイヤーサムネイル生成
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
            
            if (this.canvas) {
                this.canvas.width = newWidth;
                this.canvas.height = newHeight;
            }
            
            if (this.rasterLayer) {
                this.rasterLayer.resizeAll(newWidth, newHeight);
            }
            
            const gl = this.gl;
            gl.viewport(0, 0, newWidth, newHeight);
        }

        // ================================================================================
        // レンダリング
        // ================================================================================

        render() {
            if (!this.initialized) return;
            
            const gl = this.gl;
            
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, this.width, this.height);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            
            const layerManager = window.layerManager;
            if (!layerManager) return;
            
            const layers = layerManager.getLayers();
            if (!layers || layers.length === 0) return;
            
            const layerInfos = layers.map(layer => ({
                id: layer.layerData?.id,
                visible: layer.visible !== false,
                opacity: layer.alpha !== undefined ? layer.alpha : 1.0,
                blendMode: layer.blendMode || 'normal'
            })).filter(info => info.id);
            
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
                const baseTexture = PIXI.BaseTexture.from(glTexture);
                const pixiTexture = new PIXI.Texture(baseTexture);
                return pixiTexture;
            } catch (error) {
                console.error('[WebGL2DrawingLayer] Pixi texture conversion failed:', error);
                return null;
            }
        }

        // ================================================================================
        // WebGLステート取得
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
        // レイヤー情報ダンプ
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
            console.log('🚨 Ticker disabled:', this.tickerDisabled);
            console.log('🚨 Saved callback:', this.savedRenderCallback ? 'Yes' : 'No');
            
            for (const [layerId, fbo] of this.rasterLayer.layerFramebuffers.entries()) {
                console.log(`  - Layer: ${layerId}`);
            }
            
            console.groupEnd();
        }

        // ================================================================================
        // エクスポート用レンダリング
        // ================================================================================

        renderToCanvas(layers, width = null, height = null) {
            const targetWidth = width || this.width;
            const targetHeight = height || this.height;
            
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = targetWidth;
            exportCanvas.height = targetHeight;
            
            const gl = this.gl;
            
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
            
            this.rasterLayer.compositeLayers(layers, tempFBO);
            
            gl.bindFramebuffer(gl.FRAMEBUFFER, tempFBO);
            const pixels = new Uint8Array(targetWidth * targetHeight * 4);
            gl.readPixels(0, 0, targetWidth, targetHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            
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
            
            if (this.rasterLayer) {
                this.rasterLayer.destroy();
            }
            
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

    console.log('✅ webgl2-drawing-layer.js Phase Emergency loaded');
    console.log('   🚨 E-2: disablePixiAutoRender() / enablePixiAutoRender() 実装');
    console.log('   🚨 E-2: PixiJS renderコールバック明示的管理');
    console.log('   🚨 E-2: ticker完全制御インターフェース追加');
    console.log('   ✅ Phase C-0.1全機能継承');

})();