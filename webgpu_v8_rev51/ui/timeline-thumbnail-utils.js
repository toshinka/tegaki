/**
 * timeline-thumbnail-utils.js - Phase 3完全版
 * Canvas2D廃止、ThumbnailSystem 統合
 * Phase 1: layer:transform-updated 購読でタイムライン更新
 * Phase 3: throttle最適化・即座更新実装
 */

class TimelineThumbnailUtils {
  constructor(app, coordinateSystem, animationSystem) {
    this.app = app;
    this.coordinateSystem = coordinateSystem;
    this.animationSystem = animationSystem;
    this.thumbnailCache = new Map();
    this.eventBus = window.TegakiEventBus;
    this.dataURLCache = new Map();
    
    // Phase 3: throttle タイマー管理
    this.updateTimer = null;
    this.updateThrottle = 100; // 100ms
    
    this._setupCameraTransformListener();
  }

  /**
   * カメラ変形時の自動サムネイル更新
   * Phase 1: layer:transform-updated 購読追加
   * Phase 3: throttle最適化
   */
  _setupCameraTransformListener() {
    if (!this.eventBus) return;
    
    // 統一イベント：全サムネイル再生成
    this.eventBus.on('thumbnail:regenerate-all', () => {
      this._invalidateCache();
      
      if (this.animationSystem && typeof this.animationSystem.regenerateAllThumbnails === 'function') {
        setTimeout(() => {
          this.animationSystem.regenerateAllThumbnails();
        }, 50);
      }
    });
    
    this.eventBus.on('camera:transform-changed', () => {
      this._invalidateCache();
    });
    
    this.eventBus.on('camera:resized', ({ width, height }) => {
      this._invalidateCache();
    });
    
    // Phase 3: layer:transform-updated 購読（throttle 付き即座更新）
    this.eventBus.on('layer:transform-updated', ({ data }) => {
      const { layerId, immediate } = data || {};
      
      // immediate フラグがある場合は即座に実行
      if (immediate) {
        this._invalidateCache();
        
        if (this.animationSystem && 
            typeof this.animationSystem.regenerateAllThumbnails === 'function') {
          this.animationSystem.regenerateAllThumbnails();
        }
        return;
      }
      
      // throttle: 連続更新を制限
      if (this.updateTimer) {
        clearTimeout(this.updateTimer);
      }
      
      this.updateTimer = setTimeout(() => {
        this._invalidateCache();
        
        if (this.animationSystem && 
            typeof this.animationSystem.regenerateAllThumbnails === 'function') {
          this.animationSystem.regenerateAllThumbnails();
        }
        
        this.updateTimer = null;
      }, this.updateThrottle);
    });
    
    // Phase 3: thumbnail:layer-updated 購読（タイムライン専用トリガー）
    this.eventBus.on('thumbnail:layer-updated', ({ data }) => {
      const { immediate } = data || {};
      
      // immediate フラグがある場合は即座に実行
      if (immediate) {
        this._invalidateCache();
        
        if (this.animationSystem && 
            typeof this.animationSystem.regenerateAllThumbnails === 'function') {
          this.animationSystem.regenerateAllThumbnails();
        }
        return;
      }
      
      // throttle: 連続更新を制限
      if (this.updateTimer) {
        clearTimeout(this.updateTimer);
      }
      
      this.updateTimer = setTimeout(() => {
        this._invalidateCache();
        
        if (this.animationSystem && 
            typeof this.animationSystem.regenerateAllThumbnails === 'function') {
          this.animationSystem.regenerateAllThumbnails();
        }
        
        this.updateTimer = null;
      }, this.updateThrottle);
    });
  }

  /**
   * フレームサムネイル生成
   * ThumbnailSystem から Canvas を取得
   * 
   * @param {PIXI.Container} frame - フレームコンテナ
   * @returns {Promise<string|null>} DataURL
   */
  async generateThumbnail(frame) {
    if (!frame) return null;

    const cacheKey = `${frame.id}_${frame.canvasWidth || 800}_${frame.canvasHeight || 600}`;
    
    // DataURL キャッシュをチェック
    if (this.dataURLCache.has(cacheKey)) {
      return this.dataURLCache.get(cacheKey);
    }

    try {
      // ThumbnailSystem から Canvas を取得
      if (!window.ThumbnailSystem) {
        console.warn('ThumbnailSystem not initialized');
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

      // Canvas から DataURL に変換
      const dataURL = canvas.toDataURL('image/png');
      
      // DataURL をキャッシュに保存
      this.dataURLCache.set(cacheKey, dataURL);

      return dataURL;

    } catch (error) {
      console.error('Frame thumbnail generation failed:', error);
      return null;
    }
  }

  /**
   * 指定フレームのサムネイル更新
   * 
   * @param {string} frameId
   * @returns {Promise<string|null>} DataURL
   */
  async updateThumbnailForFrame(frameId) {
    if (!this.animationSystem) return null;

    const frame = this.animationSystem.cuts?.find(c => c.id === frameId);
    if (!frame) return null;

    // キャッシュをクリア
    const keysToDelete = Array.from(this.dataURLCache.keys()).filter(key => 
      key.startsWith(`${frameId}_`)
    );
    keysToDelete.forEach(key => this.dataURLCache.delete(key));

    // 新規生成
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
    
    // Phase 3: ThumbnailSystem のキャッシュもクリア
    if (window.ThumbnailSystem) {
      window.ThumbnailSystem.clearAllCache();
    }
  }

  /**
   * 指定フレームのキャッシュを無効化
   * 
   * @param {string} frameId
   */
  invalidateFrameCache(frameId) {
    const keysToDelete = Array.from(this.dataURLCache.keys()).filter(key => 
      key.startsWith(`${frameId}_`)
    );
    keysToDelete.forEach(key => this.dataURLCache.delete(key));
  }

  /**
   * デバッグ情報取得
   * 
   * @returns {object}
   */
  getDebugInfo() {
    return {
      cacheSize: this.dataURLCache.size,
      thumbnailCacheSize: this.thumbnailCache.size,
      isInitialized: !!this.app,
      throttleMs: this.updateThrottle
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

console.log('✅ ui/timeline-thumbnail-utils.js (Phase 3完全版) loaded');
console.log('   ✓ Phase 1: layer:transform-updated 購読追加');
console.log('   ✓ Phase 3: throttle最適化（100ms）');
console.log('   ✓ Phase 3: immediate フラグ対応');
console.log('   ✓ タイムラインサムネイルがレイヤー変形に即座追従');