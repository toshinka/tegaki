import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRigSkinWeightOverlayPathPlan } from '../ui/rig-skin-weight-overlay.js';

const vertices = Array.from({ length: 15 }, (_, index) => ({
    vertexId: `v${index}`,
    x: index * 3,
    y: index % 2 === 0 ? 0 : 4
}));
const triangles = [
    { vertexIds: ['v0', 'v1', 'v2'], minWeight: 0, maxWeight: 0, averageWeight: 0 },
    { vertexIds: ['v3', 'v4', 'v5'], minWeight: 0, maxWeight: 0.02, averageWeight: 0.0067 },
    { vertexIds: ['v6', 'v7', 'v8'], minWeight: 0.1, maxWeight: 0.4, averageWeight: 0.25 },
    { vertexIds: ['v9', 'v10', 'v11'], minWeight: 0.3, maxWeight: 0.9, averageWeight: 0.6 },
    { vertexIds: ['v12', 'v13', 'v14'], minWeight: 1, maxWeight: 1, averageWeight: 1 }
];
const diagnostic = {
    ok: true,
    vertices,
    triangles,
    stats: { vertexCount: vertices.length, triangleCount: triangles.length }
};
const before = structuredClone(diagnostic);
const plan = createRigSkinWeightOverlayPathPlan(diagnostic);

assert.equal(plan.ok, true);
assert.deepEqual(plan.counts, { none: 1, low: 1, mid: 1, high: 1, rigid: 1 });
assert.equal((plan.paths.outline.match(/M /g) || []).length, 5, '0を含む全triangleの境界を保持する');
assert.equal((plan.paths.low.match(/M /g) || []).length, 1, '微小weight漏れをlow帯へ残す');
assert.equal((plan.paths.rigid.match(/M /g) || []).length, 1, '全頂点1のtriangleだけをrigid帯へ送る');
assert.equal(plan.paths.outline.includes('NaN'), false);
assert.deepEqual(diagnostic, before, 'display path planは診断projectionを変更しない');

const overlaySource = readFileSync(new URL('../ui/rig-skin-weight-overlay.js', import.meta.url), 'utf8');
const popupSource = readFileSync(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');

assert.match(overlaySource, /通常はread-only。明示補正／固定topology編集mode時だけvertex hitへpointer入力を限定する/);
assert.doesNotMatch(overlaySource, /historyManager|ProjectManager|serialize\s*\(/);
assert.match(popupSource, /id="anim-rig-weight-toggle"/);
assert.match(popupSource, /data-rig-open-weight aria-pressed="false" hidden>WEIGHT表示</);
assert.match(popupSource, /\['rig', 'motion'\]\.includes\(this\._motionEditorMode\)/);
const motionWeightStart = popupSource.indexOf("motionControls.querySelector('[data-rig-open-weight]')");
const motionWeightEnd = popupSource.indexOf(
    "motionControls.querySelector('[data-rig-mesh-generate]')",
    motionWeightStart
);
assert.ok(motionWeightStart >= 0 && motionWeightEnd > motionWeightStart);
const motionWeightHandler = popupSource.slice(motionWeightStart, motionWeightEnd);
assert.match(motionWeightHandler, /_rigSkinWeightDiagnosticVisible = !this\._rigSkinWeightDiagnosticVisible/);
assert.doesNotMatch(motionWeightHandler, /_setMotionTimelineKeyKind\('rig'/,
    'MotionのWEIGHT表示はRIG tabへ強制移動しない');
assert.match(popupSource, /candidate\.layer\.id === this\.selectedInternalLayerId/);
assert.match(popupSource, /candidate\.boneId === this\.selectedRigBoneId/);
assert.match(popupSource, /rigSkinWeightOverlay\.deactivate\(\)/, 'Table closeまたはtarget消失で同期消去する');
assert.match(cssSource, /\.rig-skin-weight-overlay[\s\S]*?pointer-events:\s*none/);
assert.match(cssSource, /\.rig-skin-weight-overlay__vertex-hit[\s\S]*?pointer-events:\s*all/);
assert.match(cssSource, /z-index:\s*2691/);

console.log('verify-rig-skin-weight-overlay: fixed SVG paths / exact target / default read-only and explicit vertex hit boundary OK');
