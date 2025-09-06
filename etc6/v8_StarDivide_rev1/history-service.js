/**
 * History Service Satellite
 * Undo/Redo履歴管理・非破壊的操作記録の責務を担う衛星モジュール
 */

window.FutabaHistoryService = (function() {
    'use strict';
    
    class HistoryRecord {
        constructor(type, data, timestamp = Date.now()) {
            this.id = `hist_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
            this.type = type;
            this.data = data;
            this.timestamp = timestamp;
            this.applied = true;
        }
        
        clone() {
            const cloned = new HistoryRecord(this.type, structuredClone(this.data), this.timestamp);
            cloned.id = this.id;
            cloned.applied = this.applied;
            return cloned;
        }
    }
    
    class HistoryStack {
        constructor(maxSize = 100) {
            this.stack = [];
            this.currentIndex = -1;
            this.maxSize = maxSize;
        }
        
        push(record) {
            // Remove any future history when adding new record
            if (this.currentIndex < this.stack.length - 1) {
                this.stack = this.stack.slice(0, this.currentIndex + 1);
            }
            
            this.stack.push(record);
            this.currentIndex = this.stack.length - 1;
            
            // Maintain max size
            if (this.stack.length > this.maxSize) {
                const removeCount = this.stack.length - this.maxSize;
                this.stack.splice(0, removeCount);
                this.currentIndex -= removeCount;
            }
        }
        
        canUndo() {
            return this.currentIndex >= 0;
        }
        
        canRedo() {
            return this.currentIndex < this.stack.length - 1;
        }
        
        undo() {
            if (!this.canUndo()) return null;
            
            const record = this.stack[this.currentIndex];
            this.currentIndex--;
            return record;
        }
        
        redo() {
            if (!this.canRedo()) return null;
            
            this.currentIndex++;
            const record = this.stack[this.currentIndex];
            return record;
        }
        
        peek() {
            return this.currentIndex >= 0 ? this.stack[this.currentIndex] : null;
        }
        
        clear() {
            this.stack = [];
            this.currentIndex = -1;
        }
        
        getStats() {
            return {
                total: this.stack.length,
                currentIndex: this.currentIndex,
                canUndo: this.canUndo(),
                canRedo: this.canRedo()
            };
        }
    }
    
    class HistoryProcessor {
        constructor(mainAPI) {
            this.mainAPI = mainAPI;
        }
        
        async processUndo(record) {
            try {
                switch (record.type) {
                    case 'stroke':
                        return await this.undoStroke(record);
                    case 'layerMove':
                        return await this.undoLayerMove(record);
                    case 'layerCreate':
                        return await this.undoLayerCreate(record);
                    case 'layerDelete':
                        return await this.undoLayerDelete(record);
                    case 'layerVisibility':
                        return await this.undoLayerVisibility(record);
                    case 'canvasResize':
                        return await this.undoCanvasResize(record);
                    default:
                        throw new Error(`Unknown history record type: ${record.type}`);
                }
            } catch (error) {
                this.mainAPI.notifyError('ERR_HISTORY_UNDO', `Failed to undo ${record.type}`, error);
                return false;
            }
        }
        
        async processRedo(record) {
            try {
                switch (record.type) {
                    case 'stroke':
                        return await this.redoStroke(record);
                    case 'layerMove':
                        return await this.redoLayerMove(record);
                    case 'layerCreate':
                        return await this.redoLayerCreate(record);
                    case 'layerDelete':
                        return await this.redoLayerDelete(record);
                    case 'layerVisibility':
                        return await this.redoLayerVisibility(record);
                    case 'canvasResize':
                        return await this.redoCanvasResize(record);
                    default:
                        throw new Error(`Unknown history record type: ${record.type}`);
                }
            } catch (error) {
                this.mainAPI.notifyError('ERR_HISTORY_REDO', `Failed to redo ${record.type}`, error);
                return false;
            }
        }
        
        async undoStroke(record) {
            const drawingEngineProxy = this.mainAPI.getSatellite('drawingEngine');
            if (!drawingEngineProxy) return false;
            
            const { pathId } = record.data;
            return drawingEngineProxy.request('removePath', pathId);
        }
        
        async redoStroke(record) {
            const layerManagerProxy = this.mainAPI.getSatellite('layerManager');
            const drawingEngineProxy = this.mainAPI.getSatellite('drawingEngine');
            
            if (!layerManagerProxy || !drawingEngineProxy) return false;
            
            const { strokeData } = record.data;
            
            // Recreate the stroke
            if (strokeData && strokeData.graphics) {
                return layerManagerProxy.request('addPathToActiveLayer', strokeData);
            }
            
            return false;
        }
        
        async undoLayerMove(record) {
            const layerManagerProxy = this.mainAPI.getSatellite('layerManager');
            if (!layerManagerProxy) return false;
            
            const { before } = record.data;
            return layerManagerProxy.request('reorderLayers', before.toIndex, before.fromIndex);
        }
        
        async redoLayerMove(record) {
            const layerManagerProxy = this.mainAPI.getSatellite('layerManager');
            if (!layerManagerProxy) return false;
            
            const { after } = record.data;
            return layerManagerProxy.request('reorderLayers', after.fromIndex, after.toIndex);
        }
        
        async undoLayerCreate(record) {
            const layerManagerProxy = this.mainAPI.getSatellite('layerManager');
            if (!layerManagerProxy) return false;
            
            const { layerId } = record.data;
            return layerManagerProxy.request('deleteLayer', layerId);
        }
        
        async redoLayerCreate(record) {
            const layerManagerProxy = this.mainAPI.getSatellite('layerManager');
            if (!layerManagerProxy) return false;
            
            const { name } = record.data;
            const newLayerId = layerManagerProxy.request('createLayer', name);
            
            // Update record with new ID
            record.data.layerId = newLayerId;
            return newLayerId !== null;
        }
        
        async undoLayerDelete(record) {
            const layerManagerProxy = this.mainAPI.getSatellite('layerManager');
            if (!layerManagerProxy) return false;
            
            const { layerData } = record.data;
            // Recreate layer with same properties
            const newLayerId = layerManagerProxy.request('createLayer', layerData.name);
            
            if (newLayerId !== null) {
                // Restore visibility if it was hidden
                if (!layerData.visible) {
                    layerManagerProxy.request('toggleLayerVisibility', newLayerId);
                }
                return true;
            }
            
            return false;
        }
        
        async redoLayerDelete(record) {
            const layerManagerProxy = this.mainAPI.getSatellite('layerManager');
            if (!layerManagerProxy) return false;
            
            const { layerId } = record.data;
            return layerManagerProxy.request('deleteLayer', layerId);
        }
        
        async undoLayerVisibility(record) {
            const layerManagerProxy = this.mainAPI.getSatellite('layerManager');
            if (!layerManagerProxy) return false;
            
            const { layerId } = record.data;
            return layerManagerProxy.request('toggleLayerVisibility', layerId);
        }
        
        async redoLayerVisibility(record) {
            return this.undoLayerVisibility(record); // Same operation
        }
        
        async undoCanvasResize(record) {
            const { before } = record.data;
            this.mainAPI.notify('canvas.resize', before);
            return true;
        }
        
        async redoCanvasResize(record) {
            const { after } = record.data;
            this.mainAPI.notify('canvas.resize', after);
            return true;
        }
    }
    
    class HistoryService {
        constructor() {
            this.mainAPI = null;
            this.stack = new HistoryStack();
            this.processor = null;
            this.isProcessing = false;
            this.recordingEnabled = true;
        }
        
        async register(mainAPI) {
            this.mainAPI = mainAPI;
            
            try {
                this.processor = new HistoryProcessor(mainAPI);
                
                // Setup event listeners
                this.setupEventListeners();
                
                this.mainAPI.notify('history.ready');
                return true;
                
            } catch (error) {
                this.mainAPI.notifyError('ERR_HISTORY_INIT_FAILED', 'History service initialization failed', error);
                throw error;
            }
        }
        
        setupEventListeners() {
            // Listen for history events from main
            this.mainAPI.notify('history.undo', {}, { 
                handler: () => this.performUndo() 
            });
            
            this.mainAPI.notify('history.redo', {}, { 
                handler: () => this.performRedo() 
            });
            
            this.mainAPI.notify('history.clear', {}, { 
                handler: () => this.clearHistory() 
            });
        }
        
        // Public API for main controller
        record(actionData) {
            if (!this.recordingEnabled || this.isProcessing) return null;
            
            try {
                const record = new HistoryRecord(actionData.type, actionData);
                this.stack.push(record);
                
                // Notify about history state change
                this.notifyHistoryStateChange();
                
                return record.id;
            } catch (error) {
                this.mainAPI.notifyError('ERR_HISTORY_RECORD', 'Failed to record history', error);
                return null;
            }
        }
        
        async performUndo() {
            if (!this.stack.canUndo() || this.isProcessing) return false;
            
            this.isProcessing = true;
            this.recordingEnabled = false;
            
            try {
                const record = this.stack.undo();
                if (!record) return false;
                
                const success = await this.processor.processUndo(record);
                
                if (!success) {
                    // Restore stack state if undo failed
                    this.stack.currentIndex++;
                }
                
                this.notifyHistoryStateChange();
                return success;
                
            } catch (error) {
                this.mainAPI.notifyError('ERR_HISTORY_UNDO', 'Undo operation failed', error);
                return false;
            } finally {
                this.isProcessing = false;
                this.recordingEnabled = true;
            }
        }
        
        async performRedo() {
            if (!this.stack.canRedo() || this.isProcessing) return false;
            
            this.isProcessing = true;
            this.recordingEnabled = false;
            
            try {
                const record = this.stack.redo();
                if (!record) return false;
                
                const success = await this.processor.processRedo(record);
                
                if (!success) {
                    // Restore stack state if redo failed
                    this.stack.currentIndex--;
                }
                
                this.notifyHistoryStateChange();
                return success;
                
            } catch (error) {
                this.mainAPI.notifyError('ERR_HISTORY_REDO', 'Redo operation failed', error);
                return false;
            } finally {
                this.isProcessing = false;
                this.recordingEnabled = true;
            }
        }
        
        clearHistory() {
            try {
                this.stack.clear();
                this.notifyHistoryStateChange();
                return true;
            } catch (error) {
                this.mainAPI.notifyError('ERR_HISTORY_CLEAR', 'Failed to clear history', error);
                return false;
            }
        }
        
        getHistoryState() {
            return {
                ...this.stack.getStats(),
                isProcessing: this.isProcessing,
                recordingEnabled: this.recordingEnabled
            };
        }
        
        setRecordingEnabled(enabled) {
            this.recordingEnabled = enabled;
        }
        
        notifyHistoryStateChange() {
            const state = this.getHistoryState();
            this.mainAPI.notify('history.stateChange', state);
            
            // Update UI if available
            const uiProxy = this.mainAPI.getSatellite('uiManager');
            if (uiProxy) {
                try {
                    uiProxy.request('updateHistoryState', state);
                } catch (error) {
                    // Non-critical error
                }
            }
        }
        
        // Event handlers called by main
        handleHistoryUndo() {
            return this.performUndo();
        }
        
        handleHistoryRedo() {
            return this.performRedo();
        }
        
        handleHistoryClear() {
            return this.clearHistory();
        }
        
        // Debug methods
        getStackContents() {
            if (!this.mainAPI.getConfig().debug) return [];
            
            return this.stack.stack.map((record, index) => ({
                index,
                id: record.id,
                type: record.type,
                timestamp: record.timestamp,
                isCurrent: index === this.stack.currentIndex,
                applied: record.applied
            }));
        }
        
        // Cleanup
        destroy() {
            this.clearHistory();
            this.mainAPI = null;
            this.stack = null;
            this.processor = null;
        }
    }
    
    return HistoryService;
})();