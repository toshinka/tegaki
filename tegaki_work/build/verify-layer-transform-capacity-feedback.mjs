import assert from 'node:assert/strict';
import * as PIXI from 'pixi.js';

// Setup environment
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

class MockCanvasContext {
    constructor(canvas) {
        this.canvas = canvas;
        this.transform = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
        this._pixels = new Uint8ClampedArray(canvas.width * canvas.height * 4);
    }
    _ensureBufferSize() {
        const expectedLen = this.canvas.width * this.canvas.height * 4;
        if (this._pixels.length !== expectedLen) {
            const next = new Uint8ClampedArray(expectedLen);
            next.set(this._pixels.subarray(0, Math.min(this._pixels.length, expectedLen)));
            this._pixels = next;
        }
    }
    clearRect() { this._ensureBufferSize(); }
    setTransform(a, b, c, d, tx, ty) { this.transform = { a, b, c, d, tx, ty }; }
    putImageData() { this._ensureBufferSize(); }
    getImageData(sx, sy, sw, sh) {
        this._ensureBufferSize();
        return { width: sw, height: sh, data: new Uint8ClampedArray(sw * sh * 4) };
    }
    drawImage() { this._ensureBufferSize(); }
}

class MockCanvas {
    constructor(width = 1, height = 1) {
        this._width = Math.max(1, Math.round(width));
        this._height = Math.max(1, Math.round(height));
        this.ctx = new MockCanvasContext(this);
        this.style = {};
    }
    get width() { return this._width; }
    set width(w) {
        this._width = Math.max(1, Math.round(w));
        this.ctx._ensureBufferSize();
    }
    get height() { return this._height; }
    set height(h) {
        this._height = Math.max(1, Math.round(h));
        this.ctx._ensureBufferSize();
    }
    addEventListener() {}
    removeEventListener() {}
    getContext() { return this.ctx; }
    toDataURL() { return 'data:image/png;base64,mock'; }
}

globalThis.ImageData = class ImageData {
    constructor(data, width, height) {
        this.data = data;
        this.width = width;
        this.height = height;
    }
};

PIXI.Texture.from = (canvas) => {
    const tex = Object.create(PIXI.Texture.EMPTY);
    tex._canvas = canvas;
    const w = canvas?.width || 1;
    const h = canvas?.height || 1;
    tex.frame = new PIXI.Rectangle(0, 0, w, h);
    tex.orig = new PIXI.Rectangle(0, 0, w, h);
    return tex;
};

let mockToastElement = {
    id: 'tegaki-feedback-toast',
    textContent: '',
    classList: {
        add(cls) { mockToastElement._classes.add(cls); },
        remove(cls) { mockToastElement._classes.delete(cls); }
    },
    setAttribute() {},
    removeAttribute() {},
    addEventListener() {},
    removeEventListener() {},
    _classes: new Set()
};

globalThis.document = {
    body: {
        appendChild(child) {
            if (child.id === 'tegaki-feedback-toast') {
                mockToastElement = child;
            }
        },
        removeChild() {}
    },
    createElement: (tag) => {
        if (tag === 'canvas') return new MockCanvas();
        const el = {
            id: '',
            textContent: '',
            dataset: {},
            style: { removeProperty() {}, setProperty() {} },
            classList: {
                add(cls) { el._classes.add(cls); },
                remove(cls) { el._classes.delete(cls); },
                toggle() {}
            },
            querySelector: () => null,
            querySelectorAll: () => [],
            setAttribute() {},
            removeAttribute() {},
            addEventListener() {},
            removeEventListener() {},
            remove() {},
            _classes: new Set()
        };
        return el;
    },
    createElementNS: (ns, tag) => {
        const el = {
            id: '',
            textContent: '',
            dataset: {},
            style: { removeProperty() {}, setProperty() {} },
            classList: {
                add(cls) { el._classes.add(cls); },
                remove(cls) { el._classes.delete(cls); },
                toggle() {}
            },
            querySelector: () => null,
            querySelectorAll: () => [],
            setAttribute() {},
            removeAttribute() {},
            addEventListener() {},
            removeEventListener() {},
            appendChild() {},
            remove() {},
            _classes: new Set()
        };
        return el;
    },
    getElementById: (id) => {
        if (id === 'tegaki-feedback-toast') return mockToastElement;
        return null;
    },
    querySelector: () => new MockCanvas(),
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {}
};

const mockRenderer = {
    canvas: new MockCanvas(1920, 1080),
    limits: { maxTextureSize: 8192 },
    extract: {
        canvas({ target }) {
            const width = target?.width || 1920;
            const height = target?.height || 1080;
            return new MockCanvas(width, height);
        }
    },
    render() {}
};

const mockApp = {
    renderer: mockRenderer,
    stage: new PIXI.Container()
};

globalThis.window = {
    TEGAKI_CONFIG: null,
    CoreRuntime: null
};

const { TEGAKI_CONFIG } = await import('../config.js');
TEGAKI_CONFIG.canvas.width = 1920;
TEGAKI_CONFIG.canvas.height = 1080;
globalThis.window.TEGAKI_CONFIG = TEGAKI_CONFIG;

const { LayerSystem } = await import('../system/layer-system.js');
const { LayerTransform } = await import('../system/layer-transform.js');
const { ProjectManager } = await import('../system/project-manager.js');

const emittedEvents = [];
const eventBus = {
    emit(event, payload) {
        emittedEvents.push({ event, payload });
    },
    on() {}
};

const layerSystem = new LayerSystem();
layerSystem.config = TEGAKI_CONFIG;
layerSystem.app = mockApp;
layerSystem.eventBus = eventBus;
layerSystem.currentFrameContainer = new PIXI.Container();

const transform = new LayerTransform(TEGAKI_CONFIG);
transform.app = mockApp;
transform.onGetActiveLayer = () => layerSystem.getActiveLayer();
layerSystem.transform = transform;
layerSystem.initTransform();

const projectManager = new ProjectManager(layerSystem, mockApp);

function makeLayerWithPixels(name, width, height, bounds) {
    const layerRes = layerSystem.createLayer(name);
    const layer = layerRes.layer;
    const rt = PIXI.RenderTexture.create({ width, height });
    layer.layerData.renderTexture = rt;
    layer.layerData.rasterBounds = { ...bounds };
    layer.layerData.layerSprite = new PIXI.Sprite(rt);
    layer.layerData.layerSprite.position.set(bounds.x, bounds.y);

    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = 180;
        pixels[i + 1] = 60;
        pixels[i + 2] = 40;
        pixels[i + 3] = 255;
    }
    layerSystem.createLayerRasterSnapshot = (targetLayer) => {
        if (targetLayer === layer) {
            return {
                layerId: layer.layerData.id,
                width,
                height,
                rasterBounds: { ...layer.layerData.rasterBounds },
                pixels: new Uint8ClampedArray(pixels)
            };
        }
        return null;
    };
    return layer;
}

// ----------------------------------------------------
// Test 1: Normal 2x scale -> No warning/toast, confirm succeeds
// ----------------------------------------------------
{
    emittedEvents.length = 0;
    mockToastElement.textContent = '';
    const layer1 = makeLayerWithPixels('Layer1', 500, 500, { x: 710, y: 290, width: 500, height: 500 });
    layerSystem.setActiveLayer(layerSystem.getLayers().indexOf(layer1));
    layerSystem.enterLayerMoveMode();
    transform.updateTransform(layer1, 'scale', 2.0);

    const confirmed = layerSystem.confirmLayerTransform();
    assert.equal(confirmed, true, 'Test 1: Normal 2x confirm succeeds');
    assert.equal(layerSystem.getLastTransformBakeFailure(), null, 'Test 1: No failure recorded');
    assert.equal(mockToastElement.textContent, '', 'Test 1: No toast displayed for successful transform');
    const rejects = emittedEvents.filter(e => e.event === 'layer:transform-bake-rejected');
    assert.equal(rejects.length, 0, 'Test 1: No rejection event emitted');
    layerSystem.exitLayerMoveMode();
}

// ----------------------------------------------------
// Test 2: Scale exceeding 16 MP -> Confirm fails, exactly 1 warning toast
// ----------------------------------------------------
{
    emittedEvents.length = 0;
    mockToastElement.textContent = '';
    const layer2 = makeLayerWithPixels('Layer2', 1000, 1000, { x: 460, y: 40, width: 1000, height: 1000 });
    layerSystem.setActiveLayer(layerSystem.getLayers().indexOf(layer2));
    layerSystem.enterLayerMoveMode();
    // 1000 * 5 = 5000 -> 5004 * 5004 = 25.04 MP > 16 MP (axis is 5004 < 8192)
    transform.updateTransform(layer2, 'scale', 5.0);

    const confirmed = layerSystem.confirmLayerTransform();
    assert.equal(confirmed, false, 'Test 2: Exceeding 16 MP confirm fails');
    const failure = layerSystem.getLastTransformBakeFailure();
    assert.ok(failure, 'Test 2: Failure is recorded');
    assert.equal(failure.reason, 'exceeds-safe-pixel-count', 'Test 2: Reason is exceeds-safe-pixel-count');
    assert.match(mockToastElement.textContent, /16MP|安全上限/, 'Test 2: Toast text warns of safe pixel limit');
    assert.match(mockToastElement.textContent, /確定できない|確定できません/, 'Test 2: Toast text states cannot confirm');
    assert.match(mockToastElement.textContent, /Mキー|切り出して/, 'Test 2: Toast text guides to M key rescue');

    const rejects = emittedEvents.filter(e => e.event === 'layer:transform-bake-rejected');
    assert.equal(rejects.length, 1, 'Test 2: Exactly 1 rejection event emitted');
    assert.equal(rejects[0].payload.reason, 'exceeds-safe-pixel-count');
    layerSystem.exitLayerMoveMode({ cancelled: true });
}

// ----------------------------------------------------
// Test 3: Scale exceeding 8192px axis -> Confirm fails, exactly 1 warning toast
// ----------------------------------------------------
{
    emittedEvents.length = 0;
    mockToastElement.textContent = '';
    const layer3 = makeLayerWithPixels('Layer3', 500, 500, { x: 710, y: 290, width: 500, height: 500 });
    layerSystem.setActiveLayer(layerSystem.getLayers().indexOf(layer3));
    layerSystem.enterLayerMoveMode();
    // 500 * 20 = 10,000 > 8192px maxTextureSize
    transform.updateTransform(layer3, 'scale', 20.0);

    const confirmed = layerSystem.confirmLayerTransform();
    assert.equal(confirmed, false, 'Test 3: Exceeding 8192px confirm fails');
    const failure = layerSystem.getLastTransformBakeFailure();
    assert.ok(failure, 'Test 3: Failure is recorded');
    assert.equal(failure.reason, 'exceeds-max-texture-size', 'Test 3: Reason is exceeds-max-texture-size');
    assert.match(mockToastElement.textContent, /8192px|幅または高さ/, 'Test 3: Toast text warns of max dimension limit');
    assert.match(mockToastElement.textContent, /確定できない|確定できません/, 'Test 3: Toast text states cannot confirm');
    assert.match(mockToastElement.textContent, /Mキー|切り出して/, 'Test 3: Toast text guides to M key rescue');

    const rejects = emittedEvents.filter(e => e.event === 'layer:transform-bake-rejected');
    assert.equal(rejects.length, 1, 'Test 3: Exactly 1 rejection event emitted');
    assert.equal(rejects[0].payload.reason, 'exceeds-max-texture-size');
    layerSystem.exitLayerMoveMode({ cancelled: true });
}

// ----------------------------------------------------
// Test 4: Project Save auto-finalize when oversize -> Toast emitted, not silent
// ----------------------------------------------------
{
    emittedEvents.length = 0;
    mockToastElement.textContent = '';
    const layer4 = makeLayerWithPixels('Layer4', 1000, 1000, { x: 460, y: 40, width: 1000, height: 1000 });
    layerSystem.setActiveLayer(layerSystem.getLayers().indexOf(layer4));
    layerSystem.enterLayerMoveMode();
    transform.updateTransform(layer4, 'scale', 5.0);

    // Save project while pending transform is oversize
    const projectData = await projectManager.exportProject();
    assert.ok(projectData, 'Test 4: exportProject returns project data');

    const rejects = emittedEvents.filter(e => e.event === 'layer:transform-bake-rejected');
    assert.equal(rejects.length, 1, 'Test 4: Auto-finalize emitted exactly 1 rejection notification');
    assert.equal(rejects[0].payload.reason, 'exceeds-safe-pixel-count');
    assert.match(mockToastElement.textContent, /16MP|安全上限/, 'Test 4: Toast displayed during auto-finalize on save');
    assert.match(mockToastElement.textContent, /Mキー|切り出して/, 'Test 4: Toast guides to M key rescue');
}

// ----------------------------------------------------
// Test 5: Non-capacity failure (invalid transform) -> No capacity toast
// ----------------------------------------------------
{
    emittedEvents.length = 0;
    mockToastElement.textContent = '';
    const layer5 = makeLayerWithPixels('Layer5', 500, 500, { x: 710, y: 290, width: 500, height: 500 });
    layerSystem.setActiveLayer(layerSystem.getLayers().indexOf(layer5));

    // Direct bake with NaN transform
    const directBake = layerSystem.bakeTransform(layer5, { x: NaN, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
    assert.equal(directBake, false, 'Test 5: NaN transform bake fails');
    const failure = layerSystem.getLastTransformBakeFailure();
    assert.equal(failure?.reason, 'invalid-transform-state', 'Test 5: Reason is invalid-transform-state');
    assert.equal(mockToastElement.textContent, '', 'Test 5: No capacity toast shown for invalid transform');
    const rejects = emittedEvents.filter(e => e.event === 'layer:transform-bake-rejected');
    assert.equal(rejects.length, 0, 'Test 5: No capacity rejection event for non-capacity failure');
}

console.log('verify-layer-transform-capacity-feedback: PASS (all 5 scenarios verified)');
process.exit(0);
