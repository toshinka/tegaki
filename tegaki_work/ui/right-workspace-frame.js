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
import {
    resolveBoneRootHandleDrag,
    resolveBoneRotationHandleDrag,
    resolvePartTransformHandleDrag
} from '../system/animation/part-rig.js';
import { rigPivotOverlay } from './rig-pivot-overlay.js';

const RIG_PART_OPERATION_MESSAGES = Object.freeze({
    'asset-not-found': '対象CAFが見つかりません。',
    'layer-not-found': 'CAF内の対象Layerが見つかりません。',
    'part-target-not-found': 'CAF内の対象Layerが見つかりません。',
    'part-target-type-unsupported': 'このLayer種別はPartにできません。',
    'part-target-background-unsupported': '背景LayerはPartにできません。',
    'raster-part-root-required': 'CAF階層の子RasterはPartにできません。',
    'rig-mode-conflict': 'Mesh/Skinと競合するため、このRasterはPartにできません。',
    'clipping-boundary-split': 'Clipping境界に分割があるため登録できません。',
    'layer-deformer-conflict': '既存WARPがあるためPartにできません。',
    'layer-transform-conflict': '既存Layer MotionがあるためPartにできません。',
    'folder-transform-conflict': '既存Folder Motionと競合するためPartにできません。',
    'part-motion-exists': '既存Part Motion KEYがあるため静的Setupを編集できません。',
    'invalid-rig-definition': 'RIG構造を検証できないため操作できません。',
    'invalid-part-pivot': 'PIVOT座標が不正なため登録できません。',
    'rig-cycle': '循環する親子関係は設定できません。',
    'self-parent': '自分自身は親に指定できません。',
    'parent-part-not-found': '親Partが見つかりません。',
    'parent-part-target-invalid': '同じCAFの有効なPartを親に指定してください。',
    'non-invertible-parent-bind': 'この親ではArtwork位置を保持できません。',
    'non-decomposable-bind': 'Bind位置を安全に保持できません。'
});
const RIG_BINDING_FAILURE_MESSAGES = Object.freeze({
    'asset-not-found': '対象CAFが見つかりません。',
    'layer-not-found': 'CAF内の対象Rasterが見つかりません。',
    'raster-required': 'CAF内のRasterを選択してください。',
    'rig-mode-conflict': 'このRasterはPART／既存RIGと競合するため接続できません。',
    'snapshot-not-found': '対象RasterのArtworkデータを取得できません。',
    'mesh-bone-required': '接続するBoneがありません。Root／Boneを作成してください。',
    'mesh-already-exists': 'このRasterは既にMesh／Skinへ接続されています。既存Bindingは置き換えません。',
    'invalid-raster-bone-setup': '生成したMesh／Skinを検証できませんでした。SETUPに留まります。',
    'unsupported-render-boundary': 'ClippingまたはFolder WARP／rigid対象のRasterには接続できません。',
    'history-unavailable': 'CAF Historyへ記録できないため、Artworkを接続しませんでした。'
});
const RIG_TRANSFORM_BLOCK_MESSAGES = Object.freeze({
    'mesh-layer-unsupported': 'Mesh/Skin接続済みのRasterは内部TransformやSOURCE変形を使用できません。Clip全体のTransformを選択してください。',
    'rig-part-layer-unsupported': 'PART所有のLayerは内部TransformやSOURCE変形を使用できません。Clip全体のTransformを選択してください。'
});
const rigTargetIdentityKey = target => target?.assetId && target?.internalLayerId
    ? `${target.assetId}:${target.internalLayerId}`
    : '';
const RIG_TARGET_SWITCH_GESTURE_MESSAGE = 'RIG操作中です。操作を完了または取り消してから対象を切り替えてください。';
const RIG_TARGET_SWITCH_POSE_MESSAGE = '未確定Poseがあります。Motion KEYへ確定またはPoseを取り消してから対象を切り替えてください。';

function rigPartOperationMessage(result, fallback) {
    const reason = result?.reason;
    if (typeof reason !== 'string' || reason.length === 0) return fallback;
    return RIG_PART_OPERATION_MESSAGES[reason] || reason;
}

export class RightWorkspaceFrame {
    constructor(container, getTarget, layerSystem) {
        this.root = container?.closest?.('.right-panel');
        this.drawing = this.root?.querySelector('.layer-panel-container');
        this.host = this.root?.querySelector('#layer-panel-context-inspector');
        this.panel = document.getElementById('layer-transform-panel');
        this.getTarget = getTarget;
        this.layerSystem = layerSystem;
        this.transformLensRequested = false;
        this.rigLensActive = false;
        this.rigLensTarget = null;
        this.rigLensReturnMode = 'basic';
        this.rigEntryMessage = '';
        this.lastRigTargetKey = null;
        this.rigTargetSwitchPending = false;
        this.rigPlacementMode = null;
        this.rigSelectedBoneId = null;
        this.rigStructureCreatedBoneIds = new Set();
        this.rigTreeCollapsedBoneIds = new Set();
        this.rigStructureTreeRestoreFocusId = null;
        this.rigStructureDrag = null;
        this.rigStructureConnectorFrame = null;
        this.rigStructureStatusMessage = '';
        this.rigStructureEditorReadOnly = false;
        this.rigLensMode = 'setup';
        this.rigAuthoringKind = null;
        this.rigSelectedPartId = null;
        this.rigPartIkEffectorId = null;
        this.rigPointerGesture = null;
        this.rigResetConfirmationOpen = false;
        this.rigResetNotice = '';
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
        this.transformGateNotice = document.createElement('p');
        this.transformGateNotice.className = 'right-workspace-transform-gate';
        this.transformGateNotice.setAttribute('role', 'status');
        this.transformGateNotice.hidden = true;
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
        this.rigView = this._createRigLensView();
        this.host.append(this.title, this.transformGateNotice, this.rigView, this.panel);
        this._rigCanvasDownHandler = event => this._onRigCanvasDown(event);
        this._rigCanvasUpHandler = event => this._onRigCanvasUp(event);
        this._rigCanvasMoveHandler = event => this._onRigCanvasMove(event);
        this._rigCanvasCancelHandler = event => this._onRigCanvasCancel(event);
        this._rigBlurHandler = () => this._onRigWindowBlur();
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
            if (this.rigLensActive && event.key === 'Escape' && this.rigStructureDrag?.pointerMode) {
                this._clearRigStructureDragState();
                this.rigStructureStatusMessage = 'Bone移動を取り消しました。';
                this.sync();
                event.preventDefault();
                event.stopImmediatePropagation();
            } else if (this.rigLensActive && event.key === 'Escape' && (this.rigPlacementMode || this.rigPointerGesture)) {
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
        window.addEventListener('blur', this._rigBlurHandler);
        this.panel.classList.add('is-context-inspector');
        this.observer = new MutationObserver(() => this.sync());
        this.observer.observe(this.panel, { attributes: true, attributeFilter: ['class'] });
        this.resizeObserver = new ResizeObserver(() => {
            this.measure();
            this._scheduleRigHierarchyConnectorRender();
        });
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
        header.append(heading);

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
        this.rigModeRow.className = 'right-workspace-rig-mode-row';
        this.rigModeRow.setAttribute('role', 'group');
        this.rigModeRow.setAttribute('aria-label', 'RIG制作段階の操作');
        this.rigModeActionButton = document.createElement('button');
        this.rigModeActionButton.type = 'button';
        this.rigModeActionButton.className = 'gui-control gui-control--m right-workspace-rig-flow-action';
        this.rigModeActionButton.addEventListener('click', () => this._setRigLensMode(
            this.rigLensMode === 'setup' ? 'motion' : 'setup'
        ));
        this.rigModeRow.append(this.rigModeActionButton);

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
        this.rigStructureEditButton = document.createElement('button');
        this.rigStructureEditButton.type = 'button';
        this.rigStructureEditButton.className = 'gui-control gui-control--s right-workspace-rig-structure-open';
        this.rigStructureEditButton.textContent = '骨格を作成';
        this.rigStructureEditButton.setAttribute('aria-haspopup', 'dialog');
        this.rigStructureEditButton.addEventListener('click', () => this._openRigStructureEditor());
        this.rigLensStructureContent = document.createElement('div');
        structure.appendChild(this.rigLensStructureContent);
        this.rigLensStructureRegion = structure;

        const properties = makeRegion('right-workspace-rig-lens-properties', '選択パーツ');
        this.rigLensPropertiesTitle = properties.querySelector('h3');
        this.rigLensPropertiesContent = document.createElement('div');
        this.rigKeyButton = document.createElement('button');
        this.rigKeyButton.type = 'button';
        this.rigKeyButton.className = 'gui-control gui-control--s right-workspace-rig-frame-key';
        this.rigKeyButton.textContent = '◆ Motion KEY確定';
        this.rigKeyButton.setAttribute('aria-label', '現在FrameのPoseをMotion KEYへ確定');
        this.rigKeyButton.addEventListener('click', () => this._commitRigPose());
        this.rigCancelPoseButton = document.createElement('button');
        this.rigCancelPoseButton.type = 'button';
        this.rigCancelPoseButton.className = 'gui-control gui-control--s';
        this.rigCancelPoseButton.textContent = 'Poseを取消';
        this.rigCancelPoseButton.setAttribute('aria-label', '未確定Poseを取り消す');
        this.rigCancelPoseButton.addEventListener('click', () => {
            if (this.rigAuthoringKind === 'part') {
                this._getRigLensTable()?.cancelRigLensPartPosePreview?.();
            } else {
                this._getRigLensTable()?.cancelRigLensBonePosePreview?.();
            }
            this.rigEntryMessage = '';
            this.sync();
        });
        this.rigPartFrameRow = document.createElement('div');
        this.rigPartFrameRow.className = 'right-workspace-rig-frame-navigation';
        this.rigPartFrameRow.setAttribute('aria-label', 'RIG Frame操作');
        this.rigFrameKeyGroup = document.createElement('div');
        this.rigFrameKeyGroup.className = 'right-workspace-rig-frame-key-group';
        this.rigFrameKeyState = document.createElement('span');
        this.rigFrameKeyState.className = 'right-workspace-rig-frame-key-state';
        this.rigFrameKeyState.setAttribute('role', 'status');
        this.rigFrameKeyState.setAttribute('aria-live', 'polite');
        this.rigFrameKeyDeleteButton = document.createElement('button');
        this.rigFrameKeyDeleteButton.type = 'button';
        this.rigFrameKeyDeleteButton.className = 'gui-control gui-control--s right-workspace-rig-frame-key-delete';
        this.rigFrameKeyDeleteButton.textContent = 'KEY削除';
        this.rigFrameKeyDeleteButton.addEventListener('click', () => this._deleteRigLensBoneKey());
        this.rigPartFramePrevious = document.createElement('button');
        this.rigPartFramePrevious.type = 'button';
        this.rigPartFramePrevious.className = 'gui-control gui-control--s';
        this.rigPartFramePrevious.textContent = '‹';
        this.rigPartFramePrevious.setAttribute('aria-label', '前のFrame');
        this.rigPartFramePrevious.addEventListener('click', () => this._navigateRigPartFrame(-1));
        this.rigPartFrameLabel = document.createElement('span');
        this.rigPartFrameLabel.className = 'right-workspace-rig-frame-label';
        this.rigPartFrameLabel.setAttribute('aria-live', 'polite');
        this.rigPartFrameLabel.title = '対象Clipの現在Frame。ホイールで1Frameずつ移動';
        this.rigPartFrameLabel.addEventListener('wheel', event => {
            event.preventDefault();
            event.stopPropagation();
            if (event.deltaY === 0) return;
            if (this._hasRigPosePreview()) {
                this.rigEntryMessage = 'Frame変更前に、未確定PoseをKEY確定または取消してください。';
                this.sync();
                return;
            }
            this._navigateRigPartFrame(event.deltaY < 0 ? -1 : 1);
        }, { passive: false });
        this.rigPartFrameNext = document.createElement('button');
        this.rigPartFrameNext.type = 'button';
        this.rigPartFrameNext.className = 'gui-control gui-control--s';
        this.rigPartFrameNext.textContent = '›';
        this.rigPartFrameNext.setAttribute('aria-label', '次のFrame');
        this.rigPartFrameNext.addEventListener('click', () => this._navigateRigPartFrame(1));
        this.rigPartFrameRow.append(
            this.rigPartFramePrevious, this.rigPartFrameLabel, this.rigPartFrameNext,
            this.rigCancelPoseButton
        );
        this.rigRootButton = document.createElement('button');
        this.rigRootButton.type = 'button';
        this.rigRootButton.className = 'gui-control gui-control--m right-workspace-rig-deform-action';
        this.rigRootButton.textContent = 'Rootを作成';
        this.rigRootButton.title = 'Rootを既存Bone構造へ作成。Canvas位置は配置画面で確認します。';
        this.rigRootButton.addEventListener('click', () => this._createRigLensStaticRoot(
            this.rigStructureNameInput?.value
        ));
        this.rigChildButton = document.createElement('button');
        this.rigChildButton.type = 'button';
        this.rigChildButton.className = 'gui-control gui-control--s right-workspace-rig-deform-action';
        this.rigChildButton.textContent = '子Boneを追加';
        this.rigChildButton.setAttribute('aria-pressed', 'false');
        this.rigChildButton.title = '選択中のBone先端からdragして子Boneを追加';
        this.rigChildButton.addEventListener('click', () => this._onRigChildPlacementClick());
        this.rigBoneParentLabel = document.createElement('label');
        this.rigBoneParentLabel.className = 'right-workspace-rig-bone-parent-control';
        this.rigBoneParentLabel.textContent = '親Bone';
        this.rigBoneParentLabel.hidden = true;
        this.rigBoneParentSelect = document.createElement('select');
        this.rigBoneParentSelect.className = 'gui-control gui-control--s';
        this.rigBoneParentSelect.setAttribute('aria-label', '選択Boneの親Bone');
        this.rigBoneParentSelect.title = '親を変更してもBoneのBind World位置を保持します';
        this.rigBoneParentSelect.addEventListener('change', () => this._setRigLensBoneParent());
        this.rigBoneParentLabel.appendChild(this.rigBoneParentSelect);
        this.rigBindButton = document.createElement('button');
        this.rigBindButton.type = 'button';
        this.rigBindButton.className = 'gui-control gui-control--m right-workspace-rig-deform-action';
        this.rigBindButton.textContent = '絵をBoneへ接続';
        this.rigBindButton.title = '選択中のCAF RasterからAUTO GRIDのMesh / Skin Bindingを作成';
        this.rigBindButton.addEventListener('click', () => this._bindRigArtwork());
        this.rigPartRegisterButton = document.createElement('button');
        this.rigPartRegisterButton.type = 'button';
        this.rigPartRegisterButton.className = 'gui-control gui-control--s right-workspace-rig-part-create';
        this.rigPartRegisterButton.textContent = 'Partを作成';
        this.rigPartRegisterButton.setAttribute('aria-label', '選択RasterからPartを作成');
        this.rigPartRegisterButton.addEventListener('click', () => this._registerRigPart());
        this.rigPartIkButton = document.createElement('button');
        this.rigPartIkButton.type = 'button';
        this.rigPartIkButton.className = 'gui-control gui-control--s right-workspace-rig-part-ik-toggle';
        this.rigPartIkButton.textContent = '手先IK';
        this.rigPartIkButton.setAttribute('aria-label', '選択PartをIK手先としてドラッグ');
        this.rigPartIkButton.addEventListener('click', () => this._toggleRigPartIk());
        this.rigPartParentLabel = document.createElement('label');
        this.rigPartParentLabel.className = 'right-workspace-rig-part-parent';
        this.rigPartParentLabel.textContent = '親 ';
        this.rigPartParentSelect = document.createElement('select');
        this.rigPartParentSelect.className = 'gui-control gui-control--s';
        this.rigPartParentSelect.setAttribute('aria-label', '選択Partの親Part');
        this.rigPartParentSelect.addEventListener('change', () => this._setRigPartParent());
        this.rigPartParentLabel.appendChild(this.rigPartParentSelect);
        this.rigToolHint = document.createElement('p');
        this.rigToolHint.setAttribute('role', 'status');
        this.rigToolHint.setAttribute('aria-live', 'polite');
        this.rigLensPropertiesContent.append(
            this.rigBindButton, this.rigPartIkButton, this.rigToolHint
        );
        properties.appendChild(this.rigLensPropertiesContent);
        this.rigLensPropertiesRegion = properties;

        this.rigKindPrompt = document.createElement('p');
        this.rigKindPrompt.className = 'right-workspace-rig-kind-prompt';
        this.rigKindPrompt.textContent = 'PARTまたはDEFORMを選択してください。';
        this.rigKindPrompt.hidden = true;

        this.rigResetRegion = makeRegion('right-workspace-rig-reset', 'RIG設定');
        this.rigResetActionButton = document.createElement('button');
        this.rigResetActionButton.type = 'button';
        this.rigResetActionButton.className = 'gui-control gui-control--s right-workspace-rig-reset-action';
        this.rigResetActionButton.textContent = 'RIG設定をリセット';
        this.rigResetActionButton.addEventListener('click', () => this._armRigResetConfirmation());
        this.rigResetStatus = document.createElement('p');
        this.rigResetStatus.className = 'right-workspace-rig-reset-status';
        this.rigResetStatus.setAttribute('role', 'status');
        this.rigResetStatus.setAttribute('aria-live', 'polite');
        this.rigResetConfirmation = document.createElement('div');
        this.rigResetConfirmation.className = 'right-workspace-rig-reset-confirmation';
        this.rigResetConfirmation.hidden = true;
        this.rigResetSummary = document.createElement('p');
        this.rigResetSummary.className = 'right-workspace-rig-reset-summary';
        this.rigResetConfirmation.appendChild(this.rigResetSummary);
        this.rigResetConfirmationStatus = document.createElement('p');
        this.rigResetConfirmationStatus.className = 'right-workspace-rig-reset-status';
        this.rigResetConfirmationStatus.setAttribute('role', 'status');
        this.rigResetConfirmationStatus.setAttribute('aria-live', 'polite');
        const resetActions = document.createElement('div');
        resetActions.className = 'right-workspace-rig-reset-actions';
        this.rigResetCancelButton = document.createElement('button');
        this.rigResetCancelButton.type = 'button';
        this.rigResetCancelButton.className = 'gui-control gui-control--s';
        this.rigResetCancelButton.textContent = 'キャンセル';
        this.rigResetCancelButton.addEventListener('click', () => this._cancelRigResetConfirmation());
        this.rigResetCommitButton = document.createElement('button');
        this.rigResetCommitButton.type = 'button';
        this.rigResetCommitButton.className = 'gui-control gui-control--s right-workspace-rig-reset-commit';
        this.rigResetCommitButton.textContent = 'RIG設定をリセット';
        this.rigResetCommitButton.addEventListener('click', () => this._confirmRigReset());
        resetActions.append(this.rigResetCancelButton, this.rigResetCommitButton);
        this.rigResetConfirmation.append(this.rigResetConfirmationStatus, resetActions);
        this.rigResetRegion.append(
            this.rigResetActionButton, this.rigResetStatus, this.rigResetConfirmation
        );

        this.rigLensContent = document.createElement('div');
        this.rigLensContent.className = 'right-workspace-rig-lens-content';
        this.rigLensContent.append(
            structure, properties, this.rigModeRow, this.rigKindPrompt, this.rigResetRegion
        );
        this.rigLensTerminal = document.createElement('div');
        this.rigLensTerminal.className = 'right-workspace-rig-lens-terminal';
        this.rigLensTerminal.append(this.rigKeyButton);
        view.append(this.rigKindRow, header, this.rigLensWarning,
            this.rigPartFrameRow, this.rigLensContent, this.rigLensTerminal);
        view.hidden = true;
        this._createRigStructureEditorDialog();
        return view;
    }

    _createRigStructureEditorDialog() {
        const dialog = document.createElement('dialog');
        dialog.className = 'right-workspace-rig-structure-editor';
        dialog.setAttribute('aria-labelledby', 'right-workspace-rig-structure-title');

        const header = document.createElement('header');
        header.className = 'right-workspace-rig-structure-editor-header';
        const title = document.createElement('h2');
        title.id = 'right-workspace-rig-structure-title';
        title.textContent = '骨格を組み立てる';
        this.rigStructureCloseButton = document.createElement('button');
        this.rigStructureCloseButton.type = 'button';
        this.rigStructureCloseButton.className = 'gui-control gui-control--s';
        this.rigStructureCloseButton.textContent = '閉じる';
        this.rigStructureCloseButton.addEventListener('click', () => this._closeRigStructureEditor(false));
        header.append(title, this.rigStructureCloseButton);

        const toolbar = document.createElement('div');
        toolbar.className = 'right-workspace-rig-structure-editor-toolbar';
        this.rigStructureTargetLabel = document.createElement('span');
        this.rigStructureTargetLabel.className = 'right-workspace-rig-structure-target';
        this.rigStructureTargetLabel.setAttribute('aria-label', '骨格編集のCAFと対象Raster');
        const nameLabel = document.createElement('label');
        nameLabel.className = 'right-workspace-rig-structure-name-label';
        nameLabel.textContent = 'Bone名';
        this.rigStructureNameInput = document.createElement('input');
        this.rigStructureNameInput.className = 'gui-control gui-control--s';
        this.rigStructureNameInput.type = 'text';
        this.rigStructureNameInput.maxLength = 64;
        this.rigStructureNameInput.setAttribute('aria-label', '追加するBone名');
        nameLabel.appendChild(this.rigStructureNameInput);
        this.rigStructureAddBoneButton = document.createElement('button');
        this.rigStructureAddBoneButton.type = 'button';
        this.rigStructureAddBoneButton.className = 'gui-control gui-control--m right-workspace-rig-board-add';
        this.rigStructureAddBoneButton.textContent = '＋ Bone';
        this.rigStructureAddBoneButton.setAttribute('aria-label', 'Root直下にBoneを追加');
        this.rigStructureAddBoneButton.addEventListener('click', () => this._createRigLensStructureBone('board'));
        this.rigStructureDeleteBoneButton = document.createElement('button');
        this.rigStructureDeleteBoneButton.type = 'button';
        this.rigStructureDeleteBoneButton.className = 'gui-control gui-control--s right-workspace-rig-board-delete';
        this.rigStructureDeleteBoneButton.textContent = '選択Boneを削除';
        this.rigStructureDeleteBoneButton.addEventListener('click', () => this._deleteRigLensStructureBone());
        this.rigStructureDialogActions = document.createElement('div');
        this.rigStructureDialogActions.className = 'right-workspace-rig-structure-editor-toolbar-actions';
        this.rigStructureDialogActions.append(
            this.rigRootButton, this.rigStructureAddBoneButton, this.rigStructureDeleteBoneButton
        );
        this.rigStructureParentDisclosure = document.createElement('details');
        this.rigStructureParentDisclosure.className = 'right-workspace-rig-structure-parent-disclosure';
        const parentSummary = document.createElement('summary');
        parentSummary.textContent = '親を変更';
        this.rigStructureParentDisclosure.appendChild(parentSummary);
        this.rigStructureParentHost = document.createElement('div');
        this.rigStructureParentHost.className = 'right-workspace-rig-structure-parent-host';
        this.rigStructureParentHost.appendChild(this.rigBoneParentLabel);
        this.rigStructureParentDisclosure.appendChild(this.rigStructureParentHost);
        this.rigStructureStatus = document.createElement('p');
        this.rigStructureStatus.className = 'right-workspace-rig-structure-editor-status';
        this.rigStructureStatus.setAttribute('role', 'status');
        this.rigStructureStatus.setAttribute('aria-live', 'polite');
        toolbar.append(
            this.rigStructureTargetLabel, nameLabel, this.rigStructureDialogActions,
            this.rigStructureParentDisclosure, this.rigStructureStatus
        );

        this.rigStructureBoardViewport = document.createElement('div');
        this.rigStructureBoardViewport.className = 'right-workspace-rig-structure-board-viewport';
        this.rigStructureBoardViewport.setAttribute('aria-label', 'Bone階層カードボード');
        this.rigStructureEditorTree = document.createElement('div');
        this.rigStructureEditorTree.className = 'right-workspace-rig-hierarchy-board';
        this.rigStructureEditorTree.setAttribute('role', 'tree');
        this.rigStructureEditorTree.setAttribute('aria-label', '骨格構造');
        this.rigStructureEditorTree.tabIndex = 0;
        this.rigStructureEditorTree.addEventListener('keydown', event => this._onRigBoneTreeKeyDown(event));
        this.rigStructureBoardViewport.appendChild(this.rigStructureEditorTree);

        const footer = document.createElement('footer');
        footer.className = 'right-workspace-rig-structure-editor-footer';
        this.rigStructureContinueButton = document.createElement('button');
        this.rigStructureContinueButton.type = 'button';
        this.rigStructureContinueButton.className = 'gui-control gui-control--m';
        this.rigStructureContinueButton.textContent = '配置へ進む';
        this.rigStructureContinueButton.addEventListener('click', () =>
            this._closeRigStructureEditor(!this.rigStructureEditorReadOnly));
        footer.appendChild(this.rigStructureContinueButton);
        dialog.append(header, toolbar, this.rigStructureBoardViewport, footer);
        dialog.addEventListener('cancel', event => {
            event.preventDefault();
            this._closeRigStructureEditor(false);
        });
        document.body.appendChild(dialog);
        this.rigStructureEditorDialog = dialog;
    }

    _getRigResetFrameBlockReason() {
        if (!this.rigLensActive || !this.rigLensTarget?.assetId) return 'RIG対象がありません。';
        if (this.rigPointerGesture || this.rigStructureDrag || this.rigPlacementMode
            || this.rigStructureEditorDialog?.open) {
            return '進行中のRIG操作を完了または取消してからリセットしてください。';
        }
        const table = this._getRigLensTable();
        if (this._hasRigPosePreview(table)) {
            return '未確定PoseをKEY確定または取消してからリセットしてください。';
        }
        if (table?.isPlaying === true) return '再生中はRIG設定をリセットできません。';

        const currentTarget = this.getTarget?.()?.rigTarget || null;
        if (currentTarget?.eligible !== true
            || currentTarget.assetId !== this.rigLensTarget.assetId
            || currentTarget.internalLayerId !== this.rigLensTarget.internalLayerId) {
            return 'Reset対象のCAF／Rasterが現在の選択と一致しません。';
        }

        const selection = window.CoreRuntime?.api?.selection;
        const pixelSelection = window.pixelSelectionSystem || window.drawingApp?.pixelSelectionSystem;
        if (selection?.getState?.()?.transformSessionActive === true
            || pixelSelection?.getState?.()?.transformSessionActive === true) {
            return '実行中の選択Transformを完了してからリセットしてください。';
        }
        if (selection?.hasSelection?.() === true || pixelSelection?.hasSelection?.() === true) {
            return '選択範囲を解除してからリセットしてください。';
        }

        const keyboardActive = window.KeyboardHandler?.isVKeyPressed?.() === true;
        const layerActive = this.layerSystem?.transform?.isVKeyPressed === true;
        if (keyboardActive !== layerActive || keyboardActive || layerActive
            || this.panel?.classList.contains('show') === true) {
            return 'Transform操作を終了してからRIG設定をリセットしてください。';
        }
        const commitState = this.layerSystem?.getLayerMoveCommitState?.() || null;
        if (commitState?.hasPendingTransform === true) {
            return '未確定のTransformを確定または取消してからリセットしてください。';
        }
        return '';
    }

    _formatRigResetReason(reason) {
        const messages = {
            'asset-not-found': '対象CAFが見つかりません。',
            'invalid-clip-set': 'CAFを参照するClip一覧を確認できません。',
            'unsupported-rig-definition': 'RIG定義が未設定または検証できないため、リセットできません。',
            'unsupported-rig-data': '現在のRIG Lensで扱わないRIGデータが含まれています。',
            'unsupported-mesh-data': 'Mesh / Skinデータを確認できません。',
            'mixed-part-deform-rig': 'PARTとDEFORMが混在しているため、リセットできません。',
            'unsupported-part-target': '現在のRIG Lensが扱わないPART対象が含まれています。',
            'unsupported-rig-composition': 'Rigid BindingまたはWARP Anchorの構成を安全に判定できません。',
            'empty-rig-setup': 'このCAFにリセット対象のRIG設定はありません。',
            'unsupported-deform-bones': '現在のRIG Lensで扱わないBone構造が含まれています。',
            'unsupported-mesh-skinning': 'Mesh / Skin bindingを検証できません。',
            'unsupported-mesh-generator': '手動、Legacy、または未対応のMeshはリセットできません。',
            'unsupported-mesh-data': '現在のRIG Lensで扱わないMesh / Skinデータが含まれています。',
            'unsupported-unowned-part-bone': 'PARTに所有されていないBoneが含まれています。',
            'unsupported-part-ownership': 'PART / Bone / Anchorの所有関係を安全に解除できません。',
            'invalid-part-evaluation': 'PART構造を現在の評価器で解決できません。',
            'unsupported-deform-ownership': 'DEFORM Boneの所有関係を安全に解除できません。',
            'invalid-deform-evaluation': 'DEFORM構造を現在の評価器で解決できません。',
            'unsupported-clip-rig-motion': '対象Clipに未対応または不整合なRIG Motionがあります。',
            'unsupported-mesh-ownership': 'Mesh / Skinの所有関係を安全に解除できません。',
            'reset-plan-changed': 'RIG設定が変わりました。内容を確認してから再実行してください。'
        };
        return messages[reason] || reason || 'RIG設定を安全にリセットできません。';
    }

    _getRigResetStatus() {
        if (!this.rigLensActive) return { ok: false, plan: null, reason: '' };
        const blockReason = this._getRigResetFrameBlockReason();
        const table = this._getRigLensTable();
        const plan = table?.getRigLensResetPlan?.(this.rigLensTarget?.assetId) || null;
        if (blockReason) {
            return { ok: false, plan, reason: blockReason };
        }
        if (!plan?.ok) {
            return { ok: false, plan, reason: this._formatRigResetReason(plan?.reason) };
        }
        return { ok: true, plan, reason: '' };
    }

    _renderRigResetSection() {
        const status = this._getRigResetStatus();
        const planReason = status.plan?.reason;
        const hasResetCandidate = this.rigLensActive && !!this.rigLensTarget?.assetId
            && planReason !== 'empty-rig-setup' && planReason !== 'asset-not-found'
            && !!status.plan;
        this.rigResetRegion.hidden = !hasResetCandidate;
        if (!hasResetCandidate) {
            this.rigResetConfirmationOpen = false;
            this.rigResetActionButton.disabled = true;
            this.rigResetConfirmation.hidden = true;
            this.rigResetStatus.hidden = true;
            return status;
        }

        this.rigResetActionButton.disabled = !status.ok;
        this.rigResetActionButton.title = status.reason || '共有CAFのRIG設定をTimeline History付きで解除します。';
        this.rigResetStatus.textContent = this.rigResetConfirmationOpen ? '' : status.reason;
        this.rigResetStatus.hidden = this.rigResetConfirmationOpen || !status.reason;
        this.rigResetConfirmation.hidden = !this.rigResetConfirmationOpen;
        if (status.plan?.ok) {
            const mode = status.plan.mode === 'part' ? 'PART' : 'DEFORM';
            this.rigResetSummary.textContent = `${mode}方式のRIG設定を解除します。${status.plan.affectedClipCount}個のClip / ${status.plan.affectedRigKeyCount}個のRIG KEYに影響します。Undoで戻せます。`;
        } else {
            this.rigResetSummary.textContent = 'このRIG設定は現在のLensでは安全に解除できません。';
        }
        this.rigResetConfirmationStatus.textContent = this.rigResetNotice || status.reason;
        this.rigResetConfirmationStatus.hidden = !this.rigResetNotice && !status.reason;
        this.rigResetCommitButton.disabled = !status.ok;
        return status;
    }

    _armRigResetConfirmation() {
        const status = this._getRigResetStatus();
        if (!status.ok) {
            this.rigResetNotice = status.reason;
            this.sync();
            return false;
        }
        this.rigResetConfirmationOpen = true;
        this.rigResetNotice = '';
        this.sync();
        this.rigResetCancelButton.focus({ preventScroll: true });
        return true;
    }

    _cancelRigResetConfirmation() {
        this.rigResetConfirmationOpen = false;
        this.rigResetNotice = '';
        this.sync();
        this.rigResetActionButton.focus({ preventScroll: true });
    }

    _confirmRigReset() {
        const status = this._getRigResetStatus();
        if (!status.ok) {
            this.rigResetNotice = status.reason;
            this.sync();
            return false;
        }
        const result = this._getRigLensTable()?.resetRigLensSetup?.(
            this.rigLensTarget.assetId, status.plan.mode
        );
        if (!result?.ok) {
            this.rigResetNotice = this._formatRigResetReason(result?.reason);
            this.sync();
            return false;
        }

        this.rigResetConfirmationOpen = false;
        this.rigResetNotice = '';
        this.rigAuthoringKind = null;
        this.rigLensMode = 'setup';
        this.rigSelectedPartId = null;
        this.rigSelectedBoneId = null;
        this.rigPartIkEffectorId = null;
        this.rigPlacementMode = null;
        this.rigStructureCreatedBoneIds.clear();
        this.rigTreeCollapsedBoneIds.clear();
        this.rigStructureStatusMessage = '';
        this.rigEntryMessage = 'RIG設定をリセットしました。PARTまたはDEFORMを選択できます。Undoで元に戻せます。';
        this.sync();
        this.rigPartKindButton.focus({ preventScroll: true });
        return true;
    }

    _showRigEntryMessage(message) {
        this.rigEntryMessage = message || '';
        this.rigEntryMessageNode.textContent = this.rigEntryMessage;
        this.rigEntryMessageNode.hidden = !this.rigEntryMessage;
    }

    _enterRigLens({ sync = true } = {}) {
        const target = this.getTarget?.()?.rigTarget || null;
        if (!target?.eligible || !target.assetId || !target.internalLayerId) {
            this._showRigEntryMessage(target?.reason || 'CAF内のRasterを選択してください。');
            return false;
        }

        if (this.rigLensActive && (this.rigPointerGesture || this.rigStructureDrag)) {
            this._showRigEntryMessage(RIG_TARGET_SWITCH_GESTURE_MESSAGE);
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
        if (this._hasRigPosePreview()) {
            this._showRigEntryMessage('未確定PoseをMotion KEYへ確定または明示取消してからRIGへ入場してください。');
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

        if (this.rigStructureEditorDialog?.open) this._closeRigStructureEditor(false);

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
        const existingParts = partTarget?.asset?.rigDefinition?.parts?.length || 0;
        const existingBones = partTarget?.asset?.rigDefinition?.bones?.length || 0;
        const rigAsset = partTarget?.asset;
        const hasRigData = existingParts > 0 || existingBones > 0
            || (rigAsset?.rigDefinition?.rigidBindings?.length || 0) > 0
            || (rigAsset?.rigDefinition?.warpAnchorConstraints?.length || 0) > 0
            || (rigAsset?.meshDefinitions?.length || 0) > 0
            || (rigAsset?.skinBindings?.length || 0) > 0;
        this.rigAuthoringKind = !target.hasMesh
            && (existingParts > 0
                || (!hasRigData && existingBones === 0 && (partTarget?.layers?.length || 0) >= 2))
            ? 'part'
            : 'deform';
        this.rigSelectedPartId = target.internalLayerId;
        this.rigPartIkEffectorId = null;
        this.lastRigTargetKey = rigTargetIdentityKey(target);
        this.rigTargetSwitchPending = false;
        this.rigPlacementMode = null;
        this.rigSelectedBoneId = null;
        this.rigStructureCreatedBoneIds.clear();
        this.rigTreeCollapsedBoneIds.clear();
        this.rigLensMode = 'setup';
        this.rigResetConfirmationOpen = false;
        this.rigResetNotice = '';
        if (this.rigAuthoringKind) {
            const motionEntry = this._resolveRigLensInitialMotionEntry();
            if (motionEntry.ok) {
                if (this.rigAuthoringKind === 'deform') this.rigSelectedBoneId = motionEntry.boneId;
                this.rigLensMode = 'motion';
            }
        }
        this._showRigEntryMessage('');
        this.transformLensRequested = false;
        this.rigLensActive = true;
        if (sync) this.sync();
        return true;
    }

    _syncActiveRigLensTarget(target) {
        if (!this.rigLensActive) return 'inactive';
        const selectedKey = target?.eligible === true ? rigTargetIdentityKey(target) : '';
        const activeKey = rigTargetIdentityKey(this.rigLensTarget);
        if (selectedKey && selectedKey === activeKey) {
            this.rigLensTarget = {
                ...this.rigLensTarget,
                assetName: target.assetName,
                layerName: target.layerName
            };
            this.lastRigTargetKey = selectedKey;
            if (this.rigTargetSwitchPending) {
                this.rigEntryMessage = '';
                this.rigTargetSwitchPending = false;
            }
            return 'same-target';
        }

        this.rigTargetSwitchPending = true;
        if (this.rigPointerGesture || this.rigStructureDrag) {
            this.rigEntryMessage = RIG_TARGET_SWITCH_GESTURE_MESSAGE;
            return 'deferred';
        }
        if (this._hasRigPosePreview()) {
            this.rigEntryMessage = RIG_TARGET_SWITCH_POSE_MESSAGE;
            return 'deferred';
        }
        if (!selectedKey) {
            const exited = this._exitRigToLayer({ sync: false });
            if (exited) this.rigTargetSwitchPending = false;
            return exited ? 'layer' : 'deferred';
        }

        if (this._enterRigLens({ sync: false })) return 'retargeted';
        return 'guarded';
    }

    _returnToTransform() {
        if (!this.rigLensActive) return false;
        if (this.rigPointerGesture) return false;
        if (this.rigStructureEditorDialog?.open) this._closeRigStructureEditor(false);
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
            this.rigStructureCreatedBoneIds.clear();
            this.rigPartIkEffectorId = null;
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
        this.rigStructureCreatedBoneIds.clear();
        this.rigPartIkEffectorId = null;
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
        if (!this._hasRigPosePreview(table)) return false;
        this.rigEntryMessage = '未確定Poseがあります。Motion KEYを確定するか、Poseを明示的に取り消してください。';
        this.sync();
        const focusTarget = this.rigKeyButton?.hidden
            ? this.rigCancelPoseButton
            : this.rigKeyButton;
        focusTarget?.focus({ preventScroll: true });
        return true;
    }

    _exitRigToLayer({ showTransformGate = false, sync = true } = {}) {
        if (this.rigPointerGesture || this._requireRigPoseResolution()) return false;
        if (this.rigStructureEditorDialog?.open) this._closeRigStructureEditor(false);
        this.rigLensActive = false;
        this.transformLensRequested = showTransformGate;
        this.rigLensTarget = null;
        this.rigTargetSwitchPending = false;
        this.rigPlacementMode = null;
        this.rigStructureCreatedBoneIds.clear();
        this.rigPartIkEffectorId = null;
        this.rigEntryMessage = '';
        if (sync) this.sync();
        (showTransformGate ? this.transformModeButton : this.layerModeButton)?.focus({ preventScroll: true });
        return true;
    }

    _getRigLensTable() {
        return window.PopupManager?.get?.('animationTable') || null;
    }

    _hasRigPosePreview(table = this._getRigLensTable()) {
        return table?.hasRigLensBonePosePreview?.() === true
            || table?.hasRigLensPartPosePreview?.() === true;
    }

    _getRigLensEditTarget() {
        const ids = this.rigLensTarget;
        return ids && this.rigLensActive
            ? this._getRigLensTable()?.getRigLensStaticEditTarget?.(ids.assetId, ids.internalLayerId)
            : null;
    }

    _resolveRigLensInitialMotionEntry() {
        const ids = this.rigLensTarget;
        const table = this._getRigLensTable();
        if (!ids || !table || this._hasRigPosePreview(table)) return { ok: false };
        if (this.rigAuthoringKind === 'part') {
            const target = table.getRigLensPartMotionTarget?.(ids.assetId, this.rigSelectedPartId);
            return target?.ok ? { ok: true } : { ok: false, reason: target?.reason || '' };
        }

        const staticTarget = table.getRigLensStaticTarget?.(
            ids.assetId, ids.internalLayerId, { allowBound: true }
        );
        if (!staticTarget?.ok) return { ok: false, reason: staticTarget?.reason || '' };
        for (const bone of staticTarget.bones || []) {
            const target = table.getRigLensMotionTarget?.(
                ids.assetId, ids.internalLayerId, bone.boneId
            );
            if (target?.ok) return { ok: true, boneId: bone.boneId };
        }
        return { ok: false };
    }

    _selectRigLensBone(boneId) {
        if (!this.rigLensActive || !boneId || this.rigPointerGesture) return false;
        const changed = this.rigSelectedBoneId !== boneId;
        if (changed && this.rigLensMode === 'motion') {
            const ids = this.rigLensTarget;
            const target = ids
                ? this._getRigLensTable()?.getRigLensMotionTarget?.(
                    ids.assetId, ids.internalLayerId, boneId
                )
                : null;
            if (!target?.ok) {
                this.rigEntryMessage = target?.reason || '選択BoneのMotion条件を確認してください。';
                this.sync();
                return false;
            }
        }
        this.rigSelectedBoneId = boneId;
        if (this.rigLensMode === 'setup' && this.rigAuthoringKind === 'deform') {
            const target = this._getRigLensEditTarget();
            if (target?.ok) this._expandRigBoneAncestors(target.bones, boneId);
        }
        if (changed) {
            this.rigEntryMessage = '';
        }
        this.sync();
        return true;
    }

    _selectRigLensPart(partId) {
        if (!this.rigLensActive || !partId || this.rigPointerGesture) return false;
        if (this.rigSelectedPartId === partId) return true;
        const ids = this.rigLensTarget;
        const target = ids
            ? this._getRigLensTable()?.getRigLensPartMotionTarget?.(ids.assetId, partId)
            : null;
        if (this.rigLensMode === 'motion' && !target?.ok) {
            if (this._requireRigPoseResolution()) return false;
            this.rigLensMode = 'setup';
            this.rigEntryMessage = target?.reason || '選択PartのMotion条件を確認してください。';
        } else {
            this.rigEntryMessage = '';
        }
        this.rigSelectedPartId = partId;
        this.rigPartIkEffectorId = null;
        this.rigPlacementMode = null;
        this.sync();
        return true;
    }

    _syncRigModeAction(motionTarget, matchesTarget) {
        const toMotion = this.rigLensMode === 'setup';
        const label = toMotion ? 'MOTIONへ進む →' : '← SETUPへ戻る';
        this.rigModeActionButton.textContent = label;
        this.rigModeActionButton.setAttribute('aria-label', label);
        this.rigModeActionButton.disabled = toMotion
            && (!matchesTarget || motionTarget?.ok !== true);
        this.rigModeActionButton.title = toMotion
            ? (matchesTarget && motionTarget?.ok
                ? '現在のPart / BoneとFrameでMOTIONを開始'
                : motionTarget?.reason || '対象のMotion条件を満たしていません。SETUPで構造・接続・Frameを確認してください。')
            : 'SETUPへ戻る。完了したGestureはKEYへ反映済みで、Undoから戻せます。';
    }

    _renderRigPendingPoseRecovery(target) {
        if (this.rigLensMode !== 'motion' || !this._hasRigPosePreview()) return;
        const current = target?.rigTarget;
        const matches = this.rigAuthoringKind === 'part'
            ? current?.assetId === this.rigLensTarget?.assetId
            : current?.assetId === this.rigLensTarget?.assetId
                && current?.internalLayerId === this.rigLensTarget?.internalLayerId;
        if (matches && !this.rigPartFrameRow.hidden) return;

        this.rigKeyButton.hidden = true;
        this.rigLensTerminal.hidden = false;
        this.rigLensTerminal.appendChild(this.rigCancelPoseButton);
        this.rigCancelPoseButton.hidden = false;
        this.rigCancelPoseButton.disabled = false;
        this.rigCancelPoseButton.textContent = 'Poseを取消';
        this.rigCancelPoseButton.setAttribute('aria-label', '未確定Poseを取り消す');
        this.rigCancelPoseButton.title = '対象またはFrameが変わっています。既存Poseを明示的に取り消してから再入場してください。';
    }

    _setRigAuthoringKind(kind) {
        if (!this.rigLensActive || this.rigPointerGesture || this._requireRigPoseResolution()) return;
        const partTarget = kind === 'part'
            ? this._getRigLensTable()?.getRigLensPartTarget?.(this.rigLensTarget.assetId)
            : null;
        if (kind === 'part' && !partTarget?.layers?.length) return;
        if (!['part', 'deform'].includes(kind)) return;
        if (kind === 'part') {
            const selectedPartIsVisible = partTarget.layers.some(layer => layer.id === this.rigSelectedPartId);
            if (!selectedPartIsVisible) {
                this.rigSelectedPartId = partTarget.layers.some(
                    layer => layer.id === this.rigLensTarget.internalLayerId
                ) ? this.rigLensTarget.internalLayerId : partTarget.layers[0].id;
            }
        }
        this.rigResetConfirmationOpen = false;
        this.rigResetNotice = '';
        this.rigAuthoringKind = kind;
        this.rigLensMode = 'setup';
        this.rigPartIkEffectorId = null;
        this.rigPlacementMode = null;
        this.rigEntryMessage = '';
        this.sync();
    }

    _setRigLensMode(mode) {
        if (!this.rigLensActive || !this.rigAuthoringKind || this.rigPointerGesture) return false;
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
            if (mode !== 'motion') this.rigPartIkEffectorId = null;
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

    _toggleRigPartIk() {
        if (!this.rigLensActive || this.rigAuthoringKind !== 'part'
            || this.rigLensMode !== 'motion' || this.rigPointerGesture
            || !this.rigSelectedPartId) return false;
        if (this.rigPartIkEffectorId === this.rigSelectedPartId) {
            this.rigPartIkEffectorId = null;
            this.sync();
            return true;
        }
        const context = this._getRigLensTable()?.getRigLensPartIkChainContext?.(
            this.rigLensTarget?.assetId, this.rigSelectedPartId
        );
        if (!context?.ok) {
            this.rigEntryMessage = context?.reason || 'IK chainを使用できません。';
            this.sync();
            return false;
        }
        this.rigPartIkEffectorId = this.rigSelectedPartId;
        this.rigEntryMessage = '';
        this.sync();
        return true;
    }

    _commitRigPose() {
        if (!this.rigLensActive || this.rigLensMode !== 'motion' || this.rigPointerGesture) return;
        const ids = this.rigLensTarget;
        const result = this.rigAuthoringKind === 'part'
            ? this._getRigLensTable()?.commitRigLensPartPoseFrame?.(ids.assetId)
            : this._getRigLensTable()?.commitRigLensBoneKey?.(
                ids.assetId, ids.internalLayerId, this.rigSelectedBoneId);
        this.rigEntryMessage = result?.ok ? '' : (result?.reason || 'Motion KEYを確定できませんでした。');
        this.sync();
    }

    _deleteRigLensBoneKey() {
        if (!this.rigLensActive || this.rigAuthoringKind !== 'deform'
            || this.rigLensMode !== 'motion' || this.rigPointerGesture) return;
        const ids = this.rigLensTarget;
        const result = ids
            ? this._getRigLensTable()?.deleteRigLensBoneKey?.(
                ids.assetId, ids.internalLayerId, this.rigSelectedBoneId
            )
            : null;
        this.rigEntryMessage = result?.ok
            ? ''
            : (result?.reason || '現在FrameのKEYを削除できませんでした。');
        this.sync();
    }

    _navigateRigPartFrame(delta) {
        const table = this._getRigLensTable();
        if (this._hasRigPosePreview(table)) {
            this.rigEntryMessage = 'Frame変更前に、未確定PoseをKEY確定または取消してください。';
            this.sync();
            return false;
        }
        if (table?.isPlaying) {
            this.rigEntryMessage = '再生中はFrameを移動できません。';
            this.sync();
            return false;
        }
        const moved = table?.navigateRigLensPartFrameByDelta?.(
            this.rigLensTarget?.assetId, delta
        ) === true;
        if (moved) {
            this.rigEntryMessage = '';
            this.sync();
        }
        return moved;
    }

    _renderRigFrameNavigation({
        authoringKind = this.rigAuthoringKind,
        mode = this.rigLensMode,
        matchesTarget = false,
        frameTarget = null,
        pending = false,
        commit = null,
        showCancel = false,
        keepFrameNumberWithKey = false,
        frameKeyState = null,
        showFrameKeyDelete = false
    } = {}) {
        const clip = frameTarget?.entry?.clip;
        const frame = frameTarget?.frame;
        const currentLocalFrame = Number.isInteger(frame) && Number.isInteger(clip?.startFrame)
            ? frame - clip.startFrame : null;
        const hasLocalFrame = Number.isInteger(currentLocalFrame)
            && currentLocalFrame >= 0 && currentLocalFrame < (clip?.duration || 0);
        const table = this._getRigLensTable();
        const playing = table?.isPlaying === true;
        const canNavigate = matchesTarget && hasLocalFrame && !pending && !playing;
        const frameLabel = hasLocalFrame ? `F${currentLocalFrame + 1}` : '—';
        const modeLabel = mode === 'motion' ? 'MOTION' : 'SETUP';
        const kindLabel = authoringKind === 'part' ? 'PART' : 'DEFORM';

        this.rigPartFrameRow.setAttribute('aria-label', `RIG ${kindLabel} ${modeLabel} Frame操作`);
        this.rigPartFrameRow.classList.toggle('has-pose-cancel', showCancel);
        this.rigPartFrameRow.classList.toggle('has-frame-key', !!commit && keepFrameNumberWithKey);
        this.rigPartFrameRow.classList.toggle(
            'has-key-state', !!frameKeyState?.exists && keepFrameNumberWithKey
        );
        this.rigPartFrameRow.hidden = !matchesTarget || !hasLocalFrame;
        this.rigPartFramePrevious.disabled = !canNavigate || currentLocalFrame <= 0;
        this.rigPartFrameNext.disabled = !canNavigate
            || currentLocalFrame >= (clip?.duration || 0) - 1;
        const blockedTitle = pending
            ? '未確定PoseをKEY確定または取消してからFrameを移動できます。'
            : playing ? '再生を停止してからFrameを移動できます。'
                : '対象Clip内のFrameを移動';
        this.rigPartFramePrevious.title = canNavigate ? '対象Clip内の前のFrame' : blockedTitle;
        this.rigPartFrameNext.title = canNavigate ? '対象Clip内の次のFrame' : blockedTitle;

        this.rigFrameKeyState.hidden = !frameKeyState?.exists || !keepFrameNumberWithKey;
        this.rigFrameKeyState.textContent = frameKeyState?.exists ? '◆' : '';
        this.rigFrameKeyState.classList.toggle('is-keyed', !!frameKeyState?.exists);
        if (frameKeyState?.exists) {
            const keyDescription = `F${currentLocalFrame + 1}・選択BoneにKEYあり`;
            this.rigFrameKeyState.setAttribute('aria-label', keyDescription);
            this.rigFrameKeyState.title = keyDescription;
        } else {
            this.rigFrameKeyState.removeAttribute('aria-label');
            this.rigFrameKeyState.removeAttribute('title');
        }
        this.rigFrameKeyDeleteButton.hidden = !showFrameKeyDelete || !keepFrameNumberWithKey;
        this.rigFrameKeyDeleteButton.setAttribute('aria-label',
            `F${currentLocalFrame + 1}・選択BoneのKEYを削除`);
        this.rigFrameKeyDeleteButton.title = `F${currentLocalFrame + 1}の選択Bone KEYだけを削除`;
        const keyControls = [];
        if (frameKeyState?.exists && keepFrameNumberWithKey) keyControls.push(this.rigFrameKeyState);
        if (commit && keepFrameNumberWithKey) keyControls.push(this.rigKeyButton);
        if (showFrameKeyDelete && keepFrameNumberWithKey) keyControls.push(this.rigFrameKeyDeleteButton);
        this.rigFrameKeyGroup.replaceChildren(...keyControls);
        this.rigFrameKeyGroup.hidden = keyControls.length === 0;

        this.rigPartFrameLabel.textContent = frameLabel;
        this.rigPartFrameLabel.title = pending
            ? '未確定Poseがあります。明示的にKEY確定または取消してください。'
            : '対象Clipの現在Frame。ホイールで1Frameずつ移動';
        this.rigPartFrameLabel.hidden = !!commit && !keepFrameNumberWithKey;
        this.rigCancelPoseButton.textContent = '↶';
        this.rigCancelPoseButton.setAttribute('aria-label', '未確定Poseを取り消す');
        this.rigCancelPoseButton.title = '未確定Poseだけを取り消す';
        this.rigCancelPoseButton.hidden = !showCancel;
        this.rigCancelPoseButton.disabled = !showCancel;

        const controls = [this.rigPartFramePrevious];
        if (commit) {
            const localFrame = Number.isInteger(commit.localFrame)
                ? commit.localFrame : currentLocalFrame;
            this.rigKeyButton.textContent = keepFrameNumberWithKey
                ? '◆ KEY確定' : `✓ F${localFrame + 1}確定`;
            this.rigKeyButton.setAttribute('aria-label', commit.ariaLabel);
            this.rigKeyButton.title = commit.title;
            this.rigKeyButton.hidden = false;
            this.rigKeyButton.disabled = !matchesTarget;
            if (keepFrameNumberWithKey) controls.push(this.rigPartFrameLabel);
            else controls.push(this.rigKeyButton);
        } else {
            controls.push(this.rigPartFrameLabel);
        }
        controls.push(this.rigPartFrameNext);
        if (keepFrameNumberWithKey && !this.rigFrameKeyGroup.hidden) controls.push(this.rigFrameKeyGroup);
        if (showCancel) controls.push(this.rigCancelPoseButton);
        this.rigPartFrameRow.replaceChildren(...controls);
        return { currentLocalFrame, hasLocalFrame };
    }

    _registerRigPart() {
        const ids = this.rigLensTarget;
        const result = ids
            ? this._getRigLensTable()?.registerRigLensPart?.(ids.assetId, this.rigSelectedPartId)
            : null;
        this.rigEntryMessage = result?.ok ? '' : rigPartOperationMessage(result, 'Partを作成できませんでした。');
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
            ? '' : rigPartOperationMessage(saved, 'PIVOTを保存できませんでした。');
        this.sync();
    }

    _setRigPartParent() {
        const result = this._getRigLensTable()?.setRigLensPartParent?.(
            this.rigLensTarget.assetId, this.rigSelectedPartId,
            this.rigPartParentSelect.value || null
        );
        this.rigEntryMessage = result?.ok
            ? '' : rigPartOperationMessage(result, '親Partを設定できませんでした。');
        this.sync();
    }

    _setRigLensBoneParent() {
        if (!this.rigLensActive || this.rigAuthoringKind !== 'deform'
            || this.rigLensMode !== 'setup' || this.rigPointerGesture
            || !this.rigSelectedBoneId || !this.rigLensTarget) return false;
        const result = this._getRigLensTable()?.setRigLensStaticBoneParent?.(
            this.rigLensTarget.assetId,
            this.rigLensTarget.internalLayerId,
            this.rigSelectedBoneId,
            this.rigBoneParentSelect.value || null
        );
        const messages = {
            'bone-cycle': '子孫Boneを親にできません。',
            'self-parent-bone': 'Bone自身は親にできません。',
            'parent-bone-not-found': '同じRIG内の親Boneを選択してください。',
            'non-invertible-parent-bind': '現在のBind World位置を保持できない親です。',
            'non-decomposable-bind': 'Bind位置を安全に保持できない親です。'
        };
        this.rigEntryMessage = result?.ok
            ? '' : (messages[result?.reason] || result?.reason || 'Boneの親を変更できませんでした。');
        this.sync();
        return result?.ok === true;
    }

    _openRigStructureEditor() {
        if (!this.rigLensActive || this.rigAuthoringKind !== 'deform'
            || this.rigLensMode !== 'setup' || this.rigPointerGesture) return false;
        const editTarget = this._getRigLensEditTarget();
        const displayTarget = this._getRigLensTable()?.getRigLensStaticTarget?.(
            this.rigLensTarget?.assetId, this.rigLensTarget?.internalLayerId, { allowBound: true }
        );
        const readOnlyTarget = !editTarget?.ok && displayTarget?.ok
            && displayTarget.bones?.length > 0;
        const target = editTarget?.ok ? editTarget : (readOnlyTarget ? displayTarget : editTarget);
        if (!target?.ok || !this.rigStructureEditorDialog) {
            this.rigEntryMessage = target?.reason || editTarget?.reason || '骨格構造を表示できません。';
            this.sync();
            return false;
        }
        if (this.rigPlacementMode) this._cancelRigPlacement();
        if (this.rigStructureEditorDialog.open) {
            this.rigStructureEditorReadOnly = !editTarget?.ok;
            this.sync();
            return true;
        }
        this._clearRigStructureDragState();
        this.rigStructureEditorReadOnly = !editTarget?.ok;
        this.rigStructureStatusMessage = '';
        this.rigStructureNameInput.value = target.bones.length === 0
            ? 'Root' : `Bone ${target.bones.length}`;
        this.rigStructureEditorDialog.showModal();
        this.rigEntryMessage = this.rigStructureEditorReadOnly
            ? (editTarget?.reason || '現在の構造は読み取り専用です。') : '';
        this.sync();
        if (this.rigSelectedBoneId) {
            this.rigStructureEditorTree.querySelectorAll('[data-rig-tree-select]')
                .forEach(button => {
                    if (button.dataset.rigBoneId === this.rigSelectedBoneId) button.focus();
                });
        } else if (target.bones.length === 0) {
            this.rigRootButton.focus();
        } else {
            this.rigStructureEditorTree.focus();
        }
        return true;
    }

    _closeRigStructureEditor(returnToCanvas) {
        if (returnToCanvas && !this.rigStructureEditorReadOnly
            && this.rigLensActive && this.rigLensTarget) {
            const target = this._getRigLensEditTarget();
            if (this.rigStructureCreatedBoneIds.size > 0 && !target?.ok) {
                this.rigStructureStatusMessage = target?.reason
                    || '対象Boneを再確認できないため、初期配置を行わず構造編集を維持します。';
                if (this.rigStructureStatus) {
                    this.rigStructureStatus.textContent = this.rigStructureStatusMessage;
                }
                this.sync();
                return false;
            }
            const pendingCreatedIds = (target?.bones || [])
                .filter(bone => this.rigStructureCreatedBoneIds.has(bone.boneId))
                .map(bone => bone.boneId);
            if (pendingCreatedIds.length > 0) {
                const result = this._getRigLensTable()?.applyRigLensStaticInitialLayout?.(
                    this.rigLensTarget.assetId, this.rigLensTarget.internalLayerId,
                    pendingCreatedIds
                );
                if (!result?.ok) {
                    this.rigStructureStatusMessage = result?.reason
                        || '新規Boneの初期配置を確定できません。';
                    if (this.rigStructureStatus) {
                        this.rigStructureStatus.textContent = this.rigStructureStatusMessage;
                    }
                    this.sync();
                    return false;
                }
                this.rigStructureStatusMessage = result.changed
                    ? '新規BoneをCanvas内へ初期配置しました。'
                    : '';
                pendingCreatedIds.forEach(boneId => this.rigStructureCreatedBoneIds.delete(boneId));
            }
        }
        this._clearRigStructureDragState();
        if (this.rigStructureEditorDialog?.open) this.rigStructureEditorDialog.close();
        this.rigStructureEditorReadOnly = false;
        this.sync();
        if (returnToCanvas && this.rigSelectedBoneId) {
            const row = [...(this.rigCompactBoneTree?.querySelectorAll('[data-rig-tree-select]') || [])]
                .find(button => button.dataset.rigBoneId === this.rigSelectedBoneId);
            (row || this.rigStructureEditButton)?.focus({ preventScroll: true });
        } else if (!returnToCanvas) {
            this.rigStructureEditButton?.focus({ preventScroll: true });
        }
        return true;
    }

    _getRigBoneDescendants(bones, boneId) {
        const descendants = new Set();
        let changed = true;
        while (changed) {
            changed = false;
            bones.forEach(candidate => {
                if ((candidate.parentBoneId === boneId || descendants.has(candidate.parentBoneId))
                    && !descendants.has(candidate.boneId)) {
                    descendants.add(candidate.boneId);
                    changed = true;
                }
            });
        }
        return descendants;
    }

    _expandRigBoneAncestors(bones, boneId) {
        const byId = new Map(bones.map(bone => [bone.boneId, bone]));
        let current = byId.get(boneId);
        const visited = new Set();
        while (current?.parentBoneId && !visited.has(current.parentBoneId)) {
            visited.add(current.parentBoneId);
            this.rigTreeCollapsedBoneIds.delete(current.parentBoneId);
            current = byId.get(current.parentBoneId);
        }
    }

    _renderRigCompactBoneList(container, bones) {
        if (!container) return;
        container.replaceChildren();
        const list = document.createElement('ul');
        list.className = 'right-workspace-rig-bone-selection-list';
        list.setAttribute('role', 'presentation');
        const bindAdjustment = this._getRigLensTable()?.getRigLensStaticBindGestureTarget?.(
            this.rigLensTarget?.assetId, this.rigLensTarget?.internalLayerId
        ) || null;
        bones.forEach(bone => {
            const selected = this.rigSelectedBoneId === bone.boneId;
            const root = bone.parentBoneId == null;
            const item = document.createElement('li');
            item.className = `right-workspace-rig-bone-selection-item${selected ? ' is-selected' : ''}`;
            item.setAttribute('role', 'none');
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'right-workspace-rig-bone-selection-button gui-control gui-control--s';
            button.setAttribute('role', 'treeitem');
            button.setAttribute('aria-level', '1');
            button.setAttribute('aria-selected', String(selected));
            button.setAttribute('aria-pressed', String(selected));
            button.tabIndex = selected ? 0 : -1;
            button.dataset.rigTreeSelect = 'true';
            button.dataset.rigBoneId = bone.boneId;
            const name = bone.name || (root ? 'Root' : 'Bone');
            // Promise only the gesture the current target actually permits.
            const actionLabel = bindAdjustment?.ok !== true
                ? `Bind位置は調整できません: ${bindAdjustment?.reason || '対象を確認してください。'}`
                : this.layerSystem?.cameraSystem?.isCanvasMoveMode?.()
                    ? 'Canvas移動モードを解除してBind位置を調整'
                    : 'Canvasで関節をドラッグして移動 · 弧をドラッグして回転';
            button.setAttribute('aria-label', `${name} · ${actionLabel}`);
            button.title = name;
            const glyph = document.createElement('span');
            glyph.className = `right-workspace-rig-bone-tree-glyph${root ? ' is-root' : ''}`;
            glyph.textContent = root ? 'R' : 'B';
            glyph.setAttribute('aria-hidden', 'true');
            const label = document.createElement('span');
            label.className = 'right-workspace-rig-bone-selection-name';
            label.textContent = name;
            label.title = name;
            button.append(glyph, label);
            button.addEventListener('click', () => this._selectRigLensBone(bone.boneId));
            item.appendChild(button);

            if (selected) {
                const details = document.createElement('div');
                details.className = 'right-workspace-rig-selected-bone-details';
                const action = document.createElement('p');
                action.className = 'right-workspace-rig-selected-bone-action';
                action.textContent = actionLabel;
                details.append(action);
                item.appendChild(details);
            }
            list.appendChild(item);
        });
        container.appendChild(list);
        container.dataset.variant = 'compact-flat';
        const selected = [...container.querySelectorAll('[data-rig-tree-select]')]
            .find(button => button.dataset.rigBoneId === this.rigSelectedBoneId);
        if (this.rigStructureTreeRestoreFocusId) {
            const focusTarget = [...container.querySelectorAll('[data-rig-tree-select]')]
                .find(button => button.dataset.rigBoneId === this.rigStructureTreeRestoreFocusId);
            if (focusTarget) {
                focusTarget.focus({ preventScroll: true });
                this.rigStructureTreeRestoreFocusId = null;
            }
        }
        selected?.scrollIntoView?.({ block: 'nearest' });
    }

    _renderRigBoneTree(container, bones, variant = 'compact') {
        if (!container) return;
        container.replaceChildren();
        const byId = new Map(bones.map(bone => [bone.boneId, bone]));
        const childrenByParent = new Map();
        bones.forEach(bone => {
            const key = bone.parentBoneId || null;
            const children = childrenByParent.get(key) || [];
            children.push(bone);
            childrenByParent.set(key, children);
        });
        const makeNodes = (items, depth, ancestors) => {
            const list = document.createElement('ul');
            list.className = `right-workspace-rig-bone-tree-group is-depth-${Math.min(depth, 4)}`;
            list.setAttribute('role', depth === 0 ? 'presentation' : 'group');
            items.forEach(bone => {
                if (ancestors.has(bone.boneId)) return;
                const children = childrenByParent.get(bone.boneId) || [];
                const listItem = document.createElement('li');
                listItem.className = 'right-workspace-rig-bone-tree-item';
                listItem.setAttribute('role', 'none');
                const item = document.createElement('div');
                item.className = 'right-workspace-rig-bone-tree-select gui-control gui-control--s';
                item.setAttribute('role', 'treeitem');
                item.setAttribute('aria-level', String(depth + 1));
                item.setAttribute('aria-selected', String(this.rigSelectedBoneId === bone.boneId));
                item.tabIndex = this.rigSelectedBoneId === bone.boneId ? 0 : -1;
                item.style.setProperty('--rig-tree-depth', String(Math.min(depth, 4)));
                item.dataset.rigTreeSelect = 'true';
                item.dataset.rigBoneId = bone.boneId;
                if (children.length > 0) {
                    const folded = this.rigTreeCollapsedBoneIds.has(bone.boneId);
                    const canFold = !this.rigSelectedBoneId
                        || !this._getRigBoneDescendants(bones, bone.boneId).has(this.rigSelectedBoneId);
                    const fold = document.createElement('button');
                    fold.type = 'button';
                    fold.className = 'right-workspace-rig-bone-tree-fold gui-control gui-control--s';
                    fold.dataset.rigTreeFold = 'true';
                    fold.textContent = folded ? '›' : '⌄';
                    fold.setAttribute('aria-label', `${folded ? '展開' : '折り畳む'} ${bone.name || 'Bone'}の子`);
                    fold.setAttribute('aria-expanded', String(!folded));
                    fold.title = canFold
                        ? `${folded ? '子Boneを表示' : '子Boneを折り畳む'}`
                        : '選択中Boneを表示したままにするため、先に別Boneを選択してください。';
                    fold.disabled = !canFold;
                    fold.addEventListener('click', () => {
                        if (fold.disabled) return;
                        if (folded) this.rigTreeCollapsedBoneIds.delete(bone.boneId);
                        else this.rigTreeCollapsedBoneIds.add(bone.boneId);
                        this.sync();
                    });
                    item.appendChild(fold);
                } else {
                    const spacer = document.createElement('span');
                    spacer.className = 'right-workspace-rig-bone-tree-fold-spacer';
                    spacer.setAttribute('aria-hidden', 'true');
                    item.appendChild(spacer);
                }
                if (children.length > 0) item.setAttribute('aria-expanded', String(!this.rigTreeCollapsedBoneIds.has(bone.boneId)));
                const root = bone.parentBoneId == null;
                const glyph = document.createElement('span');
                glyph.className = root
                    ? 'right-workspace-rig-bone-tree-glyph is-root'
                    : 'right-workspace-rig-bone-tree-glyph';
                glyph.textContent = root ? 'R' : 'B';
                glyph.setAttribute('aria-hidden', 'true');
                const name = document.createElement('span');
                name.className = 'right-workspace-rig-bone-tree-name';
                name.textContent = bone.name || (root ? 'Root' : 'Bone');
                item.title = `${name.textContent} · ${root ? 'Root' : `親 ${byId.get(bone.parentBoneId)?.name || 'Bone'}`}`;
                item.setAttribute('aria-label', item.title);
                item.append(glyph, name);
                item.addEventListener('click', event => {
                    if (event.target.closest('[data-rig-tree-fold]')
                        || event.target.closest('[role="treeitem"]') !== item) return;
                    this._selectRigLensBone(bone.boneId);
                });
                listItem.appendChild(item);
                if (children.length > 0 && !this.rigTreeCollapsedBoneIds.has(bone.boneId)) {
                    const nextAncestors = new Set(ancestors);
                    nextAncestors.add(bone.boneId);
                    item.appendChild(makeNodes(children, depth + 1, nextAncestors));
                }
                list.appendChild(listItem);
            });
            return list;
        };
        const roots = childrenByParent.get(null) || [];
        container.appendChild(makeNodes(roots.length ? roots : bones, 0, new Set()));
        container.dataset.variant = variant;
        const activeVariant = this.rigStructureEditorDialog?.open ? 'expanded' : 'compact';
        if (variant === activeVariant && this.rigStructureTreeRestoreFocusId) {
            const focusId = this.rigStructureTreeRestoreFocusId;
            const focusTarget = [...container.querySelectorAll('[data-rig-tree-select]')]
                .find(button => button.dataset.rigBoneId === focusId);
            if (focusTarget) {
                focusTarget.focus({ preventScroll: true });
                this.rigStructureTreeRestoreFocusId = null;
            }
        }
        const selected = [...container.querySelectorAll('[data-rig-tree-select]')]
            .find(button => button.dataset.rigBoneId === this.rigSelectedBoneId);
        if (variant === activeVariant) selected?.scrollIntoView?.({ block: 'nearest' });
    }

    _getRigHierarchyCardTree(bones) {
        if (!Array.isArray(bones)) return { root: null, children: [] };
        const roots = bones.filter(bone => bone?.parentBoneId == null);
        if (roots.length !== 1) return { root: null, children: [] };
        const childrenByParent = new Map();
        bones.forEach(bone => {
            if (!bone?.boneId || bone.parentBoneId == null) return;
            const children = childrenByParent.get(bone.parentBoneId) || [];
            children.push(bone);
            childrenByParent.set(bone.parentBoneId, children);
        });
        const visit = (parentBoneId, prefix, ancestors) => {
            const children = childrenByParent.get(parentBoneId) || [];
            return children.flatMap((bone, index) => {
                if (ancestors.has(bone.boneId)) return [];
                const parts = [...prefix, index + 1];
                const nextAncestors = new Set(ancestors).add(bone.boneId);
                return [{
                    bone,
                    number: parts.join('-'),
                    children: visit(bone.boneId, parts, nextAncestors)
                }];
            });
        };
        const root = roots[0];
        return {
            root,
            // Preserve the existing serialized bones[] enumeration as sibling display order.
            children: visit(root.boneId, [], new Set([root.boneId]))
        };
    }

    _renderRigHierarchyCardBoard(container, bones, { readOnly = false } = {}) {
        if (!container) return;
        container.replaceChildren();
        const board = this._getRigHierarchyCardTree(bones);
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('right-workspace-rig-hierarchy-connectors');
        svg.setAttribute('aria-hidden', 'true');
        svg.dataset.rigHierarchyConnectors = 'true';
        container.appendChild(svg);
        if (!board.root) {
            const empty = document.createElement('p');
            empty.className = 'right-workspace-rig-hierarchy-empty';
            empty.textContent = bones?.length
                ? '単一Rootの骨格構造を確認できません。'
                : 'Rootを作成し、＋ Boneでカードを追加します。';
            container.appendChild(empty);
            return;
        }

        const makeNode = (entry, isRoot = false) => {
            const bone = entry.bone;
            const node = document.createElement('div');
            node.className = `right-workspace-rig-hierarchy-node${isRoot ? ' is-root-node' : ''}`;
            node.setAttribute('role', 'treeitem');
            node.setAttribute('aria-level', String(isRoot ? 1 : entry.number.split('-').length + 1));
            node.setAttribute('aria-selected', String(this.rigSelectedBoneId === bone.boneId));
            node.tabIndex = this.rigSelectedBoneId === bone.boneId ? 0 : -1;
            node.dataset.rigTreeSelect = 'true';
            node.dataset.rigBoneId = bone.boneId;
            node.dataset.rigDisplayNumber = entry.number || '';
            const card = document.createElement('div');
            card.className = `gui-control gui-control--m right-workspace-rig-hierarchy-card${isRoot ? ' is-root-card' : ''}${readOnly ? ' is-read-only' : ''}`;
            card.dataset.rigBoneCard = 'true';
            card.dataset.rigBoneId = bone.boneId;
            card.dataset.rigParentBoneId = bone.parentBoneId || '';
            card.dataset.rigDisplayNumber = entry.number || '';
            card.draggable = false;
            const number = document.createElement('span');
            number.className = 'right-workspace-rig-hierarchy-number';
            number.textContent = isRoot ? 'ROOT' : entry.number;
            number.setAttribute('aria-hidden', 'true');
            const name = document.createElement('input');
            name.className = 'right-workspace-rig-hierarchy-name-input';
            name.type = 'text';
            name.maxLength = 64;
            name.value = bone.name || (isRoot ? 'Root' : 'Bone');
            name.readOnly = readOnly || this.rigSelectedBoneId !== bone.boneId;
            name.setAttribute('aria-label', `${name.value} · Bone名`);
            name.title = readOnly ? '既存guardにより構造は読み取り専用です。'
                : name.readOnly ? 'Boneを選択すると名前を編集できます。' : 'Bone名を編集';
            name.addEventListener('change', () => {
                const result = this._getRigLensTable()?.setRigLensStaticBoneName?.(
                    this.rigLensTarget?.assetId, this.rigLensTarget?.internalLayerId,
                    bone.boneId, name.value
                );
                if (!result?.ok) {
                    name.value = bone.name || (isRoot ? 'Root' : 'Bone');
                    this.rigStructureStatusMessage = result?.reason || 'Bone名を変更できません。';
                } else {
                    this.rigStructureStatusMessage = '';
                }
                this.sync();
            });
            name.addEventListener('keydown', event => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    name.blur();
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    name.value = bone.name || (isRoot ? 'Root' : 'Bone');
                    name.blur();
                }
            });
            const parent = bones.find(candidate => candidate?.boneId === bone.parentBoneId) || null;
            const parentLabel = parent ? `親 ${parent.name || 'Bone'}` : '単一Root';
            const dragHint = readOnly ? '読み取り専用'
                : isRoot ? '子BoneをここへdropするとRoot直下に戻ります' : 'ドラッグして別Boneの子へ移動';
            node.setAttribute('aria-label', `${isRoot ? 'Root' : `階層 ${entry.number}`} · ${name.value} · ${parentLabel} · ${dragHint}`);
            node.title = `${isRoot ? 'Root（番号対象外）' : `階層 ${entry.number}`} · ${name.value} · ${parentLabel} · ${dragHint}`;
            card.title = node.title;
            card.append(number, name);
            card.addEventListener('click', event => {
                if (event.target === name) {
                    if (this.rigSelectedBoneId !== bone.boneId) {
                        this.rigStructureTreeRestoreFocusId = bone.boneId;
                        this._selectRigLensBone(bone.boneId);
                    }
                    return;
                }
                this.rigStructureTreeRestoreFocusId = bone.boneId;
                this._selectRigLensBone(bone.boneId);
            });
            card.addEventListener('pointerdown', event =>
                this._onRigHierarchyCardPointerDown(event, bone.boneId, card, readOnly));
            card.addEventListener('pointermove', event => this._onRigHierarchyCardPointerMove(event));
            card.addEventListener('pointerup', event => this._onRigHierarchyCardPointerEnd(event));
            card.addEventListener('pointercancel', event =>
                this._onRigHierarchyCardPointerEnd(event, true));
            card.addEventListener('lostpointercapture', event =>
                this._onRigHierarchyCardPointerEnd(event, true));
            node.appendChild(card);
            if (entry.children?.length) {
                node.setAttribute('aria-expanded', 'true');
                const children = document.createElement('div');
                children.className = 'right-workspace-rig-hierarchy-children';
                children.setAttribute('role', 'group');
                entry.children.forEach(child => children.appendChild(makeNode(child)));
                node.appendChild(children);
            }
            return node;
        };

        container.appendChild(makeNode({ bone: board.root, number: '', children: board.children }, true));
        if (this.rigStructureTreeRestoreFocusId) {
            const focusId = this.rigStructureTreeRestoreFocusId;
            const focusTarget = [...container.querySelectorAll('[data-rig-tree-select]')]
                .find(item => item.dataset.rigBoneId === focusId);
            if (focusTarget) {
                focusTarget.focus({ preventScroll: true });
                this.rigStructureTreeRestoreFocusId = null;
            }
        }
        const selected = [...container.querySelectorAll('[data-rig-tree-select]')]
            .find(item => item.dataset.rigBoneId === this.rigSelectedBoneId);
        selected?.scrollIntoView?.({ block: 'nearest' });
        this._scheduleRigHierarchyConnectorRender();
    }

    _scheduleRigHierarchyConnectorRender() {
        if (!this.rigStructureEditorTree?.isConnected) return;
        if (this.rigStructureConnectorFrame != null) {
            cancelAnimationFrame(this.rigStructureConnectorFrame);
        }
        const render = () => {
            this.rigStructureConnectorFrame = null;
            const board = this.rigStructureEditorTree;
            const svg = board?.querySelector('[data-rig-hierarchy-connectors]');
            if (!board || !svg) return;
            const boardRect = board.getBoundingClientRect();
            const cards = [...board.querySelectorAll('[data-rig-bone-card]')];
            const width = Math.max(board.scrollWidth, boardRect.width, 1);
            const height = Math.max(board.scrollHeight, boardRect.height, 1);
            svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
            svg.setAttribute('width', String(width));
            svg.setAttribute('height', String(height));
            svg.replaceChildren();
            const byId = new Map(cards.map(card => [card.dataset.rigBoneId, card]));
            cards.forEach(card => {
                const parent = byId.get(card.dataset.rigParentBoneId);
                if (!parent) return;
                const parentRect = parent.getBoundingClientRect();
                const cardRect = card.getBoundingClientRect();
                const x1 = parentRect.left + parentRect.width / 2 - boardRect.left;
                const y1 = parentRect.bottom - boardRect.top;
                const x2 = cardRect.left + cardRect.width / 2 - boardRect.left;
                const y2 = cardRect.top - boardRect.top;
                const middleY = y1 + Math.max(8, (y2 - y1) / 2);
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', `M ${x1} ${y1} V ${middleY} H ${x2} V ${y2}`);
                path.setAttribute('data-parent-bone-id', parent.dataset.rigBoneId);
                path.setAttribute('data-child-bone-id', card.dataset.rigBoneId);
                svg.appendChild(path);
            });
        };
        this.rigStructureConnectorFrame = typeof requestAnimationFrame === 'function'
            ? requestAnimationFrame(render)
            : (render(), null);
    }

    _inspectRigHierarchyDrop(bones, sourceBoneId, targetBoneId) {
        const source = bones?.find(bone => bone?.boneId === sourceBoneId) || null;
        const target = bones?.find(bone => bone?.boneId === targetBoneId) || null;
        if (!source || !target) return { ok: false, reason: 'bone-not-found' };
        if (source.parentBoneId == null) return { ok: false, reason: 'root-cannot-move' };
        if (sourceBoneId === targetBoneId) return { ok: false, reason: 'self-parent-bone' };
        if (this._getRigBoneDescendants(bones, sourceBoneId).has(targetBoneId)) {
            return { ok: false, reason: 'bone-cycle' };
        }
        if (source.parentBoneId === targetBoneId) return { ok: false, reason: 'same-parent' };
        return { ok: true, source, target };
    }

    _onRigHierarchyCardDragStart(event, boneId, card) {
        if (!this.rigLensActive || this.rigAuthoringKind !== 'deform'
            || this.rigLensMode !== 'setup' || !this.rigStructureEditorDialog?.open) {
            event.preventDefault();
            return;
        }
        const target = this._getRigLensEditTarget();
        const bone = target?.bones?.find(candidate => candidate.boneId === boneId);
        if (!target?.ok || !bone || bone.parentBoneId == null) {
            event.preventDefault();
            return;
        }
        this.rigStructureDrag = {
            boneId,
            assetId: this.rigLensTarget?.assetId,
            internalLayerId: this.rigLensTarget?.internalLayerId
        };
        this.rigStructureStatusMessage = '';
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', boneId);
        }
        card.classList.add('is-dragging');
        this.rigStructureStatus.textContent = `${bone.name || 'Bone'}を移動中 · 別のカードへdropするとその子になります。`;
    }

    _selectRigHierarchyCardImmediately(boneId) {
        if (!this.rigLensActive || this.rigLensMode !== 'setup' || !boneId) return false;
        this.rigSelectedBoneId = boneId;
        this.rigStructureTreeRestoreFocusId = boneId;
        const target = this._getRigLensEditTarget();
        if (target?.ok) this._expandRigBoneAncestors(target.bones, boneId);
        for (const container of [this.rigStructureEditorTree, this.rigCompactBoneTree]) {
            container?.querySelectorAll?.('[data-rig-tree-select]').forEach(item => {
                const selected = item.dataset.rigBoneId === boneId;
                item.setAttribute('aria-selected', String(selected));
                item.tabIndex = selected ? 0 : -1;
                if (item.hasAttribute('aria-pressed')) {
                    item.setAttribute('aria-pressed', String(selected));
                }
                item.closest('.right-workspace-rig-bone-selection-item')
                    ?.classList.toggle('is-selected', selected);
                const nameInput = item.querySelector?.('.right-workspace-rig-hierarchy-name-input');
                if (nameInput) nameInput.readOnly = this.rigStructureEditorReadOnly || !selected;
            });
        }
        return true;
    }

    _onRigHierarchyCardPointerDown(event, boneId, card, readOnly = false) {
        if (event.button !== 0 || event.isPrimary === false
            || !this._selectRigHierarchyCardImmediately(boneId)) return;
        if (readOnly || this.rigStructureEditorReadOnly
            || this.rigPointerGesture || this.rigStructureDrag) return;
        if (event.target?.closest?.('input')) return;
        const target = this._getRigLensEditTarget();
        const bone = target?.bones?.find(candidate => candidate.boneId === boneId);
        if (!target?.ok || !bone || bone.parentBoneId == null) return;
        this.rigStructureDrag = {
            pointerMode: true,
            pointerId: event.pointerId,
            boneId,
            assetId: this.rigLensTarget?.assetId,
            internalLayerId: this.rigLensTarget?.internalLayerId,
            sourceCard: card,
            startX: event.clientX,
            startY: event.clientY,
            moved: false,
            targetCard: null
        };
        try { card.setPointerCapture(event.pointerId); } catch { /* card listeners remain the local terminal */ }
    }

    _onRigHierarchyCardPointerMove(event) {
        const drag = this.rigStructureDrag;
        if (!drag?.pointerMode || drag.pointerId !== event.pointerId) return;
        if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 4) return;
        drag.moved = true;
        drag.sourceCard?.classList.add('is-dragging');
        const hit = document.elementFromPoint?.(event.clientX, event.clientY);
        const targetCard = hit?.closest?.('[data-rig-bone-card]') || null;
        const board = this.rigStructureEditorTree;
        const contained = !!targetCard && board?.contains?.(targetCard) === true;
        const targetId = contained ? targetCard.dataset.rigBoneId : null;
        const target = this._getRigLensEditTarget();
        const sameTarget = target?.ok === true
            && drag.assetId === this.rigLensTarget?.assetId
            && drag.internalLayerId === this.rigLensTarget?.internalLayerId;
        const eligibility = sameTarget && targetId
            ? this._inspectRigHierarchyDrop(target.bones, drag.boneId, targetId)
            : { ok: false, reason: 'target-changed' };
        if (drag.targetCard && drag.targetCard !== targetCard) {
            drag.targetCard.classList.remove('is-drop-target', 'is-drop-invalid');
        }
        drag.targetCard = contained ? targetCard : null;
        if (drag.targetCard) {
            drag.targetCard.classList.toggle('is-drop-target', eligibility.ok);
            drag.targetCard.classList.toggle('is-drop-invalid', !eligibility.ok);
        }
        const source = target?.bones?.find(candidate => candidate.boneId === drag.boneId);
        const destination = target?.bones?.find(candidate => candidate.boneId === targetId);
        this.rigStructureStatus.textContent = eligibility.ok
            ? (source?.name || 'Bone') + 'を' + (destination?.name || 'Bone') + 'の子へ移動'
            : eligibility.reason === 'same-parent'
                ? 'すでにこの親の下にあります。'
                : eligibility.reason === 'bone-cycle'
                    ? '子孫へは移動できません。循環する構造になります。'
                    : eligibility.reason === 'target-changed'
                        ? '別のBoneカードへdropしてください。'
                        : 'このカードへは移動できません。';
        event.preventDefault();
    }

    _onRigHierarchyCardPointerEnd(event, cancelled = false) {
        const drag = this.rigStructureDrag;
        if (!drag?.pointerMode || drag.pointerId !== event.pointerId) return;
        if (cancelled) {
            this._clearRigStructureDragState();
            this.rigStructureStatusMessage = 'Bone移動を取り消しました。';
            this.sync();
            return;
        }
        if (!drag.moved) {
            this._clearRigStructureDragState();
            this.sync();
            return;
        }
        const hit = document.elementFromPoint?.(event.clientX, event.clientY);
        const targetCard = hit?.closest?.('[data-rig-bone-card]') || null;
        if (targetCard && this.rigStructureEditorTree?.contains?.(targetCard)) {
            this._onRigHierarchyCardDrop(event, targetCard.dataset.rigBoneId, targetCard);
        } else {
            this._clearRigStructureDragState();
            this.rigStructureStatusMessage = 'Boneを別のカードへdropしてください。';
            this.sync();
        }
        event.preventDefault();
    }

    _onRigHierarchyCardDragOver(event, targetBoneId, card) {
        const drag = this.rigStructureDrag;
        if (!drag) return;
        event.preventDefault();
        const target = this._getRigLensEditTarget();
        const sameTarget = target?.ok === true
            && drag.assetId === this.rigLensTarget?.assetId
            && drag.internalLayerId === this.rigLensTarget?.internalLayerId;
        const result = sameTarget
            ? this._inspectRigHierarchyDrop(target.bones, drag.boneId, targetBoneId)
            : { ok: false, reason: 'target-changed' };
        card.classList.toggle('is-drop-target', result.ok);
        card.classList.toggle('is-drop-invalid', !result.ok);
        if (event.dataTransfer) event.dataTransfer.dropEffect = result.ok ? 'move' : 'none';
        const source = target?.bones?.find(bone => bone?.boneId === drag.boneId);
        const destination = target?.bones?.find(bone => bone?.boneId === targetBoneId);
        this.rigStructureStatus.textContent = result.ok
            ? `${source?.name || 'Bone'}を${destination?.name || 'Bone'}の子へ移動`
            : result.reason === 'same-parent'
                ? 'すでにこの親の下にあります。'
                : result.reason === 'bone-cycle'
                    ? '子孫へは移動できません。循環する構造になります。'
                    : 'このカードへは移動できません。';
    }

    _onRigHierarchyCardDrop(event, targetBoneId, card) {
        if (!this.rigStructureDrag) return;
        event.preventDefault();
        const drag = this.rigStructureDrag;
        const target = this._getRigLensEditTarget();
        const sameTarget = target?.ok === true
            && drag.assetId === this.rigLensTarget?.assetId
            && drag.internalLayerId === this.rigLensTarget?.internalLayerId;
        const eligibility = sameTarget
            ? this._inspectRigHierarchyDrop(target.bones, drag.boneId, targetBoneId)
            : { ok: false, reason: 'target-changed' };
        if (!eligibility.ok) {
            const message = eligibility.reason === 'same-parent'
                ? 'すでにこの親の下にあります。'
                : eligibility.reason === 'bone-cycle'
                    ? '子孫Boneを親にできません。'
                    : eligibility.reason === 'self-parent-bone'
                        ? 'Bone自身は親にできません。'
                        : 'このBoneをその親へ移動できません。';
            this._clearRigStructureDragState();
            this.rigStructureStatusMessage = message;
            this.rigStructureStatus.textContent = message;
            this.sync();
            return false;
        }
        const result = this._getRigLensTable()?.setRigLensStaticBoneParent?.(
            drag.assetId, drag.internalLayerId, drag.boneId, targetBoneId,
            { appendToSiblingEnd: true }
        );
        if (result?.ok && result.changed) {
            this.rigSelectedBoneId = drag.boneId;
            this.rigStructureTreeRestoreFocusId = drag.boneId;
            const updatedTarget = this._getRigLensEditTarget();
            if (updatedTarget?.ok) this._expandRigBoneAncestors(updatedTarget.bones, drag.boneId);
            this.rigEntryMessage = '';
            this.rigStructureStatusMessage = `${eligibility.source.name || 'Bone'}を${eligibility.target.name || 'Bone'}の下へ移動しました。`;
            this._clearRigStructureDragState();
            this.sync();
            return true;
        }
        const message = result?.ok
            ? '親は変わりませんでした。'
            : result?.reason === 'bone-cycle'
                ? '子孫Boneを親にできません。'
                : result?.reason || 'Boneを移動できませんでした。';
        this._clearRigStructureDragState();
        this.rigStructureStatusMessage = message;
        this.rigStructureStatus.textContent = message;
        this.sync();
        return false;
    }

    _clearRigStructureDropHighlights() {
        this.rigStructureEditorTree?.querySelectorAll?.('[data-rig-bone-card]').forEach(card => {
            card.classList.remove('is-dragging', 'is-drop-target', 'is-drop-invalid');
        });
    }

    _clearRigStructureDragState() {
        if (!this.rigStructureDrag) return;
        this._clearRigStructureDropHighlights();
        this.rigStructureDrag = null;
    }

    _onRigHierarchyCardDragEnd() {
        if (!this.rigStructureDrag) return;
        this._clearRigStructureDragState();
        this.sync();
    }

    _onRigBoneTreeKeyDown(event) {
        if (event.altKey || event.ctrlKey
            || event.metaKey || event.shiftKey
            || event.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
        const tree = event.currentTarget;
        const rows = [...tree.querySelectorAll('[data-rig-tree-select]')];
        if (rows.length === 0) return;
        const currentItem = event.target?.closest?.('[data-rig-tree-select]');
        if (['Enter', ' '].includes(event.key) && currentItem) {
            event.preventDefault();
            this.rigStructureTreeRestoreFocusId = currentItem.dataset.rigBoneId;
            this._selectRigLensBone(currentItem.dataset.rigBoneId);
            return;
        }
        if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
        const current = rows.findIndex(row => row.dataset.rigBoneId === this.rigSelectedBoneId);
        const start = current < 0 ? (event.key === 'ArrowDown' ? -1 : rows.length) : current;
        const nextIndex = Math.max(0, Math.min(rows.length - 1,
            start + (event.key === 'ArrowDown' ? 1 : -1)));
        const nextId = rows[nextIndex]?.dataset.rigBoneId;
        if (!nextId) return;
        event.preventDefault();
        this.rigStructureTreeRestoreFocusId = nextId;
        this._selectRigLensBone(nextId);
        const activeTree = this.rigStructureEditorDialog?.open
            ? this.rigStructureEditorTree : this.rigCompactBoneTree;
        const nextRow = [...(activeTree?.querySelectorAll('[data-rig-tree-select]') || [])]
            .find(row => row.dataset.rigBoneId === nextId);
        nextRow?.focus({ preventScroll: true });
    }

    _createRigLensStaticRoot(name = 'Root') {
        if (!this.rigLensActive || this.rigAuthoringKind !== 'deform'
            || this.rigLensMode !== 'setup' || this.rigPointerGesture) return false;
        const target = this._getRigLensEditTarget();
        const result = target?.ok
            ? this._getRigLensTable()?.createRigLensStaticStructureBone?.(
                this.rigLensTarget.assetId, this.rigLensTarget.internalLayerId,
                { kind: 'root', name: name?.trim?.() || 'Root' }
            )
            : { ok: false, reason: target?.reason || '対象Rasterを確認してください。' };
        if (result?.ok && result.changed) {
            this.rigSelectedBoneId = result.bone.boneId;
            this.rigStructureCreatedBoneIds.add(result.bone.boneId);
            this.rigStructureNameInput.value = `Bone ${target.bones.length + 1}`;
            this.rigStructureStatusMessage = '';
            this.rigEntryMessage = '';
        } else {
            this.rigEntryMessage = result?.reason || 'Rootを作成できませんでした。';
        }
        this.rigPlacementMode = null;
        this.sync();
        return result?.ok === true;
    }

    _deleteRigLensStructureBone() {
        if (!this.rigLensActive || this.rigAuthoringKind !== 'deform'
            || this.rigLensMode !== 'setup' || this.rigPointerGesture) return false;
        const target = this._getRigLensEditTarget();
        const selected = target?.bones?.find(bone => bone.boneId === this.rigSelectedBoneId) || null;
        if (!target?.ok || !selected) {
            this.rigStructureStatusMessage = target?.reason || '削除するBoneを選択してください。';
            this.sync();
            return false;
        }
        if (selected.parentBoneId == null) {
            this.rigStructureStatusMessage = 'Rootは削除できません。';
            this.sync();
            return false;
        }
        if (this._getRigBoneDescendants(target.bones, selected.boneId).size > 0) {
            this.rigStructureStatusMessage = '子孫Boneを先に整理してください。親の付け替えや一括削除は行いません。';
            this.sync();
            return false;
        }
        const result = this._getRigLensTable()?.removeRigLensStaticBone?.(
            this.rigLensTarget.assetId, this.rigLensTarget.internalLayerId, selected.boneId
        );
        if (!result?.ok || !result.changed) {
            this.rigStructureStatusMessage = result?.reason || 'Boneを削除できませんでした。';
            this.sync();
            return false;
        }
        const fallbackId = selected.parentBoneId
            || target.bones.find(bone => bone.parentBoneId == null)?.boneId || null;
        this.rigSelectedBoneId = fallbackId;
        this.rigStructureTreeRestoreFocusId = fallbackId;
        this.rigStructureCreatedBoneIds.delete(selected.boneId);
        this.rigTreeCollapsedBoneIds.delete(selected.boneId);
        this.rigStructureStatusMessage = `${selected.name || 'Bone'}を削除しました。Undoで復元できます。`;
        this.rigEntryMessage = '';
        this.sync();
        return true;
    }

    _createRigLensStructureBone(kind) {
        if (!this.rigLensActive || this.rigAuthoringKind !== 'deform'
            || this.rigLensMode !== 'setup' || this.rigPointerGesture) return false;
        const target = this._getRigLensEditTarget();
        const selected = target?.bones?.find(bone => bone.boneId === this.rigSelectedBoneId) || null;
        const root = target?.bones?.find(bone => bone.parentBoneId == null) || null;
        const parentBoneId = kind === 'board'
            ? selected?.boneId || root?.boneId
            : kind === 'sibling' ? selected?.parentBoneId : selected?.boneId;
        if (!target?.ok || !parentBoneId || (kind !== 'board' && !selected)) {
            this.rigEntryMessage = target?.reason
                || (kind === 'board' ? '先に単一Rootを作成してください。'
                    : kind === 'sibling' ? 'Root以外のBoneを選択して兄弟Boneを追加してください。'
                        : '子Boneを追加する親Boneを選択してください。');
            this.sync();
            return false;
        }
        const name = this.rigStructureNameInput.value.trim() || `Bone ${target.bones.length}`;
        const result = this._getRigLensTable()?.createRigLensStaticStructureBone?.(
            this.rigLensTarget.assetId, this.rigLensTarget.internalLayerId,
            { kind: 'child', parentBoneId, name }
        );
        if (result?.ok && result.changed) {
            this.rigSelectedBoneId = result.bone.boneId;
            this.rigStructureTreeRestoreFocusId = result.bone.boneId;
            this.rigStructureCreatedBoneIds.add(result.bone.boneId);
            this._expandRigBoneAncestors([...target.bones, result.bone], result.bone.boneId);
            this.rigStructureNameInput.value = `Bone ${target.bones.length + 1}`;
            this.rigStructureStatusMessage = '';
            this.rigEntryMessage = '';
        } else {
            this.rigEntryMessage = result?.reason || 'Bone構造を追加できませんでした。';
        }
        this.sync();
        return result?.ok === true;
    }

    _armRigPlacement(kind) {
        if (!this.rigLensActive || this.rigAuthoringKind !== 'deform'
            || this.rigLensMode !== 'setup' || kind !== 'child' || this.rigPointerGesture) return false;
        if (this.rigPlacementMode === kind) {
            this._cancelRigPlacement();
            return true;
        }
        const target = this._getRigLensEditTarget();
        const table = this._getRigLensTable();
        if (!target?.ok || table?.isPlaying) {
            this.rigEntryMessage = target?.reason || '再生中はRIGを編集できません。';
            this.sync();
            return;
        }
        if (target.bones.length === 0
            || !target.bones.some(bone => bone.boneId === this.rigSelectedBoneId)) return;
        this.rigPlacementMode = kind;
        this.rigEntryMessage = '';
        this.sync();
        return true;
    }

    _onRigChildPlacementClick() {
        return this._armRigPlacement('child');
    }

    _onRigWindowBlur() {
        if (this.rigPointerGesture && this.rigPointerGesture.kind !== 'part-pivot-overlay') {
            this._cancelRigPlacement();
        } else if (this.rigPlacementMode === 'child') {
            this._cancelRigPlacement();
        }
        if (this.rigStructureDrag?.pointerMode) {
            this._clearRigStructureDragState();
            this.sync();
        }
    }

    _cancelRigPlacement() {
        const gesture = this.rigPointerGesture;
        if (gesture?.kind === 'static-bone-bind' && gesture.changed) {
            this._getRigLensTable()?.cancelRigLensStaticBoneGesture?.(
                gesture.assetId, gesture.beforeState
            );
        } else if (['pose', 'part-pose', 'part-ik'].includes(gesture?.kind)) {
            this._restoreRigPoseGesturePreview(gesture);
        }
        this.rigPointerGesture = null;
        this.rigPlacementMode = null;
        this.sync();
    }

    _startRigStaticBoneGesture(bone, operation, event) {
        if (!this.rigLensActive || this.rigAuthoringKind !== 'deform'
            || this.rigLensMode !== 'setup' || this.rigPointerGesture
            || event.button !== 0 || event.isPrimary === false
            || this.layerSystem?.cameraSystem?.isCanvasMoveMode?.()) return false;
        const ids = this.rigLensTarget;
        const table = this._getRigLensTable();
        const started = table?.beginRigLensStaticBoneGesture?.(
            ids?.assetId, ids?.internalLayerId, bone.boneId, event
        );
        if (!started?.ok) {
            this.rigEntryMessage = started?.reason || 'Boneを編集できません。';
            this.sync();
            event.preventDefault();
            event.stopImmediatePropagation();
            return true;
        }
        const bind = started.startTransform;
        this.rigSelectedBoneId = bone.boneId;
        this.rigPointerGesture = {
            kind: 'static-bone-bind',
            operation,
            pointerId: event.pointerId,
            assetId: ids.assetId,
            layerId: ids.internalLayerId,
            boneId: bone.boneId,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startPointer: started.startPointer,
            startTransform: bind,
            permissionMode: started.permissionMode,
            root: { x: bind.x, y: bind.y },
            startAngle: Math.atan2(
                started.startPointer.y - bind.y,
                started.startPointer.x - bind.x
            ),
            beforeState: started.beforeState,
            moved: false,
            changed: false
        };
        try { window.coreEngine?.getApp?.()?.canvas?.setPointerCapture(event.pointerId); }
        catch { /* document listeners own the pointer terminal */ }
        this.rigEntryMessage = '';
        this.sync();
        event.preventDefault();
        event.stopImmediatePropagation();
        return true;
    }

    _bindRigArtwork() {
        if (!this.rigLensActive || this.rigAuthoringKind !== 'deform'
            || this.rigLensMode !== 'setup' || !this.rigLensTarget || this.rigPointerGesture) return false;
        const { assetId, internalLayerId } = this.rigLensTarget;
        const table = this._getRigLensTable();
        const target = table?.getRigLensStaticTarget?.(assetId, internalLayerId, {
            allowExistingOtherRasterBindings: true
        });
        if (!target?.ok) {
            this.rigEntryMessage = target?.reason || 'CAF Rasterを確認できないためArtworkを接続できません。';
            this.sync();
            return false;
        }
        if (target.bones.length === 0) {
            this.rigEntryMessage = '先にRootを配置してください。';
            this.sync();
            return false;
        }
        const result = table?.generateRigLensArtworkBinding?.(assetId, internalLayerId);
        if (!result?.ok) {
            const reason = result?.reason;
            this.rigEntryMessage = RIG_BINDING_FAILURE_MESSAGES[reason]
                || (typeof reason === 'string' && /[ぁ-んァ-ヶ一-龠]/u.test(reason)
                    ? reason
                    : 'Artworkを接続できませんでした。詳細メッセージを確認してください。');
            this.sync();
            return false;
        }

        const boundTarget = table?.getRigLensStaticTarget?.(assetId, internalLayerId, {
            allowBound: true
        });
        if (!boundTarget?.ok) {
            this.rigEntryMessage = boundTarget?.reason
                || 'Artwork接続後のBone構造を確認できません。MOTIONへ移動していません。';
            this.sync();
            return false;
        }
        const candidateIds = [...new Set([
            this.rigSelectedBoneId,
            boundTarget.bones.find(bone => bone.parentBoneId == null)?.boneId,
            ...boundTarget.bones.map(bone => bone.boneId)
        ].filter(Boolean))];
        const motionTarget = candidateIds
            .map(boneId => table?.getRigLensMotionTarget?.(assetId, internalLayerId, boneId))
            .find(candidate => candidate?.ok === true);
        if (!motionTarget?.ok) {
            this.rigEntryMessage = 'Artworkは接続されましたが、有効なMotion Boneを確認できません。SETUPに留まります。';
            this.sync();
            return false;
        }

        this.rigSelectedBoneId = motionTarget.bone.boneId;
        this.rigEntryMessage = '';
        return this._setRigLensMode('motion');
    }

    _onRigCanvasDown(event) {
        if (!this.rigLensActive || this.rigPointerGesture
            || event.button !== 0 || event.isPrimary === false) return;
        const canvas = window.coreEngine?.getApp?.()?.canvas;
        const isCanvas = event.target === canvas;
        const boneMarker = this.rigPlacementMode === 'child'
            ? event.target?.closest?.('.right-workspace-rig-bone-overlay .right-workspace-rig-bone-marker')
            : null;
        if (!canvas || (!isCanvas && !boneMarker)
            || this.layerSystem?.cameraSystem?.isCanvasMoveMode?.()) return;
        if (!this.rigPlacementMode) {
            if (!isCanvas) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        const ids = this.rigLensTarget;
        const table = this._getRigLensTable();
        const parentTarget = this.rigPlacementMode === 'child'
            ? this._getRigLensEditTarget() : null;
        const parentBone = parentTarget?.bones?.find(bone => bone.boneId === this.rigSelectedBoneId);
        if (this.rigPlacementMode === 'child' && (!parentBone
            || (boneMarker && (boneMarker.dataset?.rigBoneId !== parentBone.boneId
                || !boneMarker.classList.contains('right-workspace-rig-bone-tip'))))) {
            this.rigEntryMessage = parentBone
                ? '選択中の親Boneの先端markerからdragしてください。'
                : '子Boneを追加する親Boneを選択してください。';
            this.sync();
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        const start = table?.projectRigLensCanvasPoint?.(ids.assetId, ids.internalLayerId, event);
        if (!start || !Number.isFinite(start.x) || !Number.isFinite(start.y)) {
            this.rigEntryMessage = 'Canvas座標を取得できません。対象と表示倍率を確認してください。';
            this.sync();
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        this.rigPointerGesture = {
            pointerId: event.pointerId,
            assetId: ids.assetId,
            layerId: ids.internalLayerId,
            kind: this.rigPlacementMode,
            parentBoneId: this.rigPlacementMode === 'child' ? this.rigSelectedBoneId : null,
            start,
            startClientX: event.clientX,
            startClientY: event.clientY,
            currentClientX: event.clientX,
            currentClientY: event.clientY,
            moved: false
        };
        try { canvas.setPointerCapture(event.pointerId); } catch { /* document capture still ends the gesture */ }
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    _startRigPoseGesture(bone, event, operation = 'rotate') {
        if (!this.rigLensActive || this.rigLensMode !== 'motion' || this.rigPointerGesture
            || event.button !== 0 || event.isPrimary === false
            || this.layerSystem?.cameraSystem?.isCanvasMoveMode?.()) return;
        const ids = this.rigLensTarget;
        const table = this._getRigLensTable();
        const target = table?.getRigLensMotionTarget?.(ids.assetId, ids.internalLayerId, bone.boneId);
        if (!target?.ok) {
            if (this._hasRigPosePreview(table)) {
                this.rigEntryMessage = target?.reason
                    || '未確定Poseがあります。KEY確定または取消を先に行ってください。';
            } else {
                this.rigSelectedBoneId = bone.boneId;
                this.rigLensMode = 'setup';
                this.rigEntryMessage = target?.reason || '選択BoneのMotion条件を確認してください。';
            }
            this.sync();
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        const start = operation === 'move'
            ? table?.projectRigLensBoneMotionLocalPoint?.(
                ids.assetId, ids.internalLayerId, bone.boneId, event
            )
            : table?.projectRigLensCanvasPoint?.(ids.assetId, ids.internalLayerId, event);
        if (!start) {
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        this.rigSelectedBoneId = bone.boneId;
        this.rigPointerGesture = {
            kind: 'pose', operation, pointerId: event.pointerId, assetId: ids.assetId,
            layerId: ids.internalLayerId, boneId: bone.boneId,
            startPointer: operation === 'move' ? start : null,
            startClientX: event.clientX, startClientY: event.clientY,
            startAngle: operation === 'rotate'
                ? Math.atan2(start.y - bone.rootProject.y, start.x - bone.rootProject.x)
                : null,
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

    _startRigPartPoseGesture(item, event, operation = 'rotate') {
        if (!this.rigLensActive || this.rigAuthoringKind !== 'part'
            || this.rigLensMode !== 'motion' || this.rigPointerGesture
            || event.button !== 0 || event.isPrimary === false
            || this.layerSystem?.cameraSystem?.isCanvasMoveMode?.()) return;
        const assetId = this.rigLensTarget.assetId;
        const table = this._getRigLensTable();
        const target = table?.getRigLensPartMotionTarget?.(assetId, item.partId);
        const start = operation === 'move'
            ? table?.projectRigLensPartMotionLocalPoint?.(assetId, item.partId, event)
            : table?.projectRigLensPartCanvasPoint?.(assetId, event);
        if (!target?.ok || !start) return;
        if (this.rigSelectedPartId !== item.partId) this.rigPartIkEffectorId = null;
        this.rigSelectedPartId = item.partId;
        this.rigPointerGesture = {
            kind: 'part-pose', pointerId: event.pointerId, assetId, partId: item.partId,
            operation,
            startClientX: event.clientX, startClientY: event.clientY,
            startPointer: operation === 'move' ? start : null,
            startAngle: operation === 'rotate'
                ? Math.atan2(start.y - item.rootProject.y, start.x - item.rootProject.x)
                : null,
            rootProject: item.rootProject,
            startTransform: { ...(target.preview?.transform || target.sampled) },
            beforePreview: target.preview?.transform ? { ...target.preview.transform } : null,
            moved: false
        };
        try { window.coreEngine?.getApp?.()?.canvas?.setPointerCapture(event.pointerId); } catch { /* document owns terminal */ }
        this.sync();
        event.preventDefault();
        event.stopImmediatePropagation();
        return true;
    }

    _startRigPartIkGesture(item, event) {
        if (!this.rigLensActive || this.rigAuthoringKind !== 'part'
            || this.rigLensMode !== 'motion' || this.rigPointerGesture
            || this.rigPartIkEffectorId !== item.partId
            || event.button !== 0 || event.isPrimary === false
            || this.layerSystem?.cameraSystem?.isCanvasMoveMode?.()) return false;
        const consume = () => {
            event.preventDefault();
            event.stopImmediatePropagation();
        };
        const assetId = this.rigLensTarget?.assetId;
        const table = this._getRigLensTable();
        const basePose = table?.getRigLensPartIkChainContext?.(assetId, item.partId);
        if (!basePose?.ok) {
            this.rigEntryMessage = basePose?.reason || 'IK chainを使用できません。';
            this.sync();
            consume();
            return true;
        }
        const startPointer = table?.projectRigLensPartCanvasPoint?.(assetId, event);
        if (!startPointer || ![startPointer.x, startPointer.y].every(Number.isFinite)) {
            this.rigEntryMessage = 'Canvas座標を取得できないため、IK操作を開始できません。';
            this.sync();
            consume();
            return true;
        }
        this.rigSelectedPartId = item.partId;
        this.rigPointerGesture = {
            kind: 'part-ik',
            pointerId: event.pointerId,
            assetId,
            partId: item.partId,
            basePose,
            startPointer: { x: startPointer.x, y: startPointer.y },
            startClientX: event.clientX,
            startClientY: event.clientY,
            beforePreviews: new Map([
                [basePose.rootPartId, basePose.rootPreview],
                [basePose.jointPartId, basePose.jointPreview]
            ]),
            moved: false
        };
        try { window.coreEngine?.getApp?.()?.canvas?.setPointerCapture(event.pointerId); }
        catch { /* document listeners own the pointer terminal */ }
        this.rigEntryMessage = '';
        this.sync();
        consume();
        return true;
    }

    _onRigCanvasMove(event) {
        const gesture = this.rigPointerGesture;
        if (gesture?.kind === 'static-bone-bind') {
            if (gesture.pointerId !== event.pointerId) return;
            if (Math.hypot(event.clientX - gesture.startClientX,
                event.clientY - gesture.startClientY) < 2 && !gesture.moved) return;
            const table = this._getRigLensTable();
            const point = table?.projectRigLensStaticBonePoint?.(
                gesture.assetId, gesture.layerId, gesture.boneId, event
            );
            if (![point?.x, point?.y].every(Number.isFinite)) {
                event.preventDefault();
                event.stopImmediatePropagation();
                this.rigEntryMessage = 'Canvas座標を取得できず、Bind位置の編集を取り消しました。';
                this._cancelRigPlacement();
                return;
            }
            const transform = gesture.operation === 'rotate'
                ? resolveBoneRotationHandleDrag({
                    startTransform: gesture.startTransform,
                    root: gesture.root,
                    startAngle: gesture.startAngle,
                    currentPointer: point
                })
                : resolveBoneRootHandleDrag({
                    startTransform: gesture.startTransform,
                    startPointer: gesture.startPointer,
                    currentPointer: point
                });
            const result = table?.previewRigLensStaticBoneBind?.(
                gesture.assetId, gesture.layerId, gesture.boneId, transform
            );
            if (!result?.ok) {
                event.preventDefault();
                event.stopImmediatePropagation();
                this.rigEntryMessage = result?.reason || 'Bind位置を編集できません。';
                this._cancelRigPlacement();
                return;
            }
            gesture.changed = gesture.changed || result.changed === true;
            gesture.moved = gesture.moved || result.changed === true;
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        if (gesture?.kind === 'child' && gesture.pointerId === event.pointerId) {
            const table = this._getRigLensTable();
            const point = table?.projectRigLensCanvasPoint?.(
                gesture.assetId, gesture.layerId, event
            );
            if (![point?.x, point?.y].every(Number.isFinite)) {
                event.preventDefault();
                event.stopImmediatePropagation();
                this.rigEntryMessage = 'Canvas座標を取得できず、子Bone配置を取り消しました。';
                this._cancelRigPlacement();
                return;
            }
            gesture.currentClientX = event.clientX;
            gesture.currentClientY = event.clientY;
            gesture.moved = gesture.moved || Math.hypot(
                event.clientX - gesture.startClientX,
                event.clientY - gesture.startClientY
            ) >= 2;
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        if (!['pose', 'part-pose', 'part-ik'].includes(gesture?.kind)
            || gesture.pointerId !== event.pointerId) return;
        if (Math.hypot(event.clientX - gesture.startClientX,
            event.clientY - gesture.startClientY) < 2 && !gesture.moved) return;
        const table = this._getRigLensTable();
        const point = gesture.kind === 'part-ik'
            ? table?.projectRigLensPartCanvasPoint?.(gesture.assetId, event)
            : gesture.kind === 'part-pose'
            ? gesture.operation === 'move'
                ? table?.projectRigLensPartMotionLocalPoint?.(gesture.assetId, gesture.partId, event)
                : table?.projectRigLensPartCanvasPoint?.(gesture.assetId, event)
            : gesture.kind === 'pose' && gesture.operation === 'move'
                ? table?.projectRigLensBoneMotionLocalPoint?.(
                    gesture.assetId, gesture.layerId, gesture.boneId, event
                )
            : table?.projectRigLensCanvasPoint?.(gesture.assetId, gesture.layerId, event);
        if (!point) return;
        const targetPoint = gesture.kind === 'part-ik' ? {
            x: gesture.basePose.points.effector.x + point.x - gesture.startPointer.x,
            y: gesture.basePose.points.effector.y + point.y - gesture.startPointer.y
        } : null;
        const transform = gesture.kind === 'pose' && gesture.operation === 'move'
            ? resolveBoneRootHandleDrag({
                startTransform: gesture.startTransform,
                startPointer: gesture.startPointer,
                currentPointer: point
            })
            : gesture.kind === 'part-pose' && gesture.operation === 'move'
            ? resolvePartTransformHandleDrag({
                mode: 'move', startTransform: gesture.startTransform,
                startPointer: gesture.startPointer, currentPointer: point
            })
            : gesture.kind === 'part-ik' ? null : resolveBoneRotationHandleDrag({
                startTransform: gesture.startTransform, root: gesture.rootProject,
                currentPointer: point, startAngle: gesture.startAngle
            });
        const result = gesture.kind === 'part-ik'
            ? table?.previewRigLensPartIkTarget?.(
                gesture.assetId, gesture.partId, targetPoint, gesture.basePose
            )
            : gesture.kind === 'part-pose'
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
        if (gesture.kind === 'pose' || gesture.kind === 'part-pose' || gesture.kind === 'part-ik') {
            if (!gesture.moved) {
                this._restoreRigPoseGesturePreview(gesture);
            } else {
                const table = this._getRigLensTable();
                const result = gesture.kind === 'pose'
                    ? table?.commitRigLensBoneKey?.(
                        gesture.assetId, gesture.layerId, gesture.boneId
                    )
                    : table?.commitRigLensPartPoseFrame?.(gesture.assetId);
                if (!result?.ok) {
                    this._restoreRigPoseGesturePreview(gesture);
                    this.rigEntryMessage = result?.reason || 'Motion KEYへ反映できませんでした。';
                } else {
                    this.rigEntryMessage = '';
                }
            }
            this.sync();
            return;
        }
        if (gesture.kind === 'static-bone-bind') {
            const valid = this.rigLensActive
                && this.rigAuthoringKind === 'deform'
                && this.rigLensMode === 'setup'
                && this.rigLensTarget?.assetId === gesture.assetId
                && this.rigLensTarget?.internalLayerId === gesture.layerId;
            const table = this._getRigLensTable();
            const result = valid
                ? table?.finishRigLensStaticBoneGesture?.(
                    gesture.assetId, gesture.layerId, gesture.boneId,
                    gesture.startTransform, gesture.beforeState, gesture.permissionMode
                )
                : { ok: false, reason: '対象が変わったためBind位置の編集を取り消しました。' };
            if (!result?.ok) {
                table?.cancelRigLensStaticBoneGesture?.(gesture.assetId, gesture.beforeState);
                this.rigEntryMessage = result?.reason || 'Bind位置の編集を取り消しました。';
            } else {
                if (gesture.changed && !result.changed) {
                    table?.cancelRigLensStaticBoneGesture?.(gesture.assetId, gesture.beforeState);
                }
                this.rigEntryMessage = '';
            }
            this.sync();
            return;
        }
        if (!this.rigLensActive || this.rigPlacementMode !== gesture.kind
            || this.rigLensTarget?.assetId !== gesture.assetId
            || this.rigLensTarget?.internalLayerId !== gesture.layerId) {
            this._cancelRigPlacement();
            return;
        }
        if (gesture.kind === 'child') {
            const dragDistance = Math.hypot(
                event.clientX - gesture.startClientX,
                event.clientY - gesture.startClientY
            );
            if (!gesture.moved && dragDistance < 2) {
                this.rigEntryMessage = '選択中の親Bone先端からCanvas上へdragしてください。';
                this.sync();
                return;
            }
            const target = this._getRigLensEditTarget();
            if (this.rigSelectedBoneId !== gesture.parentBoneId
                || !target?.bones?.some(bone => bone.boneId === gesture.parentBoneId)) {
                this.rigEntryMessage = '親Boneまたは対象が変わったため、子Bone配置を取り消しました。';
                this._cancelRigPlacement();
                return;
            }
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
        if (this.rigPointerGesture.kind === 'child') {
            event.preventDefault();
            event.stopImmediatePropagation();
            this.rigEntryMessage = '子Bone配置を取り消しました。';
        }
        try { window.coreEngine?.getApp?.()?.canvas?.releasePointerCapture(event.pointerId); } catch { /* already released */ }
        this._cancelRigPlacement();
    }

    _restoreRigPoseGesturePreview(gesture) {
        const table = this._getRigLensTable();
        if (gesture.kind === 'part-ik') {
            for (const [partId, transform] of gesture.beforePreviews || []) {
                if (transform) table?.previewRigLensPartPose?.(gesture.assetId, partId, transform);
                else table?.discardRigLensPartPosePreview?.(gesture.assetId, partId);
            }
            return;
        }
        if (gesture.kind === 'part-pose') {
            if (gesture.beforePreview) {
                table?.previewRigLensPartPose?.(gesture.assetId, gesture.partId, gesture.beforePreview);
            } else {
                table?.discardRigLensPartPosePreview?.(gesture.assetId, gesture.partId);
            }
            return;
        }
        table?.restoreRigLensBonePoseDraft?.(
            gesture.assetId, gesture.layerId, gesture.boneId, gesture.beforePreview
        );
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
        const childPlacementActive = this.rigPlacementMode === 'child';
        this.rigOverlay.classList.toggle('is-child-placement', childPlacementActive);
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
            const placementGesture = this.rigPointerGesture?.kind === 'child'
                ? this.rigPointerGesture : null;
            const staticBoneEditAllowed = this.rigAuthoringKind === 'deform'
                && this.rigLensMode === 'setup'
                && table?.getRigLensStaticBindGestureTarget?.(
                    ids?.assetId, ids?.internalLayerId
                )?.ok === true;
            const key = JSON.stringify([
                bones, selectedId, this.rigLensMode, this.rigAuthoringKind, staticBoneEditAllowed,
                this.rigPartIkEffectorId, this.rigPlacementMode,
                placementGesture && [placementGesture.parentBoneId, placementGesture.moved,
                    placementGesture.currentClientX, placementGesture.currentClientY]
            ]);
            if (this.rigOverlay.dataset.geometry !== key) {
                this.rigOverlay.dataset.geometry = key;
                const ns = 'http://www.w3.org/2000/svg';
                const staticSetup = this.rigAuthoringKind === 'deform'
                    && this.rigLensMode === 'setup';
                const bonesById = new Map(bones.map(bone => [bone.boneId, bone]));
                const parentLinks = staticSetup ? bones.flatMap(bone => {
                    const parent = bonesById.get(bone.parentBoneId);
                    if (!parent) return [];
                    const distance = Math.hypot(parent.head.x - bone.head.x, parent.head.y - bone.head.y);
                    if (!Number.isFinite(distance) || distance < 2) return [];
                    const link = document.createElementNS(ns, 'line');
                    link.classList.add('right-workspace-rig-parent-link');
                    link.setAttribute('x1', parent.head.x);
                    link.setAttribute('y1', parent.head.y);
                    link.setAttribute('x2', bone.head.x);
                    link.setAttribute('y2', bone.head.y);
                    link.setAttribute('data-parent-bone-id', parent.boneId);
                    link.setAttribute('data-child-bone-id', bone.boneId);
                    return [link];
                }) : [];
                const svgArcPath = (cx, cy, radius, from, to) => {
                    const x0 = cx + Math.cos(from) * radius;
                    const y0 = cy + Math.sin(from) * radius;
                    const x1 = cx + Math.cos(to) * radius;
                    const y1 = cy + Math.sin(to) * radius;
                    const large = Math.abs(to - from) > Math.PI ? 1 : 0;
                    const sweep = to > from ? 1 : 0;
                    return `M${x0} ${y0} A${radius} ${radius} 0 ${large} ${sweep} ${x1} ${y1}`;
                };
                // Short chevrons at both arc ends communicate "swing around this pivot".
                const svgArcArrowPath = (cx, cy, radius, from, to, size = 3.5) => [from, to]
                    .map((angle, index) => {
                        const direction = index === 0 ? -1 : 1;
                        const x = cx + Math.cos(angle) * radius;
                        const y = cy + Math.sin(angle) * radius;
                        const tx = -Math.sin(angle) * direction;
                        const ty = Math.cos(angle) * direction;
                        const nx = Math.cos(angle);
                        const ny = Math.sin(angle);
                        const bx = x - tx * size;
                        const by = y - ty * size;
                        return `M${bx + nx * size * 0.8} ${by + ny * size * 0.8}L${x} ${y}`
                            + `L${bx - nx * size * 0.8} ${by - ny * size * 0.8}`;
                    }).join(' ');
                const boneAngle = bone => Math.atan2(bone.tail.y - bone.head.y, bone.tail.x - bone.head.x);
                const setLayer = (node, layer) => {
                    node.setAttribute('data-rig-layer', String(layer));
                    return node;
                };
                const makeRotateAffordance = (bone, {
                    radius, halfSpan, className, label, onPointerDown, extraHits = []
                }) => {
                    const group = document.createElementNS(ns, 'g');
                    const angle = Number.isFinite(boneAngle(bone)) ? boneAngle(bone) : 0;
                    const from = angle - halfSpan;
                    const to = angle + halfSpan;
                    group.classList.add('right-workspace-rig-rotate-affordance', className);
                    group.setAttribute('data-rig-bone-id', bone.boneId || '');
                    group.setAttribute('data-rig-operation', 'rotate');
                    group.setAttribute('role', 'button');
                    group.setAttribute('aria-label', label);
                    group.setAttribute('title', label);
                    const hit = document.createElementNS(ns, 'path');
                    hit.classList.add('right-workspace-rig-rotate-hit');
                    hit.setAttribute('d', svgArcPath(bone.head.x, bone.head.y, radius, from, to));
                    const arc = document.createElementNS(ns, 'path');
                    arc.classList.add('right-workspace-rig-rotate-arc');
                    arc.setAttribute('d', `${svgArcPath(bone.head.x, bone.head.y, radius, from, to)} `
                        + svgArcArrowPath(bone.head.x, bone.head.y, radius, from, to));
                    group.append(...extraHits, hit, arc);
                    group.addEventListener('pointerdown', event => {
                        if (event.button !== 0) return;
                        onPointerDown(event);
                    });
                    return group;
                };
                const nodes = bones.flatMap(bone => {
                    const line = staticSetup ? null : document.createElementNS(ns, 'line');
                    const isStaticRoot = this.rigAuthoringKind === 'deform'
                        && this.rigLensMode === 'setup' && bone.parentBoneId == null;
                    const partMotionHandle = this.rigAuthoringKind === 'part'
                        && this.rigLensMode === 'motion';
                    const boneMotion = this.rigAuthoringKind === 'deform'
                        && this.rigLensMode === 'motion';
                    const selectedBoneMotion = boneMotion
                        && this.rigSelectedBoneId === bone.boneId;
                    // Every joint on an explicitly safe Bind target is a direct position handle.
                    const staticBoneBindDraggable = staticBoneEditAllowed;
                    const staticBoneMoveHandle = staticBoneEditAllowed
                        && this.rigSelectedBoneId === bone.boneId;
                    if (line) {
                        line.classList.add('right-workspace-rig-bone-line');
                        line.classList.toggle('is-selected', selectedBoneMotion);
                        line.setAttribute('x1', bone.head.x);
                        line.setAttribute('y1', bone.head.y);
                        line.setAttribute('x2', bone.tail.x);
                        line.setAttribute('y2', bone.tail.y);
                        setLayer(line, 1);
                    }
                    const marker = document.createElementNS(ns, 'circle');
                    marker.classList.add('right-workspace-rig-bone-marker');
                    if (isStaticRoot) marker.classList.add('right-workspace-rig-bone-root-marker');
                    marker.classList.toggle('is-selected', (bone.partId || bone.boneId) === selectedId);
                    marker.setAttribute('data-rig-bone-id', bone.boneId || '');
                    marker.setAttribute('cx', bone.head.x);
                    marker.setAttribute('cy', bone.head.y);
                    marker.setAttribute('r', boneMotion ? '6' : isStaticRoot ? '10' : '9');
                    marker.setAttribute('role', 'button');
                    marker.classList.toggle('right-workspace-rig-bone-move-handle', staticBoneMoveHandle);
                    marker.classList.toggle('is-bind-draggable', staticBoneBindDraggable);
                    marker.classList.toggle('right-workspace-rig-part-move-handle', partMotionHandle);
                    marker.classList.toggle('right-workspace-rig-bone-motion-origin', boneMotion);
                    const isIkTarget = partMotionHandle
                        && this.rigPartIkEffectorId === bone.partId;
                    marker.classList.toggle('right-workspace-rig-part-ik-target', isIkTarget);
                    const boneName = bone.name || (isStaticRoot ? 'Root' : 'Bone');
                    const markerLabel = isIkTarget
                        ? `Part ${bone.partId}をIK手先としてドラッグ`
                        : partMotionHandle
                            ? `Part ${bone.partId}を選択、ドラッグして移動`
                        : this.rigAuthoringKind === 'part'
                            ? `Part ${bone.partId}を選択`
                        : staticBoneBindDraggable
                                ? `${isStaticRoot ? 'Root' : 'Bone'}「${boneName}」の関節をドラッグしてBind位置を移動`
                                : `${isStaticRoot ? 'Root' : 'Bone'}「${boneName}」を選択`;
                    marker.setAttribute('aria-label', markerLabel);
                    marker.setAttribute('title', markerLabel);
                    setLayer(marker, (bone.partId || bone.boneId) === selectedId ? 6 : 5);
                    marker.addEventListener('pointerdown', event => {
                        if (event.button !== 0) return;
                        if (this.rigAuthoringKind === 'part') {
                            if (this.rigLensMode === 'motion'
                                && this.rigPartIkEffectorId === bone.partId) {
                                this._startRigPartIkGesture(bone, event);
                                if (!event.defaultPrevented) {
                                    event.preventDefault();
                                    event.stopImmediatePropagation();
                                }
                                return;
                            }
                            if (this.rigLensMode === 'motion'
                                && this._startRigPartPoseGesture(bone, event, 'move')) return;
                            if (this.rigSelectedPartId !== bone.partId) this.rigPartIkEffectorId = null;
                            this.rigSelectedPartId = bone.partId;
                        } else {
                            // SETUP: pressing any joint of a safe Bind target starts the move at once;
                            // a press without movement only selects (no History).
                            if (staticBoneBindDraggable
                                && this._startRigStaticBoneGesture(bone, 'move', event)) return;
                            this._selectRigLensBone(bone.boneId);
                            event.preventDefault();
                            event.stopPropagation();
                            return;
                        }
                        this.sync();
                        event.preventDefault();
                        event.stopPropagation();
                    });
                    const label = staticSetup ? (() => {
                        const text = document.createElementNS(ns, 'text');
                        const dx = bone.tail.x - bone.head.x;
                        const dy = bone.tail.y - bone.head.y;
                        const length = Math.hypot(dx, dy) || 1;
                        const fraction = Math.min(0.8, Math.max(0.66, 28 / length));
                        const labelX = bone.head.x + dx * fraction - dy / length * 6;
                        const labelY = bone.head.y + dy * fraction + dx / length * 6;
                        const fullName = boneName;
                        const compactName = Array.from(fullName).length > 14
                            ? `${Array.from(fullName).slice(0, 13).join('')}…`
                            : fullName;
                        text.classList.add('right-workspace-rig-bone-name-label');
                        if (isStaticRoot) text.classList.add('is-root-label');
                        text.setAttribute('x', String(labelX));
                        text.setAttribute('y', String(labelY));
                        text.setAttribute('text-anchor', dx < 0 ? 'end' : 'start');
                        text.setAttribute('aria-hidden', 'true');
                        text.setAttribute('data-rig-bone-name', bone.boneId);
                        text.setAttribute('title', fullName);
                        text.textContent = compactName;
                        return setLayer(text, 4);
                    })() : null;
                    if (staticSetup) {
                        // Bind rotation is a short arc outside the joint. Its hit band (radius 13-23)
                        // never overlaps the joint circle, and joints render above it.
                        const rotate = staticBoneMoveHandle ? setLayer(makeRotateAffordance(bone, {
                            radius: 18,
                            halfSpan: 0.9,
                            className: 'right-workspace-rig-bind-rotate',
                            label: `${isStaticRoot ? 'Root' : 'Bone'}「${boneName}」の弧をドラッグしてBind方向を回転`,
                            onPointerDown: event => this._startRigStaticBoneGesture(bone, 'rotate', event)
                        }), 3) : null;
                        return [rotate, marker, label].filter(Boolean);
                    }
                    if (boneMotion) {
                        const joint = document.createElementNS(ns, 'circle');
                        joint.classList.add(
                            'right-workspace-rig-bone-marker',
                            'right-workspace-rig-bone-motion-joint'
                        );
                        joint.classList.toggle('is-selected', selectedBoneMotion);
                        joint.setAttribute('cx', bone.tail.x);
                        joint.setAttribute('cy', bone.tail.y);
                        joint.setAttribute('r', '4');
                        joint.setAttribute('aria-hidden', 'true');
                        joint.setAttribute('data-rig-bone-id', bone.boneId || '');
                        setLayer(joint, 4);
                        const screenLength = Math.hypot(bone.tail.x - bone.head.x, bone.tail.y - bone.head.y);
                        const angle = boneAngle(bone);
                        const bodyStart = Math.min(12, screenLength * 0.4);
                        const makeBodyHit = () => {
                            const hit = document.createElementNS(ns, 'line');
                            hit.classList.add('right-workspace-rig-bone-body-hit');
                            hit.setAttribute('x1', bone.head.x + Math.cos(angle) * bodyStart);
                            hit.setAttribute('y1', bone.head.y + Math.sin(angle) * bodyStart);
                            hit.setAttribute('x2', bone.tail.x);
                            hit.setAttribute('y2', bone.tail.y);
                            return hit;
                        };
                        const boneLabel = `${isStaticRoot ? 'Root' : 'Bone'}「${boneName}」`;
                        if (!selectedBoneMotion) {
                            // Unselected Bones carry no manipulation handle: the body only selects.
                            const selectHit = makeBodyHit();
                            selectHit.setAttribute('data-rig-bone-id', bone.boneId || '');
                            selectHit.setAttribute('aria-label', `${boneLabel}を選択`);
                            selectHit.addEventListener('pointerdown', event => {
                                if (event.button !== 0) return;
                                this._selectRigLensBone(bone.boneId);
                                event.preventDefault();
                                event.stopPropagation();
                            });
                            return [line, setLayer(selectHit, 2), marker, joint];
                        }
                        // Selected Bone: the body (and the short arc through its tip) rotates around
                        // the origin; the origin joint moves. No detached buttons.
                        const bodyHit = makeBodyHit();
                        bodyHit.classList.add('right-workspace-rig-rotate-hit');
                        const rotate = makeRotateAffordance(bone, {
                            extraHits: [bodyHit],
                            radius: Math.max(16, screenLength),
                            halfSpan: Math.min(0.5, Math.max(0.08, 13 / Math.max(16, screenLength))),
                            className: 'right-workspace-rig-motion-handle--rotate',
                            label: `${boneLabel}を回転`,
                            onPointerDown: event => this._startRigPoseGesture(bone, event, 'rotate')
                        });
                        rotate.classList.add('right-workspace-rig-motion-handle');
                        const move = document.createElementNS(ns, 'g');
                        move.classList.add(
                            'right-workspace-rig-motion-handle',
                            'right-workspace-rig-motion-handle--move'
                        );
                        move.setAttribute('data-rig-bone-id', bone.boneId || '');
                        move.setAttribute('data-rig-operation', 'move');
                        move.setAttribute('role', 'button');
                        move.setAttribute('aria-label', `${boneLabel}を移動`);
                        move.setAttribute('title', `${boneLabel}を移動`);
                        const moveHit = document.createElementNS(ns, 'circle');
                        moveHit.classList.add('right-workspace-rig-move-hit');
                        moveHit.setAttribute('cx', bone.head.x);
                        moveHit.setAttribute('cy', bone.head.y);
                        moveHit.setAttribute('r', '12');
                        // Four short outward ticks around the origin: a crosshair, not another circle.
                        const cue = document.createElementNS(ns, 'path');
                        cue.classList.add('right-workspace-rig-move-cue');
                        cue.setAttribute('d', [0, 1, 2, 3].map(step => {
                            const a = step * Math.PI / 2;
                            const cx = Math.cos(a);
                            const cy = Math.sin(a);
                            const x0 = bone.head.x + cx * 9;
                            const y0 = bone.head.y + cy * 9;
                            const x1 = bone.head.x + cx * 14;
                            const y1 = bone.head.y + cy * 14;
                            return `M${x0} ${y0}L${x1} ${y1}`
                                + `M${x1 - cx * 2.5 - cy * 2.2} ${y1 - cy * 2.5 + cx * 2.2}L${x1} ${y1}`
                                + `L${x1 - cx * 2.5 + cy * 2.2} ${y1 - cy * 2.5 - cx * 2.2}`;
                        }).join(' '));
                        move.append(moveHit, cue);
                        move.addEventListener('pointerdown', event => {
                            if (event.button !== 0) return;
                            this._startRigPoseGesture(bone, event, 'move');
                        });
                        return [line, marker, joint, setLayer(move, 7), setLayer(rotate, 3)];
                    }
                    if (this.rigLensMode !== 'motion') {
                        return label ? [line, marker, label] : [line, marker];
                    }
                    const tip = document.createElementNS(ns, 'circle');
                    tip.classList.add('right-workspace-rig-bone-marker', 'right-workspace-rig-bone-tip');
                    tip.classList.toggle('is-selected', (bone.partId || bone.boneId) === selectedId);
                    tip.setAttribute('data-rig-bone-id', bone.boneId || '');
                    tip.setAttribute('cx', bone.tail.x);
                    tip.setAttribute('cy', bone.tail.y);
                    tip.setAttribute('r', '9');
                    tip.setAttribute('role', 'button');
                    const tipLabel = `${bone.partId || bone.boneId} の先端をドラッグして回転`;
                    tip.setAttribute('aria-label', tipLabel);
                    tip.setAttribute('title', tipLabel);
                    setLayer(tip, tip.classList.contains('is-selected') ? 9 : 8);
                    tip.addEventListener('pointerdown', event => {
                        if (this.rigAuthoringKind === 'part') {
                            this._startRigPartPoseGesture(bone, event);
                        } else {
                            this._startRigPoseGesture(bone, event);
                        }
                    });
                    const visibleLine = line ? [line] : [];
                    return label
                        ? [...visibleLine, marker, tip, label]
                        : [...visibleLine, marker, tip];
                });
                const placementParent = placementGesture?.moved
                    ? bones.find(bone => bone.boneId === placementGesture.parentBoneId)
                    : null;
                const placementPreview = placementParent ? (() => {
                    const line = document.createElementNS(ns, 'line');
                    line.classList.add('right-workspace-rig-bone-placement-preview');
                    line.setAttribute('x1', placementParent.tail.x);
                    line.setAttribute('y1', placementParent.tail.y);
                    line.setAttribute('x2', placementGesture.currentClientX);
                    line.setAttribute('y2', placementGesture.currentClientY);
                    const endpoint = document.createElementNS(ns, 'circle');
                    endpoint.classList.add('right-workspace-rig-bone-placement-endpoint');
                    endpoint.setAttribute('cx', placementGesture.currentClientX);
                    endpoint.setAttribute('cy', placementGesture.currentClientY);
                    endpoint.setAttribute('r', '5');
                    return [line, endpoint];
                })() : [];
                // Paint order is hit precedence: joints above rotation arcs/bodies, the selected
                // Bone's controls above neighbours. Stable sort keeps Bone order within a layer.
                const layerOf = node => Number(node.getAttribute?.('data-rig-layer') ?? 5);
                this.rigOverlay.replaceChildren(
                    ...parentLinks,
                    ...nodes
                        .map((node, index) => ({ node, index, layer: layerOf(node) }))
                        .sort((left, right) => left.layer - right.layer || left.index - right.index)
                        .map(entry => entry.node),
                    ...placementPreview
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
        this._renderRigResetSection();
        this.rigKindRow.hidden = !this.rigLensActive;
        const kindSelected = this.rigAuthoringKind === 'part' || this.rigAuthoringKind === 'deform';
        this.rigModeRow.hidden = !this.rigLensActive || !kindSelected;
        this.rigLensStructureRegion.hidden = !kindSelected;
        this.rigLensPropertiesRegion.hidden = !kindSelected;
        this.rigKindPrompt.hidden = !this.rigLensActive || kindSelected;
        this.rigPartFrameRow.hidden = !kindSelected;
        this.rigLensTerminal.hidden = !kindSelected;
        const phaseActionLabel = this.rigLensMode === 'setup' ? 'MOTIONへ進む →' : '← SETUPへ戻る';
        this.rigModeActionButton.textContent = phaseActionLabel;
        this.rigModeActionButton.setAttribute('aria-label', phaseActionLabel);
        const hasPartCandidate = (partTarget?.layers?.length || 0) > 0;
        this.rigPartKindButton.disabled = !hasPartCandidate;
        this.rigPartKindButton.title = hasPartCandidate
            ? '未Mesh接続のCAF RasterをPART方式で設定'
            : 'PART方式にできる未Mesh接続Rasterがありません。既存Bindingと同じRasterへ重ねて登録できません。';
        this.rigPartKindButton.setAttribute('aria-pressed', String(this.rigAuthoringKind === 'part'));
        this.rigDeformKindButton.setAttribute('aria-pressed', String(this.rigAuthoringKind === 'deform'));
        this.rigView.dataset.authoringKind = kindSelected ? this.rigAuthoringKind : 'none';
        this.rigView.dataset.mode = this.rigLensMode;
        if (!kindSelected) {
            this.rigLensHeading.textContent = 'CAF · RIG';
            this.rigLensHeading.setAttribute('aria-label', 'CAF · RIG');
            this.rigView.setAttribute('aria-label', 'RIG方式を選択');
            this.rigLensWarning.hidden = !this.rigEntryMessage;
            this.rigLensWarning.textContent = this.rigEntryMessage;
            this.rigKindPrompt.textContent = 'PARTまたはDEFORMを選択してください。';
            return;
        }
        if (this.rigAuthoringKind === 'part') {
            this._renderRigPartLens(target, partTarget);
            this._renderRigPendingPoseRecovery(target);
            return;
        }
        this.rigPartIkButton.hidden = true;
        this.rigLensTerminal.append(this.rigKeyButton, this.rigCancelPoseButton);
        this.rigCancelPoseButton.textContent = 'Poseを取消';
        this.rigCancelPoseButton.setAttribute('aria-label', '未確定Poseを取り消す');
        this.rigPartRegisterButton.hidden = true;
        this.rigPartParentLabel.hidden = true;
        const rigTarget = target?.rigTarget || null;
        const matchesTarget = !!this.rigLensTarget?.assetId
            && rigTarget?.assetId === this.rigLensTarget?.assetId
            && rigTarget?.internalLayerId === this.rigLensTarget?.internalLayerId;
        const isMotion = this.rigLensMode === 'motion';
        const cafName = partTarget?.asset?.name || rigTarget?.assetName
            || this.rigLensTarget?.assetName || 'CAF';
        const lane = partTarget?.entry?.lane;
        const laneName = lane
            ? (this._getRigLensTable()?.model?.getLaneDisplayName?.(lane) || lane.name || '') : '';
        const projectedLayer = partTarget?.layers?.find(
            candidate => candidate.id === rigTarget?.internalLayerId
        );
        this.rigStructureTargetLabel.textContent = [
            cafName, laneName, projectedLayer?.name || rigTarget?.layerName || 'Raster'
        ].filter(Boolean).join(' · ');
        this.rigStructureTargetLabel.title = this.rigStructureTargetLabel.textContent;
        this.rigLensHeading.textContent = laneName ? `CAF · ${laneName}` : 'CAF';
        this.rigLensHeading.title = cafName;
        this.rigLensHeading.setAttribute('aria-label', `CAF ${cafName}${laneName ? ` · ${laneName}` : ''}`);
        this.rigView.setAttribute('aria-label', `${isMotion ? 'RIG MOTION' : 'RIG SETUP'}`);
        this.rigLensStructureTitle.textContent = isMotion ? 'Bone' : 'Bone / Artwork';
        this.rigLensPropertiesTitle.textContent = isMotion ? 'Pose状態' : '次の操作';
        this.rigLensPropertiesTitle.hidden = !isMotion;
        this.rigLensWarning.hidden = matchesTarget && !this.rigEntryMessage;
        this.rigLensWarning.textContent = this.rigEntryMessage
            || (matchesTarget ? '' : 'RIG対象が現在の選択と一致しません。');
        this.rigLensStructureContent.replaceChildren();
        const staticTarget = matchesTarget ? this._getRigLensEditTarget() : null;
        const bindGestureTarget = matchesTarget && !isMotion
            ? this._getRigLensTable()?.getRigLensStaticBindGestureTarget?.(
                rigTarget.assetId, rigTarget.internalLayerId
            ) : null;
        const bindingTarget = matchesTarget
            ? this._getRigLensTable()?.getRigLensStaticTarget?.(
                rigTarget.assetId, rigTarget.internalLayerId, { allowExistingOtherRasterBindings: true }
            )
            : null;
        const displayTarget = matchesTarget
            ? this._getRigLensTable()?.getRigLensStaticTarget?.(
                rigTarget.assetId, rigTarget.internalLayerId, { allowBound: true }
            )
            : null;
        const artworkBindingReady = rigTarget.meshState === 'current' && rigTarget.weightState === 'connected';
        const bindingAvailable = bindingTarget?.ok === true
            && bindingTarget.bones.length > 0 && !rigTarget.hasMesh;
        this.rigModeRow.hidden = !this.rigLensActive
            || (!isMotion && this.rigAuthoringKind === 'deform' && !artworkBindingReady);
        if (this.rigSelectedBoneId && !displayTarget?.bones?.some(bone => bone.boneId === this.rigSelectedBoneId)) {
            this.rigSelectedBoneId = null;
        }
        const structureEditorOpen = this.rigStructureEditorDialog?.open === true;
        const displayBones = displayTarget?.ok ? displayTarget.bones : [];
        const canEditStructure = staticTarget?.ok === true;
        const canOpenStructure = canEditStructure || (displayTarget?.ok && displayBones.length > 0);
        if (structureEditorOpen) this.rigStructureEditorReadOnly = !canEditStructure;
        const bindingGuardReason = !isMotion && !rigTarget.hasMesh && !bindingTarget?.ok
            ? bindingTarget?.reason || '' : '';
        this.rigStructureEditButton.hidden = isMotion || !matchesTarget || !canOpenStructure;
        this.rigStructureEditButton.textContent = !canEditStructure
            ? '構造を確認' : displayBones.length ? '構造を編集' : '骨格を作成';
        this.rigStructureEditButton.title = !canEditStructure
            ? `${staticTarget?.reason || '既存guardにより編集できません。'} 構造は読み取り専用で確認できます。`
            : displayBones.length
                ? '同じBone構造を編集し、親子関係を確認します。'
                : '既存rigDefinitionへRootを作成し、親子構造を組み立てます。';
        this.rigRootButton.hidden = !structureEditorOpen || isMotion
            || !canEditStructure || staticTarget.bones.length !== 0;
        const hasSingleRoot = displayBones.filter(bone => bone.parentBoneId == null).length === 1;
        this.rigStructureAddBoneButton.hidden = !structureEditorOpen || isMotion
            || !canEditStructure || !hasSingleRoot;
        this.rigStructureAddBoneButton.disabled = !canEditStructure || !hasSingleRoot;
        this.rigChildButton.hidden = isMotion || !staticTarget?.ok
            || staticTarget.bones.length === 0;
        this.rigChildButton.disabled = !staticTarget?.bones?.some(
            bone => bone.boneId === this.rigSelectedBoneId);
        const selectedStaticBone = staticTarget?.bones?.find(
            bone => bone.boneId === this.rigSelectedBoneId
        ) || null;
        const selectedBoardBone = displayBones.find(
            bone => bone.boneId === this.rigSelectedBoneId
        ) || null;
        const selectedHasDescendants = selectedBoardBone
            ? this._getRigBoneDescendants(displayBones, selectedBoardBone.boneId).size > 0
            : false;
        const deleteReason = !selectedBoardBone ? '削除するBoneを選択してください。'
            : !canEditStructure ? (staticTarget?.reason || '既存guardにより構造を編集できません。')
                : selectedBoardBone.parentBoneId == null ? 'Rootは削除できません。'
                    : selectedHasDescendants ? '子孫Boneがあるため削除できません。先に子を整理してください。'
                        : '';
        this.rigStructureDeleteBoneButton.hidden = !structureEditorOpen || !selectedBoardBone;
        this.rigStructureDeleteBoneButton.disabled = !!deleteReason;
        this.rigStructureDeleteBoneButton.setAttribute('aria-label', deleteReason
            ? `選択Boneを削除できません。${deleteReason}` : `「${selectedBoardBone?.name || 'Bone'}」を削除`);
        this.rigStructureDeleteBoneButton.title = deleteReason || '末端BoneをCAF Asset Historyへ記録して削除';
        this.rigStructureAddBoneButton.setAttribute('aria-label', selectedStaticBone
            ? `「${selectedStaticBone.name || 'Bone'}」の子Boneを追加`
            : 'Root直下にBoneを追加');
        this.rigStructureParentDisclosure.hidden = isMotion || !canEditStructure || !selectedStaticBone;
        this.rigBoneParentLabel.hidden = isMotion || !selectedStaticBone;
        if (selectedStaticBone) {
            const descendants = new Set();
            let foundDescendant = true;
            while (foundDescendant) {
                foundDescendant = false;
                staticTarget.bones.forEach(candidate => {
                    if ((candidate.parentBoneId === selectedStaticBone.boneId
                        || descendants.has(candidate.parentBoneId))
                        && !descendants.has(candidate.boneId)) {
                        descendants.add(candidate.boneId);
                        foundDescendant = true;
                    }
                });
            }
            const parentOptions = selectedStaticBone.parentBoneId == null
                ? []
                : staticTarget.bones.filter(candidate => (
                    candidate.boneId !== selectedStaticBone.boneId
                    && !descendants.has(candidate.boneId)
                ));
            const options = selectedStaticBone.parentBoneId == null
                ? [{ value: '', label: 'ROOT' }]
                : parentOptions.map(parent => ({
                    value: parent.boneId,
                    label: parent.name || parent.boneId
                }));
            this.rigBoneParentSelect.replaceChildren(...options.map(optionData => {
                const option = document.createElement('option');
                option.value = optionData.value;
                option.textContent = optionData.label;
                return option;
            }));
            this.rigBoneParentSelect.value = selectedStaticBone.parentBoneId || '';
            this.rigBoneParentSelect.disabled = selectedStaticBone.parentBoneId == null
                || options.length === 0;
            this.rigBoneParentSelect.title = selectedStaticBone.parentBoneId == null
                ? 'Rootは階層の起点です。'
                : '親を変更してもBoneと子孫のBind World位置を保持します。';
        } else {
            this.rigBoneParentSelect.replaceChildren();
            this.rigBoneParentSelect.disabled = true;
        }
        this.rigStructureParentDisclosure.hidden = !structureEditorOpen
            || !canEditStructure || !selectedStaticBone || selectedStaticBone.parentBoneId == null;
        const selectedParent = staticTarget?.bones?.find(
            bone => bone.boneId === this.rigSelectedBoneId
        );
        const selectedParentLabel = selectedParent?.name || selectedParent?.boneId || '選択Bone';
        const childPlacementActive = this.rigPlacementMode === 'child';
        this.rigChildButton.textContent = selectedParent
            ? childPlacementActive
                ? `${selectedParentLabel} · 配置中`
                : `${selectedParentLabel}から子Boneを追加`
            : '親Boneを選択して追加';
        this.rigChildButton.setAttribute('aria-pressed', String(childPlacementActive));
        this.rigChildButton.setAttribute('aria-label', childPlacementActive
            ? `${selectedParentLabel}を親として子Boneを配置中。親Bone先端からCanvas上へドラッグ`
            : `${selectedParentLabel}を親としてCanvas上に子Boneを追加`);
        this.rigChildButton.title = childPlacementActive
            ? `${selectedParentLabel}の先端markerまたはCanvasからdrag。Escまたは再押下で取消`
            : `${selectedParentLabel}を親としてCanvas上へ子Boneを追加`;
        this.rigBindButton.hidden = isMotion || !matchesTarget || rigTarget.hasMesh;
        this.rigBindButton.disabled = !bindingAvailable;
        this.rigBindButton.title = bindingGuardReason
            || (!bindingTarget?.bones?.length
                ? '先にRootを作成してください。'
                : '既存Binding guardを通過したCAF RasterをAUTO GRIDのMesh / Skinへ接続');
        this.rigStructureNameInput.disabled = !staticTarget?.ok;
        this.rigRootButton.disabled = !staticTarget?.ok;
        this.rigStructureContinueButton.disabled = displayBones.length === 0;
        this.rigStructureContinueButton.textContent = this.rigStructureEditorReadOnly
            ? '閉じる' : '配置へ進む';
        this.rigStructureContinueButton.title = this.rigStructureEditorReadOnly
            ? '構造の閲覧を終了します。Bone位置やHistoryは変更しません。'
            : '構造編集を終了してCanvasへ戻ります。';
        this.rigStructureStatus.textContent = this.rigStructureStatusMessage || (this.rigStructureEditorReadOnly
            ? `${staticTarget?.reason || '編集guardが有効です。'} · 読み取り専用で構造を確認できます。`
            : !bindingTarget?.ok && bindingGuardReason
                ? bindingGuardReason
                : displayBones.length > 0
                    ? '構造は既存CAFへ記録済み · CanvasでBone位置を調整できます'
                    : 'Rootから骨格構造を作成します');
        const motionTarget = matchesTarget && this.rigSelectedBoneId
            ? this._getRigLensTable()?.getRigLensMotionTarget?.(
                rigTarget.assetId, rigTarget.internalLayerId, this.rigSelectedBoneId
            ) : null;
        this._syncRigModeAction(motionTarget, matchesTarget);
        const table = this._getRigLensTable();
        const pendingPose = this._hasRigPosePreview(table);
        const boneDraftSummary = isMotion
            ? table?.getRigLensBonePoseDraftSummary?.(rigTarget.assetId, rigTarget.internalLayerId)
            : null;
        const boneDraftMatches = isMotion && boneDraftSummary?.matchesRequestedTarget
            && boneDraftSummary.matchesCurrent;
        this._renderRigFrameNavigation({
            authoringKind: 'deform',
            mode: this.rigLensMode,
            matchesTarget,
            frameTarget: partTarget,
            pending: pendingPose,
            commit: boneDraftMatches ? {
                localFrame: boneDraftSummary.localFrame,
                ariaLabel: `F${boneDraftSummary.localFrame + 1}の${boneDraftSummary.count} Bone Poseを一括Motion KEY確定`,
                title: `このFrameの未確定 ${boneDraftSummary.count} Bone Poseを一つのHistory境界で確定`
            } : null,
            showCancel: isMotion && pendingPose,
            keepFrameNumberWithKey: true,
            frameKeyState: isMotion && motionTarget?.ok
                ? { exists: !!motionTarget.key }
                : null,
            showFrameKeyDelete: isMotion && !!motionTarget?.key && !boneDraftMatches && !pendingPose
        });
        this.rigKeyButton.hidden = !isMotion || !boneDraftMatches;
        if (!boneDraftMatches) {
            this.rigKeyButton.textContent = '◆ Motion KEY確定';
            this.rigKeyButton.setAttribute('aria-label', '現在FrameのBone PoseをMotion KEYへ確定');
            this.rigKeyButton.title = '現在Frameの選択Bone Poseを既存KEYへ確定';
        }
        this.rigKeyButton.disabled = !motionTarget?.ok;
        this.rigCancelPoseButton.hidden = !isMotion || !pendingPose;
        this.rigLensTerminal.hidden = !isMotion || pendingPose;
        this.rigToolHint.textContent = !matchesTarget
            ? '対象Rasterを確認してください.'
            : bindingGuardReason
                ? bindingGuardReason
            : isMotion
                    ? (boneDraftMatches
                    ? `未確定Pose ${boneDraftSummary.count} Bone · Frame単位で一括KEY確定`
                    : motionTarget?.ok
                    ? (motionTarget.preview ? '未確定Pose' : 'Poseを調整できます')
                    : motionTarget?.reason || '接続済みBoneを選択してください。')
                : bindGestureTarget?.mode === 'pre_bind' && bindGestureTarget.ok
                    ? 'Canvasで関節をdragしてBind位置を調整 · 選択Boneの弧で回転'
                : bindGestureTarget?.mode === 'safe_rebind' && bindGestureTarget.ok
                    ? 'AUTO GRID接続済み · 関節と弧で安全にBindを再調整できます'
                : displayBones.length > 0 && bindGestureTarget?.mode === 'blocked'
                    ? bindGestureTarget.reason || 'Bind位置を調整できません。'
                : bindingAvailable
                    ? '選択Rasterの絵をBoneへ接続できます'
                : !staticTarget?.ok && rigTarget.hasMesh
                    ? (artworkBindingReady
                        ? '絵は接続済み · MOTIONでPoseを編集'
                            : 'Mesh / Skinの接続状態を確認してください。')
                : !staticTarget?.ok
                    ? (staticTarget?.reason || '対象を確認してください。')
                : this.rigPlacementMode === 'root'
                        ? 'RootはArtwork中心へ直接作成されます'
                        : this.rigPlacementMode === 'child'
                            ? `${selectedParentLabel}の先端からCanvas上へdragして子Boneを追加 · Escで取消`
                            : staticTarget.bones.length === 0
                                ? 'RootはArtworkの不透明範囲中心へ作成されます'
                                : this.rigSelectedBoneId
                                    ? '関節をdragして移動、関節の外側の弧をdragして回転'
                                    : 'Bone一覧またはCanvas上の頭markerから選択';
        this.rigToolHint.title = isMotion
            ? '選択Boneの本体か先端の弧をドラッグして回転、関節をドラッグして移動します。PointerUpでKEYへ反映され、Undoで戻せます。'
            : this.rigPlacementMode === 'child'
                ? `${selectedParentLabel}を親として先端からdragし、子Boneを作成します。Escまたはボタン再押下で取消できます。`
                : '骨格構造を作成してからCanvas位置を調整します。関節はBind移動、選択Boneの外側の弧は回転です。';
        this.rigToolHint.hidden = !isMotion && !this.rigPlacementMode
            && !bindingGuardReason
            && staticTarget?.ok === true
            && (staticTarget.bones.length === 0 || !!this.rigSelectedBoneId);

        if (!matchesTarget) {
            this._clearRigStructureDragState();
            this.rigStructureStatusMessage = '';
            const message = document.createElement('p');
            message.textContent = '現在の選択と入場時の対象が一致しないため、構造情報を表示していません。';
            this.rigLensStructureContent.appendChild(message);
            if (structureEditorOpen) {
                this._renderRigHierarchyCardBoard(this.rigStructureEditorTree, [], { readOnly: true });
                this.rigStructureStatus.textContent = '対象Rasterが一致しません。対象を確認してから構造編集を再開してください。';
            }
            this._renderRigPendingPoseRecovery(target);
            return;
        }

        const layer = partTarget?.layers?.find(candidate => candidate.id === rigTarget.internalLayerId);
        this.rigStructureTargetLabel.textContent = [
            cafName, laneName, layer?.name || rigTarget.layerName || 'Raster'
        ].filter(Boolean).join(' · ');
        this.rigStructureTargetLabel.title = this.rigStructureTargetLabel.textContent;
        const targetRow = document.createElement('div');
        targetRow.className = 'right-workspace-rig-target-row right-workspace-rig-deform-static';
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
        const artwork = document.createElement('p');
        artwork.className = 'right-workspace-rig-deform-static right-workspace-rig-artwork-state';
        const bindingReady = artworkBindingReady;
        artwork.textContent = rigTarget.hasMesh
            ? (bindingReady ? '絵：接続済み' : '絵：接続要確認')
            : '絵：未接続';
        if (rigTarget.hasMesh && !bindingReady) {
            artwork.title = `Mesh: ${rigTarget.meshState} / Skin: ${rigTarget.weightState}`;
        }
        this.rigLensStructureContent.appendChild(artwork);
        // Keep the structure overview with the hierarchy, before the selectable Bone list.
        this.rigLensStructureContent.appendChild(this.rigStructureEditButton);
        this.rigCompactBoneTree = null;
        if (displayTarget?.ok && displayTarget.bones.length && !isMotion) {
            const list = document.createElement('div');
            list.className = 'right-workspace-rig-bone-tree right-workspace-rig-bone-tree--compact right-workspace-rig-bone-tree--flat';
            list.setAttribute('role', 'tree');
            list.setAttribute('aria-label', '名前付きBone選択と配置状態');
            list.addEventListener('keydown', event => this._onRigBoneTreeKeyDown(event));
            this.rigLensStructureContent.appendChild(list);
            this.rigCompactBoneTree = list;
            this._renderRigCompactBoneList(list, displayTarget.bones);
        } else if (displayTarget?.ok && displayTarget.bones.length) {
            const list = document.createElement('ul');
            list.setAttribute('aria-label', 'Bone選択');
            list.className = 'right-workspace-rig-deform-bones';
            displayTarget.bones.forEach(bone => {
                const item = document.createElement('li');
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'gui-control gui-control--s right-workspace-rig-bone-select';
                const boneName = bone.name || 'Bone';
                button.textContent = boneName;
                button.setAttribute('aria-pressed', String(this.rigSelectedBoneId === bone.boneId));
                const parent = displayTarget.bones.find(candidate => candidate.boneId === bone.parentBoneId);
                const parentLabel = parent ? `親 ${parent.name || 'Bone'}` : 'ROOT';
                button.setAttribute('aria-label', `${boneName} · ${parentLabel}`);
                button.title = `${boneName} · ${parentLabel}`;
                button.addEventListener('click', () => this._selectRigLensBone(bone.boneId));
                const parentNode = document.createElement('span');
                parentNode.className = 'right-workspace-rig-bone-parent';
                parentNode.textContent = parentLabel;
                item.append(button, parentNode);
                let depth = 0;
                let parentId = bone.parentBoneId;
                const visited = new Set([bone.boneId]);
                while (parentId && depth < displayTarget.bones.length && !visited.has(parentId)) {
                    visited.add(parentId);
                    const ancestor = displayTarget.bones.find(candidate => candidate.boneId === parentId);
                    if (!ancestor) break;
                    depth += 1;
                    parentId = ancestor.parentBoneId;
                }
                item.style.paddingInlineStart = `${Math.min(depth, 3) * 8}px`;
                list.appendChild(item);
            });
            this.rigLensStructureContent.appendChild(list);
        } else if (rigTarget.bones?.length) {
            const list = document.createElement('ul');
            list.setAttribute('aria-label', '対象RasterのBone構造');
            list.className = 'right-workspace-rig-deform-bones right-workspace-rig-deform-static';
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
            candidates.className = 'right-workspace-rig-deform-static';
            candidates.textContent = `未接続Bone候補 ${rigTarget.unboundBoneCount}件`;
            candidates.title = 'このRasterへの接続は確認されていません。';
            this.rigLensStructureContent.appendChild(candidates);
        } else {
            const empty = document.createElement('p');
            empty.className = 'right-workspace-rig-deform-empty';
            empty.textContent = isMotion ? 'Bone未設定' : '骨格未設定';
            this.rigLensStructureContent.appendChild(empty);
        }

        if (structureEditorOpen) {
            this._renderRigHierarchyCardBoard(this.rigStructureEditorTree, displayBones, {
                readOnly: !canEditStructure
            });
            this.rigStructureEditorTree.setAttribute('aria-label', 'Bone階層カードボード');
        }

        if (rigTarget.hasMesh) {
            const mesh = document.createElement('p');
            mesh.className = 'right-workspace-rig-deform-static';
            mesh.textContent = `Mesh: ${rigTarget.meshGeneratorLabel || '設定済み'} · Weight: ${rigTarget.weightState}`;
            mesh.title = `Mesh: ${rigTarget.meshState} / Weight: ${rigTarget.weightState}`;
            this.rigLensStructureContent.appendChild(mesh);
        }
        this._renderRigPendingPoseRecovery(target);
    }

    _renderRigPartLens(target, partTarget) {
        const assetId = this.rigLensTarget?.assetId;
        const matchesAsset = partTarget?.ok === true && target?.rigTarget?.assetId === assetId;
        const selectedLayer = partTarget?.layers?.find(layer => layer.id === this.rigSelectedPartId);
        const selectedPart = partTarget?.parts?.find(part => part.partId === this.rigSelectedPartId);
        const motion = this.rigLensMode === 'motion';
        const table = this._getRigLensTable();
        const draftSummary = table?.getRigLensPartPoseDraftSummary?.(assetId) || null;
        const motionTarget = selectedPart
            ? table?.getRigLensPartMotionTarget?.(assetId, selectedPart.partId) : null;
        this._syncRigModeAction(motionTarget, matchesAsset);
        const pending = table?.hasRigLensPartPosePreview?.() === true;
        const draftMatches = !!draftSummary && draftSummary.clipId === partTarget?.entry?.clip?.id
            && draftSummary.frame === partTarget?.frame;
        const pendingPose = this._hasRigPosePreview(table);
        const layers = partTarget?.layers || [];
        const parts = partTarget?.parts || [];
        const staticAllowed = partTarget?.staticSetupAllowed === true;
        const cafName = partTarget?.asset?.name || this.rigLensTarget?.assetName || 'CAF';
        const lane = partTarget?.entry?.lane;
        const laneName = lane
            ? (this._getRigLensTable()?.model?.getLaneDisplayName?.(lane) || lane.name || '') : '';
        this.rigLensHeading.textContent = laneName ? `CAF · ${laneName}` : 'CAF';
        this.rigLensHeading.title = cafName;
        this.rigLensHeading.setAttribute('aria-label', `CAF ${cafName}${laneName ? ` · ${laneName}` : ''}`);
        this.rigView.setAttribute('aria-label', motion ? 'PART MOTION' : 'PART SETUP');
        this.rigLensStructureTitle.textContent = 'パーツ';
        this.rigLensPropertiesTitle.textContent = motion ? 'このPartの操作' : 'Canvas操作';
        this.rigLensWarning.hidden = matchesAsset && !this.rigEntryMessage;
        this.rigLensWarning.textContent = this.rigEntryMessage
            || (matchesAsset ? '' : 'RIG対象が選択中のCAFと一致しません。');
        this.rigLensWarning.title = this.rigEntryMessage || '';
        this.rigLensStructureContent.replaceChildren();
        this.rigPartRegisterButton.hidden = true;
        this.rigPartParentLabel.hidden = true;
        const list = document.createElement('ul');
        list.setAttribute('aria-label', 'CAF内Raster Part');
        list.className = 'right-workspace-rig-part-list';
        layers.forEach(layer => {
            const part = parts.find(candidate => candidate.partId === layer.id);
            const parent = layers.find(candidate => candidate.id === part?.parentPartId);
            const isSelected = layer.id === this.rigSelectedPartId;
            const item = document.createElement('li');
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'gui-control gui-control--s right-workspace-rig-part-row';
            button.setAttribute('aria-pressed', String(isSelected));
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
                this._selectRigLensPart(layer.id);
            });
            const details = document.createElement('span');
            details.className = 'right-workspace-rig-part-meta';
            item.className = 'right-workspace-rig-part-item';
            item.appendChild(button);
            if (part) {
                const parentName = part.parentPartId
                    ? (parent?.name || '不明') : 'ROOT';
                if (!motion && isSelected) {
                    const options = [{ id: '', label: 'ROOT' },
                        ...parts.filter(candidate => candidate.partId !== part.partId)
                            .map(candidate => ({ id: candidate.partId, label: layers.find(layerItem =>
                                layerItem.id === candidate.partId)?.name || candidate.partId }))];
                    this.rigPartParentSelect.replaceChildren(...options.map(optionData => {
                        const option = document.createElement('option');
                        option.value = optionData.id;
                        option.textContent = optionData.label;
                        return option;
                    }));
                    this.rigPartParentSelect.value = part.parentPartId || '';
                    this.rigPartParentSelect.disabled = !staticAllowed;
                    this.rigPartParentSelect.title = staticAllowed
                        ? 'このPartの親を変更（Artworkの表示位置は維持）'
                        : partTarget?.staticSetupReason || 'Motion KEYがあるため静的Setupを編集できません。';
                    this.rigPartParentLabel.hidden = false;
                    item.appendChild(this.rigPartParentLabel);
                } else {
                    details.textContent = `親：${parentName}`;
                    item.appendChild(details);
                }
            } else {
                if (!motion && isSelected) {
                    this.rigPartRegisterButton.disabled = !staticAllowed;
                    this.rigPartRegisterButton.title = staticAllowed
                        ? 'Artwork Bounds中心を初期PIVOTとしてPart作成。Canvas上の中心候補をdragしても同時に登録できます。'
                        : partTarget?.staticSetupReason || 'Motion KEYがあるため静的Setupを編集できません。';
                    this.rigPartRegisterButton.hidden = false;
                    item.appendChild(this.rigPartRegisterButton);
                } else {
                    details.textContent = '未登録';
                    item.appendChild(details);
                }
            }
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
        const ikContext = matchesAsset && motion && selectedPart
            ? table?.getRigLensPartIkChainContext?.(assetId, selectedPart.partId) : null;
        if (this.rigPartIkEffectorId === selectedPart?.partId && !ikContext?.ok) {
            this.rigPartIkEffectorId = null;
        }
        this.rigPartIkButton.hidden = !matchesAsset || !motion || !selectedPart;
        this.rigPartIkButton.disabled = !ikContext?.ok || !!this.rigPointerGesture;
        this.rigPartIkButton.classList.toggle('is-active',
            this.rigPartIkEffectorId === selectedPart?.partId);
        this.rigPartIkButton.setAttribute('aria-pressed', String(
            this.rigPartIkEffectorId === selectedPart?.partId
        ));
        this.rigPartIkButton.title = ikContext?.ok
            ? '選択Partを2-link IKの手先にし、Canvas上の丸いRootハンドルをドラッグ'
            : ikContext?.reason || 'PART MOTIONで有効な3-Part chainを選択してください。';
        const partCommit = motion && pending && draftMatches ? {
            localFrame: draftSummary.localFrame,
            ariaLabel: `F${draftSummary.localFrame + 1}の全Part PoseをMotion KEYへ確定`,
            title: `${draftSummary.partIds.length} Partの変更を同じFrameへ一括確定`
        } : null;
        this._renderRigFrameNavigation({
            authoringKind: 'part',
            mode: this.rigLensMode,
            matchesTarget: matchesAsset,
            frameTarget: partTarget,
            pending: pendingPose,
            commit: partCommit,
            showCancel: motion && pending
        });
        this.rigLensTerminal.hidden = true;
        this.rigKeyButton.hidden = !partCommit;
        this.rigKeyButton.disabled = !partCommit || !matchesAsset;
        this.rigToolHint.textContent = !matchesAsset
            ? 'CAFを確認してください。'
            : motion
                ? (pending && draftMatches
                    ? `${draftSummary.partIds.length} Part変更 · KEY未確定`
                    : motionTarget?.ok
                    ? (motionTarget.preview ? '変更中' : motionTarget.key ? 'KEY設定済み' : 'KEY未設定')
                    : motionTarget?.reason || '登録済みPartを選択してください。')
                : !staticAllowed
                    ? partTarget?.staticSetupReason || 'Motion KEYがあるため静的Setupを編集できません。'
                    : selectedPart
                        ? `PIVOT ${selectedPart.bindTransform.pivotX.toFixed(1)}, ${selectedPart.bindTransform.pivotY.toFixed(1)} · Canvasでdrag`
                        : selectedLayer
                            ? 'Artwork中心候補 · dragでPIVOT設定とPart作成'
                            : 'Rasterを選択してください。';
        this.rigToolHint.title = motion
            ? 'Partをdragし、PointerUpで変更をKEYへ反映します。IKも一つのUndo操作として確定し、Undoで戻せます。'
            : selectedPart
                ? '選択Partの中心軸をCanvas上で直接drag。保存済みPIVOTは選択だけでは変更されません。'
                : '未登録RasterのArtwork Bounds中心を候補表示します。登録またはdragで明示的にSetupへ反映します。';
        if (!pending) this.rigKeyButton.title = '未確定Poseがあるとき、Frame内の変更を一括確定';
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

            this.rigModeButton = document.createElement('button');
            this.rigModeButton.type = 'button';
            this.rigModeButton.className = 'right-workspace-mode-segment';
            this.rigModeButton.dataset.workspaceMode = 'rig';
            this.rigModeButton.textContent = 'RIG';

            this.modeSwitch.append(this.layerModeButton, this.transformModeButton, this.rigModeButton);
            this.root.insertBefore(this.modeSwitch, this.drawing);
        } else {
            this.layerModeButton = this.modeSwitch.querySelector('[data-workspace-mode="layer"]');
            this.transformModeButton = this.modeSwitch.querySelector('[data-workspace-mode="transform"]');
            this.rigModeButton = this.modeSwitch.querySelector('[data-workspace-mode="rig"]');
            if (!this.rigModeButton) {
                this.rigModeButton = document.createElement('button');
                this.rigModeButton.type = 'button';
                this.rigModeButton.className = 'right-workspace-mode-segment';
                this.rigModeButton.dataset.workspaceMode = 'rig';
                this.rigModeButton.textContent = 'RIG';
                this.modeSwitch.appendChild(this.rigModeButton);
            }
        }

        this._layerModeClickHandler = () => this._requestWorkspaceMode('layer');
        this._transformModeClickHandler = () => this._requestWorkspaceMode('transform');
        this._rigModeClickHandler = () => this._requestWorkspaceMode('rig');
        this.layerModeButton?.addEventListener('click', this._layerModeClickHandler);
        this.transformModeButton?.addEventListener('click', this._transformModeClickHandler);
        this.rigModeButton?.addEventListener('click', this._rigModeClickHandler);
    }

    _requestWorkspaceMode(mode) {
        if (this.rigLensActive) {
            if (mode === 'layer') {
                this._exitRigToLayer();
            } else if (mode === 'transform') {
                if (this.layerSystem?.canStartTransformEditSession?.() === false) {
                    this._exitRigToLayer({ showTransformGate: true });
                } else {
                    this._returnToTransform();
                }
            }
            return;
        }
        if (mode === 'rig') {
            this._enterRigLens();
            return;
        }
        const transformActive = this.panel?.classList.contains('show') === true;
        if (mode === 'transform') {
            if (transformActive) return;
            if (this.layerSystem?.canStartTransformEditSession?.() === false) {
                this.transformLensRequested = true;
                this.sync();
                return;
            }
            // The existing V entry remains the sole guard and state owner.
            window.KeyboardHandler?.toggleLayerTransform?.('right-workspace-segment');
            this.sync();
            return;
        }
        if (this.transformLensRequested && !transformActive) {
            this.transformLensRequested = false;
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
        if (transformSessionVisible) this.transformLensRequested = false;
        if (transformSessionVisible && this.rigLensActive) {
            this._getRigLensTable()?.cancelRigLensBonePosePreview?.();
            this.rigLensActive = false;
            this.rigLensTarget = null;
        }
        let target = this.getTarget?.() || {};
        let rigTarget = target.rigTarget || null;
        if (this.rigLensActive) {
            this._syncActiveRigLensTarget(rigTarget);
            if (!this.rigLensActive) {
                target = this.getTarget?.() || {};
                rigTarget = target.rigTarget || null;
            }
        }
        const rigLensVisible = this.rigLensActive;
        const transformGateVisible = this.transformLensRequested && !transformSessionVisible && !rigLensVisible;
        const active = transformSessionVisible || transformGateVisible || rigLensVisible;
        const surface = rigLensVisible ? 'rig' : (active ? 'transform' : 'layer');
        const previousSurface = this.currentSurface || surface;
        const transformAvailability = this.layerSystem?.getTransformEditStartAvailability?.();
        const transformBlockMessage = !transformAvailability?.ok
            ? RIG_TRANSFORM_BLOCK_MESSAGES[transformAvailability?.reason] || '' : '';
        this.transformModeButton.disabled = false;
        this.transformModeButton.title = transformBlockMessage;
        this.transformModeButton.setAttribute('aria-label', 'TRANSFORM');
        this.rigModeButton.disabled = !rigLensVisible && rigTarget?.eligible !== true;
        this.rigModeButton.title = this.rigModeButton.disabled ? rigTarget?.reason || 'CAF内のRasterを選択してください。' : '';
        this.rigModeButton.setAttribute('aria-label', this.rigModeButton.disabled
            ? `RIGを使用できません: ${this.rigModeButton.title}` : 'RIG');
        for (const [button, selected] of [
            [this.layerModeButton, !active],
            [this.transformModeButton, surface === 'transform'],
            [this.rigModeButton, rigLensVisible]
        ]) {
            button?.classList.toggle('is-selected', selected);
            button?.setAttribute('aria-pressed', String(selected));
        }
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
        this.title.hidden = rigLensVisible || transformGateVisible;
        this.transformGateNotice.hidden = !transformGateVisible;
        this.transformGateNotice.textContent = transformGateVisible
            ? transformBlockMessage || 'この対象のTransformは開始できません。対象と編集状態を確認してください。'
            : '';
        this.rigView.hidden = !rigLensVisible;
        this.panel.hidden = rigLensVisible || transformGateVisible;
        this.rigEntryRow.hidden = rigLensVisible;
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
        const rigTargetKey = rigTarget?.eligible === true ? rigTargetIdentityKey(rigTarget) : '';
        if (!rigLensVisible && rigTargetKey !== this.lastRigTargetKey) {
            if (this._hasRigPosePreview()) {
                this.rigEntryMessage = '未確定Poseがあります。対象を切り替える前にMotion KEY確定またはPose取消を行ってください。';
            } else {
                this.lastRigTargetKey = rigTargetKey;
                this.rigEntryMessage = '';
                this.rigTargetSwitchPending = false;
                this.rigPlacementMode = null;
                this.rigPartIkEffectorId = null;
                this.rigSelectedBoneId = null;
                this.rigLensMode = 'setup';
            }
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
            this.rigPartIkEffectorId = null;
        }
        this._syncRigPartPivotOverlay();
        this._syncRigOverlay();
        const layerEditing = this.layerSystem?.transform?.isVKeyPressed === true;
        this.cancelButton.hidden = !layerEditing;
        this.selectionHint.hidden = layerEditing;
        this._syncTransformActions(layerEditing);
        this._syncStatusMount();
        if (surface !== previousSurface) {
            if (surface === 'rig') {
                const kindButton = this.rigAuthoringKind === 'part'
                    ? this.rigPartKindButton : this.rigDeformKindButton;
                (kindButton?.disabled ? this.rigModeActionButton : kindButton)?.focus({ preventScroll: true });
            }
            else if (surface === 'transform') this.title.focus({ preventScroll: true });
            else this.layerModeButton?.focus({ preventScroll: true });
        }
        this.currentSurface = surface;
    }

    destroy() {
        this._getRigLensTable()?.cancelRigLensBonePosePreview?.();
        this._getRigLensTable()?.cancelRigLensPartPosePreview?.();
        if (this.rigStructureConnectorFrame != null) {
            cancelAnimationFrame(this.rigStructureConnectorFrame);
            this.rigStructureConnectorFrame = null;
        }
        this._clearRigStructureDragState();
        document.removeEventListener('pointerdown', this._rigCanvasDownHandler, true);
        document.removeEventListener('pointerup', this._rigCanvasUpHandler, true);
        document.removeEventListener('pointermove', this._rigCanvasMoveHandler, true);
        document.removeEventListener('pointercancel', this._rigCanvasCancelHandler, true);
        document.removeEventListener('keydown', this._rigEscapeHandler, true);
        window.removeEventListener('blur', this._rigBlurHandler);
        this.rigLensActive = false;
        if (this.rigPartPivotOverlayActive) rigPivotOverlay.deactivate();
        this.rigPartPivotOverlayActive = false;
        this._syncRigOverlay();
        this.observer?.disconnect();
        this.resizeObserver?.disconnect();
        this.layerModeButton?.removeEventListener('click', this._layerModeClickHandler);
        this.transformModeButton?.removeEventListener('click', this._transformModeClickHandler);
        this.rigModeButton?.removeEventListener('click', this._rigModeClickHandler);
        this.rigEntryButton?.removeEventListener('click', this._rigEntryClickHandler);
        this.rigEntryRow?.remove();
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
