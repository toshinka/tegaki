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
    replaceChildren(...children) { this.children = children; }
    getAttribute(name) { return this.attributes.get(name); }
}

const svgRoots = [];
const frameCallbacks = [];
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
    getRigLensStaticEditTarget: () => ({ ok: true })
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

const setupFrame = makeFrame('setup');
const setupNodes = renderOnce(setupFrame);
const setupLinks = setupNodes.filter(node => node.classList.contains('right-workspace-rig-parent-link'));
const setupMarkers = setupNodes.filter(node => node.tagName === 'circle'
    && node.classList.contains('right-workspace-rig-bone-marker'));
assert.equal(setupLinks.length, 2);
assert.equal(setupMarkers.length, 3);
assert.equal(setupNodes.some(node => node.classList.contains('right-workspace-rig-bone-line')), false,
    'SETUP has no visible or DOM-resident solid direction bars');
assert.equal(setupNodes.some(node => node.classList.contains('right-workspace-rig-bone-tip')), false,
    'SETUP has no independent hidden tip target');
assert.deepEqual(setupLinks.map(link => [
    link.getAttribute('x1'), link.getAttribute('y1'), link.getAttribute('x2'), link.getAttribute('y2')
]), [['20', '30', '70', '30'], ['70', '30', '120', '30']]);
assert.equal(setupMarkers.find(marker => marker.getAttribute('data-rig-bone-id') === 'arm')
    .classList.contains('right-workspace-rig-bone-move-handle'), true,
    'selected joint circle retains the existing placement drag target');
const moved = [];
setupFrame._startRigStaticBoneGesture = (...args) => { moved.push(args); return true; };
const selectedCircle = setupMarkers.find(marker => marker.getAttribute('data-rig-bone-id') === 'arm');
selectedCircle.listeners.get('pointerdown')({ button: 0 });
assert.equal(moved.length, 1);
assert.equal(moved[0][0], bones[1]);
assert.equal(moved[0][1], 'move');

const motionFrame = makeFrame('motion');
const motionNodes = renderOnce(motionFrame);
assert.equal(motionNodes.filter(node => node.classList.contains('right-workspace-rig-bone-line')).length, 3,
    'Motion retains its existing Bone axis lines');
const motionTips = motionNodes.filter(node => node.classList.contains('right-workspace-rig-bone-tip'));
assert.equal(motionTips.length, 3, 'Motion retains its existing manipulation handles');
const posed = [];
motionFrame._startRigPoseGesture = (...args) => posed.push(args);
motionTips[0].listeners.get('pointerdown')({ button: 0 });
assert.equal(posed.length, 1, 'Motion tip input still routes to the existing pose handler');

console.log('PASS: DEFORM SETUP shows circle joints and dashed center-to-center hierarchy links; Motion handles remain intact');
