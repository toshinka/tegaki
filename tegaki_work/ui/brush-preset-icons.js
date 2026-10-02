/**
 * ============================================================================
 * ファイル名: ui/brush-preset-icons.js
 * 責務: 筆プリセット(QTP二行目)のSVGアイコン。名前は文字ではなくアイコン + ポップアップ(title)で示す
 * 依存: ui/ui-icons.js
 * 被依存: ui/quick-access-popup.js
 * 公開API: getBrushPresetIcon
 * 実装状態: ✅実装
 *
 * 組み込みは固有の絵。ユーザー保存のものは種類の絵 + 番号。濃淡(tone)で性格を表す:
 *   soft=薄い(ふんわり・やわらかい) / normal / strong=濃い(くっきり)
 * 絵はlucide風(viewBox24, stroke1.5, round)。色は currentColor のみ(ふたば色はCSS側)。
 * ============================================================================
 */

import { UI_ICONS } from './ui-icons.js';

const svg = (body, extra = '') =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ${extra}>${body}</svg>`;

// つけペン(Gペン)のペン先: ひし形 + 中央のスリット + 穴
const NIB = svg('<path d="M12 2.5 17.5 11 12 21.5 6.5 11Z"/><path d="M12 11v10"/><circle cx="12" cy="9" r="1.2"/>');
// ミリペン: 一定線幅の細いペン(軸 + 丸い先端 + 均一な線)
const MILI = svg('<path d="M9 3h6v9H9z"/><path d="M12 12v6"/><circle cx="12" cy="20" r="1.2"/>');
const PENCIL = svg('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>');
// エアブラシ: 噴霧の点のまとまり(点の数・大きさ・塗りで性格を出す)
const dots = (items) => svg(items.map(([x, y, r, fill]) =>
    `<circle cx="${x}" cy="${y}" r="${r}"${fill ? ' fill="currentColor"' : ''}/>`).join(''));
const SPRAY_STANDARD = dots([[6, 7, 1.4, 1], [12, 5, 1, 0], [17, 8, 1.6, 1], [9, 12, 1.2, 0], [15, 14, 1.4, 1], [7, 17, 1, 0], [13, 19, 1.2, 0], [19, 18, 1, 1]]);
const SPRAY_HARD = dots([[7, 7, 2.2, 1], [15, 6, 2.2, 1], [11, 13, 2.4, 1], [18, 15, 2, 1], [6, 17, 2, 1]]);
const SPRAY_SOFT = dots([[5, 6, 1, 0], [9, 4, 1, 0], [14, 6, 1, 0], [18, 5, 1, 0], [7, 10, 1, 0], [12, 10, 1, 0], [17, 11, 1, 0], [5, 15, 1, 0], [10, 15, 1, 0], [15, 16, 1, 0], [19, 17, 1, 0], [8, 20, 1, 0], [13, 20, 1, 0]]);

const BUILTIN = {
    'builtin-pen-standard': { svg: UI_ICONS.pen, tone: 'normal' },
    'builtin-pen-ink': { svg: NIB, tone: 'strong' },
    'builtin-pen-mili': { svg: MILI, tone: 'normal' },
    'builtin-pen-pencil': { svg: PENCIL, tone: 'soft' },
    'builtin-airbrush-standard': { svg: SPRAY_STANDARD, tone: 'normal' },
    'builtin-airbrush-hard': { svg: SPRAY_HARD, tone: 'strong' },
    'builtin-airbrush-soft': { svg: SPRAY_SOFT, tone: 'soft' }
};

/**
 * @param {'pen'|'airbrush'} tool
 * @param {{id:string, builtin?:boolean}} preset
 * @param {number} userIndex ユーザー保存presetの通し番号(1始まり)
 * @returns {{ svg: string, tone: 'soft'|'normal'|'strong', badge: string }}
 */
export function getBrushPresetIcon(tool, preset, userIndex = 0) {
    const known = BUILTIN[preset?.id];
    if (known) return { ...known, badge: '' };
    return {
        svg: tool === 'airbrush' ? SPRAY_STANDARD : UI_ICONS.pen,
        tone: 'normal',
        badge: userIndex > 0 ? String(userIndex) : ''
    };
}
