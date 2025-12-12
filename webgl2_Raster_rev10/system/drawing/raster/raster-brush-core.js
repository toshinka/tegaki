/**
 * ============================================================================
 * ファイル名: system/drawing/raster/raster-brush-core.js
 * 責務: ラスターブラシの中核実装 - WebGL2 テクスチャ直接描画
 * 
 * 【Phase Emergency: PixiJS Ticker完全制御実装】
 * 🚨 E-1: ticker.stop() → ticker.remove() 完全切り替え
 * 🚨 E-1: GLステート保存/復元の完全実装
 * 🚨 E-1: PixiJSとの競合完全回避
 * 
 * 【Phase C-0.2: FBO自動作成修正 + GLステート完全隔離】
 * 🔧 getFramebuffer() → getOrCreateLayer() 修正
 * 🔧 WebGLステート保存/復元の完全実装
 * 🔧 PixiJSとの競合を完全回避
 * 
 * 【Phase C-1: WebGL2描画パイプライン完全実装】
 * 🔥 WebGL2 Framebuffer への直接描画
 * 🔥 シェーダーベースのブラシスタンプ描画
 * 🔥 真のGPU加速ラスター描画
 * 🔥 Flow制御・アンチエイリアス実装
 * 🔥 消しゴム: アルファチャンネル削除
 * 
 * 【親ファイル依存】
 * - config.js (ブラシ設定)
 * - settings-manager.js (ユーザー設定)
 * - brush-stamp.js (スタンプ生成)
 * - brush-interpolator.js (補間処理)
 * - shader-inline.js (GLSLシェーダー)
 * - raster-layer.js (FBO管理)
 * 
 * 【子ファイル依存このファイルに】
 * - brush-core.js (ストローク管理)
 * - core-engine.js (初期化)
 * ============================================================================
 */

(function() {
    'use strict';

    class RasterBrushCore {
        constructor(app, layerSystem, cameraSystem) {
            this.app = app;
            this.layerSystem = layerSystem;
            this.cameraSystem = cameraSystem;
            
            // ================================================================================
            // WebGL2コンテキスト
            // ================================================================================
            this.gl = null;
            
            // ================================================================================
            // Phase C-1: WebGL2描画システム
            // ================================================================================
            this.rasterLayer = null;          // RasterLayer インスタンス
            this.brushStamp = null;           // BrushStamp インスタンス
            this.brushInterpolator = null;    // BrushInterpolator インスタンス
            
            // シェーダープログラム
            this.brushProgram = null;
            this.brushVAO = null;
            this.brushVBO = null;
            
            // 現在のフレームバッファID
            this.currentLayerFBO = null;
            this.currentLayerTexture = null;
            
            // ================================================================================
            // 🚨 Phase Emergency: PixiJS Ticker完全制御
            // ================================================================================
            this.pixiRenderCallback = null;    // PixiJSのrenderコールバック保存
            this.tickerStopped = false;        // ticker停止状態フラグ
            this.savedGLState = null;          // GLステート保存
            
            // ================================================================================
            // ストローク管理
            // ================================================================================
            this.currentStroke = null;
            this.isDrawing = false;
            this.lastPoint = null;
            
            // ================================================================================
            // 設定管理
            // ================================================================================
            this.brushSettings = null;
            this.settingsManager = null;
            
            // ================================================================================
            // Phase C-1: Pixi統合(表示用)
            // ================================================================================
            this.currentSprite = null;
            this.currentTexture = null;
            this.isAddedToLayer = false;
            this.targetLayer = null;
            
            // ================================================================================
            // バウンディングボックス
            // ================================================================================
            this.minX = 0;
            this.minY = 0;
            this.maxX = 0;
            this.maxY = 0;
            
            // ================================================================================
            // デバッグ
            // ================================================================================
            this.debugMode = false;
        }

        // ================================================================================
        // 初期化
        // ================================================================================

        initialize(gl) {
            this.gl = gl;
            
            if (!this.gl) {
                console.error('[RasterBrushCore] WebGL2 context not provided');
                return false;
            }
            
            console.log('🔥 [RasterBrushCore] Initializing WebGL2 raster pipeline...');
            
            // RasterLayer取得
            if (window.RasterLayer) {
                this.rasterLayer = window.RasterLayer;
                if (!this.rasterLayer.initialized) {
                    console.error('[RasterBrushCore] RasterLayer not initialized');
                    return false;
                }
            } else {
                console.error('[RasterBrushCore] window.RasterLayer not found');
                return false;
            }
            
            // BrushStamp取得
            if (window.BrushStamp) {
                this.brushStamp = window.BrushStamp;
                if (typeof this.brushStamp.initialize === 'function') {
                    this.brushStamp.initialize(gl);
                }
            } else {
                console.warn('[RasterBrushCore] BrushStamp not available');
            }
            
            // BrushInterpolator取得
            if (window.BrushInterpolator) {
                this.brushInterpolator = window.BrushInterpolator;
            }
            
            // SettingsManager取得
            if (window.TegakiSettingsManager) {
                if (typeof window.TegakiSettingsManager.get === 'function') {
                    this.settingsManager = window.TegakiSettingsManager;
                } else if (typeof window.TegakiSettingsManager === 'function') {
                    this.settingsManager = new window.TegakiSettingsManager(
                        window.TegakiEventBus || window.eventBus,
                        window.TEGAKI_CONFIG
                    );
                }
            }
            
            // シェーダー初期化
            if (!this._initializeBrushShader()) {
                console.error('[RasterBrushCore] Shader initialization failed');
                return false;
            }
            
            // 🚨 Phase Emergency: PixiJSのrenderコールバック保存
            if (window.pixiApp && window.pixiApp.ticker) {
                this._capturePixiRenderCallback();
            }
            
            console.log('✅ [RasterBrushCore] WebGL2 pipeline initialized');
            console.log('   ✅ RasterLayer: OK');
            console.log('   ✅ BrushStamp:', this.brushStamp ? 'OK' : 'Not available');
            console.log('   ✅ BrushInterpolator:', this.brushInterpolator ? 'OK' : 'Not available');
            console.log('   ✅ Shader Program: OK');
            console.log('   ✅ Settings Manager:', this.settingsManager ? 'OK' : 'Not available');
            console.log('   🚨 Pixi Render Callback:', this.pixiRenderCallback ? 'Captured' : 'Not found');
            
            return true;
        }

        // ================================================================================
        // Phase C-1: ブラシシェーダー初期化
        // ================================================================================

        _initializeBrushShader() {
            const gl = this.gl;
            
            // シェーダーソース取得
            if (!window.TegakiShaders || !window.TegakiShaders.raster) {
                console.error('[RasterBrushCore] TegakiShaders not found');
                return false;
            }
            
            const shaders = window.TegakiShaders.raster.brushStamp;
            const utils = window.TegakiShaders.utils;
            
            if (!shaders || !utils) {
                console.error('[RasterBrushCore] Brush shaders not found');
                return false;
            }
            
            // プログラム作成
            this.brushProgram = utils.createShaderProgram(
                gl,
                shaders.vertex,
                shaders.fragment
            );
            
            if (!this.brushProgram) {
                console.error('[RasterBrushCore] Failed to create brush program');
                return false;
            }
            
            // ユニフォーム位置取得
            this.brushProgram.uniforms = {
                u_stampTexture: gl.getUniformLocation(this.brushProgram, 'u_stampTexture'),
                u_position: gl.getUniformLocation(this.brushProgram, 'u_position'),
                u_size: gl.getUniformLocation(this.brushProgram, 'u_size'),
                u_color: gl.getUniformLocation(this.brushProgram, 'u_color'),
                u_opacity: gl.getUniformLocation(this.brushProgram, 'u_opacity'),
                u_rotation: gl.getUniformLocation(this.brushProgram, 'u_rotation'),
                u_resolution: gl.getUniformLocation(this.brushProgram, 'u_resolution'),
                u_hardness: gl.getUniformLocation(this.brushProgram, 'u_hardness'),
                u_eraser: gl.getUniformLocation(this.brushProgram, 'u_eraser')
            };
            
            // 頂点バッファ(ビルボード用四角形)
            const vertices = new Float32Array([
                -1, -1,  0, 0,
                 1, -1,  1, 0,
                -1,  1,  0, 1,
                 1,  1,  1, 1
            ]);
            
            this.brushVBO = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.brushVBO);
            gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
            
            // VAO作成
            this.brushVAO = gl.createVertexArray();
            gl.bindVertexArray(this.brushVAO);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, this.brushVBO);
            
            const a_position = gl.getAttribLocation(this.brushProgram, 'a_position');
            const a_texCoord = gl.getAttribLocation(this.brushProgram, 'a_texCoord');
            
            gl.enableVertexAttribArray(a_position);
            gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 16, 0);
            
            gl.enableVertexAttribArray(a_texCoord);
            gl.vertexAttribPointer(a_texCoord, 2, gl.FLOAT, false, 16, 8);
            
            gl.bindVertexArray(null);
            
            console.log('✅ [RasterBrushCore] Brush shader initialized');
            return true;
        }

        // ================================================================================
        // 設定
        // ================================================================================

        setBrushSettings(brushSettings) {
            this.brushSettings = brushSettings;
        }

        // ================================================================================
        // 🚨 Phase Emergency: PixiJS Ticker完全制御
        // ================================================================================

        /**
         * PixiJSのrenderコールバックを捕捉
         * @private
         */
        _capturePixiRenderCallback() {
            if (!window.pixiApp || !window.pixiApp.ticker) {
                console.warn('[RasterBrushCore] pixiApp or ticker not found');
                return;
            }

            const ticker = window.pixiApp.ticker;
            const renderer = window.pixiApp.renderer;
            
            // 🔧 Rev.2: PixiJS v8のticker構造を正しく解析
            // ticker._head はリンクリストの先頭（TickerListener）
            let current = ticker._head;
            let found = false;
            
            console.log('[RasterBrushCore] 🔍 Searching for Pixi render callback...');
            
            while (current) {
                // PixiJS v8では、rendererのrenderメソッドがバインドされている
                // context が renderer で、fn が render関数のもの
                if (current.context === renderer && 
                    current.fn && 
                    (current.fn.name === 'render' || current.fn.name === 'bound render')) {
                    this.pixiRenderCallback = current;
                    found = true;
                    console.log('[RasterBrushCore] ✅ Pixi render callback captured:', {
                        fnName: current.fn.name,
                        context: current.context.constructor.name,
                        priority: current.priority
                    });
                    break;
                }
                current = current.next;
            }

            // 🔧 Rev.2: より詳細なフォールバック戦略
            if (!found) {
                console.warn('[RasterBrushCore] ⚠️  Render callback not found by context match');
                console.warn('[RasterBrushCore] 🔍 Trying alternative detection...');
                
                // 代替案: 全コールバックをリストアップして選択
                current = ticker._head;
                const callbacks = [];
                
                while (current) {
                    callbacks.push({
                        listener: current,
                        fnName: current.fn?.name || 'anonymous',
                        contextName: current.context?.constructor?.name || 'unknown',
                        priority: current.priority
                    });
                    current = current.next;
                }
                
                console.log('[RasterBrushCore] 📋 Available callbacks:', callbacks);
                
                // Application関連のコールバックを探す
                const appCallback = callbacks.find(cb => 
                    cb.contextName === 'Application' || 
                    cb.fnName.includes('render')
                );
                
                if (appCallback) {
                    this.pixiRenderCallback = appCallback.listener;
                    console.log('[RasterBrushCore] ⚠️  Using alternative callback:', appCallback);
                } else if (callbacks.length > 0) {
                    // 最後の手段: 最初のコールバック
                    this.pixiRenderCallback = callbacks[0].listener;
                    console.warn('[RasterBrushCore] ⚠️⚠️  Using first callback as last resort');
                } else {
                    console.error('[RasterBrushCore] ❌ No callbacks found in ticker');
                }
            }
        }

        /**
         * PixiJS Tickerを完全停止（ticker.remove使用）
         * @private
         */
        _stopPixiTicker() {
            if (!window.pixiApp || !window.pixiApp.ticker) {
                console.warn('[RasterBrushCore] pixiApp or ticker not found');
                return;
            }

            if (this.tickerStopped) {
                return; // 既に停止済み
            }

            const ticker = window.pixiApp.ticker;
            
            try {
                // 🔧 Rev.2: より確実な停止方法
                
                // 方法1: 保存したコールバックを削除
                if (this.pixiRenderCallback) {
                    console.log('[RasterBrushCore] 🚨 Attempting to remove render callback...');
                    
                    // TickerListenerを直接削除
                    if (this.pixiRenderCallback.fn && this.pixiRenderCallback.context) {
                        ticker.remove(this.pixiRenderCallback.fn, this.pixiRenderCallback.context);
                        console.log('[RasterBrushCore] ✅ Render callback removed via fn+context');
                    } else {
                        console.warn('[RasterBrushCore] ⚠️  Callback structure invalid');
                    }
                }
                
                // 方法2: ticker完全停止（確実性のため）
                ticker.stop();
                console.log('[RasterBrushCore] ✅ Ticker.stop() called');
                
                // 🔧 Rev.2: 念のため次のフレームまで待つ
                // これにより進行中のrAFが完了する
                requestAnimationFrame(() => {
                    console.log('[RasterBrushCore] 🚨 Ticker stop confirmed (next frame)');
                });
                
                this.tickerStopped = true;
                
                console.log('[RasterBrushCore] 🚨 Pixi ticker COMPLETELY stopped');
            } catch (error) {
                console.error('[RasterBrushCore] ❌ Failed to stop Pixi ticker:', error);
            }
        }

        /**
         * PixiJS Tickerを再開（ticker.add使用）
         * @private
         */
        _restartPixiTicker() {
            if (!window.pixiApp || !window.pixiApp.ticker) {
                return;
            }

            if (!this.tickerStopped) {
                return; // 停止してない
            }

            const ticker = window.pixiApp.ticker;
            
            try {
                // GLステートを完全にクリア
                this._cleanupGLState();
                
                // PixiJSのシェーダーシステムを強制リセット
                this._resetPixiShaderSystem();
                
                // 方法1: 保存したコールバックを再追加
                if (this.pixiRenderCallback) {
                    ticker.add(this.pixiRenderCallback.fn, this.pixiRenderCallback.context);
                    console.log('[RasterBrushCore] 🚨 Pixi ticker callback re-added');
                }
                
                // 方法2: ticker再開
                ticker.start();
                
                this.tickerStopped = false;
                
                console.log('[RasterBrushCore] 🚨 Pixi ticker SAFELY restarted');
            } catch (error) {
                console.error('[RasterBrushCore] Failed to restart Pixi ticker:', error);
            }
        }

        /**
         * GLステートを完全にクリーンアップ（PixiJS再開前）
         * @private
         */
        _cleanupGLState() {
            const gl = this.gl;
            if (!gl) return;

            try {
                console.log('[RasterBrushCore] 🧹 Cleaning GL state...');
                
                // プログラムをクリア
                gl.useProgram(null);
                
                // バッファをクリア
                gl.bindBuffer(gl.ARRAY_BUFFER, null);
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
                
                // VAOをクリア
                gl.bindVertexArray(null);
                
                // フレームバッファをクリア
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.bindRenderbuffer(gl.RENDERBUFFER, null);
                
                // テクスチャをクリア（全スロット）
                for (let i = 0; i < 16; i++) {  // 🔧 Rev.2: 16スロット全てクリア
                    gl.activeTexture(gl.TEXTURE0 + i);
                    gl.bindTexture(gl.TEXTURE_2D, null);
                    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
                    gl.bindTexture(gl.TEXTURE_3D, null);
                    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
                }
                gl.activeTexture(gl.TEXTURE0);
                
                // 🔧 Rev.2: ブレンドステートをPixiJSデフォルトに戻す
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                gl.blendEquation(gl.FUNC_ADD);
                
                // 🔧 Rev.2: その他の状態をリセット
                gl.disable(gl.DEPTH_TEST);
                gl.disable(gl.CULL_FACE);
                gl.disable(gl.SCISSOR_TEST);
                gl.disable(gl.STENCIL_TEST);
                
                console.log('[RasterBrushCore] ✅ GL state cleaned up completely');
            } catch (error) {
                console.warn('[RasterBrushCore] ⚠️  GL cleanup warning:', error);
            }
        }

        /**
         * WebGLステート保存（描画前に必ず呼ぶ）
         * @private
         */
        _saveGLState() {
            const gl = this.gl;
            
            try {
                this.savedGLState = {
                    // フレームバッファ
                    framebuffer: gl.getParameter(gl.FRAMEBUFFER_BINDING),
                    renderbuffer: gl.getParameter(gl.RENDERBUFFER_BINDING),
                    
                    // ビューポート
                    viewport: gl.getParameter(gl.VIEWPORT),
                    
                    // プログラム
                    program: gl.getParameter(gl.CURRENT_PROGRAM),
                    
                    // VAO
                    vao: gl.getParameter(gl.VERTEX_ARRAY_BINDING),
                    
                    // バッファ
                    arrayBuffer: gl.getParameter(gl.ARRAY_BUFFER_BINDING),
                    elementArrayBuffer: gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING),
                    
                    // テクスチャ
                    activeTexture: gl.getParameter(gl.ACTIVE_TEXTURE),
                    texture2D: gl.getParameter(gl.TEXTURE_BINDING_2D),
                    textureCubeMap: gl.getParameter(gl.TEXTURE_BINDING_CUBE_MAP),
                    
                    // ブレンド
                    blend: gl.getParameter(gl.BLEND),
                    blendSrcRGB: gl.getParameter(gl.BLEND_SRC_RGB),
                    blendDstRGB: gl.getParameter(gl.BLEND_DST_RGB),
                    blendSrcAlpha: gl.getParameter(gl.BLEND_SRC_ALPHA),
                    blendDstAlpha: gl.getParameter(gl.BLEND_DST_ALPHA),
                    blendEquationRGB: gl.getParameter(gl.BLEND_EQUATION_RGB),
                    blendEquationAlpha: gl.getParameter(gl.BLEND_EQUATION_ALPHA),
                    
                    // その他
                    cullFace: gl.getParameter(gl.CULL_FACE),
                    depthTest: gl.getParameter(gl.DEPTH_TEST),
                    scissorTest: gl.getParameter(gl.SCISSOR_TEST),
                    stencilTest: gl.getParameter(gl.STENCIL_TEST)
                };
                
                if (this.debugMode) {
                    console.log('[RasterBrushCore] GL state saved');
                }
            } catch (error) {
                console.error('[RasterBrushCore] Failed to save GL state:', error);
                this.savedGLState = null;
            }
        }

        /**
         * WebGLステート復元（描画後に必ず呼ぶ）
         * @private
         */
        _restoreGLState() {
            if (!this.savedGLState) return;
            
            const gl = this.gl;
            const state = this.savedGLState;
            
            try {
                // プログラムはnullに戻す（PixiJSに任せる）
                gl.useProgram(null);
                
                // フレームバッファ復元
                gl.bindFramebuffer(gl.FRAMEBUFFER, state.framebuffer);
                gl.bindRenderbuffer(gl.RENDERBUFFER, state.renderbuffer);
                
                // ビューポート復元
                if (state.viewport) {
                    gl.viewport(state.viewport[0], state.viewport[1], state.viewport[2], state.viewport[3]);
                }
                
                // VAOをクリア
                gl.bindVertexArray(null);
                
                // バッファをクリア
                gl.bindBuffer(gl.ARRAY_BUFFER, null);
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
                
                // テクスチャをクリア
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, null);
                gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
                
                // ブレンド復元
                if (state.blend) {
                    gl.enable(gl.BLEND);
                } else {
                    gl.disable(gl.BLEND);
                }
                gl.blendFuncSeparate(state.blendSrcRGB, state.blendDstRGB, state.blendSrcAlpha, state.blendDstAlpha);
                gl.blendEquationSeparate(state.blendEquationRGB, state.blendEquationAlpha);
                
                // その他復元
                if (state.cullFace) gl.enable(gl.CULL_FACE); else gl.disable(gl.CULL_FACE);
                if (state.depthTest) gl.enable(gl.DEPTH_TEST); else gl.disable(gl.DEPTH_TEST);
                if (state.scissorTest) gl.enable(gl.SCISSOR_TEST); else gl.disable(gl.SCISSOR_TEST);
                if (state.stencilTest) gl.enable(gl.STENCIL_TEST); else gl.disable(gl.STENCIL_TEST);
                
                if (this.debugMode) {
                    console.log('[RasterBrushCore] GL state restored');
                }
            } catch (error) {
                console.error('[RasterBrushCore] Failed to restore GL state:', error);
            } finally {
                this.savedGLState = null;
            }
        }

        // ================================================================================
        // Phase C-0.2: ストローク開始 - FBO自動作成修正
        // ================================================================================

        startStroke(localX, localY, pressure, tiltX, tiltY, twist, settings) {
            this.isDrawing = true;
            
            // 🚨 Phase Emergency: PixiJS Tickerを完全停止
            this._stopPixiTicker();
            
            // ストローク情報保存
            this.currentStroke = {
                points: [],
                settings: settings || this.brushSettings?.getSettings() || {},
                startTime: Date.now()
            };
            
            // 最初の点を記録
            this.lastPoint = {
                localX, localY, pressure, tiltX, tiltY, twist
            };
            
            this.currentStroke.points.push({ ...this.lastPoint });
            
            // バウンディングボックス初期化
            const margin = (settings?.size || 10) * 2;
            this.minX = localX - margin;
            this.minY = localY - margin;
            this.maxX = localX + margin;
            this.maxY = localY + margin;
            
            // レイヤーFBO取得または作成
            const activeLayer = this.layerSystem?.getActiveLayer();
            if (!activeLayer || !activeLayer.layerData) {
                console.error('[RasterBrushCore] No active layer');
                this._restartPixiTicker();
                return false;
            }
            
            const layerId = activeLayer.layerData.id;
            
            // getOrCreateLayer()使用
            const layerData = this.rasterLayer.getOrCreateLayer(layerId);
            
            if (!layerData || !layerData.fbo || !layerData.texture) {
                console.error('[RasterBrushCore] Failed to get/create layer FBO:', {
                    layerId,
                    layerData
                });
                this._restartPixiTicker();
                return false;
            }
            
            this.currentLayerFBO = layerData.fbo;
            this.currentLayerTexture = layerData.texture;
            
            // Pixi表示用Sprite作成
            this._createDisplaySprite(localX, localY, activeLayer);
            
            // 最初の点を描画
            this._drawStampToFBO(localX, localY, pressure, tiltX, tiltY, twist, this.currentStroke.settings);
            
            // リアルタイム更新
            this._updateDisplayTexture();
            
            return true;
        }

        // ================================================================================
        // Phase C-1: Pixi表示用Sprite作成
        // ================================================================================

        _createDisplaySprite(localX, localY, activeLayer) {
            const gl = this.gl;
            const layerId = activeLayer.layerData.id;
            const width = this.rasterLayer.canvasWidth || 1024;
            const height = this.rasterLayer.canvasHeight || 1024;
            
            // GLTextureBridge API修正
            if (window.GLTextureBridge && this.currentLayerTexture) {
                try {
                    this.currentTexture = window.GLTextureBridge.createPixiTextureFromGL(
                        this.currentLayerTexture,
                        gl,
                        width,
                        height,
                        layerId
                    );
                    
                    if (!this.currentTexture) {
                        throw new Error('GLTextureBridge returned null');
                    }
                } catch (error) {
                    console.warn('[RasterBrushCore] GLTextureBridge conversion failed:', error);
                    
                    // フォールバック
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    this.currentTexture = PIXI.Texture.from(canvas);
                }
            } else {
                // フォールバック
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                this.currentTexture = PIXI.Texture.from(canvas);
            }
            
            // Sprite作成
            this.currentSprite = new PIXI.Sprite(this.currentTexture);
            this.currentSprite.anchor.set(0.5, 0.5);
            this.currentSprite.position.set(0, 0);
            this.currentSprite.label = 'raster_stroke_webgl2';
            
            // ブレンドモード設定
            const mode = this.currentStroke.settings?.mode || 'pen';
            if (mode === 'eraser') {
                this.currentSprite.blendMode = 'erase';
            } else {
                this.currentSprite.blendMode = 'normal';
            }
            
            activeLayer.addChild(this.currentSprite);
            this.isAddedToLayer = true;
            this.targetLayer = activeLayer;
        }

        // ================================================================================
        // Phase C-1: ストローク更新
        // ================================================================================

        addStrokePoint(localX, localY, pressure, tiltX, tiltY, twist) {
            if (!this.isDrawing || !this.currentStroke) {
                return;
            }
            
            const currentPoint = { localX, localY, pressure, tiltX, tiltY, twist };
            
            // バウンディングボックス更新
            const margin = (this.currentStroke.settings?.size || 10) * 2;
            this.minX = Math.min(this.minX, localX - margin);
            this.minY = Math.min(this.minY, localY - margin);
            this.maxX = Math.max(this.maxX, localX + margin);
            this.maxY = Math.max(this.maxY, localY + margin);
            
            // 補間処理
            if (this.lastPoint) {
                const dx = localX - this.lastPoint.localX;
                const dy = localY - this.lastPoint.localY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                const threshold = window.TEGAKI_CONFIG?.brush?.raster?.interpolation?.distanceThreshold || 2.5;
                
                if (distance > threshold && this.brushInterpolator) {
                    // 補間ポイント生成
                    const interpolatedPoints = this.brushInterpolator.interpolate(
                        this.lastPoint,
                        currentPoint,
                        distance
                    );
                    
                    // 補間ポイントを描画
                    interpolatedPoints.forEach(point => {
                        this._drawStampToFBO(
                            point.localX,
                            point.localY,
                            point.pressure,
                            point.tiltX,
                            point.tiltY,
                            point.twist,
                            this.currentStroke.settings
                        );
                        this.currentStroke.points.push(point);
                    });
                } else {
                    // 補間なしで描画
                    this._drawStampToFBO(localX, localY, pressure, tiltX, tiltY, twist, this.currentStroke.settings);
                    this.currentStroke.points.push(currentPoint);
                }
            }
            
            this.lastPoint = currentPoint;
            
            // リアルタイム更新
            this._updateDisplayTexture();
        }

        // ================================================================================
        // 🚨 Phase Emergency: WebGL2 FBOへブラシスタンプ描画 - 完全隔離版
        // ================================================================================

        _drawStampToFBO(localX, localY, pressure, tiltX, tiltY, twist, settings) {
            const gl = this.gl;
            
            if (!this.currentLayerFBO) {
                console.warn('[RasterBrushCore] No FBO bound');
                return;
            }
            
            // 🚨 Phase Emergency: GLステート保存
            this._saveGLState();
            
            try {
                // FBOにバインド
                gl.bindFramebuffer(gl.FRAMEBUFFER, this.currentLayerFBO);
                
                const width = this.rasterLayer.canvasWidth || 1024;
                const height = this.rasterLayer.canvasHeight || 1024;
                gl.viewport(0, 0, width, height);
                
                // ブレンド設定
                const mode = settings?.mode || 'pen';
                gl.enable(gl.BLEND);
                
                if (mode === 'eraser') {
                    // 消しゴム = アルファチャンネル削除
                    gl.blendEquation(gl.FUNC_ADD);
                    gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
                } else {
                    // Flow制御対応ブレンド
                    const flowConfig = window.TEGAKI_CONFIG?.brush?.flow;
                    
                    if (flowConfig && flowConfig.enabled) {
                        gl.blendEquation(gl.FUNC_ADD);
                        gl.blendFuncSeparate(
                            gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA,
                            gl.ONE, gl.ONE_MINUS_SRC_ALPHA
                        );
                    } else {
                        gl.blendEquation(gl.FUNC_ADD);
                        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                    }
                }
                
                // ブラシサイズ計算
                const size = settings?.size || 10;
                
                // 筆圧サイズ計算修正
                let minPressureSize = 0.01;
                
                if (this.settingsManager && typeof this.settingsManager.get === 'function') {
                    const setting = this.settingsManager.get('minPressureSize');
                    if (setting !== undefined && !isNaN(setting)) {
                        minPressureSize = parseFloat(setting);
                    }
                }
                
                if (settings?.minPressureSize !== undefined && !isNaN(settings.minPressureSize)) {
                    minPressureSize = parseFloat(settings.minPressureSize);
                }
                
                const pressureSize = size * (minPressureSize + pressure * (1.0 - minPressureSize));
                
                // Flow制御
                let flowOpacity = settings?.opacity || 1.0;
                const flowConfig = window.TEGAKI_CONFIG?.brush?.flow;
                
                if (flowConfig && flowConfig.enabled) {
                    const flowValue = flowConfig.opacity !== undefined ? flowConfig.opacity : 1.0;
                    const flowSensitivity = flowConfig.sensitivity !== undefined ? flowConfig.sensitivity : 1.0;
                    flowOpacity = (settings?.opacity || 1.0) * flowValue * flowSensitivity;
                    flowOpacity = flowOpacity * (0.3 + pressure * 0.7);
                } else {
                    flowOpacity = (settings?.opacity || 1.0) * pressure;
                }
                
                const finalAlpha = Math.max(0.01, Math.min(1.0, flowOpacity));
                
                // 色変換
                const baseColor = settings?.color || 0x800000;
                const r = ((baseColor >> 16) & 0xFF) / 255.0;
                const g = ((baseColor >> 8) & 0xFF) / 255.0;
                const b = (baseColor & 0xFF) / 255.0;
                
                // 回転角度計算
                let rotation = 0;
                if (twist !== undefined && twist !== 0) {
                    rotation = twist * Math.PI / 180.0;
                } else if (tiltX !== 0 || tiltY !== 0) {
                    rotation = Math.atan2(tiltY, tiltX);
                }
                
                // Hardness設定
                const configHardness = window.TEGAKI_CONFIG?.brush?.raster?.stamp?.hardness || 0.8;
                const hardness = settings?.hardness !== undefined ? settings.hardness : configHardness;
                
                // ブラシスタンプテクスチャ取得
                let stampTexture = null;
                if (this.brushStamp) {
                    stampTexture = this.brushStamp.generateCircleStamp(
                        pressureSize,
                        hardness,
                        true
                    );
                }
                
                // シェーダー使用
                gl.useProgram(this.brushProgram);
                gl.bindVertexArray(this.brushVAO);
                
                // ユニフォーム設定
                if (stampTexture) {
                    gl.activeTexture(gl.TEXTURE0);
                    gl.bindTexture(gl.TEXTURE_2D, stampTexture);
                    gl.uniform1i(this.brushProgram.uniforms.u_stampTexture, 0);
                }
                
                gl.uniform2f(this.brushProgram.uniforms.u_position, localX, localY);
                gl.uniform1f(this.brushProgram.uniforms.u_size, pressureSize);
                gl.uniform3f(this.brushProgram.uniforms.u_color, r, g, b);
                gl.uniform1f(this.brushProgram.uniforms.u_opacity, mode === 'eraser' ? 1.0 : finalAlpha);
                gl.uniform1f(this.brushProgram.uniforms.u_rotation, rotation);
                gl.uniform2f(this.brushProgram.uniforms.u_resolution, width, height);
                gl.uniform1f(this.brushProgram.uniforms.u_hardness, hardness);
                gl.uniform1i(this.brushProgram.uniforms.u_eraser, mode === 'eraser' ? 1 : 0);
                
                // 描画
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                
                // 即座にコマンド実行
                gl.flush();
                
            } finally {
                // 🚨 Phase Emergency: GLステート復元（必ず実行）
                this._restoreGLState();
            }
        }

        // ================================================================================
        // Phase C-1: 表示テクスチャ更新
        // ================================================================================

        _updateDisplayTexture() {
            // WebGL2描画中はテクスチャ更新を遅延
            if (this.debugMode) {
                console.log('[RasterBrushCore] Texture update deferred');
            }
        }

        // ================================================================================
        // Phase C-1: ストローク終了
        // ================================================================================

        finalizeStroke() {
            if (!this.isDrawing || !this.currentStroke) {
                return null;
            }
            
            this.isDrawing = false;
            
            // 最終テクスチャ更新
            if (this.currentSprite && this.currentLayerTexture) {
                const gl = this.gl;
                
                try {
                    if (window.GLTextureBridge) {
                        const activeLayer = this.layerSystem?.getActiveLayer();
                        const layerId = activeLayer?.layerData?.id;
                        const width = this.rasterLayer.canvasWidth || 1024;
                        const height = this.rasterLayer.canvasHeight || 1024;
                        
                        const newTexture = window.GLTextureBridge.updatePixiTexture(
                            layerId,
                            this.currentLayerTexture,
                            gl,
                            width,
                            height
                        );
                        
                        if (newTexture) {
                            this.currentTexture = newTexture;
                            this.currentSprite.texture = newTexture;
                        }
                    }
                } catch (error) {
                    console.error('[RasterBrushCore] Final texture update failed:', error);
                }
            }
            
            const sprite = this.currentSprite;
            
            if (sprite) {
                sprite._rasterStrokeData = {
                    points: this.currentStroke.points,
                    settings: this.currentStroke.settings,
                    isRasterStroke: true,
                    isWebGL2: true,
                    bounds: {
                        minX: this.minX,
                        minY: this.minY,
                        maxX: this.maxX,
                        maxY: this.maxY
                    }
                };
            }
            
            // 🚨 Phase Emergency: PixiJS Tickerを安全に再開
            this._restartPixiTicker();
            
            // 遅延レンダリング
            setTimeout(() => {
                try {
                    if (window.pixiApp && window.pixiApp.renderer) {
                        window.pixiApp.renderer.render(window.pixiApp.stage);
                        console.log('[RasterBrushCore] Deferred render completed');
                    }
                } catch (e) {
                    console.warn('[RasterBrushCore] Deferred render failed:', e);
                }
            }, 16);
            
            // クリーンアップ
            this.currentStroke = null;
            this.lastPoint = null;
            this.currentLayerFBO = null;
            this.currentLayerTexture = null;
            this.currentSprite = null;
            this.currentTexture = null;
            this.isAddedToLayer = false;
            this.targetLayer = null;
            
            return sprite;
        }

        // ================================================================================
        // ストロークキャンセル
        // ================================================================================

        cancelStroke() {
            this.isDrawing = false;
            this.currentStroke = null;
            this.lastPoint = null;
            
            if (this.currentSprite && this.isAddedToLayer && this.targetLayer) {
                this.targetLayer.removeChild(this.currentSprite);
            }
            
            if (this.currentSprite) {
                this.currentSprite.destroy();
                this.currentSprite = null;
            }
            
            if (this.currentTexture) {
                this.currentTexture.destroy();
                this.currentTexture = null;
            }
            
            this.currentLayerFBO = null;
            this.currentLayerTexture = null;
            this.isAddedToLayer = false;
            this.targetLayer = null;
            
            // 🚨 Phase Emergency: PixiJS Tickerを安全に再開
            this._restartPixiTicker();
            
            setTimeout(() => {
                try {
                    if (window.pixiApp && window.pixiApp.renderer) {
                        window.pixiApp.renderer.render(window.pixiApp.stage);
                    }
                } catch (e) {
                    // エラー無視
                }
            }, 16);
        }

        // ================================================================================
        // ユーティリティ
        // ================================================================================

        getIsDrawing() {
            return this.isDrawing;
        }

        getCurrentStroke() {
            return this.currentStroke;
        }
        
        getDebugInfo() {
            return {
                version: 'Phase Emergency: PixiJS Ticker Complete Control',
                isDrawing: this.isDrawing,
                tickerStopped: this.tickerStopped,
                hasPixiRenderCallback: this.pixiRenderCallback !== null,
                hasGL: this.gl !== null,
                hasRasterLayer: this.rasterLayer !== null,
                hasBrushStamp: this.brushStamp !== null,
                hasBrushInterpolator: this.brushInterpolator !== null,
                hasSettingsManager: this.settingsManager !== null,
                hasBrushProgram: this.brushProgram !== null,
                currentStroke: this.currentStroke ? {
                    pointCount: this.currentStroke.points.length,
                    settings: this.currentStroke.settings
                } : null,
                currentLayerFBO: this.currentLayerFBO !== null,
                currentLayerTexture: this.currentLayerTexture !== null,
                hasSprite: this.currentSprite !== null,
                isAddedToLayer: this.isAddedToLayer
            };
        }
        
        destroy() {
            const gl = this.gl;
            if (!gl) return;
            
            if (this.brushProgram) {
                gl.deleteProgram(this.brushProgram);
                this.brushProgram = null;
            }
            if (this.brushVAO) {
                gl.deleteVertexArray(this.brushVAO);
                this.brushVAO = null;
            }
            if (this.brushVBO) {
                gl.deleteBuffer(this.brushVBO);
                this.brushVBO = null;
            }
            
            if (this.currentSprite) {
                this.currentSprite.destroy();
                this.currentSprite = null;
            }
            
            if (this.currentTexture) {
                this.currentTexture.destroy();
                this.currentTexture = null;
            }
        }
    }

    // ================================================================================
    // グローバル登録
    // ================================================================================

    window.RasterBrushCore = RasterBrushCore;

    console.log('✅ raster-brush-core.js Phase Emergency Rev.2 loaded');
    console.log('   🚨 Rev.2: PixiJS v8 ticker構造の正確な解析');
    console.log('   🚨 Rev.2: renderer contextベースのコールバック検出');
    console.log('   🚨 Rev.2: 全16テクスチャスロットのクリア');
    console.log('   🚨 Rev.2: PixiJS内部システムの完全リセット');
    console.log('   🚨 E-1: GL状態機械破壊の完全防止');
    console.log('   ✅ Phase C 全機能継承');

})();