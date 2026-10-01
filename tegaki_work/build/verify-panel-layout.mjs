import assert from 'node:assert/strict';
import {
    PANEL_PRESETS,
    buildPresetById,
    createPanelTree,
    dragSplitRatio,
    hitTestPanel,
    hitTestSplit,
    listPanels,
    removePanel,
    resolvePanelLayout,
    setPanelBleed,
    splitPanel,
    updateSplit
} from '../system/panel-layout.js';

const canvas = { width: 1000, height: 1400 };
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} !~ ${b}`);
const area = (q) => {
    let s = 0;
    for (let i = 0; i < 4; i += 1) {
        const p = q[i];
        const r = q[(i + 1) % 4];
        s += p.x * r.y - r.x * p.y;
    }
    return Math.abs(s) / 2;
};

// 単一コマ: 余白だけ内側に入る
{
    const r = resolvePanelLayout(createPanelTree(), canvas, { margin: 50, gap: 20 });
    assert.equal(r.panels.length, 1);
    near(area(r.panels[0].quad), 900 * 1300);
    assert.equal(r.valid, true);
}

// 水平二分割: 間隔がちょうどgap、面積比がratio
{
    let tree = createPanelTree();
    tree = splitPanel(tree, tree.id, 'h', 0.5);
    const r = resolvePanelLayout(tree, canvas, { margin: 0, gap: 20 });
    assert.equal(r.panels.length, 2);
    const [top, bottom] = r.panels.map(p => p.quad);
    near(bottom[0].y - top[3].y, 20);
    near(top[3].y, 690);
    near(area(top), 1000 * 690);
    near(area(bottom), 1000 * 690);
}

// 垂直二分割 + gap上書き
{
    let tree = createPanelTree();
    tree = splitPanel(tree, tree.id, 'v', 0.3);
    tree = updateSplit(tree, tree.id, { gap: 0 });
    const r = resolvePanelLayout(tree, canvas, { margin: 0, gap: 40 });
    near(r.panels[0].quad[1].x, 300);
    near(r.panels[1].quad[0].x, 300);
}

// 傾き: gapは切断線に垂直な距離のまま保たれる
{
    let tree = createPanelTree();
    tree = splitPanel(tree, tree.id, 'h', 0.5, { slant: 0.1 });
    const r = resolvePanelLayout(tree, canvas, { margin: 0, gap: 30 });
    const [top, bottom] = r.panels.map(p => p.quad);
    const d = { x: top[2].x - top[3].x, y: top[2].y - top[3].y };
    const len = Math.hypot(d.x, d.y);
    const n = { x: -d.y / len, y: d.x / len };
    const dist = Math.abs((bottom[0].x - top[3].x) * n.x + (bottom[0].y - top[3].y) * n.y);
    near(dist, 30, 1e-6);
    assert.ok(Math.abs(top[3].y - top[2].y) > 1);
}

// プリセット: 全てコマ数が定義どおり・間隔が保たれ・重ならない(面積合計 < 全体)
for (const preset of PANEL_PRESETS) {
    const tree = buildPresetById(preset.id);
    const r = resolvePanelLayout(tree, canvas, { margin: 30, gap: 12 });
    assert.ok(r.valid, preset.id);
    assert.equal(r.panels.length, listPanels(tree).length);
    const total = r.panels.reduce((s, p) => s + area(p.quad), 0);
    assert.ok(total <= 940 * 1340 + 1e-6, `${preset.id} area`);
    assert.ok(total > 940 * 1340 * 0.8, `${preset.id} coverage`);
}
assert.deepEqual(
    PANEL_PRESETS.map(p => listPanels(buildPresetById(p.id)).length),
    [1, 2, 2, 4, 4, 5, 6, 5, 4]
);

// 削除は兄弟が領域を引き継ぐ。最後の1コマは消えない
{
    let tree = buildPresetById('grid4');
    const ids = listPanels(tree).map(p => p.id);
    tree = removePanel(tree, ids[0]);
    assert.equal(listPanels(tree).length, 3);
    const single = createPanelTree();
    assert.equal(removePanel(single, single.id), single);
}

// bleed: 外周へ伸ばす
{
    let tree = createPanelTree();
    tree = setPanelBleed(tree, tree.id, { top: true, left: true });
    const r = resolvePanelLayout(tree, canvas, { margin: 60, gap: 0 });
    const q = r.panels[0].quad;
    assert.equal(q[0].x, 0);
    assert.equal(q[0].y, 0);
    assert.equal(q[2].x, 940);
    assert.equal(q[2].y, 1340);
}

// ヒットテストとドラッグ
{
    let tree = createPanelTree();
    tree = splitPanel(tree, tree.id, 'h', 0.5);
    const r = resolvePanelLayout(tree, canvas, { margin: 0, gap: 20 });
    assert.equal(hitTestPanel(r, { x: 500, y: 100 }), r.panels[0].id);
    assert.equal(hitTestPanel(r, { x: 500, y: 1300 }), r.panels[1].id);
    assert.equal(hitTestPanel(r, { x: 500, y: 700 }), null);
    assert.equal(hitTestSplit(r, { x: 400, y: 705 }, 8), tree.id);
    assert.equal(hitTestSplit(r, { x: 400, y: 300 }, 8), null);
    near(dragSplitRatio(r, tree.id, { x: 500, y: 420 }), 0.3);
    near(dragSplitRatio(r, tree.id, { x: 500, y: -50 }), 0.05);
}

// 潰れ検出
{
    let tree = createPanelTree();
    tree = splitPanel(tree, tree.id, 'h', 0.05);
    assert.equal(resolvePanelLayout(tree, canvas, { margin: 0, gap: 200 }).valid, false);
    assert.equal(resolvePanelLayout(tree, canvas, { margin: 0, gap: 10 }).valid, true);
}

console.log('panel-layout verifier: split / gap / slant / presets / remove / bleed / hit-test / collapse ok');
