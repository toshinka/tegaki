/** WP-025 runtime-only source hiding. Canonical captures always restore pixels.
 * No layerData, Project, History, texture or user visibility is changed.
 */
const sources = new Map();
export function hideLetteringPreviewSource(layer, dirty = () => {}) {
    const sprite = layer?.layerData?.layerSprite;
    if (!sprite || sprite.destroyed) return false;
    if (!sources.has(layer)) sources.set(layer, { sprite, renderable: sprite.renderable, dirty });
    sprite.renderable = false; dirty(); return true;
}
export function restoreLetteringPreviewSource(layer) {
    const entry = sources.get(layer); if (!entry) return;
    sources.delete(layer);
    if (!entry.sprite.destroyed) entry.sprite.renderable = entry.renderable;
    entry.dirty();
}
/** Caller uses try/finally: reveal source pixels for a canonical capture only. */
export function revealLetteringSourcesForCapture() {
    const entries = [...sources];
    for (const [, entry] of entries) {
        if (!entry.sprite.destroyed) entry.sprite.renderable = entry.renderable;
        entry.dirty();
    }
    return () => {
        for (const [layer, entry] of entries) {
            if (sources.get(layer) === entry && !entry.sprite.destroyed) entry.sprite.renderable = false;
            entry.dirty();
        }
    };
}
