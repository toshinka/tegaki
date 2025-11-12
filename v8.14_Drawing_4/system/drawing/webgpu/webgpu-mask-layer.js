/**
 * ================================================================================
 * system/drawing/webgpu/webgpu-mask-layer.js - Phase 2 GPU完全版
 * ================================================================================
 * 
 * 【責務】
 * ペン/消しゴム/塗りの統合マスクレイヤー管理（GPU Compute版）
 * 
 * 【依存Parents】
 * - webgpu-drawing-layer.js (GPUDevice/Queue)
 * - polygon-generator.js (ポリゴン入力)
 * 
 * 【依存Children】
 * - stroke-renderer.js (マスク参照描画)
 * - fill-tool.js (Phase 4で使用予定)
 * 
 * 【処理フロー】
 * ポリゴン → GPU Compute Shaderでラスタライズ → マスクテクスチャ更新
 * ペン: マスク加算 (mask += 1.0)
 * 消しゴム: マスク減算 (mask -= 1.0, clamp(0,1))
 * 
 * ================================================================================
 */

(function() {
    'use strict';

    class WebGPUMaskLayer {
        constructor(webgpuLayer) {
            this.webgpuLayer = webgpuLayer;
            this.device = null;
            this.queue = null;
            
            this.width = 0;
            this.height = 0;
            this.maskTexture = null;
            this.maskBuffer = null;
            
            this.polygonPipeline = null;
            this.compositePipeline = null;
            this.bindGroupLayout = null;
            
            this.initialized = false;
        }

        /**
         * 初期化
         */
        async initialize(width, height) {
            if (!this.webgpuLayer || !this.webgpuLayer.isInitialized()) {
                console.error('[WebGPUMaskLayer] WebGPU not available');
                return false;
            }

            this.device = this.webgpuLayer.getDevice();
            this.queue = this.webgpuLayer.getQueue();
            
            if (!this.device) {
                console.error('[WebGPUMaskLayer] GPUDevice not available');
                return false;
            }

            this.width = width;
            this.height = height;
            
            // GPUバッファ/テクスチャ作成
            await this._createMaskTexture();
            await this._initializePipeline();
            
            this.initialized = true;
            console.log(`✅ [WebGPUMaskLayer] GPU版初期化完了 ${width}x${height}`);
            
            return true;
        }

        /**
         * マスクテクスチャ作成
         * @private
         */
        async _createMaskTexture() {
            this.maskTexture = this.device.createTexture({
                label: 'Mask Texture',
                size: { width: this.width, height: this.height },
                format: 'r32float',
                usage: GPUTextureUsage.STORAGE_BINDING | 
                       GPUTextureUsage.TEXTURE_BINDING | 
                       GPUTextureUsage.COPY_SRC
            });

            // CPU側バッファ（フォールバック・デバッグ用）
            this.maskBuffer = new Float32Array(this.width * this.height);
            this.maskBuffer.fill(0.0);
        }

        /**
         * Compute Pipeline初期化
         * @private
         */
        async _initializePipeline() {
            const shaderCode = this._getPolygonShaderCode();
            
            const shaderModule = this.device.createShaderModule({
                label: 'Polygon Mask Shader',
                code: shaderCode
            });

            this.bindGroupLayout = this.device.createBindGroupLayout({
                label: 'Mask Bind Group Layout',
                entries: [
                    { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // polygon
                    { binding: 1, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'read-write', format: 'r32float' } }, // mask
                    { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } } // params
                ]
            });

            const pipelineLayout = this.device.createPipelineLayout({
                label: 'Mask Pipeline Layout',
                bindGroupLayouts: [this.bindGroupLayout]
            });

            this.polygonPipeline = this.device.createComputePipeline({
                label: 'Polygon Mask Pipeline',
                layout: pipelineLayout,
                compute: { module: shaderModule, entryPoint: 'main' }
            });
        }

        /**
         * ポリゴンマスクシェーダーコード
         * @private
         */
        _getPolygonShaderCode() {
            return `
struct MaskParams {
    width: u32,
    height: u32,
    polygonCount: u32,
    mode: u32, // 0=add, 1=subtract
}

@group(0) @binding(0) var<storage, read> polygon: array<vec2f>;
@group(0) @binding(1) var mask_texture: texture_storage_2d<r32float, read_write>;
@group(0) @binding(2) var<uniform> params: MaskParams;

// Ray Casting Algorithm: 点がポリゴン内にあるか判定
fn isPointInPolygon(point: vec2f, polyCount: u32) -> bool {
    var inside = false;
    var j = polyCount - 1u;
    
    for (var i = 0u; i < polyCount; i++) {
        let pi = polygon[i];
        let pj = polygon[j];
        
        if ((pi.y > point.y) != (pj.y > point.y)) {
            let intersectX = (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x;
            if (point.x < intersectX) {
                inside = !inside;
            }
        }
        
        j = i;
    }
    
    return inside;
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x >= params.width || id.y >= params.height) {
        return;
    }

    let coord = vec2<i32>(i32(id.x), i32(id.y));
    let point = vec2f(f32(id.x), f32(id.y));
    
    // ポリゴン内外判定
    if (isPointInPolygon(point, params.polygonCount)) {
        let currentMask = textureLoad(mask_texture, coord).r;
        var newMask: f32;
        
        // モード: 0=add, 1=subtract
        if (params.mode == 0u) {
            newMask = min(currentMask + 1.0, 1.0);
        } else {
            newMask = max(currentMask - 1.0, 0.0);
        }
        
        textureStore(mask_texture, coord, vec4f(newMask, 0.0, 0.0, 0.0));
    }
}
            `;
        }

        /**
         * 初期化状態確認
         */
        isInitialized() {
            return this.initialized;
        }

        /**
         * ポリゴンをマスクに追加/減算（GPU版）
         * @param {Array} polygon - [[x,y], [x,y], ...]
         * @param {string} mode - 'add' | 'subtract'
         */
        async addPolygonToMask(polygon, mode = 'add') {
            if (!this.initialized) {
                console.warn('[WebGPUMaskLayer] Not initialized');
                return false;
            }

            if (!polygon || polygon.length < 3) {
                return false;
            }

            try {
                // GPU Computeで処理
                await this._runPolygonShader(polygon, mode);
                return true;
            } catch (error) {
                console.error('[WebGPUMaskLayer] GPU polygon processing failed:', error);
                // フォールバック: CPU処理
                return this._rasterizePolygonCPU(polygon, mode);
            }
        }

        /**
         * GPU Compute Shader実行
         * @private
         */
        async _runPolygonShader(polygon, mode) {
            // ポリゴンデータをGPUバッファに転送
            const polygonData = new Float32Array(polygon.length * 2);
            for (let i = 0; i < polygon.length; i++) {
                polygonData[i * 2] = polygon[i][0];
                polygonData[i * 2 + 1] = polygon[i][1];
            }

            const polygonBuffer = this.device.createBuffer({
                label: 'Polygon Buffer',
                size: polygonData.byteLength,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
            });
            this.device.queue.writeBuffer(polygonBuffer, 0, polygonData);

            // パラメータバッファ
            const paramsData = new Uint32Array([
                this.width,
                this.height,
                polygon.length,
                mode === 'subtract' ? 1 : 0
            ]);

            const paramsBuffer = this.device.createBuffer({
                label: 'Mask Params Buffer',
                size: 16,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
            this.device.queue.writeBuffer(paramsBuffer, 0, paramsData);

            // BindGroup作成
            const bindGroup = this.device.createBindGroup({
                label: 'Mask Bind Group',
                layout: this.bindGroupLayout,
                entries: [
                    { binding: 0, resource: { buffer: polygonBuffer } },
                    { binding: 1, resource: this.maskTexture.createView() },
                    { binding: 2, resource: { buffer: paramsBuffer } }
                ]
            });

            // Compute Pass実行
            const commandEncoder = this.device.createCommandEncoder({ label: 'Mask Compute Encoder' });
            const passEncoder = commandEncoder.beginComputePass({ label: 'Mask Compute Pass' });

            passEncoder.setPipeline(this.polygonPipeline);
            passEncoder.setBindGroup(0, bindGroup);
            
            const workgroupX = Math.ceil(this.width / 8);
            const workgroupY = Math.ceil(this.height / 8);
            passEncoder.dispatchWorkgroups(workgroupX, workgroupY, 1);
            passEncoder.end();

            this.device.queue.submit([commandEncoder.finish()]);

            // クリーンアップ
            polygonBuffer.destroy();
            paramsBuffer.destroy();
        }

        /**
         * CPU版フォールバック（前回作成したもの）
         * @private
         */
        _rasterizePolygonCPU(polygon, mode) {
            const value = mode === 'subtract' ? -1.0 : 1.0;
            
            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;
            
            for (const p of polygon) {
                minX = Math.min(minX, p[0]);
                minY = Math.min(minY, p[1]);
                maxX = Math.max(maxX, p[0]);
                maxY = Math.max(maxY, p[1]);
            }
            
            minX = Math.max(0, Math.floor(minX));
            minY = Math.max(0, Math.floor(minY));
            maxX = Math.min(this.width - 1, Math.ceil(maxX));
            maxY = Math.min(this.height - 1, Math.ceil(maxY));
            
            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    if (this._isPointInPolygon(x, y, polygon)) {
                        const index = y * this.width + x;
                        this.maskBuffer[index] += value;
                        this.maskBuffer[index] = Math.max(0.0, Math.min(1.0, this.maskBuffer[index]));
                    }
                }
            }

            return true;
        }

        /**
         * Ray Casting Algorithm（CPU版）
         * @private
         */
        _isPointInPolygon(x, y, polygon) {
            let inside = false;
            const n = polygon.length;
            
            for (let i = 0, j = n - 1; i < n; j = i++) {
                const xi = polygon[i][0];
                const yi = polygon[i][1];
                const xj = polygon[j][0];
                const yj = polygon[j][1];
                
                const intersect = ((yi > y) !== (yj > y)) &&
                    (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                
                if (intersect) {
                    inside = !inside;
                }
            }
            
            return inside;
        }

        /**
         * マスクテクスチャ取得
         */
        getMaskTexture() {
            return this.maskTexture;
        }

        /**
         * マスククリア
         */
        async clear() {
            if (this.maskBuffer) {
                this.maskBuffer.fill(0.0);
            }
            
            // GPU側もクリア
            if (this.maskTexture) {
                await this._createMaskTexture();
            }
        }

        /**
         * リサイズ
         */
        async resize(width, height) {
            this.width = width;
            this.height = height;
            
            await this._createMaskTexture();
            
            console.log(`✅ [WebGPUMaskLayer] Resized to ${width}x${height}`);
            return true;
        }

        /**
         * 破棄
         */
        destroy() {
            if (this.maskTexture) {
                this.maskTexture.destroy();
            }
            this.maskBuffer = null;
            this.initialized = false;
        }
    }

    window.WebGPUMaskLayer = WebGPUMaskLayer;

    console.log('✅ webgpu-mask-layer.js (Phase 2 GPU完全版) loaded');
    console.log('   ✓ GPU Compute Shaderでポリゴンラスタライズ');
    console.log('   ✓ マスク加算/減算');
    console.log('   ✓ CPU版フォールバック対応');

})();