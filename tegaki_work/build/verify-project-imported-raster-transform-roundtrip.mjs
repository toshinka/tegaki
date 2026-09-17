import assert from 'node:assert/strict';
import * as PIXI from 'pixi.js';
import { calculateOpaqueRasterBounds } from '../system/raster-bounds.js';

// Setup environment
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

let nextDataUrlId = 1;
const dataUrlStorage = new Map();

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

    clearRect(x, y, w, h) {
        this._ensureBufferSize();
        const cw = this.canvas.width;
        const ch = this.canvas.height;
        const startY = Math.max(0, Math.floor(y));
        const endY = Math.min(ch, Math.ceil(y + h));
        const startX = Math.max(0, Math.floor(x));
        const endX = Math.min(cw, Math.ceil(x + w));
        for (let row = startY; row < endY; row++) {
            const rowOffset = row * cw * 4;
            for (let col = startX; col < endX; col++) {
                const idx = rowOffset + col * 4;
                this._pixels[idx] = 0;
                this._pixels[idx + 1] = 0;
                this._pixels[idx + 2] = 0;
                this._pixels[idx + 3] = 0;
            }
        }
    }

    setTransform(a, b, c, d, tx, ty) {
        this.transform = { a, b, c, d, tx, ty };
    }

    putImageData(imgData, dx = 0, dy = 0) {
        this._ensureBufferSize();
        const srcW = imgData.width;
        const srcH = imgData.height;
        const src = imgData.data;
        const dstW = this.canvas.width;
        const dstH = this.canvas.height;
        for (let row = 0; row < srcH; row++) {
            const targetY = Math.round(dy + row);
            if (targetY < 0 || targetY >= dstH) continue;
            for (let col = 0; col < srcW; col++) {
                const targetX = Math.round(dx + col);
                if (targetX < 0 || targetX >= dstW) continue;
                const srcIdx = (row * srcW + col) * 4;
                const dstIdx = (targetY * dstW + targetX) * 4;
                this._pixels[dstIdx] = src[srcIdx];
                this._pixels[dstIdx + 1] = src[srcIdx + 1];
                this._pixels[dstIdx + 2] = src[srcIdx + 2];
                this._pixels[dstIdx + 3] = src[srcIdx + 3];
            }
        }
    }

    getImageData(sx, sy, sw, sh) {
        this._ensureBufferSize();
        const data = new Uint8ClampedArray(sw * sh * 4);
        const dstW = this.canvas.width;
        const dstH = this.canvas.height;
        for (let row = 0; row < sh; row++) {
            const targetY = Math.round(sy + row);
            if (targetY < 0 || targetY >= dstH) continue;
            for (let col = 0; col < sw; col++) {
                const targetX = Math.round(sx + col);
                if (targetX < 0 || targetX >= dstW) continue;
                const srcIdx = (targetY * dstW + targetX) * 4;
                const outIdx = (row * sw + col) * 4;
                data[outIdx] = this._pixels[srcIdx];
                data[outIdx + 1] = this._pixels[srcIdx + 1];
                data[outIdx + 2] = this._pixels[srcIdx + 2];
                data[outIdx + 3] = this._pixels[srcIdx + 3];
            }
        }
        return { width: sw, height: sh, data };
    }

    drawImage(source, ...args) {
        this._ensureBufferSize();
        const srcWidth = source.width;
        const srcHeight = source.height;
        const srcPixels = source.ctx ? source.ctx._pixels : (source._pixels || null);
        if (!srcPixels) return;

        let sx = 0, sy = 0, sw = srcWidth, sh = srcHeight;
        let dx = 0, dy = 0, dw = srcWidth, dh = srcHeight;
        if (args.length === 2) {
            [dx, dy] = args;
        } else if (args.length === 4) {
            [dx, dy, dw, dh] = args;
        } else if (args.length === 8) {
            [sx, sy, sw, sh, dx, dy, dw, dh] = args;
        }

        const { a, b, c, d, tx, ty } = this.transform;
        const isIdentity = (a === 1 && b === 0 && c === 0 && d === 1 && tx === 0 && ty === 0);

        if (isIdentity && sw === dw && sh === dh) {
            for (let row = 0; row < sh; row++) {
                const targetY = Math.round(dy + row);
                if (targetY < 0 || targetY >= this.canvas.height) continue;
                const sourceY = Math.round(sy + row);
                if (sourceY < 0 || sourceY >= srcHeight) continue;
                for (let col = 0; col < sw; col++) {
                    const targetX = Math.round(dx + col);
                    if (targetX < 0 || targetX >= this.canvas.width) continue;
                    const sourceX = Math.round(sx + col);
                    if (sourceX < 0 || sourceX >= srcWidth) continue;
                    const sIdx = (sourceY * srcWidth + sourceX) * 4;
                    const dIdx = (targetY * this.canvas.width + targetX) * 4;
                    this._pixels[dIdx] = srcPixels[sIdx];
                    this._pixels[dIdx + 1] = srcPixels[sIdx + 1];
                    this._pixels[dIdx + 2] = srcPixels[sIdx + 2];
                    this._pixels[dIdx + 3] = srcPixels[sIdx + 3];
                }
            }
            return;
        }

        const det = a * d - b * c;
        if (Math.abs(det) < 1e-9) return;
        const invA = d / det;
        const invB = -b / det;
        const invC = -c / det;
        const invD = a / det;

        for (let dstY = 0; dstY < this.canvas.height; dstY++) {
            for (let dstX = 0; dstX < this.canvas.width; dstX++) {
                const untransformedX = invA * (dstX - tx) + invC * (dstY - ty);
                const untransformedY = invB * (dstX - tx) + invD * (dstY - ty);

                const normX = (untransformedX - dx) / dw;
                const normY = (untransformedY - dy) / dh;
                if (normX < 0 || normX >= 1 || normY < 0 || normY >= 1) continue;

                const sourceX = Math.floor(sx + normX * sw);
                const sourceY = Math.floor(sy + normY * sh);
                if (sourceX < 0 || sourceX >= srcWidth || sourceY < 0 || sourceY >= srcHeight) continue;

                const sIdx = (sourceY * srcWidth + sourceX) * 4;
                if (srcPixels[sIdx + 3] === 0) continue;

                const dIdx = (dstY * this.canvas.width + dstX) * 4;
                this._pixels[dIdx] = srcPixels[sIdx];
                this._pixels[dIdx + 1] = srcPixels[sIdx + 1];
                this._pixels[dIdx + 2] = srcPixels[sIdx + 2];
                this._pixels[dIdx + 3] = srcPixels[sIdx + 3];
            }
        }
    }
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
    getContext(type) {
        return this.ctx;
    }
    toDataURL(type) {
        const key = `data:image/png;base64,mock_${this.width}x${this.height}_${nextDataUrlId++}`;
        const copyPixels = new Uint8ClampedArray(this.ctx._pixels);
        dataUrlStorage.set(key, { width: this.width, height: this.height, pixels: copyPixels });
        return key;
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

PIXI.Texture.from = (canvas) => {
    const tex = Object.create(PIXI.Texture.EMPTY);
    tex._canvas = canvas;
    const w = canvas?.width || 1;
    const h = canvas?.height || 1;
    tex.frame = new PIXI.Rectangle(0, 0, w, h);
    tex.orig = new PIXI.Rectangle(0, 0, w, h);
    return tex;
};

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
        this._pixels = null;
    }
    set src(val) {
        const stored = typeof val === 'string' && dataUrlStorage.get(val);
        if (stored) {
            this.naturalWidth = stored.width;
            this.naturalHeight = stored.height;
            this.width = stored.width;
            this.height = stored.height;
            this._pixels = stored.pixels;
        } else {
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
            this._pixels = new Uint8ClampedArray(this.width * this.height * 4);
        }
        Promise.resolve().then(() => this.onload?.());
    }
};

const mockRenderer = {
    canvas: new MockCanvas(1920, 1080),
    limits: { maxTextureSize: 8192 },
    extract: {
        canvas({ target }) {
            const rt = target?.texture || target;
            const width = rt?.width || 1920;
            const height = rt?.height || 1080;
            const c = new MockCanvas(width, height);
            if (rt?._pixels) {
                c.ctx._pixels.set(rt._pixels);
            }
            return c;
        },
        pixels({ target }) {
            const rt = target?.texture || target;
            const width = rt?.width || 1920;
            const height = rt?.height || 1080;
            const pixels = rt?._pixels
                ? new Uint8ClampedArray(rt._pixels)
                : new Uint8ClampedArray(width * height * 4);
            return { width, height, pixels };
        }
    },
    render({ container, target, clear }) {
        if (!target) return;
        const srcCanvas = container?.texture?._canvas;
        if (srcCanvas) {
            target._canvas = srcCanvas;
            target._pixels = new Uint8ClampedArray(srcCanvas.ctx._pixels);
            if (typeof target.resize === 'function') {
                target.resize(srcCanvas.width, srcCanvas.height);
            }
        }
    }
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

function createOpaqueImageData(width, height) {
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = 200;
        pixels[i + 1] = 100;
        pixels[i + 2] = 50;
        pixels[i + 3] = 255;
    }
    return new ImageData(pixels, width, height);
}

// --- Test Case A: Explicit Confirm (V key) -> Save -> Reload ---
{
    const layerA = layerSystem.createLayer('Layer A');
    layerSystem.setActiveLayer(layerSystem.getLayers().indexOf(layerA.layer));
    const dummy = createOpaqueImageData(500, 500);
    imageImporter.importImageData(dummy, { placementMode: 'fit-canvas' });

    // 1. Assert pre-transform: surface is project size, but opaque footprint is 500x500
    const preSnapshotA = layerSystem.createLayerRasterSnapshot(layerA.layer);
    assert.equal(preSnapshotA.width, 1920, 'Pre-transform surface width is 1920');
    assert.equal(preSnapshotA.height, 1080, 'Pre-transform surface height is 1080');
    const preBoundsA = calculateOpaqueRasterBounds(preSnapshotA);
    assert.ok(preBoundsA, 'Pre-transform opaque bounds exists');
    assert.equal(preBoundsA.width, 500, 'Pre-transform opaque width is 500');
    assert.equal(preBoundsA.height, 500, 'Pre-transform opaque height is 500');
    assert.equal(preBoundsA.x, 710, 'Pre-transform centered x is 710');
    assert.equal(preBoundsA.y, 290, 'Pre-transform centered y is 290');

    layerSystem.enterLayerMoveMode();
    transform.updateTransform(layerA.layer, 'scale', 2.5);

    // 2. Assert canBakeLayerTransform naturally succeeds without clipping
    const bakeCheckA = layerSystem.canBakeLayerTransform(layerA.layer);
    assert.equal(bakeCheckA.ok, true, 'Bake check succeeds');
    assert.equal(bakeCheckA.contentBounds.width, 500, 'Bake check sees 500 content width');
    assert.equal(bakeCheckA.contentBounds.height, 500, 'Bake check sees 500 content height');
    // 500 * 2.5 = 1250. With 2px padding on each side -> 1254
    assert.equal(bakeCheckA.targetBounds.width, 1254, 'Target bounds width is 1254');
    assert.equal(bakeCheckA.targetBounds.height, 1254, 'Target bounds height is 1254');

    // 3. Confirm transform and assert baked footprint
    const confirmSuccess = layerSystem.confirmLayerTransform();
    assert.equal(confirmSuccess, true, 'Confirm transform returned true');
    assert.equal(layerA.layer.scale.x, 1, 'Display scale reset to 1 on confirm');
    assert.equal(layerA.layer.scale.y, 1, 'Display scale reset to 1 on confirm');
    assert.equal(layerA.layer.layerData.rasterBounds.width, 1254, 'Baked rasterBounds width is 1254');
    assert.equal(layerA.layer.layerData.rasterBounds.height, 1254, 'Baked rasterBounds height is 1254');

    const postBakeSnapshotA = layerSystem.createLayerRasterSnapshot(layerA.layer);
    const postBakeBoundsA = calculateOpaqueRasterBounds(postBakeSnapshotA);
    assert.ok(postBakeBoundsA, 'Post-bake opaque bounds exists');
    assert.equal(postBakeBoundsA.width, 1250, 'Post-bake opaque width is 1250');
    assert.equal(postBakeBoundsA.height, 1250, 'Post-bake opaque height is 1250');

    // 4. Export project and reload, assert scale and footprint preserved
    const projectA = await projectManager.exportProject();
    await projectManager.loadProject(projectA);
    const loadedA = layerSystem.getLayers().find(l => l.layerData.name === 'Layer A');
    assert.ok(loadedA, 'Layer A restored');
    assert.equal(loadedA.scale.x, 1, 'Loaded scale is 1');
    assert.equal(loadedA.layerData.rasterBounds.width, 1254, 'Case A: Raster bounds width preserved across save/reload');
    assert.equal(loadedA.layerData.rasterBounds.height, 1254, 'Case A: Raster bounds height preserved across save/reload');

    const postLoadSnapshotA = layerSystem.createLayerRasterSnapshot(loadedA);
    const postLoadBoundsA = calculateOpaqueRasterBounds(postLoadSnapshotA);
    assert.ok(postLoadBoundsA, 'Post-load opaque bounds exists');
    assert.equal(postLoadBoundsA.width, 1250, 'Post-load opaque width is 1250');
    assert.equal(postLoadBoundsA.height, 1250, 'Post-load opaque height is 1250');
}

// --- Test Case B: Save while transform is pending (auto-commit) -> Reload ---
{
    const layerB = layerSystem.createLayer('Layer B');
    layerSystem.setActiveLayer(layerSystem.getLayers().indexOf(layerB.layer));
    const dummy = createOpaqueImageData(500, 500);
    imageImporter.importImageData(dummy, { placementMode: 'fit-canvas' });
    layerSystem.enterLayerMoveMode();
    transform.updateTransform(layerB.layer, 'scale', 2.0);
    assert.equal(layerB.layer.scale.x, 2, 'Pending transform active before save');

    // Auto-commit on export
    const projectB = await projectManager.exportProject();
    assert.equal(layerB.layer.scale.x, 1, 'Auto-commit reset display scale to 1 during save');
    // 500 * 2.0 = 1000. Target bounds is 1004
    assert.equal(layerB.layer.layerData.rasterBounds.width, 1004, 'Pending transform baked into rasterBounds');

    await projectManager.loadProject(projectB);
    const loadedB = layerSystem.getLayers().find(l => l.layerData.name === 'Layer B');
    assert.ok(loadedB, 'Layer B restored');
    assert.equal(loadedB.scale.x, 1, 'Loaded scale is 1');
    assert.equal(loadedB.layerData.rasterBounds.width, 1004, 'Case B: Raster bounds preserved across save/reload');

    const postLoadBoundsB = calculateOpaqueRasterBounds(layerSystem.createLayerRasterSnapshot(loadedB));
    assert.equal(postLoadBoundsB.width, 1000, 'Case B: Opaque width is 1000');
    assert.equal(postLoadBoundsB.height, 1000, 'Case B: Opaque height is 1000');
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
    const dummy = createOpaqueImageData(500, 500);
    imageImporter.importImageData(dummy, { placementMode: 'fit-canvas' });
    layerSystem.enterLayerMoveMode();
    transform.updateTransform(layerE1.layer, 'scale', 2.0);
    // Switch active layer index to E2 while E1 has the active transform session
    layerSystem.activeLayerIndex = layerSystem.getLayers().indexOf(layerE2.layer);
    layerSystem.exitLayerMoveMode();
    assert.equal(layerE1.layer.scale.x, 1, 'E1 display scale reset');
    assert.equal(layerE1.layer.layerData.rasterBounds.width, 1004, 'E1 transform baked even though active layer changed');
}

// --- Test Case F: Large scale (3.0x on 1920x1080 canvas) does not fail texture size limit ---
{
    const layerF = layerSystem.createLayer('Layer F');
    layerSystem.setActiveLayer(layerSystem.getLayers().indexOf(layerF.layer));
    const dummy = createOpaqueImageData(500, 500);
    imageImporter.importImageData(dummy, { placementMode: 'fit-canvas' });
    layerSystem.enterLayerMoveMode();
    transform.updateTransform(layerF.layer, 'scale', 3.0);

    const bakeCheckF = layerSystem.canBakeLayerTransform(layerF.layer);
    assert.equal(bakeCheckF.ok, true, 'Confirm succeeded without exceeding max texture limits');
    // 500 * 3.0 = 1500. With 2px padding -> 1504
    assert.equal(bakeCheckF.targetBounds.width, 1504);
    assert.equal(bakeCheckF.targetBounds.height, 1504);

    const confirmed = layerSystem.confirmLayerTransform();
    assert.equal(confirmed, true, 'Confirm succeeded');
    assert.equal(layerF.layer.scale.x, 1);
    assert.equal(layerF.layer.layerData.rasterBounds.width, 1504, 'Scale 3x preserved in rasterBounds');

    const postBakeBoundsF = calculateOpaqueRasterBounds(layerSystem.createLayerRasterSnapshot(layerF.layer));
    assert.equal(postBakeBoundsF.width, 1500, 'Case F: Opaque width is 1500');
    assert.equal(postBakeBoundsF.height, 1500, 'Case F: Opaque height is 1500');
}

// --- Test Case G: Genuine Oversized Control Case ---
{
    const layerG = layerSystem.createLayer('Layer G');
    layerSystem.setActiveLayer(layerSystem.getLayers().indexOf(layerG.layer));
    const dummy = createOpaqueImageData(500, 500);
    imageImporter.importImageData(dummy, { placementMode: 'fit-canvas' });

    // 1. Extreme scale factor exceeding max texture size (8192):
    // 500 * 20 = 10,000 > 8192
    const checkExceedsAxis = layerSystem.canBakeLayerTransform(
        layerG.layer,
        { x: 0, y: 0, rotation: 0, scaleX: 20, scaleY: 20 }
    );
    assert.equal(checkExceedsAxis.ok, false, 'canBakeLayerTransform rejects scale exceeding max axis');
    assert.equal(checkExceedsAxis.reason, 'exceeds-max-texture-size', 'Rejected with exceeds-max-texture-size');

    // 2. Scale factor exceeding safe 16 MP pixel limit:
    // 500 * 10 = 5000 -> 5004 * 5004 ≈ 25.04 MP > 16 MP
    const checkExceedsPixels = layerSystem.canBakeLayerTransform(
        layerG.layer,
        { x: 0, y: 0, rotation: 0, scaleX: 10, scaleY: 10 }
    );
    assert.equal(checkExceedsPixels.ok, false, 'canBakeLayerTransform rejects scale exceeding 16 MP limit');
    assert.equal(checkExceedsPixels.reason, 'exceeds-safe-pixel-count', 'Rejected with exceeds-safe-pixel-count');

    // 3. Prove bakeTransform returns false rather than silently clipping:
    const bakeDirectResult = layerSystem.bakeTransform(
        layerG.layer,
        { x: 0, y: 0, rotation: 0, scaleX: 10, scaleY: 10 }
    );
    assert.equal(bakeDirectResult, false, 'bakeTransform directly returns false for unsafe pixel count');

    // 4. Prove confirmLayerTransform returns false and reverts to beforeSnapshot on capacity failure
    transform.updateTransform(layerG.layer, 'scale', 10.0);
    const confirmResult = layerSystem.confirmLayerTransform();
    assert.equal(confirmResult, false, 'confirmLayerTransform returns false when bake fails');
    const snapshotAfterFail = layerSystem.createLayerRasterSnapshot(layerG.layer);
    assert.equal(snapshotAfterFail.width, 1920, 'Surface width safely reverted');
    assert.equal(snapshotAfterFail.height, 1080, 'Surface height safely reverted');
}

console.log('verify-project-imported-raster-transform-roundtrip: PASS');
process.exit(0);
