// ================================================================================
// system/state-manager.js - Phase 2: StateManager強化とデータ所有権明確化
// ================================================================================
// 🎯 唯一のデータストアとして機能
// ✅ 全てのレイヤー/CUT/Pathデータを管理
// ✅ Immutableな状態更新
// ✅ 変更通知によるリスナーへの伝播

(function() {
  'use strict';

  class TegakiStateManager {
    constructor(config, eventBus) {
      this.config = config;
      this.eventBus = eventBus;
      this.state = this.createInitialState();
      this.listeners = [];
    }

    // ===== 初期状態の作成 =====
    
    createInitialState() {
      const initialCutId = `cut_${Date.now()}`;
      const bgLayerId = `layer_${Date.now()}_bg`;
      const layer1Id = `layer_${Date.now() + 1}`;

      return {
        cuts: [
          {
            id: initialCutId,
            name: 'CUT1',
            duration: 0.5,
            layers: [
              {
                id: bgLayerId,
                name: '背景',
                visible: true,
                opacity: 1.0,
                isBackground: true,
                transform: {
                  x: 0, y: 0,
                  rotation: 0,
                  scaleX: 1, scaleY: 1,
                  pivotX: 0, pivotY: 0
                },
                paths: []
              },
              {
                id: layer1Id,
                name: 'レイヤー1',
                visible: true,
                opacity: 1.0,
                isBackground: false,
                transform: {
                  x: 0, y: 0,
                  rotation: 0,
                  scaleX: 1, scaleY: 1,
                  pivotX: 0, pivotY: 0
                },
                paths: []
              }
            ]
          }
        ],
        currentCutIndex: 0,
        currentLayerIndex: 1,
        settings: {
          loop: true,
          animationFPS: 24
        }
      };
    }

    // ===== 状態の取得 =====
    
    getState() {
      return JSON.parse(JSON.stringify(this.state));
    }

    setState(newState, source = 'unknown') {
      this.state = JSON.parse(JSON.stringify(newState));
      this.notifyListeners(source);
    }

    // ===== リスナー管理 =====
    
    addListener(callback) {
      this.listeners.push(callback);
    }

    removeListener(callback) {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    }

    notifyListeners(source) {
      this.listeners.forEach(callback => {
        try {
          callback(this.state, source);
        } catch (error) {
          console.error('❌ Listener error:', error);
        }
      });
    }

    // ===== CUT操作 =====
    
    addCut(cutData, insertIndex = -1) {
      const newState = this.getState();
      const cutId = cutData.id || `cut_${Date.now()}`;
      
      const newCut = {
        id: cutId,
        name: cutData.name || `CUT${newState.cuts.length + 1}`,
        duration: cutData.duration || 0.5,
        layers: cutData.layers || []
      };

      if (insertIndex === -1 || insertIndex >= newState.cuts.length) {
        newState.cuts.push(newCut);
      } else {
        newState.cuts.splice(insertIndex, 0, newCut);
      }

      this.setState(newState, 'cut:added');
      return cutId;
    }

    removeCut(cutIndex) {
      if (cutIndex < 0 || cutIndex >= this.state.cuts.length) {
        return null;
      }

      const newState = this.getState();
      const removedCut = newState.cuts.splice(cutIndex, 1)[0];

      if (newState.cuts.length === 0) {
        newState.cuts.push(this.createInitialState().cuts[0]);
      }

      if (newState.currentCutIndex >= newState.cuts.length) {
        newState.currentCutIndex = newState.cuts.length - 1;
      }

      this.setState(newState, 'cut:removed');
      return removedCut;
    }

    updateCut(cutIndex, updates) {
      if (cutIndex < 0 || cutIndex >= this.state.cuts.length) {
        return false;
      }

      const newState = this.getState();
      Object.assign(newState.cuts[cutIndex], updates);
      this.setState(newState, 'cut:updated');
      return true;
    }

    reorderCuts(fromIndex, toIndex) {
      if (fromIndex < 0 || fromIndex >= this.state.cuts.length ||
          toIndex < 0 || toIndex >= this.state.cuts.length) {
        return false;
      }

      const newState = this.getState();
      const [movedCut] = newState.cuts.splice(fromIndex, 1);
      newState.cuts.splice(toIndex, 0, movedCut);

      if (newState.currentCutIndex === fromIndex) {
        newState.currentCutIndex = toIndex;
      } else if (fromIndex < newState.currentCutIndex && toIndex >= newState.currentCutIndex) {
        newState.currentCutIndex--;
      } else if (fromIndex > newState.currentCutIndex && toIndex <= newState.currentCutIndex) {
        newState.currentCutIndex++;
      }

      this.setState(newState, 'cut:reordered');
      return true;
    }

    getCut(cutIndex) {
      if (cutIndex < 0 || cutIndex >= this.state.cuts.length) {
        return null;
      }
      return JSON.parse(JSON.stringify(this.state.cuts[cutIndex]));
    }

    getCurrentCut() {
      return this.getCut(this.state.currentCutIndex);
    }

    getAllCuts() {
      return JSON.parse(JSON.stringify(this.state.cuts));
    }

    findCutIndexById(cutId) {
      return this.state.cuts.findIndex(cut => cut.id === cutId);
    }

    // ===== レイヤー操作 =====
    
    addLayer(cutIndex, layerData) {
      if (cutIndex < 0 || cutIndex >= this.state.cuts.length) {
        return null;
      }

      const newState = this.getState();
      const layerId = layerData.id || `layer_${Date.now()}`;
      
      const newLayer = {
        id: layerId,
        name: layerData.name || `レイヤー${newState.cuts[cutIndex].layers.length + 1}`,
        visible: layerData.visible !== undefined ? layerData.visible : true,
        opacity: layerData.opacity !== undefined ? layerData.opacity : 1.0,
        isBackground: layerData.isBackground || false,
        transform: layerData.transform || {
          x: 0, y: 0,
          rotation: 0,
          scaleX: 1, scaleY: 1,
          pivotX: 0, pivotY: 0
        },
        paths: layerData.paths || []
      };

      newState.cuts[cutIndex].layers.push(newLayer);
      this.setState(newState, 'layer:added');
      return layerId;
    }

    removeLayer(cutIndex, layerIndex) {
      if (cutIndex < 0 || cutIndex >= this.state.cuts.length) {
        return null;
      }

      const cut = this.state.cuts[cutIndex];
      if (layerIndex < 0 || layerIndex >= cut.layers.length) {
        return null;
      }

      const newState = this.getState();
      const removedLayer = newState.cuts[cutIndex].layers.splice(layerIndex, 1)[0];

      if (newState.cuts[cutIndex].layers.length === 0) {
        const bgLayer = {
          id: `layer_${Date.now()}_bg`,
          name: '背景',
          visible: true,
          opacity: 1.0,
          isBackground: true,
          transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
          paths: []
        };
        newState.cuts[cutIndex].layers.push(bgLayer);
      }

      if (cutIndex === newState.currentCutIndex) {
        if (newState.currentLayerIndex >= newState.cuts[cutIndex].layers.length) {
          newState.currentLayerIndex = newState.cuts[cutIndex].layers.length - 1;
        }
      }

      this.setState(newState, 'layer:removed');
      return removedLayer;
    }

    updateLayer(cutIndex, layerIndex, updates) {
      if (cutIndex < 0 || cutIndex >= this.state.cuts.length) {
        return false;
      }

      const cut = this.state.cuts[cutIndex];
      if (layerIndex < 0 || layerIndex >= cut.layers.length) {
        return false;
      }

      const newState = this.getState();
      const layer = newState.cuts[cutIndex].layers[layerIndex];
      
      Object.keys(updates).forEach(key => {
        if (key === 'transform' && typeof updates[key] === 'object') {
          layer.transform = { ...layer.transform, ...updates[key] };
        } else {
          layer[key] = updates[key];
        }
      });

      this.setState(newState, 'layer:updated');
      return true;
    }

    reorderLayers(cutIndex, fromIndex, toIndex) {
      if (cutIndex < 0 || cutIndex >= this.state.cuts.length) {
        return false;
      }

      const cut = this.state.cuts[cutIndex];
      if (fromIndex < 0 || fromIndex >= cut.layers.length ||
          toIndex < 0 || toIndex >= cut.layers.length) {
        return false;
      }

      const newState = this.getState();
      const [movedLayer] = newState.cuts[cutIndex].layers.splice(fromIndex, 1);
      newState.cuts[cutIndex].layers.splice(toIndex, 0, movedLayer);

      if (cutIndex === newState.currentCutIndex) {
        if (newState.currentLayerIndex === fromIndex) {
          newState.currentLayerIndex = toIndex;
        } else if (fromIndex < newState.currentLayerIndex && toIndex >= newState.currentLayerIndex) {
          newState.currentLayerIndex--;
        } else if (fromIndex > newState.currentLayerIndex && toIndex <= newState.currentLayerIndex) {
          newState.currentLayerIndex++;
        }
      }

      this.setState(newState, 'layer:reordered');
      return true;
    }

    getLayer(cutIndex, layerIndex) {
      if (cutIndex < 0 || cutIndex >= this.state.cuts.length) {
        return null;
      }

      const cut = this.state.cuts[cutIndex];
      if (layerIndex < 0 || layerIndex >= cut.layers.length) {
        return null;
      }

      return JSON.parse(JSON.stringify(cut.layers[layerIndex]));
    }

    getCurrentLayers() {
      const cut = this.getCurrentCut();
      return cut ? cut.layers : [];
    }

    getCurrentLayer() {
      return this.getLayer(this.state.currentCutIndex, this.state.currentLayerIndex);
    }

    findLayerIndexById(cutIndex, layerId) {
      if (cutIndex < 0 || cutIndex >= this.state.cuts.length) {
        return -1;
      }

      return this.state.cuts[cutIndex].layers.findIndex(layer => layer.id === layerId);
    }

    // ===== Path操作 =====
    
    addPath(cutIndex, layerIndex, pathData) {
      if (cutIndex < 0 || cutIndex >= this.state.cuts.length) {
        return null;
      }

      const cut = this.state.cuts[cutIndex];
      if (layerIndex < 0 || layerIndex >= cut.layers.length) {
        return null;
      }

      const newState = this.getState();
      const pathId = pathData.id || `path_${Date.now()}`;
      
      const newPath = {
        id: pathId,
        points: pathData.points || [],
        color: pathData.color !== undefined ? pathData.color : 0x800000,
        size: pathData.size !== undefined ? pathData.size : 16,
        opacity: pathData.opacity !== undefined ? pathData.opacity : 1.0,
        tool: pathData.tool || 'pen'
      };

      newState.cuts[cutIndex].layers[layerIndex].paths.push(newPath);
      this.setState(newState, 'path:added');
      return pathId;
    }

    removePath(cutIndex, layerIndex, pathId) {
      if (cutIndex < 0 || cutIndex >= this.state.cuts.length) {
        return null;
      }

      const cut = this.state.cuts[cutIndex];
      if (layerIndex < 0 || layerIndex >= cut.layers.length) {
        return null;
      }

      const newState = this.getState();
      const paths = newState.cuts[cutIndex].layers[layerIndex].paths;
      const pathIndex = paths.findIndex(p => p.id === pathId);
      
      if (pathIndex === -1) {
        return null;
      }

      const removedPath = paths.splice(pathIndex, 1)[0];
      this.setState(newState, 'path:removed');
      return removedPath;
    }

    clearLayerPaths(cutIndex, layerIndex) {
      if (cutIndex < 0 || cutIndex >= this.state.cuts.length) {
        return false;
      }

      const cut = this.state.cuts[cutIndex];
      if (layerIndex < 0 || layerIndex >= cut.layers.length) {
        return false;
      }

      const newState = this.getState();
      newState.cuts[cutIndex].layers[layerIndex].paths = [];
      this.setState(newState, 'paths:cleared');
      return true;
    }

    // ===== アクティブ状態管理 =====
    
    setActiveCut(cutIndex) {
      if (cutIndex < 0 || cutIndex >= this.state.cuts.length) {
        return false;
      }

      const newState = this.getState();
      newState.currentCutIndex = cutIndex;
      
      const cut = newState.cuts[cutIndex];
      if (newState.currentLayerIndex >= cut.layers.length) {
        newState.currentLayerIndex = cut.layers.length - 1;
      }

      this.setState(newState, 'active-cut:changed');
      return true;
    }

    setActiveLayer(cutIndex, layerIndex) {
      if (cutIndex < 0 || cutIndex >= this.state.cuts.length) {
        return false;
      }

      const cut = this.state.cuts[cutIndex];
      if (layerIndex < 0 || layerIndex >= cut.layers.length) {
        return false;
      }

      const newState = this.getState();
      if (cutIndex !== newState.currentCutIndex) {
        newState.currentCutIndex = cutIndex;
      }
      newState.currentLayerIndex = layerIndex;

      this.setState(newState, 'active-layer:changed');
      return true;
    }

    getCurrentCutIndex() {
      return this.state.currentCutIndex;
    }

    getCurrentLayerIndex() {
      return this.state.currentLayerIndex;
    }

    // ===== 設定管理 =====
    
    updateSettings(updates) {
      const newState = this.getState();
      newState.settings = { ...newState.settings, ...updates };
      this.setState(newState, 'settings:updated');
    }

    getSettings() {
      return JSON.parse(JSON.stringify(this.state.settings));
    }

    // ===== デバッグ情報 =====
    
    getDebugInfo() {
      return {
        cutsCount: this.state.cuts.length,
        currentCutIndex: this.state.currentCutIndex,
        currentLayerIndex: this.state.currentLayerIndex,
        currentCutLayersCount: this.state.cuts[this.state.currentCutIndex]?.layers.length || 0,
        listenersCount: this.listeners.length
      };
    }
  }

  // ===== グローバル公開 =====
  
  window.TegakiStateManager = TegakiStateManager;
  
  console.log('✅ state-manager.js loaded (Phase 2)');

})();