/**
 * @file TextureManager.ts
 * @description アセット(画像・動画)からWebGPU用のテクスチャを生成・管理・キャッシュします。
 * 動画の場合は、指定された時間（currentTime）のフレームをGPUに転送します。
 * @relatedFiles src/engine/Renderer.ts, src/store/useTimelineStore.ts
 * @mainFunctions loadAsset(), getTextureForTime()
 */

import { webGPUContext } from './WebGPUContext';
import { MediaAsset } from '../store/useTimelineStore';

export class TextureManager {
  private static instance: TextureManager | null = null;
  private textureCache: Map<string, GPUTexture> = new Map();
  private videoElements: Map<string, HTMLVideoElement> = new Map();
  private imageDimensions: Map<string, { width: number, height: number }> = new Map();
  private loadingAssets: Set<string> = new Set();

  private constructor() {}

  public static getInstance(): TextureManager {
    if (!TextureManager.instance) {
      TextureManager.instance = new TextureManager();
    }
    return TextureManager.instance;
  }

  /**
   * アセットをロードしてテクスチャバッファを準備する
   */
  public async loadAsset(asset: MediaAsset): Promise<void> {
    if (this.textureCache.has(asset.id) || this.loadingAssets.has(asset.id)) return;
    this.loadingAssets.add(asset.id);

    const { device } = webGPUContext;
    if (!device) {
      this.loadingAssets.delete(asset.id);
      return;
    }

    try {
      if (asset.type === 'video') {
        const video = document.createElement('video');
        video.src = asset.url;
        video.crossOrigin = 'anonymous';
        video.loop = false;
        video.muted = true;
        video.playsInline = true;
        
        await new Promise<void>((resolve) => {
          video.onloadeddata = () => resolve();
          video.onerror = () => resolve(); // error handling skipped for simplicity
        });

        this.videoElements.set(asset.id, video);

        const texture = device.createTexture({
          size: [video.videoWidth, video.videoHeight, 1],
          format: 'rgba8unorm',
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        });
        
        this.textureCache.set(asset.id, texture);
        this.imageDimensions.set(asset.id, { width: video.videoWidth, height: video.videoHeight });

      } else {
        // 画像の処理 (Fileオブジェクトから直接作成)
        const imageBitmap = await createImageBitmap(asset.file);

        const texture = device.createTexture({
          size: [imageBitmap.width, imageBitmap.height, 1],
          format: 'rgba8unorm',
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        });

        device.queue.copyExternalImageToTexture(
          { source: imageBitmap },
          { texture: texture },
          [imageBitmap.width, imageBitmap.height]
        );

        this.textureCache.set(asset.id, texture);
        this.imageDimensions.set(asset.id, { width: imageBitmap.width, height: imageBitmap.height });
      }
    } catch (e) {
      console.error('Failed to load asset texture:', e);
    } finally {
      this.loadingAssets.delete(asset.id);
    }
  }

  /**
   * 指定したローカル時間のテクスチャを取得（動画の場合はフレームを同期して転送）
   */
  public getTextureForTime(assetId: string, localTime: number): { texture: GPUTexture | undefined, width: number, height: number } {
    const texture = this.textureCache.get(assetId);
    const dims = this.imageDimensions.get(assetId);
    if (!texture || !dims) return { texture: undefined, width: 0, height: 0 };

    const video = this.videoElements.get(assetId);
    if (video) {
      const { device } = webGPUContext;
      if (device && video.readyState >= 2) {
        // 時間同期 (1フレーム以上のズレがあればシーク)
        if (Math.abs(video.currentTime - localTime) > 0.05) {
          video.currentTime = localTime;
        }

        // 毎フレームGPUにピクセルを転送 (本来はWebCodecsが望ましいが簡易実装としてこれを利用)
        device.queue.copyExternalImageToTexture(
          { source: video },
          { texture: texture },
          [dims.width, dims.height]
        );
      }
    }

    return { texture, width: dims.width, height: dims.height };
  }
}

export const textureManager = TextureManager.getInstance();
