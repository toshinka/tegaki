/**
 * Layer Manager Satellite
 * レイヤー管理・並び替え・可視性制御の責務を担う衛星モジュール
 */

window.FutabaLayerManager = (function() {
    'use strict';
    
    class LayerBridge {
        constructor(drawingEngine) {
            this.engine = drawingEngine;
            this.layers = new Map();
            this.activeLayerId = null;
            this.nextLayerId = 1;
            this.canvasSize = { width: 400, height: 400 };
        }
        
        createLayer(name = null, isBackground = false) {
            const layerId = isBackground ? 0 : this.nextLayerId++;
            const layerName = name || (isBackground ? '背景' : `レイヤー${layerId}`);
            
            const container = new PIXI.Container();
            container.name = layerName;
            container.visible = true;
            
            const layer = {
                id: layerId,
                name: layerName,
                container: container,
                visible: true,
                paths: [],
                isBackground: isBackground,
                backgroundGraphics: null
            };
            
            // Background layer gets a colored background
            if (isBackground) {
                const backgroundGraphics = new PIXI.Graphics();
                backgroundGraphics.rect(0, 0, this.canvasSize.width, this.canvasSize.height);
                backgroundGraphics.fill(0xf0e0d6); // futaba-cream color
                container.addChild(backgroundGraphics);
                layer.backgroundGraphics = backgroundGraphics;
            }
            
            this.layers.set(layerId, layer);
            this.engine.containers.world.addChild(container);
            
            return layerId;
        }
        
        deleteLayer(layerId) {
            if (layerId === 0) return false; // Cannot delete background
            if (this.layers.size <= 2) return false; // Must keep background + at least one layer
            
            const layer = this.layers.get(layerId);
            if (!layer || layer.isBackground) return false;
            
            // Clean up paths
            layer.paths.forEach(path => {
                if (path.graphics && path.graphics.destroy) {
                    path.graphics.destroy();
                }
            });
            
            // Remove from engine
            this.engine.containers.world.removeChild(layer.container);
            layer.container.destroy();
            
            // Remove from map
            this.layers.delete(layerId);
            
            // Update active layer if needed
            if (this.activeLayerId === layerId) {
                const remainingLayers = Array.from(this.layers.keys()).filter(id => id !== 0);
                this.activeLayerId = remainingLayers[remainingLayers.length - 1] || 0;
            }
            
            return true;