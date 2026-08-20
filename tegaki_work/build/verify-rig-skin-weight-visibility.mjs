import assert from 'node:assert/strict';
import { resolveRigSkinWeightVisibility } from '../system/animation/rig-skin-weight-visibility.js';

const rig = resolveRigSkinWeightVisibility({
    editorMode: 'rig',
    available: true,
    requestedVisible: true,
    rigSetupActive: true,
    correctionRequested: true
});
assert.deepEqual(rig, {
    editorMode: 'rig',
    available: true,
    visible: true,
    overlayActive: true,
    correctionActive: true,
    brushActive: false,
    editing: true
});

const brush = resolveRigSkinWeightVisibility({
    editorMode: 'rig',
    available: true,
    requestedVisible: true,
    rigSetupActive: true,
    brushRequested: true
});
assert.equal(brush.brushActive, true);
assert.equal(brush.editing, true);

const motion = resolveRigSkinWeightVisibility({
    editorMode: 'motion',
    available: true,
    requestedVisible: true,
    motionBoneActive: true,
    correctionRequested: true
});
assert.equal(motion.overlayActive, true, 'Motion停止中も同じread-only overlayを表示する');
assert.equal(motion.correctionActive, false, 'MotionへCORRECTを持ち込まない');
assert.equal(motion.brushActive, false, 'MotionへBRUSHを持ち込まない');
assert.equal(motion.editing, false);

const playing = resolveRigSkinWeightVisibility({
    editorMode: 'motion',
    available: true,
    requestedVisible: true,
    motionBoneActive: true,
    playing: true
});
assert.equal(playing.visible, true, '再生中もruntime requestを維持する');
assert.equal(playing.overlayActive, false, '再生出力へ診断overlayを混ぜない');

assert.equal(resolveRigSkinWeightVisibility({
    editorMode: 'motion',
    available: false,
    requestedVisible: true,
    motionBoneActive: true
}).visible, false, 'target消失時は表示要求を成立させない');
assert.equal(resolveRigSkinWeightVisibility({
    editorMode: 'warp',
    available: true,
    requestedVisible: true
}).overlayActive, false, 'WARPへ診断overlayを持ち込まない');

console.log('verify-rig-skin-weight-visibility: shared RIG/Motion read-only visibility and RIG-only correction / brush OK');
