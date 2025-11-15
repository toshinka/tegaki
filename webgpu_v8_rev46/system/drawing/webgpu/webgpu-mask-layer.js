/**
 * ================================================================================
 * webgpu-mask-layer.js Phase 6: 消しゴムmask-based完全版
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - webgpu-drawing-layer.js (GPUDevice/Queue)
 *   - core-initializer.js (初期化)
 * 
 * 📄 子ファイル使用先:
 *   - brush-core.js (消しゴムマスク処理)
 * 
 * 【Phase 6改修内容】
 * ✅ 消しゴムストローク管理（startErase/eraseAppendPoint/finalizeErase）
 * ✅ generateEraseMask() 実装（円形ブラシ軌跡→mask texture）
 * ✅ composeMasks() 実装（複数ストローク統合）
 * ✅ 既存機能完全継承
 * 
 * ================================================================================
 */

class WebGPUMaskLayer {
    constructor(webgpuLayer) {
        if (!webgpuLayer) {
            throw new Error('[WebGPUMaskLayer] webgpuLayer required');
        }
        
        this.webgpuLayer = webgpuLayer;
        this.device = null;
        this.queue = null;
        
        this.width = 0;
        this.height = 0;
        this.maskTexture = null;
        this.maskBuffer = null;
        
        this.polygonPipeline = null;
        this.compositePipeline = null;
        this.eraseBrushPipeline = null;
        
        this._initialized = false;
        
        // ✅ Phase 6: 消しゴムストローク管理
        this.currentErasePoints = [];
        this.isErasing = false;
    }
    
    _isContextValid() {
        if (!this.device || !this.queue) return false;
        
        try {
            return this.device.lost !== undefined;
        } catch (e) {
            return false;
        }
    }
    
    _destroyResource(resource) {
        if (!resource) return;
        
        try {
            if (typeof resource.destroy === 'function') {
                resource.destroy();
            }
        } catch (e) {}
    }
    
    async initialize(width, height) {
        if (this._initialized) {
            return true;
        }
        
        if (!this.webgpuLayer.isInitialized || !this.webgpuLayer.isInitialized()) {
            console.error('[WebGPUMaskLayer] WebGPUDrawingLayer not initialized');
            return false;
        }
        
        this.device = this.webgpuLayer.device;
        this.queue = this.webgpuLayer.queue;
        
        if (!this.device || !this.queue) {
            console.error('[WebGPUMaskLayer] GPUDevice or Queue not available');
            return false;
        }
        
        this.width = width;
        this.height = height;
        
        try {
            await this._createMaskTexture();
            await this._createPolygonPipeline();
            await this._createCompositePipeline();
            await this._createEraseBrushPipeline();
            
            this.maskBuffer = new Float32Array(width * height);
            
            this._initialized = true;
            return true;
            
        } catch (error) {
            console.error('[WebGPUMaskLayer] Init failed:', error);
            return false;
        }
    }
    
    async reinitialize() {
        this._destroyResource(this.maskTexture);
        this.maskTexture = null;
        this._initialized = false;
        
        return await this.initialize(this.width, this.height);
    }
    
    async _createMaskTexture() {
        const config = window.TEGAKI_CONFIG?.webgpu?.mask || {};
        const format = config.format || 'r32float';
        
        this.maskTexture = this.device.createTexture({
            size: [this.width, this.height, 1],
            format: format,
            usage: GPUTextureUsage.STORAGE_BINDING | 
                   GPUTextureUsage.TEXTURE_BINDING |
                   GPUTextureUsage.COPY_SRC |
                   GPUTextureUsage.COPY_DST
        });
    }
    
    async _createPolygonPipeline() {
        const shaderCode = `
            struct PolygonData {
                pointCount: u32,
                mode: f32,
                padding1: f32,
                padding2: f32,
                points: array<vec2<f32>>
            }
            
            @group(0) @binding(0) var maskTexture: texture_storage_2d<r32float, write>;
            @group(0) @binding(1) var<storage, read> polygon: PolygonData;
            
            @compute @workgroup_size(8, 8)
            fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
                let texSize = textureDimensions(maskTexture);
                if (gid.x >= texSize.x || gid.y >= texSize.y) {
                    return;
                }
                
                let pos = vec2<f32>(f32(gid.x), f32(gid.y));
                
                var inside = false;
                let n = polygon.pointCount;
                
                for (var i = 0u; i < n; i = i + 1u) {
                    let j = (i + 1u) % n;
                    let pi = polygon.points[i];
                    let pj = polygon.points[j];
                    
                    if ((pi.y > pos.y) != (pj.y > pos.y)) {
                        let x = (pj.x - pi.x) * (pos.y - pi.y) / (pj.y - pi.y) + pi.x;
                        if (pos.x < x) {
                            inside = !inside;
                        }
                    }
                }
                
                var maskValue = 0.0;
                if (polygon.mode == 1.0 && inside) {
                    maskValue = 1.0;
                } else if (polygon.mode == -1.0 && inside) {
                    maskValue = 1.0;
                }
                
                textureStore(maskTexture, gid.xy, vec4<f32>(maskValue, 0.0, 0.0, 0.0));
            }
        `;
        
        const shaderModule = this.device.createShaderModule({
            code: shaderCode,
            label: 'Mask Polygon Shader'
        });
        
        this.polygonPipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: shaderModule,
                entryPoint: 'main'
            },
            label: 'Mask Polygon Pipeline'
        });
    }
    
    async _createCompositePipeline() {
        const shaderCode = `
            @group(0) @binding(0) var maskA: texture_2d<f32>;
            @group(0) @binding(1) var maskB: texture_2d<f32>;
            @group(0) @binding(2) var output: texture_storage_2d<r32float, write>;
            @group(0) @binding(3) var<uniform> mode: f32;
            
            @compute @workgroup_size(8, 8)
            fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
                let texSize = textureDimensions(output);
                if (gid.x >= texSize.x || gid.y >= texSize.y) {
                    return;
                }
                
                let a = textureLoad(maskA, gid.xy, 0).r;
                let b = textureLoad(maskB, gid.xy, 0).r;
                
                var result = 0.0;
                if (mode > 0.0) {
                    result = clamp(a + b, 0.0, 1.0);
                } else {
                    result = clamp(a - b, 0.0, 1.0);
                }
                
                textureStore(output, gid.xy, vec4<f32>(result, 0.0, 0.0, 0.0));
            }
        `;
        
        const shaderModule = this.device.createShaderModule({
            code: shaderCode,
            label: 'Mask Composite Shader'
        });
        
        this.compositePipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: shaderModule,
                entryPoint: 'main'
            },
            label: 'Mask Composite Pipeline'
        });
    }
    
    /**
     * ✅ Phase 6: 消しゴムブラシシェーダー
     */
    async _createEraseBrushPipeline() {
        const shaderCode = `
            struct EraseStroke {
                pointCount: u32,
                brushSize: f32,
                padding1: f32,
                padding2: f32,
                points: array<vec4<f32>>  // x, y, pressure, unused
            }
            
            @group(0) @binding(0) var maskTexture: texture_storage_2d<r32float, write>;
            @group(0) @binding(1) var<storage, read> stroke: EraseStroke;
            
            @compute @workgroup_size(8, 8)
            fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
                let texSize = textureDimensions(maskTexture);
                if (gid.x >= texSize.x || gid.y >= texSize.y) {
                    return;
                }
                
                let pos = vec2<f32>(f32(gid.x), f32(gid.y));
                var maxMask = 0.0;
                
                // 各ポイントからの円形ブラシ
                for (var i = 0u; i < stroke.pointCount; i = i + 1u) {
                    let point = stroke.points[i];
                    let center = point.xy;
                    let pressure = point.z;
                    
                    let dist = distance(pos, center);
                    let radius = stroke.brushSize * 0.5 * max(0.1, pressure);
                    
                    // ソフトブラシ（フェザーエッジ）
                    let feather = radius * 0.2;
                    let maskValue = 1.0 - smoothstep(radius - feather, radius, dist);
                    
                    maxMask = max(maxMask, maskValue);
                }
                
                textureStore(maskTexture, gid.xy, vec4<f32>(maxMask, 0.0, 0.0, 0.0));
            }
        `;
        
        const shaderModule = this.device.createShaderModule({
            code: shaderCode,
            label: 'Erase Brush Shader'
        });
        
        this.eraseBrushPipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: shaderModule,
                entryPoint: 'main'
            },
            label: 'Erase Brush Pipeline'
        });
    }
    
    async addPolygonToMask(polygon, mode = 'add') {
        if (!this._isContextValid()) {
            const reinitSuccess = await this.reinitialize();
            if (!reinitSuccess) {
                return false;
            }
        }
        
        if (!this._initialized || !polygon || polygon.length === 0) {
            return false;
        }
        
        let polygonBuffer = null;
        
        try {
            const pointCount = polygon.length;
            const modeValue = mode === 'add' ? 1.0 : -1.0;
            
            const headerSize = 4;
            const totalFloats = headerSize + pointCount * 2;
            const polygonData = new Float32Array(totalFloats);
            
            polygonData[0] = pointCount;
            polygonData[1] = modeValue;
            polygonData[2] = 0.0;
            polygonData[3] = 0.0;
            
            for (let i = 0; i < pointCount; i++) {
                polygonData[headerSize + i * 2] = polygon[i][0];
                polygonData[headerSize + i * 2 + 1] = polygon[i][1];
            }
            
            polygonBuffer = this.device.createBuffer({
                size: polygonData.byteLength,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
                label: 'Polygon Buffer'
            });
            this.queue.writeBuffer(polygonBuffer, 0, polygonData);
            
            const bindGroup = this.device.createBindGroup({
                layout: this.polygonPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: this.maskTexture.createView() },
                    { binding: 1, resource: { buffer: polygonBuffer } }
                ],
                label: 'Polygon Mask BindGroup'
            });
            
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
            
            this._destroyResource(polygonBuffer);
            
            return true;
            
        } catch (error) {
            console.error('[WebGPUMaskLayer] addPolygonToMask failed:', error);
            this._destroyResource(polygonBuffer);
            return false;
        }
    }
    
    /**
     * ✅ Phase 6: 消しゴムストローク開始
     */
    startErase() {
        this.currentErasePoints = [];
        this.isErasing = true;
    }
    
    /**
     * ✅ Phase 6: 消しゴムポイント追加
     */
    eraseAppendPoint(x, y, pressure = 1.0) {
        if (!this.isErasing) return;
        
        this.currentErasePoints.push({
            x: x,
            y: y,
            pressure: pressure
        });
    }
    
    /**
     * ✅ Phase 6: 消しゴムストローク終了
     */
    finalizeErase() {
        this.isErasing = false;
        const points = [...this.currentErasePoints];
        this.currentErasePoints = [];
        return points;
    }
    
    /**
     * ✅ Phase 6: 消しゴムマスク生成（円形ブラシ軌跡）
     */
    async generateEraseMask(points, brushSize) {
        if (!this._isContextValid()) {
            const reinitSuccess = await this.reinitialize();
            if (!reinitSuccess) {
                return null;
            }
        }
        
        if (!this._initialized || !points || points.length === 0) {
            return null;
        }
        
        let strokeBuffer = null;
        let tempTexture = null;
        
        try {
            // ストロークデータ構築
            const headerSize = 4;
            const totalFloats = headerSize + points.length * 4;
            const strokeData = new Float32Array(totalFloats);
            
            strokeData[0] = points.length;
            strokeData[1] = brushSize;
            strokeData[2] = 0.0;
            strokeData[3] = 0.0;
            
            for (let i = 0; i < points.length; i++) {
                const p = points[i];
                const offset = headerSize + i * 4;
                strokeData[offset] = p.x;
                strokeData[offset + 1] = p.y;
                strokeData[offset + 2] = p.pressure !== undefined ? p.pressure : 1.0;
                strokeData[offset + 3] = 0.0;
            }
            
            strokeBuffer = this.device.createBuffer({
                size: strokeData.byteLength,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
                label: 'Erase Stroke Buffer'
            });
            this.queue.writeBuffer(strokeBuffer, 0, strokeData);
            
            // 一時テクスチャ生成
            tempTexture = this.device.createTexture({
                size: [this.width, this.height, 1],
                format: 'r32float',
                usage: GPUTextureUsage.STORAGE_BINDING | 
                       GPUTextureUsage.TEXTURE_BINDING |
                       GPUTextureUsage.COPY_SRC
            });
            
            const bindGroup = this.device.createBindGroup({
                layout: this.eraseBrushPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: tempTexture.createView() },
                    { binding: 1, resource: { buffer: strokeBuffer } }
                ],
                label: 'Erase Brush BindGroup'
            });
            
            const commandEncoder = this.device.createCommandEncoder();
            const passEncoder = commandEncoder.beginComputePass();
            passEncoder.setPipeline(this.eraseBrushPipeline);
            passEncoder.setBindGroup(0, bindGroup);
            
            const workgroupsX = Math.ceil(this.width / 8);
            const workgroupsY = Math.ceil(this.height / 8);
            passEncoder.dispatchWorkgroups(workgroupsX, workgroupsY, 1);
            passEncoder.end();
            
            this.queue.submit([commandEncoder.finish()]);
            await this.device.queue.onSubmittedWorkDone();
            
            this._destroyResource(strokeBuffer);
            
            return tempTexture;
            
        } catch (error) {
            console.error('[WebGPUMaskLayer] generateEraseMask failed:', error);
            this._destroyResource(strokeBuffer);
            this._destroyResource(tempTexture);
            return null;
        }
    }
    
    /**
     * ✅ Phase 6: マスク合成（複数ストローク統合）
     */
    async composeMasks(baseTexture, newTexture, mode = 'add') {
        if (!this._isContextValid()) {
            return null;
        }
        
        if (!this._initialized || !baseTexture || !newTexture) {
            return null;
        }
        
        let modeBuffer = null;
        let outputTexture = null;
        
        try {
            const modeValue = mode === 'add' ? 1.0 : -1.0;
            const modeData = new Float32Array([modeValue]);
            
            modeBuffer = this.device.createBuffer({
                size: modeData.byteLength,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
            this.queue.writeBuffer(modeBuffer, 0, modeData);
            
            outputTexture = this.device.createTexture({
                size: [this.width, this.height, 1],
                format: 'r32float',
                usage: GPUTextureUsage.STORAGE_BINDING | 
                       GPUTextureUsage.TEXTURE_BINDING |
                       GPUTextureUsage.COPY_SRC
            });
            
            const bindGroup = this.device.createBindGroup({
                layout: this.compositePipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: baseTexture.createView() },
                    { binding: 1, resource: newTexture.createView() },
                    { binding: 2, resource: outputTexture.createView() },
                    { binding: 3, resource: { buffer: modeBuffer } }
                ],
                label: 'Composite BindGroup'
            });
            
            const commandEncoder = this.device.createCommandEncoder();
            const passEncoder = commandEncoder.beginComputePass();
            passEncoder.setPipeline(this.compositePipeline);
            passEncoder.setBindGroup(0, bindGroup);
            
            const workgroupsX = Math.ceil(this.width / 8);
            const workgroupsY = Math.ceil(this.height / 8);
            passEncoder.dispatchWorkgroups(workgroupsX, workgroupsY, 1);
            passEncoder.end();
            
            this.queue.submit([commandEncoder.finish()]);
            await this.device.queue.onSubmittedWorkDone();
            
            this._destroyResource(modeBuffer);
            
            return outputTexture;
            
        } catch (error) {
            console.error('[WebGPUMaskLayer] composeMasks failed:', error);
            this._destroyResource(modeBuffer);
            this._destroyResource(outputTexture);
            return null;
        }
    }
    
    clear() {
        if (!this._initialized) return;
        
        const commandEncoder = this.device.createCommandEncoder();
        commandEncoder.clearBuffer(this.maskTexture);
        this.queue.submit([commandEncoder.finish()]);
        
        if (this.maskBuffer) {
            this.maskBuffer.fill(0);
        }
    }
    
    getMaskTexture() {
        return this.maskTexture;
    }
    
    getMaskValue(x, y) {
        if (!this.maskBuffer) return 0;
        const idx = Math.floor(y) * this.width + Math.floor(x);
        return this.maskBuffer[idx] || 0;
    }
    
    isInitialized() {
        return this._initialized;
    }
    
    destroy() {
        this._destroyResource(this.maskTexture);
        this.maskTexture = null;
        this.maskBuffer = null;
        this._initialized = false;
    }
}

window.WebGPUMaskLayer = WebGPUMaskLayer;

console.log('✅ webgpu-mask-layer.js Phase 6 消しゴムmask-based完全版 loaded');
console.log('   ✅ generateEraseMask() 実装');
console.log('   ✅ composeMasks() 実装');
console.log('   ✅ 円形ブラシ軌跡マスク生成');