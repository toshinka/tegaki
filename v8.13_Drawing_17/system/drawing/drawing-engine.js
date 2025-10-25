/**
 * DrawingEngine - ペン描画統合制御クラス (サムネイル自動更新対応版)
 * 
 * ✅ サムネイル更新: finalizeStroke()でlayerIndexを含むlayer:modifiedイベント発火
 */

class DrawingEngine {
    constructor(app, layerSystem, cameraSystem, history) {
        this.app = app;
        this.layerSystem = layerSystem;
        this.cameraSystem = cameraSystem;
        this.history = history;
        this.eventBus = window.TegakiEventBus;

        this.pressureHandler = new PressureHandler();
        this.strokeRecorder = new StrokeRecorder(this.pressureHandler, this.cameraSystem);
        this.strokeRenderer = new StrokeRenderer(app);

        this.brushSettings = null;

        this.isDrawing = false;
        this.currentPreview = null;
        this.currentLayer = null;
        this.currentSettings = null;
        this.currentTool = 'pen';
        
        this.eraserPreviewGraphics = null;
        this.lastProcessedPointIndex = 0;
        
        this._syncBrushSettingsToRuntime();
        this._syncToolSelection();
    }

    setBrushSettings(brushSettings) {
        this.brushSettings = brushSettings;
        this._syncBrushSettingsToRuntime();
    }

    _syncBrushSettingsToRuntime() {
        if (!this.eventBus) return;

        this.eventBus.on('brush:size-changed', ({ size }) => {});
        this.eventBus.on('brush:alpha-changed', ({ alpha }) => {});
        this.eventBus.on('brush:color-changed', ({ color }) => {});
    }

    _syncToolSelection() {
        if (!this.eventBus) return;

        this.eventBus.on('tool:select', ({ tool }) => {
            this.setTool(tool);
        });
    }

    startDrawing(x, y, event) {
        this.currentLayer = this.layerSystem.getActiveLayer();
        if (!this.currentLayer || this.currentLayer.layerData?.locked) {
            return;
        }

        this.currentSettings = this.getBrushSettings();

        if (event && event.pointerType) {
            this.strokeRecorder.startStrokeFromEvent(event);
        } else {
            const pressure = event?.pressure || 0.5;
            this.strokeRecorder.startStroke(x, y, pressure);
        }

        this.isDrawing = true;
        this.lastProcessedPointIndex = 0;

        if (this.eventBus) {
            this.eventBus.emit('stroke:start', {
                layerId: this.currentLayer.layerData?.id || this.currentLayer.label,
                settings: this.currentSettings,
                tool: this.currentTool
            });
        }

        this.updatePreview();
        
        if (this.currentTool === 'eraser') {
            const points = this.strokeRecorder.getCurrentPoints();
            if (points.length > 0) {
                this.updateEraserPreview(points[0]);
            }
        }
    }

    continueDrawing(x, y, event) {
        if (!this.isDrawing) return;

        if (event && event.pointerType) {
            const pressure = event.pressure || 0.5;
            this.strokeRecorder.addPointFromEvent(event, pressure);
        } else {
            const pressure = event?.pressure || 0.5;
            this.strokeRecorder.addPoint(x, y, pressure);
        }

        this.currentSettings = this.getBrushSettings();
        this.updatePreview();

        if (this.currentTool === 'eraser') {
            const currentPoints = this.strokeRecorder.getCurrentPoints();
            
            if (currentPoints.length > 0) {
                this.updateEraserPreview(currentPoints[currentPoints.length - 1]);
            }
            
            if (currentPoints.length > this.lastProcessedPointIndex + 1) {
                const newPoints = currentPoints.slice(this.lastProcessedPointIndex);
                this.applyRealtimeEraserEffect(newPoints);
                this.lastProcessedPointIndex = currentPoints.length - 1;
            }
        }

        if (this.eventBus) {
            this.eventBus.emit('stroke:point', {
                points: this.strokeRecorder.getCurrentPoints(),
                settings: this.currentSettings,
                tool: this.currentTool
            });
        }
    }

    stopDrawing() {
        if (!this.isDrawing) return;

        const strokeData = this.strokeRecorder.endStroke();

        this.clearPreview();
        this.clearEraserPreview();

        const tool = this.currentTool;

        if (tool === 'eraser' && this.currentLayer && strokeData.points.length > 0) {
            const remainingPoints = strokeData.points.slice(this.lastProcessedPointIndex);
            if (remainingPoints.length > 1) {
                this.applyRealtimeEraserEffect(remainingPoints);
            }
        } else {
            this.finalizeStroke(strokeData, tool);
        }

        this.isDrawing = false;
        this.currentLayer = null;
        this.currentSettings = null;
        this.lastProcessedPointIndex = 0;

        if (this.eventBus) {
            this.eventBus.emit('stroke:end', {
                strokeData: strokeData,
                tool: tool
            });
        }
    }

    updatePreview() {
        if (!this.currentLayer) return;

        this.clearPreview();

        const points = this.strokeRecorder.getCurrentPoints();
        if (points.length === 0) return;

        this.currentPreview = this.strokeRenderer.renderPreview(points, this.currentSettings);
        this.currentLayer.addChild(this.currentPreview);
    }

    clearPreview() {
        if (this.currentPreview) {
            this.currentPreview.destroy({ children: true, texture: true, baseTexture: true });
            this.currentPreview = null;
        }
    }

    updateEraserPreview(worldPos) {
        if (!this.currentLayer) return;
        
        if (!this.eraserPreviewGraphics) {
            this.eraserPreviewGraphics = new PIXI.Graphics();
            this.currentLayer.addChild(this.eraserPreviewGraphics);
        }
        
        const radius = this.currentSettings.size / 2;
        
        this.eraserPreviewGraphics.clear();
        this.eraserPreviewGraphics.circle(worldPos.x, worldPos.y, radius);
        this.eraserPreviewGraphics.stroke({ width: 1, color: 0xFF0000, alpha: 0.5 });
    }
    
    clearEraserPreview() {
        if (this.eraserPreviewGraphics) {
            this.eraserPreviewGraphics.destroy({ children: true, texture: true, baseTexture: true });
            this.eraserPreviewGraphics = null;
        }
    }

    /**
     * ✅ サムネイル更新対応: layerIndexを含むlayer:modifiedイベント発火
     */
    finalizeStroke(strokeData, tool = null) {
        if (!this.currentLayer || strokeData.points.length === 0) {
            return;
        }

        const activeTool = tool || this.currentTool || 'pen';
        const targetLayer = this.currentLayer;
        const layerId = targetLayer.layerData?.id || targetLayer.label;
        const layerIndex = this.layerSystem.activeLayerIndex;

        const strokeSettings = {
            color: this.currentSettings.color,
            size: this.currentSettings.size,
            alpha: this.currentSettings.alpha || 1.0,
            tool: activeTool
        };

        const strokeModel = new window.TegakiDataModels.StrokeData({
            points: strokeData.points,
            isSingleDot: strokeData.isSingleDot,
            color: strokeSettings.color,
            size: strokeSettings.size,
            alpha: strokeSettings.alpha,
            layerId: layerId,
            tool: activeTool
        });

        const createStrokeObject = () => {
            const originalTool = this.strokeRenderer.currentTool;
            this.strokeRenderer.setTool(activeTool);

            const obj = this.strokeRenderer.renderFinalStroke(strokeData, strokeSettings);

            this.strokeRenderer.setTool(originalTool);

            obj._strokePoints = strokeData.points;
            obj._strokeOptions = strokeSettings;

            return obj;
        };

        let strokeObjectRef = null;

        const addStrokeCommand = {
            name: activeTool === 'eraser' ? 'Erase' : 'Add Stroke',
            do: () => {
                strokeObjectRef = createStrokeObject();
                if (targetLayer && targetLayer.addChild) {
                    targetLayer.addChild(strokeObjectRef);
                }
            },
            undo: () => {
                if (targetLayer && strokeObjectRef) {
                    try {
                        if (targetLayer.children.includes(strokeObjectRef)) {
                            targetLayer.removeChild(strokeObjectRef);
                        }
                        strokeObjectRef.destroy({
                            children: true,
                            texture: true,
                            baseTexture: true
                        });
                        strokeObjectRef = null;
                    } catch (e) {
                        strokeObjectRef = null;
                    }
                }
            },
            meta: {
                type: activeTool === 'eraser' ? 'erase' : 'stroke',
                layerId: layerId,
                strokeData: strokeModel
            }
        };

        if (this.history && this.history.push) {
            this.history.push(addStrokeCommand);
        }

        if (this.eventBus) {
            this.eventBus.emit('layer:modified', {
                layerId: layerId,
                layerIndex: layerIndex,
                tool: activeTool
            });
        }
    }

    applyRealtimeEraserEffect(newEraserPoints) {
        if (!newEraserPoints || newEraserPoints.length < 2) return;
        
        const eraserRadius = this.currentSettings.size / 2;
        const activeLayer = this.currentLayer;
        if (!activeLayer) return;

        const VectorOps = window.TegakiDrawing?.VectorOperations;
        if (!VectorOps) return;

        const allChildren = activeLayer.children || [];
        const modifications = [];

        for (let childIndex = 0; childIndex < allChildren.length; childIndex++) {
            const graphics = allChildren[childIndex];

            if (!graphics || 
                !graphics.geometry || 
                graphics === this.currentPreview ||
                graphics === this.eraserPreviewGraphics ||
                graphics.label?.includes('background')) {
                continue;
            }

            let sourcePoints = graphics._strokePoints;

            if (!sourcePoints && activeLayer.layerData?.paths) {
                for (const path of activeLayer.layerData.paths) {
                    if (path.graphics === graphics && path.points) {
                        sourcePoints = path.points;
                        break;
                    }
                }
            }

            if (!sourcePoints || sourcePoints.length === 0) continue;

            let hasIntersection = false;
            for (const eraserPoint of newEraserPoints) {
                if (VectorOps.testCircleStrokeIntersection(
                    eraserPoint,
                    eraserRadius,
                    sourcePoints
                )) {
                    hasIntersection = true;
                    break;
                }
            }

            if (hasIntersection) {
                const segments = this.splitPathByEraserTrail(
                    sourcePoints,
                    newEraserPoints,
                    eraserRadius
                );
                modifications.push({ 
                    graphics: graphics, 
                    points: sourcePoints,
                    segments: segments,
                    childIndex: childIndex
                });
            }
        }

        this.applyRealtimePathModifications(modifications);
    }

    applyRealtimePathModifications(modifications) {
        const activeLayer = this.currentLayer;
        if (!activeLayer || modifications.length === 0) return;

        for (const { graphics, points, segments } of modifications) {
            activeLayer.removeChild(graphics);
            graphics.destroy({ children: true, texture: true, baseTexture: true });

            for (const segmentPoints of segments) {
                if (segmentPoints.length < 2) continue;

                const newGraphics = new PIXI.Graphics();

                const strokeOptions = graphics._strokeOptions || {
                    color: 0x000000,
                    alpha: 1.0,
                    size: 5
                };

                if (this.strokeRenderer) {
                    this.strokeRenderer.renderFinalStroke(
                        { points: segmentPoints, isSingleDot: false },
                        strokeOptions,
                        newGraphics
                    );
                }

                newGraphics._strokePoints = segmentPoints;
                newGraphics._strokeOptions = strokeOptions;

                activeLayer.addChild(newGraphics);
            }
        }

        if (this.layerSystem) {
            this.layerSystem.requestThumbnailUpdate(this.layerSystem.activeLayerIndex);
        }
    }

    applyEraserEffect(eraserPath) {
        const eraserPoints = eraserPath.points;
        if (!eraserPoints || eraserPoints.length === 0) return;

        const eraserRadius = this.currentSettings.size / 2;
        const activeLayer = this.currentLayer;
        if (!activeLayer) return;

        const VectorOps = window.TegakiDrawing?.VectorOperations;
        if (!VectorOps) return;

        const allChildren = activeLayer.children || [];
        const modifications = [];

        for (let childIndex = 0; childIndex < allChildren.length; childIndex++) {
            const graphics = allChildren[childIndex];

            if (!graphics || !graphics.geometry || graphics.label?.includes('background')) {
                continue;
            }

            let sourcePoints = graphics._strokePoints;

            if (!sourcePoints && activeLayer.layerData?.paths) {
                for (const path of activeLayer.layerData.paths) {
                    if (path.graphics === graphics && path.points) {
                        sourcePoints = path.points;
                        break;
                    }
                }
            }

            if (!sourcePoints || sourcePoints.length === 0) continue;

            let hasIntersection = false;
            for (const eraserPoint of eraserPoints) {
                if (VectorOps.testCircleStrokeIntersection(
                    eraserPoint,
                    eraserRadius,
                    sourcePoints
                )) {
                    hasIntersection = true;
                    break;
                }
            }

            if (hasIntersection) {
                const segments = this.splitPathByEraserTrail(
                    sourcePoints,
                    eraserPoints,
                    eraserRadius
                );
                if (segments.length > 0) {
                    modifications.push({ 
                        graphics: graphics, 
                        points: sourcePoints,
                        segments: segments,
                        childIndex: childIndex
                    });
                }
            }
        }

        this.applyPathModifications(modifications);
    }

    splitPathByEraserTrail(sourcePoints, eraserPoints, eraserRadius) {
        const VectorOps = window.TegakiDrawing?.VectorOperations;
        if (!VectorOps) return [];

        let remainingSegments = [sourcePoints];

        for (const eraserPoint of eraserPoints) {
            const newSegments = [];

            for (const segment of remainingSegments) {
                const splits = VectorOps.splitStrokeByCircle(
                    segment,
                    eraserPoint,
                    eraserRadius,
                    2
                );
                newSegments.push(...splits);
            }

            remainingSegments = newSegments.length > 0 ? newSegments : remainingSegments;
        }

        return remainingSegments;
    }

    applyPathModifications(modifications) {
        const activeLayer = this.currentLayer;
        if (!activeLayer || modifications.length === 0) return;

        const removedGraphics = [];
        const addedGraphics = [];

        for (const { graphics, points, segments } of modifications) {
            removedGraphics.push(graphics);

            activeLayer.removeChild(graphics);
            graphics.destroy({ children: true, texture: true, baseTexture: true });

            for (const segmentPoints of segments) {
                if (segmentPoints.length < 2) continue;

                const newGraphics = new PIXI.Graphics();

                const strokeOptions = graphics._strokeOptions || {
                    color: 0x000000,
                    alpha: 1.0,
                    size: 5
                };

                if (this.strokeRenderer) {
                    this.strokeRenderer.renderFinalStroke(
                        { points: segmentPoints, isSingleDot: false },
                        strokeOptions,
                        newGraphics
                    );
                }

                newGraphics._strokePoints = segmentPoints;
                newGraphics._strokeOptions = strokeOptions;

                activeLayer.addChild(newGraphics);
                addedGraphics.push(newGraphics);
            }
        }

        if (this.history && removedGraphics.length > 0) {
            const layerIndex = this.layerSystem.activeLayerIndex;
            const command = {
                name: 'Erase',
                undo: () => {
                    const layer = this.layerSystem.layers[layerIndex];
                    if (!layer) return;

                    for (const g of addedGraphics) {
                        if (layer.children.includes(g)) {
                            layer.removeChild(g);
                            g.destroy({ children: true, texture: true, baseTexture: true });
                        }
                    }

                    for (const g of removedGraphics) {
                        layer.addChild(g);
                    }

                    this.layerSystem.requestThumbnailUpdate(layerIndex);
                },
                do: () => {
                    const layer = this.layerSystem.layers[layerIndex];
                    if (!layer) return;

                    for (const g of removedGraphics) {
                        if (layer.children.includes(g)) {
                            layer.removeChild(g);
                            g.destroy({ children: true, texture: true, baseTexture: true });
                        }
                    }

                    for (const g of addedGraphics) {
                        if (!layer.children.includes(g)) {
                            layer.addChild(g);
                        }
                    }

                    this.layerSystem.requestThumbnailUpdate(layerIndex);
                },
                meta: { type: 'erase', layerIndex }
            };

            this.history.push(command);
        }

        this.layerSystem.requestThumbnailUpdate(this.layerSystem.activeLayerIndex);

        if (this.eventBus) {
            this.eventBus.emit('layer:erased', {
                layerId: activeLayer.layerData?.id,
                pathsRemoved: removedGraphics.length,
                segmentsCreated: addedGraphics.length
            });
        }
    }

    getBrushSettings() {
        if (this.brushSettings) {
            return this.brushSettings.getCurrentSettings();
        }

        if (window.brushSettings) {
            return {
                color: window.brushSettings.getColor(),
                size: window.brushSettings.getSize(),
                alpha: window.brushSettings.getAlpha ? window.brushSettings.getAlpha() : 1.0
            };
        }

        if (window.TegakiSettingsManager) {
            return {
                color: window.TegakiSettingsManager.get('pen.color') || 0x800000,
                size: window.TegakiSettingsManager.get('pen.size') || 3,
                alpha: window.TegakiSettingsManager.get('pen.opacity') || 1.0
            };
        }

        return {
            color: 0x800000,
            size: 3,
            alpha: 1.0
        };
    }

    setTool(toolName) {
        this.currentTool = toolName;
        if (this.strokeRenderer) {
            this.strokeRenderer.setTool(toolName);
        }
        
        if (toolName !== 'eraser') {
            this.clearEraserPreview();
        }
    }

    cancelStroke() {
        if (!this.isDrawing) return;

        this.clearPreview();
        this.clearEraserPreview();
        this.isDrawing = false;
        this.currentLayer = null;
        this.currentSettings = null;
        this.lastProcessedPointIndex = 0;

        if (this.eventBus) {
            this.eventBus.emit('stroke:cancel');
        }
    }

    updateResolution() {
        this.strokeRenderer.updateResolution();
    }

    destroy() {
        this.clearPreview();
        this.clearEraserPreview();
    }
}