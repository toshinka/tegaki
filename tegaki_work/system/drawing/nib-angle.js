/**
 * ファイル名: system/drawing/nib-angle.js
 * 責務: 角ペンの「方向に追従」。ペンを離した後の点列全体から、各点の四角いペン先の角度(度)を決める。
 * 水平・垂直に近い区間は0°(軸に揃った平らな端)、斜めの区間は進行方向に辺を揃えて太さを一定に保つ。
 * 描き始め/描き終わりは動きが遅く点が密なので、進行方向の判定に長い範囲を使う。
 */

const AXIS_DEADZONE_DEG = 4; // 軸からこの角度以内は0°のまま
const FOLLOW_RAMP_DEG = 10; // デッドゾーンを越えてから追従が全開になるまでの幅
const END_WINDOW_FACTOR = 2.5; // 端付近の判定範囲(太さ倍)
const MID_WINDOW_FACTOR = 1.0; // 中間の判定範囲(太さ倍)
const END_ZONE_FACTOR = 2.0;
const STRAIGHT_MIN = 0.8; // 判定範囲の直線度(弦/経路)がこれ未満なら折れ曲がり扱いでペン先を回さない
const STRAIGHT_RAMP = 0.1; // この長さ(太さ倍)以内を端とみなす
const SMOOTH_FACTOR = 1.4; // 角度を距離方向に均す範囲(太さ倍)

function pointAt(points, travel, distance) {
    const d = Math.max(0, Math.min(travel[travel.length - 1], distance));
    let lo = 0;
    let hi = travel.length - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (travel[mid] <= d) lo = mid; else hi = mid;
    }
    const span = travel[hi] - travel[lo];
    const t = span > 0 ? (d - travel[lo]) / span : 0;
    return { x: points[lo].x + (points[hi].x - points[lo].x) * t, y: points[lo].y + (points[hi].y - points[lo].y) * t };
}

function smoothstep(t) {
    const c = Math.max(0, Math.min(1, t));
    return c * c * (3 - 2 * c);
}

/** 進行方向(度)から目標角度(-45..45)。軸に近ければ0、斜めなら進行方向に辺を揃える。 */
export function targetNibAngle(headingDeg) {
    const mod = ((headingDeg % 90) + 90) % 90;
    const deviation = mod < 45 ? mod : mod - 90;
    const weight = smoothstep((Math.abs(deviation) - AXIS_DEADZONE_DEG) / FOLLOW_RAMP_DEG);
    return deviation * weight;
}

/**
 * @param {{x:number,y:number}[]} points
 * @param {number} width ペン先の太さ(px)
 * @returns {number[]} 各点のペン先角度(度, -45..45)。四角は90°対称なので4θの円周平均で均す。
 */
export function computeNibAngles(points, width) {
    const n = points.length;
    if (n < 2) return new Array(n).fill(0);
    const travel = [0];
    for (let i = 1; i < n; i++) travel[i] = travel[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    const total = travel[n - 1];
    if (total < width * 0.5) return new Array(n).fill(0);

    const raw = new Array(n);
    let last = 0;
    for (let i = 0; i < n; i++) {
        const nearEnd = travel[i] < width * END_ZONE_FACTOR || total - travel[i] < width * END_ZONE_FACTOR;
        const half = width * (nearEnd ? END_WINDOW_FACTOR : MID_WINDOW_FACTOR);
        const a = pointAt(points, travel, travel[i] - half);
        const b = pointAt(points, travel, travel[i] + half);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const chord = Math.hypot(dx, dy);
        if (chord > width * 0.3) {
            // 判定範囲が折れ曲がっている(カのような短い折れ)ときは回さず、直線的に続く区間だけ追従する
            const path = Math.min(total, travel[i] + half) - Math.max(0, travel[i] - half);
            const straight = path > 0 ? chord / path : 1;
            last = targetNibAngle((Math.atan2(dy, dx) * 180) / Math.PI) * smoothstep((straight - STRAIGHT_MIN) / STRAIGHT_RAMP);
        }
        raw[i] = last;
    }

    // 4θの円周平均で距離方向に均す(+45と-45は同じ四角なので折り返しで暴れない)
    const smoothHalf = width * SMOOTH_FACTOR;
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
        let sx = 0;
        let sy = 0;
        for (let j = i; j >= 0 && travel[i] - travel[j] <= smoothHalf; j--) {
            const t = (raw[j] * 4 * Math.PI) / 180;
            sx += Math.cos(t); sy += Math.sin(t);
        }
        for (let j = i + 1; j < n && travel[j] - travel[i] <= smoothHalf; j++) {
            const t = (raw[j] * 4 * Math.PI) / 180;
            sx += Math.cos(t); sy += Math.sin(t);
        }
        out[i] = (Math.atan2(sy, sx) * 180) / Math.PI / 4;
    }
    return out;
}

/** 90°周期での角度補間(最短側)。 */
export function lerpNibAngle(a, b, t) {
    let diff = ((b - a) % 90 + 90) % 90;
    if (diff > 45) diff -= 90;
    return a + diff * t;
}
