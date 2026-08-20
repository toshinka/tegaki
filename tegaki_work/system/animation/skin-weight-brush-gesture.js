/** Fixed diagnostic頂点から一回のSkin Weight brush sampleを作るpure helper。 */

export function createSkinWeightBrushSample(vertices, options = {}) {
    const centerX = Number(options.center?.x);
    const centerY = Number(options.center?.y);
    const radius = Number(options.radius);
    const strength = Number(options.strength);
    const direction = options.direction === -1 ? -1 : 1;
    if (!Array.isArray(vertices)
        || !Number.isFinite(centerX)
        || !Number.isFinite(centerY)
        || !Number.isFinite(radius)
        || !(radius > 0)
        || !Number.isFinite(strength)
        || !(strength > 0)) return [];

    return vertices.flatMap(vertex => {
        if (typeof vertex?.vertexId !== 'string'
            || vertex.vertexId.length === 0
            || !Number.isFinite(vertex.screenX)
            || !Number.isFinite(vertex.screenY)) return [];
        const distance = Math.hypot(vertex.screenX - centerX, vertex.screenY - centerY);
        if (distance > radius) return [];
        const falloff = Math.max(0, 1 - distance / radius);
        const delta = direction * strength * falloff;
        return Math.abs(delta) > 1e-12 ? [{ vertexId: vertex.vertexId, delta }] : [];
    });
}

export function mergeSkinWeightBrushSamples(currentDeltas, sample) {
    const merged = new Map(currentDeltas instanceof Map ? currentDeltas : []);
    (Array.isArray(sample) ? sample : []).forEach(update => {
        if (typeof update?.vertexId !== 'string'
            || update.vertexId.length === 0
            || !Number.isFinite(update.delta)) return;
        merged.set(update.vertexId, (merged.get(update.vertexId) || 0) + update.delta);
    });
    return merged;
}
