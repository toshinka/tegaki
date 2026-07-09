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
        this.strokeInputProfiler = this._ensureStrokeInputProfiler();
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
        const beforeSnapshot = this.layerManager.createLayerRasterSnapshot?.(activeLayer) || null;
        this.strokeHistoryBefore = activeLayer.layerData?.isAnimationWorkingLayer === true
            ? null
            : beforeSnapshot;
        this.strokeSelectionBefore = beforeSnapshot;

        const { canvasX, canvasY } = this.coordinateSystem.screenClientToCanvas(clientX, clientY);
        const { worldX, worldY } = this.coordinateSystem.canvasToWorld(canvasX, canvasY);
        const { localX, localY } = this.coordinateSystem.worldToLocal(worldX, worldY, activeLayer);

        const settings = this._getCurrentSettings();
        this._ensureLayerRasterFrameForStroke(activeLayer, settings, currentMode);
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
                realtimeSegments: 0
            }
            : null;

        this.isDrawing = true;
        this.lastLocalX = localX;
        this.lastLocalY = localY;
        this.lastPressure = processedPressure;
        this.lastRenderedLocalX = localX;
        this.lastRenderedLocalY = localY;
        this.lastRenderedPressure = processedPressure;

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
            this.eventBus.emit('drawing:stroke-started', {
                component: 'drawing',
                action: 'stroke-started',
                data: {
                    mode: currentMode,
                    layerId: activeLayer.layerData?.id,
                    localX,
                    localY,
                    pressure: processedPressure
                }
            });
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

        const activeLayer = this.layerManager.getActiveLayer();
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
        const processedPressure = pressureEnabled ? Math.max(0.0, pressure ?? 0.0) : 1.0;

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

            this._renderRealtimeSegmentIfNeeded(currentMode, interpX, interpY, interpPressure);
            this.strokeRecorder.addPoint(interpX, interpY, interpPressure);
            generatedPoints++;
        }

        this._renderRealtimeSegmentIfNeeded(currentMode, localX, localY, processedPressure);
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
        const dx = localX - this.lastRenderedLocalX;
        const dy = localY - this.lastRenderedLocalY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (!force && distance <= 0.5) return;

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

    /**
     * [指示書] 消しゴムのリアルタイム反映用：短いセグメントを直接 RenderTexture に焼き込む
     */
    _renderRealtimeEraserSegment(points) {
        const activeLayer = this.layerManager.getActiveLayer();
        if (!activeLayer || !activeLayer.layerData?.renderTexture) return;

        const settings = this._getCurrentSettings();

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
        }
    }

    /**
     * [指示書] ペンのリアルタイム反映用：短いセグメントを直接 RenderTexture に焼き込む
     */
    _renderRealtimePenSegment(points) {
        const activeLayer = this.penOpacityState?.targetLayer || this.layerManager.getActiveLayer();
        if (!activeLayer || !activeLayer.layerData?.renderTexture) return;

        const settings = this._getCurrentSettings();
        const renderTarget = this.penOpacityState?.texture || activeLayer.layerData.renderTexture;
        const renderSettings = this.penOpacityState
            ? { ...settings, opacity: 1.0 }
            : settings;

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
        }
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
        const activeLayer = this.layerManager.getActiveLayer();
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
        }
    }

    _cleanupBlurStroke() {
        if (this.blurState?.sourceTexture) {
            this.blurState.sourceTexture.destroy(true);
        }
        this.blurState = null;
    }

    async finalizeStroke(inputProfile = null) {
        if (!this.isDrawing) return;

        const activeLayer = this.airbrushState?.targetLayer
            || this.penOpacityState?.targetLayer
            || this.layerManager.getActiveLayer();
        if (!activeLayer) return;

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
                }
            } else if (!layerData?.renderTexture) {
                // フォールバック: 従来通り子要素として追加
                activeLayer.addChild(graphics);
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
        this._logStrokeFinalizeProfile({
            mode,
            pointCount: strokeData.points.length,
            duration: strokeData.duration,
            realtimeApplied: alreadyApplied,
            finalBakeRendered: shouldBakeFinal,
            penOpacityIsolation: penOpacityIsolationUsed,
            shortStrokeStabilized: this.strokeInputProfile?.shortStrokeStabilized || null,
            recorder: this.strokeRecorder._summarizePoints?.(strokeData.points) || null
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

        const afterSnapshot = this.layerManager.createLayerRasterSnapshot(layer);
        if (!afterSnapshot) return;

        const layerId = layer.layerData?.id;
        const layerIndex = this.layerManager.getLayerIndex(layer);

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
    }

    _hasRealtimeApplied(mode) {
        return (
            (mode === 'eraser' && this.realtimeEraserApplied) ||
            (mode === 'pen' && this.realtimePenApplied) ||
            ((mode === 'airbrush' || mode === 'airbrush-erase') && this.realtimeAirbrushApplied) ||
            (mode === 'blur' && this.realtimeBlurApplied)
        );
    }

    _logInputProfile(stage, inputProfile, details = {}) {
        if (!window.TEGAKI_CONFIG?.debug || !inputProfile) {
            return;
        }

        console.info('[StrokeInputProfile] event', {
            strokeId: this.strokeInputProfile?.id ?? null,
            stage,
            input: inputProfile,
            details
        });
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
            label: null,
            maxEvents: 2000,
            maxStrokes: 200,
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
            getEvents() {
                return this.events.map(entry => ({ ...entry }));
            },
            getStrokes() {
                return this.strokes.map(entry => ({ ...entry }));
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
