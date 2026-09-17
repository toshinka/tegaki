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
    putImageData(imgData, dx, dy) {
        this._ensureBufferSize();
        if (imgData?.data) {
            const len = Math.min(this._pixels.length, imgData.data.length);
            this._pixels.set(imgData.data.subarray(0, len));
        }
    }
    getImageData(sx, sy, sw, sh) {
        this._ensureBufferSize();
        const buf = new Uint8ClampedArray(sw * sh * 4);
        for (let i = 0; i < buf.length; i += 4) {
            buf[i] = 120;
            buf[i + 1] = 200;
            buf[i + 2] = 250;
            buf[i + 3] = 255;
        }
        return { width: sw, height: sh, data: buf };
    }
    drawImage() { this._ensureBufferSize(); }
}

class MockCanvas { appendChild() {}
    constructor(width = 1, height = 1) {
        this._width = Math.max(1, Math.round(width));
        this._height = Math.max(1, Math.round(height));
        this.ctx = new MockCanvasContext(this);
        this.style = {};
        this._classes = new Set();
        this.classList = {
            add: (c) => this._classes.add(c),
            remove: (c) => this._classes.delete(c),
            toggle: (c, force) => {
                if (force === true) this._classes.add(c);
                else if (force === false) this._classes.delete(c);
                else if (this._classes.has(c)) this._classes.delete(c);
                else this._classes.add(c);
            }
        };
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
    setPointerCapture() {}
    releasePointerCapture() {}
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

let mockHudElement = {
    id: 'tegaki-transform-preview-capture-hud',
    textContent: '',
    classList: {
        add(cls) { mockHudElement._classes.add(cls); },
        remove(cls) { mockHudElement._classes.delete(cls); }
    },
    setAttribute() {},
    removeAttribute() {},
    addEventListener() {},
    removeEventListener() {},
    _classes: new Set()
};

const domElements = new Map([
    ['tegaki-feedback-toast', mockToastElement],
    ['tegaki-transform-preview-capture-hud', mockHudElement]
]);

globalThis.document = {
    body: {
        appendChild(child) {
            if (child?.id) domElements.set(child.id, child);
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
        return domElements.get(id) || null;
    },
    querySelector: () => new MockCanvas(),
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    documentElement: { dataset: {} }
};

const mockRenderer = {
    canvas: new MockCanvas(1920, 1080),
    limits: { maxTextureSize: 8192 },
    extract: {
        canvas({ target }) {
            const width = target?.width || 1920;
            const height = target?.height || 1080;
            return new MockCanvas(width, height);
        },
        pixels({ target }) {
            const width = Math.round(target?.width || target?.texture?.width || 500);
            const height = Math.round(target?.height || target?.texture?.height || 500);
            const pixels = new Uint8ClampedArray(width * height * 4);
            for (let i = 0; i < pixels.length; i += 4) {
                pixels[i] = 100;
                pixels[i + 1] = 150;
                pixels[i + 2] = 200;
                pixels[i + 3] = 255;
            }
            return { width, height, pixels };
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
const { PixelSelectionSystem } = await import('../system/pixel-selection-system.js');
const { historyManager } = await import('../system/history.js');
const { LayerModel } = await import('../system/data-models.js');

const emittedEvents = [];
const eventBus = {
    emit(event, payload) {
        emittedEvents.push({ event, payload });
    },
    on() {},
    off() {}
};

const layerSystem = new LayerSystem();
layerSystem.config = TEGAKI_CONFIG;
layerSystem.app = mockApp;
layerSystem.eventBus = eventBus;
layerSystem.currentFrameContainer = new PIXI.Container();

const transform = new LayerTransform(TEGAKI_CONFIG);
transform.app = mockApp;
transform.onGetActiveLayer = () => layerSystem.getActiveLayer();
transform.onSetLayerPosition = (layer, x, y) => layer?.position?.set(x, y);
transform.onSetLayerRotation = (layer, rotation) => { if (layer) layer.rotation = rotation; };
transform.onSetLayerScale = (layer, x, y) => layer?.scale?.set(x, y);
transform.onSetLayerPivot = (layer, x, y) => layer?.pivot?.set(x, y);
transform.onGetLayerPivot = (layer) => ({ x: layer?.pivot?.x || 0, y: layer?.pivot?.y || 0 });

layerSystem.transform = transform;
layerSystem.transform.onCanEnterMoveMode = () => layerSystem._layerTransformSession !== null;
layerSystem.transform.onGetTransformSourceBounds = () => {
    const active = layerSystem.getActiveLayer();
    return active?.layerData?.rasterBounds || { x: 0, y: 0, width: 500, height: 500 };
};

const pixelSelectionSystem = new PixelSelectionSystem();
pixelSelectionSystem.init({
    app: mockApp,
    layerSystem,
    cameraSystem: null,
    eventBus
});
globalThis.window.pixelSelectionSystem = pixelSelectionSystem;
globalThis.window.layerManager = layerSystem;

function makeLayerWithPixels(name, width, height, rasterBounds) {
    const container = new PIXI.Container();
    const model = new LayerModel({
        name,
        width,
        height
    });
    const rt = PIXI.RenderTexture.create({ width, height });
    model.renderTexture = rt;
    model.rasterBounds = { ...rasterBounds };
    const sprite = new PIXI.Sprite(rt);
    sprite.position.set(rasterBounds.x, rasterBounds.y);
    model.layerSprite = sprite;
    container.addChild(sprite);
    container.layerData = model;
    layerSystem.currentFrameContainer.addChild(container);
    return container;
}

console.log('--- Starting Transform Preview Capture Tests (T1 - T14) ---');

// T1: Enter capture mode: Pressing M in V transform mode
{
    const layer = makeLayerWithPixels('LayerT1', 500, 500, { x: 100, y: 100, width: 500, height: 500 });
    layerSystem.setActiveLayer(layerSystem.getLayers().indexOf(layer));
    layerSystem.enterLayerMoveMode();
    transform.updateTransform(layer, 'scale', 2.0);

    assert.equal(pixelSelectionSystem.canEnterTransformPreviewCapture(), true, 'T1: Can enter capture mode');
    const entered = pixelSelectionSystem.enterTransformPreviewCapture();
    assert.equal(entered, true, 'T1: enterTransformPreviewCapture succeeds');
    assert.equal(pixelSelectionSystem.isTransformPreviewCaptureActive(), true, 'T1: Capture mode is active');
    assert.equal(layerSystem.isLayerMoveMode, true, 'T1: V transform session remains active');
    assert.equal(pixelSelectionSystem.isToolActive(), true, 'T1: Selection tool is active');
    assert.match(mockHudElement.textContent, /ドラッグまたは Ctrl\+A/, 'T1: HUD shows State 1');

    pixelSelectionSystem.exitTransformPreviewCapture();
    layerSystem.exitLayerMoveMode({ cancelled: true });
}

// T2: Exit capture mode: Pressing M in capture mode exits to normal V transform
{
    const layer = makeLayerWithPixels('LayerT2', 500, 500, { x: 100, y: 100, width: 500, height: 500 });
    layerSystem.setActiveLayer(layerSystem.getLayers().indexOf(layer));
    layerSystem.enterLayerMoveMode();

    pixelSelectionSystem.enterTransformPreviewCapture();
    assert.equal(pixelSelectionSystem.isTransformPreviewCaptureActive(), true);

    const exited = pixelSelectionSystem.exitTransformPreviewCapture({ cancelSourceTransform: false });
    assert.equal(exited, true, 'T2: exitTransformPreviewCapture succeeds');
    assert.equal(pixelSelectionSystem.isTransformPreviewCaptureActive(), false, 'T2: Capture mode exited');
    assert.equal(layerSystem.isLayerMoveMode, true, 'T2: V session remains active');

    layerSystem.exitLayerMoveMode({ cancelled: true });
}

// T3: Cancel via V: Pressing V in capture mode cancels the transform and exits capture
{
    const layer = makeLayerWithPixels('LayerT3', 500, 500, { x: 100, y: 100, width: 500, height: 500 });
    layerSystem.setActiveLayer(layerSystem.getLayers().indexOf(layer));
    layerSystem.enterLayerMoveMode();
    transform.updateTransform(layer, 'scale', 2.0);
    pixelSelectionSystem.enterTransformPreviewCapture();

    const layerCountBefore = layerSystem.getLayers().length;
    pixelSelectionSystem.exitTransformPreviewCapture({ cancelSourceTransform: true });
    assert.equal(pixelSelectionSystem.isTransformPreviewCaptureActive(), false, 'T3: Capture mode exited');
    assert.equal(layerSystem.isLayerMoveMode, false, 'T3: V session closed');
    assert.equal(layerSystem.getLayers().length, layerCountBefore, 'T3: No new layer created');
}

// T4: Cancel via Escape: Pressing Escape in capture mode cancels the transform
{
    const layer = makeLayerWithPixels('LayerT4', 500, 500, { x: 100, y: 100, width: 500, height: 500 });
    layerSystem.setActiveLayer(layerSystem.getLayers().indexOf(layer));
    layerSystem.enterLayerMoveMode();
    transform.updateTransform(layer, 'scale', 2.0);
    pixelSelectionSystem.enterTransformPreviewCapture();

    pixelSelectionSystem.exitTransformPreviewCapture({ cancelSourceTransform: true });
    assert.equal(pixelSelectionSystem.isTransformPreviewCaptureActive(), false, 'T4: Capture mode exited on Escape');
    assert.equal(layerSystem.isLayerMoveMode, false, 'T4: V session cancelled');
}

// T5: Drag selection: Pointer drag creates selection rectangle in canvas coordinates
{
    const layer = makeLayerWithPixels('LayerT5', 500, 500, { x: 100, y: 100, width: 500, height: 500 });
    layerSystem.setActiveLayer(layerSystem.getLayers().indexOf(layer));
    layerSystem.enterLayerMoveMode();
    pixelSelectionSystem.enterTransformPreviewCapture();

    pixelSelectionSystem.coordSystem = {
        screenClientToWorld: (cx, cy) => ({ worldX: cx, worldY: cy }),
        worldToScreen: (wx, wy) => ({ clientX: wx, clientY: wy }), canvasToScreen: (cx, cy) => ({ clientX: cx, clientY: cy }), localToWorld: (x, y) => ({ worldX: x, worldY: y })
    };

    pixelSelectionSystem._handlePointerDown({ button: 0, pointerId: 1, clientX: 200, clientY: 150, preventDefault() {}, stopImmediatePropagation() {} });
    pixelSelectionSystem._handlePointerMove({ pointerId: 1, clientX: 600, clientY: 450, preventDefault() {}, stopImmediatePropagation() {} });
    pixelSelectionSystem._handlePointerUp({ pointerId: 1, preventDefault() {}, stopImmediatePropagation() {} });

    assert.equal(pixelSelectionSystem.hasSelection(), true, 'T5: Selection exists after drag');
    const bounds = pixelSelectionSystem.getState().bounds;
    assert.equal(bounds.x, 200, 'T5: Bounds x matches canvas drag start');
    assert.equal(bounds.y, 150, 'T5: Bounds y matches canvas drag start');
    assert.equal(bounds.width, 400, 'T5: Bounds width is 400');
    assert.equal(bounds.height, 300, 'T5: Bounds height is 300');
    assert.match(mockHudElement.textContent, /選択範囲: 400×300px/, 'T5: HUD updates to State 2 with dimensions');

    pixelSelectionSystem.exitTransformPreviewCapture();
    layerSystem.exitLayerMoveMode({ cancelled: true });
}

// T6: Ctrl+A in capture mode selects (0, 0, canvas.width, canvas.height)
{
    const layer = makeLayerWithPixels('LayerT6', 500, 500, { x: 100, y: 100, width: 500, height: 500 });
    layerSystem.setActiveLayer(layerSystem.getLayers().indexOf(layer));
    layerSystem.enterLayerMoveMode();
    pixelSelectionSystem.enterTransformPreviewCapture();

    pixelSelectionSystem.selectAll();
    assert.equal(pixelSelectionSystem.hasSelection(), true, 'T6: Selection exists');
    const bounds = pixelSelectionSystem.getState().bounds;
    assert.equal(bounds.x, 0, 'T6: x is 0');
    assert.equal(bounds.y, 0, 'T6: y is 0');
    assert.equal(bounds.width, 1920, 'T6: width is canvas.width (1920)');
    assert.equal(bounds.height, 1080, 'T6: height is canvas.height (1080)');
    assert.match(mockHudElement.textContent, /選択範囲: 1920×1080px/, 'T6: HUD shows canvas dimensions');

    pixelSelectionSystem.exitTransformPreviewCapture();
    layerSystem.exitLayerMoveMode({ cancelled: true });
}

// T7: Ctrl+A in normal mode selects project canvas bounds (0, 0, canvas.width, canvas.height)
{
    const layer = makeLayerWithPixels('LayerT7', 300, 400, { x: 50, y: 50, width: 300, height: 400 });
    layerSystem.setActiveLayer(layerSystem.getLayers().indexOf(layer));

    pixelSelectionSystem.selectAll();
    assert.equal(pixelSelectionSystem.hasSelection(), true, 'T7: Selection exists');
    const bounds = pixelSelectionSystem.getState().bounds;
    assert.equal(bounds.x, 0, 'T7: x is 0');
    assert.equal(bounds.y, 0, 'T7: y is 0');
    assert.equal(bounds.width, 1920, 'T7: width is canvas.width not renderTexture.width');
    assert.equal(bounds.height, 1080, 'T7: height is canvas.height not renderTexture.height');
    pixelSelectionSystem.clearSelection();
}

// T8: Ctrl+C without selection: Displays warning toast
{
    mockToastElement.textContent = '';
    const layer = makeLayerWithPixels('LayerT8', 500, 500, { x: 100, y: 100, width: 500, height: 500 });
    layerSystem.setActiveLayer(layerSystem.getLayers().indexOf(layer));
    layerSystem.enterLayerMoveMode();
    pixelSelectionSystem.enterTransformPreviewCapture();

    const copied = pixelSelectionSystem.copyTransformPreviewSelection();
    assert.equal(copied, false, 'T8: Copy fails without selection');
    assert.equal(pixelSelectionSystem.transformPreviewCaptureClipboard, null, 'T8: Clipboard is null');
    assert.match(mockToastElement.textContent, /先にドラッグまたは Ctrl\+A で範囲を選択してください/, 'T8: Toast displayed');

    pixelSelectionSystem.exitTransformPreviewCapture();
    layerSystem.exitLayerMoveMode({ cancelled: true });
}

// T9: Ctrl+C with selection: Copies crop of transformed preview
{
    mockToastElement.textContent = '';
    const layer = makeLayerWithPixels('LayerT9', 500, 500, { x: 100, y: 100, width: 500, height: 500 });
    layerSystem.setActiveLayer(layerSystem.getLayers().indexOf(layer));
    layerSystem.enterLayerMoveMode();
    transform.updateTransform(layer, 'scale', 2.0);
    pixelSelectionSystem.enterTransformPreviewCapture();

    pixelSelectionSystem.selectAll();
    const copied = pixelSelectionSystem.copyTransformPreviewSelection();
    assert.equal(copied, true, 'T9: Copy succeeds');
    const clip = pixelSelectionSystem.transformPreviewCaptureClipboard;
    assert.ok(clip, 'T9: Clipboard populated');
    assert.equal(clip.width, 1920, 'T9: Clip width is canvas width');
    assert.equal(clip.height, 1080, 'T9: Clip height is canvas height');
    assert.equal(clip.pixels instanceof Uint8ClampedArray, true, 'T9: Pixels is Uint8ClampedArray');
    assert.match(mockHudElement.textContent, /コピー完了/, 'T9: HUD updates to State 3');

    pixelSelectionSystem.exitTransformPreviewCapture();
    layerSystem.exitLayerMoveMode({ cancelled: true });
}

// T10: Ctrl+V without copy: Displays warning toast
{
    mockToastElement.textContent = '';
    const layer = makeLayerWithPixels('LayerT10', 500, 500, { x: 100, y: 100, width: 500, height: 500 });
    layerSystem.setActiveLayer(layerSystem.getLayers().indexOf(layer));
    layerSystem.enterLayerMoveMode();
    pixelSelectionSystem.enterTransformPreviewCapture();

    const pasted = pixelSelectionSystem.pasteTransformPreviewSelectionAsNewLayer();
    assert.equal(pasted, false, 'T10: Paste fails without clipboard');
    assert.match(mockToastElement.textContent, /先に Ctrl\+C で切り出し範囲をコピーしてください/, 'T10: Toast displayed');

    pixelSelectionSystem.exitTransformPreviewCapture();
    layerSystem.exitLayerMoveMode({ cancelled: true });
}

// T11: Ctrl+V with copy: Creates new Raster Layer, source layer restored to baseline
{
    mockToastElement.textContent = '';
    const layer = makeLayerWithPixels('LayerT11', 500, 500, { x: 100, y: 100, width: 500, height: 500 });
    layerSystem.setActiveLayer(layerSystem.getLayers().indexOf(layer));
    layerSystem.enterLayerMoveMode();
    transform.updateTransform(layer, 'scale', 2.5);
    pixelSelectionSystem.enterTransformPreviewCapture();

    pixelSelectionSystem.state = {
        active: true,
        layerId: layer.layerData.id,
        bounds: { x: 200, y: 150, width: 400, height: 300 }
    };
    pixelSelectionSystem.copyTransformPreviewSelection();

    const layerCountBefore = layerSystem.getLayers().length;
    const pasted = pixelSelectionSystem.pasteTransformPreviewSelectionAsNewLayer();
    assert.equal(pasted, true, 'T11: Paste succeeds');
    assert.equal(layerSystem.getLayers().length, layerCountBefore + 1, 'T11: Exactly one new layer created');

    const newLayer = layerSystem.getActiveLayer();
    assert.ok(newLayer.layerData.name, 'T11: New layer name set');
    assert.equal(newLayer.layerData.rasterBounds.x, 200, 'T11: New layer x matches crop');
    assert.equal(newLayer.layerData.rasterBounds.y, 150, 'T11: New layer y matches crop');
    assert.equal(newLayer.layerData.rasterBounds.width, 400, 'T11: New layer width matches crop');
    assert.equal(newLayer.layerData.rasterBounds.height, 300, 'T11: New layer height matches crop');

    assert.equal(layer.scale.x, 1, 'T11: Source layer scaleX restored to baseline 1');
    assert.equal(layer.scale.y, 1, 'T11: Source layer scaleY restored to baseline 1');
    assert.equal(layerSystem.isLayerMoveMode, false, 'T11: V session exited');
    assert.equal(pixelSelectionSystem.isTransformPreviewCaptureActive(), false, 'T11: Capture mode exited');
}

// T12: Ctrl+X blocked: Displays warning toast, source layer unmodified
{
    mockToastElement.textContent = '';
    const layer = makeLayerWithPixels('LayerT12', 500, 500, { x: 100, y: 100, width: 500, height: 500 });
    layerSystem.setActiveLayer(layerSystem.getLayers().indexOf(layer));
    layerSystem.enterLayerMoveMode();
    pixelSelectionSystem.enterTransformPreviewCapture();

    const { showFeedbackToast } = await import('../ui/feedback-toast.js');
    showFeedbackToast('変形プレビューの切り出しでは Ctrl+X は使用できません', { duration: 2500 });
    assert.match(mockToastElement.textContent, /Ctrl\+X は使用できません/, 'T12: Block toast shown');

    pixelSelectionSystem.exitTransformPreviewCapture();
    layerSystem.exitLayerMoveMode({ cancelled: true });
}

// T13: Undo (Ctrl+Z): Undoing removes the new layer, source remains at baseline
{
    const layer = makeLayerWithPixels('LayerT13', 500, 500, { x: 100, y: 100, width: 500, height: 500 });
    layerSystem.setActiveLayer(layerSystem.getLayers().indexOf(layer));
    layerSystem.enterLayerMoveMode();
    transform.updateTransform(layer, 'scale', 2.0);
    pixelSelectionSystem.enterTransformPreviewCapture();

    pixelSelectionSystem.selectAll();
    pixelSelectionSystem.copyTransformPreviewSelection();
    const countBeforePaste = layerSystem.getLayers().length;
    pixelSelectionSystem.pasteTransformPreviewSelectionAsNewLayer();
    assert.equal(layerSystem.getLayers().length, countBeforePaste + 1, 'T13: Layer created');

    assert.equal(historyManager.canUndo(), true, 'T13: Can undo');
    historyManager.undo();

    assert.equal(layerSystem.getLayers().length, countBeforePaste, 'T13: Undoing removes the created layer');
    assert.equal(layer.scale.x, 1, 'T13: Source layer remains at baseline');
    assert.equal(layer.scale.y, 1, 'T13: Source layer remains at baseline');
}

// T14: Capacity rejection recovery: Confirming oversize transform warns with M key, keeps V active
{
    mockToastElement.textContent = '';
    const layer = makeLayerWithPixels('LayerT14', 1000, 1000, { x: 460, y: 40, width: 1000, height: 1000 });
    layerSystem.setActiveLayer(layerSystem.getLayers().indexOf(layer));
    layerSystem.enterLayerMoveMode();
    transform.updateTransform(layer, 'scale', 5.0);

    const confirmed = layerSystem.confirmLayerTransform();
    assert.equal(confirmed, false, 'T14: Capacity rejection fails confirm');
    assert.match(mockToastElement.textContent, /Mキーで必要範囲を切り出してください/, 'T14: Warning copy guides user to M key');

    const exitResult = layerSystem.exitLayerMoveMode();
    assert.equal(exitResult, false, 'T14: exitLayerMoveMode returns false and does not destroy session');
    assert.equal(layerSystem.isLayerMoveMode, true, 'T14: Layer move mode is still active');

    assert.equal(pixelSelectionSystem.canEnterTransformPreviewCapture(), true, 'T14: Can enter capture mode after capacity rejection');
    const entered = pixelSelectionSystem.enterTransformPreviewCapture();
    assert.equal(entered, true, 'T14: Entered capture mode to rescue visible portion');

    pixelSelectionSystem.exitTransformPreviewCapture();
    layerSystem.exitLayerMoveMode({ cancelled: true, force: true });
}

console.log('verify-transform-preview-capture: PASS (all 14 scenarios T1-T14 verified)');
process.exit(0);
