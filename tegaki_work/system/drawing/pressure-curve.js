/**
 * ============================================================================
 * ファイル名: system/drawing/pressure-curve.js
 * 責務: 筆圧カーブ(入力筆圧 → 実効筆圧)の制御点表現と評価。DOM / Pixi非依存の純粋関数。
 * 被依存: pointer-handler.js(評価), settings-manager.js(検証), settings-popup.js(編集UI)
 *
 * 制御点は [x, y] (0..1) の配列。x=0 と x=1 の端点を必ず持ち、xで昇順。
 * 補間は単調3次Hermite(Fritsch-Carlson)で、制御点間で行き過ぎ(overshoot)を起こさない。
 * ============================================================================
 */

export const MAX_PRESSURE_CURVE_POINTS = 8;

const sampleCurve = (fn) => [0, 0.25, 0.5, 0.75, 1].map(x => [x, Number(fn(x).toFixed(4))]);

/** 既存presetと同じ形を制御点で表したもの(編集の出発点用)。presetの評価自体は従来式のまま。 */
export const PRESSURE_CURVE_PRESETS = {
    linear: [[0, 0], [1, 1]],
    'ease-in': sampleCurve(p => 1 - (1 - p) * (1 - p)),
    'ease-out': sampleCurve(p => p * p)
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * 保存値 / 編集中の値を正規化する。不正なら null。
 * @param {Array<[number, number]>} points
 * @returns {Array<[number, number]>|null}
 */
export function normalizePressureCurvePoints(points) {
    if (!Array.isArray(points)) return null;
    const valid = points
        .filter(p => Array.isArray(p) && p.length >= 2 && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1])))
        .map(p => [clamp01(Number(p[0])), clamp01(Number(p[1]))])
        .sort((a, b) => a[0] - b[0]);
    if (valid.length < 2) return null;

    const start = valid.find(p => p[0] === 0) || [0, valid[0][1]];
    const end = [...valid].reverse().find(p => p[0] === 1) || [1, valid[valid.length - 1][1]];
    const inner = [];
    for (const p of valid) {
        if (p[0] <= 0 || p[0] >= 1) continue;
        // 同じx付近の点は1つに寄せる(ゼロ幅区間を作らない)。
        const last = inner[inner.length - 1];
        if (last && p[0] - last[0] < 0.01) continue;
        inner.push(p);
    }
    const result = [start, ...inner.slice(0, MAX_PRESSURE_CURVE_POINTS - 2), end];
    return result.map(p => [Number(p[0].toFixed(4)), Number(p[1].toFixed(4))]);
}

/**
 * 制御点カーブを x(0..1) で評価する。
 * @param {Array<[number, number]>} points - normalize済みを想定(未正規化でも正規化して使う)
 * @param {number} x
 * @returns {number} 0..1
 */
export function evaluatePressureCurve(points, x) {
    const pts = normalizePressureCurvePoints(points);
    const t = clamp01(Number(x) || 0);
    if (!pts) return t;

    const n = pts.length;
    if (n === 2) {
        const [[x0, y0], [x1, y1]] = pts;
        return clamp01(y0 + (y1 - y0) * ((t - x0) / Math.max(1e-6, x1 - x0)));
    }

    // 区間の傾き
    const dx = [];
    const slope = [];
    for (let i = 0; i < n - 1; i++) {
        dx[i] = Math.max(1e-6, pts[i + 1][0] - pts[i][0]);
        slope[i] = (pts[i + 1][1] - pts[i][1]) / dx[i];
    }
    // 端点の接線は隣接区間の傾き、内部は調和平均(Fritsch-Carlson)。符号が変わる点は0で極値を平らにする。
    const tangent = new Array(n);
    tangent[0] = slope[0];
    tangent[n - 1] = slope[n - 2];
    for (let i = 1; i < n - 1; i++) {
        const a = slope[i - 1];
        const b = slope[i];
        if (a * b <= 0) {
            tangent[i] = 0;
        } else {
            const w1 = 2 * dx[i] + dx[i - 1];
            const w2 = dx[i] + 2 * dx[i - 1];
            tangent[i] = (w1 + w2) / (w1 / a + w2 / b);
        }
    }

    let i = 0;
    while (i < n - 2 && t > pts[i + 1][0]) i++;
    const h = dx[i];
    const s = (t - pts[i][0]) / h;
    const s2 = s * s;
    const s3 = s2 * s;
    const y = (2 * s3 - 3 * s2 + 1) * pts[i][1]
        + (s3 - 2 * s2 + s) * h * tangent[i]
        + (-2 * s3 + 3 * s2) * pts[i + 1][1]
        + (s3 - s2) * h * tangent[i + 1];
    return clamp01(y);
}
