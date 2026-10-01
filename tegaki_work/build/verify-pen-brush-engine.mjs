/**
 * build/verify-pen-brush-engine.mjs
 *
 * ブラシエンジン改修(claude/brush-upgrade)の純粋ロジック契約検証。
 * - 筆圧カーブ(制御点 / 単調3次Hermite / 正規化 / preset近似)
 * - dab falloff(hardness)
 * - ブラシプリセット(正規化 / 取り込み / 一致判定 / 組み込み定義)
 * - 傾き(tilt)のLayer座標変換と強さ
 * - ペン速度応答
 * - dab renderer(pen spacing / tilt楕円 / pool再利用時の状態リセット)
 * - SettingsManagerの新規key検証
 * GPU描画・画素一致は対象外(ブラウザ実操作で確認する)。
 */

import assert from 'node:assert/strict';

// brush-core / settings-manager はmodule読込時にwindowを参照するため最小shimを置く。
globalThis.window = globalThis;
globalThis.localStorage = globalThis.localStorage || {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
};

const {
    PRESSURE_CURVE_PRESETS,
    MAX_PRESSURE_CURVE_POINTS,
    normalizePressureCurvePoints,
    evaluatePressureCurve
} = await import('../system/drawing/pressure-curve.js');
const { AirbrushDabRenderer, computeDabFalloff, computeSoftnessForEdgeWidth } = await import('../system/drawing/airbrush-dab-renderer.js');
const {
    BRUSH_PRESET_KEYS,
    BUILTIN_BRUSH_PRESETS,
    MAX_USER_BRUSH_PRESETS,
    getBrushPresetTool,
    captureBrushPresetValues,
    brushPresetMatches,
    normalizeUserBrushPresets
} = await import('../system/drawing/brush-presets.js');
const { BrushCore } = await import('../system/drawing/brush-core.js');
const { SettingsManager } = await import('../system/settings-manager.js');
const { Texture } = await import('pixi.js');

console.log('--- verify-pen-brush-engine: starting tests ---');

const near = (actual, expected, epsilon, message) => {
    assert.ok(Math.abs(actual - expected) <= epsilon, `${message}: expected ${expected}±${epsilon}, got ${actual}`);
};

// ============================================================================
// 1. 筆圧カーブ
// ============================================================================
{
    for (let x = 0; x <= 1.0001; x += 0.05) {
        near(evaluatePressureCurve(PRESSURE_CURVE_PRESETS.linear, x), Math.min(1, x), 1e-9, 'linear preset is identity');
        near(evaluatePressureCurve(PRESSURE_CURVE_PRESETS['ease-in'], x), 1 - (1 - x) ** 2, 0.02, 'ease-in preset approximates formula');
        near(evaluatePressureCurve(PRESSURE_CURVE_PRESETS['ease-out'], x), x * x, 0.02, 'ease-out preset approximates formula');
    }

    // 単調な制御点は単調な曲線になり、制御点間で行き過ぎない(Fritsch-Carlson)。
    const steep = [[0, 0], [0.2, 0.05], [0.25, 0.9], [1, 1]];
    let previous = -Infinity;
    for (let i = 0; i <= 200; i++) {
        const y = evaluatePressureCurve(steep, i / 200);
        assert.ok(y >= previous - 1e-9, `monotone points stay monotone at x=${i / 200}`);
        assert.ok(y >= 0 && y <= 1, 'curve stays within 0..1');
        previous = y;
    }
    // 極値の点では平らになり、隣接区間で行き過ぎない。
    const peak = [[0, 0], [0.5, 0.8], [1, 0.2]];
    for (let i = 0; i <= 100; i++) {
        assert.ok(evaluatePressureCurve(peak, i / 100) <= 0.8 + 1e-9, 'no overshoot above a local maximum');
    }
    near(evaluatePressureCurve(peak, 0.5), 0.8, 1e-9, 'curve passes through control points');

    // 正規化
    assert.deepEqual(
        normalizePressureCurvePoints([[0.5, 2], [0.2, 0.1], ['x', 1]]),
        [[0, 0.1], [0.2, 0.1], [0.5, 1], [1, 1]],
        'missing endpoints are added, values clamped, invalid points dropped, sorted by x'
    );
    assert.equal(normalizePressureCurvePoints('bad'), null, 'non-array is rejected');
    assert.equal(normalizePressureCurvePoints([[0.3, 0.3]]), null, 'fewer than two valid points is rejected');
    const crowded = normalizePressureCurvePoints([[0, 0], [0.5, 0.5], [0.505, 0.6], [1, 1]]);
    assert.equal(crowded.length, 3, 'points closer than 0.01 in x are merged');
    const many = normalizePressureCurvePoints(Array.from({ length: 20 }, (_, i) => [i / 19, i / 19]));
    assert.equal(many.length, MAX_PRESSURE_CURVE_POINTS, 'point count is capped');
    assert.deepEqual([many[0][0], many.at(-1)[0]], [0, 1], 'endpoints survive the cap');
    near(evaluatePressureCurve(null, 0.37), 0.37, 1e-9, 'invalid curve falls back to identity');
}

// ============================================================================
// 2. dab falloff
// ============================================================================
{
    assert.equal(computeDabFalloff(0, 0), 1, 'hard dab center is opaque');
    assert.equal(computeDabFalloff(0.99, 0), 1, 'hard dab stays opaque up to the edge');
    assert.equal(computeDabFalloff(1, 0), 0, 'outside the radius is transparent');
    assert.equal(computeDabFalloff(1.2, 0.8), 0, 'outside the radius is transparent (soft)');
    for (const softness of [0.2, 0.5, 0.8, 1]) {
        assert.equal(computeDabFalloff(0, softness), 1, `center is opaque at softness ${softness}`);
        let previous = 1;
        for (let r = 0; r < 1; r += 0.01) {
            const a = computeDabFalloff(r, softness);
            assert.ok(a <= previous + 1e-12, `falloff decreases outward at softness ${softness}`);
            previous = a;
        }
        assert.ok(computeDabFalloff(0.999, softness) < 0.01, `falloff reaches ~0 at the edge (softness ${softness})`);
    }

    // AA幅(画素)→softness: 不透明な芯の外側の減衰帯がedgePxになる。
    for (const [edge, radius] of [[1, 5], [1.5, 2], [0.5, 20], [2, 100]]) {
        const s = computeSoftnessForEdgeWidth(edge, radius);
        const core = (1 - s) * (1 - s);
        near(radius * (1 - core), edge, 1e-9, `edge band equals ${edge}px at radius ${radius}`);
    }
    assert.equal(computeSoftnessForEdgeWidth(0, 10), 0, 'no AA keeps a hard edge');
    assert.equal(computeSoftnessForEdgeWidth(5, 2), 1, 'AA wider than the radius saturates to fully soft');
}

// ============================================================================
// 3. ブラシプリセット
// ============================================================================
{
    assert.equal(getBrushPresetTool('pen'), 'pen');
    assert.equal(getBrushPresetTool('airbrush-erase'), 'airbrush');
    assert.equal(getBrushPresetTool('eraser'), null, 'eraser has no brush preset');

    for (const tool of Object.keys(BUILTIN_BRUSH_PRESETS)) {
        const ids = new Set();
        for (const preset of BUILTIN_BRUSH_PRESETS[tool]) {
            assert.ok(!ids.has(preset.id), `builtin preset ids are unique (${preset.id})`);
            ids.add(preset.id);
            assert.deepEqual(
                Object.keys(preset.values).sort(),
                [...BRUSH_PRESET_KEYS[tool]].sort(),
                `builtin preset ${preset.id} defines every key of its tool`
            );
        }
        assert.equal(BUILTIN_BRUSH_PRESETS[tool][0].name, '標準', `${tool} starts with the standard preset`);
    }

    const store = {
        pressureCorrection: 1, pressureCurve: 'custom', pressureCurvePoints: [[0, 0], [0.5, 0.2], [1, 1]],
        pressureOpacityEnabled: true, pressureOpacityStrength: 0.65, penVelocityThinning: 0.3,
        penTiltStrength: 0, penDabSoftness: 0, penEdgeAA: 0, penTaperIn: 0, penTaperOut: 0, smoothing: 0.5
    };
    const get = key => store[key];
    const captured = captureBrushPresetValues('pen', get);
    assert.deepEqual(captured, store, 'capture copies every pen key');
    assert.notEqual(captured.pressureCurvePoints, store.pressureCurvePoints, 'captured curve points are a copy');
    captured.pressureCurvePoints[1][1] = 0.9;
    assert.equal(store.pressureCurvePoints[1][1], 0.2, 'mutating a capture does not alias the live setting');

    const preset = { values: captureBrushPresetValues('pen', get) };
    assert.ok(brushPresetMatches(preset, 'pen', get), 'preset matches the values it was captured from');
    assert.ok(brushPresetMatches(preset, 'pen', key => (key === 'smoothing' ? 0.5004 : store[key])), 'tiny float noise still matches');
    assert.ok(!brushPresetMatches(preset, 'pen', key => (key === 'smoothing' ? 0.6 : store[key])), 'changed value no longer matches');
    const presetCurve = { values: { ...store, pressureCurve: 'ease-in', pressureCurvePoints: null } };
    assert.ok(
        brushPresetMatches(presetCurve, 'pen', key => (key === 'pressureCurve' ? 'ease-in' : key === 'pressureCurvePoints' ? [[0, 0], [1, 0.5]] : store[key])),
        'stored custom points are ignored when the preset is not custom'
    );

    const validate = (key, value) => SettingsManager.prototype.validateValue.call(SettingsManager.prototype, key, value);
    const normalized = normalizeUserBrushPresets({
        pen: [
            { id: 'a', name: '  鉛筆  ', values: { smoothing: 5, pressureCurve: 'bogus', penVelocityThinning: 0.2 } },
            { id: 'b', name: '', values: {} },
            null,
            { id: 'c', name: 'x'.repeat(40), values: {} }
        ],
        airbrush: Array.from({ length: 20 }, (_, i) => ({ id: `z${i}`, name: `z${i}`, values: { airbrushFlow: 0.5 } }))
    }, validate);
    assert.equal(normalized.pen.length, 2, 'presets without a name or object are dropped');
    assert.equal(normalized.pen[0].name, '鉛筆', 'name is trimmed');
    assert.equal(normalized.pen[0].values.smoothing, 1, 'values go through setting validators (clamped)');
    assert.ok(!('pressureCurve' in normalized.pen[0].values), 'invalid values are dropped');
    assert.equal(normalized.pen[1].name.length, 24, 'long names are cut');
    assert.equal(normalized.airbrush.length, MAX_USER_BRUSH_PRESETS, 'user presets are capped per tool');
    assert.deepEqual(normalizeUserBrushPresets('nope', validate), { pen: [], airbrush: [] }, 'garbage becomes empty lists');
}

// ============================================================================
// 4. SettingsManager: 新規key
// ============================================================================
{
    const validate = (key, value) => SettingsManager.prototype.validateValue.call(SettingsManager.prototype, key, value);
    assert.equal(validate('airbrushBuildupRate', 75), 60, 'buildup rate is clamped to 60');
    assert.equal(validate('airbrushBuildupRate', 12.6), 13, 'buildup rate is an integer');
    assert.equal(validate('penVelocityThinning', 2), 0.9, 'velocity thinning is clamped');
    assert.equal(validate('airbrushTiltStrength', -1), 0, 'tilt strength is clamped');
    assert.equal(validate('pressureCurve', 'custom'), 'custom', 'custom curve is accepted');
    assert.equal(validate('pressureCurve', 'wobbly'), undefined, 'unknown curve is rejected');
    assert.equal(validate('pressureCurvePoints', null), null, 'null clears custom points');
    assert.equal(validate('pressureCurvePoints', 'x'), undefined, 'invalid points are rejected');
}

// ============================================================================
// 5. 傾き(tilt)
// ============================================================================
{
    const makeCore = (mapX = (x) => x, mapY = (_x, y) => y) => {
        const core = Object.create(BrushCore.prototype);
        core.coordinateSystem = {
            screenClientToCanvas: (x, y) => ({ canvasX: x, canvasY: y }),
            canvasToWorld: (x, y) => ({ worldX: x, worldY: y }),
            worldToLocal: (x, y) => ({ localX: mapX(x, y), localY: mapY(x, y) })
        };
        return core;
    };

    const plain = makeCore();
    assert.deepEqual(
        plain._computeLocalTilt(100, 100, 100, 100, { tiltX: 0, tiltY: 0 }, null),
        { angle: 0, magnitude: 0 },
        'vertical pen has no tilt'
    );
    const right45 = plain._computeLocalTilt(100, 100, 100, 100, { tiltX: 45, tiltY: 0 }, null);
    near(right45.magnitude, 0.5, 1e-9, '45° tilt is half way to flat');
    near(Math.abs(right45.angle), Math.PI, 1e-9, 'pen top leaning right sprays toward -x');
    const down60 = plain._computeLocalTilt(100, 100, 100, 100, { tiltX: 0, tiltY: 60 }, null);
    near(down60.magnitude, 2 / 3, 1e-9, '60° tilt magnitude');
    near(down60.angle, -Math.PI / 2, 1e-9, 'pen top leaning down sprays toward -y');

    // canvas左右反転: 画面の-xはLayerの+x
    const flipped = makeCore((x) => 1000 - x, (_x, y) => y);
    const flippedTilt = flipped._computeLocalTilt(100, 100, 900, 100, { tiltX: 45, tiltY: 0 }, null);
    near(flippedTilt.angle, 0, 1e-9, 'flip mirrors the spray direction into layer space');
    // canvas 90°回転: 画面(x, y) → Layer(y, -x)
    const rotated = makeCore((_x, y) => y, (x) => -x);
    const rotatedTilt = rotated._computeLocalTilt(100, 100, 100, -100, { tiltX: 45, tiltY: 0 }, null);
    near(rotatedTilt.angle, Math.PI / 2, 1e-9, 'rotation turns the spray direction into layer space');

    plain.currentTilt = { angle: 1, magnitude: 0.5 };
    window.TegakiSettingsManager = { get: key => (key === 'airbrushTiltStrength' ? 0.4 : undefined) };
    const dabTilt = plain._getDabTilt('airbrushTiltStrength', 0.5);
    near(dabTilt.amount, 0.2, 1e-9, 'tilt amount = user strength × magnitude');
    assert.equal(dabTilt.angle, 1);
    window.TegakiSettingsManager = { get: () => 0 };
    assert.equal(plain._getDabTilt('airbrushTiltStrength', 0.5), null, 'strength 0 disables tilt');
    window.TegakiSettingsManager = undefined;
    plain.currentTilt = { angle: 0, magnitude: 0 };
    assert.equal(plain._getDabTilt('airbrushTiltStrength', 0.5), null, 'no tilt input disables tilt');
}

// ============================================================================
// 6. ペン速度応答
// ============================================================================
{
    window.TEGAKI_CONFIG = { brushEngine: { penVelocityThinning: 0.3, penVelocitySlow: 0.6, penVelocityFast: 4.0 } };
    const run = (speedPxPerMs, samples = 30) => {
        const core = Object.create(BrushCore.prototype);
        core.penVelocityState = { x: 0, y: 0, time: null, speed: 0 };
        let pressure = 1;
        for (let i = 0; i <= samples; i++) {
            pressure = core._applyPenVelocityResponse(i * speedPxPerMs * 10, 0, i * 10, 1);
        }
        return pressure;
    };
    near(run(0.3), 1, 1e-9, 'slow strokes keep full pressure');
    near(run(10), 0.7, 1e-3, 'fast strokes lose up to the configured strength');
    const medium = run(2);
    assert.ok(medium < 1 && medium > 0.7, 'medium speed is in between');

    const core = Object.create(BrushCore.prototype);
    core.penVelocityState = { x: 0, y: 0, time: null, speed: 0 };
    core._applyPenVelocityResponse(0, 0, 0, 1);
    // 6px/msは単独なら最大減衰域だが、1sample目は平滑化で部分的な減衰に留まる。
    const jump = core._applyPenVelocityResponse(60, 0, 10, 1);
    assert.ok(jump > 0.7 && jump < 1, 'one fast sample is smoothed instead of jumping straight to the minimum');
    core._applyPenVelocityResponse(60, 0, 10, 1);
    assert.equal(core.penVelocityState.time, 10, 'samples with the same timestamp do not divide by zero');

    window.TEGAKI_CONFIG.brushEngine.penVelocityThinning = 0;
    near(run(10), 1, 1e-9, 'strength 0 disables velocity response');
    delete window.TEGAKI_CONFIG;
}

// ============================================================================
// 6b. 入り抜き(taper)
// ============================================================================
{
    const core = Object.create(BrushCore.prototype);
    window.TegakiSettingsManager = { get: key => ({ penTaperIn: 20, penTaperOut: 40 })[key] };
    near(core._getPenTaperScale(0, Infinity), 0.08, 1e-9, 'taper starts at the minimum width');
    near(core._getPenTaperScale(20, Infinity), 1, 1e-9, 'taper-in reaches full width at its length');
    near(core._getPenTaperScale(500, Infinity), 1, 1e-9, 'unknown end keeps full width during drawing');
    near(core._getPenTaperScale(500, 0), 0.08, 1e-9, 'taper-out ends at the minimum width');
    near(core._getPenTaperScale(500, 40), 1, 1e-9, 'taper-out starts at its length from the end');
    const mid = core._getPenTaperScale(10, Infinity);
    assert.ok(mid > 0.08 && mid < 1, 'taper ramps smoothly');
    const shortStroke = core._getPenTaperScale(15, 15);
    assert.ok(shortStroke < 1, 'a stroke shorter than both tapers never reaches full width');
    window.TegakiSettingsManager = { get: () => 0 };
    near(core._getPenTaperScale(0, 0), 1, 1e-9, 'taper 0 keeps full width everywhere');
    window.TegakiSettingsManager = undefined;
}

// ============================================================================
// 7. dab renderer
// ============================================================================
{
    const renderer = new AirbrushDabRenderer({
        calculateWidth: (pressure, size) => Math.max(1, size * Math.max(0.02, pressure)),
        calculateOpacity: () => 1,
        random: () => 0.5
    });
    // DOM無しでtexture生成しないよう、使うsoftnessのtextureを先に入れておく。
    renderer.textures.set('falloff:0', Texture.WHITE);
    renderer.textures.set('falloff:0.8', Texture.WHITE);

    const penSettings = { dabMode: 'pen', size: 20, pressureEnabled: true, penDabSoftness: 0, penDabSpacingRatio: 0.05 };
    near(renderer.getSpacing(penSettings, { pressure: 1 }, { pressure: 1 }), 1, 1e-9, 'pen spacing = width × ratio');
    near(renderer.getSpacing(penSettings, { pressure: 1 }, { pressure: 0.1 }), 0.35, 1e-9, 'pen spacing uses the thinner end and has a floor');

    const pen = renderer.renderSegment([{ x: 0, y: 0, pressure: 1 }, { x: 10, y: 0, pressure: 1 }], penSettings, {});
    assert.equal(pen.children.length, 11, 'pen dabs every 1px over a 10px segment (inclusive start)');
    assert.ok(pen.children.every(s => s.blendMode === 'max'), 'pen dabs use max blending');
    const firstPenSprite = pen.children[0];
    renderer.releaseSegment(pen);
    assert.equal(pen.children.length, 0, 'release empties the pooled container');

    const tilted = { size: 40, airbrushSoftness: 0.8, airbrushFlow: 0.5, airbrushSpacingRatio: 0.1, mode: 'airbrush',
        dabTilt: { angle: 0.7, amount: 0.5 } };
    const tiltedContainer = renderer.renderSegment([{ x: 100, y: 50, pressure: 1 }], tilted, {});
    const tiltedSprite = tiltedContainer.children[0];
    assert.equal(tiltedSprite, firstPenSprite, 'sprites are reused from the pool');
    near(tiltedSprite.width, 40 * (1 + 0.6 * 0.5), 1e-6, 'tilt stretches the dab along its direction');
    near(tiltedSprite.height, 40, 1e-6, 'tilt keeps the cross width');
    near(tiltedSprite.rotation, 0.7, 1e-9, 'tilt rotates the dab to the tilt direction');
    near(tiltedSprite.x, 100 + 40 * 0.25 * 0.5 * Math.cos(0.7), 1e-6, 'tilt shifts the dab toward the nib (x)');
    near(tiltedSprite.y, 50 + 40 * 0.25 * 0.5 * Math.sin(0.7), 1e-6, 'tilt shifts the dab toward the nib (y)');
    renderer.releaseSegment(tiltedContainer);

    const upright = renderer.renderSegment([{ x: 100, y: 50, pressure: 1 }], { ...tilted, dabTilt: null }, {});
    assert.equal(upright.children[0].rotation, 0, 'a pooled sprite does not keep the previous dab rotation');
    near(upright.children[0].width, 40, 1e-6, 'a pooled sprite does not keep the previous dab stretch');
    near(upright.children[0].x, 100, 1e-6, 'a pooled sprite does not keep the previous dab offset');
    renderer.releaseSegment(upright);

    // AA幅: 細い線ほど相対的に柔らかく、設定softnessより弱くはならない。
    const aaThin = renderer._getPenDabEffectiveSoftness([{ pressure: 1 }], { ...penSettings, size: 4, penEdgeAA: 1 });
    const aaThick = renderer._getPenDabEffectiveSoftness([{ pressure: 1 }], { ...penSettings, size: 40, penEdgeAA: 1 });
    assert.ok(aaThin > aaThick, 'the same AA width is a larger softness on thin lines');
    near(aaThin * 32, Math.round(aaThin * 32), 1e-9, 'AA softness is quantized to limit texture variants');
    assert.equal(renderer._getPenDabEffectiveSoftness([{ pressure: 1 }], { ...penSettings, size: 40, penEdgeAA: 0.1, penDabSoftness: 0.5 }), 0.5,
        'user softness wins when larger than the AA requirement');
    assert.equal(renderer._getPenDabEffectiveSoftness([{ pressure: 1 }], { ...penSettings, size: 40, penEdgeAA: 0 }), 0, 'AA 0 keeps the previous output');

    // taperの径倍率は区間内で補間され、spacingも細い側に合わせて詰まる。
    near(renderer.getSpacing({ ...penSettings, size: 40 }, { pressure: 1, widthScale: 1 }, { pressure: 1, widthScale: 0.1 }),
        0.35, 1e-9, 'tapered tips get tighter spacing (floored)');
    const taperContainer = renderer.renderSegment(
        [{ x: 0, y: 0, pressure: 1, widthScale: 0.5 }, { x: 4, y: 0, pressure: 1, widthScale: 1 }],
        { ...penSettings, size: 20, penDabSpacingRatio: 0.2 },
        {}
    );
    const widths = taperContainer.children.map(sprite => sprite.width);
    near(widths[0], 10, 1e-6, 'first dab uses the start width scale');
    assert.ok(widths.every((w, i) => i === 0 || w >= widths[i - 1]), 'dab widths follow the taper ramp');
    renderer.releaseSegment(taperContainer);

    const penTilt = renderer._getPenDabWidth(1, { ...penSettings, dabTilt: { angle: 0, amount: 0.5 } });
    near(penTilt, 30, 1e-9, 'pen tilt widens the line');

    const state = {};
    const first = renderer.renderSegment([{ x: 0, y: 0, pressure: 1 }, { x: 3, y: 0, pressure: 1 }], { ...penSettings, size: 20, penDabSpacingRatio: 0.1 }, state);
    const firstCount = first.children.length;
    renderer.releaseSegment(first);
    const second = renderer.renderSegment([{ x: 3, y: 0, pressure: 1 }, { x: 6, y: 0, pressure: 1 }], { ...penSettings, size: 20, penDabSpacingRatio: 0.1 }, state);
    assert.equal(firstCount + second.children.length, 4, 'spacing carries across segments (0, 2, 4, 6)');
    renderer.releaseSegment(second);
}

console.log('verify-pen-brush-engine: ALL CHECKS PASSED');
