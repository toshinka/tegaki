import assert from 'node:assert/strict';
import * as PIXI from 'pixi.js';

// Setup environment
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

class MockCanvasContext {
    constructor(canvas) {
        this.canvas = canvas;
        this.transform = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
    }
    clearRect(x, y, w, h) {}
    setTransform(a, b, c, d, tx, ty) {
        this.transform = { a, b, c, d, tx, ty };
    }
    putImageData(imgData, x, y) {
        this._imgData = imgData;
    }
    getImageData(x, y, w, h) {
        return {
            width: w,
            height: h,
            data: new Uint8ClampedArray(w * h * 4).fill(255)
        };
    }
    drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh) {
        this._lastDraw = { src, sx, sy, sw, sh, dx, dy, dw, dh };
    }
}

class MockCanvas {
    constructor(width = 1, height = 1) {
        this.width = width;
        this.height = height;
        this.ctx = new MockCanvasContext(this);
        this.style = {};
    }
    addEventListener() {}
    removeEventListener() {}
    getContext(type) {
        return this.ctx;
    }
    toDataURL(type) {
        return `data:image/png;base64,mock_${this.width}x${this.height}`;
    }
}

globalThis.document = {
    body: { appendChild() {}, removeChild() {} },
    createElement: (tag) => {
        if (tag === 'canvas') return new MockCanvas();
        return {
            dataset: {},
            style: { removeProperty() {}, setProperty() {} },
            classList: { add() {}, remove() {}, toggle() {} },
            querySelector: () => null,
            querySelectorAll: () => [],
            setAttribute() {},
            removeAttribute() {},
            addEventListener() {},
            removeEventListener() {},
            remove() {}
        };
    },
    createElementNS: (ns, tag) => {
        return {
            dataset: {},
            style: { removeProperty() {}, setProperty() {} },
            classList: { add() {}, remove() {}, toggle() {} },
            querySelector: () => null,
            querySelectorAll: () => [],
            setAttribute() {},
            removeAttribute() {},
            addEventListener() {},
            removeEventListener() {},
            appendChild() {},
            removeChild() {},
            remove() {},
            isConnected: true
        };
    },
    getElementById: () => null,
    querySelector: () => new MockCanvas(),
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {}
};

PIXI.Texture.from = () => PIXI.Texture.EMPTY;

globalThis.ImageData = class ImageData {
    constructor(data, width, height) {
        this.data = data;
        this.width = width;
        this.height = height;
    }
};

globalThis.Image = class Image {
    constructor() {
        this.naturalWidth = 0;
        this.naturalHeight = 0;
        this.width = 0;
        this.height = 0;
    }
    set src(val) {
        const match = typeof val === 'string' && val.match(/mock_(\d+)x(\d+)/);
        if (match) {
            this.naturalWidth = parseInt(match[1], 10);
            this.naturalHeight = parseInt(match[2], 10);
        } else {
            this.naturalWidth = 1920;
            this.naturalHeight = 1080;
        }
        this.width = this.naturalWidth;
        this.height = this.naturalHeight;
        Promise.resolve().then(() => this.onload?.());
    }
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
            const width = target?.texture?.width || target?.width || 1920;
            const height = target?.texture?.height || target?.height || 1080;
            const pixels = new Uint8ClampedArray(width * height * 4);
            const contentW = Math.min(500, width);
            const contentH = Math.min(500, height);
            const startX = Math.round((width - contentW) / 2);
            const startY = Math.round((height - contentH) / 2);
            for (let y = startY; y < startY + contentH; y++) {
                for (let x = startX; x < startX + contentW; x++) {
                    const idx = (y * width + x) * 4;
                    pixels[idx] = 255;
                    pixels[idx + 1] = 120;
                    pixels[idx + 2] = 120;
                    pixels[idx + 3] = 255;
                }
            }
            return { width, height, pixels };
        }
    },
    render({ container, target }) {}
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

const { ProjectManager } = await import('../system/project-manager.js');
const { LayerSystem } = await import('../system/layer-system.js');
const { LayerTransform } = await import('../system/layer-transform.js');
const { ImageImporter } = await import('../system/image-importer.js');

const layerSystem = new LayerSystem();
layerSystem.config = TEGAKI_CONFIG;
layerSystem.app = mockApp;
layerSystem.eventBus = { emit() {}, on() {} };
layerSystem.currentFrameContainer = new PIXI.Container();

const transform = new LayerTransform(TEGAKI_CONFIG);
transform.app = mockApp;
transform.onGetActiveLayer = () => layerSystem.getActiveLayer();
layerSystem.transform = transform;
layerSystem.initTransform();

const projectManager = new ProjectManager(layerSystem, mockApp);
const imageImporter = new ImageImporter();
imageImporter.layerSystem = layerSystem;

// --- Test Case A: Explicit Confirm (V key) -> Save -> Reload ---
{
    const layerA = layerSystem.createLayer('Layer A');
    layerSystem.setActiveLayer(layerSystem.getLayers().indexOf(layerA.layer));
    const dummy = new ImageData(new Uint8ClampedArray(500 * 500 * 4).fill(255), 500, 500);
    imageImporter.importImageData(dummy, { placementMode: 'fit-canvas' });
    layerSystem.enterLayerMoveMode();
    transform.updateTransform(layerA.layer, 'scale', 2.5);
    layerSystem.exitLayerMoveMode(); // explicit confirm
    assert.equal(layerA.layer.scale.x, 1, 'Display scale reset to 1 on confirm');
    assert.equal(layerA.layer.scale.y, 1, 'Display scale reset to 1 on confirm');
    assert(layerA.layer.layerData.rasterBounds.width >= 1250, 'Enlarged width baked into rasterBounds');

    const projectA = await projectManager.exportProject();
    await projectManager.loadProject(projectA);
    const loadedA = layerSystem.getLayers().find(l => l.layerData.name === 'Layer A');
    assert.ok(loadedA, 'Layer A restored');
    assert.equal(loadedA.scale.x, 1, 'Loaded scale is 1');
    assert(loadedA.layerData.rasterBounds.width >= 1250, 'Case A: Enlarged width preserved across save/reload');
}

// --- Test Case B: Save while transform is pending (auto-commit) -> Reload ---
{
    const layerB = layerSystem.createLayer('Layer B');
    layerSystem.setActiveLayer(layerSystem.getLayers().indexOf(layerB.layer));
    const dummy = new ImageData(new Uint8ClampedArray(500 * 500 * 4).fill(255), 500, 500);
    imageImporter.importImageData(dummy, { placementMode: 'fit-canvas' });
    layerSystem.enterLayerMoveMode();
    transform.updateTransform(layerB.layer, 'scale', 2.0);
    assert.equal(layerB.layer.scale.x, 2, 'Pending transform active before save');

    const projectB = await projectManager.exportProject();
    assert.equal(layerB.layer.scale.x, 1, 'Auto-commit reset display scale to 1 during save');
    assert(layerB.layer.layerData.rasterBounds.width >= 1000, 'Pending transform baked into rasterBounds');

    await projectManager.loadProject(projectB);
    const loadedB = layerSystem.getLayers().find(l => l.layerData.name === 'Layer B');
    assert.ok(loadedB, 'Layer B restored');
    assert.equal(loadedB.scale.x, 1, 'Loaded scale is 1');
    assert(loadedB.layerData.rasterBounds.width >= 1000, 'Case B: Enlarged width preserved across save/reload');
}

// --- Test Case C: Ordinary drawn raster layer transform behavior intact ---
{
    const layerC = layerSystem.createLayer('Layer C');
    layerSystem.setActiveLayer(layerSystem.getLayers().indexOf(layerC.layer));
    layerSystem.enterLayerMoveMode();
    transform.updateTransform(layerC.layer, 'scale', 1.5);
    layerSystem.exitLayerMoveMode();
    assert.equal(layerC.layer.scale.x, 1);

    const projectC = await projectManager.exportProject();
    await projectManager.loadProject(projectC);
    const loadedC = layerSystem.getLayers().find(l => l.layerData.name === 'Layer C');
    assert.ok(loadedC, 'Layer C restored');
    assert.equal(loadedC.scale.x, 1);
}

// --- Test Case D: Cancel / Escape discard behavior intact ---
{
    const layerD = layerSystem.createLayer('Layer D');
    layerSystem.setActiveLayer(layerSystem.getLayers().indexOf(layerD.layer));
    const boundsBefore = { ...layerD.layer.layerData.rasterBounds };
    layerSystem.enterLayerMoveMode();
    transform.updateTransform(layerD.layer, 'scale', 3.0);
    layerSystem.exitLayerMoveMode({ cancelled: true });
    assert.equal(layerD.layer.scale.x, 1, 'Display scale reset on cancel');
    assert.equal(layerD.layer.layerData.rasterBounds.width, boundsBefore.width, 'Discarded transform did not bake');
}

// --- Test Case E: Layer switch desync during transform session ---
{
    const layerE1 = layerSystem.createLayer('Layer E1');
    const layerE2 = layerSystem.createLayer('Layer E2');
    layerSystem.setActiveLayer(layerSystem.getLayers().indexOf(layerE1.layer));
    layerSystem.enterLayerMoveMode();
    transform.updateTransform(layerE1.layer, 'scale', 2.0);
    // Switch active layer index to E2 while E1 has the active transform session
    layerSystem.activeLayerIndex = layerSystem.getLayers().indexOf(layerE2.layer);
    layerSystem.exitLayerMoveMode();
    assert.equal(layerE1.layer.scale.x, 1, 'E1 display scale reset');
    assert(layerE1.layer.layerData.rasterBounds.width >= 1000, 'E1 transform baked even though active layer changed');
}

// --- Test Case F: Large scale (3x on 1920x1080 canvas) does not fail texture size limit ---
{
    const layerF = layerSystem.createLayer('Layer F');
    layerSystem.setActiveLayer(layerSystem.getLayers().indexOf(layerF.layer));
    const dummy = new ImageData(new Uint8ClampedArray(500 * 500 * 4).fill(255), 500, 500);
    imageImporter.importImageData(dummy, { placementMode: 'fit-canvas' });
    layerSystem.enterLayerMoveMode();
    transform.updateTransform(layerF.layer, 'scale', 3.0);
    const confirmed = layerSystem.confirmLayerTransform();
    assert.equal(confirmed, true, 'Confirm succeeded without exceeding max texture limits');
    assert.equal(layerF.layer.scale.x, 1);
    assert(layerF.layer.layerData.rasterBounds.width >= 1500, 'Scale 3x preserved in rasterBounds');
}

console.log('verify-project-imported-raster-transform-roundtrip: PASS');
process.exit(0);
