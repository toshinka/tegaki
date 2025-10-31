/**
 * timeline-thumbnail-utils.js - Phase 5: 完全統合版
 * Phase 5改修:
 * 1. Vキーモード変形の完全反映
 * 2. イベント統合・最適化
 * 3. コンソールログクリーンアップ
 * 4. ThumbnailSystem完全統合
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
    this.updateThrottle = 100;
    
    // Phase 5: デバッグモード
    this.debugEnabled = false;
    
    this._setupEventListeners();
  }

  _setupEventListeners() {
    if (!this.eventBus) return;
    
    // 統一イベント：全サムネイル再生成
    this.eventBus.on('thumbnail:regenerate-all', () => {
      this._invalidateCache();
      this._triggerRegenerateAllThumbnails();
    });
    
    // カメラ変形
    this.eventBus.on('camera:transform-changed', () => {
      this._invalidateCache();
      this._triggerRegenerateAllThumbnails();
    });
    
    // カメラリサイズ
    this.eventBus.on('camera:resized', ({ width, height }) => {
      this._invalidateCache();
      this._triggerRegenerateAllThumbnails();
    });
    
    // レイヤー変形更新（throttle付き）
    this.eventBus.on('layer:transform-updated', ({ data }) => {
      const { layerIndex, layerId, immediate } = data || {};
      
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
    
    // サムネイル更新リクエスト
    this.eventBus.on('thumbnail:layer-updated', ({ data }) => {
      const { layerIndex, immediate } = data || {};
      
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
  }

  /**
   * Phase 5: AnimationSystem.regenerateAllThumbnails() を確実に実行
   */
  _triggerRegenerateAllThumbnails() {
    if (!this.animationSystem) {
      if (this.debugEnabled) {
        console.warn('[Timeline] AnimationSystem not available');
      }
      return;
    }
    
    if (typeof this.animationSystem.regenerateAllThumbnails !== 'function') {
      if (this.debugEnabled) {
        console.warn('[Timeline] AnimationSystem.regenerateAllThumbnails() not found');
      }
      return;
    }
    
    // GSAP統合の場合は delayedCall で実行
    if (typeof gsap !== 'undefined') {
      gsap.delayedCall(0.016, () => {
        this.animationSystem.regenerateAllThumbnails();
      });
    } else {
      requestAnimationFrame(() => {
        this.animationSystem.regenerateAllThumbnails();
      });
    }
  }

  /**
   * フレームサムネイル生成（ThumbnailSystem統合）
   */
  async generateThumbnail(frame) {
    if (!frame) return null;

    const cacheKey = `${frame.id}_${frame.canvasWidth || 800}_${frame.canvasHeight || 600}`;
    
    if (this.dataURLCache.has(cacheKey)) {
      return this.dataURLCache.get(cacheKey);
    }

    try {
      if (!window.ThumbnailSystem) {
        if (this.debugEnabled) {
          console.warn('[Timeline] ThumbnailSystem not initialized');
        }
        return null;
      }

      const canvas = await window.ThumbnailSystem.generateFrameThumbnail(
        frame,
        150,
        150
      );

      if (!canvas) {
        return null;
      }

      const dataURL = canvas.toDataURL('image/png');
      this.dataURLCache.set(cacheKey, dataURL);

      return dataURL;

    } catch (error) {
      if (this.debugEnabled) {
        console.error('[Timeline] Frame thumbnail generation failed:', error);
      }
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
   * Phase 5: デバッグモード切替
   */
  setDebugMode(enabled) {
    this.debugEnabled = enabled;
    console.log(`TimelineThumbnailUtils debug mode: ${enabled ? 'ON' : 'OFF'}`);
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
      animationSystemAvailable: !!this.animationSystem,
      debugEnabled: this.debugEnabled
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

console.log('✅ ui/timeline-thumbnail-utils.js Phase 5 loaded');