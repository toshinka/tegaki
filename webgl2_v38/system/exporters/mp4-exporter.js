// ==================================================
// system/exporters/mp4-exporter.js (Phase 8完成版)
// MP4エクスポーター - DataModel対応（未実装）
// ==================================================
class MP4Exporter {
  constructor(exportManager) {
    if (!exportManager) {
      throw new Error('MP4Exporter: exportManager is required');
    }
    this.manager = exportManager;
  }

  /**
   * Phase 8: exportData形式で受け取る
   */
  async generateBlob(exportData) {
    throw new Error('MP4エクスポートは未実装です');
  }

  /**
   * Phase 8: exportData形式で受け取る
   */
  async export(exportData) {
    throw new Error('MP4エクスポートは未実装です');
  }
}

window.MP4Exporter = MP4Exporter;

console.log('✅ mp4-exporter.js (Phase 8完成版) loaded');