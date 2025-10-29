/**
 * timeline-thumbnail-utils.js - Phase 1完全版
 * Canvas2D廃止、ThumbnailSystem 統合
 * Phase 1追加: layer:transform-updated 購読でタイムライン更新
 */

class TimelineThumbnailUtils {
  constructor(app, coordinateSystem, animationSystem) {
    this.app = app;
    this.coordinateSystem = coordinateSystem;
    this.animationSystem = animationSystem;
    this.thumbnailCache = new Map();
    this.eventBus = window.TegakiEventBus;
    this.dataURLCache = new Map();
    
    this._setupCameraTransformListener();
  }

  /**
   * カメラ変形時の自動サムネイル更新
   * Phase 1: layer:transform-updated 購読追加
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
    
    // Phase 1: layer:transform-updated 購読追加
    // レイヤー変形時にタイムラインサムネイルも更新
    this.eventBus.on('layer:transform-updated', ({ layerId }) => {
      // 全フレームのキャッシュをクリア（レイヤーは全フレームに影響）
      this._invalidateCache();
      
      // 非同期で再生成（throttle を考慮して遅延）
      if (this.animationSystem && 
          typeof this.animationSystem.regenerateAllThumbnails === 'function') {
        setTimeout(() => {
          this.animationSystem.regenerateAllThumbnails();
        }, 150); // thumbnail-system の throttle (100ms) より後に実行
      }
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
      isInitialized: !!this.app
    };
  }

  /**
   * キャッシュクリア
   */
  clearCache() {
    this._invalidateCache();
  }
}

console.log('✅ ui/timeline-thumbnail-utils.js (Phase 1完全版) loaded');
console.log('   - Phase 1: layer:transform-updated 購読追加');
console.log('   - タイムラインサムネイルがレイヤー変形に追従');