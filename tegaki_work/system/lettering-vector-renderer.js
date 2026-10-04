/**
 * ============================================================================
 * ファイル名: system/lettering-vector-renderer.js
 * 責務: HarfBuzz glyph outlineを文字localへ配置し、baseline/envelope/placementを
 *       同じ評価器でSVG previewと最終RGBA画素へ反映する。local原点は変形後も固定し、
 *       browser確定画素は変形済みvectorを文書worldの1x viewportへ直接焼く。
 * 依存: lettering-font-engine, editable-curve-geometry, lettering-raster
 * 被依存: lettering UI / Project adapter (rendererは保存・Historyを所有しない)
 * 公開API: renderLettering
 * 契約: SVG/paths/localBoundsはplacement前のlocal文字。pixels/rasterBoundsは
 *       placementを焼き込んだ文書1x画素。previewOnlyはpixelsを生成しない。
 *       最大16MP/8192px。OS fontは曲線/warpを拒否し、既存browser paragraph
 *       rasterizerへ明示的に委譲する。
 * ============================================================================
 */

import { buildLetteringHtml, measureLettering, rasterizeLettering } from './lettering-raster.js';
import { isFontAvailable } from './font-library.js';
import { curveLengthTable, curvePointAtDistance, letteringLocalToWorld, mapEnvelopePoint } from './editable-curve-geometry.js';
import { parseSvgPath, shapeLettering } from './lettering-font-engine.js';

export const LETTERING_VECTOR_LIMITS = Object.freeze({
    maxPixels: 16 * 1024 * 1024,
    maxDimension: 8192,
    flattenTolerance: 0.2
});

const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const GENERIC_SYSTEM_FAMILIES = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded']);

function fail(reason, detail = '') {
    return { ok: false, reason: detail ? `${reason}: ${detail}` : reason };
}

function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max, fallback) {
    const number = finite(value, fallback);
    return Math.min(max, Math.max(min, number));
}

function color(value, fallback) {
    return typeof value === 'string' && COLOR_PATTERN.test(value) ? value.toLowerCase() : fallback;
}

function escapeAttribute(value) {
    return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function placementValue(raw) {
    const scaleX = finite(raw?.scaleX, 1);
    const scaleY = finite(raw?.scaleY, 1);
    if (Math.abs(scaleX) < 0.01 || Math.abs(scaleY) < 0.01) return null;
    return {
        x: finite(raw?.x),
        y: finite(raw?.y),
        rotation: finite(raw?.rotation),
        scaleX,
        scaleY
    };
}

function samePoint(a, b, epsilon = 1e-7) {
    return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon;
}

function pushPoint(points, point) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    const previous = points[points.length - 1];
    if (!previous || !samePoint(previous, point)) points.push({ x: point.x, y: point.y });
}

function pointLineDistance(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length <= 1e-9) return Math.hypot(point.x - start.x, point.y - start.y);
    return Math.abs((point.x - start.x) * dy - (point.y - start.y) * dx) / length;
}

function flattenQuadratic(points, p0, p1, p2, tolerance, depth = 0) {
    if (depth >= 12 || pointLineDistance(p1, p0, p2) <= tolerance) {
        pushPoint(points, p2);
        return;
    }
    const p01 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    const p12 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const mid = { x: (p01.x + p12.x) / 2, y: (p01.y + p12.y) / 2 };
    flattenQuadratic(points, p0, p01, mid, tolerance, depth + 1);
    flattenQuadratic(points, mid, p12, p2, tolerance, depth + 1);
}

function flattenCubic(points, p0, p1, p2, p3, tolerance, depth = 0) {
    if (depth >= 14 && pointLineDistance(p1, p0, p3) <= tolerance && pointLineDistance(p2, p0, p3) <= tolerance) {
        pushPoint(points, p3);
        return;
    }
    if (depth < 14 && Math.max(pointLineDistance(p1, p0, p3), pointLineDistance(p2, p0, p3)) > tolerance) {
        const p01 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
        const p12 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        const p23 = { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 };
        const p012 = { x: (p01.x + p12.x) / 2, y: (p01.y + p12.y) / 2 };
        const p123 = { x: (p12.x + p23.x) / 2, y: (p12.y + p23.y) / 2 };
        const mid = { x: (p012.x + p123.x) / 2, y: (p012.y + p123.y) / 2 };
        flattenCubic(points, p0, p01, p012, mid, tolerance, depth + 1);
        flattenCubic(points, mid, p123, p23, p3, tolerance, depth + 1);
        return;
    }
    pushPoint(points, p3);
}

/** Convert HarfBuzz M/L/Q/C/Z paths to adaptive polygonal subpaths. */
function flattenPath(path, tolerance = LETTERING_VECTOR_LIMITS.flattenTolerance) {
    const commands = parseSvgPath(path);
    const subpaths = [];
    let current = { x: 0, y: 0 };
    let start = { x: 0, y: 0 };
    let active = null;
    const ensure = () => {
        if (!active) {
            active = { points: [], closed: false };
            subpaths.push(active);
        }
        return active;
    };
    for (const command of commands) {
        const type = command.type.toUpperCase();
        const values = command.values;
        if (type === 'M') {
            for (let index = 0; index + 1 < values.length; index += 2) {
                const point = { x: values[index], y: values[index + 1] };
                if (index === 0 || !active) {
                    active = { points: [], closed: false };
                    subpaths.push(active);
                    start = point;
                } else {
                    pushPoint(active.points, point);
                }
                current = point;
                pushPoint(active.points, point);
            }
        } else if (type === 'L') {
            const target = ensure();
            for (let index = 0; index + 1 < values.length; index += 2) {
                const point = { x: values[index], y: values[index + 1] };
                pushPoint(target.points, point);
                current = point;
            }
        } else if (type === 'Q') {
            const target = ensure();
            for (let index = 0; index + 3 < values.length; index += 4) {
                const control = { x: values[index], y: values[index + 1] };
                const end = { x: values[index + 2], y: values[index + 3] };
                flattenQuadratic(target.points, current, control, end, tolerance);
                current = end;
            }
        } else if (type === 'C') {
            const target = ensure();
            for (let index = 0; index + 5 < values.length; index += 6) {
                const control1 = { x: values[index], y: values[index + 1] };
                const control2 = { x: values[index + 2], y: values[index + 3] };
                const end = { x: values[index + 4], y: values[index + 5] };
                flattenCubic(target.points, current, control1, control2, end, tolerance);
                current = end;
            }
        } else if (type === 'Z') {
            const target = ensure();
            target.closed = true;
            pushPoint(target.points, start);
            current = start;
        }
    }
    return subpaths.filter(subpath => subpath.points.length >= 2);
}

function unionBounds(bounds, point) {
    if (!point) return bounds;
    if (!bounds) return { x: point.x, y: point.y, width: 0, height: 0 };
    const minX = Math.min(bounds.x, point.x);
    const minY = Math.min(bounds.y, point.y);
    const maxX = Math.max(bounds.x + bounds.width, point.x);
    const maxY = Math.max(bounds.y + bounds.height, point.y);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function boundsOfSubpaths(subpaths) {
    let bounds = null;
    for (const subpath of subpaths) {
        for (const point of subpath.points) bounds = unionBounds(bounds, point);
    }
    return bounds;
}

function mapPointSafely(map, point) {
    const mapped = map(point);
    if (!mapped || !Number.isFinite(mapped.x) || !Number.isFinite(mapped.y)) return null;
    return { x: mapped.x, y: mapped.y };
}

function placementBounds(localBounds, placement) {
    const corners = [
        { x: localBounds.x, y: localBounds.y },
        { x: localBounds.x + localBounds.width, y: localBounds.y },
        { x: localBounds.x + localBounds.width, y: localBounds.y + localBounds.height },
        { x: localBounds.x, y: localBounds.y + localBounds.height }
    ].map(point => letteringLocalToWorld(point, placement));
    let bounds = null;
    for (const point of corners) bounds = unionBounds(bounds, point);
    return bounds || { x: placement.x, y: placement.y, width: 0, height: 0 };
}

function integerRasterBounds(bounds) {
    const source = bounds || { x: 0, y: 0, width: 1, height: 1 };
    const x0 = Math.floor(finite(source.x));
    const y0 = Math.floor(finite(source.y));
    const x1 = Math.ceil(finite(source.x) + Math.max(0, finite(source.width)));
    const y1 = Math.ceil(finite(source.y) + Math.max(0, finite(source.height)));
    return { x: x0, y: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) };
}

function transformedRasterBounds(localBounds, placement) {
    return integerRasterBounds(placementBounds(localBounds, placement));
}

function rasterBudgetFailure(bounds, label = '文字画素') {
    const width = Math.max(1, Math.ceil(Math.max(0, finite(bounds?.width))));
    const height = Math.max(1, Math.ceil(Math.max(0, finite(bounds?.height))));
    if (width > LETTERING_VECTOR_LIMITS.maxDimension || height > LETTERING_VECTOR_LIMITS.maxDimension
        || width * height > LETTERING_VECTOR_LIMITS.maxPixels) {
        return fail('render-too-large', `${label}の上限を超えました`);
    }
    return null;
}

function pathToSvg(subpaths) {
    return subpaths.map(subpath => {
        const points = subpath.points;
        if (!points.length) return '';
        const body = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${Number(point.x.toFixed(4))},${Number(point.y.toFixed(4))}`).join('');
        return body + (subpath.closed ? 'Z' : '');
    }).join('');
}

function makeSvg(paths, localBounds, params) {
    const width = Math.max(1, Math.ceil(localBounds.width));
    const height = Math.max(1, Math.ceil(localBounds.height));
    const fill = color(params.color, '#800000');
    const stroke = color(params.strokeColor, '#ffffee');
    const strokeWidth = clamp(params.strokeWidth, 0, 64, 0);
    const outerWidth = clamp(params.outerStrokeWidth, 0, 64, 0);
    let body;
    if (outerWidth > 0 || params.characterStyles?.length) {
        const strokePass = (strokeColor, width) => width > 0 ? paths.map(path => `<path d="${escapeAttribute(path.d)}" fill="none" stroke="${strokeColor}" stroke-width="${width}" stroke-linejoin="round"/>`).join('') : '';
        body = (outerWidth > 0 ? strokePass(color(params.outerStrokeColor, '#800000'), strokeWidth + outerWidth * 2) : '')
            + strokePass(stroke, strokeWidth)
            + paths.map(path => `<path d="${escapeAttribute(path.d)}" fill="${color(path.fill, fill)}" fill-rule="nonzero"/>`).join('');
    } else {
        // Keep existing SVG/paint ordering for unchanged version-1 recipes.
        body = paths.map(path => `<path d="${escapeAttribute(path.d)}" fill="${fill}" fill-rule="nonzero"${strokeWidth > 0 ? ` stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" paint-order="stroke fill"` : ''}/>`).join('');
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${Number(localBounds.x.toFixed(4))} ${Number(localBounds.y.toFixed(4))} ${width} ${height}">${body}</svg>`;
}

function parseHex(value) {
    const safe = color(value, '#000000').slice(1);
    return [parseInt(safe.slice(0, 2), 16), parseInt(safe.slice(2, 4), 16), parseInt(safe.slice(4, 6), 16)];
}

function sampleWinding(point, subpath) {
    const points = subpath.points;
    let winding = 0;
    for (let index = 0; index < points.length; index += 1) {
        const first = points[index];
        const second = points[(index + 1) % points.length];
        if (first.y <= point.y) {
            if (second.y > point.y && (second.x - first.x) * (point.y - first.y) - (point.x - first.x) * (second.y - first.y) > 0) winding += 1;
        } else if (second.y <= point.y && (second.x - first.x) * (point.y - first.y) - (point.x - first.x) * (second.y - first.y) < 0) {
            winding -= 1;
        }
    }
    return winding;
}

function segmentDistance(point, first, second) {
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared <= 1e-9) return Math.hypot(point.x - first.x, point.y - first.y);
    const ratio = Math.max(0, Math.min(1, ((point.x - first.x) * dx + (point.y - first.y) * dy) / lengthSquared));
    return Math.hypot(point.x - (first.x + ratio * dx), point.y - (first.y + ratio * dy));
}

function pointInSubpaths(point, subpaths, strokeWidth) {
    let winding = 0;
    let stroke = false;
    for (const subpath of subpaths) {
        if (subpath.points.length < 2) continue;
        winding += sampleWinding(point, subpath);
        if (strokeWidth > 0) {
            for (let index = 0; index < subpath.points.length - 1; index += 1) {
                if (segmentDistance(point, subpath.points[index], subpath.points[index + 1]) <= strokeWidth / 2) {
                    stroke = true;
                    break;
                }
            }
            if (subpath.closed && !stroke) {
                if (segmentDistance(point, subpath.points[subpath.points.length - 1], subpath.points[0]) <= strokeWidth / 2) stroke = true;
            }
        }
    }
    return { fill: winding !== 0, stroke };
}

function rasterizePolygons(paths, localBounds, params) {
    if (finite(params.outerStrokeWidth) > 0 || params.characterStyles?.length) return rasterizeStyledPolygons(paths, localBounds, params);
    const budget = rasterBudgetFailure(localBounds, '文字local画素');
    if (budget) return budget;
    const width = Math.max(1, Math.ceil(Math.max(0, finite(localBounds.width))));
    const height = Math.max(1, Math.ceil(Math.max(0, finite(localBounds.height))));
    const pixels = new Uint8ClampedArray(width * height * 4);
    const fillColor = parseHex(params.color);
    const strokeColor = parseHex(params.strokeColor);
    const strokeWidth = clamp(params.strokeWidth, 0, 64, 0);
    const subpaths = paths.flatMap(path => path.subpaths);
    const minX = localBounds.x;
    const minY = localBounds.y;
    const samples = [0.25, 0.75];
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            let fillHits = 0;
            let strokeHits = 0;
            for (const sy of samples) {
                for (const sx of samples) {
                    const state = pointInSubpaths({ x: minX + x + sx, y: minY + y + sy }, subpaths, strokeWidth);
                    fillHits += Number(state.fill);
                    strokeHits += Number(state.stroke);
                }
            }
            const offset = (y * width + x) * 4;
            const fillAlpha = fillHits / 4;
            const strokeAlpha = strokeHits / 4;
            const alpha = Math.max(fillAlpha, strokeAlpha);
            if (alpha <= 0) continue;
            const source = strokeAlpha >= fillAlpha ? strokeColor : fillColor;
            pixels[offset] = source[0];
            pixels[offset + 1] = source[1];
            pixels[offset + 2] = source[2];
            pixels[offset + 3] = Math.round(alpha * 255);
        }
    }
    return { width, height, pixels };
}

/** Same whole-text outer/inner/fill passes as SVG, sampled in premultiplied RGBA. */
function rasterizeStyledPolygons(paths, localBounds, params) {
    const budget = rasterBudgetFailure(localBounds, '文字local画素');
    if (budget) return budget;
    const width = Math.max(1, Math.ceil(localBounds.width)), height = Math.max(1, Math.ceil(localBounds.height));
    const pixels = new Uint8ClampedArray(width * height * 4);
    const innerWidth = clamp(params.strokeWidth, 0, 64, 0), added = clamp(params.outerStrokeWidth, 0, 64, 0);
    const outerWidth = added > 0 ? innerWidth + added * 2 : 0;
    const innerColor = parseHex(params.strokeColor), outerColor = parseHex(params.outerStrokeColor);
    const prepared = paths.map(path => ({ ...path, rgb: parseHex(path.fill || params.color), bounds: boundsOfSubpaths(path.subpaths) }));
    const radius = Math.max(innerWidth, outerWidth) / 2;
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
        let hits = 0; const rgb = [0, 0, 0];
        for (const sy of [0.25, 0.75]) for (const sx of [0.25, 0.75]) {
            const point = { x: localBounds.x + x + sx, y: localBounds.y + y + sy };
            let outer = false, inner = false, fill = null;
            for (const path of prepared) {
                const box = path.bounds;
                if (box && (point.x < box.x - radius || point.x > box.x + box.width + radius || point.y < box.y - radius || point.y > box.y + box.height + radius)) continue;
                const state = pointInSubpaths(point, path.subpaths, Math.max(innerWidth, outerWidth));
                if (state.stroke && outerWidth > 0) outer = true;
                if (innerWidth > 0 && (outerWidth <= innerWidth ? state.stroke : pointInSubpaths(point, path.subpaths, innerWidth).stroke)) inner = true;
                if (state.fill) fill = path.rgb;
            }
            const source = fill || (inner ? innerColor : outer ? outerColor : null);
            if (source) { hits += 1; for (let c = 0; c < 3; c += 1) rgb[c] += source[c]; }
        }
        if (!hits) continue;
        const offset = (y * width + x) * 4;
        for (let c = 0; c < 3; c += 1) pixels[offset + c] = Math.round(rgb[c] / hits);
        pixels[offset + 3] = Math.round(hits * 255 / 4);
    }
    return { width, height, pixels };
}

function transformedPixelBounds(width, height, placement, localBounds = null) {
    const sourceBounds = localBounds || { x: -width / 2, y: -height / 2, width, height };
    return placementBounds(sourceBounds, placement);
}

function resamplePlacement(source, placement, localBounds = null) {
    const sourceWidth = source.width;
    const sourceHeight = source.height;
    const sourceBounds = localBounds || source.localBounds || { x: -sourceWidth / 2, y: -sourceHeight / 2, width: sourceWidth, height: sourceHeight };
    const bounds = transformedRasterBounds(sourceBounds, placement);
    const budget = rasterBudgetFailure(bounds, '配置後の文字画素');
    if (budget) return budget;
    const { x: x0, y: y0, width, height } = bounds;
    const pixels = new Uint8ClampedArray(width * height * 4);
    const cos = Math.cos(placement.rotation);
    const sin = Math.sin(placement.rotation);
    const sxScale = placement.scaleX;
    const syScale = placement.scaleY;
    const sample = (x, y, channel) => {
        const ix = Math.max(0, Math.min(sourceWidth - 1, Math.floor(x)));
        const iy = Math.max(0, Math.min(sourceHeight - 1, Math.floor(y)));
        return source.pixels[(iy * sourceWidth + ix) * 4 + channel];
    };
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const worldX = x0 + x + 0.5;
            const worldY = y0 + y + 0.5;
            const dx = worldX - placement.x;
            const dy = worldY - placement.y;
            const localX = (cos * dx + sin * dy) / sxScale;
            const localY = (-sin * dx + cos * dy) / syScale;
            if (localX < sourceBounds.x - 1 || localX > sourceBounds.x + sourceBounds.width
                || localY < sourceBounds.y - 1 || localY > sourceBounds.y + sourceBounds.height) continue;
            const sourceX = localX - sourceBounds.x;
            const sourceY = localY - sourceBounds.y;
            const offset = (y * width + x) * 4;
            for (let channel = 0; channel < 4; channel += 1) pixels[offset + channel] = sample(sourceX, sourceY, channel);
        }
    }
    return { width, height, pixels, rasterBounds: { x: x0, y: y0, width, height } };
}

function svgBody(svg) {
    const source = String(svg || '');
    const open = source.indexOf('>');
    const close = source.lastIndexOf('</svg>');
    return open >= 0 && close > open ? source.slice(open + 1, close) : '';
}

function makeWorldSvg(svg, placement, rasterBounds) {
    const cos = Math.cos(placement.rotation);
    const sin = Math.sin(placement.rotation);
    const matrix = [
        cos * placement.scaleX,
        sin * placement.scaleX,
        -sin * placement.scaleY,
        cos * placement.scaleY,
        placement.x,
        placement.y
    ].map(value => Number(value.toFixed(8))).join(' ');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${rasterBounds.width}" height="${rasterBounds.height}" viewBox="${rasterBounds.x} ${rasterBounds.y} ${rasterBounds.width} ${rasterBounds.height}"><g transform="matrix(${matrix})">${svgBody(svg)}</g></svg>`;
}

async function browserRasterize(svg, width, height, placement, documentRef, localBounds = null) {
    if (!documentRef?.createElement || typeof Image !== 'function') return null;
    const sourceBounds = localBounds || { x: -width / 2, y: -height / 2, width, height };
    const rasterBounds = transformedRasterBounds(sourceBounds, placement);
    const budget = rasterBudgetFailure(rasterBounds, '配置後の文字画素');
    if (budget) return budget;
    const worldSvg = makeWorldSvg(svg, placement, rasterBounds);
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(worldSvg)}`;
    try {
        if (typeof image.decode === 'function') await image.decode();
        else await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
    } catch (error) {
        return null;
    }
    const sourceCanvas = documentRef.createElement('canvas');
    sourceCanvas.width = rasterBounds.width;
    sourceCanvas.height = rasterBounds.height;
    const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
    if (!sourceContext) return null;
    sourceContext.clearRect(0, 0, rasterBounds.width, rasterBounds.height);
    sourceContext.drawImage(image, 0, 0, rasterBounds.width, rasterBounds.height);
    let sourceData;
    try {
        sourceData = sourceContext.getImageData(0, 0, rasterBounds.width, rasterBounds.height);
    } catch (error) {
        return null;
    }
    return { width: rasterBounds.width, height: rasterBounds.height, pixels: new Uint8ClampedArray(sourceData.data), rasterBounds };
}

function makeSystemRequest(params) {
    return {
        text: params.text,
        vertical: params.vertical === true,
        fontFamily: params.fontFamily || 'sans-serif',
        fontSize: clamp(params.fontSize, 8, 400, 32),
        lineHeight: clamp(params.lineHeight, 0.8, 3, 1.5),
        letterSpacing: finite(params.fontSize) ? finite(params.tracking) / Math.max(1, finite(params.fontSize)) : 0,
        bold: params.bold === true,
        color: color(params.color, '#800000'),
        outlineWidth: clamp(params.strokeWidth, 0, 24, 0),
        outlineColor: color(params.strokeColor, '#ffffee'),
        align: 'center'
    };
}

function makeSystemSvg(request, width, height) {
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${-halfWidth} ${-halfHeight} ${width} ${height}"><g transform="translate(${-halfWidth} ${-halfHeight})"><foreignObject width="${width}" height="${height}">${buildLetteringHtml(request)}</foreignObject></g></svg>`;
}

async function renderSystem(params, options, placement) {
    if (finite(params.outerStrokeWidth) > 0 || params.sizeProfile || params.characterStyles?.length) return fail('system-font-vector-unsupported', '第二フチ取り・サイズ変化・文字別編集にはimported font bytesが必要です');
    if (params.baseline?.kind && params.baseline.kind !== 'none') return fail('system-font-vector-unsupported', 'curved baseline requires imported font bytes');
    if (params.envelope?.kind && params.envelope.kind !== 'none') return fail('system-font-vector-unsupported', 'envelope warp requires imported font bytes');
    if (params.fontFamily && !GENERIC_SYSTEM_FAMILIES.has(params.fontFamily.toLowerCase()) && !isFontAvailable(params.fontFamily)) return fail('system-font-unavailable', params.fontFamily);
    const request = makeSystemRequest(params);
    const documentRef = options.documentRef || globalThis.document;
    if (!documentRef?.createElement) return fail('文字を描画できない環境です');
    let measured;
    try {
        measured = await measureLettering(request, documentRef);
    } catch (error) {
        return fail('system-font-raster-failed', error?.message || '文字寸法を測れません');
    }
    const measuredBounds = { x: -measured.width / 2, y: -measured.height / 2, width: measured.width, height: measured.height };
    const measuredBudget = rasterBudgetFailure(measuredBounds, '文字local画素');
    if (measuredBudget) return measuredBudget;
    const measuredWorldBounds = transformedRasterBounds(measuredBounds, placement);
    const measuredWorldBudget = rasterBudgetFailure(measuredWorldBounds, '配置後の文字画素');
    if (measuredWorldBudget) return measuredWorldBudget;
    const result = await rasterizeLettering(request, { documentRef });
    if (!result?.ok) return result || fail('system-font-raster-failed');
    const localBounds = { x: -result.width / 2, y: -result.height / 2, width: result.width, height: result.height };
    const localRasterBounds = integerRasterBounds(localBounds);
    const localBudget = rasterBudgetFailure(localRasterBounds, '文字local画素');
    if (localBudget) return localBudget;
    const worldRasterBounds = transformedRasterBounds(localBounds, placement);
    const worldBudget = rasterBudgetFailure(worldRasterBounds, '配置後の文字画素');
    if (worldBudget) return worldBudget;
    const svg = makeSystemSvg(request, result.width, result.height);
    let raster = await browserRasterize(svg, localRasterBounds.width, localRasterBounds.height, placement, documentRef, localBounds);
    if (raster?.ok === false) return raster;
    if (!raster) raster = resamplePlacement({ width: result.width, height: result.height, pixels: result.pixels }, placement, localBounds);
    if (raster?.ok === false) return raster;
    return {
        ok: true,
        params,
        width: raster.width,
        height: raster.height,
        pixels: raster.pixels,
        rasterBounds: raster.rasterBounds,
        svg,
        localBounds,
        envelopeBounds: localBounds,
        paths: [],
        engine: 'browser-paragraph-raster'
    };
}

function mapBaseline(point, glyph, shape, table) {
    const axisExtent = glyph.axis === 'y' ? shape.height : shape.width;
    const axis = glyph.axis === 'y' ? glyph.y : glyph.x;
    const distance = Math.max(0, Math.min(table.length, axis + axisExtent / 2));
    const evaluated = curvePointAtDistance(table, distance);
    if (!evaluated?.point) return null;
    const tangent = evaluated.tangent && Math.hypot(evaluated.tangent.x, evaluated.tangent.y) > 1e-8
        ? evaluated.tangent
        : { x: 1, y: 0 };
    const tangentLength = Math.hypot(tangent.x, tangent.y) || 1;
    const tx = tangent.x / tangentLength;
    const ty = tangent.y / tangentLength;
    const normal = { x: -ty, y: tx };
    const center = glyph.axis === 'y'
        ? { x: glyph.lineX ?? shape.verticalLineX, y: glyph.y }
        : { x: glyph.x, y: glyph.lineBaselineY ?? shape.baselineY };
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    if (glyph.axis === 'y') {
        return { x: evaluated.point.x + normal.x * dx + tx * dy, y: evaluated.point.y + normal.y * dx + ty * dy };
    }
    return { x: evaluated.point.x + tx * dx + normal.x * dy, y: evaluated.point.y + ty * dx + normal.y * dy };
}

function mapGlyphSubpaths(glyph, shape, params, baselineTable, index, total) {
    const source = flattenPath(glyph.path);
    const startSize = Math.max(1, finite(params.fontSize, 64));
    const endSize = params.endFontSize == null ? startSize : clamp(params.endFontSize, 8, 512, startSize);
    const axis = glyph.axis === 'y' ? glyph.y - shape.bounds.y : glyph.x - shape.bounds.x;
    const extent = glyph.axis === 'y' ? shape.height : shape.width;
    const progress = extent <= 1e-9 ? (total <= 1 ? 0 : index / (total - 1)) : Math.max(0, Math.min(1, axis / extent));
    const sizeScale = glyph.sizeApplied ? 1 : (startSize + (endSize - startSize) * progress) / startSize;
    const anchor = glyph.axis === 'y'
        ? { x: glyph.lineX ?? shape.verticalLineX, y: glyph.y }
        : { x: glyph.x, y: glyph.lineBaselineY ?? shape.baselineY };
    return source.map(subpath => ({
        ...subpath,
        points: subpath.points.map(point => {
            const scaled = {
                x: anchor.x + (point.x - anchor.x) * sizeScale,
                y: anchor.y + (point.y - anchor.y) * sizeScale
            };
            let mapped = mapCharacterPoint(scaled, glyph, anchor);
            if (baselineTable) mapped = mapBaseline(mapped, glyph, shape, baselineTable);
            if (!mapped) return null;
            return mapPointSafely(pointValue => pointValue, mapped);
        }).filter(Boolean)
    })).filter(subpath => subpath.points.length >= 2);
}

function glyphAnchor(glyph, shape) {
    return glyph.axis === 'y' ? { x: glyph.lineX ?? shape.verticalLineX, y: glyph.y }
        : { x: glyph.x, y: glyph.lineBaselineY ?? shape.baselineY };
}

function mapCharacterPoint(point, glyph, anchor) {
    const style = glyph.style;
    if (!style) return point;
    let value = point;
    if (style.envelope?.kind && style.envelope.kind !== 'none' && glyph.characterBounds) value = mapEnvelopePoint(value, glyph.characterBounds, style.envelope);
    const dx = (value.x - anchor.x) * finite(style.scaleX, 1), dy = (value.y - anchor.y) * finite(style.scaleY, 1);
    const cos = Math.cos(finite(style.rotation)), sin = Math.sin(finite(style.rotation));
    return { x: anchor.x + cos * dx - sin * dy + finite(glyph.axis === 'y' ? style.offsetY : style.offsetX),
        y: anchor.y + sin * dx + cos * dy + finite(glyph.axis === 'y' ? style.offsetX : style.offsetY) };
}

function mapEnvelopeSubpaths(paths, envelopeBounds, envelope) {
    const kind = typeof envelope?.kind === 'string' ? envelope.kind : 'none';
    const identityPoints = kind === 'points' && Array.isArray(envelope?.points) && envelope.points.length === 9
        && envelope.points.every((point, index) => Math.abs(finite(point?.x) - (index % 3) / 2) <= 1e-9
            && Math.abs(finite(point?.y) - Math.floor(index / 3) / 2) <= 1e-9);
    if (kind === 'none' || identityPoints) {
        return paths.map(path => ({
            ...path,
            points: path.points.map(point => ({ x: point.x, y: point.y }))
        }));
    }
    return paths.map(path => ({
        ...path,
        points: path.points.map(point => mapPointSafely(value => mapEnvelopePoint(value, envelopeBounds, envelope), point)).filter(Boolean)
    })).filter(path => path.points.length >= 2);
}

async function renderImported(params, options, placement) {
    const shaped = await shapeLettering(params, options);
    if (!shaped?.ok) return shaped || fail('font-shaping-failed');
    let baselineTable = null;
    if (params.baseline?.kind && params.baseline.kind !== 'none') {
        const path = params.baseline.path;
        if (!Array.isArray(path?.nodes) || path.nodes.length < 2) return fail('baseline-invalid', '配置線に2点以上必要です');
        baselineTable = curveLengthTable(path, 0.25);
        if (!baselineTable || !(baselineTable.length > 0)) return fail('baseline-invalid', '配置線の長さが0です');
    }
    const sourceBounds = shaped.sourceBounds || shaped.bounds || { x: -shaped.width / 2, y: -shaped.height / 2, width: shaped.width, height: shaped.height };
    const preEnvelopePaths = [];
    const allPreEnvelope = [];
    const visibleGlyphs = shaped.glyphs.filter(glyph => glyph.path);
    const characterBoxes = new Map();
    for (const glyph of visibleGlyphs) {
        const key = `${glyph.start}:${glyph.end}`;
        let box = characterBoxes.get(key) || null;
        for (const path of flattenPath(glyph.path)) for (const point of path.points) box = unionBounds(box, point);
        characterBoxes.set(key, box);
    }
    for (let index = 0; index < visibleGlyphs.length; index += 1) {
        const glyph = visibleGlyphs[index];
        glyph.characterBounds = characterBoxes.get(`${glyph.start}:${glyph.end}`);
        const subpaths = mapGlyphSubpaths(glyph, shaped, params, baselineTable, index, visibleGlyphs.length);
        allPreEnvelope.push(...subpaths);
        const d = pathToSvg(subpaths);
        let anchor = mapCharacterPoint(glyphAnchor(glyph, shaped), glyph, glyphAnchor(glyph, shaped));
        // offsetX/offsetY are baseline tangent/normal translations applied
        // after the character's own rotation. Their drag basis must therefore
        // not rotate along with the glyph itself.
        let next = { x: anchor.x + (glyph.axis === 'y' ? 0 : 1), y: anchor.y + (glyph.axis === 'y' ? 1 : 0) };
        let normalNext = { x: anchor.x + (glyph.axis === 'y' ? 1 : 0), y: anchor.y + (glyph.axis === 'y' ? 0 : 1) };
        if (baselineTable) { anchor = mapBaseline(anchor, glyph, shaped, baselineTable); next = mapBaseline(next, glyph, shaped, baselineTable); normalNext = mapBaseline(normalNext, glyph, shaped, baselineTable); }
        if (d) preEnvelopePaths.push({ d, subpaths, cluster: glyph.cluster, start: glyph.start, end: glyph.end,
            fill: color(glyph.style?.color, color(params.color, '#800000')), anchor, next, normalNext });
    }
    // The envelope maps the post-size/post-baseline text as one object. Keep
    // this pre-envelope frame stable so baseline nodes and overlay handles
    // remain in the same local coordinate system as the returned paths.
    const envelopeBounds = boundsOfSubpaths(allPreEnvelope) || { ...sourceBounds };
    const mappedPaths = preEnvelopePaths.map(path => ({
        ...path,
        anchor: mapEnvelopePoint(path.anchor, envelopeBounds, params.envelope),
        next: mapEnvelopePoint(path.next, envelopeBounds, params.envelope),
        normalNext: mapEnvelopePoint(path.normalNext, envelopeBounds, params.envelope),
        subpaths: mapEnvelopeSubpaths(path.subpaths, envelopeBounds, params.envelope)
    })).filter(path => path.subpaths.length > 0);
    const allMapped = mappedPaths.flatMap(path => path.subpaths);
    let fillBounds = boundsOfSubpaths(allMapped);
    if (!fillBounds) fillBounds = { ...envelopeBounds };
    const strokeWidth = clamp(params.strokeWidth, 0, 64, 0);
    const outerStrokeWidth = clamp(params.outerStrokeWidth, 0, 64, 0);
    const fullStrokeWidth = strokeWidth + outerStrokeWidth * 2;
    const localBounds = {
        x: fillBounds.x - fullStrokeWidth / 2,
        y: fillBounds.y - fullStrokeWidth / 2,
        width: Math.max(0, fillBounds.width + fullStrokeWidth),
        height: Math.max(0, fillBounds.height + fullStrokeWidth)
    };
    const localRasterBounds = integerRasterBounds(localBounds);
    const localBudget = rasterBudgetFailure(localRasterBounds, '文字local画素');
    if (localBudget) return localBudget;
    const worldRasterBounds = transformedRasterBounds(localBounds, placement);
    const worldBudget = rasterBudgetFailure(worldRasterBounds, '配置後の文字画素');
    if (worldBudget) return worldBudget;
    const normalizedPaths = mappedPaths.map(path => ({ ...path, d: pathToSvg(path.subpaths) }));
    const svg = makeSvg(normalizedPaths, localBounds, params);
    const outputPaths = normalizedPaths.map(path => ({
        d: path.d,
        cluster: path.cluster,
        start: path.start,
        end: path.end,
        bounds: boundsOfSubpaths(path.subpaths),
        anchor: path.anchor,
        offsetBasis: { x: { x: path.next.x - path.anchor.x, y: path.next.y - path.anchor.y },
            y: { x: path.normalNext.x - path.anchor.x, y: path.normalNext.y - path.anchor.y } },
        tangent: { x: (path.next.x - path.anchor.x) / (Math.hypot(path.next.x - path.anchor.x, path.next.y - path.anchor.y) || 1),
            y: (path.next.y - path.anchor.y) / (Math.hypot(path.next.x - path.anchor.x, path.next.y - path.anchor.y) || 1) },
        fill: path.fill,
        fillRule: 'nonzero',
        ...(outerStrokeWidth > 0 ? { outerStroke: color(params.outerStrokeColor, '#800000'), outerStrokeWidth: fullStrokeWidth } : {}),
        ...(strokeWidth > 0 ? {
            stroke: color(params.strokeColor, '#ffffee'),
            strokeWidth
        } : {})
    }));
    if (options.previewOnly === true) {
        return {
            ok: true,
            params,
            width: worldRasterBounds.width,
            height: worldRasterBounds.height,
            rasterBounds: worldRasterBounds,
            svg,
            localBounds,
            envelopeBounds,
            paths: outputPaths,
            engine: shaped.engine
        };
    }
    const documentRef = options.documentRef || globalThis.document;
    let raster = await browserRasterize(svg, localRasterBounds.width, localRasterBounds.height, placement, documentRef, localBounds);
    if (raster?.ok === false) return raster;
    if (!raster) {
        const fallbackSource = rasterizePolygons(normalizedPaths, localBounds, params);
        if (fallbackSource?.ok === false) return fallbackSource;
        raster = resamplePlacement(fallbackSource, placement, localBounds);
    }
    if (raster?.ok === false) return raster;
    return {
        ok: true,
        params,
        width: raster.width,
        height: raster.height,
        pixels: raster.pixels,
        rasterBounds: raster.rasterBounds,
        svg,
        localBounds,
        envelopeBounds,
        paths: outputPaths,
        engine: shaped.engine
    };
}

/**
 * Render editable lettering. All expensive font parsing is owned by the font
 * engine; drag-time calls only flatten and map the cached unwarped outlines.
 */
export async function renderLettering(params = {}, options = {}) {
    const placement = placementValue(params.placement);
    if (!placement) return fail('placement-invalid', 'scaleX/scaleY must be non-zero');
    const text = String(params.text ?? '');
    if (!text.trim()) return fail('empty-text', '文字を入力してください');
    if (params.fontKind === 'system') return renderSystem(params, options, placement);
    if (params.fontKind && !['imported', 'bundled'].includes(params.fontKind)) return fail('font-kind-unsupported', params.fontKind);
    return renderImported(params, options, placement);
}

