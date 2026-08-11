/**
 * Text to Raster input adapter.
 * The returned pixels are the only persistent authority; text/options stay runtime-only.
 */

export const TEXT_RASTER_FONT_FAMILIES = Object.freeze([
    'sans-serif',
    'serif',
    'monospace'
]);

export const TEXT_RASTER_LIMITS = Object.freeze({
    minFontSize: 8,
    maxFontSize: 256,
    maxCharacters: 2000,
    maxLines: 32,
    padding: 4
});

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function normalizeColor(value) {
    if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) {
        return value.toLowerCase();
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '#800000';
    return `#${clamp(Math.round(numeric), 0, 0xffffff).toString(16).padStart(6, '0')}`;
}

export function normalizeTextRasterRequest(input = {}) {
    const text = String(input.text ?? '').replace(/\r\n?/g, '\n');
    if (!text.trim()) {
        return { ok: false, reason: '文字を入力してください' };
    }
    if (text.length > TEXT_RASTER_LIMITS.maxCharacters) {
        return { ok: false, reason: `文字数は${TEXT_RASTER_LIMITS.maxCharacters}文字以内です` };
    }

    const lines = text.split('\n');
    if (lines.length > TEXT_RASTER_LIMITS.maxLines) {
        return { ok: false, reason: `行数は${TEXT_RASTER_LIMITS.maxLines}行以内です` };
    }

    const requestedSize = Number(input.fontSize);
    if (!Number.isFinite(requestedSize)) {
        return { ok: false, reason: '文字サイズを確認してください' };
    }

    const family = TEXT_RASTER_FONT_FAMILIES.includes(input.fontFamily)
        ? input.fontFamily
        : TEXT_RASTER_FONT_FAMILIES[0];
    const fontSize = Math.round(clamp(
        requestedSize,
        TEXT_RASTER_LIMITS.minFontSize,
        TEXT_RASTER_LIMITS.maxFontSize
    ));
    const bold = input.bold === true;

    return {
        ok: true,
        value: {
            text,
            lines,
            fontFamily: family,
            fontSize,
            bold,
            color: normalizeColor(input.color),
            font: `${bold ? '700' : '400'} ${fontSize}px ${family}`
        }
    };
}

export function createTextRasterLayout(request, measureText) {
    if (!request?.lines?.length || typeof measureText !== 'function') {
        return { ok: false, reason: '文字レイアウトを作成できません' };
    }

    const sample = measureText('Mgあ漢') || {};
    const ascent = Math.max(1, Math.ceil(Number(sample.actualBoundingBoxAscent) || request.fontSize * 0.82));
    const descent = Math.max(1, Math.ceil(Number(sample.actualBoundingBoxDescent) || request.fontSize * 0.22));
    const lineAdvance = Math.max(ascent + descent, Math.ceil(request.fontSize * 1.25));
    let maxLineWidth = 0;
    let maxLeft = 0;

    const lineMetrics = request.lines.map((line) => {
        const metrics = measureText(line || ' ') || {};
        const left = Math.max(0, Math.ceil(Number(metrics.actualBoundingBoxLeft) || 0));
        const right = Math.max(0, Math.ceil(Number(metrics.actualBoundingBoxRight) || 0));
        const measuredWidth = Math.max(0, Math.ceil(Number(metrics.width) || 0));
        const inkWidth = line ? Math.max(measuredWidth, left + right) : 0;
        maxLineWidth = Math.max(maxLineWidth, inkWidth);
        maxLeft = Math.max(maxLeft, left);
        return { line, left, inkWidth };
    });

    const padding = TEXT_RASTER_LIMITS.padding;
    const width = Math.max(1, Math.ceil(maxLineWidth + maxLeft + padding * 2));
    const height = Math.max(1, Math.ceil(
        padding * 2 + ascent + descent + lineAdvance * (request.lines.length - 1)
    ));

    return {
        ok: true,
        width,
        height,
        x: padding + maxLeft,
        baselines: lineMetrics.map((_, index) => padding + ascent + lineAdvance * index),
        lineMetrics,
        ascent,
        descent,
        lineAdvance,
        padding
    };
}

export function resolveTextRasterPlacement(options = {}) {
    const rasterWidth = Math.max(1, Math.round(Number(options.rasterWidth) || 1));
    const rasterHeight = Math.max(1, Math.round(Number(options.rasterHeight) || 1));
    const projectWidth = Math.max(1, Math.round(Number(options.projectWidth) || 1));
    const projectHeight = Math.max(1, Math.round(Number(options.projectHeight) || 1));
    const centerX = Number.isFinite(Number(options.center?.x)) ? Number(options.center.x) : projectWidth / 2;
    const centerY = Number.isFinite(Number(options.center?.y)) ? Number(options.center.y) : projectHeight / 2;
    let x = Math.round(centerX - rasterWidth / 2);
    let y = Math.round(centerY - rasterHeight / 2);

    if (rasterWidth <= projectWidth) x = clamp(x, 0, projectWidth - rasterWidth);
    if (rasterHeight <= projectHeight) y = clamp(y, 0, projectHeight - rasterHeight);

    return { x, y, width: rasterWidth, height: rasterHeight };
}

export function rasterizeTextToImageData(input, options = {}) {
    const normalized = normalizeTextRasterRequest(input);
    if (!normalized.ok) return normalized;

    const documentRef = options.documentRef || globalThis.document;
    if (!documentRef?.createElement) {
        return { ok: false, reason: '文字Raster用Canvasを作成できません' };
    }

    const measureCanvas = documentRef.createElement('canvas');
    const measureContext = measureCanvas.getContext('2d');
    if (!measureContext) {
        return { ok: false, reason: '文字Raster用Canvasを作成できません' };
    }
    measureContext.font = normalized.value.font;
    const layout = createTextRasterLayout(normalized.value, (line) => measureContext.measureText(line));
    if (!layout.ok) return layout;

    const maxDimension = Math.max(1, Math.round(Number(options.maxDimension) || 8192));
    if (layout.width > maxDimension || layout.height > maxDimension) {
        return { ok: false, reason: `文字Rasterが大きすぎます（最大${maxDimension}px）` };
    }
    if (typeof options.isSizeAllowed === 'function' && !options.isSizeAllowed(layout)) {
        return { ok: false, reason: '文字Rasterが安全な描画容量を超えています' };
    }

    const canvas = documentRef.createElement('canvas');
    canvas.width = layout.width;
    canvas.height = layout.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
        return { ok: false, reason: '文字Raster用Canvasを作成できません' };
    }

    context.clearRect(0, 0, layout.width, layout.height);
    context.font = normalized.value.font;
    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    context.fillStyle = normalized.value.color;
    normalized.value.lines.forEach((line, index) => {
        if (line) context.fillText(line, layout.x, layout.baselines[index]);
    });

    const imageData = context.getImageData(0, 0, layout.width, layout.height);
    return {
        ok: true,
        width: layout.width,
        height: layout.height,
        pixels: new Uint8ClampedArray(imageData.data),
        request: normalized.value,
        layout
    };
}

export class TextRasterService {
    constructor(dependencies = {}) {
        this.layerSystem = dependencies.layerSystem || null;
        this.cameraSystem = dependencies.cameraSystem || null;
        this.eventBus = dependencies.eventBus || null;
    }

    createTextLayer(input = {}) {
        const activeLayer = this.layerSystem?.getActiveLayer?.();
        if (activeLayer?.layerData?.isAnimationWorkingLayer === true) {
            return { ok: false, reason: 'Text to Rasterは通常CanvasのRaster Layer専用です' };
        }
        if (!this.layerSystem?.createRasterLayerFromSnapshot) {
            return { ok: false, reason: 'Raster Layerを作成できません' };
        }

        const maxTextureSize = this.layerSystem?._getMaxRenderTextureSize?.() || 8192;
        let raster = null;
        try {
            raster = rasterizeTextToImageData(input, {
                maxDimension: maxTextureSize,
                isSizeAllowed: (layout) => this.layerSystem._isRasterBakeSizeAllowed?.(layout) !== false
            });
        } catch (error) {
            return { ok: false, reason: '文字Rasterの生成に失敗しました' };
        }
        if (!raster.ok) return raster;

        const canvasConfig = this.layerSystem.config?.canvas || {};
        const projectWidth = Math.max(1, Math.round(canvasConfig.width || 1));
        const projectHeight = Math.max(1, Math.round(canvasConfig.height || 1));
        const center = this.cameraSystem?.getViewportCenterCanvasPoint?.()
            || { x: projectWidth / 2, y: projectHeight / 2 };
        const rasterBounds = resolveTextRasterPlacement({
            rasterWidth: raster.width,
            rasterHeight: raster.height,
            projectWidth,
            projectHeight,
            center
        });
        const preview = raster.request.text.replace(/\s+/g, ' ').trim().slice(0, 12);
        let created = null;
        try {
            created = this.layerSystem.createRasterLayerFromSnapshot({
                width: raster.width,
                height: raster.height,
                pixels: raster.pixels,
                rasterBounds,
                paths: [],
                pathsData: []
            }, {
                name: preview ? `Text: ${preview}` : 'Text',
                historyName: 'text-to-raster',
                source: 'quick-access-text'
            });
        } catch (error) {
            return { ok: false, reason: 'Text Raster Layerを作成できません' };
        }
        if (!created?.layer?.layerData) {
            return { ok: false, reason: 'Text Raster Layerを作成できません' };
        }

        const layerId = created.layer.layerData.id;
        this.eventBus?.emit('layer:content-changed', { layerId, source: 'text-to-raster' });
        this.eventBus?.emit('text:rasterized', {
            layerId,
            layerIndex: created.index,
            rasterBounds: { ...rasterBounds }
        });
        return { ok: true, layerId, layerIndex: created.index, rasterBounds, request: raster.request };
    }
}
