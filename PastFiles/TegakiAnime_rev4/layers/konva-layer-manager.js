/**
 * ============================================================================
 * ファイル名: konva-layer-manager.js
 * 責務: Konva.jsベースのレイヤー階層管理
 * 依存:
 *   - konva (外部ライブラリ - libs/konva.min.js)
 *   - event-bus.js (TegakiEventBus)
 *   - ui-components.js (UIComponents - 色定数)
 * 親依存:
 *   - core-runtime.js → このファイルをインスタンス化
 *   - layer-panel.js → このファイルを参照(Phase 3)
 *   - frame-system.js → このファイルを参照(Phase 3)
 * 子依存:
 *   - このファイルは event-bus.js に依存
 * 公開API:
 *   - new KonvaLayerManager(stage, drawingGroup): コンストラクタ
 *   - createLayer(name, options): レイヤー作成
 *   - deleteLayer(layerId): レイヤー削除
 *   - getLayer(layerId): レイヤー取得
 *   - getAllLayers(): 全レイヤー取得
 *   - getAllLayerIds(): 全レイヤーID取得
 *   - createDefaultLayers(): デフォルトレイヤー作成
 * イベント発火:
 *   - 'layer:created' { layerId, name }
 *   - 'layer:deleted' { layerId }
 *   - 'layer:visibility-changed' { layerId, visible }
 *   - 'layer:opacity-changed' { layerId, opacity }
 * イベント受信: なし(Phase 2)
 * グローバル登録: window.KonvaLayerManager (クラス定義のみ)
 * 実装状態: 🔧改修 Phase 2 - CoreRuntime統合版
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

// ========================================
// KonvaLayerManager - クラス定義
// ========================================
class KonvaLayerManager {
  constructor(stage, drawingGroup) {
    if (!stage) {
      throw new Error('Konva.Stage が渡されていません');
    }
    if (!drawingGroup) {
      throw new Error('Drawing Group が渡されていません');
    }

    this.stage = stage;
    this.drawingGroup = drawingGroup;
    this.eventBus = window.TegakiEventBus;
    
    // レイヤー管理
    this.layers = new Map();  // layerId → layerData
    this.layerCounter = 0;
    
    console.log('[KonvaLayerManager] Initialized');
  }

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
  createLayer(name, options = {}) {
    const {
      opacity = 1.0,
      visible = true,
      blendMode = 'normal'
    } = options;

    // レイヤーID生成
    this.layerCounter++;
    const layerId = `layer-${this.layerCounter}`;

    // Konva.Group作成（レイヤー本体）
    const layerGroup = new Konva.Group({
      id: layerId,
      name: name || `レイヤー ${this.layerCounter}`,
      opacity: opacity,
      visible: visible
    });

    // 描画グループに追加
    this.drawingGroup.add(layerGroup);

    // レイヤーデータ保存
    this.layers.set(layerId, {
      id: layerId,
      name: layerGroup.name(),
      konvaGroup: layerGroup,
      opacity: opacity,
      visible: visible,
      blendMode: blendMode,
      createdAt: Date.now()
    });

    // イベント発火
    this.eventBus.emit('layer:created', {
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
  deleteLayer(layerId) {
    const layerData = this.layers.get(layerId);
    if (!layerData) {
      console.warn(`[KonvaLayerManager] Layer not found: ${layerId}`);
      return false;
    }

    // Konva.Groupを削除
    layerData.konvaGroup.destroy();

    // Map から削除
    this.layers.delete(layerId);

    // イベント発火
    this.eventBus.emit('layer:deleted', {
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
   * @returns {Object|null} レイヤーデータ { konvaGroup, ... }
   */
  getLayer(layerId) {
    const data = this.layers.get(layerId);
    return data ? data.konvaGroup : null;
  }

  /**
   * レイヤーデータ取得（内部情報含む）
   * @param {string} layerId - レイヤーID
   * @returns {Object|null} レイヤーデータ
   */
  getLayerData(layerId) {
    return this.layers.get(layerId) || null;
  }

  // ========================================
  // 全レイヤー取得
  // ========================================
  /**
   * 全レイヤー取得
   * @returns {Array<Konva.Group>} Konva.Group配列
   */
  getAllLayers() {
    return Array.from(this.layers.values()).map(data => data.konvaGroup);
  }

  /**
   * 全レイヤーID取得
   * @returns {Array<string>} レイヤーID配列
   */
  getAllLayerIds() {
    return Array.from(this.layers.keys());
  }

  /**
   * 全レイヤーデータ取得
   * @returns {Array<Object>} レイヤーデータ配列
   */
  getAllLayerData() {
    return Array.from(this.layers.values());
  }

  // ========================================
  // レイヤー数取得
  // ========================================
  /**
   * レイヤー数取得
   * @returns {number} レイヤー数
   */
  getLayerCount() {
    return this.layers.size;
  }

  // ========================================
  // レイヤー可視性設定
  // ========================================
  /**
   * レイヤー可視性設定
   * @param {string} layerId - レイヤーID
   * @param {boolean} visible - 可視性
   */
  setLayerVisible(layerId, visible) {
    const layerData = this.layers.get(layerId);
    if (!layerData) {
      console.warn(`[KonvaLayerManager] Layer not found: ${layerId}`);
      return;
    }

    layerData.konvaGroup.visible(visible);
    layerData.visible = visible;

    // 再描画
    layerData.konvaGroup.getLayer()?.batchDraw();

    this.eventBus.emit('layer:visibility-changed', {
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
  setLayerOpacity(layerId, opacity) {
    const layerData = this.layers.get(layerId);
    if (!layerData) {
      console.warn(`[KonvaLayerManager] Layer not found: ${layerId}`);
      return;
    }

    layerData.konvaGroup.opacity(opacity);
    layerData.opacity = opacity;

    // 再描画
    layerData.konvaGroup.getLayer()?.batchDraw();

    this.eventBus.emit('layer:opacity-changed', {
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
  createBackgroundLayer(name) {
    const config = window.TEGAKI_CONFIG;
    const width = config.canvas.width;
    const height = config.canvas.height;
    const bgColor = window.UIComponents.UI_COLORS.cream;

    // 背景レイヤー作成
    const result = this.createLayer(name, {
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
  // デフォルトレイヤー作成
  // ========================================
  /**
   * デフォルトレイヤー作成
   * 背景レイヤー(cream) + 描画レイヤー(透明)
   */
  createDefaultLayers() {
    console.log('[KonvaLayerManager] Creating default layers...');
    
    // 背景レイヤー作成（クリーム色）
    this.createBackgroundLayer('背景');
    
    // 描画レイヤー作成（透明）
    this.createLayer('レイヤー 1', {
      opacity: 1.0,
      visible: true,
      blendMode: 'normal'
    });
    
    console.log('[KonvaLayerManager] Default layers created');
  }
}

// ========================================
// グローバル登録
// ========================================
window.KonvaLayerManager = KonvaLayerManager;

console.log('✅ KonvaLayerManager Phase 2 loaded (CoreRuntime統合版)');
console.log('   🔧 クラスベースに変更');
console.log('   🔧 getAllLayerIds() メソッド追加');
console.log('   🔧 createDefaultLayers() メソッド追加');