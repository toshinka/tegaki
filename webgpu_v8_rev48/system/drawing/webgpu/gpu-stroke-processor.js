/**
 * ================================================================================
 * gpu-stroke-processor.js Phase 1統合完全版
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
 * 【Phase 1改修内容】
 * ✅ streaming vertex buffer実装（appendPointToStream）
 * ✅ 1024要素staging buffer + 256chunk自動flush
 * ✅ 既存機能完全継承（筆圧反映等）
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
      
      // ✅ Phase 1: streaming buffer管理
      this.stagingBuffer = new Float32Array(1024 * 3);
      this.streamLen = 0;
      this.vertexBuffer = null;
      this.totalVertexCount = 0;
      this.CHUNK_SIZE = 256;
    }

    async initialize(device) {
      if (this.initialized) return;
      this.device = device;
      this.queue = device.queue;
      
      // ✅ Phase 1: streaming用vertex buffer作成
      this.vertexBuffer = device.createBuffer({
        size: 65536 * 3 * 4,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        label: 'streaming-vertex-buffer'
      });
      
      this.initialized = true;
    }

    /**
     * ✅ Phase 1: リアルタイムGPU転送メソッド追加
     */
    appendPointToStream(x, y, pressure, baseSize) {
      if (!this.device) return;

      const width = baseSize * Math.max(0.1, pressure);
      
      const idx = this.streamLen * 3;
      this.stagingBuffer[idx] = x;
      this.stagingBuffer[idx + 1] = y;
      this.stagingBuffer[idx + 2] = width;
      
      this.streamLen++;

      if (this.streamLen >= this.CHUNK_SIZE) {
        this.flushStream();
      }
    }

    /**
     * ✅ Phase 1: staging buffer → GPU転送
     */
    flushStream() {
      if (this.streamLen === 0 || !this.device) return;

      const byteLength = this.streamLen * 3 * 4;
      const data = this.stagingBuffer.subarray(0, this.streamLen * 3);
      
      this.device.queue.writeBuffer(
        this.vertexBuffer,
        this.totalVertexCount * 3 * 4,
        data.buffer,
        0,
        byteLength
      );

      this.totalVertexCount += this.streamLen;
      this.streamLen = 0;
    }

    /**
     * ✅ Phase 1: ストローク終了時の最終flush
     */
    finalizeStroke() {
      this.flushStream();
      const vertexCount = this.totalVertexCount;
      return vertexCount;
    }

    /**
     * ✅ Phase 1: 新規ストローク開始時の初期化
     */
    resetStream() {
      this.streamLen = 0;
      this.totalVertexCount = 0;
    }

    /**
     * ✅ Phase 1: streaming vertex buffer取得
     */
    getVertexBuffer() {
      return this.vertexBuffer;
    }

    /**
     * ✅ Phase 1: 現在の頂点数取得
     */
    getVertexCount() {
      return this.totalVertexCount + this.streamLen;
    }

    /**
     * Phase 5継承: 筆圧反映実装
     */
    createPolygonVertexBuffer(points, baseSize = 10) {
      if (!Array.isArray(points) || points.length === 0) {
        console.warn('[GPUStrokeProcessor] Invalid points');
        return null;
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

      const numPoints = processedPoints.length;
      if (numPoints < 2) {
        console.warn('[GPUStrokeProcessor] Need at least 2 points');
        return null;
      }

      const bounds = this._calculateBoundsFromPoints(processedPoints, baseSize);
      const offsetX = bounds.minX;
      const offsetY = bounds.minY;

      const normalizedPoints = processedPoints.map(p => ({
        x: p.x - offsetX,
        y: p.y - offsetY,
        pressure: p.pressure,
        width: baseSize * p.pressure
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
     * Phase 5継承: 筆圧反映実装
     */
    createEdgeBuffer(points, baseSize = 10) {
      if (!Array.isArray(points) || points.length === 0) return null;

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

        const avgPressure = (p0.pressure + p1.pressure) / 2;
        const edgeWidth = baseSize * avgPressure;

        buffer[bufferIdx + 0] = p0.x - offsetX;
        buffer[bufferIdx + 1] = p0.y - offsetY;
        buffer[bufferIdx + 2] = p1.x - offsetX;
        buffer[bufferIdx + 3] = p1.y - offsetY;
        buffer[bufferIdx + 4] = i;
        buffer[bufferIdx + 5] = i % 3;
        buffer[bufferIdx + 6] = edgeWidth;
        buffer[bufferIdx + 7] = 0.0;
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
     * Phase 5継承: 筆圧を考慮したBounds計算
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

      const margin = maxWidth / 2 + 20;
      
      return {
        minX: minX - margin,
        minY: minY - margin,
        maxX: maxX + margin,
        maxY: maxY + margin
      };
    }

    destroy() {
      if (this.vertexBuffer) {
        this.vertexBuffer.destroy();
        this.vertexBuffer = null;
      }
      this.initialized = false;
    }
  }

  window.GPUStrokeProcessor = new GPUStrokeProcessor();

  console.log('✅ gpu-stroke-processor.js Phase 1統合完全版 loaded');
  console.log('   ✅ streaming vertex buffer実装');
  console.log('   ✅ appendPointToStream / flushStream / finalizeStroke');
  console.log('   ✅ 筆圧反映完全継承');

})();