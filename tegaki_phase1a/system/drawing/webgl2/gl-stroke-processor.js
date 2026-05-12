/**
 * ============================================================================
 * ファイル名: system/drawing/webgl2/gl-stroke-processor.js
 * 責務: ストロークデータをGPU頂点バッファおよびエッジバッファに変換する
 * 依存: perfect-freehand, system/earcut-triangulator.js, config.js, camera-system.js
 * 被依存: stroke-renderer.js
 * 公開API: GLStrokeProcessor, glStrokeProcessor
 * イベント発火: なし
 * イベント受信: なし
 * グローバル登録: window.GLStrokeProcessor
 * 実装状態: ♻️移植
 * ============================================================================
 */

import { getStroke } from 'perfect-freehand';
import { earcutTriangulator } from '../../earcut-triangulator.js';
import { TEGAKI_CONFIG } from '../../../config.js';

export class GLStrokeProcessor {
  constructor() {
    this.gl = null;
    this.initialized = false;
    
    // デバッグフラグ
    this.DEBUG_BOUNDS = false;
    
    // 統計情報
    this.stats = {
      processedStrokes: 0,
      rejectedStrokes: 0,
      clippedStrokes: 0
    };
  }

  /**
   * 初期化
   * @param {WebGL2RenderingContext} gl - WebGL2コンテキスト
   */
  initialize(gl) {
    if (!gl) throw new Error('[GLStrokeProcessor] WebGL2 context required');
    
    this.gl = gl;
    this.initialized = true;
    return true;
  }

  /**
   * ポリゴン頂点バッファ生成
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

    if (!this._validatePoints(processedPoints)) {
      console.error('[GLStrokeProcessor] Invalid point data detected');
      this.stats.rejectedStrokes++;
      return null;
    }

    const bounds = this._calculateBoundsFromPoints(processedPoints, baseSize);
    
    if (!this._isStrokeWithinFrame(bounds)) {
      console.warn('[GLStrokeProcessor] Stroke completely outside camera frame - rejected');
      this.stats.rejectedStrokes++;
      return null;
    }

    const outlinePoints = this._executePerfectFreehand(processedPoints, baseSize);
    
    if (!outlinePoints || outlinePoints.length < 3) {
      console.warn('[GLStrokeProcessor] PerfectFreehand returned insufficient points');
      return null;
    }

    const flat = [];
    for (let i = 0; i < outlinePoints.length; i++) {
      if (!isFinite(outlinePoints[i][0]) || !isFinite(outlinePoints[i][1])) {
        console.error('[GLStrokeProcessor] Invalid outline point', i, outlinePoints[i]);
        this.stats.rejectedStrokes++;
        return null;
      }
      flat.push(outlinePoints[i][0], outlinePoints[i][1]);
    }

    const indices = earcutTriangulator.triangulate(flat, null, 2);
    
    if (!indices || indices.length === 0 || indices.length % 3 !== 0) {
      console.warn('[GLStrokeProcessor] Triangulation failed');
      this.stats.rejectedStrokes++;
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
      buffer[base + 2] = 0.0; // z
      buffer[base + 3] = 0.0; // u
      buffer[base + 4] = 0.0; // v
      buffer[base + 5] = 0.0; // normal_x
      buffer[base + 6] = 0.0; // normal_y
    }

    this.stats.processedStrokes++;

    if (this.DEBUG_BOUNDS) {
      console.log('[GLStrokeProcessor] Vertex buffer created:', {
        vertexCount,
        bounds,
        bufferSize: buffer.length
      });
    }

    return { buffer, vertexCount, bounds };
  }

  /**
   * エッジバッファ生成（MSDF用）
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

    if (!this._validatePoints(processedPoints)) {
      console.error('[GLStrokeProcessor] Invalid point data for edge buffer');
      this.stats.rejectedStrokes++;
      return null;
    }

    const bounds = this._calculateBoundsFromPoints(processedPoints, baseSize);
    
    if (!this._isStrokeWithinFrame(bounds)) {
      console.warn('[GLStrokeProcessor] Edge buffer stroke outside camera frame - rejected');
      this.stats.rejectedStrokes++;
      return null;
    }

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
      
      if (!isFinite(p0x) || !isFinite(p0y) || !isFinite(p1x) || !isFinite(p1y)) {
        console.error('[GLStrokeProcessor] Invalid edge point', i);
        this.stats.rejectedStrokes++;
        return null;
      }
      
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

    this.stats.processedStrokes++;

    return { buffer, edgeCount, bounds };
  }

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

  _normalizePoints(points) {
    let normalized = [];
    
    if (typeof points[0] === 'object' && (points[0].x !== undefined || points[0].localX !== undefined)) {
      normalized = points.map(p => ({
        x: p.localX !== undefined ? p.localX : p.x,
        y: p.localY !== undefined ? p.localY : p.y,
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

  _validatePoints(points) {
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.pressure)) {
        console.error('[GLStrokeProcessor] Invalid point at index', i, p);
        return false;
      }
      if (Math.abs(p.x) > 1e10 || Math.abs(p.y) > 1e10) {
        console.error('[GLStrokeProcessor] Point coordinate out of range', i, p);
        return false;
      }
    }
    return true;
  }

  _executePerfectFreehand(processedPoints, baseSize) {
    const strokePoints = processedPoints.map(p => [p.x, p.y, p.pressure]);
    
    const pfOptions = TEGAKI_CONFIG?.perfectFreehand || {
      size: baseSize,
      thinning: 0.7,
      smoothing: 0.4,
      streamline: 0.3,
      simulatePressure: false,
      last: true
    };
    
    return getStroke(strokePoints, pfOptions);
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

    bounds = this._clipBoundsToCamera(bounds);

    return bounds;
  }

  _clipBoundsToCamera(bounds) {
    const cameraSystem = window.cameraSystem;
    
    if (!cameraSystem?.cameraFrameBounds) {
      return bounds;
    }

    const cf = cameraSystem.cameraFrameBounds;
    
    const clippedMinX = Math.max(bounds.minX, cf.x);
    const clippedMinY = Math.max(bounds.minY, cf.y);
    const clippedMaxX = Math.min(bounds.maxX, cf.x + cf.width);
    const clippedMaxY = Math.min(bounds.maxY, cf.y + cf.height);

    const clippedWidth = Math.max(0, clippedMaxX - clippedMinX);
    const clippedHeight = Math.max(0, clippedMaxY - clippedMinY);

    const wasClipped = (
      clippedMinX !== bounds.minX ||
      clippedMinY !== bounds.minY ||
      clippedMaxX !== bounds.maxX ||
      clippedMaxY !== bounds.maxY
    );

    if (wasClipped) {
      this.stats.clippedStrokes++;
    }

    if (clippedWidth <= 0 || clippedHeight <= 0) {
      return null;
    }

    return {
      minX: clippedMinX,
      minY: clippedMinY,
      maxX: clippedMaxX,
      maxY: clippedMaxY,
      width: clippedWidth,
      height: clippedHeight,
      wasClipped: wasClipped
    };
  }

  _isStrokeWithinFrame(bounds) {
    if (!bounds) return false;
    if (bounds.width <= 0 || bounds.height <= 0) return false;
    return true;
  }

  setDebugMode(enabled) {
    this.DEBUG_BOUNDS = enabled;
    console.log(`[GLStrokeProcessor] Debug mode: ${enabled}`);
  }

  getStats() {
    return { ...this.stats };
  }

  resetStats() {
    this.stats = {
      processedStrokes: 0,
      rejectedStrokes: 0,
      clippedStrokes: 0
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

export const glStrokeProcessor = new GLStrokeProcessor();

// 下位互換性のためにグローバルに登録
window.GLStrokeProcessor = glStrokeProcessor;

console.log('✅ gl-stroke-processor.js (ESM版) loaded');
console.log('   🔧 カメラフレーム外への描画を完全防止');
console.log('   🔧 ポイント座標検証追加');
console.log('   🎯 デバッグ: TegakiDebug.glStroke.*');

