/**
 * ================================================================================
 * gpu-stroke-processor.js Phase 1 完全版 - Polygon頂点バッファ生成
 * ================================================================================
 * 
 * 【依存Parents】
 * - stroke-recorder.js (points取得)
 * - webgpu-drawing-layer.js (device/queue)
 * 
 * 【依存Children】
 * - msdf-pipeline-manager.js (VertexBuffer渡し)
 * - brush-core.js (呼び出し元)
 * 
 * 【Phase 1改修完了】
 * ✅ createPolygonVertexBuffer() 実装
 * ✅ Quad Strip構築: prev/curr/next/side 属性
 * ✅ EdgeBuffer互換維持（後方互換）
 * ✅ GPU VERTEX usage対応
 * 
 * 【VertexBuffer構造】
 * Float32Array: [prev.x, prev.y, curr.x, curr.y, next.x, next.y, side] * N
 * stride: 7 floats = 28 bytes
 * vertexCount: points.length * 2 (左右ペア)
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
     * Polygon頂点バッファ作成 [Phase 1実装]
     * @param {Array} points - [{x, y, pressure}, ...] 形式 または [x, y, ...]
     * @returns {{buffer: Float32Array, vertexCount: number}}
     */
    createPolygonVertexBuffer(points) {
      // 入力形式正規化
      let coords;
      if (Array.isArray(points) && points.length > 0) {
        if (typeof points[0] === 'object' && points[0].x !== undefined) {
          // [{x, y, pressure}, ...] → [x, y, x, y, ...]
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

      // Quad Strip: 各点に対し左右ペア生成
      const vertexCount = numPoints * 2;
      const buffer = new Float32Array(vertexCount * 7); // 7 floats per vertex

      for (let i = 0; i < numPoints; i++) {
        const currIdx = i * 2;
        const currX = coords[currIdx];
        const currY = coords[currIdx + 1];

        // prev計算（最初の点は自身を使用）
        let prevX, prevY;
        if (i === 0) {
          prevX = currX;
          prevY = currY;
        } else {
          const prevIdx = (i - 1) * 2;
          prevX = coords[prevIdx];
          prevY = coords[prevIdx + 1];
        }

        // next計算（最後の点は自身を使用）
        let nextX, nextY;
        if (i === numPoints - 1) {
          nextX = currX;
          nextY = currY;
        } else {
          const nextIdx = (i + 1) * 2;
          nextX = coords[nextIdx];
          nextY = coords[nextIdx + 1];
        }

        // 左側頂点 (side = -1)
        const leftIdx = (i * 2) * 7;
        buffer[leftIdx + 0] = prevX;
        buffer[leftIdx + 1] = prevY;
        buffer[leftIdx + 2] = currX;
        buffer[leftIdx + 3] = currY;
        buffer[leftIdx + 4] = nextX;
        buffer[leftIdx + 5] = nextY;
        buffer[leftIdx + 6] = -1.0; // side

        // 右側頂点 (side = +1)
        const rightIdx = (i * 2 + 1) * 7;
        buffer[rightIdx + 0] = prevX;
        buffer[rightIdx + 1] = prevY;
        buffer[rightIdx + 2] = currX;
        buffer[rightIdx + 3] = currY;
        buffer[rightIdx + 4] = nextX;
        buffer[rightIdx + 5] = nextY;
        buffer[rightIdx + 6] = 1.0; // side
      }

      return { buffer, vertexCount };
    }

    /**
     * EdgeBuffer作成（後方互換維持）
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
      const numEdges = numPoints - 1;
      const buffer = new Float32Array(numEdges * 8);

      for (let i = 0; i < numEdges; i++) {
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

      return buffer;
    }

    /**
     * GPU BufferへUpload
     * @param {Float32Array} data - VertexBuffer または EdgeBuffer
     * @param {string} usage - 'vertex' | 'storage'
     */
    uploadToGPU(data, usage = 'storage') {
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

      return gpuBuffer;
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

      const margin = 50; // Phase 1: margin拡大（20→50）
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

})();