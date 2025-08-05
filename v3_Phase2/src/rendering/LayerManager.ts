// LayerManager.ts - レイヤーシステム・Container階層管理・20レイヤー制限
// Phase1 EventBus・DrawingEngine継承・責任分界設計

import * as PIXI from 'pixi.js';
import type { EventBus, IEventData } from '../core/EventBus.js';

/**
 * レイヤーデータ・状態管理
 */
export interface ILayerData {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  blendMode: PIXI.BlendModes;
  container: PIXI.Graphics;
  zIndex: number;
  thumbnail?: string; // Phase2後半実装予定
  locked: boolean;
  created: number;
  modified: number;
}

/**
 * レイヤー操作結果
 */
interface ILayerOperationResult {
  success: boolean;
  layerId?: string;
  error?: string;
  data?: ILayerData;
}

/**
 * レイヤー統計情報
 */
interface ILayerStats {
  totalLayers: number;
  visibleLayers: number;
  activeLayers: number;
  memoryUsageMB: number;
}

/**
 * レイヤー管理システム・Container階層制御
 * Phase1基盤継承・EventBus連携・型安全設計
 */
export class LayerManager {
  private eventBus: EventBus;
  private pixiApp: PIXI.Application;
  
  // レイヤー管理
  private layers = new Map<string, ILayerData>();
  private layerOrder: string[] = [];
  private activeLayerId: string | null = null;
  
  // 制限・設定
  private readonly maxLayers = 20;
  private layerIdCounter = 0;
  
  // Container階層・Phase1 DrawingEngine連携
  private layersContainer: PIXI.Container;
  private drawingContainer: PIXI.Container | null = null;

  constructor(eventBus: EventBus, pixiApp: PIXI.Application) {
    this.eventBus = eventBus;
    this.pixiApp = pixiApp;
    
    this.initializeLayerSystem();
    this.setupEventListeners();
    this.createDefaultLayer();
    
    console.log('📑 LayerManager初期化完了');
  }

  /**
   * レイヤーシステム初期化・Container階層構築
   */
  private initializeLayerSystem(): void {
    // レイヤー専用コンテナ作成
    this.layersContainer = new PIXI.Container();
    this.layersContainer.name = 'LayersContainer';
    this.layersContainer.sortableChildren = true;
    
    // DrawingContainer参照取得・Phase1連携
    const existingDrawingContainer = this.pixiApp.stage.getChildByName('DrawingContainer') as PIXI.Container;
    if (existingDrawingContainer) {
      this.drawingContainer = existingDrawingContainer;
      // レイヤーコンテナを描画コンテナ内に配置
      this.drawingContainer.addChild(this.layersContainer);
    } else {
      // フォールバック・直接stage追加
      this.pixiApp.stage.addChild(this.layersContainer);
      console.warn('📑 DrawingContainer未発見・stage直接追加');
    }
  }

  /**
   * イベントリスナー設定・UI連携
   */
  private setupEventListeners(): void {
    // UIイベント処理
    this.eventBus.on('ui:layer-create', () => {
      this.createLayer();
    });

    this.eventBus.on('ui:layer-delete', (data) => {
      this.deleteLayer(data.layerId);
    });

    this.eventBus.on('ui:layer-reorder', (data) => {
      this.reorderLayer(data.layerId, data.newIndex);
    });

    this.eventBus.on('ui:layer-select', (data) => {
      this.setActiveLayer(data.layerId);
    });

    this.eventBus.on('ui:layer-visibility-toggle', (data) => {
      this.toggleLayerVisibility(data.layerId);
    });

    this.eventBus.on('ui:layer-opacity-change', (data) => {
      this.setLayerOpacity(data.layerId, data.opacity);
    });

    this.eventBus.on('ui:layer-blend-mode-change', (data) => {
      this.setLayerBlendMode(data.layerId, data.blendMode);
    });
  }

  /**
   * デフォルトレイヤー作成・初期設定
   */
  private createDefaultLayer(): void {
    const result = this.createLayer('背景', 0);
    if (result.success && result.layerId) {
      this.setActiveLayer(result.layerId);
    }
  }

  /**
   * 新規レイヤー作成・Container生成
   */
  public createLayer(name?: string, insertIndex?: number): ILayerOperationResult {
    // 最大数制限チェック
    if (this.layers.size >= this.maxLayers) {
      return {
        success: false,
        error: `レイヤー上限 ${this.maxLayers}枚 に達しています`
      };
    }

    // レイヤーID・名前生成
    const layerId = `layer_${++this.layerIdCounter}`;
    const layerName = name || `レイヤー ${this.layerIdCounter}`;
    
    // Graphics Container作成
    const graphics = new PIXI.Graphics();
    graphics.name = layerName;
    graphics.eventMode = 'none'; // 入力無効・パフォーマンス優先
    
    // レイヤーデータ構築
    const layerData: ILayerData = {
      id: layerId,
      name: layerName,
      visible: true,
      opacity: 1.0,
      blendMode: PIXI.BlendModes.NORMAL,
      container: graphics,
      zIndex: this.layers.size,
      locked: false,
      created: Date.now(),
      modified: Date.now()
    };

    // レイヤー登録・順序管理
    this.layers.set(layerId, layerData);
    
    if (insertIndex !== undefined && insertIndex >= 0 && insertIndex <= this.layerOrder.length) {
      this.layerOrder.splice(insertIndex, 0, layerId);
    } else {
      this.layerOrder.push(layerId);
    }

    // Container階層追加・zIndex設定
    this.layersContainer.addChild(graphics);
    this.updateLayerZIndices();

    // イベント通知
    this.eventBus.emit('layer:create', {
      id: layerId,
      name: layerName,
      index: this.layerOrder.indexOf(layerId)
    });

    console.log(`📑 レイヤー作成: ${layerName} [${layerId}]`);
    
    return {
      success: true,
      layerId,
      data: layerData
    };
  }

  /**
   * レイヤー削除・Container破棄
   */
  public deleteLayer(layerId: string): ILayerOperationResult {
    const layer = this.layers.get(layerId);
    if (!layer) {
      return {
        success: false,
        error: 'レイヤーが存在しません'
      };
    }

    // 最後のレイヤー削除防止
    if (this.layers.size <= 1) {
      return {
        success: false,
        error: '最後のレイヤーは削除できません'
      };
    }

    // アクティブレイヤー変更処理
    const layerIndex = this.layerOrder.indexOf(layerId);
    if (this.activeLayerId === layerId) {
      // 次のレイヤーをアクティブに
      const nextIndex = layerIndex > 0 ? layerIndex - 1 : layerIndex + 1;
      const nextLayerId = this.layerOrder[nextIndex];
      if (nextLayerId) {
        this.setActiveLayer(nextLayerId);
      }
    }

    // Container削除・メモリ解放
    this.layersContainer.removeChild(layer.container);
    layer.container.destroy({
      children: true,
      texture: false, // テクスチャは保持
      baseTexture: false
    });

    // データ削除・順序更新
    this.layers.delete(layerId);
    this.layerOrder.splice(layerIndex, 1);
    this.updateLayerZIndices();

    // イベント通知
    this.eventBus.emit('layer:delete', {
      id: layerId,
      name: layer.name
    });

    console.log(`📑 レイヤー削除: ${layer.name} [${layerId}]`);
    
    return {
      success: true,
      data: layer
    };
  }

  /**
   * レイヤー順序変更・Z-index更新
   */
  public reorderLayer(layerId: string, newIndex: number): ILayerOperationResult {
    if (!this.layers.has(layerId)) {
      return {
        success: false,
        error: 'レイヤーが存在しません'
      };
    }

    if (newIndex < 0 || newIndex >= this.layerOrder.length) {
      return {
        success: false,
        error: 'インデックスが範囲外です'
      };
    }

    const oldIndex = this.layerOrder.indexOf(layerId);
    if (oldIndex === newIndex) {
      return { success: true }; // 変更なし
    }

    // 配列操作・順序変更
    this.layerOrder.splice(oldIndex, 1);
    this.layerOrder.splice(newIndex, 0, layerId);
    
    // Z-index更新
    this.updateLayerZIndices();

    // イベント通知
    this.eventBus.emit('layer:reorder', {
      id: layerId,
      newIndex,
      oldIndex
    });

    console.log(`📑 レイヤー移動: ${layerId} ${oldIndex} → ${newIndex}`);
    
    return { success: true };
  }

  /**
   * アクティブレイヤー設定・描画対象切り替え
   */
  public setActiveLayer(layerId: string): ILayerOperationResult {
    if (!this.layers.has(layerId)) {
      return {
        success: false,
        error: 'レイヤーが存在しません'
      };
    }

    const previousActive = this.activeLayerId;
    this.activeLayerId = layerId;

    // DrawingEngine連携・描画対象変更
    const activeLayer = this.layers.get(layerId);
    if (activeLayer) {
      this.eventBus.emit('drawing:layer-changed', {
        layerId,
        graphics: activeLayer.container,
        previousLayerId: previousActive
      });
    }

    console.log(`📑 アクティブレイヤー: ${layerId}`);
    
    return { success: true };
  }

  /**
   * レイヤー表示切り替え
   */
  public toggleLayerVisibility(layerId: string): ILayerOperationResult {
    const layer = this.layers.get(layerId);
    if (!layer) {
      return {
        success: false,
        error: 'レイヤーが存在しません'
      };
    }

    layer.visible = !layer.visible;
    layer.container.visible = layer.visible;
    layer.modified = Date.now();

    // イベント通知
    this.eventBus.emit('layer:visibility-change', {
      id: layerId,
      visible: layer.visible
    });

    return { success: true };
  }

  /**
   * レイヤー不透明度設定
   */
  public setLayerOpacity(layerId: string, opacity: number): ILayerOperationResult {
    const layer = this.layers.get(layerId);
    if (!layer) {
      return {
        success: false,
        error: 'レイヤーが存在しません'
      };
    }

    // 0-1範囲クランプ
    layer.opacity = Math.max(0, Math.min(1, opacity));
    layer.container.alpha = layer.opacity;
    layer.modified = Date.now();

    return { success: true };
  }

  /**
   * レイヤーブレンドモード設定
   */
  public setLayerBlendMode(layerId: string, blendMode: PIXI.BlendModes): ILayerOperationResult {
    const layer = this.layers.get(layerId);
    if (!layer) {
      return {
        success: false,
        error: 'レイヤーが存在しません'
      };
    }

    layer.blendMode = blendMode;
    layer.container.blendMode = blendMode;
    layer.modified = Date.now();

    return { success: true };
  }

  /**
   * レイヤー名変更
   */
  public renameLayer(layerId: string, newName: string): ILayerOperationResult {
    const layer = this.layers.get(layerId);
    if (!layer) {
      return {
        success: false,
        error: 'レイヤーが存在しません'
      };
    }

    layer.name = newName.trim() || `レイヤー ${layerId}`;
    layer.container.name = layer.name;
    layer.modified = Date.now();

    return { success: true };
  }

  /**
   * Z-index更新・描画順序制御
   */
  private updateLayerZIndices(): void {
    for (let i = 0; i < this.layerOrder.length; i++) {
      const layerId = this.layerOrder[i];
      const layer = this.layers.get(layerId);
      if (layer) {
        layer.zIndex = i;
        layer.container.zIndex = i;
      }
    }
    
    // Container階層ソート
    this.layersContainer.sortChildren();
  }

  /**
   * アクティブレイヤーGraphics取得・描画用
   */
  public getActiveLayerGraphics(): PIXI.Graphics | null {
    if (!this.activeLayerId) return null;
    
    const activeLayer = this.layers.get(this.activeLayerId);
    return activeLayer ? activeLayer.container : null;
  }

  /**
   * レイヤーデータ取得
   */
  public getLayer(layerId: string): ILayerData | null {
    return this.layers.get(layerId) || null;
  }

  /**
   * 全レイヤーデータ取得・順序保持
   */
  public getAllLayers(): ILayerData[] {
    return this.layerOrder.map(id => this.layers.get(id)!).filter(Boolean);
  }

  /**
   * レイヤーリスト取得・UI用
   */
  public getLayerList(): Array<{ id: string; name: string; visible: boolean; active: boolean }> {
    return this.layerOrder.map(id => {
      const layer = this.layers.get(id)!;
      return {
        id,
        name: layer.name,
        visible: layer.visible,
        active: id === this.activeLayerId
      };
    });
  }

  /**
   * レイヤー統計取得・デバッグ・UI用
   */
  public getLayerStats(): ILayerStats {
    const visibleLayers = Array.from(this.layers.values()).filter(l => l.visible).length;
    
    // メモリ使用量概算・Graphics+Container
    const memoryUsageMB = this.layers.size * 2; // 概算2MB/レイヤー
    
    return {
      totalLayers: this.layers.size,
      visibleLayers,
      activeLayers: this.activeLayerId ? 1 : 0,
      memoryUsageMB
    };
  }

  /**
   * レイヤー複製・Phase2後半実装予定
   */
  public duplicateLayer(layerId: string): ILayerOperationResult {
    const sourceLayer = this.layers.get(layerId);
    if (!sourceLayer) {
      return {
        success: false,
        error: 'レイヤーが存在しません'
      };
    }

    // TODO: Phase2後半でGraphics内容コピー実装
    return this.createLayer(`${sourceLayer.name} コピー`);
  }

  /**
   * 全レイヤー統合・エクスポート用
   */
  public mergeVisibleLayers(): PIXI.Graphics {
    const mergedGraphics = new PIXI.Graphics();
    
    // 表示レイヤーを下から順に描画
    for (const layerId of this.layerOrder) {
      const layer = this.layers.get(layerId);
      if (layer && layer.visible) {
        // TODO: Phase2後半でGraphics合成実装
        mergedGraphics.addChild(layer.container.clone());
      }
    }
    
    return mergedGraphics;
  }

  /**
   * リソース解放・メモリクリーンアップ
   */
  public destroy(): void {
    console.log('📑 LayerManager終了処理開始...');
    
    // 全レイヤーContainer破棄
    for (const layer of this.layers.values()) {
      this.layersContainer.removeChild(layer.container);
      layer.container.destroy({
        children: true,
        texture: false,
        baseTexture: false
      });
    }
    
    // レイヤーコンテナ削除
    if (this.drawingContainer) {
      this.drawingContainer.removeChild(this.layersContainer);
    } else {
      this.pixiApp.stage.removeChild(this.layersContainer);
    }
    
    this.layersContainer.destroy();
    
    // データクリア
    this.layers.clear();
    this.layerOrder = [];
    this.activeLayerId = null;
    
    console.log('📑 LayerManager終了処理完了');
  }
}