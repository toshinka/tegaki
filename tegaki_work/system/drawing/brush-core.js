/**
 * ============================================================================
 * ファイル名: system/drawing/brush-core.js
 * 責務: ストローク（ペン・消しゴム・塗りつぶし）の開始・更新・完了を統括する
 * 依存: event-bus.js, coordinate-system.js, stroke-recorder.js, stroke-renderer.js, layer-system.js, brush-settings.js, pixi.js
 * 被依存: core-engine.js, core-runtime.js等
 * 公開API: BrushCore, brushCore
 * イベント発火: drawing:stroke-started, drawing:stroke-completed, drawing:stroke-cancelled, layer:path-added, thumbnail:layer-updated
 * イベント受信: brush:mode-changed
 * グローバル登録: window.BrushCore
 * 実装状態: ♻️移植
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
    
    startStroke(clientX, clientY, pressure) {
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
        
        const { canvasX, canvasY } = this.coordinateSystem.screenClientToCanvas(clientX, clientY);
        const { worldX, worldY } = this.coordinateSystem.canvasToWorld(canvasX, canvasY);
        const { localX, localY } = this.coordinateSystem.worldToLocal(worldX, worldY, activeLayer);
        
        const processedPressure = pressure;
        
        this.strokeRecorder.startStroke(localX, localY, processedPressure);
        
        this.isDrawing = true;
        this.lastLocalX = localX;
        this.lastLocalY = localY;
        this.lastPressure = processedPressure;
        
        this.previewGraphics = new Graphics();
        this.previewGraphics.label = 'strokePreview';
        activeLayer.addChild(this.previewGraphics);
        
        const settings = this._getCurrentSettings();
        
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
    
    updateStroke(clientX, clientY, pressure) {
        if (!this.isDrawing) return;
        
        const activeLayer = this.layerManager.getActiveLayer();
        if (!activeLayer) return;
        
        const { canvasX, canvasY } = this.coordinateSystem.screenClientToCanvas(clientX, clientY);
        const { worldX, worldY } = this.coordinateSystem.canvasToWorld(canvasX, canvasY);
        const { localX, localY } = this.coordinateSystem.worldToLocal(worldX, worldY, activeLayer);
        
        const processedPressure = pressure;
        
        const dx = localX - this.lastLocalX;
        const dy = localY - this.lastLocalY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.max(1, Math.floor(distance / 5));
        
        for (let i = 1; i <= steps; i++) {
            const t = i / (steps + 1);
            const interpX = this.lastLocalX + dx * t;
            const interpY = this.lastLocalY + dy * t;
            const interpPressure = this.lastPressure + (processedPressure - this.lastPressure) * t;
            
            this.strokeRecorder.addPoint(interpX, interpY, interpPressure);
        }
        
        this.strokeRecorder.addPoint(localX, localY, processedPressure);
        
        if (this.previewGraphics) {
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
        
        // 最終描画オブジェクト生成
        const graphics = await this.strokeRenderer.renderFinalStroke(
            strokeData,
            settings
        );
        
        if (graphics && this.layerManager.app?.renderer) {
            const layerData = activeLayer.layerData;
            
            // 🆕 RenderTextureへの焼き込み（Raster化）
            if (layerData?.renderTexture) {
                if (mode === 'eraser') {
                    // 消しゴムの場合は Container でラップして blendMode = 'erase' を指定
                    const renderContainer = new Container();
                    renderContainer.addChild(graphics);
                    renderContainer.blendMode = 'erase';
                    
                    this.layerManager.app.renderer.render({
                        container: renderContainer,
                        target: layerData.renderTexture,
                        clear: false
                    });
                    
                    // 使用後破棄
                    renderContainer.destroy({ children: true, texture: true, baseTexture: true });
                } else {
                    // ペンの場合は通常通り
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
            } else {
                // フォールバック: 従来通り子要素として追加
                activeLayer.addChild(graphics);
            }
            
            if (layerData) {
                // 履歴用のデータ保存（現在は簡易版）
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
                
                // TODO: Raster化に伴うUndoの再設計（現在は省略）
            }
            
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
                    component: 'drawing',
                    action: 'stroke-completed',
                    data: {
                        layerIndex: layerIndex,
                        layerId: activeLayer.layerData?.id,
                        immediate: true
                    }
                });
            }
        }
        
        this.isDrawing = false;
        
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
    
    cancelStroke() {
        if (!this.isDrawing) return;
        
        if (this.previewGraphics && this.previewGraphics.parent) {
            this.previewGraphics.parent.removeChild(this.previewGraphics);
            this.previewGraphics.destroy();
            this.previewGraphics = null;
        }
        
        this.isDrawing = false;
        
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
