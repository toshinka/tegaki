/**
 * ============================================================================
 * ファイル名: konva-layer-manager.js
 * 責務: Konva.jsベースのレイヤー階層管理
 * 依存:
 *   - konva (外部ライブラリ - libs/konva.min.js)
 *   - event-bus.js (TegakiEventBus)
 *   - ui-components.js (UIComponents - 色定数)
 * 親依存:
 *   - frame-system.js → このファイルを参照
 *   - layer-panel.js → このファイルを参照
 *   - core-runtime.js → このファイルを初期化
 * 子依存:
 *   - このファイルは event-bus.js に依存
 *   - このファイルは konva に依存
 * 公開API:
 *   - KonvaLayerManager.createLayer(name, options)
 *   - KonvaLayerManager.deleteLayer(layerId)
 *   - KonvaLayerManager.moveLayer(layerId, newIndex)
 *   - KonvaLayerManager.getLayer(layerId)
 *   - KonvaLayerManager.getAllLayers()
 *   - KonvaLayerManager.setActiveLayer(layerId)
 * イベント発火:
 *   - 'layer:created' { layerId, name }
 *   - 'layer:deleted' { layerId }
 *   - 'layer:moved' { layerId, oldIndex, newIndex }
 *   - 'layer:activated' { layerId }
 *   - 'layer:updated' { layerId }
 * イベント受信:
 *   - 'drawing:stroke-complete' → サムネイル更新トリガー
 *   - 'frame:changed' → レイヤー可視性更新
 * グローバル登録: window.KonvaLayerManager
 * 実装状態: 🆕新規
 * ============================================================================
 */

'use strict';

// グローバル依存確認
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
  // 内部状態
  // ========================================
  let stage = null;
  let drawingLayer = null; // Konva.Layer（Groupではない）
  let layers = new Map(); // layerId → { konvaGroup, metadata }
  let activeLayerId = null;
  let layerCounter = 0;

  // ========================================
  // 初期化
  // ========================================
  /**
   * Konva.Stageと連携して初期化
   * @param {Konva.Stage} konvaStage - Konvaステージ
   */
  function initialize(konvaStage) {
    if (!konvaStage) {
      throw new Error('[KonvaLayerManager] konvaStage が指定されていません');
    }

    stage = konvaStage;
    drawingLayer = stage.findOne('#drawing-layer');

    if (!drawingLayer) {
      throw new Error('[KonvaLayerManager] #drawing-layer が見つかりません');
    }

    console.log('✅ [KonvaLayerManager] initialized');

    // デフォルトレイヤー作成
    createLayer('レイヤー 1', {
      isDefault: true,
      backgroundColor: window.UIComponents.UI_COLORS.cream
    });
  }

  // ========================================
  // レイヤー作成
  // ========================================
  /**
   * 新規レイヤー作成
   * @param {string} name - レイヤー名
   * @param {Object} options - オプション
   * @param {boolean} options.isDefault - デフォルトレイヤーか
   * @param {string} options.backgroundColor - 背景色（背景レイヤーのみ）
   * @returns {string} layerId
   */
  function createLayer(name = '', options = {}) {
    const {
      isDefault = false,
      backgroundColor = null
    } = options;

    const layerId = `layer-${++layerCounter}`;
    
    // Konva.Groupでレイヤーを表現（描画内容をグループ化）
    const konvaGroup = new Konva.Group({
      id: layerId,
      name: name || `レイヤー ${layerCounter}`,
      visible: true,
      opacity: 1.0
    });

    // メタデータ
    const metadata = {
      layerId,
      name: konvaGroup.name(),
      isDefault,
      backgroundColor,
      createdAt: Date.now()
    };

    // 背景レイヤーの場合は背景色を設定
    if (backgroundColor) {
      const bg = new Konva.Rect({
        x: 0,
        y: 0,
        width: stage.width(),
        height: stage.height(),
        fill: backgroundColor,
        listening: false
      });
      konvaGroup.add(bg);
    }

    // drawingLayerに追加
    drawingLayer.add(konvaGroup);
    layers.set(layerId, { konvaGroup, metadata });

    // アクティブレイヤー設定
    if (!activeLayerId || isDefault) {
      setActiveLayer(layerId);
    }

    stage.batchDraw();

    window.TegakiEventBus.emit('layer:created', { layerId, name: metadata.name });

    console.log(`[KonvaLayerManager] Layer created: ${layerId}`);

    return layerId;
  }

  // ========================================
  // レイヤー削除
  // ========================================
  /**
   * レイヤー削除
   * @param {string} layerId - レイヤーID
   */
  function deleteLayer(layerId) {
    const layerData = layers.get(layerId);
    if (!layerData) {
      console.warn(`[KonvaLayerManager] Layer not found: ${layerId}`);
      return;
    }

    // デフォルトレイヤーは削除不可
    if (layerData.metadata.isDefault) {
      console.warn('[KonvaLayerManager] Cannot delete default layer');
      return;
    }

    // Konva Groupを削除
    layerData.konvaGroup.destroy();
    layers.delete(layerId);

    // アクティブレイヤーが削除された場合
    if (activeLayerId === layerId) {
      const remainingLayers = Array.from(layers.keys());
      if (remainingLayers.length > 0) {
        setActiveLayer(remainingLayers[0]);
      } else {
        activeLayerId = null;
      }
    }

    stage.batchDraw();

    window.TegakiEventBus.emit('layer:deleted', { layerId });

    console.log(`[KonvaLayerManager] Layer deleted: ${layerId}`);
  }

  // ========================================
  // レイヤー移動（順序変更）
  // ========================================
  /**
   * レイヤーの順序を変更
   * @param {string} layerId - レイヤーID
   * @param {number} newIndex - 新しいインデックス（0が最背面）
   */
  function moveLayer(layerId, newIndex) {
    const layerData = layers.get(layerId);
    if (!layerData) {
      console.warn(`[KonvaLayerManager] Layer not found: ${layerId}`);
      return;
    }

    const konvaGroup = layerData.konvaGroup;
    const oldIndex = konvaGroup.getZIndex();

    konvaGroup.moveToTop();
    const totalChildren = drawingLayer.children.length;
    konvaGroup.moveDown(totalChildren - 1 - newIndex);

    stage.batchDraw();

    window.TegakiEventBus.emit('layer:moved', { layerId, oldIndex, newIndex });

    console.log(`[KonvaLayerManager] Layer moved: ${layerId} (${oldIndex} → ${newIndex})`);
  }

  // ========================================
  // レイヤー取得
  // ========================================
  /**
   * レイヤーを取得
   * @param {string} layerId - レイヤーID
   * @returns {Konva.Group|null}
   */
  function getLayer(layerId) {
    const layerData = layers.get(layerId);
    return layerData ? layerData.konvaGroup : null;
  }

  /**
   * すべてのレイヤーを取得
   * @returns {Array<Konva.Group>}
   */
  function getAllLayers() {
    return Array.from(layers.values()).map(data => data.konvaGroup);
  }

  /**
   * レイヤーメタデータを取得
   * @param {string} layerId - レイヤーID
   * @returns {Object|null}
   */
  function getLayerMetadata(layerId) {
    const layerData = layers.get(layerId);
    return layerData ? layerData.metadata : null;
  }

  // ========================================
  // アクティブレイヤー
  // ========================================
  /**
   * アクティブレイヤーを設定
   * @param {string} layerId - レイヤーID
   */
  function setActiveLayer(layerId) {
    const layerData = layers.get(layerId);
    if (!layerData) {
      console.warn(`[KonvaLayerManager] Layer not found: ${layerId}`);
      return;
    }

    activeLayerId = layerId;

    window.TegakiEventBus.emit('layer:activated', { layerId });

    console.log(`[KonvaLayerManager] Active layer: ${layerId}`);
  }

  /**
   * アクティブレイヤーを取得
   * @returns {string|null}
   */
  function getActiveLayerId() {
    return activeLayerId;
  }

  /**
   * アクティブレイヤーのKonva.Groupを取得
   * @returns {Konva.Group|null}
   */
  function getActiveLayer() {
    return activeLayerId ? getLayer(activeLayerId) : null;
  }

  // ========================================
  // レイヤー更新
  // ========================================
  /**
   * レイヤー名を変更
   * @param {string} layerId - レイヤーID
   * @param {string} newName - 新しい名前
   */
  function renameLayer(layerId, newName) {
    const layerData = layers.get(layerId);
    if (!layerData) {
      console.warn(`[KonvaLayerManager] Layer not found: ${layerId}`);
      return;
    }

    layerData.konvaGroup.name(newName);
    layerData.metadata.name = newName;

    window.TegakiEventBus.emit('layer:updated', { layerId, name: newName });
  }

  /**
   * レイヤーの可視性を設定
   * @param {string} layerId - レイヤーID
   * @param {boolean} visible - 可視性
   */
  function setLayerVisible(layerId, visible) {
    const konvaGroup = getLayer(layerId);
    if (!konvaGroup) {
      console.warn(`[KonvaLayerManager] Layer not found: ${layerId}`);
      return;
    }

    konvaGroup.visible(visible);
    stage.batchDraw();

    window.TegakiEventBus.emit('layer:updated', { layerId, visible });
  }

  /**
   * レイヤーの不透明度を設定
   * @param {string} layerId - レイヤーID
   * @param {number} opacity - 不透明度（0.0～1.0）
   */
  function setLayerOpacity(layerId, opacity) {
    const konvaGroup = getLayer(layerId);
    if (!konvaGroup) {
      console.warn(`[KonvaLayerManager] Layer not found: ${layerId}`);
      return;
    }

    konvaGroup.opacity(opacity);
    stage.batchDraw();

    window.TegakiEventBus.emit('layer:updated', { layerId, opacity });
  }

  // ========================================
  // レイヤークリア
  // ========================================
  /**
   * レイヤーの描画内容をクリア（背景以外）
   * @param {string} layerId - レイヤーID
   */
  function clearLayer(layerId) {
    const layerData = layers.get(layerId);
    if (!layerData) {
      console.warn(`[KonvaLayerManager] Layer not found: ${layerId}`);
      return;
    }

    const konvaGroup = layerData.konvaGroup;

    // 背景レイヤーの場合は背景色を残す
    if (layerData.metadata.backgroundColor) {
      const children = konvaGroup.getChildren();
      children.forEach((child, index) => {
        if (index > 0) { // 最初の要素（背景）以外を削除
          child.destroy();
        }
      });
    } else {
      konvaGroup.destroyChildren();
    }

    stage.batchDraw();

    window.TegakiEventBus.emit('layer:updated', { layerId, action: 'cleared' });

    console.log(`[KonvaLayerManager] Layer cleared: ${layerId}`);
  }

  // ========================================
  // イベントリスナー
  // ========================================
  // 初期化後に自動登録
  if (window.TegakiEventBus) {
    window.TegakiEventBus.on('runtime:initialized', (data) => {
      if (data.konvaStage) {
        initialize(data.konvaStage);
      }
    });
  }

  // ========================================
  // 公開API
  // ========================================
  return {
    initialize,
    createLayer,
    deleteLayer,
    moveLayer,
    getLayer,
    getAllLayers,
    getLayerMetadata,
    setActiveLayer,
    getActiveLayerId,
    getActiveLayer,
    renameLayer,
    setLayerVisible,
    setLayerOpacity,
    clearLayer,
    get stage() { return stage; },
    get layers() { return layers; }
  };

})();

console.log('✅ KonvaLayerManager loaded');