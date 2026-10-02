/**
 * ============================================================================
 * ファイル名: system/drawing/pen-end-cut.js
 * 責務: 角ペンの「入り・抜きを四角く整える」ための、線の端を切り落とす矩形の計算（純粋関数）
 * 依存: なし（DOM / Pixi非依存）
 * 被依存: system/drawing/brush-core.js, build/verify-pen-end-cut.mjs
 * 公開API: computeStrokeEndCuts
 * 実装状態: ✅実装
 *
 * 考え方: 丸い線の端(半円)を、始点/終点を通る「水平または垂直の線」で切り落とす。進行方向が横寄りなら垂直な線、
 *   縦寄りなら水平な線で切る。足すのではなく切るので、斜めの線でも幅からはみ出る角が出ない。
 * ============================================================================
 */

/**
 * @param {Array<{x:number,y:number}>} points 線の点列(描き直し用の点)
 * @param {number} width 線幅(px)
 * @returns {Array<{x:number,y:number,width:number,height:number}>} 消す矩形(最大2つ: 入り / 抜き)
 */
export function computeStrokeEndCuts(points, width) {
    if (!Array.isArray(points) || points.length < 2 || !(width > 0)) return [];
    let length = 0;
    for (let i = 1; i < points.length; i += 1) length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    // 短すぎる線は切らない(本体まで削ってしまう)
    if (length < width * 1.5) return [];

    const reach = width * 0.9; // 進行方向を見る距離
    const margin = width * 1.5; // 切り落とす範囲(丸い端の半径より十分大きく)
    const heading = (fromIndex, step) => {
        const origin = points[fromIndex];
        for (let i = fromIndex + step; i >= 0 && i < points.length; i += step) {
            if (Math.hypot(points[i].x - origin.x, points[i].y - origin.y) >= reach) {
                return { x: points[i].x - origin.x, y: points[i].y - origin.y };
            }
        }
        const last = points[step > 0 ? points.length - 1 : 0];
        return { x: last.x - origin.x, y: last.y - origin.y };
    };

    const cuts = [];
    // 入り: 始点から見た進行方向の「手前側」を切る。進行方向dに対し、その反対側を消す。
    const startDir = heading(0, 1);
    cuts.push(cutBehind(points[0], startDir, margin, width, -1));
    // 抜き: 終点から見て、進行方向(=終点へ向かう向き)の「先」を切る。
    const endDir = heading(points.length - 1, -1); // 終点→手前 の向き
    cuts.push(cutBehind(points[points.length - 1], { x: -endDir.x, y: -endDir.y }, margin, width, 1));
    return cuts.filter(Boolean);
}

/**
 * 点pから、dirの向き(sign=+1: dirの前方 / -1: dirの後方)を、dirの主軸に垂直な線で切り落とす矩形。
 */
function cutBehind(p, dir, margin, width, sign) {
    if (!dir || (dir.x === 0 && dir.y === 0)) return null;
    const alongX = Math.abs(dir.x) >= Math.abs(dir.y);
    const direction = alongX ? Math.sign(dir.x) : Math.sign(dir.y);
    const side = direction * sign; // +1: +軸側を消す / -1: -軸側を消す
    const cross = margin; // 主軸に垂直な方向の半分の広さ
    if (alongX) {
        return { x: side > 0 ? p.x : p.x - margin, y: p.y - cross, width: margin, height: cross * 2 };
    }
    return { x: p.x - cross, y: side > 0 ? p.y : p.y - margin, width: cross * 2, height: margin };
}
