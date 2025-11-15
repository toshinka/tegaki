/**
 * ================================================================================
 * webgpu-texture-bridge.js - Phase 5: Size Validation Complete
 * ================================================================================
 * 
 * 【責務】
 * - GPUTexture → PIXI.Sprite 変換（CopyTextureToBuffer経由）
 * - サイズ不一致の厳格な検証とエラー通知
 * 
 * 【親依存】
 * - webgpu-drawing-layer.js: device/queue取得
 * - msdf-pipeline-manager.js: GPUTexture生成元
 * 
 * 【子依存】
 * - なし（ピュア変換処理）
 * 
 * 【改修履歴】
 * - Phase 1-4: 基本実装・bytesPerRow対応
 * - Phase 5: GPUTexture実サイズとcopySize一致検証追加（CopyTextureToBuffer問題根絶）
 * ================================================================================
 */

(function() {
    'use strict';

    class WebGPUTextureBridge {
        constructor() {
            this.device = null;
            this.queue = null;
            this.initialized = false;
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
                console.log('✅ [WebGPUTextureBridge] Phase 5: Size Validation完全版');
                return true;

            } catch (error) {
                console.error('❌ [WebGPUTextureBridge] Initialization failed:', error);
                return false;
            }
        }

        _calculateBytesPerRow(width) {
            const bytesPerPixel = 4;
            const unalignedBytesPerRow = width * bytesPerPixel;
            const alignment = 256;
            return Math.ceil(unalignedBytesPerRow / alignment) * alignment;
        }

        /**
         * 🔥 Phase 5: GPUTexture実サイズ検証追加
         */
        async createSpriteFromGPUTexture(gpuTexture, requestedWidth, requestedHeight) {
            if (!this.initialized) {
                await this.initialize();
            }

            if (!gpuTexture || gpuTexture.width === undefined) {
                throw new Error('[TextureBridge] Invalid GPUTexture provided');
            }

            // 🔥 Phase 5: サイズ厳格検証
            const actualWidth = gpuTexture.width;
            const actualHeight = gpuTexture.height;
            
            if (actualWidth !== requestedWidth || actualHeight !== requestedHeight) {
                console.error('[TextureBridge] Size mismatch detected:', {
                    gpuTexture: `${actualWidth}x${actualHeight}`,
                    requested: `${requestedWidth}x${requestedHeight}`,
                    difference: {
                        width: requestedWidth - actualWidth,
                        height: requestedHeight - actualHeight
                    }
                });
                
                throw new Error(
                    `[TextureBridge] CRITICAL: CopyTextureToBuffer size mismatch - ` +
                    `GPUTexture=${actualWidth}x${actualHeight}, ` +
                    `Requested=${requestedWidth}x${requestedHeight}. ` +
                    `This would cause "touches outside of texture" error.`
                );
            }

            try {
                // 🔥 実サイズ使用（厳密一致保証）
                const width = actualWidth;
                const height = actualHeight;

                const bytesPerRow = this._calculateBytesPerRow(width);
                const bufferSize = bytesPerRow * height;

                const stagingBuffer = this.device.createBuffer({
                    size: bufferSize,
                    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
                });

                const commandEncoder = this.device.createCommandEncoder();

                commandEncoder.copyTextureToBuffer(
                    { 
                        texture: gpuTexture,
                        mipLevel: 0,
                        origin: { x: 0, y: 0, z: 0 }
                    },
                    { 
                        buffer: stagingBuffer,
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
                const arrayBuffer = stagingBuffer.getMappedRange();
                
                const pixels = new Uint8ClampedArray(width * height * 4);
                const mappedData = new Uint8ClampedArray(arrayBuffer);
                
                for (let y = 0; y < height; y++) {
                    const srcOffset = y * bytesPerRow;
                    const dstOffset = y * width * 4;
                    const rowBytes = width * 4;
                    
                    for (let i = 0; i < rowBytes; i++) {
                        pixels[dstOffset + i] = mappedData[srcOffset + i];
                    }
                }
                
                stagingBuffer.unmap();
                stagingBuffer.destroy();

                const imageData = new ImageData(pixels, width, height);
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

        async createPixiTextureFromGPU(gpuTexture, width, height) {
            const sprite = await this.createSpriteFromGPUTexture(gpuTexture, width, height);
            return sprite.texture;
        }

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

        createGPUTexture(width, height, format = 'rgba8unorm') {
            if (!this.initialized) {
                throw new Error('[TextureBridge] Not initialized');
            }

            return this.device.createTexture({
                size: { width, height, depthOrArrayLayers: 1 },
                format: format,
                usage: GPUTextureUsage.TEXTURE_BINDING |
                       GPUTextureUsage.COPY_SRC |
                       GPUTextureUsage.COPY_DST |
                       GPUTextureUsage.RENDER_ATTACHMENT
            });
        }

        destroy() {
            this.device = null;
            this.queue = null;
            this.initialized = false;
        }
    }

    // 🔥 シングルトンインスタンス生成（Phase 5）
    window.WebGPUTextureBridge = new WebGPUTextureBridge();

})();