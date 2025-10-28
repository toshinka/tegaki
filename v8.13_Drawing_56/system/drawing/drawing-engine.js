// ===== drawing-engine.js - Phase 2改修: イベント発火ポイント追加 =====
// 
// 以下の2つのメソッドに thumbnail:layer-updated イベント発火を追加
// 
// 1. stopDrawing()
// 2. setTool()

// ========== 追加位置 1: stopDrawing() ==========
/*
既存の stopDrawing() メソッド内の最後に以下を追加：

stopDrawing() {
    if (!this.isDrawing) return;
    
    const strokeData = this.strokeRecorder.endStroke();
    this.clearPreview();
    this.clearEraserPreview();
    
    const tool = this.currentTool;
    
    if (tool === 'eraser' && this.currentLayer && strokeData.points.length > 0) {
        // 既存の消しゴム処理...
    } else if (tool === 'pen' && this.currentLayer && strokeData.points.length > 0) {
        // 既存のペン処理...
    }
    
    this.isDrawing = false;
    this.currentLayer = null;
    this.currentSettings = null;
    this.lastProcessedPointIndex = 0;
    
    // Phase 2追加: イベント統一
    if (this.currentLayer && strokeData.points.length > 0) {
        const layerIndex = this.layerSystem?.getLayerIndex?.(this.currentLayer);
        const layerId = this.currentLayer.layerData?.id;
        
        if (this.eventBus) {
            // 既存イベント
            this.eventBus.emit('stroke:finalized', {
                tool: tool,
                pointCount: strokeData.points.length,
                layerId: layerId
            });
            
            // サムネイル更新トリガー（イベント統一）
            this.eventBus.emit('thumbnail:layer-updated', {
                layerIndex: layerIndex,
                layerId: layerId,
                operation: 'stroke-finalized',
                tool: tool,
                pointCount: strokeData.points.length
            });
        }
    }
}
*/

// ========== 追加位置 2: setTool() ==========
/*
既存の setTool() メソッド内に以下を追加：

setTool(toolName) {
    this.currentTool = toolName;
    
    // 既存のロジック
    if (this.strokeRenderer) {
        this.strokeRenderer.setTool(toolName);
    }
    
    if (toolName !== 'eraser') {
        this.clearEraserPreview();
    }
    
    // Phase 2追加: ツール切替通知
    if (this.eventBus) {
        this.eventBus.emit('tool:changed', { tool: toolName });
        
        // 消しゴムツール切替時のサムネイル更新
        if (toolName === 'eraser') {
            const activeLayer = this.layerSystem?.getActiveLayer?.();
            if (activeLayer) {
                const layerIndex = this.layerSystem?.getLayerIndex?.(activeLayer);
                
                // サムネイル更新トリガー（ツール切替）
                this.eventBus.emit('thumbnail:layer-updated', {
                    layerIndex: layerIndex,
                    layerId: activeLayer.layerData?.id,
                    operation: 'tool-switched',
                    tool: toolName
                });
            }
        }
    }
}
*/

// ===== 実装例: 完全なメソッド例 =====

class DrawingEnginePhase2Example {
    
    // 例1: stopDrawing() の完全な改修版
    stopDrawing() {
        if (!this.isDrawing) return;

        const strokeData = this.strokeRecorder.endStroke();
        this.clearPreview();
        this.clearEraserPreview();
        const tool = this.currentTool;
        const currentLayer = this.currentLayer;
        const layerIndex = this.layerSystem?.getLayerIndex?.(this.currentLayer);

        if (tool === 'eraser' && this.currentLayer && strokeData.points.length > 0) {
            const layerData = this.currentLayer.layerData;
            
            if (layerData && typeof layerData.hasMask === 'function' && layerData.hasMask()) {
                const radius = this.currentSettings?.size || 5;
                
                if (this.eraserRenderer) {
                    this.eraserRenderer.applyEraserStroke(
                        this.current layer,
                        strokeData.points,
                        radius,
                        this.currentSettings?.opacity || 1.0
                    );
                }
            }
        } else if (tool === 'pen' && this.currentLayer && strokeData.points.length > 0) {
            if (this.strokeRenderer) {
                const pathData = this.strokeRenderer.renderStroke(
                    this.currentLayer,
                    strokeData,
                    this.currentSettings
                );
                
                if (pathData && this.layerSystem) {
                    this.layerSystem.addPathToActiveLayer(pathData);
                }
            }
        }

        this.isDrawing = false;
        const finalizingLayer = this.currentLayer;
        this.currentLayer = null;
        this.currentSettings = null;
        this.lastProcessedPointIndex = 0;

        // Phase 2追加: イベント統一
        if (finalizingLayer && strokeData.points.length > 0) {
            const layerId = finalizingLayer.layerData?.id;
            
            if (this.eventBus) {
                // 既存イベント
                this.eventBus.emit('stroke:finalized', {
                    tool: tool,
                    pointCount: strokeData.points.length,
                    layerId: layerId,
                    layerIndex: layerIndex
                });
                
                // Phase 2: サムネイル更新トリガー（イベント統一）
                this.eventBus.emit('thumbnail:layer-updated', {
                    layerIndex: layerIndex,
                    layerId: layerId,
                    operation: 'stroke-finalized',
                    tool: tool,
                    pointCount: strokeData.points.length
                });
            }
        }
    }

    // 例2: setTool() の完全な改修版
    setTool(toolName) {
        this.currentTool = toolName;
        
        // 既存ロジック
        if (this.strokeRenderer) {
            this.strokeRenderer.setTool(toolName);
        }
        
        if (toolName !== 'eraser') {
            this.clearEraserPreview();
        }

        // Phase 2追加: ツール切替通知
        if (this.eventBus) {
            this.eventBus.emit('tool:changed', { tool: toolName });
            
            // 消しゴムツール切替時のサムネイル更新
            if (toolName === 'eraser') {
                const activeLayer = this.layerSystem?.getActiveLayer?.();
                if (activeLayer) {
                    const layerIndex = this.layerSystem?.getLayerIndex?.(activeLayer);
                    
                    // Phase 2: サムネイル更新トリガー（ツール切替）
                    this.eventBus.emit('thumbnail:layer-updated', {
                        layerIndex: layerIndex,
                        layerId: activeLayer.layerData?.id,
                        operation: 'tool-switched',
                        tool: toolName
                    });
                }
            }
        }
    }
}