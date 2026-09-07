/**
 * WP-007: production ExportManager guard for active Layer Transform sessions.
 * The fixture records zero mutation at the guard boundary and retries after
 * explicit confirm/cancel state transitions. It does not emulate UI focus.
 */
import assert from 'node:assert/strict';

globalThis.window = {
    PopupManager: { popups: new Map() },
    CoreRuntime: null,
    TEGAKI_CONFIG: { canvas: { width: 8, height: 8 } }
};
globalThis.document = {
    createElement() { return null; }
};

const { ExportManager } = await import('../system/export-manager.js');

const BLOCK_REASON = 'pending-layer-transform';

function createSelectionState(active = false) {
    return { active, confirmed: 0, history: 0 };
}

function installSelection(state) {
    window.CoreRuntime = {
        api: {
            selection: {
                getState() {
                    return { transformSessionActive: state.active };
                },
                confirmTransform() {
                    if (!state.active) return false;
                    state.active = false;
                    state.confirmed += 1;
                    state.history += 1;
                    return true;
                }
            }
        }
    };
}

function createLayerSystem({ active = false, target = 'layer-source', layerId = 'layer-1' } = {}) {
    const state = {
        active,
        layerId,
        hasPendingTransform: active,
        target,
        model: {
            transform: { x: active ? 3 : 0, y: active ? 1 : 0 },
            tracks: active ? [{ frame: 0, x: 3, y: 1 }] : []
        }
    };
    return {
        state,
        getLayerMoveCommitState() {
            return {
                active: state.active,
                layerId: state.layerId,
                hasPendingTransform: state.hasPendingTransform
            };
        },
        hasActiveLayerTransformSession() {
            return state.active;
        },
        getActiveTransformEditTarget() {
            return state.target;
        },
        getLayers() {
            return [];
        }
    };
}

function createExporter(calls) {
    return {
        async generateBlob() {
            calls.generateBlob += 1;
            return new Blob([calls.marker], { type: 'application/octet-stream' });
        },
        async generatePreview() {
            calls.generatePreview += 1;
            return new Blob([calls.marker], { type: 'application/octet-stream' });
        }
    };
}

function createManager(layerSystem, calls) {
    const manager = new ExportManager({ renderer: {} }, layerSystem);
    manager.registerExporter('png', createExporter(calls));
    manager.registerExporter('apng', createExporter(calls));
    manager.registerExporter('psd', createExporter(calls));
    manager.registerExporter('webp', createExporter(calls));
    manager.downloadFile = () => { calls.download += 1; };
    return manager;
}

function snapshot(layerSystem) {
    return structuredClone(layerSystem.state);
}

async function assertBlocked(entry, invoke) {
    const before = snapshot(entry.layerSystem);
    await assert.rejects(invoke, error => {
        assert.equal(error.code, BLOCK_REASON);
        assert.equal(error.reason, BLOCK_REASON);
        assert.equal(error.blocked, true);
        return true;
    });
    assert.deepEqual(entry.layerSystem.state, before, `${entry.name}: guard must not mutate model/session`);
    assert.equal(entry.calls.generateBlob, 0, `${entry.name}: exporter must not run`);
    assert.equal(entry.calls.generatePreview, 0, `${entry.name}: preview exporter must not run`);
    assert.equal(entry.calls.renderFrames, 0, `${entry.name}: sequence must not render`);
    assert.equal(entry.calls.download, 0, `${entry.name}: download must not start`);
}

for (const [name, target] of [
    ['SOURCE', 'layer-source'],
    ['CAF SOURCE', 'layer-source'],
    ['ANIMATE Layer', 'clip-layer-transform-key'],
    ['ANIMATE Folder', 'clip-folder-transform-key']
]) {
    const calls = { generateBlob: 0, generatePreview: 0, renderFrames: 0, download: 0, marker: name };
    const layerSystem = createLayerSystem({ active: true, target, layerId: `${name}-layer` });
    const manager = createManager(layerSystem, calls);
    manager.renderAnimationFrames = async () => {
        calls.renderFrames += 1;
        return [];
    };
    manager._getFrameCount = () => 2;
    const entry = { name, layerSystem, calls };

    await assertBlocked(entry, () => manager.export('png', { skipDownload: true }));
    await assertBlocked(entry, () => manager.generatePreview('png', { transparent: true }));
    await assertBlocked(entry, () => manager.exportSequencePNG({}));
    await assertBlocked(entry, () => manager.exportAsPNGBlob({}));
}

// Selection keeps its existing automatic commit when no Layer Transform is active.
const selectionCalls = { generateBlob: 0, generatePreview: 0, renderFrames: 0, download: 0, marker: 'selection' };
const selection = createSelectionState(true);
installSelection(selection);
const selectionLayerSystem = createLayerSystem({ active: false });
const selectionManager = createManager(selectionLayerSystem, selectionCalls);
const selectionBlob = await selectionManager.export('png', { skipDownload: true });
assert.equal(await selectionBlob.text(), 'selection');
assert.equal(selection.active, false);
assert.equal(selection.confirmed, 1);
assert.equal(selection.history, 1);
assert.equal(selectionCalls.generateBlob, 1);

// A retry is allowed only after the caller changes the session explicitly.
const retryCalls = { generateBlob: 0, generatePreview: 0, renderFrames: 0, download: 0, marker: 'confirmed' };
const retryLayerSystem = createLayerSystem({ active: true, target: 'layer-source' });
const retryManager = createManager(retryLayerSystem, retryCalls);
await assertBlocked({ name: 'retry-before-confirm', layerSystem: retryLayerSystem, calls: retryCalls },
    () => retryManager.generatePreview('png'));
retryLayerSystem.state.active = false;
retryLayerSystem.state.hasPendingTransform = false;
retryLayerSystem.state.model.transform = { x: 3, y: 1 };
const confirmed = await retryManager.generatePreview('png');
assert.equal(await confirmed.blob.text(), 'confirmed');
retryCalls.marker = 'cancelled';
retryLayerSystem.state.model.transform = { x: 0, y: 0 };
const cancelled = await retryManager.generatePreview('png');
assert.equal(await cancelled.blob.text(), 'cancelled');
assert.notEqual(await confirmed.blob.text(), await cancelled.blob.text());

console.log('WP-007 guard: SOURCE/CAF/ANIMATE Layer/Folder block with zero mutation; Selection auto-commit and explicit retry pass.');
