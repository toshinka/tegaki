/**
 * ================================================================================
 * webgpu-texture-bridge.js - Phase 2完全版 (自動初期化対応)
 * ================================================================================
 * 
 * 【責務】
 * - GPUTexture → PixiJS Texture変換（Canvas2D不使用）
 * - SDF/MSDF データ → PixiJS Texture変換
 * - 自動初期化・グローバル公開
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
            this.texturePool = new Map();
            this.maxPoolSize = 50;
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
         * GPUTexture → PixiJS Texture（Canvas2D不使用）
         */
        async createPixiTextureFromGPU(gpuTexture, width, height) {
            if (!this.initialized) {
                await this.initialize();
            }

            try {
                // 1. GPUTexture → GPUBuffer (読み出し)
                const bufferSize = width * height * 4; // RGBA8
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
                        bytesPerRow: width * 4,
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
                const pixels = new Uint8ClampedArray(arrayBuffer.slice(0));
                stagingBuffer.unmap();
                stagingBuffer.destroy();

                // 3. ImageData → ImageBitmap（Canvas2D不使用）
                const imageData = new ImageData(pixels, width, height);
                const bitmap = await createImageBitmap(imageData);

                // 4. ImageBitmap → PixiJS Texture
                const baseTexture = PIXI.BaseTexture.from(bitmap, {
                    scaleMode: PIXI.SCALE_MODES.LINEAR,
                    mipmap: PIXI.MIPMAP_MODES.OFF,
                    width: width,
                    height: height
                });

                return new PIXI.Texture(baseTexture);

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

            const baseTexture = PIXI.BaseTexture.from(bitmap, {
                scaleMode: PIXI.SCALE_MODES.LINEAR,
                mipmap: PIXI.MIPMAP_MODES.OFF,
                width: width,
                height: height
            });

            return new PIXI.Texture(baseTexture);
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

            const baseTexture = PIXI.BaseTexture.from(bitmap, {
                scaleMode: PIXI.SCALE_MODES.LINEAR,
                mipmap: PIXI.MIPMAP_MODES.OFF,
                width: width,
                height: height
            });

            return new PIXI.Texture(baseTexture);
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

        /**
         * テクスチャプール管理
         */
        getPooledTexture(width, height) {
            const key = `${width}x${height}`;
            const pool = this.texturePool.get(key);
            
            if (pool && pool.length > 0) {
                return pool.pop();
            }
            
            return this.createGPUTexture(width, height);
        }

        releaseTexture(texture, width, height) {
            const key = `${width}x${height}`;
            
            if (!this.texturePool.has(key)) {
                this.texturePool.set(key, []);
            }
            
            const pool = this.texturePool.get(key);
            
            if (pool.length < this.maxPoolSize) {
                pool.push(texture);
            } else {
                texture.destroy();
            }
        }

        clearPool() {
            for (const [key, pool] of this.texturePool) {
                for (const texture of pool) {
                    texture.destroy();
                }
            }
            this.texturePool.clear();
        }

        destroy() {
            this.clearPool();
            this.device = null;
            this.queue = null;
            this.initialized = false;
        }
    }

    // グローバル公開
    if (!window.webgpuTextureBridge) {
        window.webgpuTextureBridge = new WebGPUTextureBridge();
    }

    console.log('✅ webgpu-texture-bridge.js (Phase 2完全版) loaded');
    console.log('   🔧 Canvas2D完全削除');
    console.log('   🔧 自動インスタンス化');

})();