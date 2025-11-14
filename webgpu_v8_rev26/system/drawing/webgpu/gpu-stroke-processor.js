/**
 * ================================================================================
 * gpu-stroke-processor.js Phase 1.1 - Points形式修正版
 * ================================================================================
 * 
 * 【依存Parents】
 * - stroke-recorder.js (points取得)
 * - webgpu-drawing-layer.js (device/queue)
 * 
 * 【依存Children】
 * - msdf-pipeline-manager.js (EdgeBuffer渡し)
 * - brush-core.js (呼び出し元)
 * 
 * 【Phase 1.1改修】
 * ✅ Points形式対応: [{x, y, pressure}, ...] → EdgeBuffer
 * ✅ 線分ストローク正常生成
 * 
 * 【EdgeBuffer構造】
 * Float32Array: [x0, y0, x1, y1, edgeId, channelId, insideFlag, padding]
 * 
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

    async initialize(device) {
      if (this.initialized) {
        console.warn('[GPUStrokeProcessor] Already initialized');
        return;
      }

      this.device = device;
      this.queue = device.queue;
      this.initialized = true;

      console.log('✅ [GPUStrokeProcessor] Phase 1.1初期化完了');
    }

    /**
     * EdgeBuffer作成
     * @param {Array} points - [{x, y, pressure}, ...] 形式 または [x, y, x, y, ...] 形式
     * @returns {Float32Array} EdgeBuffer
     */
    createEdgeBuffer(points) {
      // 入力形式判定
      let pointArray;
      
      if (Array.isArray(points) && points.length > 0) {
        if (typeof points[0] === 'object' && points[0].x !== undefined) {
          // [{x, y, pressure}, ...] 形式
          pointArray = points.flatMap(p => [p.x, p.y]);
        } else {
          // [x, y, x, y, ...] 形式
          pointArray = points;
        }
      } else {
        console.warn('[GPUStrokeProcessor] Invalid points format');
        return null;
      }

      if (pointArray.length < 4) {
        console.warn('[GPUStrokeProcessor] Not enough points:', pointArray.length);
        return null;
      }

      // エッジ数計算（ポイント数 - 1）
      const numPoints = Math.floor(pointArray.length / 2);
      const numEdges = numPoints - 1;
      
      const buffer = new Float32Array(numEdges * 8); // 8 floats per edge

      for (let i = 0; i < numEdges; i++) {
        const idx0 = i * 2;
        const idx1 = (i + 1) * 2;
        const bufferIdx = i * 8;

        // エッジ端点（連続する2ポイントを結ぶ線分）
        buffer[bufferIdx + 0] = pointArray[idx0];     // x0
        buffer[bufferIdx + 1] = pointArray[idx0 + 1]; // y0
        buffer[bufferIdx + 2] = pointArray[idx1];     // x1
        buffer[bufferIdx + 3] = pointArray[idx1 + 1]; // y1

        // メタデータ
        buffer[bufferIdx + 4] = i;              // edgeId
        buffer[bufferIdx + 5] = i % 3;          // channelId (0=R, 1=G, 2=B)
        buffer[bufferIdx + 6] = 1.0;            // insideFlag (内側は正、外側は負)
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
     * Bounds計算
     * @param {Array} points - [{x, y}, ...] または [x, y, x, y, ...]
     */
    calculateBounds(points) {
      let pointArray;
      
      if (Array.isArray(points) && points.length > 0) {
        if (typeof points[0] === 'object' && points[0].x !== undefined) {
          pointArray = points.flatMap(p => [p.x, p.y]);
        } else {
          pointArray = points;
        }
      } else {
        return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
      }

      if (pointArray.length < 2) {
        return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
      }

      let minX = Infinity, minY = Infinity;
      let maxX = -Infinity, maxY = -Infinity;

      for (let i = 0; i < pointArray.length; i += 2) {
        const x = pointArray[i];
        const y = pointArray[i + 1];
        
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }

      // マージン追加（エッジのぼやけ・線幅考慮）
      const margin = 20;
      return {
        minX: minX - margin,
        minY: minY - margin,
        maxX: maxX + margin,
        maxY: maxY + margin
      };
    }

    destroy() {
      this.initialized = false;
    }
  }

  window.GPUStrokeProcessor = new GPUStrokeProcessor();
  
  console.log('✅ gpu-stroke-processor.js Phase 1.1 loaded');
  console.log('   📊 Points形式対応: [{x, y, pressure}, ...] → EdgeBuffer');

})();