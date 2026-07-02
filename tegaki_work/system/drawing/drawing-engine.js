/**
 * ============================================================================
 * ファイル名: system/drawing/drawing-engine.js
 * 責務: PointerEventの処理と描画パイプラインの統括を担当する
 * 依存: system/drawing/brush-core.js, coordinate-system.js, system/event-bus.js, system/drawing/pointer-handler.js
 * 被依存: core-engine.js, core-runtime.js等
 * 公開API: DrawingEngine
 * イベント発火: canvas:pointerdown, ui:drawing-completed
 * イベント受信: なし
 * グローバル登録: window.DrawingEngine
 * 実装状態: ✅完成/整備
 * ============================================================================
 */

import { brushCore } from './brush-core.js';
import { coordinateSystem } from '../../coordinate-system.js';
import { TegakiEventBus } from '../event-bus.js';
import { PointerHandler } from './pointer-handler.js';

export class DrawingEngine {
    constructor(app, layerSystem, cameraSystem, history) {
        this.app = app;
        this.layerSystem = layerSystem;
        this.cameraSystem = cameraSystem;
        this.history = history;
        this.config = window.TEGAKI_CONFIG;

        this.brushCore = brushCore;
        this.brushSettings = null;
        this.strokeRenderer = window.strokeRenderer || null;
        
        this.pointerDetach = null;
        this.coordSystem = coordinateSystem;
        this.eventBus = TegakiEventBus;
        this.activePointers = new Map();
        this.currentToolOverride = null;
        
        this._setupToolModeListeners();
        this._initializeCanvas();
    }

    _setupToolModeListeners() {
        if (!this.eventBus) return;

        const syncTool = (payload = {}) => {
            const tool = payload.tool || payload.mode || payload.data?.tool || payload.data?.mode;
            if (tool) this.currentToolOverride = tool;
        };

        this.eventBus.on('brush:mode-changed', syncTool);
        this.eventBus.on('tool:changed', syncTool);
        this.eventBus.on('tool:select', syncTool);
        this.eventBus.on('ui:sidebar:sync-tool', syncTool);
    }

    _initializeCanvas() {
        const canvas = this.app.canvas || this.app.view;
        if (!canvas) {
            console.error('❌ [DrawingEngine] Canvas not found');
            return;
        }
        this.canvas = canvas;

        canvas.style.touchAction = 'none';

        if (!window.PointerHandler) {
            console.error('❌ [DrawingEngine] window.PointerHandler not available!');
            return;
        }

        this.pointerDetach = window.PointerHandler.attach(canvas, {
            down: this._handlePointerDown.bind(this),
            move: this._handlePointerMove.bind(this),
            moveBatch: this._handlePointerMoveBatch.bind(this),
            up: this._handlePointerUp.bind(this),
            cancel: this._handlePointerCancel.bind(this)
        }, {
            preventDefault: true
        });

        // マウス移動（ホバー・描画時両方）の座標をステータスバーに通知
        this._onCanvasPointerMove = (e) => {
            if (this.coordSystem) {
                const world = this.coordSystem.screenClientToWorld(e.clientX, e.clientY);
                if (isFinite(world.worldX) && isFinite(world.worldY)) {
                    this.eventBus.emit('ui:mouse-move', {
                        x: Math.round(world.worldX),
                        y: Math.round(world.worldY)
                    });
                }
            }
        };
        canvas.addEventListener('pointermove', this._onCanvasPointerMove);
    }

    _handlePointerDown(info, e) {
        if (window.pixelSelectionSystem?.isToolActive?.()) {
            return;
        }

        // [指示書] 全入力の入口ログ
        if (window.TEGAKI_CONFIG?.debug) {
            console.log('[DrawingEngine] down gate', JSON.stringify({
                pointerType: info.pointerType,
                button: info.button,
                buttons: info.buttons,
                pressure: info.pressure,
                canvasMove: this.cameraSystem?.isCanvasMoveMode?.(),
                vKey: this.layerSystem?.vKeyPressed,
                selectionTransform: this._isSelectionTransformActive()
            }));

            if (info.pointerType === 'pen') {
                console.log('[DrawingEngine] Pen Down:', {
                    pointerType: info.pointerType,
                    vKey: this.layerSystem?.vKeyPressed,
                    selectionTransform: this._isSelectionTransformActive(),
                    canvasMove: this.cameraSystem?.isCanvasMoveMode?.(),
                    activeLayer: this.layerSystem?.getActiveLayer?.()?.layerData?.name,
                    button: info.button
                });
            }
        }

        if (this.cameraSystem?.isCanvasMoveMode()) {
            if (window.TEGAKI_CONFIG?.debug && info.pointerType === 'pen') console.log('[DrawingEngine] Blocked: CanvasMoveMode');
            return;
        }

        if (this._isTransformModeActive()) {
            if (window.TEGAKI_CONFIG?.debug && info.pointerType === 'pen') console.log('[DrawingEngine] Blocked: TransformMode');
            return;
        }

        const isSecondaryButton = info.button === 2 && info.pointerType !== 'pen';
        if (isSecondaryButton) {
            return;
        }

        const currentMode = this._getCurrentMode();

        if (currentMode === 'eyedropper') {
            const sampleCoords = this._screenToWorld(info.clientX, info.clientY);
            if (sampleCoords && this.eventBus) {
                this.eventBus.emit('canvas:pointerdown', {
                    localX: sampleCoords.worldX,
                    localY: sampleCoords.worldY,
                    clientX: info.clientX,
                    clientY: info.clientY,
                    pressure: info.pressure,
                    pointerType: info.pointerType
                });
            }
            return;
        }

        const localCoords = this._screenToLocal(info.clientX, info.clientY);
        if (!localCoords) {
            if (window.TEGAKI_CONFIG?.debug && info.pointerType === 'pen') {
                console.log('[DrawingEngine] Blocked: No localCoords');
            }
            return;
        }

        this._attachInputProfileLocal(info, localCoords);

        if (currentMode !== 'fill' && currentMode !== 'eraser-fill' && currentMode !== 'lasso-fill') {
            this.eventBus?.emit('drawing:before-stroke-start', {
                clientX: info.clientX,
                clientY: info.clientY,
                pressure: info.pressure,
                pointerType: info.pointerType,
                mode: currentMode
            });
        }

        const activeLayer = this.layerSystem?.getActiveLayer?.();
        const activeData = activeLayer?.layerData;
        if (!activeData || activeData.isBackground || activeData.isFolder || !activeData.renderTexture) {
            return;
        }
        
        if (currentMode === 'fill' || currentMode === 'eraser-fill') {
            if (this.eventBus) {
                this.eventBus.emit('canvas:pointerdown', {
                    localX: localCoords.localX,
                    localY: localCoords.localY,
                    clientX: info.clientX,
                    clientY: info.clientY,
                    pressure: info.pressure,
                    pointerType: info.pointerType
                });
            }
            return;
        }

        this.activePointers.set(info.pointerId, {
            type: info.pointerType || 'unknown',
            isDrawing: true
        });

        if (this.brushCore && this.brushCore.startStroke) {
            this.brushCore.startStroke(
                info.clientX,
                info.clientY,
                info.pressure,
                info.pointerType,
                info.inputProfile
            );
        }
    }

    _isSelectionTransformActive() {
        return window.CoreRuntime?.api?.selection?.getState?.()?.transformSessionActive === true
            || window.pixelSelectionSystem?.getState?.()?.transformSessionActive === true;
    }

    _isTransformModeActive() {
        return this.layerSystem?.vKeyPressed === true || this._isSelectionTransformActive();
    }

    _getCurrentMode() {
        if (this.currentToolOverride === 'eyedropper') {
            return 'eyedropper';
        }
        return this.brushCore?.getMode?.() || window.brushSettings?.getMode?.() || this.currentToolOverride || 'pen';
    }

    _handlePointerMove(info, e) {
        // [指示書 v5 一時診断] pointerup後のmove検知
        /*
        if (!this.isDrawing) {
            console.log('[DrawingEngine] move while NOT drawing', JSON.stringify({
                pointerType: info.pointerType,
                pressure: info.pressure,
                buttons: info.buttons
            }));
        }
        */

        const pointerInfo = this.activePointers.get(info.pointerId);
        if (!pointerInfo || !pointerInfo.isDrawing) {
            return;
        }

        if (!this.brushCore || !this.brushCore.isActive || !this.brushCore.isActive()) {
            return;
        }

        if (this.brushCore.updateStroke) {
            if (window.TEGAKI_CONFIG?.debug) {
                this._attachInputProfileLocal(info, this._screenToLocal(info.clientX, info.clientY));
            }
            this.brushCore.updateStroke(
                info.clientX,
                info.clientY,
                info.pressure,
                info.pointerType,
                info.inputProfile
            );
        }
    }

    _handlePointerMoveBatch(infos, e) {
        if (!Array.isArray(infos) || infos.length === 0) return;

        const lastInfo = infos[infos.length - 1];
        const pointerInfo = this.activePointers.get(lastInfo.pointerId);
        if (!pointerInfo || !pointerInfo.isDrawing) {
            return;
        }

        if (!this.brushCore || !this.brushCore.isActive || !this.brushCore.isActive()) {
            return;
        }

        if (window.TEGAKI_CONFIG?.debug) {
            const local = this._screenToLocal(lastInfo.clientX, lastInfo.clientY);
            this._attachInputProfileLocal(lastInfo, local);
            lastInfo.inputProfile.coalescedBatchCount = infos.length;
        }

        if (this.brushCore.updateStrokeBatch) {
            this.brushCore.updateStrokeBatch(infos, lastInfo.inputProfile);
            return;
        }

        infos.forEach(info => this._handlePointerMove(info, e));
    }

    _handlePointerUp(info, e) {
        const pointerInfo = this.activePointers.get(info.pointerId);
        if (!pointerInfo) {
            return;
        }

        if (this.brushCore && this.brushCore.isActive && this.brushCore.isActive()) {
            if (this.brushCore.finalizeStroke) {
                if (window.TEGAKI_CONFIG?.debug) {
                    this._attachInputProfileLocal(info, this._screenToLocal(info.clientX, info.clientY));
                }
                this.brushCore.finalizeStroke(info.inputProfile, info);
            }
        }

        this.activePointers.delete(info.pointerId);
    }

    _handlePointerCancel(info, e) {
        const pointerInfo = this.activePointers.get(info.pointerId);
        if (!pointerInfo) {
            return;
        }

        if (this.brushCore && this.brushCore.cancelStroke) {
            this.brushCore.cancelStroke();
        }

        this.activePointers.delete(info.pointerId);
    }

    _screenToLocal(clientX, clientY) {
        if (!this.coordSystem) {
            return null;
        }

        const activeLayer = this.layerSystem.getActiveLayer();
        if (!activeLayer) {
            return null;
        }

        const canvasCoords = this.coordSystem.screenClientToCanvas(clientX, clientY);
        if (!canvasCoords || canvasCoords.canvasX === undefined) {
            return null;
        }

        const worldCoords = this.coordSystem.canvasToWorld(canvasCoords.canvasX, canvasCoords.canvasY);
        if (!worldCoords || worldCoords.worldX === undefined) {
            return null;
        }

        const localCoords = this.coordSystem.worldToLocal(
            worldCoords.worldX,
            worldCoords.worldY,
            activeLayer
        );
        
        if (!localCoords || localCoords.localX === undefined || localCoords.localY === undefined) {
            return null;
        }

        if (isNaN(localCoords.localX) || isNaN(localCoords.localY)) {
            return null;
        }

        return {
            localX: localCoords.localX,
            localY: localCoords.localY
        };
    }

    _screenToWorld(clientX, clientY) {
        if (!this.coordSystem) {
            return null;
        }

        const canvasCoords = this.coordSystem.screenClientToCanvas(clientX, clientY);
        if (!canvasCoords || canvasCoords.canvasX === undefined) {
            return null;
        }

        const worldCoords = this.coordSystem.canvasToWorld(canvasCoords.canvasX, canvasCoords.canvasY);
        if (!worldCoords || worldCoords.worldX === undefined || worldCoords.worldY === undefined) {
            return null;
        }

        return worldCoords;
    }

    _attachInputProfileLocal(info, localCoords) {
        if (!window.TEGAKI_CONFIG?.debug || !info?.inputProfile || !localCoords) {
            return;
        }

        info.inputProfile.local = {
            x: Number(localCoords.localX.toFixed(3)),
            y: Number(localCoords.localY.toFixed(3))
        };
        info.inputProfile.coalesced.local = this._summarizeCoalescedLocal(info.originalEvent);
    }

    _summarizeCoalescedLocal(event) {
        if (typeof event?.getCoalescedEvents !== 'function') {
            return {
                supported: false,
                count: 0,
                localX: { min: null, max: null, delta: null },
                localY: { min: null, max: null, delta: null }
            };
        }

        let events = [];
        try {
            events = event.getCoalescedEvents() || [];
        } catch (err) {
            events = [];
        }

        const localPoints = events
            .map(item => this._screenToLocal(item.clientX, item.clientY))
            .filter(point => point && Number.isFinite(point.localX) && Number.isFinite(point.localY));

        const summarize = (values) => {
            if (!values.length) {
                return { min: null, max: null, delta: null };
            }
            const min = Math.min(...values);
            const max = Math.max(...values);
            return {
                min: Number(min.toFixed(3)),
                max: Number(max.toFixed(3)),
                delta: Number((max - min).toFixed(3))
            };
        };

        return {
            supported: true,
            count: events.length,
            validLocalCount: localPoints.length,
            localX: summarize(localPoints.map(point => point.localX)),
            localY: summarize(localPoints.map(point => point.localY)),
            samples: localPoints.length <= 4
                ? localPoints.map(point => ({
                    x: Number(point.localX.toFixed(3)),
                    y: Number(point.localY.toFixed(3))
                }))
                : [
                    localPoints[0],
                    localPoints[1],
                    localPoints[localPoints.length - 2],
                    localPoints[localPoints.length - 1]
                ].map(point => ({
                    x: Number(point.localX.toFixed(3)),
                    y: Number(point.localY.toFixed(3))
                }))
        };
    }

    setBrushSettings(settings) {
        this.brushSettings = settings;
    }

    setStrokeRenderer(renderer) {
        this.strokeRenderer = renderer;
    }

    get isDrawing() {
        return this.brushCore && this.brushCore.isActive ? this.brushCore.isActive() : false;
    }

    destroy() {
        if (this.pointerDetach) {
            this.pointerDetach();
            this.pointerDetach = null;
        }
        if (this.canvas && this._onCanvasPointerMove) {
            this.canvas.removeEventListener('pointermove', this._onCanvasPointerMove);
        }
        this.activePointers.clear();
    }
}

// 下位互換性のためにグローバルに登録
window.DrawingEngine = DrawingEngine;
