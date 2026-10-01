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

// ---- WP-010 phase 3: 隣接追従 / 外周 / 削除 / 番号 / 整列 / 保存境界
import {
    alignLayout,
    dragPanelCorner,
    hitTestCorner,
    numberPanels,
    resetOuterCorners,
    sanitizePanelLayoutData,
    setPanelDeleted,
    setPanelLineWidth,
    snapSplitPoint
} from '../system/panel-layout.js';

function findNodeLocal(node, id) {
    if (node.id === id) return node;
    return node.kind === 'split' ? findNodeLocal(node.a, id) || findNodeLocal(node.b, id) : null;
}
// 切断線に垂直な2コマ間の距離
function gutter(topQuad, botQuad) {
    const d = { x: topQuad[2].x - topQuad[3].x, y: topQuad[2].y - topQuad[3].y };
    const len = Math.hypot(d.x, d.y);
    const n = { x: -d.y / len, y: d.x / len };
    return Math.abs((botQuad[0].x - topQuad[3].x) * n.x + (botQuad[0].y - topQuad[3].y) * n.y);
}

{
    // 頂点ドラッグ: 斜めにしても隣のコマが指定の間隔で追従する
    let tree = createPanelTree();
    tree = splitPanel(tree, tree.id, 'h', 0.5);
    const gap = 24;
    let r = resolvePanelLayout(tree, canvas, { margin: 0, gap });
    const top = r.panels[0];
    // 上コマの右下(index 2)を斜め下へ引く
    tree = dragPanelCorner(tree, r, top.id, 2, { x: top.quad[2].x, y: top.quad[2].y + 120 });
    r = resolvePanelLayout(tree, canvas, { margin: 0, gap });
    near(gutter(r.panels[0].quad, r.panels[1].quad), gap, 1e-6);
    assert.ok(r.panels[0].quad[2].y > r.panels[0].quad[3].y + 50, 'slanted');
    // 動かした頂点はポインタ近傍(間隔補正込み)に来る
    assert.ok(Math.abs(r.panels[0].quad[2].y - (top.quad[2].y + 120)) < 4);
    // 下コマの右上(index 1)も同じ線の端: 反対側のコマからも同じ線を動かせる
    const bottom = r.panels[1];
    tree = dragPanelCorner(tree, r, bottom.id, 1, { x: bottom.quad[1].x, y: bottom.quad[1].y - 80 });
    r = resolvePanelLayout(tree, canvas, { margin: 0, gap });
    near(gutter(r.panels[0].quad, r.panels[1].quad), gap, 1e-6);
}

{
    // 外周頂点: 全コマが追従し、根の差し替え(分割/結合)でも外周は保たれる
    let tree = createPanelTree();
    tree = splitPanel(tree, tree.id, 'v', 0.5);
    let r = resolvePanelLayout(tree, canvas, { margin: 0, gap: 10 });
    tree = dragPanelCorner(tree, r, r.panels[0].id, 0, { x: 50, y: 70 });
    assert.deepEqual(tree.outer[0], [50, 70]);
    r = resolvePanelLayout(tree, canvas, { margin: 0, gap: 10 });
    near(r.panels[0].quad[0].x, 50);
    near(r.panels[0].quad[0].y, 70);
    const [p0] = listPanels(tree);
    tree = splitPanel(tree, p0.id, 'h', 0.5);
    assert.deepEqual(tree.outer[0], [50, 70], 'outer carried to new root');
    assert.equal(findNodeLocal(tree, p0.id).outer, undefined);
    assert.equal(resetOuterCorners(tree).outer, undefined);
}

{
    // 削除: 番号を飛ばし、描画対象から外れるが選択・復活は可能
    let tree = buildPresetById('grid4');
    const ids = [...numberPanels(tree).keys()];
    tree = setPanelDeleted(tree, ids[1], true);
    const r = resolvePanelLayout(tree, canvas, { margin: 20, gap: 10 });
    assert.equal(r.panels.length, 4);
    assert.equal(r.panels.filter(p => p.deleted).length, 1);
    assert.deepEqual(r.panels.map(p => p.number).sort(), [1, 2, 3, null]);
    assert.equal(findNodeLocal(setPanelDeleted(tree, ids[1], false), ids[1]).deleted, undefined);
}

{
    // 日本式番号: 右上=1。2x2は 右上1 左上2 右下3 左下4
    const tree = buildPresetById('grid4');
    const r = resolvePanelLayout(tree, canvas, { margin: 0, gap: 10 });
    const at = (x, y) => r.panels.find(p => p.quad.every(() => true) && hitTestPanel(r, { x, y }) === p.id).number;
    assert.equal(at(750, 300), 1);
    assert.equal(at(250, 300), 2);
    assert.equal(at(750, 1100), 3);
    assert.equal(at(250, 1100), 4);
    // 右列が縦に2コマ・左が1コマ: 右上1 右下2 左3
    const l = resolvePanelLayout(buildPresetById('lshape'), canvas, { margin: 0, gap: 10 });
    const n = (x, y) => l.panels.find(p => hitTestPanel(l, { x, y }) === p.id).number;
    assert.equal(n(900, 100), 1);
    assert.equal(n(900, 500), 2);
    assert.equal(n(100, 300), 3);
}

{
    // 整列: 別の列のほぼ同じ高さの水平分割を揃え、小さな傾きを0にする
    let tree = createPanelTree();
    tree = splitPanel(tree, tree.id, 'v', 0.5);
    const [l, rr] = listPanels(tree);
    tree = splitPanel(tree, l.id, 'h', 0.5);
    tree = splitPanel(tree, rr.id, 'h', 0.5, { slant: 0.012 });
    const hs = [];
    const collect = (n) => { if (n.kind === 'split') { if (n.dir === 'h') hs.push(n); collect(n.a); collect(n.b); } };
    collect(tree);
    tree = updateSplit(tree, hs[0].id, { ratio: 0.5 });
    tree = updateSplit(tree, hs[1].id, { ratio: 0.5 + 8 / 1400 });
    const aligned = alignLayout(tree, canvas, { margin: 0, gap: 10 });
    assert.ok(aligned.changed >= 2);
    const r = resolvePanelLayout(aligned.tree, canvas, { margin: 0, gap: 10 });
    const ys = r.splits.filter(s => s.dir === 'h').map(s => s.cut[0].y);
    near(ys[0], ys[1], 0.01);
    assert.equal(findNodeLocal(aligned.tree, hs[1].id).slant, 0);
    // 離れた線は触らない
    const far = updateSplit(tree, hs[1].id, { ratio: 0.8, slant: 0 });
    const farAligned = alignLayout(updateSplit(far, hs[0].id, { ratio: 0.4 }), canvas, { margin: 0, gap: 10 });
    near(findNodeLocal(farAligned.tree, hs[1].id).ratio, 0.8, 1e-9);
    // ドラッグ中の吸着
    const rs = resolvePanelLayout(tree, canvas, { margin: 0, gap: 10 });
    const target = rs.splits.find(s => s.id === hs[0].id);
    const snapped = snapSplitPoint(rs, hs[1].id, { x: 700, y: target.cut[0].y + 3 }, 6);
    near(snapped.y, target.cut[0].y);
    assert.equal(snapSplitPoint(rs, hs[1].id, { x: 700, y: target.cut[0].y + 30 }, 6).y, target.cut[0].y + 30);
}

{
    // 個別線幅と保存境界
    let tree = createPanelTree();
    tree = splitPanel(tree, tree.id, 'v', 0.5);
    const [left] = listPanels(tree);
    tree = setPanelLineWidth(tree, left.id, 9);
    tree = setPanelDeleted(tree, left.id, true);
    tree = { ...tree, outer: [[1, 2], [0, 0], [0, 0], [0, 0]] };
    const r = resolvePanelLayout(tree, canvas, { margin: 0, gap: 0 });
    assert.equal(r.panels[0].lineWidth, 9);
    assert.equal(r.panels[1].lineWidth, null);
    assert.equal(hitTestCorner(r, left.id, { x: r.panels[0].quad[2].x + 3, y: r.panels[0].quad[2].y }, 8), 2);

    const clean = sanitizePanelLayoutData({
        v: 1, groupId: 'g1', role: 'paper', tree, params: { margin: 9999, gap: -4, lineWidth: 5 },
        color: 'red', paperColor: '#aabbcc', extra: 'x'
    });
    assert.equal(clean.role, 'paper');
    assert.equal(clean.params.margin, 400);
    assert.equal(clean.params.gap, 0);
    assert.equal(clean.color, '#800000', '既定色はふたば配色');
    assert.equal(clean.paperColor, '#aabbcc');
    assert.equal(clean.extra, undefined);
    assert.deepEqual(clean.tree.outer[0], [1, 2]);
    assert.equal(findNodeLocal(clean.tree, left.id).deleted, true);
    assert.equal(sanitizePanelLayoutData({ tree: { kind: 'split' } }), null);
    assert.equal(sanitizePanelLayoutData({ tree, role: 'folder' }).role, 'folder');
    assert.equal(sanitizePanelLayoutData({ tree }).paperColor, '#f0e0d6');
    const again = sanitizePanelLayoutData(JSON.parse(JSON.stringify(clean)));
    assert.deepEqual(resolvePanelLayout(again.tree, canvas, again.params).panels.map(q => q.quad),
        resolvePanelLayout(clean.tree, canvas, clean.params).panels.map(q => q.quad));
}
console.log('panel-layout verifier (phase 3): neighbour-follow corner drag / outer / delete / japanese numbering / align / snap / persistence ok');
