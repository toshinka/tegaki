/** WP-025/WP-030 runtime-only source hiding/ghost. Canonical captures restore pixels and alpha.
 * No layerData, Project, History, texture or user visibility is changed.
 */
const sources = new Map();
let captureDepth = 0;
export function hideLetteringPreviewSource(layer, dirty = () => {}, preview = null, opacity = 0) {
    const sprite = layer?.layerData?.layerSprite;
    if (!sprite || sprite.destroyed) return false;
    if (!sources.has(layer)) sources.set(layer, { sprite, renderable: sprite.renderable, alpha: sprite.alpha ?? 1, dirty, preview });
    const entry = sources.get(layer);
    entry.opacity = Math.max(0, Math.min(1, opacity));
    sprite.renderable = captureDepth || entry.opacity > 0 ? entry.renderable : false;
    sprite.alpha = captureDepth ? entry.alpha : entry.alpha * (entry.opacity || 1);
    dirty(); return true;
}
/** Keep the previous manga shape on the same Canvas as a quiet placement reference. */
export function ghostMangaPreviewSource(layer, dirty = () => {}) {
    return hideLetteringPreviewSource(layer, dirty, null, 0.2);
}
export function restoreLetteringPreviewSource(layer) {
    const entry = sources.get(layer); if (!entry) return;
    sources.delete(layer);
    if (!entry.sprite.destroyed) { entry.sprite.renderable = entry.renderable; entry.sprite.alpha = entry.alpha; }
    entry.dirty();
}
/** Caller uses try/finally: reveal source pixels for a canonical capture only. */
export function revealLetteringSourcesForCapture() {
    captureDepth++;
    const entries = [...sources];
    for (const [, entry] of entries) {
        if (entry.preview && !entry.preview.destroyed) entry.preview.renderable = false;
        if (!entry.sprite.destroyed) { entry.sprite.renderable = entry.renderable; entry.sprite.alpha = entry.alpha; }
        entry.dirty();
    }
    return () => {
        if (--captureDepth > 0) return;
        for (const [layer, entry] of entries) {
            if (sources.get(layer) === entry && !entry.sprite.destroyed) {
                entry.sprite.renderable = entry.opacity > 0 ? entry.renderable : false;
                entry.sprite.alpha = entry.alpha * (entry.opacity || 1);
                if (entry.preview && !entry.preview.destroyed) entry.preview.renderable = true;
            }
            entry.dirty();
        }
    };
}
