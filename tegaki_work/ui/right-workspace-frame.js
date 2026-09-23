/**
 * ROLE: Single right workspace geometry, visibility and focus projection.
 * AUTHORITY: The Transform panel `show` class owns Transform sessions; the
 * runtime-only RIG lens is a view projection. LayerPanelRenderer supplies CAF
 * selection and RIG status. No edit, selection, or persistence state is owned.
 * INVARIANTS: Mount once before gestures; retain one Transform DOM; measure the
 * existing Drawing grid (including rail/scroll gutter), never add width.
 * RELATED: dom-builder.js, layer-panel-renderer.js, layer-transform.js.
 */
import { isTransformTimelineKeyTarget } from '../system/animation/transform-edit-transaction.js';
import { resolveBoneRotationHandleDrag } from '../system/animation/part-rig.js';
import { rigPivotOverlay } from './rig-pivot-overlay.js';

export class RightWorkspaceFrame {
    constructor(container, getTarget, layerSystem) {
        this.root = container?.closest?.('.right-panel');
        this.drawing = this.root?.querySelector('.layer-panel-container');
        this.host = this.root?.querySelector('#layer-panel-context-inspector');
        this.panel = document.getElementById('layer-transform-panel');
        this.getTarget = getTarget;
        this.layerSystem = layerSystem;
        this.rigLensActive = false;
        this.rigLensTarget = null;
        this.rigLensReturnMode = 'basic';
        this.rigEntryMessage = '';
        this.lastRigTargetKey = null;
        this.rigPlacementMode = null;
        this.rigSelectedBoneId = null;
        this.rigLensMode = 'setup';
        this.rigAuthoringKind = 'deform';
        this.rigSelectedPartId = null;
        this.rigPointerGesture = null;
        this.rigOverlay = null;
        this.rigOverlayFrame = null;
        this.eventBus = this.layerSystem?.eventBus || window.TegakiEventBus;
        this.statusPanel = document.querySelector('.status-panel');
        this.statusAnchor = null;
        this.dock = document.getElementById('animation-table-popup');
        this._popupShownHandler = null;
        this._popupHiddenHandler = null;
        this._dockStateHandler = null;
        if (!this.root || !this.drawing || !this.host || !this.panel) return;

        this.root.classList.add('right-workspace-frame');
        this._mountModeSwitch();
        this._mountStatusPanel();
        this._subscribeLayoutEvents();
        this.host.setAttribute('aria-label', 'Transform 作業面');
        this.title = document.createElement('div');
        this.title.className = 'right-workspace-target';
        this.title.tabIndex = -1;
        this.thumbnail = document.createElement('img');
        this.thumbnail.alt = '';
        this.label = document.createElement('span');
        this.title.append(this.thumbnail, this.label);
        this.actions = this.panel.querySelector('.transform-popup-actions');
        this.heading = this.panel.querySelector('.transform-popup-heading');
        this.endButton = document.createElement('button');
        this.endButton.type = 'button';
        this.endButton.className = 'gui-control gui-control--s transform-terminal-btn transform-terminal-confirm';
        this.endButton.textContent = '✓';
        this.endButton.title = 'Transformを確定して終了（V）';
        this.endButton.setAttribute('aria-keyshortcuts', 'V');
        this.endButton.addEventListener('click', () => {
            window.KeyboardHandler?.toggleLayerTransform?.('right-workspace');
        });
        this.cancelButton = document.createElement('button');
        this.cancelButton.type = 'button';
        this.cancelButton.className = 'gui-control gui-control--s transform-terminal-btn transform-terminal-cancel';
        this.cancelButton.textContent = '×';
        this.cancelButton.title = 'Transformを取り消して終了（Esc）';
        this.cancelButton.setAttribute('aria-keyshortcuts', 'Escape');
        this.cancelButton.addEventListener('click', () => {
            // Same capture rescue and event payload as the existing Escape route.
            const selection = window.pixelSelectionSystem || window.drawingApp?.pixelSelectionSystem;
            if (selection?.isTransformPreviewCaptureActive?.()) {
                selection.exitTransformPreviewCapture({ cancelSourceTransform: true });
            }
            this.layerSystem?.eventBus?.emit('keyboard:vkey-state-changed', {
                pressed: false, cancelled: true
            });
        });
        this.selectionHint = document.createElement('span');
        this.selectionHint.className = 'transform-selection-hint';
        this.selectionHint.textContent = '選択変形：既存の確定／取消操作';
        this.actions?.append(this.endButton, this.cancelButton);
        this.heading?.appendChild(this.selectionHint);

        this.rigEntryRow = document.createElement('div');
        this.rigEntryRow.className = 'right-workspace-rig-entry';
        this.rigEntryButton = document.createElement('button');
        this.rigEntryButton.type = 'button';
        this.rigEntryButton.className = 'gui-control gui-control--s';
        this.rigEntryButton.textContent = 'RIGを編集';
        this.rigEntryButton.setAttribute('aria-label', '選択中のCAF RasterのRIG SETUPを開く');
        this.rigEntryButton.title = 'Transformを終了してCAF内RasterのRIG SETUPを表示';
        this._rigEntryClickHandler = () => this._enterRigLens();
        this.rigEntryButton.addEventListener('click', this._rigEntryClickHandler);
        this.rigEntryMessageNode = document.createElement('span');
        this.rigEntryMessageNode.className = 'right-workspace-rig-entry-message';
        this.rigEntryMessageNode.setAttribute('role', 'status');
        this.rigEntryMessageNode.setAttribute('aria-live', 'polite');
        this.rigEntryRow.append(this.rigEntryButton, this.rigEntryMessageNode);
        this.panel.querySelector('.layer-transform-mode-strip')?.after(this.rigEntryRow);
        if (!this.rigEntryRow.parentElement) this.panel.appendChild(this.rigEntryRow);
        this.rigLayerEntryButton = document.createElement('button');
        this.rigLayerEntryButton.type = 'button';
        this.rigLayerEntryButton.className = 'gui-control gui-control--s right-workspace-rig-layer-entry';
        this.rigLayerEntryButton.textContent = 'RIGを編集';
        this.rigLayerEntryButton.title = '選択中のCAF RasterのRIG SETUPを開く';
        this.rigLayerEntryButton.setAttribute('aria-label', '選択中のCAF RasterのRIG SETUPを開く');
        this.rigLayerEntryButton.addEventListener('click', this._rigEntryClickHandler);
        this.rigLayerEntryButton.hidden = true;
        this.root.appendChild(this.rigLayerEntryButton);

        this.rigView = this._createRigLensView();
        this.host.append(this.title, this.rigView, this.panel);
        this._rigCanvasDownHandler = event => this._onRigCanvasDown(event);
        this._rigCanvasUpHandler = event => this._onRigCanvasUp(event);
        this._rigCanvasMoveHandler = event => this._onRigCanvasMove(event);
        this._rigCanvasCancelHandler = event => this._onRigCanvasCancel(event);
        this._rigEscapeHandler = event => {
            if (this.rigPointerGesture?.kind === 'part-pivot-overlay') return;
            if (this.rigLensActive && event.key?.toLowerCase() === 'v'
                && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey
                && !event.target?.closest?.('input, textarea, [contenteditable="true"]')
                && (this._getRigLensTable()?.hasRigLensBonePosePreview?.() === true
                    || this._getRigLensTable()?.hasRigLensPartPosePreview?.() === true)) {
                this._requireRigPoseResolution();
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }
            if (this.rigLensActive && event.key === 'Escape' && (this.rigPlacementMode || this.rigPointerGesture)) {
                this._cancelRigPlacement();
                event.preventDefault();
                event.stopImmediatePropagation();
            } else if (this.rigLensActive && event.key === 'Escape'
                && (this.rigAuthoringKind === 'part'
                    ? this._getRigLensTable()?.cancelRigLensPartPosePreview?.()
                    : this._getRigLensTable()?.cancelRigLensBonePosePreview?.())) {
                this.sync();
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        };
        document.addEventListener('pointerdown', this._rigCanvasDownHandler, true);
        document.addEventListener('pointerup', this._rigCanvasUpHandler, true);
        document.addEventListener('pointermove', this._rigCanvasMoveHandler, true);
        document.addEventListener('pointercancel', this._rigCanvasCancelHandler, true);
        document.addEventListener('keydown', this._rigEscapeHandler, true);
        this.panel.classList.add('is-context-inspector');
        this.observer = new MutationObserver(() => this.sync());
        this.observer.observe(this.panel, { attributes: true, attributeFilter: ['class'] });
        this.resizeObserver = new ResizeObserver(() => this.measure());
        this.resizeObserver.observe(this.drawing);
        this.measure();
        this.sync();
    }

    _createRigLensView() {
        const view = document.createElement('section');
        view.className = 'right-workspace-rig-lens';
        view.setAttribute('aria-label', 'RIG SETUP');

        const header = document.createElement('div');
        header.className = 'right-workspace-rig-lens-header';
        const heading = document.createElement('h2');
        this.rigLensHeading = heading;
        this.rigReturnButton = document.createElement('button');
        this.rigReturnButton.type = 'button';
        this.rigReturnButton.className = 'gui-control gui-control--s';
        this.rigReturnButton.textContent = '← Transform';
        this.rigReturnButton.setAttribute('aria-label', '通常Transformへ戻る');
        this._rigReturnClickHandler = () => this._returnToTransform();
        this.rigReturnButton.addEventListener('click', this._rigReturnClickHandler);
        header.append(heading, this.rigReturnButton);

        this.rigKindRow = document.createElement('div');
        this.rigKindRow.className = 'gui-segmented gui-segmented--compact right-workspace-rig-kind-row';
        this.rigKindRow.setAttribute('role', 'group');
        this.rigKindRow.setAttribute('aria-label', 'RIG方式');
        this.rigPartKindButton = document.createElement('button');
        this.rigPartKindButton.type = 'button';
        this.rigPartKindButton.className = 'gui-control gui-control--s';
        this.rigPartKindButton.textContent = 'PART';
        this.rigPartKindButton.addEventListener('click', () => this._setRigAuthoringKind('part'));
        this.rigDeformKindButton = document.createElement('button');
        this.rigDeformKindButton.type = 'button';
        this.rigDeformKindButton.className = 'gui-control gui-control--s';
        this.rigDeformKindButton.textContent = 'DEFORM';
        this.rigDeformKindButton.addEventListener('click', () => this._setRigAuthoringKind('deform'));
        this.rigKindRow.append(this.rigPartKindButton, this.rigDeformKindButton);

        this.rigModeRow = document.createElement('div');
        this.rigModeRow.className = 'gui-segmented gui-segmented--compact right-workspace-rig-mode-row';
        this.rigModeRow.setAttribute('role', 'group');
        this.rigModeRow.setAttribute('aria-label', 'RIG編集モード');

        const makeRegion = (className, label) => {
            const region = document.createElement('section');
            region.className = `right-workspace-rig-lens-region ${className}`;
            const title = document.createElement('h3');
            title.textContent = label;
            region.appendChild(title);
            return region;
        };

        this.rigLensWarning = document.createElement('p');
        this.rigLensWarning.className = 'right-workspace-rig-lens-warning';
        this.rigLensWarning.setAttribute('role', 'status');
        this.rigLensWarning.setAttribute('aria-live', 'polite');

        const structure = makeRegion('right-workspace-rig-lens-structure', 'パーツ');
        this.rigLensStructureTitle = structure.querySelector('h3');
        this.rigLensStructureContent = document.createElement('div');
        structure.appendChild(this.rigLensStructureContent);

        const properties = makeRegion('right-workspace-rig-lens-properties', '選択パーツ');
        this.rigLensPropertiesTitle = properties.querySelector('h3');
        this.rigLensPropertiesContent = document.createElement('div');
        this.rigPoseButton = document.createElement('button');
        this.rigPoseButton.type = 'button';
        this.rigPoseButton.className = 'gui-control gui-control--s';
        this.rigPoseButton.textContent = 'MOTION';
        this.rigPoseButton.addEventListener('click', () => this._setRigLensMode('motion'));
        this.rigSetupButton = document.createElement('button');
        this.rigSetupButton.type = 'button';
        this.rigSetupButton.className = 'gui-control gui-control--s';
        this.rigSetupButton.textContent = 'SETUP';
        this.rigSetupButton.addEventListener('click', () => this._setRigLensMode('setup'));
        this.rigModeRow.append(this.rigSetupButton, this.rigPoseButton);
        this.rigKeyButton = document.createElement('button');
        this.rigKeyButton.type = 'button';
        this.rigKeyButton.className = 'gui-control gui-control--s';
        this.rigKeyButton.textContent = '◆ Motion KEY確定';
        this.rigKeyButton.addEventListener('click', () => this._commitRigPose());
        this.rigCancelPoseButton = document.createElement('button');
        this.rigCancelPoseButton.type = 'button';
        this.rigCancelPoseButton.className = 'gui-control gui-control--s';
        this.rigCancelPoseButton.textContent = 'Poseを取消';
        this.rigCancelPoseButton.addEventListener('click', () => {
            if (this.rigAuthoringKind === 'part') {
                this._getRigLensTable()?.cancelRigLensPartPosePreview?.();
            } else {
                this._getRigLensTable()?.cancelRigLensBonePosePreview?.();
            }
            this.rigEntryMessage = '';
            this.sync();
        });
        this.rigRootButton = document.createElement('button');
        this.rigRootButton.type = 'button';
        this.rigRootButton.className = 'gui-control gui-control--s';
        this.rigRootButton.textContent = 'Rootを配置';
        this.rigRootButton.addEventListener('click', () => this._armRigPlacement('root'));
        this.rigChildButton = document.createElement('button');
        this.rigChildButton.type = 'button';
        this.rigChildButton.className = 'gui-control gui-control--s';
        this.rigChildButton.textContent = '子Boneを追加';
        this.rigChildButton.addEventListener('click', () => this._armRigPlacement('child'));
        this.rigBindButton = document.createElement('button');
        this.rigBindButton.type = 'button';
        this.rigBindButton.className = 'gui-control gui-control--s';
        this.rigBindButton.textContent = '絵をBoneへ接続';
        this.rigBindButton.title = '選択中のCAF RasterからAUTO GRIDのMesh / Skin Bindingを作成';
        this.rigBindButton.addEventListener('click', () => this._bindRigArtwork());
        this.rigPartRegisterButton = document.createElement('button');
        this.rigPartRegisterButton.type = 'button';
        this.rigPartRegisterButton.className = 'gui-control gui-control--s';
        this.rigPartRegisterButton.textContent = 'Part登録';
        this.rigPartRegisterButton.addEventListener('click', () => this._registerRigPart());
        this.rigPartParentLabel = document.createElement('label');
        this.rigPartParentLabel.className = 'right-workspace-rig-part-parent';
        this.rigPartParentLabel.textContent = '親 ';
        this.rigPartParentSelect = document.createElement('select');
        this.rigPartParentSelect.className = 'gui-control gui-control--s';
        this.rigPartParentSelect.setAttribute('aria-label', '選択Partの親');
        this.rigPartParentSelect.addEventListener('change', () => this._setRigPartParent());
        this.rigPartParentLabel.appendChild(this.rigPartParentSelect);
        this.rigToolHint = document.createElement('p');
        this.rigToolHint.setAttribute('role', 'status');
        this.rigToolHint.setAttribute('aria-live', 'polite');
        this.rigLensPropertiesContent.append(
            this.rigRootButton, this.rigChildButton, this.rigBindButton,
            this.rigPartRegisterButton, this.rigPartParentLabel, this.rigToolHint
        );
        properties.appendChild(this.rigLensPropertiesContent);

        this.rigLensContent = document.createElement('div');
        this.rigLensContent.className = 'right-workspace-rig-lens-content';
        this.rigLensContent.append(structure, properties);
        this.rigLensTerminal = document.createElement('div');
        this.rigLensTerminal.className = 'right-workspace-rig-lens-terminal';
        this.rigLensTerminal.append(this.rigKeyButton, this.rigCancelPoseButton);
        view.append(header, this.rigKindRow, this.rigModeRow, this.rigLensWarning,
            this.rigLensContent, this.rigLensTerminal);
        view.hidden = true;
        return view;
    }

    _showRigEntryMessage(message) {
        this.rigEntryMessage = message || '';
        this.rigEntryMessageNode.textContent = this.rigEntryMessage;
        this.rigEntryMessageNode.hidden = !this.rigEntryMessage;
    }

    _enterRigLens() {
        const target = this.getTarget?.()?.rigTarget || null;
        if (!target?.eligible || !target.assetId || !target.internalLayerId) {
            this._showRigEntryMessage(target?.reason || 'CAF内のRasterを選択してください。');
            return false;
        }

        const selection = window.CoreRuntime?.api?.selection;
        const pixelSelection = window.pixelSelectionSystem || window.drawingApp?.pixelSelectionSystem;
        if (selection?.getState?.()?.transformSessionActive === true
            || pixelSelection?.getState?.()?.transformSessionActive === true) {
            this._showRigEntryMessage('選択範囲のTransformを確定または取消してから入場してください。');
            return false;
        }
        if (selection?.hasSelection?.() === true || pixelSelection?.hasSelection?.() === true) {
            this._showRigEntryMessage('選択範囲を解除してからRIG SETUPへ入場してください。');
            return false;
        }

        const keyboardActive = window.KeyboardHandler?.isVKeyPressed?.() === true;
        const layerActive = this.layerSystem?.transform?.isVKeyPressed === true;
        if (keyboardActive !== layerActive) {
            this._showRigEntryMessage('Transform状態を同期できません。通常の確定・取消経路を確認してください。');
            return false;
        }
        if (this.panel?.classList.contains('show') && !layerActive) {
            this._showRigEntryMessage('別のTransform操作が終了してから入場してください。');
            return false;
        }
        const commitState = this.layerSystem?.getLayerMoveCommitState?.() || null;
        if (commitState?.hasPendingTransform === true) {
            this._showRigEntryMessage('未確定の変形があります。SOURCE確定またはKEY確定／取消を先に行ってください。');
            return false;
        }

        this.rigLensReturnMode = this.layerSystem?.transform?.getTransformMode?.() === 'warp'
            ? 'warp'
            : 'basic';
        if (layerActive) {
            const exited = window.KeyboardHandler?.toggleLayerTransform?.('right-workspace-rig-lens-entry');
            if (exited !== true
                || window.KeyboardHandler?.isVKeyPressed?.() === true
                || this.layerSystem?.transform?.isVKeyPressed === true) {
                this._showRigEntryMessage('Transformを終了できませんでした。既存の確定・取消状態を確認してください。');
                return false;
            }
        }

        this.rigLensTarget = {
            assetId: target.assetId,
            internalLayerId: target.internalLayerId,
            assetName: target.assetName,
            layerName: target.layerName
        };
        const partTarget = this._getRigLensTable()?.getRigLensPartTarget?.(target.assetId);
        this.rigAuthoringKind = partTarget?.layers?.length >= 2 && !target.hasMesh
            && !(partTarget.asset?.rigDefinition?.bones?.length > 0) ? 'part' : 'deform';
        this.rigSelectedPartId = target.internalLayerId;
        this.lastRigTargetKey = this.rigAuthoringKind === 'part'
            ? target.assetId : `${target.assetId}:${target.internalLayerId}`;
        this.rigPlacementMode = null;
        this.rigSelectedBoneId = null;
        this.rigLensMode = 'setup';
        this._showRigEntryMessage('');
        this.rigLensActive = true;
        this.sync();
        this.rigReturnButton.focus({ preventScroll: true });
        return true;
    }

    _returnToTransform() {
        if (!this.rigLensActive) return false;
        if (this.rigPointerGesture) return false;
        if (this._requireRigPoseResolution()) return false;
        if (this._getRigReturnDestination() === 'layer') return this._exitRigToLayer();
        const selection = window.CoreRuntime?.api?.selection;
        const pixelSelection = window.pixelSelectionSystem || window.drawingApp?.pixelSelectionSystem;
        if (selection?.getState?.()?.transformSessionActive === true
            || pixelSelection?.getState?.()?.transformSessionActive === true
            || selection?.hasSelection?.() === true
            || pixelSelection?.hasSelection?.() === true) {
            this._showRigEntryMessage('選択範囲の操作を終えてから通常Transformへ戻ってください。');
            return false;
        }
        if (window.KeyboardHandler?.isVKeyPressed?.() === true
            && this.layerSystem?.transform?.isVKeyPressed === true) {
            this.rigLensActive = false;
            this.rigLensTarget = null;
            this.rigPlacementMode = null;
            this.sync();
            return true;
        }

        const entered = window.KeyboardHandler?.toggleLayerTransform?.(
            'right-workspace-rig-lens-return',
            { preserveMotionWindow: true }
        );
        if (entered !== true
            || window.KeyboardHandler?.isVKeyPressed?.() !== true
            || this.layerSystem?.transform?.isVKeyPressed !== true) {
            this._showRigEntryMessage('通常Transformへ戻れませんでした。Mesh / SkinとLayer Transformの既存競合制限、または選択Layerを確認してください。');
            this.sync();
            return false;
        }

        this.rigLensActive = false;
        this.rigLensTarget = null;
        this.rigPlacementMode = null;
        this.sync();
        if (this.rigLensReturnMode === 'warp') {
            this.layerSystem?.transform?.setTransformMode?.('warp');
        }
        this.title.focus({ preventScroll: true });
        return true;
    }

    _getRigReturnDestination() {
        if (window.KeyboardHandler?.isVKeyPressed?.() === true
            && this.layerSystem?.transform?.isVKeyPressed === true) return 'transform';
        return this.layerSystem?.canStartTransformEditSession?.() === true ? 'transform' : 'layer';
    }

    _requireRigPoseResolution() {
        const table = this._getRigLensTable();
        if (table?.hasRigLensBonePosePreview?.() !== true
            && table?.hasRigLensPartPosePreview?.() !== true) return false;
        this.rigEntryMessage = '未確定Poseがあります。Motion KEYを確定するか、Poseを明示的に取り消してください。';
        this.sync();
        this.rigKeyButton?.focus({ preventScroll: true });
        return true;
    }

    _exitRigToLayer() {
        if (this.rigPointerGesture || this._requireRigPoseResolution()) return false;
        this.rigLensActive = false;
        this.rigLensTarget = null;
        this.rigPlacementMode = null;
        this.rigEntryMessage = '';
        this.sync();
        this.layerModeButton?.focus({ preventScroll: true });
        return true;
    }

    _getRigLensTable() {
        return window.PopupManager?.get?.('animationTable') || null;
    }

    _getRigLensEditTarget() {
        const ids = this.rigLensTarget;
        return ids && this.rigLensActive
            ? this._getRigLensTable()?.getRigLensStaticTarget?.(ids.assetId, ids.internalLayerId)
            : null;
    }

    _setRigAuthoringKind(kind) {
        if (!this.rigLensActive || this.rigPointerGesture || this._requireRigPoseResolution()) return;
        if (kind === 'part' && !this._getRigLensTable()?.getRigLensPartTarget?.(
            this.rigLensTarget.assetId)?.layers?.length) return;
        this.rigAuthoringKind = kind;
        this.rigLensMode = 'setup';
        this.rigPlacementMode = null;
        this.rigEntryMessage = '';
        this.sync();
    }

    _setRigLensMode(mode) {
        if (!this.rigLensActive || this.rigPointerGesture) return false;
        if (this.rigAuthoringKind === 'part') {
            if (mode === 'motion') {
                const result = this._getRigLensTable()?.getRigLensPartMotionTarget?.(
                    this.rigLensTarget.assetId, this.rigSelectedPartId);
                if (!result?.ok) {
                    this.rigEntryMessage = result?.reason || 'Partを選択してください。';
                    this.sync();
                    return false;
                }
            } else if (this._requireRigPoseResolution()) return false;
            this.rigPlacementMode = null;
            this.rigLensMode = mode;
            this.rigEntryMessage = '';
            this.sync();
            return true;
        }
        if (mode === 'motion') {
            const ids = this.rigLensTarget;
            const boneId = this.rigSelectedBoneId;
            const target = this._getRigLensTable()?.getRigLensMotionTarget?.(
                ids.assetId, ids.internalLayerId, boneId
            );
            if (!target?.ok) {
                this.rigEntryMessage = target?.reason || '接続済みBoneを選択してください。';
                this.sync();
                return false;
            }
        } else {
            if (this._requireRigPoseResolution()) return false;
        }
        this.rigPlacementMode = null;
        this.rigLensMode = mode;
        this.rigEntryMessage = '';
        this.sync();
        return true;
    }

    _commitRigPose() {
        if (!this.rigLensActive || this.rigLensMode !== 'motion' || this.rigPointerGesture) return;
        const ids = this.rigLensTarget;
        const result = this.rigAuthoringKind === 'part'
            ? this._getRigLensTable()?.commitRigLensPartKey?.(ids.assetId, this.rigSelectedPartId)
            : this._getRigLensTable()?.commitRigLensBoneKey?.(
                ids.assetId, ids.internalLayerId, this.rigSelectedBoneId);
        this.rigEntryMessage = result?.ok ? '' : (result?.reason || 'Motion KEYを確定できませんでした。');
        this.sync();
    }

    _registerRigPart() {
        const ids = this.rigLensTarget;
        const result = this._getRigLensTable()?.registerRigLensPart?.(ids.assetId, this.rigSelectedPartId);
        this.rigEntryMessage = result?.ok ? '' : (result?.reason || 'Partを登録できませんでした。');
        this.sync();
    }

    _syncRigPartPivotOverlay() {
        const active = this.rigLensActive
            && this.rigAuthoringKind === 'part'
            && this.rigLensMode === 'setup'
            && !!this.rigLensTarget?.assetId;
        if (!active) {
            if (this.rigPartPivotOverlayActive) rigPivotOverlay.deactivate();
            this.rigPartPivotOverlayActive = false;
            return;
        }

        const table = this._getRigLensTable();
        const coordinateSystem = this.layerSystem?.transform?.coordinateSystem;
        if (!table || !coordinateSystem) {
            if (this.rigPartPivotOverlayActive) rigPivotOverlay.deactivate();
            this.rigPartPivotOverlayActive = false;
            return;
        }
        const assetId = this.rigLensTarget.assetId;
        const result = rigPivotOverlay.activate({
            mode: 'rig',
            enableLinkGesture: false,
            coordinateSystem,
            getItems: () => {
                const gesture = this.rigPointerGesture?.kind === 'part-pivot-overlay'
                    ? this.rigPointerGesture : null;
                return table.getRigLensPartPivotWorldItems?.(
                    assetId, this.rigSelectedPartId, gesture?.previewBindPoint || null
                ) || [];
            },
            shouldDisplay: () => this.rigLensActive
                && this.rigAuthoringKind === 'part'
                && this.rigLensMode === 'setup',
            onSelect: partId => {
                if (partId === this.rigSelectedPartId || this.rigPointerGesture) return;
                this.rigSelectedPartId = partId;
                this.rigPlacementMode = null;
                this.rigEntryMessage = '';
                this.sync();
            },
            onGestureStart: (partId, mode, event) =>
                this._startRigPartPivotGesture(partId, mode, event),
            onGestureMove: (partId, mode, event) =>
                this._moveRigPartPivotGesture(partId, mode, event),
            onGestureEnd: (partId, mode, result) =>
                this._finishRigPartPivotGesture(partId, mode, result)
        });
        this.rigPartPivotOverlayActive = result === true;
    }

    _startRigPartPivotGesture(partId, mode, event) {
        if (mode !== 'move' || !this.rigLensActive || this.rigAuthoringKind !== 'part'
            || this.rigLensMode !== 'setup' || this.rigPointerGesture
            || event?.button !== 0 || event.isPrimary === false
            || this.layerSystem?.cameraSystem?.isCanvasMoveMode?.()) return false;
        const target = this._getRigLensTable()?.getRigLensPartTarget?.(this.rigLensTarget.assetId);
        if (!target?.ok || !target.layers.some(layer => layer.id === partId)) return false;
        if (!target.staticSetupAllowed) {
            this.rigEntryMessage = target.staticSetupReason;
            this.sync();
            return false;
        }
        const registered = target.parts.some(part => part.partId === partId);
        const startBindPoint = this._getRigLensTable()?.projectRigLensPartBindPoint?.(
            this.rigLensTarget.assetId, partId, event
        );
        if (!startBindPoint || ![startBindPoint.x, startBindPoint.y].every(Number.isFinite)) return false;
        this.rigPointerGesture = {
            kind: 'part-pivot-overlay',
            pointerId: event.pointerId,
            assetId: this.rigLensTarget.assetId,
            partId,
            configured: registered,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startBindPoint,
            previewBindPoint: null,
            moved: false
        };
        this.rigEntryMessage = '';
        return true;
    }

    _moveRigPartPivotGesture(partId, mode, event) {
        const gesture = this.rigPointerGesture;
        if (mode !== 'move' || gesture?.kind !== 'part-pivot-overlay'
            || gesture.partId !== partId || gesture.pointerId !== event?.pointerId) return;
        if (Math.hypot(event.clientX - gesture.startClientX,
            event.clientY - gesture.startClientY) < 2) return;
        const point = this._getRigLensTable()?.projectRigLensPartBindPoint?.(
            gesture.assetId, partId, event
        );
        if (!point || ![point.x, point.y].every(Number.isFinite)) return;
        gesture.previewBindPoint = point;
        gesture.moved = true;
    }

    _finishRigPartPivotGesture(partId, mode, result) {
        const gesture = this.rigPointerGesture;
        if (gesture?.kind !== 'part-pivot-overlay' || gesture.partId !== partId) return;
        this.rigPointerGesture = null;
        if (result?.cancelled || !gesture.moved || !this.rigLensActive
            || this.rigLensTarget?.assetId !== gesture.assetId) {
            this.sync();
            return;
        }
        const point = this._getRigLensTable()?.projectRigLensPartBindPoint?.(
            gesture.assetId, partId, result?.event
        );
        const saved = point && (gesture.configured
            ? this._getRigLensTable()?.setRigLensPartPivot?.(gesture.assetId, partId, point)
            : this._getRigLensTable()?.registerRigLensPart?.(gesture.assetId, partId, point));
        this.rigEntryMessage = saved?.ok
            ? '' : (saved?.reason || 'PIVOTを保存できませんでした。');
        this.sync();
    }

    _setRigPartParent() {
        const result = this._getRigLensTable()?.setRigLensPartParent?.(
            this.rigLensTarget.assetId, this.rigSelectedPartId,
            this.rigPartParentSelect.value || null
        );
        this.rigEntryMessage = result?.ok ? '' : (result?.reason || '親Partを設定できませんでした。');
        this.sync();
    }

    _armRigPlacement(kind) {
        const target = this._getRigLensEditTarget();
        const table = this._getRigLensTable();
        if (!target?.ok || table?.isPlaying) {
            this.rigEntryMessage = target?.reason || '再生中はRIGを編集できません。';
            this.sync();
            return;
        }
        if ((kind === 'root' && target.bones.length !== 0)
            || (kind === 'child' && (target.bones.length === 0 || target.bones.length >= 3
                || !target.bones.some(bone => bone.boneId === this.rigSelectedBoneId)))) return;
        this.rigPlacementMode = kind;
        this.rigEntryMessage = '';
        this.sync();
    }

    _cancelRigPlacement() {
        if (['pose', 'part-pose'].includes(this.rigPointerGesture?.kind)) {
            this._restoreRigPoseGesturePreview(this.rigPointerGesture);
        }
        this.rigPointerGesture = null;
        this.rigPlacementMode = null;
        this.sync();
    }

    _bindRigArtwork() {
        if (!this.rigLensActive || !this.rigLensTarget || this.rigPointerGesture) return;
        const { assetId, internalLayerId } = this.rigLensTarget;
        const result = this._getRigLensTable()?.generateRigLensArtworkBinding?.(assetId, internalLayerId);
        this.rigEntryMessage = result?.ok ? '' : (result?.reason || 'Artworkを接続できませんでした。');
        this.sync();
    }

    _onRigCanvasDown(event) {
        if (!this.rigLensActive || this.rigPointerGesture
            || event.button !== 0 || event.isPrimary === false) return;
        const canvas = window.coreEngine?.getApp?.()?.canvas;
        if (!canvas || event.target !== canvas || this.layerSystem?.cameraSystem?.isCanvasMoveMode?.()) return;
        if (!this.rigPlacementMode) {
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        const ids = this.rigLensTarget;
        const table = this._getRigLensTable();
        const start = table?.projectRigLensCanvasPoint?.(ids.assetId, ids.internalLayerId, event);
        if (!start || !Number.isFinite(start.x) || !Number.isFinite(start.y)) return;
        this.rigPointerGesture = {
            pointerId: event.pointerId,
            assetId: ids.assetId,
            layerId: ids.internalLayerId,
            kind: this.rigPlacementMode,
            parentBoneId: this.rigPlacementMode === 'child' ? this.rigSelectedBoneId : null,
            start
        };
        try { canvas.setPointerCapture(event.pointerId); } catch { /* document capture still ends the gesture */ }
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    _startRigPoseGesture(bone, event) {
        if (!this.rigLensActive || this.rigLensMode !== 'motion' || this.rigPointerGesture
            || event.button !== 0 || event.isPrimary === false
            || this.layerSystem?.cameraSystem?.isCanvasMoveMode?.()) return;
        const ids = this.rigLensTarget;
        const table = this._getRigLensTable();
        const target = table?.getRigLensMotionTarget?.(ids.assetId, ids.internalLayerId, bone.boneId);
        const start = table?.projectRigLensCanvasPoint?.(ids.assetId, ids.internalLayerId, event);
        if (!target?.ok || !start) return;
        this.rigSelectedBoneId = bone.boneId;
        this.rigPointerGesture = {
            kind: 'pose', pointerId: event.pointerId, assetId: ids.assetId,
            layerId: ids.internalLayerId, boneId: bone.boneId,
            startClientX: event.clientX, startClientY: event.clientY,
            startAngle: Math.atan2(start.y - bone.rootProject.y, start.x - bone.rootProject.x),
            rootProject: bone.rootProject,
            startTransform: { ...(target.preview?.transform || target.sampled) },
            beforePreview: target.preview?.transform ? { ...target.preview.transform } : null,
            moved: false
        };
        const canvas = window.coreEngine?.getApp?.()?.canvas;
        try { canvas?.setPointerCapture(event.pointerId); } catch { /* document listeners own terminal */ }
        this.sync();
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    _startRigPartPoseGesture(item, event) {
        if (!this.rigLensActive || this.rigAuthoringKind !== 'part'
            || this.rigLensMode !== 'motion' || this.rigPointerGesture
            || event.button !== 0 || event.isPrimary === false
            || this.layerSystem?.cameraSystem?.isCanvasMoveMode?.()) return;
        const assetId = this.rigLensTarget.assetId;
        const table = this._getRigLensTable();
        const target = table?.getRigLensPartMotionTarget?.(assetId, item.partId);
        const start = table?.projectRigLensPartCanvasPoint?.(assetId, event);
        if (!target?.ok || !start) return;
        if (table?.hasRigLensPartPosePreview?.() && !target.preview) {
            this.rigEntryMessage = '別Part／Frameの未確定Poseを確定または取消してください。';
            this.sync();
            return;
        }
        this.rigSelectedPartId = item.partId;
        this.rigPointerGesture = {
            kind: 'part-pose', pointerId: event.pointerId, assetId, partId: item.partId,
            startClientX: event.clientX, startClientY: event.clientY,
            startAngle: Math.atan2(start.y - item.rootProject.y, start.x - item.rootProject.x),
            rootProject: item.rootProject,
            startTransform: { ...(target.preview?.transform || target.sampled) },
            beforePreview: target.preview?.transform ? { ...target.preview.transform } : null,
            moved: false
        };
        try { window.coreEngine?.getApp?.()?.canvas?.setPointerCapture(event.pointerId); } catch { /* document owns terminal */ }
        this.sync();
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    _onRigCanvasMove(event) {
        const gesture = this.rigPointerGesture;
        if (!['pose', 'part-pose'].includes(gesture?.kind) || gesture.pointerId !== event.pointerId) return;
        if (Math.hypot(event.clientX - gesture.startClientX,
            event.clientY - gesture.startClientY) < 2 && !gesture.moved) return;
        const table = this._getRigLensTable();
        const point = gesture.kind === 'part-pose'
            ? table?.projectRigLensPartCanvasPoint?.(gesture.assetId, event)
            : table?.projectRigLensCanvasPoint?.(gesture.assetId, gesture.layerId, event);
        if (!point) return;
        const transform = resolveBoneRotationHandleDrag({
            startTransform: gesture.startTransform, root: gesture.rootProject,
            currentPointer: point, startAngle: gesture.startAngle
        });
        const result = gesture.kind === 'part-pose'
            ? table.previewRigLensPartPose(gesture.assetId, gesture.partId, transform)
            : table.previewRigLensBonePose(gesture.assetId, gesture.layerId,
                gesture.boneId, transform);
        gesture.moved = gesture.moved || result?.ok === true;
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    _onRigCanvasUp(event) {
        const gesture = this.rigPointerGesture;
        if (!gesture || event.pointerId !== gesture.pointerId) return;
        if (gesture.kind === 'part-pivot-overlay') return;
        this.rigPointerGesture = null;
        try { window.coreEngine?.getApp?.()?.canvas?.releasePointerCapture(event.pointerId); } catch { /* already released */ }
        event.preventDefault();
        event.stopImmediatePropagation();
        if (gesture.kind === 'pose' || gesture.kind === 'part-pose') {
            if (!gesture.moved) this._restoreRigPoseGesturePreview(gesture);
            this.sync();
            return;
        }
        if (!this.rigLensActive || this.rigPlacementMode !== gesture.kind
            || this.rigLensTarget?.assetId !== gesture.assetId
            || this.rigLensTarget?.internalLayerId !== gesture.layerId) {
            this._cancelRigPlacement();
            return;
        }
        const table = this._getRigLensTable();
        const end = table?.projectRigLensCanvasPoint?.(gesture.assetId, gesture.layerId, event);
        const result = table?.registerRigLensStaticBone?.(gesture.assetId, gesture.layerId, {
            kind: gesture.kind,
            start: gesture.start,
            end,
            parentBoneId: gesture.parentBoneId
        });
        this.rigPlacementMode = null;
        if (result?.ok && result.changed) {
            this.rigSelectedBoneId = result.bone.boneId;
            this.rigEntryMessage = '';
        } else {
            this.rigEntryMessage = result?.reason || 'Boneを作成できませんでした。';
        }
        this.sync();
    }

    _onRigCanvasCancel(event) {
        if (this.rigPointerGesture?.pointerId !== event.pointerId) return;
        if (this.rigPointerGesture.kind === 'part-pivot-overlay') return;
        try { window.coreEngine?.getApp?.()?.canvas?.releasePointerCapture(event.pointerId); } catch { /* already released */ }
        this._cancelRigPlacement();
    }

    _restoreRigPoseGesturePreview(gesture) {
        const table = this._getRigLensTable();
        if (gesture.kind === 'part-pose') {
            if (gesture.beforePreview) {
                table?.previewRigLensPartPose?.(gesture.assetId, gesture.partId, gesture.beforePreview);
            } else {
                table?.cancelRigLensPartPosePreview?.();
            }
            return;
        }
        if (gesture.beforePreview) {
            table?.previewRigLensBonePose?.(gesture.assetId, gesture.layerId,
                gesture.boneId, gesture.beforePreview);
        } else {
            table?.cancelRigLensBonePosePreview?.();
        }
    }

    _syncRigOverlay() {
        if (!this.rigLensActive) {
            if (this.rigOverlayFrame != null) cancelAnimationFrame(this.rigOverlayFrame);
            this.rigOverlayFrame = null;
            this.rigOverlay?.remove();
            this.rigOverlay = null;
            return;
        }
        if (!this.rigOverlay) {
            this.rigOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            this.rigOverlay.classList.add('right-workspace-rig-bone-overlay');
            document.body.appendChild(this.rigOverlay);
        }
        this.rigOverlay.setAttribute('aria-label', this.rigAuthoringKind === 'part'
            ? 'RIG Part構造' : 'RIG Bone構造');
        if (this.rigOverlayFrame != null) return;
        const update = () => {
            this.rigOverlayFrame = null;
            if (!this.rigLensActive || !this.rigOverlay) return;
            const ids = this.rigLensTarget;
            const table = this._getRigLensTable();
            if (this.rigAuthoringKind === 'part' && this.rigLensMode === 'setup') {
                this.rigOverlay.replaceChildren();
                return;
            }
            const bones = (this.rigAuthoringKind === 'part'
                ? table?.getRigLensPartScreenItems?.(ids?.assetId, this.rigLensMode === 'motion')
                : this.rigLensMode === 'motion'
                    ? table?.getRigLensMotionScreenBones?.(ids?.assetId, ids?.internalLayerId)
                    : table?.getRigLensStaticScreenBones?.(ids?.assetId, ids?.internalLayerId)) || [];
            const selectedId = this.rigAuthoringKind === 'part'
                ? this.rigSelectedPartId : this.rigSelectedBoneId;
            const key = JSON.stringify([bones, selectedId, this.rigLensMode, this.rigAuthoringKind]);
            if (this.rigOverlay.dataset.geometry !== key) {
                this.rigOverlay.dataset.geometry = key;
                const ns = 'http://www.w3.org/2000/svg';
                const nodes = bones.flatMap(bone => {
                    const line = document.createElementNS(ns, 'line');
                    line.classList.add('right-workspace-rig-bone-line');
                    line.setAttribute('x1', bone.head.x);
                    line.setAttribute('y1', bone.head.y);
                    line.setAttribute('x2', bone.tail.x);
                    line.setAttribute('y2', bone.tail.y);
                    const marker = document.createElementNS(ns, 'circle');
                    marker.classList.add('right-workspace-rig-bone-marker');
                    marker.classList.toggle('is-selected', (bone.partId || bone.boneId) === selectedId);
                    marker.setAttribute('cx', bone.head.x);
                    marker.setAttribute('cy', bone.head.y);
                    marker.setAttribute('r', '9');
                    marker.setAttribute('role', 'button');
                    marker.setAttribute('aria-label', this.rigAuthoringKind === 'part'
                        ? `Part ${bone.partId}を選択` : `Bone ${bone.boneId}を選択`);
                    marker.addEventListener('pointerdown', event => {
                        if (event.button !== 0) return;
                        if (this.rigAuthoringKind === 'part') {
                            if (this.rigLensMode === 'motion'
                                && this.rigSelectedPartId !== bone.partId
                                && table?.hasRigLensPartPosePreview?.()) {
                                this._requireRigPoseResolution();
                                return;
                            }
                            this.rigSelectedPartId = bone.partId;
                        } else this.rigSelectedBoneId = bone.boneId;
                        this.sync();
                        event.preventDefault();
                        event.stopPropagation();
                    });
                    if (this.rigLensMode !== 'motion') return [line, marker];
                    const tip = document.createElementNS(ns, 'circle');
                    tip.classList.add('right-workspace-rig-bone-marker', 'right-workspace-rig-bone-tip');
                    tip.classList.toggle('is-selected', (bone.partId || bone.boneId) === selectedId);
                    tip.setAttribute('cx', bone.tail.x);
                    tip.setAttribute('cy', bone.tail.y);
                    tip.setAttribute('r', '9');
                    tip.setAttribute('role', 'button');
                    tip.setAttribute('aria-label', `${bone.partId || bone.boneId} の先端をドラッグして回転`);
                    tip.addEventListener('pointerdown', event => this.rigAuthoringKind === 'part'
                        ? this._startRigPartPoseGesture(bone, event)
                        : this._startRigPoseGesture(bone, event));
                    return [line, marker, tip];
                });
                const tips = nodes.filter(node => node.classList.contains('right-workspace-rig-bone-tip'));
                this.rigOverlay.replaceChildren(
                    ...nodes.filter(node => !tips.includes(node)),
                    ...tips.filter(node => !node.classList.contains('is-selected')),
                    ...tips.filter(node => node.classList.contains('is-selected'))
                );
            }
            this.rigOverlayFrame = requestAnimationFrame(update);
        };
        this.rigOverlayFrame = requestAnimationFrame(update);
    }

    _renderRigLens(target) {
        const partTarget = this.rigLensTarget?.assetId
            ? this._getRigLensTable()?.getRigLensPartTarget?.(this.rigLensTarget.assetId)
            : null;
        this.rigKindRow.hidden = !this.rigLensActive || (partTarget?.layers?.length || 0) === 0;
        this.rigModeRow.hidden = !this.rigLensActive;
        this.rigPartKindButton.setAttribute('aria-pressed', String(this.rigAuthoringKind === 'part'));
        this.rigDeformKindButton.setAttribute('aria-pressed', String(this.rigAuthoringKind === 'deform'));
        this.rigSetupButton.setAttribute('aria-pressed', String(this.rigLensMode === 'setup'));
        this.rigPoseButton.setAttribute('aria-pressed', String(this.rigLensMode === 'motion'));
        this.rigSetupButton.hidden = false;
        this.rigPoseButton.hidden = false;
        if (this.rigAuthoringKind === 'part') {
            this._renderRigPartLens(target, partTarget);
            return;
        }
        this.rigPartRegisterButton.hidden = true;
        this.rigPartParentLabel.hidden = true;
        const rigTarget = target?.rigTarget || null;
        const matchesTarget = !!this.rigLensTarget?.assetId
            && rigTarget?.assetId === this.rigLensTarget?.assetId
            && rigTarget?.internalLayerId === this.rigLensTarget?.internalLayerId;
        const frameLabel = isMotion && this.rigLensTarget?.assetId
            ? ` · F${(this._getRigLensTable()?.getRigLensMotionTarget?.(
                this.rigLensTarget.assetId, this.rigLensTarget.internalLayerId, this.rigSelectedBoneId
            )?.frame ?? 0) + 1}`
            : '';
        this.rigLensHeading.textContent = `${rigTarget?.assetName || this.rigLensTarget?.assetName || 'CAF'}${frameLabel} · RIG`;
        this.rigView.setAttribute('aria-label', `${isMotion ? 'RIG MOTION' : 'RIG SETUP'}`);
        this.rigLensStructureTitle.textContent = '対象 / Bone';
        this.rigLensPropertiesTitle.textContent = '選択Bone';
        this.rigLensWarning.hidden = matchesTarget && !this.rigEntryMessage;
        this.rigLensWarning.textContent = !matchesTarget
            ? 'CAFまたはRasterの選択が変わっています。対象を確認してからTransformへ戻ってください。'
            : this.rigEntryMessage;
        this.rigLensStructureContent.replaceChildren();
        const staticTarget = matchesTarget ? this._getRigLensEditTarget() : null;
        const displayTarget = matchesTarget
            ? this._getRigLensTable()?.getRigLensStaticTarget?.(
                rigTarget.assetId, rigTarget.internalLayerId, { allowBound: true }
            )
            : null;
        const isMotion = this.rigLensMode === 'motion';
        this.rigLensHeading.textContent = isMotion ? 'RIG MOTION' : 'RIG SETUP';
        this.rigView.setAttribute('aria-label', isMotion ? 'RIG MOTION' : 'RIG SETUP');
        if (this.rigSelectedBoneId && !displayTarget?.bones?.some(bone => bone.boneId === this.rigSelectedBoneId)) {
            this.rigSelectedBoneId = null;
        }
        this.rigRootButton.hidden = isMotion || !staticTarget?.ok || staticTarget.bones.length !== 0;
        this.rigChildButton.hidden = isMotion || !staticTarget?.ok
            || staticTarget.bones.length === 0 || staticTarget.bones.length >= 3;
        this.rigChildButton.disabled = !staticTarget?.bones?.some(
            bone => bone.boneId === this.rigSelectedBoneId);
        this.rigBindButton.hidden = isMotion || !staticTarget?.ok || staticTarget.bones.length === 0 || rigTarget.hasMesh;
        const motionTarget = matchesTarget && this.rigSelectedBoneId
            ? this._getRigLensTable()?.getRigLensMotionTarget?.(
                rigTarget.assetId, rigTarget.internalLayerId, this.rigSelectedBoneId
            ) : null;
        this.rigPoseButton.disabled = !motionTarget?.ok;
        this.rigSetupButton.disabled = false;
        this.rigKeyButton.hidden = !isMotion;
        this.rigCancelPoseButton.hidden = !isMotion
            || this._getRigLensTable()?.hasRigLensBonePosePreview?.() !== true;
        const returnDestination = this._getRigReturnDestination();
        this.rigReturnButton.textContent = returnDestination === 'layer' ? '← LAYER' : '← Transform';
        this.rigReturnButton.setAttribute('aria-label', returnDestination === 'layer'
            ? '通常Transformへ入場できないためLAYERへ戻る' : '通常Transformへ戻る');
        this.rigKeyButton.disabled = !motionTarget?.ok;
        this.rigLensTerminal.hidden = !isMotion;
        this.rigToolHint.textContent = !matchesTarget
            ? '対象Rasterを確認してください.'
            : isMotion
                ? (motionTarget?.ok
                    ? `F${motionTarget.frame + 1} · ${motionTarget.preview ? '未確定Pose' : motionTarget.key ? 'KEY設定済み' : 'KEY未設定'}`
                    : motionTarget?.reason || '接続済みBoneを選択してください。')
                : !staticTarget?.ok
                    ? (staticTarget?.reason || '対象を確認してください。')
                    : this.rigPlacementMode === 'root'
                        ? 'CanvasでRootをクリック / drag · Escで取消'
                        : this.rigPlacementMode === 'child'
                            ? 'Canvasで子Boneを配置 · Escで取消'
                            : staticTarget.bones.length === 0
                                ? 'RootをCanvas上へ配置'
                                : staticTarget.bones.length < 3
                                    ? '親Boneを選び、子Boneを追加'
                                    : 'Bone構造を選択';
        this.rigToolHint.title = isMotion
            ? '選択Boneの先端をドラッグしてPose preview。明示KEY確定またはPose取消が必要です。'
            : 'Root/Boneの配置はCanvas入力を使用します。';

        if (!matchesTarget) {
            const message = document.createElement('p');
            message.textContent = '現在の選択と入場時の対象が一致しないため、構造情報を表示していません。';
            this.rigLensStructureContent.appendChild(message);
            return;
        }

        const layer = partTarget?.layers?.find(candidate => candidate.id === rigTarget.internalLayerId);
        const targetRow = document.createElement('div');
        targetRow.className = 'right-workspace-rig-target-row';
        const thumbnailUrl = window.layerPanelRenderer?.getRigLensRasterThumbnailUrl?.(
            rigTarget.assetId, rigTarget.internalLayerId
        ) || '';
        if (thumbnailUrl) {
            const image = document.createElement('img');
            image.className = 'right-workspace-rig-part-thumb';
            image.alt = '';
            image.src = thumbnailUrl;
            targetRow.appendChild(image);
        }
        const targetLabel = document.createElement('span');
        targetLabel.textContent = layer?.name || rigTarget.layerName || 'Raster';
        targetLabel.title = targetLabel.textContent;
        targetRow.appendChild(targetLabel);
        this.rigLensStructureContent.appendChild(targetRow);
        const status = document.createElement('p');
        status.className = 'right-workspace-rig-state';
        status.textContent = rigTarget.status || 'RIG未設定';
        this.rigLensStructureContent.appendChild(status);
        const artwork = document.createElement('p');
        artwork.textContent = rigTarget.hasMesh
            ? (rigTarget.meshState === 'current' && rigTarget.weightState === 'connected'
                ? `Artwork: 接続済み · ${rigTarget.bones?.length || 0} Bone`
                : `Artwork: Mesh / Skin要確認 · ${rigTarget.meshState} / ${rigTarget.weightState}`)
            : `Artwork: 未接続 · Asset内Bone ${displayTarget?.bones?.length || 0}件`;
        this.rigLensStructureContent.appendChild(artwork);
        if (displayTarget?.ok && displayTarget.bones.length) {
            const list = document.createElement('ul');
            list.setAttribute('aria-label', '静的Bone構造');
            displayTarget.bones.forEach(bone => {
                const item = document.createElement('li');
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'gui-control gui-control--s';
                button.textContent = bone.name || bone.boneId;
                button.setAttribute('aria-pressed', String(this.rigSelectedBoneId === bone.boneId));
                button.addEventListener('click', () => {
                    if (isMotion && this.rigSelectedBoneId !== bone.boneId
                        && this._requireRigPoseResolution()) {
                        return;
                    }
                    this.rigSelectedBoneId = bone.boneId;
                    this.sync();
                });
                const parent = displayTarget.bones.find(candidate => candidate.boneId === bone.parentBoneId);
                button.title = `Bone ID: ${bone.boneId}`;
                item.append(button, document.createTextNode(parent
                    ? ` · 親 ${parent.name || 'Bone'}` : ' · ROOT'));
                list.appendChild(item);
            });
            this.rigLensStructureContent.appendChild(list);
            const selected = displayTarget.bones.find(bone => bone.boneId === this.rigSelectedBoneId);
            if (selected) {
                const selection = document.createElement('p');
                const parent = displayTarget.bones.find(candidate => candidate.boneId === selected.parentBoneId);
                selection.textContent = `${selected.name || 'Bone'} · 親 ${parent?.name || 'なし'}`;
                this.rigLensStructureContent.appendChild(selection);
            }
        } else if (rigTarget.bones?.length) {
            const list = document.createElement('ul');
            list.setAttribute('aria-label', '対象RasterのBone構造');
            rigTarget.bones.forEach(bone => {
                const item = document.createElement('li');
                const parentBone = rigTarget.bones.find(candidate => candidate.boneId === bone.parentBoneId);
                const parent = bone.parentBoneId ? ` · 親 ${parentBone?.name || 'Bone'}` : ' · ROOT';
                item.textContent = `${bone.name}${parent}`;
                list.appendChild(item);
            });
            this.rigLensStructureContent.appendChild(list);
        } else if (rigTarget.unboundBoneCount > 0) {
            const candidates = document.createElement('p');
            candidates.textContent = `Asset内に未接続Bone候補 ${rigTarget.unboundBoneCount}件（このRasterへの接続は未確認）`;
            this.rigLensStructureContent.appendChild(candidates);
        } else {
            const empty = document.createElement('p');
            empty.textContent = 'Root／Boneは未設定です。';
            this.rigLensStructureContent.appendChild(empty);
        }

        if (rigTarget.hasMesh) {
            const mesh = document.createElement('p');
            mesh.textContent = `MESH: ${rigTarget.meshGeneratorLabel || '設定済み'} · ${rigTarget.meshState} / WEIGHT: ${rigTarget.weightState}`;
            this.rigLensStructureContent.appendChild(mesh);
        }
    }

    _renderRigPartLens(target, partTarget) {
        const assetId = this.rigLensTarget?.assetId;
        const matchesAsset = partTarget?.ok === true && target?.rigTarget?.assetId === assetId;
        const selectedLayer = partTarget?.layers?.find(layer => layer.id === this.rigSelectedPartId);
        const selectedPart = partTarget?.parts?.find(part => part.partId === this.rigSelectedPartId);
        const motion = this.rigLensMode === 'motion';
        const table = this._getRigLensTable();
        const motionTarget = selectedPart
            ? table?.getRigLensPartMotionTarget?.(assetId, selectedPart.partId) : null;
        const pending = table?.hasRigLensPartPosePreview?.() === true;
        const layers = partTarget?.layers || [];
        const parts = partTarget?.parts || [];
        const staticAllowed = partTarget?.staticSetupAllowed === true;
        const cafName = partTarget?.asset?.name || this.rigLensTarget?.assetName || 'CAF';
        const frameSuffix = motion && motionTarget?.ok ? ` · F${motionTarget.frame + 1}` : '';
        this.rigLensHeading.textContent = `${cafName}${frameSuffix} · RIG`;
        this.rigView.setAttribute('aria-label', motion ? 'PART MOTION' : 'PART SETUP');
        this.rigLensStructureTitle.textContent = 'パーツ';
        this.rigLensPropertiesTitle.textContent = motion ? 'このPartの操作' : '選択パーツ';
        this.rigLensWarning.hidden = matchesAsset && !this.rigEntryMessage;
        this.rigLensWarning.textContent = this.rigEntryMessage
            || (matchesAsset ? '' : '選択中のCAFが変わっています。');
        this.rigLensStructureContent.replaceChildren();
        const list = document.createElement('ul');
        list.setAttribute('aria-label', 'CAF内Raster Part');
        list.className = 'right-workspace-rig-part-list';
        layers.forEach(layer => {
            const part = parts.find(candidate => candidate.partId === layer.id);
            const parent = layers.find(candidate => candidate.id === part?.parentPartId);
            const item = document.createElement('li');
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'gui-control gui-control--s right-workspace-rig-part-row';
            button.setAttribute('aria-pressed', String(layer.id === this.rigSelectedPartId));
            button.title = layer.name || 'Raster';
            const thumbnailUrl = window.layerPanelRenderer?.getRigLensRasterThumbnailUrl?.(
                assetId, layer.id
            ) || '';
            if (thumbnailUrl) {
                const image = document.createElement('img');
                image.className = 'right-workspace-rig-part-thumb';
                image.alt = '';
                image.draggable = false;
                image.src = thumbnailUrl;
                button.appendChild(image);
            }
            const name = document.createElement('span');
            name.className = 'right-workspace-rig-part-name';
            name.textContent = layer.name || 'Raster';
            button.appendChild(name);
            button.addEventListener('click', () => {
                if (pending && layer.id !== this.rigSelectedPartId) {
                    this._requireRigPoseResolution();
                    return;
                }
                this.rigSelectedPartId = layer.id;
                this.rigPlacementMode = null;
                this.rigEntryMessage = '';
                this.sync();
            });
            const details = document.createElement('span');
            details.className = 'right-workspace-rig-part-meta';
            details.textContent = part
                ? `親：${parent?.name || 'なし（ROOT）'}`
                : '未登録';
            item.className = 'right-workspace-rig-part-item';
            item.append(button, details);
            list.appendChild(item);
        });
        this.rigLensStructureContent.appendChild(list);
        if (!selectedLayer) {
            const empty = document.createElement('p');
            empty.textContent = matchesAsset ? 'Rasterを選択してください。' : 'CAFを確認してください。';
            this.rigLensStructureContent.appendChild(empty);
        }
        this.rigRootButton.hidden = true;
        this.rigChildButton.hidden = true;
        this.rigBindButton.hidden = true;
        this.rigPartRegisterButton.hidden = motion || !selectedLayer || !!selectedPart;
        this.rigPartParentLabel.hidden = motion || !selectedPart;
        this.rigPartRegisterButton.disabled = !staticAllowed;
        this.rigPartRegisterButton.title = staticAllowed
            ? 'Artwork Bounds中心を初期PIVOTとしてPart登録'
            : partTarget?.staticSetupReason || 'Motion KEYがあるため静的Setupを編集できません。';
        this.rigPartParentSelect.disabled = !staticAllowed;
        if (!this.rigPartParentLabel.hidden) {
            const options = [{ id: '', label: 'なし（ROOT）' },
                ...parts.filter(part => part.partId !== selectedPart.partId)
                    .map(part => ({ id: part.partId, label: layers.find(layer =>
                        layer.id === part.partId)?.name || part.partId }))];
            this.rigPartParentSelect.replaceChildren(...options.map(item => {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = item.label;
                return option;
            }));
            this.rigPartParentSelect.value = selectedPart.parentPartId || '';
        }
        this.rigKeyButton.hidden = !motion;
        this.rigKeyButton.textContent = '◆ このPartのKEY確定';
        this.rigKeyButton.disabled = !motionTarget?.ok || !matchesAsset
            || (pending && !motionTarget.preview);
        this.rigCancelPoseButton.hidden = !motion || !pending;
        this.rigLensTerminal.hidden = !motion;
        this.rigPoseButton.disabled = !motionTarget?.ok || !matchesAsset
            || (pending && !motionTarget.preview);
        this.rigSetupButton.disabled = false;
        this.rigToolHint.textContent = !matchesAsset
            ? 'CAFを確認してください。'
            : motion
                ? (motionTarget?.ok
                    ? `${motionTarget.preview ? '未確定Pose' : motionTarget.key ? 'KEY設定済み' : 'KEY未設定'}`
                    : motionTarget?.reason || '登録済みPartを選択してください。')
                : !staticAllowed
                    ? partTarget?.staticSetupReason || 'Motion KEYがあるため静的Setupを編集できません。'
                    : selectedPart
                        ? `PIVOT ${selectedPart.bindTransform.pivotX.toFixed(1)}, ${selectedPart.bindTransform.pivotY.toFixed(1)} · Canvasでdrag`
                        : selectedLayer
                            ? 'Artwork中心候補 · dragで調整、またはPart登録'
                            : 'Rasterを選択してください。';
        this.rigToolHint.title = motion
            ? 'Canvas上のPartハンドルをdragしてPoseをpreviewし、このPartのKEY確定または取消を行います。'
            : selectedPart
                ? '選択Partの中心軸をCanvas上で直接drag。保存済みPIVOTは選択だけでは変更されません。'
                : '未登録RasterのArtwork Bounds中心を候補表示します。登録またはdragで明示的にSetupへ反映します。';
        this.rigPoseButton.title = '選択PartのPose操作へ。未確定Poseがあれば先にKEY確定または取消が必要です。';
        this.rigKeyButton.title = '選択中のPartだけを現在FrameのMotion KEYへ確定';
        const destination = this._getRigReturnDestination();
        this.rigReturnButton.textContent = destination === 'layer' ? '← LAYER' : '← Transform';
        this.rigReturnButton.setAttribute('aria-label', destination === 'layer'
            ? 'LAYERへ戻る' : '通常Transformへ戻る');
    }

    _mountModeSwitch() {
        this.modeSwitch = this.root.querySelector(':scope > .right-workspace-mode-switch');
        if (!this.modeSwitch) {
            this.modeSwitch = document.createElement('div');
            this.modeSwitch.className = 'right-workspace-mode-switch';
            this.modeSwitch.setAttribute('role', 'group');
            this.modeSwitch.setAttribute('aria-label', '右Workspaceの表示');

            this.layerModeButton = document.createElement('button');
            this.layerModeButton.type = 'button';
            this.layerModeButton.className = 'right-workspace-mode-segment';
            this.layerModeButton.dataset.workspaceMode = 'layer';
            this.layerModeButton.textContent = 'LAYER';

            this.transformModeButton = document.createElement('button');
            this.transformModeButton.type = 'button';
            this.transformModeButton.className = 'right-workspace-mode-segment';
            this.transformModeButton.dataset.workspaceMode = 'transform';
            this.transformModeButton.textContent = 'TRANSFORM';

            this.modeSwitch.append(this.layerModeButton, this.transformModeButton);
            this.root.insertBefore(this.modeSwitch, this.drawing);
        } else {
            this.layerModeButton = this.modeSwitch.querySelector('[data-workspace-mode="layer"]');
            this.transformModeButton = this.modeSwitch.querySelector('[data-workspace-mode="transform"]');
        }

        this._layerModeClickHandler = () => this._requestWorkspaceMode('layer');
        this._transformModeClickHandler = () => this._requestWorkspaceMode('transform');
        this.layerModeButton?.addEventListener('click', this._layerModeClickHandler);
        this.transformModeButton?.addEventListener('click', this._transformModeClickHandler);
    }

    _requestWorkspaceMode(mode) {
        if (this.rigLensActive) {
            if (mode === 'layer') {
                this._exitRigToLayer();
            } else {
                this._returnToTransform();
            }
            return;
        }
        const transformActive = this.panel?.classList.contains('show') === true;
        if (mode === 'transform') {
            if (transformActive) return;
            // The existing V entry remains the sole guard and state owner.
            window.KeyboardHandler?.toggleLayerTransform?.('right-workspace-segment');
            this.sync();
            return;
        }
        if (!transformActive) return;

        const layerEditing = this.layerSystem?.transform?.isVKeyPressed === true;
        const commitState = this.layerSystem?.getLayerMoveCommitState?.() || null;
        if (layerEditing && commitState?.hasPendingTransform === true) {
            // A segment change must not choose confirm or cancel for the user.
            // Keep Transform projected and move focus to the existing terminal.
            this.actions?.classList.add('is-exit-choice-requested');
            const target = this.layerSystem?.getActiveTransformEditTarget?.();
            const keyButton = isTransformTimelineKeyTarget(target)
                ? this.panel.querySelector('#layer-transform-key-commit-btn')
                : null;
            (keyButton && !keyButton.disabled ? keyButton : this.endButton)?.focus?.({ preventScroll: true });
            return;
        }
        if (!layerEditing) {
            // Selection Transform owns its own terminal; do not route it through
            // the Layer V contract merely because the shared panel is visible.
            this.title?.focus?.({ preventScroll: true });
            return;
        }
        window.KeyboardHandler?.toggleLayerTransform?.('right-workspace-segment');
        this.sync();
    }

    _mountStatusPanel() {
        if (!this.statusPanel) return;
        if (this.statusPanel.parentElement !== this.root) {
            this.statusAnchor = document.createComment('right-workspace-status-anchor');
            this.statusPanel.parentNode?.insertBefore(this.statusAnchor, this.statusPanel);
            this.root.appendChild(this.statusPanel);
        }
        this.statusPanel.classList.add('right-workspace-status');
        document.documentElement.classList.add('right-workspace-status-active');
        this._syncStatusMount();
    }

    _subscribeLayoutEvents() {
        if (!this.eventBus?.on) return;
        this._popupShownHandler = (payload = {}) => {
            if (payload.name === 'animationTable') {
                this._syncStatusMount();
                this.sync();
            }
        };
        this._popupHiddenHandler = (payload = {}) => {
            if (payload.name === 'animationTable') {
                this._syncStatusMount();
                this.sync();
            }
        };
        this._dockStateHandler = () => {
            this._syncStatusMount();
            this.sync();
        };
        this.eventBus.on('popup:shown', this._popupShownHandler);
        this.eventBus.on('popup:hidden', this._popupHiddenHandler);
        this.eventBus.on('animation-table:dock-state-changed', this._dockStateHandler);
    }

    _syncTransformActions(layerEditing) {
        const target = this.layerSystem?.getActiveTransformEditTarget?.();
        const animate = isTransformTimelineKeyTarget(target);
        const resetButton = this.panel?.querySelector('#layer-transform-reset-btn');

        this.endButton.hidden = !layerEditing || animate;
        if (layerEditing && !animate) {
            this.endButton.textContent = '✓';
            this.endButton.title = '変形をSOURCE Rasterへ確定してTransformを終了（変更なしなら終了のみ、V）';
            this.endButton.setAttribute('aria-label', 'SOURCE変形をRasterへ確定してTransformを終了');
        }

        // Dirty display stays neutral: the shared pending projection can remain
        // true after a SOURCE Reset returns the artwork to its entry pose.
        resetButton?.classList.remove('is-transform-pending');
        resetButton?.setAttribute('aria-label', '変形をリセット');
        if (resetButton) {
            resetButton.title = '現在のTransformを初期状態へ戻す';
        }
    }

    _getDockStatusSlot(state) {
        if (!this.dock) return null;
        const selector = state === 'collapsed'
            ? '.anim-dock-status-slot--compact'
            : '.anim-dock-status-slot--footer';
        return this.dock.querySelector(selector);
    }

    _syncStatusMount() {
        if (!this.statusPanel || !this.root) return;
        const dockVisible = this.dock
            && this.dock.classList.contains('is-bottom-dock')
            && this.dock.style.display !== 'none';
        const transformActive = this.panel?.classList.contains('show') === true
            || this.rigLensActive;
        const dockState = this.dock?.dataset?.dockState || 'compact';
        const dockSlot = dockVisible && !transformActive
            ? this._getDockStatusSlot(dockState)
            : null;
        const target = dockSlot || this.root;
        const inDock = target !== this.root;
        if (this.statusPanel.parentElement !== target) target.appendChild(this.statusPanel);
        this.statusPanel.classList.toggle('right-workspace-status', !inDock);
        this.statusPanel.classList.toggle('animation-table-dock-status', inDock);
    }

    _restoreStatusPanel() {
        if (!this.statusPanel) return;
        if (this.statusAnchor?.parentNode) {
            this.statusAnchor.parentNode.insertBefore(this.statusPanel, this.statusAnchor.nextSibling);
        }
        this.statusPanel.classList.remove('right-workspace-status', 'animation-table-dock-status');
        document.documentElement.classList.remove('right-workspace-status-active');
        this.statusAnchor?.remove();
        this.statusAnchor = null;
    }

    measure() {
        // Drawing stays laid out but inert/invisible while Transform is shown.
        // Its natural grid therefore remains the live budget, including coarse
        // input and scrollbar changes, without transiently exposing its controls.
        const width = this.drawing?.getBoundingClientRect().width;
        if (width > 0) {
            // Publish the existing single measurement to all layout surfaces.
            // Dock and Canvas inherit this budget; neither measures the rail.
            document.documentElement.style.setProperty('--right-workspace-width', `${width}px`);
            window.coreEngine?.getApp?.()?.resize?.();
        }
    }

    sync() {
        if (!this.host || !this.panel || !this.drawing) return;
        const transformSessionVisible = this.panel.classList.contains('show');
        if (transformSessionVisible && this.rigLensActive) {
            this._getRigLensTable()?.cancelRigLensBonePosePreview?.();
            this.rigLensActive = false;
            this.rigLensTarget = null;
        }
        const rigLensVisible = this.rigLensActive;
        const active = transformSessionVisible || rigLensVisible;
        const surface = rigLensVisible ? 'rig' : (transformSessionVisible ? 'transform' : 'layer');
        const previousSurface = this.currentSurface || surface;
        this.layerModeButton?.classList.toggle('is-selected', !active);
        this.layerModeButton?.setAttribute('aria-pressed', String(!active));
        this.transformModeButton?.classList.toggle('is-selected', active);
        this.transformModeButton?.setAttribute('aria-pressed', String(active));
        if (!active) this.actions?.classList.remove('is-exit-choice-requested');
        this.root.classList.toggle('has-transform-workspace', active);
        this.root.classList.toggle('is-rig-lens-active', rigLensVisible);
        document.documentElement.classList.toggle('right-workspace-transform-active', active);
        this.drawing.inert = active;
        if (active) this.drawing.setAttribute('aria-hidden', 'true');
        else this.drawing.removeAttribute('aria-hidden');
        this.host.hidden = !active;
        this.host.inert = !active;
        this.host.setAttribute('aria-label', rigLensVisible ? 'RIG SETUP作業面' : 'Transform 作業面');
        this.rigView.hidden = !rigLensVisible;
        this.panel.hidden = rigLensVisible;
        this.rigEntryRow.hidden = rigLensVisible;
        const target = this.getTarget?.() || {};
        const layerRigTarget = target.rigTarget;
        const hasSelectedPart = layerRigTarget?.assetId && layerRigTarget?.internalLayerId
            && this._getRigLensTable()?.getRigLensPartTarget?.(layerRigTarget.assetId)
                ?.parts?.some(part => part.partId === layerRigTarget.internalLayerId);
        this.rigLayerEntryButton.hidden = active || target.rigTarget?.eligible !== true
            || (target.rigTarget?.hasMesh !== true && !hasSelectedPart)
            || this.layerSystem?.canStartTransformEditSession?.() !== false;
        const label = target.label || 'Transform';
        this.label.textContent = label;
        this.title.title = label;
        const source = this.drawing.querySelector(
            '.layer-panel-card-row.is-selected img, .clip-layer-mirror-row.is-selected img'
        );
        this.thumbnail.hidden = !source;
        if (source && this.thumbnail.getAttribute('src') !== source.getAttribute('src')) {
            this.thumbnail.setAttribute('src', source.getAttribute('src'));
        }
        const rigTarget = target.rigTarget || null;
        const rigTargetKey = rigTarget?.assetId && rigTarget?.internalLayerId
            ? (this.rigAuthoringKind === 'part'
                ? rigTarget.assetId : `${rigTarget.assetId}:${rigTarget.internalLayerId}`)
            : '';
        if (rigTargetKey !== this.lastRigTargetKey
            && !(this.rigAuthoringKind === 'part'
                && this._getRigLensTable()?.hasRigLensPartPosePreview?.())) {
            this._getRigLensTable()?.cancelRigLensBonePosePreview?.();
            this.lastRigTargetKey = rigTargetKey;
            this.rigEntryMessage = '';
            this.rigPlacementMode = null;
            this.rigSelectedBoneId = null;
            this.rigLensMode = 'setup';
        }
        const rigEntryMessage = this.rigEntryMessage
            || (rigTarget?.eligible === true
                ? ''
                : (rigTarget?.reason || 'CAF内のRasterを選択してからRIGを編集してください。'));
        this.rigEntryMessageNode.textContent = rigEntryMessage;
        this.rigEntryMessageNode.hidden = !rigEntryMessage;
        this._renderRigLens(target);
        if (!rigLensVisible) {
            this.rigPlacementMode = null;
            this.rigPointerGesture = null;
        }
        this._syncRigPartPivotOverlay();
        this._syncRigOverlay();
        const layerEditing = this.layerSystem?.transform?.isVKeyPressed === true;
        this.cancelButton.hidden = !layerEditing;
        this.selectionHint.hidden = layerEditing;
        this._syncTransformActions(layerEditing);
        this._syncStatusMount();
        if (surface !== previousSurface) {
            if (surface === 'rig') this.rigReturnButton.focus({ preventScroll: true });
            else if (surface === 'transform') this.title.focus({ preventScroll: true });
            else this.layerModeButton?.focus({ preventScroll: true });
        }
        this.currentSurface = surface;
    }

    destroy() {
        this._getRigLensTable()?.cancelRigLensBonePosePreview?.();
        this._getRigLensTable()?.cancelRigLensPartPosePreview?.();
        document.removeEventListener('pointerdown', this._rigCanvasDownHandler, true);
        document.removeEventListener('pointerup', this._rigCanvasUpHandler, true);
        document.removeEventListener('pointermove', this._rigCanvasMoveHandler, true);
        document.removeEventListener('pointercancel', this._rigCanvasCancelHandler, true);
        document.removeEventListener('keydown', this._rigEscapeHandler, true);
        this.rigLensActive = false;
        if (this.rigPartPivotOverlayActive) rigPivotOverlay.deactivate();
        this.rigPartPivotOverlayActive = false;
        this._syncRigOverlay();
        this.observer?.disconnect();
        this.resizeObserver?.disconnect();
        this.layerModeButton?.removeEventListener('click', this._layerModeClickHandler);
        this.transformModeButton?.removeEventListener('click', this._transformModeClickHandler);
        this.rigEntryButton?.removeEventListener('click', this._rigEntryClickHandler);
        this.rigLayerEntryButton?.removeEventListener('click', this._rigEntryClickHandler);
        this.rigReturnButton?.removeEventListener('click', this._rigReturnClickHandler);
        this.rigEntryRow?.remove();
        this.rigLayerEntryButton?.remove();
        this.rigView?.remove();
        this.modeSwitch?.remove();
        if (this.eventBus?.off) {
            this.eventBus.off('popup:shown', this._popupShownHandler);
            this.eventBus.off('popup:hidden', this._popupHiddenHandler);
            this.eventBus.off('animation-table:dock-state-changed', this._dockStateHandler);
        }
        document.documentElement.classList.remove('right-workspace-transform-active');
        this.root?.classList.remove('has-transform-workspace', 'is-rig-lens-active');
        if (this.panel) this.panel.hidden = false;
        this._restoreStatusPanel();
        // Teardown does not move a live editing DOM or finish its transaction.
    }
}
