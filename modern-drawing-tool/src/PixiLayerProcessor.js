/**
 * PixiLayerProcessor v3.2 - PixiJS非破壊レイヤー管理システム
 * PixiJS Container階層活用・ベクター完全保持・Chrome API統合
 * 規約: 総合AIコーディング規約v4.1準拠（PixiJS統一座標対応）
 */

import * as PIXI from 'pixi.js';
import { cloneDeep } from 'lodash-es';

/**
 * PixiJS統一レイヤー管理システム
 * Container階層による非破壊レイヤー操作・完全ベクター保持
 */
export class PixiLayerProcessor {
    constructor(pixiApp, coordinateUnifier, eventStore) {
        this.app = pixiApp;
        this.coordinate = coordinateUnifier;
        this.eventStore = eventStore;
        
        // レイヤー管理
        this.layers = new Map();
        this.layerOrder = [];
        this.activeLayerId = null;
        this.layerIdCounter = 1;
        
        // PixiJS Container階層
        this.layerContainer = new PIXI.Container();
        this.app.stage.addChild(this.layerContainer);
        
        // レイヤーグループ管理
        this.layerGroups = new Map();
        this.groupIdCounter = 1;
        
        // 非破壊変換履歴
        this.transformHistory = new Map();
        this.blendModeHistory = new Map();
        
        // サムネイル生成
        this.thumbnailCache = new Map();
        this.thumbnailSize = { width: 64, height: 64 };
        
        // パフォーマンス最適化
        this.cullingBounds = new PIXI.Rectangle();
        this.visibilityCache = new Map();
        this.renderOptimization = true;
        
        // Chrome API統合
        this.offscreenProcessing = false;
        this.layerWorkers = new Map();
        
        this.initialize();
    }
    
    /**
     * レイヤープロセッサー初期化
     */
    initialize() {
        try {
            console.log('📚 PixiLayerProcessor初期化開始 - 非破壊レイヤーシステム');
            
            // デフォルトレイヤー作成
            this.createDefaultLayer();
            
            // PixiJS Container最適化
            this.setupContainerOptimization();
            
            // イベントリスナー設定
            this.setupEventListeners();
            
            // カリング・最適化設定
            this.setupRenderOptimization();
            
            console.log('✅ PixiLayerProcessor初期化完了 - 非破壊レイヤーシステム稼働');
            
        } catch (