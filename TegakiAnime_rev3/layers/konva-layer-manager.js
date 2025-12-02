/**
 * ============================================================================
 * ファイル名: konva-layer-manager.js
 * 責務: Konva.jsベースのレイヤー階層管理
 * 依存:
 *   - konva (外部ライブラリ - libs/konva.min.js)
 *   - event-bus.js (TegakiEventBus)
 *   - state-manager.js (StateManager - optional)
 *   - ui-components.js (UIComponents - 色定数)
 * 親依存:
 *   - core-runtime.js → window.konvaDrawingGroup を使用
 *   - layer-panel.js → このファイルを参照(Phase 2)
 *   - frame-system.js → このファイルを参照(Phase 2)
 * 子依存:
 *   - このファイルは event-bus.js に依存
 * 公開API:
 *   - KonvaLayerManager.createLayer(name, options): レイヤー作成
 *   - KonvaLayerManager.deleteLayer(layerId): レイヤー削除
 *   - KonvaLayerManager.getLayer(layerId): レイヤー取得
 *   - KonvaLayerManager.getAllLayers(): 全レイヤー取得
 * イベント発火:
 *   - 'layer:created' { layerId, name }
 *   - 'layer:deleted' { layerId }
 * イベント受信: なし(Phase 1)
 * グローバル登録: window.KonvaLayerManager
 * 実装状態: 🆕新規 Phase 1 - 最小実装版
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
if (!window.UIComponents) {
  throw new Error('UIComponents が読み込まれていません');
}

window.KonvaLayerManager = (() => {
  
  // ========================================
  // プライベート変数
  // ========================================
  const layers = new Map();  // layerId → Konva.Group
  const eventBus = window.TegakiEventBus;
  let layerCounter = 0;

  // ========================================
  // レイヤー作成
  // ========================================
  /**
   * レイヤー作成
   * @param {string} name - レイヤー名
   * @param {Object} options - オプション
   * @param {number} options.opacity - 不透明度 0.0-1.0
   * @param {boolean} options.visible - 可視性
   * @param {string} options.blendMode - ブレンドモード
   * @returns {Object} { layerId, konvaGroup }
   */
  function createLayer(name, options = {}) {
    const {
      opacity = 1.0,
      visible = true,
      blendMode = 'normal'
    } = options;

    // ========================================
    // レイヤーID生成
    // ========================================
    layerCounter++;
    const layerId = `layer-${layerCounter}`;

    // ========================================
    // Konva.Group作成（レイヤー本体）
    // ========================================
    const layerGroup = new Konva.Group({
      id: layerId,
      name: name || `レイヤー ${layerCounter}`,
      opacity: opacity,
      visible: visible
      // blendModeは後でKonva.Imageに設定
    });

    // ========================================
    // 描画グループに追加
    // ========================================
    const drawingGroup = window.konvaDrawingGroup;
    if (!drawingGroup) {
      throw new Error('konvaDrawingGroup が初期化されていません');
    }

    drawingGroup.add(layerGroup);

    // ========================================
    // レイヤーデータ保存
    // ========================================
    layers.set(layerId, {
      id: layerId,
      name: layerGroup.name(),
      konvaGroup: layerGroup,
      opacity: opacity,
      visible: visible,
      blendMode: blendMode,
      createdAt: Date.now()
    });

    // ========================================
    // イベント発火
    // ========================================
    eventBus.emit('layer:created', {
      layerId,
      name: layerGroup.name(),
      opacity,
      visible,
      blendMode
    });

    console.log(`[KonvaLayerManager] Layer created: ${layerId}`, {
      name: layerGroup.name(),
      opacity,
      visible
    });

    return {
      layerId,
      konvaGroup: layerGroup
    };
  }

  // ========================================
  // レイヤー削除
  // ========================================
  /**
   * レイヤー削除
   * @param {string} layerId - レイヤーID
   * @returns {boolean} 削除成功
   */
  function deleteLayer(layerId) {
    const layerData = layers.get(layerId);
    if (!layerData) {
      console.warn(`[KonvaLayerManager] Layer not found: ${layerId}`);
      return false;
    }

    // Konva.Groupを削除
    layerData.konvaGroup.destroy();

    // Map から削除
    layers.delete(layerId);

    // イベント発火
    eventBus.emit('layer:deleted', {
      layerId
    });

    console.log(`[KonvaLayerManager] Layer deleted: ${layerId}`);

    return true;
  }

  // ========================================
  // レイヤー取得
  // ========================================
  /**
   * レイヤー取得
   * @param {string} layerId - レイヤーID
   * @returns {Object|null} レイヤーデータ
   */
  function getLayer(layerId) {
    return layers.get(layerId) || null;
  }

  // ========================================
  // 全レイヤー取得
  // ========================================
  /**
   * 全レイヤー取得
   * @returns {Array<Object>} レイヤーデータ配列
   */
  function getAllLayers() {
    return Array.from(layers.values());
  }

  // ========================================
  // レイヤー数取得
  // ========================================
  /**
   * レイヤー数取得
   * @returns {number} レイヤー数
   */
  function getLayerCount() {
    return layers.size;
  }

  // ========================================
  // レイヤー可視性設定
  // ========================================
  /**
   * レイヤー可視性設定
   * @param {string} layerId - レイヤーID
   * @param {boolean} visible - 可視性
   */
  function setLayerVisible(layerId, visible) {
    const layerData = layers.get(layerId);
    if (!layerData) {
      console.warn(`[KonvaLayerManager] Layer not found: ${layerId}`);
      return;
    }

    layerData.konvaGroup.visible(visible);
    layerData.visible = visible;

    // 再描画
    layerData.konvaGroup.getLayer()?.batchDraw();

    eventBus.emit('layer:visibility-changed', {
      layerId,
      visible
    });
  }

  // ========================================
  // レイヤー不透明度設定
  // ========================================
  /**
   * レイヤー不透明度設定
   * @param {string} layerId - レイヤーID
   * @param {number} opacity - 不透明度 0.0-1.0
   */
  function setLayerOpacity(layerId, opacity) {
    const layerData = layers.get(layerId);
    if (!layerData) {
      console.warn(`[KonvaLayerManager] Layer not found: ${layerId}`);
      return;
    }

    layerData.konvaGroup.opacity(opacity);
    layerData.opacity = opacity;

    // 再描画
    layerData.konvaGroup.getLayer()?.batchDraw();

    eventBus.emit('layer:opacity-changed', {
      layerId,
      opacity
    });
  }

  // ========================================
  // 背景色で塗りつぶしたレイヤー作成
  // ========================================
  /**
   * 背景レイヤー作成（クリーム色で塗りつぶし）
   * @param {string} name - レイヤー名
   * @returns {Object} { layerId, konvaGroup }
   */
  function createBackgroundLayer(name) {
    const config = window.TEGAKI_CONFIG;
    const width = config.canvas.width;
    const height = config.canvas.height;
    const bgColor = window.UIComponents.UI_COLORS.cream;

    // 背景レイヤー作成
    const result = createLayer(name, {
      opacity: 1.0,
      visible: true,
      blendMode: 'normal'
    });

    // Konva.Rectで背景色を塗る
    const bgRect = new Konva.Rect({
      x: 0,
      y: 0,
      width: width,
      height: height,
      fill: bgColor
    });

    result.konvaGroup.add(bgRect);

    // 再描画
    result.konvaGroup.getLayer()?.batchDraw();

    console.log(`[KonvaLayerManager] Background layer created: ${result.layerId}`, {
      color: bgColor,
      size: `${width}x${height}`
    });

    return result;
  }

  // ========================================
  // 初期レイヤー作成（自動実行）
  // ========================================
  function initializeDefaultLayer() {
    // CoreRuntime初期化完了を待つ
    eventBus.on('runtime:initialized', () => {
      console.log('[KonvaLayerManager] Creating default layers...');
      
      // 背景レイヤー作成（クリーム色）
      createBackgroundLayer('背景');
      
      // 描画レイヤー作成（透明）
      createLayer('レイヤー 1', {
        opacity: 1.0,
        visible: true,
        blendMode: 'normal'
      });
      
      console.log('[KonvaLayerManager] Default layers created');
    });
  }

  // ========================================
  // 初期化
  // ========================================
  initializeDefaultLayer();

  // ========================================
  // 公開API
  // ========================================
  return {
    createLayer,
    createBackgroundLayer,
    deleteLayer,
    getLayer,
    getAllLayers,
    getLayerCount,
    setLayerVisible,
    setLayerOpacity
  };

})();

console.log('✅ KonvaLayerManager Phase 1 loaded (最小実装版)');