/**
 * ================================================================================
 * gpu-stroke-processor.js Phase C-0修正版: EdgeBuffer PerfectFreehand統合
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - stroke-recorder.js (points取得)
 *   - webgpu-drawing-layer.js (device/queue)
 *   - libs/perfect-freehand-1.2.0.min.js (window.PerfectFreehand)
 *   - earcut-triangulator.js (window.EarcutTriangulator)
 *   - config.js (perfectFreehand設定)
 * 
 * 📄 子ファイル使用先:
 *   - msdf-pipeline-manager.js (VertexBuffer + edgeCount受け渡し)
 *   - brush-core.js (呼び出し元)
 * 
 * 【Phase C-0修正内容】
 * 🔥 createEdgeBuffer: PerfectFreehandアウトライン使用に修正
 * 🔥 アウトラインの閉じたループからエッジ生成
 * 🔥 streaming処理完全削除
 * ✅ config.js perfectFreehand設定反映
 * 
 * 責務:
 *   - PerfectFreehandアウトライン生成
 *   - Earcut三角形分割
 *   - アウトラインからEdge生成（MSDF用）
 *   - GPU Buffer生成・アップロード
 *   - Bounds計算
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
      
      if (!window.PerfectFreehand) {
        throw new Error('[GPUStrokeProcessor] PerfectFreehand library not found');
      }
      if (!window.EarcutTriangulator) {
        throw new Error('[GPUStrokeProcessor] EarcutTriangulator not found');
      }
      
      this.device = device;
      this.queue = device.queue;
      this.initialized = true;
    }

    /**
     * 🔥 Phase C-0: PerfectFreehand専用化
     */
    createPolygonVertexBuffer(points, baseSize = 10) {
      if (!this.initialized) {
        throw new Error('[GPUStrokeProcessor] Not initialized');
      }
      
      if (!Array.isArray(points) || points.length === 0) {
        console.warn('[GPUStrokeProcessor] Invalid points');
        return null;
      }

      // points正規化
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

      if (processedPoints.length < 2) {
        console.warn('[GPUStrokeProcessor] Need at least 2 points');
        return null;
      }

      // Bounds計算
      const bounds = this._calculateBoundsFromPoints(processedPoints, baseSize);
      const offsetX = bounds.minX;
      const offsetY = bounds.minY;

      // PerfectFreehand実行
      const strokePoints = processedPoints.map(p => [p.x, p.y, p.pressure]);
      
      const pfOptions = window.config?.perfectFreehand || {
        size: baseSize,
        thinning: 0,
        smoothing: 0,
        streamline: 0,
        simulatePressure: false,
        last: true
      };

      const outlinePoints = window.PerfectFreehand(strokePoints, pfOptions);
      
      if (!outlinePoints || outlinePoints.length < 3) {
        console.warn('[GPUStrokeProcessor] PerfectFreehand returned insufficient points');
        return null;
      }

      // Earcut三角形分割
      const polygon = outlinePoints.map(p => [p[0] - offsetX, p[1] - offsetY]);
      const triangles = window.EarcutTriangulator.triangulate(polygon);
      
      if (!triangles || triangles.length === 0) {
        console.warn('[GPUStrokeProcessor] Triangulation failed');
        return null;
      }

      // GPU Buffer生成
      const vertexCount = triangles.length;
      const buffer = new Float32Array(vertexCount * 7);

      for (let i = 0; i < triangles.length; i++) {
        const tri = triangles[i];
        const bufferIdx = i * 7;
        buffer[bufferIdx + 0] = tri[0];
        buffer[bufferIdx + 1] = tri[1];
        buffer[bufferIdx + 2] = tri[0];
        buffer[bufferIdx + 3] = tri[1];
        buffer[bufferIdx + 4] = tri[0];
        buffer[bufferIdx + 5] = tri[1];
        buffer[bufferIdx + 6] = 0.0;
      }

      return { buffer, vertexCount, bounds };
    }

    /**
     * 🔥 Phase C-0修正: PerfectFreehandアウトラインからEdge生成
     */
    createEdgeBuffer(points, baseSize = 10) {
      if (!Array.isArray(points) || points.length === 0) return null;

      // points正規化
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

      // Bounds計算
      const bounds = this._calculateBoundsFromPoints(processedPoints, baseSize);
      const offsetX = bounds.minX;
      const offsetY = bounds.minY;

      // 🔥 PerfectFreehand実行（アウトライン取得）
      const strokePoints = processedPoints.map(p => [p.x, p.y, p.pressure]);
      
      const pfOptions = window.config?.perfectFreehand || {
        size: baseSize,
        thinning: 0,
        smoothing: 0,
        streamline: 0,
        simulatePressure: false,
        last: true
      };

      const outlinePoints = window.PerfectFreehand(strokePoints, pfOptions);
      
      if (!outlinePoints || outlinePoints.length < 3) {
        console.warn('[GPUStrokeProcessor] PerfectFreehand returned insufficient outline points');
        return null;
      }

      // 🔥 アウトライン点からエッジ生成（閉じたループ）
      const numOutlinePoints = outlinePoints.length;
      const edgeCount = numOutlinePoints; // 最後の点→最初の点も含める
      const buffer = new Float32Array(edgeCount * 8);

      for (let i = 0; i < numOutlinePoints; i++) {
        const p0 = outlinePoints[i];
        const p1 = outlinePoints[(i + 1) % numOutlinePoints]; // ループ
        const bufferIdx = i * 8;

        // Edge座標（offset適用）
        buffer[bufferIdx + 0] = p0[0] - offsetX;
        buffer[bufferIdx + 1] = p0[1] - offsetY;
        buffer[bufferIdx + 2] = p1[0] - offsetX;
        buffer[bufferIdx + 3] = p1[1] - offsetY;

        // Normal計算
        const dx = p1[0] - p0[0];
        const dy = p1[1] - p0[1];
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = len > 0 ? -dy / len : 0;
        const ny = len > 0 ? dx / len : 0;

        buffer[bufferIdx + 4] = nx;
        buffer[bufferIdx + 5] = ny;
        buffer[bufferIdx + 6] = i % 3; // channelId
        buffer[bufferIdx + 7] = i; // edgeId
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
      this.initialized = false;
    }
  }

  window.GPUStrokeProcessor = new GPUStrokeProcessor();

  console.log('✅ gpu-stroke-processor.js Phase C-0修正版 loaded');
  console.log('   🔥 EdgeBuffer: PerfectFreehandアウトライン使用');

})();