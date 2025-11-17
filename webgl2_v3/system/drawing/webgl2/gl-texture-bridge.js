/**
 * ================================================================================
 * gl-texture-bridge.js - Phase 5: WebGL2 Texture Bridge
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - webgl2-drawing-layer.js (WebGL2DrawingLayer.gl)
 *   - gl-msdf-pipeline.js (WebGLTexture生成元)
 * 
 * 📄 子ファイル依存:
 *   - stroke-renderer.js (createSpriteFromGLTexture呼び出し)
 *   - brush-core.js (Sprite生成・配置)
 * 
 * 【責務】
 * - WebGLTexture → PIXI.Sprite 変換（gl.readPixels経由）
 * - サイズメタ情報の管理（WeakMap）
 * - ImageData生成 → ImageBitmap → PIXI.Texture → PIXI.Sprite
 * 
 * 【WebGPU→WebGL2変換】
 * - GPUTexture → WebGLTexture
 * - copyTextureToBuffer + mapAsync → gl.readPixels
 * - GPU Buffer → CPU ImageData (同期読み取り)
 * 
 * ================================================================================
 */

(function() {
    'use strict';

    class GLTextureBridge {
        constructor() {
            this.gl = null;
            this.initialized = false;
            
            // WebGLTexture → {width, height, format} メタ管理
            this._textureSizeMap = new WeakMap();
        }

        /**
         * 初期化
         */
        async initialize() {
            if (this.initialized) return true;

            try {
                if (!window.WebGL2DrawingLayer?.isInitialized()) {
                    throw new Error('WebGL2DrawingLayer not initialized');
                }

                this.gl = window.WebGL2DrawingLayer.getGL();

                this.initialized = true;
                console.log('[GLTextureBridge] ✅ Initialized (Phase 5)');
                return true;

            } catch (error) {
                console.error('[GLTextureBridge] Initialization failed:', error);
                return false;
            }
        }

        /**
         * WebGLTexture作成（統一エントリーポイント）
         * サイズメタを自動登録
         */
        createGLTexture(opts = {}) {
            if (!this.initialized) {
                throw new Error('[GLTextureBridge] Not initialized');
            }

            const { width, height, format = 'rgba8', internalFormat, type } = opts;
            
            if (!width || !height) {
                throw new Error('[GLTextureBridge] width/height required');
            }

            const gl = this.gl;
            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            
            // Format設定
            const glInternalFormat = internalFormat || gl.RGBA8;
            const glFormat = gl.RGBA;
            const glType = type || gl.UNSIGNED_BYTE;
            
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                glInternalFormat,
                width,
                height,
                0,
                glFormat,
                glType,
                null
            );
            
            // Filter設定
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            
            gl.bindTexture(gl.TEXTURE_2D, null);

            // WeakMapにメタ情報を保存
            try {
                this._textureSizeMap.set(texture, { width, height, format });
            } catch (e) {
                console.warn('[GLTextureBridge] Failed to store texture metadata');
            }

            return texture;
        }

        /**
         * 外部生成テクスチャのメタ登録
         */
        registerTextureMeta(glTexture, { width, height, format } = {}) {
            if (!glTexture) return;
            
            try {
                this._textureSizeMap.set(glTexture, { width, height, format });
            } catch (e) {
                console.warn('[GLTextureBridge] Failed to register texture metadata');
            }
        }

        /**
         * 安全なサイズ取得
         * @private
         */
        _getTextureSize(glTexture) {
            if (!glTexture) return null;

            // WeakMapメタ取得
            const meta = this._textureSizeMap.get(glTexture);
            if (meta) {
                return { width: meta.width, height: meta.height, format: meta.format };
            }

            return null;
        }

        /**
         * WebGLTexture → PIXI.Sprite変換
         * 🔧 Phase 5実装: gl.readPixels使用
         * 
         * @param {WebGLTexture} glTexture - WebGL2テクスチャ
         * @param {number} requestedWidth - 幅（指定なしでメタから取得）
         * @param {number} requestedHeight - 高さ（指定なしでメタから取得）
         * @returns {Promise<PIXI.Sprite>}
         */
        async createSpriteFromGLTexture(glTexture, requestedWidth = null, requestedHeight = null) {
            if (!this.initialized) {
                await this.initialize();
            }

            // サイズメタ取得
            const sizeMeta = this._getTextureSize(glTexture);
            const width = requestedWidth ?? sizeMeta?.width;
            const height = requestedHeight ?? sizeMeta?.height;

            if (!width || !height) {
                console.warn('[GLTextureBridge] Unknown texture size', {
                    requestedWidth,
                    requestedHeight,
                    meta: sizeMeta
                });
                throw new Error('[GLTextureBridge] Cannot determine texture size');
            }

            // サイズ不一致を警告
            if (sizeMeta && (sizeMeta.width !== width || sizeMeta.height !== height)) {
                console.warn('[GLTextureBridge] Size mismatch (non-fatal):', {
                    meta: `${sizeMeta.width}x${sizeMeta.height}`,
                    requested: `${width}x${height}`
                });
            }

            try {
                const gl = this.gl;
                
                // FBO作成（readPixels用）
                const fbo = gl.createFramebuffer();
                gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
                gl.framebufferTexture2D(
                    gl.FRAMEBUFFER,
                    gl.COLOR_ATTACHMENT0,
                    gl.TEXTURE_2D,
                    glTexture,
                    0
                );

                // FBO完全性チェック
                const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
                if (status !== gl.FRAMEBUFFER_COMPLETE) {
                    console.error('[GLTextureBridge] FBO incomplete:', status);
                    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                    gl.deleteFramebuffer(fbo);
                    throw new Error('FBO incomplete');
                }

                // ピクセルデータ読み取り
                const pixels = new Uint8Array(width * height * 4);
                gl.readPixels(
                    0,
                    0,
                    width,
                    height,
                    gl.RGBA,
                    gl.UNSIGNED_BYTE,
                    pixels
                );

                // Cleanup
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.deleteFramebuffer(fbo);

                // ImageData作成（Y軸反転が必要な場合）
                const imageData = new ImageData(
                    new Uint8ClampedArray(pixels),
                    width,
                    height
                );

                // Y軸反転（WebGLは下が原点、ImageDataは上が原点）
                const flipped = this._flipImageDataY(imageData);

                // ImageBitmap作成
                const bitmap = await createImageBitmap(flipped);
                
                // PIXI.Texture作成
                const texture = PIXI.Texture.from(bitmap, {
                    scaleMode: 'linear',
                    mipmap: 'off',
                    width: width,
                    height: height
                });

                // PIXI.Sprite作成
                const sprite = new PIXI.Sprite(texture);
                sprite.width = width;
                sprite.height = height;

                return sprite;

            } catch (error) {
                console.error('[GLTextureBridge] Sprite creation failed:', error);
                throw error;
            }
        }

        /**
         * ImageDataのY軸反転
         * @private
         */
        _flipImageDataY(imageData) {
            const width = imageData.width;
            const height = imageData.height;
            const flipped = new Uint8ClampedArray(width * height * 4);
            
            for (let y = 0; y < height; y++) {
                const srcRow = (height - 1 - y) * width * 4;
                const dstRow = y * width * 4;
                
                for (let x = 0; x < width * 4; x++) {
                    flipped[dstRow + x] = imageData.data[srcRow + x];
                }
            }
            
            return new ImageData(flipped, width, height);
        }

        /**
         * PIXI.Textureのみ返す（Sprite不要時）
         */
        async createPixiTextureFromGL(glTexture, width = null, height = null) {
            const sprite = await this.createSpriteFromGLTexture(glTexture, width, height);
            return sprite.texture;
        }

        /**
         * Legacy: SDF Float配列 → PIXI.Texture
         */
        async sdfToPixiTexture(sdfData, width, height, colorSettings = null) {
            if (!sdfData || sdfData.length !== width * height) {
                throw new Error('[GLTextureBridge] Invalid SDF data');
            }

            const color = colorSettings || { r: 128, g: 0, b: 0, alpha: 255 };

            const pixelData = new Uint8ClampedArray(width * height * 4);
            
            for (let i = 0; i < sdfData.length; i++) {
                const distance = sdfData[i];
                const alpha = distance < 1.0 ? 255 : Math.max(0, 255 - distance * 10);
                
                const idx = i * 4;
                pixelData[idx] = color.r;
                pixelData[idx + 1] = color.g;
                pixelData[idx + 2] = color.b;
                pixelData[idx + 3] = alpha;
            }

            const imageData = new ImageData(pixelData, width, height);
            const bitmap = await createImageBitmap(imageData);

            const texture = PIXI.Texture.from(bitmap, {
                scaleMode: 'linear',
                mipmap: 'off',
                width: width,
                height: height
            });

            return texture;
        }

        /**
         * Legacy: MSDF Float配列 → PIXI.Texture
         */
        async msdfToPixiTexture(msdfData, width, height) {
            if (!msdfData || msdfData.length !== width * height * 4) {
                throw new Error('[GLTextureBridge] Invalid MSDF data');
            }

            const pixelData = new Uint8ClampedArray(width * height * 4);
            
            for (let i = 0; i < msdfData.length; i++) {
                pixelData[i] = Math.floor(Math.max(0, Math.min(1, msdfData[i])) * 255);
            }

            const imageData = new ImageData(pixelData, width, height);
            const bitmap = await createImageBitmap(imageData);

            const texture = PIXI.Texture.from(bitmap, {
                scaleMode: 'linear',
                mipmap: 'off',
                width: width,
                height: height
            });

            return texture;
        }

        /**
         * クリーンアップ
         */
        destroy() {
            this._textureSizeMap = new WeakMap();
            this.gl = null;
            this.initialized = false;
        }

        /**
         * 初期化状態確認
         */
        isInitialized() {
            return this.initialized;
        }
    }

    // Singleton登録
    window.GLTextureBridge = new GLTextureBridge();

    console.log('✅ gl-texture-bridge.js Phase 5完全版 loaded');
    console.log('   ✅ WebGLTexture → PIXI.Sprite変換実装完了');

})();