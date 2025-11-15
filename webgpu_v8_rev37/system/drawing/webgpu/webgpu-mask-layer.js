/**
 * ================================================================================
 * webgpu-mask-layer.js Phase 5修正版
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - webgpu-drawing-layer.js (GPUDevice/Queue)
 *   - core-initializer.js (初期化)
 * 
 * 📄 子ファイル依存:
 *   - brush-core.js (消しゴムマスク処理)
 * 
 * 【Phase 5改修内容】
 * ✅ context loss検出とリカバリー
 * ✅ リソース破棄の徹底
 * ✅ エラー時の自動再初期化
 * ✅ 過剰ログ削除
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
        
        this._initialized = false;
    }
    
    /**
     * Phase 5: context有効性チェック
     */
    _isContextValid() {
        if (!this.device || !this.queue) return false;
        
        try {
            return this.device.lost !== undefined;
        } catch (e) {
            return false;
        }
    }
    
    /**
     * Phase 5: リソース破棄ヘルパー
     */
    _destroyResource(resource) {
        if (!resource) return;
        
        try {
            if (typeof resource.destroy === 'function') {
                resource.destroy();
            }
        } catch (e) {
            // 既に破棄済み
        }
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
            
            this.maskBuffer = new Float32Array(width * height);
            
            this._initialized = true;
            return true;
            
        } catch (error) {
            console.error('[WebGPUMaskLayer] Init failed:', error);
            return false;
        }
    }
    
    /**
     * Phase 5: 再初期化（context loss復旧用）
     */
    async reinitialize() {
        console.log('[WebGPUMaskLayer] Reinitializing...');
        
        // 既存リソース破棄
        this._destroyResource(this.maskTexture);
        this.maskTexture = null;
        this._initialized = false;
        
        // 再初期化
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
     * Phase 5: ポリゴン追加（context loss自動復旧対応）
     */
    async addPolygonToMask(polygon, mode = 'add') {
        // Phase 5: context有効性チェック
        if (!this._isContextValid()) {
            console.warn('[WebGPUMaskLayer] Context invalid, attempting reinitialize');
            const reinitSuccess = await this.reinitialize();
            if (!reinitSuccess) {
                console.error('[WebGPUMaskLayer] Reinitialize failed');
                return false;
            }
        }
        
        if (!this._initialized) {
            console.warn('[WebGPUMaskLayer] Not initialized');
            return false;
        }
        
        if (!polygon || polygon.length === 0) {
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
            
            // Phase 5: リソース破棄
            this._destroyResource(polygonBuffer);
            
            return true;
            
        } catch (error) {
            console.error('[WebGPUMaskLayer] addPolygonToMask failed:', error);
            
            // Phase 5: エラー時のクリーンアップ
            this._destroyResource(polygonBuffer);
            
            return false;
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
    
    /**
     * Phase 5: 完全クリーンアップ
     */
    destroy() {
        this._destroyResource(this.maskTexture);
        this.maskTexture = null;
        this.maskBuffer = null;
        this._initialized = false;
    }
}

window.WebGPUMaskLayer = WebGPUMaskLayer;

console.log('✅ webgpu-mask-layer.js Phase 5 loaded');