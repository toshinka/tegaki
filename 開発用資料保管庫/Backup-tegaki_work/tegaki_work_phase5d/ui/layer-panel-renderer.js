/**
 * ============================================================================
 * ファイル名: ui/layer-panel-renderer.js
 * 責務: レイヤーパネルのUI（レイヤー一覧、選択、可視性、透明度、合成モード、クリッピング状態、並び替え）を描画する
 * 依存: layer-system.js, thumbnail-system.js, event-bus.js, config.js
 * 被依存: ui-panels.js, core-engine.js
 * 公開API: LayerPanelRenderer
 * イベント発火: ui:layer-selected, ui:background-color-change-requested
 * イベント受信: layer:*, folder:*, thumbnail:updated, animation:frame-changed, camera:resized, ui:layer-attribute-panel-requested
 * グローバル登録: window.LayerPanelRenderer
 * 実装状態: ✅完成/整備
 * ============================================================================
 */

import { UI_ICONS } from './ui-icons.js';

export class LayerPanelRenderer {
    constructor(container, layerSystem, eventBus) {
        this.container = container;
        this.layerSystem = layerSystem;
        this.eventBus = eventBus;
        this._isInitialized = false;
        this._editingLayerIndex = -1;
        this._editingInput = null;
        this._updateTimeout = null;
        this._layerAttributePopup = null;
        this._attributePopupLayerIndex = -1;
        this._attributePopupAnchorElement = null;
        this._attributePopupDrag = null;
        this._attributeOpacityEditState = null;
        this._pendingUpdateAfterDrag = false;
        this._expandedCafClipIds = new Set();
        this._collapsedCafClipIds = new Set();
        this._collapsedClipInternalFolderIds = new Set();
        this._clipSnapshotThumbCache = new Map();
        this._cardDrag = null;
        this._cardDragSuppressClick = false;
        this._handleAttributePopupOutsidePointerDown = this._handleAttributePopupOutsidePointerDown.bind(this);
        this._handleAttributePopupKeydown = this._handleAttributePopupKeydown.bind(this);
        this._handleAttributePopupDragMove = this._handleAttributePopupDragMove.bind(this);
        this._handleAttributePopupDragEnd = this._handleAttributePopupDragEnd.bind(this);
        this._handleLayerPanelKeydown = this._handleLayerPanelKeydown.bind(this);
        this._handleLayerPanelCardPointerDown = this._handleLayerPanelCardPointerDown.bind(this);
        this._handleLayerPanelCardPointerMove = this._handleLayerPanelCardPointerMove.bind(this);
        this._handleLayerPanelCardPointerUp = this._handleLayerPanelCardPointerUp.bind(this);

        this._setupEventListeners();
        document.addEventListener('keydown', this._handleLayerPanelKeydown, true);
        this.container.addEventListener('pointerdown', this._handleLayerPanelCardPointerDown);
        this.container.addEventListener('contextmenu', (e) => {
            if (!this._hasAnimationContext()) return;
            const clipMirrorVariant = this._getLayerPanelCardVariantConfig('clip-layer-mirror');
            if (e.target.closest(`.caf-simple-header, ${clipMirrorVariant.rowSelector}`)) {
                e.preventDefault();
            }
        });

        // Layer PanelカードとCAFヘッダーのクリックイベント（共通委譲）
        this.container.addEventListener('click', (e) => {
            if (this._consumeLayerPanelCardSuppressedClick(e)) {
                return;
            }
            if (this._handleLayerPanelCardDelegatedClick(e)) {
                return;
            }
            const clipMirrorVariant = this._getLayerPanelCardVariantConfig('clip-layer-mirror');

            const cafVisBtn = e.target.closest('.caf-simple-visibility-btn');
            if (cafVisBtn) {
                this._toggleCafHeaderVisibilityFromClick(cafVisBtn);
                return;
            }

            const cafName = e.target.closest('.caf-simple-name');
            if (cafName && e.detail >= 2) {
                this._editCafHeaderNameFromClick(e, cafName);
                return;
            }

            const cafLane = e.target.closest('.caf-simple-lane');
            if (cafLane && e.detail >= 2) {
                this._editCafHeaderLaneNameFromClick(e, cafLane);
                return;
            }

            const cafToggleBtn = e.target.closest('.caf-simple-toggle-btn');
            if (cafToggleBtn) {
                this._toggleCafHeaderExpandedFromClick(cafToggleBtn);
                return;
            }

            // 2. CAFフォルダ内のアセット行
            const assetBtn = e.target.closest('.caf-simple-asset, .caf-simple-group-title');
            if (assetBtn) {
                this._selectCafAssetFromClick(assetBtn);
                return;
            }

        });

        requestAnimationFrame(() => {
            this._initializeRender();
        });
    }

    _getClipInternalFolderKey(assetId, layerId) {
        return `${assetId || 'asset'}:${layerId}`;
    }

    _isClipInternalFolderCollapsed(assetId, layerId) {
        return this._collapsedClipInternalFolderIds.has(this._getClipInternalFolderKey(assetId, layerId));
    }

    _toggleClipInternalFolder(assetId, layerId) {
        const key = this._getClipInternalFolderKey(assetId, layerId);
        if (this._collapsedClipInternalFolderIds.has(key)) {
            this._collapsedClipInternalFolderIds.delete(key);
        } else {
            this._collapsedClipInternalFolderIds.add(key);
        }
    }

    _handleLayerPanelCardDelegatedClick(e) {
        const target = this._resolveLayerPanelCardClickTarget(e.target);
        if (!target) return false;

        const { variant, row, action } = target;
        const adapter = this._getLayerPanelCardAdapter(variant.name);
        const payload = this._createLayerPanelCardActionPayload(variant.name, row, e);

        if (action === 'visibility') {
            const changed = adapter.toggleVisible(payload);
            if (changed && variant.name === 'clip-layer-mirror') {
                this._syncOpenLayerAttributePopupToCurrentTarget();
            }
            return true;
        }
        if (action === 'clipping') {
            const changed = adapter.toggleClipping(payload);
            if (changed) {
                this._syncOpenLayerAttributePopupToCurrentTarget();
            }
            return true;
        }
        if (action === 'rename') {
            if (e.detail < 2 || e.shiftKey || e.ctrlKey || e.metaKey) return true;
            this._editLayerPanelCardNameFromDelegatedClick(e, variant.name, row, target.actionElement);
            return true;
        }
        if (action === 'folder') {
            if (variant.name === 'clip-layer-mirror') {
                adapter.select?.({
                    ...payload,
                    row,
                    options: { syncWorkingLayer: false, renderAnimationTable: true }
                });
            } else {
                this._finishFolderDrag();
            }
            adapter.toggleFolder(payload);
            return true;
        }
        if (action === 'select') {
            if (this._editingLayerIndex >= 0) return true;
            if (window.stateManager) {
                window.stateManager.setLastActivePanel('layer');
            }
            adapter.select({
                ...payload,
                row,
                options: {
                    syncWorkingLayer: true,
                    renderAnimationTable: true,
                    requestLayerPanelUpdate: true
                }
            });
            return true;
        }
        return false;
    }

    _resolveLayerPanelCardClickTarget(target) {
        for (const variantName of ['clip-layer-mirror', 'legacy-layer-card']) {
            const variant = this._getLayerPanelCardVariantConfig(variantName);
            const row = target?.closest?.(variant.rowSelector);
            if (!row) continue;
            const isBackground = row.dataset.isBackground === 'true';

            const actionEntries = [
                ['visibility', variant.visibilityButtonSelector],
                ['clipping', variant.clipButtonSelector],
                ['rename', variant.nameSelector],
                ['folder', variant.thumbSelector]
            ];
            for (const [action, selector] of actionEntries) {
                const actionElement = selector ? target.closest(selector) : null;
                if (actionElement && row.contains(actionElement)) {
                    if (isBackground && action === 'rename') return null;
                    if (action === 'folder' && row.dataset.isFolder !== 'true') break;
                    return { variant, row, action, actionElement };
                }
            }

            if (variantName === 'legacy-layer-card' && this._isLegacyLayerCardInteractiveTarget(target)) {
                return null;
            }
            if (isBackground) return null;
            return { variant, row, action: 'select', actionElement: row };
        }
        return null;
    }

    _createLayerPanelCardActionPayload(variant, row, event) {
        return variant === 'clip-layer-mirror'
            ? {
                assetId: row?.dataset.assetId,
                layerId: row?.dataset.internalLayerId,
                event
            }
            : {
                index: Number.parseInt(row?.dataset.layerIndex, 10),
                layerId: row?.dataset.layerId,
                event
            };
    }

    _editLayerPanelCardNameFromDelegatedClick(e, variant, row, nameElement) {
        if (variant === 'clip-layer-mirror') {
            return this._editClipLayerMirrorNameFromClick(e, nameElement);
        }
        const index = Number.parseInt(row?.dataset.layerIndex, 10);
        const layer = this.layerSystem?.getLayers?.()?.[index];
        if (!layer || !Number.isInteger(index)) return false;
        e.preventDefault();
        e.stopPropagation();
        this._editLayerName(nameElement, layer, index);
        return true;
    }

    _toggleCafHeaderVisibilityFromClick(button) {
        const clipId = button?.dataset.clipId;
        const animationTable = window.PopupManager?.get?.('animationTable');
        if (!animationTable?.toggleClipVisibilityFromExternal || !clipId) return false;

        animationTable.toggleClipVisibilityFromExternal(clipId, { source: 'layer-panel-caf-header' });
        return true;
    }

    _toggleCafHeaderExpandedFromClick(button) {
        const clipId = button?.dataset.clipId;
        if (!clipId) return false;

        const isExpanded = button.getAttribute('aria-expanded') === 'true';
        if (isExpanded) {
            this._expandedCafClipIds.delete(clipId);
            this._collapsedCafClipIds.add(clipId);
        } else {
            this._expandedCafClipIds.add(clipId);
            this._collapsedCafClipIds.delete(clipId);
        }
        this.requestUpdate({ force: true });
        return true;
    }

    _selectCafAssetFromClick(target) {
        const clipId = target?.dataset.clipId;
        const animationTable = window.PopupManager?.get?.('animationTable');
        if (!animationTable?.selectClipAssetFromExternal || !clipId) return false;

        animationTable.selectClipAssetFromExternal(clipId, { source: 'layer-panel-caf-header' });
        return true;
    }

    _editCafHeaderNameFromClick(e, cafName) {
        const folderId = cafName?.dataset.folderId;
        const animationTable = window.PopupManager?.get?.('animationTable');
        if (!folderId || !animationTable?.renameClipAssetFolderFromExternal) return false;

        this._editInlineText(cafName, cafName.textContent || '', (nextName) => {
            animationTable.renameClipAssetFolderFromExternal(folderId, nextName, { source: 'layer-panel-caf-header' });
        });
        e.preventDefault();
        e.stopPropagation();
        return true;
    }

    _editCafHeaderLaneNameFromClick(e, cafLane) {
        const laneId = cafLane?.dataset.laneId;
        const animationTable = window.PopupManager?.get?.('animationTable');
        if (!laneId || !animationTable?.renameLane) return false;

        this._editInlineText(cafLane, cafLane.textContent || '', (nextName) => {
            animationTable.renameLane(laneId, nextName);
        });
        e.preventDefault();
        e.stopPropagation();
        return true;
    }

    _editClipLayerMirrorNameFromClick(e, mirrorName) {
        if (!this._editClipLayerMirrorName(mirrorName, { source: 'layer-panel-clip-layer-mirror' })) return false;
        e.preventDefault();
        e.stopPropagation();
        return true;
    }

    _editClipLayerMirrorName(mirrorName, options = {}) {
        const mirrorRow = mirrorName?.closest(this._getLayerPanelCardVariantConfig('clip-layer-mirror').rowSelector);
        const assetId = mirrorRow?.dataset.assetId;
        const layerId = mirrorRow?.dataset.internalLayerId;
        const animationTable = window.PopupManager?.get?.('animationTable');
        if (!animationTable?.renameInternalLayerFromExternal || !assetId || !layerId) return false;

        this._editInlineText(mirrorName, mirrorName.textContent || '', (nextName) => {
            this._getLayerPanelCardAdapter('clip-layer-mirror').rename({
                assetId,
                layerId,
                name: nextName,
                source: options.source
            });
        });
        return true;
    }

    _handleLayerPanelCardPointerDown(e) {
        const target = this._resolveLayerPanelCardPointerTarget(e);
        if (!target) return;

        this._startLayerPanelCardDrag(e, target.row, target.options);
    }

    _resolveLayerPanelCardPointerTarget(e) {
        for (const entry of this._getLayerPanelCardPointerDragEntries()) {
            if (entry.disabled?.()) continue;
            const row = e.target.closest(entry.variant.rowSelector);
            if (row) {
                return { row, options: entry.options };
            }
        }
        return null;
    }

    _getLayerPanelCardPointerDragEntries() {
        return [
            {
                variant: this._getLayerPanelCardVariantConfig('clip-layer-mirror'),
                options: this._getClipLayerMirrorCardDragOptions()
            },
            {
                variant: this._getLayerPanelCardVariantConfig('legacy-layer-card'),
                options: this._getLegacyLayerCardDragOptions(),
                disabled: () => this._hasAnimationContext()
            }
        ];
    }

    _getClipLayerMirrorCardDragOptions() {
        const variant = this._getLayerPanelCardVariantConfig('clip-layer-mirror');
        return {
            dragKind: variant.name,
            rowSelector: variant.rowSelector,
            skipDrag: (event, targetRow) => targetRow.classList.contains('is-folder')
                && event.target.closest(variant.thumbSelector),
            onSelect: (targetRow) => {
                this._selectClipLayerMirrorRow(targetRow, {
                    syncWorkingLayer: false,
                    renderAnimationTable: false,
                    requestLayerPanelUpdate: false,
                    visualOnly: true
                });
            },
            canDropInside: (targetRow) => targetRow.classList.contains('is-folder'),
            onDrop: (dropPayload) => {
                this._applyClipLayerMirrorCardDropFromPointer(dropPayload);
            }
        };
    }

    _getLegacyLayerCardDragOptions() {
        const variant = this._getLayerPanelCardVariantConfig('legacy-layer-card');
        return {
            dragKind: variant.name,
            rowSelector: variant.rowSelector,
            skipDrag: (event, targetRow) => {
                if (this._isLegacyLayerCardInteractiveTarget(event.target)) {
                    return true;
                }
                const layerIndex = parseInt(targetRow.dataset.layerIndex, 10);
                const layer = this.layerSystem?.getLayers?.()?.[layerIndex];
                return !layer || layer.layerData?.isBackground === true;
            },
            canDropInside: (targetRow) => targetRow.dataset.isFolder === 'true',
            onDrop: (dropPayload) => {
                this._applyLegacyLayerCardDropFromPointer(dropPayload);
            }
        };
    }

    _getLayerPanelCardVariantConfig(variant = 'layer-panel-card') {
        const configs = {
            'clip-layer-mirror': {
                name: 'clip-layer-mirror',
                rowSelector: '.clip-layer-mirror-row',
                nameSelector: '.clip-layer-mirror-name',
                thumbSelector: '.clip-layer-mirror-thumb',
                visibilityButtonSelector: '.clip-layer-mirror-visibility-btn',
                clipButtonSelector: '.clip-layer-mirror-clip-btn'
            },
            'legacy-layer-card': {
                name: 'legacy-layer-card',
                rowSelector: '.legacy-layer-card-row',
                nameSelector: '.legacy-layer-card-name',
                thumbSelector: '.legacy-layer-card-thumb',
                visibilityButtonSelector: '.legacy-layer-card-visibility-action',
                clipButtonSelector: '.legacy-layer-card-third-action.layer-clip-status',
                interactiveSelectors: [
                    '.layer-panel-card-action',
                    '.layer-delete-button',
                    '.layer-visibility',
                    '.layer-opacity-control',
                    '.layer-clip-status',
                    '.layer-background-color-button',
                    '.layer-duplicate-button',
                    '.layer-merge-down-button'
                ]
            }
        };
        return configs[variant] || {
            name: variant,
            rowSelector: '.layer-panel-card-row',
            interactiveSelectors: []
        };
    }

    _getLayerPanelCardAdapter(variant) {
        return variant === 'clip-layer-mirror'
            ? this._createClipLayerMirrorCardAdapter()
            : this._createLegacyLayerCardAdapter();
    }

    _createLegacyLayerCardAdapter() {
        return {
            select: ({ index, event, preserveSelection = false } = {}) => {
                if (!Number.isInteger(index)) return false;
                if (preserveSelection) {
                    this.layerSystem?.setActiveLayer?.(index, { preserveSelection: true });
                } else {
                    this._handleLayerItemClick(event || {}, index);
                }
                return true;
            },
            toggleVisible: ({ index } = {}) => {
                if (!Number.isInteger(index) || !this.layerSystem?.toggleLayerVisibility) return false;
                this.layerSystem.toggleLayerVisibility(index);
                return true;
            },
            toggleClipping: ({ index } = {}) => {
                if (!Number.isInteger(index) || !this.layerSystem?.toggleLayerClipping) return false;
                this.layerSystem.toggleLayerClipping(index);
                return true;
            },
            toggleFolder: ({ layerId } = {}) => {
                if (!layerId || !this.layerSystem?.toggleFolderExpand) return false;
                this.layerSystem.toggleFolderExpand(layerId);
                return true;
            },
            move: (payload = {}) => this._applyLegacyLayerCardDropOperation(payload)
        };
    }

    _createClipLayerMirrorCardAdapter() {
        return {
            select: ({ row, options = {} } = {}) => this._selectClipLayerMirrorRowDirect(row, options),
            rename: ({ assetId, layerId, name, source } = {}) => {
                const table = window.PopupManager?.get?.('animationTable');
                if (!table?.renameInternalLayerFromExternal || !assetId || !layerId) return false;
                table.renameInternalLayerFromExternal(assetId, layerId, name, {
                    source: source || 'layer-panel-clip-layer-mirror'
                });
                return true;
            },
            toggleVisible: ({ assetId, layerId } = {}) => {
                const table = window.PopupManager?.get?.('animationTable');
                if (!table?.toggleInternalLayerVisibilityFromExternal || !assetId || !layerId) return false;
                table.toggleInternalLayerVisibilityFromExternal(assetId, layerId, {
                    source: 'layer-panel-clip-layer-mirror',
                    preserveSelection: true
                });
                return true;
            },
            toggleClipping: ({ assetId, layerId } = {}) => {
                const table = window.PopupManager?.get?.('animationTable');
                if (!table?.toggleInternalLayerClippingFromExternal || !assetId || !layerId) return false;
                table.toggleInternalLayerClippingFromExternal(assetId, layerId, {
                    source: 'layer-panel-clip-layer-mirror',
                    preserveSelection: true
                });
                return true;
            },
            toggleFolder: ({ assetId, layerId } = {}) => {
                if (!assetId || !layerId) return false;
                this._toggleClipInternalFolder(assetId, layerId);
                this.requestUpdate({ force: true });
                return true;
            },
            move: ({ sourceAssetId, sourceLayerId, targetLayerId, placement } = {}) => {
                const table = window.PopupManager?.get?.('animationTable');
                if (!table?.moveInternalLayerToPosition ||
                    !sourceAssetId || !sourceLayerId || !targetLayerId || !placement) return false;
                table.moveInternalLayerToPosition(sourceAssetId, sourceLayerId, targetLayerId, placement);
                return true;
            }
        };
    }

    _startLayerPanelCardDrag(e, row, options = {}) {
        if (e.button !== 0) return false;
        if (this._isLayerPanelCardNativeInteractiveTarget(e.target)) return false;
        if (!row || !this.container.contains(row)) return false;
        if (options.skipDrag?.(e, row) === true) return false;

        options.onSelect?.(row);

        e.preventDefault();
        e.stopPropagation();
        try {
            row.setPointerCapture?.(e.pointerId);
        } catch (err) {}

        this._cardDrag = this._createLayerPanelCardDragState(e, row, options);

        document.addEventListener('pointermove', this._handleLayerPanelCardPointerMove, { passive: false, capture: true });
        document.addEventListener('pointerup', this._handleLayerPanelCardPointerUp, { capture: true });
        document.addEventListener('pointercancel', this._handleLayerPanelCardPointerUp, { capture: true });
        return true;
    }

    _createLayerPanelCardDragState(e, row, options = {}) {
        const rect = row.getBoundingClientRect();
        const fallbackVariant = this._getLayerPanelCardVariantConfig(options.dragKind || 'layer-panel-card');
        return {
            pointerId: e.pointerId,
            row,
            captureTarget: row,
            dragKind: options.dragKind || fallbackVariant.name,
            rowSelector: options.rowSelector || fallbackVariant.rowSelector,
            canDropInside: options.canDropInside || null,
            onDrop: options.onDrop || null,
            assetId: row.dataset.assetId,
            layerId: row.dataset.internalLayerId || row.dataset.layerId,
            startX: e.clientX,
            startY: e.clientY,
            offsetX: e.clientX - rect.left,
            offsetY: e.clientY - rect.top,
            active: false,
            ghost: null,
            targetRow: null,
            placement: null
        };
    }

    _isLayerPanelCardNativeInteractiveTarget(target) {
        return Boolean(target?.closest?.('button, input, textarea, select'));
    }

    _selectClipLayerMirrorRow(row, options = {}) {
        return this._getLayerPanelCardAdapter('clip-layer-mirror').select({ row, options });
    }

    _selectClipLayerMirrorRowDirect(row, options = {}) {
        if (!row) return false;
        const layerId = row.dataset.internalLayerId;
        const assetId = row.dataset.assetId;
        const animationTable = window.PopupManager?.get?.('animationTable');
        if (!animationTable || !layerId) return false;

        const asset = assetId && animationTable.model
            ? animationTable.model.getClipAsset(assetId)
            : null;
        animationTable.selectedAssetId = assetId || animationTable.selectedAssetId;
        animationTable.selectedAssetFolderId = asset?.folderId || null;
        animationTable.selectedInternalLayerId = layerId;

        if (options.visualOnly !== false) {
            const variant = this._getLayerPanelCardVariantConfig('clip-layer-mirror');
            this.container?.querySelectorAll(`${variant.rowSelector}.is-selected`).forEach(candidate => {
                candidate.classList.toggle('is-selected', candidate === row);
            });
            row.classList.add('is-selected');
        }

        if (options.syncWorkingLayer) {
            animationTable._syncActiveWorkingLayerToSelectedInternalLayer?.(asset);
        }
        this.eventBus?.emit?.('layer:status-update-requested', {
            currentLayer: asset?.internalLayers?.find(layer => layer.id === layerId)?.name || asset?.name || 'CAF',
            source: 'layer-panel-clip-layer-mirror'
        });
        this._syncOpenLayerAttributePopupToCurrentTarget();
        if (options.renderAnimationTable) {
            animationTable.render?.();
        }
        if (options.requestLayerPanelUpdate) {
            this.requestUpdate({ force: true });
        }
        return true;
    }

    _handleLayerPanelCardPointerMove(e) {
        const drag = this._cardDrag;
        if (!drag || e.pointerId !== drag.pointerId) return;

        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (!drag.active && Math.hypot(dx, dy) < 5) return;

        e.preventDefault();
        if (!drag.active) {
            this._activateLayerPanelCardDrag(drag);
        }

        this._positionLayerPanelCardDragGhost(drag, e.clientX, e.clientY);
        this._updateLayerPanelCardDropTarget(e.clientX, e.clientY);
    }

    _activateLayerPanelCardDrag(drag) {
        if (!drag || drag.active) return;
        drag.active = true;
        drag.rowLayout = this._captureLayerPanelCardRowLayout(drag);
        drag.row?.classList.add('is-dragging');
        drag.ghost = this._createLayerPanelCardDragGhost(drag);
    }

    _captureLayerPanelCardRowLayout(drag) {
        return [...this.container.querySelectorAll(drag.rowSelector)].map(row => ({
            row,
            rect: row.getBoundingClientRect()
        }));
    }

    _createLayerPanelCardDragGhost(drag) {
        const ghost = document.createElement('div');
        const variant = this._getLayerPanelCardVariantConfig(drag.dragKind);
        const name = drag.row.querySelector(variant.nameSelector)?.textContent?.trim()
            || drag.row.dataset.layerId
            || 'Layer';
        ghost.className = 'layer-panel-card-drag-ghost layer-panel-card-drag-preview';
        ghost.textContent = name;
        ghost.style.width = `${Math.max(120, drag.row.getBoundingClientRect().width)}px`;
        ghost.style.left = '0px';
        ghost.style.top = '0px';
        document.body.appendChild(ghost);
        return ghost;
    }

    _positionLayerPanelCardDragGhost(drag, clientX, clientY) {
        if (!drag?.ghost) return;
        const style = getComputedStyle(drag.ghost);
        const rotation = style.getPropertyValue('--layer-card-drag-ghost-rotation').trim() || '2deg';
        const scale = style.getPropertyValue('--layer-card-drag-ghost-scale').trim() || '1.02';
        drag.ghost.style.transform = `translate3d(${clientX - drag.offsetX}px, ${clientY - drag.offsetY}px, 0) rotate(${rotation}) scale(${scale})`;
    }

    _updateLayerPanelCardDropTarget(x, y) {
        const drag = this._cardDrag;
        if (!drag?.active) return;

        const dropTarget = this._resolveLayerPanelCardDropTarget(drag, x, y);
        if (!dropTarget) {
            this._setLayerPanelCardDropTarget(drag, null, null);
            return;
        }

        this._setLayerPanelCardDropTarget(drag, dropTarget.targetRow, dropTarget.placement);
    }

    _setLayerPanelCardDropTarget(drag, targetRow, placement) {
        if (!drag) return;
        if (drag.targetRow === targetRow && drag.placement === placement) {
            return;
        }

        this._clearLayerPanelCardDropTarget();
        if (!targetRow || !placement) {
            drag.targetRow = null;
            drag.placement = null;
            return;
        }

        targetRow.classList.add(`is-dnd-${placement}`);
        drag.targetRow = targetRow;
        drag.placement = placement;
        this._applyLayerPanelCardReorderPreview(drag);
    }

    _applyLayerPanelCardReorderPreview(drag) {
        if (!drag || drag.placement === 'inside') return;
        const rows = [...this.container.querySelectorAll(drag.rowSelector)];
        const sourceIndex = rows.indexOf(drag.row);
        const targetIndex = rows.indexOf(drag.targetRow);
        if (sourceIndex < 0 || targetIndex < 0) return;

        const insertionIndex = targetIndex + (drag.placement === 'after' ? 1 : 0);
        const shiftDistance = drag.row.getBoundingClientRect().height + 2;
        if (insertionIndex < sourceIndex) {
            rows.slice(insertionIndex, sourceIndex).forEach(row => {
                row.style.setProperty('--layer-card-dnd-reorder-shift', `${shiftDistance}px`);
                row.classList.add('is-dnd-shift-down');
            });
        } else if (insertionIndex > sourceIndex + 1) {
            rows.slice(sourceIndex + 1, insertionIndex).forEach(row => {
                row.style.setProperty('--layer-card-dnd-reorder-shift', `${shiftDistance}px`);
                row.classList.add('is-dnd-shift-up');
            });
        }
    }

    _resolveLayerPanelCardDropTarget(drag, x, y) {
        const layout = drag.rowLayout || this._captureLayerPanelCardRowLayout(drag);
        const targetEntry = layout.find(({ row, rect }) => (
            row !== drag.row &&
            x >= rect.left &&
            x <= rect.right &&
            y >= rect.top &&
            y <= rect.bottom
        ));
        if (!targetEntry || !this.container.contains(targetEntry.row)) {
            return null;
        }

        const { row: targetRow, rect } = targetEntry;
        const ratio = rect.height > 0 ? (y - rect.top) / rect.height : 0.5;
        const canDropInside = drag.canDropInside?.(targetRow) === true;
        const placement = canDropInside && ratio > 0.25 && ratio < 0.75
            ? 'inside'
            : (ratio < 0.5 ? 'before' : 'after');

        return { targetRow, placement };
    }

    _handleLayerPanelCardPointerUp(e) {
        const drag = this._cardDrag;
        if (!drag || e.pointerId !== drag.pointerId) return;

        if (drag.active) {
            e.preventDefault();
            e.stopPropagation();
            this._cardDragSuppressClick = true;
            setTimeout(() => {
                this._cardDragSuppressClick = false;
            }, 80);

            this._applyLayerPanelCardDrop(drag);
        }

        this._finishLayerPanelCardDrag();
    }

    _applyLayerPanelCardDrop(drag) {
        if (!drag?.onDrop) return false;
        const payload = this._createLayerPanelCardDropPayload(drag);
        if (!this._isLayerPanelCardDropPayloadReady(payload)) return false;
        return drag.onDrop(payload) === true;
    }

    _createLayerPanelCardDropPayload(drag) {
        return {
            drag,
            targetRow: drag?.targetRow || null,
            placement: drag?.placement || null,
            dragKind: drag?.dragKind || '',
            layerId: drag?.layerId || '',
            assetId: drag?.assetId || ''
        };
    }

    _isLayerPanelCardDropPayloadReady(payload) {
        return !!(payload?.drag && payload.targetRow && payload.placement);
    }

    _finishLayerPanelCardDrag() {
        const drag = this._cardDrag;
        document.removeEventListener('pointermove', this._handleLayerPanelCardPointerMove, true);
        document.removeEventListener('pointerup', this._handleLayerPanelCardPointerUp, true);
        document.removeEventListener('pointercancel', this._handleLayerPanelCardPointerUp, true);
        this._clearLayerPanelCardDropTarget();
        try {
            drag?.captureTarget?.releasePointerCapture?.(drag.pointerId);
        } catch (err) {}
        if (drag?.row) drag.row.classList.remove('is-dragging');
        if (drag?.ghost?.parentNode) drag.ghost.parentNode.removeChild(drag.ghost);
        this._cardDrag = null;
        if (this._pendingUpdateAfterDrag) {
            this._pendingUpdateAfterDrag = false;
            this.requestUpdate();
        }
    }

    _clearLayerPanelCardDropTarget() {
        const fallbackVariant = this._getLayerPanelCardVariantConfig('clip-layer-mirror');
        const selector = this._cardDrag?.rowSelector || fallbackVariant.rowSelector;
        this.container?.querySelectorAll(
            `${selector}.is-dnd-before, ${selector}.is-dnd-after, ${selector}.is-dnd-inside, ` +
            `${selector}.is-dnd-shift-up, ${selector}.is-dnd-shift-down`
        ).forEach(row => {
            row.classList.remove(
                'is-dnd-before',
                'is-dnd-after',
                'is-dnd-inside',
                'is-dnd-shift-up',
                'is-dnd-shift-down'
            );
            row.style.removeProperty('--layer-card-dnd-reorder-shift');
        });
    }

    _getLegacyLayerCardInteractiveSelector(extraSelector = '') {
        const variant = this._getLayerPanelCardVariantConfig('legacy-layer-card');
        return [
            ...(variant.interactiveSelectors || []),
            'input',
            'textarea',
            'select',
            '[contenteditable="true"]',
            extraSelector
        ].filter(Boolean).join(', ');
    }

    _isLegacyLayerCardInteractiveTarget(target, extraSelector = '') {
        return Boolean(target?.closest?.(this._getLegacyLayerCardInteractiveSelector(extraSelector)));
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

        this.eventBus.on('layer:panel-update-requested', (payload = {}) => {
            if (payload.skipRender === true) return;
            this.requestUpdate({ force: true });
            this._syncOpenLayerAttributePopupToCurrentTarget();
        });
        this.eventBus.on('layer:created', () => this.requestUpdate({ force: true }));
        this.eventBus.on('folder:created', () => this.requestUpdate({ force: true }));
        this.eventBus.on('folder:toggled', () => this.requestUpdate());
        this.eventBus.on('layer:added-to-folder', () => this.requestUpdate());
        this.eventBus.on('layer:removed-from-folder', () => this.requestUpdate());
        this.eventBus.on('layer:deleted', () => this.requestUpdate());
        this.eventBus.on('layer:activated', ({ layerIndex }) => {
            if (this._layerAttributePopup?.classList.contains('show')) {
                if (this._getAnimationAttributeTarget()) {
                    this._syncOpenLayerAttributePopupToCurrentTarget();
                } else {
                    this._retargetLayerAttributePopup(layerIndex);
                }
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
        this.eventBus.on('camera:resized', () => {
            this.updateAllThumbnails();
            this.requestUpdate({ force: true });
        });
        this.eventBus.on('canvas:resized', () => {
            this.updateAllThumbnails();
            this.requestUpdate({ force: true });
        });

        // [指示書 v5/v6 修正] 無限ループ防止のため 'thumbnail:layer-updated' のリスナーを削除。
        // サムネイルの更新は、生成完了後に発行される 'thumbnail:updated' で一括処理する。

        // [指示書 v5] サムネイル生成完了通知を受け取って反映
        this.eventBus.on('thumbnail:updated', (data) => {
            if (!data || !data.dataURL) return;

            const layerIndex = data.layerIndex;
            if (typeof layerIndex !== 'number') return;

            const layerItems = Array.from(this.container.querySelectorAll('.layer-item'));
            const targetItem = layerItems.find(item => Number(item.dataset.layerIndex) === layerIndex);
            if (!targetItem) return;

            const thumbnailContainer = targetItem.querySelector('.layer-thumbnail');
            if (!thumbnailContainer) return;

            let img = thumbnailContainer.querySelector('img');
            if (!img) {
                img = this._createLayerThumbnailImage();
                thumbnailContainer.innerHTML = '';
                this._appendLayerPanelCardParts(thumbnailContainer, img);
            } else {
                img.classList.add('layer-panel-card-thumb-image', 'layer-thumbnail-image');
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

        if (this._cardDrag?.active) {
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
        this._pendingUpdateAfterDrag = false;
        this._finishFolderDrag();
        this._finishLayerPanelCardDrag();
    }

    render(layers, activeIndex, animationSystem = null) {
        if (!this.container) return;
        if (!layers || layers.length === 0) return;

        this.container.innerHTML = '';
        this.container.classList.remove('layer-panel-items--folder-dragging');

        this.container.style.overflowY = 'auto';
        this.container.style.overflowX = 'hidden';

        // Phase 4z15: CAF読み取り専用ヘッダーの描画
        const cafHeader = this.createCafReadonlyHeader();
        if (cafHeader) {
            this._appendLayerPanelCardParts(this.container, cafHeader);
        }

        const reversedLayers = [...layers].reverse();
        const reversedActiveIndex = layers.length - 1 - activeIndex;
        const selectedLayerIds = new Set(this.layerSystem?.getSelectedLayerIds?.() || []);
        const animationTable = window.PopupManager?.get?.('animationTable');
        const hasAnimationContext = this._hasAnimationContext(animationTable);
        const hideAnimationWorkingLayers = true;
        const hideNormalLayersForAnimationContext = hasAnimationContext;

        reversedLayers.forEach((layer, reversedIndex) => {
            const originalIndex = layers.length - 1 - reversedIndex;
            const isActive = originalIndex === activeIndex;
            const isSelected = selectedLayerIds.has(layer.layerData?.id);

            if (this._isLayerHiddenByClosedFolder(layer, layers)) return;
            if (
                hideAnimationWorkingLayers &&
                layer.layerData?.isAnimationWorkingLayer === true &&
                !layer.layerData.isBackground
            ) return;
            if (
                hideNormalLayersForAnimationContext &&
                layer.layerData &&
                !layer.layerData.isBackground
            ) return;

            const layerElement = layer.layerData?.isFolder
                ? this.createFolderElement(layer, originalIndex, isActive, layers, isSelected)
                : this.createLayerElement(layer, originalIndex, isActive, animationSystem, isSelected);

            this._appendLayerPanelCardParts(this.container, layerElement);
        });

        this._updateScrollState();
    }

    _hasAnimationContext(animationTable = window.PopupManager?.get?.('animationTable')) {
        return !!(
            animationTable?.model &&
            (
                (animationTable.model.tracks?.length || 0) > 0 ||
                (animationTable.model.clipAssets?.length || 0) > 0
            )
        );
    }

    _createLegacyLayerCardShell({
        layer,
        index,
        isActive = false,
        isSelected = false,
        allLayers = [],
        isFolder = false,
        isBackground = false
    } = {}) {
        return this._createLayerPanelCardRowElement(
            this._createLegacyLayerCardRowModel({
                layer,
                index,
                isActive,
                isSelected,
                allLayers,
                isFolder,
                isBackground
            })
        );
    }

    _createLegacyLayerCardElement(options = {}) {
        const card = this._createLegacyLayerCardShell(options);
        this._populateLayerPanelCardElement(card, this._createLegacyLayerCardParts(options));
        return card;
    }

    _createLegacyLayerCardOptions({
        layer,
        index,
        isActive = false,
        isSelected = false,
        allLayers = [],
        isFolder = false,
        isBackground = false,
        includeChildLine = false,
        actionOptions = {}
    } = {}) {
        return {
            layer,
            index,
            isActive,
            isSelected,
            allLayers,
            isFolder,
            isBackground,
            includeChildLine,
            actionOptions
        };
    }

    _createLegacyLayerCardRowModel({
        layer,
        index,
        isActive = false,
        isSelected = false,
        allLayers = [],
        isFolder = false,
        isBackground = false
    } = {}) {
        const depth = this._calculateIndentLevel(layer, allLayers);
        const isExpanded = layer?.layerData?.folderExpanded;
        const leftOffset = depth * 12;
        const rowWidth = isActive ? 160 : Math.max(120, 160 - depth * 14);
        const rowStyleState = this._createLegacyLayerCardRowStyleState({
            depth,
            rowWidth,
            leftOffset,
            isActive,
            isSelected,
            isFolder,
            isExpanded,
            isBackground
        });
        const variant = this._getLayerPanelCardVariantConfig('legacy-layer-card').name;
        return this._createLayerPanelCardRowModelFromOptions(variant, {
            classOptions: this._createLegacyLayerCardClassOptions({
                layer,
                isActive,
                isSelected,
                isFolder,
                isBackground
            }),
            dataOptions: this._createLegacyLayerCardDataOptions({
                layer,
                index,
                depth,
                isFolder,
                isBackground
            }),
            styleVars: rowStyleState
        });
    }

    _createLegacyLayerCardClassOptions({
        layer,
        isActive = false,
        isSelected = false,
        isFolder = false,
        isBackground = false
    } = {}) {
        return this._createLayerPanelCardBaseClassOptions({
            isActive,
            isSelected,
            isFolder,
            isHidden: layer?.layerData?.visible === false,
            extraClasses: [
                'layer-item',
                isFolder ? 'folder-item' : '',
                isBackground ? 'background-layer' : '',
                isActive ? 'active' : '',
                isSelected ? 'selected' : ''
            ]
        });
    }

    _createLegacyLayerCardDataOptions({
        layer,
        index,
        depth = 0,
        isFolder = false,
        isBackground = false
    } = {}) {
        return this._createLayerPanelCardBaseDataOptions({
            cardKind: 'legacy-layer',
            layerId: layer?.layerData?.id || '',
            layerIndex: index,
            depth,
            isFolder,
            isBackground
        });
    }

    _createLegacyLayerCardRowStyleState({
        rowWidth = 160,
        leftOffset = 0,
        isActive = false,
        isSelected = false,
        isFolder = false,
        isExpanded = false,
        isBackground = false
    } = {}) {
        const bgColor = isFolder
            ? (isExpanded ? '#e9c2ba' : '#cf9c97')
            : '#ffffee';
        const borderColor = isActive && !isBackground
            ? '#ff6600'
            : (isSelected && !isBackground ? 'rgba(255, 140, 66, 0.6)' : '');
        const borderWidth = isActive && !isBackground ? '2px' : '';
        return {
            '--card-row-width': `${rowWidth}px`,
            '--card-row-margin-left': `${leftOffset}px`,
            '--card-row-bg': bgColor,
            '--card-row-border-color': borderColor,
            '--card-row-border-width': borderWidth,
            '--card-row-active-border-color': borderColor,
            '--card-row-active-border-width': borderWidth,
            '--card-row-active-bg': bgColor,
            '--legacy-card-width': `${rowWidth}px`,
            '--legacy-card-margin-left': `${leftOffset}px`,
            '--legacy-card-bg': bgColor,
            '--legacy-card-border-color': borderColor,
            '--legacy-card-border-width': borderWidth
        };
    }

    _createLayerPanelCardRowModel(variant, { classOptions = {}, dataOptions = {}, styleVars = {} } = {}) {
        const resolvedVariant = this._getLayerPanelCardVariantConfig(variant).name;
        return {
            variant: resolvedVariant,
            className: this._getLayerPanelCardClassNames(resolvedVariant, classOptions),
            dataOptions,
            dataAttributes: this._createLayerPanelCardDataAttributes(dataOptions),
            styleVars,
            styleAttributes: this._createLayerPanelCardStyleAttributes(styleVars)
        };
    }

    _createLayerPanelCardRowElement(cardModel = {}) {
        const card = this._createLayerPanelCardPart('div', cardModel.className || '');
        this._applyLayerPanelCardDataset(card, cardModel.dataOptions || {});
        this._applyLayerPanelCardStyleVars(card, cardModel.styleVars || {});
        return card;
    }

    _getLayerPanelCardClassNames(variant, options = {}) {
        return [
            'layer-panel-card-row',
            `${variant}-row`,
            options.isSelected ? 'is-selected' : '',
            options.isActive ? 'is-active' : '',
            options.isHidden ? 'is-hidden' : '',
            options.isFolder ? 'is-folder' : '',
            options.isCollapsed ? 'is-collapsed' : '',
            Number.isInteger(options.depth) ? `depth-${options.depth}` : '',
            ...(options.extraClasses || [])
        ].filter(Boolean).join(' ');
    }

    _applyLayerPanelCardDataset(element, options = {}) {
        if (!element?.dataset) return;
        const attributes = this._createLayerPanelCardDataAttributeMap(options);
        Object.entries(attributes).forEach(([name, value]) => {
            const datasetName = name.replace(/^data-/, '').replace(/-([a-z])/g, (_, char) => char.toUpperCase());
            element.dataset[datasetName] = String(value);
        });
    }

    _applyLayerPanelAttributes(element, attributes = {}) {
        if (!element?.setAttribute) return;
        Object.entries(attributes)
            .filter(([, value]) => value !== undefined && value !== null && value !== '')
            .forEach(([name, value]) => {
                element.setAttribute(name, String(value));
            });
    }

    _createLayerPanelCardDataAttributes(options = {}) {
        return this._createLayerPanelDataAttributes(this._createLayerPanelCardDataAttributeMap(options));
    }

    _createLayerPanelCardDataAttributeMap(options = {}) {
        return {
            'data-card-kind': options.cardKind,
            'data-asset-id': options.assetId,
            'data-layer-id': options.layerId,
            'data-internal-layer-id': options.internalLayerId,
            'data-layer-index': options.layerIndex,
            'data-depth': Number.isInteger(options.depth) ? options.depth : '',
            'data-is-folder': options.isFolder ? 'true' : '',
            'data-is-background': options.isBackground ? 'true' : ''
        };
    }

    _createLayerPanelDataAttributes(attributes = {}) {
        return Object.entries(attributes)
            .filter(([, value]) => value !== undefined && value !== null && value !== '')
            .map(([name, value]) => `${name}="${this._escapeHtml(String(value))}"`)
            .join(' ');
    }

    _createLayerPanelCardStyleAttributes(cssVars = {}) {
        const declarations = Object.entries(cssVars)
            .filter(([, value]) => value !== undefined && value !== null && value !== '')
            .map(([name, value]) => `${name}:${String(value)}`);
        return declarations.length > 0
            ? `style="${this._escapeHtml(declarations.join(';'))}"`
            : '';
    }

    _applyLayerPanelCardStyleVars(element, cssVars = {}) {
        if (!element?.style) return;
        Object.entries(cssVars)
            .filter(([, value]) => value !== undefined && value !== null && value !== '')
            .forEach(([name, value]) => {
                element.style.setProperty(name, String(value));
            });
    }

    _getLayerPanelCardPartClassName(variant, part, extraClasses = []) {
        const resolvedVariant = variant ? this._getLayerPanelCardVariantConfig(variant).name : '';
        return [
            'layer-panel-card-' + part,
            resolvedVariant ? `${resolvedVariant}-${part}` : '',
            ...(Array.isArray(extraClasses) ? extraClasses : [extraClasses])
        ].filter(Boolean).join(' ');
    }

    _createLegacyLayerCardDetailsElement(layer, index) {
        const variant = this._getLayerPanelCardVariantConfig('legacy-layer-card').name;
        return this._createLayerPanelCardDetailsElement(variant, {
            metaElement: this._createOpacityControl(layer, index),
            nameElement: this._createLayerName(layer, index, {
                variant
            })
        });
    }

    _createLayerPanelCardDetailsElement(variant, { metaElement = null, nameElement = null } = {}) {
        const details = this._createLayerPanelCardPartElement(variant, 'details');
        this._appendLayerPanelCardParts(
            details,
            ...this._createLayerPanelCardDetailsParts({ metaElement, nameElement })
        );
        return details;
    }

    _createLegacyLayerCardActionElements(layer, index, options = {}) {
        const variant = this._getLayerPanelCardVariantConfig('legacy-layer-card').name;
        const thirdIcon = options.thirdIcon || this._createClipStatusIcon(layer, index, {
            variant,
            actionRole: 'clip',
            extraClasses: ['legacy-layer-card-third-action']
        });
        const visibilityIcon = this._createVisibilityIcon(layer, index, {
            variant,
            actionRole: 'visibility',
            extraClasses: ['legacy-layer-card-visibility-action']
        });
        return [thirdIcon, visibilityIcon];
    }

    _consumeLayerPanelCardSuppressedClick(e) {
        if (!this._cardDragSuppressClick) return false;
        e?.preventDefault?.();
        e?.stopPropagation?.();
        return true;
    }

    _createLegacyLayerCardContentParts(options = {}) {
        const { layer, index, includeChildLine = false, actionOptions = {} } = options;
        return this._createLayerPanelCardContentParts({
            childLine: includeChildLine ? this._createLayerPanelCardChildLineElement() : null,
            thumbnail: this._createLegacyLayerCardThumbnail(layer, index),
            details: this._createLegacyLayerCardDetailsElement(layer, index),
            actions: this._createLegacyLayerCardActionElements(layer, index, actionOptions)
        });
    }

    _createLegacyLayerCardParts(options = {}) {
        return options.isBackground
            ? this._createLegacyBackgroundLayerCardContentParts(options)
            : this._createLegacyLayerCardContentParts(options);
    }

    _createLegacyBackgroundLayerCardContentParts(options = {}) {
        const { layer, index } = options;
        const variant = this._getLayerPanelCardVariantConfig('legacy-layer-card').name;
        const nameSpan = this._createLayerPanelNameElement({
            text: '背景',
            extraClasses: [
                this._getLayerPanelCardPartClassName(variant, 'name'),
                'legacy-layer-card-background-name'
            ],
            title: '背景レイヤー'
        });
        return this._createLayerPanelCardContentParts({
            thumbnail: this._createLegacyLayerCardThumbnail(layer, index),
            details: nameSpan,
            actions: this._createLegacyLayerCardActionElements(layer, index, {
                thirdIcon: this._createBucketIcon(index, layer)
            })
        });
    }

    _createLegacyLayerCardThumbnail(layer, index) {
        return this._prepareLegacyLayerCardThumbnail(
            layer?.layerData?.isFolder
                ? this.createFolderThumbnail(layer, index)
                : this.createThumbnail(layer, index)
        );
    }

    _prepareLegacyLayerCardThumbnail(thumbnail) {
        if (!thumbnail) return null;
        const variant = this._getLayerPanelCardVariantConfig('legacy-layer-card').name;
        thumbnail.classList.add('layer-panel-card-thumb', `${variant}-thumb`);
        return thumbnail;
    }

    _createLayerPanelCardContentParts({ childLine = null, thumbnail = null, details = null, actions = [] } = {}) {
        return [
            childLine,
            thumbnail,
            details,
            ...this._normalizeLayerPanelPartList(actions)
        ].filter(Boolean);
    }

    _normalizeLayerPanelPartList(parts = []) {
        return Array.isArray(parts) ? parts : [parts];
    }

    _createLayerPanelCardChildLineElement() {
        return this._createLayerPanelCardPartElement('', 'child-line', {
            extraClasses: ['folder-child-line'],
            attributes: { 'aria-hidden': 'true' }
        });
    }

    _createLayerPanelCardPartModel(variant, part, {
        tagName = 'div',
        extraClasses = [],
        attributes = {},
        styleVars = {},
        rawAttributes = '',
        extraAttributes = {},
        content = ''
    } = {}) {
        return {
            tagName,
            className: this._getLayerPanelCardPartClassName(variant, part, extraClasses),
            attributes,
            styleVars,
            rawAttributes,
            extraAttributes,
            content
        };
    }

    _createLayerPanelCardPartElement(variant, part, {
        tagName = 'div',
        extraClasses = [],
        attributes = {},
        styleVars = {}
    } = {}) {
        const partModel = this._createLayerPanelCardPartModel(variant, part, {
            tagName,
            extraClasses,
            attributes,
            styleVars
        });
        return this._createLayerPanelCardPart(
            partModel.tagName,
            partModel.className,
            {
                attributes: partModel.attributes,
                styleVars: partModel.styleVars
            }
        );
    }

    _appendLayerPanelCardParts(parent, ...parts) {
        if (!parent?.appendChild) return parent || null;
        parts
            .filter(Boolean)
            .forEach(part => parent.appendChild(part));
        return parent;
    }

    _populateLayerPanelCardElement(card, parts = []) {
        return this._appendLayerPanelCardParts(
            card,
            ...this._normalizeLayerPanelPartList(parts)
        );
    }

    _getLayerPanelCardActionClassNames(variant, actionRole, extraClasses = []) {
        return this._getLayerPanelCardPartClassName(variant, 'action', [
            actionRole ? `layer-panel-card-action--${actionRole}` : '',
            ...(Array.isArray(extraClasses) ? extraClasses : [extraClasses])
        ]);
    }

    _applyLayerPanelCardActionClasses(element, variant, actionRole, extraClasses = []) {
        if (!element?.classList) return;
        this._getLayerPanelCardActionClassNames(variant, actionRole, extraClasses)
            .split(/\s+/)
            .filter(Boolean)
            .forEach(className => element.classList.add(className));
    }

    _applyLayerPanelStateClasses(element, stateClasses = {}) {
        if (!element?.classList) return;
        Object.entries(stateClasses).forEach(([className, isEnabled]) => {
            element.classList.toggle(className, !!isEnabled);
        });
    }

    _createLayerPanelStateClassNames(stateClasses = {}) {
        return Object.entries(stateClasses)
            .filter(([, isEnabled]) => !!isEnabled)
            .map(([className]) => className);
    }

    _createLayerPanelClassName(...classGroups) {
        return classGroups.flatMap(group => {
            if (Array.isArray(group)) return group;
            return [group];
        }).filter(Boolean).join(' ');
    }

    _normalizeLayerPanelClassList(classes = []) {
        return Array.isArray(classes) ? classes.filter(Boolean) : [classes].filter(Boolean);
    }

    _createLayerPanelCardActionButtonElement(variant, actionRole, options = {}) {
        return this._createLayerPanelIconButton({
            ...options,
            className: this._getLayerPanelCardActionClassNames(variant, actionRole, options.extraClasses || '')
        });
    }


    createFolderElement(folder, index, isActive, allLayers, isSelected = false) {
        return this._createLegacyLayerCardElement(this._createLegacyLayerCardOptions({
            layer: folder,
            index,
            isActive,
            isSelected,
            allLayers,
            isFolder: true
        }));
    }

    createFolderThumbnail(folder, index) {
        const { width: maxWidth, height: maxHeight } = this._getLayerPanelCardThumbnailBounds();

        const thumbnailContainer = this._createLayerThumbnailContainer(index, {
            extraClasses: ['layer-panel-card-thumb--folder', 'folder-thumbnail'],
            width: maxWidth,
            height: maxHeight,
            isFolder: true,
            isCollapsed: !folder.layerData?.folderExpanded
        });

        const isExpanded = folder.layerData?.folderExpanded;
        thumbnailContainer.innerHTML = isExpanded ? UI_ICONS.folderOpen : UI_ICONS.folder;
        const svg = thumbnailContainer.querySelector('svg');
        if (svg) {
            svg.setAttribute('stroke', 'currentColor');
        }

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
        const isBackground = layer.layerData?.isBackground || false;
        const allLayers = this.layerSystem?.getLayers() || [];
        const hasParent = layer.layerData?.parentId;
        return this._createLegacyLayerCardElement(this._createLegacyLayerCardOptions({
            layer,
            index,
            isActive,
            isSelected,
            allLayers,
            isBackground,
            includeChildLine: !!hasParent
        }));
    }

    _createClipStatusIcon(layer, index = -1, options = {}) {
        const isClipping = layer.layerData?.clipping === true;
        const canToggle = !layer.layerData?.isBackground && !layer.layerData?.isFolder;
        const createButton = options.variant && options.actionRole
            ? () => this._createLayerPanelCardActionButtonElement(options.variant, options.actionRole, {
                extraClasses: ['layer-clip-status', ...this._normalizeLayerPanelClassList(options.extraClasses)],
                iconName: canToggle || isClipping ? 'paperclip' : '',
                title: isClipping ? 'クリッピングON' : 'クリッピング未使用'
            })
            : () => this._createLayerPanelIconButton({
                className: 'layer-clip-status',
                iconName: canToggle || isClipping ? 'paperclip' : '',
                title: isClipping ? 'クリッピングON' : 'クリッピング未使用'
            });
        const clipIcon = createButton();
        this._applyLayerPanelStateClasses(clipIcon, {
            'is-clipping': isClipping,
            'is-toggleable': canToggle
        });

        return clipIcon;
    }

    _createVisibilityIcon(layer, index, options = {}) {
        const isVisible = layer.layerData?.visible !== false;
        const iconName = isVisible ? 'eye' : 'eyeOff';

        const visibilityIcon = options.variant && options.actionRole
            ? this._createLayerPanelCardActionButtonElement(options.variant, options.actionRole, {
                extraClasses: ['layer-visibility', ...this._normalizeLayerPanelClassList(options.extraClasses)],
                iconName,
                title: isVisible ? 'レイヤーを非表示' : 'レイヤーを表示'
            })
            : this._createLayerPanelIconButton({
                className: 'layer-visibility',
                iconName,
                title: isVisible ? 'レイヤーを非表示' : 'レイヤーを表示'
            });

        return visibilityIcon;
    }

    _createBucketIcon(index, layer) {
        const bucketIcon = this._createLayerPanelIconButton({
            className: 'layer-background-color-button',
            iconName: 'fill',
            title: '背景色を現在のペンカラーに変更'
        });

        bucketIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            this._changeBackgroundLayerColorFromClick(index, layer);
        });
        return bucketIcon;
    }

    _changeBackgroundLayerColorFromClick(index, layer) {
        this.eventBus?.emit?.('ui:background-color-change-requested', {
            layerIndex: index,
            layerId: layer?.layerData?.id
        });
    }

    _createLayerPanelIconButton({
        tagName = 'div',
        className = '',
        baseClass = 'ui-icon-button ui-icon-button--small',
        iconName = 'eye',
        fallbackIconName = '',
        title = '',
        ariaLabel = '',
        dataAttributes = {},
        extraAttributes = {}
    } = {}) {
        const buttonModel = this._createLayerPanelIconButtonModel({
            tagName,
            fallbackTagName: 'div',
            className,
            baseClass,
            iconName,
            fallbackIconName,
            title,
            ariaLabel,
            dataAttributes,
            extraAttributes
        });
        return this._createLayerPanelButtonElementFromModel(buttonModel);
    }

    _createLayerPanelIconButtonModel(options = {}) {
        return this._createLayerPanelButtonModel(options);
    }

    _createLayerPanelButtonElementFromModel(buttonModel = {}) {
        const icon = document.createElement(buttonModel.tagName || 'div');
        icon.className = buttonModel.className || '';
        icon.innerHTML = buttonModel.iconHtml || '';
        this._applyLayerPanelAttributes(icon, buttonModel.attributes || {});
        return icon;
    }

    _createLayerPanelButtonModel({
        tagName = 'button',
        fallbackTagName = 'button',
        className = '',
        baseClass = 'ui-icon-button ui-icon-button--small',
        iconName = 'eye',
        fallbackIconName = '',
        title = '',
        ariaLabel = '',
        dataAttributes = {},
        extraAttributes = {}
    } = {}) {
        const resolvedTagName = this._resolveLayerPanelTagName(tagName, fallbackTagName);
        return {
            tagName: resolvedTagName,
            className: this._createLayerPanelButtonClassName(className, baseClass),
            iconHtml: this._resolveLayerPanelIconHtml(iconName, fallbackIconName),
            attributes: this._createLayerPanelButtonAttributes({
                dataAttributes,
                extraAttributes,
                title,
                ariaLabel,
                isButtonTag: this._isLayerPanelButtonTag(resolvedTagName)
            })
        };
    }

    _createLayerPanelButtonClassName(className = '', baseClass = 'ui-icon-button ui-icon-button--small') {
        return `${className} ${baseClass}`.trim();
    }

    _createLayerPanelButtonAttributes({
        dataAttributes = {},
        extraAttributes = {},
        title = '',
        ariaLabel = '',
        isButtonTag = false
    } = {}) {
        return {
            ...dataAttributes,
            ...extraAttributes,
            type: isButtonTag ? 'button' : '',
            title,
            'aria-label': ariaLabel
        };
    }

    _resolveLayerPanelTagName(tagName = 'button', fallbackTagName = 'button') {
        return /^[a-z][a-z0-9-]*$/i.test(tagName) ? tagName : fallbackTagName;
    }

    _isLayerPanelButtonTag(tagName = '') {
        return String(tagName).toLowerCase() === 'button';
    }

    _resolveLayerPanelIconHtml(iconName = '', fallbackIconName = '') {
        return UI_ICONS[iconName] || (fallbackIconName ? UI_ICONS[fallbackIconName] : '') || '';
    }

    _createOpacityControl(layer, index) {
        const opacityContainer = this._createLayerPanelCardPart('div', 'layer-opacity-control');

        const currentOpacity = layer.alpha !== undefined ? layer.alpha : 1.0;
        const opacityValue = this._createLayerPanelMetaElement({
            text: `${Math.round(currentOpacity * 100)}%`,
            className: 'layer-opacity-value',
            title: '右サイドバーのスライダーアイコンでレイヤー属性'
        });

        const blendMode = layer.layerData?.blendMode || 'normal';
        const blendLabel = this._createLayerPanelMetaElement({
            text: this._getBlendModeLabel(blendMode),
            className: 'layer-blend-mode-label'
        });
        this._applyLayerPanelStateClasses(blendLabel, {
            'is-normal': blendMode === 'normal'
        });

        this._appendLayerPanelCardParts(opacityContainer, opacityValue, blendLabel);

        return opacityContainer;
    }

    _createLayerPanelCardPart(tagName = 'div', className = '', { attributes = {}, styleVars = {} } = {}) {
        const element = document.createElement(this._resolveLayerPanelTagName(tagName, 'div'));
        element.className = className;
        this._applyLayerPanelAttributes(element, attributes);
        this._applyLayerPanelCardStyleVars(element, styleVars);
        return element;
    }

    _createLayerPanelMetaElement({ text = '', className = '', title = '' } = {}) {
        return this._createLayerPanelTextSpanElement(
            this._createLayerPanelMetaModel({ text, className, title })
        );
    }

    _createLayerPanelMetaModel({ text = '', className = '', title = '' } = {}) {
        return this._createLayerPanelTextSpanModel({ text, className, title });
    }

    _createLayerPanelTextSpanModel({ text = '', className = '', title = '' } = {}) {
        return {
            tagName: 'span',
            text,
            className,
            attributes: { title },
            content: this._escapeHtml(text)
        };
    }

    _createLayerPanelTextSpanElement({ text = '', className = '', title = '' } = {}) {
        const textModel = this._createLayerPanelTextSpanModel({ text, className, title });
        const element = this._createLayerPanelCardPart(textModel.tagName, textModel.className, {
            attributes: textModel.attributes
        });
        element.textContent = textModel.text;
        return element;
    }

    _showLayerAttributePopup(layerIndex, anchorElement) {
        const layer = this.layerSystem?.getLayers?.()?.[layerIndex];
        if (!layer || layer.layerData?.isBackground) return;

        const animationTarget = this._getAnimationAttributeTarget();
        if (!animationTarget && this.layerSystem?.setActiveLayer) {
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
        const activeIndex = this._getLayerAttributeTargetIndex();
        if (typeof activeIndex !== 'number' || activeIndex < 0) return;
        const fallbackAnchor = this.container?.querySelector(`.layer-item[data-layer-index="${activeIndex}"]`);
        this._showLayerAttributePopup(activeIndex, anchorElement || fallbackAnchor);
    }

    _getLayerAttributeTargetIndex() {
        const animationTarget = this._getAnimationAttributeTarget();
        if (animationTarget?.animationTable && animationTarget?.internalLayer?.type !== 'folder') {
            const drawableInternalLayers = animationTarget.animationTable._getDrawableInternalLayers?.(animationTarget.asset) || [];
            const workingLayers = animationTarget.animationTable._getRasterWorkingLayers?.() || [];
            const internalIndex = drawableInternalLayers.findIndex(layer => layer.id === animationTarget.internalLayer.id);
            const targetLayer = internalIndex >= 0 ? workingLayers[internalIndex] : null;
            if (targetLayer?.layerData?.id) {
                const layers = this.layerSystem?.getLayers?.() || [];
                const layerIndex = layers.findIndex(layer => layer?.layerData?.id === targetLayer.layerData.id);
                if (layerIndex >= 0) return layerIndex;
            }
        }
        if (animationTarget?.animationTable) {
            return this._getLayerAttributeFallbackIndex();
        }
        return this.layerSystem?.getActiveLayerIndex?.();
    }

    _getLayerAttributeFallbackIndex() {
        const layers = this.layerSystem?.getLayers?.() || [];
        const activeIndex = this.layerSystem?.getActiveLayerIndex?.();
        const activeLayer = Number.isInteger(activeIndex) ? layers[activeIndex] : null;
        if (activeLayer?.layerData && activeLayer.layerData.isBackground !== true) {
            return activeIndex;
        }
        const fallbackIndex = layers.findIndex(layer => layer?.layerData && layer.layerData.isBackground !== true);
        return fallbackIndex >= 0 ? fallbackIndex : activeIndex;
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
        const viewState = this._getLayerAttributeViewState(layerIndex);

        const opacity = viewState.opacity;
        const blendMode = viewState.blendMode;
        const clipping = viewState.clipping;
        const isFolder = viewState.isFolder;
        const rawLayerName = viewState.name;
        const layerName = this._escapeHtml(rawLayerName);
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
                this._syncOpenLayerAttributePopupToCurrentTarget();
            });
        });

        const slider = popup.querySelector('.layer-attribute-opacity-slider');
        slider?.addEventListener('pointerdown', () => {
            this._beginLayerAttributeOpacityEdit(layerIndex);
        });
        slider?.addEventListener('focus', () => {
            this._beginLayerAttributeOpacityEdit(layerIndex);
        });
        slider?.addEventListener('input', (e) => {
            e.stopPropagation();
            const value = parseInt(e.target.value, 10);
            this._setLayerOpacity(layerIndex, value / 100, { recordHistory: false });
            this._syncOpenLayerAttributePopupToCurrentTarget();
        });
        slider?.addEventListener('change', (e) => {
            e.stopPropagation();
            const value = parseInt(e.target.value, 10);
            this._commitLayerAttributeOpacityEdit(layerIndex, value / 100);
            this._syncOpenLayerAttributePopupToCurrentTarget();
        });

        popup.querySelector('.layer-attribute-opacity-label')?.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this._editLayerAttributeOpacityValue(popup, layerIndex);
        });

        const blendSelect = popup.querySelector('.layer-attribute-blend-select');
        blendSelect?.addEventListener('change', (e) => {
            e.stopPropagation();
            const animationTarget = this._getAnimationAttributeTarget();
            if (animationTarget?.animationTable?.setInternalLayerAttributesFromExternal) {
                animationTarget.animationTable.setInternalLayerAttributesFromExternal(
                    animationTarget.asset.id,
                    animationTarget.internalLayer.id,
                    { blendMode: e.target.value },
                    { source: 'layer-attribute-popup-blend' }
                );
            } else if (this.layerSystem?.setLayerBlendMode) {
                this.layerSystem.setLayerBlendMode(layerIndex, e.target.value);
            }
            this._syncOpenLayerAttributePopupToCurrentTarget();
        });

        popup.querySelector('[data-action="toggle-clipping"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const animationTarget = this._getAnimationAttributeTarget();
            if (animationTarget?.animationTable?.setInternalLayerAttributesFromExternal) {
                animationTarget.animationTable.setInternalLayerAttributesFromExternal(
                    animationTarget.asset.id,
                    animationTarget.internalLayer.id,
                    { clipping: animationTarget.internalLayer.clipping !== true },
                    { source: 'layer-attribute-popup-clipping' }
                );
            } else if (this.layerSystem?.toggleLayerClipping) {
                this.layerSystem.toggleLayerClipping(layerIndex);
            }
            this._syncOpenLayerAttributePopupToCurrentTarget();
        });
    }

    _syncLayerAttributePopup(popup, layerIndex) {
        const layer = this.layerSystem?.getLayers?.()?.[layerIndex];
        if (!layer?.layerData) {
            this._hideLayerAttributePopup();
            return;
        }

        const viewState = this._getLayerAttributeViewState(layerIndex);
        const opacity = viewState.opacity;
        const blendMode = viewState.blendMode;
        const clipping = viewState.clipping;

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

    _syncOpenLayerAttributePopupToCurrentTarget() {
        const popup = this._layerAttributePopup;
        if (!popup?.classList.contains('show')) return;

        const targetIndex = this._getLayerAttributeTargetIndex();
        if (typeof targetIndex !== 'number' || targetIndex < 0) {
            this._hideLayerAttributePopup();
            return;
        }

        this._attributePopupLayerIndex = targetIndex;
        popup.dataset.layerIndex = String(targetIndex);
        this._syncLayerAttributePopup(popup, targetIndex);
        if (this._attributePopupAnchorElement?.isConnected) {
            this._positionLayerAttributePopup(popup, this._attributePopupAnchorElement);
        }
    }

    _getLayerAttributeViewState(layerIndex) {
        const layer = this.layerSystem?.getLayers?.()?.[layerIndex];
        const animationTarget = this._getAnimationAttributeTarget();
        const source = animationTarget?.internalLayer || layer?.layerData || {};
        const opacity = typeof source.opacity === 'number'
            ? source.opacity
            : (typeof layer?.alpha === 'number' ? layer.alpha : 1);
        return {
            name: source.name || layer?.layerData?.name || 'レイヤー',
            opacity: Math.round(opacity * 100),
            blendMode: source.blendMode || 'normal',
            clipping: source.clipping === true,
            isFolder: source.type === 'folder' || source.isFolder === true
        };
    }

    _getAnimationAttributeTarget() {
        const animationTable = window.PopupManager?.get?.('animationTable');
        if (!animationTable?.model || !animationTable.selectedCelId || !animationTable.selectedInternalLayerId) {
            return null;
        }
        const entry = animationTable.model?.findClipEntry?.(animationTable.selectedCelId);
        const asset = entry?.clip?.assetId
            ? animationTable.model.getClipAsset(entry.clip.assetId)
            : null;
        const internalLayer = asset?.internalLayers?.find(layer => layer.id === animationTable.selectedInternalLayerId) || null;
        if (!asset || !internalLayer) return null;
        return { animationTable, asset, internalLayer };
    }

    toggleSelectedAnimationFolderMirror() {
        const target = this._getAnimationAttributeTarget();
        if (!target?.asset?.id || !target?.internalLayer?.id || target.internalLayer.type !== 'folder') {
            return false;
        }
        this._toggleClipInternalFolder(target.asset.id, target.internalLayer.id);
        this.requestUpdate({ force: true });
        return true;
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
        this._attributeOpacityEditState = null;
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

        const opacity = this._getLayerAttributeViewState(layerIndex).opacity;
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
            this._syncOpenLayerAttributePopupToCurrentTarget();
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

        const animationTarget = this._getAnimationAttributeTarget();
        const originalName = animationTarget?.internalLayer?.name || layer.layerData.name || 'レイヤー';
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalName;
        input.className = 'layer-attribute-name-input';
        title.textContent = '';
        title.appendChild(input);

        const finish = (commit) => {
            const nextName = input.value.trim();
            if (commit && nextName && nextName !== originalName) {
                if (animationTarget?.animationTable?.renameInternalLayerFromExternal) {
                    animationTarget.animationTable.renameInternalLayerFromExternal(
                        animationTarget.asset.id,
                        animationTarget.internalLayer.id,
                        nextName,
                        { source: 'layer-attribute-popup' }
                    );
                } else {
                    layer.layerData.name = nextName;
                    this.eventBus?.emit('layer:name-changed', {
                        layerIndex,
                        layerId: layer.layerData.id,
                        oldName: originalName,
                        newName: nextName
                    });
                }
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

    _editInlineText(textElement, originalName, commit) {
        if (!textElement || textElement.querySelector('input')) return;
        const currentName = String(originalName || '').trim();
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;
        input.className = `layer-panel-inline-name-input ${textElement.className || ''}`.trim();
        let isFinished = false;

        const finishEdit = (shouldCommit) => {
            if (isFinished) return;
            if (!input.parentNode) return;
            isFinished = true;
            const nextName = input.value.trim();
            textElement.textContent = nextName || currentName;
            input.replaceWith(textElement);
            if (shouldCommit && nextName && nextName !== currentName) {
                commit?.(nextName);
            }
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                finishEdit(true);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                input.value = currentName;
                finishEdit(false);
            }
        });
        input.addEventListener('blur', () => finishEdit(true));
        input.addEventListener('click', (e) => e.stopPropagation());
        input.addEventListener('dblclick', (e) => e.stopPropagation());

        textElement.replaceWith(input);
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

    _createLayerPanelNameModel({ text = '', extraClasses = [], title = '', baseClasses = ['layer-name'] } = {}) {
        return {
            text,
            className: [
                ...(Array.isArray(baseClasses) ? baseClasses : [baseClasses]),
                ...(Array.isArray(extraClasses) ? extraClasses : [extraClasses])
            ].filter(Boolean).join(' '),
            title
        };
    }

    _createLayerPanelNameElement(options = {}) {
        const nameModel = this._createLayerPanelNameModel(options);
        return this._createLayerPanelTextSpanElement(nameModel);
    }

    _createLayerPanelCardNameModel(variant, options = {}) {
        return this._createLayerPanelNameModel({
            ...options,
            baseClasses: options.baseClasses || [],
            extraClasses: [
                this._getLayerPanelCardPartClassName(variant, 'name'),
                ...this._normalizeLayerPanelClassList(options.extraClasses)
            ]
        });
    }

    _createLayerPanelCardNameElement(variant, options = {}) {
        return this._createLayerPanelTextSpanElement(
            this._createLayerPanelCardNameModel(variant, options)
        );
    }

    _createLayerName(layer, index, options = {}) {
        const nameOptions = {
            text: layer.layerData?.name || `レイヤー${index}`,
            extraClasses: options.extraClasses || [],
            title: 'ダブルクリック または F2 で名前変更'
        };
        const nameSpan = options.variant
            ? this._createLayerPanelCardNameElement(options.variant, nameOptions)
            : this._createLayerPanelNameElement(nameOptions);

        return nameSpan;
    }

    _createDeleteButton(index) {
        return this._createLegacyLayerOperationButton({
            index,
            tagName: 'button',
            className: 'layer-delete-button',
            baseClass: 'ui-close-button ui-close-button--small',
            iconName: 'close',
            title: 'レイヤーを削除',
            ariaLabel: 'レイヤーを削除',
            onActivate: () => this._deleteLegacyLayerFromClick(index)
        });
    }

    _createDuplicateButton(index) {
        return this._createLegacyLayerOperationButton({
            index,
            className: 'layer-duplicate-button',
            iconName: 'duplicate',
            title: 'レイヤーを複製',
            onActivate: () => this._duplicateLegacyLayerFromClick(index)
        });
    }

    _createMergeDownButton(index) {
        const layers = this.layerSystem?.getLayers?.() || [];
        const bottomLayer = layers[index - 1];
        const canMergeDown = index > 1 && !bottomLayer?.layerData?.isBackground && !bottomLayer?.layerData?.isFolder;

        return this._createLegacyLayerOperationButton({
            index,
            className: 'layer-merge-down-button',
            iconName: 'mergeDown',
            title: '下のレイヤーと結合',
            isDisabled: !canMergeDown,
            onActivate: () => this._mergeLegacyLayerDownFromClick(index)
        });
    }

    _createLegacyLayerOperationButton({
        index,
        tagName = 'div',
        className = '',
        baseClass = 'ui-icon-button ui-icon-button--small',
        iconName = '',
        title = '',
        ariaLabel = '',
        isDisabled = false,
        onActivate = null
    } = {}) {
        const btn = this._createLayerPanelIconButton({
            tagName,
            className,
            baseClass,
            iconName,
            title,
            ariaLabel,
            dataAttributes: {
                'data-layer-index': Number.isInteger(index) ? index : ''
            }
        });
        this._applyLayerPanelStateClasses(btn, {
            'is-disabled': isDisabled
        });
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isDisabled) return;
            onActivate?.();
        });
        return btn;
    }

    _deleteLegacyLayerFromClick(index) {
        if (this.layerSystem?.deleteLayer) {
            this.layerSystem.deleteLayer(index);
        }
    }

    _duplicateLegacyLayerFromClick(index) {
        if (this.layerSystem?.duplicateLayer) {
            this.layerSystem.duplicateLayer(index);
        }
    }

    _mergeLegacyLayerDownFromClick(index) {
        if (this.layerSystem?.mergeLayerDown) {
            this.layerSystem.mergeLayerDown(index);
        }
    }

    createThumbnail(layer, index) {
        const bounds = this._getLayerPanelCardThumbnailBounds();
        const { width: maxWidth, height: maxHeight } = this._calculateLayerThumbnailSize(
            bounds.width,
            bounds.height
        );

        const thumbnailContainer = this._createLayerThumbnailContainer(index, {
            width: maxWidth,
            height: maxHeight
        });

        // [指示書] キャッシュがあれば即時表示
        if (window.thumbnailSystem && layer.layerData?.id) {
            const cachedUrl = window.thumbnailSystem.getThumbnail(layer.layerData.id);
            if (cachedUrl) {
                const img = this._createLayerThumbnailImage();
                img.src = cachedUrl;
                this._appendLayerPanelCardParts(thumbnailContainer, img);
                return thumbnailContainer;
            }
        }

        // キャッシュがない場合は非同期で生成
        return thumbnailContainer;
    }

    _createLayerThumbnailContainer(index, { extraClasses = [], width = 40, height = 32, isFolder = false, isCollapsed = false } = {}) {
        return this._createLayerPanelCardThumbnailElement('', {
            extraClasses: ['layer-thumbnail', ...extraClasses],
            size: { width, height },
            attributes: { 'data-layer-index': index },
            includeLegacyVars: true,
            isFolder,
            isCollapsed
        });
    }

    _getLayerPanelCardThumbnailBounds() {
        return { width: 40, height: 32 };
    }

    _createLayerPanelCardThumbnailElement(variant, {
        extraClasses = [],
        size = {},
        attributes = {},
        includeLegacyVars = false,
        isFolder = false,
        isCollapsed = false
    } = {}) {
        const stateClasses = this._createLayerPanelCardThumbnailStateClasses({ isFolder, isCollapsed });
        return this._createLayerPanelCardPartElement(variant, 'thumb', {
            extraClasses: [...extraClasses, ...stateClasses],
            attributes,
            styleVars: this._createLayerPanelCardThumbnailStyleVars(size, { includeLegacyVars })
        });
    }

    _createLayerThumbnailImage(src = '', { extraClasses = [] } = {}) {
        const img = document.createElement('img');
        img.className = ['layer-panel-card-thumb-image', 'layer-thumbnail-image', ...extraClasses].filter(Boolean).join(' ');
        if (src) {
            img.src = src;
        }
        return img;
    }

    _createLayerThumbnailImageHtml(src = '', { className = '', alt = '' } = {}) {
        if (!src) return '';
        const imageClassName = ['layer-panel-card-thumb-image', className].filter(Boolean).join(' ');
        const attributeHtml = this._createLayerPanelDataAttributes({
            src,
            alt,
            class: imageClassName
        });
        return `<img ${attributeHtml}>`;
    }

    _calculateLayerThumbnailSize(maxWidth = 40, maxHeight = 32) {
        const canvasWidth = this.layerSystem?.config?.canvas?.width
            || window.TEGAKI_CONFIG?.canvas?.width
            || 800;
        const canvasHeight = this.layerSystem?.config?.canvas?.height
            || window.TEGAKI_CONFIG?.canvas?.height
            || 600;
        const canvasAspect = canvasHeight > 0 ? canvasWidth / canvasHeight : 1;
        const thumbAspect = maxHeight > 0 ? maxWidth / maxHeight : 1;

        let width = maxWidth;
        let height = maxHeight;
        if (canvasAspect > thumbAspect) {
            height = Math.round(maxWidth / canvasAspect);
        } else {
            width = Math.round(maxHeight * canvasAspect);
        }

        return {
            width: Math.max(1, Math.min(maxWidth, width)),
            height: Math.max(1, Math.min(maxHeight, height))
        };
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
        input.className = `layer-panel-inline-name-input ${nameSpan.className || ''}`.trim();

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
        input.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
        });
        input.addEventListener('dblclick', (e) => {
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

    _beginLayerAttributeOpacityEdit(layerIndex) {
        const animationTarget = this._getAnimationAttributeTarget?.();
        if (!animationTarget?.animationTable?._captureInternalLayerHistoryState) {
            this._attributeOpacityEditState = null;
            return;
        }

        const existing = this._attributeOpacityEditState;
        if (
            existing?.assetId === animationTarget.asset.id &&
            existing?.layerId === animationTarget.internalLayer.id
        ) {
            return;
        }

        this._attributeOpacityEditState = {
            layerIndex,
            assetId: animationTarget.asset.id,
            layerId: animationTarget.internalLayer.id,
            initialOpacity: animationTarget.internalLayer.opacity ?? 1,
            beforeState: animationTarget.animationTable._captureInternalLayerHistoryState(animationTarget.asset)
        };
    }

    _commitLayerAttributeOpacityEdit(layerIndex, opacity) {
        const animationTarget = this._getAnimationAttributeTarget?.();
        const editState = this._attributeOpacityEditState;
        if (
            animationTarget?.animationTable?.setInternalLayerAttributesFromExternal &&
            editState?.assetId === animationTarget.asset.id &&
            editState?.layerId === animationTarget.internalLayer.id
        ) {
            const nextOpacity = Math.max(0, Math.min(1, opacity));
            if (Math.abs((editState.initialOpacity ?? 1) - nextOpacity) > 0.0001) {
                animationTarget.animationTable.setInternalLayerAttributesFromExternal(
                    animationTarget.asset.id,
                    animationTarget.internalLayer.id,
                    { opacity: nextOpacity },
                    {
                        source: 'layer-attribute-popup-opacity-commit',
                        historyName: 'caf-internal-layer-opacity',
                        beforeState: editState.beforeState,
                        forceHistory: true
                    }
                );
            }
            this._attributeOpacityEditState = null;
            return;
        }

        this._setLayerOpacity(layerIndex, opacity);
        this._attributeOpacityEditState = null;
    }

    _setLayerOpacity(layerIndex, opacity, options = {}) {
        const animationTarget = this._getAnimationAttributeTarget?.();
        if (animationTarget?.animationTable?.setInternalLayerAttributesFromExternal) {
            animationTarget.animationTable.setInternalLayerAttributesFromExternal(
                animationTarget.asset.id,
                animationTarget.internalLayer.id,
                { opacity },
                {
                    source: 'layer-attribute-popup-opacity',
                    recordHistory: options.recordHistory !== false
                }
            );
            return;
        } else if (this.layerSystem.setLayerOpacity) {
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

    _handleLayerPanelKeydown(e) {
        if (e.key !== 'F2') return;
        const target = e.target;
        if (target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
        if (this._editingLayerIndex >= 0) return;

        const animationTarget = this._getAnimationAttributeTarget?.();
        const animationAssetId = animationTarget?.asset?.id;
        if (animationTarget?.animationTable && animationAssetId && animationTarget?.internalLayer?.id) {
            const variant = this._getLayerPanelCardVariantConfig('clip-layer-mirror');
            const mirrorName = this.container?.querySelector(
                `${variant.rowSelector}[data-asset-id="${CSS.escape(animationAssetId)}"]` +
                `[data-internal-layer-id="${CSS.escape(animationTarget.internalLayer.id)}"] ${variant.nameSelector}`
            );
            if (mirrorName) {
                e.preventDefault();
                e.stopPropagation();
                this._editClipLayerMirrorName(mirrorName, { source: 'layer-panel-clip-layer-mirror-f2' });
                return;
            }
        }
        if (this._hasAnimationContext()) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

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

    _applyLegacyLayerCardDropFromPointer(dropPayload = {}) {
        if (!this.layerSystem?.reorderLayers) {
            this.requestUpdate();
            return false;
        }

        const dropTarget = this._resolveLegacyLayerCardDropTarget(dropPayload);
        if (!this._isLegacyLayerCardDropTargetReady(dropTarget)) {
            this.requestUpdate();
            return false;
        }

        const { draggedLayer } = dropTarget;
        if (!draggedLayer || draggedLayer.layerData?.isBackground) {
            this.requestUpdate();
            return false;
        }

        if (this._getLayerPanelCardAdapter('legacy-layer-card').move(dropTarget)) {
            return true;
        }

        this.requestUpdate();
        return false;
    }

    _resolveLegacyLayerCardDropTarget({ drag, targetRow, placement } = {}) {
        const layers = this.layerSystem?.getLayers?.() || [];
        const oldIndex = parseInt(drag?.row?.dataset?.layerIndex, 10);
        const targetIndex = parseInt(targetRow?.dataset?.layerIndex, 10);
        if (Number.isNaN(oldIndex) || Number.isNaN(targetIndex)) return null;
        const normalizedPlacement = placement || null;

        return {
            oldIndex,
            targetIndex,
            draggedLayer: layers[oldIndex] || null,
            targetLayer: layers[targetIndex] || null,
            draggedParentId: this._getLegacyLayerCardDropParentId(layers[oldIndex]),
            targetParentId: this._getLegacyLayerCardDropParentId(layers[targetIndex]),
            placement: normalizedPlacement,
            isInsideDrop: normalizedPlacement === 'inside',
            isPositionDrop: this._isLegacyLayerCardPositionDrop(normalizedPlacement)
        };
    }

    _getLegacyLayerCardDropParentId(layer) {
        return layer?.layerData?.parentId || null;
    }

    _isLegacyLayerCardDropTargetReady(dropTarget) {
        if (!dropTarget) return false;
        if (dropTarget.oldIndex === dropTarget.targetIndex) return false;
        return !!dropTarget.placement;
    }

    _applyLegacyLayerCardDropOperation(dropTarget) {
        return (
            this._applyLegacyLayerCardDropIntoFolder(dropTarget) ||
            this._applyLegacyLayerCardMoveIntoTargetFolderPosition(dropTarget) ||
            this._applyLegacyLayerCardReorderInsideSameFolder(dropTarget) ||
            this._applyLegacyLayerCardReorderDrop(dropTarget)
        );
    }

    _applyLegacyLayerCardDropIntoFolder({ draggedLayer, targetLayer, isInsideDrop } = {}) {
        if (!isInsideDrop) return false;
        if (!this.layerSystem?.moveLayerIntoFolder) return false;
        if (!this._canDropIntoFolder(draggedLayer, targetLayer)) return false;

        this.layerSystem.moveLayerIntoFolder(draggedLayer.layerData?.id, targetLayer.layerData?.id);
        return true;
    }

    _applyLegacyLayerCardMoveIntoTargetFolderPosition(dropTarget = {}) {
        if (!this._isLegacyLayerCardMoveIntoTargetFolderPosition(dropTarget)) return false;
        if (!this.layerSystem?.moveLayerNearLayerInFolder) return false;

        const { draggedLayer, targetLayer, placement } = dropTarget;
        return this.layerSystem.moveLayerNearLayerInFolder(
            draggedLayer.layerData?.id,
            targetLayer.layerData?.id,
            placement
        ) === true;
    }

    _isLegacyLayerCardMoveIntoTargetFolderPosition({ draggedParentId, targetParentId, isPositionDrop } = {}) {
        return !!targetParentId &&
            draggedParentId !== targetParentId &&
            isPositionDrop;
    }

    _applyLegacyLayerCardReorderInsideSameFolder(dropTarget = {}) {
        if (!this._isLegacyLayerCardSameFolderDrop(dropTarget)) return false;
        return this._applyLegacyLayerCardReorderDrop(dropTarget);
    }

    _isLegacyLayerCardSameFolderDrop({ draggedParentId, targetParentId, isPositionDrop } = {}) {
        return !!draggedParentId &&
            draggedParentId === targetParentId &&
            isPositionDrop;
    }

    _isLegacyLayerCardPositionDrop(placement) {
        return placement === 'before' || placement === 'after';
    }

    _applyLegacyLayerCardReorderDrop({ oldIndex, targetIndex, placement } = {}) {
        if (!this.layerSystem?.reorderLayers) return false;

        const newIndex = this._resolveLayerIndexFromPointerDrop(oldIndex, targetIndex, placement);
        if (newIndex === null || newIndex === oldIndex) return false;

        this.layerSystem.reorderLayers(oldIndex, newIndex);
        return true;
    }

    _applyClipLayerMirrorCardDropFromPointer(dropPayload = {}) {
        return this._getLayerPanelCardAdapter('clip-layer-mirror').move(
            this._resolveClipLayerMirrorDropTarget(dropPayload)
        );
    }

    _resolveClipLayerMirrorDropTarget({ drag, targetRow, placement, assetId, layerId } = {}) {
        return {
            sourceAssetId: assetId || drag?.assetId || '',
            sourceLayerId: layerId || drag?.layerId || '',
            targetLayerId: targetRow?.dataset.internalLayerId || '',
            placement: placement || null
        };
    }

    _resolveLayerIndexFromPointerDrop(oldIndex, targetIndex, placement) {
        if (!this._isLegacyLayerCardPositionDrop(placement)) return null;
        if (Number.isNaN(oldIndex) || Number.isNaN(targetIndex)) return null;
        const layers = this.layerSystem?.getLayers?.() || [];
        if (targetIndex < 0 || targetIndex >= layers.length) return null;

        // 画面上のbeforeは配列上では対象の上、afterは対象の下。
        let newIndex = placement === 'before' ? targetIndex + 1 : targetIndex;
        if (oldIndex < newIndex) {
            newIndex -= 1;
        }
        return Math.max(0, Math.min(layers.length - 1, newIndex));
    }

    _canDropIntoFolder(layer, folder) {
        if (this.layerSystem?.canPlaceLayerInFolder) {
            return this.layerSystem.canPlaceLayerInFolder(
                layer?.layerData?.id,
                folder?.layerData?.id
            );
        }
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

        const treeOptions = this._getFrameAssetTreeOptionsForAnimationScope(animationTable);
        const tree = animationTable.model.getFrameAssetTree(undefined, treeOptions);
        if (!tree || tree.groups.length === 0) return null;

        const header = document.createElement('div');
        header.className = 'caf-simple-header';

        const selectedCelId = animationTable.selectedCelId;

        tree.groups.forEach((group, groupIndex) => {
            const folderName = group.folderName === 'Uncategorized' ? `CAF${groupIndex + 1}` : group.folderName;
            const firstClip = group.clips[0];
            const selectedClipEntry = group.clips.find(clip => clip.clipId === selectedCelId) || null;
            const primaryClipEntry = selectedClipEntry || firstClip;
            const isExpanded = !this._collapsedCafClipIds.has(firstClip?.clipId)
                && (!!selectedClipEntry || this._expandedCafClipIds.has(firstClip?.clipId));
            const groupStateClasses = this._createLayerPanelStateClassNames({
                'is-selected': selectedClipEntry,
                'is-expanded': isExpanded,
                'is-collapsed': !isExpanded
            });
            const laneLabel = primaryClipEntry?.laneName || (Number.isInteger(primaryClipEntry?.laneIndex) ? `Lane ${primaryClipEntry.laneIndex + 1}` : '');
            const clipEntry = primaryClipEntry?.clipId ? animationTable.model.findClipEntry(primaryClipEntry.clipId) : null;
            const isClipVisible = clipEntry?.clip?.visible !== false;
            const toggleButtonHtml = this._createCafHeaderToggleButtonHtml({
                clipId: firstClip?.clipId || '',
                isExpanded
            });
            const visibilityButtonHtml = this._createCafHeaderVisibilityButtonHtml({
                clipId: primaryClipEntry?.clipId || '',
                isVisible: isClipVisible
            });
            const mirrorClipEntry = primaryClipEntry;
            const mirrorAsset = mirrorClipEntry?.assetId
                ? animationTable.model.getClipAsset(mirrorClipEntry.assetId)
                : null;
            const folderNameHtml = this._createCafHeaderTextHtml('caf-simple-name', folderName, {
                'data-folder-id': group.folderId || ''
            });
            const laneNameHtml = this._createCafHeaderTextHtml('caf-simple-lane', laneLabel, {
                'data-lane-id': primaryClipEntry?.laneId || ''
            });
            let groupContent = this._createCafHeaderGroupTitleHtml({
                className: this._createLayerPanelClassName('caf-simple-group-title', groupStateClasses),
                clipId: primaryClipEntry?.clipId || '',
                assetId: primaryClipEntry?.assetId || '',
                content: `
                    ${toggleButtonHtml}
                    ${folderNameHtml}
                    ${laneNameHtml}
                    ${visibilityButtonHtml}
                `
            });

            group.clips.forEach(clipEntry => {
                const isSelected = selectedCelId === clipEntry.clipId;
                const isClipVisible = clipEntry.visible !== false;
                const assetClassName = this._createLayerPanelClassName(
                    'caf-simple-asset',
                    this._createLayerPanelStateClassNames({
                        'is-selected': isSelected,
                        'is-hidden': !isClipVisible
                    })
                );
                groupContent += this._createCafHeaderAssetHtml({
                    className: assetClassName,
                    clipId: clipEntry.clipId,
                    assetId: clipEntry.assetId,
                    assetName: clipEntry.assetName
                });
            });

            const groupElement = this._createLayerPanelCardPart('div', this._createLayerPanelClassName(
                'caf-simple-group',
                groupStateClasses
            ));
            groupElement.innerHTML = groupContent;
            if (isExpanded && mirrorAsset) {
                groupElement.appendChild(
                    this._createClipAssetLayerMirrorElement(mirrorAsset, animationTable)
                );
            }
            header.appendChild(groupElement);
        });

        return header;
    }

    /*
     * CAFヘッダーは当面HTMLテンプレートを維持するが、内部Layer/Folderカードは
     * _createClipAssetLayerMirrorElement() から共通DOM rendererへ接続する。
     */
    _createCafHeaderTextHtml(className, text, extraAttributes = {}) {
        return this._createLayerPanelElementHtml({
            tagName: 'span',
            className,
            extraAttributes,
            content: this._escapeHtml(text || '')
        });
    }

    _createCafHeaderToggleButtonHtml({ clipId = '', isExpanded = false } = {}) {
        const title = isExpanded ? 'CAFを閉じる' : 'CAFを開く';
        return this._createLayerPanelIconButtonHtml({
            className: 'caf-simple-toggle-btn',
            baseClass: 'caf-simple-icon',
            iconName: isExpanded ? 'folderOpen' : 'folder',
            title,
            ariaLabel: title,
            dataAttributes: {
                'data-clip-id': clipId || ''
            },
            extraAttributes: {
                'aria-expanded': isExpanded ? 'true' : 'false'
            }
        });
    }

    _createCafHeaderVisibilityButtonHtml({ clipId = '', isVisible = true } = {}) {
        return this._createLayerPanelIconButtonHtml({
            className: this._createLayerPanelClassName(
                'caf-simple-visibility-btn',
                this._createLayerPanelStateClassNames({ 'is-hidden': !isVisible })
            ),
            iconName: isVisible ? 'eye' : 'eyeOff',
            fallbackIconName: 'eye',
            title: 'CAF Clipの表示/非表示',
            dataAttributes: {
                'data-clip-id': clipId || ''
            }
        });
    }

    _createCafHeaderGroupTitleHtml({ className = 'caf-simple-group-title', clipId = '', assetId = '', content = '' } = {}) {
        return this._createLayerPanelElementHtml({
            tagName: 'div',
            className,
            extraAttributes: {
                'data-clip-id': clipId || '',
                'data-asset-id': assetId || '',
                title: 'CAF Clipを選択'
            },
            content
        });
    }

    _createCafHeaderAssetHtml({ className = 'caf-simple-asset', clipId = '', assetId = '', assetName = '' } = {}) {
        return this._createLayerPanelElementHtml({
            tagName: 'div',
            className,
            extraAttributes: {
                'data-clip-id': clipId || '',
                'data-asset-id': assetId || '',
                title: 'Click to select clip in Timeline'
            },
            content: this._escapeHtml(assetName || '')
        });
    }

    _getFrameAssetTreeOptionsForAnimationScope(animationTable) {
        if (!animationTable) return {};
        if (animationTable.playbackScope === 'activeLane') {
            return animationTable.activeLaneId ? { laneIds: [animationTable.activeLaneId] } : { laneIds: [] };
        }
        if (animationTable.playbackScope === 'includedLanes') {
            const validLaneIds = new Set(
                (animationTable.model?.tracks || [])
                    .filter(track => track && !track.isBackground && track.type !== 'folder')
                    .map(track => track.id)
            );
            const laneIds = [...(animationTable.includedLaneIds || [])].filter(laneId => validLaneIds.has(laneId));
            return laneIds.length > 0 ? { laneIds } : {};
        }
        return {};
    }

    _snapshotToDataUrl(snapshot) {
        if (!snapshot?.pixels || !snapshot.width || !snapshot.height) return '';
        if (snapshot.isBlank === true) return '';
        const cacheKey = `${snapshot.id || 'snapshot'}:${snapshot.updatedAt || 0}:${snapshot.width}x${snapshot.height}`;
        const cachedUrl = this._clipSnapshotThumbCache.get(cacheKey);
        if (cachedUrl) return cachedUrl;

        try {
            const canvas = document.createElement('canvas');
            canvas.width = snapshot.width;
            canvas.height = snapshot.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return '';
            ctx.putImageData(new ImageData(new Uint8ClampedArray(snapshot.pixels), snapshot.width, snapshot.height), 0, 0);
            const dataUrl = canvas.toDataURL('image/png');
            this._clipSnapshotThumbCache.set(cacheKey, dataUrl);
            if (this._clipSnapshotThumbCache.size > 240) {
                const oldestKey = this._clipSnapshotThumbCache.keys().next().value;
                if (oldestKey) this._clipSnapshotThumbCache.delete(oldestKey);
            }
            return dataUrl;
        } catch (e) {
            return '';
        }
    }

    /**
     * 選択中の ClipAsset を解決するヘルパー (Phase 4z17)
     */
    _getSelectedClipAssetForLayerPanel() {
        const animationTable = window.PopupManager?.get?.('animationTable');
        if (!animationTable || !animationTable.model) return null;

        // 1. 選択中Clipから解決
        if (animationTable.selectedCelId) {
            const entry = animationTable.model.findClipEntry(animationTable.selectedCelId);
            if (entry?.clip?.assetId) {
                return animationTable.model.getClipAsset(entry.clip.assetId);
            }
        }

        return null;
    }

    _createClipAssetLayerMirrorElement(asset, animationTable) {
        const selectedInternalLayerId = animationTable.selectedInternalLayerId;
        const thumbnailBounds = this._getLayerPanelCardThumbnailBounds();
        const mirrorThumbSize = this._calculateLayerThumbnailSize(
            thumbnailBounds.width,
            thumbnailBounds.height
        );

        const group = this._createLayerPanelCardPart('div', 'layer-panel-card-group clip-layer-mirror');
        const list = this._createLayerPanelCardPart('div', 'layer-panel-card-list clip-layer-mirror-list');
        group.appendChild(list);

        if (asset.internalLayers.length === 0) {
            const empty = this._createLayerPanelCardPart(
                'div',
                'layer-panel-card-empty clip-layer-mirror-empty'
            );
            empty.textContent = 'No internal layers';
            list.appendChild(empty);
        } else {
            const internalLayerDepths = this._getClipAssetInternalLayerDepths(asset);
            const hiddenByCollapsedFolderIds = this._getHiddenClipAssetInternalLayerIds(asset);
            // Inspectorと同じ表示順（先頭が前面）
            asset.internalLayers.forEach(layer => {
                if (hiddenByCollapsedFolderIds.has(layer.id)) return;
                list.appendChild(
                    this._createClipLayerMirrorCardElement(
                    this._createClipLayerMirrorCardOptions({
                        asset,
                        layer,
                        animationTable,
                        selectedInternalLayerId,
                        internalLayerDepths,
                        thumbnailSize: mirrorThumbSize
                    })
                    )
                );
            });
        }

        return group;
    }

    _createClipLayerMirrorCardOptions({
        asset,
        layer,
        animationTable,
        selectedInternalLayerId = '',
        internalLayerDepths = new Map(),
        thumbnailSize = this._getLayerPanelCardThumbnailBounds()
    } = {}) {
        const isSelected = selectedInternalLayerId === layer?.id;
        const isVisible = layer?.visible !== false;
        const isFolder = layer?.type === 'folder';
        const isCollapsed = isFolder && this._isClipInternalFolderCollapsed(asset?.id, layer?.id);
        const snapshot = isFolder ? null : animationTable?.model?.getDrawingSnapshot?.(layer?.drawingSnapshotId);
        const thumbUrl = this._snapshotToDataUrl(snapshot);
        return {
            variant: 'clip-layer-mirror',
            assetId: asset?.id || '',
            layerId: layer?.id || '',
            depth: internalLayerDepths.get(layer?.id) || 0,
            name: layer?.name || '',
            metaLabel: isFolder ? 'Folder' : `${Math.round((layer?.opacity ?? 1) * 100)}%`,
            thumbnailSize,
            thumbnailHtml: isFolder
                ? (isCollapsed ? UI_ICONS.folder : UI_ICONS.folderOpen)
                : this._createLayerThumbnailImageHtml(thumbUrl),
            isSelected,
            isHidden: !this._isClipAssetInternalLayerEffectivelyVisible(asset, layer),
            isFolder,
            hasParent: !!layer?.parentLayerId,
            isCollapsed,
            isClipping: layer?.clipping === true,
            visibilityIconName: isVisible ? 'eye' : 'eyeOff',
            clipTitle: 'クリッピング',
            visibilityTitle: '内部レイヤーの表示/非表示'
        };
    }

    _createClipLayerMirrorCardElement(options = {}) {
        const rowModel = this._createClipLayerMirrorCardRowModel(options);
        const card = this._createLayerPanelCardRowElement(rowModel);
        this._populateLayerPanelCardElement(
            card,
            this._createClipLayerMirrorCardElementParts(rowModel.variant, options)
        );
        return card;
    }

    _createClipLayerMirrorCardElementParts(variant, options = {}) {
        const thumbnail = this._createLayerPanelCardThumbnailElement(variant, {
            size: options.thumbnailSize || this._getLayerPanelCardThumbnailBounds(),
            isFolder: options.isFolder,
            isCollapsed: options.isCollapsed
        });
        thumbnail.innerHTML = options.thumbnailHtml || '';

        const meta = this._createLayerPanelCardPartElement(variant, 'meta', {
            extraClasses: [`${variant}-opacity`]
        });
        meta.textContent = options.metaLabel || '';
        const name = this._createLayerPanelCardNameElement(variant, {
            text: options.name || ''
        });
        const details = this._createLayerPanelCardDetailsElement(variant, {
            metaElement: meta,
            nameElement: name
        });

        return this._createLayerPanelCardContentParts({
            childLine: options.hasParent ? this._createLayerPanelCardChildLineElement() : null,
            thumbnail,
            details,
            actions: [
                this._createLayerPanelCardActionButtonElement(variant, 'clip', {
                    extraClasses: this._createLayerPanelClassName(
                        `${variant}-clip-btn`,
                        this._createLayerPanelStateClassNames({ 'is-clipping': options.isClipping })
                    ),
                    iconName: 'paperclip',
                    title: options.clipTitle || 'クリッピング',
                    dataAttributes: {
                        'data-internal-layer-id': options.layerId || '',
                        'data-asset-id': options.assetId || ''
                    }
                }),
                this._createLayerPanelCardActionButtonElement(variant, 'visibility', {
                    extraClasses: this._createLayerPanelClassName(
                        `${variant}-visibility-btn`,
                        this._createLayerPanelStateClassNames({ 'is-hidden': options.isHidden })
                    ),
                    iconName: options.visibilityIconName || 'eye',
                    fallbackIconName: 'eye',
                    title: options.visibilityTitle || '表示/非表示',
                    dataAttributes: {
                        'data-internal-layer-id': options.layerId || '',
                        'data-asset-id': options.assetId || ''
                    }
                })
            ]
        });
    }

    _createClipLayerMirrorCardRowModel(options = {}) {
        const variant = this._getLayerPanelCardVariantConfig(options.variant || 'clip-layer-mirror').name;
        const depth = Number.isInteger(options.depth) ? options.depth : 0;
        return this._createLayerPanelCardRowModelFromOptions(variant, {
            classOptions: this._createClipLayerMirrorCardClassOptions(options, depth),
            dataOptions: this._createClipLayerMirrorCardDataOptions(variant, options, depth)
        });
    }

    _createLayerPanelCardRowModelFromOptions(variant, {
        classOptions = {},
        dataOptions = {},
        styleVars = {}
    } = {}) {
        return this._createLayerPanelCardRowModel(variant, {
            classOptions,
            dataOptions,
            styleVars
        });
    }

    _createClipLayerMirrorCardClassOptions(options = {}, depth = 0) {
        return this._createLayerPanelCardBaseClassOptions({
            isSelected: options.isSelected,
            isHidden: options.isHidden,
            isFolder: options.isFolder,
            isCollapsed: options.isCollapsed,
            depth
        });
    }

    _createClipLayerMirrorCardDataOptions(variant, options = {}, depth = 0) {
        return this._createLayerPanelCardBaseDataOptions({
            cardKind: variant,
            assetId: options.assetId || '',
            layerId: options.layerId || '',
            internalLayerId: options.layerId || '',
            depth,
            isFolder: options.isFolder
        });
    }

    _createLayerPanelCardBaseClassOptions({
        isActive = false,
        isSelected = false,
        isHidden = false,
        isFolder = false,
        isCollapsed = false,
        depth,
        extraClasses = []
    } = {}) {
        return {
            isActive,
            isSelected,
            isHidden,
            isFolder,
            isCollapsed,
            depth,
            extraClasses
        };
    }

    _createLayerPanelCardBaseDataOptions({
        cardKind = '',
        assetId = '',
        layerId = '',
        internalLayerId = '',
        layerIndex,
        depth,
        isFolder = false,
        isBackground = false
    } = {}) {
        return {
            cardKind,
            assetId,
            layerId,
            internalLayerId,
            layerIndex,
            depth,
            isFolder,
            isBackground
        };
    }

    _createLayerPanelCardThumbnailStateClasses({ isFolder = false, isCollapsed = false } = {}) {
        return isFolder
            ? ['layer-panel-card-thumb--folder', isCollapsed ? 'is-collapsed' : 'is-expanded']
            : [];
    }

    _createLayerPanelCardDetailsParts({ metaElement = null, nameElement = null } = {}) {
        return [metaElement, nameElement].filter(Boolean);
    }

    _createLayerPanelCardThumbnailStyleVars(size = {}, { includeLegacyVars = false } = {}) {
        const width = Number.isFinite(size.width) ? `${Math.max(1, size.width)}px` : '';
        const height = Number.isFinite(size.height) ? `${Math.max(1, size.height)}px` : '';
        return {
            '--card-thumb-width': width,
            '--card-thumb-height': height,
            '--legacy-thumb-width': includeLegacyVars ? width : '',
            '--legacy-thumb-height': includeLegacyVars ? height : ''
        };
    }

    _createLayerPanelElementHtml({
        tagName = 'span',
        className = '',
        rawAttributes = '',
        extraAttributes = {},
        content = ''
    } = {}) {
        const safeTagName = this._resolveLayerPanelTagName(tagName, 'span');
        const attributeHtml = this._createLayerPanelDataAttributes(extraAttributes);
        const extraAttributeHtml = attributeHtml ? ` ${attributeHtml}` : '';
        const rawAttributeHtml = rawAttributes ? ` ${rawAttributes}` : '';
        return `<${safeTagName} class="${this._escapeHtml(className)}"${rawAttributeHtml}${extraAttributeHtml}>${content}</${safeTagName}>`;
    }

    _createLayerPanelIconButtonHtml({
        tagName = 'button',
        className = '',
        baseClass = 'ui-icon-button ui-icon-button--small',
        iconName = 'eye',
        fallbackIconName = '',
        title = '',
        ariaLabel = '',
        dataAttributes = {},
        extraAttributes = {}
    } = {}) {
        const buttonModel = this._createLayerPanelIconButtonModel({
            tagName,
            fallbackTagName: 'button',
            className,
            baseClass,
            iconName,
            fallbackIconName,
            title,
            ariaLabel,
            dataAttributes,
            extraAttributes
        });
        return this._createLayerPanelButtonHtmlFromModel(buttonModel);
    }

    _createLayerPanelButtonHtmlFromModel(buttonModel = {}) {
        const tagName = buttonModel.tagName || 'button';
        const className = buttonModel.className || '';
        const iconHtml = buttonModel.iconHtml || '';
        const attributeHtml = this._createLayerPanelDataAttributes(buttonModel.attributes || {});
        const extraAttributeHtml = attributeHtml ? ` ${attributeHtml}` : '';
        return `
            <${tagName} class="${this._escapeHtml(className)}"${extraAttributeHtml}>
                ${iconHtml}
            </${tagName}>
        `;
    }

    _getClipAssetInternalLayerDepths(asset) {
        const depths = new Map();
        const byId = new Map((asset?.internalLayers || []).map(layer => [layer.id, layer]));

        (asset?.internalLayers || []).forEach(layer => {
            let depth = 0;
            let parentId = layer.parentLayerId || null;
            const visited = new Set();

            while (parentId && !visited.has(parentId) && depth < 4) {
                visited.add(parentId);
                const parent = byId.get(parentId);
                if (!parent) break;
                depth += 1;
                parentId = parent.parentLayerId || null;
            }

            depths.set(layer.id, Math.min(depth, 4));
        });

        return depths;
    }

    _getHiddenClipAssetInternalLayerIds(asset) {
        const hiddenIds = new Set();
        const byId = new Map((asset?.internalLayers || []).map(layer => [layer.id, layer]));

        (asset?.internalLayers || []).forEach(layer => {
            let parentId = layer.parentLayerId || null;
            const visited = new Set();

            while (parentId && !visited.has(parentId)) {
                visited.add(parentId);
                const parent = byId.get(parentId);
                if (!parent) break;
                if (parent.type === 'folder' && this._isClipInternalFolderCollapsed(asset.id, parent.id)) {
                    hiddenIds.add(layer.id);
                    break;
                }
                parentId = parent.parentLayerId || null;
            }
        });

        return hiddenIds;
    }

    _isClipAssetInternalLayerEffectivelyVisible(asset, layer) {
        if (!asset || !layer || layer.visible === false) return false;

        const byId = new Map((asset.internalLayers || []).map(item => [item.id, item]));
        let parentId = layer.parentLayerId || null;
        const visited = new Set();

        while (parentId && !visited.has(parentId)) {
            visited.add(parentId);
            const parent = byId.get(parentId);
            if (!parent) break;
            if (parent.visible === false) return false;
            parentId = parent.parentLayerId || null;
        }

        return true;
    }

    /**
     * 選択中アセットの内部レイヤー一覧ミラーを表示する (Phase 4z17)
     */
    createSelectedClipAssetLayerMirror() {
        const asset = this._getSelectedClipAssetForLayerPanel();
        if (!asset) return null;

        const animationTable = window.PopupManager?.get?.('animationTable');
        if (!animationTable || !animationTable.model) return null;

        return this._createClipAssetLayerMirrorElement(asset, animationTable);
    }

    destroy() {
        if (this._updateTimeout) {
            clearTimeout(this._updateTimeout);
        }
        document.removeEventListener('keydown', this._handleLayerPanelKeydown, true);
        this._hideLayerAttributePopup();
        this._layerAttributePopup?.remove();
        this._layerAttributePopup = null;
        this._editingLayerIndex = -1;
        this._editingInput = null;
        this._clipSnapshotThumbCache.clear();
    }
}

// 下位互換性のためにグローバルに登録
window.LayerPanelRenderer = LayerPanelRenderer;
