const RGBA_BYTES_PER_PIXEL = 4;
const DEFAULT_SNAPSHOT_METADATA_BYTES = 256;
const DEFAULT_EXPORT_EXPANSION_FACTOR = 8;
const MAX_BYTES = Number.MAX_SAFE_INTEGER;

function normalizeCount(value, fallback = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(0, Math.round(number));
}

function normalizeBytes(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return 0;
    return Math.min(MAX_BYTES, Math.round(number));
}

function addBytes(...values) {
    let total = 0;
    for (const value of values) {
        const bytes = normalizeBytes(value);
        if (total > MAX_BYTES - bytes) return MAX_BYTES;
        total += bytes;
    }
    return total;
}

function multiplyBytes(value, multiplier) {
    const bytes = normalizeBytes(value);
    const count = normalizeCount(multiplier);
    if (bytes === 0 || count === 0) return 0;
    if (bytes > MAX_BYTES / count) return MAX_BYTES;
    return bytes * count;
}

export function estimateBakeLayerRasterBytes(layer) {
    if (!layer || layer.type === 'folder') return 0;
    const explicit = normalizeBytes(layer.pixelBytes ?? layer.bytes);
    if (explicit > 0) return explicit;
    const width = normalizeCount(layer.width ?? layer.rasterBounds?.width);
    const height = normalizeCount(layer.height ?? layer.rasterBounds?.height);
    return multiplyBytes(multiplyBytes(width, height), RGBA_BYTES_PER_PIXEL);
}

/**
 * Layer構造保持Bakeの二つのpeakを保守的に見積もる。
 *
 * generationPeakBytes:
 *   全出力Snapshotをtransaction commitまで保持しつつ、現在Frameの
 *   render surface / readback等のworking copyを持つpeak。
 * checkpointPeakBytes:
 *   commit後に緊急復旧exportが走り、DrawingSnapshot.serialize()が
 *   RGBA typed arrayを通常配列へ展開するpeak。expansionFactorは実測で
 *   校正するための係数で、厳密なJS heap値ではない。
 */
export function estimateStructuredBakeCapacity(options = {}) {
    const frameCount = Math.max(1, normalizeCount(options.frameCount, 1));
    const layers = Array.isArray(options.layers) ? options.layers : [];
    const layerPixelBytes = layers
        .map(estimateBakeLayerRasterBytes)
        .filter(bytes => bytes > 0);
    const rasterLayerCount = layerPixelBytes.length;
    const perFramePixelBytes = layerPixelBytes.reduce((total, bytes) => addBytes(total, bytes), 0);
    const outputPixelBytes = multiplyBytes(perFramePixelBytes, frameCount);
    const outputSnapshotCount = multiplyBytes(rasterLayerCount, frameCount);
    const snapshotMetadataBytes = multiplyBytes(
        outputSnapshotCount,
        normalizeBytes(options.snapshotMetadataBytes || DEFAULT_SNAPSHOT_METADATA_BYTES)
    );

    const existingSnapshotBytes = normalizeBytes(options.existingSnapshotBytes);
    const existingHistoryBytes = normalizeBytes(options.existingHistoryBytes);
    const previewTextureBytes = normalizeBytes(options.previewTextureBytes);
    const otherResidentBytes = normalizeBytes(options.otherResidentBytes);
    const residentBeforeBytes = addBytes(
        existingSnapshotBytes,
        existingHistoryBytes,
        previewTextureBytes,
        otherResidentBytes
    );

    const workingCopyCount = Math.max(1, normalizeCount(options.workingCopyCount, 2));
    const generationWorkingBytes = multiplyBytes(perFramePixelBytes, workingCopyCount);
    const generationPeakBytes = addBytes(
        residentBeforeBytes,
        outputPixelBytes,
        snapshotMetadataBytes,
        generationWorkingBytes
    );

    const exportExpansionFactor = Math.max(
        1,
        normalizeCount(options.exportExpansionFactor, DEFAULT_EXPORT_EXPANSION_FACTOR)
    );
    const exportedSnapshotRawBytes = addBytes(existingSnapshotBytes, outputPixelBytes);
    const exportIntermediateBytes = multiplyBytes(exportedSnapshotRawBytes, exportExpansionFactor);
    const checkpointPeakBytes = addBytes(
        residentBeforeBytes,
        outputPixelBytes,
        snapshotMetadataBytes,
        exportIntermediateBytes
    );
    const peakBytes = Math.max(generationPeakBytes, checkpointPeakBytes);
    const memoryBudgetBytes = normalizeBytes(options.memoryBudgetBytes);

    return {
        frameCount,
        rasterLayerCount,
        outputSnapshotCount,
        perFramePixelBytes,
        outputPixelBytes,
        snapshotMetadataBytes,
        residentBeforeBytes,
        generationWorkingBytes,
        generationPeakBytes,
        exportExpansionFactor,
        exportIntermediateBytes,
        checkpointPeakBytes,
        peakBytes,
        memoryBudgetBytes,
        fitsBudget: memoryBudgetBytes > 0 ? peakBytes <= memoryBudgetBytes : null,
        overflowed: peakBytes >= MAX_BYTES
    };
}

