/**
 * ============================================================================
 * ファイル名: ui/layer-panel-renderer.js
 * 責務: レイヤーパネルのUI（レイヤー一覧、選択、可視性、透明度、合成モード、クリッピング状態、並び替え）を描画する
 * 依存: layer-system.js, thumbnail-system.js, event-bus.js, config.js, Sortable
 * 被依存: ui-panels.js, core-engine.js
 * 公開API: LayerPanelRenderer
 * イベント発火: ui:layer-selected, ui:background-color-change-requested
 * イベント受信: layer:*, folder:*, thumbnail:updated, animation:frame-changed, camera:resized, ui:layer-attribute-panel-requested
 * グローバル登録: window.LayerPanelRenderer
 * 実装状態: ✅完成/整備
 * ============================================================================
 */

import Sortable from 'sortablejs';
import { UI_ICONS } from './ui-icons.js';

export class LayerPanelRenderer {
    constructor(container, layerSystem, eventBus) {
        this.container = container;
        this.layerSystem = layerSystem;
        this.eventBus = eventBus;
        this.sortable = null;
        this._isInitialized = false;
        this._editingLayerIndex = -1;
        this._editingInput = null;
        this._updateTimeout = null;
        this._layerAttributePopup = null;
        this._attributePopupLayerIndex = -1;
        this._attributePopupAnchorElement = null;
        this._attributePopupDrag = null;
        this._isSortableDragging = false;
        this._pendingUpdateAfterDrag = false;
        this._handleAttributePopupOutsidePointerDown = this._handleAttributePopupOutsidePointerDown.bind(this);
        this._handleAttributePopupKeydown = this._handleAttributePopupKeydown.bind(this);
        this._handleAttributePopupDragMove = this._handleAttributePopupDragMove.bind(this);
        this._handleAttributePopupDragEnd = this._handleAttributePopupDragEnd.bind(this);
        this._handleLayerPanelKeydown = this._handleLayerPanelKeydown.bind(this);

        this._setupEventListeners();
        document.addEventListener('keydown', this._handleLayerPanelKeydown, true);

        // Phase 4z16: CAFヘッダークリックイベント (委譲)
        this.container.addEventListener('click', (e) => {
            const assetBtn = e.target.closest('.caf-readonly-asset');
            if (assetBtn) {
                const clipId = assetBtn.dataset.clipId;
                const animationTable = window.PopupManager?.get?.('animationTable');
                if (animationTable?.selectClipAssetFromExternal && clipId) {
                    animationTable.selectClipAssetFromExternal(clipId, { source: 'layer-panel-caf-header' });
                }
            }
        });

        requestAnimationFrame(() => {
            this._initializeRender();
        });
    }

    _initializeRender() {
        if (this._isInitialized) return;

        const layers = this.layerSystem?.getLayers() || [];
        if (layers.length === 0) {
            setTimeout(() => this._initializeRender(), 50);
            return;
        }

        const activeIndex = this.layerSystem?.getActiveLayerIndex() || 0;
        const animationSystem = window.animationSystem || null;
        this.render(layers, activeIndex, animationSystem);
        this._isInitialized = true;

        // 初回描画時に全サムネイルの生成を要求
        setTimeout(() => {
            this.updateAllThumbnails();
        }, 100);
    }

    _setupEventListeners() {
        if (!this.eventBus) return;

        this.eventBus.on('layer:panel-update-requested', () => this.requestUpdate({ force: true }));
        this.eventBus.on('layer:created', () => this.requestUpdate({ force: true }));
        this.eventBus.on('folder:created', () => this.requestUpdate({ force: true }));
        this.eventBus.on('folder:toggled', () => this.requestUpdate());
        this.eventBus.on('layer:added-to-folder', () => this.requestUpdate());
        this.eventBus.on('layer:removed-from-folder', () => this.requestUpdate());
        this.eventBus.on('layer:deleted', () => this.requestUpdate());
        this.eventBus.on('layer:activated', ({ layerIndex }) => {
            if (this._layerAttributePopup?.classList.contains('show')) {
                this._retargetLayerAttributePopup(layerIndex);
            }
            this.requestUpdate({ force: true });
        });
        this.eventBus.on('layer:visibility-changed', () => this.requestUpdate());
        this.eventBus.on('layer:opacity-changed', () => this.requestUpdate());
        this.eventBus.on('layer:blend-mode-changed', () => this.requestUpdate());
        this.eventBus.on('layer:clipping-changed', () => this.requestUpdate());
        this.eventBus.on('layer:multi-selection-changed', () => this.requestUpdate());
        this.eventBus.on('layer:background-color-changed', () => this.requestUpdate());
        this.eventBus.on('layer:name-changed', () => this.requestUpdate());
        this.eventBus.on('animation:frame-changed', () => this.requestUpdate());
        this.eventBus.on('camera:resized', () => this.updateAllThumbnails());

        // [指示書 v5/v6 修正] 無限ループ防止のため 'thumbnail:layer-updated' のリスナーを削除。
        // サムネイルの更新は、生成完了後に発行される 'thumbnail:updated' で一括処理する。

        // [指示書 v5] サムネイル生成完了通知を受け取って反映
        this.eventBus.on('thumbnail:updated', (data) => {
            if (!data || !data.dataURL) return;

            const layers = this.layerSystem?.getLayers() || [];
            const layerIndex = data.layerIndex;
            if (typeof layerIndex !== 'number') return;

            const reversedIndex = layers.length - 1 - layerIndex;
            const layerItems = this.container.querySelectorAll('.layer-item');
            if (reversedIndex < 0 || reversedIndex >= layerItems.length) return;

            const thumbnailContainer = layerItems[reversedIndex]
                ?.querySelector('.layer-thumbnail');
            if (!thumbnailContainer) return;

            let img = thumbnailContainer.querySelector('img');
            if (!img) {
                img = document.createElement('img');
                img.style.maxWidth = '100%';
                img.style.maxHeight = '100%';
                img.style.display = 'block';
                img.style.objectFit = 'contain';
                thumbnailContainer.innerHTML = '';
                thumbnailContainer.appendChild(img);
            }
            img.src = data.dataURL;
        });

        this.eventBus.on('ui:background-color-change-requested', ({ layerIndex, layerId }) => {
            if (this.layerSystem?.changeBackgroundLayerColor) {
                this.layerSystem.changeBackgroundLayerColor(layerIndex, layerId);
            }
        });

        this.eventBus.on('ui:active-panel-changed', ({ activePanel }) => {
            this._updatePanelActiveState(activePanel === 'layer');
        });

        this.eventBus.on('ui:layer-selected', ({ layerIndex }) => {
            if (this.layerSystem?.setActiveLayer) {
                this.layerSystem.setActiveLayer(layerIndex);
            }
        });

        this.eventBus.on('ui:layer-attribute-panel-requested', ({ anchorElement } = {}) => {
            this.showActiveLayerAttributePopup(anchorElement);
        });
    }

    requestUpdate(options = {}) {
        const force = options.force === true;
        if (force) {
            this._resetDragState();
        }

        if (this._isSortableDragging) {
            this._pendingUpdateAfterDrag = true;
            return;
        }

        if (this._updateTimeout) return;
        this._updateTimeout = setTimeout(() => {
            this._updateTimeout = null;
            const layers = this.layerSystem?.getLayers() || [];
            const activeIndex = this.layerSystem?.getActiveLayerIndex() || 0;
            const animationSystem = window.animationSystem || null;
            this.render(layers, activeIndex, animationSystem);
        }, 16);
    }

    _resetDragState() {
        this._isSortableDragging = false;
        this._pendingUpdateAfterDrag = false;
        this._dragFolderTargetId = null;
        this._finishFolderDrag();
    }

    render(layers, activeIndex, animationSystem = null) {
        if (!this.container) return;
        if (!layers || layers.length === 0) return;

        this._dragFolderTargetId = null;
        this.container.innerHTML = '';
        this.container.classList.remove('layer-panel-items--folder-dragging');

        this.container.style.overflowY = 'auto';
        this.container.style.overflowX = 'hidden';

        // Phase 4z15: CAF読み取り専用ヘッダーの描画
        const cafHeader = this.createCafReadonlyHeader();
        if (cafHeader) {
            this.container.appendChild(cafHeader);
        }

        const reversedLayers = [...layers].reverse();
        const reversedActiveIndex = layers.length - 1 - activeIndex;
        const selectedLayerIds = new Set(this.layerSystem?.getSelectedLayerIds?.() || []);

        reversedLayers.forEach((layer, reversedIndex) => {
            const originalIndex = layers.length - 1 - reversedIndex;
            const isActive = originalIndex === activeIndex;
            const isSelected = selectedLayerIds.has(layer.layerData?.id);

            if (this._isLayerHiddenByClosedFolder(layer, layers)) return;

            const layerElement = layer.layerData?.isFolder
                ? this.createFolderElement(layer, originalIndex, isActive, layers, isSelected)
                : this.createLayerElement(layer, originalIndex, isActive, animationSystem, isSelected);

            this.container.appendChild(layerElement);
        });

        if (!this.sortable) {
            this.initializeSortable();
        }
        this._updateScrollState();
    }

    createFolderElement(folder, index, isActive, allLayers, isSelected = false) {
        const folderDiv = document.createElement('div');
        folderDiv.className = 'layer-item folder-item';
        if (isActive) {
            folderDiv.classList.add('active');
        }
        if (isSelected) {
            folderDiv.classList.add('selected');
        }
        folderDiv.dataset.layerIndex = index;
        folderDiv.dataset.isFolder = 'true';

        const isExpanded = folder.layerData.folderExpanded;
        const bgColor = isExpanded ? '#e9c2ba' : '#cf9c97';
        const indentLevel = this._calculateIndentLevel(folder, allLayers);
        const leftOffset = indentLevel * 12;
        const rowWidth = isActive ? 160 : Math.max(120, 160 - indentLevel * 14);

        folderDiv.style.cssText = `
            width:${rowWidth}px;
            min-height:38px;
            background-color:${bgColor};
            opacity:0.9;
            border:1px solid #e9c2ba;
            border-radius:4px;
            padding:3px 5px;
            margin-bottom:2px;
            margin-left:${leftOffset}px;
            cursor:grab;
            display:grid;
            grid-template-columns:40px minmax(0, 1fr) 18px 18px;
            grid-template-rows:32px;
            gap:0 5px;
            align-items:center;
            position:relative;
            backdrop-filter:blur(8px);
            transition:all 0.2s ease;
            touch-action:none;
            user-select:none;
        `;

        if (isActive) {
            folderDiv.style.borderColor = '#ff6600';
            folderDiv.style.borderWidth = '2px';
        } else if (isSelected) {
            folderDiv.style.borderColor = 'rgba(255, 140, 66, 0.6)';
        }

        const thumbnail = this.createFolderThumbnail(folder, index, allLayers);
        thumbnail.style.cssText = 'grid-column:1;grid-row:1;display:flex;align-items:center;justify-content:center;';
        folderDiv.appendChild(thumbnail);

        const details = document.createElement('div');
        details.style.cssText = 'grid-column:2;grid-row:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:1px;height:32px;';

        const opacityContainer = this._createOpacityControl(folder, index);
        details.appendChild(opacityContainer);

        const nameSpan = this._createLayerName(folder, index);
        nameSpan.style.cssText = 'color:#800000;font-size:11px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left;cursor:text;padding:0;height:16px;display:flex;align-items:center;min-width:0;';
        details.appendChild(nameSpan);
        folderDiv.appendChild(details);

        const clipStatus = this._createClipStatusIcon(folder, index);
        clipStatus.style.gridColumn = '3';
        clipStatus.style.gridRow = '1';
        folderDiv.appendChild(clipStatus);

        const visibilityIcon = this._createVisibilityIcon(folder, index);
        visibilityIcon.style.gridColumn = '4';
        visibilityIcon.style.gridRow = '1';
        folderDiv.appendChild(visibilityIcon);

        folderDiv.addEventListener('click', (e) => {
            if (e.target.closest('.layer-delete-button') ||
                e.target.closest('.layer-visibility') ||
                e.target.closest('.layer-opacity-control') ||
                e.target.closest('.folder-toggle-icon') ||
                this._editingLayerIndex >= 0) {
                return;
            }

            if (window.stateManager) {
                window.stateManager.setLastActivePanel('layer');
            }

            this._handleLayerItemClick(e, index);
        });

        return folderDiv;
    }

    _createFolderEar(isExpanded) {
        const ear = document.createElement('div');
        ear.className = 'folder-ear';
        ear.style.cssText = `
            position:absolute;
            top:0;
            left:0;
            width:30px;
            height:14px;
            background-color:#cf9c97;
            border-radius:4px 0 4px 0;
            display:flex;
            align-items:center;
            justify-content:center;
            pointer-events:none;
        `;

        ear.innerHTML = isExpanded ? UI_ICONS.folderOpen : UI_ICONS.folder;
        const svg = ear.querySelector('svg');
        if (svg) {
            svg.setAttribute('width', '12');
            svg.setAttribute('height', '12');
            svg.setAttribute('stroke', '#800000');
        }
        return ear;
    }

    _createFolderToggleIcon(folder, index, isExpanded) {
        const toggleIcon = document.createElement('div');
        toggleIcon.className = 'folder-toggle-icon';
        toggleIcon.style.cssText = 'cursor:pointer;width:16px;height:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;';

        toggleIcon.innerHTML = isExpanded ? UI_ICONS.chevronDown : UI_ICONS.chevronRight;
        const svg = toggleIcon.querySelector('svg');
        if (svg) {
            svg.setAttribute('width', '14');
            svg.setAttribute('height', '14');
            svg.setAttribute('stroke', '#800000');
        }

        toggleIcon.title = isExpanded ? 'フォルダを閉じる' : 'フォルダを開く';

        toggleIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.layerSystem?.toggleFolderExpand) {
                this.layerSystem.toggleFolderExpand(folder.layerData.id);
            }
        });

        return toggleIcon;
    }

    createFolderThumbnail(folder, index, allLayers) {
        const maxWidth = 40;
        const maxHeight = 32;

        const thumbnailContainer = document.createElement('div');
        thumbnailContainer.className = 'layer-thumbnail folder-thumbnail';
        thumbnailContainer.dataset.layerIndex = index;

        thumbnailContainer.style.width = maxWidth + 'px';
        thumbnailContainer.style.height = maxHeight + 'px';
        thumbnailContainer.style.boxSizing = 'border-box';
        thumbnailContainer.style.border = '1px solid #cf9c97';
        thumbnailContainer.style.borderRadius = '2px';
        thumbnailContainer.style.overflow = 'hidden';
        thumbnailContainer.style.position = 'relative';
        thumbnailContainer.style.display = 'flex';
        thumbnailContainer.style.alignItems = 'center';
        thumbnailContainer.style.justifyContent = 'center';
        thumbnailContainer.style.flexShrink = '0';
        const isExpanded = folder.layerData?.folderExpanded;
        thumbnailContainer.style.backgroundColor = isExpanded
            ? 'rgba(207, 156, 151, 0.22)'
            : 'rgba(128, 0, 0, 0.16)';
        thumbnailContainer.style.color = '#800000';
        thumbnailContainer.innerHTML = isExpanded ? UI_ICONS.folderOpen : UI_ICONS.folder;
        const svg = thumbnailContainer.querySelector('svg');
        if (svg) {
            svg.setAttribute('width', '22');
            svg.setAttribute('height', '22');
            svg.setAttribute('stroke', 'currentColor');
        }

        thumbnailContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            this._finishFolderDrag();
            this._dragFolderTargetId = null;
            if (this.layerSystem?.toggleFolderExpand) {
                this.layerSystem.toggleFolderExpand(folder.layerData.id);
            }
        });
        thumbnailContainer.title = folder.layerData?.folderExpanded ? 'フォルダを閉じる' : 'フォルダを開く';

        return thumbnailContainer;
    }

    _calculateIndentLevel(layer, allLayers) {
        if (layer.layerData?.isBackground) return 0;
        if (!layer.layerData?.parentId) return 0;
        let level = 0;
        let parentId = layer.layerData.parentId;
        const visited = new Set();

        while (parentId && !visited.has(parentId)) {
            visited.add(parentId);
            const parent = allLayers.find(l => l.layerData?.id === parentId);
            if (!parent) break;
            level++;
            parentId = parent.layerData?.parentId || null;
        }

        return Math.min(level, 3);
    }

    _isLayerHiddenByClosedFolder(layer, allLayers) {
        let parentId = layer.layerData?.parentId;
        const visited = new Set();

        while (parentId && !visited.has(parentId)) {
            visited.add(parentId);
            const parent = allLayers.find(l => l.layerData?.id === parentId);
            if (parent?.layerData?.isFolder && !parent.layerData.folderExpanded) {
                return true;
            }
            parentId = parent?.layerData?.parentId || null;
        }

        return false;
    }

    createLayerElement(layer, index, isActive, animationSystem, isSelected = false) {
        const layerDiv = document.createElement('div');
        layerDiv.className = 'layer-item';
        if (isActive) {
            layerDiv.classList.add('active');
        }
        if (isSelected) {
            layerDiv.classList.add('selected');
        }
        layerDiv.dataset.layerIndex = index;

        const isBackground = layer.layerData?.isBackground || false;
        if (isBackground) {
            layerDiv.classList.add('background-layer');
        }
        const allLayers = this.layerSystem?.getLayers() || [];
        const indentLevel = this._calculateIndentLevel(layer, allLayers);
        const leftOffset = indentLevel * 12;
        const hasParent = layer.layerData?.parentId;
        const rowWidth = isActive ? 160 : Math.max(120, 160 - indentLevel * 14);

        layerDiv.style.cssText = `
            width:${rowWidth}px;
            min-height:38px;
            background-color:#ffffee;
            opacity:0.9;
            border:1px solid #e9c2ba;
            border-radius:4px;
            padding:3px 5px;
            margin-bottom:2px;
            margin-left:${leftOffset}px;
            cursor:${isBackground ? 'default' : 'grab'};
            display:grid;
            grid-template-columns:40px minmax(0, 1fr) 18px 18px;
            grid-template-rows:32px;
            gap:0 5px;
            align-items:center;
            position:relative;
            backdrop-filter:blur(8px);
            transition:all 0.2s ease;
            touch-action:none;
            user-select:none;
        `;

        if (isActive && !isBackground) {
            layerDiv.style.borderColor = '#ff6600';
            layerDiv.style.borderWidth = '2px';
        } else if (isSelected && !isBackground) {
            layerDiv.style.borderColor = 'rgba(255, 140, 66, 0.6)';
        }

        if (hasParent) {
            const verticalLine = document.createElement('div');
            verticalLine.className = 'folder-child-line';
            verticalLine.style.cssText = `
                position:absolute;
                left:-12px;
                top:0;
                width:2px;
                height:100%;
                background-color:#cf9c97;
            `;
            layerDiv.appendChild(verticalLine);
        }

        if (isBackground) {
            const thumbnail = this.createThumbnail(layer, index);
            thumbnail.style.gridColumn = '1';
            thumbnail.style.gridRow = '1';
            thumbnail.style.display = 'flex';
            thumbnail.style.alignItems = 'center';
            thumbnail.style.justifyContent = 'center';
            layerDiv.appendChild(thumbnail);

            const nameSpan = document.createElement('span');
            nameSpan.className = 'layer-name';
            nameSpan.textContent = '背景';
            nameSpan.style.cssText = 'grid-column:2;grid-row:1;color:#800000;font-size:11px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left;cursor:default;padding:0;height:20px;display:flex;align-items:center;';
            layerDiv.appendChild(nameSpan);

            const bucketIcon = this._createBucketIcon(index, layer);
            bucketIcon.style.gridColumn = '3';
            bucketIcon.style.gridRow = '1';
            layerDiv.appendChild(bucketIcon);

            const visibilityIcon = this._createVisibilityIcon(layer, index);
            visibilityIcon.style.gridColumn = '4';
            visibilityIcon.style.gridRow = '1';
            layerDiv.appendChild(visibilityIcon);

            return layerDiv;
        }

        const thumbnail = this.createThumbnail(layer, index);
        thumbnail.style.gridColumn = '1';
        thumbnail.style.gridRow = '1';
        thumbnail.style.display = 'flex';
        thumbnail.style.alignItems = 'center';
        thumbnail.style.justifyContent = 'center';
        layerDiv.appendChild(thumbnail);

        const details = document.createElement('div');
        details.style.cssText = 'grid-column:2;grid-row:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:1px;height:32px;';

        const opacityContainer = this._createOpacityControl(layer, index);
        details.appendChild(opacityContainer);

        const nameSpan = this._createLayerName(layer, index);
        nameSpan.style.cssText = 'color:#800000;font-size:11px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left;cursor:text;padding:0;height:16px;display:flex;align-items:center;min-width:0;';
        details.appendChild(nameSpan);
        layerDiv.appendChild(details);

        const clipStatus = this._createClipStatusIcon(layer, index);
        clipStatus.style.gridColumn = '3';
        clipStatus.style.gridRow = '1';
        layerDiv.appendChild(clipStatus);

        const visibilityIcon = this._createVisibilityIcon(layer, index);
        visibilityIcon.style.gridColumn = '4';
        visibilityIcon.style.gridRow = '1';
        layerDiv.appendChild(visibilityIcon);

        layerDiv.addEventListener('click', (e) => {
            if (e.target.closest('.layer-delete-button') ||
                e.target.closest('.layer-opacity-control') ||
                e.target.closest('.layer-visibility') ||
                this._editingLayerIndex >= 0) {
                return;
            }

            if (window.stateManager) {
                window.stateManager.setLastActivePanel('layer');
            }

            this._handleLayerItemClick(e, index);
        });

        return layerDiv;
    }

    _createClipStatusIcon(layer, index = -1) {
        const clipIcon = document.createElement('div');
        clipIcon.className = 'layer-clip-status';
        const isClipping = layer.layerData?.clipping === true;
        const canToggle = !layer.layerData?.isBackground && !layer.layerData?.isFolder;
        clipIcon.style.cssText = `width:16px;height:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#800000;opacity:${isClipping ? '1' : '0.28'};cursor:${canToggle ? 'pointer' : 'default'};`;
        clipIcon.title = layer.layerData?.clipping ? 'クリッピングON' : 'クリッピング未使用';

        if (canToggle || isClipping) {
            clipIcon.innerHTML = UI_ICONS.paperclip;
        }

        if (canToggle) {
            clipIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.layerSystem?.toggleLayerClipping) {
                    this.layerSystem.toggleLayerClipping(index);
                }
                if (this._layerAttributePopup?.classList.contains('show') &&
                    this._attributePopupLayerIndex === index) {
                    this._syncLayerAttributePopup(this._layerAttributePopup, index);
                }
            });
        }

        return clipIcon;
    }

    _createVisibilityIcon(layer, index) {
        const isVisible = layer.layerData?.visible !== false;
        const iconName = isVisible ? 'eye' : 'eyeOff';
        
        const visibilityIcon = document.createElement('div');
        visibilityIcon.className = 'layer-visibility ui-icon-button ui-icon-button--small';
        visibilityIcon.style.cssText = 'width:16px;height:16px;';
        visibilityIcon.innerHTML = UI_ICONS[iconName];

        visibilityIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.layerSystem?.toggleLayerVisibility) {
                this.layerSystem.toggleLayerVisibility(index);
            }
        });

        return visibilityIcon;
    }

    _createBucketIcon(index, layer) {
        const bucketIcon = document.createElement('div');
        bucketIcon.className = 'layer-background-color-button ui-icon-button ui-icon-button--small';
        bucketIcon.style.cssText = 'width:16px;height:16px;';
        bucketIcon.innerHTML = UI_ICONS.fill;
        bucketIcon.title = '背景色を現在のペンカラーに変更';
        
        bucketIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.eventBus) {
                this.eventBus.emit('ui:background-color-change-requested', {
                    layerIndex: index,
                    layerId: layer.layerData?.id
                });
            }
        });
        return bucketIcon;
    }

    _createOpacityControl(layer, index) {
        const opacityContainer = document.createElement('div');
        opacityContainer.className = 'layer-opacity-control';
        opacityContainer.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:10px;user-select:none;height:14px;min-width:0;';

        const opacityValue = document.createElement('span');
        opacityValue.className = 'layer-opacity-value';
        const currentOpacity = layer.alpha !== undefined ? layer.alpha : 1.0;
        opacityValue.textContent = `${Math.round(currentOpacity * 100)}%`;
        opacityValue.style.cssText = 'min-width:30px;text-align:left;color:#800000;font-size:10px;font-weight:bold;flex-shrink:0;cursor:default;';
        opacityValue.title = '右サイドバーのスライダーアイコンでレイヤー属性';

        const blendLabel = document.createElement('span');
        blendLabel.className = 'layer-blend-mode-label';
        const blendMode = layer.layerData?.blendMode || 'normal';
        blendLabel.textContent = this._getBlendModeLabel(blendMode);
        blendLabel.style.cssText = `color:#800000;font-size:9px;font-weight:bold;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:32px;opacity:${blendMode === 'normal' ? '0' : '0.72'};`;

        opacityContainer.appendChild(opacityValue);
        opacityContainer.appendChild(blendLabel);

        return opacityContainer;
    }

    _showLayerAttributePopup(layerIndex, anchorElement) {
        const layer = this.layerSystem?.getLayers?.()?.[layerIndex];
        if (!layer || layer.layerData?.isBackground) return;

        if (this.layerSystem?.setActiveLayer) {
            this.layerSystem.setActiveLayer(layerIndex);
        }

        const popup = this._ensureLayerAttributePopup();
        this._attributePopupLayerIndex = layerIndex;
        this._attributePopupAnchorElement = anchorElement;
        popup.dataset.layerIndex = String(layerIndex);
        this._renderLayerAttributePopupContent(popup, layerIndex);

        popup.classList.add('show');
        popup.style.display = 'block';
        this._positionLayerAttributePopup(popup, anchorElement);

        requestAnimationFrame(() => {
            document.addEventListener('pointerdown', this._handleAttributePopupOutsidePointerDown, true);
            document.addEventListener('keydown', this._handleAttributePopupKeydown, true);
        });
    }

    showActiveLayerAttributePopup(anchorElement = null) {
        const activeIndex = this.layerSystem?.getActiveLayerIndex?.();
        if (typeof activeIndex !== 'number' || activeIndex < 0) return;
        const fallbackAnchor = this.container?.querySelector(`.layer-item[data-layer-index="${activeIndex}"]`);
        this._showLayerAttributePopup(activeIndex, anchorElement || fallbackAnchor);
    }

    _ensureLayerAttributePopup() {
        if (this._layerAttributePopup?.isConnected) {
            return this._layerAttributePopup;
        }

        const popup = document.createElement('div');
        popup.className = 'layer-attribute-popup';
        popup.setAttribute('role', 'dialog');
        popup.setAttribute('aria-label', 'レイヤー属性');
        document.body.appendChild(popup);
        this._layerAttributePopup = popup;
        return popup;
    }

    _renderLayerAttributePopupContent(popup, layerIndex) {
        const layer = this.layerSystem?.getLayers?.()?.[layerIndex];
        if (!layer?.layerData) return;

        const opacity = Math.round((layer.alpha ?? layer.layerData.opacity ?? 1) * 100);
        const blendMode = layer.layerData.blendMode || 'normal';
        const clipping = layer.layerData.clipping === true;
        const isFolder = layer.layerData.isFolder === true;
        const layerName = this._escapeHtml(layer.layerData.name || 'レイヤー');
        const presets = [0, 25, 50, 75, 100];
        const blendModes = [
            { value: 'normal', label: '通常' },
            { value: 'multiply', label: '乗算' },
            { value: 'add', label: '加算' },
            { value: 'overlay', label: 'オーバーレイ' }
        ];

        popup.innerHTML = `
            <div class="layer-attribute-popup__header">
                <div class="layer-attribute-drag-strip" title="ドラッグして移動"></div>
                <button type="button" class="layer-attribute-title" data-action="rename-layer" title="名前変更">${layerName}</button>
                <button type="button" class="layer-attribute-close" data-action="close-popup" title="閉じる">${UI_ICONS.close}</button>
            </div>
            <div class="layer-attribute-popup__presets">
                ${presets.map(value => `<button type="button" class="layer-attribute-preset${value === opacity ? ' active' : ''}" data-opacity="${value}" title="${value}%">${value}</button>`).join('')}
            </div>
            <div class="layer-attribute-popup__slider-row">
                <input class="layer-attribute-opacity-slider" type="range" min="0" max="100" step="1" value="${opacity}" aria-label="透明度">
                <span class="layer-attribute-opacity-label" title="ダブルクリックで数値入力">${opacity}%</span>
            </div>
            ${isFolder ? '' : `
                <div class="layer-attribute-popup__attribute-row">
                    <label class="layer-attribute-blend-field">
                        <span class="layer-attribute-blend-label">合成</span>
                        <select class="layer-attribute-blend-select" aria-label="合成モード">
                            ${blendModes.map(mode => `<option value="${mode.value}"${mode.value === blendMode ? ' selected' : ''}>${mode.label}</option>`).join('')}
                        </select>
                    </label>
                    <button type="button" class="layer-attribute-clip-toggle${clipping ? ' active' : ''}" data-action="toggle-clipping" title="クリッピング">
                        ${UI_ICONS.paperclip}
                    </button>
                </div>
            `}
        `;

        popup.querySelector('[data-action="close-popup"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this._hideLayerAttributePopup();
        });

        popup.querySelector('[data-action="rename-layer"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this._editLayerAttributeNameValue(popup, layerIndex);
        });

        popup.querySelector('.layer-attribute-drag-strip')?.addEventListener('pointerdown', (e) => {
            this._startLayerAttributePopupDrag(e, popup);
        });

        popup.querySelectorAll('[data-opacity]').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = parseInt(button.dataset.opacity, 10);
                this._setLayerOpacity(layerIndex, value / 100);
                this._syncLayerAttributePopup(popup, layerIndex);
            });
        });

        const slider = popup.querySelector('.layer-attribute-opacity-slider');
        slider?.addEventListener('input', (e) => {
            e.stopPropagation();
            const value = parseInt(e.target.value, 10);
            this._setLayerOpacity(layerIndex, value / 100);
            this._syncLayerAttributePopup(popup, layerIndex);
        });

        popup.querySelector('.layer-attribute-opacity-label')?.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this._editLayerAttributeOpacityValue(popup, layerIndex);
        });

        const blendSelect = popup.querySelector('.layer-attribute-blend-select');
        blendSelect?.addEventListener('change', (e) => {
            e.stopPropagation();
            if (this.layerSystem?.setLayerBlendMode) {
                this.layerSystem.setLayerBlendMode(layerIndex, e.target.value);
            }
            this._syncLayerAttributePopup(popup, layerIndex);
        });

        popup.querySelector('[data-action="toggle-clipping"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.layerSystem?.toggleLayerClipping) {
                this.layerSystem.toggleLayerClipping(layerIndex);
            }
            this._syncLayerAttributePopup(popup, layerIndex);
        });
    }

    _syncLayerAttributePopup(popup, layerIndex) {
        const layer = this.layerSystem?.getLayers?.()?.[layerIndex];
        if (!layer?.layerData) {
            this._hideLayerAttributePopup();
            return;
        }

        const opacity = Math.round((layer.alpha ?? layer.layerData.opacity ?? 1) * 100);
        const blendMode = layer.layerData.blendMode || 'normal';
        const clipping = layer.layerData.clipping === true;

        const slider = popup.querySelector('.layer-attribute-opacity-slider');
        if (slider) slider.value = String(opacity);
        const label = popup.querySelector('.layer-attribute-opacity-label');
        if (label) label.textContent = `${opacity}%`;

        popup.querySelectorAll('[data-opacity]').forEach(button => {
            button.classList.toggle('active', parseInt(button.dataset.opacity, 10) === opacity);
        });
        const select = popup.querySelector('.layer-attribute-blend-select');
        if (select) select.value = blendMode;
        popup.querySelector('[data-action="toggle-clipping"]')?.classList.toggle('active', clipping);
    }

    _positionLayerAttributePopup(popup, anchorElement) {
        const anchorRect = anchorElement.getBoundingClientRect();
        const popupRect = popup.getBoundingClientRect();
        const margin = 8;
        const layerListRect = this.container?.getBoundingClientRect?.();
        const activeItemRect = this.container
            ?.querySelector(`.layer-item[data-layer-index="${this._attributePopupLayerIndex}"]`)
            ?.getBoundingClientRect?.();
        const preferredLeft = layerListRect
            ? layerListRect.left - popupRect.width - margin
            : anchorRect.left - popupRect.width - margin;
        const fallbackLeft = layerListRect
            ? layerListRect.right + margin
            : anchorRect.right + margin;
        const left = preferredLeft >= margin
            ? preferredLeft
            : Math.min(window.innerWidth - popupRect.width - margin, fallbackLeft);
        const anchorTop = activeItemRect?.top ?? anchorRect.top;
        const top = Math.max(
            margin,
            Math.min(window.innerHeight - popupRect.height - margin, anchorTop - 8)
        );

        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;
    }

    _getBlendModeLabel(blendMode) {
        const labels = {
            normal: '',
            multiply: '乗算',
            add: '加算',
            overlay: 'OL'
        };
        return labels[blendMode] || '';
    }

    _handleAttributePopupOutsidePointerDown(e) {
        if (!this._layerAttributePopup?.classList.contains('show')) return;
        if (this._layerAttributePopup.contains(e.target)) return;
        if (this.container?.contains(e.target)) return;
        this._hideLayerAttributePopup();
    }

    _handleAttributePopupKeydown(e) {
        if (e.key === 'Escape') {
            this._hideLayerAttributePopup();
        }
    }

    _hideLayerAttributePopup() {
        if (!this._layerAttributePopup) return;
        this._layerAttributePopup.classList.remove('show');
        this._layerAttributePopup.style.display = 'none';
        this._attributePopupLayerIndex = -1;
        this._attributePopupAnchorElement = null;
        this._handleAttributePopupDragEnd();
        document.removeEventListener('pointerdown', this._handleAttributePopupOutsidePointerDown, true);
        document.removeEventListener('keydown', this._handleAttributePopupKeydown, true);
    }

    _retargetLayerAttributePopup(layerIndex) {
        const layer = this.layerSystem?.getLayers?.()?.[layerIndex];
        if (!layer || layer.layerData?.isBackground) return;

        const popup = this._layerAttributePopup;
        if (!popup) return;

        this._attributePopupLayerIndex = layerIndex;
        popup.dataset.layerIndex = String(layerIndex);
        this._renderLayerAttributePopupContent(popup, layerIndex);
    }

    _startLayerAttributePopupDrag(e, popup) {
        if (!popup?.classList.contains('show')) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = popup.getBoundingClientRect();
        this._attributePopupDrag = {
            pointerId: e.pointerId,
            offsetX: e.clientX - rect.left,
            offsetY: e.clientY - rect.top,
            captureTarget: popup
        };
        try {
            popup.setPointerCapture?.(e.pointerId);
        } catch (err) {}
        document.addEventListener('pointermove', this._handleAttributePopupDragMove, { passive: false, capture: true });
        document.addEventListener('pointerup', this._handleAttributePopupDragEnd, { capture: true });
        document.addEventListener('pointercancel', this._handleAttributePopupDragEnd, { capture: true });
    }

    _handleAttributePopupDragMove(e) {
        if (!this._attributePopupDrag || !this._layerAttributePopup) return;
        if (e.pointerId !== this._attributePopupDrag.pointerId) return;
        e.preventDefault();
        e.stopPropagation();
        const popup = this._layerAttributePopup;
        const rect = popup.getBoundingClientRect();
        const margin = 4;
        const left = Math.max(margin, Math.min(window.innerWidth - rect.width - margin, e.clientX - this._attributePopupDrag.offsetX));
        const top = Math.max(margin, Math.min(window.innerHeight - rect.height - margin, e.clientY - this._attributePopupDrag.offsetY));
        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;
    }

    _handleAttributePopupDragEnd(e = null) {
        if (!this._attributePopupDrag) return;
        if (e && e.pointerId !== this._attributePopupDrag.pointerId) return;
        const { pointerId, captureTarget } = this._attributePopupDrag;
        try {
            captureTarget?.releasePointerCapture?.(pointerId);
        } catch (err) {}
        document.removeEventListener('pointermove', this._handleAttributePopupDragMove, true);
        document.removeEventListener('pointerup', this._handleAttributePopupDragEnd, true);
        document.removeEventListener('pointercancel', this._handleAttributePopupDragEnd, true);
        this._attributePopupDrag = null;
    }

    _editLayerAttributeOpacityValue(popup, layerIndex) {
        const label = popup.querySelector('.layer-attribute-opacity-label');
        if (!label || label.querySelector('input')) return;

        const layer = this.layerSystem?.getLayers?.()?.[layerIndex];
        const opacity = Math.round((layer?.alpha ?? layer?.layerData?.opacity ?? 1) * 100);
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.max = '100';
        input.step = '1';
        input.value = String(opacity);
        input.className = 'layer-attribute-opacity-input';
        label.textContent = '';
        label.appendChild(input);

        const finish = (commit) => {
            const raw = parseInt(input.value, 10);
            const value = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : opacity;
            if (commit) {
                this._setLayerOpacity(layerIndex, value / 100);
            }
            this._syncLayerAttributePopup(popup, layerIndex);
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                finish(true);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                finish(false);
            }
        });
        input.addEventListener('blur', () => finish(true));

        requestAnimationFrame(() => {
            input.focus();
            input.select();
        });
    }

    _editLayerAttributeNameValue(popup, layerIndex) {
        const title = popup.querySelector('.layer-attribute-title');
        if (!title || title.querySelector('input')) return;

        const layer = this.layerSystem?.getLayers?.()?.[layerIndex];
        if (!layer?.layerData || layer.layerData.isBackground) return;

        const originalName = layer.layerData.name || 'レイヤー';
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalName;
        input.className = 'layer-attribute-name-input';
        title.textContent = '';
        title.appendChild(input);

        const finish = (commit) => {
            const nextName = input.value.trim();
            if (commit && nextName && nextName !== originalName) {
                layer.layerData.name = nextName;
                this.eventBus?.emit('layer:name-changed', {
                    layerIndex,
                    layerId: layer.layerData.id,
                    oldName: originalName,
                    newName: nextName
                });
            }
            this._renderLayerAttributePopupContent(popup, layerIndex);
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                finish(true);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                finish(false);
            }
        });
        input.addEventListener('blur', () => finish(true));

        requestAnimationFrame(() => {
            input.focus();
            input.select();
        });
    }

    _escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    _handleLayerItemClick(e, index) {
        if (e.shiftKey && this.layerSystem?.selectLayerRange) {
            this.layerSystem.selectLayerRange(index);
        } else if ((e.ctrlKey || e.metaKey) && this.layerSystem?.toggleLayerSelection) {
            this.layerSystem.toggleLayerSelection(index);
        } else if (this.layerSystem?.setActiveLayer) {
            this.layerSystem.setActiveLayer(index);
        }
    }

    _createLayerName(layer, index) {
        const nameSpan = document.createElement('span');
        nameSpan.className = 'layer-name';
        nameSpan.textContent = layer.layerData?.name || `レイヤー${index}`;
        nameSpan.style.cssText = `grid-column:1;grid-row:3;color:#800000;font-size:10px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left;cursor:text;padding:0;height:14px;display:flex;align-items:center;`;

        nameSpan.addEventListener('click', (e) => {
            if (e.shiftKey || e.ctrlKey || e.metaKey) return;
        });
        nameSpan.title = 'F2で名前変更';

        return nameSpan;
    }

    _createDeleteButton(index) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'ui-close-button ui-close-button--small layer-delete-button';
        deleteBtn.type = 'button';
        deleteBtn.innerHTML = UI_ICONS.close;
        deleteBtn.title = 'レイヤーを削除';
        deleteBtn.setAttribute('aria-label', 'レイヤーを削除');

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.layerSystem?.deleteLayer) {
                this.layerSystem.deleteLayer(index);
            }
        });

        return deleteBtn;
    }

    _createDuplicateButton(index) {
        const btn = document.createElement('div');
        btn.className = 'layer-duplicate-button ui-icon-button ui-icon-button--small';
        btn.style.cssText = 'width:16px;height:16px;';
        btn.innerHTML = UI_ICONS.duplicate;
        btn.title = 'レイヤーを複製';

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.layerSystem?.duplicateLayer) {
                this.layerSystem.duplicateLayer(index);
            }
        });

        return btn;
    }

    _createMergeDownButton(index) {
        const btn = document.createElement('div');
        btn.className = 'layer-merge-down-button ui-icon-button ui-icon-button--small';
        btn.style.cssText = 'width:16px;height:16px;';

        const layers = this.layerSystem?.getLayers?.() || [];
        const bottomLayer = layers[index - 1];
        const canMergeDown = index > 1 && !bottomLayer?.layerData?.isBackground && !bottomLayer?.layerData?.isFolder;

        if (!canMergeDown) {
            btn.style.visibility = 'hidden';
            btn.style.pointerEvents = 'none';
        }

        btn.innerHTML = UI_ICONS.mergeDown;
        btn.title = '下のレイヤーと結合';

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.layerSystem?.mergeLayerDown) {
                this.layerSystem.mergeLayerDown(index);
            }
        });

        return btn;
    }

    createThumbnail(layer, index) {
        const maxWidth = 40;
        const maxHeight = 32;

        const thumbnailContainer = document.createElement('div');
        thumbnailContainer.className = 'layer-thumbnail';
        thumbnailContainer.dataset.layerIndex = index;

        thumbnailContainer.style.width = maxWidth + 'px';
        thumbnailContainer.style.height = maxHeight + 'px';
        thumbnailContainer.style.boxSizing = 'border-box';
        thumbnailContainer.style.border = 'none'; // [指示書] 枠線を削除
        thumbnailContainer.style.borderRadius = '2px';
        thumbnailContainer.style.overflow = 'hidden';
        thumbnailContainer.style.position = 'relative';
        thumbnailContainer.style.display = 'flex';
        thumbnailContainer.style.alignItems = 'center';
        thumbnailContainer.style.justifyContent = 'center';
        thumbnailContainer.style.flexShrink = '0';
        thumbnailContainer.style.backgroundColor = 'transparent'; // [指示書] 背景を透明に

        // [指示書] キャッシュがあれば即時表示
        if (window.thumbnailSystem && layer.layerData?.id) {
            const cachedUrl = window.thumbnailSystem.getThumbnail(layer.layerData.id);
            if (cachedUrl) {
                const img = document.createElement('img');
                img.src = cachedUrl;
                img.style.maxWidth = '100%';
                img.style.maxHeight = '100%';
                img.style.display = 'block';
                img.style.objectFit = 'contain'; // [指示書] アスペクト比維持
                thumbnailContainer.appendChild(img);
                return thumbnailContainer;
            }
        }

        // キャッシュがない場合は非同期で生成
        return thumbnailContainer;
    }

    _editLayerName(nameSpan, layer, index) {
        if (layer.layerData?.isBackground || this._editingLayerIndex >= 0) {
            return;
        }

        this._editingLayerIndex = index;

        const originalName = nameSpan.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalName;
        const gridColumn = nameSpan.style.gridColumn || 'auto';
        const gridRow = nameSpan.style.gridRow || 'auto';
        input.style.cssText = `grid-column:${gridColumn};grid-row:${gridRow};color:#800000;font-size:10px;font-weight:bold;background:#fff;border:1px solid #800000;border-radius:2px;padding:1px 3px;width:100%;box-sizing:border-box;height:16px;`;

        nameSpan.replaceWith(input);
        this._editingInput = input;

        requestAnimationFrame(() => {
            input.focus();
            input.select();
        });

        const finishEdit = () => {
            if (this._editingLayerIndex !== index || !this._editingInput) return;

            this._editingLayerIndex = -1;
            const currentInput = this._editingInput;
            this._editingInput = null;

            const newName = currentInput.value.trim();
            if (newName && newName !== originalName) {
                if (layer.layerData) {
                    layer.layerData.name = newName;
                }
                if (this.eventBus) {
                    this.eventBus.emit('layer:name-changed', {
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

    async _updateSingleThumbnail(layerIndex) {
        const layers = this.layerSystem?.getLayers() || [];
        if (layerIndex < 0 || layerIndex >= layers.length) return;

        const reversedIndex = layers.length - 1 - layerIndex;
        const layerItems = this.container.querySelectorAll('.layer-item');
        if (reversedIndex < 0 || reversedIndex >= layerItems.length) return;

        const thumbnailContainer = layerItems[reversedIndex].querySelector('.layer-thumbnail');
        if (!thumbnailContainer) return;

        const layer = layers[layerIndex];
        if (layer.layerData?.isFolder) return;
        const maxWidth = 64;
        const maxHeight = 44;

        // [指示書] 更新時も背景スタイルを維持するための処理
        const applyBackgroundStyle = () => {
            thumbnailContainer.style.backgroundColor = 'transparent';
            thumbnailContainer.style.backgroundImage = 'none';
            thumbnailContainer.style.border = 'none';
        };

        // [指示書] ここで generateLayerThumbnail() を直接呼ぶのをやめる。
        // ThumbnailSystem がイベントを受け取って生成し、
        // thumbnail:updated イベント経由で反映されるのを待つ。
        if (this.eventBus) {
            this.eventBus.emit('thumbnail:layer-updated', {
                layerIndex: layerIndex,
                layerId: layer.layerData?.id,
                immediate: true
            });
        }

        applyBackgroundStyle();
    }

    async updateAllThumbnails() {
        const layers = this.layerSystem?.getLayers() || [];
        for (let i = 0; i < layers.length; i++) {
            await this._updateSingleThumbnail(i);
        }
    }

    _adjustLayerOpacity(layerIndex, delta) {
        const layer = this.layerSystem.getLayers()[layerIndex];
        const currentOpacity = layer.alpha !== undefined ? layer.alpha : 1.0;
        const newOpacity = Math.max(0, Math.min(1, currentOpacity + delta));
        this._setLayerOpacity(layerIndex, newOpacity);
    }

    _setLayerOpacity(layerIndex, opacity) {
        if (this.layerSystem.setLayerOpacity) {
            this.layerSystem.setLayerOpacity(layerIndex, opacity);
        }

        const layers = this.layerSystem.getLayers();
        const reversedIndex = layers.length - 1 - layerIndex;
        const layerDiv = this.container.querySelectorAll('.layer-item')[reversedIndex];
        const opacityValue = layerDiv?.querySelector('.layer-opacity-value');
        if (opacityValue) {
            opacityValue.textContent = `${Math.round(opacity * 100)}%`;
        }
    }

    _updatePanelActiveState(isActive) {
        this.container.classList.toggle('panel-inactive', !isActive);
    }

    _applyActiveLayerState(activeIndex) {
        this.container?.querySelectorAll('.layer-item').forEach(item => {
            const isActive = parseInt(item.dataset.layerIndex, 10) === activeIndex;
            item.classList.toggle('active', isActive);
            const isSelected = item.classList.contains('selected');
            item.style.borderColor = isActive ? '#ff6600' : (isSelected ? 'rgba(255, 140, 66, 0.6)' : '#e9c2ba');
            item.style.borderWidth = isActive ? '2px' : '1px';
        });
    }

    _handleLayerPanelKeydown(e) {
        if (e.key !== 'F2') return;
        const target = e.target;
        if (target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
        if (this._editingLayerIndex >= 0) return;

        const activeIndex = this.layerSystem?.getActiveLayerIndex?.();
        if (typeof activeIndex !== 'number' || activeIndex < 0) return;

        const item = this.container?.querySelector(`.layer-item[data-layer-index="${activeIndex}"]`);
        const nameSpan = item?.querySelector('.layer-name');
        const layer = this.layerSystem?.getLayers?.()?.[activeIndex];
        if (!nameSpan || !layer || layer.layerData?.isBackground) return;

        e.preventDefault();
        e.stopPropagation();
        this._editLayerName(nameSpan, layer, activeIndex);
    }

    initializeSortable() {
        if (this.sortable) return;
        if (!window.Sortable && !Sortable) return;
        const sortableLib = Sortable || window.Sortable;

        try {
            this.sortable = sortableLib.create(this.container, {
                animation: 200,
                easing: 'cubic-bezier(0.25, 0.8, 0.25, 1)',
                ghostClass: 'sortable-ghost',
                dragClass: 'sortable-drag',
                chosenClass: 'sortable-chosen',
                draggable: '.layer-item',
                forceFallback: true,
                fallbackOnBody: true,
                fallbackTolerance: 3,
                swapThreshold: 0.65,
                delay: 0,
                delayOnTouchOnly: false,

                filter: (evt) => {
                    const item = evt.target.closest('.layer-item');
                    if (!item) return false;
                    const layerIndex = parseInt(item.dataset.layerIndex);
                    const layers = this.layerSystem?.getLayers() || [];
                    const layer = layers[layerIndex];
                    return layer?.layerData?.isBackground || false;
                },

                onChoose: (evt) => {
                    const item = evt.item;
                    item.style.cursor = 'grabbing';
                    this._isSortableDragging = true;
                    this._pendingUpdateAfterDrag = false;
                    this._dragFolderTargetId = null;
                    this.container.classList.add('layer-panel-items--folder-dragging');
                },

                onUnchoose: () => {
                    this._finishFolderDrag();
                },

                onMove: (evt) => {
                    this._clearFolderDropTarget();

                    const draggedIndex = parseInt(evt.dragged?.dataset?.layerIndex, 10);
                    if (Number.isNaN(draggedIndex)) {
                        this._dragFolderTargetId = null;
                        return true;
                    }

                    const layers = this.layerSystem?.getLayers?.() || [];
                    const draggedLayer = layers[draggedIndex];
                    const target = this._findFolderDropTarget(evt, draggedLayer);
                    if (!target) {
                        this._dragFolderTargetId = null;
                        return true;
                    }

                    this._dragFolderTargetId = target.folder.layerData.id;
                    target.element.classList.add('folder-drop-target');

                    // フォルダ投入候補中は Sortable の上下入れ替えを止め、候補が逃げないようにする。
                    return false;
                },

                onEnd: (evt) => {
                    evt.item.style.opacity = '';
                    evt.item.style.cursor = '';

                    try {
                        if (!this.layerSystem?.reorderLayers) return;

                        const layers = this.layerSystem.getLayers();
                        const oldIndex = parseInt(evt.item.dataset.layerIndex, 10);
                        if (Number.isNaN(oldIndex)) return;

                        const draggedLayer = layers[oldIndex];
                        const finalTarget = this._findFolderDropTarget(evt, draggedLayer);
                        const targetFolderId = this._dragFolderTargetId || finalTarget?.folder?.layerData?.id;

                        if (targetFolderId && this.layerSystem.moveLayerIntoFolder) {
                            this.layerSystem.moveLayerIntoFolder(draggedLayer?.layerData?.id, targetFolderId);
                        } else {
                            const newIndex = this._resolveLayerIndexFromSortedDom(evt, oldIndex);
                            if (newIndex !== null && newIndex !== oldIndex) {
                                this.layerSystem.reorderLayers(oldIndex, newIndex);
                            } else {
                                this.requestUpdate();
                            }
                        }
                    } finally {
                        this._finishFolderDrag();
                        this._dragFolderTargetId = null;
                        this._isSortableDragging = false;
                        if (this._pendingUpdateAfterDrag) {
                            this._pendingUpdateAfterDrag = false;
                            this.requestUpdate();
                        }
                    }
                }
            });
        } catch (error) {}
    }

    _resolveLayerIndexFromSortedDom(evt, oldIndex) {
        const nextItem = evt.item?.nextElementSibling?.closest?.('.layer-item') || null;
        if (!nextItem || !this.container?.contains(nextItem)) {
            return 0;
        }

        const nextIndex = parseInt(nextItem.dataset.layerIndex, 10);
        if (Number.isNaN(nextIndex)) return null;

        // DOMは上から下、Pixiレイヤー配列は下から上。ドラッグ項目は
        // 「DOM上で直下にある表示レイヤー」の1つ上へ置く。
        return nextIndex > oldIndex ? nextIndex : nextIndex + 1;
    }

    _findFolderDropTarget(evt, draggedLayer) {
        const originalEvent = evt.originalEvent;
        if (!originalEvent || !draggedLayer) return null;

        const x = originalEvent.clientX;
        const y = originalEvent.clientY;
        const candidates = [];

        if (typeof document.elementsFromPoint === 'function') {
            const elements = document.elementsFromPoint(x, y);
            for (const element of elements) {
                const item = element.closest?.('.layer-item');
                if (!item || item === evt.dragged || !this.container.contains(item)) continue;
                if (item.dataset?.isFolder === 'true') {
                    candidates.push({ element: item, hitElement: item, mode: 'folder' });
                    continue;
                }

                const parentFolderElement = this._findParentFolderElementForItem(item);
                if (parentFolderElement &&
                    parentFolderElement !== evt.dragged &&
                    this._shouldUseParentFolderDrop(draggedLayer, parentFolderElement)) {
                    candidates.push({ element: parentFolderElement, hitElement: item, mode: 'child' });
                }
            }
        }

        const related = evt.related?.closest?.('.layer-item');
        if (related?.dataset?.isFolder === 'true' && related !== evt.dragged) {
            candidates.push({ element: related, hitElement: related, mode: 'folder' });
        } else if (related && related !== evt.dragged) {
            const parentFolderElement = this._findParentFolderElementForItem(related);
            if (parentFolderElement &&
                parentFolderElement !== evt.dragged &&
                this._shouldUseParentFolderDrop(draggedLayer, parentFolderElement)) {
                candidates.push({ element: parentFolderElement, hitElement: related, mode: 'child' });
            }
        }

        const seen = new Set();
        for (const candidate of candidates) {
            const { element, hitElement, mode } = candidate;
            if (seen.has(element)) continue;
            seen.add(element);

            const folderIndex = parseInt(element.dataset.layerIndex, 10);
            const folder = this.layerSystem?.getLayers?.()?.[folderIndex];
            if (!this._canDropIntoFolder(draggedLayer, folder)) continue;
            if (!this._isFolderMouthDrop(x, y, hitElement, mode)) continue;
            return { element, folder };
        }

        return null;
    }

    _findParentFolderElementForItem(item) {
        const layerIndex = parseInt(item?.dataset?.layerIndex, 10);
        if (Number.isNaN(layerIndex)) return null;

        const layer = this.layerSystem?.getLayers?.()?.[layerIndex];
        const parentId = layer?.layerData?.parentId;
        if (!parentId) return null;

        return Array.from(this.container.querySelectorAll('.layer-item[data-is-folder="true"]'))
            .find(folderElement => {
                const folderIndex = parseInt(folderElement.dataset.layerIndex, 10);
                const folder = this.layerSystem?.getLayers?.()?.[folderIndex];
                return folder?.layerData?.id === parentId;
            }) || null;
    }

    _shouldUseParentFolderDrop(draggedLayer, folderElement) {
        const folderIndex = parseInt(folderElement?.dataset?.layerIndex, 10);
        if (Number.isNaN(folderIndex)) return false;

        const folder = this.layerSystem?.getLayers?.()?.[folderIndex];
        if (!folder?.layerData?.isFolder) return false;

        // 同じフォルダ内の並び替えでは、親フォルダの口判定を出さず Sortable に任せる。
        return draggedLayer?.layerData?.parentId !== folder.layerData.id;
    }

    _canDropIntoFolder(layer, folder) {
        if (!layer || !folder?.layerData?.isFolder) return false;
        if (layer.layerData?.isBackground) return false;
        if (layer.layerData?.id === folder.layerData.id) return false;

        let parentId = folder.layerData.parentId;
        const layers = this.layerSystem?.getLayers?.() || [];
        while (parentId) {
            if (parentId === layer.layerData?.id) return false;
            const parent = layers.find(l => l.layerData?.id === parentId);
            parentId = parent?.layerData?.parentId || null;
        }

        return true;
    }

    _isFolderBodyDrop(evt, related) {
        if (evt.willInsertAfter || !evt.originalEvent || !related?.getBoundingClientRect) {
            return false;
        }

        const rect = related.getBoundingClientRect();
        const x = evt.originalEvent.clientX;
        const y = evt.originalEvent.clientY;
        const insideX = x >= rect.left + 8 && x <= rect.right - 8;
        const insideY = y >= rect.top + rect.height * 0.25 && y <= rect.bottom - rect.height * 0.25;
        return insideX && insideY;
    }

    _isFolderMouthDrop(x, y, folderElement, mode = 'folder') {
        if (!folderElement?.getBoundingClientRect) return false;

        const rect = folderElement.getBoundingClientRect();
        const topRatio = (y - rect.top) / Math.max(1, rect.height);
        if (mode === 'folder' && (topRatio < 0.22 || topRatio > 0.78)) {
            return false;
        }

        const expandedTop = mode === 'child' ? rect.top - 4 : rect.top;
        const expandedBottom = mode === 'child' ? rect.bottom + 4 : rect.bottom;
        const expandedLeft = rect.left - 8;
        const expandedRight = rect.right + 8;

        return x >= expandedLeft && x <= expandedRight && y >= expandedTop && y <= expandedBottom;
    }

    _clearFolderDropTarget() {
        this.container?.querySelectorAll('.folder-drop-target').forEach(el => {
            el.classList.remove('folder-drop-target');
        });
    }

    _finishFolderDrag() {
        this._clearFolderDropTarget();
        this.container?.classList.remove('layer-panel-items--folder-dragging');
    }

    _updateScrollState() {
        requestAnimationFrame(() => {
            if (!this.container) return;
            const isScrollable = this.container.scrollHeight > this.container.clientHeight + 1;
            this.container.classList.toggle('layer-panel-items--scrollable', isScrollable);
        });
    }

    /**
     * 現在フレームの使用アセットを表示する読み取り専用ヘッダーを作成 (Phase 4z15/4z16)
     */
    createCafReadonlyHeader() {
        const animationTable = window.PopupManager?.get?.('animationTable');
        if (!animationTable || !animationTable.model) return null;

        const tree = animationTable.model.getFrameAssetTree();
        if (!tree || tree.groups.length === 0) return null;

        const header = document.createElement('div');
        header.className = 'caf-readonly-header';

        let html = '<div class="caf-readonly-title">FRAME ASSETS</div>';

        const selectedCelId = animationTable.selectedCelId;

        tree.groups.forEach(group => {
            html += `
                <div class="caf-readonly-group">
                    <span class="caf-readonly-badge">CAF</span>
                    <span class="caf-readonly-name">${this._escapeHtml(group.folderName)}</span>
                    <span class="caf-readonly-count">${group.clips.length}</span>
                </div>
                <div class="caf-readonly-asset-row">
            `;

            // 表示アセットをボタン化
            group.clips.forEach((clipEntry, index) => {
                const isSelected = selectedCelId === clipEntry.clipId;
                const selectedClass = isSelected ? ' is-selected' : '';
                const clipId = this._escapeHtml(clipEntry.clipId);
                const assetId = this._escapeHtml(clipEntry.assetId);

                // 3件まで実表示、それ以降は数だけ出す
                if (index < 3) {
                    html += `
                        <button class="caf-readonly-asset${selectedClass}"
                                data-clip-id="${clipId}"
                                data-asset-id="${assetId}"
                                title="Click to select clip in Timeline">
                            ${this._escapeHtml(clipEntry.assetName)}
                        </button>
                    `;
                } else if (index === 3) {
                    const moreCount = group.clips.length - 3;
                    html += `<span class="caf-readonly-more">+${moreCount} more</span>`;
                }
            });

            html += `</div>`;
        });

        header.innerHTML = html;
        return header;
    }

    destroy() {
        if (this.sortable) {
            this.sortable.destroy();
            this.sortable = null;
        }
        if (this._updateTimeout) {
            clearTimeout(this._updateTimeout);
        }
        document.removeEventListener('keydown', this._handleLayerPanelKeydown, true);
        this._hideLayerAttributePopup();
        this._layerAttributePopup?.remove();
        this._layerAttributePopup = null;
        this._editingLayerIndex = -1;
        this._editingInput = null;
    }
}

// 下位互換性のためにグローバルに登録
window.LayerPanelRenderer = LayerPanelRenderer;
