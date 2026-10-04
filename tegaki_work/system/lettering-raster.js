/**
 * ============================================================================
 * ファイル名: system/lettering-raster.js
 * 責務: 日本語の縦書き/横書き文字を、ブラウザの組版(CSS writing-mode)でRGBA画素へ描き出す(吹き出しの文字用)。
 * 依存: DOM(測定用の非表示要素)、SVG foreignObject → Image → Canvas2D。system/font-library.js(取り込みフォントの埋め込み)
 * 被依存: ui/balloon-popup.js, system/balloon-raster.js
 * 公開API: normalizeLetteringRequest, buildLetteringHtml, measureLettering, rasterizeLettering, LETTERING_LIMITS
 * 設計:
 *   - 縦書きの禁則・約物の回転・縦中横(2桁の数字)・縦用字形(vert)はブラウザの組版に任せる(Canvas2Dには縦書きが無いため)。
 *   - SVGを画像として描く場合は文書のFontFaceが見えないので、取り込みフォントは@font-faceをbase64で埋め込む。
 *     端末のフォントはfamily名だけで使える。dataURLで読み込むことでcanvasは汚染されず、getImageDataできる。
 *   - 測定は文書内の非表示要素(同じCSS)で行う。取り込みフォントは文書側にもFontFace登録済みであること。
 *   - 同一requestのruntime画素cacheは3件/32MiB。返却画素をcopyし、保存正本へ追加しない。
 * 関連Card: WP-013 / WP-024。SVG組版の正本を維持。
 * ============================================================================
 */

export const LETTERING_LIMITS = Object.freeze({
    fontSize: { min: 8, max: 400 },
    lineHeight: { min: 0.8, max: 3 },
    letterSpacing: { min: -0.2, max: 1 },
    outlineWidth: { min: 0, max: 24 },
    maxCharacters: 2000,
    maxDimension: 4096
});

// Derived runtime pixels only. Keep the SVG/browser typesetting authority and
// never expose a cached mutable pixel array to callers (History/Project unchanged).
const rasterCache = new Map();
const RASTER_CACHE_MAX_ENTRIES = 3;
const RASTER_CACHE_MAX_BYTES = 32 * 1024 * 1024;
let rasterCacheBytes = 0;

function cachedRaster(key, req, documentRef) {
    const entry = rasterCache.get(key);
    if (!entry || entry.documentRef !== documentRef || entry.result.request.embedCss !== req.embedCss) return null;
    rasterCache.delete(key);
    rasterCache.set(key, entry);
    return { ...entry.result, pixels: new Uint8ClampedArray(entry.result.pixels), request: { ...req } };
}

function retainRaster(key, result, documentRef) {
    const size = result.pixels.byteLength;
    if (size > RASTER_CACHE_MAX_BYTES) return;
    const previous = rasterCache.get(key);
    if (previous) { rasterCacheBytes -= previous.result.pixels.byteLength; rasterCache.delete(key); }
    while (rasterCache.size >= RASTER_CACHE_MAX_ENTRIES || rasterCacheBytes + size > RASTER_CACHE_MAX_BYTES) {
        const oldest = rasterCache.keys().next().value;
        rasterCacheBytes -= rasterCache.get(oldest).result.pixels.byteLength;
        rasterCache.delete(oldest);
    }
    rasterCache.set(key, { documentRef, result: { ...result, pixels: new Uint8ClampedArray(result.pixels), request: { ...result.request } } });
    rasterCacheBytes += size;
}

function clamp(value, min, max, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function colorOr(value, fallback) {
    return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
}

export function normalizeLetteringRequest(input = {}) {
    const L = LETTERING_LIMITS;
    const text = String(input.text ?? '').replace(/\r\n?/g, '\n');
    if (!text.trim()) return { ok: false, reason: '文字を入力してください' };
    if (text.length > L.maxCharacters) return { ok: false, reason: `文字数は${L.maxCharacters}文字以内です` };
    return {
        ok: true,
        value: {
            text,
            vertical: input.vertical !== false,
            fontFamily: String(input.fontFamily || 'sans-serif').replace(/['"\\<>;{}]/g, '').slice(0, 120),
            embedCss: typeof input.embedCss === 'string' ? input.embedCss : '',
            fontSize: Math.round(clamp(input.fontSize, L.fontSize.min, L.fontSize.max, 32)),
            lineHeight: clamp(input.lineHeight, L.lineHeight.min, L.lineHeight.max, 1.5),
            letterSpacing: clamp(input.letterSpacing, L.letterSpacing.min, L.letterSpacing.max, 0.04),
            bold: input.bold === true,
            color: colorOr(input.color, '#800000'),
            outlineWidth: clamp(input.outlineWidth, L.outlineWidth.min, L.outlineWidth.max, 0),
            outlineColor: colorOr(input.outlineColor, '#ffffee'),
            align: ['start', 'center', 'end'].includes(input.align) ? input.align : 'center',
            // 折り返す箱(任意)。縦書きでは高さ、横書きでは幅が1行の最大長になる。
            boxWidth: Number.isFinite(Number(input.boxWidth)) && Number(input.boxWidth) > 0 ? Math.round(Number(input.boxWidth)) : 0,
            boxHeight: Number.isFinite(Number(input.boxHeight)) && Number(input.boxHeight) > 0 ? Math.round(Number(input.boxHeight)) : 0
        }
    };
}

function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '&#10;');
}

/** 組版するdivのstyle文字列。測定とSVG描画で同じ値を使う。 */
function letteringStyle(req, extra = '') {
    const pad = Math.ceil(req.outlineWidth) + 2;
    const boxW = req.boxWidth ? `width:${req.boxWidth}px;` : (req.vertical ? 'width:max-content;' : 'width:max-content;');
    const boxH = req.boxHeight ? `height:${req.boxHeight}px;` : 'height:max-content;';
    return [
        'box-sizing:content-box',
        `padding:${pad}px`,
        boxW,
        boxH,
        `font-family:${req.fontFamily.includes(',') ? req.fontFamily : `'${req.fontFamily}'`}, sans-serif`,
        `font-size:${req.fontSize}px`,
        `font-weight:${req.bold ? 700 : 400}`,
        `line-height:${req.lineHeight}`,
        `letter-spacing:${req.letterSpacing}em`,
        `color:${req.color}`,
        `text-align:${req.align}`,
        'white-space:pre-wrap',
        'overflow-wrap:anywhere',
        'line-break:strict',
        'margin:0',
        req.vertical ? 'writing-mode:vertical-rl;text-orientation:mixed;text-combine-upright:digits 2;' : 'writing-mode:horizontal-tb;',
        req.outlineWidth > 0
            ? `-webkit-text-stroke:${req.outlineWidth * 2}px ${req.outlineColor};paint-order:stroke fill;`
            : '',
        extra
    ].join(';');
}

export function buildLetteringHtml(req, extraStyle = '') {
    return `<div xmlns="http://www.w3.org/1999/xhtml" style="${letteringStyle(req, extraStyle)}">${escapeHtml(req.text)}</div>`;
}

/**
 * 組版後の寸法(px)を測る。取り込みフォントは文書側のFontFace読み込み完了後に測る。
 * @returns {{ width:number, height:number }}
 */
export async function measureLettering(req, documentRef = globalThis.document) {
    const host = documentRef.createElement('div');
    host.style.cssText = 'position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none;';
    host.innerHTML = `<div style="${letteringStyle(req)}">${escapeHtml(req.text)}</div>`;
    documentRef.body.appendChild(host);
    try {
        await documentRef.fonts?.ready;
        const rect = host.firstElementChild.getBoundingClientRect();
        return { width: Math.max(1, Math.ceil(rect.width)), height: Math.max(1, Math.ceil(rect.height)) };
    } finally {
        host.remove();
    }
}

/**
 * 文字をRGBA画素にする。
 * @returns {Promise<{ok:true,width,height,pixels:Uint8ClampedArray,request}|{ok:false,reason}>}
 */
export async function rasterizeLettering(input, options = {}) {
    const normalized = normalizeLetteringRequest(input);
    if (!normalized.ok) return normalized;
    const req = normalized.value;
    const documentRef = options.documentRef || globalThis.document;
    if (!documentRef?.createElement) return { ok: false, reason: '文字を描画できない環境です' };

    const cacheKey = JSON.stringify({ ...req, embedCss: undefined });
    const cached = cachedRaster(cacheKey, req, documentRef);
    if (cached) return cached;

    const size = await measureLettering(req, documentRef);
    const max = LETTERING_LIMITS.maxDimension;
    if (size.width > max || size.height > max) return { ok: false, reason: `文字が大きすぎます（最大${max}px）` };

    const style = req.embedCss ? `<defs><style>${req.embedCss.replace(/</g, '')}</style></defs>` : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}">${style}`
        + `<foreignObject width="${size.width}" height="${size.height}">${buildLetteringHtml(req)}</foreignObject></svg>`;

    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    try {
        await image.decode();
    } catch (error) {
        return { ok: false, reason: '文字の描画に失敗しました' };
    }
    const canvas = documentRef.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { ok: false, reason: '文字を描画できない環境です' };
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.drawImage(image, 0, 0);
    let data;
    try {
        data = ctx.getImageData(0, 0, size.width, size.height);
    } catch (error) {
        return { ok: false, reason: 'この環境では文字を取り出せません' };
    }
    const result = { ok: true, width: size.width, height: size.height, pixels: new Uint8ClampedArray(data.data), request: req };
    retainRaster(cacheKey, result, documentRef);
    return result;
}
