// ================================================================================
// system/animation-commands.js - Phase 3: Animation操作のCommand化
// ================================================================================
// 🎯 全てのCUT操作をCommand化
// ✅ StateManager経由で状態変更
// ✅ Undo/Redo完全対応

(function() {
  'use strict';

  // ===== CreateCutCommand =====
  
  class CreateCutCommand extends window.CommandBase {
    constructor(stateManager, eventBus, cutData, insertIndex = -1) {
      super(stateManager, eventBus);
      this.cutData = cutData;
      this.insertIndex = insertIndex;
      this.createdCutId = null;
      this.actualInsertIndex = -1;
    }

    execute() {
      this.actualInsertIndex = this.insertIndex === -1 ? 
        this.stateManager.state.cuts.length : this.insertIndex;
      
      this.createdCutId = this.stateManager.addCut(this.cutData, this.insertIndex);
      
      if (this.createdCutId) {
        this.eventBus.emit('animation:cut-created', {
          cutId: this.createdCutId,
          cutIndex: this.actualInsertIndex,
          cutData: this.stateManager.getCut(
            this.stateManager.findCutIndexById(this.createdCutId)
          )
        });
      }
    }

    undo() {
      if (!this.createdCutId) return;

      const cutIndex = this.stateManager.findCutIndexById(this.createdCutId);
      
      if (cutIndex !== -1) {
        this.stateManager.removeCut(cutIndex);
        
        this.eventBus.emit('animation:cut-deleted', {
          cutId: this.createdCutId,
          cutIndex: cutIndex
        });
      }
    }

    redo() {
      this.execute();
    }
  }

  // ===== DeleteCutCommand =====
  
  class DeleteCutCommand extends window.CommandBase {
    constructor(stateManager, eventBus, cutIndex) {
      super(stateManager, eventBus);
      this.cutIndex = cutIndex;
      this.deletedCut = null;
    }

    execute() {
      this.deletedCut = this.stateManager.getCut(this.cutIndex);
      
      if (this.deletedCut) {
        this.stateManager.removeCut(this.cutIndex);
        
        this.eventBus.emit('animation:cut-deleted', {
          cutId: this.deletedCut.id,
          cutIndex: this.cutIndex
        });
      }
    }

    undo() {
      if (!this.deletedCut) return;

      this.stateManager.addCut(this.deletedCut, this.cutIndex);
      
      this.eventBus.emit('animation:cut-created', {
        cutId: this.deletedCut.id,
        cutIndex: this.cutIndex,
        cutData: this.deletedCut
      });
    }

    redo() {
      this.execute();
    }
  }

  // ===== ReorderCutsCommand =====
  
  class ReorderCutsCommand extends window.CommandBase {
    constructor(stateManager, eventBus, fromIndex, toIndex) {
      super(stateManager, eventBus);
      this.fromIndex = fromIndex;
      this.toIndex = toIndex;
    }

    execute() {
      const success = this.stateManager.reorderCuts(this.fromIndex, this.toIndex);
      
      if (success) {
        this.eventBus.emit('animation:cuts-reordered', {
          fromIndex: this.fromIndex,
          toIndex: this.toIndex
        });
      }
    }

    undo() {
      const success = this.stateManager.reorderCuts(this.toIndex, this.fromIndex);
      
      if (success) {
        this.eventBus.emit('animation:cuts-reordered', {
          fromIndex: this.toIndex,
          toIndex: this.fromIndex
        });
      }
    }

    redo() {
      this.execute();
    }
  }

  // ===== UpdateCutCommand =====
  
  class UpdateCutCommand extends window.CommandBase {
    constructor(stateManager, eventBus, cutIndex, updates) {
      super(stateManager, eventBus);
      this.cutIndex = cutIndex;
      this.updates = updates;
      this.previousState = null;
    }

    execute() {
      const cut = this.stateManager.getCut(this.cutIndex);
      
      if (cut) {
        this.previousState = {};
        Object.keys(this.updates).forEach(key => {
          this.previousState[key] = cut[key];
        });
        
        this.stateManager.updateCut(this.cutIndex, this.updates);
        
        this.eventBus.emit('animation:cut-updated', {
          cutIndex: this.cutIndex,
          updates: this.updates
        });
      }
    }

    undo() {
      if (!this.previousState) return;

      this.stateManager.updateCut(this.cutIndex, this.previousState);
      
      this.eventBus.emit('animation:cut-updated', {
        cutIndex: this.cutIndex,
        updates: this.previousState
      });
    }

    redo() {
      this.execute();
    }
  }

  // ===== グローバル公開 =====
  
  window.CreateCutCommand = CreateCutCommand;
  window.DeleteCutCommand = DeleteCutCommand;
  window.ReorderCutsCommand = ReorderCutsCommand;
  window.UpdateCutCommand = UpdateCutCommand;

  console.log('✅ animation-commands.js loaded (Phase 3)');

})();