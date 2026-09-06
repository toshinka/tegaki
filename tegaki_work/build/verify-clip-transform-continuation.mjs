/** WP-003: execute production continuation methods; host UI/adapter services are isolated. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isTransformTimelineKeyTarget, TRANSFORM_EDIT_TRANSACTION_TARGET } from '../system/animation/transform-edit-transaction.js';

const source = readFileSync(new URL('../system/layer-system.js', import.meta.url), 'utf8');
function method(name, next) {
    const start = source.indexOf(`\n    ${name}(`);
    const end = source.indexOf(`\n    ${next}(`, start + 1);
    assert(start >= 0 && end > start);
    return new Function('isTransformTimelineKeyTarget', 'TRANSFORM_EDIT_TRANSACTION_TARGET',
        `return ({${source.slice(start, end)}}).${name};`)(isTransformTimelineKeyTarget, TRANSFORM_EDIT_TRANSACTION_TARGET);
}
const resume = method('_resumeLayerTransformTimelineSession', 'commitLayerTransformTimelineKeyAndContinue');
const commit = method('commitLayerTransformTimelineKeyAndContinue', 'stepLayerTransformTimelineFrame');
const step = method('stepLayerTransformTimelineFrame', 'exitLayerMoveMode');
const target = TRANSFORM_EDIT_TRANSACTION_TARGET.CLIP_LAYER_TRANSFORM_KEY;
function fixture({ accepts = true, changed = true, committed = true } = {}) {
    const events = [];
    const layer = { layerData: { id: 'working-raster' } };
    const host = {
        events, begins: 0, finishes: 0, history: 0, moved: 0, panel: true, camera: true,
        _layerTransformSession: { layerId: layer.layerData.id, transaction: { target }, previewResult: { changed } },
        getActiveLayer: () => layer,
        enterLayerMoveMode() { this.begins++; return accepts; },
        _finishLayerTransformTimelineSession() {
            this.finishes++;
            this._layerTransformSession = null;
            if (committed && changed) this.history++;
            return { ok: true, commit: committed && changed, target };
        },
        _resumeLayerTransformTimelineSession: resume,
        _emitPanelUpdateRequest() {},
        eventBus: { emit: (name, payload) => events.push({ name, payload }) },
        _transformEditAdapter: { moveFrame() { host.moved++; return true; } },
        transform: {
            updateTransformPanelValues() {}, syncBasicOverlay() {}, setEditContextProjection() {},
            exitMoveMode() { host.panel = false; }
        },
        cameraSystem: { setVKeyPressed(value) { host.camera = value; } }
    };
    return host;
}
const success = fixture();
assert.equal(commit.call(success), true);
assert.equal(success.history, 1);
assert.equal(success.begins, 1);
assert.equal(success.panel, true);
assert.equal(success.events.some(e => e.name === 'layer:transform-exit'), false);
const noop = fixture({ changed: false });
assert.equal(commit.call(noop), false);
assert.equal(noop.finishes, 0);
assert.equal(noop.history, 0);
assert.equal(step.call(noop, 1), true);
assert.equal(noop.history, 0);
assert.equal(noop.begins, 1);
const pending = fixture();
assert.equal(step.call(pending, 1), false);
assert.equal(pending.finishes, 0);
for (const changed of [true, false]) {
    const rejected = fixture({ accepts: false, changed });
    assert.equal(changed ? commit.call(rejected) : step.call(rejected, 1), false);
    assert.equal(rejected.panel, false);
    assert.equal(rejected.camera, false);
    assert.equal(rejected.begins, 1, 'no speculative begin retry');
    assert.equal(rejected.history, changed ? 1 : 0, 'successful commit survives rejected resume');
    const exits = rejected.events.filter(e => e.name === 'layer:transform-exit');
    assert.equal(exits.length, 1, 'rejected resume must notify Keyboard/Popup/UI terminal');
    assert.deepEqual(exits[0].payload, { layerId: 'working-raster', target, confirmed: changed, cancelled: false });
}
console.log('WP-003 production continuation: success/no-op/pending/rejected resume passed (isolated host).');
