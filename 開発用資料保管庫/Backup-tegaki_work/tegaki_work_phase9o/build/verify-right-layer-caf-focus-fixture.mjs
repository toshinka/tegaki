import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [fixture, phase, renderer, table, githubUrls] = await Promise.all([
    readFile(new URL('./phase9l-right-layer-caf-focus-fixture.html', import.meta.url), 'utf8'),
    readFile(new URL('../../開発用資料保管庫/Archive/phase9l.md', import.meta.url), 'utf8'),
    readFile(new URL('../ui/layer-panel-renderer.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../GitHubURL.txt', import.meta.url), 'utf8')
]);

assert.equal(fixture.match(/class="comparison-shell"/g)?.length, 1,
    'Phase 9l compares candidates in one state shell');
for (const candidate of ['current', 'compact', 'handoff', 'flat']) {
    assert.match(fixture, new RegExp(`data-value="${candidate}"`), `${candidate} candidate control exists`);
    assert.match(fixture, new RegExp(`data-candidate="${candidate}"|data-candidate="[^\"]+"[^]*?\[data-candidate="${candidate}"\]`),
        `${candidate} candidate is represented in the fixture`);
}
for (const state of [
    'data-control="table"',
    'data-control="density"',
    'data-control="caf-count"',
    'data-control="viewport"',
    'data-table="closed"',
    'data-density="many"',
    'data-caf-count="multi"',
    'data-viewport="wide"'
]) {
    assert.ok(fixture.includes(state), `${state} comparison state exists`);
}
for (const contract of [
    'CAF 1 · Lane 1',
    '現在の描画target',
    'CAF順序・階層・複数管理',
    'CAF順序・階層・内部Layer D&amp;D',
    'CAF 2は右Panelへ積まずTableで選択',
    'TABLEを開く',
    'Table閉鎖中context'
]) {
    assert.ok(fixture.includes(contract), `${contract} remains visible in the responsibility comparison`);
}
assert.doesNotMatch(fixture, /localStorage|sessionStorage|saveTheme|artSampling/u,
    'fixture does not add saved view state or automatic art sampling');
assert.match(fixture, /shell\.setAttribute\(`data-\$\{key\}`,[\s\S]*?button\.dataset\.value\)/u,
    'hyphenated fixture controls update their data attributes without DOMStringMap errors');
assert.doesNotMatch(fixture, /(?:#000(?:000)?(?![0-9a-f])|#fff(?:fff)?(?![0-9a-f])|\bblack\b|\bwhite\b|\bgray\b)/iu,
    'fixture keeps the Futaba palette instead of black, white or neutral gray literals');

assert.match(renderer, /createCafReadonlyHeader\(\)/u,
    'Layer Panel renderer remains the CAF identity display adapter');
assert.match(renderer, /selectedInternalLayerId/u,
    'Layer Panel mirror projects the existing internal selection identity');
assert.match(renderer, /selectClipAssetFromExternal/u,
    'Layer Panel delegates CAF selection through the existing Animation Table adapter');
assert.match(table, /renameClipAssetFolderFromExternal/u,
    'Animation Table keeps existing CAF identity mutation authority');
assert.match(table, /selectedInternalLayerId/u,
    'Animation Table keeps the selected internal layer authority');
assert.match(table, /copySelectedCel\(\)/u,
    'Animation Table keeps Clip copy authority');
assert.doesNotMatch(renderer, /phase9l|compact-identity|context-handoff/u,
    'candidate fixture state has not entered the production renderer');
assert.doesNotMatch(table, /phase9l|compact-identity|context-handoff/u,
    'candidate fixture state has not entered the production Animation Table');

assert.match(phase, /1 UI engine \/ 2 data adapter/u);
assert.match(phase, /Table visibilityをdata authority切替に使わない/u);
assert.match(phase, /Stage Aはproduction DOM \/ event \/ ARIA \/ hit area \/ LayerSystem \/ TimelineModel \/ ClipAsset \/ History \/ saveを変更しない/u);
assert.match(phase, /A Current stack/u);
assert.match(phase, /B Compact identity \+ focused mirror/u);
assert.match(phase, /C Context handoff/u);
assert.match(phase, /D Flat CAF context \+ unified layer list/u);
assert.match(githubUrls, /phase9l-right-layer-caf-focus-fixture\.html/u,
    'GitHubURL navigation exposes the Phase 9l comparison fixture');
assert.match(githubUrls, /verify-right-layer-caf-focus-fixture\.mjs/u,
    'GitHubURL navigation exposes the Phase 9l fixed verifier');

console.log('verify-right-layer-caf-focus-fixture: one state shell, A/B/C/D responsibility comparison, adapter authority and production isolation OK');
