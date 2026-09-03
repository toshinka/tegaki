import assert from 'node:assert/strict';
import {
    getLayerPanelDiagnosticsSnapshot,
    getLayerPanelDiagnosticsSummary,
    isLayerPanelDiagnosticsEnabled,
    recordLayerClippingRefresh,
    recordLayerPanelRender,
    recordLayerPanelRequest,
    resetLayerPanelDiagnostics,
    resolveLayerPanelDiagnosticState
} from '../system/layer-panel-diagnostics.js';

assert.equal(isLayerPanelDiagnosticsEnabled({ debug: true }), true);
assert.equal(isLayerPanelDiagnosticsEnabled({ debug: false }), false);
assert.equal(resolveLayerPanelDiagnosticState(), 'normal');
assert.equal(resolveLayerPanelDiagnosticState({ hasAnimationContext: true }), 'caf-table-closed');
assert.equal(
    resolveLayerPanelDiagnosticState({ hasAnimationContext: true, tableVisible: true }),
    'caf-table-open'
);

resetLayerPanelDiagnostics();
recordLayerPanelRequest({ force: true });
recordLayerPanelRequest({ coalesced: true, dragDeferred: true });
recordLayerPanelRender({ state: 'normal', durationMs: 2, rows: [{ id: 'layer-a', depth: 0 }] });
recordLayerPanelRender({ state: 'caf-table-open', durationMs: 4, rows: [{ id: 'layer-b', depth: 1 }] });
recordLayerClippingRefresh({ source: 'panel-update-request', durationMs: 3, layerCount: 8 });

let snapshot = getLayerPanelDiagnosticsSnapshot();
assert.deepEqual(snapshot.requests, {
    count: 2,
    forceCount: 1,
    coalescedCount: 1,
    dragDeferredCount: 1
});
assert.equal(snapshot.renders.count, 2);
assert.equal(snapshot.renders.averageDurationMs, 3);
assert.equal(snapshot.renders.byState.normal.count, 1);
assert.equal(snapshot.renders.byState['caf-table-open'].maxDurationMs, 4);
assert.equal(snapshot.clipping.count, 1);
assert.equal(snapshot.clipping.bySource['panel-update-request'].count, 1);
assert.equal(getLayerPanelDiagnosticsSummary().renders.last.state, 'caf-table-open');
assert.equal(getLayerPanelDiagnosticsSummary().clipping.last.source, 'panel-update-request');
assert.equal(getLayerPanelDiagnosticsSummary().renders.recent.length, 2);
assert.equal(getLayerPanelDiagnosticsSummary().clipping.recent.length, 1);

snapshot.renders.samples[0].rows[0].id = 'mutated';
assert.equal(getLayerPanelDiagnosticsSnapshot().renders.samples[0].rows[0].id, 'layer-a');

for (let index = 0; index < 130; index += 1) {
    recordLayerPanelRender({ state: 'caf-table-closed', durationMs: index });
}
snapshot = getLayerPanelDiagnosticsSnapshot();
assert.equal(snapshot.renders.samples.length, 120);

resetLayerPanelDiagnostics();
snapshot = getLayerPanelDiagnosticsSnapshot();
assert.equal(snapshot.renders.count, 0);
assert.equal(snapshot.clipping.count, 0);

console.log('verify-layer-panel-diagnostics: state, counters, duration buckets, ring buffer, snapshot isolation OK');
