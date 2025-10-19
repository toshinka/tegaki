/**
 * StrokeTransformer v2.1 - Catmull-Rom Spline統合 + パラメータ最適化版
 * 責務:
 * - レイヤー変形対応（既存）
 * - Catmull-Rom Spline補間による滑らか化（新規）
 * - スムージングモード管理（新規）
 * 🔧 v2.1: デフォルト値最適化（segments: 8→4、mediumモード調整）
 */

class StrokeTransformer {
  constructor(config) {
    this.config = config || {};
    
    // 🔧 v2.1: スムージング設定（最適化）
    this.smoothingMode = 'medium'; // 'none' | 'light' | 'medium' | 'strong'
    this.splineTension = 0.5;      // Catmull-Rom tension (0.0～1.0)
    this.splineSegments = 4;       // 補間セグメント数（8→4に最適化）
    this.enableSplineSmoothing = true;
  }

  /**
   * スムージングモードの設定
   * @param {string} mode - 'none' | 'light' | 'medium' | 'strong'
   */
  setSmoothingMode(mode) {
    const validModes = ['none', 'light', 'medium', 'strong'];
    if (!validModes.includes(mode)) {
      mode = 'medium';
    }
    
    this.smoothingMode = mode;
    
    // モードに応じてパラメータを調整
    switch (mode) {
      case 'none':
        this.enableSplineSmoothing = false;
        break;
      
      case 'light':
        this.enableSplineSmoothing = true;
        this.splineTension = 0.3;
        this.splineSegments = 3; // 軽量
        break;
      
      case 'medium':
        this.enableSplineSmoothing = true;
        this.splineTension = 0.5;
        this.splineSegments = 4; // 🔧 v2.1: 8→4に最適化
        break;
      
      case 'strong':
        this.enableSplineSmoothing = true;
        this.splineTension = 0.7;
        this.splineSegments = 6; // 🔧 v2.1: 12→6に最適化
        break;
    }
  }

  /**
   * スプライン設定の詳細カスタマイズ
   * @param {number} tension - 0.0～1.0
   * @param {number} segments - 補間セグメント数
   */
  setSplineParameters(tension, segments) {
    this.splineTension = Math.max(0.0, Math.min(1.0, tension));
    this.splineSegments = Math.max(2, Math.min(20, Math.floor(segments)));
  }

  /**
   * Catmull-Rom Spline補間の適用
   * @param {Array} points - [{ x, y, pressure }]
   * @returns {Array} 補間後の座標
   */
  applyCatmullRomSpline(points) {
    if (!this.enableSplineSmoothing || !points || points.length < 3) {
      return points;
    }
    
    const result = [];
    
    // 最初の点はそのまま追加
    result.push({ ...points[0] });
    
    // 各セグメントを補間
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      
      // セグメントを細分化
      for (let t = 0; t < this.splineSegments; t++) {
        const ratio = (t + 1) / this.splineSegments;
        const interpolated = this.interpolateCatmullRom(p0, p1, p2, p3, ratio);
        result.push(interpolated);
      }
    }
    
    return result;
  }

  /**
   * Catmull-Rom補間の計算
   * @param {Object} p0 - 制御点0
   * @param {Object} p1 - 始点
   * @param {Object} p2 - 終点
   * @param {Object} p3 - 制御点1
   * @param {number} t - 0.0～1.0
   * @returns {Object} { x, y, pressure }
   */
  interpolateCatmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    const tension = this.splineTension;
    
    // Catmull-Rom基底関数
    const v0 = (2 * p1.x);
    const v1 = (-p0.x + p2.x) * tension;
    const v2 = (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * tension;
    const v3 = (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * tension;
    
    const x = 0.5 * (v0 + v1 * t + v2 * t2 + v3 * t3);
    
    const w0 = (2 * p1.y);
    const w1 = (-p0.y + p2.y) * tension;
    const w2 = (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * tension;
    const w3 = (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * tension;
    
    const y = 0.5 * (w0 + w1 * t + w2 * t2 + w3 * t3);
    
    // 筆圧は線形補間
    const pressure = p1.pressure + (p2.pressure - p1.pressure) * t;
    
    return { x, y, pressure };
  }

  /**
   * ストロークの前処理（Simplify → Spline）
   * Perfect Freehandに渡す前の座標最適化
   * @param {Array} points - 生の座標
   * @returns {Array} 最適化後の座標
   */
  preprocessStroke(points) {
    if (!points || points.length < 2) {
      return points;
    }
    
    // Catmull-Rom Spline適用
    const smoothed = this.applyCatmullRomSpline(points);
    
    return smoothed;
  }

  /**
   * B-Spline補間（将来の拡張用）
   * @param {Array} points
   * @returns {Array}
   */
  applyBSpline(points) {
    // TODO: B-Spline実装（必要に応じて）
    return points;
  }

  // ===== 既存のレイヤー変形機能 =====

  /**
   * レイヤー変形をパスに適用
   * @param {Object} path - パスデータ
   * @param {Object} transform - レイヤー変形 { x, y, rotation, scale }
   * @param {number} canvasWidth
   * @param {number} canvasHeight
   * @returns {PIXI.Graphics}
   */
  applyTransformToPath(path, transform, canvasWidth, canvasHeight) {
    if (!path || !path.graphics) return null;

    // 変形が初期値の場合はそのまま返す
    if (this.isTransformNonDefault(transform)) {
      return path.graphics;
    }

    // 変形行列作成
    const matrix = this.createTransformMatrix(transform, canvasWidth, canvasHeight);

    // 新しいGraphicsを作成して変形適用
    const transformedGraphics = path.graphics.clone();
    transformedGraphics.setFromMatrix(matrix);

    return transformedGraphics;
  }

  /**
   * 変形が初期値かチェック
   * @param {Object} transform
   * @returns {boolean}
   */
  isTransformNonDefault(transform) {
    if (!transform) return true;

    return (
      transform.x === 0 &&
      transform.y === 0 &&
      transform.rotation === 0 &&
      transform.scale === 1
    );
  }

  /**
   * 変形用のMatrix生成
   * @param {Object} transform
   * @param {number} canvasWidth
   * @param {number} canvasHeight
   * @returns {PIXI.Matrix}
   */
  createTransformMatrix(transform, canvasWidth, canvasHeight) {
    const matrix = new PIXI.Matrix();

    // 中心点
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    // 変形適用: 平行移動 → 回転 → スケール
    matrix.translate(-centerX, -centerY);
    matrix.rotate(transform.rotation);
    matrix.scale(transform.scale, transform.scale);
    matrix.translate(centerX + transform.x, centerY + transform.y);

    return matrix;
  }

  /**
   * デバッグ情報取得
   */
  getDebugInfo() {
    return {
      smoothingMode: this.smoothingMode,
      splineEnabled: this.enableSplineSmoothing,
      tension: this.splineTension,
      segments: this.splineSegments
    };
  }
}

// グローバル登録
if (typeof window.TegakiDrawing === 'undefined') {
  window.TegakiDrawing = {};
}
window.TegakiDrawing.StrokeTransformer = StrokeTransformer;