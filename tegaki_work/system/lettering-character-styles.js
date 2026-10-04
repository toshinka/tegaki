/**
 * Runtime/persisted range helpers for editable lettering. Text remains the sole
 * source of characters; all ranges are UTF-16 grapheme boundaries, not glyph IDs.
 */
const ATTRIBUTES = ['fontId', 'color', 'size', 'rotation', 'scaleX', 'scaleY', 'offsetX', 'offsetY', 'envelope', 'strokeWidth', 'strokeColor', 'outerStrokeWidth', 'outerStrokeColor'];
const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('ja', { granularity: 'grapheme' }) : null;

export function segmentLetteringText(text = '') {
    const source = String(text);
    const segments = segmenter ? [...segmenter.segment(source)].map(item => ({ text: item.segment, start: item.index }))
        : [...source].reduce((items, character) => { items.push({ text: character, start: items.length ? items.at(-1).start + items.at(-1).text.length : 0 }); return items; }, []);
    let line = 0;
    let index = 0;
    return segments.map(item => {
        const unit = { ...item, end: item.start + item.text.length, line, index };
        if (/\r|\n/.test(item.text)) { line += 1; index = 0; } else index += 1;
        return unit;
    });
}

export function characterStyleAt(styles = [], start = 0) {
    return styles.find(style => style.start <= start && start < style.end) || null;
}

function attributes(style) {
    const result = {};
    const bounded = (value, min, max) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : null;
    for (const key of ATTRIBUTES) {
        const value = style?.[key];
        if (value == null) continue;
        if (key === 'fontId') {
            if (typeof value === 'string' && value && !/[\u0000-\u001f\u007f]/.test(value)) result[key] = value.slice(0,120);
        } else if (['color', 'strokeColor', 'outerStrokeColor'].includes(key)) {
            if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) result[key] = value.toLowerCase();
        } else if (key === 'envelope') {
            if (!['none','skew','perspective','arc','wave','bulge','taper','points'].includes(value.kind)) continue;
            const amount = bounded(value.amount, -4,4);
            if (amount == null) continue;
            let points = null;
            if (value.kind === 'points') {
                if (!Array.isArray(value.points) || value.points.length !== 9) continue;
                points = value.points.map(point=>({x:bounded(point?.x,-4,4),y:bounded(point?.y,-4,4)}));
                if (points.some(point=>point.x == null || point.y == null)) continue;
            }
            result[key] = {kind:value.kind,amount,points};
        } else {
            const bound = key === 'strokeWidth' || key === 'outerStrokeWidth' ? [0,64] : key === 'size' ? [0.125,8] : key === 'rotation' ? [-1e6,1e6]
                : key === 'scaleX' || key === 'scaleY' ? [-20,20] : [-8192,8192];
            let number = bounded(value,...bound);
            if (number == null) continue;
            if ((key === 'scaleX' || key === 'scaleY') && Math.abs(number)<0.01) number = number < 0 ? -0.01 : 0.01;
            result[key] = number;
        }
    }
    return result;
}

function canonicalAttributes(style) { return JSON.stringify(attributes(style)); }

function collectUnits(text, styleFor) {
    const result = [];
    for (const unit of segmentLetteringText(text)) {
        if (/\r|\n/.test(unit.text)) continue;
        const values = attributes(styleFor(unit));
        if (!Object.keys(values).length) continue;
        const previous = result.at(-1);
        if (previous?.end === unit.start && canonicalAttributes(previous) === JSON.stringify(values)) previous.end = unit.end;
        else if (result.length < 2000) result.push({ start: unit.start, end: unit.end, ...values });
    }
    return result;
}

/** Null-valued patch properties remove that override, restoring inheritance. */
export function applyCharacterStyle(text, styles, start, end, patch = {}) {
    const from = Math.max(0, Math.min(String(text).length, Number(start) || 0));
    const to = Math.max(from, Math.min(String(text).length, Number(end) || 0));
    return collectUnits(text, unit => {
        const values = attributes(characterStyleAt(styles, unit.start));
        if (unit.start < to && unit.end > from) {
            for (const key of ATTRIBUTES) if (Object.hasOwn(patch, key)) {
                if (patch[key] == null) delete values[key];
                else {
                    const normalized = attributes({ [key]: patch[key] });
                    if (Object.hasOwn(normalized, key)) values[key] = normalized[key];
                }
            }
        }
        return values;
    });
}

/** Remap a single beforeinput/IME edit. Optional edit = {start,end,insertedText}. */
export function remapCharacterStyles(oldText, newText, styles, edit = null) {
    const before = String(oldText), after = String(newText);
    if (before === after) return applyCharacterStyle(after, styles, 0, 0, {});
    let start = 0, end = before.length, insertedEnd = after.length;
    if (edit && Number.isInteger(edit.start) && Number.isInteger(edit.end)
        && edit.start >= 0 && edit.end >= edit.start && edit.end <= before.length) {
        start = edit.start; end = edit.end; insertedEnd = after.length - (before.length - end);
        // Reject stale beforeinput descriptors rather than attaching styles to
        // text with the same spelling elsewhere.
        if (insertedEnd < start || before.slice(0, start) !== after.slice(0, start)
            || before.slice(end) !== after.slice(insertedEnd)) edit = null;
    }
    if (!edit) {
        start = 0;
        while (start < before.length && start < after.length && before[start] === after[start]) start += 1;
        end = before.length; insertedEnd = after.length;
        while (end > start && insertedEnd > start && before[end - 1] === after[insertedEnd - 1]) { end -= 1; insertedEnd -= 1; }
    }
    const boundaries = new Set([0, before.length, ...segmentLetteringText(before).flatMap(unit => [unit.start, unit.end])]);
    while (start > 0 && !boundaries.has(start)) start -= 1;
    while (end < before.length && !boundaries.has(end)) { end += 1; insertedEnd += 1; }
    const delta = after.length - before.length;
    const inherited = end > start ? characterStyleAt(styles, start)
        : styles.find(style => style.start < start && start < style.end);
    return collectUnits(after, unit => {
        if (unit.start < start) return characterStyleAt(styles, unit.start);
        if (unit.start < insertedEnd && unit.end > start) return inherited;
        return characterStyleAt(styles, unit.start - delta);
    });
}

export function profileScale(profile, progress = 0) {
    if (!profile) return 1;
    const t = Math.max(0, Math.min(1, Number(progress) || 0));
    const bounded = value => Math.max(0.125, Math.min(8, Number(value) || 1));
    const start = bounded(profile.start), end = bounded(profile.end);
    if (profile.mode !== 'three') return start + (end - start) * t;
    const mid = bounded(profile.mid);
    return t <= 0.5 ? start + (mid - start) * t * 2 : mid + (end - mid) * (t - 0.5) * 2;
}

export const LETTERING_CHARACTER_ATTRIBUTES = Object.freeze(ATTRIBUTES);
