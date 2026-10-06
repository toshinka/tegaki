/**
 * ============================================================================
 * ファイル名: system/focus-lines-presets.js
 * 責務: 集中線/密ウニ/荒ウニの新規配置用比率presetを解決する。
 * 依存: なし（DOM / Pixi / Canvas / Project / Historyを参照しない）
 * 被依存: focus-lines popup/overlay、verify-focus-flash.mjs
 * 保存: Projectの正本ではない。返却値は呼び出し側が新規recipeへ採用する候補params。
 * 不変条件: 寸法は短辺へ比例し、preset変更時は既存中心だけを引き継ぐ。
 * ============================================================================
 */

const DEFAULT_COLOR = '#800000';
const DEFAULT_PAPER_COLOR = '#f1e2d8';

function finiteNumber(value) {
    try {
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    } catch {
        return null;
    }
}

function safeDimension(value, fallback) {
    if (value === null || value === undefined) return fallback;
    const number = finiteNumber(value);
    return number === null ? fallback : Math.min(10_000_000, Math.max(1, number));
}

function validColor(value, fallback = DEFAULT_COLOR) {
    return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
        ? value
        : fallback;
}

function copyCenter(previous, width, height) {
    const x = finiteNumber(previous?.center?.x);
    const y = finiteNumber(previous?.center?.y);
    return x === null || y === null
        ? { x: width / 2, y: height / 2 }
        : { x, y };
}

function copySeed(previous) {
    const seed = finiteNumber(previous?.seed);
    return seed === null ? 1 : Math.trunc(seed) >>> 0;
}

const UNI_FLASH = Object.freeze({
    kind: 'tapered',
    depth: 0.45,
    fill: 'none',
    paperColor: DEFAULT_PAPER_COLOR,
    ellipse: 'none',
    ellipseWidth: 2
});

const PRESET_DEFINITIONS = [
    {
        id: 'focus',
        label: '集中線',
        innerRatio: 0.22,
        count: 120,
        widthMin: 1,
        widthMax: 5,
        angleJitter: 0.6,
        lengthJitter: 0.25,
        direction: 'in',
        outer: 0
    },
    {
        id: 'uni',
        label: '密ウニ',
        innerRatio: 0.29,
        count: 150,
        widthMin: 4,
        widthMax: 8,
        angleJitter: 0.42,
        lengthJitter: 0.22,
        direction: 'out',
        outer: 0,
        flash: UNI_FLASH
    },
    {
        id: 'rough',
        label: '荒ウニ',
        innerRatio: 0.29,
        count: 150,
        widthMin: 4,
        widthMax: 8,
        angleJitter: 0.9,
        lengthJitter: 0.52,
        direction: 'out',
        outer: 0,
        flash: UNI_FLASH
    }
];

function freezePreset(definition) {
    const preset = { ...definition };
    if (preset.flash) preset.flash = Object.freeze({ ...preset.flash });
    return Object.freeze(preset);
}

export const FOCUS_PRESETS = Object.freeze(PRESET_DEFINITIONS.map(freezePreset));

/**
 * Resolve a new placement recipe. Unknown ids fail closed so a stale UI value
 * cannot silently select a different finished shape.
 */
export function resolveFocusLinesPreset(id, canvas = { width: 400, height: 400 }, previousParams = null) {
    const width = safeDimension(canvas?.width, 400);
    const height = safeDimension(canvas?.height, 400);
    const shortCanvas = Math.min(width, height);
    const requested = FOCUS_PRESETS.find(preset => preset.id === id);
    if (!requested) return null;
    const scale = shortCanvas / 400;
    const innerRadius = shortCanvas * requested.innerRatio;
    const params = {
        center: copyCenter(previousParams, width, height),
        innerRx: innerRadius,
        innerRy: innerRadius,
        count: requested.count,
        widthMin: requested.widthMin * scale,
        widthMax: requested.widthMax * scale,
        angleJitter: requested.angleJitter,
        lengthJitter: requested.lengthJitter,
        seed: copySeed(previousParams),
        color: validColor(previousParams?.color),
        taper: 1,
        direction: requested.direction,
        outer: requested.outer
    };
    if (requested.flash) params.flash = { ...requested.flash };
    return params;
}

