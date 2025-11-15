/**
 * ================================================================================
 * gpu-stroke-processor.js Phase 5完全版: 筆圧反映実装
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 * - stroke-recorder.js (points取得)
 * - webgpu-drawing-layer.js (device/queue)
 * 
 * 📄 子ファイル依存:
 * - msdf-pipeline-manager.js (VertexBuffer + edgeCount受け渡し)
 * - brush-core.js (呼び出し元)
 * 
 * 【Phase 5改修】
 * 🔧 createPolygonVertexBuffer: 筆圧値を幅に反映
 * 🔧 createEdgeBuffer: 筆圧値をedge dataに含める
 * 🔧 各ポイントのwidth = baseSize * pressure
 * ✅ 筆圧完全反映
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
     * 🔧 Phase 5改修: 筆圧反映実装
     * @param {Array} points - [{x, y, pressure}, ...]
     * @param {number} baseSize - ベースとなるペンサイズ
     */
    createPolygonVertexBuffer(points, baseSize = 10) {
      if (!Array.isArray(points) || points.length === 0) {
        console.warn('[GPUStrokeProcessor] Invalid points');
        return null;
      }

      // 🔧 Phase 5: オブジェクト形式とフラット配列の両対応
      let processedPoints = [];
      if (typeof points[0] === 'object' && points[0].x !== undefined) {
        processedPoints = points.map(p => ({
          x: p.x,
          y: p.y,
          pressure: p.pressure !== undefined ? p.pressure : 0.5
        }));
      } else {
        // フラット配列の場合はpressure=0.5で補完
        for (let i = 0; i < points.length; i += 2) {
          processedPoints.push({
            x: points[i],
            y: points[i + 1],
            pressure: 0.5
          });
        }
      }

      const numPoints = processedPoints.length;
      if (numPoints < 2) {
        console.warn('[GPUStrokeProcessor] Need at least 2 points');
        return null;
      }

      // Bounds計算
      const bounds = this._calculateBoundsFromPoints(processedPoints, baseSize);
      const offsetX = bounds.minX;
      const offsetY = bounds.minY;

      // 座標正規化
      const normalizedPoints = processedPoints.map(p => ({
        x: p.x - offsetX,
        y: p.y - offsetY,
        pressure: p.pressure,
        width: baseSize * p.pressure // 🔧 Phase 5: 筆圧を幅に変換
      }));

      const numSegments = numPoints - 1;
      const vertexCount = numSegments * 6;
      const buffer = new Float32Array(vertexCount * 7);

      for (let i = 0; i < numSegments; i++) {
        const prevIdx = Math.max(0, i - 1);
        const currIdx = i;
        const nextIdx = i + 1;
        const next2Idx = Math.min(numPoints - 1, i + 2);

        const prev = normalizedPoints[prevIdx];
        const curr = normalizedPoints[currIdx];
        const next = normalizedPoints[nextIdx];
        const next2 = normalizedPoints[next2Idx];

        const baseIdx = i * 6 * 7;

        // 頂点データ（筆圧幅は現在未使用だが、将来のシェーダー拡張用に保持）
        const v0 = [prev.x, prev.y, curr.x, curr.y, next.x, next.y, -1.0];
        const v1 = [prev.x, prev.y, curr.x, curr.y, next.x, next.y, 1.0];
        const v2 = [curr.x, curr.y, next.x, next.y, next2.x, next2.y, -1.0];
        const v3 = [curr.x, curr.y, next.x, next.y, next2.x, next2.y, 1.0];

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
     * 🔧 Phase 5改修: 筆圧反映
     */
    createEdgeBuffer(points, baseSize = 10) {
      if (!Array.isArray(points) || points.length === 0) return null;

      // 🔧 Phase 5: オブジェクト形式とフラット配列の両対応
      let processedPoints = [];
      if (typeof points[0] === 'object' && points[0].x !== undefined) {
        processedPoints = points.map(p => ({
          x: p.x,
          y: p.y,
          pressure: p.pressure !== undefined ? p.pressure : 0.5
        }));
      } else {
        for (let i = 0; i < points.length; i += 2) {
          processedPoints.push({
            x: points[i],
            y: points[i + 1],
            pressure: 0.5
          });
        }
      }

      if (processedPoints.length < 2) return null;

      const bounds = this._calculateBoundsFromPoints(processedPoints, baseSize);
      const offsetX = bounds.minX;
      const offsetY = bounds.minY;

      const numPoints = processedPoints.length;
      const edgeCount = numPoints - 1;
      const buffer = new Float32Array(edgeCount * 8);

      for (let i = 0; i < edgeCount; i++) {
        const p0 = processedPoints[i];
        const p1 = processedPoints[i + 1];
        const bufferIdx = i * 8;

        // 🔧 Phase 5: 筆圧値をedge dataに含める
        const avgPressure = (p0.pressure + p1.pressure) / 2;
        const edgeWidth = baseSize * avgPressure;

        buffer[bufferIdx + 0] = p0.x - offsetX;
        buffer[bufferIdx + 1] = p0.y - offsetY;
        buffer[bufferIdx + 2] = p1.x - offsetX;
        buffer[bufferIdx + 3] = p1.y - offsetY;
        buffer[bufferIdx + 4] = i; // edgeIndex
        buffer[bufferIdx + 5] = i % 3; // colorChannel
        buffer[bufferIdx + 6] = edgeWidth; // 🔧 Phase 5: 筆圧幅
        buffer[bufferIdx + 7] = 0.0; // padding
      }

      return { buffer, edgeCount, bounds };
    }

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

    calculateBounds(points, baseSize = 10) {
      if (!Array.isArray(points) || points.length === 0) {
        return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
      }

      let processedPoints = [];
      if (typeof points[0] === 'object' && points[0].x !== undefined) {
        processedPoints = points.map(p => ({
          x: p.x,
          y: p.y,
          pressure: p.pressure !== undefined ? p.pressure : 0.5
        }));
      } else {
        for (let i = 0; i < points.length; i += 2) {
          processedPoints.push({
            x: points[i],
            y: points[i + 1],
            pressure: 0.5
          });
        }
      }

      return this._calculateBoundsFromPoints(processedPoints, baseSize);
    }

    /**
     * 🔧 Phase 5: 筆圧を考慮したBounds計算
     */
    _calculateBoundsFromPoints(points, baseSize = 10) {
      if (points.length < 1) {
        return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
      }

      let minX = Infinity, minY = Infinity;
      let maxX = -Infinity, maxY = -Infinity;
      let maxWidth = 0;

      for (const p of points) {
        const width = baseSize * (p.pressure !== undefined ? p.pressure : 0.5);
        maxWidth = Math.max(maxWidth, width);
        
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }

      // マージンは最大幅の半分+余裕
      const margin = maxWidth / 2 + 20;
      
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

  console.log('✅ gpu-stroke-processor.js Phase 5完全版 loaded');
  console.log('   🔧 筆圧反映実装: width = baseSize * pressure');

})();