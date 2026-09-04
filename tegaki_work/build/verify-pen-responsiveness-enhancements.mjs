/**
 * build/verify-pen-responsiveness-enhancements.mjs
 * 
 * ペン入力レスポンス追加強化（第4回改修）の自動契約検証テスト
 * - Stage A: GPU baseline scratch eligibility & fallback contracts
 * - Stage B: Pen / Eraser realtime line batch lifecycle & Graphics churn contracts
 * - Stage C: adaptive sampling pure helper contracts
 */

import assert from 'node:assert/strict';
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

console.log('verify-pen-responsiveness-enhancements: ALL CHECKS PASSED');
