/**
 * ============================================================================
 * ファイル名: ui/layer-panel-renderer.js
 * 責務: レイヤーパネルのUI（レイヤー一覧、可視性、透明度、並び替え）を描画する
 * 依存: layer-system.js, thumbnail-system.js, event-bus.js, config.js, Sortable
 * 被依存: ui-panels.js, core-engine.js
 * 公開API: LayerPanelRenderer
 * イベント発火: ui:layer-selected, ui:background-color-change-requested
 * イベント受信: layer:*, folder:*, thumbnail:updated, animation:frame-changed, camera:resized
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

        this._setupEventListeners();

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

        this.eventBus.on('layer:panel-update-requested', () => this.requestUpdate());
        this.eventBus.on('layer:created', () => this.requestUpdate());
        this.eventBus.on('folder:created', () => this.requestUpdate());
        this.eventBus.on('folder:toggled', () => this.requestUpdate());
        this.eventBus.on('layer:added-to-folder', () => this.requestUpdate());
        this.eventBus.on('layer:removed-from-folder', () => this.requestUpdate());
        this.eventBus.on('layer:deleted', () => this.requestUpdate());
        this.eventBus.on('layer:activated', ({ layerIndex }) => {
            this._applyActiveLayerState(layerIndex);
            this.requestUpdate();
        });
        this.eventBus.on('layer:visibility-changed', () => this.requestUpdate());
        this.eventBus.on('layer:opacity-changed', () => this.requestUpdate());
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
    }

    requestUpdate() {
        if (this._updateTimeout) return;
        this._updateTimeout = setTimeout(() => {
            this._updateTimeout = null;
            const layers = this.layerSystem?.getLayers() || [];
            const activeIndex = this.layerSystem?.getActiveLayerIndex() || 0;
            const animationSystem = window.animationSystem || null;
            this.render(layers, activeIndex, animationSystem);
        }, 16);
    }

    render(layers, activeIndex, animationSystem = null) {
        if (!this.container) return;
        if (!layers || layers.length === 0) return;

        this._dragFolderTargetId = null;
        this.container.innerHTML = '';
        this.container.classList.remove('layer-panel-items--folder-dragging');

        this.container.style.overflowY = 'auto';
        this.container.style.overflowX = 'hidden';

        const reversedLayers = [...layers].reverse();
        const reversedActiveIndex = layers.length - 1 - activeIndex;

        reversedLayers.forEach((layer, reversedIndex) => {
            const originalIndex = layers.length - 1 - reversedIndex;
            const isActive = originalIndex === activeIndex;

            if (this._isLayerHiddenByClosedFolder(layer, layers)) return;

            const layerElement = layer.layerData?.isFolder
                ? this.createFolderElement(layer, originalIndex, isActive, layers)
                : this.createLayerElement(layer, originalIndex, isActive, animationSystem);

            this.container.appendChild(layerElement);
        });

        this.initializeSortable();
        this._updateScrollState();
    }

    createFolderElement(folder, index, isActive, allLayers) {
        const folderDiv = document.createElement('div');
        folderDiv.className = 'layer-item folder-item';
        if (isActive) {
            folderDiv.classList.add('active');
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
        }

        const thumbnail = this.createFolderThumbnail(folder, index, allLayers);
        thumbnail.style.cssText = 'grid-column:1;grid-row:1;display:flex;align-items:center;justify-content:center;';
        folderDiv.appendChild(thumbnail);

        const nameSpan = this._createLayerName(folder, index);
        nameSpan.style.cssText = 'grid-column:2;grid-row:1;color:#800000;font-size:11px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left;cursor:text;padding:0;height:20px;display:flex;align-items:center;';
        folderDiv.appendChild(nameSpan);

        const clipStatus = this._createClipStatusIcon(folder);
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
                e.target.closest('.folder-toggle-icon') ||
                this._editingLayerIndex >= 0) {
                return;
            }

            if (window.stateManager) {
                window.stateManager.setLastActivePanel('layer');
            }

            if (this.layerSystem?.setActiveLayer) {
                this.layerSystem.setActiveLayer(index);
            }
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

    createLayerElement(layer, index, isActive, animationSystem) {
        const layerDiv = document.createElement('div');
        layerDiv.className = 'layer-item';
        if (isActive) {
            layerDiv.classList.add('active');
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

        const clipStatus = this._createClipStatusIcon(layer);
        clipStatus.style.gridColumn = '3';
        clipStatus.style.gridRow = '1';
        layerDiv.appendChild(clipStatus);

        const visibilityIcon = this._createVisibilityIcon(layer, index);
        visibilityIcon.style.gridColumn = '4';
        visibilityIcon.style.gridRow = '1';
        layerDiv.appendChild(visibilityIcon);

        layerDiv.addEventListener('click', (e) => {
            if (e.target.closest('.layer-delete-button') ||
                e.target.closest('.layer-opacity-control button') ||
                e.target.closest('.layer-visibility') ||
                this._editingLayerIndex >= 0) {
                return;
            }

            if (window.stateManager) {
                window.stateManager.setLastActivePanel('layer');
            }

            if (this.layerSystem?.setActiveLayer) {
                this.layerSystem.setActiveLayer(index);
            }
        });

        return layerDiv;
    }

    _createClipStatusIcon(layer) {
        const clipIcon = document.createElement('div');
        clipIcon.className = 'layer-clip-status';
        clipIcon.style.cssText = 'width:16px;height:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#800000;opacity:0.35;';
        clipIcon.title = layer.layerData?.clipping ? 'クリッピングON' : 'クリッピング未使用';

        if (layer.layerData?.clipping) {
            clipIcon.innerHTML = '<span style="font-size:13px;line-height:1;font-weight:bold;">C</span>';
            clipIcon.style.opacity = '1';
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
        opacityContainer.style.cssText = 'display:flex;align-items:center;gap:2px;font-size:10px;user-select:none;height:14px;';

        const decreaseBtn = document.createElement('button');
        decreaseBtn.textContent = '◀';
        decreaseBtn.style.cssText = 'padding:0;font-size:9px;line-height:1;height:12px;width:12px;cursor:pointer;border:none;background:transparent;color:#800000;flex-shrink:0;';
        decreaseBtn.title = '透明度 -10%';
        decreaseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._adjustLayerOpacity(index, -0.1);
        });

        const opacityValue = document.createElement('span');
        opacityValue.className = 'layer-opacity-value';
        const currentOpacity = layer.alpha !== undefined ? layer.alpha : 1.0;
        opacityValue.textContent = `${Math.round(currentOpacity * 100)}%`;
        opacityValue.style.cssText = 'min-width:30px;text-align:left;color:#800000;font-size:10px;font-weight:bold;flex-shrink:0;cursor:ew-resize;';
        opacityValue.title = '左右ドラッグで数値を変更';

        // [指示書] 不透明度数値のドラッグ操作
        let isDragging = false;
        let startX = 0;
        let startOpacity = 0;

        opacityValue.addEventListener('pointerdown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startOpacity = layer.alpha !== undefined ? layer.alpha : 1.0;
            opacityValue.setPointerCapture(e.pointerId);
            e.stopPropagation();
        });

        opacityValue.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            // 1px あたり 1% 変化させる
            const delta = dx / 100;
            const newOpacity = Math.max(0, Math.min(1, startOpacity + delta));
            this._setLayerOpacity(index, newOpacity);
            e.stopPropagation();
        });

        opacityValue.addEventListener('pointerup', (e) => {
            isDragging = false;
            opacityValue.releasePointerCapture(e.pointerId);
            e.stopPropagation();
        });

        const increaseBtn = document.createElement('button');
        increaseBtn.textContent = '▶';
        increaseBtn.style.cssText = 'padding:0;font-size:9px;line-height:1;height:12px;width:12px;cursor:pointer;border:none;background:transparent;color:#800000;flex-shrink:0;';
        increaseBtn.title = '透明度 +10%';
        increaseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._adjustLayerOpacity(index, 0.1);
        });

        opacityContainer.appendChild(decreaseBtn);
        opacityContainer.appendChild(opacityValue);
        opacityContainer.appendChild(increaseBtn);

        return opacityContainer;
    }

    _createLayerName(layer, index) {
        const nameSpan = document.createElement('span');
        nameSpan.className = 'layer-name';
        nameSpan.textContent = layer.layerData?.name || `レイヤー${index}`;
        nameSpan.style.cssText = `grid-column:1;grid-row:3;color:#800000;font-size:10px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left;cursor:text;padding:0;height:14px;display:flex;align-items:center;`;

        nameSpan.addEventListener('click', (e) => {
            if (e.shiftKey) {
                e.stopPropagation();
                e.preventDefault();
                if (this.layerSystem?.setActiveLayer) {
                    this.layerSystem.setActiveLayer(index);
                }
                if (this._editingLayerIndex === -1) {
                    setTimeout(() => this._editLayerName(nameSpan, layer, index), 20);
                }
            }
        });
        nameSpan.title = 'Shift+クリックで名前変更';

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
            item.style.borderColor = isActive ? '#ff6600' : '#e9c2ba';
            item.style.borderWidth = isActive ? '2px' : '1px';
        });
    }

    initializeSortable() {
        if (!window.Sortable && !Sortable) return;
        const sortableLib = Sortable || window.Sortable;

        try {
            if (this.sortable) {
                this.sortable.destroy();
            }

            this.sortable = sortableLib.create(this.container, {
                animation: 200,
                easing: 'cubic-bezier(0.25, 0.8, 0.25, 1)',
                ghostClass: 'sortable-ghost',
                dragClass: 'sortable-drag',
                chosenClass: 'sortable-chosen',
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

                    if (this.layerSystem?.reorderLayers) {
                        const layers = this.layerSystem.getLayers();
                        const oldIndex = parseInt(evt.item.dataset.layerIndex, 10);
                        const newIndex = layers.length - 1 - evt.newIndex;
                        const draggedLayer = layers[oldIndex];
                        const finalTarget = this._findFolderDropTarget(evt, draggedLayer);
                        const targetFolderId = this._dragFolderTargetId || finalTarget?.folder?.layerData?.id;
                        this._finishFolderDrag();
                        this._dragFolderTargetId = null;

                        if (targetFolderId && this.layerSystem.moveLayerIntoFolder) {
                            this.layerSystem.moveLayerIntoFolder(draggedLayer?.layerData?.id, targetFolderId);
                        } else {
                            this.layerSystem.reorderLayers(oldIndex, newIndex);
                        }
                    }
                }
            });
        } catch (error) {}
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

    destroy() {
        if (this.sortable) {
            this.sortable.destroy();
            this.sortable = null;
        }
        if (this._updateTimeout) {
            clearTimeout(this._updateTimeout);
        }
        this._editingLayerIndex = -1;
        this._editingInput = null;
    }
}

// 下位互換性のためにグローバルに登録
window.LayerPanelRenderer = LayerPanelRenderer;
