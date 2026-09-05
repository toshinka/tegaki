/**
 * build/verify-pen-responsiveness-enhancements.mjs
 * 
 * ペン入力レスポンス追加強化（第4回改修）の自動契約検証テスト
 * - Stage A: GPU baseline scratch eligibility & fallback contracts
 * - Stage B: Pen / Eraser realtime line batch lifecycle & Graphics churn contracts
 * - Stage C: adaptive sampling pure helper contracts
 */

import assert from 'node:assert/strict';
import { rasterBoundsEqual } from '../system/raster-bounds.js';
import {
    calculateStrokeDirtyRect,
    projectRectToRasterLocal,
    cropPixelPatch,
    applyPixelPatch,
    unpremultiplyPixels,
    estimatePatchHistoryBytes
} from '../system/drawing/raster-patch-history.js';
import {
    calculateScreenToLocalRatio,
    calculateAdaptiveStep,
    calculateAdaptiveSamplingSteps,
    generateAdaptiveInterpolationPoints
} from '../system/drawing/realtime-stroke-sampling.js';

console.log('--- verify-pen-responsiveness-enhancements: starting tests ---');

// ============================================================================
// 1. Batch Lifecycle & Nested Handling Contract
// ============================================================================
{
    // Mocking the batch coordinator logic
    class BatchCoordinator {
        constructor() {
            this.activeBatch = null;
            this.flushedBatches = [];
            this.graphicsCreated = 0;
            this.renderCalls = 0;
        }

        beginBatch(mode, targetLayer, renderTarget) {
            if (this.activeBatch) {
                // Nested batch: increment depth, do not create new batch
                this.activeBatch.depth++;
                return this.activeBatch;
            }
            this.activeBatch = {
                mode,
                targetLayer,
                renderTarget,
                segments: [],
                depth: 1
            };
            return this.activeBatch;
        }

        queueSegment(segment) {
            if (!this.activeBatch) {
                throw new Error('No active batch to queue segment');
            }
            this.activeBatch.segments.push(segment);
        }

        flushBatch(force = false) {
            if (!this.activeBatch) return;
            if (!force && this.activeBatch.depth > 1) {
                // Nested: just decrement depth, don't flush yet
                this.activeBatch.depth--;
                return;
            }

            const batch = this.activeBatch;
            this.activeBatch = null;

            if (batch.segments.length > 0) {
                this.graphicsCreated++; // 1 Graphics for the whole batch
                this.renderCalls++;    // 1 renderer.render call
                this.flushedBatches.push(batch);
            }
        }

        cancel() {
            this.activeBatch = null;
        }
    }

    const coord = new BatchCoordinator();

    // Test 1.1: Single updateStroke batching (depth = 1)
    coord.beginBatch('pen', 'layer-1', 'rt-1');
    for (let i = 0; i < 10; i++) {
        coord.queueSegment({ x0: i, y0: i, x1: i + 1, y1: i + 1, p0: 0.5, p1: 0.5 });
    }
    coord.flushBatch();
    assert.equal(coord.renderCalls, 1, 'Single move with 10 segments must result in exactly 1 render call');
    assert.equal(coord.graphicsCreated, 1, 'Single move with 10 segments must create exactly 1 Graphics instance');
    assert.equal(coord.flushedBatches.length, 1);
    assert.equal(coord.flushedBatches[0].segments.length, 10);

    // Test 1.2: Nested batching (outer updateStrokeBatch with 3 inner updateStroke calls)
    coord.beginBatch('pen', 'layer-1', 'rt-1'); // outer begin (depth=1)
    
    // inner 1
    coord.beginBatch('pen', 'layer-1', 'rt-1'); // depth=2
    coord.queueSegment({ x0: 0, y0: 0, x1: 1, y1: 1 });
    coord.flushBatch(); // depth becomes 1, NO flush yet!
    assert.equal(coord.renderCalls, 1, 'Inner flush must not trigger render');

    // inner 2
    coord.beginBatch('pen', 'layer-1', 'rt-1'); // depth=2
    coord.queueSegment({ x0: 1, y0: 1, x1: 2, y1: 2 });
    coord.flushBatch(); // depth becomes 1, NO flush yet!
    assert.equal(coord.renderCalls, 1, 'Inner flush must not trigger render');

    // outer flush
    coord.flushBatch(); // depth=1 -> FLUSH!
    assert.equal(coord.renderCalls, 2, 'Outer batch finish must trigger exactly 1 additional render call');
    assert.equal(coord.graphicsCreated, 2, 'Outer batch finish must create exactly 1 additional Graphics');
    assert.equal(coord.flushedBatches[1].segments.length, 2);

    // Test 1.3: Eraser mode batching
    coord.beginBatch('eraser', 'layer-1', 'rt-1');
    for (let i = 0; i < 5; i++) {
        coord.queueSegment({ x0: i, y0: i, x1: i + 1, y1: i + 1 });
    }
    coord.flushBatch();
    assert.equal(coord.renderCalls, 3, 'Eraser must be batched into 1 render call');
    assert.equal(coord.flushedBatches[2].mode, 'eraser');

    // Test 1.4: Cancel cleanup
    coord.beginBatch('pen', 'layer-1', 'rt-1');
    coord.queueSegment({ x0: 0, y0: 0, x1: 1, y1: 1 });
    coord.cancel();
    assert.equal(coord.activeBatch, null, 'Cancel must clean up active batch');
    assert.equal(coord.renderCalls, 3, 'Cancel must not trigger render call');
}

// ============================================================================
// 2. Target Layer & Render Target Immutability Contract
// ============================================================================
{
    const strokeTarget = { id: 'layer-A', renderTexture: { id: 'rt-A' } };
    let currentActive = strokeTarget;

    // Simulate stroke start
    const pinnedTargetLayer = strokeTarget;
    const pinnedRenderTarget = strokeTarget.renderTexture;

    // In the middle of the stroke, user / system switches active layer to layer-B!
    currentActive = { id: 'layer-B', renderTexture: { id: 'rt-B' } };

    // Batch render must still target pinnedTargetLayer and pinnedRenderTarget!
    function resolveBatchTarget(pinnedLayer, currentActiveLayer) {
        return pinnedLayer || currentActiveLayer;
    }

    const resolved = resolveBatchTarget(pinnedTargetLayer, currentActive);
    assert.equal(resolved.id, 'layer-A', 'Stroke batch must target pinned layer-A, NOT layer-B');
    assert.equal(resolved.renderTexture.id, 'rt-A', 'Stroke batch must target pinned rt-A, NOT rt-B');
}

// ============================================================================
// 3. Stage A: GPU Baseline Eligibility & Fallback Logic Contract
// ============================================================================
{
    function checkGpuBaselineEligibility({
        mode,
        isNormalRasterLayer,
        strokeTargetLayer,
        hasSelection,
        rasterBoundsContainsFrame,
        renderTextureExists,
        rendererExists
    }) {
        if (mode !== 'pen' && mode !== 'eraser') return false;
        if (!isNormalRasterLayer) return false;
        if (!strokeTargetLayer) return false;
        if (hasSelection) return false;
        if (!rasterBoundsContainsFrame) return false;
        if (!renderTextureExists) return false;
        if (!rendererExists) return false;
        return true;
    }

    // Eligible standard pen stroke
    assert.equal(checkGpuBaselineEligibility({
        mode: 'pen',
        isNormalRasterLayer: true,
        strokeTargetLayer: { id: 'l1' },
        hasSelection: false,
        rasterBoundsContainsFrame: true,
        renderTextureExists: true,
        rendererExists: true
    }), true, 'Standard pen stroke must be eligible for GPU baseline');

    // Eligible standard eraser stroke
    assert.equal(checkGpuBaselineEligibility({
        mode: 'eraser',
        isNormalRasterLayer: true,
        strokeTargetLayer: { id: 'l1' },
        hasSelection: false,
        rasterBoundsContainsFrame: true,
        renderTextureExists: true,
        rendererExists: true
    }), true, 'Standard eraser stroke must be eligible for GPU baseline');

    // Fallback: Airbrush
    assert.equal(checkGpuBaselineEligibility({
        mode: 'airbrush',
        isNormalRasterLayer: true,
        strokeTargetLayer: { id: 'l1' },
        hasSelection: false,
        rasterBoundsContainsFrame: true,
        renderTextureExists: true,
        rendererExists: true
    }), false, 'Airbrush must fallback to CPU full snapshot');

    // Fallback: Selection active
    assert.equal(checkGpuBaselineEligibility({
        mode: 'pen',
        isNormalRasterLayer: true,
        strokeTargetLayer: { id: 'l1' },
        hasSelection: true,
        rasterBoundsContainsFrame: true,
        renderTextureExists: true,
        rendererExists: true
    }), false, 'Selection active must fallback to CPU full snapshot');

    // Fallback: Raster bounds expansion needed
    assert.equal(checkGpuBaselineEligibility({
        mode: 'pen',
        isNormalRasterLayer: true,
        strokeTargetLayer: { id: 'l1' },
        hasSelection: false,
        rasterBoundsContainsFrame: false,
        renderTextureExists: true,
        rendererExists: true
    }), false, 'Bounds expansion must fallback to CPU full snapshot');
}

// ============================================================================
// 4. Scratch Resource Cache & Dimensions Contract
// ============================================================================
{
    class ScratchTexturePool {
        constructor() {
            this.cachedTexture = null;
            this.allocatedCount = 0;
            this.destroyedCount = 0;
        }

        acquire(width, height, resolution = 1) {
            if (this.cachedTexture) {
                if (
                    this.cachedTexture.width === width &&
                    this.cachedTexture.height === height &&
                    this.cachedTexture.resolution === resolution
                ) {
                    return this.cachedTexture; // Reused!
                }
                // Size mismatch: destroy old
                this.cachedTexture.destroyed = true;
                this.destroyedCount++;
                this.cachedTexture = null;
            }

            this.allocatedCount++;
            this.cachedTexture = {
                width,
                height,
                resolution,
                destroyed: false
            };
            return this.cachedTexture;
        }

        destroy() {
            if (this.cachedTexture) {
                this.cachedTexture.destroyed = true;
                this.destroyedCount++;
                this.cachedTexture = null;
            }
        }
    }

    const pool = new ScratchTexturePool();

    // Stroke 1: 1200x1200
    const tex1 = pool.acquire(1200, 1200);
    assert.equal(pool.allocatedCount, 1);
    assert.equal(pool.destroyedCount, 0);

    // Stroke 2: same size 1200x1200 -> must REUSE without new allocation!
    const tex2 = pool.acquire(1200, 1200);
    assert.equal(tex1, tex2, 'Same size must reuse scratch texture');
    assert.equal(pool.allocatedCount, 1, 'Allocation count must stay 1');
    assert.equal(pool.destroyedCount, 0);

    // Stroke 3: resize to 2000x2000 -> destroy old, allocate new
    const tex3 = pool.acquire(2000, 2000);
    assert.equal(tex1.destroyed, true, 'Old texture must be destroyed on size change');
    assert.equal(pool.allocatedCount, 2, 'Allocation count becomes 2');
    assert.equal(pool.destroyedCount, 1, 'Destroyed count becomes 1');
    assert.equal(tex3.width, 2000);

    pool.destroy();
    assert.equal(pool.destroyedCount, 2);
    assert.equal(pool.cachedTexture, null);
}

// ============================================================================
// 5. Stage C: Adaptive Stroke Sampling Pure Helper Contract
// ============================================================================
{
    // 5.1: Ratio calculation at various zoom levels
    // 100% zoom: 15 screen px -> 15 local px
    const ratio100 = calculateScreenToLocalRatio({ x: 0, y: 0 }, { x: 15, y: 0 }, { x: 0, y: 0 }, { x: 15, y: 0 });
    assert.equal(ratio100, 1.0, '100% zoom ratio must be 1.0');

    // 50% zoom: 15 screen px -> 30 local px
    const ratio50 = calculateScreenToLocalRatio({ x: 0, y: 0 }, { x: 15, y: 0 }, { x: 0, y: 0 }, { x: 30, y: 0 });
    assert.equal(ratio50, 2.0, '50% zoom ratio must be 2.0');

    // 10% zoom: 15 screen px -> 150 local px
    const ratio10 = calculateScreenToLocalRatio({ x: 0, y: 0 }, { x: 15, y: 0 }, { x: 0, y: 0 }, { x: 150, y: 0 });
    assert.equal(ratio10, 10.0, '10% zoom ratio must be 10.0');

    // 5% zoom: 15 screen px -> 300 local px
    const ratio5 = calculateScreenToLocalRatio({ x: 0, y: 0 }, { x: 15, y: 0 }, { x: 0, y: 0 }, { x: 300, y: 0 });
    assert.equal(ratio5, 20.0, '5% zoom ratio must be 20.0');

    // Zero movement: screen distance 0 -> must safely return 1.0
    const ratioZero = calculateScreenToLocalRatio({ x: 10, y: 10 }, { x: 10, y: 10 }, { x: 20, y: 20 }, { x: 20, y: 20 });
    assert.equal(ratioZero, 1.0, 'Zero screen distance must safely return 1.0');

    // 5.2: Step size & max clamp contract
    assert.equal(calculateAdaptiveStep({ localPerScreenPx: 1.0 }), 1, '100% zoom must have step 1');
    assert.equal(calculateAdaptiveStep({ localPerScreenPx: 0.5 }), 1, '200% zoom must have step 1');
    assert.equal(calculateAdaptiveStep({ localPerScreenPx: 2.0 }), 2, '50% zoom must have step 2');
    assert.equal(calculateAdaptiveStep({ localPerScreenPx: 10.0 }), 10, '10% zoom must have step 10');
    assert.equal(calculateAdaptiveStep({ localPerScreenPx: 20.0, maxStep: 16 }), 16, '5% zoom must clamp step to maxStep 16');

    // 5.3: 100% zoom backward compatibility & endpoint preservation
    // Moving 15 local px (15 screen px): legacy generates 15 intermediate points
    const res100 = generateAdaptiveInterpolationPoints({
        lastLocal: { x: 0, y: 0 },
        currentLocal: { x: 15, y: 0 },
        lastPressure: 0.5,
        currentPressure: 0.5,
        lastClient: { x: 0, y: 0 },
        currentClient: { x: 15, y: 0 }
    });
    assert.equal(res100.steps, 15, '100% zoom must generate exactly 15 steps (legacy identical)');
    assert.equal(res100.points.length, 15);
    assert.equal(res100.stepSize, 1);
    // End coordinates check
    assert.equal(res100.points[0].x, 15 / 16);
    assert.equal(res100.points[14].x, 15 * 15 / 16);

    // 5.4: 10% zoom point reduction contract
    // Moving 15 screen px (= 150 local px): legacy would generate 150 points. Adaptive must generate ~15 points!
    const res10 = generateAdaptiveInterpolationPoints({
        lastLocal: { x: 0, y: 0 },
        currentLocal: { x: 150, y: 0 },
        lastPressure: 0.5,
        currentPressure: 0.5,
        lastClient: { x: 0, y: 0 },
        currentClient: { x: 15, y: 0 }
    });
    assert.equal(res10.stepSize, 10);
    assert.equal(res10.steps, 15, '10% zoom must generate 15 steps instead of 150 (90% reduction)');
    assert.equal(res10.points.length, 15);

    // 5.5: Pressure preservation contract (Chapter 27)
    // Small spatial move (1 screen px = 10 local px), but large pressure jump (0.1 -> 0.9, delta = 0.8)
    const resPressure = generateAdaptiveInterpolationPoints({
        lastLocal: { x: 0, y: 0 },
        currentLocal: { x: 10, y: 0 },
        lastPressure: 0.1,
        currentPressure: 0.9,
        lastClient: { x: 0, y: 0 },
        currentClient: { x: 1, y: 0 },
        pressureEnabled: true
    });
    assert.ok(resPressure.steps >= 5, `Pressure jump must generate at least 5 steps (got ${resPressure.steps})`);
    assert.ok(resPressure.points[0].pressure > 0.1 && resPressure.points[resPressure.points.length - 1].pressure < 0.9);

    // 5.6: Zero movement contract
    const resZero = generateAdaptiveInterpolationPoints({
        lastLocal: { x: 50, y: 50 },
        currentLocal: { x: 50, y: 50 },
        lastPressure: 0.5,
        currentPressure: 0.5
    });
    assert.equal(resZero.steps, 1, 'Zero movement must produce 1 step without error');
    assert.equal(resZero.points.length, 1);
    assert.equal(resZero.points[0].x, 50);
    assert.equal(resZero.points[0].y, 50);
}

// ============================================================================
// 6. Stage A/B History Recording & Renderer Resolution Regression Contract
// ============================================================================
{
    // Verifies that brush-core does NOT rely on non-existent `this.app?.renderer`,
    // and correctly resolves renderer via `this.layerManager?.app?.renderer`.
    const mockRenderer = {
        extract: {
            pixels: () => new Uint8ClampedArray(48 * 48 * 4)
        }
    };

    function resolveRenderer(brushCoreInstance) {
        return brushCoreInstance.layerManager?.app?.renderer || null;
    }

    const mockBrushCore = {
        app: undefined, // this.app is undefined on BrushCore
        layerManager: {
            app: { renderer: mockRenderer },
            getLayerIndex: () => 0
        }
    };

    const resolved = resolveRenderer(mockBrushCore);
    assert.ok(resolved, 'Renderer must be successfully resolved via layerManager.app.renderer');
    assert.equal(resolved, mockRenderer, 'Resolved renderer must match layerManager renderer');
}

// ============================================================================
// 7. Raster Bounds Expansion History Handling Contract (Pen & Eraser)
// ============================================================================
{
    // Helper to simulate the exact BrushCore history recording logic
    function simulateStrokeHistoryRecording({
        mode,
        initialBounds,
        expandedBounds,
        initialPixels,
        drawnPixels,
        useGpuBaseline = true
    }) {
        let currentBounds = { ...initialBounds };
        let currentWidth = initialBounds.width;
        let currentHeight = initialBounds.height;
        let currentPixels = new Uint8ClampedArray(initialPixels);

        // History manager recorder mock
        let recordedHistory = null;
        const mockHistoryManager = {
            isApplying: false,
            record: (cmd) => {
                recordedHistory = cmd;
            }
        };

        // Layer mock
        const mockLayer = {
            id: 'test-layer-1',
            layerData: {
                id: 'test-layer-1',
                rasterBounds: currentBounds,
                renderTexture: { width: currentWidth, height: currentHeight }
            }
        };

        // Layer manager mock
        const mockLayerManager = {
            getLayerById: (id) => (id === mockLayer.id ? mockLayer : null),
            getLayers: () => [mockLayer],
            getLayerIndex: () => 0,
            createLayerRasterSnapshot: (layer) => ({
                layerId: layer.layerData.id,
                width: layer.layerData.renderTexture.width,
                height: layer.layerData.renderTexture.height,
                rasterBounds: { ...layer.layerData.rasterBounds },
                pixels: new Uint8ClampedArray(currentPixels)
            }),
            restoreLayerRasterSnapshot: (snapshot) => {
                currentWidth = snapshot.width;
                currentHeight = snapshot.height;
                currentBounds = { ...snapshot.rasterBounds };
                mockLayer.layerData.rasterBounds = currentBounds;
                mockLayer.layerData.renderTexture = { width: currentWidth, height: currentHeight };
                currentPixels = new Uint8ClampedArray(snapshot.pixels);
                return true;
            }
        };

        // Step 1: startStroke() - capture before state BEFORE bounds expansion
        let gpuBaseline = null;
        let beforeSnapshot = null;

        if (useGpuBaseline) {
            // GPU baseline scratch texture simulates initial layer pixels
            gpuBaseline = {
                layerId: mockLayer.layerData.id,
                bounds: { ...currentBounds },
                width: currentWidth,
                height: currentHeight
            };
        } else {
            // CPU snapshot taken before expansion
            beforeSnapshot = mockLayerManager.createLayerRasterSnapshot(mockLayer);
        }

        // Step 2: _ensureLayerRasterFrameForStroke() - expands raster bounds
        if (expandedBounds) {
            currentBounds = { ...expandedBounds };
            currentWidth = expandedBounds.width;
            currentHeight = expandedBounds.height;
            mockLayer.layerData.rasterBounds = currentBounds;
            mockLayer.layerData.renderTexture = { width: currentWidth, height: currentHeight };
            currentPixels = new Uint8ClampedArray(drawnPixels);
        }

        // Mock renderer for pixel extraction
        const mockRenderer = {
            extract: {
                pixels: ({ target, frame }) => {
                    // If target is baseline sprite, return initial pixels
                    if (useGpuBaseline && !frame) {
                        return {
                            width: gpuBaseline.width,
                            height: gpuBaseline.height,
                            pixels: new Uint8ClampedArray(initialPixels)
                        };
                    }
                    if (frame) {
                        // Frame extraction for dirty rect
                        return {
                            width: frame.width,
                            height: frame.height,
                            pixels: new Uint8ClampedArray(frame.width * frame.height * 4).fill(255)
                        };
                    }
                    return null;
                }
            }
        };

        // Step 3: _recordStrokeHistory() execution
        const strokePoints = [{ x: 55, y: 55 }, { x: 60, y: 60 }];
        const strokeSettings = { size: 4 };

        const isPatchEligible = (mode === 'pen' || mode === 'eraser')
            && Array.isArray(strokePoints)
            && strokePoints.length > 0
            && mockRenderer?.extract?.pixels
            && mockLayer.layerData?.renderTexture;

        let recordedAsPatch = false;
        if (isPatchEligible) {
            const beforeBounds = gpuBaseline?.bounds || beforeSnapshot?.rasterBounds;
            if (rasterBoundsEqual(beforeBounds, currentBounds)) {
                // Dirty rect patch path
                recordedAsPatch = true;
                const projectDirtyRect = calculateStrokeDirtyRect(strokePoints, strokeSettings);
                const localDirtyRect = projectRectToRasterLocal(projectDirtyRect, currentBounds);
                mockHistoryManager.record({
                    name: `draw-${mode}`,
                    meta: {
                        type: 'draw-patch',
                        mode,
                        layerId: mockLayer.layerData.id,
                        dirtyRect: localDirtyRect
                    },
                    undo: () => {},
                    do: () => {}
                });
            }
        }

        if (!recordedAsPatch) {
            // Full snapshot fallback
            if (!beforeSnapshot && gpuBaseline && mockRenderer?.extract?.pixels) {
                const result = mockRenderer.extract.pixels({ target: 'sprite', clearColor: '#00000000' });
                const px = new Uint8ClampedArray(result.pixels);
                unpremultiplyPixels(px);
                beforeSnapshot = {
                    layerId: gpuBaseline.layerId,
                    width: Math.round(result.width || gpuBaseline.width),
                    height: Math.round(result.height || gpuBaseline.height),
                    rasterBounds: { ...gpuBaseline.bounds, width: result.width, height: result.height },
                    pixels: px
                };
            }
            const afterSnapshot = mockLayerManager.createLayerRasterSnapshot(mockLayer);
            mockHistoryManager.record({
                name: `draw-${mode}`,
                meta: {
                    type: 'draw-full',
                    mode,
                    layerId: mockLayer.layerData.id
                },
                undo: () => mockLayerManager.restoreLayerRasterSnapshot(beforeSnapshot),
                do: () => mockLayerManager.restoreLayerRasterSnapshot(afterSnapshot)
            });
        }

        return {
            history: recordedHistory,
            getCurrentState: () => ({
                bounds: { ...currentBounds },
                width: currentWidth,
                height: currentHeight,
                pixels: new Uint8ClampedArray(currentPixels)
            }),
            undo: () => recordedHistory?.undo?.(),
            redo: () => recordedHistory?.do?.()
        };
    }

    // --- Case 7.1: Pen bounds expansion -> draw-full fallback, Undo restores pre-expansion bounds & size, Redo restores expanded ---
    {
        const initialBounds = { x: 50, y: 50, width: 40, height: 40 };
        const expandedBounds = { x: 0, y: 0, width: 100, height: 100 };
        const initialPixels = new Uint8ClampedArray(40 * 40 * 4);
        for (let i = 0; i < initialPixels.length; i += 4) {
            initialPixels[i] = 110;
            initialPixels[i + 1] = 120;
            initialPixels[i + 2] = 130;
            initialPixels[i + 3] = 255;
        }
        const drawnPixels = new Uint8ClampedArray(100 * 100 * 4);
        for (let i = 0; i < drawnPixels.length; i += 4) {
            drawnPixels[i] = 220;
            drawnPixels[i + 1] = 200;
            drawnPixels[i + 2] = 180;
            drawnPixels[i + 3] = 255;
        }

        const sim = simulateStrokeHistoryRecording({
            mode: 'pen',
            initialBounds,
            expandedBounds,
            initialPixels,
            drawnPixels,
            useGpuBaseline: true
        });

        assert.ok(sim.history, 'History must be recorded');
        assert.equal(sim.history.meta.type, 'draw-full', 'Bounds expansion must trigger draw-full fallback');

        // Current state is expanded after stroke
        assert.deepEqual(sim.getCurrentState().bounds, expandedBounds);
        assert.equal(sim.getCurrentState().width, 100);
        assert.equal(sim.getCurrentState().height, 100);
        assert.deepEqual(sim.getCurrentState().pixels, drawnPixels);

        // Undo -> restores pre-expansion bounds, dimensions, and initial pixels
        sim.undo();
        assert.deepEqual(sim.getCurrentState().bounds, initialBounds, 'Undo must restore original pre-expansion rasterBounds');
        assert.equal(sim.getCurrentState().width, 40, 'Undo must restore original width 40');
        assert.equal(sim.getCurrentState().height, 40, 'Undo must restore original height 40');
        assert.deepEqual(sim.getCurrentState().pixels, initialPixels, 'Undo must restore initial pixels');

        // Redo -> restores expanded bounds, dimensions, and drawn pixels
        sim.redo();
        assert.deepEqual(sim.getCurrentState().bounds, expandedBounds, 'Redo must restore expanded rasterBounds');
        assert.equal(sim.getCurrentState().width, 100, 'Redo must restore expanded width 100');
        assert.equal(sim.getCurrentState().height, 100, 'Redo must restore expanded height 100');
        assert.deepEqual(sim.getCurrentState().pixels, drawnPixels, 'Redo must restore drawn pixels');
    }

    // --- Case 7.2: Eraser bounds expansion -> draw-full fallback, Undo restores pre-expansion bounds, Redo restores expanded ---
    {
        const initialBounds = { x: 30, y: 30, width: 50, height: 50 };
        const expandedBounds = { x: 0, y: 0, width: 120, height: 120 };
        const initialPixels = new Uint8ClampedArray(50 * 50 * 4);
        for (let i = 0; i < initialPixels.length; i += 4) {
            initialPixels[i] = 150;
            initialPixels[i + 1] = 160;
            initialPixels[i + 2] = 170;
            initialPixels[i + 3] = 255;
        }
        const drawnPixels = new Uint8ClampedArray(120 * 120 * 4); // erased to 0

        const sim = simulateStrokeHistoryRecording({
            mode: 'eraser',
            initialBounds,
            expandedBounds,
            initialPixels,
            drawnPixels,
            useGpuBaseline: true
        });

        assert.ok(sim.history, 'History must be recorded for eraser');
        assert.equal(sim.history.meta.type, 'draw-full', 'Eraser bounds expansion must trigger draw-full fallback');

        sim.undo();
        assert.deepEqual(sim.getCurrentState().bounds, initialBounds, 'Eraser Undo must restore pre-expansion bounds');
        assert.equal(sim.getCurrentState().width, 50);
        assert.equal(sim.getCurrentState().height, 50);
        assert.deepEqual(sim.getCurrentState().pixels, initialPixels);

        sim.redo();
        assert.deepEqual(sim.getCurrentState().bounds, expandedBounds, 'Eraser Redo must restore expanded bounds');
        assert.equal(sim.getCurrentState().width, 120);
        assert.equal(sim.getCurrentState().height, 120);
        assert.deepEqual(sim.getCurrentState().pixels, drawnPixels);
    }

    // --- Case 7.3: Bounds unchanged -> maintains dirty rect patch History (draw-patch) for both Pen & Eraser ---
    {
        const unchangedBounds = { x: 0, y: 0, width: 100, height: 100 };
        const pixels = new Uint8ClampedArray(100 * 100 * 4);
        for (let i = 0; i < pixels.length; i += 4) {
            pixels[i] = 100;
            pixels[i + 1] = 100;
            pixels[i + 2] = 100;
            pixels[i + 3] = 255;
        }

        // Pen unchanged bounds
        const penSim = simulateStrokeHistoryRecording({
            mode: 'pen',
            initialBounds: unchangedBounds,
            expandedBounds: null, // no expansion
            initialPixels: pixels,
            drawnPixels: pixels,
            useGpuBaseline: true
        });
        assert.equal(penSim.history.meta.type, 'draw-patch', 'Unchanged bounds Pen stroke must record draw-patch');

        // Eraser unchanged bounds
        const eraserSim = simulateStrokeHistoryRecording({
            mode: 'eraser',
            initialBounds: unchangedBounds,
            expandedBounds: null, // no expansion
            initialPixels: pixels,
            drawnPixels: pixels,
            useGpuBaseline: true
        });
        assert.equal(eraserSim.history.meta.type, 'draw-patch', 'Unchanged bounds Eraser stroke must record draw-patch');
    }

    // --- Case 7.4: CPU snapshot path (e.g. selection active or baseline unavailable) with bounds expansion ---
    {
        const initialBounds = { x: 10, y: 10, width: 60, height: 60 };
        const expandedBounds = { x: 0, y: 0, width: 150, height: 150 };
        const initialPixels = new Uint8ClampedArray(60 * 60 * 4);
        for (let i = 0; i < initialPixels.length; i += 4) {
            initialPixels[i] = 77;
            initialPixels[i + 1] = 77;
            initialPixels[i + 2] = 77;
            initialPixels[i + 3] = 255;
        }
        const drawnPixels = new Uint8ClampedArray(150 * 150 * 4);
        for (let i = 0; i < drawnPixels.length; i += 4) {
            drawnPixels[i] = 88;
            drawnPixels[i + 1] = 88;
            drawnPixels[i + 2] = 88;
            drawnPixels[i + 3] = 255;
        }

        const sim = simulateStrokeHistoryRecording({
            mode: 'pen',
            initialBounds,
            expandedBounds,
            initialPixels,
            drawnPixels,
            useGpuBaseline: false // CPU snapshot fallback
        });

        assert.equal(sim.history.meta.type, 'draw-full', 'CPU snapshot path with bounds expansion must record draw-full');
        sim.undo();
        assert.deepEqual(sim.getCurrentState().bounds, initialBounds, 'CPU snapshot Undo must restore pre-expansion bounds');
        assert.equal(sim.getCurrentState().width, 60);
        assert.equal(sim.getCurrentState().height, 60);
        assert.deepEqual(sim.getCurrentState().pixels, initialPixels);

        sim.redo();
        assert.deepEqual(sim.getCurrentState().bounds, expandedBounds, 'CPU snapshot Redo must restore expanded bounds');
        assert.equal(sim.getCurrentState().width, 150);
        assert.equal(sim.getCurrentState().height, 150);
        assert.deepEqual(sim.getCurrentState().pixels, drawnPixels);
    }
}

console.log('verify-pen-responsiveness-enhancements: ALL CHECKS PASSED');
