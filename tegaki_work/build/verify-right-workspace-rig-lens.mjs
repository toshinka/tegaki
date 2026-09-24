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
assert.match(frame, /Rootを配置/u, 'RIG lens exposes Root placement');
assert.match(frame, /rigRootButton\.addEventListener\('click',[\s\S]*?_createRigLensStaticRoot\(\)/u,
    'the Root button creates directly instead of arming a second Canvas click');
assert.match(frame, /getRigLensStaticEditTarget/u,
    'static structure UI uses the editability guard rather than display-only eligibility');
assert.match(frame, /子Boneを追加/u, 'RIG lens exposes child Bone placement');
assert.match(frame, /rigView\.dataset\.authoringKind = this\.rigAuthoringKind[\s\S]*?rigView\.dataset\.mode = this\.rigLensMode/u,
    'existing RIG view state drives the setup/motion surface projection');
assert.match(frame, /rigLensContent\.append\(structure, properties, this\.rigModeRow\)/u,
    'one shared phase action follows the target and operation content inside its scroll owner');
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
assert.match(frame, /_startRigStaticBoneGesture\(bone, 'move', event\)[\s\S]*?_startRigStaticBoneGesture\(bone, 'rotate', event\)/u,
    'static Bone head and selected tip handles edit Bind placement and direction');
assert.match(frame, /resolveBoneRootHandleDrag[\s\S]*?previewRigLensStaticBoneBind/u,
    'static Bind translation uses the existing Bone drag resolver and setup adapter');
assert.match(frame, /rigBoneParentSelect\.addEventListener\('change',[\s\S]*?_setRigLensBoneParent/u,
    'the selected Bone exposes a compact explicit parent change control');
assert.doesNotMatch(frame, /target\.bones\.length\s*(?:>=|<)\s*3/u,
    'RIG Lens authoring has no former three-Bone UI cap');
assert.match(frame, /_renderRigPendingPoseRecovery\(target\)[\s\S]*?Poseを取消/u,
    'an explicit cancel remains available if a target changes during a pending Pose');
const targetChangeGuard = frame.match(/if \(rigTargetKey !== this\.lastRigTargetKey\) \{([\s\S]*?)\n        \}/u)?.[1] || '';
assert.match(targetChangeGuard, /_hasRigPosePreview\(\)/u,
    'target changes are held behind the existing pending-Pose guard');
assert.doesNotMatch(targetChangeGuard, /cancelRigLensBonePosePreview/u,
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

console.log('PASS: Right Workspace RIG lens projection, target guard, static Bone handoff, and Dock-preserving return contracts');
