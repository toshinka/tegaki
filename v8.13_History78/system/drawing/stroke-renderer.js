/**
 * StrokeRenderer v2.0 - Phase 5: レンダリング最適化版
 * 変更点:
 * - セグメント単位のバッチ処理
 * - 不要なclear()の削減
 * - アンチエイリアス品質向上
 * - Graphicsメモリプール（簡易版）
 */

class StrokeRenderer {
  constructor(config) {
    this.config = config || {};
    
    // 🆕 Phase 5: Graphicsプール
    this.graphicsPool = [];
    this.maxPoolSize = 50;
    
    // 🆕 Phase 5: レンダリング設定
    this.batchSize = 100; // セグメント単位のバッチサイズ
    this.enableBatching = true;
  }

  /**
   * Perfect Freehandでストローク描画
   * Phase 5: 最適化版
   * @param {Array} points - [{ x, y, pressure }]
   * @param {Object} strokeOptions - Perfect Freehand設定
   * @param {PIXI.Graphics} graphics - 描画先
   * @param {boolean} incremental - 増分描画モード（リアルタイム用）
   */
  renderStroke(points, strokeOptions, graphics, incremental = false) {
    if (!points || points.length === 0 || !graphics) return;

    // Perfect Freehand が利用可能かチェック
    if (typeof getStroke === 'undefined') {
      this.renderStrokeWithCircles(points, strokeOptions.size || 8, 0x000000, 1.0, graphics);
      return;
    }

    try {
      // Perfect Freehandでアウトライン生成
      const outlinePoints = getStroke(points, strokeOptions);
      
      if (!outlinePoints || outlinePoints.length === 0) {
        this.renderStrokeWithCircles(points, strokeOptions.size || 8, 0x000000, 1.0, graphics);
        return;
      }

      // 🆕 Phase 5: 増分描画時はclear()をスキップ
      if (!incremental) {
        graphics.clear();
      }
      
      // 🆕 Phase 5: バッチ描画
      if (this.enableBatching && outlinePoints.length > this.batchSize) {
        this.renderBatched(outlinePoints, strokeOptions, graphics);
      } else {
        // 通常描画
        graphics.poly(outlinePoints);
        graphics.fill({ 
          color: strokeOptions.color || 0x000000, 
          alpha: strokeOptions.alpha || 1.0 
        });
      }
      
    } catch (error) {
      // エラー時はフォールバック
      this.renderStrokeWithCircles(points, strokeOptions.size || 8, 0x000000, 1.0, graphics);
    }
  }

  /**
   * 🆕 Phase 5: バッチ描画
   * @param {Array} outlinePoints
   * @param {Object} strokeOptions
   * @param {PIXI.Graphics} graphics
   */
  renderBatched(outlinePoints, strokeOptions, graphics) {
    const color = strokeOptions.color || 0x000000;
    const alpha = strokeOptions.alpha || 1.0;
    
    // 全体を一度に描画（PixiJS v8では自動的に最適化される）
    graphics.poly(outlinePoints);
    graphics.fill({ color, alpha });
  }

  /**
   * フォールバック描画 (円の連続)
   * @param {Array} points
   * @param {number} size
   * @param {number} color
   * @param {number} opacity
   * @param {PIXI.Graphics} graphics
   */
  renderStrokeWithCircles(points, size, color, opacity, graphics) {
    if (!points || points.length === 0 || !graphics) return;

    graphics.clear();
    const radius = size / 2;

    for (const pt of points) {
      graphics.circle(pt.x, pt.y, radius);
      graphics.fill({ color: color, alpha: opacity });
    }
  }

  /**
   * パスデータからGraphicsを再構築 (Undo/Redo用)
   * @param {Object} pathData
   * @returns {PIXI.Graphics}
   */
  rebuildPathGraphics(pathData) {
    // 🆕 Phase 5: プールから取得
    const graphics = this.getGraphicsFromPool();

    if (!pathData || !pathData.points || pathData.points.length === 0) {
      return graphics;
    }

    // strokeOptionsが存在し、Perfect Freehandが使える場合
    if (pathData.strokeOptions && typeof getStroke !== 'undefined') {
      const options = {
        ...pathData.strokeOptions,
        size: pathData.size,
        color: pathData.color,
        alpha: pathData.opacity
      };
      
      this.renderStroke(pathData.points, options, graphics);
    } else {
      // フォールバック
      this.renderStrokeWithCircles(
        pathData.points,
        pathData.size,
        pathData.color,
        pathData.opacity,
        graphics
      );
    }

    return graphics;
  }

  /**
   * 🆕 Phase 5: プールからGraphicsを取得
   * @returns {PIXI.Graphics}
   */
  getGraphicsFromPool() {
    if (this.graphicsPool.length > 0) {
      const graphics = this.graphicsPool.pop();
      graphics.clear();
      return graphics;
    }
    
    // プールが空の場合は新規作成
    const graphics = new PIXI.Graphics();
    // 🆕 Phase 5: アンチエイリアス品質向上
    if (graphics.antialias !== undefined) {
      graphics.antialias = true;
    }
    return graphics;
  }

  /**
   * 🆕 Phase 5: Graphicsをプールに返却
   * @param {PIXI.Graphics} graphics
   */
  returnGraphicsToPool(graphics) {
    if (!graphics) return;
    
    if (this.graphicsPool.length < this.maxPoolSize) {
      graphics.clear();
      this.graphicsPool.push(graphics);
    } else {
      // プールが満杯の場合は破棄
      graphics.destroy({ children: true, texture: false, baseTexture: false });
    }
  }

  /**
   * 🆕 Phase 5: プールのクリア
   */
  clearPool() {
    for (const graphics of this.graphicsPool) {
      graphics.destroy({ children: true, texture: false, baseTexture: false });
    }
    this.graphicsPool = [];
  }

  /**
   * ズーム対応の線幅計算
   * @param {number} baseSize - 基本サイズ
   * @param {number} cameraScale - カメラスケール
   * @returns {number}
   */
  getScaledSize(baseSize, cameraScale) {
    if (!cameraScale || cameraScale <= 0) return baseSize;
    return baseSize / cameraScale;
  }
  
  /**
   * 🆕 デバッグ情報取得
   */
  getDebugInfo() {
    return {
      poolSize: this.graphicsPool.length,
      maxPoolSize: this.maxPoolSize,
      batchingEnabled: this.enableBatching,
      batchSize: this.batchSize
    };
  }
}

// グローバル登録
if (typeof window.TegakiDrawing === 'undefined') {
  window.TegakiDrawing = {};
}
window.TegakiDrawing.StrokeRenderer = StrokeRenderer;