import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {};
const { TimelineModel } = await import('../system/animation/animation-data-model.js');

const model = new TimelineModel({
    fps: 8,
    totalFrames: 24,
    playback: {
        currentFrame: 8,
        loop: false,
        endMode: 'out-marker',
        inFrame: 8,
        outFrame: 17
    }
});

assert.deepEqual(model.getPlaybackRange(), { start: 8, end: 17 },
    'OUT MARKER resolves the inclusive F9-F18 playback range');
model.setCurrentFrame(16);
assert.equal(model.advanceFrame(), true, 'F17 advances to the OUT marker');
assert.equal(model.playback.currentFrame, 17, 'playback reaches F18');
assert.equal(model.advanceFrame(), false, 'non-looping playback stops at OUT instead of passing it');
assert.equal(model.playback.currentFrame, 17, 'stopped playback remains on F18');

model.playback.loop = true;
assert.equal(model.advanceFrame(), true, 'looping playback advances from OUT');
assert.equal(model.playback.currentFrame, 8, 'looping playback returns to IN');

const restored = new TimelineModel(JSON.parse(JSON.stringify(model.serialize())));
assert.equal(restored.playback.endMode, 'out-marker', 'Project round-trip keeps OUT MARKER selected');
assert.equal(restored.playback.inFrame, 8, 'Project round-trip keeps IN');
assert.equal(restored.playback.outFrame, 17, 'Project round-trip keeps OUT');
assert.deepEqual(restored.getPlaybackRange(), { start: 8, end: 17 },
    'restored playback uses the same OUT-bounded range');

console.log('verify-animation-table-playback-out-marker: inclusive OUT stop, IN loop and playback round-trip OK');
