import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const buildRoot = path.dirname(fileURLToPath(import.meta.url));
const workRoot = path.dirname(buildRoot);
const frameSource = fs.readFileSync(path.join(workRoot, 'ui/right-workspace-frame.js'), 'utf8');
const surface = fs.readFileSync(path.join(workRoot, 'styles/components/layer-panel-surface.css'), 'utf8');
assert.match(frameSource, /const line = staticSetup \? null : document\.createElementNS\(ns, 'line'\)/u,
    'static SETUP never inserts the solid Bone axis line into the overlay');
assert.match(frameSource, /link\.setAttribute\('x1', parent\.head\.x\)[\s\S]*?link\.setAttribute\('y1', parent\.head\.y\)[\s\S]*?link\.setAttribute\('x2', bone\.head\.x\)[\s\S]*?link\.setAttribute\('y2', bone\.head\.y\)/u,
    'static hierarchy connectors join parent and child joint centers');
assert.match(surface, /\.right-workspace-rig-parent-link\s*\{[^}]*stroke-dasharray:\s*4 4/su,
    'the existing parent relation retains its dashed visual language');

class FakeClassList {
    values = new Set();
    add(...values) { values.forEach(value => this.values.add(value)); }
    toggle(value, force = !this.values.has(value)) {
        if (force) this.values.add(value);
        else this.values.delete(value);
        return force;
    }
    contains(value) { return this.values.has(value); }
}

class FakeSvgElement {
    constructor(tagName) {
        this.tagName = tagName;
        this.classList = new FakeClassList();
        this.attributes = new Map();
        this.dataset = {};
        this.listeners = new Map();
        this.children = [];
        this.textContent = '';
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    addEventListener(name, handler) { this.listeners.set(name, handler); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    getAttribute(name) { return this.attributes.get(name); }
}

const svgRoots = [];
const frameCallbacks = [];
let bindGestureMode = 'pre_bind';
globalThis.window = globalThis.window || {};
globalThis.document = {
    createElementNS: (_namespace, name) => new FakeSvgElement(name),
    body: { appendChild: element => svgRoots.push(element) }
};
globalThis.requestAnimationFrame = callback => {
    frameCallbacks.push(callback);
    return frameCallbacks.length;
};

const { RightWorkspaceFrame } = await import('../ui/right-workspace-frame.js');
const bones = [
    { boneId: 'root', name: 'Root', parentBoneId: null, head: { x: 20, y: 30 }, tail: { x: 45, y: 30 } },
    { boneId: 'arm', name: 'Arm', parentBoneId: 'root', head: { x: 70, y: 30 }, tail: { x: 95, y: 30 } },
    { boneId: 'hand', name: 'Hand', parentBoneId: 'arm', head: { x: 120, y: 30 }, tail: { x: 145, y: 30 } }
];
const table = {
    getRigLensStaticScreenBones: () => bones,
    getRigLensMotionScreenBones: () => bones,
    getRigLensStaticBindGestureTarget: () => ({
        ok: bindGestureMode !== 'blocked', mode: bindGestureMode
    })
};
const makeFrame = mode => {
    const instance = Object.create(RightWorkspaceFrame.prototype);
    Object.assign(instance, {
        rigLensActive: true,
        rigLensMode: mode,
        rigAuthoringKind: 'deform',
        rigLensTarget: { assetId: 'asset', internalLayerId: 'raster' },
        rigSelectedBoneId: 'arm',
        rigPartIkEffectorId: null,
        rigPlacementMode: null,
        rigPointerGesture: null,
        rigOverlay: null,
        rigOverlayFrame: null
    });
    instance._getRigLensTable = () => table;
    return instance;
};
const renderOnce = instance => {
    instance._syncRigOverlay();
    const callback = frameCallbacks.pop();
    assert.equal(typeof callback, 'function');
    callback();
    return instance.rigOverlay.children;
};

const layerIndex = (nodes, predicate) => nodes.findIndex(predicate);
const isJoint = node => node.tagName === 'circle'
    && node.classList.contains('right-workspace-rig-bone-marker')
    && !node.classList.contains('right-workspace-rig-bone-tip')
    && !node.classList.contains('right-workspace-rig-bone-motion-joint');

const setupFrame = makeFrame('setup');
const setupNodes = renderOnce(setupFrame);
const setupLinks = setupNodes.filter(node => node.classList.contains('right-workspace-rig-parent-link'));
const setupMarkers = setupNodes.filter(isJoint);
assert.equal(setupLinks.length, 2);
assert.equal(setupMarkers.length, 3);
assert.equal(setupNodes.some(node => node.classList.contains('right-workspace-rig-bone-line')), false,
    'SETUP has no visible or DOM-resident solid direction bars');
assert.equal(setupNodes.some(node => node.classList.contains('right-workspace-rig-bone-tip')), false,
    'SETUP no longer places a rotation circle on the tip, where the child joint sits');
assert.deepEqual(setupLinks.map(link => [
    link.getAttribute('x1'), link.getAttribute('y1'), link.getAttribute('x2'), link.getAttribute('y2')
]), [['20', '30', '70', '30'], ['70', '30', '120', '30']]);
const setupRotate = setupNodes.filter(node => node.classList.contains('right-workspace-rig-bind-rotate'));
assert.equal(setupRotate.length, 1, 'the selected pre-bind Bone exposes the Bind rotation arc');
assert.equal(setupRotate[0].getAttribute('data-rig-bone-id'), 'arm');
assert.equal(setupRotate[0].getAttribute('data-rig-operation'), 'rotate');
assert.equal(setupRotate[0].children.some(child => child.tagName === 'circle'), false,
    'the rotation affordance is an arc path, not another circle');
assert.match(setupRotate[0].children.find(child => child.classList.contains('right-workspace-rig-rotate-arc'))
    .getAttribute('d'), /^M[-\d.e]+ [-\d.e]+ A18 18 0 0 1 /u,
    'the Bind rotation arc is centred on the selected joint at a fixed radius outside it');
assert.ok(layerIndex(setupNodes, node => node === setupRotate[0])
    < Math.min(...setupMarkers.map(marker => setupNodes.indexOf(marker))),
    'every joint paints above the rotation arc, so joint move wins any overlap');
assert.ok(setupMarkers.every(marker => marker.classList.contains('is-bind-draggable')),
    'every joint of a safe Bind target is a direct position handle');
assert.equal(setupMarkers.find(marker => marker.getAttribute('data-rig-bone-id') === 'arm')
    .classList.contains('right-workspace-rig-bone-move-handle'), true,
    'the selected joint keeps its emphasised move styling');
const moved = [];
setupFrame._startRigStaticBoneGesture = (...args) => { moved.push(args); return true; };
setupFrame._selectRigLensBone = () => assert.fail('a safe joint press must start the move, not only select');
const unselectedCircle = setupMarkers.find(marker => marker.getAttribute('data-rig-bone-id') === 'hand');
unselectedCircle.listeners.get('pointerdown')({ button: 0 });
assert.equal(moved.length, 1, 'an unselected joint starts its move on the first press');
assert.equal(moved[0][0], bones[2]);
assert.equal(moved[0][1], 'move');
const selectedCircle = setupMarkers.find(marker => marker.getAttribute('data-rig-bone-id') === 'arm');
selectedCircle.listeners.get('pointerdown')({ button: 0 });
assert.equal(moved.length, 2);
assert.equal(moved[1][0], bones[1]);
assert.equal(moved[1][1], 'move');
const rotated = [];
setupFrame._startRigStaticBoneGesture = (...args) => { rotated.push(args); return true; };
setupRotate[0].listeners.get('pointerdown')({ button: 0 });
assert.equal(rotated.length, 1);
assert.equal(rotated[0][0], bones[1]);
assert.equal(rotated[0][1], 'rotate', 'the selected safe-target arc keeps the existing Bind rotation gesture');

bindGestureMode = 'safe_rebind';
const rebindFrame = makeFrame('setup');
const rebindNodes = renderOnce(rebindFrame);
assert.equal(rebindNodes.filter(isJoint).every(marker => marker.classList.contains('is-bind-draggable')), true,
    'safe rebind retains the same direct joint move targets');
assert.equal(rebindNodes.filter(node => node.classList.contains('right-workspace-rig-bind-rotate')).length, 1,
    'safe rebind retains the selected Bone rotation arc');

bindGestureMode = 'blocked';
const lockedFrame = makeFrame('setup');
const lockedSetupNodes = renderOnce(lockedFrame);
assert.equal(lockedSetupNodes.some(node => node.classList.contains('right-workspace-rig-bone-tip')
    || node.classList.contains('right-workspace-rig-bind-rotate')), false,
    'unsafe setup targets do not retain a hidden or visible rotation target');
assert.equal(lockedSetupNodes.some(node => node.classList.contains('right-workspace-rig-bone-move-handle')
    || node.classList.contains('is-bind-draggable')), false,
    'unsafe setup targets keep the existing position-edit lock');
const lockedSelections = [];
lockedFrame._startRigStaticBoneGesture = () => assert.fail('locked targets never start a Bind gesture');
lockedFrame._selectRigLensBone = boneId => lockedSelections.push(boneId);
lockedSetupNodes.filter(isJoint)[0].listeners.get('pointerdown')({
    button: 0, preventDefault() {}, stopPropagation() {}
});
assert.deepEqual(lockedSelections, ['root'], 'a locked joint press only selects');
bindGestureMode = 'pre_bind';

const motionFrame = makeFrame('motion');
const motionNodes = renderOnce(motionFrame);
assert.equal(motionNodes.filter(node => node.classList.contains('right-workspace-rig-bone-line')).length, 3,
    'Motion retains its existing Bone axis lines');
const motionHandles = motionNodes.filter(node => node.classList.contains('right-workspace-rig-motion-handle'));
assert.equal(motionHandles.length, 2, 'only the selected Motion Bone exposes Move and Rotate affordances');
assert.deepEqual(motionHandles.map(node => node.getAttribute('data-rig-operation')).sort(), ['move', 'rotate']);
assert.ok(motionHandles.every(node => node.getAttribute('data-rig-bone-id') === 'arm'));
assert.equal(motionNodes.some(node => node.children?.some?.(child =>
    child.classList.contains('right-workspace-rig-motion-handle-hit'))), false,
    'no detached circular button remains');
const moveHandle = motionHandles.find(node => node.getAttribute('data-rig-operation') === 'move');
const rotateHandle = motionHandles.find(node => node.getAttribute('data-rig-operation') === 'rotate');
const moveHit = moveHandle.children.find(child => child.classList.contains('right-workspace-rig-move-hit'));
assert.deepEqual([moveHit.getAttribute('cx'), moveHit.getAttribute('cy')], ['70', '30'],
    'Move is anchored on the selected Bone origin');
assert.ok(moveHandle.children.some(child => child.tagName === 'path'
    && child.classList.contains('right-workspace-rig-move-cue')), 'Move shows a crosshair cue');
const bodyHit = rotateHandle.children.find(child => child.classList.contains('right-workspace-rig-bone-body-hit'));
assert.ok(bodyHit, 'the selected Bone body itself is the rotation target');
assert.equal(bodyHit.getAttribute('x2'), '95', 'the body target follows the Bone to its tip');
assert.ok(rotateHandle.children.some(child => child.classList.contains('right-workspace-rig-rotate-arc')),
    'Rotate shows a short arc through the tip, centred on the origin');
assert.ok(motionNodes.indexOf(rotateHandle) < Math.min(...motionNodes.filter(isJoint)
    .map(node => motionNodes.indexOf(node))), 'joints paint above the rotation body');
assert.ok(motionNodes.indexOf(moveHandle) > Math.max(...motionNodes.filter(isJoint)
    .map(node => motionNodes.indexOf(node))), 'the selected origin move target paints above joints');
const unselectedBodies = motionNodes.filter(node => node.classList.contains('right-workspace-rig-bone-body-hit'));
assert.deepEqual(unselectedBodies.map(node => node.getAttribute('data-rig-bone-id')), ['root', 'hand'],
    'unselected Bones expose only a selection body, no manipulation handle');
const posed = [];
const selectedInMotion = [];
motionFrame._startRigPoseGesture = (...args) => posed.push(args);
motionFrame._selectRigLensBone = boneId => selectedInMotion.push(boneId);
moveHandle.listeners.get('pointerdown')({ button: 0 });
rotateHandle.listeners.get('pointerdown')({ button: 0 });
assert.deepEqual(posed.map(args => [args[0].boneId, args[2]]), [['arm', 'move'], ['arm', 'rotate']],
    'Motion Move and Rotate still route to the existing pose gesture');
unselectedBodies[0].listeners.get('pointerdown')({ button: 0, preventDefault() {}, stopPropagation() {} });
assert.deepEqual(selectedInMotion, ['root'], 'pressing an unselected Bone only selects it (no KEY)');
assert.equal(posed.length, 2);

console.log('PASS: SETUP joints move on first press with the rotation arc outside the joint; Motion uses origin-move and body/arc-rotate affordances on the selected Bone only');
