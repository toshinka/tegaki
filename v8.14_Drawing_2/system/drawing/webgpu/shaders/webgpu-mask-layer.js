/**
 * ================================================================================
 * system/drawing/webgpu/webgpu-mask-layer.js - Phase 2: GPUマスクレイヤー
 * ================================================================================
 * 
 * 【Phase 2 新規作成】
 * ✅ ペン/消しゴム/塗り統合マスクテクスチャ管理
 * ✅ ポリゴン→マスク変換パイプライン
 * ✅ マスク加算/減算/乗算
 * 
 * 【依存関係 - Parents】
 *   - webgpu-drawing-layer.js (GPUDevice/Queue)
 *   - shaders/mask-polygon.wgsl
 *   - shaders/mask-composite.wgsl
 * 
 * 【依存関係 - Children】
 *   - stroke-renderer.js (マスク参照)
 *   - fill-tool.js (FloodFill用)
 * 
 * 【責務】
 *   - マスクテクスチャ生成/管理
 *   - ポリゴン→マスク変換（GPU Compute）
 *   - マスク合成（add/subtract/multiply）
 * ================================================================================
 */

(function() {
    'use strict';

    class WebGPUMaskLayer {
        constructor(webgpuDrawingLayer) {
            this.webgpuLayer = webgpuDrawingLayer;
            this.device = null;
            this.queue = null;
            
            this.maskTexture = null;
            this.tempMaskTexture = null;
            this.width = 0;
            this.height = 0;
            
            this.polygonPipeline = null;
            this.compositePipeline = null;
            
            this.polygonShaderModule = null;
            this.compositeShaderModule = null;
            
            this._initialized = false;
        }

        async initialize(width, height) {
            if (this._initialized) {
                console.warn('[WebGPUMaskLayer] Already initialized');
                return;
            }

            if (!this.webgpuLayer || !this.webgpuLayer.isInitialized()) {
                throw new Error('[WebGPUMaskLayer] WebGPUDrawingLayer not initialized');
            }

            this.device = this.webgpuLayer.getDevice();
            this.queue = this.webgpuLayer.getQueue();
            this.width = width;
            this.height = height;

            await this._loadShaders();
            await this._createPipelines();
            await this._createMaskTextures();

            this._initialized = true;
            console.log(`✅ [WebGPUMaskLayer] Initialized (${width}x${height})`);
        }

        async _loadShaders() {
            const polygonShaderCode = await this._fetchShader('mask-polygon.wgsl');
            const compositeShaderCode = await this._fetchShader('mask-composite.wgsl');

            this.polygonShaderModule = this.device.createShaderModule({
                label: 'Mask Polygon Shader',
                code: polygonShaderCode
            });

            this.compositeShaderModule = this.device.createShaderModule({
                label: 'Mask Composite Shader',
                code: compositeShaderCode
            });
        }

        async _fetchShader(filename) {
            const response = await fetch(`system/drawing/webgpu/shaders/${filename}`);
            if (!response.ok) {
                throw new Error(`Failed to load shader: ${filename}`);
            }
            return await response.text();
        }

        async _createPipelines() {
            // ポリゴン→マスク変換パイプライン
            this.polygonPipeline = this.device.createComputePipeline({
                label: 'Polygon to Mask Pipeline',
                layout: 'auto',
                compute: {
                    module: this.polygonShaderModule,
                    entryPoint: 'main'
                }
            });

            // マスク合成パイプライン
            this.compositePipeline = this.device.createComputePipeline({
                label: 'Mask Composite Pipeline',
                layout: 'auto',
                compute: {
                    module: this.compositeShaderModule,
                    entryPoint: 'main'
                }
            });
        }

        async _createMaskTextures() {
            const textureDesc = {
                size: { width: this.width, height: this.height, depthOrArrayLayers: 1 },
                format: 'r32float',
                usage: GPUTextureUsage.STORAGE_BINDING | 
                       GPUTextureUsage.TEXTURE_BINDING |
                       GPUTextureUsage.COPY_SRC |
                       GPUTextureUsage.COPY_DST
            };

            this.maskTexture = this.device.createTexture({
                ...textureDesc,
                label: 'Main Mask Texture'
            });

            this.tempMaskTexture = this.device.createTexture({
                ...textureDesc,
                label: 'Temp Mask Texture'
            });

            // 初期化（全て0）
            await this.clear();
        }

        /**
         * ポリゴンをマスクに追加
         * @param {Array} polygon - [[x,y], [x,y], ...]
         * @param {string} mode - 'add'|'subtract'|'multiply'
         */
        async addPolygonToMask(polygon, mode = 'add') {
            if (!this._initialized) {
                throw new Error('[WebGPUMaskLayer] Not initialized');
            }

            if (!polygon || polygon.length < 3) {
                console.warn('[WebGPUMaskLayer] Invalid polygon');
                return;
            }

            // Step 1: ポリゴン→一時マスク生成
            await this._polygonToMask(polygon);

            // Step 2: 既存マスクと合成
            await this._compositeMasks(mode);
        }

        async _polygonToMask(polygon) {
            const maxPoints = 256;
            const pointCount = Math.min(polygon.length, maxPoints);

            // Uniform Buffer
            const uniformData = new Uint32Array([
                this.width,
                this.height,
                pointCount,
                0  // padding
            ]);

            const uniformBuffer = this.device.createBuffer({
                size: uniformData.byteLength,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
            this.queue.writeBuffer(uniformBuffer, 0, uniformData);

            // Polygon Storage Buffer
            const polygonData = new Float32Array(maxPoints * 2);
            for (let i = 0; i < pointCount; i++) {
                polygonData[i * 2] = polygon[i][0];
                polygonData[i * 2 + 1] = polygon[i][1];
            }

            const polygonBuffer = this.device.createBuffer({
                size: polygonData.byteLength,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
            });
            this.queue.writeBuffer(polygonBuffer, 0, polygonData);

            // Bind Group
            const bindGroup = this.device.createBindGroup({
                layout: this.polygonPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: uniformBuffer } },
                    { binding: 1, resource: { buffer: polygonBuffer } },
                    { binding: 2, resource: this.tempMaskTexture.createView() }
                ]
            });

            // Compute Pass
            const commandEncoder = this.device.createCommandEncoder();
            const passEncoder = commandEncoder.beginComputePass();
            
            passEncoder.setPipeline(this.polygonPipeline);
            passEncoder.setBindGroup(0, bindGroup);
            
            const workgroupsX = Math.ceil(this.width / 8);
            const workgroupsY = Math.ceil(this.height / 8);
            passEncoder.dispatchWorkgroups(workgroupsX, workgroupsY, 1);
            
            passEncoder.end();
            
            this.queue.submit([commandEncoder.finish()]);
            await this.device.queue.onSubmittedWorkDone();

            // Cleanup
            uniformBuffer.destroy();
            polygonBuffer.destroy();
        }

        async _compositeMasks(mode) {
            const modeMap = { 'add': 0, 'subtract': 1, 'multiply': 2 };
            const modeValue = modeMap[mode] || 0;

            // Uniform Buffer
            const uniformData = new Uint32Array([
                this.width,
                this.height,
                modeValue,
                0  // padding
            ]);

            const uniformBuffer = this.device.createBuffer({
                size: uniformData.byteLength,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
            this.queue.writeBuffer(uniformBuffer, 0, uniformData);

            // Output Texture (新規作成)
            const outputTexture = this.device.createTexture({
                size: { width: this.width, height: this.height, depthOrArrayLayers: 1 },
                format: 'r32float',
                usage: GPUTextureUsage.STORAGE_BINDING | 
                       GPUTextureUsage.TEXTURE_BINDING |
                       GPUTextureUsage.COPY_SRC
            });

            // Bind Group
            const bindGroup = this.device.createBindGroup({
                layout: this.compositePipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: uniformBuffer } },
                    { binding: 1, resource: this.maskTexture.createView() },
                    { binding: 2, resource: this.tempMaskTexture.createView() },
                    { binding: 3, resource: outputTexture.createView() }
                ]
            });

            // Compute Pass
            const commandEncoder = this.device.createCommandEncoder();
            const passEncoder = commandEncoder.beginComputePass();
            
            passEncoder.setPipeline(this.compositePipeline);
            passEncoder.setBindGroup(0, bindGroup);
            
            const workgroupsX = Math.ceil(this.width / 8);
            const workgroupsY = Math.ceil(this.height / 8);
            passEncoder.dispatchWorkgroups(workgroupsX, workgroupsY, 1);
            
            passEncoder.end();

            // 結果を maskTexture にコピー
            commandEncoder.copyTextureToTexture(
                { texture: outputTexture },
                { texture: this.maskTexture },
                { width: this.width, height: this.height, depthOrArrayLayers: 1 }
            );
            
            this.queue.submit([commandEncoder.finish()]);
            await this.device.queue.onSubmittedWorkDone();

            // Cleanup
            uniformBuffer.destroy();
            outputTexture.destroy();
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
            if (!this._initialized) {
                return;
            }

            const commandEncoder = this.device.createCommandEncoder();
            
            // 0で埋める（透明）
            const clearBuffer = this.device.createBuffer({
                size: this.width * this.height * 4,
                usage: GPUBufferUsage.COPY_SRC,
                mappedAtCreation: true
            });
            new Float32Array(clearBuffer.getMappedRange()).fill(0);
            clearBuffer.unmap();

            commandEncoder.copyBufferToTexture(
                { buffer: clearBuffer, bytesPerRow: this.width * 4 },
                { texture: this.maskTexture },
                { width: this.width, height: this.height, depthOrArrayLayers: 1 }
            );

            this.queue.submit([commandEncoder.finish()]);
            await this.device.queue.onSubmittedWorkDone();

            clearBuffer.destroy();
        }

        isInitialized() {
            return this._initialized;
        }

        destroy() {
            if (this.maskTexture) {
                this.maskTexture.destroy();
                this.maskTexture = null;
            }
            if (this.tempMaskTexture) {
                this.tempMaskTexture.destroy();
                this.tempMaskTexture = null;
            }
            this._initialized = false;
        }
    }

    window.WebGPUMaskLayer = WebGPUMaskLayer;

    console.log('✅ webgpu-mask-layer.js (Phase 2) loaded');
    console.log('   ✓ GPUマスクレイヤー');
    console.log('   ✓ ポリゴン→マスク変換');
    console.log('   ✓ マスク加算/減算/乗算');

})();