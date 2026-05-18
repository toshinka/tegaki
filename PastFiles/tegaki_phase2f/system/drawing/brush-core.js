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
 * ============================================================================
 */

import { Graphics, Container } from 'pixi.js';
import { TegakiEventBus } from '../event-bus.js';
import { coordinateSystem } from '../../coordinate-system.js';
import { historyManager } from '../history.js';

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
        this.strokeHistoryBefore = null;
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
        
        this.eventBus.on('brush:mode-changed', (data) => {
            if (data && data.mode) {
                if (this.strokeRenderer && this.strokeRenderer.setTool) {
                    this.strokeRenderer.setTool(data.mode);
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
                mode: 'pen'
            };
        }
        
        return this.brushSettings.getSettings();
    }
    
    setMode(mode) {
        const validModes = ['pen', 'eraser', 'fill'];
        
        if (!validModes.includes(mode)) {
            console.error(`[BrushCore] Invalid brush mode: ${mode}`);
            return;
        }
        
        if (this.brushSettings) {
            this.brushSettings.setMode(mode);
        } else {
            console.warn('[BrushCore] BrushSettings not available, cannot set mode');
        }
        
        if (mode !== 'fill' && this.strokeRenderer && this.strokeRenderer.setTool) {
            this.strokeRenderer.setTool(mode);
        }
    }
    
    getMode() {
        if (this.brushSettings) {
            return this.brushSettings.getMode();
        }
        return 'pen';
    }
    
    startStroke(clientX, clientY, pressure, pointerType = 'unknown') {
        const currentMode = this.getMode();
        
        if (currentMode === 'fill') {
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
        this.strokeHistoryBefore = this.layerManager.createLayerRasterSnapshot?.(activeLayer) || null;
        
        const { canvasX, canvasY } = this.coordinateSystem.screenClientToCanvas(clientX, clientY);
        const { worldX, worldY } = this.coordinateSystem.canvasToWorld(canvasX, canvasY);
        const { localX, localY } = this.coordinateSystem.worldToLocal(worldX, worldY, activeLayer);
        
        const settings = this._getCurrentSettings();
        const pressureEnabled = this._isPressureEnabledForMode(currentMode, settings, pointerType);
        const processedPressure = pressureEnabled ? Math.max(0.1, pressure ?? 0.5) : 1.0;
        
        if (pressureEnabled && this.pressureHandler) {
            this.pressureHandler.startStroke();
        }

        this.strokeRecorder.startStroke(localX, localY, processedPressure);
        
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
                this.previewGraphics.mask = clippingMask;
            } else {
                this.previewGraphics.visible = false;
            }
        }
        
        this.strokeRenderer.renderPreview(
            [{ x: localX, y: localY, pressure: processedPressure }],
            settings,
            this.previewGraphics
        );
        
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
    }
    
    updateStroke(clientX, clientY, pressure, pointerType = 'unknown') {
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
        
        // [指示書] 0荷重付近で消えないよう最小値を 0.1 程度に置く
        const pressureEnabled = this._isPressureEnabledForMode(currentMode, settings, pointerType);
        const processedPressure = pressureEnabled ? Math.max(0.1, pressure ?? 0.5) : 1.0;

        this._renderRealtimeSegmentIfNeeded(currentMode, localX, localY, processedPressure);

        // [指示書] 遅い線の丸連続感軽減：補完間隔を 2px に詰める
        const steps = Math.max(1, Math.floor(distance / 2));
        
        for (let i = 1; i <= steps; i++) {
            const t = i / (steps + 1);
            const interpX = this.lastLocalX + dx * t;
            const interpY = this.lastLocalY + dy * t;
            const interpPressure = this.lastPressure + (processedPressure - this.lastPressure) * t;
            
            this.strokeRecorder.addPoint(interpX, interpY, interpPressure);
        }
        
        this.strokeRecorder.addPoint(localX, localY, processedPressure);
        
        // [指示書] ライブ焼き込み中は previewGraphics を使用しない（二重描画防止）
        if (this.previewGraphics && currentMode !== 'eraser' && currentMode !== 'pen') {
            const currentPoints = this.strokeRecorder.getCurrentPoints();
            const settings = this._getCurrentSettings();
            
            this.previewGraphics.clear();
            this.strokeRenderer.renderPreview(
                currentPoints,
                settings,
                this.previewGraphics
            );
        }
        
        this.lastLocalX = localX;
        this.lastLocalY = localY;
        this.lastPressure = processedPressure;
    }

    _renderRealtimeSegmentIfNeeded(mode, localX, localY, pressure, force = false) {
        const dx = localX - this.lastRenderedLocalX;
        const dy = localY - this.lastRenderedLocalY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (!force && distance <= 0.5) return;
        if (distance <= 0) return;

        const segmentPoints = [
            { x: this.lastRenderedLocalX, y: this.lastRenderedLocalY, pressure: this.lastRenderedPressure },
            { x: localX, y: localY, pressure }
        ];

        if (mode === 'eraser') {
            this._renderRealtimeEraserSegment(segmentPoints);
            this.realtimeEraserApplied = true;
        } else if (mode === 'pen') {
            this._renderRealtimePenSegment(segmentPoints);
            this.realtimePenApplied = true;
        } else {
            return;
        }

        this.lastRenderedLocalX = localX;
        this.lastRenderedLocalY = localY;
        this.lastRenderedPressure = pressure;
    }

    _isPressureEnabledForMode(mode, settings, pointerType) {
        if (pointerType !== 'pen') return false;
        if (mode === 'eraser') return settings.eraserPressureEnabled === true;
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
        const activeLayer = this.layerManager.getActiveLayer();
        if (!activeLayer || !activeLayer.layerData?.renderTexture) return;

        const settings = this._getCurrentSettings();
        
        // [指示書] ペン用の実描画 Graphics を作る API を使用
        const graphics = this.strokeRenderer.renderPenSegment(points, settings);

        if (graphics && this.layerManager.app?.renderer) {
            this.layerManager.app.renderer.render({
                container: graphics,
                target: activeLayer.layerData.renderTexture,
                clear: false
            });
            
            graphics.destroy({ children: true, texture: true, baseTexture: true });
        }
    }
    
    async finalizeStroke() {
        if (!this.isDrawing) return;
        
        const activeLayer = this.layerManager.getActiveLayer();
        if (!activeLayer) return;
        
        const strokeData = this.strokeRecorder.endStroke();
        
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

        const finalPoint = strokeData?.points?.[strokeData.points.length - 1];
        if (finalPoint && ((mode === 'eraser' && this.realtimeEraserApplied) || (mode === 'pen' && this.realtimePenApplied))) {
            this._renderRealtimeSegmentIfNeeded(mode, finalPoint.x, finalPoint.y, finalPoint.pressure, true);
        }

        // [指示書] リアルタイム反映済みの場合は最終焼き込みをスキップ
        const alreadyApplied = (mode === 'eraser' && this.realtimeEraserApplied) || 
                               (mode === 'pen' && this.realtimePenApplied);
        
        const shouldBakeFinal = !alreadyApplied;
        
        // 最終描画オブジェクト生成（履歴用やフォールバック用）
        const graphics = await this.strokeRenderer.renderFinalStroke(
            strokeData,
            settings
        );
        
        if (graphics && this.layerManager.app?.renderer) {
            const layerData = activeLayer.layerData;
            
            // 🆕 RenderTextureへの焼き込み
            if (layerData?.renderTexture && shouldBakeFinal) {
                if (mode === 'eraser') {
                    const renderContainer = new Container();
                    renderContainer.addChild(graphics);
                    renderContainer.blendMode = 'erase';
                    
                    this.layerManager.app.renderer.render({
                        container: renderContainer,
                        target: layerData.renderTexture,
                        clear: false
                    });
                    
                    renderContainer.destroy({ children: true, texture: true, baseTexture: true });
                } else {
                    graphics.blendMode = 'normal';
                    
                    this.layerManager.app.renderer.render({
                        container: graphics,
                        target: layerData.renderTexture,
                        clear: false
                    });
                    
                    if (graphics.destroy) {
                        graphics.destroy({ children: true, texture: true, baseTexture: true });
                    }
                }
            } else if (!layerData?.renderTexture) {
                // フォールバック: 従来通り子要素として追加
                activeLayer.addChild(graphics);
            } else if (graphics.destroy) {
                // 既にライブ焼き込み済みの場合は、生成した graphics を破棄するだけにする
                graphics.destroy({ children: true, texture: true, baseTexture: true });
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
        }
        
        this.isDrawing = false;
        this.realtimeEraserApplied = false; 
        this.realtimePenApplied = false; // フラグリセット
        this.strokeHistoryBefore = null;
        
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

    _recordStrokeHistory(layer, mode) {
        const beforeSnapshot = this.strokeHistoryBefore;
        if (!beforeSnapshot || !historyManager || historyManager.isApplying) return;
        if (!this.layerManager?.createLayerRasterSnapshot || !this.layerManager?.restoreLayerRasterSnapshot) return;

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
            }
        });
    }
    
    cancelStroke() {
        if (!this.isDrawing) return;
        
        if (this.previewGraphics && this.previewGraphics.parent) {
            this.previewGraphics.parent.removeChild(this.previewGraphics);
            this.previewGraphics.destroy();
            this.previewGraphics = null;
        }
        
        this.isDrawing = false;
        this.strokeHistoryBefore = null;
        
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
