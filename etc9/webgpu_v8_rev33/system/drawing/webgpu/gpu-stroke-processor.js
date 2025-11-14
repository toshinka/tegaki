/**
 * ================================================================================
 * gpu-stroke-processor.js Phase 7 座標正規化対応版
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
 * 【Phase 7改修】
 * 🔧 Bounds原点オフセット正規化（Local座標 → Canvas座標）
 * 🔧 createPolygonVertexBuffer: 座標をBounds原点基準に変換
 * 🔧 createEdgeBuffer: 同様に座標正規化
 * 🔧 NDC変換が正しく動作するよう座標系統一
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
     * Polygon頂点バッファ作成（Phase 7: 座標正規化対応）
     * @param {Array} points - [{x, y, pressure}, ...] または [x, y, ...]
     * @returns {{buffer: Float32Array, vertexCount: number, bounds: Object}}
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

      const bounds = this._calculateBoundsFromCoords(coords);
      const offsetX = bounds.minX;
      const offsetY = bounds.minY;

      const normalizedCoords = new Float32Array(coords.length);
      for (let i = 0; i < coords.length; i += 2) {
        normalizedCoords[i] = coords[i] - offsetX;
        normalizedCoords[i + 1] = coords[i + 1] - offsetY;
      }

      const numSegments = numPoints - 1;
      const vertexCount = numSegments * 6;
      const buffer = new Float32Array(vertexCount * 7);

      for (let i = 0; i < numSegments; i++) {
        const prevIdx = Math.max(0, i - 1);
        const currIdx = i;
        const nextIdx = i + 1;
        const next2Idx = Math.min(numPoints - 1, i + 2);

        const prevX = normalizedCoords[prevIdx * 2];
        const prevY = normalizedCoords[prevIdx * 2 + 1];
        const currX = normalizedCoords[currIdx * 2];
        const currY = normalizedCoords[currIdx * 2 + 1];
        const nextX = normalizedCoords[nextIdx * 2];
        const nextY = normalizedCoords[nextIdx * 2 + 1];
        const next2X = normalizedCoords[next2Idx * 2];
        const next2Y = normalizedCoords[next2Idx * 2 + 1];

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

      return { buffer, vertexCount, bounds };
    }

    /**
     * EdgeBuffer作成（Phase 7: 座標正規化対応）
     * @returns {{buffer: Float32Array, edgeCount: number, bounds: Object}}
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

      const bounds = this._calculateBoundsFromCoords(coords);
      const offsetX = bounds.minX;
      const offsetY = bounds.minY;

      const numPoints = Math.floor(coords.length / 2);
      const edgeCount = numPoints - 1;
      const buffer = new Float32Array(edgeCount * 8);

      for (let i = 0; i < edgeCount; i++) {
        const idx0 = i * 2;
        const idx1 = (i + 1) * 2;
        const bufferIdx = i * 8;

        buffer[bufferIdx + 0] = coords[idx0] - offsetX;
        buffer[bufferIdx + 1] = coords[idx0 + 1] - offsetY;
        buffer[bufferIdx + 2] = coords[idx1] - offsetX;
        buffer[bufferIdx + 3] = coords[idx1 + 1] - offsetY;
        buffer[bufferIdx + 4] = i;
        buffer[bufferIdx + 5] = i % 3;
        buffer[bufferIdx + 6] = 1.0;
        buffer[bufferIdx + 7] = 0.0;
      }

      return { buffer, edgeCount, bounds };
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
     * Bounds計算（外部公開用）
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

      return this._calculateBoundsFromCoords(coords);
    }

    /**
     * Bounds計算（内部用）
     */
    _calculateBoundsFromCoords(coords) {
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

  console.log('✅ gpu-stroke-processor.js Phase 7 loaded');

})();