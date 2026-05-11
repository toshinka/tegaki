class PDFExporter {
  constructor(layerSystem, animationSystem, exportManager) {
    this.layerSystem = layerSystem;
    this.animationSystem = animationSystem;
    this.exportManager = exportManager;
  }

  async generateBlob(options = {}) {
    throw new Error('PDFエクスポートは未実装です');
  }

  async export(options = {}) {
    if (typeof jspdf === 'undefined' || !jspdf.jsPDF) {
      throw new Error('jsPDF ライブラリが読み込まれていません');
    }

    const cuts = this.animationSystem.getCuts();
    if (!cuts || cuts.length === 0) {
      throw new Error('エクスポート可能なカットがありません');
    }

    const pdf = new jspdf.jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [800, 800]
    });

    const currentCut = this.animationSystem.getCurrentCut();

    for (let i = 0; i < cuts.length; i++) {
      if (i > 0) pdf.addPage();
      
      this.animationSystem.switchToCut(cuts[i].id);
      const canvas = this.exportManager.renderToCanvas();
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, 800, 800);
    }

    this.animationSystem.switchToCut(currentCut);

    const pdfBlob = pdf.output('blob');
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = options.filename || `export_${timestamp}.pdf`;

    const a = document.createElement('a');
    a.href = URL.createObjectURL(pdfBlob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);

    return { success: true, filename };
  }
}

window.PDFExporter = PDFExporter;