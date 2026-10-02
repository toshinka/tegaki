/**
 * ============================================================================
 * ファイル名: system/tone-geometry.js
 * 責務: スクリーントーン(網点/ひし形/線 + グラデーション)の純幾何。パラメータの正規化、濃度の計算、
 *       回転した格子の走査(セルの列挙)、保存値のsanitize。DOM / Pixi / Canvasを使わない。
 * 依存: なし
 * 被依存: system/tone-raster.js, ui/tone-panel.js, system/project-manager.js, build/verify-tone.mjs
 * 公開API: TONE_SHAPES, TONE_LIMITS, TONE_MAX_CELLS, defaultToneParams, normalizeToneParams, sanitizeToneData,
 *   toneDensityAt, countToneCells, forEachToneCell, TONE_DEFAULT_COLOR
 * 保存: Projectの正本ではない。QTPのトーンタブがUI設定(localStorage)と、確定Layerの layerData.tone
 *   (optional・sanitize済み)に保持する。画素は派生物で、更新で再生成する。
 *
 * モデル
 *   格子はキャンバス原点(0,0)を基準に angle 度だけ回し、間隔 pitch(px)で並べる。
 *   → 別のLayer/別の操作で貼ったトーンでも網点の位置がそろう(つなぎ目でずれない)。
 *   濃度 density(0..1)は「セル面積に対する塗り面積の比」。gradient=true なら ref(基準矩形)の中で
 *   gradAngle方向に density → density2 へ変化する(gradStart〜gradEnd の範囲、ease で補間)。
 * ============================================================================
 */

export const TONE_DEFAULT_COLOR = '#800000'; // futaba-maroon
export const TONE_MAX_CELLS = 1500000;

export const TONE_SHAPES = Object.freeze([
    { id: 'dot', label: '網点' },
    { id: 'diamond', label: 'ひし形' },
    { id: 'line', label: '線' }
]);

export const TONE_LIMITS = Object.freeze({
    pitch: { min: 3, max: 80 },
    density: { min: 0, max: 1 },
    angle: { min: 0, max: 359.5 }
});

function clamp(value, min, max, fallback = min) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export function defaultToneParams() {
    return {
        shape: 'dot',
        pitch: 10,
        angle: 45,
        density: 0.3,
        gradient: false,
        density2: 0,
        gradAngle: 90,        // 度。0=右へ増える / 90=下へ増える(画面座標)
        gradStart: 0,
        gradEnd: 1,
        ease: 'linear',
        color: TONE_DEFAULT_COLOR,
        crisp: false,         // 二値化(アンチエイリアスなし)
        fitArea: true,        // 基準矩形=現在のLayerの内容の外接矩形(falseならキャンバス全体)
        clipToLayer: true     // 現在のLayerへクリッピング(領域=そのLayerの絵)
    };
}

export function normalizeToneParams(raw) {
    const d = defaultToneParams();
    const s = raw && typeof raw === 'object' ? raw : {};
    const L = TONE_LIMITS;
    const start = clamp(s.gradStart ?? d.gradStart, 0, 1);
    const end = clamp(s.gradEnd ?? d.gradEnd, 0, 1);
    return {
        shape: TONE_SHAPES.some(x => x.id === s.shape) ? s.shape : d.shape,
        pitch: clamp(s.pitch ?? d.pitch, L.pitch.min, L.pitch.max),
        angle: clamp(s.angle ?? d.angle, L.angle.min, L.angle.max),
        density: clamp(s.density ?? d.density, 0, 1),
        gradient: s.gradient === true,
        density2: clamp(s.density2 ?? d.density2, 0, 1),
        gradAngle: clamp(s.gradAngle ?? d.gradAngle, 0, 359.5),
        gradStart: Math.min(start, end),
        gradEnd: Math.max(start, end),
        ease: s.ease === 'smooth' ? 'smooth' : 'linear',
        color: /^#[0-9a-f]{6}$/i.test(s.color || '') ? s.color.toLowerCase() : d.color,
        crisp: s.crisp === true,
        fitArea: s.fitArea === false ? false : true,
        clipToLayer: s.clipToLayer === false ? false : true
    };
}

/** 保存/復元境界。壊れたdataはnull。 */
export function sanitizeToneData(raw) {
    if (!raw || typeof raw !== 'object' || !raw.params || typeof raw.params !== 'object') return null;
    return { v: 1, params: normalizeToneParams(raw.params) };
}

/**
 * 点(x,y)の濃度(0..1)。refは基準矩形 {x,y,w,h}(グラデーションの範囲)。
 */
export function toneDensityAt(rawParams, ref, x, y) {
    const p = normalizeToneParams(rawParams);
    if (!p.gradient) return p.density;
    const rad = (p.gradAngle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const cx = ref.x + ref.w / 2;
    const cy = ref.y + ref.h / 2;
    // 方向に沿った矩形の半長(この範囲で0〜1)
    const half = Math.max(1e-6, (Math.abs(ref.w * cos) + Math.abs(ref.h * sin)) / 2);
    const raw = ((x - cx) * cos + (y - cy) * sin) / half * 0.5 + 0.5;
    const span = Math.max(1e-6, p.gradEnd - p.gradStart);
    let t = Math.min(1, Math.max(0, (raw - p.gradStart) / span));
    if (p.ease === 'smooth') t = t * t * (3 - 2 * t);
    return p.density + (p.density2 - p.density) * t;
}

/** 走査する格子の添字範囲(fill矩形を覆う)。fill={x,y,w,h}。 */
function latticeRange(p, fill) {
    const rad = (p.angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    // fillの四隅を格子座標(u,v)へ戻して添字の範囲を決める。pitch分の余白で端のセルも拾う。
    let minU = Infinity; let maxU = -Infinity; let minV = Infinity; let maxV = -Infinity;
    for (const [x, y] of [[fill.x, fill.y], [fill.x + fill.w, fill.y], [fill.x, fill.y + fill.h], [fill.x + fill.w, fill.y + fill.h]]) {
        const u = x * cos + y * sin;
        const v = -x * sin + y * cos;
        minU = Math.min(minU, u); maxU = Math.max(maxU, u);
        minV = Math.min(minV, v); maxV = Math.max(maxV, v);
    }
    return {
        cos,
        sin,
        i0: Math.floor(minU / p.pitch) - 1,
        i1: Math.ceil(maxU / p.pitch) + 1,
        j0: Math.floor(minV / p.pitch) - 1,
        j1: Math.ceil(maxV / p.pitch) + 1
    };
}

/** fill矩形を覆う格子のセル数(上限判定用)。 */
export function countToneCells(rawParams, fill) {
    const p = normalizeToneParams(rawParams);
    const r = latticeRange(p, fill);
    return Math.max(0, r.i1 - r.i0 + 1) * Math.max(0, r.j1 - r.j0 + 1);
}

/**
 * fill矩形に掛かるセルを列挙する。callback(x, y, density) — セル中心(キャンバス座標)と濃度。
 * 濃度0のセルは呼ばない。fill矩形から大きく外れるセルは呼ばない。
 * @returns {number} 呼んだセル数
 */
export function forEachToneCell(rawParams, ref, fill, callback) {
    const p = normalizeToneParams(rawParams);
    const r = latticeRange(p, fill);
    const margin = p.pitch;
    let count = 0;
    for (let j = r.j0; j <= r.j1; j += 1) {
        for (let i = r.i0; i <= r.i1; i += 1) {
            const u = i * p.pitch;
            const v = j * p.pitch;
            const x = u * r.cos - v * r.sin;
            const y = u * r.sin + v * r.cos;
            if (x < fill.x - margin || x > fill.x + fill.w + margin || y < fill.y - margin || y > fill.y + fill.h + margin) continue;
            const d = toneDensityAt(p, ref, x, y);
            if (d <= 0.0005) continue;
            callback(x, y, Math.min(1, d));
            count += 1;
        }
    }
    return count;
}
