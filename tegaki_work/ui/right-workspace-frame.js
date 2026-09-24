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
        this.rigLensActive = false;
        this.rigLensTarget = null;
        this.rigLensReturnMode = 'basic';
        this.rigEntryMessage = '';
        this.lastRigTargetKey = null;
        this.rigPlacementMode = null;
        this.rigSelectedBoneId = null;
        this.rigPlacementVerifiedBoneIds = new Set();
        this.rigTreeCollapsedBoneIds = new Set();
        this.rigStructureTreeRestoreFocusId = null;
        this.rigLensMode = 'setup';
        this.rigAuthoringKind = 'deform';
        this.rigSelectedPartId = null;
        this.rigPartIkEffectorId = null;
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
        window.addEventListener('blur', this._rigBlurHandler);
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
        structure.appendChild(this.rigStructureEditButton);

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
            this.rigRootButton, this.rigChildButton, this.rigBoneParentLabel, this.rigBindButton,
            this.rigPartIkButton, this.rigToolHint
        );
        properties.appendChild(this.rigLensPropertiesContent);

        this.rigLensContent = document.createElement('div');
        this.rigLensContent.className = 'right-workspace-rig-lens-content';
        this.rigLensContent.append(structure, properties, this.rigModeRow);
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
        title.textContent = '骨格構造';
        this.rigStructureCloseButton = document.createElement('button');
        this.rigStructureCloseButton.type = 'button';
        this.rigStructureCloseButton.className = 'gui-control gui-control--s';
        this.rigStructureCloseButton.textContent = '閉じる';
        this.rigStructureCloseButton.addEventListener('click', () => this._closeRigStructureEditor(false));
        header.append(title, this.rigStructureCloseButton);

        const body = document.createElement('div');
        body.className = 'right-workspace-rig-structure-editor-body';
        const treeSection = document.createElement('section');
        treeSection.className = 'right-workspace-rig-structure-editor-tree-section';
        const treeHeading = document.createElement('h3');
        treeHeading.textContent = '親子構造';
        this.rigStructureEditorTree = document.createElement('div');
        this.rigStructureEditorTree.className = 'right-workspace-rig-bone-tree right-workspace-rig-bone-tree--expanded';
        this.rigStructureEditorTree.setAttribute('role', 'tree');
        this.rigStructureEditorTree.setAttribute('aria-label', '骨格構造');
        this.rigStructureEditorTree.tabIndex = 0;
        this.rigStructureEditorTree.addEventListener('keydown', event => this._onRigBoneTreeKeyDown(event));
        treeSection.append(treeHeading, this.rigStructureEditorTree);

        const actions = document.createElement('section');
        actions.className = 'right-workspace-rig-structure-editor-actions';
        const actionHeading = document.createElement('h3');
        actionHeading.textContent = '構造操作';
        const nameLabel = document.createElement('label');
        nameLabel.className = 'right-workspace-rig-structure-name-label';
        nameLabel.textContent = '新しいBone名';
        this.rigStructureNameInput = document.createElement('input');
        this.rigStructureNameInput.className = 'gui-control gui-control--m';
        this.rigStructureNameInput.type = 'text';
        this.rigStructureNameInput.maxLength = 64;
        this.rigStructureNameInput.setAttribute('aria-label', '新しいBone名');
        nameLabel.appendChild(this.rigStructureNameInput);
        this.rigStructureDialogActions = document.createElement('div');
        this.rigStructureDialogActions.className = 'right-workspace-rig-structure-create-actions';
        this.rigStructureChildButton = document.createElement('button');
        this.rigStructureChildButton.type = 'button';
        this.rigStructureChildButton.className = 'gui-control gui-control--m';
        this.rigStructureChildButton.textContent = '＋ 子Bone';
        this.rigStructureChildButton.addEventListener('click', () => this._createRigLensStructureBone('child'));
        this.rigStructureSiblingButton = document.createElement('button');
        this.rigStructureSiblingButton.type = 'button';
        this.rigStructureSiblingButton.className = 'gui-control gui-control--m';
        this.rigStructureSiblingButton.textContent = '＋ 兄弟Bone';
        this.rigStructureSiblingButton.addEventListener('click', () => this._createRigLensStructureBone('sibling'));
        this.rigStructureDialogActions.append(
            this.rigRootButton, this.rigStructureChildButton, this.rigStructureSiblingButton
        );
        this.rigStructureParentHost = document.createElement('div');
        this.rigStructureParentHost.className = 'right-workspace-rig-structure-parent-host';
        this.rigStructureStatus = document.createElement('p');
        this.rigStructureStatus.className = 'right-workspace-rig-structure-editor-status';
        this.rigStructureStatus.setAttribute('role', 'status');
        this.rigStructureStatus.setAttribute('aria-live', 'polite');
        actions.append(
            actionHeading, nameLabel, this.rigStructureDialogActions,
            this.rigStructureParentHost, this.rigStructureStatus
        );
        body.append(treeSection, actions);

        const footer = document.createElement('footer');
        footer.className = 'right-workspace-rig-structure-editor-footer';
        this.rigStructureContinueButton = document.createElement('button');
        this.rigStructureContinueButton.type = 'button';
        this.rigStructureContinueButton.className = 'gui-control gui-control--m';
        this.rigStructureContinueButton.textContent = '配置へ進む';
        this.rigStructureContinueButton.addEventListener('click', () => this._closeRigStructureEditor(true));
        footer.appendChild(this.rigStructureContinueButton);
        dialog.append(header, body, footer);
        dialog.addEventListener('cancel', event => {
            event.preventDefault();
            this._closeRigStructureEditor(false);
        });
        document.body.appendChild(dialog);
        this.rigStructureEditorDialog = dialog;
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
        this.rigPartIkEffectorId = null;
        this.lastRigTargetKey = this.rigAuthoringKind === 'part'
            ? target.assetId : `${target.assetId}:${target.internalLayerId}`;
        this.rigPlacementMode = null;
        this.rigSelectedBoneId = null;
        this.rigPlacementVerifiedBoneIds.clear();
        this.rigTreeCollapsedBoneIds.clear();
        this.rigLensMode = 'setup';
        const motionEntry = this._resolveRigLensInitialMotionEntry();
        if (motionEntry.ok) {
            if (this.rigAuthoringKind === 'deform') this.rigSelectedBoneId = motionEntry.boneId;
            this.rigLensMode = 'motion';
        }
        this._showRigEntryMessage('');
        this.rigLensActive = true;
        this.sync();
        return true;
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

    _exitRigToLayer() {
        if (this.rigPointerGesture || this._requireRigPoseResolution()) return false;
        if (this.rigStructureEditorDialog?.open) this._closeRigStructureEditor(false);
        this.rigLensActive = false;
        this.rigLensTarget = null;
        this.rigPlacementMode = null;
        this.rigPartIkEffectorId = null;
        this.rigEntryMessage = '';
        this.sync();
        this.layerModeButton?.focus({ preventScroll: true });
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
        if (changed && this.rigLensMode === 'motion' && this._requireRigPoseResolution()) return false;
        this.rigSelectedBoneId = boneId;
        if (this.rigLensMode === 'setup' && this.rigAuthoringKind === 'deform') {
            const target = this._getRigLensEditTarget();
            if (target?.ok) this._expandRigBoneAncestors(target.bones, boneId);
        }
        if (changed && this.rigLensMode === 'motion') {
            const ids = this.rigLensTarget;
            const target = ids
                ? this._getRigLensTable()?.getRigLensMotionTarget?.(
                    ids.assetId, ids.internalLayerId, boneId
                )
                : null;
            if (!target?.ok) {
                this.rigLensMode = 'setup';
                this.rigEntryMessage = target?.reason || '選択BoneのMotion条件を確認してください。';
            } else {
                this.rigEntryMessage = '';
            }
        } else if (changed) {
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
            : 'SETUPへ戻る。未確定Poseがある場合はKEY確定または明示取消が必要です。';
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
        if (kind === 'part' && !this._getRigLensTable()?.getRigLensPartTarget?.(
            this.rigLensTarget.assetId)?.layers?.length) return;
        this.rigAuthoringKind = kind;
        this.rigLensMode = 'setup';
        this.rigPartIkEffectorId = null;
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
        showCancel = false
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

        this.rigPartFrameLabel.textContent = frameLabel;
        this.rigPartFrameLabel.title = pending
            ? '未確定Poseがあります。明示的にKEY確定または取消してください。'
            : '対象Clipの現在Frame。ホイールで1Frameずつ移動';
        this.rigPartFrameLabel.hidden = !!commit;
        this.rigCancelPoseButton.textContent = '↶';
        this.rigCancelPoseButton.setAttribute('aria-label', '未確定Poseを取り消す');
        this.rigCancelPoseButton.title = '未確定Poseだけを取り消す';
        this.rigCancelPoseButton.hidden = !showCancel;
        this.rigCancelPoseButton.disabled = !showCancel;

        const controls = [this.rigPartFramePrevious];
        if (commit) {
            const localFrame = Number.isInteger(commit.localFrame)
                ? commit.localFrame : currentLocalFrame;
            this.rigKeyButton.textContent = `✓ F${localFrame + 1}確定`;
            this.rigKeyButton.setAttribute('aria-label', commit.ariaLabel);
            this.rigKeyButton.title = commit.title;
            this.rigKeyButton.hidden = false;
            this.rigKeyButton.disabled = !matchesTarget;
            controls.push(this.rigKeyButton);
        } else {
            controls.push(this.rigPartFrameLabel);
        }
        controls.push(this.rigPartFrameNext);
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
        const target = this._getRigLensEditTarget();
        if (!target?.ok || !this.rigStructureEditorDialog) {
            this.rigEntryMessage = target?.reason || '骨格構造を編集できません。';
            this.sync();
            return false;
        }
        if (this.rigPlacementMode) this._cancelRigPlacement();
        if (this.rigStructureEditorDialog.open) return true;
        this.rigStructureNameInput.value = target.bones.length === 0
            ? 'Root' : `Bone ${target.bones.length}`;
        this.rigStructureEditorDialog.showModal();
        this.rigStructureDialogActions.appendChild(this.rigRootButton);
        this.rigStructureParentHost.appendChild(this.rigBoneParentLabel);
        this.rigEntryMessage = '';
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
        if (this.rigStructureEditorDialog?.open) this.rigStructureEditorDialog.close();
        if (this.rigLensPropertiesContent) {
            this.rigLensPropertiesContent.insertBefore(this.rigRootButton, this.rigChildButton);
            this.rigChildButton.after(this.rigBoneParentLabel);
        }
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
                const item = document.createElement('li');
                item.className = 'right-workspace-rig-bone-tree-item';
                item.setAttribute('role', 'none');
                item.style.setProperty('--rig-tree-depth', String(Math.min(depth, 4)));
                item.dataset.rigBoneId = bone.boneId;
                if (children.length > 0) {
                    const folded = this.rigTreeCollapsedBoneIds.has(bone.boneId);
                    const canFold = !this.rigSelectedBoneId
                        || !this._getRigBoneDescendants(bones, bone.boneId).has(this.rigSelectedBoneId);
                    const fold = document.createElement('button');
                    fold.type = 'button';
                    fold.className = 'right-workspace-rig-bone-tree-fold gui-control gui-control--s';
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
                const select = document.createElement('button');
                select.type = 'button';
                select.className = 'right-workspace-rig-bone-tree-select gui-control gui-control--s';
                select.dataset.rigTreeSelect = 'true';
                select.dataset.rigBoneId = bone.boneId;
                select.setAttribute('role', 'treeitem');
                select.setAttribute('aria-level', String(depth + 1));
                select.setAttribute('aria-selected', String(this.rigSelectedBoneId === bone.boneId));
                if (children.length > 0) select.setAttribute('aria-expanded', String(!this.rigTreeCollapsedBoneIds.has(bone.boneId)));
                select.tabIndex = this.rigSelectedBoneId === bone.boneId ? 0 : -1;
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
                const isVerified = this.rigPlacementVerifiedBoneIds.has(bone.boneId);
                const placement = document.createElement('span');
                placement.className = 'right-workspace-rig-bone-tree-placement';
                placement.textContent = isVerified ? '✓' : '○';
                placement.title = isVerified
                    ? 'Canvas位置をこの編集セッションで確認済み'
                    : 'Canvas位置の確認待ち。選択してCanvas上のBind位置を調整';
                placement.setAttribute('aria-label', isVerified ? '配置確認済み' : '配置確認待ち');
                select.title = `${name.textContent} · ${root ? 'Root' : `親 ${byId.get(bone.parentBoneId)?.name || 'Bone'}`} · ${placement.title}`;
                select.setAttribute('aria-label', `${name.textContent} · ${root ? 'Root' : `親 ${byId.get(bone.parentBoneId)?.name || 'Bone'}`} · ${placement.getAttribute('aria-label')}`);
                select.append(glyph, name, placement);
                select.addEventListener('click', () => this._selectRigLensBone(bone.boneId));
                item.appendChild(select);
                list.appendChild(item);
                if (children.length > 0 && !this.rigTreeCollapsedBoneIds.has(bone.boneId)) {
                    const nextAncestors = new Set(ancestors);
                    nextAncestors.add(bone.boneId);
                    list.appendChild(makeNodes(children, depth + 1, nextAncestors));
                }
            });
            return list;
        };
        const roots = childrenByParent.get(null) || [];
        container.appendChild(makeNodes(roots.length ? roots : bones, 0, new Set()));
        container.dataset.variant = variant;
        if (this.rigStructureTreeRestoreFocusId) {
            const focusId = this.rigStructureTreeRestoreFocusId;
            const focusTarget = [...container.querySelectorAll('[data-rig-tree-select]')]
                .find(button => button.dataset.rigBoneId === focusId);
            focusTarget?.focus({ preventScroll: true });
            this.rigStructureTreeRestoreFocusId = null;
        }
        const selected = [...container.querySelectorAll('[data-rig-tree-select]')]
            .find(button => button.dataset.rigBoneId === this.rigSelectedBoneId);
        selected?.scrollIntoView?.({ block: 'nearest' });
    }

    _onRigBoneTreeKeyDown(event) {
        if (!['ArrowDown', 'ArrowUp'].includes(event.key) || event.altKey || event.ctrlKey
            || event.metaKey || event.shiftKey
            || event.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
        const tree = event.currentTarget;
        const rows = [...tree.querySelectorAll('[data-rig-tree-select]')];
        if (rows.length === 0) return;
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
            this.rigPlacementVerifiedBoneIds.delete(result.bone.boneId);
            this.rigStructureNameInput.value = `Bone ${target.bones.length + 1}`;
            this.rigEntryMessage = '';
        } else {
            this.rigEntryMessage = result?.reason || 'Rootを作成できませんでした。';
        }
        this.rigPlacementMode = null;
        this.sync();
        return result?.ok === true;
    }

    _createRigLensStructureBone(kind) {
        if (!this.rigLensActive || this.rigAuthoringKind !== 'deform'
            || this.rigLensMode !== 'setup' || this.rigPointerGesture) return false;
        const target = this._getRigLensEditTarget();
        const selected = target?.bones?.find(bone => bone.boneId === this.rigSelectedBoneId) || null;
        const parentBoneId = kind === 'sibling' ? selected?.parentBoneId : selected?.boneId;
        if (!target?.ok || !selected || !parentBoneId) {
            this.rigEntryMessage = target?.reason
                || (kind === 'sibling' ? 'Root以外のBoneを選択して兄弟Boneを追加してください。'
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
            this.rigPlacementVerifiedBoneIds.delete(result.bone.boneId);
            this._expandRigBoneAncestors([...target.bones, result.bone], result.bone.boneId);
            this.rigStructureNameInput.value = `Bone ${target.bones.length + 1}`;
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
        if (this.rigPlacementMode === 'child' || this.rigPointerGesture?.kind === 'child') {
            this._cancelRigPlacement();
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
        if (!this.rigLensActive || !this.rigLensTarget || this.rigPointerGesture) return;
        const target = this._getRigLensEditTarget();
        const pending = target?.ok
            ? target.bones.filter(bone => !this.rigPlacementVerifiedBoneIds.has(bone.boneId))
            : [];
        if (pending.length > 0) {
            this.rigEntryMessage = `Canvas位置を確認してください（未確認 ${pending.length} Bone）。`;
            this.sync();
            return;
        }
        const { assetId, internalLayerId } = this.rigLensTarget;
        const result = this._getRigLensTable()?.generateRigLensArtworkBinding?.(assetId, internalLayerId);
        this.rigEntryMessage = result?.ok ? '' : (result?.reason || 'Artworkを接続できませんでした。');
        this.sync();
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

    _startRigPoseGesture(bone, event) {
        if (!this.rigLensActive || this.rigLensMode !== 'motion' || this.rigPointerGesture
            || event.button !== 0 || event.isPrimary === false
            || this.layerSystem?.cameraSystem?.isCanvasMoveMode?.()) return;
        const ids = this.rigLensTarget;
        const table = this._getRigLensTable();
        if (this.rigSelectedBoneId !== bone.boneId && this._requireRigPoseResolution()) {
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
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
        const start = table?.projectRigLensCanvasPoint?.(ids.assetId, ids.internalLayerId, event);
        if (!start) {
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
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
            : table?.projectRigLensCanvasPoint?.(gesture.assetId, gesture.layerId, event);
        if (!point) return;
        const targetPoint = gesture.kind === 'part-ik' ? {
            x: gesture.basePose.points.effector.x + point.x - gesture.startPointer.x,
            y: gesture.basePose.points.effector.y + point.y - gesture.startPointer.y
        } : null;
        const transform = gesture.kind === 'part-pose' && gesture.operation === 'move'
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
            if (!gesture.moved) this._restoreRigPoseGesturePreview(gesture);
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
                    gesture.startTransform, gesture.beforeState
                )
                : { ok: false, reason: '対象が変わったためBind位置の編集を取り消しました。' };
            if (!result?.ok) {
                table?.cancelRigLensStaticBoneGesture?.(gesture.assetId, gesture.beforeState);
                this.rigEntryMessage = result?.reason || 'Bind位置の編集を取り消しました。';
            } else {
                if (gesture.changed && !result.changed) {
                    table?.cancelRigLensStaticBoneGesture?.(gesture.assetId, gesture.beforeState);
                }
                if (gesture.changed && result.changed) {
                    this.rigPlacementVerifiedBoneIds.add(gesture.boneId);
                    const target = this._getRigLensEditTarget();
                    this._getRigBoneDescendants(target?.bones || [], gesture.boneId)
                        .forEach(boneId => this.rigPlacementVerifiedBoneIds.delete(boneId));
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
            this.rigPlacementVerifiedBoneIds.add(result.bone.boneId);
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
                && table?.getRigLensStaticEditTarget?.(ids?.assetId, ids?.internalLayerId)?.ok === true;
            const key = JSON.stringify([
                bones, selectedId, this.rigLensMode, this.rigAuthoringKind, staticBoneEditAllowed,
                this.rigPartIkEffectorId, this.rigPlacementMode,
                placementGesture && [placementGesture.parentBoneId, placementGesture.moved,
                    placementGesture.currentClientX, placementGesture.currentClientY]
            ]);
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
                    marker.setAttribute('data-rig-bone-id', bone.boneId || '');
                    marker.setAttribute('cx', bone.head.x);
                    marker.setAttribute('cy', bone.head.y);
                    marker.setAttribute('r', '9');
                    marker.setAttribute('role', 'button');
                    const partMotionHandle = this.rigAuthoringKind === 'part'
                        && this.rigLensMode === 'motion';
                    const staticBoneMoveHandle = staticBoneEditAllowed;
                    marker.classList.toggle('right-workspace-rig-bone-move-handle', staticBoneMoveHandle);
                    marker.classList.toggle('right-workspace-rig-part-move-handle', partMotionHandle);
                    const isIkTarget = partMotionHandle
                        && this.rigPartIkEffectorId === bone.partId;
                    marker.classList.toggle('right-workspace-rig-part-ik-target', isIkTarget);
                    const markerLabel = isIkTarget
                        ? `Part ${bone.partId}をIK手先としてドラッグ`
                        : partMotionHandle
                            ? `Part ${bone.partId}を選択、ドラッグして移動`
                        : this.rigAuthoringKind === 'part'
                            ? `Part ${bone.partId}を選択`
                            : staticBoneMoveHandle
                                ? `Bone ${bone.boneId}を選択、ドラッグしてBind位置を移動`
                                : `Bone ${bone.boneId}を選択`;
                    marker.setAttribute('aria-label', markerLabel);
                    marker.setAttribute('title', markerLabel);
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
                            if (staticBoneMoveHandle
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
                    const staticBoneTipHandle = staticBoneMoveHandle && this.rigSelectedBoneId === bone.boneId;
                    if (this.rigLensMode !== 'motion' && !staticBoneTipHandle) return [line, marker];
                    const tip = document.createElementNS(ns, 'circle');
                    tip.classList.add('right-workspace-rig-bone-marker', 'right-workspace-rig-bone-tip');
                    tip.classList.toggle('is-selected', (bone.partId || bone.boneId) === selectedId);
                    tip.setAttribute('data-rig-bone-id', bone.boneId || '');
                    tip.setAttribute('cx', bone.tail.x);
                    tip.setAttribute('cy', bone.tail.y);
                    tip.setAttribute('r', '9');
                    tip.setAttribute('role', 'button');
                    const tipLabel = this.rigLensMode === 'motion'
                        ? `${bone.partId || bone.boneId} の先端をドラッグして回転`
                        : childPlacementActive && bone.boneId === selectedId
                            ? `Bone ${bone.boneId}の先端からドラッグして子Boneを追加`
                            : `Bone ${bone.boneId}の先端をドラッグしてBind方向を変更`;
                    tip.setAttribute('aria-label', tipLabel);
                    tip.setAttribute('title', tipLabel);
                    tip.addEventListener('pointerdown', event => {
                        if (this.rigAuthoringKind === 'part') {
                            this._startRigPartPoseGesture(bone, event);
                        } else if (this.rigLensMode === 'motion') {
                            this._startRigPoseGesture(bone, event);
                        } else {
                            this._startRigStaticBoneGesture(bone, 'rotate', event);
                        }
                    });
                    return [line, marker, tip];
                });
                const tips = nodes.filter(node => node.classList.contains('right-workspace-rig-bone-tip'));
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
                this.rigOverlay.replaceChildren(
                    ...nodes.filter(node => !tips.includes(node)),
                    ...tips.filter(node => !node.classList.contains('is-selected')),
                    ...tips.filter(node => node.classList.contains('is-selected')),
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
        this.rigKindRow.hidden = !this.rigLensActive;
        this.rigModeRow.hidden = !this.rigLensActive;
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
        this.rigView.dataset.authoringKind = this.rigAuthoringKind;
        this.rigView.dataset.mode = this.rigLensMode;
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
        this.rigLensHeading.textContent = laneName ? `CAF · ${laneName}` : 'CAF';
        this.rigLensHeading.title = cafName;
        this.rigLensHeading.setAttribute('aria-label', `CAF ${cafName}${laneName ? ` · ${laneName}` : ''}`);
        this.rigView.setAttribute('aria-label', `${isMotion ? 'RIG MOTION' : 'RIG SETUP'}`);
        this.rigLensStructureTitle.textContent = isMotion ? 'Bone' : 'Bone / Artwork';
        this.rigLensPropertiesTitle.textContent = isMotion ? 'Pose状態' : '次の操作';
        this.rigLensWarning.hidden = matchesTarget && !this.rigEntryMessage;
        this.rigLensWarning.textContent = !matchesTarget
            ? 'CAFまたはRasterの選択が変わっています。対象を確認してからTransformへ戻ってください。'
            : this.rigEntryMessage;
        this.rigLensStructureContent.replaceChildren();
        const staticTarget = matchesTarget ? this._getRigLensEditTarget() : null;
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
        if (this.rigSelectedBoneId && !displayTarget?.bones?.some(bone => bone.boneId === this.rigSelectedBoneId)) {
            this.rigSelectedBoneId = null;
        }
        const structureEditorOpen = this.rigStructureEditorDialog?.open === true;
        const displayBones = displayTarget?.ok ? displayTarget.bones : [];
        const pendingPlacementCount = staticTarget?.ok
            ? staticTarget.bones.filter(bone => !this.rigPlacementVerifiedBoneIds.has(bone.boneId)).length
            : 0;
        this.rigStructureEditButton.hidden = isMotion || !matchesTarget || !staticTarget?.ok;
        this.rigStructureEditButton.textContent = staticTarget?.bones?.length
            ? '構造を編集' : '骨格を作成';
        this.rigStructureEditButton.title = staticTarget?.bones?.length
            ? '同じBone構造を編集し、親子関係を確認します。'
            : '既存rigDefinitionへRootを作成し、親子構造を組み立てます。';
        this.rigRootButton.hidden = !structureEditorOpen || isMotion
            || !staticTarget?.ok || staticTarget.bones.length !== 0;
        this.rigChildButton.hidden = isMotion || !staticTarget?.ok
            || staticTarget.bones.length === 0;
        this.rigChildButton.disabled = !staticTarget?.bones?.some(
            bone => bone.boneId === this.rigSelectedBoneId);
        const selectedStaticBone = staticTarget?.bones?.find(
            bone => bone.boneId === this.rigSelectedBoneId
        ) || null;
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
        this.rigBindButton.hidden = isMotion || !bindingTarget?.ok
            || bindingTarget.bones.length === 0 || rigTarget.hasMesh;
        this.rigBindButton.disabled = pendingPlacementCount > 0;
        this.rigBindButton.title = pendingPlacementCount > 0
            ? `Canvas位置を確認してください（未確認 ${pendingPlacementCount} Bone）。`
            : '選択中のCAF Rasterを既存AUTO GRIDのMesh / Skinへ接続';
        this.rigStructureChildButton.disabled = !staticTarget?.ok || !selectedStaticBone;
        this.rigStructureSiblingButton.disabled = !staticTarget?.ok
            || !selectedStaticBone || selectedStaticBone.parentBoneId == null;
        this.rigStructureContinueButton.disabled = displayBones.length === 0;
        this.rigStructureStatus.textContent = pendingPlacementCount > 0
            ? `Canvas位置の確認待ち ${pendingPlacementCount} Bone · Bind値は既存CAFへ保存済み`
            : displayBones.length > 0
                ? '構造は既存CAFへ記録済み · CanvasでBone位置を調整できます'
                : 'Rootから骨格構造を作成します';
        const motionTarget = matchesTarget && this.rigSelectedBoneId
            ? this._getRigLensTable()?.getRigLensMotionTarget?.(
                rigTarget.assetId, rigTarget.internalLayerId, this.rigSelectedBoneId
            ) : null;
        this._syncRigModeAction(motionTarget, matchesTarget);
        const table = this._getRigLensTable();
        const pendingPose = this._hasRigPosePreview(table);
        const boneDraftMatches = isMotion && !!motionTarget?.preview;
        this._renderRigFrameNavigation({
            authoringKind: 'deform',
            mode: this.rigLensMode,
            matchesTarget,
            frameTarget: partTarget,
            pending: pendingPose,
            commit: boneDraftMatches ? {
                localFrame: motionTarget.localFrame,
                ariaLabel: `F${motionTarget.localFrame + 1}の${motionTarget.bone.name || 'Bone'} PoseをMotion KEYへ確定`,
                title: '選択Boneの未確定Poseを既存Bone KEYへ確定'
            } : null,
            showCancel: isMotion && pendingPose
        });
        this.rigKeyButton.hidden = !isMotion || pendingPose;
        if (boneDraftMatches) {
            this.rigKeyButton.hidden = false;
        } else {
            this.rigKeyButton.textContent = '◆ Motion KEY確定';
            this.rigKeyButton.setAttribute('aria-label', '現在FrameのBone PoseをMotion KEYへ確定');
            this.rigKeyButton.title = '現在Frameの選択Bone Poseを既存KEYへ確定';
        }
        this.rigKeyButton.disabled = !motionTarget?.ok;
        this.rigCancelPoseButton.hidden = !isMotion || !pendingPose;
        this.rigLensTerminal.hidden = !isMotion || pendingPose;
        this.rigToolHint.textContent = !matchesTarget
            ? '対象Rasterを確認してください.'
            : isMotion
                ? (motionTarget?.ok
                    ? (motionTarget.preview ? '未確定Pose' : motionTarget.key ? 'KEY設定済み' : 'KEY未設定')
                    : motionTarget?.reason || '接続済みBoneを選択してください。')
                : !staticTarget?.ok && bindingTarget?.ok && bindingTarget.bones.length > 0
                    ? '選択Rasterの絵をBoneへ接続'
                    : !staticTarget?.ok && rigTarget.hasMesh
                        ? (artworkBindingReady
                            ? '絵は接続済み · MOTIONでPoseを編集'
                            : 'Mesh / Skinの接続状態を確認してください。')
                : !staticTarget?.ok
                    ? (staticTarget?.reason || '対象を確認してください。')
                : pendingPlacementCount > 0
                    ? `Canvas位置を確認してください · 未確認 ${pendingPlacementCount} Bone`
                : this.rigPlacementMode === 'root'
                        ? 'RootはArtwork中心へ直接作成されます'
                        : this.rigPlacementMode === 'child'
                            ? `${selectedParentLabel}の先端からCanvas上へdragして子Boneを追加 · Escで取消`
                            : staticTarget.bones.length === 0
                                ? 'RootはArtworkの不透明範囲中心へ作成されます'
                                : this.rigSelectedBoneId
                                    ? 'Boneの頭をdragして移動、先端をdragして方向を変更'
                                    : 'Bone一覧またはCanvas上の頭markerから選択';
        this.rigToolHint.title = isMotion
            ? '選択Boneの先端をドラッグしてPose preview。明示KEY確定またはPose取消が必要です。'
            : this.rigPlacementMode === 'child'
                ? `${selectedParentLabel}を親として先端からdragし、子Boneを作成します。Escまたはボタン再押下で取消できます。`
                : '骨格構造を作成してからCanvas位置を調整します。選択Boneの頭はBind移動、先端は方向変更です。';
        this.rigToolHint.hidden = !isMotion && !this.rigPlacementMode
            && staticTarget?.ok === true
            && (staticTarget.bones.length === 0 || !!this.rigSelectedBoneId);

        if (!matchesTarget) {
            const message = document.createElement('p');
            message.textContent = '現在の選択と入場時の対象が一致しないため、構造情報を表示していません。';
            this.rigLensStructureContent.appendChild(message);
            this._renderRigPendingPoseRecovery(target);
            return;
        }

        const layer = partTarget?.layers?.find(candidate => candidate.id === rigTarget.internalLayerId);
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
        this.rigCompactBoneTree = null;
        if (displayTarget?.ok && displayTarget.bones.length && !isMotion) {
            const tree = document.createElement('div');
            tree.className = 'right-workspace-rig-bone-tree right-workspace-rig-bone-tree--compact';
            tree.setAttribute('role', 'tree');
            tree.setAttribute('aria-label', 'Bone構造とCanvas配置確認');
            tree.addEventListener('keydown', event => this._onRigBoneTreeKeyDown(event));
            this.rigLensStructureContent.appendChild(tree);
            this.rigCompactBoneTree = tree;
            this._renderRigBoneTree(tree, displayTarget.bones, 'compact');
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
            this._renderRigBoneTree(this.rigStructureEditorTree, displayBones, 'expanded');
            this.rigStructureEditorTree.setAttribute('aria-label', '骨格構造');
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
            || (matchesAsset ? '' : '選択中のCAFが変わっています。');
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
            ? 'Canvas上で複数PartのPoseを調整し、同じFrameの変更をまとめてKEY確定できます。'
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
        this.title.hidden = rigLensVisible;
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
        if (rigTargetKey !== this.lastRigTargetKey) {
            if (this._hasRigPosePreview()) {
                this.rigEntryMessage = '未確定Poseがあります。対象を切り替える前にMotion KEY確定またはPose取消を行ってください。';
            } else {
                this.lastRigTargetKey = rigTargetKey;
                this.rigEntryMessage = '';
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
        this.rigEntryButton?.removeEventListener('click', this._rigEntryClickHandler);
        this.rigLayerEntryButton?.removeEventListener('click', this._rigEntryClickHandler);
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
