/**
 * ================================================================================
 * system/processing/vector-operations.js - PerfectFreehand Wrapper
 * ================================================================================
 * 
 * 【責務】
 * - PerfectFreehand ライブラリのラッパー
 * - ストロークポイント → ポリゴン頂点変換
 * - WebGPU向け最適化設定
 * 
 * 【親依存】
 * - libs/perfect-freehand-1.2.0.min.js (window.getStroke)
 * 
 * 【子依存使用先】
 * - gpu-stroke-processor.js (ポリゴン生成呼び出し元)
 * 
 * 【Phase B-1改訂版】
 * ✅ smoothing: 0 → 0.5 復活（ジャギー対策）
 * ✅ WebGPUポリゴンペン最適化設定
 * 
 * ================================================================================
 */

(function() {
  'use strict';

  class VectorOperations {
    /**
     * ストロークポイントからポリゴン頂点生成
     * @param {Array} points - [{x, y, pressure}, ...]
     * @param {number} size - ブラシサイズ
     * @returns {Array} ポリゴン頂点配列 [[x, y], ...]
     */
    static generateStrokePolygon(points, size) {
      if (!window.getStroke) {
        console.error('[VectorOperations] PerfectFreehand not loaded');
        return [];
      }

      if (!points || points.length < 2) {
        return [];
      }

      // PerfectFreehand形式に変換
      const pfPoints = points.map(p => ({
        x: p.x,
        y: p.y,
        pressure: p.pressure !== undefined ? p.pressure : 0.5
      }));

      try {
        // 🔥 Phase B-1改訂版: ジャギー対策設定
        const outlinePoints = window.getStroke(pfPoints, {
          size: size,
          thinning: 0,           // 線の太り補正無効（筆圧を正確に反映）
          smoothing: 0.5,        // 🎨 0→0.5復活（滑らかさ重視）
          streamline: 0,         // 遅延補正なし（リアルタイム性重視）
          simulatePressure: false, // 筆圧シミュレート無効
          easing: t => t,        // リニア補間
          start: {
            taper: 0,
            cap: true
          },
          end: {
            taper: 0,
            cap: true
          }
        });

        return outlinePoints;

      } catch (error) {
        console.error('[VectorOperations] Polygon generation failed:', error);
        return [];
      }
    }

    /**
     * 簡易ポリゴン生成（PerfectFreehandなしフォールバック）
     */
    static generateSimplePolygon(points, size) {
      if (!points || points.length < 2) return [];

      const polygon = [];
      const halfSize = size * 0.5;

      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const radius = halfSize * (p.pressure !== undefined ? p.pressure : 0.5);

        // 円形近似（8角形）
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
          polygon.push([
            p.x + Math.cos(angle) * radius,
            p.y + Math.sin(angle) * radius
          ]);
        }
      }

      return polygon;
    }

    /**
     * ポリゴン頂点数取得
     */
    static getPolygonVertexCount(polygon) {
      return polygon ? polygon.length : 0;
    }

    /**
     * バウンディングボックス計算
     */
    static calculateBounds(points) {
      if (!points || points.length === 0) {
        return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
      }

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const p of points) {
        const x = Array.isArray(p) ? p[0] : p.x;
        const y = Array.isArray(p) ? p[1] : p.y;

        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }

      return { minX, minY, maxX, maxY };
    }
  }

  // グローバル公開
  window.VectorOperations = VectorOperations;

  console.log('✅ vector-operations.js (Phase B-1改訂版) loaded');
  console.log('   🎨 PerfectFreehand復活');
  console.log('   ✅ smoothing: 0.5 (ジャギー対策)');

})();