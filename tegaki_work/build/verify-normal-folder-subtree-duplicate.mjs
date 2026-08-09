import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {};
const { LayerSystem } = await import('../system/layer-system.js');

const makeLayer = ({ id, name, isFolder = false, parentId = null }) => ({
    layerData: {
        id,
        name,
        isFolder,
        isBackground: false,
        parentId,
        visible: true,
        opacity: 1,
        blendMode: 'normal',
        folderExpanded: true
    }
});

const outsideFolder = makeLayer({ id: 'outside', name: 'Outside', isFolder: true });
const rootFolder = makeLayer({ id: 'root', name: 'Root', isFolder: true, parentId: 'outside' });
const nestedFolder = makeLayer({ id: 'nested', name: 'Nested', isFolder: true, parentId: 'root' });
const nestedRaster = makeLayer({ id: 'nested-raster', name: 'Nested raster', parentId: 'nested' });
const directRaster = makeLayer({ id: 'direct-raster', name: 'Direct raster', parentId: 'root' });
const unrelatedRaster = makeLayer({ id: 'unrelated', name: 'Unrelated' });
const layers = [nestedRaster, nestedFolder, directRaster, rootFolder, unrelatedRaster, outsideFolder];

const system = new LayerSystem();
system.getLayers = () => layers;
system.transform = {
    getTransform: () => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }),
    _isTransformNonDefault: () => false
};
system.createLayerRasterSnapshot = layer => ({
    layerId: layer.layerData.id,
    width: 1,
    height: 1,
    pixels: new Uint8ClampedArray([0, 0, 0, 0]),
    paths: [],
    pathsData: []
});

let pastedPayload = null;
system.pasteLayerBlockPayload = payload => {
    pastedPayload = payload;
    return { rootLayer: { layerData: { id: 'root-copy' } }, rootIndex: 4, createdRecords: [] };
};

const result = system.duplicateLayer(layers.indexOf(rootFolder));
assert.equal(result.layer.layerData.id, 'root-copy');
assert.deepEqual(
    pastedPayload.layers.map(entry => entry.sourceId),
    ['nested-raster', 'nested', 'direct-raster', 'root']
);
assert.equal(pastedPayload.placement.parentLayerId, 'outside');
assert.equal(pastedPayload.placement.afterLayerId, 'root');
assert.ok(!pastedPayload.layers.some(entry => entry.sourceId === 'unrelated'));

console.log('verify-normal-folder-subtree-duplicate: ok');
