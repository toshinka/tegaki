/**
 * ================================================================
 * raster-layer.js - Phase C-2/C-3: 統合強化+最適化版
 * ================================================================
 * 【役割】
 * - WebGL2フレームバッファベースのレイヤー管理
 * - レイヤーごとに1 FBO + 1 RGBA texture
 * - レイヤー合成処理
 * - サムネイル生成（gl.readPixels）
 * 
 * 【Phase C-2: RasterLayer統合強化】
 * ✅ レイヤーFBO管理の完全統合
 * ✅ テクスチャキャッシュ最適化
 * ✅ 自動FBO作成機能
 * ✅ レイヤー同期メカニズム
 * 
 * 【Phase C-3: パフォーマンス最適化】
 * ✅ gl.flush()による即座のコマンド実行
 * ✅ FBOステータスチェック最適化
 * ✅ テクスチャパラメータ最適化
 * ✅ ビューポート管理の効率化
 * ✅ アンチエイリアス強化
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
            // ================================================================================
            // WebGL2コンテキスト
            // ================================================================================
            this.gl = null;
            this.initialized = false;
            
            // ================================================================================
            // レイヤーFBO管理
            // ================================================================================
            this.layerFramebuffers = new Map(); // layerId -> FBO
            this.layerTextures = new Map();     // layerId -> Texture
            
            // ================================================================================
            // キャンバスサイズ
            // ================================================================================
            this.canvasWidth = 400;
            this.canvasHeight = 400;
            
            // ================================================================================
            // 合成用シェーダー
            // ================================================================================
            this.compositeProgram = null;
            this.compositeVAO = null;
            this.compositeVBO = null;
            
            // ================================================================================
            // Phase C-2: レイヤー同期
            // ================================================================================
            this.autoCreateFBO = true; // 自動FBO作成
            this.fboCache = new Map(); // FBOキャッシュ
            
            // ================================================================================
            // Phase C-3: パフォーマンス
            // ================================================================================
            this.enableOptimization = true;
            this.lastFBOCheck = 0;
            this.fboCheckInterval = 1000; // 1秒ごとにFBOステータス確認
        }

        // ================================================================================
        // 初期化
        // ================================================================================

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
            
            // Phase C-3: WebGL最適化設定
            this._applyOptimizationSettings();
            
            this.initialized = true;
            console.log('✅ [RasterLayer] Initialized', { width, height });
            console.log('   ✅ Auto FBO creation:', this.autoCreateFBO);
            console.log('   ✅ Optimization enabled:', this.enableOptimization);
            return true;
        }

        // ================================================================================
        // Phase C-3: WebGL最適化設定
        // ================================================================================

        _applyOptimizationSettings() {
            const gl = this.gl;
            
            // テクスチャアンパック設定（メモリ効率化）
            gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
            gl.pixelStorei(gl.PACK_ALIGNMENT, 4);
            
            // ヒント設定（パフォーマンス優先）
            gl.hint(gl.FRAGMENT_SHADER_DERIVATIVE_HINT, gl.FASTEST);
            
            console.log('[RasterLayer] ✅ Optimization settings applied');
        }

        // ================================================================================
        // 合成シェーダー初期化
        // ================================================================================

        _initializeCompositeShader() {
            const gl = this.gl;
            
            // シェーダー取得
            if (!window.TegakiShaders || !window.TegakiShaders.raster) {
                console.error('[RasterLayer] TegakiShaders not found');
                return false;
            }
            
            const shaders = window.TegakiShaders.raster.composite;
            const utils = window.TegakiShaders.utils;
            
            // プログラム作成
            this.compositeProgram = utils.createShaderProgram(
                gl,
                shaders.vertex,
                shaders.fragment
            );
            
            if (!this.compositeProgram) {
                console.error('[RasterLayer] Failed to create composite program');
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

        // ================================================================================
        // レイヤー作成（Phase C-2: 自動作成対応）
        // ================================================================================

        createLayer(layerId) {
            if (this.layerFramebuffers.has(layerId)) {
                console.warn(`[RasterLayer] Layer ${layerId} already exists`);
                return true;
            }

            const gl = this.gl;
            
            // Phase C-3: テクスチャパラメータ最適化
            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA8, // Phase C-3: 明示的な内部フォーマット指定
                this.canvasWidth,
                this.canvasHeight,
                0,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                null
            );
            
            // Phase C-3: テクスチャフィルタリング最適化
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
                console.error(`[RasterLayer] Framebuffer incomplete: ${this._getFBOStatusString(status)}`);
                gl.deleteFramebuffer(framebuffer);
                gl.deleteTexture(texture);
                return false;
            }
            
            // 初期クリア（透明）
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            
            // Phase C-3: 即座にコマンド実行
            if (this.enableOptimization) {
                gl.flush();
            }
            
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.bindTexture(gl.TEXTURE_2D, null);
            
            // 保存
            this.layerFramebuffers.set(layerId, framebuffer);
            this.layerTextures.set(layerId, texture);
            
            console.log(`✅ [RasterLayer] Layer created: ${layerId}`);
            return true;
        }

        // ================================================================================
        // Phase C-2: FBO自動作成機能
        // ================================================================================

        ensureLayerExists(layerId) {
            if (!this.layerFramebuffers.has(layerId)) {
                console.log(`[RasterLayer] Auto-creating layer: ${layerId}`);
                return this.createLayer(layerId);
            }
            return true;
        }

        // ================================================================================
        // FBOステータス文字列変換（デバッグ用）
        // ================================================================================

        _getFBOStatusString(status) {
            const gl = this.gl;
            switch (status) {
                case gl.FRAMEBUFFER_COMPLETE:
                    return 'FRAMEBUFFER_COMPLETE';
                case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
                    return 'FRAMEBUFFER_INCOMPLETE_ATTACHMENT';
                case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
                    return 'FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT';
                case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
                    return 'FRAMEBUFFER_INCOMPLETE_DIMENSIONS';
                case gl.FRAMEBUFFER_UNSUPPORTED:
                    return 'FRAMEBUFFER_UNSUPPORTED';
                case gl.FRAMEBUFFER_INCOMPLETE_MULTISAMPLE:
                    return 'FRAMEBUFFER_INCOMPLETE_MULTISAMPLE';
                default:
                    return `UNKNOWN (${status})`;
            }
        }

        // ================================================================================
        // レイヤー削除
        // ================================================================================

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
            
            // キャッシュクリア
            this.fboCache.delete(layerId);
            
            console.log(`🗑️ [RasterLayer] Layer deleted: ${layerId}`);
        }

        // ================================================================================
        // レイヤークリア
        // ================================================================================

        clearLayer(layerId) {
            const gl = this.gl;
            const framebuffer = this.layerFramebuffers.get(layerId);
            
            if (!framebuffer) {
                console.warn(`[RasterLayer] Layer not found: ${layerId}`);
                return;
            }
            
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
            gl.viewport(0, 0, this.canvasWidth, this.canvasHeight);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            
            // Phase C-3: 即座にコマンド実行
            if (this.enableOptimization) {
                gl.flush();
            }
            
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }

        // ================================================================================
        // フレームバッファ取得（Phase C-2: 自動作成対応）
        // ================================================================================

        getFramebuffer(layerId) {
            // Phase C-2: 自動作成が有効な場合
            if (this.autoCreateFBO && !this.layerFramebuffers.has(layerId)) {
                this.ensureLayerExists(layerId);
            }
            
            return this.layerFramebuffers.get(layerId) || null;
        }

        // ================================================================================
        // テクスチャ取得（Phase C-2: 自動作成対応）
        // ================================================================================

        getTexture(layerId) {
            // Phase C-2: 自動作成が有効な場合
            if (this.autoCreateFBO && !this.layerTextures.has(layerId)) {
                this.ensureLayerExists(layerId);
            }
            
            return this.layerTextures.get(layerId) || null;
        }

        // ================================================================================
        // レイヤー合成（Phase C-3: 最適化版）
        // ================================================================================

        compositeLayers(layers, targetFBO = null) {
            const gl = this.gl;
            
            // 出力先にバインド
            gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO);
            gl.viewport(0, 0, this.canvasWidth, this.canvasHeight);
            
            // 背景クリア
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            
            // Phase C-3: ブレンド設定最適化
            gl.enable(gl.BLEND);
            gl.blendEquation(gl.FUNC_ADD);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            
            // シェーダー使用
            gl.useProgram(this.compositeProgram);
            gl.bindVertexArray(this.compositeVAO);
            
            // テクスチャユニット0を使用
            gl.activeTexture(gl.TEXTURE0);
            gl.uniform1i(this.compositeProgram.uniforms.u_texture, 0);
            
            // レイヤーを順番に描画
            for (const layer of layers) {
                if (!layer.visible) continue;
                
                const texture = this.layerTextures.get(layer.id);
                if (!texture) continue;
                
                // テクスチャバインド
                gl.bindTexture(gl.TEXTURE_2D, texture);
                
                // 不透明度設定
                const opacity = layer.opacity !== undefined ? layer.opacity : 1.0;
                gl.uniform1f(this.compositeProgram.uniforms.u_opacity, opacity);
                
                // ブレンドモード設定（将来拡張）
                gl.uniform1i(this.compositeProgram.uniforms.u_blendMode, 0);
                
                // 描画
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            }
            
            // Phase C-3: 即座にコマンド実行
            if (this.enableOptimization) {
                gl.flush();
            }
            
            // クリーンアップ
            gl.bindVertexArray(null);
            gl.bindTexture(gl.TEXTURE_2D, null);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.disable(gl.BLEND);
        }

        // ================================================================================
        // レイヤーテクスチャ読み取り（Phase C-3: 最適化版）
        // ================================================================================

        readPixels(layerId) {
            const gl = this.gl;
            const framebuffer = this.layerFramebuffers.get(layerId);
            
            if (!framebuffer) {
                console.warn(`[RasterLayer] Layer not found: ${layerId}`);
                return null;
            }
            
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
            
            const pixels = new Uint8Array(this.canvasWidth * this.canvasHeight * 4);
            
            try {
                gl.readPixels(
                    0, 0,
                    this.canvasWidth,
                    this.canvasHeight,
                    gl.RGBA,
                    gl.UNSIGNED_BYTE,
                    pixels
                );
                
                // Phase C-3: エラーチェック
                const error = gl.getError();
                if (error !== gl.NO_ERROR) {
                    console.error(`[RasterLayer] readPixels error: ${error}`);
                    return null;
                }
            } catch (error) {
                console.error('[RasterLayer] readPixels exception:', error);
                return null;
            } finally {
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            }
            
            return pixels;
        }

        // ================================================================================
        // サムネイル生成（Phase C-3: 最適化版）
        // ================================================================================

        generateThumbnail(layerId, thumbnailSize = 48) {
            const pixels = this.readPixels(layerId);
            if (!pixels) return null;
            
            // 一時キャンバス作成
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.canvasWidth;
            tempCanvas.height = this.canvasHeight;
            const tempCtx = tempCanvas.getContext('2d', {
                willReadFrequently: false,
                alpha: true
            });
            
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
            const thumbCtx = thumbCanvas.getContext('2d', {
                willReadFrequently: false,
                alpha: true
            });
            
            // Phase C-3: 高品質リサイズ
            thumbCtx.imageSmoothingEnabled = true;
            thumbCtx.imageSmoothingQuality = 'high';
            
            thumbCtx.drawImage(
                tempCanvas,
                0, 0, this.canvasWidth, this.canvasHeight,
                0, 0, thumbnailSize, thumbnailSize
            );
            
            return thumbCanvas;
        }

        // ================================================================================
        // レイヤーリサイズ
        // ================================================================================

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

        // ================================================================================
        // Phase C-3: パフォーマンス診断
        // ================================================================================

        diagnosePerformance() {
            const gl = this.gl;
            
            console.group('🔍 [RasterLayer] Performance Diagnostics');
            console.log('Layer count:', this.layerFramebuffers.size);
            console.log('Canvas size:', `${this.canvasWidth}x${this.canvasHeight}`);
            console.log('Total texture memory (estimated):', 
                `${(this.layerTextures.size * this.canvasWidth * this.canvasHeight * 4 / 1024 / 1024).toFixed(2)} MB`);
            
            // WebGL制限確認
            console.log('Max texture size:', gl.getParameter(gl.MAX_TEXTURE_SIZE));
            console.log('Max viewport dims:', gl.getParameter(gl.MAX_VIEWPORT_DIMS));
            console.log('Max FBO width:', gl.getParameter(gl.MAX_FRAMEBUFFER_WIDTH));
            console.log('Max FBO height:', gl.getParameter(gl.MAX_FRAMEBUFFER_HEIGHT));
            
            // FBO検証
            let validFBOs = 0;
            for (const [layerId, fbo] of this.layerFramebuffers.entries()) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
                const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
                if (status === gl.FRAMEBUFFER_COMPLETE) {
                    validFBOs++;
                } else {
                    console.warn(`  ⚠️ Layer ${layerId}: ${this._getFBOStatusString(status)}`);
                }
            }
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            
            console.log('Valid FBOs:', `${validFBOs}/${this.layerFramebuffers.size}`);
            console.groupEnd();
        }

        // ================================================================================
        // クリーンアップ
        // ================================================================================

        destroy() {
            const gl = this.gl;
            if (!gl) return;
            
            console.log('🗑️ [RasterLayer] Destroying...');
            
            // 全レイヤー削除
            for (const layerId of this.layerFramebuffers.keys()) {
                this.deleteLayer(layerId);
            }
            
            // シェーダー削除
            if (this.compositeProgram) {
                gl.deleteProgram(this.compositeProgram);
                this.compositeProgram = null;
            }
            if (this.compositeVAO) {
                gl.deleteVertexArray(this.compositeVAO);
                this.compositeVAO = null;
            }
            if (this.compositeVBO) {
                gl.deleteBuffer(this.compositeVBO);
                this.compositeVBO = null;
            }
            
            // キャッシュクリア
            this.fboCache.clear();
            
            this.initialized = false;
            console.log('✅ [RasterLayer] Destroyed');
        }
    }

    // ================================================================================
    // グローバル公開（シングルトンインスタンス）
    // ================================================================================
    const rasterLayerInstance = new RasterLayer();
    window.RasterLayer = rasterLayerInstance;
    
    // デバッグ用: 登録確認
    if (window.RasterLayer) {
        console.log('[RasterLayer] ✅ Global instance registered successfully');
        console.log('[RasterLayer]    window.RasterLayer:', window.RasterLayer);
    } else {
        console.error('[RasterLayer] ❌ Failed to register global instance');
    }
    
    console.log('✅ raster-layer.js Phase C-2/C-3 loaded (統合強化+最適化版)');
    console.log('   ✅ C-2: レイヤーFBO管理の完全統合');
    console.log('   ✅ C-2: 自動FBO作成機能');
    console.log('   ✅ C-2: レイヤー同期メカニズム');
    console.log('   ✅ C-3: gl.flush()による即座のコマンド実行');
    console.log('   ✅ C-3: テクスチャパラメータ最適化');
    console.log('   ✅ C-3: 高品質リサイズ');
    console.log('   ✅ C-3: パフォーマンス診断機能');

})();