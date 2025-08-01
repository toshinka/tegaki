// LayerProcessor.js - レイヤー処理統合（Phase2・封印解除時実装）

import { cloneDeep, remove, findIndex } from 'lodash-es';

/**
 * 🌈 レイヤー処理統合（Phase2・封印解除時実装）
 * 責務: LodashLayerStore・階層管理、初期レイヤー設定・背景処理、市松模様背景・透明表示、レイヤーブレンド・合成
 */
export class LayerProcessor {
    constructor(oglEngine, eventStore) {
        this.engine = oglEngine;
        this.eventStore = eventStore;
        
        // レイヤー管理
        this.layers = [];
        this.layerIdCounter = 1;
        this.activeLayerId = null;
        this.maxLayers = 100;
        
        // レイヤーフォルダ管理
        this.folders = [];
        this.folderIdCounter = 1;
        
        // レイヤー状態
        this.layerVisible = true;
        this.backgroundVisible = true;
        this.transparencyCheckerboard = true