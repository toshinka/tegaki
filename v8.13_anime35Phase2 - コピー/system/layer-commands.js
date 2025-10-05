// ================================================================================
// system/layer-commands.js - Phase 2/3: Commandパターン完全導入
// ================================================================================
// 🎯 全てのレイヤー操作をCommand化
// ✅ StateManager経由で状態変更
// ✅ Undo/Redo完全対応

(function() {
  'use strict';

  // ===== CreateLayerCommand =====
  
  class CreateLayerCommand extends window.CommandBase {
    constructor(stateManager, eventBus, cutIndex, layerData) {
      super(stateManager, eventBus);
      this.cutIndex = cutIndex;
      this.layerData = layerData;
      this.createdLayerId = null;
    }

    execute() {
      this.createdLayerId = this.stateManager.addLayer(this.cutIndex, this.layerData);
      
      if (this.createdLayerId) {
        this.eventBus.emit('layer:created', {
          cutIndex: this.cutIndex,
          layerId: this.createdLayerId,
          layerData: this.stateManager.getLayer(
            this.cutIndex,
            this.stateManager.findLayerIndexById(this.cutIndex, this.createdLayerId)
          )
        });
      }
    }

    undo() {
      if (!this.createdLayerId) return;

      const layerIndex = this.stateManager.findLayerIndexById(this.cutIndex, this.createdLayerId);
      
      if (layerIndex !== -1) {
        this.stateManager.removeLayer(this.cutIndex, layerIndex);
        
        this.eventBus.emit('layer:deleted', {
          cutIndex: this.cutIndex,
          layerId: this.createdLayerId
        });
      }
    }

    redo() {
      this.execute();
    }
  }

  // ===== DeleteLayerCommand =====
  
  class DeleteLayerCommand extends window.CommandBase {
    constructor(stateManager, eventBus, cutIndex, layerIndex) {
      super(stateManager, eventBus);
      this.cutIndex = cutIndex;
      this.layerIndex = layerIndex;
      this.deletedLayer = null;
    }

    execute() {
      this.deletedLayer = this.stateManager.getLayer(this.cutIndex, this.layerIndex);
      
      if (this.deletedLayer) {
        this.stateManager.removeLayer(this.cutIndex, this.layerIndex);
        
        this.eventBus.emit('layer:deleted', {
          cutIndex: this.cutIndex,
          layerId: this.deletedLayer.id
        });
      }
    }

    undo() {
      if (!this.deletedLayer) return;

      this.stateManager.addLayer(this.cutIndex, this.deletedLayer);
      
      const newIndex = this.stateManager.findLayerIndexById(this.cutIndex, this.deletedLayer.id);
      
      if (newIndex !== -1 && newIndex !== this.layerIndex) {
        this.stateManager.reorderLayers(this.cutIndex, newIndex, this.layerIndex);
      }
      
      this.eventBus.emit('layer:created', {
        cutIndex: this.cutIndex,
        layerId: this.deletedLayer.id,
        layerData: this.deletedLayer
      });
    }

    redo() {
      this.execute();
    }
  }

  // ===== ReorderLayersCommand =====
  
  class ReorderLayersCommand extends window.CommandBase {
    constructor(stateManager, eventBus, cutIndex, fromIndex, toIndex) {
      super(stateManager, eventBus);
      this.cutIndex = cutIndex;
      this.fromIndex = fromIndex;
      this.toIndex = toIndex;
    }

    execute() {
      const success = this.stateManager.reorderLayers(
        this.cutIndex,
        this.fromIndex,
        this.toIndex
      );
      
      if (success) {
        this.eventBus.emit('layer:reordered', {
          cutIndex: this.cutIndex,
          fromIndex: this.fromIndex,
          toIndex: this.toIndex
        });
      }
    }

    undo() {
      const success = this.stateManager.reorderLayers(
        this.cutIndex,
        this.toIndex,
        this.fromIndex
      );
      
      if (success) {
        this.eventBus.emit('layer:reordered', {
          cutIndex: this.cutIndex,
          fromIndex: this.toIndex,
          toIndex: this.fromIndex
        });
      }
    }

    redo() {
      this.execute();
    }
  }

  // ===== UpdateLayerCommand =====
  
  class UpdateLayerCommand extends window.CommandBase {
    constructor(stateManager, eventBus, cutIndex, layerIndex, updates) {
      super(stateManager, eventBus);
      this.cutIndex = cutIndex;
      this.layerIndex = layerIndex;
      this.updates = updates;
      this.previousState = null;
    }

    execute() {
      const layer = this.stateManager.getLayer(this.cutIndex, this.layerIndex);
      
      if (layer) {
        this.previousState = {};
        Object.keys(this.updates).forEach(key => {
          this.previousState[key] = layer[key];
        });
        
        this.stateManager.updateLayer(this.cutIndex, this.layerIndex, this.updates);
        
        this.eventBus.emit('layer:updated', {
          cutIndex: this.cutIndex,
          layerIndex: this.layerIndex,
          updates: this.updates
        });
      }
    }

    undo() {
      if (!this.previousState) return;

      this.stateManager.updateLayer(this.cutIndex, this.layerIndex, this.previousState);
      
      this.eventBus.emit('layer:updated', {
        cutIndex: this.cutIndex,
        layerIndex: this.layerIndex,
        updates: this.previousState
      });
    }

    redo() {
      this.execute();
    }
  }

  // ===== ClearLayerCommand =====
  
  class ClearLayerCommand extends window.CommandBase {
    constructor(stateManager, eventBus, cutIndex, layerIndex) {
      super(stateManager, eventBus);
      this.cutIndex = cutIndex;
      this.layerIndex = layerIndex;
      this.previousPaths = null;
    }

    execute() {
      const layer = this.stateManager.getLayer(this.cutIndex, this.layerIndex);
      
      if (layer) {
        this.previousPaths = layer.paths;
        this.stateManager.clearLayerPaths(this.cutIndex, this.layerIndex);
        
        this.eventBus.emit('layer:cleared', {
          cutIndex: this.cutIndex,
          layerIndex: this.layerIndex
        });
      }
    }

    undo() {
      if (!this.previousPaths) return;

      const layer = this.stateManager.getLayer(this.cutIndex, this.layerIndex);
      
      if (layer) {
        this.stateManager.updateLayer(this.cutIndex, this.layerIndex, {
          paths: this.previousPaths
        });
        
        this.eventBus.emit('layer:paths-restored', {
          cutIndex: this.cutIndex,
          layerIndex: this.layerIndex,
          paths: this.previousPaths
        });
      }
    }

    redo() {
      this.execute();
    }
  }

  // ===== グローバル公開 =====
  
  window.CreateLayerCommand = CreateLayerCommand;
  window.DeleteLayerCommand = DeleteLayerCommand;
  window.ReorderLayersCommand = ReorderLayersCommand;
  window.UpdateLayerCommand = UpdateLayerCommand;
  window.ClearLayerCommand = ClearLayerCommand;

  console.log('✅ layer-commands.js loaded (Phase 2/3)');

})();