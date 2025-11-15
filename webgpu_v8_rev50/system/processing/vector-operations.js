/**
 * ================================================================================
 * vector-operations.js - Phase 1完全版: PerfectFreehand統合
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - libs/perfect-freehand-1.2.0.min.js (window.getStroke必須)
 *   - config.js (window.TEGAKI_CONFIG.perfectFreehand)
 * 
 * 📄 子ファイル使用先:
 *   - gpu-stroke-processor.js (createPolygonVertexBuffer内)
 *   - brush-core.js (間接参照)
 * 
 * 【Phase 1改修内容】
 * ✅ PerfectFreehand APIラッパー完全実装
 * ✅ config.js設定の自動適用
 * ✅ ストロークポイント→輪郭ポリゴン変換
 * 🔥 ジャギー完全解消の基盤
 * 
 * ================================================================================
 */

(function() {
  'use strict';

  class VectorOperations {
    constructor() {
      this.config = null;
      this.initialized = false;
    }

    initialize() {
      if (this.initialized) return;

      if (typeof window.getStroke !== 'function') {
        throw new Error('[VectorOperations] PerfectFreehand (window.getStroke) not loaded. Check libs/perfect-freehand-1.2.0.min.js');
      }

      const tegakiConfig = window.TEGAKI_CONFIG;
      if (!tegakiConfig?.perfectFreehand) {
        console.warn('[VectorOperations] config.perfectFreehand not found, using defaults');
        this.config = {
          thinning: 0,
          smoothing: 0,
          streamline: 0,
          simulatePressure: false,
          easing: (t) => t,
          start: { taper: 0, easing: (t) => t, cap: true },
          end: { taper: 0, easing: (t) => t, cap: true }
        };
      } else {
        this.config = { ...tegakiConfig.perfectFreehand };
      }

      this.initialized = true;
    }

    /**
     * 🔥 Phase 1核心メソッド: ストロークポイント→輪郭ポリゴン変換
     * 
     * @param {Array} points - ストロークポイント配列 [{x, y, pressure}, ...]
     * @param {number} baseSize - ブラシサイズ（デフォルト: 10）
     * @returns {Array} - 輪郭ポリゴン配列 [{x, y}, {x, y}, ...] (閉じた図形)
     * 
     * 【動作】
     * 1. points配列を[x, y, pressure]形式に変換
     * 2. window.getStroke()でPerfectFreehand実行
     * 3. 輪郭ポリゴン（閉じた頂点配列）を取得
     * 4. {x, y}形式に変換して返却
     */
    generateStrokePolygon(points, baseSize = 10) {
      if (!this.initialized) {
        this.initialize();
      }

      if (!points || points.length < 2) {
        console.warn('[VectorOperations] Insufficient points:', points?.length);
        return [];
      }

      // PerfectFreehand入力形式: [x, y, pressure]
      const inputPoints = points.map(p => [p.x, p.y, p.pressure || 0.5]);

      const options = {
        ...this.config,
        size: baseSize,
        last: true // 最終ストローク確定
      };

      try {
        // 🔥 PerfectFreehand実行 → 輪郭ポリゴン取得
        const outlinePoints = window.getStroke(inputPoints, options);
        
        if (!outlinePoints || outlinePoints.length < 3) {
          console.warn('[VectorOperations] PerfectFreehand returned insufficient outline points');
          return [];
        }

        // [x, y] → {x, y} 形式に変換
        const polygon = outlinePoints.map(([x, y]) => ({ x, y }));
        
        return polygon;

      } catch (error) {
        console.error('[VectorOperations] PerfectFreehand execution failed:', error);
        return [];
      }
    }

    /**
     * 設定を動的に更新
     * @param {Object} newConfig - 新しい設定オブジェクト
     */
    updateConfig(newConfig) {
      if (!this.initialized) {
        this.initialize();
      }
      this.config = { ...this.config, ...newConfig };
    }

    /**
     * 現在の設定を取得
     * @returns {Object} 設定オブジェクトのコピー
     */
    getConfig() {
      if (!this.initialized) {
        this.initialize();
      }
      return { ...this.config };
    }

    /**
     * 初期化状態を確認
     * @returns {boolean}
     */
    isInitialized() {
      return this.initialized;
    }
  }

  // グローバル登録
  window.VectorOperations = new VectorOperations();

  console.log('✅ vector-operations.js Phase 1完全版 loaded');
  console.log('   ✓ window.VectorOperations.generateStrokePolygon(points, size)');
  console.log('   ✓ config.js perfectFreehand設定自動適用');
  console.log('   🔥 PerfectFreehand統合基盤完成');

})();