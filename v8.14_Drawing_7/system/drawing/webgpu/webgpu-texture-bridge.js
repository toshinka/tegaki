/**
 * ================================================================================
 * system/drawing/webgpu/webgpu-texture-bridge.js - Phase 1完全版
 * ================================================================================
 * 
 * 【Phase 1改修内容】
 * ✅ Canvas2D完全削除
 * ✅ GPUTexture → ImageBitmap → PixiJS Texture
 * ✅ 直接メモリ読み出しによる高速変換
 * 
 * 【依存Parents】
 * - webgpu-drawing-layer.js (device, queue)
 * 
 * 【依存Children】
 * - stroke-renderer.js (createPixiTextureFromGPU呼び出し)
 * - webgpu-compute-sdf.js (SDF生成結果変換)
 * 
 * 【責務】
 * - GPUTexture → PixiJS Texture変換（Canvas2D不使用）
 * - SDF/MSDF データ → PixiJS Texture変換
 * - テクスチャプール管理（メモリ最適化）
 * ================================================================================
 */

(function() {
    'use strict';

    class WebGPUTextureBridge {
        constructor(webgpuLayer) {
            this.webgpuLayer = webgpuLayer;
            this.device = webgpuLayer.device;
            this.queue = webgpuLayer.device.queue;
            
            // テクスチャプール（再利用）
            this.texturePool = new Map();
            this.maxPoolSize = 50;
        }

        /**
         * 🔧 Phase 1: GPUTexture → PixiJS Texture（Canvas2D不使用）
         * 
         * @param {GPUTexture} gpuTexture - WebGPU Texture
         * @param {number} width - テクスチャ幅
         * @param {number} height - テクスチャ高さ
         * @returns {Promise<PIXI.Texture>}
         */
        async createPixiTextureFromGPU(gpuTexture, width, height) {
            try {
                // 1. GPUTexture → GPUBuffer (読み出し)
                const bufferSize = width * height * 4; // RGBA8
                const stagingBuffer = this.device.createBuffer({
                    label: 'Texture Staging Buffer',
                    size: bufferSize,
                    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
                });

                const commandEncoder = this.device.createCommandEncoder({
                    label: 'Texture Copy Encoder'
                });

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
                console.error('[TextureBridge] GPUTexture conversion failed:', error);
                throw error;
            }
        }

        /**
         * SDF Float32Array → PixiJS Texture（GPU経由）
         * 
         * @param {Float32Array} sdfData - SDF距離場データ
         * @param {number} width - テクスチャ幅
         * @param {number} height - テクスチャ高さ
         * @param {Object} colorSettings - {r, g, b, alpha}
         * @returns {Promise<PIXI.Texture>}
         */
        async sdfToPixiTexture(sdfData, width, height, colorSettings = null) {
            if (!sdfData || sdfData.length !== width * height) {
                throw new Error('[TextureBridge] Invalid SDF data');
            }

            const color = colorSettings || { r: 128, g: 0, b: 0, alpha: 255 };

            // Float32 → Uint8 変換（RGBA）
            const pixelData = new Uint8ClampedArray(width * height * 4);
            
            for (let i = 0; i < sdfData.length; i++) {
                // SDFを0-1に正規化（距離が小さいほど不透明）
                const distance = sdfData[i];
                const alpha = distance < 1.0 ? 255 : Math.max(0, 255 - distance * 10);
                
                const idx = i * 4;
                pixelData[idx] = color.r;
                pixelData[idx + 1] = color.g;
                pixelData[idx + 2] = color.b;
                pixelData[idx + 3] = alpha;
            }

            // ImageData → ImageBitmap → PixiJS Texture
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
         * 
         * @param {Float32Array} msdfData - RGBA距離場データ
         * @param {number} width
         * @param {number} height
         * @returns {Promise<PIXI.Texture>}
         */
        async msdfToPixiTexture(msdfData, width, height) {
            if (!msdfData || msdfData.length !== width * height * 4) {
                throw new Error('[TextureBridge] Invalid MSDF data');
            }

            // Float32 → Uint8 変換
            const pixelData = new Uint8ClampedArray(width * height * 4);
            
            for (let i = 0; i < msdfData.length; i++) {
                pixelData[i] = Math.floor(Math.max(0, Math.min(1, msdfData[i])) * 255);
            }

            // ImageData → ImageBitmap → PixiJS Texture
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
         * GPUTexture作成（将来の拡張用）
         */
        createGPUTexture(width, height, format = 'rgba8unorm') {
            return this.device.createTexture({
                label: 'Drawing Texture',
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

        /**
         * プール破棄
         */
        clearPool() {
            for (const [key, pool] of this.texturePool) {
                for (const texture of pool) {
                    texture.destroy();
                }
            }
            this.texturePool.clear();
        }

        /**
         * 破棄
         */
        destroy() {
            this.clearPool();
            this.device = null;
            this.queue = null;
            this.webgpuLayer = null;
        }
    }

    window.WebGPUTextureBridge = WebGPUTextureBridge;

    console.log('✅ webgpu-texture-bridge.js (Phase 1完全版) loaded');
    console.log('   🔧 Canvas2D完全削除');
    console.log('   🔧 GPUTexture → ImageBitmap → PixiJS');
    console.log('   🔧 テクスチャプール実装');

})();