/**
 * ================================================================================
 * gpu-stroke-processor.js Phase 6最終版 - 6頂点展開（triangle-list完全対応）
 * ================================================================================
 * 
 * 【依存Parents】
 * - stroke-recorder.js (points取得)
 * - webgpu-drawing-layer.js (device/queue)
 * 
 * 【依存Children】
 * - msdf-pipeline-manager.js (VertexBuffer + edgeCount受け渡し)
 * - brush-core.js (呼び出し元)
 * 
 * 【Phase 6最終版】
 * ✅ createPolygonVertexBuffer(): 各セグメントに6頂点生成（2三角形）
 * ✅ vertexCount = (numPoints - 1) * 6
 * ✅ Triangle-list描画完全対応（index buffer不要）
 * 
 * 頂点展開パターン（各セグメント）:
 *   Triangle 1: [0, 1, 2] → 左下、右下、左上
 *   Triangle 2: [1, 3, 2] → 右下、右上、左上
 * 
 * つまり6頂点: [0, 1, 2, 1, 3, 2]
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
      if (this.initialized) return;
      this.device = device;
      this.queue = device.queue;
      this.initialized = true;
    }

    /**
     * Polygon頂点バッファ作成（Phase 6: 6頂点展開）
     * @param {Array} points - [{x, y, pressure}, ...] または [x, y, ...]
     * @returns {{buffer: Float32Array, vertexCount: number}}
     */
    createPolygonVertexBuffer(points) {
      let coords;
      if (Array.isArray(points) && points.length > 0) {
        if (typeof points[0] === 'object' && points[0].x !== undefined) {
          coords = points.flatMap(p => [p.x, p.y]);
        } else {
          coords = points;
        }
      } else {
        console.warn('[GPUStrokeProcessor] Invalid points');
        return null;
      }

      const numPoints = Math.floor(coords.length / 2);
      if (numPoints < 2) {
        console.warn('[GPUStrokeProcessor] Need at least 2 points');
        return null;
      }

      const numSegments = numPoints - 1;
      const vertexCount = numSegments * 6;
      const buffer = new Float32Array(vertexCount * 7);

      for (let i = 0; i < numSegments; i++) {
        const prevIdx = Math.max(0, i - 1);
        const currIdx = i;
        const nextIdx = i + 1;
        const next2Idx = Math.min(numPoints - 1, i + 2);

        const prevX = coords[prevIdx * 2];
        const prevY = coords[prevIdx * 2 + 1];
        const currX = coords[currIdx * 2];
        const currY = coords[currIdx * 2 + 1];
        const nextX = coords[nextIdx * 2];
        const nextY = coords[nextIdx * 2 + 1];
        const next2X = coords[next2Idx * 2];
        const next2Y = coords[next2Idx * 2 + 1];

        const baseIdx = i * 6 * 7;

        const v0 = [prevX, prevY, currX, currY, nextX, nextY, -1.0];
        const v1 = [prevX, prevY, currX, currY, nextX, nextY, 1.0];
        const v2 = [currX, currY, nextX, nextY, next2X, next2Y, -1.0];
        const v3 = [currX, currY, nextX, nextY, next2X, next2Y, 1.0];

        for (let j = 0; j < 7; j++) buffer[baseIdx + j] = v0[j];
        for (let j = 0; j < 7; j++) buffer[baseIdx + 7 + j] = v1[j];
        for (let j = 0; j < 7; j++) buffer[baseIdx + 14 + j] = v2[j];
        for (let j = 0; j < 7; j++) buffer[baseIdx + 21 + j] = v1[j];
        for (let j = 0; j < 7; j++) buffer[baseIdx + 28 + j] = v3[j];
        for (let j = 0; j < 7; j++) buffer[baseIdx + 35 + j] = v2[j];
      }

      return { buffer, vertexCount };
    }

    /**
     * EdgeBuffer作成
     * @returns {{buffer: Float32Array, edgeCount: number}}
     */
    createEdgeBuffer(points) {
      let coords;
      if (Array.isArray(points) && points.length > 0) {
        if (typeof points[0] === 'object' && points[0].x !== undefined) {
          coords = points.flatMap(p => [p.x, p.y]);
        } else {
          coords = points;
        }
      } else {
        return null;
      }

      if (coords.length < 4) return null;

      const numPoints = Math.floor(coords.length / 2);
      const edgeCount = numPoints - 1;
      const buffer = new Float32Array(edgeCount * 8);

      for (let i = 0; i < edgeCount; i++) {
        const idx0 = i * 2;
        const idx1 = (i + 1) * 2;
        const bufferIdx = i * 8;

        buffer[bufferIdx + 0] = coords[idx0];
        buffer[bufferIdx + 1] = coords[idx0 + 1];
        buffer[bufferIdx + 2] = coords[idx1];
        buffer[bufferIdx + 3] = coords[idx1 + 1];
        buffer[bufferIdx + 4] = i;
        buffer[bufferIdx + 5] = i % 3;
        buffer[bufferIdx + 6] = 1.0;
        buffer[bufferIdx + 7] = 0.0;
      }

      return { buffer, edgeCount };
    }

    /**
     * GPU BufferへUpload
     * @param {Float32Array} data
     * @param {string} usage - 'vertex' | 'storage'
     * @param {number} elementStrideBytes - 1要素あたりのバイト数
     * @returns {{gpuBuffer: GPUBuffer, elementCount: number}}
     */
    uploadToGPU(data, usage = 'storage', elementStrideBytes = 8 * 4) {
      if (!this.initialized) {
        throw new Error('[GPUStrokeProcessor] Not initialized');
      }

      if (!data || data.length === 0) {
        throw new Error('[GPUStrokeProcessor] Empty buffer');
      }

      let gpuUsage;
      if (usage === 'vertex') {
        gpuUsage = GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST;
      } else {
        gpuUsage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
      }

      const gpuBuffer = this.device.createBuffer({
        label: `GPU Buffer (${usage})`,
        size: data.byteLength,
        usage: gpuUsage
      });

      this.queue.writeBuffer(gpuBuffer, 0, data);

      const elementCount = Math.floor(data.byteLength / elementStrideBytes);

      return { gpuBuffer, elementCount };
    }

    /**
     * Bounds計算
     */
    calculateBounds(points) {
      let coords;
      if (Array.isArray(points) && points.length > 0) {
        if (typeof points[0] === 'object' && points[0].x !== undefined) {
          coords = points.flatMap(p => [p.x, p.y]);
        } else {
          coords = points;
        }
      } else {
        return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
      }

      if (coords.length < 2) {
        return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
      }

      let minX = Infinity, minY = Infinity;
      let maxX = -Infinity, maxY = -Infinity;

      for (let i = 0; i < coords.length; i += 2) {
        const x = coords[i];
        const y = coords[i + 1];
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }

      const margin = 50;
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

  console.log('✅ gpu-stroke-processor.js Phase 6最終版 loaded');
  console.log('   🔧 6頂点展開: (numPoints-1) × 6頂点（2三角形）');
  console.log('   🔧 Triangle-list完全対応（index buffer不要）');

})();