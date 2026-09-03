/**
 * Layer Panel三状態とclipping mask再構築のdebug計測を保持する。
 * Project / Historyへ保存せず、TEGAKI_CONFIG.debug有効時だけ呼び出し側が記録する。
 */

const MAX_SAMPLES = 120;

function createState() {
    return {
        requests: {
            count: 0,
            forceCount: 0,
            coalescedCount: 0,
            dragDeferredCount: 0
        },
        renders: {
            count: 0,
            totalDurationMs: 0,
            maxDurationMs: 0,
            byState: {},
            samples: []
        },
        clipping: {
            count: 0,
            totalDurationMs: 0,
            maxDurationMs: 0,
            bySource: {},
            samples: []
        }
    };
}

let diagnostics = createState();

function finiteDuration(value) {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function appendSample(target, sample) {
    target.push(sample);
    if (target.length > MAX_SAMPLES) {
        target.splice(0, target.length - MAX_SAMPLES);
    }
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function recordDurationBucket(bucket, durationMs) {
    const duration = finiteDuration(durationMs);
    bucket.count = (bucket.count || 0) + 1;
    bucket.totalDurationMs = finiteDuration(bucket.totalDurationMs) + duration;
    bucket.maxDurationMs = Math.max(finiteDuration(bucket.maxDurationMs), duration);
    bucket.averageDurationMs = bucket.totalDurationMs / bucket.count;
}

export function isLayerPanelDiagnosticsEnabled(config) {
    return config?.debug === true;
}

export function resolveLayerPanelDiagnosticState({
    hasAnimationContext = false,
    tableVisible = false
} = {}) {
    if (!hasAnimationContext) return 'normal';
    return tableVisible ? 'caf-table-open' : 'caf-table-closed';
}

export function recordLayerPanelRequest({
    force = false,
    coalesced = false,
    dragDeferred = false
} = {}) {
    diagnostics.requests.count += 1;
    if (force) diagnostics.requests.forceCount += 1;
    if (coalesced) diagnostics.requests.coalescedCount += 1;
    if (dragDeferred) diagnostics.requests.dragDeferredCount += 1;
}

export function recordLayerPanelRender(sample = {}) {
    const durationMs = finiteDuration(sample.durationMs);
    const stateName = sample.state || 'normal';
    recordDurationBucket(diagnostics.renders, durationMs);
    diagnostics.renders.byState[stateName] ||= {};
    recordDurationBucket(diagnostics.renders.byState[stateName], durationMs);
    appendSample(diagnostics.renders.samples, {
        ...clone(sample),
        durationMs
    });
}

export function recordLayerClippingRefresh(sample = {}) {
    const durationMs = finiteDuration(sample.durationMs);
    const source = sample.source || 'direct';
    recordDurationBucket(diagnostics.clipping, durationMs);
    diagnostics.clipping.bySource[source] ||= {};
    recordDurationBucket(diagnostics.clipping.bySource[source], durationMs);
    appendSample(diagnostics.clipping.samples, {
        ...clone(sample),
        source,
        durationMs
    });
}

export function getLayerPanelDiagnosticsSnapshot() {
    return clone(diagnostics);
}

export function getLayerPanelDiagnosticsSummary() {
    const snapshot = getLayerPanelDiagnosticsSnapshot();
    return {
        requests: snapshot.requests,
        renders: {
            count: snapshot.renders.count,
            totalDurationMs: snapshot.renders.totalDurationMs,
            averageDurationMs: snapshot.renders.averageDurationMs || 0,
            maxDurationMs: snapshot.renders.maxDurationMs,
            byState: snapshot.renders.byState,
            last: snapshot.renders.samples.at(-1) || null,
            recent: snapshot.renders.samples.slice(-12)
        },
        clipping: {
            count: snapshot.clipping.count,
            totalDurationMs: snapshot.clipping.totalDurationMs,
            averageDurationMs: snapshot.clipping.averageDurationMs || 0,
            maxDurationMs: snapshot.clipping.maxDurationMs,
            bySource: snapshot.clipping.bySource,
            last: snapshot.clipping.samples.at(-1) || null,
            recent: snapshot.clipping.samples.slice(-12)
        }
    };
}

export function resetLayerPanelDiagnostics() {
    diagnostics = createState();
}
