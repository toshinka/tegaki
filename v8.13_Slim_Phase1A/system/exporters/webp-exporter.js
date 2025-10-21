// ==================================================
// system/exporters/webp-exporter.js (Phase 8完成版)
// WebPエクスポーター - DataModel対応
// ==================================================
class WebPExporter {
  constructor(exportManager) {
    if (!exportManager) {
      throw new Error('WebPExporter: exportManager is required');
    }
    this.manager = exportManager;
  }

  /**
   * Phase 8: exportData形式で受け取る
   */
  async generateBlob(exportData) {
    const { options = {} } = exportData || {};
    
    const cuts = this.manager.animationSystem.getCuts();
    
    if (!cuts || cuts.length <= 1) {
      const canvas = this.manager.renderToCanvas(options);
      return new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/webp', (options.quality || 80) / 100);
      });
    }

    throw new Error('WebP アニメーションは未実装です');
  }

  /**
   * Phase 8: exportData形式で受け取る
   */
  async export(exportData) {
    const { options = {} } = exportData || {};
    
    if (window.TegakiEventBus) {
      window.TegakiEventBus.emit('export:started', { format: 'webp' });
    }
    
    try {
      const blob = await this.generateBlob(exportData);
      
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = options.filename || `tegaki_${timestamp}.webp`;

      this.manager.downloadFile(blob, filename);

      if (window.TegakiEventBus) {
        window.TegakiEventBus.emit('export:completed', {
          format: 'webp',
          size: blob.size,
          filename: filename
        });
      }

      return { success: true, filename, blob, format: 'webp' };
    } catch (error) {
      if (window.TegakiEventBus) {
        window.TegakiEventBus.emit('export:failed', {
          format: 'webp',
          error: error.message
        });
      }
      throw error;
    }
  }
}

window.WebPExporter = WebPExporter;

console.log('✅ webp-exporter.js (Phase 8完成版) loaded');