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
  let konvaStage = null;
  
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
    
    // イベント重複防止: touchstart後のpointerdownを無視
    if (evt.type === 'pointerdown' && evt.evt.pointerType === 'touch') {
      return;
    }
    
    // すでに描画中なら無視
    if (brushEngine.isDrawing) {
      return;
    }
    
    const stage = window.konvaStage;
    if (!stage) return;
    
    // デバッグ: イベント情報
    console.log('[DrawingController] PointerDown event:', {
      type: evt.type,
      pointerType: evt.evt.pointerType,
      isPrimary: evt.evt.isPrimary,
      button: evt.evt.button,
      buttons: evt.evt.buttons
    });
    
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
    
    konvaStage = window.konvaStage;
    if (!konvaStage) {
      console.warn('[DrawingController] Konva Stage not found');
      return;
    }
    
    // Stageレベルでイベント登録（タブレットペン対応）
    konvaStage.on('pointerdown touchstart', handlePointerDown);
    konvaStage.on('pointermove touchmove', handlePointerMove);
    konvaStage.on('pointerup touchend', handlePointerUp);
    konvaStage.on('pointerleave touchcancel', handlePointerUp);
    
    enabled = true;
    
    console.log('[DrawingController] Enabled on Stage (with tablet support)');
  }
  
  // ========================================
  // 描画無効化
  // ========================================
  function disable() {
    if (!enabled) return;
    
    if (konvaStage) {
      konvaStage.off('pointerdown touchstart', handlePointerDown);
      konvaStage.off('pointermove touchmove', handlePointerMove);
      konvaStage.off('pointerup touchend', handlePointerUp);
      konvaStage.off('pointerleave touchcancel', handlePointerUp);
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