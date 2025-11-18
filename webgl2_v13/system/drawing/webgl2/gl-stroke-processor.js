/*
 * ================================================================================
 * gl-stroke-processor.js - Phase 1座標修正版
 * ================================================================================
 * 
 * 📁 親依存:
 *   - libs/perfect-freehand-1.2.0.min.js (window.PerfectFreehand)
 *   - system/earcut-triangulator.js (window.EarcutTriangulator)
 *   - config.js (window.config.perfectFreehand)
 *   - webgl2-drawing-layer.js (WebGL2DrawingLayer.gl)
 * 
 * 📄 子依存:
 *   - brush-core.js (createPolygonVertexBuffer/createEdgeBuffer呼び出し元)
 *   - gl-msdf-pipeline.js (生成されたバッファを受け取る)
 * 
 * 🔧 Phase 1改修内容:
 *   ✅ offsetX/Y計算を削除 - Local座標をそのまま使用
 *   ✅ 座標変換を一元化（drawing-engineで完結）
 *   ✅ bounds計算を最適化
 *   ✅ 不要なコンソールログ削除
 * 
 * 責務:
 *   - PerfectFreehand出力 → GPU頂点バッファ生成
 *   - Earcut三角形分割実行
 *   - EdgeBuffer生成（MSDF用）
 *   - Bounds計算（padding自動調整）
 * 
 * ================================================================================
 */

class GLStrokeProcessor {
  constructor() {
    this.gl = null;
    this.initialized = false;
  }

  /**
   * 初期化
   * @param {WebGL2RenderingContext} gl - WebGL2コンテキスト
   */
  initialize(gl) {
    if (!gl) throw new Error('[GLStrokeProcessor] WebGL2 context required');
    if (!window.PerfectFreehand) throw new Error('[GLStrokeProcessor] PerfectFreehand not loaded');
    if (!window.EarcutTriangulator) throw new Error('[GLStrokeProcessor] EarcutTriangulator not loaded');
    
    this.gl = gl;
    this.initialized = true;
    console.log('[GLStrokeProcessor] ✅ Initialized');
    return true;
  }

  /**
   * ポリゴン頂点バッファ生成
   * ✅ Phase 1修正: offsetX/Y削除、Local座標をそのまま使用
   * 
   * @param {Array} points - ストロークポイント配列
   * @param {number} baseSize - ブラシサイズ
   * @returns {Object|null} { buffer: Float32Array, vertexCount: number, bounds: Object }
   */
  createPolygonVertexBuffer(points, baseSize = 10) {
    if (!this.initialized) throw new Error('[GLStrokeProcessor] Not initialized');
    if (!Array.isArray(points) || points.length === 0) {
      console.warn('[GLStrokeProcessor] Invalid points');
      return null;
    }

    // ポイント正規化: {x, y, pressure}形式に統一
    const processedPoints = this._normalizePoints(points);
    
    if (processedPoints.length < 2) {
      console.warn('[GLStrokeProcessor] Need at least 2 points');
      return null;
    }

    // Bounds計算（動的margin）
    const bounds = this._calculateBoundsFromPoints(processedPoints, baseSize);

    // PerfectFreehand実行
    const outlinePoints = this._executePerfectFreehand(processedPoints, baseSize);
    
    if (!outlinePoints || outlinePoints.length < 3) {
      console.warn('[GLStrokeProcessor] PerfectFreehand returned insufficient points');
      return null;
    }

    // ✅ Phase 1修正: offsetを使わず、Local座標をそのまま使用
    const flat = [];
    for (let i = 0; i < outlinePoints.length; i++) {
      flat.push(
        outlinePoints[i][0],  // Local X座標（オフセット減算なし）
        outlinePoints[i][1]   // Local Y座標（オフセット減算なし）
      );
    }

    // Earcut三角形分割
    const indices = window.EarcutTriangulator.triangulate(flat, null, 2);
    
    if (!indices || indices.length === 0 || indices.length % 3 !== 0) {
      console.warn('[GLStrokeProcessor] Triangulation failed');
      return null;
    }

    // インターリーブ頂点バッファ生成
    // レイアウト: [posX, posY, texU, texV, reserved1, reserved2, reserved3] = 7 floats/vertex
    const floatsPerVertex = 7;
    const vertexCount = indices.length;
    const buffer = new Float32Array(vertexCount * floatsPerVertex);

    for (let vi = 0; vi < indices.length; vi++) {
      const idx = indices[vi];
      const x = flat[idx * 2];
      const y = flat[idx * 2 + 1];
      
      const base = vi * floatsPerVertex;
      buffer[base + 0] = x;    // Position X (Local座標)
      buffer[base + 1] = y;    // Position Y (Local座標)
      buffer[base + 2] = 0.0;  // TexCoord U (将来実装用)
      buffer[base + 3] = 0.0;  // TexCoord V (将来実装用)
      buffer[base + 4] = 0.0;  // Reserved
      buffer[base + 5] = 0.0;  // Reserved
      buffer[base + 6] = 0.0;  // Reserved
    }

    return { buffer, vertexCount, bounds };
  }

  /**
   * エッジバッファ生成（MSDF用）
   * ✅ Phase 1修正: offsetX/Y削除
   * 
   * @param {Array} points - ストロークポイント配列
   * @param {number} baseSize - ブラシサイズ
   * @returns {Object|null} { buffer: Float32Array, edgeCount: number, bounds: Object }
   */
  createEdgeBuffer(points, baseSize = 10) {
    if (!this.initialized) throw new Error('[GLStrokeProcessor] Not initialized');
    if (!Array.isArray(points) || points.length === 0) {
      console.warn('[GLStrokeProcessor] Invalid points for edge buffer');
      return null;
    }

    const processedPoints = this._normalizePoints(points);
    
    if (processedPoints.length < 2) return null;

    const bounds = this._calculateBoundsFromPoints(processedPoints, baseSize);
    const outlinePoints = this._executePerfectFreehand(processedPoints, baseSize);
    
    if (!outlinePoints || outlinePoints.length < 2) return null;

    // エッジバッファ生成
    // レイアウト: [p0.x, p0.y, p1.x, p1.y, normal.x, normal.y, edgeId, padding] = 8 floats/edge
    const edgeCount = outlinePoints.length;
    const floatsPerEdge = 8;
    const buffer = new Float32Array(edgeCount * floatsPerEdge);

    for (let i = 0; i < edgeCount; i++) {
      const p0 = outlinePoints[i];
      const p1 = outlinePoints[(i + 1) % edgeCount];
      
      // ✅ Phase 1修正: Local座標をそのまま使用
      const dx = p1[0] - p0[0];
      const dy = p1[1] - p0[1];
      const len = Math.sqrt(dx * dx + dy * dy) || 1.0;
      const nx = -dy / len;  // 法線X
      const ny = dx / len;   // 法線Y

      const base = i * floatsPerEdge;
      buffer[base + 0] = p0[0];  // P0 X (Local座標)
      buffer[base + 1] = p0[1];  // P0 Y (Local座標)
      buffer[base + 2] = p1[0];  // P1 X (Local座標)
      buffer[base + 3] = p1[1];  // P1 Y (Local座標)
      buffer[base + 4] = nx;     // Normal X
      buffer[base + 5] = ny;     // Normal Y
      buffer[base + 6] = i;      // Edge ID
      buffer[base + 7] = 0.0;    // Padding
    }

    return { buffer, edgeCount, bounds };
  }

  /**
   * バウンディングボックス計算（公開API）
   * 
   * @param {Array} points - ポイント配列
   * @param {number} margin - マージン（省略時は自動計算）
   * @returns {Object} { minX, minY, maxX, maxY, width, height }
   */
  calculateBounds(points, margin = null) {
    if (!Array.isArray(points) || points.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    }

    const processedPoints = this._normalizePoints(points);
    
    // margin省略時は自動計算
    if (margin === null) {
      const avgPressure = processedPoints.reduce((sum, p) => sum + (p.pressure || 0.5), 0) / processedPoints.length;
      margin = Math.max(20, avgPressure * 40); // 筆圧に応じた動的margin
    }
    
    return this._calculateBoundsFromPoints(processedPoints, margin);
  }

  /**
   * GPUバッファアップロード
   * 
   * @param {Float32Array} data - バッファデータ
   * @param {string} usage - 用途 ('vertex' | 'storage')
   * @param {number} elementStrideBytes - 要素のバイト幅
   * @returns {Object|null} { glBuffer: WebGLBuffer, elementCount: number, data: Float32Array }
   */
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

  /**
   * ポイント正規化（内部メソッド）
   * @private
   */
  _normalizePoints(points) {
    let normalized = [];
    
    if (typeof points[0] === 'object' && points[0].x !== undefined) {
      // {x, y, pressure} 形式
      normalized = points.map(p => ({
        x: p.x,
        y: p.y,
        pressure: p.pressure ?? 0.5
      }));
    } else if (Array.isArray(points[0])) {
      // [x, y, pressure] 形式
      normalized = points.map(p => ({
        x: p[0],
        y: p[1],
        pressure: p[2] ?? 0.5
      }));
    } else {
      // フラット配列 [x, y, x, y, ...] 形式
      for (let i = 0; i < points.length; i += 2) {
        normalized.push({
          x: points[i],
          y: points[i + 1],
          pressure: 0.5
        });
      }
    }
    
    return normalized;
  }

  /**
   * PerfectFreehand実行（内部メソッド）
   * @private
   */
  _executePerfectFreehand(processedPoints, baseSize) {
    const strokePoints = processedPoints.map(p => [p.x, p.y, p.pressure]);
    
    const pfOptions = window.config?.perfectFreehand || {
      size: baseSize,
      thinning: 0,
      smoothing: 0,
      streamline: 0,
      simulatePressure: false,
      last: true
    };
    
    return window.PerfectFreehand(strokePoints, pfOptions);
  }

  /**
   * Bounds計算（内部メソッド）
   * ✅ Phase 1修正: 動的margin計算
   * @private
   */
  _calculateBoundsFromPoints(points, margin = 20) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }

    // 動的margin: ブラシサイズやストローク範囲に応じて調整
    const strokeWidth = maxX - minX;
    const strokeHeight = maxY - minY;
    const dynamicMargin = Math.max(margin, Math.max(strokeWidth, strokeHeight) * 0.1);

    return {
      minX: minX - dynamicMargin,
      minY: minY - dynamicMargin,
      maxX: maxX + dynamicMargin,
      maxY: maxY + dynamicMargin,
      width: (maxX - minX) + dynamicMargin * 2,
      height: (maxY - minY) + dynamicMargin * 2
    };
  }

  /**
   * 初期化状態確認
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * 破棄
   */
  dispose() {
    this.gl = null;
    this.initialized = false;
  }
}

// Singletonインスタンス
if (!window.GLStrokeProcessor) {
  window.GLStrokeProcessor = new GLStrokeProcessor();
  console.log('[GLStrokeProcessor] ✅ Singleton instance created');
}