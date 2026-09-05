import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    TRANSFORM_EDIT_AUTHORITY,
    TRANSFORM_EDIT_CONTEXT_MODE,
    projectTransformEditContext
} from '../system/animation/transform-edit-context.js';

const buildDir = path.dirname(fileURLToPath(import.meta.url));
const workDir = path.resolve(buildDir, '..');
const read = relative => fs.readFileSync(path.join(workDir, relative), 'utf8');

const clip = {
    id: 'clip-a',
    startFrame: 10,
    duration: 6,
    transform: { x: 0, y: 0 },
    transformKeyframes: [
        { frame: 2, x: 20 },
        { frame: 2, x: 24 },
        { frame: 4, x: 40 }
    ]
};
const before = JSON.stringify(clip);

assert.deepEqual(projectTransformEditContext({
    tableVisible: false,
    selectedClip: clip,
    timelineFrame: 12
}), {
    mode: TRANSFORM_EDIT_CONTEXT_MODE.SOURCE,
    authority: TRANSFORM_EDIT_AUTHORITY.LAYER_SOURCE,
    writable: true,
    reason: null,
    clipId: null,
    timelineFrame: 12,
    localFrame: null,
    keyIndex: -1,
    hasExplicitKey: false,
    internalLayerId: null
});

assert.equal(projectTransformEditContext({ tableVisible: true, timelineFrame: 12 }).reason, 'clip-selection-required');
assert.equal(projectTransformEditContext({
    tableVisible: true,
    isPlaying: true,
    selectedClip: clip,
    timelineFrame: 12
}).reason, 'playback-active');
assert.equal(projectTransformEditContext({
    tableVisible: true,
    selectedClip: clip,
    selectedClipCount: 2,
    timelineFrame: 12
}).reason, 'single-clip-required');
assert.equal(projectTransformEditContext({
    tableVisible: true,
    selectedClip: { ...clip, duration: 1 },
    timelineFrame: 10
}).reason, 'animated-duration-required');
assert.equal(projectTransformEditContext({
    tableVisible: true,
    selectedClip: clip,
    timelineFrame: 9
}).reason, 'frame-outside-clip');
assert.equal(projectTransformEditContext({
    tableVisible: true,
    selectedClip: clip,
    timelineFrame: 16
}).reason, 'frame-outside-clip');

const ready = projectTransformEditContext({
    tableVisible: true,
    selectedClip: clip,
    timelineFrame: 11
});
assert.equal(ready.mode, TRANSFORM_EDIT_CONTEXT_MODE.ANIMATE_READY);
assert.equal(ready.authority, TRANSFORM_EDIT_AUTHORITY.CLIP_TRANSFORM_KEY);
assert.equal(ready.localFrame, 1);
assert.equal(ready.hasExplicitKey, false);

const keyed = projectTransformEditContext({
    tableVisible: true,
    selectedClip: clip,
    timelineFrame: 12
});
assert.equal(keyed.mode, TRANSFORM_EDIT_CONTEXT_MODE.ANIMATE_KEYED);
assert.equal(keyed.authority, TRANSFORM_EDIT_AUTHORITY.CLIP_TRANSFORM_KEY);
assert.equal(keyed.localFrame, 2);
assert.equal(keyed.keyIndex, 1);
assert.equal(keyed.hasExplicitKey, true);
assert.equal('key' in keyed, false, 'projection must not expose a mutable live key object');
assert.equal(JSON.stringify(clip), before, 'projection must not mutate ClipInstance input');

const layerClip = {
    ...clip,
    layerTransformTracks: [{
        internalLayerId: 'layer-2',
        pivotX: 120,
        pivotY: 160,
        keyframes: [{ frame: 2, x: 12, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }]
    }]
};
const layerReady = projectTransformEditContext({
    tableVisible: true,
    selectedClip: layerClip,
    timelineFrame: 11,
    internalLayerId: 'layer-2'
});
assert.equal(layerReady.authority, TRANSFORM_EDIT_AUTHORITY.CLIP_LAYER_TRANSFORM_KEY);
assert.equal(layerReady.mode, TRANSFORM_EDIT_CONTEXT_MODE.ANIMATE_READY);
assert.equal(layerReady.internalLayerId, 'layer-2');
const layerKeyed = projectTransformEditContext({
    tableVisible: true,
    selectedClip: layerClip,
    timelineFrame: 12,
    internalLayerId: 'layer-2'
});
assert.equal(layerKeyed.authority, TRANSFORM_EDIT_AUTHORITY.CLIP_LAYER_TRANSFORM_KEY);
assert.equal(layerKeyed.mode, TRANSFORM_EDIT_CONTEXT_MODE.ANIMATE_KEYED);
assert.equal(layerKeyed.keyIndex, 0);

const helperSource = read('system/animation/transform-edit-context.js');
const popupSource = read('ui/animation-table-popup.js');
assert.doesNotMatch(helperSource, /historyManager|eventBus|localStorage|setClipTransformKeyframes/);
assert.match(popupSource, /import \{[\s\S]*?projectTransformEditContext,[\s\S]*?\} from '\.\.\/system\/animation\/transform-edit-context\.js';/);
assert.match(popupSource, /getTransformEditContext\(workingLayerId = null\) \{/);
assert.match(popupSource, /tableVisible: this\.isVisible/);
assert.match(popupSource, /timelineFrame: this\.model\.playback\?\.currentFrame/);

console.log('Phase 9p Transform Edit Context verifier passed.');
