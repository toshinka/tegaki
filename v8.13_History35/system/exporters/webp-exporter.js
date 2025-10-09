class WebPExporter {
  constructor(layerSystem, animationSystem, exportManager) {
    this.layerSystem = layerSystem;
    this.animationSystem = animationSystem;
    this.exportManager = exportManager;
  }

  async generateBlob(options = {}) {
    const cuts = this.animationSystem.getCuts();
    
    if (!cuts || cuts.length <= 1) {
      const canvas = this.exportManager.renderToCanvas();
      return new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/webp', (options.quality || 80) / 100);
      });
    }

    throw new Error('WebP アニメーションは未実装です');
  }

  async export(options = {}) {
    const blob = await this.generateBlob(options);
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = options.filename || `export_${timestamp}.webp`;

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);

    return { success: true, filename };
  }
}

window.WebPExporter = WebPExporter;