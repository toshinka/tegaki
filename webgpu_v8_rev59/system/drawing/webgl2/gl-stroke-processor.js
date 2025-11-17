/**
 * ================================================================================
 * gl-stroke-processor.js - WebGL2 Stroke Processor
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - stroke-recorder.js (points取得)
 *   - webgl2-drawing-layer.js (gl context)
 *   - libs/perfect-freehand-1.2.0.min.js (window.PerfectFreehand)
 *   - earcut-triangulator.js (window.EarcutTriangulator)
 *   - config.js (perfectFreehand設定)
 * 
 * 📄 子ファイル使用先:
 *   - gl-msdf-pipeline.js (VertexBuffer + edgeCount受け渡し)
 *   - brush-core.js (呼び出し元)
 * 
 * 【責務】
 * - PerfectFreehandアウトライン生成
 * - Earcut三角形分割
 * - アウトラインからEdge生成（MSDF用）
 * - VBO生成・アップロード
 * - Bounds計算
 * 
 * 【WebGPU→WebGL2移行対応】
 * - GPUStrokeProcessorインターフェース互換維持
 * - uploadToGPU()はWebGL2のVBO生成に変更
 * 
 * ================================================================================
 */

(function() {
  'use strict';

  class GLStrokeProcessor {
    constructor() {
      this.gl = null;
      this.initialized = false;
    }

    async initialize(gl) {
      if (this.initialized) return;
      
      if (!window.PerfectFreehand) {
        throw new Error('[GLStrokeProcessor] PerfectFreehand library not found');
      }
      if (!window.EarcutTriangulator) {
        throw new Error('[GLStrokeProcessor] EarcutTriangulator not found');
      }
      
      this.gl = gl || window.WebGL2DrawingLayer?.getGL();
      if (!this.gl) {
        throw new Error('[GLStrokeProcessor] GL context not available');
      }
      
      this.initialized = true;
    }

    createPolygonVertexBuffer(points, baseSize = 10) {
      if (!this.initialized) {
        throw new Error('[GLStrokeProcessor] Not initialized');
      }
      
      if (!Array.isArray(points) || points.length === 0) {
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

      if (processedPoints.length < 2) {
        return null;
      }

      const bounds = this._calculateBoundsFromPoints(processedPoints, baseSize);
      const offsetX = bounds.minX;
      const offsetY = bounds.minY;

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
        return null;
      }

      const polygon = outlinePoints.map(p => [p[0] - offsetX, p[1] - offsetY]);
      const triangles = window.EarcutTriangulator.triangulate(polygon);
      
      if (!triangles || triangles.length === 0) {
        return null;
      }

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
        return null;
      }

      const numOutlinePoints = outlinePoints.length;
      const edgeCount = numOutlinePoints;
      const buffer = new Float32Array(edgeCount * 8);

      for (let i = 0; i < numOutlinePoints; i++) {
        const p0 = outlinePoints[i];
        const p1 = outlinePoints[(i + 1) % numOutlinePoints];
        const bufferIdx = i * 8;

        buffer[bufferIdx + 0] = p0[0] - offsetX;
        buffer[bufferIdx + 1] = p0[1] - offsetY;
        buffer[bufferIdx + 2] = p1[0] - offsetX;
        buffer[bufferIdx + 3] = p1[1] - offsetY;

        const dx = p1[0] - p0[0];
        const dy = p1[1] - p0[1];
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = len > 0 ? -dy / len : 0;
        const ny = len > 0 ? dx / len : 0;

        buffer[bufferIdx + 4] = nx;
        buffer[bufferIdx + 5] = ny;
        buffer[bufferIdx + 6] = i % 3;
        buffer[bufferIdx + 7] = i;
      }

      return { buffer, edgeCount, bounds };
    }

    uploadToGPU(data, usage = 'storage', elementStrideBytes = 8 * 4) {
      if (!this.initialized) {
        throw new Error('[GLStrokeProcessor] Not initialized');
      }

      if (!data || data.length === 0) {
        throw new Error('[GLStrokeProcessor] Empty buffer');
      }

      const gl = this.gl;
      const glBuffer = gl.createBuffer();
      
      if (usage === 'vertex') {
        gl.bindBuffer(gl.ARRAY_BUFFER, glBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      } else {
        gl.bindBuffer(gl.ARRAY_BUFFER, glBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, null);

      const elementCount = Math.floor(data.byteLength / elementStrideBytes);

      return { glBuffer, elementCount };
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

  window.GLStrokeProcessor = new GLStrokeProcessor();

})();