/**
 * WebGPUTextureBridge - WebGPU ↔ PixiJS Texture変換
 * Phase 4-A-3 + 4-B-4: SDF/MSDF Texture統合
 * 
 * 責務:
 * - WebGPU Compute結果 → PixiJS Texture変換
 * - SDF (単チャンネル) / MSDF (RGBチャンネル) 対応
 */

(function() {
    'use strict';

    class WebGPUTextureBridge {
        constructor(webgpuLayer) {
            this.webgpuLayer = webgpuLayer;
            this.device = webgpuLayer.device;
        }

        /**
         * SDF Float32Array → PixiJS Texture (シングルチャンネル)
         * @param {Float32Array} sdfData - 距離場データ
         * @param {number} width
         * @param {number} height
         * @returns {PIXI.Texture}
         */
        async sdfToPixiTexture(sdfData, width, height) {
            if (!sdfData || sdfData.length !== width * height) {
                throw new Error('[TextureBridge] Invalid SDF data');
            }

            // Float32 → Uint8 変換（グレースケール）
            const pixelData = new Uint8Array(width * height * 4);
            
            for (let i = 0; i < sdfData.length; i++) {
                const value = Math.floor(sdfData[i] * 255);
                const idx = i * 4;
                pixelData[idx] = value;     // R
                pixelData[idx + 1] = value; // G
                pixelData[idx + 2] = value; // B
                pixelData[idx + 3] = 255;   // A
            }

            // PixiJS Texture作成
            const resource = new PIXI.BufferResource(pixelData, {
                width: width,
                height: height
            });

            const baseTexture = new PIXI.BaseTexture(resource, {
                width: width,
                height: height,
                format: PIXI.FORMATS.RGBA,
                type: PIXI.TYPES.UNSIGNED_BYTE
            });

            return new PIXI.Texture(baseTexture);
        }

        /**
         * MSDF Float32Array → PixiJS Texture (RGB 3チャンネル)
         * @param {Float32Array} msdfData - RGBA距離場データ
         * @param {number} width
         * @param {number} height
         * @returns {PIXI.Texture}
         */
        async msdfToPixiTexture(msdfData, width, height) {
            if (!msdfData || msdfData.length !== width * height * 4) {
                throw new Error('[TextureBridge] Invalid MSDF data');
            }

            // Float32 → Uint8 変換（RGBAそのまま）
            const pixelData = new Uint8Array(width * height * 4);
            
            for (let i = 0; i < msdfData.length; i++) {
                pixelData[i] = Math.floor(Math.max(0, Math.min(1, msdfData[i])) * 255);
            }

            // PixiJS Texture作成
            const resource = new PIXI.BufferResource(pixelData, {
                width: width,
                height: height
            });

            const baseTexture = new PIXI.BaseTexture(resource, {
                width: width,
                height: height,
                format: PIXI.FORMATS.RGBA,
                type: PIXI.TYPES.UNSIGNED_BYTE
            });

            return new PIXI.Texture(baseTexture);
        }

        /**
         * PixiJS Texture → WebGPU Texture変換（将来の拡張用）
         */
        async pixiToWebGPU(pixiTexture) {
            throw new Error('Not implemented yet');
        }

        /**
         * ImageBitmapからWebGPU Texture作成（将来の拡張用）
         */
        createTextureFromImageBitmap(imageBitmap) {
            const texture = this.device.createTexture({
                size: {
                    width: imageBitmap.width,
                    height: imageBitmap.height
                },
                format: 'rgba8unorm',
                usage: GPUTextureUsage.TEXTURE_BINDING | 
                       GPUTextureUsage.COPY_DST | 
                       GPUTextureUsage.RENDER_ATTACHMENT
            });

            this.device.queue.copyExternalImageToTexture(
                { source: imageBitmap },
                { texture: texture },
                {
                    width: imageBitmap.width,
                    height: imageBitmap.height
                }
            );

            return texture;
        }
    }

    window.WebGPUTextureBridge = WebGPUTextureBridge;

})();