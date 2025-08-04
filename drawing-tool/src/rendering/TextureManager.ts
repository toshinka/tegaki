// TextureManager.ts - Phase2 GPU テクスチャ管理システム
// GPU メモリ効率・Atlas統合・圧縮最適化・メモリリーク防止

import * as PIXI from 'pixi.js';
import { EventBus, IEventData } from '../core/EventBus.js';

export interface ITextureInfo {
  id: string;
  texture: PIXI.Texture;
  size: { width: number; height: number };
  memoryUsage: number;
  lastUsed: number;
  persistent: boolean;
  atlasId?: string;
}

export interface ITextureAtlas {
  id: string;
  texture: PIXI.Texture;
  size: { width: number; height: number };
  regions: Map<string, PIXI.Rectangle>;
  usage: number;
  maxSize: number;
}

export interface ITextureEventData extends IEventData {
  'texture:created': { textureId: string; size: { width: number; height: number } };
  'texture:destroyed': { textureId: string; memoryFreed: number };
  'texture:atlas-created': { atlasId: string; size: { width: number; height: number } };
  'texture:memory-warning': { used: number; limit: number; freed: number };
  'texture:cleanup': { texturesRemoved: number; memoryFreed: number };
}

/**
 * GPU テクスチャ管理システム・Phase2実装
 * - GPU メモリプール・効率管理・制限値監視
 * - テクスチャAtlas・小画像統合・描画コール削減
 * - 自動圧縮・フォーマット最適化・品質調整
 * - ガベージコレクション・メモリリーク防止
 */
export class TextureManager {
  private eventBus: EventBus;
  private pixiApp: PIXI.Application;
  
  // テクスチャ管理
  private textures: Map<string, ITextureInfo> = new Map();
  private atlases: Map<string, ITextureAtlas> = new Map();
  private nextTextureId = 1;
  private nextAtlasId = 1;
  
  // メモリ管理・制限
  private memoryUsage = 0;
  private readonly MAX_MEMORY_MB = 256; // 256MB制限
  private readonly WARNING_MEMORY_MB = 200; // 200MB警告
  private readonly MAX_TEXTURE_SIZE = 2048;
  private readonly ATLAS_SIZE = 1024;
  
  // キャッシュ・最適化
  private textureCache: Map<string, PIXI.Texture> = new Map();
  private cleanupScheduled = false;
  private lastCleanupTime = 0;
  private readonly CLEANUP_INTERVAL = 30000; // 30秒間隔
  private readonly TEXTURE_LIFETIME = 300000; // 5分間未使用で削除

  constructor(pixiApp: PIXI.Application, eventBus: EventBus) {
    this.pixiApp = pixiApp;
    this.eventBus = eventBus;
    
    this.setupPeriodicCleanup();
    console.log('🎨 TextureManager初期化完了');
  }

  /**
   * テクスチャ作成・登録管理
   * @param source 画像ソース・Canvas・ImageData
   * @param options 作成オプション
   * @returns テクスチャID
   */
  public createTexture(
    source: HTMLImageElement | HTMLCanvasElement | ImageData | PIXI.BaseTexture,
    options: {
      id?: string;
      persistent?: boolean;
      compress?: boolean;
      generateMipmaps?: boolean;
    } = {}
  ): string {
    const textureId = options.id || `texture_${this.nextTextureId++}`;
    
    // 既存テクスチャ確認・重複防止
    if (this.textures.has(textureId)) {
      console.warn(`⚠️ テクスチャID重複: ${textureId}`);
      return textureId;
    }

    try {
      let texture: PIXI.Texture;
      let memoryUsage: number;

      // ソース別テクスチャ作成
      if (source instanceof PIXI.BaseTexture) {
        texture = new PIXI.Texture(source);
        memoryUsage = this.calculateTextureMemory(source.width, source.height);
      } else if (source instanceof ImageData) {
        const canvas = this.imageDataToCanvas(source);
        texture = PIXI.Texture.from(canvas);
        memoryUsage = this.calculateTextureMemory(source.width, source.height);
      } else {
        texture = PIXI.Texture.from(source);
        memoryUsage = this.calculateTextureMemory(
          (source as HTMLImageElement | HTMLCanvasElement).width,
          (source as HTMLImageElement | HTMLCanvasElement).height
        );
      }

      // 圧縮・最適化処理
      if (options.compress) {
        texture = this.compressTexture(texture);
      }

      // Mipmap生成
      if (options.generateMipmaps && texture.baseTexture) {
        texture.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
      }

      // テクスチャ情報作成
      const textureInfo: ITextureInfo = {
        id: textureId,
        texture,
        size: { width: texture.width, height: texture.height },
        memoryUsage,
        lastUsed: Date.now(),
        persistent: options.persistent || false
      };

      // 登録・メモリ追跡
      this.textures.set(textureId, textureInfo);
      this.memoryUsage += memoryUsage;

      // メモリ制限チェック
      this.checkMemoryLimits();

      // イベント発火
      this.eventBus.emit('texture:created', {
        textureId,
        size: textureInfo.size
      });

      console.log(`🎨 テクスチャ作成: ${textureId} (${texture.width}x${texture.height}, ${(memoryUsage / 1024).toFixed(1)}KB)`);
      return textureId;

    } catch (error) {
      console.error(`❌ テクスチャ作成エラー (${textureId}):`, error);
      throw error;
    }
  }

  /**
   * テクスチャAtlas作成・小画像統合
   * @param textureIds 統合対象テクスチャID配列
   * @param atlasSize Atlas サイズ
   * @returns Atlas ID
   */
  public createTextureAtlas(textureIds: string[], atlasSize: number = this.ATLAS_SIZE): string {
    const atlasId = `atlas_${this.nextAtlasId++}`;
    
    try {
      // 対象テクスチャ収集・検証
      const sourceTextures: ITextureInfo[] = [];
      let totalArea = 0;

      for (const textureId of textureIds) {
        const textureInfo = this.textures.get(textureId);
        if (!textureInfo) {
          console.warn(`⚠️ Atlas作成: テクスチャが見つかりません - ${textureId}`);
          continue;
        }

        // サイズ制限チェック
        if (textureInfo.size.width > atlasSize || textureInfo.size.height > atlasSize) {
          console.warn(`⚠️ Atlas作成: テクスチャサイズ超過 - ${textureId}`);
          continue;
        }

        sourceTextures.push(textureInfo);
        totalArea += textureInfo.size.width * textureInfo.size.height;
      }

      if (sourceTextures.length === 0) {
        throw new Error('Atlas作成: 有効なテクスチャがありません');
      }

      // Atlas容量チェック
      const atlasArea = atlasSize * atlasSize;
      if (totalArea > atlasArea * 0.8) { // 80%効率目標
        console.warn(`⚠️ Atlas効率低下: ${((totalArea / atlasArea) * 100).toFixed(1)}%`);
      }

      // Atlas用Canvas作成
      const atlasCanvas = document.createElement('canvas');
      atlasCanvas.width = atlasSize;
      atlasCanvas.height = atlasSize;
      const atlasContext = atlasCanvas.getContext('2d')!;

      // 背景クリア・透明
      atlasContext.clearRect(0, 0, atlasSize, atlasSize);

      // テクスチャ配置・パッキング
      const regions = new Map<string, PIXI.Rectangle>();
      let currentX = 0;
      let currentY = 0;
      let rowHeight = 0;

      for (const textureInfo of sourceTextures) {
        const { width, height } = textureInfo.size;

        // 行に収まらない場合・次行へ
        if (currentX + width > atlasSize) {
          currentX = 0;
          currentY += rowHeight;
          rowHeight = 0;
        }

        // Atlas容量超過チェック
        if (currentY + height > atlasSize) {
          console.warn(`⚠️ Atlas容量不足: ${textureInfo.id} をスキップ`);
          continue;
        }

        // テクスチャ描画・Atlas統合
        const sourceCanvas = this.textureToCanvas(textureInfo.texture);
        atlasContext.drawImage(sourceCanvas, currentX, currentY);

        // 領域情報保存
        regions.set(textureInfo.id, new PIXI.Rectangle(currentX, currentY, width, height));

        // 次の位置計算
        currentX += width;
        rowHeight = Math.max(rowHeight, height);

        console.log(`📦 Atlas配置: ${textureInfo.id} → (${currentX - width}, ${currentY})`);
      }

      // Atlas テクスチャ作成
      const atlasTexture = PIXI.Texture.from(atlasCanvas);
      const atlasMemory = this.calculateTextureMemory(atlasSize, atlasSize);

      // Atlas情報作成
      const atlasInfo: ITextureAtlas = {
        id: atlasId,
        texture: atlasTexture,
        size: { width: atlasSize, height: atlasSize },
        regions,
        usage: (totalArea / (atlasSize * atlasSize)) * 100,
        maxSize: atlasSize
      };

      this.atlases.set(atlasId, atlasInfo);
      this.memoryUsage += atlasMemory;

      // 元テクスチャにAtlas情報追加
      for (const textureInfo of sourceTextures) {
        if (regions.has(textureInfo.id)) {
          textureInfo.atlasId = atlasId;
        }
      }

      // イベント発火
      this.eventBus.emit('texture:atlas-created', {
        atlasId,
        size: { width: atlasSize, height: atlasSize }
      });

      console.log(`📦 Atlas作成完了: ${atlasId} (${sourceTextures.length}枚統合, 効率${atlasInfo.usage.toFixed(1)}%)`);
      return atlasId;

    } catch (error) {
      console.error(`❌ Atlas作成エラー (${atlasId}):`, error);
      throw error;
    }
  }

  /**
   * テクスチャ取得・使用時間更新
   * @param textureId テクスチャID
   * @returns PIXI.Texture
   */
  public getTexture(textureId: string): PIXI.Texture | null {
    const textureInfo = this.textures.get(textureId);
    if (!textureInfo) {
      return null;
    }

    // 使用時間更新・キャッシュ維持
    textureInfo.lastUsed = Date.now();
    return textureInfo.texture;
  }

  /**
   * Atlas内テクスチャ取得・部分テクスチャ作成
   * @param textureId 元テクスチャID
   * @returns 部分テクスチャ
   */
  public getAtlasTexture(textureId: string): PIXI.Texture | null {
    const textureInfo = this.textures.get(textureId);
    if (!textureInfo || !textureInfo.atlasId) {
      return this.getTexture(textureId); // 通常テクスチャ返却
    }

    const atlas = this.atlases.get(textureInfo.atlasId);
    const region = atlas?.regions.get(textureId);
    
    if (!atlas || !region) {
      console.warn(`⚠️ Atlas情報不整合: ${textureId}`);
      return null;
    }

    // 部分テクスチャ作成・Atlas領域指定
    const subTexture = new PIXI.Texture(
      atlas.texture.baseTexture,
      region
    );

    textureInfo.lastUsed = Date.now();
    return subTexture;
  }

  /**
   * テクスチャ削除・メモリ解放
   * @param textureId 削除対象テクスチャID
   * @param force 永続フラグ無視・強制削除
   */
  public destroyTexture(textureId: string, force: boolean = false): void {
    const textureInfo = this.textures.get(textureId);
    if (!textureInfo) {
      console.warn(`⚠️ 削除対象テクスチャが見つかりません: ${textureId}`);
      return;
    }

    // 永続フラグチェック
    if (textureInfo.persistent && !force) {
      console.log(`🔒 永続テクスチャ・削除スキップ: ${textureId}`);
      return;
    }

    try {
      // テクスチャ削除・GPU メモリ解放
      textureInfo.texture.destroy(true);
      
      // メモリ使用量更新
      this.memoryUsage -= textureInfo.memoryUsage;
      
      // 管理データ削除
      this.textures.delete(textureId);
      this.textureCache.delete(textureId);

      // Atlas情報更新
      if (textureInfo.atlasId) {
        const atlas = this.atlases.get(textureInfo.atlasId);
        if (atlas) {
          atlas.regions.delete(textureId);
        }
      }

      // イベント発火
      this.eventBus.emit('texture:destroyed', {
        textureId,
        memoryFreed: textureInfo.memoryUsage
      });

      console.log(`🗑️ テクスチャ削除: ${textureId} (${(textureInfo.memoryUsage / 1024).toFixed(1)}KB解放)`);

    } catch (error) {
      console.error(`❌ テクスチャ削除エラー (${textureId}):`, error);
    }
  }

  /**
   * メモリ使用量監視・警告・制限処理
   */
  private checkMemoryLimits(): void {
    const usedMB = this.memoryUsage / (1024 * 1024);

    if (usedMB > this.MAX_MEMORY_MB) {
      // 制限超過・強制クリーンアップ
      const freedMemory = this.forceCleanup();
      
      this.eventBus.emit('texture:memory-warning', {
        used: usedMB,
        limit: this.MAX_MEMORY_MB,
        free