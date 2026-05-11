/**
 * ============================================================================
 * ファイル名: raster-brush-engine.js
 * 責務: WebGL2ベースのラスター描画エンジン（簡略化版）
 * 依存:
 *   - pixi.js v8 (外部ライブラリ - CDN)
 *   - konva.js v9 (外部ライブラリ - CDN)
 *   - event-bus.js (TegakiEventBus)
 *   - brush-settings.js (brushSettings - シングルトン)
 * 親依存:
 *   - drawing-controller.js → このファイルを参照
 *   - core-runtime.js → このファイルをインスタンス化
 * 子依存:
 *   - このファイルは event-bus.js に依存
 *   - このファイルは brush-settings.js に依存
 * 公開API:
 *   - new RasterBrushEngine(pixiApp, konvaLayerManager)
 *   - startStroke(layerId, point)
 *   - continueStroke(point)
 *   - endStroke()
 *   - clearLayer(layerId)
 * イベント発火:
 *   - 'drawing:stroke-complete' { layerId, bounds }
 * イベント受信:
 *   - 'layer:created' → Canvas作成
 *   - 'layer:deleted' → Canvas削除
 * グローバル登録: window.RasterBrushEngine (クラス定義のみ)
 * 実装状態: 🔧改修 Phase 4 - 簡略化・確実動作版
 * ============================================================================
 */

'use strict';

// ========================================
// グローバル依存確認
// ========================================
if (!window.PIXI) {
  throw new Error('PixiJS v8 が読み込まれていません');
}
if (!window.Konva) {
  throw new Error('Konva.js が読み込まれていません');
}
if (!window.TegakiEventBus) {
  throw new Error('TegakiEventBus が初期化されていません');
}
if (!window.brushSettings) {
  throw new Error('brushSettings が初期化されていません');
}

// ========================================
// RasterBrushEngine - メインクラス
// ========================================
class RasterBrushEngine {
  constructor(pixiApp, konvaLayerManager) {
    this.pixiApp = pixiApp;
    this.konvaLayerManager = konvaLayerManager;
    this.eventBus = window.TegakiEventBus;
    this.brushSettings = window.brushSettings;

    // レイヤーごとのCanvas管理（簡略化: PixiJS不使用）
    this.canvases = new Map(); // layerId → { canvas, ctx }
    
    // 描画状態
    this.isDrawing = false;
    this.currentLayerId = null;
    this.currentStroke = [];
    this.lastPoint = null;
    
    // 🔧 Phase 4.1: リアルタイム更新の間引き制御
    this.updateThrottle = 0; // 更新カウンター
    this.updateInterval = 3; // N回に1回更新（3 = 約60fps→20fps）

    this._setupEventListeners();
    
    console.log('[RasterBrushEngine] Initialized (Phase 4: 簡略化版)');
  }

  // ========================================
  // イベントリスナー設定
  // ========================================
  _setupEventListeners() {
    // レイヤー作成時にCanvas作成
    this.eventBus.on('layer:created', ({ layerId }) => {
      this.createCanvas(layerId);
    });

    // レイヤー削除時にCanvas削除
    this.eventBus.on('layer:deleted', ({ layerId }) => {
      this.destroyCanvas(layerId);
    });
  }

  // ========================================
  // Canvas管理 - 作成
  // ========================================
  createCanvas(layerId) {
    if (this.canvases.has(layerId)) {
      console.warn(`[RasterBrushEngine] Canvas already exists: ${layerId}`);
      return;
    }

    const config = window.TEGAKI_CONFIG;
    const width = config.canvas.width;
    const height = config.canvas.height;

    // Canvas要素作成
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { 
      willReadFrequently: false,
      alpha: true
    });

    // 背景を透明に
    ctx.clearRect(0, 0, width, height);

    this.canvases.set(layerId, {
      canvas,
      ctx,
      width,
      height
    });

    console.log(`[RasterBrushEngine] Canvas created: ${layerId} (${width}x${height})`);
  }

  // ========================================
  // Canvas管理 - 削除
  // ========================================
  destroyCanvas(layerId) {
    const data = this.canvases.get(layerId);
    if (!data) return;

    this.canvases.delete(layerId);
    console.log(`[RasterBrushEngine] Canvas destroyed: ${layerId}`);
  }

  // ========================================
  // 描画 - ストローク開始
  // ========================================
  startStroke(layerId, point) {
    const data = this.canvases.get(layerId);
    if (!data) {
      console.error(`[RasterBrushEngine] Layer not found: ${layerId}`);
      return;
    }

    this.isDrawing = true;
    this.currentLayerId = layerId;
    this.currentStroke = [point];
    this.lastPoint = point;

    // 最初の点を描画
    this._drawPoint(data.ctx, point);
    
    // 🔧 Phase 4.1: 即座にKonva更新（リアルタイム表示）
    this._updateKonvaLayer(layerId);
  }

  // ========================================
  // 描画 - ストローク継続
  // ========================================
  continueStroke(point) {
    if (!this.isDrawing || !this.currentLayerId) return;

    const data = this.canvases.get(this.currentLayerId);
    if (!data) return;

    // 前回の点との間を補間して描画
    this._drawLine(data.ctx, this.lastPoint, point);
    
    this.currentStroke.push(point);
    this.lastPoint = point;
    
    // 🔧 Phase 4.1: 間引き更新（パフォーマンス対策）
    this.updateThrottle++;
    if (this.updateThrottle >= this.updateInterval) {
      this._updateKonvaLayer(this.currentLayerId);
      this.updateThrottle = 0;
    }
  }

  // ========================================
  // 描画 - ストローク終了
  // ========================================
  endStroke() {
    if (!this.isDrawing || !this.currentLayerId) return;

    const data = this.canvases.get(this.currentLayerId);
    if (!data) {
      this._resetDrawingState();
      return;
    }

    // 🔧 Phase 4.1: 最終更新（間引きで更新されなかった分を反映）
    this._updateKonvaLayer(this.currentLayerId);

    // イベント発火
    this.eventBus.emit('drawing:stroke-complete', {
      layerId: this.currentLayerId,
      pointCount: this.currentStroke.length
    });

    this._resetDrawingState();
  }

  // ========================================
  // 内部処理 - 状態リセット
  // ========================================
  _resetDrawingState() {
    this.isDrawing = false;
    this.currentLayerId = null;
    this.currentStroke = [];
    this.lastPoint = null;
    this.updateThrottle = 0; // 🔧 Phase 4.1: カウンターもリセット
  }

  // ========================================
  // 内部処理 - 点の描画
  // ========================================
  _drawPoint(ctx, point) {
    const brush = this.brushSettings.getCurrentBrush();
    const size = brush.size * point.pressure;
    
    // 色をRGBAに変換
    const color = this._hexToRgba(brush.color, brush.opacity);

    ctx.save();
    ctx.globalAlpha = brush.flow;
    ctx.fillStyle = color;
    
    // 円形ブラシ
    ctx.beginPath();
    ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }

  // ========================================
  // 内部処理 - 線の描画（補間）
  // ========================================
  _drawLine(ctx, from, to) {
    const brush = this.brushSettings.getCurrentBrush();
    const spacing = brush.size * brush.spacing;

    // 2点間の距離
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 補間点の数
    const steps = Math.max(1, Math.floor(distance / spacing));

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = from.x + dx * t;
      const y = from.y + dy * t;
      const pressure = from.pressure + (to.pressure - from.pressure) * t;

      this._drawPoint(ctx, { x, y, pressure });
    }
  }

  // ========================================
  // 内部処理 - Konvaレイヤーへの反映
  // ========================================
  _updateKonvaLayer(layerId) {
    const data = this.canvases.get(layerId);
    if (!data) return;

    // KonvaレイヤーのGroupを取得
    const konvaGroup = this.konvaLayerManager.getLayer(layerId);
    if (!konvaGroup) {
      console.warn(`[RasterBrushEngine] Konva layer not found: ${layerId}`);
      return;
    }

    // 既存のImageを探す
    let imageNode = konvaGroup.findOne('Image');
    
    if (!imageNode) {
      // 初回の場合はImage作成
      imageNode = new Konva.Image({
        image: data.canvas,
        x: 0,
        y: 0,
        width: data.width,
        height: data.height
      });
      konvaGroup.add(imageNode);
    } else {
      // 既存のImageを更新
      imageNode.image(data.canvas);
    }

    // 親のLayerを取得して再描画
    const parentLayer = konvaGroup.getLayer();
    if (parentLayer) {
      parentLayer.batchDraw();
    }
  }

  // ========================================
  // ユーティリティ - 色変換
  // ========================================
  _hexToRgba(hex, alpha = 1.0) {
    // 0x800000 → "rgba(128, 0, 0, 1.0)"
    const r = (hex >> 16) & 0xFF;
    const g = (hex >> 8) & 0xFF;
    const b = hex & 0xFF;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // ========================================
  // レイヤー操作 - クリア
  // ========================================
  clearLayer(layerId) {
    const data = this.canvases.get(layerId);
    if (!data) return;

    // Canvasをクリア
    data.ctx.clearRect(0, 0, data.width, data.height);

    // Konvaレイヤーを更新
    this._updateKonvaLayer(layerId);

    console.log(`[RasterBrushEngine] Layer cleared: ${layerId}`);
  }

  // ========================================
  // ユーティリティ - 全レイヤー初期化
  // ========================================
  initializeLayers(layerIds) {
    layerIds.forEach(layerId => {
      this.createCanvas(layerId);
    });
    console.log(`[RasterBrushEngine] Initialized ${layerIds.length} layers`);
  }

  // ========================================
  // デバッグ - Canvas取得
  // ========================================
  getCanvas(layerId) {
    const data = this.canvases.get(layerId);
    return data ? data.canvas : null;
  }

  // ========================================
  // デバッグ - 全Canvas取得
  // ========================================
  getAllCanvases() {
    const result = {};
    this.canvases.forEach((data, layerId) => {
      result[layerId] = data.canvas;
    });
    return result;
  }
}

// ========================================
// グローバル登録
// ========================================
window.RasterBrushEngine = RasterBrushEngine;

console.log('✅ RasterBrushEngine Phase 4.1 loaded (リアルタイム表示対応版)');
console.log('   🔧 PixiJS RenderTexture不使用');
console.log('   🔧 Canvas2D直接描画方式');
console.log('   🔧 brushSettings.getCurrentBrush()対応');
console.log('   🔧 Konva.Image自動更新');
console.log('   🆕 リアルタイム描画表示（間引き更新）');