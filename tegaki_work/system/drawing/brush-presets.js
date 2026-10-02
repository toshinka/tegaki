/**
 * ============================================================================
 * ファイル名: system/drawing/brush-presets.js
 * 責務: ブラシの「性格」(筆圧カーブ・速度応答・傾き・エアブラシの流量や柔らかさ等)を
 *       名前付きで保存・呼び出しするための定義と純粋関数。DOM / Pixi非依存。
 * 非所有: サイズ・不透明度(Quick Accessのtool presetスロットが担当)、色。
 * 被依存: settings-manager.js(検証), settings-popup.js(UI)
 * ============================================================================
 */

/** 各toolのpresetが保存・適用するSettingsManagerのkey。 */
export const BRUSH_PRESET_KEYS = {
    pen: [
        'pressureCorrection',
        'pressureCurve',
        'pressureCurvePoints',
        'pressureOpacityEnabled',
        'pressureOpacityStrength',
        'penPressureSmoothing',
        'penVelocityThinning',
        'penTiltStrength',
        'penDabSoftness',
        'penEdgeAA',
        'stabilizerMode',
        'penTaperIn',
        'penTaperOut',
        'smoothing',
        'penTipShape',
        'penTipAspect',
        'penTipAngle',
        'penTipFollow',
        'penPressureSizeStrength',
        'penCapShape'
    ],
    eraser: [
        'eraserDabSoftness',
        'eraserTipShape',
        'eraserTipAspect',
        'eraserTipAngle'
    ],
    airbrush: [
        'airbrushFlow',
        'airbrushSoftness',
        'airbrushScatter',
        'airbrushBuildupRate',
        'airbrushTiltStrength'
    ]
};

export const MAX_USER_BRUSH_PRESETS = 12;

/** presetに入っていないキーの既定値。古い(ペン先形状を知らない)presetを当てても丸ペン先に戻る。 */
export const BRUSH_PRESET_DEFAULTS = Object.freeze({
    penCapShape: 'round',
    penPressureSizeStrength: 1,
    penTipShape: 'round',
    penTipAspect: 1,
    penTipAngle: 0,
    penTipFollow: 'fixed',
    eraserTipShape: 'round',
    eraserTipAspect: 1,
    eraserTipAngle: 0,
    eraserDabSoftness: 0
});

/** 組み込みpreset(削除不可)。「標準」は既定値へ戻す用途も兼ねる。 */
export const BUILTIN_BRUSH_PRESETS = {
    pen: [
        {
            id: 'builtin-pen-standard',
            name: '標準',
            values: {
                pressureCorrection: 1.0,
                pressureCurve: 'linear',
                pressureCurvePoints: null,
                pressureOpacityEnabled: true,
                pressureOpacityStrength: 0.65,
                penPressureSmoothing: 0.5,
                penVelocityThinning: 0.3,
                penTiltStrength: 0,
                penDabSoftness: 0,
                penEdgeAA: 1,
                stabilizerMode: 'follow',
                penTaperIn: 0,
                penTaperOut: 0,
                smoothing: 0.5
            }
        },
        {
            id: 'builtin-pen-ink',
            name: 'つけペン風',
            values: {
                pressureCorrection: 1.0,
                pressureCurve: 'ease-out',
                pressureCurvePoints: null,
                pressureOpacityEnabled: false,
                pressureOpacityStrength: 0.65,
                penPressureSmoothing: 0.5,
                penVelocityThinning: 0.45,
                penTiltStrength: 0,
                penDabSoftness: 0,
                penEdgeAA: 1,
                stabilizerMode: 'follow',
                penTaperIn: 12,
                penTaperOut: 40,
                smoothing: 0.5
            }
        },
        {
            id: 'builtin-pen-mili',
            name: 'ミリペン風',
            values: {
                pressureCorrection: 1.0,
                pressureCurve: 'ease-out',
                pressureCurvePoints: null,
                pressureOpacityEnabled: false,
                pressureOpacityStrength: 0.65,
                penPressureSmoothing: 0.7,
                penVelocityThinning: 0,
                penTiltStrength: 0,
                penDabSoftness: 0,
                penEdgeAA: 1,
                stabilizerMode: 'follow',
                penTaperIn: 0,
                penTaperOut: 0,
                smoothing: 0.75,
                penPressureSizeStrength: 0.35
            }
        },
        {
            id: 'builtin-pen-square',
            name: '角ペン',
            values: {
                pressureCorrection: 1.0,
                pressureCurve: 'ease-out',
                pressureCurvePoints: null,
                pressureOpacityEnabled: false,
                pressureOpacityStrength: 0.65,
                penPressureSmoothing: 0.85,
                penVelocityThinning: 0,
                penTiltStrength: 0,
                penDabSoftness: 0,
                penEdgeAA: 1,
                stabilizerMode: 'follow',
                penTaperIn: 0,
                penTaperOut: 0,
                smoothing: 0.8,
                penTipShape: 'square',
                penTipAspect: 1,
                penTipAngle: 0,
                penPressureSizeStrength: 0,
                penCapShape: 'round'
            }
        },
        {
            id: 'builtin-pen-square-follow',
            name: '角ペン(追従)',
            values: {
                pressureCorrection: 1.0,
                pressureCurve: 'ease-out',
                pressureCurvePoints: null,
                pressureOpacityEnabled: false,
                pressureOpacityStrength: 0.65,
                penPressureSmoothing: 0.85,
                penVelocityThinning: 0,
                penTiltStrength: 0,
                penDabSoftness: 0,
                penEdgeAA: 1,
                stabilizerMode: 'follow',
                penTaperIn: 0,
                penTaperOut: 0,
                smoothing: 0.8,
                penTipShape: 'square',
                penTipAspect: 1,
                penTipAngle: 0,
                penTipFollow: 'follow',
                penPressureSizeStrength: 0,
                penCapShape: 'round'
            }
        },
        {
            id: 'builtin-pen-pencil',
            name: '鉛筆風',
            values: {
                pressureCorrection: 1.0,
                pressureCurve: 'ease-in',
                pressureCurvePoints: null,
                pressureOpacityEnabled: true,
                pressureOpacityStrength: 0.9,
                penPressureSmoothing: 0.3,
                penVelocityThinning: 0.1,
                penTiltStrength: 0.6,
                penDabSoftness: 0.15,
                penEdgeAA: 0.8,
                stabilizerMode: 'follow',
                penTaperIn: 0,
                penTaperOut: 0,
                smoothing: 0.3
            }
        }
    ],
    eraser: [
        {
            id: 'builtin-eraser-standard',
            name: '標準',
            values: { eraserDabSoftness: 0, eraserTipShape: 'round', eraserTipAspect: 1, eraserTipAngle: 0 }
        },
        {
            id: 'builtin-eraser-square',
            name: '角消しゴム',
            values: { eraserDabSoftness: 0, eraserTipShape: 'square', eraserTipAspect: 1, eraserTipAngle: 0 }
        }
    ],
    airbrush: [
        {
            id: 'builtin-airbrush-standard',
            name: '標準',
            values: {
                airbrushFlow: 0.08,
                airbrushSoftness: 0.8,
                airbrushScatter: 0,
                airbrushBuildupRate: 20,
                airbrushTiltStrength: 0.5
            }
        },
        {
            id: 'builtin-airbrush-hard',
            name: 'くっきり',
            values: {
                airbrushFlow: 0.3,
                airbrushSoftness: 0.25,
                airbrushScatter: 0,
                airbrushBuildupRate: 10,
                airbrushTiltStrength: 0.3
            }
        },
        {
            id: 'builtin-airbrush-soft',
            name: 'ふんわり溜め',
            values: {
                airbrushFlow: 0.04,
                airbrushSoftness: 1.0,
                airbrushScatter: 0.1,
                airbrushBuildupRate: 30,
                airbrushTiltStrength: 0.5
            }
        }
    ]
};

/** 組み込み + ユーザー保存のpreset一覧(builtinフラグ付き)。 */
// ペン先の形を持たない組み込みペンは丸ペン先(全キーを定義する契約を保つ)
for (const preset of BUILTIN_BRUSH_PRESETS.pen) {
    preset.values = {
        penTipShape: BRUSH_PRESET_DEFAULTS.penTipShape,
        penTipAspect: BRUSH_PRESET_DEFAULTS.penTipAspect,
        penTipAngle: BRUSH_PRESET_DEFAULTS.penTipAngle,
        penTipFollow: BRUSH_PRESET_DEFAULTS.penTipFollow,
        penPressureSizeStrength: BRUSH_PRESET_DEFAULTS.penPressureSizeStrength,
        penCapShape: BRUSH_PRESET_DEFAULTS.penCapShape,
        ...preset.values
    };
}

export function listBrushPresets(tool, userPresets) {
    const user = userPresets?.[tool] || [];
    return [
        ...(BUILTIN_BRUSH_PRESETS[tool] || []).map(preset => ({ ...preset, builtin: true })),
        ...user.map(preset => ({ ...preset, builtin: false }))
    ];
}

/**
 * QTPのスロット行に出すpreset。settingsの qtpBrushPresetIds[tool] が配列ならその順で、
 * null/未設定なら全て。存在しないidは捨てる。
 */
export function listQtpBrushPresets(tool, userPresets, qtpIds) {
    const all = listBrushPresets(tool, userPresets);
    const ids = qtpIds?.[tool];
    if (!Array.isArray(ids)) return all;
    return ids.map(id => all.find(preset => preset.id === id)).filter(Boolean);
}

/** presetの値を設定へ書き込む(customカーブは制御点を先に入れてから種類を切り替える)。 */
export function applyBrushPresetValues(tool, preset, settingsManager) {
    if (!preset || !settingsManager) return false;
    const values = preset.values || {};
    const keys = [...(BRUSH_PRESET_KEYS[tool] || [])]
        .sort((a, b) => (a === 'pressureCurvePoints' ? -1 : b === 'pressureCurvePoints' ? 1 : 0));
    keys.forEach(key => {
        if (key in values) settingsManager.set(key, values[key]);
        else if (key in BRUSH_PRESET_DEFAULTS) settingsManager.set(key, BRUSH_PRESET_DEFAULTS[key]);
    });
    return true;
}

export function getBrushPresetTool(mode) {
    if (mode === 'eraser') return 'eraser';
    if (mode === 'airbrush' || mode === 'airbrush-erase' || mode === 'blur') return 'airbrush';
    if (mode === 'pen') return 'pen';
    return null;
}

/** 現在値からpreset用の値を抜き出す。 */
export function captureBrushPresetValues(tool, getSetting) {
    const keys = BRUSH_PRESET_KEYS[tool] || [];
    const values = {};
    keys.forEach(key => {
        const value = getSetting(key);
        values[key] = Array.isArray(value) ? value.map(p => (Array.isArray(p) ? [...p] : p)) : value ?? null;
    });
    return values;
}

const valuesEqual = (a, b) => {
    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
        return a.every((item, i) => valuesEqual(item, b[i]));
    }
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-3;
    return (a ?? null) === (b ?? null);
};

/** presetの値が現在値と一致するか(UIの選択中表示用)。customでないカーブの制御点は比較しない。 */
export function brushPresetMatches(preset, tool, getSetting) {
    const keys = BRUSH_PRESET_KEYS[tool] || [];
    const values = preset?.values || {};
    return keys.every(key => {
        if (key === 'pressureCurvePoints' && values.pressureCurve !== 'custom') return true;
        const expected = key in values ? values[key] : BRUSH_PRESET_DEFAULTS[key];
        return valuesEqual(expected, getSetting(key));
    });
}

/**
 * 保存値の正規化。validateValueでkeyごとに検証し、不正なpresetは捨てる。
 * @param {*} value - { pen: [...], airbrush: [...] }
 * @param {(key: string, value: *) => *} validateValue
 */
export function normalizeUserBrushPresets(value, validateValue) {
    const result = { pen: [], airbrush: [], eraser: [] };
    if (!value || typeof value !== 'object') return result;
    Object.keys(result).forEach(tool => {
        const list = Array.isArray(value[tool]) ? value[tool] : [];
        list.slice(0, MAX_USER_BRUSH_PRESETS).forEach(item => {
            if (!item || typeof item !== 'object') return;
            const name = String(item.name ?? '').trim().slice(0, 24);
            if (!name) return;
            const values = {};
            (BRUSH_PRESET_KEYS[tool] || []).forEach(key => {
                if (!(key in (item.values || {}))) return;
                const validated = validateValue(key, item.values[key]);
                if (validated !== undefined) values[key] = validated;
            });
            result[tool].push({
                id: String(item.id || `user-${tool}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
                name,
                values
            });
        });
    });
    return result;
}
