import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const buildRoot = path.dirname(fileURLToPath(import.meta.url));
const workRoot = path.dirname(buildRoot);
const read = relative => fs.readFileSync(path.join(workRoot, relative), 'utf8');

const frame = read('ui/right-workspace-frame.js');
const renderer = read('ui/layer-panel-renderer.js');
const keyboard = read('ui/keyboard-handler.js');
const surface = read('styles/components/layer-panel-surface.css');

assert.match(frame, /rigLensActive = false/u, 'RIG lens starts as runtime-only inactive view');
assert.match(frame, /this\.root\.classList\.toggle\('has-transform-workspace', active\)/u,
    'LAYER / TRANSFORM switch follows the single workspace projection');
assert.match(frame, /this\.root\.classList\.toggle\('is-rig-lens-active', rigLensVisible\)/u,
    'RIG lens is projected separately from Transform edit state');
assert.match(frame, /this\.panel\.hidden = rigLensVisible/u,
    'RIG lens hides the regular Transform inspector');
assert.match(frame, /this\.drawing\.inert = active/u,
    'the existing Layer UI is inert while either Transform or RIG view is active');
assert.match(frame, /hasPendingTransform === true[\s\S]*?return false/u,
    'pending Transform/KEY changes reject RIG entry');
assert.match(frame, /transformSessionActive === true[\s\S]*?return false/u,
    'active selection Transform rejects RIG entry');
assert.match(frame, /preserveMotionWindow: true/u,
    'return to Transform preserves an open Animation Dock');
assert.match(frame, /this\.rigLensTarget = \{[\s\S]*?assetId: target\.assetId[\s\S]*?internalLayerId: target\.internalLayerId/u,
    'entry retains only the CAF Asset and internal Raster identity for this view handoff');
assert.match(frame, /骨格を作成/u, 'RIG lens exposes the structure-first entry');
assert.match(frame, /rigRootButton\.addEventListener\('click',[\s\S]*?_createRigLensStaticRoot\(/u,
    'the Root action creates through the existing CAF registration owner');
assert.match(frame, /_createRigStructureEditorDialog\(\)[\s\S]*?document\.createElement\('dialog'\)[\s\S]*?showModal\(\)/u,
    'expanded structure editing is a native modal that blocks Canvas input behind it');
assert.match(frame, /title\.textContent = '骨格を組み立てる'[\s\S]*?rigStructureAddBoneButton\.textContent = '＋ Bone'[\s\S]*?right-workspace-rig-structure-board-viewport/u,
    'the expanded editor centers the Bone card board and exposes one primary add action');
assert.doesNotMatch(frame, /rigStructureChildButton|rigStructureSiblingButton/u,
    'the expanded editor no longer requires child/sibling action sequencing');
assert.match(frame, /_getRigHierarchyCardTree\(bones\)[\s\S]*?parentBoneId[\s\S]*?number: parts\.join\('-'\)/u,
    'hierarchy numbers derive from parent links');
assert.match(frame, /serialized bones\[\] enumeration as sibling display order/u,
    'sibling display order reuses the existing serialized bones array order');
assert.match(frame, /_onRigHierarchyCardDragStart[\s\S]*?_onRigHierarchyCardDragOver[\s\S]*?_onRigHierarchyCardDrop/u,
    'cards expose source feedback, guarded target feedback, and a real reparent drop handler');
assert.match(frame, /setRigLensStaticBoneParent\?\.[\s\S]*?appendToSiblingEnd: true/u,
    'a valid card drop uses the existing CAF parent owner and places the bone last among siblings');
assert.match(frame, /rigBoneParentSelect\.addEventListener\('change',[\s\S]*?_setRigLensBoneParent/u,
    'the expanded editor reuses the guarded parent-change selector');
assert.match(frame, /childrenByParent[\s\S]*?parentBoneId[\s\S]*?item\.appendChild\(makeNodes\(/u,
    'both tree projections derive hierarchy from the existing parentBoneId and nest children under treeitems');
assert.match(frame, /rigTreeCollapsedBoneIds = new Set\(\)/u,
    'fold state is runtime-only and separate from Bone hierarchy data');
assert.match(frame, /rigStructureTreeRestoreFocusId[\s\S]*?activeVariant/u,
    'keyboard focus restoration targets the currently visible tree projection');
assert.match(frame, /getRigLensStaticBindGestureTarget\?\.[\s\S]*?\?\.ok === true/u,
    'SETUP Bind gestures use the current CAF target permission');
assert.match(frame, /staticBoneBindDraggable = staticBoneEditAllowed[\s\S]*?staticBoneMoveHandle = staticBoneEditAllowed\s*&& this\.rigSelectedBoneId === bone\.boneId/u,
    'safe joints move directly while only the selected Bone shows its move affordance');
assert.match(frame, /const marker = document\.createElementNS\(ns, 'circle'\);[\s\S]*?if \(isStaticRoot\) marker\.classList\.add\('right-workspace-rig-bone-root-marker'\)/u,
    'SETUP Root and Bone joints share the circle marker contract');
assert.doesNotMatch(frame, /rigPlacementVerifiedBoneIds|pendingPlacementCount/u,
    'SETUP does not keep a parallel manual placement-validity model');
assert.match(frame, /getRigLensStaticTarget\?\.[\s\S]*?allowExistingOtherRasterBindings: true[\s\S]*?bindingTarget\.bones\.length > 0 && !rigTarget\.hasMesh/u,
    'Binding availability requires a model-valid target, a Bone, and no target Mesh');
assert.match(frame, /rigBindButton\.disabled = !bindingAvailable/u,
    'Binding button projects the current model guard result');
assert.match(frame, /getRigLensStaticEditTarget/u,
    'static structure UI uses the editability guard rather than display-only eligibility');
assert.match(frame, /子Boneを追加/u, 'RIG lens exposes child Bone placement');
assert.match(frame, /rigChildButton\.addEventListener\('click',[\s\S]*?_onRigChildPlacementClick\(\)/u,
    'the visible child action enters the existing placement mode');
assert.match(frame, /_onRigChildPlacementClick\(\)[\s\S]*?_armRigPlacement\('child'\)/u,
    'the actual child action handler uses the existing runtime placement state');
assert.match(frame, /const kindSelected = this\.rigAuthoringKind === 'part' \|\| this\.rigAuthoringKind === 'deform'[\s\S]*?rigPartKindButton\.setAttribute\('aria-pressed', String\(this\.rigAuthoringKind === 'part'\)\)[\s\S]*?rigDeformKindButton\.setAttribute\('aria-pressed', String\(this\.rigAuthoringKind === 'deform'\)\)[\s\S]*?rigView\.dataset\.authoringKind = kindSelected \? this\.rigAuthoringKind : 'none'[\s\S]*?rigView\.dataset\.mode = this\.rigLensMode/u,
    'RIG selection buttons and view projection expose the explicit unselected state');
assert.match(frame, /rigLensContent\.append\(\s*structure, properties, this\.rigModeRow, this\.rigKindPrompt, this\.rigResetRegion\s*\)/u,
    'one shared phase action and the top-level reset region stay inside the existing RIG scroll owner');
assert.doesNotMatch(frame, /rigSetupButton|rigPoseButton/u,
    'the upper SETUP/MOTION segment is not duplicated');
assert.match(frame, /MOTIONへ進む →[\s\S]*?← SETUPへ戻る/u,
    'the phase control describes the next action rather than labeling the current state');
assert.match(frame, /_resolveRigLensInitialMotionEntry\(\)[\s\S]*?getRigLensPartMotionTarget[\s\S]*?getRigLensMotionTarget/u,
    'entry derives Motion readiness from the existing PART and DEFORM resolvers');
assert.match(frame, /if \(motionEntry\.ok\)[\s\S]*?this\.rigLensMode = 'motion'/u,
    'only a resolver-approved target receives Motion-first entry');
assert.match(frame, /_syncRigModeAction\(motionTarget, matchesTarget\)[\s\S]*?rigModeActionButton\.disabled/u,
    'the next-step action is enabled only for the current resolved target');
assert.match(frame, /_selectRigLensBone\(bone\.boneId\)/u,
    'Bone list and Canvas selection route through the guarded selector');
assert.match(frame, /staticBoneBindDraggable[\s\S]*?_startRigStaticBoneGesture\(bone, 'move', event\)/u,
    'a safe SETUP joint starts Bind move directly');
assert.match(frame, /right-workspace-rig-bind-rotate[\s\S]*?_startRigStaticBoneGesture\(bone, 'rotate', event\)/u,
    'the selected SETUP Bone rotation arc starts Bind rotate');
assert.match(frame, /resolveBoneRootHandleDrag[\s\S]*?previewRigLensStaticBoneBind/u,
    'static Bind translation uses the existing Bone drag resolver and setup adapter');
assert.match(frame, /rigBoneParentSelect\.addEventListener\('change',[\s\S]*?_setRigLensBoneParent/u,
    'the selected Bone exposes a compact explicit parent change control');
assert.doesNotMatch(frame, /target\.bones\.length\s*(?:>=|<)\s*3/u,
    'RIG Lens authoring has no former three-Bone UI cap');
assert.match(frame, /_renderRigPendingPoseRecovery\(target\)[\s\S]*?Poseを取消/u,
    'an explicit cancel remains available if a target changes during a pending Pose');
assert.match(frame, /_syncActiveRigLensTarget\(target\)[\s\S]*?if \(this\._hasRigPosePreview\(\)\)[\s\S]*?RIG_TARGET_SWITCH_POSE_MESSAGE/u,
    'active RIG selection changes reuse the existing pending-Pose guard');
assert.match(frame, /if \(this\.rigPointerGesture \|\| this\.rigStructureDrag\)[\s\S]*?RIG_TARGET_SWITCH_GESTURE_MESSAGE/u,
    'active pointer and structure gestures defer target replacement');
assert.match(frame, /_enterRigLens\(\{ sync: false \}\)/u,
    'a safe valid target change re-enters through the existing RIG entry path');
assert.match(frame, /_exitRigToLayer\(\{ sync: false \}\)/u,
    'an invalid target falls back to LAYER through existing navigation');
assert.doesNotMatch(frame, /対象を確認してからTransformへ戻ってください/u,
    'RIG target mismatch copy no longer describes Transform as the parent lens');
const activeTargetSync = frame.match(/_syncActiveRigLensTarget\(target\)[\s\S]*?\n    _returnToTransform\(\)/u)?.[0] || '';
assert.ok(activeTargetSync, 'active selection synchronization has one bounded implementation');
assert.doesNotMatch(activeTargetSync, /cancelRigLensBonePosePreview/u,
    'target projection never silently cancels a Bone Pose');
assert.match(frame, /this\.rigLensStructureTitle\.textContent = isMotion \? 'Bone' : 'Bone \/ Artwork'/u,
    'DEFORM setup combines static structure and artwork status while motion focuses the Bone list');
assert.match(frame, /targetRow\.className = 'right-workspace-rig-target-row right-workspace-rig-deform-static'/u,
    'static Raster identity is marked for omission from DEFORM motion');
assert.match(frame, /right-workspace-rig-deform-static right-workspace-rig-artwork-state/u,
    'artwork binding is summarized as one compact setup state');
assert.match(frame, /right-workspace-rig-deform-bones/u,
    'the Bone list retains selection and parent labels in one hierarchy surface');
assert.match(frame, /this\.rigToolHint\.hidden = !isMotion && !this\.rigPlacementMode/u,
    'idle SETUP does not retain a duplicate instructional block while actionable states remain visible');
assert.doesNotMatch(frame, /selection\.textContent = `\$\{selected\.name/u,
    'the selected Bone summary is not duplicated below the selectable list');
assert.match(frame, /this\.rigPartIkButton\.hidden = true/u,
    'the PART-only IK control does not leak into the DEFORM workspace');
assert.match(frame, /registerRigLensStaticBone/u, 'Canvas gesture commits through the existing CAF owner');
assert.doesNotMatch(frame, /registerClipAsset|generateClipAsset|recordInternalLayerHistory|setClipRig/u,
    'RIG lens presentation does not mutate RIG data or History');
assert.match(renderer, /targetLayer\?\.type === 'raster'[\s\S]*?targetLayer\.parentLayerId == null/u,
    'RIG eligibility is based on the selected CAF root Raster');
assert.match(renderer, /assetId: cafContext\.asset\.id[\s\S]*?internalLayerId: targetLayer\?\.id/u,
    'RIG target comes from existing CAF and internal Layer identity');
assert.match(renderer, /CAF内のRasterを選択してからRIGを編集してください/u,
    'invalid target has user-visible refusal context');
assert.match(keyboard, /if \(options\.preserveMotionWindow !== true\)[\s\S]*?setMotionWindowOpen\?\.\(false\)/u,
    'the existing Transform entry keeps its default Dock behavior and has an explicit preserve option');
assert.match(surface, /layer-transform-panel\.is-context-inspector\[hidden\][\s\S]*?display: none !important/u,
    'the old Transform panel cannot paint through its forced display rule under the RIG lens');
assert.match(surface, /right-workspace-rig-lens[\s\S]*?background: transparent/u,
    'RIG view uses the existing transparent Workspace surface');
assert.match(surface, /data-authoring-kind="deform"\]\[data-mode="motion"\] \.right-workspace-rig-deform-static[\s\S]*?display: none !important/u,
    'DEFORM motion hides static setup details without affecting PART or setup');
assert.match(surface, /right-workspace-rig-deform-action[\s\S]*?width: 100%/u,
    'DEFORM next actions use the available compact workspace width');
assert.match(surface, /\.right-workspace-rig-flow-action[\s\S]*?width: 100%[\s\S]*?white-space: normal/u,
    'the shared action remains full-width and readable in the narrow Workspace');
assert.match(surface, /right-workspace-rig-bone-parent-control[\s\S]*?min-width: 0/u,
    'the parent selector fits the narrow RIG Workspace');
assert.match(surface, /right-workspace-rig-bone-move-handle[\s\S]*?cursor: move/u,
    'static Bind handles advertise their pointer operation');
assert.match(frame, /event\.target\?\.closest\?\.\('\.right-workspace-rig-bone-overlay \.right-workspace-rig-bone-marker'\)/u,
    'document capture routes Bone marker input before the existing Bind-handle listeners');
assert.match(frame, /registerRigLensStaticBone[\s\S]*?parentBoneId: gesture\.parentBoneId/u,
    'child placement commits through the existing static CAF registration with its selected parent');
assert.match(frame, /event\.key === 'Escape'[\s\S]*?_cancelRigPlacement\(\)/u,
    'Escape remains a cancellation route while placement is armed or active');
assert.match(frame, /window\.addEventListener\('blur', this\._rigBlurHandler\)/u,
    'window blur cancels an incomplete child gesture');
assert.match(surface, /right-workspace-rig-bone-placement-preview[\s\S]*?pointer-events: none/u,
    'the child placement ghost is visible without taking pointer ownership');
assert.match(surface, /\.right-workspace-rig-structure-editor\[open\][\s\S]*?display: flex/u,
    'the expanded editor receives its central, scrollable GUI surface');
assert.match(surface, /\.right-workspace-rig-bone-tree-select\[aria-selected="true"\][\s\S]*?--active-border/u,
    'tree selection uses the existing Futaba active-border token');

globalThis.window = globalThis.window || {};
const { RightWorkspaceFrame } = await import('../ui/right-workspace-frame.js');
const registeredGestures = [];
const pointerCapture = [];
const canvas = {
    setPointerCapture: pointerId => pointerCapture.push(['set', pointerId]),
    releasePointerCapture: pointerId => pointerCapture.push(['release', pointerId])
};
window.coreEngine = { getApp: () => ({ canvas }) };
const editTarget = { ok: true, bones: [{ boneId: 'root', name: 'Root' }] };
const table = {
    isPlaying: false,
    projectRigLensCanvasPoint: (_assetId, _layerId, event) => ({ x: event.clientX, y: event.clientY }),
    registerRigLensStaticBone: (assetId, layerId, gesture) => {
        registeredGestures.push({ assetId, layerId, ...gesture });
        const bone = { boneId: `child-${registeredGestures.length}`, name: `Bone ${registeredGestures.length}` };
        editTarget.bones.push(bone);
        return { ok: true, changed: true, bone };
    }
};
const createFrame = () => {
    const instance = Object.create(RightWorkspaceFrame.prototype);
    Object.assign(instance, {
        rigLensActive: true,
        rigAuthoringKind: 'deform',
        rigLensMode: 'setup',
        rigLensTarget: { assetId: 'asset', internalLayerId: 'raster' },
        rigSelectedBoneId: 'root',
        rigPlacementMode: null,
        rigPointerGesture: null,
        rigEntryMessage: '',
        layerSystem: { cameraSystem: { isCanvasMoveMode: () => false } },
        sync() {}
    });
    instance._getRigLensEditTarget = () => editTarget;
    instance._getRigLensTable = () => table;
    return instance;
};
const pointer = (target, pointerId, x, y) => ({
    target, pointerId, clientX: x, clientY: y, button: 0, isPrimary: true,
    defaultPrevented: false, immediateStopped: false,
    preventDefault() { this.defaultPrevented = true; },
    stopImmediatePropagation() { this.immediateStopped = true; }
});
const behavioralFrame = createFrame();
assert.equal(behavioralFrame._onRigChildPlacementClick(), true);
assert.equal(behavioralFrame.rigPlacementMode, 'child');
const parentTip = {
    dataset: { rigBoneId: 'root' },
    classList: { contains: className => className === 'right-workspace-rig-bone-tip' },
    closest() { return this; }
};
const down = pointer(parentTip, 21, 20, 30);
behavioralFrame._onRigCanvasDown(down);
assert.equal(behavioralFrame.rigPointerGesture.parentBoneId, 'root');
assert.equal(down.defaultPrevented && down.immediateStopped, true,
    'the marker event is owned before it can start a Bind edit');
const move = pointer(canvas, 21, 90, 70);
behavioralFrame._onRigCanvasMove(move);
assert.equal(behavioralFrame.rigPointerGesture.moved, true);
assert.equal(registeredGestures.length, 0, 'pointermove only previews and creates no intermediate Bone');
const up = pointer(canvas, 21, 90, 70);
behavioralFrame._onRigCanvasUp(up);
assert.equal(registeredGestures.length, 1, 'one completed drag creates exactly one Bone');
assert.deepEqual(registeredGestures[0], {
    assetId: 'asset', layerId: 'raster', kind: 'child',
    start: { x: 20, y: 30 }, end: { x: 90, y: 70 }, parentBoneId: 'root'
});
assert.equal(behavioralFrame.rigSelectedBoneId, 'child-1');
assert.equal(behavioralFrame.rigPlacementMode, null);

const clickFrame = createFrame();
clickFrame._onRigChildPlacementClick();
clickFrame._onRigCanvasDown(pointer(canvas, 22, 10, 10));
clickFrame._onRigCanvasUp(pointer(canvas, 22, 10, 10));
assert.equal(registeredGestures.length, 1, 'a click without a drag creates no Bone');
assert.equal(clickFrame.rigPlacementMode, 'child', 'a short click leaves the explicit tool ready for retry');
clickFrame._onRigWindowBlur();
assert.equal(clickFrame.rigPlacementMode, null, 'window blur disarms the incomplete placement');

const cancelFrame = createFrame();
cancelFrame._onRigChildPlacementClick();
cancelFrame._onRigCanvasDown(pointer(canvas, 23, 15, 15));
const cancelEvent = pointer(canvas, 23, 40, 40);
cancelFrame._onRigCanvasCancel(cancelEvent);
assert.equal(registeredGestures.length, 1, 'pointercancel creates no Bone');
assert.equal(cancelFrame.rigPointerGesture, null);
assert.equal(cancelFrame.rigPlacementMode, null);
assert.equal(cancelEvent.defaultPrevented && cancelEvent.immediateStopped, true);

// Binding uses the selected CAF/Raster model guard and a Bone, without a
// separate per-Bone placement-confirmation list.
const bindingCase = (target, generationResult = { ok: true }) => {
    let generationCalls = 0;
    const instance = Object.create(RightWorkspaceFrame.prototype);
    Object.assign(instance, {
        rigLensActive: true,
        rigAuthoringKind: 'deform',
        rigLensMode: 'setup',
        rigLensTarget: { assetId: 'asset', internalLayerId: 'raster' },
        rigPointerGesture: null,
        rigSelectedBoneId: 'root',
        rigEntryMessage: '',
        sync() {}
    });
    instance._getRigLensTable = () => ({
        getRigLensStaticTarget: (_assetId, _layerId, options) => options.allowBound
            ? { ok: true, bones: [{ boneId: 'root', parentBoneId: null }] } : target,
        generateRigLensArtworkBinding: () => { generationCalls++; return generationResult; },
        getRigLensMotionTarget: () => ({ ok: true, bone: { boneId: 'root' } })
    });
    instance._setRigLensMode = mode => mode === 'motion';
    return { instance, getGenerationCalls: () => generationCalls };
};
const invalidBinding = bindingCase({ ok: false, reason: '既存Bindingと競合します。', bones: [] });
assert.equal(invalidBinding.instance._bindRigArtwork(), false);
assert.equal(invalidBinding.getGenerationCalls(), 0, 'invalid model target cannot start Binding');
assert.equal(invalidBinding.instance.rigEntryMessage, '既存Bindingと競合します。');
const rootlessBinding = bindingCase({ ok: true, bones: [] });
assert.equal(rootlessBinding.instance._bindRigArtwork(), false);
assert.equal(rootlessBinding.getGenerationCalls(), 0, 'a valid target still needs a Root Bone');
const readyBinding = bindingCase({ ok: true, bones: [{ boneId: 'root', parentBoneId: null }] });
assert.equal(readyBinding.instance._bindRigArtwork(), true,
    'a model-valid target with a Bone reaches Binding and Motion without manual confirmation');
assert.equal(readyBinding.getGenerationCalls(), 1);
assert.equal('rigPlacementVerifiedBoneIds' in readyBinding.instance, false);

console.log('PASS: Right Workspace RIG lens projection, target guard, static Bone handoff, and Dock-preserving return contracts');
