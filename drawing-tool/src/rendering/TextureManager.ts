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
        freed: freedMemory / (1024 * 1024)
      });

      console.warn(`⚠️ テクスチャメモリ制限超過: ${usedMB.toFixed(1)}MB (${(freedMemory / 1024).toFixed(1)}KB解放)`);
      
    } else if (usedMB > this.WARNING_MEMORY_MB) {
      // 警告レベル・予防的クリーンアップ
      this.scheduleCleanup();
      
      this.eventBus.emit('texture:memory-warning', {
        used: usedMB,
        limit: this.MAX_MEMORY_MB,
        freed: 0
      });

      console.warn(`⚠️ テクスチャメモリ警告: ${usedMB.toFixed(1)}MB`);
    }
  }

  /**
   * 強制クリーンアップ・メモリ制限超過対応
   * @returns 解放されたメモリ量（バイト）
   */
  private forceCleanup(): number {
    const beforeMemory = this.memoryUsage;
    let freedMemory = 0;
    const now = Date.now();

    console.log('🧹 強制クリーンアップ開始');

    // 未使用テクスチャ削除・使用時間順
    const sortedTextures = Array.from(this.textures.entries())
      .filter(([_, info]) => !info.persistent)
      .sort(([_, a], [__, b]) => a.lastUsed - b.lastUsed);

    let removedCount = 0;
    for (const [textureId, textureInfo] of sortedTextures) {
      // 古いテクスチャ優先削除
      if (now - textureInfo.lastUsed > this.TEXTURE_LIFETIME || this.memoryUsage > this.MAX_MEMORY_MB * 1024 * 1024) {
        this.destroyTexture(textureId, false);
        removedCount++;
        
        // メモリ制限以下になったら停止
        if (this.memoryUsage <= this.WARNING_MEMORY_MB * 1024 * 1024) {
          break;
        }
      }
    }

    // 未使用Atlas削除
    for (const [atlasId, atlas] of this.atlases.entries()) {
      if (atlas.regions.size === 0) {
        atlas.texture.destroy(true);
        this.atlases.delete(atlasId);
        console.log(`🗑️ 空のAtlas削除: ${atlasId}`);
      }
    }

    // PIXIキャッシュクリア
    PIXI.Texture.removeFromCache();

    freedMemory = beforeMemory - this.memoryUsage;
    
    this.eventBus.emit('texture:cleanup', {
      texturesRemoved: removedCount,
      memoryFreed: freedMemory
    });

    console.log(`🧹 強制クリーンアップ完了: ${removedCount}個削除, ${(freedMemory / 1024).toFixed(1)}KB解放`);
    return freedMemory;
  }

  /**
   * 定期クリーンアップのスケジュール
   */
  private scheduleCleanup(): void {
    if (this.cleanupScheduled) return;

    this.cleanupScheduled = true;
    setTimeout(() => {
      this.performCleanup();
      this.cleanupScheduled = false;
    }, 5000); // 5秒後実行
  }

  /**
   * 通常クリーンアップ・未使用リソース削除
   */
  private performCleanup(): void {
    const now = Date.now();
    const beforeMemory = this.memoryUsage;
    let removedCount = 0;

    // 5分間未使用テクスチャ削除
    for (const [textureId, textureInfo] of this.textures.entries()) {
      if (!textureInfo.persistent && now - textureInfo.lastUsed > this.TEXTURE_LIFETIME) {
        this.destroyTexture(textureId, false);
        removedCount++;
      }
    }

    const freedMemory = beforeMemory - this.memoryUsage;
    
    if (removedCount > 0) {
      this.eventBus.emit('texture:cleanup', {
        texturesRemoved: removedCount,
        memoryFreed: freedMemory
      });

      console.log(`🧹 定期クリーンアップ: ${removedCount}個削除, ${(freedMemory / 1024).toFixed(1)}KB解放`);
    }
  }

  /**
   * 定期クリーンアップセットアップ
   */
  private setupPeriodicCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      if (now - this.lastCleanupTime > this.CLEANUP_INTERVAL) {
        this.performCleanup();
        this.lastCleanupTime = now;
      }
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * テクスチャメモリ使用量計算
   * @param width 幅
   * @param height 高さ
   * @returns メモリ使用量（バイト）
   */
  private calculateTextureMemory(width: number, height: number): number {
    // RGBA 4バイト × ピクセル数
    return width * height * 4;
  }

  /**
   * ImageDataをCanvasに変換
   * @param imageData ImageData
   * @returns HTMLCanvasElement
   */
  private imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    
    const context = canvas.getContext('2d')!;
    context.putImageData(imageData, 0, 0);
    
    return canvas;
  }

  /**
   * テクスチャをCanvasに変換
   * @param texture PIXI.Texture
   * @returns HTMLCanvasElement
   */
  private textureToCanvas(texture: PIXI.Texture): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = texture.width;
    canvas.height = texture.height;
    
    // WebGLレンダラーでテクスチャ読み取り
    const renderer = this.pixiApp.renderer;
    if (renderer.type === PIXI.RendererType.WEBGL) {
      const gl = (renderer as any).gl;
      const pixels = new Uint8Array(texture.width * texture.height * 4);
      
      // フレームバッファーからピクセル読み取り
      gl.readPixels(0, 0, texture.width, texture.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      
      // ImageData作成・Canvas描画
      const imageData = new ImageData(new Uint8ClampedArray(pixels), texture.width, texture.height);
      const context = canvas.getContext('2d')!;
      context.putImageData(imageData, 0, 0);
    }
    
    return canvas;
  }

  /**
   * テクスチャ圧縮・品質最適化
   * @param texture 元テクスチャ
   * @returns 圧縮テクスチャ
   */
  private compressTexture(texture: PIXI.Texture): PIXI.Texture {
    // 品質調整・50%スケール
    const canvas = this.textureToCanvas(texture);
    const compressedCanvas = document.createElement('canvas');
    compressedCanvas.width = Math.floor(canvas.width * 0.5);
    compressedCanvas.height = Math.floor(canvas.height * 0.5);
    
    const context = compressedCanvas.getContext('2d')!;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(canvas, 0, 0, compressedCanvas.width, compressedCanvas.height);
    
    return PIXI.Texture.from(compressedCanvas);
  }

  /**
   * メモリ使用量取得
   * @returns メモリ使用量情報
   */
  public getMemoryInfo(): {
    used: number;
    usedMB: number;
    limit: number;
    limitMB: number;
    textureCount: number;
    atlasCount: number;
  } {
    return {
      used: this.memoryUsage,
      usedMB: this.memoryUsage / (1024 * 1024),
      limit: this.MAX_MEMORY_MB * 1024 * 1024,
      limitMB: this.MAX_MEMORY_MB,
      textureCount: this.textures.size,
      atlasCount: this.atlases.size
    };
  }

  /**
   * 全テクスチャクリア・終了処理
   */
  public destroy(): void {
    console.log('🎨 TextureManager終了処理開始');

    // 全テクスチャ削除
    for (const textureId of this.textures.keys()) {
      this.destroyTexture(textureId, true);
    }

    // 全Atlas削除
    for (const [atlasId, atlas] of this.atlases.entries()) {
      atlas.texture.destroy(true);
      this.atlases.delete(atlasId);
    }

    // キャッシュクリア
    this.textureCache.clear();
    PIXI.Texture.removeFromCache();

    console.log('🎨 TextureManager終了処理完了');
  }
}