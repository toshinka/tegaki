/**
 * ================================================================================
 * system/drawing/webgpu/webgpu-texture-bridge.js
 * Phase 4: 命名統一・Sprite生成統合版
 * ================================================================================
 * 
 * 【責務】
 * - GPUTexture → PixiJS Sprite変換（Canvas2D不使用）
 * - PixiJS v8 API対応（BaseTexture廃止）
 * - bytesPerRow 256バイト境界要件対応
 * 
 * 【依存Parents】
 * - webgpu-drawing-layer.js (device, queue)
 * 
 * 【依存Children】
 * - stroke-renderer.js (createSpriteFromGPUTexture呼び出し)
 * 
 * 【Phase 4改修】
 * ✅ グローバルシンボル統一: WebGPUTextureBridge (大文字)
 * ✅ Sprite生成統合: createSpriteFromGPUTexture()
 * ✅ bytesPerRow パディング処理完全対応
 * 
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
                console.log('✅ [WebGPUTextureBridge] Phase 4完全版');
                return true;

            } catch (error) {
                console.error('❌ [WebGPUTextureBridge] Initialization failed:', error);
                return false;
            }
        }

        /**
         * bytesPerRowを256バイト境界にアライメント
         */
        _calculateBytesPerRow(width) {
            const bytesPerPixel = 4; // RGBA8
            const unalignedBytesPerRow = width * bytesPerPixel;
            const alignment = 256;
            return Math.ceil(unalignedBytesPerRow / alignment) * alignment;
        }

        /**
         * ✅ GPUTexture → PixiJS Sprite（完全統合版）
         */
        async createSpriteFromGPUTexture(gpuTexture, width, height) {
            if (!this.initialized) {
                await this.initialize();
            }

            try {
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

                // GPUBuffer → ArrayBuffer
                await stagingBuffer.mapAsync(GPUMapMode.READ);
                const arrayBuffer = stagingBuffer.getMappedRange();
                
                // パディング除去
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

                // ImageData → ImageBitmap → PixiJS Texture
                const imageData = new ImageData(pixels, width, height);
                const bitmap = await createImageBitmap(imageData);
                
                const texture = PIXI.Texture.from(bitmap, {
                    scaleMode: 'linear',
                    mipmap: 'off',
                    width: width,
                    height: height
                });

                // Sprite生成
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
         * GPUTexture → PixiJS Texture（下位互換用）
         */
        async createPixiTextureFromGPU(gpuTexture, width, height) {
            const sprite = await this.createSpriteFromGPUTexture(gpuTexture, width, height);
            return sprite.texture;
        }

        /**
         * SDF Float32Array → PixiJS Texture
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
         * MSDF Float32Array → PixiJS Texture
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

        /**
         * GPUTexture作成
         */
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

    // グローバル公開（大文字統一）
    window.WebGPUTextureBridge = new WebGPUTextureBridge();

})();