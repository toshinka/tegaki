/**
 * ============================================================================
 * ファイル名: layer-panel.js
 * 責務: レイヤーパネルUI（webgl2_rev30完全継承 + Konva対応）
 * 依存:
 *   - konva-layer-manager.js (konvaLayerManager)
 *   - layer-folder-system.js (LayerFolderSystem)
 *   - thumbnail-generator.js (ThumbnailGenerator)
 *   - event-bus.js (TegakiEventBus)
 *   - ui-components.js (UIComponents)
 *   - state-manager.js (stateManager)
 * 親依存:
 *   - core-runtime.js → このファイルを初期化
 * 子依存:
 *   - konva-layer-manager.js
 *   - ui-components.js
 * 公開API:
 *   - LayerPanel.initialize() - 初期化
 *   - LayerPanel.render() - UI再描画
 *   - LayerPanel.refresh() - リフレッシュ
 * イベント発火:
 *   - 'layer:selected' { layerId, layerIndex }
 *   - 'layer:name-changed' { layerIndex, layerId, oldName, newName }
 *   - 'ui:background-color-change-requested' { layerIndex, layerId }
 * イベント受信:
 *   - 'layer:created' → refresh()
 *   - 'layer:deleted' → refresh()
 *   - 'layer:activated' → refresh()
 *   - 'layer:visibility-changed' → refresh()
 *   - 'layer:opacity-changed' → refresh()
 *   - 'folder:created' → refresh()
 *   - 'folder:toggled' → refresh()
 *   - 'layer:added-to-folder' → refresh()
 *   - 'thumbnail:layer-updated' → _updateSingleThumbnail()
 * グローバル登録: window.LayerPanel
 * 実装状態: ✅ Phase 4-11統合完了
 * ============================================================================
 */

'use strict';

// ========================================
// グローバル依存確認
// ========================================
if (!window.UIComponents) {
  throw new Error('UIComponents が読み込まれていません');
}

// ========================================
// LayerPanel - webgl2_rev30デザイン継承版
// ========================================
window.LayerPanel = (() => {
  
  const { UI_COLORS, SVG_ICONS } = window.UIComponents;
  
  let container = null;
  let layerManager = null;
  let folderSystem = null;
  let thumbnailGenerator = null;
  let eventBus = null;
  let stateManager = null;
  
  let _isInitialized = false;
  let _editingLayerIndex = -1;
  let _editingInput = null;
  let _updateTimeout = null;
  let sortable = null;

  // ========================================
  // 初期化
  // ========================================
  function initialize() {
    console.log('[LayerPanel] Phase 4-11 Initializing...');
    
    // グローバル参照取得
    layerManager = window.konvaLayerManager;
    folderSystem = window.LayerFolderSystem;
    thumbnailGenerator = window.ThumbnailGenerator;
    eventBus = window.TegakiEventBus;
    stateManager = window.stateManager;
    
    if (!layerManager) {
      console.warn('[LayerPanel] konvaLayerManager not found, waiting...');
      setTimeout(initialize, 100);
      return;
    }
    
    if (!eventBus) {
      console.error('[LayerPanel] TegakiEventBus not found');
      return;
    }
    
    // DOM要素取得
    container = document.getElementById('layer-panel-items');
    if (!container) {
      console.error('[LayerPanel] #layer-panel-items not found');
      return;
    }
    
    // イベントリスナー登録
    _setupEventListeners();
    
    // 初回レンダリング
    requestAnimationFrame(() => {
      _initializeRender();
    });
    
    console.log('[LayerPanel] Phase 4-11 Initialized successfully');
  }

  // ========================================
  // イベントリスナー設定
  // ========================================
  function _setupEventListeners() {
    if (!eventBus) return;
    
    eventBus.on('layer:panel-update-requested', () => requestUpdate());
    eventBus.on('layer:created', () => requestUpdate());
    eventBus.on('folder:created', () => requestUpdate());
    eventBus.on('folder:toggled', () => requestUpdate());
    eventBus.on('layer:added-to-folder', () => requestUpdate());
    eventBus.on('layer:removed-from-folder', () => requestUpdate());
    eventBus.on('layer:deleted', () => requestUpdate());
    eventBus.on('layer:activated', () => requestUpdate());
    eventBus.on('layer:visibility-changed', () => requestUpdate());
    eventBus.on('layer:opacity-changed', () => requestUpdate());
    eventBus.on('layer:background-color-changed', () => requestUpdate());
    eventBus.on('layer:name-changed', () => requestUpdate());
    eventBus.on('camera:resized', () => updateAllThumbnails());
    
    eventBus.on('thumbnail:layer-updated', ({ data }) => {
      if (data && typeof data.layerIndex === 'number') {
        _updateSingleThumbnail(data.layerIndex);
      }
    });
    
    eventBus.on('ui:background-color-change-requested', ({ layerIndex, layerId }) => {
      if (layerManager?.changeBackgroundLayerColor) {
        layerManager.changeBackgroundLayerColor(layerIndex, layerId);
      }
    });
    
    eventBus.on('ui:active-panel-changed', ({ activePanel }) => {
      _updatePanelActiveState(activePanel === 'layer');
    });
    
    eventBus.on('ui:layer-selected', ({ layerIndex }) => {
      if (layerManager?.setActiveLayer) {
        layerManager.setActiveLayer(layerIndex);
      }
    });
  }

  // ========================================
  // 初回レンダリング
  // ========================================
  function _initializeRender() {
    if (_isInitialized) return;
    
    const layers = layerManager?.getAllLayers?.() || [];
    if (layers.length === 0) {
      setTimeout(() => _initializeRender(), 50);
      return;
    }
    
    const activeIndex = layerManager?.getActiveLayerIndex?.() || 0;
    render(layers, activeIndex);
    _isInitialized = true;
  }

  // ========================================
  // レンダリング要求
  // ========================================
  function requestUpdate() {
    if (_updateTimeout) return;
    _updateTimeout = setTimeout(() => {
      _updateTimeout = null;
      const layers = layerManager?.getAllLayers?.() || [];
      const activeIndex = layerManager?.getActiveLayerIndex?.() || 0;
      render(layers, activeIndex);
    }, 16);
  }

  // ========================================
  // メインレンダリング
  // ========================================
  function render(layers, activeIndex) {
    if (!container) return;
    if (!layers || layers.length === 0) return;
    
    container.innerHTML = '';
    
    // パネル高さ固定
    container.style.maxHeight = '600px';
    container.style.overflowY = 'auto';
    container.style.overflowX = 'hidden';
    
    // レイヤーを逆順表示（上から描画レイヤー、下に背景）
    const reversedLayers = [...layers].reverse();
    const reversedActiveIndex = layers.length - 1 - activeIndex;
    
    reversedLayers.forEach((layer, reversedIndex) => {
      const originalIndex = layers.length - 1 - reversedIndex;
      const isActive = reversedIndex === reversedActiveIndex;
      
      // フォルダ内レイヤーが閉じたフォルダ内にある場合はスキップ
      if (layer.layerData?.parentId && folderSystem) {
        const parentFolder = layers.find(l => l.layerData?.id === layer.layerData.parentId);
        if (parentFolder && parentFolder.layerData?.isFolder && !parentFolder.layerData.folderExpanded) {
          return;
        }
      }
      
      const layerElement = layer.layerData?.isFolder 
        ? createFolderElement(layer, originalIndex, isActive, layers)
        : createLayerElement(layer, originalIndex, isActive);
      
      container.appendChild(layerElement);
    });
    
    initializeSortable();
  }

  // ========================================
  // 🆕 フォルダ要素生成
  // ========================================
  function createFolderElement(folder, index, isActive, allLayers) {
    const folderDiv = document.createElement('div');
    folderDiv.className = 'layer-item folder-item';
    if (isActive) folderDiv.classList.add('active');
    folderDiv.dataset.layerIndex = index;
    folderDiv.dataset.isFolder = 'true';
    
    const isExpanded = folder.layerData?.folderExpanded || false;
    const bgColor = isExpanded ? UI_COLORS.lightMedium : UI_COLORS.medium;
    const indentLevel = _calculateIndentLevel(folder, allLayers);
    const leftOffset = indentLevel * 12;
    
    folderDiv.style.cssText = `
      width: 170px;
      min-height: 48px;
      background-color: ${bgColor};
      opacity: 0.9;
      border: 1px solid ${UI_COLORS.lightMedium};
      border-radius: 4px;
      padding: 5px 7px;
      margin-bottom: 4px;
      margin-left: ${leftOffset}px;
      cursor: grab;
      display: grid;
      grid-template-columns: 90px 64px;
      grid-template-rows: 14px 16px 14px;
      gap: 1px 1px;
      align-items: center;
      position: relative;
      backdrop-filter: blur(8px);
      transition: all 0.2s ease;
      touch-action: none;
      user-select: none;
    `;
    
    if (isActive) {
      folderDiv.style.borderColor = UI_COLORS.activeBorder;
      folderDiv.style.borderWidth = '2px';
      folderDiv.style.padding = '4px 6px';
    }
    
    // 耳部分
    const ear = _createFolderEar(isExpanded);
    folderDiv.appendChild(ear);
    
    // 行1: 透明度プレースホルダー
    const row1 = document.createElement('div');
    row1.style.cssText = 'grid-column: 1; grid-row: 1; height: 14px;';
    folderDiv.appendChild(row1);
    
    // 行2: 可視性 + 開閉トグル
    const row2 = document.createElement('div');
    row2.style.cssText = 'grid-column: 1; grid-row: 2; display: flex; align-items: center; gap: 4px; height: 16px;';
    
    const visibilityIcon = _createVisibilityIcon(folder, index);
    row2.appendChild(visibilityIcon);
    
    const toggleIcon = _createFolderToggleIcon(folder, index, isExpanded);
    row2.appendChild(toggleIcon);
    
    // プレースホルダー
    for (let i = 0; i < 2; i++) {
      const placeholder = document.createElement('div');
      placeholder.style.cssText = 'width: 16px; height: 16px; flex-shrink: 0;';
      row2.appendChild(placeholder);
    }
    folderDiv.appendChild(row2);
    
    // 行3: フォルダ名
    const nameSpan = _createLayerName(folder, index);
    folderDiv.appendChild(nameSpan);
    
    // サムネイル
    const thumbnail = createFolderThumbnail(folder, index, allLayers);
    thumbnail.style.cssText = 'grid-column: 2; grid-row: 1/4; display: flex; align-items: center; justify-content: center;';
    folderDiv.appendChild(thumbnail);
    
    // 削除ボタン
    const deleteBtn = _createDeleteButton(index);
    folderDiv.appendChild(deleteBtn);
    
    folderDiv.addEventListener('mouseenter', () => {
      deleteBtn.style.opacity = '1';
    });
    
    folderDiv.addEventListener('mouseleave', () => {
      deleteBtn.style.opacity = '0';
    });
    
    folderDiv.addEventListener('click', (e) => {
      if (e.target.closest('.layer-delete-button') ||
          e.target.closest('.layer-visibility') ||
          e.target.closest('.folder-toggle-icon') ||
          e.target.closest('.layer-name') ||
          _editingLayerIndex >= 0) {
        return;
      }
      
      if (stateManager) {
        stateManager.setLastActivePanel('layer');
      }
      
      if (layerManager?.setActiveLayer) {
        layerManager.setActiveLayer(index);
      }
    });
    
    return folderDiv;
  }

  // ========================================
  // 🆕 フォルダの耳部分
  // ========================================
  function _createFolderEar(isExpanded) {
    const ear = document.createElement('div');
    ear.className = 'folder-ear';
    ear.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 30px;
      height: 14px;
      background-color: ${UI_COLORS.medium};
      border-radius: 4px 0 4px 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    `;
    
    const iconSVG = isExpanded ? SVG_ICONS.folderOpen : SVG_ICONS.folder;
    ear.innerHTML = iconSVG.replace(/width="20"/, 'width="12"').replace(/height="20"/, 'height="12"').replace(/currentColor/, UI_COLORS.maroon);
    
    return ear;
  }

  // ========================================
  // 🆕 フォルダ開閉トグルアイコン
  // ========================================
  function _createFolderToggleIcon(folder, index, isExpanded) {
    const toggleIcon = document.createElement('div');
    toggleIcon.className = 'folder-toggle-icon';
    toggleIcon.style.cssText = 'cursor: pointer; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;';
    
    toggleIcon.innerHTML = isExpanded
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${UI_COLORS.maroon}" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${UI_COLORS.maroon}" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`;
    
    toggleIcon.title = isExpanded ? 'フォルダを閉じる' : 'フォルダを開く';
    
    toggleIcon.addEventListener('click', (e) => {
      e.stopPropagation();
      if (folderSystem?.toggleFolderExpand) {
        folderSystem.toggleFolderExpand(folder.layerData.id);
      }
    });
    
    return toggleIcon;
  }

  // ========================================
  // 🆕 フォルダサムネイル生成
  // ========================================
  function createFolderThumbnail(folder, index, allLayers) {
    const maxWidth = 64;
    const maxHeight = 44;
    
    const thumbnailContainer = document.createElement('div');
    thumbnailContainer.className = 'layer-thumbnail folder-thumbnail';
    thumbnailContainer.dataset.layerIndex = index;
    
    thumbnailContainer.style.width = maxWidth + 'px';
    thumbnailContainer.style.height = maxHeight + 'px';
    thumbnailContainer.style.boxSizing = 'border-box';
    thumbnailContainer.style.border = `1px solid ${UI_COLORS.medium}`;
    thumbnailContainer.style.borderRadius = '2px';
    thumbnailContainer.style.overflow = 'hidden';
    thumbnailContainer.style.position = 'relative';
    thumbnailContainer.style.display = 'flex';
    thumbnailContainer.style.alignItems = 'center';
    thumbnailContainer.style.justifyContent = 'center';
    thumbnailContainer.style.flexShrink = '0';
    thumbnailContainer.style.backgroundColor = '#f5f5f5';
    
    if (thumbnailGenerator && folder && folderSystem) {
      _generateFolderThumbnail(folder, allLayers, maxWidth, maxHeight)
        .then(result => {
          if (result && result.dataUrl) {
            thumbnailContainer.style.width = result.width + 'px';
            thumbnailContainer.style.height = result.height + 'px';
            
            const img = document.createElement('img');
            img.src = result.dataUrl;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.display = 'block';
            img.style.objectFit = 'contain';
            thumbnailContainer.innerHTML = '';
            thumbnailContainer.appendChild(img);
          }
        })
        .catch(() => {});
    }
    
    return thumbnailContainer;
  }

  // ========================================
  // 🆕 フォルダ内レイヤー合成サムネイル生成
  // ========================================
  async function _generateFolderThumbnail(folder, allLayers, maxWidth, maxHeight) {
    if (!folderSystem) return null;
    
    const children = folderSystem.getFolderChildren(folder.layerData.id);
    
    if (children.length === 0) {
      return null;
    }
    
    // ThumbnailGeneratorに委譲
    if (thumbnailGenerator?.generateFolderThumbnail) {
      return await thumbnailGenerator.generateFolderThumbnail(children, maxWidth, maxHeight);
    }
    
    return null;
  }

  // ========================================
  // 🆕 階層レベル計算
  // ========================================
  function _calculateIndentLevel(layer, allLayers) {
    if (layer.layerData?.isBackground) return 0;
    
    // 通常レイヤー/フォルダは左端、フォルダ内レイヤーのみ右オフセット
    if (!layer.layerData?.parentId) return 0;
    
    return 1;
  }

  // ========================================
  // レイヤー要素生成
  // ========================================
  function createLayerElement(layer, index, isActive) {
    const layerDiv = document.createElement('div');
    layerDiv.className = 'layer-item';
    if (isActive) layerDiv.classList.add('active');
    layerDiv.dataset.layerIndex = index;
    
    const isBackground = layer.layerData?.isBackground || false;
    const allLayers = layerManager?.getAllLayers?.() || [];
    const indentLevel = _calculateIndentLevel(layer, allLayers);
    const leftOffset = indentLevel * 12;
    const hasParent = layer.layerData?.parentId;
    
    layerDiv.style.cssText = `
      width: 170px;
      min-height: 48px;
      background-color: ${UI_COLORS.background};
      opacity: 0.9;
      border: 1px solid ${UI_COLORS.lightMedium};
      border-radius: 4px;
      padding: 5px 7px;
      margin-bottom: 4px;
      margin-left: ${leftOffset}px;
      cursor: ${isBackground ? 'default' : 'grab'};
      display: grid;
      grid-template-columns: 90px 64px;
      grid-template-rows: 14px 16px 14px;
      gap: 1px 1px;
      align-items: center;
      position: relative;
      backdrop-filter: blur(8px);
      transition: all 0.2s ease;
      touch-action: none;
      user-select: none;
    `;
    
    if (isActive && !isBackground) {
      layerDiv.style.borderColor = UI_COLORS.activeBorder;
      layerDiv.style.borderWidth = '2px';
      layerDiv.style.padding = '4px 6px';
    }
    
    // フォルダ内レイヤーに左縦線
    if (hasParent) {
      const verticalLine = document.createElement('div');
      verticalLine.className = 'folder-child-line';
      verticalLine.style.cssText = `
        position: absolute;
        left: -12px;
        top: 0;
        width: 2px;
        height: 100%;
        background-color: ${UI_COLORS.medium};
      `;
      layerDiv.appendChild(verticalLine);
    }
    
    if (isBackground) {
      // 背景レイヤー用
      const row1 = document.createElement('div');
      row1.style.cssText = 'grid-column: 1; grid-row: 1; height: 14px;';
      layerDiv.appendChild(row1);
      
      const row2 = document.createElement('div');
      row2.style.cssText = 'grid-column: 1; grid-row: 2; display: flex; align-items: center; gap: 4px; height: 16px;';
      
      const visibilityIcon = _createVisibilityIcon(layer, index);
      row2.appendChild(visibilityIcon);
      
      const spacer = document.createElement('div');
      spacer.style.cssText = 'width: 16px; height: 16px; flex-shrink: 0;';
      row2.appendChild(spacer);
      
      const bucketIcon = _createBucketIcon(index, layer);
      row2.appendChild(bucketIcon);
      layerDiv.appendChild(row2);
      
      const nameSpan = document.createElement('span');
      nameSpan.className = 'layer-name';
      nameSpan.textContent = '背景';
      nameSpan.style.cssText = `grid-column: 1; grid-row: 3; color: ${UI_COLORS.maroon}; font-size: 10px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left; cursor: default; padding: 0; height: 14px; display: flex; align-items: center;`;
      layerDiv.appendChild(nameSpan);
      
      const thumbnail = createThumbnail(layer, index);
      thumbnail.style.cssText = 'grid-column: 2; grid-row: 1/4; display: flex; align-items: center; justify-content: center;';
      layerDiv.appendChild(thumbnail);
      
      layerDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
      });
      
      return layerDiv;
    }
    
    // 通常レイヤー用
    const row1 = document.createElement('div');
    row1.style.cssText = 'grid-column: 1; grid-row: 1; display: flex; align-items: center; gap: 2px; justify-content: flex-start; height: 14px;';
    
    const folderPlaceholder = document.createElement('div');
    folderPlaceholder.style.cssText = 'width: 14px; height: 14px; flex-shrink: 0;';
    row1.appendChild(folderPlaceholder);
    
    const opacityContainer = _createOpacityControl(layer, index);
    row1.appendChild(opacityContainer);
    layerDiv.appendChild(row1);
    
    const row2 = document.createElement('div');
    row2.style.cssText = 'grid-column: 1; grid-row: 2; display: flex; align-items: center; gap: 4px; height: 16px;';
    
    const visibilityIcon = _createVisibilityIcon(layer, index);
    row2.appendChild(visibilityIcon);
    
    for (let i = 0; i < 3; i++) {
      const placeholder = document.createElement('div');
      placeholder.style.cssText = 'width: 16px; height: 16px; flex-shrink: 0;';
      row2.appendChild(placeholder);
    }
    layerDiv.appendChild(row2);
    
    const nameSpan = _createLayerName(layer, index);
    layerDiv.appendChild(nameSpan);
    
    const thumbnail = createThumbnail(layer, index);
    thumbnail.style.cssText = 'grid-column: 2; grid-row: 1/4; display: flex; align-items: center; justify-content: center;';
    layerDiv.appendChild(thumbnail);
    
    const deleteBtn = _createDeleteButton(index);
    layerDiv.appendChild(deleteBtn);
    
    layerDiv.addEventListener('mouseenter', () => {
      deleteBtn.style.opacity = '1';
    });
    
    layerDiv.addEventListener('mouseleave', () => {
      deleteBtn.style.opacity = '0';
    });
    
    layerDiv.addEventListener('click', (e) => {
      if (e.target.closest('.layer-delete-button') ||
          e.target.closest('.layer-opacity-control button') ||
          e.target.closest('.layer-visibility') ||
          e.target.closest('.layer-name') ||
          _editingLayerIndex >= 0) {
        return;
      }
      
      if (stateManager) {
        stateManager.setLastActivePanel('layer');
      }
      
      if (layerManager?.setActiveLayer) {
        layerManager.setActiveLayer(index);
      }
    });
    
    return layerDiv;
  }

  // ========================================
  // 可視性アイコン
  // ========================================
  function _createVisibilityIcon(layer, index) {
    const visibilityIcon = document.createElement('div');
    visibilityIcon.className = 'layer-visibility';
    visibilityIcon.style.cssText = 'cursor: pointer; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;';
    
    const isVisible = layer.layerData?.visible !== false;
    const iconSvg = isVisible ? SVG_ICONS.eye : SVG_ICONS.eyeOff;
    visibilityIcon.innerHTML = iconSvg.replace(/width="20"/, 'width="14"').replace(/height="20"/, 'height="14"').replace(/currentColor/, UI_COLORS.maroon);
    
    visibilityIcon.addEventListener('click', (e) => {
      e.stopPropagation();
      if (layerManager?.toggleLayerVisibility) {
        layerManager.toggleLayerVisibility(index);
      }
    });
    
    return visibilityIcon;
  }

  // ========================================
  // バケツアイコン（背景色変更）
  // ========================================
  function _createBucketIcon(index, layer) {
    const bucketIcon = document.createElement('div');
    bucketIcon.className = 'layer-background-color-button';
    bucketIcon.style.cssText = 'cursor: pointer; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;';
    bucketIcon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" 
           viewBox="0 0 24 24" fill="none" stroke="${UI_COLORS.maroon}" 
           stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/>
          <path d="m5 2 5 5"/>
          <path d="M2 13h15"/>
          <path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/>
      </svg>
    `;
    bucketIcon.title = '背景色を現在のペンカラーに変更';
    bucketIcon.addEventListener('click', (e) => {
      e.stopPropagation();
      if (eventBus) {
        eventBus.emit('ui:background-color-change-requested', {
          layerIndex: index,
          layerId: layer.layerData?.id
        });
      }
    });
    return bucketIcon;
  }

  // ========================================
  // 透明度コントロール
  // ========================================
  function _createOpacityControl(layer, index) {
    const opacityContainer = document.createElement('div');
    opacityContainer.className = 'layer-opacity-control';
    opacityContainer.style.cssText = 'display: flex; align-items: center; gap: 2px; font-size: 10px; user-select: none;';
    
    const decreaseBtn = document.createElement('button');
    decreaseBtn.textContent = '◀';
    decreaseBtn.style.cssText = `padding: 0; font-size: 9px; line-height: 1; height: 12px; width: 12px; cursor: pointer; border: none; background: transparent; color: ${UI_COLORS.maroon}; flex-shrink: 0;`;
    decreaseBtn.title = '透明度 -10%';
    decreaseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      _adjustLayerOpacity(index, -0.1);
    });
    
    const opacityValue = document.createElement('span');
    opacityValue.className = 'layer-opacity-value';
    const currentOpacity = layer.alpha !== undefined ? layer.alpha : 1.0;
    opacityValue.textContent = `${Math.round(currentOpacity * 100)}%`;
    opacityValue.style.cssText = `min-width: 30px; text-align: center; color: ${UI_COLORS.maroon}; font-size: 9px; font-weight: bold; flex-shrink: 0;`;
    
    const increaseBtn = document.createElement('button');
    increaseBtn.textContent = '▶';
    increaseBtn.style.cssText = `padding: 0; font-size: 9px; line-height: 1; height: 12px; width: 12px; cursor: pointer; border: none; background: transparent; color: ${UI_COLORS.maroon}; flex-shrink: 0;`;
    increaseBtn.title = '透明度 +10%';
    increaseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      _adjustLayerOpacity(index, 0.1);
    });
    
    opacityContainer.appendChild(decreaseBtn);
    opacityContainer.appendChild(opacityValue);
    opacityContainer.appendChild(increaseBtn);
    
    return opacityContainer;
  }

  // ========================================
  // レイヤー名
  // ========================================
  function _createLayerName(layer, index) {
    const nameSpan = document.createElement('span');
    nameSpan.className = 'layer-name';
    nameSpan.textContent = layer.layerData?.name || `レイヤー${index}`;
    nameSpan.style.cssText = `grid-column: 1; grid-row: 3; color: ${UI_COLORS.maroon}; font-size: 10px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left; cursor: text; padding: 0; height: 14px; display: flex; align-items: center;`;
    
    let clickCount = 0;
    let clickTimer = null;
    
    nameSpan.addEventListener('click', (e) => {
      e.stopPropagation();
      clickCount++;
      
      if (clickCount === 1) {
        clickTimer = setTimeout(() => {
          clickCount = 0;
        }, 300);
      } else if (clickCount === 2) {
        clearTimeout(clickTimer);
        clickCount = 0;
        
        if (_editingLayerIndex === -1) {
          _editLayerName(nameSpan, layer, index);
        }
      }
    });
    
    return nameSpan;
  }

  // ========================================
  // 削除ボタン
  // ========================================
  function _createDeleteButton(index) {
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'layer-delete-button';
    deleteBtn.style.cssText = `position: absolute; top: 3px; right: 3px; padding: 0; width: 13px; height: 13px; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none; border-radius: 50%; background: ${UI_COLORS.medium}; transition: background 0.2s, transform 0.1s, opacity 0.2s; z-index: 10; opacity: 0;`;
    deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="${UI_COLORS.background}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
      <path d="m18 6-12 12"/><path d="m6 6 12 12"/>
    </svg>`;
    deleteBtn.title = 'レイヤーを削除';
    
    deleteBtn.addEventListener('mouseenter', function() {
      this.style.backgroundColor = UI_COLORS.maroon;
      this.style.transform = 'scale(1.15)';
    });
    
    deleteBtn.addEventListener('mouseleave', function() {
      this.style.backgroundColor = UI_COLORS.medium;
      this.style.transform = 'scale(1)';
    });
    
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (layerManager?.deleteLayer) {
        layerManager.deleteLayer(index);
      }
    });
    
    return deleteBtn;
  }

  // ========================================
  // サムネイル生成
  // ========================================
  function createThumbnail(layer, index) {
    const maxWidth = 64;
    const maxHeight = 44;
    
    const thumbnailContainer = document.createElement('div');
    thumbnailContainer.className = 'layer-thumbnail';
    thumbnailContainer.dataset.layerIndex = index;
    
    thumbnailContainer.style.width = maxWidth + 'px';
    thumbnailContainer.style.height = maxHeight + 'px';
    thumbnailContainer.style.boxSizing = 'border-box';
    thumbnailContainer.style.border = `1px solid ${UI_COLORS.medium}`;
    thumbnailContainer.style.borderRadius = '2px';
    thumbnailContainer.style.overflow = 'hidden';
    thumbnailContainer.style.position = 'relative';
    thumbnailContainer.style.display = 'flex';
    thumbnailContainer.style.alignItems = 'center';
    thumbnailContainer.style.justifyContent = 'center';
    thumbnailContainer.style.flexShrink = '0';
    thumbnailContainer.style.backgroundColor = '#f5f5f5';
    
    if (thumbnailGenerator && layer) {
      thumbnailGenerator.generateLayerThumbnail(layer, index, maxWidth, maxHeight)
        .then(result => {
          if (result && result.dataUrl) {
            thumbnailContainer.style.width = result.width + 'px';
            thumbnailContainer.style.height = result.height + 'px';
            
            const img = document.createElement('img');
            img.src = result.dataUrl;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.display = 'block';
            img.style.objectFit = 'contain';
            thumbnailContainer.innerHTML = '';
            thumbnailContainer.appendChild(img);
          }
        })
        .catch(() => {});
    }
    
    return thumbnailContainer;
  }

  // ========================================
  // レイヤー名編集
  // ========================================
  function _editLayerName(nameSpan, layer, index) {
    if (layer.layerData?.isBackground || _editingLayerIndex >= 0) {
      return;
    }
    
    _editingLayerIndex = index;
    
    const originalName = nameSpan.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalName;
    input.style.cssText = `grid-column: ${nameSpan.style.gridColumn}; grid-row: ${nameSpan.style.gridRow}; color: ${UI_COLORS.maroon}; font-size: 10px; font-weight: bold; background: #fff; border: 1px solid ${UI_COLORS.maroon}; border-radius: 2px; padding: 1px 3px; width: 100%; box-sizing: border-box; height: 14px;`;
    
    nameSpan.replaceWith(input);
    _editingInput = input;
    
    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
    
    const finishEdit = () => {
      if (_editingLayerIndex !== index || !_editingInput) return;
      
      _editingLayerIndex = -1;
      const currentInput = _editingInput;
      _editingInput = null;
      
      const newName = currentInput.value.trim();
      if (newName && newName !== originalName) {
        if (layer.layerData) {
          layer.layerData.name = newName;
        }
        if (eventBus) {
          eventBus.emit('layer:name-changed', {
            layerIndex: index,
            layerId: layer.layerData?.id,
            oldName: originalName,
            newName: newName
          });
        }
      }
      
      nameSpan.textContent = newName || originalName;
      currentInput.replaceWith(nameSpan);
    };
    
    input.addEventListener('blur', () => {
      setTimeout(() => finishEdit(), 150);
    });
    
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        finishEdit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        input.value = originalName;
        finishEdit();
      }
    });
    
    input.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  // ========================================
  // サムネイル更新
  // ========================================
  async function _updateSingleThumbnail(layerIndex) {
    const layers = layerManager?.getAllLayers?.() || [];
    if (layerIndex < 0 || layerIndex >= layers.length) return;
    
    const reversedIndex = layers.length - 1 - layerIndex;
    const layerItems = container.querySelectorAll('.layer-item');
    if (reversedIndex < 0 || reversedIndex >= layerItems.length) return;
    
    const thumbnailContainer = layerItems[reversedIndex].querySelector('.layer-thumbnail');
    if (!thumbnailContainer) return;
    
    const layer = layers[layerIndex];
    const maxWidth = 64;
    const maxHeight = 44;
    
    if (thumbnailGenerator) {
      try {
        const result = await thumbnailGenerator.generateLayerThumbnail(layer, layerIndex, maxWidth, maxHeight);
        if (result && result.dataUrl) {
          thumbnailContainer.style.width = result.width + 'px';
          thumbnailContainer.style.height = result.height + 'px';
          
          const img = document.createElement('img');
          img.src = result.dataUrl;
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.display = 'block';
          img.style.objectFit = 'contain';
          thumbnailContainer.innerHTML = '';
          thumbnailContainer.appendChild(img);
        }
      } catch (error) {}
    }
  }

  async function updateAllThumbnails() {
    const layers = layerManager?.getAllLayers?.() || [];
    for (let i = 0; i < layers.length; i++) {
      await _updateSingleThumbnail(i);
    }
  }

  // ========================================
  // 透明度調整
  // ========================================
  function _adjustLayerOpacity(layerIndex, delta) {
    const layer = layerManager.getAllLayers()[layerIndex];
    const currentOpacity = layer.alpha !== undefined ? layer.alpha : 1.0;
    const newOpacity = Math.max(0, Math.min(1, currentOpacity + delta));
    _setLayerOpacity(layerIndex, newOpacity);
  }

  function _setLayerOpacity(layerIndex, opacity) {
    if (layerManager.setLayerOpacity) {
      layerManager.setLayerOpacity(layerIndex, opacity);
    }
    
    const layers = layerManager.getAllLayers();
    const reversedIndex = layers.length - 1 - layerIndex;
    const layerDiv = container.querySelectorAll('.layer-item')[reversedIndex];
    const opacityValue = layerDiv?.querySelector('.layer-opacity-value');
    if (opacityValue) {
      opacityValue.textContent = `${Math.round(opacity * 100)}%`;
    }
  }

  // ========================================
  // パネルアクティブ状態更新
  // ========================================
  function _updatePanelActiveState(isActive) {
    const activeLayer = container.querySelector('.layer-item.active');
    if (!activeLayer) return;
    
    if (isActive) {
      activeLayer.style.borderColor = UI_COLORS.activeBorder;
    } else {
      activeLayer.style.borderColor = UI_COLORS.lightMaroon;
    }
  }

  // ========================================
  // Sortable初期化（ドラッグ移動）
  // ========================================
  function initializeSortable() {
    if (!window.Sortable) return;
    
    try {
      if (sortable) {
        sortable.destroy();
      }
      
      sortable = window.Sortable.create(container, {
        animation: 200,
        easing: 'cubic-bezier(0.25, 0.8, 0.25, 1)',
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        chosenClass: 'sortable-chosen',
        forceFallback: false,
        fallbackOnBody: false,
        swapThreshold: 0.65,
        delay: 0,
        delayOnTouchOnly: false,
        
        filter: (evt) => {
          const item = evt.target.closest('.layer-item');
          if (!item) return false;
          const layerIndex = parseInt(item.dataset.layerIndex);
          const layers = layerManager?.getAllLayers?.() || [];
          const layer = layers[layerIndex];
          return layer?.layerData?.isBackground || false;
        },
        
        onChoose: (evt) => {
          const item = evt.item;
          item.style.cursor = 'grabbing';
        },
        
        onEnd: (evt) => {
          evt.item.style.opacity = '';
          evt.item.style.cursor = '';
          
          if (layerManager?.reorderLayers) {
            const layers = layerManager.getAllLayers();
            const oldIndex = layers.length - 1 - evt.oldIndex;
            const newIndex = layers.length - 1 - evt.newIndex;
            layerManager.reorderLayers(oldIndex, newIndex);
          }
        }
      });
    } catch (error) {}
  }

  // ========================================
  // リフレッシュ
  // ========================================
  function refresh() {
    requestUpdate();
  }

  // ========================================
  // 破棄
  // ========================================
  function destroy() {
    if (sortable) {
      sortable.destroy();
      sortable = null;
    }
    if (_updateTimeout) {
      clearTimeout(_updateTimeout);
    }
    _editingLayerIndex = -1;
    _editingInput = null;
  }

  // ========================================
  // 公開API
  // ========================================
  return {
    initialize,
    render,
    refresh,
    updateAllThumbnails,
    destroy
  };

})();

console.log('✅ LayerPanel Phase 4-11 統合版 loaded');
console.log('   🎨 webgl2_rev30デザイン完全継承');
console.log('   ✅ フォルダUI対応');
console.log('   ✅ サムネイル表示（Konvaベース）');
console.log('   ✅ ドラッグ移動（Sortable）');
console.log('   ✅ レイヤー名編集（ダブルクリック）');
console.log('   ✅ 透明度コントロール');
console.log('   ✅ 可視性トグル');
console.log('   ✅ 背景色変更（バケツアイコン）');
console.log('   ✅ 階層表示（左オフセット + 縦線）');