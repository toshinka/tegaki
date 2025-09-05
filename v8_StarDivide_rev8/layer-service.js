/**
 * ==========================================================
 * @module LayerService
 * @role   レイヤーの生成・順序管理・非破壊レイヤー移動
 * @depends MainController (イベント経由)
 * @provides
 *   - createLayer(name): 新しいレイヤーを生成
 *   - reorderLayer(fromIndex, toIndex): レイヤー順序を変更
 *   - getLayerList(): 現在のレイヤー情報を返す
 *   - prepareReorder(payload): レイヤー移動の事前検証
 * @notes
 *   - レイヤーの座標変形は TransformTool に委譲する。
 *   - 確定イベントは主星を経由して HistoryService に登録される。
 * ==========================================================
 */
window.MyApp = window.MyApp || {};
(function(global){
    class LayerService {
        constructor() {
            this.name = 'LayerService';
            this.mainApi = null;
            this.layers = []; // [{id, name, visible, locked}]
            this._nextId = 0;
        }

        register(mainApi) { 
            this.mainApi = mainApi; 
            // 初期レイヤー作成
            this.createLayer('背景', true);
            this.createLayer('レイヤー1');
        }

        createLayer(name = 'Layer', isBackground = false) { 
            const id = isBackground ? 0 : this._nextId++;
            const layerName = name || (isBackground ? '背景' : `レイヤー${id}`);
            
            const layer = { 
                id, 
                name: layerName, 
                visible: true, 
                locked: false,
                isBackground: isBackground
            };
            
            if (isBackground) {
                // 背景レイヤーは先頭に追加
                this.layers.unshift(layer);
            } else {
                this.layers.push(layer);
            }
            
            if(global.MyApp.debug) {
                console.log(`[LayerService] Created layer: ${layerName} (ID: ${id})`);
            }
            
            return id;
        }

        getLayerList() { 
            return this.layers.map(l => Object.assign({}, l)); // immutable copy
        }

        reorderLayer(fromIndex, toIndex) {
            if(fromIndex < 0 || toIndex < 0 || fromIndex >= this.layers.length || toIndex >= this.layers.length) {
                return false;
            }
            
            // 背景レイヤーは移動不可
            const fromLayer = this.layers[fromIndex];
            if(fromLayer && fromLayer.isBackground) {
                return false;
            }
            
            const item = this.layers.splice(fromIndex, 1)[0];
            this.layers.splice(toIndex, 0, item);
            
            if(global.MyApp.debug) {
                console.log(`[LayerService] Reordered: ${fromIndex} -> ${toIndex}`);
            }
            
            return true;
        }

        prepareReorder(payload) {
            // レイヤー移動の事前検証
            const { fromIndex, toIndex } = payload;
            
            if(fromIndex < 0 || fromIndex >= this.layers.length) return false;
            if(toIndex < 0 || toIndex >= this.layers.length) return false;
            if(fromIndex === toIndex) return false;
            
            const layer = this.layers[fromIndex];
            if(!layer) return false;
            
            // ロックされたレイヤーは移動不可
            if(layer.locked) return false;
            
            // 背景レイヤーは移動不可
            if(layer.isBackground) return false;
            
            return true;
        }

        toggleLayerVisibility(layerId) {
            const layer = this.layers.find(l => l.id === layerId);
            if(layer) {
                layer.visible = !layer.visible;
                if(global.MyApp.debug) {
                    console.log(`[LayerService] Toggle visibility: ${layer.name} -> ${layer.visible}`);
                }
                return true;
            }
            return false;
        }

        setActiveLayer(layerId) {
            const layer = this.layers.find(l => l.id === layerId);
            if(layer) {
                // アクティブレイヤーの管理（簡易実装）
                this.layers.forEach(l => l.active = false);
                layer.active = true;
                
                if(global.MyApp.debug) {
                    console.log(`[LayerService] Active layer: ${layer.name}`);
                }
                return true;
            }
            return false;
        }

        deleteLayer(layerId) {
            // 背景レイヤーは削除不可
            if(layerId === 0) return false;
            
            // 最低1つのレイヤーは残す
            const nonBackgroundLayers = this.layers.filter(l => !l.isBackground);
            if(nonBackgroundLayers.length <= 1) return false;
            
            const index = this.layers.findIndex(l => l.id === layerId);
            if(index >= 0) {
                const removed = this.layers.splice(index, 1)[0];
                if(global.MyApp.debug) {
                    console.log(`[LayerService] Deleted layer: ${removed.name}`);
                }
                return true;
            }
            return false;
        }

        getLayerData(layerId) {
            return this.layers.find(l => l.id === layerId);
        }

        updateCanvasSize(width, height) {
            // キャンバスサイズ更新時の処理（必要に応じて実装）
            if(global.MyApp.debug) {
                console.log(`[LayerService] Canvas size updated: ${width}x${height}`);
            }
        }

        // 主星からの呼び出し用ヘルパー
        addPathToActiveLayer(pathData) {
            // アクティブレイヤーへのパス追加（簡易実装）
            const activeLayer = this.layers.find(l => l.active);
            if(activeLayer && pathData) {
                if(global.MyApp.debug) {
                    console.log(`[LayerService] Added path to layer: ${activeLayer.name}`);
                }
                return true;
            }
            return false;
        }
    }

    global.MyApp.LayerService = LayerService;
})(window);