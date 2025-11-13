/**
 * ================================================================================
 * webgpu-texture-bridge.js - Phase 3: PixiJS v8 + bytesPerRow修正版
 * ================================================================================
 * 
 * 【責務】
 * - GPUTexture → PixiJS Texture変換（Canvas2D不使用）
 * - PixiJS v8 API対応（BaseTexture廃止対応）
 * - bytesPerRow 256バイト境界要件対応
 * 
 * 【依存Parents】
 * - webgpu-drawing-layer.js (device, queue)
 * 
 * 【依存Children】
 * - stroke-renderer.js (createPixiTextureFromGPU呼び出し)
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

        /**
         * 初期化
         */
        async initialize() {
            if (this.initialized) return true;

            try {
                if (!window.webgpuDrawingLayer?.isInitialized()) {
                    throw new Error('WebGPUDrawingLayer not initialized');
                }

                this.device = window.webgpuDrawingLayer.getDevice();
                this.queue = window.webgpuDrawingLayer.getQueue();

                this.initialized = true;
                console.log('✅ [WebGPUTextureBridge] Initialized');
                return true;

            } catch (error) {
                console.error('[WebGPUTextureBridge] Initialization failed:', error);
                return false;
            }
        }

        /**
         * ✅ bytesPerRowを256バイト境界にアライメント
         */
        _calculateBytesPerRow(width) {
            const bytesPerPixel = 4; // RGBA8
            const unalignedBytesPerRow = width * bytesPerPixel;
            const alignment = 256;
            return Math.ceil(unalignedBytesPerRow / alignment) * alignment;
        }

        /**
         * ✅ GPUTexture → PixiJS Texture（PixiJS v8対応 + bytesPerRow修正）
         */
        async createPixiTextureFromGPU(gpuTexture, width, height) {
            if (!this.initialized) {
                await this.initialize();
            }

            try {
                // 1. ✅ bytesPerRowを256バイト境界に
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
                        bytesPerRow: bytesPerRow, // ✅ アライメント済み
                        rowsPerImage: height
                    },
                    { 
                        width: width,
                        height: height,
                        depthOrArrayLayers: 1
                    }
                );

                this.queue.submit([commandEncoder.finish()]);

                // 2. GPUBuffer → ArrayBuffer
                await stagingBuffer.mapAsync(GPUMapMode.READ);
                const arrayBuffer = stagingBuffer.getMappedRange();
                
                // 3. ✅ パディングを除去して実際のピクセルデータを抽出
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

                // 4. ✅ PixiJS v8 API: Texture.from() を使用
                const imageData = new ImageData(pixels, width, height);
                const bitmap = await createImageBitmap(imageData);
                
                // PixiJS v8: BaseTexture廃止、Texture.from()使用
                const texture = PIXI.Texture.from(bitmap, {
                    scaleMode: 'linear',
                    mipmap: 'off',
                    width: width,
                    height: height
                });

                return texture;

            } catch (error) {
                console.error('[TextureBridge] GPU conversion failed:', error);
                throw error;
            }
        }

        /**
         * SDF Float32Array → PixiJS Texture
         */
        async sdfToPixiTexture(sdfData, width, height, colorSettings = null) {
            if (!sdfData || sdfData.length !== width * height) {
                throw new Error('[TextureBridge] Invalid SDF data');
            }

            const color = colorSettings || { r: 128, g: 0, b: 0, alpha: 255 };

            // Float32 → Uint8 変換（RGBA）
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

    // グローバル公開
    if (!window.webgpuTextureBridge) {
        window.webgpuTextureBridge = new WebGPUTextureBridge();
    }

    console.log('✅ webgpu-texture-bridge.js (Phase 3: PixiJS v8 + bytesPerRow修正版) loaded');
    console.log('   🔧 PixiJS v8 API対応（BaseTexture廃止）');
    console.log('   🔧 bytesPerRow 256バイト境界要件対応');

})();