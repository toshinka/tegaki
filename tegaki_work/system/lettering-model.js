/**
 * ============================================================================
 * ファイル名: system/lettering-model.js
 * 責務: 再編集文字paramsの既定値、UI入力の正規化、保存境界の厳格な検証。
 * 依存: system/editable-curve-geometry.js（既定pathの形だけを共有）
 * 被依存: lettering popup/renderer、Project adapter、build verifier
 * 公開API: defaultLetteringParams, normalizeLetteringParams, sanitizeLetteringData
 * 保存: `lettering: { version: 1, params, fingerprint }` の値だけを返す。
 *       fingerprintは確定画素との整合確認に使うmetadataであり、glyph/cache/UI値は含めない。
 * ============================================================================
 */

import { createCurvePreset } from './editable-curve-geometry.js';
import { segmentLetteringText, applyCharacterStyle, LETTERING_CHARACTER_ATTRIBUTES } from './lettering-character-styles.js';

const VERSION = 1;
const MAX_TEXT_LENGTH = 2000;
const MAX_LINES = 32;
const MAX_NODES = 64;
const MAX_ID_LENGTH = 120;
const MAX_FONT_FAMILY_LENGTH = 160;
const MAX_HASH_LENGTH = 256;
const MAX_COORDINATE = 1e7;
const MAX_SCALE = 64;
const MAX_DIMENSION = 1e6;

const FONT_KINDS = new Set(['imported', 'system']);
const BASELINE_KINDS = new Set(['none', 'straight', 'wave', 'ellipse', 'polyline', 'free']);
const ENVELOPE_KINDS = new Set(['none', 'skew', 'perspective', 'arc', 'wave', 'bulge', 'taper', 'points']);

const DEFAULT_LINE_COLOR = '#800000';
const DEFAULT_STROKE_COLOR = '#ffffee';

function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function finite(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
}

function canvasSize(canvas) {
    return {
        width: clamp(canvas?.width, 1, MAX_DIMENSION, 400),
        height: clamp(canvas?.height, 1, MAX_DIMENSION, 400)
    };
}

function boundedString(value, fallback, maxLength) {
    if (typeof value !== 'string') return fallback;
    return value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, maxLength);
}

function boundedText(value, fallback) {
    if (typeof value !== 'string') return fallback;
    // Keep CR/LF for paragraph structure; remove the remaining C0 controls.
    return value.replace(/[\u0000-\u0009\u000b-\u000c\u000e-\u001f\u007f]/g, '').slice(0, MAX_TEXT_LENGTH);
}

function normalizeColor(value, fallback) {
    return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
}

function normalizeText(value, fallback) {
    const text = boundedText(value, fallback).replace(/\r\n?/g, '\n');
    return text.split('\n').slice(0, MAX_LINES).join('\n').slice(0, MAX_TEXT_LENGTH);
}

function normalizeId(value, index) {
    const raw = typeof value === 'string' || typeof value === 'number' ? String(value) : `node-${index}`;
    return boundedString(raw, `node-${index}`, MAX_ID_LENGTH) || `node-${index}`;
}

function finiteCoordinate(value, fallback = 0) {
    return clamp(value, -MAX_COORDINATE, MAX_COORDINATE, fallback);
}

function normalizeOffset(value) {
    return {
        x: finiteCoordinate(value?.x),
        y: finiteCoordinate(value?.y)
    };
}

function normalizePath(rawPath) {
    const src = isPlainObject(rawPath) ? rawPath : {};
    const sourceNodes = Array.isArray(src.nodes) ? src.nodes : [];
    const nodes = [];
    const usedIds = new Set();
    for (let index = 0; index < Math.min(MAX_NODES, sourceNodes.length); index += 1) {
        const source = isPlainObject(sourceNodes[index]) ? sourceNodes[index] : {};
        const baseId = normalizeId(source.id, index);
        let id = baseId;
        let suffix = 1;
        while (usedIds.has(id)) {
            id = `${baseId}-${suffix}`;
            suffix += 1;
        }
        usedIds.add(id);
        nodes.push({
            id,
            x: finiteCoordinate(source.x),
            y: finiteCoordinate(source.y),
            in: normalizeOffset(source.in),
            out: normalizeOffset(source.out),
            smooth: source.smooth === true
        });
    }
    return { closed: src.closed === true, nodes };
}

function normalizeBaseline(rawBaseline) {
    const src = isPlainObject(rawBaseline) ? rawBaseline : {};
    const kind = BASELINE_KINDS.has(src.kind) ? src.kind : 'none';
    return { kind, path: normalizePath(src.path) };
}

function normalizeEnvelope(rawEnvelope) {
    const src = isPlainObject(rawEnvelope) ? rawEnvelope : {};
    let kind = ENVELOPE_KINDS.has(src.kind) ? src.kind : 'none';
    const amount = clamp(src.amount, -4, 4, 0);
    let points = null;
    if (Array.isArray(src.points) && src.points.length === 9) {
        const normalized = src.points.map(point => ({
            x: clamp(point?.x, -4, 4, NaN),
            y: clamp(point?.y, -4, 4, NaN)
        }));
        if (normalized.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))) points = normalized;
    }
    if (kind === 'points' && !points) kind = 'none';
    if (kind !== 'points') points = null;
    return { kind, amount, points };
}

function normalizeScale(value, fallback = 1) {
    const number = clamp(value, -MAX_SCALE, MAX_SCALE, fallback);
    if (Math.abs(number) >= 0.01) return number;
    return number < 0 ? -0.01 : 0.01;
}

function normalizePlacement(rawPlacement, canvas) {
    const src = isPlainObject(rawPlacement) ? rawPlacement : {};
    const coordinateLimit = Math.max(4096, Math.max(canvas.width, canvas.height) * 16);
    return {
        x: clamp(src.x, -coordinateLimit, coordinateLimit, canvas.width / 2),
        y: clamp(src.y, -coordinateLimit, coordinateLimit, canvas.height / 2),
        rotation: clamp(src.rotation, -1e6, 1e6, 0),
        scaleX: normalizeScale(src.scaleX, 1),
        scaleY: normalizeScale(src.scaleY, 1)
    };
}

/** Create the stable model shape used by a new lettering session. */
export function defaultLetteringParams(canvas = { width: 400, height: 400 }) {
    const size = canvasSize(canvas);
    return {
        text: 'タイトル',
        fontKind: 'imported',
        fontId: '',
        fontFamily: 'sans-serif',
        fontSize: 64,
        endFontSize: null,
        bold: false,
        vertical: false,
        tracking: 0,
        lineHeight: 1.25,
        color: DEFAULT_LINE_COLOR,
        strokeColor: DEFAULT_STROKE_COLOR,
        strokeWidth: 0,
        outerStrokeWidth: 0,
        outerStrokeColor: DEFAULT_LINE_COLOR,
        sizeProfile: null,
        characterStyles: [],
        placement: { x: size.width / 2, y: size.height / 2, rotation: 0, scaleX: 1, scaleY: 1 },
        baseline: { kind: 'none', path: createCurvePreset('none') },
        envelope: { kind: 'none', amount: 0, points: null }
    };
}

/**
 * Normalize an editor/UI value. This function is intentionally forgiving for
 * live controls; the save boundary below is strict and never turns a malformed
 * persisted object into a newly authored default.
 */
export function normalizeLetteringParams(input, canvas = { width: 400, height: 400 }) {
    const size = canvasSize(canvas);
    const defaults = defaultLetteringParams(size);
    const src = isPlainObject(input) ? input : {};
    const text = normalizeText(src.text, defaults.text);
    return {
        text,
        fontKind: FONT_KINDS.has(src.fontKind) ? src.fontKind : defaults.fontKind,
        fontId: boundedString(src.fontId, defaults.fontId, MAX_ID_LENGTH),
        fontFamily: boundedString(src.fontFamily, defaults.fontFamily, MAX_FONT_FAMILY_LENGTH)
            .replace(/[\'"\\<>;{}]/g, '') || defaults.fontFamily,
        fontSize: clamp(src.fontSize, 8, 512, defaults.fontSize),
        endFontSize: src.endFontSize == null ? null : clamp(src.endFontSize, 8, 512, defaults.fontSize),
        bold: src.bold === true,
        vertical: src.vertical === true,
        tracking: clamp(src.tracking, -256, 256, defaults.tracking),
        lineHeight: clamp(src.lineHeight, 0.25, 8, defaults.lineHeight),
        color: normalizeColor(src.color, defaults.color),
        strokeColor: normalizeColor(src.strokeColor, defaults.strokeColor),
        strokeWidth: clamp(src.strokeWidth, 0, 64, defaults.strokeWidth),
        outerStrokeWidth: clamp(src.outerStrokeWidth, 0, 64, 0),
        outerStrokeColor: normalizeColor(src.outerStrokeColor, DEFAULT_LINE_COLOR),
        sizeProfile: isPlainObject(src.sizeProfile) ? {
            mode: src.sizeProfile.mode === 'three' ? 'three' : 'ends',
            start: clamp(src.sizeProfile.start, 0.125, 8, 1),
            mid: clamp(src.sizeProfile.mid, 0.125, 8, 1),
            end: clamp(src.sizeProfile.end, 0.125, 8, 1)
        } : null,
        characterStyles: normalizeCharacterStyles(text, src.characterStyles),
        placement: normalizePlacement(src.placement, size),
        baseline: normalizeBaseline(src.baseline),
        envelope: normalizeEnvelope(src.envelope)
    };
}

function normalizeCharacterStyles(text, styles) {
    if (!Array.isArray(styles)) return [];
    const result = [];
    for (const style of styles.slice(0, 2000)) {
        if (!isPlainObject(style)) continue;
        const values = {};
        for (const key of LETTERING_CHARACTER_ATTRIBUTES) {
            if (style[key] == null) continue;
            if (key === 'fontId') values[key] = boundedString(style[key], '', MAX_ID_LENGTH);
            else if (key === 'color') values[key] = normalizeColor(style[key], DEFAULT_LINE_COLOR);
            else if (key === 'envelope') values[key] = normalizeEnvelope(style[key]);
            else if (key === 'size') values[key] = clamp(style[key], 0.125, 8, 1);
            else if (key === 'scaleX' || key === 'scaleY') values[key] = normalizeScale(clamp(style[key], -20, 20, 1));
            else if (key === 'rotation') values[key] = clamp(style[key], -1e6, 1e6, 0);
            else values[key] = clamp(style[key], -8192, 8192, 0);
        }
        if (Number.isFinite(style.start) && Number.isFinite(style.end) && style.end > style.start) result.push({ start: style.start, end: style.end, ...values });
    }
    return applyCharacterStyle(text, result, 0, 0, {});
}

function validNewEnvelope(value) {
    return isPlainObject(value) && ENVELOPE_KINDS.has(value.kind)
        && isFiniteNumber(value.amount) && Math.abs(value.amount) <= 4
        && (value.points === null || (Array.isArray(value.points) && value.points.length === 9
            && value.points.every(point => validRawOffset(point) && Math.abs(point.x) <= 4 && Math.abs(point.y) <= 4)))
        && (value.kind !== 'points' || Array.isArray(value.points));
}

function validNewAttributes(params) {
    if (Object.hasOwn(params, 'outerStrokeWidth') && (!isFiniteNumber(params.outerStrokeWidth) || params.outerStrokeWidth < 0 || params.outerStrokeWidth > 64)) return false;
    if (Object.hasOwn(params, 'outerStrokeColor') && (typeof params.outerStrokeColor !== 'string' || !/^#[0-9a-f]{6}$/i.test(params.outerStrokeColor))) return false;
    if (Object.hasOwn(params, 'sizeProfile') && params.sizeProfile !== null) {
        const profile = params.sizeProfile;
        if (!isPlainObject(profile) || !['ends', 'three'].includes(profile.mode)
            || !['start', 'mid', 'end'].every(key => isFiniteNumber(profile[key]) && profile[key] >= 0.125 && profile[key] <= 8)) return false;
    }
    if (!Object.hasOwn(params, 'characterStyles')) return true;
    if (!Array.isArray(params.characterStyles) || params.characterStyles.length > 2000) return false;
    const boundaries = new Set([0, params.text.length, ...segmentLetteringText(params.text).flatMap(unit => [unit.start, unit.end])]);
    let previousEnd = 0;
    for (const style of params.characterStyles) {
        if (!isPlainObject(style) || !Number.isInteger(style.start) || !Number.isInteger(style.end)
            || style.start < previousEnd || style.end <= style.start || !boundaries.has(style.start) || !boundaries.has(style.end)) return false;
        previousEnd = style.end;
        if (!Object.keys(style).every(key => key === 'start' || key === 'end' || LETTERING_CHARACTER_ATTRIBUTES.includes(key))) return false;
        if (Object.hasOwn(style, 'fontId') && (!validBoundedString(style.fontId, MAX_ID_LENGTH, false) || params.fontKind !== 'imported')) return false;
        if (Object.hasOwn(style, 'color') && (typeof style.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(style.color))) return false;
        if (Object.hasOwn(style, 'envelope') && !validNewEnvelope(style.envelope)) return false;
        for (const key of ['size', 'rotation', 'scaleX', 'scaleY', 'offsetX', 'offsetY']) {
            if (!Object.hasOwn(style, key)) continue;
            if (!isFiniteNumber(style[key])) return false;
            if (key === 'size' && (style[key] < 0.125 || style[key] > 8)) return false;
            if (key === 'rotation' && Math.abs(style[key]) > 1e6) return false;
            if ((key === 'scaleX' || key === 'scaleY') && (Math.abs(style[key]) < 0.01 || Math.abs(style[key]) > 20)) return false;
            if ((key === 'offsetX' || key === 'offsetY') && Math.abs(style[key]) > 8192) return false;
        }
    }
    return true;
}

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function validBoundedString(value, maxLength, allowEmpty = true, allowNewlines = false) {
    const controlPattern = allowNewlines
        ? /[\u0000-\u0009\u000b-\u000c\u000e-\u001f\u007f]/
        : /[\u0000-\u001f\u007f]/;
    return typeof value === 'string'
        && value.length <= maxLength
        && (allowEmpty || value.length > 0)
        && !controlPattern.test(value);
}

function validRawOffset(value) {
    return isPlainObject(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y)
        && Math.abs(value.x) <= MAX_COORDINATE && Math.abs(value.y) <= MAX_COORDINATE;
}

function validRawPath(path) {
    if (!isPlainObject(path) || typeof path.closed !== 'boolean' || !Array.isArray(path.nodes) || path.nodes.length > MAX_NODES) return false;
    return path.nodes.every(node => isPlainObject(node)
        && (typeof node.id === 'string' || typeof node.id === 'number')
        && validBoundedString(String(node.id), MAX_ID_LENGTH, false)
        && isFiniteNumber(node.x) && isFiniteNumber(node.y)
        && Math.abs(node.x) <= MAX_COORDINATE && Math.abs(node.y) <= MAX_COORDINATE
        && validRawOffset(node.in) && validRawOffset(node.out)
        && typeof node.smooth === 'boolean');
}

function validRawParams(params) {
    if (!isPlainObject(params)) return false;
    const required = [
        'text', 'fontKind', 'fontId', 'fontFamily', 'fontSize', 'endFontSize', 'bold', 'vertical',
        'tracking', 'lineHeight', 'color', 'strokeColor', 'strokeWidth', 'placement', 'baseline', 'envelope'
    ];
    if (!required.every(key => Object.prototype.hasOwnProperty.call(params, key))) return false;
    if (!validBoundedString(params.text, MAX_TEXT_LENGTH, true, true) || params.text.split(/\r\n?|\n/).length > MAX_LINES) return false;
    if (!validNewAttributes(params)) return false;
    if (!validBoundedString(params.fontKind, 32, false) || !validBoundedString(params.fontId, MAX_ID_LENGTH)) return false;
    if (!validBoundedString(params.fontFamily, MAX_FONT_FAMILY_LENGTH)) return false;
    if (!isFiniteNumber(params.fontSize) || !isFiniteNumber(params.tracking) || !isFiniteNumber(params.lineHeight) || !isFiniteNumber(params.strokeWidth)) return false;
    if (params.endFontSize !== null && !isFiniteNumber(params.endFontSize)) return false;
    if (typeof params.bold !== 'boolean' || typeof params.vertical !== 'boolean') return false;
    if (!/^#[0-9a-f]{6}$/i.test(params.color) || !/^#[0-9a-f]{6}$/i.test(params.strokeColor)) return false;
    if (!isPlainObject(params.placement)) return false;
    if (!['x', 'y', 'rotation', 'scaleX', 'scaleY'].every(key => isFiniteNumber(params.placement[key]))) return false;
    if (Math.abs(params.placement.x) > MAX_COORDINATE || Math.abs(params.placement.y) > MAX_COORDINATE
        || Math.abs(params.placement.rotation) > 1e6 || Math.abs(params.placement.scaleX) > MAX_SCALE
        || Math.abs(params.placement.scaleY) > MAX_SCALE || Math.abs(params.placement.scaleX) < 0.01
        || Math.abs(params.placement.scaleY) < 0.01) return false;
    if (!isPlainObject(params.baseline) || !validBoundedString(params.baseline.kind, 32, false) || !validRawPath(params.baseline.path)) return false;
    if (!isPlainObject(params.envelope) || !validBoundedString(params.envelope.kind, 32, false) || !isFiniteNumber(params.envelope.amount)) return false;
    if (params.envelope.points !== null && (!Array.isArray(params.envelope.points) || params.envelope.points.length !== 9
        || !params.envelope.points.every(point => validRawOffset(point) && Math.abs(point.x) <= 4 && Math.abs(point.y) <= 4))) return false;
    return true;
}

function validFingerprint(fingerprint) {
    if (!isPlainObject(fingerprint) || !validBoundedString(fingerprint.hash, MAX_HASH_LENGTH, false)) return false;
    if (!isFiniteNumber(fingerprint.width) || !isFiniteNumber(fingerprint.height)
        || !Number.isInteger(fingerprint.width) || !Number.isInteger(fingerprint.height)
        || fingerprint.width < 1 || fingerprint.height < 1 || fingerprint.width > MAX_DIMENSION || fingerprint.height > MAX_DIMENSION) return false;
    const bounds = fingerprint.rasterBounds;
    if (!isPlainObject(bounds)) return false;
    return ['x', 'y', 'width', 'height'].every(key => isFiniteNumber(bounds[key]))
        && Math.abs(bounds.x) <= MAX_COORDINATE && Math.abs(bounds.y) <= MAX_COORDINATE
        && bounds.width >= 0 && bounds.height >= 0 && bounds.width <= MAX_DIMENSION && bounds.height <= MAX_DIMENSION;
}

function cloneFingerprint(fingerprint) {
    return {
        hash: fingerprint.hash,
        width: fingerprint.width,
        height: fingerprint.height,
        rasterBounds: {
            x: fingerprint.rasterBounds.x,
            y: fingerprint.rasterBounds.y,
            width: fingerprint.rasterBounds.width,
            height: fingerprint.rasterBounds.height
        }
    };
}

/**
 * Strict Project boundary. A wrong version, malformed params, invalid finite
 * values, or invalid fingerprint returns null; no default params are authored.
 * Enum strings remain recoverable through normalizeLetteringParams, as enums
 * are explicitly allowed to fall back to their safe default.
 */
export function sanitizeLetteringData(raw, canvas = { width: 400, height: 400 }) {
    if (!isPlainObject(raw) || raw.version !== VERSION || !validRawParams(raw.params) || !validFingerprint(raw.fingerprint)) return null;
    const params = normalizeLetteringParams(raw.params, canvas);
    return { version: VERSION, params, fingerprint: cloneFingerprint(raw.fingerprint) };
}

