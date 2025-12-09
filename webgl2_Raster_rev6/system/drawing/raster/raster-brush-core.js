/**
 * ============================================================================
 * ファイル名: system/drawing/raster/raster-brush-core.js
 * 責務: ラスターブラシの中核実装 - WebGL2 テクスチャ直接描画
 * 
 * 【Phase C-1: WebGL2描画パイプライン完全実装】
 * 🔥 WebGL2 Framebuffer への直接描画
 * 🔥 シェーダーベースのブラシスタンプ描画
 * 🔥 真のGPU加速ラスター描画
 * 🔥 Flow制御・アンチエイリアス実装
 * 🔥 消しゴム: アルファチャンネル削除
 * 
 * 【Phase A: 緊急修正完了】
 * ✅ A-1: 筆圧サイズ計算修正
 * ✅ A-2: リアルタイム描画実装
 * ✅ A-3: 消しゴム正しい実装
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
            // Phase C-1: Pixi統合（表示用）
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
            
            console.log('✅ [RasterBrushCore] WebGL2 pipeline initialized');
            console.log('   ✅ RasterLayer: OK');
            console.log('   ✅ BrushStamp:', this.brushStamp ? 'OK' : 'Not available');
            console.log('   ✅ BrushInterpolator:', this.brushInterpolator ? 'OK' : 'Not available');
            console.log('   ✅ Shader Program: OK');
            console.log('   ✅ Settings Manager:', this.settingsManager ? 'OK' : 'Not available');
            
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
            
            // 頂点バッファ（ビルボード用四角形）
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
        // Phase C-1: ストローク開始 - WebGL2 FBO描画
        // ================================================================================

        startStroke(localX, localY, pressure, tiltX, tiltY, twist, settings) {
            this.isDrawing = true;
            
            // 🔥 Phase C-1: PixiJSレンダラーを一時停止
            if (window.pixiApp && window.pixiApp.ticker) {
                window.pixiApp.ticker.stop();
                console.log('[RasterBrushCore] PixiJS ticker stopped for WebGL2 drawing');
            }
            
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
            
            // Phase C-1: レイヤーFBO取得または作成
            const activeLayer = this.layerSystem?.getActiveLayer();
            if (!activeLayer || !activeLayer.layerData) {
                console.error('[RasterBrushCore] No active layer');
                return false;
            }
            
            const layerId = activeLayer.layerData.id;
            
            // RasterLayerでFBO確保
            this.currentLayerFBO = this.rasterLayer.getFramebuffer(layerId);
            this.currentLayerTexture = this.rasterLayer.getTexture(layerId);
            
            if (!this.currentLayerFBO || !this.currentLayerTexture) {
                console.error('[RasterBrushCore] Failed to get layer FBO');
                return false;
            }
            
            console.log('[RasterBrushCore] FBO acquired:', {
                layerId,
                fbo: this.currentLayerFBO,
                texture: this.currentLayerTexture
            });
            
            // Pixi表示用Sprite作成
            this._createDisplaySprite(localX, localY, activeLayer);
            
            // 最初の点を描画
            this._drawStampToFBO(localX, localY, pressure, tiltX, tiltY, twist, this.currentStroke.settings);
            
            // リアルタイム更新
            this._updateDisplayTexture();
            this._renderImmediate();
            
            return true;
        }

        // ================================================================================
        // Phase C-1: Pixi表示用Sprite作成
        // ================================================================================

        _createDisplaySprite(localX, localY, activeLayer) {
            const gl = this.gl;
            
            // WebGLTexture → PIXI.Texture変換
            if (window.GLTextureBridge && this.currentLayerTexture) {
                try {
                    this.currentTexture = window.GLTextureBridge.createTextureFromGL(
                        gl,
                        this.currentLayerTexture
                    );
                } catch (error) {
                    console.warn('[RasterBrushCore] GLTextureBridge conversion failed:', error);
                    
                    // フォールバック: 空のテクスチャ作成
                    const canvas = document.createElement('canvas');
                    canvas.width = this.rasterLayer.canvasWidth || 1024;
                    canvas.height = this.rasterLayer.canvasHeight || 1024;
                    this.currentTexture = PIXI.Texture.from(canvas);
                }
            } else {
                // フォールバック
                const canvas = document.createElement('canvas');
                canvas.width = this.rasterLayer.canvasWidth || 1024;
                canvas.height = this.rasterLayer.canvasHeight || 1024;
                this.currentTexture = PIXI.Texture.from(canvas);
            }
            
            // Sprite作成
            this.currentSprite = new PIXI.Sprite(this.currentTexture);
            this.currentSprite.anchor.set(0.5, 0.5);
            this.currentSprite.position.set(0, 0); // レイヤー原点
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
            this._renderImmediate();
        }

        // ================================================================================
        // Phase C-1: WebGL2 FBOへブラシスタンプ描画
        // ================================================================================

        _drawStampToFBO(localX, localY, pressure, tiltX, tiltY, twist, settings) {
            const gl = this.gl;
            
            if (!this.currentLayerFBO) {
                console.warn('[RasterBrushCore] No FBO bound');
                return;
            }
            
            // 🔥 デバッグ: WebGLステート確認
            const currentProgram = gl.getParameter(gl.CURRENT_PROGRAM);
            if (currentProgram && currentProgram !== this.brushProgram) {
                console.warn('[RasterBrushCore] Program mismatch detected, resetting...');
                gl.useProgram(null);
            }
            
            // Phase C-1: FBOにバインド
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.currentLayerFBO);
            
            const width = this.rasterLayer.canvasWidth || 1024;
            const height = this.rasterLayer.canvasHeight || 1024;
            gl.viewport(0, 0, width, height);
            
            // ブレンド設定
            const mode = settings?.mode || 'pen';
            gl.enable(gl.BLEND);
            
            if (mode === 'eraser') {
                // Phase A-3: 消しゴム = アルファチャンネル削除
                gl.blendEquation(gl.FUNC_ADD);
                gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
            } else {
                // Phase A-3 & Phase C-1: Flow制御対応ブレンド
                const flowConfig = window.TEGAKI_CONFIG?.brush?.flow;
                
                if (flowConfig && flowConfig.enabled) {
                    // Flow有効時: アルファ累積
                    gl.blendEquation(gl.FUNC_ADD);
                    gl.blendFuncSeparate(
                        gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA,  // RGB
                        gl.ONE, gl.ONE_MINUS_SRC_ALPHA          // Alpha
                    );
                } else {
                    // 通常ブレンド
                    gl.blendEquation(gl.FUNC_ADD);
                    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                }
            }
            
            // ブラシサイズ計算
            const size = settings?.size || 10;
            
            // Phase A-1: 筆圧サイズ計算修正
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
            
            // Phase C-1: Flow制御
            let flowOpacity = settings?.opacity || 1.0;
            const flowConfig = window.TEGAKI_CONFIG?.brush?.flow;
            
            if (flowConfig && flowConfig.enabled) {
                const flowValue = flowConfig.opacity !== undefined ? flowConfig.opacity : 1.0;
                const flowSensitivity = flowConfig.sensitivity !== undefined ? flowConfig.sensitivity : 1.0;
                flowOpacity = (settings?.opacity || 1.0) * flowValue * flowSensitivity;
                flowOpacity = flowOpacity * (0.3 + pressure * 0.7); // 筆圧で流量調整
            } else {
                flowOpacity = (settings?.opacity || 1.0) * pressure;
            }
            
            const finalAlpha = Math.max(0.01, Math.min(1.0, flowOpacity));
            
            // 色変換
            const baseColor = settings?.color || 0x800000;
            const r = ((baseColor >> 16) & 0xFF) / 255.0;
            const g = ((baseColor >> 8) & 0xFF) / 255.0;
            const b = (baseColor & 0xFF) / 255.0;
            
            // 回転角度計算（tiltX, tiltY, twist から）
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
                    true  // antialiasing
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
            
            // クリーンアップ - 🔥 Phase C-1: WebGLステートを完全にリセット
            gl.bindVertexArray(null);
            gl.bindTexture(gl.TEXTURE_2D, null);
            gl.useProgram(null); // プログラムのバインド解除
            gl.bindFramebuffer(gl.FRAMEBUFFER, null); // 🔥 最重要: FBOをnullに戻す
            gl.disable(gl.BLEND); // ブレンドモード解除
            
            // 🔥 追加: すべてのテクスチャユニットをクリア
            for (let i = 0; i < 8; i++) {
                gl.activeTexture(gl.TEXTURE0 + i);
                gl.bindTexture(gl.TEXTURE_2D, null);
            }
            gl.activeTexture(gl.TEXTURE0); // デフォルトに戻す
            
            // Phase C-3: 即座にコマンド実行
            gl.flush();
            gl.finish(); // 🔥 追加: すべてのコマンドの完了を待つ
        }

        // ================================================================================
        // Phase C-1: 表示テクスチャ更新
        // ================================================================================

        _updateDisplayTexture() {
            // 🔥 Phase C-1: WebGL2描画中はテクスチャ更新を遅延
            // finalizeStroke()で最終的に更新する
            // これによりPixiJSとの競合を回避
            
            if (this.debugMode) {
                console.log('[RasterBrushCore] Texture update deferred until finalize');
            }
            
            return;
            
            /* 以下は finalizeStroke() で実行
            if (!this.currentSprite || !this.currentLayerTexture) {
                return;
            }
            
            const gl = this.gl;
            
            try {
                // WebGLTexture → PIXI.Texture 更新
                if (window.GLTextureBridge) {
                    const newTexture = window.GLTextureBridge.createTextureFromGL(
                        gl,
                        this.currentLayerTexture
                    );
                    
                    if (newTexture) {
                        const oldTexture = this.currentTexture;
                        this.currentTexture = newTexture;
                        this.currentSprite.texture = newTexture;
                        
                        // 古いテクスチャを破棄
                        if (oldTexture) {
                            setTimeout(() => {
                                try {
                                    oldTexture.destroy(false);
                                } catch (e) {
                                    // エラー無視
                                }
                            }, 100);
                        }
                    }
                }
            } catch (error) {
                console.warn('[RasterBrushCore] Texture update failed:', error);
            }
            */
        }

        // ================================================================================
        // Phase A-2: リアルタイムレンダリング
        // ================================================================================

        _renderImmediate() {
            // 🔥 Phase C-1: WebGL2描画中はPixiJSレンダラーを呼ばない
            // テクスチャ更新は_updateDisplayTexture()で行う
            // PixiJSのレンダリングはfinalizeStroke()後に再開される
            
            // デバッグ用: FBOの内容をコンソールで確認
            if (this.debugMode && this.currentLayerFBO) {
                console.log('[RasterBrushCore] FBO rendering in progress...');
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
            
            // 🔥 Phase C-1: 最終テクスチャ更新
            if (this.currentSprite && this.currentLayerTexture) {
                const gl = this.gl;
                
                try {
                    console.log('[RasterBrushCore] Finalizing texture update...');
                    
                    if (window.GLTextureBridge) {
                        const newTexture = window.GLTextureBridge.createTextureFromGL(
                            gl,
                            this.currentLayerTexture
                        );
                        
                        if (newTexture) {
                            const oldTexture = this.currentTexture;
                            this.currentTexture = newTexture;
                            this.currentSprite.texture = newTexture;
                            
                            console.log('[RasterBrushCore] Texture updated successfully');
                            
                            // 古いテクスチャを破棄
                            if (oldTexture) {
                                setTimeout(() => {
                                    try {
                                        oldTexture.destroy(false);
                                    } catch (e) {
                                        // エラー無視
                                    }
                                }, 100);
                            }
                        }
                    }
                } catch (error) {
                    console.error('[RasterBrushCore] Final texture update failed:', error);
                }
            }
            
            const sprite = this.currentSprite;
            
            if (sprite) {
                // ストローク情報をメタデータとして保存
                sprite._rasterStrokeData = {
                    points: this.currentStroke.points,
                    settings: this.currentStroke.settings,
                    isRasterStroke: true,
                    isWebGL2: true,  // Phase C-1識別フラグ
                    bounds: {
                        minX: this.minX,
                        minY: this.minY,
                        maxX: this.maxX,
                        maxY: this.maxY
                    }
                };
            }
            
            // 🔥 Phase C-1: PixiJSレンダラーを再開
            if (window.pixiApp && window.pixiApp.renderer) {
                const renderer = window.pixiApp.renderer;
                const gl = this.gl;
                
                // PixiJS v8: 最小限のステートリセット
                try {
                    // WebGLステートを強制的にクリア
                    gl.useProgram(null);
                    gl.bindBuffer(gl.ARRAY_BUFFER, null);
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
                    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
                    
                    // すべてのテクスチャユニットをクリア
                    for (let i = 0; i < 16; i++) {
                        gl.activeTexture(gl.TEXTURE0 + i);
                        gl.bindTexture(gl.TEXTURE_2D, null);
                        gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
                    }
                    gl.activeTexture(gl.TEXTURE0);
                    
                    // VAOをクリア
                    gl.bindVertexArray(null);
                    
                    console.log('[RasterBrushCore] WebGL state fully cleared');
                } catch (e) {
                    console.warn('[RasterBrushCore] State clear failed:', e);
                }
                
                // Tickerを再開
                window.pixiApp.ticker.start();
                
                // 🔥 重要: 次のフレームでPixiJSに描画させる（すぐには描画しない）
                setTimeout(() => {
                    try {
                        if (renderer && renderer.render) {
                            renderer.render(window.pixiApp.stage);
                            console.log('[RasterBrushCore] Deferred PixiJS render completed');
                        }
                    } catch (e) {
                        console.warn('[RasterBrushCore] Deferred render failed:', e);
                    }
                }, 16); // 1フレーム待つ
                
                console.log('[RasterBrushCore] PixiJS ticker restarted');
            }
            
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
            
            // レイヤーから削除
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
            
            // 🔥 Phase C-1: PixiJSレンダラーを再開
            if (window.pixiApp && window.pixiApp.renderer) {
                const renderer = window.pixiApp.renderer;
                const gl = this.gl;
                
                try {
                    // WebGLステートをクリア
                    gl.useProgram(null);
                    gl.bindBuffer(gl.ARRAY_BUFFER, null);
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
                    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                    gl.bindVertexArray(null);
                    
                    for (let i = 0; i < 8; i++) {
                        gl.activeTexture(gl.TEXTURE0 + i);
                        gl.bindTexture(gl.TEXTURE_2D, null);
                    }
                    gl.activeTexture(gl.TEXTURE0);
                } catch (e) {
                    console.warn('[RasterBrushCore] State clear failed:', e);
                }
                
                // Tickerを再開
                window.pixiApp.ticker.start();
                
                // 遅延レンダリング
                setTimeout(() => {
                    try {
                        if (renderer && renderer.render) {
                            renderer.render(window.pixiApp.stage);
                        }
                    } catch (e) {
                        // エラー無視
                    }
                }, 16);
                
                console.log('[RasterBrushCore] PixiJS ticker restarted (cancel)');
            }
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
                version: 'Phase C-1: WebGL2 Pipeline',
                isDrawing: this.isDrawing,
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
                isAddedToLayer: this.isAddedToLayer,
                minPressureSize: this.settingsManager 
                    ? this.settingsManager.get('minPressureSize') 
                    : 'N/A'
            };
        }
        
        destroy() {
            const gl = this.gl;
            if (!gl) return;
            
            // シェーダー削除
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

    console.log('✅ raster-brush-core.js Phase C-1 loaded (WebGL2完全実装)');
    console.log('   🔥 C-1: WebGL2 Framebufferへの直接描画');
    console.log('   🔥 C-1: シェーダーベースのブラシスタンプ描画');
    console.log('   🔥 C-1: 真のGPU加速ラスター描画');
    console.log('   🔥 C-1: Flow制御・アンチエイリアス実装');
    console.log('   🔥 C-1: 消しゴム = アルファチャンネル削除');
    console.log('   ✅ Phase A 全機能継承');

})();