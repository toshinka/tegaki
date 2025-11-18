/*
 * gl-stroke-processor.js - Phase 2完全修正版 + calculateBounds追加
 * 
 * 親依存: window.PerfectFreehand, window.EarcutTriangulator, window.config
 * 子依存: brush-core.js (calculateBounds呼び出し元)
 * グローバル公開: window.GLStrokeProcessor
 * 
 * 責務: PerfectFreehand→VBO生成、WebGL2バッファアップロード、Bounds計算
 * Phase 2修正: Earcutインデックス配列を正しく頂点配列に展開
 * Phase 2+: calculateBounds() API追加（brush-core.js互換）
 */

class GLStrokeProcessor {
  constructor() {
    this.gl = null;
    this.initialized = false;
  }

  initialize(gl) {
    if (!gl) throw new Error('[GLStrokeProcessor] WebGL2 context required');
    if (!window.PerfectFreehand) throw new Error('[GLStrokeProcessor] PerfectFreehand not loaded');
    if (!window.EarcutTriangulator) throw new Error('[GLStrokeProcessor] EarcutTriangulator not loaded');
    
    this.gl = gl;
    this.initialized = true;
    console.log('[GLStrokeProcessor] ✅ Initialized');
    return true;
  }

  createPolygonVertexBuffer(points, baseSize = 10) {
    if (!this.initialized) throw new Error('[GLStrokeProcessor] Not initialized');
    if (!Array.isArray(points) || points.length === 0) {
      console.warn('[GLStrokeProcessor] Invalid points');
      return null;
    }

    // Normalize points to {x, y, pressure} format
    let processedPoints = [];
    if (typeof points[0] === 'object' && points[0].x !== undefined) {
      processedPoints = points.map(p => ({
        x: p.x,
        y: p.y,
        pressure: p.pressure ?? 0.5
      }));
    } else if (Array.isArray(points[0])) {
      processedPoints = points.map(p => ({
        x: p[0],
        y: p[1],
        pressure: p[2] ?? 0.5
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

    // Calculate bounds
    const bounds = this._calculateBoundsFromPoints(processedPoints, baseSize);
    const offsetX = bounds.minX;
    const offsetY = bounds.minY;

    // PerfectFreehand call
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

    // Flatten outline points for Earcut: [x0,y0, x1,y1, ...]
    const flat = [];
    for (let i = 0; i < outlinePoints.length; i++) {
      flat.push(
        outlinePoints[i][0] - offsetX,
        outlinePoints[i][1] - offsetY
      );
    }

    // Earcut triangulation - returns INDEX array [i0,i1,i2, i3,i4,i5, ...]
    const indices = window.EarcutTriangulator.triangulate(flat, null, 2);
    
    if (!indices || indices.length === 0 || indices.length % 3 !== 0) {
      console.warn('[GLStrokeProcessor] Triangulation failed');
      return null;
    }

    // Build interleaved vertex buffer from indices
    // Layout: [posX, posY, 0, 0, 0, 0, 0] = 7 floats per vertex
    const floatsPerVertex = 7;
    const vertexCount = indices.length; // Total vertices after index expansion
    const buffer = new Float32Array(vertexCount * floatsPerVertex);

    for (let vi = 0; vi < indices.length; vi++) {
      const idx = indices[vi];
      const x = flat[idx * 2];
      const y = flat[idx * 2 + 1];
      
      const base = vi * floatsPerVertex;
      buffer[base + 0] = x;
      buffer[base + 1] = y;
      buffer[base + 2] = 0.0; // Reserved for UV or normal
      buffer[base + 3] = 0.0;
      buffer[base + 4] = 0.0;
      buffer[base + 5] = 0.0;
      buffer[base + 6] = 0.0;
    }

    return { buffer, vertexCount, bounds };
  }

  createEdgeBuffer(points, baseSize = 10) {
    if (!this.initialized) throw new Error('[GLStrokeProcessor] Not initialized');
    if (!Array.isArray(points) || points.length === 0) {
      console.warn('[GLStrokeProcessor] Invalid points for edge buffer');
      return null;
    }

    // Normalize points
    let processedPoints = [];
    if (typeof points[0] === 'object' && points[0].x !== undefined) {
      processedPoints = points.map(p => ({
        x: p.x,
        y: p.y,
        pressure: p.pressure ?? 0.5
      }));
    } else if (Array.isArray(points[0])) {
      processedPoints = points.map(p => ({
        x: p[0],
        y: p[1],
        pressure: p[2] ?? 0.5
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

    // PerfectFreehand outline
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
    
    if (!outlinePoints || outlinePoints.length < 2) return null;

    const edgeCount = outlinePoints.length;
    const floatsPerEdge = 8; // p0.xy, p1.xy, normal.xy, edgeId, padding
    const buffer = new Float32Array(edgeCount * floatsPerEdge);

    for (let i = 0; i < edgeCount; i++) {
      const p0 = outlinePoints[i];
      const p1 = outlinePoints[(i + 1) % edgeCount];
      
      const dx = p1[0] - p0[0];
      const dy = p1[1] - p0[1];
      const len = Math.sqrt(dx * dx + dy * dy) || 1.0;
      const nx = -dy / len;
      const ny = dx / len;

      const base = i * floatsPerEdge;
      buffer[base + 0] = p0[0] - offsetX;
      buffer[base + 1] = p0[1] - offsetY;
      buffer[base + 2] = p1[0] - offsetX;
      buffer[base + 3] = p1[1] - offsetY;
      buffer[base + 4] = nx;
      buffer[base + 5] = ny;
      buffer[base + 6] = i; // edgeId
      buffer[base + 7] = 0.0; // padding
    }

    return { buffer, edgeCount, bounds };
  }

  /**
   * Calculate bounds from raw points (public API for brush-core.js)
   * @param {Array} points - Array of point objects or arrays
   * @param {number} margin - Optional margin (default: 20)
   * @returns {Object} bounds - {minX, minY, maxX, maxY, width, height}
   */
  calculateBounds(points, margin = 20) {
    if (!Array.isArray(points) || points.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    }

    // Normalize points to {x, y} format
    let processedPoints = [];
    if (typeof points[0] === 'object' && points[0].x !== undefined) {
      processedPoints = points.map(p => ({ x: p.x, y: p.y }));
    } else if (Array.isArray(points[0])) {
      processedPoints = points.map(p => ({ x: p[0], y: p[1] }));
    } else {
      for (let i = 0; i < points.length; i += 2) {
        processedPoints.push({ x: points[i], y: points[i + 1] });
      }
    }

    return this._calculateBoundsFromPoints(processedPoints, margin);
  }

  uploadToGPU(data, usage = 'vertex', elementStrideBytes = 28) {
    if (!this.initialized) throw new Error('[GLStrokeProcessor] Not initialized');
    if (!data || data.length === 0) throw new Error('[GLStrokeProcessor] Empty buffer');

    const gl = this.gl;
    const glBuffer = gl.createBuffer();
    
    gl.bindBuffer(gl.ARRAY_BUFFER, glBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    if (gl.getError() !== gl.NO_ERROR) {
      console.error('[GLStrokeProcessor] Buffer upload failed');
      return null;
    }

    const elementCount = Math.floor(data.byteLength / elementStrideBytes);

    return { glBuffer, elementCount, data };
  }

  _calculateBoundsFromPoints(points, margin = 20) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }

    return {
      minX: minX - margin,
      minY: minY - margin,
      maxX: maxX + margin,
      maxY: maxY + margin,
      width: (maxX - minX) + margin * 2,
      height: (maxY - minY) + margin * 2
    };
  }

  isInitialized() {
    return this.initialized;
  }

  dispose() {
    this.gl = null;
    this.initialized = false;
  }
}

// Singleton instance
if (!window.GLStrokeProcessor) {
  window.GLStrokeProcessor = new GLStrokeProcessor();
}