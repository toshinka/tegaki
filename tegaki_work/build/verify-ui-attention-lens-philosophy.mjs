/**
 * Phase 9m attention / intent-lens documentation gate.
 *
 * This verifier keeps the universal philosophy, operational UI rules, research
 * matrix, Phase stop condition, and authority routing aligned. It does not
 * authorize production Clip Focus behavior or add runtime state.
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [tegaki, styleGuide, proposal, phase, authorityMap] = await Promise.all([
    readFile(new URL('../../TEGAKI.md', import.meta.url), 'utf8'),
    readFile(new URL('../../開発用資料保管庫/proposals/UI_CSSスタイルガイド.md', import.meta.url), 'utf8'),
    readFile(new URL('../../開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md', import.meta.url), 'utf8'),
    readFile(new URL('../../開発用資料保管庫/Archive/phase9m.md', import.meta.url), 'utf8'),
    readFile(new URL('../UI_DESIGN_AUTHORITY_MAP.md', import.meta.url), 'utf8')
]);

assert.match(tegaki, /外部toolは「水平参照」[\s\S]*?人気がある、多数が同じ配置という事実だけを設計正本にしない/,
    'Tegaki keeps horizontal comparison separate from project authority');
assert.match(tegaki, /役割別watchlist[\s\S]*?公式資料の確認日と正式version名[\s\S]*?Ownerの定性的な優先度/,
    'horizontal comparison remains role-based, fresh, and explicit about qualitative support priority');
assert.match(tegaki, /注目度は有限の予算[\s\S]*?contrast基準は可読性の下限/,
    'attention is a bounded task-dependent budget rather than a contrast score');
assert.match(tegaki, /通常selectionと深い編集への進入を暗黙に同一化せず[\s\S]*?breadcrumb/,
    'focus lenses require explicit entry, visible context, and a return path');
assert.match(tegaki, /ふたば☆ちゃんねるpaletteは単なる懐古的skinでなく[\s\S]*?文化・識別・安心感の哲学/,
    'the Futaba palette remains a cultural design authority');
assert.match(tegaki, /context windowが短いAI[\s\S]*?正本、変更禁止境界、検証入口/,
    'file headers retain compact current contracts for human and AI maintenance');

assert.match(styleGuide, /Attention Budget \/ Intent Lens/,
    'the operational style guide owns attention-lens implementation rules');
assert.match(styleGuide, /current warm \/ dark top \/ dark bottom \/ dark bothまたはFocus時だけ/,
    'Timeline tone variants stay behind one comparison gate');
assert.match(styleGuide, /Lane交互濃淡[\s\S]*?低差Futaba zebra[\s\S]*?semantic band/,
    'Lane striping is compared against uniform and semantic grouping');
assert.match(styleGuide, /Clip通常clickはselection \/ move \/ retime[\s\S]*?in-place切替/,
    'normal Clip click does not become an implicit deep-focus action');

for (const source of [
    'helpx.adobe.com/ie/fresco/desktop/draw-paint-animate-and-share/apply-motion-to-artwork.html',
    'callipeg.com/',
    'help.clip-studio.com/en-us/manual_en/090_tablet/Simple_Mode_and_Studio_Mode.htm',
    'toonsquid.com/updates/ToonSquid-2/',
    'toonsquid.com/handbook/interface/timeline/',
    'help.procreate.com/articles/8AzGf-procreate-dreams-2-update-at-a-glance',
    'help.procreate.com/dreams/handbook/interface-and-gestures/timeline',
    'rive.app/docs/editor/animate-mode/timeline',
    'docs.live2d.com/en/cubism-editor-manual/grapheditor/',
    'us.esotericsoftware.com/spine-dopesheet',
    'help.clip-studio.com/en-us/manual_en/600_animation/Timeline_Palette.htm',
    'helpx.adobe.com/after-effects/using/animation-basics.html',
    'helpx.adobe.com/premiere/desktop/edit-projects/intro-to-editing/edit-video-using-the-properties-panel.html',
    'helpx.adobe.com/animate/desktop/animation/frames-keyframes.html',
    'pmc.ncbi.nlm.nih.gov/articles/PMC8965574/',
    'microsoft.com/en-us/research/publication/the-prevention-of-mode-errors-through-sensory-feedback/',
    'research.adobe.com/publication/web-table-formatting-affects-readability-on-mobile-devices/'
]) {
    assert.match(proposal, new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        `research matrix retains ${source}`);
}

assert.match(proposal, /modern drawing \/ 段階露出[\s\S]*?pen \/ touch animation[\s\S]*?character Rig \/ property密度[\s\S]*?video \/ motion \/ 長時間軸/,
    'the watchlist keeps drawing, touch animation, rig, and video comparison roles distinct');
assert.match(proposal, /Callipeg Studio、ToonSquid 2\.0、Procreate Dreams 2/,
    'the three current pen and touch animation peers remain co-equal comparisons');
assert.match(proposal, /Adobe Animate[\s\S]*?maintenance mode[\s\S]*?現行モダン化の先行例には置かない/,
    'maintenance products remain historical grammar references rather than current modernization authority');

assert.match(proposal, /現行の選択後auto detail[\s\S]*?anchored Clip window[\s\S]*?Animation Table全体をin-place `CLIP FOCUS`[\s\S]*?Lane overview＋detail split/,
    'the four Clip Focus surfaces remain comparable in one matrix');
assert.match(proposal, /single click自動進入は棄却/,
    'normal single-click entry is rejected');
assert.match(proposal, /selected CAFのBottom contextual actionに明示`FOCUS`[\s\S]*?keyboard `Enter`/,
    'explicit contextual Focus and keyboard entry remain the first candidate');
assert.match(proposal, /Ownerの一行header visual受入前はfixture \/ productionへ進めず/,
    'research does not bypass the Owner header gate');

assert.match(phase, /Attention \/ Clip Focus 水平調査境界/,
    'the current Phase records the research checkpoint');
assert.match(phase, /Ownerが一行headerを実画面受入する前はClip Focus fixture \/ productionへ進まない/,
    'the Phase stop condition remains explicit');
assert.match(authorityMap, /普遍理念は`TEGAKI\.md`[\s\S]*?operational rule[\s\S]*?調査・比較matrix/,
    'authority routing prevents duplicated design-source narratives');

console.log('verify-ui-attention-lens-philosophy: role watchlist, source freshness, attention budget, Futaba philosophy, Clip Focus gate and authority routing OK');
