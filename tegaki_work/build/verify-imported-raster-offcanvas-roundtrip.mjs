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

const matrix = [
    { id: 'T1', name: 'Center control', w: 400, h: 400, scale: 2.0, x: 0, y: 0 },
    { id: 'T2', name: 'Top overflow', w: 800, h: 800, scale: 2.0, x: 0, y: -400 },
    { id: 'T3', name: 'Left overflow', w: 800, h: 800, scale: 2.0, x: -600, y: 0 },
    { id: 'T4', name: 'Right/Bottom overflow', w: 800, h: 800, scale: 2.0, x: 500, y: 300 },
    { id: 'T5', name: 'Corner overflow', w: 800, h: 800, scale: 2.0, x: -500, y: -400 },
    { id: 'T6', name: 'Large but valid', w: 1000, h: 1000, scale: 3.5, x: -200, y: -200 }
];

console.log('Running deterministic matrix T1 - T6...');

for (const t of matrix) {
    const layer = layerSystem.createLayer(t.id);
    layerSystem.setActiveLayer(layerSystem.getLayers().indexOf(layer.layer));
    const dummy = createOpaqueImageData(t.w, t.h);
    imageImporter.importImageData(dummy, { placementMode: 'fit-canvas' });

    layerSystem.enterLayerMoveMode();
    if (t.scale !== 1.0) transform.updateTransform(layer.layer, 'scale', t.scale);
    if (t.x !== 0) transform.updateTransform(layer.layer, 'x', t.x);
    if (t.y !== 0) transform.updateTransform(layer.layer, 'y', t.y);

    const bakeCheck = layerSystem.canBakeLayerTransform(layer.layer);
    assert.equal(bakeCheck.ok, true, `${t.id}: canBakeLayerTransform succeeds`);

    const confirmed = layerSystem.confirmLayerTransform();
    assert.equal(confirmed, true, `${t.id}: confirmLayerTransform succeeds`);

    const postBakeSnapshot = layerSystem.createLayerRasterSnapshot(layer.layer);
    const postBakeOpaque = calculateOpaqueRasterBounds(postBakeSnapshot);
    assert.ok(postBakeOpaque, `${t.id}: post-bake opaque bounds exists`);

    const projectData = await projectManager.exportProject();
    await projectManager.loadProject(projectData);

    const loaded = layerSystem.getLayers().find(l => l.layerData.name === t.id);
    assert.ok(loaded, `${t.id}: Layer restored`);
    assert.equal(loaded.scale.x, 1, `${t.id}: Display scale reset to 1`);
    assert.equal(loaded.scale.y, 1, `${t.id}: Display scale reset to 1`);
    assert.equal(loaded.layerData.rasterBounds.x, bakeCheck.targetBounds.x, `${t.id}: rasterBounds.x preserved`);
    assert.equal(loaded.layerData.rasterBounds.y, bakeCheck.targetBounds.y, `${t.id}: rasterBounds.y preserved`);
    assert.equal(loaded.layerData.rasterBounds.width, bakeCheck.targetBounds.width, `${t.id}: rasterBounds.width preserved`);
    assert.equal(loaded.layerData.rasterBounds.height, bakeCheck.targetBounds.height, `${t.id}: rasterBounds.height preserved`);

    const postLoadSnapshot = layerSystem.createLayerRasterSnapshot(loaded);
    const postLoadOpaque = calculateOpaqueRasterBounds(postLoadSnapshot);
    assert.ok(postLoadOpaque, `${t.id}: post-load opaque bounds exists`);
    assert.equal(postLoadOpaque.width, postBakeOpaque.width, `${t.id}: Opaque width preserved across roundtrip`);
    assert.equal(postLoadOpaque.height, postBakeOpaque.height, `${t.id}: Opaque height preserved across roundtrip`);

    console.log(`  ✓ ${t.id} (${t.name}): PASS. targetBounds:`, bakeCheck.targetBounds, 'opaque:', postLoadOpaque);
}

console.log('verify-imported-raster-offcanvas-roundtrip: ALL DETERMINISTIC PASS');
process.exit(0);
