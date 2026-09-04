import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, css, styleGuide] = await Promise.all([
    readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/animation-table-utility-lod.css', import.meta.url), 'utf8'),
    readFile(new URL('../../開発用資料保管庫/proposals/UI_CSSスタイルガイド.md', import.meta.url), 'utf8')
]);
const panelMethodStart = source.indexOf('_ensurePanelElement()');
const templateStart = source.indexOf('this.panel.innerHTML = `', panelMethodStart);
const templateEnd = source.indexOf('document.body.appendChild(this.panel);', templateStart);
assert.ok(panelMethodStart >= 0 && templateStart >= 0 && templateEnd > templateStart);

const template = source.slice(templateStart, templateEnd);
const clipRowStart = template.indexOf('anim-table-header-row--clip');
const clipRow = template.slice(clipRowStart);
assert.ok(clipRowStart >= 0, 'selected Clip projection stays inside the existing Clip header row');

for (const id of [
    'anim-selected-clip-actions',
    'anim-selected-clip-target',
    'anim-selected-clip-duration',
    'anim-selected-clip-duration-value',
    'anim-selected-clip-copy-btn',
    'anim-selected-clip-group-btn',
    'anim-selected-clip-delete-btn'
]) {
    assert.equal(template.split(`id="${id}"`).length - 1, 1, `${id} is mounted once`);
}

const pasteIndex = clipRow.indexOf('id="anim-paste-btn"');
const selectedActionsIndex = clipRow.indexOf('id="anim-selected-clip-actions"');
const closeIndex = clipRow.indexOf('id="anim-table-close-btn"');
assert.ok(pasteIndex >= 0 && selectedActionsIndex > pasteIndex && closeIndex > selectedActionsIndex,
    'Paste remains a separate current Frame/Lane action before the selected Clip strip');

const copyActionMarkup = template.match(/<button[^>]*id="anim-selected-clip-copy-btn"[\s\S]*?<\/button>/)?.[0] || '';
const deleteActionMarkup = template.match(/<button[^>]*id="anim-selected-clip-delete-btn"[\s\S]*?<\/button>/)?.[0] || '';
assert.ok(copyActionMarkup && deleteActionMarkup, 'selected Clip COPY/DELETE actions stay mounted as buttons');
assert.match(copyActionMarkup, /anim-selected-clip-action-btn--icon/, 'Copy uses the compact selected Clip icon action class');
assert.match(deleteActionMarkup, /anim-selected-clip-action-btn--icon/, 'Delete uses the compact selected Clip icon action class');
assert.match(copyActionMarkup, /\$\{UI_ICONS\.duplicate\}/, 'Copy projects the central duplicate icon');
assert.match(deleteActionMarkup, /\$\{UI_ICONS\.trash\}/, 'Delete projects the central trash icon');
assert.doesNotMatch(copyActionMarkup, />\s*COPY\s*</, 'Copy has no visible COPY literal after icon projection');
assert.doesNotMatch(deleteActionMarkup, />\s*DELETE\s*</, 'Delete has no visible DELETE literal after icon projection');
assert.doesNotMatch(copyActionMarkup, /<svg/, 'Copy does not duplicate inline SVG markup');
assert.doesNotMatch(deleteActionMarkup, /<svg/, 'Delete does not duplicate inline SVG markup');
assert.match(copyActionMarkup, /<span\s+aria-hidden="true">\$\{UI_ICONS\.duplicate\}<\/span>/,
    'Copy icon is decorative while the button keeps its accessible name');
assert.match(deleteActionMarkup, /<span\s+aria-hidden="true">\$\{UI_ICONS\.trash\}<\/span>/,
    'Delete icon is decorative while the button keeps its accessible name');
assert.match(copyActionMarkup, /title="[^"]*コピー[^\"]*Ctrl\+C/, 'Copy keeps an explicit title and shortcut');
assert.match(copyActionMarkup, /aria-label="[^"]*Copy[^\"]*Ctrl\+C/, 'Copy keeps an explicit accessible name and shortcut');
assert.match(deleteActionMarkup, /title="[^"]*削除[^\"]*Alt\+Delete/, 'Delete keeps an explicit title and destructive shortcut');
assert.match(deleteActionMarkup, /aria-label="[^"]*Delete[^\"]*Alt\+Delete/, 'Delete keeps an explicit accessible name and destructive shortcut');
assert.match(source, /projectedCopyBtn\.title\s*=\s*copyBtn\?\.title/, 'Copy title continues to follow the existing dynamic selection projection');
assert.match(source, /projectedCopyBtn\.setAttribute\(\s*'aria-label',[\s\S]*?selectedIds\.length[\s\S]*?Ctrl\+C/, 'Copy accessible text retains the selected count and shortcut');

assert.match(source, /selectedClipActions\.hidden\s*=\s*!hasSelectedClip;/,
    'selection is the display authority and clears stale projection');
assert.match(source, /durationProjection\.hidden\s*=\s*!isSingleUngroupedClip;/,
    'Duration projection is limited to one ungrouped selected Clip');
assert.match(source, /legacyClipActions\?\.classList\.toggle\('has-selected-clip-context', hasSelectedClip\);/,
    'legacy actions remain mounted while duplicate selected-Clip exposure is suppressed');
assert.match(source, /\.has-selected-clip-context #anim-copy-btn,[\s\S]*?#anim-group-btn,[\s\S]*?#anim-delete-active-btn\s*\{[\s\S]*?display:\s*none;/,
    'only projected Copy, Group, and Clip Delete are hidden from the legacy row');
assert.doesNotMatch(
    source.match(/\.anim-copy-paste-controls\.has-selected-clip-context[\s\S]*?\}/)?.[0] || '',
    /anim-paste-btn/,
    'Paste is never absorbed by the selected Clip projection'
);
assert.match(source, /\.anim-selected-clip-action-btn\[hidden\]\s*\{[\s\S]*?display:\s*none;/,
    'single-selection Group stays visually hidden despite the shared button display rule');

assert.match(source, /#anim-selected-clip-copy-btn'\)[\s\S]*?copySelectedCel\(\)/,
    'projected Copy reuses the existing clipboard authority');
assert.match(source, /#anim-selected-clip-group-btn'\)[\s\S]*?toggleSelectedClipGroup\(\)/,
    'projected Group reuses the existing group authority');
assert.match(source, /#anim-selected-clip-delete-btn'\)[\s\S]*?deleteSelectedClips\(\)/,
    'projected Delete is explicitly Clip-only');
assert.match(source, /#anim-delete-active-btn'[\s\S]*?deleteActiveSelection\(\)/,
    'legacy dual-authority Delete remains available for Lane-only selection');
assert.match(source, /Math\.abs\(dx\) > 4 \|\| Math\.abs\(dy\) > 4/,
    'Clip move keeps the existing 4px threshold');

assert.doesNotMatch(source, /\.anim-selected-clip-actions\s*\{[\s\S]*?border:/,
    'selected Clip static appearance is no longer duplicated in the runtime style block');
assert.match(css, /\.animation-table-panel \.anim-table-utility-row \.anim-selected-clip-actions\s*\{[\s\S]*?border:\s*0;[\s\S]*?box-shadow:\s*none;/,
    'the contextual strip uses one quiet surface without a second selection frame');
assert.match(css, /\.anim-selected-clip-actions::before\s*\{[\s\S]*?background:\s*var\(--active-border\)/,
    'a compact active dot preserves the selected Clip association');
assert.match(css, /\.anim-selected-clip-duration\s*\{[\s\S]*?border-left:\s*0;/,
    'duration grouping uses spacing instead of a permanent separator');
assert.match(css, /\.anim-selected-clip-duration-btn,[\s\S]*?\.anim-selected-clip-action-btn\s*\{[\s\S]*?border-color:\s*transparent;[\s\S]*?background:\s*transparent;/,
    'context actions stay frameless at rest');
assert.match(css, /\.anim-selected-clip-duration-btn:focus-visible,[\s\S]*?\.anim-selected-clip-action-btn:focus-visible\s*\{[\s\S]*?outline:\s*2px solid var\(--active-border\)/,
    'keyboard focus remains explicit after resting borders are removed');
assert.match(css, /\.anim-selected-clip-action-btn--icon\s*\{[\s\S]*?width:\s*22px;[\s\S]*?min-width:\s*22px;[\s\S]*?height:\s*18px;[\s\S]*?border:\s*0;/,
    'icon actions use the compact 22x18 frameless hit footprint');
assert.match(css, /\.anim-selected-clip-action-btn--icon svg\s*\{[\s\S]*?width:\s*12px;[\s\S]*?height:\s*12px;[\s\S]*?fill:\s*none;[\s\S]*?stroke:\s*currentColor;[\s\S]*?stroke-linecap:\s*round;[\s\S]*?stroke-linejoin:\s*round;/,
    'icon actions use currentColor stroke and Lucide-compatible compact SVG geometry');
assert.match(css, /\.anim-selected-clip-action-btn--delete\s*\{[\s\S]*?color:\s*var\(--futaba-maroon\)/,
    'Delete retains its Futaba destructive role color');

assert.match(styleGuide, /`UI_ICONS`、`開発用資料保管庫\/資料_svg`、公式Lucideの順に検索する/,
    'the style guide records the SVG lookup order');
assert.match(styleGuide, /customは公式Lucideと称せず/,
    'custom SVGs are not misrepresented as official Lucide');
assert.match(styleGuide, /viewBox="0 0 24 24".*currentColor.*fill="none".*round cap \/ join.*stroke/,
    'the style guide fixes the custom SVG geometry and palette contract');
assert.match(styleGuide, /再利用するcustom iconはinline複製せず `UI_ICONS` へ集約/,
    'the style guide centralizes reusable custom icons');

console.log('verify-animation-table-selected-clip-actions: contextual projection, central COPY/DELETE icons, compact frameless states, focus, SVG policy, Paste/Lane authority and Clip gesture boundary OK');
