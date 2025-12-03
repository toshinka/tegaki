/**
 * ============================================================================
 * ファイル名: layer-panel.js
 * 責務: レイヤーパネルUI（iPad版クリスタ・シンプルモード風）
 * 依存:
 *   - konva-layer-manager.js (konvaLayerManager)
 *   - event-bus.js (TegakiEventBus)
 *   - ui-components.js (UIComponents)
 * 親依存:
 *   - core-runtime.js → このファイルを初期化
 * 子依存:
 *   - konva-layer-manager.js
 *   - ui-components.js
 * 公開API:
 *   - LayerPanel.show() - パネル表示
 *   - LayerPanel.hide() - パネル非表示
 *   - LayerPanel.refresh() - レイヤーリスト更新
 * イベント発火:
 *   - 'layer:selected' { layerId }
 * イベント受信:
 *   - 'layer:created' → リスト更新
 *   - 'layer:deleted' → リスト更新
 * グローバル登録: window.LayerPanel
 * 実装状態: 🆕新規 Phase 5 - 最小レイヤーパネルUI
 * ============================================================================
 */

'use strict';

// ========================================
// グローバル依存確認
// ========================================
if (!window.konvaLayerManager) {
  throw new Error('konvaLayerManager が初期化されていません');
}
if (!window.TegakiEventBus) {
  throw new Error('TegakiEventBus が初期化されていません');
}
if (!window.UIComponents) {
  throw new Error('UIComponents が読み込まれていません');
}

// ========================================
// LayerPanel - シングルトン
// ========================================
window.LayerPanel = (() => {
  
  const konvaLayerManager = window.konvaLayerManager;
  const eventBus = window.TegakiEventBus;
  const { UI_COLORS, SVG_ICONS } = window.UIComponents;

  let panelElement = null;
  let currentLayerId = 'layer-2'; // デフォルト: 描画レイヤー

  // ========================================
  // 初期化
  // ========================================
  function initialize() {
    console.log('[LayerPanel] Initializing...');
    
    // パネル要素取得
    panelElement = document.getElementById('layer-panel-container');
    if (!panelElement) {
      console.error('[LayerPanel] #layer-panel-container not found in DOM');
      return;
    }

    // 初期UI構築
    render();

    // イベントリスナー登録
    setupEventListeners();

    console.log('[LayerPanel] Initialized successfully');
  }

  // ========================================
  // イベントリスナー設定
  // ========================================
  function setupEventListeners() {
    // レイヤー作成・削除時に再描画
    eventBus.on('layer:created', () => {
      refresh();
    });

    eventBus.on('layer:deleted', () => {
      refresh();
    });
  }

  // ========================================
  // UI描画
  // ========================================
  function render() {
    if (!panelElement) return;

    const layers = konvaLayerManager.getAllLayerData();

    // 逆順（上から描画レイヤー、下に背景）
    const sortedLayers = [...layers].reverse();

    panelElement.innerHTML = `
      <div class="layer-panel">
        <!-- ヘッダー -->
        <div class="layer-panel-header">
          <span style="color: ${UI_COLORS.maroon}; font-weight: bold;">レイヤー</span>
          <button 
            class="layer-add-btn" 
            onclick="LayerPanel.addLayer()"
            style="background: ${UI_COLORS.maroon}; color: #fff; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;"
            title="レイヤー追加"
          >
            ${SVG_ICONS.plus}
          </button>
        </div>

        <!-- レイヤーリスト -->
        <div class="layer-list">
          ${sortedLayers.map(layer => renderLayerItem(layer)).join('')}
        </div>
      </div>
    `;

    // クリックイベント登録
    attachLayerClickHandlers();
  }

  // ========================================
  // レイヤー項目の描画
  // ========================================
  function renderLayerItem(layer) {
    const isActive = layer.id === currentLayerId;
    const bgColor = isActive ? UI_COLORS.lightMedium : 'transparent';
    const borderColor = isActive ? UI_COLORS.maroon : UI_COLORS.medium;

    return `
      <div 
        class="layer-item" 
        data-layer-id="${layer.id}"
        style="
          background: ${bgColor};
          border: 2px solid ${borderColor};
          border-radius: 4px;
          padding: 8px;
          margin: 4px 0;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
        "
      >
        <!-- レイヤー名 -->
        <div style="display: flex; align-items: center; gap: 8px;">
          ${SVG_ICONS.layers}
          <span style="color: ${UI_COLORS.maroon};">${layer.name}</span>
        </div>

        <!-- 可視性トグル -->
        <button 
          class="layer-visibility-btn"
          data-layer-id="${layer.id}"
          onclick="LayerPanel.toggleVisibility('${layer.id}', event)"
          style="
            background: transparent;
            border: none;
            cursor: pointer;
            padding: 4px;
            color: ${layer.visible ? UI_COLORS.maroon : UI_COLORS.medium};
          "
          title="${layer.visible ? '非表示にする' : '表示する'}"
        >
          ${layer.visible ? SVG_ICONS.eye : SVG_ICONS.eyeOff}
        </button>
      </div>
    `;
  }

  // ========================================
  // レイヤークリックハンドラー登録
  // ========================================
  function attachLayerClickHandlers() {
    const layerItems = panelElement.querySelectorAll('.layer-item');
    layerItems.forEach(item => {
      item.addEventListener('click', (e) => {
        // 可視性ボタンのクリックは無視
        if (e.target.closest('.layer-visibility-btn')) return;

        const layerId = item.dataset.layerId;
        selectLayer(layerId);
      });
    });
  }

  // ========================================
  // レイヤー選択
  // ========================================
  function selectLayer(layerId) {
    currentLayerId = layerId;
    
    // イベント発火
    eventBus.emit('layer:selected', { layerId });
    
    // UI更新
    refresh();

    console.log('[LayerPanel] Layer selected:', layerId);
  }

  // ========================================
  // レイヤー追加
  // ========================================
  function addLayer() {
    const layerCount = konvaLayerManager.getLayerCount();
    const newName = `レイヤー ${layerCount}`;
    
    konvaLayerManager.createLayer(newName, {
      opacity: 1.0,
      visible: true,
      blendMode: 'normal'
    });

    console.log('[LayerPanel] Layer added:', newName);
  }

  // ========================================
  // 可視性トグル
  // ========================================
  function toggleVisibility(layerId, event) {
    // イベントの伝播を停止（レイヤー選択を防ぐ）
    if (event) {
      event.stopPropagation();
    }

    const layerData = konvaLayerManager.getLayerData(layerId);
    if (!layerData) return;

    const newVisibility = !layerData.visible;
    konvaLayerManager.setLayerVisible(layerId, newVisibility);

    // UI更新
    refresh();

    console.log('[LayerPanel] Visibility toggled:', layerId, newVisibility);
  }

  // ========================================
  // リフレッシュ
  // ========================================
  function refresh() {
    render();
  }

  // ========================================
  // 表示・非表示
  // ========================================
  function show() {
    if (panelElement) {
      panelElement.style.display = 'block';
    }
  }

  function hide() {
    if (panelElement) {
      panelElement.style.display = 'none';
    }
  }

  // ========================================
  // アクティブレイヤーID取得
  // ========================================
  function getCurrentLayerId() {
    return currentLayerId;
  }

  // ========================================
  // 自動初期化（runtime完了後）
  // ========================================
  eventBus.on('runtime:initialized', () => {
    setTimeout(() => {
      initialize();
    }, 100);
  });

  // ========================================
  // 公開API
  // ========================================
  return {
    initialize,
    show,
    hide,
    refresh,
    selectLayer,
    addLayer,
    toggleVisibility,
    getCurrentLayerId
  };

})();

console.log('✅ LayerPanel Phase 5 loaded (最小レイヤーパネルUI)');
console.log('   🎨 iPad版クリスタ・シンプルモード風');
console.log('   ✅ レイヤー一覧表示');
console.log('   ✅ レイヤー選択');
console.log('   ✅ 可視性トグル');
console.log('   ✅ レイヤー追加');