/** WP-004: production output terminal audit. No product runtime mutation. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

class FakeContext2D {
    constructor(canvas) {
        this.canvas = canvas;
        this.operations = [];
        this.globalAlpha = 1;
        this.globalCompositeOperation = 'source-over';
    }
    save() { this.operations.push(['save']); }
    restore() { this.operations.push(['restore']); }
    scale(x, y) { this.operations.push(['scale', x, y]); }
    translate(x, y) { this.operations.push(['translate', x, y]); }
    rotate(value) { this.operations.push(['rotate', value]); }
    transform(...values) { this.operations.push(['transform', ...values]); }
    clearRect(...values) { this.operations.push(['clearRect', ...values]); }
    drawImage(...values) { this.operations.push(['drawImage', ...values]); }
    putImageData(...values) { this.operations.push(['putImageData', ...values]); }
    getImageData(x, y, width, height) {
        return { data: new Uint8ClampedArray(width * height * 4), width, height };
    }
}
class FakeCanvas {
    constructor() {
        this.width = 0;
        this.height = 0;
        this.context = new FakeContext2D(this);
    }
    getContext(kind) { return kind === '2d' ? this.context : null; }
}

globalThis.window = { TEGAKI_CONFIG: { canvas: { width: 16, height: 16 } } };
globalThis.document = { createElement: tag => tag === 'canvas' ? new FakeCanvas() : null };
globalThis.ImageData = class ImageData {
    constructor(data, width, height) {
        this.data = data;
        this.width = width;
        this.height = height;
    }
};

const { createFolderEffectRenderPlan } = await import('../system/animation/folder-part-render-plan.js');
const { TimelineFrameCompositor } = await import('../system/animation/timeline-frame-compositor.js');
const asset = {
    id: 'asset',
    internalLayers: [{
        id: 'raster',
        type: 'raster',
        parentLayerId: null,
        drawingSnapshotId: 'snapshot',
        visible: true,
        opacity: 1,
        blendMode: 'normal'
    }],
    rigDefinition: {
        version: 1,
        parts: [{
            partId: 'raster',
            parentPartId: null,
            bindTransform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 }
        }]
    },
    meshDefinitions: []
};
const clip = {
    id: 'clip',
    assetId: asset.id,
    startFrame: 0,
    duration: 2,
    visible: true,
    layerTransformTracks: [{
        internalLayerId: 'raster',
        pivotX: 0,
        pivotY: 0,
        keyframes: [{ frame: 0, interpolation: 'linear', x: 4, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }]
    }]
};
const plan = createFolderEffectRenderPlan(asset, clip, 0);
assert.equal(plan.status, 'unsupported');
assert.equal(plan.errors.some(error => error.code === 'layer-transform-rig-overlap'), true);

const snapshot = {
    id: 'snapshot',
    width: 2,
    height: 2,
    rasterBounds: { x: 0, y: 0, width: 2, height: 2 },
    pixels: new Uint8ClampedArray(16).fill(255)
};
const compositor = new TimelineFrameCompositor({
    getClipAsset(id) { return id === asset.id ? asset : null; },
    getDrawingSnapshot(id) { return id === snapshot.id ? snapshot : null; },
    findClipEntry(id) {
        return id === clip.id ? { clip, lane: { id: 'lane' } } : null;
    }
});
const destination = new FakeCanvas();
destination.width = 16;
destination.height = 16;
assert.throws(() => compositor._renderClipEntry(destination.context, clip, 16, 16, 0),
    /Layer effect render is unsupported: .*layer-transform-rig-overlap/,
    'CPU entry must reject a Layer Motion-only unsupported plan before drawing');
assert.equal(destination.context.operations.some(operation => operation[0] === 'drawImage'), false,
    'unsupported plan must not reach the Canvas draw operation');
assert.throws(() => compositor.renderClipFrameSurface(clip.id, 0),
    /Layer effect render is unsupported: .*layer-transform-rig-overlap/,
    'clip surface export path must use the same unsupported-plan guard');

const projectSource = readFileSync(new URL('../system/project-manager.js', import.meta.url), 'utf8');
const exportSource = readFileSync(new URL('../system/export-manager.js', import.meta.url), 'utf8');
const projectExportBody = projectSource.slice(
    projectSource.indexOf('    async exportProject('),
    projectSource.indexOf('    async saveToFile(', projectSource.indexOf('    async exportProject('))
);
assert.match(projectExportBody, /_commitFloatingSelection\(\)/);
assert.match(projectExportBody, /await this\._commitActiveLayerTransform\(\)/);
for (const methodName of ['export', 'exportSequencePNG', 'generatePreview']) {
    const start = exportSource.indexOf(`    async ${methodName}(`);
    const next = exportSource.indexOf('\n    async ', start + 1);
    const body = exportSource.slice(start, next < 0 ? exportSource.length : next);
    assert.match(body, /_commitFloatingSelection\(\)/, `${methodName} commits Selection transform`);
    assert.doesNotMatch(body, /commitActiveLayerTransform/, `${methodName} does not terminate Layer Transform`);
}

console.log('WP-004 audit: CPU rejects Layer Motion-only unsupported plan; save/export Layer Transform terminals differ.');
