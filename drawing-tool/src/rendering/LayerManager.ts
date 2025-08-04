// LayerManager.ts - Phase2 レイヤー管理システム
// 20レイヤー対応・PixiJS Container階層・ブレンドモード・Z-index制御

import * as PIXI from 'pixi.js';
import { EventBus, IEventData } from '../core/EventBus.js';

export interface ILayerData {
  id: string;
  name: string;
  container: PIXI.Container;
  visible: boolean;
  opacity: number;
  blendMode: PIXI.BlendModes;
  locked: boolean;
  index: number;
  thumbnail?: string; // Base64 thumbnail for UI
}

export interface ILayerEventData extends IEventData {
  'layer:created': { layerId: string; name: string; index: number };
  'layer:deleted': { layerId: string; name: string };
  'layer:reordered': { layerId: string; oldIndex: number; newIndex: number };
  'layer:visibility-changed': { layerId: string; visible: boolean };
  'layer:opacity-changed': { layerId: string; opacity: number };
  'layer:blend-mode-changed': { layerId: string; blendMode: PIXI.BlendModes };
  'layer:active-changed': { activeLayerId: string; previousLayerId: string };
}

/**
 * レイヤー管理システム・Phase2実装
 * - 20レイヤー管理・Container階層制御
 * - ブレンドモード・透明度・表示制御
 * - Z-index動的制御・レイヤー順序管理
 * - メモリ効率最適化・GPU最適化
 */
export class LayerManager {
  private eventBus: EventBus;
  private pixiApp: PIXI.Application;
  private layersContainer: PIXI.Container;
  
  // レイヤー管理
  private layers: Map<string, ILayerData> = new Map();
  private layerOrder: string[] = [];
  private activeLayerId: string | null = null;
  private nextLayerId = 1;
  
  // 制限・設定
  private readonly MAX_LAYERS = 20;
  private readonly DEFAULT_LAYER_NAME = 'レイヤー';
  
  // パフォーマンス最適化
  private updateScheduled = false;
  private thumbnailCache: Map<string, string> = new Map();

  constructor(pixiApp: PIXI.Application, eventBus: EventBus) {
    this.pixiApp = pixiApp;
    this.eventBus = eventBus;
    
    // レイヤー用Container作成・PixiJS Stage直下
    this.layersContainer = new PIXI.Container();
    this.layersContainer.sortableChildren = true; // Z-index有効化
    this.pixiApp.stage.addChild(this.layersContainer);
    
    console.log('🎨 LayerManager初期化完了');
    
    // 初期レイヤー作成
    this.createDefaultLayer();
  }

  /**
   * 新しいレイヤー作成
   * @param name レイヤー名
   * @param insertIndex 挿入位置（未指定で最上位）
   * @returns レイヤーID
   */
  public createLayer(name?: string, insertIndex?: number): string {
    if (this.layers.size >= this.MAX_LAYERS) {
      console.warn(`⚠️ レイヤー数上限（${this.MAX_LAYERS}枚）に達しています`);
      throw new Error(`レイヤー数は最大${this.MAX_LAYERS}枚まで`);
    }

    const layerId = `layer_${this.nextLayerId++}`;
    const layerName = name || `${this.DEFAULT_LAYER_NAME} ${this.nextLayerId - 1}`;
    
    // PixiJS Container作成・初期設定
    const container = new PIXI.Container();
    container.name = layerName;
    
    // レイヤーデータ作成
    const layerData: ILayerData = {
      id: layerId,
      name: layerName,
      container,
      visible: true,
      opacity: 1.0,
      blendMode: PIXI.BlendModes.NORMAL,
      locked: false,
      index: insertIndex ?? this.layerOrder.length
    };

    // 管理データ追加
    this.layers.set(layerId, layerData);
    
    // 順序管理・挿入位置調整
    if (insertIndex !== undefined && insertIndex < this.layerOrder.length) {
      this.layerOrder.splice(insertIndex, 0, layerId);
      this.reindexLayers();
    } else {
      this.layerOrder.push(layerId);
      layerData.index = this.layerOrder.length - 1;
    }

    // Container階層追加・Z-index設定
    this.layersContainer.addChild(container);
    this.updateContainerZIndex();
    
    // アクティブレイヤー設定（初回 or 指定がない場合）
    if (!this.activeLayerId) {
      this.setActiveLayer(layerId);
    }

    // イベント発火
    this.eventBus.emit('layer:created', {
      layerId,
      name: layerName,
      index: layerData.index
    });

    console.log(`✅ レイヤー作成: ${layerName} (${layerId})`);
    return layerId;
  }

  /**
   * レイヤー削除・メモリ解放
   * @param layerId 削除対象レイヤーID
   */
  public deleteLayer(layerId: string): void {
    const layer = this.layers.get(layerId);
    if (!layer) {
      console.warn(`⚠️ 削除対象レイヤーが見つかりません: ${layerId}`);
      return;
    }

    // 最後のレイヤー削除防止
    if (this.layers.size <= 1) {
      console.warn('⚠️ 最後のレイヤーは削除できません');
      throw new Error('最後のレイヤーは削除できません');
    }

    // Container削除・メモリ解放
    this.layersContainer.removeChild(layer.container);
    layer.container.destroy({ children: true, texture: false });
    
    // 管理データ削除
    this.layers.delete(layerId);
    const orderIndex = this.layerOrder.indexOf(layerId);
    if (orderIndex !== -1) {
      this.layerOrder.splice(orderIndex, 1);
    }

    // サムネイルキャッシュ削除
    this.thumbnailCache.delete(layerId);

    // アクティブレイヤー調整
    if (this.activeLayerId === layerId) {
      const newActiveIndex = Math.max(0, orderIndex - 1);
      const newActiveLayerId = this.layerOrder[newActiveIndex];
      this.setActiveLayer(newActiveLayerId);
    }

    // インデックス再計算
    this.reindexLayers();
    this.updateContainerZIndex();

    // イベント発火
    this.eventBus.emit('layer:deleted', {
      layerId,
      name: layer.name
    });

    console.log(`🗑️ レイヤー削除: ${layer.name} (${layerId})`);
  }

  /**
   * レイヤー順序変更・Z-index制御
   * @param layerId 移動対象レイヤーID
   * @param newIndex 新しいインデックス位置
   */
  public reorderLayer(layerId: string, newIndex: number): void {
    const layer = this.layers.get(layerId);
    if (!layer) {
      console.warn(`⚠️ 移動対象レイヤーが見つかりません: ${layerId}`);
      return;
    }

    const oldIndex = this.layerOrder.indexOf(layerId);
    if (oldIndex === -1 || oldIndex === newIndex) {
      return; // 無効・変更なし
    }

    // 範囲チェック
    const clampedNewIndex = Math.max(0, Math.min(newIndex, this.layerOrder.length - 1));
    
    // 配列内移動
    this.layerOrder.splice(oldIndex, 1);
    this.layerOrder.splice(clampedNewIndex, 0, layerId);

    // インデックス再計算・Container Z-index更新
    this.reindexLayers();
    this.updateContainerZIndex();

    // イベント発火
    this.eventBus.emit('layer:reordered', {
      layerId,
      oldIndex,
      newIndex: clampedNewIndex
    });

    console.log(`🔄 レイヤー順序変更: ${layer.name} ${oldIndex} → ${clampedNewIndex}`);
  }

  /**
   * レイヤー表示・非表示切り替え
   * @param layerId 対象レイヤーID
   * @param visible 表示状態
   */
  public setLayerVisibility(layerId: string, visible: boolean): void {
    const layer = this.layers.get(layerId);
    if (!layer) return;

    layer.visible = visible;
    layer.container.visible = visible;

    this.eventBus.emit('layer:visibility-changed', {
      layerId,
      visible
    });

    console.log(`👁️ レイヤー表示切り替え: ${layer.name} → ${visible ? '表示' : '非表示'}`);
  }

  /**
   * レイヤー透明度設定・0.0-1.0
   * @param layerId 対象レイヤーID
   * @param opacity 透明度
   */
  public setLayerOpacity(layerId: string, opacity: number): void {
    const layer = this.layers.get(layerId);
    if (!layer) return;

    const clampedOpacity = Math.max(0, Math.min(1, opacity));
    layer.opacity = clampedOpacity;
    layer.container.alpha = clampedOpacity;

    this.eventBus.emit('layer:opacity-changed', {
      layerId,
      opacity: clampedOpacity
    });

    console.log(`🌫️ レイヤー透明度変更: ${layer.name} → ${(clampedOpacity * 100).toFixed(0)}%`);
  }

  /**
   * レイヤーブレンドモード設定
   * @param layerId 対象レイヤーID
   * @param blendMode PixiJS BlendModes
   */
  public setLayerBlendMode(layerId: string, blendMode: PIXI.BlendModes): void {
    const layer = this.layers.get(layerId);
    if (!layer) return;

    layer.blendMode = blendMode;
    layer.container.blendMode = blendMode;

    this.eventBus.emit('layer:blend-mode-changed', {
      layerId,
      blendMode
    });

    console.log(`🎨 ブレンドモード変更: ${layer.name} → ${this.getBlendModeName(blendMode)}`);
  }

  /**
   * アクティブレイヤー設定・描画対象
   * @param layerId 対象レイヤーID
   */
  public setActiveLayer(layerId: string): void {
    const layer = this.layers.get(layerId);
    if (!layer) {
      console.warn(`⚠️ アクティブ設定対象レイヤーが見つかりません: ${layerId}`);
      return;
    }

    const previousLayerId = this.activeLayerId;
    this.activeLayerId = layerId;

    this.eventBus.emit('layer:active-changed', {
      activeLayerId: layerId,
      previousLayerId: previousLayerId || ''
    });

    console.log(`🎯 アクティブレイヤー変更: ${layer.name}`);
  }

  /**
   * アクティブレイヤーContainer取得・描画用
   * @returns アクティブレイヤーのPixiJS Container
   */
  public getActiveLayerContainer(): PIXI.Container | null {
    if (!this.activeLayerId) return null;
    
    const layer = this.layers.get(this.activeLayerId);
    return layer?.container || null;
  }

  /**
   * レイヤー情報取得・UI表示用
   * @param layerId 対象レイヤーID
   * @returns レイヤーデータ（読み取り専用）
   */
  public getLayerData(layerId: string): Readonly<ILayerData> | null {
    const layer = this.layers.get(layerId);
    return layer ? { ...layer } : null;
  }

  /**
   * 全レイヤー情報取得・順序付き
   * @returns レイヤーデータ配列（表示順）
   */
  public getAllLayers(): ReadonlyArray<Readonly<ILayerData>> {
    return this.layerOrder
      .map(id => this.layers.get(id))
      .filter((layer): layer is ILayerData => !!layer)
      .map(layer => ({ ...layer }));
  }

  /**
   * アクティブレイヤーID取得
   * @returns アクティブレイヤーID
   */
  public getActiveLayerId(): string | null {
    return this.activeLayerId;
  }

  /**
   * レイヤー数取得
   * @returns 現在のレイヤー数
   */
  public getLayerCount(): number {
    return this.layers.size;
  }

  /**
   * レイヤー作成可能判定
   * @returns 作成可能かどうか
   */
  public canCreateLayer(): boolean {
    return this.layers.size < this.MAX_LAYERS;
  }

  /**
   * レイヤー名変更
   * @param layerId 対象レイヤーID
   * @param newName 新しい名前
   */
  public renameLayer(layerId: string, newName: string): void {
    const layer = this.layers.get(layerId);
    if (!layer) return;

    const trimmedName = newName.trim();
    if (!trimmedName || trimmedName === layer.name) return;

    layer.name = trimmedName;
    layer.container.name = trimmedName;

    console.log(`📝 レイヤー名変更: ${layerId} → "${trimmedName}"`);
  }

  /**
   * 初期レイヤー作成・起動時
   */
  private createDefaultLayer(): void {
    this.createLayer('背景');
    console.log('📄 初期レイヤー作成完了');
  }

  /**
   * レイヤーインデックス再計算・内部管理
   */
  private reindexLayers(): void {
    this.layerOrder.forEach((layerId, index) => {
      const layer = this.layers.get(layerId);
      if (layer) {
        layer.index = index;
      }
    });
  }

  /**
   * Container Z-index更新・表示順序制御
   */
  private updateContainerZIndex(): void {
    if (this.updateScheduled) return;
    
    this.updateScheduled = true;
    
    // 次フレームで更新・パフォーマンス最適化
    requestAnimationFrame(() => {
      this.layerOrder.forEach((layerId, index) => {
        const layer = this.layers.get(layerId);
        if (layer) {
          layer.container.zIndex = index;
        }
      });
      
      this.updateScheduled = false;
    });
  }

  /**
   * ブレンドモード名取得・デバッグ用
   */
  private getBlendModeName(blendMode: PIXI.BlendModes): string {
    const blendModeNames: Record<PIXI.BlendModes, string> = {
      [PIXI.BlendModes.NORMAL]: '通常',
      [PIXI.BlendModes.ADD]: '加算',
      [PIXI.BlendModes.MULTIPLY]: '乗算',
      [PIXI.BlendModes.SCREEN]: 'スクリーン',
      [PIXI.BlendModes.OVERLAY]: 'オーバーレイ',
      [PIXI.BlendModes.DARKEN]: '比較（暗）',
      [PIXI.BlendModes.LIGHTEN]: '比較（明）',
      [PIXI.BlendModes.COLOR_DODGE]: '覆い焼き',
      [PIXI.BlendModes.COLOR_BURN]: '焼き込み',
      [PIXI.BlendModes.HARD_LIGHT]: 'ハードライト',
      [PIXI.BlendModes.SOFT_LIGHT]: 'ソフトライト',
      [PIXI.BlendModes.DIFFERENCE]: '差の絶対値',
      [PIXI.BlendModes.EXCLUSION]: '除外',
      [PIXI.BlendModes.HUE]: '色相',
      [PIXI.BlendModes.SATURATION]: '彩度',
      [PIXI.BlendModes.COLOR]: 'カラー',
      [PIXI.BlendModes.LUMINOSITY]: '輝度'
    };
    
    return blendModeNames[blendMode] || `Unknown(${blendMode})`;
  }

  /**
   * メモリ使用量取得・デバッグ用
   */
  public getMemoryUsage(): { layers: number; containers: number; textures: number } {
    let containers = 0;
    let textures = 0;

    this.layers.forEach(layer => {
      containers++;
      // Container内のテクスチャ数計算（概算）
      layer.container.children.forEach(child => {
        if (child instanceof PIXI.Graphics) {
          textures += child.geometry.graphicsData?.length || 0;
        }
      });
    });

    return {
      layers: this.layers.size,
      containers,
      textures
    };
  }

  /**
   * リソース解放・アプリケーション終了時
   */
  public destroy(): void {
    console.log('🔄 LayerManager終了処理開始...');

    // 全レイヤーContainer削除・メモリ解放
    this.layers.forEach(layer => {
      if (layer.container.parent) {
        layer.container.parent.removeChild(layer.container);
      }
      layer.container.destroy({ children: true, texture: false });
    });

    // メインContainerも削除
    if (this.layersContainer.parent) {
      this.layersContainer.parent.removeChild(this.layersContainer);
    }
    this.layersContainer.destroy({ children: true, texture: false });

    // 管理データクリア
    this.layers.clear();
    this.layerOrder = [];
    this.thumbnailCache.clear();
    this.activeLayerId = null;

    console.log('✅ LayerManager終了処理完了');
  }
}