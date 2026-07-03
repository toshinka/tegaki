/**
 * ============================================================================
 * ファイル名: system/drawing/brush-core.js
 * 責務: ストローク（ペン・消しゴム・塗りつぶし）の開始・更新・完了とクリッピング中のプレビュー表示を統括する
 * 依存: event-bus.js, coordinate-system.js, stroke-recorder.js, stroke-renderer.js, layer-system.js, brush-settings.js, pixi.js
 * 被依存: core-engine.js, core-runtime.js等
 * 公開API: BrushCore, brushCore
 * イベント発火: drawing:stroke-started, drawing:stroke-updated, drawing:stroke-completed, drawing:stroke-cancelled, layer:path-added, thumbnail:layer-updated
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

import { Graphics, Container, Sprite, RenderTexture } from 'pixi.js';
import { TegakiEventBus } from '../event-bus.js';
import { coordinateSystem } from '../../coordinate-system.js';
import { historyManager } from '../history.js';
import { isInverseClipping } from '../clipping-mode.js';

export class BrushCore {
    constructor() {
        this.isDrawing = false;
        this.currentStrokeId = null;
        this.lastLocalX = 0;
        this.lastLocalY = 0;
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
        const needsHistorySnapshot = activeLayer.layerData?.isAnimationWorkingLayer !== true;
        const needsSelectionSnapshot = this._needsSelectionSnapshotForLayer(activeLayer);
        let beforeSnapshot = null;
        if (needsHistorySnapshot || needsSelectionSnapshot) {
            const snapshotStart = this._perfNow();
            beforeSnapshot = this.layerManager.createLayerRasterSnapshot?.(activeLayer) || null;
            this._warnPerf('brush.startStroke.beforeSnapshot', snapshotStart, {
                needsHistorySnapshot,
                needsSelectionSnapshot
            });
        }
        this.strokeHistoryBefore = needsHistorySnapshot ? beforeSnapshot : null;
        this.strokeSelectionBefore = beforeSnapshot;

        const settings = this._getCurrentSettings();
        this._ensureLayerRasterFrameForStroke(activeLayer, settings, currentMode);
        const { canvasX, canvasY } = this.coordinateSystem.screenClientToCanvas(clientX, clientY);
        const { worldX, worldY } = this.coordinateSystem.canvasToWorld(canvasX, canvasY);
        const { localX, localY } = this.coordinateSystem.worldToLocal(worldX, worldY, activeLayer);

        if (currentMode === 'airbrush' || currentMode === 'airbrush-erase') {
            this._beginAirbrushStroke(activeLayer, settings);
        } else {
            this._cleanupAirbrushStroke();
        }

        if (this._shouldUsePenOpacityIsolation(currentMode, settings)) {
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
                    penRenderMissingTarget: 0,
                    penRenderMissingGraphics: 0,
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
        this.lastLocalX = localX;
        this.lastLocalY = localY;
        this.lastPressure = processedPressure;
        this.lastRenderedLocalX = localX;
        this.lastRenderedLocalY = localY;
        this.lastRenderedPressure = processedPressure;

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
        const emitStrokeStartedBeforePreview = activeLayer.layerData?.isAnimationWorkingLayer === true;
        if (emitStrokeStartedBeforePreview) {
            this.eventBus?.emit('drawing:stroke-started', strokeStartedPayload);
        }

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

        if (this.eventBus && !emitStrokeStartedBeforePreview) {
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
        const processedPressure = pressureEnabled
            ? this._stabilizeMovePressure(pressure, currentMode, pointerType)
            : 1.0;

        // カメラ縮小時は1つの画面移動が大きなlocal距離になるため、記録とライブ表示の両方を細かく補間する。
        const interpolationStep = currentMode === 'lasso-fill' ? 5 : 1; // 投げ縄は少し粗めで良い
        const steps = Math.max(1, Math.floor(distance / interpolationStep));
        const pointsBeforeEvent = this.strokeRecorder.getCurrentPoints().length;
        let generatedPoints = 0;

        for (let i = 1; i <= steps; i++) {
            const t = i / (steps + 1);
            const interpX = this.lastLocalX + dx * t;
            const interpY = this.lastLocalY + dy * t;
            const interpPressure = this.lastPressure + (processedPressure - this.lastPressure) * t;

            this._renderRealtimeStrokePoint(currentMode, interpX, interpY, interpPressure);
            this.strokeRecorder.addPoint(interpX, interpY, interpPressure);
            generatedPoints++;
        }

        this._renderRealtimeStrokePoint(currentMode, localX, localY, processedPressure);
        this.strokeRecorder.addPoint(localX, localY, processedPressure);
        generatedPoints++;

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

        if (this.eventBus && activeLayer.layerData?.isAnimationWorkingLayer === true) {
            this.eventBus.emit('drawing:stroke-updated', {
                component: 'drawing',
                action: 'stroke-updated',
                data: {
                    mode: currentMode,
                    layerId: activeLayer.layerData?.id,
                    realtimeApplied: this._hasRealtimeApplied(currentMode),
                    pointCount: this.strokeRecorder.getCurrentPoints().length
                }
            });
        }

        this._logInputProfile('move', inputProfile, {
            mode: currentMode,
            pointerType,
            processedPressure,
            recorder: this.strokeRecorder.getCurrentStats?.() || null,
            interpolation: {
                distance: Number(distance.toFixed(3)),
                step: interpolationStep,
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

    updateStrokeBatch(infos, inputProfile = null) {
        if (!this.isDrawing || !Array.isArray(infos) || infos.length === 0) return;
        if (this.strokeInputProfile?.realtime) {
            this.strokeInputProfile.realtime.batchCalls++;
        }

        const perfStart = this._perfNow();
        const mode = this.getMode();
        infos.forEach((info, index) => {
            if (!info) return;
            const isLast = index === infos.length - 1;
            this.updateStroke(
                info.clientX,
                info.clientY,
                info.pressure,
                info.pointerType,
                isLast ? (inputProfile || info.inputProfile) : null
            );
        });
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
        const segmentPoints = distance <= 0
            ? [{ x: localX, y: localY, pressure }]
            : [
                { x: this.lastRenderedLocalX, y: this.lastRenderedLocalY, pressure: this.lastRenderedPressure },
                { x: localX, y: localY, pressure: renderPressure }
              ];

        if (mode === 'eraser') {
            if (distance <= 0) return;
            this._renderRealtimeEraserSegment(segmentPoints);
            this.realtimeEraserApplied = true;
        } else if (mode === 'pen') {
            if (distance <= 0) return;
            this._renderRealtimePenSegment(segmentPoints);
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
        if (this.strokeInputProfile) {
            this.strokeInputProfile.realtimeSegments++;
        }
    }

    _ensureLayerRasterFrameForStroke(activeLayer, settings, mode) {
        if (!activeLayer?.layerData?.renderTexture) return;
        if (!['pen', 'eraser', 'airbrush', 'airbrush-erase', 'blur'].includes(mode)) return;
        if (typeof this.layerManager?.ensureLayerRasterBoundsForRect !== 'function') return;

        const canvasConfig = this.layerManager.config?.canvas || window.TEGAKI_CONFIG?.canvas || {};
        const width = Math.max(
            1,
            Math.round(Number(canvasConfig.width || this.layerManager.canvasWidth || activeLayer.layerData.renderTexture.width || 1))
        );
        const height = Math.max(
            1,
            Math.round(Number(canvasConfig.height || this.layerManager.canvasHeight || activeLayer.layerData.renderTexture.height || 1))
        );
        const padding = Math.ceil(Math.max(4, Number(settings?.size ?? 1) * 2));

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
     * [指示書] 消しゴムのリアルタイム反映用：短いセグメントを直接 RenderTexture に焼き込む
     */
    _renderRealtimeEraserSegment(points) {
        const activeLayer = this.strokeTargetLayer || this.layerManager.getActiveLayer();
        if (!activeLayer || !activeLayer.layerData?.renderTexture) return;

        const settings = this._getCurrentSettings();
        const perfStart = this._perfNow();

        // [指示書] 消しゴム用の実描画 Graphics を作る API を使用
        const graphics = this.strokeRenderer.renderEraserSegment(points, settings);

        if (graphics && this.layerManager.app?.renderer) {
            const renderContainer = new Container();
            renderContainer.addChild(graphics);
            renderContainer.blendMode = 'erase';
            this._applyLayerRasterRenderOffset(activeLayer, renderContainer);

            this.layerManager.app.renderer.render({
                container: renderContainer,
                target: activeLayer.layerData.renderTexture,
                clear: false
            });

            renderContainer.destroy({ children: true, texture: true, baseTexture: true });
            this._requestLiveCanvasRender('realtime-eraser');
        }
        this._warnPerf('brush.renderRealtimeEraserSegment', perfStart, {
            points: points?.length || 0
        });
    }

    /**
     * [指示書] ペンのリアルタイム反映用：短いセグメントを直接 RenderTexture に焼き込む
     */
    _renderRealtimePenSegment(points) {
        const activeLayer = this.penOpacityState?.targetLayer || this.strokeTargetLayer || this.layerManager.getActiveLayer();
        if (!activeLayer || !activeLayer.layerData?.renderTexture) {
            this._recordRealtimePenRenderDebug('missing-target');
            return;
        }

        const settings = this._getCurrentSettings();
        const renderTarget = this.penOpacityState?.texture || activeLayer.layerData.renderTexture;
        const renderSettings = this.penOpacityState
            ? { ...settings, opacity: 1.0 }
            : settings;
        const perfStart = this._perfNow();

        // [指示書] ペン用の実描画 Graphics を作る API を使用
        const graphics = this.strokeRenderer.renderPenSegment(points, renderSettings);

        if (graphics && this.layerManager.app?.renderer) {
            const renderContainer = new Container();
            renderContainer.addChild(graphics);
            this._applyLayerRasterRenderOffset(activeLayer, renderContainer);

            this.layerManager.app.renderer.render({
                container: renderContainer,
                target: renderTarget,
                clear: false
            });

            renderContainer.destroy({ children: true, texture: true, baseTexture: true });
            this._recordRealtimePenRenderDebug('rendered');
            this._requestLiveCanvasRender(this.penOpacityState ? 'realtime-pen-preview' : 'realtime-pen');
        } else {
            this._recordRealtimePenRenderDebug('missing-graphics');
        }
        this._warnPerf('brush.renderRealtimePenSegment', perfStart, {
            points: points?.length || 0,
            penOpacityIsolation: this.penOpacityState !== null
        });
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
        previewSprite.blendMode = 'normal';
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
        const settings = this._getCurrentSettings();
        const maskSettings = {
            ...settings,
            color: 0xffffff,
            mode: 'airbrush'
        };
        const renderContainer = this.strokeRenderer.renderAirbrushSegment(
            points,
            maskSettings,
            this.airbrushState.spacingState
        );

        if (renderContainer && this.layerManager.app?.renderer) {
            this._applyLayerRasterRenderOffset(this.airbrushState.targetLayer, renderContainer);
            this.layerManager.app.renderer.render({
                container: renderContainer,
                target: this.airbrushState.maskTexture,
                clear: false
            });

            // cached texture を破棄しないため texture/baseTexture は指定しない。
            renderContainer.destroy({ children: true });
            this._requestLiveCanvasRender('realtime-airbrush');
        }
        this._warnPerf('brush.renderRealtimeAirbrushSegment', perfStart, {
            points: points?.length || 0
        });
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
        const maskTexture = RenderTexture.create({
            width,
            height,
            resolution: 1
        });
        const empty = new Container();
        this.layerManager.app.renderer.render({
            container: empty,
            target: maskTexture,
            clear: true,
            clearColor: [0, 0, 0, 0]
        });
        empty.destroy();
        const previewSprite = new Sprite(maskTexture);
        previewSprite.label = 'airbrushStrokePreview';
        previewSprite.tint = settings.mode === 'airbrush-erase'
            ? 0xffffff
            : (settings.color ?? 0x800000);
        previewSprite.blendMode = settings.mode === 'airbrush-erase' ? 'erase' : 'normal';
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
        this.airbrushState = {
            targetLayer: activeLayer,
            maskTexture,
            previewSprite,
            spacingState: {},
            mode: settings.mode,
            color: settings.color ?? 0x800000
        };
        this._requestLiveCanvasRender('airbrush-preview-start');
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
        commitSprite.tint = state.mode === 'airbrush-erase'
            ? 0xffffff
            : state.color;
        commitSprite.blendMode = state.mode === 'airbrush-erase' ? 'erase' : 'normal';

        renderer.render({
            container: commitSprite,
            target,
            clear: false
        });
        commitSprite.destroy({ texture: false, baseTexture: false });
        this._requestLiveCanvasRender('airbrush-commit');
        return true;
    }

    _cleanupAirbrushStroke() {
        const state = this.airbrushState;
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

        const activeLayer = this.airbrushState?.targetLayer
            || this.penOpacityState?.targetLayer
            || this.strokeTargetLayer
            || this.layerManager.getActiveLayer();
        if (!activeLayer) return;

        this._appendFinalPointerSample(finalPointer, inputProfile);

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
            // 履歴用のデータ保存
            if (!layerData.pathsData) {
                layerData.pathsData = [];
            }

            const pathData = {
                id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                points: strokeData.points,
                tool: mode,
                settings: { ...settings },
                isBaked: true
            };

            layerData.pathsData.push(pathData);
        }

        window.CoreRuntime?.api?.selection?.constrainLayer?.(
            activeLayer,
            this.strokeSelectionBefore
        );
        this._recordStrokeHistory(activeLayer, mode);

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
                immediate: true
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
        this.strokeTargetLayer = null;
        this._logStrokeFinalizeProfile({
            mode,
            pointCount: strokeData.points.length,
            duration: strokeData.duration,
            realtimeApplied: alreadyApplied,
            finalBakeRendered: shouldBakeFinal,
            penOpacityIsolation: penOpacityIsolationUsed,
            shortStrokeStabilized: this.strokeInputProfile?.shortStrokeStabilized || null,
            recorder: this.strokeRecorder._summarizePoints?.(strokeData.points) || null,
            realtime: this._getRealtimeDebugSummary(mode, alreadyApplied, shouldBakeFinal)
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

    _recordStrokeHistory(layer, mode) {
        const beforeSnapshot = this.strokeHistoryBefore;
        if (!beforeSnapshot || !historyManager || historyManager.isApplying) return;
        if (!this.layerManager?.createLayerRasterSnapshot || !this.layerManager?.restoreLayerRasterSnapshot) return;
        if (layer?.layerData?.isAnimationWorkingLayer === true) return;

        const snapshotStart = this._perfNow();
        const afterSnapshot = this.layerManager.createLayerRasterSnapshot(layer);
        this._warnPerf('brush.recordStrokeHistory.afterSnapshot', snapshotStart, {
            mode
        });
        if (!afterSnapshot) return;

        const layerId = layer.layerData?.id;
        const layerIndex = this.layerManager.getLayerIndex(layer);

        const recordStart = this._perfNow();
        historyManager.record({
            name: `draw-${mode}`,
            do: () => {
                this.layerManager.restoreLayerRasterSnapshot(afterSnapshot);
            },
            undo: () => {
                this.layerManager.restoreLayerRasterSnapshot(beforeSnapshot);
            },
            meta: {
                type: 'draw',
                mode,
                layerId,
                layerIndex,
                pointCount: afterSnapshot.pathsData?.length || 0
            },
            byteSize: (beforeSnapshot.pixels?.byteLength || 0)
                + (afterSnapshot.pixels?.byteLength || 0)
        });
        this._warnPerf('brush.recordStrokeHistory.record', recordStart, {
            mode,
            byteSize: (beforeSnapshot.pixels?.byteLength || 0)
                + (afterSnapshot.pixels?.byteLength || 0)
        });
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
            penRenderMissingTarget: realtime.penRenderMissingTarget || 0,
            penRenderMissingGraphics: realtime.penRenderMissingGraphics || 0,
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
            label: null,
            maxEvents: 2000,
            maxStrokes: 200,
            maxPerf: 500,
            setEnabled(enabled = true) {
                if (window.TEGAKI_CONFIG) {
                    window.TEGAKI_CONFIG.debug = enabled === true;
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
                return this.summary();
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
                    byLabel
                };
            }
        };

        window.TegakiStrokeInputProfiler = store;
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
        this.strokeTargetLayer = null;
        this.strokeInputProfile = null;
        
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
