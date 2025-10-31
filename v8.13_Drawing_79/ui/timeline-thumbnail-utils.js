/**
 * timeline-thumbnail-utils.js - Phase 4: Timeline連携完全版
 * Phase 1-3: Canvas2D廃止、ThumbnailSystem統合、throttle最適化
 * Phase 4: AnimationSystem.regenerateAllThumbnails() 確実実行
 */

class TimelineThumbnailUtils {
  constructor(app, coordinateSystem, animationSystem) {
    this.app = app;
    this.coordinateSystem = coordinateSystem;
    this.animationSystem = animationSystem;
    this.thumbnailCache = new Map();
    this.eventBus = window.TegakiEventBus;
    this.dataURLCache = new Map();
    
    this.updateTimer = null;
    this.updateThrottle = 100; // 100ms
    
    this._setupCameraTransformListener();
  }

  /**
   * Phase 4: AnimationSystem連携強化
   * layer:transform-updated → regenerateAllThumbnails() 確実実行
   */
  _setupCameraTransformListener() {
    if (!this.eventBus) return;
    
    // 統一イベント：全サムネイル再生成
    this.eventBus.on('thumbnail:regenerate-all', () => {
      console.log('📺 [Timeline] Regenerate all thumbnails requested');
      this._invalidateCache();
      this._triggerRegenerateAllThumbnails();
    });
    
    this.eventBus.on('camera:transform-changed', () => {
      console.log('📺 [Timeline] Camera transform changed');
      this._invalidateCache();
      // カメラ変形は throttle なしで即座更新
      this._triggerRegenerateAllThumbnails();
    });
    
    this.eventBus.on('camera:resized', ({ width, height }) => {
      console.log(`📺 [Timeline] Canvas resized to ${width}x${height}`);
      this._invalidateCache();
      this._triggerRegenerateAllThumbnails();
    });
    
    // Phase 4: layer:transform-updated 購読（確実実行）
    this.eventBus.on('layer:transform-updated', ({ data }) => {
      const { layerIndex, layerId, immediate } = data || {};
      
      console.log(`📺 [Timeline] Layer transform updated - layer ${layerIndex || layerId}, immediate=${immediate}`);
      
      // immediate フラグがある場合は即座に実行
      if (immediate) {
        this._invalidateCache();
        this._triggerRegenerateAllThumbnails();
        return;
      }
      
      // throttle: 連続更新を制限
      if (this.updateTimer) {
        clearTimeout(this.updateTimer);
      }
      
      this.updateTimer = setTimeout(() => {
        this._invalidateCache();
        this._triggerRegenerateAllThumbnails();
        this.updateTimer = null;
      }, this.updateThrottle);
    });
    
    // Phase 4: thumbnail:layer-updated 購読
    this.eventBus.on('thumbnail:layer-updated', ({ data }) => {
      const { layerIndex, immediate } = data || {};
      
      console.log(`📺 [Timeline] Thumbnail layer updated - layer ${layerIndex}, immediate=${immediate}`);
      
      if (immediate) {
        this._invalidateCache();
        this._triggerRegenerateAllThumbnails();
        return;
      }
      
      if (this.updateTimer) {
        clearTimeout(this.updateTimer);
      }
      
      this.updateTimer = setTimeout(() => {
        this._invalidateCache();
        this._triggerRegenerateAllThumbnails();
        this.updateTimer = null;
      }, this.updateThrottle);
    });
    
    console.log('✓ [Timeline] Event listeners configured');
  }

  /**
   * Phase 4: AnimationSystem.regenerateAllThumbnails() を確実に実行
   */
  _triggerRegenerateAllThumbnails() {
    if (!this.animationSystem) {
      console.warn('[Timeline] AnimationSystem not available');
      return;
    }
    
    if (typeof this.animationSystem.regenerateAllThumbnails !== 'function') {
      console.warn('[Timeline] AnimationSystem.regenerateAllThumbnails() not found');
      return;
    }
    
    // GSAP統合の場合は delayedCall で実行
    if (typeof gsap !== 'undefined') {
      gsap.delayedCall(0.016, () => {
        this.animationSystem.regenerateAllThumbnails();
      });
    } else {
      // フォールバック: requestAnimationFrame
      requestAnimationFrame(() => {
        this.animationSystem.regenerateAllThumbnails();
      });
    }
    
    console.log('✓ [Timeline] Triggered regenerateAllThumbnails()');
  }

  /**
   * フレームサムネイル生成
   * ThumbnailSystem から Canvas を取得
   */
  async generateThumbnail(frame) {
    if (!frame) return null;

    const cacheKey = `${frame.id}_${frame.canvasWidth || 800}_${frame.canvasHeight || 600}`;
    
    if (this.dataURLCache.has(cacheKey)) {
      return this.dataURLCache.get(cacheKey);
    }

    try {
      if (!window.ThumbnailSystem) {
        console.warn('[Timeline] ThumbnailSystem not initialized');
        return null;
      }

      const canvas = await window.ThumbnailSystem.generateFrameThumbnail(
        frame,
        150,  // maxWidth
        150   // maxHeight
      );

      if (!canvas) {
        return null;
      }

      const dataURL = canvas.toDataURL('image/png');
      this.dataURLCache.set(cacheKey, dataURL);

      return dataURL;

    } catch (error) {
      console.error('[Timeline] Frame thumbnail generation failed:', error);
      return null;
    }
  }

  /**
   * 指定フレームのサムネイル更新
   */
  async updateThumbnailForFrame(frameId) {
    if (!this.animationSystem) return null;

    const frame = this.animationSystem.cuts?.find(c => c.id === frameId);
    if (!frame) return null;

    const keysToDelete = Array.from(this.dataURLCache.keys()).filter(key => 
      key.startsWith(`${frameId}_`)
    );
    keysToDelete.forEach(key => this.dataURLCache.delete(key));

    return await this.generateThumbnail(frame);
  }

  /**
   * 全フレームのサムネイル更新
   */
  async updateAllThumbnails() {
    if (!this.animationSystem?.cuts) return;

    const promises = this.animationSystem.cuts.map(frame =>
      this.generateThumbnail(frame)
    );

    await Promise.all(promises);
  }

  /**
   * キャッシュを無効化
   */
  _invalidateCache() {
    this.thumbnailCache.clear();
    this.dataURLCache.clear();
    
    if (window.ThumbnailSystem) {
      window.ThumbnailSystem.clearAllCache();
    }
  }

  /**
   * 指定フレームのキャッシュを無効化
   */
  invalidateFrameCache(frameId) {
    const keysToDelete = Array.from(this.dataURLCache.keys()).filter(key => 
      key.startsWith(`${frameId}_`)
    );
    keysToDelete.forEach(key => this.dataURLCache.delete(key));
  }

  /**
   * デバッグ情報取得
   */
  getDebugInfo() {
    return {
      cacheSize: this.dataURLCache.size,
      thumbnailCacheSize: this.thumbnailCache.size,
      isInitialized: !!this.app,
      throttleMs: this.updateThrottle,
      animationSystemAvailable: !!this.animationSystem
    };
  }

  /**
   * キャッシュクリア
   */
  clearCache() {
    this._invalidateCache();
  }
  
  /**
   * クリーンアップ
   */
  destroy() {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }
    
    this._invalidateCache();
  }
}

console.log('✅ ui/timeline-thumbnail-utils.js (Phase 4: Timeline連携完全版) loaded');
console.log('   ✓ Phase 1-3: Canvas2D廃止、ThumbnailSystem統合、throttle最適化');
console.log('   ✓ Phase 4: AnimationSystem.regenerateAllThumbnails() 確実実行');
console.log('   ✓ Phase 4: layer:transform-updated → Timeline更新連携');
console.log('   ✓ Phase 4: GSAP統合対応（delayedCall）');