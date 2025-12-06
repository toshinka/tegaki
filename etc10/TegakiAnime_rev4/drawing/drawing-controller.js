/**
 * ============================================================================
 * ファイル名: drawing-controller.js
 * 責務: ポインターイベントとRasterBrushEngineの統合
 * 依存:
 *   - konva (外部ライブラリ - libs/konva.min.js)
 *   - event-bus.js (TegakiEventBus)
 *   - raster-brush-engine.js (RasterBrushEngine)
 *   - pointer-handler.js (PointerHandler - optional)
 * 親依存:
 *   - core-runtime.js → このファイルをインスタンス化
 * 子依存:
 *   - konva.min.js
 *   - event-bus.js
 *   - raster-brush-engine.js
 * 公開API:
 *   - new DrawingController(stage, brushEngine): コンストラクタ
 *   - enable(): 描画有効化
 *   - disable(): 描画無効化
 * イベント発火: なし
 * イベント受信: なし
 * グローバル登録: window.DrawingController (クラス定義のみ)
 * 実装状態: 🔧改修 Phase 3 - インスタンス参照修正版
 * ============================================================================
 */

'use strict';

// ========================================
// グローバル依存確認
// ========================================
if (!window.Konva) {
  throw new Error('Konva.js が読み込まれていません');
}
if (!window.TegakiEventBus) {
  throw new Error('TegakiEventBus が初期化されていません');
}

// ========================================
// DrawingController - クラス定義
// ========================================
class DrawingController {
  constructor(stage, brushEngine) {
    if (!stage) {
      throw new Error('Konva.Stage が渡されていません');
    }
    if (!brushEngine) {
      throw new Error('RasterBrushEngine が渡されていません');
    }

    this.stage = stage;
    this.brushEngine = brushEngine;
    this.eventBus = window.TegakiEventBus;
    
    this.enabled = false;
    
    // バインド（イベントハンドラーで正しいthisを保持）
    this._handlePointerDown = this._handlePointerDown.bind(this);
    this._handlePointerMove = this._handlePointerMove.bind(this);
    this._handlePointerUp = this._handlePointerUp.bind(this);
    
    console.log('[DrawingController] Initialized');
  }

  // ========================================
  // 座標変換 - Konva → Canvas
  // ========================================
  _getCanvasCoordinates() {
    const pos = this.stage.getPointerPosition();
    if (!pos) return null;
    
    // Phase 3では簡易実装: Konva座標 = Canvas座標
    // Phase 4でカメラシステム統合時に変更
    return {
      x: pos.x,
      y: pos.y
    };
  }

  // ========================================
  // 筆圧取得
  // ========================================
  _getPressure(evt) {
    // PointerEvent.pressure対応
    if (evt.pressure !== undefined && evt.pressure > 0) {
      return evt.pressure;
    }
    
    // マウスの場合はデフォルト0.5
    return 0.5;
  }

  // ========================================
  // ポインターダウンハンドラー
  // ========================================
  _handlePointerDown(konvaEvt) {
    if (!this.enabled) return;

    const evt = konvaEvt.evt; // ネイティブPointerEvent取得
    
    // イベント重複防止: touchstart後のpointerdownを無視
    if (evt.type === 'pointerdown' && evt.pointerType === 'touch') {
      return;
    }
    
    // 既に描画中なら無視
    if (this.brushEngine.isDrawing) {
      return;
    }
    
    const coords = this._getCanvasCoordinates();
    if (!coords) return;
    
    const pressure = this._getPressure(evt);
    
    // アクティブレイヤーID取得
    // Phase 5: LayerPanelから取得
    let layerId = 'layer-2'; // デフォルト: 描画レイヤー
    
    if (window.LayerPanel && window.LayerPanel.getCurrentLayerId) {
      layerId = window.LayerPanel.getCurrentLayerId();
    }
    
    // ストローク開始
    this.brushEngine.startStroke(layerId, {
      x: coords.x,
      y: coords.y,
      pressure: pressure
    });
    
    console.log('[DrawingController] Pointer down:', coords, 'pressure:', pressure);
  }

  // ========================================
  // ポインター移動ハンドラー
  // ========================================
  _handlePointerMove(konvaEvt) {
    if (!this.enabled || !this.brushEngine.isDrawing) return;
    
    const evt = konvaEvt.evt;
    const coords = this._getCanvasCoordinates();
    if (!coords) return;
    
    const pressure = this._getPressure(evt);
    
    // ストローク継続
    this.brushEngine.continueStroke({
      x: coords.x,
      y: coords.y,
      pressure: pressure
    });
  }

  // ========================================
  // ポインターアップハンドラー
  // ========================================
  _handlePointerUp(konvaEvt) {
    if (!this.enabled || !this.brushEngine.isDrawing) return;
    
    // ストローク終了
    this.brushEngine.endStroke();
    
    console.log('[DrawingController] Pointer up');
  }

  // ========================================
  // 描画有効化
  // ========================================
  enable() {
    if (this.enabled) return;
    
    // Stageレベルでイベント登録（タブレットペン対応）
    this.stage.on('pointerdown touchstart', this._handlePointerDown);
    this.stage.on('pointermove touchmove', this._handlePointerMove);
    this.stage.on('pointerup touchend', this._handlePointerUp);
    this.stage.on('pointerleave touchcancel', this._handlePointerUp);
    
    this.enabled = true;
    
    console.log('[DrawingController] Enabled on Stage (with tablet support)');
  }

  // ========================================
  // 描画無効化
  // ========================================
  disable() {
    if (!this.enabled) return;
    
    this.stage.off('pointerdown touchstart', this._handlePointerDown);
    this.stage.off('pointermove touchmove', this._handlePointerMove);
    this.stage.off('pointerup touchend', this._handlePointerUp);
    this.stage.off('pointerleave touchcancel', this._handlePointerUp);
    
    this.enabled = false;
    
    console.log('[DrawingController] Disabled');
  }
}

// ========================================
// グローバル登録
// ========================================
window.DrawingController = DrawingController;

console.log('✅ DrawingController Phase 3 loaded (インスタンス参照修正版)');
console.log('   🔧 クラスベースに変更');
console.log('   🔧 コンストラクタでstageとbrushEngineを受け取る');
console.log('   🔧 アクティブレイヤーID自動取得');