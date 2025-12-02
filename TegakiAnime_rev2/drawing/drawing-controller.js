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
 *   - core-engine.js → このファイルを参照
 * 子依存:
 *   - konva.min.js
 *   - event-bus.js
 *   - raster-brush-engine.js
 * 公開API:
 *   - DrawingController.enable(): 描画有効化
 *   - DrawingController.disable(): 描画無効化
 * イベント発火: なし
 * イベント受信:
 *   - 'runtime:initialized' → 自動でenable()
 * グローバル登録: window.DrawingController
 * 実装状態: 🆕新規 Phase 2 - ポインターイベント統合
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
  throw new Error('EventBus が初期化されていません');
}
if (!window.RasterBrushEngine) {
  throw new Error('RasterBrushEngine が初期化されていません');
}

window.DrawingController = (() => {
  
  // ========================================
  // プライベート変数
  // ========================================
  const eventBus = window.TegakiEventBus;
  const brushEngine = window.RasterBrushEngine;
  
  let enabled = false;
  let drawingLayer = null;
  
  // ========================================
  // Konva座標 → Canvas座標変換
  // ========================================
  function getCanvasCoordinates(konvaStage) {
    const pos = konvaStage.getPointerPosition();
    if (!pos) return null;
    
    // Phase 2では簡易実装: Konva座標 = Canvas座標
    return {
      x: pos.x,
      y: pos.y
    };
  }
  
  // ========================================
  // 筆圧取得
  // ========================================
  function getPressure(evt) {
    // PointerEvent.pressure対応
    if (evt.pressure !== undefined && evt.pressure > 0) {
      return evt.pressure;
    }
    
    // マウスの場合はデフォルト1.0
    return 1.0;
  }
  
  // ========================================
  // ポインターダウンハンドラー
  // ========================================
  function handlePointerDown(evt) {
    if (!enabled) return;
    
    const stage = window.konvaStage;
    if (!stage) return;
    
    const coords = getCanvasCoordinates(stage);
    if (!coords) return;
    
    const pressure = getPressure(evt.evt);
    
    brushEngine.startStroke(coords.x, coords.y, pressure);
    
    console.log('[DrawingController] Pointer down:', coords, 'pressure:', pressure);
  }
  
  // ========================================
  // ポインター移動ハンドラー
  // ========================================
  function handlePointerMove(evt) {
    if (!enabled || !brushEngine.isDrawing) return;
    
    const stage = window.konvaStage;
    if (!stage) return;
    
    const coords = getCanvasCoordinates(stage);
    if (!coords) return;
    
    const pressure = getPressure(evt.evt);
    
    brushEngine.updateStroke(coords.x, coords.y, pressure);
  }
  
  // ========================================
  // ポインターアップハンドラー
  // ========================================
  function handlePointerUp(evt) {
    if (!enabled || !brushEngine.isDrawing) return;
    
    brushEngine.endStroke();
    
    console.log('[DrawingController] Pointer up');
  }
  
  // ========================================
  // 描画有効化
  // ========================================
  function enable() {
    if (enabled) return;
    
    const stage = window.konvaStage;
    if (!stage) {
      console.warn('[DrawingController] Konva Stage not found');
      return;
    }
    
    // drawing-layerを取得
    drawingLayer = stage.findOne('#drawing-layer');
    if (!drawingLayer) {
      console.warn('[DrawingController] Drawing layer not found');
      return;
    }
    
    // イベントリスナー登録
    drawingLayer.on('pointerdown', handlePointerDown);
    drawingLayer.on('pointermove', handlePointerMove);
    drawingLayer.on('pointerup', handlePointerUp);
    drawingLayer.on('pointerleave', handlePointerUp);
    
    enabled = true;
    
    console.log('[DrawingController] Enabled');
  }
  
  // ========================================
  // 描画無効化
  // ========================================
  function disable() {
    if (!enabled) return;
    
    if (drawingLayer) {
      drawingLayer.off('pointerdown', handlePointerDown);
      drawingLayer.off('pointermove', handlePointerMove);
      drawingLayer.off('pointerup', handlePointerUp);
      drawingLayer.off('pointerleave', handlePointerUp);
    }
    
    enabled = false;
    
    console.log('[DrawingController] Disabled');
  }
  
  // ========================================
  // 自動初期化
  // ========================================
  eventBus.on('runtime:initialized', () => {
    setTimeout(() => {
      enable();
    }, 200);
  });
  
  // ========================================
  // 公開API
  // ========================================
  return {
    enable,
    disable,
    get enabled() { return enabled; }
  };

})();

console.log('✅ DrawingController Phase 2 loaded (ポインターイベント統合)');