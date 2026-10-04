/**
 * ============================================================================
 * ファイル名: system/closed-shape-paint.js
 * 責務: 閉じた輪郭の線/内側色を確定時に一度だけCPU合成する共有部品
 * 依存: system/raster-bounds.js, system/raster-snapshot-memory.js
 * 被依存: system/shape-tool.js, system/polygon-shape-tool.js, system/drawing/fill-tool.js
 * 公開API: CLOSED_SHAPE_PAINTS, normalizePaintMode, normalizeHexColor,
 *          resolveClosedShapePaint, normalizeClosedPoints, closedShapeBounds,
 *          strokePolygonsForPoints, pointInPolygonEvenOdd, rasterizeClosedShape,
 *          blendClosedShapePixels, paintClosedShapeToLayer
 * 保存: UI設定は呼び出し側のAreaToolController。編集点は保存せず、確定結果だけ通常Rasterへ焼く。
 * 実装状態: ✅WP-030 閉領域線/内側色共有
 *
 * 線と内側を同じsource canvasへ合成してから不透明度を一回だけ適用する。
 * 途中previewはこのモジュールのlayer APIを呼ばず、live strokeへCanvas2Dを混ぜない。
 * ============================================================================
 */

import { normalizeRasterBounds } from './raster-bounds.js';
import { estimateRasterHistoryPairBytes } from './raster-snapshot-memory.js';

export const CLOSED_SHAPE_PAINTS = Object.freeze(['legacy', 'line', 'same', 'custom']);

const MAX_POINTS = 256;
const EPSILON = 1e-8;

function finitePoint(point) {
    return Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y));
}

function clampByte(value) {
    return Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
}

function cloneRgb(rgb, fallback = [0, 0, 0]) {
    if (Array.isArray(rgb) && rgb.length >= 3 && rgb.slice(0, 3).every(Number.isFinite)) {
        return rgb.slice(0, 3).map(clampByte);
    }
    return fallback.slice(0, 3).map(clampByte);
}

export function normalizePaintMode(value, fallback = 'legacy') {
    return CLOSED_SHAPE_PAINTS.includes(value) ? value : fallback;
}

/** `#rrggbb`だけを受け入れ、black (`#000000`) を有効値として保持する。 */
export function normalizeHexColor(value) {
    if (typeof value !== 'string') return null;
    const match = value.trim().match(/^#([0-9a-f]{6})$/i);
    return match ? `#${match[1].toLowerCase()}` : null;
}

export function hexToRgb(value, fallback = [0, 0, 0]) {
    const normalized = normalizeHexColor(value);
    if (!normalized) return cloneRgb(fallback);
    const n = Number.parseInt(normalized.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** number / #rrggbb / [r,g,b] をRGBへ変換する。 */
export function colorToRgb(value, fallback = [0, 0, 0]) {
    if (Array.isArray(value)) return cloneRgb(value, fallback);
    if (typeof value === 'string') return hexToRgb(value, fallback);
    if (Number.isFinite(Number(value))) {
        const n = Number(value) >>> 0;
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    return cloneRgb(fallback);
}

/**
 * legacyの既定はcallerごとに維持する。
 * rect/ellipseは line、手作りpolygonは same、lassoはGPU legacyをcallerが選ぶ。
 */
export function resolveClosedShapePaint(options = {}, colors = {}, { legacyMode = 'line' } = {}) {
    const requested = normalizePaintMode(options.paint, 'legacy');
    const mode = requested === 'legacy' ? normalizePaintMode(legacyMode, 'line') : requested;
    const strokeRgb = colorToRgb(options.strokeColor ?? colors.main, [128, 0, 0]);
    const backgroundRgb = colorToRgb(options.backgroundColor ?? colors.background, [0, 0, 0]);
    let fillRgb = null;
    if (mode === 'same') fillRgb = [...strokeRgb];
    if (mode === 'custom') {
        fillRgb = options.fillColor == null
            ? [...backgroundRgb]
            : colorToRgb(options.fillColor, backgroundRgb);
    }
    return {
        requested,
        mode,
        strokeRgb,
        fillRgb,
        fillColor: fillRgb ? `#${fillRgb.map(v => v.toString(16).padStart(2, '0')).join('')}` : null,
        followsBackground: mode === 'custom' && options.fillColor == null
    };
}

/** 有限点だけを採用し、既定では隣接重複を除去する。上限超過は拒否する。 */
export function normalizeClosedPoints(points, { min = 0, max = MAX_POINTS, dedupe = true } = {}) {
    if (!Array.isArray(points)) return { ok: false, reason: 'not-array', points: [] };
    const result = [];
    for (const point of points) {
        if (!finitePoint(point)) return { ok: false, reason: 'non-finite', points: [] };
        const next = { x: Number(point.x), y: Number(point.y) };
        const previous = result[result.length - 1];
        if (!dedupe || !previous || Math.hypot(next.x - previous.x, next.y - previous.y) > EPSILON) result.push(next);
    }
    if (result.length > max) return { ok: false, reason: 'max-points', points: [] };
    if (result.length < min) return { ok: false, reason: 'too-few-points', points: result };
    return { ok: true, points: result };
}

function allFinite(points) {
    return Array.isArray(points) && points.length > 0 && points.every(finitePoint);
}

export function closedShapeBounds(contours = [], strokePolygons = []) {
    const points = [];
    for (const contour of contours || []) if (allFinite(contour)) points.push(...contour);
    for (const polygon of strokePolygons || []) if (allFinite(polygon)) points.push(...polygon);
    if (!points.length) return null;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const point of points) {
        x0 = Math.min(x0, Number(point.x));
        y0 = Math.min(y0, Number(point.y));
        x1 = Math.max(x1, Number(point.x));
        y1 = Math.max(y1, Number(point.y));
    }
    return { x0, y0, x1, y1 };
}

function signedArea(points) {
    let area = 0;
    for (let i = 0; i < points.length; i += 1) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        area += a.x * b.y - b.x * a.y;
    }
    return area / 2;
}

function positivePolygon(points) {
    return signedArea(points) < 0 ? points.slice().reverse() : points.slice();
}

/** 任意の閉じた点列を、shape-geometryと同じ線polygon群へ変換する。 */
export function strokePolygonsForPoints(points, {
    width = 4,
    join = 'miter',
    maxPoints = MAX_POINTS,
    dedupe = true
} = {}) {
    const normalized = normalizeClosedPoints(points, { min: 3, max: maxPoints, dedupe });
    if (!normalized.ok) return [];
    const contour = normalized.points;
    const half = Math.max(0.5, Number(width) || 4) / 2;
    const polygons = [];
    const normals = [];
    for (let i = 0; i < contour.length; i += 1) {
        const a = contour[i];
        const b = contour[(i + 1) % contour.length];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const length = Math.hypot(dx, dy) || 1;
        const normal = { x: -dy / length, y: dx / length };
        normals.push(normal);
        polygons.push(positivePolygon([
            { x: a.x + normal.x * half, y: a.y + normal.y * half },
            { x: b.x + normal.x * half, y: b.y + normal.y * half },
            { x: b.x - normal.x * half, y: b.y - normal.y * half },
            { x: a.x - normal.x * half, y: a.y - normal.y * half }
        ]));
    }
    for (let i = 0; i < contour.length; i += 1) {
        const vertex = contour[i];
        if (join === 'round') {
            const circle = [];
            for (let k = 0; k < 20; k += 1) {
                const angle = (k / 20) * Math.PI * 2;
                circle.push({ x: vertex.x + Math.cos(angle) * half, y: vertex.y + Math.sin(angle) * half });
            }
            polygons.push(positivePolygon(circle));
            continue;
        }
        const previous = normals[(i + contour.length - 1) % contour.length];
        const next = normals[i];
        const dot = previous.x * next.x + previous.y * next.y;
        const denominator = 1 + dot;
        if (denominator <= EPSILON) continue;
        const scale = 1 / denominator;
        for (const sign of [1, -1]) {
            const p1 = { x: vertex.x + previous.x * half * sign, y: vertex.y + previous.y * half * sign };
            const p2 = { x: vertex.x + next.x * half * sign, y: vertex.y + next.y * half * sign };
            const tip = {
                x: vertex.x + (previous.x + next.x) * scale * half * sign,
                y: vertex.y + (previous.y + next.y) * scale * half * sign
            };
            if (Math.hypot(tip.x - vertex.x, tip.y - vertex.y) <= half * 10) {
                polygons.push(positivePolygon([vertex, p1, tip, p2]));
            } else {
                polygons.push(positivePolygon([vertex, p1, p2]));
            }
        }
    }
    return polygons;
}

export function pointInPolygonEvenOdd(point, polygon) {
    if (!finitePoint(point) || !allFinite(polygon) || polygon.length < 3) return false;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
        const a = polygon[i];
        const b = polygon[j];
        if ((a.y > point.y) !== (b.y > point.y)
            && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
}

function appendPath(ctx, polygons, region) {
    for (const polygon of polygons || []) {
        if (!allFinite(polygon) || polygon.length < 3) continue;
        polygon.forEach((point, index) => {
            const x = point.x - region.x;
            const y = point.y - region.y;
            if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath();
    }
}

/** 最終確定用のsource画素。fill→lineを同一canvasへ合成してから返す。 */
export function rasterizeClosedShape({ region, contours = [], strokePolygons = [], paint }) {
    if (!region || !(region.width > 0 && region.height > 0) || typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(region.width));
    canvas.height = Math.max(1, Math.ceil(region.height));
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (paint?.fillRgb && contours.length) {
        context.fillStyle = `rgb(${paint.fillRgb.join(',')})`;
        context.beginPath();
        appendPath(context, contours, region);
        context.fill('evenodd');
    }
    if (paint?.strokeRgb && strokePolygons.length) {
        context.fillStyle = `rgb(${paint.strokeRgb.join(',')})`;
        context.beginPath();
        appendPath(context, strokePolygons, region);
        context.fill('nonzero');
    }
    return context.getImageData(0, 0, canvas.width, canvas.height).data;
}

function selectionAllows(selection, projectX, projectY) {
    if (!selection) return true;
    const bounds = selection.bounds;
    if (!bounds || projectX < bounds.x || projectY < bounds.y
        || projectX >= bounds.x + bounds.width || projectY >= bounds.y + bounds.height) return false;
    if (!selection.mask) return true;
    const x = projectX - Math.floor(bounds.x);
    const y = projectY - Math.floor(bounds.y);
    const width = Math.max(0, Math.ceil(bounds.width));
    return selection.mask[y * width + x] === 1;
}

/** source alphaへopacityを一回だけ適用し、既存RGBAへstraight-alpha合成する。 */
export function blendClosedShapePixels(target, source, region, opacity = 1, selection = null) {
    if (!target?.pixels || !source || !region) return 0;
    const alphaScale = Math.max(0, Math.min(1, Number(opacity))); 
    const rasterBounds = normalizeRasterBounds(target.rasterBounds, {
        width: target.width,
        height: target.height
    });
    let changed = 0;
    for (let y = 0; y < region.height; y += 1) {
        const projectY = region.y + y;
        for (let x = 0; x < region.width; x += 1) {
            const sourceIndex = (y * region.width + x) * 4;
            const sourceAlpha = (source[sourceIndex + 3] / 255) * alphaScale;
            if (sourceAlpha <= 0) continue;
            const projectX = region.x + x;
            if (!selectionAllows(selection, projectX, projectY)) continue;
            const targetX = projectX - rasterBounds.x;
            const targetY = projectY - rasterBounds.y;
            if (targetX < 0 || targetY < 0 || targetX >= target.width || targetY >= target.height) continue;
            const targetIndex = (targetY * target.width + targetX) * 4;
            const targetAlpha = target.pixels[targetIndex + 3] / 255;
            const outputAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);
            if (outputAlpha <= 0) continue;
            const next = [
                Math.round((source[sourceIndex] * sourceAlpha + target.pixels[targetIndex] * targetAlpha * (1 - sourceAlpha)) / outputAlpha),
                Math.round((source[sourceIndex + 1] * sourceAlpha + target.pixels[targetIndex + 1] * targetAlpha * (1 - sourceAlpha)) / outputAlpha),
                Math.round((source[sourceIndex + 2] * sourceAlpha + target.pixels[targetIndex + 2] * targetAlpha * (1 - sourceAlpha)) / outputAlpha),
                Math.round(outputAlpha * 255)
            ];
            for (let channel = 0; channel < 4; channel += 1) {
                if (target.pixels[targetIndex + channel] !== next[channel]) changed += 1;
                target.pixels[targetIndex + channel] = next[channel];
            }
        }
    }
    return changed;
}

function cloneSnapshot(snapshot) {
    return {
        ...snapshot,
        pixels: new Uint8ClampedArray(snapshot.pixels),
        paths: [],
        pathsData: []
    };
}

function resolveFrame(layerSystem, layer, before) {
    const canvas = layerSystem?.config?.canvas || (typeof window !== 'undefined' ? window.TEGAKI_CONFIG?.canvas : null) || {};
    const width = Math.max(1, Math.round(Number(canvas.width) || before.width || layer?.layerData?.renderTexture?.width || 1));
    const height = Math.max(1, Math.round(Number(canvas.height) || before.height || layer?.layerData?.renderTexture?.height || 1));
    return { width, height };
}

/** 図形/多角形/明示paint付き投げ縄の共有確定端末。 */
export function paintClosedShapeToLayer({
    system,
    layerSystem,
    layer,
    contours,
    strokePolygons,
    paint,
    opacity = 1,
    selection,
    beforeSnapshot: suppliedBeforeSnapshot,
    source = 'shape-line',
    historyName = 'shape-line',
    meta = {}
} = {}) {
    const layerData = layer?.layerData;
    if (!layerData?.renderTexture || layerData.isAnimationWorkingLayer === true) return { ok: false, reason: 'unsupported-layer' };
    const bounds = closedShapeBounds(contours, strokePolygons);
    if (!bounds) return { ok: false, reason: 'empty-shape' };
    const before = suppliedBeforeSnapshot || layerSystem?.createLayerRasterSnapshot?.(layer);
    if (!before?.pixels) return { ok: false, reason: 'no-before-snapshot' };
    const frame = resolveFrame(layerSystem, layer, before);
    const raw = {
        x: Math.floor(bounds.x0) - 2,
        y: Math.floor(bounds.y0) - 2,
        width: Math.ceil(bounds.x1 - bounds.x0) + 4,
        height: Math.ceil(bounds.y1 - bounds.y0) + 4
    };
    const region = {
        x: Math.max(0, raw.x),
        y: Math.max(0, raw.y),
        width: Math.min(frame.width, raw.x + raw.width) - Math.max(0, raw.x),
        height: Math.min(frame.height, raw.y + raw.height) - Math.max(0, raw.y)
    };
    if (!(region.width > 0 && region.height > 0)) return { ok: false, reason: 'outside-canvas' };
    // Canvas2Dのsource生成が失敗しても、先にレイヤー範囲だけを広げて残さない。
    const sourcePixels = rasterizeClosedShape({ region, contours, strokePolygons, paint });
    if (!sourcePixels) return { ok: false, reason: 'raster-unavailable' };

    // beforeはbounds拡張前に保持する。undo時にblank expansionまで巻き戻す。
    const expanded = layerSystem.ensureLayerRasterBoundsForRect?.(layer, region, { padding: 0 });
    if (expanded?.ok === false) return { ok: false, reason: 'bounds-limit' };
    const rollbackExpansion = () => {
        const restored = layerSystem.restoreLayerRasterSnapshot?.(before);
        if (restored) {
            layerSystem.refreshClippingMasks?.();
            system?.eventBus?.emit('layer:content-changed', { layerId: layerData.id, source });
        }
        return restored;
    };
    const current = layerSystem.createLayerRasterSnapshot?.(layer);
    if (!current?.pixels) {
        rollbackExpansion();
        return { ok: false, reason: 'no-after-snapshot' };
    }
    const after = cloneSnapshot(current);
    const selected = selection === undefined
        ? (system?.hasSelection?.() && system.state?.layerId === layerData.id && system.state.scope?.kind !== 'folder'
            ? { bounds: { ...system.state.bounds }, mask: system.state.mask || null }
            : null)
        : selection;
    const changed = blendClosedShapePixels(after, sourcePixels, region, opacity, selected);
    if (changed === 0) {
        rollbackExpansion();
        return { ok: false, reason: 'empty-selection', before, after, region };
    }
    if (!layerSystem.restoreLayerRasterSnapshot(after)) {
        rollbackExpansion();
        return { ok: false, reason: 'restore-failed', before, after, region };
    }

    const layerId = layerData.id;
    const history = system?.history;
    const eventBus = system?.eventBus;
    const retainedMemory = estimateRasterHistoryPairBytes(before, after);
    const restore = snapshot => {
        const restored = layerSystem.restoreLayerRasterSnapshot(snapshot);
        if (restored) {
            layerSystem.refreshClippingMasks?.();
            eventBus?.emit('layer:content-changed', { layerId, source });
        }
        return restored;
    };
    history?.record?.({
        name: historyName,
        do: () => restore(after),
        undo: () => restore(before),
        byteSize: retainedMemory.estimatedBytes,
        meta: { type: historyName, layerId, source, ...meta, retainedMemory }
    });
    layerSystem.refreshClippingMasks?.();
    eventBus?.emit('layer:content-changed', { layerId, source });
    return { ok: true, changed, before, after, region, retainedMemory };
}

