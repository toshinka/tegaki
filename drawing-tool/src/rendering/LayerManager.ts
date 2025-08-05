// LayerManager.ts - Phase2 レイヤー管理システム
// 20レイヤー対応・PixiJS Container階層・ブレンドモード・Z-index制御
// Pixi.js v8対応・文字列ベースブレンドモード

import * as PIXI from 'pixi.js';
import { EventBus, IEventData } from '../core/EventBus.js';
import { LAYER, type BlendMode } from '../constants/drawing-constants.js';

export interface ILayerData {
  id: string;
  name: string;
  container: PIXI.Container;
  visible: boolean;
  opacity: number;
  blendMode: BlendMode; // 文字列ベース・Pixi.js v8対応
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
  'layer:blend-mode-changed': { layerId: string; blendMode: BlendMode };
  'layer:active-changed': { activeLayerId: string; previousLayerId: string };
}

/**
 * レイヤー管理システム・Phase2実装・Pixi.js v8対応
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
  
  // 制限・設定 - drawing-constants.ts活用
  private readonly MAX_LAYERS = LAYER.MAX_LAYERS;
  private readonly DEFAULT_LAYER_NAME = LAYER.DEFAULT_LAYER_NAME;
  
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
    
    // レイヤーデータ作成・定数活用
    const layerData: ILayerData = {
      id: layerId,
      name: layerName,
      container,
      visible: LAYER.DEFAULT_VISIBLE,
      opacity: LAYER.DEFAULT_OPACITY,
      blendMode: LAYER.DEFAULT_BLEND_MODE, // 文字列ベース
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
    if (this.layers.size <= LAYER.MIN_LAYERS) {
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

    const clampedOpacity = Math.max(LAYER.MIN_OPACITY, Math.min(LAYER.MAX_OPACITY, opacity));
    layer.opacity = clampedOpacity;
    layer.container.alpha = clampedOpacity;

    this.eventBus.emit('layer:opacity-changed', {
      layerId,
      opacity: clampedOpacity
    });

    console.log(`🌫️ レイヤー透明度変更: ${layer.name} → ${(clampedOpacity * 100).toFixed(0)}%`);
  }

  /**
   * レイヤーブレンドモード設定・Pixi.js v8対応
   * @param layerId 対象レイヤーID
   * @param blendMode 文字列ベースブレンドモード
   */
  public setLayerBlendMode(layerId: string, blendMode: BlendMode): void {
    const layer = this.layers.get(layerId);
    if (!layer) return;

    // Pixi.js v8では文字列ベースでブレンドモード設定
    layer.blendMode = blendMode;
    layer.container.blendMode = blendMode as any; // 型変換・v8互換性

    this.eventBus.emit('layer:blend-mode-changed', {
      layerId,
      blendMode
    });

    console.log(`🎨 ブレンドモード変更: ${layer.name} → ${blendMode}`);
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

    // 名前長制限チェック
    const finalName = trimmedName.length > LAYER.MAX_NAME_LENGTH 
      ? trimmedName.substring(0, LAYER.MAX_NAME_LENGTH) 
      : trimmedName;

    layer.name = finalName;
    layer.container.name = finalName;

    console.log(`📝 レイヤー名変更: ${layerId} → "${finalName}"`);
  }

  /**
   * レイヤーロック状態変更
   * @param layerId 対象レイヤーID
   * @param locked ロック状態
   */
  public setLayerLocked(layerId: string, locked: boolean): void {
    const layer = this.layers.get(layerId);
    if (!layer) return;

    layer.locked = locked;
    
    // ロック時は描画禁止（EventBusで通知）
    this.eventBus.emit('layer:lock-changed', {
      layerId,
      locked
    });

    console.log(`🔒 レイヤーロック変更: ${layer.name} → ${locked ? 'ロック' : 'アンロック'}`);
  }

  /**
   * レイヤー複製・新規作成
   * @param layerId 複製元レイヤーID
   * @returns 新しいレイヤーID
   */
  public duplicateLayer(layerId: string): string {
    const sourceLayer = this.layers.get(layerId);
    if (!sourceLayer) {
      throw new Error(`複製対象レイヤーが見つかりません: ${layerId}`);
    }

    // 新しい名前生成
    const newName = `${sourceLayer.name}${LAYER.DUPLICATE_SUFFIX}`;
    const newLayerId = this.createLayer(newName, sourceLayer.index + 1);
    
    // 設定コピー
    this.setLayerOpacity(newLayerId, sourceLayer.opacity);
    this.setLayerBlendMode(newLayerId, sourceLayer.blendMode);
    this.setLayerVisibility(newLayerId, sourceLayer.visible);
    this.setLayerLocked(newLayerId, sourceLayer.locked);

    // Container内容コピー（簡易版・Phase3で詳細実装）
    const newLayer = this.layers.get(newLayerId);
    if (newLayer) {
      // TODO: Container内容の実際のコピー処理
      console.log(`📋 レイヤー複製: ${sourceLayer.name} → ${newName}`);
    }

    return newLayerId;
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
          layer.container.zIndex = LAYER.BASE_Z_INDEX + (index * LAYER.Z_INDEX_STEP);
        }
      });
      
      this.updateScheduled = false;
    });
  }

  /**
   * レイヤーサムネイル生成・UI用
   * @param layerId 対象レイヤーID
   * @returns Base64エンコードされたサムネイル
   */
  public generateThumbnail(layerId: string): string | null {
    const layer = this.layers.get(layerId);
    if (!layer) return null;

    // キャッシュチェック
    const cached = this.thumbnailCache.get(layerId);
    if (cached) return cached;

    try {
      // Container からサムネイル生成
      const bounds = layer.container.getBounds();
      if (bounds.width === 0 || bounds.height === 0) {
        return null; // 空のレイヤー
      }

      // レンダーテクスチャ作成・サムネイルサイズ
      const renderTexture = PIXI.RenderTexture.create({
        width: LAYER.THUMBNAIL.WIDTH,
        height: LAYER.THUMBNAIL.HEIGHT
      });

      // 一時的な変換行列でスケール調整
      const tempMatrix = new PIXI.Matrix();
      const scale = Math.min(
        LAYER.THUMBNAIL.WIDTH / bounds.width,
        LAYER.THUMBNAIL.HEIGHT / bounds.height
      );
      
      tempMatrix.scale(scale, scale);
      tempMatrix.translate(-bounds.x * scale, -bounds.y * scale);

      // レンダリング実行
      this.pixiApp.renderer.render(layer.container, {
        renderTexture,
        transform: tempMatrix
      });

      // Base64変換
      const canvas = this.pixiApp.renderer.extract.canvas(renderTexture);
      const thumbnail = canvas.toDataURL('image/png');

      // キャッシュ保存・サイズ制限
      if (this.thumbnailCache.size >= LAYER.THUMBNAIL.CACHE_SIZE) {
        const firstKey = this.thumbnailCache.keys().next().value;
        this.thumbnailCache.delete(firstKey);
      }
      this.thumbnailCache.set(layerId, thumbnail);

      // テクスチャクリーンアップ
      renderTexture.destroy(true);

      return thumbnail;
    } catch (error) {
      console.error(`❌ サムネイル生成エラー: ${layerId}`, error);
      return null;
    }
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
        } else if (child instanceof PIXI.Sprite && child.texture) {
          textures++;
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
   * レイヤー統計情報取得・Phase2後半実装
   */
  public getLayerStats(): {
    totalLayers: number;
    visibleLayers: number;
    lockedLayers: number;
    activeLayerId: string | null;
    memoryUsage: ReturnType<typeof this.getMemoryUsage>;
  } {
    let visibleLayers = 0;
    let lockedLayers = 0;

    this.layers.forEach(layer => {
      if (layer.visible) visibleLayers++;
      if (layer.locked) lockedLayers++;
    });

    return {
      totalLayers: this.layers.size,
      visibleLayers,
      lockedLayers,
      activeLayerId: this.activeLayerId,
      memoryUsage: this.getMemoryUsage()
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