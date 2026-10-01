/**
 * ============================================================================
 * ファイル名: system/drawing/brush-core.js
 * 責務: ストローク（ペン・消しゴム・塗りつぶし）の開始・更新・完了とクリッピング中のプレビュー表示を統括する
 * 依存: event-bus.js, coordinate-system.js, stroke-recorder.js, stroke-renderer.js, layer-system.js, brush-settings.js, pixi.js
 * 被依存: core-engine.js, core-runtime.js等
 * 公開API: BrushCore, brushCore
 * イベント発火: drawing:stroke-started, drawing:stroke-completed, drawing:stroke-cancelled, layer:path-added, thumbnail:layer-updated
 * イベント受信: brush:mode-changed
 * グローバル登録: window.BrushCore
 * 実装状態: ✅完成/整備
 *
 * Phase 5p共通契約:
 * - 通常Layer / CAF working Layerとも、stroke前に `current bounds ∪ Project frame` へRTを拡張する。
 * - 通常History用beforeとselection制限用beforeは分離する。CAFは通常Historyを記録しないが、selection制限は同じbeforeで必ず行う。
 * - selection制限は PixelSelectionSystem.constrainLayer() がProject座標でbefore/after bounds差を吸収する。
 * ============================================================================
 */

import { Graphics, Container, Sprite, RenderTexture, Rectangle, Texture } from 'pixi.js';
import { rasterBoundsEqual } from '../raster-bounds.js';
import {
    calculateStrokeDirtyRect,
    projectRectToRasterLocal,
    cropPixelPatch,
    applyPixelPatch,
    unpremultiplyPixels,
    estimatePatchHistoryBytes
} from './raster-patch-history.js';
import { TegakiEventBus } from '../event-bus.js';
import { coordinateSystem } from '../../coordinate-system.js';
import { historyManager } from '../history.js';
import { isInverseClipping } from '../clipping-mode.js';
import {
    estimateRasterHistoryPairBytes,
    summarizePathCollectionMemory
} from '../raster-snapshot-memory.js';
import { generateAdaptiveInterpolationPoints } from './realtime-stroke-sampling.js';
import { CurveInterpolator } from './curve-interpolator.js';
import { AirbrushDabRenderer } from './airbrush-dab-renderer.js';

const AIRBRUSH_BUILDUP_POLL_MS = 8;

function unionRect(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    return {
        x,
        y,
        width: Math.max(a.x + a.width, b.x + b.width) - x,
        height: Math.max(a.y + a.height, b.y + b.height) - y
    };
}
// 入り抜き端の最小径倍率(0だと線端が消えて見えるため少し残す)。
const PEN_TAPER_MIN_SCALE = 0.08;
// ヒゲ判定: 線端の短い区間が、その手前の進行方向からこの角度以上折れていればヒゲとみなす。
const PEN_HOOK_MIN_ANGLE_DEG = 70;

/** 点列を先頭からの累積距離で引けるようにする。 */
function cumulativeLengths(points) {
    const lengths = [0];
    for (let i = 1; i < points.length; i++) {
        lengths[i] = lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    return lengths;
}

function angleBetweenDeg(ax, ay, bx, by) {
    const la = Math.hypot(ax, ay);
    const lb = Math.hypot(bx, by);
    if (!(la > 1e-6) || !(lb > 1e-6)) return 0;
    const cos = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)));
    return (Math.acos(cos) * 180) / Math.PI;
}

/**
 * 線端のヒゲ除去。終端(または始端)からhookLength以内の短い区間が、その手前2×hookLengthの
 * 進行方向から PEN_HOOK_MIN_ANGLE_DEG 以上折れていれば、その区間を切り落とす。
 * 線全体がヒゲ判定に必要な長さ(4×hookLength)に満たない短い線は変更しない。
 * @returns {{points: Array, trimmed: boolean, trimmedStart: number, trimmedEnd: number}}
 */
export function trimStrokeHooks(points, hookLength) {
    const result = { points, trimmed: false, trimmedStart: 0, trimmedEnd: 0 };
    if (!Array.isArray(points) || points.length < 4 || !(hookLength > 0)) return result;
    const lengths = cumulativeLengths(points);
    const total = lengths[lengths.length - 1];
    if (total < hookLength * 4) return result;

    const indexAtLength = (target) => {
        let i = 0;
        while (i < lengths.length - 1 && lengths[i] < target) i++;
        return i;
    };

    // 終端: tail = [tailStart .. last], 参照方向 = [refStart .. tailStart]
    let endIndex = points.length - 1;
    const tailStart = indexAtLength(total - hookLength);
    const refStartEnd = indexAtLength(total - hookLength * 3);
    if (tailStart > refStartEnd && tailStart < endIndex) {
        const ref = points[tailStart];
        const angle = angleBetweenDeg(
            ref.x - points[refStartEnd].x, ref.y - points[refStartEnd].y,
            points[endIndex].x - ref.x, points[endIndex].y - ref.y
        );
        if (angle >= PEN_HOOK_MIN_ANGLE_DEG) {
            result.trimmedEnd = lengths[endIndex] - lengths[tailStart];
            endIndex = tailStart;
        }
    }

    // 始端: head = [0 .. headEnd], 参照方向 = [headEnd .. refEnd]
    let startIndex = 0;
    const headEnd = indexAtLength(hookLength);
    const refEndStart = indexAtLength(hookLength * 3);
    if (headEnd > 0 && refEndStart > headEnd && refEndStart <= endIndex) {
        const ref = points[headEnd];
        const angle = angleBetweenDeg(
            ref.x - points[0].x, ref.y - points[0].y,
            points[refEndStart].x - ref.x, points[refEndStart].y - ref.y
        );
        if (angle >= PEN_HOOK_MIN_ANGLE_DEG) {
            result.trimmedStart = lengths[headEnd];
            startIndex = headEnd;
        }
    }

    if (startIndex > 0 || endIndex < points.length - 1) {
        result.points = points.slice(startIndex, endIndex + 1);
        result.trimmed = true;
    }
    return result;
}
// 筆圧安定化(One-Euro)の微分cutoff(Hz)と、変化速度に応じたcutoff上昇量(Hz per pressure/s)。
const PEN_PRESSURE_FILTER_DERIVATIVE_CUTOFF = 1.0;
const PEN_PRESSURE_FILTER_BETA = 6.0;

export class BrushCore {
    constructor() {
        this.isDrawing = false;
        this.currentStrokeId = null;
        this.lastLocalX = 0;
        this.lastLocalY = 0;
        this.lastClientX = null;
        this.lastClientY = null;
        this.lastPressure = 0;
        this.lastRenderedLocalX = 0;
        this.lastRenderedLocalY = 0;
        this.lastRenderedPressure = 0;
        
        this.coordinateSystem = null;
        this.pressureHandler = null;
        this.strokeRecorder = null;
        this.layerManager = null;
        this.strokeRenderer = null;
        this.eventBus = null;
        this.brushSettings = null;
        this.fillTool = null;
        
        this.previewGraphics = null;
        this.eventListenersSetup = false;
        this.realtimeEraserApplied = false; // [指示書] リアルタイム消去済みフラグ
        this.realtimePenApplied = false;    // [指示書] リアルタイム描画済みフラグ
        this.realtimeAirbrushApplied = false;
        this.realtimeBlurApplied = false;
        this.airbrushState = null;
        this.blurState = null;
        this.penOpacityState = null;
        this.strokeHistoryBefore = null;
        this.strokeSelectionBefore = null;
        this.strokeInputProfile = null;
        this.strokeTargetLayer = null;
        this.strokeInputProfiler = this._ensureStrokeInputProfiler();
        this.liveRenderFrameRequest = null;
        this.realtimeBatchQueue = null;
        this.realtimeBatchDepth = 0;
        this.realtimeBatchMode = null;
        this.realtimePenBatchGraphics = null;
        this.historyBaselineScratchTexture = null;
        this.strokeHistoryGpuBaseline = null;
    }
    
    init() {
        if (this.coordinateSystem) {
            console.warn('[BrushCore] Already initialized');
            return;
        }
        
        this.coordinateSystem = coordinateSystem;
        this.pressureHandler = window.pressureHandler;
        this.strokeRecorder = window.strokeRecorder;
        this.layerManager = window.layerManager;
        this.strokeRenderer = window.strokeRenderer;
        this.eventBus = window.eventBus || TegakiEventBus;
        this.brushSettings = window.brushSettings;
        this.fillTool = window.FillTool;
        
        if (!this.coordinateSystem) {
            throw new Error('[BrushCore] CoordinateSystem not initialized');
        }
        if (!this.layerManager) {
            throw new Error('[BrushCore] layerManager not initialized');
        }
        if (!this.strokeRecorder) {
            throw new Error('[BrushCore] strokeRecorder not initialized');
        }
        if (!this.strokeRenderer) {
            throw new Error('[BrushCore] strokeRenderer not initialized');
        }
        
        this._setupEventListeners();
    }
    
    _setupEventListeners() {
        if (this.eventListenersSetup || !this.eventBus) {
            return;
        }
        
        this.eventBus.on('brush:mode-changed', (data = {}) => {
            const mode = data.mode || data.data?.mode;
            if (mode) {
                if (!['fill', 'eraser-fill', 'lasso-fill', 'eyedropper'].includes(mode) && this.strokeRenderer && this.strokeRenderer.setTool) {
                    this.strokeRenderer.setTool(mode);
                }
            }
        });
        
        this.eventListenersSetup = true;
    }
    
    _getCurrentSettings() {
        if (!this.brushSettings) {
            return {
                size: 3,
                opacity: 1.0,
                color: 0x800000,
                mode: 'pen',
                airbrushSpacingRatio: 0.1,
                airbrushFlow: 0.08,
                airbrushSoftness: 0.8,
                airbrushScatter: 0.0,
                blurStrength: 4
            };
        }
        
        return this.brushSettings.getSettings();
    }
    
    setMode(mode) {
        const validModes = ['pen', 'eraser', 'fill', 'eraser-fill', 'airbrush', 'airbrush-erase', 'blur', 'lasso-fill', 'eyedropper'];

        if (!validModes.includes(mode)) {
            console.error(`[BrushCore] Invalid brush mode: ${mode}`);
            return;
        }

        if (this.brushSettings) {
            this.brushSettings.setMode(mode);
        } else {
            console.warn('[BrushCore] BrushSettings not available, cannot set mode');
        }

        if (mode !== 'fill' && mode !== 'eraser-fill' && mode !== 'lasso-fill' && mode !== 'eyedropper' && this.strokeRenderer && this.strokeRenderer.setTool) {
            this.strokeRenderer.setTool(mode);
        }
    }

    getMode() {
        if (this.brushSettings) {
            return this.brushSettings.getMode();
        }
        return 'pen';
    }

    startStroke(clientX, clientY, pressure, pointerType = 'unknown', inputProfile = null) {
        const currentMode = this.getMode();

        if (currentMode === 'fill' || currentMode === 'eraser-fill' || currentMode === 'eyedropper') {
            return;
        }

        // 安全のため、既存のプレビューがあれば破棄
        if (this.previewGraphics) {
            if (this.previewGraphics.parent) {
                this.previewGraphics.parent.removeChild(this.previewGraphics);
            }
            this.previewGraphics.destroy();
            this.previewGraphics = null;
        }

        if (this.isDrawing) return;

        const activeLayer = this.layerManager.getActiveLayer();
        if (!activeLayer || activeLayer.locked) return;
        this.strokeTargetLayer = activeLayer;
        const settings = this._getCurrentSettings();

        const needsHistorySnapshot = activeLayer.layerData?.isAnimationWorkingLayer !== true;
        const needsSelectionSnapshot = this._needsSelectionSnapshotForLayer(activeLayer);
        let beforeSnapshot = null;
        let beforeSnapshotMs = null;
        let ensureRasterFrameMs = null;
        let airbrushBeginMs = null;
        let gpuBaselineActive = false;

        // Stage A: GPU baseline eligibility check (Pen / Eraser かつ selection なし)
        // 重要: _ensureLayerRasterFrameForStroke() より前に取得し、bounds拡張前の状態（元rasterBounds, width, height）を記録する
        const isEligibleGpuBaseline = this._isEligibleForGpuBaseline(currentMode, activeLayer, settings);

        if (needsHistorySnapshot && !needsSelectionSnapshot && isEligibleGpuBaseline) {
            const gpuStart = this._perfNow();
            gpuBaselineActive = this._captureGpuBaseline(activeLayer);
            if (gpuBaselineActive) {
                const preBounds = this._getLayerRasterBounds(activeLayer);
                const preWidth = activeLayer.layerData?.renderTexture?.width || preBounds.width;
                const preHeight = activeLayer.layerData?.renderTexture?.height || preBounds.height;
                this.strokeHistoryGpuBaseline = {
                    layerId: activeLayer.layerData?.id || activeLayer.id,
                    bounds: { ...preBounds },
                    width: preWidth,
                    height: preHeight
                };
            }
            beforeSnapshotMs = this._perfNow() - gpuStart;
            this._warnPerf('brush.startStroke.gpuBaseline', gpuStart, {
                mode: currentMode,
                gpuBaselineActive
            });
        }

        // GPU baseline取得失敗、Selectionあり等でCPU snapshotが必要な場合も、
        // CPU before snapshotは _ensureLayerRasterFrameForStroke() より前に取得する
        if (!gpuBaselineActive && (needsHistorySnapshot || needsSelectionSnapshot)) {
            const snapshotStart = this._perfNow();
            beforeSnapshot = this.layerManager.createLayerRasterSnapshot?.(activeLayer, { includePathCollections: false }) || null;
            beforeSnapshotMs = this._perfNow() - snapshotStart;
            this.strokeHistoryGpuBaseline = null;
            this._warnPerf('brush.startStroke.beforeSnapshot', snapshotStart, {
                needsHistorySnapshot,
                needsSelectionSnapshot
            });
        }
        this.strokeHistoryBefore = needsHistorySnapshot ? beforeSnapshot : null;
        this.strokeSelectionBefore = beforeSnapshot;

        // 重要: before状態（GPU baseline または CPU snapshot）保存後に bounds ensure を実行する
        const ensureRasterStart = window.TEGAKI_CONFIG?.debug ? this._perfNow() : null;
        const boundsResult = this._ensureLayerRasterFrameForStroke(activeLayer, settings, currentMode);
        if (Number.isFinite(ensureRasterStart)) {
            ensureRasterFrameMs = this._perfNow() - ensureRasterStart;
            this._warnPerf('brush.startStroke.ensureRasterFrame', ensureRasterStart, {
                mode: currentMode
            });
        }
        const { canvasX, canvasY } = this.coordinateSystem.screenClientToCanvas(clientX, clientY);
        const { worldX, worldY } = this.coordinateSystem.canvasToWorld(canvasX, canvasY);
        const { localX, localY } = this.coordinateSystem.worldToLocal(worldX, worldY, activeLayer);

        const usePenDab = this._isPenDabEnabled(currentMode);
        if (currentMode === 'airbrush' || currentMode === 'airbrush-erase' || usePenDab) {
            const airbrushBeginStart = window.TEGAKI_CONFIG?.debug ? this._perfNow() : null;
            this._beginAirbrushStroke(activeLayer, settings);
            if (Number.isFinite(airbrushBeginStart)) {
                airbrushBeginMs = this._perfNow() - airbrushBeginStart;
                this._warnPerf('brush.startStroke.airbrushMask', airbrushBeginStart, {
                    mode: currentMode
                });
            }
        } else {
            this._cleanupAirbrushStroke();
        }

        if (!usePenDab && this._shouldUsePenOpacityIsolation(currentMode, settings)) {
            this._beginPenOpacityStroke(activeLayer, settings);
        } else {
            this._cleanupPenOpacityStroke();
        }

        if (currentMode === 'blur') {
            this._beginBlurStroke(activeLayer, settings);
        } else {
            this._cleanupBlurStroke();
        }

        const pressureEnabled = this._isPressureEnabledForMode(currentMode, settings, pointerType);
        if (this.airbrushState) {
            this.airbrushState.pressureEnabled = pressureEnabled;
        }
        // PointerEvent の down 圧は液タブによってスパイクすることがある。
        // 開始点だけは極小に固定し、2点目以降は updateStroke() の実筆圧へ立ち上げる。
        const processedPressure = pressureEnabled ? 0.0 : 1.0;

        if (pressureEnabled && this.pressureHandler) {
            this.pressureHandler.startStroke();
        }

        this.strokeRecorder.startStroke(localX, localY, processedPressure);
        this.strokeInputProfile = window.TEGAKI_CONFIG?.debug
            ? {
                id: `stroke_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                mode: currentMode,
                pointerType,
                size: settings.size,
                opacity: settings.opacity,
                pressureEnabled,
                penOpacityIsolation: this.penOpacityState !== null,
                target: {
                    layerId: activeLayer.layerData?.id ?? null,
                    layerName: activeLayer.layerData?.name ?? null,
                    isAnimationWorkingLayer: activeLayer.layerData?.isAnimationWorkingLayer === true
                },
                startTime: Date.now(),
                timings: {
                    beforeSnapshotMs: Number.isFinite(beforeSnapshotMs)
                        ? Number(beforeSnapshotMs.toFixed(2))
                        : null,
                    ensureRasterFrameMs: Number.isFinite(ensureRasterFrameMs)
                        ? Number(ensureRasterFrameMs.toFixed(2))
                        : null,
                    airbrushBeginMs: Number.isFinite(airbrushBeginMs)
                        ? Number(airbrushBeginMs.toFixed(2))
                        : null
                },
                retainedAtStart: this._getLongDrawingDiagnosticSample(activeLayer),
                events: 0,
                interpolatedPoints: 0,
                realtimeSegments: 0,
                realtime: {
                    updateCalls: 0,
                    batchCalls: 0,
                    realtimePointCalls: 0,
                    penPointCalls: 0,
                    distanceSkips: 0,
                    zeroDistanceSkips: 0,
                    penRenderCalls: 0,
                    penBatchSegments: 0,
                    penBatchFlushes: 0,
                    lineBatchSegments: 0,
                    lineBatchFlushes: 0,
                    realtimeGraphicsCreated: 0,
                    rendererRenderCalls: 0,
                    penRenderMissingTarget: 0,
                    penRenderMissingGraphics: 0,
                    airbrushRenderCalls: 0,
                    airbrushDabs: 0,
                    airbrushMaxDabsPerRender: 0,
                    maxDistance: 0,
                    lastDistances: [],
                    finalPointerUpdates: 0,
                    liveRenderRequests: 0,
                    liveRenderCoalesced: 0,
                    liveRenderExecuted: 0,
                    liveRenderFailures: 0,
                    liveRenderMethod: null
                },
                startLocal: {
                    x: Number(localX.toFixed(3)),
                    y: Number(localY.toFixed(3))
                },
                rasterBoundsAtStart: this._getLayerRasterBounds(activeLayer)
            }
            : null;

        this.isDrawing = true;
        this.penVelocityState = { x: clientX, y: clientY, time: null, speed: 0 };
        this.penPressureFilter = null;
        this.penRenderTrace = [{ x: localX, y: localY, pressure: processedPressure }];
        this.currentTilt = null;
        this.realtimeBatchQueue = null;
        this.realtimeBatchDepth = 0;
        this.realtimeBatchMode = null;
        this.lastLocalX = localX;
        this.lastLocalY = localY;
        this.lastClientX = clientX;
        this.lastClientY = clientY;
        this.lastPressure = processedPressure;
        this.lastRenderedLocalX = localX;
        this.lastRenderedLocalY = localY;
        this.lastRenderedPressure = processedPressure;
        this.penTaperTravel = 0;
        this.lastRenderedTaperScale = this._getPenTaperScale(0, Infinity);
        this.curveControlPoints = this._isRealtimeCurveEnabled(currentMode)
            ? [{ x: localX, y: localY, pressure: processedPressure, clientX, clientY }]
            : null;

        const strokeStartedPayload = {
            component: 'drawing',
            action: 'stroke-started',
            data: {
                mode: currentMode,
                layerId: activeLayer.layerData?.id,
                localX,
                localY,
                pressure: processedPressure
            }
        };
        this.previewGraphics = new Graphics();
        this.previewGraphics.label = 'strokePreview';
        activeLayer.addChild(this.previewGraphics);
        if (activeLayer.layerData?.clipping) {
            const clippingMask = activeLayer.layerData.clippingMaskSprite;
            if (clippingMask) {
                this.previewGraphics.setMask({
                    mask: clippingMask,
                    inverse: isInverseClipping(activeLayer.layerData)
                });
            } else {
                this.previewGraphics.visible = false;
            }
        }

        this.strokeRenderer.renderPreview(
            [{ x: localX, y: localY, pressure: processedPressure }],
            settings,
            this.previewGraphics
        );

        if (currentMode === 'airbrush' || currentMode === 'airbrush-erase') {
            // pointerdown直後の筆圧0をdab化すると、線頭に孤立した点が残る。
            // airbrushは最初の移動segment、または筆圧なし入力のtap確定時に描画する。
        } else if (currentMode === 'blur') {
            this._renderRealtimeBlurSegment([{ x: localX, y: localY, pressure: processedPressure }]);
            this.realtimeBlurApplied = true;
        }

        if (this.eventBus) {
            this.eventBus.emit('drawing:stroke-started', strokeStartedPayload);
        }

        this._logInputProfile('down', inputProfile, {
            mode: currentMode,
            pointerType,
            processedPressure,
            recorder: this.strokeRecorder.getCurrentStats?.() || null,
            interpolation: {
                generatedPoints: 0,
                afterEventPointCount: this.strokeRecorder.getCurrentPoints().length
            },
            render: {
                previewCreated: !!this.previewGraphics,
                realtimeApplied: false,
                penOpacityIsolation: this.penOpacityState !== null,
                finalBakeExpected: currentMode !== 'pen' && currentMode !== 'eraser' && currentMode !== 'airbrush' && currentMode !== 'airbrush-erase' && currentMode !== 'blur'
            }
        });
    }

    updateStroke(clientX, clientY, pressure, pointerType = 'unknown', inputProfile = null) {
        if (!this.isDrawing) return;
        if (this.strokeInputProfile?.realtime) {
            this.strokeInputProfile.realtime.updateCalls++;
        }

        const perfStart = this._perfNow();
        const activeLayer = this.strokeTargetLayer || this.layerManager.getActiveLayer();
        if (!activeLayer) return;

        const { canvasX, canvasY } = this.coordinateSystem.screenClientToCanvas(clientX, clientY);
        const { worldX, worldY } = this.coordinateSystem.canvasToWorld(canvasX, canvasY);
        const { localX, localY } = this.coordinateSystem.worldToLocal(worldX, worldY, activeLayer);

        const settings = this._getCurrentSettings();
        const currentMode = this.getMode();

        const dx = localX - this.lastLocalX;
        const dy = localY - this.lastLocalY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // 描き始めの 0.0 と合わせるため、最小値を 0.1 -> 0.0 に変更。
        // これにより点描時の突然の肥大化を防ぐ。
        const pressureEnabled = this._isPressureEnabledForMode(currentMode, settings, pointerType);
        const stabilizedPressure = pressureEnabled
            ? this._stabilizeMovePressure(pressure, currentMode, pointerType)
            : 1.0;
        const sampleTime = Number.isFinite(this.currentSampleTime) ? this.currentSampleTime : this._perfNow();
        if (this.currentSampleTilt) {
            this.currentTilt = this._computeLocalTilt(clientX, clientY, localX, localY, this.currentSampleTilt, activeLayer);
        }
        const smoothedPressure = (pressureEnabled && (currentMode === 'pen' || currentMode === 'eraser'))
            ? this._filterStrokePressure(stabilizedPressure, sampleTime)
            : stabilizedPressure;
        const processedPressure = (currentMode === 'pen' && pressureEnabled)
            ? this._applyPenVelocityResponse(clientX, clientY, sampleTime, smoothedPressure)
            : smoothedPressure;

        const pointsBeforeEvent = this.strokeRecorder.getCurrentPoints().length;
        const currentControlPoint = {
            x: localX,
            y: localY,
            pressure: processedPressure,
            clientX,
            clientY,
            pressureEnabled
        };
        let steps = 0;
        let stepSize = 0;
        let generatedPoints = 0;

        const isBatchableMode = currentMode === 'pen' || currentMode === 'eraser';
        if (isBatchableMode) {
            this._beginRealtimeBatch(currentMode);
        }
        const ownsAirbrushBatch = this._beginAirbrushBatch();

        try {
            if (Array.isArray(this.curveControlPoints)) {
                // Catmull-Romは1sample先読みが必要なため、1つ前の区間をここで確定描画する。
                const controlPoints = this.curveControlPoints;
                controlPoints.push(currentControlPoint);
                if (controlPoints.length > 4) controlPoints.shift();
                const count = controlPoints.length;
                if (count >= 3) {
                    const result = this._emitStrokeChord(
                        currentMode,
                        controlPoints[count - 4] || controlPoints[count - 3],
                        controlPoints[count - 3],
                        controlPoints[count - 2],
                        controlPoints[count - 1],
                        pressureEnabled
                    );
                    ({ steps, stepSize, generatedPoints } = result);
                }
            } else {
                const lastControlPoint = {
                    x: this.lastLocalX,
                    y: this.lastLocalY,
                    pressure: this.lastPressure,
                    clientX: this.lastClientX,
                    clientY: this.lastClientY
                };
                const result = this._emitStrokeChord(
                    currentMode,
                    null,
                    lastControlPoint,
                    currentControlPoint,
                    null,
                    pressureEnabled
                );
                ({ steps, stepSize, generatedPoints } = result);
            }
        } finally {
            if (isBatchableMode) {
                this._flushRealtimeBatch();
            }
            if (ownsAirbrushBatch) {
                this._flushAirbrushBatch();
            }
        }
        this._updatePenLiveTip(currentMode, currentControlPoint);

        // [指示書] ライブ焼き込み中は previewGraphics を使用しない（二重描画防止）
        if (this.previewGraphics && currentMode !== 'eraser' && currentMode !== 'pen' && currentMode !== 'airbrush' && currentMode !== 'airbrush-erase' && currentMode !== 'blur') {
            const currentPoints = this.strokeRecorder.getCurrentPoints();
            const settings = this._getCurrentSettings();

            this.previewGraphics.clear();
            if (currentMode === 'lasso-fill') {
                this._renderLassoPreview(currentPoints, settings);
            } else {
                this.strokeRenderer.renderPreview(
                    currentPoints,
                    settings,
                    this.previewGraphics
                );
            }
        }

        this.lastLocalX = localX;
        this.lastLocalY = localY;
        this.lastClientX = clientX;
        this.lastClientY = clientY;
        this.lastPressure = processedPressure;

        if (this.strokeInputProfile) {
            this.strokeInputProfile.events++;
            this.strokeInputProfile.interpolatedPoints += Math.max(0, generatedPoints - 1);
        }
        this._warnPerf('brush.updateStroke', perfStart, {
            mode: currentMode,
            pointerType,
            distance: Number(distance.toFixed(3)),
            generatedPoints,
            pointCount: this.strokeRecorder.getCurrentPoints().length
        });

        this._logInputProfile('move', inputProfile, {
            mode: currentMode,
            pointerType,
            processedPressure,
            recorder: this.strokeRecorder.getCurrentStats?.() || null,
            interpolation: {
                distance: Number(distance.toFixed(3)),
                step: stepSize,
                loopSteps: steps,
                generatedPoints,
                pointCountBefore: pointsBeforeEvent,
                afterEventPointCount: this.strokeRecorder.getCurrentPoints().length
            },
            render: {
                realtimeApplied: this._hasRealtimeApplied(currentMode),
                realtimeMode: currentMode,
                penOpacityIsolation: this.penOpacityState !== null,
                previewActive: !!this.previewGraphics
            }
        });
    }

    /**
     * 無移動tap / 極短strokeはrealtime区間が描かれないため、pen dab時もここでdab engineへ流す。
     * 旧Graphics final bakeと同じく、径はcalculateWidth、濃さはpressure opacity。
     */
    _renderPenDabTapIfNeeded(mode, strokeData) {
        if (this.airbrushState?.dabMode !== 'pen') return;
        if (mode === 'pen' ? this.realtimePenApplied : (mode !== 'eraser' || this.realtimeEraserApplied)) return;
        const points = strokeData?.points || [];
        if (points.length === 0) return;
        if (strokeData.isSingleDot === true || points.length === 1) {
            this._renderRealtimeAirbrushSegment([points[0]]);
        } else {
            for (let i = 1; i < points.length; i++) {
                this._renderRealtimeAirbrushSegment([points[i - 1], points[i]]);
            }
        }
        if (mode === 'pen') {
            this.realtimePenApplied = true;
        } else {
            this.realtimeEraserApplied = true;
        }
    }

    /**
     * PointerEventのtiltX/tiltY(度)を、Layerローカル空間での傾き方向(angle)と傾き量(0=垂直, 1=水平)へ変換する。
     * canvas回転・反転を反映するため、画面上の方向ベクトルをLayer座標へ写して角度を求める。
     */
    _computeLocalTilt(clientX, clientY, localX, localY, sampleTilt, layer) {
        const tx = Math.tan((Math.max(-89, Math.min(89, sampleTilt.tiltX)) * Math.PI) / 180);
        const ty = Math.tan((Math.max(-89, Math.min(89, sampleTilt.tiltY)) * Math.PI) / 180);
        const horizontal = Math.hypot(tx, ty);
        if (!(horizontal > 1e-3) || !Number.isFinite(clientX) || !Number.isFinite(clientY)) {
            return { angle: 0, magnitude: 0 };
        }
        const altitude = Math.atan(1 / horizontal);
        const magnitude = Math.max(0, Math.min(1, 1 - altitude / (Math.PI / 2)));
        // ペン上端が倒れている向きの反対(ペン先が向く側)を噴射方向とする。
        const probe = 16;
        const px = clientX - (tx / horizontal) * probe;
        const py = clientY - (ty / horizontal) * probe;
        const { canvasX, canvasY } = this.coordinateSystem.screenClientToCanvas(px, py);
        const { worldX, worldY } = this.coordinateSystem.canvasToWorld(canvasX, canvasY);
        const local = this.coordinateSystem.worldToLocal(worldX, worldY, layer);
        const angle = Math.atan2(local.localY - localY, local.localX - localX);
        return { angle: Number.isFinite(angle) ? angle : 0, magnitude };
    }

    /** 現在の傾きをdab描画用に返す。強さ0や傾き情報なしではnull。 */
    _getDabTilt(settingKey, fallbackStrength) {
        const userStrength = window.TegakiSettingsManager?.get?.(settingKey);
        const strength = Math.max(0, Math.min(1, Number(userStrength ?? fallbackStrength ?? 0)));
        const tilt = this.currentTilt;
        if (!(strength > 0) || !tilt || !(tilt.magnitude > 0)) return null;
        return { angle: tilt.angle, amount: strength * tilt.magnitude };
    }

    /**
     * 筆圧の安定化(One-Euro filter)。液タブ筆圧の細かな揺れで線幅が波打つのを抑えつつ、
     * 筆圧の速い変化(入り・抜き・強弱)は遅らせない。penPressureSmoothing 0でOFF、1で最も安定。
     * 時間は各sampleの入力時刻(ms)。同時刻sampleは前回値を返す。
     */
    _filterStrokePressure(pressure, sampleTime) {
        const engine = window.TEGAKI_CONFIG?.brushEngine || {};
        const userStrength = window.TegakiSettingsManager?.get?.('penPressureSmoothing');
        const strength = Math.max(0, Math.min(1, Number(userStrength ?? engine.penPressureSmoothing ?? 0)));
        if (!(strength > 0) || !Number.isFinite(pressure) || !Number.isFinite(sampleTime)) return pressure;

        const state = this.penPressureFilter;
        if (!state) {
            this.penPressureFilter = { value: pressure, derivative: 0, time: sampleTime };
            return pressure;
        }
        const dt = (sampleTime - state.time) / 1000;
        if (!(dt > 0)) return state.value;

        const smoothingFactor = (cutoff) => {
            const tau = 1 / (2 * Math.PI * cutoff);
            return 1 / (1 + tau / dt);
        };
        const rawDerivative = (pressure - state.value) / dt;
        state.derivative += smoothingFactor(PEN_PRESSURE_FILTER_DERIVATIVE_CUTOFF) * (rawDerivative - state.derivative);
        // 強さ0→ほぼ素通し(30Hz)、1→強い平滑(1.5Hz)。速い変化ほどcutoffを上げて遅れを消す。
        const minCutoff = 30 * Math.pow(1.5 / 30, strength);
        const cutoff = minCutoff + PEN_PRESSURE_FILTER_BETA * Math.abs(state.derivative);
        state.value += smoothingFactor(cutoff) * (pressure - state.value);
        state.time = sampleTime;
        return Math.max(0, Math.min(1, state.value));
    }

    /**
     * 速く引いた線ほど細く・薄くする。画面px/msの平滑化速度で実効筆圧を最大penVelocityThinning割まで下げる。
     * 画面座標で測るため表示倍率に依存しない。
     */
    _applyPenVelocityResponse(clientX, clientY, sampleTime, pressure) {
        const engine = window.TEGAKI_CONFIG?.brushEngine || {};
        const userStrength = window.TegakiSettingsManager?.get?.('penVelocityThinning');
        const strength = Math.max(0, Math.min(0.9, Number(userStrength ?? engine.penVelocityThinning ?? 0)));
        const state = this.penVelocityState;
        if (!(strength > 0) || !state || !Number.isFinite(clientX) || !Number.isFinite(clientY)) {
            return pressure;
        }

        if (Number.isFinite(state.time) && Number.isFinite(sampleTime)) {
            const dt = sampleTime - state.time;
            if (dt > 0.5) {
                const instant = Math.hypot(clientX - state.x, clientY - state.y) / dt;
                // 1sampleの揺れで太さが跳ねないよう指数平滑する。
                state.speed += (Math.min(instant, 20) - state.speed) * 0.35;
                state.x = clientX;
                state.y = clientY;
                state.time = sampleTime;
            }
        } else {
            state.x = clientX;
            state.y = clientY;
            state.time = sampleTime;
        }

        const slow = Number(engine.penVelocitySlow ?? 0.6);
        const fast = Math.max(slow + 0.1, Number(engine.penVelocityFast ?? 4.0));
        const t = Math.max(0, Math.min(1, (state.speed - slow) / (fast - slow)));
        const eased = t * t * (3 - 2 * t);
        return pressure * (1 - strength * eased);
    }

    /**
     * Airbrush: ペンを止めていても時間経過でdabを吹き重ねる(クリスタ式の溜まり)。
     * 最後にdabを置いてからairbrushBuildupRateの間隔が空いたら現在位置へ1dab置く。
     */
    _startAirbrushBuildup() {
        const engine = window.TEGAKI_CONFIG?.brushEngine || {};
        const state = this.airbrushState;
        if (!state || state.dabMode !== 'airbrush' || engine.airbrushBuildup === false) return;
        if (typeof setTimeout !== 'function') return;

        // 表示frameに依存せず一定間隔で判定する(rAFは非表示時に止まるため使わない)。
        state.lastDabTime = this._perfNow();
        const tick = () => {
            const current = this.airbrushState;
            if (current !== state) return;
            state.buildupTimer = setTimeout(tick, AIRBRUSH_BUILDUP_POLL_MS);
            if (!this.isDrawing) return;

            const userRate = window.TegakiSettingsManager?.get?.('airbrushBuildupRate');
            const rate = Math.min(120, Number(userRate ?? window.TEGAKI_CONFIG?.brushEngine?.airbrushBuildupRate ?? 20));
            // 設定0はOFF。
            if (!(rate > 0)) return;
            const now = this._perfNow();
            if (now - state.lastDabTime < 1000 / rate) return;
            if (!Number.isFinite(this.lastLocalX) || !Number.isFinite(this.lastLocalY)) return;

            this._renderRealtimeAirbrushSegment([{
                x: this.lastLocalX,
                y: this.lastLocalY,
                pressure: this.lastPressure
            }]);
            // 筆圧0等でdabが置かれなくても、次の判定まで間隔を空ける。
            state.lastDabTime = now;
            this.realtimeAirbrushApplied = true;
        };
        state.buildupTimer = setTimeout(tick, AIRBRUSH_BUILDUP_POLL_MS);
    }

    /**
     * ライブ先端: 曲線補間は1sample先読みのため、確定描画は最新入力の1つ手前で止まる。
     * その間(最後に描いた点→現在の入力点)を、stroke maskの複製(tip composite)へ同じmax合成で描き、
     * previewはその複製を表示する。確定mask自体には描かないので、pen-up後の線は従来と同一。
     * 複製の更新は先端の前回範囲∪今回範囲だけ(maskからの部分コピー + 先端dab)。
     */
    _updatePenLiveTip(mode, currentControlPoint) {
        const state = this.airbrushState;
        const enabled = window.TEGAKI_CONFIG?.brushEngine?.penLiveTip !== false;
        if (!enabled || mode !== 'pen' || state?.dabMode !== 'pen' || !state.maskTexture || !state.previewSprite
            || !currentControlPoint || !Array.isArray(this.curveControlPoints)) {
            this._clearPenLiveTip();
            return;
        }
        const renderer = this.layerManager.app?.renderer;
        if (!renderer) return;

        const from = {
            x: this.lastRenderedLocalX,
            y: this.lastRenderedLocalY,
            pressure: this.lastRenderedPressure,
            widthScale: this.lastRenderedTaperScale ?? 1
        };
        const gap = Math.hypot(currentControlPoint.x - from.x, currentControlPoint.y - from.y);
        const to = {
            x: currentControlPoint.x,
            y: currentControlPoint.y,
            pressure: currentControlPoint.pressure,
            widthScale: this._getPenTaperScale((this.penTaperTravel || 0) + gap, Infinity)
        };

        if (!this.penLiveTipRenderer) {
            this.penLiveTipRenderer = new AirbrushDabRenderer({
                calculateWidth: (pressure, size) => this.strokeRenderer.calculateWidth(pressure, size),
                calculateOpacity: (pressure, opacity, settings) => this.strokeRenderer.calculateOpacity(pressure, opacity, settings)
            });
        }
        const container = gap > 0.5
            ? this.penLiveTipRenderer.renderSegment([from, to], this._buildDabMaskSettings(), {})
            : null;
        let tipRect = null;
        if (container) {
            this._applyLayerRasterRenderOffset(state.targetLayer, container);
            tipRect = this._getDabContainerMaskRect(container);
        }

        if (!state.tipComposite) {
            if (!container) return;
            state.tipComposite = RenderTexture.create({
                width: state.maskTexture.width,
                height: state.maskTexture.height,
                resolution: 1,
                format: state.maskTexture.source.format
            });
            this._copyMaskRegionToTipComposite({ x: 0, y: 0, width: state.maskTexture.width, height: state.maskTexture.height });
            state.previewSprite.texture = state.tipComposite;
        }

        // 前回の先端を消す(maskの内容で上書き)してから今回の先端を重ねる。
        const region = unionRect(state.tipRect, tipRect);
        if (region) this._copyMaskRegionToTipComposite(region);
        if (container) {
            renderer.render({ container, target: state.tipComposite, clear: false });
            this.penLiveTipRenderer.releaseSegment(container);
        }
        state.tipRect = tipRect;
        this._requestLiveCanvasRender('pen-live-tip');
    }

    /** stroke maskの矩形をtip compositeへそのまま写す('none'合成)。 */
    _copyMaskRegionToTipComposite(rect) {
        const state = this.airbrushState;
        const renderer = this.layerManager.app?.renderer;
        if (!state?.tipComposite || !renderer || !rect) return;
        const x = Math.max(0, Math.floor(rect.x));
        const y = Math.max(0, Math.floor(rect.y));
        const right = Math.min(state.maskTexture.width, Math.ceil(rect.x + rect.width));
        const bottom = Math.min(state.maskTexture.height, Math.ceil(rect.y + rect.height));
        if (right <= x || bottom <= y) return;
        const frame = new Rectangle(x, y, right - x, bottom - y);
        const part = new Texture({ source: state.maskTexture.source, frame });
        const sprite = new Sprite(part);
        sprite.position.set(x, y);
        sprite.blendMode = 'none';
        const container = new Container();
        container.addChild(sprite);
        renderer.render({ container, target: state.tipComposite, clear: false });
        container.destroy({ children: true });
        part.destroy(false);
    }

    _clearPenLiveTip() {
        const state = this.airbrushState;
        if (!state?.tipComposite) return;
        if (state.previewSprite && !state.previewSprite.destroyed) {
            state.previewSprite.texture = state.maskTexture;
        }
        state.tipComposite.destroy(true);
        state.tipComposite = null;
        state.tipRect = null;
    }

    /**
     * ヒゲ判定に使う線端の長さ(Layer px)。ペンの揺れは画面上の大きさで起きるため、
     * 画面上penHookTrimScreenPx相当を現在の表示倍率でLayer pxへ換算する。0でヒゲ除去OFF。
     */
    _getHookTrimLength() {
        const engine = window.TEGAKI_CONFIG?.brushEngine || {};
        const screenPx = Math.max(0, Number(engine.penHookTrimScreenPx ?? 10));
        if (!(screenPx > 0) || !this.coordinateSystem || !this.strokeTargetLayer) return 0;
        try {
            const toLocal = (x, y) => {
                const { canvasX, canvasY } = this.coordinateSystem.screenClientToCanvas(x, y);
                const { worldX, worldY } = this.coordinateSystem.canvasToWorld(canvasX, canvasY);
                return this.coordinateSystem.worldToLocal(worldX, worldY, this.strokeTargetLayer);
            };
            const a = toLocal(0, 0);
            const b = toLocal(100, 0);
            const localPerScreen = Math.hypot(b.localX - a.localX, b.localY - a.localY) / 100;
            return Number.isFinite(localPerScreen) && localPerScreen > 0 ? screenPx * localPerScreen : screenPx;
        } catch (_error) {
            return screenPx;
        }
    }

    _getPenTaperLengths() {
        const engine = window.TEGAKI_CONFIG?.brushEngine || {};
        const get = (key, fallback) => {
            const value = Number(window.TegakiSettingsManager?.get?.(key) ?? engine[key] ?? fallback);
            return Number.isFinite(value) ? Math.max(0, value) : 0;
        };
        return { taperIn: get('penTaperIn', 0), taperOut: get('penTaperOut', 0) };
    }

    /**
     * 入り抜きの径倍率。travel=描き始めからの距離、remaining=終点までの距離(不明ならInfinity)。
     * 端で最小PEN_TAPER_MIN_SCALE、各taper長さでsmoothstepに1へ戻る。
     */
    _getPenTaperScale(travel, remaining) {
        const { taperIn, taperOut } = this._getPenTaperLengths();
        const ramp = (distance, length) => {
            if (!(length > 0)) return 1;
            const t = Math.max(0, Math.min(1, distance / length));
            return t * t * (3 - 2 * t);
        };
        const factor = Math.min(ramp(travel, taperIn), ramp(remaining, taperOut));
        return PEN_TAPER_MIN_SCALE + (1 - PEN_TAPER_MIN_SCALE) * factor;
    }

    /**
     * 抜き(taper-out)は終点が分かるpen-up時にしか決まらないため、記録点列から入り抜き込みで
     * stroke maskを描き直す(クリスタ式)。入りもここで同じ距離計算に揃える。点・単発tapは対象外。
     */
    _applyPenTaperToMask(strokeData) {
        const state = this.airbrushState;
        // recorderの点は筆圧の較正・平滑化が別にかかるため、realtimeで実際に描いた点列で描き直す。
        const trace = Array.isArray(this.penRenderTrace) ? this.penRenderTrace : [];
        const sourcePoints = trace.length >= 2 ? trace : (strokeData?.points || []);
        // 線端のヒゲ(ペンを置く/離す瞬間の急な折れ返し)を除いた点列で描き直す。
        const hookTrim = strokeData?.isSingleDot === true
            ? { points: sourcePoints, trimmed: false }
            : trimStrokeHooks(sourcePoints, this._getHookTrimLength());
        const points = hookTrim.points;
        const { taperIn, taperOut } = this._getPenTaperLengths();
        if (this.strokeInputProfile) {
            this.strokeInputProfile.hookTrim = { start: hookTrim.trimmedStart || 0, end: hookTrim.trimmedEnd || 0 };
        }
        if (!state?.maskTexture || state.dabMode !== 'pen' || !(taperIn > 0 || taperOut > 0 || hookTrim.trimmed)) return false;
        if (strokeData?.isSingleDot === true || points.length < 2) return false;
        const renderer = this.layerManager.app?.renderer;
        if (!renderer) return false;

        const travel = [0];
        for (let i = 1; i < points.length; i++) {
            travel[i] = travel[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
        }
        const total = travel[travel.length - 1];
        const tapered = points.map((point, i) => ({
            x: point.x,
            y: point.y,
            pressure: point.pressure,
            widthScale: this._getPenTaperScale(travel[i], total - travel[i])
        }));

        const empty = new Container();
        renderer.render({ container: empty, target: state.maskTexture, clear: true, clearColor: [0, 0, 0, 0] });
        empty.destroy();

        state.spacingState = {};
        const ownsBatch = this._beginAirbrushBatch();
        try {
            for (let i = 1; i < tapered.length; i++) {
                this._renderRealtimeAirbrushSegment([tapered[i - 1], tapered[i]]);
            }
        } finally {
            if (ownsBatch) this._flushAirbrushBatch();
        }
        return true;
    }

    _isPenDabEnabled(mode) {
        const engine = window.TEGAKI_CONFIG?.brushEngine;
        if (mode === 'pen') return engine?.penDabRendering === true;
        if (mode === 'eraser') return engine?.eraserDabRendering === true;
        return false;
    }

    _isEraseDabMode(mode) {
        return mode === 'airbrush-erase' || mode === 'eraser';
    }

    _isRealtimeCurveEnabled(mode) {
        if (window.TEGAKI_CONFIG?.brushEngine?.realtimeCurveInterpolation === false) return false;
        return mode === 'pen' || mode === 'eraser' || mode === 'airbrush' || mode === 'airbrush-erase';
    }

    /**
     * from→to区間をStage Cの適応step数で分割し、realtime描画とrecorderへ流す。
     * prev / nextがあればcentripetal Catmull-Romで位置を補間し、無ければ直線で補間する。
     * 終点toは必ず描画・記録する。
     */
    _emitStrokeChord(mode, prev, from, to, next, pressureEnabled) {
        const hasClient = point => Number.isFinite(point?.clientX) && Number.isFinite(point?.clientY);
        const { steps, stepSize, points } = generateAdaptiveInterpolationPoints({
            lastLocal: from,
            currentLocal: to,
            lastPressure: from.pressure,
            currentPressure: to.pressure,
            lastClient: hasClient(from) ? { x: from.clientX, y: from.clientY } : null,
            currentClient: hasClient(to) ? { x: to.clientX, y: to.clientY } : null,
            pressureEnabled,
            currentMode: mode,
            minStep: mode === 'lasso-fill' ? 5 : 1,
            maxStep: 16
        });
        const useCurve = !!(prev && next);

        for (let i = 0; i < points.length; i++) {
            const pt = points[i];
            const position = useCurve
                ? CurveInterpolator.centripetalPoint(prev, from, to, next, pt.t)
                : pt;
            this._renderRealtimeStrokePoint(mode, position.x, position.y, pt.pressure);
            this.strokeRecorder.addPoint(position.x, position.y, pt.pressure);
            this.penRenderTrace?.push({ x: position.x, y: position.y, pressure: pt.pressure });
        }

        this._renderRealtimeStrokePoint(mode, to.x, to.y, to.pressure);
        this.strokeRecorder.addPoint(to.x, to.y, to.pressure);
        this.penRenderTrace?.push({ x: to.x, y: to.y, pressure: to.pressure });
        return { steps, stepSize, generatedPoints: points.length + 1 };
    }

    /** 先読み待ちで未描画の最終Catmull-Rom区間を、終点を複製して確定する。 */
    _flushPendingCurveChord() {
        const controlPoints = this.curveControlPoints;
        this.curveControlPoints = null;
        if (!Array.isArray(controlPoints) || controlPoints.length < 2 || !this.isDrawing) return;

        const mode = this.getMode();
        const count = controlPoints.length;
        const from = controlPoints[count - 2];
        const to = controlPoints[count - 1];
        const prev = controlPoints[count - 3] || from;
        const pressureEnabled = to.pressureEnabled === true;
        const isBatchableMode = mode === 'pen' || mode === 'eraser';
        if (isBatchableMode) {
            this._beginRealtimeBatch(mode);
        }
        const ownsAirbrushBatch = this._beginAirbrushBatch();
        try {
            this._emitStrokeChord(mode, prev, from, to, to, pressureEnabled);
        } finally {
            if (isBatchableMode) {
                this._flushRealtimeBatch();
            }
            if (ownsAirbrushBatch) {
                this._flushAirbrushBatch();
            }
        }
    }

    /** Shift+drag直線のdisplay-only guide。Raster確定はpointerup時のupdateStrokeへ任せる。 */
    previewStraightStroke(clientX, clientY, pressure, pointerType = 'unknown') {
        if (!this.isDrawing || !this.previewGraphics || !this.strokeTargetLayer) return false;
        const mode = this.getMode();
        if (mode !== 'pen' && mode !== 'eraser') return false;

        const start = this.strokeRecorder.getCurrentPoints()[0];
        if (!start) return false;
        const { canvasX, canvasY } = this.coordinateSystem.screenClientToCanvas(clientX, clientY);
        const { worldX, worldY } = this.coordinateSystem.canvasToWorld(canvasX, canvasY);
        const { localX, localY } = this.coordinateSystem.worldToLocal(worldX, worldY, this.strokeTargetLayer);
        if (![localX, localY].every(Number.isFinite)) return false;

        const settings = this._getCurrentSettings();
        const pressureEnabled = this._isPressureEnabledForMode(mode, settings, pointerType);
        const guidePressure = pressureEnabled
            ? Math.max(0.08, Math.min(1, Number(pressure) || 0))
            : 1;
        const guideWidth = Math.max(1, this.strokeRenderer.calculateWidth(guidePressure, settings.size));
        this.previewGraphics.clear();
        this.previewGraphics.blendMode = 'normal';
        this.previewGraphics.moveTo(start.x, start.y);
        this.previewGraphics.lineTo(localX, localY);
        this.previewGraphics.stroke({
            width: guideWidth,
            color: settings.color,
            alpha: Math.max(0.28, Math.min(0.72, Number(settings.opacity) || 1)),
            cap: 'round',
            join: 'round'
        });
        return true;
    }

    updateStrokeBatch(infos, inputProfile = null) {
        if (!this.isDrawing || !Array.isArray(infos) || infos.length === 0) return;
        if (this.strokeInputProfile?.realtime) {
            this.strokeInputProfile.realtime.batchCalls++;
        }

        const perfStart = this._perfNow();
        const mode = this.getMode();
        const isBatchableMode = mode === 'pen' || mode === 'eraser';
        if (isBatchableMode) {
            this._beginRealtimeBatch(mode);
        }
        const ownsAirbrushBatch = this._beginAirbrushBatch();
        try {
            infos.forEach((info, index) => {
                if (!info) return;
                const isLast = index === infos.length - 1;
                // coalesced sampleは同じ処理時刻にまとまるため、速度計算には各sampleの入力時刻を使う。
                this.currentSampleTime = Number(info.timeStamp);
                this.currentSampleTilt = { tiltX: Number(info.tiltX) || 0, tiltY: Number(info.tiltY) || 0 };
                this.updateStroke(
                    info.clientX,
                    info.clientY,
                    info.pressure,
                    info.pointerType,
                    isLast ? (inputProfile || info.inputProfile) : null
                );
            });
        } finally {
            this.currentSampleTime = null;
            this.currentSampleTilt = null;
            if (isBatchableMode) {
                this._flushRealtimeBatch();
            }
            if (ownsAirbrushBatch) {
                this._flushAirbrushBatch();
            }
        }
        if (this.strokeInputProfile) {
            this.strokeInputProfile.coalescedBatches = (this.strokeInputProfile.coalescedBatches || 0) + 1;
        }
        this._warnPerf('brush.updateStrokeBatch', perfStart, {
            mode,
            samples: infos.length
        });
    }

    _stabilizeMovePressure(pressure, mode, pointerType = 'unknown') {
        const rawPressure = Number(pressure ?? 0.0);
        const clampedPressure = Math.max(0.0, Math.min(1.0, Number.isFinite(rawPressure) ? rawPressure : 0.0));
        const isPenStrokeMode = mode === 'pen' || mode === 'eraser';
        if (pointerType !== 'pen' || !isPenStrokeMode || clampedPressure > 0.001) {
            return clampedPressure;
        }

        const minStrokePressure = Math.max(
            0,
            Math.min(1, Number(window.TEGAKI_CONFIG?.pen?.pressure?.minStrokePressure ?? 0.08))
        );
        const stabilizedPressure = Math.max(minStrokePressure, Math.min(1, Number(this.lastPressure || 0)));
        if (this.strokeInputProfile) {
            this.strokeInputProfile.zeroMovePressureSamples = (this.strokeInputProfile.zeroMovePressureSamples || 0) + 1;
        }
        return stabilizedPressure;
    }

    _renderLassoPreview(points, settings) {
        if (!this.previewGraphics || points.length < 2) return;

        this.previewGraphics.clear();
        this.previewGraphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            this.previewGraphics.lineTo(points[i].x, points[i].y);
        }

        // 始点と終点を結ぶガイド線（点線が理想だが一旦実線で）
        this.previewGraphics.lineTo(points[0].x, points[0].y);

        this.previewGraphics.stroke({
            width: 1.5,
            color: settings.color,
            alpha: 0.6,
            cap: 'round',
            join: 'round'
        });

        // 塗りプレビュー（非常に薄く）
        this.previewGraphics.fill({
            color: settings.color,
            alpha: 0.15
        });
    }

    _renderRealtimeSegmentIfNeeded(mode, localX, localY, pressure, force = false) {
        return this._renderRealtimeStrokePoint(mode, localX, localY, pressure, force);
    }

    _renderRealtimeStrokePoint(mode, localX, localY, pressure, force = false) {
        const dx = localX - this.lastRenderedLocalX;
        const dy = localY - this.lastRenderedLocalY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const distanceSkipped = !force && distance <= 0.5;
        this._recordRealtimeStrokePointDebug(mode, {
            distance,
            dx,
            dy,
            localX,
            localY,
            force,
            skipped: distanceSkipped
        });
        if (distanceSkipped) return;

        const renderPressure = this._stabilizeInitialPenRealtimePressure(mode, pressure, distance);
        // 入り(taper-in)は描き始めからの移動距離で径を絞る。抜きはpen-up時のmask再構築で付ける。
        const usesTaper = mode === 'pen' && this.airbrushState?.dabMode === 'pen';
        const taperTravel = (this.penTaperTravel || 0) + distance;
        const taperScale = usesTaper ? this._getPenTaperScale(taperTravel, Infinity) : 1;
        const segmentPoints = distance <= 0
            ? [{ x: localX, y: localY, pressure }]
            : [
                {
                    x: this.lastRenderedLocalX,
                    y: this.lastRenderedLocalY,
                    pressure: this.lastRenderedPressure,
                    widthScale: usesTaper ? (this.lastRenderedTaperScale ?? 1) : 1
                },
                { x: localX, y: localY, pressure: renderPressure, widthScale: taperScale }
              ];

        if (mode === 'eraser') {
            if (distance <= 0) return;
            if (this.airbrushState?.dabMode === 'pen') {
                this._renderRealtimeAirbrushSegment(segmentPoints);
            } else {
                this._renderRealtimeEraserSegment(segmentPoints);
            }
            this.realtimeEraserApplied = true;
        } else if (mode === 'pen') {
            if (distance <= 0) return;
            if (this.airbrushState?.dabMode === 'pen') {
                this._renderRealtimeAirbrushSegment(segmentPoints);
            } else {
                this._renderRealtimePenSegment(segmentPoints);
            }
            this.realtimePenApplied = true;
        } else if (mode === 'airbrush' || mode === 'airbrush-erase') {
            this._renderRealtimeAirbrushSegment(segmentPoints);
            this.realtimeAirbrushApplied = true;
        } else if (mode === 'blur') {
            this._renderRealtimeBlurSegment(segmentPoints);
            this.realtimeBlurApplied = true;
        } else if (mode === 'lasso-fill') {
            // 投げ縄はリアルタイム焼き込みしない（プレビューのみ）
            return;
        } else {
            return;
        }

        this.lastRenderedLocalX = localX;
        this.lastRenderedLocalY = localY;
        this.lastRenderedPressure = renderPressure;
        this.penTaperTravel = taperTravel;
        this.lastRenderedTaperScale = taperScale;
        if (this.strokeInputProfile) {
            this.strokeInputProfile.realtimeSegments++;
        }
    }

    _acquireHistoryBaselineScratch(width, height, resolution = 1) {
        if (this.historyBaselineScratchTexture) {
            if (
                !this.historyBaselineScratchTexture.destroyed &&
                this.historyBaselineScratchTexture.width === width &&
                this.historyBaselineScratchTexture.height === height &&
                (this.historyBaselineScratchTexture.resolution || 1) === resolution
            ) {
                return this.historyBaselineScratchTexture;
            }
            try {
                this.historyBaselineScratchTexture.destroy(true);
            } catch (_) {}
            this.historyBaselineScratchTexture = null;
        }

        this.historyBaselineScratchTexture = RenderTexture.create({
            width,
            height,
            resolution,
            antialias: false
        });
        return this.historyBaselineScratchTexture;
    }

    _isPatchHistoryMode(mode) {
        if (mode === 'pen' || mode === 'eraser') return true;
        // airbrushもdab到達範囲(半径0.5×size + scatter 0.2×size)がdirty rect padding(size+4)内に収まる。
        return (mode === 'airbrush' || mode === 'airbrush-erase')
            && window.TEGAKI_CONFIG?.brushEngine?.airbrushPatchHistory !== false;
    }

    _isEligibleForGpuBaseline(mode, activeLayer, settings) {
        if (!this._isPatchHistoryMode(mode)) return false;
        if (activeLayer?.layerData?.isAnimationWorkingLayer === true) return false;
        if (this._needsSelectionSnapshotForLayer(activeLayer)) return false;
        if (!activeLayer?.layerData?.renderTexture) return false;
        if (!this.layerManager?.app?.renderer) return false;
        return true;
    }

    _captureGpuBaseline(activeLayer) {
        const sourceRt = activeLayer?.layerData?.renderTexture;
        const renderer = this.layerManager?.app?.renderer;
        if (!sourceRt || !renderer) return false;

        try {
            const width = sourceRt.width;
            const height = sourceRt.height;
            const scratch = this._acquireHistoryBaselineScratch(width, height, sourceRt.resolution || 1);
            if (!scratch) return false;

            const sprite = new Sprite(sourceRt);
            renderer.render({
                container: sprite,
                target: scratch,
                clear: true,
                clearColor: [0, 0, 0, 0]
            });
            sprite.destroy({ texture: false, baseTexture: false });
            return true;
        } catch (err) {
            if (window.TEGAKI_CONFIG?.debug) {
                console.warn('[BrushCore] GPU baseline capture failed, falling back to CPU snapshot', err);
            }
            return false;
        }
    }

    _ensureLayerRasterFrameForStroke(activeLayer, settings, mode) {
        if (!activeLayer?.layerData?.renderTexture) return null;
        if (!['pen', 'eraser', 'airbrush', 'airbrush-erase', 'blur'].includes(mode)) return null;
        if (typeof this.layerManager?.ensureLayerRasterBoundsForRect !== 'function') return null;

        const canvasConfig = this.layerManager.config?.canvas || window.TEGAKI_CONFIG?.canvas || {};
        const width = Math.max(
            1,
            Math.round(Number(canvasConfig.width || this.layerManager.canvasWidth || activeLayer.layerData.renderTexture.width || 1))
        );
        const height = Math.max(
            1,
            Math.round(Number(canvasConfig.height || this.layerManager.canvasHeight || activeLayer.layerData.renderTexture.height || 1))
        );
        // 100px以下の従来サイズは size*2 の余白を維持し、それを超える大ブラシは
        // 半径＋αで頭打ちにしてレイヤーRTの過剰な拡張（VRAM増）を防ぐ。
        const brushSize = Number(settings?.size ?? 1);
        const padding = Math.ceil(Math.max(4, Math.min(brushSize * 2, Math.max(200, brushSize / 2 + 4))));

        const result = this.layerManager.ensureLayerRasterBoundsForRect(activeLayer, {
            x: 0,
            y: 0,
            width,
            height
        }, { padding });

        if (window.TEGAKI_CONFIG?.debug && result?.changed) {
            console.info('[BrushCore] expanded active layer raster bounds for stroke', {
                layerId: activeLayer.layerData.id,
                mode,
                bounds: result.bounds
            });
        }
        return result;
    }

    _getLayerRasterBounds(layer) {
        const data = layer?.layerData;
        const renderTexture = data?.renderTexture;
        const source = data?.rasterBounds || {};
        const width = Math.max(1, Math.round(Number(source.width || renderTexture?.width || 1)));
        const height = Math.max(1, Math.round(Number(source.height || renderTexture?.height || 1)));
        const x = Number(source.x);
        const y = Number(source.y);
        return {
            x: Number.isFinite(x) ? Math.round(x) : 0,
            y: Number.isFinite(y) ? Math.round(y) : 0,
            width,
            height
        };
    }

    _applyLayerRasterRenderOffset(layer, displayObject) {
        if (!displayObject) return;
        const bounds = this._getLayerRasterBounds(layer);
        displayObject.position.set(
            (displayObject.position?.x || 0) - bounds.x,
            (displayObject.position?.y || 0) - bounds.y
        );
    }

    _syncLayerRasterSpritePosition(layer, sprite) {
        if (!sprite) return;
        const bounds = this._getLayerRasterBounds(layer);
        sprite.position.set(bounds.x, bounds.y);
    }

    _projectPointsToLayerRaster(layer, points) {
        const bounds = this._getLayerRasterBounds(layer);
        return (points || []).map(point => ({
            ...point,
            x: point.x - bounds.x,
            y: point.y - bounds.y
        }));
    }

    _isPressureEnabledForMode(mode, settings, pointerType) {
        if (pointerType !== 'pen') return false;
        if (mode === 'eraser') return settings.eraserPressureEnabled === true;
        if (mode === 'airbrush' || mode === 'airbrush-erase') return settings.pressureEnabled === true;
        if (mode === 'blur' || mode === 'lasso-fill') return false;
        return settings.pressureEnabled === true;
    }

    _requestLiveCanvasRender(reason = 'stroke') {
        const app = this.layerManager?.app || window.app;
        if (!app?.renderer || !app?.stage || typeof requestAnimationFrame !== 'function') {
            return;
        }

        const realtime = this.strokeInputProfile?.realtime || null;
        if (realtime) {
            realtime.liveRenderRequests++;
            realtime.liveRenderReason = reason;
        }

        if (this.liveRenderFrameRequest !== null) {
            if (realtime) {
                realtime.liveRenderCoalesced++;
            }
            return;
        }

        this.liveRenderFrameRequest = requestAnimationFrame(() => {
            this.liveRenderFrameRequest = null;

            try {
                if (typeof app.render === 'function') {
                    app.render();
                    if (realtime) {
                        realtime.liveRenderMethod = 'app.render';
                    }
                } else {
                    app.renderer.render({ container: app.stage });
                    if (realtime) {
                        realtime.liveRenderMethod = 'renderer.stage';
                    }
                }
                if (realtime) {
                    realtime.liveRenderExecuted++;
                }
            } catch (error) {
                if (realtime) {
                    realtime.liveRenderFailures++;
                }
                if (window.TEGAKI_CONFIG?.debug) {
                    console.warn('[BrushCore] live canvas render failed', { reason, error });
                }
            }
        });
    }

    /**
     * [指示書] 消しゴムのリアルタイム反映用：短いセグメントをキューまたは直接バッチで RenderTexture に焼き込む
     */
    _renderRealtimeEraserSegment(points) {
        if (!points || points.length < 2) return;
        const p0 = points[0];
        const p1 = points[points.length - 1];
        if (this.realtimeBatchQueue && this.realtimeBatchMode === 'eraser') {
            this._queueRealtimeSegment(p0, p1);
            return;
        }
        this._beginRealtimeBatch('eraser');
        this._queueRealtimeSegment(p0, p1);
        this._flushRealtimeBatch(true);
    }

    /**
     * [指示書] ペンのリアルタイム反映用：短いセグメントをキューまたは直接バッチで RenderTexture に焼き込む
     */
    _renderRealtimePenSegment(points) {
        if (!points || points.length < 2) return;
        const p0 = points[0];
        const p1 = points[points.length - 1];
        if (this.realtimeBatchQueue && this.realtimeBatchMode === 'pen') {
            this._queueRealtimeSegment(p0, p1);
            return;
        }
        this._beginRealtimeBatch('pen');
        this._queueRealtimeSegment(p0, p1);
        this._flushRealtimeBatch(true);
    }

    _beginRealtimeBatch(mode) {
        if (mode !== 'pen' && mode !== 'eraser') return false;
        if (this.realtimeBatchMode && this.realtimeBatchMode !== mode) {
            this._flushRealtimeBatch(true);
        }
        this.realtimeBatchDepth++;
        if (this.realtimeBatchDepth === 1) {
            this.realtimeBatchQueue = [];
            this.realtimeBatchMode = mode;
        }
        return true;
    }

    _queueRealtimeSegment(p0, p1) {
        if (!this.realtimeBatchQueue || !p0 || !p1) return false;
        this.realtimeBatchQueue.push({ p0, p1 });
        return true;
    }

    _flushRealtimeBatch(force = false) {
        if (this.realtimeBatchDepth <= 0) return;
        if (!force) {
            this.realtimeBatchDepth--;
            if (this.realtimeBatchDepth > 0) return;
        } else {
            this.realtimeBatchDepth = 0;
        }

        const queue = this.realtimeBatchQueue;
        const mode = this.realtimeBatchMode;
        this.realtimeBatchQueue = null;
        this.realtimeBatchMode = null;

        if (!Array.isArray(queue) || queue.length === 0 || !mode) return;

        const activeLayer = (mode === 'pen' && this.penOpacityState?.targetLayer)
            || this.strokeTargetLayer
            || this.layerManager?.getActiveLayer();
        const renderer = this.layerManager?.app?.renderer;
        const renderTarget = (mode === 'pen' && this.penOpacityState?.texture)
            || activeLayer?.layerData?.renderTexture;

        if (!activeLayer || !renderer || !renderTarget) {
            if (mode === 'pen') {
                this._recordRealtimePenRenderDebug('missing-target');
            }
            return;
        }

        const settings = this._getCurrentSettings();
        const renderSettings = (mode === 'pen' && this.penOpacityState)
            ? { ...settings, opacity: 1.0 }
            : settings;

        const perfStart = this._perfNow();
        const graphics = this.strokeRenderer.renderLineSegmentsBatch(queue, renderSettings, mode);
        if (!graphics) {
            if (mode === 'pen') {
                this._recordRealtimePenRenderDebug('missing-graphics');
            }
            return;
        }

        let renderContainer = null;
        try {
            renderContainer = new Container();
            renderContainer.addChild(graphics);
            if (mode === 'eraser') {
                renderContainer.blendMode = 'erase';
            }
            this._applyLayerRasterRenderOffset(activeLayer, renderContainer);

            renderer.render({
                container: renderContainer,
                target: renderTarget,
                clear: false
            });

            if (mode === 'eraser') {
                this._requestLiveCanvasRender('realtime-eraser');
            } else {
                this._recordRealtimePenRenderDebug('rendered');
                this._requestLiveCanvasRender(this.penOpacityState ? 'realtime-pen-preview' : 'realtime-pen');
            }
        } catch (err) {
            console.error(`[BrushCore] _flushRealtimeBatch error (${mode}):`, err);
        } finally {
            if (renderContainer) {
                renderContainer.destroy({ children: true, texture: true, baseTexture: true });
            } else if (!graphics.destroyed) {
                graphics.destroy({ children: true, texture: true, baseTexture: true });
            }
        }

        if (this.strokeInputProfile?.realtime) {
            const rt = this.strokeInputProfile.realtime;
            rt.lineBatchSegments = (rt.lineBatchSegments || 0) + queue.length;
            rt.lineBatchFlushes = (rt.lineBatchFlushes || 0) + 1;
            rt.realtimeGraphicsCreated = (rt.realtimeGraphicsCreated || 0) + 1;
            rt.rendererRenderCalls = (rt.rendererRenderCalls || 0) + 1;
            if (mode === 'pen') {
                rt.penBatchSegments = (rt.penBatchSegments || 0) + queue.length;
                rt.penBatchFlushes = (rt.penBatchFlushes || 0) + 1;
                rt.penRenderCalls = (rt.penRenderCalls || 0) + 1;
            }
        }
        this._warnPerf('brush.flushRealtimeBatch', perfStart, {
            mode,
            segments: queue.length,
            penOpacityIsolation: this.penOpacityState !== null
        });
    }

    _flushRealtimePenBatch() {
        this._flushRealtimeBatch(true);
    }

    _shouldUsePenOpacityIsolation(mode, settings) {
        const opacity = Number(settings?.opacity ?? 1);
        return mode === 'pen'
            && Number.isFinite(opacity)
            && opacity >= 0
            && opacity < 0.999;
    }

    _beginPenOpacityStroke(activeLayer, settings) {
        this._cleanupPenOpacityStroke();

        const sourceRenderTexture = activeLayer?.layerData?.renderTexture;
        if (!sourceRenderTexture || !this.layerManager.app?.renderer) {
            return;
        }

        const width = sourceRenderTexture.width
            || activeLayer.layerData?.width
            || this.layerManager.canvasWidth
            || 1;
        const height = sourceRenderTexture.height
            || activeLayer.layerData?.height
            || this.layerManager.canvasHeight
            || 1;
        const texture = RenderTexture.create({
            width,
            height,
            resolution: 1,
            antialias: true
        });
        const empty = new Container();
        this.layerManager.app.renderer.render({
            container: empty,
            target: texture,
            clear: true,
            clearColor: [0, 0, 0, 0]
        });
        empty.destroy();

        const previewSprite = new Sprite(texture);
        previewSprite.label = 'penOpacityStrokePreview';
        previewSprite.alpha = Math.max(0, Math.min(1, Number(settings.opacity ?? 1)));
        // 'normal'を明示するとLayer containerのblend mode(乗算等)を上書きするため、親から継承する。
        previewSprite.blendMode = 'inherit';
        this._syncLayerRasterSpritePosition(activeLayer, previewSprite);

        if (activeLayer.layerData?.clipping) {
            const clippingMask = activeLayer.layerData.clippingMaskSprite;
            if (clippingMask) {
                previewSprite.setMask({
                    mask: clippingMask,
                    inverse: isInverseClipping(activeLayer.layerData)
                });
            } else {
                previewSprite.visible = false;
            }
        }

        activeLayer.addChild(previewSprite);
        this.penOpacityState = {
            targetLayer: activeLayer,
            texture,
            previewSprite,
            opacity: previewSprite.alpha
        };
        this._requestLiveCanvasRender('pen-opacity-preview-start');
    }

    _commitPenOpacityStroke(activeLayer) {
        const state = this.penOpacityState;
        const target = activeLayer?.layerData?.renderTexture;
        const renderer = this.layerManager.app?.renderer;
        if (!state?.previewSprite || !state?.texture || !target || !renderer) return false;

        if (state.previewSprite.parent) {
            state.previewSprite.parent.removeChild(state.previewSprite);
        }
        state.previewSprite.mask = null;
        state.previewSprite.setMask({ mask: null, inverse: false });

        const commitSprite = new Sprite(state.texture);
        commitSprite.alpha = state.opacity;
        commitSprite.blendMode = 'normal';

        renderer.render({
            container: commitSprite,
            target,
            clear: false
        });
        commitSprite.destroy({ texture: false, baseTexture: false });
        this._requestLiveCanvasRender('pen-opacity-commit');
        return true;
    }

    _cleanupPenOpacityStroke() {
        const state = this.penOpacityState;
        if (state?.previewSprite) {
            state.previewSprite.mask = null;
            state.previewSprite.setMask({ mask: null, inverse: false });
            if (state.previewSprite.parent) {
                state.previewSprite.parent.removeChild(state.previewSprite);
            }
            state.previewSprite.destroy({ texture: false, baseTexture: false });
        }
        state?.texture?.destroy(true);
        this.penOpacityState = null;
    }

    /**
     * Phase 3a: エアブラシのリアルタイム反映用。
     * 柔らかい円形スタンプを短いセグメント上に配置し、RenderTextureへ焼き込む。
     */
    _renderRealtimeAirbrushSegment(points) {
        if (!this.airbrushState?.targetLayer || !this.airbrushState?.maskTexture) return;

        const perfStart = this._perfNow();
        const maskSettings = this._buildDabMaskSettings();
        this._renderRealtimeAirbrushSegmentWithSettings(points, maskSettings, perfStart);
    }

    /** airbrush / pen dabのstroke mask用設定(色は白、tilt・柔らかさ・AA・消しゴム筆圧を反映)。 */
    _buildDabMaskSettings() {
        const settings = this._getCurrentSettings();
        const maskSettings = {
            ...settings,
            color: 0xffffff,
            mode: 'airbrush'
        };
        if (this.airbrushState.dabMode === 'airbrush') {
            maskSettings.dabTilt = this._getDabTilt(
                'airbrushTiltStrength',
                window.TEGAKI_CONFIG?.brushEngine?.airbrushTiltStrength ?? 0.5
            );
        }
        if (this.airbrushState.dabMode === 'pen') {
            const engine = window.TEGAKI_CONFIG?.brushEngine || {};
            maskSettings.mode = 'pen';
            maskSettings.dabMode = 'pen';
            const userSetting = (key, fallback) => {
                const value = window.TegakiSettingsManager?.get?.(key);
                return value ?? fallback;
            };
            const isEraserDab = this.airbrushState.mode === 'eraser';
            maskSettings.penDabSoftness = isEraserDab
                ? userSetting('eraserDabSoftness', engine.eraserDabSoftness ?? 0)
                : userSetting('penDabSoftness', engine.penDabSoftness ?? 0);
            maskSettings.penEdgeAA = isEraserDab ? 0 : userSetting('penEdgeAA', engine.penEdgeAA ?? 0);
            maskSettings.penDabSpacingRatio = engine.penDabSpacingRatio ?? 0.05;
            if (this.airbrushState.mode === 'pen') {
                maskSettings.dabTilt = this._getDabTilt('penTiltStrength', engine.penTiltStrength ?? 0);
            }
            if (isEraserDab) {
                // 消しゴムの筆圧は径に効かせ、eraserPressureStrength>0なら弱い筆圧で薄く消す。
                const eraserStrength = Math.max(0, Math.min(1, Number(userSetting('eraserPressureStrength', 0)) || 0));
                maskSettings.pressureEnabled = settings.eraserPressureEnabled === true;
                maskSettings.pressureOpacityEnabled = eraserStrength > 0;
                maskSettings.pressureOpacityStrength = eraserStrength;
            }
        }
        return maskSettings;
    }

    _renderRealtimeAirbrushSegmentWithSettings(points, maskSettings, perfStart) {
        const batch = this.airbrushBatch;
        const renderContainer = this.strokeRenderer.renderAirbrushSegment(
            points,
            maskSettings,
            this.airbrushState.spacingState,
            batch?.container || null
        );
        if (batch) {
            // pointer event内の区間はdabを溜め、_flushAirbrushBatchで1回だけmaskへ描く。
            if (renderContainer) batch.container = renderContainer;
            this._warnPerf('brush.renderRealtimeAirbrushSegment', perfStart, {
                points: points?.length || 0,
                batched: true
            });
            return;
        }
        this._drawAirbrushDabContainer(renderContainer);
        this._warnPerf('brush.renderRealtimeAirbrushSegment', perfStart, {
            points: points?.length || 0
        });
    }

    /** airbrush / pen dabの区間描画をpointer event単位でまとめる。開始した呼び出し側だけがtrueを受け取る。 */
    _beginAirbrushBatch() {
        if (!this.airbrushState || this.airbrushBatch) return false;
        if (window.TEGAKI_CONFIG?.brushEngine?.airbrushEventBatching === false) return false;
        this.airbrushBatch = { container: null };
        return true;
    }

    _flushAirbrushBatch() {
        const batch = this.airbrushBatch;
        this.airbrushBatch = null;
        if (!batch?.container) return;
        if (!this.airbrushState) {
            this.strokeRenderer.releaseAirbrushSegment(batch.container);
            return;
        }
        this._drawAirbrushDabContainer(batch.container);
    }

    _drawAirbrushDabContainer(renderContainer) {
        const dabCount = renderContainer?.children?.length || 0;
        if (dabCount > 0 && this.airbrushState) {
            this.airbrushState.lastDabTime = this._perfNow();
        }
        const realtime = this.strokeInputProfile?.realtime;
        if (realtime) {
            realtime.airbrushRenderCalls++;
            realtime.airbrushDabs += dabCount;
            realtime.airbrushMaxDabsPerRender = Math.max(
                realtime.airbrushMaxDabsPerRender || 0,
                dabCount
            );
        }

        if (renderContainer && this.layerManager.app?.renderer) {
            this._applyLayerRasterRenderOffset(this.airbrushState.targetLayer, renderContainer);
            // 消し用previewは今回dabが触れた範囲だけ再合成するため、release前にmask座標での範囲を取る。
            const dirtyRect = (this.airbrushState.erasePreview || this.airbrushState.tipComposite)
                ? this._getDabContainerMaskRect(renderContainer)
                : null;
            this.layerManager.app.renderer.render({
                container: renderContainer,
                target: this.airbrushState.maskTexture,
                clear: false
            });

            this.strokeRenderer.releaseAirbrushSegment(renderContainer);
            this._refreshAirbrushErasePreview(this.airbrushState.erasePreview ? dirtyRect : null);
            if (this.airbrushState.tipComposite && dirtyRect) {
                this._copyMaskRegionToTipComposite(dirtyRect);
            }
            this._requestLiveCanvasRender('realtime-airbrush');
        } else if (renderContainer) {
            this.strokeRenderer.releaseAirbrushSegment(renderContainer);
        }
    }

    _beginAirbrushStroke(activeLayer, settings) {
        this._cleanupAirbrushStroke();

        const sourceRenderTexture = activeLayer?.layerData?.renderTexture;
        if (!sourceRenderTexture || !this.layerManager.app?.renderer) {
            return;
        }

        const width = sourceRenderTexture.width
            || activeLayer.layerData?.width
            || this.layerManager.canvasWidth
            || 1;
        const height = sourceRenderTexture.height
            || activeLayer.layerData?.height
            || this.layerManager.canvasHeight
            || 1;
        const maskFormat = this._getAirbrushMaskFormat();
        const maskTexture = RenderTexture.create({
            width,
            height,
            resolution: 1,
            ...(maskFormat ? { format: maskFormat } : {})
        });
        const empty = new Container();
        this.layerManager.app.renderer.render({
            container: empty,
            target: maskTexture,
            clear: true,
            clearColor: [0, 0, 0, 0]
        });
        empty.destroy();
        const dabMode = (settings.mode === 'pen' || settings.mode === 'eraser') ? 'pen' : 'airbrush';
        const isErase = this._isEraseDabMode(settings.mode);
        // pen dabはmaskへ濃度1で置き、線の不透明度はpreview / commit spriteで一括適用する。
        const strokeOpacity = settings.mode === 'pen'
            ? Math.max(0, Math.min(1, Number(settings.opacity ?? 1)))
            : 1;
        const previewSprite = new Sprite(maskTexture);
        previewSprite.label = 'airbrushStrokePreview';
        previewSprite.alpha = strokeOpacity;
        previewSprite.tint = isErase
            ? 0xffffff
            : (settings.color ?? 0x800000);
        // 描画中previewはLayerのblend mode(乗算等)を継承し、pen-up後の見た目と揃える。
        previewSprite.blendMode = isErase ? 'erase' : 'inherit';
        this._syncLayerRasterSpritePosition(activeLayer, previewSprite);

        if (activeLayer.layerData?.clipping) {
            const clippingMask = activeLayer.layerData.clippingMaskSprite;
            if (clippingMask) {
                previewSprite.setMask({
                    mask: clippingMask,
                    inverse: isInverseClipping(activeLayer.layerData)
                });
            } else {
                previewSprite.visible = false;
            }
        }

        // 消しエアブラシのpreviewをscene上でerase合成すると下のLayerまで抜けて見えるため、
        // Layer自身のraster spriteを「Layer複製 - mask」の合成textureへ一時的に差し替える。
        const erasePreview = isErase
            ? this._beginAirbrushErasePreview(activeLayer, width, height)
            : null;
        if (!erasePreview) {
            activeLayer.addChild(previewSprite);
        }
        this.airbrushState = {
            targetLayer: activeLayer,
            maskTexture,
            previewSprite,
            erasePreview,
            spacingState: {},
            dabMode,
            opacity: strokeOpacity,
            mode: settings.mode,
            color: settings.color ?? 0x800000
        };
        this._startAirbrushBuildup();
        this._requestLiveCanvasRender('airbrush-preview-start');
    }

    /**
     * 低flow dab(既定0.08≒11/255)の累積を8bitで丸めないため、対応環境ではfloat16 maskを使う。
     * 非対応(WebGL1 / EXT_color_buffer_float無し)ではnullを返し従来の8bit maskへ戻る。
     */
    _getAirbrushMaskFormat() {
        if (window.TEGAKI_CONFIG?.brushEngine?.airbrushHighPrecisionMask === false) return null;
        if (this._airbrushMaskFormatCache !== undefined) return this._airbrushMaskFormatCache;

        const renderer = this.layerManager.app?.renderer;
        let format = null;
        if (renderer?.name === 'webgpu') {
            format = 'rgba16float';
        } else if (renderer?.context?.webGLVersion === 2 && renderer.context.extensions?.colorBufferFloat) {
            format = 'rgba16float';
        }
        this._airbrushMaskFormatCache = format;
        return format;
    }

    _commitAirbrushStroke(activeLayer) {
        const state = this.airbrushState;
        const target = activeLayer?.layerData?.renderTexture;
        const renderer = this.layerManager.app?.renderer;
        if (!state?.previewSprite || !target || !renderer) return false;

        if (state.previewSprite.parent) {
            state.previewSprite.parent.removeChild(state.previewSprite);
        }
        state.previewSprite.mask = null;
        state.previewSprite.setMask({ mask: null, inverse: false });
        const commitSprite = new Sprite(state.maskTexture);
        const isErase = this._isEraseDabMode(state.mode);
        commitSprite.tint = isErase ? 0xffffff : state.color;
        commitSprite.blendMode = isErase ? 'erase' : 'normal';
        commitSprite.alpha = state.opacity ?? 1;
        // render rootに直接置いたspriteのblendModeは適用されず、eraseが白の通常合成になる。
        // 親Containerを挟み、子spriteのblendModeとして確実に効かせる。
        const commitContainer = new Container();
        commitContainer.addChild(commitSprite);

        renderer.render({
            container: commitContainer,
            target,
            clear: false
        });
        commitContainer.destroy({ children: true, texture: false, baseTexture: false });
        this._requestLiveCanvasRender('airbrush-commit');
        return true;
    }

    _beginAirbrushErasePreview(activeLayer, width, height) {
        if (window.TEGAKI_CONFIG?.brushEngine?.airbrushErasePreviewComposite === false) return null;
        const layerSprite = activeLayer?.layerData?.layerSprite;
        const sourceTexture = activeLayer?.layerData?.renderTexture;
        const renderer = this.layerManager.app?.renderer;
        if (!layerSprite || !sourceTexture || !renderer || layerSprite.texture !== sourceTexture) return null;

        const texture = RenderTexture.create({ width, height, resolution: 1 });
        const preview = { layerSprite, sourceTexture, texture };
        this._renderAirbrushErasePreview(preview, null);
        layerSprite.texture = texture;
        return preview;
    }

    _renderAirbrushErasePreview(preview, maskTexture) {
        const renderer = this.layerManager.app?.renderer;
        if (!preview || !renderer) return;
        const container = new Container();
        container.addChild(new Sprite(preview.sourceTexture));
        if (maskTexture) {
            const eraseSprite = new Sprite(maskTexture);
            eraseSprite.blendMode = 'erase';
            container.addChild(eraseSprite);
        }
        renderer.render({
            container,
            target: preview.texture,
            clear: true,
            clearColor: [0, 0, 0, 0]
        });
        container.destroy({ children: true, texture: false, baseTexture: false });
    }

    _refreshAirbrushErasePreview(dirtyRect = null) {
        const state = this.airbrushState;
        if (!state?.erasePreview) return;
        if (dirtyRect && window.TEGAKI_CONFIG?.brushEngine?.airbrushErasePreviewDirtyRect !== false) {
            this._renderAirbrushErasePreviewRect(state.erasePreview, state.maskTexture, dirtyRect);
            return;
        }
        this._renderAirbrushErasePreview(state.erasePreview, state.maskTexture);
    }

    /** dab container(位置offset適用済み)のmask texture上の整数矩形。AA分を少し広げ、texture内へclampする。 */
    _getDabContainerMaskRect(container) {
        const mask = this.airbrushState?.maskTexture;
        if (!container || !mask || container.children.length === 0) return null;
        const local = container.getLocalBounds();
        if (!Number.isFinite(local.x) || local.width <= 0 || local.height <= 0) return null;
        const pad = 2;
        const x0 = Math.max(0, Math.floor(local.x + container.position.x - pad));
        const y0 = Math.max(0, Math.floor(local.y + container.position.y - pad));
        const x1 = Math.min(mask.width, Math.ceil(local.x + local.width + container.position.x + pad));
        const y1 = Math.min(mask.height, Math.ceil(local.y + local.height + container.position.y + pad));
        if (x1 <= x0 || y1 <= y0) return null;
        return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
    }

    /**
     * previewの指定矩形だけ「Layer複製 - mask」を再合成する。
     * 'none'合成で元Layerの画素を矩形へそのまま写し、その上からmask(累積)をeraseする。
     */
    _renderAirbrushErasePreviewRect(preview, maskTexture, rect) {
        const renderer = this.layerManager.app?.renderer;
        if (!preview || !renderer || !maskTexture) return;
        const frame = new Rectangle(rect.x, rect.y, rect.width, rect.height);
        const sourcePart = new Texture({ source: preview.sourceTexture.source, frame });
        const maskPart = new Texture({ source: maskTexture.source, frame: frame.clone() });
        const container = new Container();
        const copySprite = new Sprite(sourcePart);
        copySprite.position.set(rect.x, rect.y);
        copySprite.blendMode = 'none';
        const eraseSprite = new Sprite(maskPart);
        eraseSprite.position.set(rect.x, rect.y);
        eraseSprite.blendMode = 'erase';
        container.addChild(copySprite, eraseSprite);
        renderer.render({
            container,
            target: preview.texture,
            clear: false
        });
        container.destroy({ children: true });
        sourcePart.destroy(false);
        maskPart.destroy(false);
    }

    _cleanupAirbrushErasePreview(preview) {
        if (!preview) return;
        if (preview.layerSprite && !preview.layerSprite.destroyed && preview.layerSprite.texture === preview.texture) {
            preview.layerSprite.texture = preview.sourceTexture;
        }
        preview.texture?.destroy(true);
    }

    _cleanupAirbrushStroke() {
        this._clearPenLiveTip();
        if (this.airbrushState?.buildupTimer) {
            clearTimeout(this.airbrushState.buildupTimer);
        }
        if (this.airbrushBatch?.container) {
            this.strokeRenderer.releaseAirbrushSegment(this.airbrushBatch.container);
        }
        this.airbrushBatch = null;
        const state = this.airbrushState;
        this._cleanupAirbrushErasePreview(state?.erasePreview);
        if (state?.previewSprite) {
            state.previewSprite.mask = null;
            state.previewSprite.setMask({ mask: null, inverse: false });
            if (state.previewSprite.parent) {
                state.previewSprite.parent.removeChild(state.previewSprite);
            }
            state.previewSprite.destroy({ texture: false, baseTexture: false });
        }
        state?.maskTexture?.destroy(true);
        this.airbrushState = null;
    }

    /**
     * Phase 3a: ぼかしブラシの開始時スナップショットを作成する。
     */
    _beginBlurStroke(activeLayer, settings) {
        this._cleanupBlurStroke();

        const renderer = this.layerManager.app?.renderer;
        const sourceRenderTexture = activeLayer?.layerData?.renderTexture;

        if (!renderer || !sourceRenderTexture) {
            this.blurState = null;
            return;
        }

        const width = sourceRenderTexture.width || activeLayer.layerData?.width || this.layerManager.canvasWidth || 1;
        const height = sourceRenderTexture.height || activeLayer.layerData?.height || this.layerManager.canvasHeight || 1;

        const blurSourceTexture = RenderTexture.create({
            width,
            height,
            resolution: 1
        });

        const sourceSprite = new Sprite(sourceRenderTexture);

        renderer.render({
            container: sourceSprite,
            target: blurSourceTexture,
            clear: true
        });

        sourceSprite.destroy();

        this.blurState = {
            sourceTexture: blurSourceTexture,
            blurStrength: settings.blurStrength ?? 4
        };
    }

    /**
     * Phase 3a: ぼかしブラシのリアルタイム反映用。
     * ストローク開始時点の複製テクスチャにBlurFilterをかけ、マスク領域だけ焼き込む。
     */
    _renderRealtimeBlurSegment(points) {
        const activeLayer = this.strokeTargetLayer || this.layerManager.getActiveLayer();
        if (!activeLayer || !activeLayer.layerData?.renderTexture || !this.blurState?.sourceTexture) return;

        const settings = this._getCurrentSettings();
        const rasterPoints = this._projectPointsToLayerRaster(activeLayer, points);
        const renderContainer = this.strokeRenderer.renderBlurSegment(rasterPoints, settings, this.blurState.sourceTexture);

        if (renderContainer && this.layerManager.app?.renderer) {
            this.layerManager.app.renderer.render({
                container: renderContainer,
                target: activeLayer.layerData.renderTexture,
                clear: false
            });

            renderContainer.__tegakiDestroyFilters?.();
            renderContainer.destroy({ children: true });
            this._requestLiveCanvasRender('realtime-blur');
        }
    }

    _cleanupBlurStroke() {
        if (this.blurState?.sourceTexture) {
            this.blurState.sourceTexture.destroy(true);
        }
        this.blurState = null;
    }

    _appendFinalPointerSample(finalPointer = null, inputProfile = null) {
        if (!this.isDrawing || !finalPointer) {
            return false;
        }

        const clientX = Number(finalPointer.clientX);
        const clientY = Number(finalPointer.clientY);
        if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
            return false;
        }

        const activeLayer = this.airbrushState?.targetLayer
            || this.penOpacityState?.targetLayer
            || this.strokeTargetLayer
            || this.layerManager.getActiveLayer();
        if (!activeLayer) {
            return false;
        }

        const { canvasX, canvasY } = this.coordinateSystem.screenClientToCanvas(clientX, clientY);
        const { worldX, worldY } = this.coordinateSystem.canvasToWorld(canvasX, canvasY);
        const { localX, localY } = this.coordinateSystem.worldToLocal(worldX, worldY, activeLayer);
        const distance = Math.hypot(localX - this.lastLocalX, localY - this.lastLocalY);
        const rawPressure = Number(finalPointer.pressure ?? this.lastPressure);
        const pressure = Number.isFinite(rawPressure) ? rawPressure : this.lastPressure;
        const pressureDelta = Math.abs(pressure - this.lastPressure);

        if (distance <= 0.01 && pressureDelta <= 0.001) {
            return false;
        }

        this.updateStroke(
            clientX,
            clientY,
            pressure,
            finalPointer.pointerType || inputProfile?.pointerType || 'unknown',
            finalPointer.inputProfile || inputProfile
        );

        if (this.strokeInputProfile) {
            this.strokeInputProfile.finalPointerSample = {
                distance: Number(distance.toFixed(3)),
                pressureDelta: Number(pressureDelta.toFixed(4))
            };
            if (this.strokeInputProfile.realtime) {
                this.strokeInputProfile.realtime.finalPointerUpdates++;
            }
        }

        return true;
    }

    async finalizeStroke(inputProfile = null, finalPointer = null) {
        if (!this.isDrawing) return;

        const finalizeStart = window.TEGAKI_CONFIG?.debug ? this._perfNow() : null;

        const activeLayer = this.airbrushState?.targetLayer
            || this.penOpacityState?.targetLayer
            || this.strokeTargetLayer
            || this.layerManager.getActiveLayer();
        if (!activeLayer) return;

        this._appendFinalPointerSample(finalPointer, inputProfile);
        this._clearPenLiveTip();
        this._flushPendingCurveChord();
        this._flushRealtimeBatch(true);

        let strokeData = this.strokeRecorder.endStroke();
        this._logInputProfile('up', inputProfile, {
            mode: this.getMode(),
            pointerType: inputProfile?.pointerType || 'unknown',
            recorder: this.strokeRecorder._summarizePoints?.(strokeData.points) || null,
            pressureHandler: this.pressureHandler
                ? {
                    baseline: Number((this.pressureHandler.getBaseline?.() ?? 0).toFixed(4)),
                    calibrated: this.pressureHandler.isReady?.() === true,
                    distanceFilter: this.pressureHandler.enableDistanceFilter === true
                }
                : null,
            interpolation: {
                finalPointCount: strokeData.points.length
            }
        });

        // プレビュー破棄
        if (this.previewGraphics) {
            if (this.previewGraphics.parent) {
                this.previewGraphics.parent.removeChild(this.previewGraphics);
            }
            this.previewGraphics.destroy();
            this.previewGraphics = null;
        }

        const settings = this._getCurrentSettings();
        const mode = settings.mode || 'pen';

        // 🆕 Phase 3d: 投げ縄塗り
        if (mode === 'lasso-fill') {
            if (strokeData.points.length >= 3) {
                await this.fillTool.performLassoFill(
                    strokeData.points,
                    settings.color,
                    settings.opacity,
                    activeLayer,
                    this.layerManager,
                    this.strokeSelectionBefore
                );
            }
            this.isDrawing = false;
            this.strokeHistoryBefore = null;
            this.strokeSelectionBefore = null;
            this.strokeInputProfile = null;
            this.strokeTargetLayer = null;
            if (this.eventBus) {
                this.eventBus.emit('drawing:stroke-completed', {
                    component: 'drawing',
                    action: 'stroke-completed',
                    data: {
                        mode,
                        layerId: activeLayer.layerData?.id,
                        pointCount: strokeData.points.length
                    }
                });
            }
            return;
        }

        strokeData = this._stabilizeShortPenStroke(strokeData, settings, mode);
        this._renderPenDabTapIfNeeded(mode, strokeData);

        const finalPoint = strokeData?.points?.[strokeData.points.length - 1];
        if (
            (mode === 'airbrush' || mode === 'airbrush-erase')
            && !this.realtimeAirbrushApplied
            && finalPoint
            && this.airbrushState?.pressureEnabled !== true
        ) {
            this._renderRealtimeAirbrushSegment([finalPoint]);
            this.realtimeAirbrushApplied = true;
        }
        const hasRealtimeApplied =
            (mode === 'eraser' && this.realtimeEraserApplied) ||
            (mode === 'pen' && this.realtimePenApplied) ||
            ((mode === 'airbrush' || mode === 'airbrush-erase') && this.realtimeAirbrushApplied) ||
            (mode === 'blur' && this.realtimeBlurApplied);

        if (finalPoint && hasRealtimeApplied) {
            this._renderRealtimeSegmentIfNeeded(mode, finalPoint.x, finalPoint.y, finalPoint.pressure, true);
        }

        if ((mode === 'airbrush' || mode === 'airbrush-erase') && hasRealtimeApplied) {
            this._commitAirbrushStroke(activeLayer);
        }
        if ((mode === 'pen' || mode === 'eraser') && this.airbrushState?.dabMode === 'pen' && hasRealtimeApplied) {
            if (mode === 'pen') {
                this._applyPenTaperToMask(strokeData);
            }
            this._commitAirbrushStroke(activeLayer);
        }
        if (mode === 'pen' && this.penOpacityState && hasRealtimeApplied) {
            this._commitPenOpacityStroke(activeLayer);
        }

        const alreadyApplied = hasRealtimeApplied;
        const penOpacityIsolationUsed = this.strokeInputProfile?.penOpacityIsolation === true;

        // 通常のペン/消しゴムはドラッグ中のライブ焼き込みを完成形にする。
        // pointerup 後に別アルゴリズムで焼き直すと、線幅や軌跡が変わって描画体験が崩れる。
        const shouldBakeFinal = !alreadyApplied;

        // 最終描画オブジェクト生成。ライブ焼き込み済みなら余計な再生成を避ける。
        const graphics = shouldBakeFinal
            ? await this.strokeRenderer.renderFinalStroke(strokeData, settings)
            : null;

        const layerData = activeLayer.layerData;

        if (graphics && this.layerManager.app?.renderer) {
            // 🆕 RenderTextureへの焼き込み
            if (layerData?.renderTexture && shouldBakeFinal) {
                if (mode === 'eraser') {
                    const renderContainer = new Container();
                    renderContainer.addChild(graphics);
                    renderContainer.blendMode = 'erase';
                    this._applyLayerRasterRenderOffset(activeLayer, renderContainer);

                    this.layerManager.app.renderer.render({
                        container: renderContainer,
                        target: layerData.renderTexture,
                        clear: false
                    });

                    renderContainer.destroy({ children: true, texture: true, baseTexture: true });
                    this._requestLiveCanvasRender('final-eraser');
                } else {
                    graphics.blendMode = 'normal';
                    const renderContainer = new Container();
                    renderContainer.addChild(graphics);
                    this._applyLayerRasterRenderOffset(activeLayer, renderContainer);

                    this.layerManager.app.renderer.render({
                        container: renderContainer,
                        target: layerData.renderTexture,
                        clear: false
                    });

                    renderContainer.destroy({ children: true, texture: true, baseTexture: true });
                    this._requestLiveCanvasRender('final-stroke');
                }
            } else if (!layerData?.renderTexture) {
                // フォールバック: 従来通り子要素として追加
                activeLayer.addChild(graphics);
                this._requestLiveCanvasRender('fallback-child-stroke');
            } else if (graphics.destroy) {
                // 既にライブ焼き込み済みの場合は、生成した graphics を破棄するだけにする
                graphics.destroy({ children: true, texture: true, baseTexture: true });
            }
        }

        if (layerData) {
            // Stage A: 通常ラスター描画では layerData.pathsData への永続累積を停止。
            // 描画はすべてRenderTextureにベイク済みであり、点列は描画・復元・保存・エクスポートに未使用。
            // 必要に応じてストローク完了イベント通知やメタデータ用にのみ参照する。
        }

        window.CoreRuntime?.api?.selection?.constrainLayer?.(
            activeLayer,
            this.strokeSelectionBefore
        );
        this._recordStrokeHistory(activeLayer, mode, strokeData.points, settings);

        const layerIndex = this.layerManager.getLayerIndex(activeLayer);

        if (this.eventBus && layerIndex !== -1) {
            this.eventBus.emit('layer:path-added', {
                component: 'drawing',
                action: 'path-added',
                data: {
                    layerIndex: layerIndex,
                    layerId: activeLayer.layerData?.id,
                    mode: mode
                }
            });

            this.eventBus.emit('thumbnail:layer-updated', {
                layerIndex: layerIndex,
                layerId: activeLayer.layerData?.id,
                immediate: false,
                source: 'brush-stroke'
            });
        }

        this.isDrawing = false;
        this.realtimeEraserApplied = false; 
        this.realtimePenApplied = false;
        this.realtimeAirbrushApplied = false;
        this.realtimeBlurApplied = false;
        this._cleanupAirbrushStroke();
        this._cleanupPenOpacityStroke();
        this._cleanupBlurStroke();
        this.strokeHistoryBefore = null;
        this.strokeSelectionBefore = null;
        this.strokeHistoryGpuBaseline = null;
        this.strokeTargetLayer = null;
        this.lastClientX = null;
        this.lastClientY = null;
        this._logStrokeFinalizeProfile({
            mode,
            pointCount: strokeData.points.length,
            duration: strokeData.duration,
            finalizeMs: Number.isFinite(finalizeStart)
                ? Number((this._perfNow() - finalizeStart).toFixed(2))
                : null,
            realtimeApplied: alreadyApplied,
            finalBakeRendered: shouldBakeFinal,
            penOpacityIsolation: penOpacityIsolationUsed,
            shortStrokeStabilized: this.strokeInputProfile?.shortStrokeStabilized || null,
            recorder: this.strokeRecorder._summarizePoints?.(strokeData.points) || null,
            realtime: this._getRealtimeDebugSummary(mode, alreadyApplied, shouldBakeFinal),
            retainedAtEnd: this._getLongDrawingDiagnosticSample(activeLayer)
        });
        this.strokeInputProfile = null;

        if (this.eventBus) {
            this.eventBus.emit('drawing:stroke-completed', {
                component: 'drawing',
                action: 'stroke-completed',
                data: {
                    mode: mode,
                    layerId: activeLayer.layerData?.id,
                    pointCount: strokeData.points.length
                }
            });
        }
    }

    _stabilizeShortPenStroke(strokeData, settings, mode) {
        const points = strokeData?.points || [];
        if (
            mode !== 'pen'
            || settings?.pressureEnabled !== true
            || points.length === 0
        ) {
            return strokeData;
        }

        const stats = this.strokeRecorder._summarizePoints?.(points) || null;
        const totalDistance = Number(stats?.distance ?? 0);
        const maxDistance = Number(stats?.maxDistance ?? 0);
        const isPointInput = strokeData.isSingleDot === true || totalDistance <= 0.75;
        const isVeryShortInput = isPointInput || (points.length <= 3 && maxDistance <= 1.25);

        if (!isVeryShortInput) {
            return strokeData;
        }

        const pressureCap = this._getShortPenPressureCap(settings);
        const stabilizedPoints = (isPointInput ? [points[0]] : points).map(point => ({
            ...point,
            pressure: Math.min(Number(point.pressure ?? 0), pressureCap)
        }));

        if (this.strokeInputProfile) {
            this.strokeInputProfile.shortStrokeStabilized = {
                pointCount: points.length,
                totalDistance: Number(totalDistance.toFixed(3)),
                maxDistance: Number(maxDistance.toFixed(3)),
                pressureCap: Number(pressureCap.toFixed(4)),
                collapsedToDot: isPointInput
            };
        }

        return {
            ...strokeData,
            points: stabilizedPoints,
            isSingleDot: isPointInput
        };
    }

    _stabilizeInitialPenRealtimePressure(mode, pressure, distance) {
        if (mode !== 'pen' || this.realtimePenApplied) {
            return pressure;
        }

        const settings = this._getCurrentSettings();
        if (settings?.pressureEnabled !== true || distance > 1.25) {
            return pressure;
        }

        const pressureCap = this._getShortPenPressureCap(settings);
        const cappedPressure = Math.min(Number(pressure ?? 0), pressureCap);
        if (this.strokeInputProfile) {
            this.strokeInputProfile.initialRealtimePressureCapped = {
                distance: Number(distance.toFixed(3)),
                pressure: Number((pressure ?? 0).toFixed?.(4) ?? pressure),
                pressureCap: Number(pressureCap.toFixed(4))
            };
        }
        return cappedPressure;
    }

    _getShortPenPressureCap(settings) {
        const size = Math.max(1, Number(settings?.size ?? 1));
        return Math.max(0.02, Math.min(0.12, 2.5 / size));
    }

    _recordStrokeHistory(layer, mode, strokePoints = null, strokeSettings = null) {
        let beforeSnapshot = this.strokeHistoryBefore;
        const gpuBaseline = this.strokeHistoryGpuBaseline;
        if ((!beforeSnapshot && !gpuBaseline) || !historyManager || historyManager.isApplying) return;
        if (!this.layerManager?.createLayerRasterSnapshot || !this.layerManager?.restoreLayerRasterSnapshot) return;
        if (layer?.layerData?.isAnimationWorkingLayer === true) return;

        const layerId = layer.layerData?.id;
        const layerIndex = this.layerManager.getLayerIndex(layer);
        const renderer = this.layerManager?.app?.renderer || window.app?.renderer;
        const renderTexture = layer.layerData?.renderTexture;

        // Stage B: Pen / Eraser / Airbrush の dirty rect patch History の試行
        const isPatchEligible = this._isPatchHistoryMode(mode)
            && Array.isArray(strokePoints)
            && strokePoints.length > 0
            && renderer?.extract?.pixels
            && renderTexture;

        if (isPatchEligible) {
            const currentBounds = layer.layerData?.rasterBounds;
            const beforeBounds = gpuBaseline?.bounds || beforeSnapshot?.rasterBounds;

            // 1. bounds が一致しているか確認（一致しない場合は full fallback）
            if (rasterBoundsEqual(beforeBounds, currentBounds)) {
                const baseSettings = strokeSettings || this._getCurrentSettings();
                // airbrushの傾き楕円(最大1.6倍幅+0.25×size偏位)とscatterまで含めるため余白を広げる。
                const settings = (mode === 'airbrush' || mode === 'airbrush-erase')
                    ? { ...baseSettings, size: Math.ceil(Number(baseSettings?.size || 1) * 1.3) }
                    : baseSettings;
                const projectDirtyRect = calculateStrokeDirtyRect(strokePoints, settings);
                const localDirtyRect = projectRectToRasterLocal(projectDirtyRect, currentBounds);

                if (localDirtyRect && localDirtyRect.width > 0 && localDirtyRect.height > 0) {
                    // 2. beforePatch の取得（GPU baseline scratch からの抽出、または CPU snapshot からの crop）
                    let beforePatchPixels = null;
                    if (gpuBaseline && this.historyBaselineScratchTexture) {
                        let baselineResult = null;
                        const baselineSprite = new Sprite(this.historyBaselineScratchTexture);
                        try {
                            const frame = new Rectangle(
                                localDirtyRect.x,
                                localDirtyRect.y,
                                localDirtyRect.width,
                                localDirtyRect.height
                            );
                            baselineResult = renderer.extract.pixels({
                                target: baselineSprite,
                                // 画面DPRに依存させず、Layer実画素(1x)で読み出す。
                                resolution: 1,
                                frame,
                                clearColor: '#00000000'
                            });
                        } catch (err) {
                            baselineResult = null;
                        } finally {
                            baselineSprite.destroy({ texture: false, baseTexture: false });
                        }

                        const baselineSource = baselineResult?.pixels
                            || (baselineResult instanceof Uint8ClampedArray
                                ? baselineResult
                                : (baselineResult?.buffer ? new Uint8ClampedArray(baselineResult.buffer) : null));
                        const extractedBaseW = Math.round(baselineResult?.width || localDirtyRect.width);
                        const extractedBaseH = Math.round(baselineResult?.height || localDirtyRect.height);

                        if (baselineSource && extractedBaseW === localDirtyRect.width && extractedBaseH === localDirtyRect.height && baselineSource.byteLength >= localDirtyRect.width * localDirtyRect.height * 4) {
                            beforePatchPixels = new Uint8ClampedArray(baselineSource.subarray(0, localDirtyRect.width * localDirtyRect.height * 4));
                            unpremultiplyPixels(beforePatchPixels);
                        }
                    } else if (beforeSnapshot?.pixels) {
                        beforePatchPixels = cropPixelPatch(
                            beforeSnapshot.pixels,
                            beforeSnapshot.width,
                            beforeSnapshot.height,
                            localDirtyRect
                        );
                    }

                    if (beforePatchPixels) {
                        // 3. afterPatch を Pixi renderer.extract.pixels({ frame }) で GPU から部分抽出
                        let afterResult = null;
                        const tempSprite = new Sprite(renderTexture);
                        try {
                            const frame = new Rectangle(
                                localDirtyRect.x,
                                localDirtyRect.y,
                                localDirtyRect.width,
                                localDirtyRect.height
                            );
                            afterResult = renderer.extract.pixels({
                                target: tempSprite,
                                // 画面DPRに依存させず、Layer実画素(1x)で読み出す。
                                resolution: 1,
                                frame,
                                clearColor: '#00000000'
                            });
                        } catch (err) {
                            afterResult = null;
                        } finally {
                            tempSprite.destroy({ texture: false, baseTexture: false });
                        }

                        const afterSource = afterResult?.pixels
                            || (afterResult instanceof Uint8ClampedArray
                                ? afterResult
                                : (afterResult?.buffer ? new Uint8ClampedArray(afterResult.buffer) : null));

                        const extractedW = Math.round(afterResult?.width || localDirtyRect.width);
                        const extractedH = Math.round(afterResult?.height || localDirtyRect.height);

                        if (afterSource && extractedW === localDirtyRect.width && extractedH === localDirtyRect.height && afterSource.byteLength >= localDirtyRect.width * localDirtyRect.height * 4) {
                            const afterPatchPixels = new Uint8ClampedArray(afterSource.subarray(0, localDirtyRect.width * localDirtyRect.height * 4));
                            // 直ちに unpremultiply を適用して straight RGBA に統一
                            unpremultiplyPixels(afterPatchPixels);

                            const beforePatch = {
                                rect: { ...localDirtyRect },
                                pixels: beforePatchPixels
                            };
                            const afterPatch = {
                                rect: { ...localDirtyRect },
                                pixels: afterPatchPixels
                            };
                            const byteSize = estimatePatchHistoryBytes(beforePatch, afterPatch);

                            // 重要: beforeSnapshot と GPU baseline の参照をクロージャに残さないため null 化
                            beforeSnapshot = null;
                            this.strokeHistoryBefore = null;
                            this.strokeHistoryGpuBaseline = null;

                            const restorePatch = (targetPatch) => {
                                if (!layerId || !this.layerManager) return;
                                const targetLayer = typeof this.layerManager.getLayerById === 'function'
                                    ? this.layerManager.getLayerById(layerId)
                                    : this.layerManager.getLayers?.().find(l => l.layerData?.id === layerId || l.id === layerId);
                                if (!targetLayer) return;

                                const currentSnap = this.layerManager.createLayerRasterSnapshot(targetLayer, { includePathCollections: false });
                                if (!currentSnap) return;
                                applyPixelPatch(
                                    currentSnap.pixels,
                                    currentSnap.width,
                                    currentSnap.height,
                                    targetPatch.pixels,
                                    targetPatch.rect
                                );
                                this.layerManager.restoreLayerRasterSnapshot(currentSnap, { restorePathCollections: false });
                            };

                            const recordStart = this._perfNow();
                            historyManager.record({
                                name: `draw-${mode}`,
                                do: () => restorePatch(afterPatch),
                                undo: () => restorePatch(beforePatch),
                                meta: {
                                    type: 'draw-patch',
                                    mode,
                                    layerId,
                                    layerIndex,
                                    dirtyRect: localDirtyRect,
                                    byteSize
                                },
                                byteSize
                            });
                            const recordMs = this._perfNow() - recordStart;
                            if (this.strokeInputProfile?.timings) {
                                this.strokeInputProfile.timings.historyRecordMs = Number(recordMs.toFixed(2));
                            }
                            return; // dirty rect patch 成功
                        }
                    }
                }
            }
        }

        // --- Full snapshot fallback (bounds変更時、例外時、Airbrush/Blur等の非対応ツール時) ---
        if (!beforeSnapshot && gpuBaseline && this.historyBaselineScratchTexture && renderer?.extract?.pixels) {
            try {
                const sprite = new Sprite(this.historyBaselineScratchTexture);
                const baseW = Math.round(gpuBaseline.width || this.historyBaselineScratchTexture.width);
                const baseH = Math.round(gpuBaseline.height || this.historyBaselineScratchTexture.height);
                let result = null;
                try {
                    result = renderer.extract.pixels({
                        target: sprite,
                        // 画面DPRに依存させず、Layer実画素(1x)で読み出す。
                        resolution: 1,
                        clearColor: '#00000000'
                    });
                } finally {
                    sprite.destroy({ texture: false, baseTexture: false });
                }
                const sourcePixels = result?.pixels
                    || (result instanceof Uint8ClampedArray
                        ? result
                        : (result?.buffer ? new Uint8ClampedArray(result.buffer) : null));
                if (sourcePixels) {
                    const width = Math.round(result?.width || baseW);
                    const height = Math.round(result?.height || baseH);
                    const px = new Uint8ClampedArray(sourcePixels);
                    unpremultiplyPixels(px);
                    beforeSnapshot = {
                        layerId: gpuBaseline.layerId || layerId,
                        width,
                        height,
                        rasterBounds: { ...gpuBaseline.bounds, width, height },
                        pixels: px
                    };
                }
            } catch (_) {
                beforeSnapshot = null;
            }
        }
        this.strokeHistoryGpuBaseline = null;
        if (!beforeSnapshot) return;
        const snapshotStart = this._perfNow();
        const afterSnapshot = this.layerManager.createLayerRasterSnapshot(layer, { includePathCollections: false });
        const afterSnapshotMs = this._perfNow() - snapshotStart;
        if (this.strokeInputProfile?.timings) {
            this.strokeInputProfile.timings.afterSnapshotMs = Number(afterSnapshotMs.toFixed(2));
        }
        if (!afterSnapshot) return;

        const retainedMemory = estimateRasterHistoryPairBytes(beforeSnapshot, afterSnapshot);
        const recordStart = this._perfNow();
        historyManager.record({
            name: `draw-${mode}`,
            do: () => {
                this.layerManager.restoreLayerRasterSnapshot(afterSnapshot, { restorePathCollections: false });
            },
            undo: () => {
                this.layerManager.restoreLayerRasterSnapshot(beforeSnapshot, { restorePathCollections: false });
            },
            meta: {
                type: 'draw-full',
                mode,
                layerId,
                layerIndex,
                retainedMemory
            },
            byteSize: retainedMemory.estimatedBytes
        });
        const recordMs = this._perfNow() - recordStart;
        if (this.strokeInputProfile?.timings) {
            this.strokeInputProfile.timings.historyRecordMs = Number(recordMs.toFixed(2));
        }
    }

    _needsSelectionSnapshotForLayer(layer) {
        const layerId = layer?.layerData?.id;
        if (!layerId) return false;

        const api = window.CoreRuntime?.api?.selection || window.pixelSelectionSystem;
        try {
            return !!api?.getBoundsForLayer?.(layerId);
        } catch (_error) {
            return false;
        }
    }

    _perfNow() {
        return performance?.now?.() || Date.now();
    }

    _warnPerf(label, start, extra = {}) {
        if (!window.TEGAKI_CONFIG?.debug || !Number.isFinite(start)) return;

        const duration = this._perfNow() - start;
        const thresholds = {
            frame: 16,
            drop: 33,
            lag: 50,
            severe: 100,
            freeze: 250
        };
        const level = duration >= thresholds.freeze ? 'FREEZE'
            : duration >= thresholds.severe ? 'SEVERE'
            : duration >= thresholds.lag ? 'LAG'
            : duration >= thresholds.drop ? 'DROP'
            : duration >= thresholds.frame ? 'FRAME'
            : null;
        if (!level) return;

        const entry = {
            label,
            level,
            durationMs: Number(duration.toFixed(2)),
            ...this._getPerfContext(extra)
        };
        console.warn(`[TegakiPerf:${level}] ${label}: ${entry.durationMs}ms`, entry);
        this._getStrokeInputProfiler()?.recordPerf?.(entry);
    }

    _getPerfContext(extra = {}) {
        const layers = this.layerManager?.getLayers?.() || [];
        const activeLayer = this.layerManager?.getActiveLayer?.() || null;
        const activeData = activeLayer?.layerData || {};
        const renderTexture = activeData.renderTexture || null;
        const rasterBounds = activeData.rasterBounds || null;
        return {
            mode: extra.mode || this.getMode?.() || 'unknown',
            isDrawing: this.isDrawing === true,
            layerCount: layers.length,
            visibleLayerCount: layers.filter(layer => layer?.visible !== false).length,
            activeLayer: {
                id: activeData.id ?? null,
                name: activeData.name ?? null,
                isAnimationWorkingLayer: activeData.isAnimationWorkingLayer === true,
                isFolder: activeData.isFolder === true,
                renderTexture: renderTexture
                    ? {
                        width: Math.round(renderTexture.width || 0),
                        height: Math.round(renderTexture.height || 0)
                    }
                    : null,
                rasterBounds: rasterBounds
                    ? {
                        x: rasterBounds.x ?? 0,
                        y: rasterBounds.y ?? 0,
                        width: rasterBounds.width ?? renderTexture?.width ?? null,
                        height: rasterBounds.height ?? renderTexture?.height ?? null
                    }
                    : null
            },
            stroke: this.strokeInputProfile
                ? {
                    id: this.strokeInputProfile.id,
                    events: this.strokeInputProfile.events || 0,
                    interpolatedPoints: this.strokeInputProfile.interpolatedPoints || 0,
                    realtimeSegments: this.strokeInputProfile.realtimeSegments || 0
                }
                : null,
            extra
        };
    }

    _getLongDrawingDiagnosticSample(layer) {
        if (!window.TEGAKI_CONFIG?.debug) return null;

        const layerData = layer?.layerData || {};
        const paths = Array.isArray(layerData.pathsData) ? layerData.pathsData : [];
        const pathMemory = summarizePathCollectionMemory(paths);

        const renderTexture = layerData.renderTexture || null;
        const width = Math.max(0, Math.round(renderTexture?.width || layerData.width || 0));
        const height = Math.max(0, Math.round(renderTexture?.height || layerData.height || 0));
        const memory = globalThis.performance?.memory;
        const temporaryTextures = [
            ['airbrushMask', this.airbrushState?.maskTexture],
            ['penOpacity', this.penOpacityState?.texture],
            ['blurSource', this.blurState?.sourceTexture]
        ].map(([name, texture]) => {
            const textureWidth = Math.max(0, Math.round(texture?.width || 0));
            const textureHeight = Math.max(0, Math.round(texture?.height || 0));
            return {
                name,
                active: !!texture,
                width: textureWidth,
                height: textureHeight,
                estimatedBytes: textureWidth * textureHeight * 4
            };
        });

        return {
            history: historyManager?.getUsage?.() || null,
            layer: {
                id: layerData.id ?? null,
                isAnimationWorkingLayer: layerData.isAnimationWorkingLayer === true,
                pathCount: pathMemory.pathCount,
                pointCount: pathMemory.pointCount,
                estimatedPathMetadataBytes: pathMemory.estimatedBytes,
                rasterWidth: width,
                rasterHeight: height,
                estimatedRasterBytes: width * height * 4
            },
            temporaryStrokeResources: {
                activeCount: temporaryTextures.filter(entry => entry.active).length,
                estimatedBytes: temporaryTextures.reduce((total, entry) => {
                    return total + entry.estimatedBytes;
                }, 0),
                textures: temporaryTextures
            },
            heap: memory
                ? {
                    usedJSHeapSize: Number(memory.usedJSHeapSize) || 0,
                    totalJSHeapSize: Number(memory.totalJSHeapSize) || 0,
                    jsHeapSizeLimit: Number(memory.jsHeapSizeLimit) || 0
                }
                : null
        };
    }

    _hasRealtimeApplied(mode) {
        return (
            (mode === 'eraser' && this.realtimeEraserApplied) ||
            (mode === 'pen' && this.realtimePenApplied) ||
            ((mode === 'airbrush' || mode === 'airbrush-erase') && this.realtimeAirbrushApplied) ||
            (mode === 'blur' && this.realtimeBlurApplied)
        );
    }

    _recordRealtimeStrokePointDebug(mode, sample = {}) {
        const realtime = this.strokeInputProfile?.realtime;
        if (!realtime) return;

        realtime.realtimePointCalls++;
        if (mode === 'pen') {
            realtime.penPointCalls++;
        }

        const distance = Number(sample.distance);
        if (Number.isFinite(distance)) {
            realtime.maxDistance = Math.max(Number(realtime.maxDistance || 0), distance);
        }

        if (sample.skipped) {
            realtime.distanceSkips++;
            if (Number.isFinite(distance) && distance <= 0.001) {
                realtime.zeroDistanceSkips++;
            }
        }

        const lastDistances = realtime.lastDistances || [];
        lastDistances.push({
            mode,
            distance: Number.isFinite(distance) ? Number(distance.toFixed(3)) : null,
            dx: Number.isFinite(sample.dx) ? Number(sample.dx.toFixed(3)) : null,
            dy: Number.isFinite(sample.dy) ? Number(sample.dy.toFixed(3)) : null,
            localX: Number.isFinite(sample.localX) ? Number(sample.localX.toFixed(3)) : null,
            localY: Number.isFinite(sample.localY) ? Number(sample.localY.toFixed(3)) : null,
            force: sample.force === true,
            skipped: sample.skipped === true
        });
        if (lastDistances.length > 12) {
            lastDistances.splice(0, lastDistances.length - 12);
        }
        realtime.lastDistances = lastDistances;
    }

    _recordRealtimePenRenderDebug(result) {
        const realtime = this.strokeInputProfile?.realtime;
        if (!realtime) return;

        if (result === 'rendered') {
            realtime.penRenderCalls++;
        } else if (result === 'missing-target') {
            realtime.penRenderMissingTarget++;
        } else if (result === 'missing-graphics') {
            realtime.penRenderMissingGraphics++;
        }
    }

    _getRealtimeDebugSummary(mode, hasRealtimeApplied, finalBakeRendered) {
        const realtime = this.strokeInputProfile?.realtime;
        if (!realtime) return null;

        const summary = {
            mode,
            outcome: finalBakeRendered ? 'final-bake' : 'realtime',
            hasRealtimeApplied: hasRealtimeApplied === true,
            updateCalls: realtime.updateCalls || 0,
            batchCalls: realtime.batchCalls || 0,
            realtimePointCalls: realtime.realtimePointCalls || 0,
            penPointCalls: realtime.penPointCalls || 0,
            distanceSkips: realtime.distanceSkips || 0,
            zeroDistanceSkips: realtime.zeroDistanceSkips || 0,
            penRenderCalls: realtime.penRenderCalls || 0,
            penBatchSegments: realtime.penBatchSegments || 0,
            penBatchFlushes: realtime.penBatchFlushes || 0,
            lineBatchSegments: realtime.lineBatchSegments || 0,
            lineBatchFlushes: realtime.lineBatchFlushes || 0,
            realtimeGraphicsCreated: realtime.realtimeGraphicsCreated || 0,
            rendererRenderCalls: realtime.rendererRenderCalls || 0,
            penRenderMissingTarget: realtime.penRenderMissingTarget || 0,
            penRenderMissingGraphics: realtime.penRenderMissingGraphics || 0,
            airbrushRenderCalls: realtime.airbrushRenderCalls || 0,
            airbrushDabs: realtime.airbrushDabs || 0,
            airbrushMaxDabsPerRender: realtime.airbrushMaxDabsPerRender || 0,
            maxDistance: Number((Number(realtime.maxDistance || 0)).toFixed(3)),
            finalPointerUpdates: realtime.finalPointerUpdates || 0,
            liveRenderRequests: realtime.liveRenderRequests || 0,
            liveRenderCoalesced: realtime.liveRenderCoalesced || 0,
            liveRenderExecuted: realtime.liveRenderExecuted || 0,
            liveRenderFailures: realtime.liveRenderFailures || 0,
            liveRenderMethod: realtime.liveRenderMethod || null,
            liveRenderReason: realtime.liveRenderReason || null,
            lastDistances: [...(realtime.lastDistances || [])]
        };

        if (window.TEGAKI_CONFIG?.debug && mode === 'pen') {
            console.info(`[TegakiRealtimeStroke:${summary.outcome}] ${JSON.stringify(summary)}`);
        }
        return summary;
    }

    _logInputProfile(stage, inputProfile, details = {}) {
        if (!window.TEGAKI_CONFIG?.debug || !inputProfile) {
            return;
        }

        if (stage !== 'move' || window.TEGAKI_CONFIG?.debugVerboseInput === true) {
            console.info('[StrokeInputProfile] event', {
                strokeId: this.strokeInputProfile?.id ?? null,
                stage,
                input: inputProfile,
                details
            });
        }
        this._getStrokeInputProfiler()?.recordEvent?.({
            strokeId: this.strokeInputProfile?.id ?? null,
            stage,
            input: inputProfile,
            details,
            at: Date.now()
        });
    }

    _logStrokeFinalizeProfile(details = {}) {
        if (!window.TEGAKI_CONFIG?.debug || !this.strokeInputProfile) {
            return;
        }

        const elapsedMs = Date.now() - this.strokeInputProfile.startTime;
        const entry = {
            ...this.strokeInputProfile,
            elapsedMs,
            details
        };
        console.info('[StrokeInputProfile] finalize', entry);
        const retained = details.retainedAtEnd || null;
        console.info(`[LongDrawingProfile] ${JSON.stringify({
            strokeId: entry.id,
            mode: entry.mode,
            pointerType: entry.pointerType,
            timings: entry.timings || null,
            finalizeMs: details.finalizeMs ?? null,
            history: retained?.history || null,
            layer: retained?.layer || null,
            temporaryStrokeResources: retained?.temporaryStrokeResources || null,
            heap: retained?.heap || null
        })}`);
        this._getStrokeInputProfiler()?.recordFinalize?.(entry);
    }

    _getStrokeInputProfiler() {
        return window.TegakiStrokeInputProfiler || this._ensureStrokeInputProfiler();
    }

    _ensureStrokeInputProfiler() {
        if (window.TegakiStrokeInputProfiler) {
            return window.TegakiStrokeInputProfiler;
        }

        const store = {
            events: [],
            strokes: [],
            perf: [],
            longTasks: [],
            longTaskObserver: null,
            label: null,
            maxEvents: 2000,
            maxStrokes: 200,
            maxPerf: 500,
            maxLongTasks: 200,
            setEnabled(enabled = true) {
                if (window.TEGAKI_CONFIG) {
                    window.TEGAKI_CONFIG.debug = enabled === true;
                }
                if (enabled === true) {
                    this.startLongTaskObserver();
                } else {
                    this.stopLongTaskObserver();
                }
                return this.isEnabled();
            },
            isEnabled() {
                return window.TEGAKI_CONFIG?.debug === true;
            },
            setLabel(label = null) {
                this.label = label ? String(label) : null;
                return this.label;
            },
            clear() {
                this.events = [];
                this.strokes = [];
                this.perf = [];
                this.longTasks = [];
                return this.summary();
            },
            startLongTaskObserver() {
                if (this.longTaskObserver || typeof PerformanceObserver === 'undefined') return false;
                const supported = PerformanceObserver.supportedEntryTypes;
                if (Array.isArray(supported) && !supported.includes('longtask')) return false;

                try {
                    this.longTaskObserver = new PerformanceObserver(list => {
                        for (const entry of list.getEntries()) {
                            const startTime = Number(entry.startTime) || 0;
                            const duration = Number(entry.duration) || 0;
                            this.longTasks.push({
                                name: entry.name || 'self',
                                startTime: Number(startTime.toFixed(2)),
                                durationMs: Number(duration.toFixed(2)),
                                endTime: Number((startTime + duration).toFixed(2)),
                                attribution: Array.from(entry.attribution || []).map(item => ({
                                    name: item.name || null,
                                    containerType: item.containerType || null,
                                    containerSrc: item.containerSrc || null,
                                    containerId: item.containerId || null,
                                    containerName: item.containerName || null
                                }))
                            });
                        }
                        if (this.longTasks.length > this.maxLongTasks) {
                            this.longTasks.splice(0, this.longTasks.length - this.maxLongTasks);
                        }
                    });
                    this.longTaskObserver.observe({ type: 'longtask', buffered: true });
                    return true;
                } catch (error) {
                    this.longTaskObserver = null;
                    return false;
                }
            },
            stopLongTaskObserver() {
                this.longTaskObserver?.disconnect?.();
                this.longTaskObserver = null;
            },
            getRecentLongTasks(windowMs = 2000, now = performance?.now?.() || Date.now()) {
                const numericWindow = Math.max(0, Number(windowMs) || 0);
                const cutoff = Number(now) - numericWindow;
                return this.longTasks
                    .filter(entry => entry.endTime >= cutoff)
                    .map(entry => ({
                        ...entry,
                        attribution: entry.attribution.map(item => ({ ...item }))
                    }));
            },
            recordEvent(entry) {
                if (!this.isEnabled()) return;
                this.events.push({
                    label: this.label,
                    ...entry
                });
                if (this.events.length > this.maxEvents) {
                    this.events.splice(0, this.events.length - this.maxEvents);
                }
            },
            recordFinalize(entry) {
                if (!this.isEnabled()) return;
                this.strokes.push({
                    label: this.label,
                    ...entry
                });
                if (this.strokes.length > this.maxStrokes) {
                    this.strokes.splice(0, this.strokes.length - this.maxStrokes);
                }
            },
            recordPerf(entry) {
                if (!this.isEnabled()) return;
                this.perf.push({
                    profilerLabel: this.label,
                    at: Date.now(),
                    ...entry
                });
                if (this.perf.length > this.maxPerf) {
                    this.perf.splice(0, this.perf.length - this.maxPerf);
                }
            },
            getEvents() {
                return this.events.map(entry => ({ ...entry }));
            },
            getStrokes() {
                return this.strokes.map(entry => ({ ...entry }));
            },
            getPerf() {
                return this.perf.map(entry => ({ ...entry }));
            },
            lastStroke() {
                return this.strokes[this.strokes.length - 1] || null;
            },
            summary() {
                const byLabel = {};
                for (const stroke of this.strokes) {
                    const key = stroke.label || 'unlabeled';
                    if (!byLabel[key]) {
                        byLabel[key] = {
                            count: 0,
                            events: 0,
                            points: 0,
                            interpolatedPoints: 0,
                            realtimeSegments: 0,
                            coalescedEvents: 0,
                            coalescedSamples: 0
                        };
                    }
                    byLabel[key].count++;
                    byLabel[key].events += stroke.events || 0;
                    byLabel[key].points += stroke.details?.pointCount || 0;
                    byLabel[key].interpolatedPoints += stroke.interpolatedPoints || 0;
                    byLabel[key].realtimeSegments += stroke.realtimeSegments || 0;
                }

                for (const event of this.events) {
                    const key = event.label || 'unlabeled';
                    if (!byLabel[key]) {
                        byLabel[key] = {
                            count: 0,
                            events: 0,
                            points: 0,
                            interpolatedPoints: 0,
                            realtimeSegments: 0,
                            coalescedEvents: 0,
                            coalescedSamples: 0
                        };
                    }
                    const count = event.input?.coalesced?.count || 0;
                    if (count > 0) {
                        byLabel[key].coalescedEvents++;
                        byLabel[key].coalescedSamples += count;
                    }
                }

                return {
                    enabled: this.isEnabled(),
                    label: this.label,
                    eventCount: this.events.length,
                    strokeCount: this.strokes.length,
                    perfCount: this.perf.length,
                    longTaskCount: this.longTasks.length,
                    recentLongTasks: this.getRecentLongTasks(),
                    byLabel
                };
            }
        };

        window.TegakiStrokeInputProfiler = store;
        if (store.isEnabled()) {
            store.startLongTaskObserver();
        }
        return store;
    }
    
    cancelStroke() {
        if (!this.isDrawing) return;
        
        if (this.previewGraphics && this.previewGraphics.parent) {
            this.previewGraphics.parent.removeChild(this.previewGraphics);
            this.previewGraphics.destroy();
            this.previewGraphics = null;
        }
        
        this.isDrawing = false;
        this.realtimeEraserApplied = false;
        this.realtimePenApplied = false;
        this.realtimeAirbrushApplied = false;
        this.realtimeBlurApplied = false;
        this._cleanupAirbrushStroke();
        this._cleanupPenOpacityStroke();
        this._cleanupBlurStroke();
        this.strokeHistoryBefore = null;
        this.strokeSelectionBefore = null;
        this.strokeHistoryGpuBaseline = null;
        this.strokeTargetLayer = null;
        this.strokeInputProfile = null;
        this.realtimeBatchQueue = null;
        this.realtimeBatchDepth = 0;
        this.realtimeBatchMode = null;
        this.curveControlPoints = null;
        this.lastClientX = null;
        this.lastClientY = null;
        
        if (this.eventBus) {
            this.eventBus.emit('drawing:stroke-cancelled', {
                component: 'drawing',
                action: 'stroke-cancelled',
                data: {}
            });
        }
    }
    
    isActive() {
        return this.isDrawing;
    }
}

export const brushCore = new BrushCore();

// 下位互換性のためにグローバルに登録
window.BrushCore = brushCore;
