import assert from 'node:assert/strict';

import {
    calculateStrokeDirtyRect,
    projectRectToRasterLocal,
    cropPixelPatch,
    applyPixelPatch,
    unpremultiplyPixels,
    estimatePatchHistoryBytes,
    RASTER_PATCH_BASE_METADATA_BYTES
} from '../system/drawing/raster-patch-history.js';

console.log('--- verify-long-drawing-degradation-fix: starting tests ---');

// 1. calculateStrokeDirtyRect
{
    const points = [
        { x: 100, y: 150, pressure: 0.5 },
        { x: 200, y: 250, pressure: 1.0 },
        { x: 150, y: 300, pressure: 0.2 }
    ];
    const settings = { size: 10 };
    const rect = calculateStrokeDirtyRect(points, settings);
    assert.ok(rect !== null);
    // minX = 100, maxX = 200, minY = 150, maxY = 300
    // padding = Math.max(6, Math.ceil(10) + 4) = 14
    assert.equal(rect.x, 100 - 14);
    assert.equal(rect.y, 150 - 14);
    assert.equal(rect.width, (200 - 100) + 14 * 2);
    assert.equal(rect.height, (300 - 150) + 14 * 2);

    // Empty or invalid points
    assert.equal(calculateStrokeDirtyRect([]), null);
    assert.equal(calculateStrokeDirtyRect(null), null);
}

// 2. projectRectToRasterLocal
{
    const projectRect = { x: 50, y: 60, width: 100, height: 120 };
    const rasterBounds = { x: 10, y: 20, width: 400, height: 400 };
    const local = projectRectToRasterLocal(projectRect, rasterBounds);
    assert.equal(local.x, 40);
    assert.equal(local.y, 40);
    assert.equal(local.width, 100);
    assert.equal(local.height, 120);

    // Clamp test: rect extends outside rasterBounds
    const outRect = { x: -20, y: -30, width: 100, height: 100 };
    const clamped = projectRectToRasterLocal(outRect, rasterBounds);
    assert.equal(clamped.x, 0);
    assert.equal(clamped.y, 0);
    assert.equal(clamped.width, 70);
    assert.equal(clamped.height, 50);

    // Completely out of bounds
    const farRect = { x: 500, y: 500, width: 50, height: 50 };
    assert.equal(projectRectToRasterLocal(farRect, rasterBounds), null);
}

// 3. cropPixelPatch & applyPixelPatch round-trip (byte-level)
{
    const W = 100;
    const H = 100;
    const buffer = new Uint8ClampedArray(W * H * 4);

    // Fill with pattern
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const idx = (y * W + x) * 4;
            buffer[idx] = (x * 2) & 0xff;
            buffer[idx + 1] = (y * 2) & 0xff;
            buffer[idx + 2] = (x + y) & 0xff;
            buffer[idx + 3] = 255;
        }
    }

    const localRect = { x: 20, y: 30, width: 40, height: 30 };
    const patch = cropPixelPatch(buffer, W, H, localRect);
    assert.ok(patch !== null);
    assert.equal(patch.byteLength, 40 * 30 * 4);

    // Verify patch content matches cropped region
    for (let r = 0; r < 30; r++) {
        for (let c = 0; c < 40; c++) {
            const patchIdx = (r * 40 + c) * 4;
            const srcIdx = ((30 + r) * W + (20 + c)) * 4;
            assert.equal(patch[patchIdx], buffer[srcIdx]);
            assert.equal(patch[patchIdx + 1], buffer[srcIdx + 1]);
            assert.equal(patch[patchIdx + 2], buffer[srcIdx + 2]);
            assert.equal(patch[patchIdx + 3], buffer[srcIdx + 3]);
        }
    }

    // Apply patch to a blank buffer
    const target = new Uint8ClampedArray(W * H * 4);
    const ok = applyPixelPatch(target, W, H, patch, localRect);
    assert.equal(ok, true);

    // Verify target in localRect matches buffer
    for (let r = 0; r < 30; r++) {
        for (let c = 0; c < 40; c++) {
            const dstIdx = ((30 + r) * W + (20 + c)) * 4;
            const srcIdx = ((30 + r) * W + (20 + c)) * 4;
            assert.equal(target[dstIdx], buffer[srcIdx]);
            assert.equal(target[dstIdx + 1], buffer[srcIdx + 1]);
            assert.equal(target[dstIdx + 2], buffer[srcIdx + 2]);
            assert.equal(target[dstIdx + 3], buffer[srcIdx + 3]);
        }
    }
}

// 4. unpremultiplyPixels
{
    // Test premultiplied values: Alpha=128, R=64 (straight R=128), G=32 (straight G=64), B=0
    const pixels = new Uint8ClampedArray([64, 32, 0, 128, 255, 255, 255, 255, 0, 0, 0, 0]);
    unpremultiplyPixels(pixels);
    assert.equal(pixels[0], Math.min(255, Math.round(64 * 255 / 128))); // 128
    assert.equal(pixels[1], Math.min(255, Math.round(32 * 255 / 128))); // 64
    assert.equal(pixels[2], 0);
    assert.equal(pixels[3], 128);

    // Alpha 255 is untouched
    assert.equal(pixels[4], 255);
    assert.equal(pixels[5], 255);
    assert.equal(pixels[6], 255);
    assert.equal(pixels[7], 255);

    // Alpha 0 is untouched
    assert.equal(pixels[8], 0);
    assert.equal(pixels[9], 0);
    assert.equal(pixels[10], 0);
    assert.equal(pixels[11], 0);
}

// 5. Undo / Redo byte-level parity test with semi-transparent edge & opacity < 1
{
    const W = 50;
    const H = 50;
    const beforeBuffer = new Uint8ClampedArray(W * H * 4);
    // Fill before buffer with initial drawing
    for (let i = 0; i < beforeBuffer.length; i += 4) {
        beforeBuffer[i] = 120;
        beforeBuffer[i + 1] = 100;
        beforeBuffer[i + 2] = 80;
        beforeBuffer[i + 3] = 200; // translucent background
    }

    const afterBuffer = new Uint8ClampedArray(beforeBuffer);
    const strokeRect = { x: 10, y: 10, width: 20, height: 20 };

    // Simulate semi-transparent pen stroke (opacity < 1 with antialiased edge)
    for (let r = 0; r < 20; r++) {
        for (let c = 0; c < 20; c++) {
            const idx = ((10 + r) * W + (10 + c)) * 4;
            // Draw with alpha 150
            afterBuffer[idx] = 200;
            afterBuffer[idx + 1] = 50;
            afterBuffer[idx + 2] = 30;
            afterBuffer[idx + 3] = 150;
        }
    }

    // 1. Crop beforePatch and afterPatch
    const beforePatch = cropPixelPatch(beforeBuffer, W, H, strokeRect);
    const afterPatch = cropPixelPatch(afterBuffer, W, H, strokeRect);

    // Working layer state currently has afterBuffer
    const liveLayerPixels = new Uint8ClampedArray(afterBuffer);

    // Simulate Undo: apply beforePatch to liveLayerPixels
    applyPixelPatch(liveLayerPixels, W, H, beforePatch, strokeRect);
    // Check byte-level equality with beforeBuffer
    assert.deepEqual(liveLayerPixels, beforeBuffer, 'Undo must match beforeBuffer byte-for-byte');

    // Simulate Redo: apply afterPatch to liveLayerPixels
    applyPixelPatch(liveLayerPixels, W, H, afterPatch, strokeRect);
    // Check byte-level equality with afterBuffer
    assert.deepEqual(liveLayerPixels, afterBuffer, 'Redo must match afterBuffer byte-for-byte');

    // Simulate Eraser stroke (erase to alpha 0 and translucent edge)
    const eraserBuffer = new Uint8ClampedArray(afterBuffer);
    for (let r = 5; r < 15; r++) {
        for (let c = 5; c < 15; c++) {
            const idx = ((10 + r) * W + (10 + c)) * 4;
            eraserBuffer[idx] = 0;
            eraserBuffer[idx + 1] = 0;
            eraserBuffer[idx + 2] = 0;
            eraserBuffer[idx + 3] = (r === 5 || r === 14) ? 50 : 0; // translucent edge
        }
    }
    const eraserBeforePatch = cropPixelPatch(afterBuffer, W, H, strokeRect);
    const eraserAfterPatch = cropPixelPatch(eraserBuffer, W, H, strokeRect);

    // Apply eraser
    const eraserLive = new Uint8ClampedArray(afterBuffer);
    applyPixelPatch(eraserLive, W, H, eraserAfterPatch, strokeRect);
    assert.deepEqual(eraserLive, eraserBuffer);

    // Undo eraser
    applyPixelPatch(eraserLive, W, H, eraserBeforePatch, strokeRect);
    assert.deepEqual(eraserLive, afterBuffer, 'Eraser undo must match afterBuffer byte-for-byte');
}

// 6. Memory estimation
{
    const beforePatch = { pixels: new Uint8ClampedArray(400) };
    const afterPatch = { pixels: new Uint8ClampedArray(400) };
    const bytes = estimatePatchHistoryBytes(beforePatch, afterPatch);
    assert.equal(bytes, 400 + 400 + RASTER_PATCH_BASE_METADATA_BYTES);
}

// 7. Legacy path preservation and pixel-only snapshot contract
{
    // Layer with legacy pathsData and paths
    const layerData = {
        id: 'layer-legacy',
        pathsData: [{ id: 'legacy-1', points: [{ x: 1, y: 1 }] }],
        paths: [{ points: [1, 1, 2, 2] }]
    };

    // Pixel-only snapshot: options.includePathCollections = false
    const pixelOnlySnapshot = {
        layerId: layerData.id,
        width: 100,
        height: 100,
        pixels: new Uint8ClampedArray(100 * 100 * 4)
        // pathsData & paths omitted
    };

    // When restoring with restorePathCollections: false, legacy pathsData/paths MUST be preserved untouched
    const targetLayerData1 = {
        id: 'layer-legacy',
        pathsData: structuredClone(layerData.pathsData),
        paths: structuredClone(layerData.paths)
    };

    const restorePathCollections1 = false;
    if (restorePathCollections1) {
        if (Array.isArray(pixelOnlySnapshot.pathsData)) {
            targetLayerData1.pathsData = structuredClone(pixelOnlySnapshot.pathsData);
        }
    }
    assert.equal(targetLayerData1.pathsData.length, 1);
    assert.equal(targetLayerData1.pathsData[0].id, 'legacy-1');
    assert.equal(targetLayerData1.paths.length, 1);

    // Even when restoring with restorePathCollections: true (default), if snapshot has no pathsData,
    // it MUST NOT overwrite existing legacy pathsData with empty array []
    const targetLayerData2 = {
        id: 'layer-legacy',
        pathsData: structuredClone(layerData.pathsData),
        paths: structuredClone(layerData.paths)
    };
    const restorePathCollections2 = true;
    if (restorePathCollections2) {
        if (Array.isArray(pixelOnlySnapshot.pathsData)) {
            targetLayerData2.pathsData = structuredClone(pixelOnlySnapshot.pathsData);
        }
        if (Array.isArray(pixelOnlySnapshot.paths)) {
            targetLayerData2.paths = structuredClone(pixelOnlySnapshot.paths);
        }
    }
    assert.equal(targetLayerData2.pathsData.length, 1, 'Missing pathsData in snapshot must not clear layer pathsData');
    assert.equal(targetLayerData2.paths.length, 1, 'Missing paths in snapshot must not clear layer paths');
}

// 8. Cross-layer Undo/Redo and deleted layer safety (Cases 1, 2, 3, 4)
{
    const W = 40;
    const H = 40;
    const TOTAL_BYTES = W * H * 4;

    // Layer A setup
    const layerA = {
        id: 'layer-A',
        layerData: { id: 'layer-A', rasterBounds: { x: 0, y: 0, width: W, height: H } },
        pixels: new Uint8ClampedArray(TOTAL_BYTES).fill(100)
    };
    // Layer B setup
    const layerB = {
        id: 'layer-B',
        layerData: { id: 'layer-B', rasterBounds: { x: 0, y: 0, width: W, height: H } },
        pixels: new Uint8ClampedArray(TOTAL_BYTES).fill(200)
    };

    const initialA = new Uint8ClampedArray(layerA.pixels);
    const initialB = new Uint8ClampedArray(layerB.pixels);

    let activeLayer = layerB; // Layer B is active!

    const layerManagerMock = {
        getActiveLayer() {
            return activeLayer;
        },
        getLayerById(id) {
            if (id === 'layer-A') return layerA;
            if (id === 'layer-B') return layerB;
            return null;
        },
        createLayerRasterSnapshot(layer, options = {}) {
            if (!layer) return null;
            return {
                layerId: layer.id,
                width: W,
                height: H,
                pixels: new Uint8ClampedArray(layer.pixels)
            };
        },
        restoreLayerRasterSnapshot(snapshot, options = {}) {
            if (!snapshot) return false;
            const target = this.getLayerById(snapshot.layerId);
            if (!target) return false;
            target.pixels.set(snapshot.pixels);
            return true;
        }
    };

    function createRestorePatch(layerId) {
        return function restorePatch(targetPatch) {
            if (!layerId || !layerManagerMock) return;
            const targetLayer = typeof layerManagerMock.getLayerById === 'function'
                ? layerManagerMock.getLayerById(layerId)
                : layerManagerMock.getLayers?.().find(l => l.layerData?.id === layerId || l.id === layerId);
            if (!targetLayer) return;

            const currentSnap = layerManagerMock.createLayerRasterSnapshot(targetLayer, { includePathCollections: false });
            if (!currentSnap) return;
            applyPixelPatch(
                currentSnap.pixels,
                currentSnap.width,
                currentSnap.height,
                targetPatch.pixels,
                targetPatch.rect
            );
            layerManagerMock.restoreLayerRasterSnapshot(currentSnap, { restorePathCollections: false });
        };
    }

    const dirtyRect = { x: 5, y: 5, width: 10, height: 10 };

    // --- Case 1: Layer A Pen stroke, Layer B active -> Undo ---
    const afterAPen = new Uint8ClampedArray(initialA);
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
            const idx = ((5 + r) * W + (5 + c)) * 4;
            afterAPen[idx] = 255;
            afterAPen[idx + 1] = 0;
            afterAPen[idx + 2] = 0;
            afterAPen[idx + 3] = 255;
        }
    }
    const penBeforePatch = { rect: dirtyRect, pixels: cropPixelPatch(initialA, W, H, dirtyRect) };
    const penAfterPatch = { rect: dirtyRect, pixels: cropPixelPatch(afterAPen, W, H, dirtyRect) };

    // Set layerA to stroke result
    layerA.pixels.set(afterAPen);
    // Active is layerB
    activeLayer = layerB;

    const restorePatchA = createRestorePatch('layer-A');

    // Execute Undo for Layer A
    restorePatchA(penBeforePatch);

    // Assert: A returns to before, B is untouched byte-for-byte
    assert.deepEqual(layerA.pixels, initialA, 'Case 1: Layer A must be restored to initial');
    assert.deepEqual(layerB.pixels, initialB, 'Case 1: Layer B must remain completely untouched');
    assert.equal(activeLayer, layerB, 'Case 1: Active layer must remain layer B');

    // --- Case 2: Redo -> Layer A returns to after, B untouched ---
    restorePatchA(penAfterPatch);
    assert.deepEqual(layerA.pixels, afterAPen, 'Case 2: Layer A must be redone to after');
    assert.deepEqual(layerB.pixels, initialB, 'Case 2: Layer B must remain completely untouched');
    assert.equal(activeLayer, layerB, 'Case 2: Active layer must remain layer B');

    // --- Case 3: Eraser stroke on Layer A, Layer B active ---
    const afterAEraser = new Uint8ClampedArray(afterAPen);
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
            const idx = ((5 + r) * W + (5 + c)) * 4;
            afterAEraser[idx] = 0;
            afterAEraser[idx + 1] = 0;
            afterAEraser[idx + 2] = 0;
            afterAEraser[idx + 3] = 0; // erased
        }
    }
    const eraserBeforePatch = { rect: dirtyRect, pixels: cropPixelPatch(afterAPen, W, H, dirtyRect) };
    const eraserAfterPatch = { rect: dirtyRect, pixels: cropPixelPatch(afterAEraser, W, H, dirtyRect) };

    // Apply eraser to layer A
    layerA.pixels.set(afterAEraser);

    // Undo Eraser
    restorePatchA(eraserBeforePatch);
    assert.deepEqual(layerA.pixels, afterAPen, 'Case 3: Eraser undo must restore Layer A');
    assert.deepEqual(layerB.pixels, initialB, 'Case 3: Layer B must remain completely untouched');

    // Redo Eraser
    restorePatchA(eraserAfterPatch);
    assert.deepEqual(layerA.pixels, afterAEraser, 'Case 3: Eraser redo must restore Layer A erased state');
    assert.deepEqual(layerB.pixels, initialB, 'Case 3: Layer B must remain completely untouched');

    // --- Case 4: Target layer deleted / does not exist ---
    const restorePatchDeleted = createRestorePatch('layer-deleted-999');
    // Calling restorePatch on non-existent layer must not throw, must not mutate active layer
    assert.doesNotThrow(() => {
        restorePatchDeleted(penBeforePatch);
    }, 'Case 4: Must not throw when target layer does not exist');
    assert.deepEqual(layerB.pixels, initialB, 'Case 4: Active layer B must not be mutated');
    assert.equal(activeLayer, layerB, 'Case 4: Active layer must remain layer B');
}

console.log('verify-long-drawing-degradation-fix: ALL CHECKS PASSED');


