/**
 * ================================================================================
 * webgpu-texture-bridge.js - Phase C-0: PerfectFreehand統合対応完全版
 * ================================================================================
 * 
 * 【責務】
 * - GPUTexture → PIXI.Sprite 変換（CopyTextureToBuffer経由）
 * - サイズメタ情報の安全な管理（WeakMap）
 * - 256バイト境界アライメント保証
 * 
 * 【親依存】
 * - webgpu-drawing-layer.js: device/queue取得
 * - msdf-pipeline-manager.js: GPUTexture生成元
 * 
 * 【子依存】
 * - なし（ピュア変換処理）
 * 
 * 【改修履歴】
 * - Phase 1-5: 基本実装・サイズ検証
 * - Phase C-0: WeakMapメタ管理・堅牢化（GPT5アドバイス準拠）
 *   🔥 例外を投げずにサイズ回収
 *   🔥 _textureSizeMap による確実なメタ管理
 *   🔥 createGPUTexture 経由での統一生成
 *   🔥 毎回新規buffer作成（mapAsync競合完全回避）
 * ================================================================================
 */

(function() {
    'use strict';

    class WebGPUTextureBridge {
        constructor() {
            this.device = null;
            this.queue = null;
            this.initialized = false;
            
            // 🔥 Phase C-0: GPUTexture → {width, height, format} メタ管理
            this._textureSizeMap = new WeakMap();
        }

        async initialize() {
            if (this.initialized) return true;

            try {
                if (!window.WebGPUDrawingLayer?.isInitialized()) {
                    throw new Error('WebGPUDrawingLayer not initialized');
                }

                this.device = window.WebGPUDrawingLayer.getDevice();
                this.queue = window.WebGPUDrawingLayer.getQueue();

                this.initialized = true;
                console.log('✅ [WebGPUTextureBridge] Phase C-0: PerfectFreehand統合対応完全版');
                console.log('   🔥 WeakMapメタ管理実装');
                console.log('   🔥 堅牢なサイズ回収ロジック');
                return true;

            } catch (error) {
                console.error('❌ [WebGPUTextureBridge] Initialization failed:', error);
                return false;
            }
        }

        /**
         * 🔥 Phase C-0: GPUTexture作成の統一エントリーポイント
         * サイズメタを自動登録
         */
        createGPUTexture(opts = {}) {
            if (!this.initialized) {
                throw new Error('[TextureBridge] Not initialized');
            }

            const { width, height, format = 'rgba8unorm', usage } = opts;
            
            if (!width || !height) {
                throw new Error('[TextureBridge] width/height required when creating texture');
            }

            const texture = this.device.createTexture({
                size: { width, height, depthOrArrayLayers: 1 },
                format: format,
                usage: usage ?? (
                    GPUTextureUsage.TEXTURE_BINDING |
                    GPUTextureUsage.COPY_SRC |
                    GPUTextureUsage.COPY_DST |
                    GPUTextureUsage.RENDER_ATTACHMENT
                )
            });

            // WeakMapにメタ情報を保存
            try {
                this._textureSizeMap.set(texture, { width, height, format });
            } catch (e) {
                // WeakMap失敗時はlabelにフォールバック
                try {
                    texture.label = `w:${width},h:${height},f:${format}`;
                } catch (ee) {
                    console.warn('[TextureBridge] Failed to store texture metadata');
                }
            }

            return texture;
        }

        /**
         * 🔥 Phase C-0: 外部生成テクスチャのメタ登録用
         */
        registerTextureMeta(gpuTexture, { width, height, format } = {}) {
            if (!gpuTexture) return;
            
            try {
                this._textureSizeMap.set(gpuTexture, { width, height, format });
            } catch (e) {
                console.warn('[TextureBridge] Failed to register texture metadata');
            }
        }

        /**
         * 🔥 Phase C-0: 安全なサイズ取得（複数フォールバック）
         */
        _getTextureSize(gpuTexture) {
            if (!gpuTexture) return null;

            // 1. 標準プロパティ試行
            const w = gpuTexture.width ?? gpuTexture.size?.width ?? gpuTexture._width;
            const h = gpuTexture.height ?? gpuTexture.size?.height ?? gpuTexture._height;
            
            if (Number.isFinite(w) && Number.isFinite(h)) {
                return { width: Number(w), height: Number(h) };
            }

            // 2. WeakMapメタ試行
            const meta = this._textureSizeMap.get(gpuTexture);
            if (meta) {
                return { width: meta.width, height: meta.height, format: meta.format };
            }

            // 3. labelパース試行（最終手段）
            if (gpuTexture.label) {
                const m = (''+gpuTexture.label).match(/w:(\d+),h:(\d+)(?:,f:(\w+))?/);
                if (m) {
                    return { 
                        width: Number(m[1]), 
                        height: Number(m[2]), 
                        format: m[3] ?? undefined 
                    };
                }
            }

            return null;
        }

        _calculateBytesPerRow(width) {
            const bytesPerPixel = 4;
            const unalignedBytesPerRow = width * bytesPerPixel;
            const alignment = 256;
            return Math.ceil(unalignedBytesPerRow / alignment) * alignment;
        }

        /**
         * 🔥 Phase C-0: 毎回新規buffer作成（mapAsync競合回避）
         */
        _createStagingBuffer(byteSize) {
            return this.device.createBuffer({
                size: byteSize,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
            });
        }

        /**
         * 🔥 Phase C-0: メインAPI - GPUTexture → Pixi.Sprite
         * requestedWidth/Height がnullの場合はメタから回収
         */
        async createSpriteFromGPUTexture(gpuTexture, requestedWidth = null, requestedHeight = null) {
            if (!this.initialized) {
                await this.initialize();
            }

            // サイズメタ取得
            const sizeMeta = this._getTextureSize(gpuTexture);
            const width = requestedWidth ?? sizeMeta?.width;
            const height = requestedHeight ?? sizeMeta?.height;

            if (!width || !height) {
                console.warn('[TextureBridge] Unknown texture size, attempting fallback', {
                    requestedWidth,
                    requestedHeight,
                    meta: sizeMeta
                });
                throw new Error('[TextureBridge] Cannot determine texture size');
            }

            // サイズ不一致を警告のみ（例外を投げない）
            if (sizeMeta && (sizeMeta.width !== width || sizeMeta.height !== height)) {
                console.warn('[TextureBridge] Size mismatch (non-fatal):', {
                    meta: `${sizeMeta.width}x${sizeMeta.height}`,
                    requested: `${width}x${height}`
                });
            }

            try {
                const bytesPerRow = this._calculateBytesPerRow(width);
                const bufferSize = bytesPerRow * height;

                // 🔥 毎回新規buffer作成
                const stagingBuffer = this._createStagingBuffer(bufferSize);

                const commandEncoder = this.device.createCommandEncoder();

                commandEncoder.copyTextureToBuffer(
                    { 
                        texture: gpuTexture,
                        mipLevel: 0,
                        origin: { x: 0, y: 0, z: 0 }
                    },
                    { 
                        buffer: stagingBuffer,
                        offset: 0,
                        bytesPerRow: bytesPerRow,
                        rowsPerImage: height
                    },
                    { 
                        width: width,
                        height: height,
                        depthOrArrayLayers: 1
                    }
                );

                this.queue.submit([commandEncoder.finish()]);

                await stagingBuffer.mapAsync(GPUMapMode.READ);
                const mappedData = new Uint8Array(stagingBuffer.getMappedRange(0, bufferSize));
                
                // 🔥 Tightly-packed ImageData生成（row-by-row copy）
                const imageBytes = new Uint8ClampedArray(width * height * 4);
                for (let row = 0; row < height; row++) {
                    const srcOffset = row * bytesPerRow;
                    const dstOffset = row * width * 4;
                    const src = new Uint8Array(mappedData.buffer, mappedData.byteOffset + srcOffset, width * 4);
                    imageBytes.set(src, dstOffset);
                }
                
                stagingBuffer.unmap();
                stagingBuffer.destroy(); // 🔥 即座に破棄

                const imageData = new ImageData(imageBytes, width, height);
                const bitmap = await createImageBitmap(imageData);
                
                const texture = PIXI.Texture.from(bitmap, {
                    scaleMode: 'linear',
                    mipmap: 'off',
                    width: width,
                    height: height
                });

                const sprite = new PIXI.Sprite(texture);
                sprite.width = width;
                sprite.height = height;

                return sprite;

            } catch (error) {
                console.error('❌ [TextureBridge] Sprite creation failed:', error);
                throw error;
            }
        }

        /**
         * Pixi.Textureのみ返す（Sprite不要時）
         */
        async createPixiTextureFromGPU(gpuTexture, width = null, height = null) {
            const sprite = await this.createSpriteFromGPUTexture(gpuTexture, width, height);
            return sprite.texture;
        }

        /**
         * Legacy: SDF Float配列 → Pixi.Texture
         */
        async sdfToPixiTexture(sdfData, width, height, colorSettings = null) {
            if (!sdfData || sdfData.length !== width * height) {
                throw new Error('[TextureBridge] Invalid SDF data');
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
         * Legacy: MSDF Float配列 → Pixi.Texture
         */
        async msdfToPixiTexture(msdfData, width, height) {
            if (!msdfData || msdfData.length !== width * height * 4) {
                throw new Error('[TextureBridge] Invalid MSDF data');
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

        destroy() {
            this._textureSizeMap = new WeakMap();
            this.device = null;
            this.queue = null;
            this.initialized = false;
        }
    }

    // 🔥 シングルトンインスタンス生成（Phase C-0）
    window.WebGPUTextureBridge = new WebGPUTextureBridge();

})();