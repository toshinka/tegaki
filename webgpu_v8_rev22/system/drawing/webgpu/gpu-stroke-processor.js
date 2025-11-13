/**
 * ================================================================================
 * gpu-stroke-processor.js Phase 1完全版
 * ================================================================================
 * 【責務】
 *   - stroke-recorder.points[] → EdgeBuffer変換
 *   - GPU StorageBuffer作成・転送
 * 
 * 【依存Parents】
 *   - stroke-recorder.js (points取得)
 *   - webgpu-drawing-layer.js (device/queue)
 * 
 * 【依存Children】
 *   - msdf-pipeline-manager.js (EdgeBuffer渡し)
 *   - brush-core.js (呼び出し元)
 * 
 * 【EdgeBuffer構造】
 *   Float32Array: [x0, y0, x1, y1, edgeId, channelId, insideFlag, padding]
 *   - x0,y0: エッジ始点
 *   - x1,y1: エッジ終点
 *   - edgeId: エッジ識別子
 *   - channelId: MSDF割り当てチャンネル (0=R, 1=G, 2=B)
 *   - insideFlag: 符号判定 (-1 or +1)
 *   - padding: アライメント用
 * ================================================================================
 */

(function() {
  'use strict';

  class GPUStrokeProcessor {
    constructor() {
      this.device = null;
      this.queue = null;
      this.initialized = false;
    }

    /**
     * 初期化
     */
    async initialize(device) {
      if (this.initialized) {
        console.warn('[GPUStrokeProcessor] Already initialized');
        return;
      }

      this.device = device;
      this.queue = device.queue;
      this.initialized = true;

      console.log('✅ [GPUStrokeProcessor] Phase 1完全版初期化完了');
    }

    /**
     * EdgeBuffer作成（points配列から）
     */
    createEdgeBuffer(points) {
      if (points.length < 4) {
        console.warn('[GPUStrokeProcessor] Not enough points:', points.length);
        return null;
      }

      const numEdges = Math.floor(points.length / 2) - 1;
      const buffer = new Float32Array(numEdges * 8); // 8 floats per edge

      for (let i = 0; i < numEdges; i++) {
        const idx = i * 2;
        const bufferIdx = i * 8;

        // エッジ端点
        buffer[bufferIdx + 0] = points[idx];     // x0
        buffer[bufferIdx + 1] = points[idx + 1]; // y0
        buffer[bufferIdx + 2] = points[idx + 2]; // x1
        buffer[bufferIdx + 3] = points[idx + 3]; // y1

        // メタデータ
        buffer[bufferIdx + 4] = i;              // edgeId
        buffer[bufferIdx + 5] = i % 3;          // channelId (0=R, 1=G, 2=B)
        buffer[bufferIdx + 6] = 1.0;            // insideFlag (Phase 1では固定)
        buffer[bufferIdx + 7] = 0.0;            // padding
      }

      return buffer;
    }

    /**
     * GPU BufferへUpload
     */
    uploadToGPU(edgeBuffer) {
      if (!this.initialized) {
        throw new Error('[GPUStrokeProcessor] Not initialized');
      }

      if (!edgeBuffer || edgeBuffer.length === 0) {
        throw new Error('[GPUStrokeProcessor] Empty edge buffer');
      }

      const gpuBuffer = this.device.createBuffer({
        label: 'Edge Buffer',
        size: edgeBuffer.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });

      this.queue.writeBuffer(gpuBuffer, 0, edgeBuffer);

      const numEdges = edgeBuffer.length / 8;
      console.log(`✅ [GPUStrokeProcessor] EdgeBuffer uploaded (${numEdges} edges, ${edgeBuffer.byteLength} bytes)`);

      return gpuBuffer;
    }

    /**
     * Bounds計算（将来的にはMSDFテクスチャサイズ決定用）
     */
    calculateBounds(points) {
      if (points.length < 2) {
        return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
      }

      let minX = Infinity, minY = Infinity;
      let maxX = -Infinity, maxY = -Infinity;

      for (let i = 0; i < points.length; i += 2) {
        const x = points[i];
        const y = points[i + 1];
        
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }

      // マージン追加（エッジのぼやけ防止）
      const margin = 10;
      return {
        minX: minX - margin,
        minY: minY - margin,
        maxX: maxX + margin,
        maxY: maxY + margin
      };
    }

    /**
     * クリーンアップ
     */
    destroy() {
      this.initialized = false;
      console.log('✅ [GPUStrokeProcessor] Destroyed');
    }
  }

  // グローバル登録
  window.GPUStrokeProcessor = new GPUStrokeProcessor();
  
  console.log('✅ gpu-stroke-processor.js Phase 1完全版 loaded');
  console.log('   ✓ EdgeBuffer生成・GPU転送実装完了');

})();