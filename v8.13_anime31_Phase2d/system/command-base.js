// ================================================================================
// system/command-base.js - Commandパターン基底クラス
// ================================================================================
// 🎯 全てのCommandの基底クラス
// ✅ execute/undo/redoインターフェース定義

(function() {
  'use strict';

  class CommandBase {
    constructor(stateManager, eventBus) {
      this.stateManager = stateManager;
      this.eventBus = eventBus;
    }

    execute() {
      throw new Error('CommandBase.execute() must be implemented by subclass');
    }

    undo() {
      throw new Error('CommandBase.undo() must be implemented by subclass');
    }

    redo() {
      this.execute();
    }
  }

  // ===== グローバル公開 =====
  
  window.CommandBase = CommandBase;
  
  console.log('✅ command-base.js loaded');

})();