/**
 * ROLE: Common lettering-model adapter for Japanese rectangular browser paragraphs.
 * AUTHORITY: lettering-raster owns CSS measurement/raster; no Project/History ownership.
 * CALLERS: Balloon text and standalone lettering's system-font backend.
 * LIMIT: Single font / basic style / first outline. Outline editing uses the vector backend.
 * Related: WP-030. Unsupported attributes fail explicitly, never silently disappear.
 */
import { normalizeLetteringRequest, measureLettering, rasterizeLettering } from './lettering-raster.js';

export function paragraphRequest(params = {}, layout = {}) {
    if (params.characterStyles?.length || params.sizeProfile || Number(params.outerStrokeWidth) > 0
        || (params.baseline?.kind && params.baseline.kind !== 'none')
        || (params.envelope?.kind && params.envelope.kind !== 'none')) {
        return { ok: false, reason: 'paragraph-style-unsupported: 文字別・第二フチ・曲線・変形は輪郭組版が必要です' };
    }
    const size = Number(params.fontSize) || 32;
    const normalized = normalizeLetteringRequest({
        text: params.text, vertical: params.vertical === true,
        fontFamily: params.fontFamily || 'sans-serif', fontSize: size,
        lineHeight: params.lineHeight ?? 1.5, letterSpacing: Number(params.tracking || 0) / size,
        bold: params.bold === true, color: params.color || '#800000',
        outlineWidth: params.strokeWidth || 0, outlineColor: params.strokeColor || '#ffffee',
        boxWidth: layout.boxWidth || 0, boxHeight: layout.boxHeight || 0,
        align: layout.align || 'center', embedCss: layout.embedCss || ''
    });
    return normalized.ok ? { ok: true, request: normalized.value } : normalized;
}

export async function measureParagraph(params, layout = {}, documentRef = globalThis.document) {
    const normalized = paragraphRequest(params, layout);
    if (!normalized.ok) return normalized;
    const measured = await measureLettering(normalized.request, documentRef);
    return { ok: true, ...measured, request: normalized.request };
}

export async function rasterizeParagraph(params, layout = {}, options = {}) {
    const normalized = paragraphRequest(params, layout);
    return normalized.ok ? rasterizeLettering(normalized.request, options) : normalized;
}
