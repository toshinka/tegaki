/** ROLE: Display-only lasso paint preview from the same closed-shape geometry.
 * AUTHORITY: BrushCore owns its transient Graphics; no Raster or History writes.
 * INVARIANTS: Use recorded local points, current paint/width/join and Canvas color.
 * Opaque preview and final share the miter/round outline, including acute corners.
 */
import { normalizeClosedPoints, resolveClosedShapePaint, strokePolygonsForPoints } from '../closed-shape-paint.js';

const rgbNumber = rgb => (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];

export function renderLassoPaintPreview(graphics, points, options, colors, settings) {
    graphics.clear();
    graphics.alpha = Math.max(0, Math.min(1, Number(settings.opacity ?? 1)));
    const normalized = normalizeClosedPoints(points, { min: 2, max: Infinity, dedupe: false });
    if (!normalized.ok) return;
    const contour = normalized.points;
    const paint = resolveClosedShapePaint({ ...options, strokeColor: settings.color,
        outline: options.lassoOutline !== false }, colors, { legacyMode: 'same' });
    const widthValue = options.width ?? settings.size;
    const width = Number.isFinite(Number(widthValue)) && Number(widthValue) > 0 ? Number(widthValue) : 4;
    const polygon = (p, color) => {
        graphics.beginPath();
        graphics.poly(p.flatMap(point => [point.x, point.y]), true).fill({ color });
    };
    if (contour.length < 3) {
        graphics.moveTo(contour[0].x, contour[0].y).lineTo(contour[1].x, contour[1].y)
            .stroke({ width: 1.5, color: rgbNumber(paint.fillRgb || paint.strokeRgb), cap: 'butt', join: 'miter' });
        return;
    }
    if (paint.fillRgb) polygon(contour, rgbNumber(paint.fillRgb));
    if (paint.strokeRgb) {
        const stroke = strokePolygonsForPoints(contour, {
            width, join: options.join === 'round' ? 'round' : 'miter', maxPoints: Infinity, dedupe: false
        });
        // One opaque Graphics fill for the outline, rather than rounded guide strokes.
        graphics.beginPath();
        for (const p of stroke) {
            graphics.moveTo(p[0].x, p[0].y);
            p.slice(1).forEach(point => graphics.lineTo(point.x, point.y));
            graphics.closePath();
        }
        graphics.fill({ color: rgbNumber(paint.strokeRgb) });
    }
}
