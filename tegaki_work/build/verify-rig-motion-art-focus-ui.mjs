import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8');

assert.match(source, /createRigMotionArtFocusProjection/);
assert.match(source, /rigFocus:\$\{rigFocusKey\}/, 'target / Bone変更をpreview cache keyへ含める');
assert.match(source, /rigMotionArtFocus:\s*options\.isOnion/);
assert.match(source, /cel\.id !== this\.selectedCelId/, '選択中Clip以外を減光しない');
assert.match(source, /skinNode\.alpha = opacity \* focusAlpha/);
assert.match(source, /sprite\.alpha = opacity \* focusAlpha/);
assert.match(source, /artFocus\.targetConnected\s*&&\s*!!sampled/, '選択中の絵へ未接続のBone Poseを記録させない');
assert.match(source, /reason: 'raster-bone-unconnected'/, 'Canvas / Timelineからも未接続Bone keyを作らせない');
assert.match(source, /AUTO GRID未作成。作成するとMotionできます/);
assert.match(source, /data-rig-connect-art/);
assert.match(source, /data-rig-connect-art[^>]*>AUTO GRIDを作成</);
assert.match(source, /querySelector\('\[data-rig-connect-art\]'\)[\s\S]*?_generateSelectedRasterBoneSetup\('alpha-fit-grid'\)/);
assert.match(source, /data-rig-open-weight[^>]*>WEIGHT表示</);
const weightHandlerStart = source.indexOf("motionControls.querySelector('[data-rig-open-weight]')");
const weightHandlerEnd = source.indexOf(
    "motionControls.querySelector('[data-rig-mesh-generate]')",
    weightHandlerStart
);
assert.ok(weightHandlerStart >= 0 && weightHandlerEnd > weightHandlerStart);
const weightHandler = source.slice(weightHandlerStart, weightHandlerEnd);
assert.match(weightHandler, /_rigSkinWeightDiagnosticVisible = !this\._rigSkinWeightDiagnosticVisible/);
assert.doesNotMatch(weightHandler, /_setMotionTimelineKeyKind\('rig'/,
    'Motionのread-only WEIGHT表示はtabを切り替えない');
assert.match(source, /folder\.bones\?\.length \|\| 0/, 'Raster tabは当該SkinのBone数だけを表示する');
assert.match(source, /this\.selectedRigBoneId = meshBoneIds\.size === 1/, '一意なSkin Boneはtarget再選択で復帰する');
assert.doesNotMatch(
    source,
    /const rasterBoneCount = isRasterTarget && !isRigidRasterTarget\s*\? \(projection\?\.meshBones\?\.length/,
    '別Rasterを含む全Mesh Bone数へfallbackしない'
);

console.log('verify-rig-motion-art-focus-ui: cache / selected clip / dim / AUTO GRID gate and Motion WEIGHT toggle OK');
