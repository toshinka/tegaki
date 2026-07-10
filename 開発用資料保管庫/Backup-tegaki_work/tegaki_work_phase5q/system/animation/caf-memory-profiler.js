/**
 * @file caf-memory-profiler.js
 * @description Phase 5k: CAF / DrawingSnapshot / History / Texture常駐量をdebug時だけ集計する。
 * 公開API: collectCafMemoryProfile, formatBytesForCafMemoryProfile
 */

const BYTES_PER_RGBA_PIXEL = 4;

function byteLengthOfPixels(pixels) {
    if (!pixels) return 0;
    if (Number.isFinite(pixels.byteLength)) return pixels.byteLength;
    if (Number.isFinite(pixels.length)) return pixels.length;
    return 0;
}

function estimateRgbaBytes(width, height) {
    const w = Math.max(0, Math.round(Number(width) || 0));
    const h = Math.max(0, Math.round(Number(height) || 0));
    return w * h * BYTES_PER_RGBA_PIXEL;
}

function addBytes(target, key, bytes) {
    target[key] = (target[key] || 0) + (Number(bytes) || 0);
}

function createBucket() {
    return {
        count: 0,
        bytes: 0
    };
}

export function formatBytesForCafMemoryProfile(bytes) {
    const value = Number(bytes) || 0;
    if (value >= 1024 * 1024 * 1024) return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
    if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
    if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${value} B`;
}

function collectSnapshotProfile(model) {
    const snapshots = model?.drawingSnapshots || [];
    const byId = new Map();
    const profile = {
        count: snapshots.length,
        withPixels: 0,
        blankCount: 0,
        nullPixels: 0,
        bytes: 0,
        blankBytes: 0,
        maxSnapshotBytes: 0,
        maxSnapshotId: null
    };

    snapshots.forEach(snapshot => {
        if (!snapshot?.id) return;
        byId.set(snapshot.id, snapshot);
        const bytes = byteLengthOfPixels(snapshot.pixels);
        if (bytes > 0) {
            profile.withPixels++;
        } else {
            profile.nullPixels++;
        }
        if (snapshot.isBlank === true) {
            profile.blankCount++;
            profile.blankBytes += bytes;
        }
        profile.bytes += bytes;
        if (bytes > profile.maxSnapshotBytes) {
            profile.maxSnapshotBytes = bytes;
            profile.maxSnapshotId = snapshot.id;
        }
    });

    return { profile, byId };
}

function collectReferenceProfile(model, snapshotById) {
    const referencedIds = new Set();
    const internalLayerRefs = createBucket();
    const assetRefs = createBucket();
    const missingRefs = [];
    let internalLayerCount = 0;
    let rasterInternalLayerCount = 0;

    (model?.clipAssets || []).forEach(asset => {
        if (asset?.drawingSnapshotId) {
            referencedIds.add(asset.drawingSnapshotId);
            const snapshot = snapshotById.get(asset.drawingSnapshotId);
            if (snapshot) {
                assetRefs.count++;
                assetRefs.bytes += byteLengthOfPixels(snapshot.pixels);
            } else {
                missingRefs.push({ owner: 'asset', assetId: asset.id, snapshotId: asset.drawingSnapshotId });
            }
        }

        (asset?.internalLayers || []).forEach(layer => {
            internalLayerCount++;
            if (layer?.type === 'raster') rasterInternalLayerCount++;
            if (!layer?.drawingSnapshotId) return;
            referencedIds.add(layer.drawingSnapshotId);
            const snapshot = snapshotById.get(layer.drawingSnapshotId);
            if (snapshot) {
                internalLayerRefs.count++;
                internalLayerRefs.bytes += byteLengthOfPixels(snapshot.pixels);
            } else {
                missingRefs.push({ owner: 'internalLayer', assetId: asset.id, layerId: layer.id, snapshotId: layer.drawingSnapshotId });
            }
        });
    });

    return {
        referencedSnapshotCount: referencedIds.size,
        unreferencedSnapshotCount: Math.max(0, (model?.drawingSnapshots?.length || 0) - referencedIds.size),
        assetRefs,
        internalLayerRefs,
        internalLayerCount,
        rasterInternalLayerCount,
        missingRefs
    };
}

function collectClipRasterSnapshotProfile(model) {
    const profile = {
        count: 0,
        withPixels: 0,
        bytes: 0,
        maxBytes: 0,
        maxClipId: null
    };

    (model?.tracks || []).forEach(track => {
        (track?.cels || []).forEach(cel => {
            if (!cel?.rasterSnapshot) return;
            profile.count++;
            const bytes = byteLengthOfPixels(cel.rasterSnapshot.pixels);
            profile.bytes += bytes;
            if (bytes > 0) profile.withPixels++;
            if (bytes > profile.maxBytes) {
                profile.maxBytes = bytes;
                profile.maxClipId = cel.id;
            }
        });
    });

    return profile;
}

function collectHistoryProfile(history) {
    const stack = history?.stack || [];
    const profile = {
        entries: stack.length,
        index: Number.isFinite(history?.index) ? history.index : -1,
        bytes: 0,
        maxEntries: history?.maxSize || null,
        maxBytes: history?.maxMemoryBytes || null,
        cafRaster: createBucket(),
        timeline: {
            count: 0,
            bytes: 0,
            snapshotRefs: 0,
            snapshotPixelBytes: 0,
            maxSnapshotRefs: 0,
            maxSnapshotRefsCommand: null
        },
        byName: {}
    };

    stack.forEach(command => {
        const declared = Number(command?.byteSize ?? command?.meta?.byteSize);
        const bytes = Number.isFinite(declared) && declared > 0 ? declared : 0;
        profile.bytes += bytes;

        const name = command?.name || 'unknown';
        if (!profile.byName[name]) profile.byName[name] = createBucket();
        profile.byName[name].count++;
        profile.byName[name].bytes += bytes;

        if (command?.meta?.historyKind === 'raster' || name === 'caf-internal-layer-draw') {
            profile.cafRaster.count++;
            profile.cafRaster.bytes += bytes;
        }
        if (command?.meta?.historyKind === 'timeline' || Number.isFinite(Number(command?.meta?.timelineSnapshotRefs))) {
            const snapshotRefs = Number(command?.meta?.timelineSnapshotRefs) || 0;
            const snapshotPixelBytes = Number(command?.meta?.timelineSnapshotPixelBytes) || 0;
            profile.timeline.count++;
            profile.timeline.bytes += bytes;
            profile.timeline.snapshotRefs += snapshotRefs;
            profile.timeline.snapshotPixelBytes += snapshotPixelBytes;
            if (snapshotRefs > profile.timeline.maxSnapshotRefs) {
                profile.timeline.maxSnapshotRefs = snapshotRefs;
                profile.timeline.maxSnapshotRefsCommand = name;
            }
        }
    });

    return profile;
}

function collectLayerSystemProfile(layerSystem) {
    const profile = {
        layers: 0,
        rasterRenderTextures: createBucket(),
        animationWorkingLayers: createBucket()
    };

    (layerSystem?.getLayers?.() || []).forEach(layer => {
        const layerData = layer?.layerData;
        if (!layerData || layerData.isFolder || layerData.isBackground) return;
        profile.layers++;
        const rt = layerData.renderTexture;
        const bytes = estimateRgbaBytes(rt?.width || rt?.source?.width, rt?.height || rt?.source?.height);
        profile.rasterRenderTextures.count++;
        profile.rasterRenderTextures.bytes += bytes;
        if (layerData.isAnimationWorkingLayer === true) {
            profile.animationWorkingLayers.count++;
            profile.animationWorkingLayers.bytes += bytes;
        }
    });

    return profile;
}

async function collectBrowserMemoryProfile(options = {}) {
    const perf = globalThis.performance;
    const result = {
        measureUserAgentSpecificMemory: null,
        memory: null,
        error: null
    };

    if (options.includeUserAgentSpecificMemory && typeof perf?.measureUserAgentSpecificMemory === 'function') {
        try {
            result.measureUserAgentSpecificMemory = await perf.measureUserAgentSpecificMemory();
        } catch (error) {
            result.error = error?.message || String(error);
        }
    }

    if (perf?.memory) {
        result.memory = {
            jsHeapSizeLimit: Number(perf.memory.jsHeapSizeLimit) || 0,
            totalJSHeapSize: Number(perf.memory.totalJSHeapSize) || 0,
            usedJSHeapSize: Number(perf.memory.usedJSHeapSize) || 0
        };
    }

    return result;
}

function summarizeEstimatedBytes(report) {
    const estimated = {};
    addBytes(estimated, 'drawingSnapshots', report.snapshots.bytes);
    addBytes(estimated, 'blankSnapshots', report.snapshots.blankBytes);
    addBytes(estimated, 'clipRasterSnapshots', report.clipRasterSnapshots.bytes);
    addBytes(estimated, 'history', report.history.bytes);
    addBytes(estimated, 'cafRasterHistory', report.history.cafRaster.bytes);
    addBytes(estimated, 'textureCache', report.textureCache?.bytes || 0);
    addBytes(estimated, 'renderTextures', report.layerSystem.rasterRenderTextures.bytes);
    addBytes(estimated, 'animationWorkingRenderTextures', report.layerSystem.animationWorkingLayers.bytes);
    estimated.hotRuntimeApprox = estimated.drawingSnapshots
        + estimated.clipRasterSnapshots
        + estimated.history
        + estimated.textureCache
        + estimated.renderTextures;
    return estimated;
}

export async function collectCafMemoryProfile({
    animationTable,
    model = animationTable?.model,
    history = null,
    layerSystem = animationTable?.layerSystem,
    includeUserAgentSpecificMemory = false,
    force = false
} = {}) {
    const debugEnabled = globalThis.TEGAKI_CONFIG?.debug === true;
    if (!debugEnabled && !force) {
        return {
            enabled: false,
            reason: 'TEGAKI_CONFIG.debug is false. Pass { force: true } for an explicit diagnostic call.'
        };
    }

    const { profile: snapshots, byId } = collectSnapshotProfile(model);
    const report = {
        enabled: true,
        collectedAt: new Date().toISOString(),
        canvas: {
            width: globalThis.TEGAKI_CONFIG?.canvas?.width || null,
            height: globalThis.TEGAKI_CONFIG?.canvas?.height || null
        },
        timeline: {
            totalFrames: model?.totalFrames || 0,
            tracks: model?.tracks?.length || 0,
            clipAssets: model?.clipAssets?.length || 0
        },
        snapshots,
        references: collectReferenceProfile(model, byId),
        clipRasterSnapshots: collectClipRasterSnapshotProfile(model),
        history: collectHistoryProfile(history),
        textureCache: animationTable?._getSnapshotTextureCacheProfile?.() || null,
        layerSystem: collectLayerSystemProfile(layerSystem),
        browser: await collectBrowserMemoryProfile({ includeUserAgentSpecificMemory })
    };
    report.estimatedBytes = summarizeEstimatedBytes(report);
    report.formatted = Object.fromEntries(
        Object.entries(report.estimatedBytes).map(([key, value]) => [key, formatBytesForCafMemoryProfile(value)])
    );
    return report;
}
