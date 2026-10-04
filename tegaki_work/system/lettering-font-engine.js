/**
 * ============================================================================
 * ファイル名: system/lettering-font-engine.js
 * 責務: loaded font bytesをHarfBuzz.jsへ渡し、日本語の組版とglyph outlineを
 *       作品pxのlocal SVG pathへ変換する。HarfBuzzのobjectはruntime専用で、
 *       Project/Historyの保存正本へ漏らさない。
 * 依存: harfbuzzjs 1.6.2 (packageに同梱されたWASM)、font-libraryのensureLoaded
 * 被依存: system/lettering-vector-renderer.js
 * 公開API: shapeLettering, parseSvgPath, transformSvgPath
 * 境界: imported/bundled fontは既存fontLibrary.ensureLoaded(id).dataだけを読む。
 *       system fontのoutline取得や無言fallbackはこのengineの責務にしない。
 * ============================================================================
 */

import { segmentLetteringText, characterStyleAt, profileScale } from './lettering-character-styles.js';

const HARFBUZZ_PACKAGE_VERSION = '1.6.2';
const MAX_TEXT_CODEPOINTS = 2000;
const MAX_LINES = 32;
const MAX_FONT_RECORDS = 4;
const MAX_SHAPES = 24;

let harfBuzzPromise = null;
const fontRecordsByLibrary = new WeakMap();
const shapeCachesByLibrary = new WeakMap();

const NUMBER_PATTERN = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;
// SVG path commands never use E/e; excluding them keeps exponent notation
// attached to the preceding number instead of treating it as a command.
const COMMAND_PATTERN = /([a-df-zA-DF-Z])([^a-df-zA-DF-Z]*)/g;

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

function normalizeText(value) {
    return String(value ?? '').replace(/\r\n?/g, '\n');
}

function codePointEntries(text) {
    const entries = [];
    let index = 0;
    let offset = 0;
    for (const character of text) {
        entries.push({ character, codePoint: character.codePointAt(0), index, start: offset, end: offset + character.length });
        offset += character.length;
        index += 1;
    }
    return entries;
}

function isWhitespace(codePoint) {
    return codePoint === 0x0009 || codePoint === 0x0020 || codePoint === 0x00a0
        || codePoint === 0x1680 || (codePoint >= 0x2000 && codePoint <= 0x200a)
        || codePoint === 0x202f || codePoint === 0x205f || codePoint === 0x3000;
}

function formatCodePoint(codePoint) {
    return `U+${Number(codePoint).toString(16).toUpperCase().padStart(4, '0')}`;
}

function toBytes(data) {
    if (data instanceof Uint8Array) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(data)) {
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    }
    return null;
}

function readTag(bytes) {
    if (!bytes || bytes.byteLength < 4) return '';
    return String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
}

function detectFormat(bytes, extension = '') {
    const tag = readTag(bytes);
    const ext = String(extension || '').toLowerCase().replace(/^\./, '');
    if (tag === 'wOFF') return 'woff';
    if (tag === 'wOF2') return 'woff2';
    if (tag === 'ttcf') return 'ttc';
    if (tag === 'OTTO') return 'otf';
    if (tag === 'true' || tag === 'typ1' || tag === '\u0000\u0001\u0000\u0000') return 'ttf';
    if (['ttf', 'otf', 'ttc', 'woff', 'woff2'].includes(ext)) return ext;
    return 'unknown';
}

function parseNumbers(source) {
    return [...String(source || '').matchAll(NUMBER_PATTERN)].map(match => Number(match[0]));
}

/** Parse the absolute SVG commands emitted by HarfBuzz into a small neutral form. */
export function parseSvgPath(path) {
    const commands = [];
    const source = String(path || '');
    let match;
    COMMAND_PATTERN.lastIndex = 0;
    while ((match = COMMAND_PATTERN.exec(source))) {
        const type = match[1];
        const values = parseNumbers(match[2]);
        commands.push({ type, values });
    }
    return commands;
}

function numberText(value) {
    const number = finite(value);
    return Number.isInteger(number) ? String(number) : String(Number(number.toFixed(5)));
}

function serializeCommands(commands) {
    return commands.map(command => command.type.toUpperCase() + (command.values.length
        ? command.values.map(numberText).join(',')
        : '')).join('');
}

/** Transform all coordinate pairs in a HarfBuzz SVG path. */
export function transformSvgPath(path, mapPoint) {
    const commands = parseSvgPath(path);
    let current = { x: 0, y: 0 };
    let start = { x: 0, y: 0 };
    const transformed = [];
    for (const command of commands) {
        const type = command.type.toUpperCase();
        const relative = command.type !== type;
        const input = command.values;
        const output = [];
        const point = (x, y) => {
            const absolute = relative ? { x: current.x + x, y: current.y + y } : { x, y };
            const mapped = mapPoint(absolute.x, absolute.y);
            current = absolute;
            return mapped;
        };
        if (type === 'M' || type === 'L' || type === 'T') {
            for (let index = 0; index + 1 < input.length; index += 2) {
                const mapped = point(input[index], input[index + 1]);
                output.push(mapped.x, mapped.y);
                if (type === 'M' && index === 0) start = current;
            }
        } else if (type === 'H') {
            for (const value of input) {
                const absoluteX = relative ? current.x + value : value;
                const mapped = mapPoint(absoluteX, current.y);
                current = { x: absoluteX, y: current.y };
                output.push(mapped.x, mapped.y);
            }
        } else if (type === 'V') {
            for (const value of input) {
                const absoluteY = relative ? current.y + value : value;
                const mapped = mapPoint(current.x, absoluteY);
                current = { x: current.x, y: absoluteY };
                output.push(mapped.x, mapped.y);
            }
        } else if (type === 'Q' || type === 'S') {
            const stride = 4;
            for (let index = 0; index + stride - 1 < input.length; index += stride) {
                const c = relative
                    ? { x: current.x + input[index], y: current.y + input[index + 1] }
                    : { x: input[index], y: input[index + 1] };
                const end = point(input[index + 2], input[index + 3]);
                const mc = mapPoint(c.x, c.y);
                output.push(mc.x, mc.y, end.x, end.y);
            }
        } else if (type === 'C') {
            const stride = 6;
            for (let index = 0; index + stride - 1 < input.length; index += stride) {
                const c1 = relative
                    ? { x: current.x + input[index], y: current.y + input[index + 1] }
                    : { x: input[index], y: input[index + 1] };
                const c2 = relative
                    ? { x: current.x + input[index + 2], y: current.y + input[index + 3] }
                    : { x: input[index + 2], y: input[index + 3] };
                const end = point(input[index + 4], input[index + 5]);
                const mc1 = mapPoint(c1.x, c1.y);
                const mc2 = mapPoint(c2.x, c2.y);
                output.push(mc1.x, mc1.y, mc2.x, mc2.y, end.x, end.y);
            }
        } else if (type === 'A') {
            // HarfBuzz's glyphToPath does not currently emit arcs. Preserve a
            // clear command if a future package does; the renderer will flatten it.
            transformed.push({ type: 'A', values: input.slice() });
            continue;
        } else if (type === 'Z') {
            current = start;
        }
        transformed.push({ type, values: output });
    }
    return serializeCommands(transformed);
}

function pathBounds(path) {
    const commands = parseSvgPath(path);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const command of commands) {
        const values = command.values;
        const type = command.type.toUpperCase();
        if (type === 'Z') continue;
        const stride = type === 'H' ? 1 : type === 'V' ? 1 : type === 'A' ? 7 : 2;
        for (let index = 0; index + stride - 1 < values.length; index += stride) {
            if (type === 'H') {
                minX = Math.min(minX, values[index]);
                maxX = Math.max(maxX, values[index]);
            } else if (type === 'V') {
                minY = Math.min(minY, values[index]);
                maxY = Math.max(maxY, values[index]);
            } else {
                for (let offset = 0; offset + 1 < stride; offset += 2) {
                    const x = values[index + offset];
                    const y = values[index + offset + 1];
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }
            }
        }
    }
    if (!Number.isFinite(minX)) return null;
    return { x: minX, y: minY, width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) };
}

function shapeCacheFor(fontLibrary) {
    let cache = shapeCachesByLibrary.get(fontLibrary);
    if (!cache) {
        cache = new Map();
        shapeCachesByLibrary.set(fontLibrary, cache);
    }
    return cache;
}

function clearShapeCache(cache) {
    while (cache.size > MAX_SHAPES) cache.delete(cache.keys().next().value);
}

function cloneShape(result) {
    if (!result?.ok) return result;
    return {
        ...result,
        glyphs: result.glyphs.map(glyph => ({ ...glyph, ...(glyph.style ? { style: structuredClone(glyph.style) } : {}) })),
        bounds: result.bounds ? { ...result.bounds } : null,
        sourceBounds: result.sourceBounds ? { ...result.sourceBounds } : null
    };
}

async function loadHarfBuzz() {
    harfBuzzPromise ||= import('harfbuzzjs').then(module => {
        if (module.versionString && module.versionString().split('.').length >= 2) return module;
        return module;
    });
    return harfBuzzPromise;
}

async function resolveFontLibrary(options) {
    if (options?.fontLibrary && typeof options.fontLibrary.ensureLoaded === 'function') return options.fontLibrary;
    try {
        const module = await import('./font-library.js');
        return module.fontLibrary;
    } catch (error) {
        return null;
    }
}

function libraryRecordMap(fontLibrary) {
    let records = fontRecordsByLibrary.get(fontLibrary);
    if (!records) {
        records = new Map();
        fontRecordsByLibrary.set(fontLibrary, records);
    }
    return records;
}

async function getFontRecord(fontLibrary, fontId, entry) {
    const bytes = toBytes(entry?.data);
    if (!bytes || !bytes.byteLength) return { error: fail('font-data-unavailable', `fontId=${fontId}`) };
    const format = detectFormat(bytes, entry?.ext || entry?.format);
    if (format === 'woff' || format === 'woff2') {
        return { error: fail('font-format-unsupported', `${format.toUpperCase()} outline decoding is unavailable in HarfBuzz.js 1.6.2`) };
    }
    const records = libraryRecordMap(fontLibrary);
    const faceIndex = Number.isInteger(entry?.faceIndex) && entry.faceIndex >= 0 ? entry.faceIndex : 0;
    const key = `${fontId}:${bytes.byteLength}:${format}:${faceIndex}`;
    const previous = records.get(key);
    if (previous) {
        records.delete(key);
        records.set(key, previous);
        return { record: previous };
    }
    try {
        const hb = await loadHarfBuzz();
        const blob = new hb.Blob(bytes);
        const face = new hb.Face(blob, faceIndex);
        const upem = Number(face.upem);
        if (!Number.isFinite(upem) || upem <= 0) throw new Error('invalid units-per-em');
        // Force a table read now. This turns malformed TTC/OTF data into a
        // bounded parse failure instead of a later glyph-time exception.
        face.collectUnicodes();
        const record = { hb, blob, face, upem, format, faceIndex, fontId };
        records.set(key, record);
        while (records.size > MAX_FONT_RECORDS) records.delete(records.keys().next().value);
        return { record };
    } catch (error) {
        return { error: fail('font-parse-failed', `${format.toUpperCase()} data could not be decoded (${error?.message || 'unknown error'})`) };
    }
}

function normalizedParams(input) {
    const text = normalizeText(input?.text);
    const codePoints = codePointEntries(text);
    const lineCount = codePoints.reduce((count, entry) => count + (entry.character === '\n' ? 1 : 0), 1);
    if (!text.trim()) return { error: fail('empty-text', '文字を入力してください') };
    if (codePoints.length > MAX_TEXT_CODEPOINTS) return { error: fail('text-too-long', `最大${MAX_TEXT_CODEPOINTS} code points`) };
    if (lineCount > MAX_LINES) return { error: fail('too-many-lines', `最大${MAX_LINES}行`) };
    const fontSize = clamp(input?.fontSize, 8, 512, 64);
    const tracking = clamp(input?.tracking, -fontSize, fontSize * 4, 0);
    const lineHeight = clamp(input?.lineHeight, 0.8, 3, 1.25);
    return {
        value: {
            text,
            codePoints,
            fontKind: String(input?.fontKind || 'imported'),
            fontId: String(input?.fontId || '').trim(),
            fontFamily: String(input?.fontFamily || 'sans-serif').replace(/["'\\<>;{}]/g, '').slice(0, 120),
            fontSize,
            endFontSize: input?.endFontSize == null ? null : clamp(input.endFontSize, 8, 512, fontSize),
            vertical: input?.vertical === true,
            tracking,
            lineHeight,
            bold: input?.bold === true
            , sizeProfile: input?.sizeProfile || null,
            characterStyles: Array.isArray(input?.characterStyles) ? input.characterStyles : []
        }
    };
}

function shapeKey(params, fontId, format) {
    return JSON.stringify({
        id: fontId,
        format,
        text: params.text,
        size: params.fontSize,
        endSize: params.endFontSize,
        vertical: params.vertical,
        tracking: params.tracking,
        lineHeight: params.lineHeight,
        bold: params.bold
        , sizeProfile: params.sizeProfile,
        characterStyles: params.characterStyles.map(style => ({ start:style.start,end:style.end,fontId:style.fontId,size:style.size }))
    });
}

function featuresFor(hb, vertical) {
    if (!vertical || typeof hb.Feature?.fromString !== 'function') return [];
    return ['vert=1', 'vrt2=1'].map(value => hb.Feature.fromString(value)).filter(Boolean);
}

function transformGlyphPath(path, horizontal, penX, penY, position, baselineY) {
    const xOffset = finite(position?.xOffset);
    const yOffset = finite(position?.yOffset);
    if (horizontal) {
        return transformSvgPath(path, (x, y) => ({
            x: x + penX + xOffset,
            y: baselineY - (y + yOffset)
        }));
    }
    return transformSvgPath(path, (x, y) => ({
        x: x + penX + xOffset,
        y: -(y + penY + yOffset)
    }));
}

function lineEntries(entries) {
    const lines = [];
    let current = [];
    for (const entry of entries) {
        if (entry.character === '\n') {
            lines.push(current);
            current = [];
        } else {
            current.push(entry);
        }
    }
    lines.push(current);
    return lines;
}

function unionBounds(bounds, next) {
    if (!next) return bounds;
    if (!bounds) return { ...next };
    const minX = Math.min(bounds.x, next.x);
    const minY = Math.min(bounds.y, next.y);
    const maxX = Math.max(bounds.x + bounds.width, next.x + next.width);
    const maxY = Math.max(bounds.y + bounds.height, next.y + next.height);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function translatePath(path, dx, dy) {
    return transformSvgPath(path, (x, y) => ({ x: x + dx, y: y + dy }));
}

async function shapeImported(params, options) {
    if (params.sizeProfile || params.characterStyles.length) return shapeStyledImported(params, options);
    if (!params.fontId) return fail('font-id-required', 'imported fontId is empty');
    const fontLibrary = await resolveFontLibrary(options);
    if (!fontLibrary) return fail('font-library-unavailable');
    let entry;
    try {
        entry = await fontLibrary.ensureLoaded(params.fontId);
    } catch (error) {
        return fail('font-load-failed', error?.message || `fontId=${params.fontId}`);
    }
    if (!entry?.data) return fail('font-load-failed', `fontId=${params.fontId}`);
    const loaded = await getFontRecord(fontLibrary, params.fontId, entry);
    if (loaded.error) return loaded.error;
    const { record } = loaded;
    const key = shapeKey(params, params.fontId, record.format);
    const shapeCache = shapeCacheFor(fontLibrary);
    const cached = shapeCache.get(key);
    if (cached) {
        shapeCache.delete(key);
        shapeCache.set(key, cached);
        return cloneShape(cached);
    }
    const { hb } = record;
    try {
        const font = new hb.Font(record.face);
        font.setScale(params.fontSize, params.fontSize);
        const extents = params.vertical ? font.vExtents() : font.hExtents();
        const ascender = finite(extents?.ascender, params.fontSize);
        const lineHeightPx = params.fontSize * params.lineHeight;
        const horizontal = !params.vertical;
        const glyphs = [];
        let rawBounds = null;
        let maxAdvance = 0;
        let penX = 0;
        let penY = 0;
        let lineIndex = 0;
        const lines = lineEntries(params.codePoints);
        const units = segmentLetteringText(params.text);
        for (const line of lines) {
            const buffer = new hb.Buffer();
            for (const entryItem of line) buffer.add(entryItem.codePoint, entryItem.index);
            if (horizontal) {
                buffer.setDirection(hb.Direction.LTR);
            } else {
                buffer.setDirection(hb.Direction.TTB);
            }
            buffer.setScript('hani');
            buffer.setLanguage('ja');
            hb.shape(font, buffer, featuresFor(hb, params.vertical));
            const infos = buffer.getGlyphInfos();
            const positions = buffer.getGlyphPositions();
            const clusters = [...new Set(infos.map(info => info.cluster))].sort((a, b) => a - b);
            const baselineY = horizontal ? ascender + lineIndex * lineHeightPx : 0;
            for (let index = 0; index < infos.length; index += 1) {
                const info = infos[index];
                const position = positions[index] || {};
                const sourceEntry = params.codePoints.find(item => item.index === info.cluster) || line[0];
                const codePoint = sourceEntry?.codePoint || 0;
                const unit = units.find(item => item.start <= (sourceEntry?.start ?? 0) && item.end > (sourceEntry?.start ?? 0));
                const nextCluster = clusters.find(value => value > info.cluster);
                const nextEntry = params.codePoints.find(item => item.index === nextCluster);
                const rangeEnd = nextEntry?.start ?? line.at(-1)?.end ?? unit?.end ?? 0;
                const endUnit = units.find(item => item.start < rangeEnd && item.end >= rangeEnd);
                const advanceValue = horizontal ? finite(position.xAdvance) : -finite(position.yAdvance);
                const advance = Math.max(0, advanceValue) + (advanceValue !== 0 ? params.tracking : 0);
                if (info.codepoint === 0 && !isWhitespace(codePoint)) {
                    return fail('missing-glyph', `${formatCodePoint(codePoint)} at cluster ${info.cluster}`);
                }
                const path = info.codepoint === 0 ? '' : font.glyphToPath(info.codepoint);
                const transformedPath = path
                    ? transformGlyphPath(path, horizontal, penX, penY, position, baselineY)
                    : '';
                const pathBox = pathBounds(transformedPath);
                if (pathBox) rawBounds = unionBounds(rawBounds, pathBox);
                const glyph = {
                    path: transformedPath,
                    x: horizontal ? penX + advanceValue * 0.5 : penX + finite(position.xOffset),
                    y: horizontal ? baselineY : -(penY + finite(position.yOffset) + advanceValue * 0.5),
                    advance,
                    cluster: info.cluster,
                    codePoint,
                    axis: horizontal ? 'x' : 'y'
                    , start: unit?.start ?? sourceEntry?.start ?? 0,
                    end: endUnit?.end ?? rangeEnd,
                    line: lineIndex
                };
                glyphs.push(glyph);
                if (horizontal) {
                    penX += advance;
                    maxAdvance = Math.max(maxAdvance, penX);
                } else {
                    penY += finite(position.yAdvance) - (advanceValue !== 0 ? params.tracking : 0);
                    maxAdvance = Math.max(maxAdvance, -penY);
                }
            }
            if (horizontal) {
                lineIndex += 1;
                penX = 0;
            } else {
                lineIndex += 1;
                penY = 0;
                penX += lineHeightPx;
            }
        }
        const fallbackBounds = horizontal
            ? { x: 0, y: 0, width: maxAdvance, height: Math.max(params.fontSize, lines.length * lineHeightPx) }
            : { x: 0, y: 0, width: Math.max(params.fontSize, lines.length * lineHeightPx), height: maxAdvance };
        const bounds = rawBounds || fallbackBounds;
        const measuredBounds = {
            x: Math.min(bounds.x, fallbackBounds.x),
            y: Math.min(bounds.y, fallbackBounds.y),
            width: Math.max(bounds.x + bounds.width, fallbackBounds.x + fallbackBounds.width) - Math.min(bounds.x, fallbackBounds.x),
            height: Math.max(bounds.y + bounds.height, fallbackBounds.y + fallbackBounds.height) - Math.min(bounds.y, fallbackBounds.y)
        };
        const centerX = measuredBounds.x + measuredBounds.width / 2;
        const centerY = measuredBounds.y + measuredBounds.height / 2;
        const centeredGlyphs = glyphs.map(glyph => ({
            ...glyph,
            path: glyph.path ? translatePath(glyph.path, -centerX, -centerY) : '',
            x: glyph.x - centerX,
            y: glyph.y - centerY
        }));
        const result = {
            ok: true,
            glyphs: centeredGlyphs,
            width: Math.max(0, measuredBounds.width),
            height: Math.max(0, measuredBounds.height),
            bounds: { x: -measuredBounds.width / 2, y: -measuredBounds.height / 2, width: measuredBounds.width, height: measuredBounds.height },
            sourceBounds: { x: -measuredBounds.width / 2, y: -measuredBounds.height / 2, width: measuredBounds.width, height: measuredBounds.height },
            baselineY: ascender - centerY,
            verticalLineX: -centerX,
            engine: `harfbuzzjs-${HARFBUZZ_PACKAGE_VERSION}`
        };
        shapeCache.set(key, result);
        clearShapeCache(shapeCache);
        return cloneShape(result);
    } catch (error) {
        return fail('font-shaping-failed', error?.message || 'HarfBuzz shape failed');
    }
}

/** Shape continuous font runs, then place whole clusters with scaled advances.
 * Styling boundaries never split a combining grapheme; only font changes split
 * shaping runs, preserving kerning/ligatures for adjacent same-font characters.
 */
async function shapeStyledImported(params, options) {
    if (!params.fontId) return fail('font-id-required', 'imported fontId is empty');
    const library = await resolveFontLibrary(options);
    if (!library) return fail('font-library-unavailable');
    const cache = shapeCacheFor(library);
    const key = shapeKey(params, params.fontId, 'styled');
    const withCurrentStyles = value => {
        const result = cloneShape(value);
        if (result?.ok) result.glyphs = result.glyphs.map(glyph => ({ ...glyph, style: structuredClone(characterStyleAt(params.characterStyles, glyph.start) || {}) }));
        return result;
    };
    if (cache.has(key)) {
        const result = cache.get(key); cache.delete(key); cache.set(key,result);
        return withCurrentStyles(result);
    }
    const records = new Map();
    const resolve = async id => {
        if (records.has(id)) return records.get(id);
        let entry;
        try { entry = await library.ensureLoaded(id); } catch (error) { return { error: fail('font-load-failed', `${id}: ${error?.message || ''}`) }; }
        if (!entry?.data) return { error: fail('font-load-failed', `fontId=${id}`) };
        const value = await getFontRecord(library, id, entry);
        records.set(id, value);
        return value;
    };
    const base = await resolve(params.fontId);
    if (base.error) return base.error;
    try {
        const units = segmentLetteringText(params.text);
        const horizontal = !params.vertical;
        const baseFont = new base.record.hb.Font(base.record.face);
        baseFont.setScale(params.fontSize, params.fontSize);
        const ascender = finite((horizontal ? baseFont.hExtents() : baseFont.vExtents())?.ascender, params.fontSize);
        const lineHeightPx = params.fontSize * params.lineHeight;
        const lines = lineEntries(params.codePoints);
        const glyphs = [];
        let rawBounds = null, maxAdvance = 0;
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
            const line = lines[lineIndex];
            const runs = [];
            const scriptOf = character => /\p{Script=Latin}/u.test(character) ? 'latn'
                : /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(character) ? 'hani' : null;
            const initialScript = line.map(entry => scriptOf(entry.character)).find(Boolean) || 'hani';
            for (const entry of line) {
                const unit = units.find(item => item.start <= entry.start && entry.start < item.end);
                const id = characterStyleAt(params.characterStyles, unit?.start ?? entry.start)?.fontId || params.fontId;
                const last = runs.at(-1);
                const script = scriptOf(entry.character) || last?.script || initialScript;
                if (last?.fontId === id && last.script === script) last.entries.push(entry);
                else runs.push({ fontId: id, script, entries: [entry] });
            }
            const groups = [];
            for (const run of runs) {
                const loaded = await resolve(run.fontId);
                if (loaded.error) return loaded.error;
                const { hb } = loaded.record;
                const font = new hb.Font(loaded.record.face);
                font.setScale(params.fontSize, params.fontSize);
                const buffer = new hb.Buffer();
                for (const entry of run.entries) buffer.add(entry.codePoint, entry.index);
                buffer.setDirection(horizontal ? hb.Direction.LTR : hb.Direction.TTB);
                buffer.setScript(run.script); buffer.setLanguage(run.script === 'latn' ? 'en' : 'ja');
                hb.shape(font, buffer, featuresFor(hb, params.vertical));
                const infos = buffer.getGlyphInfos(), positions = buffer.getGlyphPositions();
                const clusterIds = [...new Set(infos.map(info => info.cluster))].sort((a, b) => a - b);
                for (let index = 0; index < infos.length; index += 1) {
                    const info = infos[index], position = positions[index] || {};
                    const entry = params.codePoints[info.cluster] || run.entries[0];
                    if (info.codepoint === 0 && !isWhitespace(entry.codePoint)) return fail('missing-glyph', `${run.fontId}: ${formatCodePoint(entry.codePoint)} at cluster ${info.cluster}`);
                    const startUnit = units.find(unit => unit.start <= entry.start && entry.start < unit.end);
                    const nextCluster = clusterIds.find(value => value > info.cluster);
                    const rawEnd = params.codePoints[nextCluster]?.start ?? run.entries.at(-1).end;
                    const endUnit = units.find(unit => unit.start < rawEnd && rawEnd <= unit.end);
                    const start = startUnit?.start ?? entry.start, end = endUnit?.end ?? rawEnd;
                    let group = groups.at(-1);
                    if (!group || group.start !== start || group.end !== end || group.fontId !== run.fontId) {
                        group = { start, end, fontId: run.fontId, cluster: info.cluster, codePoint: entry.codePoint, glyphs: [], style: characterStyleAt(params.characterStyles, start) || {} };
                        groups.push(group);
                    }
                    group.glyphs.push({ path: info.codepoint ? font.glyphToPath(info.codepoint) : '', position });
                }
            }
            let pen = 0;
            for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
                const group = groups[groupIndex];
                const progress = groups.length <= 1 ? 0 : groupIndex / (groups.length - 1);
                const sizeScale = profileScale(params.sizeProfile, progress) * clamp(group.style.size, 0.125, 8, 1);
                const totalNatural = group.glyphs.reduce((sum, item) => sum + (horizontal ? finite(item.position.xAdvance) : -finite(item.position.yAdvance)), 0);
                const totalAdvance = Math.max(0, totalNatural) * sizeScale + (totalNatural !== 0 ? params.tracking : 0);
                const baselineY = horizontal ? ascender + lineIndex * lineHeightPx : 0;
                const lineX = horizontal ? 0 : lineIndex * lineHeightPx;
                let within = 0;
                for (const item of group.glyphs) {
                    const position = item.position;
                    const path = item.path ? transformSvgPath(item.path, (x, y) => ({
                        x: horizontal ? pen + within + (x + finite(position.xOffset)) * sizeScale : lineX + (x + finite(position.xOffset)) * sizeScale,
                        y: horizontal ? baselineY - (y + finite(position.yOffset)) * sizeScale : pen + within - (y + finite(position.yOffset)) * sizeScale
                    })) : '';
                    rawBounds = unionBounds(rawBounds, pathBounds(path));
                    glyphs.push({ path, x: horizontal ? pen + totalNatural * sizeScale / 2 : lineX,
                        y: horizontal ? baselineY : pen + totalNatural * sizeScale / 2,
                        lineBaselineY: baselineY, lineX, advance: totalAdvance, cluster: group.cluster,
                        codePoint: group.codePoint, axis: horizontal ? 'x' : 'y', start: group.start, end: group.end,
                        line: lineIndex, style: { ...group.style }, fontId: group.fontId, sizeApplied: !!params.sizeProfile });
                    within += (horizontal ? finite(position.xAdvance) : -finite(position.yAdvance)) * sizeScale;
                }
                pen += totalAdvance;
            }
            maxAdvance = Math.max(maxAdvance, pen);
        }
        const fallback = horizontal ? { x: 0, y: 0, width: maxAdvance, height: Math.max(params.fontSize, lines.length * lineHeightPx) }
            : { x: 0, y: 0, width: Math.max(params.fontSize, lines.length * lineHeightPx), height: maxAdvance };
        const bounds = unionBounds(fallback, rawBounds) || fallback;
        const centerX = bounds.x + bounds.width / 2, centerY = bounds.y + bounds.height / 2;
        const centered = glyphs.map(glyph => ({ ...glyph, path: glyph.path ? translatePath(glyph.path, -centerX, -centerY) : '',
            x: glyph.x - centerX, y: glyph.y - centerY, lineBaselineY: glyph.lineBaselineY - centerY, lineX: glyph.lineX - centerX }));
        const result = { ok: true, glyphs: centered, width: bounds.width, height: bounds.height,
            bounds: { x: -bounds.width / 2, y: -bounds.height / 2, width: bounds.width, height: bounds.height },
            sourceBounds: { x: -bounds.width / 2, y: -bounds.height / 2, width: bounds.width, height: bounds.height },
            baselineY: ascender - centerY, verticalLineX: -centerX, engine: `harfbuzzjs-${HARFBUZZ_PACKAGE_VERSION}` };
        cache.set(key, result); clearShapeCache(cache);
        return withCurrentStyles(result);
    } catch (error) { return fail('font-shaping-failed', error?.message || 'HarfBuzz style runs failed'); }
}

/**
 * Shape imported/bundled font bytes. System fonts deliberately stop here; the
 * vector renderer routes them to the existing browser paragraph rasterizer.
 */
export async function shapeLettering(input = {}, options = {}) {
    const normalized = normalizedParams(input);
    if (normalized.error) return normalized.error;
    const params = normalized.value;
    if (params.fontKind === 'system') {
        return fail('system-font-vector-unsupported', 'OS font bytes are unavailable for outline shaping');
    }
    if (!['imported', 'bundled'].includes(params.fontKind)) {
        return fail('font-kind-unsupported', params.fontKind);
    }
    return shapeImported(params, options);
}

