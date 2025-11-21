/*
 * ================================================================================
 * gl-stroke-processor.js - Phase 3.2 cameraFrameBounds参照版
 * ================================================================================
 * 
 * 📁 親依存:
 *   - libs/perfect-freehand-1.2.0.min.js (window.PerfectFreehand)
 *   - system/earcut-triangulator.js (window.EarcutTriangulator)
 *   - config.js (window.config.perfectFreehand)
 *   - webgl2-drawing-layer.js (WebGL2DrawingLayer.gl)
 *   - camera-system.js (window.cameraSystem.cameraFrameBounds) ← Phase 3.2修正
 * 
 * 📄 子依存:
 *   - brush-core.js (createPolygonVertexBuffer/createEdgeBuffer呼び出し元)
 *   - gl-msdf-pipeline.js (生成されたバッファを受け取る)
 * 
 * 🔧 Phase 3.2改修内容:
 *   🔧 cameraFrame → cameraFrameBounds に参照先変更
 *   🔧 Graphics オブジェクトではなく bounds オブジェクトを参照
 *   ✅ Phase 3.1の全機能を完全継承
 * 
 * 責務:
 *   - PerfectFreehand出力 → GPU頂点バッファ生成
 *   - Earcut三角形分割実行
 *   - EdgeBuffer生成（MSDF用）
 *   - Bounds計算（padding自動調整・カメラフレームクリッピング）
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
    return true;
  }

  /**
   * ポリゴン頂点バッファ生成
   * 🔧 Phase 1.7修正: 頂点座標をLocal座標のまま維持
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

    const processedPoints = this._normalizePoints(points);
    
    if (processedPoints.length < 2) {
      console.warn('[GLStrokeProcessor] Need at least 2 points');
      return null;
    }

    const bounds = this._calculateBoundsFromPoints(processedPoints, baseSize);
    const outlinePoints = this._executePerfectFreehand(processedPoints, baseSize);
    
    if (!outlinePoints || outlinePoints.length < 3) {
      console.warn('[GLStrokeProcessor] PerfectFreehand returned insufficient points');
      return null;
    }

    const flat = [];
    for (let i = 0; i < outlinePoints.length; i++) {
      flat.push(
        outlinePoints[i][0],
        outlinePoints[i][1]
      );
    }

    const indices = window.EarcutTriangulator.triangulate(flat, null, 2);
    
    if (!indices || indices.length === 0 || indices.length % 3 !== 0) {
      console.warn('[GLStrokeProcessor] Triangulation failed');
      return null;
    }

    const floatsPerVertex = 7;
    const vertexCount = indices.length;
    const buffer = new Float32Array(vertexCount * floatsPerVertex);

    for (let vi = 0; vi < indices.length; vi++) {
      const idx = indices[vi];
      const x = flat[idx * 2];
      const y = flat[idx * 2 + 1];
      
      const base = vi * floatsPerVertex;
      buffer[base + 0] = x;
      buffer[base + 1] = y;
      buffer[base + 2] = 0.0;
      buffer[base + 3] = 0.0;
      buffer[base + 4] = 0.0;
      buffer[base + 5] = 0.0;
      buffer[base + 6] = 0.0;
    }

    return { buffer, vertexCount, bounds };
  }

  /**
   * エッジバッファ生成（MSDF用）
   * 🔧 Phase 1.7修正: エッジ座標もLocal座標のまま維持
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

    const edgeCount = outlinePoints.length;
    const floatsPerEdge = 8;
    const buffer = new Float32Array(edgeCount * floatsPerEdge);

    for (let i = 0; i < edgeCount; i++) {
      const p0 = outlinePoints[i];
      const p1 = outlinePoints[(i + 1) % edgeCount];
      
      const p0x = p0[0];
      const p0y = p0[1];
      const p1x = p1[0];
      const p1y = p1[1];
      
      const dx = p1x - p0x;
      const dy = p1y - p0y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1.0;
      const nx = -dy / len;
      const ny = dx / len;

      const base = i * floatsPerEdge;
      buffer[base + 0] = p0x;
      buffer[base + 1] = p0y;
      buffer[base + 2] = p1x;
      buffer[base + 3] = p1y;
      buffer[base + 4] = nx;
      buffer[base + 5] = ny;
      buffer[base + 6] = i;
      buffer[base + 7] = 0.0;
    }

    return { buffer, edgeCount, bounds };
  }

  /**
   * バウンディングボックス計算（公開API）
   * 🔧 Phase 3.1追加: カメラフレームクリッピング
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
    
    if (margin === null) {
      const avgPressure = processedPoints.reduce((sum, p) => sum + (p.pressure || 0.5), 0) / processedPoints.length;
      margin = Math.max(20, avgPressure * 40);
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
      normalized = points.map(p => ({
        x: p.x,
        y: p.y,
        pressure: p.pressure ?? 0.5
      }));
    } else if (Array.isArray(points[0])) {
      normalized = points.map(p => ({
        x: p[0],
        y: p[1],
        pressure: p[2] ?? 0.5
      }));
    } else {
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
   * 🔧 Phase 3.2修正: cameraFrameBounds参照に変更
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

    const strokeWidth = maxX - minX;
    const strokeHeight = maxY - minY;
    const dynamicMargin = Math.max(margin, Math.max(strokeWidth, strokeHeight) * 0.1);

    let bounds = {
      minX: minX - dynamicMargin,
      minY: minY - dynamicMargin,
      maxX: maxX + dynamicMargin,
      maxY: maxY + dynamicMargin,
      width: (maxX - minX) + dynamicMargin * 2,
      height: (maxY - minY) + dynamicMargin * 2
    };

    // 🔧 Phase 3.2修正: カメラフレームでクリッピング
    bounds = this._clipBoundsToCamera(bounds);

    return bounds;
  }

  /**
   * カメラフレームでboundsをクリッピング
   * 🔧 Phase 3.2修正: cameraFrame → cameraFrameBounds に変更
   * @private
   */
  _clipBoundsToCamera(bounds) {
    const cameraSystem = window.cameraSystem;
    
    // 🔧 Phase 3.2: cameraFrameBounds を参照
    if (!cameraSystem?.cameraFrameBounds) {
      console.warn('[GLStrokeProcessor] cameraFrameBounds not available');
      return bounds;
    }

    const cf = cameraSystem.cameraFrameBounds;
    
    // 型チェック: boundsオブジェクトであることを確認
    if (typeof cf !== 'object' || 
        typeof cf.x !== 'number' || 
        typeof cf.y !== 'number' || 
        typeof cf.width !== 'number' || 
        typeof cf.height !== 'number') {
      console.warn('[GLStrokeProcessor] Invalid cameraFrameBounds format', cf);
      return bounds;
    }
    
    // カメラフレーム範囲内に制限
    const clippedMinX = Math.max(bounds.minX, cf.x);
    const clippedMinY = Math.max(bounds.minY, cf.y);
    const clippedMaxX = Math.min(bounds.maxX, cf.x + cf.width);
    const clippedMaxY = Math.min(bounds.maxY, cf.y + cf.height);

    // クリッピング後のサイズ計算
    const clippedWidth = Math.max(0, clippedMaxX - clippedMinX);
    const clippedHeight = Math.max(0, clippedMaxY - clippedMinY);

    // 完全にフレーム外の場合は元のboundsを返す（空描画防止）
    if (clippedWidth <= 0 || clippedHeight <= 0) {
      console.warn('[GLStrokeProcessor] Stroke completely outside camera frame');
      return bounds;
    }

    return {
      minX: clippedMinX,
      minY: clippedMinY,
      maxX: clippedMaxX,
      maxY: clippedMaxY,
      width: clippedWidth,
      height: clippedHeight
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

if (!window.GLStrokeProcessor) {
  window.GLStrokeProcessor = new GLStrokeProcessor();
  console.log('✅ gl-stroke-processor.js Phase 3.2 cameraFrameBounds参照版 loaded');
  console.log('   🔧 cameraFrame → cameraFrameBounds に参照先変更');
  console.log('   🔧 Graphics オブジェクトではなく bounds オブジェクトを参照');
  console.log('   ✅ Phase 3.1の全機能を完全継承');
}