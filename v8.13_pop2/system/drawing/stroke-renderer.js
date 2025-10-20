/**
 * StrokeRenderer v3.0 - Phase 1: devicePixelRatio対応版
 * 変更点:
 * - minWidth = 1 / renderer.resolution でDPR対応最小表示幅計算
 * - getMinPhysicalWidth() メソッド追加
 * - DPR=2環境で0.5pxが物理1pxになる計算を実装
 */

class StrokeRenderer {
  constructor(config, renderer = null) {
    this.config = config || {};
    this.renderer = renderer; // 🆕 Phase 1: Pixi.Renderer参照を保持
    
    // Graphicsプール
    this.graphicsPool = [];
    this.maxPoolSize = 50;
    
    // レンダリング設定
    this.batchSize = 100;
    this.enableBatching = true;
    
    // 🆕 Phase 1: devicePixelRatio対応の最小幅設定
    this.baseMinWidth = 1.0; // 基準最小幅（物理ピクセル単位）
  }

  /**
   * 🆕 Phase 1: Rendererを設定（初期化後に呼ばれる）
   * @param {PIXI.Renderer} renderer
   */
  setRenderer(renderer) {
    this.renderer = renderer;
  }

  /**
   * 🆕 Phase 1: devicePixelRatio対応の最小表示幅を取得
   * minWidth = 1 / renderer.resolution
   * 実際の最小描画サイズ = minWidth * devicePixelRatio
   * 
   * @returns {number} 論理ピクセル単位の最小幅
   */
  getMinPhysicalWidth() {
    if (!this.renderer || !this.renderer.resolution) {
      // rendererが無い場合はフォールバック
      const dpr = window.devicePixelRatio || 1;
      return this.baseMinWidth / dpr;
    }
    
    // PixiJS v8: renderer.resolution が DPR を含む
    // minWidth = 1 / resolution (論理ピクセル)
    const minWidth = 1.0 / this.renderer.resolution;
    
    // 実表示上は minWidth * DPR = 物理1ピクセルになる
    return minWidth;
  }

  /**
   * 🆕 Phase 1: 筆圧に応じた幅を計算（最小幅保証付き）
   * @param {number} pressure - 0.0～1.0
   * @param {number} baseSize - 基本ブラシサイズ
   * @returns {number} 実際の描画幅
   */
  getPressureAdjustedWidth(pressure, baseSize) {
    const minWidth = this.getMinPhysicalWidth();
    
    // pressure=0でもminWidthを保証
    if (pressure <= 0) {
      return minWidth;
    }
    
    // リニア補間: minWidth + (baseSize - minWidth) * pressure
    return minWidth + (baseSize - minWidth) * pressure;
  }

  /**
   * Perfect Freehandでストローク描画
   * Phase 1: 最小幅対応版
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
      // 🆕 Phase 1: 最小幅を考慮したstrokeOptions調整
      const adjustedOptions = {
        ...strokeOptions,
        size: Math.max(strokeOptions.size || 8, this.getMinPhysicalWidth())
      };
      
      // Perfect Freehandでアウトライン生成
      const outlinePoints = getStroke(points, adjustedOptions);
      
      if (!outlinePoints || outlinePoints.length === 0) {
        this.renderStrokeWithCircles(points, adjustedOptions.size, 0x000000, 1.0, graphics);
        return;
      }

      // 増分描画時はclear()をスキップ
      if (!incremental) {
        graphics.clear();
      }
      
      // バッチ描画
      if (this.enableBatching && outlinePoints.length > this.batchSize) {
        this.renderBatched(outlinePoints, adjustedOptions, graphics);
      } else {
        // 通常描画
        graphics.poly(outlinePoints);
        graphics.fill({ 
          color: adjustedOptions.color || 0x000000, 
          alpha: adjustedOptions.alpha || 1.0 
        });
      }
      
    } catch (error) {
      // エラー時はフォールバック
      this.renderStrokeWithCircles(points, strokeOptions.size || 8, 0x000000, 1.0, graphics);
    }
  }

  /**
   * バッチ描画
   * @param {Array} outlinePoints
   * @param {Object} strokeOptions
   * @param {PIXI.Graphics} graphics
   */
  renderBatched(outlinePoints, strokeOptions, graphics) {
    const color = strokeOptions.color || 0x000000;
    const alpha = strokeOptions.alpha || 1.0;
    
    graphics.poly(outlinePoints);
    graphics.fill({ color, alpha });
  }

  /**
   * フォールバック描画 (円の連続)
   * Phase 1: 最小幅保証を追加
   * @param {Array} points
   * @param {number} size
   * @param {number} color
   * @param {number} opacity
   * @param {PIXI.Graphics} graphics
   */
  renderStrokeWithCircles(points, size, color, opacity, graphics) {
    if (!points || points.length === 0 || !graphics) return;

    graphics.clear();
    
    // 🆕 Phase 1: 最小幅保証
    const minWidth = this.getMinPhysicalWidth();
    const adjustedSize = Math.max(size, minWidth);
    const radius = adjustedSize / 2;

    for (const pt of points) {
      // 筆圧に応じた半径計算（最小幅保証付き）
      const pressure = pt.pressure || 0.5;
      const pressureRadius = this.getPressureAdjustedWidth(pressure, adjustedSize) / 2;
      
      graphics.circle(pt.x, pt.y, pressureRadius);
      graphics.fill({ color: color, alpha: opacity });
    }
  }

  /**
   * パスデータからGraphicsを再構築 (Undo/Redo用)
   * @param {Object} pathData
   * @returns {PIXI.Graphics}
   */
  rebuildPathGraphics(pathData) {
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
   * プールからGraphicsを取得
   * @returns {PIXI.Graphics}
   */
  getGraphicsFromPool() {
    if (this.graphicsPool.length > 0) {
      const graphics = this.graphicsPool.pop();
      graphics.clear();
      return graphics;
    }
    
    const graphics = new PIXI.Graphics();
    if (graphics.antialias !== undefined) {
      graphics.antialias = true;
    }
    return graphics;
  }

  /**
   * Graphicsをプールに返却
   * @param {PIXI.Graphics} graphics
   */
  returnGraphicsToPool(graphics) {
    if (!graphics) return;
    
    if (this.graphicsPool.length < this.maxPoolSize) {
      graphics.clear();
      this.graphicsPool.push(graphics);
    } else {
      graphics.destroy({ children: true, texture: false, baseTexture: false });
    }
  }

  /**
   * プールのクリア
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
   * デバッグ情報取得
   */
  getDebugInfo() {
    return {
      poolSize: this.graphicsPool.length,
      maxPoolSize: this.maxPoolSize,
      batchingEnabled: this.enableBatching,
      batchSize: this.batchSize,
      // 🆕 Phase 1: devicePixelRatio情報
      devicePixelRatio: window.devicePixelRatio || 1,
      rendererResolution: this.renderer ? this.renderer.resolution : null,
      minPhysicalWidth: this.getMinPhysicalWidth(),
      baseMinWidth: this.baseMinWidth
    };
  }
}

// グローバル登録
if (typeof window.TegakiDrawing === 'undefined') {
  window.TegakiDrawing = {};
}
window.TegakiDrawing.StrokeRenderer = StrokeRenderer;