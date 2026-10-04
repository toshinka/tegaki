/**
 * ROLE: WP-032 bone projection/gesture and editor wiring verifier.
 * AUTHORITY: Pure/native-boundary evidence only; no 18729 spawn, server mutation, or host UI.
 * INVARIANTS: End only, -90..90°, preview has zero compile calls, cancel has zero compile calls.
 * RELATED: advanced/rive-editor/bone-projection.mjs、bone-editor.js、runtime.js、editor.js、WP-032。
 */
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    angleForScreenPoint,
    clampBoneAngle,
    copyMatrix,
    createBoneProjection,
    invertMatrix,
    projectionSnapshot,
    transformPoint,
} from '../advanced/rive-editor/bone-projection.mjs';
import { createBoneGestureMachine } from '../advanced/rive-editor/bone-editor.js';
import { verifyFixedCache } from '../advanced/rive-editor/dev-companion.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const editorRoot = path.join(root, 'tegaki_work', 'advanced', 'rive-editor');
const cacheRoot = path.join(root, 'tegaki_work', '.cache', 'rive-editor');
const checks = [];
const failures = [];

function check(condition, message) {
    checks.push({ message, ok: Boolean(condition) });
    if (!condition) failures.push(message);
}

async function read(relativePath) {
    return fs.readFile(path.join(root, relativePath), 'utf8');
}

function close(actual, expected, message, epsilon = 0.01) {
    check(Math.abs(actual - expected) <= epsilon, `${message}: ${actual} !== ${expected}`);
}

async function verifyProjection() {
    const nativeLikeMatrix = {
        xx: 0.8660254, xy: 0.5, yx: -0.5, yy: 0.8660254, tx: 40, ty: 80,
        delete() { throw new Error('borrowed native matrix was deleted'); },
    };
    const copied = copyMatrix(nativeLikeMatrix);
    check(copied && !Object.hasOwn(copied, 'delete'), 'native Mat2D is copied without ownership methods');
    check(invertMatrix({ xx: 1, xy: 0, yx: 0, yy: 1, tx: 2, ty: 3 })?.tx === -2, 'matrix inverse preserves translation');
    check(invertMatrix({ xx: 0, xy: 0, yx: 0, yy: 0, tx: 0, ty: 0 }) === null, 'singular matrix is rejected');
    check(clampBoneAngle(-100) === -90 && clampBoneAngle(100) === 90 && clampBoneAngle(Number.NaN) === null, 'End angle finite clamp is bounded');
    check(JSON.stringify(transformPoint({ xx: 2, xy: 0, yx: 0, yy: 2, tx: 10, ty: 20 }, { x: 5, y: 6 })) === JSON.stringify({ x: 20, y: 32 }), 'matrix point transform is deterministic');

    const projection = createBoneProjection({
        alignment: { xx: 2, xy: 0, yx: 0, yy: 2, tx: 10, ty: 20 },
        boneMatrix: nativeLikeMatrix,
        parentMatrix: { xx: 1, xy: 0, yx: 0, yy: 1, tx: 0, ty: 0 },
        length: 100,
        canvasWidth: 320,
        canvasHeight: 200,
        cssRect: { left: 100, top: 50, width: 640, height: 400 },
        angle: 30,
    });
    check(Boolean(projection), 'native End projection is created');
    if (projection) {
        close(angleForScreenPoint(projection, projection.tipScreen), 30, 'CSS-scaled pointer inverse projection');
        const snapshot = projectionSnapshot(projection, 55);
        check(snapshot.selectedBone === 'End' && snapshot.angle === 55 && snapshot.canvas.width === 320, 'projection snapshot exposes End diagnostics');
        check(projection.pivotScreen.x !== projection.tipScreen.x && projection.pivotScreen.y !== projection.tipScreen.y, 'pivot and tip are distinct native points');
    }
}

async function verifyGesture() {
    const projection = createBoneProjection({
        alignment: { xx: 1, xy: 0, yx: 0, yy: 1, tx: 0, ty: 0 },
        boneMatrix: { xx: 1, xy: 0, yx: 0, yy: 1, tx: 20, ty: 20 },
        parentMatrix: { xx: 1, xy: 0, yx: 0, yy: 1, tx: 0, ty: 0 },
        length: 80,
        canvasWidth: 100,
        canvasHeight: 100,
        cssRect: { left: 0, top: 0, width: 200, height: 200 },
        angle: 0,
    });
    let compileCalls = 0;
    let previewCalls = 0;
    let cancelCalls = 0;
    const machine = createBoneGestureMachine({
        onPreview: () => { previewCalls += 1; },
        onCommitRequested: () => { compileCalls += 1; },
        onCancel: () => { cancelCalls += 1; },
    });
    check(machine.begin({ status: 'building', angle: 0, progress: 1, projection }).ok === false, 'building frame cannot start bone gesture');
    check(machine.begin({ status: 'ready', selectedBone: 'End', angle: 0, progress: 1, dirty: false, projection }).ok === true, 'ready End bone starts gesture');
    check(machine.previewPoint({ x: 100, y: 20 }, projection).ok === true, 'pointer preview maps through projection');
    check(machine.previewAngle(180).angle === 90, 'pointer/keyboard preview clamps upper bound');
    const request = machine.requestCommit();
    check(request.ok && request.angle === 90 && compileCalls === 1, 'pointerup/Enter requests one compile');
    check(machine.requestCommit().ok === false && compileCalls === 1, 'duplicate pointerup/Enter does not compile twice');
    check(machine.finishCommit(false, 'compile-rejected').ok === false && cancelCalls === 1, 'compile rejection restores through cancel callback');
    check(machine.getState() === null, 'rejected commit closes gesture state');
    check(previewCalls >= 2, 'preview callback runs before commit without persistence');

    const cancelled = createBoneGestureMachine({ onCommitRequested: () => { compileCalls += 1; }, onCancel: () => { cancelCalls += 1; } });
    cancelled.begin({ status: 'ready', angle: 30, progress: 1, projection });
    check(cancelled.cancel('escape').ok === true && compileCalls === 1, 'Escape cancel performs zero additional compile');
    check(cancelled.cancel('escape').ok === false, 'cancel is idempotent after teardown');

    let staleCancelCalls = 0;
    const stale = createBoneGestureMachine({ onCancel: () => { staleCancelCalls += 1; } });
    stale.begin({ status: 'ready', angle: 12, progress: 1, projection });
    stale.requestCommit();
    check(stale.finishCommit(false, 'stale', { restore: false }).ok === false && staleCancelCalls === 0, 'stale commit closes without restoring disposed preview');
    check(stale.getState() === null, 'stale commit cannot revive a closed gesture');

    const aborted = createBoneGestureMachine({ onCancel: () => { staleCancelCalls += 1; } });
    aborted.begin({ status: 'ready', angle: 12, progress: 1, projection });
    aborted.requestCommit();
    check(aborted.abort('teardown').ok === true && aborted.getState() === null, 'teardown abort clears pending commit without callback');
}

async function verifySourceWiring() {
    const [projectionSource, gestureSource, runtimeSource, editorSource, htmlSource, browserFixtureSource, serverSource] = await Promise.all([
        read('tegaki_work/advanced/rive-editor/bone-projection.mjs'),
        read('tegaki_work/advanced/rive-editor/bone-editor.js'),
        read('tegaki_work/advanced/rive-editor/runtime.js'),
        read('tegaki_work/advanced/rive-editor/editor.js'),
        read('tegaki_work/advanced/rive-editor/editor.html'),
        read('tegaki_work/build/wp032-rive-bone-browser.html'),
        read('tegaki_work/advanced/rive-editor/server.mjs'),
    ]);
    check(projectionSource.includes('copyMatrix') && projectionSource.includes('angleForScreenPoint'), 'projection module exports copy/inverse pointer helpers');
    check(!/drawImage|putImageData|createImageData/.test(projectionSource + gestureSource), 'bone modules do not implement image deformation');
    check(runtimeSource.includes('bone.rotation = safeAngle * Math.PI / 180') && runtimeSource.includes('this.artboard.advance(0)'), 'runtime preview writes native End.rotation then advances native artboard');
    check(runtimeSource.includes('computeAlignment') && runtimeSource.includes('copyMatrix(alignment)'), 'runtime projection reuses native alignment and copies matrices');
    check(runtimeSource.includes("from './bone-projection.mjs'") && !/function\s+createBoneProjection/.test(runtimeSource), 'runtime uses the independent projection module without a duplicate fallback');
    check(runtimeSource.includes('alignment?.delete?.()') && runtimeSource.includes('bone.worldTransform()') && !/worldTransform\(\)\.delete/.test(runtimeSource), 'runtime deletes owned alignment and preserves borrowed bone matrices');
    check(editorSource.includes("postJson('/api/compile'") && editorSource.includes("record('bone-edit-commit'"), 'editor commits through existing compile endpoint once');
    check(editorSource.includes("import { BoneEditorController } from './bone-editor.js';") && editorSource.includes("import { RiveNativeRuntime, imageMetrics } from './runtime.js';"), 'editor imports independent controller and runtime modules directly');
    check(editorSource.includes('const progress = 1;') && editorSource.includes('runtime.previewEndBone(angle, 1)'), 'bone preview and compile are pinned to native frame progress 1');
    check(editorSource.includes('editorDisposed') && editorSource.includes('suppressCancel'), 'editor rejects stale or disposed commit responses without restoring stale UI');
    check(editorSource.includes('snapshot.status !== \'ready\'') && editorSource.includes('bone-edit-preview'), 'editor blocks frame operation during bone preview');
    check(!editorSource.includes('InlineBoneEditorController') && !editorSource.includes('import(\'./bone-editor.js\')'), 'editor has no inline or dynamic fallback controller');
    check(gestureSource.includes('selfReleasedPointerId') && gestureSource.includes("machine.cancel('lostpointercapture')"), 'real lost pointer capture cancels while self-release is ignored');
    check(gestureSource.includes('focusout') && gestureSource.includes('keyboardActive'), 'keyboard focus leave cancels the active preview');
    check(gestureSource.includes('abort(') && gestureSource.includes('this.machine.dispose()'), 'controller teardown aborts pending commits and removes listeners');
    check(gestureSource.includes("setAttribute('hidden', '')") && gestureSource.includes("removeAttribute('hidden')"), 'SVG overlay visibility explicitly toggles the hidden attribute');
    check(serverSource.includes("'/bone-editor.js'") && serverSource.includes("'/bone-projection.mjs'"), 'editor server serves both independent bone modules');
    check(htmlSource.includes('data-testid="rive-bone-end"') && htmlSource.includes('aria-valuemin="-90"') && htmlSource.includes('aria-valuemax="90"'), 'bone handle has stable testid and bounded ARIA slider');
    check(htmlSource.includes('role="group" aria-label="End骨の編集overlay"'), 'overlay group role preserves its name while exposing the child slider');
    check(htmlSource.includes('#bone-overlay[hidden]') && htmlSource.includes('display: none !important'), 'editor-local CSS keeps a hidden SVG overlay out of layout');
    check(htmlSource.includes('.editor-grid > * { min-width: 0; }') && htmlSource.includes('grid-template-columns: minmax(0, 1fr) minmax(0, 250px)'), 'editor grid children can shrink without changing native canvas sizing');
    check(htmlSource.includes('@media (max-width: 620px)') && htmlSource.includes('grid-template-columns: minmax(0, 1fr);') && htmlSource.includes('overflow-wrap: anywhere'), 'narrow editor layout and diagnostic hash wrap within the viewport');
    check(htmlSource.includes('data-testid="rive-pixel-inspect"') && htmlSource.includes('native画素を記録') && htmlSource.includes('data-testid="rive-pixel-report"'), 'native pixel inspection control and report are inside state details');
    check(editorSource.includes('getImageData') && editorSource.includes("digest('SHA-256'") && editorSource.includes('transparentPixels'), 'pixel inspection captures native RGBA dimensions, transparency, and SHA-256');
    check(editorSource.includes('capturedSnapshot') && editorSource.includes('staleDuringHash') && editorSource.includes('overlayComposited: false'), 'pixel inspection records capture-time state, stale hash status, and excludes SVG overlay');
    check(editorSource.includes("pixelInspectButton?.addEventListener('pointerdown', event => event.preventDefault())")
        && editorSource.includes("pixelInspectButton?.addEventListener('click', () => void inspectNativePixels())")
        && !editorSource.includes("runOperation('pixel-inspect'")
        && !gestureSource.includes('data-preserve-bone-preview')
        && !htmlSource.includes('data-preserve-bone-preview'), 'pixel inspection is read-only, keeps pointer preview focus, and preserves keyboard focusout cancel');
    check(htmlSource.includes('骨を動かす → 保存 → 現在フレームを追加'), 'Japanese bone workflow is visible');
    check(htmlSource.includes('script type="module" src="/editor.js?v=wp032-1"'), 'WP032 editor fixture version is wired');
    check(browserFixtureSource.includes('trusted操作') && browserFixtureSource.includes('data-testid="wp032-open"'), 'Browser fixture exposes trusted operation boundary');
    check(!browserFixtureSource.includes('dispatchEvent') && !browserFixtureSource.includes('PointerEvent'), 'Browser fixture does not synthesize bone pointer evidence');
}

const fixedCache = await verifyFixedCache();
check(fixedCache.ok, `fixed SDK/cache gate: ${fixedCache.reason || 'unknown'}`);
await verifyProjection();
await verifyGesture();
await verifySourceWiring();

const result = {
    schema: 'tegaki.rive-editor.bone-verification.v1',
    status: failures.length ? 'FAIL' : 'PASS',
    checks: checks.length,
    failures,
    fixedCache,
    native: 'UNVERIFIED — verifier is static/pure and does not spawn 18729',
};
await fs.mkdir(cacheRoot, { recursive: true });
await fs.writeFile(path.join(cacheRoot, 'wp032-rive-bone-verification.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
if (failures.length) {
    console.error(`verify-rive-bone-editor: FAIL (${failures.length})`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
} else {
    console.log(`verify-rive-bone-editor: PASS (checks=${checks.length}; native=UNVERIFIED; cache=${fixedCache.reason || 'unknown'})`);
}

