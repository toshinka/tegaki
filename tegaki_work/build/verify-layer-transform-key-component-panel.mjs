import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { removeLayerTransformComponentKey } from '../system/animation/clip-layer-key-bundle.js';

const source = readFileSync(new URL('../system/layer-transform.js', import.meta.url), 'utf8');
const popupSource = readFileSync(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8');
function methodSource(name, next) {
    const start = source.indexOf(`\n    ${name}(`);
    const end = source.indexOf(`\n    ${next}(`, start + 1);
    assert(start >= 0 && end > start, `${name} source boundary`);
    return source.slice(start, end);
}

function popupMethodSource(name, next) {
    const start = popupSource.indexOf(`\n    ${name}(`);
    const end = popupSource.indexOf(`\n    ${next}(`, start + 1);
    assert(start >= 0 && end > start, `${name} popup source boundary`);
    return popupSource.slice(start, end);
}

class FakeClassList {
    constructor() { this.values = new Set(); }
    add(...values) { values.forEach(value => this.values.add(value)); }
    remove(...values) { values.forEach(value => this.values.delete(value)); }
    toggle(value, force) {
        const next = force === undefined ? !this.values.has(value) : force;
        if (next) this.values.add(value); else this.values.delete(value);
        return next;
    }
}
class FakeElement {
    constructor(tag = 'div') {
        this.tagName = tag.toUpperCase();
        this.children = [];
        this.dataset = {};
        this.attributes = {};
        this.classList = new FakeClassList();
        this.hidden = false;
        this.disabled = false;
        this.textContent = '';
        this.listeners = {};
    }
    append(...items) { this.children.push(...items); }
    appendChild(item) { this.children.push(item); return item; }
    replaceChildren(...items) { this.children = [...items]; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    get buttons() { return this.children.filter(item => item.tagName === 'BUTTON'); }
}
const componentPanel = new FakeElement('div');
globalThis.document = {
    getElementById(id) { return id === 'layer-transform-key-components' ? componentPanel : null; },
    createElement(tag) { return new FakeElement(tag); }
};
const syncComponents = new Function(`return ({${methodSource('_syncTimelineKeyComponents', '_syncTimelineKeyStrip')}})._syncTimelineKeyComponents;`)();
const host = {
    isVKeyPressed: true,
    deleted: [],
    onDeleteLayerTransformComponent(component) { this.deleted.push(component); }
};
host.sync = syncComponents;

host.sync.call(host, { components: [] }, 'F1');
assert.equal(componentPanel.hidden, true);
assert.equal(componentPanel.children.length, 0);

host.sync.call(host, {
    components: [{ component: 'basic', key: true }, { component: 'warp', key: true }],
    pending: false
}, 'F5');
assert.equal(componentPanel.hidden, false);
assert.equal(componentPanel.children.length, 2);
assert.deepEqual(componentPanel.children.map(row => row.dataset.component), ['basic', 'warp']);
assert.deepEqual(componentPanel.children.map(row => row.buttons[0].attributes['aria-label']), [
    'F5のBASIC KEYを削除',
    'F5のWARP KEYを削除'
]);
componentPanel.children[0].buttons[0].listeners.click({ preventDefault() {}, stopPropagation() {} });
assert.deepEqual(host.deleted, ['basic']);

host.sync.call(host, {
    components: [{ component: 'warp', key: true }],
    pending: true
}, 'F5');
assert.equal(componentPanel.children.length, 1);
assert.equal(componentPanel.children[0].buttons[0].disabled, true);
assert.equal(componentPanel.children[0].buttons[0].title, '先にKEYを確定または取消してください');

assert.match(popupSource, /caf-layer-transform-key-component-delete/);
const deleteComponent = new Function(
    'removeLayerTransformComponentKey',
    'showFeedbackToast',
    `return ({${popupMethodSource('deleteLayerTransformComponent', '_abandonLayerTransformBridgeAfterHistory')}}).deleteLayerTransformComponent;`
)(removeLayerTransformComponentKey, () => {});

function makeDeleteHost({ pending = false, includeWarp = false } = {}) {
    const clip = {
        id: 'clip-panel-delete',
        duration: 4,
        layerTransformTracks: [{
            internalLayerId: 'layer-1',
            keyframes: [{ frame: 1, x: 2, y: 3 }]
        }],
        layerDeformers: includeWarp ? {
            version: 1,
            targets: [{
                internalLayerId: 'layer-1',
                deformer: {
                    type: 'warp-grid',
                    keyframes: [{ frame: 1, points: [{ x: 0, y: 0 }] }]
                }
            }]
        } : null
    };
    const records = [];
    const refreshed = [];
    return {
        selectedCelId: clip.id,
        model: { findClipEntry() { return { clip }; } },
        layerSystem: {
            getLayerMoveCommitState() { return { active: true, hasPendingTransform: pending }; },
            _layerTransformSession: {
                transaction: {
                    clipId: clip.id,
                    internalLayerId: 'layer-1',
                    localFrame: 1,
                    duration: clip.duration
                }
            },
            refreshLayerTransformTimelineSessionAfterHistory() { refreshed.push('basic'); },
            refreshLayerWarpTimelineSessionAfterHistory() { refreshed.push('warp'); }
        },
        _captureTimelineHistoryState() { return { revision: records.length }; },
        _syncWorkingLayersForCurrentFrame() {},
        render() {},
        _requestLayerPanelSync() {},
        _recordTimelineHistory(before, after, name, meta) {
            records.push({ before, after, name, meta });
        },
        records,
        refreshed,
        clip
    };
}

const deleteHost = makeDeleteHost({ includeWarp: true });
assert.equal(deleteComponent.call(deleteHost, 'basic'), true);
assert.equal(deleteHost.clip.layerTransformTracks.length, 0);
assert.equal(deleteHost.clip.layerDeformers.targets[0].deformer.keyframes.length, 1);
assert.equal(deleteHost.records.length, 1);
assert.equal(deleteHost.records[0].name, 'caf-layer-transform-key-component-delete');
assert.deepEqual(deleteHost.refreshed, ['basic', 'warp']);

const warpDeleteHost = makeDeleteHost({ includeWarp: true });
assert.equal(deleteComponent.call(warpDeleteHost, 'warp'), true);
assert.equal(warpDeleteHost.clip.layerTransformTracks[0].keyframes.length, 1);
assert.equal(warpDeleteHost.clip.layerDeformers, null);
assert.equal(warpDeleteHost.records.length, 1);

const pendingDeleteHost = makeDeleteHost({ pending: true, includeWarp: true });
const pendingBefore = JSON.stringify(pendingDeleteHost.clip);
assert.equal(deleteComponent.call(pendingDeleteHost, 'basic'), false);
assert.equal(JSON.stringify(pendingDeleteHost.clip), pendingBefore);
assert.equal(pendingDeleteHost.records.length, 0);

console.log('verify-layer-transform-key-component-panel: PASS');
