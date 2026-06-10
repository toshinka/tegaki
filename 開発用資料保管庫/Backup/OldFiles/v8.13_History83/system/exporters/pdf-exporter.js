// ==================================================
// system/exporters/pdf-exporter.js (Phase 8完成版)
// PDFエクスポーター - DataModel対応
// ==================================================
class PDFExporter {
  constructor(exportManager) {
    if (!exportManager) {
      throw new Error('PDFExporter: exportManager is required');
    }
    this.manager = exportManager;
  }

  /**
   * Phase 8: exportData形式で受け取る
   */
  async generateBlob(exportData) {
    const { options = {} } = exportData || {};
    
    if (typeof jspdf === 'undefined' || !jspdf.jsPDF) {
      throw new Error('jsPDF ライブラリが読み込まれていません');
    }

    const cuts = this.manager.animationSystem.getCuts();
    if (!cuts || cuts.length === 0) {
      throw new Error('エクスポート可能なカットがありません');
    }

    const pdf = new jspdf.jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [800, 800]
    });

    const currentCut = this.manager.animationSystem.getCurrentCut();
    const backupSnapshots = this.manager.animationSystem.captureAllLayerStates();

    for (let i = 0; i < cuts.length; i++) {
      if (i > 0) pdf.addPage();
      
      this.manager.animationSystem.applyCutToLayers(i);
      await this._waitFrame();
      
      const canvas = this.manager.renderToCanvas(options);
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, 800, 800);
    }

    this.manager.animationSystem.restoreFromSnapshots(backupSnapshots);

    return pdf.output('blob');
  }

  /**
   * Phase 8: exportData形式で受け取る
   */
  async export(exportData) {
    const { options = {} } = exportData || {};
    
    if (window.TegakiEventBus) {
      window.TegakiEventBus.emit('export:started', { format: 'pdf' });
    }

    try {
      const pdfBlob = await this.generateBlob(exportData);
      
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = options.filename || `tegaki_${timestamp}.pdf`;

      this.manager.downloadFile(pdfBlob, filename);

      if (window.TegakiEventBus) {
        window.TegakiEventBus.emit('export:completed', {
          format: 'pdf',
          size: pdfBlob.size,
          filename: filename
        });
      }

      return { success: true, filename, blob: pdfBlob, format: 'pdf' };
    } catch (error) {
      if (window.TegakiEventBus) {
        window.TegakiEventBus.emit('export:failed', {
          format: 'pdf',
          error: error.message
        });
      }
      throw error;
    }
  }

  _waitFrame() {
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        setTimeout(resolve, 16);
      });
    });
  }
}

window.PDFExporter = PDFExporter;

console.log('✅ pdf-exporter.js (Phase 8完成版) loaded');