/**
 * ROLE: WP-033 general Raster Project PNG alpha-save verifier.
 * AUTHORITY: ProjectManager exportProject's existing Raster PNG capture block only.
 * INVARIANTS: canonical LayerSystem snapshot once, straight-alpha bytes unchanged,
 *              no second extract/unpremultiply, folder/background metadata preserved.
 * RELATED: system/project-manager.js、WP-033、WP-032 alpha roundtrip hold。
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

globalThis.window = {
    TEGAKI_CONFIG: null,
    CoreRuntime: null,
    PopupManager: null,
    History: null,
};
globalThis.requestAnimationFrame = callback => setTimeout(callback, 0);
globalThis.cancelAnimationFrame = id => clearTimeout(id);

class MockCanvasContext {
    constructor(canvas) {
        this.canvas = canvas;
        this.pixels = new Uint8ClampedArray(canvas.width * canvas.height * 4);
    }

    putImageData(imageData) {
        this.pixels = new Uint8ClampedArray(imageData.data);
    }
}

class MockCanvas {
    constructor() {
        this.width = 0;
        this.height = 0;
        this.context = new MockCanvasContext(this);
    }

    getContext(kind) {
        return kind === '2d' ? this.context : null;
    }

    toDataURL(type = 'image/png') {
        assert.equal(type, 'image/png', 'Project export encodes Raster as PNG');
        return `data:image/png;base64,${Buffer.from(this.context.pixels).toString('base64')}`;
    }
}

globalThis.ImageData = class ImageData {
    constructor(pixels, width, height) {
        this.data = new Uint8ClampedArray(pixels);
        this.width = width;
        this.height = height;
    }
};
globalThis.document = {
    createElement(type) {
        assert.equal(type, 'canvas', 'Raster export uses an isolated Canvas2D encoder');
        return new MockCanvas();
    },
};

const { ProjectManager } = await import('../system/project-manager.js');

const checks = [];
function check(condition, message) {
    checks.push(message);
    assert.ok(condition, message);
}

function checkDeep(actual, expected, message) {
    checks.push(message);
    assert.deepEqual(actual, expected, message);
}

function decodeDataUrl(dataUrl) {
    const [, encoded = ''] = String(dataUrl).split(',', 2);
    return new Uint8Array(Buffer.from(encoded, 'base64'));
}

const canonicalPixels = new Uint8ClampedArray([
    220, 30, 20, 1,
    80, 140, 200, 128,
    15, 25, 35, 255,
]);
const rasterBounds = { x: 7, y: 9, width: 3, height: 1 };
let snapshotCalls = 0;
let snapshotOptions = null;
const rasterLayer = {
    layerData: {
        id: 'raster-alpha',
        name: '半透明Raster',
        renderTexture: { width: 3, height: 1 },
        rasterBounds: { ...rasterBounds },
        layerSprite: { position: { set() {} } },
        opacity: 0.8,
        blendMode: 'normal',
        parentId: null,
    },
};
const folderLayer = {
    layerData: {
        id: 'folder-alpha',
        name: 'Folder',
        isFolder: true,
        visible: true,
        opacity: 1,
        blendMode: 'normal',
        children: ['raster-alpha'],
        parentId: null,
    },
};
const backgroundLayer = {
    layerData: {
        id: 'background',
        isBackground: true,
        backgroundColor: 0xf0e0d6,
    },
};
const layerSystem = {
    app: null,
    getLayers: () => [backgroundLayer, folderLayer, rasterLayer],
    createLayerRasterSnapshot(layer, options = {}) {
        check(layer === rasterLayer, 'only the general Raster layer is read as a canonical snapshot');
        snapshotCalls += 1;
        snapshotOptions = options;
        return {
            layerId: layer.layerData.id,
            width: 3,
            height: 1,
            rasterBounds: { ...rasterBounds },
            pixels: new Uint8ClampedArray(canonicalPixels),
        };
    },
};
const mockApp = {
    renderer: {
        extract: {
            canvas() {
                throw new Error('second renderer.extract.canvas path was used');
            },
        },
    },
};
layerSystem.app = mockApp;

const projectManager = new ProjectManager(layerSystem, mockApp);
projectManager._unpremultiplyCanvas = () => {
    throw new Error('second _unpremultiplyCanvas path was used');
};

const projectData = await projectManager.exportProject();
const exportedRaster = projectData.layers.find(layer => layer.id === 'raster-alpha');
const exportedFolder = projectData.layers.find(layer => layer.id === 'folder-alpha');
const encodedPixels = decodeDataUrl(exportedRaster?.image);

check(snapshotCalls === 1, 'general Raster export performs one canonical snapshot read');
check(snapshotOptions?.includePathCollections === false, 'general Raster export omits unused path collections');
checkDeep([...encodedPixels], [...canonicalPixels], 'low-alpha, half-alpha, and opaque RGBA bytes survive PNG capture');
check(exportedRaster?.rasterBounds?.x === rasterBounds.x && exportedRaster?.rasterBounds?.y === rasterBounds.y, 'Raster bounds origin is preserved');
check(exportedRaster?.rasterBounds?.width === rasterBounds.width && exportedRaster?.rasterBounds?.height === rasterBounds.height, 'Raster bounds dimensions are preserved');
check(exportedRaster?.opacity === 0.8 && exportedRaster?.blendMode === 'normal', 'existing Raster metadata is preserved');
check(exportedFolder?.isFolder === true && exportedFolder?.image === undefined, 'folder metadata is exported without a Raster image');
check(projectData.background.color === 0xf0e0d6, 'background layer remains outside general Raster image capture');
check(encodedPixels[3] === 1 && encodedPixels[7] === 128 && encodedPixels[11] === 255, 'transparent-edge alpha values remain 1, 128, and 255');

const projectSourcePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'system', 'project-manager.js');
const projectSource = await fs.readFile(projectSourcePath, 'utf8');
const exportBlockStart = projectSource.indexOf('const snapshot = this.layerSystem.createLayerRasterSnapshot(layer, {');
const exportBlockEnd = projectSource.indexOf('imageData = canvas.toDataURL', exportBlockStart);
const exportBlock = projectSource.slice(exportBlockStart, exportBlockEnd);
check(/createLayerRasterSnapshot\(layer,\s*\{\s*includePathCollections:\s*false/.test(exportBlock), 'source uses the canonical snapshot with includePathCollections false');
check(exportBlock.includes('putImageData') && !exportBlock.includes('extract.canvas') && !exportBlock.includes('_unpremultiplyCanvas'), 'source has no second extract or unpremultiply in the Raster PNG block');

const cacheRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.cache', 'rive-editor');
const hash = createHash('sha256').update(Buffer.from(canonicalPixels)).digest('hex');
const result = {
    schema: 'tegaki.project.wp033-raster-alpha-save.v1',
    status: 'PASS',
    checks: checks.length,
    source: {
        canonicalSnapshotReads: snapshotCalls,
        includePathCollections: snapshotOptions?.includePathCollections ?? null,
        secondExtract: false,
        secondUnpremultiply: false,
    },
    fixture: {
        width: 3,
        height: 1,
        rasterBounds,
        alphaValues: [encodedPixels[3], encodedPixels[7], encodedPixels[11]],
        rgbaSha256: hash,
        folderExcludedFromImage: exportedFolder?.image === undefined,
        backgroundExcludedFromImage: projectData.background.color === 0xf0e0d6,
    },
    native: 'UNVERIFIED — deterministic ProjectManager function test; no Browser/server/SDK process',
};
await fs.mkdir(cacheRoot, { recursive: true });
await fs.writeFile(path.join(cacheRoot, 'wp033-raster-alpha-save.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(`verify-project-raster-alpha-save: PASS (checks=${checks.length}; native=UNVERIFIED; cache=${path.join(cacheRoot, 'wp033-raster-alpha-save.json')})`);
