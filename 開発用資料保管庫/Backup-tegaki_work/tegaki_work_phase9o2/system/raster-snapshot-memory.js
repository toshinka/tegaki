const SNAPSHOT_BASE_BYTES = 128;
const PATH_COLLECTION_BASE_BYTES = 32;
const PATH_ENTRY_BASE_BYTES = 256;
const POINT_ENTRY_BYTES = 64;
const ARRAY_SLOT_BYTES = 8;

function estimateStringBytes(value) {
    return typeof value === 'string' ? value.length * 2 : 0;
}

export function summarizePathCollectionMemory(collection) {
    const paths = Array.isArray(collection) ? collection : [];
    let pointCount = 0;
    let estimatedBytes = PATH_COLLECTION_BASE_BYTES + paths.length * ARRAY_SLOT_BYTES;

    for (const path of paths) {
        const points = Array.isArray(path?.points) ? path.points : [];
        pointCount += points.length;
        estimatedBytes += PATH_ENTRY_BASE_BYTES;
        estimatedBytes += points.length * (POINT_ENTRY_BYTES + ARRAY_SLOT_BYTES);
        estimatedBytes += estimateStringBytes(path?.id);
        estimatedBytes += estimateStringBytes(path?.tool);
    }

    return {
        pathCount: paths.length,
        pointCount,
        estimatedBytes
    };
}

export function summarizeRasterSnapshotMemory(snapshot) {
    if (!snapshot) {
        return {
            pixelBytes: 0,
            metadataBytes: 0,
            estimatedBytes: 0,
            pathsData: summarizePathCollectionMemory([]),
            paths: summarizePathCollectionMemory([])
        };
    }

    const pixelBytes = Number(snapshot.pixels?.byteLength) || 0;
    const pathsData = summarizePathCollectionMemory(snapshot.pathsData);
    const paths = summarizePathCollectionMemory(snapshot.paths);
    const metadataBytes = SNAPSHOT_BASE_BYTES
        + pathsData.estimatedBytes
        + paths.estimatedBytes;

    return {
        pixelBytes,
        metadataBytes,
        estimatedBytes: pixelBytes + metadataBytes,
        pathsData,
        paths
    };
}

export function estimateRasterHistoryPairBytes(beforeSnapshot, afterSnapshot) {
    const before = summarizeRasterSnapshotMemory(beforeSnapshot);
    const after = summarizeRasterSnapshotMemory(afterSnapshot);
    return {
        before,
        after,
        estimatedBytes: before.estimatedBytes + after.estimatedBytes
    };
}
