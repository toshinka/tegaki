/**
 * ============================================================================
 * ファイル名: ui/brush-preset-icons.js
 * 責務: 筆プリセット(QTP二行目)のSVGアイコン。名前は文字ではなくアイコン + ポップアップ(title)で示す
 * 依存: ui/ui-icons.js
 * 被依存: ui/quick-access-popup.js
 * 公開API: getBrushPresetIcon
 * 実装状態: ✅実装
 *
 * 組み込みはlucideの絵を流用。ユーザー保存のものは種類の絵 + 番号。濃淡(tone)で性格を表す:
 *   soft=薄い(ふんわり・やわらかい) / normal / strong=反転(くっきり。ふたば濃茶の地に明るい絵)
 * 絵はlucide風(viewBox24, stroke1.5, round)。色は currentColor のみ(ふたば色はCSS側)。
 * ============================================================================
 */

import { UI_ICONS } from './ui-icons.js';

const svg = (body, extra = '') =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ${extra}>${body}</svg>`;

// lucideの絵を流用(stroke 1.5に統一)。同じ絵の「濃淡・反転」で性格を表す。
const NIB = svg('<path d="M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z"/><path d="m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18"/><path d="m2.3 2.3 7.286 7.286"/><circle cx="11" cy="11" r="2"/>'); // pen-tool
const MILI = svg('<path d="M13 21h8"/><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>'); // pen-line
const PENCIL = svg('<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>'); // pencil
const SQUARE_PEN = svg('<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>'); // square-pen
const SPRAY = UI_ICONS.airbrush; // 噴霧缶(ツールボタンと同じ絵。濃淡/反転で標準・くっきり・ふんわりを分ける)

const BUILTIN = {
    'builtin-pen-standard': { svg: UI_ICONS.pen, tone: 'normal' },
    'builtin-pen-ink': { svg: NIB, tone: 'normal' },
    'builtin-pen-mili': { svg: MILI, tone: 'normal' },
    'builtin-pen-square': { svg: SQUARE_PEN, tone: 'normal' },
    'builtin-pen-square-follow': { svg: SQUARE_PEN, tone: 'strong' },
    'builtin-pen-pencil': { svg: PENCIL, tone: 'soft' },
    'builtin-eraser-standard': { svg: UI_ICONS.eraser, tone: 'normal' },
    'builtin-eraser-square': { svg: UI_ICONS.eraser, tone: 'strong' },
    'builtin-airbrush-standard': { svg: SPRAY, tone: 'normal' },
    'builtin-airbrush-hard': { svg: SPRAY, tone: 'strong' },
    'builtin-airbrush-soft': { svg: SPRAY, tone: 'soft' }
};

/**
 * @param {'pen'|'airbrush'|'eraser'} tool
 * @param {{id:string, builtin?:boolean}} preset
 * @param {number} userIndex ユーザー保存presetの通し番号(1始まり)
 * @returns {{ svg: string, tone: 'soft'|'normal'|'strong', badge: string }}
 */
export function getBrushPresetIcon(tool, preset, userIndex = 0) {
    const known = BUILTIN[preset?.id];
    if (known) return { ...known, badge: '' };
    return {
        svg: tool === 'airbrush' ? SPRAY : (tool === 'eraser' ? UI_ICONS.eraser : UI_ICONS.pen),
        tone: 'normal',
        badge: userIndex > 0 ? String(userIndex) : ''
    };
}
