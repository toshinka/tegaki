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
        }
        
        getActiveLayer() {
            return this.layers.get(this.activeLayerId);
        }
        
        setActiveLayer(layerId) {
            if (this.layers.has(layerId)) {
                this.activeLayerId = layerId;
                return true;
            }
            return false;
        }
        
        getLayerData(layerId) {
            return this.layers.get(layerId);
        }
        
        getAllLayers() {
            return Array.from(this.layers.values());
        }
        
        toggleLayerVisibility(layerId) {
            const layer = this.layers.get(layerId);
            if (layer) {
                layer.visible = !layer.visible;
                layer.container.visible = layer.visible;
                return true;
            }
            return false;
        }
        
        addPathToLayer(layerId, pathData) {
            const layer = this.layers.get(layerId);
            if (layer && pathData && pathData.graphics) {
                layer.paths.push(pathData);
                
                // Graphics already has correct blend mode set by drawing engine
                layer.container.addChild(pathData.graphics);
                
                return true;
            }
            return false;
        }
        
        addPathToActiveLayer(pathData) {
            return this.addPathToLayer(this.activeLayerId, pathData);
        }
        
        removePathFromLayer(layerId, pathId) {
            const layer = this.layers.get(layerId);
            if (!layer) return false;
            
            const pathIndex = layer.paths.findIndex(p => p.id === pathId);
            if (pathIndex >= 0) {
                const path = layer.paths[pathIndex];
                if (path.graphics) {
                    layer.container.removeChild(path.graphics);
                    path.graphics.destroy();
                }
                layer.paths.splice(pathIndex, 1);
                return true;
            }
            return false;
        }
        
        reorderLayers(fromIndex, toIndex) {
            const layerArray = this.getAllLayers().filter(l => !l.isBackground);
            if (fromIndex >= layerArray.length || toIndex >= layerArray.length) return false;
            
            const [movedLayer] = layerArray.splice(fromIndex, 1);
            layerArray.splice(toIndex, 0, movedLayer);
            
            // Update container order
            const backgroundLayer = this.layers.get(0);
            this.engine.containers.world.removeChildren();
            
            if (backgroundLayer) {
                this.engine.containers.world.addChild(backgroundLayer.container);
            }
            
            layerArray.forEach(layer => {
                this.engine.containers.world.addChild(layer.container);
            });
            
            return true;
        }
        
        validateLayerMove(fromIndex, toIndex) {
            const layerArray = this.getAllLayers().filter(l => !l.isBackground);
            return fromIndex >= 0 && fromIndex < layerArray.length &&
                   toIndex >= 0 && toIndex < layerArray.length &&
                   fromIndex !== toIndex;
        }
        
        updateCanvasSize(width, height) {
            this.canvasSize = { width, height };
            
            const backgroundLayer = this.layers.get(0);
            if (backgroundLayer && backgroundLayer.backgroundGraphics) {
                backgroundLayer.backgroundGraphics.clear();
                backgroundLayer.backgroundGraphics.rect(0, 0, width, height);
                backgroundLayer.backgroundGraphics.fill(0xf0e0d6);
            }
        }
        
        getLayersForUI() {
            return {
                layers: this.getAllLayers(),
                activeLayerId: this.activeLayerId
            };
        }
    }
    
    class LayerManager {
        constructor() {
            this.mainAPI = null;
            this.bridge = null;
        }
        
        async register(mainAPI) {
            this.mainAPI = mainAPI;
            
            try {
                // Get drawing engine to access containers
                const drawingEngineProxy = mainAPI.getSatellite('drawingEngine');
                if (!drawingEngineProxy) {
                    throw new Error('Drawing engine not found');
                }
                
                const engine = await drawingEngineProxy.request('getEngine');
                if (!engine) {
                    throw new Error('Drawing engine not available');
                }
                
                this.bridge = new LayerBridge(engine);
                
                // Initialize with background layer and one drawing layer
                this.bridge.createLayer(null, true); // Background
                const firstLayerId = this.bridge.createLayer('レイヤー1');
                this.bridge.setActiveLayer(firstLayerId);
                
                // Setup event listeners
                this.setupEventListeners();
                
                // Small delay to ensure UI manager is ready, then notify of initial state
                setTimeout(() => {
                    this.notifyLayerUpdate();
                }, 100);
                
                this.mainAPI.notify('layers.ready');
                return true;
                
            } catch (error) {
                this.mainAPI.notifyError('ERR_LAYER_INIT_FAILED', 'Layer manager initialization failed', error);
                throw error;
            }
        }
        
        setupEventListeners() {
            // No automatic event listeners - main controller handles stroke saving directly
        }
        
        // Public API methods for main controller
        createLayer(name) {
            try {
                const layerId = this.bridge.createLayer(name);
                this.bridge.setActiveLayer(layerId);
                this.notifyLayerUpdate();
                return layerId;
            } catch (error) {
                this.mainAPI.notifyError('ERR_LAYER_CREATE', 'Failed to create layer', error);
                return null;
            }
        }
        
        deleteLayer(layerId) {
            try {
                const success = this.bridge.deleteLayer(layerId);
                if (success) {
                    this.notifyLayerUpdate();
                }
                return success;
            } catch (error) {
                this.mainAPI.notifyError('ERR_LAYER_DELETE', 'Failed to delete layer', error);
                return false;
            }
        }
        
        validateLayerMove(fromIndex, toIndex) {
            return this.bridge.validateLayerMove(fromIndex, toIndex);
        }
        
        getLayerData(layerId) {
            return this.bridge.getLayerData(layerId);
        }
        
        toggleLayerVisibility(layerId) {
            try {
                const success = this.bridge.toggleLayerVisibility(layerId);
                if (success) {
                    this.notifyLayerUpdate();
                }
                return success;
            } catch (error) {
                this.mainAPI.notifyError('ERR_LAYER_VISIBILITY', 'Failed to toggle layer visibility', error);
                return false;
            }
        }
        
        setActiveLayer(layerId) {
            try {
                const success = this.bridge.setActiveLayer(layerId);
                if (success) {
                    this.notifyLayerUpdate();
                }
                return success;
            } catch (error) {
                this.mainAPI.notifyError('ERR_LAYER_ACTIVE', 'Failed to set active layer', error);
                return false;
            }
        }
        
        updateCanvasSize(width, height) {
            try {
                this.bridge.updateCanvasSize(width, height);
            } catch (error) {
                this.mainAPI.notifyError('ERR_LAYER_CANVAS_SIZE', 'Failed to update canvas size', error);
            }
        }
        
        addPathToActiveLayer(pathData) {
            return this.bridge.addPathToActiveLayer(pathData);
        }
        
        removePath(pathId) {
            // Find and remove path from any layer
            for (const layer of this.bridge.getAllLayers()) {
                if (this.bridge.removePathFromLayer(layer.id, pathId)) {
                    return true;
                }
            }
            return false;
        }
        
        reorderLayers(fromIndex, toIndex) {
            try {
                const success = this.bridge.reorderLayers(fromIndex, toIndex);
                if (success) {
                    this.notifyLayerUpdate();
                }
                return success;
            } catch (error) {
                this.mainAPI.notifyError('ERR_LAYER_REORDER', 'Failed to reorder layers', error);
                return false;
            }
        }
        
        notifyLayerUpdate() {
            const layerData = this.bridge.getLayersForUI();
            
            // Notify UI manager
            const uiProxy = this.mainAPI.getSatellite('uiManager');
            if (uiProxy) {
                try {
                    uiProxy.request('updateLayerPanel', layerData);
                    
                    // Update current layer name in status
                    const activeLayer = this.bridge.getActiveLayer();
                    if (activeLayer) {
                        uiProxy.request('updateCurrentLayer', activeLayer.name);
                    }
                } catch (error) {
                    // Non-critical error
                }
            }
            
            // Notify main about layer state change
            this.mainAPI.notify('layers.stateChange', layerData);
        }
        
        // Event handlers called by main
        handleLayerCreateRequest(payload) {
            return this.createLayer(payload.name);
        }
        
        handleLayerDeleteRequest(payload) {
            return this.deleteLayer(payload.layerId);
        }
        
        handleLayerMoveConfirm(payload) {
            return this.reorderLayers(payload.fromIndex, payload.toIndex);
        }
        
        handleLayerVisibilityToggle(payload) {
            return this.toggleLayerVisibility(payload.layerId);
        }
        
        handleLayerSetActive(payload) {
            return this.setActiveLayer(payload.layerId);
        }
        
        // Cleanup
        destroy() {
            if (this.bridge) {
                this.bridge.getAllLayers().forEach(layer => {
                    if (layer.container && layer.container.destroy) {
                        layer.container.destroy();
                    }
                });
            }
            
            this.mainAPI = null;
            this.bridge = null;
        }
    }
    
    return LayerManager;
})();