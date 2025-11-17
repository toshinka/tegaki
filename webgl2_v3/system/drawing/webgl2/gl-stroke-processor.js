/**
 * ================================================================================
 * gl-stroke-processor.js - Phase 2: WebGL2 Stroke Processor
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - stroke-recorder.js (points取得)
 *   - webgl2-drawing-layer.js (WebGL2DrawingLayer.gl)
 *   - libs/perfect-freehand-1.2.0.min.js (window.PerfectFreehand)
 *   - earcut-triangulator.js (window.EarcutTriangulator)
 *   - config.js (perfectFreehand設定)
 * 
 * 📄 子ファイル使用先:
 *   - gl-msdf-pipeline.js (VertexBuffer + edgeCount受け渡し)
 *   - brush-core.js (呼び出し元)
 * 
 * 【責務】
 * - PerfectFreehandアウトライン生成（既存ロジック完全継承）
 * - Earcut三角形分割
 * - アウトラインからEdge生成（MSDF用）
 * - WebGL2 VBO生成・アップロード（GPUBuffer → gl.createBuffer）
 * - Bounds計算
 * 
 * 【Phase 2実装内容】
 * ✅ createPolygonVertexBuffer: PF→Earcut→Float32Array生成
 * ✅ createEdgeBuffer: PFアウトライン→Edge配列
 * ✅ uploadToGPU: gl.createBuffer() + gl.bufferData()
 * ✅ WebGPU版ロジック完全継承
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

    /**
     * 初期化
     * @param {WebGL2RenderingContext} gl - WebGL2コンテキスト
     */
    async initialize(gl) {
      if (this.initialized) {
        console.warn('[GLStrokeProcessor] Already initialized');
        return;
      }
      
      if (!window.PerfectFreehand) {
        throw new Error('[GLStrokeProcessor] PerfectFreehand library not found');
      }
      if (!window.EarcutTriangulator) {
        throw new Error('[GLStrokeProcessor] EarcutTriangulator not found');
      }
      
      this.gl = gl;
      this.initialized = true;
      
      console.log('[GLStrokeProcessor] ✅ Initialized');
    }

    /**
     * ポリゴン頂点バッファ生成
     * ✅ WebGPU版ロジック完全継承
     * 
     * @param {Array} points - ストロークポイント配列
     * @param {number} baseSize - ブラシサイズ
     * @returns {Object} {buffer: Float32Array, vertexCount, bounds}
     */
    createPolygonVertexBuffer(points, baseSize = 10) {
      if (!this.initialized) {
        throw new Error('[GLStrokeProcessor] Not initialized');
      }
      
      if (!Array.isArray(points) || points.length === 0) {
        console.warn('[GLStrokeProcessor] Invalid points');
        return null;
      }

      // points正規化（既存ロジック完全継承）
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
        console.warn('[GLStrokeProcessor] Need at least 2 points');
        return null;
      }

      // Bounds計算
      const bounds = this._calculateBoundsFromPoints(processedPoints, baseSize);
      const offsetX = bounds.minX;
      const offsetY = bounds.minY;

      // PerfectFreehand実行（config.js設定反映）
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
        console.warn('[GLStrokeProcessor] PerfectFreehand returned insufficient points');
        return null;
      }

      // Earcut三角形分割
      const polygon = outlinePoints.map(p => [p[0] - offsetX, p[1] - offsetY]);
      const triangles = window.EarcutTriangulator.triangulate(polygon);
      
      if (!triangles || triangles.length === 0) {
        console.warn('[GLStrokeProcessor] Triangulation failed');
        return null;
      }

      // Float32Array生成（WebGPU版と同一形式）
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
     * Edgeバッファ生成（MSDF用）
     * ✅ WebGPU版ロジック完全継承
     * 
     * @param {Array} points - ストロークポイント配列
     * @param {number} baseSize - ブラシサイズ
     * @returns {Object} {buffer: Float32Array, edgeCount, bounds}
     */
    createEdgeBuffer(points, baseSize = 10) {
      if (!Array.isArray(points) || points.length === 0) {
        console.warn('[GLStrokeProcessor] Invalid points for edge buffer');
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

      if (processedPoints.length < 2) return null;

      // Bounds計算
      const bounds = this._calculateBoundsFromPoints(processedPoints, baseSize);
      const offsetX = bounds.minX;
      const offsetY = bounds.minY;

      // PerfectFreehand実行（アウトライン取得）
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
        console.warn('[GLStrokeProcessor] PerfectFreehand returned insufficient outline points');
        return null;
      }

      // アウトライン点からエッジ生成（閉じたループ）
      const numOutlinePoints = outlinePoints.length;
      const edgeCount = numOutlinePoints;
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

    /**
     * WebGL2 VBO生成・アップロード
     * 🔧 Phase 2実装: GPUBuffer → gl.createBuffer()変換
     * 
     * @param {Float32Array} data - バッファデータ
     * @param {string} usage - 'vertex' | 'storage'
     * @returns {Object} {glBuffer: WebGLBuffer, elementCount}
     */
    uploadToGPU(data, usage = 'storage') {
      if (!this.initialized) {
        throw new Error('[GLStrokeProcessor] Not initialized');
      }

      if (!data || data.length === 0) {
        throw new Error('[GLStrokeProcessor] Empty buffer');
      }

      const gl = this.gl;
      const glBuffer = gl.createBuffer();
      
      // Buffer type決定
      let target;
      if (usage === 'vertex') {
        target = gl.ARRAY_BUFFER;
      } else {
        // WebGL2ではSTORAGE_BUFFERは存在しないが、
        // Texture経由でShaderに渡すため、とりあえずARRAY_BUFFERで作成
        target = gl.ARRAY_BUFFER;
      }
      
      gl.bindBuffer(target, glBuffer);
      gl.bufferData(target, data, gl.STATIC_DRAW);
      gl.bindBuffer(target, null);

      const elementStrideBytes = usage === 'vertex' ? 7 * 4 : 8 * 4;
      const elementCount = Math.floor(data.byteLength / elementStrideBytes);

      return { glBuffer, elementCount, data }; // dataも返す（Texture化用）
    }

    /**
     * Bounds計算
     * ✅ WebGPU版完全継承
     */
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
     * Bounds計算（内部用）
     * ✅ WebGPU版完全継承
     * @private
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

    /**
     * クリーンアップ
     */
    destroy() {
      this.initialized = false;
      this.gl = null;
    }
  }

  // Singleton登録
  window.GLStrokeProcessor = new GLStrokeProcessor();

  console.log('✅ gl-stroke-processor.js Phase 2完全版 loaded');
  console.log('   ✅ PerfectFreehand→VBO生成実装完了');
  console.log('   ✅ WebGPU版ロジック完全継承');

})();